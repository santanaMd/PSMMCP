<p align="center">
  <img src="docs/assets/logo-placeholder.png" alt="PSMMCP Logo" width="200" />
</p>

<h1 align="center">PSMMCP</h1>
<h3 align="center"><em>Please Secure My MCP</em></h3>

<p align="center">
  A security gateway and lifecycle manager for <a href="https://modelcontextprotocol.io">Model Context Protocol</a> servers.<br/>
  Isolate credentials from LLMs. Control access with policies. Manage MCPs from a single hub.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

---

## The Problem

MCP servers need credentials to work &mdash; API keys, database passwords, OAuth tokens. Today, those credentials are typically:

- Hardcoded in config files that the LLM runtime can read
- Passed as environment variables visible to the entire process tree
- Exposed in tool responses if a buggy MCP server echoes them back

**One prompt injection away from leaking your production database password.**

## The Solution

Your LLM connects to **one single MCP** &mdash; `psmmcp-mcp` &mdash; which aggregates all your MCP servers behind a secure gateway. The LLM only sees the tools it's allowed to use.

```
                                                         ┌─────────────────┐
                                                    ┌───►│  GitHub MCP     │
                                                    │    └─────────────────┘
┌──────────────┐          ┌───────────────────┐     │    ┌─────────────────┐
│  MCP Client  │◄────────►│    psmmcp-mcp     │─────┼───►│  Postgres MCP   │
│ (Claude, etc)│ JSON-RPC │                   │     │    └─────────────────┘
└──────────────┘          │  One connection.  │     │    ┌─────────────────┐
                          │  All your tools.  │     └───►│  Slack MCP      │
                          │  Zero secrets.    │          └─────────────────┘
                          └───────────────────┘
                                  │
                          ┌───────┴────────┐
                          │ Auth + ACL     │
                          │ Credentials    │
                          │ Credential Gate│
                          └────────────────┘
```

- **One endpoint** &mdash; the client connects to `psmmcp-mcp`, not to individual MCPs
- **Aggregated tools** &mdash; `list_tools` returns tools from all permitted backends, namespaced (`github-mcp.list_issues`)
- **Invisible restrictions** &mdash; blocked tools and MCPs simply don't appear; the LLM doesn't know they exist
- **Credential isolation** &mdash; secrets are resolved at the proxy layer and injected as env vars; the LLM never sees them
- **Automatic redaction** &mdash; if a secret leaks in a response, the credential gate replaces it with `[REDACTED]`

---

## Quick Start

### Install

```bash
npm install -g @psmmcp/cli
```

### Initialize

```bash
psmmcp init --mode local
# Creates psmmcp.config.yaml and encrypted secrets file
# Prompts for master key passphrase
```

### Add secrets and create an MCP

```bash
# Store a secret locally (encrypted at rest, AES-256-GCM)
psmmcp secret add github-pat

# Or store on the server (Vault) in server mode
psmmcp server secret add github-pat

# Create an MCP server on the gateway — born behind the proxy
psmmcp server mcp create github-mcp \
  --from npm:@modelcontextprotocol/server-github \
  --env GITHUB_PERSONAL_ACCESS_TOKEN={{server-secret:github-pat}}

# Link an existing remote MCP
psmmcp server mcp link slack-mcp \
  --url https://slack-mcp.internal:3000/mcp \
  --headers Authorization="Bearer {{server-secret:slack-token}}"
```

### Set up identity and access

```bash
# Create an identity and issue tokens on the server
psmmcp server identity add alice --groups engineers
psmmcp server token issue --identity alice --scope "mcp:github-mcp"

# Store sub-agent tokens locally (your encrypted file, not Vault)
psmmcp secret add agent-review-token
psmmcp secret add agent-deploy-token

# Define access policies on the server
psmmcp server policy add \
  --subjects "group:engineers" \
  --resources "mcp:github-mcp" \
  --actions "*" \
  --effect allow
```

### Use it

**STDIO mode** &mdash; point your MCP client to `psmmcp-mcp` (one entry, all tools):

