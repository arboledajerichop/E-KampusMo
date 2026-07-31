"use client";

import { useEffect, useRef, useState } from "react";
import { useConfirmation } from "@/components/dashboard/ConfirmationDialog";
import {
  createChecklistItem,
  createNotepadNote,
  deleteNotepadNote,
  getNotepadNotes,
  updateNotepadNote,
  type ChecklistItem,
  type NoteColor,
  type NotepadNote,
  type NoteType,
  type UpdateNotepadNoteInput,
} from "@/lib/notepad";

const noteColors: {
  value: NoteColor;
  label: string;
  className: string;
  swatchClassName: string;
}[] = [
  {
    value: "sage",
    label: "Sage",
    className: "border-[#c3d2bd] bg-[#dfe9da]",
    swatchClassName: "bg-[#afc5a6]",
  },
  {
    value: "yellow",
    label: "Yellow",
    className: "border-[#ddd19a] bg-[#f5edc5]",
    swatchClassName: "bg-[#e6d982]",
  },
  {
    value: "blue",
    label: "Blue",
    className: "border-[#bdd0e5] bg-[#dce9f5]",
    swatchClassName: "bg-[#a9c6e2]",
  },
  {
    value: "pink",
    label: "Pink",
    className: "border-[#dfc0ca] bg-[#f3dfe5]",
    swatchClassName: "bg-[#ddaebd]",
  },
  {
    value: "lavender",
    label: "Lavender",
    className: "border-[#cfc2df] bg-[#e8e0f1]",
    swatchClassName: "bg-[#c4afd9]",
  },
  {
    value: "peach",
    label: "Peach",
    className: "border-[#e1c4a8] bg-[#f4e1ce]",
    swatchClassName: "bg-[#e0b990]",
  },
];

type SaveStatus = "saving" | "saved" | "error";

function getNoteColorClass(color: NoteColor) {
  return (
    noteColors.find((option) => option.value === color)?.className ??
    noteColors[0].className
  );
}

function formatUpdatedDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function NotepadClient() {
  const confirm = useConfirmation();

  const [notes, setNotes] = useState<NotepadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingType, setCreatingType] = useState<NoteType | null>(null);
  const [error, setError] = useState("");
  const [saveStatuses, setSaveStatuses] = useState<
    Record<string, SaveStatus>
  >({});

  const saveTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const pendingUpdates = useRef<
    Record<string, UpdateNotepadNoteInput>
  >({});

  useEffect(() => {
    async function loadNotes() {
      try {
        setLoading(true);
        setError("");

        const loadedNotes = await getNotepadNotes();
        setNotes(loadedNotes);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your notes.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadNotes();

    return () => {
      Object.values(saveTimers.current).forEach((timer) => {
        clearTimeout(timer);
      });
    };
  }, []);

  function queueAutosave(
    noteId: string,
    update: UpdateNotepadNoteInput,
  ) {
    pendingUpdates.current[noteId] = {
      ...pendingUpdates.current[noteId],
      ...update,
    };

    if (saveTimers.current[noteId]) {
      clearTimeout(saveTimers.current[noteId]);
    }

    setSaveStatuses((current) => ({
      ...current,
      [noteId]: "saving",
    }));

    saveTimers.current[noteId] = setTimeout(async () => {
      const pendingUpdate = pendingUpdates.current[noteId];

      delete pendingUpdates.current[noteId];
      delete saveTimers.current[noteId];

      try {
        const savedNote = await updateNotepadNote(
          noteId,
          pendingUpdate,
        );

        setNotes((currentNotes) =>
          currentNotes.map((note) =>
            note.id === savedNote.id ? savedNote : note,
          ),
        );

        setSaveStatuses((current) => ({
          ...current,
          [noteId]: "saved",
        }));

        setTimeout(() => {
          setSaveStatuses((current) => {
            const nextStatuses = { ...current };
            delete nextStatuses[noteId];
            return nextStatuses;
          });
        }, 1500);
      } catch (saveError) {
        setSaveStatuses((current) => ({
          ...current,
          [noteId]: "error",
        }));

        setError(
          saveError instanceof Error
            ? saveError.message
            : "A note could not be saved.",
        );
      }
    }, 700);
  }

  function updateLocalNote(
    noteId: string,
    update: UpdateNotepadNoteInput,
  ) {
    setNotes((currentNotes) =>
      currentNotes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        return {
          ...note,
          ...(update.title !== undefined
            ? { title: update.title }
            : {}),
          ...(update.content !== undefined
            ? { content: update.content }
            : {}),
          ...(update.noteType !== undefined
            ? { noteType: update.noteType }
            : {}),
          ...(update.color !== undefined
            ? { color: update.color }
            : {}),
          ...(update.checklistItems !== undefined
            ? { checklistItems: update.checklistItems }
            : {}),
          updatedAt: new Date().toISOString(),
        };
      }),
    );

    queueAutosave(noteId, update);
  }

  async function handleCreateNote(noteType: NoteType) {
    try {
      setCreatingType(noteType);
      setError("");

      const newNote = await createNotepadNote({
        title: "",
        content: "",
        noteType,
        color: noteType === "checklist" ? "yellow" : "sage",
        checklistItems:
          noteType === "checklist"
            ? [createChecklistItem()]
            : [],
      });

      setNotes((currentNotes) => [newNote, ...currentNotes]);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create a note.",
      );
    } finally {
      setCreatingType(null);
    }
  }

  async function handleDeleteNote(note: NotepadNote) {
  const noteName =
    note.title.trim() ||
    (note.noteType === "checklist"
      ? "Untitled to-do list"
      : "Untitled note");

  const shouldProceed = await confirm({
    title:
      note.noteType === "checklist"
        ? "Delete this to-do list?"
        : "Delete this note?",
    message: `"${noteName}" will be permanently deleted from your Notepad. This action cannot be undone.`,
    confirmLabel:
      note.noteType === "checklist"
        ? "Delete to-do list"
        : "Delete note",
    cancelLabel: "Keep it",
    tone: "danger",
  });

  if (!shouldProceed) {
    return;
  }

  try {
    setError("");

    if (saveTimers.current[note.id]) {
      clearTimeout(saveTimers.current[note.id]);
      delete saveTimers.current[note.id];
    }

    delete pendingUpdates.current[note.id];

    await deleteNotepadNote(note.id);

    setNotes((currentNotes) =>
      currentNotes.filter(
        (currentNote) => currentNote.id !== note.id,
      ),
    );

    setSaveStatuses((currentStatuses) => {
      const nextStatuses = { ...currentStatuses };
      delete nextStatuses[note.id];
      return nextStatuses;
    });
  } catch (deleteError) {
    setError(
      deleteError instanceof Error
        ? deleteError.message
        : "Unable to delete the note.",
    );
  }
}

  function updateChecklist(
    note: NotepadNote,
    checklistItems: ChecklistItem[],
  ) {
    updateLocalNote(note.id, { checklistItems });
  }

  function addChecklistItem(note: NotepadNote) {
    updateChecklist(note, [
      ...note.checklistItems,
      createChecklistItem(),
    ]);
  }

  function updateChecklistText(
    note: NotepadNote,
    itemId: string,
    text: string,
  ) {
    updateChecklist(
      note,
      note.checklistItems.map((item) =>
        item.id === itemId ? { ...item, text } : item,
      ),
    );
  }

  function toggleChecklistItem(
    note: NotepadNote,
    itemId: string,
  ) {
    updateChecklist(
      note,
      note.checklistItems.map((item) =>
        item.id === itemId
          ? { ...item, completed: !item.completed }
          : item,
      ),
    );
  }

  function removeChecklistItem(
    note: NotepadNote,
    itemId: string,
  ) {
    updateChecklist(
      note,
      note.checklistItems.filter((item) => item.id !== itemId),
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:py-10">
      <div className="flex flex-col gap-6 border-b border-[var(--line)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--muted)]">
            Personal workspace / Notes
          </p>

          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-[var(--ink)] sm:text-4xl">
            Notepad
          </h1>

          <p className="mt-3 max-w-[620px] leading-7 text-[var(--muted-strong)]">
            Keep quick notes, important information, errands, and
            to-do lists together. Changes are saved automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleCreateNote("note")}
            disabled={creatingType !== null}
            className="secondary-button px-5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingType === "note" ? "Creating..." : "+ New note"}
          </button>

          <button
            type="button"
            onClick={() => void handleCreateNote("checklist")}
            disabled={creatingType !== null}
            className="primary-button px-5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingType === "checklist"
              ? "Creating..."
              : "+ New to-do list"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-[8px] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-[320px] place-items-center">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
            Loading notes...
          </p>
        </div>
      ) : null}

      {!loading && notes.length === 0 ? (
        <div className="mt-8 grid min-h-[340px] place-items-center rounded-[12px] border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center">
          <div>
            <p className="text-xl font-extrabold text-[var(--ink)]">
              Your notepad is empty.
            </p>

            <p className="mx-auto mt-3 max-w-[430px] leading-7 text-[var(--muted-strong)]">
              Create a regular note for important information or a
              to-do list for errands, school tasks, and shopping.
            </p>
          </div>
        </div>
      ) : null}

      {!loading && notes.length > 0 ? (
        <div className="mt-8 columns-1 gap-5 sm:columns-2 xl:columns-3">
          {notes.map((note) => {
            const saveStatus = saveStatuses[note.id];

            return (
              <article
                key={note.id}
                className={`mb-5 break-inside-avoid overflow-hidden rounded-[12px] border shadow-sm transition-shadow hover:shadow-md ${getNoteColorClass(
                  note.color,
                )}`}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <input
                      type="text"
                      value={note.title}
                      maxLength={120}
                      placeholder={
                        note.noteType === "checklist"
                          ? "To-do list title"
                          : "Note title"
                      }
                      onChange={(event) =>
                        updateLocalNote(note.id, {
                          title: event.target.value,
                        })
                      }
                      className="min-w-0 flex-1 border-0 bg-transparent text-lg font-extrabold tracking-[-0.03em] text-[var(--ink)] outline-none placeholder:text-black/35"
                    />

                    <button
                      type="button"
                      onClick={() => void handleDeleteNote(note)}
                      aria-label="Delete note"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg text-black/45 transition hover:bg-black/10 hover:text-black"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {noteColors.map((colorOption) => (
                      <button
                        key={colorOption.value}
                        type="button"
                        title={colorOption.label}
                        aria-label={`Use ${colorOption.label} color`}
                        aria-pressed={note.color === colorOption.value}
                        onClick={() =>
                          updateLocalNote(note.id, {
                            color: colorOption.value,
                          })
                        }
                        className={`h-6 w-6 rounded-full border-2 transition ${
                          colorOption.swatchClassName
                        } ${
                          note.color === colorOption.value
                            ? "scale-110 border-black"
                            : "border-white/80 hover:scale-105"
                        }`}
                      />
                    ))}
                  </div>

                  {note.noteType === "note" ? (
                    <textarea
                      value={note.content}
                      maxLength={20000}
                      placeholder="Write your note here..."
                      onChange={(event) =>
                        updateLocalNote(note.id, {
                          content: event.target.value,
                        })
                      }
                      className="mt-5 min-h-[180px] w-full resize-y border-0 bg-transparent text-[15px] leading-7 text-[var(--ink)] outline-none placeholder:text-black/35"
                    />
                  ) : (
                    <div className="mt-5 space-y-3">
                      {note.checklistItems.map((item) => (
                        <div
                          key={item.id}
                          className="group flex items-center gap-3"
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() =>
                              toggleChecklistItem(note, item.id)
                            }
                            className="h-4 w-4 shrink-0 accent-black"
                          />

                          <input
                            type="text"
                            value={item.text}
                            placeholder="Add an item"
                            onChange={(event) =>
                              updateChecklistText(
                                note,
                                item.id,
                                event.target.value,
                              )
                            }
                            className={`min-w-0 flex-1 border-0 border-b border-black/10 bg-transparent py-1 text-sm outline-none placeholder:text-black/35 ${
                              item.completed
                                ? "text-black/45 line-through"
                                : "text-[var(--ink)]"
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() =>
                              removeChecklistItem(note, item.id)
                            }
                            aria-label="Remove checklist item"
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-black/35 opacity-0 transition hover:bg-black/10 hover:text-black group-hover:opacity-100 focus:opacity-100"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addChecklistItem(note)}
                        className="mt-2 text-sm font-bold text-black/60 transition hover:text-black"
                      >
                        + Add item
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-black/10 px-5 py-3 font-mono text-[9px] uppercase tracking-[0.08em] text-black/45">
                  <span>
                    {note.noteType === "checklist"
                      ? `${
                          note.checklistItems.filter(
                            (item) => item.completed,
                          ).length
                        }/${note.checklistItems.length} completed`
                      : `Updated ${formatUpdatedDate(note.updatedAt)}`}
                  </span>

                  <span>
                    {saveStatus === "saving"
                      ? "Saving..."
                      : saveStatus === "saved"
                        ? "Saved"
                        : saveStatus === "error"
                          ? "Save failed"
                          : "Auto-save"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}