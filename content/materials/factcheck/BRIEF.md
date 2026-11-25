# Fact-check brief: The Carry Index fabric pages

You're an independent fact-checker. Your job is to find mistakes, not to approve the pages. Nobody involved has told you what they believe is correct. Check the pages against their sources and nothing else.

## Inputs
- Built pages: `/home/claude/materials/site/design/materials/v1/<page>.html`.
- Each page ends with a numbered source list (`<li id="src-N">`). Every claim cites those numbers with `<sup class="ref">`.
- Plain-text versions for easier reading: run
  `python3 /home/claude/materials/factcheck/totext.py <page.html>`.
  It prints the text with the [N] markers inline, followed by the numbered source list with URLs.

## What to check, for every page in your group
1. **Every number** (weights, tear, abrasion, waterproofing, prices, dates, percentages, counts):
   - Open the cited source(s) with WebFetch.
   - Confirm the number, its units and its context: the right fabric, the right direction (warp/fill), and the right test method where the page names one.
   - Recompute every conversion or calculation the page does (lb→N ×4.448, oz/yd²→g/m² ×33.906, percentages, ratios, "X times").
2. **Every factual claim** about a company, owner, date, history, product, construction, test method or bag:
   - Confirm the cited source actually says it.
   - Flag anything the source doesn't support, or supports only partly.
3. **Citation fit.** Flag a citation that points to the wrong source even when the claim is true.
4. **Unsourced factual claims.** Flag any factual statement with no citation that a reader could reasonably want sourced. Opinion clearly labelled as the writer's is fine.
5. **Tags.** Statements tagged "maker claim", "owner report", "reviewer", "retailer" or "my calculation": check that the label is right.
6. **Quotes.** Quoted text must match the source exactly.

## Rules
- **Web tools:** use WebFetch only. Don't use Firecrawl (it costs the site owner money) or curl.
  - Use WebSearch only if a cited URL is dead and you need to find where its content moved.
  - Fetch each source once and check every claim that cites it from that one read.
- **Unreachable sources:** if a page won't load (Reddit and some shops block fetching), mark it UNREACHABLE. Don't guess.
- **Don't edit the pages.** Report only.
- **Source currency:** the pages were written on 23 Oct 2026, and the sources were opened that day. If a source has changed since, say what it says now.

## Output
Write `/home/claude/materials/factcheck/<your-group>.md` with one section per page. Each section has a table:

| # | Section | Claim (short quote from the page) | Cited | Verdict | What the source actually says | Suggested fix |

Verdicts:
- **OK**: you checked it and it matches. You may summarise OK rows as a count instead of listing every one.
- **WRONG**: the source contradicts it.
- **PARTLY**: the source supports only part of it.
- **UNSUPPORTED**: the cited source doesn't say it.
- **MISCITED**: the claim is true, but the citation points to the wrong source.
- **UNSOURCED**: a factual claim with no citation.
- **ARITHMETIC**: a calculation or conversion is wrong.
- **UNREACHABLE**: the source wouldn't load.

List every non-OK row individually.

Then reply with:
- the counts of each verdict;
- the 10 most serious problems.
