"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Close } from "@/components/icons";

import { pillarByNumber, Accents, HEADING, FIELD_EMPTY } from "@/lib/pillars";
import { newId, shortDate } from "@/lib/dates";
import { usePillarState } from "@/lib/use-pillar-state";
import { PillarScaffold } from "@/components/pillar-scaffold";
import { Loading, SectionLabel, AddButton, capFirst, useAutoGrow, GrowField } from "@/components/ui";
import { PersonField, DateField, PassNote, FiledBox } from "@/components/task";
import { AmPmBoard } from "@/components/am-pm-board";
import { DelegateSection } from "@/components/delegate-section";
import { blankDeleg } from "@/pillars/schemas/types";
import { makeInitial as blankAmPm } from "@/pillars/schemas/pillar-3";
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
  blankPair,
  blankSystem,
  deptAccent,
  deptKind,
  isStandardDept,
  makeInitial,
  normalize as normalizeP8,
  RATINGS,
  ratingToYN,
  shownRating,
  syncPairMirrors,
  systemNum,
  type Business,
  type Department,
  type DelegationBoard,
  type EffortPair,
  type Evaluation,
  type P8State,
  type Rating,
  type Review,
  type System,
  type Training,
} from "@/pillars/schemas/business-systems";

const pillar = pillarByNumber(5)!;
/** Accent key from the shared schema -> this app's CSS variable, so a
 *  department's colour follows the theme instead of being a fixed hex. */
const ACCENT_VAR: Record<string, string> = {
  gold: "p1", red: "p2", green: "p3", blue: "p4",
  plum: "p5", teal: "p6", brown: "p7", navy: "p8",
};

const NAVY = Accents.navy;

/**
 * Where you are in Pillar 5.
 *
 * Two places only: browsing the tree, or inside one system's editor. The tree
 * used to be four separate drill-down screens (businesses → departments →
 * systems → editor), which meant three taps and three page loads before any
 * work could start, and no way to see a business's shape at a glance.
 *
 * It now matches the phone: ONE business at a time, its departments listed
 * underneath as an accordion, and one system at a time inside the open
 * department. `editing` is the only thing that replaces the page.
 */
type Editing = { bizId: string; deptId: string; sysId: string };

