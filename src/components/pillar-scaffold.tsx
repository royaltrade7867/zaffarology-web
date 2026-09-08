"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { PILLARS, type PillarMeta } from "@/lib/pillars";
import { todayLine } from "@/lib/dates";
import { Eagle, Wordmark } from "@/components/shell";

/** Brand app-bar + pinned pillar title (number, name, date) + pillar chips.
 *  Stays fixed at the top; only the content scrolls — matches the mobile app. */
export function PillarScaffold({ pillar, children }: { pillar: PillarMeta; children: ReactNode }) {
  const router = useRouter();
  return (
    <div>
      <div className="sticky top-0 z-40 bg-background shadow-sm">
        {/* accent line for the current pillar */}
        <div className="h-[3px] rounded mx-4 mt-2 mb-2" style={{ backgroundColor: pillar.accent }} />
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex items-center justify-between">
            <Link href="/home" className="flex items-center gap-2.5">
              <Eagle size={30} />
              <Wordmark size={15} />
            </Link>
            <Link href="/home" className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-heading">
              ▦ Pillars
            </Link>
          </div>
          {/* chips */}
          <div className="flex gap-1.5 overflow-x-auto py-3">
            {PILLARS.map((p) => {
              const active = p.n === pillar.n;
              return (
                <button
                  key={p.n}
                  onClick={() => router.push(`/pillar/${p.n}`)}
                  className="w-9 h-9 shrink-0 rounded-full border-2 font-heading text-[13px] flex items-center justify-center"
                  style={{
                    borderColor: "var(--gold)",
                    backgroundColor: active ? "var(--heading)" : "var(--surface)",
                    color: active ? "#fff" : "var(--gold)",
                  }}
                >
                  {p.n}
                </button>
              );
            })}
          </div>
          {/* pinned title */}
          <div className="border-b border-line pt-1 pb-3">
            <h1 className="font-heading text-[24px] leading-none text-heading">
              Pillar <span style={{ color: pillar.accent }}>{pillar.n}</span>
            </h1>
            <p className="font-semibold text-[12px] tracking-widest mt-1.5" style={{ color: pillar.accent }}>
              {pillar.name.toUpperCase()}
            </p>
            {pillar.sub ? <p className="text-[13px] text-muted mt-1 leading-snug">{pillar.sub}</p> : null}
            <p className="text-[13px] text-muted mt-1.5">{todayLine()}</p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-4">{children}</div>
    </div>
  );
}
