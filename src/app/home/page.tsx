"use client";

import Link from "next/link";

import { PILLARS } from "@/lib/pillars";
import { todayLine } from "@/lib/dates";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
import { ChevronRight } from "@/components/icons";
import { TodaysReportsCard } from "@/components/todays-reports-card";

/** First name only — the greeting is a hello, not an address label. */
const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

export default function HomePage() {
  return (
    <AuthGuard>
      <Home />
    </AuthGuard>
  );
}

function Home() {
  const { user } = useAuth();
  const name = firstName(user?.fullName ?? "");

  return (
    <>
      {/* The masthead. Archivo Black gets to be large exactly once per screen;
          this is the place, and it is what makes the page feel like the front
          of a workbook rather than a menu. */}
      <header className="mb-7">
        <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-gold">
          The five pillars
        </p>
        <h1 className="mt-1.5 font-heading text-[30px] leading-[1.05] text-heading sm:text-[38px]">
          {name ? `Good to see you, ${name}.` : "Master your mind."}
        </h1>
        <p className="mt-2 text-[13.5px] text-muted">{todayLine()}</p>
      </header>

      {/* Renders nothing when there are no business systems, so it never
          intrudes on an account that has none. */}
      <TodaysReportsCard />

      {/* One column on a phone, two from `sm`. The cards are deliberately not
          all the same weight: the number is the anchor, and the accent lives in
          the number and the hairline rather than a slab of colour. */}
      <nav aria-label="Pillars" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PILLARS.map((p) => (
          <Link
            key={p.n}
            href={`/pillar/${p.n}`}
            className="group relative flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-[0_2px_10px_-4px_rgba(0,0,0,0.18)]"
            style={{ ["--pillar" as string]: p.accent }}
          >
            {/* The accent, once, at the size that carries it. */}
            <span
              aria-hidden
              className="font-heading text-[34px] leading-none tabular-nums"
              style={{ color: p.accent }}
            >
              {p.n}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block font-heading text-[14.5px] uppercase leading-tight tracking-wide text-heading">
                {p.name}
              </span>
              <span className="mt-1.5 block text-[12.5px] leading-snug text-muted">{p.tag}</span>
            </span>

            <ChevronRight
              size={17}
              className="mt-0.5 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5"
            />

            {/* A 1px accent rule at the foot, drawn on hover. Elevation is
                declared once — by the border — so this is the only extra mark. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-4 bottom-0 h-px origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100"
              style={{ backgroundColor: p.accent }}
            />
          </Link>
        ))}
      </nav>
    </>
  );
}
