"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Per-pillar state persistence — the SAME `/v3/pillars/{key}` JSON blob the
 * mobile app reads/writes, so a user's data is shared across web and mobile.
 * Loads from the backend (localStorage cache fallback) and saves debounced.
 * `update(draft => {...})` deep-clones so nested mutations always take.
 *
 * SAVE FAILURES ARE NOT SWALLOWED. Every save path used to end in
 * `.catch(() => {})`: a failed write showed nothing, never retried, and the
 * screen kept displaying text the server had never received. The user found out
 * on reload, when the server's older value replaced it. That is routine against
 * a backend that sleeps and answers 503 while it wakes.
 *
 * Three things make that safe now:
 *   1. `status` reports "saving" / "error", so a screen can say so.
 *   2. A failed save retries with backoff, and a success clears the error.
 *   3. The unsaved draft is kept in `zaff:v3:pending:*` and takes precedence
 *      over the server on the next load, so a reload mid-failure RESTORES the
 *      edit instead of destroying it.
 *
 * The old code wrote the draft to the normal cache BEFORE the request, which
 * looked like a safety net but was not one: the load path overwrites that cache
 * from the server, so the edit was gone either way. The pending key is separate
 * precisely so the load path can find it and win.
 */
/**
 * A copy of what the server last returned.
 *
 * READ ONLY WHEN THE SERVER CANNOT BE REACHED. It used to also fill in when the
 * server answered with nothing, and that was wrong in two ways that both
 * happened in practice:
 *
 *   - a pillar deleted on the server reappeared from localStorage, and the next
 *     keystroke uploaded it again, undoing the deletion;
 *   - with one account on two machines, whichever had the staler cache would
 *     show it and then overwrite the other's newer work.
 *
 * A reachable server that holds nothing MEANS nothing. This is a whole-blob
 * store with no merge, so a second opinion cannot be reconciled — it can only
 * compete, and the server has to win.
 *
 * It is still WRITTEN, because `reports/load.ts` reads it to build a report
 * offline, and `check-reports-web.ts` asserts the two keys match.
 */
const cacheKey = (userId: string, key: string) => `zaff:v3:${userId}:${key}`;
/** An edit the server has NOT accepted. Survives reload; cleared on success. */
const pendingKey = (userId: string, key: string) => `zaff:v3:pending:${userId}:${key}`;

/** Debounce before a save fires. */
const SAVE_DEBOUNCE_MS = 400;
/** Backoff for retries, in ms. The last value repeats until it succeeds. */
const RETRY_BACKOFF_MS = [1_000, 3_000, 8_000, 20_000];

export type SaveStatus = "idle" | "saving" | "error";

async function loadBlob<T>(key: string): Promise<T | null> {
  const { data } = await api.get<{ data: T | null }>(`/v3/pillars/${key}`);
  return data ?? null;
}
/**
 * Trim every string in the blob, in place on a copy, before it is written.
 *
 * A field holding only spaces is "non-empty" to `value.trim() ? … : …` checks
 * all over the UI, so it loses its placeholder and renders as a blank box that
 * looks broken. Leading/trailing spaces also survived into reports and emails.
 * The app ALREADY treats whitespace-only as empty for counting and for enabling
 * the Add buttons, so this just applies the same rule to what is stored.
 *
 * Keys are left alone — only values are trimmed.
 */
const trimDeep = (v: unknown): unknown => {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(trimDeep);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, trimDeep(x)]));
  }
  return v;
};

async function saveBlob(key: string, data: unknown): Promise<void> {
  await api.put(`/v3/pillars/${key}`, { data: trimDeep(data) });
}

