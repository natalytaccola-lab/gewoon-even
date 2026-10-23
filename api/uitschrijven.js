// Descadastro dos e-mails das sequencias em codigo.
//   GET  -> pagina com um botao (para que scanners de e-mail que abrem links
//           nao descadastrem ninguem sem querer)
//   POST -> descadastra (botao da pagina, ou "um clique" do Gmail/Apple Mail
//           via List-Unsubscribe-Post)
import { confere, segredoDescadastro } from './_assinatura.js';

function pagina(res, status, titulo, texto, form = '') {
  res.status(status).setHeader('content-type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${titulo} · Gewoon Even</title>
<style>body{margin:0;background:#fff;color:#3E4E43;font:17px/1.6 Helvetica,Arial,sans-serif}
main{max-width:520px;margin:12vh auto;padding:0 20px}h1{font:400 28px/1.2 Georgia,serif;margin:0 0 16px}
button{margin-top:12px;padding:14px 22px;border:0;border-radius:8px;background:#9E6044;color:#fff;font:600 17px Helvetica,Arial,sans-serif;cursor:pointer}</style>
</head><body><main><h1>${titulo}</h1><p>${texto}</p>${form}</main></body></html>`);
}

export default async function handler(req, res) {
  const e = String((req.query && req.query.e) || '').trim().toLowerCase();
  const t = String((req.query && req.query.t) || '');
  const segredo = segredoDescadastro();

  if (!confere(e, t, segredo)) {
    return pagina(res, 400, 'Link niet geldig', 'Deze link werkt niet (meer). Mail ons gerust op hello@gewoon-even.nl, dan regelen we het.');
  }

  if (req.method === 'GET') {
    return pagina(res, 200, 'Uitschrijven',
      `Wil je geen e-mails meer van Gewoon Even ontvangen op ${e.replace(/</g, '')}?`,
      `<form method="post"><button type="submit">Ja, schrijf me uit</button></form>`);
  }
  if (req.method !== 'POST') return res.status(405).end();

  const r = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(e)}`, {
    method: 'PUT',
    headers: { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ emailBlacklisted: true })
  });
  if (!r.ok && r.status !== 404) {
    console.error('[uitschrijven] brevo', r.status, await r.text());
    return pagina(res, 502, 'Er ging iets mis', 'Probeer het later nog eens, of mail ons op hello@gewoon-even.nl.');
  }
  return pagina(res, 200, 'Je bent uitgeschreven', 'Je ontvangt geen e-mails meer van Gewoon Even.');
}
