/**
 * Pillar 3's "$ MONEY MADE" is a free-text field — users type "5,000", "$5k",
 * "approx 300", "2.5 lakh". There is no way to read all of it reliably.
 *
 * So the rule for reports: parse tolerantly, and ALWAYS surface what could not be
 * read. A bare total silently omitting three days is worse than no total, because
 * the reader has no way to know it is wrong.
 */

export interface MoneyTotal {
  /** Sum of the entries that parsed. */
  total: number;
  /** How many entries produced a number. */
  parsed: number;
  /** Non-empty entries that could not be read, verbatim, for display. */
  unreadable: string[];
}

/**
 * Best-effort parse of one entry. Handles currency symbols, thousands separators,
 * and a trailing k/m multiplier. Returns null when there is no leading number to
 * read — deliberately conservative: guessing at "two thousand" would be worse.
 */
export function parseMoney(raw: string): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  // Strip currency symbols/codes and grouping separators.
  let cleaned = s
    // "A$" (Australian dollars, the app's currency since 19 Sep) goes first,
    // or stripping "$" alone would leave an unreadable "A250".
    .replace(/a\$/gi, '')
    .replace(/[$£€₹]/g, '')
    .replace(/\b(usd|gbp|eur|pkr|aud|rs)\b/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Allow a leading hedge word — "approx 300" is still one amount.
  cleaned = cleaned.replace(/^(approx|approximately|about|around|roughly|circa|~)\s*/i, '');

  // Only accept a string that is ENTIRELY one amount, optionally with a k/m
  // multiplier. Anything else is reported as unreadable rather than guessed at.
  //
  // This strictness is the point. A permissive "first number wins" rule silently
  // turned "2.5 lakh" into 2.5, "12 000" into 12 and "20 clients $50 each" into
  // 20 — each counted as a SUCCESSFUL parse, so the "could not be read" caveat
  // never appeared and the report showed a confident, wrong total.
  const m = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*([km])?$/i);
  if (!m) return null;

  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;

  const suffix = (m[2] ?? '').toLowerCase();
  if (suffix === 'k') return n * 1_000;
  if (suffix === 'm') return n * 1_000_000;
  return n;
}

/** Total a set of entries, keeping track of what could not be read. */
export function totalMoney(entries: string[]): MoneyTotal {
  let total = 0;
  let parsed = 0;
  const unreadable: string[] = [];

  for (const raw of entries) {
    const s = (raw ?? '').trim();
    if (!s) continue;
    const n = parseMoney(s);
    if (n === null) unreadable.push(s);
    else {
      total += n;
      parsed += 1;
    }
  }
  return { total, parsed, unreadable };
}

/** Group separators for display; no currency symbol, since we don't know theirs. */
export function formatAmount(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('en-GB', { maximumFractionDigits: 2 });
}

/**
 * One honest line about money. Always states the denominator and names anything
 * unreadable, so the reader can judge the number for themselves.
 */
export function describeMoney(m: MoneyTotal, daysWithEntries: number): string {
  if (!m.parsed && !m.unreadable.length) return 'No money recorded in this period.';
  const parts = [`A$${formatAmount(m.total)} recorded across ${m.parsed} of ${daysWithEntries} entries`];
  if (m.unreadable.length) {
    const shown = m.unreadable.slice(0, 3).map((u) => `"${u}"`).join(', ');
    const more = m.unreadable.length > 3 ? ` and ${m.unreadable.length - 3} more` : '';
    parts.push(`${m.unreadable.length} could not be read as a number: ${shown}${more}`);
  }
  return `${parts.join(' · ')}.`;
}
