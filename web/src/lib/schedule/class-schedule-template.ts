"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getTotalScheduledUnits,
  type ClassSchedule,
  type Subject,
} from "@/lib/offline/academic-store";

export type ClassScheduleIdentity = {
  studentName: string;
  studentNumber: string;
  program: string;
  term: string;
};

export const EMPTY_CLASS_SCHEDULE_IDENTITY: ClassScheduleIdentity = {
  studentName: "",
  studentNumber: "",
  program: "",
  term: "",
};

const DAY_LABELS = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const IDENTITY_CHANGED_EVENT = "ekampusmo:class-schedule-identity-changed";

function identityStorageKey(userId: string) {
  return `ekampusmo:${userId}:class-schedule-identity-v1`;
}

function parseClassScheduleIdentity(value: string | null) {
  try {
    const parsed = JSON.parse(value ?? "{}") as Partial<ClassScheduleIdentity>;
    return {
      studentName: String(parsed.studentName ?? ""),
      studentNumber: String(parsed.studentNumber ?? ""),
      program: String(parsed.program ?? ""),
      term: String(parsed.term ?? ""),
    };
  } catch {
    return EMPTY_CLASS_SCHEDULE_IDENTITY;
  }
}

export function readClassScheduleIdentity(userId: string) {
  if (typeof window === "undefined") return EMPTY_CLASS_SCHEDULE_IDENTITY;
  return parseClassScheduleIdentity(
    window.localStorage.getItem(identityStorageKey(userId)),
  );
}

export function useClassScheduleIdentity(userId: string) {
  const snapshot = useSyncExternalStore(
    (onStoreChange) => {
      function handleStorage(event: StorageEvent) {
        if (event.key === identityStorageKey(userId)) onStoreChange();
      }
      function handleLocalChange() {
        onStoreChange();
      }
      window.addEventListener("storage", handleStorage);
      window.addEventListener(IDENTITY_CHANGED_EVENT, handleLocalChange);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(IDENTITY_CHANGED_EVENT, handleLocalChange);
      };
    },
    () => window.localStorage.getItem(identityStorageKey(userId)) ?? "",
    () => "",
  );
  return useMemo(() => parseClassScheduleIdentity(snapshot), [snapshot]);
}

export function saveClassScheduleIdentity(
  userId: string,
  identity: ClassScheduleIdentity,
) {
  window.localStorage.setItem(
    identityStorageKey(userId),
    JSON.stringify(identity),
  );
  window.dispatchEvent(new Event(IDENTITY_CHANGED_EVENT));
}

function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function scheduleLocation(schedule: ClassSchedule) {
  return (
    [schedule.room, schedule.building, schedule.campus]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function safeFilePart(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "student"
  );
}

export async function downloadClassSchedulePdf({
  identity,
  subjects,
  schedules,
}: {
  identity: ClassScheduleIdentity;
  subjects: Subject[];
  schedules: ClassSchedule[];
}) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const document = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });
  const subjectsById = new Map(
    subjects.map((subject) => [subject.id, subject]),
  );
  const totalUnits = getTotalScheduledUnits(subjects, schedules);
  const rows = DAY_LABELS.slice(1).flatMap((dayLabel, dayIndex) => {
    const daySchedules = schedules
      .filter((schedule) => schedule.dayOfWeek === dayIndex + 1)
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
    if (daySchedules.length === 0) {
      return [
        [
          dayLabel,
          "—",
          "—",
          "—",
          "No class scheduled",
          "—",
          "—",
          "—",
          "—",
        ],
      ];
    }
    return daySchedules.map((schedule) => {
      const subject = subjectsById.get(schedule.subjectId);
      return [
        dayLabel,
        `${formatTime(schedule.startTime)}–${formatTime(schedule.endTime)}`,
        subject?.code || "—",
        subject?.classCode || "—",
        subject?.name || "Class meeting",
        subject?.units === null || subject?.units === undefined
          ? "—"
          : String(subject.units),
        subject?.instructorName || "—",
        scheduleLocation(schedule),
        schedule.mode.replaceAll("-", " "),
      ];
    });
  });

  document.setProperties({
    title: `Class Schedule - ${identity.studentName || identity.studentNumber || "Student"}`,
    subject: "Monday to Sunday class schedule",
    creator: "E-KampusMo",
  });
  document.setTextColor(16, 36, 74);
  document.setFont("helvetica", "bold");
  document.setFontSize(20);
  document.text("E-KampusMo Class Schedule", 40, 42);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.setTextColor(71, 85, 105);
  document.text(
    [
      `Student: ${identity.studentName || "Not provided"}`,
      `Student number: ${identity.studentNumber || "Not provided"}`,
      `Program: ${identity.program || "Not provided"}`,
      `Term: ${identity.term || "Not provided"}    Total units: ${totalUnits}`,
    ],
    40,
    62,
  );

  autoTable(document, {
    startY: 112,
    head: [
      [
        "Day",
        "Time",
        "Class code",
        "Section code",
        "Subject description",
        "Units",
        "Professor",
        "Location",
        "Mode",
      ],
    ],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 5,
      lineColor: [226, 232, 240],
      textColor: [30, 41, 59],
      valign: "middle",
    },
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 57 },
      1: { cellWidth: 86 },
      2: { cellWidth: 65 },
      3: { cellWidth: 58 },
      4: { cellWidth: 98 },
      5: { cellWidth: 35 },
      6: { cellWidth: 88 },
      7: { cellWidth: 88 },
      8: { cellWidth: 56 },
    },
    margin: { left: 40, right: 40 },
  });

  document.setFontSize(7);
  document.setTextColor(100, 116, 139);
  document.text(
    `Generated by E-KampusMo on ${new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date())}`,
    40,
    document.internal.pageSize.getHeight() - 24,
  );
  document.save(
    `class-schedule-${safeFilePart(
      identity.studentNumber || identity.studentName,
    )}.pdf`,
  );
}
