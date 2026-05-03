# PROJETO 11 — 6 pendências do Felipe

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| A | "O que é Corte mm?" — coluna apareceu sem ele pedir | ✅ Removida | 12-orcamento.js |
| B | Reverter fundo laranja das linhas + aplicar nas abas/ícones (Imagem 2) | ✅ | 14-lev-perfis.css + 13-orcamento.css |
| C | Eliminar botões Exportar/Importar XML (Imagem 3) | ✅ Removidos | 12-orcamento.js |
| D | Padronizar botão "+ Adicionar" em Superfícies/Acessórios/Representantes | ✅ Destacados em laranja | 22-, 24-, 25-CSS |
| E | **🔴 Bug Re-aprovar não atualizava CRM** | ✅ Corrigido na fonte | 12-orcamento.js |
| F | Card do CRM com **Preço da Proposta + Preço com Desconto** | ✅ | 12-orcamento.js + 10-crm.js + 11-crm.css |

---

## Item A — "Corte mm" removido

**Pedido textual:** *"o que é corte mm? não tinha isso antes"*

**Causa raiz:** Eu havia adicionado uma coluna `Corte mm` mostrando `KERF/2`
(perda do disco de corte = 2mm) achando que seria informativa. Felipe não
pediu, não usa essa info, achou confusa.

**Correção:** Removida em 3 lugares:
- `<th class="num">Corte mm</th>` do thead
- `<td class="num">${KERF/2}</td>` do rowHtml
- Colspans dos subtotais ajustados (10→9, 8→7)

Tabela voltou a ter exatamente as 9 colunas originais:
`Pos · Codigo · Descricao · L/H · Tamanho · Qtd · kg/m · Peso kg · Obs.`

---

## Item B — Fundo laranja: nos botões/ícones, NÃO nas linhas

**Pedido textual:** *"por que está laranja o fundo? pedi o botão laranja
nos ícones da imagem 2 não no resto"*

**Causa raiz:** Na sessão 09 interpretei mal — apliquei laranja claro
esfumaçado nas LINHAS das tabelas. Felipe queria nos BOTÕES das abas
"📋 Cortes por Item" e "🧩 Planificador de Barras" (Imagem 2).

**Correção:**

1. **Reverti** o fundo laranja das linhas:
   - `.lvp-table tbody tr:nth-child(even) td` → voltou pra `#E4E8EE` (zebra cinza canônico)
   - `.orc-fi-distrib-tabela tbody tr:nth-child(even)` → voltou pra `var(--cinza-mais-claro)`
   - Linhas ímpares voltaram a ser brancas (sem fundo)

2. **Apliquei** laranja claro esfumaçado na **subtab ATIVA**:
   ```css
   .lvp-subtab.is-active {
     background: #fff5ed;           /* laranja claro esfumaçado */
     border-bottom-color: var(--laranja);
     font-weight: 600;
   }
   .lvp-subtab:hover { background: #fffaf5; }
   ```

Agora o destaque visual está exatamente onde Felipe quer — nas abas que
ele usa pra navegar entre "Cortes por Item" e "Planificador de Barras".

---

## Item C — Eliminar Exportar/Importar XML

**Pedido textual:** *"elimine exportar e importar xml"*

**Correção:** Removidos os 2 botões da toolbar do Lev. Superfícies:
- `<button data-acao="exportar-modelo-xml">↓ Exportar Modelo XML</button>`
- `<button data-acao="importar-xml">↑ Importar XML</button>`

Mantidos os 2 botões de Excel (que Felipe usa de verdade):
- `↓ Exportar Modelo Excel`
- `↑ Importar Excel`

As funções `gerarModeloXmlSuperficies` e `importarOverridesXml` continuam
no código (não removi pra não quebrar referências futuras), só foram
**desmontadas da UI**. Os handlers dos botões removidos também ficaram
inertes — só não tem mais botão pra disparar.

---

## Item D — Botões "Adicionar" destacados

**Pedido textual:** *"superfície e acessórios ainda sem botão de adicionar
novos itens, representantes também cadê local pra adicionar"*

**Causa raiz:** Os botões EXISTIAM (`#sup-btn-add-novo`, `#ace-btn-add-novo`,
`#rep-btn-add-novo`), mas estavam com fundo `azul-escuro` discreto, do
mesmo tom que outros botões da toolbar. Felipe não estava enxergando.

**Correção:** Botões agora em **laranja Projetta** com mais peso visual:

```css
.sup-btn-add, .ace-btn-add, .rep-btn-add {
  background: var(--laranja);
  color: var(--branco);
  padding: 9px 18px;       /* era 8px 14px / 6px 12px */
  font-size: 12px;          /* era 11px */
  font-weight: 600;         /* era 500 */
  border-radius: 6px;
  transition: background 0.15s, transform 0.1s;
}
:hover { background: #a35e0e; transform: translateY(-1px); }
```

Resultado: nas 3 abas (Superfícies, Acessórios, Representantes) o botão
"+ Nova/Novo" agora **salta na tela** — Felipe não vai perder mais.

---

## Item E — 🔴 Bug crítico: Re-aprovar não atualizava CRM

**Pedido textual:** *"ao alterar e reaprovar com valor R$ 133.606,46 o
card permaneceu valor antigo"*

**Causa raiz:** Bug clássico de **campo errado na leitura**.

