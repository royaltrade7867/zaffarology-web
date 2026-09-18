"use client";

import { useState } from "react";

import { AuthGuard, Eagle } from "@/components/shell";
import { InstructionsPanel } from "@/components/instructions-panel";
import { cx } from "@/components/ui";
import { APP_MOTTO } from "@/content/pillars";
import {
  Facebook,
  Globe,
  Instagram,
  LinkedIn,
  TikTok,
  XTwitter,
  YouTube,
} from "@/components/icons";

/* Each entry carries its own mark, so the list stays one thing to edit. Icons
   are drawn in `icons.tsx` rather than loaded from a CDN — the CSP blocks
   external images and stylesheets, so a remote sprite would fail silently. */
const SOCIAL_LINKS = [
  { label: "Instagram", url: "https://www.instagram.com/zaffarology101/", Icon: Instagram },
  { label: "Facebook", url: "https://www.facebook.com/zaffar.khan.566", Icon: Facebook },
  { label: "TikTok", url: "https://www.tiktok.com/@zaffarology101", Icon: TikTok },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/zaffar-khan/", Icon: LinkedIn },
  { label: "YouTube", url: "https://www.youtube.com/@Zaffarology101", Icon: YouTube },
  { label: "X (Twitter)", url: "https://x.com/zaffarology101", Icon: XTwitter },
];

const CONTACT = [
  { label: "zaffarkhan.com", url: "https://zaffarkhan.com", Icon: Globe },
];

type Tab = "about" | "instructions";

export default function About() {
  const [tab, setTab] = useState<Tab>("about");

  return (
    <AuthGuard>
      {/* The brand sits BESIDE the content, not stacked above it and centred.
          A centred eagle over a centred wordmark over a centred tagline is a
          phone's splash screen; on a wide page it pushes everything below the
          fold and leaves two empty margins. */}
      <div className="flex items-center gap-5 border-b border-line pb-6">
        <Eagle size={72} />
        <div className="min-w-0">
          <h1 className="font-heading text-[26px] leading-none">
            <span className="text-gold">ZAFFAR</span>
            <span className="text-heading">OLOGY</span>
          </h1>
          <p className="mt-1.5 text-[13px] font-semibold tracking-widest text-gold">
            {APP_MOTTO}
          </p>
        </div>
      </div>

      {/* Two things live on this screen: who Zaffar is, and how to use the
          app. They are different errands, so they get a switcher rather than
          one long scroll. */}
      <div role="group" aria-label="Section" className="mt-6 flex gap-2">
        {(
          [
            /* The KEY stays `about` — it is the tab's state value and the route.
               Only the label people read changes. */
            { k: "about" as const, label: "Help" },
            { k: "instructions" as const, label: "Instructions" },
          ]
        ).map(({ k, label }) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => setTab(k)}
              className={cx(
                "rounded-xl border px-4 py-2 text-[13.5px] font-semibold transition-colors",
                on
                  ? "border-selected bg-selected text-on-selected"
                  : "border-line text-heading hover:bg-line-soft",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "instructions" ? (
        <div className="mt-7">
          <InstructionsPanel />
        </div>
      ) : (
        <>
      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-heading text-[18px] text-heading">About Zaffar Khan</h2>
        <p className="text-ink mt-2 leading-relaxed">
          Zaffar Khan is a serial entrepreneur, business coach and author. His 5-Success-Pillars system
          distils decades of hard-won lessons into a simple daily practice. <em>&ldquo;40 Years of Business
          Success in Just 3 Years.&rdquo;</em>
        </p>
        <p className="text-ink mt-3 leading-relaxed">
          This platform is the digital companion to the workbook: work through each pillar, track your do-or-die
          days, run 2-minute huddles, build repeatable business systems, and keep your records in order.
        </p>
      </div>

      <div className="mt-5">
        <h3 className="font-heading text-[14px] text-heading mb-2">Follow Zaffar</h3>
        <div className="flex flex-wrap gap-2">
          {[...CONTACT, ...SOCIAL_LINKS].map(({ url, label, Icon }) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              /* `noopener` as well as `noreferrer`: without it the opened tab
                 gets a handle on this one via `window.opener`. */
              className="flex min-h-[36px] items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-3.5 text-[13px] font-semibold text-heading transition-colors hover:bg-line-soft"
            >
              {/* The label is right there, so the mark is decorative — a `title`
                  here would make a screen reader read the name twice. */}
              <Icon size={16} className="shrink-0 text-gold" />
              {label}
            </a>
          ))}
        </div>
      </div>
        </>
      )}
    </AuthGuard>
  );
}
