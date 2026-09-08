"use client";

/**
 * Meeting notes editor.
 *
 * Mirrors `zaffarology-mobileapp/src/components/meeting-editor.tsx`: same
 * fields, same stored shape, same backend rows. Decisions are a numbered list
 * held as ONE newline-separated string — the API, the emailed report and the
 * mobile app all already read that field as free text, so keeping the shape is
 * what lets the two apps edit the same meeting.
 *
 * Attendees are free text PLUS ids for the ones who are connections. Tagging is
 * additive: most attendees never have an account, so a typed name always works.
 * `addAttendee` handles ids ONLY — the field owns the text. Writing both from
 * here raced the field and overwrote the chips with the raw draft.
 */
import { Back, Plus, Trash } from "@/components/icons";
import { PersonTagField } from "@/components/person-tag-field";
import { VoiceNotes } from "@/components/voice-notes";
import { usePartners, type Partner } from "@/lib/use-connections";
import { SectionLabel, TextArea, cx } from "@/components/ui";
import type { ApiMeeting } from "@/lib/notes-api";

const ACCENT = "var(--gold)";

/** Mirrors `MeetingIn` in the backend schema. Every long field shares this
 *  ceiling, and Pydantic REJECTS rather than truncates — so an over-long value
 *  fails the whole PATCH, not just that field. */
const LONG_MAX = 20000;
/** All the decision rows live in one `decisions` column, so the cap is on the
 *  joined string, not per row. */
const DECISIONS_MAX = LONG_MAX;

