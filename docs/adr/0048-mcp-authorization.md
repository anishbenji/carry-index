# ADR-0048: MCP authorization for Kit Watch

- **Status:** Accepted (owner, 2026-11-28, with the amendment below; first accepted by the director under the user's
  overnight instruction, 2026-11-26)
- **Date:** 2026-11-26
- **Source:** spike PR 9, `docs/spike/kit-access-d1-mcp.md` on `spike/09-kit-access-d1-mcp` at `65c11a6`
  (decision #16 and review round 3); PR 9's second security review round (director's `reviews/09-kit/`); the
  user's choice of its own hostname for MCP (25 Nov 2026); decision #16 and its refinement, taken by the director
  under the user's overnight instruction (26 Nov 2026, director's decision log); summary in
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
  behind a second, path-scoped, owner-only Access self-hosted application. The Worker also verifies that
  application's JWT itself (AUD tag in the secret `ACCESS_MCP_AUD`) on both routes, before any state or KV write,
  so a misconfigured Access application fails closed. Only the owner's browser can create consent handles,
  upstream state or grants. `/register`, `/token`, `/mcp` and discovery stay outside Access; `/token` and `/mcp`
  are protected by OAuth tokens.
- **Access is the only gate.** Three Access applications share one owner-only policy: the self-hosted application
  for `kit.carryjournal.com` (not a wildcard), the path-scoped one for `/authorize` and `/callback` on the MCP host,
  and the Access for SaaS application. Neither the app nor MCP keeps its own allow-list.
- **Scopes.** `mcp:read` now; `mcp:write` is added with the write tools, with step-up through
  `insufficientScope`.
- **Open registration, bounded.** `/register` stays open because Claude registers server-to-server. It accepts
  only Claude's documented connector callback (`https://claude.ai/api/mcp/auth_callback`) and its `claude.com`
  twin. An identical registration returns the stored client from D1 with no KV write. New registrations have
  their own daily cap (`REGISTER_DAILY_BUDGET`, 50 a UTC day, in D1), which nothing in the owner's flow uses. If
  the edge test shows Claude's registration does carry a browser session, `/register` moves behind Access too.
- **Revocation checked in D1.** A revocation through the token endpoint records the grant in D1
  (`revoked_grants`); `/mcp` checks that table before serving, so a revoked token cannot be served from a cached
  KV copy at another location.
- **Reconnects and logs.** `revokeExistingGrants: false`, so reconnecting never cuts off a working connector; old
  grants expire. `observability.redact_query_string` is on, so Workers Logs never keep `/callback`'s code and
  state.
- **Bounded inputs.** Bodies on `/register`, `/authorize` and `/token` are capped at 8 KB while streaming; `/mcp`
  bodies at 64 KB with at most 10 messages a batch; Access's JWKS and token answers at 64 KB, validated, failing
  closed.
- **Clients.** Dynamic client registration on. Client ID Metadata Documents off until needed (they need the
  `global_fetch_strictly_public` compatibility flag).
- **Token separation.** The Access JWT is never accepted as an MCP token, and the app host never accepts a
  bearer token.
- **Per-IP rate limit in the Worker.** A Rate Limiting binding allows 10 calls per 60 s per `CF-Connecting-IP`
  (`/token` counted apart) and answers 429 before the OAuth library runs. It runs inside the Worker, so a refused
  call has already counted against the daily Worker requests.
- **Edge rate limit: the free plan's one WAF rule.** The free plan allows one rate-limiting rule for the whole
  `carryjournal.com` zone, matching on path only (no hostname). Recommended: it covers `/register` and `/token`
  on the MCP host, `(http.request.uri.path in {"/register" "/token"})`, per IP, block for 10 s. `/authorize` and
  `/callback` no longer need it, because Access stops strangers there. PR 9's doc proposes `/mcp` as well
  (20 requests per 10 s); that is left out here, so a burst of Claude tool calls is never blocked. The owner chose
  this (option (a) in Consequences) on 2026-11-28.

