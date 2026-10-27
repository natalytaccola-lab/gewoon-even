// Checkout embutido e upsell de um clique, com a Stripe simulada.
import assert from 'node:assert/strict';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.BREVO_API_KEY = 'b';
process.env.BREVO_BUYERS_LIST_ID = '6';

const checkout = await import('../../api/checkout.js');
const upsell = await import('../../api/upsell.js');

function resp() {
  return { s: 0, j: null, status(c) { this.s = c; return this; }, json(o) { this.j = o; return this; } };
}
const agora = () => Math.floor(Date.now() / 1000);

// --- Stripe falsa -----------------------------------------------------------
let estado;
function novaStripe() {
  estado = {
    criadas: [], pis: [], recusarBanco: false, cobrancaFalha: null,
    sessoes: {
      cs_live_np: { id: 'cs_live_np', livemode: true, payment_status: 'paid', created: agora() - 60, amount_total: 1700,
        metadata: { ge_produto: 'np' }, customer: 'cus_1', customer_details: { email: 'a@b.nl' }, client_reference_id: 'ge1',
        payment_intent: { payment_method: 'pm_ideal', latest_charge: { payment_method_details: { ideal: { generated_sepa_debit: 'pm_sepa' } } } } },
      cs_live_cartao: { id: 'cs_live_cartao', livemode: true, payment_status: 'paid', created: agora() - 60, amount_total: 1700,
        metadata: { ge_produto: 'np' }, customer: 'cus_2', customer_details: { email: 'c@d.nl' }, client_reference_id: null,
        payment_intent: { payment_method: 'pm_card', latest_charge: { payment_method_details: { card: {} } } } },
      cs_live_antiga: { id: 'cs_live_antiga', livemode: true, payment_status: 'paid', created: agora() - 60, amount_total: 1700,
        metadata: {}, customer: null, customer_details: { email: 'e@f.nl' },
        payment_intent: { payment_method: 'pm_x', latest_charge: { payment_method_details: { ideal: {} } } } },
      cs_live_bump: { id: 'cs_live_bump', livemode: true, payment_status: 'paid', created: agora() - 60, amount_total: 2600,
        metadata: {}, customer: 'cus_4', customer_details: { email: 'i@j.nl' }, client_reference_id: null,
        payment_intent: { payment_method: 'pm_card', latest_charge: { payment_method_details: { card: {} } } } },
      cs_live_velha: { id: 'cs_live_velha', livemode: true, payment_status: 'paid', created: agora() - 5 * 3600, amount_total: 1700,
        metadata: { ge_produto: 'np' }, customer: 'cus_3', customer_details: { email: 'g@h.nl' },
        payment_intent: { payment_method: 'pm_card', latest_charge: { payment_method_details: { card: {} } } } }
    },
    pisGuardados: {}
  };
  return class {
    constructor() {
      this.paymentLinks = { listLineItems: async (id) => {
        const valores = { plink_1TONsUAqip58UYzss1VqvTEE: 1700, plink_1Twj9OAqip58UYzsN0MaOzuM: 3700, plink_1TwOREAqip58UYzsKopbSzg: 6700, plink_1TONwAAqip58UYzsNk83iMUv: 900 };
        return { data: [{ price: { id: 'price_' + valores[id], unit_amount: valores[id], currency: 'eur' } }] };
      } };
      this.checkout = { sessions: {
        create: async (p) => {
          if (estado.recusarBanco && p.payment_method_options.ideal) throw new Error('sepa_debit must be activated');
          if (estado.recusarBump && p.optional_items) throw new Error('optional_items not supported');
          estado.criadas.push(p); return { id: 'cs_live_nova', client_secret: 'seg_1' };
        },
        retrieve: async (id) => { const s = estado.sessoes[id]; if (!s) throw new Error('nao existe'); return s; }
      } };
      this.paymentIntents = {
        create: async (p, o) => {
          if (estado.cobrancaFalha) { const e = new Error('x'); e.code = estado.cobrancaFalha; throw e; }
          const pi = { id: 'pi_' + p.metadata.ge_produto + (estado.pis.length + 1), status: p.payment_method === 'pm_sepa' ? 'processing' : 'succeeded', livemode: true, metadata: p.metadata };
          estado.pis.push({ p, o }); estado.pisGuardados[pi.id] = pi; return pi;
        },
        retrieve: async (id) => estado.pisGuardados[id]
      };
    }
  };
}
let compras = [];
checkout.deps.Stripe = upsell.deps.Stripe = novaStripe();
upsell.deps.processarCompra = async (a) => { compras.push(a); return { status: 200, body: { ok: true } }; };

