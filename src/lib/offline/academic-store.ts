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

export const dayOptions = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
] as const;

export type Subject = {
  id: string;
  name: string;
  code: string;
  classCode: string;
  instructorName: string;
  units: number | null;
  color: string;
  term: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassSchedule = {
  id: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  meetingType: "lecture" | "laboratory" | "other";
  room: string;
  building: string;
  campus: string;
  mode: "face-to-face" | "online" | "hybrid";
  meetingLink: string;
  reminderMinutes: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type AcademicData = {
  version: 1;
  subjects: Subject[];
  schedules: ClassSchedule[];
};

function normalizedCourseIdentifier(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isSameAcademicCourse(
  left: Pick<Subject, "code" | "name">,
  right: Pick<Subject, "code" | "name">,
) {
  const leftCode = normalizedCourseIdentifier(left.code);
  const rightCode = normalizedCourseIdentifier(right.code);
  const leftName = normalizedCourseIdentifier(left.name);
  const rightName = normalizedCourseIdentifier(right.name);
  return (
    Boolean(leftCode && rightCode && leftCode === rightCode) ||
    Boolean(leftName && rightName && leftName === rightName)
  );
}

export function getUniqueSubjectsByCourse(subjects: Subject[]) {
  const uniqueSubjects: Subject[] = [];
  for (const subject of subjects) {
    const existingIndex = uniqueSubjects.findIndex((existing) =>
      isSameAcademicCourse(existing, subject),
    );
    if (existingIndex < 0) {
      uniqueSubjects.push(subject);
    } else if (
      uniqueSubjects[existingIndex].units === null &&
      subject.units !== null
    ) {
      uniqueSubjects[existingIndex] = subject;
    }
  }
  return uniqueSubjects;
}

export function getUniqueScheduledSubjects(
  subjects: Subject[],
  schedules: ClassSchedule[],
) {
  const scheduledSubjectIds = new Set(
    schedules.map((schedule) => schedule.subjectId),
  );
  return getUniqueSubjectsByCourse(
    subjects.filter((subject) => scheduledSubjectIds.has(subject.id)),
  );
}

export function getTotalScheduledUnits(
  subjects: Subject[],
  schedules: ClassSchedule[],
) {
  return getUniqueScheduledSubjects(subjects, schedules).reduce(
    (total, subject) => total + (subject.units ?? 0),
    0,
  );
}

type SubjectInput = Omit<Subject, "id" | "createdAt" | "updatedAt">;
type ScheduleInput = Omit<ClassSchedule, "id" | "createdAt" | "updatedAt">;

const EMPTY_DATA: AcademicData = {
  version: 1,
  subjects: [],
  schedules: [],
};
const EMPTY_SERIALIZED = JSON.stringify(EMPTY_DATA);
const CHANGE_EVENT = "ekampusmo-academic-change";

function storageKey(userId: string) {
  return `ekampusmo:${userId}:offline-academic-v1`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseAcademicData(serialized: string | null): AcademicData {
  if (!serialized) {
    return EMPTY_DATA;
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<AcademicData>;

    return {
      version: 1,
      subjects: Array.isArray(parsed.subjects)
        ? parsed.subjects.map((subject) => ({
            ...subject,
            classCode: subject.classCode ?? "",
          }))
        : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

function readSerialized(userId: string) {
  if (typeof window === "undefined") {
    return EMPTY_SERIALIZED;
  }

  return window.localStorage.getItem(storageKey(userId)) ?? EMPTY_SERIALIZED;
}

function writeData(userId: string, data: AcademicData) {
  const key = storageKey(userId);
  window.localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, {
      detail: { key },
    }),
  );
}

function subjectRow(userId: string, subject: Subject) {
  return {
    id: subject.id,
    user_id: userId,
    name: subject.name,
    code: subject.code,
    class_code: subject.classCode,
    instructor_name: subject.instructorName,
    units: subject.units,
    color: subject.color,
    term: subject.term,
    created_at: subject.createdAt,
    updated_at: subject.updatedAt,
  };
}

function scheduleRow(userId: string, schedule: ClassSchedule) {
  return {
    id: schedule.id,
    user_id: userId,
    subject_id: schedule.subjectId,
    day_of_week: schedule.dayOfWeek,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    meeting_type: schedule.meetingType,
    room: schedule.room,
    building: schedule.building,
    campus: schedule.campus,
    mode: schedule.mode,
    meeting_link: schedule.meetingLink,
    reminder_minutes: schedule.reminderMinutes,
    notes: schedule.notes,
    created_at: schedule.createdAt,
    updated_at: schedule.updatedAt,
  };
}

function subjectFromRow(row: Record<string, unknown>): Subject {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code ?? ""),
    classCode: String(row.class_code ?? ""),
    instructorName: String(row.instructor_name ?? ""),
    units: row.units === null ? null : Number(row.units),
    color: String(row.color ?? "#1d4ed8"),
    term: String(row.term ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function scheduleFromRow(row: Record<string, unknown>): ClassSchedule {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    dayOfWeek: Number(row.day_of_week),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    meetingType: row.meeting_type as ClassSchedule["meetingType"],
    room: String(row.room ?? ""),
    building: String(row.building ?? ""),
    campus: String(row.campus ?? ""),
    mode: row.mode as ClassSchedule["mode"],
    meetingLink: String(row.meeting_link ?? ""),
    reminderMinutes: Number(row.reminder_minutes ?? 0),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function syncAcademicData(userId: string) {
  await runCloudTask(async () => {
    const supabase = createClient();
    await flushCloudDeletes(supabase, userId, [
      "class_schedules",
      "subjects",
    ]);
    const local = readAcademicData(userId);
    const [existingSubjects, existingSchedules] = await Promise.all([
      supabase.from("subjects").select("*").eq("user_id", userId),
      supabase.from("class_schedules").select("*").eq("user_id", userId),
    ]);
    if (existingSubjects.error) throw existingSubjects.error;
    if (existingSchedules.error) throw existingSchedules.error;
    const cloudSubjectTimes = new Map(
      (existingSubjects.data ?? []).map((row) => [
        String(row.id),
        String(row.updated_at),
      ]),
    );
    const cloudScheduleTimes = new Map(
      (existingSchedules.data ?? []).map((row) => [
        String(row.id),
        String(row.updated_at),
      ]),
    );
    const subjectsToUpload = local.subjects.filter((subject) => {
      const cloudUpdatedAt = cloudSubjectTimes.get(subject.id);
      return !cloudUpdatedAt || subject.updatedAt > cloudUpdatedAt;
    });
    const schedulesToUpload = local.schedules.filter((schedule) => {
      const cloudUpdatedAt = cloudScheduleTimes.get(schedule.id);
      return !cloudUpdatedAt || schedule.updatedAt > cloudUpdatedAt;
    });

    if (subjectsToUpload.length > 0) {
      const { error } = await supabase
        .from("subjects")
        .upsert(subjectsToUpload.map((subject) => subjectRow(userId, subject)));
      if (error) throw error;
    }
    if (schedulesToUpload.length > 0) {
      const { error } = await supabase
        .from("class_schedules")
        .upsert(
          schedulesToUpload.map((schedule) => scheduleRow(userId, schedule)),
        );
      if (error) throw error;
    }

    const [subjectsResult, schedulesResult] = await Promise.all([
      supabase
        .from("subjects")
        .select("*")
        .eq("user_id", userId)
        .order("created_at"),
      supabase
        .from("class_schedules")
        .select("*")
        .eq("user_id", userId)
        .order("day_of_week")
        .order("start_time"),
    ]);
    if (subjectsResult.error) throw subjectsResult.error;
    if (schedulesResult.error) throw schedulesResult.error;

    writeData(userId, {
      version: 1,
      subjects: (subjectsResult.data ?? []).map(subjectFromRow),
      schedules: (schedulesResult.data ?? []).map(scheduleFromRow),
    });
  });
}

function upsertSubjectInCloud(userId: string, subject: Subject) {
  void runCloudTask(async () => {
    const { error } = await createClient()
      .from("subjects")
      .upsert(subjectRow(userId, subject));
    if (error) throw error;
  });
}

function upsertScheduleInCloud(userId: string, schedule: ClassSchedule) {
  void runCloudTask(async () => {
    const supabase = createClient();
    const localSubject = readAcademicData(userId).subjects.find(
      (subject) => subject.id === schedule.subjectId,
    );
    if (localSubject) {
      const { error: subjectError } = await supabase
        .from("subjects")
        .upsert(subjectRow(userId, localSubject));
      if (subjectError) throw subjectError;
    }
    const { error } = await supabase
      .from("class_schedules")
      .upsert(scheduleRow(userId, schedule));
    if (error) throw error;
  });
}

function upsertSchedulesInCloud(
  userId: string,
  schedules: ClassSchedule[],
) {
  void runCloudTask(async () => {
    const supabase = createClient();
    const subjectIds = new Set(schedules.map((schedule) => schedule.subjectId));
    const localSubjects = readAcademicData(userId).subjects.filter((subject) =>
      subjectIds.has(subject.id),
    );
    if (localSubjects.length > 0) {
      const { error: subjectError } = await supabase
        .from("subjects")
        .upsert(localSubjects.map((subject) => subjectRow(userId, subject)));
      if (subjectError) throw subjectError;
    }
    const { error } = await supabase
      .from("class_schedules")
      .upsert(schedules.map((schedule) => scheduleRow(userId, schedule)));
    if (error) throw error;
  });
}

export function readAcademicData(userId: string) {
  return parseAcademicData(readSerialized(userId));
}

export function addSubject(userId: string, input: SubjectInput) {
  const data = readAcademicData(userId);
  const timestamp = new Date().toISOString();
  const subject: Subject = {
    ...input,
    id: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  writeData(userId, {
    ...data,
    subjects: [...data.subjects, subject],
  });
  upsertSubjectInCloud(userId, subject);

  return subject;
}

export function updateSubject(
  userId: string,
  subjectId: string,
  input: Partial<SubjectInput>,
) {
  const data = readAcademicData(userId);
  const existing = data.subjects.find((subject) => subject.id === subjectId);
  if (!existing) return null;

  const subject: Subject = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  writeData(userId, {
    ...data,
    subjects: data.subjects.map((item) =>
      item.id === subjectId ? subject : item,
    ),
  });
  upsertSubjectInCloud(userId, subject);
  return subject;
}

export function removeSubject(userId: string, subjectId: string) {
  const data = readAcademicData(userId);

  writeData(userId, {
    ...data,
    subjects: data.subjects.filter((subject) => subject.id !== subjectId),
    schedules: data.schedules.filter(
      (schedule) => schedule.subjectId !== subjectId,
    ),
  });
  queueCloudDelete(userId, "subjects", subjectId);
  void runCloudTask(() =>
    flushCloudDeletes(createClient(), userId, ["subjects"]),
  );
}

export function addSchedule(userId: string, input: ScheduleInput) {
  const data = readAcademicData(userId);
  const timestamp = new Date().toISOString();
  const schedule: ClassSchedule = {
    ...input,
    id: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  writeData(userId, {
    ...data,
    schedules: [...data.schedules, schedule],
  });
  upsertScheduleInCloud(userId, schedule);

  return schedule;
}

export function addSchedules(userId: string, inputs: ScheduleInput[]) {
  if (inputs.length === 0) return [];
  const data = readAcademicData(userId);
  const timestamp = new Date().toISOString();
  const schedules = inputs.map(
    (input): ClassSchedule => ({
      ...input,
      id: createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );

  writeData(userId, {
    ...data,
    schedules: [...data.schedules, ...schedules],
  });
  upsertSchedulesInCloud(userId, schedules);
  return schedules;
}

export function updateSchedule(
  userId: string,
  scheduleId: string,
  input: Partial<ScheduleInput>,
) {
  const data = readAcademicData(userId);
  const existing = data.schedules.find(
    (schedule) => schedule.id === scheduleId,
  );
  if (!existing) return null;

  const schedule: ClassSchedule = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  writeData(userId, {
    ...data,
    schedules: data.schedules.map((item) =>
      item.id === scheduleId ? schedule : item,
    ),
  });
  upsertScheduleInCloud(userId, schedule);
  return schedule;
}

export function removeSchedule(userId: string, scheduleId: string) {
  const data = readAcademicData(userId);

  writeData(userId, {
    ...data,
    schedules: data.schedules.filter(
      (schedule) => schedule.id !== scheduleId,
    ),
  });
  queueCloudDelete(userId, "class_schedules", scheduleId);
  void runCloudTask(() =>
    flushCloudDeletes(createClient(), userId, ["class_schedules"]),
  );
}

export function findScheduleConflict(
  schedules: ClassSchedule[],
  dayOfWeek: number,
  startTime: string,
  endTime: string,
) {
  return schedules.find(
    (schedule) =>
      schedule.dayOfWeek === dayOfWeek &&
      startTime < schedule.endTime &&
      endTime > schedule.startTime,
  );
}

export function useAcademicData(userId: string) {
  useEffect(() => {
    void syncAcademicData(userId);
  }, [userId]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const key = storageKey(userId);

      function handleStorage(event: StorageEvent) {
        if (event.key === key) {
          onStoreChange();
        }
      }

      function handleLocalChange(event: Event) {
        const detail = (event as CustomEvent<{ key?: string }>).detail;
        if (detail?.key === key) {
          onStoreChange();
        }
      }

      window.addEventListener("storage", handleStorage);
      window.addEventListener(CHANGE_EVENT, handleLocalChange);

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(CHANGE_EVENT, handleLocalChange);
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

  return useMemo(() => parseAcademicData(serialized), [serialized]);
}
