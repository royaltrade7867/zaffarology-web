"use client";

import { useEffect, type ReactNode } from "react";

import { pillarByNumber, Accents, INK, FIELD_EMPTY } from "@/lib/pillars";
import { shortDate, todayKey } from "@/lib/dates";
import { usePillarState } from "@/lib/use-pillar-state";
import { PillarScaffold } from "@/components/pillar-scaffold";
import { Loading, MiwBox, SectionLabel, AddButton, CharsLeft } from "@/components/ui";
import { TaskRow, Footer, FiledBox, PassNote, DayReport, DayGroup, DayTask, DayField, type TaskAction } from "@/components/task";
import { useDialog } from "@/components/dialog";
/**
 * Types come from the SHARED schema, not local copies.
 *
 * Both apps write the same `/v3/pillars/{key}` blob and the builders rebuild
 * from a whitelist, so a field this file did not name was dropped whenever the
 * browser saved. Pillar 4 was losing `id` and `assigneeUserId` exactly that
 * way, which orphans task assignments. One definition means no drift.
 */
import {
  type DaySnap,
  type Filed,
  type P3State,
  type Section,
  type Task,
  normalize,
} from "@/pillars/schemas/pillar-3";


const makeInitial = (): P3State => ({
  work: { text: "", done: false },
  dod: Array.from({ length: 5 }, () => ({ text: "", done: false })),
  extra: [],
  pm: "",
  money: "",
  filed: [],
  day: todayKey(),
  history: [],
});

/** Whether today's board has anything worth keeping in history. */
const hasDay = (s: P3State) =>
  !!(
    s.work.text.trim() ||
    s.dod.some((t) => t.text.trim()) ||
    s.extra.some((t) => t.text.trim()) ||
    s.pm.trim() ||
    s.money.trim()
  );

/** Snapshot the whole closing day into history, then clear everything for a fresh day. */
function rollover(s: P3State, closingDate: string) {
  if (hasDay(s)) {
    const snap: DaySnap = { date: closingDate, work: s.work, dod: s.dod, extra: s.extra, pm: s.pm, money: s.money };
    // Collapse multiple rolls on the same closing date into one entry.
    if (s.history[0]?.date === closingDate) s.history[0] = snap;
    else s.history = [snap, ...s.history].slice(0, 180);
  }
  s.work = { text: "", done: false };
  s.dod = Array.from({ length: 5 }, () => ({ text: "", done: false }));
  s.extra = [];
  s.pm = "";
  s.money = "";
  s.day = todayKey();
}

const pillar = pillarByNumber(3)!;
const RED = Accents.red;
const GREEN = Accents.green;

const TAG: Record<Section, { label: string; color: string; bg: string }> = {
  work: { label: "Work of Day", color: INK, bg: "rgba(25,26,30,0.08)" },
  dod: { label: "Do or Die", color: RED, bg: "rgba(200,16,46,0.1)" },
  extra: { label: "Extra Mile", color: GREEN, bg: "rgba(31,107,74,0.1)" },
};

