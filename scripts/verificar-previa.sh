#!/bin/bash
# Verifica se a pre-visualizacao da Vercel ja serve o commit esperado.
#
# O token NUNCA e' impresso, nunca vai para a URL (so' no cabecalho, para nao
# ficar em logs de servidor nem no historico do browser) e nunca e' escrito em
# ficheiro versionado. Le-se de $VERCEL_BYPASS ou de .env.local.
#
#   uso:  bash scripts/verificar-previa.sh [ref-git]   (por omissao: origin/previa-site)

set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # raiz do repositorio
URL="https://gewoon-even-git-previa-site-natalytaccola-8262s-projects.vercel.app"
REF="${1:-origin/previa-site}"
cd "$REPO" || exit 1

# --- token -------------------------------------------------------------
TOKEN="${VERCEL_BYPASS:-}"
if [ -z "$TOKEN" ] && [ -f .env.local ]; then
    TOKEN=$(grep -E '^[[:space:]]*VERCEL_BYPASS=' .env.local | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r\n')
fi
if [ -z "$TOKEN" ]; then
    echo "  SEM TOKEN. Define VERCEL_BYPASS no ~/.zshrc ou em .env.local (que ja' esta' no .gitignore)."
    exit 2
fi
echo "  token: encontrado (${#TOKEN} caracteres) — nao e' impresso"

# --- o que esperamos ---------------------------------------------------
git fetch -q origin previa-site 2>/dev/null
SHA=$(git rev-parse --short "$REF")
ESPERADO=$(git show "$REF:index.html" | grep -v 'vercel.live/_next-live/feedback' | md5 -q)
echo "  esperado: $REF = $SHA | md5 do index.html = $ESPERADO"

# --- o que a prevalidacao serve ----------------------------------------
TMP=$(mktemp -t previa); trap 'rm -f "$TMP" "$TMP.limpo"' EXIT
CODIGO=$(curl -s -o "$TMP" -w '%{http_code}' --max-time 40 \
         -H "x-vercel-protection-bypass: $TOKEN" \
         -H 'x-vercel-set-bypass-cookie: false' \
         "$URL/")
# A Vercel injecta nas PRE-VISUALIZACOES (nunca em producao) uma linha com o
# script do Vercel Live. Tira-se antes de comparar, senao o md5 nunca bate.
DEPLOY=$(grep -o 'data-deployment-id="[^"]*"' "$TMP" | head -1 | cut -d'"' -f2)
grep -v 'vercel.live/_next-live/feedback' "$TMP" > "$TMP.limpo"
SERVIDO=$(md5 -q "$TMP.limpo")
echo "  servido : HTTP $CODIGO | md5 (sem o script do Vercel Live) = $SERVIDO"
[ -n "$DEPLOY" ] && echo "  deployment: $DEPLOY"

if [ "$CODIGO" != "200" ]; then
    echo "  >> A pre-visualizacao nao respondeu 200. O token pode estar errado ou expirado."
    head -c 200 "$TMP"; echo
    exit 1
fi
if [ "$SERVIDO" = "$ESPERADO" ]; then
    echo "  >> OK: a pre-visualizacao serve exactamente o $SHA."
else
    echo "  >> AINDA NAO: o conteudo servido nao e' o do $SHA (deploy por terminar, ou outro commit)."
    for M in pg67-fragment gv-cont p67-handleiding-capa gv-tel-ecra; do
        printf "     marcador %-22s %s\n" "$M" "$(grep -c "$M" "$TMP.limpo")"
    done
    exit 3
fi

# --- recursos criticos --------------------------------------------------
for A in img/p67-handleiding-capa.webp img/p67-hero-nachtlamp.webp img/p67-luisteren-koptelefoon.webp img/inslapen-sample.mp3; do
    C=$(curl -s -o /dev/null -w '%{http_code} %{size_download}' --max-time 30 \
        -H "x-vercel-protection-bypass: $TOKEN" "$URL/$A")
    printf "  %-34s %s\n" "$A" "$C"
done
