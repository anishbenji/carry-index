/**
 * The named HTML character references the bundle scan decodes (sol security r3, S5-7). An address written with named
 * references (`someone&commat;example&period;com`) renders whole in a browser, so the scan decodes these before it
 * looks for addresses, canaries and local paths. The table holds every ASCII punctuation name from the HTML
 * standard's list (html.spec.whatwg.org/multipage/named-characters.html), the upper-case legacy forms of the five
 * markup ones, `&nbsp;` and common typography. Any other named reference in a public page is refused (`bad-content`),
 * so nothing the scan cannot read ships. No dependency: a small table of names to code points.
 */
export const NAMED_REFERENCES: Readonly<Record<string, string>> = {
  // ASCII punctuation.
  excl: "!",
  quot: '"',
  QUOT: '"',
  num: "#",
  dollar: "$",
  percnt: "%",
  amp: "&",
  AMP: "&",
  apos: "'",
  lpar: "(",
  rpar: ")",
  ast: "*",
  midast: "*",
  plus: "+",
  comma: ",",
  period: ".",
  sol: "/",
  colon: ":",
  semi: ";",
  lt: "<",
  LT: "<",
  equals: "=",
  gt: ">",
  GT: ">",
  quest: "?",
  commat: "@",
  lsqb: "[",
  lbrack: "[",
  bsol: "\\",
  rsqb: "]",
  rbrack: "]",
  Hat: "^",
  lowbar: "_",
  UnderBar: "_",
  grave: "`",
  DiacriticalGrave: "`",
  lcub: "{",
  lbrace: "{",
  verbar: "|",
  vert: "|",
  VerticalLine: "|",
  rcub: "}",
  rbrace: "}",
  // Spaces and common typography.
  nbsp: "\u00a0",
  NonBreakingSpace: "\u00a0",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  deg: "\u00b0",
  middot: "\u00b7",
  times: "\u00d7",
  divide: "\u00f7",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bull: "\u2022",
  hellip: "\u2026",
  larr: "\u2190",
  rarr: "\u2192",
  euro: "\u20ac",
  pound: "\u00a3",
  hyphen: "\u2010",
  dash: "\u2010",
  minus: "\u2212",
};

const NAMED = /&([A-Za-z][A-Za-z0-9]*);/g;

/** `text` with every named reference in the table decoded; others are left as they are. */
export function decodeNamedReferences(text: string): string {
  return text.replace(NAMED, (whole, name: string) => NAMED_REFERENCES[name] ?? whole);
}

/** Whether `text` holds a named reference (`&name;`) the table does not hold. */
export function hasUnknownNamedReference(text: string): boolean {
  for (const match of text.matchAll(NAMED)) {
    if (!Object.hasOwn(NAMED_REFERENCES, match[1] ?? "")) return true;
  }
  return false;
}
