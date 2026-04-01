import type {
  ICredentialStore,
  SecretRef,
  ResolvedSecret,
} from "@psmmcp/types/credentials";

export class MemoryCredentialStore implements ICredentialStore {
  private readonly _secrets = new Map<string, { value: string; metadata?: Record<string, string> }>();

  async get(ref: Pick<SecretRef, "id">): Promise<ResolvedSecret | null> {
    const entry = this._secrets.get(ref.id);
    if (!entry) return null;
    return {
      ref: { id: ref.id, store: "memory" },
      value: entry.value,
    };
  }

  async put(
    id: string,
    value: string,
    metadata?: Record<string, string>,
  ): Promise<SecretRef> {
    this._secrets.set(id, { value, metadata });
    return { id, store: "memory", metadata };
  }

  async delete(id: string): Promise<void> {
    this._secrets.delete(id);
  }

  async list(): Promise<SecretRef[]> {
    return Array.from(this._secrets.entries()).map(([id, entry]) => ({
      id,
      store: "memory" as const,
      metadata: entry.metadata,
    }));
  }

  async health(): Promise<{ ok: boolean; error?: string }> {
    return { ok: true };
  }
}
