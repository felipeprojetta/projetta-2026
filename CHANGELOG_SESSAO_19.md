# PROJETO 19 — Refinamento dos Relatórios

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| A | Resultado por Porta como sub-aba (Image 1) | ✅ NOVA | 12-orcamento.js |
| B | Resumo da Obra no estilo igual aos outros cards | ✅ Refeito | 12-orcamento.js |
| C | Cortes por Item sem botão imprimir/exportar (Image 3) | ✅ Liberado | 13-orcamento.css |
| D | Imprimir capturando lateral inteira | ✅ Só o card agora | 12-orcamento.js |
| E | Título centralizado, menor, sem bordas | ✅ | 28-rep-painel.css |
| F | Relatório de Superfícies vai pra própria aba | ✅ | 12-orcamento.js + 13-orcamento.css |

---

## Item A — Sub-aba "Resultado por Porta"

**Pedido textual:** *"falta esse relatorio ainda"* (Image 1: card
"RESULTADO — PORTA" com Custo, Markup, Preço Tabela/Faturamento,
Detalhamento, Margens, Valores por m²)

**Investigação:** O card da Image 1 nunca existiu no projeto. Felipe
queria criar essa visão como uma 2ª sub-aba dos relatórios.

**Implementação:** Nova função `renderRelResultadoPorta(versao, dre, params, ...)`:
- Para cada item da versão, gera 1 card no estilo PROJETTA by WEIKU
- Mostra:
  - **Custo Porta** (subFab+subInst rateado por horas) + Markup s/ Custo
  - **Preço Tabela** + Preço Faturamento
  - **Detalhamento**: custo fab, custo inst, tabela só porta, faturamento só porta, instalação separada, margem bruta, margem líquida (verde se ≥ alvo, vermelho se não)
  - **Por m²**: custo/m², 4 variantes de preço/m² (tabela/fat × porta+inst/só porta), desconto aplicado quando > 0

Sub-aba aparece como `🚪 Resultado por Porta` na barra de relatórios.

---

## Item B — Resumo da Obra no mesmo estilo

**Pedido textual:** *"resumo da obra nao ficou mesmo estilo dos outros"*
(Image 2: cards verticais com ícones soltos, fora do padrão)

**Causa:** Eu havia feito Resumo da Obra com `.rep-obra-card` (cards
verticais com ícone+label+valor) — visualmente diferente dos outros
relatórios que usam `.rep-card` com cabeçalho azul "PROJETTA by WEIKU".

**Correção:** Refeito com `rep-card` (mesma estrutura do Painel Comercial,
DRE Resumida e Resultado por Porta):
- Cabeçalho azul **PROJETTA by WEIKU** + subtítulo "Resumo da Obra — Versão N"
- Identificação: itens, portas, área total
- Bloco de preços destacado: **Custo Total da Obra** + **Preço Faturamento**
- Tabela "Detalhamento por Categoria":
  - 🚪 Esquadrias (m² · portas)
  - 📏 Perfis de Aluminio
  - 🎨 Pintura (só se > 0)
  - 🟫 Chapas / Revestimento
  - 🔩 Componentes
  - 👷 Mão de Obra (Hh × N op × R$/h)
  - 🚛 Instalação
  - **Custo Total da Obra** (linha em destaque)

Visualmente IDÊNTICO aos outros 3 cards.

**Bug do `[object Object]`:** A versão antiga concatenava `fab.etapas?.portal||0`
sem `Number()`, fazendo concatenação de string em vez de soma. Agora todos
os campos passam por `Number()` antes da soma.

---

## Item C — Botões PNG/PDF no Lev. Perfis (Image 3)

**Pedido textual:** *"terceira imagem ainda nao tem botao imprimir
exportar na propria aba"*

**Causa:** Os botões `🖼 PNG` e `📄 PDF` foram adicionados na sessão 16
(no `lvp-subtabs`), mas o CSS `.is-orc-readonly` os bloqueava em modo
readonly (DRE aprovada). Felipe estava em versão imutável → botões
invisíveis (opacity 0.5 + pointer-events none).

**Correção:** CSS atualizado pra liberar **completamente** em readonly:

```css
.is-orc-readonly .rep-export-btn,
.is-orc-readonly button[data-export-png],
.is-orc-readonly button[data-export-pdf],
.is-orc-readonly button[data-rel-subtab] {
  cursor: pointer !important;
  pointer-events: auto !important;
  opacity: 1 !important;
}
.is-orc-readonly #lvp-btn-export-png,
.is-orc-readonly #lvp-btn-export-pdf,
.is-orc-readonly #lvp-btn-recalcular {
  pointer-events: auto !important;
  opacity: 1 !important;
  cursor: pointer !important;
}
```

Antes só tinha `cursor: pointer` — não era suficiente porque a regra
genérica de bloqueio (`opacity: 0.5; pointer-events: none`) tinha
precedência igual e ganhava por ordem.

---

## Item D — Capturar SÓ o card (sem lateral)

**Pedido textual:** *"esta imprimindo toda lateral quero somente o
quadro dos relatorios"*

**Causa:** As funções `exportarRelatorioPNG/PDF` capturavam o
`#rel-pane-{subAba}` inteiro — que tem padding lateral, fundo cinza
da aba do orçamento, etc. O resultado mostrava as bordas da aba do
sistema em volta do card.

**Correção:** Estratégia de **clone off-screen**:

