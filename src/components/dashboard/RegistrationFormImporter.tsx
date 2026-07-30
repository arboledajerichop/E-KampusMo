"use client";

import { useState, type ChangeEvent } from "react";
import Icon from "@/components/Icons";
import { useConfirmation } from "@/components/dashboard/ConfirmationDialog";
import {
  addSchedules,
  addSubject,
  dayOptions,
  isSameAcademicCourse,
  updateSubject,
  useAcademicData,
} from "@/lib/offline/academic-store";
import {
  createBlankImportedCourse,
  extractRegistrationFormText,
  parseRegistrationFormText,
  type ImportedCourseDraft,
} from "@/lib/schedule/registration-form-reader";
import {
  saveClassScheduleIdentity,
  type ClassScheduleIdentity,
} from "@/lib/schedule/class-schedule-template";
import { subjectPastels } from "@/lib/schedule/subject-colors";

const subjectColors = subjectPastels.map((pastel) => pastel.accent);

export default function RegistrationFormImporter({
  userId,
}: {
  userId: string;
}) {
  const confirm = useConfirmation();
  const { subjects, schedules } = useAcademicData(userId);
  const [showImporter, setShowImporter] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [fileName, setFileName] = useState("");
  const [identity, setIdentity] = useState<ClassScheduleIdentity>({
    studentName: "",
    studentNumber: "",
    program: "",
    term: "",
  });
  const [courses, setCourses] = useState<ImportedCourseDraft[]>([]);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateCourse(
    courseId: string,
    values: Partial<ImportedCourseDraft>,
  ) {
    setCourses((current) =>
      current.map((course) =>
        course.id === courseId ? { ...course, ...values } : course,
      ),
    );
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProcessing(true);
    setError("");
    setSuccess("");
    setFileName(file.name);
    setProgress("Opening registration form…");
    try {
      const text = await extractRegistrationFormText(file, setProgress);
      if (!text.trim()) {
        throw new Error(
          "No printed text was detected. Try a clearer image or text-based PDF.",
        );
      }
      const parsed = parseRegistrationFormText(text);
      setIdentity(parsed.identity);
      setCourses(parsed.courses);
      setRawText(parsed.rawText);
      setProgress("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The registration form could not be read.",
      );
      setProgress("");
    } finally {
      setProcessing(false);
    }
  }

  async function saveImportedSchedule() {
    setError("");
    setSuccess("");
    const validatedCourses: Array<{
      course: ImportedCourseDraft;
      subjectName: string;
      subjectCode: string;
      classCode: string;
      units: number | null;
    }> = [];
    const plannedMeetings: Array<{
      courseId: string;
      subjectName: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room: string;
    }> = [];

    for (const [index, course] of courses.entries()) {
      const subjectName =
        course.subjectName.trim() ||
        course.subjectCode.trim() ||
        `Imported subject ${index + 1}`;
      if (course.dayOfWeeks.length === 0) {
        setError(`Choose at least one meeting day for ${subjectName}.`);
        return;
      }
      if (
        !course.startTime ||
        !course.endTime ||
        course.startTime >= course.endTime
      ) {
        setError(`Check the start and end time for ${subjectName}.`);
        return;
      }
      const units = course.units ? Number(course.units) : null;
      if (
        units !== null &&
        (!Number.isFinite(units) || units < 0 || units > 20)
      ) {
        setError(`Units for ${subjectName} must be between 0 and 20.`);
        return;
      }

      const normalizedSubjectCode = course.subjectCode.trim().toUpperCase();
      const normalizedClassCode = course.classCode.trim().toUpperCase();
      validatedCourses.push({
        course,
        subjectName,
        subjectCode: normalizedSubjectCode,
        classCode: normalizedClassCode,
        units,
      });

      for (const dayOfWeek of course.dayOfWeeks) {
        const conflict = [...schedules, ...plannedMeetings].find(
          (meeting) =>
            meeting.dayOfWeek === dayOfWeek &&
            course.startTime < meeting.endTime &&
            course.endTime > meeting.startTime,
        );
        if (conflict) {
          const dayLabel =
            dayOptions.find((day) => day.value === dayOfWeek)?.label ??
            "Selected day";
          setError(
            `${subjectName} overlaps another class on ${dayLabel} from ${conflict.startTime} to ${conflict.endTime}.`,
          );
          return;
        }
        plannedMeetings.push({
          courseId: course.id,
          subjectName,
          dayOfWeek,
          startTime: course.startTime,
          endTime: course.endTime,
          room: course.room.trim(),
        });
      }
    }

    const shouldProceed = await confirm({
      title: "Import this class schedule?",
      message: `${plannedMeetings.length} meeting${
        plannedMeetings.length === 1 ? "" : "s"
      } from ${validatedCourses.length} reviewed subject${
        validatedCourses.length === 1 ? "" : "s"
      } will be added and synchronized with your account.`,
      confirmLabel: "Import schedule",
    });
    if (!shouldProceed) return;

    const workingSubjects = [...subjects];
    const subjectIdByCourseId = new Map<string, string>();
    for (const [index, validated] of validatedCourses.entries()) {
      const { course, subjectName, subjectCode, classCode, units } = validated;
      const existingIndex = workingSubjects.findIndex(
        (item) =>
          isSameAcademicCourse(item, {
            code: subjectCode,
            name: subjectName,
          }),
      );
      const existing =
        existingIndex >= 0 ? workingSubjects[existingIndex] : null;
      const savedSubject = existing
        ? (updateSubject(userId, existing.id, {
            name: course.subjectName.trim() || existing.name,
            code: subjectCode || existing.code,
            classCode: classCode || existing.classCode,
            instructorName:
              course.instructorName.trim() || existing.instructorName,
            units: units ?? existing.units,
            term: identity.term.trim() || existing.term,
          }) ?? existing)
        : addSubject(userId, {
            name: subjectName,
            code: subjectCode,
            classCode,
            instructorName: course.instructorName.trim(),
            units,
            color:
              subjectColors[
                (subjects.length + index) % subjectColors.length
              ],
            term: identity.term.trim(),
          });
      if (existingIndex >= 0) {
        workingSubjects[existingIndex] = savedSubject;
      } else {
        workingSubjects.push(savedSubject);
      }
      subjectIdByCourseId.set(course.id, savedSubject.id);
    }

    saveClassScheduleIdentity(userId, identity);
    addSchedules(
      userId,
      plannedMeetings.flatMap((meeting) => {
        const subjectId = subjectIdByCourseId.get(meeting.courseId);
        return subjectId
          ? [
              {
                subjectId,
                dayOfWeek: meeting.dayOfWeek,
                startTime: meeting.startTime,
                endTime: meeting.endTime,
                meetingType: "lecture" as const,
                room: meeting.room,
                building: "",
                campus: "",
                mode: "face-to-face" as const,
                meetingLink: "",
                reminderMinutes: 15,
                notes: "Imported from a registration form",
              },
            ]
          : [];
      }),
    );
    setSuccess(
      `${plannedMeetings.length} meeting${
        plannedMeetings.length === 1 ? "" : "s"
      } added. The source file and extracted text were not uploaded or saved.`,
    );
    setCourses([]);
    setRawText("");
    setFileName("");
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--teal)]">
            Private document import
          </p>
          <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">
            Read a registration form
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">
            PDF and image text is read in your browser. The document and raw
            extracted text are never sent to Supabase. You review every field
            before confirmed schedule rows are saved.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowImporter((current) => !current);
            setError("");
            setSuccess("");
          }}
          className="secondary-button shrink-0 px-5"
        >
          <Icon name={showImporter ? "arrow" : "device"} className="h-4 w-4" />
          {showImporter ? "Close importer" : "Import registration form"}
        </button>
      </div>

      {showImporter && (
        <div className="border-t border-[var(--line)] p-5 sm:p-6">
          <label className="grid cursor-pointer place-items-center rounded-[13px] border border-dashed border-blue-300 bg-blue-50/60 px-5 py-8 text-center dark:border-blue-800 dark:bg-blue-950/20">
            <Icon name="folder" className="h-7 w-7 text-[var(--blue)]" />
            <span className="mt-3 text-sm font-bold text-[var(--ink)]">
              Choose registration form
            </span>
            <span className="mt-1 text-xs text-[var(--muted)]">
              PDF, PNG, JPG, TXT, or CSV · printed text works best
            </span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,application/pdf,image/png,image/jpeg,text/plain,text/csv"
              onChange={handleFile}
              disabled={processing}
              className="sr-only"
            />
          </label>

          {(processing || progress) && (
            <p
              role="status"
              className="mt-4 rounded-[10px] bg-[var(--surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--blue)]"
            >
              {progress || "Reading registration form…"}
            </p>
          )}

          {courses.length > 0 && (
            <>
              <div className="mt-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--blue)]">
                      Review extracted details
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-[var(--ink)]">
                      Verify before saving
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{fileName}</p>
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
                        onChange={(event) =>
                          setIdentity((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        placeholder={placeholder}
                        className="form-input mt-2"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {courses.map((course, index) => (
                  <article
                    key={course.id}
                    className="rounded-[13px] border border-[var(--line)] bg-[var(--surface-soft)] p-4 sm:p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-sm font-bold text-[var(--ink)]">
                        Extracted course {index + 1}
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setCourses((current) =>
                            current.filter((item) => item.id !== course.id),
                          )
                        }
                        className="text-xs font-bold text-[var(--danger)] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {(
                        [
                          [
                            "subjectName",
                            "Subject description",
                            "Cooperative Education in Industry 2",
                          ],
                          ["subjectCode", "Class code", "ITE410L"],
                          ["classCode", "Section code", "CEIT-37-704A"],
                          ["units", "Units", "3"],
                          ["instructorName", "Professor", "Professor name"],
                          ["room", "Room", "Room 402"],
                        ] as const
                      ).map(([key, label, placeholder]) => (
                        <label
                          key={key}
                          className="text-xs font-bold text-[var(--ink-soft)]"
                        >
                          {label}
                          <input
                            type={key === "units" ? "number" : "text"}
                            min={key === "units" ? "0" : undefined}
                            max={key === "units" ? "20" : undefined}
                            step={key === "units" ? "0.5" : undefined}
                            value={course[key]}
                            onChange={(event) =>
                              updateCourse(course.id, {
                                [key]: event.target.value,
                              })
                            }
                            placeholder={placeholder}
                            className="form-input mt-2"
                          />
                        </label>
                      ))}
                      <label className="text-xs font-bold text-[var(--ink-soft)]">
                        Start time
                        <input
                          type="time"
                          value={course.startTime}
                          onChange={(event) =>
                            updateCourse(course.id, {
                              startTime: event.target.value,
                            })
                          }
                          className="form-input mt-2"
                        />
                      </label>
                      <label className="text-xs font-bold text-[var(--ink-soft)]">
                        End time
                        <input
                          type="time"
                          value={course.endTime}
                          onChange={(event) =>
                            updateCourse(course.id, {
                              endTime: event.target.value,
                            })
                          }
                          className="form-input mt-2"
                        />
                      </label>
                    </div>
                    <fieldset className="mt-4">
                      <legend className="mb-2 text-xs font-bold text-[var(--ink-soft)]">
                        Meeting days
                      </legend>
                      <p className="mb-3 text-[11px] leading-4 text-[var(--muted)]">
                        M Monday · T Tuesday · W Wednesday · H Thursday · F
                        Friday · S Saturday · U Sunday
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {dayOptions.map((day) => {
                          const checked = course.dayOfWeeks.includes(day.value);
                          return (
                            <label
                              key={day.value}
                              className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-bold ${
                                checked
                                  ? "border-blue-300 bg-blue-50 text-[var(--blue)] dark:border-blue-800 dark:bg-blue-950/40"
                                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  updateCourse(course.id, {
                                    dayOfWeeks: checked
                                      ? course.dayOfWeeks.filter(
                                          (value) => value !== day.value,
                                        )
                                      : [...course.dayOfWeeks, day.value].sort(),
                                  })
                                }
                                className="sr-only"
                              />
                              {day.short}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </article>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setCourses((current) => [
                      ...current,
                      createBlankImportedCourse(),
                    ])
                  }
                  className="secondary-button px-4"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Add missing course
                </button>
                {rawText && (
                  <details className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4">
                    <summary className="cursor-pointer text-xs font-bold text-[var(--muted-strong)]">
                      View extracted text for troubleshooting
                    </summary>
                    <textarea
                      value={rawText}
                      readOnly
                      rows={8}
                      className="form-input mt-3 resize-y font-mono text-xs"
                    />
                  </details>
                )}
              </div>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-[10px] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
            >
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="mt-5 rounded-[10px] bg-[var(--teal-soft)] px-4 py-3 text-sm text-[var(--teal)]"
            >
              {success}
            </p>
          )}

          {courses.length > 0 && (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void saveImportedSchedule()}
                className="primary-button px-5"
              >
                Save reviewed schedule
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
