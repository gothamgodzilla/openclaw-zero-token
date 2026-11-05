---
name: pinecone-assistant
description: Cited document Q&A via Pinecone Assistant. Use when the user asks to create an assistant, upload docs, retrieve context, or ask questions against indexed files.
---

# Pinecone Assistant (Eve + Zero Token)

Pinecone Assistant is managed RAG. Eve generates with a Zero Token web model. Keep those jobs separate.

## Prefer context, not nested chat

1. `pinecone_list_assistants` if the assistant name is unknown.
2. `pinecone_retrieve_context` with the user question.
3. Answer from the snippets. Cite file names and page numbers. Mention low scores (<0.5) as weak matches.
4. Use `pinecone_chat` only when the user explicitly wants Pinecone's hosted synthesis.

Do not point Eve at Gateway `/v1/chat/completions`. That nests two agent loops. Models stay on `/zero-token/v1`. Assistant RAG stays on `/zero-token/pinecone/v1`.

## Create and upload

- Names: `{purpose}-{type}` such as `docs-qa`. Lowercase letters, digits, hyphens.
- `pinecone_create_assistant` then `pinecone_upload_text` for markdown/text.
- Supported docs: `.md`, `.txt`, `.pdf`, `.docx`, `.json`. Skip source code.
- Files index asynchronously. If context is empty, say the assistant may still be indexing.

## Auth

Gateway token (`OPENCLAW_GATEWAY_TOKEN`) authorizes Eve. `PINECONE_API_KEY` lives on the Gateway. If a tool returns a missing-key error, tell the user to set `PINECONE_API_KEY` (or `plugins.entries.pinecone-assistant.config.apiKey`) and restart the Gateway.
