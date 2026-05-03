# PROJETO FINAL 05 / 06 — Alterações desta sessão

## Resumo executivo

6 itens corrigidos:

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | Bug `fmtData is not defined` no Aprovar Orçamento | ✅ | 12-orcamento.js |
| 2 | Custo total de chapas → campo Revestimento (R$) automaticamente | ✅ | 12-orcamento.js |
| 3 | Duplo clique nos cards de chapa atualiza valor instantaneamente | ✅ | 12-orcamento.js |
| 4 | Resumo Total: tabela com preço unit × qtd × subtotal por cor | ✅ | 12-orcamento.js + 13-orcamento.css |
| 5 | Páginas 01 e 02 da proposta usam DIRETO os PDFs do Felipe | ✅ | 12-orcamento.js + 27-relatorios.css + 2 imagens |
| 6 | Algoritmo de aproveitamento de chapas — salvage pass + Maximal Rectangles | ✅ | 39-chapas-aproveitamento.js |

---

## Item 1 — fmtData is not defined

**Causa raiz:** A função `fmtData` existia em `10-crm.js` e `11-clientes.js` mas
em escopo IIFE local — não exportada via `window.*`. Quando o usuário clicava
em "Aprovar Orçamento" no `12-orcamento.js`, dava erro porque `fmtData` é
chamada lá pra formatar a data de aprovação.

**Correção:** Adicionada cópia local de `fmtData` no `12-orcamento.js` (mantém
isolamento entre módulos).

---

## Item 2 + 3 — Bug crítico do `OrcamentoCore` undefined + persistência

**Causa raiz (descoberta nesta sessão):** O código usava `window.OrcamentoCore?.getOrcamentoAtual?.()`
e `window.OrcamentoCore?.salvarOrcamentoAtual()` em **5 lugares** — mas
`window.OrcamentoCore` **nunca foi definido**. Essas chamadas viravam noop
silenciosos. Resultado: a seleção de chapas (duplo clique) NUNCA persistia.
Felipe reclamou: "não atualiza nada ao clicar duas vezes" — exatamente isso.

**Correção:**
- Adicionado `'chapasSelecionadas'` à lista `camposPermitidos` de `atualizarVersao`
- Substituído todos os 5 usos de `OrcamentoCore` por:
  - `obterVersao(UI.versaoAtivaId)` (leitura)
  - `atualizarVersao(versao.id, {...})` (escrita)
- No duplo clique de chapa:
  1. Atualiza `versao.chapasSelecionadas[cor]`
  2. **Calcula novo total de Revestimento** via `computeRevestimentoPorCor`
  3. **Atualiza `versao.custoFab.total_revestimento`** automaticamente
  4. Re-renderiza a aba inteira → Resumo Total atualiza instantaneamente
- Mostra dialog confirmando: "Chapa selecionada: ... · Custo: ... · Revestimento total atualizado: ..."

**Bonus:** Os handlers do select Sim/Nao e XML import (sessão 04) também
usavam `OrcamentoCore` quebrado — também corrigidos.

---

## Item 4 — Tabela com preço unitário × qtd × cor

**Pedido textual:** *"resumo quero preco unitatio de cada chapa x quantidade
por cor — entao se tem 3 cores tem 3 linhas com preco unitario x quantidade
de cada cor e um valor total para conferencia"*

**Correção:**
- Nova função `computeRevestimentoPorCor(versao, pecasPorCor, todasSuperficies)`:
  - Para cada cor, retorna `{cor, descricao, precoUnit, qtd, subtotal, fonte}`
  - `fonte = 'selecionada'` (usuário escolheu) ou `'auto'` (melhor automática)
  - Total geral = soma dos subtotais
- No Resumo Total, adicionada tabela "Custo por cor — Preço unitário × Qtd"
  com colunas Cor / Chapa / Preço unit. (R$) / Qtd / Subtotal / Origem
- Linha total destacada em laranja: "TOTAL GERAL (vai pro campo Revestimento em Custo Fab/Inst)"
- Card "Custo total" do grid agora é laranja (Projetta), antes era azul neutro

---

## Item 5 — PDFs originais nas páginas 01 e 02 da proposta

**Pedido textual:** *"pagina 01 e 02 da proposta erao feias, quero que
simplesmente coloque a que te enviei do pdf, não edite, não tente copiar,
só coloque a minha"*

**Correção:**
- Convertido `01.pdf` (capa "Proposta Comercial 2026") → `images/proposta-pag1.jpg` (1500px width, 377KB)
- Convertido `03.pdf` (mapa "Nossa Portas pelo Mundo") → `images/proposta-pag2.jpg` (1500px width, 412KB)
- Removido **TODO** o HTML/CSS que tentava reproduzir o layout (capa-titulo,
  capa-foto-wrap, capa-logo, mapa-titulo, mapa-img-wrap, listas de países, etc)
- Substituído por simples `<img src="images/proposta-pag1.jpg" class="rel-prop-pdf-img" />`
- Adicionado `.rel-prop-pagina-pdf` no CSS — A4 sem padding, imagem ocupa
  largura total mantendo proporção do PDF original
