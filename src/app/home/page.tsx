"use client";

import Link from "next/link";

import { PILLARS } from "@/lib/pillars";
import { todayLine } from "@/lib/dates";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
import { ChevronRight } from "@/components/icons";
import { TodaysReportsCard } from "@/components/todays-reports-card";
import { TodayPanel } from "@/components/today-panel";

/** First name only — the greeting is a hello, not an address label. */
const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

export default function HomePage() {
  return (
    <AuthGuard>
      <Home />
    </AuthGuard>
  );
}

/**
 * Home.
 *
 * This was five equal cards in a 2+2+1 grid — a menu, answering "where do I
 * go?" when the question someone opens the app with is "what does today ask of
 * me?". On a wide screen the odd fifth card left a hole, and everything below
 * it was dead page.
 *
 * Now it is a page with a subject: today's work leads, and the pillars are a
 * quiet index beside it. The left rail already carries the pillars as
 * navigation, so repeating them here as five slabs would be the third copy of
 * one control.
 */
function Home() {
  const { user } = useAuth();
  const name = firstName(user?.fullName ?? "");

  return (
    <>
      <header className="mb-8">
        <h1 className="font-heading text-[32px] leading-[1.05] text-heading sm:text-[40px]">
          {name ? `Good to see you, ${name}.` : "Master your mind."}
        </h1>
        {/* The promise the workbook makes, under the greeting: what the five
            pillars are FOR. The motto closes it, as it does on About. */}
        <p className="mt-3 max-w-[54ch] text-[14.5px] leading-relaxed text-ink">
          Forty years of business success in three years, structured as five pillars.
        </p>
        <p className="mt-1.5 font-heading text-[12px] tracking-[0.16em] text-gold">
          MASTER YOUR MIND — BUILD YOUR LEGACY
        </p>
        <p className="mt-2.5 text-[13.5px] text-muted">{todayLine()}</p>
      </header>

      <div className="space-y-8">
        {/* What today asks of you, read from Pillars 1 and 4. This is the page's
            subject; the pillars themselves are navigation and live in the rail. */}
        <TodayPanel />

        {/* Today's reports. Renders nothing when there are no business systems,
            so an account without them is not shown an empty promise. */}
        <div className="min-w-0">
          <TodaysReportsCard />
        </div>

        {/* The pillars, ONLY below `lg`. From `lg` the left rail carries them
            with the same names and accents, and showing both put the identical
            list on screen twice — the rail on the left and a column on the
            right, three feet apart. */}
        <nav aria-label="Pillars" className="lg:hidden">
          <h2 className="font-heading text-[11px] uppercase tracking-[0.18em] text-muted">
            The five pillars
          </h2>
          <ul className="mt-3 space-y-0.5">
            {PILLARS.map((p) => (
              <li key={p.n}>
                <Link
                  href={`/pillar/${p.n}`}
                  className="group flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-line-soft"
                >
                  <span
                    aria-hidden
                    className="font-heading text-[16px] leading-6 tabular-nums"
                    style={{ color: p.accent }}
                  >
                    {p.n}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold leading-tight text-heading">
                      {p.name}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted">
                      {p.tag}
                    </span>
                  </span>
                  <ChevronRight
                    size={15}
                    className="mt-1 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
