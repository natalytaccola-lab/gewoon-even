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
 'A2 tipografia': estilo(132) + `<h1>Iedereen zegt:<br><mark>adem rustig.</mark></h1><p>Probeer dat maar eens te tellen terwijl je hart bonst.</p>`,
 'A11 tipografia': estilo(112) + `<h1>Hartfilmpje: goed.<br>Bloed: goed.<br>Huisarts:<br><mark>&lsquo;Het is stress.&rsquo;</mark></h1><p>En toch bonst het om drie uur&nbsp;&rsquo;s&nbsp;nachts.</p>`,
 'A13 tipografia': estilo(132) + `<h1><mark>&lsquo;Stel je<br>niet aan.&rsquo;</mark></h1><p>Zei iemand die nog nooit om drie uur wakker lag met een bonzend&nbsp;hart.</p>`
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [nome, html] of Object.entries(pecas)) {
  const file = path.join(dir, 'v2-' + nome.replace(/ /g,'-') + '.html');
  fs.writeFileSync(file, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>');
  await pg.goto('file://' + file); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(dir, `Gewoon Even ${nome}.png`) });
}
await b.close(); console.log('ok');
