#!/usr/bin/env node
/* Airline cabin-baggage checker for The Carry Index.  No AI, no tokens: Playwright + regex.

   Each day it checks ~1/30 of the airlines (oldest check first), so every airline is
   re-checked about once a month, plus any airline whose retry is due.

   For every airline it:
     1. loads the policy page with the method that last worked (static fetch -> headless
        browser -> browser with accordions opened -> mobile browser), escalating on failure;
     2. finds the dimension triples (55 x 40 x 20 cm / 22 x 14 x 9 in) and kg figures;
     3. compares them with data/airlines/airlines.json:
          all current figures present  -> CONFIRMED  (seed figures become "checked" too)
          figures missing, others found -> CHANGED   (written to reports/pending.json for approval)
          nothing usable                -> FAILED    (auto-repair, retry with back-off)
   Auto-repair: escalate the load method, follow the redirect, rediscover the page from the
   airline's sitemap, then search for it (lib/search.mjs, official search APIs only, results on
  the airline's own site only), try a custom adapter in adapters/<slug>.mjs. After 3 failed days the
   airline goes to reports/repair-queue.md for a hand-written adapter.

   Usage:  node check.mjs              daily batch (what launchd runs)
           node check.mjs --all        every airline now
           node check.mjs --only "IndiGo" [--only "Qantas"]
           node check.mjs --dry        don't write anything
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extract, compare } from './lib/extract.mjs';
import { searchPages, searchConfigured, siteOf, googleLink } from './lib/search.mjs';

// loaded on its own, so a fault in the units code can never stop a check (see lib/units.mjs)
const units = await import('./lib/units.mjs').catch(e => { console.error('units code not loaded:', e.message); return null; });
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DATA = path.join(ROOT, 'data', 'airlines');
const STATE_F = path.join(HERE, 'state', 'state.json');
const OUT_F = path.join(DATA, 'verified', 'zz-checker.json');   // sorts last, so it wins in build_airlines.py
const REP = path.join(HERE, 'reports');
const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);
const DRY = args.includes('--dry'), ALL = args.includes('--all');
const ONLY = args.flatMap((a, i) => a === '--only' ? [args[i + 1]] : []);
const REDO = args.includes('--redo') || args.includes('--redo-all');   // re-check every failing, repair-queued or pending airline now
const MODES = ['static', 'browser', 'browser-open', 'mobile'];
const BACKOFF_DAYS = [1, 2, 4, 7];
const MAX_SEARCHES = 20;   // per run; free search-API tiers allow ~100 a day
let searches = 0;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJ = (f, v) => { if (DRY) return; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 1)); };
const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;
const addDays = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const addDaysFrom = (d, n) => new Date(new Date(d).getTime() + n * 864e5).toISOString().slice(0, 10);

const airlines = readJ(path.join(DATA, 'airlines.json'), []);
const state = readJ(STATE_F, { lastRun: null, airlines: {} });
const out = readJ(OUT_F, []);
const pendingF = path.join(REP, 'pending.json');
const pending = readJ(pendingF, []);

if (!ALL && !REDO && !ONLY.length && state.lastRun === today && !args.includes('--force')) {
  console.log('already ran today'); process.exit(0);
}

/* ---------- pick today's batch ---------- */
function due() {
  if (ONLY.length) return airlines.filter(a => ONLY.includes(a.n));
  if (ALL) return airlines;
  if (REDO) { const p = new Set(pending.map(x => x.name));
    // blocked sites, PDFs and dead domains are left alone: a re-run can't change those (--redo-all includes them)
    const skip = args.includes('--redo-all') ? [] : ['blocked', 'pdf', 'gone'];
    return airlines.filter(a => { const s = state.airlines[a.n] || {}; return (s.fails || s.repair || p.has(a.n)) && !skip.includes(s.kind); }); }
  const per = Math.ceil(airlines.length / 30);
  const st = n => state.airlines[n] || {};
  const retries = airlines.filter(a => st(a.n).nextRetry && st(a.n).nextRetry <= today && !st(a.n).repair);
  const fresh = airlines.filter(a => !st(a.n).nextRetry && !st(a.n).repair)
    .sort((x, y) => (st(x.n).last || '0000').localeCompare(st(y.n).last || '0000'))
    .filter(a => !st(a.n).last || days(st(a.n).last, today) >= 30 - 1)
    .slice(0, per);
  return [...new Map([...retries, ...fresh].map(a => [a.n, a])).values()];
}

