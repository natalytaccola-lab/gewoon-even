// POST /api/checkout  { produto, email?, ref?, ad? }  ->  { clientSecret, id, retorno }
//
// Cria uma sessao de Checkout embutida (o formulario de pagamento aparece no
// proprio gewoon-even.nl, sem ir para buy.stripe.com). A forma de pagamento
// fica guardada no cliente para o upsell de um clique (api/upsell.js); o
// Checkout mostra a propria pessoa o aviso de que ela fica guardada.
//
// iDEAL e Bancontact so' ficam reutilizaveis com o Debito SEPA ativo na conta.
// Enquanto nao estiver, a Stripe recusa a sessao com esse pedido: tenta-se de
// novo guardando so' o cartao, e o iDEAL continua a funcionar para a compra.
import Stripe from 'stripe';

// Trocavel nos testes (scripts/testes/checkout.test.mjs).
export const deps = { Stripe };
import { PRODUTOS, BUMP, BASE_SITE, precoDe, emailValido, refValido } from './_produtos.js';
import { tecnicoDoPedido } from './_meta-capi.js';

const METODOS = ['card', 'ideal', 'bancontact', 'paypal', 'link'];

function parametros({ chave, preco, precoBump, email, ref, ad, guardarBanco, tecnico }) {
  const p = PRODUTOS[chave];
  const guardar = { setup_future_usage: 'off_session' };
  return {
    ui_mode: 'embedded_page',
    mode: 'payment',
    locale: 'nl',
    line_items: [{ price: preco, quantity: 1 }],
    // Order bump: a caixinha "toevoegen" da Stripe, desmarcada por defeito.
    ...(precoBump ? { optional_items: [{ price: precoBump, quantity: 1 }] } : {}),
    payment_method_types: METODOS,
    payment_method_options: guardarBanco
      ? { card: guardar, ideal: guardar, bancontact: guardar }
      : { card: guardar },
    customer_creation: 'always',
    ...(emailValido(email) ? { customer_email: email } : {}),
    ...(refValido(ref) ? { client_reference_id: ref } : {}),
    // ck=1: o site confirma o pagamento antes de mostrar "pago" (a Stripe volta
    // a este endereco tambem quando a pessoa cancela no banco).
    return_url: `${BASE_SITE}/?sid={CHECKOUT_SESSION_ID}&ck=1${p.retorno}`,
    redirect_on_completion: 'if_required',
    // IP e navegador so' de quem aceitou os cookies (ref "ge1..."): vao para a
    // Meta junto com a compra, para ela ligar a compra ao anuncio.
    metadata: {
      ge_produto: chave,
      ...(ad ? { ge_ad: ad } : {}),
      ...(tecnico && tecnico.ip ? { ge_ip: tecnico.ip.slice(0, 64) } : {}),
      ...(tecnico && tecnico.ua ? { ge_ua: tecnico.ua.slice(0, 400) } : {})
    },
    payment_intent_data: { metadata: { ge_produto: chave } }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const segredo = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!segredo) return res.status(503).json({ ok: false, erro: 'stripe_env_missing' });

  const { produto, email, ref, ad } = req.body || {};
  if (!Object.prototype.hasOwnProperty.call(PRODUTOS, produto)) return res.status(400).json({ ok: false, erro: 'produto' });
  const adLimpo = String(ad || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

  const consentiu = refValido(ref) && /^ge1(_|$)/.test(ref);
  const tecnico = consentiu ? tecnicoDoPedido(req) : null;

  const stripe = new deps.Stripe(segredo);
  try {
    const preco = await precoDe(stripe, produto);
    // Sem o preco do bump, o checkout segue sem ele: nunca bloqueia a venda principal.
    let precoBump = null;
    if (BUMP[produto]) {
      try { precoBump = await precoDe(stripe, BUMP[produto]); }
      catch (e) { console.warn('[checkout] bump sem preco:', e.message); }
    }
    // Tentativas por ordem: tudo; sem guardar iDEAL/Bancontact; e, se o bump
    // for o problema, sem ele. A venda principal nunca fica presa ao bump.
    const tentativas = [{ guardarBanco: true, precoBump }, { guardarBanco: false, precoBump }];
    if (precoBump) tentativas.push({ guardarBanco: false, precoBump: null });
    let sessao, erro;
    for (const t of tentativas) {
      try {
        sessao = await stripe.checkout.sessions.create(parametros({ chave: produto, preco, email, ref, ad: adLimpo, tecnico, ...t }));
        break;
      } catch (e) {
        erro = e;
        console.warn('[checkout] tentativa falhou', JSON.stringify({ guardarBanco: t.guardarBanco, bump: !!t.precoBump }), e.message);
      }
    }
    if (!sessao) throw erro;
    return res.status(200).json({ ok: true, clientSecret: sessao.client_secret, id: sessao.id, retorno: PRODUTOS[produto].retorno });
  } catch (e) {
    console.error('[checkout] falhou', produto, e.type || '', e.code || '', e.message, e.detail && (e.detail.message || e.detail.code || String(e.detail)));
    return res.status(502).json({ ok: false, erro: 'stripe' });
  }
}
