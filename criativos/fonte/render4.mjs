import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const emoji = 'file://' + path.join(dir, 'node_modules/@fontsource/noto-color-emoji/index.css');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Emo;src:url(${'file://'+path.join(dir,'node_modules/@fontsource/noto-color-emoji/files/noto-color-emoji-9-400-normal.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;overflow:hidden;background:#000;color:#fff;font-family:"Inter Display","Inter","Noto Color Emoji";-webkit-font-smoothing:antialiased}
.top{height:230px;background:#1C1C1E;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:26px;border-bottom:1px solid #2C2C2E}
.av{width:104px;height:104px;border-radius:50%;background:linear-gradient(#A0A0A8,#7C7C84);display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:600;color:#fff;margin-bottom:12px}
.nome{font-size:32px;color:#fff}
.chat{padding:60px 56px 0;display:flex;flex-direction:column;gap:22px}
.hora{text-align:center;color:#8E8E93;font-size:28px;margin-bottom:20px}
.b{max-width:830px;font-size:58px;line-height:1.26;padding:32px 46px;border-radius:54px;position:relative}
.eu{align-self:flex-end;background:#0A84FF}
.ela{align-self:flex-start;background:#26252A;font-weight:600}
.reac{position:absolute;top:-44px;left:-36px;background:#26252A;border:5px solid #000;border-radius:40px;padding:8px 16px;line-height:0}
.gap{height:26px}
.lido{align-self:flex-end;color:#8E8E93;font-size:27px;margin-top:-6px;padding-right:18px}
</style></head><body>
<div class="top"><div class="av">M</div><div class="nome">Mam</div></div>
<div class="chat">
<div class="hora">Vandaag 23:14</div>
<div class="b eu">Weer een paniekaanval. Midden in de rij bij de kassa.</div>
<div class="b ela">Stel je niet aan.</div>
<div class="gap"></div>
<div class="b eu">Ik dacht echt dat ik doodging.<span class="reac"><svg width="52" height="52" viewBox="0 0 64 64"><path d="M8 28h10v28H8z" fill="#E8B23A"/><path d="M22 54V28l12-20c4-2 8 1 7 6l-3 12h14c4 0 7 4 6 8l-4 16c-1 3-3 5-6 5H26c-2 0-4-1-4-1z" fill="#FFCC4D"/></svg></span></div>
<div class="lido">Gelezen</div>
</div></body></html>`;
const file = path.join(dir, 'v4-A13-chat-escuro.html'); fs.writeFileSync(file, html);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
await p.goto('file://' + file); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(dir, 'Gewoon Even A13 chat escuro.png') });
await b.close(); console.log('ok');
