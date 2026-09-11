"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Close } from "@/components/icons";

import { pillarByNumber, Accents, HEADING, FIELD_EMPTY } from "@/lib/pillars";
import { newId } from "@/lib/dates";
import { usePillarState } from "@/lib/use-pillar-state";
import { PillarScaffold } from "@/components/pillar-scaffold";
import { Loading, SectionLabel, AddButton, capFirst } from "@/components/ui";
import { PersonField, DateField, YesNoRow, PassNote } from "@/components/task";
import { useDialog } from "@/components/dialog";

/**
 * Types and normalizers come from the SHARED schema, not from local copies.
 *
 * This file used to declare its own `System`, missing six fields the mobile app
 * writes — `pairs`, `idea`, `records` and the three tagged-person ids. Because
 * both apps save the same `/v3/pillars/{key}` blob and the builders rebuild
 * from a whitelist, one save from here silently destroyed all six: the
 * effort/result questions daily reporting is keyed on, and the Loyalty / AI /
 * Record-Keeping department payloads. Importing the schema means there is one
 * definition and the two apps cannot drift again.
 */
import {
  DEFAULT_DEPARTMENTS,
  blankDepartment,
  blankSystem,
  deptAccent,
  deptKind,
  makeInitial,
  normalize as normalizeP8,
  type Business,
  type Department,
  type Evaluation,
  type P8State,
  type Review,
  type System,
  type Training,
  type YN,
} from "@/pillars/schemas/business-systems";

const pillar = pillarByNumber(5)!;
/** Accent key from the shared schema -> this app's CSS variable, so a
 *  department's colour follows the theme instead of being a fixed hex. */
const ACCENT_VAR: Record<string, string> = {
  gold: "p1", red: "p2", green: "p3", blue: "p4",
  plum: "p5", teal: "p6", brown: "p7", navy: "p8",
};

const NAVY = Accents.navy;

type NavState = { level: "biz" | "dept" | "sys" | "detail"; bizId?: string; deptId?: string; sysId?: string };

