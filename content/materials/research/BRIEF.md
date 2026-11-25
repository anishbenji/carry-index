# Shared research brief: fabric reference pages for The Carry Index

## What this is for
The Carry Index is a hobby site that compares EDC and travel backpacks made from UHMWPE performance fabrics (Challenge ULTRA, ALUULA Graflyte). We're adding reference pages on bag fabrics, written by an enthusiast for other enthusiasts:
- a hub ("how to read a fabric")
- nylon
- polyester
- X-Pac and other laminates
- UHMWPE fabrics
- a comparison across classes
- a glossary

Your job is research only: collect facts with sources. Don't write page copy.

## Source material and how to treat it
`/home/claude/materials/src/` holds plain-text exports of three blog posts ("Deep-dive: Nylon / X-Pac / Ultra") by Reddit user u/strandedvariable on r/ManyBaggers, plus Ripstop by the Roll's Venom data sheet. The posts are a guide to topics and claims to check. They are NOT a source to cite for facts:
- Every fact needs its own primary or reputable source.
- Don't copy their wording.
- Treat every number in them as unverified until you find it in the maker's own data.

## Rules for every fact
1. **Source each fact.** Every figure and claim gets a source URL you actually opened in this session. Prefer, in order:
   - the maker's current data sheet or product page;
   - a standards body or test-equipment maker (ASTM abstract page, Taber Industries, James Heal…);
   - a retailer that publishes the maker's sheet (Ripstop by the Roll, Extremtextil, Rockywoods, Quest Outfitters);
   - reputable reviews or reporting.
   Forums and Reddit count only as owner experience, and must be labelled that way.
2. **Name the test method for every test number.** Write the standard (ASTM D2261 tongue tear, ASTM D1424 Elmendorf, ASTM D3884 Taber with wheel and load if given, ASTM D4966 Martindale, ASTM D4157 Wyzenbeek, AATCC 127 / ISO 811 / ASTM D751 hydrostatic head, ASTM D5034 grab tensile…) and the units. If the source doesn't say the method, write "method not stated".
3. **Label marketing claims and estimates** as such, e.g. "maker claim, no test method given".
4. **Check what's current (late October 2026).** Product lines change; note a page's date when you can see one. Don't rely on old lists.
5. **Use the maker's exact names and capitalisation**, e.g. Challenge writes "ULTRA", Dimension-Polyant writes "X-Pac", ALUULA writes "Graflyte".
6. **Never fill a gap from memory.** If you can't find or confirm something, say "not found" or "unconfirmed". A clearly marked gap is far more useful than a confident guess.
7. **Web tools:** use WebSearch and WebFetch only. Do NOT use Firecrawl tools; they cost the site owner money. Reddit is unreachable from here, so don't try. If an important page won't load, list it under "Unreachable" with its URL.
8. **Quotes:** at most one short quote (under 15 words) per source, in quotation marks. Otherwise paraphrase.
9. **Don't buy or sign up** for anything, including paywalled standards or trade logins. Note what's behind the wall.

## Output
Write ONE markdown file at the path your task gives you, with these sections:
- `## Findings`
  - Sub-headings that follow your scope list.
  - One fact per bullet, each ending with a source link: `[Source title](url)`.
  - Add the test method, units and date where they apply.
- `## Data table`
  - Every numeric spec you found, one row per fabric.
  - Columns: fabric | maker | construction | weight (g/m² and oz/yd² as published) | tear (value, units, method) | tensile (value, method) | abrasion (value, units, method) | waterproof/HH (value, units, method) | source URL | page date or "undated".
- `## Deep-dive claims checked`
  - Each claim from the posts in your area: CONFIRMED / WRONG / PARTLY / UNCONFIRMED, with the correct figure and source.
- `## In use`
  - Hand, sound, crinkle, ageing, how it takes abrasion, cleaning, repair, heat or UV limits, availability to home makers (MYOG).
  - Mark each item as maker guidance, a reviewer's observation, or an owner report.
- `## Open questions / unreachable`

Then reply with:
- a summary of at most 200 words;
- the 5 most surprising or important corrections.
