"use client";

import { createClient } from "@/lib/supabase/client";

export type NoteType = "note" | "checklist";

export type NoteColor =
  | "sage"
  | "yellow"
  | "blue"
  | "pink"
  | "lavender"
  | "peach";

export type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type NotepadNote = {
  id: string;
  userId: string;
  title: string;
  content: string;
  noteType: NoteType;
  color: NoteColor;
  checklistItems: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
};

export type CreateNotepadNoteInput = {
  title?: string;
  content?: string;
  noteType?: NoteType;
  color?: NoteColor;
  checklistItems?: ChecklistItem[];
};

export type UpdateNotepadNoteInput = {
  title?: string;
  content?: string;
  noteType?: NoteType;
  color?: NoteColor;
  checklistItems?: ChecklistItem[];
};

type NotepadNoteRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  note_type: NoteType;
  color: NoteColor;
  checklist_items: unknown;
  created_at: string;
  updated_at: string;
};

function normalizeChecklistItems(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => {
      if (typeof item !== "object" || item === null) {
        return false;
      }

      const checklistItem = item as Partial<ChecklistItem>;

      return (
        typeof checklistItem.id === "string" &&
        typeof checklistItem.text === "string" &&
        typeof checklistItem.completed === "boolean"
      );
    })
    .map((item) => item as ChecklistItem);
}

function mapNotepadNote(row: NotepadNoteRow): NotepadNote {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    noteType: row.note_type,
    color: row.color,
    checklistItems: normalizeChecklistItems(row.checklist_items),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be logged in to use the Notepad.");
  }

  return user.id;
}

export async function getNotepadNotes(): Promise<NotepadNote[]> {
  const supabase = createClient();
  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("notepad_notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as NotepadNoteRow[]).map(mapNotepadNote);
}

export async function createNotepadNote(
  input: CreateNotepadNoteInput = {},
): Promise<NotepadNote> {
  const supabase = createClient();
  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("notepad_notes")
    .insert({
      user_id: userId,
      title: input.title?.trim() ?? "",
      content: input.content ?? "",
      note_type: input.noteType ?? "note",
      color: input.color ?? "sage",
      checklist_items: input.checklistItems ?? [],
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapNotepadNote(data as NotepadNoteRow);
}

export async function updateNotepadNote(
  noteId: string,
  input: UpdateNotepadNoteInput,
): Promise<NotepadNote> {
  const supabase = createClient();
  const userId = await getAuthenticatedUserId();

  const updateData: {
    title?: string;
    content?: string;
    note_type?: NoteType;
    color?: NoteColor;
    checklist_items?: ChecklistItem[];
  } = {};

  if (input.title !== undefined) {
    updateData.title = input.title.trim();
  }

  if (input.content !== undefined) {
    updateData.content = input.content;
  }

  if (input.noteType !== undefined) {
    updateData.note_type = input.noteType;
  }

  if (input.color !== undefined) {
    updateData.color = input.color;
  }

  if (input.checklistItems !== undefined) {
    updateData.checklist_items = input.checklistItems;
  }

  const { data, error } = await supabase
    .from("notepad_notes")
    .update(updateData)
    .eq("id", noteId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapNotepadNote(data as NotepadNoteRow);
}

export async function deleteNotepadNote(
  noteId: string,
): Promise<void> {
  const supabase = createClient();
  const userId = await getAuthenticatedUserId();

  const { error } = await supabase
    .from("notepad_notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export function createChecklistItem(
  text = "",
): ChecklistItem {
  return {
    id: crypto.randomUUID(),
    text,
    completed: false,
  };
}