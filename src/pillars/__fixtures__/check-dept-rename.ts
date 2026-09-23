/**
 * "Delegation" became "Delegation and Follow-up" (23 Sep 2026).
 *
 * The department name is not just a label: THREE behaviours key off it, and
 * each fails differently and silently if the old spelling stops matching.
 *
 *  - `deptKind` decides which board a system opens. Lose the match and an
 *    existing delegation board becomes an ordinary 12-section system, so the
 *    user's tasks are still stored but nothing renders them.
 *  - `isStandardDept` decides whether a department can be deleted. Lose it and
 *    a standard department quietly becomes deletable.
 *  - `standardIndex` is what the seed checks before adding a missing standard
 *    department. Lose it and every load inserts a SECOND delegation department
 *    beside the first.
 *
 * So both spellings must keep working, for as long as any stored blob still
 * says "Delegation" — which is for ever, since nothing rewrites it.
 *
 * Run from the web root:  npx tsx src/pillars/__fixtures__/check-dept-rename.ts
 */
import {
  DEFAULT_DEPARTMENTS,
  deptKind,
  isStandardDept,
  normalize,
  type P8State,
} from "@/pillars/schemas/business-systems";

let pass = 0;
const fails: string[] = [];
const ck = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++;
  else fails.push(name + (detail ? " — " + detail : ""));
};

const OLD = "Delegation";
const NEW = "Delegation and Follow-up";

/* ------------------------- the new name is the seed ------------------------- */

ck("the seed writes the new name", DEFAULT_DEPARTMENTS[1] === NEW, DEFAULT_DEPARTMENTS[1]);

/* ------------------------- both names still work ------------------------- */

ck("new name opens the delegate board", deptKind(NEW) === "delegation", deptKind(NEW));
ck("OLD name still opens it", deptKind(OLD) === "delegation", deptKind(OLD));
ck("matching ignores case", deptKind("delegation and follow-up") === "delegation");
/* Someone may type it without the hyphen. */
ck("'followup' also matches", deptKind("Delegation and Followup") === "delegation");

ck("new name cannot be deleted", isStandardDept(NEW));
ck("OLD name cannot be deleted either", isStandardDept(OLD));

/* A near-miss must NOT be captured: a real custom department called something
   similar keeps the ordinary 12-section editor. */
ck("an unrelated name is untouched", deptKind("Delegation Training") === "systems");

/* ------------------------- no duplicate department ------------------------- */

const trip = (s: unknown): P8State => normalize(JSON.parse(JSON.stringify(s)) as P8State);

{
  /* A business seeded BEFORE the rename: it still stores "Delegation", and has
     real work on a system inside it. */
  const before = {
    businesses: [
      {
        id: "b1",
        name: "Khan Enterprises",
        seeded: true,
        departments: [
          {
            id: "d1",
            name: OLD,
            num: "D1",
            systems: [
              {
                id: "s1",
                num: "S1",
                name: "Warehouse",
                delegation: {
                  items: [{ text: "Chase the invoice", who: "Bilal", whoUserId: "" }],
                  filed: [],
                },
              },
            ],
          },
        ],
      },
    ],
    nextSysNum: 1,
    nextDeptNum: 1,
  };

  const out = trip(before);
  const depts = out.businesses[0].departments;
  const delegation = depts.filter((d) => deptKind(d.name) === "delegation");

  ck("exactly one delegation department", delegation.length === 1, `got ${delegation.length}`);
  /* The stored name is LEFT ALONE. Rewriting it would be a whole-blob write
     against a user's data to change a label, and an older phone build reading
     the same blob would not know the new spelling. */
  ck("the stored name is not rewritten", delegation[0]?.name === OLD, delegation[0]?.name);
  ck(
    "the board is intact",
    delegation[0]?.systems[0]?.delegation?.items[0]?.text === "Chase the invoice",
  );
  ck("all five standard departments are present", depts.length === 5, `got ${depts.length}`);
}

{
  /* Running twice must not add anything: `normalize` runs on every load. */
  const fresh = trip({ businesses: [{ id: "b1", name: "Co", departments: [] }], nextSysNum: 1, nextDeptNum: 1 });
  const twice = trip(fresh);
  const names = twice.businesses[0].departments.map((d) => d.name);
  ck("a new business gets the new name", names[1] === NEW, names[1]);
  ck("running twice adds nothing", names.length === 5, `got ${names.length}`);
}

if (fails.length) {
  console.error(`FAILED (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`passed (${pass})`);