export default function Pillar8() {
  const dialog = useDialog();
  const { state, update, loaded, status, retrySave } = usePillarState<P8State>(pillar.key, makeInitial, normalizeP8);
  /** Which business is showing. An index, so deleting one lands on a neighbour. */
  const [bi, setBi] = useState(0);
  /** ONE department open at a time, or the page becomes a wall of systems. */
  const [openDept, setOpenDept] = useState<string | null>(null);
  /** Which system each department is showing, keyed by department id, so
   *  reopening a department returns to the system you were on. */
  const [sysIdx, setSysIdx] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Editing | null>(null);
  /** The "Add a new business" name box, opened from the header row. */
  const [addingBiz, setAddingBiz] = useState(false);
  if (!loaded) return <Loading />;

  const businesses = state.businesses;
  // Clamp: deleting the last business must not strand the navigator past the end.
  const idx = Math.min(bi, Math.max(0, businesses.length - 1));
  const biz = businesses[idx] ?? null;

  const addBusiness = (nm: string) => {
    update((st) => {
      st.businesses.push({
        id: newId(),
        name: nm,
        // Numbers are placeholders: the normalizer renumbers every
        // department by position on load, in both apps.
        departments: DEFAULT_DEPARTMENTS.map((d, i) => blankDepartment(d, i + 1)),
        seeded: true,
      });
    });
    // Land on what was just created, not on whichever was showing.
    setBi(businesses.length);
    setOpenDept(null);
    setAddingBiz(false);
  };

  const updateSys = (mut: (s: System) => void) =>
    update((st) => {
      if (!editing) return;
      const b = st.businesses.find((x) => x.id === editing.bizId);
      const d = b?.departments.find((x) => x.id === editing.deptId);
      const s = d?.systems.find((x) => x.id === editing.sysId);
      if (s) mut(s);
    });

  /* ---------------------------- system editor ---------------------------- */

  if (editing) {
    const eBiz = businesses.find((b) => b.id === editing.bizId);
    const eDept = eBiz?.departments.find((d) => d.id === editing.deptId);
    const eSys = eDept?.systems.find((s) => s.id === editing.sysId);
    // The system can vanish underneath us (deleted on another device), so fall
    // back to the tree rather than rendering a blank editor.
    if (!eBiz || !eDept || !eSys) {
      setEditing(null);
      return <Loading />;
    }
    return (
      <PillarScaffold pillar={pillar} saveStatus={status} onRetrySave={retrySave}>
        <Hierarchy biz={eBiz} dept={eDept} sys={eSys} onBack={() => setEditing(null)} />
        <SystemDetail sys={eSys} biz={eBiz} dept={eDept} updateSys={updateSys} />
      </PillarScaffold>
    );
  }

  return (
    <PillarScaffold pillar={pillar} saveStatus={status} onRetrySave={retrySave}>
      {/* ONE business at a time, stepped with ‹ ›, exactly as on the phone. */}
      {businesses.length > 1 ? (
        <Stepper
          label={`BUSINESS ${idx + 1} OF ${businesses.length}`}
          tint={NAVY}
          atFirst={idx === 0}
          atLast={idx >= businesses.length - 1}
          onPrev={() => { setBi(Math.max(0, idx - 1)); setOpenDept(null); }}
          onNext={() => { setBi(Math.min(businesses.length - 1, idx + 1)); setOpenDept(null); }}
          prevLabel="Previous business"
          nextLabel="Next business"
        />
      ) : null}

      {biz ? (
        <>
          <Hierarchy biz={biz} />
          {/* Add and Delete side by side, at the top, next to the business
              they act on. */}
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddingBiz((o) => !o)}
              aria-expanded={addingBiz}
              className="tap-row flex items-center gap-1 rounded-lg border-[1.5px] px-3 py-1.5 text-[12.5px] font-semibold transition-opacity hover:opacity-80"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              <span aria-hidden className="text-[15px] leading-none">+</span> Add a new business
            </button>
            <button
              type="button"
              onClick={() =>
                confirmDel(dialog, `Delete business "${biz.name}" and everything inside it?`, () => {
                  update((st) => { st.businesses = st.businesses.filter((x) => x.id !== biz.id); });
                  setBi((c) => Math.max(0, c - 1));
                  setOpenDept(null);
                })
              }
              className="tap-row rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:border-danger hover:text-danger"
            >
              Delete this business
            </button>
          </div>
          {addingBiz ? (
            <div className="zaff-reveal mb-5 rounded-2xl border border-line bg-surface p-3.5">
              <SectionLabel text="Add a new business" small="each one gets the five standard departments" color={NAVY} />
              <AddRow placeholder="New business name…" onAdd={addBusiness} autoFocus />
            </div>
          ) : null}

          {/* "click", not "tap": this is the website. */}
          <SectionLabel text="Departments" small="click one to see its systems" color={NAVY} />
          {biz.departments.length === 0 ? (
            <div className="mb-2 rounded-2xl border border-dashed border-line px-3.5 py-4">
              <span className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>
                No departments yet, add one below.
              </span>
            </div>
          ) : (
            biz.departments.map((d, di) => (
              <DeptBlock
                key={d.id}
                biz={biz}
                dept={d}
                tint={`var(--${ACCENT_VAR[deptAccent(d.name, di)]})`}
                open={openDept === d.id}
                sysIdx={Math.min(sysIdx[d.id] ?? 0, Math.max(0, d.systems.length - 1))}
                onToggle={() => setOpenDept((p) => (p === d.id ? null : d.id))}
                onStepSys={(next) => setSysIdx((p) => ({ ...p, [d.id]: Math.max(0, next) }))}
                onOpenSystem={(sysId) => setEditing({ bizId: biz.id, deptId: d.id, sysId })}
                update={update}
                dialog={dialog}
                onAddedSystem={(sysId) => {
                  setSysIdx((p) => ({ ...p, [d.id]: d.systems.length }));
                  setEditing({ bizId: biz.id, deptId: d.id, sysId });
                }}
              />
            ))
          )}

          <AddRow
            placeholder="New department name…"
            onAdd={(nm) =>
              update((st) => {
                const b = st.businesses.find((x) => x.id === biz.id);
                if (b) b.departments.push(blankDepartment(nm, b.departments.length + 1));
              })
            }
          />
        </>
      ) : (
        /* No business yet: the name box is the whole page, so it is simply open. */
        <div className="mb-2 rounded-2xl border border-dashed border-line px-3.5 py-4">
          <SectionLabel text="Add a new business" small="each one gets the five standard departments" color={NAVY} />
          <span className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>
            No business yet, add your first one here.
          </span>
          <AddRow placeholder="New business name…" onAdd={addBusiness} />
        </div>
      )}
    </PillarScaffold>
  );
}

/* ---------- the tree ---------- */

/**
 * BUSINESS, then DEPARTMENT, then SYSTEM — always capitalised, always in this
 * order, on every screen of the pillar.
 *
 * Each tier gets its own size and colour so which one you are looking at is
 * obvious before reading a word. Capitalisation is display only: the stored
 * name keeps whatever the user typed.
 */
function Hierarchy({ biz, dept, sys, onBack }: { biz: Business; dept?: Department; sys?: System; onBack?: () => void }) {
  return (
    <div className="mb-4 border-b border-line pb-3">
      {onBack ? <Crumb label="‹ All departments" onClick={onBack} /> : null}
      <p className={`${onBack ? "mt-1.5 " : ""}break-words font-heading text-[20px] leading-tight text-heading`}>
        {(biz.name || "Business").toUpperCase()}
      </p>
      {dept ? (
        <p
          className="mt-0.5 break-words font-heading text-[14px] leading-tight tracking-[0.08em]"
          /* The department's own colour. Index 0 because the five standard
             departments are coloured by identity, not by position. */
          style={{ color: `var(--${ACCENT_VAR[deptAccent(dept.name, 0)]})` }}
        >
          {dept.num} · {(dept.name || "Department").toUpperCase()}
        </p>
      ) : null}
      {sys ? (
        <p className="mt-0.5 break-words text-[14px] font-semibold leading-tight" style={{ color: NAVY }}>
          {sys.num} · {(sys.name || "Untitled system").toLowerCase()}
        </p>
      ) : null}
    </div>
  );
}

/** ‹ label › — one item at a time, the shape the phone uses for businesses and
 *  for systems inside a department. */
