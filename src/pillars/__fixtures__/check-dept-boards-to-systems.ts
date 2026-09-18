/**
 * The AM/PM and Delegation boards moved from the DEPARTMENT onto a SYSTEM
 * (19 Sep 2026), so all five standard departments behave alike: create a
 * system, open it, get the board.
 *
 * What this guards:
 *  - DATA SAFETY, both directions. A blob written before the move carries
 *    `Department.amPm` / `Department.delegation`. Those must be lifted into a
 *    system, and must ALSO stay where they are: an older phone build reads only
 *    the department field, and stripping it would blank that user's board until
 *    they upgrade.
 *  - IDEMPOTENCE. `normalize` runs on every single load. Running it twice must
 *    not create a second system, and must not overwrite a board the user has
 *    since edited at system level.
 *  - NO PHANTOM SYSTEMS. A seeded department nobody ever opened still has an
 *    `amPm` object (P3's `makeInitial` fills in `day` and five blank rows).
 *    Migrating that would manufacture a visible "S1" in a department the user
 *    never touched.
 *  - THE SCREEN DISPATCHES BY KIND. The boards must render from `SystemBody`,
 *    not from `DeptBlock`, or the department still shows work without a system.
 *
 * Run from the web root:  npx tsx src/pillars/__fixtures__/check-dept-boards-to-systems.ts
 */
import { readFileSync } from "node:fs";

import { normalize, type P8State } from "@/pillars/schemas/business-systems";

let pass = 0;
const fails: string[] = [];
const ck = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++;
  else fails.push(name + (detail ? " — " + detail : ""));
};

/** A full save -> load cycle, exactly as the blob store does it. */
const trip = (s: unknown): P8State => normalize(JSON.parse(JSON.stringify(s)) as P8State);

/** A blob in the OLD shape: the board hangs off the department. */
const oldShape = (deptName: string, board: Record<string, unknown>) => ({
  businesses: [
    {
      id: "b1",
      name: "Khan Enterprises",
      seeded: true,
      departments: [{ id: "d1", name: deptName, num: "D1", systems: [], ...board }],
    },
  ],
  nextSysNum: 1,
  nextDeptNum: 1,
});

/** A delegation board with real work in it. */
const delegWork = {
  delegation: {
    items: [{ text: "Chase the Kandahar invoice", who: "Bilal", whoUserId: "" }],
    filed: [],
  },
};

/** An AM/PM board with real work in it. */
const amPmWork = {
  amPm: {
    work: { text: "Sign the lease", done: false },
    dod: [{ text: "Call the bank", done: false }],
    extra: [],
    pm: "",
    money: "",
    filed: [],
    day: "2026-09-19",
    history: [],
  },
};

/* ------------------------- the lift itself ------------------------- */

{
  const st = trip(oldShape("Delegation", delegWork));
  const d = st.businesses[0].departments[0];
  ck("a delegation board with work gets a system", d.systems.length === 1, `got ${d.systems.length}`);
  ck(
    "the board is now on the system",
    d.systems[0]?.delegation?.items[0]?.text === "Chase the Kandahar invoice",
  );
  /* The old field STAYS. An older phone build reads only this one; removing it
     would blank the board for a user who has not updated. */
  ck("the department still carries the old copy", !!d.delegation);
  ck("the system is numbered S1", d.systems[0]?.num === "S1", d.systems[0]?.num);
}

{
  const st = trip(oldShape("AM Planning & PM Achievement ($)", amPmWork));
  const d = st.businesses[0].departments[0];
  ck("an AM/PM board with work gets a system", d.systems.length === 1, `got ${d.systems.length}`);
  ck("the AM/PM board is now on the system", d.systems[0]?.amPm?.work.text === "Sign the lease");
  ck("the AM/PM department still carries the old copy", !!d.amPm);
}

/* ------------------------- no phantom systems ------------------------- */

{
  /* Exactly what a seeded-but-untouched department looks like: P3's initial
     state, which is NOT empty — it has a `day` and five blank do-or-die rows. */
  const untouched = {
    amPm: {
      work: { text: "", done: false },
      dod: Array.from({ length: 5 }, () => ({ text: "", done: false })),
      extra: [],
      pm: "",
      money: "",
      filed: [],
      day: "2026-09-19",
      history: [],
    },
  };
  const st = trip(oldShape("AM Planning & PM Achievement ($)", untouched));
  ck(
    "an untouched AM/PM board makes no system",
    st.businesses[0].departments[0].systems.length === 0,
  );
}

{
  const empty = { delegation: { items: [], filed: [] } };
  const st = trip(oldShape("Delegation", empty));
  ck("an empty delegation board makes no system", st.businesses[0].departments[0].systems.length === 0);
}

