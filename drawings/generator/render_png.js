// Render an SVG to a transparent PNG at a given pixel width.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [svg, png, w] = process.argv.slice(2);
  const src = fs.readFileSync(svg, 'utf8');
  const vb = src.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const W = +w, H = Math.round(W * vb[3] / vb[2]);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${W}" height="${H}" `)}</body></html>`);
  await p.screenshot({ path: png, omitBackground: true }); await b.close(); console.log(png, W + 'x' + H);
})();
