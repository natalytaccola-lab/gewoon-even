# Brevo + Stripe Setup

Documenta as integrações com Brevo (email marketing) e Stripe (webhook de compras) no projeto gewoon-even.

Ambas as integrações estão em modo **defensivo**: o código está deployado mas só ativa quando as variáveis de ambiente forem configuradas no Vercel.

---

# Brevo Email Capture Setup

A captura de email acontece no `index.html` em `handleEmailSubmit()`, que dispara um `fetch` fire-and-forget para `/api/brevo-add-contact`.

## Variáveis de ambiente necessárias

| Nome | Descrição | Onde obter |
|------|-----------|------------|
| `BREVO_API_KEY` | API key da conta Brevo (xkeysib-...) | Brevo Dashboard → SMTP & API → API Keys |
| `BREVO_LIST_ID` | ID numérico da lista de leads | Brevo Dashboard → Contacts → Lists |

## Como configurar no Vercel

1. Acessa https://vercel.com/dashboard → projeto gewoon-even → Settings → Environment Variables
2. Adiciona `BREVO_API_KEY` (Production scope)
3. Adiciona `BREVO_LIST_ID` (Production scope)
4. Redeploy o projeto (ou aguarda próximo commit)

## Como testar

```
curl -X POST https://gewoon-even.vercel.app/api/brevo-add-contact \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

- Sem env vars: `{"ok":true,"noop":true}`
- Com env vars OK: `{"ok":true,"contactId":<id>}`

---

# Stripe Webhook Setup

O webhook Stripe está implementado de forma defensiva em `/api/stripe-webhook`.
Quando ativado, taggeia automaticamente compradores no Brevo com:
- `BUYER_STATUS: active`
- `LAST_PURCHASE_DATE`
- `LAST_PURCHASE_AMOUNT` 
- `LAST_PRODUCT_TAG` (buyer_crisiskaart | buyer_noodprotocol | buyer_protocol7)

## Variáveis de ambiente adicionais necessárias

| Nome | Descrição | Onde obter |
|------|-----------|------------|
| `STRIPE_SECRET_KEY` | Secret key do Stripe (sk_live_... ou sk_test_...) | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Signing secret do endpoint (whsec_...) | Stripe Dashboard → Developers → Webhooks → endpoint |

## Como configurar no Stripe

1. Acessa https://dashboard.stripe.com/webhooks
2. Clica em "Add endpoint"
3. Endpoint URL: `https://gewoon-even.vercel.app/api/stripe-webhook` (ou domínio final)
4. Eventos a escutar: marca apenas `checkout.session.completed`
5. Após criar, clica no endpoint e copia o "Signing secret" (whsec_...)
6. Cola esse valor em `STRIPE_WEBHOOK_SECRET` no Vercel

## Como testar

Stripe Dashboard → Webhooks → endpoint → "Send test webhook" → seleciona `checkout.session.completed` → envia.

Verifica nos Logs do Vercel se apareceu:
```
[Stripe Webhook] Tagged <email> as <tag> (€<amount>)
```

## Mapping de produtos → tags

Mapping atual em `getProductTag()` é por valor (em cents):
- 900 (€9) → `buyer_crisiskaart`
- 1700 (€17) → `buyer_noodprotocol`
- 2700 (€27) → `buyer_noodprotocol` (preço futuro)
- 3700 (€37) → `buyer_protocol7`
- 4700 (€47) → `buyer_protocol7` (preço futuro)

Se adicionar produtos novos (ex: Slaapprotocol €67), adicionar caso no helper.

---

# Tracking de visualização real das páginas de upsell

Endpoint `/api/brevo-track-view` (usa a mesma `BREVO_API_KEY`, nenhuma variável nova necessária).

Sempre que alguém vê de facto a `page-upsell`, `page-upsell2` ou `page-downsell` (não só assume-se
que viu), o `index.html` chama este endpoint fire-and-forget e marca no contato Brevo (identificado
pelo email guardado em `sessionStorage`):

- `VIEWED_UPSELL: true` + `VIEWED_UPSELL_DATE` — viu a oferta do Protocol 7 Dagen
- `VIEWED_UPSELL2: true` + `VIEWED_UPSELL2_DATE` — viu a oferta do Slaapprotocol (mini-quiz)
- `VIEWED_DOWNSELL: true` + `VIEWED_DOWNSELL_DATE` — viu a oferta da Crisiskaart

**Para que serve:** hoje não há forma de saber quantos compradores do Noodprotocol realmente
chegam a ver a `page-upsell` (o redirect do Stripe pode falhar, a aba pode fechar antes, etc.).
Com este atributo dá para medir no Brevo:

```
Contatos com HAS_NP = true          → total de compradores do Noodprotocol
Contatos com HAS_NP = true
  e VIEWED_UPSELL = true            → quantos realmente viram a oferta
```

A diferença entre os dois números é a "fuga" do redirect (pessoas que compraram mas nunca
chegaram a ver o upsell) — se for alta, é sinal de que o redirect do Stripe ou a ligação está a
falhar tecnicamente, não que as pessoas estão a recusar a oferta.

Se o contato ainda não existir no Brevo (ex: sessionStorage tinha um email nunca submetido), o
endpoint não cria nada — só atualiza contatos já existentes, para não poluir a lista.
