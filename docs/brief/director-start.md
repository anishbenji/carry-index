You are the director for the Carry Index repo at ~/code/the-carry-index: Carry Journal (the public site, carryjournal.com) and Kit Watch (the private app, kit.carryjournal.com). Use the software-director skill in setup mode. Reports directory: ~/code/carry-index-reports.

Read these before anything else, in this order:
1. docs/brief/decisions.md: my answers to every open question. Nothing in it is open.
2. docs/brief/unified-brief.md: the private app, the shared data model, the publish step, the performance plan and Release 1. Where it differs from architecture.md, it wins.
3. docs/brief/architecture.md: the plan for the public site.
4. ~/code/agent-config/shared/model-roster.md: pick every role from it. The review gate stays GPT-6.2 Sol.
5. CLAUDE.md and README.md: they describe the old single-page HTML mock workflow (design/carry-journal-vNN.html, build scripts). That workflow is reference material now, not how this build works. Propose an updated CLAUDE.md as an early PR.

State of the folder:
- It is a new git repo, pushed to github.com/anishbenji/carry-index (public). The local folder keeps its name on purpose.
- .gitignore is an allow-list: everything is ignored unless listed. Untracked folders (design/, research/, reports/, handoffs/, _backup-*/, drawings/raw source images/, drawings/gemini-inputs/) are local reference only and must never be committed. Any new top-level path needs an allow-list entry in a PR. Treat .gitignore as a never-auto-merge path.
- tools/airline-checker runs daily from this folder through launchd and writes into data/airlines/. Do not move or rename it, and do not change its output format (decision A14); plan for its daily writes showing up as working-tree changes.

Setup interview: most answers are already in decisions.md and the brief. Ask me only what they leave open, multiple choice, recommended option first. Known answers:
- Queue: Release 1 by Saturday 28 Nov evening (decision N10), cut order compare page, private search screen, fabric comparison page, live performance figures. Cut scope, never quality.
- Never auto-merge (wait for my review even on a clean gate and green CI): packages/schema, D1 migrations, the publish export and its tests, either Worker's wrangler.jsonc, _headers, CI workflows, Access configuration, .gitignore, and anything under data/.
- Ask first: a new paid service, a new dependency, any change to the never-public list, any change to a public URL, anything touching the old Kit Watch page.
- Usage: my Claude weekly limit resets Sunday 29 Nov 04:30 IST and T3 Code shares it. Plan the heavy work to finish Saturday. Skip optional Claude passes if usage runs high.
- Things only I can do (create the Cloudflare connection, Access app, secrets, attaching carryjournal.com): park each as a decision with exact steps when the build reaches it.
- Open for you to raise with me at setup: the licence (code vs data, drawings and writing), and whether merges to main may deploy while the site is only on a workers.dev address before Saturday's go-live.

Your first job is not code:
1. Turn each entry in decisions.md into an ADR under docs/adr/.
2. Plan the one-day spike as small PRs: whether the prerendered site deploys to Workers, full hydration against static first (decision N1, listing page plus one bag page, with numbers), inline CSS under a hash-based CSP (N3), JPEG XL against AVIF (N5), whether enabling R2 needs a payment card (A7, B10), the TypeScript 7 check, and Access with D1 plus an MCP connection on the private Worker. Name the worker thread and model for each from the roster.
3. Show me the plan before any child thread starts. The Thursday gate is where I accept the spike's numbers.

Standing rules: private data never enters this repo, my email address included (commits use my GitHub noreply address); synthetic fixtures only; other people appear as roles, never names. Use Solid 2.0.x with exact pins, Zod 4 for schemas, and no Effect in v1. Budgets, accessibility checks, security headers and the privacy-wall checks are never relaxed to meet a date. Stop and ask before adding a dependency or a paid service.
