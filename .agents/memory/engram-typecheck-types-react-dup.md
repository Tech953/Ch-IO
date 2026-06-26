---
name: engram web typecheck — duplicate @types/react
description: Pre-existing TS errors in engram shadcn UI files caused by two @types/react versions; not caused by feature work.
---

`pnpm run typecheck` fails in `artifacts/engram/src/components/ui/calendar.tsx` and `button-group.tsx` with errors like "Two different types with this name exist" (Ref / VoidOrUndefinedOnly) and missing `--radix-${string}` index signatures.

**Why:** two `@types/react` versions resolve in the monorepo — the engram web app uses the catalog pin (19.2.x) while the Expo mobile artifact (react-native/expo) pins 19.1.x. The duplicate type identities make the stock vendored shadcn UI files fail to typecheck. The files themselves are unmodified.

**How to apply:** don't chase these when doing engram feature work — they predate it and are environmental. Confirm scope by diffing the file against HEAD (`git --no-optional-locks show HEAD:<path>` — it's byte-identical) rather than editing it. A real fix is a dependency-dedup task (align @types/react across web + mobile), not a per-file edit.
