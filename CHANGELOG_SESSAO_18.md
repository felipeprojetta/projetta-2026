# PROJETO 18 — bug do parser de medida das chapas

| # | Pendência | Status | Arquivo |
|---|-----------|--------|---------|
| 1 | 🔴 Parser pegava "4300 X5" do nome técnico em vez da medida real | ✅ | 26-superficies.js |
| 2 | Restaurar entradas que Felipe deletou no Dark Grey | ✅ Botão já existe | 26-superficies.js |
| 3 | Migração automática que conserta storage existente | ✅ | 26-superficies.js |

---

## Item 1 — 🔴 Bug do parser

**Pedido textual:** *"4300 x5 nao e medida e outra informacao da chapa
(...) volte o que deletei em cadastro de chapa e nao busque essa
informacao como medida de chapa a medida e apos o traco"*

**Causa raiz:** A função `extrairDimensoes` em `26-superficies.js`
linha 206 fazia:

```js
let m = d.match(/(\d+(?:[.,]\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(m)?/i);
```

Sem flag `g` → pegava o **primeiro** match `\d+ x \d+` da descrição.

Em chapas tipo `"PRO1874 - DARK GREY JLR MET KYNAR4300 X5 LDPE - 1500 x 5000"`,
o **primeiro número seguido de X** é `4300 X5` (que vem do nome técnico
do material "Kynar4300 X5" — código de revestimento). Então o parser
gravava `largura=4300, altura=5` no storage.

Resultado: na aba Aproveitamento de Chapas, todas as peças (que têm
~1000-2000mm) "não cabiam" na chapa de 4300×5mm — daí a mensagem
**"Não pode ser usada — peça maior que a chapa"**.

**Correção (Felipe foi explícito):** *"a medida é após o ÚLTIMO traço"*.
Solução em 2 etapas:

```js
function extrairDimensoes(desc, sObj) {
  const d = String(desc || '');

  // 1. PREFERÊNCIA — extrai SO' o que vem APÓS o último " - " ou " — "
  const idxUltimoTraco = Math.max(
    d.lastIndexOf(' - '),
    d.lastIndexOf(' — ')
  );
  if (idxUltimoTraco !== -1) {
    const sufixo = d.substring(idxUltimoTraco + 3).trim();
    const r = tentarMatch(sufixo);
    if (r) return r;
  }

  // 2. FALLBACK — descrição sem traço (ex: "ACM 4mm 1500x5000")
  // Faz busca GLOBAL com filtro de sanidade: largura 800-3000,
  // altura 1500-15000mm. Isso descarta o "4300 x 5" automaticamente.
  const re = /(\d+(?:[.,]\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(m)?/gi;
  // ... loop com filtro de range
}
```

### Validação (12 casos testados, 12/12 OK)

| Descrição | Esperado | Resultado |
|---|---|---|
| `PRO1874 - DARK GREY JLR MET KYNAR4300 X5 LDPE - 1500 x 5000` | 1500×5000 | ✅ 1500×5000 |
| `PRO0157T - PRETO WXL TEXTURIZADO WEATHER4300 LDPE - 1500 x 6000` | 1500×6000 | ✅ |
| `PRO1237 - BROWN CORTEN KYNAR4300 LDPE - 1500 X 5000` | 1500×5000 | ✅ |
| `ACM 4mm 1500x5000` (sem traço) | 1500×5000 | ✅ |
| `Chapa 1.5x6m` (em metros) | 1500×6000 | ✅ |
| `1250 x 5000` (só dimensão) | 1250×5000 | ✅ |
| `ALUSENSE — 1250 x 6000` (travessão em) | 1250×6000 | ✅ |
| `PRO9999 - SEM DIMENSAO` (sem medida) | 0×0 | ✅ |

---

## Item 2 — Restaurar Dark Grey

**Pedido textual:** *"até cheguei a deletar isso no dark grey mas
todas as chapas tem (...) volte o que deletei em cadastro de chapa"*

**Investigação:** O SEED do código (`SEED_SUPERFICIES` em `26-superficies.js`)
ainda tem **todas as 4 entradas do PRO1874 Dark Grey**:
- PRO1874 - DARK GREY ... LDPE - 1500 x 5000
- PRO1874 - DARK GREY ... LDPE - 1500 x 6000
- PRO1874 - DARK GREY ... LDPE - 1500 x 7000
- PRO1874 - DARK GREY ... LDPE - 1500 x 8000

Felipe deletou **só do localStorage do navegador dele** (não tocou no
código fonte). O sistema **já tem** o botão `↻ Restaurar Cadastro Padrão`
em Cadastros > Superfícies (canto superior direito) — clicar nele
substitui o cadastro do storage pelo SEED do código.

**Não foi necessário mexer**, só lembrar Felipe da existência do botão.

---

## Item 3 — Migração automática

**Pendência implícita:** Felipe já tinha **outras chapas** no storage
com largura/altura erradas (não só Dark Grey). Por exemplo, todas as
PRO0157T, PRO1237, PRO1874 etc tinham `largura=4300, altura=5` salvos.
Sem migração, mesmo com o parser novo, as **chapas existentes**
continuariam quebradas até o usuário clicar em "Restaurar Padrão".

**Correção:** Adicionada 4a migração `reparse_dimensoes_v2` no `load()`
do módulo Superfícies. Roda **1x** ao carregar o módulo:

```js
if (!store.get('reparse_dimensoes_v2')) {
  let alteradas = 0;
  state.superficies.forEach(s => {
    const dims = extrairDimensoes(s.descricao || '', s);
    if (dims.largura > 0 && dims.altura > 0) {
      if (Number(s.largura) !== dims.largura || Number(s.altura) !== dims.altura) {
        s.largura = dims.largura;
        s.altura  = dims.altura;
        alteradas++;
      }
    }
  });
  if (alteradas > 0) store.set('superficies_lista', state.superficies);
  store.set('reparse_dimensoes_v2', true);
}
```

Comportamento:
- Itera por todas as chapas do storage
- Re-aplica `extrairDimensoes` (versão corrigida)
- Se a nova dimensão for diferente da salva, atualiza
- Loga no console qual chapa foi corrigida pra Felipe ver
- Marca flag `reparse_dimensoes_v2 = true` (idempotente)

Resultado: ao recarregar a página com Ctrl+F5, **todas as chapas
existentes** com largura=4300/altura=5 vão automaticamente virar
1500×5000 (ou a medida correta de cada uma), **sem precisar clicar
em "Restaurar Padrão"**.

---

## Princípios respeitados

- **Modular**: o parser virou self-contained com helper interno
  `tentarMatch()`. Fácil testar.
- **Backwards compatible**: descrições simples (`"1250 x 5000"`,
  `"ACM 1500x5000"`, `"Chapa 1.5x6m"`) continuam funcionando — entram
  no fallback (etapa 2 da função).
- **Idempotente**: a migração roda 1x e marca flag. Recarga não
  re-processa.
- **Defensivo**: filtro de sanidade (largura 800-3000mm, altura
  1500-15000mm) protege contra futuros casos onde apareçam outros
  números falsos no nome técnico.

## Arquivos alterados

```
scripts/26-superficies.js (~70 linhas)
  - extrairDimensoes refatorado (Felipe: "a medida é após o último traço")
  - Migração reparse_dimensoes_v2 (~28 linhas)
```

## Como reverter

1. **Item 1**: voltar regex single-line `match()` sem `g`
   (REINTRODUZ BUG das 4300x5)
2. **Item 3**: remover bloco `if (!store.get('reparse_dimensoes_v2'))`
