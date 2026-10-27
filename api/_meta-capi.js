// Purchase (webhook da Stripe e upsell) e Lead (e-mail do quiz) pela
// Conversions API da Meta.
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

// Dados extra para a Meta ligar o evento a pessoa (Event Match Quality).
// Tudo o que identifica vai em sha256, como a Meta pede; IP e navegador vao
// em claro (sao dados tecnicos que a Meta nao aceita em hash).
//   cliente: customer_details da Stripe (name, phone, address.country/postal_code)
//   tecnico: { ip, ua } capturados quando o checkout foi criado
export function montarUserData({ email, consentimento, cliente, tecnico }) {
  const user_data = { em: [sha(email)], external_id: [sha(email)] };
  if (consentimento.fbp) user_data.fbp = consentimento.fbp;
  if (consentimento.fbc) user_data.fbc = consentimento.fbc;
  const c = cliente || {};
  const partes = String(c.name || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length) user_data.fn = [sha(partes[0])];
  if (partes.length > 1) user_data.ln = [sha(partes[partes.length - 1])];
  const tel = String(c.phone || '').replace(/[^0-9]/g, '');
  if (tel.length >= 8) user_data.ph = [sha(tel)];
  const pais = String((c.address && c.address.country) || '').trim();
  if (/^[A-Za-z]{2}$/.test(pais)) user_data.country = [sha(pais)];
  const cp = String((c.address && c.address.postal_code) || '').replace(/\s+/g, '');
  if (cp) user_data.zp = [sha(cp)];
  const t = tecnico || {};
  if (t.ip) user_data.client_ip_address = String(t.ip).slice(0, 64);
  if (t.ua) user_data.client_user_agent = String(t.ua).slice(0, 400);
  return user_data;
}

export function montarEvento({ sessionId, email, valor, moeda, produto, consentimento, cliente, tecnico, agora = Date.now() }) {
  return {
    event_name: 'Purchase',
    event_time: Math.floor(agora / 1000),
    event_id: sessionId,
    action_source: 'website',
    event_source_url: 'https://gewoon-even.nl/',
    user_data: montarUserData({ email, consentimento, cliente, tecnico }),
    custom_data: { value: Number(valor), currency: moeda, content_name: produto, order_id: sessionId }
  };
}

// Lead do quiz pelo servidor. O event_id e' o mesmo que o pixel usa no
// fbq('track', 'Lead', ..., { eventID }), para a Meta contar uma vez so'.
export function montarLead({ eventId, email, conteudo, consentimento, tecnico, agora = Date.now() }) {
  return {
    event_name: 'Lead',
    event_time: Math.floor(agora / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: 'https://gewoon-even.nl/',
    user_data: montarUserData({ email, consentimento, tecnico }),
    custom_data: { content_name: conteudo, content_category: 'Email Capture' }
  };
}

async function enviar(evento) {
  const token = process.env.META_CAPI_TOKEN;
  try {
    const r = await fetch(`${GRAPH}/${PIXEL}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: [evento] }),
      signal: AbortSignal.timeout(4000)
    });
    const corpo = await r.text();
    return r.ok ? { enviado: true, resposta: corpo.slice(0, 200) } : { enviado: false, motivo: `http_${r.status}`, resposta: corpo.slice(0, 300) };
  } catch (e) {
    return { enviado: false, motivo: String(e.message || e).slice(0, 200) };
  }
}

// IP e navegador de um pedido do site (Vercel poe o IP real em x-forwarded-for).
export function tecnicoDoPedido(req) {
  const h = (req && req.headers) || {};
  const ip = String(h['x-forwarded-for'] || h['x-real-ip'] || '').split(',')[0].trim();
  const ua = String(h['user-agent'] || '');
  return { ip: ip || null, ua: ua || null };
}

// Nunca deixa o webhook falhar: devolve um resumo para o log.
export async function enviarCompraMeta(dados) {
  if (!process.env.META_CAPI_TOKEN) return { enviado: false, motivo: 'sem_token' };
  const consentimento = lerConsentimento(dados.clientReferenceId);
  if (!consentimento) return { enviado: false, motivo: 'sem_consentimento' };
  return enviar(montarEvento({ ...dados, consentimento }));
}

export async function enviarLeadMeta(dados) {
  if (!process.env.META_CAPI_TOKEN) return { enviado: false, motivo: 'sem_token' };
  const consentimento = lerConsentimento(dados.ref);
  if (!consentimento) return { enviado: false, motivo: 'sem_consentimento' };
  if (typeof dados.eventId !== 'string' || !/^lead-[A-Za-z0-9-]{6,60}$/.test(dados.eventId)) return { enviado: false, motivo: 'sem_event_id' };
  return enviar(montarLead({ ...dados, consentimento }));
}
