import type { NamespacedTool } from "@psmmcp/types/mcp";

const SEPARATOR = ".";

export class Namespace {
  static toNamespaced(mcpId: string, toolName: string): string {
    return `${mcpId}${SEPARATOR}${toolName}`;
  }

  static fromNamespaced(namespacedName: string): NamespacedTool {
    const separatorIndex = namespacedName.indexOf(SEPARATOR);
    if (separatorIndex === -1) {
      throw new Error(`Invalid namespaced name: ${namespacedName} (expected "mcpId.toolName")`);
    }
    const mcpId = namespacedName.slice(0, separatorIndex);
    const toolName = namespacedName.slice(separatorIndex + 1);
    if (!mcpId || !toolName) {
      throw new Error(`Invalid namespaced name: ${namespacedName} (empty mcpId or toolName)`);
    }
    return { mcpId, toolName, namespacedName };
  }

  static isNamespaced(name: string): boolean {
    return name.includes(SEPARATOR);
  }
}
