import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { createEveBridgeHttpHandler } from "./http.js";

type MockResponse = ServerResponse & {
  body?: string;
  chunks: string[];
};

function createMockResponse(): MockResponse {
  const headers: Record<string, string> = {};
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined as string | undefined,
    chunks: [] as string[],
    setHeader(key: string, value: string) {
      headers[key.toLowerCase()] = value;
      return res;
    },
    getHeader(key: string) {
      return headers[key.toLowerCase()];
    },
    write(chunk: string) {
      res.chunks.push(chunk);
      return true;
    },
    end(body?: string) {
      res.headersSent = true;
      if (body !== undefined) {
        res.body = body;
      }
      return res;
    },
  };
  return res as unknown as MockResponse;
}

function createMockRequest(params: {
  method: string;
  url: string;
  chunks?: string[];
}): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = params.method;
  req.url = params.url;
  req.headers = { "content-type": "application/json" };
  if (params.chunks) {
    void Promise.resolve().then(() => {
      for (const chunk of params.chunks ?? []) {
        req.emit("data", Buffer.from(chunk, "utf-8"));
      }
      req.emit("end");
    });
  }
  return req;
}

async function* fakeStream() {
  yield { type: "text_delta", delta: "pong" };
}

describe("eve-bridge HTTP routes", () => {
  const handler = createEveBridgeHttpHandler({
    getFactory: () => () => fakeStream as never,
    resolveCredential: () => "cookie",
    now: () => 1_700_000_000_000,
    random: () => 0.25,
  });

  it("lists web models", async () => {
    const res = createMockResponse();
    const handled = await handler(
      createMockRequest({ method: "GET", url: "/zero-token/v1/models" }),
      res,
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body ?? "{}") as {
      data: Array<{ id: string }>;
    };
    expect(payload.data.map((item) => item.id)).toContain("claude-web");
  });

  it("returns a non-streaming chat completion", async () => {
    const res = createMockResponse();
    const handled = await handler(
      createMockRequest({
        method: "POST",
        url: "/zero-token/v1/chat/completions",
        chunks: [
          JSON.stringify({
            model: "claude-web",
            messages: [{ role: "user", content: "hi" }],
          }),
        ],
      }),
      res,
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body ?? "{}") as {
      choices: Array<{ message: { content: string } }>;
    };
    expect(payload.choices[0]?.message.content).toBe("pong");
  });

  it("streams SSE chunks", async () => {
    const res = createMockResponse();
    const handled = await handler(
      createMockRequest({
        method: "POST",
        url: "/zero-token/v1/chat/completions",
        chunks: [
          JSON.stringify({
            model: "deepseek-web",
            stream: true,
            messages: [{ role: "user", content: "hi" }],
          }),
        ],
      }),
      res,
    );
    expect(handled).toBe(true);
    expect(res.getHeader("content-type")).toContain("text/event-stream");
    expect(res.chunks.join("")).toContain('"content":"pong"');
    expect(res.chunks.at(-1)).toBe("data: [DONE]\n\n");
  });

  it("rejects unknown models with an OpenAI error envelope", async () => {
    const res = createMockResponse();
    await handler(
      createMockRequest({
        method: "POST",
        url: "/zero-token/v1/chat/completions",
        chunks: [
          JSON.stringify({
            model: "openai/gpt-4",
            messages: [{ role: "user", content: "hi" }],
          }),
        ],
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      error: { type: "invalid_request_error" },
    });
  });

  it("ignores unrelated paths", async () => {
    const res = createMockResponse();
    await expect(
      handler(createMockRequest({ method: "GET", url: "/v1/models" }), res),
    ).resolves.toBe(false);
  });
});