{
  /* A row that exists but holds nothing is still nothing. */
  const blankRow = { delegation: { items: [{ text: "  ", who: "", whoUserId: "" }], filed: [] } };
  const st = trip(oldShape("Delegation", blankRow));
  ck(
    "a blank delegation row makes no system",
    st.businesses[0].departments[0].systems.length === 0,
  );
}

/* ------------------------- idempotence ------------------------- */

{
  /* `normalize` runs on EVERY load, so the second pass must be a no-op. */
  const once = trip(oldShape("Delegation", delegWork));
  const twice = trip(once);
  const d = twice.businesses[0].departments[0];
  ck("running twice does not add a second system", d.systems.length === 1, `got ${d.systems.length}`);
  ck("the board survives the second pass", d.systems[0]?.delegation?.items.length === 1);
}

{
  /* The user migrated, then edited at system level. The stale department copy
     must NOT overwrite that newer work on the next load. */
  const migrated = {
    businesses: [
      {
        id: "b1",
        name: "Khan Enterprises",
        seeded: true,
        departments: [
          {
            id: "d1",
            name: "Delegation",
            num: "D1",
            // The old, stale copy.
            ...delegWork,
            systems: [
              {
                id: "s1",
                num: "S1",
                name: "Delegation",
                delegation: { items: [{ text: "EDITED AT SYSTEM LEVEL", who: "", whoUserId: "" }], filed: [] },
              },
            ],
          },
        ],
      },
    ],
    nextSysNum: 2,
    nextDeptNum: 2,
  };
  const st = trip(migrated);
  const sys = st.businesses[0].departments[0].systems[0];
  ck(
    "a stale department copy never overwrites system-level work",
    sys?.delegation?.items[0]?.text === "EDITED AT SYSTEM LEVEL",
    sys?.delegation?.items[0]?.text,
  );
}

/* ------------------------- the round trip ------------------------- */

{
  /* `fixSystem` rebuilds from a whitelist, so an unnamed field is dropped on
     every load. Both new fields must be carried through explicitly or a user's
     board vanishes the next time they open the pillar. */
  const st = trip(oldShape("Delegation", delegWork));
  const again = trip(st);
  ck(
    "System.delegation survives a save/load round trip",
    again.businesses[0].departments[0].systems[0]?.delegation?.items[0]?.text ===
      "Chase the Kandahar invoice",
  );
}

{
  const st = trip(oldShape("AM Planning & PM Achievement ($)", amPmWork));
  const again = trip(st);
  ck(
    "System.amPm survives a save/load round trip",
    again.businesses[0].departments[0].systems[0]?.amPm?.work.text === "Sign the lease",
  );
}

/* ------------------------- an ordinary department ------------------------- */

{
  /* Nothing about this should touch a department that never had a board. */
  const st = trip(oldShape("Warehouse", {}));
  ck("an ordinary department is untouched", st.businesses[0].departments[0].systems.length === 0);
}

/* ------------------------- the screen ------------------------- */

{
  const src = readFileSync("src/pillars/pillar-5-business-systems.tsx", "utf8");
  /* Comments mention both names, so strip them before matching or a removed
     call still "passes" on the note explaining that it was removed. */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const bodyAt = code.indexOf("function SystemBody");
  const deptAt = code.indexOf("function DeptBlock");
  ck("both components still exist", bodyAt > 0 && deptAt > 0);

  /* The department block ends where the next top-level function begins. */
  const deptEnd = code.indexOf("\nfunction ", deptAt + 1);
  const deptBody = code.slice(deptAt, deptEnd > 0 ? deptEnd : undefined);

  ck("DeptBlock no longer renders the AM/PM board", !deptBody.includes("<AmPmBoard"));
  ck("DeptBlock no longer renders the delegate list", !deptBody.includes("<DelegateSection"));

  ck("the AM/PM board is dispatched by system kind", code.includes('kind === "am-pm"') && code.includes("<AmPmBoard"));
  ck("the delegation body is dispatched by system kind", code.includes('kind === "delegation"'));
  /* The boards must read the SYSTEM's field, not the department's. */
  ck("the AM/PM board reads sys.amPm", code.includes("sys.amPm"));
  ck("the delegation board reads sys.delegation", code.includes("sys.delegation"));
  ck("nothing reads dept.amPm any more", !code.includes("dept.amPm"));
  ck("nothing reads dept.delegation any more", !code.includes("dept.delegation"));
}

if (fails.length) {
  console.error(`FAILED (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`passed (${pass})`);
