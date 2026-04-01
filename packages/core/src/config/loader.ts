import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { PsmmcpConfig } from "@psmmcp/types/config";
import { configSchema } from "./schema.js";
import { ConfigError } from "../errors.js";

const ENV_PLACEHOLDER_RE = /\{\{env:([a-zA-Z0-9_]+)\}\}/g;

export class ConfigLoader {
  async load(filePath: string): Promise<PsmmcpConfig> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch (err) {
      throw new ConfigError(
        `Failed to read config file: ${filePath}`,
        err instanceof Error ? err : undefined,
      );
    }

    const resolved = this.resolveEnvPlaceholders(raw);

    let parsed: unknown;
    try {
      parsed = parseYaml(resolved);
    } catch (err) {
      throw new ConfigError(
        `Failed to parse YAML: ${filePath}`,
        err instanceof Error ? err : undefined,
      );
    }

    return this.validate(parsed);
  }

  resolveEnvPlaceholders(input: string): string {
    return input.replace(ENV_PLACEHOLDER_RE, (_match, envVar: string) => {
      const value = process.env[envVar];
      if (value === undefined) {
        throw new ConfigError(`Environment variable not set: ${envVar}`);
      }
      return value;
    });
  }

  validate(data: unknown): PsmmcpConfig {
    const result = configSchema.safeParse(data);
    if (!result.success) {
      const messages = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new ConfigError(`Invalid configuration: ${messages}`);
    }
    return result.data as PsmmcpConfig;
  }
}
