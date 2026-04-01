import type { Policy } from "@psmmcp/types/acl";

export class PolicyStore {
  private readonly _policies = new Map<string, Policy>();

  add(policy: Policy): void {
    this._policies.set(policy.id, policy);
  }

  remove(id: string): boolean {
    return this._policies.delete(id);
  }

  get(id: string): Policy | undefined {
    return this._policies.get(id);
  }

  list(): Policy[] {
    return Array.from(this._policies.values());
  }

  loadFromConfig(policies: Policy[]): void {
    this._policies.clear();
    for (const p of policies) {
      this._policies.set(p.id, p);
    }
  }

  clear(): void {
    this._policies.clear();
  }
}
