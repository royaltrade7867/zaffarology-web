/**
 * Report A — one pillar, current state, in full.
 *
 * Snapshot-only by design: two of the five pillars keep no history at all, so a
 * date range here would be meaningful for some and silently empty for others.
 * Ranged reporting lives in the progress report instead.
 */
import { friendlyISO, relativeISO } from '@/lib/dates';
import type { LoadedPillar } from '@/reports/loaded';
import { todayKey } from '@/lib/ids';
import { deadlineSection } from '@/reports/html/deadline-section';
import { p1Deadlines, p4Deadlines } from '@/reports/stats/deadlines';
import type { ReportMeta } from '@/reports/types';

import { bar, card, field, flowChart, footer, para, pill, section, stats, table, taskList } from './blocks';
import { esc } from './escape';
import { renderShell } from './shell';

const dateLabel = (iso: string): string => {
  if (!iso) return '';
  const friendly = friendlyISO(iso) ?? iso;
  const rel = relativeISO(iso);
  return rel ? `${friendly} (${rel.text})` : friendly;
};

/** Per-pillar body. Each pillar genuinely differs, so each gets its own renderer. */
function renderBody(loaded: LoadedPillar): string {
  const d = loaded.data;
  if (!d) return para('No data for this pillar yet.', 'empty');

  switch (d.kind) {
    /* ------------------------------- Pillar 1 ------------------------------ */
    case 'p1': {
      const p1dl = deadlineSection(
        p1Deadlines(d.data, todayKey()),
        'Deadlines kept',
        'across your goals and delegated tasks',
      );
      const goals = d.data.goals.filter(
        (g) => g.goal.trim() || g.plan.trim() || g.work.text.trim() || g.dod.some((t) => t.text.trim()),
      );
      const body = goals.length
        ? goals
            .map((g, i) => {
              const rel = g.target ? relativeISO(g.target) : null;
              const flag = rel?.cls === 'late' ? pill('Overdue', 'warn') : rel?.cls === 'soon' ? pill('Due soon', 'ok') : '';
              return card(
                `<h3>Exact Goal (Project) ${i + 1} ${flag}</h3>` +
                  field('Goal', g.goal) +
                  field('Plan', g.plan) +
                  field('Deadline', g.target ? dateLabel(g.target) : '') +
                  `<div class="field"><div class="label">Work of the Day</div>${taskList([g.work])}</div>` +
                  `<div class="field"><div class="label">Do or Die (max 5)</div>${taskList(g.dod)}</div>` +
                  `<div class="field"><div class="label">Go the Extra Mile</div>${taskList(g.extra)}</div>` +
                  `<div class="field"><div class="label">Delegated</div>${table(
                    ['Task', 'Delegated to', 'Deadline', 'Chased'],
                    g.deleg
                      .filter((x) => x.text.trim())
                      .map((x) => [x.text, x.who || 'Not set', x.due ? dateLabel(x.due) : 'Not set', x.done ? 'Yes' : 'No']),
                  )}</div>`,
              );
            })
            .join('')
        : para('No goals recorded yet.', 'empty');

      const filedRows = d.data.filed.map((f) => [f.text, f.section, f.date]);
      return (
        p1dl +
        section('Goals & Projects', body) +
        section('Filed Tasks (all time)', table(['Task', 'From', 'Filed'], filedRows))
      );
    }

    /* ------------------------------- Pillar 2 ------------------------------ */
    case 'p2': {
      const sols = d.data.sols.filter((s) => s.text.trim());
      const winner = sols.find((s) => s.done);
      return (
        section(
          'Current Problem',
          card(
            field('Exact problem', d.data.problem) +
              `<div class="field"><div class="label">Possible solutions (${sols.length})</div>${taskList(
                d.data.sols,
              )}</div>` +
              field('Chosen solution', winner?.text ?? ''),
          ),
        ) +
        section(
          'Solved Problems (all time)',
          table(
            ['Problem', 'Solution that worked', 'Solved'],
            d.data.filed.map((f) => [f.problem, f.solution, f.date]),
          ),
        )
      );
    }

    /* ------------------------------- Pillar 3 ------------------------------ */
    case 'p3': {
      const today =
        `<div class="field"><div class="label">Work of the Day</div>${taskList([d.data.work])}</div>` +
        `<div class="field"><div class="label">Do or Die</div>${taskList(d.data.dod)}</div>` +
        `<div class="field"><div class="label">Go the Extra Mile</div>${taskList(d.data.extra)}</div>` +
        field("Today's achievement (PM)", d.data.pm) +
        field('Money made', d.data.money.trim() ? `A$${d.data.money.trim()}` : '');

      const recent = d.data.history.slice(0, 30);
      return (
        section("Today's Plan & Achievement", card(today)) +
        section(
          'Previous Days',
          table(
            ['Date', 'Achieved', 'Money', 'Reflection'],
            recent.map((h) => {
              const planned = [
                ...(h.work.text.trim() ? [h.work] : []),
                ...h.dod.filter((t) => t.text.trim()),
                ...h.extra.filter((t) => t.text.trim()),
              ];
              const done = planned.filter((t) => t.done).length;
              return [
                friendlyISO(h.date) ?? h.date,
                planned.length ? `${done} of ${planned.length}` : 'n/a',
                h.money.trim() ? `A$${h.money.trim()}` : 'Not set',
                h.pm.trim() ? 'Yes' : 'No',
              ];
            }),
          ),
        )
      );
    }

    /* ------------------------------- Pillar 4 ------------------------------ */
    case 'p4': {
      const items = d.data.items.filter((i) => i.name.trim());
      const dl = deadlineSection(
        p4Deadlines(d.data, todayKey()),
        'Deadlines kept',
        'on this board',
      );
      const statusText = (s: string) =>
        s === 'completed' ? 'Completed' : s === 'notdone' ? 'Not completed' : 'Open';
      return (
        dl +
        section(
          'Huddle Board',
          table(
            ['Project / Task', 'Owner', 'Due', 'Status', 'Completed on', 'Note'],
            items.map((i) => [
              i.name,
              i.who || 'Not set',
              i.due ? dateLabel(i.due) : 'Not set',
              statusText(i.status) + (i.newDate ? ` (moved to ${friendlyISO(i.newDate) ?? i.newDate})` : ''),
              i.completedOn ? friendlyISO(i.completedOn) ?? i.completedOn : 'Not set',
              i.note || 'Not set',
            ]),
          ),
        ) +
        section(
          'Completed & Filed (all time)',
          table(
            ['Project / Task', 'Owner', 'Result', 'Filed'],
            d.data.filed.map((f) => [f.name, f.who || 'Not set', f.early || 'Not set', f.date]),
          ),
        )
      );
    }

    /* --------------------- Pillar 5 — business systems --------------------- */
    case 'business-systems': {
      if (!d.data.businesses.length) return para('No businesses recorded yet.', 'empty');
      return d.data.businesses
        .map((b) =>
          section(
            b.name || 'Untitled business',
            b.departments.length
              ? b.departments
                  .map(
                    (dept) =>
                      `<h3>${esc(dept.name || 'Untitled department')}</h3>` +
                      (dept.systems.length
                        ? dept.systems
                            .map((sys) =>
                              card(
                                `<h3>${esc(sys.num)} · ${esc(sys.name || 'Untitled system')}</h3>` +
                                  field('Frequency', sys.freq) +
                                  field('Responsible', sys.responsible) +
                                  field('Accountable', sys.accountable) +
                                  field('Guide / trainer', sys.guide) +
                                  field('Progression', sys.progression) +
                                  field('Jobs', sys.jobs.filter(Boolean).join('\n')) +
                                  field(
                  'Effort & result questions',
                  sys.pairs
                    .filter((q) => q.effort.trim() || q.result.trim())
                    .map((q, i) => `${i + 1}. ${q.effort || 'Not set'}\n   → ${q.result || 'Not set'}`)
                    .join('\n'),
                ) +
                                  field('Results', sys.results.filter(Boolean).join('\n')) +
                                  /* A drawn flow chart, not a numbered list: the
                                     steps run START to DONE in order, and an <ol>
                                     printed that as loose prose. */
                                  `<div class="field"><div class="label">Flow chart</div>${flowChart(sys.steps)}</div>` +
                                  `<div class="field"><div class="label">Training</div>${table(
                                    ['Trainee', 'Trainer', 'Date', 'Satisfied', 'Remarks'],
                                    sys.trainings.map((t) => [
                                      t.trainee || 'Not set',
                                      t.trainer || 'Not set',
                                      t.date || 'Not set',
                                      t.satisfied || 'Not set',
                                      t.remarks || 'Not set',
                                    ]),
                                  )}</div>` +
                                  `<div class="field"><div class="label">Evaluation</div>${table(
                                    ['Trainee', 'Evaluator', 'Evaluated', 'Satisfied', 'Implemented', 'Remarks'],
                                    sys.evals.map((t) => [
                                      t.trainee || 'Not set',
                                      t.evaluator || 'Not set',
                                      t.evalDate || 'Not set',
                                      t.satisfied || 'Not set',
                                      t.implDate || 'Not set',
                                      t.remarks || 'Not set',
                                    ]),
                                  )}</div>` +
                                  `<div class="field"><div class="label">Review</div>${table(
                                    ['Trainee', 'Reviewer', 'Date', 'Satisfied', 'Remarks'],
                                    sys.reviews.map((t) => [
                                      t.trainee || 'Not set',
                                      t.reviewer || 'Not set',
                                      t.date || 'Not set',
                                      t.satisfied || 'Not set',
                                      t.remarks || 'Not set',
                                    ]),
                                  )}</div>`,
                              ),
                            )
                            .join('')
                        : para('No systems in this department yet.', 'empty')),
                  )
                  .join('')
              : para('No departments yet.', 'empty'),
          ),
        )
        .join('');
    }
  }
}

export function renderPillarReport(loaded: LoadedPillar, meta: ReportMeta): string {
  const p = loaded.meta;
  const metaLines = [
    meta.userName,
    ...(meta.companyName ? [meta.companyName] : []),
    `Generated ${meta.generatedOn}`,
    ...(loaded.fromCache ? ['Offline copy, may not include changes made on another device'] : []),
  ];

  const body =
    loaded.status === 'error'
      ? para('This pillar could not be loaded. Please try again when you are online.', 'empty')
      : renderBody(loaded);

  return renderShell({
    title: `Zaffarology, Pillar ${p.n}`,
    heading: `Pillar ${p.n}`,
    subheading: p.name,
    note: p.sub,
    // Report HTML is standalone: a var() would resolve against nothing.
    accent: p.accentHex,
    metaLines,
    body,
    // Names are included exactly as entered — this is stated so a recipient knows.
  }).replace(
    '</body>',
    `${footer([
      'Generated by the Zaffarology 5 Pillars app.',
      'Names appear exactly as entered in the app.',
    ])}</body>`,
  );
}

export { renderBody as renderPillarBody };
