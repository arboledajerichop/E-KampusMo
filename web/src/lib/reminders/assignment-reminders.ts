"use client";

import { useEffect, useMemo, useState } from "react";
import type { Subject } from "@/lib/offline/academic-store";
import { useClassroomPreferences } from "@/lib/offline/classroom-preferences-store";
import type { Assignment } from "@/lib/offline/student-work-store";

type ClassroomWork = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  description: string;
  alternateLink: string;
  dueAt: string | null;
  creationTime: string | null;
  submissionState: string | null;
};

type ClassroomAnnouncement = {
  id: string;
  courseId: string;
  courseName: string;
  text: string;
  alternateLink: string;
  creationTime: string | null;
  updateTime: string | null;
};

type ClassroomResponse = {
  courseWork?: ClassroomWork[];
  announcements?: ClassroomAnnouncement[];
  error?: string;
};

export type AssignmentReminder = {
  id: string;
  source: "ekampusmo" | "classroom";
  kind: "assignment" | "announcement";
  title: string;
  courseName: string;
  description: string;
  deadline: string;
  href: string;
  missing: boolean;
};

const manilaDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function manilaDayNumber(value: string | number | Date) {
  const parts = manilaDayFormatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return (
    Date.UTC(part("year"), part("month") - 1, part("day")) /
    86_400_000
  );
}

function classroomItemKey(item: ClassroomWork) {
  return `${item.courseId}/${item.id}`;
}

export function reminderTiming(reminder: AssignmentReminder) {
  if (reminder.kind === "announcement") return "New announcement";
  if (reminder.missing) return "Missing";
  const difference =
    manilaDayNumber(reminder.deadline) - manilaDayNumber(Date.now());
  if (difference === 0) return "Due today";
  if (difference === 1) return "Due tomorrow";
  if (difference <= 7) return `Due in ${difference} days`;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(reminder.deadline));
}

export function reminderGroup(reminder: AssignmentReminder) {
  if (reminder.kind === "announcement") return "Announcements";
  if (reminder.missing) return "Missing";
  const difference =
    manilaDayNumber(reminder.deadline) - manilaDayNumber(Date.now());
  if (difference === 0) return "Due today";
  if (difference === 1) return "Due tomorrow";
  if (difference <= 7) return "Due this week";
  if (difference <= 14) return "Due next week";
  return "Later this semester";
}

