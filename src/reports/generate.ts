/**
 * Build and deliver a report.
 *
 * Mirrors `zaffarology-mobileapp/src/reports/generate.ts`, with one difference:
 * mobile hands the HTML to `expo-print` and opens a share sheet, whereas the
 * web downloads a real PDF built by `@/reports/pdf`. Everything upstream of
 * that — loading, healing, the "is there anything here" check — is the same, so
 * the two apps agree on what a report contains.
 */
import { todayLine } from "@/lib/dates";
import { PILLARS } from "@/lib/pillars";
import { hasContent } from "@/reports/loaded";
import { loadAllPillars, loadPillar, UnverifiedError } from "@/reports/load";
import { downloadPillarPdf, downloadProgressPdf } from "@/reports/pdf";
import { renderPillarText, renderProgressText } from "@/reports/text";
import { lastNDays, type DateRange } from "@/reports/stats/range";
import type { ReportMeta } from "@/reports/types";

export { UnverifiedError } from "@/reports/load";

/** Raised when the user asks for a report of something they have not started. */
export class NoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoDataError";
  }
}

export interface Identity {
  userId: string;
  fullName: string;
  companyName?: string;
}

export type ReportFormat = "pdf" | "text";

const metaFor = (id: Identity): ReportMeta => ({
  userName: id.fullName,
  companyName: id.companyName,
  generatedOn: todayLine(),
});

/**
 * Put text on the clipboard.
 *
 * `navigator.clipboard` needs a secure context and a user gesture; it is called
 * straight from the click handler for that reason. The `execCommand` path is
 * the fallback for older Safari and for plain-HTTP dev servers, where the async
 * API simply is not there.
 */
async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through — a rejected permission is not worth surfacing when there
    // is a working fallback right here.
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}

/** One pillar. `text` copies to the clipboard; `pdf` downloads a file. */
export async function sharePillarReport(
  id: Identity,
  pillarNumber: number,
  format: ReportFormat,
): Promise<void> {
  const loaded = await loadPillar(id.userId, pillarNumber);
  if (!loaded) throw new NoDataError("That pillar does not exist.");
  if (!hasContent(loaded)) {
    const name = PILLARS.find((p) => p.n === pillarNumber)?.name ?? "That pillar";
    throw new NoDataError(`${name} has nothing in it yet. Fill some of it in first.`);
  }

  const meta = metaFor(id);
  if (format === "text") {
    await copyText(renderPillarText(loaded, meta));
    return;
  }
  // A pillar report has no date range of its own; the stats that take one use
  // the last 30 days, matching what the pillar screens show.
  await downloadPillarPdf(loaded, meta, lastNDays(30));
}

/** Every pillar, over a date range. */
export async function shareProgressReport(
  id: Identity,
  range: DateRange,
  format: ReportFormat,
  opts: { excludeBusinessSystems?: boolean } = {},
): Promise<void> {
  const loaded = await loadAllPillars(id.userId);
  if (!loaded.some(hasContent)) {
    throw new NoDataError("There is nothing in your pillars yet. Fill some of it in first.");
  }

  const meta = metaFor(id);
  if (format === "text") {
    await copyText(renderProgressText(loaded, range, meta, opts));
    return;
  }
  await downloadProgressPdf(loaded, meta, range, opts);
}
