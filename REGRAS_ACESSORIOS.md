# REGRAS DE QUANTIDADE — ACESSÓRIOS POR PORTA

Este documento contém **TODAS as regras** que Felipe passou na sessão
2026-08 pra implementação futura no levantamento de acessórios.

## Variáveis

```
H        = altura (mm)
L        = largura (mm)
nFolhas  = 1 ou 2
sis      = PA006 (sistema 130mm) ou PA007 (sistema 150mm)
fechTipo = 04/08/12/16/24 PINOS (vazio = sem fechadura)
puxTipo  = EXTERNO / CAVA
puxTam   = 1.0 / 1.5 / 2.0 / 2.5 / 3.0 / 3.5 / 4.0 / 4.5 / 5.0 / CLIENTE / vazio
digTipo  = TEDEE / EMTECO / PHILIPS / NUKI / vazio
fglD     = folga direita (mm)
fglE     = folga esquerda (mm)
ripado   = boolean (modelo de revestimento ripado)
```

---

## FABRICAÇÃO

### 1. FECHADURA KESO

| fechTipo | Código | Qtd |
|---|---|---|
| 04 PINOS | `PA-KESO04P*` (variante mais cara) | 1 |
| 08 PINOS | `PA-KESO08P*` | 1 |
| 12 PINOS | `PA-KESO12*` | 1 |
| 16 PINOS | `PA-KESO16*` | 1 |
| 24 PINOS | `PA-KESO24P*` | 1 |

Sempre escolher a variante com **maior preço** (`maxPrecoByPrefix`).

### 2. ROSETA KESO

```
Se tem fechadura → 2 unidades (frente + verso)
Código: PA-KESO ROS (variante mais cara)
```

### 3. CILINDRO

| Marca | sis | Código | Qtd |
|---|---|---|---|
| KESO (padrão) | PA006 (130mm) | `PA-KESOCIL130 BT` (chave-botão) | 1 |
| KESO | PA007 (150mm) | `PA-KESOCIL150 BT` | 1 |
| UDINESE | PA006 | `PA-CIL UDINE 130 BL` (preto) | 1 |
| UDINESE | PA007 | `PA-CIL UDINE 150 BL` | 1 |

### 4. PUXADOR EXTERNO

| puxTam | Código |
|---|---|
| 1.0 | `PA-PUX-1MT` |
| 1.5 | `PA-PUX-1,5MT` |
| 2.0 | `PA-PUX-2MT` |
| 2.5 / 3.0 | `PA-PUX-3MT` |
| 3.5 / 4.0 | `PA-PUX-4MT` |
| 4.5 / 5.0 | `PA-PUX-5MT` |

**PULA o acessório** quando:
- `puxTipo = CAVA`
- `puxTam = vazio`
- `puxTam = "CLIENTE"` ou `"ENVIO PELO CLIENTE"`
- Mod 23 Molduras vem default CLIENTE → não adiciona

### 5. PIVÔ — sempre

```
PA-CHA AA PHS 4,8X50  →  12 × nFolhas un
PA-BUCHA 06           →  12 × nFolhas un
```

### 7. FITA ESCOVINHA Q-LON (na verdade obra, mas Felipe colocou aqui)

```
PA006 → mFita = ceil((L/1000) × 2)  metros
PA007 → mFita = ceil((L/1000) × 4)  metros

Código: PA-FITA VED 5X20
```

### 8. Q-LON VEDAÇÃO

```
mQL = ceil((H/1000) × 2)

PA-QL 48800 → mQL metros (Flipper Seal)
PA-QL 48700 → mQL metros
```

### 9. ISOLAMENTO — LÃ DE ROCHA

```
m2_porta = (L/1000) × (H/1000) × 2     ← 2 camadas
m2_fixo  = Σ (Lf × Af × lados) por fixo

Total: m2_porta + m2_fixo  (arredondado para inteiro)

Código: PA-LADEROCHA
```

### 10. EPS PLACA 50mm (embalagem)

```
m2_porta = (L/1000) × (H/1000) × 2
m2_fixo  = Σ (Lf × Af × 2) por fixo

Código: PA-ISOPOR PRANC 50
```

### 11. EPS CANALETA U (depende do sistema + ripado)