```json
{
  "mcpServers": {
    "psmmcp": {
      "command": "psmmcp",
      "args": ["proxy"],
      "env": {
        "PSMMCP_TOKEN": "<jwt-token-from-above>"
      }
    }
  }
}
```

The LLM sees all permitted tools from all backends as a single MCP:
```
github-mcp.list_issues    github-mcp.create_issue    slack-mcp.send_message
```

**Server mode** &mdash; run the HTTPS gateway:

```bash
psmmcp serve
# Gateway listening on https://0.0.0.0:8443
# All managed MCPs auto-started behind the gateway
# psmmcp-mcp available at /mcp
```

Clients connect via standard MCP Streamable HTTP with a Bearer token:

```
POST https://gateway.example.com/mcp
Authorization: Bearer <oidc-token>
```

---

## How It Works

### The psmmcp-mcp (Meta-MCP Aggregator)

Instead of connecting to each MCP server individually, your LLM connects to **one single MCP** that aggregates everything:

```
LLM calls list_tools on psmmcp-mcp
       │
       ▼
psmmcp-mcp queries all backend MCPs:
  ├── github-mcp.tools/list    → [list_issues, create_issue, delete_repo]
  ├── postgres-mcp.tools/list  → [query, execute_sql_write, drop_table]
  └── slack-mcp.tools/list     → [send_message, list_channels]
       │
       ▼
ACL engine filters by identity (alice, group:engineers):
  ├── github-mcp:  list_issues ✓, create_issue ✓, delete_repo ✗
  ├── postgres-mcp: query ✓, execute_sql_write ✗, drop_table ✗
  └── slack-mcp:   send_message ✓, list_channels ✓
       │
       ▼
LLM sees (namespaced, clean):
  [github-mcp.list_issues, github-mcp.create_issue,
   postgres-mcp.query, slack-mcp.send_message, slack-mcp.list_channels]
```

When the LLM calls a tool, `psmmcp-mcp` routes it to the correct backend:
```
LLM: call_tool({ mcp: "github-mcp", tool: "list_issues", arguments: { repo: "..." } })
  → psmmcp-mcp verifies ACL → resolves secrets → routes to github-mcp → filters response → returns
```

### Credential Isolation

```
  Your Config File             PSMMCP Runtime              MCP Server Process
  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
  │ env:             │         │                 │         │ Environment:    │
  │   TOKEN:         │────────►│ Resolve secrets │────────►│ TOKEN=ghp_xxx   │
  │   {{secret:pat}} │         │ from encrypted  │         │                 │
  │                  │         │ store or Vault   │         │ (secret lives   │
  │ (no secrets in   │         │                 │         │  only here, in  │
  │  the file)       │         │ Inject into     │         │  memory)        │
  └─────────────────┘         │ child process   │         └─────────────────┘
                              │ env vars         │
                              └─────────────────┘
                                      │
                                      ▼
                              Credential Gate scans
                              all responses for leaked
                              secrets → [REDACTED]
```

Secrets never appear in:
- Config files (only `{{secret:ref}}` placeholders)
- JSON-RPC messages to/from the LLM
- Log files or audit trails
- The PSMMCP process's own environment

### Dual Credential Store (Local + Server)

Two secret stores coexist. Local is the default &mdash; your personal encrypted file. Server is Vault.

```
psmmcp secret add xxx              →  local   →  {{secret:xxx}}
psmmcp server secret add xxx       →  Vault   →  {{server-secret:xxx}}
```

```yaml
env:
  MY_TOKEN: "{{secret:my-oidc-token}}"            # from local encrypted file
  API_KEY: "{{server-secret:github-pat}}"          # from Vault
```

**Use case: sub-agents** &mdash; issue scoped tokens on the server, store them locally:

```bash
psmmcp server token issue --identity agent-review --scope "mcp:github-mcp"
psmmcp secret add agent-review-token    # store the token in your local encrypted file
# Sub-agent uses: PSMMCP_TOKEN={{secret:agent-review-token}}
```

### Access Control (IAM-style, 3 levels)

Deny-by-default with three levels of granularity:

