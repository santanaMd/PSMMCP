import type { Identity } from "@psmmcp/types/auth";
import type { ReadResourceInput } from "@psmmcp/types/mcp";
import { AclDeniedError, McpBackendError } from "@psmmcp/core";
import type { CredentialGate } from "@psmmcp/core";
import type { Aggregator } from "../aggregator.js";
import type { ToolFilter } from "../tool-filter.js";

export async function readResource(
  identity: Identity,
  input: ReadResourceInput,
  aggregator: Aggregator,
  toolFilter: ToolFilter,
  credentialGate: CredentialGate,
): Promise<{ result: unknown; redactedCount: number }> {
  if (!toolFilter.canReadResource(identity, input.mcp, input.uri)) {
    throw new AclDeniedError(
      identity.subject,
      `mcp:${input.mcp}`,
      `resources/read:${input.uri}`,
    );
  }

  const backend = aggregator.getBackend(input.mcp);
  if (!backend) {
    throw new McpBackendError(input.mcp, "MCP backend not found");
  }

  let rawResult: unknown;
  try {
    rawResult = await backend.readResource(input.uri);
  } catch (err) {
    throw new McpBackendError(
      input.mcp,
      `Resource read failed: ${input.uri}`,
      err instanceof Error ? err : undefined,
    );
  }

  const { cleaned, redactedCount } = credentialGate.scan(rawResult);
  return { result: cleaned, redactedCount };
}
