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
<div class="top"><div class="av">L</div><div class="nome">Lotte</div></div>
<div class="chat">
<div class="hora">Vandaag 10:42</div>
<div class="b eu">Paniekaanval. Midden in de vergadering. Ik zit nu op&nbsp;de&nbsp;wc.</div>
<div class="b ela">Ah joh. Even rustig ademhalen<svg style="vertical-align:-8px;margin-left:10px" width="58" height="58" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#FFCC4D"/><ellipse cx="22" cy="26" rx="4" ry="6" fill="#664500"/><ellipse cx="42" cy="26" rx="4" ry="6" fill="#664500"/><path d="M16 38c4 10 28 10 32 0" stroke="#664500" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="14" cy="38" r="5" fill="#FF8A8A" opacity=".6"/><circle cx="50" cy="38" r="5" fill="#FF8A8A" opacity=".6"/></svg></div>
<div class="b eu">Dat probeer ik al twintig minuten.</div>
<div class="lido">Gelezen</div>
</div></body></html>`;
const file = path.join(dir, 'v4-A2-chat-escuro.html'); fs.writeFileSync(file, html);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
await p.goto('file://' + file); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(dir, 'Gewoon Even A2 chat escuro.png') });
await b.close(); console.log('ok');
