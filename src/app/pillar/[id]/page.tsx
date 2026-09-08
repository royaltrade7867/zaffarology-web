"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";
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
    if (!user) router.replace("/login");
    else if (!user.isVerified) router.replace("/verify-email");
  }, [user, loading, router]);

  if (loading || !user || !user.isVerified) return <Loading />;

  switch (n) {
    case 1:
      return <Pillar1 />;
    case 2:
      return <Pillar2 />;
    case 3:
      return <Pillar3 />;
    case 4:
      return <Pillar4 />;
    // Business Systems is pillar 5 now; 6-8 (Loyalty, AI, Records) are gone.
    case 5:
      return <BusinessSystems />;
    default: {
      const pillar = pillarByNumber(n);
      if (!pillar)
        return (
          <div className="mx-auto max-w-3xl px-4 py-10 text-center text-muted">Unknown pillar.</div>
        );
      return (
        <PillarScaffold pillar={pillar}>
          <p className="py-16 text-center text-muted">Coming soon.</p>
        </PillarScaffold>
      );
    }
  }
}