/* ---------- loading ---------- */
let browser, snap = null;
// Bot-check and error pages, recognised by title or by a short page that says so. These sites don't
// want automated visits: the checker records them as blocked and moves on (they need a manual check).
const BLOCK = /access denied|attention required|just a moment|verify (that )?you are (a )?human|are you a robot|captcha|request unsuccessful|pardon our interruption|unusual traffic|bot (detection|protection)|^forbidden|403 forbidden|error 1020/i;
function blocked(title, text) {
  if (BLOCK.test(title || '') || (text.length < 2500 && BLOCK.test(text))) return `blocked automated access ("${(title || text.slice(0, 60)).trim().slice(0, 60)}")`;
  return null;
}
async function getBrowser() {
  if (!browser) { const { chromium } = await import('playwright'); browser = await chromium.launch(); }
  return browser;
}
async function load(url, mode) {
  if (mode === 'static') {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    snap = { mode, url: r.url, title: '', text: '', shot: null };
    if (/pdf/i.test(r.headers.get('content-type') || '')) throw new Error("source is a PDF; the checker can't read PDFs yet");
    const html = await r.text();
    const title = ((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '').trim();
    snap.title = title; snap.text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 800);
    if (!r.ok) throw new Error(`HTTP ${r.status}` + (blocked(title, snap.text) ? ', ' + blocked(title, snap.text) : ''));
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ').replace(/&times;|&#215;/g, '×').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    const b = blocked(title, text); if (b) throw new Error(b);
    return { text, finalUrl: r.url, status: r.status, title };
  }
  const b = await getBrowser();
  const ctx = await b.newContext(mode === 'mobile'
    ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 844 }, locale: 'en-GB' }
    : { userAgent: UA, viewport: { width: 1366, height: 900 }, locale: 'en-GB' });
  const page = await ctx.newPage();
  snap = { mode, url, title: '', text: '', shot: null };
  const capture = async () => { try { snap.url = page.url(); snap.title = await page.title();
    snap.text = (await page.evaluate(() => document.body ? document.body.innerText : '')).replace(/\s+/g, ' ').slice(0, 800);
    snap.shot = await page.screenshot({ type: 'jpeg', quality: 55 }); } catch {} };
  try {
    let resp;
    try { resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
    catch (e) {
      if (/Download is starting/.test(e.message)) throw new Error("source is a PDF or download; the checker can't read PDFs yet");
      if (/ERR_HTTP2_PROTOCOL_ERROR|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE/.test(e.message)) throw new Error(`site refused the connection (${e.message.match(/ERR_\w+/)[0]}), usually a block on automated visits`);
      if (/ERR_NAME_NOT_RESOLVED/.test(e.message)) throw new Error('domain does not resolve (site gone or moved)');
      throw e;
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // cookie banners: take the privacy-preserving choice, never "accept all"
    for (const re of [/reject all|decline|only (strictly )?necessary|necessary only|essential only|refuse/i, /^(close|dismiss)$/i]) {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible().catch(() => false)) { await btn.click({ timeout: 3000 }).catch(() => {}); break; }
    }
    if (mode !== 'browser') {   // open accordions / tabs that hide the numbers
      const toggles = page.locator('[aria-expanded="false"]');
      const n = Math.min(await toggles.count(), 40);
      for (let i = 0; i < n; i++) await toggles.nth(i).click({ timeout: 1500 }).catch(() => {});
      for (let y = 0; y < 6; y++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(300); }
    }
    await page.waitForTimeout(1500);
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    await capture();
    const b = blocked(snap.title, text); if (b) throw new Error(b);
    if (resp && resp.status() >= 400) throw new Error(`HTTP ${resp.status()}`);
    return { text, finalUrl: page.url(), status: resp ? resp.status() : 0, title: snap.title };
  } catch (e) { if (!snap.shot) await capture(); throw e; }
  finally { await ctx.close(); }
}