// --- /api/checkout ----------------------------------------------------------
let r = resp();
await checkout.default({ method: 'POST', body: { produto: 'np', email: 'a@b.nl', ref: 'ge1_fb-1-2-3', ad: 'a3<x>' } }, r);
assert.equal(r.s, 200); assert.equal(r.j.clientSecret, 'seg_1'); assert.equal(r.j.retorno, '#betaald-np-17ypqz');
let p = estado.criadas[0];
assert.equal(p.ui_mode, 'embedded_page'); assert.equal(p.redirect_on_completion, 'if_required');
assert.deepEqual(p.line_items, [{ price: 'price_1700', quantity: 1 }]);
assert.equal(p.customer_email, 'a@b.nl'); assert.equal(p.client_reference_id, 'ge1_fb-1-2-3');
assert.equal(p.metadata.ge_produto, 'np'); assert.equal(p.metadata.ge_ad, 'a3x');
assert.equal(p.return_url, 'https://gewoon-even.nl/?sid={CHECKOUT_SESSION_ID}&ck=1#betaald-np-17ypqz');
assert.equal(p.payment_method_options.ideal.setup_future_usage, 'off_session');
assert.ok(!p.payment_method_types.includes('sepa_debit'), 'SEPA nunca aparece como opcao');
// order bump: a Crisiskaart como item opcional, so' no Noodprotocol
assert.deepEqual(p.optional_items, [{ price: 'price_900', quantity: 1 }]);

// a Stripe recusa o bump: o checkout segue sem ele
estado.recusarBump = true; r = resp();
await checkout.default({ method: 'POST', body: { produto: 'np' } }, r);
assert.equal(r.s, 200); assert.ok(!('optional_items' in estado.criadas.at(-1)));
estado.recusarBump = false;

// sem SEPA na conta: tenta de novo guardando so' o cartao
estado.recusarBanco = true; r = resp();
await checkout.default({ method: 'POST', body: { produto: 'p7', email: 'lixo', ref: 'cs_live_x' } }, r);
assert.equal(r.s, 200);
p = estado.criadas.at(-1);
assert.ok(!p.payment_method_options.ideal); assert.ok(p.payment_method_options.card);
assert.ok(!('customer_email' in p)); assert.ok(!('client_reference_id' in p));
assert.ok(!('optional_items' in p), 'o 7 Dagen nao tem bump');
estado.recusarBanco = false;

r = resp(); await checkout.default({ method: 'POST', body: { produto: 'xx' } }, r); assert.equal(r.s, 400);

// IP e navegador so' com consentimento (ref ge1...)
const cab = { 'x-forwarded-for': '81.2.3.4, 10.0.0.1', 'user-agent': 'Mozilla/5.0' };
r = resp(); await checkout.default({ method: 'POST', headers: cab, body: { produto: 'np', ref: 'ge1' } }, r);
p = estado.criadas.at(-1); assert.equal(p.metadata.ge_ip, '81.2.3.4'); assert.equal(p.metadata.ge_ua, 'Mozilla/5.0');
r = resp(); await checkout.default({ method: 'POST', headers: cab, body: { produto: 'np' } }, r);
p = estado.criadas.at(-1); assert.ok(!('ge_ip' in p.metadata)); assert.ok(!('ge_ua' in p.metadata));

// --- /api/upsell ------------------------------------------------------------
const up = async (body) => { const x = resp(); await upsell.default({ method: 'POST', body }, x); return x; };

// Payment Link com bump (EUR 26, sem metadata): a cadeia continua a do Noodprotocol
compras = []; r = await up({ sid: 'cs_live_bump', produto: 'p7' });
assert.equal(r.j.ok, true);

