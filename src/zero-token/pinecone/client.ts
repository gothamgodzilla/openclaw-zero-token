export const PINECONE_API_VERSION = "2026-07";
export const DEFAULT_CONTROL_PLANE_URL = "https://api.pinecone.io";
export const DEFAULT_DATA_HOST = "https://prod-1-data.ke.pinecone.io";

export class PineconeAssistantError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PineconeAssistantError";
    this.status = status;
    this.code = code;
  }
}

export type PineconeChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type PineconeAssistantSummary = {
  name: string;
  status: string;
  instructions?: string;
  host?: string;
  region?: string;
  created_at?: string;
  updated_at?: string;
};

export type PineconeContextSnippet = {
  type?: string;
  content?: string;
  score?: number;
  reference?: {
    type?: string;
    pages?: number[];
    file?: {
      id?: string;
      name?: string;
      status?: string;
      metadata?: Record<string, unknown> | null;
    };
  };
};

export type PineconeAssistantClientOptions = {
  apiKey: string;
  controlPlaneUrl?: string;
  dataHost?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
};

export type CreateAssistantInput = {
  name: string;
  instructions?: string;
  region?: "us" | "eu";
};

export type ContextInput = {
  assistant: string;
  query: string;
  topK?: number;
  snippetSize?: number;
};

export type ChatInput = {
  assistant: string;
  messages: PineconeChatMessage[];
};

export type UploadTextInput = {
  assistant: string;
  filename: string;
  text: string;
  contentType?: string;
};

const ASSISTANT_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function assertAssistantName(name: string): string {
  const trimmed = name.trim();
  if (!ASSISTANT_NAME_RE.test(trimmed)) {
    throw new PineconeAssistantError(
      400,
      "invalid_request_error",
      "Assistant name must be 1-63 lowercase letters, digits, or hyphens",
    );
  }
  return trimmed;
}

export function stripSignedUrls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSignedUrls(item)) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(record)) {
    if (key === "signed_url" || key === "signedUrl") {
      continue;
    }
    next[key] = stripSignedUrls(nested);
  }
  return next as T;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function pineconeMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const record = payload as Record<string, unknown>;
  const nested = record.error;
  if (nested && typeof nested === "object") {
    const message = (nested as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }
  return fallback;
}

