"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Icon from "@/components/Icons";
import { useConfirmation } from "@/components/dashboard/ConfirmationDialog";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { dateTodayInManila } from "@/lib/offline/finance-store";
import {
  addInternshipEntry,
  calculateCreditedMinutes,
  calculateInternshipSummary,
  calculateRenderedMinutes,
  classifyInternshipDay,
  estimateInternshipCompletion,
  formatDuration,
  removeInternshipEntry,
  removeInternshipProfile,
  saveInternshipProfile,
  updateInternshipEntry,
  useInternshipData,
  type InternshipEntry,
  type InternshipEntryStatus,
} from "@/lib/offline/internship-store";
import {
  calculateInternshipExpectedEnd,
  calculatedPhilippineHolidays,
  isWeekendDate,
  loadPhilippineHolidays,
  type PhilippinesHoliday,
} from "@/lib/calendar/philippines-calendar";

const DEFAULT_BREAK_MINUTES = 0;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default function InternshipClient({ userId }: { userId: string }) {
  const confirm = useConfirmation();
  const { profile, entries } = useInternshipData(userId);
  const summary = calculateInternshipSummary(profile, entries);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [logFormScrollRequest, setLogFormScrollRequest] = useState(0);
  const logFormRef = useRef<HTMLElement>(null);
  const logFormHeadingRef = useRef<HTMLHeadingElement>(null);
  const [companyName, setCompanyName] = useState(profile?.companyName ?? "");
  const [companyAddress, setCompanyAddress] = useState(
    profile?.companyAddress ?? "",
  );
  const [position, setPosition] = useState(profile?.position ?? "");
  const [supervisorName, setSupervisorName] = useState(
    profile?.supervisorName ?? "",
  );
  const [requiredHours, setRequiredHours] = useState(
    profile ? String(profile.requiredMinutes / 60) : "",
  );
  const [startDate, setStartDate] = useState(profile?.startDate ?? "");
  const [maxDailyHours, setMaxDailyHours] = useState(
    profile ? String(profile.maxDailyMinutes / 60) : "",
  );
  const [profileError, setProfileError] = useState("");
  const [entryStatus, setEntryStatus] =
    useState<InternshipEntryStatus>("worked");
  const [date, setDate] = useState(dateTodayInManila());
  const [clockIn, setClockIn] = useState("08:00");
  const [clockOut, setClockOut] = useState("17:00");
  const [absenceNote, setAbsenceNote] = useState("");
  const [reflection, setReflection] = useState("");
  const [logError, setLogError] = useState("");
  const [today] = useState(dateTodayInManila);
  const [holidayYears] = useState(() => {
    const currentYear = Number(dateTodayInManila().slice(0, 4));
    return Array.from({ length: 6 }, (_, index) => currentYear - 1 + index);
  });
  const [holidays, setHolidays] = useState<PhilippinesHoliday[]>(() =>
    holidayYears.flatMap(calculatedPhilippineHolidays),
  );

  useEffect(() => {
    let active = true;
    void loadPhilippineHolidays(holidayYears).then((loaded) => {
      if (active) setHolidays(loaded);
    });
    return () => {
      active = false;
    };
  }, [holidayYears]);

  useEffect(() => {
    if (!showLogForm || logFormScrollRequest === 0) return;

    const frame = window.requestAnimationFrame(() => {
      logFormRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      logFormHeadingRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [logFormScrollRequest, showLogForm]);

  const rawPreviewMinutes = calculateRenderedMinutes({
    status: entryStatus,
    clockIn,
    clockOut,
    breakMinutes: 0,
    adjustmentMinutes: 0,
  });
  const previewMinutes =
    rawPreviewMinutes === null
      ? null
      : profile
        ? Math.min(rawPreviewMinutes, profile.maxDailyMinutes)
        : rawPreviewMinutes;
  const previewClassification = profile
    ? classifyInternshipDay(
        {
          status: entryStatus,
          clockIn,
          clockOut,
          breakMinutes: 0,
          adjustmentMinutes: 0,
        },
        profile.maxDailyMinutes,
      )
    : null;
  const sortedEntries = [...entries].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const absenceDates = entries
    .filter((entry) => entry.status === "absent")
    .map((entry) => entry.date);
  const automaticExpectedEnd = calculateInternshipExpectedEnd({
    startDate,
    requiredMinutes: Math.round(Number(requiredHours) * 60),
    dailyMinutes: Math.round(Number(maxDailyHours) * 60),
    holidays,
    absenceDates,
  });
  const expectedSchedule = estimateInternshipCompletion(
    profile,
    entries,
    holidays,
    today,
  );
  const expectedEndDate = expectedSchedule?.estimatedDate ?? null;
  const holidayByDate = new Map(
    holidays.map((holiday) => [holiday.date, holiday]),
  );
  const selectedHoliday = holidayByDate.get(date);
  const upcomingHolidays = holidays
    .filter(
      (holiday) =>
        holiday.date >= today &&
        (!expectedEndDate || holiday.date <= expectedEndDate),
    )
    .slice(0, 4);

  function beginProfileEdit() {
    if (profile) {
      setCompanyName(profile.companyName);
      setCompanyAddress(profile.companyAddress);
      setPosition(profile.position);
      setSupervisorName(profile.supervisorName);
      setRequiredHours(String(profile.requiredMinutes / 60));
      setStartDate(profile.startDate);
      setMaxDailyHours(String(profile.maxDailyMinutes / 60));
    }
    setShowProfileForm(true);
  }

  async function handleDeletePlacement() {
    if (!profile) return;
    const logLabel =
      entries.length === 1 ? "1 daily log" : `${entries.length} daily logs`;
    const shouldProceed = await confirm({
      title: "Delete this internship placement?",
      message: `${profile.companyName} and ${logLabel} will be permanently removed after synchronization. This cannot be undone.`,
      confirmLabel: "Delete placement",
      tone: "danger",
    });
    if (!shouldProceed) return;

    removeInternshipProfile(userId, profile.id);
    setCompanyName("");
    setCompanyAddress("");
    setPosition("");
    setSupervisorName("");
    setRequiredHours("");
    setStartDate("");
    setMaxDailyHours("");
    setShowLogForm(false);
  }

  function openLogForm(status: InternshipEntryStatus) {
    if (!profile) return;
    setShowProfileForm(false);
    setEditingEntryId(null);
    setEntryStatus(status);
    setDate(dateTodayInManila());
    setAbsenceNote("");
    setReflection("");
    setLogError("");
    setShowLogForm(true);
    setLogFormScrollRequest((request) => request + 1);
  }

  function editJournalEntry(entry: InternshipEntry) {
    setShowProfileForm(false);
    setEditingEntryId(entry.id);
    setEntryStatus(entry.status);
    setDate(entry.date);
    setClockIn(entry.clockIn || "08:00");
    setClockOut(entry.clockOut || "17:00");
    setAbsenceNote(
      entry.status === "absent" && entry.activities !== "Absent"
        ? entry.activities
        : "",
    );
    setReflection(entry.reflection);
    setLogError("");
    setShowLogForm(true);
    setLogFormScrollRequest((request) => request + 1);
  }

  function closeLogForm() {
    setShowLogForm(false);
    setEditingEntryId(null);
    setLogError("");
  }

  function updateStoredExpectedEnd(nextEntries: InternshipEntry[]) {
    if (!profile) return;
    const nextSchedule = estimateInternshipCompletion(
      profile,
      nextEntries,
      holidays,
      today,
    );
    if (
      !nextSchedule?.estimatedDate ||
      nextSchedule.estimatedDate === profile.expectedEndDate
    ) {
      return;
    }

    saveInternshipProfile(userId, {
      companyName: profile.companyName,
      companyAddress: profile.companyAddress,
      position: profile.position,
      supervisorName: profile.supervisorName,
      requiredMinutes: profile.requiredMinutes,
      startDate: profile.startDate,
      expectedEndDate: nextSchedule.estimatedDate,
      defaultBreakMinutes: profile.defaultBreakMinutes,
      maxDailyMinutes: profile.maxDailyMinutes,
    });
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    const requiredMinutes = Math.round(Number(requiredHours) * 60);
    const breakValue =
      profile?.defaultBreakMinutes ?? DEFAULT_BREAK_MINUTES;
    const maxDailyMinutes = Math.round(Number(maxDailyHours) * 60);

    if (!companyName.trim() || !position.trim()) {
      setProfileError("Enter the company name and your position.");
      return;
    }
    if (!Number.isFinite(requiredMinutes) || requiredMinutes < 60) {
      setProfileError("Required hours must be at least 1 hour.");
      return;
    }
    if (!startDate) {
      setProfileError("Enter your internship start date.");
      return;
    }
    if (
      !Number.isFinite(maxDailyMinutes) ||
      maxDailyMinutes < 60 ||
      maxDailyMinutes > 1440
    ) {
      setProfileError("Maximum rendered time must be between 1 and 24 hours.");
      return;
    }
    if (!automaticExpectedEnd) {
      setProfileError(
        "The expected end date could not be calculated from these details.",
      );
      return;
    }

    if (!profile) {
      const shouldProceed = await confirm({
        title: "Save this internship placement?",
        message: `${companyName.trim()} will be added as your internship placement and synchronized with your account.`,
        confirmLabel: "Save placement",
      });
      if (!shouldProceed) return;
    }

    saveInternshipProfile(userId, {
      companyName: companyName.trim(),
      companyAddress: companyAddress.trim(),
      position: position.trim(),
      supervisorName: supervisorName.trim(),
      requiredMinutes,
      startDate,
      expectedEndDate: automaticExpectedEnd.expectedEndDate,
      defaultBreakMinutes: breakValue,
      maxDailyMinutes,
    });
    setShowProfileForm(false);
  }

  async function handleLogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLogError("");

    if (profile && date < profile.startDate) {
      setLogError("The record date cannot be before your internship starts.");
      return;
    }
    if (entryStatus === "worked" && previewMinutes === null) {
      setLogError("Clock-out must be later than clock-in.");
      return;
    }
    const entryBeingEdited = editingEntryId
      ? entries.find((entry) => entry.id === editingEntryId)
      : undefined;
    if (editingEntryId && !entryBeingEdited) {
      setLogError("This journal record could not be found. Refresh and try again.");
      return;
    }
    const conflictingDateEntry = entries.find(
      (entry) => entry.date === date && entry.id !== editingEntryId,
    );
    if (editingEntryId && conflictingDateEntry) {
      setLogError("Another journal record already uses this date.");
      return;
    }
    const entryInput = {
      status: entryStatus,
      date,
      clockIn: entryStatus === "worked" ? clockIn : "",
      clockOut: entryStatus === "worked" ? clockOut : "",
      breakMinutes: 0,
      adjustmentMinutes: 0,
      adjustmentNote: "",
      activities:
        entryStatus === "worked" ? "" : absenceNote.trim() || "Absent",
      reflection: entryStatus === "worked" ? reflection.trim() : "",
    };
    const existingEntry =
      entryBeingEdited ?? entries.find((entry) => entry.date === date);
    const forecastEntry: InternshipEntry = existingEntry
      ? { ...existingEntry, ...entryInput }
      : {
          ...entryInput,
          id: `forecast-${date}`,
          createdAt: "",
          updatedAt: "",
        };
    const nextEntries = existingEntry
      ? entries.map((entry) =>
          entry.id === existingEntry.id ? forecastEntry : entry,
        )
      : [...entries, forecastEntry];

    const shouldProceed = await confirm({
      title: editingEntryId
        ? "Save changes to this daily record?"
        : existingEntry
        ? "Replace this daily record?"
        : entryStatus === "worked"
          ? "Add this work log?"
          : "Record this absence?",
      message: editingEntryId
        ? `The internship record for ${formatDate(
            entryBeingEdited?.date ?? date,
          )} will be updated with the corrected information.`
        : existingEntry
        ? `The existing internship record for ${formatDate(
            date,
          )} will be replaced with these details.`
        : `This ${
            entryStatus === "worked" ? "work log" : "absence"
          } for ${formatDate(
            date,
          )} will be added and synchronized with your account.`,
      confirmLabel: editingEntryId
        ? "Save changes"
        : existingEntry
        ? "Replace record"
        : entryStatus === "worked"
          ? "Add work log"
          : "Record absence",
      tone: existingEntry && !editingEntryId ? "danger" : "default",
    });
    if (!shouldProceed) return;

    updateStoredExpectedEnd(nextEntries);
    if (editingEntryId) {
      updateInternshipEntry(userId, editingEntryId, entryInput);
    } else {
      addInternshipEntry(userId, entryInput);
    }
    setEntryStatus("worked");
    setDate(dateTodayInManila());
    setClockIn("08:00");
    setClockOut("17:00");
    setAbsenceNote("");
    setReflection("");
    setShowLogForm(false);
    setEditingEntryId(null);
  }

  return (
    <>
      <DashboardPageHeader
        eyebrow="OJT progress"
        title="Internship"
        description="Track rendered time and keep an optional daily reflection for each work log."
        action={
          profile ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => openLogForm("absent")}
                aria-controls="internship-log-form"
                aria-expanded={showLogForm && entryStatus === "absent"}
                className="secondary-button w-full px-5 sm:w-auto"
              >
                Record absence
              </button>
              <button
                type="button"
                onClick={() => openLogForm("worked")}
                aria-controls="internship-log-form"
                aria-expanded={showLogForm && entryStatus === "worked"}
                className="primary-button w-full px-5 sm:w-auto"
              >
                <Icon name="plus" className="h-4 w-4" />
                Add work log
              </button>
            </div>
          ) : undefined
        }
      />

      {(!profile || showProfileForm) && (
        <section className="mt-6 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--blue)]">
            Internship setup
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--ink)]">
            {profile ? "Update your placement" : "Add your placement"}
          </h2>
          <form onSubmit={handleProfileSubmit} className="mt-6">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm font-bold text-[var(--ink-soft)]">
                Company name
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  required
                  className="form-input mt-2"
                />
              </label>
              <label className="text-sm font-bold text-[var(--ink-soft)]">
                Position or role
                <input
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  required
                  className="form-input mt-2"
                />
              </label>
              <label className="text-sm font-bold text-[var(--ink-soft)]">
                Supervisor
                <input
                  value={supervisorName}
                  onChange={(event) => setSupervisorName(event.target.value)}
                  placeholder="Optional"
                  className="form-input mt-2"
                />
              </label>
              <label className="text-sm font-bold text-[var(--ink-soft)] md:col-span-2 xl:col-span-2">
                Company address
                <input
                  value={companyAddress}
                  onChange={(event) => setCompanyAddress(event.target.value)}
                  placeholder="Optional"
                  className="form-input mt-2"
                />
              </label>
              <label className="text-sm font-bold text-[var(--ink-soft)]">
                Required hours
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={requiredHours}
                  onChange={(event) => setRequiredHours(event.target.value)}
                  required
                  className="form-input mt-2"
                />
              </label>
              <label className="text-sm font-bold text-[var(--ink-soft)]">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                  className="form-input mt-2"
                />
              </label>
              <label className="text-sm font-bold text-[var(--ink-soft)]">
                Company&apos;s maximum rendered hours/day
                <input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={maxDailyHours}
                  onChange={(event) => setMaxDailyHours(event.target.value)}
                  placeholder="Enter the company limit"
                  required
                  className="form-input mt-2"
                />
                <span className="mt-2 block text-xs font-normal leading-5 text-[var(--muted)]">
                  Enter the policy used by your company; no default is assumed.
                  Extra time is shown but not credited.
                </span>
              </label>
              <div className="text-sm font-bold text-[var(--ink-soft)]">
                Expected end
                <div
                  aria-live="polite"
                  className="mt-2 flex min-h-12 items-center rounded-[10px] border border-[var(--line)] bg-[var(--surface-soft)] px-4 text-sm font-semibold text-[var(--ink)]"
                >
                  {automaticExpectedEnd
                    ? formatDate(automaticExpectedEnd.expectedEndDate)
                    : "Enter the required hours, start date, and company hours per day"}
                </div>
                <span className="mt-2 block text-xs font-normal leading-5 text-[var(--muted)]">
                  Calculated automatically without a date picker.
                </span>
              </div>
            </div>
            {profileError && (
              <p
                role="alert"
                className="mt-5 rounded-[10px] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
              >
                {profileError}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {profile && (
                <button
                  type="button"
                  onClick={() => setShowProfileForm(false)}
                  className="secondary-button px-5"
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="primary-button px-5">
                Save placement
              </button>
            </div>
          </form>
        </section>
      )}

      {profile && !showProfileForm && (
        <>
          <section className="mt-6 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] p-5 sm:flex-row sm:items-start sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--teal)]">
                  Active placement
                </p>
                <h2 className="mt-2 text-xl font-bold text-[var(--ink)]">
                  {profile.companyName}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {profile.position}
                  {profile.supervisorName
                    ? ` · Supervisor: ${profile.supervisorName}`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Forecast: Monday–Friday · Up to{" "}
                  {formatDuration(profile.maxDailyMinutes)} credited per day
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={beginProfileEdit}
                  className="secondary-button min-h-10 px-4 text-xs"
                >
                  Edit placement
                </button>
                <button
                  type="button"
                onClick={() => void handleDeletePlacement()}
                  className="min-h-10 rounded-[10px] border border-red-200 px-4 text-xs font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)] dark:border-red-900"
                >
                  Delete placement
                </button>
              </div>
            </div>
            <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Rendered", formatDuration(summary.renderedMinutes)],
                ["Required", formatDuration(summary.requiredMinutes)],
                [
                  summary.additionalMinutes > 0 ? "Additional" : "Remaining",
                  formatDuration(
                    summary.additionalMinutes || summary.remainingMinutes,
                  ),
                ],
                [
                  "Average day",
                  summary.workedDays > 0
                    ? formatDuration(summary.averageMinutes)
                    : "No logs yet",
                ],
              ].map(([label, value]) => (
                <div key={label} className="bg-[var(--surface)] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                    {label}
                  </p>
                  <p className="mt-2 text-xl font-bold text-[var(--ink)]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="font-bold text-[var(--ink-soft)]">
                  Overall progress
                </span>
                <span className="font-bold text-[var(--teal)]">
                  {summary.progressPercent}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                <div
                  className="h-full rounded-full bg-[var(--teal)]"
                  style={{ width: `${summary.progressPercent}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                {summary.remainingMinutes > 0
                  ? `${summary.estimatedWorkdays} maximum-capacity workday${
                      summary.estimatedWorkdays === 1 ? "" : "s"
                    } remain. ${
                      summary.shortDays > 0
                        ? `${summary.shortDays} short workday${
                            summary.shortDays === 1 ? " has" : "s have"
                          } been credited using the actual logged time.`
                        : "Future short days, absences, weekends, and holidays may move the date."
                    }`
                  : "Your required time has been completed."}
              </p>
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-[var(--line)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
                  Philippine work calendar
                </p>
                <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">
                  {expectedSchedule?.completed
                    ? "Completed on"
                    : "Estimated completion"}
                </h2>
                <p className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[var(--ink)]">
                  {expectedEndDate
                    ? formatDate(expectedEndDate)
                    : "Calculating…"}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  Recalculated from actual credited hours. Half days, early
                  outs, absences, weekends, and holidays can move this date.
                </p>
                {expectedSchedule && (
                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-5">
                    {[
                      ["Workdays left", expectedSchedule.workdaysNeeded],
                      ["Short days", summary.shortDays],
                      ["Absences", summary.absenceDays],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                          {label}
                        </dt>
                        <dd className="mt-1 text-lg font-bold text-[var(--ink)]">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--ink)]">
                      Upcoming nationwide non-working holidays
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      These dates are skipped automatically from the expected
                      end calculation.
                    </p>
                  </div>
                  <Icon
                    name="calendar"
                    className="h-5 w-5 shrink-0 text-[var(--blue)]"
                  />
                </div>
                {upcomingHolidays.length > 0 ? (
                  <div className="mt-4 divide-y divide-[var(--line)]">
                    {upcomingHolidays.map((holiday) => (
                      <div
                        key={`${holiday.date}-${holiday.name}`}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <p className="text-sm font-semibold text-[var(--ink-soft)]">
                          {holiday.name}
                        </p>
                        <p className="shrink-0 text-xs font-bold text-[var(--muted)]">
                          {formatDate(holiday.date)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-[10px] bg-[var(--surface-soft)] px-4 py-3 text-xs leading-5 text-[var(--muted)]">
                    No nationwide holiday falls before the current estimated
                    completion date.
                  </p>
                )}
                <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
                  Nationwide Philippine holidays only. Local holidays and future
                  presidential proclamations may change the estimate.
                </p>
              </div>
            </div>
          </section>

          {showLogForm && (
            <section
              id="internship-log-form"
              ref={logFormRef}
              className="mt-6 scroll-mt-24 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-7"
            >
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--blue)]">
                Daily time record
              </p>
              <h2
                ref={logFormHeadingRef}
                tabIndex={-1}
                className="mt-2 text-xl font-bold text-[var(--ink)] outline-none"
              >
                {editingEntryId
                  ? "Edit daily record"
                  : entryStatus === "absent"
                  ? "Record an absence"
                  : "Add a work log"}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {entryStatus === "absent"
                  ? "A weekday absence is skipped and automatically moves your expected end."
                  : "Short days are credited at their actual hours and automatically update your estimated completion."}
              </p>
              <form onSubmit={handleLogSubmit} className="mt-6">
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="text-sm font-bold text-[var(--ink-soft)]">
                    Date
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                      className="form-input mt-2"
                    />
                  </label>
                  <label className="text-sm font-bold text-[var(--ink-soft)]">
                    Record type
                    <select
                      value={entryStatus}
                      onChange={(event) =>
                        setEntryStatus(
                          event.target.value as InternshipEntryStatus,
                        )
                      }
                      className="form-input mt-2"
                    >
                      <option value="worked">Worked</option>
                      <option value="absent">Absent</option>
                    </select>
                  </label>
                  {entryStatus === "worked" && (
                    <>
                      <label className="text-sm font-bold text-[var(--ink-soft)]">
                        Clock in
                        <input
                          type="time"
                          value={clockIn}
                          onChange={(event) => setClockIn(event.target.value)}
                          required
                          className="form-input mt-2"
                        />
                      </label>
                      <label className="text-sm font-bold text-[var(--ink-soft)]">
                        Clock out
                        <input
                          type="time"
                          value={clockOut}
                          onChange={(event) => setClockOut(event.target.value)}
                          required
                          className="form-input mt-2"
                        />
                      </label>
                    </>
                  )}
                </div>
                {(selectedHoliday || isWeekendDate(date)) && (
                  <p className="mt-4 rounded-[10px] bg-[var(--warning-soft)] px-4 py-3 text-xs leading-5 text-[var(--warning)]">
                    {selectedHoliday
                      ? `${selectedHoliday.name} is a nationwide non-working holiday.`
                      : "This date falls on a Saturday or Sunday."}{" "}
                    {entryStatus === "worked"
                      ? "A worked entry still counts toward rendered time, subject to the company limit."
                      : "Recording an absence here will not move the expected end because the date is already non-working."}
                  </p>
                )}
                {entryStatus === "absent" &&
                  !selectedHoliday &&
                  !isWeekendDate(date) && (
                    <p className="mt-4 rounded-[10px] bg-blue-50 px-4 py-3 text-xs leading-5 text-[var(--blue)] dark:bg-blue-950/30">
                      This workday will be skipped and your expected end date
                      will be recalculated after saving.
                    </p>
                  )}
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {entryStatus === "worked" ? (
                    <label className="text-sm font-bold text-[var(--ink-soft)]">
                      <span className="flex items-center justify-between gap-3">
                        Reflection
                        <span className="text-xs font-medium text-[var(--muted)]">
                          Optional to answer
                        </span>
                      </span>
                      <textarea
                        value={reflection}
                        onChange={(event) => setReflection(event.target.value)}
                        rows={6}
                        placeholder="Optional: What did you learn or need to follow up on?"
                        className="form-input mt-2 resize-y"
                      />
                    </label>
                  ) : (
                    <label className="text-sm font-bold text-[var(--ink-soft)]">
                      Absence note
                      <textarea
                        value={absenceNote}
                        onChange={(event) =>
                          setAbsenceNote(event.target.value)
                        }
                        rows={6}
                        placeholder="Optional reason or note"
                        className="form-input mt-2 resize-y"
                      />
                    </label>
                  )}
                  <div className="rounded-[11px] bg-[var(--surface-soft)] p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                      Rendered-time preview
                    </p>
                    <p className="mt-1 text-lg font-bold text-[var(--ink)]">
                      {previewMinutes === null
                        ? "Check the time range"
                        : formatDuration(previewMinutes)}
                    </p>
                    {entryStatus === "worked" &&
                      rawPreviewMinutes !== null &&
                      previewMinutes !== null &&
                      rawPreviewMinutes > previewMinutes && (
                        <p className="mt-1 text-xs font-semibold text-[var(--warning)]">
                          {formatDuration(rawPreviewMinutes)} calculated;{" "}
                          {formatDuration(previewMinutes)} credited.
                        </p>
                      )}
                    {entryStatus === "worked" &&
                      previewMinutes !== null &&
                      previewClassification && (
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            previewClassification.shortfallMinutes > 0
                              ? "text-[var(--warning)]"
                              : "text-[var(--teal)]"
                          }`}
                        >
                          {previewClassification.label}
                          {previewClassification.shortfallMinutes > 0
                            ? ` · ${formatDuration(
                                previewClassification.shortfallMinutes,
                              )} below the daily maximum`
                            : ""}
                        </p>
                      )}
                    <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
                      {entryStatus === "worked"
                        ? `Clock-out minus clock-in, capped at ${formatDuration(
                            profile.maxDailyMinutes,
                          )} per day. Up to half is labeled Half day; more than half but below the maximum is Early out.`
                        : "A weekday absence adds no rendered time and moves the expected end date."}
                    </p>
                  </div>
                </div>
                {logError && (
                  <p
                    role="alert"
                    className="mt-5 rounded-[10px] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
                  >
                    {logError}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeLogForm}
                    className="secondary-button px-5"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-button px-5">
                    {editingEntryId ? "Save changes" : "Save daily log"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="mt-6 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <header className="border-b border-[var(--line)] p-5 sm:p-6">
              <h2 className="text-lg font-bold text-[var(--ink)]">
                Daily journal
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {entries.length} journal record
                {entries.length === 1 ? "" : "s"}
              </p>
            </header>
            {sortedEntries.length === 0 ? (
              <div className="grid min-h-64 place-items-center p-8 text-center">
                <div className="max-w-sm">
                  <Icon
                    name="briefcase"
                    className="mx-auto h-7 w-7 text-[var(--blue)]"
                  />
                  <h3 className="mt-4 font-bold text-[var(--ink)]">
                    No daily logs yet
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Add a workday to calculate your rendered and remaining
                    hours.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {sortedEntries.map((entry) => {
                  const calculatedMinutes =
                    calculateRenderedMinutes(entry) ?? 0;
                  const creditedMinutes =
                    calculateCreditedMinutes(
                      entry,
                      profile.maxDailyMinutes,
                    ) ?? 0;
                  const dayClassification = classifyInternshipDay(
                    entry,
                    profile.maxDailyMinutes,
                  );

                  return (
                    <article
                      key={entry.id}
                      className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[170px_1fr_auto]"
                    >
                      <div>
                        <p className="text-sm font-bold text-[var(--ink)]">
                          {formatDate(entry.date)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {entry.status === "absent"
                            ? "Absent · 0h 0m"
                            : `${dayClassification.label} · ${entry.clockIn}–${entry.clockOut} · ${formatDuration(
                                creditedMinutes,
                              )} credited`}
                        </p>
                        {entry.status === "worked" &&
                          calculatedMinutes > creditedMinutes && (
                            <p className="mt-1 text-xs font-semibold text-[var(--warning)]">
                              {formatDuration(calculatedMinutes)} calculated
                            </p>
                          )}
                      </div>
                      <div>
                        {entry.status === "absent" ? (
                          <p className="text-sm leading-6 text-[var(--ink-soft)]">
                            {entry.activities}
                          </p>
                        ) : entry.reflection ? (
                          <p className="text-sm leading-6 text-[var(--ink-soft)]">
                            {entry.reflection}
                          </p>
                        ) : (
                          <p className="text-xs leading-5 text-[var(--muted)]">
                            No reflection added.
                          </p>
                        )}
                        {entry.status === "worked" &&
                          entry.adjustmentMinutes !== 0 && (
                            <p className="mt-2 text-xs text-[var(--warning)]">
                              Adjusted{" "}
                              {formatDuration(entry.adjustmentMinutes)}:{" "}
                              {entry.adjustmentNote}
                            </p>
                          )}
                      </div>
                      <div className="flex items-center gap-4 self-start">
                        <button
                          type="button"
                          onClick={() => editJournalEntry(entry)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--blue)] hover:underline"
                        >
                          <Icon name="edit" className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const shouldProceed = await confirm({
                              title: "Delete this daily log?",
                              message: `The internship record for ${formatDate(
                                entry.date,
                              )} will be permanently removed after synchronization.`,
                              confirmLabel: "Delete daily log",
                              tone: "danger",
                            });
                            if (shouldProceed) {
                              updateStoredExpectedEnd(
                                entries.filter((item) => item.id !== entry.id),
                              );
                              removeInternshipEntry(userId, entry.id);
                              if (editingEntryId === entry.id) {
                                closeLogForm();
                              }
                            }
                          }}
                          className="text-xs font-bold text-[var(--danger)] hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
