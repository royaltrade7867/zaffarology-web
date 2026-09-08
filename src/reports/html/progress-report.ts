/**
 * Report B — cross-pillar progress over a date range.
 *
 * The honesty rules from the plan are enforced here, not left to the reader:
 *  - only Pillars 1, 3, 4 keep history, so everything else is labelled "as of today"
 *  - "N of M days recorded" is always shown, because rollover only runs when a
 *    screen is opened, so recorded days never equal elapsed days
 *  - rate stats are suppressed below MIN_DAYS_FOR_RATES and replaced with counts
 *  - money always names what could not be parsed
 * A methodology footer repeats these so the document stands on its own.
 */
import { Accents } from '@/lib/pillars';
import { hasContent, type LoadedPillar } from '@/reports/loaded';
import { todayKey } from '@/lib/ids';
import { deadlineSection } from '@/reports/html/deadline-section';
import {
  p1Deadlines,
  p4Deadlines,
  totalDeadlines,
  type DeadlineStats,
} from '@/reports/stats/deadlines';
import {
  describeCoverage,
  describeMoney,
  MIN_DAYS_FOR_RATES,
  p1Stats,
  p2Stats,
  p3Stats,
  p4Stats,
  p8Stats,
  type DateRange,
} from '@/reports/stats';
import type { ReportMeta } from '@/reports/types';

import { bar, card, footer, para, pill, section, stats, table } from './blocks';
import { esc } from './escape';
import { renderShell } from './shell';

const pct = (v: number | null): string => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** One headline line per pillar for the engagement grid. */
function headline(loaded: LoadedPillar, range: DateRange): string {
  if (loaded.status === 'error') return 'Could not be loaded';
  if (!hasContent(loaded)) return 'Not started yet';
  const d = loaded.data!;
  switch (d.kind) {
    case 'p1': {
      const s = p1Stats(d.data, range);
      return `${s.activeGoals} goal${s.activeGoals === 1 ? '' : 's'} · ${s.overdue} overdue · ${s.dueSoon} due within 7 days`;
    }
    case 'p2': {
      const s = p2Stats(d.data);
      return `${s.solutionsOnTable} solution${s.solutionsOnTable === 1 ? '' : 's'} on the table · ${s.solvedArchive} solved`;
    }
    case 'p3': {
      const s = p3Stats(d.data, range);
      return `${s.coverage.recorded} days recorded · ${pct(s.achieved.pct)} of planned work achieved`;
    }
    case 'p4': {
      const s = p4Stats(d.data, range);
      return `${s.total} on the board · ${s.completedIncludingFiled} completed · ${s.overdue} overdue`;
    }
    case 'business-systems': {
      const s = p8Stats(d.data);
      return `${s.systems} system${s.systems === 1 ? '' : 's'} across ${s.businesses} business${s.businesses === 1 ? '' : 'es'} · ${s.untrained} with no training`;
    }
  }
}

/** Detail block for the three pillars that can actually be reported over a range. */
function rangeDetail(loaded: LoadedPillar, range: DateRange): string {
  const d = loaded.data;
  if (!d || loaded.status !== 'ok') return '';

  if (d.kind === 'p1') {
    const s = p1Stats(d.data, range);
    const enough = s.coverage.recorded >= MIN_DAYS_FOR_RATES;
    return section(
      `Pillar 1 · ${loaded.meta.name}`,
      card(
        stats([
          [s.activeGoals, 'Active goals'],
          [s.withTarget, 'With a target date'],
          [s.overdue, 'Overdue'],
          [s.dueSoon, 'Due within 7 days'],
        ]) +
          (enough
            ? bar(s.dodRange.pct, `Do-or-Die completed in this period, ${s.dodRange.done} of ${s.dodRange.total} (${pct(s.dodRange.pct)})`)
            : para(
                `Only ${s.coverage.recorded} day${s.coverage.recorded === 1 ? '' : 's'} recorded in this period, showing counts rather than a rate.`,
                'empty',
              )) +
          para(describeCoverage(s.coverage)) +
          table(
            ['Goal', 'Target', 'Do-or-Die today', 'Open delegated'],
            s.goals.map((g) => [
              g.goal || 'Untitled goal',
              g.target || '—',
              `${g.dod.done} of ${g.dod.total}`,
              `${g.delegOpen}${g.delegOverdue ? ` (${g.delegOverdue} overdue)` : ''}`,
            ]),
          ),
      ),
    );
  }

  if (d.kind === 'p3') {
    const s = p3Stats(d.data, range);
    const enough = s.coverage.recorded >= MIN_DAYS_FOR_RATES;
    return section(
      `Pillar 3 · ${loaded.meta.name}`,
      card(
        stats([
          [s.coverage.recorded, 'Days recorded'],
          [s.perfectDays, 'Perfect days'],
          [s.reflectionDays, 'Days reflected on'],
        ]) +
          (enough
            ? bar(s.achieved.pct, `Planned work achieved, ${s.achieved.done} of ${s.achieved.total} (${pct(s.achieved.pct)})`)
            : para(
                `Only ${s.coverage.recorded} day${s.coverage.recorded === 1 ? '' : 's'} recorded, showing counts rather than a rate.`,
                'empty',
              )) +
          para(describeCoverage(s.coverage)) +
          para(describeMoney(s.money, s.moneyEntryDays)),
      ),
    );
  }

  if (d.kind === 'p4') {
    const s = p4Stats(d.data, range);
    return section(
      `Pillar 4 · ${loaded.meta.name}`,
      card(
        stats([
          [s.total, 'On the board'],
          [s.completedIncludingFiled, 'Completed'],
          [s.overdue, 'Overdue'],
          [s.slipped, 'Deadline moved'],
        ]) +
          (s.filedCount
            ? para(
                `${s.completed} completed on the board, plus ${s.filedCount} completed and filed away.`,
              )
            : '') +
          para(
            `Completed early: ${s.early} · completed late: ${s.late} · still open: ${s.noStatus}.`,
          ) +
          para(
            `The board changed on ${s.changedDays} day${s.changedDays === 1 ? '' : 's'} in this period. The app only records the board when it changes, so quiet days are not counted as inactivity.`,
          ),
      ),
    );
  }

  return '';
}

