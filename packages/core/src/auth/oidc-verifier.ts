import { createRemoteJWKSet, jwtVerify } from "jose";
import type { KeyLike, JWTVerifyGetKey } from "jose";
import type { ITokenVerifier, AuthResult } from "@psmmcp/types/auth";
import { AuthError } from "../errors.js";

export interface OidcVerifierOptions {
  issuer: string;
  clientId: string;
  audience?: string;
  jwksRefreshInterval?: number;
}

export class OidcVerifier implements ITokenVerifier {
  private readonly _issuer: string;
  private readonly _audience: string;
  private _jwks: JWTVerifyGetKey | null = null;
  private _jwksUri: string | null = null;
  private readonly _refreshInterval: number;

  constructor(options: OidcVerifierOptions) {
    this._issuer = options.issuer;
    this._audience = options.audience || options.clientId;
    this._refreshInterval = options.jwksRefreshInterval || 3600_000;
  }

  private async _getJwks(): Promise<JWTVerifyGetKey> {
    if (this._jwks) return this._jwks;

    const discoveryUrl = `${this._issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
    const response = await fetch(discoveryUrl);
    if (!response.ok) {
      throw new AuthError(`OIDC discovery failed: ${response.status} ${response.statusText}`);
    }

    const config = (await response.json()) as { jwks_uri: string };
    this._jwksUri = config.jwks_uri;

    this._jwks = createRemoteJWKSet(new URL(this._jwksUri), {
      cooldownDuration: this._refreshInterval,
    }) as JWTVerifyGetKey;

    return this._jwks;
  }

  async verify(token: string): Promise<AuthResult> {
    try {
      const jwks = await this._getJwks();
      const { payload } = await jwtVerify(token, jwks, {
        issuer: this._issuer,
        audience: this._audience,
      });

      const sub = payload.sub;
      if (!sub) {
        return { success: false, error: "Token missing 'sub' claim" };
      }

      const groups: string[] = Array.isArray(payload.groups)
        ? payload.groups
        : Array.isArray((payload as Record<string, unknown>).roles)
          ? (payload as Record<string, unknown>).roles as string[]
          : [];

      const roles: string[] = Array.isArray((payload as Record<string, unknown>).realm_access)
        ? ((payload as Record<string, unknown>).realm_access as { roles?: string[] })?.roles || []
        : [];

      return {
        success: true,
        identity: {
          id: payload.jti || sub,
          subject: sub,
          groups,
          roles,
          issuer: payload.iss!,
          metadata: {
            email: (payload as Record<string, unknown>).email as string || "",
            name: (payload as Record<string, unknown>).name as string || "",
          },
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "OIDC token verification failed",
      };
    }
  }

  clearCache(): void {
    this._jwks = null;
  }
}
