import { defineTool } from "eve/tools";
import { defaultPineconeAssistant, pineconeGatewayRequest } from "../lib/pinecone-gateway";

export default defineTool({
  description:
    "Retrieve cited context snippets from a Pinecone Assistant. Prefer this over pinecone_chat so the Zero Token web model writes the answer.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string", description: "Search query or user question" },
      assistant: {
        type: "string",
        description: "Assistant name. Defaults to PINECONE_ASSISTANT.",
      },
      top_k: {
        type: "integer",
        minimum: 1,
        maximum: 16,
        description: "Number of snippets (default 5, max 16)",
      },
      snippet_size: {
        type: "integer",
        minimum: 512,
        maximum: 8192,
        description: "Max tokens per snippet (default 2048)",
      },
    },
  },
  async execute(input: Record<string, unknown>) {
    const assistant = defaultPineconeAssistant(
      typeof input.assistant === "string" ? input.assistant : undefined,
    );
    if (!assistant) {
      throw new Error("Pass assistant or set PINECONE_ASSISTANT");
    }
    return pineconeGatewayRequest(`/assistants/${encodeURIComponent(assistant)}/context`, {
      method: "POST",
      body: {
        query: input.query,
        top_k: input.top_k,
        snippet_size: input.snippet_size,
      },
    });
  },
});
