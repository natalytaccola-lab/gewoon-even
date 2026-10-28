import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const f = n => 'file://' + path.join(dir, 'node_modules/@fontsource', n);
const fontes = `*{margin:0;padding:0;box-sizing:border-box}body{width:1080px;height:1350px;overflow:hidden;font-family:"Inter Display","Inter";-webkit-font-smoothing:antialiased;font-feature-settings:"cv08"}`;
const estilo = (tam) => `<style>${fontes}
 body{background:#F2EDE6;padding:110px 90px;display:flex;flex-direction:column;justify-content:center}
 h1{font-size:${tam}px;font-weight:800;line-height:1.04;color:#151515;letter-spacing:-3px}
 mark{background:linear-gradient(transparent 55%,#E8A27F 55%);color:inherit;padding:0 6px}
 p{margin-top:70px;font-size:58px;line-height:1.3;color:#2A2A2A;font-weight:500;max-width:880px}
 </style>`;
const pecas = {
 'A14 meldingen': `<style>${fontes}
 body{background:#F2EDE6;padding:110px 70px 0}
 h1{font-size:96px;font-weight:800;line-height:1.05;color:#151515;letter-spacing:-2px;margin:0 20px 80px}
 mark{background:linear-gradient(transparent 55%,#E8A27F 55%);color:inherit;padding:0 6px}
 .ban{background:rgba(255,255,255,.92);border-radius:40px;padding:26px 30px;display:flex;gap:24px;align-items:center;box-shadow:0 14px 40px rgba(0,0,0,.10);font-size:38px;color:#111;margin-bottom:20px}
 .ico{width:84px;height:84px;border-radius:20px;color:#fff;font-weight:700;font-size:40px;display:flex;align-items:center;justify-content:center;flex:none}
 .bt{flex:1;line-height:1.3}.bh{display:flex;justify-content:space-between;margin-bottom:4px}.bh span{color:#8A8A8E;font-size:30px}
 .ban.o2{opacity:.9;transform:scale(.97)}.ban.o3{opacity:.8;transform:scale(.94)}
 </style>
 <h1>Paniekaanval.<br>Op de wc.<br><mark>Op Annes verjaardag.</mark></h1>
 <div class="ban"><div class="ico" style="background:#34C759">M</div><div class="bt"><div class="bh"><b>Mark</b><span>nu</span></div><div>Ze snijden de taart aan <svg width="50" height="50" viewBox="0 0 64 64" style="vertical-align:-10px;margin-left:8px"><rect x="8" y="34" width="48" height="22" rx="5" fill="#C98A5A"/><rect x="8" y="28" width="48" height="12" rx="5" fill="#FBE3EA"/><path d="M8 38q6 5 12 0t12 0 12 0 12 0" fill="#FBE3EA"/><rect x="22" y="14" width="4" height="14" rx="1" fill="#7FB2F0"/><rect x="38" y="14" width="4" height="14" rx="1" fill="#F29BB0"/><path d="M24 4c3 4 3 7 0 8-3-1-3-4 0-8zM40 4c3 4 3 7 0 8-3-1-3-4 0-8z" fill="#FFB020"/></svg></div></div></div>
 <div class="o2"><div class="ban"><div class="ico" style="background:#FF9F0A">A</div><div class="bt"><div class="bh"><b>Anne</b><span>4 min</span></div><div>Kom je? We gaan zingen!</div></div></div></div>
 <div class="o3"><div class="ban"><div class="ico" style="background:#34C759">M</div><div class="bt"><div class="bh"><b>Mark</b><span>9 min</span></div><div>Waar blijf je?</div></div></div></div>`
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [nome, html] of Object.entries(pecas)) {
  const file = path.join(dir, 'v7-' + nome.replace(/ /g,'-') + '.html');
  fs.writeFileSync(file, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>');
  await pg.goto('file://' + file); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(dir, `Gewoon Even ${nome}.png`) });
}
await b.close(); console.log('ok');
