# Notas do projeto — gewoon-even

Este ficheiro existe para garantir continuidade entre sessões de chat/Cowork/Claude Code,
já que cada conversa nova começa sem memória das anteriores. Sempre que houver uma decisão
importante, um bug encontrado, ou um ponto pendente, regista aqui e faz commit.

Última atualização: sessão de revisão do funil de vendas (Slaapprotocol, upsells, autenticação Git).

---

## Estado do Git / autenticação

- Autenticação GitHub resolvida: usar sempre o token classic chamado **"gewoon-even push"**
  (scope completo `repo`, expira 22 Ago 2026) — os tokens "gewoon-even-cowork" e "gewoon-even"
  têm scope `public_repo` ("public access") apenas e **não conseguem fazer push** (dão 403
  mesmo sendo dona do repositório). Se o token expirar ou for revogado, regenerar especificamente
  o "gewoon-even push" em github.com/settings/tokens, não criar um novo com scope diferente.
- Histórico teve uma divergência entre local e remoto (commits feitos direto no GitHub via upload
  vs. commits locais) — foi reconciliado com um merge sem conflitos em `53311c5`.
- **Ainda por revogar manualmente:** os tokens "gewoon-even-cowork" e "gewoon-even" (scope
  `public_repo`, nunca usados) podem ser apagados com segurança — não são os que funcionam.

## Bugs estruturais encontrados no funil (index.html)

1. **`page-upsell` nunca é mostrada a ninguém.** Não existe nenhuma chamada `showPage('page-upsell')`
   em lado nenhum do código. Isto significa que, depois de comprar o Noodprotocol (€17), o cliente
   vai direto para a página de entrega — nunca vê a oferta do Protocol 7 Dagen (€37), nem por
   consequência a do Slaapprotocol (€67, `page-upsell2`), nem o downsell do Crisiskaart (€9,
   `page-downsell`). A ligação técnica entre downsell e Crisiskaart (Stripe link + hash de entrega)
   está correta — só nunca é alcançada.
   - **Correção proposta:** mudar o *success URL* do Payment Link do Noodprotocol no Stripe para um
     hash novo (ex: `#upsell-p7-6h2mk9`) que dispare `showPage('page-upsell')` via hash routing no
     `index.html`. Ainda não implementado — combinado fazer em branch/preview antes de produção.

2. **Beco sem saída na `page-thankyou`.** Quem recusa todos os upsells (Protocol 7 Dagen → Crisiskaart)
   cai nesta página, que diz "Je ontvangt binnen enkele minuten een email met toegang" mas não tem
   nenhum link para a página de entrega real. Se a automação de email no Brevo não existir ou falhar,
   o cliente fica sem forma nenhuma de aceder ao que pagou.
   - **Correção proposta:** adicionar um link direto de saída para `#toegang-np-8f3k2m` nesta página.
   - Ainda não implementado.

3. **Automação de email no Brevo não confirmada.** O código (`api/stripe-webhook.js`,
   `api/brevo-add-contact.js`) só marca atributos/tags no Brevo — não dispara nenhum email
   transacional diretamente. Se existe automação a enviar "email com acesso", ela vive dentro do
   painel do Brevo (Automations/Workflows), fora da visibilidade do código.
   - **Pendente:** ligar conector Brevo à sessão (Settings → Connectors → Brevo) para confirmar
     diretamente, ou verificar manualmente no painel Brevo.

## Decisão de preço/produto (resolvida)

- **Pergunta:** quando o cliente aceita o Slaapprotocol por €67 na `page-upsell2`, o que deveria
  receber — só o Slaapprotocol, ou um pacote com o Protocol 7 Dagen também?
- **Decisão da Nataly:** €67 = **só o Slaapprotocol**. Não é bundle.
- **Implicação:** a copy atual da `page-upsell2` está errada ao dizer "Je hebt net het Protocol
  van 7 Dagen gekocht" — isto assume uma compra que nunca aconteceu tecnicamente (aceitar a oferta
  na `page-upsell` só navega para a página seguinte, não cobra nada). Os dois CTAs da `page-upsell2`
  já refletem corretamente a decisão (escolha exclusiva: OU Slaapprotocol €67 OU Protocol 7 Dagen €37),
  só o texto de enquadramento precisa de correção.
- **Não mexer no `api/stripe-webhook.js`** — o mapeamento atual (€67 → só `HAS_SLAAP`) está correto
  face a esta decisão.

