import { buildPluginConfigSchema, type OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import type { PineconeAssistantPluginConfig } from "../../../pinecone/config.js";
import { createPineconeAssistantHttpHandler, PINECONE_ASSISTANT_ROUTE_PREFIX } from "./http.js";

const pineconeAssistantPlugin = {
  id: "pinecone-assistant",
  name: "Pinecone Assistant",
  description:
    "Cited RAG via Pinecone Assistant so Eve agents can retrieve context while generating with Zero Token web models",
  configSchema: buildPluginConfigSchema(
    z
      .object({
        apiKey: z.string().optional(),
        defaultAssistant: z.string().optional(),
        controlPlaneUrl: z.string().optional(),
        dataHost: z.string().optional(),
      })
      .strict(),
  ),
  register(api: OpenClawPluginApi) {
    api.registerHttpRoute({
      path: PINECONE_ASSISTANT_ROUTE_PREFIX,
      auth: "gateway",
      match: "prefix",
      handler: createPineconeAssistantHttpHandler({
        pluginConfig: api.pluginConfig as PineconeAssistantPluginConfig | undefined,
      }),
    });
  },
};

export default pineconeAssistantPlugin;
