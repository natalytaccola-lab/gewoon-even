// Webhook do Stripe que escuta checkout.session.completed
// Modelo aditivo: marca o boolean HAS_<PRODUCT> do contato no Brevo sem sobrescrever outros.
// Permite cliente ter combinações (NP, NP+P7D, NP+CK, etc) sem perder histórico.

import Stripe from 'stripe';

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

// Identifica produto pelo amount_total (em cents)
// Retorna objeto com nome do attribute Brevo a setar como true + tag legível.
function getProductInfo(amountTotal) {
  if (amountTotal === 900)  return { attr: 'HAS_CK',    tag: 'BUYER_CK',    name: 'Crisiskaart' };
  if (amountTotal === 1700) return { attr: 'HAS_NP',    tag: 'BUYER_NP',    name: 'Innerlijk Noodplan' };
  if (amountTotal === 3700) return { attr: 'HAS_P7D',   tag: 'BUYER_P7D',   name: '7-dagen herijking' };
  if (amountTotal === 6700) return { attr: 'HAS_SLAAP', tag: 'BUYER_SLAAP', name: 'Slaapprotocol' };
  return null;
}

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

  if (!brevoApiKey || !brevoBuyersListId) {
    console.log('[Stripe Webhook] Brevo env vars not configured, skipping tagging');
    return res.status(200).json({ ok: true, noop: true, reason: 'brevo_env_missing', email: customerEmail });
  }

  // 3. Identificar produto
  const product = getProductInfo(session.amount_total);
  if (!product) {
    console.error(`[Stripe Webhook] Unknown amount_total: ${session.amount_total} for ${customerEmail}`);
    return res.status(200).json({ ok: false, error: 'unknown_product', amount: session.amount_total });
  }

  const amountPaid = (session.amount_total / 100).toFixed(2);
  const currency = session.currency?.toUpperCase() || 'EUR';

  console.log(`[Stripe Webhook] Mapped: ${product.name} (${product.attr}=true, ${product.tag}) for €${amountPaid}`);

  // 4. Build attributes payload — aditivo: só seta o boolean do produto comprado
  // Brevo PUT/POST com partial attributes não destrói outros, apenas atualiza os enviados.
  const today = new Date().toISOString().split('T')[0];
  const attributes = {
    [product.attr]: true,
    BUYER_STATUS: product.tag,            // backward compat com legacy automations
    LAST_PURCHASE_DATE: today,
    LAST_PURCHASE_AMOUNT: parseFloat(amountPaid),
    LAST_PRODUCT_NAME: product.name
  };

  // 5. Atualizar contato no Brevo (PUT) — se 404, cria via POST com updateEnabled
  try {
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(customerEmail)}`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        attributes,
        listIds: [parseInt(brevoBuyersListId, 10)]
      })
    });

    // Se contato não existe (404), cria com POST
    if (response.status === 404) {
      const createResponse = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          email: customerEmail,
          attributes,
          listIds: [parseInt(brevoBuyersListId, 10)],
          updateEnabled: true
        })
      });

      if (!createResponse.ok) {
        const errorBody = await createResponse.text();
        console.error('[Stripe Webhook] Brevo create error:', createResponse.status, errorBody);
        return res.status(200).json({ ok: false, error: 'brevo_create_failed' });
      }

      console.log(`[Stripe Webhook] Created ${customerEmail} with ${product.attr}=true`);
      return res.status(200).json({
        ok: true,
        email: customerEmail,
        product: product.name,
        attribute_set: product.attr,
        action: 'created'
      });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Stripe Webhook] Brevo update error:', response.status, errorBody);
      return res.status(200).json({ ok: false, error: 'brevo_update_failed' });
    }

    console.log(`[Stripe Webhook] Updated ${customerEmail}: ${product.attr}=true (€${amountPaid})`);
    return res.status(200).json({
      ok: true,
      email: customerEmail,
      product: product.name,
      attribute_set: product.attr,
      amount: amountPaid,
      action: 'updated'
    });

  } catch (error) {
    console.error('[Stripe Webhook] Network error:', error.message);
    return res.status(200).json({ ok: false, error: 'network_error' });
  }
}
