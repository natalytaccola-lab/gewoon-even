// O webhook de ponta a ponta: assinatura real da Stripe (gerada no teste) ate' ao Brevo simulado.
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { Readable } from 'node:stream';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_teste';
process.env.BREVO_API_KEY = 'b';
process.env.BREVO_BUYERS_LIST_ID = '6';
delete process.env.META_CAPI_TOKEN;
let chamadas = [];
globalThis.fetch = async (url, o = {}) => {
  chamadas.push({ url: String(url), metodo: o.method || 'GET' });
  const r = (s, j) => ({ ok: s < 300, status: s, text: async () => '{}', json: async () => j || {} });
  if ((o.method || 'GET') === 'GET') return r(200, { attributes: {} });
  return r(o.method === 'PUT' ? 204 : 201, {});
};
const { default: handler } = await import('../../api/stripe-webhook.js');
const evento = { id: 'evt_1', type: 'checkout.session.completed', livemode: true, data: { object: {
  id: 'cs_live_w', amount_total: 1700, currency: 'eur', payment_status: 'paid', customer_details: { email: 'w@x.nl' }, client_reference_id: null } } };
const corpo = JSON.stringify(evento);
const assinatura = new Stripe('sk_test_x').webhooks.generateTestHeaderString({ payload: corpo, secret: 'whsec_teste' });
const req = Object.assign(Readable.from([Buffer.from(corpo)]), { method: 'POST', headers: { 'stripe-signature': assinatura } });
const res = { s: 0, j: null, status(c) { this.s = c; return this; }, json(o) { this.j = o; return this; } };
await handler(req, res);
assert.equal(res.s, 200, JSON.stringify(res.j));
assert.equal(res.j.email_sent, true);
assert.ok(chamadas.some(c => c.url.includes('/smtp/email')));
// assinatura errada
const req2 = Object.assign(Readable.from([Buffer.from(corpo)]), { method: 'POST', headers: { 'stripe-signature': 't=1,v1=errada' } });
const res2 = { ...res, s: 0 }; await handler(req2, res2); assert.equal(res2.s, 400);
console.log('webhook: ok');
