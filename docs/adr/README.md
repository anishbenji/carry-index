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