/** One field row. Empty gets the green wash, matching the pillars. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 2000,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "date";
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[12px] font-semibold text-muted mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoCorrect="off"
        spellCheck={false}
        style={{ backgroundColor: value.trim() ? "#ffffff" : "var(--field-empty)" }}
        className="w-full min-h-[44px] rounded-xl border border-line px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors focus:border-gold"
      />
    </label>
  );
}

export function MeetingEditor({
  meeting,
  onChange,
  onBack,
  onDelete,
  unsaved,
  saveError,
  onVoiceCountChange,
}: {
  meeting: ApiMeeting;
  onChange: (patch: Partial<ApiMeeting>) => void;
  onBack: () => void;
  onDelete: () => void;
  unsaved: boolean;
  saveError: string | null;
  /** Reports how many recordings this meeting has, so the blank-discard rule
   *  does not throw away a meeting whose only content is audio. */
  onVoiceCountChange?: (n: number) => void;
}) {
  /**
   * Decisions: a numbered list, stored as one newline-separated string.
   * Always at least one row, so there is something to type into.
   */
  const { partners } = usePartners();

  /**
   * Ids only. The field writes the visible text itself, so touching `attendees`
   * here would race it — that shipped once, overwriting the chips with the raw
   * draft the moment a name was picked.
   */
  const addAttendee = (p: Partner | null, _notify?: boolean, untagUserId?: number) => {
    if (!p) {
      if (untagUserId !== undefined) {
        onChange({ attendee_ids: meeting.attendee_ids.filter((id) => id !== untagUserId) });
      }
      return;
    }
    if (meeting.attendee_ids.includes(p.userId)) return;
    onChange({ attendee_ids: [...meeting.attendee_ids, p.userId] });
  };

  const decisions = meeting.decisions.split("\n");
  /**
   * The rows share ONE column, capped at 20000 by the API schema. Pydantic
   * rejects an over-long value outright — and because every save PATCHes the
   * whole meeting, one 422 wedges every later edit to it, title included, while
   * the screen still shows the text. So the join is checked here and the edit
   * is refused before it can poison the row.
   */
  const writeDecisions = (next: string[]) => {
    const joined = next.join("\n");
    if (joined.length > DECISIONS_MAX) return false;
    onChange({ decisions: joined });
    return true;
  };
  const setDecision = (i: number, t: string) =>
    // Newlines would split one decision into two on the next read.
    writeDecisions(decisions.map((d, n) => (n === i ? t.replace(/\n/g, " ") : d)));
  const removeDecision = (i: number) => {
    const next = decisions.filter((_, n) => n !== i);
    writeDecisions(next.length ? next : [""]);
  };
  const used = meeting.decisions.length;
  const nearLimit = used > DECISIONS_MAX * 0.9;
  /** Only from a filled last row, so the list cannot grow blank rows — and only
   *  while there is room left in the shared column. */
  const canAddDecision = !!decisions[decisions.length - 1]?.trim() && used < DECISIONS_MAX;
  const addDecision = () => {
    if (!canAddDecision) return;
    writeDecisions([...decisions, ""]);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-heading transition-colors hover:bg-line-soft"
        >
          <Back size={17} />
          Notes
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted" aria-live="polite">
            {saveError ? "" : unsaved ? "Saving…" : "Saved automatically"}
          </span>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete this meeting"
            className="rounded-lg p-2 text-danger transition-colors hover:bg-danger/8"
          >
            <Trash size={17} />
          </button>
        </div>
      </div>

      <SectionLabel text="Meeting" small="what it was and when" color={ACCENT} />
      <Field
        label="Title"
        value={meeting.title}
        onChange={(v) => onChange({ title: v })}
        placeholder="e.g. Monday leadership huddle"
        maxLength={200}
      />
      <div className="grid gap-x-3 sm:grid-cols-2">
        {/* `maxLength` does nothing on type="date". Chrome yields "+012025-03-04"
            (13 chars) for a 5-digit year, which the API's 10-char cap rejects —
            wedging every later save — so clamp it here instead. */}
        <Field
          label="Date"
          type="date"
          value={meeting.date}
          onChange={(v) => onChange({ date: v.slice(0, 10) })}
          maxLength={10}
        />
        {/* Free text on purpose: people write "after lunch", not 14:30. */}
        <Field label="Time" value={meeting.time} onChange={(v) => onChange({ time: v })} placeholder="e.g. 2:30pm" maxLength={40} />
      </div>
      <Field
        label="Place"
        value={meeting.place}
        onChange={(v) => onChange({ place: v })}
        placeholder="e.g. Head office, or Zoom"
        maxLength={200}
      />
      <PersonTagField
        label="Attendees"
        value={meeting.attendees}
        onChangeText={(v) => onChange({ attendees: v })}
        placeholder="Who was there? Separate names with commas"
        accent={ACCENT}
        partners={partners}
        onTag={addAttendee}
        multi
        maxLength={2000}
      />

      <div className="mt-6">
        <SectionLabel text="Agenda" small="what you set out to cover" color={ACCENT} />
        <TextArea
          value={meeting.agenda}
          onChange={(v) => onChange({ agenda: v })}
          placeholder="Points to get through…"
          maxLength={LONG_MAX}
        />
      </div>

      <div className="mt-2">
        <SectionLabel text="Notes" small="what was said" color={ACCENT} />
        <TextArea
          value={meeting.notes}
          onChange={(v) => onChange({ notes: v })}
          placeholder="Discussion, context, anything worth remembering…"
          maxLength={LONG_MAX}
        />
      </div>

      {/* The parts people come back for. Tinted with the card colour, not an
          accent wash — accent text on an accent tint sat at 4.01:1. The accent
          border alone carries the emphasis. */}
      <section className="mt-6 rounded-2xl border bg-surface p-4" style={{ borderColor: ACCENT }}>
        <SectionLabel text="Decisions" small="what was actually agreed" color={ACCENT} />
        {/* A numbered list, not one box: a meeting produces several distinct
            decisions, and running them together loses which is which. */}
        {decisions.map((d, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                label={`Decision ${i + 1}`}
                value={d}
                onChange={(t) => setDecision(i, t)}
                placeholder="What was decided?"
              />
            </div>
            {decisions.length > 1 ? (
              <button
                type="button"
                onClick={() => removeDecision(i)}
                aria-label={`Remove decision ${i + 1}`}
                className="mb-3 rounded-lg p-2 text-muted transition-colors hover:bg-line-soft hover:text-danger"
              >
                <Trash size={16} />
              </button>
            ) : null}
          </div>
        ))}
        {/* A small plus, not a full-width button: adding a decision is a minor
            action beside the fields themselves. Disabled until the last row
            says something, so the list cannot grow blank rows. */}
        {nearLimit ? (
          <p className="mb-2 text-[12px] font-semibold text-danger" role="status">
            {used >= DECISIONS_MAX
              ? "These decisions have reached the maximum length. Shorten one to add another."
              : `Approaching the limit — ${(DECISIONS_MAX - used).toLocaleString()} characters left across all decisions.`}
          </p>
        ) : null}
        <button
          type="button"
          onClick={addDecision}
          disabled={!canAddDecision}
          aria-label="Add decision"
          className={cx(
            "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
            canAddDecision
              ? "border-[color:var(--gold)] text-gold hover:bg-gold/8"
              : "cursor-not-allowed border-line text-placeholder",
          )}
        >
          <Plus size={18} />
        </button>

        <div className="mt-5">
          <SectionLabel text="Next steps" small="who does what, by when" color={ACCENT} />
          <TextArea
            value={meeting.next_steps}
            onChange={(v) => onChange({ next_steps: v })}
            placeholder="e.g. Sarah drafts the new tiers by Friday"
            maxLength={LONG_MAX}
          />
        </div>
      </section>

      {/* Recordings of this meeting. Scoped by meeting id, so they live here
          rather than in the Notes tab's general list. */}
      <VoiceNotes meetingId={meeting.id} compact onCountChange={onVoiceCountChange} />

      {/* Never claim saved while a write failed. */}
      {saveError ? (
        <p className="mt-4 text-[13px] font-semibold text-danger" role="alert">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
