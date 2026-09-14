/**
 * Report → a real PDF, downloaded.
 *
 * Mobile prints its report HTML through `expo-print`, which has no web
 * equivalent. The two alternatives to this were rejected deliberately:
 * rasterising the HTML (html2pdf) makes the text an image — unselectable,
 * unsearchable and soft on a high-DPI screen — and rendering server-side needs
 * new system libraries on Render.
 *
 * So the PDF is built from the SAME structured data the HTML and text renderers
 * use (`LoadedPillar` + the stats functions), never from either of their string
 * outputs. Parsing HTML back into a document model would be a third
 * representation to keep in step with the other two.
 *
 * pdfmake is ~1.5 MB, so it is imported dynamically: nobody pays for it until
 * they actually ask for a PDF.
 */
import { friendlyISO } from "@/lib/dates";
import { todayKey } from "@/lib/ids";
import { PILLARS } from "@/lib/pillars";
import { ReportColors as C } from "@/reports/palette";
import { hasContent, type LoadedPillar } from "@/reports/loaded";
import { p1Deadlines, p4Deadlines } from "@/reports/stats/deadlines";
import {
  p1Stats,
  p2Stats,
  p3Stats,
  p4Stats,
  p8Stats,
  type DateRange,
  type Rate,
} from "@/reports/stats";
import type { DeadlineStats } from "@/reports/stats/deadlines";
import type { ReportMeta } from "@/reports/types";

/* pdfmake's document model, narrowed to what this file builds. Its own types
   are `any`-heavy, and a loose shape here would let a typo through silently. */
type Cell = string | { text: string; style?: string; colSpan?: number; color?: string };
type Node =
  | { text: string; style?: string; margin?: [number, number, number, number] }
  | { table: { widths: (string | number)[]; headerRows?: number; body: Cell[][] }; layout?: string; margin?: [number, number, number, number] }
  | { canvas: unknown[]; margin?: [number, number, number, number] }
  | { ul: string[]; margin?: [number, number, number, number] }
  | { text: string; pageBreak?: "before" };

const GAP: [number, number, number, number] = [0, 0, 0, 8];

const rule = (): Node => ({
  canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.75, lineColor: C.line }],
  margin: [0, 4, 0, 10],
});

const h2 = (text: string): Node => ({ text, style: "h2", margin: [0, 12, 0, 6] });

/** A two-column facts table — the shape most of these reports reduce to. */
const facts = (rows: [string, string][]): Node => ({
  table: {
    widths: ["*", "auto"],
    body: rows.map(([k, v]) => [
      { text: k, style: "key" },
      { text: v, style: "val" },
    ]),
  },
  layout: "lightHorizontalLines",
  margin: GAP,
});

/** "7 of 10 (70%)", or "—" when there is nothing to rate. A bare 0% would read
 *  as failure where the honest answer is "nothing to measure yet". */
const rateText = (r: Rate): string =>
  r.pct === null ? "—" : `${r.done} of ${r.total} (${Math.round(r.pct * 100)}%)`;

/** Deadlines, only when something is actually measurable. */
function deadlineNodes(d: DeadlineStats): Node[] {
  if (!d.measured && !d.pending && !d.overdue) return [];
  const out: Node[] = [
    h2("Deadlines"),
    facts([
      ["On time", String(d.onTime)],
      ["Late", String(d.late)],
      ["Overdue now", String(d.overdue)],
      ["Still ahead", String(d.pending)],
      ["No deadline set", String(d.noDeadline)],
      ["Hit rate", d.hitRate === null ? "—" : `${Math.round(d.hitRate * 100)}%`],
    ]),
  ];
  if (d.misses.length) {
    out.push({
      table: {
        widths: ["*", "auto", "auto"],
        headerRows: 1,
        body: [
          [
            { text: "What slipped", style: "th" },
            { text: "Was due", style: "th" },
            { text: "By", style: "th" },
          ],
          ...d.misses.slice(0, 25).map((m) => [
            { text: m.text || "(untitled)", style: "val" },
            { text: friendlyISO(m.due) ?? m.due, style: "val" },
            { text: `${m.by} day${m.by === 1 ? "" : "s"}`, style: "val", color: C.danger },
          ]),
        ] as Cell[][],
      },
      layout: "lightHorizontalLines",
      margin: GAP,
    });
  }
  return out;
}

