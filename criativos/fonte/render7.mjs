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
 'A11 notitie': `<style>${fontes}
 body{background:#FFFFFF}
 .topo{display:flex;justify-content:space-between;color:#D9A21B;font-size:40px;font-weight:500;padding:80px 70px 0}
 .data{color:#8A8A8E;font-size:30px;text-align:center;margin:46px 0 60px}
 .txt{padding:0 80px}
 p{font-size:70px;line-height:1.22;color:#111;font-weight:600;margin-bottom:6px;letter-spacing:-0.5px}
 .vraag{margin-top:64px;font-size:66px;line-height:1.25;font-weight:400;color:#111}
 </style><div class="topo"><span>&lsaquo; Notities</span><span>&bull;&bull;&bull;</span></div>
 <div class="data">Vandaag 03:12</div>
 <div class="txt"><p>Hartfilmpje: goed.</p><p>Bloed: goed.</p><p>Huisarts: &lsquo;Het is stress.&rsquo;</p>
 <p class="vraag">Waarom lig ik dan weer wakker met mijn hand op mijn&nbsp;borst?<span style="display:inline-block;width:5px;height:66px;background:#D9A21B;vertical-align:-10px;margin-left:6px"></span></p></div>`
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
