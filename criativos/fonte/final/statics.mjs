import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const L1='Ontdek wat je op dat moment kunt doen.';
const S=[
 ['A2-chat-lotte','Zonder tellen of onthouden · gratis · minder dan 1 minuut →',1182,'dark'],
 ['A11-notitie','Zonder verwijzing, vannacht al · gratis · minder dan 1 minuut →',1120,'dark'],
 ['A13-chat-mam','Je hoeft niets uit te leggen · gratis · minder dan 1 minuut →',1140,'light'],
 ['A14-meldingen','Niemand hoeft het te merken · gratis · minder dan 1 minuut →',1150,'dark'],
 ['P1-notitie','Je hoeft niemand wakker te maken · gratis · minder dan 1 minuut →',1080,'dark'],
];
const b=await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p=await b.newPage({ viewport:{width:1080,height:1350} });
for(const [n,c2,top,tema] of S){ const fs2=n.startsWith('P1')?28:31;
 const bg=tema==='dark'?'#16211B':'#FFFFFF', fg=tema==='dark'?'#FFFFFF':'#111111', sub=tema==='dark'?'#D7E0DA':'#333333';
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}
 body{width:1080px;height:1350px;overflow:hidden;position:relative;font-family:"Inter Display","Inter";-webkit-font-smoothing:antialiased;font-feature-settings:"cv08"}
 img{position:absolute;inset:0;width:1080px;height:1350px}
 .cta{position:absolute;left:64px;right:64px;top:${top}px;background:${bg};color:${fg};border-radius:28px;padding:28px 36px;box-shadow:0 14px 40px rgba(0,0,0,.18)}
 b{display:block;font-size:44px;line-height:1.15;font-weight:700;letter-spacing:-.5px}
 span{display:block;margin-top:10px;font-size:${fs2}px;line-height:1.3;color:${sub};font-weight:500}
 </style></head><body><img src="file://${path.join(dir,n+'.png')}"><div class="cta"><b>${L1}</b><span>${c2}</span></div></body></html>`;
 const f=path.join(dir,n+'-cta.html'); fs.writeFileSync(f,html);
 await p.goto('file://'+f); await p.waitForTimeout(300);
 await p.screenshot({path:path.join(dir,n+'-cta.png')});
}
await b.close(); console.log('ok');
