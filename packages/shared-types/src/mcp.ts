/** State of a managed or external MCP server. */
export type McpServerState =
  | "created"
  | "running"
  | "stopped"
  | "error"
  | "external";

/** Runtime status of an MCP server in the registry. */
export interface McpServerStatus {
  id: string;
  name?: string;
  type: "managed" | "external";
  state: McpServerState;
  transport: "stdio" | "http";
  pid?: number;
  containerId?: string;
  url?: string;
  uptime?: number;
  restartCount: number;
  lastError?: string;
  healthStatus: "healthy" | "unhealthy" | "unknown";
  lastHealthCheck?: Date;
}

/** A namespaced tool reference: mcp_id + tool_name. */
export interface NamespacedTool {
  mcpId: string;
  toolName: string;
  namespacedName: string;
}

/** Input for the call_tool meta-tool. */
export interface CallToolInput {
  mcp: string;
  tool: string;
  arguments: Record<string, unknown>;
}

/** Input for the read_resource meta-tool. */
export interface ReadResourceInput {
  mcp: string;
  uri: string;
}

/** MCP backend abstraction — the contract a backend must satisfy. */
export interface IMcpBackend {
  readonly id: string;
  readonly state: McpServerState;

  start(): Promise<void>;
  stop(): Promise<void>;

  listTools(): Promise<Array<{ name: string; description?: string; inputSchema: unknown }>>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;

  listResources(): Promise<Array<{ uri: string; name?: string; description?: string; mimeType?: string }>>;
  readResource(uri: string): Promise<unknown>;
}
