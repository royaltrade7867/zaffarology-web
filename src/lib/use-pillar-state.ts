"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Per-pillar state persistence — the SAME `/v3/pillars/{key}` JSON blob the
 * mobile app reads/writes, so a user's data is shared across web and mobile.
 * Loads from the backend (localStorage cache fallback) and saves debounced.
 * `update(draft => {...})` deep-clones so nested mutations always take.
 */
const cacheKey = (userId: string, key: string) => `zaff:v3:${userId}:${key}`;

async function loadBlob<T>(key: string): Promise<T | null> {
  const { data } = await api.get<{ data: T | null }>(`/v3/pillars/${key}`);
  return data ?? null;
}
async function saveBlob(key: string, data: unknown): Promise<void> {
  await api.put(`/v3/pillars/${key}`, { data });
}

export function usePillarState<T extends object>(
  key: string,
  makeInitial: () => T,
  normalize?: (s: T) => T,
) {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<T>(makeInitial);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const readCache = (): T | null => {
      try {
        const raw = window.localStorage.getItem(cacheKey(userId, key));
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    };

    loadBlob<T>(key)
      .then((remote) => {
        if (!active) return;
        if (remote) {
          setState(norm({ ...makeInitial(), ...remote }));
          try {
            window.localStorage.setItem(cacheKey(userId, key), JSON.stringify(remote));
          } catch {
            /* ignore */
          }
        } else {
          const cached = readCache();
          if (cached) setState(norm({ ...makeInitial(), ...cached }));
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        const cached = readCache();
        if (cached) setState(norm({ ...makeInitial(), ...cached }));
        setLoaded(true);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key]);

  const persist = useCallback(
    (next: T) => {
      if (!userId) return;
      pendingRef.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        pendingRef.current = null;
        try {
          window.localStorage.setItem(cacheKey(userId, key), JSON.stringify(next));
        } catch {
          /* ignore */
        }
        saveBlob(key, next).catch(() => {});
      }, 400);
    },
    [userId, key],
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

  // flush a pending change on unmount so a quick navigation never drops the last edit
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const pending = pendingRef.current;
      const uid = userIdRef.current;
      if (pending && uid) {
        try {
          window.localStorage.setItem(cacheKey(uid, keyRef.current), JSON.stringify(pending));
        } catch {
          /* ignore */
        }
        saveBlob(keyRef.current, pending).catch(() => {});
      }
    };
  }, []);

  return { state, setState, replace, update, loaded };
}
