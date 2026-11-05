import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBodyWithLimit } from "../../../../infra/http-body.js";
import {
  PineconeAssistantClient,
  PineconeAssistantError,
  type PineconeAssistantClientOptions,
  type PineconeChatMessage,
} from "../../../pinecone/client.js";
import {
  requirePineconeApiKey,
  resolveControlPlaneUrl,
  resolveDataHost,
  resolveDefaultAssistant,
  type PineconeAssistantPluginConfig,
} from "../../../pinecone/config.js";

export const PINECONE_ASSISTANT_ROUTE_PREFIX = "/zero-token/pinecone/v1";
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export type PineconeAssistantHttpDeps = {
  pluginConfig?: PineconeAssistantPluginConfig;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  createClient?: (options: PineconeAssistantClientOptions) => PineconeAssistantClient;
};

function pathnameOf(url: string | undefined): string {
  if (!url) {
    return "";
  }
  try {
    return new URL(url, "http://127.0.0.1").pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url.split("?")[0] ?? "";
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

function errorBody(status: number, code: string, message: string) {
  return { error: { message, type: code, code } };
}

function writeError(res: ServerResponse, error: unknown): boolean {
  if (error instanceof PineconeAssistantError) {
    writeJson(res, error.status, errorBody(error.status, error.code, error.message));
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  writeJson(res, 500, errorBody(500, "api_error", message));
  return true;
}

function parseAssistantPath(pathname: string): { name: string; action: string } | null {
  const prefix = `${PINECONE_ASSISTANT_ROUTE_PREFIX}/assistants/`;
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  const rest = pathname.slice(prefix.length);
  const slash = rest.lastIndexOf("/");
  if (slash <= 0) {
    return null;
  }
  return { name: rest.slice(0, slash), action: rest.slice(slash + 1) };
}

function asChatMessages(body: Record<string, unknown>): PineconeChatMessage[] {
  if (Array.isArray(body.messages)) {
    return body.messages
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const role = (item as { role?: unknown }).role;
        const content = (item as { content?: unknown }).content;
        if (role !== "user" && role !== "assistant" && role !== "system") {
          return null;
        }
        if (typeof content !== "string") {
          return null;
        }
        return { role, content };
      })
      .filter((item): item is PineconeChatMessage => item !== null);
  }
  if (typeof body.message === "string" && body.message.trim()) {
    return [{ role: "user", content: body.message.trim() }];
  }
  return [];
}

export function createPineconeAssistantHttpHandler(deps: PineconeAssistantHttpDeps = {}) {
  const createClient =
    deps.createClient ??
    ((options: PineconeAssistantClientOptions) => new PineconeAssistantClient(options));

  const clientFor = () => {
    const pluginConfig = deps.pluginConfig;
    return createClient({
      apiKey: requirePineconeApiKey({ pluginConfig, env: deps.env }),
      controlPlaneUrl: resolveControlPlaneUrl({ pluginConfig, env: deps.env }),
      dataHost: resolveDataHost({ pluginConfig, env: deps.env }),
      fetch: deps.fetch,
    });
  };

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = pathnameOf(req.url);
    if (!pathname.startsWith(PINECONE_ASSISTANT_ROUTE_PREFIX)) {
      return false;
    }

    try {
      if (req.method === "GET" && pathname === `${PINECONE_ASSISTANT_ROUTE_PREFIX}/assistants`) {
        const assistants = await clientFor().listAssistants();
        writeJson(res, 200, {
          assistants,
          defaultAssistant: resolveDefaultAssistant({
            pluginConfig: deps.pluginConfig,
            env: deps.env,
          }),
        });
        return true;
      }

      if (req.method === "POST" && pathname === `${PINECONE_ASSISTANT_ROUTE_PREFIX}/assistants`) {
        const body = await readJsonBodyWithLimit(req, { maxBytes: MAX_BODY_BYTES });
        if (!body.ok) {
          writeJson(res, 400, errorBody(400, "invalid_request_error", body.error));
          return true;
        }
        const record = (body.value ?? {}) as Record<string, unknown>;
        const created = await clientFor().createAssistant({
          name: typeof record.name === "string" ? record.name : "",
          instructions: typeof record.instructions === "string" ? record.instructions : undefined,
          region: record.region === "eu" ? "eu" : "us",
        });
        writeJson(res, 200, created);
        return true;
      }

      const parsed = parseAssistantPath(pathname);
      if (parsed) {
        if (req.method === "POST" && parsed.action === "context") {
          const body = await readJsonBodyWithLimit(req, { maxBytes: MAX_BODY_BYTES });
          if (!body.ok) {
            writeJson(res, 400, errorBody(400, "invalid_request_error", body.error));
            return true;
          }
          const record = (body.value ?? {}) as Record<string, unknown>;
          const result = await clientFor().context({
            assistant: parsed.name,
            query: typeof record.query === "string" ? record.query : "",
            topK: typeof record.top_k === "number" ? record.top_k : undefined,
            snippetSize: typeof record.snippet_size === "number" ? record.snippet_size : undefined,
          });
          writeJson(res, 200, result);
          return true;
        }

        if (req.method === "POST" && parsed.action === "chat") {
          const body = await readJsonBodyWithLimit(req, { maxBytes: MAX_BODY_BYTES });
          if (!body.ok) {
            writeJson(res, 400, errorBody(400, "invalid_request_error", body.error));
            return true;
          }
          const result = await clientFor().chat({
            assistant: parsed.name,
            messages: asChatMessages((body.value ?? {}) as Record<string, unknown>),
          });
          writeJson(res, 200, result);
          return true;
        }

        if (req.method === "POST" && parsed.action === "files") {
          const body = await readJsonBodyWithLimit(req, { maxBytes: MAX_BODY_BYTES });
          if (!body.ok) {
            writeJson(res, 400, errorBody(400, "invalid_request_error", body.error));
            return true;
          }
          const record = (body.value ?? {}) as Record<string, unknown>;
          const uploaded = await clientFor().uploadText({
            assistant: parsed.name,
            filename: typeof record.name === "string" ? record.name : "note.md",
            text: typeof record.text === "string" ? record.text : "",
          });
          writeJson(res, 200, uploaded);
          return true;
        }

        if (req.method === "GET" && parsed.action === "files") {
          const files = await clientFor().listFiles(parsed.name);
          writeJson(res, 200, files);
          return true;
        }
      }

      if (pathname.startsWith(`${PINECONE_ASSISTANT_ROUTE_PREFIX}/assistants`)) {
        writeJson(res, 405, errorBody(405, "invalid_request_error", "Method not allowed"));
        return true;
      }

      writeJson(res, 404, errorBody(404, "invalid_request_error", "Not found"));
      return true;
    } catch (error) {
      return writeError(res, error);
    }
  };
}
