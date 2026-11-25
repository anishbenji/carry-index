# Amendment to ADR-0036: Kit Watch's Worker and hostnames

- **Status:** Proposed (spike results, 2026-11-26)
- **Amends:** [ADR-0036](../0036-private-hostname.md). ADR-0036 itself is unchanged until the user decides.
- **Source:** spike PR 9, `docs/spike/kit-access-d1-mcp.md` on `spike/09-kit-access-d1-mcp` at `2f052c4`

## Result (local only)

PR 9 ran everything locally (workerd through Wrangler 4.168.0); nothing reached Cloudflare.

- One private Worker, `kit-watch`, serves two hostnames and routes by hostname: `kit.carryjournal.com` for the
  Solid 2 SPA and its API, and `mcp.kit.carryjournal.com` for OAuth and MCP (see
  [ADR-0048](../0048-mcp-authorization.md)). Any other hostname, and any plain-http request, gets 404.
- D1 reads and writes work on one synthetic table. `POST /api/items` accepts JSON only, exact fields, a body of
  at most 4 KB, and only from the origin `https://kit.carryjournal.com`.
- The SPA's hashed assets are cached `private, max-age=31536000, immutable`; the shell is `private, no-store`.
- Local test run: `bun run test` in `workers/kit`, 2 files, 32 tests pass, real 1.23 s. Local build of the SPA:
  `index-*.js` 43.29 kB (17.74 kB gzip), no inline script.

## Proposed change

Proposed — for the user at the gate: record that the Kit Watch Worker also serves `mcp.kit.carryjournal.com`,
which stays **outside** the Access self-hosted application (a wildcard application would block the MCP host's
OAuth endpoints). The Access application covers `kit.carryjournal.com` only.

Not verified at the edge: Access in front of the real hostname, remote D1 and its free-plan limits. The D1
daily-limit error path is only a generic 500 today.
