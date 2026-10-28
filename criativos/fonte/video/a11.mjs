import { render } from './motor.mjs';
const linhas=["Hartfilmpje: goed.","Bloed: goed.","Huisarts: ‘Het is stress.’","Waarom lig ik dan weer wakker met mijn hand op mijn borst?"];
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;background:#fff;color:#111;font-family:"Inter Display","Inter";-webkit-font-smoothing:antialiased}
.topo{display:flex;justify-content:space-between;color:#D9A21B;font-size:42px;font-weight:500;padding:120px 70px 0}
.data{color:#8A8A8E;font-size:32px;text-align:center;margin:50px 0 300px}
.txt{padding:0 80px}
p{font-size:74px;line-height:1.22;font-weight:600;margin-bottom:6px;letter-spacing:-0.5px;min-height:1px}
p.v{margin-top:70px;font-size:70px;line-height:1.25;font-weight:400}
.c{display:inline-block;width:6px;height:70px;background:#D9A21B;vertical-align:-12px;margin-left:6px}
</style></head><body>
<div class="topo"><span>&lsaquo; Notities</span><span>&bull;&bull;&bull;</span></div>
<div class="data">Vandaag 03:12</div>
<div class="txt"><p id="p0"></p><p id="p1"></p><p id="p2"></p><p class="v" id="p3"></p></div>
<script>
const L=${JSON.stringify(linhas)};
// inicio e velocidade (car/s) de cada linha; a pergunta e' escrita mais devagar
const ini=[0.6,1.9,2.9,5.0], vel=[16,16,16,11];
window.setT=function(t){let ativa=-1;
 L.forEach((s,i)=>{const n=Math.max(0,Math.min(s.length,Math.floor((t-ini[i])*vel[i])));document.getElementById('p'+i).textContent=s.slice(0,n);if(t>=ini[i])ativa=i;});
 if(ativa<0)ativa=0;const el=document.getElementById('p'+ativa);
 const fim=t>ini[3]+L[3].length/vel[3];const pisca=fim?(Math.floor(t*1.6)%2===0):true;
 const c=document.createElement('span');c.className='c';c.style.opacity=pisca?1:0;el.appendChild(c);}
</script></body></html>`;
const sons=[];const ini=[0.6,1.9,2.9,5.0],vel=[16,16,16,11];
linhas.forEach((s,i)=>{for(let k=0;k<s.length;k+=1){if(s[k]!==' ')sons.push({f:'tick.wav',t:ini[i]+k/vel[i]});}});
console.log(await render('A11', html, 12, sons));
