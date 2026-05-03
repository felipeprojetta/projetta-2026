# PROJETO 13 — 6 pendências do Felipe

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | Disco de corte = 4mm (KERF inteiro), não 2mm | ✅ | 12-orcamento.js |
| 2 | "Salvar como Versão" sai da aba Item, vai pro DRE | ✅ | 12-orcamento.js |
| 3 | Formato R$ 29.426,14 (com ponto de milhar) — não 29426,14 | ✅ | 12-orcamento.js |
| 4 | Revisão geral de formatação | ✅ | 12-orcamento.js |
| 5 | Custo Fabricação separado por item (mesmo com 1 item) | ✅ | 12-orcamento.js |
| 6 | Card do CRM com 3 valores (Proposta + Com Desconto + Cliente Paga) | ✅ | 10-crm.js + 11-crm.css |

---

## Item 1 — Corte mm = 4mm (KERF inteiro)

**Pedido textual:** *"perda no disco de corte = 2mm para corte perfis
de 4 mm nao 2 mm"*

**Histórico do confusão:** Na sessão 11, eu havia REMOVIDO a coluna
"Corte mm" achando que `KERF/2 = 2mm` era info técnica desnecessária.
Felipe agora pediu de volta com o valor CORRETO: o KERF inteiro
(4mm — perda total entre 2 cortes), não a metade.

**Correção:** Coluna "Corte mm" voltou na tabela do Lev. Perfis,
com valor lido direto de `window.PerfisCore.KERF` (= 4mm):

```js
const kerfMm = (window.PerfisCore && window.PerfisCore.KERF) || 4;
// ...
<td class="num">${kerfMm}</td>  // mostra 4 (não 2)
```

Tooltip no `<th>`: *"Perda do disco de corte (KERF)"*. Colspans
ajustados: `9→10` (com Corte mm), subtotais `7→8`.

---

## Item 2 — Botão "Salvar como Versão" migrou da aba Item pro DRE

**Pedido textual:** *"TIRAR ESSE BOTAO SALVAR COMO VERSAO 1 NAO E AI
QUE SALVA NADA E NO DRE QUE SALVA COMO VERSAO 1 E CONGELA 100% DA
PLANILHA"*

**Razão:** Salvar versão na aba Item não fazia sentido — Item é só
o cadastro inicial (largura/altura/modelo). É no DRE que o orçamento
está completo e faz sentido CONGELAR como histórico.

**Correção:**
- ❌ Removido `📌 Salvar como Versao N` da aba Item
- ✅ Adicionado `📌 Salvar como Versao N e Congelar` no DRE
- Handler na DRE: `salvarItensNoBanco() → fecharVersao() → criarVersao()`
- Mensagem: *"Versao N congelada. Editando agora a Versao N+1."*

Botão **só aparece** se versão não estiver fechada. Texto explicito
"e Congelar" pra deixar claro que é a ação imutável.

---

## Items 3 + 4 — Formato R$ 29.426,14 (ponto de milhar)

**Pedido textual:** *"DA PLANILHA DEVE TER OS NUMEROS R$ 29.426,14
EM VEZ DE R$ 29426,14 REVISE GERAL CADA ABA CADA MILIMETRO"*

**Causa raiz:** A função `fmtBR` em `08-helpers.js` usa
`toLocaleString('pt-BR', ...)` que **já adiciona ponto de milhar
automaticamente**. Mas em **23 lugares** do `12-orcamento.js`
estavam usando `.toFixed(2).replace('.', ',')` que NÃO adiciona
ponto de milhar.

**Correção:** Substituídos os 23 lugares por `fmtBR()` (via Python regex):

```js
// ANTES — sem ponto de milhar
totalRev.toFixed(2).replace('.', ',')   →  "29426,14"

// DEPOIS — com ponto de milhar (toLocaleString)
fmtBR(totalRev)                          →  "29.426,14"
```

**Lugares afetados:**
- Resumo Total da aba Lev. Superfícies (Custo Total Revestimento)
- Tabelas de custo por cor (preço unit, subtotal)
- Indicadores de peso (porta, portal, revestimento, comprado, desperdício)
- Cards de aproveitamento de chapas
- Diálogo de feedback do duplo clique nas chapas
- Tabela de superfícies por cor

