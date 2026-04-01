import type { ITokenIssuer, ITokenVerifier } from "@psmmcp/types/auth";
import { AuthError } from "../errors.js";

interface TokenRecord {
  id: string;
  identityId: string;
  scope: string[];
  issuedAt: Date;
  expiresAt: Date;
  revoked: boolean;
}

export class TokenManager {
  private readonly _issuer: ITokenIssuer & ITokenVerifier;
  private readonly _tokens = new Map<string, TokenRecord>();
  private readonly _revokedJtis = new Set<string>();

  constructor(issuer: ITokenIssuer & ITokenVerifier) {
    this._issuer = issuer;
  }

  async issue(
    identityId: string,
    options: { scope?: string[]; groups?: string[]; expiresIn?: string } = {},
  ): Promise<{ token: string; tokenId: string; expiresAt: Date }> {
    const token = await this._issuer.issue(identityId, options);

    const authResult = await this._issuer.verify(token);
    if (!authResult.success || !authResult.identity) {
      throw new AuthError("Failed to verify freshly issued token");
    }

    const tokenId = authResult.identity.id;
    const expiresIn = options.expiresIn || "1h";
    const expiresAt = new Date(Date.now() + this._parseExpiry(expiresIn));

    this._tokens.set(tokenId, {
      id: tokenId,
      identityId,
      scope: options.scope || [],
      issuedAt: new Date(),
      expiresAt,
      revoked: false,
    });

    return { token, tokenId, expiresAt };
  }

  async verify(token: string): Promise<ReturnType<ITokenVerifier["verify"]>> {
    const result = await this._issuer.verify(token);
    if (!result.success || !result.identity) return result;

    if (this._revokedJtis.has(result.identity.id)) {
      return { success: false, error: "Token has been revoked" };
    }

    return result;
  }

  revoke(tokenId: string): void {
    this._revokedJtis.add(tokenId);
    const record = this._tokens.get(tokenId);
    if (record) record.revoked = true;
  }

  listActive(): Array<{
    id: string;
    identityId: string;
    scope: string[];
    expiresAt: Date;
    issuedAt: Date;
  }> {
    const now = new Date();
    return Array.from(this._tokens.values())
      .filter((t) => !t.revoked && t.expiresAt > now)
      .map(({ id, identityId, scope, expiresAt, issuedAt }) => ({
        id,
        identityId,
        scope,
        expiresAt,
        issuedAt,
      }));
  }

  private _parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 3600_000;
    const [, num, unit] = match;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3600_000,
      d: 86400_000,
    };
    return parseInt(num, 10) * (multipliers[unit] || 3600_000);
  }
}