- **Sem edição, sem reprodução de texto** — apenas exibe a imagem do PDF
  exatamente como Felipe enviou

---

## Item 6 — Algoritmo de aproveitamento

**Pedido textual:** *"as 3 peças da segunda chapa claramente cabem na primeira"*
e *"seu aproveitamento de chapa nao esta confiavel nao esta fazendo melhor
aproveitamento"*

**Causa raiz:** O algoritmo `multi_horiz` (guillotine) usa fileiras horizontais.
Quando uma fileira tem peças altas (ex.: Cava 4919mm), o espaço acima de peças
mais baixas que entram na MESMA fileira é desperdiçado — guillotine simples
não pode subdividir. Resultado: peças pequenas vão pra novas chapas mesmo
havendo bastante sobra disponível.

**Correção em 2 partes:**

### 6A) `calcularSobrasDetalhadas` (Maximal Rectangles)

A função antiga `calcularSobras` retornava só **2 retângulos** (direita do
mais largo + abaixo do mais alto), ignorando vãos internos entre fileiras.

Nova função detecta **todos** os retângulos livres usando algoritmo de
Maximal Rectangles:
1. Começa com 1 retângulo cobrindo a área disponível
2. Pra cada peça posicionada, divide retângulos que se intersectam em até
   4 sub-retângulos (top/bottom/left/right)
3. Remove redundâncias (retângulos contidos em outros)
4. Filtra retângulos pequenos (<20mm)

### 6B) `salvagePass` (passada de salvamento)

Após o nesting principal escolher a melhor estratégia (multi-start de 8
ordenações), executa salvage pass:

1. Itera chapas **de trás pra frente**
2. Pra cada peça posicionada na chapa atual, tenta encaixar nas SOBRAS
   detalhadas das chapas anteriores (`calcularSobrasDetalhadas`)
3. Se cabe, **move a peça** pra chapa anterior na sobra livre
4. Repete até convergir (sem mais movimentos) ou 5 iterações máximas
5. Remove chapas que ficaram totalmente vazias

### Validação com testes unitários

**Teste 1** (cenário Imagem 3 — 4 Cava grandes + 4 L de Cava pequenas em chapa 1500x5000):
- Antes: 2 chapas (segunda com 19% por causa do guillotine apertado)
- Depois: 2 chapas (todas as L de Cava posicionadas, 52.9% total)
- Caso limite — geometria não permite 1 chapa só

**Teste 2** (cenário Imagem 5 — Aço Corten com peça pequena #116 sozinha):
- Antes: **3 chapas** (Chapa 3 com 1 peça só, 2% aproveitamento)
- Depois: **2 chapas** ✅ (peça #116 absorvida na Chapa 1, 14 peças total)

---

## Arquivos alterados (resumo)

| Arquivo | Linhas adicionadas | Tipo |
|---------|---------------------|------|
| `scripts/12-orcamento.js` | ~250 | Lógica + render |
| `scripts/39-chapas-aproveitamento.js` | ~150 | Algoritmo |
| `styles/13-orcamento.css` | ~80 | Tabela revestimento |
| `styles/27-relatorios.css` | ~25 | Páginas PDF |
| `images/proposta-pag1.jpg` | (novo) | Capa do PDF do Felipe |
| `images/proposta-pag2.jpg` | (novo) | Mapa do PDF do Felipe |

## Princípios respeitados

- **Modular**: alterações isoladas no módulo Orçamento + motor de chapas;
  CRM/Cadastros/Auth/DRE não foram tocados
- **Sem regressão**: motor `ChapasPortaExterna`, `ChapasRevParede` e a UI
  do bloco por cor (`renderBlocoCor`) **não foram modificados** — só foi
  adicionada a passada de salvamento ao final
- **R06** (sem espaços gigantes nas colunas) aplicada na nova tabela
- **R01** (2 casas decimais) aplicada nos novos valores
- **Documentado**: cada alteração tem comentário inline explicando por
  que e o que mudou

## Como reverter

Cada item é isolado:
1. Item 1: remover função `fmtData` (linhas ~1144-1156 em 12-orcamento.js)
2. Itens 2+3: restaurar callbacks com `OrcamentoCore` (não recomendado — bug)
3. Item 4: remover bloco `tabelaCustosHtml` e usar card único
4. Item 5: restaurar HTML de capa + mapa (mas é o que o Felipe NÃO quer)
5. Item 6: remover `salvagePass` e `calcularSobrasDetalhadas` da `aproveitar`

## Pendências conhecidas

- Item 6 — Caso "todas as peças grandes na mesma chapa" (Teste 1) ainda
  produz 2 chapas. Não é bug do salvage — é limitação geométrica
  (5 peças × 268mm = 1340mm de largura na chapa 1500mm; sobra só 154mm).
  Pra reduzir mais precisaria reordenar peças no nesting principal,
  o que é outro tipo de mudança.
