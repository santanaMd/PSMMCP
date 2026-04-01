import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
} from "node:crypto";
import type {
  ICredentialStore,
  SecretRef,
  ResolvedSecret,
} from "@psmmcp/types/credentials";
import { SecretNotFoundError, PsmmcpError } from "../errors.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha512";
const FILE_VERSION = 1;

interface EncryptedEntry {
  iv: string;
  ciphertext: string;
  tag: string;
  metadata?: Record<string, string>;
}

interface StoreFile {
  version: number;
  kdf?: { salt: string; iterations: number; digest: string };
  secrets: Record<string, EncryptedEntry>;
}

export interface EncryptedFileOptions {
  filePath: string;
  masterKey?: Buffer;
  passphrase?: string;
}

export class EncryptedFileCredentialStore implements ICredentialStore {
  private readonly _filePath: string;
  private readonly _key: Buffer;

  constructor(options: EncryptedFileOptions) {
    this._filePath = options.filePath;

    if (options.masterKey) {
      if (options.masterKey.length !== 32) {
        throw new PsmmcpError("Master key must be exactly 32 bytes (256 bits)", "CONFIG_ERROR");
      }
      this._key = options.masterKey;
    } else if (options.passphrase) {
      const salt = this._getOrCreateSalt();
      this._key = pbkdf2Sync(
        options.passphrase,
        salt,
        PBKDF2_ITERATIONS,
        PBKDF2_KEYLEN,
        PBKDF2_DIGEST,
      );
    } else {
      throw new PsmmcpError(
        "EncryptedFileCredentialStore requires either masterKey or passphrase",
        "CONFIG_ERROR",
      );
    }
  }

  async get(ref: Pick<SecretRef, "id">): Promise<ResolvedSecret | null> {
    const store = await this._readStore();
    const entry = store.secrets[ref.id];
    if (!entry) return null;

    const value = this._decrypt(entry);
    return {
      ref: { id: ref.id, store: "encrypted-file", metadata: entry.metadata },
      value,
    };
  }

  async put(
    id: string,
    value: string,
    metadata?: Record<string, string>,
  ): Promise<SecretRef> {
    const store = await this._readStore();
    store.secrets[id] = this._encrypt(value, metadata);
    await this._writeStore(store);
    return { id, store: "encrypted-file", metadata };
  }

  async delete(id: string): Promise<void> {
    const store = await this._readStore();
    if (!(id in store.secrets)) {
      throw new SecretNotFoundError(id);
    }
    delete store.secrets[id];
    await this._writeStore(store);
  }

  async list(): Promise<SecretRef[]> {
    const store = await this._readStore();
    return Object.entries(store.secrets).map(([id, entry]) => ({
      id,
      store: "encrypted-file" as const,
      metadata: entry.metadata,
    }));
  }

  async health(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this._readStore();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  private _encrypt(value: string, metadata?: Record<string, string>): EncryptedEntry {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this._key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf-8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString("base64"),
      ciphertext: encrypted.toString("base64"),
      tag: tag.toString("base64"),
      metadata,
    };
  }

  private _decrypt(entry: EncryptedEntry): string {
    const iv = Buffer.from(entry.iv, "base64");
    const ciphertext = Buffer.from(entry.ciphertext, "base64");
    const tag = Buffer.from(entry.tag, "base64");

    if (tag.length !== TAG_LENGTH) {
      throw new PsmmcpError("Invalid auth tag length — file may be corrupt", "CRYPTO_ERROR");
    }

    const decipher = createDecipheriv(ALGORITHM, this._key, iv);
    decipher.setAuthTag(tag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString("utf-8");
    } catch {
      throw new PsmmcpError(
        "Decryption failed — wrong master key or corrupt data",
        "CRYPTO_ERROR",
      );
    }
  }

  private async _readStore(): Promise<StoreFile> {
    try {
      const raw = await readFile(this._filePath, "utf-8");
      const data = JSON.parse(raw) as StoreFile;
      if (data.version !== FILE_VERSION) {
        throw new PsmmcpError(
          `Unsupported store file version: ${data.version}`,
          "CONFIG_ERROR",
        );
      }
      return data;
    } catch (err) {
      if (err instanceof PsmmcpError) throw err;
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return this._createEmptyStore();
      }
      throw new PsmmcpError(
        "Failed to read credential store file",
        "CONFIG_ERROR",
        err instanceof Error ? err : undefined,
      );
    }
  }

  private async _writeStore(store: StoreFile): Promise<void> {
    await mkdir(dirname(this._filePath), { recursive: true });
    const json = JSON.stringify(store, null, 2);
    await writeFile(this._filePath, json, { encoding: "utf-8", mode: 0o600 });
  }

  private _createEmptyStore(): StoreFile {
    return { version: FILE_VERSION, secrets: {} };
  }

  private _getOrCreateSalt(): Buffer {
    // For passphrase mode, derive a deterministic salt from the file path.
    // In a real scenario, the salt would be stored in the file header.
    // On first write, we persist it. On subsequent reads, we load it.
    // For now, use a hash of the file path as a stable salt for derivation.
    const { createHash } = require("node:crypto") as typeof import("node:crypto");
    return createHash("sha256").update(this._filePath).digest().subarray(0, 16);
  }
}
