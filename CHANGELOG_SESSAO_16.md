# PROJETO 16 — Reformulação dos Relatórios

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| A | Liberar Relatórios após DRE aprovada (não bloquear mais) | ✅ | 12-orcamento.js + 13-orcamento.css |
| B | Padrões de Cortes — permitir impressão mesmo em readonly | ✅ | 13-orcamento.css |
| C | Aba Relatórios com 4 sub-abas | ✅ | 12-orcamento.js |
| D | Renomear "Planificador de Barras" → "Aproveitamento de Barras" | ✅ | 12-orcamento.js |
| E | Imprimir todas as abas do Lev. Perfis (PNG e PDF) | ✅ | 12-orcamento.js |
| F | "Por que aparecem 2 cards?" | ✅ Esclarecido | 12-orcamento.js |
| G | Exportar relatórios em **PNG** | ✅ | 12-orcamento.js |
| H | 1 só relatório por versão | ✅ | 12-orcamento.js |

---

## Item A — Relatórios liberados após DRE aprovada

**Pedido textual:** *"quando bloqueia apos aprovar dre liberar
relatorios"*

**Causa raiz:** No início de `renderRelatoriosTab`, havia um `return`
duro que bloqueava a aba quando DRE não calculada:

```js
if (motivoBloqueio) {
  return renderPrecisaCalcular(container, versao, motivoBloqueio, 'Relatorios');
}
```

Isso era usado pra evitar render com números zerados, mas Felipe quer
**ver os relatórios congelados** depois que aprovou a DRE.

**Correção:** Removido o `return`. Agora se há motivo de bloqueio,
mostra um banner inline alertando, mas continua renderizando todas
as 4 sub-abas. Felipe pode ver, exportar, navegar.

CSS também atualizado: `.is-orc-readonly` antes desabilitava todos
os botões. Agora **whitelist** explícita libera:
- Sub-abas dos relatórios (`[data-rel-subtab]`)
- Botões Export PNG / PDF (`[data-export-png]`, `[data-export-pdf]`)
- `#lvp-modal-pdf`, `#lvp-modal-print` (Padrões de Cortes)
- Tudo dentro de `.rel-tabs`, `.rel-pane`, `.rep-section-head`

---

## Item B — Padrões de Cortes liberado em readonly

**Pedido textual:** *"esse padroes de corte nao permite impressao,
permitir impressao de um relatorio de chapas"*

**Correção:** Os botões `#lvp-modal-pdf` e `#lvp-modal-print` (dentro
do modal Padrões de Cortes) eram bloqueados pela regra global de
`.is-orc-readonly button`. Agora estão na whitelist e seguem
clicáveis em qualquer estado de versão.

---

## Item C — 4 sub-abas em Relatórios

**Pedido textual:** *"em relatorio deixe separado por abas"*

**Implementação:** A aba Relatórios agora tem **4 sub-abas internas**:

```
[📊 Painel Comercial]  [💰 DRE Resumida]  [🧱 Resumo da Obra]  [📐 Chapas / Aproveitamento]
                                                              [🖼 PNG] [📄 PDF]
```

### 1. 📊 Painel Comercial — Representante (era a tela inteira antes)
Mantido o card original (PROJETTA by WEIKU) com:
- Identificação (cliente, AGP, reserva, dimensão, modelo, cor)
- Preço Tabela + Preço Faturamento
- Valores por m² (porta+inst e só porta, ambos tabela e fat)
- Comissão Rep. + Comissão Arq. + Desconto

### 2. 💰 DRE Resumida (NOVA)
*"painel comercial respetante - um dre igual envia mesmo estilo"*

Card único no mesmo estilo do Painel Comercial, mostrando:
- Receita Bruta + Lucro Líquido em destaque
- Detalhamento completo: deduções, custo direto, IRPJ+CSLL
- Margem Líquida com cor verde se atinge alvo / vermelho se não atinge

### 3. 🧱 Resumo da Obra (NOVA)
*"um resumo da obra mas na vertical"*

Cards empilhados verticalmente (não em grid horizontal):
- 🏗 **Custo Total da Obra** — destaque laranja com borda esquerda
- 🚪 Esquadrias (m² total + nº portas)
- 📏 Perfis de Alumínio (custo + pintura)
- 🟫 Chapas / Revestimento
- 🔩 Componentes (acessórios + extras)
- 👷 Mão de Obra (horas × operários × R$/h)
- 🚛 Instalação

### 4. 📐 Chapas / Aproveitamento (NOVA)
*"permitir impressao de um relatorio de chapas, mostrando itens, pecas e
layout das chapas escolhidas"*

Para cada cor com chapa selecionada:
- Chapa-mãe escolhida (descrição)
- Total de chapas + aproveitamento médio + custo total
- Grid de chapas individuais (Chapa 1, 2, 3...) com:
  - Nº de peças daquela chapa
  - Aproveitamento daquela chapa em %

---

## Item D — Renomeação

**Pedido textual:** *"planificador de barras ja (troque nome para
aproveitamento de barras)"*

