// node test/units.test.mjs: offline checks of which unit systems an airline prints (lib/units.mjs)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unitsFor, fromRecord, attach, summarize } from '../lib/units.mjs';
import { layoutOf, dump } from '../units.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const meta = { read: '2026-11-13', from: 'quote' };
const co = (text, d, l = null, kg = null) => unitsFor(text, { co: { d, l, kg }, pi: { no: true }, ckg: null }, meta).co;
const BOTH = ['metric', 'imperial'], M = ['metric'], I = ['imperial'];

// Copa (quote on file): '' marks, labels, linear inches, lbs, carry-on and personal item on one page
const copaQ = "1 Carry-on 22'' high x 14'' long x 10'' wide (56 cm high x 36 cm long x 26 cm wide) 1 Personal item 17'' high x 10'' long x 9'' wide (43 cm high x 25 cm long x 22 cm wide) ... up to 46 linear inches (118 cm) ... hand luggage weighing up to 10 Kg (22 lbs)";
const copa = unitsFor(copaQ, { co: { d: [56, 36, 26], l: 118, kg: 10 }, pi: { d: [43, 25, 22], l: 90, kg: null, no: false }, ckg: null }, meta);
assert.deepEqual(copa.co, { printed: { d: BOTH, l: BOTH, kg: BOTH }, d_in: [22, 14, 10], l_in: 46, lb: 22, converted: [], read: '2026-11-13', from: 'quote' });
assert.deepEqual(copa.pi.printed, { d: BOTH, l: null, kg: null });
assert.deepEqual(copa.pi.d_in, [17, 10, 9]);
assert.deepEqual([copa.pi.l_in, copa.pi.lb, copa.pi.converted], [35.4, null, ['l_in']]);   // 90 cm is not in the quote: ours
assert.equal(summarize(copa), 'both');

// Aer Lingus: "Height 55cm (21.5")" decimals, personal item later on the same page
const aerQ = 'Maximum weight: 10kg (22lb) Maximum Size; Height 55cm (21.5") Width 40cm (15.5") Depth 24cm (9.5") 1 x Small Personal Item ... Maximum Size; Height 40cm (15.5") Width 30cm (11.5") Depth 20cm (8")';
const aer = unitsFor(aerQ, { co: { d: [55, 40, 24], l: null, kg: 10 }, pi: { d: [40, 30, 20], l: null, kg: null, no: false }, ckg: null }, meta);
assert.deepEqual([aer.co.d_in, aer.co.lb, aer.co.printed.kg], [[21.5, 15.5, 9.5], 22, BOTH]);
assert.deepEqual([aer.pi.d_in, aer.pi.printed.d, aer.pi.converted], [[15.5, 11.5, 8], BOTH, []]);

// metric only (AJet): our inches and pounds, 1 decimal, marked converted
const ajet = co('one (1) cabin bag with dimensions and weight not exceeding 55x40x23 cm and 8 kg is also permitted', [55, 40, 23], null, 8);
assert.deepEqual(ajet.printed, { d: M, l: null, kg: M });
assert.deepEqual([ajet.d_in, ajet.lb, ajet.converted], [[21.7, 15.7, 9.1], 17.6, ['d_in', 'lb']]);

// imperial only: the metric on file is the converted one (Southwest ” and ×, Bahamasair ″ and lbs)
const sw = co('Size limit: 24” (length) × 16” (width) × 10” (height). Wheels, handles, and any attachments count', [61, 40.6, 25.4]);
assert.deepEqual([sw.printed.d, sw.d_in, sw.converted], [I, [24, 16, 10], ['d']]);
const bah = co('conforms to the under seat size – a maximum of 22″ x 14″ x 9″ and weight of 20 lbs.', [55.9, 35.6, 22.9], null, 9.1);
assert.deepEqual([bah.printed, bah.d_in, bah.lb, bah.converted], [{ d: I, l: null, kg: I }, [22, 14, 9], 20, ['d', 'kg']]);
// "21.5 inches" and "22 pounds"
const inch = co('Carry-on up to 21.5 inches x 15.5 inches x 9 inches and 22 pounds', [55, 40, 23], null, 10);
assert.deepEqual([inch.d_in, inch.lb, inch.converted], [[21.5, 15.5, 9], 22, ['d', 'kg']]);

// Frontier: personal item and carry-on on one page ("18in by 14in by 8in", "24in by 16in by 10in"), each finds its own
const frQ = 'One included with all fares. 18in by 14in by 8in and up to 35lb including handles, wheels and straps Carry-On Bag Add when you book for the best price! 24in by 16in by 10in and up to 35lb';
const fr = unitsFor(frQ, { co: { d: [61, 40.6, 25.4], l: null, kg: 15.9 }, pi: { d: [45.7, 35.6, 20.3], l: null, kg: null, no: false }, ckg: null }, meta);
assert.deepEqual([fr.co.d_in, fr.co.lb, fr.pi.d_in], [[24, 16, 10], 35, [18, 14, 8]]);
assert.equal(summarize(fr), 'imperial only');

