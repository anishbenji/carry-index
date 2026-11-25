# Carry Index: decisions log

Answers to the open questions in the unified build brief (B1 to B12, N1 to N12) and the architecture doc (A1 to A15). The director turns each entry into an ADR. This file is public once exported: decisions only, no private data.

# Already decided before this log

## A4: No page per airline
- Decision: No page per airline. Airline fit stays a widget on the listing and each bag page; unchecked airlines are shown as unchecked.
- Why: Decided in the architecture doc review.
- Status: decided
- Date: 2026-11-15

## A13: Effect deferred for v1
- Decision: No Effect in v1. Zod 4 for schemas and plain Bun scripts for the pipeline. Revisit when Effect's http-api and sql modules are stable or the pipeline grows into re-verification work.
- Why: Re-checked 25 Nov; the modules needed are still tagged unstable.
- Status: decided
- Date: 2026-11-15 (re-checked 2026-11-25)

## B4: Private app name
- Decision: The private app keeps the name Kit Watch.
- Why: Decided 25 Nov.
- Status: decided
- Date: 2026-11-25

## Combined system
- Decision: Kit Watch and Carry Journal are one system with a private side and a public side, joined only by a reviewed publish step.
- Status: decided
- Date: 2026-11-25

## Stack
- Decision: Solid 2 (2.0.x, exact pins) for both apps; built in T3 Code with a director thread.
- Status: decided
- Date: 2026-11-25

# Batch 1: names and repo

## N12: Public name and main domain
- Decision: The public site is called "Carry Journal" in one fixed form everywhere. carryjournal.com is the main domain; mycarryjournal.com, if owned, permanently redirects to it. "Carry Index" stays an internal name.
- Why: Accepted the recommendation (short, matches the domain; "The Carry Index" clashes with an existing carryindex.com).
- Status: decided
- Date: 2026-11-25

## B1 / A1: One public repo, location and name
- Decision: One public GitHub repo for both apps, named `carry-index`, built in the existing local folder `~/code/the-carry-index` so the daily airline checker keeps running. Private data never enters the repo.
- Why: Accepted the recommendation (one schema, one CI, a showcase; the folder stays put for the scheduled job). Repo name matches the umbrella project name. The folder and repo names differ on purpose for now; renaming the folder to `carry-index` may follow after Release 1, together with repointing the airline checker job.
- Status: decided
- Date: 2026-11-25

## B8a: Byline
- Decision: Published reviews and articles carry his real full name as author, on the page and in the Article and Review structured data.
- Why: He wants Carry Journal to count as public portfolio work tied to him; his GitHub profile already shows his real name, so a pen name would add little privacy.
- Status: decided (applies from the publish step, milestone 5)
- Date: 2026-11-25

## B8b: Affiliate links
- Decision: No affiliate links at launch. If any are added later, each is disclosed on the page that carries it.
- Why: Chose the cleanest trust position for launch.
- Status: decided
- Date: 2026-11-25

## A9: Launch order
- Decision: Launch the UHMWPE backpack section first (listing, bag pages, fabric pages), with the home page as a short introduction to Carry Journal. Other sections follow later.
- Why: Accepted the recommendation; it is the most complete section and ships soonest.
- Status: decided
- Date: 2026-11-25

# Batch 2: Release 1

## N10: Release 1 scope and date
- Decision: Release 1 targets Saturday 28 Nov 2026 evening. Public site live: home, UHMWPE listing, 12 bag pages, fabric pages, about and sources, sitemap and 404, with every budget and gate in CI and the metrics beacon collecting from day one. Kit Watch foundation: Cloudflare Access sign-in, D1 schema and migrations, the import (dry run, then real), read-only item pages and search. Not in Release 1: carry logging in the new app, the publish flow, watchlist and alerts, review pages. Today's Kit Watch page stays the working tool. Cut scope, never quality; cut order: compare page, private search screen, fabric comparison page, live performance figures.
- Why: Accepted as proposed.
- Status: decided
- Date: 2026-11-25

## N11: Go live on Saturday
- Decision: Go live on carryjournal.com on Saturday, indexed, with unchecked airlines marked as unchecked. This replaces the earlier gate that every airline's cabin limits be checked before launch.
- Why: Real-visitor speed data and search indexing start only once the site is live.
- Status: decided
- Date: 2026-11-25

## A6: Photos at launch
- Decision: Photos are published only where the brand has granted permission. Bags without permission launch with line drawings; photos are added when permission arrives.
- Why: Accepted the recommendation.
- Status: decided
- Date: 2026-11-25

## B10 / A8: Paid plan
- Decision: Stay on Cloudflare free tiers. Move to Workers Paid (US$5 a month) only if a daily free limit is actually hit.
- Why: Accepted the recommendation. Open spike item: whether enabling R2 asks for a payment card.
- Status: decided
- Date: 2026-11-25

# Batch 3: speed, part 1

