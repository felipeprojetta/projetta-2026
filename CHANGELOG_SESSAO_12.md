# PROJETO 12 — 6 pendências do Felipe (versionamento + fluxo)

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | **🔴 Bug**: Recalcular não funcionava | ✅ | 12-orcamento.js |
| 2 | Significado dos ícones ✓ vs ✎ + botão deletar versão | ✅ | 10-crm.js |
| 3 | Versão APROVADA bloqueia edição (igual fechada) | ✅ | 12-orcamento.js |
| 4 | Botão "+ Nova Versão" com 2 modos (em-branco / copiar) | ✅ | 12-orcamento.js |
| 5 | Memorial congelado | 🟡 Banner aviso (snapshot completo fica p/ próxima) | 12-orcamento.js |
| 6 | Seletor de versão na primeira aba (Item) | ✅ | 12-orcamento.js |

---

## Item 1 — 🔴 Bug do Recalcular

**Pedido textual:** *"botão recalcular nao funcionando"*

**Causa raiz:** `atualizarVersao` lança throw quando versão é fechada
(linha 1010: `throw new Error('atualizavao... fechada eh imutavel')`),
mas o handler do Recalcular **não tinha try/catch**. Resultado: clicar
em versão fechada → throw silenciosa → handler morria sem feedback.

```js
// ANTES — morria silenciosa
atualizarVersao(versaoAtual.id, { calculadoEm: Date.now(), calcDirty: false });

// DEPOIS — detecta antes + try/catch + feedback
if (versaoEhImutavel(versaoAtual)) {
  avisarVersaoBloqueadaECriarNova(versaoAtual, 'recalcular');
  return;
}
try {
  atualizarVersao(...);
  if (window.showSavedDialog) {
    window.showSavedDialog('Recalculado — DRE, Lev. Perfis e Custo Fab/Inst atualizados.');
  }
} catch (e) { alert('Falha ao recalcular: ' + e.message); }
```

Felipe agora vê: *"Recalculado — DRE, Lev. Perfis e Custo Fab/Inst atualizados."*

---

## Item 2 — Ícones do dropdown + botão deletar versão

**Pedido textual:** *"uma tem um v outra tem uma caneta, o que seria?
preciso de uma opção para deletar as versões"*

**Significado dos ícones (legendado agora):**
- `✓` = versão **FECHADA** (histórico imutável, salva como referência)
- `✎` = versão em **DRAFT** (em edição, pode mexer)
- `🔒` = versão **APROVADA** mas não fechada (DRE foi pro CRM, mas ainda pode ser fechada)

Tooltips adicionados no `<select>` e em cada `<option>` explicando.

**Botão deletar versão:** `🗑` aparece ao lado do dropdown quando há
2+ versões. Clicando:
1. Lista as versões disponíveis com tag (FECHADA/draft) e valor
2. Pede pra digitar o número da versão a deletar
3. Confirma com `confirm()` antes de deletar
4. Proteção: nunca deleta a última versão de um negócio

**Função `deletarVersao(versaoId)` adicionada** com proteções:
- Não deleta se for a única versão do negócio
- Se versão deletada era a ATIVA, troca pra outra automaticamente
- Persiste no Storage

---

## Item 3 — Versão APROVADA bloqueia edição

**Pedido textual:** *"ao aprovar um DRE e ir pro card valor realmente
não deve recalcular, deve avisar DRE aprovada, criar nova versão?"*

**Implementação:** Função central `versaoEhImutavel(versao)`:
```js
function versaoEhImutavel(versao) {
  if (!versao) return false;
  if (versao.status === 'fechada') return true;
  if (versao.aprovadoEm) return true;  // ← novo critério
  return false;
}
```

Agora **Recalcular** e **Zerar** verificam esse predicado **antes** de
agir. Se versão é imutável, dispara `avisarVersaoBloqueadaECriarNova`:

```
DRE aprovada — esta versão foi enviada pro CRM e já vale como contrato.

Você tentou: recalcular

Pra alterar, crie nova versão:
  1 = Em branco (mantém só largura e altura)
  2 = Copia atual (duplica tudo, edita pontual)
  Cancelar = não fazer nada
```

Visual: nova tag `APROVADA` em laranja no banner do orçamento, ao lado
do número da versão. Diferencia de FECHADA (azul) e draft (cinza).

---

## Item 4 — "+ Nova Versão" com 2 modos

**Pedido textual:** *"botão sempre de criar nova versão (mas quando
clicar nesse de opção, criar do zero onde mantém somente largura e
altura) ou copiar atual"*

**Função `criarNovaVersao(versaoBaseId, modo)`** com:

### Modo `'em-branco'`
1. Fecha versão base (vira histórico)
2. Cria nova versão na mesma opção
3. **Mantém apenas**: `tipo`, `largura`, `altura`, `quantidade`, `nFolhas`, `sistema` por item
4. **Zera**: subFab, subInst, custoFab, custoInst, parametros, chapasSelecionadas, calculadoEm

### Modo `'copiar'`
1. Fecha versão base
2. Cria nova versão duplicando 100% dos dados (já é o comportamento
   padrão de `criarVersao`)
3. Felipe pode editar pontualmente o que quiser

**Botão `+ Nova Versão` SEMPRE presente** no banner (independente de
versão estar fechada ou não), porque Felipe pediu "deixe ali um botão
sempre de criar nova versão". Clicando, dialog pergunta o modo.

---

## Item 5 — Memorial congelado (parcial)

