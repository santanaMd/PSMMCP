// TODO: implement — psmmcp token issue|revoke|list
//
// Local mode: issue self-signed JWT tokens (Ed25519) for local identities.
//   psmmcp token issue --identity alice --scope "mcp:github-mcp" [--expiry 2h]
//   psmmcp token list
//   psmmcp token revoke <token-id>
//
// These tokens authenticate against the local STDIO proxy (psmmcp-mcp).
// Server-side tokens (OIDC-scoped) via: psmmcp server token ...
export {};
