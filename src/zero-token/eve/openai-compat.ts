export type OpenAiChatMessage = {
  role: string;
  content?: unknown;
};

export type OpenAiChatCompletionRequest = {
  model: string;
  messages: OpenAiChatMessage[];
  stream?: boolean;
  user?: string;
};

export type WebChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ParsedChatCompletionRequest = {
  model: string;
  messages: WebChatMessage[];
  systemPrompt: string;
  stream: boolean;
  user?: string;
};

export class OpenAiCompatError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "OpenAiCompatError";
    this.status = status;
    this.code = code;
  }
}

function flattenContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof content === "number" || typeof content === "boolean" || typeof content === "bigint") {
    return String(content);
  }
  return "";
}

function asChatRole(role: string): WebChatMessage["role"] | null {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }
  return null;
}

export function parseChatCompletionRequest(body: unknown): ParsedChatCompletionRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new OpenAiCompatError(400, "invalid_request_error", "Request body must be a JSON object");
  }
  const record = body as Record<string, unknown>;
  const model = typeof record.model === "string" ? record.model.trim() : "";
  if (!model) {
    throw new OpenAiCompatError(400, "invalid_request_error", "Missing model");
  }
  if (!Array.isArray(record.messages) || record.messages.length === 0) {
    throw new OpenAiCompatError(400, "invalid_request_error", "messages must be a non-empty array");
  }

  const systemParts: string[] = [];
  const messages: WebChatMessage[] = [];
  for (const raw of record.messages) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const role = asChatRole(String((raw as OpenAiChatMessage).role ?? ""));
    if (!role) {
      continue;
    }
    const content = flattenContent((raw as OpenAiChatMessage).content);
    if (role === "system") {
      if (content) {
        systemParts.push(content);
      }
      continue;
    }
    messages.push({ role, content });
  }
  if (messages.length === 0) {
    throw new OpenAiCompatError(
      400,
      "invalid_request_error",
      "messages must include at least one user or assistant turn",
    );
  }

  return {
    model,
    messages,
    systemPrompt: systemParts.join("\n\n"),
    stream: record.stream === true,
    user: typeof record.user === "string" && record.user.trim() ? record.user.trim() : undefined,
  };
}

export function createCompletionId(now = Date.now(), random = Math.random): string {
  return `chatcmpl-zt${now.toString(36)}${Math.floor(random() * 1e6).toString(36)}`;
}

export function encodeSseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export function buildChatCompletionChunk(params: {
  id: string;
  created: number;
  model: string;
  delta: Record<string, unknown>;
  finishReason: string | null;
}): Record<string, unknown> {
  return {
    id: params.id,
    object: "chat.completion.chunk",
    created: params.created,
    model: params.model,
    choices: [
      {
        index: 0,
        delta: params.delta,
        finish_reason: params.finishReason,
      },
    ],
  };
}

export function buildChatCompletion(params: {
  id: string;
  created: number;
  model: string;
  content: string;
}): Record<string, unknown> {
  return {
    id: params.id,
    object: "chat.completion",
    created: params.created,
    model: params.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: params.content },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

export function buildOpenAiError(status: number, code: string, message: string) {
  return {
    status,
    body: {
      error: {
        message,
        type: code,
        code,
      },
    },
  };
}
