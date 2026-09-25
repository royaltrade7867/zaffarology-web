"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import Link from "next/link";

import { useAuth } from "@/lib/auth-context";
import { nextQuery, safeNext } from "@/lib/next-path";
import { AuthGuard } from "@/components/shell";
import { Loading } from "@/components/ui";
import { PillarScaffold } from "@/components/pillar-scaffold";
import { pillarByNumber } from "@/lib/pillars";

import Pillar1 from "@/pillars/pillar-1";
import Pillar2 from "@/pillars/pillar-2";
import Pillar3 from "@/pillars/pillar-3";
import Pillar4 from "@/pillars/pillar-4";
import BusinessSystems from "@/pillars/pillar-5-business-systems";

export default function PillarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const n = parseInt(String(params.id), 10);

  useEffect(() => {
    if (loading) return;
    // Keep where they were going. This guard runs BEFORE `AuthGuard` mounts, so
    // it has to carry `next` itself: emails deep-link into a pillar (the task
    // assignment mail opens /pillar/4), and dropping it signed people in and
    // then dumped them on Home to find their way back by hand.
    if (!user) {
      const here = window.location.pathname + window.location.search;
      router.replace(`/login${nextQuery(safeNext(here))}`);
    }
  }, [user, loading, router]);

  if (loading || !user) return <Loading />;

  /* Every pillar renders INSIDE `AuthGuard`, which supplies the top bar, the
     left rail and the page grid. They used to be returned bare, so a pillar
     page had no container at all: content ran edge to edge from x=0 while
     every other screen sat in a centred column. The guard above has already
     checked the session, so `AuthGuard` re-checking is a no-op. */
  const inShell = (body: React.ReactNode) => <AuthGuard>{body}</AuthGuard>;

  switch (n) {
    case 1:
      return inShell(<Pillar1 />);
    case 2:
      return inShell(<Pillar2 />);
    case 3:
      return inShell(<Pillar3 />);
    case 4:
      return inShell(<Pillar4 />);
    // Business Systems is pillar 5 now; 6-8 (Loyalty, AI, Records) are gone.
    case 5:
      return inShell(<BusinessSystems />);
    default: {
      const pillar = pillarByNumber(n);
      if (!pillar)
        /* Keep the app chrome. This used to render the bare words "Unknown
           pillar." on an otherwise empty page — no header, no nav, no link
           home — so a mistyped URL stranded the user with nothing to click.
           `AuthGuard` supplies the nav; the guard above has already checked the
           session, so this only renders for a signed-in user. */
        return (
          <AuthGuard>
            <div className="py-12 text-center">
              <p className="font-heading text-[20px] text-heading">
                There is no Pillar {String(params.id)}
              </p>
              <p className="mx-auto mt-2 max-w-[42ch] text-[14px] leading-relaxed text-muted">
                Zaffarology has five pillars. Pick one above, or go back to the list.
              </p>
              <Link
                href="/home"
                className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-gold px-5 text-[14px] font-semibold text-on-gold transition-colors hover:bg-gold-hover"
              >
                Back to the pillars
              </Link>
            </div>
          </AuthGuard>
        );
      return (
        <PillarScaffold pillar={pillar}>
          <p className="py-16 text-center text-muted">Coming soon.</p>
        </PillarScaffold>
      );
    }
  }
}
