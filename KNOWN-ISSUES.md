# Known issues — Zaffarology Web App

The web app reads and writes **the same `/v3/pillars/{key}` blobs, on the same
accounts, as the mobile app**. It has drifted behind mobile's schema, and because
both apps do a whole-blob overwrite on save, that drift is not cosmetic: the web
app can save a stripped blob back over data the mobile app wrote.

Mobile is the priority; these are logged for a later web pass.

---

## 1. Pillar 1 destroys per-goal data (data loss, live today)

**Severity: high — silent, irreversible for the affected fields.**

`migrateGoals` in `src/pillars/pillar-1.tsx` (~line 51) rebuilds every goal as
`{goal, plan}` only:

```ts
goals = goals.map((g) => ({ goal: g?.goal ?? "", plan: g?.plan ?? "" }));
```

The web app's Pillar 1 was never updated when mobile restructured goals into
self-contained projects. So for a goal written by the mobile app, opening
Pillar 1 on the web **discards**:

- `target` — the goal's Deadline
- `work` — Work of the Day
- `dod` — Do-or-Die tasks
- `extra` — Extra Mile tasks
- `deleg` — Delegated tasks (and their assignee names and deadlines)

The stripped goal is then saved back, overwriting the mobile data. Verified by
running the web app's own `migrateGoals` against a mobile-written blob: every
field above came back `undefined`.

**Minimum fix** (stops the loss without a full port): preserve unknown keys
instead of rebuilding —

```ts
goals = goals.map((g) => ({ ...g, goal: g?.goal ?? "", plan: g?.plan ?? "" }));
```

The web UI still would not *display* the newer per-goal fields, but it would stop
destroying them. **Full fix**: port mobile's `src/pillars/schemas/pillar-1.ts`
and the per-goal UI.

## 2. Pillar 1 delegated tasks have no `due` field

`interface Deleg` is `{ text, who, done }` — mobile's has `due` (the Deadline)
and now `id`. A delegated task edited on the web loses its deadline.

## 3. No stable ids on tasks created in the web app

Mobile now mints an `id` on P4 items and P1 delegated tasks, used to link a task
to a **task assignment** (see the connections feature). The web app's `blank()`
factories do not set one.

Impact is limited and self-healing: mobile's `withId()` mints an id on next load,
and the web app *preserves* ids on items it did not create (verified — its
normalisers pass objects through rather than rebuilding by whitelist). The only
real consequence is that a task created on the web cannot be assigned until it
has been opened once on mobile.

## 4. Five of seven pillars pass no normaliser

`usePillarState` is called without a `normalize` argument in `idea-pillar`,
`pillar-2`, `pillar-3`, `pillar-4` and `pillar-7`. The web app has no
`src/pillars/schemas/` directory at all — every type and factory is a local
duplicate. It therefore cannot heal a malformed or older blob the way mobile can.

## 5. Underlying cause: unversioned whole-blob writes

`PUT /v3/pillars/{key}` replaces the entire blob with no version check, and both
clients last-writer-wins. This is what turns a schema gap into data loss rather
than a display bug. A separate ticket should add an `updated_at` precondition to
the PUT.
