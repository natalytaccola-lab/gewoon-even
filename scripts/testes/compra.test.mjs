// processarCompra (o miolo do webhook), com o Brevo e a Meta simulados.
import assert from 'node:assert/strict';
import { processarCompra } from '../../api/_compra.js';

let chamadas = [];
let contacto = null;           // atributos guardados no "Brevo"
let existe = true;
globalThis.fetch = async (url, o = {}) => {
  const corpo = o.body ? JSON.parse(o.body) : null;
  chamadas.push({ url: String(url), metodo: o.method || 'GET', corpo });
  const r = (status, json) => ({ ok: status < 300, status, text: async () => JSON.stringify(json || {}), json: async () => json || {} });
  if (String(url).includes('graph.facebook.com')) return r(200, { events_received: 1 });
  if (String(url).includes('/smtp/email')) return r(201, { messageId: 'm1' });
  if ((o.method || 'GET') === 'GET' && String(url).includes('/contacts/')) return existe ? r(200, { attributes: contacto || {} }) : r(404, {});
  if (o.method === 'PUT') {
    if (!existe) return r(404, {});
    contacto = { ...(contacto || {}), ...(corpo.attributes || {}) };
    return r(204);
  }
  if (o.method === 'POST' && String(url).endsWith('/contacts')) { existe = true; contacto = { ...corpo.attributes }; return r(201, { id: 9 }); }
  return r(200, {});
};
process.env.META_CAPI_TOKEN = 'tok';

const base = { brevoApiKey: 'b', brevoBuyersListId: '6', customerEmail: 'a@b.nl' };
const sessao = (id, valor, extra = {}) => ({ id, amount_total: valor, currency: 'eur', payment_status: 'paid', client_reference_id: 'ge1', ...extra });

// compra nova de €17: contacto marcado, entrega enviada, marca gravada, CAPI enviada
let r = await processarCompra({ ...base, session: sessao('cs_live_1', 1700) });
assert.equal(r.status, 200);
assert.equal(contacto.HAS_NP, true); assert.equal(contacto.LAST_PRODUCT_NAME, 'Noodprotocol');
assert.equal(contacto.NP_MAIL_SENT, 'cs_live_1');
assert.equal(chamadas.filter(c => c.url.includes('/smtp/email')).length, 1);
assert.equal(chamadas.filter(c => c.url.includes('graph.facebook.com')).length, 1);

// o mesmo evento outra vez: nao reenvia
chamadas = [];
r = await processarCompra({ ...base, session: sessao('cs_live_1', 1700) });
assert.equal(r.body.skipped, 'duplicate');
assert.equal(chamadas.filter(c => c.url.includes('/smtp/email')).length, 0);

// upsell de um clique (id pi_): €37 entregue com marca propria
chamadas = [];
r = await processarCompra({ ...base, session: sessao('pi_1', 3700) });
assert.equal(contacto.HAS_P7D, true); assert.equal(contacto.P7D_MAIL_SENT, 'pi_1'); assert.equal(contacto.HAS_NP, true);

// pagamento por confirmar: grava contacto, nao entrega, nao manda a Meta
chamadas = [];
r = await processarCompra({ ...base, session: sessao('cs_live_2', 6700, { payment_status: 'unpaid' }) });
assert.equal(chamadas.filter(c => c.url.includes('/smtp/email')).length, 0);
assert.equal(chamadas.filter(c => c.url.includes('graph.facebook.com')).length, 0);

// contacto que nao existe: e' criado
existe = false; contacto = null; chamadas = [];
r = await processarCompra({ ...base, customerEmail: 'novo@x.nl', session: sessao('cs_live_3', 900) });
assert.equal(r.body.action, 'created'); assert.equal(contacto.HAS_CK, true);

// order bump: EUR 26 = Noodprotocol + Crisiskaart. Os dois marcados, as duas
// entregas, uma so' Purchase com o valor total.
existe = true; contacto = {}; chamadas = [];
r = await processarCompra({ ...base, customerEmail: 'bump@x.nl', session: sessao('cs_live_5', 2600) });
assert.equal(r.status, 200); assert.equal(r.body.email_sent, true);
assert.equal(contacto.HAS_NP, true); assert.equal(contacto.HAS_CK, true);
assert.equal(contacto.LAST_PRODUCT_NAME, 'Noodprotocol'); assert.equal(contacto.LAST_PURCHASE_AMOUNT, 26);
assert.equal(contacto.NP_MAIL_SENT, 'cs_live_5'); assert.equal(contacto.CK_MAIL_SENT, 'cs_live_5');
assert.deepEqual(chamadas.filter(c => c.url.includes('/smtp/email')).map(c => c.corpo.templateId), [62, 64]);
const capi = chamadas.filter(c => c.url.includes('graph.facebook.com'));
assert.equal(capi.length, 1);
assert.equal(capi[0].corpo.data[0].custom_data.value, 26);

// repeticao do mesmo evento: nenhuma das duas sai outra vez
chamadas = [];
r = await processarCompra({ ...base, customerEmail: 'bump@x.nl', session: sessao('cs_live_5', 2600) });
assert.equal(r.body.skipped, 'duplicate');

// so' uma das duas tinha saido: a repeticao envia so' a que falta
delete contacto.CK_MAIL_SENT; chamadas = [];
r = await processarCompra({ ...base, customerEmail: 'bump@x.nl', session: sessao('cs_live_5', 2600) });
assert.deepEqual(chamadas.filter(c => c.url.includes('/smtp/email')).map(c => c.corpo.templateId), [64]);

// valor desconhecido
r = await processarCompra({ ...base, session: sessao('cs_live_4', 1234) });
assert.equal(r.body.error, 'unknown_product');
console.log('compra: ok');
