// Serverless function que adiciona um contato no Brevo via API
// Modo defensivo: retorna 200 OK mesmo em falha, pra não quebrar UX

import { enviarLeadMeta, tecnicoDoPedido } from './_meta-capi.js';

let atributosProntos = false;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, funil, ad, campanha, lead_id, ref } = req.body || {};
  const limpo = (v, n) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, n);
  const adCode = limpo(ad, 40);
  const adCampanha = limpo(campanha, 60);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const apiKey = process.env.BREVO_API_KEY;

  // Funil B (quiz 37) tem lista propria. Se a variavel nao existir, nao se faz
  // nada: nunca cair na BREVO_LIST_ID, para as duas listas nao se misturarem.
  const isFunil37 = funil === '37';
  const listId = isFunil37 ? process.env.BREVO_LIST_ID_37 : process.env.BREVO_LIST_ID;
  const source = isFunil37 ? 'quiz_37' : 'quiz_completed';

  // Lead tambem pelo servidor (so' com consentimento, ver _meta-capi.js), em
  // paralelo com o Brevo. Espera-se por ele antes de responder porque a
  // funcao serverless termina na resposta.
  const leadMeta = enviarLeadMeta({
    eventId: lead_id, email, ref,
    conteudo: isFunil37 ? 'Quiz 37 Completed' : 'Quiz Completed',
    tecnico: tecnicoDoPedido(req)
  }).catch(e => ({ enviado: false, motivo: String(e && e.message || e) }));
  const fim = async (body) => {
    const capi = await leadMeta;
    if (capi && capi.motivo !== 'sem_consentimento' && capi.motivo !== 'sem_token') console.log('[Meta CAPI] lead:', JSON.stringify(capi));
    return res.status(200).json(body);
  };

  if (!apiKey || !listId) {
    console.log('[Brevo] API key or List ID not configured, skipping', isFunil37 ? '(funil 37)' : '');
    return fim({ ok: true, noop: true });
  }

  // Atributos da origem do anuncio: o Brevo descarta em silencio atributos que
  // nao existem, por isso cria-os uma vez por instancia (400 = ja' existem).
  if ((adCode || adCampanha) && !atributosProntos) {
    await Promise.all(['AD_CODE', 'AD_CAMPAIGN'].map(nome =>
      fetch(`https://api.brevo.com/v3/contacts/attributes/normal/${nome}`, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'text' })
      }).catch(() => null)));
    atributosProntos = true;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        listIds: [parseInt(listId, 10)],
        attributes: {
          SOURCE: source,
          SIGNUP_DATE: new Date().toISOString(),
          ...(adCode ? { AD_CODE: adCode } : {}),
          ...(adCampanha ? { AD_CAMPAIGN: adCampanha } : {})
        },
        updateEnabled: true
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Brevo] API error:', response.status, errorBody);
      // So' o codigo do Brevo (sem dados do contacto), para diagnostico.
      let codigo = '';
      try { codigo = String(JSON.parse(errorBody).code || '').slice(0, 40); } catch (e) {}
      return fim({ ok: false, error: 'brevo_api_error', status: response.status, codigo });
    }

    // 201 = contacto novo (traz o id); 204 = contacto que ja' existia, atualizado, sem corpo.
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    return fim({ ok: true, contactId: data && data.id, atualizado: response.status === 204 });

  } catch (error) {
    console.error('[Brevo] Network error:', error);
    return fim({ ok: false, error: 'network_error' });
  }
}
