# PROJETO 07 — Continuação da sessão 06 (7 pendências do Felipe)

## Resumo executivo

7 itens corrigidos numa rodada:

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | Lev. Perfis colunas largas (espaços gigantes) | ✅ | 04-universal.js + 04-universal-tables.css + 14-lev-perfis.css |
| 2a | Largura/Altura/Qtd editáveis na tabela do Lev. Perfis + recálculo | ✅ | 12-orcamento.js + 14-lev-perfis.css |
| 2b | Excel I/O nas Chapas (paralelo ao XML existente) | ✅ | 12-orcamento.js |
| 3 | **Bug crítico**: Cor/Revestimento não fixam (selects ignorados) | ✅ | 12-orcamento.js |
| 4 | Adicionar item Revestimento entra dentro, sem X de deletar | ✅ | 12-orcamento.js |
| 5 | Cadastro Superfícies — Nova entrada sempre cai em ACM | ✅ | 26-superficies.js |
| 6 | CRM — Modelo Excel com 11 campos pra reimportar | ✅ | 10-crm.js |
| 7 | DRE — custos em vermelho | ✅ | 12-orcamento.js + 13-orcamento.css |

---

## Item 1 — Lev. Perfis colunas largas

**Pedido textual:** *"continua com espacos gigantes, esta utilizando toda largura
da tela ja falei 600x"*

**Causa raiz:** Os inputs `<input>` de filtro de coluna (.univ-col-filter) tinham
o `size` default do navegador (~20 chars ≈ 170px). Com 10 colunas, isso somava
1700px+ de largura mínima, e a tabela esticava pra acomodar todos os inputs.

**Correção:**
- `04-universal.js`: setado `inp.size = 1` no input gerado dinamicamente
- `04-universal-tables.css`: `min-width: 60px → 40px` no `.univ-col-filter`,
  + `box-sizing: border-box`
- `14-lev-perfis.css`: confirmado `width: max-content` na `.lvp-table`

**Resultado:** Tabela de 1970px → **765px** numa tela de 1500px. Cabe folgada.

---

## Item 2(a) — Largura/Altura/Qtd editáveis no Lev. Perfis

**Pedido textual:** *"DEIXE CAMPO LARGURA ALTURA E QTD EDITAVEIS / SE EU
ALTERAR CLARO PRECISO REALCULAR"*

**Implementação:** Estendi o sistema `lev_ajustes` (que já tinha `extras`
e `excluidas`) com uma terceira chave `overrides`:

```js
// scope 'orcamentos', chave 'lev_ajustes', objeto por versao:
{
  extras: [...],          // linhas manuais adicionadas
  excluidas: [...],       // keys de linhas calculadas removidas
  overrides: {            // ← NOVO
    "1|PA-PA007F-6M|Altura Folha": { comp: 4500, qty: 3 },
    ...
  }
}
```

- Na tabela: as células **Tamanho** e **Qtd** viraram `<input type="number">`
  com classes `.lvp-edit-comp` / `.lvp-edit-qty`
- No `change` do input: salva no `overrides[key]` e re-renderiza a tabela
- O **Peso kg** é recalculado automaticamente: `(comp/1000) × kgM × qty`
- Linhas com override mostram badge `[edit]` em vermelho na descrição
- Botão Recalcular existente já descarta `overrides` (junto com extras/excluidas)

**CSS:** Inputs sem borda no estado normal pra parecerem células normais;
borda discreta no hover/focus; fundo rosa claro + borda rosa quando há override.

---

## Item 2(b) — Excel I/O nas Chapas

**Pedido textual:** *"PRECISMO EM CHAPAS EXPORTAR E IMPORTA ARQUIVO EXCEL
NAO HTML"*

**Implementação:** Adicionei 2 botões na toolbar do Lev. Superfícies (ao
lado dos XML existentes): **↓ Exportar Modelo Excel** e **↑ Importar Excel**.

Funções novas:
- `gerarModeloXlsxSuperficies(itens)` — retorna `{ headers, rows }` com
  colunas: Item / Tipo / Descrição Item / Label Peça / Largura / Altura / Rotaciona
- `importarOverridesXlsx(aoa, itens)` — lê AOA do `.xlsx`, faz match por
  label+largura+altura, aplica override de Rotaciona em cada item

Tudo paralelo ao XML — XML continua funcionando, agora tem Excel também.

---

## Item 3 — 🔴 Bug crítico do JSON.parse

