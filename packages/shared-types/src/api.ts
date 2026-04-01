import type { McpServerConfig } from "./config.js";
import type { McpServerStatus } from "./mcp.js";
import type { Policy } from "./acl.js";

// ── MCP Server API ──

export interface CreateMcpRequest {
  id: string;
  type: "managed" | "external";
  name?: string;
  transport: "stdio" | "http";
  source?: McpServerConfig["source"];
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  autoStart?: boolean;
  restartPolicy?: "always" | "on-failure" | "never";
  maxRestarts?: number;
}

export interface McpListResponse {
  mcps: McpServerStatus[];
}

// ── Secret API ──

export interface CreateSecretRequest {
  id: string;
  value: string;
  metadata?: Record<string, string>;
}

export interface SecretListResponse {
  secrets: Array<{ id: string; metadata?: Record<string, string> }>;
}

export interface RotateSecretRequest {
  value: string;
}

// ── Identity API ──

export interface CreateIdentityRequest {
  id: string;
  groups?: string[];
  roles?: string[];
  metadata?: Record<string, string>;
}

export interface IdentityListResponse {
  identities: Array<{
    id: string;
    groups: string[];
    roles: string[];
    metadata?: Record<string, string>;
  }>;
}

// ── Policy API ──

export interface CreatePolicyRequest extends Omit<Policy, "id"> {
  id: string;
}

export interface PolicyEvaluateRequest {
  identityId: string;
  resource: string;
  action: string;
  context?: Record<string, string>;
}

export interface PolicyEvaluateResponse {
  allowed: boolean;
  policyId?: string;
  reason: string;
}

// ── Token API ──

export interface IssueTokenRequest {
  identityId: string;
  scope?: string[];
  expiresIn?: string;
}

export interface IssueTokenResponse {
  token: string;
  expiresAt: string;
  tokenId: string;
}

export interface TokenListResponse {
  tokens: Array<{
    id: string;
    identityId: string;
    scope: string[];
    expiresAt: string;
    issuedAt: string;
  }>;
}

// ── System API ──

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  credentialStore: { ok: boolean; error?: string };
  mcps: Record<string, { state: string; healthStatus: string }>;
  uptime: number;
}

export interface AuditQueryParams {
  from?: string;
  to?: string;
  identity?: string;
  mcpId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export interface AuditEntry {
  timestamp: string;
  traceId?: string;
  identity: string;
  action: string;
  resource: string;
  policyId?: string;
  result: "allow" | "deny" | "error";
  details?: Record<string, unknown>;
}
