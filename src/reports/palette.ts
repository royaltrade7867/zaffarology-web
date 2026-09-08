/**
 * The colours a generated report is printed in.
 *
 * A report is always laid out on paper — emailed, saved as a PDF, or printed —
 * so it uses the LIGHT palette regardless of what the app's theme is set to.
 * That is why these are literals rather than the CSS custom properties the
 * screens use: a `var(--ink)` inside report HTML would resolve against whatever
 * document it happened to be rendered in, or against nothing at all inside an
 * email client.
 *
 * The values mirror `Colors.light` in `zaffarology-mobileapp/src/constants/theme.ts`
 * and the `:root` block in `src/app/globals.css`. All three must agree, and
 * `check-reports-web.ts` asserts that they do — a report in different colours
 * from the app it came out of looks like a different product.
 */
export const ReportColors = {
  paper: "#F7F6F2",
  ink: "#191A1E",
  line: "#D3D9E2",
  muted: "#4E6A8C",
  card: "#FFFFFF",
  heading: "#1B3A5C",
  gold: "#8F6200",
  danger: "#C8102E",
  surfaceDeep: "#EFEEE9",
} as const;

/** Shaped like mobile's `Colors` so the ported report files need no edits. */
export const Colors = { light: ReportColors } as const;
