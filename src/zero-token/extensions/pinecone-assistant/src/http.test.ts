import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { PineconeAssistantClient } from "../../../pinecone/client.js";
import { createPineconeAssistantHttpHandler } from "./http.js";

type MockResponse = ServerResponse & {
  body?: string;
};

function createMockResponse(): MockResponse {
  const headers: Record<string, string> = {};
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined as string | undefined,
    setHeader(key: string, value: string) {
      headers[key.toLowerCase()] = value;
      return res;
    },
    getHeader(key: string) {
      return headers[key.toLowerCase()];
    },
    write() {
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

describe("pinecone-assistant HTTP routes", () => {
  it("returns 503 without an API key", async () => {
    const handler = createPineconeAssistantHttpHandler({ env: {} });
    const res = createMockResponse();
    const handled = await handler(
      createMockRequest({ method: "GET", url: "/zero-token/pinecone/v1/assistants" }),
      res,
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      error: { type: "unauthenticated" },
    });
  });

  it("lists assistants", async () => {
    const handler = createPineconeAssistantHttpHandler({
      env: { PINECONE_API_KEY: "pcsk_test", PINECONE_ASSISTANT: "docs-qa" },
      createClient: () =>
        ({
          listAssistants: async () => [{ name: "docs-qa", status: "Ready" }],
        }) as unknown as PineconeAssistantClient,
    });
    const res = createMockResponse();
    await handler(
      createMockRequest({ method: "GET", url: "/zero-token/pinecone/v1/assistants" }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toEqual({
      assistants: [{ name: "docs-qa", status: "Ready" }],
      defaultAssistant: "docs-qa",
    });
  });

  it("retrieves context for an assistant", async () => {
    const handler = createPineconeAssistantHttpHandler({
      env: { PINECONE_API_KEY: "pcsk_test" },
      createClient: () =>
        ({
          context: async (input: { assistant: string; query: string }) => {
            expect(input).toMatchObject({ assistant: "docs-qa", query: "limits" });
            return { snippets: [{ content: "100 files", score: 0.8 }] };
          },
        }) as unknown as PineconeAssistantClient,
    });
    const res = createMockResponse();
    await handler(
      createMockRequest({
        method: "POST",
        url: "/zero-token/pinecone/v1/assistants/docs-qa/context",
        chunks: [JSON.stringify({ query: "limits", top_k: 5 })],
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toEqual({
      snippets: [{ content: "100 files", score: 0.8 }],
    });
  });

  it("chats with a message string", async () => {
    const handler = createPineconeAssistantHttpHandler({
      env: { PINECONE_API_KEY: "pcsk_test" },
      createClient: () =>
        ({
          chat: async (input: { messages: Array<{ content: string }> }) => {
            expect(input.messages[0]?.content).toBe("what is the quota?");
            return { message: { role: "assistant", content: "100 files" }, citations: [] };
          },
        }) as unknown as PineconeAssistantClient,
    });
    const res = createMockResponse();
    await handler(
      createMockRequest({
        method: "POST",
        url: "/zero-token/pinecone/v1/assistants/docs-qa/chat",
        chunks: [JSON.stringify({ message: "what is the quota?" })],
      }),
      res,
    );
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      message: { content: "100 files" },
    });
  });

  it("ignores unrelated paths", async () => {
    const handler = createPineconeAssistantHttpHandler({ env: { PINECONE_API_KEY: "pcsk_test" } });
    const res = createMockResponse();
    await expect(
      handler(createMockRequest({ method: "GET", url: "/zero-token/v1/models" }), res),
    ).resolves.toBe(false);
  });
});
