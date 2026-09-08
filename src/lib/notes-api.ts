/**
 * Notes and meeting notes.
 *
 * These are real rows, NOT a pillar blob. The pillars mirror a paper workbook
 * where the client owns each page's shape; notes and meetings are records the
 * user filters and searches, and `PUT /v3/pillars/{key}` replaces a whole
 * document with no version check — so editing two notes on two devices would
 * have one silently overwrite the other. A row per note removes that.
 *
 * Types and endpoints mirror `zaffarology-mobileapp/src/lib/notes-api.ts`
 * exactly; only the transport differs (this app's fetch wrapper rather than
 * axios). Same backend, same rows, same accounts.
 */
import { api } from "@/lib/api";

/** A filter, not a permission. */
export type NoteTag = "personal" | "business";

export interface ApiNote {
  id: number;
  title: string;
  body: string;
  tag: NoteTag;
  pinned: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApiMeeting {
  id: number;
  title: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Free text — "2:30pm", "after lunch". */
  time: string;
  place: string;
  agenda: string;
  notes: string;
  decisions: string;
  next_steps: string;
  /** Names as typed, including people with no account. */
  attendees: string;
  /** Ids of the attendees who are connections. */
  attendee_ids: number[];
  tag: NoteTag;
  created_at: string | null;
  updated_at: string | null;
}

/** `?tag=` only when filtering, so the server sees no empty param. */
const q = (tag?: NoteTag) => (tag ? `?tag=${encodeURIComponent(tag)}` : "");

/* -------------------------------- notes -------------------------------- */

export async function loadNotes(tag?: NoteTag): Promise<ApiNote[]> {
  const data = await api.get<{ notes: ApiNote[] }>(`/notes${q(tag)}`);
  return data?.notes ?? [];
}

export async function createNote(input: Partial<ApiNote>): Promise<ApiNote> {
  return api.post<ApiNote>("/notes", {
    title: input.title ?? "",
    body: input.body ?? "",
    tag: input.tag ?? "personal",
    pinned: input.pinned ?? false,
  });
}

/** Sends ONLY what changed — the server treats absent fields as untouched. */
export async function updateNote(id: number, patch: Partial<ApiNote>): Promise<ApiNote> {
  return api.patch<ApiNote>(`/notes/${id}`, patch);
}

export async function deleteNote(id: number): Promise<void> {
  await api.del(`/notes/${id}`);
}

/** Undo a delete. The row was never destroyed, so this just un-hides it. */
export async function restoreNote(id: number): Promise<ApiNote> {
  return api.post<ApiNote>(`/notes/${id}/restore`);
}

/* ------------------------------- meetings ------------------------------ */

export async function loadMeetings(tag?: NoteTag): Promise<ApiMeeting[]> {
  const data = await api.get<{ meetings: ApiMeeting[] }>(`/notes/meetings${q(tag)}`);
  return data?.meetings ?? [];
}

export async function createMeeting(input: Partial<ApiMeeting>): Promise<ApiMeeting> {
  return api.post<ApiMeeting>("/notes/meetings", {
    title: input.title ?? "",
    date: input.date ?? "",
    time: input.time ?? "",
    place: input.place ?? "",
    agenda: input.agenda ?? "",
    notes: input.notes ?? "",
    decisions: input.decisions ?? "",
    next_steps: input.next_steps ?? "",
    attendees: input.attendees ?? "",
    attendee_ids: input.attendee_ids ?? [],
    tag: input.tag ?? "business",
  });
}

export async function updateMeeting(
  id: number,
  patch: Partial<ApiMeeting>,
): Promise<ApiMeeting> {
  return api.patch<ApiMeeting>(`/notes/meetings/${id}`, patch);
}

export async function deleteMeeting(id: number): Promise<void> {
  await api.del(`/notes/meetings/${id}`);
}

/** Undo a delete. Recordings that went with the meeting come back too. */
export async function restoreMeeting(id: number): Promise<ApiMeeting> {
  return api.post<ApiMeeting>(`/notes/meetings/${id}/restore`);
}
