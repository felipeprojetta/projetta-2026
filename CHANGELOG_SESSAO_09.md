# PROJETO 09 — 5 pendências do Felipe

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | Largura das colunas no Lev. Perfis (mais compacto) | ✅ | 14-lev-perfis.css |
| 2 | Fundo laranja claro esfumaçado nas linhas dos perfis | ✅ | 14-lev-perfis.css |
| 3 | **🔴 Bug crítico**: 3 portas e o sistema não multiplicava qtd das peças | ✅ | 38-chapas-porta-externa.js |
| 4 | Mostrar quantidade de portas no header da tabela | ✅ | 12-orcamento.js + 31-perfis-porta-externa.js |
| 5 | **🔴 Bug crítico**: Fita Acabamento Menor/Maior/Largura com qtd errada | ✅ | 38-chapas-porta-externa.js |

---

## Itens 1+2 — Visual da tabela do Lev. Perfis

**Pedido textual:** *"o que tem a dizer sobre largura de colunas? coloque no
perfis esse itens com fundo laranja claro bem esfumacado"*

**Correção:**
- Padding reduzido: thead `6px/8px → 5px/6px`, tbody `5px/8px → 4px/6px`
  (R06 — colunas mais compactas, sem espaços gigantes)
- Zebra cinza (`#E4E8EE`) trocado por fundo **laranja claro esfumaçado**:
  - Linhas pares: `#fff5ed` (peach muito leve)
  - Linhas ímpares: `#fffaf5` (cream quase branco)
- Mantém legibilidade + dá um toque visual quente que combina com a
  identidade Projetta (laranja)

---

## Item 3 — 🔴 Bug crítico: qtd de portas não multiplicava

**Pedido textual:** *"coloquei 3 portas na porta sucupira nao multiplicou
pela quantidade de porta portanto coloque alino quadro de identificacao
da porta aonde tem largura altura etc quantidade do item e multiplique
adequadamente"*

**Causa raiz:** A função `criarAddFn` em `38-chapas-porta-externa.js`
adicionava cada peça com `qtd: Math.round(qtd)` — onde `qtd` era a
quantidade ORIGINAL da fórmula da peça (1 cava por porta, 2 acabamentos
por porta, etc). **Não multiplicava por `item.quantidade`**.

Resultado: configurando 3 portas, o motor gerava 1 cava em vez de 3,
2 acabamentos em vez de 6, etc. O orçamento ficava errado em escala.

**Correção:**
```js
// Pega a qtd do item logo no início (1 vez)
const qtdItem = Math.max(1, parseInt(ctx.item?.quantidade, 10) || 1);
return function add(id, label, larg, alt, qtd, opts) {
  // ...
  pecas.push({
    // ...
    qtd: Math.round(qtd) * qtdItem,  // ← MULTIPLICA
    // ...
  });
};
```

**Validação com testes:**

Cenário: porta 2000×4400mm, modelo 1, **quantidade 3**, cor única Wood Sucupira.

| Peça | Qtd antes (1 porta) | Qtd agora (3 portas) | Esperado |
|---|---:|---:|---:|
| Cava | 1×2 lados = 2 | 1×3×2 = 6 | ✅ 6 |
| L da Cava | 2×2 = 4 | 2×3×2 = 12 | ✅ 12 |
| Tampa Maior | 1×2 = 2 | 1×3×2 = 6 | ✅ 6 |
| Acabamento Lateral 1 | 1×2 = 2 | 1×3×2 = 6 | ✅ 6 |
| Tampa de Furo | 2×2 = 4 | 2×3×2 = 12 | ✅ 12 |

Todas as peças agora escalam corretamente.

---

## Item 5 — 🔴 Bug crítico: Fita Acabamento qtd errada

**Pedido textual:** *"Fita Acabamento Menor, Maior e Largura sao apenas
2 itens se cor for igual e nao 4 e se for cor diferente 1 ext e 1 interno"*