function Stepper({
  label, tint, atFirst, atLast, onPrev, onNext, prevLabel, nextLabel,
}: {
  label: string; tint: string; atFirst: boolean; atLast: boolean;
  onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string;
}) {
  const btn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors disabled:opacity-40";
  return (
    <div className="mb-3 flex items-center justify-center gap-3">
      <button type="button" onClick={onPrev} disabled={atFirst} aria-label={prevLabel} className={btn} style={{ borderColor: atFirst ? "var(--line)" : tint, color: atFirst ? "var(--muted)" : tint }}>
        <ChevronLeft size={16} />
      </button>
      <span className="font-heading text-[11px] tracking-[0.14em]" style={{ color: "var(--muted)" }}>{label}</span>
      <button type="button" onClick={onNext} disabled={atLast} aria-label={nextLabel} className={btn} style={{ borderColor: atLast ? "var(--line)" : tint, color: atLast ? "var(--muted)" : tint }}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/** The name box + ADD button shared by the business and department lists. */
function AddRow({ placeholder, onAdd, autoFocus }: { placeholder: string; onAdd: (name: string) => void; autoFocus?: boolean }) {
  const dialog = useDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  const [val, setVal] = useState("");
  /* Say why, and put the cursor where the fix is. This used to be a bare
     `if (val.trim())` with no else: pressing ADD on an empty name did nothing
     at all and explained nothing. */
  const submit = () => {
    if (!val.trim()) {
      void dialog.alert(`Give it a name first: ${placeholder.toLowerCase()}`);
      inputRef.current?.focus();
      return;
    }
    onAdd(val.trim());
    setVal("");
  };
  return (
    <div className="mt-2 flex gap-2">
      <input
        autoCorrect="off"
        spellCheck={false}
        ref={inputRef}
        autoFocus={autoFocus}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder={placeholder}
        maxLength={80}
        style={{ backgroundColor: val.trim() ? FIELD_EMPTY : "var(--field-red)", borderColor: val.trim() ? "var(--field-empty-border)" : "var(--field-red-border)" }}
        className="min-h-[40px] flex-1 rounded-xl border-[1.5px] border-line px-3.5 text-[14.5px] text-on-card outline-none focus:border-gold placeholder:text-placeholder"
      />
      <button onClick={submit} style={{ backgroundColor: NAVY }} className="min-h-[40px] rounded-xl px-4 font-heading text-[11.5px] tracking-widest text-on-accent">ADD</button>
    </div>
  );
}

/**
 * One department: a header that opens it, and — when open — its systems, one
 * at a time behind a ‹ › stepper.
 *
 * The header is a real <button>, not a clickable <div>: a keyboard user could
 * otherwise reach the row's Delete but never open the row itself, leaving every
 * system and its 12 sections unreachable without a pointer. Delete cannot nest
 * inside that button, so it is its sibling.
 */
function DeptBlock({
  biz, dept, tint, open, sysIdx, onToggle, onStepSys, onOpenSystem, onAddedSystem, update, dialog,
}: {
  biz: Business;
  dept: Department;
  tint: string;
  open: boolean;
  sysIdx: number;
  onToggle: () => void;
  onStepSys: (next: number) => void;
  onOpenSystem: (sysId: string) => void;
  onAddedSystem: (sysId: string) => void;
  update: (m: (st: P8State) => void) => void;
  dialog: ReturnType<typeof useDialog>;
}) {
  const count = dept.systems.length;
  /** AM Planning & PM Achievement and Delegation carry their own board. */
  const kind = deptKind(dept.name);
  const board = kind === "am-pm" ? "Daily AM / PM board" : kind === "delegation" ? "Delegate or follow-up" : "";
  const sub = `${board ? `${board} · ` : ""}${count} ${count === 1 ? "system" : "systems"}`;
  /** One of the five every business runs: no delete control at all. */
  const standard = isStandardDept(dept.name);
  const sys = count ? dept.systems[Math.min(sysIdx, count - 1)] : null;

  const inDept = (st: P8State, mut: (d: Department) => void) => {
    const b = st.businesses.find((x) => x.id === biz.id);
    const d = b?.departments.find((x) => x.id === dept.id);
    if (d) mut(d);
  };

  /* The boards are created on first write, so a department nobody has used
     adds nothing to the saved blob. */
  const deleg: DelegationBoard = dept.delegation ?? { items: [], filed: [] };
  const inDeleg = (mut: (b: DelegationBoard) => void) =>
    update((st) => inDept(st, (d) => { if (!d.delegation) d.delegation = { items: [], filed: [] }; mut(d.delegation); }));
  const fileDeleg = (i: number) => {
    const d = deleg.items[i];
    if (!d?.text.trim()) return void dialog.alert("This task is empty, nothing to file.");
    inDeleg((b) => {
      b.filed = [{ text: d.text + (d.who ? ` → ${d.who}` : ""), date: shortDate() }, ...b.filed];
      b.items.splice(i, 1);
    });
  };

  return (
    /* An open department takes its own colour as its border, so it and the
       systems inside it read as one block. Open/closed behaviour is unchanged. */
    <div
      className="mb-2.5 overflow-hidden rounded-2xl border-[1.5px] bg-surface shadow-sm transition-colors"
      style={{ borderColor: open ? tint : "var(--line)" }}
    >
      <div className="flex items-center gap-1 pr-2 transition-colors hover:bg-line-soft focus-within:border-gold">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`Open ${dept.name}, ${sub}`}
          className="flex min-w-0 flex-1 items-center gap-3 bg-transparent px-3 py-3 text-left"
        >
          {/* One chevron, rotated when open — the icon set has no ChevronDown,
              and this is how the instructions accordion already does it. */}
          <span aria-hidden className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} style={{ color: tint }}>
            <ChevronRight size={16} />
          </span>
          {/* The number IS the identity — D1 — exactly as on the phone. */}
          <span
            aria-hidden
            className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border-[1.5px] px-2 font-heading text-[12px] tracking-wide"
            style={{ borderColor: tint, color: tint }}
          >
            {dept.num}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words font-heading text-[14px] tracking-[0.06em]" style={{ color: tint }}>
              {(dept.name || "Department").toUpperCase()}
            </span>
            <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--muted)" }}>{sub}</span>
          </span>
        </button>
        {standard ? (
          <span className="sr-only">Standard department, cannot be deleted</span>
        ) : (
        <button
          onClick={() =>
            confirmDel(dialog, `Delete department "${dept.name}" and its systems?`, () =>
              update((st) => {
                const b = st.businesses.find((x) => x.id === biz.id);
                if (b) b.departments = b.departments.filter((x) => x.id !== dept.id);
              }),
            )
          }
          aria-label={`Delete ${dept.name}`}
          title={`Delete ${dept.name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-danger"
        ><Close size={13} /></button>
        )}
      </div>

      {open ? (
        /* The rule carries the DEPARTMENT's colour, so the systems underneath
           are visibly tied to the row that opened them. */
        <div className="border-t border-line px-3 py-3">
          {/* Zaffar, 18 Sep 2026: this department works like Pillar 3 — the
              same board, one per business. */}
          {kind === "am-pm" ? (
            <div className="mb-3 rounded-xl border border-line p-3 sm:p-4">
              <AmPmBoard
                state={dept.amPm ?? blankAmPm()}
                update={(mut) => update((st) => inDept(st, (d) => { if (!d.amPm) d.amPm = blankAmPm(); mut(d.amPm); }))}
              />
            </div>
          ) : null}
          {/* …and this one like Pillar 1's delegate or follow-up. */}
          {kind === "delegation" ? (
            <div className="mb-3 rounded-xl border border-line p-3 sm:p-4">
              <DelegateSection
                items={deleg.items}
                onAdd={() => inDeleg((b) => { b.items.push(blankDeleg()); })}
                onEdit={(i, mut) => inDeleg((b) => { if (b.items[i]) mut(b.items[i]); })}
                onRemove={(i) => inDeleg((b) => { b.items.splice(i, 1); })}
                onFile={fileDeleg}
              />
              <FiledBox
                title="Filed Tasks"
                empty="Nothing filed yet."
                clearLabel="Clear all filed"
                hasItems={deleg.filed.length > 0}
                onClear={async () => { if (await dialog.confirm("Delete everything in the filed archive?", { confirmLabel: "Delete all", danger: true })) inDeleg((b) => { b.filed = []; }); }}
              >
                {deleg.filed.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-2 border-b border-line">
                    <span className="min-w-0 flex-1 break-words text-[13px] text-ink">{f.text}</span>
                    <span className="text-[11px] text-muted">{f.date}</span>
                  </div>
                ))}
              </FiledBox>
            </div>
          ) : null}
          {/* The systems sit in their own bordered box inside the department. */}
          <div className="rounded-xl border border-line p-3">
          <p className="mb-2 font-heading text-[11px] tracking-[0.14em]" style={{ color: "var(--muted)" }}>SYSTEMS</p>

          {count === 0 ? (
            <p className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>No systems yet, add one below.</p>
          ) : (
            <>
              {count > 1 ? (
                <Stepper
                  label={`SYSTEM ${Math.min(sysIdx, count - 1) + 1} OF ${count}`}
                  tint={tint}
                  atFirst={sysIdx <= 0}
                  atLast={sysIdx >= count - 1}
                  onPrev={() => onStepSys(sysIdx - 1)}
                  onNext={() => onStepSys(sysIdx + 1)}
                  prevLabel="Previous system"
                  nextLabel="Next system"
                />
              ) : null}
              {sys ? (
                <div className="flex items-center gap-1 rounded-xl border-[1.5px] pr-2 transition-colors hover:bg-line-soft" style={{ borderColor: NAVY }}>
                  <button
                    type="button"
                    onClick={() => onOpenSystem(sys.id)}
                    aria-label={`Open ${sys.name || "Untitled system"}`}
                    className="flex min-w-0 flex-1 items-center gap-3 bg-transparent px-3 py-3 text-left"
                  >
                    <span
                      aria-hidden
                      className="flex h-10 min-w-[40px] shrink-0 items-center justify-center rounded-lg border-[1.5px] px-2 font-heading text-[12px]"
                      style={{ borderColor: NAVY, color: NAVY }}
                    >
                      {sys.num}
                    </span>
                    {/* Systems in small letters, departments in capitals, so the two
                        tiers never read alike. Display only: stored as typed. */}
                    <span className="min-w-0 flex-1 break-words text-[15px] font-semibold" style={{ color: NAVY }}>
                      {(sys.name || "Untitled system").toLowerCase()}
                    </span>
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted"><ChevronRight size={16} /></span>
                  </button>
                  <button
                    onClick={() =>
                      confirmDel(dialog, `Delete system ${sys.num} "${sys.name}"?`, () =>
                        update((st) =>
                          inDept(st, (d) => {
                            d.systems = d.systems.filter((x) => x.id !== sys.id);
                            // Close the gap: a department always reads S1, S2, S3.
                            d.systems.forEach((x, i) => { x.num = systemNum(i + 1); });
                          }),
                        ),
                      )
                    }
                    aria-label={`Delete ${sys.name || "Untitled system"}`}
                    title={`Delete ${sys.name || "Untitled system"}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-danger"
                  ><Close size={13} /></button>
                </div>
              ) : null}
            </>
          )}

          <AddRow
            placeholder="New system name…"
            onAdd={(nm) => {
              /* The number is this system's POSITION in its own department, so
                 each department counts S1, S2, S3 of its own. `normalize`
                 renumbers on the next load anyway; this just avoids the new row
                 flashing the wrong number for one render. */
              const created = blankSystem(nm, count + 1);
              update((st) =>
                inDept(st, (d) => {
                  d.systems.push(created);
                  d.systems.forEach((s, i) => { s.num = systemNum(i + 1); });
                }),
              );
              onAddedSystem(created.id);
            }}
          />
          </div>
        </div>
      ) : null}
    </div>
  );
}
/* ---------- system detail: 12 headings ---------- */