/** The per-pillar body. Mirrors what `renderPillarText` reports, in the same
 *  order, so the PDF and the emailed text never disagree about the numbers. */
function pillarBody(l: LoadedPillar, range: DateRange): Node[] {
  if (l.status === "error") return [{ text: "This pillar could not be loaded.", style: "muted" }];
  if (!hasContent(l)) return [{ text: "Not started yet.", style: "muted" }];

  const today = todayKey();
  const d = l.data!;
  switch (d.kind) {
    case "p1": {
      const s = p1Stats(d.data, range);
      return [
        facts([
          ["Goals", String(s.goals.length)],
          ["Active goals", String(s.activeGoals)],
          ["With a target date", String(s.withTarget)],
          ["Overdue", String(s.overdue)],
          ["Due soon", String(s.dueSoon)],
          ["Do-or-die in range", rateText(s.dodRange)],
        ]),
        ...deadlineNodes(p1Deadlines(d.data, today)),
      ];
    }
    case "p2": {
      const s = p2Stats(d.data);
      return [
        facts([
          ["An open problem", s.hasOpenProblem ? "Yes" : "No"],
          ["Solutions on the table", String(s.solutionsOnTable)],
          ["Chosen", String(s.chosen)],
          ["Solved and archived", String(s.solvedArchive)],
        ]),
      ];
    }
    case "p3": {
      const s = p3Stats(d.data, range);
      return [
        facts([
          ["Achievement", rateText(s.achieved)],
          ["Perfect days", String(s.perfectDays)],
          ["Days reflected on", String(s.reflectionDays)],
          ["Days money was logged", String(s.moneyEntryDays)],
        ]),
      ];
    }
    case "p4": {
      const s = p4Stats(d.data, range);
      return [
        facts([
          ["Items", String(s.total)],
          ["Completed", String(s.completed)],
          ["Not done", String(s.notDone)],
          ["No status yet", String(s.noStatus)],
          ["Overdue", String(s.overdue)],
          ["Finished early", String(s.early)],
          ["Finished late", String(s.late)],
          ["Filed", String(s.filedCount)],
        ]),
        ...deadlineNodes(p4Deadlines(d.data, today)),
      ];
    }
    case "business-systems": {
      const s = p8Stats(d.data);
      return [
        facts([
          ["Businesses", String(s.businesses)],
          ["Departments", String(s.departments)],
          ["Systems", String(s.systems)],
          ["Complete", String(s.complete)],
          ["Untrained", String(s.untrained)],
          ["Trainings", String(s.trainings)],
        ]),
      ];
    }
    default:
      return [{ text: "Not started yet.", style: "muted" }];
  }
}

const styles = {
  h1: { fontSize: 20, bold: true, color: C.heading },
  h2: { fontSize: 12, bold: true, color: C.heading },
  th: { fontSize: 9, bold: true, color: C.muted },
  key: { fontSize: 10, color: C.muted },
  val: { fontSize: 10, color: C.ink },
  muted: { fontSize: 10, color: C.muted, italics: true },
  sub: { fontSize: 10, color: C.muted },
  foot: { fontSize: 8, color: C.muted },
};

/** A4 with the same margins the printed HTML uses (`@page` in html/shell.ts). */
const PAGE = { pageSize: "A4" as const, pageMargins: [40, 40, 40, 48] as [number, number, number, number] };

function docFor(title: string, meta: ReportMeta, body: Node[]) {
  return {
    ...PAGE,
    info: { title, author: "Zaffarology" },
    content: [
      { text: title, style: "h1" } as Node,
      { text: meta.companyName ? `${meta.userName} · ${meta.companyName}` : meta.userName, style: "sub" } as Node,
      { text: meta.generatedOn, style: "sub", margin: [0, 2, 0, 0] } as Node,
      rule(),
      ...body,
    ],
    styles,
    defaultStyle: { fontSize: 10, color: C.ink },
    footer: (page: number, total: number) => ({
      text: `Zaffarology · page ${page} of ${total}`,
      style: "foot",
      alignment: "center",
      margin: [0, 12, 0, 0],
    }),
  };
}

/**
 * `download` is `async` in 0.3 — it awaits `getBlob()` internally. Calling it
 * without awaiting makes any failure an UNCAUGHT rejection that lands after the
 * caller has already resolved, which is how a broken font map still produced
 * "Your PDF has been downloaded." Every call site awaits it.
 */
