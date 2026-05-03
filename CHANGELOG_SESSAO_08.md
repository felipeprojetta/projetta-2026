# PROJETO 08 — 4 pendências do Felipe

## Resumo executivo

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| A | Aproveitamento — peças espalhadas (Chapa 6 com 27%, sobra gigante) | ✅ | 39-chapas-aproveitamento.js |
| B | "O que são esses números #101 #134?" no layout | ✅ | 12-orcamento.js |
| C | Bug: "Ver Layout" não abre na 1ª vez (só após trocar/voltar de aba) | ✅ | 12-orcamento.js |
| D | DRE: Markup Desc e Desconto sempre 20% — tirar regra do arquiteto | ✅ | 12-orcamento.js |

---

## Item A — Compactação BLF para chapas com baixo aproveitamento

**Pedido textual:** *"olha so esse aproveitamento, peças devem ser ao máximo
junto das outras"* (Imagem 1: Chapa 6 com 27% — 7 peças finas espalhadas
em fileiras separadas com gaps grandes verticais)

**Causa raiz:** O algoritmo `multi_horiz` (guillotine) coloca peças em
fileiras horizontais. Quando a salvage pass realoca peças (preenchendo
sobras com Maximal Rectangles), ela posiciona em pontos isolados, criando
gaps verticais. Resultado: peças finas como Acabamento Lateral acabavam
espalhadas em vez de empilhadas.

**Correção:** Adicionada **terceira passada** após salvage:

```js
// Para cada chapa com aproveitamento < 40%, re-empacota suas peças
// usando BLF (Bottom-Left-Fill) puro. BLF tende a manter peças
// junto do canto inferior-esquerdo, eliminando gaps.
melhor.chapas.forEach(c => {
  const taxa = areaUsada / areaTotal;
  if (taxa >= 0.40) return;  // já compacta o suficiente
  if (c.pecasPosicionadas.length < 2) return;
  
  const pecasRepack = c.pecasPosicionadas.map(...);
  const repacked = nestingBLF(pecasRepack, ...);
  if (repacked.chapas.length === 1 && !repacked.naoCouberam.length) {
    c.pecasPosicionadas = repacked.chapas[0].pecasPosicionadas;
    c.sobrasRetangulos = repacked.chapas[0].sobrasRetangulos;
  }
});
```

**Validação com testes unitários:**

**Caso 1** (cenário Imagem 1 — 7 peças 110×4319 em chapa 1500×5000):
- Antes: peças espalhadas em fileiras com gaps verticais
- Depois: **todas em y=5, alinhadas no topo, x crescendo de 5 → 689** ✅

**Caso 2** (misto — 14 peças variadas, chapa 1500×5000):
- Antes: 2 chapas, segunda com peças desorganizadas
- Depois: 2 chapas, **Chapa 2 com 7 peças todas em y=5** (compactada via BLF)

---

## Item B — Remover IDs internos #101 #134 do layout

**Pedido textual:** *"o que são esses numero por exemplo cava #101?"*