/* ---------- auto-repair: find the page again ---------- */
async function rediscover(url) {
  const origin = new URL(url).origin, found = [];
  for (const sm of ['/sitemap.xml', '/sitemap_index.xml', '/en/sitemap.xml']) {
    try {
      const r = await fetch(origin + sm, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) continue;
      const xml = await r.text();
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
      for (const l of locs.filter(l => /\.xml$/.test(l)).slice(0, 15)) {   // nested sitemaps
        try { const x = await (await fetch(l, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) })).text();
              locs.push(...[...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())); } catch {}
      }
      found.push(...locs.filter(l => /(cabin|carry|hand)[-_]?(on|baggage|luggage|bag)|handgepaeck|bagage-cabine|equipaje-de-mano/i.test(l)));
      if (found.length) break;
    } catch {}
  }
  const en = found.filter(l => /\/en[-_/]|\/en$|english/i.test(l));
  return [...new Set([...en, ...found])].slice(0, 5);
}

/* ---------- failure snapshots: what the site actually served ---------- */
const SNAPS = path.join(REP, 'snapshots');
function saveSnap(a, mode, why) {
  if (DRY || !snap) return;
  const d = path.join(SNAPS, slug(a.n)); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, `${mode}.txt`), `${today}  ${a.n}  [${mode}]\nwhy: ${why}\nurl: ${snap.url}\ntitle: ${snap.title}\n\n${snap.text}\n`);
  if (snap.shot) fs.writeFileSync(path.join(d, `${mode}.jpg`), snap.shot);
}
function clearSnaps(a) { if (!DRY) fs.rmSync(path.join(SNAPS, slug(a.n)), { recursive: true, force: true }); }

/* ---------- one airline ---------- */
async function checkOne(a) {
  const st = state.airlines[a.n] ||= {};
  // the data's source wins when it was set later (e.g. a manual check found the page's new address)
  const urls = [...new Set([a.v && (!st.ok || a.v > st.ok) ? a.src : (st.url || a.src), a.src, st.url].filter(Boolean))];
  const startMode = Math.max(0, MODES.indexOf(st.mode || 'static'));
  const custom = path.join(HERE, 'adapters', slug(a.n) + '.mjs');
  const errors = [];
  const tryUrl = async (url, modes) => {
    for (const mode of modes) {
      try {
        const page = fs.existsSync(custom)
          ? await (await import(pathToFileURL(custom).href)).default({ url, mode, load, getBrowser })
          : await load(url, mode);
        const found = extract(page.text);
        if (!found.relevant) { errors.push(`${mode}: page has no cabin-baggage text (title "${(page.title || '').slice(0, 50)}")`); saveSnap(a, mode, errors.at(-1)); continue; }
        if (!found.triples.length && !found.linear.length) { errors.push(`${mode}: no sizes found on page`); saveSnap(a, mode, errors.at(-1)); continue; }
        const res = { ...compare(a, found), url: page.finalUrl || url, mode };
        if (res.verdict === 'CONFIRMED') {   // which units the airline prints; a problem here never fails the check
          try { res.units = units.unitsFor(page.text, a, { read: today, from: 'page' }); }
          catch (e) { res.unitsError = e.message.split('\n')[0].slice(0, 140); }
        }
        return res;
      } catch (e) { errors.push(`${mode}: ${e.message.split('\n')[0].slice(0, 140)}`); saveSnap(a, mode, errors.at(-1)); }
      if (/PDF|does not resolve|blocked automated|refused the connection/.test(errors.at(-1) || '')) break;   // other modes won't help
    }
    return null;
  };
  let res = await tryUrl(urls[0], MODES.slice(startMode));
  if (!res && startMode > 0) res = await tryUrl(urls[0], MODES.slice(0, startMode));
  for (const u of urls.slice(1)) { if (res) break; res = await tryUrl(u, MODES); }
  if (!res) for (const u of await rediscover(urls[0])) { res = await tryUrl(u, ['static', 'browser-open']); if (res) break; }
  // last resort, as done by hand: search for the airline's own page. Not for sites that block
  // automated visits (a found page on the same site would be refused too).
  const isBlocked = errors.some(e => /blocked automated|refused the connection|HTTP (401|403|406|429)\b/.test(e));
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
  return res || { verdict: 'FAILED', errors };
}

