import type {
  ICredentialStore,
  SecretRef,
  ResolvedSecret,
} from "@psmmcp/types/credentials";
import { SecretNotFoundError, PsmmcpError } from "../errors.js";

export interface VaultOptions {
  address: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  kvMount: string;
  pathPrefix?: string;
}

export class VaultCredentialStore implements ICredentialStore {
  private _client: ReturnType<typeof import("node-vault")["default"]> | null = null;
  private readonly _options: VaultOptions;

  constructor(options: VaultOptions) {
    this._options = options;
  }

  private async _getClient() {
    if (this._client) return this._client;

    const vault = (await import("node-vault")).default;
    this._client = vault({
      apiVersion: "v1",
      endpoint: this._options.address,
      token: this._options.token,
    });

    if (this._options.roleId && this._options.secretId) {
      const authResult = await this._client.approleLogin({
        role_id: this._options.roleId,
        secret_id: this._options.secretId,
      });
      this._client = vault({
        apiVersion: "v1",
        endpoint: this._options.address,
        token: authResult.auth.client_token,
      });
    }

    return this._client;
  }

  private _path(id: string): string {
    const prefix = this._options.pathPrefix || "psmmcp";
    return `${this._options.kvMount}/data/${prefix}/${id}`;
  }

  private _metadataPath(id: string): string {
    const prefix = this._options.pathPrefix || "psmmcp";
    return `${this._options.kvMount}/metadata/${prefix}/${id}`;
  }

  private _listPath(): string {
    const prefix = this._options.pathPrefix || "psmmcp";
    return `${this._options.kvMount}/metadata/${prefix}`;
  }

  async get(ref: Pick<SecretRef, "id">): Promise<ResolvedSecret | null> {
    const client = await this._getClient();
    try {
      const result = await client.read(this._path(ref.id));
      const data = result.data?.data;
      if (!data?.value) return null;
      return {
        ref: {
          id: ref.id,
          store: "vault",
          version: result.data?.metadata?.version,
          metadata: data.metadata,
        },
        value: data.value,
        expiresAt: result.lease_duration
          ? new Date(Date.now() + result.lease_duration * 1000)
          : undefined,
      };
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) return null;
      throw new PsmmcpError(
        `Vault read failed for secret: ${ref.id}`,
        "VAULT_ERROR",
        err instanceof Error ? err : undefined,
      );
    }
  }

  async put(
    id: string,
    value: string,
    metadata?: Record<string, string>,
  ): Promise<SecretRef> {
    const client = await this._getClient();
    try {
      const result = await client.write(this._path(id), {
        data: { value, metadata },
      });
      return {
        id,
        store: "vault",
        version: result?.data?.version,
        metadata,
      };
    } catch (err) {
      throw new PsmmcpError(
        `Vault write failed for secret: ${id}`,
        "VAULT_ERROR",
        err instanceof Error ? err : undefined,
      );
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this._getClient();
    try {
      await client.delete(this._metadataPath(id));
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) throw new SecretNotFoundError(id);
      throw new PsmmcpError(
        `Vault delete failed for secret: ${id}`,
        "VAULT_ERROR",
        err instanceof Error ? err : undefined,
      );
    }
  }

  async list(): Promise<SecretRef[]> {
    const client = await this._getClient();
    try {
      const result = await client.list(this._listPath());
      const keys: string[] = result.data?.keys || [];
      return keys
        .filter((k) => !k.endsWith("/"))
        .map((id) => ({ id, store: "vault" as const }));
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) return [];
      throw new PsmmcpError(
        "Vault list failed",
        "VAULT_ERROR",
        err instanceof Error ? err : undefined,
      );
    }
  }

  async health(): Promise<{ ok: boolean; error?: string }> {
    try {
      const client = await this._getClient();
      await client.health();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Vault unreachable",
      };
    }
  }
}
