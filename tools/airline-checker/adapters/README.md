# Custom adapters

The generic loader handles most airline pages. When an airline lands in `reports/repair-queue.md`
(three failed days in a row), write `adapters/<slug>.mjs`. The slug is printed in the queue.

An adapter exports one async function that returns `{ text, finalUrl }`. It gets the URL, the
current load mode, and the checker's own helpers:

```js
// adapters/gulf-air.mjs (example)
export default async function ({ url, mode, load, getBrowser }) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({ locale: 'en-GB' });
  const page = await ctx.newPage();
  try {
    await page.goto('https://www.gulfair.com/help/baggage/baggage-information', { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: /cabin baggage/i }).click();   // whatever hides the numbers
    const text = await page.locator('main').innerText();
    return { text: text.replace(/\s+/g, ' '), finalUrl: page.url() };
  } finally { await ctx.close(); }
}
```

Then run `node check.mjs --only "Gulf Air"`. A success clears it from the repair queue, and the
mode and URL that worked are remembered in `state/state.json` for next month.

The adapter only has to get the right text; number extraction and comparison stay in `lib/extract.mjs`.