## N1: Static first
- Decision: Content pages (bag, fabric, article, about) ship no framework script; only an inline theme and units snippet under 1 KB. Interactive parts (sort and filter, airline widget, weight chart, compare picker) are small islands that load when idle or on first use. Solid 2 still renders every page at build and runs the private app. Subject to the spike: the listing and one bag page are built both ways and he confirms at the Thursday gate with the numbers. Fallback if Solid's start mode cannot omit the client entry: a plain Vite server build and a short prerender script.
- Why: Accepted the recommendation (least possible script).
- Status: decided, confirm at Thursday gate
- Date: 2026-11-25

## A10: Navigation on the public site
- Decision: Document loads only; no client router on the public site. Speculation Rules prerender the next page on hover or touch in Chromium browsers, as an extra.
- Why: Follows from N1.
- Status: decided (follows N1; revisit only if N1 is reversed at the Thursday gate)
- Date: 2026-11-25

## N2: Budgets
- Decision: Adopt the brief's proposed budget table as failing CI checks: field LCP under 1.0 s (75th percentile), INP under 50 ms, CLS 0 in the lab and under 0.01 in the field, content-page JavaScript under 8 KB compressed (beacon included), listing under 15 KB before a widget opens, whole-site CSS under 10 KB, content-page HTML with inlined CSS under 14 KB, listing HTML under 40 KB, system fonts, no third-party requests, every page restores from the back/forward cache. Starting estimates: reset after the spike only by an explicit, recorded decision.
- Why: Accepted the recommendation.
- Status: decided
- Date: 2026-11-25

## N3: Inline the stylesheet
- Decision: Inline the site stylesheet into each page while it stays under about 10 KB compressed, if the spike shows a cold-load gain over an external file under the hash-based CSP.
- Why: Accepted the recommendation.
- Status: decided, confirm at Thursday gate
- Date: 2026-11-25

# Batch 4: speed, part 2

## N4: Fonts
- Decision: System fonts only at launch (0 KB of web fonts). A brand font may be added later only against a measured cost that fits the budgets.
- Why: Accepted the recommendation.
- Status: decided
- Date: 2026-11-25

## N5: JPEG XL
- Decision: Test JPEG XL against AVIF on three sample photos in the spike. Offer it for large review photos only if it is smaller at matched quality; AVIF and WebP remain the automatic fallbacks.
- Why: Accepted the recommendation.
- Status: decided, confirm with spike result
- Date: 2026-11-25

## N6: Animated page transitions
- Decision: No cross-document view transitions in Release 1. Revisit later against the budgets, with reduced-motion support.
- Why: Accepted the recommendation.
- Status: decided
- Date: 2026-11-25

## N7: Service worker on the public site
- Decision: No service worker on the public site. The HTTP cache, the edge and prerendering cover repeat visits. The private app gets one for offline logging.
- Why: Accepted the recommendation.
- Status: decided
- Date: 2026-11-25

# Batch 5: site structure

## A3: URLs
- Decision: Keep the planned routes: `/uhmwpe-backpacks` (listing), `/bags/<model>`, `/fabrics/<id>`, `/compare`, `/about`, `/sources`, `/performance`. Written pieces get three homes: `/reviews/<slug>` for reviews, `/articles/<slug>` for articles, and `/journal/<slug>` for blog-style posts and anything that fits neither. A redirect map covers any future rename.
- Why: Reviews and articles each get a clear section; the journal holds everything else.
- Status: decided
- Date: 2026-11-25

## Compare page
- Decision: The compare page (two or three bag builds side by side) is wanted, and ships after Release 1.
- Why: Accepted the recommendation; it is first on the Release 1 cut list.
- Status: decided
- Date: 2026-11-25

## N8: Search on the public site
- Decision: No search on the public site at launch. Once articles exist, add an on-demand search that downloads nothing until the search box is opened.
- Why: Accepted the recommendation; navigation and listing filters cover about 30 pages.
- Status: decided
- Date: 2026-11-25

## A5: Public performance page
- Decision: `/performance` is public from day one, showing real-visitor figures, with an "early data" note until there are enough visits.
- Why: Accepted the recommendation; it is the strongest proof of the speed claim.
- Status: decided
- Date: 2026-11-25

# Batch 6: support and operations

## N9: Browser floor
- Decision: Anything a page depends on must be Baseline Widely available (worked across Chrome, Edge, Firefox and Safari for at least 30 months). Newer features are extras only, listed on an allow-list, and the page must be complete without them. Browserslist query `baseline widely available with downstream`; a Baseline lint fails the build. Revisit the floor once real traffic shows which browsers visitors actually use.
- Why: Accepted for now; he wants the floor revisited against actual traffic.
- Status: decided (revisit with traffic data)
- Date: 2026-11-25

