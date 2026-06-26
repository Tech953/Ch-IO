# ENGRAM — PYRI AI Persona Framework

ENGRAM is a full-stack dashboard for **PYRI**, an AI companion built on a fictional
cognitive architecture: layered memory, a belief registry, personas, a symbolic
Hiero-Code language, an emotive micro-expression layer, autonomous engrams, bounded
simulations, media perception, and a multi-mode streaming chat.

It runs two ways:

- **Fully local / offline** — one command builds and runs the whole app (dashboard
  + API) on a single port, backed by a local PostgreSQL database and a local
  language model. After the one-time install, it needs no internet.
- **On Replit** — the API and the dashboard run as separate workflows/artifacts
  (unchanged by the local packaging below).

---

## Run fully local (one command)

> The first run performs one-time setup automatically: it checks prerequisites,
> creates `.env`, installs dependencies, creates the database schema, and seeds
> reference data. Subsequent runs just build and start.

**Linux / macOS**

```bash
./scripts/local/start.sh
```

**Windows (PowerShell)**

```powershell
.\scripts\local\start.ps1
```

Windows users can also double-click `scripts\local\start.bat`.

Then open **http://localhost:5000**. The API serves the dashboard and the
`/api` endpoints on the same port, so there is nothing else to start.

To run the one-time setup by itself (without launching), use the matching
`setup.sh` / `setup.ps1` (or `setup.bat`).

---

## Prerequisites

- **Node.js 24** and **pnpm** (`npm install -g pnpm`).
- A local **PostgreSQL** database. Create one first, e.g. `createdb engram`.
- For offline language features, a local **OpenAI-compatible model runtime**:
  - [Ollama](https://ollama.com) — `http://localhost:11434/v1`
  - [LM Studio](https://lmstudio.ai) — `http://localhost:1234/v1`
  - or any `llama.cpp` / vLLM server exposing the OpenAI API.
- **Optional:** `ffmpeg` + `ffprobe` on your `PATH` — only needed for the **video**
  media modality. Text, image, and audio perception work without them.

> The initial `pnpm install` and the model download need internet **once**. After
> that, the app runs with no outbound network: fonts are self-hosted, the frontend
> talks to the local API, and the API talks to your local model.

---

## Configuration (`.env`)

Setup copies `.env.example` to `.env` on first run. Edit `.env` to match your
machine:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | **Required.** Local PostgreSQL connection string. |
| `PORT` | Port the unified local server listens on (default `5000`). |
| `LLM_BASE_URL` | OpenAI-compatible endpoint — point it at your local model. |
| `LLM_MODEL` | Model name your local server hosts (e.g. `llama3.1`). |
| `LLM_API_KEY` | Any non-empty value for local servers. |
| `LLM_VISION_MODEL` | *Optional.* Vision model for image/video (defaults to `LLM_MODEL`). |
| `LLM_TRANSCRIBE_MODEL` | *Optional.* Speech-to-text model for audio/video. |

`WEB_DIST` (the path to the built dashboard) is set automatically by the start
scripts — you don't need to configure it.

### Pointing at a local model

```bash
# Example: Ollama
ollama pull llama3.1
# In .env:
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1
LLM_API_KEY=local
```

With this set, both interactive chat and autonomous transmissions run entirely
against the local model — no code changes required.

---

## What works offline

| Feature | Needs a model? | Notes |
| --- | --- | --- |
| Dashboard, Hub, Memory, Beliefs, Analytics, etc. | No | Read/write the local DB. |
| Simulations & Commons | No (engine) / Yes (generated steps) | The engine runs locally; step text needs the model. |
| Chat & autonomous transmissions | Yes | Need a local chat model running. |
| Image / video understanding | Yes (vision) | Needs a vision-capable model (`LLM_VISION_MODEL`). |
| Audio / video transcription | Yes (speech-to-text) | Needs a transcription model (`LLM_TRANSCRIBE_MODEL`). |
| **Video** media perception | Yes | Also needs `ffmpeg` + `ffprobe` on `PATH`. |

If the model server isn't running, the dashboard still loads and the database
features work; only the language/perception features error until the model is up.

---

## Development mode (separate servers, live reload)

For working on the code with hot reload, run the two dev servers instead of the
bundled single-port build:

```bash
pnpm install
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/engram
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed:expressions
pnpm --filter @workspace/scripts run seed:engrams
pnpm --filter @workspace/scripts run seed:hub
# then, in two terminals:
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/engram run dev
```

---

## Project structure

```
artifacts/engram        # React + Vite dashboard (the UI)
artifacts/api-server    # Express API + autonomy/media engines (serves the UI in local mode)
artifacts/engram-mobile # Expo mobile app
lib/api-spec            # OpenAPI source of truth
lib/api-zod             # generated Zod schemas
lib/api-client-react    # generated React Query hooks
lib/db                  # Drizzle schema + client
scripts                 # seed + utility scripts, doc generator
scripts/local           # cross-platform setup/start scripts (this offline package)
docs                    # generated PDFs (proposal, developer guide, readme, user manual)
```

## Common commands

| Task | Command |
| --- | --- |
| Run fully local | `./scripts/local/start.sh` (Windows: `.\scripts\local\start.ps1`) |
| Typecheck | `pnpm run typecheck` |
| Build everything | `pnpm run build` |
| Regenerate API artifacts | `pnpm --filter @workspace/api-spec run codegen` |
| Push DB schema | `pnpm --filter @workspace/db run push` |
| Seed reference data | `pnpm --filter @workspace/scripts run seed:expressions` / `seed:engrams` / `seed:hub` |
| Regenerate docs (PDFs) | `node scripts/gen/generate-docs.mjs` |

## Troubleshooting

- **Server won't start, "No language-model endpoint configured."** Set
  `LLM_BASE_URL` in `.env` (e.g. the Ollama URL above).
- **`db push` fails.** Make sure PostgreSQL is running and `DATABASE_URL` is
  correct, and that the database exists (`createdb engram`).
- **Dashboard loads but chat errors.** Your local model server isn't running or
  `LLM_MODEL` isn't a model it hosts.
- **Video media jobs fail.** Install `ffmpeg` + `ffprobe`; other modalities are
  unaffected.
- **Empty pages after a fresh DB.** Run the seed scripts (the start script does
  this on first run).

## Documentation

Full PDFs live in [`docs/`](docs): the Proposal, Developer Guide, README, and User
Manual. Regenerate them after editing the sources in `scripts/gen/content/` with
`node scripts/gen/generate-docs.mjs`.

## License

Add your chosen license here. Until a license is specified, treat this code as
proprietary to the project owner.
