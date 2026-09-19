"use client";

import { Accents, rowLockedDated, lockReason } from "@/lib/pillars";
import { weekdayShortDate } from "@/lib/dates";
import { SectionLabel, AddButton, MiwBox } from "@/components/ui";
import { TaskRow, DateField, FiledBox, type TaskAction } from "@/components/task";
import { useDialog } from "@/components/dialog";
import { blankIdea, type IdeaState } from "@/pillars/schemas/idea";

/** The wording that differs between the Loyalty and AI boards. */
export interface IdeaCfg {
  mark: string;
  iodSmall: string;
  iodPh: string;
  listName: string;
  fileVerb: string;
  archiveTitle: string;
  archiveEmpty: string;
  archiveClear: string;
  clearConfirm: string;
  datePrefix: string;
}

/**
 * The Loyalty / AI idea board — the web port of the phone's `idea-board.tsx`.
 *
 * It lives inside a Pillar 5 SYSTEM rather than owning a pillar, so it takes
 * its state and updater as props instead of calling `usePillarState`: the data
 * sits in the business-systems blob under `System.idea`, which is why it is per
 * business rather than per user.
 *
 * Same three lists as the phone — Idea of the Day, a numbered five, and an
 * unlimited Extra — each idea carrying its own "Implement by" date directly
 * beneath it, because a date is only meaningful next to the thing it dates.
 */
export function IdeaBoard({
  state,
  update,
  accent,
  cfg,
}: {
  state: IdeaState;
  update: (mut: (s: IdeaState) => void) => void;
  accent: string;
  cfg: IdeaCfg;
}) {
  const dialog = useDialog();

  const fileIdea = async (text: string, impl: string, clear: () => void) => {
    if (!text.trim()) {
      await dialog.alert("This idea is empty.");
      return;
    }
    update((s) => { s.filed = [{ text, date: weekdayShortDate(), impl }, ...s.filed]; });
    clear();
  };

  const iodActions = (): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => update((s) => { s.iod = blankIdea(); }) },
    {
      label: cfg.fileVerb,
      kind: "file",
      onClick: () => void fileIdea(state.iod.text, state.iod.impl, () => update((s) => { s.iod = blankIdea(); })),
    },
  ];
  /* The numbered five are FIXED slots: deleting one blanks it rather than
     splicing, so idea 4 does not silently become idea 3. Extra ideas are a
     growing list and do splice. */
  const listActions = (i: number): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => update((s) => { s.ideas[i] = blankIdea(); }) },
    {
      label: cfg.fileVerb,
      kind: "file",
      onClick: () => void fileIdea(state.ideas[i].text, state.ideas[i].impl, () => update((s) => { s.ideas[i] = blankIdea(); })),
    },
  ];
  const extraActions = (i: number): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => update((s) => { s.extra.splice(i, 1); }) },
    {
      label: cfg.fileVerb,
      kind: "file",
      onClick: () => void fileIdea(state.extra[i].text, state.extra[i].impl, () => update((s) => { s.extra.splice(i, 1); })),
    },
  ];

  /** The "Implement by" date. It goes in the row's own `below` slot, so it
   *  starts on the same left edge as the idea text (Zaffar, 19 Sep: "idea and
   *  date ... align from left side"). Always shown, even before the idea is
   *  written, so no list looks as if it has no date ("Under extra idea you
   *  forgot to put implement by"). */
  const implRow = (value: string, onChange: (iso: string) => void) => (
    <div className="max-w-[260px]">
      <DateField label="Implement by" value={value} onChange={onChange} />
    </div>
  );

  /* Dates are compulsory (Zaffar, 19 Sep): the next idea opens only once the
     one before it has its words AND its implement-by date. */
  const IMPL = "implement by date";

  const addExtra = () => {
    const last = state.extra[state.extra.length - 1];
    if (last && !last.text.trim()) {
      void dialog.alert("Write the last extra idea first.");
      return;
    }
    if (last && !last.impl.trim()) {
      void dialog.alert("Choose the implement by date first.", "Every idea needs its date before you add the next one.");
      return;
    }
    update((s) => { s.extra.push(blankIdea()); });
  };

  return (
    <>
      {/* Idea of the Day */}
      <section className="mb-8">
        <SectionLabel text="Idea of the Day" small={cfg.iodSmall} color={accent} />
        <MiwBox accent={accent}>
          <TaskRow
            accent={accent}
            symbol={cfg.mark}
            value={state.iod.text}
            done={state.iod.done}
            onChange={(t) => update((s) => { s.iod.text = t; })}
            onToggle={(v) => update((s) => { s.iod.done = v; })}
            placeholder={cfg.iodPh}
            actions={iodActions()}
            below={implRow(state.iod.impl, (iso) => update((s) => { s.iod.impl = iso; }))}
          />
        </MiwBox>
      </section>

      {/* The numbered five */}
      <section className="mb-8">
        <SectionLabel text={cfg.listName} small="numbered 1 to 5" color={accent} />
        {state.ideas.map((it, i) => (
          <div key={i}>
            <TaskRow
              accent={accent}
              symbol={i + 1}
              value={it.text}
              done={it.done}
              onChange={(t) => update((s) => { s.ideas[i].text = t; })}
              onToggle={(v) => update((s) => { s.ideas[i].done = v; })}
              actions={listActions(i)}
              locked={rowLockedDated(state.ideas, i, "impl")}
              lockedReason={lockReason(state.ideas, i, IMPL)}
              placeholder={`Idea ${i + 1}`}
              below={implRow(it.impl, (iso) => update((s) => { s.ideas[i].impl = iso; }))}
            />
          </div>
        ))}
      </section>

      {/* Extra ideas — green, like every other "keep going" list in the app */}
      <section className="mb-8">
        <SectionLabel text="Extra Ideas" small="keep them coming, no limit" color={Accents.green} />
        {state.extra.map((it, i) => (
          <div key={i}>
            <TaskRow
              accent={Accents.green}
              symbol="+"
              value={it.text}
              done={it.done}
              onChange={(t) => update((s) => { s.extra[i].text = t; })}
              onToggle={(v) => update((s) => { s.extra[i].done = v; })}
              onDelete={() => update((s) => { s.extra.splice(i, 1); })}
              actions={extraActions(i)}
              locked={rowLockedDated(state.extra, i, "impl")}
              lockedReason={lockReason(state.extra, i, IMPL)}
              placeholder="Extra idea"
              below={implRow(it.impl, (iso) => update((s) => { s.extra[i].impl = iso; }))}
            />
          </div>
        ))}
        <AddButton
          label="+ Add extra idea"
          accent={Accents.green}
          onClick={addExtra}
        />
      </section>

      {/* Archive */}
      <FiledBox
        title={cfg.archiveTitle}
        empty={cfg.archiveEmpty}
        clearLabel={cfg.archiveClear}
        hasItems={state.filed.length > 0}
        onClear={async () => {
          if (await dialog.confirm(cfg.clearConfirm, { confirmLabel: "Delete", danger: true })) {
            update((s) => { s.filed = []; });
          }
        }}
      >
        {state.filed.map((f, i) => (
          <div key={i} className="border-b border-line py-2.5">
            <p className="text-[13.5px] font-bold leading-snug text-ink">
              <span style={{ color: accent }}>{cfg.mark}</span> {f.text}
            </p>
            <p className="mt-0.5 text-[11.5px] font-medium text-muted">
              {cfg.datePrefix}
              {f.date}
            </p>
          </div>
        ))}
      </FiledBox>
    </>
  );
}
