# ADR-0048: MCP authorization for Kit Watch

- **Status:** Proposed (spike results, 2026-11-26)
- **Date:** 2026-11-26
- **Source:** spike PR 9, `docs/spike/kit-access-d1-mcp.md` on `spike/09-kit-access-d1-mcp` at `2f052c4`; the
  user's choice of its own hostname for MCP (25 Nov 2026); summary in
  [`docs/spike/results.md`](../spike/results.md)

## Context

The unified brief asks whether Claude can connect to an MCP server on Kit Watch's Worker. MCP clients use OAuth
2.1 with discovery and dynamic client registration, so they must reach some endpoints before sign-in. Cloudflare
Access (ADR-0037) blocks every request until sign-in, so the MCP endpoints cannot sit behind the Access
self-hosted application.

PR 9 built and tested this shape locally (workerd through Wrangler 4.168.0). Nothing reached Cloudflare, and no
real MCP client has connected.

## Decision

- **Own hostname.** MCP and OAuth live on `mcp.kit.carryjournal.com`, served by the same `kit-watch` Worker as
  `kit.carryjournal.com`, which routes by hostname. The app host never answers MCP or OAuth paths; the MCP host
  never serves the app or its API. Any other hostname, and plain http, gets 404.
- **OAuth provider.** `@cloudflare/workers-oauth-provider` (1.3.0 in the spike) makes the Worker both the
  authorization server and the resource server. Access tokens last 1 hour; refresh tokens use the library
  default (30 days). OAuth state lives in Workers KV.
- **Identity step.** An Access for SaaS (OIDC) application is the sign-in step, with PKCE (S256), a nonce and a
  state bound to a `__Host-` cookie. The Worker verifies the id_token and stores only the opaque Access `sub` in
  grants.
- **Access is the only gate.** The Access self-hosted application (for `kit.carryjournal.com`, not a wildcard)
  and the Access for SaaS application share one owner-only policy. Neither the app nor MCP keeps its own
  allow-list.
- **Scopes.** `mcp:read` now; `mcp:write` is added with the write tools, with step-up through
  `insufficientScope`.
- **Clients.** Dynamic client registration on. Client ID Metadata Documents off until needed (they need the
  `global_fetch_strictly_public` compatibility flag).
- **Token separation.** The Access JWT is never accepted as an MCP token, and the app host never accepts a
  bearer token.
- **Per-IP rate limit.** A Rate Limiting binding allows 10 calls per 60 s per `CF-Connecting-IP` across
  `/register` and `/authorize`, and answers 429 with `Retry-After: 60` before the OAuth library writes anything.
- **Edge rate limit.** The free plan's one WAF rate-limiting rule: `(http.request.uri.path eq "/register") or
  (http.request.uri.path eq "/authorize")`, per IP, 5 requests per 10 s, block for 10 s.

## Consequences

**Residual risk: the daily KV write quota.** `/register` and `/authorize` are open by design, and each call
writes to KV. Workers KV on the free plan allows about 1,000 writes a day. Once they are spent, the owner's own
sign-ins and token refreshes fail until the daily reset (00:00 UTC). The per-IP limits slow a flood but do not
cap the daily total: 10 calls a minute from one address is still 14,400 a day, and many addresses multiply it.
The same traffic also counts against the 100,000 daily Worker requests.

Options that do cap the total, none built yet. The user picks at the gate:

1. Put `mcp.kit.carryjournal.com/authorize` and `/callback` behind the same owner-only Access policy (a
   path-scoped application). Only the owner's browser can then create consent handles, which leaves only
   `/register` writing KV for strangers.
2. Cap registrations per day with a counter outside KV, for example one D1 row per day.
3. Replace dynamic registration with Client ID Metadata Documents or pre-registered clients.
4. Move to Workers Paid (ADR-0014), which lifts KV writes to 1 million a month, only if a limit is actually hit.

Other consequences:

- The MCP SDK (`@modelcontextprotocol/sdk` 1.32.2 in the spike) bundles Zod into the private Worker. That needs
  the user's acceptance, or a hand-written JSON-RPC handler instead of the SDK.
- The SDK's default validator (Ajv) compiles with `new Function`, which Workers forbid. The spike aliases Ajv to
  throwing stubs and uses a no-op JSON Schema validator.
- Not verified at the edge: Access for SaaS endpoints, claims and PKCE; a real MCP client connecting; the Rate
  Limiting binding and the WAF rule.

## Why

Proposed — for the user at the gate. It is the shape the spike tested locally, with the user's choice of a
separate hostname, and it keeps Access as the one place that decides who gets in.
