// Serverless function que marca no Brevo se um contato visualizou de facto
// uma página específica do funil (ex: page-upsell). Modo defensivo: retorna
// 200 OK mesmo em falha, para não quebrar UX. Não cria contato novo — só
// atualiza um contato já existente (quem ainda não deu o email é ignorado).

const ALLOWED_ATTRIBUTES = {
  'page-upsell': 'VIEWED_UPSELL',
  'page-upsell2': 'VIEWED_UPSELL2',
  'page-downsell': 'VIEWED_DOWNSELL'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, page } = req.body || {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(200).json({ ok: false, error: 'invalid_email' });
  }

  const attribute = ALLOWED_ATTRIBUTES[page];
  if (!attribute) {
    return res.status(200).json({ ok: false, error: 'unknown_page' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log('[Brevo] API key not configured, skipping view tracking');
    return res.status(200).json({ ok: true, noop: true });
  }

  try {
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        attributes: {
          [attribute]: true,
          [`${attribute}_DATE`]: new Date().toISOString().split('T')[0]
        }
      })
    });

    // Se o contato ainda não existir (404), não criamos — só quem já deu o
    // email antes tem interesse nesta métrica.
    if (response.status === 404) {
      return res.status(200).json({ ok: true, noop: true, reason: 'contact_not_found' });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Brevo] Track view error:', response.status, errorBody);
      return res.status(200).json({ ok: false, error: 'brevo_api_error' });
    }

    console.log(`[Brevo] Tracked view: ${email} saw ${page} (${attribute}=true)`);
    return res.status(200).json({ ok: true, email, page, attribute });

  } catch (error) {
    console.error('[Brevo] Network error:', error.message);
    return res.status(200).json({ ok: false, error: 'network_error' });
  }
}
