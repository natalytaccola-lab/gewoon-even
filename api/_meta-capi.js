// Purchase pela Conversions API da Meta, enviado pelo webhook da Stripe.
//
// Porque: o pixel no navegador perde compras (iPhone, bloqueadores, quem fecha
// a aba antes do retorno). O servidor ve todas. A Meta junta os dois eventos
// pelo mesmo event_id (o session.id da Stripe, que o pixel tambem usa como
// eventID em registarCompra) e conta a compra uma vez so'.
//
// Consentimento (RGPD): so' se envia quando a pessoa aceitou os cookies no
// site. O site acrescenta ao link da Stripe client_reference_id = "ge1" e,
// se existirem, os cookies _fbp e _fbc codificados (a Stripe so' aceita
// letras, numeros, '-' e '_'). Sem esse prefixo nao sai nada para a Meta.
//
//   ge1                      -> aceitou, sem cookies da Meta ainda
//   ge1_<fbp>                -> fbp com '.' trocado por '-'
//   ge1_<fbp>_<fbc>          -> fbc idem nos 3 primeiros pontos; o fbclid fica intacto
//
// Env: META_CAPI_TOKEN (gerado no Gestor de Eventos). Sem ele, nada e' enviado.
import crypto from 'node:crypto';

const PIXEL = process.env.META_PIXEL_ID || '1770865190673375';
const GRAPH = 'https://graph.facebook.com/v25.0';

export function lerConsentimento(ref) {
  if (typeof ref !== 'string' || !/^ge1(_|$)/.test(ref)) return null;
  const resto = ref.slice(4);
  if (!resto) return { fbp: null, fbc: null };
  const i = resto.indexOf('_');
  const fbpEnc = i === -1 ? resto : resto.slice(0, i);
  const fbcEnc = i === -1 ? '' : resto.slice(i + 1);
  const fbp = /^fb-\d-\d+-\d+$/.test(fbpEnc) ? fbpEnc.replace(/-/g, '.') : null;
  let fbc = null;
  const m = fbcEnc.match(/^fb-(\d)-(\d+)-(.+)$/);
  if (m) fbc = `fb.${m[1]}.${m[2]}.${m[3]}`;
  return { fbp, fbc };
}

const sha = v => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

export function montarEvento({ sessionId, email, valor, moeda, produto, consentimento, agora = Date.now() }) {
  const user_data = { em: [sha(email)] };
  if (consentimento.fbp) user_data.fbp = consentimento.fbp;
  if (consentimento.fbc) user_data.fbc = consentimento.fbc;
  return {
    event_name: 'Purchase',
    event_time: Math.floor(agora / 1000),
    event_id: sessionId,
    action_source: 'website',
    event_source_url: 'https://gewoon-even.nl/',
    user_data,
    custom_data: { value: Number(valor), currency: moeda, content_name: produto }
  };
}

// Nunca deixa o webhook falhar: devolve um resumo para o log.
export async function enviarCompraMeta(dados) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { enviado: false, motivo: 'sem_token' };
  const consentimento = lerConsentimento(dados.clientReferenceId);
  if (!consentimento) return { enviado: false, motivo: 'sem_consentimento' };
  try {
    const r = await fetch(`${GRAPH}/${PIXEL}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: [montarEvento({ ...dados, consentimento })] }),
      signal: AbortSignal.timeout(4000)
    });
    const corpo = await r.text();
    return r.ok ? { enviado: true, resposta: corpo.slice(0, 200) } : { enviado: false, motivo: `http_${r.status}`, resposta: corpo.slice(0, 300) };
  } catch (e) {
    return { enviado: false, motivo: String(e.message || e).slice(0, 200) };
  }
}
