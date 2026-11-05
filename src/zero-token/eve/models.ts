import {
  CHATGPT_WEB_DEFAULT_MODEL_ID,
  CLAUDE_WEB_DEFAULT_MODEL_ID,
  DEEPSEEK_WEB_DEFAULT_MODEL_ID,
  DOUBAO_WEB_DEFAULT_MODEL_ID,
  GEMINI_WEB_DEFAULT_MODEL_ID,
  GLM_INTL_WEB_DEFAULT_MODEL_ID,
  GROK_WEB_DEFAULT_MODEL_ID,
  KIMI_WEB_DEFAULT_MODEL_ID,
  PERPLEXITY_WEB_DEFAULT_MODEL_ID,
  QWEN_WEB_DEFAULT_MODEL_ID,
  Z_WEB_DEFAULT_MODEL_ID,
} from "../bridge/web-providers.js";
import { listWebStreamApiIds, type WebStreamApiId } from "../streams/web-stream-factories.js";

/** Default native model id for each web stream API. */
export const WEB_DEFAULT_MODEL_IDS = {
  "chatgpt-web": CHATGPT_WEB_DEFAULT_MODEL_ID,
  "claude-web": CLAUDE_WEB_DEFAULT_MODEL_ID,
  "deepseek-web": DEEPSEEK_WEB_DEFAULT_MODEL_ID,
  "doubao-web": DOUBAO_WEB_DEFAULT_MODEL_ID,
  "gemini-web": GEMINI_WEB_DEFAULT_MODEL_ID,
  "glm-intl-web": GLM_INTL_WEB_DEFAULT_MODEL_ID,
  "glm-web": Z_WEB_DEFAULT_MODEL_ID,
  "grok-web": GROK_WEB_DEFAULT_MODEL_ID,
  "kimi-web": KIMI_WEB_DEFAULT_MODEL_ID,
  "perplexity-web": PERPLEXITY_WEB_DEFAULT_MODEL_ID,
  "qwen-cn-web": "Qwen3.5-Plus",
  "qwen-web": QWEN_WEB_DEFAULT_MODEL_ID,
  "xiaomimo-web": "xiaomimo-chat",
} as const satisfies Record<WebStreamApiId, string>;

/** Context windows used by Eve compaction when the catalog has no Gateway metadata. */
export const WEB_CONTEXT_WINDOW_TOKENS = {
  "chatgpt-web": 128_000,
  "claude-web": 200_000,
  "deepseek-web": 64_000,
  "doubao-web": 64_000,
  "gemini-web": 32_000,
  "glm-intl-web": 128_000,
  "glm-web": 128_000,
  "grok-web": 32_000,
  "kimi-web": 32_000,
  "perplexity-web": 128_000,
  "qwen-cn-web": 128_000,
  "qwen-web": 32_000,
  "xiaomimo-web": 128_000,
} as const satisfies Record<WebStreamApiId, number>;

export type ParsedWebModelRef = {
  api: WebStreamApiId;
  modelId: string;
  ref: string;
};

export function isWebStreamApiId(value: string): value is WebStreamApiId {
  return (listWebStreamApiIds() as string[]).includes(value);
}

/**
 * Parse Eve / OpenAI `model` values such as `claude-web` or
 * `claude-web/claude-sonnet-4-6`.
 */
export function parseWebModelRef(model: string): ParsedWebModelRef | null {
  const trimmed = model.trim();
  if (!trimmed) {
    return null;
  }
  const slash = trimmed.indexOf("/");
  const apiPart = slash === -1 ? trimmed : trimmed.slice(0, slash);
  const modelPart = slash === -1 ? "" : trimmed.slice(slash + 1).trim();
  if (!isWebStreamApiId(apiPart)) {
    return null;
  }
  const modelId = modelPart || WEB_DEFAULT_MODEL_IDS[apiPart];
  return {
    api: apiPart,
    modelId,
    ref: `${apiPart}/${modelId}`,
  };
}

export type OpenAiModelListItem = {
  id: string;
  object: "model";
  created: number;
  owned_by: "zero-token";
};

export function listOpenAiWebModels(created = 0): OpenAiModelListItem[] {
  const items: OpenAiModelListItem[] = [];
  for (const api of listWebStreamApiIds()) {
    const defaultId = WEB_DEFAULT_MODEL_IDS[api];
    items.push({
      id: api,
      object: "model",
      created,
      owned_by: "zero-token",
    });
    items.push({
      id: `${api}/${defaultId}`,
      object: "model",
      created,
      owned_by: "zero-token",
    });
  }
  return items;
}
