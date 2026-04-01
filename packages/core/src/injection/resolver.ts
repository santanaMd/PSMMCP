import type { ICredentialStore } from "@psmmcp/types/credentials";
import { SecretNotFoundError, SecretResolutionError } from "../errors.js";

/** Matches {{secret:id}} — resolves from local credential store */
export const SECRET_PLACEHOLDER_RE =
  /\{\{secret:([a-zA-Z0-9_-]+)\}\}/g;

/** Matches {{server-secret:id}} — resolves from server-side store (Vault) */
export const SERVER_SECRET_PLACEHOLDER_RE =
  /\{\{server-secret:([a-zA-Z0-9_-]+)\}\}/g;

export interface SecretResolverStores {
  local: ICredentialStore;
  server?: ICredentialStore;
}

export class SecretResolver {
  private readonly _localStore: ICredentialStore;
  private readonly _serverStore: ICredentialStore | undefined;

  constructor(stores: SecretResolverStores | ICredentialStore) {
    if ("local" in stores) {
      this._localStore = stores.local;
      this._serverStore = stores.server;
    } else {
      this._localStore = stores;
    }
  }

  async resolveString(input: string): Promise<{ resolved: string; secretValues: Set<string> }> {
    const secretValues = new Set<string>();
    let result = input;

    const localMatches = [...input.matchAll(new RegExp(SECRET_PLACEHOLDER_RE.source, "g"))];
    for (const match of localMatches) {
      const secretId = match[1];
      const secret = await this._localStore.get({ id: secretId });
      if (!secret) throw new SecretNotFoundError(secretId);
      secretValues.add(secret.value);
      result = result.replace(match[0], secret.value);
    }

    const serverMatches = [...input.matchAll(new RegExp(SERVER_SECRET_PLACEHOLDER_RE.source, "g"))];
    for (const match of serverMatches) {
      const secretId = match[1];
      if (!this._serverStore) {
        throw new SecretResolutionError(
          match[0],
          new Error("Server credential store not configured — cannot resolve {{server-secret:...}}"),
        );
      }
      const secret = await this._serverStore.get({ id: secretId });
      if (!secret) throw new SecretNotFoundError(secretId);
      secretValues.add(secret.value);
      result = result.replace(match[0], secret.value);
    }

    return { resolved: result, secretValues };
  }

  async resolveRecord(
    input: Record<string, string>,
  ): Promise<{ resolved: Record<string, string>; secretValues: Set<string> }> {
    const resolved: Record<string, string> = {};
    const allSecrets = new Set<string>();

    for (const [key, value] of Object.entries(input)) {
      const result = await this.resolveString(value);
      resolved[key] = result.resolved;
      for (const s of result.secretValues) allSecrets.add(s);
    }

    return { resolved, secretValues: allSecrets };
  }

  async resolveObject(
    input: Record<string, unknown>,
  ): Promise<{ resolved: Record<string, unknown>; secretValues: Set<string> }> {
    const allSecrets = new Set<string>();

    const resolve = async (value: unknown): Promise<unknown> => {
      if (typeof value === "string") {
        const result = await this.resolveString(value);
        for (const s of result.secretValues) allSecrets.add(s);
        return result.resolved;
      }
      if (Array.isArray(value)) {
        return Promise.all(value.map(resolve));
      }
      if (value !== null && typeof value === "object") {
        const entries = await Promise.all(
          Object.entries(value as Record<string, unknown>).map(
            async ([k, v]) => [k, await resolve(v)] as const,
          ),
        );
        return Object.fromEntries(entries);
      }
      return value;
    };

    const resolved = (await resolve(input)) as Record<string, unknown>;
    return { resolved, secretValues: allSecrets };
  }
}
