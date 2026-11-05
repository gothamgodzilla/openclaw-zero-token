import {
  ensureAuthProfileStore,
  listProfilesForProvider,
  type AuthProfileCredential,
  type AuthProfileStore,
} from "../../agents/auth-profiles.js";

export function credentialFromProfile(credential: AuthProfileCredential): string | null {
  if (credential.type === "api_key" && credential.key) {
    return credential.key;
  }
  if (credential.type === "token" && credential.token) {
    return credential.token;
  }
  if (credential.type === "oauth") {
    return JSON.stringify(credential);
  }
  return null;
}

export function resolveWebProviderCredential(
  providerId: string,
  store: AuthProfileStore = ensureAuthProfileStore(),
): string | null {
  const profileIds = listProfilesForProvider(store, providerId);
  for (const profileId of profileIds) {
    const credential = store.profiles[profileId];
    if (!credential) {
      continue;
    }
    const value = credentialFromProfile(credential);
    if (value) {
      return value;
    }
  }
  return null;
}
