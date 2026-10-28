import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
body{width:1080px;height:1920px;overflow:hidden;font-family:"Inter Display","Inter";-webkit-font-smoothing:antialiased;position:relative}
.cap{position:absolute;left:60px;right:60px;top:360px;min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.cap div{background:#fff;color:#111;font-weight:700;font-size:62px;line-height:1.18;padding:18px 30px;border-radius:22px;text-align:center}
.nav{position:absolute;left:60px;right:60px;top:150px;background:#FFCC00;color:#111;border-radius:30px;padding:26px 34px;display:flex;align-items:center;gap:28px;font-size:44px;box-shadow:0 12px 30px rgba(0,0,0,.35);opacity:0}
.nav b{font-size:60px;font-weight:700}
.nav .seta{font-size:80px;line-height:1}
.fim{position:absolute;inset:0;background:#000;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 90px;text-align:center;color:#fff}
.fim h2{font-size:88px;font-weight:800;line-height:1.08;letter-spacing:-1.5px}
.fim p{margin-top:50px;font-size:50px;color:#ddd;opacity:0}
</style></head><body>
<div class="cap"><div id="c1">POV: Je krijgt een paniekaanval op&nbsp;de&nbsp;snelweg</div></div>
<div class="nav" id="nav"><span class="seta">&#8625;</span><div><div><b>14 km</b></div><div>Volgende afrit</div></div></div>
<div class="fim" id="fim"><h2>Op de snelweg kun je niet even&nbsp;weg.</h2><p id="fp">Vijf vragen. Dan weet je wat je w&eacute;l kunt&nbsp;doen.</p></div>
<script>
const cl=x=>Math.min(Math.max(x,0),1);
window.setT=function(t){
 c1.style.opacity=1;
 nav.style.opacity=cl((t-4.6)/0.25);nav.style.transform='translateY('+(1-cl((t-4.6)/0.3))*-40+'px)';
 const f=cl((t-10.0)/0.6);fim.style.opacity=f*0.88;fp.style.opacity=cl((t-11.2)/0.4);
 document.querySelector('.cap').style.opacity=1-f;
}
</script></body></html>`;
fs.writeFileSync(path.join(dir,'ov2.html'),html);
const pasta=path.join(dir,'ov2'); fs.rmSync(pasta,{recursive:true,force:true}); fs.mkdirSync(pasta);
const b=await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p=await b.newPage({ viewport:{width:1080,height:1920} });
await p.goto('file://'+path.join(dir,'ov2.html')); await p.waitForTimeout(400);
for(let i=0;i<Math.round(12.6*30);i++){await p.evaluate(t=>setT(t),i/30);await p.screenshot({path:path.join(pasta,String(i).padStart(4,'0')+'.png'),omitBackground:true});}
await b.close(); console.log('ok');
