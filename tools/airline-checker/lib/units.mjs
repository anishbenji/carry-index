/* Which unit systems an airline prints each limit in, and its own imperial figures as printed.

   unitsFor(text, airline, { read, from }) looks at page text (or a stored quote) for the figures on
   file for one airline (airlines.json shape: co / pi with d, l, kg, and ckg) and returns, per piece:
     { printed: { d, l, kg },          ["metric", "imperial"], ["metric"], ["imperial"] or null (could not tell)
       d_in, l_in, lb,                 the airline's own imperial figure, or ours converted from metric (1 decimal)
       converted: [...],               which fields are our conversions: "d_in", "l_in", "lb", or "d", "l", "kg"
       read, from }                    date read, and "page" (checker) or "quote" (stored wording)
   An imperial figure counts only if it is within IN_TOL / LB_TOL of the metric figure on file; where
   several different ones would do, only one printed right beside the metric figure is taken. */

const CM_PER_IN = 2.54, KG_PER_LB = 0.45359237;
export const IN_TOL = 1.0, LB_TOL = 1.5;            // airlines round (40 cm is printed as 15 in or 16 in)
const CM_TOL = 1.0, KG_TOL = 0.15;                  // same tolerances as compare() in extract.mjs
const r1 = x => Math.round(x * 10) / 10;
const isNum = x => typeof x === 'number' && isFinite(x);
const toIn = cm => r1(cm / CM_PER_IN), toLb = kg => r1(kg / KG_PER_LB);

