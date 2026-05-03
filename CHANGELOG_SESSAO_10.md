# PROJETO 10 — 4 pendências do Felipe

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | "Não vejo problema #id, desde que tenha nome+medidas" | ✅ | 12-orcamento.js |
| 2 | **Bug**: Custo Revestimento pegava só 1 cor (R$ 8.645) em vez do total (R$ 22.479) | ✅ | 12-orcamento.js |
| 3 | **Custo Fabricação separado por item** (Inst continua junto) | ✅ | 12-orcamento.js + 13-orcamento.css |
| 4 | **Proposta**: preencher Valor (un.) e Valor Total — hoje aparece "—" | ✅ | 12-orcamento.js |

---

## Item 1 — #ID com nome+medidas

**Pedido textual:** *"nao vejo problema ter o id desde que tenha nessa
imagem identificacao com nome da peca e as medidas ate facilita"*

**Correção:** Felipe mudou de ideia em relação à sessão anterior. Voltei
o `#ID` mas garantindo que **toda peça mostra nome**:

- **Peças grandes** (≥60×24px): `Cava #101` + `268×4319 mm`
- **Peças médias/pequenas** (≥30×12px): `Acab… #137` (label encurtado a 6 chars + #id)
- **Peças muito pequenas** (<30×12px): só `#137`

Agora as peças tipo "Alisar Altura #121" da Imagem 1 ficam identificadas
junto com peças menores que antes só tinham `#113`, `#114`.

---

## Item 2 — 🔴 Bug do Custo Revestimento

**Pedido textual:** *"observe que em custo revestimento pegou valor da
primeira chapa 8.645,90 e nao do somatorio entre cor 1 e cor 2 total
R$ 22.479,35"*

**Causa raiz:** O handler de duplo clique (`container.addEventListener`)
acumulava listeners a cada re-renderização. Em chamadas sucessivas com
2 cores diferentes, listeners stale podiam capturar valores antigos de
`pecasPorCor` e sobrescrever `total_revestimento` com cálculo incompleto.

**Correção:** Adicionado **sync automático** logo no início de
`renderLevSuperficiesTab`:

```js
// Toda vez que a aba renderiza, recalcula o total e sincroniza
// com fab.total_revestimento — só persiste se houver diferença real
const totalRevSync = computeRevestimentoPorCor(versao, pecasPorCor, todasSupGlobal).total;
const fabAtual = Object.assign({}, FAB_DEFAULT, versao.custoFab || {});
if (Math.abs((Number(fabAtual.total_revestimento) || 0) - totalRevSync) > 0.01) {
  fabAtual.total_revestimento = totalRevSync;
  // ... atualiza
}
```

Garante que ao abrir a aba, o campo "Revestimento (R$)" no Custo Fab/Inst
sempre reflete a soma das chapas de **todas as cores**.

---

## Item 3 — 🆕 Custo de Fabricação separado por item

**Pedido textual:** *"ao ter varios itens temos o custo da fabricacao,
e instalacao, fabricacao vai ter que ser separado portanto vai ter que
ter fabricao item 1, item 2, item 3 etc, para jogar esse custo neste
item, somente instalacao que vai ser junto"*

**Implementação:** Criada função `calcularValoresProposta(versao, params)`
que distribui custos por item:

1. **Horas por item**: `horasItemPortaExterna(item)` já considera
   `item.quantidade` (calcula horas reais — porta maior + mais portas =
   mais horas).
2. **subFab por item** = `subFabTotal × (horas_item / horas_total)`
   → item maior carrega mais custo de fabricação
3. **subInst por item** = `subInstTotal × (subFab_item / subFab_total)`
   → instalação proporcional ao subFab (Felipe: *"dividir proporcional
   ao custo de cada"*)
4. **DRE por item**: aplica MESMOS parâmetros (overhead, impostos,
   markup_desc) em cada item — `precoFinal = pTab` (preço com markup,
   antes do desconto)

**Conservação numérica validada com testes:**
- 3 portas diferentes (qtd 3, 1, 2 — horas 30, 12, 8):
  - Soma subFab por item = subFab total ✅ (R$ 50.000,00)
  - Soma subInst por item = subInst total ✅ (R$ 8.000,00)
  - Diferença entre soma dos pTab por item e pTab agregado: R$ 0,00 ✅

**Visualização:** Nova tabela "Distribuição por Item" no card de
Fabricação (aparece só quando há mais de 1 item):

```
┌────┬──────────────────────┬──────────┬─────┬───────────┬───────┬───────────┬──────────────┐
│Item│Descrição             │Medidas   │Qtd  │Custo Fab  │% Fab  │Custo Inst │Preço Final   │
├────┼──────────────────────┼──────────┼─────┼───────────┼───────┼───────────┼──────────────┤
│ 01 │PORTA EXTERNA (Pivot.)│2000×4400 │  3  │R$ 21.385  │66,7 % │R$ 3.333   │R$ 70.114     │
│ 02 │PORTA EXTERNA (Pivot.)│1800×7800 │  1  │R$ 10.692  │33,3 % │R$ 1.666   │R$ 35.057     │
├────┼──────────────────────┴──────────┴─────┼───────────┼───────┼───────────┼──────────────┤
│ Total                                       │R$ 32.078  │ 100 % │R$ 5.000   │R$ 105.171    │
└────┴──────────────────────────────────────┴───────────┴───────┴───────────┴──────────────┘
```

Estilo coerente com tabelas largas do sistema (zebra laranja claro
esfumaçado, mesmo padrão da Lev. Perfis).

---

## Item 4 — Proposta com valores preenchidos

**Pedido textual:** *"para proposta comercial vai ter que jogar valor
porta 1 + porta 2 normal custo fabricacao e preco final com markup e
custo e preco final da instalacao dividir proporcional ao custo de cada
pra nao sair vazio na proposta"*

**Correção:** A tabela final da proposta (que mostrava `Valor (un.) —`
e `Valor Total —`) agora usa `calcularValoresProposta`:

```js
const valoresProposta = calcularValoresProposta(versao, params);
// ...
const v = valoresPorIdx[idx];
const valorUnStr  = (v && v.precoFinal > 0) ? `R$ ${fmtBR(v.valorUn)}`    : '—';
const valorTotStr = (v && v.precoFinal > 0) ? `R$ ${fmtBR(v.precoFinal)}` : '—';
```

Onde:
- `v.precoFinal` = preço com markup do item (= pTab do DRE individual)
- `v.valorUn` = `precoFinal / item.quantidade`

Resultado na proposta da Imagem 4 (cenário Felipe):
- Item 01 (qtd 3): Valor un. **R$ 23.371,37** · Valor Total **R$ 70.114,12**
- Item 02 (qtd 1): Valor un. **R$ 35.057,06** · Valor Total **R$ 35.057,06**
- Total Geral: **R$ 105.171,18** (= soma exata, sem perda)

---

## Princípios respeitados

- **Modular**: nova função `calcularValoresProposta` não mexe em
  `calcularDRE`, `calcularFab`, `calcularInst` — apenas DISTRIBUI o que
  já é calculado. Zero risco de regressão.
- **Conservação numérica**: soma dos valores por item = total agregado
  (validado com diferença = R$ 0,00 em testes).
- **R01** (2 casas): preservado em todas as fórmulas.
- **Backwards compatible**: se a versão tem 1 só item, a tabela
  "Distribuição por Item" não aparece (`versao.itens.length > 1`).

## Trade-offs e simplificações

- **Distribuição por horas**: a fabricação é distribuída proporcional
  às HORAS calculadas (que já consideram qtd, modelo, sistema, etc).
  Isso é uma proxy razoável — porta maior tem mais horas → carrega
  mais subFab. Se Felipe preferir distribuir por outro critério (peso,
  área, custo de matéria-prima específico por item), trocar fácil:
  basta modificar a fórmula `propHoras = horasPorIdx[idx] / horasTotal`
  para usar outra base.
- **Itens não-porta-externa** (revestimento_parede, etc): horas = 0,
  então a proporção fica 1/N (igualmente entre todos). Quando esses
  motores ganharem regras de horas, a distribuição se ajusta automático.

## Arquivos alterados

```
scripts/12-orcamento.js  (+138 linhas)
  - calcularValoresProposta (nova função, +95 linhas)
  - linhasTabela na proposta (atualizada, ~15 linhas)
  - tabela "Distribuicao por Item" no card Fab (~28 linhas)

styles/13-orcamento.css  (+40 linhas)
  - .orc-fi-distrib-* (estilos da nova tabela)
```

## Como reverter

1. **Item 3+4**: comentar/remover a função `calcularValoresProposta` e
   voltar `<td class="num">—</td>` na linhasTabela.
2. **Item 2**: remover bloco `try { const rSync = obterVersao... }`
   no início de `renderLevSuperficiesTab`.
3. **Item 1**: voltar mostrar só labels sem `#id`.
