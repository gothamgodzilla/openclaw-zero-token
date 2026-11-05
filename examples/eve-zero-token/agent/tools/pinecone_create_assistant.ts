import { defineTool } from "eve/tools";
import { pineconeGatewayRequest } from "../lib/pinecone-gateway";

export default defineTool({
  description:
    "Create a Pinecone Assistant (lowercase name like docs-qa). After creating, upload documents before retrieving context.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: {
        type: "string",
        description: "1-63 lowercase letters, digits, or hyphens (e.g. docs-qa)",
      },
      instructions: {
        type: "string",
        description: "Optional behavior directive for Pinecone-hosted chat",
      },
      region: {
        type: "string",
        enum: ["us", "eu"],
        description: "Deployment region (default us)",
      },
    },
  },
  async execute(input: Record<string, unknown>) {
    return pineconeGatewayRequest("/assistants", {
      method: "POST",
      body: {
        name: input.name,
        instructions: input.instructions,
        region: input.region,
      },
    });
  },
});
