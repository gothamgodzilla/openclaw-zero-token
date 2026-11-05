import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBodyWithLimit } from "../../../../infra/http-body.js";
import { listOpenAiWebModels } from "../../../eve/models.js";
import {
  OpenAiCompatError,
  buildOpenAiError,
  parseChatCompletionRequest,
} from "../../../eve/openai-compat.js";
import {
  buildNonStreamingCompletion,
  collectWebCompletion,
  streamWebCompletionSse,
  type WebCompletionDeps,
} from "../../../eve/web-completion.js";

export const EVE_BRIDGE_ROUTE_PREFIX = "/zero-token/v1";
const MODELS_PATH = `${EVE_BRIDGE_ROUTE_PREFIX}/models`;
const CHAT_COMPLETIONS_PATH = `${EVE_BRIDGE_ROUTE_PREFIX}/chat/completions`;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export type EveBridgeHttpDeps = WebCompletionDeps & {
  now?: () => number;
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

function writeError(res: ServerResponse, error: unknown): boolean {
  if (error instanceof OpenAiCompatError) {
    const envelope = buildOpenAiError(error.status, error.code, error.message);
    writeJson(res, envelope.status, envelope.body);
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  const envelope = buildOpenAiError(500, "api_error", message);
  writeJson(res, envelope.status, envelope.body);
  return true;
}

export function createEveBridgeHttpHandler(deps: EveBridgeHttpDeps = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = pathnameOf(req.url);
    if (!pathname.startsWith(EVE_BRIDGE_ROUTE_PREFIX)) {
      return false;
    }

    if (req.method === "GET" && pathname === MODELS_PATH) {
      const created = Math.floor((deps.now ?? Date.now)() / 1000);
      writeJson(res, 200, {
        object: "list",
        data: listOpenAiWebModels(created),
      });
      return true;
    }

    if (req.method === "POST" && pathname === CHAT_COMPLETIONS_PATH) {
      const body = await readJsonBodyWithLimit(req, { maxBytes: MAX_BODY_BYTES });
      if (!body.ok) {
        writeJson(res, 400, buildOpenAiError(400, "invalid_request_error", body.error).body);
        return true;
      }
      try {
        const request = parseChatCompletionRequest(body.value);
        if (request.stream) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          for await (const chunk of streamWebCompletionSse(request, deps)) {
            res.write(chunk);
          }
          res.end();
          return true;
        }
        const { content } = await collectWebCompletion(request, deps);
        writeJson(res, 200, buildNonStreamingCompletion(request, content, deps));
        return true;
      } catch (error) {
        return writeError(res, error);
      }
    }

    if (pathname === MODELS_PATH || pathname === CHAT_COMPLETIONS_PATH) {
      writeJson(
        res,
        405,
        buildOpenAiError(405, "invalid_request_error", "Method not allowed").body,
      );
      return true;
    }

    writeJson(res, 404, buildOpenAiError(404, "invalid_request_error", "Not found").body);
    return true;
  };
}
