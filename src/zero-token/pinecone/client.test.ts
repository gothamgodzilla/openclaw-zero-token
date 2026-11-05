import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTROL_PLANE_URL,
  DEFAULT_DATA_HOST,
  PINECONE_API_VERSION,
  PineconeAssistantClient,
  PineconeAssistantError,
  assertAssistantName,
  stripSignedUrls,
} from "./client.js";

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function jsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") {
    throw new Error("expected JSON string body");
  }
  return JSON.parse(body) as unknown;
}

describe("assertAssistantName", () => {
  it("accepts lowercase hyphenated names", () => {
    expect(assertAssistantName("docs-qa")).toBe("docs-qa");
  });

  it("rejects uppercase and spaces", () => {
    expect(() => assertAssistantName("Docs QA")).toThrow(PineconeAssistantError);
  });
});

describe("stripSignedUrls", () => {
  it("drops signed_url keys from nested payloads", () => {
    expect(
      stripSignedUrls({
        snippets: [
          {
            content: "hello",
            reference: { file: { name: "a.md", signed_url: "https://secret.example/file" } },
          },
        ],
      }),
    ).toEqual({
      snippets: [{ content: "hello", reference: { file: { name: "a.md" } } }],
    });
  });
});

describe("PineconeAssistantClient", () => {
  it("lists assistants on the control plane", async () => {
    const calls: Array<{ url: string; method?: string; headers: HeadersInit | undefined }> = [];
    const client = new PineconeAssistantClient({
      apiKey: "pcsk_test",
      fetch: async (input, init) => {
        calls.push({
          url: requestUrl(input),
          method: init?.method,
          headers: init?.headers,
        });
        return new Response(
          JSON.stringify({ assistants: [{ name: "docs-qa", status: "Ready" }] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    });
    await expect(client.listAssistants()).resolves.toEqual([{ name: "docs-qa", status: "Ready" }]);
    expect(calls[0]?.url).toBe(`${DEFAULT_CONTROL_PLANE_URL}/assistant/assistants`);
    expect(calls[0]?.headers).toMatchObject({
      "Api-Key": "pcsk_test",
      "X-Pinecone-Api-Version": PINECONE_API_VERSION,
    });
  });

  it("retrieves context on the data host and strips signed urls", async () => {
    const client = new PineconeAssistantClient({
      apiKey: "pcsk_test",
      dataHost: DEFAULT_DATA_HOST,
      fetch: async (input, init) => {
        expect(requestUrl(input)).toBe(`${DEFAULT_DATA_HOST}/assistant/chat/docs-qa/context`);
        expect(jsonBody(init?.body)).toMatchObject({
          query: "quota",
          top_k: 3,
          snippet_size: 1024,
        });
        return new Response(
          JSON.stringify({
            snippets: [
              {
                content: "limit is 100",
                score: 0.9,
                reference: { file: { name: "limits.md", signed_url: "https://tmp" } },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });
    await expect(
      client.context({ assistant: "docs-qa", query: "quota", topK: 3, snippetSize: 1024 }),
    ).resolves.toEqual({
      snippets: [
        { content: "limit is 100", score: 0.9, reference: { file: { name: "limits.md" } } },
      ],
    });
  });

  it("chats without streaming", async () => {
    const client = new PineconeAssistantClient({
      apiKey: "pcsk_test",
      dataHost: DEFAULT_DATA_HOST,
      fetch: async (input, init) => {
        expect(requestUrl(input)).toBe(`${DEFAULT_DATA_HOST}/assistant/chat/docs-qa`);
        expect(jsonBody(init?.body)).toEqual({
          messages: [{ role: "user", content: "hi" }],
          stream: false,
        });
        return new Response(
          JSON.stringify({ message: { role: "assistant", content: "hello" }, citations: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });
    await expect(
      client.chat({ assistant: "docs-qa", messages: [{ role: "user", content: "hi" }] }),
    ).resolves.toMatchObject({ message: { content: "hello" } });
  });

  it("uploads markdown as multipart", async () => {
    const client = new PineconeAssistantClient({
      apiKey: "pcsk_test",
      dataHost: DEFAULT_DATA_HOST,
      fetch: async (input, init) => {
        expect(requestUrl(input)).toBe(`${DEFAULT_DATA_HOST}/files/docs-qa`);
        const body = init?.body;
        expect(body).toBeInstanceOf(FormData);
        if (!(body instanceof FormData)) {
          throw new Error("expected FormData body");
        }
        expect(body.get("file")).toBeInstanceOf(Blob);
        return new Response(
          JSON.stringify({ id: "file-1", name: "note.md", status: "Processing" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    });
    await expect(
      client.uploadText({ assistant: "docs-qa", filename: "note.md", text: "# Hello" }),
    ).resolves.toMatchObject({ name: "note.md" });
  });

  it("maps Pinecone HTTP errors", async () => {
    const client = new PineconeAssistantClient({
      apiKey: "pcsk_test",
      fetch: async () =>
        new Response(
          JSON.stringify({ error: { message: "Invalid API key.", code: "UNAUTHENTICATED" } }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        ),
    });
    await expect(client.listAssistants()).rejects.toMatchObject({
      status: 401,
      message: "Invalid API key.",
    });
  });
});
