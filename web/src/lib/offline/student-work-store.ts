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
import { readAcademicData } from "@/lib/offline/academic-store";

export type AssignmentStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "submitted";
export type AssignmentPriority = "low" | "medium" | "high";
export type AssignmentType =
  | "assignment"
  | "project"
  | "exam"
  | "quiz"
  | "other";

export type Assignment = {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  type: AssignmentType;
  deadline: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  estimatedMinutes: number | null;
  weightPercent: number | null;
  createdAt: string;
  updatedAt: string;
};

type StudentWorkData = {
  version: 1;
  assignments: Assignment[];
  [key: string]: unknown;
};

type AssignmentInput = Omit<Assignment, "id" | "createdAt" | "updatedAt">;

const EMPTY_DATA: StudentWorkData = {
  version: 1,
  assignments: [],
};
const EMPTY_SERIALIZED = JSON.stringify(EMPTY_DATA);
const CHANGE_EVENT = "ekampusmo-student-work-change";

function storageKey(userId: string) {
  return `ekampusmo:${userId}:offline-student-work-v1`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseData(serialized: string | null): StudentWorkData {
  if (!serialized) return EMPTY_DATA;
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return EMPTY_DATA;
    }
    const stored = parsed as Record<string, unknown>;
    return {
      ...stored,
      version: 1,
      assignments: Array.isArray(stored.assignments)
        ? (stored.assignments as Assignment[])
        : [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

function readSerialized(userId: string) {
  if (typeof window === "undefined") return EMPTY_SERIALIZED;
  return window.localStorage.getItem(storageKey(userId)) ?? EMPTY_SERIALIZED;
}

function writeData(userId: string, data: StudentWorkData) {
  const key = storageKey(userId);
  window.localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
}

function assignmentRow(userId: string, assignment: Assignment) {
  return {
    id: assignment.id,
    user_id: userId,
    subject_id: assignment.subjectId,
    title: assignment.title,
    description: assignment.description,
    type: assignment.type,
    deadline: assignment.deadline,
    priority: assignment.priority,
    status: assignment.status,
    estimated_minutes: assignment.estimatedMinutes,
    weight_percent: assignment.weightPercent,
    created_at: assignment.createdAt,
    updated_at: assignment.updatedAt,
  };
}

function assignmentFromRow(row: Record<string, unknown>): Assignment {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    type: row.type as AssignmentType,
    deadline: String(row.deadline),
    priority: row.priority as AssignmentPriority,
    status: row.status as AssignmentStatus,
    estimatedMinutes:
      row.estimated_minutes === null ? null : Number(row.estimated_minutes),
    weightPercent:
      row.weight_percent === null ? null : Number(row.weight_percent),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function ensureSubjectsInCloud(userId: string) {
  const subjects = readAcademicData(userId).subjects;
  if (subjects.length === 0) return;
  const { error } = await createClient()
    .from("subjects")
    .upsert(
      subjects.map((subject) => ({
        id: subject.id,
        user_id: userId,
        name: subject.name,
        code: subject.code,
        instructor_name: subject.instructorName,
        units: subject.units,
        color: subject.color,
        term: subject.term,
        created_at: subject.createdAt,
        updated_at: subject.updatedAt,
      })),
    );
  if (error) throw error;
}

function upsertAssignmentInCloud(userId: string, assignment: Assignment) {
  void runCloudTask(async () => {
    await ensureSubjectsInCloud(userId);
    const { error } = await createClient()
      .from("assignments")
      .upsert(assignmentRow(userId, assignment));
    if (error) throw error;
  });
}

async function syncStudentWorkData(userId: string) {
  await runCloudTask(async () => {
    const supabase = createClient();
    await flushCloudDeletes(supabase, userId, ["assignments"]);
    const local = parseData(readSerialized(userId));
    await ensureSubjectsInCloud(userId);
    const existingAssignments = await supabase
      .from("assignments")
      .select("*")
      .eq("user_id", userId);
    if (existingAssignments.error) throw existingAssignments.error;
    const cloudAssignmentTimes = new Map(
      (existingAssignments.data ?? []).map((row) => [
        String(row.id),
        String(row.updated_at),
      ]),
    );
    const assignmentsToUpload = local.assignments.filter((assignment) => {
      const cloudUpdatedAt = cloudAssignmentTimes.get(assignment.id);
      return !cloudUpdatedAt || assignment.updatedAt > cloudUpdatedAt;
    });

    if (assignmentsToUpload.length > 0) {
      const { error } = await supabase
        .from("assignments")
        .upsert(
          assignmentsToUpload.map((assignment) =>
            assignmentRow(userId, assignment),
          ),
        );
      if (error) throw error;
    }

    const assignmentsResult = await supabase
      .from("assignments")
      .select("*")
      .eq("user_id", userId)
      .order("deadline");
    if (assignmentsResult.error) throw assignmentsResult.error;

    writeData(userId, {
      ...local,
      assignments: (assignmentsResult.data ?? []).map(assignmentFromRow),
    });
  });
}

export function addAssignment(userId: string, input: AssignmentInput) {
  const data = parseData(readSerialized(userId));
  const timestamp = new Date().toISOString();
  const assignment: Assignment = {
    ...input,
    id: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  writeData(userId, {
    ...data,
    assignments: [...data.assignments, assignment],
  });
  upsertAssignmentInCloud(userId, assignment);
  return assignment;
}

export function updateAssignmentStatus(
  userId: string,
  assignmentId: string,
  status: AssignmentStatus,
) {
  const data = parseData(readSerialized(userId));
  let changedAssignment: Assignment | undefined;
  writeData(userId, {
    ...data,
    assignments: data.assignments.map((assignment) => {
      if (assignment.id !== assignmentId) return assignment;
      changedAssignment = {
        ...assignment,
        status,
        updatedAt: new Date().toISOString(),
      };
      return changedAssignment;
    }),
  });
  if (changedAssignment) {
    upsertAssignmentInCloud(userId, changedAssignment);
  }
}

export function removeAssignment(userId: string, assignmentId: string) {
  const data = parseData(readSerialized(userId));
  writeData(userId, {
    ...data,
    assignments: data.assignments.filter(
      (assignment) => assignment.id !== assignmentId,
    ),
  });
  queueCloudDelete(userId, "assignments", assignmentId);
  void runCloudTask(() =>
    flushCloudDeletes(createClient(), userId, ["assignments"]),
  );
}

export function useStudentWorkData(userId: string) {
  useEffect(() => {
    void syncStudentWorkData(userId);
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
  return useMemo(
    () => ({ assignments: parseData(serialized).assignments }),
    [serialized],
  );
}
