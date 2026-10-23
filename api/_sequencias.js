// Sequencias de e-mail em codigo (em vez do editor de automacoes do Brevo).
//
// O Brevo continua a ser so' quem ENVIA (API transacional) e quem guarda o
// contacto. Quem decide quem recebe o que e quando e' este ficheiro, corrido
// uma vez por dia pelo cron do Vercel (/api/sequencias).
//
// Para acrescentar um e-mail: criar o modelo no Brevo (com o link
// {{ params.UNSUB_URL }} no rodape) e juntar um passo abaixo. Mais nada.
//
// Regras de seguranca:
//  - so' entra quem se inscreveu DEPOIS de `inicio` (nunca dispara para
//    contactos antigos de teste ou de antes do lancamento);
//  - quem tem qualquer atributo de `paraSe` preenchido (ex.: comprou) sai;
//  - quem esta' na blacklist ou se descadastrou da lista nunca recebe;
//  - cada passo grava a sua marca (data do envio) no contacto, por isso um
//    passo nunca e' enviado duas vezes.

export const SEQUENCIAS = [
  {
    id: 'funil-a-extra',
    // Lista do Funil A (quiz do €17). Os e-mails 1 a 5 continuam no Brevo
    // (automacao "Funil A · Leads"); estes vem a seguir ao 5, que sai no dia 13.
    listaEnv: 'BREVO_LIST_ID',
    origem: 'quiz_completed',
    inicio: '2026-10-23',
    paraSe: ['HAS_NP'],
    passos: [
      { marca: 'FA6_SENT', modelo: 83, dia: 16, nome: 'Funil A 6 · Stille verlies' },
      { marca: 'FA7_SENT', modelo: 84, dia: 19, intervaloMin: 3, nome: 'Funil A 7 · Functionele klachten' }
    ]
  }
];

const DIA_MS = 86400000;

// Dia do calendario (UTC) como numero inteiro, para contar dias inteiros.
export function diaNum(valor) {
  if (!valor) return null;
  const t = Date.parse(String(valor).length === 10 ? valor + 'T00:00:00Z' : valor);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / DIA_MS);
}

export function hojeISO(agora = new Date()) {
  return agora.toISOString().slice(0, 10);
}

function preenchido(v) {
  return !(v === undefined || v === null || v === '' || v === false);
}

// Decide, para um contacto, qual o passo a enviar hoje (ou null).
// Devolve tambem o motivo, que aparece no modo de simulacao.
export function proximoPasso(seq, contacto, listaId, agora = new Date()) {
  const a = contacto.attributes || {};
  const hoje = diaNum(hojeISO(agora));

  if (contacto.emailBlacklisted) return { passo: null, motivo: 'blacklist' };
  if ((contacto.listUnsubscribed || []).map(Number).includes(Number(listaId))) {
    return { passo: null, motivo: 'descadastrado da lista' };
  }
  if (seq.origem && a.SOURCE !== seq.origem) return { passo: null, motivo: 'outra origem' };

  const inscricao = diaNum(a.SIGNUP_DATE);
  if (inscricao === null) return { passo: null, motivo: 'sem SIGNUP_DATE' };
  if (inscricao < diaNum(seq.inicio)) return { passo: null, motivo: 'inscrito antes do inicio' };

  for (const attr of seq.paraSe) {
    if (preenchido(a[attr])) return { passo: null, motivo: attr + ' preenchido' };
  }

  const dias = hoje - inscricao;
  for (let i = 0; i < seq.passos.length; i++) {
    const p = seq.passos[i];
    if (preenchido(a[p.marca])) continue;                 // ja' enviado
    if (dias < p.dia) return { passo: null, motivo: `dia ${dias}, ${p.marca} so' no dia ${p.dia}` };
    if (i > 0) {
      const anterior = diaNum(a[seq.passos[i - 1].marca]);
      if (anterior === null) return { passo: null, motivo: 'passo anterior por enviar' };
      if (p.intervaloMin && hoje - anterior < p.intervaloMin) {
        return { passo: null, motivo: `espera ${p.intervaloMin} dias depois do anterior` };
      }
    }
    return { passo: p, motivo: `dia ${dias}` };
  }
  return { passo: null, motivo: 'sequencia completa' };
}
