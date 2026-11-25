# ADR-0048: MCP authorization for Kit Watch

- **Status:** Accepted (director under the user's overnight instruction, 2026-11-26; user may reverse)
- **Date:** 2026-11-26
- **Source:** spike PR 9, `docs/spike/kit-access-d1-mcp.md` on `spike/09-kit-access-d1-mcp` at `0c7e568`
  (review round 2); PR 9's second security review round (director's `reviews/09-kit/`); the user's choice of its
  own hostname for MCP (25 Nov 2026); decision #16 and its refinement, taken by the director under the user's
  overnight instruction (26 Nov 2026, director's decision log); summary in
  [`docs/spike/results.md`](../spike/results.md)

## Context

The unified brief asks whether Claude can connect to an MCP server on Kit Watch's Worker. MCP clients use OAuth
2.1 with discovery and dynamic client registration, so they must reach some endpoints before sign-in. Claude
registers its connector by a server-to-server `POST /register`, with no browser and no Access cookie, so that
route cannot sit behind Access. The browser steps (`/authorize`, `/callback`) can.

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
- **Access on the browser routes (decision #16).** `/authorize` and `/callback` on `mcp.kit.carryjournal.com` sit
  behind Access with the owner-only policy, so strangers never reach a route that creates consent state or spends
  the sign-in budget. `/register`, `/token`, `/mcp` and discovery stay outside Access; `/token` and `/mcp` are
  protected by OAuth tokens.
- **Access is the only gate.** The Access self-hosted application for `kit.carryjournal.com` (not a wildcard),
  the path rule for `/authorize` and `/callback`, and the Access for SaaS application share one owner-only policy.
  Neither the app nor MCP keeps its own allow-list.
- **Scopes.** `mcp:read` now; `mcp:write` is added with the write tools, with step-up through
  `insufficientScope`.
- **Open registration, bounded.** `/register` stays open because Claude registers server-to-server. It accepts
  only Claude's documented connector callback (`https://claude.ai/api/mcp/auth_callback`) and its `claude.com`
  twin; an identical registration returns the existing client with no new KV write; and it has its own daily cap,
  so a registration flood cannot block the owner's sign-in. If the edge test shows Claude's registration does carry
  a browser session, `/register` moves behind Access too.
- **Revocation checked in D1.** Before an MCP request is served, the token's grant is checked against a revocation
  record in D1 (strongly consistent), so a revoked token cannot be served from a cached KV copy at another
  location.
- **Clients.** Dynamic client registration on. Client ID Metadata Documents off until needed (they need the
  `global_fetch_strictly_public` compatibility flag).
- **Token separation.** The Access JWT is never accepted as an MCP token, and the app host never accepts a
  bearer token.
- **Per-IP rate limit.** A Rate Limiting binding allows 10 calls per 60 s per `CF-Connecting-IP` on the open
  OAuth routes, and answers 429 with `Retry-After: 60` before the OAuth library writes anything. Bodies are capped
  at 8 KB while streaming, and `/token` is rate-limited per IP.
- **Edge rate limit.** The free plan's one WAF rate-limiting rule: `(http.request.uri.path eq "/register") or
  (http.request.uri.path eq "/authorize")`, per IP, 5 requests per 10 s, block for 10 s.

## Consequences

**What decision #16 answers.** PR 9 tested a shape with `/register` and `/authorize` open (at `0c7e568`: a shared
daily budget of 300 requests in D1, counted before any KV write). PR 9's second security review round (GPT-6.2 Sol,
25 Nov) found three P1s in it:

1. **Shared Worker quota.** Anonymous requests to discovery and `/mcp` run the same Worker as the Access-protected
   app. If they spend the free plan's 100,000 daily requests, Cloudflare rejects the owner's app and API too.
2. **Owner sign-in lockout until midnight UTC.** Invalid requests could spend the shared budget, so the owner got
   429 when starting a new sign-in until midnight UTC.
3. **Revoked token cached at another location.** Revoking a token deletes its KV record, but another location can
   still validate against its cached copy. KV changes can take 60 seconds or more to reach other locations.

Access on `/authorize` and `/callback` closes 2 for the browser steps, and the separate registration cap keeps a
registration flood from reaching the owner's sign-in. The D1 revocation check closes 3. Risk 1 remains for
discovery, `/register`, `/token` and `/mcp`; the WAF rule and per-IP limits reduce it but do not cap the daily
total.

The same round raised four P2s, still to fix: OAuth codes and state can be kept in Worker invocation logs (set
`observability.redact_query_string`); a failed reconnect can revoke a working connector; an MCP batch can exceed
D1's per-request query limit; Access responses are buffered without a size limit.

**Options considered for #16.** A (taken): Access on the interactive OAuth routes, as refined above. B: MCP on its
own Worker; isolates the app's quota but leaves the lockout. C: MCP out of Release 1; no open surface, but loses a
Release 1 feature. The first version of A also put `/register` behind Access; the director dropped that the same
night because it would break Claude's server-to-server registration.

Other consequences:

- The MCP SDK (`@modelcontextprotocol/sdk` 1.32.2 in the spike) bundles Zod into the private Worker. Child rule 6
  now allows Zod in the private Worker (decision #14.2, director under the user's overnight instruction).
- The SDK's default validator (Ajv) compiles with `new Function`, which Workers forbid. The spike aliases Ajv to
  throwing stubs and uses a no-op JSON Schema validator.
- Not verified at the edge: Access for SaaS endpoints, claims and PKCE; Claude's connector flow through an Access
  sign-in on `/authorize`; a real MCP client connecting; the Rate Limiting binding and the WAF rule. Not built yet:
  the Access path rule, registration deduplication and its cap, and the D1 revocation check.

## Why

Accepted by the director under the user's overnight instruction; the user may reverse it. It keeps MCP in
Release 1, keeps strangers away from every route that creates sign-in state, and keeps Access as the one place
that decides who gets in.
