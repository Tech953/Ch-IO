---
name: Engram engine test mock
description: How the engram-engine unit test fakes the DB, and the trap when the engine starts reading a new table.
---

# Engram engine test mock (`artifacts/api-server/src/services/engram-engine.test.ts`)

The engine is unit-tested with no real DB. A `vi.hoisted()` block builds a fake
`db` whose `select()` returns a `selectChain` that resolves rows **by table
identity**: it compares the table passed to `.from(t)` against hoisted sentinel
objects (e.g. `engramsTable`, `engramPresenceTable`) and returns the matching
`state.*` array, falling back to `state.recent` for anything unrecognized.

**The trap:** when the engine starts reading a *new* table (directly or via a
helper like `lib/hub-store.ts`), you must update the test in two places or it
fails silently:
1. `vi.mock("@workspace/db/schema", ...)` — add the new table export, or the
   helper imports `undefined` and `.from(undefined)` falls through to the
   default branch.
2. The `selectChain` `then()` resolver — add a `table === <sentinel>` branch
   returning the right `state.*` array, plus a fresh `state.*` field reset in
   `beforeEach`.

If you skip step 2, the query returns `state.recent` (the default) instead of
erroring, so the test passes with the wrong data — a quiet false positive.

**Why:** helpers that wrap `db` (hub-store load/move functions) run against this
fake, so the engine test implicitly exercises them. Adding a DB read anywhere on
the tick path silently changes what the fake must model.

**How to apply:** any time `runTick`/its helpers gain a new `db.select().from(X)`,
extend the schema mock, the selectChain resolver, and the `beforeEach` reset.
