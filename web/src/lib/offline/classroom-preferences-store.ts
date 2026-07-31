"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { runCloudTask } from "@/lib/supabase/cloud-sync";

type ClassroomPreferences = {
  version: 1;
  semesterStart: string;
  completedItemKeys: string[];
  updatedAt: string;
};

const EMPTY_DATA: ClassroomPreferences = {
  version: 1,
  semesterStart: "",
  completedItemKeys: [],
  updatedAt: "",
};
const EMPTY_SERIALIZED = JSON.stringify(EMPTY_DATA);
const CHANGE_EVENT = "ekampusmo-classroom-preferences-change";

function storageKey(userId: string) {
  return `ekampusmo:${userId}:classroom-preferences-v1`;
}

function parseData(serialized: string | null): ClassroomPreferences {
  if (!serialized) return EMPTY_DATA;
  try {
    const parsed = JSON.parse(serialized) as Partial<ClassroomPreferences>;
    return {
      version: 1,
      semesterStart:
        typeof parsed.semesterStart === "string"
          ? parsed.semesterStart
          : "",
      completedItemKeys: Array.isArray(parsed.completedItemKeys)
        ? parsed.completedItemKeys.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return EMPTY_DATA;
  }
}

function readSerialized(userId: string) {
  if (typeof window === "undefined") return EMPTY_SERIALIZED;
  return window.localStorage.getItem(storageKey(userId)) ?? EMPTY_SERIALIZED;
}

function writeData(userId: string, data: ClassroomPreferences) {
  const key = storageKey(userId);
  window.localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
}

function upsertPreferencesInCloud(
  userId: string,
  data: ClassroomPreferences,
) {
  void runCloudTask(async () => {
    const { error } = await createClient()
      .from("classroom_assignment_preferences")
      .upsert({
        user_id: userId,
        semester_start: data.semesterStart || null,
        completed_item_keys: data.completedItemKeys,
        updated_at: data.updatedAt,
      });
    if (error) throw error;
  });
}

async function syncPreferences(userId: string) {
  await runCloudTask(async () => {
    const local = parseData(readSerialized(userId));
    const { data: row, error } = await createClient()
      .from("classroom_assignment_preferences")
      .select("semester_start, completed_item_keys, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    const cloud: ClassroomPreferences | null = row
      ? {
          version: 1,
          semesterStart:
            typeof row.semester_start === "string"
              ? row.semester_start
              : "",
          completedItemKeys: Array.isArray(row.completed_item_keys)
            ? row.completed_item_keys.filter(
                (value): value is string => typeof value === "string",
              )
            : [],
          updatedAt:
            typeof row.updated_at === "string" ? row.updated_at : "",
        }
      : null;
    const selected =
      cloud && cloud.updatedAt >= local.updatedAt ? cloud : local;

    writeData(userId, selected);
    if (!cloud || selected === local) {
      const { error: upsertError } = await createClient()
        .from("classroom_assignment_preferences")
        .upsert({
          user_id: userId,
          semester_start: selected.semesterStart || null,
          completed_item_keys: selected.completedItemKeys,
          updated_at: selected.updatedAt || new Date().toISOString(),
        });
      if (upsertError) throw upsertError;
    }
  });
}

export function saveClassroomSemesterStart(
  userId: string,
  semesterStart: string,
) {
  const current = parseData(readSerialized(userId));
  const next: ClassroomPreferences = {
    ...current,
    semesterStart,
    updatedAt: new Date().toISOString(),
  };
  writeData(userId, next);
  upsertPreferencesInCloud(userId, next);
}

export function setClassroomItemCompleted(
  userId: string,
  itemKey: string,
  completed: boolean,
) {
  const current = parseData(readSerialized(userId));
  const keys = new Set(current.completedItemKeys);
  if (completed) keys.add(itemKey);
  else keys.delete(itemKey);
  const next: ClassroomPreferences = {
    ...current,
    completedItemKeys: [...keys],
    updatedAt: new Date().toISOString(),
  };
  writeData(userId, next);
  upsertPreferencesInCloud(userId, next);
}

export function useClassroomPreferences(userId: string) {
  useEffect(() => {
    void syncPreferences(userId);
  }, [userId]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const key = storageKey(userId);
      const storageHandler = (event: StorageEvent) => {
        if (event.key === key) onStoreChange();
      };
      const localHandler = (event: Event) => {
        const detail = (event as CustomEvent<{ key?: string }>).detail;
        if (detail?.key === key) onStoreChange();
      };
      window.addEventListener("storage", storageHandler);
      window.addEventListener(CHANGE_EVENT, localHandler);
      return () => {
        window.removeEventListener("storage", storageHandler);
        window.removeEventListener(CHANGE_EVENT, localHandler);
      };
    },
    [userId],
  );
  const getSnapshot = useCallback(() => readSerialized(userId), [userId]);
  const serialized = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_SERIALIZED,
  );

  return useMemo(() => parseData(serialized), [serialized]);
}
