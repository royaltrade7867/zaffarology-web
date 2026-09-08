"use client";

/**
 * How to use the app: the general instructions, then what each pillar asks.
 *
 * The copy is the workbook's, not new writing. Pillar rows are collapsed by
 * default — the general part is what a first-time reader needs, and five
 * expanded pillars would bury it — and each row carries its pillar's accent, so
 * the list reads as the app's own pillars rather than a generic FAQ.
 *
 * Ported from `zaffarology-mobileapp/src/components/instructions-panel.tsx`.
 */
import { useState } from "react";

import { ChevronRight } from "@/components/icons";
import { cx } from "@/components/ui";
import { HOW_TO_USE, PILLAR_INSTRUCTIONS } from "@/content/instructions";

export function InstructionsPanel() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section>
      <h2 className="font-heading text-[20px] leading-tight text-heading">
        {HOW_TO_USE.title.toUpperCase()}
      </h2>

      {HOW_TO_USE.sections.map((s, i) => (
        <div key={i} className="mt-4">
          <h3 className="font-heading text-[13px] uppercase tracking-wide text-heading">
            {s.heading}
          </h3>
          <p className="mt-1 max-w-[68ch] text-[14px] leading-relaxed text-ink">{s.body}</p>
        </div>
      ))}

      {/* Zaffar's own words close the general section, as in the workbook. */}
      <blockquote
        className="mt-6 rounded-2xl border-l-[3px] bg-surface px-4 py-3.5"
        style={{ borderColor: "var(--gold)" }}
      >
        <p className="text-[14px] italic leading-relaxed text-ink">{HOW_TO_USE.zaffarSays}</p>
        {HOW_TO_USE.zaffarSays2 ? (
          <p className="mt-2 text-[14px] italic leading-relaxed text-ink">
            {HOW_TO_USE.zaffarSays2}
          </p>
        ) : null}
      </blockquote>

      <h2 className="mt-9 font-heading text-[20px] leading-tight text-heading">
        THE FIVE PILLARS
      </h2>
      <p className="mt-1 mb-3 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
        What each one asks of you, and how it is worked.
      </p>

      <ul className="space-y-2">
        {PILLAR_INSTRUCTIONS.map((p) => {
          const isOpen = open === p.meta.n;
          const accent = p.meta.accent;
          const panelId = `pillar-instructions-${p.meta.n}`;
          return (
            <li key={p.meta.n} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : p.meta.n)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-line-soft"
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-heading text-[14px]"
                  style={{ backgroundColor: `${accent}14`, color: accent }}
                >
                  {p.meta.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {p.meta.name}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">{p.tagline}</span>
                </span>
                <ChevronRight
                  size={17}
                  className={cx(
                    "shrink-0 text-muted transition-transform",
                    isOpen ? "rotate-90" : "",
                  )}
                />
              </button>

              {isOpen ? (
                <div id={panelId} className="border-t border-line px-4 pb-4 pt-3">
                  {/* The workbook's own title, which differs from the app's
                      short name on pillar 1. */}
                  <p
                    className="font-heading text-[12px] uppercase tracking-wide"
                    style={{ color: accent }}
                  >
                    {p.title}
                  </p>

                  {p.howItWorks ? (
                    <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-ink">
                      {p.howItWorks}
                    </p>
                  ) : null}

                  {p.steps.length ? (
                    <ol className="mt-4 space-y-2.5">
                      {p.steps.map((s, i) => (
                        <li key={i} className="flex gap-3">
                          <span
                            aria-hidden
                            className="shrink-0 font-heading text-[12px] leading-6"
                            style={{ color: accent }}
                          >
                            {s.num}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[14px] leading-snug text-ink">
                              {s.heading}
                            </span>
                            {s.subtext ? (
                              <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">
                                {s.subtext}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  {p.summary ? (
                    <div className="mt-4">
                      <p className="font-heading text-[11px] uppercase tracking-wide text-muted">
                        Summary
                      </p>
                      <p className="mt-1 max-w-[68ch] text-[14px] leading-relaxed text-ink">
                        {p.summary}
                      </p>
                    </div>
                  ) : null}

                  {p.coreTruth ? (
                    <div
                      className="mt-4 rounded-xl px-3.5 py-3"
                      style={{ backgroundColor: `${accent}0F` }}
                    >
                      <p
                        className="font-heading text-[11px] uppercase tracking-wide"
                        style={{ color: accent }}
                      >
                        Core truth
                      </p>
                      <p className="mt-1 text-[14px] font-semibold leading-relaxed text-ink">
                        {p.coreTruth}
                      </p>
                    </div>
                  ) : null}

                  {p.zaffarSays ? (
                    <p className="mt-4 max-w-[68ch] text-[13.5px] italic leading-relaxed text-muted">
                      “{p.zaffarSays}”
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
