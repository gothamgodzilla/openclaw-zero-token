import { describe, expect, it } from "vitest";
import {
  OpenAiCompatError,
  buildChatCompletion,
  buildOpenAiError,
  encodeSseData,
  parseChatCompletionRequest,
} from "./openai-compat.js";

describe("parseChatCompletionRequest", () => {
  it("extracts system prompts and flattens multipart content", () => {
    const parsed = parseChatCompletionRequest({
      model: "claude-web",
      stream: true,
      user: "eve-session-1",
      messages: [
        { role: "system", content: "Be brief." },
        { role: "system", content: "Stay in English." },
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            { type: "text", text: "world" },
          ],
        },
      ],
    });
    expect(parsed).toEqual({
      model: "claude-web",
      stream: true,
      user: "eve-session-1",
      systemPrompt: "Be brief.\n\nStay in English.",
      messages: [{ role: "user", content: "Hello\nworld" }],
    });
  });

  it("rejects missing model or empty conversation", () => {
    expect(() => parseChatCompletionRequest({})).toThrow(OpenAiCompatError);
    expect(() => parseChatCompletionRequest({ model: "claude-web", messages: [] })).toThrow(
      /messages must be a non-empty array/,
    );
    expect(() =>
      parseChatCompletionRequest({
        model: "claude-web",
        messages: [{ role: "system", content: "only system" }],
      }),
    ).toThrow(/user or assistant/);
  });
});

describe("openai payload helpers", () => {
  it("encodes SSE data lines", () => {
    expect(encodeSseData({ ok: true })).toBe('data: {"ok":true}\n\n');
  });

  it("builds a non-streaming completion envelope", () => {
    expect(
      buildChatCompletion({
        id: "chatcmpl-1",
        created: 1,
        model: "claude-web/claude-sonnet-4-6",
        content: "hi",
      }),
    ).toMatchObject({
      object: "chat.completion",
      choices: [{ message: { role: "assistant", content: "hi" }, finish_reason: "stop" }],
    });
  });

  it("builds an OpenAI error envelope", () => {
    expect(buildOpenAiError(401, "authentication_error", "missing")).toEqual({
      status: 401,
      body: {
        error: { message: "missing", type: "authentication_error", code: "authentication_error" },
      },
    });
  });
});
