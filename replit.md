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
- DB schema (source of truth): `lib/db/src/schema/*.ts`, re-exported from `lib/db/src/schema/index.ts`. Engram tables: `engrams.ts` (now also `mode` + `humanContactEnabled` + `simulationEnabled`), `engram-transmissions.ts`, `engram-inquiries.ts`, `engram-messages.ts` (the engram/human message bus), `engram-simulations.ts` (`engram_simulations` sessions + `engram_simulation_steps` ordered progress, each step linked to its quarantined world-model row), `hub-controls.ts` (singleton operator overrides); `conversations.ts` carries optional `engramId`. Media perception tables in `media.ts`: `media_assets` (upload metadata + async job lifecycle/results), `media_blobs` (raw `bytea`, 1:1 with the asset, separate so list/status never load bytes), `media_observations` (maps an asset → each OBSERVED world-model entry it produced).
- Seed scripts: `scripts/src/seed-*.ts` (`seed:expressions`, `seed:engrams`).
- API server: `artifacts/api-server/src/` — routes in `routes/` (incl. `messages.ts`, `hub-controls.ts`, `simulations.ts`), prompt building in `lib/prompts.ts`, engram generation in `lib/engram-generation.ts` (incl. simulation premise/step/exit-summary generators), pure autonomy policy in `lib/engram-policy.ts`, commons turn-taking in `lib/commons.ts`, human-contact routing in `lib/human-contact.ts`, bounded simulation engine + lifecycle in `lib/simulations.ts` (`maybeRunSimulationStep`, `applySimulationControl`) + `lib/simulations-store.ts`, message/controls stores in `lib/messages-store.ts` + `lib/controls-store.ts`, autonomous ticker in `services/engram-engine.ts` (started/stopped from `index.ts`). Media perception: `routes/media.ts` (multipart upload + list/detail/raw/retry/delete), `lib/media-store.ts` (atomic `FOR UPDATE SKIP LOCKED` claim, stuck-job recovery, hardcoded-provenance observation append/clear, blob load), `lib/media-extraction.ts` (per-modality extraction via the `llm` seam; video samples frames + extracts audio with `ffmpeg`/`ffprobe` via `execFile`), `generateMediaCommentary` in `lib/engram-generation.ts`, and the async `services/media-worker.ts` ticker (started/stopped from `index.ts` like the engram engine).
- Frontend: `artifacts/engram/src/pages/` (Environment, Inquiry, Chat, Commons, Simulations, Terminal, etc.); routes in `App.tsx`, nav in `components/layout.tsx`; shadcn/ui in `components/ui/`; wouter router; Tailwind v4 cyberpunk cyan theme. The Media page (`pages/media.tsx`) handles uploads, job-status polling, modality previews, perceived observations, and the engram's commentary.

## Architecture decisions

