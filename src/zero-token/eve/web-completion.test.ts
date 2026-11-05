import { describe, expect, it } from "vitest";
import { OpenAiCompatError } from "./openai-compat.js";
import {
  buildNonStreamingCompletion,
  collectWebCompletion,
  iterateWebCompletion,
  streamWebCompletionSse,
} from "./web-completion.js";

async function* fakeStream() {
  yield { type: "text_delta", delta: "Hel" };
  yield { type: "text_delta", delta: "lo" };
}

describe("iterateWebCompletion", () => {
  it("streams deltas from a web factory", async () => {
    const events = [];
    for await (const event of iterateWebCompletion(
      {
        model: "claude-web",
        messages: [{ role: "user", content: "hi" }],
        systemPrompt: "",
        stream: true,
      },
      {
        getFactory: () => () => fakeStream as never,
        resolveCredential: () => "cookie",
      },
    )) {
      events.push(event);
    }
    expect(events).toEqual([
      { type: "delta", text: "Hel" },
      { type: "delta", text: "lo" },
      { type: "done", content: "Hello" },
    ]);
  });

  it("rejects unknown models and missing credentials", async () => {
    await expect(async () => {
      for await (const _event of iterateWebCompletion(
        {
          model: "openai/gpt-4",
          messages: [{ role: "user", content: "hi" }],
          systemPrompt: "",
          stream: false,
        },
        { getFactory: () => undefined, resolveCredential: () => "x" },
      )) {
        // drain
      }
    }).rejects.toMatchObject({ status: 400, code: "invalid_request_error" });

    await expect(async () => {
      for await (const _event of iterateWebCompletion(
        {
          model: "claude-web",
          messages: [{ role: "user", content: "hi" }],
          systemPrompt: "",
          stream: false,
        },
        {
          getFactory: () => () => fakeStream as never,
          resolveCredential: () => null,
        },
      )) {
        // drain
      }
    }).rejects.toBeInstanceOf(OpenAiCompatError);
  });
});

describe("collect and SSE", () => {
  const deps = {
    getFactory: () => () => fakeStream as never,
    resolveCredential: () => "cookie",
    now: () => 1_700_000_000_000,
    random: () => 0.5,
  };

  it("collects a full completion", async () => {
    await expect(
      collectWebCompletion(
        {
          model: "claude-web/claude-sonnet-4-6",
          messages: [{ role: "user", content: "hi" }],
          systemPrompt: "",
          stream: false,
        },
        deps,
      ),
    ).resolves.toEqual({
      model: "claude-web/claude-sonnet-4-6",
      content: "Hello",
    });
  });

  it("emits OpenAI SSE chunks and [DONE]", async () => {
    const chunks: string[] = [];
    for await (const chunk of streamWebCompletionSse(
      {
        model: "deepseek-web",
        messages: [{ role: "user", content: "hi" }],
        systemPrompt: "",
        stream: true,
      },
      deps,
    )) {
      chunks.push(chunk);
    }
    expect(chunks.at(0)).toContain('"role":"assistant"');
    expect(chunks.some((chunk) => chunk.includes('"content":"Hel"'))).toBe(true);
    expect(chunks.at(-1)).toBe("data: [DONE]\n\n");
  });

  it("builds a non-streaming envelope", () => {
    const payload = buildNonStreamingCompletion(
      {
        model: "kimi-web",
        messages: [{ role: "user", content: "hi" }],
        systemPrompt: "",
        stream: false,
      },
      "ok",
      deps,
    );
    expect(payload.object).toBe("chat.completion");
    expect((payload.choices as Array<{ message: { content: string } }>)[0]?.message.content).toBe(
      "ok",
    );
  });
});
