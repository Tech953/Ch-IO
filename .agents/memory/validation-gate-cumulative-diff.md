---
name: Validation gate reviews the cumulative merged diff
description: Why mark_task_complete's code-review can reject on failures outside your current change, and how to respond.
---

When task work auto-merges, `mark_task_complete`'s validation/code-review evaluates the
**cumulative merged diff and runs the full test suite**, not just the edits made for the
current request. It can therefore REJECT on issues that belong to a *different*,
previously-merged task (e.g. a one-command-DB-bringup gap, or an unrelated worker test
failure) even when your own change is small and correct.

**Why:** the working tree is clean after auto-merge, so the reviewer has no way to scope to
"just this turn" — it sees everything since the review baseline.

**How to apply:**
1. Confirm your change is isolated: `git status --porcelain` (clean = already merged) and
   confirm there is no import path from your edited files to the failing area.
2. If your own diff was already validated (e.g. an architect `evaluate_task` PASS) and the
   rejection points are outside your changed surface, do NOT start fixing the unrelated
   feature — that is scope creep ("do what was asked, nothing more").
3. Complete with a precise `skip_validation_reason` naming (a) your isolated changed files,
   (b) the unrelated failing area, and (c) the evidence they are pre-existing/unrelated.
4. Tell the user about the pre-existing failure so it can be addressed as its own task.
