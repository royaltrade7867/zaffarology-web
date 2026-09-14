/**
 * "Did it land by the date first promised?" — rendered for a report.
 *
 * The wording matters as much as the numbers here. Every figure states its own
 * denominator, and work that cannot be judged is named as unmeasurable rather
 * than being folded into either column: a report that quietly counts undated
 * work as a miss would tell a user they are failing when they simply have not
 * set dates.
 */
import { esc } from '@/reports/html/escape';
import { bar, para, section, stats, table } from '@/reports/html/blocks';
import { friendlyISO } from '@/lib/dates';
import type { DeadlineStats } from '@/reports/stats/deadlines';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/**
 * @param title  Section heading.
 * @param scope  What was counted, e.g. "across the huddle board".
 */
export function deadlineSection(d: DeadlineStats, title: string, scope: string): string {
  // Nothing measurable: say so plainly rather than printing a row of zeroes,
  // which reads like failure rather than like "no deadlines set".
  if (!d.measured) {
    const note = d.noDeadline
      ? `Nothing ${scope} can be measured against a deadline yet, ${d.noDeadline} item${
          d.noDeadline === 1 ? ' has' : 's have'
        } no date set.${d.pending ? ` ${d.pending} still have time to run.` : ''}`
      : `No deadlines recorded ${scope} yet.`;
    return section(title, para(note));
  }

  const headline =
    `${d.onTime} of ${d.measured} finished by the deadline they were first given` +
    (d.hitRate !== null ? `, ${pct(d.hitRate)}.` : '.');

  const counts = stats([
    [d.onTime, 'Met the first deadline'],
    [d.late, 'Finished late'],
    [d.overdue, 'Still open, past due'],
  ]);

  const caveats: string[] = [];
  if (d.pending) {
    caveats.push(
      `${d.pending} not yet due, so ${d.pending === 1 ? 'it is' : 'they are'} not counted either way.`,
    );
  }
  if (d.noDeadline) {
    caveats.push(
      `${d.noDeadline} without a recorded deadline, which cannot be judged on time or late.`,
    );
  }
  if (d.postponed) {
    caveats.push(
      `${d.postponed} ${d.postponed === 1 ? 'was' : 'were'} pushed to a later date. ` +
        'Every figure above is measured against the FIRST deadline, not the new one.',
    );
  }

  const misses = d.misses.length
    ? table(
        ['What', 'First deadline', 'Missed by'],
        d.misses.map((m) => [
          /* The task's full wording. This cut at 70 characters and appended an
             ellipsis, so a longer task read as "Finish the quarterly board pack
             and circulate it to…" in the one place meant to tell you WHAT was
             missed. The cell wraps instead. */
          esc(m.text),
          esc(friendlyISO(m.due) ?? m.due),
          days(m.by),
        ]),
      )
    : '';

  return section(
    title,
    para(headline) +
      counts +
      (d.hitRate !== null ? bar(d.hitRate, `${pct(d.hitRate)} met the first deadline`) : '') +
      (caveats.length ? para(caveats.join(' '), 'muted') : '') +
      (misses ? para('Biggest slips', 'muted') + misses : ''),
  );
}

/** Plain-text form, mirroring the HTML above for the text share. */
export function deadlineText(d: DeadlineStats, title: string, scope: string): string {
  const L: string[] = ['', title.toUpperCase(), '─'.repeat(title.length)];
  if (!d.measured) {
    L.push(
      d.noDeadline
        ? `Nothing ${scope} can be measured against a deadline yet (${d.noDeadline} with no date set).`
        : `No deadlines recorded ${scope} yet.`,
    );
    return L.join('\n');
  }
  L.push(
    `${d.onTime} of ${d.measured} finished by the deadline first given` +
      (d.hitRate !== null ? ` (${pct(d.hitRate)})` : ''),
  );
  L.push(`  Met the first deadline : ${d.onTime}`);
  L.push(`  Finished late          : ${d.late}`);
  L.push(`  Still open, past due   : ${d.overdue}`);
  if (d.pending) L.push(`  Not yet due            : ${d.pending} (not counted either way)`);
  if (d.noDeadline) L.push(`  No deadline set        : ${d.noDeadline} (cannot be judged)`);
  if (d.postponed) {
    L.push('');
    L.push(
      `  ${d.postponed} pushed to a later date, measured against the FIRST deadline, not the new one.`,
    );
  }
  if (d.misses.length) {
    L.push('');
    L.push('  Biggest slips:');
    for (const m of d.misses) {
      L.push(`    - ${m.text} (due ${friendlyISO(m.due) ?? m.due}, missed by ${days(m.by)})`);
    }
  }
  return L.join('\n');
}
