// Tudo o que acontece depois de um pagamento confirmado pela Stripe: marca o
// contacto no Brevo, envia o e-mail de entrega (com deduplicacao) e manda o
// Purchase pela Conversions API. Usado pelo webhook (checkout.session.*) e pelo
// upsell de um clique (api/upsell.js), que cobra sem passar por uma sessao.
//
// `session` so' precisa de: id, amount_total, currency, payment_status,
// client_reference_id. No upsell, o id e' o do PaymentIntent.
import { enviarCompraMeta } from './_meta-capi.js';
import { PRODUTOS, produtosPorValor } from './_produtos.js';

// Identifica produto pelo amount_total (em cents)
// Retorna objeto com nome do attribute Brevo a setar como true + tag legível.
export function getProductInfo(amountTotal) {
  if (amountTotal === 900)  return { attr: 'HAS_CK',    tag: 'BUYER_CK',    name: 'Crisiskaart' };
  if (amountTotal === 1700) return { attr: 'HAS_NP',    tag: 'BUYER_NP',    name: 'Noodprotocol' };
  if (amountTotal === 3700) return { attr: 'HAS_P7D',   tag: 'BUYER_P7D',   name: 'Protocol 7 Dagen' };
  if (amountTotal === 6700) return { attr: 'HAS_SLAAP', tag: 'BUYER_SLAAP', name: 'Slaapprotocol' };
  return null;
}

// Os produtos de uma compra pelo valor pago, cada um com a info acima. Com o
// order bump (Noodprotocol + Crisiskaart = EUR 26) vem uma lista de dois, o
// principal primeiro. Valor desconhecido: lista vazia.
export function produtosDaCompra(amountTotal) {
  return produtosPorValor(amountTotal).map(k => ({ valor: PRODUTOS[k].valor, ...getProductInfo(PRODUTOS[k].valor) }));
}

// ---------------------------------------------------------------------------
// Entrega por e-mail transacional, por valor pago. Remetente
// hello@gewoon-even.nl em todos (vem do próprio modelo no Brevo).
//
// Deduplicação: o Stripe pode entregar o mesmo evento mais de uma vez. Cada
// produto tem a SUA marca no contacto, que guarda o session.id do envio feito
// — assim a entrega de um produto não bloqueia a de outro comprado pela mesma
// pessoa. A marca NUNCA entra no PUT principal: vai sempre num PUT separado,
// depois de o e-mail ter saído, para que uma falha dela não possa quebrar a
// gravação do contacto.
// ---------------------------------------------------------------------------

// IDs dos modelos transacionais do Brevo. 0 significa "modelo ainda não
// existe": nesse caso o webhook grava o contacto, registra no log e devolve
// 200 SEM enviar e SEM erro — exactamente o que fazia antes desta tabela.
// Preencher à medida que os modelos forem criados no painel do Brevo.
const NP_TEMPLATE_ID    = 62;  // "Entrega Noodprotocol (v7 onda transparente)"
const P7D_TEMPLATE_ID   = 80;  // "Entrega Protocol 7 Dagen (v9 Eén)"
const CK_TEMPLATE_ID    = 64;  // "Entrega Crisiskaart (v7 onda transparente)"
const SLAAP_TEMPLATE_ID = 65;  // "Entrega Slaapprotocol (v7 onda transparente)"

const NP_ACCESS_URL = 'https://gewoon-even.nl/#toegang-np-8f3k2m';
const NP_UPSELL_URL = 'https://gewoon-even.nl/#upsell-p7-6h2mk9';

// Tabela de entrega por amount_total (em cents). Um valor que não esteja aqui
// não tem entrega por e-mail nenhuma: o contacto é gravado e o webhook sai.
//
// Nota sobre o UPSELL_URL: só o Noodprotocol o tem. Um upsell do Slaapprotocol
// por e-mail NÃO pode usar #upsell2-slaap-7n4kx9, porque esse hash mostra a
// faixa "Protocol van 7 Dagen is bevestigd" a quem não o comprou — precisa de
// um hash próprio. Até esse hash existir, os três modelos novos só levam o
// ACCESS_URL.
//
// As marcas NP_MAIL_SENT, P7D_MAIL_SENT, CK_MAIL_SENT e SLAAP_MAIL_SENT
// existem como atributos de texto no Brevo: depois de enviar, o webhook grava
// a marca no contacto, e um evento repetido do Stripe nao volta a enviar o
// e-mail.
const DELIVERY = {
  1700: {
    label: 'NP Mail',
    templateId: NP_TEMPLATE_ID,
    sentAttr: 'NP_MAIL_SENT',
    errorCode: 'np_email_failed',
    params: { ACCESS_URL: NP_ACCESS_URL, UPSELL_URL: NP_UPSELL_URL }
  },
  3700: {
    label: 'P7D Mail',
    templateId: P7D_TEMPLATE_ID,
    sentAttr: 'P7D_MAIL_SENT',
    errorCode: 'p7d_email_failed',
    params: { ACCESS_URL: 'https://gewoon-even.nl/#toegang-p7-4x9nw' }
  },
  900: {
    label: 'CK Mail',
    templateId: CK_TEMPLATE_ID,
    sentAttr: 'CK_MAIL_SENT',
    errorCode: 'ck_email_failed',
    params: { ACCESS_URL: 'https://gewoon-even.nl/#toegang-ck-2j7mp' }
  },
  6700: {
    label: 'SLAAP Mail',
    templateId: SLAAP_TEMPLATE_ID,
    sentAttr: 'SLAAP_MAIL_SENT',
    errorCode: 'slaap_email_failed',
    params: { ACCESS_URL: 'https://gewoon-even.nl/#toegang-sl-9m3kx7' }
  }
};

