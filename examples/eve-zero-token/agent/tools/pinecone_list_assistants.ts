import { defineTool } from "eve/tools";
import { pineconeGatewayRequest } from "../lib/pinecone-gateway";

export default defineTool({
  description:
    "List Pinecone Assistants available on the OpenClaw Gateway. Use this when the user says my assistant, or before retrieving context.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  async execute() {
    return pineconeGatewayRequest("/assistants");
  },
});
