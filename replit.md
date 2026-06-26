# ENGRAM — PYRI AI Persona Framework

A full-stack dashboard for "PYRI", an AI companion built on a fictional ENGRAM cognitive architecture: layered memory, a belief registry, personas, a symbolic Hiero-Code language, an emotive micro-expression layer, and a multi-mode streaming chat.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml` → codegen emits `@workspace/api-zod` (Zod) and `@workspace/api-client-react` (React Query hooks + `get...QueryKey` helpers).
- DB schema (source of truth): `lib/db/src/schema/*.ts`, re-exported from `lib/db/src/schema/index.ts`. Engram tables: `engrams.ts`, `engram-transmissions.ts`, `engram-inquiries.ts`; `conversations.ts` carries optional `engramId`.
- Seed scripts: `scripts/src/seed-*.ts` (`seed:expressions`, `seed:engrams`).
- API server: `artifacts/api-server/src/` — routes in `routes/`, prompt building in `lib/prompts.ts`, engram generation in `lib/engram-generation.ts`, autonomous ticker in `services/engram-engine.ts` (started/stopped from `index.ts`).
- Frontend: `artifacts/engram/src/pages/` (Environment, Inquiry, Chat, etc.); routes in `App.tsx`, nav in `components/layout.tsx`; shadcn/ui in `components/ui/`; wouter router; Tailwind v4 cyberpunk cyan theme.

## Architecture decisions

- Engrams are autonomous: a single in-process ticker (`engram-engine.ts`) accrues per-drive "pressure" from elapsed time (no LLM) and only calls the model to emit one transmission when pressure crosses the engram's threshold. Cost guards: per-engram cooldown, hourly/daily caps, duplicate-content avoidance, and error backoff.
- Engrams speak in their own voice/formatting (not the QUERTY expression layer). PYRI chat still uses the LPEM mode system; choosing an engram in chat bypasses LPEM modes and streams that engram's persona.
- Inquiry has two modes: `probe` (in-voice answer, no state change) and `develop` (the engram mutates only bounded config fields — mood/threshold/cadence/focusThemes/driveWeights/addFacts — returned as a config delta).
- Safety is enforced in code (`HARD_SAFETY`): the expression intimacy axis is sanitized out of any prompt; engram behavior stays platonic regardless of stored data.

## Product

- React + Vite dashboard (`@workspace/engram`) with pages for Personality, Memory, Journal, Personas, Beliefs, Evolution, Analytics, Hiero-Code, and Chat.
- Chat: 7 communication modes (informational/alert/tutorial/companion/analyst/silent/custom), SSE streaming, custom engram upload, persisted conversations/messages.
- Hiero-Code page: conceptual glyph compound builder plus the **Emotive Expression Layer** — a QUERTY ASCII micro-expression library (valence/arousal/intimacy) filterable by valence and arousal.
- PYRI weaves mode-appropriate micro-expressions into chat replies to make her affective state observable (none in Silent, expressive in Companion).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- No auto-seed: `db push` on a fresh DB leaves reference tables empty. Seed expressions with `pnpm --filter @workspace/scripts run seed:expressions` (idempotent). Add a similar script for any new reference table.
- The expression `intimacy` axis is stored faithfully in the DB/UI but is sanitized before it reaches the chat system prompt (only `intimacy <= 1`, neutral `cognitiveRole` metadata — never the free-text `notes`). Keep PYRI's expression behavior platonic.
- Run `pnpm --filter @workspace/api-spec run codegen` after editing `lib/api-spec/openapi.yaml`; run `pnpm --filter @workspace/db run push` after schema changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
