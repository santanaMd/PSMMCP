#!/usr/bin/env node

// TODO: implement — Commander.js setup, register all subcommands
//
// ── psmmcp (local mode) ──────────────────────────────────────
// Full local stack: MCPs, identities, policies, JWT tokens.
// Everything runs on the user's machine. Auth via self-issued JWT (Ed25519).
// Secrets stored in local encrypted file.
//
//   psmmcp init                             Initialize config + keys + encrypted store
//   psmmcp secret add|list|remove|rotate    Manage secrets (local encrypted file)
//   psmmcp identity add|list|remove         Manage identities (local)
//   psmmcp token issue|revoke|list          Manage JWT tokens (self-issued, local)
//   psmmcp mcp create|link|start|stop|...   Manage MCPs (local child processes)
//   psmmcp policy add|list|remove           Manage ACL policies (local)
//   psmmcp proxy                            Start STDIO proxy (psmmcp-mcp)
//
// ── psmmcp server (server mode) ──────────────────────────────
// Talks to a remote (or local) PSMMCP gateway via Control Plane API.
// Auth via OIDC. Secrets in Vault. MCPs managed by the gateway.
// The gateway itself can run anywhere — remote infra or local docker-compose.
//
//   psmmcp server secret add|list|remove|rotate   Manage secrets (Vault)
//   psmmcp server identity add|list|remove        Manage identities (IdP-backed)
//   psmmcp server token issue|revoke|list         Manage tokens (OIDC-scoped)
//   psmmcp server mcp create|link|start|stop|...  Manage MCPs (gateway-side)
//   psmmcp server policy add|list|remove          Manage ACL policies (gateway-side)
//   psmmcp server serve                           Start the HTTPS gateway
//   psmmcp server status                          Show gateway + MCPs status
//
// Note: users can run the full server stack locally via docker-compose
// (Vault + Keycloak + PSMMCP gateway). In that case, `psmmcp server` commands
// point to localhost. This is distinct from `psmmcp` (local mode) which runs
// everything as local processes with JWT auth and encrypted file store.
export {};
