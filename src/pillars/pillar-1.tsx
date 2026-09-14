"use client";

import { useEffect, useState } from "react";

import { pillarByNumber, Accents, INK } from "@/lib/pillars";
import { friendlyISO, shortDate, todayKey } from "@/lib/dates";
import { usePillarState } from "@/lib/use-pillar-state";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { PillarScaffold } from "@/components/pillar-scaffold";
import { Loading, MiwBox, SectionLabel, AddButton, TextArea, CharsLeft } from "@/components/ui";
import { useDialog } from "@/components/dialog";
import {
  TaskRow,
  Footer,
  FiledBox,
  DateField,
  DayReport,
  DayGroup,
  DayTask,
  DayField,
  type TaskAction,
} from "@/components/task";

/**
 * Types and state helpers come from the SHARED schema, not local copies.
 *
 * Each goal is a self-contained project owning its plan, target date and its own
 * work-of-day / do-or-die / extra-mile / delegated lists. This screen used to
 * keep those four lists at the TOP level and rebuild each goal from `goal`/`plan`
 * alone, which silently deleted the per-goal lists a phone user had written —
 * both apps write the same `/v3/pillars/{key}` blob. One definition means the
 * two cannot drift again.
 */
import {
  blankDeleg,
  blankDod,
  blankTask,
  emptyGoal,
  makeInitial,
  normalize,
  type Deleg,
  type GoalPlan,
  type P1State,
  type Section,
  type Task,
} from "@/pillars/schemas/pillar-1";

/** Mobile caps Exact Goal / Exact Plan at 600. A SHORTER cap here does not
 *  just limit new input: the browser clamps an existing longer value the moment
 *  the user types, and the debounced whole-blob PUT then destroys the rest of
 *  what they wrote on the phone. Keep this in step with mobile. */
const GOAL_MAX = 600;

const pillar = pillarByNumber(1)!;
const RED = Accents.red;
const GREEN = Accents.green;
const BLUE = Accents.blue;
const TAG: Record<Section, { label: string; color: string; bg: string }> = {
  work: { label: "Work of Day", color: INK, bg: "rgba(25,26,30,0.08)" },
  dod: { label: "Do or Die", color: RED, bg: "rgba(200,16,46,0.1)" },
  extra: { label: "Extra Mile", color: GREEN, bg: "rgba(31,107,74,0.1)" },
  deleg: { label: "Delegated", color: BLUE, bg: "rgba(30,78,140,0.1)" },
};

/** Whether a single goal has anything worth keeping. */
const goalHasContent = (g: GoalPlan) =>
  !!(
    g.goal.trim() ||
    g.plan.trim() ||
    g.target.trim() ||
    g.work.text.trim() ||
    g.dod.some((t) => t.text.trim()) ||
    g.extra.some((t) => t.text.trim()) ||
    g.deleg.some((d) => d.text.trim())
  );

const hasDay = (s: P1State) => s.goals.some(goalHasContent);

/**
 * Snapshot the whole closing day, then clear the daily task lists for a fresh
 * day. Goals, plans and target dates PERSIST — they are projects, not day
 * entries; only un-chased delegated items carry over. Mirrors mobile exactly,
 * because both apps roll over the same blob.
 */
function rollover(s: P1State, closingDate: string) {
  if (hasDay(s)) {
    const snap = { date: closingDate, goals: s.goals.map((g) => ({ ...g })) };
    // Collapse multiple rolls on the same closing date into one entry.
    if (s.history[0]?.date === closingDate) s.history[0] = snap;
    else s.history = [snap, ...s.history].slice(0, 180);
  }
  s.goals = s.goals.map((g) => ({
    ...g,
    work: blankTask(),
    dod: blankDod(),
    extra: [],
    deleg: g.deleg.filter((d) => !d.done && d.text.trim()),
  }));
  s.day = todayKey();
}

