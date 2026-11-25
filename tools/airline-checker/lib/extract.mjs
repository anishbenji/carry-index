/* Pull baggage numbers out of page text, and compare them with what the index holds. */

const N = String.raw`(\d{1,3}(?:[.,]\d{1,2})?)`;
const U = String.raw`(?:\s*(?:cm|centimet(?:er|re)s?|in(?:ch(?:es)?)?\b|"|”|″|''))?`;
const SEP = String.raw`${U}\s*(?:\([^)]{0,14}\))?\s*[x×X✕*+]\s*`;   // "55 x 40 x 20" and "55 cm + 35 cm + 25 cm" (SpiceJet)
const TRIPLE = new RegExp(`${N}${SEP}${N}${SEP}${N}\\s*(cm|centimet\\w*|in\\b|inch\\w*|"|”|″|'')?`, 'g');
const KG = /(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:\([a-z -]{2,15}\)\s*)?(kgs?|kilo\w*|lbs?|pounds)\b/gi;   // also "7 (seven) kgs" (Akasa)
const LINEAR = /(\d{2,3}(?:[.,]\d)?)\s*(cm|in(?:ches)?|")[^.]{0,60}?(linear|total|sum|combined|l\s*\+\s*w\s*\+\s*[dh])|(linear|total|sum of)[^.]{0,40}?(\d{2,3}(?:[.,]\d)?)\s*(cm|in(?:ches)?|")/gi;
const RELEVANT = /cabin (bag|baggage|luggage)|carry[- ]?on|hand (baggage|luggage)|personal item|under the seat|bagage cabine|handgep[aä]ck|equipaje de mano|cabin allowance/i;

/* Sizes written as three labelled parts, in either order of label and number:
     "Height 55cm (21.5") Width 40cm (15.5") Depth 24cm"      (Aer Lingus)
     "length -55cm + width- 35cm + height- 25cm"              (IndiGo)
     "L 55 cm x W 40 cm x H 20 cm" · "55 cm long, 40 cm wide and 20 cm deep" */
const LBL = String.raw`(?:height|length|width|depth|breadth|thickness|high|long|wide|deep|thick|[hlwdabc](?![a-z]))`;   // A= B= C= (Air New Zealand)
const UNIT = String.raw`(cm|centimet\w*|in(?:ch(?:es)?)?\b|"|”|″)?`;
const PAREN = String.raw`(?:\s*\([^)]{0,18}\)|\s*\/\s*\d{1,3}(?:[.,]\d{1,2})?\s*(?:in(?:ch(?:es)?)?\b|"|”))?`;   // "(21.5\")" or "/ 21 in" (Air India)
const PART_LN = String.raw`${LBL}\s*${PAREN}\s*[:\-–=]?\s*${N}\s*${UNIT}${PAREN}`;          // label, then number
const PART_NL = String.raw`${N}\s*${UNIT}\s*${PAREN}\s*(?:in\s+)?${LBL}`;                  // number, then label
const GAP = String.raw`(?:\s|[,;+&x×✕*/|:]|\band\b|\bby\b|\bmax(?:imum)?\b){1,8}`;
const LABELLED = [PART_LN, PART_NL].map(P => new RegExp(`${P}${GAP}${P}${GAP}${P}`, 'gi'));

