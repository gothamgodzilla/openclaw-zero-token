import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";
import { createEveBridgeHttpHandler, EVE_BRIDGE_ROUTE_PREFIX } from "./http.js";

const eveBridgePlugin = {
  id: "eve-bridge",
  name: "Eve Zero Token Bridge",
  description:
    "OpenAI-compatible /zero-token/v1 routes so Eve agents can use Zero Token web models",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerHttpRoute({
      path: EVE_BRIDGE_ROUTE_PREFIX,
      auth: "gateway",
      match: "prefix",
      handler: createEveBridgeHttpHandler(),
    });
  },
};

export default eveBridgePlugin;
