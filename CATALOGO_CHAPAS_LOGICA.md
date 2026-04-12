# CATÁLOGO PROJETTA — Lógica Completa de Chapas ACM e Fita Dupla Face

## Variáveis Base

```
L     = Largura do vão (mm)
A     = Altura do vão (mm)
FGA   = 10mm (folga altura)
FGLA  = 20mm (folga lateral)
PIV   = 28mm (espessura pivô)
TRANS = 8mm (transição pivô)
REF   = 20mm (referência/dobra)
VED   = 35mm (vedação porta)
TUB   = 38.1mm (PA006) ou 50.8mm (PA007)
  → Internacional: SEMPRE PA007

G4 = A - FGA - TUB - PIV + TRANS        (altura chapa frontal)
G3 = L - FGLA - 343 + 218               (largura chapa frontal 1FLH)
G2total = L - FGLA - 343 + 256          (largura total 2FLH)
fW = G3 (1 folha) ou G2total/2 (2 folhas)
bH = G4 + 116                            (altura batente)
nL = 2 (1 folha) ou 4 (2 folhas)        (qty acabamentos laterais)
```

---

## 1. CHAPAS PORTA — Por Modelo

### Modelo 01 (Cava)

**Variáveis adicionais:**
```
DC = Largura da cava (padrão 150mm)
HC = Dist. borda cava (padrão 210mm)
cavaH = G4 - HC × 1.4
cavaDeduc = DC + HC + 2
```

**Peças 1 FOLHA:**

| Peça | Largura | Altura | Qty | Local |
|---|---|---|---|---|
| CAVA | DC + 116 | cavaH | 2 | PORTA |
| TAMPA CAVA | DC + 90 | HC | 4 | PORTA |
| TAMPA MAIOR | fW + 40 - cavaDeduc | G4 | 2 | PORTA |
| TAMPA BOR CAVA | HC + 38 | G4 | 2 | PORTA |
| ACAB LAT 1 | 88.5 | G4 | 2 | PORTA |
| ACAB LAT 2 | 90 | G4 | 2 | PORTA |
| ACAB LAT Z | 110 | G4 | 2 | PORTA |
| U PORTAL | 221 | L - 20 | 1 | PORTAL |
| BAT 01 | 42 | bH | 2 | PORTAL |
| BAT 02Z | 51 | bH | 2 | PORTAL |
| BAT 03 | 81 | bH | 2 | PORTAL |
| TAP FURO | 119 | bH | 3 | PORTAL |
| FIT ACAB ME | 76.5 | bH | 2 | PORTAL |
| FIT ACAB MA | 114.5 | bH | 2 | PORTAL |
| FIT ACAB FITA | 101 | bH | 2 | PORTAL |

**Peças 2 FOLHAS (substitui TAMPA MAIOR e TAMPA BOR CAVA):**

| Peça | Largura | Altura | Qty | Local |
|---|---|---|---|---|
| CAVA | DC + 116 | cavaH | 4 | PORTA |
| TAMPA CAVA | DC + 90 | HC | 8 | PORTA |
| TAMPA MAIOR 01 | baseA + FGA + FGLA×2 - 1 | G4 | 1 | PORTA |
| TAMPA MAIOR 02 | baseB + FGLA×2 - PIV - 1 | G4 | 2 | PORTA |
| TAMPA MAIOR 03 | T2 - TUB | G4 | 1 | PORTA |
| TAMPA MENOR | HC + REF×2 - 2 | G4 | 4 | PORTA |
| ACAB LAT 1/2/Z | idem 1FLH | G4 | 4 cada | PORTA |

Onde: `baseA = (G2total - HC×2 - DC×2) / 2`, `baseB = (G2total - 1 - HC×2 - DC×2) / 2`

**Alisar (opcional, checkbox):** ALT 225 × (A+150) × 5, LAR 225 × (L+300) × 2

---

### Modelo 02 (Cava + Friso)

Todas as peças do Modelo 01 MAIS:

| Peça | Largura | Altura | Qty | Local |
|---|---|---|---|---|
| TAMPA FRISO | DIS_BOR_FRI + 39 | G4 | 2 (1F) / 4 (2F) | PORTA |
| FRISO | LARG_FRISO + 100 | G4 | 2 (1F) / 4 (2F) | PORTA |

TAMPA MAIOR deduz: `frisoDeduc = DIS_BOR_FRI + LARG_FRISO`

---

### Modelo 08 (Cava + Ripado)

Todas as peças do Modelo 01 MAIS:

| Peça | Largura | Altura | Qty | Local |
|---|---|---|---|---|
| RIPAS | 98 | G4 | ceil((fW - DIS_BOR×2 - LARG_CAVA) / 90) × 2 | PORTA |

---

### Modelo 10 (Lisa)

**Peças 1 FOLHA:**

