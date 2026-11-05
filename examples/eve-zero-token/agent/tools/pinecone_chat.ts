import { defineTool } from "eve/tools";
import { defaultPineconeAssistant, pineconeGatewayRequest } from "../lib/pinecone-gateway";

export default defineTool({
  description:
    "Ask Pinecone Assistant's hosted model for a cited answer. Nested LLM: only use when the user wants Pinecone's own synthesis, not a Zero Token web-model answer.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["message"],
    properties: {
      message: { type: "string", description: "Question for the Pinecone Assistant" },
      assistant: {
        type: "string",
        description: "Assistant name. Defaults to PINECONE_ASSISTANT.",
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
    return pineconeGatewayRequest(`/assistants/${encodeURIComponent(assistant)}/chat`, {
      method: "POST",
      body: { message: input.message },
    });
  },
});
