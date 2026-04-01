import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    "@psmmcp/types",
    "@psmmcp/core",
    "@psmmcp/mcp",
    "@modelcontextprotocol/sdk",
    "fastify",
    "@fastify/rate-limit",
    "cockatiel",
    "pino",
    "prom-client",
    "@opentelemetry/sdk-node",
    "@opentelemetry/auto-instrumentations-node",
  ],
});
