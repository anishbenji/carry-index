# ADR-0048: MCP authorization for Kit Watch

- **Status:** Proposed (spike results, 2026-11-26)
- **Date:** 2026-11-26
- **Source:** spike PR 9, `docs/spike/kit-access-d1-mcp.md` on `spike/09-kit-access-d1-mcp` at `0c7e568`
  (review round 2); PR 9's second security review round (director's `reviews/09-kit/`); the user's choice of its
  own hostname for MCP (25 Nov 2026) and open decision #16; summary in
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
- **Daily budget (review round 2).** `/register` and `/authorize` together get 300 requests per UTC day from
  everyone (`OPEN_OAUTH_DAILY_BUDGET`), counted in a D1 table by one atomic upsert. Past it, both answer 429 until
  the next UTC midnight, before any KV write. Each counted request costs at most two KV writes, so 300 leaves about
  400 of the 1,000 daily KV writes for the owner. `/callback` and `/token` are not counted.
- **Narrow registration.** Registration accepts only Claude's documented connector callback
  (`https://claude.ai/api/mcp/auth_callback`) and its `claude.com` twin. Bodies on the open routes are capped at
  8 KB while streaming, and `/token` is rate-limited per IP.
- **Edge rate limit.** The free plan's one WAF rate-limiting rule: `(http.request.uri.path eq "/register") or
  (http.request.uri.path eq "/authorize")`, per IP, 5 requests per 10 s, block for 10 s.

## Consequences

**Residual risk: the open routes.** `/register` and `/authorize` are open by design, and each call writes to KV.
Workers KV on the free plan allows about 1,000 writes a day. The daily budget keeps strangers from spending them
all. But PR 9's second security review round (GPT-6.2 Sol, 25 Nov) found three P1s that the shape still allows:

1. **Shared Worker quota.** Anonymous requests to discovery and `/mcp` run the same Worker as the Access-protected
   app. The Worker limiter skips those routes and the WAF rule covers only `/register` and `/authorize`. If that
   traffic spends the free plan's 100,000 daily requests, Cloudflare rejects the owner's app and API too.
2. **Owner sign-in lockout until midnight UTC.** The daily budget is deducted before the method, body or consent
   transaction is checked. Invalid requests can spend all 300 without creating any OAuth records. The owner then
   gets 429 when starting a new sign-in, until midnight UTC. Existing connections keep refreshing.
3. **Revoked token cached at another location.** Revoking a token deletes its KV record, but another Cloudflare
   location can still validate against its cached copy and serve `list_items`. KV changes can take 60 seconds or
   more to reach other locations.

The same round raised four P2s: OAuth codes and state can be kept in Worker invocation logs (set
`observability.redact_query_string`); a failed reconnect can revoke a working connector; an MCP batch can exceed
D1's per-request query limit; Access responses are buffered without a size limit.

**Open decision #16, for the user at the gate.** Under the user's rule, repeated P1s mean a design problem, not a
patch loop. Options:

- **A (recommended): put the MCP host's interactive OAuth routes (`/authorize`, `/callback`, `/register`) behind
  Access** with the same owner-only policy. Only `/token` and `/mcp` stay open, protected by OAuth tokens.
  Strangers cannot create state or burn the KV and sign-in budgets. Claude's connector flow should still work,
  because the owner signs in through Access in the browser during the connect step (to verify at the edge). Con:
  one more Access application; untested until the edge test.
- **B: split MCP into its own Worker,** so its traffic cannot spend the private app's quota. Routes stay open with
  the existing limits. Con: the lockout remains.
- **C: take MCP out of Release 1.** Kit Watch ships without the Claude connector; it comes in 1.1. Con: loses a
  Release 1 feature.

Option A does not address the revoked-token cache (P1 3), which needs a revocation check in a strongly consistent
store (for example D1) before MCP requests are served. If A is chosen, the decision section above changes: the
three interactive routes move behind Access, and "Access is the only gate" then covers them too.

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
