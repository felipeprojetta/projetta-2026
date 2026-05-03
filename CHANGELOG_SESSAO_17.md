# PROJETO 17 — bug das cidades (repetido 10x)

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | 🔴 Cidade não puxa quando não tem CEP (relatado 10x) | ✅ | 10-crm.js |

---

## Item 1 — 🔴 Bug das cidades

**Pedido textual:** *"quando nao coloco cep nao esta puxando as cidade
ja feli isso 10 x"*

**Histórico das tentativas anteriores:**

1. **Sessão 5**: adicionado handler `change` no Estado → carregar cidades
   *Falha*: usuário não toca no Estado, vai direto pra Cidade.

2. **Sessão 5 (depois)**: adicionado handler `focus` na Cidade → carrega
   se datalist está vazia, lê estado do DOM.
   *Falha*: depende de o estado estar preenchido.

3. **Sessão 14**: trocado `change` por `input` no Estado pra disparar
   a cada tecla.
   *Falha*: ainda dependia do Estado estar preenchido.

**Causa raiz REAL:** Nas anteriores, eu sempre tratei o problema como
*"o Estado não dispara o evento certo"* — mas o problema sempre foi
que o **usuário não digita o Estado**. Felipe digita "BRA" na cidade
sem tocar no campo Estado, e o sistema não tinha como saber que
existem várias "Brasília" (DF), "Brasópolis" (MG), "Brasiléia" (AC).

**Correção definitiva:** Carregar lista **GLOBAL** com **TODOS os
~5570 municípios brasileiros** ao abrir o modal (1 vez, em cache).
A datalist passa a sugerir cidades **independentemente do Estado**,
no formato `Cidade — UF`. Quando o usuário seleciona uma, o handler
faz split e preenche AMBOS os campos automaticamente.

### Implementação

```js
let cidadesGlobal = null;  // [{ nome, uf }] - cache global

async function carregarCidadesGlobal() {
  const r = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
  const data = await r.json();
  cidadesGlobal = data.map(m => ({
    nome: m.nome,
    uf: m.microrregiao?.mesorregiao?.UF?.sigla
       || m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
       || m.UF?.sigla
       || '',
  })).filter(c => c.uf && c.nome);
}

// Carrega no background quando modal abre
carregarCidadesGlobal().then(() => atualizarDatalistCidades());
```

### Comportamento por cenário

**Cenário 1: usuário digita "BRA" sem estado**
```
BRA  → datalist mostra:
  Brabo — DF
  Brasilia — DF
  Brasópolis — MG
  Brasiléia — AC
  ...
```
Ao selecionar "Brasilia — DF", o handler detecta o ` — DF` e:
- `cidadeInput.value = 'Brasilia'`
- `estadoInput.value = 'DF'`
- `modalState.cidade = 'Brasilia'`
- `modalState.estado = 'DF'`

**Cenário 2: usuário digita Estado primeiro (ex: MG)**
- Carrega só cidades de MG via `carregarCidadesDoEstado('MG')`
- Datalist mostra apenas cidades de MG (sem o sufixo `— UF`)

**Cenário 3: edição de lead existente**
- `modalState.estado` já tem valor → carrega cidades do estado direto
- Funcionamento idêntico ao anterior, sem regressão

### Detecção do formato "Cidade — UF"

```js
const match = valor.match(/^(.+?)\s+—\s+([A-Z]{2})$/);
if (match) {
  modalState.cidade = match[1];  // "Brasilia"
  modalState.estado = match[2];  // "DF"
  cidadeInput.value = match[1];   // limpa o sufixo do input
  estadoInput.value = match[2];   // preenche o estado
}
```

Validado com testes: `"Brasilia — DF"`, `"Brasópolis — MG"`,
`"Brasiléia — AC"`, `"Uberlândia — MG"`, `"São Paulo — SP"` —
todos extraem corretamente.

### Trade-offs

- **Carga inicial**: ~5570 cidades = ~150KB JSON. Carregado em
  background, **não bloqueia** a UI. Se a API IBGE falhar, o sistema
  cai pro comportamento antigo (lista por Estado).
- **Performance do datalist**: limitado a 200 sugestões filtradas
  por digitação (a partir do começo do nome) pra não travar.
- **Normalização**: faz `normalize('NFD')` pra ignorar acentos na
  busca — usuário pode digitar "sao paulo" e vai achar "São Paulo".

---

## Princípios respeitados

- **Modular**: a função `carregarCidadesGlobal()` é separada da
  `carregarCidadesDoEstado()`. Cada uma é independente.
- **Backward compatible**: edição de lead com estado já setado
  funciona idêntico ao anterior.
- **Resiliência**: 3 caminhos diferentes de extração do UF do IBGE
  (a API mudou de schema 2x nos últimos anos).
- **Sem regressão**: handlers `input`, `change`, `focus` mantidos,
  só estendidos.

## Arquivos alterados

```
scripts/10-crm.js (~80 linhas)
  - cidadesGlobal + carregarCidadesGlobal (cache global)
  - atualizarDatalistCidades (filtro inteligente)
  - regex de detecção "Cidade — UF" no input/change da cidade
  - Handlers `input` em vez de `change` (mais responsivos)
```

## Como reverter

Voltar pra versão anterior do bloco de handlers de cidade/estado
(que carregava só por estado). Vai reintroduzir o bug.
