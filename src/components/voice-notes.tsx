"use client";

/**
 * Recording and playing voice notes in the browser.
 *
 * Ports `zaffarology-mobileapp/src/components/voice-notes.tsx` onto
 * `MediaRecorder`. What differs is forced by the platform:
 *
 *  - the container is whatever the browser gives (webm/opus on Chrome and
 *    Firefox, mp4/aac on Safari). The backend identifies audio by its magic
 *    bytes and already accepts all of them — verified before this was built.
 *  - the microphone needs a user gesture AND a secure context. On plain HTTP
 *    `navigator.mediaDevices` is simply absent, so that is detected and
 *    explained rather than failing at the click.
 *  - playback fetches the audio through the API client (it needs the auth
 *    header) and plays it from an object URL. A bare `<audio src>` sends no
 *    Authorization and 401s.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { Check, Close, Mic, Pause, Play, Trash } from "@/components/icons";
import { cx } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";
import { friendlyTimestamp } from "@/lib/dates";
import { reportError } from "@/lib/error-reporting";
import { useDialog } from "@/components/dialog";
import {
  MAX_RECORDING_MS,
  deleteVoiceNote,
  loadVoiceNoteAudio,
  loadVoiceNotes,
  renameVoiceNote,
  retagVoiceNote,
  uploadVoiceNote,
  type ApiVoiceNote,
  type VoiceTag,
} from "@/lib/voice-notes-api";

const mmss = (ms: number) => {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** A stray click gives a fraction of a second of silence; uploading it would
 *  just clutter the list. */
const MIN_RECORDING_MS = 800;

/* No weekday, and the year kept: a recording's name is a VALUE that sits in a
   list beside every other date in the app, all of which read "5 Aug 2026" since
   `friendlyISO` dropped the weekday. "Monday, 31 Aug" also lost the year, so two
   recordings a year apart were named identically. */
const suggestedName = () =>
  new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Best container this browser will actually produce. Ordered by preference:
 *  opus is small and well supported, mp4 is Safari's only option. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return undefined; // let the browser choose
}

type Pending = { blob: Blob; ms: number };

