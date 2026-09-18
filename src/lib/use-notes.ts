"use client";

/**
 * Notes and meetings, backed by real rows rather than a pillar blob.
 *
 * Each edit is its own request, so two devices editing different notes cannot
 * overwrite each other — the failure mode the blob store has. Edits are saved
 * on a debounce and applied optimistically, so typing stays instant.
 *
 * Three rules make the optimism safe, and all three exist because an optimistic
 * update that never reconciles is just silent data loss:
 *   1. a pending save is FLUSHED on unmount, never cancelled
 *   2. a refresh cannot overwrite a row that has unsaved local edits
 *   3. a failed write is surfaced, and a failed delete puts the row back
 *
 * Ported from `zaffarology-mobileapp/src/lib/use-notes.ts`, same backend rows.
 * The one addition is `beforeunload`: on the phone the tabs unmounting is what
 * flushes a pending save, but a browser tab can be closed mid-debounce and the
 * unmount cleanup never runs.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { reportError } from "@/lib/error-reporting";
import {
  createMeeting,
  createNote,
  deleteMeeting,
  deleteNote,
  loadMeetings,
  loadNotes,
  restoreMeeting,
  restoreNote,
  updateMeeting,
  updateNote,
  type ApiMeeting,
  type ApiNote,
  type NoteTag,
} from "@/lib/notes-api";

/** Matches the pillar store, so typing feels the same across the app. */
const SAVE_DEBOUNCE_MS = 500;

/**
 * A queued save.
 *
 * `patch` ACCUMULATES every field changed inside the debounce window. It used
 * to hold one write per row, replaced on each keystroke — so typing a title and
 * then the body within 500ms sent only `{body}` and the title was silently
 * lost. The local state still showed it, so the loss was invisible until a
 * genuine reload.
 *
 * `send` is the request; `beacon` is the same write with `keepalive`, so it
 * survives the page being torn down. Both are stored because the choice depends
 * on HOW the flush was triggered, not on the edit.
 */
type Pending<T> = {
  timer: ReturnType<typeof setTimeout>;
  patch: Partial<T>;
  send: (patch: Partial<T>, beacon: boolean) => Promise<unknown>;
};

