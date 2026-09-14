"use client";

import type { ReactNode } from "react";

import { type PillarMeta } from "@/lib/pillars";
import { todayLine } from "@/lib/dates";
import { SaveStatusBar } from "@/components/save-status";
import type { SaveStatus } from "@/lib/use-pillar-state";

/**
 * The masthead of one pillar page.
 *
 * This used to render its OWN brand bar — eagle, wordmark and a "▦ Pillars"
 * button — directly beneath the app's real top bar, so the wordmark appeared
 * twice on one screen. It also pinned a sticky phone-style header carrying the
 * 1-5 chips. Both are gone: the top bar is the only brand bar, and the left
 * rail is the only pillar switcher.
 *
 * What remains is what a page masthead is for — which pillar this is, what it
 * is called, and what today is.
 */
export function PillarScaffold({
  pillar,
  children,
  saveStatus = "idle",
  onRetrySave,
}: {
  pillar: PillarMeta;
  children: ReactNode;
  /** Surfaced by every pillar so a failed write cannot pass unnoticed. */
  saveStatus?: SaveStatus;
  onRetrySave?: () => void;
}) {
  return (
    <div>
      <header className="mb-6 border-b border-line pb-5">
        <div className="flex items-baseline gap-3">
          {/* The number is the accent, at the size that carries it. */}
          <span
            aria-hidden
            className="font-heading text-[40px] leading-none tabular-nums"
            style={{ color: pillar.accent }}
          >
            {pillar.n}
          </span>
          <h1 className="font-heading text-[26px] leading-tight text-heading sm:text-[30px]">
            {pillar.name}
          </h1>
        </div>

        {pillar.sub ? (
          <p className="mt-2.5 max-w-[68ch] text-[13.5px] leading-relaxed text-muted">
            {pillar.sub}
          </p>
        ) : null}
        <p className="mt-2 text-[13px] text-muted">{todayLine()}</p>
      </header>

      <SaveStatusBar status={saveStatus} onRetry={onRetrySave ?? (() => {})} />
      {children}
    </div>
  );
}
