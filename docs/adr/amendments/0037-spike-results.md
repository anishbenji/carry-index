# Amendment to ADR-0037: how the Worker checks the Access sign-in

- **Status:** Proposed (spike results, 2026-11-26)
- **Amends:** [ADR-0037](../0037-sign-in.md). ADR-0037 itself is unchanged until the user decides.
- **Source:** spike PR 9, `docs/spike/kit-access-d1-mcp.md` on `spike/09-kit-access-d1-mcp` at `65c11a6`
  (decision #16 and review round 3)

## Result (local only)

On `kit.carryjournal.com` the Worker verifies the Access JWT itself on every request, pages and API alike:

- the `Cf-Access-Jwt-Assertion` header;
- an RS256 signature against the team JWKS (`<team>/cdn-cgi/access/certs`); only RS256 is accepted, whatever the
  header says;
- `iss` equal to the team domain, `aud` containing the application's AUD tag, `exp` in the future and `nbf` not in
  the future (60 s leeway);
- Web Crypto, no JWT library; calls to Access give up after 5 s and fail closed.

Tests cover no JWT (401) and a key not in the JWKS, a tampered payload, a wrong `aud`, a wrong `iss`, an expired
or not-yet-valid token, `alg` none/HS256/RS512 and a malformed token (403 each).

## Proposed change

Proposed — for the user at the gate: record the checks above as how the Worker verifies the Access token. The
Worker makes the same checks on `/authorize` and `/callback` of the MCP host against the path-scoped application's
AUD tag (`ACCESS_MCP_AUD`), before any state or KV write, so a misconfigured Access application fails closed.

Three Access applications share one owner-only policy: the self-hosted application for `kit.carryjournal.com`, the
path-scoped one for `/authorize` and `/callback` on `mcp.kit.carryjournal.com`, and the Access for SaaS
application used for MCP ([ADR-0048](../0048-mcp-authorization.md)). Access is the only gate, and neither the app
nor MCP keeps its own allow-list. The allowed address stays in the Cloudflare dashboard only.

Nine secrets: the brief's six plus `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and `ACCESS_MCP_AUD`. The user enters them
as Worker secrets in the Cloudflare dashboard, or the Kit deploy workflow sets them from its GitHub environment;
the deploy goes through `deploy-kit.yml` (ADR-0049, #17), so no Cloudflare credential sits on the Mac.

Not verified at the edge: that Access injects the header, the real team JWKS and AUD, and key rotation.
