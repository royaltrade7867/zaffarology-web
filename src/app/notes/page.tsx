"use client";

/**
 * Notes and Meeting notes.
 *
 * Ports `zaffarology-mobileapp/src/app/(tabs)/notes.tsx` onto the same backend
 * rows: a Notes / Meeting notes switcher, a Personal / Business filter, a
 * Prev/Next navigator over the FILTERED list, and the blank-discard rule.
 *
 * Voice notes are Phase 5. Until then this app cannot count a note's
 * recordings, so `hasVoice` is pinned TRUE and blank-discard is effectively
 * off: an unwanted "Untitled note" is a nuisance, whereas discarding a note
 * that turned out to have audio destroys the recording with it. See the
 * comment on `hasVoice` below before changing it.
 */
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/shell";
import { MeetingEditor } from "@/components/meeting-editor";
import { Back, ChevronLeft, ChevronRight, MeetingIcon, NoteIcon, Pin, Plus, Trash } from "@/components/icons";
import { Loading, TextArea, cx } from "@/components/ui";
import { useNotes } from "@/lib/use-notes";
import type { ApiMeeting, ApiNote, NoteTag } from "@/lib/notes-api";

type Kind = "notes" | "meetings";
/** `null` = show everything, so the filter is additive rather than a mode. */
type Filter = NoteTag | null;

/**
 * A meeting the user has put nothing into.
 *
 * Every text field is listed explicitly rather than looping the object: `tag`
 * is seeded on create and `id`/`created_at` always have values, so a generic
 * "are all values empty" check would never return true. A field added to
 * ApiMeeting later is treated as content until it is added here, which is the
 * safe direction to fail — the worst case is keeping a blank meeting, not
 * deleting one that has something in it.
 */
const isMeetingBlank = (m: ApiMeeting): boolean =>
  !m.title.trim() &&
  !m.date.trim() &&
  !m.time.trim() &&
  !m.place.trim() &&
  !m.agenda.trim() &&
  !m.notes.trim() &&
  !m.decisions.trim() &&
  !m.next_steps.trim() &&
  !m.attendees.trim() &&
  m.attendee_ids.length === 0;

const isNoteBlank = (n: ApiNote): boolean => !n.title.trim() && !n.body.trim() && !n.pinned;

/** "12 Mar 2026" from an ISO timestamp, or "" when there isn't one. */
const stamp = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export default function NotesPage() {
  return (
    <AuthGuard>
      <NotesAndMeetings />
    </AuthGuard>
  );
}