export function VoiceNotes({
  noteId,
  meetingId,
  compact = false,
  onCountChange,
  filter = null,
}: {
  noteId?: number;
  meetingId?: number;
  compact?: boolean;
  onCountChange?: (n: number) => void;
  /**
   * The Notes screen's own Personal / Business filter, passed straight through.
   * `null` = All.
   *
   * There is deliberately no filter control inside this component: the screen
   * has ONE filter and it governs notes, meetings and recordings together.
   * Picking "Business" should show business notes AND business recordings, not
   * make the user set the same thing twice in two places.
   */
  filter?: VoiceTag | null;
}) {
  const dialog = useDialog();
  const [notes, setNotes] = useState<ApiVoiceNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  /** Clicked, but the browser has not yet answered the permission prompt.
   *  `recording` only turns true AFTER getUserMedia resolves, so without
   *  this the button sat idle and enabled while the prompt was open. */
  const [awaiting, setAwaiting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);

  /** A new recording takes the active filter's tag, so making one while
   *  "Business" is selected does not immediately hide it. Under "All" it falls
   *  back to personal, matching what the screen does for a new note. */
  const tag: VoiceTag = filter ?? "personal";

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const standalone = noteId == null && meetingId == null;

  const refresh = useCallback(async () => {
    try {
      setNotes(
        await loadVoiceNotes({
          noteId,
          meetingId,
          standalone,
          // Under "All" no tag is sent, so every recording comes back.
          tag: standalone ? filter ?? undefined : undefined,
        }),
      );
    } catch (err) {
      setError("Could not load your recordings.");
      reportError(err, { area: "voice-notes-load" });
    } finally {
      setLoaded(true);
    }
  }, [noteId, meetingId, standalone, filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (loaded) onCountChange?.(notes.length);
  }, [loaded, notes.length, onCountChange]);

  /** Release the object URL and stop the mic when this unmounts — a live
   *  MediaStream keeps the browser's recording indicator on. */
  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const canRecord =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const start = async () => {
    setError(null);
    if (!canRecord) {
      setError(
        window.isSecureContext === false
          ? "Recording needs a secure (https) connection."
          : "This browser cannot record audio.",
      );
      return;
    }
    setAwaiting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const ms = Date.now() - startedRef.current;
        // Always release the microphone, whatever happens next.
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (ms < MIN_RECORDING_MS || !blob.size) {
          setError("That was too short. Hold on a moment longer.");
          return;
        }
        // Ask for a name before uploading, pre-filled with the date so
        // accepting it is one click and naming it properly is a few more.
        setPending({ blob, ms });
        setTitle(suggestedName());
      };
      recorderRef.current = rec;
      startedRef.current = Date.now();
      rec.start();
      setRecording(true);
      setElapsed(0);
      tickRef.current = setInterval(() => {
        const ms = Date.now() - startedRef.current;
        setElapsed(ms);
        if (ms >= MAX_RECORDING_MS) stop();
      }, 200);
    } catch (err) {
      // A refusal is a choice, not a fault — say what to do about it.
      setError(
        (err as DOMException)?.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser's site settings to record."
          : "Could not start recording.",
      );
      reportError(err, { area: "voice-record-start" });
    } finally {
      // Both paths must clear it: on success `recording` takes over, and on a
      // refusal the button has to become clickable again. Without this the
      // control stayed disabled for the rest of the session.
      setAwaiting(false);
    }
  };

  const stop = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  /**
   * "Voice note 1", "Voice note 2", … — the first number not already taken.
   *
   * Every recording used to save as the literal string "Voice note", so a list
   * of five was five identical rows and the only way to tell them apart was to
   * play them. Numbering by `notes.length + 1` would repeat after a delete, so
   * the used numbers are collected and the first gap is taken instead: delete
   * "Voice note 2" of three and the next recording is 2 again, not 4.
   *
   * Only the numbered defaults count. A recording the user renamed to
   * "Voice note from Tuesday" is their title, not a claim on a number.
   */
  const nextDefaultTitle = (): string => {
    const used = new Set<number>();
    for (const n of notes) {
      const m = /^Voice note (\d+)$/.exec(n.title.trim());
      if (m) used.add(Number(m[1]));
    }
    let i = 1;
    while (used.has(i)) i += 1;
    return `Voice note ${i}`;
  };

  const savePending = async () => {
    if (!pending || saving) return;
    setSaving(true);
    setError(null);
    try {
      await uploadVoiceNote({
        blob: pending.blob,
        title: title.trim() || nextDefaultTitle(),
        durationMs: pending.ms,
        noteId,
        meetingId,
        // Only sent for a standalone recording; the server ignores it otherwise.
        tag: standalone ? tag : undefined,
      });
      setPending(null);
      setTitle("");
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save that recording. Check your connection."));
      reportError(err, { area: "voice-note-upload" });
    } finally {
      setSaving(false);
    }
  };

  /** Discard means discard: nothing was uploaded, so there is nothing to
   *  clean up server-side. */
  const discardPending = () => {
    setPending(null);
    setTitle("");
  };

  const play = async (note: ApiVoiceNote) => {
    setError(null);
    try {
      if (playingId === note.id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const blob = await loadVoiceNoteAudio(note.id);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const el = new Audio(url);
      el.onended = () => setPlayingId(null);
      audioRef.current = el;
      await el.play();
      setPlayingId(note.id);
    } catch (err) {
      setError("Could not play that recording.");
      reportError(err, { area: "voice-note-play", id: note.id });
      setPlayingId(null);
    }
  };

  const rename = async (note: ApiVoiceNote) => {
    const next = await dialog.prompt("Rename this recording", { defaultValue: note.title });
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === note.title) return;
    // Optimistic: the row updates now, the request follows.
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, title: trimmed } : n)));
    try {
      await renameVoiceNote(note.id, trimmed.slice(0, 200));
    } catch (err) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, title: note.title } : n)));
      setError("Could not rename that recording.");
      reportError(err, { area: "voice-note-rename", id: note.id });
    }
  };

  /** Move one recording between Personal and Business. Optimistic, and it
   *  leaves the current filter, so the row disappears — which is the honest
   *  outcome: it is no longer in this list. */
  const retag = async (note: ApiVoiceNote, next: VoiceTag) => {
    if (note.tag === next) return;
    const before = notes;
    /* Retag in place; only DROP it when the active filter no longer admits it.
       This used to filter the row out unconditionally, so under "All" — where
       every tag belongs — moving a recording between Personal and Business
       made it disappear from a list it still belonged to. The write succeeded,
       which is why a reload brought it back. */
    setNotes((prev) =>
      filter && filter !== next
        ? prev.filter((n) => n.id !== note.id)
        : prev.map((n) => (n.id === note.id ? { ...n, tag: next } : n)),
    );
    try {
      await retagVoiceNote(note.id, next);
    } catch (err) {
      setNotes(before);
      setError(apiErrorMessage(err, "Could not move that recording."));
      reportError(err, { area: "voice-note-retag", id: note.id });
    }
  };

  const remove = async (note: ApiVoiceNote) => {
    if (!await dialog.confirm(`Delete "${note.title}"?`, { confirmLabel: "Delete", danger: true })) return;
    const before = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    try {
      await deleteVoiceNote(note.id);
    } catch (err) {
      // Put it back: the server still has it, so hiding it would make it
      // reappear later looking like a resurrection.
      setNotes(before);
      setError("Could not delete that recording.");
      reportError(err, { area: "voice-note-delete", id: note.id });
    }
  };

  const left = Math.max(0, MAX_RECORDING_MS - elapsed);

  return (
    <section className={compact ? "mt-5" : "mt-6"}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="font-heading text-[12px] uppercase tracking-wide text-muted">
          Recordings
        </h3>
        {notes.length ? (
          <span className="text-[12px] tabular-nums text-muted">{notes.length}</span>
        ) : null}
      </div>

      {/* Naming step — the recording is held locally until it is named. */}
      {pending ? (
        <div className="mb-3 rounded-xl border border-gold bg-surface p-3.5">
          <p className="mb-2 text-[12.5px] text-muted">{mmss(pending.ms)} recorded</p>
          <label className="mb-2 block">
            <span className="sr-only">Name this recording</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") savePending();
                if (e.key === "Escape") discardPending();
              }}
              maxLength={200}
              autoFocus
              /* Shows the name it will actually get if left blank, rather than
                 the bare words "Voice note" — so the number is not a surprise
                 after saving. */
              placeholder={nextDefaultTitle()}
              style={{ backgroundColor: title.trim() ? "var(--field)" : "var(--field-empty)" }}
              className="w-full min-h-[44px] rounded-xl border border-line px-3.5 py-2.5 text-[15px] text-on-card outline-none focus:border-line-focus"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={savePending}
              disabled={saving}
              className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gold px-4 text-[13.5px] font-semibold text-on-gold transition-colors hover:bg-gold-hover disabled:opacity-60"
            >
              <Check size={16} />
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={discardPending}
              disabled={saving}
              className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-line px-4 text-[13.5px] font-semibold text-muted transition-colors hover:bg-line-soft"
            >
              <Close size={16} />
              Discard
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={recording ? stop : start}
          /* `awaiting` covers the gap between the click and the browser's
             permission answer. `recording` only becomes true AFTER
             getUserMedia resolves, so until the user picks Allow the button
             said "Record a voice note", stayed enabled, and showed no spinner
             — a tester could not tell whether the app had frozen or the prompt
             was simply rendering outside the page. */
          disabled={!canRecord || awaiting}
          aria-busy={awaiting}
          aria-label={recording ? "Stop recording" : "Record a voice note"}
          className={cx(
            "flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border text-[13.5px] font-semibold transition-colors",
            !canRecord
              ? "cursor-not-allowed border-line text-muted"
              : recording
                ? "border-danger text-danger hover:bg-danger/5"
                : "border-line text-heading hover:bg-line-soft",
          )}
        >
          {recording ? (
            <span
              aria-hidden
              className="h-2.5 w-2.5 animate-pulse rounded-full"
              style={{ backgroundColor: "var(--danger)" }}
            />
          ) : (
            <Mic size={16} />
          )}
          {recording
            ? `Stop · ${mmss(elapsed)} (${mmss(left)} left)`
            : awaiting
              ? "Waiting for microphone access…"
              : "Record a voice note"}
        </button>
      )}

      {error ? (
        <p className="mt-2 text-[13px] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loaded && !notes.length && standalone ? (
        <p className="mt-2 text-[12.5px] text-muted">
          {filter ? `No ${filter} recordings yet.` : "No recordings yet."}
        </p>
      ) : null}

      {notes.length ? (
        <ul className="mt-2 space-y-1.5">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
            >
              <button
                type="button"
                onClick={() => play(n)}
                aria-label={playingId === n.id ? `Pause ${n.title}` : `Play ${n.title}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-heading transition-colors hover:border-gold hover:text-gold"
              >
                {playingId === n.id ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                type="button"
                onClick={() => rename(n)}
                className="min-w-0 flex-1 text-left"
                title="Rename"
              >
                <span className="block break-words text-[14px] text-ink">{n.title}</span>
                {/* Length AND when it was made. Duration alone could not tell
                    two recordings apart; the date is what people actually
                    remember a recording by. */}
                <span className="block text-[11.5px] tabular-nums text-muted">
                  {mmss(n.duration_ms)}
                  {n.created_at ? ` · ${friendlyTimestamp(n.created_at)}` : ""}
                </span>
              </button>
              {standalone ? (
                /* The chip shows what this recording IS, and moves it on click.
                   Labelling it with the DESTINATION read as the current tag —
                   a personal recording displaying the word "Business" looked
                   like a mis-filed row rather than an action. */
                <button
                  type="button"
                  onClick={() => retag(n, n.tag === "personal" ? "business" : "personal")}
                  aria-label={`${n.title} is ${n.tag}. Move it to ${
                    n.tag === "personal" ? "business" : "personal"
                  }.`}
                  title={`Move to ${n.tag === "personal" ? "Business" : "Personal"}`}
                  // `tap-row` for the WCAG 2.2 minimum. It was 21px, and it is a control that
                  // moves the recording between Personal and Business.
                  className="shrink-0 tap-row rounded-full border border-line px-2 text-[10px] font-bold uppercase tracking-wide text-muted transition-colors hover:border-gold hover:text-gold"
                >
                  {n.tag}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => remove(n)}
                aria-label={`Delete ${n.title}`}
                className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:text-danger"
              >
                <Trash size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
