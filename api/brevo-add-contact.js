// Serverless function que adiciona um contato no Brevo via API
// Modo defensivo: retorna 200 OK mesmo em falha, pra não quebrar UX

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID;

  if (!apiKey || !listId) {
    console.log('[Brevo] API key or List ID not configured, skipping');
    return res.status(200).json({ ok: true, noop: true });
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
          SOURCE: 'quiz_completed',
          SIGNUP_DATE: new Date().toISOString()
        },
        updateEnabled: true
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Brevo] API error:', response.status, errorBody);
      return res.status(200).json({ ok: false, error: 'brevo_api_error' });
    }

    const data = await response.json();
    return res.status(200).json({ ok: true, contactId: data.id });

  } catch (error) {
    console.error('[Brevo] Network error:', error);
    return res.status(200).json({ ok: false, error: 'network_error' });
  }
}
