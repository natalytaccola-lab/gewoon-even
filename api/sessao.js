// GET /api/sessao?sid=cs_live_...  ->  { status, valor?, clientSecret? }
// Usado no retorno do checkout embutido (iDEAL/Bancontact): a Stripe devolve a
// pessoa ao site tambem quando ela cancela no banco, por isso o site pergunta
// aqui se a sessao ficou paga antes de mostrar "Betaling gelukt".
//   complete -> pago (ou a confirmar pelo banco, como nos Payment Links)
//   open     -> nao pago: devolve o client_secret para reabrir o mesmo checkout
//   expired  -> nada a fazer
import Stripe from 'stripe';

export const deps = { Stripe };

export default async function handler(req, res) {
  const sid = String((req.query && req.query.sid) || '');
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sid)) return res.status(400).json({ ok: false });
  const segredo = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!segredo) return res.status(503).json({ ok: false });
  try {
    const s = await new deps.Stripe(segredo).checkout.sessions.retrieve(sid);
    res.setHeader('cache-control', 'no-store');
    return res.status(200).json({
      ok: true,
      status: s.status,
      // Valor pago (centimos), para o Purchase do navegador levar o mesmo valor
      // que o webhook manda a Meta quando ha' order bump (EUR 17 ou EUR 26).
      ...(s.status === 'complete' && Number.isInteger(s.amount_total) ? { valor: s.amount_total } : {}),
      ...(s.status === 'open' && s.client_secret ? { clientSecret: s.client_secret } : {})
    });
  } catch (e) {
    console.error('[sessao]', e.message);
    return res.status(200).json({ ok: false, status: 'desconhecido' });
  }
}
