"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icons";
import { useConfirmation } from "@/components/dashboard/ConfirmationDialog";
import {
  addSchedules,
  addSubject,
  dayOptions,
  findScheduleConflict,
  useAcademicData,
} from "@/lib/offline/academic-store";
import { subjectPastels } from "@/lib/schedule/subject-colors";

const subjectColors = subjectPastels.map((pastel) => pastel.accent);

function currentManilaDay(): number {
  const shortDay = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
  }).format(new Date());
  const match = dayOptions.find((day) => day.short === shortDay);
  return match?.value ?? 1;
}

function isValidMeetingLink(value: string) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function ScheduleForm({ userId }: { userId: string }) {
  const router = useRouter();
  const confirm = useConfirmation();
  const { subjects, schedules } = useAcademicData(userId);
  const [subjectChoice, setSubjectChoice] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectClassCode, setNewSubjectClassCode] = useState("");
  const [newSubjectInstructor, setNewSubjectInstructor] = useState("");
  const [newSubjectUnits, setNewSubjectUnits] = useState("");
  const [newSubjectTerm, setNewSubjectTerm] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState(subjectColors[0]);
  const [selectedDays, setSelectedDays] = useState<number[]>([
    currentManilaDay(),
  ]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [meetingType, setMeetingType] = useState<
    "lecture" | "laboratory" | "other"
  >("lecture");
  const [mode, setMode] = useState<"face-to-face" | "online" | "hybrid">(
    "face-to-face",
  );
  const [room, setRoom] = useState("");
  const [building, setBuilding] = useState("");
  const [campus, setCampus] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const creatingSubject = subjectChoice === "new" || subjects.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (creatingSubject && !newSubjectName.trim()) {
      setError("Enter a subject name for this class.");
      return;
    }

    if (!creatingSubject && !subjectChoice) {
      setError("Choose a subject.");
      return;
    }

    if (selectedDays.length === 0) {
      setError("Choose at least one meeting day.");
      return;
    }

    if (startTime >= endTime) {
      setError("The end time must be later than the start time.");
      return;
    }

    if (!isValidMeetingLink(meetingLink.trim())) {
      setError("Enter a complete meeting link beginning with http:// or https://.");
      return;
    }

    const conflictDay = selectedDays.find((day) =>
      findScheduleConflict(schedules, day, startTime, endTime),
    );
    const conflict =
      conflictDay === undefined
        ? undefined
        : findScheduleConflict(schedules, conflictDay, startTime, endTime);

    if (conflict && conflictDay !== undefined) {
      const conflictingSubject = subjects.find(
        (subject) => subject.id === conflict.subjectId,
      );
      const dayLabel =
        dayOptions.find((day) => day.value === conflictDay)?.label ?? "This day";
      setError(
        `${dayLabel} overlaps with ${
          conflictingSubject?.name ?? "another class"
        } from ${conflict.startTime} to ${conflict.endTime}.`,
      );
      return;
    }

    const subjectName = creatingSubject
      ? newSubjectName.trim()
      : subjects.find((subject) => subject.id === subjectChoice)?.name ??
        "this subject";
    const shouldProceed = await confirm({
      title: "Add this class schedule?",
      message: `${selectedDays.length} meeting${
        selectedDays.length === 1 ? "" : "s"
      } for ${subjectName} will be added and synchronized with your account.`,
      confirmLabel: "Add class schedule",
    });
    if (!shouldProceed) return;

    let subjectId = subjectChoice;

    if (creatingSubject) {
      const parsedUnits = newSubjectUnits ? Number(newSubjectUnits) : null;
      if (
        parsedUnits !== null &&
        (!Number.isFinite(parsedUnits) ||
          parsedUnits < 0 ||
          parsedUnits > 20)
      ) {
        setError("Units must be between 0 and 20.");
        return;
      }
      subjectId = addSubject(userId, {
        name: newSubjectName.trim(),
        code: newSubjectCode.trim().toUpperCase(),
        classCode: newSubjectClassCode.trim().toUpperCase(),
        instructorName: newSubjectInstructor.trim(),
        units: parsedUnits,
        color: newSubjectColor,
        term: newSubjectTerm.trim(),
      }).id;
    }

    addSchedules(
      userId,
      selectedDays.map((dayOfWeek) => ({
        subjectId,
        dayOfWeek,
        startTime,
        endTime,
        meetingType,
        room: room.trim(),
        building: building.trim(),
        campus: campus.trim(),
        mode,
        meetingLink: meetingLink.trim(),
        reminderMinutes,
        notes: notes.trim(),
      })),
    );

    router.push("/dashboard/calendar");
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard/calendar"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--blue)]"
        >
          <Icon name="arrow" className="h-3.5 w-3.5 rotate-180" />
          Back to Class Schedule
        </Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-[var(--blue)]">
          Weekly timetable
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-[var(--ink)] sm:text-4xl">
          Add class schedule
        </h1>
        <p className="mt-2 max-w-[680px] text-sm leading-6 text-[var(--muted)]">
          Enter the course details once and select every day that uses the same
          time and location. Add another entry when a subject has a different
          laboratory or meeting time.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]"
      >
        <section
          aria-labelledby="subject-section"
          className="border-b border-[var(--line)] p-5 sm:p-7"
        >
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
                Step 1
              </p>
              <h2
                id="subject-section"
                className="mt-2 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]"
              >
                Choose the subject
              </h2>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Select an existing subject or create one without leaving this
                form.
              </p>
            </div>

            <div className="space-y-5">
              {subjects.length > 0 && (
                <div>
                  <label
                    htmlFor="schedule-subject"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Subject
                  </label>
                  <select
                    id="schedule-subject"
                    value={subjectChoice}
                    onChange={(event) => setSubjectChoice(event.target.value)}
                    className="form-input"
                  >
                    <option value="">Select a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.code
                          ? `${subject.code} — ${subject.name}`
                          : subject.name}
                      </option>
                    ))}
                    <option value="new">+ Create a new subject</option>
                  </select>
                </div>
              )}

              {creatingSubject && (
                <div className="rounded-[13px] border border-[var(--line)] bg-[var(--surface-soft)] p-4 sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="new-subject-name"
                        className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                      >
                        Subject name
                      </label>
                      <input
                        id="new-subject-name"
                        value={newSubjectName}
                        onChange={(event) =>
                          setNewSubjectName(event.target.value)
                        }
                        placeholder="e.g. Software Engineering"
                        required
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="new-subject-code"
                        className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                      >
                        Class code
                      </label>
                      <input
                        id="new-subject-code"
                        value={newSubjectCode}
                        onChange={(event) =>
                          setNewSubjectCode(event.target.value)
                        }
                        placeholder="e.g. ITE410L"
                        className="form-input uppercase"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="new-subject-class-code"
                        className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                      >
                        Section code
                      </label>
                      <input
                        id="new-subject-class-code"
                        value={newSubjectClassCode}
                        onChange={(event) =>
                          setNewSubjectClassCode(event.target.value)
                        }
                        placeholder="e.g. CEIT-37-704A"
                        className="form-input uppercase"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="new-subject-instructor"
                        className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                      >
                        Professor
                      </label>
                      <input
                        id="new-subject-instructor"
                        value={newSubjectInstructor}
                        onChange={(event) =>
                          setNewSubjectInstructor(event.target.value)
                        }
                        placeholder="Professor name"
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="new-subject-units"
                        className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                      >
                        Units
                      </label>
                      <input
                        id="new-subject-units"
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        value={newSubjectUnits}
                        onChange={(event) =>
                          setNewSubjectUnits(event.target.value)
                        }
                        placeholder="3"
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="new-subject-term"
                        className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                      >
                        Term
                      </label>
                      <input
                        id="new-subject-term"
                        value={newSubjectTerm}
                        onChange={(event) =>
                          setNewSubjectTerm(event.target.value)
                        }
                        placeholder="1st Semester 2026–2027"
                        className="form-input"
                      />
                    </div>
                  </div>

                  <fieldset className="mt-4">
                    <legend className="mb-2 text-xs font-bold text-[var(--muted-strong)]">
                      Subject color
                    </legend>
                    <div className="flex flex-wrap gap-2.5">
                      {subjectColors.map((option) => (
                        <label
                          key={option}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-full"
                          style={{ backgroundColor: option }}
                        >
                          <input
                            type="radio"
                            name="new-subject-color"
                            value={option}
                            checked={newSubjectColor === option}
                            onChange={() => setNewSubjectColor(option)}
                            className="sr-only"
                          />
                          {newSubjectColor === option && (
                            <Icon
                              name="check"
                              className="h-3.5 w-3.5 text-white"
                            />
                          )}
                          <span className="sr-only">Use color {option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="meeting-section"
          className="border-b border-[var(--line)] p-5 sm:p-7"
        >
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
                Step 2
              </p>
              <h2
                id="meeting-section"
                className="mt-2 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]"
              >
                Set the meeting time
              </h2>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                E-KampusMo will prevent overlapping class meetings on the same
                day.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <fieldset className="sm:col-span-3">
                <legend className="mb-3 text-sm font-bold text-[var(--ink-soft)]">
                  Meeting days
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                  {dayOptions.map((day) => {
                    const checked = selectedDays.includes(day.value);
                    return (
                      <label
                        key={day.value}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-xs font-bold transition ${
                          checked
                            ? "border-blue-300 bg-blue-50 text-[var(--blue)] dark:border-blue-800 dark:bg-blue-950/40"
                            : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted-strong)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedDays((current) =>
                              checked
                                ? current.filter((value) => value !== day.value)
                                : [...current, day.value].sort(),
                            )
                          }
                          className="h-4 w-4 accent-blue-700"
                        />
                        {day.short}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label
                  htmlFor="schedule-start"
                  className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                >
                  Start time
                </label>
                <input
                  id="schedule-start"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div>
                <label
                  htmlFor="schedule-end"
                  className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                >
                  End time
                </label>
                <input
                  id="schedule-end"
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div>
                <label
                  htmlFor="meeting-type"
                  className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                >
                  Meeting type
                </label>
                <select
                  id="meeting-type"
                  value={meetingType}
                  onChange={(event) =>
                    setMeetingType(
                      event.target.value as
                        | "lecture"
                        | "laboratory"
                        | "other",
                    )
                  }
                  className="form-input"
                >
                  <option value="lecture">Lecture</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="meeting-mode"
                  className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                >
                  Class mode
                </label>
                <select
                  id="meeting-mode"
                  value={mode}
                  onChange={(event) =>
                    setMode(
                      event.target.value as
                        | "face-to-face"
                        | "online"
                        | "hybrid",
                    )
                  }
                  className="form-input"
                >
                  <option value="face-to-face">Face-to-face</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="schedule-reminder"
                  className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                >
                  Reminder
                </label>
                <select
                  id="schedule-reminder"
                  value={reminderMinutes}
                  onChange={(event) =>
                    setReminderMinutes(Number(event.target.value))
                  }
                  className="form-input"
                >
                  <option value={0}>No reminder</option>
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="location-section" className="p-5 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
                Step 3
              </p>
              <h2
                id="location-section"
                className="mt-2 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]"
              >
                Add the location
              </h2>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Room details and online links make the Today view actionable.
              </p>
            </div>

            <div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="schedule-room"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Room
                  </label>
                  <input
                    id="schedule-room"
                    value={room}
                    onChange={(event) => setRoom(event.target.value)}
                    placeholder="e.g. Room 402"
                    className="form-input"
                  />
                </div>

                <div>
                  <label
                    htmlFor="schedule-building"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Building
                  </label>
                  <input
                    id="schedule-building"
                    value={building}
                    onChange={(event) => setBuilding(event.target.value)}
                    placeholder="Main Building"
                    className="form-input"
                  />
                </div>

                <div>
                  <label
                    htmlFor="schedule-campus"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Campus
                  </label>
                  <input
                    id="schedule-campus"
                    value={campus}
                    onChange={(event) => setCampus(event.target.value)}
                    placeholder="Main Campus"
                    className="form-input"
                  />
                </div>
              </div>

              {(mode === "online" || mode === "hybrid") && (
                <div className="mt-5">
                  <label
                    htmlFor="meeting-link"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Online meeting link
                  </label>
                  <input
                    id="meeting-link"
                    type="url"
                    value={meetingLink}
                    onChange={(event) => setMeetingLink(event.target.value)}
                    placeholder="https://meet.example.com/..."
                    className="form-input"
                  />
                </div>
              )}

              <div className="mt-5">
                <label
                  htmlFor="schedule-notes"
                  className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                >
                  Notes
                </label>
                <textarea
                  id="schedule-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional class notes"
                  rows={3}
                  className="form-input resize-y"
                />
              </div>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-6 rounded-[10px] border border-red-200 bg-[var(--danger-soft)] px-4 py-3 text-sm leading-5 text-[var(--danger)] dark:border-red-900"
            >
              {error}
            </p>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:justify-end">
            <Link href="/dashboard/calendar" className="secondary-button px-5">
              Cancel
            </Link>
            <button type="submit" className="primary-button px-5">
              Save {selectedDays.length > 1 ? `${selectedDays.length} meetings` : "class schedule"}
            </button>
          </div>
        </section>
      </form>
    </>
  );
}
