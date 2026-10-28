import { render } from './motor.mjs';
const smile='<svg style="vertical-align:-10px;margin-left:12px" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#FFCC4D"/><ellipse cx="22" cy="26" rx="4" ry="6" fill="#664500"/><ellipse cx="42" cy="26" rx="4" ry="6" fill="#664500"/><path d="M16 38c4 10 28 10 32 0" stroke="#664500" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="14" cy="38" r="5" fill="#FF8A8A" opacity=".6"/><circle cx="50" cy="38" r="5" fill="#FF8A8A" opacity=".6"/></svg>';
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;background:#fff;color:#111;font-family:"Inter Display","Inter";-webkit-font-smoothing:antialiased}
.top{height:300px;background:#F6F6F8;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:30px;border-bottom:1px solid #E2E2E6}
.av{width:120px;height:120px;border-radius:50%;background:linear-gradient(#A0A0A8,#7C7C84);display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:600;color:#fff;margin-bottom:14px}
.nome{font-size:36px}
.chat{padding:340px 56px 0;display:flex;flex-direction:column;gap:26px}
.hora{text-align:center;color:#8E8E93;font-size:30px;margin-bottom:24px}
.b{max-width:860px;font-size:64px;line-height:1.26;padding:36px 50px;border-radius:58px;opacity:0;transform-origin:right bottom}
.eu{align-self:flex-end;background:#0A84FF;color:#fff}
.ela{align-self:flex-start;background:#E9E9EB;font-weight:600;transform-origin:left bottom}
.slot{position:relative;display:flex;flex-direction:column}
.dots{background:#E9E9EB;border-radius:58px;padding:40px 50px;display:flex;gap:18px;opacity:0;position:absolute;left:0;top:0}
.dots i{width:24px;height:24px;border-radius:50%;background:#A3A3A8;display:block}
.lido{align-self:flex-end;color:#8E8E93;font-size:30px;padding-right:20px;opacity:0}
</style></head><body>
<div class="top"><div class="av">L</div><div class="nome">Lotte</div></div>
<div class="chat"><div class="hora">Vandaag 10:42</div>
<div class="b eu" id="m1">Paniekaanval. Midden in de vergadering. Ik zit nu op&nbsp;de&nbsp;wc.</div>
<div class="slot"><div class="dots" id="d"><i></i><i></i><i></i></div><div class="b ela" id="m2">Ah joh. Even rustig ademhalen${smile}</div></div>
<div class="b eu" id="m3">Dat probeer ik al twintig minuten.</div>
<div class="lido" id="l">Gelezen</div></div>
<script>
const ease=x=>1-Math.pow(1-Math.min(Math.max(x,0),1),3);
function pop(el,t0,t){const k=ease((t-t0)/0.25);el.style.opacity=t<t0?0:Math.min(1,(t-t0)/0.12);el.style.transform='scale('+(t<t0?0.6:0.6+0.4*k)+')';}
window.setT=function(t){pop(m1,0.4,t);const d=document.getElementById('d');d.style.opacity=(t>1.6&&t<3.0)?1:0;[...d.children].forEach((e,i)=>{e.style.opacity=0.4+0.6*Math.abs(Math.sin((t*4)-i*0.6));});pop(m2,3.0,t);pop(m3,4.8,t);l.style.opacity=t>6.0?Math.min(1,(t-6.0)/0.3):0;}
</script></body></html>`;
console.log(await render('A2', html, 9, [{f:'pop.wav',t:0.4},{f:'pop2.wav',t:3.0},{f:'pop.wav',t:4.8}]));
