# Carry Journal and Kit Watch: unified build brief for T3 Code

> Exported from the Claude project on 25 Nov 2026. The private Claude doc is the source; this copy is what the director reads.

Nov 25, 2026 · @Anish Benjamin

## What we are building

One repository and one data model serve two apps: Carry Journal, the public site, and Kit Watch, a private app that replaces today's Kit Watch page. Private records reach the public site only through a publish step that you review.

This brief extends [Carry Journal web app: architecture and build plan](architecture.md). That doc stays the plan for the public site, and its quality gates are unchanged. Its budgets and its spike are revised by the performance plan and Release 1 sections below, which are proposals until you accept them. This brief adds the private side, the data model that joins the two, and the publish step. It changes the earlier plan in four places:

- **Solid 2 is now final.** Version 2.0.0 was released on 17 Nov 2026, two days after the architecture doc was written against rc.21. Pin an exact 2.0.x version; the next tag on npm is no longer needed.
- **"No database, no runtime API" now describes the public site only.** The private app has both.
- **The repo's `data/` folder gains `data/published/`.** Only the publish step writes there.
- **Effect was re-checked for the private API** and stays deferred; the reasons are under Stack decisions.

## Names

Three names, one for each thing, as you proposed on 25 Nov.

| Name | What it is | Where the name appears |
| --- | --- | --- |
| Carry Index | The whole project: the repo, the Claude project, the T3 Code project | Internal only |
| Carry Journal | The public site | The site, its domain, search results, social and video |
| Kit Watch | The private app | Only on your own screens |

Two cautions. Your notes record that the name "The Carry Index" clashes with an existing carryindex.com, so it should stay an internal name and never become a public brand. And the public name should be one fixed form: I'd use "Carry Journal" without "My", to match carryjournal.com. An older diagram mentions mycarryjournal.com, so which domain is the main one is an open question below.

## At a glance

&#91;embedded content: system overview · private side, publish step, public side\]

The private app and Claude reach your data only through one Worker. The public site is built from files in the repo, and the publish step is the single route by which a private record becomes one of those files.

## Stack decisions

Solid 2 is the right choice for both apps, used in two different ways.

**Public site: yes, Solid 2 suits a static site.** Every page is prerendered to HTML at build time and served as static files, as the architecture doc already plans. Solid's own guidance is to prerender when content doesn't change between deploys. The one cost is that Solid 2 has no islands mode, so a prerendered page hydrates as a whole. The 35 KB JavaScript budget is therefore unproven until the spike measures it. The performance plan below proposes going further and not hydrating content pages at all; the spike measures both.

**Private app: yes, Solid 2 again, but as a client-rendered app.** It has one user and no search traffic, so it needs no server rendering. The shell is served as static files, and only data calls reach a Worker. Using the same toolchain means both apps share components, the schema package and your Solid 2 agent skills.