| Peça | Largura | Altura | Qty | Local |
|---|---|---|---|---|
| TAMPA MAIOR | fW + 40 | G4 | 2 | PORTA |
| ACAB LAT 1 | 88.5 | G4 | 2 | PORTA |
| ACAB LAT 2 | 90 | G4 | 2 | PORTA |
| ACAB LAT Z | 110 | G4 | 2 | PORTA |
| U PORTAL | 221 | L - 20 | 1 | PORTAL |
| BAT 01 | 42 | bH | 2 | PORTAL |
| BAT 02Z | 51 | bH | 2 | PORTAL |
| BAT 03 | 81 | bH | 2 | PORTAL |
| TAP FURO | 119 | bH | 3 | PORTAL |
| FIT ACAB ME | 76.5 | bH | 2 | PORTAL |
| FIT ACAB MA | 114.5 | bH | 2 | PORTAL |
| FIT ACAB FITA | 101 | bH | 2 | PORTAL |

**Peças 2 FOLHAS (substitui TAMPA MAIOR):**

| Peça | Largura | Altura | Qty | Local |
|---|---|---|---|---|
| TAMPA MAIOR 01 | base + FGA + FGLA×2 - 1 | G4 | 1 | PORTA |
| TAMPA MAIOR 02 | base + FGLA×2 - PIV | G4 | 2 | PORTA |
| TAMPA MAIOR 03 | T2 - TUB | G4 | 1 | PORTA |

Onde: `base = G2total / 2`

---

### Modelo 11 (Lisa + Friso)

Todas as peças do Modelo 10 MAIS:

| Peça | Largura | Altura | Qty | Local |
|---|---|---|---|---|
| TAMPA FRISO | DIS_BOR_FRI + 39 | G4 | 2 (1F) / 4 (2F) | PORTA |
| FRISO | LARG_FRISO + 100 | G4 | 2 (1F) / 4 (2F) | PORTA |

TAMPA MAIOR deduz: `frisoDeduc = DIS_BOR_FRI + LARG_FRISO`

---

### Modelo 15 (Lisa + Ripado)

Todas as peças do Modelo 10 MAIS:

| Peça | Largura | Altura | Qty | Local |
|---|---|---|---|---|
| RIPAS | 98 | G4 | ceil((fW - acabLat×2 - 90 - 110) / 90) × 2 | PORTA |

---

### Modelo 23 ACM / 23 ALU (Lisa + Moldura)

Todas as peças do Modelo 10 MAIS:

**1 FOLHA:**

| Peça | Largura | Altura | Qty | Local |
|---|---|---|---|---|
| MOLD LAR | 143 | G3 - DIS_BOR×2 | 8 | PORTA |
| MOLD ALT1 | 143 | 1020 + PIV - DIS_BOR×1.5 | 4 | PORTA |
| MOLD ALT2 | 143 | G4 - DIS_BOR×3 - moldAlt1 | 4 | PORTA |

**2 FOLHAS:**

| Peça | Largura | Altura | Qty |
|---|---|---|---|
| MOLD LAR 01 | 143 | vis1 - DIS_BOR×2 | 4 |
| MOLD LAR 02 | 143 | vis2 - DIS_BOR×2 | 8 |
| MOLD LAR 03 | 143 | vis3 - DIS_BOR×2 | 4 |
| MOLD ALT1 | 143 | moldAlt1 | 8 |
| MOLD ALT2 | 143 | moldAlt2 | 8 |

---

## 2. CHAPAS FIXO — Por Modelo

### Fixo Superior — Modelos 01, 02, 08 (com cava)

| Peça | Largura | Altura | Qty (1L/2L) | Local |
|---|---|---|---|---|
| FX CAVA SUP | DC + 116 | Afixo - TUB×2 | 1 / 2 | FIXO |
| FX L CAVA | DC + 90 | 210 | 2 / 4 | FIXO |
| FX TAMPA MAIOR | M_TAMPA + 44 + REF | Afixo + TUB + REF | 1 | FIXO |
| FX TAMPA MAIOR 2L | M_TAMPA + 82 + REF | idem | — / 1 | FIXO |
| FX TAMPA BOR CAVA | M_BORDA + 44 + REF | idem | 1 | FIXO |
| FX TAMPA BOR CAVA 2L | M_BORDA + 82 + REF | idem | — / 1 | FIXO |
| FX FIT ME | 76.5 | Afixo + 100 | 1 / 2 | FIXO |
| FX FIT MA | 114.5 | Afixo + 100 | 1 / 2 | FIXO |
| FX FIT FITA | 101 | Lporta + 100 | 1 / 2 | FIXO |
| FX BAT 01 | 47 | bH | 1 / 2 | FIXO |
| FX BAT 03 | 70 | bH | 1 / 2 | FIXO |

Onde: `M_TAMPA = TAMPA_MAIOR_W - REF×2`, `M_BORDA = TAMPA_BORDA_W - REF×2`