```yaml
policies:
  # Level 1 — MCP access: who can use which MCP
  - id: "engineers-full-access"
    subjects: ["group:engineers"]
    resources: ["mcp:github-mcp", "mcp:jira-mcp"]
    actions: ["*"]
    effect: "allow"

  # Level 2 — Method access: allow tools but not resources
  - id: "bots-tools-only"
    subjects: ["group:bots"]
    resources: ["mcp:postgres-mcp"]
    actions: ["tools/list", "tools/call"]
    effect: "allow"

  # Level 3 — Tool-specific: block individual tools
  - id: "block-destructive-sql"
    subjects: ["*"]
    resources: ["mcp:postgres-mcp"]
    actions: ["tools/call"]
    effect: "deny"
    conditions:
      - field: "tool.name"
        operator: "in"
        value: ["execute_sql_write", "drop_table"]

  # Level 3 — Tool-specific: allow-list (only these tools)
  - id: "interns-readonly"
    subjects: ["group:interns"]
    resources: ["mcp:github-mcp"]
    actions: ["tools/call"]
    effect: "allow"
    conditions:
      - field: "tool.name"
        operator: "in"
        value: ["list_issues", "get_issue", "search_code"]
```

**Blocked tools are invisible.** The LLM doesn't see them in `list_tools`, so it never tries to call them. Every access decision is logged with the policy ID that allowed or denied it.

### MCP Lifecycle Management

PSMMCP manages the full lifecycle of your MCP servers:

| Command | Description |
|---------|------------|
| `psmmcp mcp create <id>` | Create a managed MCP from npm package, command, or Docker image |
| `psmmcp mcp link <id>` | Link an existing external MCP server |
| `psmmcp mcp start <id>` | Start a managed MCP |
| `psmmcp mcp stop <id>` | Stop gracefully |
| `psmmcp mcp restart <id>` | Restart (e.g., after secret rotation) |
| `psmmcp mcp status` | Show status of all MCPs |
| `psmmcp mcp logs <id>` | View MCP server logs |
| `psmmcp mcp remove <id>` | Remove an MCP completely |

Managed MCPs are born behind the gateway with credentials already injected. No manual proxy configuration needed.

---

## Control Plane API

PSMMCP exposes a RESTful management API inspired by Kubernetes, allowing you to control every aspect of the system programmatically.

```
# MCP Servers
GET    /api/v1/mcps                    List all MCPs
POST   /api/v1/mcps                    Create MCP (managed or external link)
GET    /api/v1/mcps/:id                Get MCP details
PUT    /api/v1/mcps/:id                Update MCP config
DELETE /api/v1/mcps/:id                Remove MCP
POST   /api/v1/mcps/:id/start         Start managed MCP
POST   /api/v1/mcps/:id/stop          Stop managed MCP
POST   /api/v1/mcps/:id/restart       Restart MCP
GET    /api/v1/mcps/:id/status         Health and status
GET    /api/v1/mcps/:id/logs           Stream logs (SSE)

# Secrets (values are NEVER returned)
GET    /api/v1/secrets                 List secret IDs
POST   /api/v1/secrets                 Create secret
DELETE /api/v1/secrets/:id             Delete secret
POST   /api/v1/secrets/:id/rotate     Rotate secret value

# Identities & Tokens
GET    /api/v1/identities              List identities
POST   /api/v1/identities             Create identity
POST   /api/v1/tokens                  Issue token
DELETE /api/v1/tokens/:id             Revoke token

# Access Policies
GET    /api/v1/policies                List policies
POST   /api/v1/policies               Create policy
POST   /api/v1/policies/evaluate      Dry-run: test if identity X can access MCP Y

# System
GET    /api/v1/system/health           Health check
GET    /api/v1/system/audit            Query audit logs
GET    /metrics                        Prometheus metrics
```

The API uses the same auth mechanisms (JWT/OIDC) and requires an `admin` or `operator` role. All operations are fully audited.

**Example &mdash; create an MCP via API:**

