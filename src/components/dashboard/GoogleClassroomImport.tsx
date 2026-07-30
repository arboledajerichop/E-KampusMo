"use client";

import { useEffect, useMemo, useState } from "react";
import GoogleIcon from "@/components/GoogleIcon";
import Icon from "@/components/Icons";
import { useConfirmation } from "@/components/dashboard/ConfirmationDialog";
import {
  saveClassroomSemesterStart,
  setClassroomItemCompleted,
  useClassroomPreferences,
} from "@/lib/offline/classroom-preferences-store";

type ClassroomCategory =
  | "active"
  | "missing"
  | "completed"
  | "no-deadline";

type ClassroomWork = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  description: string;
  alternateLink: string;
  workType: string;
  maxPoints: number | null;
  dueAt: string | null;
  creationTime: string | null;
  courseState: "ACTIVE" | "ARCHIVED";
  submissionState: string | null;
  late: boolean;
};

type ClassroomResponse = {
  courseWork: ClassroomWork[];
  limited: boolean;
  error?: string;
  code?: string;
};

const categoryDetails: Record<
  ClassroomCategory,
  {
    label: string;
    icon: "tasks" | "clock" | "check" | "calendar";
    selectedClassName: string;
    iconClassName: string;
  }
> = {
  active: {
    label: "Active work",
    icon: "tasks",
    selectedClassName: "border-blue-600 ring-blue-100 dark:ring-blue-950",
    iconClassName: "bg-blue-50 text-[var(--blue)] dark:bg-blue-950",
  },
  missing: {
    label: "Missing",
    icon: "clock",
    selectedClassName: "border-red-600 ring-red-100 dark:ring-red-950",
    iconClassName: "bg-[var(--danger-soft)] text-[var(--danger)]",
  },
  completed: {
    label: "Completed",
    icon: "check",
    selectedClassName: "border-teal-600 ring-teal-100 dark:ring-teal-950",
    iconClassName: "bg-[var(--teal-soft)] text-[var(--teal)]",
  },
  "no-deadline": {
    label: "No deadline",
    icon: "calendar",
    selectedClassName: "border-amber-600 ring-amber-100 dark:ring-amber-950",
    iconClassName: "bg-[var(--warning-soft)] text-[var(--warning)]",
  },
};

const groupOrder = [
  "Missing deadlines",
  "Earlier this semester",
  "Due today",
  "Due this week",
  "Due next week",
  "Due in two weeks",
  "Due later",
  "No deadline",
] as const;

const manilaDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function classroomItemKey(item: ClassroomWork) {
  return `${item.courseId}/${item.id}`;
}

function classroomCategory(
  item: ClassroomWork,
  completedItems: Set<string>,
  currentTimestamp = Date.now(),
): ClassroomCategory {
  if (
    completedItems.has(classroomItemKey(item)) ||
    item.submissionState === "TURNED_IN" ||
    item.submissionState === "RETURNED"
  ) {
    return "completed";
  }
  if (!item.dueAt) return "no-deadline";
  if (new Date(item.dueAt).getTime() < currentTimestamp) {
    return "missing";
  }
  return "active";
}

function manilaDayNumber(value: string | number | Date) {
  const parts = manilaDayFormatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return (
    Date.UTC(part("year"), part("month") - 1, part("day")) /
    86_400_000
  );
}

function mondayOfWeek(dayNumber: number) {
  const day = new Date(dayNumber * 86_400_000).getUTCDay();
  return dayNumber - ((day + 6) % 7);
}

function activityGroup(
  item: ClassroomWork,
  category: ClassroomCategory,
) {
  if (category === "missing") return "Missing deadlines";
  if (!item.dueAt) return "No deadline";

  const today = manilaDayNumber(Date.now());
  const dueDay = manilaDayNumber(item.dueAt);
  if (dueDay < today) {
    return "Earlier this semester";
  }
  if (dueDay === today) return "Due today";

  const weekDifference =
    (mondayOfWeek(dueDay) - mondayOfWeek(today)) / 7;
  if (weekDifference === 0) return "Due this week";
  if (weekDifference === 1) return "Due next week";
  if (weekDifference === 2) return "Due in two weeks";
  return "Due later";
}

