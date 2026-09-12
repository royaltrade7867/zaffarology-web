"use client";

import { useRouter } from "next/navigation";

import { PILLARS } from "@/lib/pillars";

/**
 * The 1-5 pillar switcher.
 *
 * Lives on EVERY signed-in screen except Home — Home is already the five
 * pillars laid out as cards, so repeating the chips above them would be a
 * second copy of the same control. This mirrors the mobile `AppBar`, which has
 * carried the chips on Notes, Reports, Team, About and Profile all along; the
 * web app had them only inside `PillarScaffold`, so off a pillar page there was
 * no way to reach a pillar except by going back to Home first.
 *
 * `active` is optional on purpose: on a pillar page it marks that chip, and
 * everywhere else NO chip is selected, because there the control means "jump to
 * a pillar", not "you are here". A selected chip on the Notes screen would
 * claim Notes is a pillar.
 */
export function PillarChips({ active }: { active?: number }) {
  const router = useRouter();
  return (
    <div
      className="flex gap-1.5 overflow-x-auto py-3"
      role="navigation"
      aria-label="Pillars"
    >
      {PILLARS.map((p) => {
        const on = p.n === active;
        return (
          <button
            key={p.n}
            onClick={() => router.push(`/pillar/${p.n}`)}
            aria-current={on ? "page" : undefined}
            // The visible label is a bare digit, which a screen reader would
            // read as just "3". Name the pillar it goes to.
            aria-label={`Pillar ${p.n}, ${p.name}`}
            title={p.name}
            className="w-9 h-9 shrink-0 rounded-full border-2 font-heading text-[13px] flex items-center justify-center transition-colors"
            /* `--selected` / `--on-selected`, not `--heading` with a fixed
               white: `--heading` is navy in light but CREAM in dark, so white
               on it was 1.20:1 and the selected chip vanished into its own
               fill. These two contrast with each other by construction, in
               both themes. */
            style={{
              borderColor: "var(--gold)",
              backgroundColor: on ? "var(--selected)" : "var(--surface)",
              color: on ? "var(--on-selected)" : "var(--gold)",
            }}
          >
            {p.n}
          </button>
        );
      })}
    </div>
  );
}
