"use client";

import { pillarByNumber, Accents } from "@/lib/pillars";
import { shortDate } from "@/lib/dates";
import { usePillarState } from "@/lib/use-pillar-state";
import { PillarScaffold } from "@/components/pillar-scaffold";
import { Loading, MiwBox, SectionLabel, AddButton, Hint } from "@/components/ui";
import { TaskRow, Footer, FiledBox, type TaskAction } from "@/components/task";
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
  type Filed,
  type P2State,
  type Sol,
  normalize,
} from "@/pillars/schemas/pillar-2";


const makeInitial = (): P2State => ({
  problem: "",
  sols: [{ text: "", done: false }],
  filed: [],
});

const pillar = pillarByNumber(2)!;
const GREEN = Accents.green;

export default function Pillar2() {
  const dialog = useDialog();
  const { state, update, loaded } = usePillarState<P2State>(pillar.key, makeInitial, normalize);
  if (!loaded) return <Loading />;

  const sols = state.sols.length ? state.sols : [{ text: "", done: false }];
  const winner = sols.find((s) => s.done && s.text.trim());
  const nonEmpty = sols.filter((s) => s.text.trim()).length;
  // Only from a filled last row, so the list cannot grow blank rows.
  const lastSolFilled = !sols.length || !!sols[sols.length - 1].text.trim();
  const addSol = () => {
    if (!lastSolFilled) return;
    update((s) => { s.sols.push({ text: "", done: false }); });
  };

  const progress = winner
    ? "Winning solution found ✓"
    : `${nonEmpty} ${nonEmpty === 1 ? "solution" : "solutions"} on the table`;

  const fileEntry = (solution: string): boolean => {
    if (!state.problem.trim()) {
      void dialog.alert("Write the exact problem first.");
      return false;
    }
    update((s) => {
      s.filed = [
        { problem: s.problem, solution: solution.trim() || "(no winning solution noted)", date: shortDate() },
        ...s.filed,
      ];
    });
    return true;
  };

  const fileSolved = (solution: string) => {
    if (!fileEntry(solution)) return;
    update((s) => {
      s.problem = "";
      s.sols = [{ text: "", done: false }];
    });
  };

  const solvedReset = async () => {
    const win = sols.find((s) => s.done && s.text.trim());
    if (!await dialog.confirm("File this problem as solved and start a fresh one?")) return;
    fileSolved(win?.text ?? "");
  };

  const solActions = (i: number): TaskAction[] => [
    {
      label: "Delete",
      kind: "delete",
      onClick: () =>
        update((s) => {
          s.sols.splice(i, 1);
          if (!s.sols.length) s.sols = [{ text: "", done: false }];
        }),
    },
    { label: "File", kind: "file", onClick: () => fileEntry(state.sols[i].text) },
    {
      label: "Solved",
      kind: "file",
      onClick: async () => {
        if (!await dialog.confirm("File this problem as SOLVED with this solution and start a fresh one?")) return;
        fileSolved(state.sols[i].text);
      },
    },
  ];

  return (
    <PillarScaffold pillar={pillar}>
      {/* Exact Problem */}
      <section className="mb-8">
        <SectionLabel
          text="Exact Problem"
          small="write it exactly, a clear problem is half solved"
          color={pillar.accent}
        />
        <MiwBox accent={pillar.accent}>
          <textarea
            value={state.problem}
            onChange={(e) => update((s) => { s.problem = e.target.value; })}
            placeholder="What exactly is the problem?"
            maxLength={300}
            rows={2}
            autoCorrect="off"
            spellCheck={false}
            style={{ backgroundColor: state.problem.trim() ? "var(--field)" : "var(--field-empty)" }}
            className="w-full resize-y rounded-lg px-2 py-2 font-semibold text-[16px] text-on-card outline-none placeholder:text-placeholder min-h-[60px]"
          />
        </MiwBox>
      </section>

      {/* Possible Solutions */}
      <section className="mb-8">
        <SectionLabel
          text="Possible Solutions"
          small="keep going, add as many as you can think of"
          color={GREEN}
        />
        {sols.map((sol, i) => (
          <TaskRow
            key={i}
            accent={GREEN}
            symbol={`S${i + 1}`}
            value={sol.text}
            done={sol.done}
            onChange={(t) => update((s) => { s.sols[i].text = t; })}
            onToggle={(v) => update((s) => { s.sols[i].done = v; })}
            onDelete={() =>
              update((s) => {
                s.sols.splice(i, 1);
                if (!s.sols.length) s.sols = [{ text: "", done: false }];
              })
            }
            actions={solActions(i)}
            locked={i > 0 && !sols[i - 1].text.trim()}
            placeholder={`Possible solution ${i + 1}…`}
            noStrike
          />
        ))}
        {/* Gated like every other repeating list: a new row only once the last
            one says something, or the list grows blank rows nobody meant. */}
        <AddButton
          label="+ Add possible solution"
          accent={GREEN}
          dimmed={!lastSolFilled}
          onClick={addSol}
        />
        <div className="mt-2">
          <Hint>Tick ✓ the solution that works, then choose: Delete, File, or Solved.</Hint>
        </div>
        <Footer progress={progress} resetLabel="Solved, file & start new problem" onReset={solvedReset} />
      </section>

      {/* Solved Problems */}
      <FiledBox
        title="Solved Problems"
        empty="No solved problems yet."
        clearLabel="Clear all solved"
        hasItems={state.filed.length > 0}
        onClear={async () => {
          if (await dialog.confirm("Delete all solved problems?")) update((s) => { s.filed = []; });
        }}
      >
        {state.filed.map((f, i) => (
          <div key={i} className="border-b border-line py-2">
            <p className="font-bold text-[13px] text-ink">{f.problem}</p>
            <p className="mt-0.5 font-semibold text-[13px]" style={{ color: GREEN }}>✓ {f.solution}</p>
            <p className="mt-0.5 text-[11px] text-muted">Solved {f.date}</p>
          </div>
        ))}
      </FiledBox>
    </PillarScaffold>
  );
}
