import { describe, expect, it } from "vitest";
import { listWebStreamApiIds } from "../streams/web-stream-factories.js";
import {
  WEB_CONTEXT_WINDOW_TOKENS,
  WEB_DEFAULT_MODEL_IDS,
  listOpenAiWebModels,
  parseWebModelRef,
} from "./models.js";

describe("eve web model refs", () => {
  it("covers every web stream api", () => {
    const ids = listWebStreamApiIds();
    expect(Object.keys(WEB_DEFAULT_MODEL_IDS).toSorted()).toEqual(ids.slice().toSorted());
    expect(Object.keys(WEB_CONTEXT_WINDOW_TOKENS).toSorted()).toEqual(ids.slice().toSorted());
  });

  it("parses provider-only and provider/model refs", () => {
    expect(parseWebModelRef("claude-web")).toEqual({
      api: "claude-web",
      modelId: WEB_DEFAULT_MODEL_IDS["claude-web"],
      ref: `claude-web/${WEB_DEFAULT_MODEL_IDS["claude-web"]}`,
    });
    expect(parseWebModelRef("claude-web/claude-opus-4-6")).toEqual({
      api: "claude-web",
      modelId: "claude-opus-4-6",
      ref: "claude-web/claude-opus-4-6",
    });
  });

  it("rejects unknown and empty refs", () => {
    expect(parseWebModelRef("")).toBeNull();
    expect(parseWebModelRef("openai/gpt-4")).toBeNull();
    expect(parseWebModelRef("openclaw:main")).toBeNull();
  });

  it("lists both shorthand and fully-qualified OpenAI model ids", () => {
    const ids = listOpenAiWebModels(0).map((item) => item.id);
    expect(ids).toContain("claude-web");
    expect(ids).toContain(`claude-web/${WEB_DEFAULT_MODEL_IDS["claude-web"]}`);
    expect(ids).toContain("deepseek-web");
  });
});