## Amendment (owner, 2026-11-28): only the owner's devices, and only Claude's addresses, reach the Worker

The owner wants strangers kept from spending the account's shared daily Worker quota at all, not just refused once
the Worker runs. Requests that Cloudflare Access or a WAF rule refuses at the edge never start the Worker, so they
cost no Worker requests. Three layers do this:

1. **The app host only from the owner's devices.** The self-hosted Access application for `kit.carryjournal.com`
   requires the owner's identity **and** a Gateway device-posture check: the request must come from one of the
   owner's devices enrolled with the Cloudflare One client (Mac, phone). Zero Trust free plan.
2. **The MCP browser steps the same way.** The path-scoped Access application for `/authorize` and `/callback` on
   `mcp.kit.carryjournal.com` uses the same identity-plus-device policy. These steps run in the owner's own browser,
   so nothing breaks.
3. **The rest of the MCP host only from Anthropic's published outbound ranges.** Claude's MCP calls
   (`/register`, `/token`, `/mcp`, discovery) come from Anthropic's servers, not from the owner's device, so a device
   check cannot apply to them. One WAF custom rule on `mcp.kit.carryjournal.com` blocks every request whose source
   address is outside Anthropic's published outbound IPv4 ranges, except the two Access-protected browser paths.
   Ranges at the time of writing, from <https://platform.claude.com/docs/en/api/ip-addresses> (outbound, "for
   example, when making MCP tool calls to external servers"): `160.79.104.0/21` and `153.61.208.0/20`. Claude's
   outbound MCP traffic is IPv4-only, so there is no IPv6 range to allow.

Everything else in this ADR stays: the 50-a-day cap on new registrations, the Worker's per-IP limit, the D1
revocation check, and the free plan's one rate-limiting rule on `/register` and `/token` (option (a) below, chosen
by the owner).

**What remains open.** Another Claude user could point Claude at this URL. Their calls come from Anthropic's
ranges, so they pass the WAF rule. They fail at sign-in (Access allows only the owner), and new registrations stop
at 50 a day, so the cost is a handful of Worker requests, not a flood.

**Options considered.** (1) This amendment: Claude keeps working on the web, desktop and phone. (2) Use Kit Watch
only from Claude Code on the owner's Mac through a local bridge, with the whole MCP host behind a device check:
tighter, but loses Claude on the web and phone. (3) Anthropic's MCP tunnels, which need no public endpoint: research
preview, Enterprise plan only, so not available.

### Stale addresses: the risk and the checks

If Anthropic changes or adds outbound ranges, the WAF rule blocks Claude, and Kit Watch's connector stops working
until the rule is updated. Nothing private is exposed. The failure is closed and only stops the owner's own
connector.

Checks:

- **Weekly (director):** fetch <https://platform.claude.com/docs/en/api/ip-addresses>, compare the outbound list
  with the ranges in this ADR and in the WAF rule, and raise any difference with the owner. A range that is added
  is added to the rule. A range that is "phased out" is removed once Anthropic's page drops it.
- **Before every change to the rule, and after any Kit Watch connector failure:** read the same page. In the
  Cloudflare dashboard (Security → Events, filtered to the WAF rule and `mcp.kit.carryjournal.com`), look for
  blocked requests whose source falls in a block Anthropic owns. Those are Claude calls the rule is wrongly
  refusing.
- **Symptom to recognise:** Claude reports the Kit Watch connector as unreachable or failing with HTTP 403 while the
  Kit Watch app itself still works in the browser. Check the address list first.
- **Fail-safe while investigating:** switch the WAF rule to *Log* instead of *Block*. That is one click and
  reversible. The connector works again and Access still protects sign-in. Switch it back once the ranges are
  updated.
- **Possible later automation (not built):** a scheduled job that fetches the page and opens an issue when the
  outbound list changes. It is not in place, because it means a workflow with outbound network access on a public
  repo. Decide it when Kit Watch ships.

