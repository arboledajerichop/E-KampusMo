"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icons";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { useConfirmation } from "@/components/dashboard/ConfirmationDialog";
import EditClassDialog from "@/components/dashboard/EditClassDialog";
import RegistrationFormImporter from "@/components/dashboard/RegistrationFormImporter";
import {
  dayOptions,
  getTotalScheduledUnits,
  getUniqueScheduledSubjects,
  removeSchedule,
  useAcademicData,
} from "@/lib/offline/academic-store";
import {
  downloadClassSchedulePdf,
  saveClassScheduleIdentity,
  useClassScheduleIdentity,
  type ClassScheduleIdentity,
} from "@/lib/schedule/class-schedule-template";
import { getSubjectPastel } from "@/lib/schedule/subject-colors";

function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hour, minute));
}

export default function CalendarClient({ userId }: { userId: string }) {
  const confirm = useConfirmation();
  const { subjects, schedules } = useAcademicData(userId);
  const identity = useClassScheduleIdentity(userId);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const uniqueSubjects = getUniqueScheduledSubjects(subjects, schedules);
  const totalUnits = getTotalScheduledUnits(subjects, schedules);
  const editingSchedule = editingScheduleId
    ? schedules.find((schedule) => schedule.id === editingScheduleId)
    : undefined;
  const editingSubject = editingSchedule
    ? subjectsById.get(editingSchedule.subjectId)
    : undefined;

  function updateIdentity(
    key: keyof ClassScheduleIdentity,
    value: string,
  ) {
    saveClassScheduleIdentity(userId, { ...identity, [key]: value });
  }

  async function handleDelete(scheduleId: string, subjectName: string) {
    const shouldProceed = await confirm({
      title: "Remove this class meeting?",
      message: `The ${subjectName} meeting will be permanently removed from your schedule after synchronization.`,
      confirmLabel: "Remove meeting",
      tone: "danger",
    });
    if (shouldProceed) {
      removeSchedule(userId, scheduleId);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setDownloadError("");
    try {
      await downloadClassSchedulePdf({
        identity,
        subjects,
        schedules,
      });
    } catch {
      setDownloadError(
        "The PDF could not be generated. Refresh the page and try again.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <DashboardPageHeader
        eyebrow="Monday–Sunday timetable"
        title="Class Schedule"
        description="Build your weekly class schedule manually or import a registration form, then download an organized PDF copy."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="secondary-button w-full px-5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <Icon name="folder" className="h-4 w-4" />
              {downloading ? "Creating PDF…" : "Download PDF"}
            </button>
            <Link
              href="/dashboard/calendar/new"
              className="primary-button w-full px-5 sm:w-auto"
            >
              <Icon name="plus" className="h-4 w-4" />
              Add class
            </Link>
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Subjects", uniqueSubjects.length],
          ["Weekly meetings", schedules.length],
          ["Total units", totalUnits],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 rounded-[11px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs"
          >
            <span className="text-[var(--muted)]">{label}</span>
            <strong className="text-[var(--ink)]">{value}</strong>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
              Download details
            </p>
            <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">
              Student information
            </h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-[var(--muted)]">
            These header details stay in this browser and appear in the
            downloaded schedule. They are not synchronized to Supabase.
          </p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["studentName", "Student name", "Juan Dela Cruz"],
              ["studentNumber", "Student number", "2026-00001"],
              ["program", "Program", "BS Information Technology"],
              ["term", "Term", "1st Semester 2026–2027"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <label
              key={key}
              className="text-sm font-bold text-[var(--ink-soft)]"
            >
              {label}
              <input
                value={identity[key]}
                onChange={(event) => updateIdentity(key, event.target.value)}
                placeholder={placeholder}
                className="form-input mt-2"
              />
            </label>
          ))}
        </div>
      </section>

      <RegistrationFormImporter userId={userId} />

      {downloadError && (
        <p
          role="alert"
          className="mt-4 rounded-[10px] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {downloadError}
        </p>
      )}

      {schedules.length === 0 && (
        <section className="mt-6 flex flex-col items-center justify-between gap-4 rounded-[16px] border border-dashed border-blue-300 bg-blue-50/60 p-6 text-center sm:flex-row sm:text-left dark:border-blue-800 dark:bg-blue-950/20">
          <div>
            <h2 className="font-bold text-[var(--ink)]">
              Your weekly schedule is empty
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Add classes manually or import a registration form above.
            </p>
          </div>
          <Link
            href="/dashboard/calendar/new"
            className="primary-button shrink-0 px-5"
          >
            <Icon name="plus" className="h-4 w-4" />
            Add first class
          </Link>
        </section>
      )}

      <section
        aria-label="Monday to Sunday class schedule"
        className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
      >
        {dayOptions.map((day) => {
          const daySchedules = schedules
            .filter((schedule) => schedule.dayOfWeek === day.value)
            .sort((left, right) =>
              left.startTime.localeCompare(right.startTime),
            );

          return (
            <article
              key={day.value}
              className="min-w-0 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            >
              <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-4">
                <h2 className="text-sm font-bold text-[var(--ink)]">
                  {day.label}
                </h2>
                <span className="text-[10px] font-semibold text-[var(--muted)]">
                  {daySchedules.length}
                </span>
              </header>

              {daySchedules.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-[var(--muted)]">
                  No classes
                </p>
              ) : (
                <div className="space-y-3 p-3">
                  {daySchedules.map((schedule) => {
                    const subject = subjectsById.get(schedule.subjectId);
                    const pastel = getSubjectPastel(subject, subjects);
                    const location =
                      [schedule.room, schedule.building]
                        .filter(Boolean)
                        .join(", ") ||
                      schedule.mode.replaceAll("-", " ");

                    return (
                      <div
                        key={schedule.id}
                        className="rounded-[10px] border p-3"
                        style={{
                          backgroundColor: pastel.surface,
                          borderColor: pastel.border,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="mt-1 h-10 w-1 shrink-0 rounded-full"
                            style={{
                              backgroundColor: pastel.accent,
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-xs font-bold uppercase tracking-[0.08em]"
                              style={{ color: pastel.text }}
                            >
                              {subject?.code || "No subject code"}
                            </p>
                            <p className="mt-1 text-sm font-bold text-[var(--ink)]">
                              {subject?.name ?? "Class meeting"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[var(--ink-soft)]">
                              {formatTime(schedule.startTime)}–
                              {formatTime(schedule.endTime)}
                            </p>
                            <dl className="mt-3 space-y-1 text-[11px] leading-4 text-[var(--muted)]">
                              <div className="flex gap-1">
                                <dt>Section:</dt>
                                <dd className="font-semibold text-[var(--ink-soft)]">
                                  {subject?.classCode || "—"}
                                </dd>
                              </div>
                              <div className="flex gap-1">
                                <dt>Units:</dt>
                                <dd className="font-semibold text-[var(--ink-soft)]">
                                  {subject?.units ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline">Professor: </dt>
                                <dd className="inline font-semibold text-[var(--ink-soft)]">
                                  {subject?.instructorName || "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline">Location: </dt>
                                <dd className="inline font-semibold capitalize text-[var(--ink-soft)]">
                                  {location}
                                </dd>
                              </div>
                            </dl>
                            {schedule.meetingLink && (
                              <a
                                href={schedule.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--blue)]"
                              >
                                Join class
                                <Icon name="arrow" className="h-3 w-3" />
                              </a>
                            )}
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingScheduleId(schedule.id)
                                }
                                disabled={!subject}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--blue)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Icon name="edit" className="h-3 w-3" />
                                Edit class
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDelete(
                                    schedule.id,
                                    subject?.name ?? "class",
                                  )
                                }
                                className="text-[11px] font-bold text-[var(--danger)] hover:underline"
                              >
                                Remove meeting
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {editingSchedule && editingSubject && (
        <EditClassDialog
          key={editingSchedule.id}
          userId={userId}
          subject={editingSubject}
          schedule={editingSchedule}
          schedules={schedules}
          onClose={() => setEditingScheduleId(null)}
        />
      )}
    </>
  );
}
