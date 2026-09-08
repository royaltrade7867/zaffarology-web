/**
 * The HTML document wrapper: theme, print rules and the Zaffarology header.
 *
 * Colours are interpolated from `constants/theme` so a printed report can never
 * drift from the app's palette. Per-pillar accent comes through a CSS variable, so
 * one shell serves all eight.
 */
import { Colors } from '@/reports/palette';

import { esc } from './escape';

const C = Colors.light;

export interface ShellOptions {
  /** Browser/document title. */
  title: string;
  /** Big heading, e.g. "Pillar 3". */
  heading: string;
  /** Line under the heading, e.g. "AM PLANNING & PM ACHIEVEMENT". */
  subheading?: string;
  /** Optional third line, e.g. the pillar's `sub`. */
  note?: string;
  /** Hex accent for this document. */
  accent: string;
  /** Right-hand meta block lines (name, company, generated-on). */
  metaLines: string[];
  body: string;
}

export function renderShell(o: ShellOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* The app's fonts are native assets the print engine cannot see by name, so
     they come from Google Fonts with a strong fallback that still looks right
     if the network is unavailable when the PDF is rendered. */
  :root {
    --accent: ${o.accent};
    --paper: ${C.paper};
    --ink: ${C.ink};
    --heading: ${C.heading};
    --line: ${C.line};
    --muted: ${C.muted};
    --card: ${C.card};
  }
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font-family: 'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11.5pt; line-height: 1.5;
  }
  h1, h2, h3, .display {
    font-family: 'Archivo Black', 'Helvetica Neue', Impact, sans-serif;
    font-weight: 400; letter-spacing: -0.01em; margin: 0;
  }
  a { color: var(--accent); word-break: break-word; }

  .rule { height: 3px; background: var(--accent); border-radius: 2px; margin-bottom: 14px; }
  .brand { font-size: 13pt; letter-spacing: .04em; margin-bottom: 18px; }
  .brand .z { color: ${C.gold}; }
  .brand .o { color: var(--heading); }

  header { margin-bottom: 22px; }
  h1 { font-size: 26pt; color: var(--heading); }
  .subheading {
    font-family: 'Archivo Black', 'Helvetica Neue', Impact, sans-serif;
    font-size: 10.5pt; letter-spacing: .12em; text-transform: uppercase;
    color: var(--accent); margin-top: 6px;
  }
  .note { color: var(--muted); font-size: 10.5pt; margin-top: 4px; }
  .meta { color: var(--muted); font-size: 10pt; margin-top: 10px; }
  .meta span { display: block; }

  section { margin-bottom: 22px; }
  h2 {
    font-size: 13pt; color: var(--heading);
    border-bottom: 2px solid var(--accent); padding-bottom: 5px; margin-bottom: 12px;
  }
  h3 { font-size: 11.5pt; color: var(--heading); margin-bottom: 6px; }

  /* Keep a goal / system / card whole rather than split across a page. */
  .card, .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  .card {
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid var(--accent); border-radius: 8px;
    padding: 12px 14px; margin-bottom: 12px;
  }
  .field { margin-bottom: 8px; }
  .label {
    font-size: 8.5pt; letter-spacing: .09em; text-transform: uppercase;
    color: var(--muted); font-weight: 600; margin-bottom: 2px;
  }
  .value { white-space: pre-wrap; }
  .empty { color: var(--muted); font-style: italic; }

  ul.tasks { list-style: none; padding: 0; margin: 6px 0 0; }
  ul.tasks li { padding: 3px 0 3px 20px; position: relative; }
  ul.tasks li::before {
    content: '☐'; position: absolute; left: 0; color: var(--muted);
  }
  ul.tasks li.done::before { content: '☑'; color: var(--accent); }
  ul.tasks li.done { color: var(--muted); text-decoration: line-through; }

  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th {
    font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase;
    color: var(--muted); border-bottom: 2px solid var(--accent);
  }

  .stats { display: flex; flex-wrap: wrap; gap: 10px; }
  .stat {
    border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px;
    min-width: 120px; background: var(--card);
  }
  .stat .n { font-family: 'Archivo Black', sans-serif; font-size: 17pt; color: var(--accent); }
  .stat .k { font-size: 8.5pt; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }

  .bar { height: 7px; background: ${C.surfaceDeep}; border-radius: 4px; overflow: hidden; margin-top: 5px; }
  .bar > i { display: block; height: 100%; background: var(--accent); }

  .pill {
    display: inline-block; padding: 1px 7px; border-radius: 999px;
    font-size: 8.5pt; font-weight: 600; border: 1px solid var(--line); color: var(--muted);
  }
  .pill.warn { color: ${C.danger}; border-color: ${C.danger}; }
  .pill.ok { color: ${C.gold}; border-color: ${C.gold}; }

  footer {
    margin-top: 28px; padding-top: 10px; border-top: 1px solid var(--line);
    color: var(--muted); font-size: 9pt;
  }
  footer p { margin: 3px 0; }
</style>
</head>
<body>
  <div class="rule"></div>
  <div class="brand display"><span class="z">ZAFFAR</span><span class="o">OLOGY</span></div>
  <header>
    <h1>${esc(o.heading)}</h1>
    ${o.subheading ? `<div class="subheading">${esc(o.subheading)}</div>` : ''}
    ${o.note ? `<div class="note">${esc(o.note)}</div>` : ''}
    <div class="meta">${o.metaLines.map((l) => `<span>${esc(l)}</span>`).join('')}</div>
  </header>
  ${o.body}
</body>
</html>`;
}
