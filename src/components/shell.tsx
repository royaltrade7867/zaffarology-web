"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { Loading, cx } from "@/components/ui";
import { Close, Menu } from "@/components/icons";
import { PillarChips } from "@/components/pillar-chips";

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
  { href: "/about", label: "About" },
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
  const showChips = pathname !== "/home" && !pathname.startsWith("/pillar");

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
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/home" className="flex min-h-[24px] min-w-0 items-center gap-2.5">
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

      {/* The 1-5 switcher, on every signed-in screen EXCEPT Home and the pillar
          pages. Home already lays the pillars out as cards, and a pillar page
          carries its own copy inside PillarScaffold with the current chip
          marked — rendering it here too would duplicate the control. Without
          this, Notes / Reports / Team / About / Profile had no way to reach a
          pillar except by going back to Home first. */}
      {showChips ? (
        <div className="mx-auto max-w-3xl px-4">
          <PillarChips />
        </div>
      ) : null}

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

/** Guards authenticated pages: redirects to /login (or /verify-email) as needed. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Keep where they were going, so signing in lands them there rather than
      // dumping them on Home and making them navigate again.
      const here = window.location.pathname + window.location.search;
      const next = here && here !== "/" ? `?next=${encodeURIComponent(here)}` : "";
      router.replace(`/login${next}`);
    } else if (!user.isVerified) router.replace("/verify-email");
  }, [user, loading, router]);

  if (loading || !user || !user.isVerified) return <Loading />;
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}

/** Simple centered container for auth (login/signup) pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-md px-5 py-10">{children}</main>;
}
