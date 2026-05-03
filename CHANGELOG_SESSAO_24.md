# SESSÃO 24 — 2026-05-02 (fix de quota localStorage)

## Problema

Felipe reportou erro `QuotaExceededError` no módulo Orçamento:
```
Failed to execute 'setItem' on 'Storage':
Setting the value of 'projetta:orcamentos:negocios' exceeded the quota.
```

## Diagnóstico (script de console rodado pelo Felipe)

| # | Chave | Tamanho |
|---|---|---|
| 1 | `projetta:cadastros:m...` (modelos?) | **2.72 MB** ⚠️ |
| 2 | `projetta:orcamentos:negocios` | 2.22 MB |
| **TOTAL** | | **4.95 / 5 MB** |

- 21 leads, 33 versões, 33 com snapshot, 38 itens totais
- **Cada `precos_snapshot` = 65.3 KB** → 33 × 65 KB = **~2.15 MB de redundância**
- `cadastros:m...` (~2.72 MB) ainda pendente de investigação — provavelmente
  imagens base64 inline em `modelos_lista`. Ataque na Sessão 25.

## Verificação crítica antes da fix

Rodei `grep -n "precos_snapshot" scripts/12-orcamento.js`:
- **4 ocorrências de WRITE** (`precos_snapshot: snapshotPrecosAtual()` em
  criarNegocio, criarVersao, etc)
- **0 ocorrências de READ** (`.precos_snapshot`)

Conclusão: o snapshot é **escrito mas nunca lido** no código atual. É
estrutura reservada pra "Etapa 3" futura (DRE histórico). Logo, posso
substituir por marcador leve sem impacto funcional algum.

## Fix implementado em `12-orcamento.js`

### 1. `snapshotPrecosAtual()` agora retorna marcador leve por default

Antes: copiava todo o cadastro → 65 KB por chamada.
Agora: retorna `{ pendente: true, tiradoEm: <iso> }` → ~50 bytes.

A função pesada original foi preservada como `snapshotPrecosCompleto()`
e é usada apenas em `fecharVersao()` — quando a versão vira histórico
imutável, faz sentido capturar precos completos.

### 2. `fecharVersao()` upgrade do snapshot leve → completo

```js
if (!alvo.precos_snapshot || alvo.precos_snapshot.pendente) {
  alvo.precos_snapshot = snapshotPrecosCompleto();
}
```

Drafts ficam leves (50 bytes); versões fechadas viram histórico real
com snapshot pesado (65 KB). Backward compat: versões antigas com
snapshot completo continuam intactas.

### 3. `saveAll()` defensivo — auto-limpeza em caso de quota

Se `localStorage.setItem` falhar com QuotaExceededError, antes de
quebrar:
1. Detecta drafts com snapshot pesado
2. Substitui por marcador leve (sem perder dados do orçamento)
3. Tenta salvar de novo
4. Se ainda falhar, propaga o erro

Isso protege o usuário de crashes futuros.

### 4. API pública de manutenção

Adicionado `Orcamento.manutencao` com 2 funções acessíveis no console:

```js
Orcamento.manutencao.relatorio();        // mostra negócios/drafts/snapshots
Orcamento.manutencao.limparSnapshotsDrafts();  // libera espaço sob demanda
```

## Economia esperada

Cenário Felipe (33 versões, 33 snapshots pesados):
- Antes: 33 × 65 KB = **2.15 MB**
- Depois (assumindo ~5 fechadas + 28 drafts): 5 × 65 KB + 28 × 50 B = **326 KB + 1.4 KB ≈ 327 KB**
- **Economia: ~1.8 MB** — sai de 4.95/5 MB pra ~3.15/5 MB

## O que NÃO foi feito

- ❌ Não toquei em `cadastros:m...` (2.72 MB) — pendente diagnóstico do
  conteúdo. Próxima sessão.
- ❌ Não migrei pra Supabase — Felipe pediu pra continuar features primeiro
- ❌ Não removi snapshots de versões fechadas (são histórico real)
- ❌ Não fiz UI de "Limpar histórico" — fica como utility de console

## Arquivos modificados

`scripts/12-orcamento.js` apenas. 4 mudanças isoladas:
- linhas 670-720 (snapshot leve + completo + alias compat)
- linhas 663-695 (saveAll defensivo)
- linha 1133 (fecharVersao captura completo)
- linhas 10325-10380 (export `Orcamento.manutencao`)

Sintaxe validada com `node -c` em todos os 32 scripts → zero erros.

## Como testar

1. No DevTools console, depois de carregar o ZIP novo:
   ```js
   Orcamento.manutencao.relatorio();
   // Deve mostrar negocios/drafts/snapsLeves/snapsPesados
   ```
2. Limpar snapshots antigos:
   ```js
   Orcamento.manutencao.limparSnapshotsDrafts();
   // Console mostra quantos foram limpos
   ```
3. Verificar tamanho da chave `projetta:orcamentos:negocios` cair pra <500 KB.

## Como reverter

Em `12-orcamento.js`:
- Remover `snapshotPrecosLeve` e `snapshotPrecosCompleto`
- Restaurar `snapshotPrecosAtual` à versão pesada original
- Remover try/catch defensivo de `saveAll`
- Remover `Orcamento.manutencao`
- Remover lógica de upgrade em `fecharVersao`

Reverter é todas mudanças num único arquivo, isoladas.
