import type { Identity } from "@psmmcp/types/auth";
import type { Aggregator } from "../aggregator.js";
import type { ToolFilter } from "../tool-filter.js";
import { Namespace } from "../namespace.js";

export async function listTools(
  identity: Identity,
  aggregator: Aggregator,
  toolFilter: ToolFilter,
): Promise<Array<{ name: string; description?: string; inputSchema: unknown }>> {
  const allTools = await aggregator.aggregateTools();
  const result: Array<{ name: string; description?: string; inputSchema: unknown }> = [];

  for (const [mcpId, tools] of allTools) {
    const allowed = toolFilter.filterToolsForIdentity(identity, mcpId, tools);

    for (const tool of allowed) {
      result.push({
        name: Namespace.toNamespaced(mcpId, tool.name),
        description: tool.description
          ? `[${mcpId}] ${tool.description}`
          : `[${mcpId}] ${tool.name}`,
        inputSchema: tool.inputSchema,
      });
    }
  }

  return result;
}
