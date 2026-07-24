# Emails de abandono — Gewoon Even

Duas sequências, para dois momentos diferentes de abandono no funil. Ambas usam os atributos
Brevo que já existem no código (`api/brevo-add-contact.js` e `api/stripe-webhook.js`).

**Aviso ativo:** o webhook do Stripe está a devolver 400 ("Invalid signature"), o que significa que
`HAS_NP`/`BUYER_STATUS` não estão a ser escritos em produção neste momento. Não ligar nenhuma
automação nova no Brevo (nem a do Funil 2, nem alterar a condição de saída do Funil 1) até isso
estar confirmado como corrigido — ver `NOTES-projeto.md` para o estado da investigação.

---

## Funil 1 — Abandonou antes de comprar o Noodprotocol (€17)

**Quem entra aqui:** alguém que respondeu ao quiz e deixou o email (`page-email-capture`), mas
nunca chegou a comprar o Noodprotocol. Tecnicamente: está na lista **"Gewoon Even - Leads - #3"**
e o atributo `BUYER_STATUS` continua vazio.

**Atenção:** já existem 2 automações nesta mesma lista/condição — "Day 0 — Stille Verlies" e
"Day 3 — Functionele Klachten" (conteúdo de nutrição). Os 2 emails abaixo têm foco comercial mais
direto — sugerido encaixar como "Day 1" e "Day 5", entre os dois que já existem.

**Gatilho Brevo:** "Contato adicionado à lista" `Gewoon Even - Leads - #3` → divisão condicional
`BUYER_STATUS está vazio` → aguardar X dias → enviar.

### Email 1 (Day 1)

**Onderwerp:** Het komt meestal op het slechtste moment
**Preview:** En dan is het te laat om iets op te zoeken.

> Hoi,
>
> Gisteren beantwoordde je een paar vragen over hoe je lichaam reageert op spanning.
>
> Eén ding dat bijna niemand uitlegt: op het moment dat het misgaat, kun je er niet meer over
> nadenken. Je ademhaling gaat hoog en kort, je hartslag versnelt, en het deel van je hersenen dat
> rustig kan beslissen doet even niet mee.
>
> Dat is geen karakterkwestie. Zo is een zenuwstelsel gebouwd.
>
> Daarom werkt "even diep ademhalen" op zo'n moment zelden. Je hebt niet iets nodig om over na te
> denken. Je hebt iets nodig dat al klaarstaat.
>
> Dat is het Noodprotocol. Drie audio's die je aanzet op het moment zelf. Koptelefoon op, play, en
> een stem neemt het van je over: Noodstop voor de eerste minuten, Reset om je ademhaling weer laag
> en langzaam te krijgen, Landing om terug te komen.
>
> Meer dan je telefoon heb je niet nodig. €17, en je hebt het vanavond al staan.
>
> [Ik wil het Noodprotocol →]
>
> Gewoon Even

### Email 2 (Day 5)

**Onderwerp:** Als het niets voor je is, krijg je je geld terug
**Preview:** 60 dagen. Zonder uitleg.

> Hoi,
>
> Ik snap het als je nog twijfelt. Je hebt waarschijnlijk al eerder iets geprobeerd dat niet bracht
> wat het beloofde.
>
> Daarom is het zo geregeld: je hebt 60 dagen. Luister de drie protocollen. Gebruik ze op het
> moment dat je ze nodig hebt — niet als oefening, maar echt, als het gebeurt. En kijk wat er
> verandert.
>
> Verandert er niets? Dan krijg je je €17 terug. Je hoeft niet uit te leggen waarom.
>
> Wat je in de tussentijd hebt, is dit: iets wat klaarstaat. Niet nog een ding dat je moet
> inplannen, bijhouden of volhouden. Gewoon drie audio's op je telefoon, voor het moment dat je ze
> nodig hebt.
>
> Dat is de hele beslissing.
>
> [Ja, ik neem het Noodprotocol — €17 →]
>
> Gewoon Even
>
> *De technieken zijn gebaseerd op onderzoek naar ademhaling en zenuwstelselregulatie (o.a.
> Stanford University).*