Em `aprovarOrcamento` (linha 1075):
```js
alvo.valorAprovado = valor;   // SALVA aqui
```

Em `resumoParaCardCRM` (linha 779 — antes da correção):
```js
valor: Number(v.total) || 0,  // LIA daqui (campo nunca atualizado)
```

`v.total` é inicializado em 0 quando a versão é criada (linha 728:
`total: 0`) e **nunca é atualizado em lugar nenhum** do código. Então
o card sempre mostrava 0 (ou o valor que estava em `lead.valor`, fallback).

Re-aprovar atualizava `valorAprovado` corretamente, mas a função de
resumo continuava lendo o `total` zerado.

**Correção:**
```js
valor: Number(v.valorAprovado) || Number(v.total) || 0,
```

Lê `valorAprovado` primeiro (que SIM é setado por `aprovarOrcamento`),
fallback pra `v.total` em versões legadas que possam ter algum valor lá.

---

## Item F — Card do CRM com AMBOS valores

**Pedido textual:** *"deixe no card ambos valores Preço da Proposta e
Cliente Paga (esse Cliente Paga substitua para Preço da proposta com
desconto) ambos devem ir para o card"*

**Implementação em 3 camadas:**

### 1. Camada de DADOS (`aprovarOrcamento`)
Aceita 3º parâmetro e salva 2 campos separados:
```js
function aprovarOrcamento(versaoId, valorFaturamento, precoPropostaSemDesconto) {
  // ...
  alvo.valorAprovado = valor;          // pFatReal — Cliente Paga
  alvo.precoProposta = precoProposta;  // pTab     — Preço de Tabela
  // No lead também:
  lead.valor         = valor;
  lead.precoProposta = precoProposta;
}
```

### 2. Camada de RESUMO (`resumoParaCardCRM`)
Retorna ambos no objeto:
```js
return {
  hasVersaoFechada: true,
  valor:         ultimaFechada.valor,          // Cliente Paga (com desc)
  precoProposta: ultimaFechada.precoProposta,  // Preço Proposta
  // ...
};
```

### 3. Camada de UI (Card do CRM)
Renderiza os 2 valores quando há desconto:
```html
<div class="crm-card-valor-bloco">
  <div class="crm-card-valor-row">
    <span>Preço da Proposta:</span>
    <span class="crm-card-valor-tabela">R$ 167.008,08</span>  <!-- riscado -->
  </div>
  <div class="crm-card-valor-row">
    <span>Com desconto:</span>
    <span class="crm-card-valor">R$ 133.606,46</span>          <!-- laranja, destaque -->
  </div>
</div>
```

Visual: o **Preço da Proposta** aparece riscado (tachado) em cinza, e
o **valor com desconto** em laranja Projetta destacado. Quando não há
desconto (valores iguais), mostra apenas 1 valor (não polui).

---

## Princípios respeitados

- **Modular**: cada item alterou só o módulo correto (CRM, orçamento, CSS)
- **Backward compatible**: `aprovarOrcamento` ainda aceita 2 args (3º
  é opcional, fallback usa o mesmo valor)
- **Sem regressão**: versões antigas no storage têm `valorAprovado` vazio
  → fallback pra `v.total` → fallback pra `0`. Nunca quebra.
- **R02** (zebra striping): zebra cinza canônica de volta nas tabelas
- **Conservação numérica** (do item F): se desconto = 0, ambos campos
  são iguais → card mostra apenas 1 valor

## Arquivos alterados

```
scripts/12-orcamento.js  (~50 linhas)
  - aprovarOrcamento (3º parâmetro precoProposta, +2 linhas)
  - _executarAprovacao (passa pTab + pFatReal, ~5 linhas)
  - resumoParaCardCRM (lê valorAprovado, retorna precoProposta, ~10 linhas)
  - rowHtml + table headers (Corte mm removido, ~5 linhas)
  - Botões Exportar/Importar XML removidos (~10 linhas)

scripts/10-crm.js  (~25 linhas)
  - Card mostra ambos valores quando há desconto (bloco condicional)

styles/14-lev-perfis.css  (~12 linhas)
  - Reverte zebra cinza nas linhas
  - Aplica laranja claro na subtab ativa

styles/13-orcamento.css  (~3 linhas)
  - Reverte zebra cinza na tabela Distribuição por Item

styles/22-representantes.css, 24-acessorios.css, 25-superficies.css
  - Botões + Novo destacados em laranja (cada arquivo ~10 linhas)

styles/11-crm.css  (~30 linhas)
  - Novos seletores: .crm-card-valor-bloco, .crm-card-valor-row,
    .crm-card-valor-label, .crm-card-valor-tabela (riscado)
```

## Como reverter

1. **Item A**: re-adicionar `<th>Corte mm</th>` e `<td>${KERF/2}</td>`,
   colspans 10/8
2. **Item B**: voltar `background: #fff5ed/#fffaf5` nas linhas e tirar
   da subtab
3. **Item C**: re-adicionar os 2 botões XML na toolbar
4. **Item D**: voltar `background: var(--azul-escuro)` nos botões
5. **Item E**: voltar `Number(v.total) || 0` em resumoParaCardCRM
   (REINTRODUZ BUG)
6. **Item F**: voltar a renderização anterior do card (1 só valor)
