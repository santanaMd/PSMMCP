import type { Identity } from "@psmmcp/types/auth";
import type { CallToolInput } from "@psmmcp/types/mcp";
import { AclDeniedError, McpBackendError } from "@psmmcp/core";
import type { CredentialGate } from "@psmmcp/core";
import type { Aggregator } from "../aggregator.js";
import type { ToolFilter } from "../tool-filter.js";

export async function callTool(
  identity: Identity,
  input: CallToolInput,
  aggregator: Aggregator,
  toolFilter: ToolFilter,
  credentialGate: CredentialGate,
): Promise<{ result: unknown; redactedCount: number }> {
  // 1. Check ACL
  if (!toolFilter.canCallTool(identity, input.mcp, input.tool)) {
    throw new AclDeniedError(
      identity.subject,
      `mcp:${input.mcp}`,
      `tools/call:${input.tool}`,
    );
  }

  // 2. Get backend
  const backend = aggregator.getBackend(input.mcp);
  if (!backend) {
    throw new McpBackendError(input.mcp, "MCP backend not found");
  }

  // 3. Call tool on backend
  let rawResult: unknown;
  try {
    rawResult = await backend.callTool(input.tool, input.arguments);
  } catch (err) {
    throw new McpBackendError(
      input.mcp,
      `Tool call failed: ${input.tool}`,
      err instanceof Error ? err : undefined,
    );
  }

  // 4. Scan response through credential gate
  const { cleaned, redactedCount } = credentialGate.scan(rawResult);

  return { result: cleaned, redactedCount };
}
