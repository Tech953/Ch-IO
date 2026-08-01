import { describe, expect, it, vi } from "vitest";
import {
  isValidBaseUrl,
  normalizeBaseUrl,
  testOnlineConnection,
  validateConnectionSettings,
} from "./settings-config";

describe("settings-config", () => {
  it("normalizes trailing slashes in base URLs", () => {
    expect(normalizeBaseUrl(" https://api.openai.com/v1/ ")).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("validates base URL protocol", () => {
    expect(isValidBaseUrl("https://api.openai.com/v1")).toBe(true);
    expect(isValidBaseUrl("file:///tmp/test")).toBe(false);
  });

  it("requires API key in online mode", () => {
    expect(
      validateConnectionSettings({
        mode: "online",
        offline: { baseUrl: "http://localhost:11434/v1", model: "llama3.1" },
        online: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
        hasOnlineApiKey: false,
      }),
    ).toBe("settings.validation.onlineApiKey");
  });

  it("passes online connection test when the endpoint is reachable", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 } as Response));
    await expect(
      testOnlineConnection("https://api.openai.com/v1/", "test-key", fetchImpl),
    ).resolves.toBeUndefined();
  });
});
