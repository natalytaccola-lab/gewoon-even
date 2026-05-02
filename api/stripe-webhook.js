// Webhook do Stripe que escuta checkout.session.completed
// e taggeia o comprador no Brevo como buyer (com produto específico)
// Modo defensivo: noop se env vars não configuradas

import Stripe from 'stripe';

// Vercel precisa raw body pra signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper pra ler raw body do request stream
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Mapeia Payment Link IDs ou Product Names pra tags Brevo
// Ajustar conforme produtos reais do Stripe
function getProductTag(session) {
  const amount = session.amount_total; // em cents

  // Mapping por valor (mais robusto que IDs específicos)
  if (amount === 900) return 'buyer_crisiskaart';
  if (amount === 1700) return 'buyer_noodprotocol';
  if (amount === 2700) return 'buyer_noodprotocol'; // novo preço futuro
  if (amount === 3700) return 'buyer_protocol7';
  if (amount === 4700) return 'buyer_protocol7'; // novo preço futuro

  return 'buyer_unknown'; // fallback
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoListId = process.env.BREVO_LIST_ID;

  // Modo noop se env vars críticas faltarem
  if (!stripeSecret || !webhookSecret) {
    console.log('[Stripe Webhook] Stripe env vars not configured, skipping');
    return res.status(200).json({ ok: true, noop: true, reason: 'stripe_env_missing' });
  }

  const stripe = new Stripe(stripeSecret);

  // 1. Verificar signature (proteção contra webhook fake)
  let event;
  try {
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'];

    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // 2. Processar apenas checkout.session.completed
  if (event.type !== 'checkout.session.completed') {
    console.log(`[Stripe Webhook] Ignoring event type: ${event.type}`);
    return res.status(200).json({ ok: true, ignored: true });
  }

  const session = event.data.object;
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    console.error('[Stripe Webhook] No customer email found in session');
    return res.status(200).json({ ok: false, error: 'no_email' });
  }

  // 3. Modo noop se Brevo não configurado
  if (!brevoApiKey || !brevoListId) {
    console.log('[Stripe Webhook] Brevo env vars not configured, skipping tagging');
    return res.status(200).json({ ok: true, noop: true, reason: 'brevo_env_missing', email: customerEmail });
  }

  // 4. Identificar produto comprado e gerar tag
  const productTag = getProductTag(session);
  const amountPaid = (session.amount_total / 100).toFixed(2);
  const currency = session.currency?.toUpperCase() || 'EUR';

  // 5. Atualizar contato no Brevo com atributos de buyer
  try {
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(customerEmail)}`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        attributes: {
          BUYER_STATUS: 'active',
          LAST_PURCHASE_DATE: new Date().toISOString(),
          LAST_PURCHASE_AMOUNT: amountPaid,
          LAST_PURCHASE_CURRENCY: currency,
          LAST_PRODUCT_TAG: productTag
        },
        listIds: [parseInt(brevoListId, 10)]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Stripe Webhook] Brevo update error:', response.status, errorBody);
      // Retorna 200 mesmo em erro pra Stripe não retentar
      return res.status(200).json({ ok: false, error: 'brevo_update_failed' });
    }

    console.log(`[Stripe Webhook] Tagged ${customerEmail} as ${productTag} (€${amountPaid})`);
    return res.status(200).json({
      ok: true,
      email: customerEmail,
      tag: productTag,
      amount: amountPaid
    });

  } catch (error) {
    console.error('[Stripe Webhook] Network error:', error);
    return res.status(200).json({ ok: false, error: 'network_error' });
  }
}