**Pedido textual:** *"se eu clicar em versão 1 versão 2 ainda não traz
congelado todas as abas, esse é o desafio trazer o memorial de cálculo
(mas sem calcular de novo) somente trazer todas as telas como estava
no momento do DRE aprovado"*

**Investigação:** Existe campo `precos_snapshot` salvo na criação de
cada versão (linha 671: `snapshotPrecosAtual()` captura cadastros
atuais), mas **nunca é usado em lugar nenhum** dos motores de cálculo.

Os motores de Perfis, Superfícies, Acessórios sempre leem dos cadastros
ATUAIS do Storage. Resultado: se você editar o preço do alumínio depois
de aprovar V1, ao alternar pra V1 vai mostrar o **novo** preço — não o
preço da época da aprovação.

**Implementação parcial nesta sessão:**

✅ Banner Memorial aparece em versão imutável avisando que está em modo
   somente-leitura
✅ Tag visual `APROVADA` (laranja) e `FECHADA` (azul) diferentes
✅ Tooltips claros nos dropdowns

🟡 **Pendente para próxima rodada (refactor grande):**
- Snapshot completo de RESULTADOS (não só preços) no momento de fechar/aprovar
- Motores de cálculo redirecionarem leitura pro snapshot quando versão é imutável
- OU: ao renderizar versão imutável, salvar HTML pré-renderizado e restaurar

**Recomendação:** A melhor abordagem é salvar os **resultados pré-calculados** (não os preços) no objeto da versão na hora de fechar. Algo como:

```js
versao.snapshot = {
  perfis: { totalKg, custoPerfis, custoPintura, blocosPorItem: [...] },
  superficies: { porCor: { 'Wood Sucupira': { qtdChapas, custo } }, total },
  fab: { ... },
  inst: { ... },
  dre: { custo, pTab, pFatReal, ... },
  proposta: { porItem: [{ idx, valorUn, valorTotal }] }
};
```

Isso garante que ao alternar pra V1 (fechada), as abas montem a partir
desses valores fixos sem rodar os motores de novo.

---

## Item 6 — Seletor de versão na primeira aba

**Pedido textual:** *"dentro de orçamento se tiver mais versões na
primeira aba item deixe opção de alternar entre uma versão e outra"*

**Implementação:** `<select>` no banner do orçamento (aba Item):

```
Caracteristicas do Item · Adriano · Opcao A · Versao 2 [APROVADA]
                                                    ┌──────────┐
                                                    │ ✓ V1     │ ← clica pra alternar
                                                    │ 🔒 V2 ▼  │
                                                    └──────────┘
```

Aparece apenas quando a opção tem 2+ versões. Trocar pelo dropdown:
1. Atualiza `UI.versaoAtivaId`
2. Reseta `UI.itemSelecionadoIdx = 0`
3. Re-renderiza a aba Item (que carrega dados da nova versão)

Os ícones no select usam o mesmo padrão do CRM:
- `✓` fechada
- `🔒` aprovada
- `✎` em edição

---

## Princípios respeitados

- **Modular**: `versaoEhImutavel` centraliza a lógica em UM lugar.
  Todos os handlers (Recalcular, Zerar, etc) consultam essa função.
- **Backwards compatible**: `criarNovaVersao` usa `criarVersao`
  existente como base — só estende com modo "em-branco". Versões
  legadas (criadas antes desta mudança) continuam funcionando.
- **Conservação de histórico**: ao criar nova versão, a anterior é
  fechada como histórico (não é deletada). Felipe pode voltar pra ela
  no dropdown.
- **Sem regressão**: zerar versão em draft funciona igual antes.
  A mudança só afeta versões aprovadas/fechadas.

## Arquivos alterados

```
scripts/12-orcamento.js  (~190 linhas)
  - versaoEhImutavel (novo, +14 linhas)
  - avisarVersaoBloqueadaECriarNova (novo, +35 linhas)
  - criarNovaVersao (novo, +60 linhas)
  - deletarVersao (novo, +35 linhas)
  - Recalcular handler (proteção, +20 linhas)
  - Banner do orçamento (seletor + Nova Versão + tag aprovada, +25 linhas)
  - bindZerarButton atualizado (~8 linhas)
  - Memorial banner em versão imutável (+12 linhas)
  - Handlers seletor versão + botão Nova Versão (+30 linhas)
  - Exports atualizados (criarNovaVersao, deletarVersao)

scripts/10-crm.js  (~70 linhas)
  - Tooltips nos ícones do dropdown
  - Botão 🗑 deletar versão + handler completo
  - Layout flex no .crm-card-versoes

styles/13-orcamento.css  (~75 linhas)
  - .orc-tag-aprovada (laranja)
  - .orc-banner-versao-sel
  - .orc-btn-nova-versao
  - .orc-banner-memorial

styles/11-crm.css  (~25 linhas)
  - .crm-card-versoes layout flex
  - .crm-card-versao-del (botão lixeira)
```

## Como reverter

1. **Item 1**: tirar try/catch + verificação versaoEhImutavel
   (REINTRODUZ BUG silencioso)
2. **Item 2**: tirar tooltips + remover botão deletar
3. **Item 3**: trocar `versaoEhImutavel(v)` por `v.status === 'fechada'`
   nos handlers
4. **Item 4**: remover botão Nova Versão + função `criarNovaVersao`
5. **Item 5**: remover banner memorial
6. **Item 6**: remover seletor `#orc-banner-versao-sel` + handler
