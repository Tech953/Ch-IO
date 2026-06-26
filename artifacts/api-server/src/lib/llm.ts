import OpenAI from "openai";

/**
 * Provider seam for the language model.
 *
 * The whole app talks to the model through this single OpenAI-compatible client,
 * so it can target either the cloud proxy or a fully local runtime
 * (Ollama, LM Studio, llama.cpp, vLLM) by changing configuration only — no code
 * changes required anywhere else.
 *
 * Resolution order (first defined wins):
 *   - LLM_BASE_URL / LLM_API_KEY / LLM_MODEL            (explicit; e.g. local)
 *   - AI_INTEGRATIONS_OPENAI_BASE_URL / ..._API_KEY     (Replit cloud default)
 */
const baseURL =
  process.env.LLM_BASE_URL ?? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

// Local OpenAI-compatible servers usually ignore the key but the SDK requires a
// non-empty string, so fall back to a harmless placeholder.
const apiKey =
  process.env.LLM_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "local";

/** Chat/completions model name. Override with LLM_MODEL to use a local model. */
export const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-5.4";

if (!baseURL) {
  throw new Error(
    "No language-model endpoint configured. Set LLM_BASE_URL (e.g. " +
      "http://localhost:11434/v1 for a local OpenAI-compatible server) or " +
      "AI_INTEGRATIONS_OPENAI_BASE_URL (Replit cloud integration).",
  );
}

/**
 * Shared OpenAI-compatible client. Defaults to the cloud endpoint; set
 * LLM_BASE_URL to point it at a local runtime for fully offline operation.
 */
export const llm = new OpenAI({ apiKey, baseURL });