function NotesAndMeetings() {
  const {
    notes,
    meetings,
    loaded,
    error,
    unsaved,
    addNote,
    editNote,
    removeNote,
    addMeeting,
    editMeeting,
    removeMeeting,
    undoRemoveNote,
    undoRemoveMeeting,
  } = useNotes();

  /** The last delete, offered back for a few seconds. The rows are soft-deleted
   *  server-side, so "undo" really does restore them — recordings included. */
  const [undo, setUndo] = useState<{ what: "note" | "meeting"; id: number } | null>(null);

  const [kind, setKind] = useState<Kind>("notes");
  const [filter, setFilter] = useState<Filter>(null);
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);
  const [openMeetingId, setOpenMeetingId] = useState<number | null>(null);
  // Index within the CURRENT filtered list, so Prev/Next walks what is shown.
  const [cur, setCur] = useState(0);

  const shownNotes = useMemo(
    () => (filter ? notes.filter((n) => n.tag === filter) : notes),
    [notes, filter],
  );
  const shownMeetings = useMemo(
    () => (filter ? meetings.filter((m) => m.tag === filter) : meetings),
    [meetings, filter],
  );
  const list: (ApiNote | ApiMeeting)[] = kind === "notes" ? shownNotes : shownMeetings;
  const idx = Math.min(cur, Math.max(0, list.length - 1));

  /**
   * The tag to give a new item when no filter is active: whatever the most
   * recent item of this kind used. Derived from the data rather than held in
   * state, so it survives a reload, and it falls back to the sensible default
   * for each kind on an empty list.
   */
  const lastTag: NoteTag =
    (kind === "notes" ? notes[0]?.tag : meetings[0]?.tag) ??
    (kind === "meetings" ? "business" : "personal");

  /**
   * Whether the open item has recordings, and therefore is NOT empty even with
   * no text — discarding it would destroy the audio, since deleting a note
   * soft-deletes its voice notes server-side too.
   *
   * Voice notes are Phase 5 here, so this app cannot yet count them. UNKNOWN
   * must therefore mean "assume it has audio", which is the direction mobile
   * fails in as well (`voiceCount === null || voiceCount > 0`). `false` would
   * assert there is definitely none: a note recorded on the phone with no text,
   * opened on the web and backed out of, would be deleted along with its
   * recording. Replace with a real count when the recorder lands — never with
   * a bare `false`.
   */
  const hasVoice = true;

  const openNote = notes.find((n) => n.id === openNoteId) ?? null;
  const openMeeting = meetings.find((m) => m.id === openMeetingId) ?? null;

  /** Switching tab or filter resets the position — index 3 of one list means
   *  nothing in another. */
  const switchKind = (k: Kind) => { setKind(k); setCur(0); };
  const switchFilter = (f: Filter) => { setFilter(f); setCur(0); };

  const newItem = async () => {
    // A new item takes the current filter's tag, so creating one while
    // "Business" is selected does not immediately hide it. Under "All" it
    // repeats whichever tag was last used here, since defaulting a business
    // user's every note to "personal" hides it the moment they filter.
    const tag: NoteTag = filter ?? lastTag;
    setCur(0);
    if (kind === "notes") {
      const created = await addNote(tag);
      if (created) setOpenNoteId(created.id);
      else alert("Couldn't create that note. Check your connection and try again.");
    } else {
      const created = await addMeeting(tag);
      if (created) setOpenMeetingId(created.id);
      else alert("Couldn't create that meeting. Check your connection and try again.");
    }
  };

  /**
   * Leaving a still-blank item throws it away instead of keeping it.
   *
   * "New note" has to create the row up front — the editor saves by id, and
   * voice notes will attach by note id — so opening one and immediately going
   * back would otherwise leave an "Untitled note" in the list. Nobody meant to
   * create that.
   *
   * Only ever discards something with NOTHING in it. A single character or a
   * pinned flag counts as intent, and `removeNote` cancels any pending
   * debounced save first, so this cannot race a write.
   */
  const closeNote = () => {
    const note = notes.find((n) => n.id === openNoteId) ?? null;
    setOpenNoteId(null);
    if (note && isNoteBlank(note) && !hasVoice) removeNote(note.id).catch(() => {});
  };

  const closeMeeting = () => {
    const m = meetings.find((x) => x.id === openMeetingId) ?? null;
    setOpenMeetingId(null);
    if (m && isMeetingBlank(m) && !hasVoice) removeMeeting(m.id).catch(() => {});
  };

  const confirmDelete = (what: "note" | "meeting", id: number) => {
    if (!window.confirm(`Delete this ${what}?`)) return;
    // Step back one, like mobile. `idx` clamps for rendering, but leaving `cur`
    // stale lands the user on the last item rather than the neighbour of the
    // one they deleted.
    setCur((c) => Math.max(0, c - 1));
    if (what === "note") {
      setOpenNoteId(null);
      removeNote(id).catch(() => {});
    } else {
      setOpenMeetingId(null);
      removeMeeting(id).catch(() => {});
    }
    setUndo({ what, id });
  };

  // The offer expires, so a stale "Undo" cannot sit there restoring something
  // the user deleted minutes ago.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  const runUndo = () => {
    if (!undo) return;
    const { what, id } = undo;
    setUndo(null);
    (what === "note" ? undoRemoveNote(id) : undoRemoveMeeting(id)).catch(() =>
      alert("Could not restore that — it may already be gone."),
    );
  };

  if (!loaded) return <Loading />;

  /* --------------------------- meeting editor --------------------------- */

  if (openMeeting) {
    return (
      <MeetingEditor
        meeting={openMeeting}
        onChange={(patch) => editMeeting(openMeeting.id, patch)}
        onBack={closeMeeting}
        onDelete={() => confirmDelete("meeting", openMeeting.id)}
        unsaved={unsaved}
        saveError={error}
      />
    );
  }

  /* ---------------------------- note editor ----------------------------- */

  if (openNote) {
    return (
      <div>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={closeNote}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-heading transition-colors hover:bg-line-soft"
          >
            <Back size={17} />
            Notes
          </button>
          <div className="flex items-center gap-1.5">
            <span className="mr-1.5 text-[12px] text-muted" aria-live="polite">
              {error ? "" : unsaved ? "Saving…" : "Saved automatically"}
            </span>
            <button
              type="button"
              onClick={() => editNote(openNote.id, { pinned: !openNote.pinned })}
              aria-label={openNote.pinned ? "Unpin this note" : "Pin this note"}
              aria-pressed={openNote.pinned}
              className={cx(
                "rounded-lg p-2 transition-colors hover:bg-line-soft",
                openNote.pinned ? "text-gold" : "text-muted",
              )}
            >
              <Pin size={17} filled={openNote.pinned} />
            </button>
            <button
              type="button"
              onClick={() => confirmDelete("note", openNote.id)}
              aria-label="Delete this note"
              className="rounded-lg p-2 text-danger transition-colors hover:bg-danger/8"
            >
              <Trash size={17} />
            </button>
          </div>
        </div>

        <TagPicker
          value={openNote.tag}
          onChange={(t) => editNote(openNote.id, { tag: t })}
        />

        <input
          value={openNote.title}
          onChange={(e) => editNote(openNote.id, { title: e.target.value })}
          placeholder="Title"
          maxLength={200}
          autoFocus
          style={{ backgroundColor: openNote.title.trim() ? "#ffffff" : "var(--field-empty)" }}
          className="mb-3 w-full rounded-xl border border-line px-3.5 py-3 font-heading text-[19px] text-ink outline-none transition-colors focus:border-gold"
        />
        <TextArea
          value={openNote.body}
          onChange={(v) => editNote(openNote.id, { body: v })}
          placeholder="Write it down…"
          maxLength={20000}
          maxBreaks={400}
          className="min-h-[45vh]"
        />

        {error ? (
          <p className="mt-2 text-[13px] font-semibold text-danger" role="alert">{error}</p>
        ) : null}
      </div>
    );
  }

  /* ------------------------------- the list ------------------------------ */

  const current = list[idx] ?? null;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="font-heading text-[26px] leading-tight text-heading">NOTES</h1>
        {list.length > 1 ? (
          <span className="text-[12px] tabular-nums text-muted">
            {idx + 1} of {list.length}
          </span>
        ) : null}
      </div>

      {/* Kind switcher */}
      <div role="group" aria-label="Note kind" className="mb-3 flex gap-2">
        {([
          { k: "notes" as const, label: "Notes", Icon: NoteIcon },
          { k: "meetings" as const, label: "Meeting notes", Icon: MeetingIcon },
        ]).map(({ k, label, Icon }) => {
          const on = kind === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => switchKind(k)}
              className={cx(
                "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                on
                  ? "border-heading bg-heading text-white"
                  : "border-line text-heading hover:bg-line-soft",
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Filters, with the new-item plus beside them */}
      <div className="mb-5 flex items-center gap-2">
        {([null, "personal", "business"] as Filter[]).map((f) => {
          const on = filter === f;
          const label = f === null ? "All" : f === "personal" ? "Personal" : "Business";
          return (
            <button
              key={label}
              onClick={() => switchFilter(f)}
              aria-pressed={on}
              className={cx(
                "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                // No accent tint behind accent text: that pairing sat at 3.90:1.
                // The border and the weight carry the state instead.
                on ? "border-gold text-gold" : "border-line text-muted hover:bg-line-soft",
              )}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={newItem}
          aria-label={kind === "notes" ? "New note" : "New meeting"}
          title={kind === "notes" ? "New note" : "New meeting"}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-gold text-gold transition-colors hover:bg-gold/8"
        >
          <Plus size={18} />
        </button>
      </div>

      {error ? (
        <p className="mb-4 text-[13px] font-semibold text-danger" role="alert">{error}</p>
      ) : null}

      {undo ? (
        <div
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
        >
          <span className="text-[13.5px] text-ink">
            {undo.what === "note" ? "Note" : "Meeting"} deleted.
          </span>
          <button
            type="button"
            onClick={runUndo}
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/8"
          >
            Undo
          </button>
        </div>
      ) : null}

      {list.length === 0 ? (
        <Empty kind={kind} filtered={filter !== null} onNew={newItem} />
      ) : (
        <>
          {/* One at a time, with the same navigator the pillars use. */}
          <article
            className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            {current && "body" in current ? (
              <NoteCard note={current} onOpen={() => setOpenNoteId(current.id)} />
            ) : current ? (
              <MeetingCard meeting={current as ApiMeeting} onOpen={() => setOpenMeetingId(current.id)} />
            ) : null}
          </article>

          {list.length > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <NavButton
                dir="prev"
                disabled={idx === 0}
                onClick={() => setCur((c) => Math.max(0, c - 1))}
              />
              <NavButton
                dir="next"
                disabled={idx >= list.length - 1}
                onClick={() => setCur((c) => Math.min(list.length - 1, c + 1))}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/* -------------------------------- pieces -------------------------------- */

function TagPicker({ value, onChange }: { value: NoteTag; onChange: (t: NoteTag) => void }) {
  return (
    <div className="mb-3 flex gap-2">
      {(["personal", "business"] as NoteTag[]).map((t) => {
        const on = value === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            aria-pressed={on}
            className={cx(
              "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold capitalize transition-colors",
              on ? "border-gold text-gold" : "border-line text-muted hover:bg-line-soft",
            )}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

function NavButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous" : "Next"}
      className={cx(
        "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
        disabled
          ? "cursor-not-allowed border-line text-placeholder"
          : "border-line text-heading hover:border-gold hover:text-gold",
      )}
    >
      <Icon size={19} />
    </button>
  );
}

function NoteCard({ note, onOpen }: { note: ApiNote; onOpen: () => void }) {
  const when = stamp(note.updated_at ?? note.created_at);
  return (
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted ring-1 ring-line">
          {note.tag}
        </span>
        {note.pinned ? <Pin size={14} filled title="Pinned" className="text-gold" /> : null}
        {when ? <span className="ml-auto text-[11px] tabular-nums text-muted">{when}</span> : null}
      </div>
      <h2 className="font-heading text-[19px] leading-snug text-heading">
        {note.title.trim() || "Untitled note"}
      </h2>
      {note.body.trim() ? (
        <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
          {note.body}
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] italic text-placeholder">Nothing written yet</p>
      )}
    </button>
  );
}

function MeetingCard({ meeting, onOpen }: { meeting: ApiMeeting; onOpen: () => void }) {
  const decisions = meeting.decisions.split("\n").filter((d) => d.trim());
  return (
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted ring-1 ring-line">
          {meeting.tag}
        </span>
        {meeting.date ? (
          <span className="ml-auto text-[11px] tabular-nums text-muted">{meeting.date}</span>
        ) : null}
      </div>
      <h2 className="font-heading text-[19px] leading-snug text-heading">
        {meeting.title.trim() || "Untitled meeting"}
      </h2>
      {meeting.attendees.trim() ? (
        <p className="mt-1 text-[13px] text-muted">With {meeting.attendees}</p>
      ) : null}
      {decisions.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gold">
            {decisions.length === 1 ? "1 decision" : `${decisions.length} decisions`}
          </p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[14px] leading-relaxed text-ink">
            {decisions.slice(0, 3).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-1.5 text-[13px] italic text-placeholder">No decisions recorded yet</p>
      )}
    </button>
  );
}

function Empty({ kind, filtered, onNew }: { kind: Kind; filtered: boolean; onNew: () => void }) {
  const thing = kind === "notes" ? "note" : "meeting note";
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-heading text-[17px] text-heading">
        {filtered ? `No ${thing}s under this filter` : `No ${thing}s yet`}
      </p>
      <p className="mx-auto mt-1.5 max-w-[42ch] text-[13.5px] leading-relaxed text-muted">
        {filtered
          ? "Try “All”, or start one here — it will keep the filter you're on."
          : kind === "notes"
            ? "Anything worth keeping: an idea, a number, something someone said."
            : "Capture what was agreed while it's fresh — decisions, and who does what next."}
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-[14px] font-semibold text-on-gold transition-colors hover:bg-gold-hover"
      >
        <Plus size={17} />
        New {thing}
      </button>
    </div>
  );
}
