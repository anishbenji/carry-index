# Architecture decision records

One record per entry in [`docs/brief/decisions.md`](../brief/decisions.md), in the same order, plus two records
from the 25 Nov setup interview (0044, 0045) whose entries in the log are pending. A decision
changes only by a new record that supersedes the old one, never by editing it. Records marked provisional are
confirmed or reversed with measured numbers: at the spike's Thursday gate (26 Nov 2026), or, for ADR-0020, with
the build's JPEG XL measurement.

| ADR | Decision | Entry | Status |
|---|---|---|---|
| [0001](0001-no-airline-pages.md) | No page per airline | A4 | Accepted |
| [0002](0002-effect-pipeline.md) | Effect deferred for v1 | A13 | Deferred |
| [0003](0003-private-app-name.md) | The private app is called Kit Watch | B4 | Accepted |
| [0004](0004-combined-system.md) | One system: private side, public side, one reviewed publish step | Combined system | Accepted |
| [0005](0005-solid-2.md) | Solid 2 for both apps, built with a director thread in T3 Code | Stack | Accepted |
| [0006](0006-public-name-domain.md) | Public name Carry Journal on carryjournal.com | N12 | Accepted |
| [0007](0007-one-public-repo.md) | One public repository for both apps | B1 / A1 | Accepted |
| [0008](0008-byline.md) | Reviews and articles carry the owner's real name | B8a | Accepted |
| [0009](0009-no-affiliate-links.md) | No affiliate links at launch | B8b | Accepted |
| [0010](0010-launch-order.md) | Launch the UHMWPE backpack section first | A9 | Accepted |
| [0011](0011-release-1.md) | Release 1 scope and date: Saturday 28 Nov 2026 | N10 | Accepted |
| [0012](0012-go-live-saturday.md) | Go live on Saturday with unchecked airlines marked | N11 | Accepted |
| [0013](0013-photos-at-launch.md) | Photos only with the brand's permission | A6 | Accepted |
| [0014](0014-free-tier.md) | Stay on Cloudflare free tiers | B10 / A8 | Accepted |
| [0015](0015-static-first.md) | Static first: no framework script on content pages | N1 | Accepted, provisional |
| [0016](0016-navigation.md) | Document navigation only on the public site | A10 | Accepted |
| [0017](0017-budgets.md) | Performance budgets are failing CI checks | N2 | Accepted |
| [0018](0018-inline-css.md) | Inline the site stylesheet while it stays small | N3 | Accepted, provisional |
| [0019](0019-system-fonts.md) | System fonts only at launch | N4 | Accepted |
| [0020](0020-jpeg-xl.md) | Test JPEG XL against AVIF | N5 | Accepted, provisional |
| [0021](0021-no-view-transitions.md) | No animated page transitions in Release 1 | N6 | Accepted |
| [0022](0022-no-public-service-worker.md) | No service worker on the public site | N7 | Accepted |
| [0023](0023-urls.md) | Public URL scheme | A3 | Accepted |
| [0024](0024-compare-page.md) | Compare page ships after Release 1 | Compare page | Accepted |
| [0025](0025-no-public-search.md) | No search on the public site at launch | N8 | Accepted |
| [0026](0026-performance-page.md) | Public performance page from day one | A5 | Accepted |
| [0027](0027-browser-floor.md) | Browser floor: Baseline Widely available | N9 | Accepted |
| [0028](0028-router.md) | Solid Router 2.0 for the private app | A2 | Accepted |
| [0029](0029-source-maps.md) | Source maps stay private | A7 | Accepted |
| [0030](0030-uptime-monitor.md) | One free external uptime monitor | A11 | Accepted |
| [0031](0031-no-web-analytics.md) | Cloudflare Web Analytics stays off | A12 | Accepted |
| [0032](0032-airline-checker-format.md) | The airline checker keeps its own format | A14 | Accepted |
| [0033](0033-no-submissions.md) | No user submissions; corrections by issue or email alias | A15 | Accepted |
| [0034](0034-stale-data.md) | Stale-data flags: 60 days for airlines, 180 for bag specs | Stale-data flag | Accepted |
| [0035](0035-metrics-beacon.md) | First-party metrics beacon from launch day | Metrics beacon timing | Accepted |
| [0036](0036-private-hostname.md) | Kit Watch at kit.carryjournal.com behind Access | B2 | Accepted |
| [0037](0037-sign-in.md) | Sign-in through Cloudflare Access | B3 | Accepted |
| [0038](0038-medicine-data.md) | Medicine data stays out of the new app | B5 | Accepted |
| [0039](0039-people-as-roles.md) | Other people are stored as roles, never names | B6 | Accepted |
| [0040](0040-debrief-private.md) | Debrief answers start private | B7 | Accepted |
| [0041](0041-launch-without-review.md) | The public index launches without a first review | B9 | Accepted |
| [0042](0042-offline-logging-later.md) | Offline carry logging follows the first journal release | B11 | Accepted |
| [0043](0043-media-storage.md) | Only chosen photos and videos are uploaded | B12 | Accepted |
| [0044](0044-licences.md) | Licences for code, data, drawings and writing | setup 2026-11-25 | Accepted |
| [0045](0045-pre-launch-deploys.md) | Merges deploy to workers.dev before go-live, not indexed | setup 2026-11-25 | Accepted |

