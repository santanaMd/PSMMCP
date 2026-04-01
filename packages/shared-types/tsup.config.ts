import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/credentials.ts",
    "src/auth.ts",
    "src/acl.ts",
    "src/config.ts",
    "src/mcp.ts",
    "src/api.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
