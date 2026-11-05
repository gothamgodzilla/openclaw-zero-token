import { getWebStreamFactory, type WebStreamApiId } from "../streams/web-stream-factories.js";
import { resolveWebProviderCredential } from "./credentials.js";
import { parseWebModelRef } from "./models.js";
import {
  OpenAiCompatError,
  buildChatCompletion,
  buildChatCompletionChunk,
  createCompletionId,
  encodeSseData,
  type ParsedChatCompletionRequest,
} from "./openai-compat.js";

export type WebCompletionEvent =
  | { type: "delta"; text: string }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

export type WebCompletionDeps = {
  getFactory?: typeof getWebStreamFactory;
  resolveCredential?: (providerId: string) => string | null;
  now?: () => number;
  random?: () => number;
};

type StreamEvent = {
  type?: string;
  delta?: string;
  error?: { errorMessage?: string; message?: string };
};

function streamErrorMessage(event: StreamEvent): string {
  return event.error?.errorMessage || event.error?.message || "Stream error";
}

export async function* iterateWebCompletion(
  request: ParsedChatCompletionRequest,
  deps: WebCompletionDeps = {},
): AsyncGenerator<WebCompletionEvent> {
  const parsed = parseWebModelRef(request.model);
  if (!parsed) {
    throw new OpenAiCompatError(
      400,
      "invalid_request_error",
      `Unknown web model "${request.model}". Use provider ids such as claude-web or claude-web/claude-sonnet-4-6.`,
    );
  }

  const getFactory = deps.getFactory ?? getWebStreamFactory;
  const factory = getFactory(parsed.api);
  if (!factory) {
    throw new OpenAiCompatError(
      400,
      "invalid_request_error",
      `No stream factory for ${parsed.api}`,
    );
  }

  const resolveCredential = deps.resolveCredential ?? resolveWebProviderCredential;
  const credential = resolveCredential(parsed.api);
  if (!credential) {
    throw new OpenAiCompatError(
      401,
      "authentication_error",
      `${parsed.api} is not authenticated. Run openclaw onboard ${parsed.api} first.`,
    );
  }

  const streamFn = factory(credential);
  const sessionId = request.user ?? `eve-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const stream = streamFn(
    {
      id: parsed.modelId,
      api: parsed.api,
      provider: parsed.api,
    } as never,
    {
      messages: request.messages,
      systemPrompt: request.systemPrompt,
      tools: [],
      sessionId,
    } as never,
    {},
  );

  let content = "";
  try {
    for await (const event of stream as AsyncIterable<StreamEvent>) {
      if (event.type === "text_delta" && event.delta) {
        content += event.delta;
        yield { type: "delta", text: event.delta };
      } else if (event.type === "error") {
        yield { type: "error", message: streamErrorMessage(event) };
        return;
      }
    }
  } catch (error) {
    yield {
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    };
    return;
  }
  yield { type: "done", content };
}

export async function collectWebCompletion(
  request: ParsedChatCompletionRequest,
  deps: WebCompletionDeps = {},
): Promise<{ model: string; content: string }> {
  const parsed = parseWebModelRef(request.model);
  const model = parsed?.ref ?? request.model;
  let content = "";
  for await (const event of iterateWebCompletion(request, deps)) {
    if (event.type === "error") {
      throw new OpenAiCompatError(502, "api_error", event.message);
    }
    if (event.type === "done") {
      content = event.content;
    }
  }
  return { model, content };
}

export async function* streamWebCompletionSse(
  request: ParsedChatCompletionRequest,
  deps: WebCompletionDeps = {},
): AsyncGenerator<string> {
  const now = deps.now ?? Date.now;
  const created = Math.floor(now() / 1000);
  const id = createCompletionId(now(), deps.random);
  const parsed = parseWebModelRef(request.model);
  const model = parsed?.ref ?? request.model;

  yield encodeSseData(
    buildChatCompletionChunk({
      id,
      created,
      model,
      delta: { role: "assistant" },
      finishReason: null,
    }),
  );

  for await (const event of iterateWebCompletion(request, deps)) {
    if (event.type === "error") {
      throw new OpenAiCompatError(502, "api_error", event.message);
    }
    if (event.type === "delta") {
      yield encodeSseData(
        buildChatCompletionChunk({
          id,
          created,
          model,
          delta: { content: event.text },
          finishReason: null,
        }),
      );
    }
  }

  yield encodeSseData(
    buildChatCompletionChunk({
      id,
      created,
      model,
      delta: {},
      finishReason: "stop",
    }),
  );
  yield "data: [DONE]\n\n";
}

export function buildNonStreamingCompletion(
  request: ParsedChatCompletionRequest,
  content: string,
  deps: WebCompletionDeps = {},
): Record<string, unknown> {
  const now = deps.now ?? Date.now;
  const parsed = parseWebModelRef(request.model);
  return buildChatCompletion({
    id: createCompletionId(now(), deps.random),
    created: Math.floor(now() / 1000),
    model: parsed?.ref ?? request.model,
    content,
  });
}

export function resolveWebApiId(model: string): WebStreamApiId | null {
  return parseWebModelRef(model)?.api ?? null;
}
