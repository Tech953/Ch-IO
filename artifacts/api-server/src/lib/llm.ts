import OpenAI from "openai";

/**
 * Multi-provider LLM client — offline-first, free-online fallback.
 *
 * Resolution order (first fully-configured wins):
 *   1. Ollama local           LLM_PROVIDER=ollama  (default)  http://localhost:11434/v1
 *   2. LM Studio local        LLM_PROVIDER=lmstudio           http://localhost:1234/v1
 *   3. llama.cpp / vLLM       LLM_PROVIDER=llamacpp           LLM_BASE_URL (custom)
 *   4. Groq (free tier)       LLM_PROVIDER=groq               GROQ_API_KEY
 *   5. OpenRouter (free)      LLM_PROVIDER=openrouter         OPENROUTER_API_KEY
 *   6. HuggingFace (free)     LLM_PROVIDER=huggingface        HUGGINGFACE_API_KEY
 *   7. Explicit override      LLM_BASE_URL + LLM_API_KEY      (any OpenAI-compat server)
 *   8. Replit/cloud proxy     AI_INTEGRATIONS_OPENAI_BASE_URL (legacy)
 *
 * All providers expose an OpenAI-compatible /chat/completions endpoint,
 * so the rest of the codebase requires zero changes.
 */

export type LLMProvider =
  | "ollama"
  | "lmstudio"
  | "llamacpp"
  | "groq"
  | "openrouter"
  | "huggingface"
  | "custom"
  | "replit";

interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
}

const PROVIDER_DEFAULTS: Record<string, ProviderConfig> = {
  ollama:      { baseURL: "http://localhost:11434/v1",                         apiKey: "local",    defaultModel: "llama3.1" },
  lmstudio:    { baseURL: "http://localhost:1234/v1",                          apiKey: "local",    defaultModel: "local-model" },
  llamacpp:    { baseURL: process.env.LLM_BASE_URL ?? "http://localhost:8080/v1", apiKey: "local", defaultModel: "local-model" },
  groq:        { baseURL: "https://api.groq.com/openai/v1",                   apiKey: process.env.GROQ_API_KEY ?? "", defaultModel: "llama-3.3-70b-versatile" },
  openrouter:  { baseURL: "https://openrouter.ai/api/v1",                     apiKey: process.env.OPENROUTER_API_KEY ?? "", defaultModel: "meta-llama/llama-3.1-8b-instruct:free" },
  huggingface: { baseURL: "https://api-inference.huggingface.co/v1",          apiKey: process.env.HUGGINGFACE_API_KEY ?? "", defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct" },
};

function resolveProvider(): { config: ProviderConfig; provider: LLMProvider } {
  const explicit = process.env.LLM_PROVIDER as LLMProvider | undefined;

  // Explicit provider selection
  if (explicit && explicit in PROVIDER_DEFAULTS) {
    return { config: PROVIDER_DEFAULTS[explicit], provider: explicit };
  }

  // Explicit base URL override (custom server or legacy Replit integration)
  const customBase = process.env.LLM_BASE_URL ?? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (customBase) {
    return {
      provider: "custom",
      config: {
        baseURL: customBase,
        apiKey: process.env.LLM_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "local",
        defaultModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
      },
    };
  }

  // Auto-detect: prefer Ollama (offline-first)
  return { config: PROVIDER_DEFAULTS.ollama, provider: "ollama" };
}

const { config, provider } = resolveProvider();

/** Chat/completions model. Override with LLM_MODEL env var. */
export const LLM_MODEL = process.env.LLM_MODEL ?? config.defaultModel;

/** Active provider name — useful for logging / health endpoint. */
export const LLM_PROVIDER: LLMProvider = provider;

if (!config.baseURL) {
  throw new Error(
    `LLM provider "${provider}" has no base URL. ` +
    `Set LLM_BASE_URL or configure a supported provider via LLM_PROVIDER.`
  );
}

if (!config.apiKey) {
  throw new Error(
    `LLM provider "${provider}" requires an API key. ` +
    `Set the corresponding key env var (e.g. GROQ_API_KEY, OPENROUTER_API_KEY).`
  );
}

/**
 * Shared OpenAI-compatible LLM client.
 * Offline (Ollama/LM Studio/llama.cpp) or free-online (Groq/OpenRouter/HuggingFace).
 * No paid API credits required for any default configuration.
 */
export const llm = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });

/** Expose resolved config for health/status endpoints. */
export const llmProviderInfo = {
  provider,
  baseURL: config.baseURL,
  model: LLM_MODEL,
  requiresKey: !["ollama", "lmstudio", "llamacpp", "custom"].includes(provider),
};
