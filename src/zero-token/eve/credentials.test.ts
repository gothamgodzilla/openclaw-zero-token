import { describe, expect, it } from "vitest";
import { credentialFromProfile, resolveWebProviderCredential } from "./credentials.js";

describe("eve web credentials", () => {
  it("reads api_key, token, and oauth profiles", () => {
    expect(credentialFromProfile({ type: "api_key", provider: "claude-web", key: "cookie" })).toBe(
      "cookie",
    );
    expect(credentialFromProfile({ type: "token", provider: "chatgpt-web", token: "tok" })).toBe(
      "tok",
    );
    const oauth = resolveWebProviderCredential("claude-web", {
      version: 1,
      profiles: {
        "claude-web:default": {
          type: "oauth",
          provider: "claude-web",
          access: "a",
          refresh: "r",
          expires: 1,
        },
      },
      order: {},
    });
    expect(oauth).toContain('"access":"a"');
  });

  it("returns null when the provider has no usable profile", () => {
    expect(
      resolveWebProviderCredential("claude-web", {
        version: 1,
        profiles: {
          "deepseek-web:default": { type: "api_key", provider: "deepseek-web", key: "x" },
        },
        order: {},
      }),
    ).toBeNull();
  });
});
