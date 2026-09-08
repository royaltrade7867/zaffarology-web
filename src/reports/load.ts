/**
 * Cross-pillar loading for reports.
 *
 * `usePillarState` is a React hook and loads exactly one pillar, so reports
 * cannot use it. This mirrors the hook's load semantics (`{...raw}` then heal,
 * with the local cache as an offline fallback) without needing a mounted
 * component.
 *
 * Ported from `zaffarology-mobileapp/src/reports/load.ts`. Only the transport
 * differs: this app's fetch wrapper and `localStorage`, against mobile's axios
 * and AsyncStorage. The cache key must match `use-pillar-state.ts` exactly or
 * the offline fallback silently finds nothing.
 */
import { ApiError, api } from "@/lib/api";
import { PILLARS, type PillarMeta } from "@/lib/pillars";
import { reportError } from "@/lib/error-reporting";
import { healBlob } from "@/pillars/schemas";

export type { LoadStatus, LoadedPillar } from "./loaded";
export { hasContent } from "./loaded";

import type { LoadedPillar } from "./loaded";

/** Raised when the account has not verified its email — the API returns 403. */
export class UnverifiedError extends Error {
  constructor() {
    super("Verify your email address before creating a report.");
    this.name = "UnverifiedError";
  }
}

const isUnverified = (err: unknown): boolean =>
  err instanceof ApiError && err.status === 403;

/** Same shape `use-pillar-state.ts` writes — see the note above. */
const cacheKey = (userId: string, key: string) => `zaff:v3:${userId}:${key}`;

function readCache(userId: string, key: string): unknown {
  try {
    const raw = window.localStorage.getItem(cacheKey(userId, key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    // A private window, cleared site data, or storage disabled entirely.
    return null;
  }
}

/** Load and heal one pillar. Never throws except for UnverifiedError. */
async function loadOne(userId: string, meta: PillarMeta): Promise<LoadedPillar> {
  try {
    const res = await api.get<{ data: unknown }>(`/v3/pillars/${meta.key}`);
    const raw = res?.data ?? null;
    if (raw == null) return { meta, status: "empty" };
    const data = healBlob(meta.key, raw);
    return data ? { meta, status: "ok", data } : { meta, status: "empty" };
  } catch (err) {
    if (isUnverified(err)) throw new UnverifiedError();
    // Offline or server error: fall back to the cache the app already writes, so
    // a user on a plane still gets their own data rather than an empty report.
    try {
      const cached = readCache(userId, meta.key);
      if (cached != null) {
        const data = healBlob(meta.key, cached);
        if (data) return { meta, status: "ok", data, fromCache: true };
        // Cached but unreadable — say so rather than claiming the pillar is
        // empty, which would read as "you never started this" in the report.
        reportError(new Error("Cached blob could not be healed"), {
          area: "report-load",
          pillarKey: meta.key,
        });
        return { meta, status: "error", error: "Could not be loaded" };
      }
      // Nothing cached and the server is unreachable: we genuinely cannot tell
      // whether this pillar is empty or just unavailable, so report the failure.
      reportError(err, { area: "report-load", pillarKey: meta.key });
      return { meta, status: "error", error: "Could not be loaded" };
    } catch (cacheErr) {
      reportError(cacheErr, { area: "report-load", pillarKey: meta.key });
      return { meta, status: "error", error: "Could not be loaded" };
    }
  }
}

/**
 * Load every pillar. Uses `allSettled` semantics deliberately: one failing
 * pillar must never lose the others.
 *
 * Throws `UnverifiedError` only — that is an account-level problem the user must
 * fix, so it is worth stopping for rather than producing a report of nothing.
 */
export async function loadAllPillars(userId: string): Promise<LoadedPillar[]> {
  const results = await Promise.allSettled(PILLARS.map((meta) => loadOne(userId, meta)));

  if (results.some((r) => r.status === "rejected" && r.reason instanceof UnverifiedError)) {
    throw new UnverifiedError();
  }

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    reportError(r.reason, { area: "report-load", pillarKey: PILLARS[i].key });
    return { meta: PILLARS[i], status: "error" as const, error: "Could not be loaded" };
  });
}

/** Load a single pillar by display number. */
export async function loadPillar(userId: string, n: number): Promise<LoadedPillar | null> {
  const meta = PILLARS.find((p) => p.n === n);
  if (!meta) return null;
  return loadOne(userId, meta);
}