export default function Pillar8() {
  const dialog = useDialog();
  const { state, update, loaded } = usePillarState<P8State>(pillar.key, makeInitial, normalizeP8);
  const [view, setView] = useState<NavState>({ level: "biz" });
  if (!loaded) return <Loading />;

  const biz = state.businesses.find((b) => b.id === view.bizId);
  const dept = biz?.departments.find((d) => d.id === view.deptId);
  const sys = dept?.systems.find((s) => s.id === view.sysId);

  const updateSys = (mut: (s: System) => void) =>
    update((st) => {
      const b = st.businesses.find((x) => x.id === view.bizId);
      const d = b?.departments.find((x) => x.id === view.deptId);
      const s = d?.systems.find((x) => x.id === view.sysId);
      if (s) mut(s);
    });

  return (
    <PillarScaffold pillar={pillar}>
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center mb-4">
        <Crumb label="Businesses" onClick={() => setView({ level: "biz" })} />
        {biz ? <><Sep /><Crumb label={biz.name} onClick={() => setView({ level: "dept", bizId: biz.id })} /></> : null}
        {dept ? <><Sep /><Crumb label={dept.name} onClick={() => setView({ level: "sys", bizId: biz!.id, deptId: dept.id })} /></> : null}
        {sys && view.level === "detail" ? <><Sep /><span className="font-semibold text-[12px]" style={{ color: "var(--muted)" }}>{sys.num}</span></> : null}
      </div>

      {view.level === "biz" ? (
        <LevelList
          label="Your Businesses"
          small="one or many, tap to open"
          empty="No business yet, add your first below."
          rows={state.businesses.map((b) => ({
            key: b.id,
            name: b.name,
            sub: `${b.departments.length} ${b.departments.length === 1 ? "department" : "departments"}`,
            onOpen: () => setView({ level: "dept", bizId: b.id }),
            onDel: () =>
              confirmDel(dialog, `Delete business "${b.name}" and everything inside it?`, () =>
                update((st) => { st.businesses = st.businesses.filter((x) => x.id !== b.id); }),
              ),
          }))}
          addPlaceholder="New business name…"
          onAdd={(nm) =>
            update((st) => {
              st.businesses.push({
                id: newId(),
                name: nm,
                // Numbers are placeholders: the normalizer renumbers every
                // department by position on load, in both apps.
                departments: DEFAULT_DEPARTMENTS.map((d, i) => blankDepartment(d, i + 1)),
                seeded: true,
              });
            })
          }
        />
      ) : null}

      {view.level === "dept" && biz ? (
        <LevelList
          label="Departments"
          small={`inside ${biz.name}`}
          empty="No departments yet, add one below."
          rows={biz.departments.map((d, di) => ({
            key: d.id,
            name: d.name,
            badge: d.num,
            tint: `var(--${ACCENT_VAR[deptAccent(d.name, di)]})`,
            sub: `${d.systems.length} ${d.systems.length === 1 ? "system" : "systems"}`,
            onOpen: () => setView({ level: "sys", bizId: biz.id, deptId: d.id }),
            onDel: () =>
              confirmDel(dialog, `Delete department "${d.name}" and its systems?`, () =>
                update((st) => {
                  const b = st.businesses.find((x) => x.id === biz.id);
                  if (b) b.departments = b.departments.filter((x) => x.id !== d.id);
                }),
              ),
          }))}
          addPlaceholder="New department name…"
          onAdd={(nm) =>
            update((st) => {
              const b = st.businesses.find((x) => x.id === biz.id);
              if (b) b.departments.push(blankDepartment(nm, b.departments.length + 1));
            })
          }
        />
      ) : null}

      {view.level === "sys" && biz && dept ? (
        <LevelList
          label="Systems"
          small="each system gets its own unique number"
          empty="No systems yet, add one below."
          rows={dept.systems.map((s) => ({
            key: s.id,
            name: s.name,
            badge: s.num,
            tint: `var(--${ACCENT_VAR[deptAccent(dept.name, 0)]})`,
            onOpen: () => setView({ level: "detail", bizId: biz.id, deptId: dept.id, sysId: s.id }),
            onDel: () =>
              confirmDel(dialog, `Delete system ${s.num} "${s.name}"?`, () =>
                update((st) => {
                  const b = st.businesses.find((x) => x.id === biz.id);
                  const d = b?.departments.find((x) => x.id === dept.id);
                  if (d) d.systems = d.systems.filter((x) => x.id !== s.id);
                }),
              ),
          }))}
          addPlaceholder="New system name…"
          onAdd={(nm) => {
            const num = state.nextSysNum;
            const created = blankSystem(nm, num);
            update((st) => {
              const b = st.businesses.find((x) => x.id === biz.id);
              const d = b?.departments.find((x) => x.id === dept.id);
              if (d) d.systems.push(created);
              st.nextSysNum = num + 1;
            });
            setView({ level: "detail", bizId: biz.id, deptId: dept.id, sysId: created.id });
          }}
        />
      ) : null}

      {view.level === "detail" && sys ? <SystemDetail sys={sys} biz={biz!} dept={dept!} updateSys={updateSys} /> : null}
    </PillarScaffold>
  );
}

/* ---------- list levels ---------- */