## Proposed at the Thursday gate (spike results)

Each is for the user to accept or reverse at the gate on 26 Nov 2026, except ADR-0048, which the director accepted
overnight under the user's instruction (the user may reverse it); the evidence is
in [`docs/spike/results.md`](../spike/results.md). An amendment leaves its ADR unchanged until the user decides.

| Record | Proposal | Status |
|---|---|---|
| [0046](0046-public-site-delivery.md) | The public Worker is assets-only; the beacon is its own Worker | Proposed (spike results, 2026-11-26) |
| [0047](0047-toolchain.md) | Toolchain: TypeScript 7, Biome, Vitest, Bun workspaces | Proposed (spike results, 2026-11-26) |
| [0048](0048-mcp-authorization.md) | MCP authorization for Kit Watch | Accepted (director under the user's overnight instruction, 2026-11-26; user may reverse) |
| [Amends 0014](amendments/0014-spike-results.md) | R2 card question: not confirmed; the dashboard look settles it | Proposed (spike results, 2026-11-26) |
| [Amends 0015](amendments/0015-spike-results.md) | Confirm static first, built with the fallback; page data never in an inline script | Proposed (spike results, 2026-11-26) |
| [Amends 0017](amendments/0017-spike-results.md) | The size gate counts inline scripts per page; budgets unchanged | Proposed (spike results, 2026-11-26) |
| [Amends 0018](amendments/0018-spike-results.md) | Confirm inlined CSS; one build-time CSP hash set for the whole site | Proposed (spike results, 2026-11-26) |
| [Amends 0020](amendments/0020-spike-results.md) | No JPEG XL numbers from the spike; nothing to decide at the gate | Proposed (spike results, 2026-11-26) |
| [Amends 0029](amendments/0029-spike-results.md) | Source maps: CI artifacts stay the fallback | Proposed (spike results, 2026-11-26) |
| [Amends 0036](amendments/0036-spike-results.md) | One Kit Watch Worker for the app host and the MCP host | Proposed (spike results, 2026-11-26) |
| [Amends 0037](amendments/0037-spike-results.md) | How the Worker verifies the Access token; one owner-only policy | Proposed (spike results, 2026-11-26) |
| [Amends 0045](amendments/0045-spike-results.md) | Host-scoped `noindex` works locally; confirm at the edge | Proposed (spike results, 2026-11-26) |

## Accepted by the user, 26 Nov 2026 (privacy wall and deploy design)

| Record | Decision | Status |
|---|---|---|
| [0049](0049-privacy-wall-seal.md) | Privacy wall: seal, not scan | Accepted (user, 2026-11-26) |
| [Amends 0045](amendments/0045-github-actions-deploys.md) | Deploys run in GitHub Actions, not Workers Builds | Accepted (user, 2026-11-26) |
| [Amends 0045](amendments/0045-no-edge-previews.md) | No edge previews before merge on Saturday; previews in 1.1 on a separate Worker | Accepted (user, 2026-11-26) |
| [Amends 0026](amendments/0026-scheduled-rebuild.md) | `/performance` rebuilt by a daily scheduled deploy run | Accepted (user, 2026-11-26) |
| [Amends 0011](amendments/0011-kit-import.md) | Kit Watch's real import waits for the Kit minimum; may move to 1.1 | Accepted (user, 2026-11-26) |
| [Amends 0004](amendments/0004-publish-review.md) | A publish is reviewed inside Kit Watch before push; the PR is a second look | Accepted (user, 2026-11-26) |
