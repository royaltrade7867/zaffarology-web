"use client";

import { Accents, FIELD_EMPTY } from "@/lib/pillars";
import { SectionLabel, AddButton } from "@/components/ui";
import { TaskRow, DateField, YesNoRow, type TaskAction } from "@/components/task";
import { PersonTagField } from "@/components/person-tag-field";
import type { Partner } from "@/lib/use-connections";
import type { Deleg } from "@/pillars/schemas/types";

/** Field label. Pillar 4 keeps a private copy of this; the two must look the
 *  same, because the two screens now show the same huddle questions. */
function FLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-heading text-[10px] tracking-wide text-muted mt-2 mb-1">{children}</p>
  );
}

/** Sentences in the note, for the 1-to-3 guidance. Same rule as Pillar 4. */
const countSentences = (s: string): number =>
  s.trim() ? s.trim().split(/[.!?]+\s|[.!?]+$/).filter((x) => x.trim()).length : 0;

/**
 * "Delegate or Follow Up": what was handed to whom, by when, and whether it
 * actually happened.
 *
 * ONE list, two homes: Pillar 1 (per goal) and, per business, the "Delegation"
 * department in Pillar 5 — Zaffar asked for that department to work exactly
 * like Pillar 1's delegate or follow-up (18 Sep 2026). The caller owns where
 * the rows live, so every change goes out through a callback; adding in
 * particular stays at the call site, where `blankDeleg()` gives the new row a
 * real id.
 *
 * The huddle flow (18 Sep 2026): "To whom" tags a real connection, and each row
 * answers Completed or Not Completed — and if not, a NEW DATE rather than an
 * excuse. Deliberately the same controls and the same wording as Pillar 4's
 * 2-minute huddle, because Zaffar asked for the two to behave identically.
 *
 * Tagging is OPTIONAL: `partners`/`onTag` are omitted by callers that have no
 * connections plumbing, and the field falls back to a plain typed name. A
 * person with no account can always be written in by hand.
 */
export function DelegateSection({
  items,
  accent = Accents.blue,
  onAdd,
  onEdit,
  onRemove,
  onFile,
  partners,
  onTag,
  statusNoteFor,
}: {
  items: Deleg[];
  accent?: string;
  onAdd: () => void;
  onEdit: (i: number, mut: (d: Deleg) => void) => void;
  onRemove: (i: number) => void;
  /** Move a chased row to the filed archive. */
  onFile: (i: number) => void;
  /** Connections available to tag. Omit to keep the plain typed-name field. */
  partners?: Partner[];
  /** `null` untags. Only called when `partners` is provided. */
  onTag?: (i: number, p: Partner | null, notify?: boolean) => void;
  /** "Sent to X, waiting" / "X marked this done", per row. */
  statusNoteFor?: (d: Deleg) => string | null;
}) {
  const actions = (i: number): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => onRemove(i) },
    { label: "File", kind: "file", onClick: () => onFile(i) },
  ];
  const canTag = !!partners && !!onTag;

  return (
    <section className="mb-8">
      <SectionLabel text="Delegate or Follow Up" small="tick when you've chased it" color={accent} />
      {items.map((d, i) => (
        <TaskRow
          key={d.id || i}
          accent={accent}
          symbol="→"
          value={d.text}
          done={d.done}
          onChange={(text) => onEdit(i, (x) => { x.text = text; })}
          onToggle={(v) => onEdit(i, (x) => {
            x.done = v;
            /* Keep the two answers in step. Un-ticking a row that was marked
               completed must not leave `status: 'completed'` behind, or the
               huddle block below would still show a completion date for a task
               that is open again. */
            if (v && x.status !== "completed") x.status = "completed";
            if (!v && x.status === "completed") x.status = "";
          })}
          onDelete={() => onRemove(i)}
          actions={actions(i)}
          locked={i > 0 && !items[i - 1].text.trim()}
          placeholder="What would you like to delegate?"
          /* The plain who-field only when there is nothing to tag against;
             otherwise `PersonTagField` below owns it, and showing both would
             be two inputs for one value. */
          showWho={!canTag}
          who={d.who}
          onChangeWho={(text) => onEdit(i, (x) => { x.who = text; })}
          below={
            <div className="space-y-2">
              {canTag ? (
                <PersonTagField
                  label="To whom"
                  value={d.who}
                  placeholder="Who owns it?"
                  onChangeText={(t) => onEdit(i, (x) => { x.who = t; })}
                  accent={accent}
                  partners={partners!}
                  tagUserId={d.whoUserId}
                  onTag={(p, notify) => onTag!(i, p, notify)}
                  statusNote={statusNoteFor?.(d) ?? null}
                />
              ) : null}

              {/* The deadline. `due` was always in the shared shape, and the
                  reports already print it and count overdue items. */}
              <div className="max-w-[260px]">
                <DateField label="Deadline" value={d.due} onChange={(iso) => onEdit(i, (x) => { x.due = iso; })} />
              </div>

              {/* Only ask once there is something to ask about. An empty row
                  showing "Completed / Not Completed" invites an answer about a
                  task that does not exist yet. */}
              {d.text.trim() ? (
                <>
                  <YesNoRow
                    value={d.status === "completed" ? "yes" : d.status === "notdone" ? "no" : ""}
                    onChange={(v) => onEdit(i, (x) => {
                      if (v === "yes") {
                        x.status = "completed";
                        x.done = true;
                        x.newDate = "";
                        x.note = "";
                      } else {
                        x.status = "notdone";
                        x.done = false;
                        x.completedOn = "";
                      }
                    })}
                    yesLabel="Completed"
                    noLabel="Not Completed"
                  />

                  {d.status === "completed" ? (
                    <div className="max-w-[260px]">
                      <DateField
                        label="Completed On"
                        value={d.completedOn}
                        onChange={(iso) => onEdit(i, (x) => { x.completedOn = iso; })}
                      />
                    </div>
                  ) : null}

                  {d.status === "notdone" ? (
                    <div>
                      <p
                        className="font-heading text-[10px] tracking-wide mt-2 mb-1.5"
                        style={{ color: Accents.red }}
                      >
                        NO REASONS WHY. NEW COMPLETION DATE ONLY.
                      </p>
                      <div className="max-w-[260px]">
                        <DateField
                          label="New Completion Date"
                          value={d.newDate}
                          onChange={(iso) => onEdit(i, (x) => { x.newDate = iso; })}
                        />
                      </div>
                      <FLabel>Note (optional, 1 to 3 sentences max)</FLabel>
                      <textarea
                        value={d.note}
                        onChange={(e) => onEdit(i, (x) => { x.note = e.target.value; })}
                        placeholder="What happens next. Not why it didn't happen."
                        maxLength={280}
                        autoCorrect="off"
                        spellCheck={false}
                        style={{
                          backgroundColor: d.note.trim() ? FIELD_EMPTY : "var(--field-red)",
                          borderColor: d.note.trim() ? "var(--field-empty-border)" : "var(--field-red-border)",
                        }}
                        className="w-full min-h-[64px] rounded-[10px] border-[1.5px] px-3 py-3 text-[15px] text-on-card outline-none focus:border-gold placeholder:text-placeholder"
                      />
                      <p
                        className="text-[12px] font-semibold mt-1.5"
                        style={{ color: countSentences(d.note) > 3 ? Accents.red : "var(--muted)" }}
                      >
                        {countSentences(d.note)} / 3 sentences
                        {countSentences(d.note) > 3 ? ", too long, cut it down" : ""}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          }
        />
      ))}
      <AddButton label="+ Delegate task or follow-up" accent={accent} onClick={onAdd} />
    </section>
  );
}