interface RowSpec {
  key: string;
  name: string;
  sub?: string;
  /** D1, S1 — the row's identity, as on the phone. */
  badge?: string;
  /** The row's own accent. The five standard departments share one (plum), so
   *  they read as a family in every business; custom ones cycle. */
  tint?: string;
  onOpen: () => void;
  onDel: () => void;
}
function LevelList({ label, small, empty, rows, addPlaceholder, onAdd }: { label: string; small: string; empty: string; rows: RowSpec[]; addPlaceholder: string; onAdd: (name: string) => void }) {
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) { onAdd(val.trim()); setVal(""); } };
  return (
    <div>
      <SectionLabel text={label} small={small} color={NAVY} />
      {rows.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-line px-3.5 py-4 mb-1" >
          <span className="text-[13px] leading-snug" style={{ color: "var(--placeholder)" }}>{empty}</span>
        </div>
      ) : rows.map((r) => (
        <div
          key={r.key}
          onClick={r.onOpen}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-3 mb-2.5 cursor-pointer shadow-sm transition-colors hover:bg-line-soft"
        >
          {/* The number IS the identity — D1, S1 — exactly as on the phone. A
              letter avatar cannot tell three departments starting with "A"
              apart. Outlined in the row's own accent, so the five standard
              departments read as one family in every business. */}
          <div
            className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border-[1.5px] px-2 font-heading text-[12px] tracking-wide"
            style={{ borderColor: r.tint ?? NAVY, color: r.tint ?? NAVY }}
          >
            {r.badge ?? (r.name.trim()[0] ?? "•").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[15.5px] text-ink truncate">{r.name}</p>
            {r.sub ? <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>{r.sub}</p> : null}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); r.onDel(); }}
            aria-label={`Delete ${r.name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-danger"
          ><Close size={13} /></button>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted"><ChevronRight size={16} /></span>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <input
          autoCorrect="off"
          spellCheck={false}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={addPlaceholder}
          maxLength={80}
          style={{ backgroundColor: val.trim() ? "var(--field)" : FIELD_EMPTY }}
          className="flex-1 min-h-[48px] rounded-xl border-[1.5px] border-line px-3.5 text-[15px] text-on-card outline-none focus:border-gold placeholder:text-placeholder"
        />
        <button onClick={submit} style={{ backgroundColor: NAVY }} className="min-h-[48px] rounded-xl px-5 text-on-accent font-heading text-[12px] tracking-widest">ADD</button>
      </div>
    </div>
  );
}

/* ---------- system detail: 12 headings ---------- */

function SystemDetail({ sys, biz, dept, updateSys }: { sys: System; biz: Business; dept: Department; updateSys: (m: (s: System) => void) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <span className="flex h-6 min-w-[40px] items-center justify-center rounded px-1.5 text-on-accent font-heading text-[11px]" style={{ backgroundColor: NAVY }}>{sys.num}</span>
        <p className="flex-1 font-heading text-[18px]" style={{ color: HEADING }}>{sys.name.toUpperCase()}</p>
      </div>

      <Section n={1} title="Reporting Frequency" />
      <TextField value={sys.freq} onChange={(v) => updateSys((s) => { s.freq = v; })} placeholder="e.g. Daily / Weekly / Monthly" />

      <Section n={2} title="Responsible Person" />
      <TextField value={sys.responsible} onChange={(v) => updateSys((s) => { s.responsible = v; })} placeholder="Who does the work?" />

      <Section n={3} title="Accountable Person" />
      <TextField value={sys.accountable} onChange={(v) => updateSys((s) => { s.accountable = v; })} placeholder="Who answers for the result?" />

      <Section n={4} title="Guide, Helper & Reporting Person" />
      <TextField value={sys.guide} onChange={(v) => updateSys((s) => { s.guide = v; })} placeholder="Who guides, helps, and receives the report?" />

      <Section n={5} title="Staff's Job Progression" />
      <TextField value={sys.progression} onChange={(v) => updateSys((s) => { s.progression = v; })} placeholder="Where can this role grow to?" />

      <Section n={6} title="Job Description" small="the most important things to do, add as many as needed" />
      <EditableList items={sys.jobs} onChange={(v) => updateSys((s) => { s.jobs = v; })} placeholder={(i) => `Most important thing ${i}`} addLabel="+ Add another important thing" />

      <Section n={7} title="Effort Questions" small="add as many as needed" />
      <EditableList items={sys.efforts} onChange={(v) => updateSys((s) => { s.efforts = v; })} placeholder={(i) => `Effort question ${i}`} addLabel="+ Add effort question" />

      <Section n={8} title="Result Questions" small="add as many as needed" />
      <EditableList items={sys.results} onChange={(v) => updateSys((s) => { s.results = v; })} placeholder={(i) => `Result question ${i}`} addLabel="+ Add result question" />

      <Section n={9} title="How, Step by Step Process" small="the flow chart draws itself as you type" />
      <EditableList items={sys.steps} onChange={(v) => updateSys((s) => { s.steps = v; })} placeholder={(i) => `Step ${i}`} addLabel="+ Add step" />
      <FlowChart sys={sys} biz={biz} dept={dept} />

      <Section n={10} title="Training" small="give another training anytime" />
      <TrainingSection sys={sys} updateSys={updateSys} />

      <Section n={11} title="Evaluation & Implementation" small="implementation only if the trainee passes" />
      <EvalSection sys={sys} updateSys={updateSys} />

      <Section n={12} title="Fortnightly Progress Review & Accountability" small="every two weeks" />
      <ReviewSection sys={sys} updateSys={updateSys} />
    </div>
  );
}

/* ---------- flow chart ---------- */

function flowText(sys: System, biz: Business, dept: Department): string {
  const steps = sys.steps.filter((s) => s.trim());
  let out = `FLOW CHART\nBusiness: ${biz.name || "-"}\nDepartment: ${dept.name || "-"}\nSystem: ${sys.num}, ${sys.name}\n\nSTART`;
  steps.forEach((s, i) => { out += `\n  ↓\nStep ${i + 1}: ${s}`; });
  out += "\n  ↓\nDONE";
  return out;
}

function FlowChart({ sys, biz, dept }: { sys: System; biz: Business; dept: Department }) {
  const dialog = useDialog();
  const steps = sys.steps.filter((s) => s.trim());
  const guard = () => void dialog.alert("Write the steps first, the flow chart is empty.");
  const copy = () => {
    if (!steps.length) return guard();
    const text = flowText(sys, biz, dept);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => void dialog.alert("Flow chart copied to clipboard."), () => void dialog.alert("Could not copy."));
    else void dialog.alert("Copy is not available in this browser.");
  };
  const email = () => {
    if (!steps.length) return guard();
    window.location.href = `mailto:?subject=${encodeURIComponent(`Flow chart, ${sys.num} ${sys.name}`)}&body=${encodeURIComponent(flowText(sys, biz, dept))}`;
  };
  return (
    <div className="mt-3">
      {steps.length ? (
        <div className="flex flex-col items-center mb-3">
          <div className="rounded-full px-5 py-1.5 text-on-accent font-heading text-[12px] tracking-widest" style={{ backgroundColor: Accents.green }}>Start</div>
          {steps.map((s, i) => (
            <div key={i} className="flex flex-col items-center self-stretch">
              <span className="text-[18px] my-0.5" style={{ color: "var(--muted)" }}>↓</span>
              <div className="self-stretch rounded-md border-2 bg-surface px-3 py-2" style={{ borderColor: NAVY }}>
                <p className="font-heading text-[10px] tracking-widest" style={{ color: NAVY }}>Step {i + 1}</p>
                <p className="text-[13px] text-ink mt-0.5">{s}</p>
              </div>
            </div>
          ))}
          <span className="text-[18px] my-0.5" style={{ color: "var(--muted)" }}>↓</span>
          <div className="rounded-full px-5 py-1.5 text-on-accent font-heading text-[12px] tracking-widest" style={{ backgroundColor: Accents.red }}>Done</div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <ShareBtn label="📋 Copy" color={NAVY} onClick={copy} />
        <ShareBtn label="✉ Email" color="var(--muted)" onClick={email} />
      </div>
    </div>
  );
}

/* ---------- training / eval / review ---------- */

function TrainingSection({ sys, updateSys }: { sys: System; updateSys: (m: (s: System) => void) => void }) {
  const dialog = useDialog();
  if (!sys.trainings.length) {
    return <>
      <p className="text-[13px] leading-snug" style={{ color: "var(--placeholder)" }}>No training yet - add the first one below.</p>
      <AddButton label="+ Add training / give another training" accent={Accents.green} onClick={() => updateSys((s) => { s.trainings.push({ id: newId(), trainee: "", trainer: "", date: "", satisfied: "", remarks: "" }); })} />
    </>;
  }
  return (
    <div>
      {sys.trainings.map((t, i) => {
        const name = t.trainee.trim() || "Trainee";
        return (
          <div key={t.id} className="rounded-lg border border-line bg-surface p-3 mb-2.5 shadow-sm">
            <p className="font-heading text-[12px] tracking-widest text-ink mb-2">Training {i + 1}{i === sys.trainings.length - 1 && sys.trainings.length > 1 ? " (latest)" : ""}</p>
            <PersonField label="Trainee's Name" value={t.trainee} placeholder="Who is being trained?" onChange={(v) => updateSys((s) => { s.trainings[i].trainee = v; })} />
            <PersonField label="Trainer" value={t.trainer} placeholder="Who is training?" onChange={(v) => updateSys((s) => { s.trainings[i].trainer = v; })} />
            <DateField label="Training Date" value={t.date} onChange={(v) => updateSys((s) => { s.trainings[i].date = v; })} />
            <FLabel>Trainer Satisfied With The Training?</FLabel>
            <YesNoRow value={t.satisfied} onChange={(v) => updateSys((s) => { s.trainings[i].satisfied = v; })} yesLabel="✓ Satisfied" noLabel="✗ Not Satisfied" />
            {t.satisfied === "yes" ? <PassNote kind="pass">✓ {name} trained well, ready for evaluation (section 11).</PassNote> : null}
            {t.satisfied === "no" ? <>
              <PassNote kind="fail">✗ Trainer not satisfied, {t.trainee.trim() || "trainee"} needs another training session.</PassNote>
              <AddButton label={`+ Give another training to ${t.trainee.trim() || "the trainee"}`} accent={Accents.green} onClick={() => updateSys((s) => { s.trainings.push({ id: newId(), trainee: t.trainee, trainer: t.trainer, date: "", satisfied: "", remarks: `Repeat training, trainer not satisfied with training ${i + 1}` }); })} />
            </> : null}
            <FLabel>Remarks of the Trainer</FLabel>
            <Area value={t.remarks} onChange={(v) => updateSys((s) => { s.trainings[i].remarks = v; })} placeholder="How did the training go?" />
            <DelLink onClick={() => confirmDel(dialog, "Delete this training record?", () => updateSys((s) => { s.trainings.splice(i, 1); }))} />
          </div>
        );
      })}
      <AddButton label="+ Add training / give another training" accent={Accents.green} onClick={() => updateSys((s) => { s.trainings.push({ id: newId(), trainee: "", trainer: "", date: "", satisfied: "", remarks: "" }); })} />
    </div>
  );
}

function EvalSection({ sys, updateSys }: { sys: System; updateSys: (m: (s: System) => void) => void }) {
  const dialog = useDialog();
  const lastTrainee = sys.trainings[sys.trainings.length - 1]?.trainee ?? "";
  if (!sys.evals.length) {
    return <>
      <p className="text-[13px] leading-snug" style={{ color: "var(--placeholder)" }}>No evaluation yet - add the first one below.</p>
      <AddButton label="+ Add evaluation / evaluate again" accent={Accents.green} onClick={() => updateSys((s) => { s.evals.push({ id: newId(), trainee: lastTrainee, evaluator: "", evalDate: "", satisfied: "", implDate: "", remarks: "" }); })} />
    </>;
  }
  return (
    <div>
      {sys.evals.map((t, i) => {
        const name = t.trainee.trim() || "Trainee";
        return (
          <div key={t.id} className="rounded-lg border border-line bg-surface p-3 mb-2.5 shadow-sm">
            <p className="font-heading text-[12px] tracking-widest text-ink mb-2">Evaluation {i + 1}{i === sys.evals.length - 1 && sys.evals.length > 1 ? " (latest)" : ""}</p>
            <PersonField label="Trainee's Name" value={t.trainee} placeholder="Who is being evaluated?" onChange={(v) => updateSys((s) => { s.evals[i].trainee = v; })} />
            <PersonField label="Evaluator" value={t.evaluator} placeholder="Who is evaluating?" onChange={(v) => updateSys((s) => { s.evals[i].evaluator = v; })} />
            <DateField label="Evaluation Date" value={t.evalDate} onChange={(v) => updateSys((s) => { s.evals[i].evalDate = v; })} />
            <FLabel>Evaluator Satisfied?</FLabel>
            <YesNoRow value={t.satisfied} onChange={(v) => updateSys((s) => { s.evals[i].satisfied = v; })} yesLabel="✓ Yes, Satisfied" noLabel="✗ No, Not Satisfied" />
            {t.satisfied === "yes" ? <>
              <PassNote kind="pass">✓ {name} passed the evaluation, announce the implementation date:</PassNote>
              <DateField label="Implementation Date" value={t.implDate} onChange={(v) => updateSys((s) => { s.evals[i].implDate = v; })} />
            </> : null}
            {t.satisfied === "no" ? <>
              <PassNote kind="fail">✗ {name} failed the evaluation, another training session is needed. No implementation date.</PassNote>
              <AddButton label={`+ Schedule another training for ${t.trainee.trim() || "the trainee"}`} accent={Accents.green} onClick={() => { updateSys((s) => { s.trainings.push({ id: newId(), trainee: t.trainee, trainer: "", date: "", satisfied: "", remarks: `Re-training after failed evaluation ${i + 1}` }); }); void dialog.alert(`A new training has been added in section 10 for ${t.trainee.trim() || "the trainee"}.`); }} />
            </> : null}
            <FLabel>Remarks of Evaluation</FLabel>
            <Area value={t.remarks} onChange={(v) => updateSys((s) => { s.evals[i].remarks = v; })} placeholder="What did the evaluation find?" />
            <DelLink onClick={() => confirmDel(dialog, "Delete this evaluation record?", () => updateSys((s) => { s.evals.splice(i, 1); }))} />
          </div>
        );
      })}
      <AddButton label="+ Add evaluation / evaluate again" accent={Accents.green} onClick={() => updateSys((s) => { s.evals.push({ id: newId(), trainee: lastTrainee, evaluator: "", evalDate: "", satisfied: "", implDate: "", remarks: "" }); })} />
    </div>
  );
}

function ReviewSection({ sys, updateSys }: { sys: System; updateSys: (m: (s: System) => void) => void }) {
  const dialog = useDialog();
  const lastTrainee = sys.trainings[sys.trainings.length - 1]?.trainee ?? "";
  if (!sys.reviews.length) {
    return <>
      <p className="text-[13px] leading-snug" style={{ color: "var(--placeholder)" }}>No review yet - add the first one below.</p>
      <AddButton label="+ Add fortnightly review" accent={Accents.green} onClick={() => updateSys((s) => { s.reviews.push({ id: newId(), trainee: lastTrainee, reviewer: "", date: "", satisfied: "", remarks: "" }); })} />
    </>;
  }
  return (
    <div>
      {sys.reviews.map((t, i) => (
        <div key={t.id} className="rounded-lg border border-line bg-surface p-3 mb-2.5 shadow-sm">
          <p className="font-heading text-[12px] tracking-widest text-ink mb-2">Review {i + 1}{i === sys.reviews.length - 1 && sys.reviews.length > 1 ? " (latest)" : ""}</p>
          <PersonField label="Trainee's Name" value={t.trainee} placeholder="Who is being reviewed?" onChange={(v) => updateSys((s) => { s.reviews[i].trainee = v; })} />
          <PersonField label="Reviewer" value={t.reviewer} placeholder="Who is reviewing?" onChange={(v) => updateSys((s) => { s.reviews[i].reviewer = v; })} />
          <DateField label="Review Date" value={t.date} onChange={(v) => updateSys((s) => { s.reviews[i].date = v; })} />
          <FLabel>Reviewer Satisfied?</FLabel>
          <YesNoRow value={t.satisfied} onChange={(v) => updateSys((s) => { s.reviews[i].satisfied = v; })} yesLabel="✓ Satisfied" noLabel="✗ Not Satisfied" />
          <p className="font-heading text-[9px] mt-2 mb-0.5" style={{ letterSpacing: "1.5px", color: Accents.red }}>🔒 CONFIDENTIAL REMARKS ABOUT THE TRAINEE</p>
          <Area value={t.remarks} onChange={(v) => updateSys((s) => { s.reviews[i].remarks = v; })} placeholder="For the reviewer's eyes, honest, confidential notes on the trainee…" />
          <DelLink onClick={() => confirmDel(dialog, "Delete this review record?", () => updateSys((s) => { s.reviews.splice(i, 1); }))} />
        </div>
      ))}
      <AddButton label="+ Add fortnightly review" accent={Accents.green} onClick={() => updateSys((s) => { s.reviews.push({ id: newId(), trainee: lastTrainee, reviewer: "", date: "", satisfied: "", remarks: "" }); })} />
    </div>
  );
}

/* ---------- small helpers ---------- */

async function confirmDel(
  dialog: ReturnType<typeof useDialog>,
  msg: string,
  onOk: () => void,
) {
  if (await dialog.confirm(msg, { danger: true, confirmLabel: "Delete" })) onOk();
}
const Crumb = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="font-semibold text-[12px]" style={{ color: NAVY }}>{label}</button>
);
const Sep = () => <span className="text-[12px] px-0.5" style={{ color: "var(--placeholder)" }}> › </span>;
const Section = ({ n, title, small }: { n: number; title: string; small?: string }) => (
  <div className="flex items-start gap-2.5 mt-6 mb-2">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-on-accent font-heading text-[12px]" style={{ backgroundColor: NAVY }}>{n}</span>
    <div className="flex-1">
      <p className="font-bold text-[15px]" style={{ color: HEADING }}>{title}</p>
      {small ? <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{capFirst(small)}</p> : null}
    </div>
  </div>
);
const FLabel = ({ children }: { children: ReactNode }) => (
  <span className="block text-[13px] text-muted mt-1 mb-1">{children}</span>
);
const TextField = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <input
    autoCorrect="off"
    spellCheck={false}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={120}
    /* `var(--field)`, never `transparent`. The ink here is `on-card` (near
       black) because a field is white paper in both themes — so a transparent
       fill paints that ink on the navy CARD at 1.30:1, which is invisible. The
       `Area` below already did this correctly; this input was missed, and it is
       what makes sections 1-5 of the system editor unreadable in dark mode. */
    style={{ backgroundColor: value.trim() ? "var(--field)" : FIELD_EMPTY }}
    className="w-full min-h-[48px] rounded-xl border-[1.5px] border-line px-3.5 py-3 text-[15px] text-on-card outline-none focus:border-gold mb-1.5 placeholder:text-placeholder"
  />
);
const Area = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <textarea
    autoCorrect="off"
    spellCheck={false}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={400}
    style={{ backgroundColor: value.trim() ? "var(--field)" : FIELD_EMPTY }}
    className="w-full min-h-[60px] rounded-xl border-[1.5px] border-line px-3 py-3 text-[15px] text-on-card outline-none focus:border-gold resize-y mb-1.5 placeholder:text-placeholder"
  />
);
const DelLink = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="mt-1 block text-[12px] font-semibold underline" style={{ color: Accents.red }}>Delete</button>
);
const ShareBtn = ({ label, color, onClick }: { label: string; color: string; onClick: () => void }) => (
  <button onClick={onClick} className="rounded border-[1.5px] px-2.5 py-1.5 text-[11px] font-semibold" style={{ borderColor: color, color }}>{label}</button>
);

function EditableList({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (v: string[]) => void; placeholder: (i: number) => string; addLabel: string }) {
  const dialog = useDialog();
  const list = items.length ? items : [""];
  // Only allow a new row once the last one has been filled in.
  const canAdd = (list[list.length - 1] ?? "").trim().length > 0;
  return (
    <div>
      {list.map((it, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-line">
          <span className="font-heading text-[14px] w-5 text-center" style={{ color: NAVY }}>{i + 1}</span>
          <input
            autoCorrect="off"
            spellCheck={false}
            value={it}
            onChange={(e) => { const n = [...list]; n[i] = e.target.value; onChange(n); }}
            placeholder={placeholder(i + 1)}
            maxLength={200}
            style={{ backgroundColor: it.trim() ? "var(--field)" : FIELD_EMPTY }}
            className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-[14px] text-on-card outline-none placeholder:text-placeholder"
          />
          <button onClick={() => { const n = list.filter((_, x) => x !== i); onChange(n.length ? n : [""]); }} className="text-[15px]" style={{ color: "var(--muted)" }}><Close size={13} /></button>
        </div>
      ))}
      <button
        onClick={() => { if (!canAdd) { void dialog.alert("Fill the previous field first."); return; } onChange([...list, ""]); }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-4 py-3 text-[13.5px] font-semibold transition-colors"
        style={{ borderColor: NAVY, color: NAVY, backgroundColor: `${NAVY}10`, opacity: canAdd ? 1 : 0.45 }}
      >
        <span className="text-lg leading-none">+</span>
        {addLabel.replace(/^\+\s*/, "")}
      </button>
    </div>
  );
}