// iDEAL -> SEPA gerado, entrega ja' (processing)
compras = []; r = await up({ sid: 'cs_live_np', produto: 'p7' });
assert.equal(r.j.ok, true); assert.equal(r.j.retorno, '#betaald-p7-di0vtq'); assert.equal(r.j.estado, 'processing');
let pi = estado.pis.at(-1);
assert.equal(pi.p.payment_method, 'pm_sepa'); assert.equal(pi.p.amount, 3700); assert.equal(pi.p.off_session, true);
assert.equal(pi.p.customer, 'cus_1'); assert.equal(pi.o.idempotencyKey, 'upsell-cs_live_np-p7');
assert.equal(compras[0].customerEmail, 'a@b.nl'); assert.equal(compras[0].session.amount_total, 3700);
assert.equal(compras[0].session.client_reference_id, 'ge1');

// encadeado: depois do p7 (pi_), o slaap com a mesma origem
const piP7 = r.j.id;
r = await up({ sid: piP7, produto: 'slaap' });
assert.equal(r.j.ok, true); assert.equal(estado.pis.at(-1).o.idempotencyKey, 'upsell-cs_live_np-slaap');
// depois do p7 nao se volta a vender o p7
r = await up({ sid: piP7, produto: 'p7' }); assert.equal(r.j.fallback, true);

// cartao
r = await up({ sid: 'cs_live_cartao', produto: 'slaap' });
assert.equal(r.j.ok, true); assert.equal(estado.pis.at(-1).p.payment_method, 'pm_card');

// 3-D Secure pedido: checkout normal
estado.cobrancaFalha = 'authentication_required';
r = await up({ sid: 'cs_live_cartao', produto: 'p7' }); assert.equal(r.j.fallback, true);
estado.cobrancaFalha = null;

// sessao antiga de Payment Link (sem cliente), janela passada, fora da cadeia, sid invalido
assert.equal((await up({ sid: 'cs_live_antiga', produto: 'p7' })).j.fallback, true);
assert.equal((await up({ sid: 'cs_live_velha', produto: 'p7' })).j.fallback, true);
assert.equal((await up({ sid: 'cs_live_np', produto: 'ck' })).j.fallback, true);
assert.equal((await up({ sid: 'cs_test_np', produto: 'p7' })).j.fallback, true);
assert.equal((await up({ sid: 'cs_live_nao_existe', produto: 'p7' })).j.fallback, true);

// so' verificar: diz se da' para um clique, sem cobrar
const antes = estado.pis.length;
r = await up({ sid: 'cs_live_cartao', produto: 'p7', apenasVerificar: true });
assert.equal(r.j.podeUmClique, true); assert.equal(estado.pis.length, antes);
r = await up({ sid: 'cs_live_antiga', produto: 'p7', apenasVerificar: true });
assert.equal(r.j.fallback, true);
console.log('checkout + upsell: ok');

// --- /api/sessao ------------------------------------------------------------
const sessaoApi = await import('../../api/sessao.js');
sessaoApi.deps.Stripe = class { constructor() { this.checkout = { sessions: { retrieve: async (id) =>
  id === 'cs_live_aberta' ? { status: 'open', client_secret: 'seg_aberta' } : { status: 'complete', client_secret: 'nao_expor', amount_total: 2600 } } }; } };
const sv = async (sid) => { const x = { s: 0, j: null, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.s = c; return this; }, json(o) { this.j = o; return this; } }; await sessaoApi.default({ query: { sid } }, x); return x; };
let sr = await sv('cs_live_aberta'); assert.equal(sr.j.status, 'open'); assert.equal(sr.j.clientSecret, 'seg_aberta');
sr = await sv('cs_live_paga'); assert.equal(sr.j.status, 'complete'); assert.ok(!('clientSecret' in sr.j)); assert.equal(sr.j.valor, 2600);
sr = await sv('cs_live_aberta'); assert.ok(!('valor' in sr.j));
sr = await sv('pi_x'); assert.equal(sr.s, 400);
console.log('sessao: ok');
