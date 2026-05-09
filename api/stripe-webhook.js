// Webhook do Stripe que escuta checkout.session.completed
// e taggeia o comprador no Brevo na lista Buyers com tag específica do produto
// Modo defensivo: noop se env vars não configuradas

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

// Identifica produto pelo nome do produto Stripe (mais robusto que description)
function getProductTag(productName) {
  if (!productName) return 'BUYER_UNKNOWN';

  const name = productName.toLowerCase();

  if (name.includes('noodprotocol')) return 'BUYER_NP';
  if (name.includes('protocol 7 dagen') || name.includes('protocol7') || name.includes('p7d')) return 'BUYER_P7D';
  if (name.includes('crisiskaart')) return 'BUYER_CK';
  if (name.includes('slaapprotocol')) return 'BUYER_SLAAP';

  return 'BUYER_UNKNOWN';
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

  // 2. Buscar line_items COM expand do produto para pegar o nome real
  let productName = '';
  try {
    const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 10,
      expand: ['data.price.product']
    });
    const firstItem = lineItemsResponse.data[0];
    productName = firstItem?.price?.product?.name || firstItem?.description || '';
    console.log(`[Stripe Webhook] Product name detected: "${productName}"`);
  } catch (err) {
    console.error('[Stripe Webhook] Failed to fetch line items:', err.message);
  }

  const productTag = getProductTag(productName);
  const amountPaid = (session.amount_total / 100).toFixed(2);
  const currency = session.currency?.toUpperCase() || 'EUR';

  console.log(`[Stripe Webhook] Mapped tag: ${productTag} for product: "${productName}"`);

  // 3. Atualizar contato no Brevo
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
          BUYER_STATUS: productTag,
          LAST_PURCHASE_DATE: new Date().toISOString().split('T')[0]
        },
        listIds: [parseInt(brevoBuyersListId, 10)]
      })
    });

    // Se contato não existe, criar
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
          attributes: {
            BUYER_STATUS: productTag,
            LAST_PURCHASE_DATE: new Date().toISOString().split('T')[0]
          },
          listIds: [parseInt(brevoBuyersListId, 10)],
          updateEnabled: true
        })
      });

      if (!createResponse.ok) {
        const errorBody = await createResponse.text();
        console.error('[Stripe Webhook] Brevo create error:', createResponse.status, errorBody);
        return res.status(200).json({ ok: false, error: 'brevo_create_failed' });
      }

      console.log(`[Stripe Webhook] Created ${customerEmail} as ${productTag}`);
      return res.status(200).json({ ok: true, email: customerEmail, tag: productTag, productName, action: 'created' });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Stripe Webhook] Brevo update error:', response.status, errorBody);
      return res.status(200).json({ ok: false, error: 'brevo_update_failed' });
    }

    console.log(`[Stripe Webhook] Tagged ${customerEmail} as ${productTag} (€${amountPaid})`);
    return res.status(200).json({
      ok: true,
      email: customerEmail,
      tag: productTag,
      productName,
      amount: amountPaid,
      action: 'updated'
    });

  } catch (error) {
    console.error('[Stripe Webhook] Network error:', error);
    return res.status(200).json({ ok: false, error: 'network_error' });
  }
}
