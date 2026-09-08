/**
 * Voice notes.
 *
 * The audio is a real file on the server, not a blob field — recordings are
 * fetched per note, on demand, so listing a hundred of them stays cheap.
 *
 * Mirrors `zaffarology-mobileapp/src/lib/voice-notes-api.ts`. The one real
 * difference is the upload body: mobile hands React Native a `{uri}` shim, the
 * browser has an actual `Blob` from `MediaRecorder`.
 *
 * **Container support was verified before any of this was built.** The backend
 * decides the type from the file's magic bytes and already recognises WebM
 * (Chrome/Firefox), MP4 (Safari) and Ogg — so no backend change was needed for
 * browser audio. It ignores the client's Content-Type entirely, which is why
 * `MediaRecorder`'s `;codecs=opus` suffix is harmless.
 */
import { api, requestBlob } from "@/lib/api";

/** Two minutes, matching mobile. The server's 4 MB cap is far above what any
 *  browser codec produces in that time (opus at 128 kbps is ~1.8 MB). */
export const MAX_RECORDING_MS = 120_000;

export interface ApiVoiceNote {
  id: number;
  title: string;
  duration_ms: number;
  size_bytes: number;
  mime: string;
  /** The typed note this belongs to, or null for a standalone recording. */
  note_id: number | null;
  /** The meeting this belongs to, or null. A recording has at most one owner. */
  meeting_id: number | null;
  created_at: string | null;
}

/**
 * Metadata only — the audio is fetched per note, on demand.
 *
 * `noteId` narrows to one note's recordings; `standalone` returns only the ones
 * not attached to any note, which is what the Notes tab's own recorder shows.
 * Without that split a note's audio would be listed twice.
 */
export async function loadVoiceNotes(opts?: {
  noteId?: number;
  meetingId?: number;
  standalone?: boolean;
}): Promise<ApiVoiceNote[]> {
  const parts: string[] = [];
  if (opts?.noteId != null) parts.push(`note_id=${opts.noteId}`);
  if (opts?.meetingId != null) parts.push(`meeting_id=${opts.meetingId}`);
  if (opts?.standalone) parts.push("standalone=true");
  const data = await api.get<{ notes: ApiVoiceNote[] }>(
    `/voice-notes${parts.length ? `?${parts.join("&")}` : ""}`,
  );
  return data?.notes ?? [];
}

/** File extension for what the browser actually recorded, for a truthful
 *  filename. The server identifies the file by its bytes regardless. */
const extFor = (mime: string): string => {
  const base = mime.split(";")[0].trim();
  if (base.includes("webm")) return "webm";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("wav")) return "wav";
  if (base.includes("mpeg")) return "mp3";
  return "m4a";
};

export async function uploadVoiceNote(input: {
  blob: Blob;
  title: string;
  durationMs: number;
  /** Attach to a typed note. Omitted = a standalone recording. */
  noteId?: number;
  /** Attach to a meeting instead. */
  meetingId?: number;
}): Promise<ApiVoiceNote> {
  const form = new FormData();
  const mime = input.blob.type || "audio/webm";
  form.append("audio", input.blob, `voice-note.${extFor(mime)}`);
  form.append("title", input.title);
  form.append("duration_ms", String(Math.round(input.durationMs)));
  if (input.noteId != null) form.append("note_id", String(input.noteId));
  if (input.meetingId != null) form.append("meeting_id", String(input.meetingId));
  return api.upload<ApiVoiceNote>("/voice-notes", form);
}

/** The playback path. It needs the auth header, so the audio is fetched through
 *  the client and handed to the player as an object URL rather than being set
 *  as a plain `src` — a bare <audio src> sends no Authorization and 401s. */
export function voiceNoteAudioPath(id: number): string {
  return `/voice-notes/${id}/audio`;
}

/** Fetch one recording's audio as a Blob, ready for `URL.createObjectURL`. */
export async function loadVoiceNoteAudio(id: number): Promise<Blob> {
  return requestBlob(voiceNoteAudioPath(id));
}

export async function renameVoiceNote(id: number, title: string): Promise<void> {
  await api.patch(`/voice-notes/${id}`, { title });
}

export async function restoreVoiceNote(id: number): Promise<ApiVoiceNote> {
  return api.post<ApiVoiceNote>(`/voice-notes/${id}/restore`);
}

export async function deleteVoiceNote(id: number): Promise<void> {
  await api.del(`/voice-notes/${id}`);
}
