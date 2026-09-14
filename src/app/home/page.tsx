"use client";

import { todayLine } from "@/lib/dates";
import { APP_MOTTO } from "@/content/pillars";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
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
 * Now it is a page with a subject: the workbook's claim, then today's work.
 * The pillars are navigation and live in the chrome — the 1-5 chips below `lg`
 * and the left rail above it — so listing them here would be a third copy of
 * one control.
 */
function Home() {
  const { user } = useAuth();
  const name = firstName(user?.fullName ?? "");

  return (
    <>
      <header className="mb-8">
        {/* The workbook's claim, set the way the book sets it: the forty years
            are struck out because the whole promise is that you skip them.

            Two things this cannot be. It cannot be `line-through`, because the
            struck line is OUTLINED — its fill is transparent, and a
            text-decoration inherits that transparency and disappears. So the
            rule is drawn as an element. And it cannot be one <p>: a screen
            reader would read "achieve 40 years of business success in 3 years",
            which states the opposite of the claim. `<s>` carries the deletion,
            and the heading names itself. */}
        <h1
          aria-label="Achieve 40 years of business success in 3 years."
          className="font-heading uppercase leading-[0.92] tracking-[-0.01em] text-[34px] sm:text-[46px] lg:text-[54px]"
        >
          <span aria-hidden className="block text-heading">Achieve</span>

          <span aria-hidden className="relative block w-fit">
            <span
              className="block"
              style={{
                color: "transparent",
                WebkitTextStroke: "1.5px var(--stroke-ghost)",
              }}
            >
              <s className="no-underline">40 Years</s>
            </span>
            {/* The strike, drawn. Centred on the cap height rather than the line
                box, so it crosses the letterforms and not the descender space. */}
            <span
              className="pointer-events-none absolute inset-x-0 top-[0.52em] h-[3px] rounded-full bg-gold"
            />
          </span>

          <span aria-hidden className="block text-heading">Of Business Success</span>
          <span aria-hidden className="block text-gold">In 3 Years.</span>
        </h1>

        <p className="mt-4 font-heading text-[12px] tracking-[0.16em] text-gold">
          {APP_MOTTO}
        </p>

        {/* The greeting steps down: the headline is the page's one large
            Archivo Black moment, and two competing display lines would halve
            the force of both. */}
        <p className="mt-5 text-[15px] text-ink">
          {name ? `Good to see you, ${name}.` : "Master your mind."}
        </p>
        <p className="mt-1 text-[13.5px] text-muted">{todayLine()}</p>
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

        {/* Home no longer lists the pillars itself. The top bar now carries the
            1-5 chips on EVERY page below `lg`, and the left rail carries them
            from `lg` up — so a list here was the same control a third time, and
            at phone width it sat directly beneath the chips row. */}
      </div>
    </>
  );
}
