"use client";

import Link from "next/link";

import { PILLARS } from "@/lib/pillars";
import { todayLine } from "@/lib/dates";
import { AuthGuard } from "@/components/shell";

export default function HomePage() {
  return (
    <AuthGuard>
      <div className="mb-5">
        <p className="text-[12px] tracking-[3px] font-heading text-gold">THE 5 PILLARS</p>
        <p className="text-[13px] text-muted mt-1">{todayLine()}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PILLARS.map((p) => (
          <Link
            key={p.n}
            href={`/pillar/${p.n}`}
            className="relative flex min-h-[150px] flex-col overflow-hidden rounded-xl border-2 bg-surface p-4 shadow-sm transition-transform hover:-translate-y-0.5"
            style={{ borderColor: p.accent, borderLeftWidth: 8, borderLeftColor: p.accent }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.045]" style={{ backgroundColor: p.accent }} />
            <span className="absolute right-3 top-2.5 font-heading text-[16px]" style={{ color: p.accent }}>›</span>
            <span className="font-heading text-[26px] leading-none" style={{ color: p.accent }}>{p.n}</span>
            <span className="font-heading text-[14px] leading-tight mt-1.5 tracking-wide text-heading">{p.name.toUpperCase()}</span>
            <span className="text-[11px] text-muted mt-1.5 leading-snug">{p.tag}</span>
          </Link>
        ))}
      </div>
    </AuthGuard>
  );
}
