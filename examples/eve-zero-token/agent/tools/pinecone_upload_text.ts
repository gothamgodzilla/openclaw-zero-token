import { defineTool } from "eve/tools";
import { defaultPineconeAssistant, pineconeGatewayRequest } from "../lib/pinecone-gateway";

export default defineTool({
  description:
    "Upload a markdown or text document into a Pinecone Assistant so later context retrieval can cite it. Not for source code.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      assistant: {
        type: "string",
        description: "Assistant name. Defaults to PINECONE_ASSISTANT.",
      },
      name: {
        type: "string",
        description: "Filename, e.g. overview.md",
      },
      text: { type: "string", description: "Document body (markdown or plain text)" },
    },
  },
  async execute(input: Record<string, unknown>) {
    const assistant = defaultPineconeAssistant(
      typeof input.assistant === "string" ? input.assistant : undefined,
    );
    if (!assistant) {
      throw new Error("Pass assistant or set PINECONE_ASSISTANT");
    }
    return pineconeGatewayRequest(`/assistants/${encodeURIComponent(assistant)}/files`, {
      method: "POST",
      body: {
        name: input.name ?? "note.md",
        text: input.text,
      },
    });
  },
});