export default function Pillar3() {
  const dialog = useDialog();
  const { state, update, loaded, status, retrySave } = usePillarState<P3State>(pillar.key, makeInitial, normalize);

  useEffect(() => {
    if (!loaded) return;
    const today = todayKey();
    if (!state.day) update((s) => { s.day = today; });
    else if (state.day !== today) update((s) => { if (s.day !== today) rollover(s, s.day); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!loaded) return <Loading />;

  const dodDone = state.dod.filter((t) => t.done).length;

  const planned = [state.work, ...state.dod, ...state.extra].filter((t) => t.text.trim());
  const achievedN = planned.filter((t) => t.done).length;

  const fileTask = (text: string, section: Section, clear: () => void) => {
    if (!text.trim()) return void dialog.alert("This task is empty, nothing to file.");
    /* `shortDate()` ("5 Aug 2026"), not `mdDate()` ("5 Aug"): Pillars 1, 2 and 4
       all file with the year, and this screen showed "Wed, 5 Aug 2026" in its
       Previous Days headers one section above — two formats on one page. The
       date is stored ALREADY FORMATTED, so a yearless row loses its year for
       good; rows filed before this change keep the short text they were saved
       with, since the year they belong to cannot be recovered. */
    update((s) => { s.filed = [{ text, section, date: shortDate() }, ...s.filed]; });
    clear();
  };

  const newDay = async () => {
    if (!await dialog.confirm("Start a new day? Today is saved to Previous Days first, then everything clears for a fresh day.")) return;
    update((s) => { rollover(s, s.day || todayKey()); });
  };

  const workActions = (): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => update((s) => { s.work = { text: "", done: false }; }) },
    { label: "File", kind: "file", onClick: () => fileTask(state.work.text, "work", () => update((s) => { s.work = { text: "", done: false }; })) },
  ];
  const dodActions = (i: number): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => update((s) => { s.dod[i] = { text: "", done: false }; }) },
    { label: "File", kind: "file", onClick: () => fileTask(state.dod[i].text, "dod", () => update((s) => { s.dod[i] = { text: "", done: false }; })) },
  ];
  const extraActions = (i: number): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => update((s) => { s.extra.splice(i, 1); }) },
    { label: "File", kind: "file", onClick: () => fileTask(state.extra[i].text, "extra", () => update((s) => { s.extra.splice(i, 1); })) },
  ];

  return (
    <PillarScaffold pillar={pillar} saveStatus={status} onRetrySave={retrySave}>
      {/* ☀ AM Planning */}
      <p className="font-heading text-[20px] uppercase" style={{ color: Accents.gold }}>
        ☀ AM <span style={{ color: "var(--heading)" }}>PLANNING</span>
      </p>
      <p className="font-medium text-[12px] mt-1 mb-5" style={{ color: "var(--muted)" }}>
        Set in the morning, plan the money-making day.
      </p>

      <section className="mb-8">
        <SectionLabel text="Work of the Day" small="only one, the money move that matters most" />
        <MiwBox accent={RED}>
          <TaskRow accent={RED} symbol="★" value={state.work.text} done={state.work.done} onChange={(t) => update((s) => { s.work.text = t; })} onToggle={(v) => update((s) => { s.work.done = v; })} placeholder="If you do nothing else, do this…" noBorder actions={workActions()} />
        </MiwBox>
      </section>

      <section className="mb-8">
        <SectionLabel text="Do or Die Tasks" small="max 5, no more" color={RED} />
        {state.dod.map((t, i) => (
          <TaskRow key={i} accent={RED} symbol={i + 1} value={t.text} done={t.done} onChange={(text) => update((s) => { s.dod[i].text = text; })} onToggle={(v) => update((s) => { s.dod[i].done = v; })} actions={dodActions(i)} placeholder={`Do-or-die task ${i + 1}`} locked={i > 0 && !state.dod[i - 1].text.trim()} />
        ))}
        <Footer progress={`${dodDone} / 5 do-or-die done`} resetLabel="New day (reset)" onReset={newDay} />
      </section>

      <section className="mb-8">
        <SectionLabel text="Go-Extra-Mile Daily Tasks" small="anything beyond the 5" color={GREEN} />
        {state.extra.map((t, i) => (
          <TaskRow key={i} accent={GREEN} symbol="+" value={t.text} done={t.done} onChange={(text) => update((s) => { s.extra[i].text = text; })} onToggle={(v) => update((s) => { s.extra[i].done = v; })} onDelete={() => update((s) => { s.extra.splice(i, 1); })} actions={extraActions(i)} locked={i > 0 && !state.extra[i - 1].text.trim()} placeholder="Extra task" />
        ))}
        <AddButton label="+ Add extra-mile task" accent={GREEN} onClick={() => update((s) => { s.extra.push({ text: "", done: false }); })} />
      </section>

      {/* ☾ PM Achievement */}
      <div className="border-t-[3px] border-ink pt-6 mt-2">
        <p className="font-heading text-[20px] uppercase" style={{ color: GREEN }}>
          ☾ PM <span style={{ color: "var(--heading)" }}>ACHIEVEMENT</span>
        </p>
        <p className="font-medium text-[12px] mt-1 mb-5" style={{ color: "var(--muted)" }}>
          Fill in the evening, what did the day actually produce?
        </p>
      </div>

      {/* AM Plan Check */}
      <section className="mb-8">
        <SectionLabel text="AM Plan Check" small="exactly what you wrote this morning, achieved or not?" />
        <div className="rounded-xl border bg-surface p-3.5" style={{ borderColor: "var(--line)" }}>
          <ReviewGroup label="Work of the Day" color={INK}>
            <ReviewItem tag="Work" task={state.work} onToggle={(v) => update((s) => { s.work.done = v; })} />
          </ReviewGroup>
          <ReviewGroup label="Do or Die Tasks" color={RED}>
            {state.dod.map((t, i) => (
              <ReviewItem key={i} tag={`Task ${i + 1}`} task={t} onToggle={(v) => update((s) => { s.dod[i].done = v; })} />
            ))}
          </ReviewGroup>
          <ReviewGroup label="Go-Extra-Mile Daily Tasks" color={GREEN}>
            {state.extra.length ? (
              state.extra.map((t, i) => (
                <ReviewItem key={i} tag={`Extra ${i + 1}`} task={t} onToggle={(v) => update((s) => { s.extra[i].done = v; })} />
              ))
            ) : (
              <p className="text-[12px] italic text-muted">(no extra-mile tasks this morning)</p>
            )}
          </ReviewGroup>
        </div>
        {planned.length > 0 ? (
          achievedN === planned.length ? (
            <PassNote kind="pass">YES, all {planned.length} achieved 🔥</PassNote>
          ) : (
            <PassNote kind="fail">NOT YET, {achievedN} of {planned.length} achieved</PassNote>
          )
        ) : null}
      </section>

      {/* Today's Achievement */}
      <section className="mb-8">
        <SectionLabel text="Today's Achievement" small="results, wins, money moves made" color={GREEN} />
        <MiwBox accent={GREEN}>
          <textarea
            value={state.pm}
            onChange={(e) => update((s) => { s.pm = e.target.value; })}
            placeholder="What did you achieve today? What moved the money forward?"
            maxLength={600}
            autoCorrect="off"
            spellCheck={false}
            style={{ backgroundColor: state.pm.trim() ? "var(--field)" : FIELD_EMPTY }}
            className="w-full min-h-[80px] rounded-lg px-2 py-1.5 text-[15px] text-on-card outline-none resize-y placeholder:text-placeholder"
          />
            <CharsLeft value={state.pm} max={600} />
          <div className="flex items-center gap-2.5 mt-3">
            <span className="font-heading text-[11px] tracking-[0.15em]" style={{ color: GREEN }}>$ MONEY MADE</span>
            {/* Money, so keep it to digits and one decimal point: this was
                `inputMode="text"`, which raises the full alphabetic keyboard on
                a phone for a number, and accepted `abc-!@#$` verbatim.

                `min-w-0` and `size={1}` are what let it SHRINK. A flex item
                keeps `min-width: auto`, which for an input resolves to its
                intrinsic width from the default `size="20"` — about 241px at
                this font. At a 320px viewport that pushed the field 7px past
                the edge, and since the page never scrolls sideways the overflow
                was unreachable rather than merely ugly. */}
            <input
              value={state.money}
              onChange={(e) =>
                update((s) => {
                  const cleaned = e.target.value.replace(/[^\d.]/g, "");
                  const [whole, ...rest] = cleaned.split(".");
                  s.money = rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
                })
              }
              placeholder="e.g. 250"
              maxLength={20}
              size={1}
              inputMode="decimal"
              aria-label="Money made today"
              autoCorrect="off"
              spellCheck={false}
              /* The ink is `--on-card`, never the pillar accent. A field is white
                 or green paper in BOTH themes, but `--p3` is lightened to #5fc191
                 for the navy page, which lands at 1.61:1 on the empty green wash —
                 invisible exactly when the box is blank and most needs reading.
                 That is what "money made is not working" was. `--on-card` gives
                 12.71:1 empty and 17.39:1 filled. The accent stays on the border,
                 where it is decoration rather than text. */
              style={{ borderColor: GREEN, backgroundColor: state.money.trim() ? "var(--field)" : FIELD_EMPTY }}
              className="min-w-0 flex-1 rounded border-2 px-2.5 py-1.5 font-heading text-[16px] text-on-card outline-none placeholder:text-placeholder"
            />
          </div>
        </MiwBox>
      </section>

      {/* Previous days */}
      <DayReport
        history={state.history}
        renderDay={(d) => (
          <>
            <DayGroup label="Work of the Day" color={INK}>
              <DayTask text={d.work.text} done={d.work.done} accent={RED} />
            </DayGroup>
            <DayGroup label="Do or Die" color={RED}>
              {d.dod.map((t, i) => (
                <DayTask key={i} text={t.text} done={t.done} accent={RED} />
              ))}
            </DayGroup>
            {d.extra.some((t) => t.text.trim()) ? (
              <DayGroup label="Extra Mile" color={GREEN}>
                {d.extra.map((t, i) => (
                  <DayTask key={i} text={t.text} done={t.done} accent={GREEN} />
                ))}
              </DayGroup>
            ) : null}
            <DayField label="PM Achievement" value={d.pm} />
            <DayField label="Money made" value={d.money.trim() ? `$${d.money.trim()}` : ""} />
          </>
        )}
      />

      {/* Filed Tasks */}
      <FiledBox
        title="Filed Tasks"
        empty="Nothing filed yet."
        clearLabel="Clear all filed"
        hasItems={state.filed.length > 0}
        onClear={async () => { if (await dialog.confirm("Delete everything in the filed archive?", { confirmLabel: "Delete all", danger: true })) update((s) => { s.filed = []; }); }}
      >
        {state.filed.map((f, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2 border-b border-line">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide" style={{ backgroundColor: TAG[f.section].bg, color: TAG[f.section].color }}>{TAG[f.section].label.toUpperCase()}</span>
            <span className="flex-1 truncate text-[13px] text-ink">{f.text}</span>
            <span className="text-[11px] text-muted">{f.date}</span>
          </div>
        ))}
      </FiledBox>
    </PillarScaffold>
  );
}

