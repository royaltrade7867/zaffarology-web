"use client";

/**
 * Notes and Meeting notes.
 *
 * Ports `zaffarology-mobileapp/src/app/(tabs)/notes.tsx` onto the same backend
 * rows: a Notes / Meeting notes switcher, a Personal / Business filter, a
 * Prev/Next navigator over the FILTERED list, and the blank-discard rule.
 *
 * A note with no text but a RECORDING is not empty — deleting a note
 * soft-deletes its voice notes server-side, so the discard rule consults the
 * recorder's count. "Not known yet" counts as "has audio", which is the
 * direction that cannot destroy anything.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { friendlyISO } from "@/lib/dates";
import { AuthGuard } from "@/components/shell";
import { MeetingEditor } from "@/components/meeting-editor";
import { VoiceNotes } from "@/components/voice-notes";
import { Back, ChevronLeft, ChevronRight, MeetingIcon, NoteIcon, Pin, Plus, Share, Trash } from "@/components/icons";
import { ShareSheet } from "@/components/share-sheet";
import { meetingAsText } from "@/lib/notes-share-api";
import { GrowField, Loading, TextArea, cx } from "@/components/ui";
import { useNotes } from "@/lib/use-notes";
import type { ApiMeeting, ApiNote, NoteTag } from "@/lib/notes-api";
import { useDialog } from "@/components/dialog";

type Kind = "notes" | "meetings";
/* The Personal / Business FILTER is gone (19 Sep 2026). The two kinds carry
   those names now — a personal note is a plain note, a business note is a
   meeting — so filtering by tag on top of that was a second way to hide the
   same row. `tag` still exists on every note and meeting, and is still written
   on create, because the phone app filters by it and both apps share the rows. */

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
  /* `date` and `time` are NOT checked. They are pre-filled with now at
     creation, so requiring them to be empty would mean no meeting is ever
     blank — and every one someone opened and backed out of would be kept
     forever. What makes a meeting worth keeping is something the user typed,
     and a date the app filled in by itself is not that. */
  !m.title.trim() &&
  !m.place.trim() &&
  !m.agenda.trim() &&
  !m.notes.trim() &&
  !m.decisions.trim() &&
  !m.next_steps.trim() &&
  !m.attendees.trim() &&
  m.attendee_ids.length === 0;

const isNoteBlank = (n: ApiNote): boolean => !n.title.trim() && !n.body.trim() && !n.pinned;

/**
 * A note's body, tidied for the CARD only — never for the editor.
 *
 * Deliberately not a truncation. It trims the ends and collapses a run of blank
 * lines to one, so no word is ever dropped and nothing is cut mid-sentence
 * (which is why `line-clamp-6` was removed from the card in the first place).
 *
 * The bug this fixes: a note holding 43 characters and 19 stray newlines
 * rendered as a ~490px column of empty space, and because a CSS grid stretches
 * every cell to its row's tallest, it dragged the note beside it to the same
 * height. Opening the note still shows the body exactly as written.
 */
