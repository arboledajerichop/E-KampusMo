"use client";

import { useState, type FormEvent, type MouseEvent } from "react";
import Icon from "@/components/Icons";
import {
  dayOptions,
  findScheduleConflict,
  updateSchedule,
  updateSubject,
  type ClassSchedule,
  type Subject,
} from "@/lib/offline/academic-store";

function isValidMeetingLink(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function EditClassDialog({
  userId,
  subject,
  schedule,
  schedules,
  onClose,
}: {
  userId: string;
  subject: Subject;
  schedule: ClassSchedule;
  schedules: ClassSchedule[];
  onClose: () => void;
}) {
  const [subjectName, setSubjectName] = useState(subject.name);
  const [classCode, setClassCode] = useState(subject.code);
  const [sectionCode, setSectionCode] = useState(subject.classCode);
  const [units, setUnits] = useState(
    subject.units === null ? "" : String(subject.units),
  );
  const [professor, setProfessor] = useState(subject.instructorName);
  const [term, setTerm] = useState(subject.term);
  const [dayOfWeek, setDayOfWeek] = useState(schedule.dayOfWeek);
  const [startTime, setStartTime] = useState(schedule.startTime);
  const [endTime, setEndTime] = useState(schedule.endTime);
  const [meetingType, setMeetingType] = useState(schedule.meetingType);
  const [mode, setMode] = useState(schedule.mode);
  const [room, setRoom] = useState(schedule.room);
  const [building, setBuilding] = useState(schedule.building);
  const [campus, setCampus] = useState(schedule.campus);
  const [meetingLink, setMeetingLink] = useState(schedule.meetingLink);
  const [notes, setNotes] = useState(schedule.notes);
  const [error, setError] = useState("");

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!subjectName.trim()) {
      setError("Enter the subject description.");
      return;
    }
    if (!startTime || !endTime || startTime >= endTime) {
      setError("The end time must be later than the start time.");
      return;
    }
    const parsedUnits = units === "" ? null : Number(units);
    if (
      parsedUnits !== null &&
      (!Number.isFinite(parsedUnits) || parsedUnits < 0 || parsedUnits > 20)
    ) {
      setError("Units must be between 0 and 20.");
      return;
    }
    if (!isValidMeetingLink(meetingLink.trim())) {
      setError("Enter a complete meeting link beginning with http:// or https://.");
      return;
    }
    const conflict = findScheduleConflict(
      schedules.filter((item) => item.id !== schedule.id),
      dayOfWeek,
      startTime,
      endTime,
    );
    if (conflict) {
      const dayLabel =
        dayOptions.find((day) => day.value === dayOfWeek)?.label ??
        "Selected day";
      setError(
        `${dayLabel} overlaps another class from ${conflict.startTime} to ${conflict.endTime}.`,
      );
      return;
    }

    updateSubject(userId, subject.id, {
      name: subjectName.trim(),
      code: classCode.trim().toUpperCase(),
      classCode: sectionCode.trim().toUpperCase(),
      instructorName: professor.trim(),
      units: parsedUnits,
      color: subject.color,
      term: term.trim(),
    });
    updateSchedule(userId, schedule.id, {
      subjectId: schedule.subjectId,
      dayOfWeek,
      startTime,
      endTime,
      meetingType,
      room: room.trim(),
      building: building.trim(),
      campus: campus.trim(),
      mode,
      meetingLink: meetingLink.trim(),
      reminderMinutes: schedule.reminderMinutes,
      notes: notes.trim(),
    });
    onClose();
  }

  return (
    <div
      role="presentation"
      onMouseDown={handleBackdrop}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px] sm:p-8"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-class-heading"
        className="mx-auto max-w-3xl overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-5 border-b border-[var(--line)] p-5 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
              Update imported class
            </p>
            <h2
              id="edit-class-heading"
              className="mt-2 text-xl font-bold text-[var(--ink)]"
            >
              Edit class information
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-[var(--muted)]">
              Course details update every meeting linked to this subject.
              Schedule and location changes apply only to this meeting.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit class form"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] text-lg text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6">
          <fieldset>
            <legend className="text-sm font-bold text-[var(--ink)]">
              Course details
            </legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-[var(--ink-soft)] sm:col-span-2">
                Subject description
                <input
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  required
                  className="form-input mt-2"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Class code
                <input
                  value={classCode}
                  onChange={(event) => setClassCode(event.target.value)}
                  placeholder="e.g. ITE410L"
                  className="form-input mt-2 uppercase"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Section code
                <input
                  value={sectionCode}
                  onChange={(event) => setSectionCode(event.target.value)}
                  placeholder="e.g. CEIT-37-704A"
                  className="form-input mt-2 uppercase"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Units
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={units}
                  onChange={(event) => setUnits(event.target.value)}
                  className="form-input mt-2"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Professor
                <input
                  value={professor}
                  onChange={(event) => setProfessor(event.target.value)}
                  placeholder="Professor name"
                  className="form-input mt-2"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)] sm:col-span-2">
                Term
                <input
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="e.g. 2026-1S"
                  className="form-input mt-2"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-7 border-t border-[var(--line)] pt-6">
            <legend className="text-sm font-bold text-[var(--ink)]">
              This meeting
            </legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Meeting day
                <select
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(Number(event.target.value))}
                  className="form-input mt-2"
                >
                  {dayOptions.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Start time
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  required
                  className="form-input mt-2"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                End time
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  required
                  className="form-input mt-2"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Meeting type
                <select
                  value={meetingType}
                  onChange={(event) =>
                    setMeetingType(
                      event.target.value as ClassSchedule["meetingType"],
                    )
                  }
                  className="form-input mt-2"
                >
                  <option value="lecture">Lecture</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Class mode
                <select
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as ClassSchedule["mode"])
                  }
                  className="form-input mt-2"
                >
                  <option value="face-to-face">Face-to-face</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Room
                <input
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  placeholder="e.g. ITC-111"
                  className="form-input mt-2"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Building
                <input
                  value={building}
                  onChange={(event) => setBuilding(event.target.value)}
                  className="form-input mt-2"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)]">
                Campus
                <input
                  value={campus}
                  onChange={(event) => setCampus(event.target.value)}
                  className="form-input mt-2"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)] lg:col-span-2">
                Meeting link
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(event) => setMeetingLink(event.target.value)}
                  placeholder="https://..."
                  className="form-input mt-2"
                />
              </label>
              <label className="text-xs font-bold text-[var(--ink-soft)] sm:col-span-2 lg:col-span-3">
                Notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="form-input mt-2 resize-y"
                />
              </label>
            </div>
          </fieldset>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-[10px] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
            >
              {error}
            </p>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button px-5"
            >
              Cancel
            </button>
            <button type="submit" className="primary-button px-5">
              <Icon name="edit" className="h-4 w-4" />
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