const num = s => parseFloat(String(s).replace(',', '.'));
const isIn = u => !!u && /^(in|inch|"|”|″|'')/i.test(u);
const r1 = x => Math.round(x * 10) / 10;

export function extract(text) {
  const triples = [], kg = [], linear = [];
  for (const re of LABELLED) for (const m of text.matchAll(re)) {
    const vals = [num(m[1]), num(m[3]), num(m[5])], units = [m[2], m[4], m[6]];
    if (vals.some(x => !x || x > 200)) continue;
    const anyUnit = units.find(Boolean);
    const v = vals.map((x, i) => isIn(units[i] || anyUnit) || (!anyUnit && Math.max(...vals) <= 26) ? r1(x * 2.54) : x);
    triples.push({ dims: v.sort((a, b) => b - a), at: m.index, raw: m[0].trim(), inches: isIn(anyUnit) });
  }
  for (const m of text.matchAll(TRIPLE)) {
    let v = [num(m[1]), num(m[2]), num(m[3])];
    if (v.some(x => !x || x > 200)) continue;
    const around = text.slice(m.index, m.index + m[0].length + 12);
    const unit = m[4] || (around.match(/cm|in(?:ch)?\b|"|”/i) || [])[0];
    const inches = isIn(unit) || (!unit && Math.max(...v) <= 26 && Math.min(...v) >= 6);
    if (inches) v = v.map(x => r1(x * 2.54));
    triples.push({ dims: v.sort((a, b) => b - a), at: m.index, raw: m[0].trim(), inches });
  }
  for (const m of text.matchAll(KG)) {
    const v = num(m[1]); const lb = /^(lb|pound)/i.test(m[2]);
    kg.push({ kg: lb ? r1(v * 0.4536) : v, at: m.index, raw: m[0] });
  }
  for (const m of text.matchAll(LINEAR)) {
    const v = num(m[1] || m[5]), u = m[2] || m[6];
    linear.push({ cm: isIn(u) ? r1(v * 2.54) : v, at: m.index, raw: m[0].slice(0, 80) });
  }
  return { relevant: RELEVANT.test(text), triples, kg, linear, text };
}

const near = (a, b, tol) => Math.abs(a - b) <= tol;
// 1 cm: airlines round inch limits to whole cm (22 in is printed as 56 or 55.9), and some print 55 for 55.9
const sameDims = (a, b) => a.length === b.length && a.every((x, i) => near(x, b[i], 1.0));

export function compare(airline, found) {
  const want = [];
  const add = (label, kind, value) => { if (value != null && !(Array.isArray(value) && !value.length)) want.push({ label, kind, value }); };
  add('carry-on size', 'dims', airline.co?.d);
  add('carry-on linear', 'lin', airline.co?.l);
  add('carry-on weight', 'kg', airline.co?.kg);
  if (airline.pi && !airline.pi.no) {
    add('personal size', 'dims', airline.pi.d);
    add('personal linear', 'lin', airline.pi.l);
    add('personal weight', 'kg', airline.pi.kg);
  }
  add('combined weight', 'kg', airline.ckg);
  for (let i = want.length - 1; i >= 0; i--) if (want[i].value === 'inf') want.splice(i, 1);   // 'no limit' has nothing to find

  const missing = [], hits = [];
  for (const w of want) {
    let hit;
    if (w.kind === 'dims') hit = found.triples.find(t => sameDims(t.dims, [...w.value].sort((a, b) => b - a)));
    if (w.kind === 'kg') hit = found.kg.find(k => near(k.kg, w.value, 0.15));
    if (w.kind === 'lin') hit = found.linear.find(l => near(l.cm, w.value, 1)) ||
      // a linear limit is often written as "115 cm" in a sentence about total size
      (new RegExp(`\\b${w.value}\\s*cm`).test(found.text) ? { at: found.text.search(new RegExp(`\\b${w.value}\\s*cm`)) } : null);
    if (hit) hits.push(hit.at); else missing.push(`${w.label} ${Array.isArray(w.value) ? w.value.join('×') : w.value}`);
  }
  const at = hits.length ? Math.min(...hits) : (found.triples[0]?.at ?? 0);
  const quote = found.text.slice(Math.max(0, at - 60), at + 160).trim();
  const uniq = [...new Map(found.triples.map(t => [t.dims.join('x'), t.dims])).values()];
  const kg = [...new Set(found.kg.map(k => k.kg))].filter(k => k <= 25);
  const lin = [...new Set(found.linear.map(l => l.cm))];
  if (!want.length) return { verdict: uniq.length ? 'CHANGED' : 'FAILED', missing: ['nothing on file to compare'], triples: uniq, kg, linear: lin, quote, errors: ['no figures on file and none found'] };
  if (!missing.length) return { verdict: 'CONFIRMED', quote };
  return { verdict: 'CHANGED', missing, triples: uniq, kg, linear: lin, quote };
}