**Pedido textual:** *"EM REVESTIMENTO COR E REVSITMENTO NAO FICAM, TEM FILTRO
SELSCIONO MAS NAO FICAM, NA RELAIDADE NADA ALI FUNCIONA CLICANDO SO TEM A TELA"*

**Causa raiz (descoberta nesta sessão):** `Storage.get(k)` faz `JSON.parse(raw)`
toda vez — retorna **clone novo** sempre. O padrão antigo nos handlers do
revestimento parede:

```js
const item = getItem();              // clone 1 (do storage)
item.revestimento = 'ACM 4mm';        // muta clone 1 (NÃO salva no storage)
atualizarVersao(versaoId, {
  itens: obterVersao(versaoId).versao.itens   // ← clone 2! Sem a mutação!
});
// Resultado: clone 2 (sem mudança) é salvo, mutação em clone 1 é perdida.
```

Isso afetava **4 handlers** em `bindItemRevParedeEvents`:
1. `[data-field]` change (Quantidade / Revestimento / Cor / Modo / Refilado / Largura/Altura total)
2. `[data-field-peca]` change (Largura/Altura/Qtd das peças do modo manual)
3. `#rev-btn-add-peca` click (adicionar peça)
4. `[data-action="remover-peca"]` click (remover peça)

**Correção:** Trocou padrão `getItem` + `obterVersao` (2 clones) por `getRoot`
+ `persistir(root)` (1 clone só):

```js
function getRoot() {
  const r = obterVersao(UI.versaoAtivaId);
  return { versao: r.versao, item: r.versao.itens[UI.itemSelecionadoIdx] };
}
function persistir(root) {
  atualizarVersao(root.versao.id, { itens: root.versao.itens });
}
// uso: const root = getRoot(); root.item.revestimento = v; persistir(root);
```

Agora a mesma referência é mutada e salva. Os selects efetivamente
fixam o valor, dropdowns abrem, peças persistem.

---

## Item 4 — Revestimento entra dentro do item, sem X de deletar

**Pedido textual:** *"se eu clico em revestimento fica diferente de quando
clico em porta interna ... revestimento parede entra dentro do revestimento
e nao tem X pra deletar"*

**Causa raiz:** A função `renderItemTab` tinha um special-case na linha 2069:

```js
if (item.tipo === 'revestimento_parede') {
  renderItemRevestimentoParede(container, ...);
  return;  // ← retorna antes de renderizar a chip list
}
```

`renderItemRevestimentoParede` reconstruía o `innerHTML` do zero **sem
incluir a chip list** (com `[Item 1: Porta Externa] [Item 2: Revestimento ✕]
[+ Adicionar item]`). Resultado: quando o item ativo era revestimento_parede,
o usuário só via o form do revestimento — sem nenhuma indicação de outros
itens, sem botão de deletar.

**Correção:**
1. Adicionado o bloco `<div class="orc-itens-list">` em `renderItemRevestimentoParede`,
   replicando exatamente o que o renderItemTab principal renderizava
2. Adicionados em `bindItemRevParedeEvents` os 3 handlers que faltavam:
   - `[data-action="select-item"]` (clique no chip de outro item)
   - `[data-action="remove-item"]` (clique no X)
   - `#orc-item-add` change (dropdown + Adicionar item)

Agora revestimento se comporta igualzinho a porta_externa/porta_interna —
chip list visível, X disponível, switch entre items funciona.

---

## Item 5 — Cadastro Superfícies: nova entrada sempre cai em ACM

**Pedido textual:** *"EM CADASTRO REVESITMENTO NAO TEM OPCAO DE ADICONAR
NOVO EM ACM, HPL ALU MACICO E VIDRO"*

**Causa raiz:** O handler do botão "+ Nova Superfície" criava entrada sem
categoria:

```js
state.superficies.unshift({ descricao: '', preco: 0 });  // ← sem categoria
```

A função `categoriaAuto('')` retorna `'acm'` (default). Como o filtro da
sub-aba ativa usa `s.categoria || categoriaAuto(s.descricao)`, qualquer
nova entrada **sempre aparecia em ACM** — mesmo que o usuário estivesse
clicando "+ Nova" na sub-aba HPL, Vidro ou Alu Maciço.

**Correção:**
```js
state.superficies.unshift({
  descricao: '',
  preco: 0,
  categoria: state.activeCat,                              // ← respeita sub-aba
  peso_kg_m2: pesoDefaultPorCategoria(state.activeCat),    // bonus: peso default certo
});
```

Agora "+ Nova" cria na sub-aba que está ativa.

---

