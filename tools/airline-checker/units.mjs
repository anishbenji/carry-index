#!/usr/bin/env node
/* Fill `units` from the airline's wording already on file (the `quote` field), without opening any page.

   node units.mjs            fill records that have a quote and no units yet, then rebuild airlines.json
   node units.mjs --dry      only report what it would fill
   node units.mjs --list     also print one line per airline
   node units.mjs --data <dir>   use another copy of data/airlines (for trying it out)

   Only the record that wins in build_airlines.py (the last verified file holding the airline) is changed.
   Records that already have units are left alone, and so are quotes that show nothing either way
   ("could not tell"), so running it again changes nothing. Figures are taken from airlines.json,
   the same as the daily check. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { unitsFor, attach, summarize } from './lib/units.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry'), LIST = args.includes('--list');
const DATA = args.includes('--data') ? path.resolve(args[args.indexOf('--data') + 1]) : path.resolve(HERE, '..', '..', 'data', 'airlines');
const VDIR = path.join(DATA, 'verified');
const today = new Date().toISOString().slice(0, 10);

// write a verified file back in the layout it came in (indent 1, or one record per line)
export const layoutOf = s => ({ lines: /^\[\n\{"/.test(s), nl: s.endsWith('\n') });
export const dump = (v, l) => (l.lines ? '[\n' + v.map(x => JSON.stringify(x)).join(',\n') + '\n]' : JSON.stringify(v, null, 1)) + (l.nl ? '\n' : '');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const byName = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DATA, 'airlines.json'), 'utf8')).map(a => [a.n, a]));
  const files = fs.readdirSync(VDIR).filter(f => f.endsWith('.json')).sort()
    .map(f => { const s = fs.readFileSync(path.join(VDIR, f), 'utf8'); return { f, layout: layoutOf(s), recs: JSON.parse(s), dirty: false }; });
  const winner = {};   // same order as build_airlines.py: later files win
  for (const F of files) F.recs.forEach((r, i) => { if (['verified', 'partial'].includes(r.status)) winner[r.name] = [F, i]; });

  const counts = { both: 0, 'metric only': 0, 'imperial only': 0, mixed: 0, 'could not tell': 0 };
  const skipped = { 'already has units': 0, 'no quote': 0, 'not in airlines.json': 0 };
  for (const [name, [F, i]] of Object.entries(winner).sort()) {
    const rec = F.recs[i], a = byName[name];
    if (!a) { skipped['not in airlines.json']++; continue; }
    if (rec.carryOn?.units || rec.personal?.units || rec.combinedUnits) { skipped['already has units']++; continue; }
    if (!rec.quote) { skipped['no quote']++; continue; }
    const u = unitsFor(rec.quote, a, { read: today, from: 'quote' }), kind = summarize(u);
    counts[kind]++;
    if (LIST) console.log(`${kind.padEnd(14)} ${name}  (${F.f})`);
    if (kind === 'could not tell') continue;
    attach(rec, u); F.dirty = true;
  }
  if (!DRY) for (const F of files) if (F.dirty) fs.writeFileSync(path.join(VDIR, F.f), dump(F.recs, F.layout));
  console.log(`${DRY ? 'would fill' : 'filled'}: ${counts.both} both, ${counts['metric only']} metric only, ${counts['imperial only']} imperial only, ${counts.mixed} mixed` +
    ` · ${counts['could not tell']} could not tell (left without units)`);
  console.log(`skipped: ${Object.entries(skipped).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  if (!DRY && files.some(F => F.dirty)) execFileSync('python3', [path.join(DATA, 'build_airlines.py')], { stdio: 'inherit' });
}
