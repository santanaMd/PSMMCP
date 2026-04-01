import type { ICredentialStore } from "@psmmcp/types/credentials";
import { SecretResolver, type SecretResolverStores } from "./resolver.js";

export class EnvInjector {
  private readonly _resolver: SecretResolver;

  constructor(stores: SecretResolverStores | ICredentialStore) {
    this._resolver = new SecretResolver(stores);
  }

  async inject(
    envTemplate: Record<string, string>,
  ): Promise<{ env: Record<string, string>; secretValues: Set<string> }> {
    return this._resolver.resolveRecord(envTemplate);
  }
}
