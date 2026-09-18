"use client";

import { pillarByNumber } from "@/lib/pillars";
import { usePillarState } from "@/lib/use-pillar-state";
import { PillarScaffold } from "@/components/pillar-scaffold";
import { Loading } from "@/components/ui";
import { AmPmBoard } from "@/components/am-pm-board";
/**
 * Types come from the SHARED schema, not local copies.
 *
 * Both apps write the same `/v3/pillars/{key}` blob and the builders rebuild
 * from a whitelist, so a field this file did not name was dropped whenever the
 * browser saved. Pillar 4 was losing `id` and `assigneeUserId` exactly that
 * way, which orphans task assignments. One definition means no drift.
 */
import { makeInitial, normalize, type P3State } from "@/pillars/schemas/pillar-3";

const pillar = pillarByNumber(3)!;

/**
 * The board itself lives in `AmPmBoard`, because the same board also runs
 * inside Pillar 5's "AM Planning & PM Achievement ($)" department. This screen
 * only supplies where Pillar 3's own day is stored.
 */
export default function Pillar3() {
  const { state, update, loaded, status, retrySave } = usePillarState<P3State>(pillar.key, makeInitial, normalize);
  if (!loaded) return <Loading />;
  return (
    <PillarScaffold pillar={pillar} saveStatus={status} onRetrySave={retrySave}>
      <AmPmBoard state={state} update={update} />
    </PillarScaffold>
  );
}
