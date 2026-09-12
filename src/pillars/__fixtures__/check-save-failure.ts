/**
 * A failed save must not be silently discarded.
 *
 * THE BUG (QA audit, 12 Sep 2026, C1): every save path ended in
 * `.catch(() => {})`. A failed write showed nothing, never retried, and the
 * screen kept displaying text the server had never received. Worse, the draft
 * was written to the NORMAL cache key before the request — which the load path
 * overwrites from the server, so the edit was destroyed on the next reload
 * either way. Routine against a backend that sleeps and answers 503.
 */
import { readFileSync } from "node:fs";

let pass = 0;
const fails: string[] = [];
const ck = (n: string, ok: boolean, x = "") => { ok ? pass++ : fails.push(n + (x ? " — " + x : "")); };

const src = readFileSync("src/lib/use-pillar-state.ts", "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""); // ignore the comments

/* ---- the failure is no longer swallowed ---- */
ck("no save path swallows its error", !/saveBlob\([^)]*\)\.catch\(\(\) => \{\}\)/.test(code));
ck("a failed save sets an error status", /\.catch\(\(\) => \{[\s\S]{0,200}setStatus\("error"\)/.test(code));
ck("a status is exposed to the UI", /status,\s*retrySave/.test(code) && /export type SaveStatus/.test(src));

/* ---- the edit survives ---- */
ck("an unsaved draft has its own key", /pendingKey/.test(code));
ck("it is written BEFORE the request", /writeJson\(pendingKey\(userId, key\), next\)/.test(code));
ck("it is cleared only on success", /\.then\(\(\) => \{[\s\S]{0,240}drop\(pendingKey/.test(code));
ck("it outranks the server on load", /const unsaved = readJson<T>\(pendingKey/.test(code));

/* ---- and it retries ---- */
ck("a failure schedules a retry", /retryTimer\.current = setTimeout\(flush/.test(code));
ck("with backoff", /RETRY_BACKOFF_MS/.test(code));
ck("coming back online retries", /addEventListener\("online"/.test(code));
ck("a manual retry is possible", /const retrySave = useCallback/.test(code));

/* ---- the UI actually shows it ---- */
const bar = readFileSync("src/components/save-status.tsx", "utf8");
ck("the banner is an alert", /role="alert"/.test(bar));
ck("it says the work is safe locally", /reload/i.test(bar));
ck("it offers a retry", /onRetry/.test(bar));
// Silent while idle: a permanent "Saved" badge trains people to ignore the
// place the real warning appears.
ck("it is silent unless there is an error", /if \(status !== "error"\) return null/.test(bar));

const scaffold = readFileSync("src/components/pillar-scaffold.tsx", "utf8");
ck("the scaffold renders it", /<SaveStatusBar/.test(scaffold));

/* ---- every pillar is wired ---- */
for (const f of ["pillar-1", "pillar-2", "pillar-3", "pillar-4", "pillar-5-business-systems"]) {
  const p = readFileSync(`src/pillars/${f}.tsx`, "utf8");
  ck(`${f} surfaces its save status`,
     /usePillarState<[^>]+>\(/.test(p) && /status, retrySave/.test(p) && /saveStatus=\{status\}/.test(p));
}

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All save-failure checks passed (" + pass + ")");
