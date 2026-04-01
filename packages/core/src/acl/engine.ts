import type {
  IAclEngine,
  AclDecision,
  McpAction,
  Policy,
  PolicyCondition,
} from "@psmmcp/types/acl";
import type { Identity } from "@psmmcp/types/auth";

export class AclEngine implements IAclEngine {
  constructor(private readonly _policies: Policy[]) {}

  evaluate(
    identity: Identity,
    resource: string,
    action: McpAction,
    context?: Record<string, string>,
  ): AclDecision {
    const matching = this._policies.filter(
      (p) =>
        this._matchesSubject(p, identity) &&
        this._matchesResource(p, resource) &&
        this._matchesAction(p, action) &&
        this._matchesConditions(p, context),
    );

    // Explicit deny wins
    const deny = matching.find((p) => p.effect === "deny");
    if (deny) {
      return { allowed: false, policyId: deny.id, reason: `Denied by policy: ${deny.id}` };
    }

    // Then explicit allow
    const allow = matching.find((p) => p.effect === "allow");
    if (allow) {
      return { allowed: true, policyId: allow.id, reason: `Allowed by policy: ${allow.id}` };
    }

    // Implicit deny (no matching policy)
    return { allowed: false, reason: "No matching policy — implicit deny" };
  }

  filterTools(
    identity: Identity,
    mcpId: string,
    tools: Array<{ name: string; [key: string]: unknown }>,
  ): Array<{ name: string; [key: string]: unknown }> {
    // First check: can this identity access the MCP at all?
    const mcpAccess = this.evaluate(identity, `mcp:${mcpId}`, "tools/list");
    if (!mcpAccess.allowed) return [];

    return tools.filter((tool) => {
      const decision = this.evaluate(identity, `mcp:${mcpId}`, "tools/call", {
        "tool.name": tool.name,
      });
      return decision.allowed;
    });
  }

  filterResources(
    identity: Identity,
    mcpId: string,
    resources: Array<{ uri: string; [key: string]: unknown }>,
  ): Array<{ uri: string; [key: string]: unknown }> {
    const mcpAccess = this.evaluate(identity, `mcp:${mcpId}`, "resources/list");
    if (!mcpAccess.allowed) return [];

    return resources.filter((resource) => {
      const decision = this.evaluate(identity, `mcp:${mcpId}`, "resources/read", {
        "resource.uri": resource.uri,
      });
      return decision.allowed;
    });
  }

  private _matchesSubject(policy: Policy, identity: Identity): boolean {
    return policy.subjects.some((subject) => {
      if (subject === "*") return true;
      if (subject.startsWith("user:")) {
        return subject === `user:${identity.subject}`;
      }
      if (subject.startsWith("group:")) {
        const group = subject.slice(6);
        return identity.groups.includes(group);
      }
      if (subject.startsWith("role:")) {
        const role = subject.slice(5);
        return identity.roles.includes(role);
      }
      return subject === identity.subject;
    });
  }

  private _matchesResource(policy: Policy, resource: string): boolean {
    return policy.resources.some((r) => {
      if (r === "*") return true;
      if (r.endsWith("*")) {
        return resource.startsWith(r.slice(0, -1));
      }
      return r === resource;
    });
  }

  private _matchesAction(policy: Policy, action: McpAction): boolean {
    return policy.actions.some((a) => a === "*" || a === action);
  }

  private _matchesConditions(
    policy: Policy,
    context?: Record<string, string>,
  ): boolean {
    if (!policy.conditions || policy.conditions.length === 0) return true;
    if (!context) return true;

    return policy.conditions.every((condition) =>
      this._evaluateCondition(condition, context),
    );
  }

  private _evaluateCondition(
    condition: PolicyCondition,
    context: Record<string, string>,
  ): boolean {
    const actual = context[condition.field];
    if (actual === undefined) return false;

    switch (condition.operator) {
      case "eq":
        return actual === condition.value;
      case "neq":
        return actual !== condition.value;
      case "in": {
        const values = Array.isArray(condition.value)
          ? condition.value
          : [condition.value];
        return values.includes(actual);
      }
      case "glob": {
        const pattern = typeof condition.value === "string" ? condition.value : condition.value[0];
        return this._globMatch(actual, pattern);
      }
      default:
        return false;
    }
  }

  private _globMatch(value: string, pattern: string): boolean {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${escaped}$`).test(value);
  }
}
