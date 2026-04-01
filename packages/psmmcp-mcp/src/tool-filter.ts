import type { IAclEngine } from "@psmmcp/types/acl";
import type { Identity } from "@psmmcp/types/auth";

export class ToolFilter {
  constructor(private readonly _aclEngine: IAclEngine) {}

  filterToolsForIdentity(
    identity: Identity,
    mcpId: string,
    tools: Array<{ name: string; [key: string]: unknown }>,
  ): Array<{ name: string; [key: string]: unknown }> {
    return this._aclEngine.filterTools(identity, mcpId, tools);
  }

  filterResourcesForIdentity(
    identity: Identity,
    mcpId: string,
    resources: Array<{ uri: string; [key: string]: unknown }>,
  ): Array<{ uri: string; [key: string]: unknown }> {
    return this._aclEngine.filterResources(identity, mcpId, resources);
  }

  canCallTool(identity: Identity, mcpId: string, toolName: string): boolean {
    const decision = this._aclEngine.evaluate(
      identity,
      `mcp:${mcpId}`,
      "tools/call",
      { "tool.name": toolName },
    );
    return decision.allowed;
  }

  canReadResource(identity: Identity, mcpId: string, uri: string): boolean {
    const decision = this._aclEngine.evaluate(
      identity,
      `mcp:${mcpId}`,
      "resources/read",
      { "resource.uri": uri },
    );
    return decision.allowed;
  }
}
