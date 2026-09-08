"use client";

import { AuthGuard, Eagle } from "@/components/shell";

const SOCIAL_LINKS = [
  { label: "Instagram", url: "https://www.instagram.com/zaffarology101/" },
  { label: "Facebook", url: "https://www.facebook.com/zaffar.khan.566" },
  { label: "TikTok", url: "https://www.tiktok.com/@zaffarology101" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/zaffar-khan/" },
  { label: "YouTube", url: "https://www.youtube.com/@Zaffarology101" },
  { label: "X (Twitter)", url: "https://x.com/zaffarology101" },
];

const CONTACT = [
  { label: "zaffarkhan.com", url: "https://zaffarkhan.com" },
];

export default function About() {
  return (
    <AuthGuard>
      <div className="flex flex-col items-center text-center">
        <Eagle size={90} />
        <h1 className="font-heading mt-3 text-[26px]">
          <span className="text-gold">ZAFFAR</span>
          <span className="text-heading">OLOGY</span>
        </h1>
        <p className="text-[13px] tracking-widest text-gold font-semibold mt-1">MASTER YOUR MIND — BUILD YOUR LEGACY</p>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-heading text-[18px] text-heading">About Zaffar Khan</h2>
        <p className="text-ink mt-2 leading-relaxed">
          Zaffar Khan is a serial entrepreneur, business coach and author. His 5-Success-Pillars system
          distils decades of hard-won lessons into a simple daily practice — <em>&ldquo;30 Years of Business
          Success in Just 3 Years.&rdquo;</em>
        </p>
        <p className="text-ink mt-3 leading-relaxed">
          This app is the digital companion to the workbook: work through each pillar, track your do-or-die
          days, run 2-minute huddles, build repeatable business systems, and keep your records in order.
        </p>
      </div>

      <div className="mt-5">
        <h3 className="font-heading text-[14px] text-heading mb-2">Follow Zaffar</h3>
        <div className="flex flex-wrap gap-2">
          {[...CONTACT, ...SOCIAL_LINKS].map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-heading hover:bg-line-soft"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
