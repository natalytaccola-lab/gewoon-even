import { render } from './motor.mjs';
const cake='<svg width="56" height="56" viewBox="0 0 64 64" style="vertical-align:-12px;margin-left:8px"><rect x="8" y="34" width="48" height="22" rx="5" fill="#C98A5A"/><rect x="8" y="28" width="48" height="12" rx="5" fill="#FBE3EA"/><rect x="22" y="14" width="4" height="14" rx="1" fill="#7FB2F0"/><rect x="38" y="14" width="4" height="14" rx="1" fill="#F29BB0"/><path d="M24 4c3 4 3 7 0 8-3-1-3-4 0-8zM40 4c3 4 3 7 0 8-3-1-3-4 0-8z" fill="#FFB020"/></svg>';
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;background:#F2EDE6;color:#111;font-family:"Inter Display","Inter";-webkit-font-smoothing:antialiased;padding:300px 70px 0}
h1{font-size:110px;font-weight:800;line-height:1.04;color:#151515;letter-spacing:-2px;margin:0 16px 110px}
mark{background:linear-gradient(transparent 55%,#E8A27F 55%);color:inherit;padding:0 6px}
.lista{position:relative;height:700px}
.ban{position:absolute;left:0;right:0;background:rgba(255,255,255,.95);border-radius:44px;padding:30px 34px;display:flex;gap:26px;align-items:center;box-shadow:0 14px 40px rgba(0,0,0,.10);font-size:42px}
.ico{width:96px;height:96px;border-radius:22px;color:#fff;font-weight:700;font-size:46px;display:flex;align-items:center;justify-content:center;flex:none}
.bt{flex:1;line-height:1.3}.bh{display:flex;justify-content:space-between;margin-bottom:4px}.bh span{color:#8A8A8E;font-size:32px}
</style></head><body>
<h1 id="h">Paniekaanval.<br>Op de wc.<br><mark>Op Annes verjaardag.</mark></h1>
<div class="lista">
 <div class="ban" id="n0"><div class="ico" style="background:#34C759">M</div><div class="bt"><div class="bh"><b>Mark</b><span id="t0">nu</span></div><div>Waar blijf je?</div></div></div>
 <div class="ban" id="n1"><div class="ico" style="background:#FF9F0A">A</div><div class="bt"><div class="bh"><b>Anne</b><span id="t1">nu</span></div><div>Kom je? We gaan zingen!</div></div></div>
 <div class="ban" id="n2"><div class="ico" style="background:#34C759">M</div><div class="bt"><div class="bh"><b>Mark</b><span id="t2">nu</span></div><div>Ze snijden de taart aan${cake}</div></div></div>
</div>
<script>
const ease=x=>1-Math.pow(1-Math.min(Math.max(x,0),1),3);
const chega=[1.4,3.4,5.4], passo=190;
window.setT=function(t){
 h.style.opacity=Math.min(1,t/0.4);
 for(let i=0;i<3;i++){const el=document.getElementById('n'+i);
  // quantas chegaram depois desta: empurram-na para baixo
  let depois=0;for(let j=i+1;j<3;j++)depois+=ease((t-chega[j])/0.35);
  const k=ease((t-chega[i])/0.35);
  el.style.opacity=t<chega[i]?0:k;el.style.transform='translateY('+(depois*passo-(1-k)*60)+'px)';el.style.zIndex=10+i;}
 t0.textContent=t<chega[1]?'nu':(t<chega[2]?'5 min':'9 min');
 t1.textContent=t<chega[2]?'nu':'4 min';
 t2.textContent='nu';
}
</script></body></html>`;
console.log(await render('A14', html, 9, [{f:'ding.wav',t:1.4},{f:'ding.wav',t:3.4},{f:'ding.wav',t:5.4}]));