function SystemDetail({ sys, biz, dept, updateSys }: { sys: System; biz: Business; dept: Department; updateSys: (m: (s: System) => void) => void }) {
  /**
   * The ONLY way sections 7 and 8 may be edited.
   *
   * Every mutation re-derives `efforts`/`results` from `pairs`, so the two flat
   * mirrors can never drift — and a row deleted from section 7 disappears from
   * section 8 in the same update, because both render this one array.
   */
  const mutatePairs = (mutate: (list: EffortPair[]) => void) =>
    updateSys((s) => {
      mutate(s.pairs);
      if (!s.pairs.length) s.pairs = [blankPair()];
      syncPairMirrors(s);
    });

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <span className="flex h-6 min-w-[40px] items-center justify-center rounded px-1.5 text-on-accent font-heading text-[11px]" style={{ backgroundColor: NAVY }}>{sys.num}</span>
        <p className="flex-1 text-[19px] font-bold" style={{ color: HEADING }}>{sys.name.toLowerCase()}</p>
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
      <EditableList items={sys.jobs} onChange={(v) => updateSys((s) => { s.jobs = v; })} placeholder={(i) => `One most essential, exact goal ${i} (with expected outcome)`} addLabel="+ ONE MOST ESSENTIAL, EXACT GOAL (WITH EXPECTED OUTCOME)" />

      {/* Sections 7 and 8 are two views of ONE `pairs` array — row n of each is
          one pair. They must never be bound to `efforts`/`results`, which are
          deprecated mirrors: `fixSystem` rebuilds those FROM `pairs` on load, so
          writing only the mirror meant the typed answer survived the save, was
          discarded on the next load, and was then written back as blank. Daily
          answers are keyed by `pair.id`, so the pairing is load-bearing too. */}
      <Section n={7} title="Effort Questions" small="each one gets a result question below" />
      <PairSideList
        pairs={sys.pairs}
        side="effort"
        onChangePairs={mutatePairs}
        placeholder={(i) => `Effort question ${i}`}
        addLabel="+ Add effort question"
      />

      <Section n={8} title="Result Questions" small="one for each effort question above" />
      <PairSideList
        pairs={sys.pairs}
        side="result"
        onChangePairs={mutatePairs}
        placeholder={(i) => `Result question ${i}`}
        addLabel="+ Add result question"
      />

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
      <p className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>No training yet, add the first one below.</p>
      <AddButton label="+ Add training / give another training" accent={Accents.green} onClick={() => updateSys((s) => { s.trainings.push({ id: newId(), trainee: "", trainer: "", date: "", satisfied: "", rating: "", remarks: "" }); })} />
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
            {/* Remarks come BEFORE the verdict: the trainer writes up how it went,
                then says satisfied or not. Asking for the verdict first made the
                remarks read as an afterthought to a decision already taken. */}
            <FLabel>Remarks of the Trainer</FLabel>
            <Area value={t.remarks} onChange={(v) => updateSys((s) => { s.trainings[i].remarks = v; })} placeholder="How did the training go?" />
            <FLabel>How Was The Training?</FLabel>
            <RatingRow label="Training rating" value={shownRating(t.rating, t.satisfied)} onChange={(r) => updateSys((s) => { s.trainings[i].rating = r; s.trainings[i].satisfied = ratingToYN(r); })} />
            {t.satisfied === "yes" ? <PassNote kind="pass">✓ {name} trained well, ready for evaluation (section 11).</PassNote> : null}
            {t.satisfied === "no" ? <>
              <PassNote kind="fail">✗ Trainer not satisfied, {t.trainee.trim() || "trainee"} needs another training session.</PassNote>
              <AddButton label={`+ Give another training to ${t.trainee.trim() || "the trainee"}`} accent={Accents.green} onClick={() => updateSys((s) => { s.trainings.push({ id: newId(), trainee: t.trainee, trainer: t.trainer, date: "", satisfied: "", rating: "", remarks: `Repeat training, trainer not satisfied with training ${i + 1}` }); })} />
            </> : null}
            <DelLink onClick={() => confirmDel(dialog, "Delete this training record?", () => updateSys((s) => { s.trainings.splice(i, 1); }))} />
          </div>
        );
      })}
      <AddButton label="+ Add training / give another training" accent={Accents.green} onClick={() => updateSys((s) => { s.trainings.push({ id: newId(), trainee: "", trainer: "", date: "", satisfied: "", rating: "", remarks: "" }); })} />
    </div>
  );
}

