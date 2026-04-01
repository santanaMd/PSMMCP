import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: [
    "@psmmcp/types",
    "@psmmcp/core",
    "@psmmcp/mcp",
    "@psmmcp/stdio-proxy",
    "@psmmcp/gateway",
    "commander",
  ],
});
