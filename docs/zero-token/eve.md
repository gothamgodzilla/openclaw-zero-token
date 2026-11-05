---
title: "Eve + Zero Token"
summary: "Run Vercel Eve agents on Zero Token web models without provider API keys"
read_when:
  - You want Eve to use Claude Web, ChatGPT Web, DeepSeek Web, or other Zero Token models
  - You are wiring createOpenAICompatible() at a local OpenClaw gateway
---

# Eve + Zero Token

[Eve](https://eve.dev/docs) is Vercel’s filesystem-first agent runtime (`defineAgent`, skills, channels, durable sessions). OpenClaw Zero Token already speaks those models through a browser login. This fork exposes a **model-only** OpenAI Chat Completions surface so Eve can call those web models directly.

This is not the Gateway’s existing [`/v1/chat/completions`](/gateway/openai-http-api) agent endpoint. That path runs a full OpenClaw agent turn (tools, routing, operator scope). Pointing Eve at it nests two agent loops. Use `/zero-token/v1` instead.

## What you get

The bundled `eve-bridge` plugin (enabled by default) serves:

| Method | Path                              | Purpose                                 |
| ------ | --------------------------------- | --------------------------------------- |
| `GET`  | `/zero-token/v1/models`           | Catalog of web provider ids             |
| `POST` | `/zero-token/v1/chat/completions` | Streaming and non-streaming completions |

Auth is the Gateway token (`Authorization: Bearer <token>`), same as other operator HTTP routes. Keep the listener on loopback or a private tailnet.

Model ids:

- `claude-web` (default native id, e.g. `claude-sonnet-4-6`)
- `claude-web/claude-sonnet-4-6` (explicit)
- Same pattern for `chatgpt-web`, `deepseek-web`, `gemini-web`, `kimi-web`, `qwen-web`, `qwen-cn-web`, `doubao-web`, `grok-web`, `glm-web`, `glm-intl-web`, `perplexity-web`, `xiaomimo-web`

Onboard the web provider first (`openclaw onboard claude-web`, or `openclaw webauth`).

## Run Eve against the bridge

1. Enable Gateway HTTP and start OpenClaw (chat-completions on `/v1` stays optional):

```json5
{
  gateway: {
    auth: { mode: "token", token: "replace-me" },
  },
}
```

2. Scaffold Eve in its own directory (Eve wants Node.js 24+; do not init Eve in this repo root):

```bash
npx eve@latest init my-zero-token-agent
```

3. Point Eve at the bridge with the AI SDK OpenAI-compatible provider:

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

const zeroToken = createOpenAICompatible({
  name: "zero-token",
  baseURL: process.env.ZERO_TOKEN_BASE_URL ?? "http://127.0.0.1:18789/zero-token/v1",
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
  includeUsage: true,
});

export default defineAgent({
  model: zeroToken(process.env.ZERO_TOKEN_MODEL ?? "claude-web"),
  modelContextWindowTokens: 200_000,
});
```

A copy of this agent lives at [`examples/eve-zero-token/`](https://github.com/gothamgodzilla/openclaw-zero-token/tree/main/examples/eve-zero-token).

Set `modelContextWindowTokens` yourself. Eve has no AI Gateway catalog for custom model ids; Claude Web is 200K, ChatGPT Web 128K, DeepSeek Web 64K. See `WEB_CONTEXT_WINDOW_TOKENS` in `src/zero-token/eve/models.ts`.

## ChatGPT only

Eve can already use a local ChatGPT subscription via `chatgpt()` from `eve/models/openai` and `/login`. Use this bridge when you want Claude Web, DeepSeek, Qwen, Kimi, or the other Zero Token providers, or one Eve agent that can switch among them.

## Pinecone Assistant

To answer from documents with citations, enable the bundled `pinecone-assistant` plugin and use the Eve tools in `examples/eve-zero-token/`. Eve retrieves snippets from `/zero-token/pinecone/v1`, then writes the answer with the Zero Token web model. See [Eve + Pinecone Assistant](/zero-token/pinecone-eve).

## Disable

```json5
{
  plugins: {
    entries: {
      "eve-bridge": { enabled: false },
    },
  },
}
```

## Related

- [Web models](/zero-token/web-models-support)
- [OpenAI Chat Completions (agent endpoint)](/gateway/openai-http-api)
- [Eve + Pinecone Assistant](/zero-token/pinecone-eve)
- [Eve docs](https://eve.dev/docs)
