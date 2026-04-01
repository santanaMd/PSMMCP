import type { IMcpBackend } from "@psmmcp/types/mcp";

export interface ToolDescriptor {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface ResourceDescriptor {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export class Aggregator {
  private readonly _backends = new Map<string, IMcpBackend>();
  private readonly _toolsCache = new Map<string, ToolDescriptor[]>();
  private readonly _resourcesCache = new Map<string, ResourceDescriptor[]>();

  registerBackend(id: string, backend: IMcpBackend): void {
    this._backends.set(id, backend);
    this._toolsCache.delete(id);
    this._resourcesCache.delete(id);
  }

  removeBackend(id: string): void {
    this._backends.delete(id);
    this._toolsCache.delete(id);
    this._resourcesCache.delete(id);
  }

  getBackend(id: string): IMcpBackend | undefined {
    return this._backends.get(id);
  }

  listBackendIds(): string[] {
    return Array.from(this._backends.keys());
  }

  async aggregateTools(): Promise<Map<string, ToolDescriptor[]>> {
    const results = new Map<string, ToolDescriptor[]>();

    const entries = Array.from(this._backends.entries());
    const settled = await Promise.allSettled(
      entries.map(async ([id, backend]) => {
        if (backend.state !== "running" && backend.state !== "external") return { id, tools: [] };
        try {
          const tools = await backend.listTools();
          this._toolsCache.set(id, tools);
          return { id, tools };
        } catch {
          // Use cache on failure
          return { id, tools: this._toolsCache.get(id) || [] };
        }
      }),
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.set(result.value.id, result.value.tools);
      }
    }

    return results;
  }

  async aggregateResources(): Promise<Map<string, ResourceDescriptor[]>> {
    const results = new Map<string, ResourceDescriptor[]>();

    const entries = Array.from(this._backends.entries());
    const settled = await Promise.allSettled(
      entries.map(async ([id, backend]) => {
        if (backend.state !== "running" && backend.state !== "external") return { id, resources: [] };
        try {
          const resources = await backend.listResources();
          this._resourcesCache.set(id, resources);
          return { id, resources };
        } catch {
          return { id, resources: this._resourcesCache.get(id) || [] };
        }
      }),
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.set(result.value.id, result.value.resources);
      }
    }

    return results;
  }

  invalidateCache(mcpId?: string): void {
    if (mcpId) {
      this._toolsCache.delete(mcpId);
      this._resourcesCache.delete(mcpId);
    } else {
      this._toolsCache.clear();
      this._resourcesCache.clear();
    }
  }
}
