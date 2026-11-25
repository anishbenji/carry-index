// node test/search.test.mjs — offline checks of the search fallback helpers (no network)
import assert from 'node:assert/strict';
import { siteOf, queryFor, googleLink } from '../lib/search.mjs';

assert.equal(siteOf('https://www.flyedelweiss.com/us/en/prepare/baggage/hand-baggage.html'), 'flyedelweiss.com');
assert.equal(siteOf('https://www.flysafair.co.za/travel-tools/extras/luggage-policy'), 'flysafair.co.za');
assert.equal(siteOf('https://www.nepalairlines.com.np/carry-on-baggage'), 'nepalairlines.com.np');
assert.equal(siteOf('https://help.flyadeal.com/hc/en-us/articles/1'), 'flyadeal.com');
assert.equal(queryFor('AJet', 'ajet.com'), 'site:ajet.com AJet carry-on cabin baggage size kg');
assert.ok(googleLink('AJet', 'ajet.com').startsWith('https://www.google.com/search?q=site%3Aajet.com'));
console.log('search tests: all passed');
