#!/usr/bin/env node
/* Review and apply airline limit changes the checker found.

   node apply.mjs                         list pending changes with the page text around them
   node apply.mjs accept "IndiGo" co=55x35x25 cokg=7 pi=40x30x10 pikg=3
       keys: co, pi  (LxWxD in cm, any order: stored largest first)
             col, pil (linear cm)   cokg, pikg, ckg (kg)   pius=1 (under seat only)   pino=1 (none allowed)
             note="fare note"   src=<page url>   quote="exact words from the page"
       Writes a verified record (checked today) to data/airlines/verified/zz-manual.json, with the
       units the quote shows (lib/units.mjs; anything it does not show is marked converted),
       removes the airline from pending, and rebuilds airlines.json.
   node apply.mjs dismiss "IndiGo"       the page is fine, the checker misread it (re-checked next month)
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '..', '..', 'data', 'airlines');
const PF = path.join(HERE, 'reports', 'pending.json');
const MF = path.join(DATA, 'verified', 'zz-manual.json');
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const pending = readJ(PF, []);
const [cmd, name, ...kv] = process.argv.slice(2);

if (!cmd) {
  if (!pending.length) { console.log('No pending changes.'); process.exit(0); }
  for (const p of pending) {
    console.log(`\n■ ${p.name}  (${p.date})  ${p.url}\n  missing now: ${p.missing.join('; ')}\n  sizes on page: ${p.foundTriples.map(t => t.join('×')).join('  ') || '—'}\n  kg on page: ${p.foundKg.join(', ') || '—'}   linear: ${(p.foundLinear || []).join(', ') || '—'}\n  text: …${p.context}…`);
  }
  process.exit(0);
}
const i = pending.findIndex(p => p.name === name);
if (cmd === 'dismiss') {
  if (i < 0) throw new Error(`${name} is not pending`);
  pending.splice(i, 1); fs.writeFileSync(PF, JSON.stringify(pending, null, 1)); console.log('dismissed', name); process.exit(0);
}
if (cmd !== 'accept') throw new Error('usage: node apply.mjs [accept|dismiss] "<airline>" ...');

const air = readJ(path.join(DATA, 'airlines.json'), []).find(a => a.n === name);
if (!air) throw new Error(`${name} is not in airlines.json`);
const o = Object.fromEntries(kv.map(s => { const j = s.indexOf('='); return [s.slice(0, j), s.slice(j + 1)]; }));
const dims = s => s ? s.toLowerCase().split('x').map(Number).sort((a, b) => b - a) : null;
const n = s => s == null || s === '' ? null : Number(s);
const rec = {
  name, region: air.r,
  carryOn: { dims_cm: 'co' in o ? dims(o.co) : air.co.d, linear_cm: 'col' in o ? n(o.col) : air.co.l, weight_kg: 'cokg' in o ? n(o.cokg) : air.co.kg },
  personal: { dims_cm: 'pi' in o ? dims(o.pi) : air.pi.d, linear_cm: 'pil' in o ? n(o.pil) : air.pi.l, weight_kg: 'pikg' in o ? n(o.pikg) : air.pi.kg,
              underSeatOnly: 'pius' in o ? o.pius === '1' : air.pi.us, allowed: 'pino' in o ? o.pino !== '1' : !air.pi.no },
  combined_kg: 'ckg' in o ? n(o.ckg) : air.ckg,
  fareNote: o.note ?? air.note ?? '', source: o.src || (i >= 0 && pending[i].url) || air.src, quote: o.quote ?? (i >= 0 ? pending[i].context : ''),
  checked: new Date().toISOString().slice(0, 10), status: 'verified', by: 'manual (apply.mjs)'
};
// units: what the stored page text shows; anything it does not show is marked as our conversion
try { const { unitsFor, fromRecord, attach } = await import('./lib/units.mjs'); attach(rec, unitsFor(rec.quote, fromRecord(rec), { read: rec.checked, from: 'quote' })); }
catch (e) { console.error('units not read:', e.message); }
const man = readJ(MF, []); const j = man.findIndex(x => x.name === name); if (j >= 0) man[j] = rec; else man.push(rec);
fs.writeFileSync(MF, JSON.stringify(man, null, 1));
if (i >= 0) { pending.splice(i, 1); fs.writeFileSync(PF, JSON.stringify(pending, null, 1)); }
execFileSync('python3', [path.join(DATA, 'build_airlines.py')], { stdio: 'inherit' });
console.log('accepted', name, JSON.stringify(rec.carryOn), JSON.stringify(rec.personal), 'combined', rec.combined_kg);
