// render an SVG to PNG with a transparent background
const { chromium } = require('playwright');
(async()=>{const [svg,png,w,h]=process.argv.slice(2);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:+w,height:+h}});
const src=require('fs').readFileSync(svg,'utf8');
await p.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(src).toString('base64')}" style="width:${w}px;height:${h}px;display:block"></body></html>`);
await p.screenshot({path:png,omitBackground:true});await b.close();})();
