export type ChatErrorCode =
  | "auth_invalid"
  | "endpoint_unreachable"
  | "timeout"
  | "model_not_found"
  | "rate_limited"
  | "malformed_response"
  | "provider_error";

export interface ChatErrorDetails {
  code: ChatErrorCode;
  message: string;
  debug: string;
}

interface OpenAiLikeError {
  status?: number;
  message?: string;
  code?: string;
}

function sanitizeDebug(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "******")
    .replace(/sk-[A-Za-z0-9_-]+/gi, "sk-[REDACTED]")
    .trim();
}

function toOpenAiLikeError(error: unknown): OpenAiLikeError {
  if (!error || typeof error !== "object") return {};
  const candidate = error as Record<string, unknown>;
  return {
    status:
      typeof candidate.status === "number" ? candidate.status : undefined,
    message:
      typeof candidate.message === "string" ? candidate.message : undefined,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
  };
}

export function mapChatError(error: unknown): ChatErrorDetails {
  const err = toOpenAiLikeError(error);
  const msg = (err.message ?? String(error ?? "unknown error")).toLowerCase();

  if (err.status === 401 || err.status === 403 || msg.includes("api key")) {
    return {
      code: "auth_invalid",
      message: "Authentication failed. Check your API key.",
      debug: sanitizeDebug(err.message ?? String(error)),
    };
  }
  if (err.status === 404 || msg.includes("model") && msg.includes("not found")) {
    return {
      code: "model_not_found",
      message: "Model not found for this provider.",
      debug: sanitizeDebug(err.message ?? String(error)),
    };
  }
  if (err.status === 429 || msg.includes("rate limit")) {
    return {
      code: "rate_limited",
      message: "Rate limited by provider. Please retry shortly.",
      debug: sanitizeDebug(err.message ?? String(error)),
    };
  }
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("aborterror")
  ) {
    return {
      code: "timeout",
      message: "The request timed out. Please try again.",
      debug: sanitizeDebug(err.message ?? String(error)),
    };
  }
  if (
    msg.includes("fetch failed") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("network")
  ) {
    return {
      code: "endpoint_unreachable",
      message: "Could not reach the provider endpoint.",
      debug: sanitizeDebug(err.message ?? String(error)),
    };
  }
  if (msg.includes("invalid json") || msg.includes("unexpected token")) {
    return {
      code: "malformed_response",
      message: "Received an invalid response from the provider.",
      debug: sanitizeDebug(err.message ?? String(error)),
    };
  }
  return {
    code: "provider_error",
    message: "Provider request failed.",
    debug: sanitizeDebug(err.message ?? String(error)),
  };
}

