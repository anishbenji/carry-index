// node test/extract.test.mjs  — offline checks of the number extraction
import assert from 'node:assert/strict';
import { extract, compare } from '../lib/extract.mjs';

const cases = [
  ['Cabin baggage: one bag up to 55 x 40 x 20 cm and 7 kg.', [[55, 40, 20]], [7]],
  ['Carry-on bags must not exceed 22" x 14" x 9" (56 x 36 x 23 cm).', [[55.9, 35.6, 22.9], [56, 36, 23]], []],
  ['Hand baggage 55cm x 40cm x 23cm, max 8kg; personal item 40 × 30 × 15 cm', [[55, 40, 23], [40, 30, 15]], [8]],
  ['carry-on: 24 x 16 x 10 inches, 35 lbs', [[61, 40.6, 25.4]], [15.9]],
  ['Bagage cabine 55 x 35 x 25 cm (poignées et roues comprises), 12 kg au total', [[55, 35, 25]], [12]],
];
// labelled sizes (Aer Lingus, IndiGo and other wordings)
const labelled = [
  ['Carry-on: Maximum weight: 10kg (22lb) Maximum Size; Height 55cm (21.5") Width 40cm (15.5") Depth 24cm (9.5") 1 x Small Personal Item', [55, 40, 24]],
  ['Cabin baggage: length -55cm + width- 35cm + height- 25cm, 7 kg', [55, 35, 25]],
  ['Hand baggage L 55 cm x W 40 cm x H 20 cm', [55, 40, 20]],
  ['Carry-on bag no more than 55 cm long, 40 cm wide and 20 cm deep', [55, 40, 20]],
  ['Carry-on: Length: 22 in, Width: 14 in, Height: 9 in', [55.9, 35.6, 22.9]],
  ['Size limitations Height: 55 cm / 21 in Length: 40 cm / 15 in Width: 20 cm / 7 in The total', [55, 40, 20]],
  ['carry-on bag A= 55cm x B= 40cm x C= 23cm (21" x 16" x 9")', [55, 40, 23]],
];
for (const [t, dims] of labelled) {
  const f = extract(t);
  assert.ok(f.triples.some(x => x.dims.join() === dims.join()), `labelled: ${t} -> ${JSON.stringify(f.triples.map(x => x.dims))}`);
}
assert.ok(extract('Hand baggage size must be within 55 cm + 35 cm + 25 cm (L+W+H; total 115 cm)').triples.some(x => x.dims.join() === '55,35,25'), 'plus-separated');
assert.ok(extract('Hand baggage of 7 (seven) kgs').kg.some(k => k.kg === 7), 'kg with spelled-out number');
// metric print of an inch limit matches (Allegiant prints 55 x 40 x 25 for 22 x 16 x 10 in)
assert.equal(compare({ n: 'A', co: { d: [55.9, 40.6, 25.4], kg: null }, pi: { no: true }, ckg: null }, extract('Carry-on bag 55 x 40 x 25 cm')).verdict, 'CONFIRMED');

for (const [t, dims, kg] of cases) {
  const f = extract(t);
  assert.ok(f.relevant, 'relevant: ' + t);
  assert.deepEqual(f.triples.map(x => x.dims), dims, t);
  assert.deepEqual(f.kg.map(x => x.kg), kg, t);
}

const air = { n: 'Test Air', co: { d: [55, 40, 20], l: null, kg: 7 }, pi: { d: [40, 30, 10], kg: 3, us: false, no: false }, ckg: null };
const page = extract('Cabin bag 55 x 40 x 20 cm up to 7 kg. Laptop bag 40 x 30 x 10 cm, 3 kg.');
assert.equal(compare(air, page).verdict, 'CONFIRMED');
const changed = extract('Cabin bag 55 x 40 x 23 cm up to 8 kg. Laptop bag 40 x 30 x 10 cm, 3 kg.');
const r = compare(air, changed);
assert.equal(r.verdict, 'CHANGED');
assert.deepEqual(r.missing, ['carry-on size 55×40×20', 'carry-on weight 7']);
const lin = { n: 'Lin', co: { d: null, l: 115, kg: 7 }, pi: { d: null, us: true, no: false }, ckg: null };
assert.equal(compare(lin, extract('Hand baggage: total dimensions 115 cm (L+W+H), 7 kg')).verdict, 'CONFIRMED');
console.log('extract tests: all passed');
