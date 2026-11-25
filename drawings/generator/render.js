const { chromium } = require('playwright');
(async()=>{const [svg,png,w,h]=process.argv.slice(2);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:+w||1600,height:+h||1600}});
await p.goto('file://'+require('path').resolve(svg));await p.screenshot({path:png});await b.close();})();
