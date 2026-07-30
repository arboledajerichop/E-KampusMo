"use client";

import Link from "next/link";
import Icon from "@/components/Icons";
import { useAcademicData } from "@/lib/offline/academic-store";
import {
  calculateFinanceSummary,
  formatPeso,
  getCurrentAllowance,
  useFinanceData,
} from "@/lib/offline/finance-store";
import {
  calculateInternshipSummary,
  formatDuration,
  useInternshipData,
} from "@/lib/offline/internship-store";
import { useStudentWorkData } from "@/lib/offline/student-work-store";
import {
  manilaDayNumber,
  reminderTiming,
  useAssignmentReminders,
} from "@/lib/reminders/assignment-reminders";

function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hour, minute));
}

function getManilaDayNumber() {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
  }).format(new Date());
  const dayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return dayMap[day] ?? 1;
}

function getManilaTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  icon: Parameters<typeof Icon>[0]["name"];
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group today-enter rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-5 hover:-translate-y-0.5 hover:border-[var(--ink)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-4 truncate text-xl font-bold tracking-[-0.035em] text-[var(--ink)]">
            {value}
          </p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[7px] border border-[var(--line-strong)] text-[var(--ink)]">
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{detail}</p>
    </Link>
  );
}

export default function TodayDashboard({
  userId,
  firstName,
  dateLabel,
}: {
  userId: string;
  firstName: string;
  dateLabel: string;
}) {
  const { subjects, schedules } = useAcademicData(userId);
  const { allowancePeriods, expenses } = useFinanceData(userId);
  const { assignments } = useStudentWorkData(userId);
  const { profile: internshipProfile, entries: internshipEntries } =
    useInternshipData(userId);
  const {
    reminders,
    semesterStart,
    loadingClassroom,
    currentTimestamp,
  } = useAssignmentReminders({ userId, assignments, subjects });
  const currentAllowance = getCurrentAllowance(allowancePeriods);
  const financeSummary = calculateFinanceSummary(currentAllowance, expenses);
  const internshipSummary = calculateInternshipSummary(
    internshipProfile,
    internshipEntries,
  );
  const todayNumber = manilaDayNumber(currentTimestamp);
  const missingReminders = reminders.filter((reminder) => reminder.missing);
  const dueTodayReminders = reminders.filter(
    (reminder) =>
      !reminder.missing &&
      manilaDayNumber(reminder.deadline) === todayNumber,
  );
  const needsAttentionToday = [
    ...missingReminders,
    ...dueTodayReminders,
  ];
  const upcomingReminders = reminders.filter(
    (reminder) =>
      !reminder.missing &&
      manilaDayNumber(reminder.deadline) > todayNumber,
  );
  const reminderPreview =
    needsAttentionToday.length > 0
      ? [
          ...needsAttentionToday.slice(0, 3),
          ...upcomingReminders.slice(
            0,
            Math.max(0, 3 - needsAttentionToday.length),
          ),
        ]
      : upcomingReminders.slice(0, 3);
  const nextReminder = upcomingReminders[0] ?? missingReminders[0];
  const todayDay = getManilaDayNumber();
  const currentTime = getManilaTime();
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const todaySchedules = schedules
    .filter((schedule) => schedule.dayOfWeek === todayDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nextSchedule =
    todaySchedules.find((schedule) => schedule.endTime > currentTime) ??
    todaySchedules[0];
  const nextSubject = nextSchedule
    ? subjectsById.get(nextSchedule.subjectId)
    : undefined;
  const focus =
    schedules.length === 0
      ? {
          eyebrow: "Your first focus",
          title: "Build your weekly class schedule.",
          copy:
            "Add subject details and meeting times in one place, or import your registration form.",
          href: "/dashboard/calendar/new",
          action: "Add class schedule",
        }
      : {
          eyebrow: "Schedule ready",
          title: nextSubject
            ? `${nextSubject.code || nextSubject.name} is next on your list.`
            : "Your weekly schedule is ready.",
          copy: nextSchedule
            ? `${formatTime(nextSchedule.startTime)}–${formatTime(nextSchedule.endTime)} · ${
                nextSchedule.room || nextSchedule.mode.replaceAll("-", " ")
              }`
            : "Review the full week or add another class meeting.",
          href: "/dashboard/calendar",
          action: "View class schedule",
        };

  return (
    <>
      <header className="today-enter flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mono-label flex items-center gap-3 text-[var(--muted)]">
            <span className="today-live-dot h-1.5 w-1.5 rounded-full bg-[var(--ink)]" />
            Today / {dateLabel}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.055em] text-[var(--ink)] sm:text-[2.65rem]">
            Good day, {firstName}.
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Here’s what needs your attention today.
          </p>
        </div>

        <Link
          href="/dashboard/calendar/new"
          className="primary-button w-full px-5 sm:w-auto"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add class schedule
        </Link>
      </header>

      <section
        aria-labelledby="focus-heading"
        className="today-scan today-enter mt-8 overflow-hidden rounded-[10px] border border-[#363832] bg-[#2b2d2a] text-white"
      >
        <div className="grid lg:grid-cols-[1fr_320px]">
          <div className="p-6 sm:p-8">
            <p className="font-mono text-[9px] font-medium uppercase tracking-[0.13em] text-white/48">
              {focus.eyebrow}
            </p>
            <h2
              id="focus-heading"
              className="mt-3 text-2xl font-bold tracking-[-0.035em] sm:text-3xl"
            >
              {focus.title}
            </h2>
            <p className="mt-3 max-w-[680px] text-sm leading-6 text-white/62">
              {focus.copy}
            </p>
            <Link
              href={focus.href}
              className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-[7px] bg-white px-4 text-sm font-bold text-black hover:-translate-y-px hover:bg-white/88"
            >
              {focus.action}
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>

          <div className="border-t border-white/10 bg-white/[0.045] p-6 lg:border-l lg:border-t-0 lg:p-8">
            <p className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-white/48">
              Reminders for the day
            </p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <p className="text-3xl font-bold tracking-[-0.04em]">
                {needsAttentionToday.length}
              </p>
              <Icon name="bell" className="mb-1 h-5 w-5 text-white/72" />
            </div>
            <p className="mt-3 text-xs leading-5 text-white/52">
              {dueTodayReminders.length} due today · {missingReminders.length}{" "}
              missing
            </p>
            <Link
              href="/dashboard/reminders"
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-white hover:text-white/70"
            >
              View all reminders
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-label="Student overview"
        className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Next class"
          value={
            nextSubject
              ? nextSubject.code || nextSubject.name
              : todaySchedules.length > 0
                ? "Scheduled"
                : "No class today"
          }
          detail={
            nextSchedule
              ? `${formatTime(nextSchedule.startTime)} · ${
                  nextSchedule.room || "Location not set"
                }`
              : "Open Class Schedule to plan your week."
          }
          icon="calendar"
          href="/dashboard/calendar"
        />
        <MetricCard
          label="Deadlines"
          value={
            reminders.length > 0
              ? `${reminders.length} active`
              : "Nothing due"
          }
          detail={
            missingReminders.length > 0
              ? `${missingReminders.length} missing — review now.`
              : nextReminder
                ? `${nextReminder.title} · ${reminderTiming(nextReminder)}`
                : semesterStart
                  ? "No unfinished deadlines this semester."
                  : "Set your semester start in Assignments."
          }
          icon="tasks"
          href="/dashboard/reminders"
        />
        <MetricCard
          label="Internship"
          value={
            internshipProfile
              ? `${internshipSummary.progressPercent}% complete`
              : "Not started"
          }
          detail={
            internshipProfile
              ? internshipSummary.remainingMinutes > 0
                ? `${formatDuration(internshipSummary.remainingMinutes)} remaining.`
                : `${formatDuration(internshipSummary.additionalMinutes)} additional time.`
              : "Set your required OJT hours."
          }
          icon="briefcase"
          href="/dashboard/internship"
        />
        <MetricCard
          label="Allowance"
          value={
            currentAllowance
              ? formatPeso(financeSummary.remainingCentavos)
              : "Not tracking"
          }
          detail={
            currentAllowance
              ? `${formatPeso(
                  financeSummary.suggestedDailyCentavos,
                )} suggested per day.`
              : "Add an allowance period and expenses."
          }
          icon="wallet"
          href="/dashboard/expenses"
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.14fr_0.86fr]">
        <section className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
          <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold tracking-[-0.02em] text-[var(--ink)]">
                Today’s schedule
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Classes and personal study blocks
              </p>
            </div>
            <Link
              href="/dashboard/calendar"
              className="text-xs font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
            >
              {todaySchedules.length}{" "}
              {todaySchedules.length === 1 ? "item" : "items"}
            </Link>
          </header>

          {todaySchedules.length === 0 ? (
            <div className="grid min-h-[280px] place-items-center p-8 text-center">
              <div className="max-w-[340px]">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--surface-blue)] text-[var(--blue)]">
                  <Icon name="calendar" className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">
                  Your day is clear—for now
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Add your class schedule so you can see where you need to be
                  and what comes next.
                </p>
                <Link
                  href="/dashboard/calendar/new"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
                >
                  Add class schedule
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)] px-5 sm:px-6">
              {todaySchedules.map((schedule) => {
                const subject = subjectsById.get(schedule.subjectId);
                return (
                  <article
                    key={schedule.id}
                    className="grid gap-3 py-5 sm:grid-cols-[110px_5px_1fr_auto] sm:items-center sm:gap-4"
                  >
                    <p className="text-sm font-bold text-[var(--ink)]">
                      {formatTime(schedule.startTime)}
                    </p>
                    <span
                      className="hidden h-10 rounded-full grayscale sm:block"
                      style={{ backgroundColor: subject?.color ?? "#171716" }}
                    />
                    <div>
                      <h3 className="text-sm font-bold text-[var(--ink)]">
                        {subject?.name ?? "Class meeting"}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatTime(schedule.startTime)}–
                        {formatTime(schedule.endTime)} ·{" "}
                        {schedule.room ||
                          schedule.mode.replaceAll("-", " ")}
                      </p>
                    </div>
                    {schedule.meetingLink && (
                      <a
                        href={schedule.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-button min-h-9 px-3 text-xs"
                      >
                        Join class
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
          <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold tracking-[-0.02em] text-[var(--ink)]">
                Reminders for the day
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Assignment deadlines that need your attention
              </p>
            </div>
            <Link
              href="/dashboard/reminders"
              className="text-xs font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
            >
              View all
            </Link>
          </header>

          {!semesterStart ? (
            <div className="grid min-h-[280px] place-items-center p-8 text-center">
              <div className="max-w-[330px]">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--surface-blue)] text-[var(--blue)]">
                  <Icon name="calendar" className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">
                  Set your semester start
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  This keeps your reminder list focused on the current
                  semester.
                </p>
                <Link
                  href="/dashboard/assignments"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
                >
                  Open Assignments
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : loadingClassroom && reminders.length === 0 ? (
            <div
              aria-live="polite"
              className="min-h-[280px] animate-pulse p-6"
            >
              <div className="h-16 rounded-[12px] bg-[var(--surface-soft)]" />
              <div className="mt-3 h-16 rounded-[12px] bg-[var(--surface-soft)]" />
              <div className="mt-3 h-16 rounded-[12px] bg-[var(--surface-soft)]" />
              <span className="sr-only">Loading reminders</span>
            </div>
          ) : reminderPreview.length === 0 ? (
            <div className="grid min-h-[280px] place-items-center p-8 text-center">
              <div className="max-w-[330px]">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--teal-soft)] text-[var(--teal)]">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">
                  You are caught up
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  No unfinished assignment deadlines need your attention.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {reminderPreview.map((reminder) => (
                <Link
                  key={reminder.id}
                  href="/dashboard/reminders"
                  className="group flex items-start gap-3 px-5 py-4 hover:bg-[var(--surface-soft)] sm:px-6"
                >
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] ${
                      reminder.missing
                        ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                        : "bg-[var(--surface-blue)] text-[var(--blue)]"
                    }`}
                  >
                    <Icon name="bell" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--ink)]">
                      {reminder.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {reminder.courseName}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 pt-1 text-xs font-bold ${
                      reminder.missing
                        ? "text-[var(--danger)]"
                        : "text-[var(--blue)]"
                    }`}
                  >
                    {reminderTiming(reminder)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

    </>
  );
}