```bash
curl -X POST https://gateway.example.com/api/v1/mcps \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "github-mcp",
    "type": "managed",
    "source": { "kind": "npm", "package": "@modelcontextprotocol/server-github" },
    "transport": "stdio",
    "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "{{secret:github-pat}}" },
    "autoStart": true
  }'
```

---

## Features

### Two Operating Modes

| | `psmmcp` (Local) | `psmmcp server` (Server) |
|---|---|---|
| **What it is** | Full local stack | Talks to a PSMMCP gateway |
| **Transport** | STDIO JSON-RPC | HTTPS + Streamable HTTP |
| **Auth** | Self-issued JWT (Ed25519) | OAuth2/OIDC (Keycloak, Auth0, Entra ID) |
| **Credential Store** | AES-256-GCM encrypted file | HashiCorp Vault |
| **Secret placeholders** | `{{secret:xxx}}` | `{{server-secret:xxx}}` |
| **Use Case** | Developer workstation | Team/org deployment (or local docker-compose) |
| **MCPs** | Local child processes | Gateway-managed (processes, Docker, external) |
| **Identities** | Local (stored in config) | From IdP (OIDC) |

Both modes support the full feature set: MCPs, identities, policies, tokens, ACL with tool-level filtering.

**Run the full server stack locally** with docker-compose (Vault + Keycloak + Gateway) and point to it:
```bash
psmmcp server --gateway https://localhost:8443 mcp status
```

### Security

- **Zero-trust architecture** &mdash; deny-by-default ACL
- **Credential gate** &mdash; automatic redaction of leaked secrets in responses
- **TLS mandatory** in server mode
- **PKCE** for OAuth 2.1 flows (per MCP spec)
- **Origin validation** &mdash; DNS rebinding protection
- **Rate limiting** per identity
- **Secrets in memory only** &mdash; never on disk in plaintext, never in logs

### Observability

- **OpenTelemetry** tracing &mdash; distributed traces across gateway, auth, ACL, MCP backends
- **Prometheus metrics** &mdash; `/metrics` endpoint with requests/s, latency percentiles, ACL denials
- **Structured logging** &mdash; JSON logs with trace/span IDs via Pino
- **Audit trail** &mdash; every auth check, ACL decision, secret resolution, and redaction event

### High Availability

- **Stateless gateway** &mdash; scale horizontally behind a load balancer
- **Health checks** &mdash; `/health` and `/ready` for Kubernetes
- **Graceful shutdown** &mdash; drains SSE connections
- **Auto-restart** &mdash; managed MCPs respawn on failure
- **Circuit breaker** &mdash; for unreliable HTTP backends

### Governance