**Modelo 02 adiciona:** FX FRISO larFriso + 100 × hTampaFix × (1/2)
**Modelo 08 adiciona:** FX RIPAS 98 × hCavaFix × nRipas×(1/2)

### Fixo Superior — Modelos 10, 11, 15, 23 (lisa)

| Peça | Largura | Altura | Qty (1L/2L) | Local |
|---|---|---|---|---|
| FX TAMPA MAIOR | M_lisaT + 44 + 82 - 1 | Afixo + TUB + REF | 1 | FIXO |
| FX TAMPA MAIOR 2L | M_lisaT + 44 + 44 - 1 | idem | — / 1 | FIXO |
| FX FIT ME | 76.5 | Afixo + 100 | 1 / 2 | FIXO |
| FX FIT MA | 114.5 | Afixo + 100 | 1 / 2 | FIXO |
| FX FIT FITA | 101 | Lporta + 100 | 1 / 2 | FIXO |
| FX BAT 01 | 47 | bH | 1 / 2 | FIXO |
| FX BAT 03 | 70 | bH | 1 / 2 | FIXO |

Onde: `lisaTW = G3 + 40`, `M_lisaT = lisaTW - REF×2`

### Fixo Lateral (todos os modelos)

| Peça | Largura | Altura | Qty |
|---|---|---|---|
| FX LATERAL | Lfixo + 100 | Afixo + 100 | lados |

---

## 3. FITA DUPLA FACE — PORTA

### DOWSIL 995 Preto (sachê 591ml, ~8m/tubo)

```
PA006: mDow = A×6 + L×4 + A×4×conj
PA007: mDow = A×4 + L×4 + A×4×conj
conj = 4 (2 folhas) ou 2 (1 folha)
tubos = ceil(mDow / 1000 / 8)
Código: PA-DOWSIL 995 ESTR SH
Grupo: SELANTES | Aplicação: FAB
```

### FITA DFIX 19mm (rolo 20m)

```
PA006: mFD19 = A×2 + L×2 + A×conj
PA007: mFD19 = A×6 + L×2 + A×conj
conj = 4 (2 folhas) ou 2 (1 folha)
rolos = ceil(mFD19 / 1000 / 20)
Código: PA-FITDF 19X20X1.0
Grupo: FITA DUPLA FACE | Aplicação: FAB
```

### FITA DFIX 12mm (rolo 20m)

```
PA006: mFD12 = A×6 + L×4
PA007: mFD12 = A×2 + L×4
rolos = ceil(mFD12 / 1000 / 20)
Código: PA-FITDF 12X20X1.0
Grupo: FITA DUPLA FACE | Aplicação: FAB
```

---

## 4. FITA DUPLA FACE — FIXO

Calculado dentro de `_calcFixoPerfisOS()` baseado nos perfis do fixo:

### FITA DFIX 12mm (fixo)
```
totFD12 = soma dos comprimentos dos perfis do fixo que usam FD12
rolos = ceil(totFD12 / 1000 / 20)
Código: PA-FITDF 12X20X1.0
Grupo: FITA DUPLA FACE | Aplicação: FAB
```

### FITA DFIX 19mm (fixo)
```
totFD19 = soma dos comprimentos dos perfis do fixo que usam FD19
rolos = ceil(totFD19 / 1000 / 20)
Código: PA-FITDF 19X20X1.0
Grupo: FITA DUPLA FACE | Aplicação: FAB
```

### DOWSIL 995 (fixo)
```
totDow = soma dos comprimentos dos perfis do fixo que usam Dowsil
tubos = ceil(totDow / 1000 / 8)
Código: PA-DOWSIL 995 ESTR SH
Grupo: SELANTES | Aplicação: FAB
```

---

## 5. CLASSIFICAÇÃO POR LOCAL

### PORTA (badge verde)
TAMPA MAIOR (01/02/03), CAVA, TAMPA BOR CAVA, TAMPA CAVA, TAMPA MENOR,
ACAB LAT 1, ACAB LAT 2, ACAB LAT Z, TAMPA FRISO, FRISO, FRISO VERT,
DIST BOR FV, RIPAS

### PORTAL (badge laranja)
U PORTAL, BAT 01, BAT 02Z, BAT 03, TAP FURO,
FIT ACAB ME, FIT ACAB MA, FIT ACAB FITA, ALISAR ALT, ALISAR LAR

### FIXO (badge azul)
Todas as peças com prefixo "FX " (FX CAVA SUP, FX TAMPA MAIOR, etc.)

---

## 6. FÓRMULAS AUXILIARES

```
TRAV_V = H - FGA - TUB - PIV - 2×VED - 2×TUBO_LAR
TUB_CA = TRAV_V - 20
CANT_CA = TRAV_V
Peso chapa = L × A × qty / 1e6 × 6.5 kg/m²
```

---

*Última atualização: 12/Abr/2026*