// mismatched candidates: Hong Kong Airlines prints 15 kg / 33 lbs (checked) beside a 7 kg carry-on: no pounds taken
const hkQ = 'allowance : 15kg / 33lbs - Cabin baggage size allowance - 22" x 14" x 9" or 56cm x 36cm x 23cm (including wheels and handles) - Small item size allowance* - 16” x 12” x 6” or 40cm x 30cm x 15cm';
const hk = co(hkQ, [56, 36, 23], null, 7);
assert.deepEqual([hk.printed.d, hk.d_in, hk.printed.kg, hk.lb, hk.converted], [BOTH, [22, 14, 9], null, 15.4, ['lb']]);
// Air China: 8 kg (17 lb.) and 5 kg (11 lb.) for different cabins; Economy is 5 kg
const cn = co('2 pieces 8kg (17 lb.) Each carry-on must not be more than 55cm (22”) in length, 40cm (16”) in width and 20cm (8”) in height Business Class 2 pieces 8kg (17 lb.) Super-Economy Class 1 piece 5kg (11 lb.)', [55, 40, 20], null, 5);
assert.deepEqual([cn.d_in, cn.lb, cn.printed.kg], [[22, 16, 8], 11, BOTH]);
// two different inch sizes that would both pass the tolerance, neither beside the metric figure: nothing taken
const two = co('Bag A 22 x 14 x 9 in, bag B 22 x 14 x 10 in, for any bag up to 56 x 36 x 24 cm.', [56, 36, 24]);
assert.deepEqual([two.printed.d, two.converted], [M, ['d_in']]);
// Condor prints 3.9 in for 15 cm: does not correspond, so it is not taken
const cdr = unitsFor('Small bag dimensions 40 × 30 × 15 cm (15.7 x 11.8 x 3.9 in): allowed Carry-on baggage dimensions 55 × 40 × 23 cm (21.6 x 15.7 x 9.0 in)',
  { co: { d: [55, 40, 23] }, pi: { d: [40, 30, 15], no: false }, ckg: null }, meta);
assert.deepEqual([cdr.co.d_in, cdr.co.converted, cdr.pi.printed.d, cdr.pi.d_in], [[21.6, 15.7, 9], [], M, [15.7, 11.8, 5.9]]);

// linear inches (Delta), and United: prints both, but our 55.9 is converted from its 22 in, not its 56 cm
const dl = co('combined length + width + height of baggage must not exceed 45 linear inches (114 cm) Individual length, width and height measurements may not exceed 22” x 14” x 9” (56 cm x 35 cm x 23 cm)', [56, 35, 23], 114);
assert.deepEqual([dl.printed.l, dl.l_in, dl.d_in, dl.converted], [BOTH, 45, [22, 14, 9], []]);
const ua = co('so it must be 9 in x 14 in x 22 in (23 cm x 35 cm x 56 cm)', [55.9, 35.6, 22.9]);
assert.deepEqual([ua.printed.d, ua.d_in, ua.converted], [BOTH, [22, 14, 9], ['d']]);

// odd marks: &quot; from page source (Air New Zealand), comma decimals, a label glued to the number (Kenya Airways)
assert.deepEqual(co('Carry-on bags allowance A= 55cm x B= 40cm x C= 23cm (21&quot; x 16&quot; x 9&quot;) Size', [55, 40, 23]).d_in, [21, 16, 9]);
const de = co('Handgepäck 55 x 40 x 23 cm (21,5 x 15,5 x 9 in), max. 8 kg (17,6 lb)', [55, 40, 23], null, 8);
assert.deepEqual([de.d_in, de.lb, de.converted], [[21.5, 15.5, 9], 17.6, []]);
assert.deepEqual(co('2 piece (max L55xW25xH35cm each) + 1 Accessory', [55, 35, 25]).printed.d, M);

// when unsure, nothing: "seven kg (15 lb)" (Thai) is not imperial only; a block page; a different size
assert.deepEqual(co('Total weight of the carry-on baggage must not exceed seven kg (15 lb).', null, null, 7).printed.kg, null);
const block = fs.readFileSync(path.join(HERE, '..', 'reports', 'snapshots', 'aer-lingus', 'static.txt'), 'utf8');
const none = unitsFor(block, { co: { d: [55, 40, 24], l: null, kg: 10 }, pi: { d: [40, 30, 20], no: false }, ckg: null }, meta);
assert.equal(summarize(none), 'could not tell');
assert.deepEqual([none.co.d_in, none.co.lb, none.co.converted], [[21.7, 15.7, 9.4], 22, ['d_in', 'lb']]);
assert.deepEqual(co('Carry-on 56 x 45 x 25 cm (22 x 18 x 10 in)', [55, 40, 20]).printed.d, null);

// combined weight, "inf" and no personal item, verified-record helpers
const af = unitsFor('1 small bag (maximum total weight: 12 kg/26.4 lb.)', { co: { d: [55, 35, 25] }, pi: { no: true }, ckg: 12 }, meta);
assert.deepEqual([af.ckg.printed.kg, af.ckg.lb, af.pi], [BOTH, 26.4, null]);
assert.deepEqual(co('Standard item 23 x 40 x 55 cm/9 x 15.5 x 21.5 in', [55, 40, 23], null, 'inf').lb, null);
const rec = { carryOn: { dims_cm: [56, 36, 26], linear_cm: 118, weight_kg: 10 }, personal: { dims_cm: [43, 25, 22], linear_cm: 90, weight_kg: null, allowed: true }, combined_kg: null };
attach(rec, unitsFor(copaQ, fromRecord(rec), meta));
assert.deepEqual([rec.carryOn.units.d_in, rec.personal.units.d_in, 'combinedUnits' in rec], [[22, 14, 10], [17, 10, 9], false]);

// the backfill writes each verified file back in its own layout: re-dumping today's files changes no byte
const V = path.join(HERE, '..', '..', '..', 'data', 'airlines', 'verified');
for (const f of fs.readdirSync(V).filter(f => f.endsWith('.json'))) {
  const s = fs.readFileSync(path.join(V, f), 'utf8');
  assert.equal(dump(JSON.parse(s), layoutOf(s)), s, f);
}
console.log('units tests: all passed');
