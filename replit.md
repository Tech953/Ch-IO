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

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

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
