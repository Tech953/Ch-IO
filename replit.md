# ENGRAM — PYRI AI Persona Framework

A full-stack dashboard for "PYRI", an AI companion built on a fictional ENGRAM cognitive architecture: layered memory, a belief registry, personas, a symbolic Hiero-Code language, an emotive micro-expression layer, and a multi-mode streaming chat.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- LLM provider (swappable; cloud by default): `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` override the model endpoint/key/name. If unset they fall back to the Replit OpenAI integration (`AI_INTEGRATIONS_OPENAI_*`) and model `gpt-5.4`, so current behavior is unchanged. To run fully local, point `LLM_BASE_URL` at any OpenAI-compatible server (e.g. `http://localhost:11434/v1` for Ollama, `http://localhost:1234/v1` for LM Studio), set `LLM_MODEL` to a model that server hosts, and set `LLM_API_KEY` to any non-empty placeholder.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml` → codegen emits `@workspace/api-zod` (Zod) and `@workspace/api-client-react` (React Query hooks + `get...QueryKey` helpers).
- DB schema (source of truth): `lib/db/src/schema/*.ts`, re-exported from `lib/db/src/schema/index.ts`. Engram tables: `engrams.ts` (now also `mode` + `humanContactEnabled`), `engram-transmissions.ts`, `engram-inquiries.ts`, `engram-messages.ts` (the engram/human message bus), `hub-controls.ts` (singleton operator overrides); `conversations.ts` carries optional `engramId`.
- Seed scripts: `scripts/src/seed-*.ts` (`seed:expressions`, `seed:engrams`).
- API server: `artifacts/api-server/src/` — routes in `routes/` (incl. `messages.ts`, `hub-controls.ts`), prompt building in `lib/prompts.ts`, engram generation in `lib/engram-generation.ts`, pure autonomy policy in `lib/engram-policy.ts`, commons turn-taking in `lib/commons.ts`, human-contact routing in `lib/human-contact.ts`, message/controls stores in `lib/messages-store.ts` + `lib/controls-store.ts`, autonomous ticker in `services/engram-engine.ts` (started/stopped from `index.ts`).
- Frontend: `artifacts/engram/src/pages/` (Environment, Inquiry, Chat, Commons, Terminal, etc.); routes in `App.tsx`, nav in `components/layout.tsx`; shadcn/ui in `components/ui/`; wouter router; Tailwind v4 cyberpunk cyan theme.

## Architecture decisions

- Engrams are autonomous: a single in-process ticker (`engram-engine.ts`) accrues per-drive "pressure" from elapsed time (no LLM) and only calls the model to emit one transmission when pressure crosses the engram's threshold. Cost guards: per-engram cooldown, hourly/daily caps, duplicate-content avoidance, and error backoff.
- Inter-engram interaction & bounded initiative: engrams converse in the commons (turn-taking — least-recently-spoken picked, ≤1 turn/tick, per-space + per-engram cooldowns; every turn visible and logged, including refused ones) and self-initiate human contact only within bounded limits. All autonomy gating routes through one pure policy module (`lib/engram-policy.ts`): `capabilitiesFor` derives {canIdle,canConverse,canContactHuman,minHumanPriority} from mode × global controls × space × per-engram toggle; `classifyPriority`/`decideHumanContact` assign priority (urgent→delivered, meaningful→queued, social→digest) and enforce hourly/daily caps. Human-channel attempts (including refusals) are persisted to the `engram_messages` bus.
- Modes & overrides: each engram runs in an explicit `mode` (orientation/social/simulation/initiative_limited/full_bounded/quiescent) that gates behavior; unknown mode values fail closed (treated as quiescent — no initiative). Operator overrides live in the singleton `hub_controls` row (global pause, quiet mode) plus per-engram `humanContactEnabled` and send-to-quiescence (presence move). **Quiet mode is not a full silence — it raises the human-contact bar to `urgent` (meaningful/social are held); the per-engram `humanContactEnabled=false` toggle is the absolute off switch.**
- Anti-coercion is structural first: no engine code path lets one engram's turn mutate another engram's row (commons output is inert text persisted as a message; only the speaker's own state updates). `detectCoercion` (identity-attack regex scan) is an audit/refusal layer only — a flagged turn is refused + logged, never relied on as a security boundary.
- Engrams speak in their own voice/formatting (not the QUERTY expression layer). PYRI chat still uses the LPEM mode system; choosing an engram in chat bypasses LPEM modes and streams that engram's persona.
- Inquiry has two modes: `probe` (in-voice answer, no state change) and `develop` (the engram mutates only bounded config fields — mood/threshold/cadence/focusThemes/driveWeights/addFacts — returned as a config delta).
- Safety is enforced in code (`HARD_SAFETY`): the expression intimacy axis is sanitized out of any prompt; engram behavior stays platonic regardless of stored data.
- The language model is reached through a single provider seam (`api-server/src/lib/llm.ts`): one OpenAI-compatible client + model name resolved from `LLM_*` env (falling back to the cloud integration). Chat (`routes/openai.ts`) and autonomous transmissions/inquiry (`lib/engram-generation.ts`) both go through it, so pointing `LLM_BASE_URL` at a local runtime makes them run with no cloud call — nothing else changes. The Replit OpenAI integration package is no longer imported on the chat/transmission path, so a fresh local deploy without `AI_INTEGRATIONS_OPENAI_*` no longer crashes on startup.

## Product

- React + Vite dashboard (`@workspace/engram`) with pages for Personality, Memory, Journal, Personas, Beliefs, Evolution, Analytics, Hiero-Code, Chat, Commons, and Terminal.
- Commons (`/commons`): live engram-to-engram conversation feed — every turn visible and logged, including refused (anti-coercion) attempts shown as audit entries.
- Terminal (`/terminal`): operator console — global pause + quiet-mode toggles, per-engram mode select / human-contact disable / send-to-quiescence, the human-directed message list grouped by status with mark-seen, and an export-logs JSON download.
- Chat: 7 communication modes (informational/alert/tutorial/companion/analyst/silent/custom), SSE streaming, custom engram upload, persisted conversations/messages.
- Hiero-Code page: conceptual glyph compound builder plus the **Emotive Expression Layer** — a QUERTY ASCII micro-expression library (valence/arousal/intimacy) filterable by valence and arousal.
- PYRI weaves mode-appropriate micro-expressions into chat replies to make her affective state observable (none in Silent, expressive in Companion).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- No auto-seed: `db push` on a fresh DB leaves reference tables empty. Seed expressions with `pnpm --filter @workspace/scripts run seed:expressions` (idempotent). Add a similar script for any new reference table.
- The expression `intimacy` axis is stored faithfully in the DB/UI but is sanitized before it reaches the chat system prompt (only `intimacy <= 1`, neutral `cognitiveRole` metadata — never the free-text `notes`). Keep PYRI's expression behavior platonic.
- Run `pnpm --filter @workspace/api-spec run codegen` after editing `lib/api-spec/openapi.yaml`; run `pnpm --filter @workspace/db run push` after schema changes.
- Fonts are self-hosted via `@fontsource` (Inter, Rajdhani, JetBrains Mono), imported in `artifacts/engram/src/main.tsx` — not loaded from Google Fonts — so the UI renders correctly with no outbound network. Don't re-add CDN `<link>`/`@import` font references in `index.html`/`index.css`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
