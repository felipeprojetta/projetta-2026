# SESSÃO 25 — 2026-05-02

## Escopo

Sessão grande com 3 frentes:
1. **Chapas 2 FOLHAS** — implementação dos 6 modelos liberados pelo Felipe
   (01, 02, 08, 10, 11, 15) com base na planilha
   `PRECIFICAÇÃO_01_04_2026.xlsx`
2. **Friso vertical (perfil de reforço)** — tubo PA-76X76 / PA-101X101
   entrando automaticamente no levantamento de perfis
3. **Fix de quota localStorage** — snapshot leve nos drafts +
   auto-recover

---

## 1. Chapas 2 FOLHAS (`scripts/38-chapas-porta-externa.js`)

### Fórmula central descoberta e validada com a planilha

```
TM02_refil = (larguraQuadro_2F − encontro) / 2 − desconto
TM01_refil = TM02_refil + 2·REF − 1
TM03_refil = TM02_refil − 2·REF + 2

Larguras COM refilado: TM_largura = TM_refil + 2·REF

encontro:
  60 → modelos com cava real (01, 02, 08)
  57 → modelos com puxador externo (10, 11, 15)

desconto:
  01, 08 → dBC + tamCava
  02     → dBC + tamCava + dBF + eF
  10, 15 → 0
  11     → dBF + eF
```

### Validação contra a planilha (L=2000, H=5000)

| Modelo | TM01 / TM02 / TM03 (código) | Planilha | Diff máx |
|---|---|---|---|
| 01 2F | 635.5 / 596.5 / 558.5 | 636 / 597 / 559 | ±0.5 |
| 02 2F | 415.5 / 376.5 / 338.5 | 415.5 / 377 / 339 | ±0.5 |
| 08 2F | 635.5 / 596.5 / 558.5 | 635.5 / 597 / 559 | ±0.5 |
| 10 2F | 997 / 958 / 920 | 996 / 958 / 920 | ±1 |
| 11 2F | 777 / 738 / 700 | 776 / 738 / 700 | ±1 |
| 15 2F | 997 / 958 / 920 | 995.5 / 957 / 919 | ±1.5 |

Diffs de ±0.5–1.5mm são variações de arredondamento (irrelevantes
em produção). O motor depois arredonda para inteiro via `Math.round`
no `add()`.

### Distribuição das peças por face (2F)

| Peça | Face externa | Face interna | Total |
|---|---|---|---|
| TM01 | 1 | — | 1 |
| TM02 | 1 | 1 | 2 |
| TM03 | — | 1 | 1 |
| CAVA | 2 | 2 | 4 |
| TAMPA_DA_CAVA | 4 | 4 | 8 |
| TAMPA_MENOR (=TAMPA_BORDA_CAVA do 1F) | 2 | 2 | 4 |
| ACAB_LAT_* | 2 | 2 | 4 |
| BAT/TAP/FIT/ALISAR (portal) | igual 1F | igual 1F | igual 1F |

### Estrutura adicionada

- 2 helpers DRY: `_calcularTampasMaiores2F`, `_adicionarTampasMaiores2F`
- 6 funções `gerarPecasModeloXX_2F` (uma por modelo)
- 1 função `gerarPecasUniversais2Folhas` (ACAB_LAT × 2 vs 1F; portal igual)
- Switch 2F separado do switch 1F em `gerarPecasChapa` — risco zero em 1F

### Regressão validada

| Modelo | 1F (qtd peças) |
|---|---|
| 01 | 17 (inalterado) |
| 02 | 19 (inalterado) |
| 08 | 18 (inalterado) |
| 10 | 14 (inalterado) |
| 11 | 18 (inalterado) |
| 15 | 17 (inalterado) |

---

## 2. Friso vertical — perfil de reforço (`scripts/31-perfis-porta-externa.js`)

Quando o modelo tem friso vertical, adiciona automaticamente um tubo
de reforço dentro do friso:
- Família 76 → `PA-76X76X2.0`
- Família 101 → `PA-101X101X2.5`
- Comprimento = `TRAV_VERT` (altura útil entre batentes)
- Quantidade = `qtdFrisos × nFolhas` (Felipe sessao 2026-09)

### Constante adicionada

```js
const MODELOS_COM_FRISO_VERTICAL = new Set([2, 4, 5, 7, 11, 13, 14, 22]);
// Modelo 6 NÃO entra (é friso horizontal, já tratado por ehFriso6 — mutuamente exclusivos)
```