function EvalSection({ sys, updateSys }: { sys: System; updateSys: (m: (s: System) => void) => void }) {
  const dialog = useDialog();
  const lastTrainee = sys.trainings[sys.trainings.length - 1]?.trainee ?? "";
  if (!sys.evals.length) {
    return <>
      <p className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>No evaluation yet, add the first one below.</p>
      <AddButton label="+ Add evaluation / evaluate again" accent={Accents.green} onClick={() => updateSys((s) => { s.evals.push({ id: newId(), trainee: lastTrainee, evaluator: "", evalDate: "", satisfied: "", rating: "", implDate: "", remarks: "" }); })} />
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
            {/* Remarks, then the verdict, then the implementation date — the order
                the work actually happens in. The implementation date stays tied to
                a "yes", so it can only be set once the evaluation has passed. */}
            <FLabel>Remarks of Evaluation</FLabel>
            <Area value={t.remarks} onChange={(v) => updateSys((s) => { s.evals[i].remarks = v; })} placeholder="What did the evaluation find?" />
            <FLabel>Evaluation Result</FLabel>
            <RatingRow label="Evaluation rating" value={shownRating(t.rating, t.satisfied)} onChange={(r) => updateSys((s) => { s.evals[i].rating = r; s.evals[i].satisfied = ratingToYN(r); })} />
            {t.satisfied === "yes" ? <>
              <PassNote kind="pass">✓ {name} passed the evaluation, announce the implementation date:</PassNote>
              <DateField label="Implementation Date" value={t.implDate} onChange={(v) => updateSys((s) => { s.evals[i].implDate = v; })} />
            </> : null}
            {t.satisfied === "no" ? <>
              <PassNote kind="fail">✗ {name} failed the evaluation, another training session is needed. No implementation date.</PassNote>
            </> : null}
            <DelLink onClick={() => confirmDel(dialog, "Delete this evaluation record?", () => updateSys((s) => { s.evals.splice(i, 1); }))} />
          </div>
        );
      })}
      <AddButton label="+ Add evaluation / evaluate again" accent={Accents.green} onClick={() => updateSys((s) => { s.evals.push({ id: newId(), trainee: lastTrainee, evaluator: "", evalDate: "", satisfied: "", rating: "", implDate: "", remarks: "" }); })} />
    </div>
  );
}