export function useAssignmentReminders({
  userId,
  assignments,
  subjects,
}: {
  userId: string;
  assignments: Assignment[];
  subjects: Subject[];
}) {
  const preferences = useClassroomPreferences(userId);
  const [classroomWork, setClassroomWork] = useState<ClassroomWork[]>([]);
  const [classroomAnnouncements, setClassroomAnnouncements] = useState<
    ClassroomAnnouncement[]
  >([]);
  const [classroomConnected, setClassroomConnected] = useState(false);
  const [loadingClassroom, setLoadingClassroom] = useState(true);
  const [classroomError, setClassroomError] = useState("");
  const [currentTimestamp] = useState(Date.now);

  useEffect(() => {
    let active = true;

    async function loadClassroom() {
      try {
        const statusResponse = await fetch(
          "/api/google-classroom/status",
          { cache: "default" },
        );
        const status = (await statusResponse.json()) as {
          connected?: boolean;
        };
        if (!active) return;
        const connected = Boolean(status.connected);
        setClassroomConnected(connected);
        if (!connected) return;

        const courseworkResponse = await fetch(
          "/api/google-classroom/coursework",
          { cache: "default" },
        );
        const result =
          (await courseworkResponse.json()) as ClassroomResponse;
        if (!courseworkResponse.ok) {
          throw new Error(
            result.error || "Google Classroom reminders could not be loaded.",
          );
        }
        if (active) setClassroomWork(result.courseWork ?? []);
        if (active) setClassroomAnnouncements(result.announcements ?? []);
      } catch (reason) {
        if (active) {
          setClassroomError(
            reason instanceof Error
              ? reason.message
              : "Google Classroom reminders could not be loaded.",
          );
        }
      } finally {
        if (active) setLoadingClassroom(false);
      }
    }

    void loadClassroom();
    return () => {
      active = false;
    };
  }, []);

  const reminders = useMemo(() => {
    if (!preferences.semesterStart) return [];

    const semesterStart = new Date(
      `${preferences.semesterStart}T00:00:00+08:00`,
    ).getTime();
    const subjectsById = new Map(
      subjects.map((subject) => [subject.id, subject]),
    );
    const completedClassroomItems = new Set(
      preferences.completedItemKeys,
    );
    const readAnnouncementKeys = new Set(
      preferences.readAnnouncementKeys,
    );
    const classroomLinks = new Set(
      classroomWork
        .map((item) => item.alternateLink)
        .filter(Boolean),
    );

    const manualReminders: AssignmentReminder[] = assignments
      .filter(
        (assignment) =>
          assignment.status !== "completed" &&
          assignment.status !== "submitted" &&
          new Date(assignment.deadline).getTime() >= semesterStart &&
          !Array.from(classroomLinks).some((link) =>
            assignment.description.includes(link),
          ),
      )
      .map((assignment) => {
        const subject = subjectsById.get(assignment.subjectId);
        return {
          id: `manual:${assignment.id}`,
          source: "ekampusmo",
          kind: "assignment",
          title: assignment.title,
          courseName:
            subject?.code || subject?.name || "E-KampusMo assignment",
          description: assignment.description,
          deadline: assignment.deadline,
          href: "/dashboard/assignments",
          missing:
            new Date(assignment.deadline).getTime() < currentTimestamp,
        };
      });

    const classroomReminders: AssignmentReminder[] = classroomWork
      .filter((item) => {
        if (!item.dueAt) return false;
        if (new Date(item.dueAt).getTime() < semesterStart) return false;
        if (completedClassroomItems.has(classroomItemKey(item))) {
          return false;
        }
        return (
          item.submissionState !== "TURNED_IN" &&
          item.submissionState !== "RETURNED"
        );
      })
      .map((item) => {
        const deadline = item.dueAt as string;
        return {
          id: `classroom:${classroomItemKey(item)}`,
          source: "classroom" as const,
          kind: "assignment" as const,
          title: item.title,
          courseName: item.courseName,
          description: item.description,
          deadline,
          href: item.alternateLink || "/dashboard/assignments",
          missing: new Date(deadline).getTime() < currentTimestamp,
        };
      });

    const classroomAnnouncementReminders: AssignmentReminder[] =
      classroomAnnouncements
        .filter((item) => {
          const referenceDate = item.creationTime ?? item.updateTime;
          if (
            referenceDate &&
            new Date(referenceDate).getTime() < semesterStart
          ) {
            return false;
          }
          return !readAnnouncementKeys.has(
            item.courseId + "/" + item.id,
          );
        })
        .map((item) => ({
          id: "announcement:" + item.courseId + "/" + item.id,
          source: "classroom" as const,
          kind: "announcement" as const,
          title: "Announcement",
          courseName: item.courseName,
          description: item.text,
          deadline:
            item.updateTime ??
            item.creationTime ??
            new Date(currentTimestamp).toISOString(),
          href: item.alternateLink || "/dashboard/assignments",
          missing: false,
        }));

    return [
      ...classroomAnnouncementReminders,
      ...manualReminders,
      ...classroomReminders,
    ].sort(
      (left, right) =>
        new Date(left.deadline).getTime() -
        new Date(right.deadline).getTime(),
    );
  }, [
    assignments,
    classroomAnnouncements,
    classroomWork,
    currentTimestamp,
    preferences.completedItemKeys,
    preferences.readAnnouncementKeys,
    preferences.semesterStart,
    subjects,
  ]);

  return {
    reminders,
    semesterStart: preferences.semesterStart,
    classroomConnected,
    loadingClassroom,
    classroomError,
    currentTimestamp,
  };
}
