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
  readAnnouncementKeys: string[];
  updatedAt: string;
};

const EMPTY_DATA: ClassroomPreferences = {
  version: 1,
  semesterStart: "",
  completedItemKeys: [],
  readAnnouncementKeys: [],
  updatedAt: "",
};
const EMPTY_SERIALIZED = JSON.stringify(EMPTY_DATA);
const CHANGE_EVENT = "ekampusmo-classroom-preferences-change";

type CloudPreferencesRow = {
  semester_start: string | null;
  completed_item_keys: unknown;
  read_announcement_keys?: unknown;
  updated_at: string;
};

function isMissingAnnouncementColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /read_announcement_keys.*column|column.*read_announcement_keys/i.test(
      message,
    )
  );
}

async function upsertCloudPreferences(
  userId: string,
  data: ClassroomPreferences,
) {
  const client = createClient();
  const payload = {
    user_id: userId,
    semester_start: data.semesterStart || null,
    completed_item_keys: data.completedItemKeys,
    read_announcement_keys: data.readAnnouncementKeys,
    updated_at: data.updatedAt || new Date().toISOString(),
  };
  let { error } = await client
    .from("classroom_assignment_preferences")
    .upsert(payload);

  // Keep existing installations working until migration 202607300003 is
  // applied. Announcement read states remain local until that column exists.
  if (error && isMissingAnnouncementColumn(error)) {
    ({ error } = await client
      .from("classroom_assignment_preferences")
      .upsert({
        user_id: payload.user_id,
        semester_start: payload.semester_start,
        completed_item_keys: payload.completed_item_keys,
        updated_at: payload.updated_at,
      }));
  }

  if (error) throw error;
}

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
      readAnnouncementKeys: Array.isArray(parsed.readAnnouncementKeys)
        ? parsed.readAnnouncementKeys.filter(
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
    await upsertCloudPreferences(userId, data);
  });
}

async function syncPreferences(userId: string) {
  await runCloudTask(async () => {
    const local = parseData(readSerialized(userId));
    const client = createClient();
    let supportsAnnouncementReadState = true;
    let { data: row, error } = await client
      .from("classroom_assignment_preferences")
      .select(
        "semester_start, completed_item_keys, read_announcement_keys, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error && isMissingAnnouncementColumn(error)) {
      supportsAnnouncementReadState = false;
      const legacyResult = await client
        .from("classroom_assignment_preferences")
        .select("semester_start, completed_item_keys, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      row = legacyResult.data as typeof row;
      error = legacyResult.error;
    }

    if (error) throw error;

    const cloudRow = row as CloudPreferencesRow | null;
    const cloud: ClassroomPreferences | null = cloudRow
      ? {
          version: 1,
          semesterStart:
            typeof cloudRow.semester_start === "string"
              ? cloudRow.semester_start
              : "",
          completedItemKeys: Array.isArray(cloudRow.completed_item_keys)
            ? cloudRow.completed_item_keys.filter(
                (value): value is string => typeof value === "string",
              )
            : [],
          readAnnouncementKeys: Array.isArray(cloudRow.read_announcement_keys)
            ? cloudRow.read_announcement_keys.filter(
                (value): value is string => typeof value === "string",
              )
            : supportsAnnouncementReadState
              ? []
              : local.readAnnouncementKeys,
          updatedAt:
            typeof cloudRow.updated_at === "string"
              ? cloudRow.updated_at
              : "",
        }
      : null;
    const selected =
      cloud && cloud.updatedAt >= local.updatedAt ? cloud : local;

    writeData(userId, selected);
    if (!cloud || selected === local) {
      await upsertCloudPreferences(userId, selected);
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

export function setClassroomAnnouncementRead(
  userId: string,
  announcementKey: string,
  read: boolean,
) {
  const current = parseData(readSerialized(userId));
  const keys = new Set(current.readAnnouncementKeys);
  if (read) keys.add(announcementKey);
  else keys.delete(announcementKey);
  const next: ClassroomPreferences = {
    ...current,
    readAnnouncementKeys: [...keys],
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
