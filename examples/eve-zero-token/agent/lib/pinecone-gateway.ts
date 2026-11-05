const DEFAULT_BASE_URL = "http://127.0.0.1:18789/zero-token/pinecone/v1";

export function pineconeGatewayBaseUrl(): string {
  return (process.env.ZERO_TOKEN_PINECONE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function defaultPineconeAssistant(override?: string): string {
  return (override ?? process.env.PINECONE_ASSISTANT ?? "").trim();
}

export async function pineconeGatewayRequest(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "OPENCLAW_GATEWAY_TOKEN is required to call Pinecone Assistant through the Gateway",
    );
  }
  const response = await fetch(`${pineconeGatewayBaseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
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
    const nested =
      parsed && typeof parsed === "object"
        ? (parsed as { error?: { message?: unknown } }).error?.message
        : undefined;
    const message =
      typeof nested === "string" && nested.trim()
        ? nested
        : `Pinecone Gateway request failed (${response.status})`;
    throw new Error(message);
  }
  return parsed ?? {};
}
