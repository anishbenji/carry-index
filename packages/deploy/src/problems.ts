/**
 * Every rule the privacy wall can report. A problem names a path and a rule, never file contents
 * (privacy-wall design v2, crossing E: CI logs are public).
 */
export type Rule =
  // seal: the allow-list copy and its walker (section 2)
  | "no-matching-row"
  | "symlink"
  | "hard-link"
  | "special-file"
  | "too-large"
  | "bad-content"
  | "fit-data-invalid"
  | "redirects-invalid"
  | "too-many-files"
  | "total-too-large"
  | "file-changed"
  // check 2: the canary and the heuristic bundle scans (section 5)
  | "canary"
  | "public-marker-missing"
  | "email"
  | "local-path"
  // check 2: the security headers in `_headers`
  | "headers-invalid"
  | "headers-missing"
  | "headers-over-limit"
  | "headers-weak"
  // check 1: the schema walk (section 5)
  | "surface-changed"
  | "never-public-name"
  | "open-shape"
  | "surface-unknown-export"
  | "schema-unrepresentable"
  | "unsafe-default"
  | "open-record"
  | "schema-rewrite"
  // check 1: the public build's resolved module graph (security-sol r2, S2-4)
  | "module-graph-missing"
  | "module-graph-mismatch"
  | "private-module"
  | "worker-import"
  | "graph-checks-disabled"
  // check 3: before upload and live (section 4)
  | "dry-run-output"
  | "live-bindings"
  | "live-tail-consumers"
  | "live-logpush"
  | "live-observability-export"
  | "live-api-error"
  | "live-subdomain"
  | "worker-missing"
  // check 3: someone else deployed between the gate's last read and its write (compare and swap on the deployment id)
  | "deployment-changed"
  // triggers turns workers.dev on only for this build's sealed version at 100% (S5-5)
  | "live-version-not-sole"
  | "live-version-untagged"
  | "live-version-not-sealed"
  // check 3 again after a rollback: the live Worker still does not match, or could not be read
  | "live-after-rollback";

export interface Problem {
  /** A path relative to the folder or schema being checked (`bags/x.html`, `bagSchema.notes`). */
  path: string;
  rule: Rule;
  /** For `live-api-error`: the HTTP status of the reply, when there was one and it was not 200. */
  status?: number;
}

export interface CheckResult {
  ok: boolean;
  problems: readonly Problem[];
}
