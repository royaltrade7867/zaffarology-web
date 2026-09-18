/**
 * Connections and task assignment on the web.
 *
 * Three invariants, each of which has a real failure behind it:
 *
 *  - assignments NEVER touch a pillar blob. The blob is a whole-document
 *    replace and an unsynced local cache can win, so a task written into
 *    someone else's blob could be erased by a routine offline edit on their
 *    phone. Server rows, merged at render time, are the only safe home.
 *  - `/connections/invite` answers identically whether the address has an
 *    account. The UI must not vary either, or it becomes a way to discover who
 *    is a Zaffarology user.
 *  - tagging assigns immediately, so the confirm has to happen BEFORE the send
 *    and must say that both answers assign.
 */
import { readFileSync } from "fs";

let pass = 0; const fails: string[] = [];
const ck = (n: string, c: boolean, x = "") => { c ? pass++ : fails.push(n + (x ? " — " + x : "")); };

const api = readFileSync("src/lib/connections-api.ts", "utf8");
const hook = readFileSync("src/lib/use-connections.ts", "utf8");
const panel = readFileSync("src/components/connections-panel.tsx", "utf8");
const tagField = readFileSync("src/components/person-tag-field.tsx", "utf8");
const overlay = readFileSync("src/components/assigned-to-me.tsx", "utf8");
const p4 = readFileSync("src/pillars/pillar-4.tsx", "utf8");

/* ------------- assignments stay OUT of the pillar blob ------------------- */

/* The one field Pillar 4 may write is the assignee's id, and only after the
   server has accepted. The task itself must never be pushed into the blob. */
ck("pillar 4 writes only the assignee id into the blob",
   /setItem\(\{ assigneeUserId: String\(partner\.userId\) \}\)/.test(p4));
