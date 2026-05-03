# PROJETO 21 — 4 bugs críticos pós-aprovação

| # | Pendência | Status | Arquivo |
|---|-----------|--------|---------|
| 4 | 🔴 CRÍTICO: trava sistema ao clicar em versão após aprovar + congelamento removido | ✅ | 12-orcamento.js |
| 3 | 🔴 Valor aprovado não foi pro card do CRM | ✅ | 12-orcamento.js |
| 1 | Não dá pra deletar único item | ✅ | 12-orcamento.js |
| 2 | Botão Calcular do Revestimento não funciona | ✅ | 12-orcamento.js |

---

## Item 4 — CRÍTICO: trava sistema + remove congelamento

**Pedido textual 1:** *"E PROBLEMA SERIO NO CARD APOS APROVAR CLICA EM
QUALQUER VERSAO TRAVA TOTALMENTE SISTEMA"*

**Pedido textual 2:** *"TIRE ESSE CONGELAMENTO ESTA TRAVANDO TODO SISTEMA,
JA ESTAVA CALCULADO, NEM DEIXA VER AS OUTRAS ABAS"*

### Causa raiz #1 — IIFE quebrada vazando como texto

Em `renderItemTab` linha 2554, havia template literal com **DUAS IIFEs
mal-formadas** concatenadas. A imagem do Felipe mostrava o texto cru
aparecendo na tela:

```
return headerItHtml + bannerCaracteristicasItens(versao); })()
```

Código antigo (quebrado):
```js
container.innerHTML = `
  ${(() => {
    // ...
    return headerItHtml + memorialBanner;
  })()}
    return headerItHtml + bannerCaracteristicasItens(versao);
  })()}
  ...
```

O segundo `return ... })()` era **JS solto dentro da template string** —
virou texto literal. Esse texto provavelmente quebrava o HTML
suficientemente pra deixar o navegador em loop de re-render quando a
versão era aprovada.

**Correção:** UMA IIFE só, retornando `header + memorial + bannerCaracteristicasItens`.

### Causa raiz #2 — Modo readonly travando navegação

Felipe foi explícito: *"TIRE ESSE CONGELAMENTO"*. O modo readonly
bloqueava pointer-events nos inputs/buttons quando a versão era
aprovada. Mesmo com whitelist, o usuário sentia que **nada respondia**.

**Correção:** removido o auto-add da classe `is-orc-readonly`. Banner
memorial continua aparecendo como **aviso visual**, mas não bloqueia
nada. Felipe pode editar versão aprovada à vontade.

```js
// ANTES
const versaoR = versaoAtiva();
if (versaoR && versaoEhImutavel(versaoR)) {
  container.classList.add('is-orc-readonly');
} else {
  container.classList.remove('is-orc-readonly');
}

// DEPOIS
container.classList.remove('is-orc-readonly');
```

---

## Item 3 — Valor aprovado não foi pro card

**Pedido textual:** *"ORCAMENTO APROVADO, VALOR NAO FOI PARA O CARD"*

A imagem mostrou DRE com `Lucro Liquido R$ 52.071,74` aprovado por
**R$ 173.572,46**, mas o card do CRM permanecia com valor antigo.

### Causa raiz

Em `resumoParaCardCRM` (linha ~798), o filter era:

```js
const ultimaFechada = versoesFlat.find(v => v.status === 'fechada') || null;
if (!ultimaFechada) {
  return { hasVersaoFechada: false, valor: 0, ... };  // ← caía aqui
}
```

Mas `aprovarOrcamento(versaoId, valor, preco)` (linha 1198) **não muda
o status** — só seta `aprovadoEm`, `aprovadoPor`, `valorAprovado`,
`precoProposta`. A versão fica:
- `status: 'draft'`  (nunca vira 'fechada')
- `aprovadoEm: '2026-...'` ✓
- `valorAprovado: 173572.46` ✓

Então o filter `find(v.status === 'fechada')` retornava `null`, e o
card via "nenhuma versão fechada" → mostrava valor zero/antigo.

### Correção

Novo predicado: `ehImutavelParaCard = status === 'fechada' || !!aprovadoEm`.
Card aceita versões aprovadas mesmo sem terem sido "fechadas".

```js
const ehImutavelParaCard = v.status === 'fechada' || !!v.aprovadoEm;
versoesFlat.push({ ..., aprovadoEm, ehImutavelParaCard, ... });

// ordena: imutaveis primeiro
versoesFlat.sort((a, b) => {
  if (a.ehImutavelParaCard !== b.ehImutavelParaCard) return a.ehImutavelParaCard ? -1 : 1;
  return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
});

