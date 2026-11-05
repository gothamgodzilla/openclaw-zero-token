import { describe, expect, it } from "vitest";
import { requirePineconeApiKey, resolveDefaultAssistant, resolvePineconeApiKey } from "./config.js";

describe("pinecone assistant config", () => {
  it("prefers plugin config over env", () => {
    expect(
      resolvePineconeApiKey({
        pluginConfig: { apiKey: " from-config " },
        env: { PINECONE_API_KEY: "from-env" },
      }),
    ).toBe("from-config");
  });

  it("falls back to PINECONE_API_KEY", () => {
    expect(resolvePineconeApiKey({ env: { PINECONE_API_KEY: "env-key" } })).toBe("env-key");
  });

  it("throws 503 when no key is configured", () => {
    expect(() => requirePineconeApiKey({ env: {} })).toThrow(/PINECONE_API_KEY/);
  });

  it("resolves the default assistant name", () => {
    expect(
      resolveDefaultAssistant({
        pluginConfig: { defaultAssistant: "docs-qa" },
        env: { PINECONE_ASSISTANT: "other" },
      }),
    ).toBe("docs-qa");
  });
});