function ReviewSection({ sys, updateSys }: { sys: System; updateSys: (m: (s: System) => void) => void }) {
  const dialog = useDialog();
  /** Which person is showing, and which of that person's reviews. Keyed by name
   *  so stepping to another person and back returns to the same review. */
  const [person, setPerson] = useState(0);
  const [rev, setRev] = useState<Record<string, number>>({});
  const lastTrainee = sys.trainings[sys.trainings.length - 1]?.trainee ?? "";
  if (!sys.reviews.length) {
    return <>
      <p className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>No review yet, add the first one below.</p>
      <AddButton label="+ Add fortnightly review" accent={Accents.green} onClick={() => updateSys((s) => { s.reviews.push({ id: newId(), trainee: lastTrainee, reviewer: "", date: "", satisfied: "", rating: "", remarks: "" }); })} />
    </>;
  }
  /* Grouped by PERSON, then stepped through that person's reviews.
     A flat list put every fortnight of every trainee on one page, so following
     one person's progress — which is the whole point of a fortnightly review —
     meant scrolling past everyone else. Reviews with no name yet gather under
     one "Not named yet" group rather than vanishing. */
  const groups: { who: string; items: { r: Review; i: number }[] }[] = [];
  sys.reviews.forEach((r, i) => {
    const who = r.trainee.trim() || "Not named yet";
    const key = who.toLowerCase();
    const found = groups.find((g) => g.who.toLowerCase() === key);
    if (found) found.items.push({ r, i });
    else groups.push({ who, items: [{ r, i }] });
  });

  const pi = Math.min(person, Math.max(0, groups.length - 1));
  const group = groups[pi];
  const ri = Math.min(rev[group.who] ?? group.items.length - 1, group.items.length - 1);
  const cur = group.items[ri];
  const t = cur.r;
  const i = cur.i;

  return (
    <div>
      {groups.length > 1 ? (
        <Stepper
          label={`${group.who.toUpperCase()} · ${pi + 1} OF ${groups.length}`}
          tint={Accents.green}
          atFirst={pi === 0}
          atLast={pi >= groups.length - 1}
          onPrev={() => setPerson(Math.max(0, pi - 1))}
          onNext={() => setPerson(Math.min(groups.length - 1, pi + 1))}
          prevLabel="Previous person"
          nextLabel="Next person"
        />
      ) : null}

      {group.items.length > 1 ? (
        <Stepper
          label={`REVIEW ${ri + 1} OF ${group.items.length}`}
          tint={NAVY}
          atFirst={ri === 0}
          atLast={ri >= group.items.length - 1}
          onPrev={() => setRev((p) => ({ ...p, [group.who]: ri - 1 }))}
          onNext={() => setRev((p) => ({ ...p, [group.who]: ri + 1 }))}
          prevLabel="Previous review"
          nextLabel="Next review"
        />
      ) : null}

      <div className="rounded-lg border border-line bg-surface p-3 mb-2.5 shadow-sm">
        <p className="font-heading text-[12px] tracking-widest text-ink mb-2">
          Review {ri + 1}{ri === group.items.length - 1 && group.items.length > 1 ? " (latest)" : ""}
        </p>
        <PersonField label="Trainee's Name" value={t.trainee} placeholder="Who is being reviewed?" onChange={(v) => updateSys((s) => { s.reviews[i].trainee = v; })} />
        <PersonField label="Reviewer" value={t.reviewer} placeholder="Who is reviewing?" onChange={(v) => updateSys((s) => { s.reviews[i].reviewer = v; })} />
        <DateField label="Review Date" value={t.date} onChange={(v) => updateSys((s) => { s.reviews[i].date = v; })} />
        <FLabel>Fortnightly Progress</FLabel>
        <RatingRow label="Fortnightly progress rating" value={shownRating(t.rating, t.satisfied)} onChange={(r) => updateSys((s) => { s.reviews[i].rating = r; s.reviews[i].satisfied = ratingToYN(r); })} />
        {/* On a fail the confidential note changes register: a serif italic,
            so it reads as a private, handwritten-style note rather than one
            more form field. A pass or an unanswered review stays as it was. */}
        {t.satisfied === "no" ? (
          <p className="mt-3 mb-1 text-[14px] italic" style={{ fontFamily: SERIF, color: Accents.red }}>🔒 Confidential remarks about the trainee</p>
        ) : (
          <p className="font-heading text-[9px] mt-2 mb-0.5" style={{ letterSpacing: "1.5px", color: Accents.red }}>🔒 CONFIDENTIAL REMARKS ABOUT THE TRAINEE</p>
        )}
        <Area
          value={t.remarks}
          onChange={(v) => updateSys((s) => { s.reviews[i].remarks = v; })}
          placeholder="For the reviewer's eyes, honest, confidential notes on the trainee…"
          confidential={t.satisfied === "no"}
        />
        <DelLink onClick={() => confirmDel(dialog, "Delete this review record?", () => updateSys((s) => { s.reviews.splice(i, 1); }))} />
      </div>

      <AddButton label="+ Add fortnightly review" accent={Accents.green} onClick={() => updateSys((s) => { s.reviews.push({ id: newId(), trainee: lastTrainee, reviewer: "", date: "", satisfied: "", rating: "", remarks: "" }); })} />
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
/* `tap-row` for the WCAG 2.2 target size. These were 18px — the text height alone,
   with no padding, on the app's primary "go back up a level" control. */
const Crumb = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="tap-row rounded px-0.5 font-semibold text-[12px]"
    style={{ color: NAVY }}
  >
    {label}
  </button>
);
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
  <GrowField
    autoCorrect="off"
    spellCheck={false}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    aria-label={placeholder}
    maxLength={120}
    /* `var(--field)`, never `transparent`. The ink here is `on-card` (near
       black) because a field is white paper in both themes — so a transparent
       fill paints that ink on the navy CARD at 1.30:1, which is invisible. The
       `Area` below already did this correctly; this input was missed, and it is
       what makes sections 1-5 of the system editor unreadable in dark mode. */
    style={{ backgroundColor: value.trim() ? FIELD_EMPTY : "var(--field-red)", borderColor: value.trim() ? "var(--field-empty-border)" : "var(--field-red-border)" }}
    className="w-full min-h-[40px] rounded-xl border-[1.5px] px-3 py-2 text-[14.5px] text-on-card outline-none focus:border-gold mb-1.5 placeholder:text-placeholder"
  />
);
/** Starts at one line and grows; unlike `TextField` it keeps line breaks,
 *  because remarks are paragraphs. */
