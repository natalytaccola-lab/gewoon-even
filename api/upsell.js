// POST /api/upsell  { sid, produto }  ->  { ok, id, retorno } | { ok:false, fallback:true }
//
// Upsell de um clique: cobra o produto seguinte com a forma de pagamento da
// compra que a pessoa acabou de fazer, sem novo formulario.
//
// Regras (qualquer falha => fallback: o site abre o checkout embutido normal):
//  - `sid` e' a sessao de Checkout da compra anterior (cs_live_...) ou o
//    PaymentIntent de um upsell anterior desta mesma cadeia (pi_...);
//  - a compra anterior tem de estar paga, em modo real, e ter menos de
//    JANELA_UPSELL_MS;
//  - so' produtos da cadeia (PRODUTOS[x].depois) e cada um uma so' vez por
//    sessao de origem (chave de idempotencia na Stripe);
//  - o cartao que pedir autenticacao (3-D Secure) cai no checkout normal.
//
// Depois de cobrado, faz o mesmo que o webhook: Brevo, entrega e Conversions
// API (processarCompra), porque um PaymentIntent destes nao gera sessao de
// Checkout e por isso nao passa pelo webhook.
import Stripe from 'stripe';

// Trocavel nos testes (scripts/testes/checkout.test.mjs).
export const deps = { Stripe, processarCompra: processarCompraReal };
import { PRODUTOS, JANELA_UPSELL_MS, produtoPorValor } from './_produtos.js';
import { processarCompra as processarCompraReal } from './_compra.js';

const recusa = (res, motivo) => {
  console.log('[upsell] fallback:', motivo);
  return res.status(200).json({ ok: false, fallback: true, motivo });
};

// A forma de pagamento reutilizavel: o cartao, ou o debito SEPA que a Stripe
// gera a partir de um iDEAL/Bancontact.
function metodoReutilizavel(pi) {
  const ch = pi && pi.latest_charge;
  const d = ch && ch.payment_method_details;
  if (d && d.ideal && d.ideal.generated_sepa_debit) return d.ideal.generated_sepa_debit;
  if (d && d.bancontact && d.bancontact.generated_sepa_debit) return d.bancontact.generated_sepa_debit;
  if (d && d.card) return typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method && pi.payment_method.id;
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const segredo = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!segredo) return recusa(res, 'stripe_env_missing');

  const { sid, produto } = req.body || {};
  if (!Object.prototype.hasOwnProperty.call(PRODUTOS, produto)) return res.status(400).json({ ok: false, erro: 'produto' });
  if (typeof sid !== 'string' || !/^(cs_live|pi)_[A-Za-z0-9]+$/.test(sid)) return recusa(res, 'sid');

  const stripe = new deps.Stripe(segredo);
  try {
    // De onde vem a cadeia: a sessao original, e o ultimo produto comprado nela.
    let sessaoId = sid;
    let ultimo = null;
    if (sid.startsWith('pi_')) {
      const anterior = await stripe.paymentIntents.retrieve(sid);
      if (!anterior.livemode || !['succeeded', 'processing'].includes(anterior.status)) return recusa(res, 'pi_anterior');
      sessaoId = anterior.metadata && anterior.metadata.origem_sid;
      ultimo = anterior.metadata && anterior.metadata.ge_produto;
      if (!sessaoId) return recusa(res, 'pi_sem_origem');
    }

    const sessao = await stripe.checkout.sessions.retrieve(sessaoId, {
      expand: ['payment_intent', 'payment_intent.latest_charge']
    });
    if (!sessao.livemode || sessao.payment_status !== 'paid') return recusa(res, 'sessao_nao_paga');
    if (Date.now() - sessao.created * 1000 > JANELA_UPSELL_MS) return recusa(res, 'janela');
    if (!ultimo) ultimo = (sessao.metadata && sessao.metadata.ge_produto) || produtoPorValor(sessao.amount_total);
    if (!ultimo || !PRODUTOS[ultimo].depois.includes(produto)) return recusa(res, 'fora_da_cadeia');

    const cliente = sessao.customer;
    const metodo = metodoReutilizavel(sessao.payment_intent);
    const email = sessao.customer_details && sessao.customer_details.email;
    if (!cliente || !metodo || !email) return recusa(res, 'sem_metodo_guardado');

    const p = PRODUTOS[produto];
    let pi;
    try {
      pi = await stripe.paymentIntents.create({
        amount: p.valor,
        currency: 'eur',
        customer: typeof cliente === 'string' ? cliente : cliente.id,
        payment_method: metodo,
        off_session: true,
        confirm: true,
        description: `Gewoon Even — ${p.nome}`,
        receipt_email: email,
        metadata: { ge_produto: produto, origem_sid: sessao.id, upsell: 'um_clique' }
      }, { idempotencyKey: `upsell-${sessao.id}-${produto}` });
    } catch (e) {
      // authentication_required, cartao recusado, etc.: a pessoa paga no checkout normal.
      return recusa(res, `cobranca: ${e.code || e.message}`);
    }
    if (!['succeeded', 'processing'].includes(pi.status)) return recusa(res, `estado_${pi.status}`);

    // SEPA fica em 'processing' alguns dias; entrega-se ja' (produto digital).
    const resultado = await deps.processarCompra({
      session: { id: pi.id, amount_total: p.valor, currency: 'eur', payment_status: 'paid', client_reference_id: sessao.client_reference_id },
      customerEmail: email,
      brevoApiKey: process.env.BREVO_API_KEY,
      brevoBuyersListId: process.env.BREVO_BUYERS_LIST_ID
    });
    console.log('[upsell] cobrado', produto, pi.id, pi.status, JSON.stringify(resultado.body));
    return res.status(200).json({ ok: true, id: pi.id, retorno: p.retorno, estado: pi.status });
  } catch (e) {
    console.error('[upsell] erro', e.message);
    return recusa(res, 'erro');
  }
}
