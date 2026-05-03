# CHANGELOG — Sessão 28 (4 fixes urgentes Felipe)

## Resumo

Felipe reportou 4 problemas. Todos corrigidos com mudanças isoladas
(sem mexer fora do escopo).

## Fix 1 — KERF de 4mm (corte de serra) que Felipe não pediu

**Sintoma:** "Espessura serra (kerf): 4 mm" aparecia automaticamente no
layout das chapas, separando peças. Felipe não queria essa perda.

**Causa raiz (DOIS bugs):**
1. `34-regras.js`: `KERF_NEST = 4` no default das regras
2. `39-chapas-aproveitamento.js`: fallback `Number(v.KERF_NEST) || 4`
   — se KERF_NEST fosse `0`, o `||` rejeitava e usava `4` (porque `Number(0)`
   é falsy).

**Correção:**
- `34-regras.js` linha 89: `KERF_NEST: 0` (default novo)
- `39-chapas-aproveitamento.js`: `DEFAULTS.KERF = 0` + helper `numOrDefault()`
  que aceita `0` como valor válido (`Number.isFinite` em vez de `||`)

**Atenção Felipe:** se você já editou as regras no app antes (Cadastros >
Regras > Cálculo de Chapas), o valor antigo `4` está salvo no localStorage
e vai prevalecer sobre o novo default. Para zerar:
- Vá em **Cadastros > Regras > Cálculo de Chapas**
- Mude **KERF_NEST** para `0`
- Salve

(Se você nunca editou essa tela, o novo default `0` já vale — não precisa fazer nada.)

---

## Fix 2 — Editar Qtd de cortes não recalculava Kg Líquido/Bruto

**Sintoma:** ao editar manualmente a quantidade de cortes na tabela
(coluna Qtd), os subtotais Folha/Portal e os cards "Kg Líquido / Kg Bruto
/ Aproveitamento" no Planificador NÃO atualizavam.

**Causa raiz:**
A função `recalcularPerfisESalvarNoFab(versao, itens)` rodava o motor de
perfis e gerava `result.kgLiqTotal` / `kgBrutoTotal` SEM aplicar os
overrides do usuário. Os overrides só eram aplicados na renderização da
tabela (linha individual), mas o `result` global usava cortes ORIGINAIS.

Além disso, ao editar Qtd, o handler chamava `renderCortesPorItemContent`
que re-renderizava só a tabela — os cards do Planificador (que estão
em outro mount) ficavam intactos com dados antigos.

**Correção (12-orcamento.js):**

1. `recalcularPerfisESalvarNoFab` agora lê `lev_ajustes` e aplica:
   - `overrides[k]` → sobrescreve `comp` e `qty` dos cortes ANTES de gerar `cortesPorCodigo`
   - `excluidas` → remove cortes excluídos
   - `extras` → adiciona linhas manuais
   - Tudo passa pelo `PerfisCore.calcularPorCodigo` que produz o `result` final

2. Handler de edit (`.lvp-edit-comp` / `.lvp-edit-qty`):
   - Antes: `renderCortesPorItemContent(mount, calc)` — só re-renderiza tabela com calc antigo
   - Agora: `renderLevPerfisTab(mount.parentElement)` — re-renderiza aba inteira, regerando o `calc` (que agora aplica overrides)

**Resultado:** ao editar Qtd ou Tamanho, **tudo** recalcula:
- Peso da linha individual
- Subtotais Folha/Portal/Fixo
- Cards Kg Líquido / Kg Bruto / Aproveitamento / Total Barras / Perda
- Total de barras necessárias
- Custo de Perfis (auto-salva no `custoFab`)

---

## Fix 3 — Difícil abrir layout de cada chapa

**Sintoma:** "tenho que ir de uma página pra outra para abrir" — ao
clicar nas tabs "Chapa 1 (97%) / Chapa 2 (95%) / ..." só trocava o SVG
visível embaixo. Pra abrir o modal completo de zoom, tinha que clicar
NO SVG depois disso.

**Correção (12-orcamento.js):**
Handler do `[data-tab-chapa]` agora **abre o modal direto** na chapa
clicada, com navegação ← Chapa anterior / Próxima chapa → como antes.

**Resultado:** clica em "Chapa 5 (92%)" → abre direto o modal mostrando
a chapa 5 em tela cheia.

---

## Fix 4 — Relatório de Chapas com custo unitário, total e disposição das peças

**Sintoma:** "precisava desta parte geral, custo unitário custo total no
relatório e principalmente a disposição das chapas em cada layout".

**Correção (12-orcamento.js + styles/28-rep-painel.css):**
A função `renderRelChapas(versao)` foi reescrita para mostrar:

### 1. Resumo geral por cor (3 colunas, mais info)
- Chapa-mãe (descrição)
- Dimensão (largura × altura)
- Total chapas
- Total peças
- Aproveitamento médio
- Área usada (m²)
- Área sobra (m²)
- **Custo unitário** (R$/chapa) ← novo
- **Custo total** (R$ todas) ← já existia mas em destaque

### 2. Tabela detalhada por chapa (novo)
| Chapa | Peças | Área usada | Aprov. | Custo R$ |
|-------|-------|-----------|--------|----------|
| 1 | 6 | 8.21 m² | 97% | R$ 350,00 |
| 2 | 5 | 8.10 m² | 95% | R$ 350,00 |
| ... | ... | ... | ... | ... |
| **Total** | **64** | **90.12 m²** | **91.0%** | **R$ 3.850,00** |

### 3. Disposição das peças por chapa (novo)
Para cada chapa, lista as peças posicionadas agrupadas por (label + dimensão):

> **Chapa 1** — 97% aproveitamento, 6 peça(s)
> | Peça | Dimensão | Qtd |
> |------|----------|-----|
> | Tampa Maior 01 | 1480×5679 mm | 1 |
> | Tampa Menor | 248×5679 mm | 4 |
> | Acabamento Lateral 1 | 88.5×5679 mm | 1 |

CSS adicionado para as novas tabelas (`.rel-chapas-tabela`,
`.rel-chapa-pecas-tabela`, `.rel-chapa-detalhe`).

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `scripts/34-regras.js` | KERF_NEST default 4 → 0 |
| `scripts/39-chapas-aproveitamento.js` | DEFAULTS.KERF = 0; helper `numOrDefault()` |
| `scripts/12-orcamento.js` | recalcularPerfisESalvarNoFab aplica overrides; handler edit re-renderiza aba inteira; tab Chapa N abre modal direto; renderRelChapas reescrita |
| `styles/28-rep-painel.css` | CSS das novas tabelas do relatório |

## Compatibilidade

✅ Lógicas existentes preservadas (overrides, excluídas, extras já
existentes do session 06 continuam funcionando — apenas agora também
afetam os cards globais).

✅ Modal de layout de chapa não foi tocado — só o handler que abre.

✅ Relatório PNG/PDF continua exportando (a nova estrutura HTML é
compatível com o exportarRelatorioPNG existente).

✅ Se Felipe não editou regras antes, KERF=0 já entra em vigor.

## O que NÃO foi mudado (não pediu)

- APARAR_NEST (5mm) preservado — Felipe não reclamou disso
- Estrutura do modal de layout (botões anterior/próxima, zoom)
- Algoritmo de nesting/BLF
- Cálculo de cortes de chapas individuais (peças do motor)