/* ---------- run ---------- */
const batch = due();
console.log(`${today}: checking ${batch.length} of ${airlines.length} airlines`);
const log = [];
for (const a of batch) {
  const st = state.airlines[a.n] ||= {};
  const r = await checkOne(a);
  st.last = today;
  if (r.verdict === 'FAILED') {
    st.fails = (st.fails || 0) + 1;
    st.lastError = [...new Set(r.errors.map(e => e.replace(/^[\w-]+: /, '')))].slice(0, 4).join(' | ');
    st.kind = /blocked automated|refused the connection|HTTP (401|403|406|429)\b/.test(st.lastError) ? 'blocked' : /PDF/.test(st.lastError) ? 'pdf'
      : /does not resolve/.test(st.lastError) ? 'gone' : /HTTP 404|HTTP 410/.test(st.lastError) ? 'moved'
      : /no sizes found/.test(st.lastError) ? 'unread' : 'other';
    if (st.fails >= 3 || ['blocked', 'pdf', 'gone'].includes(st.kind)) { st.repair = true; delete st.nextRetry; }   // retrying won't help these
    else st.nextRetry = addDays(BACKOFF_DAYS[st.fails - 1]);
  } else {
    Object.assign(st, { fails: 0, ok: today, mode: r.mode, url: r.url }); delete st.nextRetry; delete st.repair; delete st.lastError; delete st.kind;
    clearSnaps(a);
  }
  if (r.verdict === 'CONFIRMED') {
    const rec = { name: a.n, region: a.r, carryOn: { dims_cm: a.co.d, linear_cm: a.co.l, weight_kg: a.co.kg },
      personal: { dims_cm: a.pi.d, linear_cm: a.pi.l, weight_kg: a.pi.kg, underSeatOnly: a.pi.us, allowed: !a.pi.no },
      combined_kg: a.ckg, fareNote: a.note || '', source: r.url, quote: r.quote, checked: today, status: 'verified',
      by: 'airline-checker' };
    const prev = out.find(x => x.name === a.n);
    if (r.units) try { units.attach(rec, r.units); } catch (e) { console.error(`units not stored for ${a.n}:`, e.message); }
    else if (prev) {   // units could not be read this time: keep the last reading (build_airlines.py drops it if it no longer fits)
      for (const k of ['carryOn', 'personal']) if (prev[k]?.units) rec[k].units = prev[k].units;
      if (prev.combinedUnits) rec.combinedUnits = prev.combinedUnits;
    }
    const i = out.findIndex(x => x.name === a.n); if (i >= 0) out[i] = rec; else out.push(rec);
    const j = pending.findIndex(p => p.name === a.n); if (j >= 0) pending.splice(j, 1);   // a fixed misread clears itself
  }
  if (r.verdict === 'CHANGED') {
    const i = pending.findIndex(p => p.name === a.n);
    const p = { name: a.n, date: today, url: r.url, missing: r.missing, foundTriples: r.triples, foundKg: r.kg, foundLinear: r.linear, context: r.quote };
    if (i >= 0) pending[i] = p; else pending.push(p);
  }
  log.push(`${r.verdict.padEnd(9)} ${a.n}${r.via ? ` (page found by search: ${r.url})` : ''}${r.verdict === 'FAILED' ? '  ' + st.lastError : r.verdict === 'CHANGED' ? '  missing: ' + r.missing.join(', ') : ''}${r.unitsError ? '  (units not read: ' + r.unitsError + ')' : ''}`);
  console.log(log.at(-1));
}
if (browser) await browser.close();
state.lastRun = today;
writeJ(STATE_F, state);
writeJ(OUT_F, out);
writeJ(pendingF, pending);

