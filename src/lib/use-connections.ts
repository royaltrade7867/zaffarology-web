"use client";

/**
 * Connections and assignments, kept OUTSIDE the pillar blobs.
 *
 * Assigned tasks must never be written into a pillar blob. `PUT /v3/pillars/{key}`
 * replaces the whole document with no version check, and `usePillarState` lets an
 * unsynced local cache win over the server — so a task written into someone's blob
 * could be silently erased by a routine offline edit on their phone. These hooks
 * keep that data server-side and merge it at render time instead.
 *
 * Ported from `zaffarology-mobileapp/src/lib/use-connections.ts`. The one
 * substitution is the refresh trigger: mobile refetches when the app returns to
 * the foreground (`AppState`), the browser equivalent is the tab becoming
 * visible again. There is no push channel either way.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { reportError } from "@/lib/error-reporting";
import {
  loadConnections,
  loadIncomingAssignments,
  loadOutgoingAssignments,
  setAssignmentDone,
  type ApiConnection,
  type ApiIncomingAssignment,
  type ApiOutgoingAssignment,
} from "@/lib/connections-api";

export interface Partner {
  userId: number;
  name: string;
  email: string;
}

/** Run `fn` whenever the tab becomes visible again — the browser's stand-in for
 *  mobile's "app returned to the foreground". */
function useOnVisible(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
}

/** Accepted connections only — the people you may tag. */
export function usePartners() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setLoaded(true);
      return undefined;
    }
    loadConnections()
      .then((rows: ApiConnection[]) => {
        if (!active) return;
        setPartners(
          rows
            .filter((r) => r.status === "accepted" && r.user_id != null)
            .map((r) => ({
              userId: r.user_id as number,
              name: r.full_name?.trim() || r.email,
              email: r.email,
            })),
        );
      })
      // No connections is a normal state, and a failed fetch must not stop
      // someone typing a plain name into the field. It IS logged, though —
      // swallowing it silently made an empty suggestion list indistinguishable
      // from a broken request.
      .catch((err) => reportError(err, { area: "partners-load" }))
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return { partners, loaded };
}

/**
 * Tasks assigned TO me, for the read-only overlay above my own board.
 */
export function useIncomingAssignments(refreshKey?: number) {
  const [rows, setRows] = useState<ApiIncomingAssignment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const inFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setRows(await loadIncomingAssignments());
    } catch {
      // Leave the last known list in place; an empty board would look like the
      // tasks had been withdrawn.
    } finally {
      inFlight.current = false;
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  useOnVisible(refetch);

  /** Optimistic: flip locally, revert if the server rejects it. */
  const markDone = useCallback(async (id: number, done: boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: done ? "completed" : "open" } : r)),
    );
    try {
      await setAssignmentDone(id, done);
    } catch (err) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: done ? "open" : "completed" } : r)),
      );
      throw err;
    }
  }, []);

  return { rows, loaded, refetch, markDone };
}

/** Status of tasks I assigned, keyed by the task id in my own blob. */
export function useOutgoingAssignments(pillarKey: string, refreshKey?: number) {
  const [byTaskId, setByTaskId] = useState<Record<string, ApiOutgoingAssignment>>({});

  const refetch = useCallback(async () => {
    try {
      const rows = await loadOutgoingAssignments(pillarKey);
      setByTaskId(Object.fromEntries(rows.map((r) => [r.source_task_id, r])));
    } catch {
      // A missing status badge is a cosmetic loss; the item still renders.
    }
  }, [pillarKey]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  useOnVisible(refetch);

  return { byTaskId, refetch };
}
