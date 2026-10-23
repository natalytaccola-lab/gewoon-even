// Link de descadastro assinado: so' quem recebeu o e-mail consegue usa'-lo.
import crypto from 'node:crypto';

export function assinar(email, segredo) {
  return crypto.createHmac('sha256', segredo).update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);
}

export function confere(email, token, segredo) {
  if (!email || !token || !segredo) return false;
  const esperado = Buffer.from(assinar(email, segredo));
  const dado = Buffer.from(String(token));
  return esperado.length === dado.length && crypto.timingSafeEqual(esperado, dado);
}

export function linkDescadastro(base, email, segredo) {
  const e = encodeURIComponent(String(email).trim().toLowerCase());
  return `${base}/api/uitschrijven?e=${e}&t=${assinar(email, segredo)}`;
}

// Segredo do link: UNSUB_SECRET se existir; senao derivado da chave do Brevo
// (nunca sai do servidor), para nao haver mais nada a configurar no Vercel.
export function segredoDescadastro() {
  if (process.env.UNSUB_SECRET) return process.env.UNSUB_SECRET;
  const k = process.env.BREVO_API_KEY;
  return k ? crypto.createHmac('sha256', k).update('gewoon-even/uitschrijven').digest('hex') : '';
}
