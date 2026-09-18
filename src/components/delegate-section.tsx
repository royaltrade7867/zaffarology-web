"use client";

import { useState } from "react";

import { Accents, FIELD_EMPTY } from "@/lib/pillars";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { SectionLabel, AddButton, GrowField } from "@/components/ui";
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

  /* ONE task at a time, with Prev/Next — the same shape Pillar 1 uses for
     goals. Stacking them meant a new task appeared below the last one, so by
     the fifth the page was a wall of half-answered huddle blocks. Each row now
     carries a person, a deadline, a done/not-done answer and possibly a note;
     that is a page, not a line.

     `cur` is clamped rather than stored safe: a row can be deleted from under
     it, and an index past the end would render nothing at all. */
  const [cur, setCur] = useState(0);
  const idx = Math.min(cur, Math.max(0, items.length - 1));
  const d = items[idx];

  const goTo = (n: number) => setCur(Math.max(0, Math.min(n, items.length - 1)));

  const navBtn = (off: boolean) => ({
    borderColor: off ? "var(--line)" : accent,
    color: off ? "var(--muted)" : accent,
    cursor: off ? "not-allowed" : "pointer",
  });

  const add = () => {
    onAdd();
    // Land on the task just created, not wherever the pager happened to be.
    setCur(items.length);
  };

  return (
    <section className="mb-8">
      <SectionLabel text="Delegate or Follow Up" small="tick when you've chased it" color={accent} />

      {/* The pager. Hidden for a single task: two disabled arrows around
          "1 of 1" is furniture that explains nothing. */}
      {items.length > 1 ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => goTo(idx - 1)}
            aria-label="Previous delegated task"
            title="Previous delegated task"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] transition-colors"
            style={navBtn(idx === 0)}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <span aria-live="polite" className="font-heading text-[12px] uppercase tracking-wide text-ink">
              {`Task ${idx + 1} of ${items.length}`}
            </span>
            <div className="flex items-center">
              {items.map((it, i) => {
                const on = i === idx;
                return (
                  <button
                    key={it.id || i}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Go to task ${i + 1}${it.text.trim() ? `: ${it.text.trim()}` : ""}`}
                    aria-current={on ? "true" : undefined}
                    title={it.text.trim() || `Task ${i + 1}`}
                    className="tap-target flex items-center justify-center"
                  >
                    <span
                      aria-hidden
                      className="block rounded-full transition-all"
                      style={{
                        width: on ? 20 : 8,
                        height: 8,
                        backgroundColor: on ? accent : "var(--line)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            disabled={idx >= items.length - 1}
            onClick={() => goTo(idx + 1)}
            aria-label="Next delegated task"
            title="Next delegated task"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] transition-colors"
            style={navBtn(idx >= items.length - 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : null}

      {d ? (
        <TaskRow
          key={d.id || idx}
          accent={accent}
          symbol="→"
          value={d.text}
          done={d.done}
          onChange={(text) => onEdit(idx, (x) => { x.text = text; })}
          onToggle={(v) => onEdit(idx, (x) => {
            x.done = v;
            /* Keep the two answers in step. Un-ticking a row that was marked
               completed must not leave `status: 'completed'` behind, or the
               huddle block below would still show a completion date for a task
               that is open again. */
            if (v && x.status !== "completed") x.status = "completed";
            if (!v && x.status === "completed") x.status = "";
          })}
          onDelete={() => onRemove(idx)}
          actions={actions(idx)}
          /* No `locked` here any more. It existed to stop someone filling row 3
             while row 2 was blank — visible when the rows were stacked. In a
             pager you only ever see one, so a locked field would read as
             broken, with the reason on a page you are not looking at. */
          placeholder="What would you like to delegate?"
          /* The plain who-field only when there is nothing to tag against;
             otherwise `PersonTagField` below owns it, and showing both would
             be two inputs for one value. */
          showWho={!canTag}
          who={d.who}
          onChangeWho={(text) => onEdit(idx, (x) => { x.who = text; })}
          below={
            <div className="space-y-2">
              {canTag ? (
                <PersonTagField
                  label="To whom"
                  value={d.who}
                  placeholder="Who owns it?"
                  onChangeText={(t) => onEdit(idx, (x) => { x.who = t; })}
                  accent={accent}
                  partners={partners!}
                  tagUserId={d.whoUserId}
                  onTag={(p, notify) => onTag!(idx, p, notify)}
                  statusNote={statusNoteFor?.(d) ?? null}
                />
              ) : null}

              {/* The deadline. `due` was always in the shared shape, and the
                  reports already print it and count overdue items. */}
              <div className="max-w-[260px]">
                <DateField label="Deadline" value={d.due} onChange={(iso) => onEdit(idx, (x) => { x.due = iso; })} />
              </div>

              {/* Only ask once there is something to ask about. An empty row
                  showing "Completed / Not Completed" invites an answer about a
                  task that does not exist yet. */}
              {d.text.trim() ? (
                <>
                  <YesNoRow
                    value={d.status === "completed" ? "yes" : d.status === "notdone" ? "no" : ""}
                    onChange={(v) => onEdit(idx, (x) => {
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
                        onChange={(iso) => onEdit(idx, (x) => { x.completedOn = iso; })}
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
                          onChange={(iso) => onEdit(idx, (x) => { x.newDate = iso; })}
                        />
                      </div>
                      <FLabel>Note (optional, 1 to 3 sentences max)</FLabel>
                      {/* `GrowField`, not a bare textarea: it carries
                          `useAutoGrow`, so the box starts at one line and grows
                          with the answer instead of opening as an empty
                          three-line block. */}
                      <GrowField
                        value={d.note}
                        onChange={(v) => onEdit(idx, (x) => { x.note = v; })}
                        placeholder="What happens next. Not why it didn't happen."
                        maxLength={280}
                        style={{
                          backgroundColor: d.note.trim() ? FIELD_EMPTY : "var(--field-red)",
                          borderColor: d.note.trim() ? "var(--field-empty-border)" : "var(--field-red-border)",
                        }}
                        className="w-full min-h-[40px] rounded-[10px] border-[1.5px] px-3 py-3 text-[15px] text-on-card outline-none focus:border-line-focus placeholder:text-placeholder"
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
      ) : null}

      <AddButton label="+ Delegate task or follow-up" accent={accent} onClick={add} />
    </section>
  );
}