**Correção:**
- Sub-aba do Lev. Perfis: `🧩 Planificador de Barras` → `🧩 Aproveitamento de Barras`
- Header do PDF de Planificador: `PLANIFICADOR DE CORTES` → `APROVEITAMENTO DE BARRAS`
- Variáveis internas mantidas (`UI.subLevPerfis === 'planificador'`) pra não quebrar referências

---

## Item E — Lev. Perfis com Export PNG/PDF

**Pedido textual:** *"permita imprimir todas as abas do levantamento
de perfis cortes por item nao tem ainda relatorio, planificador de
barras ja"*

**Correção:** 2 botões novos na barra de sub-abas do Lev. Perfis:
`🖼 PNG` e `📄 PDF`. Funcionam em **ambas** as sub-abas (Cortes por Item
e Aproveitamento de Barras) — captura o `#lvp-content` (que é o
container da sub-aba ativa) via html2canvas.

Nome do arquivo: `LevPerfis_<sub-aba>_<cliente>_<data>.png/pdf`.

---

## Item F — Esclarecimento dos "2 cards"

**Pergunta do Felipe:** *"nao sei pq aparece esses dois sendo que a
versao congelada e outra"*

**Resposta:** Os 2 cards correspondem aos **2 itens** da versão
(Item 1: 1500×2500 e Item 2: 1800×5000 — visíveis na imagem do print).
Cada item ganha um card próprio.

**Melhoria de UX:** o subtítulo do card agora diz `Item N de M`
(ex.: "Painel Comercial — Item 1 de 2") em vez do genérico
"— Representante", deixando explícito que **uma versão pode ter
vários itens**.

> *"so vai ter um relatorio por versao"* — exatamente. Os múltiplos
> cards são **partes do mesmo relatório de UMA versão**.

---

## Itens G + H — PNG + 1 relatório por versão

**Pedido textual:** *"permita exportar mas dessa vez em png"*

**Implementação:**
- Função nova `exportarRelatorioPNG(elementoId, nomeArquivo)`:
  - Lazy-load de html2canvas
  - Captura elemento alvo
  - Gera dataURL `image/png`
  - Cria `<a download>` e clica programaticamente
- Função análoga `exportarRelatorioPDF` (também nova) — usa jsPDF
  com fatiamento automático se conteúdo passar de 1 página A4

Cada sub-aba tem seu **próprio par PNG/PDF** que captura o conteúdo
visível atualmente (`<div id="rel-pane-{subAbaAtiva}">`).

Resultado dos arquivos baixados:
- `Relatorio_comercial_<cliente>_<data>.png`
- `Relatorio_dre_<cliente>_<data>.png`
- `Relatorio_obra_<cliente>_<data>.png`
- `Relatorio_chapas_<cliente>_<data>.png`

---

## Princípios respeitados

- **Modular**: cada sub-aba é uma função `renderRelXxx` separada,
  recebe versão+dre+params e retorna HTML. Fácil testar e estender.
- **Backward compatible**: a estrutura de versão antiga continua
  funcionando — sub-abas que dependem de campos novos (ex: Resumo
  da Obra usa `versao.custoFab.etapas`) têm fallbacks.
- **Reuso de utilitários**: `carregarLib` (CDN lazy-load) reaproveitado
  entre Padrões de Cortes, Proposta e Relatórios.
- **Sem regressão**: mantida a sintaxe e validada em todos os scripts.

## Arquivos alterados

```
scripts/12-orcamento.js  (~480 linhas)
  - renderRelatoriosTab refatorado (sub-abas + UI estado)
  - renderRelComercial (extração da função antiga)
  - renderRelDRE (nova)
  - renderRelObra (nova)
  - renderRelChapas (nova)
  - exportarRelatorioPNG (nova)
  - exportarRelatorioPDF (nova)
  - Botões PNG/PDF no Lev. Perfis (~25 linhas)
  - Renomeação "Planificador" → "Aproveitamento de Barras"

styles/28-rep-painel.css (~140 linhas novas)
  - .rel-tabs, .rel-tab-btn (sub-abas)
  - .rep-export-btn (botões PNG/PDF)
  - .rep-obra-vertical + .rep-obra-card (Resumo da Obra)
  - .rel-chapas-bloco + filhos (Chapas / Aproveitamento)

styles/13-orcamento.css  (~28 linhas)
  - Whitelist expandida de elementos clicáveis em readonly
  - Liberados: rel-tabs, rel-pane, export-btns, padroes-cortes-btns
```

## Como reverter

1. **A**: voltar `if (motivoBloqueio) return renderPrecisaCalcular(...)`
2. **B**: tirar `:not([id="lvp-modal-pdf"]):not([id="lvp-modal-print"])` da regra
3. **C**: voltar render direto sem sub-abas
4. **D**: sed reverso: `Aproveitamento de Barras` → `Planificador de Barras`
5. **E**: remover `#lvp-btn-export-png` e `#lvp-btn-export-pdf` da toolbar
6. **G+H**: remover funções `exportarRelatorioPNG/PDF`
