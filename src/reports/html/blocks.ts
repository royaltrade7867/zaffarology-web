/**
 * Small HTML builders shared by both report types.
 *
 * Every one of these escapes its inputs. Callers pass raw user data; nothing here
 * returns unescaped user content.
 */
import { esc, escMultiline } from './escape';

export const section = (title: string, body: string): string =>
  `<section><h2>${esc(title)}</h2>${body}</section>`;

/** A labelled value; renders an explicit placeholder when blank rather than a gap. */
export const field = (label: string, value: unknown): string => {
  const v = String(value ?? '').trim();
  return `<div class="field"><div class="label">${esc(label)}</div>${
    v ? `<div class="value">${escMultiline(v)}</div>` : '<div class="value empty">Not filled in</div>'
  }</div>`;
};

export const card = (inner: string): string => `<div class="card">${inner}</div>`;

export const taskList = (tasks: { text: string; done: boolean }[]): string => {
  const filled = tasks.filter((t) => t.text.trim());
  if (!filled.length) return '<p class="empty">Nothing recorded.</p>';
  return `<ul class="tasks">${filled
    .map((t) => `<li class="${t.done ? 'done' : ''}">${esc(t.text)}</li>`)
    .join('')}</ul>`;
};

export const stat = (n: string | number, k: string): string =>
  `<div class="stat"><div class="n">${esc(n)}</div><div class="k">${esc(k)}</div></div>`;

export const stats = (items: [string | number, string][]): string =>
  `<div class="stats">${items.map(([n, k]) => stat(n, k)).join('')}</div>`;

/** Progress bar with its own caption; `pct` is 0-1, or null when not applicable. */
export const bar = (pct: number | null, caption: string): string => {
  const w = pct === null ? 0 : Math.round(Math.max(0, Math.min(1, pct)) * 100);
  return `<div class="field"><div class="label">${esc(caption)}</div><div class="bar"><i style="width:${w}%"></i></div></div>`;
};

export const table = (headers: string[], rows: string[][]): string => {
  if (!rows.length) return '<p class="empty">Nothing recorded.</p>';
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${escMultiline(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
};

export const pill = (text: string, kind?: 'warn' | 'ok'): string =>
  `<span class="pill${kind ? ` ${kind}` : ''}">${esc(text)}</span>`;

/**
 * A system's steps as a real flow chart: START, a box per step, DONE, joined by
 * arrows — the same shape the app draws on screen.
 *
 * It was an `<ol>`, which printed as a plain numbered list and lost the one
 * thing a flow chart is for: showing that these steps run in order, start to
 * finish. Each box is `avoid-break` so a step is never split across a page.
 */
export const flowChart = (steps: string[]): string => {
  const filled = steps.filter((s) => s.trim());
  if (!filled.length) return '<p class="empty">No steps recorded.</p>';
  const arrow = '<div class="flow-arrow" aria-hidden="true">&#9660;</div>';
  const boxes = filled
    .map(
      (s, i) =>
        `<div class="flow-step avoid-break"><div class="flow-n">Step ${i + 1}</div>` +
        `<div class="flow-t">${escMultiline(s)}</div></div>`,
    )
    .join(arrow);
  return (
    '<div class="flow">' +
    '<div class="flow-cap flow-start">START</div>' +
    arrow +
    boxes +
    arrow +
    '<div class="flow-cap flow-done">DONE</div>' +
    '</div>'
  );
};

export const para = (text: string, cls = ''): string =>
  `<p${cls ? ` class="${esc(cls)}"` : ''}>${escMultiline(text)}</p>`;

export const footer = (lines: string[]): string =>
  `<footer>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</footer>`;
