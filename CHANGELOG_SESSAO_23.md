# SESSÃO 23 — 2026-05-02

## Escopo

Implementação dos modelos 02, 08, 11 e 15 (1 folha) no motor
`ChapasPortaExterna`, com base na planilha
**`PRECIFICAÇÃO_01_04_2026.xlsx`** enviada pelo Felipe.

---

## O que foi feito

### 4 modelos novos implementados (somente 1 FOLHA)

Todos em `scripts/38-chapas-porta-externa.js`, novas funções isoladas
abaixo de `gerarPecasModelo10`:

#### MODELO 02 — Cava + 01 Friso Vertical

Geometria: cava igual ao mod 01 (lado direito), friso vertical no meio
da tampa maior. Usa variáveis: `distanciaBordaCava`, `tamanhoCava`,
`distanciaBordaFrisoVertical`, `espessuraFriso`, `quantidadeFrisos`.

Peças geradas (qtd por lado, total = 2× se ambos lados pintados):
- `cava` — 3·REF + dBC − 2 × alturaQuadro × 1
- `l_da_cava` — (tamCava + 90) × dBC × 2
- `tampa_maior_cava` — (larguraQuadro − dBC − tamCava − dBF − eF + 2·REF − 2) × alturaQuadro × 1
- `tampa_borda_cava` — (dBC + 2·REF − 2) × alturaQuadro × 1
- `tampa_borda_friso` — (dBF + 2·REF − 1) × alturaQuadro × qtdFrisos
- `friso` — (espessuraFriso + 100) × alturaQuadro × qtdFrisos

**Validação com planilha (qtdFrisos=1, dBC=210, tamCava=150, dBF=210, eF=10):**
- TAMPA_MAIOR_CAVA = 1313 ✓ (planilha: 1313)
- TAMPA_BORDA_FRISO = 249 ✓
- FRISO = 110 ✓

#### MODELO 08 — Cava + Ripado

Cava igual ao mod 01, área da tampa maior coberta por ripas verticais.
Variáveis: `distanciaBordaCava`, `tamanhoCava`, `espacamentoRipas`,
`tipoRipado`.

Peças:
- `cava`, `l_da_cava`, `tampa_maior_cava`, `tampa_borda_cava` — iguais ao mod 01
- `ripas` — 94 × (alturaQuadro − 293) × 44

**Limitação conhecida:** a fórmula da QUANTIDADE de ripas (44) não foi
possível derivar com 1 único data point. Está hardcoded como **44**
até Felipe validar com mais cenários (variando `espacamentoRipas`,
`larguraQuadro`).

#### MODELO 11 — Puxador Externo + 01 Friso Vertical

Cava reduzida (puxador externo, dimensões fixas) + friso vertical.
Variáveis usadas: `distanciaBordaFrisoVertical`, `espessuraFriso`,
`quantidadeFrisos`.

Peças:
- `cava` — 116 × (alturaQuadro − 293) × 1 (constante do puxador)
- `l_da_cava` — 90 × 210 × 2 (constante)
- `tampa_maior_cava` — (larguraQuadro − dBF − eF + 2·REF − 1) × alturaQuadro × 1
- `tampa_borda_friso`, `friso` — iguais ao mod 02

**Validação:** TAMPA_MAIOR_CAVA = 1674 ✓ (planilha: 1674).

⚠️ Inconsistência detectada: o título da planilha diz "Cava + 01 Friso
Vertical" mas as medidas batem com o "puxador externo" do mod 10/15
(cava reduzida 116/90×210, sem dBC/tamCava). O CAMPOS_POR_MODELO em
`12-orcamento.js` linha 1691 também lista `distanciaBordaCava` e
`tamanhoCava` para este modelo, mas o motor não os utiliza —
**Felipe revisar** se mod 11 deveria de fato ter cava real ou só puxador.

#### MODELO 15 — Puxador Externo + Ripado

Igual ao mod 11 mas com ripado em vez de friso. Variáveis:
`espacamentoRipas`, `tipoRipado`.

Peças:
- `cava`, `l_da_cava` — iguais ao mod 11 (puxador externo)
- `tampa_maior_cava` — (larguraQuadro + 2·REF − 2) × alturaQuadro × 1 → 1893
- `ripas` — 94 × (alturaQuadro − 293) × 44

**Validação:** TAMPA_MAIOR_CAVA = 1893 ✓ (planilha: 1893).

### Outras alterações

`construirContexto()` agora expõe 5 novas variáveis no `ctx`
(`distBordaFriso`, `espessuraFriso`, `qtdFrisos`, `espacamentoRipas`,
`tipoRipado`) lidas dos campos já existentes do item. Modelos 01 e 10
não usam essas variáveis — sem impacto.

Switch `gerarPecasChapa` linha 216 estendido para casos 2, 8, 11, 15.
Modelos sem case mantém `default: break` (lista vazia, comportamento
inalterado).

---

## O que NÃO foi feito (pendente)

### 1. 2 FOLHAS (todos os 6 modelos)

