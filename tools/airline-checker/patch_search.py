"""One-off: add the search fallback to check.mjs (run from tools/airline-checker)."""
import re
f = 'check.mjs'
s = open(f, encoding='utf-8').read()
assert 'searchPages' not in s, 'already patched'

def sub(old, new):
    global s
    assert s.count(old) == 1, ('not found once', old[:60])
    s = s.replace(old, new)

sub("import { extract, compare } from './lib/extract.mjs';",
    "import { extract, compare } from './lib/extract.mjs';\nimport { searchPages, searchConfigured, siteOf, googleLink } from './lib/search.mjs';")
sub("airline's sitemap, try a custom adapter",
    "airline's sitemap, then search for it (lib/search.mjs, official search APIs only, results on\n  the airline's own site only), try a custom adapter")
sub("const BACKOFF_DAYS = [1, 2, 4, 7];",
    "const BACKOFF_DAYS = [1, 2, 4, 7];\nconst MAX_SEARCHES = 20;   // per run; free search-API tiers allow ~100 a day\nlet searches = 0;")
sub("""  if (!res) for (const u of await rediscover(urls[0])) { res = await tryUrl(u, ['static', 'browser-open']); if (res) break; }
  return res || { verdict: 'FAILED', errors };""",
"""  if (!res) for (const u of await rediscover(urls[0])) { res = await tryUrl(u, ['static', 'browser-open']); if (res) break; }
  // last resort, as done by hand: search for the airline's own page. Not for sites that block
  // automated visits (a found page on the same site would be refused too).
  const isBlocked = errors.some(e => /blocked automated|refused the connection|HTTP (401|403|406|429)\\b/.test(e));
  if (!res && !isBlocked && searchConfigured() && searches < MAX_SEARCHES) {
    searches++;
    try {
      for (const u of await searchPages(a.n, urls[0])) {
        if (urls.includes(u)) continue;
        res = await tryUrl(u, ['static', 'browser-open']);
        if (res) { res.via = 'search'; break; }
      }
    } catch (e) { errors.push(`search: ${e.message.slice(0, 120)}`); }
  }
  return res || { verdict: 'FAILED', errors };""")
sub("""  log.push(`${r.verdict.padEnd(9)} ${a.n}${""",
    """  log.push(`${r.verdict.padEnd(9)} ${a.n}${r.via ? ` (page found by search: ${r.url})` : ''}${""")
sub("""  const row = ([n, s]) => `- **${n}** (\\`${slug(n)}\\`), ${s.fails} failed day${s.fails > 1 ? 's' : ''}${s.repair ? ', retries stopped' : `, next try ${s.nextRetry}`}: ${s.lastError}`;""",
    """  const gl = n => { try { return ` · [Google](${googleLink(n, siteOf(byName[n].src))})`; } catch { return ''; } };
  const row = ([n, s]) => `- **${n}** (\\`${slug(n)}\\`), ${s.fails} failed day${s.fails > 1 ? 's' : ''}${s.repair ? ', retries stopped' : `, next try ${s.nextRetry}`}: ${s.lastError}${gl(n)}`;""")
sub("A success clears the airline from this list.\\n` +",
    "A success clears the airline from this list.\\nEach row links a Google search for the airline's own page (use it by hand or ask Claude to, in Chrome); only the airline's own pages count as sources.${searchConfigured() ? '' : '\\nAutomatic search is off: add a search API key to search.config.json (see lib/search.mjs).'}\\n` +")
open(f, 'w', encoding='utf-8').write(s)
print('patched')