const Area = ({ value, onChange, placeholder, confidential }: { value: string; onChange: (v: string) => void; placeholder: string; confidential?: boolean }) => {
  const ref = useAutoGrow(value);
  return (
    <textarea
      ref={ref}
      rows={1}
      autoCorrect="off"
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      maxLength={400}
      style={{
        backgroundColor: value.trim() ? FIELD_EMPTY : "var(--field-red)",
        borderColor: value.trim() ? "var(--field-empty-border)" : "var(--field-red-border)",
        ...(confidential ? { fontFamily: SERIF, fontStyle: "italic", fontSize: "15.5px" } : {}),
      }}
      className="w-full resize-none rounded-xl border-[1.5px] px-3 py-2 text-[14.5px] leading-snug text-on-card outline-none focus:border-gold mb-1.5 placeholder:text-placeholder"
    />
  );
};

/** Georgia is on every desktop and phone; the rest are fallbacks. No download. */
const SERIF = "Georgia, 'Times New Roman', Times, serif";

const RATING_STYLE: Record<Exclude<Rating, "">, { label: string; color: string }> = {
  excellent: { label: "EXCELLENT", color: Accents.green },
  good: { label: "GOOD", color: "var(--p6)" },
  average: { label: "AVERAGE", color: Accents.gold },
  poor: { label: "POOR", color: Accents.red },
};

/**
 * Zaffar's four boxes: EXCELLENT, GOOD, AVERAGE, POOR — pick one.
 *
 * Real buttons with `aria-pressed`, 44px tall. The picked box is filled AND
 * carries a tick, so the choice does not rest on colour alone.
 */
