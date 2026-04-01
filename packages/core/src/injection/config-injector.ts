import type { ICredentialStore } from "@psmmcp/types/credentials";
import { SecretResolver, type SecretResolverStores } from "./resolver.js";

export class ConfigInjector {
  private readonly _resolver: SecretResolver;

  constructor(stores: SecretResolverStores | ICredentialStore) {
    this._resolver = new SecretResolver(stores);
  }

  async injectHeaders(
    headers: Record<string, string>,
  ): Promise<{ headers: Record<string, string>; secretValues: Set<string> }> {
    return this._resolver.resolveRecord(headers);
  }

  async injectUrl(
    url: string,
  ): Promise<{ url: string; secretValues: Set<string> }> {
    const result = await this._resolver.resolveString(url);
    return { url: result.resolved, secretValues: result.secretValues };
  }
}
