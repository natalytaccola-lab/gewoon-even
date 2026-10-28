// Cron diario (vercel.json) que envia os e-mails das sequencias em codigo.
//
//   GET /api/sequencias            -> corrida do dia (cron do Vercel). Idempotente:
//                                     cada passo grava a sua marca, por isso correr
//                                     duas vezes no mesmo dia nao envia nada a mais.
//   GET /api/sequencias?simular=1  -> simulacao: so' contagens, sem e-mails nem envios
//   GET /api/sequencias?teste=1&passo=FA6_SENT&para=hello@gewoon-even.nl
//                                  -> envia UM passo a um endereco da lista TESTE_PARA,
//                                     sem marcar nada. So' fora de producao.
//
// Nenhum segredo novo a configurar: se CRON_SECRET existir, a corrida exige-o
// (Authorization: Bearer); se nao existir, so' aceita o agente do cron do Vercel.

import { SEQUENCIAS, ATRIBUTOS_TEXTO, proximoPasso, hojeISO } from './_sequencias.js';
import { linkDescadastro, segredoDescadastro } from './_assinatura.js';

const TESTE_PARA = ['hello@gewoon-even.nl', 'natalytaccola@gmail.com'];
const MARCA_CORRIDA = 'hello@gewoon-even.nl';

const BREVO = 'https://api.brevo.com/v3';
const BASE_SITE = 'https://gewoon-even.nl';
const MAX_ENVIOS_POR_DIA = 300;

function mascarar(email) {
  const [u, d] = String(email).split('@');
  return (u || '').slice(0, 2) + '***@' + (d || '');
}

