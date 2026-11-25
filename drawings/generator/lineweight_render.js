const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const f of process.argv.slice(3)){const src=fs.readFileSync(f,'utf8');const vb=src.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const W=Math.round(vb[2]*2),H=Math.round(vb[3]*2);await p.setViewportSize({width:W,height:H});
await p.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ',`<svg width="${W}" height="${H}" `)}</body></html>`);
const out=process.argv[2]+'/'+f.split('/').slice(-1)[0].replace('.svg','.png');await p.screenshot({path:out,omitBackground:true});}
await b.close()})()
