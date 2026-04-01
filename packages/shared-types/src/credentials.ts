/** Reference to a secret stored in a credential store. Never contains the actual value. */
export interface SecretRef {
  id: string;
  store: "encrypted-file" | "vault" | "memory";
  path?: string;
  version?: number;
  metadata?: Record<string, string>;
}

/** Resolved secret — short-lived, never serialized, never logged. */
export interface ResolvedSecret {
  ref: SecretRef;
  value: string;
  expiresAt?: Date;
}

/** Credential store abstraction — the contract between core impls and consumers. */
export interface ICredentialStore {
  get(ref: Pick<SecretRef, "id">): Promise<ResolvedSecret | null>;
  put(
    id: string,
    value: string,
    metadata?: Record<string, string>,
  ): Promise<SecretRef>;
  delete(id: string): Promise<void>;
  list(): Promise<SecretRef[]>;
  health(): Promise<{ ok: boolean; error?: string }>;
}

export type CredentialStoreType = "encrypted-file" | "vault" | "memory";