export default function Pillar1() {
  const dialog = useDialog();
  const { state, update, loaded, status, retrySave } = usePillarState<P1State>(pillar.key, makeInitial, normalize);
  const [cur, setCur] = useState(0);

  useEffect(() => {
    if (!loaded) return;
    const today = todayKey();
    if (!state.day) update((s) => { s.day = today; });
    else if (state.day !== today) update((s) => { if (s.day !== today) rollover(s, s.day); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!loaded) return <Loading />;

  // ---- current goal (the "project" being viewed) -------------------------
  const goals = state.goals.length ? state.goals : [emptyGoal()];
  const gi = Math.min(cur, goals.length - 1);
  const g = goals[gi];
  const dodDone = g.dod.filter((t) => t.done).length;

  /** Mutate the currently-viewed goal.
   *  `gi` is captured at render time, but a deferred callback can fire after the
   *  goal was removed — so re-clamp inside the updater rather than indexing
   *  blindly, which would throw on undefined. */
  const setG = (fn: (goal: GoalPlan) => void) =>
    update((s) => {
      if (!s.goals.length) s.goals.push(emptyGoal());
      const i = Math.min(gi, s.goals.length - 1);
      fn(s.goals[i]);
    });

  const fileTask = (text: string, section: Section, clear: () => void) => {
    if (!text.trim()) return void dialog.alert("This task is empty, nothing to file.");
    update((s) => { s.filed = [{ text, section, date: shortDate() }, ...s.filed]; });
    clear();
  };

  // A new goal can only be started once the LAST goal in the list is filled in —
  // checking the currently-viewed goal instead would let you navigate back to a
  // complete goal 1 and add goal 3 while goal 2 sat blank in the middle.
  const lastGoal = goals[goals.length - 1];
  const lastFilled = !!(lastGoal && lastGoal.goal.trim() && lastGoal.plan.trim());

  const addGoal = () => {
    if (!lastFilled) {
      const n = goals.length;
      void dialog.alert(
        `Fill in ${!lastGoal?.goal.trim() ? `Exact Goal (Project) ${n}` : `Exact Plan ${n}`} before adding another goal.`,
      );
      setCur(goals.length - 1); // take the user to the goal that needs finishing
      return;
    }
    update((s) => { s.goals.push(emptyGoal()); });
    // Functional form: two fast clicks would otherwise both read the same
    // render-time length and land on the wrong index.
    setCur((c) => c + 1);
  };

  const removeGoal = async () => {
    if (!await dialog.confirm(`Delete Exact Goal (Project) ${gi + 1}?`, { body: "Its plan, target date and all of its tasks go too.", confirmLabel: "Delete", danger: true })) return;
    update((s) => {
      s.goals.splice(gi, 1);
      if (!s.goals.length) s.goals.push(emptyGoal());
    });
    setCur((c) => Math.max(0, c - 1));
  };

  const newDay = async () => {
    if (!await dialog.confirm("Start a new day? Today is saved to Previous Days first, then the daily tasks clear for a fresh day. Your goals, plans and target dates are kept, along with un-chased delegated items and your filed archive.")) return;
    update((s) => { rollover(s, s.day || todayKey()); });
  };

  const workActions = (): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => setG((x) => { x.work = blankTask(); }) },
    { label: "File", kind: "file", onClick: () => fileTask(g.work.text, "work", () => setG((x) => { x.work = blankTask(); })) },
  ];
  const dodActions = (i: number): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => setG((x) => { x.dod[i] = blankTask(); }) },
    { label: "File", kind: "file", onClick: () => fileTask(g.dod[i].text, "dod", () => setG((x) => { x.dod[i] = blankTask(); })) },
  ];
  const extraActions = (i: number): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => setG((x) => { x.extra.splice(i, 1); }) },
    { label: "File", kind: "file", onClick: () => fileTask(g.extra[i].text, "extra", () => setG((x) => { x.extra.splice(i, 1); })) },
  ];
  const delegActions = (i: number): TaskAction[] => [
    { label: "Delete", kind: "delete", onClick: () => setG((x) => { x.deleg.splice(i, 1); }) },
    { label: "File", kind: "file", onClick: () => { const d = g.deleg[i]; fileTask(d.text + (d.who ? ` → ${d.who}` : ""), "deleg", () => setG((x) => { x.deleg.splice(i, 1); })); } },
  ];

  // Extra-mile: only add another once the last one has text.
  const lastExtraFilled = !g.extra.length || !!g.extra[g.extra.length - 1].text.trim();
  const addExtra = () => {
    if (!lastExtraFilled) {
      void dialog.alert("Fill in the previous extra-mile task before adding another.");
      return;
    }
    setG((x) => { x.extra.push(blankTask()); });
  };

  /* A disabled arrow must LOOK disabled. Recolouring alone left it reading as
     active — `--muted` is ordinary secondary text — so at the first or last
     item clicking appeared to do nothing for no visible reason. */
  const navBtn = (disabled: boolean) =>
    ({
      borderColor: disabled ? "var(--line)" : pillar.accent,
      color: disabled ? "var(--muted)" : pillar.accent,
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
    }) as const;

  return (
    <PillarScaffold pillar={pillar} saveStatus={status} onRetrySave={retrySave}>
      {/* The goals, named, from `lg`.
          Everything below — work of the day, do-or-die, extra tasks, delegated
          rows — hangs off the SELECTED goal, so this cannot become "show both
          side by side": there is one day's list, and it belongs to one project.
          What the wide screen can fix is the blindness. "Goal 1 of 2" behind
          two arrows never says what goal 2 IS; this does, and switching is one
          click instead of a hunt. */}
      {goals.length > 1 ? (
        <div
          role="tablist"
          aria-label="Your goals"
          className="mb-5 hidden gap-2 border-b border-line lg:flex"
        >
          {goals.map((goal, i) => {
            const on = i === gi;
            const label = goal.goal.trim() || `Goal ${i + 1}`;
            return (
              <button
                key={i}
                role="tab"
                aria-selected={on}
                onClick={() => setCur(i)}
                title={label}
                /* The goal's own words, in full. A 22ch cap clipped the label
                   mid-word, and the goal text IS how the tabs are told apart. */
                className="-mb-px max-w-[34ch] border-b-2 px-1 pb-2.5 text-left text-[13.5px] font-semibold transition-colors"
                style={{
                  borderColor: on ? pillar.accent : "transparent",
                  color: on ? "var(--heading)" : "var(--muted)",
                }}
              >
                <span aria-hidden className="mr-1.5 tabular-nums" style={{ color: pillar.accent }}>
                  {i + 1}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Project navigator — one goal at a time.
          Below `lg` only: from `lg` the named switcher above replaces it. The
          whole day's list (work of the day, do-or-die, extra, delegated) hangs
          off the SELECTED goal, so this is a real selection, not pagination —
          which is why the wide layout names the goals rather than dropping the
          control. */}
      <div className="flex items-center justify-between mb-3 lg:hidden">
        <button
          type="button"
          disabled={gi === 0}
          onClick={() => setCur((c) => Math.max(0, c - 1))}
          aria-label="Previous goal"
            title="Previous goal"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border-[1.5px] transition-colors"
          style={navBtn(gi === 0)}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-heading text-[12px] tracking-wide uppercase" style={{ color: INK }}>
          {`Goal ${gi + 1} of ${goals.length}`}
        </span>
        <button
          type="button"
          disabled={gi >= goals.length - 1}
          onClick={() => setCur((c) => Math.min(goals.length - 1, c + 1))}
          aria-label="Next goal"
            title="Next goal"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border-[1.5px] transition-colors"
          style={navBtn(gi >= goals.length - 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Exact Goal — the project itself */}
      <section className="mb-8">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <SectionLabel text={`Exact Goal (Project) ${gi + 1}`} small="be specific, what exactly are you going for?" color={pillar.accent} />
          </div>
          {goals.length > 1 ? (
            <button
              type="button"
              onClick={removeGoal}
              aria-label={`Remove exact goal ${gi + 1}`}
              className="tap-row shrink-0 px-1.5 text-[12px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: RED }}
            >
              Remove
            </button>
          ) : null}
        </div>
        <MiwBox accent={pillar.accent}>
          <input
            value={g.goal}
            onChange={(e) => setG((x) => { x.goal = e.target.value; })}
            placeholder={`Write exact goal ${gi + 1} here…`}
            maxLength={GOAL_MAX}
            autoCorrect="off"
            spellCheck={false}
            style={{ backgroundColor: g.goal.trim() ? "var(--field-empty)" : "var(--field-red)" }}
            className="w-full rounded-lg px-2 py-2 font-semibold text-[16px] text-on-card outline-none placeholder:text-placeholder"
          />
          <CharsLeft value={g.goal} max={GOAL_MAX} />
          </MiwBox>

        <div className="mt-4">
          <SectionLabel text={`Exact Plan ${gi + 1}`} small="how you'll get there" color={pillar.accent} />
          <TextArea
            value={g.plan}
            onChange={(v) => setG((x) => { x.plan = v; })}
            placeholder={`Write the plan for goal ${gi + 1}: the steps, the order, the deadlines…`}
            maxLength={GOAL_MAX}
            tone="red"
          />
            <CharsLeft value={g.plan} max={GOAL_MAX} />
        </div>

        <div className="mt-4">
          <DateField label="Deadline" value={g.target} onChange={(iso) => setG((x) => { x.target = iso; })} />
        </div>

        <AddButton label="+ Add goal" accent={pillar.accent} dimmed={!lastFilled} onClick={addGoal} />
      </section>

      <div className="border-t-[3px] border-ink pt-3 mb-6">
        <p className="font-heading text-[20px] uppercase text-heading">Do <span style={{ color: RED }}>or</span> Die</p>
        <p className="font-semibold text-[12px] tracking-wide mt-1.5" style={{ color: RED }}>PRIORITISE YOUR DAY</p>
      </div>

      <section className="mb-8">
        <SectionLabel text="Work of the Day" small="only one, the thing that matters most" />
        <MiwBox accent={RED} filled={!!g.work.text.trim()}>
          <TaskRow accent={RED} symbol="★" value={g.work.text} done={g.work.done} onChange={(t) => setG((x) => { x.work.text = t; })} onToggle={(v) => setG((x) => { x.work.done = v; })} placeholder="If you do nothing else, do this…" noBorder actions={workActions()} />
        </MiwBox>
      </section>

      <section className="mb-8">
        <SectionLabel text="Do or Die Tasks" small="max 5, no more" color={RED} />
        {g.dod.map((t, i) => (
          <TaskRow key={i} accent={RED} symbol={i + 1} value={t.text} done={t.done} onChange={(text) => setG((x) => { x.dod[i].text = text; })} onToggle={(v) => setG((x) => { x.dod[i].done = v; })} actions={dodActions(i)} placeholder={`Do-or-die task ${i + 1}`} locked={i > 0 && !g.dod[i - 1].text.trim()} />
        ))}
        <Footer progress={`${dodDone} / 5 do-or-die done`} resetLabel="New day (reset)" onReset={newDay} />
      </section>

      <section className="mb-8">
        <SectionLabel text="Go-Extra-Mile Daily Tasks" small="anything beyond the 5" color={GREEN} />
        {g.extra.map((t, i) => (
          <TaskRow key={i} accent={GREEN} symbol="+" value={t.text} done={t.done} onChange={(text) => setG((x) => { x.extra[i].text = text; })} onToggle={(v) => setG((x) => { x.extra[i].done = v; })} onDelete={() => setG((x) => { x.extra.splice(i, 1); })} actions={extraActions(i)} locked={i > 0 && !g.extra[i - 1].text.trim()} placeholder="Extra task" />
        ))}
        <AddButton label="+ Add extra-mile task" accent={GREEN} dimmed={!lastExtraFilled} onClick={addExtra} />
      </section>

      <section className="mb-8">
        <SectionLabel text="Delegate or Follow Up" small="tick when you've chased it" color={BLUE} />
        {g.deleg.map((d, i) => (
          <TaskRow key={i} accent={BLUE} symbol="→" value={d.text} done={d.done} onChange={(text) => setG((x) => { x.deleg[i].text = text; })} onToggle={(v) => setG((x) => { x.deleg[i].done = v; })} onDelete={() => setG((x) => { x.deleg.splice(i, 1); })} actions={delegActions(i)} locked={i > 0 && !g.deleg[i - 1].text.trim()} placeholder="What did you delegate?" showWho who={d.who} onChangeWho={(text) => setG((x) => { x.deleg[i].who = text; })} />
        ))}
        {/* blankDeleg(), never an inline literal: a new row needs a real `id`
            (task assignments point at it) plus `due`/`whoUserId`. Without one,
            `withId` mints a fresh random id on every load until a save lands,
            so an assignment made on the phone loses its "Sent to X" badge. */}
        <AddButton label="+ Add delegated task to follow up" accent={BLUE} onClick={() => setG((x) => { x.deleg.push(blankDeleg()); })} />
      </section>

      {/* Previous days, grouped per goal/project */}
      <DayReport
        history={state.history}
        renderDay={(d) => (
          <>
            {(d.goals ?? []).map((gg: GoalPlan, i: number) => (
              <div key={i} className={i > 0 ? "mt-4 border-t border-line pt-4" : undefined}>
                <DayField label={`Exact Goal ${i + 1}`} value={gg.goal ?? ""} />
                <DayField label={`Exact Plan ${i + 1}`} value={gg.plan ?? ""} />
                {gg.target ? <DayField label="Deadline" value={friendlyISO(gg.target) ?? gg.target} /> : null}
                {gg.work?.text.trim() ? (
                  <DayGroup label="Work of the Day" color={INK}><DayTask text={gg.work.text} done={gg.work.done} accent={RED} /></DayGroup>
                ) : null}
                {(gg.dod ?? []).some((t: Task) => t.text.trim()) ? (
                  <DayGroup label="Do or Die" color={RED}>{gg.dod.map((t: Task, k: number) => <DayTask key={k} text={t.text} done={t.done} accent={RED} />)}</DayGroup>
                ) : null}
                {(gg.extra ?? []).some((t: Task) => t.text.trim()) ? (
                  <DayGroup label="Extra Mile" color={GREEN}>{gg.extra.map((t: Task, k: number) => <DayTask key={k} text={t.text} done={t.done} accent={GREEN} />)}</DayGroup>
                ) : null}
                {(gg.deleg ?? []).some((x: Deleg) => x.text.trim()) ? (
                  <DayGroup label="Delegated" color={BLUE}>{gg.deleg.map((x: Deleg, k: number) => <DayTask key={k} text={x.who ? `${x.text} → ${x.who}` : x.text} done={x.done} accent={BLUE} />)}</DayGroup>
                ) : null}
              </div>
            ))}
          </>
        )}
      />

      <FiledBox title="Filed Tasks" empty="Nothing filed yet." clearLabel="Clear all filed" hasItems={state.filed.length > 0} onClear={async () => { if (await dialog.confirm("Delete everything in the filed archive?", { confirmLabel: "Delete all", danger: true })) update((s) => { s.filed = []; }); }}>
        {state.filed.map((f, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2 border-b border-line">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide" style={{ backgroundColor: TAG[f.section].bg, color: TAG[f.section].color }}>{TAG[f.section].label.toUpperCase()}</span>
            <span className="min-w-0 flex-1 break-words text-[13px] text-ink">{f.text}</span>
            <span className="text-[11px] text-muted">{f.date}</span>
          </div>
        ))}
      </FiledBox>
    </PillarScaffold>
  );
}
