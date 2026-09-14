"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PILLARS } from "@/lib/pillars";

/**
 * The five pillars, as a persistent left rail on wide screens.
 *
 * This replaces the circular numbered chips, which were a phone tab bar: five
 * 36px circles in a scrolling row, carrying a bare digit and no name. On a
 * 1440px screen there is room to say what each pillar IS, and a rail that
 * persists across every page is the difference between a site you navigate and
 * an app you tab through.
 *
 * Hidden below `lg`, where the top bar's menu already covers every destination
 * and horizontal space is the scarce thing.
 *
 * The active row uses `--selected` / `--on-selected`, never `--heading` with a
 * fixed white: `--heading` is navy in light but CREAM in dark, so white on it
 * was 1.20:1 and the selection vanished into its own fill. Those two tokens
 * contrast with each other by construction, in both themes.
 */
export function PillarRail() {
  const pathname = usePathname();

  return (
    <nav aria-label="Pillars" className="hidden lg:block">
      <p className="px-3 pb-2 font-heading text-[11px] uppercase tracking-[0.18em] text-muted">
        The five pillars
      </p>

      <ul className="space-y-0.5">
        {PILLARS.map((p) => {
          const active = pathname === `/pillar/${p.n}`;
          return (
            <li key={p.n}>
              <Link
                href={`/pillar/${p.n}`}
                aria-current={active ? "page" : undefined}
                className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-line-soft"
                style={
                  active
                    ? { backgroundColor: "var(--selected)", color: "var(--on-selected)" }
                    : undefined
                }
              >
                {/* The number carries the accent, and is the only place colour
                    appears at rest — a slab of accent per row would turn the
                    rail into five competing bars. On the active row the accent
                    would sit on `--selected` at an unknown ratio, so it defers
                    to the paired token instead. */}
                <span
                  aria-hidden
                  className="font-heading text-[15px] leading-6 tabular-nums"
                  style={active ? undefined : { color: p.accent }}
                >
                  {p.n}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-[13px] font-semibold leading-tight"
                    style={active ? undefined : { color: "var(--heading)" }}
                  >
                    {p.name}
                  </span>
                  <span
                    className={
                      active
                        ? "mt-0.5 block text-[11.5px] leading-snug opacity-80"
                        : "mt-0.5 block text-[11.5px] leading-snug text-muted"
                    }
                  >
                    {p.tag}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