/* ---------- reports + notification ---------- */
const repair = Object.entries(state.airlines).filter(([, s]) => s.repair);
if (!DRY) {
  fs.mkdirSync(REP, { recursive: true });
  fs.appendFileSync(path.join(REP, `run-${today.slice(0, 7)}.log`), `\n## ${today}\n${log.join('\n')}\n`);
  const byName = Object.fromEntries(airlines.map(a => [a.n, a]));
  // airlines that block automated visits are checked by hand: once a hand check is newer than the failure, they move to the manual list
  const handChecked = n => byName[n]?.v && byName[n].v >= (state.airlines[n]?.last || '');
  const failing = Object.entries(state.airlines).filter(([n, s]) => s.fails && byName[n] && !(s.kind === 'blocked' && handChecked(n)));
  const manual = Object.entries(state.airlines).filter(([n, s]) => s.kind === 'blocked' && byName[n] && handChecked(n))
    .map(([n]) => [n, byName[n].v, addDaysFrom(byName[n].v, 30)]).sort((x, y) => x[2].localeCompare(y[2]));
  const manualDue = manual.filter(m => m[2] <= today);
  const GROUPS = [
    ['blocked', 'Blocks automated visits: check by hand', 'These sites refuse automated checks, so the checker leaves them alone. Check the page yourself (or ask Claude to) and record it with `node apply.mjs accept`.'],
    ['unread', 'Sizes on the page are not recognised: needs an adapter or a pattern', 'The page loaded but the sizes are written in a way lib/extract.mjs does not read. See the snapshot, then add a pattern or write adapters/<slug>.mjs.'],
    ['moved', 'Page not found (404): the policy moved', 'Find the new baggage page on the airline\'s site and update its URL in the seed or verified data.'],
    ['pdf', 'Policy is a PDF', 'The checker cannot read PDFs yet. Check by hand, or find an HTML page for the policy.'],
    ['gone', 'Domain no longer resolves', 'The airline may have stopped flying or moved its site. Confirm, then update or remove it in the seed.'],
    ['other', 'Other failures', 'See the snapshot and error.'],
  ];
  const gl = n => { try { return ` · [Google](${googleLink(n, siteOf(byName[n].src))})`; } catch { return ''; } };
  const row = ([n, s]) => `- **${n}** (\`${slug(n)}\`), ${s.fails} failed day${s.fails > 1 ? 's' : ''}${s.repair ? ', retries stopped' : `, next try ${s.nextRetry}`}: ${s.lastError}${gl(n)}`;
  fs.writeFileSync(path.join(REP, 'repair-queue.md'), `# Airlines the checker could not confirm\n\nUpdated ${today}. ${failing.length} airlines. Snapshots of what each site served: reports/snapshots/<slug>/.\nAfter a fix, \`node check.mjs --only "<name>"\` (or \`--redo\` for all of them). A success clears the airline from this list.\nEach row links a Google search for the airline's own page (use it by hand or ask Claude to, in Chrome); only the airline's own pages count as sources.${searchConfigured() ? '' : '\nAutomatic search is off: add a search API key to search.config.json (see lib/search.mjs).'}\n` +
    GROUPS.map(([k, h, d]) => { const r = failing.filter(([, s]) => (s.kind || 'other') === k); return r.length ? `\n## ${h} (${r.length})\n\n${d}\n\n${r.map(row).join('\n')}\n` : ''; }).join('') +
    (manual.length ? `\n## Checked by hand, because they block automated visits (${manual.length}; ${manualDue.length} due)\n\nThe checker leaves these alone. Re-check each by hand about monthly (or ask Claude to, in Chrome), then record it with \`node apply.mjs accept\`.\n\n` +
      manual.map(([n, v, due]) => `- ${due <= today ? '**DUE** ' : ''}${n}: checked ${v}, next ${due}`).join('\n') + '\n' : ''));
  if (batch.length) {   // refresh airlines.json so the next page build picks up confirmations
    const { execFileSync } = await import('node:child_process');
    try { execFileSync('python3', [path.join(DATA, 'build_airlines.py')], { stdio: 'inherit' }); } catch (e) { console.error('build_airlines.py failed:', e.message); }
  }
  const changed = log.filter(l => l.startsWith('CHANGED')).length, failed = log.filter(l => l.startsWith('FAILED')).length;
  if ((changed || failing.length || manualDue.length) && process.platform === 'darwin') {
    const msg = [changed && `${changed} limit change(s) to review`, failing.length && `${failing.length} airline(s) need a fix`, manualDue.length && `${manualDue.length} due for a hand check`].filter(Boolean).join(' · ');
    const { execFileSync } = await import('node:child_process');
    try { execFileSync('osascript', ['-e', `display notification "${msg}" with title "Carry Index: airline checker"`]); } catch {}
  }
  console.log(`done: ${log.length} checked, ${failed} failed, ${pending.length} pending changes, ${repair.length} in repair queue`);
}
