import { generateKeyPair, exportJWK, importJWK, SignJWT, jwtVerify } from "jose";
import type { KeyLike } from "jose";
import type { ITokenIssuer, ITokenVerifier, AuthResult, TokenClaims } from "@psmmcp/types/auth";
import { AuthError } from "../errors.js";

const ALG = "EdDSA";
const ISSUER = "psmmcp-local";
const AUDIENCE = "psmmcp";

export interface JwtIssuerOptions {
  privateKeyJwk?: Record<string, unknown>;
  publicKeyJwk?: Record<string, unknown>;
  defaultExpiry?: string;
}

export class JwtIssuer implements ITokenIssuer, ITokenVerifier {
  private _privateKey: KeyLike | null = null;
  private _publicKey: KeyLike | null = null;
  private readonly _defaultExpiry: string;
  private readonly _keyPromise: Promise<void>;

  constructor(options: JwtIssuerOptions = {}) {
    this._defaultExpiry = options.defaultExpiry || "1h";
    this._keyPromise = this._initKeys(options);
  }

  private async _initKeys(options: JwtIssuerOptions): Promise<void> {
    if (options.privateKeyJwk && options.publicKeyJwk) {
      this._privateKey = (await importJWK(options.privateKeyJwk as Parameters<typeof importJWK>[0], ALG)) as KeyLike;
      this._publicKey = (await importJWK(options.publicKeyJwk as Parameters<typeof importJWK>[0], ALG)) as KeyLike;
    } else {
      const pair = await generateKeyPair(ALG);
      this._privateKey = pair.privateKey;
      this._publicKey = pair.publicKey;
    }
  }

  async exportKeys(): Promise<{
    privateKeyJwk: Record<string, unknown>;
    publicKeyJwk: Record<string, unknown>;
  }> {
    await this._keyPromise;
    return {
      privateKeyJwk: (await exportJWK(this._privateKey!)) as Record<string, unknown>,
      publicKeyJwk: (await exportJWK(this._publicKey!)) as Record<string, unknown>,
    };
  }

  async issue(
    identityId: string,
    options: { scope?: string[]; groups?: string[]; expiresIn?: string } = {},
  ): Promise<string> {
    await this._keyPromise;
    const jti = crypto.randomUUID();
    const expiry = options.expiresIn || this._defaultExpiry;

    const token = await new SignJWT({
      scope: options.scope || [],
      groups: options.groups || [],
      jti,
    } as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: ALG })
      .setSubject(identityId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(expiry)
      .sign(this._privateKey!);

    return token;
  }

  async verify(token: string): Promise<AuthResult> {
    await this._keyPromise;
    try {
      const { payload } = await jwtVerify(token, this._publicKey!, {
        issuer: ISSUER,
        audience: AUDIENCE,
      });

      const claims = payload as unknown as TokenClaims;

      return {
        success: true,
        identity: {
          id: claims.jti,
          subject: claims.sub!,
          groups: claims.groups || [],
          roles: [],
          issuer: claims.iss!,
          metadata: {},
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Token verification failed",
      };
    }
  }
}
