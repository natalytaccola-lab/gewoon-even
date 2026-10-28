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
 'A13 chat': `<style>${fontes}
 body{background:#FFFFFF;padding:0 64px;display:flex;flex-direction:column;justify-content:center;gap:28px}
 .hora{text-align:center;color:#8E8E93;font-size:30px;margin-bottom:24px}
 .b{max-width:840px;font-size:58px;line-height:1.28;padding:36px 50px;border-radius:56px}
 .ela{align-self:flex-start;background:#E9E9EB;color:#111;font-weight:600}
 .eu{align-self:flex-end;background:#2F7CF6;color:#fff}
 .lido{align-self:flex-end;color:#8E8E93;font-size:28px;margin-top:-10px;padding-right:20px}
 </style><div class="hora">Gisteren 23:14</div>
 <div class="b eu">Weer een paniekaanval. Midden in de rij bij de kassa.</div>
 <div class="b ela">Stel je niet aan.</div>
 <div class="b eu">Ik dacht echt dat ik doodging.</div>
 <div class="lido">Gelezen</div>`,
 'P1 notitie': `<style>${fontes}
 body{background:#ECEBE8;display:flex;align-items:center;justify-content:center}
 .nota{width:960px;height:1230px;background:#FFFFFF;border-radius:48px;box-shadow:0 30px 80px rgba(0,0,0,.10);padding:56px 70px}
 .topo{display:flex;justify-content:space-between;color:#D9A21B;font-size:38px;font-weight:500;margin-bottom:40px}
 .data{color:#8A8A8E;font-size:28px;text-align:center;margin-bottom:44px}
 h1{font-size:72px;font-weight:800;line-height:1.1;color:#111;margin-bottom:36px;letter-spacing:-1px}
 p{font-size:46px;line-height:1.38;color:#222;margin-bottom:26px}
 </style><div class="nota"><div class="topo"><span>&lsaquo; Notities</span><span>&bull;&bull;&bull;</span></div>
 <div class="data">03:04</div>
 <h1>Mijn moeilijkste momenten zijn &rsquo;s&nbsp;nachts.</h1>
 <p>De eerste keer dat ik het gebruikte was rond drie uur &rsquo;s&nbsp;nachts.</p>
 <p>Ik hoefde niemand te bellen. Alleen mijn oortjes in en luisteren.</p>
 <p>Ik viel niet magisch meteen in slaap. Maar de paniek zakte genoeg om weer te kunnen liggen.</p></div>`
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [nome, html] of Object.entries(pecas)) {
  const file = path.join(dir, 'v3-' + nome.replace(/ /g,'-') + '.html');
  fs.writeFileSync(file, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>');
  await pg.goto('file://' + file); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(dir, `Gewoon Even ${nome}.png`) });
}
await b.close(); console.log('ok');
