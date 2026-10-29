import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const [nome,dur,js,corpo]=JSON.parse(fs.readFileSync(path.join(dir,process.argv[2]),'utf8'));
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent}
body{width:1080px;height:1920px;overflow:hidden;font-family:"Inter Display","Inter";-webkit-font-smoothing:antialiased;position:relative}
.cap{position:absolute;left:60px;right:60px;display:flex;flex-direction:column;align-items:center;gap:16px}
.cap div{background:#fff;color:#111;font-weight:700;font-size:64px;line-height:1.18;padding:20px 34px;border-radius:22px;text-align:center}
.dim{position:absolute;inset:0;background:#000;opacity:0}
.fim{position:absolute;inset:0;background:#000;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 90px;text-align:center;color:#fff}
.fim h2{font-size:84px;font-weight:800;line-height:1.1;letter-spacing:-1.5px}
.fim p{margin-top:56px;font-size:64px;font-weight:700;opacity:0}
</style></head><body>${corpo}
<div class="fim" id="fim"><h2>Er is iets wat je op dat moment w&eacute;l kunt&nbsp;doen.</h2><p id="fp">Vijf vragen.</p></div>
<script>const cl=x=>Math.min(Math.max(x,0),1);window.setT=function(t){${js}}</script></body></html>`;
fs.writeFileSync(path.join(dir,nome+'.html'),html);
const pasta=path.join(dir,'ov_'+nome); fs.rmSync(pasta,{recursive:true,force:true}); fs.mkdirSync(pasta);
const b=await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p=await b.newPage({ viewport:{width:1080,height:1920} });
await p.goto('file://'+path.join(dir,nome+'.html')); await p.waitForTimeout(400);
for(let i=0;i<Math.round(dur*30);i++){await p.evaluate(t=>setT(t),i/30);await p.screenshot({path:path.join(pasta,String(i).padStart(4,'0')+'.png'),omitBackground:true});}
await b.close(); console.log('ok',nome);