type PdfDoc = { download: (name: string) => Promise<void> };
type VirtualFs = { existsSync: (name: string) => boolean };
type PdfMake = {
  createPdf: (def: unknown) => PdfDoc;
  addVirtualFileSystem?: (vfs: Record<string, string>) => void;
  virtualfs?: VirtualFs;
};

/**
 * Loaded lazily — pdfmake and its fonts are ~1 MB, and nobody should pay for
 * that until they ask for a PDF.
 *
 * The fonts MUST be wired across by hand. `vfs_fonts` ends with:
 *
 *     if (typeof _global.pdfMake !== 'undefined' && ...addVirtualFileSystem...)
 *       _global.pdfMake.addVirtualFileSystem(vfs)
 *     module.exports = vfs
 *
 * so it self-registers only when a *global* `pdfMake` already exists — true for
 * a `<script>` tag, false for a bundled ES import, where the module has no
 * global to find. Importing it for its side effect alone therefore registers
 * nothing in the browser and `createPdf` throws
 * "File 'Roboto-Medium.ttf' not found in virtual file system".
 *
 * That is easy to get wrong under Node, where `pdfmake.js` assigns
 * `global.pdfMake` as it loads and so makes the side effect appear to work.
 * The check below asserts the end state instead of trusting either path.
 */
let pdfPromise: Promise<PdfMake> | null = null;

async function pdfMake(): Promise<PdfMake> {
  pdfPromise ??= (async () => {
    const [mod, fontMod] = await Promise.all([
      import("pdfmake/build/pdfmake"),
      import("pdfmake/build/vfs_fonts"),
    ]);
    const raw = mod as unknown as { default?: PdfMake } & PdfMake;
    const pm: PdfMake = typeof raw.createPdf === "function" ? raw : (raw.default as PdfMake);
    if (typeof pm?.createPdf !== "function") {
      throw new Error("pdfmake: no createPdf export, the module shape changed");
    }

    const rawFonts = fontMod as unknown as { default?: Record<string, string> } & Record<
      string,
      unknown
    >;
    const fonts = (rawFonts.default ?? rawFonts) as Record<string, string>;
    pm.addVirtualFileSystem?.(fonts);

    // Fail loudly here rather than inside createPdf, where the message is far
    // from the cause and the caller has already promised the user a download.
    if (pm.virtualfs && !pm.virtualfs.existsSync("Roboto-Medium.ttf")) {
      throw new Error("pdfmake: bundled fonts did not register");
    }
    return pm;
  })();
  return pdfPromise;
}

/** Filename that sorts by date and cannot collide across reports. */
export function reportFilename(label: string, ext = "pdf"): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `zaffarology-${slug}-${stamp}.${ext}`;
}

/** One pillar, downloaded as a PDF. */
export async function downloadPillarPdf(
  loaded: LoadedPillar,
  meta: ReportMeta,
  range: DateRange,
): Promise<void> {
  const title = `Pillar ${loaded.meta.n}, ${loaded.meta.name}`;
  const pm = await pdfMake();
  await pm.createPdf(docFor(title, meta, pillarBody(loaded, range))).download(
    reportFilename(`pillar-${loaded.meta.n}`),
  );
}

/** Every pillar in one PDF, each starting on its own page. */
export async function downloadProgressPdf(
  loaded: LoadedPillar[],
  meta: ReportMeta,
  range: DateRange,
  opts: { excludeBusinessSystems?: boolean } = {},
): Promise<void> {
  const visible = opts.excludeBusinessSystems
    ? loaded.filter((l) => l.meta.key !== "pillar-8-business-systems")
    : loaded;

  const body: Node[] = [];
  visible.forEach((l, i) => {
    if (i > 0) body.push({ text: "", pageBreak: "before" });
    body.push({ text: `${l.meta.n}. ${l.meta.name}`, style: "h2", margin: [0, 0, 0, 6] });
    body.push(...pillarBody(l, range));
  });
  if (!body.length) body.push({ text: "Nothing to report yet.", style: "muted" });

  const pm = await pdfMake();
  await pm.createPdf(docFor("Progress report", meta, body)).download(reportFilename("progress"));
}

/** Exposed for the fixture: the pillar list a progress report covers. */
export const reportablePillars = () => PILLARS.map((p) => p.key);
