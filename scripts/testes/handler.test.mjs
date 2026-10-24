import assert from 'node:assert/strict';
const repo=new URL('../../api/', import.meta.url).href;
process.env.BREVO_API_KEY='k'; process.env.UNSUB_SECRET='us'; process.env.VERCEL_ENV='preview'; process.env.BREVO_LIST_ID='3';
const hoje=new Date().toISOString().slice(0,10);
const dias=n=>new Date(Date.now()-n*86400000).toISOString();
const contactos=[
 {email:'d16@x.nl',emailBlacklisted:false,listUnsubscribed:[],attributes:{SOURCE:'quiz_completed',SIGNUP_DATE:dias(16)}},
 {email:'comprou@x.nl',emailBlacklisted:false,listUnsubscribed:[],attributes:{SOURCE:'quiz_completed',SIGNUP_DATE:dias(16),HAS_NP:true}},
 {email:'d19@x.nl',emailBlacklisted:false,listUnsubscribed:[],attributes:{SOURCE:'quiz_completed',SIGNUP_DATE:dias(19),FA6_SENT:dias(3).slice(0,10)}},
 {email:'d5@x.nl',emailBlacklisted:false,listUnsubscribed:[],attributes:{SOURCE:'quiz_completed',SIGNUP_DATE:dias(5)}},
];
let chamadas=[];
globalThis.fetch=async(url,o={})=>{chamadas.push({url,metodo:o.method,corpo:o.body&&JSON.parse(o.body)});
  const resp=(s,d)=>({ok:s<300,status:s,text:async()=>JSON.stringify(d)});
  if(url.includes('/contacts/attributes/')) return resp(400,{code:'duplicate_parameter'});
  if(url.includes('/contacts/lists/3/contacts')) return resp(200,{contacts:contactos});
  if(url.endsWith('/smtp/email')) return resp(201,{messageId:'m'});
  if(o.method==='PUT') return resp(204,null);
  return resp(404,{});};
const S=await import(repo+'_sequencias.js'); S.SEQUENCIAS[0].inicio='2020-01-01';
const { default: h } = await import(repo+'sequencias.js');
const run=async(q={},headers={},method='GET')=>{let out={};const res={status(s){out.s=s;return this},json(j){out.j=j;return this},setHeader(){return this},send(b){out.b=b;return this},end(){return this}};await h({query:q,headers,method},res);return out;};
// sem agente do cron
assert.equal((await run()).s,401);
process.env.CRON_SECRET='cs'; assert.equal((await run({},{'user-agent':'vercel-cron/1.0'})).s,401); delete process.env.CRON_SECRET;
// simulacao nao envia
chamadas=[]; let r=await run({simular:'1'});
assert.equal(r.s,200); assert.deepEqual(r.j.sequencias[0].aEnviar,{'Funil A 6 · Stille verlies':1,'Funil A 7 · Functionele klachten':1});
assert.ok(!JSON.stringify(r.j).includes('@x.nl'));
assert.ok(!chamadas.some(c=>c.url.endsWith('/smtp/email')||c.metodo==='PUT'));
// corrida real via cron
chamadas=[]; r=await run({}, {'user-agent':'vercel-cron/1.0'});
const envios=chamadas.filter(c=>c.url.endsWith('/smtp/email'));
assert.deepEqual(envios.map(c=>c.corpo.to[0].email+':'+c.corpo.templateId),['d16@x.nl:83','d19@x.nl:84']);
assert.match(envios[0].corpo.params.UNSUB_URL,/^https:\/\/gewoon-even\.nl\/api\/uitschrijven\?e=d16%40x\.nl&t=/);
assert.equal(envios[0].corpo.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
const marcas=chamadas.filter(c=>c.metodo==='PUT').map(c=>decodeURIComponent(c.url.split('/').pop())+':'+JSON.stringify(c.corpo.attributes));
assert.deepEqual(marcas.filter(m=>!m.startsWith('hello@')),[`d16@x.nl:{"FA6_SENT":"${hoje}"}`,`d19@x.nl:{"FA7_SENT":"${hoje}"}`]);
assert.match(marcas.find(m=>m.startsWith('hello@gewoon-even.nl:')),/SEQ_ULTIMA_CORRIDA":"\d{4}-\d\d-\d\dT.* funil-a-extra:4c\/2e\/0f/);
// teste: um envio, sem marca
chamadas=[]; r=await run({teste:'1',para:'hello@gewoon-even.nl',passo:'FA7_SENT'});
assert.equal(r.s,200); assert.equal(chamadas.length,1); assert.equal(chamadas[0].corpo.templateId,84);
assert.equal((await run({teste:'1',para:'qualquer@x.nl',passo:'FA7_SENT'})).s,400);
process.env.VERCEL_ENV='production'; assert.equal((await run({teste:'1',para:'hello@gewoon-even.nl',passo:'FA7_SENT'})).s,403); process.env.VERCEL_ENV='preview';
// segunda corrida no mesmo dia com marcas gravadas nao reenvia
contactos[0].attributes.FA6_SENT=new Date().toISOString().slice(0,10); contactos[2].attributes.FA7_SENT=new Date().toISOString().slice(0,10);
chamadas=[]; await run({}, {'user-agent':'vercel-cron/1.0'}); assert.equal(chamadas.filter(c=>c.url.endsWith('/smtp/email')).length,0);
// segredo derivado quando nao ha UNSUB_SECRET
delete process.env.UNSUB_SECRET; const A=await import(repo+'_assinatura.js'); assert.equal(A.segredoDescadastro().length,64); process.env.UNSUB_SECRET='us';
// uitschrijven
const { default: u } = await import(repo+'uitschrijven.js');
const { assinar } = await import(repo+'_assinatura.js');
const runU=async(q,method)=>{let out={};const res={status(s){out.s=s;return this},setHeader(){return this},send(b){out.b=b;return this},end(){return this}};await u({query:q,method},res);return out;};
assert.equal((await runU({e:'a@b.nl',t:'errado'},'GET')).s,400);
chamadas=[]; let g=await runU({e:'a@b.nl',t:assinar('a@b.nl','us')},'GET'); assert.equal(g.s,200); assert.match(g.b,/Ja, schrijf me uit/); assert.equal(chamadas.length,0);
chamadas=[]; let p=await runU({e:'a@b.nl',t:assinar('a@b.nl','us')},'POST'); assert.equal(p.s,200); assert.match(p.b,/uitgeschreven/); assert.deepEqual(chamadas[0].corpo,{emailBlacklisted:true});
console.log('handler e descadastro: todos os testes passaram');
