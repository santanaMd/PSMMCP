/** An access control policy. */
export interface Policy {
  id: string;
  description?: string;
  subjects: string[];
  resources: string[];
  actions: McpAction[];
  effect: "allow" | "deny";
  conditions?: PolicyCondition[];
}

export type McpAction =
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "resources/subscribe"
  | "prompts/list"
  | "prompts/get"
  | "*";

export interface PolicyCondition {
  field: string;
  operator: "eq" | "neq" | "in" | "glob";
  value: string | string[];
}

export type AclDecision = {
  allowed: boolean;
  policyId?: string;
  reason: string;
};

/** ACL engine contract — evaluates policies against identity + resource + action. */
export interface IAclEngine {
  evaluate(
    identity: import("./auth.js").Identity,
    resource: string,
    action: McpAction,
    context?: Record<string, string>,
  ): AclDecision;

  filterTools(
    identity: import("./auth.js").Identity,
    mcpId: string,
    tools: Array<{ name: string; [key: string]: unknown }>,
  ): Array<{ name: string; [key: string]: unknown }>;

  filterResources(
    identity: import("./auth.js").Identity,
    mcpId: string,
    resources: Array<{ uri: string; [key: string]: unknown }>,
  ): Array<{ uri: string; [key: string]: unknown }>;
}
