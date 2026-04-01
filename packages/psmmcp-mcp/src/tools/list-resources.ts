import type { Identity } from "@psmmcp/types/auth";
import type { Aggregator } from "../aggregator.js";
import type { ToolFilter } from "../tool-filter.js";
import { Namespace } from "../namespace.js";

export async function listResources(
  identity: Identity,
  aggregator: Aggregator,
  toolFilter: ToolFilter,
): Promise<Array<{ uri: string; name?: string; description?: string; mimeType?: string }>> {
  const allResources = await aggregator.aggregateResources();
  const result: Array<{ uri: string; name?: string; description?: string; mimeType?: string }> = [];

  for (const [mcpId, resources] of allResources) {
    const allowed = toolFilter.filterResourcesForIdentity(identity, mcpId, resources);

    for (const resource of allowed) {
      result.push({
        uri: Namespace.toNamespaced(mcpId, resource.uri),
        name: resource.name ? `[${mcpId}] ${resource.name}` : undefined,
        description: resource.description,
        mimeType: resource.mimeType,
      });
    }
  }

  return result;
}
