/** Represents a verified identity in the system. */
export interface Identity {
  id: string;
  subject: string;
  groups: string[];
  roles: string[];
  issuer: string;
  metadata?: Record<string, string>;
}

/** Claims embedded in a PSMMCP JWT token. */
export interface TokenClaims {
  sub: string;
  iss: string;
  aud: string;
  scope: string[];
  groups: string[];
  exp: number;
  iat: number;
  jti: string;
}

/** Result of an authentication attempt. */
export interface AuthResult {
  success: boolean;
  identity?: Identity;
  error?: string;
}

/** Token verifier contract — implemented by JWT verifier and OIDC verifier. */
export interface ITokenVerifier {
  verify(token: string): Promise<AuthResult>;
}

/** Token issuer contract — implemented by JWT issuer (local mode). */
export interface ITokenIssuer {
  issue(
    identityId: string,
    options: { scope?: string[]; groups?: string[]; expiresIn?: string },
  ): Promise<string>;
}

export type AuthType = "jwt-local" | "oidc";