function ReviewGroup({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <p className="font-heading text-[10px] tracking-wide mb-1.5" style={{ color }}>{label.toUpperCase()}</p>
      {children}
    </div>
  );
}

function ReviewItem({ tag, task, onToggle }: { tag: string; task: Task; onToggle: (v: boolean) => void }) {
  if (!task.text.trim()) {
    return (
      <div className="flex items-center gap-2 py-[3px]">
        <span className="font-semibold text-[11px] min-w-[44px]" style={{ color: "var(--muted)" }}>{tag}</span>
        <span className="text-[12px] italic text-muted">(not set this morning)</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 py-[3px]">
      {/* 20px glyph in a 24px button (WCAG 2.2 target size), with the task's own
          words as its name — it announced only "✗ button", with no indication of
          which task or what it toggles. */}
      <button
        type="button"
        onClick={() => onToggle(!task.done)}
        aria-pressed={task.done}
        aria-label={`${task.done ? "Achieved" : "Not achieved"}: ${task.text.trim()}`}
        title={task.done ? "Achieved, click to undo" : "Not achieved, click to mark done"}
        className="shrink-0 tap-target bg-transparent"
      >
        <span
          aria-hidden
          className="w-5 h-5 rounded-[2px] border-[1.5px] flex items-center justify-center font-bold text-[12px]"
          style={{ borderColor: task.done ? GREEN : RED, color: task.done ? GREEN : RED }}
        >
          {task.done ? "✓" : "✗"}
        </span>
      </button>
      <span className="font-semibold text-[11px] min-w-[44px]" style={{ color: "var(--muted)" }}>{tag}</span>
      <span className="flex-1 truncate text-[13px]" style={{ color: task.done ? "var(--muted)" : INK, textDecorationLine: task.done ? "line-through" : "none" }}>
        {task.text}
      </span>
    </div>
  );
}
