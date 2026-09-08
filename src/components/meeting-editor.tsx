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
 * Attendee connection-tagging is mobile-only until the web app has connections
 * (Phase 3). `attendee_ids` is therefore never written here, and never cleared:
 * a meeting tagged on the phone keeps its ids when edited on the web.
 */
import { Back, Plus, Trash } from "@/components/icons";
import { SectionLabel, TextArea, cx } from "@/components/ui";
import type { ApiMeeting } from "@/lib/notes-api";

const ACCENT = "var(--gold)";

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
}: {
  meeting: ApiMeeting;
  onChange: (patch: Partial<ApiMeeting>) => void;
  onBack: () => void;
  onDelete: () => void;
  unsaved: boolean;
  saveError: string | null;
}) {
  /**
   * Decisions: a numbered list, stored as one newline-separated string.
   * Always at least one row, so there is something to type into.
   */
  const decisions = meeting.decisions.split("\n");
  const writeDecisions = (next: string[]) => onChange({ decisions: next.join("\n") });
  const setDecision = (i: number, t: string) =>
    // Newlines would split one decision into two on the next read.
    writeDecisions(decisions.map((d, n) => (n === i ? t.replace(/\n/g, " ") : d)));
  const removeDecision = (i: number) => {
    const next = decisions.filter((_, n) => n !== i);
    writeDecisions(next.length ? next : [""]);
  };
  /** Only from a filled last row, so the list cannot grow blank rows. */
  const canAddDecision = !!decisions[decisions.length - 1].trim();
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
        <Field label="Date" type="date" value={meeting.date} onChange={(v) => onChange({ date: v })} maxLength={10} />
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
      <Field
        label="Attendees"
        value={meeting.attendees}
        onChange={(v) => onChange({ attendees: v })}
        placeholder="Who was there? Separate names with commas"
        maxLength={2000}
      />

      <div className="mt-6">
        <SectionLabel text="Agenda" small="what you set out to cover" color={ACCENT} />
        <TextArea
          value={meeting.agenda}
          onChange={(v) => onChange({ agenda: v })}
          placeholder="Points to get through…"
          maxLength={20000}
        />
      </div>

      <div className="mt-2">
        <SectionLabel text="Notes" small="what was said" color={ACCENT} />
        <TextArea
          value={meeting.notes}
          onChange={(v) => onChange({ notes: v })}
          placeholder="Discussion, context, anything worth remembering…"
          maxLength={20000}
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
            maxLength={20000}
          />
        </div>
      </section>

      {/* Never claim saved while a write failed. */}
      {saveError ? (
        <p className="mt-4 text-[13px] font-semibold text-danger" role="alert">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
