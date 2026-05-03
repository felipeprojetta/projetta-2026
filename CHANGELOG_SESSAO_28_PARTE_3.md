# CHANGELOG — Sessão 28 (parte 3)

## Resumo

Felipe pediu 3 coisas, todas implementadas:
1. ✅ MODELO 22 no ar (1F e 2F)
2. ✅ Custo de Fabricação com 1 coluna por item
3. ✅ Confirmação que Lev. Acessórios já é multi-item (era — só faltava deixar evidente)

---

## 1. MODELO 22 — Adicionado ao motor de chapas

**Arquivo:** `scripts/38-chapas-porta-externa.js`

Fórmulas extraídas literalmente da aba **MODELO 22** da planilha
`PRECIFICAÇÃO_01_04_2026.xlsx` que Felipe enviou.

### Diferenças vs Modelo 02 (similar — também com friso vertical)

**1F:**
- **CAVA largura**: `tamCava + 360`
  (planilha: `(50+48+34+48+C8+48+34+48+50)`)
  vs Modelo 02: `tamCava + 116` (planilha 02: `C8+23+23+35+35`)
- **NÃO TEM "L da Cava"** — Modelo 02 tem, Modelo 22 não
- **TAMPA_MAIOR_CAVA largura**: `(larguraQuadro1F - dBC - 34 - tamCava - 34 - dBFV*qtdFrisos - eF*qtdFrisos) + 2*REF - 1`
  (planilha 22: `E3-C7-34-C8-34-C20*C22-C21*C22+C15+C15-1`)
  vs Modelo 02: usa `-1` em vez de `-34` nas margens
- **TAMPA_BORDA_CAVA**, **TAMPA_BORDA_FRISO_VERTICAL**, **FRISO**: idênticos ao Modelo 02

**2F:**
- **CAVA**: igual 1F, qty=4
- **NÃO TEM "Tampa da Cava"** — Modelo 02 tem
- **TAMPA_MAIOR 01/02/03**: usam base nova:
  ```
  base22 = (larguraQuadro2F - dBC*2 - tamCava*2 - 34*4) / 2
  TM01 = base22 + 10 + 2*REF - 1 - dBFV*qtdFrisos - eF*qtdFrisos  (ext=1, int=0)
  TM02 = base22 - 28 + 2*REF - 1 - dBFV*qtdFrisos - eF*qtdFrisos  (ext=1, int=1)
  TM03 = base22 - 28 - 38 + 2*REF - 1 - dBFV*qtdFrisos - eF*qtdFrisos  (ext=0, int=1)
  ```
- **TAMPA_MENOR**: igual TAMPA_BORDA_CAVA do 1F, qty=4
- **TAMPA_BORDA_FRISO_VERTICAL**, **FRISO**: qty = qtdFrisos×2 (em vez de qtdFrisos)

### Universais (BAT, ACAB, U_PORTAL, etc)
Já vêm de `pecasUniversais()` — não precisei tocar. Igual aos outros modelos.

### Como o motor 38-chapas-porta-externa.js chama
A entrada na `TABELA[22]` é detectada automaticamente quando o item tem
`modeloExterno=22` ou `modeloInterno=22` ou `modeloNumero=22`. Não precisa
mudar mais nada — `MODELOS_COM_FRISO_VERTICAL` em `31-perfis-porta-externa.js`
já incluía `22` na lista (sessão 25).

---

## 2. Custo de Fabricação — Coluna por item

**Arquivos:** `scripts/12-orcamento.js`, `styles/13-orcamento.css`

### Antes
Tabela com 1 coluna "Horas (editável)" — valor único agregado pra TODOS os itens.

### Agora
Tabela com **N colunas** (1 por item Porta Externa) + coluna **Total** quando há 2+ itens.

| Etapa | Calculado | It 1 (1500×3000) | It 2 (2000×4500) | It 3 (1800×5000) | **Total** |
|-------|-----------|------------------|------------------|------------------|-----------|
| Portal | — | [9] | [12] | [10] | 31 |
| Folha da porta | — | [18] | [24] | [22] | 64 |
| Colagem | — | [36] | [40] | [38] | 114 |
| ... | ... | ... | ... | ... | ... |
| **Total de horas** | soma × N op. | **63** | **76** | **70** | **209 h** |

