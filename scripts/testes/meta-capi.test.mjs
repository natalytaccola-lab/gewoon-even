import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { lerConsentimento, montarEvento, montarLead, tecnicoDoPedido, enviarLeadMeta } from '../../api/_meta-capi.js';

// sem prefixo = sem consentimento
assert.equal(lerConsentimento(null), null);
assert.equal(lerConsentimento(''), null);
assert.equal(lerConsentimento('cs_live_abc'), null);
assert.equal(lerConsentimento('ge10'), null);

// so' o consentimento
assert.deepEqual(lerConsentimento('ge1'), { fbp: null, fbc: null });

// fbp
assert.deepEqual(lerConsentimento('ge1_fb-1-1778272237523-62514790761830454'),
  { fbp: 'fb.1.1778272237523.62514790761830454', fbc: null });

// fbp + fbc, com '-' e '_' dentro do fbclid
assert.deepEqual(lerConsentimento('ge1_fb-1-1778272237523-6251_fb-1-1792770000000-IwAR0a_b-C_d'),
  { fbp: 'fb.1.1778272237523.6251', fbc: 'fb.1.1792770000000.IwAR0a_b-C_d' });

// lixo no lugar do fbp nao passa, mas o consentimento conta
assert.deepEqual(lerConsentimento('ge1_qualquercoisa'), { fbp: null, fbc: null });

// evento
const ev = montarEvento({ sessionId: 'cs_live_x', email: ' Hello@Gewoon-Even.nl ', valor: '17.00', moeda: 'EUR',
  produto: 'Noodprotocol', consentimento: { fbp: 'fb.1.1.2', fbc: null }, agora: 1792770000000 });
assert.equal(ev.event_id, 'cs_live_x');
assert.equal(ev.event_time, 1792770000);
assert.equal(ev.custom_data.value, 17);
assert.equal(ev.user_data.em[0].length, 64);
assert.equal(ev.user_data.fbp, 'fb.1.1.2');
assert.ok(!('fbc' in ev.user_data));
assert.equal(ev.user_data.external_id[0], ev.user_data.em[0]);
assert.equal(ev.custom_data.order_id, 'cs_live_x');
assert.ok(!('client_ip_address' in ev.user_data));

// com os dados da Stripe e do pedido
const ev2 = montarEvento({ sessionId: 'cs_live_y', email: 'a@b.nl', valor: '17.00', moeda: 'EUR', produto: 'Noodprotocol',
  consentimento: { fbp: null, fbc: null },
  cliente: { name: 'Anna de  Vries', phone: '+31 6 1234 5678', address: { country: 'NL', postal_code: '1234 AB' } },
  tecnico: { ip: '81.2.3.4', ua: 'Mozilla/5.0' } });
const h = v => crypto.createHash('sha256').update(v).digest('hex');
assert.equal(ev2.user_data.fn[0], h('anna'));
assert.equal(ev2.user_data.ln[0], h('vries'));
assert.equal(ev2.user_data.ph[0], h('31612345678'));
assert.equal(ev2.user_data.country[0], h('nl'));
assert.equal(ev2.user_data.zp[0], h('1234ab'));
assert.equal(ev2.user_data.client_ip_address, '81.2.3.4');
assert.equal(ev2.user_data.client_user_agent, 'Mozilla/5.0');

// so' um nome: sem apelido; telefone curto: fora
const ev3 = montarEvento({ sessionId: 'x', email: 'a@b.nl', valor: 1, moeda: 'EUR', produto: 'p', consentimento: {},
  cliente: { name: 'Anna', phone: '123' } });
assert.ok(ev3.user_data.fn && !ev3.user_data.ln && !ev3.user_data.ph);

// IP do pedido
assert.deepEqual(tecnicoDoPedido({ headers: { 'x-forwarded-for': '81.2.3.4, 10.0.0.1', 'user-agent': 'UA' } }), { ip: '81.2.3.4', ua: 'UA' });
assert.deepEqual(tecnicoDoPedido({ headers: {} }), { ip: null, ua: null });

// Lead
const lead = montarLead({ eventId: 'lead-abc123-xyz', email: 'a@b.nl', conteudo: 'Quiz Completed', consentimento: { fbp: 'fb.1.1.2' }, tecnico: { ip: '1.1.1.1', ua: 'UA' } });
assert.equal(lead.event_name, 'Lead'); assert.equal(lead.event_id, 'lead-abc123-xyz');
assert.equal(lead.user_data.fbp, 'fb.1.1.2'); assert.equal(lead.user_data.client_ip_address, '1.1.1.1');

// envio do Lead: sem consentimento ou sem id nao sai nada
process.env.META_CAPI_TOKEN = 'tok';
let pedidos = [];
globalThis.fetch = async (u, o) => { pedidos.push(JSON.parse(o.body)); return { ok: true, text: async () => '{"events_received":1}' }; };
assert.equal((await enviarLeadMeta({ eventId: 'lead-abc123-xyz', email: 'a@b.nl', ref: '' })).motivo, 'sem_consentimento');
assert.equal((await enviarLeadMeta({ eventId: 'lixo', email: 'a@b.nl', ref: 'ge1' })).motivo, 'sem_event_id');
assert.equal(pedidos.length, 0);
assert.equal((await enviarLeadMeta({ eventId: 'lead-abc123-xyz', email: 'a@b.nl', ref: 'ge1', conteudo: 'Quiz Completed', tecnico: {} })).enviado, true);
assert.equal(pedidos[0].data[0].event_name, 'Lead');
console.log('meta-capi: ok');
