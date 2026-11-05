---
title: "Eve + Pinecone Assistant"
summary: "Cited RAG from Pinecone Assistant while Eve generates with Zero Token web models"
read_when:
  - You want Eve to answer from documents with citations
  - You are wiring Pinecone Assistant through the OpenClaw Gateway
---

# Eve + Pinecone Assistant

[Pinecone Assistant](https://docs.pinecone.io/guides/assistant/overview) is managed RAG: upload documents, retrieve snippets, get citations. [Eve](https://eve.dev/docs) is the agent runtime. Zero Token is the **model** (browser-login web providers).

This merge keeps those jobs apart:

| Layer              | Path                       | Job                                                     |
| ------------------ | -------------------------- | ------------------------------------------------------- |
| Eve                | `examples/eve-zero-token/` | Agent loop, tools, skills                               |
| Zero Token models  | `/zero-token/v1`           | Web completions (no provider API key)                   |
| Pinecone Assistant | `/zero-token/pinecone/v1`  | Cited context (needs `PINECONE_API_KEY` on the Gateway) |

Do not send Eve to Gateway `/v1/chat/completions` (that nests two agents). Prefer **context retrieval** over Pinecone **chat**. Chat runs Pinecone’s hosted LLM and nests two model calls.

## Gateway routes

The bundled `pinecone-assistant` plugin (enabled by default) serves:

| Method | Path                                               | Purpose                                       |
| ------ | -------------------------------------------------- | --------------------------------------------- |
| `GET`  | `/zero-token/pinecone/v1/assistants`               | List assistants                               |
| `POST` | `/zero-token/pinecone/v1/assistants`               | Create (`name`, `instructions?`, `region?`)   |
| `POST` | `/zero-token/pinecone/v1/assistants/:name/context` | Snippets (`query`, `top_k?`, `snippet_size?`) |
| `POST` | `/zero-token/pinecone/v1/assistants/:name/chat`    | Hosted cited answer (nested LLM)              |
| `POST` | `/zero-token/pinecone/v1/assistants/:name/files`   | Upload markdown/text (`name`, `text`)         |
| `GET`  | `/zero-token/pinecone/v1/assistants/:name/files`   | List files                                    |

Auth is the Gateway token (`Authorization: Bearer <token>`). Temporary Pinecone `signed_url` values are stripped before the response leaves the Gateway.

## Configure

```json5
{
  plugins: {
    entries: {
      "pinecone-assistant": {
        enabled: true,
        config: {
          // apiKey: "pcsk_...",   // or set PINECONE_API_KEY on the Gateway
          defaultAssistant: "docs-qa",
        },
      },
    },
  },
}
```

Get a key at [Pinecone](https://app.pinecone.io/?sessionType=signup). Create/upload can also be done in the Pinecone console; Eve only needs a ready assistant name (`PINECONE_ASSISTANT`).

## Eve tools

The example agent (`examples/eve-zero-token/`) exposes:

- `pinecone_list_assistants`
- `pinecone_retrieve_context` (default path)
- `pinecone_chat` (hosted synthesis only)
- `pinecone_create_assistant`
- `pinecone_upload_text`

```bash
export OPENCLAW_GATEWAY_TOKEN="your-gateway-token"
export PINECONE_ASSISTANT="docs-qa"
export PINECONE_API_KEY="pcsk_..."   # Gateway process, not Eve
```

Disable with `plugins.entries.pinecone-assistant.enabled: false`.

## Related

- [Eve + Zero Token](/zero-token/eve)
- [Pinecone Assistant docs](https://docs.pinecone.io/guides/assistant/overview)
- [Retrieve context snippets](https://docs.pinecone.io/guides/assistant/retrieve-context-snippets)
