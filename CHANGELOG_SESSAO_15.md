# PROJETO 15 — 2 pendências do Felipe

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | 🔴 Tabelas do Planificador esticando coluna inteira | ✅ | 14-lev-perfis.css |
| 2 | Por que Revestimento de Parede está bloqueado? | ✅ Liberado | 12-orcamento.js |

---

## Item 1 — 🔴 Colunas esticadas no Planificador (Imagem 1)

**Pedido textual:** *"ja pedi 4 mil vezes para as colunas ficarem
sem utilizar a coluna inteira"*

**Causa raiz:** Na **sessão 6** corrigimos a tabela `.lvp-table`
(Cortes por Item) trocando `width: 100%` por `width: max-content`.
Isso resolveu o problema *naquela* tabela, mas a tabela `.lvp-rel-barras`
(Planificador de Barras — outra aba!) **continuou com `width: 100%`**.

Como a Image 2 (Cortes por Item) está OK e a Image 1 (Planificador)
está esticada, fica claro que são tabelas diferentes — e a correção
nunca chegou na segunda.

**Correção:** Aplicado o mesmo fix na `.lvp-rel-barras`:

```css
/* ANTES — esticava */
.lvp-rel-barras {
  width: 100%;          /* ← 1500px de tabela */
  /* ... */
}

/* DEPOIS — compacto */
.lvp-rel-barras {
  width: max-content;   /* ← 620px de tabela (só conteúdo) */
  max-width: 100%;      /* mas nunca passa do container */
}
```

Também alinhei o padding com a `.lvp-table`:
- thead: `6px 8px → 5px 6px`
- tbody: `5px 8px → 4px 6px`
- Adicionado `white-space: nowrap` em todas as células e título

**Validação visual com Playwright:**
- Antes: tabela 1500px (esticava 100% do container)
- Depois: **tabela 620px** (só conteúdo, container fica vazio do lado)

Colunas ficam alinhadas, sem espaços vazios entre conteúdo, números
em monospace tabular pra alinhar nas posições.

---

## Item 2 — Revestimento de Parede liberado

**Pedido textual:** *"e porque nao esta liberado revestimento de parede?"*

**Investigação:** Em `12-orcamento.js` linha 1860, o tipo `revestimento_parede`
estava marcado:

```js
{
  id: 'revestimento_parede',
  ativo: false,                              // ← bloqueava
  statusLabel: 'aguardando especificacao',
}
```

Mas verificando os módulos, **os motores já existem**:
- `scripts/37-perfis-rev-parede.js` exporta `window.PerfisRevParede`
- `scripts/40-chapas-rev-parede.js` exporta `window.ChapasRevParede`
- Form próprio em `renderItemTab` linha ~2398 (`if (item.tipo === 'revestimento_parede')`)
- Schema do item documentado linha 1915

Foi marcado inativo numa sessão antiga "por garantia" mas está pronto.

**Correção:** `ativo: false → ativo: true`. Removido também o
`statusLabel: 'aguardando especificacao'`.

Agora ao criar item Revestimento de Parede:
1. Aparece habilitado na escolha de tipo
2. Form próprio carrega (largura/altura totais da parede + cor)
3. Motor calcula chapas + perfis igual aos outros tipos

---

## Princípios respeitados

- **Modular**: o fix CSS foi pontual em `.lvp-rel-barras`, não
  afetou outras tabelas do sistema
- **Sem regressão**: `.lvp-table` (Cortes por Item) ficou intocada —
  já estava certa
- **Reuso**: aplicado **mesmo padrão** que a tabela `.lvp-table`
  já usava (`width: max-content`)

## Arquivos alterados

```
scripts/12-orcamento.js (~3 linhas)
  - revestimento_parede ativo: false → true

styles/14-lev-perfis.css (~10 linhas)
  - .lvp-rel-barras: width 100% → max-content
  - padding alinhado com .lvp-table (5px/6px)
  - white-space: nowrap em titulo + cells
```

## Como reverter

1. **Item 1**: voltar `width: 100%` na `.lvp-rel-barras`
2. **Item 2**: voltar `ativo: false` no objeto `revestimento_parede`
