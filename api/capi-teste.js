// Teste da Conversions API: GET /api/capi-teste?code=TEST12345
// Envia um Purchase de teste com o test_event_code do Gestor de Eventos
// (aba "Test events"). Eventos de teste so' aparecem nessa aba e nao contam
// para campanhas nem relatorios. Sem codigo de teste valido, nao envia nada.
import { montarEvento } from './_meta-capi.js';

const PIXEL = process.env.META_PIXEL_ID || '1770865190673375';

export default async function handler(req, res) {
  const code = String((req.query && req.query.code) || '');
  if (!/^TEST[A-Z0-9]{2,12}$/.test(code)) return res.status(400).json({ ok: false, erro: 'code de teste invalido' });
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(503).json({ ok: false, erro: 'META_CAPI_TOKEN em falta' });
  const evento = montarEvento({
    sessionId: 'teste-' + Date.now(), email: 'hello@gewoon-even.nl', valor: '17.00', moeda: 'EUR',
    produto: 'Noodprotocol', consentimento: { fbp: null, fbc: null }
  });
  const r = await fetch(`https://graph.facebook.com/v25.0/${PIXEL}/events?access_token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: [evento], test_event_code: code }),
    signal: AbortSignal.timeout(6000)
  });
  const corpo = await r.json().catch(() => null);
  return res.status(200).json({ ok: r.ok, status: r.status, meta: corpo });
}
