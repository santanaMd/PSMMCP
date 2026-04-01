// TODO: implement — psmmcp server <subcommand>
//
// Server mode operations. Talks to a PSMMCP gateway via Control Plane API.
// The gateway can be remote infrastructure OR a local docker-compose stack.
//
// Auth: OIDC (Keycloak, Auth0, Entra ID, etc.)
// Secrets: HashiCorp Vault
// MCPs: managed by the gateway (processes, Docker containers, external links)
//
// ── Commands (mirror local commands, but operate on the gateway) ──
//
//   psmmcp server serve                             Start the HTTPS gateway
//   psmmcp server status                            Show gateway + all MCPs status
//
//   psmmcp server secret add|list|remove|rotate     Manage secrets in Vault
//   psmmcp server identity add|list|remove          Manage identities (IdP-backed)
//   psmmcp server token issue|revoke|list           Manage OIDC-scoped tokens
//   psmmcp server mcp create|link|start|stop|...    Manage MCPs on the gateway
//   psmmcp server policy add|list|remove            Manage ACL policies on the gateway
//
// ── Connection ──
//
// `psmmcp server` needs to know where the gateway is:
//   --gateway https://psmmcp.example.com:8443       (flag)
//   PSMMCP_GATEWAY=https://psmmcp.example.com:8443  (env var)
//   or configured in psmmcp.config.yaml → server.host + server.port
//
// For local docker-compose: --gateway https://localhost:8443
//
// ── Secret references ──
//
// Secrets stored via `psmmcp server secret add` are referenced as {{server-secret:xxx}}
// in MCP configs. The gateway resolves them from Vault at runtime.
export {};
