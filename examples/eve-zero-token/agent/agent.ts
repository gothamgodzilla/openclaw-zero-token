import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

const zeroToken = createOpenAICompatible({
  name: "zero-token",
  baseURL: process.env.ZERO_TOKEN_BASE_URL ?? "http://127.0.0.1:18789/zero-token/v1",
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
  includeUsage: true,
});

const modelRef = process.env.ZERO_TOKEN_MODEL ?? "claude-web";

export default defineAgent({
  model: zeroToken(modelRef),
  // Eve has no AI Gateway metadata for custom ids. Claude Web is 200K.
  modelContextWindowTokens: Number(process.env.ZERO_TOKEN_CONTEXT_WINDOW ?? 200_000),
});
