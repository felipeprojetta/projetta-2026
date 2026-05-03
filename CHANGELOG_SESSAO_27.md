# CHANGELOG — Sessão 27 (Acessórios: planilha com fórmulas de impostos)

## Resumo

Felipe envia planilha de acessórios com **colunas extras de impostos**
(IPI, ICM, PIS, COFINS) e fórmula de cálculo do líquido. O sistema
agora:

1. **Importa**: pega só o **preço líquido** (col E `=L`) que vai pro cadastro.
2. **Salva** os campos opcionais: `preco_bruto`, `ipi`, `icm`, `pis`, `cofins`.
3. **Exporta**: gera planilha **com as fórmulas preservadas**, pra Felipe
   atualizar alíquotas no Excel e re-importar.

Estrutura da planilha (igual à que Felipe enviou):

| Col | Header | Conteúdo |
|-----|--------|----------|
| A | Codigo | id do acessório |
| B | Fornecedor | |
| C | Descricao | |
| D | Familia | |
| **E** | **Preco (R$)** | **`=L{n}`** (líquido — vai pro cadastro) |
| F | (sem header) | preço **bruto** (input do Felipe) |
| G | IPI | % (formato 0.00%) |
| H | ICM | % |
| I | PIS | % |
| J | COFINS | % |
| K | (vazio) | |
| **L** | (sem header) | **`=F − (F×H) − (F − (F×H))×(I+J)`** (líquido calculado) |
| M | (vazio) | |
| N | (sem header) | `=IF(L=0, 0, 1−(L/F))` (% desconto efetivo, informativo) |

## Fluxo de uso

1. Felipe **exporta** o cadastro atual → recebe planilha com fórmulas
2. Abre no Excel → atualiza preço bruto (F) e/ou alíquotas (G–J)
3. Excel recalcula automaticamente (L recalcula → E `=L` recalcula)
4. Salva e re-importa no app
5. App lê coluna E (líquido já calculado pelo Excel) → atualiza cadastro
6. App **também** salva bruto + impostos pra que o **próximo export** já
   venha com tudo preenchido (não precisa redigitar)

## Robustez

Se Felipe re-importar SEM abrir no Excel antes (cache de fórmula vazio),
o app **calcula o líquido manualmente**:
```
liquido = bruto − (bruto × ICM) − (bruto − bruto×ICM) × (PIS + COFINS)
```
Detecção: `preco === 0 && preco_bruto > 0` → calcula e salva.

## Arquivos modificados

### `scripts/04-universal.js` — adicionada função `exportXLSXAvancado`

Nova função que aceita células com **fórmulas e formatos** (R$, %).
Diferente do `exportXLSX` simples, permite:
- Células-objeto: `{ f: 'L2', t: 'n', z: '"R$ "#,##0.0000' }`
- Células com valor formatado: `{ v: 0.04, t: 'n', z: '0.00%' }`
- Larguras de coluna customizáveis

A função antiga `exportXLSX` **NÃO foi tocada** (regra Felipe — não
quebrar funcionalidades existentes). Outros módulos continuam usando.

### `scripts/25-acessorios.js` — 3 mudanças

1. **`normalize`**: agora preserva campos opcionais `preco_bruto`, `ipi`,
   `icm`, `pis`, `cofins` quando vierem preenchidos.

2. **`exportarXLSX`**: gera planilha com 14 colunas e fórmulas (em vez
   de só 5 colunas com valores). Fallback se `Universal.exportXLSXAvancado`
   não existir → usa export simples antigo (compat).

3. **`importarXLSX`**:
   - Aceita colunas extras IPI/ICM/PIS/COFINS (opcionais — se não tiver, ignora)
   - Detecta col F automaticamente como `preco_bruto` (sem header — formato Felipe)
   - Fallback: se preço veio 0 mas tem bruto, calcula líquido manualmente

## Compatibilidade preservada

✅ Planilhas antigas (5 colunas: Codigo, Fornecedor, Descricao, Familia, Preco)
   continuam importando normalmente — campos extras simplesmente ficam ausentes.

✅ Items existentes no cadastro (sem `preco_bruto`/impostos) são exportados
   com bruto = preço atual e impostos = 0% — Felipe atualiza no Excel.

✅ API pública `Universal.exportXLSX` mantida — só foi ADICIONADA a
   `exportXLSXAvancado` ao lado.

## Validação

Smoke test (`test_export_formulas.js`):
- Export gera planilha com fórmulas em E, L, N ✓
- Formatos R$ e % aplicados ✓
- Re-leitura mostra fórmulas + valores cacheados ✓

Smoke test (`test_import_felipe.js`) — usando a planilha REAL que Felipe enviou:
- 323 linhas detectadas
- Headers corretos (preco=4, ipi=6, icm=7, pis=8, cofins=9)
- Detecção automática de col F (bruto sem header)
- Fórmula bate com líquido em 5 amostras: PA-BUCHA 06, 08, 10, PA-CIL UDINE 130 BL/CR
  ```
  PA-CIL UDINE 130 BL: líquido=206.13, bruto=236.61, ICM=4%, PIS=1.65%, COFINS=7.6%
  Fórmula: 236.61 − (236.61×0.04) − (236.61 − 236.61×0.04)×(0.0165+0.076) = 206.13 ✓
  ```

## Próxima etapa (Felipe pediu): Integração API com Omie

Felipe vai querer:
- Consultar **estoque** de cada acessório no Omie
- Consultar **alíquotas por fornecedor** (Omie já tem isso pelas notas XML)
- Conferir se impostos do cadastro batem com o Omie
- Importar 100% das notas XML automaticamente

**Endpoints úteis do Omie API** (a explorar quando começarmos):
- `https://app.omie.com.br/api/v1/estoque/consulta/`
- `https://app.omie.com.br/api/v1/produtos/produto/`
- `https://app.omie.com.br/api/v1/produtos/notafiscal/`
- Auth: APP_KEY + APP_SECRET (geradas no painel Omie)

**Considerações arquiteturais:**
1. Chamadas HTTPS direto do navegador → CORS bloqueia. Soluções:
   - **Proxy via Supabase Edge Function** (recomendado — Felipe já usa Supabase)
   - Servidor Node intermediário (mais infra)
2. Cache local (localStorage) pra não consultar a cada render
3. Sync agendado (1×/dia, manual sob demanda, ou ao abrir orçamento)

Quando Felipe quiser começar, avisar pra criar a edge function.