| Layer | Choice | Why |
| --- | --- | --- |
| UI, both apps | Solid 2.0.x, exact pins | Final since 17 Nov 2026 ([release](https://github.com/solidjs/solid/releases/tag/solid-js%402.0.0)) |
| Public site | Unchanged: prerendered static pages on Cloudflare Workers Static Assets | See the architecture doc |
| Private app | Solid 2 single-page app on its own hostname and its own Worker | The public Worker never holds a binding to private data |
| Sign-in | Cloudflare Access in front of the private hostname; the Worker checks the Access token | No passwords or auth code to write. Free for up to 50 users ([pricing](https://www.cloudflare.com/plans/sase-zero-trust.md)) |
| Private API | One Worker with typed routes, inputs and outputs validated by the Zod schemas in `packages/schema` | Extends the existing schema decision. The director picks the router and records it in an ADR |
| Database | Cloudflare D1 (SQLite) | Free plan allows 500 MB per database with 7 days of point-in-time recovery ([limits](https://developers.cloudflare.com/d1/platform/limits)). FTS5 full-text search is built in ([SQL reference](https://developers.cloudflare.com/d1/sql-api/sql-statements/)) |
| Media | Cloudflare R2, private bucket | Originals stay private; published copies are resized into the public build |
| Access for Claude | A remote MCP server on the private Worker, using Cloudflare's OAuth provider library ([guide](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/)) | Keeps "tell Claude what I carried" and the daily sale scan working once the Kit Watch page is retired |
| AI inside the app | None in v1 | Splitting and tagging your answers is done by Claude through the MCP server, on your subscription, so the app has no model costs |
| Effect | Not in v1 (ADR-02 stands) | Re-checked 25 Nov. Effect 4 has been stable since 1 Oct and is at 4.1.5, but `effect/http-api`, `effect/sql` and `@effect/sql-d1` are tagged unstable, meaning they may break in minor releases ([migration guide](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md), [HttpApi reference](https://effect.website/docs/v4/api/effect/http-api/HttpApi)). Revisit when those tags turn stable |

D1 has enforced its free daily row limits since 1 Sep 2026: queries fail once the day's allowance is used ([changelog](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)). One person's use should sit far below the limits, but the app must show a clear message if a limit is hit. The Workers free plan's 100,000 daily requests are shared with the public site's beacon Worker.

## Data model

Every record belongs to one of three layers, and the layer decides where it is stored and who can ever see it. All schemas live in `packages/schema` as Zod 4, as today.

| Layer | Records | Stored in | Seen by |
| --- | --- | --- | --- |
| Catalogue | Brand, Model, Variant, Fabric, SourceCheck, AirlineCabinLimit | Files in the repo's `data/` | Everyone |
| Private | OwnedUnit, Purchase, WatchItem, Alert, Loadout, Trip, Carry, Observation, Media, Questionnaire, Answer, TasteProfile | D1, with originals in R2 | You, and Claude through the MCP server |
| Published | Review, Article, Comparison, PublishedObservation, PublishedMedia | Files in `data/published/` | Everyone |

The rules that make the data searchable and linkable:

- **One product, one record.** A bag you own and a bag in the index are the same Model and Variant. Ownership is a private OwnedUnit that points at the Variant. A product you own that the index doesn't cover gets a private catalogue entry in D1, promoted to `data/` only by a publish.
- **Observation is the unit of knowledge.** Each one is a short note in your words about one or more subjects (a Variant, a Loadout, a Trip). It carries a topic (comfort, access, weight, weather, security), a kind (fact, measurement, verdict, friction, delight, idea, comparison, story), a date, and where it came from (a debrief question ID, a carry entry, a collection note). Measurements also store a number and a unit.
- **Links are first-class.** One links table records typed relations between any two records, so every page can show what points at it. Collection notes, carry entries and debrief answers all become Observations linked to their items.
- **Search covers everything private.** An FTS5 index spans observations, notes, items, trips and loadouts, with filters for subject, topic, kind and date.
- **Roles belong to loadouts.** A loadout item can name the job a product does there ("Medicine pouch"), and usage is counted per role as well as per product.
- **Visibility is private by default.** A record is private, publishable or published. Some types can never be published whatever their flag: purchases, prices paid, order references, addresses, medicine, and other people's names. The schema enforces that by type.
- **Existing conventions hold.** Lengths in whole millimetres, weights in whole grams, official product names, and a source link for every spec.

## The privacy wall and the publish step

Nothing private can reach the public site by accident, because the public site has no way to read private data: it builds only from files in the repo.

- **Two Workers, two hostnames.** The public Worker serves static files and the metrics beacon and has no binding to D1 or the private R2 bucket. The private Worker sits behind Cloudflare Access.
- **Publishing is an export, not a query.** You pick records in the private app. It writes them through `Published*` schemas that list only public fields, so private fields are never copied in the first place.
- **Every publish is a pull request.** The export opens a pull request against `data/published/`. You read the diff, merge it, and the existing build redeploys the site. Unpublishing is a pull request that removes the files.
- **Photos are cleaned.** Published images are re-encoded with location and device metadata removed.
- **The repo is public, so it holds no real private data.** Fixtures are synthetic. Exports from the old Kit Watch page never enter the repo folder. Pull request text, screenshots, logs and ADRs use made-up examples.

Three checks keep the wall honest, and none may be skipped or auto-merged:

1. A schema test fails if any `Published*` schema gains a field from the never-public list.
2. A canary test fills a test database with marker strings in every private field, publishes everything publishable, and fails if a marker appears in the export or in the built site.
3. A deploy check fails if the public Worker's configuration gains a D1 or private R2 binding.

Private data is backed up by a nightly D1 export to the private R2 bucket, on top of D1's 7-day point-in-time recovery.

## Public site requirements

The architecture doc already sets strict budgets and gates for the public site. This table lists what it covers and what this brief adds, so nothing is specified twice.

| Area | Already in the architecture doc | Added by this brief |
| --- | --- | --- |
| Performance | Field targets at the 75th percentile: LCP under 1.0 s, INP under 100 ms, CLS under 0.02. First-load JavaScript under 35 KB. Lighthouse 100. Build-time images, system or one subset font, long-cache hashed assets | Tighter budgets are proposed in the performance plan below. Published reviews and articles meet the same budgets as bag pages. Review photos are resized at build like every other image |
| Security | Content Security Policy with no inline allowance, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. No third-party scripts. Rate-limited, same-origin beacon | Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy headers. Dependency audit and secret scanning in CI. Pinned versions with a lockfile. Protected main branch. A `security.txt` file. The public Worker holds no private bindings |
| SEO | `sitemap.xml`, `robots.txt`, canonical URLs, JSON-LD for breadcrumbs and lists, one Open Graph image per bag | A unique title and description per page. Article and Review structured data on published pieces, with you as author. Sitemap `lastmod` dates from the data. A feed for new articles. A redirect map so a renamed URL never breaks. Links from each review to its bag page and back |
| Accessibility | axe checks and keyboard runs in Playwright, in light and dark themes | WCAG 2.2 AA as the stated target. Reduced-motion support. Alt text required on every published image |
| Privacy and trust | No cookies, no stored IP addresses, collected fields listed on the about page | Your opinions and usage are labelled as yours, separate from spec data. Any affiliate link is disclosed on the page |

Every budget in the architecture doc remains a failing check in CI. The additions above each need a check too: a header test for the two new headers, a structured-data validation step, and a rule that fails the build when a published image has no alt text.

## Performance plan: static first (proposed 25 Nov)

The fastest version of this site sends finished HTML and almost no JavaScript, so the proposal is to stop hydrating content pages. Solid 2 still renders every page at build time, and it still powers the widgets and the whole private app. This section is a proposal to debate: the spike measures it against full hydration before anything is fixed.

**How a page gets its data.** Nothing is fetched to draw a page, and no data is typed into components by hand. The pipeline validates the files in `data/` and `data/published/`, and the build writes the result into each page's HTML. Two things stay as static JSON files that load only on demand: a bag's airline-fit table, and later a search index.

### What changes from the architecture doc

| Area | Architecture doc | Proposed |
| --- | --- | --- |
| Content pages: bag, fabric, article, about | The whole page hydrates with Solid | No framework script. An inline theme and units snippet under 1 KB; the rest is HTML and CSS |
| Listing page and widgets | Part of the hydrated page | Small islands: sort and filter, the airline widget, the weight chart, the compare picker. Each loads when the browser is idle or on first use, and mounts into its own slot |
| Moving between pages | Document loads or the router, decided by the spike | Document loads only. No client router on the public site |
| CSS | An external hashed file | One stylesheet for the whole site, inlined into each page while it stays under about 10 KB compressed |

Why this is worth the change: hydration makes the browser download and run the code for markup it has already been given, and it usually puts the page's data in the HTML a second time. A page with no interactive parts gains nothing from that. The cost is a build that is more our own: if start mode cannot leave the client entry off a page, the fallback is a plain Vite server build and a short prerender script.

### Budgets

These replace the first table of the architecture doc if you accept them. Like the originals, they are starting estimates until the spike reports.

| Measure | Now | Proposed |
| --- | --- | --- |
| LCP, field, 75th percentile, first visit | under 1.0 s | under 1.0 s, unchanged. On 4G the connection setup uses most of it, and no site controls that |
| LCP minus time to first byte | not set | under 100 ms on text-led pages, under 300 ms on image-led pages |
| LCP when moving between pages, Chromium | not set | under 200 ms, through prerender on hover or touch |
| INP, field, 75th percentile | under 100 ms | under 50 ms |
| CLS | under 0.02 | 0 in the lab on every template, under 0.01 in the field |
| Total blocking time, lab, 4x CPU slowdown | inside the Lighthouse gate | 0 ms on content pages, under 50 ms on the listing |
| JavaScript, content pages | under 35 KB | under 8 KB compressed, the metrics beacon included, none of it before first paint |
| JavaScript, listing page | under 35 KB | under 15 KB compressed before any widget opens |
| CSS, whole site | not set | under 10 KB compressed |
| HTML with its inlined CSS, content pages | not set | under 14 KB compressed, so the first response fits the first round trip |
| HTML, listing page | under 60 KB | under 40 KB compressed, with everything above the fold in the first 14 KB |
| Requests needed before LCP | not set | 1 on text-led pages, 2 on image-led pages |
| Web fonts | system, or one subset font | 0 KB: system fonts |
| Third-party requests | 0 | 0 |
| Back and forward | not set | every page restores from the browser's back/forward cache |

A new connection carries roughly 14 to 15 KB in its first round trip, which is where the 14 KB figure comes from ([Core Web Vitals checklist](https://www.corewebvitals.io/core-web-vitals/ultimate-checklist)). The same source argues against inlining CSS, because it makes the HTML bigger. That argument weakens when the whole stylesheet is small, which is why inlining is tied to the 10 KB limit and measured in the spike.

### What to use, and what to leave out

| Technique | Decision | Why |
| --- | --- | --- |
| Static HTML from the edge, no Worker in the page path | Use | Already the plan. Nothing runs per request |
| Native HTML and CSS in place of script: `details`, `dialog`, popover, `:has()`, container queries, `light-dark()` | Use, where every evergreen browser has it | Removes script without removing function |
| Sorting cards with CSS `order` | Leave out | The visual order would differ from the keyboard and screen-reader order. A few lines of script that reorder the real elements are the accessible way |
| `content-visibility` on long sections below the fold | Use as an extra | Browsers without it render as normal |
| AVIF with a WebP fallback, exact sizes, LCP image at high priority, the rest lazy | Use | Already the plan |
| JPEG XL as a first choice for large review photos | Test in the spike | Chrome announced decoding from version 155 ([Chrome, 6 Oct 2026](https://developer.chrome.com/blog/jpeg-xl-in-chrome)), Firefox planned it on by default from 157 ([Mozilla, 24 Aug 2026](https://groups.google.com/a/mozilla.org/g/dev-platform/c/3YMV4MS34KA)), and Safari has partial support ([caniuse](https://caniuse.com/jpeg-xl)). Use it only if it is smaller than AVIF at the same quality |
| Speculation Rules: prerender the next page on hover or touch | Use as an extra | Chromium only today. Safari has it built but off by default, and WebKit switched it off in April 2026 after regressions ([WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=312221)). Firefox began prototyping same-origin prefetch in May 2026 ([Mozilla](https://groups.google.com/a/mozilla.org/g/dev-platform/c/gBZYcVxrJN4)). It replaces Cloudflare's Speed Brain, which only prefetches ([Cloudflare](https://blog.cloudflare.com/introducing-speed-brain/)) |
| Early Hints for the LCP image | Measure first | Cloudflare sends cached preload headers early ([Cloudflare](https://developers.cloudflare.com/pages/platform/early-hints)), but the architecture doc found no documentation for it with Workers Static Assets |
| Animated transitions between pages (cross-document view transitions) | Leave out of Release 1 | Works in Chrome, Edge and Safari; Firefox is partial and it is an Interop 2026 focus ([caniuse](https://caniuse.com/cross-document-view-transitions), [Mozilla](https://hacks.mozilla.org/2026/02/launching-interop-2026/)). An animation also adds time to every navigation |
| Compression dictionaries | Leave out for now | Chrome and Edge only, and Cloudflare's support is passthrough: the origin must do the compression, which static assets cannot ([Cloudflare docs](https://developers.cloudflare.com/speed/optimization/content/shared-dictionaries/), [Cloudflare blog](https://blog.cloudflare.com/shared-dictionaries)). Revisit when Cloudflare manages the dictionaries itself |
| Service worker on the public site | Leave out | It adds a start-up cost to navigations and a risk of stale pages. The HTTP cache, the edge and prerendering already cover repeat visits. The private app does get one, for offline logging |
| WebAssembly and web workers in the page | Leave out | Nothing on a page computes enough to repay the download and start-up: fit and standouts are worked out at build. They earn their place in the build tools, and later in search that loads only when opened |
| A Worker in front of the HTML, or a client router | Leave out | Each adds delay or script to every page view |
| Deferred hydration from TanStack Start | Leave out | It does delay and split Solid hydration, but its own guide labels it experimental ([TanStack](https://tanstack.com/start/latest/docs/framework/solid/guide/deferred-hydration)) |

### Added to the spike

1. Build the listing page and one bag page both ways: full hydration through start mode, and static render with islands. Report JavaScript size, total blocking time, LCP and INP from the preview URL. Choose static first unless it cannot be built cleanly on Solid 2.0.x within the timebox.
2. Compare inlined CSS under a hash-based Content Security Policy with an external file. Report cold-load LCP for each, and whether one hash holds for every page.
3. Record which compression Cloudflare serves for static assets, and whether Early Hints fires for them.
4. Check that a prerendered page sends no metrics beacon until the visitor actually opens it.
5. Encode three sample photos as AVIF and JPEG XL at matched quality and compare sizes.
6. Add a Playwright test that every template returns from the back/forward cache.
7. Break time to first byte down by country on the performance page. I recall reports that some Indian networks reach free-plan Cloudflare sites through locations outside India; I did not check that on 25 Nov, so measure it.

## Browser support and accessibility

The site must work fully in every evergreen browser: Chrome, Edge, Firefox and Safari, on desktop and phone, plus the Chromium browsers built on them such as Samsung Internet.

**The floor is Baseline Widely available.** That label means a feature has worked across all the core browser engines for 30 months ([web.dev](https://web.dev/blog/baseline-digest-mar-2026)). Anything a page needs in order to work must be at that level.

- **One setting drives the build.** Browserslist accepts the query `baseline widely available with downstream`, where "with downstream" adds browsers such as Samsung Internet ([web.dev](https://web.dev/blog/baseline-digest-sep-2025)). The JavaScript and CSS compile targets read from it.
- **Newer features are extras only.** Speculation Rules, JPEG XL and `content-visibility` may be used when the page is complete and correct without them. Each one goes on a short allow-list in the repo.
- **Content pages work with scripts off.** That follows from the static-first plan, and a Playwright test with JavaScript disabled keeps it true.
- **Checks.** Playwright runs every end-to-end test in Chromium, Firefox and WebKit, at phone and desktop sizes. A Baseline lint fails the build when CSS or JavaScript outside the allow-list is newer than the floor. Lighthouse now has a Baseline Features audit that reports the same thing ([web.dev](https://web.dev/blog/baseline-digest-jul-2026)).
- **Real devices before launch.** Playwright's WebKit is close to Safari but is not Safari. Check the listing, a bag page and the airline widget by hand on your iPhone in Safari, and on the Fold in Chrome and Samsung Internet.

**Accessibility is already a gate, and it gains a manual pass.** The target stays WCAG 2.2 AA, with axe and keyboard runs in Playwright in both themes, reduced-motion support and required alt text. Automated checks cannot judge everything, so Release 1 adds:

- A screen-reader pass on the listing, a bag page and the airline widget: VoiceOver on the iPhone and Mac, TalkBack on the Fold.
- Reflow at 320 px wide and at 200% zoom, with no sideways scrolling outside tables.
- A check in forced-colours mode, and that focus is always visible and never hidden under a sticky header.
- Touch targets of at least 24 by 24 px.
- Sort and filter announce the new result count to screen readers.
- The visual order always matches the order in the HTML.

## Private app requirements

The private app must do everything the Kit Watch page does today, then add search, linking and the debrief flow that the page can't offer. It is used mostly from a phone, so every screen is designed for a phone first.

| Screen | What it does | Replaces on the Kit Watch page |
| --- | --- | --- |
| Today | Log a carry from a loadout: mark used, carried, left out, wished for; add what worked, what got in the way, ideas | Carry journal log form |
| Loadouts | What lives in each bag, with pocket, role and just-in-case marks | Loadouts |
| Journal | Carry entries and insights: workhorses, dead weight, gaps, bag rotation, review material, shelf picks | Entries, "What the log says", "Off the shelf" |
| Trips | Packing list with took, used and missed; departure checklist; debrief questionnaire answered in the app | Trips tab, plus the questionnaire doc |
| Item page | Everything about one product: units, purchases, carries, observations, photos, watch status, published pieces | Collection rows and their notes |
| Search | Full-text search with filters for item, trip, topic, kind and date | New |
| Watchlist and alerts | Watched items, sale alerts and picks, upcoming sale windows | Watchlist, Alerts and picks |
| Publish | Pick records, preview the export, open the pull request | New |
| Profile and guide | Taste profile with corrections; buying guide and landed-cost calculator | Taste profile, Buying guide |

Requirements that apply across screens:

- **Keep the interface sparse.** No extra input boxes for edge cases. An exception, such as a role title on a pouch, is set through Claude or an item's detail view.
- **Installable and tolerant of poor signal.** It installs to the phone's home screen. A carry logged offline is queued and sent later. The offline queue can follow the first release.
- **Claude can do what the app can.** The MCP server offers tools to search, read an item, log a carry, add observations, update a loadout, read and update the watchlist, post an alert, and prepare a publish. It can never merge a publish.
- **Questionnaires are generated.** A debrief is built from a template plus the trip's packing list, in the shape of the Kerala debrief (a private questionnaire, not in this repo). Each answer is stored against its question ID and split into Observations.
- **Medicine is out of scope for the first release.** It stays on the old page until you decide how it should be handled (see Open questions).

## Moving off the current Kit Watch page

The Kit Watch page keeps running until the private app matches it, so nothing is lost or paused during the build. Its database held about 520 documents on 16 Nov.

| Collection on the page | Becomes |
| --- | --- |
| `owned` (about 280 items, with units, notes and published reviews) | Model and Variant where the product is real catalogue material; OwnedUnit and Purchase; each note becomes an Observation |
| `watch`, `feed`, `brands` | WatchItem, Alert, and buying-guide notes per Brand |
| `imports` (email review queue) | Import queue, with decisions kept |
| `kits` | Loadout and its items, with roles, pockets and just-in-case marks |
| `carry`, `carryReviews` | Carry entries and Claude's periodic reads |
| `trips` | Trip, packing items, checklist |
| `profile/current` | TasteProfile and its correction log |
| Private medicine documents | Not migrated in the first release |

How the import runs:

1. Claude exports each collection from the page to JSON files outside the repo folder.
2. A one-off import command reads those files, validates them with the schemas, and writes to D1 through the private API.
3. The import is safe to repeat: every record keeps its old ID as a source key, so a second run updates and never duplicates.
4. A dry run prints counts per collection and every record it could not map. The real run happens only when that list is empty or you have accepted what is on it.
5. Product names are matched to the catalogue by official name. Unmatched names are listed for you to resolve, never guessed.

The Kerala debrief answers are filed straight into the new shape as Observations, whether they arrive before or after the import exists. Scheduled tasks such as the daily sale scan move to the MCP server at milestone 6 and run against both systems for a week before the page is frozen.

## Milestones

The public site's launch does not wait for the private app: milestone 1 runs in its own threads alongside milestones 2 and 3. Each milestone ends at a gate that must pass before the next one starts.

1. **Spike (3 working days, cut to 1 for Release 1).** Answer the seven spike questions in the architecture doc, plus two for the private side: does a Solid 2 app behind Cloudflare Access read and write D1 on the free plan, and can Claude connect to an MCP server on that Worker? *Gate: each answer is written into an ADR.*
2. **Public site.** Phases 1 onward of the architecture doc, unchanged. *Gate: that doc's quality gates, and the launch items in your open-items doc.*
3. **Private foundation.** Private schemas, D1 migrations, Access, the private API, the import, and read-only Item and Search screens. *Gate: the dry run reconciles every collection's counts, and the canary and binding checks pass.*
4. **Journal.** Today, Loadouts, Journal, Trips, the debrief flow, Observations and the MCP tools. *Gate: you log one full week of carries from your phone in the new app alone, and the Kerala debrief is searchable by item and by topic.*
5. **Publish.** The export, the pull request flow, and review and article pages on the public site. *Gate: one real review goes from private notes to the live site, and all three wall checks pass.*
6. **Watch and alerts.** Watchlist, alerts, taste profile, buying guide, and the sale scan through MCP. *Gate: the daily scan runs against both systems for seven days with matching results.*
7. **Retire the Kit Watch page.** Freeze it read-only, keep a final export, then remove it. *Gate: you confirm nothing is missing.*

## Release 1: target Saturday 28 Nov

Release 1 is the public site live and the private foundation in place by Saturday evening. Logging carries in the new app, publishing and alerts come after it, because their gates need calendar time and not agent time.

&#91;embedded content: Release 1 timeline · Wed 25 to Sat 28 Nov\]

Both spikes start tonight and end at the Thursday gate. Your weekly usage resets on Sunday at 04:30, so the heavy agent work is planned to finish on Saturday.

| Part | In Release 1 | Later, and why |
| --- | --- | --- |
| Carry Journal, the public site | Home, the UHMWPE listing, 12 bag pages, the fabric pages, about and sources, sitemap and 404. Every budget and gate running in CI. The metrics beacon collecting from the first day | Review and article pages, which need the publish step. The compare page. Photos still waiting for a brand's permission. Real figures on the performance page, which need visitors |
| Kit Watch, the private app | Access sign-in, the D1 schema and migrations, the import reconciled in a dry run and then run for real, read-only item pages and search | Logging carries in the new app: its gate is a full week of use. The publish flow. Watchlist, alerts and the sale scan: their gate is seven days of running in parallel. The MCP tools beyond the spike's proof |
| Today's Kit Watch page | Stays your working tool, unchanged | Retired at milestone 7 |

How this week changes the plan:

- **The spike is cut from three days to one.** It answers only the questions that decide architecture: whether the prerendered site deploys to Workers, full hydration against static first, the Content Security Policy, the TypeScript 7 check, and Access with D1. The other spike questions move into the build.
- **Cut scope, never quality.** If Saturday is at risk, drop things in this order: the compare page, the private search screen, the fabric comparison page, live figures on the performance page. Budgets, accessibility checks, security headers and the wall checks are never dropped to make the date.
- **Your time is the limit, not the agents'.** The never-auto-merge paths wait for your review, and only you can create the repo, connect Cloudflare and approve Access. A review block each morning and evening keeps the threads moving.
- **Solid 2.0 is eight days old.** If prerendering or static first fails on it, the Thursday gate is where we pick the fallback, and Saturday may slip.
- **Going live is a separate decision from finishing.** Your earlier launch gate was that every airline's cabin limits are checked first. The open questions ask whether to go live on Saturday with unchecked airlines marked as unchecked, or to hold the finished site on a preview address.

## Working rules for the build agent in T3 Code

Run this the way the tscache director runs: one director thread holds the plan and hands small pull requests to worker threads, with cross-model review before merge. The "Working in T3 Code" section of the architecture doc still applies; these rules are added for the private side.

- **Decisions before code.** You answer the open questions in a questionnaire thread in the Claude project, and it writes them to a decisions log. The director turns each answer into an ADR and asks you only about what the log leaves open. The director cannot open these private Claude documents by link, so the same thread exports this brief, the architecture doc and the decisions log into `docs/brief/` as Markdown first.
- **One milestone per brief.** Each lands green on its own. Public-site threads and private-app threads don't share a pull request.
- **Private data never enters the repo.** Agents work with synthetic fixtures only. They don't paste real records into code, tests, commit messages, pull requests, screenshots or ADRs. Anything that looks like real private data in a diff is a blocking review finding. Your email address counts as private: the Access policy is set in the Cloudflare dashboard or from a secret, and is never committed.
- **Never auto-merge:** `packages/schema`, D1 migrations, the publish export and its tests, either Worker's `wrangler.jsonc`, `_headers`, the CI workflow, Access configuration, and anything under `data/`.
- **Ask first:** a new paid service, a new dependency, any change to the never-public list, any change to a public URL, and anything that touches the old Kit Watch page.
- **Notify after merge:** a budget change, a schema change, a new MCP tool.
- **Sources for Solid 2:** the v2 docs and the skills shipped inside the `solid-js` package. Solid 1 patterns and SolidStart are not used.
- **Done means:** type check, lint, unit and component tests, end-to-end tests, the wall checks, and the budgets all pass, and the director's verifier and skeptic have reviewed the decision.

First prompt for the director thread:

```
You are the director for the Carry Index monorepo: Carry Journal (the public site) and Kit Watch (the private app). Read these files in docs/brief/ before anything else:
1. architecture.md: the plan for the public site.
2. unified-brief.md: adds the private app, the shared data model, the publish step, the performance plan and Release 1. Where the two differ, this one wins.
3. decisions.md: my answers to the open questions in both documents.

Your first job is not code. Turn each answer in decisions.md into an ADR under docs/adr/. Ask me only about questions the log leaves open, one at a time. Then plan the one-day spike as small pull requests, including the comparison of full hydration against static first. Name the worker thread and model for each from the model roster, and show me the plan before any thread starts.

Standing rules: private data never enters this repo, my email address included; use synthetic fixtures only. Never auto-merge the paths listed in the brief. Use Solid 2.0.x with exact pins, Zod 4 for schemas, and no Effect in v1. Cut scope before quality: budgets, accessibility checks, security headers and the wall checks are never relaxed to meet a date. Stop and ask before adding a dependency or a paid service.
```

## Open questions for Anish

My recommendation follows each question. The questionnaire thread asks all of them with fuller explanations, together with the open questions in the architecture doc.

1. **One public repo for both apps?** The code would be public and the private data never in it. I'd say yes: it is simpler and a stronger showcase. The alternative is a private repo for the Kit Watch app that imports the shared schema.
2. **Hostname for the private app?** I'd use `kit.carryjournal.com`.
3. **How do you sign in through Cloudflare Access?** I'd use your Google account, with a one-time code by email as the fallback.
4. **Does the name Kit Watch stay** for the private app? Answered on 25 Nov: yes, see Names.
5. **Medicine data.** Leave it out of the new app entirely, or bring it in later with extra protection? I'd leave it out until the journal has proven itself.
6. **Other people in your records.** Store family as roles ("wife", "brother") and never names? I'd say yes.
7. **Debrief answers: private or publishable by default?** I'd default to private and mark pieces publishable as you choose them. Answered on 25 Nov: private by default; Claude suggests content drawn from debrief answers over time, and you review every piece before it is published.
8. **Byline and affiliate links** on published reviews: your name or a pen name, and will any links be affiliate links? Answered on 25 Nov: your real full name; no affiliate links at launch.
9. **Does the public launch wait for a first published review?** I'd say no: launch the index on its own gate and add reviews when milestone 5 lands.
10. **Paid plan.** Stay on free tiers, and move to Workers Paid at $5 a month only if a daily limit is actually hit? I'd say yes.
11. **Offline logging.** Is the offline queue needed for the first journal release, or can it follow? I'd let it follow.
12. **Photos and video.** Should originals be uploaded to R2 from your phone, or stay in your photo library with only chosen ones uploaded? I'd upload only chosen ones, to stay well inside free storage.

Added on 25 Nov, from the performance plan, the browser floor and Release 1:

- **N1. Static first.** No framework script on content pages, with widgets as small islands? I'd say yes, subject to the spike's numbers.
- **N2. Budgets.** Accept the proposed budget table as the starting targets? I'd say yes.
- **N3. Inlined CSS.** Inline the site's stylesheet while it stays under 10 KB compressed? I'd say yes if the spike shows a gain.
- **N4. Fonts.** System fonts only at launch? I'd say yes. A brand font can be added later against a measured cost.
- **N5. JPEG XL.** Offer it for large review photos if the spike shows it smaller than AVIF? I'd test it.
- **N6. Animation between pages.** Leave it out of Release 1? I'd say yes.
- **N7. Service worker on the public site.** None? I'd say none.
- **N8. Search on the public site.** None at launch, with on-demand search added once articles exist? I'd say yes.
- **N9. Browser floor.** Baseline Widely available, with newer features as extras only? I'd say yes. Answered on 25 Nov: yes for now, and revisit the floor once real traffic shows which browsers visitors use.
- **N10. Release 1.** Is the scope above right, with Saturday 28 Nov as the target?
- **N11. Going live.** Go live on Saturday with unchecked airlines marked as unchecked, or hold the finished site on a preview address until every airline is checked? I'd go live, because field data only starts with real visitors. It reverses your earlier gate, so it is your call.
- **N12. Public name and main domain.** "Carry Journal" on carryjournal.com? If mycarryjournal.com is also yours, should it redirect there?

## Sources

Read through web search on 25 Nov 2026. The director should open each page again before relying on a figure.

- [Solid 2.0.0 release, "The Long Hold"](https://github.com/solidjs/solid/releases/tag/solid-js%402.0.0), released 17 Nov 2026
- [Effect: migrating from v3 to v4](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md), for the list of unstable modules; [HttpApi API reference](https://effect.website/docs/v4/api/effect/http-api/HttpApi); [Effect blog](https://effect.website/blog), for the 4.0 stable date and 4.1.5
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits), [D1 SQL statements and extensions](https://developers.cloudflare.com/d1/sql-api/sql-statements/), [D1 free tier enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
- [Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/sase-zero-trust.md)
- [Cloudflare: build and deploy remote MCP servers](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/)
- [Carry Journal web app: architecture and build plan](architecture.md), for everything about the public site, including its own source list

Added for the performance plan and browser support, read through web search and page fetches on 25 Nov 2026:

- [MDN: Speculation Rules API](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API), [caniuse: speculation rules](https://caniuse.com/wf-speculation-rules), [WebKit bug 312221](https://bugs.webkit.org/show_bug.cgi?id=312221) and [Mozilla: intent to prototype](https://groups.google.com/a/mozilla.org/g/dev-platform/c/gBZYcVxrJN4)
- [caniuse: cross-document view transitions](https://caniuse.com/cross-document-view-transitions) and [Mozilla: launching Interop 2026](https://hacks.mozilla.org/2026/02/launching-interop-2026/)
- [Chrome: shipping JPEG XL](https://developer.chrome.com/blog/jpeg-xl-in-chrome), [Mozilla: intent to ship JPEG XL](https://groups.google.com/a/mozilla.org/g/dev-platform/c/3YMV4MS34KA) and [caniuse: JPEG XL](https://caniuse.com/jpeg-xl)
- [Cloudflare: shared dictionaries](https://developers.cloudflare.com/speed/optimization/content/shared-dictionaries/) and [the announcement](https://blog.cloudflare.com/shared-dictionaries)
- [Cloudflare: Early Hints on Pages](https://developers.cloudflare.com/pages/platform/early-hints) and [Speed Brain](https://blog.cloudflare.com/introducing-speed-brain/)
- [web.dev: Baseline digests for September 2025](https://web.dev/blog/baseline-digest-sep-2025), [March 2026](https://web.dev/blog/baseline-digest-mar-2026) and [July 2026](https://web.dev/blog/baseline-digest-jul-2026)
- [TanStack Start: deferred hydration for Solid](https://tanstack.com/start/latest/docs/framework/solid/guide/deferred-hydration)
- [Core Web Vitals checklist](https://www.corewebvitals.io/core-web-vitals/ultimate-checklist), for the first-round-trip figure and the case against inlining CSS

Not checked for the performance plan: whether Solid 2.0's start mode can leave the client entry off a page, the size of Solid 2.0's runtime, which compression Cloudflare applies to static assets, and how Indian networks are routed to Cloudflare. The spike measures each.

Not checked for this brief: R2's current free allowance and whether enabling it needs a payment card (already question 7 in the architecture doc), and how Claude's custom connectors authenticate to a remote MCP server today. The spike covers both.
