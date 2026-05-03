# CHANGELOG — Sessão 28 (parte 2)

## Bugs corrigidos nesta entrega

### Fix CRÍTICO 1 — Edição manual de Qtd em Perfis não atualizava NADA

**Causa raiz:** No fix anterior eu escrevi `window.store.get(...)` mas
o `store` é uma variável **LOCAL** do IIFE (linha 27 do arquivo:
`const store = Storage.scope('orcamentos')`), NÃO está em `window`.
Resultado: `window.store` era `undefined`, caía no fallback `{}`,
overrides nunca eram aplicados, recálculo não fazia efeito.

**Correção:**
- `12-orcamento.js` linha 5223: `window.store.get(...)` → `store.get(...)`

Agora ao editar Qtd ou Tamanho:
1. Override é salvo (já funcionava)
2. `recalcularPerfisESalvarNoFab` LÊ os overrides corretamente
3. Aplica nos cortes ANTES de calcular `result`
4. Cards globais (Kg Líquido, Kg Bruto, Aprov, Total Barras, Perda) atualizam
5. Subtotais Folha/Portal/Fixo atualizam
6. Custo de Perfis no FAB é re-salvo

### Fix 2 — Excel exportado de Lev. Superfícies sem coluna Quantidade

**Causa:** O `gerarModeloXlsxSuperficies` exportava só 7 colunas
(Item, Tipo, Descricao Item, Label Peca, Largura, Altura, Rotaciona),
sem **Quantidade**. Felipe não conseguia editar/importar quantidades.

Além disso, deduplicava peças entre Externo e Interno (Map por
label+larg+alt) — perdendo o lado e a qty real de cada face.

**Correção:**
Export agora tem **9 colunas**:

| Item | Tipo | Descricao Item | Lado | Label Peca | Largura | Altura | Quantidade | Rotaciona |
|------|------|----------------|------|------------|---------|--------|------------|-----------|

Cada peça ganha **uma linha por face** (Externo/Interno), sem dedupe.
Quantidade é a `qtd` real do motor. Se Felipe editou Rotaciona ou
Quantidade no Excel anterior, esses overrides são aplicados antes
do export pra ele ver o estado atual.

**Import** aceita as novas colunas (todas opcionais para retrocompat):
- `Lado` — opcional. Se presente, override aplica só naquela face.
  Se ausente, aplica em ambas.
- `Quantidade` — opcional. Se presente, salva em `item.qtdOverrides`
  com chave `label|largura|altura[|lado]`.

Retrocompatibilidade: planilhas antigas (sem Lado/Quantidade)
continuam importando overrides de Rotaciona como antes.

**Funções novas/modificadas:**
- `aplicarQtdOverrides(pecas, item, lado)` — análoga a
  `aplicarRotacionaOverrides`, sobrescreve `qtd` da peça
- Aplicada em `agruparPecasPorCor` (fluxo principal de aproveitamento)
- Aplicada no export pra mostrar estado atualizado

### Fix 3 — PDF do Lev. Superfícies vazio ("Sem dados de aproveitamento")

**Causa raiz:** Quando o usuário dava duplo-click numa chapa pra
selecionar, o save em `versao.chapasSelecionadas[cor]` guardava só
metadados (`descricao, preco, custoTotal, numChapas, ...`) — mas
**não** salvava `opcoes[].chapas[]` com `pecasPosicionadas`.

O `renderRelChapas(versao)` lia:
```js
const opcoes = sel.opcoes || [];
const opcao = opcoes[idxEscolhido];  // undefined!
if (!opcao) return 'Sem dados de aproveitamento';
```

Por isso o PDF/relatório aparecia vazio.

**Correção (em 2 partes):**

1. **Cache global de resultados de nesting:** quando os cards são
   renderizados, cada resultado completo (`r` com `chapas[]`,
   `pecasPosicionadas[]`, etc) é guardado em
   `window.__projettaResultadosNesting[cardId]`.

2. **Save completo no duplo-click:** ao selecionar uma chapa,
   recupera o resultado do cache, extrai SO o necessário pro
   relatório (sem `pecasNaoCouberam`, sem `pecasOriginais`,
   coordenadas mínimas), e salva em
   `chapasSelecionadas[cor].opcoes[0]`:
   ```js
   {
     chapaMae: {descricao, largura, altura, preco, peso_kg_m2},
     taxaAproveitamento, custoTotal, numChapas,
     chapas: [{
       taxa,
       pecasPosicionadas: [{peca:{label}, larg, alt}],
       sobrasRetangulos: [{w, h}]
     }]
   }
   ```

