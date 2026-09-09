"use client";

import { useEffect, useState } from "react";

import { pillarByNumber, Accents, INK, FIELD_EMPTY } from "@/lib/pillars";
import { dayDiff, friendlyISO, shortDate, todayKey } from "@/lib/dates";
import { usePillarState } from "@/lib/use-pillar-state";
import { PillarScaffold } from "@/components/pillar-scaffold";
import { AssignedToMe } from "@/components/assigned-to-me";
import { ChevronLeft, ChevronRight, Close } from "@/components/icons";
import { PersonTagField } from "@/components/person-tag-field";
import { assignTask, unassignTask } from "@/lib/connections-api";
import { apiErrorMessage } from "@/lib/api";
import { usePartners, useIncomingAssignments, useOutgoingAssignments, type Partner } from "@/lib/use-connections";
import { Loading, SectionLabel, AddButton } from "@/components/ui";
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
  type Item,
  type P4State,
  type Status,
  blank,
  makeInitial,
  normalize,
} from "@/pillars/schemas/pillar-4";
import {
  DateField,
  PersonField,
  YesNoRow,
  PassNote,
  FiledBox,
  DayReport,
  DayGroup,
  DayTask,
  DayField,
} from "@/components/task";



const pillar = pillarByNumber(4)!;
const BLUE = Accents.blue;

/** Snapshot the board as it stood on the closing day (the board itself carries on). */
function rollover(s: P4State, closingDate: string) {
  const filled = s.items.filter((it) => it.name.trim());
  if (filled.length) {
    // The board carries on unchanged across days; only snapshot when it actually
    // differs from the last snapshot so idle days don't pile up identical copies.
    const prev = s.history[0];
    const changed = !prev || JSON.stringify(prev.items) !== JSON.stringify(filled);
    if (changed) s.history = [{ date: closingDate, items: filled }, ...s.history].slice(0, 180);
  }
  s.day = todayKey();
}

const isOverdue = (item: Item) =>
  item.status !== "completed" && !!item.due && dayDiff(item.due, todayKey()) < 0;
const countSentences = (t: string) => t.split(/[.!?]+/).filter((s) => s.trim()).length;
const earlyStr = (item: Item) => {
  if (!item.completedOn || !item.due) return "";
  const d = dayDiff(item.due, item.completedOn);
  if (d > 0) return `🏆 ${d} day${d === 1 ? "" : "s"} early`;
  if (d === 0) return "On the due date";
  return "";
};

/** Field label, ports the mobile FLabel. */
function FLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[13px] text-muted mb-1 mt-1">{children}</span>;
}

