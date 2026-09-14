/** Date helpers ported 1:1 from the mobile app (same ISO YYYY-MM-DD format). */

/** "Monday, 10 August 2026" */
export function todayLine(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * "5 Aug 2026" - or null if the ISO is invalid / year out of 2000-2100.
 *
 * No weekday. Every date the app SHOWS goes through here, and the typed date
 * fields display `shortDate`, so a weekday here put two formats on one screen:
 * an editable "Project Due Date" reading "5 Aug 2026" directly above a "Due"
 * line reading "Wed, 5 Aug 2026". `weekdayShortDate` remains for the few places
 * that genuinely want the day named.
 */
export function friendlyISO(iso: string): string | null {
  if (!iso) return null;
  const parts = iso.split("-");
  const y = parseInt(parts[0], 10);
  if (!y || y < 2000 || y > 2100) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export type RelClass = "ok" | "soon" | "late";

/** Relative label + colour class for a due date. */
export function relativeISO(iso: string): { text: string; cls: RelClass } | null {
  const parts = iso.split("-");
  const y = parseInt(parts[0], 10);
  if (!y || y < 2000 || y > 2100) return null;
  const target = new Date(iso + "T00:00:00");
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diff === 0) return { text: "due today", cls: "soon" };
  if (diff === 1) return { text: "due tomorrow", cls: "soon" };
  if (diff > 1 && diff <= 7) return { text: `due in ${diff} days`, cls: "soon" };
  if (diff > 7) return { text: `due in ${diff} days`, cls: "ok" };
  if (diff === -1) return { text: "1 day overdue", cls: "late" };
  return { text: `${Math.abs(diff)} days overdue`, cls: "late" };
}

/** Whole-day difference (a - b) in days; positive = a is later. */
export function dayDiff(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00");
  const b = new Date(bIso + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** "5 Aug 2026" short date for filed/archive rows. */
export function shortDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "Wed, 5 Aug 2026" weekday short date. */
export function weekdayShortDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "5 Aug" day+month, used by Pillar 3 filed rows. */
export function mdDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const newId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Local-time YYYY-MM-DD (never UTC, to avoid a day shift). */
export const todayKey = (): string => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