// Lê a marca de entrega do contacto (entrega.sentAttr). Devolve a string
// gravada, ou null quando não há marca. 404, erro de API e exceção contam
// todos como "não enviado" — na dúvida enviamos, porque não entregar é pior
// que duplicar.
async function readMailSent(email, sessionId, apiKey, entrega) {
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
      console.error(`[${entrega.label}] session ${sessionId} contact read error ${response.status}: ${errorBody} — treating as not sent`);
      return null;
    }

    const data = await response.json();
    return data?.attributes?.[entrega.sentAttr] || null;

  } catch (error) {
    console.error(`[${entrega.label}] session ${sessionId} contact read exception: ${error.message} — treating as not sent`);
    return null;
  }
}

// Envia o e-mail de entrega. Lança em caso de falha; quem chama decide o status.
async function sendDeliveryEmail(email, apiKey, entrega) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      to: [{ email }],
      templateId: entrega.templateId,
      params: entrega.params
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo smtp/email ${response.status}: ${errorBody}`);
  }
}

// Grava a marca de entrega = session.id num PUT isolado. Lança em caso de falha.
async function markMailSent(email, sessionId, apiKey, entrega) {
  const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      attributes: { [entrega.sentAttr]: sessionId }
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
async function deliverProduct(email, sessionId, apiKey, baseBody, entrega) {
  try {
    await sendDeliveryEmail(email, apiKey, entrega);
  } catch (error) {
    // Marca não gravada ⇒ a repetição do Stripe volta a tentar o envio.
    console.error(`[${entrega.label}] session ${sessionId} SEND FAILED: ${error.message} — returning 500 so Stripe retries`);
    return {
      status: 500,
      body: { ...baseBody, ok: false, error: entrega.errorCode, email_sent: false }
    };
  }

  console.log(`[${entrega.label}] session ${sessionId} sent template ${entrega.templateId}`);

  try {
    await markMailSent(email, sessionId, apiKey, entrega);
  } catch (error) {
    // O e-mail já saiu. 200 para o Stripe não repetir: repetir duplicaria o
    // e-mail, que é pior do que ficar sem a marca.
    console.error(`[${entrega.label}] session ${sessionId} MARK FAILED: ${error.message} — email WAS sent; a Stripe retry would duplicate it`);
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


// Entrega de varios produtos da mesma compra (order bump). Cada produto tem a
// sua marca, por isso, se um falhar, a repeticao da Stripe so' reenvia esse.
// Com um so' produto devolve exactamente o que o deliverProduct devolve.
async function deliverAll(email, sessionId, apiKey, baseBody, entregas) {
  if (entregas.length === 1) return deliverProduct(email, sessionId, apiKey, baseBody, entregas[0]);
  const resultados = [];
  for (const entrega of entregas) {
    resultados.push({ label: entrega.label, ...(await deliverProduct(email, sessionId, apiKey, baseBody, entrega)) });
  }
  const falhou = resultados.some(r => r.status >= 500);
  return {
    status: falhou ? 500 : 200,
    body: {
      ...baseBody,
      ...(falhou ? { ok: false, error: resultados.find(r => r.status >= 500).body.error } : {}),
      email_sent: resultados.every(r => r.body.email_sent),
      entregas: resultados.map(r => ({ label: r.label, email_sent: !!r.body.email_sent, ...(r.body.mark_failed ? { mark_failed: true } : {}) }))
    }
  };
}

export async function processarCompra({ session, customerEmail, brevoApiKey, brevoBuyersListId, eventType }) {
  const R = (status, body) => ({ status, body });
  // 3. Identificar produto
  const itens = produtosDaCompra(session.amount_total);
  const product = itens[0] || null;
  const nomeCompra = itens.map(i => i.name).join(' + ');
  if (!product) {
    console.error(`[Stripe Webhook] Unknown amount_total: ${session.amount_total} for ${customerEmail}`);
    return R(200, { ok: false, error: 'unknown_product', amount: session.amount_total });
  }

  const amountPaid = (session.amount_total / 100).toFixed(2);
  const currency = session.currency?.toUpperCase() || 'EUR';

  console.log(`[Stripe Webhook] Mapped: ${nomeCompra} (${itens.map(i => i.attr + '=true').join(', ')}, ${product.tag}) for €${amountPaid} — event=${eventType || 'upsell'}, payment_status=${session.payment_status}`);

  // 3b. Deduplicação do e-mail de entrega.
  // Lê a marca ANTES de gravar o contacto, porque a gravação é idempotente e
  // não distingue um evento novo de uma repetição do mesmo evento.
  // Estrito: so 'paid'. Um 'unpaid' (pagamento atrasado ainda por confirmar) ou
  // um 'no_payment_required' (cupao de 100%) grava o contacto como sempre, mas
  // nao dispara a entrega. A entrega vem depois, no async_payment_succeeded.
  const entregas = itens.map(i => DELIVERY[i.valor]).filter(Boolean);
  const pago = session.payment_status === 'paid';

  // Purchase para a Meta pelo servidor, so' com pagamento confirmado e so' para
  // quem aceitou os cookies (ver _meta-capi.js). Repetir o mesmo session.id nao
  // conta duas vezes: a Meta deduplica pelo event_id.
  if (pago) {
    const capi = await enviarCompraMeta({
      sessionId: session.id,
      clientReferenceId: session.client_reference_id,
      email: customerEmail,
      valor: amountPaid,
      moeda: currency,
      produto: nomeCompra,
      cliente: session.customer_details,
      tecnico: { ip: session.metadata && session.metadata.ge_ip, ua: session.metadata && session.metadata.ge_ua }
    });
    console.log(`[Meta CAPI] session ${session.id}: ${JSON.stringify(capi)}`);
  }

  for (const entrega of entregas) {
    if (!pago) {
      console.log(`[${entrega.label}] session ${session.id} payment_status=${session.payment_status} — contact saved, delivery deferred`);
    } else if (entrega.templateId === 0) {
      // Modelo por criar: grava o contacto e sai em 200, sem enviar e sem erro.
      console.log(`[${entrega.label}] session ${session.id} templateId=0 — modelo ainda não criado no Brevo, nada enviado`);
    }
  }

  const aEntregar = pago ? entregas.filter(e => e.templateId !== 0) : [];
  const pendentes = [];
  for (const entrega of aEntregar) {
    const mailSent = await readMailSent(customerEmail, session.id, brevoApiKey, entrega);
    if (mailSent && mailSent === session.id) {
      console.log(`[${entrega.label}] session ${session.id} duplicate event — already delivered, skipping`);
    } else {
      pendentes.push(entrega);
    }
  }
  if (aEntregar.length && !pendentes.length) {
    return R(200, {
      ok: true,
      skipped: 'duplicate',
      email: customerEmail,
      session: session.id
    });
  }
  const vaiEntregar = pendentes.length > 0;

  // 4. Build attributes payload — aditivo: só seta o boolean do produto comprado
  // Brevo PUT/POST com partial attributes não destrói outros, apenas atualiza os enviados.
  const today = new Date().toISOString().split('T')[0];
  const attributes = {
    ...Object.fromEntries(itens.map(i => [i.attr, true])),
    BUYER_STATUS: product.tag,            // backward compat com legacy automations
    LAST_PURCHASE_DATE: today,
    LAST_PURCHASE_AMOUNT: parseFloat(amountPaid),
    // So' o principal: e' o nome que as automacoes do Brevo conhecem.
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
        return R(200, { ok: false, error: 'brevo_create_failed' });
      }

      console.log(`[Stripe Webhook] Created ${customerEmail} with ${product.attr}=true`);

      const createdBody = {
        ok: true,
        email: customerEmail,
        product: product.name,
        attribute_set: product.attr,
        action: 'created'
      };

      if (!vaiEntregar) {
        return R(200, createdBody);
      }

      // 6. Contacto gravado. Só agora o e-mail de entrega.
      const createdOutcome = await deliverAll(customerEmail, session.id, brevoApiKey, createdBody, pendentes);
      return createdOutcome;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Stripe Webhook] Brevo update error:', response.status, errorBody);
      return R(200, { ok: false, error: 'brevo_update_failed' });
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

    if (!vaiEntregar) {
      return R(200, updatedBody);
    }

    // 6. Contacto gravado. Só agora o e-mail de entrega.
    const updatedOutcome = await deliverAll(customerEmail, session.id, brevoApiKey, updatedBody, pendentes);
    return updatedOutcome;

  } catch (error) {
    console.error('[Stripe Webhook] Network error:', error.message);
    return R(200, { ok: false, error: 'network_error' });
  }
}