export default function Pillar4() {
  const dialog = useDialog();
  const { state, update, loaded } = usePillarState<P4State>(pillar.key, makeInitial, normalize);
  const [cur, setCur] = useState(0);
  // Assignments live on server rows, never in the blob — see use-connections.ts.
  const { partners } = usePartners();
  const [assignTick, setAssignTick] = useState(0);
  const incoming = useIncomingAssignments(assignTick);
  const outgoing = useOutgoingAssignments(pillar.key, assignTick);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    const today = todayKey();
    if (!state.day) update((s) => { s.day = today; });
    else if (state.day !== today) update((s) => { if (s.day !== today) rollover(s, s.day); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!loaded) return <Loading />;

  const items = state.items.length ? state.items : [blank()];
  const idx = Math.min(cur, items.length - 1);
  const item = items[idx];
  const border = item.status === "completed" ? Accents.green : isOverdue(item) ? Accents.red : "var(--line)";

  const setItem = (patch: Partial<Item>) => update((s) => { s.items[idx] = { ...s.items[idx], ...patch }; });

  /** The status of THIS item's assignment, if it was sent to someone. */
  const sent = outgoing.byTaskId[item.id];

  /**
   * Tagging sends it immediately — the tag IS the assignment, so a tag that sat
   * there un-sent would be a promise the other person never receives. The id is
   * only written into the blob once the server has accepted it, so a failure
   * can't leave a tag pointing at an assignment that does not exist.
   */
  const onTag = async (partner: Partner | null, notify = true) => {
    if (assigning) return;
    if (!partner) {
      const existing = sent;
      if (existing) {
        // Clear the tag only once the server has actually unassigned it.
        // Clearing first (which mobile still does) leaves this board looking
        // untagged while the task is still sitting on the assignee's board —
        // the two would disagree until someone reloaded.
        setAssigning(true);
        try {
          await unassignTask(existing.id);
          setItem({ assigneeUserId: "" });
          setAssignTick((t) => t + 1);
        } catch (err) {
          void dialog.alert(apiErrorMessage(err, "Couldn't unassign. Please try again."));
        } finally {
          setAssigning(false);
        }
        return;
      }
      // Nothing was ever sent, so there is only a local tag to drop.
      setItem({ assigneeUserId: "" });
      return;
    }
    if (!item.name.trim()) {
      void dialog.alert("Give this item a name first, so they know what they're being asked to do.");
      return;
    }
    setAssigning(true);
    try {
      await assignTask({
        assigneeUserId: partner.userId,
        pillarKey: pillar.key,
        taskId: item.id,
        title: item.name,
        due: item.due,
        notify,
      });
      setItem({ assigneeUserId: String(partner.userId) });
      setAssignTick((t) => t + 1);
    } catch (err) {
      // Leave the typed name alone — losing what they wrote would be worse than
      // a failed assignment they can retry.
      void dialog.alert(apiErrorMessage(err, "Couldn't assign that task. Please try again."));
    } finally {
      setAssigning(false);
    }
  };

  const removeItem = async () => {
    if (!await dialog.confirm("Remove this item from the huddle board?")) return;
    update((s) => {
      s.items.splice(idx, 1);
      if (!s.items.length) s.items = [blank()];
    });
    setCur((c) => Math.max(0, c - 1));
  };

  const fileItem = () => {
    if (!item.name.trim()) {
      void dialog.alert("This item has no name, nothing to file.");
      return;
    }
    update((s) => {
      s.filed = [{ name: item.name, who: item.who, early: earlyStr(item), date: shortDate() }, ...s.filed];
      s.items.splice(idx, 1);
      if (!s.items.length) s.items = [blank()];
    });
    setCur((c) => Math.max(0, c - 1));
  };

  const onStatus = (v: "yes" | "no") => {
    if (v === "yes") setItem({ status: "completed", completedOn: item.completedOn || todayKey() });
    else setItem({ status: "notdone" });
  };

  return (
    <PillarScaffold pillar={pillar}>
      <AssignedToMe rows={incoming.rows} onToggle={incoming.markDone} accent={BLUE} />

      <SectionLabel text="Huddle Board" small="one project at a time, 2 minutes each" color={BLUE} />

      {/* Navigator */}
      <div className="flex items-center justify-between mb-3">
        <button
          disabled={idx === 0}
          onClick={() => setCur((c) => Math.max(0, c - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border-[1.5px] transition-colors"
          style={{ borderColor: idx === 0 ? "var(--line)" : BLUE, color: idx === 0 ? "var(--placeholder)" : BLUE }}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-heading text-[12px] tracking-wide uppercase" style={{ color: INK }}>
          {`Item ${idx + 1} of ${items.length}`}
        </span>
        <button
          disabled={idx >= items.length - 1}
          onClick={() => setCur((c) => Math.min(items.length - 1, c + 1))}
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border-[1.5px] transition-colors"
          style={{ borderColor: idx >= items.length - 1 ? "var(--line)" : BLUE, color: idx >= items.length - 1 ? "var(--placeholder)" : BLUE }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Item card */}
      <div
        className="rounded-lg border-2 p-3.5 shadow-sm"
        style={{ borderColor: border, backgroundColor: item.status === "completed" ? "rgba(31,107,74,0.03)" : "#FFFFFF" }}
      >
        <FLabel>Project / Task Name</FLabel>
        <input
          value={item.name}
          onChange={(e) => setItem({ name: e.target.value })}
          placeholder="What is the project or task?"
          maxLength={100}
          autoCorrect="off"
          spellCheck={false}
          style={{ backgroundColor: item.name.trim() ? "var(--field)" : FIELD_EMPTY }}
          className="w-full rounded-lg px-2 py-2 mb-1.5 font-semibold text-[16px] text-on-card outline-none placeholder:text-placeholder"
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <PersonTagField
              label="Delegated To"
              value={item.who}
              placeholder="Who owns it?"
              onChangeText={(t) => setItem({ who: t })}
              accent={BLUE}
              partners={partners}
              tagUserId={item.assigneeUserId}
              onTag={onTag}
              statusNote={
                sent
                  ? (sent.status === "completed"
                      ? `✓ ${sent.assignee_name} marked this done`
                      : `Sent to ${sent.assignee_name}, waiting`) +
                    // Several people can hold the same source task; say so
                    // rather than silently showing only the first.
                    (outgoing.extraCount(item.id)
                      ? ` · +${outgoing.extraCount(item.id)} more assigned`
                      : "")
                  : null
              }
            />
          </div>
          <div className="flex-1">
            <DateField label="Project Due Date" value={item.due} onChange={(iso) => setItem({ due: iso })} />
          </div>
        </div>

        <YesNoRow
          value={item.status === "completed" ? "yes" : item.status === "notdone" ? "no" : ""}
          onChange={onStatus}
          yesLabel="Completed"
          noLabel="Not Completed"
        />

        {item.status === "completed" ? (
          <div>
            <DateField label="Completed On" value={item.completedOn} onChange={(iso) => setItem({ completedOn: iso })} />
            {(() => {
              const d = item.completedOn && item.due ? dayDiff(item.due, item.completedOn) : null;
              if (d === null) return null;
              if (d > 0) return <PassNote kind="pass">🏆 Finished {d} day{d === 1 ? "" : "s"} early!</PassNote>;
              if (d === 0) return <PassNote kind="gold">✓ Finished right on the due date</PassNote>;
              return <PassNote kind="fail">Finished {Math.abs(d)} day{Math.abs(d) === 1 ? "" : "s"} after due date</PassNote>;
            })()}
          </div>
        ) : null}

        {item.status === "notdone" ? (
          <div>
            <p className="font-heading text-[10px] tracking-wide mt-2 mb-1.5" style={{ color: Accents.red }}>
              NO REASONS WHY. NEW COMPLETION DATE ONLY.
            </p>
            <DateField label="New Completion Date" value={item.newDate} onChange={(iso) => setItem({ newDate: iso })} />
            <FLabel>Note (optional - 1 to 3 sentences max)</FLabel>
            <textarea
              value={item.note}
              onChange={(e) => setItem({ note: e.target.value })}
              placeholder="What happens next. Not why it didn't happen."
              maxLength={280}
              autoCorrect="off"
              spellCheck={false}
              style={{ backgroundColor: item.note.trim() ? "var(--field)" : FIELD_EMPTY }}
              className="w-full min-h-[64px] rounded-[10px] border-[1.5px] border-line px-3 py-3 text-[15px] text-on-card outline-none focus:border-gold resize-y placeholder:text-placeholder"
            />
            <p className="text-[12px] font-semibold mt-1.5" style={{ color: countSentences(item.note) > 3 ? Accents.red : "var(--muted)" }}>
              {countSentences(item.note)} / 3 sentences{countSentences(item.note) > 3 ? ", too long, cut it down" : ""}
            </p>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-3">
          <button onClick={removeItem} className="mr-auto p-1 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
            <Close size={13} /> Remove
          </button>
          {item.status === "completed" ? (
            <>
              <button
                onClick={() => {
                  update((s) => {
                    s.items.splice(idx, 1);
                    if (!s.items.length) s.items = [blank()];
                  });
                  setCur((c) => Math.max(0, c - 1));
                }}
                className="rounded-[3px] border-[1.5px] px-2 py-1 text-[11px] font-semibold"
                style={{ borderColor: Accents.red, color: Accents.red }}
              >
                Delete
              </button>
              <button
                onClick={fileItem}
                className="rounded-[3px] border-[1.5px] px-2 py-1 text-[11px] font-semibold"
                style={{ borderColor: "var(--ink)", color: "var(--ink)" }}
              >
                File
              </button>
            </>
          ) : null}
        </div>
      </div>

      <AddButton
        label="+ Add project / task to the huddle"
        accent={BLUE}
        onClick={() => {
          update((s) => { s.items.push(blank()); });
          setCur(items.length);
        }}
      />

      <DayReport
        history={state.history}
        renderDay={(d) => (
          <DayGroup label="Huddle Board" color={BLUE}>
            {d.items.map((it, i) => (
              <div key={i}>
                <DayTask
                  text={it.who ? `${it.name} → ${it.who}` : it.name}
                  done={it.status === "completed"}
                  accent={BLUE}
                />
                {it.due ? <DayField label="Due" value={friendlyISO(it.due) ?? it.due} /> : null}
              </div>
            ))}
          </DayGroup>
        )}
      />

      <FiledBox
        title="Completed, Filed"
        empty="Nothing completed and filed yet."
        clearLabel="Clear all filed"
        hasItems={state.filed.length > 0}
        onClear={async () => {
          if (await dialog.confirm("Delete everything in the filed archive?")) update((s) => { s.filed = []; });
        }}
      >
        {state.filed.map((f, i) => (
          <div key={i} className="py-2 border-b border-line">
            <div className="flex justify-between">
              <span className="flex-1 font-bold text-[13px] text-ink">✓ {f.name}</span>
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>{f.date}</span>
            </div>
            {f.who ? <p className="text-[12px] font-medium mt-0.5" style={{ color: Accents.blue }}>Delegated to: {f.who}</p> : null}
            {f.early ? <p className="text-[12px] font-bold mt-0.5" style={{ color: Accents.green }}>{f.early}</p> : null}
          </div>
        ))}
      </FiledBox>
    </PillarScaffold>
  );
}
