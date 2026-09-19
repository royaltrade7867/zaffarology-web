/**
 * Plain-text reports, for sharing via WhatsApp / email / Messages.
 *
 * This is the variant that works without any native module, so it ships ahead of
 * the PDF. It follows the same honesty rules as the HTML report: state the
 * denominator, name what could not be parsed, never imply coverage that isn't there.
 */
import { friendlyISO } from '@/lib/dates';
import { todayKey } from '@/lib/ids';
import { deadlineText } from '@/reports/html/deadline-section';
import { p1Deadlines, p4Deadlines } from '@/reports/stats/deadlines';
import { hasContent, type LoadedPillar } from '@/reports/loaded';
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

const RULE = '─'.repeat(34);
const pct = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)}%`);
const tick = (done: boolean) => (done ? '[x]' : '[ ]');

const lines = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join('\n');

const taskLines = (tasks: { text: string; done: boolean }[], indent = '  ') => {
  const filled = tasks.filter((t) => t.text.trim());
  if (!filled.length) return `${indent}(nothing recorded)`;
  return filled.map((t) => `${indent}${tick(t.done)} ${t.text.trim()}`).join('\n');
};

const header = (title: string, meta: ReportMeta, subtitle?: string) =>
  lines(
    'ZAFFAROLOGY · 5 PILLARS',
    RULE,
    title.toUpperCase(),
    subtitle,
    meta.userName,
    meta.companyName,
    `Generated ${meta.generatedOn}`,
    RULE,
  );

/* ------------------------------ Report A: pillar ---------------------------- */

function pillarBody(loaded: LoadedPillar): string {
  const d = loaded.data;
  if (loaded.status === 'error') return 'This pillar could not be loaded.';
  if (!d) return '(nothing recorded yet)';

  switch (d.kind) {
    case 'p1':
      return (
        deadlineText(
          p1Deadlines(d.data, todayKey()),
          'Deadlines kept',
          'across your goals and delegated tasks',
        ) + '\n\n'
      ) + d.data.goals
        // Must match the HTML report and `hasContent`, or a user whose goal has
        // only Do-or-Die tasks filled gets a text report saying they recorded
        // nothing while the PDF shows all of it.
        .filter(
          (g) =>
            g.goal.trim() ||
            g.plan.trim() ||
            g.target.trim() ||
            g.work.text.trim() ||
            g.dod.some((t) => t.text.trim()) ||
            g.extra.some((t) => t.text.trim()) ||
            g.deleg.some((x) => x.text.trim()),
        )
        .map((g, i) =>
          lines(
            `EXACT GOAL (PROJECT) ${i + 1}`,
            `  ${g.goal.trim() || '(not filled in)'}`,
            '',
            'PLAN',
            `  ${g.plan.trim() || '(not filled in)'}`,
            g.target ? `\nTARGET DATE\n  ${friendlyISO(g.target) ?? g.target}` : '',
            '\nWORK OF THE DAY',
            taskLines([g.work]),
            '\nDO OR DIE',
            taskLines(g.dod),
            '\nGO THE EXTRA MILE',
            taskLines(g.extra),
            '\nDELEGATED',
            g.deleg.filter((x) => x.text.trim()).length
              ? g.deleg
                  .filter((x) => x.text.trim())
                  .map(
                    (x) =>
                      `  ${tick(x.done)} ${x.text.trim()}${x.who ? ` → ${x.who}` : ''}${
                        x.due ? ` (due ${friendlyISO(x.due) ?? x.due})` : ''
                      }`,
                  )
                  .join('\n')
              : '  (nothing delegated)',
            RULE,
          ),
        )
        .join('\n') || '(no goals recorded yet)';

    case 'p2':
      return lines(
        'EXACT PROBLEM',
        `  ${d.data.problem.trim() || '(not filled in)'}`,
        '\nPOSSIBLE SOLUTIONS',
        taskLines(d.data.sols),
        d.data.filed.length ? `\nSOLVED PROBLEMS (${d.data.filed.length})` : '',
        ...d.data.filed.map((f) => `  • ${f.problem} → ${f.solution} (${f.date})`),
      );

    case 'p3':
      return lines(
        'WORK OF THE DAY',
        taskLines([d.data.work]),
        '\nDO OR DIE',
        taskLines(d.data.dod),
        '\nGO THE EXTRA MILE',
        taskLines(d.data.extra),
        "\nTODAY'S ACHIEVEMENT",
        `  ${d.data.pm.trim() || '(not filled in)'}`,
        '\nMONEY MADE',
        `  ${d.data.money.trim() ? `A$${d.data.money.trim()}` : '(not filled in)'}`,
      );

    case 'p4': {
      const items = d.data.items.filter((i) => i.name.trim());
      if (!items.length) return '(nothing on the huddle board yet)';
      const dl = deadlineText(p4Deadlines(d.data, todayKey()), 'Deadlines kept', 'on this board');
      return dl + '\n\n' + items
        .map((i) =>
          lines(
            `• ${i.name.trim()}`,
            i.who ? `    Owner: ${i.who}` : '',
            i.due ? `    Due: ${friendlyISO(i.due) ?? i.due}` : '',
            `    Status: ${i.status === 'completed' ? 'Completed' : i.status === 'notdone' ? 'Not completed' : 'Open'}`,
            i.note ? `    Note: ${i.note}` : '',
          ),
        )
        .join('\n');
    }

    case 'business-systems':
      if (!d.data.businesses.length) return '(no businesses recorded yet)';
      return d.data.businesses
        .map((b) =>
          lines(
            b.name || 'Untitled business',
            ...b.departments.map((dept) =>
              lines(
                `  ${dept.num ? `${dept.num} ` : ''}${dept.name || 'Untitled department'}`,
                ...dept.systems.map((s) =>
                  lines(
                    `    ${s.num} ${s.name || 'Untitled system'}`,
                    s.responsible ? `      Responsible: ${s.responsible}` : '',
                    s.freq ? `      Frequency: ${s.freq}` : '',
                    s.steps.filter((x) => x.trim()).length
                      ? `      Steps: ${s.steps.filter((x) => x.trim()).join(' → ')}`
                      : '',
                  ),
                ),
              ),
            ),
          ),
        )
        .join('\n');
  }
}

export function renderPillarText(loaded: LoadedPillar, meta: ReportMeta): string {
  return lines(
    header(`Pillar ${loaded.meta.n}, ${loaded.meta.name}`, meta),
    '',
    pillarBody(loaded),
    '',
    RULE,
    'Sent from the Zaffarology 5 Pillars app.',
  );
}

/* ----------------------------- Report B: progress --------------------------- */

export function renderProgressText(
  loaded: LoadedPillar[],
  range: DateRange,
  meta: ReportMeta,
  opts: { excludeBusinessSystems?: boolean } = {},
): string {
  const visible = opts.excludeBusinessSystems
    ? loaded.filter((l) => l.meta.key !== 'pillar-8-business-systems')
    : loaded;

  const grid = visible.map((l) => {
    if (l.status === 'error') return `  ${l.meta.n}. ${l.meta.name}: could not be loaded`;
    if (!hasContent(l)) return `  ${l.meta.n}. ${l.meta.name}: not started yet`;
    const d = l.data!;
    switch (d.kind) {
      case 'p1': {
        const s = p1Stats(d.data, range);
        return `  ${l.meta.n}. ${l.meta.name}: ${s.activeGoals} goals, ${s.overdue} overdue`;
      }
      case 'p2': {
        const s = p2Stats(d.data);
        return `  ${l.meta.n}. ${l.meta.name}: ${s.solutionsOnTable} solutions, ${s.solvedArchive} solved`;
      }
      case 'p3': {
        const s = p3Stats(d.data, range);
        return `  ${l.meta.n}. ${l.meta.name}: ${s.coverage.recorded} days recorded, ${pct(s.achieved.pct)} achieved`;
      }
      case 'p4': {
        const s = p4Stats(d.data, range);
        return `  ${l.meta.n}. ${l.meta.name}: ${s.total} items, ${s.completedIncludingFiled} done, ${s.overdue} overdue`;
      }
      case 'business-systems': {
        const s = p8Stats(d.data);
        return `  ${l.meta.n}. ${l.meta.name}: ${s.systems} systems, ${s.untrained} untrained`;
      }
    }
  });

  const detail: string[] = [];
  for (const l of visible) {
    if (l.status !== 'ok' || !l.data) continue;
    if (l.data.kind === 'p1') {
      const s = p1Stats(l.data.data, range);
      detail.push(
        lines(
          '',
          `PILLAR 1, ${l.meta.name.toUpperCase()}`,
          `  Active goals: ${s.activeGoals} (${s.overdue} overdue, ${s.dueSoon} due within 7 days)`,
          s.coverage.recorded >= MIN_DAYS_FOR_RATES
            ? `  Do-or-Die completed: ${s.dodRange.done} of ${s.dodRange.total} (${pct(s.dodRange.pct)})`
            : `  Only ${s.coverage.recorded} days recorded, showing counts, not a rate.`,
          `  ${describeCoverage(s.coverage)}`,
        ),
      );
    }
    if (l.data.kind === 'p3') {
      const s = p3Stats(l.data.data, range);
      detail.push(
        lines(
          '',
          `PILLAR 3, ${l.meta.name.toUpperCase()}`,
          s.coverage.recorded >= MIN_DAYS_FOR_RATES
            ? `  Planned work achieved: ${s.achieved.done} of ${s.achieved.total} (${pct(s.achieved.pct)})`
            : `  Only ${s.coverage.recorded} days recorded, showing counts, not a rate.`,
          `  Perfect days: ${s.perfectDays}`,
          `  ${describeCoverage(s.coverage)}`,
          `  ${describeMoney(s.money, s.moneyEntryDays)}`,
        ),
      );
    }
    if (l.data.kind === 'p4') {
      const s = p4Stats(l.data.data, range);
      detail.push(
        lines(
          '',
          `PILLAR 4, ${l.meta.name.toUpperCase()}`,
          `  On the board: ${s.total} · completed: ${s.completedIncludingFiled} · overdue: ${s.overdue}`,
          s.filedCount ? `  (${s.completed} on the board, ${s.filedCount} completed and filed)` : '',
          `  Completed early: ${s.early} · late: ${s.late} · deadline moved: ${s.slipped}`,
          `  The board changed on ${s.changedDays} days in this period.`,
        ),
      );
    }
  }

  return lines(
    header('Progress Report', meta, `${range.from} to ${range.to}`),
    '',
    'WHERE THINGS STAND',
    ...grid,
    ...detail,
    '',
    RULE,
    'HOW TO READ THIS',
    '  Pillars 1, 3 and 4 keep a daily history, so their figures cover the',
    '  period above. Pillar 5 keeps its own daily effort and result answers.',
    '  The others keep no history and show today only.',
    '  A day is only recorded when the app is opened that day, so "days',
    '  recorded" is not the same as days worked.',
    '  Money is free text, so totals say what could not be read.',
    '  Names appear exactly as entered in the app.',
    '',
    'Sent from the Zaffarology 5 Pillars app.',
  );
}
