"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";

import { pillarByNumber, Accents, INK , rowLocked} from "@/lib/pillars";
import { friendlyISO, shortDate, todayKey } from "@/lib/dates";
import { usePillarState } from "@/lib/use-pillar-state";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { PillarScaffold } from "@/components/pillar-scaffold";
import { Loading, SectionLabel, AddButton, TextArea, CharsLeft, GrowField, GroupBox } from "@/components/ui";
import { useDialog } from "@/components/dialog";
import { DelegateSection } from "@/components/delegate-section";
import { usePartnersWithAdd, useOutgoingAssignments, type Partner } from "@/lib/use-connections";
import { assignTask, unassignTask } from "@/lib/connections-api";
import { apiErrorMessage } from "@/lib/api";
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
  revealStage,
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
  /** Which way the last goal change went, so the new goal slides in from that side. */
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  /* Tagging for "Delegate or Follow Up". Every hook here sits ABOVE the
     `if (!loaded)` return below — a hook after an early return is a different
     hook order on the two paths, which React rejects at runtime. That exact
     mistake has shipped in this codebase before. */
  const { partners, addPerson } = usePartnersWithAdd();
  const [assignTick, setAssignTick] = useState(0);
  const [assigning, setAssigning] = useState(false);
  const outgoing = useOutgoingAssignments(pillar.key, assignTick);

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
  /** How much of this goal's page is showing (A4): never hides written work. */
  const stage = revealStage(g);
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

  /* One click (and a second chance) to empty the goal or the plan, instead of
     selecting all the text and deleting it (Zaffar, 18 Sep). */
  const clearField = async (field: "goal" | "plan") => {
    const what = field === "goal" ? `exact goal ${gi + 1}` : `exact plan ${gi + 1}`;
    const ok = await dialog.confirm(`Clear ${what}?`, {
      body: "The text in this box will be removed. Everything else stays.",
      confirmLabel: "Clear",
      danger: true,
    });
    if (ok) setG((x) => { x[field] = ""; });
  };

  const fileTask = (text: string, section: Section, clear: () => void) => {
    if (!text.trim()) return void dialog.alert("This task is empty, nothing to file.");
    update((s) => { s.filed = [{ text, section, date: shortDate() }, ...s.filed]; });
    clear();
  };

  /**
   * Tag a connection on a delegated row. Same contract as Pillar 4: the tag IS
   * the assignment, so it is sent immediately, and `whoUserId` is only written
   * once the server has accepted — a failure must not leave a tag pointing at
   * an assignment that does not exist.
   */
  const onTagDeleg = async (i: number, partner: Partner | null, notify = true) => {
    if (assigning) return;
    const row = g.deleg[i];
    if (!row) return;
    const sent = outgoing.byTaskId[row.id];

    if (!partner) {
      if (sent) {
        setAssigning(true);
        try {
          await unassignTask(sent.id);
          setG((x) => { if (x.deleg[i]) x.deleg[i].whoUserId = ""; });
          setAssignTick((t) => t + 1);
        } catch (err) {
          void dialog.alert(apiErrorMessage(err, "Couldn't unassign. Please try again."));
        } finally {
          setAssigning(false);
        }
        return;
      }
      setG((x) => { if (x.deleg[i]) x.deleg[i].whoUserId = ""; });
      return;
    }

    if (!row.text.trim()) {
      void dialog.alert("Write what you're delegating first, so they know what they're being asked to do.");
      return;
    }
    setAssigning(true);
    try {
      await assignTask({
        assigneeUserId: partner.userId,
        pillarKey: pillar.key,
        taskId: row.id,
        title: row.text,
        due: row.due,
        notify,
      });
      setG((x) => { if (x.deleg[i]) x.deleg[i].whoUserId = String(partner.userId); });
      setAssignTick((t) => t + 1);
    } catch (err) {
      // Leave the typed name alone — losing what they wrote would be worse
      // than a failed assignment they can retry.
      void dialog.alert(apiErrorMessage(err, "Couldn't assign that task. Please try again."));
    } finally {
      setAssigning(false);
    }
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
    // Land on the NEW goal. Functional form: two fast clicks would otherwise
    // both read the same render-time length.
    setDir("next");
    setCur(goals.length);
  };

  const removeGoal = async () => {
    if (!await dialog.confirm(`Delete Exact Goal (Project) ${gi + 1}?`, { body: "Its plan, target date and all of its tasks go too.", confirmLabel: "Delete", danger: true })) return;
    update((s) => {
      s.goals.splice(gi, 1);
      if (!s.goals.length) s.goals.push(emptyGoal());
    });
    setDir("prev");
    setCur((c) => Math.max(0, c - 1));
  };

  /** Page to goal `n`, sliding in from the side it lies on. */
  const goTo = (n: number) => {
    const next = Math.max(0, Math.min(goals.length - 1, n));
    if (next === gi) return;
    setDir(next > gi ? "next" : "prev");
    setCur(next);
  };

  /* Swipe, like an app: a mostly-horizontal drag of 60px+ pages the goal.
     Touch only — on a desktop the arrows, dots and arrow keys do it, and a
     mouse drag is how text gets selected. */
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || goals.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    goTo(dx < 0 ? gi + 1 : gi - 1);
  };
  /* Left/right arrow keys page too, but never while the caret is in a field —
     there they have to move the caret. */
  const onNavKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(gi + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(gi - 1); }
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
  const fileDeleg = (i: number) => {
    const d = g.deleg[i];
    fileTask(d.text + (d.who ? ` → ${d.who}` : ""), "deleg", () => setG((x) => { x.deleg.splice(i, 1); }));
  };

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
      {/* ONE goal on screen, the others to its left and right, like an app.
          Everything below — work of the day, do-or-die, extra tasks, delegated
          rows — hangs off the SELECTED goal, so this is a real selection, not
          just pagination. It replaces a row of goal-name tabs that, at five
          goals, crushed each name into a narrow wrapped column. */}
      {goals.length > 1 ? (
        <div
          role="group"
          aria-roledescription="carousel"
          aria-label="Your goals"
          onKeyDown={onNavKey}
          className="mb-4 flex items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={gi === 0}
            onClick={() => goTo(gi - 1)}
            aria-label="Previous goal"
            title="Previous goal"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] transition-colors"
            style={navBtn(gi === 0)}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <span aria-live="polite" className="font-heading text-[12px] tracking-wide uppercase" style={{ color: INK }}>
              {`Goal ${gi + 1} of ${goals.length}`}
            </span>
            <div className="flex items-center">
              {goals.map((goal, i) => {
                const on = i === gi;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Go to goal ${i + 1}${goal.goal.trim() ? `: ${goal.goal.trim()}` : ""}`}
                    aria-current={on ? "true" : undefined}
                    title={goal.goal.trim() || `Goal ${i + 1}`}
                    className="tap-target flex items-center justify-center"
                  >
                    <span
                      aria-hidden
                      className="block rounded-full transition-all"
                      style={{
                        width: on ? 20 : 8,
                        height: 8,
                        backgroundColor: on ? pillar.accent : "var(--line)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            disabled={gi >= goals.length - 1}
            onClick={() => goTo(gi + 1)}
            aria-label="Next goal"
            title="Next goal"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] transition-colors"
            style={navBtn(gi >= goals.length - 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : null}

      {/* ---- Group 1: Exact Goal, Plan and Deadline, in ONE border ----
          Keyed by goal, so each page change replays the slide from the side the
          goal came from. */}
      <section
        key={gi}
        className={dir ? `zaff-slide-${dir}` : ""}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <GroupBox accent={pillar.accent}>
          {/* Add and Remove together, at the top, where the goal is named. */}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <SectionLabel text={`Exact Goal (Project) ${gi + 1}`} small="be specific, what exactly are you going for?" color={pillar.accent} />
            </div>
            <AddButton compact label="+ Add goal" accent={pillar.accent} dimmed={!lastFilled} onClick={addGoal} />
            {goals.length > 1 ? (
              <button
                type="button"
                onClick={removeGoal}
                aria-label={`Remove exact goal ${gi + 1}`}
                className="tap-row shrink-0 rounded-lg border-[1.5px] px-3 py-1.5 text-[12.5px] font-semibold transition-opacity hover:opacity-70"
                style={{ color: RED, borderColor: RED }}
              >
                Remove
              </button>
            ) : null}
          </div>
          {/* Shown in CAPITALS, stored as typed: the reports read this same
              text, so the capitals are display only. */}
          <GrowField
            value={g.goal}
            onChange={(v) => setG((x) => { x.goal = v; })}
            placeholder={`Write exact goal ${gi + 1} here…`}
            aria-label={`Exact goal ${gi + 1}`}
            maxLength={GOAL_MAX}
            autoCorrect="off"
            spellCheck={false}
            style={{ backgroundColor: g.goal.trim() ? "var(--field-empty)" : "var(--field-red)" }}
            className="w-full rounded-lg px-2 py-2 font-semibold text-[16px] uppercase tracking-[0.02em] text-on-card outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-placeholder"
          />
          <FieldFoot value={g.goal} max={GOAL_MAX} clearLabel={`Clear exact goal ${gi + 1}`} onClear={() => clearField("goal")} />

          <div className="mt-4">
            <SectionLabel text={`Exact Plan ${gi + 1}`} small="how you'll get there" color={pillar.accent} />
            <TextArea
              value={g.plan}
              onChange={(v) => setG((x) => { x.plan = v; })}
              placeholder={`Write the plan for goal ${gi + 1}: the steps, the order, the deadlines…`}
              maxLength={GOAL_MAX}
              tone="red"
            />
            <FieldFoot value={g.plan} max={GOAL_MAX} clearLabel={`Clear exact plan ${gi + 1}`} onClear={() => clearField("plan")} />
          </div>

          <div className="mt-2">
            <DateField label="Deadline" value={g.target} onChange={(iso) => setG((x) => { x.target = iso; })} />
          </div>

          {stage === 1 ? (
            <p className="mt-3 text-[13px] text-muted">
              Fill in the exact goal, the plan and the deadline, and your day opens below.
            </p>
          ) : null}
        </GroupBox>
      </section>

      {/* ---- Group 2: Work of the Day and the 5 Do-or-Die tasks, ONE border ----
          Appears once the goal box is complete (A4). */}
      {stage >= 2 ? (
        <GroupBox accent={RED} className="zaff-reveal">
          <div className="mb-5">
            <p className="font-heading text-[20px] uppercase text-heading">Do <span style={{ color: RED }}>or</span> Die</p>
            <p className="font-semibold text-[12px] tracking-wide mt-1.5" style={{ color: RED }}>PRIORITISE YOUR DAY</p>
          </div>

          <section className="mb-6">
            <SectionLabel text="Work of the Day" small="only one, the thing that matters most" />
            <TaskRow accent={RED} symbol="★" value={g.work.text} done={g.work.done} onChange={(t) => setG((x) => { x.work.text = t; })} onToggle={(v) => setG((x) => { x.work.done = v; })} placeholder="If you do nothing else, do this…" noBorder slot actions={workActions()} />
          </section>

          <section>
            <SectionLabel text="Do or Die Tasks" small="max 5, no more" color={RED} />
            {g.dod.map((t, i) => (
              <TaskRow key={i} accent={RED} symbol={i + 1} value={t.text} done={t.done} onChange={(text) => setG((x) => { x.dod[i].text = text; })} onToggle={(v) => setG((x) => { x.dod[i].done = v; })} actions={dodActions(i)} slot placeholder={`Do-or-die task ${i + 1}`} locked={rowLocked(g.dod, i)} />
            ))}
            <Footer progress={`${dodDone} / 5 do-or-die done`} resetLabel="New day (reset)" onReset={newDay} />
          </section>
        </GroupBox>
      ) : null}

      {/* ---- Groups 3 and 4: Go-Extra-Mile, then Delegate, each in one box ----
          Appear once the day has been started. */}
      {stage >= 3 ? (
        <>
          <GroupBox accent={GREEN} className="zaff-reveal">
            <section>
              <SectionLabel text="Go-Extra-Mile Daily Tasks" small="anything beyond the 5" color={GREEN} />
              {g.extra.map((t, i) => (
                <TaskRow key={i} accent={GREEN} symbol="+" value={t.text} done={t.done} onChange={(text) => setG((x) => { x.extra[i].text = text; })} onToggle={(v) => setG((x) => { x.extra[i].done = v; })} onDelete={() => setG((x) => { x.extra.splice(i, 1); })} actions={extraActions(i)} locked={rowLocked(g.extra, i)} placeholder="Extra task" />
              ))}
              <AddButton label="+ Add extra-mile task" accent={GREEN} dimmed={!lastExtraFilled} onClick={addExtra} />
            </section>
          </GroupBox>

          {/* blankDeleg(), never an inline literal: a new row needs a real `id`
              (task assignments point at it) plus `due`/`whoUserId`. Without one,
              `withId` mints a fresh random id on every load until a save lands,
              so an assignment made elsewhere loses its "Sent to X" badge. */}
          <GroupBox accent={BLUE} className="zaff-reveal">
            <DelegateSection
              items={g.deleg}
              accent={BLUE}
              onAdd={() => setG((x) => { x.deleg.push(blankDeleg()); })}
              onEdit={(i, mut) => setG((x) => { if (x.deleg[i]) mut(x.deleg[i]); })}
              onRemove={(i) => setG((x) => { x.deleg.splice(i, 1); })}
              onFile={fileDeleg}
              partners={partners}
              onTag={onTagDeleg}
              onAddPerson={addPerson}
              statusNoteFor={(d) => {
                const sent = outgoing.byTaskId[d.id];
                if (!sent) return null;
                const extra = outgoing.extraCount(d.id);
                return (
                  (sent.status === "completed"
                    ? `✓ ${sent.assignee_name} marked this done`
                    : `Sent to ${sent.assignee_name}, waiting`) +
                  (extra ? ` · +${extra} more assigned` : "")
                );
              }}
            />
          </GroupBox>
        </>
      ) : null}

      {/* Previous days, grouped per goal/project */}
      <DayReport
        history={state.history}
        renderDay={(d) => (
          <>
            {(d.goals ?? []).map((gg: GoalPlan, i: number) => (
              <div key={i} className={i > 0 ? "mt-4 border-t border-line pt-4" : undefined}>
                <DayField label={`Exact Goal ${i + 1}`} value={(gg.goal ?? "").toUpperCase()} />
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

/** Under a goal / plan box: the characters-left note, and a Clear button once
 *  there is something to clear. */
function FieldFoot({ value, max, clearLabel, onClear }: { value: string; max: number; clearLabel: string; onClear: () => void }) {
  return (
    <div className="mt-1 flex min-h-[26px] items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><CharsLeft value={value} max={max} /></div>
      {value.trim() ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className="tap-row inline-flex shrink-0 items-center gap-1 rounded px-1.5 text-[12px] font-semibold text-muted transition-colors hover:text-danger"
        >
          <span aria-hidden>✕</span> Clear
        </button>
      ) : null}
    </div>
  );
}