async function brevo(apiKey, metodo, caminho, corpo) {
  const r = await fetch(BREVO + caminho, {
    method: metodo,
    headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
  return { ok: r.ok, status: r.status, dados };
}

// Cria o atributo se ainda nao existir (400 = ja' existe, tudo bem).
async function garantirAtributo(apiKey, nome, tipo) {
  const r = await brevo(apiKey, 'POST', `/contacts/attributes/normal/${nome}`, { type: tipo });
  return r.ok || r.status === 400;
}

async function contactosDaLista(apiKey, listaId) {
  const todos = [];
  for (let offset = 0; offset < 20000; offset += 500) {
    const r = await brevo(apiKey, 'GET', `/contacts/lists/${listaId}/contacts?limit=500&offset=${offset}`);
    if (!r.ok) throw new Error(`lista ${listaId}: ${r.status} ${JSON.stringify(r.dados)}`);
    const pagina = (r.dados && r.dados.contacts) || [];
    todos.push(...pagina);
    if (pagina.length < 500) break;
  }
  return todos;
}

async function enviar(apiKey, modelo, email, segredoUnsub) {
  const unsub = linkDescadastro(BASE_SITE, email, segredoUnsub);
  return brevo(apiKey, 'POST', '/smtp/email', {
    templateId: modelo,
    to: [{ email }],
    params: { UNSUB_URL: unsub },
    headers: {
      'List-Unsubscribe': `<${unsub}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    },
    tags: ['sequencia']
  });
}

export default async function handler(req, res) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, erro: 'BREVO_API_KEY em falta' });
  const segredoUnsub = segredoDescadastro();
  const q = req.query || {};
  const producao = process.env.VERCEL_ENV === 'production';

  // Envio de teste: um passo, a um endereco da lista, sem marcar nada.
  if (q.teste) {
    if (producao) return res.status(403).json({ ok: false, erro: 'teste so fora de producao' });
    const para = String(q.para || '').trim().toLowerCase();
    if (!TESTE_PARA.includes(para)) return res.status(400).json({ ok: false, erro: 'endereco fora da lista de teste' });
    const passo = SEQUENCIAS.flatMap(s => s.passos).find(p => p.marca === q.passo);
    if (!passo) return res.status(400).json({ ok: false, erro: 'passo desconhecido' });
    const r = await enviar(apiKey, passo.modelo, para, segredoUnsub);
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, para, passo: passo.nome, brevo: r.dados });
  }

  const simular = q.simular === '1';
  if (!simular) {
    const cron = process.env.CRON_SECRET;
    const auth = req.headers.authorization || '';
    const agente = String(req.headers['user-agent'] || '');
    const autorizado = cron ? auth === `Bearer ${cron}` : agente.startsWith('vercel-cron');
    if (!autorizado) {
      console.warn('[sequencias] pedido recusado', JSON.stringify({ agente, temAuth: !!auth }));
      return res.status(401).json({ ok: false });
    }
  }
  const relatorio = { data: hojeISO(), simular, sequencias: [] };
  let envios = 0;

  for (const nome of ATRIBUTOS_TEXTO) {
    if (!(await garantirAtributo(apiKey, nome, 'text'))) relatorio.falhaAtributo = nome;
  }

  for (const seq of SEQUENCIAS) {
    const listaId = process.env[seq.listaEnv];
    const resumo = { id: seq.id, lista: listaId, contactos: 0, aEnviar: {}, enviados: [], falhas: [], motivos: {} };
    relatorio.sequencias.push(resumo);
    if (!listaId) { resumo.falhas.push('lista nao configurada'); continue; }

    // Tambem na simulacao: criar um atributo que falta e' inofensivo e assim
    // a primeira simulacao ja' deixa o Brevo pronto.
    for (const p of seq.passos) {
      if (!(await garantirAtributo(apiKey, p.marca, 'date'))) resumo.falhas.push('atributo ' + p.marca);
    }

    let contactos;
    try { contactos = await contactosDaLista(apiKey, listaId); }
    catch (e) { resumo.falhas.push(String(e.message || e)); continue; }
    resumo.contactos = contactos.length;

    for (const c of contactos) {
      const { passo, motivo } = proximoPasso(seq, c, listaId);
      if (!passo) { resumo.motivos[motivo] = (resumo.motivos[motivo] || 0) + 1; continue; }
      // Modelo ainda por criar no Brevo: nada sai, fica so' contado.
      if (!passo.modelo) { resumo.motivos['modelo por criar'] = (resumo.motivos['modelo por criar'] || 0) + 1; continue; }

      if (simular) { resumo.aEnviar[passo.nome] = (resumo.aEnviar[passo.nome] || 0) + 1; continue; }
      if (envios >= MAX_ENVIOS_POR_DIA) { resumo.falhas.push('limite diario atingido'); break; }

      const r = await enviar(apiKey, passo.modelo, c.email, segredoUnsub);
      if (!r.ok) { console.error('[sequencias] envio falhou', c.email, passo.marca, r.status, r.dados); resumo.falhas.push({ email: mascarar(c.email), passo: passo.nome, status: r.status }); continue; }
      envios++;

      // A marca so' e' gravada depois do envio. Se falhar, fica registado
      // no log: e' o unico caso em que o passo poderia repetir no dia seguinte.
      const m = await brevo(apiKey, 'PUT', `/contacts/${encodeURIComponent(c.email)}`,
        { attributes: { [passo.marca]: hojeISO() } });
      resumo.enviados.push({ email: mascarar(c.email), passo: passo.nome, marca: m.ok });
      console.log('[sequencias] enviado', c.email, passo.marca);
      if (!m.ok) console.error('[sequencias] marca falhou', c.email, passo.marca, m.status, m.dados);
    }
  }

  console.log('[sequencias] resumo', JSON.stringify(relatorio));

  // Prova duravel de cada corrida real (o plano Hobby do Vercel so' guarda 1 h
  // de logs): data/hora + contagens num atributo do contacto da propria marca.
  if (!simular) {
    const curto = relatorio.sequencias.map(s => `${s.id}:${s.contactos}c/${s.enviados.length}e/${s.falhas.length}f`).join(' ');
    await garantirAtributo(apiKey, 'SEQ_ULTIMA_CORRIDA', 'text');
    await brevo(apiKey, 'PUT', `/contacts/${encodeURIComponent(MARCA_CORRIDA)}`,
      { attributes: { SEQ_ULTIMA_CORRIDA: `${new Date().toISOString()} ${curto}`.slice(0, 250) } });
  }
  return res.status(200).json({ ok: true, ...relatorio });
}
