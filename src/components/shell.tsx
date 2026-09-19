"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { onPaymentRequired } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Loading, cx } from "@/components/ui";
import { Close, Menu } from "@/components/icons";
import { PillarChips } from "@/components/pillar-chips";
import { PillarRail } from "@/components/pillar-rail";

/** Brand wordmark: ZAFFAR (gold) · OLOGY (navy). */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="font-heading tracking-tight" style={{ fontSize: size }}>
      <span className="text-gold">ZAFFAR</span>
      <span className="text-heading">OLOGY</span>
    </span>
  );
}

/**
 * The eagle. Two files, because the artwork's body IS the brand navy
 * (`#1b3a5c`, 90% of its pixels) — on the dark page that is 1.34:1 and the bird
 * all but vanishes. `eagle-dark.png` is the same artwork with the body recoloured
 * to the theme's cream (13.06:1); the gold beak is untouched, since it reads on
 * both grounds.
 *
 * Both are rendered and one is hidden by CSS rather than picked in JS: the theme
 * is applied before React hydrates, so a JS choice would flash the wrong bird on
 * first paint. `priority` on the light one only — the dark copy must not compete
 * for the preload slot on a light page.
 */
export function Eagle({ size = 40 }: { size?: number }) {
  // intrinsic 541×424 — keep the aspect. Tailwind preflight sets img{height:auto},
  // so declare it here too to silence Next's aspect-ratio warning.
  const h = Math.round((size * 424) / 541);
  const box = { width: size, height: "auto" } as const;
  return (
    <>
      <Image
        src="/eagle.png"
        alt="Zaffarology"
        width={size}
        height={h}
        style={box}
        className="eagle-light"
        priority
      />
      <Image
        src="/eagle-dark.png"
        alt=""
        aria-hidden
        width={size}
        height={h}
        style={box}
        className="eagle-dark"
      />
    </>
  );
}

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/notes", label: "Notes" },
  { href: "/reports", label: "Reports" },
  { href: "/team", label: "Team" },
  /* The ROUTE stays `/about` — it is a live URL and the folder name. Only the
     label people read changes. */
  { href: "/about", label: "Help" },
  { href: "/profile", label: "Profile" },
];

/**
 * Top navigation for authenticated pages.
 *
 * The six links plus the wordmark need ~580px. Below that they used to overlap
 * the logo and run off the right edge, and because the page does not scroll
 * horizontally, Team / About / Profile were UNREACHABLE on a phone — half the
 * app. Under `sm` the links collapse into a menu instead.
 */
export function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    pathname === href || (href === "/home" && pathname.startsWith("/pillar"));
  /* The five pillars are reachable from every page, at every width. They used
     to be hidden on Home (which listed them itself) and on a pillar page
     (which had the rail) — but below `lg` the rail is gone, so those two
     screens had no pillar row at all. The chips now mirror the rail: whenever
     the rail is not showing, the chips are. */
  const activePillar = /^\/pillar\/(\d+)/.exec(pathname)?.[1];

  // Route change closes the menu — otherwise it stays open over the new page.
  useEffect(() => setOpen(false), [pathname]);

  // Escape closes, matching every other dismissible surface in the app.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 lg:px-6">
        <Link href="/home" className="tap-row min-w-0 gap-2.5">
          <Eagle size={34} />
          <Wordmark size={18} />
        </Link>

        {/* Wide: every destination visible. */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={cx(
                "rounded-lg px-3 py-1.5 text-[13.5px] font-semibold transition-colors",
                isActive(n.href) ? "bg-selected text-on-selected" : "text-heading hover:bg-line-soft",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Narrow: one button, 44px so it is a real touch target. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="zaff-nav-menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-heading transition-colors hover:bg-line-soft sm:hidden"
        >
          {open ? <Close size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* The 1-5 switcher, on EVERY signed-in screen below `lg`. From `lg` the
          left rail carries the same five with their names, so the two never
          show at once — that would be one control rendered twice. */}
      <div className="mx-auto max-w-6xl px-4 lg:hidden">
        <PillarChips active={activePillar ? Number(activePillar) : undefined} />
      </div>

      {open ? (
        <nav id="zaff-nav-menu" className="border-t border-line px-4 pb-3 pt-2 sm:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={cx(
                "block rounded-lg px-3 py-3 text-[15px] font-semibold transition-colors",
                isActive(n.href) ? "bg-selected text-on-selected" : "text-heading hover:bg-line-soft",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

/**
 * Pages a signed-in user reaches even without a subscription.
 *
 * `/profile` hosts the billing card — gating it would lock someone out of the
 * one page that lets them pay. `/about` is Help, which is where a confused
 * person goes. Both are deliberate holes in the gate, not oversights.
 */
const OPEN_WITHOUT_SUBSCRIPTION = ["/profile", "/about"];

/** Guards authenticated pages: redirects to /login, /verify-email or /paywall. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, billing, billingLoading, refreshBilling } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Held in a ref so the 402 listener below can be registered ONCE. Subscribing
  // on every change of `refreshBilling` would add and drop a listener each
  // render, and a 402 arriving mid-swap would reach nobody.
  const refreshBillingRef = useRef(refreshBilling);
  refreshBillingRef.current = refreshBilling;
  const exempt = OPEN_WITHOUT_SUBSCRIPTION.some((p) => pathname.startsWith(p));
  // `billing === null` means "not known yet", NOT "locked out". Treating unknown
  // as locked would flash the paywall at a paying customer on every slow load.
  const locked = !billingLoading && billing !== null && !billing.entitled;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Keep where they were going, so signing in lands them there rather than
      // dumping them on Home and making them navigate again.
      const here = window.location.pathname + window.location.search;
      const next = here && here !== "/" ? `?next=${encodeURIComponent(here)}` : "";
      router.replace(`/login${next}`);
      // Verification BEFORE subscription: telling someone to pay when they
      // cannot yet sign in properly is the wrong order.
    } else if (!user.isVerified) router.replace("/verify-email");
    else if (locked && !exempt) router.replace("/paywall");
  }, [user, loading, locked, exempt, router]);

  // A mid-session lapse never reaches the effect above, because nothing
  // navigates. `request()` announces the 402, this re-reads status, `locked`
  // flips, and the redirect follows.
  useEffect(() => onPaymentRequired(() => void refreshBillingRef.current?.()), []);

  if (loading || !user || !user.isVerified) return <Loading />;
  if (locked && !exempt) return <Loading />;
  return (
    <>
      <TopNav />
      {/* The page grid. Every authenticated screen used to be `max-w-3xl` —
          768px on a 1440px monitor, so nearly half the screen was dead margin
          and the whole app read as a phone in a browser. The rail takes the
          left column from `lg`, and the content column still caps its own
          reading measure internally; a wide page is not a wide paragraph. */}
      <div className="mx-auto flex max-w-6xl gap-10 px-4 py-6 lg:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          {/* `top-24` clears the sticky header (56px) with air to spare.
              The height cap and `overflow-y-auto` matter on a short viewport —
              a laptop at 700px with browser chrome — where the rail would
              otherwise be taller than the space it is pinned in and its last
              rows would be unreachable. */}
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <PillarRail />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}

/** Simple centered container for auth (login/signup) pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-md px-5 py-10">{children}</main>;
}
