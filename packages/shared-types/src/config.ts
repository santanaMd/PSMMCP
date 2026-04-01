import type { CredentialStoreType } from "./credentials.js";
import type { AuthType } from "./auth.js";
import type { Policy } from "./acl.js";

export interface PsmmcpConfig {
  version: "1";
  mode: "local" | "server";
  local?: LocalConfig;
  server?: ServerConfig;
  client?: ClientConfig;
  mcpServers: McpServerConfig[];
  policies: Policy[];
}

/**
 * Local credential store — available in BOTH modes.
 *
 * This is where `psmmcp secret add` stores secrets by default.
 * Always an encrypted file on the user's machine.
 *
 * In server mode, server-side secrets (Vault) are accessed via
 * `psmmcp server secret add` and referenced as {{server-secret:xxx}}.
 * Local secrets are referenced as {{secret:xxx}}.
 */
export interface ClientConfig {
  credentialStore: {
    type: Extract<CredentialStoreType, "encrypted-file">;
    path: string;
    masterKeyEnv: string;
  };
}

export interface LocalConfig {
  credentialStore: {
    type: Extract<CredentialStoreType, "encrypted-file">;
    path: string;
    masterKeyEnv: string;
  };
  auth: {
    type: Extract<AuthType, "jwt-local">;
    tokenExpiry: string;
  };
}

export interface ServerConfig {
  host: string;
  port: number;
  tls: {
    cert: string;
    key: string;
  };
  credentialStore: {
    type: Extract<CredentialStoreType, "vault">;
    address: string;
    auth: VaultAuthConfig;
    kvMount: string;
  };
  auth: {
    type: Extract<AuthType, "oidc">;
    providers: OidcProviderConfig[];
  };
  tenants?: TenantConfig[];
}

export interface VaultAuthConfig {
  method: "approle" | "token";
  roleId?: string;
  secretId?: string;
  token?: string;
}

export interface OidcProviderConfig {
  id: string;
  issuer: string;
  clientId: string;
  audience?: string;
}

export interface TenantConfig {
  id: string;
  oidcProvider: string;
  allowedServers: string[];
  secretsPrefix: string;
}

export interface McpServerConfig {
  id: string;
  name?: string;
  type: "managed" | "external";
  transport: "stdio" | "http";

  // Managed fields
  source?: McpServerSource;
  command?: string;
  args?: string[];
  autoStart?: boolean;
  restartPolicy?: "always" | "on-failure" | "never";
  maxRestarts?: number;

  // External fields
  url?: string;
  headers?: Record<string, string>;

  // Common
  env?: Record<string, string>;
  healthCheck?: HealthCheckConfig;
}

export interface McpServerSource {
  kind: "npm" | "command" | "docker";
  package?: string;
  image?: string;
  ports?: string[];
}

export interface HealthCheckConfig {
  endpoint?: string;
  interval: string;
  timeout: string;
}