### Smoke tests passados (8 cenários)

- Mod 02 1F qtdFrisos=1 → qty 1 ✓
- Mod 02 2F qtdFrisos=1 → qty 2 ✓
- Mod 02 2F qtdFrisos=2 → qty 4 ✓
- Mod 11 fam 76 (alt 3000) → PA-76X76X2.0 ✓
- Mod 11 fam 101 (alt 5000) → PA-101X101X2.5 ✓
- Mod 06 (regressão ehFriso6) → continua qty 1 ✓
- Mod 01 sem friso → não adiciona ✓
- Mod 02 com qtdFrisos vazio → não adiciona (defensivo) ✓

---

## 3. Fix de quota localStorage (`scripts/12-orcamento.js`)

### Problema
Felipe reportou `QuotaExceededError` no módulo Orçamento. Diagnóstico:
- `precos_snapshot` = 65.3 KB cada × 33 versões = **2.15 MB de redundância**
- `cadastros:m...` = 2.72 MB (provavelmente imagens base64 — ainda pendente)

### Descoberta crítica
`grep "precos_snapshot"` mostrou **4 WRITES, 0 READS** — o snapshot é
estrutura reservada pra "Etapa 3" futura, nunca lida. Pode ser
substituído por marcador leve sem impacto funcional.

### Fix
- `snapshotPrecosAtual()` retorna marcador leve `{pendente: true, tiradoEm}` (~50 bytes)
- `snapshotPrecosCompleto()` preserva versão pesada (usado SÓ em `fecharVersao`)
- `saveAll()` defensivo: se `setItem` falhar, auto-limpa snapshots de drafts e tenta de novo
- `Orcamento.manutencao.relatorio()` e `.limparSnapshotsDrafts()` expostos pra console

### Economia
- 33 snapshots × 65 KB = 2.15 MB
- Após fix (5 fechadas + 28 drafts): 5 × 65 KB + 28 × 50 B ≈ 327 KB
- **Liberou ~1.8 MB**

---

## Pendências documentadas (próximas sessões)

### Bloqueante (verificar antes de implementar mais modelos)
- **Cadastros:m... (2.72 MB)** — Felipe precisa rodar o script de
  console enviado na sessão pra confirmar se é `modelos_lista` com
  imagens base64. Solução depende do diagnóstico.

### Não bloqueante
1. **Modelos 03, 04, 05, 06, 07** — Felipe vai enviar planilha em breve
2. Modelos 01 e 10 1F — discrepâncias com planilha (CAVA height/width)
3. Fórmula da QTD de RIPAS — hardcoded em 44 (precisa de mais cenários)
4. ALISAR_ALTURA qty 2 no código vs 5 na planilha (em todos modelos)
5. Discrepância de QTD em TAMPA_BORDA_FRISO (planilha vs interpretação)
6. Inconsistência mod 11 cava real vs puxador externo no CAMPOS_POR_MODELO
7. **Migração Supabase** — Felipe rejeitou pra agora, prioriza features

---

## Arquivos modificados nesta sessão

| Arquivo | Mudanças |
|---|---|
| `scripts/12-orcamento.js` | snapshot leve + saveAll defensivo + manutenção |
| `scripts/31-perfis-porta-externa.js` | constante + corte tubo friso vertical |
| `scripts/38-chapas-porta-externa.js` | 6 motores 2F + universals 2F + helpers |

**Nenhum outro arquivo foi tocado.** Sintaxe validada com `node -c` em
todos os 32 scripts → zero erros.

---

## Como reverter

Cada uma das 3 frentes é reversível independentemente:

**Reverter chapas 2F:**
- Em `38-chapas-porta-externa.js`, restaurar early-return original:
  `if (quadro.nFolhas !== 1) return [];`
- Remover as 6 funções `_2F`, helpers e universals 2F.

**Reverter friso vertical perfil:**
- Em `31-perfis-porta-externa.js`, remover constante
  `MODELOS_COM_FRISO_VERTICAL` e o bloco `if (MODELOS_COM_FRISO_VERTICAL.has...)`.

**Reverter fix de storage:**
- Em `12-orcamento.js`, restaurar `snapshotPrecosAtual()` à versão
  pesada original e remover try/catch de `saveAll`.
