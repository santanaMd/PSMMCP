import { z } from "zod";

// TODO: implement full Zod schemas matching @psmmcp/types/config

export const healthCheckSchema = z.object({
  endpoint: z.string().optional(),
  interval: z.string().default("30s"),
  timeout: z.string().default("5s"),
});

export const mcpServerSourceSchema = z.object({
  kind: z.enum(["npm", "command", "docker"]),
  package: z.string().optional(),
  image: z.string().optional(),
  ports: z.array(z.string()).optional(),
});

export const mcpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  type: z.enum(["managed", "external"]),
  transport: z.enum(["stdio", "http"]),
  source: mcpServerSourceSchema.optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  autoStart: z.boolean().default(false),
  restartPolicy: z.enum(["always", "on-failure", "never"]).default("on-failure"),
  maxRestarts: z.number().int().min(0).default(5),
  healthCheck: healthCheckSchema.optional(),
});

export const policyConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["eq", "neq", "in", "glob"]),
  value: z.union([z.string(), z.array(z.string())]),
});

export const policySchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  subjects: z.array(z.string()).min(1),
  resources: z.array(z.string()).min(1),
  actions: z.array(z.string()).min(1),
  effect: z.enum(["allow", "deny"]),
  conditions: z.array(policyConditionSchema).optional(),
});

export const localConfigSchema = z.object({
  credentialStore: z.object({
    type: z.literal("encrypted-file"),
    path: z.string(),
    masterKeyEnv: z.string(),
  }),
  auth: z.object({
    type: z.literal("jwt-local"),
    tokenExpiry: z.string().default("1h"),
  }),
});

export const serverConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().int().default(8443),
  tls: z.object({
    cert: z.string(),
    key: z.string(),
  }),
  credentialStore: z.object({
    type: z.literal("vault"),
    address: z.string().url(),
    auth: z.object({
      method: z.enum(["approle", "token"]),
      roleId: z.string().optional(),
      secretId: z.string().optional(),
      token: z.string().optional(),
    }),
    kvMount: z.string().default("psmmcp"),
  }),
  auth: z.object({
    type: z.literal("oidc"),
    providers: z.array(
      z.object({
        id: z.string(),
        issuer: z.string().url(),
        clientId: z.string(),
        audience: z.string().optional(),
      }),
    ),
  }),
});

export const clientConfigSchema = z.object({
  credentialStore: z.object({
    type: z.literal("encrypted-file"),
    path: z.string(),
    masterKeyEnv: z.string(),
  }),
});

export const configSchema = z.object({
  version: z.literal("1"),
  mode: z.enum(["local", "server"]),
  local: localConfigSchema.optional(),
  server: serverConfigSchema.optional(),
  client: clientConfigSchema.optional(),
  mcpServers: z.array(mcpServerSchema).default([]),
  policies: z.array(policySchema).default([]),
});

export type ConfigSchema = z.infer<typeof configSchema>;