ck("and only AFTER the server accepted",
   /await assignTask\(\{[\s\S]*?\}\);\s*\n\s*setItem\(\{ assigneeUserId/.test(p4));
ck("the incoming overlay renders from server rows, not state",
   /rows=\{incoming\.rows\}/.test(p4));
ck("the overlay is above the board, not merged into it",
   p4.indexOf("<AssignedToMe") < p4.indexOf("Huddle Board"));
/* An assigned task's wording belongs to the assigner. The overlay must expose
   no way to edit it — only the done checkbox. */
ck("the overlay has no text input", !/<input(?![^>]*type="checkbox")/.test(overlay));
/* Untag must also wait for the server. Clearing the tag first leaves this board
   looking untagged while the task still sits on the assignee's board. */
ck("untag clears the tag only after the server confirms",
   /await unassignTask\(existing\.id\);\s*\n\s*setItem\(\{ assigneeUserId: "" \}\)/.test(p4));
ck("the overlay's only control is the done checkbox",
   (overlay.match(/<input/g) ?? []).length === 1 && /type="checkbox"/.test(overlay));

/* ----------------------- the invite privacy rule ------------------------- */

ck("the invite message does not branch on the reply",
   /If \$\{value\} can be invited/.test(panel));
/* Anything that inspects the response body to decide what to show would leak
   whether the address has an account. */
ck("the panel does not read the server's message",
   !/await inviteConnection\([^)]*\)\s*\.then|const .*= await inviteConnection/.test(panel));
ck("connections-api documents the rule", /must NOT try to infer/.test(api));

/* --------------------- confirm before anything sends --------------------- */

ck("picking a person confirms first", /dialog\.confirm\(/.test(tagField));
ck("the confirm says BOTH answers assign",
   /tagged on this either way/.test(tagField));
ck("the choice is passed through as notify", /onTag\(p, notify\)/.test(tagField));
ck("no undo window was reintroduced",
   !/UNDO_WINDOW/.test(tagField) && !/UNDO_WINDOW/.test(api));

/* --------------------------- suggestion matching ------------------------- */

/* A bare `includes` made typing "H" match "Sarah" and "Ahmed". Word-start only. */
ck("suggestions match the start of a word", /word\.startsWith\(q\)/.test(tagField));
ck("an empty field suggests nothing", /if \(!q\) return \[\];/.test(tagField));
ck("a fully-typed name stops suggesting",
   /pool\[0\]\.name\.toLowerCase\(\) === q\) return \[\]/.test(tagField));
ck("a list does not re-offer someone already in it", /have\.has\(/.test(tagField));

/* Reproduce the matcher to prove the behaviour, not just its shape. */
const startsWord = (name: string, q: string) =>
  name.toLowerCase().split(/[\s.'-]+/).some((w) => w.startsWith(q));
ck("'h' matches Hammad", startsWord("Hammad Qayyum", "h"));
ck("'h' does NOT match Sarah", !startsWord("Sarah Mitchell", "h"));
ck("'h' does NOT match Ahmed", !startsWord("Ahmed Khan", "h"));
ck("'q' matches a surname", startsWord("Hammad Qayyum", "q"));
ck("a hyphenated surname matches its second half", startsWord("Ana Lopez-Ruiz", "r"));

/* ------------------- multi-mode chips (meeting attendees) ---------------- */

/* Reproduce the parse/serialise pair. Everything before the last comma is a
   committed chip; the tail is what the user is still typing. Getting this wrong
   either eats a name or turns a half-typed one into a chip. */
const parse = (value: string) => ({
  committed: value.split(",").slice(0, -1).map((n) => n.trim()).filter(Boolean),
  draft: value.split(",").pop() ?? "",
});
const setAll = (names: string[], tail: string) =>
  [...names, tail].join(", ").replace(/,\s*$/, tail ? "" : ", ");

for (const names of [["Ana"], ["Ana", "Bo"], ["Ana", "Bo", "Cy"]]) {
  ck(`round-trips ${names.length} attendee name(s)`,
     JSON.stringify(parse(setAll(names, "")).committed) === JSON.stringify(names));
}
const typing = parse(setAll(["Ana", "Bo"], "Cy"));
ck("chips survive while a new name is typed",
   JSON.stringify(typing.committed) === '["Ana","Bo"]' && typing.draft.trim() === "Cy");
ck("backspace removes one whole chip, not one character",
   JSON.stringify(parse(setAll(["Ana", "Bo"].slice(0, -1), "")).committed) === '["Ana"]');
ck("a full name with spaces and a hyphen stays ONE chip",
   parse(setAll(["Ana Lopez-Ruiz"], "")).committed.length === 1);
/* Free-typed names must keep working — tagging is additive, never forced. */
ck("free text makes no chips",
   parse("Just a typed name").committed.length === 0);
ck("an empty field invents no chip", parse("").committed.length === 0);
ck("a trailing separator makes no blank chip", parse("Ana, ").committed.length === 1);
/* A stray double comma drops the blank rather than rendering an empty chip. */
ck("a double comma yields no blank chip",
   parse("Ana,,Bo").committed.every((n) => n.length > 0));

/* A comma COMMITS the name. Without an onDraft that handles it, setAll's
   trailing-separator trim eats the comma and "Ana, Bo" is stored as the single
   name "Ana Bo" with no chips at all. */
ck("a comma commits the name", /if \(t\.includes\(","\)\)/.test(tagField));
const setAll2 = (names: string[], tail: string) =>
  (names.length ? names.join(", ") + ", " : "") + tail;
const onDraft = (committed: string[], t: string) => {
  if (t.includes(",")) {
    const [done, ...rest] = t.split(",");
    const name = done.trim();
    return setAll2(name ? [...committed, name] : committed, rest.join(",").trim());
  }
  return setAll2(committed, committed.length ? t.replace(/^\s+/, "") : t);
};
/* Replay the real keystrokes. The trailing separator must SURVIVE the space
   after the comma — trimming it merged the chip back into the draft. */
for (const [seq, chips, tail] of [
  ["Ana, Bo", 1, "Bo"],
  ["Ana,Bo,Cy", 2, "Cy"],
  ["Ana Lopez-Ruiz, Bo", 1, "Bo"],
] as const) {
  let typed = "";
  for (const ch of seq) typed = onDraft(parse(typed).committed, parse(typed).draft + ch);
  const got = parse(typed);
  ck(`typing ${JSON.stringify(seq)} keeps the names apart`,
     got.committed.length === chips && got.draft.trim() === tail,
     JSON.stringify(typed));
}
ck("the separator is kept, not trimmed",
   /names\.join\(", "\) \+ ", "/.test(tagField));

/* Removing a chip must UNTAG, or the id stays in attendee_ids with nothing on
   screen to show it — and re-adding then re-removing repeats the same no-op. */
ck("removing a chip untags the person", /const removeAt = \(i: number\)[\s\S]*?untagByName\(gone\);/.test(tagField));
ck("backspacing a chip untags too",
   /setAll\(committed\.slice\(0, -1\), ""\);\s*\n\s*untagByName\(gone\);/.test(tagField));
ck("untagByName resolves the partner by name", /partners\.find\(\(x\) => x\.name\.trim\(\)\.toLowerCase\(\)/.test(tagField));

/* The suggestion list must be operable without a mouse. */
ck("arrow keys move through suggestions", /e\.key === "ArrowDown"/.test(tagField) && /e\.key === "ArrowUp"/.test(tagField));
ck("Enter picks the highlighted one", /e\.key === "Enter" && active >= 0/.test(tagField));
ck("Escape dismisses the list", /e\.key === "Escape"/.test(tagField));
ck("nothing is pre-selected, so a stray Enter assigns nobody",
   /useState\(-1\)/.test(tagField));
ck("options carry role=option", /role="option"/.test(tagField));
ck("the input points at the active option", /aria-activedescendant=/.test(tagField));
ck("and at the list it controls", /aria-controls=\{listId\}/.test(tagField));

/* ---------------- several assignees on one source task ------------------- */

/* The DB constraint is (assigner, pillar, task, assignee), so one source task
   can have several rows. Keying a plain map by task id silently kept whichever
   the server returned last, flipping the badge between people. */
ck("outgoing rows are grouped, not overwritten", /\(grouped\[r\.source_task_id\] \?\?= \[\]\)\.push\(r\)/.test(hook));
ck("and ordered deterministically", /sort\(\(a, b\) => a\.id - b\.id\)/.test(hook));
ck("extra assignees are surfaced, not hidden", /extraCount/.test(hook) && /more assigned/.test(p4));

/* ------------------------- refresh without push -------------------------- */

/* There is no push channel: an invite accepted elsewhere only shows up when the
   tab comes back into view. */
ck("the hooks refetch when the tab becomes visible",
   /document\.visibilityState === "visible"/.test(hook));
ck("the panel does too", /document\.visibilityState === "visible"/.test(panel));
ck("in-flight refetches are not stacked", /inFlight\.current/.test(hook));
ck("a failed refetch keeps the last known list",
   /Leave the last known list in place/.test(hook));

/* --------------------------- row-level safety ---------------------------- */

ck("a row cannot be double-clicked into two calls", /busy\.includes\(/.test(panel));
/* Two, not three: `decline` went when connections started accepting on
   creation. The two that remain — disconnect, and withdraw a sent invite — are
   the only destructive actions left on this panel, and both still confirm. */
ck("destructive actions confirm first",
   (panel.match(/dialog\.confirm\(/g) ?? []).length >= 2);
ck("disconnecting confirms", /Disconnect from \$\{nameOf\(r\)\}/.test(panel));
ck("withdrawing a sent invite confirms", /Withdraw the invite to \$\{r\.email\}/.test(panel));
ck("marking done is optimistic and reverts on failure",
   /done \? "open" : "completed"/.test(hook));

/* ------------------------------ API surface ------------------------------ */

for (const fn of ["loadConnections", "inviteConnection", "acceptConnection", "removeConnection",
                  "blockConnection", "loadIncomingAssignments", "loadOutgoingAssignments",
                  "assignTask", "setAssignmentDone", "unassignTask"]) {
  ck("connections-api exports " + fn, new RegExp("export async function " + fn + "\\b").test(api));
}

if (fails.length) {
  console.error(pass + " passed, " + fails.length + " FAILED");
  fails.forEach((f) => console.error("  FAIL " + f));
  process.exit(1);
}
console.log("All web connections checks passed (" + pass + ")");