export class PineconeAssistantClient {
  private readonly apiKey: string;
  private readonly controlPlaneUrl: string;
  private readonly dataHostOverride?: string;
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PineconeAssistantClientOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) {
      throw new PineconeAssistantError(401, "unauthenticated", "Missing Pinecone API key");
    }
    this.apiKey = apiKey;
    this.controlPlaneUrl = (options.controlPlaneUrl ?? DEFAULT_CONTROL_PLANE_URL).replace(
      /\/+$/,
      "",
    );
    this.dataHostOverride = options.dataHost?.replace(/\/+$/, "") || undefined;
    this.apiVersion = options.apiVersion ?? PINECONE_API_VERSION;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async listAssistants(): Promise<PineconeAssistantSummary[]> {
    const payload = await this.requestJson(
      "GET",
      joinUrl(this.controlPlaneUrl, "/assistant/assistants"),
    );
    const assistants = (payload as { assistants?: unknown }).assistants;
    if (!Array.isArray(assistants)) {
      return [];
    }
    return stripSignedUrls(assistants) as PineconeAssistantSummary[];
  }

  async createAssistant(input: CreateAssistantInput): Promise<PineconeAssistantSummary> {
    const name = assertAssistantName(input.name);
    const region = input.region === "eu" ? "eu" : "us";
    const payload = await this.requestJson(
      "POST",
      joinUrl(this.controlPlaneUrl, "/assistant/assistants"),
      {
        name,
        instructions: input.instructions?.trim() || undefined,
        region,
        metadata: { source: "openclaw-zero-token" },
      },
    );
    return stripSignedUrls(payload) as PineconeAssistantSummary;
  }

  async context(input: ContextInput): Promise<{ snippets: PineconeContextSnippet[] }> {
    const assistant = assertAssistantName(input.assistant);
    const query = input.query.trim();
    if (!query) {
      throw new PineconeAssistantError(400, "invalid_request_error", "query is required");
    }
    const topK =
      typeof input.topK === "number" && Number.isFinite(input.topK)
        ? Math.max(1, Math.min(16, Math.floor(input.topK)))
        : 5;
    const snippetSize =
      typeof input.snippetSize === "number" && Number.isFinite(input.snippetSize)
        ? Math.max(512, Math.min(8192, Math.floor(input.snippetSize)))
        : 2048;
    const host = await this.resolveDataHost(assistant);
    const payload = await this.requestJson(
      "POST",
      joinUrl(host, `/assistant/chat/${encodeURIComponent(assistant)}/context`),
      { query, top_k: topK, snippet_size: snippetSize },
    );
    const snippets = (payload as { snippets?: unknown }).snippets;
    return {
      snippets: Array.isArray(snippets)
        ? (stripSignedUrls(snippets) as PineconeContextSnippet[])
        : [],
    };
  }

  async chat(input: ChatInput): Promise<{
    message?: { role?: string; content?: string };
    citations?: unknown[];
    usage?: unknown;
  }> {
    const assistant = assertAssistantName(input.assistant);
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      throw new PineconeAssistantError(400, "invalid_request_error", "messages is required");
    }
    const host = await this.resolveDataHost(assistant);
    const payload = await this.requestJson(
      "POST",
      joinUrl(host, `/assistant/chat/${encodeURIComponent(assistant)}`),
      { messages: input.messages, stream: false },
    );
    return stripSignedUrls(payload) as {
      message?: { role?: string; content?: string };
      citations?: unknown[];
      usage?: unknown;
    };
  }

  async uploadText(input: UploadTextInput): Promise<unknown> {
    const assistant = assertAssistantName(input.assistant);
    const filename = input.filename.trim() || "note.md";
    const text = input.text;
    if (!text.trim()) {
      throw new PineconeAssistantError(400, "invalid_request_error", "text is required");
    }
    const host = await this.resolveDataHost(assistant);
    const form = new FormData();
    const blob = new Blob([text], { type: input.contentType ?? "text/markdown" });
    form.append("file", blob, filename);
    return this.requestJson("POST", joinUrl(host, `/files/${encodeURIComponent(assistant)}`), form);
  }

  async listFiles(assistantName: string): Promise<unknown> {
    const assistant = assertAssistantName(assistantName);
    const host = await this.resolveDataHost(assistant);
    const payload = await this.requestJson(
      "GET",
      joinUrl(host, `/files/${encodeURIComponent(assistant)}`),
    );
    return stripSignedUrls(payload);
  }

  private async resolveDataHost(assistant: string): Promise<string> {
    if (this.dataHostOverride) {
      return this.dataHostOverride;
    }
    const payload = await this.requestJson(
      "GET",
      joinUrl(this.controlPlaneUrl, `/assistant/assistants/${encodeURIComponent(assistant)}`),
    );
    const host = (payload as { host?: unknown }).host;
    if (typeof host === "string" && host.trim()) {
      return host.replace(/\/+$/, "");
    }
    return DEFAULT_DATA_HOST;
  }

  private async requestJson(method: string, url: string, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      "Api-Key": this.apiKey,
      "X-Pinecone-Api-Version": this.apiVersion,
      accept: "application/json",
    };
    let encoded: BodyInit | undefined;
    if (body instanceof FormData) {
      encoded = body;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      encoded = JSON.stringify(body);
    }
    const response = await this.fetchImpl(url, { method, headers, body: encoded });
    const raw = await response.text();
    let parsed: unknown = undefined;
    if (raw.trim()) {
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        parsed = { message: raw };
      }
    }
    if (!response.ok) {
      throw new PineconeAssistantError(
        response.status,
        response.status === 401 ? "unauthenticated" : "api_error",
        pineconeMessage(parsed, `Pinecone Assistant request failed (${response.status})`),
      );
    }
    return parsed ?? {};
  }
}
