import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
body{width:1080px;height:1920px;overflow:hidden;font-family:"Inter Display","Inter";-webkit-font-smoothing:antialiased;position:relative}
.cap{position:absolute;left:60px;right:60px;top:260px;display:flex;justify-content:center}
.cap div{background:#fff;color:#111;font-weight:700;font-size:64px;line-height:1.18;padding:20px 34px;border-radius:22px;text-align:center}
.mid{position:absolute;left:0;right:0;top:820px;text-align:center;color:#fff;font-weight:800;font-size:96px;line-height:1.1;letter-spacing:-1.5px;text-shadow:0 4px 30px rgba(0,0,0,.6);opacity:0;padding:0 80px}
.dim{position:absolute;inset:0;background:#000;opacity:0}
.fim{position:absolute;inset:0;background:#000;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 90px;text-align:center;color:#fff}
.fim h2{font-size:84px;font-weight:800;line-height:1.1;letter-spacing:-1.5px}
.fim p{margin-top:56px;font-size:64px;font-weight:700;color:#fff;opacity:0}
.ctav{position:absolute;left:60px;right:60px;top:1290px;background:#fff;color:#111;border-radius:28px;padding:30px 38px;opacity:0;box-shadow:0 14px 40px rgba(0,0,0,.35)}.ctav b{display:block;font-size:45px;line-height:1.12;font-weight:700;letter-spacing:-.5px}.ctav span{display:block;margin-top:12px;font-size:30px;line-height:1.3;color:#333;font-weight:500}</style></head><body>
<div class="dim" id="dim"></div>
<div class="cap" id="cap"><div>Weet je hoe je hart springt als je telefoon ineens weg&nbsp;is?</div></div>
<div class="mid" id="mid">Dat gevoel.<br>Zonder reden.</div>
<div class="ctav" id="ctav"><b>Ontdek wat je op dat moment kunt doen.</b><span>Gratis · sneller dan je telefoon zoeken →</span></div><div class="fim" id="fim"><h2>Er is iets wat je op dat moment w&eacute;l kunt&nbsp;doen.</h2><p id="fp">Vijf vragen.</p></div>
<script>
const cl=x=>Math.min(Math.max(x,0),1);
window.setT=function(t){
 const k=cl((t-4.4)/0.3); cap.style.opacity=1-k;
 dim.style.opacity=k*0.55; mid.style.opacity=k; mid.style.transform='translateY('+(1-k)*30+'px)';
 ctav.style.opacity=cl((t-5.0)/0.35);ctav.style.transform='translateY('+(1-cl((t-5.0)/0.35))*24+'px)';
}
</script></body></html>`;
fs.writeFileSync(path.join(dir,'ovf.html'),html);
const pasta=path.join(dir,'ovf'); fs.rmSync(pasta,{recursive:true,force:true}); fs.mkdirSync(pasta);
const b=await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p=await b.newPage({ viewport:{width:1080,height:1920} });
await p.goto('file://'+path.join(dir,'ovf.html')); await p.waitForTimeout(400);
for(let i=0;i<Math.round(7.0*30);i++){await p.evaluate(t=>setT(t),i/30);await p.screenshot({path:path.join(pasta,String(i).padStart(4,'0')+'.png'),omitBackground:true});}
await b.close(); console.log('ok');
