"use client";

import {
  useCallback,
  useEffect,
  useSyncExternalStore,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CloudSyncState =
  | "checking"
  | "syncing"
  | "synced"
  | "offline"
  | "error";

type CloudSyncSnapshot = {
  state: CloudSyncState;
  message: string;
  changedAt: number;
};

type PendingDelete = {
  table: CloudTable;
  id: string;
};

export type CloudTable =
  | "subjects"
  | "class_schedules"
  | "assignments"
  | "internships"
  | "internship_entries"
  | "allowance_periods"
  | "expenses";

export type CloudDeletion = {
  table: CloudTable;
  id: string;
};

const listeners = new Set<() => void>();
const userTaskChains = new Map<string, Promise<unknown>>();
let activeTasks = 0;
let snapshot: CloudSyncSnapshot = {
  state: "checking",
  message: "Checking cloud connection",
  changedAt: 0,
};

function emit(next: Omit<CloudSyncSnapshot, "changedAt">) {
  snapshot = { ...next, changedAt: Date.now() };
  listeners.forEach((listener) => listener());
}

function describeError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
    };
    const message =
      typeof candidate.message === "string" ? candidate.message : "";
    const code = typeof candidate.code === "string" ? candidate.code : "";
    const details =
      typeof candidate.details === "string" ? candidate.details : "";
    return [message, code && `(${code})`, details].filter(Boolean).join(" ");
  }
  return "Unable to reach Supabase";
}

function deleteQueueKey(userId: string) {
  return `ekampusmo:${userId}:pending-cloud-deletes-v1`;
}

function readDeleteQueue(userId: string): PendingDelete[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(deleteQueueKey(userId)) ?? "[]",
    ) as PendingDelete[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDeleteQueue(userId: string, items: PendingDelete[]) {
  window.localStorage.setItem(deleteQueueKey(userId), JSON.stringify(items));
}

export function queueCloudDelete(
  userId: string,
  table: CloudTable,
  id: string,
) {
  if (typeof window === "undefined") return;
  const queue = readDeleteQueue(userId);
  if (!queue.some((item) => item.table === table && item.id === id)) {
    writeDeleteQueue(userId, [...queue, { table, id }]);
  }
}

export async function flushCloudDeletes(
  supabase: SupabaseClient,
  userId: string,
  tables: CloudTable[],
) {
  const queue = readDeleteQueue(userId);
  const remaining: PendingDelete[] = [];

  for (const item of queue) {
    if (!tables.includes(item.table)) {
      remaining.push(item);
      continue;
    }

    const { error } = await supabase
      .from(item.table)
      .delete()
      .eq("id", item.id)
      .eq("user_id", userId);
    if (error) {
      remaining.push(item);
      writeDeleteQueue(userId, [...remaining, ...queue.slice(queue.indexOf(item) + 1)]);
      throw error;
    }
  }

  writeDeleteQueue(userId, remaining);
}

export async function runCloudTask<T>(
  task: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emit({
      state: "offline",
      message: "Offline · changes remain safely on this device",
    });
    return { ok: false, error: new Error("The device is offline.") };
  }

  activeTasks += 1;
  emit({ state: "syncing", message: "Syncing with Supabase" });

  try {
    const value = await task();
    activeTasks -= 1;
    if (activeTasks === 0) {
      emit({ state: "synced", message: "All changes synced" });
    }
    return { ok: true, value };
    } catch (error) {
    activeTasks = Math.max(0, activeTasks - 1);

    const detail = describeError(error);
    // Sync failures are recoverable because the local cache remains the source
    // of truth until the next successful retry. Warn without triggering the
    // Next.js development error overlay.
    console.warn("[E-KampusMo cloud sync failed]", detail);

    emit({
      state: "error",
      message: `Cloud sync needs attention · ${detail}`,
    });

    return { ok: false, error };
  }
}

export function acknowledgeCloudDelete(
  userId: string,
  table: CloudTable,
  id: string,
) {
  const queue = readDeleteQueue(userId);
  writeDeleteQueue(
    userId,
    queue.filter((item) => item.table !== table || item.id !== id),
  );
}

export async function deleteCloudRecord(table: CloudTable, id: string) {
  const response = await fetch("/api/cloud-records/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, id }),
  });
  if (response.ok) return;

  const result = (await response.json().catch(() => ({}))) as {
    error?: unknown;
  };
  throw new Error(
    typeof result.error === "string"
      ? result.error
      : "The record could not be deleted from Supabase.",
  );
}

export async function loadCloudDeletions(
  supabase: SupabaseClient,
  userId: string,
  tables: CloudTable[],
) {
  const { data, error } = await supabase
    .from("student_record_deletions")
    .select("table_name, record_id")
    .eq("user_id", userId)
    .in("table_name", tables);
  if (error) throw error;

  return new Set(
    (data ?? []).map(
      (row) => `${String(row.table_name)}:${String(row.record_id)}`,
    ),
  );
}

export function isCloudDeletion(
  deletions: Set<string>,
  table: CloudTable,
  id: string,
) {
  return deletions.has(`${table}:${id}`);
}

/** Keeps each account's cloud changes ordered, including deletes. */
export function runCloudTaskForUser<T>(
  userId: string,
  task: () => Promise<T>,
) {
  const previous = userTaskChains.get(userId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => runCloudTask(task));

  userTaskChains.set(userId, next);
  void next.finally(() => {
    if (userTaskChains.get(userId) === next) userTaskChains.delete(userId);
  });
  return next;
}

export function markCloudPending() {
  emit({ state: "checking", message: "Checking cloud connection" });
}

export function useCloudSyncStatus() {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  const getSnapshot = useCallback(() => snapshot, []);

  useEffect(() => {
    const handleOnline = () => markCloudPending();
    const handleOffline = () =>
      emit({
        state: "offline",
        message: "Offline · changes remain safely on this device",
      });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (!window.navigator.onLine) handleOffline();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