- **Declarative policies** &mdash; ACL as YAML, version-controlled in git
- **Immutable audit log** &mdash; who accessed what, when, which tool was called
- **Token lifecycle** &mdash; issuance, expiration, revocation tracked
- **Compliance-ready** &mdash; every ACL decision logged with policy ID justification

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PSMMCP                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        psmmcp-mcp                                   │   │
│  │            (Meta-MCP Aggregator — what the LLM sees)                │   │
│  │                                                                     │   │
│  │  list_tools ──► aggregates + filters by ACL ──► namespaced tools   │   │
│  │  call_tool  ──► verifies ACL ──► routes to backend ──► filters     │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                              │                                              │
│  ┌──────────┐  ┌──────────┐ │ ┌──────────┐   ┌───────────────────────┐    │
│  │ Auth     │  │ ACL      │ │ │ Cred.    │   │ MCP Manager           │    │
│  │ Verify   │  │ Engine   │ │ │ Gate     │   │                       │    │
│  │ JWT/OIDC │  │ 3 levels │ │ │ [REDACT] │   │ ┌───────────────────┐ │    │
│  └──────────┘  └──────────┘ │ └──────────┘   │ │ Process Pool      │ │    │
│                              │                 │ │ (stdio backends)  │ │    │
│  ┌──────────────────────────┴───────────┐     │ ├───────────────────┤ │    │
│  │ Credential Store                      │     │ │ Docker Pool       │ │    │
│  │ Encrypted File (local) | Vault (srv)  │     │ │ (containers)      │ │    │
│  └───────────────────────────────────────┘     │ ├───────────────────┤ │    │
│                                                │ │ External Links    │ │    │
│  ┌───────────────────────────────────────┐     │ │ (remote MCPs)     │ │    │
│  │ Control Plane API (/api/v1/*)         │     │ └───────────────────┘ │    │
│  │ CRUD: MCPs, Secrets, Policies, Tokens │     └───────────────────────┘    │
│  └───────────────────────────────────────┘                                  │
│                                                                             │
│  ┌───────────────────────────────────────┐                                  │
│  │ Observability                         │                                  │
│  │ OpenTelemetry + Prometheus + Pino     │                                  │
│  └───────────────────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Trust Boundaries

| Layer | Sees Secrets? | Access Level |
|-------|:---:|---|
| LLM / MCP Client | Never | Only `psmmcp-mcp` tools, filtered by ACL |
| psmmcp-mcp | Transiently | Resolves secrets, injects, then discards |
| MCP Server Process | As env vars | Only its own credentials, nothing else |
| Config Files | Never | Only `{{secret:ref}}` placeholders |
| Audit Logs | Never | Redacted by design |
| Control Plane API | Never | Manages resources, secret values never returned |

---

## Configuration

PSMMCP uses a single YAML configuration file:

```yaml
version: "1"
mode: "local"  # or "server"

# -- Local Mode --
local:
  credentialStore:
    type: "encrypted-file"
    path: "./secrets.enc"
    masterKeyEnv: "PSMMCP_MASTER_KEY"
  auth:
    type: "jwt-local"
    tokenExpiry: "1h"

# -- Server Mode --
server:
  port: 8443
  tls:
    cert: "./certs/cert.pem"
    key: "./certs/key.pem"
  credentialStore:
    type: "vault"
    address: "https://vault.internal:8200"
    auth:
      method: "approle"
      roleId: "{{env:VAULT_ROLE_ID}}"
      secretId: "{{env:VAULT_SECRET_ID}}"
  auth:
    type: "oidc"
    providers:
      - id: "keycloak"
        issuer: "https://keycloak.example.com/realms/main"
        clientId: "psmmcp-gateway"

# -- MCP Servers --
mcpServers:
  # Managed: PSMMCP controls the lifecycle
  - id: "github-mcp"
    type: "managed"
    source:
      kind: "npm"
      package: "@modelcontextprotocol/server-github"
    transport: "stdio"
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "{{secret:github-pat}}"
    autoStart: true
    restartPolicy: "on-failure"

  # External: PSMMCP proxies and protects
  - id: "slack-mcp"
    type: "external"
    transport: "http"
    url: "https://slack-mcp.internal:3000/mcp"
    headers:
      Authorization: "Bearer {{secret:slack-bot-token}}"

# -- Access Policies --
policies:
  - id: "engineers-github"
    subjects: ["group:engineers"]
    resources: ["mcp:github-mcp"]
    actions: ["*"]
    effect: "allow"
```

See [Configuration Reference](docs/configuration.md) for full documentation.

---

## Tech Stack

100% open-source. No proprietary dependencies.

| Component | Library | License |
|-----------|---------|---------|
| MCP Protocol | [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MIT |
| HTTP Server | [Fastify](https://fastify.dev) | MIT |
| JWT / JOSE | [jose](https://github.com/panva/jose) | Apache 2.0 |
| CLI | [Commander.js](https://github.com/tj/commander.js) | MIT |
| Schema Validation | [Zod](https://zod.dev) | MIT |
| Vault Client | [node-vault](https://github.com/nodevault/node-vault) | MIT |
| Observability | [OpenTelemetry](https://opentelemetry.io) | Apache 2.0 |
| Metrics | [prom-client](https://github.com/siimon/prom-client) | Apache 2.0 |
| Logging | [Pino](https://getpino.io) | MIT |
| Resilience | [Cockatiel](https://github.com/connor4312/cockatiel) | MIT |

---

## Project Structure

```
packages/
  core/          @psmmcp/core         Credential store, auth, ACL engine, injection
  psmmcp-mcp/    @psmmcp/mcp          Meta-MCP aggregator (list_tools, call_tool)
  stdio-proxy/   @psmmcp/stdio-proxy  STDIO transport — exposes psmmcp-mcp locally
  gateway/       @psmmcp/gateway      HTTPS gateway, MCP manager, Control Plane API
  cli/           @psmmcp/cli          CLI tool (psmmcp command)
```

Monorepo powered by pnpm workspaces and Turborepo.

---

## Roadmap

- [x] Architecture and design

**Phase 1 &mdash; Implementation** (16 sub-items)

- [x] 1.1 &mdash; Monorepo foundation (pnpm, Turborepo, TypeScript, tsup)
- [x] 1.2 &mdash; Shared types: contract interfaces (`@psmmcp/types`)
- [ ] 1.3 &mdash; Core: config schema + YAML loader + errors
- [ ] 1.4 &mdash; Core: credential store (encrypted file + Vault + memory)
- [ ] 1.5 &mdash; Core: dual secret resolver (`{{secret:}}` + `{{server-secret:}}`)
- [ ] 1.6 &mdash; Core: auth (JWT Ed25519 + OIDC + token manager)
- [ ] 1.7 &mdash; Core: ACL engine (3 levels + filterTools/filterResources)
- [ ] 1.8 &mdash; Core: credential gate + audit logger
- [ ] 1.9 &mdash; psmmcp-mcp aggregator (list_tools, call_tool, list_resources, read_resource)
- [ ] 1.10 &mdash; STDIO proxy (local mode, JWT auth, process manager)
- [ ] 1.11 &mdash; Gateway HTTPS (Streamable HTTP, OIDC auth)
- [ ] 1.12 &mdash; Gateway MCP Manager (process pool, Docker pool, external links)
- [ ] 1.13 &mdash; Gateway Control Plane API (`/api/v1/*`)
- [ ] 1.14 &mdash; CLI: `psmmcp` (local) + `psmmcp server` (gateway)
- [ ] 1.15 &mdash; Observability (OpenTelemetry + Prometheus + Pino)
- [ ] 1.16 &mdash; Resilience (circuit breaker, rate limit, auto-restart, graceful shutdown)

**Phase 2 &mdash; Testing** (7 sub-items)

- [ ] 2.1 &mdash; Unit: core (18 test groups)
- [ ] 2.2 &mdash; Unit: psmmcp-mcp (6 test groups)
- [ ] 2.3 &mdash; Unit: stdio-proxy (2 test groups)
- [ ] 2.4 &mdash; Unit: gateway (9 test groups)
- [ ] 2.5 &mdash; Unit: CLI (6 test groups)
- [ ] 2.6 &mdash; E2E: local mode (6 journeys)
- [ ] 2.7 &mdash; E2E: server mode (4 journeys)

**Phase 3 &mdash; Packaging &amp; Distribution** (6 sub-items)

- [ ] 3.1 &mdash; npm: publish all 6 packages with changesets
- [ ] 3.2 &mdash; Docker: multi-stage images for gateway + CLI, pushed to GHCR
- [ ] 3.3 &mdash; Docker Compose: base + infra (Vault/Keycloak) + observability (Grafana/Jaeger) + full stack
- [ ] 3.4 &mdash; Helm: gateway chart with HPA, PDB, NetworkPolicy, ServiceMonitor, external secrets
- [ ] 3.5 &mdash; CI/CD: GitHub Actions (lint/test on PR, release on tag, compose smoke tests)
- [ ] 3.6 &mdash; Docs: getting-started, config reference, security model, deployment guides

---

## Contributing

We welcome contributions! Whether it's bug reports, feature requests, documentation improvements, or code contributions.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and development process.

---

## License

This project is licensed under the MIT License &mdash; see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>PSMMCP</strong> &mdash; Because your MCP servers deserve better security.<br/>
  <sub>Built with the <a href="https://spec.modelcontextprotocol.io/specification/2025-03-26/">MCP Specification 2025-03-26</a></sub>
</p>