**Não alterados** (intencional): inputs editáveis em `20-perfis.js`
— campos onde o usuário digita valores não devem ter ponto de milhar
(atrapalha edição).

---

## Item 5 — Custo Fabricação por item SEMPRE

**Pedido textual:** *"CUSTOS FABRICACAO AINDA NAO ALTEROU POR ITEM
CONTINUA 1 SO"*

**Causa raiz:** A tabela "Distribuição por Item" criada na sessão 10
tinha condição `versao.itens.length > 1` — só aparecia com 2+ itens.
Felipe quer ver mesmo com 1 só item.

**Correção:** Trocou condição para `>= 1` — agora sempre aparece a
tabela com:
- Custo Fab daquele item
- Custo Inst (proporcional ao subFab)
- % do total (100% se 1 item só)
- Preço Final (pTab — com markup)

Conservação numérica: soma dos itens = total agregado (validado).

---

## Item 6 — Card do CRM com 3 valores

**Pedido textual:** *"A FINALIZAR ORCAMENTO MOVA CARD PARA ORCAMENTO
PRONTO E LEVE VALOR PARA CARD COM PRECO PROPOSTA E PRECO PROPOSTA COM
DESCONTO (E MAIS PRECO CLIENTE PAGA)"*

**Mover card pra "Orçamento Pronto":** já estava implementado em
`aprovarOrcamento` (linha 1090: `lead.etapa = 'orcamento-pronto'`)
em sessão anterior. Confirmado funcionando.

**3 valores no card:** antes mostrava 2 (Proposta + Com Desconto).
Agora mostra 3:

```
┌─ Cartão CRM ────────────────────────────┐
│ Adriano Silva                           │
│ ...                                      │
│ Preço da Proposta:    R$ 175.072,28 ←riscado (cinza)
│ Com desconto:         R$ 140.057,82  ←riscado (cinza, menor)
│ ─────────────────────────────────────  │
│ Cliente Paga:         R$ 140.057,82  ←laranja, negrito, maior
└──────────────────────────────────────────┘
```

CSS:
- `.crm-card-valor-tabela` (Proposta) — riscado, cinza
- `.crm-card-valor-desconto` (Com desconto) — riscado, cinza menor
- `.crm-card-valor-row-final` — borda em cima, padding extra
- `.crm-card-valor` (dentro do row-final) — laranja, font-size 13px, weight 700

Quando NÃO há desconto (precoProposta = valorFinal): mostra apenas
1 valor (não polui).

---

## Princípios respeitados

- **Modular**: cada correção isolada no módulo correto
- **Backward compatible**: `fmtBR` já era a função correta — só
  trocamos chamadas que usavam o método antigo `toFixed.replace`
- **Sem regressão**: testes de sintaxe passam em todos os arquivos
- **R01** (2 casas): mantido — `fmtBR` força `minimumFractionDigits: 2`
- **R06** (sem espaços gigantes): coluna Corte mm tem `min-width`
  pequeno por padrão da tabela `lvp-table`

## Arquivos alterados

```
scripts/12-orcamento.js  (~70 linhas)
  - Coluna Corte mm + colspans (rowHtml + thead, ~15 linhas)
  - Botão Salvar como Versão removido da aba Item (~3 linhas)
  - Botão Salvar como Versão e Congelar adicionado na DRE (~10 linhas)
  - Handler do novo botão DRE (~30 linhas)
  - 23 substituições de toFixed → fmtBR
  - Condição `>= 1` em vez de `> 1` na tabela Distribuição por Item

scripts/10-crm.js  (~12 linhas)
  - 3a linha "Cliente Paga" no card

styles/11-crm.css  (~22 linhas)
  - .crm-card-valor-desconto (riscado, cinza)
  - .crm-card-valor-row-final (borda separadora + destaque)
```

## Como reverter

1. **Item 1**: remover coluna `Corte mm` do thead e `<td class="num">${kerfMm}</td>` do rowHtml
2. **Item 2**: voltar botão Salvar Versão para `renderItemTab` e remover do DRE
3. **Items 3+4**: substituir `fmtBR(x)` por `x.toFixed(2).replace('.', ',')` (REINTRODUZ BUG sem ponto)
4. **Item 5**: voltar `> 1` em vez de `>= 1`
5. **Item 6**: remover `.crm-card-valor-row-final` do card
