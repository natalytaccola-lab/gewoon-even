import assert from 'node:assert/strict';
import { lerConsentimento, montarEvento } from '../../api/_meta-capi.js';

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
console.log('meta-capi: ok');
