import { describe, expect, it } from "vitest";
import { mapChatError } from "./chat-errors";

describe("mapChatError", () => {
  it("maps auth failures", () => {
    expect(mapChatError({ status: 401, message: "Unauthorized" }).code).toBe(
      "auth_invalid",
    );
  });

  it("maps model not found failures", () => {
    expect(
      mapChatError({ status: 404, message: "The model `x` was not found" }).code,
    ).toBe("model_not_found");
  });

  it("maps rate limits", () => {
    expect(
      mapChatError({ status: 429, message: "rate limit exceeded" }).code,
    ).toBe("rate_limited");
  });

  it("maps network errors", () => {
    expect(mapChatError(new Error("fetch failed: ECONNREFUSED")).code).toBe(
      "endpoint_unreachable",
    );
  });

  it("redacts probable API keys from debug payload", () => {
    const details = mapChatError(
      new Error("sk-abc123 secret was rejected"),
    );
    expect(details.debug).not.toContain("sk-abc123");
    expect(details.debug).toContain("sk-[REDACTED]");
  });
});