/**
 * The cross-pillar deadline picture: of everything given a date, how much landed
 * on time. Built only from the pillars that actually record a first deadline —
 * counting the others would inflate the denominator with work that was never
 * measurable.
 */
function deadlinesAcrossPillars(loaded: LoadedPillar[]): string {
  const today = todayKey();
  const parts: DeadlineStats[] = [];
  for (const l of loaded) {
    if (l.status !== 'ok' || !l.data) continue;
    const d = l.data;
    if (d.kind === 'p4') parts.push(p4Deadlines(d.data, today));
    else if (d.kind === 'p1') parts.push(p1Deadlines(d.data, today));
  }
  if (!parts.length) return '';
  return deadlineSection(
    totalDeadlines(parts),
    'Deadlines kept',
    'across your pillars',
  );
}

export function renderProgressReport(
  loaded: LoadedPillar[],
  range: DateRange,
  meta: ReportMeta,
  opts: { excludeBusinessSystems?: boolean } = {},
): string {
  const visible = opts.excludeBusinessSystems
    ? loaded.filter((l) => l.meta.key !== 'pillar-8-business-systems')
    : loaded;

  const grid = table(
    ['Pillar', 'Status'],
    visible.map((l) => [`${l.meta.n}. ${l.meta.name}`, headline(l, range)]),
  );

  const started = visible.filter((l) => hasContent(l)).length;
  const failed = visible.filter((l) => l.status === 'error');

  const detail = visible.map((l) => rangeDetail(l, range)).join('');

  const body =
    section(
      'Where things stand',
      stats([
        [`${started} of ${visible.length}`, 'Pillars in use'],
        [`${range.from} → ${range.to}`, 'Period covered'],
      ]) + grid,
    ) +
    (failed.length
      ? section(
          'Could not be loaded',
          para(
            `${failed.map((f) => `Pillar ${f.meta.n}`).join(', ')} could not be loaded, so ${
              failed.length === 1 ? 'it is' : 'they are'
            } not represented above.`,
          ),
        )
      : '') +
    deadlinesAcrossPillars(visible) +
    detail +
    (opts.excludeBusinessSystems
      ? section('Note', para('Pillar 5 (Business Systems) was deliberately left out of this report.'))
      : '');

  return renderShell({
    title: 'Zaffarology, Progress report',
    heading: 'Progress Report',
    subheading: `${range.from} to ${range.to}`,
    accent: Accents.navy,
    metaLines: [
      meta.userName,
      ...(meta.companyName ? [meta.companyName] : []),
      `Generated ${meta.generatedOn}`,
    ],
    body,
  }).replace(
    '</body>',
    `${footer([
      'How to read this report:',
      'Pillars 1, 3 and 4 keep a daily history, so their figures cover the period above. Pillar 5 keeps its own daily effort and result answers. The remaining pillars keep no history and are reported as they stand today.',
      'A day is only recorded when the app is opened on that day, so "days recorded" is not the same as days worked.',
      'Money is typed as free text, so any figure states how many entries it could and could not read.',
      'Names appear exactly as entered in the app.',
    ])}</body>`,
  );
}

export { headline as pillarHeadline };
