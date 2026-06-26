---
name: ENGRAM DB table names
description: Actual Drizzle table export names to use in route imports.
---

The schema exports are NOT named after the domain concept — they use these names:

- `personalityTable` (from `lib/db/src/schema/personality.ts`)
- `personasTable` (from `lib/db/src/schema/personas.ts`)
- `beliefsTable` (from `lib/db/src/schema/beliefs.ts`)
- `conversations` (no suffix, from `lib/db/src/schema/conversations.ts`)
- `messages` (no suffix, from `lib/db/src/schema/messages.ts`)

**Why:** Inconsistency in the original schema files — some used `Table` suffix, some didn't. Importing wrong names causes TS2724 "did you mean X?" errors.
