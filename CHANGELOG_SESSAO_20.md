# PROJETO 20 — Cadastro de acessórios do PDF acess.pdf

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | Lançar todos os 17 acessórios do PDF acess.pdf | ✅ | 25-acessorios.js |

---

## Item 1 — Cadastro dos acessórios

**Pedido textual:** *"LANCE TODOS OS ACESSORIOS QUE TE ENCAMINHEI AI
COMECO A TE DAR AS REGRAS DE QUANTIDADE PARA CADA"*

PDF anexado (`acess.pdf`) listava 17 acessórios divididos em 2
aplicações (Fabricação + Obra) com códigos, descrições e preços.

### Inventário

Antes de cadastrar, inventariei o SEED:
- **14 itens** já existiam (mas com `preco: 0`)
- **3 itens** faltavam (PA-LADEROCHA, PA-DOWSIL 995, PA-ISOPOR PRANC 50)

### Atualizações de preço (14 itens)

| Código | Família | Preço |
|---|---|---|
| PA-PIVOT 350 KG | Pivô | R$ 532,00 |
| PA-KESO12P+2ACM RL B | (sem família) | R$ 863,94 |
| PA-KESO ROS RD BL | Rosetas | R$ 15,26 |
| PA-KESOCIL150 BT CF | Cilindros | R$ 859,63 |
| PA-CHA AA PHS 4,8X50 | Parafusos | R$ 0,24 |
| PA-BUCHA 06 | Buchas | R$ 0,18 |
| PA-VED1220 | Veda Porta | R$ 448,44 |
| PA-QL 48800 | Vedações | R$ 7,58 |
| PA-QL 48700 | Vedações | R$ 6,99 |
| PA-ISOPOR 125 | Embalagem | R$ 7,01 |
| PA-FITDF 19X20X1.0 | Fitas Adesivas | R$ 27,37 |
| PA-FITDF 12X20X1.0 | Fitas Adesivas | R$ 17,59 |
| PA-KESO CRT 4P RT CR | Contra Testa | R$ 36,61 |
| PA-KESO CXT 4P | Caixetas | R$ 35,09 |

### Novos acessórios (3 itens)

| Código | Fornecedor | Descrição | Família | Preço |
|---|---|---|---|---|
| PA-LADEROCHA | MERCADO | LA DE ROCHA D32 | Isolante termico | R$ 9,41 |
| PA-DOWSIL 995 | DOWSIL | DOWSIL 995 PRETO SACHE 591ML | Selantes > Silicones > Quimicos | R$ 73,90 |
| PA-ISOPOR PRANC 50 | STYRO | EPS PLACA 50MM | Embalagem | R$ 9,01 |

**Notas sobre os novos:**
- **PA-LADEROCHA**: fornecedor genérico "MERCADO" — Felipe pode editar
  pra colocar o fornecedor real depois.
- **PA-DOWSIL 995**: já existia no SEED como `PA-DOWSIL 995 ESTR SH`
  (mesma descrição "DOWSIL 995 PRETO SACHE 591ML") mas o PDF usava
  o código curto. Adicionei o código curto pra bater 100% com o que
  Felipe usa no faturamento. **Atenção:** existem agora os 2 códigos
  no sistema (variante longa e curta) — Felipe pode deletar a versão
  longa se preferir.
- **PA-ISOPOR PRANC 50**: novo, não tinha equivalente no SEED.

### Total no SEED

```
Antes:  312 acessórios
Depois: 315 acessórios (+3 novos)
```

### Migração automática

Adicionada migração `migracao_precos_acess_pdf_v1` no `load()`:

```js
function migrarPrecosAcessPdf() {
  if (store.get('migracao_precos_acess_pdf_v1')) return;
  // 1. Atualiza preço dos 14 existentes (só se preco_atual === 0,
  //    preserva edições manuais do usuário)
  // 2. Adiciona os 3 novos se ainda não existem
  // ...
  store.set('migracao_precos_acess_pdf_v1', true);  // 1x apenas
}
```

**Comportamento:**
- Se Felipe **não tinha mexido** nos preços → vai receber os 14 preços do PDF
- Se Felipe **já editou** algum preço (preco_atual > 0) → preserva a edição dele
- Os 3 novos acessórios são adicionados ao storage
- Roda **1x por usuário** (idempotente)

Console mostra:
```
[Acessorios] Migracao acess.pdf: 14 preco(s) atualizado(s), 3 novo(s) adicionado(s)
```

---

## Próximos passos (sessão 21+)

Felipe disse: *"AI COMECO A TE DAR AS REGRAS DE QUANTIDADE PARA CADA"*

Significa que pra cada acessório acima, Felipe vai me dizer **quando**
ele entra no orçamento e **quantos** entram. Pelo PDF é possível ver
algumas regras já implícitas (mas Felipe vai detalhar):

### Regras visíveis no PDF (a serem confirmadas)

| Acessório | Regra de quantidade |
|---|---|
| PA-PIVOT 350 KG | 1 por porta pivotante |
| PA-KESO12P+2ACM RL B | 1 fechadura por porta |
| PA-KESO ROS RD BL | 2 rosetas por porta (uma de cada lado) |
| PA-KESOCIL150 BT CF | 1 cilindro por porta |
| PA-CHA AA PHS 4,8X50 | 12 parafusos pra fixar pivô |
| PA-BUCHA 06 | 12 buchas (mesmo número dos parafusos) |
| PA-VED1220 | 2 veda-porta (folha + outra) |
| PA-QL 48800 | H × 2 (em metros lineares, do lado externo) |
| PA-QL 48700 | H × 2 (mesma regra do 48800, lado interno) |
| PA-LADEROCHA | L × H × 2 (m² — preenche os 2 lados internos da folha) |
| PA-DOWSIL 995 | 65,2m ÷ 8m/tubo ≈ 9 tubos por porta |
| PA-ISOPOR PRANC 50 | L × H × 2 (m² — embalagem) |
| PA-ISOPOR 125 | H × 4 + L × 3 (m lineares — encanto da embalagem) |
| PA-FITDF 19X20X1.0 | 42,6m ÷ 20m/rolo = 3 rolos |
| PA-FITDF 12X20X1.0 | 15,2m ÷ 20m/rolo = 1 rolo |
| PA-KESO CRT 4P RT CR | 1 contra-testa por porta (OBRA) |
| PA-KESO CXT 4P | 1 caixeta por porta (OBRA) |

**Aguardando Felipe** confirmar essas regras e detalhar para itens
adicionais (várias famílias podem ter regras condicionais — ex:
trinco rolete vs trinco reto, etc).

## Princípios respeitados

- **Idempotente**: migração marca flag, não roda 2x.
- **Preserva edições do usuário**: só atualiza preços onde
  `preco_atual === 0`.
- **Não quebra sistema antigo**: SEED original tinha 312, agora
  tem 315 — todos códigos antigos continuam funcionando.

## Arquivos alterados

```
scripts/25-acessorios.js
  - SEED_ACESSORIOS: 14 precos atualizados + 3 novos itens (linha 28)
  - migrarPrecosAcessPdf nova (~70 linhas)
  - load() chama migrarPrecosAcessPdf depois de migrarFamiliaTedee
```

## Como reverter

1. Tirar a chamada `migrarPrecosAcessPdf()` do `load()`
2. Limpar flag `migracao_precos_acess_pdf_v1` do localStorage
3. Voltar SEED_ACESSORIOS antigo (312 itens com preços zerados)
