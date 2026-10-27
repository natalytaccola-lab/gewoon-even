// Catalogo do checkout embutido e do upsell de um clique.
//
// O preco vem sempre do Payment Link correspondente (o mesmo que o site usava),
// para haver um so' sitio onde o preco muda: o painel da Stripe. O valor aqui
// e' so' uma verificacao: se o Payment Link devolver outro valor, o checkout
// recusa, em vez de cobrar um preco que ninguem confirmou.
//
// `retorno`: o hash para onde a pessoa volta depois de pagar (as mesmas rotas
// #betaald-* dos Payment Links). `depois`: os produtos que podem ser cobrados
// com um clique a seguir a este, com a mesma forma de pagamento.
export const PRODUTOS = {
  np:    { plink: 'plink_1TONsUAqip58UYzss1VqvTEE', valor: 1700, nome: 'Noodprotocol',     retorno: '#betaald-np-17ypqz', depois: ['p7', 'slaap'] },
  p7:    { plink: 'plink_1Twj9OAqip58UYzsN0MaOzuM', valor: 3700, nome: 'Protocol 7 Dagen', retorno: '#betaald-p7-di0vtq', depois: ['slaap'] },
  slaap: { plink: 'plink_1TwOREAqip58UYzsKopbSzg', valor: 6700, nome: 'Slaapprotocol',    retorno: '#betaald-sl-4tfsbz', depois: [] },
  ck:    { plink: 'plink_1TONwAAqip58UYzsNk83iMUv', valor:  900, nome: 'Crisiskaart',      retorno: '#betaald-ck-0jj2uk', depois: [] }
};

// Order bump: o produto que se pode juntar no proprio checkout de outro
// (a caixinha "voeg toe" da Stripe). No Noodprotocol, a Crisiskaart.
// Nos Payment Links o bump e' configurado no painel da Stripe (itens
// opcionais do link); no checkout embutido, em api/checkout.js.
export const BUMP = { np: 'ck' };

// Os produtos de uma compra, pelo valor pago: um so' produto, ou o produto
// principal mais o seu bump (EUR 17 + EUR 9 = EUR 26). O principal vem primeiro.
export function produtosPorValor(centimos) {
  const um = Object.keys(PRODUTOS).find(k => PRODUTOS[k].valor === centimos);
  if (um) return [um];
  for (const principal of Object.keys(BUMP)) {
    const extra = BUMP[principal];
    if (PRODUTOS[principal].valor + PRODUTOS[extra].valor === centimos) return [principal, extra];
  }
  return [];
}

// Produto de uma compra antiga (Payment Link, sem metadata), pelo valor. Com
// bump, conta o principal: e' dele que sai a cadeia do upsell.
export function produtoPorValor(centimos) {
  return produtosPorValor(centimos)[0] || null;
}

// Janela do upsell de um clique: so' logo a seguir a compra anterior.
export const JANELA_UPSELL_MS = 3 * 60 * 60 * 1000;

export const BASE_SITE = 'https://gewoon-even.nl';

const cachePreco = {};
export async function precoDe(stripe, chave) {
  if (cachePreco[chave]) return cachePreco[chave];
  const p = PRODUTOS[chave];
  const itens = await stripe.paymentLinks.listLineItems(p.plink, { limit: 1 });
  const preco = itens.data[0] && itens.data[0].price;
  if (!preco || preco.unit_amount !== p.valor || preco.currency !== 'eur') {
    throw new Error(`preco do ${chave} nao confere (${preco && preco.unit_amount} ${preco && preco.currency})`);
  }
  cachePreco[chave] = preco.id;
  return preco.id;
}

export const emailValido = e => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const refValido = r => typeof r === 'string' && /^ge1[A-Za-z0-9_-]{0,197}$/.test(r);