function RatingRow({ value, onChange, label }: { value: Rating; onChange: (r: Exclude<Rating, "">) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="my-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {RATINGS.map((r) => {
        const on = value === r;
        const { label: text, color } = RATING_STYLE[r];
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(r)}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-2 text-[12.5px] font-bold tracking-[0.06em] transition-colors"
            style={{
              borderColor: on ? color : "var(--line)",
              backgroundColor: on ? color : "var(--surface)",
              color: on ? "var(--on-accent)" : "var(--muted)",
            }}
          >
            {on ? <span aria-hidden>✓</span> : null}
            {text}
          </button>
        );
      })}
    </div>
  );
}
const DelLink = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="mt-1 block text-[12px] font-semibold underline" style={{ color: Accents.red }}>Delete</button>
);
const ShareBtn = ({ label, color, onClick }: { label: string; color: string; onClick: () => void }) => (
  <button onClick={onClick} className="rounded border-[1.5px] px-2.5 py-1.5 text-[11px] font-semibold" style={{ borderColor: color, color }}>{label}</button>
);

/**
 * One side of the shared `pairs` array — section 7 renders `effort`, section 8
 * renders `result`, and row n of each is the SAME pair. Adding an effort adds a
 * blank result; deleting either side removes the whole pair, which is why this
 * cannot be two independent string lists.
 */
function PairSideList({
  pairs,
  side,
  onChangePairs,
  placeholder,
  addLabel,
}: {
  pairs: EffortPair[];
  side: "effort" | "result";
  onChangePairs: (mutate: (list: EffortPair[]) => void) => void;
  placeholder: (i: number) => string;
  addLabel: string;
}) {
  const dialog = useDialog();
  const list = pairs.length ? pairs : [blankPair()];
  // A new pair is only allowed once this side's last row has been filled in.
  const canAdd = (list[list.length - 1]?.[side] ?? "").trim().length > 0;
  return (
    <div>
      {list.map((p, i) => (
        <div key={p.id} className="flex items-start gap-3 py-2 border-b border-line">
          <span className="font-heading text-[14px] w-5 text-center pt-1.5" style={{ color: NAVY }}>{i + 1}</span>
          <GrowField
            autoCorrect="off"
            spellCheck={false}
            value={p[side]}
            onChange={(v) => {
              onChangePairs((l) => { if (l[i]) l[i][side] = v; });
            }}
            placeholder={placeholder(i + 1)}
            aria-label={placeholder(i + 1)}
            maxLength={200}
            style={{ backgroundColor: p[side].trim() ? FIELD_EMPTY : "var(--field-red)" }}
            className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-[14px] text-on-card outline-none placeholder:text-placeholder"
          />
          <button
            aria-label={`Delete ${side} question ${i + 1}`}
            title={`Delete ${side} question ${i + 1}`}
            onClick={() => {
              // Deleting removes the PAIR, so the matching row in the other
              // section goes too. Say so, rather than surprising the user.
              const other = side === "effort" ? "result" : "effort";
              void dialog
                .confirm(`Delete ${side} question ${i + 1}?`, {
                  body: `Its matching ${other} question will be removed as well.`,
                  confirmLabel: "Delete",
                  danger: true,
                })
                .then((ok) => { if (ok) onChangePairs((l) => { l.splice(i, 1); }); });
            }}
            className="text-[15px] tap-target flex items-center justify-center"
            style={{ color: "var(--muted)" }}
          >
            <Close size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => {
          if (!canAdd) { void dialog.alert("Fill the previous field first."); return; }
          onChangePairs((l) => { l.push(blankPair()); });
        }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-4 py-3 text-[13.5px] font-semibold transition-colors"
        style={{ borderColor: NAVY, color: NAVY, backgroundColor: `${NAVY}10`, opacity: canAdd ? 1 : 0.45 }}
      >
        <span className="text-lg leading-none">+</span>
        {addLabel.replace(/^\+\s*/, "")}
      </button>
    </div>
  );
}

function EditableList({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (v: string[]) => void; placeholder: (i: number) => string; addLabel: string }) {
  const dialog = useDialog();
  const list = items.length ? items : [""];
  // Only allow a new row once the last one has been filled in.
  const canAdd = (list[list.length - 1] ?? "").trim().length > 0;
  return (
    <div>
      {list.map((it, i) => (
        <div key={i} className="flex items-start gap-3 py-2 border-b border-line">
          <span className="font-heading text-[14px] w-5 text-center pt-1.5" style={{ color: NAVY }}>{i + 1}</span>
          <GrowField
            autoCorrect="off"
            spellCheck={false}
            value={it}
            onChange={(v) => { const n = [...list]; n[i] = v; onChange(n); }}
            placeholder={placeholder(i + 1)}
            aria-label={placeholder(i + 1)}
            maxLength={200}
            style={{ backgroundColor: it.trim() ? FIELD_EMPTY : "var(--field-red)" }}
            className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-[14px] text-on-card outline-none placeholder:text-placeholder"
          />
          <button
            aria-label={`Delete ${placeholder(i + 1).toLowerCase()}`}
            title={`Delete ${placeholder(i + 1).toLowerCase()}`}
            onClick={() => {
              const remove = () => { const n = list.filter((_, x) => x !== i); onChange(n.length ? n : [""]); };
              // A blank row loses nothing, so it goes without asking.
              if (!it.trim()) return remove();
              void dialog
                .confirm(`Delete ${placeholder(i + 1).toLowerCase()}?`, { body: `"${it.trim().slice(0, 60)}${it.trim().length > 60 ? "…" : ""}" will be removed.`, confirmLabel: "Delete", danger: true })
                .then((ok) => { if (ok) remove(); });
            }}
            /* 13px icon in a `tap-target` box: WCAG 2.2 target size, and the
               icon alone gave a screen reader nothing to announce. */
            className="tap-target text-[15px]"
            style={{ color: "var(--muted)" }}
          >
            <Close size={13} />
          </button>
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
