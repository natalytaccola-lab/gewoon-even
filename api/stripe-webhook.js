// Webhook do Stripe que escuta checkout.session.completed
// Modelo aditivo: marca o boolean HAS_<PRODUCT> do contato no Brevo sem sobrescrever outros.
// Permite cliente ter combinações (NP, NP+P7D, NP+CK, etc) sem perder histórico.

import Stripe from 'stripe';
import { processarCompra } from './_compra.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Tipos de evento do Stripe tratados. O checkout.session.completed de um metodo
// de notificacao atrasada chega com payment_status 'unpaid'; a confirmacao vem
// depois no async_payment_succeeded, com o MESMO session.id — o que faz a marca
// NP_MAIL_SENT funcionar tambem entre tipos de evento diferentes.
// checkout.session.async_payment_failed fica deliberadamente de fora.
const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoBuyersListId = process.env.BREVO_BUYERS_LIST_ID;

  if (!stripeSecret || !webhookSecret) {
    console.log('[Stripe Webhook] Stripe env vars not configured, skipping');
    return res.status(200).json({ ok: true, noop: true, reason: 'stripe_env_missing' });
  }

  const stripe = new Stripe(stripeSecret);

  // 1. Verificar signature
  let event;
  try {
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // 2. Skip TEST mode events (livemode=false) pra não poluir Brevo de produção
  if (event.livemode === false) {
    console.log(`[Stripe Webhook] TEST mode event (type=${event.type}, id=${event.id}) — skipping Brevo`);
    return res.status(200).json({ ok: true, noop: true, reason: 'test_mode_skipped', livemode: false });
  }

  // Dois tipos tratados: o checkout normal e a confirmacao de um pagamento de
  // notificacao atrasada. O async_payment_failed continua ignorado de proposito.
  if (!HANDLED_EVENTS.includes(event.type)) {
    console.log(`[Stripe Webhook] Ignoring event type: ${event.type}`);
    return res.status(200).json({ ok: true, ignored: true });
  }

  const session = event.data.object;
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    console.error('[Stripe Webhook] No customer email found in session');
    return res.status(200).json({ ok: false, error: 'no_email' });
  }

  if (!brevoApiKey || !brevoBuyersListId) {
    console.log('[Stripe Webhook] Brevo env vars not configured, skipping tagging');
    return res.status(200).json({ ok: true, noop: true, reason: 'brevo_env_missing', email: customerEmail });
  }

  const resultado = await processarCompra({ session, customerEmail, brevoApiKey, brevoBuyersListId, eventType: event.type });
  return res.status(resultado.status).json(resultado.body);
}
