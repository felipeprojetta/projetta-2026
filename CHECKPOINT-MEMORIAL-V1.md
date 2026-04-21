# 🎯 CHECKPOINT — Memorial de Revisões v1.0 (Estável)

**Data:** 21/04/2026  
**Commit:** `109a210`  
**Tag:** `v1.0-memorial-estavel`  
**Branch de backup:** `backup-memorial-estavel`

---

## ✅ Estado funcional confirmado

Testado ao vivo no browser do Felipe via Chrome MCP no card **Luis Eduardo** (id `cmo8jv2299v3v`).

### Opção "Original" (sem `memorialV2Id` nem `freezeKey`)

- Duplo-clique → `crmFazerOrcamento` + `_aplicarParamsFinanceiros` da rev
- Banner laranja-roxo: `📋 Visualizando Original`
- Todas as abas preenchidas: **Orçamento, Perfis, Acessórios, Chapas**
- Valores: **R$ 48.501,14 tabela** / **R$ 41.225,97 faturamento**
- Medidas: **1100×2300, Modelo 01**
- Tabs: **Chapa 1 (92%)**, **Chapa 2 (83%)** — navegáveis

### Opção "Revisão 1" (com `memorialV2Id`)

- Duplo-clique → `MemorialV2.abrir` via Supabase
- Banner amarelo: `🔒 MEMORIAL — Somente leitura`
- Todas as abas preenchidas **INCLUINDO Levantamento de Superfícies** (9914 chars de conteúdo + 2 tabelas)
- Valores: **R$ 48.917,59 tabela** / **R$ 41.579,95 faturamento**
- Tabs: **Chapa 1 (88%)**, **Chapa 2 (77%)** — navegáveis

---

## 📋 Commits que formam o checkpoint

| Hash | Descrição |
|---|---|
| `109a210` | onRepChange lê comissão+cargo direto do localStorage |
| `b83b77a` | Reconstruir revisão antiga via paramsFinanceiros + MemorialV2 re-roda planificador |
| `5e98fe3` | Busca nos dropdowns de Cor |
| `f8add81` | Data Fechamento só visível em Fechado Ganho |
| `e831d6b` | OrcamentoFreeze re-roda planificador |
| `32e4364` | Ganho Mês + Ganho Ano fixos |
| `95aa983` | Filtro "Por qual data" + data/hora do orçamento |
| `b9e393e` | Auto-migrar `scope=internacional` |
| `a3b319f` | Pipeline R$0 + detecção intl robusta |
| `caa7db0` | Filtro de período (mês fiscal 16→15) |
| `ebd28cf` | Persistir inst+logística no card |
| `3df1649` | Editar data fechamento em cards Ganho |
| `17dda34` | Breakdown internacional no card kanban |

---

## 🔄 Como restaurar se algo quebrar

### Opção 1 — Navegar e inspecionar sem mexer no main

```bash
git checkout v1.0-memorial-estavel   # modo detached HEAD
# inspeciona, testa
git checkout main                     # volta pra branch atual
```

### Opção 2 — Reverter totalmente o main pra este ponto

```bash
git checkout main
git reset --hard v1.0-memorial-estavel
git push origin main --force          # ⚠ APAGA commits após o checkpoint
```

### Opção 3 — Restaurar via branch de backup (mais seguro)

```bash
git checkout backup-memorial-estavel  # branch congelada com estado funcional
git checkout -b fix-rollback          # cria branch nova a partir daí
# trabalha na fix-rollback e merge/PR normal
```

### Opção 4 — Via GitHub UI

1. Ir em `https://github.com/felipeprojetta/projetta-2026/tree/v1.0-memorial-estavel`
2. Clicar "Browse files" pra ver o código exato deste checkpoint
3. Comparar com `main`: `https://github.com/felipeprojetta/projetta-2026/compare/v1.0-memorial-estavel...main`

---

## 📁 Arquivos críticos deste checkpoint

Estes são os arquivos que **não podem ser quebrados** sem invalidar o fluxo de memorial:

- `js/10-crm.js` — `crmAbrirRevisao`, `_crmAbrirRevisaoLegacy` (fallback esperto), `_mostrarBannerRevisao`
- `js/28-memorial-v2.js` — `MemorialV2.abrir` passo 8B (re-rodar `_autoSelectAndRun`)
- `js/30-orcamento-freeze.js` — `_restaurarTudo` passo 8A (re-rodar `_autoSelectAndRun`)
- `js/14-reps_sync.js` — `onRepChange` lê localStorage direto
- `js/03-history_save.js` — captura 19 campos inst+logística no card
- `index.html` — grid de 8 KPIs, toolbar com 2 filtros

---

## ⚠ Próximos trabalhos (após este checkpoint)

**NÃO esquecer:**

- Omie API integration (APP_KEY disponível)
- Weiku reservation detail extraction (~3396 records)
- PDF/PNG de todas as abas no "Gerar PDF" roxo
- Modelo 06 frisos horizontais
- Fixo ACM regression (estrutura+revestimento 2 lados)
- 154 itens sem preço (KESO)
- Revisitar preço de instalação (gap R$ 550 × R$ 1.848)

**Cada um desses trabalhos deve ser feito em branch separada OU pequenos commits incrementais testados individualmente.**
Se quebrar o memorial: `git reset --hard v1.0-memorial-estavel`.
