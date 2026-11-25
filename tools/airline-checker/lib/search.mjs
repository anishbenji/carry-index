/* Search fallback: when an airline's page can't be loaded or found again from its sitemap,
   ask a search engine for the airline's own baggage page, the way it's done by hand with a
   Google "site:" search.

   It only uses official search APIs, never scraping a results page: Google doesn't allow
   automated queries on google.com and answers them with a CAPTCHA, and the checker never works
   around those. Set up one of these (free tiers are enough for a few searches a day):
     - Google Programmable Search: GOOGLE_CSE_KEY + GOOGLE_CSE_CX
     - Brave Search API:          BRAVE_SEARCH_KEY
   as environment variables or in search.config.json next to check.mjs:
     { "googleKey": "...", "googleCx": "...", "braveKey": "..." }
   With no key, nothing is searched; repair-queue.md then lists a ready Google link per airline
   for a hand (or Claude-in-Chrome) search.

   Only results on the airline's own site are returned: a third-party guide is never a source. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'search.config.json'), 'utf8')); } catch {}
const KEYS = {
  googleKey: process.env.GOOGLE_CSE_KEY || cfg.googleKey,
  googleCx: process.env.GOOGLE_CSE_CX || cfg.googleCx,
  braveKey: process.env.BRAVE_SEARCH_KEY || cfg.braveKey,
};
export const searchConfigured = () => !!((KEYS.googleKey && KEYS.googleCx) || KEYS.braveKey);

// "www.flyedelweiss.com" -> "flyedelweiss.com"; keeps two-part suffixes like co.za, com.np
export function siteOf(url) {
  const h = new URL(url).hostname.replace(/^www\d?\./, '').split('.');
  const two = /^(co|com|net|org|gov|ac)$/.test(h.at(-2)) && h.at(-1).length === 2;
  return h.slice(two ? -3 : -2).join('.');
}
export const queryFor = (name, site) => `${site ? `site:${site} ` : ''}${name} carry-on cabin baggage size kg`;
export const googleLink = (name, site) => 'https://www.google.com/search?q=' + encodeURIComponent(queryFor(name, site));

async function google(q) {
  const u = `https://www.googleapis.com/customsearch/v1?key=${KEYS.googleKey}&cx=${KEYS.googleCx}&num=10&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Google search HTTP ${r.status}`);
  return ((await r.json()).items || []).map(i => i.link);
}
async function brave(q) {
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?count=10&q=${encodeURIComponent(q)}`,
    { headers: { 'X-Subscription-Token': KEYS.braveKey, accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Brave search HTTP ${r.status}`);
  return ((await r.json()).web?.results || []).map(i => i.url);
}

const BAGGAGE = /bag|luggage|equipaje|bagage|gep[aä]ck|carry|cabin|hand|faq|help|support|conditions|terms|allowance/i;

/* Returns up to 4 URLs on the airline's site, most promising first.
   If the site's domain is gone, also searches by name and accepts a host that contains a word
   of the airline's name (e.g. twayair.com -> trinityairways.com would NOT match; such renames
   still need a hand check, which the repair queue's Google link covers). */
export async function searchPages(name, oldUrl) {
  if (!searchConfigured()) return [];
  const site = siteOf(oldUrl);
  const run = q => (KEYS.googleKey && KEYS.googleCx ? google(q) : brave(q));
  const words = name.toLowerCase().normalize('NFKD').split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !/^(airlines?|airways|aviation)$/.test(w));
  const ok = (u, anyHost) => {
    try {
      const h = new URL(u).hostname;
      if (/\.pdf($|\?)/i.test(u)) return false;
      return h === site || h.endsWith('.' + site) || (anyHost && words.some(w => h.includes(w)));
    } catch { return false; }
  };
  let links = (await run(queryFor(name, site))).filter(u => ok(u, false));
  if (!links.length) links = (await run(queryFor(name, null))).filter(u => ok(u, true));
  links.sort((a, b) => BAGGAGE.test(new URL(b).pathname) - BAGGAGE.test(new URL(a).pathname));
  return [...new Set(links)].slice(0, 4);
}