## A2: Router
- Decision: The private app uses Solid Router 2.0. The public site has no client router (see A10).
- Why: Accepted the recommendation (first-party, typed routes, the Solid docs' default).
- Status: decided
- Date: 2026-11-25

## A7: Source maps
- Decision: Keep source maps private. Store them in Cloudflare R2 if enabling R2 needs no payment card; otherwise keep them only as CI artifacts. The spike answers the card question.
- Why: Accepted the recommendation.
- Status: decided (depends on spike finding)
- Date: 2026-11-25

## A11: Outside uptime check
- Decision: Add one free external uptime monitor on the home page as a backstop for Cloudflare or account outages. It is the only piece outside Cloudflare. Its alert address is set in that service's dashboard and never committed.
- Why: Accepted the recommendation.
- Status: decided
- Date: 2026-11-25

# Batch 7: operations, part 2

## A12: Cloudflare Web Analytics
- Decision: Keep Cloudflare Web Analytics off. Visitor and speed figures come only from the site's own first-party beacon.
- Why: Accepted the recommendation; it injects a third-party script.
- Status: decided
- Date: 2026-11-25

## A14: Airline checker format
- Decision: The airline checker keeps writing its own format for now. The pipeline converts it under a contract test that fails on format drift. The checker moves to the shared schema once the schema settles.
- Why: Accepted the recommendation; the daily job stays untouched during the build week.
- Status: decided
- Date: 2026-11-25

## A15: User submissions
- Decision: The public site accepts no submissions and stays fully static, with no runtime API. Contact routes: each bag page has a "Suggest a correction" link that opens a pre-filled GitHub issue (template asks for the bag, the field and a source link), and the about page shows a dedicated email alias on carryjournal.com that forwards privately. The personal address is never published or committed; the forwarding target is set in the Cloudflare dashboard.
- Why: Issue links suit structured, sourced corrections; the alias works for brands and readers without a GitHub account, and can be rotated if it draws spam.
- Status: decided
- Date: 2026-11-25

## Stale-data flag
- Decision: Two ages. An airline cabin limit not re-checked within 60 days, or a bag spec not re-checked within 180 days, gets a "last checked" note on the page and a CI warning. Stale data never blocks a deploy.
- Why: Airline limits change more often and the checker refreshes them about monthly, so 60 days only fires if the checker has been failing; maker specs rarely change and are re-read by hand, so 180 days keeps the recurring work reasonable.
- Status: decided
- Date: 2026-11-25

## Metrics beacon timing
- Decision: The first-party metrics beacon ships in Release 1 and collects from launch day: one report per page view, no cookies, no stored IP addresses, collected fields listed on the about page, counted inside the 8 KB budget.
- Why: Accepted the recommendation; field data needs weeks to build and the public performance page needs it.
- Status: decided
- Date: 2026-11-25

# Batch 8: the private app

## B2: Private app hostname
- Decision: Kit Watch lives at `kit.carryjournal.com`, behind Cloudflare Access, on its own Worker.
- Why: Accepted the recommendation; the hostname is visible in DNS and certificate logs, but it reveals only that a private app exists.
- Status: decided
- Date: 2026-11-25

## B3: Sign-in
- Decision: Cloudflare Access with Google sign-in, and a one-time code by email as the fallback. The allowed address is entered by him in the Cloudflare dashboard (or supplied from a secret) and is never committed to the repo, written into docs or logs, or typed into chat.
- Why: Accepted the recommendation.
- Status: decided
- Date: 2026-11-25

## B5: Medicine data
- Decision: Medicine data stays out of the new app. It remains on the old Kit Watch page, untouched. The new app has no medicine tables. Before the old page is retired (milestone 7), a decision on where medicine data goes is required.
- Why: Accepted the recommendation; keeps the most sensitive data out of the system that has a publish step.
- Status: decided (blocks milestone 7 until its new home is decided)
- Date: 2026-11-25

## B6: Other people in his records
- Decision: Other people are stored as roles (for example "wife", "brother", "friend"), never by name. The import converts existing names to roles; any name it cannot map is listed for him to resolve, never guessed. Names are also on the never-public list.
- Why: Accepted the recommendation.
- Status: decided
- Date: 2026-11-25

# Batch 9: the private app, part 2

## B7: Debrief answers visibility
- Decision: Debrief answers start private. They are used as source material: Claude suggests content to publish from them over time (articles, reviews, comparisons, social and video ideas), drafts it, and he reviews every piece before it is published. Nothing becomes publishable without his review, and every publish remains a reviewed pull request.
- Why: Keep personal records private by default while still mining them for Carry Journal content.
- Status: decided
- Date: 2026-11-25

## B9: Launch without a first review
- Decision: The public index launches on its own gate. Review and article pages arrive when the publish step lands (milestone 5).
- Why: Accepted the recommendation.
- Status: decided
- Date: 2026-11-25

## B11: Offline logging
- Decision: The offline carry-logging queue follows the first journal release (milestone 4); the first release logs online only.
- Why: Accepted the recommendation; ships the journal sooner.
- Status: decided
- Date: 2026-11-25

## B12: Photos and video
- Decision: Originals stay in his phone's photo library. Only the photos and videos he chooses are uploaded to the private R2 bucket.
- Why: Accepted the recommendation; stays well inside free storage.
- Status: decided
- Date: 2026-11-25