**Causa raiz:** O motor `expandirPecas` em `39-chapas-aproveitamento.js`
usa um contador sequencial (`#100`, `#101`, ...) pra distinguir cópias
da mesma peça (ex.: 4 Cavas viram #101, #102, #103, #104). Esse ID era
exibido no SVG do layout junto do label — Felipe achava confuso.

**Correção:** Em `12-orcamento.js`, o trecho que renderiza texto da peça
foi simplificado:

- **Peças grandes** (≥60×24px no SVG): mostra só `Cava` + dimensão
  `268×4319 mm` (sem `#101` no final)
- **Peças médias/pequenas** (≥30×12px): mostra label encurtado
  (`Acab. La…` ao invés de `#137`)
- **Peças muito pequenas**: nada (igual antes)

A informação técnica do ID continua no objeto `peca.id` interno —
apenas não é mais visível no layout.

---

## Item C — Bug "Ver Layout" não abre na 1ª vez

**Pedido textual:** *"quando estou na pagina clico em ver layout e nao
vai tenho que passar para aba seguinte voltar para ai sim conseguir ver
layout"*

**Causa raiz:** O handler usava `document.getElementById(`${cardId}-layout`)`
— busca **global no documento**. Se renderizações anteriores deixaram
elementos com mesmo ID (DOM stale), `getElementById` retornava o
elemento errado (que estava fora da tela visível). O toggle então
afetava um layout invisível, e o usuário não via mudança.

Quando trocava de aba e voltava, o DOM era limpo + re-renderizado,
fazendo o getElementById pegar o elemento certo.

**Correção:** Trocou busca global por **busca relativa ao botão clicado**:

```js
// ANTES
const cardId = btnLayout.dataset.toggleLayout;
const layoutEl = document.getElementById(`${cardId}-layout`);

// DEPOIS
const cardWrap = btnLayout.closest('.orc-aprov-card-wrap');
const layoutEl = cardWrap?.querySelector('.orc-aprov-layout-wrap');
```

Funciona em qualquer estado do DOM — o botão sempre encontra o seu
próprio layout (o irmão dentro do mesmo card-wrap).

---

## Item D — DRE: Desconto fixo em 20%, remover regra do arquiteto

**Pedido textual:** *"em dre mantenha desconto e markup desconto sempre
20 tire a regra que tem relacionado a comissao do arquiteto"*

**Causa raiz:** Tinha uma regra automática (sessão 2026-05) que mudava
o Desconto baseado na Comissão RT/Arquiteto:

```js
// REMOVIDO
if (field === 'com_rt') {
  const rt = Number(v) || 0;
  novosParams.markup_desc = 20;
  novosParams.desconto = (rt >= 5) ? 15 : 20;  // ← isso!
}
```

Quando o usuário editava `com_rt`, o `desconto` era ajustado
automaticamente. Felipe não quer essa regra — quer ambos sempre 20%.

**Correção:**
1. Removido o bloco `if (field === 'com_rt')` inteiro
2. Hint do campo Desconto atualizado: `15 se RT≥5%, 20 se RT<5%` →
   `sempre 20% (fixo)`

Agora os campos `markup_desc` e `desconto` ficam fixos em 20% (default)
e só mudam se o usuário digitar manualmente.

---

## Princípios respeitados

- **Modular**: alterações isoladas (motor de chapas, render do SVG,
  handlers do toolbar, regra do DRE) — nenhum motor de cálculo de
  preço/peso foi tocado
- **Sem regressão**: passada de compactação BLF é OPCIONAL — se o
  repack falhar, mantém o layout original (try/catch)
- **R01** (2 casas): preservado nos novos cálculos
- **Sem efeitos colaterais**: passadas seguintes (DRE, Lev. Perfis,
  Custo Fab/Inst) não dependem do layout SVG, só do número de chapas
  e taxa de aproveitamento — esses valores ficam IGUAIS ou MELHORES
  com a compactação

## Pendências conhecidas

1. **Layout SVG**: o motor de coordenadas (`tx`, `ty`, `tw`, `th`)
   ainda é o mesmo — o repack BLF apenas redefine `x` e `y` das peças,
   mas o lado horizontal/vertical da chapa no SVG é decidido na render.
   Em casos extremos (ex.: chapa quadrada 1500×1500), a visualização
   pode rotacionar a chapa toda 90°.

2. **Threshold de 40%**: chapas com aproveitamento entre 40-50% não
   são re-empacotadas. Se Felipe quiser ser mais agressivo, é só
   alterar `if (taxa >= 0.40) return;` para `0.50` ou similar.

## Arquivos alterados

```
scripts/12-orcamento.js              (~25 linhas alteradas)
scripts/39-chapas-aproveitamento.js  (+45 linhas, novo bloco)
```

## Como reverter

1. **Item A**: remover bloco `melhor.chapas.forEach((c, idx) => { ...
   nestingBLF ... })` em `aproveitar()`
2. **Item B**: voltar `${escapeHtml(labelClipado)} ${escapeHtml(idStr)}`
   no `<text>` do SVG e adicionar de volta `const idStr = '#${pp.peca.id}'`
3. **Item C**: voltar pra `document.getElementById(`${cardId}-layout`)`
4. **Item D**: re-adicionar bloco `if (field === 'com_rt') { ...
   novosParams.desconto = (rt >= 5) ? 15 : 20 }`
