import { makeInitial, normalize, type P4State } from "@/pillars/schemas/pillar-4";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

/* A blob written by the OLD web app: no id, no assigneeUserId. */
const legacy = {
  items: [{ name: "Call supplier", who: "Sam", due: "2026-09-10",
            status: "", newDate: "", note: "", completedOn: "" }],
  filed: [], day: "2026-09-08", history: [],
} as unknown as P4State;

const a = normalize(legacy);
ck("legacy item self-heals an id", !!a.items[0].id, JSON.stringify(a.items[0].id));
ck("and gains assigneeUserId", a.items[0].assigneeUserId === "");
ck("the user's text is untouched", a.items[0].name === "Call supplier" && a.items[0].who === "Sam");

/* A blob written by MOBILE, with a live assignment on it. */
const fromMobile = {
  items: [{ id: "itm_abc", name: "Stock count", who: "Dana", due: "2026-09-12",
            status: "completed", newDate: "", note: "n", completedOn: "2026-09-12",
            assigneeUserId: "usr_42" }],
  filed: [], day: "2026-09-08", history: [],
} as unknown as P4State;

const b = normalize(fromMobile);
ck("a mobile id SURVIVES a web load", b.items[0].id === "itm_abc", b.items[0].id);
ck("the assignment link survives", b.items[0].assigneeUserId === "usr_42", b.items[0].assigneeUserId);
ck("normalize is idempotent",
   JSON.stringify(normalize(JSON.parse(JSON.stringify(b)))) === JSON.stringify(b));

/* An empty board must never be empty — the screen indexes items[idx]. */
ck("an empty board gets a blank row",
   normalize({ items: [], filed: [], day: "", history: [] } as unknown as P4State).items.length === 1);
ck("fresh state has an id too", !!makeInitial().items[0].id);

if (fails.length) { console.error(pass + " passed, " + fails.length + " FAILED"); fails.forEach(f => console.error("  FAIL " + f)); process.exit(1); }
console.log("All web Pillar 4 round-trip checks passed (" + pass + ")");