const readJson = <T,>(k: string): T | null => {
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const writeJson = (k: string, v: unknown) => {
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* quota or private mode — the in-memory state is still correct */
  }
};
const drop = (k: string) => {
  try {
    window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

export function usePillarState<T extends object>(
  key: string,
  makeInitial: () => T,
  normalize?: (s: T) => T,
) {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<T>(makeInitial);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  const pendingRef = useRef<T | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const keyRef = useRef(key);
  keyRef.current = key;

  const norm = (s: T): T => (normalize ? normalize(s) : s);

  useEffect(() => {
    let active = true;
    if (!userId) return undefined;
    setLoaded(false);
    setStatus("idle");

    const hydrate = (v: T) => setState(norm({ ...makeInitial(), ...v }));

    loadBlob<T>(key)
      .then((remote) => {
        if (!active) return;
        // An edit the server never accepted outranks what the server holds —
        // it is strictly newer. Without this, reloading during an outage
        // silently discarded the user's work.
        const unsaved = readJson<T>(pendingKey(userId, key));
        if (unsaved) {
          hydrate(unsaved);
          pendingRef.current = unsaved;
          setStatus("error");
        } else if (remote) {
          hydrate(remote);
          writeJson(cacheKey(userId, key), remote);
        } else {
          /* THE SERVER ANSWERED, AND IT HOLDS NOTHING.
             So this pillar IS empty. It used to fall back to the cache here,
             which resurrected deleted data and let a stale machine overwrite a
             fresh one — see the note on `cacheKey`. The stale copy is dropped
             rather than left to be read by a later offline load. */
          drop(cacheKey(userId, key));
          hydrate(makeInitial());
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        /* The server is UNREACHABLE. Now the cache is the best answer there is,
           and showing someone their own work beats showing them an empty
           workbook. Unsent edits still win over it — they are newer. */
        const unsaved = readJson<T>(pendingKey(userId, key));
        const cached = unsaved ?? readJson<T>(cacheKey(userId, key));
        if (cached) hydrate(cached);
        if (unsaved) {
          pendingRef.current = unsaved;
          setStatus("error");
        }
        setLoaded(true);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key]);

  /** Send what is pending; on failure keep it and schedule a retry. */
  const flush = useCallback(() => {
    const uid = userIdRef.current;
    const k = keyRef.current;
    const next = pendingRef.current;
    if (!uid || !next) return;

    setStatus("saving");
    saveBlob(k, next)
      .then(() => {
        // Only now is the edit really persisted.
        if (pendingRef.current === next) {
          pendingRef.current = null;
          drop(pendingKey(uid, k));
          setStatus("idle");
        }
        writeJson(cacheKey(uid, k), next);
        attempt.current = 0;
      })
      .catch(() => {
        setStatus("error");
        const wait = RETRY_BACKOFF_MS[Math.min(attempt.current, RETRY_BACKOFF_MS.length - 1)];
        attempt.current += 1;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(flush, wait);
      });
  }, []);

  const persist = useCallback(
    (next: T) => {
      if (!userId) return;
      pendingRef.current = next;
      // Written BEFORE the request and cleared only on success, so a reload
      // mid-flight restores the edit rather than losing it.
      writeJson(pendingKey(userId, key), next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [userId, key, flush],
  );

  const replace = useCallback(
    (next: T) => {
      setState(next);
      persist(next);
    },
    [persist],
  );

  const update = useCallback(
    (mutator: (draft: T) => void) => {
      setState((prev) => {
        const draft = JSON.parse(JSON.stringify(prev)) as T;
        mutator(draft);
        persist(draft);
        return draft;
      });
    },
    [persist],
  );

  /** Retry now, for a "Try again" control. */
  const retrySave = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    attempt.current = 0;
    flush();
  }, [flush]);

  // A tab coming back online is the likeliest moment for a stuck save to work.
  useEffect(() => {
    const onOnline = () => {
      if (pendingRef.current) retrySave();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [retrySave]);

  // Flush a pending change on unmount so a quick navigation never drops the
  // last edit. `keepalive` so the browser completes it after teardown.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      const pending = pendingRef.current;
      const uid = userIdRef.current;
      if (pending && uid) {
        // The pending key is already written, so even if this never lands the
        // next load restores it.
        void api.putBeacon(`/v3/pillars/${keyRef.current}`, { data: pending });
      }
    };
  }, []);

  return { state, setState, replace, update, loaded, status, retrySave };
}
