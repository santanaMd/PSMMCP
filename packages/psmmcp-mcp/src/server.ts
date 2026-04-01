import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { IAclEngine } from "@psmmcp/types/acl";
import type { Identity } from "@psmmcp/types/auth";
import type { IMcpBackend } from "@psmmcp/types/mcp";
import { CredentialGate } from "@psmmcp/core";
import { Aggregator } from "./aggregator.js";
import { ToolFilter } from "./tool-filter.js";
import { Namespace } from "./namespace.js";
import { listTools } from "./tools/list-tools.js";
import { callTool } from "./tools/call-tool.js";
import { listResources } from "./tools/list-resources.js";
import { readResource } from "./tools/read-resource.js";

export interface PsmmcpMcpServerOptions {
  aclEngine: IAclEngine;
  backends: Map<string, IMcpBackend>;
  identity: Identity;
  credentialGate: CredentialGate;
}

export class PsmmcpMcpServer {
  private readonly _mcpServer: McpServer;
  private readonly _aggregator: Aggregator;
  private readonly _toolFilter: ToolFilter;
  private readonly _credentialGate: CredentialGate;
  private readonly _identity: Identity;

  constructor(options: PsmmcpMcpServerOptions) {
    this._identity = options.identity;
    this._credentialGate = options.credentialGate;

    this._aggregator = new Aggregator();
    for (const [id, backend] of options.backends) {
      this._aggregator.registerBackend(id, backend);
    }

    this._toolFilter = new ToolFilter(options.aclEngine);

    this._mcpServer = new McpServer({
      name: "psmmcp",
      version: "0.1.0",
    });

    this._registerTools();
  }

  get server(): McpServer {
    return this._mcpServer;
  }

  private _registerTools(): void {
    this._mcpServer.tool(
      "list_tools",
      "List all available tools from all MCP servers you have access to",
      {},
      async () => {
        const tools = await listTools(
          this._identity,
          this._aggregator,
          this._toolFilter,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(tools, null, 2),
            },
          ],
        };
      },
    );

    this._mcpServer.tool(
      "call_tool",
      "Call a tool on a specific MCP server",
      {
        mcp: z.string().describe("MCP server ID"),
        tool: z.string().describe("Tool name"),
        arguments: z.record(z.unknown()).describe("Tool arguments").default({}),
      },
      async ({ mcp, tool, arguments: args }) => {
        const { result, redactedCount } = await callTool(
          this._identity,
          { mcp, tool, arguments: args as Record<string, unknown> },
          this._aggregator,
          this._toolFilter,
          this._credentialGate,
        );

        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);

        return {
          content: [{ type: "text" as const, text }],
          ...(redactedCount > 0 && {
            _meta: { redactedSecrets: redactedCount },
          }),
        };
      },
    );

    this._mcpServer.tool(
      "list_resources",
      "List all available resources from all MCP servers you have access to",
      {},
      async () => {
        const resources = await listResources(
          this._identity,
          this._aggregator,
          this._toolFilter,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(resources, null, 2),
            },
          ],
        };
      },
    );

    this._mcpServer.tool(
      "read_resource",
      "Read a resource from a specific MCP server",
      {
        mcp: z.string().describe("MCP server ID"),
        uri: z.string().describe("Resource URI"),
      },
      async ({ mcp, uri }) => {
        const { result, redactedCount } = await readResource(
          this._identity,
          { mcp, uri },
          this._aggregator,
          this._toolFilter,
          this._credentialGate,
        );

        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);

        return {
          content: [{ type: "text" as const, text }],
          ...(redactedCount > 0 && {
            _meta: { redactedSecrets: redactedCount },
          }),
        };
      },
    );
  }
}
