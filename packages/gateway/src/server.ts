import type { PsmmcpConfig } from "@psmmcp/types/config";

export class GatewayServer {
  constructor(private readonly _config: PsmmcpConfig) {}

  // TODO: implement
  // 1. Create Fastify with TLS
  // 2. Register auth middleware
  // 3. Initialize MCP Manager (start managed MCPs)
  // 4. Mount psmmcp-mcp at /mcp (Streamable HTTP transport)
  // 5. Mount Control Plane API at /api/v1/*
  // 6. Mount /health, /ready, /metrics
  // 7. Listen
  async start(): Promise<void> {
    throw new Error("Not implemented");
  }

  async stop(): Promise<void> {
    throw new Error("Not implemented");
  }
}