const preview = (body: string): string => body.trim().replace(/\n{2,}/g, "\n\n");

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
  const dialog = useDialog();
  const [undo, setUndo] = useState<{ what: "note" | "meeting"; id: number } | null>(null);

  const [kind, setKind] = useState<Kind>("notes");
  /** What the share sheet is currently showing, or null. Held here rather than
   *  per-card so the sheet has ONE mount point and works from the list and the
   *  open editor alike. */
  const [sharing, setSharing] = useState<{ title: string; body: string } | null>(null);
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);
  const [openMeetingId, setOpenMeetingId] = useState<number | null>(null);
  // Index within the current list, so Prev/Next walks what is shown.
  const [cur, setCur] = useState(0);

  /* Every note and every meeting, unfiltered. The tab is the only division. */
  const list: (ApiNote | ApiMeeting)[] = kind === "notes" ? notes : meetings;
  const idx = Math.min(cur, Math.max(0, list.length - 1));

  /* `lastTag` is gone with the filter. A new item's tag now comes from the TAB
     it was created under, not from whatever the previous item happened to use
     — see `newItem` below. */

  /**
   * Whether the open item has recordings, and therefore is NOT empty even with
   * no text — discarding it would destroy the audio, since deleting a note
   * soft-deletes its voice notes server-side too.
   *
   * `null` means "not counted yet", which is treated as "has audio" so a slow
   * load can never cause a delete. Mobile fails in the same direction
   * (`voiceCount === null || voiceCount > 0`). Never replace this with a bare
   * `false`: that asserts there is definitely none.
   */
  const [voiceCount, setVoiceCount] = useState<number | null>(null);
  const hasVoice = voiceCount === null || voiceCount > 0;
  // Stable identity: the recorder reports through an effect keyed on this.
  const onVoiceCount = useCallback((n: number) => setVoiceCount(n), []);

  // A freshly opened item starts unknown again, so the previous one's count
  // cannot leak across and authorise a delete.
  useEffect(() => {
    setVoiceCount(null);
  }, [openNoteId, openMeetingId]);

  /* The row we were JUST handed, held until the list catches up.
     `openNote` is looked up by id inside `notes`, and `newItem` sets the two
     from different places after an `await`: `addNote` calls `setNotes` inside
     the hook, `setOpenNoteId` runs here. When the page re-rendered with the new
     id but the previous `notes` array, the lookup missed and NOTHING opened —
     the editor then appeared on the next unrelated click, once both had
     settled. Preferring the handed-back row makes the open immediate and does
     not depend on the order the two updates land in. */
  const [justMade, setJustMade] = useState<ApiNote | ApiMeeting | null>(null);
  /** True while a new note or meeting is being created on the server. */
  const [creating, setCreating] = useState(false);
  // Released once nothing is open, so a closed (or deleted) row cannot linger
  // and re-render from this fallback later.
  useEffect(() => {
    if (openNoteId === null && openMeetingId === null) setJustMade(null);
  }, [openNoteId, openMeetingId]);
  const openNote =
    notes.find((n) => n.id === openNoteId) ??
    (justMade && "body" in justMade && justMade.id === openNoteId ? justMade : null);
  const openMeeting =
    meetings.find((m) => m.id === openMeetingId) ??
    (justMade && "agenda" in justMade && justMade.id === openMeetingId ? justMade : null);

  /** Switching tab resets the position — index 3 of one list means nothing in
   *  another. */
  const switchKind = (k: Kind) => { setKind(k); setCur(0); };

  const newItem = async () => {
    // A new item takes the current filter's tag, so creating one while
    // "Business" is selected does not immediately hide it. Under "All" it
    // repeats whichever tag was last used here, since defaulting a business
    // user's every note to "personal" hides it the moment they filter.
    /* The TAB decides the tag: a personal note is tagged personal, a business
       note (a meeting) business. The tag is no longer used to filter here, but
       it is still written because the PHONE app filters by it and both apps
       share the same rows — leaving it unset would make new items vanish from
       whichever filter the phone is on. */
    const tag: NoteTag = kind === "notes" ? "personal" : "business";
    setCur(0);
    /* Say something IMMEDIATELY. Creating one is a round trip to the server,
       which against the production database measures 5 to 8 seconds — the button
       looked completely dead for all of it, so people pressed it again. This
       disables the button and spins it until the row comes back. (A double press
       was already harmless — it creates one note — but silence is not.) */
    setCreating(true);
    try {
      if (kind === "notes") {
        const created = await addNote(tag);
        if (created) { setJustMade(created); setOpenNoteId(created.id); }
        else void dialog.alert("Couldn't create that note. Check your connection and try again.");
      } else {
        const created = await addMeeting(tag);
        if (created) { setJustMade(created); setOpenMeetingId(created.id); }
        else void dialog.alert("Couldn't create that meeting. Check your connection and try again.");
      }
    } finally {
      setCreating(false);
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

  /**
   * The same discard, for every OTHER way of leaving.
   *
   * `closeNote` only runs from the back arrow. Clicking "Home" in the top nav
   * unmounts this screen without it, which left a permanent "Untitled note"
   * behind — the likeliest source of the stray blank notes already on this
   * account.
   *
   * Refs, because the cleanup runs once on unmount and would otherwise close
   * over the first render's empty lists and delete nothing.
   */
  const latest = useRef({ notes, meetings, openNoteId, openMeetingId, hasVoice });
  latest.current = { notes, meetings, openNoteId, openMeetingId, hasVoice };

  useEffect(
    () => () => {
      const { notes: ns, meetings: ms, openNoteId: nId, openMeetingId: mId, hasVoice: hv } =
        latest.current;
      if (hv) return; // a recording makes it non-empty
      const note = ns.find((n) => n.id === nId);
      if (note && isNoteBlank(note)) removeNote(note.id).catch(() => {});
      const meeting = ms.find((m) => m.id === mId);
      if (meeting && isMeetingBlank(meeting)) removeMeeting(meeting.id).catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const confirmDelete = async (what: "note" | "meeting", id: number) => {
    if (!await dialog.confirm(`Delete this ${what}?`, { confirmLabel: "Delete", danger: true })) return;
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
      void dialog.alert("Could not restore that. It may already be gone."),
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
        onVoiceCountChange={onVoiceCount}
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
            {/* Share sits before delete and is not tinted red: two icon
                buttons side by side, one of which destroys the note, should
                not look alike. */}
            <button
              type="button"
              onClick={() => setSharing({ title: openNote.title.trim() || "Note", body: openNote.body })}
              aria-label="Share this note"
              title="Share"
              className="rounded-lg p-2 text-heading transition-colors hover:bg-line-soft"
            >
              <Share size={17} />
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

        {/* The Personal / Business picker is gone: the tab a note was created
            under decides its tag, and offering to change it here would move
            the note out of the list it is being read in. The `tag` field is
            still set on create — the phone app filters by it. */}

        {/* `GrowField`, not an `<input>`: a long title used to scroll sideways
            inside a one-line box with only part of it ever visible. It strips
            newlines, so this is still one logical line — it just wraps. */}
        <GrowField
          value={openNote.title}
          onChange={(v) => editNote(openNote.id, { title: v })}
          placeholder="Title"
          maxLength={200}
          autoFocus
          style={{ backgroundColor: openNote.title.trim() ? "var(--field)" : "var(--field-empty)" }}
          className="mb-3 w-full rounded-xl border border-line px-3.5 py-3 font-heading text-[19px] text-on-card outline-none transition-colors focus:border-line-focus"
        />
        <TextArea
          value={openNote.body}
          onChange={(v) => editNote(openNote.id, { body: v })}
          placeholder="Write it down…"
          maxLength={20000}
          maxBreaks={400}
          /* No `min-h` any more: starts at one line and grows with what is
             written, like every other field in the app. It was `min-h-[45vh]`,
             nearly half a screen of empty box before a word was typed, which
             made a two-line note look unfinished. `useAutoGrow` still takes it
             to its ceiling and then scrolls. */
        />

        <VoiceNotes noteId={openNote.id} compact onCountChange={onVoiceCount} />

        {error ? (
          <p className="mt-2 text-[13px] font-semibold text-danger" role="alert">{error}</p>
        ) : null}

        {/* Mounted in BOTH return paths: this one returns early, so a sheet
            rendered only in the list view would never appear from inside an
            open note. */}
        {sharing ? (
          <ShareSheet title={sharing.title} body={sharing.body} onClose={() => setSharing(null)} />
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
        {/* A position counter belongs to the pager. From `lg` every item is on
            screen, so "1 of 8" would be describing a position nobody is in. */}
        {list.length > 1 ? (
          <span className="text-[12px] tabular-nums text-muted lg:hidden">
            {idx + 1} of {list.length}
          </span>
        ) : null}
      </div>

      {/* ONE choice, not two.
          This was a Notes / Meeting notes switcher AND a separate
          All / Personal / Business filter — two rows of controls to reach one
          list, and an item could be hidden by either. The two kinds now carry
          the names: a personal note is a plain note, a business note is a
          meeting. Neither list is filtered. */}
      <div role="group" aria-label="Note kind" className="mb-5 flex gap-2">
        {([
          { k: "notes" as const, label: "Personal notes", Icon: NoteIcon },
          { k: "meetings" as const, label: "Business notes", Icon: MeetingIcon },
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
                  ? "border-selected bg-selected text-on-selected"
                  : "border-line text-heading hover:bg-line-soft",
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>

      {/* The new-item button. The All / Personal / Business filters that used
          to sit beside it are gone — the tabs above are the only division now. */}
      <div className="mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={newItem}
          disabled={creating}
          aria-busy={creating}
          aria-label={
            creating
              ? "Creating…"
              : kind === "notes"
                ? "New note"
                : "New meeting"
          }
          title={creating ? "Creating…" : kind === "notes" ? "New note" : "New meeting"}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-gold text-gold transition-colors hover:bg-gold/8 disabled:opacity-60"
        >
          {/* The same spinner the rest of the app uses, sized to the button. */}
          {creating ? (
            <span className="spinner h-4 w-4 rounded-full border-2 border-line border-t-gold" />
          ) : (
            <Plus size={18} />
          )}
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
        <Empty kind={kind} onNew={newItem} />
      ) : (
        <>
          {/* From `lg`, every note is on screen at once.
              Below it, one at a time with the pager — a phone cannot show
              eight cards, but a 1440px browser showing ONE of eight and two
              arrows is a phone habit, not a constraint. The pager is why the
              header still counts "1 of 8"; that count is also hidden at `lg`,
              where the position means nothing. */}
          {/* `items-start` is load-bearing. A CSS grid stretches every cell to
              the tallest in its ROW, so one long note made its neighbour just
              as tall — two one-line notes were filling half the screen because
              a third note in the same row had blank lines in it. Each card
              should take the height of its own content. */}
          <div className="hidden items-start gap-3 lg:grid lg:grid-cols-2">
            {list.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
              >
                {"body" in item ? (
                  <NoteCard
                    note={item}
                    onOpen={() => setOpenNoteId(item.id)}
                    onShare={() => setSharing({ title: item.title.trim() || "Note", body: item.body })}
                  />
                ) : (
                  <MeetingCard
                    meeting={item as ApiMeeting}
                    onOpen={() => setOpenMeetingId(item.id)}
                    onShare={() => setSharing({
                      title: (item as ApiMeeting).title.trim() || "Meeting notes",
                      body: meetingAsText(item as ApiMeeting),
                    })}
                  />
                )}
              </article>
            ))}
          </div>

          <div className="lg:hidden">
            <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
              {current && "body" in current ? (
                <NoteCard
                  note={current}
                  onOpen={() => setOpenNoteId(current.id)}
                  onShare={() => setSharing({ title: current.title.trim() || "Note", body: current.body })}
                />
              ) : current ? (
                <MeetingCard
                  meeting={current as ApiMeeting}
                  onOpen={() => setOpenMeetingId(current.id)}
                  onShare={() => setSharing({
                    title: (current as ApiMeeting).title.trim() || "Meeting notes",
                    body: meetingAsText(current as ApiMeeting),
                  })}
                />
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
          </div>
        </>
      )}

      {/* Recorded notes that belong to no typed note — a different kind of
          thing, with its own controls, exactly as on the phone. Passing no ids
          is what makes this the STANDALONE list: a note's own recordings show
          inside that note, and listing them here too would show them twice. */}
      <div className="mt-8 border-t border-line pt-2">
        {/* Every standalone recording, unfiltered — the screen no longer has a
            Personal / Business control to inherit. A new recording made here
            defaults to `personal`, which is the side it is recorded from. */}
        <VoiceNotes />
      </div>

      {sharing ? (
        <ShareSheet title={sharing.title} body={sharing.body} onClose={() => setSharing(null)} />
      ) : null}
    </div>
  );
}

/* -------------------------------- pieces -------------------------------- */

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
          ? "cursor-not-allowed border-line text-muted"
          : "border-line text-heading hover:border-gold hover:text-gold",
      )}
    >
      <Icon size={19} />
    </button>
  );
}

function NoteCard({ note, onOpen, onShare }: { note: ApiNote; onOpen: () => void; onShare: () => void }) {
  const when = stamp(note.updated_at ?? note.created_at);
  return (
    /* The header row sits OUTSIDE the open-button: the whole card used to be
       one `<button>`, and a share button nested inside it would be a button
       within a button — invalid, and a click would trigger both. */
    <div>
      {/* No tag chip. The tab above already says Personal or Business, so a
          PERSONAL badge on every card in the Personal list repeated it on
          every row. */}
      <div className="mb-1.5 flex items-center gap-2">
        {note.pinned ? <Pin size={14} filled title="Pinned" className="text-gold" /> : null}
        {when ? <span className="text-[11px] tabular-nums text-muted">{when}</span> : null}
        <button
          type="button"
          onClick={onShare}
          aria-label={`Share ${note.title.trim() || "this note"}`}
          title="Share"
          className="-my-1 ml-auto rounded-lg p-1.5 text-muted transition-colors hover:bg-line-soft hover:text-heading"
        >
          <Share size={15} />
        </button>
      </div>
      <button type="button" onClick={onOpen} className="block w-full text-left">
      <h2 className="font-heading text-[19px] leading-snug text-heading">
        {note.title.trim() || "Untitled note"}
      </h2>
      {/* The body is shown in full. It was `line-clamp-6`, which cut a longer
          note mid-sentence with no way to tell how much was missing.

          `preview` only collapses runs of BLANK lines and trims the ends — it
          never drops words. A note holding 43 characters and 19 stray newlines
          was rendering as a ~490px tower of empty space; the text is identical,
          the empty space is not. Opening the note still shows it verbatim. */}
      {note.body.trim() ? (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">
          {preview(note.body)}
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] italic text-muted">Nothing written yet</p>
      )}
      </button>
    </div>
  );
}

function MeetingCard({ meeting, onOpen, onShare }: { meeting: ApiMeeting; onOpen: () => void; onShare: () => void }) {
  const decisions = meeting.decisions.split("\n").filter((d) => d.trim());
  return (
    <div>
      {/* No tag chip — the tab says Business already. */}
      <div className="mb-1.5 flex items-center gap-2">
        {meeting.date ? (
          <span className="text-[11px] tabular-nums text-muted">{friendlyISO(meeting.date) ?? meeting.date}</span>
        ) : null}
        <button
          type="button"
          onClick={onShare}
          aria-label={`Share ${meeting.title.trim() || "this meeting"}`}
          title="Share"
          className="-my-1 ml-auto rounded-lg p-1.5 text-muted transition-colors hover:bg-line-soft hover:text-heading"
        >
          <Share size={15} />
        </button>
      </div>
      <button type="button" onClick={onOpen} className="block w-full text-left">
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
          {/* Every decision, not `slice(0, 3)`: the count above said "7 decisions"
              while the list showed three, with nothing marking the gap. */}
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[14px] leading-relaxed text-ink">
            {decisions.map((d, i) => (
              <li key={i} className="break-words">{d}</li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-1.5 text-[13px] italic text-muted">No decisions recorded yet</p>
      )}
      </button>
    </div>
  );
}

/* No `filtered` case any more: the Personal / Business filter is gone, so an
   empty list always means there is nothing of this kind yet. The old copy sent
   people to an "All" button that no longer exists. */
function Empty({ kind, onNew }: { kind: Kind; onNew: () => void }) {
  const thing = kind === "notes" ? "personal note" : "business note";
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-heading text-[17px] text-heading">No {thing}s yet</p>
      <p className="mx-auto mt-1.5 max-w-[42ch] text-[13.5px] leading-relaxed text-muted">
        {kind === "notes"
          ? "Anything worth keeping: an idea, a number, something someone said."
          : "Capture what was agreed while it's fresh: decisions, and who does what next."}
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
