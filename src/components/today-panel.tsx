"use client";

import Link from "next/link";

import { ChevronRight } from "@/components/icons";
import { Loading } from "@/components/ui";
import { pillarByNumber } from "@/lib/pillars";
import { todayKey } from "@/lib/dates";
import { usePillarState } from "@/lib/use-pillar-state";
import {
  makeInitial as p1Initial,
  normalize as p1Normalize,
  type P1State,
} from "@/pillars/schemas/pillar-1";
import {
  makeInitial as p4Initial,
  normalize as p4Normalize,
  type P4State,
} from "@/pillars/schemas/pillar-4";

/**
 * What today actually asks of you, on Home.
 *
 * Home used to be five pillar cards — a menu, answering "where do I go?" when
 * the question someone opens the app with is "what do I have to do?". The left
 * rail now carries navigation, which freed Home to carry work.
 *
 * READ-ONLY on purpose. Ticking a task here would write to a pillar blob from
 * a screen that does not own it, and `/v3/pillars/{key}` is a whole-blob
 * replace — two writers is how fields get destroyed. Every row is a link into
 * the pillar that owns the data.
 */

const P1 = pillarByNumber(1)!;
const P4 = pillarByNumber(4)!;

export function TodayPanel() {
  const p1 = usePillarState<P1State>(P1.key, p1Initial, p1Normalize);
  const p4 = usePillarState<P4State>(P4.key, p4Initial, p4Normalize);

  // A spinner, not `null`: Home showed an unexplained gap where this card
  // belongs while the two pillars loaded, which reads as nothing happening.
  if (!p1.loaded || !p4.loaded) return <Loading full={false} label="Loading today" />;

  /* Pillar 1 keeps a do-or-die list PER GOAL. The one that matters today is the
     first goal with anything written in it — the same one the pillar opens on. */
  const goal = p1.state.goals.find((g) => g.goal.trim() || g.dod.some((t) => t.text.trim()));
  const dod = (goal?.dod ?? []).filter((t) => t.text.trim());
  const work = goal?.work?.text?.trim() ?? "";

  const today = todayKey();
  const open = p4.state.items.filter((i) => i.name.trim() && i.status !== "completed");
  const overdue = open.filter((i) => i.due && i.due < today);

  const nothing = !work && dod.length === 0 && open.length === 0;

  if (nothing) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-heading text-[15px] text-heading">Nothing set for today yet</h2>
        <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
          Start in Pillar 1: name the one thing that matters most today, then the
          tasks you will not go to bed without.
        </p>
        <Link
          href="/pillar/1"
          className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-gold px-4 text-[13.5px] font-semibold text-on-gold transition-colors hover:bg-gold-hover"
        >
          Plan today
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Pillar 1 — the day's priorities */}
      {work || dod.length ? (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <PanelHead href="/pillar/1" accent={P1.accent} n={1} title="Do or die" />

          {work ? (
            <p className="mt-3 text-[15px] font-semibold leading-snug text-ink">{work}</p>
          ) : null}

          {dod.length ? (
            <ul className="mt-3 space-y-1.5">
              {dod.map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                  <span
                    aria-hidden
                    className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded-full border-2"
                    style={{
                      borderColor: P1.accent,
                      backgroundColor: t.done ? P1.accent : "transparent",
                    }}
                  />
                  <span className={t.done ? "text-muted line-through" : "text-ink"}>{t.text}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-3.5 text-[12px] text-muted">
            {dod.filter((t) => t.done).length} of {dod.length} done
          </p>
        </section>
      ) : null}

      {/* Pillar 4 — the huddle board */}
      {open.length ? (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <PanelHead href="/pillar/4" accent={P4.accent} n={4} title="On the board" />

          <ul className="mt-3 space-y-2">
            {/* Every open task, not the first five. The line below said
                "12 open · showing 5", which named the gap but still made you
                open another screen to see your own board. */}
            {open.map((item) => (
              <li key={item.id} className="text-[13.5px] leading-snug">
                <span className="text-ink">{item.name}</span>
                {item.who.trim() ? (
                  <span className="text-muted"> · {item.who}</span>
                ) : null}
                {item.due && item.due < today ? (
                  <span className="font-semibold text-danger"> · overdue</span>
                ) : null}
              </li>
            ))}
          </ul>

          <p className="mt-3.5 text-[12px] text-muted">
            {open.length} open
            {overdue.length ? `, ${overdue.length} overdue` : ""}
          </p>
        </section>
      ) : null}
    </div>
  );
}

/** The pillar this panel reads from, as a link back to it. */
function PanelHead({
  href,
  accent,
  n,
  title,
}: {
  href: string;
  accent: string;
  n: number;
  title: string;
}) {
  return (
    <Link href={href} className="tap-row group gap-2.5">
      <span
        aria-hidden
        className="font-heading text-[17px] leading-none tabular-nums"
        style={{ color: accent }}
      >
        {n}
      </span>
      <h2 className="font-heading text-[13px] uppercase tracking-[0.12em] text-heading">
        {title}
      </h2>
      <ChevronRight
        size={14}
        className="text-muted transition-transform duration-150 group-hover:translate-x-0.5"
      />
    </Link>
  );
}
