import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/credentials/index.ts",
    "src/auth/index.ts",
    "src/acl/index.ts",
    "src/injection/index.ts",
    "src/config/index.ts",
    "src/audit/index.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["@psmmcp/types"],
});