3. **Fallback para chapas selecionadas ANTES deste fix:**
   `renderRelChapas` agora detecta quando `opcoes[]` está vazio
   mas tem metadados em `sel.descricao/numChapas/custoTotal`.
   Monta uma "opção mínima" e mostra um aviso:
   > ⚠ Disposição das peças não foi salva nesta seleção. Para ver
   > custo unitário, área usada e a disposição em cada chapa,
   > volte na aba Lev. Superfícies e dê **duplo-clique** no card
   > da chapa novamente.

   Assim a seleção antiga ainda mostra Custo Total e número de
   chapas, sem quebrar.

---

## ⚠️ Pendências reportadas mas NÃO IMPLEMENTADAS nesta entrega

Os seguintes itens precisam investigação cuidadosa e mudanças em
módulos que afetam o cálculo central — vou tratar na próxima
sessão pra não quebrar nada agora:

### Pendente A — Lev. Acessórios: pivô deve mostrar peso total (perfis + chapas) e dobrar pra 2 folhas

> "PIVO NAO ESTA MOSTRANDO CALCULO ( DEVE FICAR NA LINHA DELE
> SOMATORIA PESO LIQUIDO PERFIS, PESO LIQUIDO DAS CHAPAS )
> QUANDO SAO 2 FOLHAS OBVIO QUE SAO 2 PIVOS ESTA SENDO SOMENTE 1"

Tarefa:
1. Na linha do PIVO em Lev. Acessórios, mostrar a fórmula:
   `peso_perfis_folha + peso_chapas_folha = peso_total_folha`
2. Quando `nFolhas === 2`, dobrar a quantidade do pivô (2 unidades, uma por folha)

Status: o `calcularPesoFolhaItem` já existe (linha 5134 do
12-orcamento.js) e SOMA perfis+chapas. Falta:
- Mostrar a decomposição na linha do pivô
- Multiplicar `qtd` do pivô por `nFolhas`

### Pendente B — Lev. Acessórios é multi-item?

> "NOS ACESSORIOS ESTA MULTI ITEM? SE COLOCAR 10 PORTAS IRA
> MULTIPLICAR POR 10? SE FOR ITENS DIFERENTES OU PORTA COM
> TAMANHOS DIFERENTES IRA CALCULAR SEPARADAMENTE E SOMAR TUDO?
> PARA ME DAR CUSTO TOTAL?"

Precisa investigação: rodar Lev. Acessórios com:
- 1 item, quantidade 10 → ver se multiplica
- 3 itens diferentes → ver se calcula separado e soma

Se NÃO multiplica corretamente, corrigir.

### Pendente C — Custo de Fabricação: coluna por item

> "QUANDO TENHO MULTI ITENS COLOQUE AO LADO Custo de Fabricação
> OUTRA COLUNA POIS CADA ITEM TEM SEU TEMPO E DEPOIS SOMA TODAS
> AS HORAS"

Atualmente: tabela tem 1 coluna "Horas (editável)" — soma de TODOS
os itens junta.

Esperado: 1 coluna por item + coluna Total. Cada item tem suas
próprias horas editáveis. Total = soma horizontal × n_operários.

Tarefa: rebuild da tabela em `calcFabSection` ou similar.

---

## Arquivos modificados (parte 2)

| Arquivo | Mudança |
|---------|---------|
| `scripts/12-orcamento.js` | window.store → store; export Excel +Lado +Quantidade; aplicarQtdOverrides; cache de nesting; save completo de chapasSelecionadas; fallback no relatório |

## Compatibilidade

- ✅ Planilhas Excel exportadas anteriormente (sem Lado/Quantidade)
  ainda importam OK (colunas Lado/Quantidade são opcionais)
- ✅ Chapas selecionadas antes deste fix mostram Custo Total e
  numChapas no relatório (com aviso pra re-selecionar pra disposição)
- ✅ Override de Rotaciona continua funcionando como antes
- ✅ Nada de motor/cálculo de chapas/perfis foi alterado
