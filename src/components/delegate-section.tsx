"use client";

import { Accents } from "@/lib/pillars";
import { SectionLabel, AddButton } from "@/components/ui";
import { TaskRow, DateField, type TaskAction } from "@/components/task";
import type { Deleg } from "@/pillars/schemas/types";

/**
 * "Delegate or Follow Up": what was handed to whom, by when, ticked once it has
 * been chased.
 *
 * ONE list, two homes: Pillar 1 (per goal) and, per business, the "Delegation"
 * department in Pillar 5 — Zaffar asked for that department to work exactly
 * like Pillar 1's delegate or follow-up (18 Sep 2026). The caller owns where
 * the rows live, so every change goes out through a callback; adding in
 * particular stays at the call site, where `blankDeleg()` gives the new row a
 * real id.
 */
export function DelegateSection({
  items,
  accent = Accents.blue,
  onAdd,
  onEdit,
  onRemove,
  onFile,
}: {
  items: Deleg[];
  accent?: string;
  onAdd: () => void;
  onEdit: (i: number, mut: (d: Deleg) => void) => void;
  onRemove: (i: number) => void;
  /** Move a chased row to the filed archive. */
  onFile: (i: number) => void;
}) {
  const actions = (i: number): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => onRemove(i) },
    { label: "File", kind: "file", onClick: () => onFile(i) },
  ];
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
          onToggle={(v) => onEdit(i, (x) => { x.done = v; })}
          onDelete={() => onRemove(i)}
          actions={actions(i)}
          locked={i > 0 && !items[i - 1].text.trim()}
          placeholder="What would you like to delegate?"
          showWho
          who={d.who}
          onChangeWho={(text) => onEdit(i, (x) => { x.who = text; })}
          /* The deadline. `due` was always in the shared shape, and the
             reports already print it and count overdue items. */
          below={
            <div className="max-w-[260px]">
              <DateField label="Deadline" value={d.due} onChange={(iso) => onEdit(i, (x) => { x.due = iso; })} />
            </div>
          }
        />
      ))}
      <AddButton label="+ Delegate task or follow-up" accent={accent} onClick={onAdd} />
    </section>
  );
}