```
mIsoPorta = ceil((H/1000) × 4 + (L/1000) × 3)
mFixoIso  = Σ ceil(Lf × 2 + Af × 2)
mIso      = mIsoPorta + mFixoIso

Modelo NORMAL (não ripado):
  PA006 → PA-ISOPOR 115  (115×50)
  PA007 → PA-ISOPOR 125  (125×50)

Modelo RIPADO:
  PA006 → PA-ISOPOR 135
  PA007 → PA-ISOPOR 165
```

### VEDA PORTA (sessão 2026-08, Felipe detalhou)

```
medida_calculada = L − fglD − fglE − 171.7 − 171.5 + 110 + 110

Veda porta vem em sequência: 820, 920, 1020, 1120, 1220, 1320, 1420, ...
(incrementos de 100mm, sempre terminando em 20)

Pegar o PRÓXIMO ARREDONDADO PARA CIMA.
Exemplo: deu 1680 → veda porta 1720

Quantidade:
  nFolhas = 1 → 2 unidades
  nFolhas = 2 → 4 unidades

Código exemplo: PA-VED1720 (varia conforme medida)
```

---

## OBRA

### 14. FECHO UNHA + PUSH&GO — só 2 folhas

```
nFolhas = 2 e H > 4000mm:
  1× PA-FECHUNHA
  1× PA-PUSHGO

nFolhas = 2 e H ≤ 4000mm:
  2× PA-FECHUNHA
```

### 15. PORTAL — Bucha + Parafuso

```
qtyBucha8 = ceil(H/300) × 2     ← × 2 lados (esq + dir)

PA-BUCHA 08      → qtyBucha8
PA-PAR SOB M6X65 → qtyBucha8
```

### 16. CONTRA TESTA + CAIXETA — se tem fechadura

```
PA-KESO CRT 4P RT CR → 1 × nFolhas
PA-KESO CXT 4P       → 1 × nFolhas

Auxiliares (depende dos PINOS):
  04 PINOS → 0 aux
  08 PINOS → 1 aux
  12 PINOS → 2 aux
  16 PINOS → 3 aux
  24 PINOS → 4 aux

  PA-KESO CRT AUX CR → qtyAux × nFolhas
  PA-KESO CXT AUX    → qtyAux × nFolhas

Parafusos contra testa:
  PA-CHAAA PHS 35X20 → (1 × nFolhas + qtyAux) × 4
```

### 17. SELANTES OBRA

```
PA-PRIMER → 1 un (sempre)

PA-ESPUMA EXP GUN:
  H > 4000mm → 2 latas
  H ≤ 4000mm → 1 lata

PA-HIGHTACK BR:
  H ≤ 3000mm  → 2 un
  H ≤ 5000mm  → 3 un
  H > 5000mm  → 4 un
```

### 18. FECHADURAS DIGITAIS — fixo por marca

**TEDEE** (4 itens, 1 cada):
- `PA-TEDEE-BRIDGE` — Bridge TBV1.0
- `PA-TEDEE-FEC-PT` — Lock PRO Homekit
- `PA-TEDEE-TEC-PT` — Keypad PRO biométrico
- `PA-PILHA-AAA-4X` — Pilhas AAA

**EMTECO** (1 item):
- `PA-DIG EMTECO BAR II` — Barcelona II WiFi

**PHILIPS** (todos os PA-9300* + PA-DIG PH*):
- Pega TUDO do catálogo com 9300 no código (8 acessórios + kit)

**NUKI** (4 itens, 1 cada):
- `PA-NUKI-BRI` — Bridge WiFi
- `PA-NUKI-FEC-BL` — Smartlock Preto
- `PA-NUKI-TEC-BL` — Keypad PRO Preto
- `PA-NUKIBATERIA` — Bateria

---

## STATUS DE IMPLEMENTAÇÃO

Todas as regras acima estão **DOCUMENTADAS** mas **NÃO IMPLEMENTADAS**
ainda na função `renderLevAcessoriosTab` em `scripts/12-orcamento.js`.

Felipe disse na sessão 2026-08:
> "VERIFIQUE UNICA COISA QUE QUERO POR ENQUANTO E QUANDO APROVAR
> VALOR NO DRE MOVIMENTE CARD DE FAZER ORCAMENTO PARA ORCAMENTO FEITO"

Então a prioridade foi outra. Quando Felipe der OK, implementar
todas as regras acima na ordem que ele preferir.