Cada célula é editável. O total horizontal por etapa e o total vertical por
item são calculados automaticamente.

### Estrutura de dados

Mantém retrocompatibilidade. A `etapas[id]` agora pode ter:
- `etapas[id].horasPorItem = { '0': 9, '1': 12, '2': 10 }` — novo, por idx
- `etapas[id].horasOverride = N` — antigo, valor global (compat)
- `etapas[id].dias = N` — original (compat)

### Lógica em `calcularFab`

Pra cada etapa:
1. Se `horasPorItem` tem alguma chave preenchida → soma horizontal de horasPorItem (ignora `horasOverride` global)
2. Senão se `horasOverride` preenchido → usa esse valor (comportamento antigo)
3. Senão → usa o calculado automático pelas regras

### Migração suave

Se um orçamento ANTIGO tem `horasOverride=30` e o user abrir agora com 3 itens:
- Coluna "Item 1" mostra `30` (valor migrado)
- Colunas "Item 2" e "Item 3" mostram vazio
- Total = 30 (= o que era antes)

Quando o user edita qualquer célula, `horasOverride` global é apagado e
passa a usar `horasPorItem`. Sem perda de dados.

### Handler novo

Em `data-fab-sub="horas-item"`:
- `data-item-idx="N"` indica qual item
- Aceita expressões (ex: `9+5` → `14`)
- Vazio = remove a entrada

---

## 3. Lev. Acessórios — JÁ É MULTI-ITEM

**Resposta direta às perguntas do Felipe:**

> "ESTA MULTI ITEM?"

✅ **SIM**. `itens.map((item, idx) => ...)` itera cada item e gera
um bloco independente.

> "SE COLOCAR 10 PORTAS IRA MULTIPLICAR POR 10?"

✅ **SIM**. `28-acessorios-porta-externa.js` linha 193:
```js
const qtdTotal = qtdUnit * qtdPortas;  // qtdPortas = item.quantidade
```

Cada acessório calculado é multiplicado por `item.quantidade` antes de sair.

> "SE FOR ITENS DIFERENTES OU PORTA COM TAMANHOS DIFERENTES IRA CALCULAR
> SEPARADAMENTE E SOMAR TUDO?"

✅ **SIM**. Cada item tem seu próprio bloco com tabelas Fab/Obra próprias
e Total deste Item. No fim, **Total Geral** soma TODOS.

### O que mudei agora
Apenas a UX — banner inicial do Lev. Acessórios deixa essa lógica
**explícita** (antes não dizia que multiplica por qtd):

> **Levantamento de Acessórios — Multi-Item**
> 3 tipo(s) de Porta Externa nesta versão, totalizando 25 unidade(s).
> Cada item tem sua própria lista de acessórios, e a quantidade de cada
> acessório é **multiplicada pela qtd do item** (ex: 10 portas iguais → x10).
> O Total Geral no fim soma TUDO.

E o "Total Geral" agora mostra também o número de itens e unidades.

Nenhuma lógica de cálculo foi tocada — era pra ter sido validação.

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `scripts/38-chapas-porta-externa.js` | +TABELA[22] com 1F e 2F |
| `scripts/12-orcamento.js` | calcularFab suporta horasPorItem; UI da tabela com 1 coluna por item; handler save horas-item; banner Lev. Acessórios mais explícito |
| `styles/13-orcamento.css` | CSS .orc-fi-col-item-h, .orc-fi-col-total-h; .orc-fi-etapas com width auto |

## Compatibilidade

- ✅ Orçamentos antigos com `horasOverride` global continuam mostrando o
  valor — aparece na coluna do Item 1 até o user editar
- ✅ Orçamentos com 1 item: tabela mostra só 1 coluna (sem coluna Total),
  igual antes
- ✅ Modelo 22 só vira ativo se item tem `modeloNumero=22` ou
  `modeloExterno=22` — outros modelos não são afetados
- ✅ Lev. Acessórios mantém todas as fórmulas existentes intactas
