"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  flushCloudDeletes,
  queueCloudDelete,
  runCloudTask,
} from "@/lib/supabase/cloud-sync";
import {
  addCalendarDays,
  isWeekendDate,
  type PhilippinesHoliday,
} from "@/lib/calendar/philippines-calendar";

export type InternshipProfile = {
  id: string;
  companyName: string;
  companyAddress: string;
  position: string;
  supervisorName: string;
  requiredMinutes: number;
  startDate: string;
  expectedEndDate: string;
  defaultBreakMinutes: number;
  maxDailyMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type InternshipEntryStatus = "worked" | "absent";
export type InternshipDayClassification =
  | "absent"
  | "no-hours"
  | "half-day"
  | "early-out"
  | "full-day";

export type InternshipEntry = {
  id: string;
  status: InternshipEntryStatus;
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  adjustmentMinutes: number;
  adjustmentNote: string;
  activities: string;
  reflection: string;
  createdAt: string;
  updatedAt: string;
};

type InternshipData = {
  version: 1;
  profile: InternshipProfile | null;
  entries: InternshipEntry[];
};

type ProfileInput = Omit<
  InternshipProfile,
  "id" | "createdAt" | "updatedAt"
>;
type EntryInput = Omit<InternshipEntry, "id" | "createdAt" | "updatedAt">;

const EMPTY_DATA: InternshipData = {
  version: 1,
  profile: null,
  entries: [],
};
const EMPTY_SERIALIZED = JSON.stringify(EMPTY_DATA);
const CHANGE_EVENT = "ekampusmo-internship-change";

function storageKey(userId: string) {
  return `ekampusmo:${userId}:offline-internship-v1`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseData(serialized: string | null): InternshipData {
  if (!serialized) return EMPTY_DATA;

  try {
    const parsed = JSON.parse(serialized) as Partial<InternshipData>;
    const profile = parsed.profile
      ? {
          ...parsed.profile,
          maxDailyMinutes:
            Number(parsed.profile.maxDailyMinutes) > 0
              ? Number(parsed.profile.maxDailyMinutes)
              : 480,
        }
      : null;
    const entries: InternshipEntry[] = Array.isArray(parsed.entries)
      ? parsed.entries.map((entry): InternshipEntry => ({
          ...entry,
          status: entry.status === "absent" ? "absent" : "worked",
          clockIn: entry.clockIn ?? "",
          clockOut: entry.clockOut ?? "",
        }))
      : [];
    return {
      version: 1,
      profile,
      entries,
    };
  } catch {
    return EMPTY_DATA;
  }
}

function readSerialized(userId: string) {
  if (typeof window === "undefined") return EMPTY_SERIALIZED;
  return window.localStorage.getItem(storageKey(userId)) ?? EMPTY_SERIALIZED;
}

function writeData(userId: string, data: InternshipData) {
  const key = storageKey(userId);
  window.localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
}

function profileRow(userId: string, profile: InternshipProfile) {
  return {
    id: profile.id,
    user_id: userId,
    company_name: profile.companyName,
    company_address: profile.companyAddress,
    position: profile.position,
    supervisor_name: profile.supervisorName,
    required_minutes: profile.requiredMinutes,
    start_date: profile.startDate,
    expected_end_date: profile.expectedEndDate,
    default_break_minutes: profile.defaultBreakMinutes,
    max_daily_minutes: profile.maxDailyMinutes,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

function entryRow(
  userId: string,
  internshipId: string,
  entry: InternshipEntry,
) {
  return {
    id: entry.id,
    user_id: userId,
    internship_id: internshipId,
    entry_status: entry.status,
    date: entry.date,
    clock_in: entry.status === "absent" ? null : entry.clockIn,
    clock_out: entry.status === "absent" ? null : entry.clockOut,
    break_minutes: entry.breakMinutes,
    adjustment_minutes: entry.adjustmentMinutes,
    adjustment_note: entry.adjustmentNote,
    activities: entry.activities,
    reflection: entry.reflection,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function profileFromRow(row: Record<string, unknown>): InternshipProfile {
  return {
    id: String(row.id),
    companyName: String(row.company_name),
    companyAddress: String(row.company_address ?? ""),
    position: String(row.position),
    supervisorName: String(row.supervisor_name ?? ""),
    requiredMinutes: Number(row.required_minutes),
    startDate: String(row.start_date),
    expectedEndDate: String(row.expected_end_date),
    defaultBreakMinutes: Number(row.default_break_minutes),
    maxDailyMinutes: Number(row.max_daily_minutes ?? 480),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function entryFromRow(row: Record<string, unknown>): InternshipEntry {
  return {
    id: String(row.id),
    status: row.entry_status === "absent" ? "absent" : "worked",
    date: String(row.date),
    clockIn: row.clock_in ? String(row.clock_in).slice(0, 5) : "",
    clockOut: row.clock_out ? String(row.clock_out).slice(0, 5) : "",
    breakMinutes: Number(row.break_minutes),
    adjustmentMinutes: Number(row.adjustment_minutes),
    adjustmentNote: String(row.adjustment_note ?? ""),
    activities: String(row.activities),
    reflection: String(row.reflection ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function syncInternshipData(userId: string) {
  await runCloudTask(async () => {
    const supabase = createClient();
    await flushCloudDeletes(supabase, userId, [
      "internship_entries",
      "internships",
    ]);
    const local = parseData(readSerialized(userId));
    const existingProfile = await supabase
      .from("internships")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingProfile.error) throw existingProfile.error;

    if (local.profile) {
      const shouldUploadProfile =
        !existingProfile.data ||
        local.profile.updatedAt > String(existingProfile.data.updated_at);
      const activeProfile = existingProfile.data
        ? { ...local.profile, id: String(existingProfile.data.id) }
        : local.profile;
      if (shouldUploadProfile) {
        const { error } = await supabase
          .from("internships")
          .upsert(profileRow(userId, activeProfile));
        if (error) throw error;
      }

      if (local.entries.length > 0) {
        const existingEntries = await supabase
          .from("internship_entries")
          .select("id, updated_at")
          .eq("user_id", userId)
          .eq("internship_id", activeProfile.id);
        if (existingEntries.error) throw existingEntries.error;
        const cloudEntryTimes = new Map(
          (existingEntries.data ?? []).map((row) => [
            String(row.id),
            String(row.updated_at),
          ]),
        );
        const entriesToUpdate = local.entries.filter((entry) => {
          const cloudUpdatedAt = cloudEntryTimes.get(entry.id);
          return Boolean(cloudUpdatedAt && entry.updatedAt > cloudUpdatedAt);
        });
        for (const entry of entriesToUpdate) {
          const { error: updateError } = await supabase
            .from("internship_entries")
            .update(entryRow(userId, activeProfile.id, entry))
            .eq("id", entry.id)
            .eq("user_id", userId);
          if (updateError) throw updateError;
        }

        const entriesToInsert = local.entries.filter(
          (entry) => !cloudEntryTimes.has(entry.id),
        );
        if (entriesToInsert.length > 0) {
          const { error: entriesError } = await supabase
            .from("internship_entries")
            .upsert(
              entriesToInsert.map((entry) =>
                entryRow(userId, activeProfile.id, entry),
              ),
              { onConflict: "user_id,internship_id,date" },
            );
          if (entriesError) throw entriesError;
        }
      }
    }

    const profileResult = await supabase
      .from("internships")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileResult.error) throw profileResult.error;

    if (!profileResult.data) {
      writeData(userId, { version: 1, profile: null, entries: [] });
      return;
    }

    const entriesResult = await supabase
      .from("internship_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("internship_id", profileResult.data.id)
      .order("date", { ascending: false });
    if (entriesResult.error) throw entriesResult.error;
    writeData(userId, {
      version: 1,
      profile: profileFromRow(profileResult.data),
      entries: (entriesResult.data ?? []).map(entryFromRow),
    });
  });
}

function upsertProfileInCloud(userId: string, profile: InternshipProfile) {
  void runCloudTask(async () => {
    const { error } = await createClient()
      .from("internships")
      .upsert(profileRow(userId, profile));
    if (error) throw error;
  });
}

function upsertEntryInCloud(
  userId: string,
  profile: InternshipProfile,
  entry: InternshipEntry,
) {
  void runCloudTask(async () => {
    const supabase = createClient();
    const { error: profileError } = await supabase
      .from("internships")
      .upsert(profileRow(userId, profile));
    if (profileError) throw profileError;
    const { error } = await supabase
      .from("internship_entries")
      .upsert(entryRow(userId, profile.id, entry), {
        onConflict: "user_id,internship_id,date",
      });
    if (error) throw error;
  });
}

function updateEntryInCloud(
  userId: string,
  profile: InternshipProfile,
  entry: InternshipEntry,
) {
  void runCloudTask(async () => {
    const supabase = createClient();
    const { error: profileError } = await supabase
      .from("internships")
      .upsert(profileRow(userId, profile));
    if (profileError) throw profileError;
    const { error } = await supabase
      .from("internship_entries")
      .update(entryRow(userId, profile.id, entry))
      .eq("id", entry.id)
      .eq("user_id", userId);
    if (error) throw error;
  });
}

export function saveInternshipProfile(userId: string, input: ProfileInput) {
  const data = parseData(readSerialized(userId));
  const timestamp = new Date().toISOString();
  const profile: InternshipProfile = data.profile
    ? { ...data.profile, ...input, updatedAt: timestamp }
    : {
        ...input,
        id: createId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

  writeData(userId, { ...data, profile });
  upsertProfileInCloud(userId, profile);
  return profile;
}

export function addInternshipEntry(userId: string, input: EntryInput) {
  const data = parseData(readSerialized(userId));
  const timestamp = new Date().toISOString();
  const existing = data.entries.find((entry) => entry.date === input.date);

  if (existing) {
    const entry = { ...existing, ...input, updatedAt: timestamp };
    writeData(userId, {
      ...data,
      entries: data.entries.map((item) =>
        item.id === existing.id ? entry : item,
      ),
    });
    if (data.profile) upsertEntryInCloud(userId, data.profile, entry);
    return entry;
  }

  const entry: InternshipEntry = {
    ...input,
    id: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  writeData(userId, { ...data, entries: [...data.entries, entry] });
  if (data.profile) upsertEntryInCloud(userId, data.profile, entry);
  return entry;
}

export function updateInternshipEntry(
  userId: string,
  entryId: string,
  input: EntryInput,
) {
  const data = parseData(readSerialized(userId));
  const existing = data.entries.find((entry) => entry.id === entryId);
  if (!existing) return null;

  const entry: InternshipEntry = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  writeData(userId, {
    ...data,
    entries: data.entries.map((item) =>
      item.id === entryId ? entry : item,
    ),
  });
  if (data.profile) updateEntryInCloud(userId, data.profile, entry);
  return entry;
}

export function removeInternshipEntry(userId: string, entryId: string) {
  const data = parseData(readSerialized(userId));
  writeData(userId, {
    ...data,
    entries: data.entries.filter((entry) => entry.id !== entryId),
  });
  queueCloudDelete(userId, "internship_entries", entryId);
  void runCloudTask(() =>
    flushCloudDeletes(createClient(), userId, ["internship_entries"]),
  );
}

export function removeInternshipProfile(userId: string, profileId: string) {
  writeData(userId, { version: 1, profile: null, entries: [] });
  queueCloudDelete(userId, "internships", profileId);
  void runCloudTask(() =>
    flushCloudDeletes(createClient(), userId, ["internships"]),
  );
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

export function calculateRenderedMinutes({
  status,
  clockIn,
  clockOut,
  breakMinutes,
  adjustmentMinutes,
}: Pick<
  InternshipEntry,
  | "status"
  | "clockIn"
  | "clockOut"
  | "breakMinutes"
  | "adjustmentMinutes"
>) {
  if (status === "absent") return 0;
  const start = timeToMinutes(clockIn);
  const end = timeToMinutes(clockOut);
  if (start === null || end === null || end <= start) return null;
  return Math.max(0, end - start - breakMinutes + adjustmentMinutes);
}

export function calculateCreditedMinutes(
  entry: Pick<
    InternshipEntry,
    | "status"
    | "clockIn"
    | "clockOut"
    | "breakMinutes"
    | "adjustmentMinutes"
  >,
  maxDailyMinutes: number,
) {
  const rendered = calculateRenderedMinutes(entry);
  return rendered === null
    ? null
    : Math.min(rendered, Math.max(1, maxDailyMinutes));
}

export function classifyInternshipDay(
  entry: Pick<
    InternshipEntry,
    | "status"
    | "clockIn"
    | "clockOut"
    | "breakMinutes"
    | "adjustmentMinutes"
  >,
  maxDailyMinutes: number,
) {
  if (entry.status === "absent") {
    return {
      classification: "absent" as const,
      label: "Absent",
      creditedMinutes: 0,
      shortfallMinutes: 0,
    };
  }

  const dailyMaximum = Math.max(1, maxDailyMinutes);
  const creditedMinutes = calculateCreditedMinutes(entry, dailyMaximum);
  if (creditedMinutes === null || creditedMinutes <= 0) {
    return {
      classification: "no-hours" as const,
      label: "No credited time",
      creditedMinutes,
      shortfallMinutes: dailyMaximum,
    };
  }
  if (creditedMinutes >= dailyMaximum) {
    return {
      classification: "full-day" as const,
      label: "Full day",
      creditedMinutes,
      shortfallMinutes: 0,
    };
  }
  if (creditedMinutes <= dailyMaximum / 2) {
    return {
      classification: "half-day" as const,
      label: "Half day",
      creditedMinutes,
      shortfallMinutes: dailyMaximum - creditedMinutes,
    };
  }
  return {
    classification: "early-out" as const,
    label: "Early out",
    creditedMinutes,
    shortfallMinutes: dailyMaximum - creditedMinutes,
  };
}

export function calculateInternshipSummary(
  profile: InternshipProfile | null,
  entries: InternshipEntry[],
) {
  const maxDailyMinutes = profile?.maxDailyMinutes ?? 480;
  const classifiedEntries = entries.map((entry) =>
    classifyInternshipDay(entry, maxDailyMinutes),
  );
  const renderedMinutes = entries.reduce(
    (total, entry) =>
      total +
      (calculateCreditedMinutes(entry, maxDailyMinutes) ?? 0),
    0,
  );
  const requiredMinutes = profile?.requiredMinutes ?? 0;
  const remainingMinutes = Math.max(0, requiredMinutes - renderedMinutes);
  const additionalMinutes = Math.max(0, renderedMinutes - requiredMinutes);
  const progressPercent =
    requiredMinutes > 0
      ? Math.min(100, Math.round((renderedMinutes / requiredMinutes) * 1000) / 10)
      : 0;
  const workedEntries = entries.filter((entry) => entry.status === "worked");
  const averageMinutes =
    workedEntries.length > 0
      ? Math.round(renderedMinutes / workedEntries.length)
      : 0;
  const estimatedWorkdays =
    profile && remainingMinutes > 0
      ? Math.ceil(remainingMinutes / profile.maxDailyMinutes)
      : remainingMinutes === 0
        ? 0
        : null;

  return {
    renderedMinutes,
    requiredMinutes,
    remainingMinutes,
    additionalMinutes,
    progressPercent,
    averageMinutes,
    estimatedWorkdays,
    workedDays: workedEntries.length,
    absenceDays: entries.filter((entry) => entry.status === "absent").length,
    shortDays: classifiedEntries.filter(({ classification }) =>
      ["no-hours", "half-day", "early-out"].includes(classification),
    ).length,
    halfDays: classifiedEntries.filter(
      ({ classification }) => classification === "half-day",
    ).length,
    earlyOutDays: classifiedEntries.filter(
      ({ classification }) => classification === "early-out",
    ).length,
    shortfallMinutes: classifiedEntries.reduce(
      (total, entry) => total + entry.shortfallMinutes,
      0,
    ),
  };
}

export function estimateInternshipCompletion(
  profile: InternshipProfile | null,
  entries: InternshipEntry[],
  holidays: PhilippinesHoliday[],
  today: string,
) {
  if (!profile) return null;
  const summary = calculateInternshipSummary(profile, entries);
  const sortedWorkedEntries = entries
    .filter((entry) => entry.status === "worked")
    .sort((a, b) => a.date.localeCompare(b.date));

  if (summary.remainingMinutes === 0) {
    let runningTotal = 0;
    let completedOn: string | null = null;
    for (const entry of sortedWorkedEntries) {
      runningTotal +=
        calculateCreditedMinutes(entry, profile.maxDailyMinutes) ?? 0;
      if (runningTotal >= profile.requiredMinutes) {
        completedOn = entry.date;
        break;
      }
    }
    return {
      estimatedDate: completedOn,
      workdaysNeeded: 0,
      weekendsSkipped: 0,
      holidaysSkipped: 0,
      absencesSkipped: 0,
      completed: true,
    };
  }

  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const absenceDates = new Set(
    entries
      .filter((entry) => entry.status === "absent")
      .map((entry) => entry.date),
  );
  const loggedDates = new Set(entries.map((entry) => entry.date));
  let remaining = summary.remainingMinutes;
  let cursor = profile.startDate > today ? profile.startDate : today;
  let estimatedDate: string | null = null;
  let weekendsSkipped = 0;
  let holidaysSkipped = 0;
  let absencesSkipped = 0;
  let workdaysNeeded = 0;

  for (let checkedDays = 0; checkedDays < 3660 && remaining > 0; checkedDays += 1) {
    if (loggedDates.has(cursor)) {
      if (absenceDates.has(cursor)) absencesSkipped += 1;
    } else if (isWeekendDate(cursor)) {
      weekendsSkipped += 1;
    } else if (holidayDates.has(cursor)) {
      holidaysSkipped += 1;
    } else {
      remaining -= profile.maxDailyMinutes;
      workdaysNeeded += 1;
      estimatedDate = cursor;
    }
    cursor = addCalendarDays(cursor, 1);
  }

  return {
    estimatedDate,
    workdaysNeeded,
    weekendsSkipped,
    holidaysSkipped,
    absencesSkipped,
    completed: false,
  };
}

export function formatDuration(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  return `${sign}${hours}h ${remainder}m`;
}

export function useInternshipData(userId: string) {
  useEffect(() => {
    void syncInternshipData(userId);
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