**Causa raiz:** As 3 Fitas (Menor, Maior, Largura) eram geradas com
`qtd=2` em CADA chamada de `add()`. Como a função é executada 1 vez por
lado (externo + interno), gerava 2+2 = **4 fitas totais**. Mas o correto
é 2 totais (igual ao U_PORTAL — peça única da porta, não duplicada por
lado).

**Correção:** Mesma lógica que o U_PORTAL já tinha:
- **Cor única** (cor ext = cor int): 2 fitas só no lado externo, 0 no interno
  → Total: **2** ✅
- **Cor diferente**: 1 fita no externo + 1 no interno → Total: **2** ✅

```js
const qtdFitaCorUnica = (ctx.lado === 'externo') ? 2 : 0;
const qtdFitaCorDiff  = 1;
const qtdFita = ctx.corUnica ? qtdFitaCorUnica : qtdFitaCorDiff;
if (qtdFita > 0) {
  add('fit_acab_me', 'Fita Acabamento Menor', ..., qtdFita, ...);
  add('fit_acab_ma', 'Fita Acabamento Maior',  ..., qtdFita, ...);
  add('fit_acab_lar_fita', 'Fita Acabamento Largura', ..., qtdFita, ...);
}
```

**Validação:**

Cenário: 3 portas, **cor única**:
- Fita Menor: 6 só no externo ✅ (= 2 por porta × 3 portas)

Cenário: 3 portas, **cor diferente**:
- Fita Menor: 3 ext + 3 int = 6 ✅ (= 1+1 por porta × 3 portas)

---

## Item 4 — Quantidade no header

**Pedido textual:** *"coloque alinho quadro de identificacao da porta
aonde tem largura altura etc quantidade do item"*

**Correção:** Adicionado `· N portas` (em negrito) no header tanto da
aba **Lev. Superfícies** quanto da aba **Lev. Perfis**, ao lado das
dimensões e modelo.

Exemplo:
- Antes: `Item 1 — Porta Externa, 2000×4400mm, 1 folha, modelo 1`
- Depois: `Item 1 — Porta Externa, 2000×4400mm, 1 folha, modelo 1, **3 portas**`

Quando qtd=1 não mostra (mesma UX de antes).

---

## Princípios respeitados

- **Modular**: bug do qtd corrigido NA FONTE (criarAddFn) — afeta
  todos os modelos automaticamente, sem mexer em cada `add()` individual
- **Sem regressão**: motor de cálculo de PERFIS (`31-perfis-porta-externa.js`,
  `30-perfis-core.js`) já considerava `item.quantidade` corretamente
  (linha 244: `Math.max(1, parseInt(item.quantidade, 10) || 1)`).
  Bug era SÓ no motor de CHAPAS/SUPERFÍCIES.
- **R01** (2 casas decimais): preservado
- **R06** (sem espaços gigantes): aplicado no padding ainda menor

## Pendências conhecidas

- A regra do U_PORTAL (cor única → 1 só no externo, cor diferente → 1+1)
  segue inalterada — Felipe confirmou que esse padrão já estava certo,
  só faltava aplicar nas Fitas.
- O cálculo de PESO TOTAL nas tabelas de superfícies (`Peso total (kg)`)
  agora reflete corretamente a multiplicação porque é `peso_unidade × qtd`
  — qtd já vem multiplicado pelo qtdItem.

## Arquivos alterados

```
scripts/12-orcamento.js              (+1 linha — quantidade no header LevSup)
scripts/31-perfis-porta-externa.js   (+5 linhas — quantidade no header LevPerfis)
scripts/38-chapas-porta-externa.js   (+30 linhas — qtd × item.quantidade + Fitas)
styles/14-lev-perfis.css             (~10 linhas — fundo laranja + padding compacto)
```

## Como reverter

1. **Item 3**: voltar `qtd: Math.round(qtd)` em criarAddFn (REINTRODUZ BUG)
2. **Item 5**: voltar as 3 chamadas de Fita Acabamento para `qtd=2` fixo (REINTRODUZ BUG)
3. **Item 4**: tirar `if (qtd > 1) partes.push(\`${qtd} portas\`)` em descricaoItem
4. **Itens 1+2**: voltar `padding: 6px 8px` e `background: #E4E8EE`
