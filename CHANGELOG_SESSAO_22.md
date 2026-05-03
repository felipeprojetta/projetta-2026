# SESSÃO 22 — 2026-05-02

## Escopo

Duas correções pequenas e isoladas em Lev. Acessórios da Porta Externa,
ambas pedidas pelo Felipe na sessão "projeto final 05".

---

## 1. Bug "970" no Veda Porta — display incorreto do corte do perfil

### Descrição
A observação da linha do Veda Porta no Lev. Acessórios mostrava o tamanho
do corte do perfil PA-PA006V/PA007V como `medida_padrao - 50`. Esse
cálculo gerava valores como **970mm** (1020 − 50) que **não existem na
sequência de produtos** (820, 920, 1020, 1120, 1220...) **nem na régua
de cortes do perfil**.

### Causa raiz
Heurística errada em `28-acessorios-porta-externa.js` linha 339:
```js
add(codVeda, qtdVeda, 'Vedacoes', 'fab',
    `${medida}mm × ${qtdVeda} un (folha PA-PA: ${medida - 50}mm)`);
```

O `−50` foi colocado como aproximação, mas o tamanho REAL do corte do
perfil PA-PA006V/PA007V segue a fórmula passada pelo Felipe:

```
LARG_INT_FOLHA + 110 + 110
```

onde:
- 1 folha:  `LARG_INT_FOLHA = L − FGLD − FGLE − 171.7 − 171.5`
- 2 folhas: `LARG_INT_FOLHA = (L − FGLD − FGLE − 171.7 − 171.5 − 235) / 2`

### Correção
Recalcula `LARG_INT_FOLHA` localmente e mostra `LARG_INT_FOLHA + 110 + 110`
arredondado para mm inteiro. O `medida` (snap pra X20: 820, 920, 1020...)
continua sendo o **acessório** comprado, mas a observação agora mostra o
**corte do perfil** correto.

### Exemplo (porta L=1500, 1 folha)
- LARG_INT_FOLHA = 1500 − 10 − 10 − 171.7 − 171.5 = 1136.8
- Corte PA-PA006V = 1136.8 + 220 = **1356.8 → 1357mm**
- Veda acessório (snap X20) = ceil((1356.8 − 20)/100)×100 + 20 = **1420mm**

Antes: "folha PA-PA: 1370mm" (1420 − 50, errado, valor não existe)
Agora: "corte PA-PA006V: 1357mm" (real)

### Arquivo
`scripts/28-acessorios-porta-externa.js` — único bloco do Veda Porta
(linhas ~328-348). Não toca em outras lógicas.

---

## 2. Pivô 350 vs 600 kg — escolha automática pelo peso da folha

### Descrição
O motor de acessórios sempre adicionava `PA-PIVOT 350 KG` fixo. Felipe
pediu para escolher dinamicamente:
- Folha ≤ 350 kg → PA-PIVOT 350 KG
- Folha > 350 kg → PA-PIVOT 600 KG

Onde "peso da folha" = peso líquido perfis FOLHA + peso líquido chapas
FOLHA (sem portal, sem fixo).

### Implementação

**A) Helper isolado em `12-orcamento.js`**

Nova função `calcularPesoFolhaItem(item, perfisCadastro)` logo abaixo de
`ehLinhaPortal`. Retorna `{ peso, detalhe: { perfis, chapas } }`.

Estratégia:
- **Perfis**: roda `motorPerfisPorTipo(item.tipo).gerarCortes(item)` e
  soma `(comp/1000) × kgM × qty` para cortes que NÃO são do PORTAL
  (filtro via `ehLinhaPortal` já existente — não duplica lógica).
- **Chapas**: usa `ChapasPortaExterna.gerarPecasChapa(item, lado)` pros
  2 lados, soma área das peças categoria !== 'portal' × kg/m². Se não
  achar kg/m² no cadastro de superfícies, usa fallback de 8 kg/m²
  (ACM 4mm padrão).

Não modifica nenhum motor existente — só consome as APIs públicas deles.

**B) Nova param `opts.pesoFolhaTotal` em `calcularAcessoriosPorItem`**

Em `28-acessorios-porta-externa.js`, o bloco do PIVO conjunto agora lê
`opts.pesoFolhaTotal`:
- > 350 kg → PA-PIVOT 600 KG
- ≤ 350 kg (e > 0) → PA-PIVOT 350 KG
- 0 ou ausente → PA-PIVOT 350 KG (default conservador, mantém compat)

Observação no acessório mostra o peso usado na decisão:
```
conjunto sup/inf 600kg (folha 480.5kg > 350kg)
```

**C) 2 chamadas atualizadas em `12-orcamento.js`**

1. Linha ~3866 (auto-popular `total_acessorios` no DRE) — passa peso.
2. Linha ~10086 (render do Lev. Acessórios) — carrega cadastro de
   perfis UMA vez fora do loop, passa peso por item.

Ambas em try/catch para não quebrar a renderização se o cálculo de peso
falhar (degrada pra 350 KG default).

### Pontos de atenção
- O cadastro tem `PA-PIVOT 350 KG` e `PA-PIVOT 600 KG` (NEOMEC, 532 e 0).
  Felipe mencionou "650 kg", mas o código no SEED é 600. Se for 650,
  basta atualizar o cadastro/seed — o código procura `PA-PIVOT 600 KG`.
- O fallback de 8 kg/m² para chapa pode subestimar HPL/MDF — quando
  Felipe definir kg/m² no cadastro de superfícies, o cálculo fica
  preciso automaticamente.
- ORDEM_PORTAL atual: ['ALTURA PORTAL', 'LARGURA PORTAL', 'TRAVESSA
  PORTAL']. Cortes do FIXO entram no peso da folha (não tem ordem
  estável), o que é OK porque fixo é raro em porta_externa pivotante.

### Arquivos modificados
- `scripts/28-acessorios-porta-externa.js` — bloco do PIVO conjunto.
- `scripts/12-orcamento.js` — adiciona helper, atualiza 2 chamadas.

---

## Smoke tests (todos passaram)

| Cenário                | Peso  | Pivô esperado    | Resultado |
|------------------------|-------|------------------|-----------|
| Sem peso (compat)      | —     | PA-PIVOT 350 KG  | ✅        |
| Porta leve             | 250kg | PA-PIVOT 350 KG  | ✅        |
| Limite (igual a 350)   | 350kg | PA-PIVOT 350 KG  | ✅        |
| 1 acima do limite      | 351kg | PA-PIVOT 600 KG  | ✅        |
| Porta pesada 2F        | 480kg | PA-PIVOT 600 KG  | ✅        |
| VEDA: L=1500, 1F       | —     | corte 1357mm     | ✅        |

Sintaxe validada com `node -c` em todos os 32 scripts (zero erros).

---

## Como reverter

Para reverter as 2 correções:

1. **Veda 970**: em `scripts/28-acessorios-porta-externa.js`, voltar
   o bloco do Veda Porta para a versão antiga com `${medida - 50}mm`.

2. **Pivot dinâmico**:
   - Em `scripts/28-acessorios-porta-externa.js`, voltar o bloco do
     PIVO conjunto para `add('PA-PIVOT 350 KG', 1, ...)` fixo.
   - Em `scripts/12-orcamento.js`, remover `calcularPesoFolhaItem` e
     reverter as 2 chamadas para `calcularAcessoriosPorItem(item, cadAcess)`
     (sem o 3º argumento de opts).

Mudanças isoladas — não há dependência de migração de dados nem de
storage. Reverter é só editar 2 arquivos.