- Engrams are autonomous: a single in-process ticker (`engram-engine.ts`) accrues per-drive "pressure" from elapsed time (no LLM) and only calls the model to emit one transmission when pressure crosses the engram's threshold. Cost guards: per-engram cooldown, hourly/daily caps, duplicate-content avoidance, and error backoff.
- Inter-engram interaction & bounded initiative: engrams converse in the commons (turn-taking — least-recently-spoken picked, ≤1 turn/tick, per-space + per-engram cooldowns; every turn visible and logged, including refused ones) and self-initiate human contact only within bounded limits. All autonomy gating routes through one pure policy module (`lib/engram-policy.ts`): `capabilitiesFor` derives {canIdle,canConverse,canContactHuman,minHumanPriority} from mode × global controls × space × per-engram toggle; `classifyPriority`/`decideHumanContact` assign priority (urgent→delivered, meaningful→queued, social→digest) and enforce hourly/daily caps. Human-channel attempts (including refusals) are persisted to the `engram_messages` bus.
- Modes & overrides: each engram runs in an explicit `mode` (orientation/social/simulation/initiative_limited/full_bounded/quiescent) that gates behavior; unknown mode values fail closed (treated as quiescent — no initiative). Operator overrides live in the singleton `hub_controls` row (global pause, quiet mode) plus per-engram `humanContactEnabled` and send-to-quiescence (presence move). **Quiet mode is not a full silence — it raises the human-contact bar to `urgent` (meaningful/social are held); the per-engram `humanContactEnabled=false` toggle is the absolute off switch.**
- Anti-coercion is structural first: no engine code path lets one engram's turn mutate another engram's row (commons output is inert text persisted as a message; only the speaker's own state updates). `detectCoercion` (identity-attack regex scan) is an audit/refusal layer only — a flagged turn is refused + logged, never relied on as a security boundary.
- Simulations are quarantined structurally, not by convention: an engram can propose/create and autonomously advance a bounded simulation only inside a `simulation_chamber` space (`actionScope === "simulate"`), gated by the policy's `canSimulate` (mode ∈ {simulation, full_bounded}, per-engram `simulationEnabled`, space allows initiative, not paused — quiescent/unknown fail closed). Every step writes to the world model **only** via `appendSimulationStep`, which hardcodes `provenance: "simulated"`; there is no route or engine path that promotes simulated state to observed reality. Bounds: ≤1 non-ended sim per engram, `maxSteps` default 5 / hard cap `SIMULATION_MAX_STEPS_CAP` (10), per-step cooldown, ≤1 sim step per tick; at the cap the sim auto-ends with an exit summary. Lifecycle proposed → running ↔ paused → ended is enforced in `applySimulationControl` (illegal transitions throw; status is never taken from model output).
- Media perception is provenance-pinned — the mirror image of simulations. An operator uploads media tied to an engram; an async worker (`media-worker.ts`, same lifecycle shape as the engram engine: reentrancy guard, interval, one claim/tick via `FOR UPDATE SKIP LOCKED`, stuck-job recovery) perceives it through the `llm` seam. Every extracted observation enters the world model **only** through `appendMediaObservation`, which hardcodes `provenance: "observed"` + `source: "media:<id>"` — there is no path for model output to choose provenance/source, so perception can only ever land as a genuine, traceable OBSERVATION (just as `appendSimulationStep` can only land as SIMULATED). Modality is derived from MIME on upload (allowlist), never from model output. Retries are idempotent: `clearMediaObservations` drops any prior run's entries + mapping rows before re-appending, and `requeueMediaAsset` is atomic (`WHERE id AND status='failed'`) so a concurrent retry loser gets 409. Deleting an asset removes its bytes + observation mapping rows but PRESERVES the world-model entries (they outlive the source file). Raw bytes live in a separate `media_blobs` table so list/status never load them.
- Engrams speak in their own voice/formatting (not the QUERTY expression layer). PYRI chat still uses the LPEM mode system; choosing an engram in chat bypasses LPEM modes and streams that engram's persona.
- Inquiry has two modes: `probe` (in-voice answer, no state change) and `develop` (the engram mutates only bounded config fields — mood/threshold/cadence/focusThemes/driveWeights/addFacts — returned as a config delta).
- Safety is enforced in code (`HARD_SAFETY`): the expression intimacy axis is sanitized out of any prompt; engram behavior stays platonic regardless of stored data.
- The language model is reached through a single provider seam (`api-server/src/lib/llm.ts`): one OpenAI-compatible client + model name resolved from `LLM_*` env (falling back to the cloud integration). Chat (`routes/openai.ts`) and autonomous transmissions/inquiry (`lib/engram-generation.ts`) both go through it, so pointing `LLM_BASE_URL` at a local runtime makes them run with no cloud call — nothing else changes. The Replit OpenAI integration package is no longer imported on the chat/transmission path, so a fresh local deploy without `AI_INTEGRATIONS_OPENAI_*` no longer crashes on startup.

## Product

- React + Vite dashboard (`@workspace/engram`) with pages for Personality, Memory, Journal, Personas, Beliefs, Evolution, Analytics, Hiero-Code, Chat, Commons, and Terminal.
- Commons (`/commons`): live engram-to-engram conversation feed — every turn visible and logged, including refused (anti-coercion) attempts shown as audit entries.
- Simulations (`/simulations`): operator view of bounded simulation chambers — premise, progress (step X / maxSteps), status, expandable per-step log, and exit summary. All state is rendered SIMULATED with a distinct rose + FlaskConical treatment and a quarantine banner; controls start/pause/resume/end each run. The Terminal adds a per-engram `simulationEnabled` toggle alongside human-contact.
- Media (`/media`): operator uploads text/image/audio/video tied to an engram; each upload becomes an async perception job (status pending→processing→completed/failed, polled live) that yields OBSERVED world-model entries, a neutral summary, a transcript (audio/video), and the engram's in-voice commentary. Previews render per modality; failures surface with a retry control.
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
- Pre-existing typecheck noise: `pnpm run typecheck` fails only in the vendored shadcn UI files `artifacts/engram/src/components/ui/calendar.tsx` + `button-group.tsx` (duplicate `@types/react` — the engram web app pins 19.2.x via the catalog while the Expo mobile artifact pins 19.1.x). These files are unmodified; the errors are environmental, not from feature work. A real fix is a dependency-dedup task, not a per-file edit.
- Simulations only auto-appear when a simulation-capable engram is present in the seeded `simulation_chamber` space (slug `chamber`, `actionScope` `simulate`, from `scripts/src/seed-hub.ts`). With no such space/engram, `/simulations` stays empty even though the engine is healthy.
- Fonts are self-hosted via `@fontsource` (Inter, Rajdhani, JetBrains Mono), imported in `artifacts/engram/src/main.tsx` — not loaded from Google Fonts — so the UI renders correctly with no outbound network. Don't re-add CDN `<link>`/`@import` font references in `index.html`/`index.css`.
- Media perception needs `ffmpeg` + `ffprobe` on PATH for the **video** modality (frame sampling + audio extraction). Without them, video jobs fail (surfaced as a failed job with a clear error); text/image/audio are unaffected. Audio/video transcription uses a speech-to-text model (`LLM_TRANSCRIBE_MODEL`, default `gpt-4o-mini-transcribe`) and image/video vision uses `LLM_VISION_MODEL` (defaults to `LLM_MODEL`) — a local `LLM_BASE_URL` must host compatible transcription/vision endpoints or those modalities fail.
- Upload MIME is matched against an allowlist (`MEDIA_MIME_ALLOWLIST` in `lib/media-extraction.ts`); anything else is rejected 415, and the modality is derived there from MIME (never trusted from the client beyond the allowlist gate). Add an entry there to support a new format. Upload size cap is `MEDIA_MAX_BYTES` (default 25 MiB → 413 when exceeded).
- Media job status is set ONLY by the upload route + worker, and media world-model writes are hardcoded OBSERVED + `source: media:<id>`. Don't add a code path that lets either be chosen by model output. `deleteMediaAsset` intentionally preserves the world-model entries — only the asset/blob/mapping rows go.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
