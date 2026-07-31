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

const listeners = new Set<() => void>();
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
    emit({
      state: "error",
      message: "Cloud sync needs attention",
    });
    return { ok: false, error };
  }
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
