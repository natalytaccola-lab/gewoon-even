import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const thumb='<svg width="56" height="56" viewBox="0 0 64 64"><path d="M8 28h10v28H8z" fill="#E8B23A"/><path d="M22 54V28l12-20c4-2 8 1 7 6l-3 12h14c4 0 7 4 6 8l-4 16c-1 3-3 5-6 5H26c-2 0-4-1-4-1z" fill="#FFCC4D"/></svg>';
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;background:#000;color:#fff;font-family:"Inter Display","Inter";-webkit-font-smoothing:antialiased}
.top{height:300px;background:#1C1C1E;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:30px;border-bottom:1px solid #2C2C2E}
.av{width:120px;height:120px;border-radius:50%;background:linear-gradient(#A0A0A8,#7C7C84);display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:600;margin-bottom:14px}
.nome{font-size:36px}
.chat{padding:360px 56px 0;display:flex;flex-direction:column;gap:26px}
.hora{text-align:center;color:#8E8E93;font-size:30px;margin-bottom:24px}
.b{max-width:860px;font-size:64px;line-height:1.26;padding:36px 50px;border-radius:58px;position:relative;opacity:0;transform-origin:right bottom}
.eu{align-self:flex-end;background:#0A84FF}
.ela{align-self:flex-start;background:#26252A;font-weight:600;transform-origin:left bottom}
.dots{align-self:flex-start;background:#26252A;border-radius:58px;padding:40px 50px;display:flex;gap:18px;opacity:0;position:absolute}
.dots i{width:24px;height:24px;border-radius:50%;background:#8E8E93;display:block}
.slot{position:relative;display:flex;flex-direction:column}
.reac{position:absolute;top:-48px;left:-38px;background:#26252A;border:6px solid #000;border-radius:44px;padding:8px 18px;line-height:0;opacity:0}
.lido{align-self:flex-end;color:#8E8E93;font-size:30px;padding-right:20px;opacity:0}
</style></head><body>
<div class="top"><div class="av">M</div><div class="nome">Mam</div></div>
<div class="chat"><div class="hora">Vandaag 23:14</div>
<div class="b eu" id="m1">Weer een paniekaanval. Midden in de rij bij de&nbsp;kassa.</div>
<div class="slot"><div class="dots" id="d"><i></i><i></i><i></i></div><div class="b ela" id="m2">Stel je niet aan.</div></div>
<div class="b eu" id="m3">Ik dacht echt dat ik doodging.<span class="reac" id="r">${thumb}</span></div>
<div class="lido" id="l">Gelezen</div></div>
<script>
const ease=x=>1-Math.pow(1-Math.min(Math.max(x,0),1),3);
function pop(el,t0,t){const k=ease((t-t0)/0.25);el.style.opacity=t<t0?0:Math.min(1,(t-t0)/0.12);el.style.transform='scale('+(t<t0?0.6:0.6+0.4*k)+')';}
window.setT=function(t){
 pop(m1,0.4,t);
 const d=document.getElementById('d');
 d.style.opacity=(t>1.5&&t<2.9)?1:0;
 [...d.children].forEach((e,i)=>{e.style.opacity=0.4+0.6*Math.abs(Math.sin((t*4)-i*0.6));});
 pop(m2,2.9,t); pop(m3,4.4,t);
 l.style.opacity=t>5.6?Math.min(1,(t-5.6)/0.3):0;
 const r=document.getElementById('r'); const k=ease((t-6.8)/0.3);
 r.style.opacity=t<6.8?0:1; r.style.transform='scale('+(t<6.8?0.2:0.2+0.8*k+0.15*Math.sin(Math.min(1,(t-6.8)/0.3)*Math.PI))+')';
}
</script></body></html>`;
fs.writeFileSync(path.join(dir,'a13.html'),html);
fs.mkdirSync(path.join(dir,'fr'),{recursive:true});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('file://'+path.join(dir,'a13.html')); await p.waitForTimeout(500);
const fps=30, dur=10;
for(let i=0;i<fps*dur;i++){ await p.evaluate(t=>setT(t), i/fps); await p.screenshot({path:path.join(dir,'fr',String(i).padStart(4,'0')+'.png')}); }
await b.close(); console.log('frames ok');
