# Notas do projeto — gewoon-even

Este ficheiro existe para garantir continuidade entre sessões de chat/Cowork/Claude Code,
já que cada conversa nova começa sem memória das anteriores. Sempre que houver uma decisão
importante, um bug encontrado, ou um ponto pendente, regista aqui e faz commit.

Última atualização: sessão de revisão do funil de vendas (Slaapprotocol, upsells, autenticação Git).

---

## Webhook do Stripe — RESOLVIDO

O webhook (`/api/stripe-webhook`) esteve a devolver 400 "Invalid signature" (o `STRIPE_WEBHOOK_SECRET`
no Vercel não correspondia ao signing secret do endpoint ativo no Stripe). Corrigido via Claude Code
local (atualização da env var + redeploy `vercel --prod`) e confirmado com 3x `200 OK` consecutivos
no Stripe Dashboard, incluindo reenvio manual de um evento de teste. `HAS_NP`/`HAS_P7D`/`HAS_SLAAP`/
`HAS_CK`/`BUYER_STATUS` estão agora a ser escritos corretamente no Brevo a cada compra confirmada.
Isto desbloqueia a montagem das automações Funil 1/Funil 2 (ver `emails-abandono-funil1-funil2.md`).

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

0. **O botão de €37 em `page-upsell` não cobrava nada — RESOLVIDO (24 jul 2026).**
   Depois de o bug #1 abaixo tornar `page-upsell` visível, descobriu-se que o botão "Ja, ik wil
   mijn zenuwstelsel hertrainen — €37" era um `<button onclick="showPage('page-upsell2')">` — só
   navegava, nunca cobrava. O Payment Link real do Protocol 7 Dagen (`3cI4gy5QI9ol8kcblofjG01`)
   estava em `page-upsell2`, disfarçado de "recusa" ("Nee bedankt, alleen het Protocol van 7
   Dagen"). Corrigido (commit `2ac6333`):
   - Novo Payment Link Stripe criado (`buy.stripe.com/aFa6oG0wo8kheIAexAfjG04`, mesmo produto/
     preço €37) com success URL → `#upsell2-slaap-7n4kx9` (não reaproveitar o link antigo, que
     continua a redirecionar direto para entrega — é usado no email do Funil 2 e deve continuar
     a fazer isso).
   - `page-upsell`: botão agora é `<a href>` para esse novo link.
   - Novo hash `#upsell2-slaap-7n4kx9` no roteamento: mostra `page-upsell2` como upsell genuíno
     do Slaapprotocol (€67) depois da compra real do Protocol 7 Dagen, disparando `fbq('track',
     'Purchase', ...)` correto.
   - `page-upsell2`: removido o CTA que reoferecia o Protocol 7 Dagen (já pago) como "recusa" —
     agora é só um botão para `page-downsell` (Crisiskaart). Adicionada confirmação visual no
     topo do mini-quiz ("✓ Het Protocol van 7 Dagen is bevestigd").
   - Testado localmente com Playwright (navegação fresca simulando redirect real do Stripe).
   - **Ainda por verificar em produção:** uma compra real de €37 vai confirmar que o redirect do
     Stripe Dashboard (novo link) está mesmo a funcionar como configurado — só testei o roteamento
     do lado do site, não o round-trip completo pelo Stripe.

   **Follow-up (24 jul 2026, commit `fc6f54f`): banner de confirmação tornado condicional.**
   O banner "✓ Het Protocol van 7 Dagen is bevestigd" acima estava sempre visível em `page-upsell2`,
   mas essa página tem três portas de entrada e só uma delas é uma compra real:
   - `#upsell2-slaap-7n4kx9` → redirect real do Stripe pós-compra do Protocol 7 Dagen. **Único**
     hash que deve confirmar a compra.
   - Duas entradas futuras por email (ainda não construídas: sequência B/C do Slaapprotocol, para
     quem já tem o 7 Dagen há dias, ou só tem o Noodprotocol) não devem herdar esta confirmação.
   - Solução: flag global `upsell2ConfirmedPurchaseEntry` (default `false`), só posta a `true`
     dentro do branch do hash `#upsell2-slaap-7n4kx9`; `showPage('page-upsell2')` lê a flag para
     mostrar/esconder o banner (`display: none` por default no HTML). Testado com Playwright
     (contexto novo por hash, simulando redirect externo real) para os 3 hashes relevantes.

   **Follow-up (24 jul 2026): CTAs dos emails do Funil 2 mudados de Stripe direto para as páginas
   do funil, em vez de `page-upsell2`, por decisão explícita:**
   - Email 1 do Funil 2 (mensagem #7, "Het Noodprotocol helpt als het gebeurt") — CTA "Ja, ik wil
     het Protocol van 7 Dagen →" agora aponta para `https://gewoon-even.vercel.app/#upsell-p7-6h2mk9`
     (mostra `page-upsell` do zero) em vez do link direto do Stripe. Guardado no Brevo (Automação #4,
     step #3).
   - Email 2 do Funil 2 (mensagem #8, "Voor als een koptelefoon opzetten te veel is") — CTA "Ja, ik
     neem de Crisiskaart mee →" agora aponta para `https://gewoon-even.vercel.app/#downsell-ck-5r8mqz`
     (mostra `page-downsell`) em vez do link direto do Stripe. Guardado no Brevo (Automação #4, step #6).
   - Novo hash `#downsell-ck-5r8mqz` adicionado ao roteamento só para isto (`showPage('page-downsell')`).
   - Razão: pedir uma decisão de €37/€9 só a partir de um email obriga o email a vender sozinho; as
     páginas têm a estrutura de venda completa (dique, garantia, etc.). `page-upsell2` continua
     reservada para uma sequência de email futura (ainda não construída) que vende o Slaapprotocol
     a quem já tem o Protocol 7 Dagen ou só tem o Noodprotocol — é aí que a confirmação condicional
     acima passa a ser obrigatória.
   - Nota operacional: ao editar mensagens no Brevo (code view), o editor por vezes captura uma tag
     `<script src="chrome-extension://...">` injetada por uma extensão do browser no `<head>` do
     documento, e o Brevo recusa salvar ("O modelo contém JavaScript"). Ver se aparece antes de
     salvar qualquer mensagem editada em code view.

1. **`page-upsell` nunca era mostrada a ninguém — RESOLVIDO POR COMPLETO.**
   Hash routing `#upsell-p7-6h2mk9` → `showPage('page-upsell')` implementado e em produção
   (commit `95ee2a2`, testado com Playwright). E o Payment Link do Noodprotocol
   (`buy.stripe.com/00waEW6UM2ZXdEwcpsfjG00`) já foi atualizado no Stripe Dashboard — "Depois do
   pagamento" agora redireciona para `https://gewoon-even.vercel.app/#upsell-p7-6h2mk9` (era
   `#toegang-np-8f3k2m`, que ia direto para a entrega saltando todo o upsell chain). Fluxo completo
   agora ativo: Noodprotocol → page-upsell (Protocol 7 Dagen) → page-upsell2 (mini-quiz +
   Slaapprotocol) / page-downsell (Crisiskaart).

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
- [x] Implementar o gatilho em falta (`page-upsell`) — bug #1. Código pronto (commit `95ee2a2`) e
      success URL do Payment Link do Noodprotocol atualizado no Stripe Dashboard. Bug #1 fechado.
- [x] Confirmado nas automações Brevo (Day 0 "Stille Verlies" e Day 3 "Functionele Klachten"):
      ambas disparam ao entrar na lista "Gewoon Even - Leads - #3" e só enviam se `BUYER_STATUS`
      estiver vazio — são nutrição para quem NÃO comprou, não cobrem o pós-compra. Não existe
      rede de segurança por email para o upsell chain; depende só do redirect do Stripe acima.
- [x] Adicionar saída de emergência na `page-thankyou` — bug #2. Link direto "Direct naar mijn
      Noodprotocol →" para `#toegang-np-8f3k2m`, testado com Playwright, publicado (commit `6302601`).
- [x] Copy da `page-downsell` (Crisiskaart) reescrita ao mesmo nível da `page-upsell2` — detalhe
      dos 5 passos, citação real (técnica de grounding 5-4-3-2-1 usada em CGT), preço/CTA mantidos
      visíveis. Publicado (commit `6302601`).
- [ ] Confirmar automação Brevo adicional (ligar conector ou verificar manualmente) — não é
      urgente, já sabemos que as 2 existentes (Day 0/Day 3) são só nutrição de não-compradores.
- [ ] Apagar os tokens GitHub "gewoon-even-cowork" e "gewoon-even" (scope `public_repo`, nunca
      usados, não funcionam para push) nas definições do GitHub — manter só "gewoon-even push".
- [x] Copy de emails de abandono escrita para 2 sequências (Funil 1 — deu email mas não comprou
      o Noodprotocol; Funil 2 — comprou o Noodprotocol mas não comprou nenhum upsell). Entregue
      como ficheiro `emails-abandono-funil1-funil2.md`, com tabela de gatilhos Brevo para montar.
      Ainda por criar manualmente no painel Brevo (a copy está pronta, a automação em si não).
- [x] Tracking de visualização real da `page-upsell`/`page-upsell2`/`page-downsell` implementado
      (endpoint `/api/brevo-track-view`, commit `b8fe311`) — marca `VIEWED_UPSELL`/`VIEWED_UPSELL2`/
      `VIEWED_DOWNSELL` no contato Brevo quando a página é mesmo mostrada. Ver `BREVO_SETUP.md`
      para como usar isto para medir a "fuga" do redirect do Stripe (compradores vs quem realmente
      viu a oferta). Testado com Playwright — a chamada dispara corretamente com email + página.

## Autenticação / segurança (contexto adicional já discutido)

- Foi avaliada proteção de conteúdo pago (gating via Stripe) contra "aproveitadores" — decisão:
  não avançar por agora (baixo retorno face ao esforço para produtos de ticket baixo/médio).
  Reavaliar se: o link de acesso começar a circular fora do funil, o tráfego subir com conversão
  anómala, ou os produtos passarem a ticket mais alto/subscrição.
- Foi aplicado noindex nos PDFs (`vercel.json` + `robots.txt`) para evitar indexação no Google —
  isto já está em produção (commit `f646b38`).
