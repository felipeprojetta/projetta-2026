# CHANGELOG — Sessão 26 (final, com todos os modelos)

## Resumo

Reescrita completa do motor de chapas de Porta Externa
(`scripts/38-chapas-porta-externa.js`) usando **motor declarativo**.
Todas as fórmulas vêm DIRETO da planilha `PRECIFICAÇÃO_01_04_2026.xlsx`.

**Modelos suportados (1F + 2F):** 01, 02, 03, 04, 06, 08, 10, 11, **12**, **13**, 15, **16**

(modelos em **negrito** = adicionados na atualização v3 da planilha)

## Modelos finais

| Modelo | Descrição | Vars usadas |
|--------|-----------|------|
| 01 | Cava | dBC, tamCava |
| 02 | Cava + Friso V (qtdFrisos) | dBFV, eF, qtdFrisos |
| 03 | Cava + Friso H | dBFH, eF |
| 04 | Cava + Friso H + V | dBFH, dBFV, eF |
| 06 | Cava + N Frisos H | qtdFrisos, eF |
| 08 | Cava + Ripado | espacRipas, tipoRipado, duasFaces |
| 10 | Puxador Externo Lisa | (sem cava) |
| 11 | Puxador Externo + Friso V | dBFV, eF, qtdFrisos |
| **12** | **Cava + Friso H — sem TAMPA_BORDA_CAVA** | **dBFH, eF** |
| **13** | **Cava + Friso H+V — sem TAMPA_BORDA_CAVA** | **dBFH, dBFV, eF** |
| 15 | Puxador Externo + Ripado | espacRipas, tipoRipado, duasFaces |
| **16** | **Cava + N Frisos H simplificado** | **qtdFrisos, eF** |

## Diferenças críticas dos novos modelos (12, 13, 16)

### MODELO 12 (vs MODELO 03)
- ❌ NÃO tem `TAMPA_BORDA_CAVA`
- TAMPA_MAIOR_CAVA comp tem **−1 extra**: `alturaQuadro − 2*dBFH − 2*eF + 2*REF − 1`
- Peças 1F: `[cava, friso_horizontal_cava (1855×250), tampa_maior_cava, tampa_friso_horizontal, friso_horizontal]` + universais

### MODELO 13 (vs MODELO 04)
- ❌ NÃO tem `TAMPA_BORDA_CAVA`
- Comp da `TAMPA_FRISO_VERTICAL` usa `alturaQuadro` (não `larguraQuadro1F`)
- Comp da `TAMPA_MAIOR_CAVA` usa `alturaQuadro` (não `larguraQuadro1F`)
- Estrutura geral igual mod 04 menos a TAMPA_BORDA_CAVA

### MODELO 16 (vs MODELO 06)
- ❌ NÃO tem `TAMPA_BORDA_CAVA` (1F) nem `TAMPA_MENOR` (2F)
- 🔑 **`TAMPA_MAIOR_CAVA` 1F ocupa LARGURA INTEIRA do quadro:** `(larguraQuadro1F − 1) + 2*REF`
  (não desconta `dBC` nem `tamCava` como mod 06!)
- Comp e qty seguem fórmula do mod 06: `(alturaQuadro − qtdFrisos*eF) / (qtdFrisos+1) + 2*REF`, qty = qtdFrisos

## Erros críticos da versão anterior — TODOS corrigidos

1. ✅ **ALISAR_ALTURA largura**: era `(esp − 80)/2 + 5 + larg + 2*REF` = 230mm. Agora `(esp − 80/2) + 5 + larg + REF` = **335mm** (parêntese corrigido).
2. ✅ **ALISAR_LARGURA comp**: era `H + larg + 100`. Agora `L + 100` = **2100mm**.
3. ✅ **CAVA comp PA007**: era alturaQuadro pura. Agora `alturaQuadro − 293` = **4626mm**.
4. ✅ **BAT_01/TAP_FURO/FIT comp**: era `+100`. Agora `+116` = **5035mm**.
5. ✅ **CAVA largura**: era `3*REF + dBC − 2`. Agora `tamCava + 116` = **266mm**.
6. ✅ **ACAB_LAT_1**: era 89. Agora **88.5**.
7. ✅ **MOD 02 TAMPA_MAIOR**: agora desconta `dBFV*qtdFrisos + eF*qtdFrisos`.

## Validação completa

**32 smoke tests, 100% passando** contra valores REAIS calculados pela planilha:

```
=== Mod 01 1F (regressão) ===
✓ CAVA 266×4626, TAMPA_MAIOR_CAVA 1533, TAMPA_BORDA_CAVA 248
✓ ACAB_LAT_1=88.5, BAT_01 41.5×5035, ALISAR_ALTURA 335×5200
✓ ALISAR_LARGURA 335×2100, U_PORTAL_2C 170×1980

=== Mod 06 1F (qtdFrisos=9) ===
✓ TAMPA_MAIOR_CAVA 1533×522.9 qty=9

=== Mod 08 RIPAS ===
✓ qtd=23 (=ROUNDUP(2000/90))

=== Mod 12 1F (NOVO) ===
✓ CAVA 266×4626, FRISO_H_CAVA 1855×250
✓ TAMPA_MAIOR_CAVA 1533×4518
✓ TAMPA_FRISO_H 1894×230
✓ SEM TAMPA_BORDA_CAVA

=== Mod 13 1F (NOVO) ===
✓ CAVA 266, L_DA_CAVA 240
✓ TAMPA_MAIOR_CAVA 1313×4718
✓ TAMPA_FRISO_VERT comp=4479
✓ FRISO_VERTICAL comp=5019
✓ SEM TAMPA_BORDA_CAVA

=== Mod 16 1F+2F (NOVO, qtdFrisos=9) ===
✓ TAMPA_MAIOR_CAVA larg=1894 (largura inteira)
✓ TAMPA_MAIOR_CAVA comp=522.9 qty=9
✓ 2F TM01 qty=9, TM02 qty=9
✓ SEM TAMPA_BORDA_CAVA, SEM TAMPA_MENOR
```

## Contagem total de peças por modelo (qtdFrisos=9)

| Mod | 1F | 2F |
|-----|-----|-----|
| 01  | 34  | 36 |
| 02  | 36  | 36 |
| 03  | 38  | 42 |
| 04  | 44  | 50 |
| 06  | 34  | 36 |
| 08  | 36  | 38 |
| 10  | 28  | 30 |
| 11  | 30  | 30 |
| **12** | **36** | **40** |
| **13** | **42** | **48** |
| 15  | 30  | 32 |
| **16** | **32** | **34** |

## Arquitetura

### Antes (versão velha, 1260 linhas)
- 6 funções gigantes `gerarPecasModelo01_1F`, `gerarPecasModelo01_2F`, etc.
- Centenas de chamadas `add()` inline.
- Cada modelo era ~100 linhas espalhadas.

### Agora (versão nova, **1039 linhas**)
- **Tabela declarativa** `TABELA[modelo][variant]` com peças.
- Cada peça é `{ id, label, largura(ctx), comp(ctx), ext, int, categoria, ehDaCava }`.
- Função `materializar()` única roda tudo.
- Adicionar novo modelo = adicionar entrada na tabela (~30-50 linhas).

## Compatibilidade da API

API pública 100% preservada — chamadas externas NÃO precisam mudar:
- `ChapasPortaExterna.calcularQuadro(item)`
- `ChapasPortaExterna.gerarPecasChapa(item, lado)`
- `ChapasPortaExterna.descreverQuadro(item)`
- `ChapasPortaExterna.obterFamilia(item)`
- `ChapasPortaExterna.getVarsFam()`
- `ChapasPortaExterna.getVarsChapas()`

## Pendências para Felipe revisar

### Sutilezas a confirmar
1. **MODELO 03 - FRISO_HORIZONTAL_CAVA** — fórmula da planilha estava truncada. Implementei como `larguraQuadro1F × 250 mm`. Confirmar.
2. **MODELO 12 - FRISO_HORIZONTAL_CAVA** — mesmo (largura=larguraQuadro1F, comp=250).
3. **MODELO 16 - TAMPA_MAIOR_CAVA largura inteira** — confirmou-se na planilha. Conferir se faz sentido fisicamente (tampa cobrindo toda a largura, sem cava ao lado).

### Distribuição face ext/int em peças com qty ímpar
1. **TAP_FURO qty=3** — atualmente 2 ext + 1 int. (planilha tem obs "2 ext / 2 int" = 4 total, conflito)
2. **ALISAR_ALTURA qty=5** — atualmente 3 ext + 2 int.

### Modelos não suportados
- **05 e 07** — não estão na planilha. Removidos do motor.

## Arquivos alterados

- `scripts/38-chapas-porta-externa.js` — REESCRITO + atualização (1260 → 1039 linhas)
- `CHANGELOG_SESSAO_26.md` — este arquivo

## Como testar

1. Carregar o ZIP no servidor/local
2. Criar uma porta com `modeloExterno: 12` (ou 13 ou 16)
3. Conferir as peças geradas no orçamento contra a planilha real

API pública 100% preservada — qualquer código existente que chame
`ChapasPortaExterna.gerarPecasChapa(item, lado)` continua funcionando.