export function useNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [meetings, setMeetings] = useState<ApiMeeting[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Rows whose latest edit has not been acknowledged by the server yet. */
  const [unsaved, setUnsaved] = useState(false);

  // One pending timer per row, so editing two rows never drops one's save.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timers = useRef<Map<string, Pending<any>>>(new Map());
  /**
   * Keys with an edit the server has not confirmed — either still inside the
   * debounce or in flight. A refresh must not overwrite these rows, or a
   * refresh from anywhere yanks the sentence out from under the user.
   */
  const dirty = useRef<Set<string>>(new Set());

  const markDirty = useCallback((key: string) => {
    dirty.current.add(key);
    setUnsaved(true);
  }, []);
  const markClean = useCallback((key: string) => {
    dirty.current.delete(key);
    if (dirty.current.size === 0) setUnsaved(false);
  }, []);

  /**
   * Fire every queued save now. Flush, do NOT cancel: cancelling silently
   * discards the last half second of typing.
   *
   * `unloading` picks the `keepalive` variant. A normal fetch started while the
   * document is being torn down is cancelled with it, so the ordinary path
   * would look like it saved and quietly lose the edit.
   */
  const flushAll = useCallback((unloading = false) => {
    timers.current.forEach(({ timer, patch, send }) => {
      clearTimeout(timer);
      // The ACCUMULATED patch, so a flush cannot drop a field either.
      send(patch, unloading).catch(() => {});
    });
    timers.current.clear();
  }, []);

  useEffect(() => () => flushAll(), [flushAll]);

  // A closing tab never runs the unmount cleanup, so a note typed and closed
  // straight away would lose its last edit. `pagehide` as well as
  // `beforeunload`: Safari on iOS often fires only the former, and a page
  // restored from the back/forward cache never fires `beforeunload` at all.
  useEffect(() => {
    const onLeave = () => flushAll(true);
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [flushAll]);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoaded(true);
      return;
    }
    try {
      const [n, m] = await Promise.all([loadNotes(), loadMeetings()]);
      // Keep any row the user has edited but the server has not confirmed.
      // Without this, a refresh replaces in-progress typing with the stale
      // server copy.
      setNotes((prev) =>
        n.map((row) =>
          dirty.current.has(`note-${row.id}`)
            ? prev.find((p) => p.id === row.id) ?? row
            : row,
        ),
      );
      setMeetings((prev) =>
        m.map((row) =>
          dirty.current.has(`meeting-${row.id}`)
            ? prev.find((p) => p.id === row.id) ?? row
            : row,
        ),
      );
      setError(null);
    } catch (err) {
      // Keep whatever is on screen: blanking the lists would look like the
      // notes had been deleted.
      setError("Could not load your notes.");
      reportError(err, { area: "notes-load" });
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Debounced write, keyed so each row has its own pending save.
   *  `write(beacon)` returns the request; the beacon form is only used when the
   *  page is going away. */
  /**
   * Debounced write, keyed so each row has its own pending save.
   *
   * The patch is MERGED into whatever is already pending for that row. Replacing
   * it — which this used to do — meant the last field edited inside the window
   * was the only one sent, and every earlier one was lost with no error.
   */
  const queueSave = useCallback(
    <T,>(
      key: string,
      patch: Partial<T>,
      send: (patch: Partial<T>, beacon: boolean) => Promise<unknown>,
    ) => {
      markDirty(key);
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing.timer);

      const merged: Partial<T> = { ...(existing?.patch as Partial<T>), ...patch };

      const fire = (beacon: boolean) =>
        send(merged, beacon)
          .then(() => markClean(key))
          .catch((err) => {
            // Surfaced, not swallowed: the screen says "Saved automatically",
            // so a silent failure is a lie the user acts on.
            setError("Some changes could not be saved. Check your connection.");
            reportError(err, { area: "notes-save", key });
          });

      timers.current.set(key, {
        patch: merged,
        send,
        timer: setTimeout(() => {
          timers.current.delete(key);
          fire(false);
        }, SAVE_DEBOUNCE_MS),
      });
    },
    [markClean, markDirty],
  );

  /** Drop a queued save without running it — only safe when the row is going away. */
  const cancelSave = useCallback(
    (key: string) => {
      const t = timers.current.get(key);
      if (t) {
        clearTimeout(t.timer);
        timers.current.delete(key);
      }
      markClean(key);
    },
    [markClean],
  );

  /* ------------------------------ notes ------------------------------ */

  const addNote = useCallback(async (tag: NoteTag): Promise<ApiNote | null> => {
    try {
      const created = await createNote({ tag });
      setNotes((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      reportError(err, { area: "note-create" });
      return null;
    }
  }, []);

  const editNote = useCallback(
    (id: number, patch: Partial<ApiNote>) => {
      // Optimistic: the row updates now, the request follows.
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
      queueSave<ApiNote>(`note-${id}`, patch, (merged, beacon) =>
        updateNote(id, merged, beacon),
      );
    },
    [queueSave],
  );

  const removeNote = useCallback(
    async (id: number) => {
      // Cancel a pending save first: PATCHing a row we are about to delete would
      // log a confusing 404.
      cancelSave(`note-${id}`);
      let removed: ApiNote | undefined;
      let at = 0;
      setNotes((prev) => {
        at = prev.findIndex((n) => n.id === id);
        removed = prev[at];
        return prev.filter((n) => n.id !== id);
      });
      try {
        await deleteNote(id);
      } catch (err) {
        // Put it back where it was: the server still has it, so leaving the row
        // hidden would make it reappear later looking like a resurrection.
        if (removed) {
          const row = removed;
          setNotes((prev) =>
            prev.some((n) => n.id === id)
              ? prev
              : [...prev.slice(0, at), row, ...prev.slice(at)],
          );
        }
        reportError(err, { area: "note-delete", id });
        throw err;
      }
    },
    [cancelSave],
  );

  /* ---------------------------- meetings ----------------------------- */

  const addMeeting = useCallback(async (tag: NoteTag): Promise<ApiMeeting | null> => {
    try {
      /* Today's date and the current time, pre-filled. A meeting is recorded as
         it happens, so both were being typed back in by hand every time — and a
         meeting saved with no date sorts and reads as though it never had one.
         Both stay editable for a meeting being written up later.

         Local time, NOT `toISOString()`: that converts to UTC, which in
         Australia lands the evening's meetings on tomorrow's date. */
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const created = await createMeeting({ tag, date, time });
      setMeetings((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      reportError(err, { area: "meeting-create" });
      return null;
    }
  }, []);

  const editMeeting = useCallback(
    (id: number, patch: Partial<ApiMeeting>) => {
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
      queueSave<ApiMeeting>(`meeting-${id}`, patch, (merged, beacon) =>
        updateMeeting(id, merged, beacon),
      );
    },
    [queueSave],
  );

  /** Undo a note delete, putting the row back on screen. */
  const undoRemoveNote = useCallback(async (id: number) => {
    const back = await restoreNote(id);
    setNotes((prev) => (prev.some((n) => n.id === id) ? prev : [back, ...prev]));
  }, []);

  /** Undo a meeting delete. */
  const undoRemoveMeeting = useCallback(async (id: number) => {
    const back = await restoreMeeting(id);
    setMeetings((prev) => (prev.some((m) => m.id === id) ? prev : [back, ...prev]));
  }, []);

  const removeMeeting = useCallback(
    async (id: number) => {
      cancelSave(`meeting-${id}`);
      let removed: ApiMeeting | undefined;
      let at = 0;
      setMeetings((prev) => {
        at = prev.findIndex((m) => m.id === id);
        removed = prev[at];
        return prev.filter((m) => m.id !== id);
      });
      try {
        await deleteMeeting(id);
      } catch (err) {
        if (removed) {
          const row = removed;
          setMeetings((prev) =>
            prev.some((m) => m.id === id)
              ? prev
              : [...prev.slice(0, at), row, ...prev.slice(at)],
          );
        }
        reportError(err, { area: "meeting-delete", id });
        throw err;
      }
    },
    [cancelSave],
  );

  return {
    notes,
    meetings,
    loaded,
    error,
    /** True while any edit is still unconfirmed, for a "Saving…" hint. */
    unsaved,
    refresh,
    addNote,
    editNote,
    removeNote,
    addMeeting,
    editMeeting,
    removeMeeting,
    undoRemoveNote,
    undoRemoveMeeting,
  };
}
