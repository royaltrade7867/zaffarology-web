"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { Loading, cx } from "@/components/ui";

/** Brand wordmark: ZAFFAR (gold) · OLOGY (navy). */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="font-heading tracking-tight" style={{ fontSize: size }}>
      <span className="text-gold">ZAFFAR</span>
      <span className="text-heading">OLOGY</span>
    </span>
  );
}

export function Eagle({ size = 40 }: { size?: number }) {
  // intrinsic 541×424 — keep the aspect. Tailwind preflight sets img{height:auto},
  // so declare it here too to silence Next's aspect-ratio warning.
  return (
    <Image
      src="/eagle.png"
      alt="Zaffarology"
      width={size}
      height={Math.round((size * 424) / 541)}
      style={{ width: size, height: "auto" }}
      priority
    />
  );
}

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/notes", label: "Notes" },
  { href: "/team", label: "Team" },
  { href: "/about", label: "About" },
  { href: "/profile", label: "Profile" },
];

/** Top navigation bar for authenticated pages. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/home" className="flex items-center gap-2.5">
          <Eagle size={34} />
          <Wordmark size={18} />
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href === "/home" && pathname.startsWith("/pillar"));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-[13.5px] font-semibold transition-colors",
                  active ? "bg-heading text-white" : "text-heading hover:bg-line-soft",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/** Guards authenticated pages: redirects to /login (or /verify-email) as needed. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!user.isVerified) router.replace("/verify-email");
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
