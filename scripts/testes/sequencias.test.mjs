import assert from 'node:assert/strict';
const repo=new URL('../../api/', import.meta.url).href;
const { SEQUENCIAS, proximoPasso } = await import(repo+'_sequencias.js');
const { assinar, confere, linkDescadastro } = await import(repo+'_assinatura.js');
const seq=SEQUENCIAS[0];
const hoje=new Date('2026-11-20T08:00:00Z');
const base={email:'a@b.nl',emailBlacklisted:false,listUnsubscribed:[],attributes:{SOURCE:'quiz_completed',SIGNUP_DATE:'2026-11-04T12:00:00.000Z'}};
const c=(attrs={},extra={})=>({...base,...extra,attributes:{...base.attributes,...attrs}});
// dia 16 -> passo 6
assert.equal(proximoPasso(seq,c(),3,hoje).passo.marca,'FA6_SENT');
// dia 15 -> nada
assert.equal(proximoPasso(seq,c(),3,new Date('2026-11-19T08:00:00Z')).passo,null);
// comprou
assert.equal(proximoPasso(seq,c({HAS_NP:true}),3,hoje).passo,null);
// blacklist / descadastrado
assert.equal(proximoPasso(seq,c({},{emailBlacklisted:true}),3,hoje).passo,null);
assert.equal(proximoPasso(seq,c({},{listUnsubscribed:[3]}),3,hoje).passo,null);
// antes do lancamento
assert.equal(proximoPasso(seq,c({SIGNUP_DATE:'2026-10-20'}),3,hoje).passo,null);
// funil B nao entra
assert.equal(proximoPasso(seq,c({SOURCE:'quiz_37'}),3,hoje).passo,null);
// sem SOURCE nem SIGNUP_DATE (atributos que o Brevo descartava): usa createdAt
assert.equal(proximoPasso(seq,{email:'z@b.nl',createdAt:'2026-11-04T09:00:00.000+01:00',attributes:{}},3,hoje).passo.marca,'FA6_SENT');
assert.equal(proximoPasso(seq,{email:'z@b.nl',createdAt:'2026-10-01T09:00:00.000+01:00',attributes:{}},3,hoje).passo,null);
// 6 enviado hoje -> 7 ainda nao
assert.equal(proximoPasso(seq,c({FA6_SENT:'2026-11-20'}),3,hoje).passo,null);
// dia 19 e 6 enviado ha 3 dias -> 7
assert.equal(proximoPasso(seq,c({FA6_SENT:'2026-11-20'}),3,new Date('2026-11-23T08:00:00Z')).passo.marca,'FA7_SENT');
// 6 enviado atrasado (dia 20): 7 espera 3 dias
assert.equal(proximoPasso(seq,c({FA6_SENT:'2026-11-24'}),3,new Date('2026-11-25T08:00:00Z')).passo,null);
assert.equal(proximoPasso(seq,c({FA6_SENT:'2026-11-24'}),3,new Date('2026-11-27T08:00:00Z')).passo.marca,'FA7_SENT');
// completa
assert.equal(proximoPasso(seq,c({FA6_SENT:'2026-11-20',FA7_SENT:'2026-11-23'}),3,new Date('2026-12-30T08:00:00Z')).passo,null);
// SIGNUP_DATE como data simples
assert.equal(proximoPasso(seq,c({SIGNUP_DATE:'2026-11-04'}),3,hoje).passo.marca,'FA6_SENT');
// assinatura
const t=assinar('A@B.nl','s'); assert.ok(confere('a@b.nl',t,'s')); assert.ok(!confere('x@b.nl',t,'s')); assert.ok(!confere('a@b.nl',t,'outro'));
assert.match(linkDescadastro('https://gewoon-even.nl','a@b.nl','s'),/\/api\/uitschrijven\?e=a%40b\.nl&t=[0-9a-f]{32}$/);
console.log('todos os testes passaram');
