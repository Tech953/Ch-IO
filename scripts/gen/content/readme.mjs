export function README(h) {
  const { H1, H2, LEAD, P, UL, CODE, KV, NOTE, WARN } = h;
  const meta = {
    title: "ENGRAM README",
    docType: "Readme",
    subtitle:
      "Quick-start reference for the ENGRAM / PYRI AI persona framework.",
    version: "1.0",
    tag: "Project Readme",
    file: "03_ENGRAM_README.pdf",
    foot: "A condensed reference. See the Developer Guide for architecture details.",
  };

  const blocks = [
    H1("Overview"),
    LEAD(
      "ENGRAM is a full-stack dashboard for PYRI, an AI companion built on a fictional cognitive architecture: layered memory, a belief registry, personas, a symbolic Hiero-Code language, an emotive micro-expression layer, and a multi-mode streaming chat. Personas can also act autonomously, initiating their own messages over time.",
    ),

    H1("Features"),
    UL([
      { h: "Layered memory", t: "semantic, working, episodic, preference, reflective, and procedural layers." },
      { h: "Belief registry", t: "revisable, evidence-scored hypotheses with counterarguments and revisions." },
      { h: "Personas", t: "cognitive forms that reshape retrieval, reasoning, and tone." },
      { h: "Hiero-Code", t: "a symbolic glyph language with a compound-expression builder." },
      { h: "Emotive Expression Layer", t: "ASCII micro-expressions mapped to valence and arousal, woven into chat." },
      { h: "Autonomy engine", t: "personas accrue drive pressure over time and self-initiate transmissions, with strict cost caps." },
      { h: "Multi-mode chat", t: "seven modes, streaming responses, custom persona upload, and persisted conversations." },
      { h: "Provider-agnostic", t: "swap between a hosted model and a fully local/offline model via configuration." },
      { h: "Responsive UI", t: "usable on desktop and Android phones without losing the cyberpunk aesthetic." },
    ]),

    H1("Tech Stack"),
    KV([
      ["Workspace", "pnpm workspaces, Node.js 24, TypeScript 5.9"],
      ["API", "Express 5"],
      ["Database", "PostgreSQL + Drizzle ORM"],
      ["Validation", "Zod (zod/v4) + drizzle-zod"],
      ["API codegen", "Orval (from the OpenAPI spec)"],
      ["Frontend", "React + Vite, Tailwind v4, shadcn/ui, wouter, TanStack Query"],
    ]),

    H1("Prerequisites"),
    UL([
      "Node.js 24 and pnpm.",
      "A local PostgreSQL database (connection string in DATABASE_URL).",
      "For fully offline use: a local OpenAI-compatible model runtime (Ollama, LM Studio, llama.cpp, or vLLM).",
      "Optional: ffmpeg + ffprobe on PATH for the video media modality (text, image, and audio work without them).",
    ]),

    H1("Quick Start"),
    H2("Option A — Run fully local on one port (recommended)"),
    P(
      "One command builds the dashboard and the API and runs them together on a single port (default http://localhost:5000), with the API serving the built dashboard. The first run also installs dependencies, creates the database schema, and seeds reference data.",
    ),
    CODE([
      "# Linux / macOS",
      "./scripts/local/start.sh",
      "",
      "# Windows (PowerShell)",
      ".\\scripts\\local\\start.ps1",
    ]),
    P(
      "Windows users can also double-click scripts\\local\\start.bat. Run the one-time setup on its own with the matching setup.sh / setup.ps1. Configuration lives in .env (copied from .env.example on first run) — point DATABASE_URL at your local Postgres and LLM_BASE_URL at your local model.",
    ),
    H2("Option B — Development (separate servers, live reload)"),
    P("1. Install dependencies from the repo root:"),
    CODE("pnpm install"),
    P("2. Provide configuration (at minimum a database URL):"),
    CODE([
      "export DATABASE_URL=postgres://user:pass@host:5432/engram",
      "# optional: target a local model",
      "export LLM_BASE_URL=http://localhost:11434/v1",
      "export LLM_MODEL=llama3.1",
      "export LLM_API_KEY=local",
    ]),
    P("3. Create the schema and seed reference data:"),
    CODE([
      "pnpm --filter @workspace/db run push",
      "pnpm --filter @workspace/scripts run seed:expressions",
      "pnpm --filter @workspace/scripts run seed:engrams",
      "pnpm --filter @workspace/scripts run seed:hub",
    ]),
    P("4. Run the API and the dashboard:"),
    CODE([
      "pnpm --filter @workspace/api-server run dev",
      "pnpm --filter @workspace/engram run dev",
    ]),

    H1("Configuration"),
    KV([
      ["DATABASE_URL", "Required. PostgreSQL connection string."],
      ["PORT", "Port the server listens on (default 5000 in local mode)."],
      ["LLM_BASE_URL", "OpenAI-compatible endpoint; set it to a local server for offline use."],
      ["LLM_API_KEY", "Endpoint key; local servers accept any non-empty value."],
      ["LLM_MODEL", "Model name. Set it to an installed local model when running offline."],
      ["LLM_VISION_MODEL / LLM_TRANSCRIBE_MODEL", "Optional models for image/video vision and audio/video transcription."],
      ["WEB_DIST", "Optional. Absolute path to the built dashboard (artifacts/engram/dist/public). When set, the API also serves the dashboard for single-port local runs; set automatically by the local start scripts."],
      ["AI_INTEGRATIONS_OPENAI_*", "Optional cloud fallback used when LLM_* is unset."],
    ]),
    NOTE(
      "Leave the LLM_* variables unset to use the hosted model, or set them to point at any local OpenAI-compatible server for fully offline operation. No code changes are required either way.",
    ),

    H1("Project Structure"),
    CODE([
      "artifacts/engram        # React + Vite dashboard",
      "artifacts/api-server    # Express API + autonomy engine",
      "lib/api-spec            # OpenAPI source of truth",
      "lib/api-zod             # generated Zod schemas",
      "lib/api-client-react    # generated React Query hooks",
      "lib/db                  # Drizzle schema + client",
      "scripts                 # seed + utility scripts",
    ]),

    H1("Common Commands"),
    KV([
      ["Run fully local (one port)", "./scripts/local/start.sh   (Windows: .\\scripts\\local\\start.ps1)"],
      ["Typecheck", "pnpm run typecheck"],
      ["Build", "pnpm run build"],
      ["Regenerate API", "pnpm --filter @workspace/api-spec run codegen"],
      ["Push schema", "pnpm --filter @workspace/db run push"],
      ["Seed expressions", "pnpm --filter @workspace/scripts run seed:expressions"],
      ["Seed engrams", "pnpm --filter @workspace/scripts run seed:engrams"],
      ["Seed hub / spaces", "pnpm --filter @workspace/scripts run seed:hub"],
    ]),

    H1("Notes & Gotchas"),
    UL([
      "A fresh schema push does not seed data — run the seed scripts (they are idempotent). The local start script seeds on first run.",
      "Re-run codegen after editing the OpenAPI spec; push after schema changes.",
      "Fonts are self-hosted via @fontsource — do not re-add CDN font references.",
      "The persona expression intimacy axis is sanitized before reaching the model; behavior stays platonic.",
      "Do not run pnpm dev at the workspace root; run individual packages, the local start script, or platform workflows.",
      "Video media perception needs ffmpeg + ffprobe on PATH; without them, video jobs fail (text/image/audio still work).",
      "Image/video understanding and audio/video transcription need a model that supports vision and speech-to-text; a text-only local model still handles chat and transmissions.",
    ]),

    H1("License"),
    P(
      "Add your chosen license here. Until a license is specified, treat this code as proprietary to the project owner.",
    ),
  ];

  return { meta, blocks };
}