## Copy nova aprovada para a page-upsell2 (ainda por implementar no código)

Estrutura aprovada: mini-teste de 3 perguntas → resultado/diagnóstico → ponte para a oferta →
lista de faixas com benefício → preço/CTA → fontes no rodapé.

**Mini-teste (3 perguntas, escala Nooit/Soms/Vaak/Bijna elke nacht):**
1. "Lig je weleens rond 3 uur 's nachts klaarwakker, met gedachten die niet stoppen?"
2. "Word je moe wakker, zelfs na 7-8 uur slaap?"
3. "Voelt je lichaam 's avonds niet 'af te schakelen', ook al ben je uitgeput?"

**Resultado:**
"Herkenbaar? Dit heeft een naam." / "Wat je beschrijft heet hyperarousal — je zenuwstelsel blijft
's nachts in een lichte staat van paraatheid, waardoor je brein de overgang naar diepe herstelslaap
niet maakt. Dit wordt in slaaponderzoek erkend als kernmechanisme bij aanhoudende slaapproblemen.
Het is geen kwestie van 'niet moe genoeg zijn' — je systeem staat nog aan."

**Ponte + oferta:**
"Slaap is de basis van alles." / "Het Slaapprotocol bestaat uit vier audio's, elk gericht op een
ander moment waarop dit systeem vastloopt:"
- Avondritueel — helpt je lichaam actief omschakelen van dag naar nacht, in plaats van van scherm
  naar bed te springen
- Inslapen — begeleide ontspanning voor het moment dat je hoofd niet stil wil staan
- 's Nachts wakker — voor als je midden in de nacht wakker ligt en niet meer wegzakt
- Intro — hoe het protocol werkt, zodat je weet wat je kunt verwachten

"Vier audio's, inzetbaar op het moment dat je ze nodig hebt — geen programma om af te maken, maar
gereedschap dat er is wanneer slaap het nodig heeft." / "Dit aanbod verschijnt eenmalig, nu."

**Preço/CTA:** €67 → "Ja, ik wil het Slaapprotocol — €67" / "Nee bedankt, alleen het Protocol van
7 Dagen — €37"

**Rodapé (fontes reais, verificadas por web search nesta sessão):**
"Bronnen: Dressle et al., Journal of Sleep Research (2023) — hyperarousal bij insomnia; Sleep
Foundation, Cleveland Clinic — cognitieve gedragstherapie voor slapeloosheid (CBT-I)."

**Nota de honestidade:** não sabemos que técnica exata está dentro dos 4 áudios (sem transcrição
disponível) — por isso a copy promete ao nível do *problema* (hiperativação do sistema nervoso),
não ao nível da técnica clínica exata (não afirmamos que o áudio "é CBT-I").

## Pendências / próximos passos

- [x] Construir o mini-quiz interativo na `page-upsell2` (3 perguntas + resultado/diagnóstico
      hyperarousal + ponte/oferta com citações) — implementado, testado com Playwright (fluxo
      completo: perguntas → diagnóstico → oferta, incluindo reset ao reentrar na página) e
      publicado em produção (commit `dd48f5d`).
- [ ] Implementar o gatilho em falta (`page-upsell`) — bug #1. Continua por fazer.
- [ ] Adicionar saída de emergência na `page-thankyou` — bug #2. Continua por fazer.
- [ ] Confirmar automação Brevo (ligar conector ou verificar manualmente).
- [ ] Apagar os tokens GitHub "gewoon-even-cowork" e "gewoon-even" (scope `public_repo`, nunca
      usados, não funcionam para push) nas definições do GitHub — manter só "gewoon-even push".
- [ ] Considerar rever a copy da `page-downsell` (Crisiskaart) também, já que só foi validada a
      `page-upsell2` até agora.

## Autenticação / segurança (contexto adicional já discutido)

- Foi avaliada proteção de conteúdo pago (gating via Stripe) contra "aproveitadores" — decisão:
  não avançar por agora (baixo retorno face ao esforço para produtos de ticket baixo/médio).
  Reavaliar se: o link de acesso começar a circular fora do funil, o tráfego subir com conversão
  anómala, ou os produtos passarem a ticket mais alto/subscrição.
- Foi aplicado noindex nos PDFs (`vercel.json` + `robots.txt`) para evitar indexação no Google —
  isto já está em produção (commit `f646b38`).
