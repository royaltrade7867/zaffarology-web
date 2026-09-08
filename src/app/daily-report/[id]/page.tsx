"use client";

/**
 * One system's daily report.
 *
 * Ports `zaffarology-mobileapp/src/app/daily-report/[id].tsx`. The questions
 * are read from the Pillar 5 blob and the answers written to their own table,
 * so this screen never writes to the blob at all — a system's 12 sections are
 * edited in Pillar 5, and only the day's answers are edited here.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/shell";
import { DailySystemReport } from "@/components/daily-system-report";
import { Back } from "@/components/icons";
import { Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { todayKey } from "@/lib/ids";
import { weekdayShortDate } from "@/lib/dates";
import { healBlob } from "@/pillars/schemas";
import type { System } from "@/pillars/schemas/business-systems";

const P5_KEY = "pillar-8-business-systems";

export default function DailyReportPage() {
  return (
    <AuthGuard>
      <DailyReport />
    </AuthGuard>
  );
}

function DailyReport() {
  const params = useParams<{ id: string }>();
  const systemId = decodeURIComponent(String(params?.id ?? ""));

  const [found, setFound] = useState<{ system: System; deptName: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<{ data: unknown }>(`/v3/pillars/${P5_KEY}`)
      .then((res) => {
        if (!active) return;
        const healed = res?.data == null ? null : healBlob(P5_KEY, res.data);
        if (!healed || healed.kind !== "business-systems") {
          setFound(null);
          return;
        }
        for (const b of healed.data.businesses) {
          for (const d of b.departments) {
            const s = d.systems.find((x) => x.id === systemId);
            if (s) {
              setFound({ system: s, deptName: d.name });
              return;
            }
          }
        }
        setFound(null);
      })
      .catch(() => {
        if (active) setError("Could not load this system.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [systemId]);

  if (!loaded) return <Loading />;

  const back = (
    <Link
      href="/home"
      className="mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-heading transition-colors hover:bg-line-soft"
    >
      <Back size={17} />
      Home
    </Link>
  );

  if (error || !found) {
    return (
      <div>
        {back}
        <p className="text-[14px] text-muted">
          {error ?? "That system no longer exists. It may have been removed in Pillar 5."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {back}
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
        {found.deptName}
      </p>
      <h1 className="font-heading text-[24px] leading-tight text-heading">
        {found.system.name.trim().toUpperCase() || "UNTITLED SYSTEM"}
      </h1>
      <p className="mt-1 mb-6 text-[13px] text-muted">{weekdayShortDate()}</p>

      <DailySystemReport
        systemId={found.system.id}
        pairs={found.system.pairs}
        date={todayKey()}
      />
    </div>
  );
}