A planilha tem variantes 2F para todos os modelos, com geometria
significativamente diferente:
- TAMPA_MAIOR_CAVA do 1F vira **TAMPA_MAIOR 01 + 02 + 03** (3 peças)
- Aparecem novas peças: **TAMPA_DA_CAVA**, **TAMPA_MENOR**
- Universais 2F também mudam (qty dobra para ACAB_LAT_*, BAT_* mantêm…)

Implementar 2F é mudança arquitetural não-trivial. Está bloqueado por
`gerarPecasChapa` linha ~196: `if (quadro.nFolhas !== 1) return [];`.

**Próxima sessão:** definir com Felipe a estrutura 2F antes de implementar.

### 2. Correções dos modelos 01 e 10 existentes

Ao validar com a planilha, detectei **discrepâncias** nos modelos que
já existiam (não foram alteradas para preservar o comportamento atual):

| Item | Código atual | Planilha | Diff |
|---|---|---|---|
| Mod 01 CAVA largura | 268 (3·REF + dBC − 2) | 266 | +2 |
| Mod 01 CAVA altura | alturaQuadro = 4919 | 4626 | −293 |
| Mod 10 CAVA | (não gera) | 116 × 4626 × 2 | faltando |
| Mod 10 L_DA_CAVA | (não gera) | 90 × 210 × 4 | faltando |
| Mod 10 TAMPA | larguraQuadro × alturaQuadro | TAMPA_MAIOR_CAVA = 1894 | diferente |
| ALISAR_ALTURA largura | (esp−80)/2 + 5 + larg + 2·REF = 230 | 335 | −105 |
| ALISAR_ALTURA comp | A + larguraAlisar = 5100 | A + larguraAlisar + 100 = 5200 | −100 |
| ALISAR_ALTURA qty | 2 (1 ext + 1 int) | 5 (per side) | qty diff |

Hipótese para ALISAR largura: `espessuraParede + larguraAlisar − 15`
(funciona pra 250→335 e 210→295). Mas é especulação.

**Felipe precisa decidir:**
- A planilha é a versão atualizada/correta? Se sim, atualizar mods 01 e 10.
- O código atual é para itens já em produção? Se sim, manter como está
  e usar a planilha só para os modelos novos.

### 3. Quantidade de Ripas — fórmula desconhecida

A planilha mostra `qty=44` para `espacamentoRipas=30`, `larguraQuadro=1855`,
`alturaQuadro=4919`. Com 1 único data point, não dá pra derivar a fórmula.

**Hardcoded como 44** nos modelos 08 e 15. Felipe precisa validar com
outros cenários (variar espacamento) pra inferir a regra.

### 4. Inconsistência mod 11 (cava real vs puxador externo)

Título da planilha diz "Cava" mas medidas batem com "puxador externo".
Felipe precisa esclarecer.

### 5. Discrepância de QTD em TAMPA_BORDA_FRISO

Planilha mod 02 1F: `qty=1` para qtdFrisos=1.
Obs da planilha diz: "Quantidade de frisos externo / Quantidade de
frisos interno" → sugere `qty = qtdFrisos × 2 sides = 2` para qtdFrisos=1.

Implementei conforme a OBS (qty=qtdFrisos por lado, total=2). Pode estar
em conflito com a coluna qty do exemplo. **Felipe revisar.**

---

## Arquivos modificados

- `scripts/38-chapas-porta-externa.js` — switch + 4 funções novas + ctx estendido. **+200 linhas, 0 linhas removidas dos modelos existentes.**

Sintaxe validada com `node -c` em todos os 32 scripts → zero erros.

---

## Como reverter

Se algum dos modelos novos der problema:

1. Em `scripts/38-chapas-porta-externa.js`:
   - Remover os 4 case novos do switch (linhas após `case 1:`).
   - Remover as 4 funções `gerarPecasModelo02/08/11/15`.
   - Reverter `construirContexto()` removendo as 5 variáveis novas
     do ctx (`distBordaFriso`, etc).

2. Modelos 01 e 10 não foram tocados — não precisam reverter.

Reverter é **2 blocos isolados** num único arquivo.

---

## Smoke tests (todos passaram)

| Modelo | Peças geradas | Validação chave |
|---|---|---|
| 02 (Cava + Friso) | 6 específicas + 13 universais = 19 | TAMPA_MAIOR_CAVA = 1313 ✓ |
| 08 (Cava + Ripado) | 5 específicas + 13 universais = 18 | RIPAS qty=44 (hardcoded) |
| 11 (Pux + Friso) | 5 específicas + 13 universais = 18 | TAMPA_MAIOR_CAVA = 1674 ✓ |
| 15 (Pux + Ripado) | 4 específicas + 13 universais = 17 | TAMPA_MAIOR_CAVA = 1893 ✓ |
| 01 (regressão) | inalterado | mesma saída de antes ✓ |
| 10 (regressão) | inalterado | mesma saída de antes ✓ |
| 2F (todos) | 0 peças (pendente) | comportamento atual preservado |
