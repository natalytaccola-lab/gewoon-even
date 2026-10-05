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

// ---------------------------------------------------------------------------
// Entrega do Noodprotocol (amount_total = 1700) por e-mail transacional.
// Modelo transacional Brevo ID 9 ("Entrega Noodprotocol"), remetente
// hello@gewoon-even.nl. Usa params.ACCESS_URL e params.UPSELL_URL.
//
// Deduplicação: o Stripe pode entregar o mesmo evento mais de uma vez. A marca
// NP_MAIL_SENT no contacto guarda o session.id do envio feito. NUNCA entra no
// PUT principal — vai sempre num PUT separado, depois de o e-mail ter saído,
// para que uma falha dela não possa quebrar a gravação do contacto.
// ---------------------------------------------------------------------------

// Tipos de evento do Stripe tratados. O checkout.session.completed de um metodo
// de notificacao atrasada chega com payment_status 'unpaid'; a confirmacao vem
// depois no async_payment_succeeded, com o MESMO session.id — o que faz a marca
// NP_MAIL_SENT funcionar tambem entre tipos de evento diferentes.
// checkout.session.async_payment_failed fica deliberadamente de fora.
const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded'
];

const NP_TEMPLATE_ID = 9;
const NP_ACCESS_URL = 'https://gewoon-even.nl/#toegang-np-8f3k2m';
const NP_UPSELL_URL = 'https://gewoon-even.nl/#upsell-p7-6h2mk9';

// Lê a marca NP_MAIL_SENT do contacto. Devolve a string gravada, ou null
// quando não há marca. 404, erro de API e exceção contam todos como
// "não enviado" — na dúvida enviamos, porque não entregar é pior que duplicar.
async function readNpMailSent(email, sessionId, apiKey) {
  try {
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[NP Mail] session ${sessionId} contact read error ${response.status}: ${errorBody} — treating as not sent`);
      return null;
    }

    const data = await response.json();
    return data?.attributes?.NP_MAIL_SENT || null;

  } catch (error) {
    console.error(`[NP Mail] session ${sessionId} contact read exception: ${error.message} — treating as not sent`);
    return null;
  }
}

// Envia o e-mail de entrega. Lança em caso de falha; quem chama decide o status.
async function sendNpDeliveryEmail(email, apiKey) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      to: [{ email }],
      templateId: NP_TEMPLATE_ID,
      params: {
        ACCESS_URL: NP_ACCESS_URL,
        UPSELL_URL: NP_UPSELL_URL
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo smtp/email ${response.status}: ${errorBody}`);
  }
}

// Grava NP_MAIL_SENT = session.id num PUT isolado. Lança em caso de falha.
async function markNpMailSent(email, sessionId, apiKey) {
  const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      attributes: { NP_MAIL_SENT: sessionId }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo mark ${response.status}: ${errorBody}`);
  }
}

// Orquestra envio + marca. Corre sempre DEPOIS de o contacto estar gravado,
// por isso nada aqui pode desfazer essa gravação. Nunca lança: devolve
// { status, body } para a resposta ao Stripe.
async function deliverNoodprotocol(email, sessionId, apiKey, baseBody) {
  try {
    await sendNpDeliveryEmail(email, apiKey);
  } catch (error) {
    // Marca não gravada ⇒ a repetição do Stripe volta a tentar o envio.
    console.error(`[NP Mail] session ${sessionId} SEND FAILED: ${error.message} — returning 500 so Stripe retries`);
    return {
      status: 500,
      body: { ...baseBody, ok: false, error: 'np_email_failed', email_sent: false }
    };
  }

  console.log(`[NP Mail] session ${sessionId} sent template ${NP_TEMPLATE_ID}`);

  try {
    await markNpMailSent(email, sessionId, apiKey);
  } catch (error) {
    // O e-mail já saiu. 200 para o Stripe não repetir: repetir duplicaria o
    // e-mail, que é pior do que ficar sem a marca.
    console.error(`[NP Mail] session ${sessionId} MARK FAILED: ${error.message} — email WAS sent; a Stripe retry would duplicate it`);
    return {
      status: 200,
      body: { ...baseBody, email_sent: true, mark_failed: true }
    };
  }

  return {
    status: 200,
    body: { ...baseBody, email_sent: true }
  };
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

  // 3. Identificar produto
  const product = getProductInfo(session.amount_total);
  if (!product) {
    console.error(`[Stripe Webhook] Unknown amount_total: ${session.amount_total} for ${customerEmail}`);
    return res.status(200).json({ ok: false, error: 'unknown_product', amount: session.amount_total });
  }

  const amountPaid = (session.amount_total / 100).toFixed(2);
  const currency = session.currency?.toUpperCase() || 'EUR';

  console.log(`[Stripe Webhook] Mapped: ${product.name} (${product.attr}=true, ${product.tag}) for €${amountPaid} — event=${event.type}, payment_status=${session.payment_status}`);

  // 3b. Noodprotocol: deduplicação do e-mail de entrega.
  // Lê a marca ANTES de gravar o contacto, porque a gravação é idempotente e
  // não distingue um evento novo de uma repetição do mesmo evento.
  // Estrito: so 'paid'. Um 'unpaid' (pagamento atrasado ainda por confirmar) ou
  // um 'no_payment_required' (cupao de 100%) grava o contacto como sempre, mas
  // nao dispara a entrega. A entrega vem depois, no async_payment_succeeded.
  const isNoodprotocol = session.amount_total === 1700 && session.payment_status === 'paid';
  if (session.amount_total === 1700 && !isNoodprotocol) {
    console.log(`[NP Mail] session ${session.id} payment_status=${session.payment_status} — contact saved, delivery deferred`);
  }

  if (isNoodprotocol) {
    const npMailSent = await readNpMailSent(customerEmail, session.id, brevoApiKey);
    if (npMailSent && npMailSent === session.id) {
      console.log(`[NP Mail] session ${session.id} duplicate event — already delivered, skipping`);
      return res.status(200).json({
        ok: true,
        skipped: 'duplicate',
        email: customerEmail,
        session: session.id
      });
    }
  }

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

      const createdBody = {
        ok: true,
        email: customerEmail,
        product: product.name,
        attribute_set: product.attr,
        action: 'created'
      };

      if (!isNoodprotocol) {
        return res.status(200).json(createdBody);
      }

      // 6. Contacto gravado. Só agora o e-mail de entrega.
      const createdOutcome = await deliverNoodprotocol(customerEmail, session.id, brevoApiKey, createdBody);
      return res.status(createdOutcome.status).json(createdOutcome.body);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Stripe Webhook] Brevo update error:', response.status, errorBody);
      return res.status(200).json({ ok: false, error: 'brevo_update_failed' });
    }

    console.log(`[Stripe Webhook] Updated ${customerEmail}: ${product.attr}=true (€${amountPaid})`);

    const updatedBody = {
      ok: true,
      email: customerEmail,
      product: product.name,
      attribute_set: product.attr,
      amount: amountPaid,
      action: 'updated'
    };

    if (!isNoodprotocol) {
      return res.status(200).json(updatedBody);
    }

    // 6. Contacto gravado. Só agora o e-mail de entrega.
    const updatedOutcome = await deliverNoodprotocol(customerEmail, session.id, brevoApiKey, updatedBody);
    return res.status(updatedOutcome.status).json(updatedOutcome.body);

  } catch (error) {
    console.error('[Stripe Webhook] Network error:', error.message);
    return res.status(200).json({ ok: false, error: 'network_error' });
  }
}