## Item 6 — CRM Modelo Excel para reimportar

**Pedido textual:** *"crm não está exportando excel de modelo para em
importar novamente. interessante importar seria, nome cliente, telefone,
email, cep, cidade estado, largura altura da porta modelo cor interna,
cor externa"*

**Implementação:**

1. **Botão novo no toolbar do CRM**: 📋 Modelo Excel
2. **Função `exportarTemplateXLSX`**: gera planilha em branco com:
   ```
   ID | Cliente | Telefone | Email | CEP | Cidade | Estado |
   Largura Porta (mm) | Altura Porta (mm) | Modelo |
   Cor Interna | Cor Externa | Valor | Etapa | Data | Followup
   ```
   + 1 linha de exemplo pra mostrar o formato
3. **Export atualizado**: `exportarLeadsXLSX` agora também tem todos
   esses 16 campos (antes tinha só 8)
4. **Import atualizado**: `importarLeadsXLSX` lê os 11 campos novos
   com backwards-compat (planilhas antigas continuam funcionando)

Os campos novos no schema do lead (largura_porta, altura_porta, modelo_porta,
cor_interna, cor_externa) são informativos — quando o lead virar orçamento
pode pré-popular o form. Por enquanto só sobrevivem export/import.

---

## Item 7 — DRE custos em vermelho

**Pedido textual:** *"COLOQUE CUSTO NO DRE DE VERMELHOR"*

**Implementação:**
- Helper `linha()` do DRE detecta labels que começam com `(−)` ou `(-)` e
  adiciona classe `is-deducao` na row
- CSS `.orc-dre-conf-row.is-deducao .orc-dre-conf-valor` com `color: #c43d3d`
  + `font-weight: 600`

Linhas afetadas:
- (−) Impostos Sobre Receita
- (−) Comissão Representante
- (−) Comissão RT / Arquiteto
- (−) Comissão Gestão Interna
- (−) Custo Direto (Fab + Inst + Overhead)
- (−) IRPJ + CSLL

O label fica neutro (legível); só o valor R$ + percentual ficam em
vermelho/bold.

---

## Princípios respeitados

- **Modular**: cada item ficou isolado no seu módulo (CRM, Cadastros,
  Lev. Perfis, Lev. Superfícies, Revestimento, DRE)
- **Sem regressão**: nenhum motor de cálculo foi tocado (PerfisCore,
  ChapasPortaExterna, ChapasRevParede, ChapasAproveitamento). Apenas
  a UI e os handlers de eventos.
- **R01** (2 casas): mantida nos novos campos
- **R06** (sem espaços gigantes): aplicada na tabela LVP
- **R07** (botão Salvar com popup): preservado

## Pendências conhecidas

1. **CRM campos novos no form**: O export/import já tem largura_porta,
   altura_porta, modelo_porta, cor_interna, cor_externa, mas o **form de
   edição do lead** ainda não tem campos pra esses. Felipe pode editar via
   Excel/import por enquanto.

2. **"Corte mm"** na tabela do LVP: era exibido como `qty` no original
   (parece bug, já que o thead diz "Corte mm"). Agora exibe `KERF/2 = 2mm`
   (constante, igual à imagem do Felipe). Se ele quiser outra fórmula,
   é só ajustar a linha do td correspondente.

## Arquivos alterados

```
scripts/04-universal.js              (+5 linhas)
scripts/10-crm.js                    (+90 linhas)
scripts/12-orcamento.js              (+250 linhas, tudo isolado)
scripts/26-superficies.js            (+8 linhas)
styles/04-universal-tables.css       (+5 linhas)
styles/13-orcamento.css              (+10 linhas)
styles/14-lev-perfis.css             (+50 linhas)
```

## Como reverter

Cada item é isolado. Pra reverter individual:
1. Item 1: aumentar `min-width` em `.univ-col-filter` e remover `inp.size = 1`
2. Item 2a: remover bloco `linhasVisiveis.forEach(l => { ... overrides ... })`
   e voltar `rowHtml` antigo
3. Item 2b: remover botões e funções `gerar/importarOverridesXlsx`
4. Item 3: voltar `getItem` + `obterVersao()` (mas vai voltar o bug!)
5. Item 4: remover bloco `orc-itens-list` no renderItemRevestimentoParede
   e os 3 bindings novos
6. Item 5: voltar pra `unshift({ descricao: '', preco: 0 })`
7. Item 6: remover botão Modelo Excel + `exportarTemplateXLSX`
8. Item 7: remover detecção de `(−)` no helper `linha`