---

## Funil 2 — Comprou o Noodprotocol, mas recusou toda a cadeia de upsell

**Quem entra aqui:** alguém com `HAS_NP = true` mas sem `HAS_P7D`, `HAS_SLAAP` nem `HAS_CK`
marcados a `true`.

**Gatilho Brevo (novo, ainda não existe):** filtro personalizado → `HAS_NP is true` **E**
`HAS_P7D is empty` **E** `HAS_SLAAP is empty` **E** `HAS_CK is empty` → aguardar 1 dia → enviar.

### Email 1 (Day 1 pós-compra)

**Onderwerp:** Het Noodprotocol helpt als het gebeurt
**Preview:** Er is ook iets voor de dagen ertussen.

> Hoi,
>
> Je hebt het Noodprotocol nu. Dat is het deel dat je gebruikt op het moment zelf.
>
> Maar er is een tweede deel, en dat is misschien wel het belangrijkere: de dagen ertussen. Want
> het is niet alleen dat ene moment. Het is ook de spanning die er de hele dag onder zit. De slaap
> die niet diep wordt. Het gevoel dat je constant klaarstaat voor iets wat niet komt.
>
> Daar is een noodprotocol niet voor gemaakt. Daar is het Protocol van 7 Dagen voor.
>
> Zeven dagen, elke dag één audio van twaalf minuten. Je hoeft niets te lezen, niets bij te houden
> en niets te veranderen aan je dag. Je luistert. Dat is het.
>
> Waarom zeven dagen achter elkaar? Omdat je zenuwstelsel niet leert van één keer. Het leert van
> herhaling, kort na elkaar.
>
> Omdat je het Noodprotocol al hebt: €37 in plaats van €67.
>
> [Ja, ik wil het Protocol van 7 Dagen →]
>
> Gewoon Even

### Email 2 (Day 4 pós-compra)

**Onderwerp:** Voor als een koptelefoon opzetten te veel is
**Preview:** Dan is er dit. €9.

> Hoi,
>
> Er zijn momenten waarop zelfs een audio te veel is. Je staat in de supermarkt. Of in de auto. Of
> midden in een gesprek — en je kunt geen koptelefoon opzetten en acht minuten stilzitten.
>
> Daar is de Crisiskaart voor.
>
> Eén kaart, vijf stappen, in precies de volgorde waarin je ze nodig hebt. Je print hem uit voor in
> je portemonnee, of je zet hem als achtergrond op je telefoon. Op het moment dat je hoofd te vol
> is om te bedenken wat je moet doen, staat het er gewoon.
>
> €9, één keer.
>
> [Ja, ik neem de Crisiskaart mee →]
>
> Gewoon Even

---

## Resumo de implementação (Brevo)

| Sequência | Lista/filtro | Condição | Timing |
|---|---|---|---|
| Funil 1 · Email 1 | Gewoon Even - Leads - #3 | `BUYER_STATUS` vazio | Day 1 |
| Funil 1 · Email 2 | Gewoon Even - Leads - #3 | `BUYER_STATUS` vazio | Day 5 |
| Funil 2 · Email 1 | filtro personalizado | `HAS_NP=true` e `HAS_P7D`/`HAS_SLAAP`/`HAS_CK` vazios | Day 1 pós-compra |
| Funil 2 · Email 2 | mesmo filtro | mesma condição | Day 4 pós-compra |

Todas as automações devem sair assim que a condição deixar de ser verdadeira (ex: se o cliente
comprar entretanto) — no editor Brevo isso é a opção "Sair da automação se a condição já não for
válida" na régua/regra do fluxo.

**Não montar nada disto no Brevo até o webhook do Stripe estar confirmado como corrigido** — sem
isso, os atributos que estas automações usam (`BUYER_STATUS`, `HAS_NP`, etc.) nunca mudam de
valor, e o Funil 1 continua a vender a quem já comprou.
