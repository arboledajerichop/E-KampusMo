"use client";

import Link from "next/link";
import Icon from "@/components/Icons";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { useAcademicData } from "@/lib/offline/academic-store";
import { useStudentWorkData } from "@/lib/offline/student-work-store";
import {
  manilaDayNumber,
  reminderGroup,
  reminderTiming,
  useAssignmentReminders,
  type AssignmentReminder,
} from "@/lib/reminders/assignment-reminders";

const groupOrder = [
  "Missing",
  "Due today",
  "Due tomorrow",
  "Due this week",
  "Due next week",
  "Later this semester",
] as const;

function ReminderRow({ reminder }: { reminder: AssignmentReminder }) {
  const isExternal = reminder.href.startsWith("http");

  return (
    <a
      href={reminder.href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer" : undefined}
      className="group flex items-start gap-4 px-5 py-4 hover:bg-[var(--surface-soft)] sm:px-6"
    >
      <span
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${
          reminder.missing
            ? "bg-[var(--danger-soft)] text-[var(--danger)]"
            : "bg-[var(--surface-blue)] text-[var(--blue)]"
        }`}
      >
        <Icon
          name={reminder.missing ? "clock" : "tasks"}
          className="h-[17px] w-[17px]"
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start sm:gap-4">
          <h3 className="text-sm font-bold leading-5 text-[var(--ink)]">
            {reminder.title}
          </h3>
          <p
            className={`shrink-0 text-xs font-bold ${
              reminder.missing
                ? "text-[var(--danger)]"
                : "text-[var(--blue)]"
            }`}
          >
            {reminderTiming(reminder)}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
          <span>{reminder.courseName}</span>
          <span aria-hidden="true">·</span>
          <span>
            {reminder.source === "classroom"
              ? "Google Classroom"
              : "E-KampusMo"}
          </span>
        </div>
      </div>
      <Icon
        name="arrow"
        className="mt-2 h-4 w-4 shrink-0 text-[var(--muted)] group-hover:text-[var(--blue)]"
      />
    </a>
  );
}

export default function RemindersClient({ userId }: { userId: string }) {
  const { subjects } = useAcademicData(userId);
  const { assignments } = useStudentWorkData(userId);
  const {
    reminders,
    semesterStart,
    classroomConnected,
    loadingClassroom,
    classroomError,
    currentTimestamp,
  } = useAssignmentReminders({ userId, assignments, subjects });
  const today = manilaDayNumber(currentTimestamp);
  const missingCount = reminders.filter((reminder) => reminder.missing).length;
  const dueTodayCount = reminders.filter(
    (reminder) =>
      !reminder.missing && manilaDayNumber(reminder.deadline) === today,
  ).length;
  const nextSevenDaysCount = reminders.filter((reminder) => {
    const difference = manilaDayNumber(reminder.deadline) - today;
    return !reminder.missing && difference >= 1 && difference <= 7;
  }).length;
  const groups = groupOrder
    .map((label) => ({
      label,
      reminders: reminders.filter(
        (reminder) => reminderGroup(reminder) === label,
      ),
    }))
    .filter((group) => group.reminders.length > 0);

  return (
    <>
      <DashboardPageHeader
        eyebrow="Stay on time"
        title="Reminders"
        description="See current-semester assignment deadlines from E-KampusMo and Google Classroom in one place."
        action={
          <Link
            href="/dashboard/assignments"
            className="secondary-button w-full px-5 sm:w-auto"
          >
            <Icon name="tasks" className="h-4 w-4" />
            Open Assignments
          </Link>
        }
      />

      <section
        aria-label="Reminder summary"
        className="mt-7 grid gap-4 sm:grid-cols-3"
      >
        {[
          {
            label: "Due today",
            value: dueTodayCount,
            detail: "Needs attention before today ends",
            tone: "bg-[var(--surface-blue)] text-[var(--blue)]",
          },
          {
            label: "Missing",
            value: missingCount,
            detail: "Past the deadline and not marked done",
            tone: "bg-[var(--danger-soft)] text-[var(--danger)]",
          },
          {
            label: "Next 7 days",
            value: nextSevenDaysCount,
            detail: "Upcoming after today",
            tone: "bg-[var(--teal-soft)] text-[var(--teal)]",
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-[15px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[var(--ink)]">
                  {item.value}
                </p>
              </div>
              <span
                className={`grid h-9 w-9 place-items-center rounded-[10px] ${item.tone}`}
              >
                <Icon name="bell" className="h-[17px] w-[17px]" />
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {item.detail}
            </p>
          </article>
        ))}
      </section>

      {!semesterStart ? (
        <section className="mt-5 grid min-h-[330px] place-items-center rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="max-w-[430px]">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-[13px] bg-[var(--surface-blue)] text-[var(--blue)]">
              <Icon name="calendar" className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[var(--ink)]">
              Set your semester start first
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Reminders use this date to show only the assignments that belong
              to your current semester.
            </p>
            <Link
              href="/dashboard/assignments"
              className="primary-button mt-5 px-5"
            >
              Set semester start
            </Link>
          </div>
        </section>
      ) : loadingClassroom && reminders.length === 0 ? (
        <section
          aria-live="polite"
          className="mt-5 min-h-[280px] animate-pulse rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <div className="h-5 w-44 rounded bg-[var(--surface-soft)]" />
          <div className="mt-5 h-16 rounded-[12px] bg-[var(--surface-soft)]" />
          <div className="mt-3 h-16 rounded-[12px] bg-[var(--surface-soft)]" />
          <span className="sr-only">Loading reminders</span>
        </section>
      ) : groups.length === 0 ? (
        <section className="mt-5 grid min-h-[330px] place-items-center rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="max-w-[420px]">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-[13px] bg-[var(--teal-soft)] text-[var(--teal)]">
              <Icon name="check" className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[var(--ink)]">
              You are caught up
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              There are no unfinished assignments with deadlines in your
              current semester.
            </p>
          </div>
        </section>
      ) : (
        <div className="mt-5 space-y-4">
          {groups.map((group) => (
            <section
              key={group.label}
              className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            >
              <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-6">
                <h2 className="text-sm font-bold text-[var(--ink)]">
                  {group.label}
                </h2>
                <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--muted-strong)]">
                  {group.reminders.length}
                </span>
              </header>
              <div className="divide-y divide-[var(--line)]">
                {group.reminders.map((reminder) => (
                  <ReminderRow key={reminder.id} reminder={reminder} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {classroomError && (
        <p
          role="status"
          className="mt-5 rounded-[11px] border border-amber-200 bg-[var(--warning-soft)] px-4 py-3 text-xs leading-5 text-[var(--warning)] dark:border-amber-900"
        >
          E-KampusMo assignments are shown, but Google Classroom could not be
          refreshed: {classroomError}
        </p>
      )}

      {!classroomConnected && !loadingClassroom && (
        <p className="mt-5 text-center text-xs leading-5 text-[var(--muted)]">
          Connect Google Classroom from Assignments to include its deadlines
          here.
        </p>
      )}
    </>
  );
}
