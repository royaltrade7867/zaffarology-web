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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { reportError } from "@/lib/error-reporting";
import { apiErrorMessage } from "@/lib/api";
import { useDialog } from "@/components/dialog";
import {
  inviteConnection,
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
  /* Bumped to re-fetch. Adding someone from a tag field has to make them
     selectable straight away — without this they exist on the server but not in
     this list until the page is reloaded, which reads as the invite failing. */
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

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
  }, [user, tick]);

  return { partners, loaded, refresh };
}

/**
 * Partners, plus "add someone to the team from right here".
 *
 * Every person field in the app offers the same thing when a typed name matches
 * nobody, so the handler lives once rather than five times. It returns what
 * `PersonTagField`'s `onAddPerson` expects, so a caller wires it straight
 * through.
 *
 * Adding refreshes the list, which is the point: without it the invited person
 * exists on the server but not in the dropdown until a reload, and that reads
 * as the invite having failed.
 */
export function usePartnersWithAdd() {
  const { partners, loaded, refresh } = usePartners();
  const dialog = useDialog();

  const addPerson = useCallback(
    async (typedName: string) => {
      /* The invite is keyed on an EMAIL, but these fields usually hold a name.
         Ask for the address — unless they typed one, in which case asking them
         to repeat it is just friction. */
      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedName);
      const email = looksLikeEmail
        ? typedName
        : await dialog.prompt(`Add ${typedName} to your team`, {
            placeholder: "their@email.com",
            confirmLabel: "Send invite",
          });
      if (!email?.trim()) return;
      try {
        await inviteConnection(email.trim());
        refresh();
        /* `/connections/invite` answers identically for every outcome — already
           connected, no account, a stranger — so this cannot claim to know
           which happened. It covers both real paths instead. */
        await dialog.alert(
          "Invite sent",
          `If ${email.trim()} can be added, they've been invited. Someone with an account joins your team straight away — otherwise they join when they sign up with that address.`,
        );
      } catch (err) {
        await dialog.alert(apiErrorMessage(err, "Could not send that invite. Please try again."));
      }
    },
    [dialog, refresh],
  );

  return { partners, loaded, refresh, addPerson };
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

/**
 * Status of tasks I assigned, keyed by the task id in my own blob.
 *
 * The DB allows SEVERAL assignees per source task — its uniqueness constraint
 * is (assigner, pillar, task, assignee) — while a board item carries one
 * `assigneeUserId`. So `allByTaskId` keeps every row and `byTaskId` exposes a
 * deterministic first (lowest id = earliest assignment) rather than whichever
 * one the server happened to return last, which made the status note flip
 * between people. `extraCount` lets a screen say when there are more.
 */
export function useOutgoingAssignments(pillarKey: string, refreshKey?: number) {
  const [allByTaskId, setAllByTaskId] = useState<Record<string, ApiOutgoingAssignment[]>>({});

  const refetch = useCallback(async () => {
    try {
      const rows = await loadOutgoingAssignments(pillarKey);
      const grouped: Record<string, ApiOutgoingAssignment[]> = {};
      for (const r of rows) (grouped[r.source_task_id] ??= []).push(r);
      // Stable order, so the badge does not change identity between refetches.
      for (const k of Object.keys(grouped)) grouped[k].sort((a, b) => a.id - b.id);
      setAllByTaskId(grouped);
    } catch {
      // A missing status badge is a cosmetic loss; the item still renders.
    }
  }, [pillarKey]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  useOnVisible(refetch);

  const byTaskId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(allByTaskId).map(([k, v]) => [k, v[0]]),
      ) as Record<string, ApiOutgoingAssignment>,
    [allByTaskId],
  );

  /** How many assignees BEYOND the one shown, per task. */
  const extraCount = useCallback(
    (taskId: string) => Math.max(0, (allByTaskId[taskId]?.length ?? 0) - 1),
    [allByTaskId],
  );

  return { byTaskId, allByTaskId, extraCount, refetch };
}