```js
// Busca SO os cards reais dentro do elemento alvo
const cards = elemento.querySelectorAll('.rep-card, .rel-chapas-bloco');
const conteudoHtml = Array.from(cards).map(c => c.outerHTML).join('<div style="height:12px;"></div>');

// Host off-screen com fundo branco e largura fixa de 720px
cloneHost = document.createElement('div');
cloneHost.style.cssText = 'position:absolute; left:-10000px; width:720px; background:#fff; padding:20px;';
cloneHost.innerHTML = conteudoHtml;
document.body.appendChild(cloneHost);

// Captura SO o clone
const canvas = await html2canvas(cloneHost, { scale: 2, ... });

// Cleanup no finally
```

Resultado: PNG/PDF mostram apenas o card do relatório, com fundo
branco limpo, sem bordas da aba do sistema.

Aplicado em ambas funções `exportarRelatorioPNG` e `exportarRelatorioPDF`.

---

## Item E — Título centralizado, menor, sem bordas

**Pedido textual:** *"titulo centralizado menor sem bordas"*

**Correção em `styles/28-rep-painel.css`:**

```css
.rep-section-head {
  margin: 14px 0 14px 0;
  padding: 0;
  text-align: center;        /* ← centralizado */
  border: none;              /* ← sem bordas */
}
.rep-section-titulo {
  font-size: 12px;           /* ← menor (era 14px) */
  text-align: center;
  border: none;              /* ← sem bordas */
  padding: 0;
}
.rep-section-sub {
  font-size: 11px;           /* ← menor (era 13px) */
  text-align: center;
  border: none;
}
```

---

## Item F — Relatório de Superfícies na própria aba

**Pedido textual:** *"relatorio de superfice coloque na propria aba
de superficies e nao em relatorio"*

**Implementação:**

### 1. Removida a sub-aba "Chapas / Aproveitamento" dos Relatórios

Antes: 4 sub-abas (Comercial, DRE, Obra, Chapas).
Agora: 4 sub-abas (Comercial, **Resultado por Porta**, DRE, Obra).
A sub-aba "Chapas" desapareceu.

### 2. Adicionado bloco "📐 Relatório de Chapas" no fim da aba Lev. Superfícies

```html
<div class="orc-section" id="lev-sup-rel-bloco">
  <div class="orc-section-title-bar">
    <div class="orc-section-title">📐 Relatorio de Chapas</div>
    <div class="orc-section-actions">
      <button id="lev-sup-rel-png" class="rep-export-btn">🖼 PNG</button>
      <button id="lev-sup-rel-pdf" class="rep-export-btn">📄 PDF</button>
    </div>
  </div>
  <div id="lev-sup-rel-conteudo">
    ${renderRelChapas(versao)}
  </div>
</div>
```

A função `renderRelChapas` foi mantida (acessível dentro do mesmo
IIFE) — só mudou o lugar onde é chamada.

CSS novo `.orc-section-title-bar` em `13-orcamento.css`: flex
horizontal com título à esquerda, botões à direita.

Handlers PNG/PDF próprios (`#lev-sup-rel-png` / `#lev-sup-rel-pdf`)
chamam as mesmas `exportarRelatorioPNG/PDF` que os outros relatórios.

---

## Princípios respeitados

- **Modular**: cada sub-aba dos Relatórios é uma função `renderRelXxx`
  isolada. Adicionar/remover não afeta as outras.
- **Reuso**: `renderRelChapas` está agora no escopo IIFE e é chamada
  por DUAS abas diferentes (uma vez foi removida dos Relatórios
  e adicionada em Superfícies).
- **Backwards compatible**: `UI.relSubAba === 'chapas'` (estado salvo
  do Felipe) cai no default `'comercial'` — não quebra nada.
- **Whitelist explícita** no CSS readonly: cada classe/ID liberado
  está documentado com motivo.

## Arquivos alterados

```
scripts/12-orcamento.js (~270 linhas)
  - renderRelObra refeito (~75 linhas) com rep-card
  - renderRelResultadoPorta nova (~120 linhas)
  - exportarRelatorioPNG refatorado (clone off-screen, ~40 linhas)
  - exportarRelatorioPDF refatorado (clone off-screen, ~10 linhas)
  - sub-abas: removida 'chapas', adicionada 'resultado-porta'
  - bloco "Relatorio de Chapas" inserido no fim da aba Lev. Superfícies
  - handlers PNG/PDF da aba Lev. Superfícies (~10 linhas)

styles/13-orcamento.css (~30 linhas)
  - .orc-section-title-bar (flex título + botões)
  - .orc-section-actions
  - readonly liberou rep-export-btn + lvp-btn-export-{png,pdf,recalcular}
    (pointer-events:auto + opacity:1)

styles/28-rep-painel.css (~10 linhas)
  - .rep-section-head: text-align center, border none
  - .rep-section-titulo: 14px → 12px, border none
  - .rep-section-sub: 13px → 11px, border none
```

## Como reverter

1. **A**: tirar o branch `subAbaAtiva === 'resultado-porta'` e a
   função `renderRelResultadoPorta`
2. **B**: voltar `.rep-obra-vertical` antigo
3. **C**: tirar as 3 regras readonly novas
4. **D**: voltar `html2canvas(elemento, ...)` direto sem clone
5. **E**: voltar font-size 14px/13px e remover text-align center
6. **F**: voltar sub-aba "chapas" nos Relatórios e tirar bloco da aba
   Superfícies
