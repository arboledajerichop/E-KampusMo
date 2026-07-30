"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Icon from "@/components/Icons";
import { useConfirmation } from "@/components/dashboard/ConfirmationDialog";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import GoogleClassroomImport from "@/components/dashboard/GoogleClassroomImport";
import { useAcademicData } from "@/lib/offline/academic-store";
import {
  addAssignment,
  type AssignmentPriority,
  type AssignmentType,
} from "@/lib/offline/student-work-store";

export default function AssignmentsClient({ userId }: { userId: string }) {
  const confirm = useConfirmation();
  const { subjects } = useAcademicData(userId);
  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AssignmentType>("assignment");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<AssignmentPriority>("medium");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [weightPercent, setWeightPercent] = useState("");
  const [error, setError] = useState("");

  function resetForm() {
    setSubjectId("");
    setTitle("");
    setDescription("");
    setType("assignment");
    setDeadline("");
    setPriority("medium");
    setEstimatedHours("");
    setWeightPercent("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!subjectId || !title.trim() || !deadline) {
      setError("Choose a subject and enter a title and deadline.");
      return;
    }

    const estimatedMinutes = estimatedHours
      ? Math.round(Number(estimatedHours) * 60)
      : null;
    const weight = weightPercent ? Number(weightPercent) : null;

    if (
      estimatedMinutes !== null &&
      (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 1)
    ) {
      setError("Estimated effort must be greater than zero.");
      return;
    }
    if (
      weight !== null &&
      (!Number.isFinite(weight) || weight < 0 || weight > 100)
    ) {
      setError("Academic weight must be between 0 and 100.");
      return;
    }

    const shouldProceed = await confirm({
      title: "Save this assignment?",
      message: `${title.trim()} will be added to your academic records and synchronized with your account.`,
      confirmLabel: "Save assignment",
    });
    if (!shouldProceed) return;

    addAssignment(userId, {
      subjectId,
      title: title.trim(),
      description: description.trim(),
      type,
      deadline: new Date(deadline).toISOString(),
      priority,
      status: "not-started",
      estimatedMinutes,
      weightPercent: weight,
    });
    resetForm();
    setShowForm(false);
  }

  return (
    <>
      <DashboardPageHeader
        eyebrow="Academic work"
        title="Assignments & projects"
        description="See current-semester Classroom work in one timeline, track missing and completed activities, or add work manually."
        action={
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            className="primary-button w-full px-5 sm:w-auto"
          >
            <Icon name="plus" className="h-4 w-4" />
            Add assignment
          </button>
        }
      />

      <GoogleClassroomImport userId={userId} />

      {showForm && (
        <section className="mt-6 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--blue)]">
              New academic task
            </p>
            <h2 className="mt-2 text-xl font-bold text-[var(--ink)]">
              Add an assignment or project
            </h2>
          </div>

          {subjects.length === 0 ? (
            <div className="rounded-[12px] bg-[var(--warning-soft)] p-5">
              <p className="text-sm font-bold text-[var(--warning)]">
                Add a class first
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Class Schedule saves the subject details Assignments needs.
              </p>
              <Link
                href="/dashboard/calendar/new"
                className="secondary-button mt-4 px-4 text-xs"
              >
                Open Class Schedule
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label
                    htmlFor="assignment-subject"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Subject
                  </label>
                  <select
                    id="assignment-subject"
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
                    required
                    className="form-input"
                  >
                    <option value="">Choose a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.code
                          ? `${subject.code} — ${subject.name}`
                          : subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="assignment-title"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Title
                  </label>
                  <input
                    id="assignment-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Database case study"
                    required
                    className="form-input"
                  />
                </div>
                <div>
                  <label
                    htmlFor="assignment-type"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Type
                  </label>
                  <select
                    id="assignment-type"
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as AssignmentType)
                    }
                    className="form-input capitalize"
                  >
                    <option value="assignment">Assignment</option>
                    <option value="project">Project</option>
                    <option value="exam">Exam</option>
                    <option value="quiz">Quiz</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="assignment-deadline"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Deadline
                  </label>
                  <input
                    id="assignment-deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    required
                    className="form-input"
                  />
                </div>
                <div>
                  <label
                    htmlFor="assignment-priority"
                    className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                  >
                    Priority
                  </label>
                  <select
                    id="assignment-priority"
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as AssignmentPriority)
                    }
                    className="form-input capitalize"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="assignment-effort"
                      className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                    >
                      Est. hours
                    </label>
                    <input
                      id="assignment-effort"
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={estimatedHours}
                      onChange={(event) => setEstimatedHours(event.target.value)}
                      placeholder="2"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="assignment-weight"
                      className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                    >
                      Weight %
                    </label>
                    <input
                      id="assignment-weight"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={weightPercent}
                      onChange={(event) => setWeightPercent(event.target.value)}
                      placeholder="10"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="assignment-description"
                  className="mb-2 block text-sm font-bold text-[var(--ink-soft)]"
                >
                  Description
                </label>
                <textarea
                  id="assignment-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Instructions, requirements, or next steps"
                  className="form-input resize-y"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-[10px] border border-red-200 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)] dark:border-red-900"
                >
                  {error}
                </p>
              )}

              <div className="mt-6 flex justify-end">
                <button type="submit" className="primary-button px-5">
                  Save assignment
                </button>
              </div>
            </form>
          )}
        </section>
      )}

    </>
  );
}
