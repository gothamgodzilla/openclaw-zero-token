import { PineconeAssistantError } from "./client.js";

export type PineconeAssistantPluginConfig = {
  apiKey?: unknown;
  defaultAssistant?: unknown;
  controlPlaneUrl?: unknown;
  dataHost?: unknown;
};

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function resolvePineconeApiKey(params: {
  pluginConfig?: PineconeAssistantPluginConfig;
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  const env = params.env ?? process.env;
  return asNonEmptyString(params.pluginConfig?.apiKey) || asNonEmptyString(env.PINECONE_API_KEY);
}

export function requirePineconeApiKey(params: {
  pluginConfig?: PineconeAssistantPluginConfig;
  env?: NodeJS.ProcessEnv;
}): string {
  const apiKey = resolvePineconeApiKey(params);
  if (!apiKey) {
    throw new PineconeAssistantError(
      503,
      "unauthenticated",
      "Set PINECONE_API_KEY or plugins.entries.pinecone-assistant.config.apiKey",
    );
  }
  return apiKey;
}

export function resolveDefaultAssistant(params: {
  pluginConfig?: PineconeAssistantPluginConfig;
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  const env = params.env ?? process.env;
  return (
    asNonEmptyString(params.pluginConfig?.defaultAssistant) ||
    asNonEmptyString(env.PINECONE_ASSISTANT)
  );
}

export function resolveControlPlaneUrl(params: {
  pluginConfig?: PineconeAssistantPluginConfig;
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  const env = params.env ?? process.env;
  return (
    asNonEmptyString(params.pluginConfig?.controlPlaneUrl) ||
    asNonEmptyString(env.PINECONE_CONTROL_PLANE_URL)
  );
}

export function resolveDataHost(params: {
  pluginConfig?: PineconeAssistantPluginConfig;
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  const env = params.env ?? process.env;
  return (
    asNonEmptyString(params.pluginConfig?.dataHost) || asNonEmptyString(env.PINECONE_ASSISTANT_HOST)
  );
}
