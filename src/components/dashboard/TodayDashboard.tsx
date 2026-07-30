"use client";

import { useEffect, useState } from "react";
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
import { getSubjectPastel } from "@/lib/schedule/subject-colors";

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

type MetricTone = "yellow" | "pink" | "mint" | "lavender";

const stickyTones: Record<
  MetricTone,
  {
    background: string;
    border: string;
    accent: string;
    iconBackground: string;
    iconColor: string;
    tape: string;
  }
> = {
  yellow: {
    background: "#FFF6CC",
    border: "#E8D89A",
    accent: "#C8921F",
    iconBackground: "#FFFBEA",
    iconColor: "#9A6A11",
    tape: "rgba(255, 236, 166, 0.95)",
  },
  pink: {
    background: "#FBE4E8",
    border: "#E9C3CB",
    accent: "#C55C7A",
    iconBackground: "#FFF0F3",
    iconColor: "#A03D61",
    tape: "rgba(248, 211, 220, 0.95)",
  },
  mint: {
    background: "#DFF5E8",
    border: "#B9DEC8",
    accent: "#4C9B78",
    iconBackground: "#EFFBF4",
    iconColor: "#33745A",
    tape: "rgba(202, 239, 219, 0.95)",
  },
  lavender: {
    background: "#EAE5FB",
    border: "#CEC5F0",
    accent: "#7662C4",
    iconBackground: "#F5F1FF",
    iconColor: "#5F4AAD",
    tape: "rgba(220, 212, 248, 0.95)",
  },
};

function stickyNoteLines(color = "rgba(17, 24, 39, 0.055)") {
  return `repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 27px,
    ${color} 28px,
    transparent 29px
  )`;
}

