import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { McpServerConfig } from "@psmmcp/types/config";

export interface ManagedProcess {
  mcpId: string;
  pid: number;
  process: ChildProcess;
  kill(): void;
}

interface ProcessManagerEvents {
  exit: (mcpId: string, code: number | null) => void;
  error: (mcpId: string, error: Error) => void;
}

export class ProcessManager extends EventEmitter {
  private readonly _processes = new Map<string, ManagedProcess>();

  async spawn(
    config: McpServerConfig,
    env: Record<string, string>,
  ): Promise<ManagedProcess> {
    const command = config.command || "npx";
    const args = config.args || [];

    // Sanitized env — only pass declared env vars, not parent process env
    const sanitizedEnv: Record<string, string> = {
      PATH: process.env.PATH || "",
      HOME: process.env.HOME || process.env.USERPROFILE || "",
      ...env,
    };

    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: sanitizedEnv,
      windowsHide: true,
    });

    if (!child.pid) {
      throw new Error(`Failed to spawn process for MCP: ${config.id}`);
    }

    const managed: ManagedProcess = {
      mcpId: config.id,
      pid: child.pid,
      process: child,
      kill: () => {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 5000);
      },
    };

    child.on("exit", (code) => {
      this._processes.delete(config.id);
      this.emit("exit", config.id, code);
    });

    child.on("error", (err) => {
      this.emit("error", config.id, err);
    });

    this._processes.set(config.id, managed);
    return managed;
  }

  get(mcpId: string): ManagedProcess | undefined {
    return this._processes.get(mcpId);
  }

  async stopAll(): Promise<void> {
    const promises = Array.from(this._processes.values()).map(
      (p) =>
        new Promise<void>((resolve) => {
          p.process.on("exit", () => resolve());
          p.kill();
          setTimeout(resolve, 6000);
        }),
    );
    await Promise.all(promises);
    this._processes.clear();
  }
}
