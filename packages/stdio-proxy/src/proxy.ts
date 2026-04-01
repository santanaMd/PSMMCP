import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { PsmmcpConfig, McpServerConfig } from "@psmmcp/types/config";
import type { IMcpBackend, McpServerState } from "@psmmcp/types/mcp";
import type { Identity } from "@psmmcp/types/auth";
import {
  JwtIssuer,
  AclEngine,
  CredentialGate,
  EnvInjector,
  EncryptedFileCredentialStore,
  ConfigLoader,
  AuthError,
} from "@psmmcp/core";
import { PsmmcpMcpServer } from "@psmmcp/mcp";
import { ProcessManager } from "./process-manager.js";

class StdioMcpBackend implements IMcpBackend {
  readonly id: string;
  private _state: McpServerState = "created";

  constructor(id: string) {
    this.id = id;
  }

  get state() {
    return this._state;
  }
  set state(s: McpServerState) {
    this._state = s;
  }

  async start() {
    this._state = "running";
  }
  async stop() {
    this._state = "stopped";
  }
  async listTools() {
    return [];
  }
  async callTool(_name: string, _args: Record<string, unknown>) {
    return {};
  }
  async listResources() {
    return [];
  }
  async readResource(_uri: string) {
    return {};
  }
}

export class StdioProxy {
  private readonly _config: PsmmcpConfig;
  private _psmmcpServer: PsmmcpMcpServer | null = null;
  private readonly _processManager = new ProcessManager();

  constructor(config: PsmmcpConfig) {
    this._config = config;
  }

  static async fromConfigFile(configPath: string): Promise<StdioProxy> {
    const loader = new ConfigLoader();
    const config = await loader.load(configPath);
    return new StdioProxy(config);
  }

  async start(): Promise<void> {
    // 1. Authenticate — verify JWT from PSMMCP_TOKEN env var
    const identity = await this._authenticate();

    // 2. Initialize credential store
    const localConfig = this._config.local || this._config.client;
    if (!localConfig?.credentialStore) {
      throw new Error("No credential store configured for local mode");
    }

    const masterKeyHex = process.env[localConfig.credentialStore.masterKeyEnv];
    if (!masterKeyHex) {
      throw new Error(
        `Master key env var not set: ${localConfig.credentialStore.masterKeyEnv}`,
      );
    }

    const store = new EncryptedFileCredentialStore({
      filePath: localConfig.credentialStore.path,
      masterKey: Buffer.from(masterKeyHex, "hex"),
    });

    // 3. Initialize ACL engine
    const aclEngine = new AclEngine(this._config.policies);

    // 4. Start MCP backends
    const envInjector = new EnvInjector(store);
    const backends = new Map<string, IMcpBackend>();
    const allSecretValues = new Set<string>();

    for (const mcpConfig of this._config.mcpServers) {
      if (mcpConfig.transport !== "stdio") continue;

      const envTemplate = mcpConfig.env || {};
      const { env, secretValues } = await envInjector.inject(envTemplate);
      for (const s of secretValues) allSecretValues.add(s);

      await this._processManager.spawn(mcpConfig, env);

      const backend = new StdioMcpBackend(mcpConfig.id);
      backend.state = "running";
      backends.set(mcpConfig.id, backend);
    }

    // 5. Create credential gate with all injected secrets
    const credentialGate = new CredentialGate(allSecretValues);

    // 6. Create and start psmmcp-mcp
    this._psmmcpServer = new PsmmcpMcpServer({
      aclEngine,
      backends,
      identity,
      credentialGate,
    });

    // 7. Connect to stdio transport
    const transport = new StdioServerTransport();
    await this._psmmcpServer.server.connect(transport);
  }

  async stop(): Promise<void> {
    await this._processManager.stopAll();
  }

  private async _authenticate(): Promise<Identity> {
    const token = process.env.PSMMCP_TOKEN;
    if (!token) {
      throw new AuthError("PSMMCP_TOKEN environment variable not set");
    }

    const jwtIssuer = new JwtIssuer();
    const result = await jwtIssuer.verify(token);
    if (!result.success || !result.identity) {
      throw new AuthError(result.error || "Token verification failed");
    }

    return result.identity;
  }
}