const ultimaFechada = versoesFlat.find(v => v.ehImutavelParaCard) || null;
```

---

## Item 1 — Deletar único item

**Pedido textual:** *"QUANDO SO TEM UM ITEM NAO TEM OPCAO DE DELETAR
ELE MESMO, SOMENTE QUANDO ACRSCENTA OUTRO QUE SE PODE DELETAR (...)
QUERO PODER DELATRA E VOLTA A TELA INCIAL QUE ESCOLHO AUQL ITEM IRE
USAR"*

### Correção

**Mudança 1 — chip list:** botão `✕` aparece sempre (era só com 2+):

```js
// ANTES
const podeRemover = (versao.itens.length > 1);
${podeRemover ? `<button>✕</button>` : ''}

// DEPOIS
<button class="orc-item-chip-remove" data-action="remove-item" data-idx="${idx}">✕</button>
```

**Mudança 2 — handler:** se está deletando o último item, não remove
do array — **reseta o tipo pra string vazia**. Isso faz o `renderItemTab`
cair automaticamente em `renderEscolhaTipo`, voltando pra tela inicial:

```js
if (lista.length <= 1) {
  const itemReset = { ...lista[0], tipo: '' };
  atualizarVersao(versao.id, { itens: [itemReset] });
  UI.itemSelecionadoIdx = 0;
  renderItemTab(container);
  return;
}
```

A lógica `if (!item.tipo) renderEscolhaTipo(...)` (linha 2393) já
existia há sessões — agora é aproveitada pra retornar pra tela de
escolha (Porta Externa / Revestimento de Parede / etc).

Aplicado nos **2 lugares** com handler `remove-item` (porta externa
e revestimento parede).

---

## Item 2 — Botão Calcular do Revestimento não funciona

**Pedido textual:** *"REESTAIMENTO VOTAO CALULAR NAO FUNCIONA"*

### Causa raiz

`bindItemRevParedeEvents` tinha handlers pra:
- `data-field` (campos top-level)
- `data-field-peca` (modo manual)
- `#rev-btn-add-peca` (adicionar peça)
- `[data-action="remover-peca"]`
- `#orc-btn-salvar`
- `[data-action="select-item"]`
- `[data-action="remove-item"]`
- `#orc-item-add`

Mas **NÃO tinha handler pra `#orc-btn-calcular`** — esse só era bound
em `bindEventos` do `renderItemTab` principal. Mas quando o item ativo
é `revestimento_parede`, `renderItemTab` redireciona pra
`renderItemRevestimentoParede` **antes** de chamar `bindEventos`. Daí
o botão Calcular fica órfão.

### Correção

Handler adicionado no fim de `bindItemRevParedeEvents`:

```js
container.querySelector('#orc-btn-calcular')?.addEventListener('click', () => {
  const r = obterVersao(UI.versaoAtivaId);
  if (!r?.versao) return;
  atualizarVersao(r.versao.id, {
    calculadoEm: nowIso(),
    calcDirty: false,
  });
  if (window.showSavedDialog) window.showSavedDialog('Calculado.');
  renderItemTab(container);
});
```

Comportamento equivalente ao da Porta Externa: marca como calculado,
limpa flag dirty, libera DRE/Lev. Perfis/etc, re-renderiza pra
atualizar visual do botão (↻ Calcular → ↻ Recalcular).

---

## Princípios respeitados

- **Não quebrar funcionalidades existentes**: `versaoEhImutavel`
  continua existindo e sendo usado em outros lugares (validação de
  recalcular, banner memorial, etc) — só não dispara mais o readonly.
- **Sem efeitos colaterais**: as 2 cópias do bloco chip+handler foram
  atualizadas em paralelo (porta externa + revestimento parede).
- **Backward compatible**: versões antigas com `status === 'fechada'`
  continuam funcionando (predicado `ehImutavelParaCard` aceita ambos).

## Arquivos alterados

```
scripts/12-orcamento.js (~80 linhas)
  - linha 1796-1818: removido auto-readonly (Item 4)
  - linha 2554-2596: IIFE consolidada, sem vazamento de texto (Item 4)
  - linha ~770-820: resumoParaCardCRM aceita aprovadoEm (Item 3)
  - linha ~2030-2050 (2x): chip remove sempre presente (Item 1)
  - linha ~2349-2390 (2x): handler reset tipo no ultimo item (Item 1)
  - linha ~2330: handler #orc-btn-calcular no revestimento (Item 2)
```

## Como reverter

1. **Item 4 (readonly)**: voltar `if (versaoEhImutavel) classList.add('is-orc-readonly')`
2. **Item 4 (template)**: voltar as 2 IIFEs concatenadas (REINTRODUZ TRAVA)
3. **Item 3**: voltar `find(v => v.status === 'fechada')`
4. **Item 1**: voltar `podeRemover = lista.length > 1` + `if (lista.length <= 1) return`
5. **Item 2**: remover o handler `#orc-btn-calcular` adicionado