function ChalkWritingText({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      setVisibleText(text);
      setFinished(true);
      return;
    }

    setVisibleText("");
    setFinished(false);

    let characterIndex = 0;
    const writingSpeed = text.length > 24 ? 55 : 82;

    const timer = window.setInterval(() => {
      characterIndex += 1;
      setVisibleText(text.slice(0, characterIndex));

      if (characterIndex >= text.length) {
        window.clearInterval(timer);
        setFinished(true);
      }
    }, writingSpeed);

    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <span
      aria-label={text}
      className="inline-flex min-h-[1.15em] items-baseline"
      style={{
        fontFamily:
          '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
        textShadow: `
          0 0 1px rgba(255,255,255,0.75),
          0 1px 0 rgba(255,255,255,0.16),
          1px 0 1px rgba(238,236,216,0.22)
        `,
      }}
    >
      <span aria-hidden="true">{visibleText}</span>

      {!finished && (
        <span
          aria-hidden="true"
          className="ml-1 inline-block h-[0.9em] w-[3px] animate-pulse rounded-full bg-[#f8f2de]/80"
        />
      )}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  href,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: Parameters<typeof Icon>[0]["name"];
  href: string;
  tone: MetricTone;
}) {
  const palette = stickyTones[tone];

  return (
    <Link
      href={href}
      className="group today-enter relative overflow-hidden rounded-[14px] border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5"
      style={{
        backgroundColor: palette.background,
        borderColor: palette.border,
        backgroundImage: stickyNoteLines(),
      }}
    >
      <span
        className="pointer-events-none absolute left-5 top-0 h-3 w-16 -translate-y-1/2 rounded-full opacity-90"
        style={{ backgroundColor: palette.tape }}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
            {label}
          </p>

          <p className="mt-4 truncate text-xl font-bold tracking-[-0.035em] text-[var(--ink)]">
            {value}
          </p>
        </div>

        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border"
          style={{
            backgroundColor: palette.iconBackground,
            borderColor: palette.border,
            color: palette.iconColor,
          }}
        >
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        {detail}
      </p>

      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1 opacity-80"
        style={{ backgroundColor: palette.accent }}
      />
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

  const {
    profile: internshipProfile,
    entries: internshipEntries,
  } = useInternshipData(userId);

  const {
    reminders,
    semesterStart,
    loadingClassroom,
    currentTimestamp,
  } = useAssignmentReminders({
    userId,
    assignments,
    subjects,
  });

  const currentAllowance = getCurrentAllowance(allowancePeriods);

  const financeSummary = calculateFinanceSummary(
    currentAllowance,
    expenses,
  );

  const internshipSummary = calculateInternshipSummary(
    internshipProfile,
    internshipEntries,
  );

  const todayNumber = manilaDayNumber(currentTimestamp);

  const missingReminders = reminders.filter(
    (reminder) => reminder.missing,
  );

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

  const nextReminder =
    upcomingReminders[0] ?? missingReminders[0];

  const todayDay = getManilaDayNumber();
  const currentTime = getManilaTime();

  const subjectsById = new Map(
    subjects.map((subject) => [subject.id, subject]),
  );

  const todaySchedules = schedules
    .filter((schedule) => schedule.dayOfWeek === todayDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const nextSchedule =
    todaySchedules.find(
      (schedule) => schedule.endTime > currentTime,
    ) ?? todaySchedules[0];

  const nextSubject = nextSchedule
    ? subjectsById.get(nextSchedule.subjectId)
    : undefined;

  const focus = nextSubject
    ? {
        eyebrow: "Today’s lesson",
        boardText:
          nextSubject.name ||
          nextSubject.code ||
          "Next class",
        subtitle:
          nextSubject.code ||
          "Your next class",
        copy: nextSchedule
          ? `${formatTime(
              nextSchedule.startTime,
            )}–${formatTime(
              nextSchedule.endTime,
            )} · ${
              nextSchedule.room ||
              nextSchedule.mode.replaceAll("-", " ")
            }`
          : "Review your timetable or add another class meeting.",
        href: "/dashboard/calendar",
        action: "Open class schedule",
      }
    : {
        eyebrow:
          schedules.length === 0
            ? "Your first focus"
            : "Today’s lesson",
        boardText: "Class Schedule",
        subtitle:
          schedules.length === 0
            ? "Build your weekly class schedule."
            : "No class is scheduled for today.",
        copy:
          schedules.length === 0
            ? "Add subject details and meeting times in one place, or import your registration form."
            : "Review the full week or add another class meeting.",
        href: "/dashboard/calendar",
        action:
          schedules.length === 0
            ? "Create Class Schedule"
            : "Open class schedule",
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
          href="/dashboard/calendar"
          className="primary-button w-full px-5 sm:w-auto"
        >
          <Icon name="plus" className="h-4 w-4" />
          Create Class Schedule
        </Link>
      </header>

      <section
        aria-labelledby="focus-heading"
        className="today-enter mt-8 rounded-[20px] p-[8px] shadow-[0_20px_50px_rgba(48,34,21,0.2)]"
        style={{
          backgroundColor: "#7A5438",
          backgroundImage: `
            linear-gradient(
              90deg,
              rgba(255,255,255,0.08),
              transparent 18%,
              rgba(0,0,0,0.06) 48%,
              transparent 75%,
              rgba(255,255,255,0.04)
            ),
            repeating-linear-gradient(
              0deg,
              rgba(255,255,255,0.018) 0px,
              rgba(255,255,255,0.018) 1px,
              transparent 1px,
              transparent 5px
            ),
            linear-gradient(
              180deg,
              #8B6243,
              #6D4931
            )
          `,
        }}
      >
        <div
          className="relative overflow-hidden rounded-[13px] border border-[#e2d7ba]/25 text-[#f8f3e4]"
          style={{
            backgroundColor: "#42675A",
            backgroundImage: `
              radial-gradient(
                ellipse at 17% 22%,
                rgba(245,243,224,0.12) 0%,
                rgba(245,243,224,0.045) 20%,
                transparent 45%
              ),
              radial-gradient(
                ellipse at 73% 67%,
                rgba(245,243,224,0.075) 0%,
                transparent 44%
              ),
              radial-gradient(
                ellipse at 47% 43%,
                rgba(18,43,34,0.12) 0%,
                transparent 52%
              ),
              radial-gradient(
                ellipse at 91% 14%,
                rgba(245,243,224,0.055) 0%,
                transparent 35%
              ),
              repeating-linear-gradient(
                0deg,
                rgba(255,255,255,0.015) 0px,
                rgba(255,255,255,0.015) 1px,
                transparent 1px,
                transparent 4px
              ),
              repeating-linear-gradient(
                90deg,
                rgba(255,255,255,0.009) 0px,
                rgba(255,255,255,0.009) 1px,
                transparent 1px,
                transparent 7px
              ),
              linear-gradient(
                115deg,
                rgba(255,255,255,0.045),
                transparent 32%,
                rgba(17,43,34,0.09) 73%,
                rgba(255,255,255,0.022)
              )
            `,
            boxShadow: `
              inset 0 0 42px rgba(12,34,27,0.2),
              inset 0 0 3px rgba(255,255,255,0.18)
            `,
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-45">
            <span className="absolute left-[9%] top-[24%] h-[2px] w-28 rotate-[-2deg] rounded-full bg-[#f3edda]/20" />

            <span className="absolute left-[34%] top-[73%] h-[2px] w-40 rotate-[1deg] rounded-full bg-[#f3edda]/12" />

            <span className="absolute right-[28%] top-[15%] h-20 w-36 rounded-full bg-white/[0.02] blur-xl" />
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_350px]">
            <div className="relative min-h-[330px] p-7 sm:p-10">
              <div className="pointer-events-none absolute left-8 top-7 h-[2px] w-24 rounded-full bg-[#f4efd9]/32 sm:left-10" />

              <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#eee8d5]/75">
                {focus.eyebrow}
              </p>

              <div className="mt-7">
                <p className="inline-flex rounded-[5px] border border-[#eee7d1]/25 bg-white/[0.045] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f2ecd9]/85">
                  Up next
                </p>

                <h2
                  id="focus-heading"
                  className="mt-4 max-w-[760px] text-4xl font-extrabold tracking-[-0.045em] text-[#fffdf5] sm:text-5xl"
                >
                  <ChalkWritingText
                    text={focus.boardText}
                  />
                </h2>

                <p className="mt-3 text-lg font-bold tracking-[-0.025em] text-[#f7f1df] sm:text-xl">
                  {focus.subtitle}
                </p>

                <p className="mt-4 max-w-[650px] text-sm leading-7 text-[#eee7d4]/82">
                  {focus.copy}
                </p>
              </div>

              <Link
                href={focus.href}
                className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-[8px] border border-[#d9cfaa] bg-[#faf4df] px-5 text-sm font-bold text-[#1e2a23] shadow-[0_4px_0_#b9a77c] transition hover:-translate-y-0.5 hover:bg-white"
              >
                <Icon
                  name="calendar"
                  className="h-4 w-4"
                />

                {focus.action}

                <Icon
                  name="arrow"
                  className="h-4 w-4"
                />
              </Link>

              <div className="pointer-events-none absolute bottom-5 left-8 hidden items-end gap-3 opacity-70 sm:flex">
                <span className="h-[5px] w-14 -rotate-2 rounded-full bg-[#eee8d3] shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />

                <span className="h-[5px] w-9 rotate-3 rounded-full bg-[#d7c887] shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />

                <span className="h-[5px] w-7 -rotate-1 rounded-full bg-[#deb7b1] shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
              </div>
            </div>

            <aside className="relative flex items-center justify-center border-t border-white/10 bg-[#25473a]/14 p-7 lg:border-l lg:border-t-0 lg:p-8">
              <div
                className="relative w-full max-w-[310px] rotate-[0.6deg] overflow-hidden rounded-[5px] border border-[#e1cf8d] bg-[#fff3bd] p-6 text-[#312d22] shadow-[7px_9px_0_rgba(10,24,18,0.18)] transition hover:rotate-0"
                style={{
                  backgroundImage: `
                    repeating-linear-gradient(
                      to bottom,
                      transparent 0,
                      transparent 31px,
                      rgba(125,103,51,0.11) 32px,
                      transparent 33px
                    ),
                    linear-gradient(
                      105deg,
                      rgba(255,255,255,0.3),
                      transparent 38%
                    )
                  `,
                }}
              >
                <span className="absolute left-1/2 top-3 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[#9b443b] bg-[#c86458] shadow-[0_2px_3px_rgba(0,0,0,0.3)]" />

                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#796839]">
                      Reminder note
                    </p>

                    <h3 className="mt-2 text-lg font-extrabold tracking-[-0.025em]">
                      For today
                    </h3>
                  </div>

                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f2d982] text-[#705614]">
                    <Icon
                      name="bell"
                      className="h-5 w-5"
                    />
                  </span>
                </div>

                <div className="mt-6">
                  <p className="text-5xl font-extrabold tracking-[-0.06em]">
                    {needsAttentionToday.length}
                  </p>

                  <p className="mt-2 text-sm font-semibold text-[#645b42]">
                    {needsAttentionToday.length === 1
                      ? "item needs attention"
                      : "items need attention"}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-[7px] border border-[#ddc979] bg-white/35 px-3 py-3">
                    <p className="text-xl font-extrabold">
                      {dueTodayReminders.length}
                    </p>

                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#75663d]">
                      Due today
                    </p>
                  </div>

                  <div className="rounded-[7px] border border-[#e0b49e] bg-[#f8d8c9]/55 px-3 py-3">
                    <p className="text-xl font-extrabold">
                      {missingReminders.length}
                    </p>

                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#825947]">
                      Missing
                    </p>
                  </div>
                </div>

                <Link
                  href="/dashboard/reminders"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#4e452d] underline decoration-[#9d8545]/45 decoration-2 underline-offset-4 hover:text-black"
                >
                  View all reminders

                  <Icon
                    name="arrow"
                    className="h-4 w-4"
                  />
                </Link>

                <span className="pointer-events-none absolute -bottom-4 -right-4 h-14 w-14 rotate-45 bg-[#e9d78e]/60" />
              </div>
            </aside>
          </div>

          <div
            className="h-[11px] border-t border-[#a47a54]"
            style={{
              background:
                "linear-gradient(to bottom, #845b3c, #63412b)",
              boxShadow:
                "inset 0 2px 2px rgba(255,255,255,0.1), 0 -2px 5px rgba(0,0,0,0.2)",
            }}
          />
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
              ? nextSubject.code ||
                nextSubject.name
              : todaySchedules.length > 0
                ? "Scheduled"
                : "No class today"
          }
          detail={
            nextSchedule
              ? `${formatTime(
                  nextSchedule.startTime,
                )} · ${
                  nextSchedule.room ||
                  "Location not set"
                }`
              : "Open Class Schedule to plan your week."
          }
          icon="calendar"
          href="/dashboard/calendar"
          tone="yellow"
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
                ? `${nextReminder.title} · ${reminderTiming(
                    nextReminder,
                  )}`
                : semesterStart
                  ? "No unfinished deadlines this semester."
                  : "Set your semester start in Assignments."
          }
          icon="tasks"
          href="/dashboard/reminders"
          tone="pink"
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
                ? `${formatDuration(
                    internshipSummary.remainingMinutes,
                  )} remaining.`
                : `${formatDuration(
                    internshipSummary.additionalMinutes,
                  )} additional time.`
              : "Set your required OJT hours."
          }
          icon="briefcase"
          href="/dashboard/internship"
          tone="mint"
        />

        <MetricCard
          label="Allowance"
          value={
            currentAllowance
              ? formatPeso(
                  financeSummary.remainingCentavos,
                )
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
          tone="lavender"
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
              {todaySchedules.length === 1
                ? "item"
                : "items"}
            </Link>
          </header>

          {todaySchedules.length === 0 ? (
            <div className="grid min-h-[280px] place-items-center p-8 text-center">
              <div className="max-w-[340px]">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--surface-blue)] text-[var(--blue)]">
                  <Icon
                    name="calendar"
                    className="h-5 w-5"
                  />
                </span>

                <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">
                  Your day is clear—for now
                </h3>

                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Add your class schedule so you can
                  see where you need to be and what
                  comes next.
                </p>

                <Link
                  href="/dashboard/calendar"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
                >
                  Create Class Schedule

                  <Icon
                    name="arrow"
                    className="h-4 w-4"
                  />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3 px-5 py-4 sm:px-6">
              {todaySchedules.map(
                (schedule) => {
                  const subject =
                    subjectsById.get(
                      schedule.subjectId,
                    );

                  const pastel =
                    getSubjectPastel(
                      subject,
                      subjects,
                    );

                  return (
                    <article
                      key={schedule.id}
                      className="rounded-[14px] border px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                      style={{
                        backgroundColor:
                          pastel.surface,
                        borderColor:
                          pastel.border,
                        backgroundImage:
                          stickyNoteLines(
                            "rgba(17, 24, 39, 0.04)",
                          ),
                      }}
                    >
                      <div className="grid gap-3 sm:grid-cols-[110px_7px_1fr_auto] sm:items-center sm:gap-4">
                        <p className="text-sm font-bold text-[var(--ink)]">
                          {formatTime(
                            schedule.startTime,
                          )}
                        </p>

                        <span
                          className="hidden h-14 rounded-full sm:block"
                          style={{
                            backgroundColor:
                              pastel.accent,
                          }}
                        />

                        <div>
                          <p
                            className="text-[10px] font-bold uppercase tracking-[0.08em]"
                            style={{
                              color: pastel.text,
                            }}
                          >
                            {subject?.code ||
                              "Class"}
                          </p>

                          <h3 className="mt-1 text-sm font-bold text-[var(--ink)]">
                            {subject?.name ??
                              "Class meeting"}
                          </h3>

                          <p className="mt-1 text-xs text-[var(--ink-soft)]">
                            {formatTime(
                              schedule.startTime,
                            )}
                            –
                            {formatTime(
                              schedule.endTime,
                            )}{" "}
                            ·{" "}
                            {schedule.room ||
                              schedule.mode.replaceAll(
                                "-",
                                " ",
                              )}
                          </p>
                        </div>

                        {schedule.meetingLink && (
                          <a
                            href={
                              schedule.meetingLink
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="secondary-button min-h-9 px-3 text-xs"
                          >
                            Join class
                          </a>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
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
                Assignment deadlines that need your
                attention
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
                  <Icon
                    name="calendar"
                    className="h-5 w-5"
                  />
                </span>

                <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">
                  Set your semester start
                </h3>

                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  This keeps your reminder list
                  focused on the current semester.
                </p>

                <Link
                  href="/dashboard/assignments"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--blue)] hover:text-[var(--blue-strong)]"
                >
                  Open Assignments

                  <Icon
                    name="arrow"
                    className="h-4 w-4"
                  />
                </Link>
              </div>
            </div>
          ) : loadingClassroom &&
            reminders.length === 0 ? (
            <div
              aria-live="polite"
              className="min-h-[280px] animate-pulse p-6"
            >
              <div className="h-16 rounded-[12px] bg-[var(--surface-soft)]" />

              <div className="mt-3 h-16 rounded-[12px] bg-[var(--surface-soft)]" />

              <div className="mt-3 h-16 rounded-[12px] bg-[var(--surface-soft)]" />

              <span className="sr-only">
                Loading reminders
              </span>
            </div>
          ) : reminderPreview.length === 0 ? (
            <div className="grid min-h-[280px] place-items-center p-8 text-center">
              <div className="max-w-[330px]">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--teal-soft)] text-[var(--teal)]">
                  <Icon
                    name="check"
                    className="h-5 w-5"
                  />
                </span>

                <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">
                  You are caught up
                </h3>

                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  No unfinished assignment
                  deadlines need your attention.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {reminderPreview.map(
                (reminder) => (
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
                      <Icon
                        name="bell"
                        className="h-4 w-4"
                      />
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
                      {reminderTiming(
                        reminder,
                      )}
                    </p>
                  </Link>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}