## Consequences

**Risks after decision #16.**

- **Shared Worker quota (reduced, not closed).** One Worker serves both hosts, and the free plan gives the account
  100,000 Worker requests a day. Strangers can reach only `/register`, `/token`, `/mcp` and discovery. The edge rule
  stops floods on the routes it covers before they cost Worker requests. A flood on `/mcp` or `/.well-known/*`
  still spends the shared quota: the Worker's own limit counts only after the request has run, and no edge rule
  covers those paths. If that happens, the owner's app and API fail until the daily reset.
- **Owner sign-in lockout (closed for the browser steps).** Strangers cannot reach `/authorize` or `/callback`.
- **Fresh Claude connections blocked by the registration cap (reduced, not closed).** A reconnect whose
  registration matches a stored D1 entry is replayed and never touches the cap. A fresh registration (the first
  Claude connection, or any time the submitted metadata has no reusable D1 entry) is a replay miss, and PR 9's
  registration gate checks the daily cap on it before the flow reaches Access. On a day strangers fill the cap,
  the owner cannot add a fresh connection until the next UTC midnight.
- **Revoked token at another location (closed locally).** The D1 check serves no revoked grant; tested by putting
  the revoked token's KV records back.

**The one free rate-limiting rule (decided by the owner, 2026-11-28: option (a)).** The architecture doc puts Cloudflare's one free rule on the beacon's
`/api/*`. A rule can combine paths with `or`, but they then share one per-IP count. Options: (a) MCP `/register`
and `/token` only, the beacon relying on its own caps; (b) one combined rule for `/api/*`, `/register` and
`/token`; (c) the beacon only, MCP relying on the Worker's limits and caps. Chosen: (a); revisit when the beacon Worker is built.

**How the shape was reached.** PR 9 first tested `/register` and `/authorize` open with a shared daily budget of
300 requests (at `0c7e568`). PR 9's second security review round (GPT-6.2 Sol, 25 Nov) found three P1s in it:
the shared Worker quota, an owner sign-in lockout until midnight UTC, and a revoked token readable at another
location for 60 seconds or more. It also found four P2s: OAuth codes in logs, a failed reconnect revoking a
working connector, MCP batches over D1's per-request query limit, and unbounded Access responses. PR 9's commits
up to `65c11a6` address all of them except the shared quota. Options considered for #16: A (taken), Access on the
interactive OAuth routes; B, MCP on its own Worker, which changes routing but not quota (the free plan's daily Worker requests are per
account, shared by every Worker, the public beacon included) and leaves the lockout; C, MCP
out of Release 1. The first version of A also put `/register` behind Access; the director dropped that the same
night because it would break Claude's server-to-server registration. A separate Worker is not a fix for shared-quota
pressure, for the same reason; Workers Paid (ADR-0014) is the answer if a daily limit is actually hit.

Other consequences:

- The MCP SDK (`@modelcontextprotocol/sdk` 1.32.2 in the spike) bundles Zod into the private Worker. Child rule 6
  now allows Zod in the private Worker (decision #14.2, director under the user's overnight instruction).
- The SDK's default validator (Ajv) compiles with `new Function`, which Workers forbid. The spike aliases Ajv to
  throwing stubs and uses a no-op JSON Schema validator.
- Built and tested locally in PR 9 (round 3: 14 files, 86 tests): the Access check on `/authorize` and
  `/callback`, registration replay and its cap, the D1 revocation check, the reconnect and log fixes, the batch
  and body caps.
- Not verified at the edge: the path-scoped Access application; Access for SaaS endpoints, claims and PKCE;
  Claude's connector flow through an Access sign-in on `/authorize`, and that its registration carries no browser
  session; the Rate Limiting binding and the WAF rule.

## Why

Accepted by the director under the user's overnight instruction; the user may reverse it. It keeps MCP in
Release 1, keeps strangers away from every route that creates sign-in state, and keeps Access as the one place
that decides who gets in.
