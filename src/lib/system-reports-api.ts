/**
 * Daily effort/result answers for Pillar 5.
 *
 * The QUESTIONS live in the Pillar 5 blob; the ANSWERS live in their own table,
 * joined by `pair_id`. That split is deliberate: a 40-system user answering
 * every day would otherwise grow the blob past a megabyte and re-upload all of
 * it on every save. It is also why each effort/result pair carries a stable id
 * — answers keyed by list position would silently re-attach to a different
 * question the moment a pair was deleted.
 *
 * Mirrors `zaffarology-mobileapp/src/lib/system-reports-api.ts`; only the
 * transport differs.
 */
import { api } from "@/lib/api";

/** '' means "not answered yet", which is different from 'no'. */
export type Answer = "" | "yes" | "no";

export interface SystemReport {
  id: number;
  /** ISO yyyy-mm-dd */
  date: string;
  system_id: string;
  pair_id: string;
  effort_done: Answer;
  result_done: Answer;
  days_more: number | null;
  reason: string;
  created_at: string | null;
  updated_at: string | null;
}

const qs = (params: Record<string, string | undefined>): string => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export async function loadDayReports(date: string, systemId: string): Promise<SystemReport[]> {
  const data = await api.get<{ reports: SystemReport[] }>(
    `/system-reports${qs({ date, system_id: systemId })}`,
  );
  return data?.reports ?? [];
}

/** Answers across a date range, both ends inclusive. */
export async function loadRangeReports(
  from: string,
  to: string,
  systemId?: string,
): Promise<SystemReport[]> {
  const data = await api.get<{ reports: SystemReport[] }>(
    `/system-reports/range${qs({ date_from: from, date_to: to, system_id: systemId })}`,
  );
  return data?.reports ?? [];
}

/**
 * Record one pair's answer. Idempotent — answering again updates the same row.
 *
 * The server rejects a 'no' with no `daysMore`/`reason`, which is the
 * workbook's rule rather than a UI convention. The client enforces it too so
 * the user is told before the request goes, not after it comes back 400.
 */
export async function saveReport(input: {
  date: string;
  systemId: string;
  pairId: string;
  effortDone: Answer;
  resultDone: Answer;
  daysMore?: number | null;
  reason?: string;
}): Promise<SystemReport> {
  return api.put<SystemReport>("/system-reports", {
    date: input.date,
    system_id: input.systemId,
    pair_id: input.pairId,
    effort_done: input.effortDone,
    result_done: input.resultDone,
    days_more: input.daysMore ?? null,
    reason: input.reason ?? "",
  });
}

/** Email a system's report for a range. The server cannot read the pillar blob,
 *  so the question wording is sent alongside the answers. */
export async function shareSystemReport(input: {
  emails: string[];
  systemId: string;
  systemName: string;
  from: string;
  to: string;
  questions: { pair_id: string; effort: string; result: string }[];
  personal?: string;
}): Promise<void> {
  await api.post("/system-reports/share", {
    emails: input.emails,
    system_id: input.systemId,
    system_name: input.systemName,
    date_from: input.from,
    date_to: input.to,
    questions: input.questions,
    personal: input.personal ?? "",
  });
}