function formatClassroomDeadline(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function activityKind(item: ClassroomWork) {
  if (/\bproject\b/i.test(`${item.title} ${item.description}`)) {
    return "Project";
  }
  if (
    item.workType === "SHORT_ANSWER_QUESTION" ||
    item.workType === "MULTIPLE_CHOICE_QUESTION"
  ) {
    return "Question";
  }
  return "Assignment";
}

export default function GoogleClassroomImport({
  userId,
}: {
  userId: string;
}) {
  const confirm = useConfirmation();
  const preferences = useClassroomPreferences(userId);
  const [semesterDraft, setSemesterDraft] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [courseWork, setCourseWork] = useState<ClassroomWork[]>([]);
  const [limited, setLimited] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<ClassroomCategory>("active");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const semesterInputValue =
    semesterDraft ?? preferences.semesterStart;
  const completedItems = useMemo(
    () => new Set(preferences.completedItemKeys),
    [preferences.completedItemKeys],
  );
  const currentSemesterWork = useMemo(() => {
    if (!preferences.semesterStart) return [];
    const semesterStart = new Date(
      `${preferences.semesterStart}T00:00:00+08:00`,
    ).getTime();

    return courseWork
      .filter((item) => {
        const referenceDate = item.dueAt ?? item.creationTime;
        return (
          !referenceDate ||
          new Date(referenceDate).getTime() >= semesterStart
        );
      })
      .sort((left, right) => {
        if (!left.dueAt && !right.dueAt) {
          return left.title.localeCompare(right.title);
        }
        if (!left.dueAt) return 1;
        if (!right.dueAt) return -1;
        return (
          new Date(left.dueAt).getTime() -
          new Date(right.dueAt).getTime()
        );
      });
  }, [courseWork, preferences.semesterStart]);
  const summary = useMemo(
    () =>
      currentSemesterWork.reduce(
        (counts, item) => {
          counts[classroomCategory(item, completedItems)] += 1;
          return counts;
        },
        {
          active: 0,
          missing: 0,
          completed: 0,
          "no-deadline": 0,
        } satisfies Record<ClassroomCategory, number>,
      ),
    [completedItems, currentSemesterWork],
  );
  const filteredWork = useMemo(
    () =>
      currentSemesterWork.filter(
        (item) =>
          classroomCategory(item, completedItems) === selectedCategory,
      ),
    [completedItems, currentSemesterWork, selectedCategory],
  );
  const groupedWork = useMemo(() => {
    const groups = new Map<string, ClassroomWork[]>();
    for (const item of filteredWork) {
      const group = activityGroup(item, selectedCategory);
      groups.set(group, [...(groups.get(group) ?? []), item]);
    }
    return groupOrder
      .map((label) => ({ label, items: groups.get(label) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [filteredWork, selectedCategory]);

  async function loadCoursework(forceRefresh = false) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        forceRefresh
          ? "/api/google-classroom/coursework?refresh=1"
          : "/api/google-classroom/coursework",
        { cache: forceRefresh ? "no-store" : "default" },
      );
      const result = (await response.json()) as ClassroomResponse;
      if (!response.ok) {
        if (
          result.code === "not-connected" ||
          result.code === "reconnect"
        ) {
          setConnected(false);
        }
        throw new Error(
          result.error || "Google Classroom could not be loaded.",
        );
      }

      setConnected(true);
      setHasLoaded(true);
      setCourseWork(result.courseWork);
      setLimited(result.limited);
      if (result.courseWork.length === 0) {
        setMessage(
          "No published coursework was found in your Classroom classes.",
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Google Classroom could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function checkConnection() {
      try {
        const query = new URLSearchParams(window.location.search);
        const connectionResult = query.get("classroom");
        const connectionError = query.get("classroom_error");
        const response = await fetch(
          connectionResult
            ? "/api/google-classroom/status?refresh=1"
            : "/api/google-classroom/status",
          { cache: connectionResult ? "no-store" : "default" },
        );
        const result = (await response.json()) as {
          configured?: boolean;
          connected?: boolean;
        };
        if (!active) return;
        const isConnected = Boolean(result.connected);
        setConfigured(Boolean(result.configured));
        setConnected(isConnected);

        if (connectionError) {
          const messages: Record<string, string> = {
            denied:
              "Google Classroom access was not granted. Nothing was changed.",
            failed:
              "Google Classroom could not be connected. Please try again.",
            "not-configured":
              "Google Classroom setup is not finished for this app.",
            "rate-limited":
              "Too many Google Classroom connection attempts were made. Please wait and try again.",
          };
          setError(
            messages[connectionError] ??
              "Google Classroom could not be connected.",
          );
        } else if (isConnected) {
          void loadCoursework();
        }

        if (connectionResult || connectionError) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname,
          );
        }
      } catch {
        if (active) {
          setError("The Google Classroom connection could not be checked.");
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void checkConnection();
    return () => {
      active = false;
    };
  }, []);

  function saveSemesterStart() {
    setError("");
    setMessage("");
    if (!semesterInputValue) {
      setError("Choose the first day of the current semester.");
      return;
    }
    saveClassroomSemesterStart(userId, semesterInputValue);
    setSemesterDraft(null);
    setSelectedCategory("active");
    setMessage("Current semester start date saved.");
  }

  async function markDone(item: ClassroomWork) {
    const shouldProceed = await confirm({
      title: "Mark this activity as completed?",
      message: `${item.title} will move from Missing to Completed in E-KampusMo. Google Classroom will not be changed.`,
      confirmLabel: "Mark as completed",
    });
    if (!shouldProceed) return;

    setClassroomItemCompleted(userId, classroomItemKey(item), true);
    setMessage(`${item.title} was marked as completed.`);
  }

  function undoManualCompletion(item: ClassroomWork) {
    setClassroomItemCompleted(userId, classroomItemKey(item), false);
    setMessage(`${item.title} now follows its Google Classroom status.`);
  }

  async function disconnect() {
    const shouldProceed = await confirm({
      title: "Disconnect Google Classroom?",
      message:
        "E-KampusMo will stop reading Classroom. Your semester date and manual completion choices will remain private in your account.",
      confirmLabel: "Disconnect",
      tone: "danger",
    });
    if (!shouldProceed) return;

    setDisconnecting(true);
    setError("");
    try {
      const response = await fetch(
        "/api/google-classroom/disconnect",
        { method: "POST" },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(
          result.error || "Google Classroom could not be disconnected.",
        );
      }
      setConnected(false);
      setHasLoaded(false);
      setCourseWork([]);
      setMessage("Google Classroom was disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Google Classroom could not be disconnected.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
      <header className="flex flex-col justify-between gap-4 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] border border-[var(--line)] bg-white">
            <GoogleIcon />
          </span>
          <div>
            <h2 className="font-bold text-[var(--ink)]">
              Google Classroom
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              One current-semester view for active, missing, completed, and
              undated work.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {connected ? (
            <>
              <button
                type="button"
                onClick={() => void loadCoursework(true)}
                disabled={loading}
                className="primary-button px-4 text-xs"
              >
                <Icon name="signal" className="h-4 w-4" />
                {loading ? "Refreshing…" : "Refresh Classroom"}
              </button>
              <button
                type="button"
                onClick={() => void disconnect()}
                disabled={disconnecting}
                className="secondary-button px-4 text-xs"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          ) : configured ? (
            <a
              href="/api/google-classroom/connect"
              className="primary-button px-4 text-xs"
            >
              <GoogleIcon />
              Connect Google Classroom
            </a>
          ) : (
            <span className="rounded-full bg-[var(--warning-soft)] px-3 py-2 text-xs font-bold text-[var(--warning)]">
              Setup required
            </span>
          )}
        </div>
      </header>

      <section className="border-b border-[var(--line)] bg-[var(--surface-soft)] px-5 py-5 sm:px-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">
              Current semester
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Activities are included from the semester start date you choose.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="text-xs font-bold text-[var(--ink-soft)]">
              Semester starts
              <input
                type="date"
                value={semesterInputValue}
                onChange={(event) => setSemesterDraft(event.target.value)}
                className="form-input mt-2 py-2 text-xs"
              />
            </label>
            <button
              type="button"
              onClick={saveSemesterStart}
              disabled={!semesterInputValue}
              className="secondary-button px-4 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save date
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              "active",
              "missing",
              "completed",
              "no-deadline",
            ] as ClassroomCategory[]
          ).map((category) => {
            const details = categoryDetails[category];
            const selected = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                disabled={!preferences.semesterStart}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-[13px] border bg-[var(--surface)] p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? `ring-2 ${details.selectedClassName}`
                    : "border-[var(--line)] hover:border-[var(--muted)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                      {details.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-[var(--ink)]">
                      {summary[category]}
                    </p>
                  </div>
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-[10px] ${details.iconClassName}`}
                  >
                    <Icon
                      name={details.icon}
                      className="h-4 w-4"
                    />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="px-5 py-5 sm:px-6">
        {checking ? (
          <p className="text-sm text-[var(--muted)]">
            Checking Google Classroom connection…
          </p>
        ) : !configured ? (
          <div className="rounded-[12px] bg-[var(--warning-soft)] p-4">
            <p className="text-sm font-bold text-[var(--warning)]">
              Google Classroom credentials are not configured
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Add the required Google Cloud credentials and redirect URL
              described in the project setup guide.
            </p>
          </div>
        ) : !connected ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Connection is optional and read-only. E-KampusMo cannot submit,
            edit, grade, or delete anything in Google Classroom.
          </p>
        ) : !preferences.semesterStart ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Choose and save the first day of your current semester to organize
            your Classroom activities.
          </p>
        ) : loading && !hasLoaded ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Loading your current-semester activities…
          </p>
        ) : !hasLoaded ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            Select “Refresh Classroom” to load your activities.
          </p>
        ) : groupedWork.length === 0 ? (
          <div className="grid min-h-[180px] place-items-center text-center">
            <div>
              <p className="text-sm font-bold text-[var(--ink)]">
                No {categoryDetails[selectedCategory].label.toLowerCase()} in
                this semester
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Select another summary card or refresh Classroom.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-7">
            {groupedWork.map((group) => (
              <section key={group.label}>
                <div className="flex items-center gap-3">
                  <h3 className="shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                    {group.label}
                  </h3>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                  <span className="text-xs font-semibold text-[var(--muted)]">
                    {group.items.length}
                  </span>
                </div>

                <div className="mt-2 divide-y divide-[var(--line)]">
                  {group.items.map((item) => {
                    const key = classroomItemKey(item);
                    const category = classroomCategory(
                      item,
                      completedItems,
                    );
                    const completed = category === "completed";
                    const manuallyCompleted = completedItems.has(key);

                    return (
                      <article
                        key={key}
                        className={`grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-center ${
                          completed ? "opacity-60 grayscale-[0.35]" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <h4
                            className={`font-bold text-[var(--ink)] ${
                              completed
                                ? "text-[var(--muted)] line-through decoration-2"
                                : ""
                            }`}
                          >
                            {item.title}
                          </h4>
                          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                            {item.courseName} · {activityKind(item)}
                            {item.dueAt
                              ? ` · Due ${formatClassroomDeadline(item.dueAt)}`
                              : " · No deadline"}
                            {item.maxPoints !== null
                              ? ` · ${item.maxPoints} points`
                              : ""}
                          </p>
                          {item.description && (
                            <p
                              className={`mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted-strong)] ${
                                completed ? "line-through" : ""
                              }`}
                            >
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {category === "missing" && (
                            <button
                              type="button"
                              onClick={() => void markDone(item)}
                              className="secondary-button px-3 text-xs"
                            >
                              <Icon name="check" className="h-4 w-4" />
                              Mark done
                            </button>
                          )}
                          {manuallyCompleted && (
                            <button
                              type="button"
                              onClick={() => undoManualCompletion(item)}
                              className="rounded-[8px] px-3 py-2 text-xs font-bold text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
                            >
                              Undo done
                            </button>
                          )}
                          {item.alternateLink && (
                            <a
                              href={item.alternateLink}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-[8px] px-3 py-2 text-xs font-bold text-[var(--blue)] hover:bg-blue-50 dark:hover:bg-blue-950"
                            >
                              Open in Classroom
                            </a>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {limited && (
          <p className="mt-4 rounded-[10px] bg-[var(--warning-soft)] px-4 py-3 text-xs text-[var(--warning)]">
            A large Classroom account was detected. This view shows the most
            recently updated activities available within the API page limit.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-[10px] border border-red-200 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)] dark:border-red-900"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-4 rounded-[10px] bg-[var(--teal-soft)] px-4 py-3 text-sm text-[var(--teal)]"
          >
            {message}
          </p>
        )}

        <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
          Google data is read only. Your semester date and manual completion
          choices sync privately to Supabase; Google Classroom is never
          modified.
        </p>
      </div>
    </section>
  );
}