const NUM = /(?<![\d.,])\d{1,3}(?:\.\d{1,2}|,\d(?!\d))?(?!\d)/g;
const AFTER = {
  cm: /^\s*-?\s*(?:cms?|centimet(?:er|re)s?)(?![a-z])|^\s*厘米/i,
  in: /^\s*-?\s*(linear\s+)?(?:inch(?:es)?(?![a-z])|in(?![a-z])(?!\s+(?:the|a|an|your|our|this|that|its|their|cabin|front|addition|case|order)\b)\.?|"|”|″|“|''|’’)/i,
  kg: /^\s*(?:\([a-z -]{2,15}\)\s*)?(?:kgs?|kilo(?:gram)?s?)(?![a-z])|^\s*公斤/i,
  lb: /^\s*(?:lbs?|pounds?)(?![a-z])\.?/i,
};
// "22 x 14 x 9 in", "L55xW25xH35cm", "18 by 14 by 8 inches": a bare number takes the unit of the next one
const SEP_INH = /^\s*(?:[a-z]{1,6}\s*)?(?:[x×✕*]|by)\s*(?:[a-z]{1,6}\s*[=:]?\s*)?$/i;
const LABELS = /\b(?:height|length|width|depth|breadth|thickness|high|long|wide|deep|tall|thick|in|max(?:imum)?\.?|and|by|[a-z])\b/gi;

export function normalize(text) {
  return String(text || '').replace(/&quot;|&#34;/g, '"').replace(/&#x27;|&#39;|&apos;|&#039;/g, "'")
    .replace(/&times;|&#215;/g, '×').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&');
}

/* Every number with its unit (cm, in, kg, lb or none), then dimension triples per system. */
export function scan(raw) {
  const text = normalize(raw), toks = [];
  for (const m of text.matchAll(NUM)) {
    const t = { v: parseFloat(m[0].replace(',', '.')), at: m.index, nend: m.index + m[0].length, sys: null };
    const rest = text.slice(t.nend, t.nend + 24);
    for (const [sys, re] of Object.entries(AFTER)) {
      const u = rest.match(re);
      if (u) { t.sys = sys; t.end = t.nend + u[0].length; t.linear = sys === 'in' && !!u[1]; break; }
    }
    t.end ??= t.nend;
    toks.push(t);
  }
  for (let i = toks.length - 2; i >= 0; i--) {
    const t = toks[i], n = toks[i + 1];
    if (!t.sys && (n.sys === 'cm' || n.sys === 'in') && SEP_INH.test(text.slice(t.nend, n.at))) t.sys = n.sys;
  }
  const triples = [];
  for (const sys of ['cm', 'in']) {
    const other = sys === 'cm' ? 'in' : 'cm', max = sys === 'cm' ? 200 : 80;
    const L = toks.filter(t => t.sys === sys && t.v > 0 && t.v <= max);
    const blank = new Uint8Array(text.length);   // the other system's figures inside a gap: "55cm (21.5\") Width 40cm"
    for (const t of toks) if (t.sys === other) blank.fill(1, t.at, t.end);
    const gapOk = (a, b) => {
      if (b.at - a.end > 30) return false;
      let g = '';
      for (let p = a.end; p < b.at; p++) g += blank[p] ? ' ' : text[p];
      g = g.replace(/[^\x00-\x7F]/g, ' ').replace(/(?<![a-z])x(?=[a-z])/gi, 'x ').replace(LABELS, ' ');   // "L55xW25xH35cm"
      return /^[\s,;+&x*\/|:=\-()\[\]]*$/i.test(g);
    };
    for (let i = 0; i + 2 < L.length; i++) {
      const [a, b, c] = L.slice(i, i + 3);
      if (gapOk(a, b) && gapOk(b, c)) {
        triples.push({ sys, v: [a.v, b.v, c.v].sort((x, y) => y - x), at: a.at, end: c.end });
      }
    }
  }
  return { text, toks, triples };
}

const close = (x, y, tol) => Array.isArray(y) ? x.length === y.length && x.every((v, i) => Math.abs(v - y[i]) <= tol) : Math.abs(x - y) <= tol;
const key = v => Array.isArray(v) ? v.join('x') : String(v);
// printed right beside each other: "56 x 36 x 23 cm (22 x 14 x 9 in)", "10 kg / 22 lb", "115 cm (45 in)"
const beside = (text, a, b) => { const [p, q] = a.at < b.at ? [a, b] : [b, a]; const g = text.slice(p.end, q.at); return q.at >= p.end && g.length <= 12 && !/\d/.test(g); };
const near = (a, b, span) => Math.abs(a.at - b.at) <= span;

/* One quantity: kind 'd' (cm triple), 'l' (linear cm) or 'kg'. */
function readOne(s, kind, F) {
  const IN = { d: 'd_in', l: 'l_in', kg: 'lb' }[kind];
  if (kind === 'd' ? !(Array.isArray(F) && F.length === 3 && F.every(isNum)) : !isNum(F)) return { printed: null, imp: null, converted: [] };
  const want = kind === 'd' ? [...F].sort((x, y) => y - x) : F;
  const wantImp = kind === 'd' ? want.map(x => x / CM_PER_IN) : kind === 'l' ? F / CM_PER_IN : F / KG_PER_LB;
  const conv = kind === 'd' ? want.map(toIn) : kind === 'l' ? toIn(F) : toLb(F);
  const single = sys => s.toks.filter(t => t.sys === sys);
  const mItems = kind === 'd' ? s.triples.filter(t => t.sys === 'cm') : kind === 'l' ? single('cm') : single('kg');
  const iItems = kind === 'd' ? s.triples.filter(t => t.sys === 'in') : kind === 'l' ? single('in') : single('lb');
  const m = mItems.filter(x => close(x.v, want, kind === 'kg' ? KG_TOL : CM_TOL));
  const exact = m.some(x => close(x.v, want, 0.05));
  let im = iItems.filter(x => close(x.v, wantImp, kind === 'kg' ? LB_TOL : IN_TOL));
  if (kind === 'l')   // a linear inch figure needs the word, or the linear cm figure right beside it
    im = im.filter(x => x.linear || m.some(y => beside(s.text, x, y)) ||
      /linear|total|sum|combined|three dimensions|l\s*\+\s*[wbh]|세 변/i.test(s.text.slice(Math.max(0, x.at - 60), x.end + 30)));
  if (new Set(im.map(x => key(x.v))).size > 1) im = im.filter(x => m.some(y => beside(s.text, x, y)));
  let own = new Set(im.map(x => key(x.v))).size === 1 ? im[0].v : null;
  // imperial found but no metric read: unsure if a metric figure we could not read sits nearby
  if (own != null && !m.length) {
    const mt = s.toks.filter(t => t.sys === (kind === 'kg' ? 'kg' : 'cm'));
    const hits = kind === 'd' ? mt.filter(t => near(t, im[0], 80) && want.some(w => Math.abs(t.v - w) <= CM_TOL)).length >= 2
      : mt.some(t => near(t, im[0], 60) && Math.abs(t.v - F) <= (kind === 'kg' ? 0.5 : 1.5));
    const word = (kind === 'kg' ? /kg|kilo|公斤/i : /cm|centimet|厘米/i).test(s.text.slice(Math.max(0, im[0].at - 25), im[0].end + 25));   // "seven kg (15 lb)"
    if (hits || word) own = null, im = [];
  }
  if (own == null) return { printed: m.length ? ['metric'] : null, imp: conv, converted: [IN] };
  return { printed: m.length ? ['metric', 'imperial'] : ['imperial'], imp: own, converted: exact ? [] : [kind] };
}

function readPiece(s, p, meta) {
  const d = readOne(s, 'd', p.d), l = readOne(s, 'l', p.l), kg = readOne(s, 'kg', p.kg);
  return { printed: { d: d.printed, l: l.printed, kg: kg.printed }, d_in: d.imp, l_in: l.imp, lb: kg.imp,
    converted: [...d.converted, ...l.converted, ...kg.converted], read: meta.read, from: meta.from };
}
const hasFigures = p => !!p && (Array.isArray(p.d) || isNum(p.l) || isNum(p.kg));

/* Units for one airline (airlines.json shape). Pieces with no figures (or no personal item) get null. */
export function unitsFor(text, a, meta = {}) {
  const s = scan(text);
  const co = hasFigures(a.co) ? readPiece(s, a.co, meta) : null;
  const pi = a.pi && !a.pi.no && hasFigures(a.pi) ? readPiece(s, a.pi, meta) : null;
  let ckg = null;
  if (isNum(a.ckg)) { const k = readOne(s, 'kg', a.ckg); ckg = { printed: { kg: k.printed }, lb: k.imp, converted: k.converted, read: meta.read, from: meta.from }; }
  return { co, pi, ckg };
}

/* A verified record (carryOn / personal / combined_kg) in airlines.json shape. */
export const fromRecord = r => ({
  co: r.carryOn && { d: r.carryOn.dims_cm, l: r.carryOn.linear_cm, kg: r.carryOn.weight_kg },
  pi: r.personal && { d: r.personal.dims_cm, l: r.personal.linear_cm, kg: r.personal.weight_kg, no: r.personal.allowed === false },
  ckg: r.combined_kg,
});

/* Put units on a verified record (carryOn.units, personal.units, combinedUnits); null removes them. */
export function attach(rec, u) {
  for (const [k, v] of [['carryOn', u.co], ['personal', u.pi]]) if (rec[k]) { if (v) rec[k].units = v; else delete rec[k].units; }
  if (u.ckg) rec.combinedUnits = u.ckg; else delete rec.combinedUnits;
  return rec;
}

/* One word for an airline: "both", "metric only", "imperial only", "mixed" or "could not tell". */
export function summarize(u) {
  const seen = [u.co, u.pi, u.ckg].filter(Boolean).flatMap(x => Object.values(x.printed)).filter(Boolean).map(p => p.join('+'));
  if (!seen.length) return 'could not tell';
  const kinds = new Set(seen);
  if (kinds.size > 1) return 'mixed';
  return { 'metric+imperial': 'both', metric: 'metric only', imperial: 'imperial only' }[seen[0]];
}
