/**
 * T11 to T13 are Release 1.1 or run only at the edge (privacy-wall design v2, "Tests that prove each guarantee").
 * T10 is real now, in t10-workflows.test.ts.
 */
import { describe, test } from "vitest";

describe("T11 to T13, not in the Saturday minimum", () => {
  test.todo(
    "T11 (1.1) repo policy: no tracked wrangler*, .dev.vars* or .env* file (except .env.example) and no tracked symlink",
  );
  test.todo(
    "T12 (Kit minimum, edge) Kit is never exposed: no Access JWT gets 401, 403 or the Access redirect; /mcp without a bearer gets 401 with resource_metadata; other paths 404; workers.dev and previews do not answer",
  );
  test.todo(
    "T13 (edge, after each deploy) smoke test: /wrangler.json, /.dev.vars, /.env, /.git/config and a .map URL return 404; security headers present; noindex on workers.dev only",
  );
});
