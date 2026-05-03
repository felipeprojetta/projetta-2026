# Projetta v7 — Sistema ERP/CRM

Sistema interno da Weiku. Single-page app, vanilla JS, persistência em localStorage (migração futura: Supabase).


## REQUISITOS (1x só)

O Projetta precisa do **Python** instalado no PC pra subir o servidor local. Já vem na maioria dos Windows recentes, mas se não tiver:

1. Aperta tecla Windows
2. Digita `python`
3. Clica em **"Get Python"** (Microsoft Store)
4. Na Store, clica em **Instalar**
5. Aguarda ~30 segundos
6. Pronto. Não precisa configurar nada.

Se você abrir o `iniciar.bat` e ele mostrar "Python não foi encontrado", segue esses passos. Caso contrário, ignora — já tem.

---

## Como rodar

Windows: clique 2x em `iniciar.bat`. Abre o navegador automaticamente em `http://localhost:8000`.

Pra fechar: feche a janela preta do terminal. Os dados ficam salvos.

**Sempre use a mesma porta (8000).** Os dados do localStorage ficam ligados ao endereço — mudar de porta é como entrar num site novo.

---

## Estrutura

```
projetta/
├── index.html              shell HTML (carrega tudo)
├── iniciar.bat             atalho pra subir o servidor local
├── README.md               este arquivo
├── styles/                 CSS por módulo
│   ├── 00-base.css         variáveis, fontes, layout shell
│   ├── 01-components.css   botões, inputs, modais, drawers
│   ├── 02-tables.css       .cad-table, .cli-table, .rep-table (R02, R04, R06)
│   ├── 10-auth.css         tela de login
│   ├── 11-crm.css          kanban + modal Novo Lead
│   ├── 12-clientes.css
│   ├── 13-orcamento.css
│   ├── 20-cadastros.css    prefixo .cad-
│   ├── 21-representantes.css
│   ├── 22-usuarios.css
│   └── 30-config.css
└── scripts/                JS por módulo (ordem por prefixo numérico)
    ├── 00-storage.js
    ├── 01-helpers.js       fmtBR, parseBR, escapeHtml, debounce
    ├── 02-universal.js     autoEnhance (R12, R14), drag de abas (R15)
    ├── 03-auth.js
    ├── 04-migracoes.js
    ├── 05-app.js           App, moduleDefinitions, navigateTo
    ├── 10-crm.js
    ├── 11-clientes.js
    ├── 12-orcamento.js
    ├── 20-perfis.js
    ├── 21-modelos.js
    ├── 22-representantes.js
    ├── 23-usuarios.js
    ├── 24-permissoes.js
    ├── 25-placeholders-cadastros.js
    ├── 30-estoque.js
    ├── 31-email.js
    ├── 32-config.js
    ├── 40-weiku-client.js
    └── 99-boot.js
```

A ordem de carregamento dos scripts é definida pelo prefixo numérico no `index.html`. Não muda esse prefixo sem ler aqui antes — mudar quebra a ordem de inicialização.

---

## REGRAS DE OURO (todo módulo novo TEM que seguir)

1. **NUNCA acesse localStorage / IndexedDB / sessionStorage direto.**
   Use sempre a camada `Database` (ou `Storage.scope()` enquanto Database não está implementado completamente).

2. **NUNCA chame funções/variáveis de outro módulo diretamente.**
   Pra avisar outro módulo de algo, use `Events.emit()`. Pra ler dados de outro módulo, use `Database.<outro>.<entidade>`.

3. **CSS de cada módulo TEM prefixo próprio:**
   - Cadastros → `.cad-`
   - CRM → `.crm-`
   - Orçamento → `.orc-`
   - Clientes → `.cli-`
   - Estoque → `.est-`
   - Email → `.eml-`
   - Representantes → `.rep-`
   - Usuários → `.usr-`
   - Configurações → `.cfg-`

   Estilos do shell global usam `.login-`, `.topbar`, `.sidebar`, `.nav-`, `.btn` etc.

4. **JS de cada módulo vive dentro de uma IIFE:**
   ```js
   const NomeDoModulo = (() => {
     // ...
     return { render };
   })();
   ```
   Variáveis dentro nunca vazam pra outros módulos.

5. **Cada módulo registra-se via `App.register('nome', { render })`.**
   Erros no `render()` são capturados — não derruba o sistema.

---

## CAMADAS DO SISTEMA

```
┌─────────────────────────────────────────────┐
│  MODULOS (Cadastros, CRM, Orcamento, ...)   │
│  - falam apenas com:                        │
│    Database, Events, Auth, App.register     │
└─────────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────────┐
│  CORE                                       │
│  - Database  (dados; async; vai virar       │
│               Supabase)                     │
│  - Auth      (sessao do usuario)            │
│  - Events    (mensagens entre modulos)      │
│  - App       (roteamento, registro, render) │
└─────────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────────┐
│  Driver atual: localStorage (offline temp.) │
│  Driver futuro: Supabase (online, realtime) │
└─────────────────────────────────────────────┘
```

---

## TRANSIÇÃO PARA SUPABASE (planejada)

Quando o sistema for pra produção:
- `Database.driver` muda de `'local'` para `'supabase'`
- Cada módulo continua chamando `Database.cadastros.perfis.list()` do mesmo jeito; quem cuida da rede é o driver
- `Database.subscribe()` já existe na API; será implementado com Supabase Realtime para sincronizar entre usuários
- `Auth` vai trocar de localStorage para Supabase Auth (OAuth/JWT)

---

## ESCOPO DE DADOS POR MÓDULO

| Módulo | Dados |
|---|---|
| `auth` | sessão, lista de usuários |
| `cadastros` | perfis, acessórios, superfícies, modelos, fretes, representantes, mensagens, permissões |
| `crm` | oportunidades, etapas, atividades |
| `clientes` | pessoas/empresas, histórico de orçamentos |
| `orcamento` | orçamentos, propostas, levantamentos |
| `estoque` | cache de saldos Omie |
| `email` | templates, histórico de envios |

---

## REGRAS UNIVERSAIS DE INTERFACE E COMPORTAMENTO

Estas regras são aplicadas a TODO o sistema, em qualquer módulo, aba ou sub-aba. Não precisam ser repetidas por módulo. Quando uma nova regra universal for adicionada, declarar AQUI primeiro e propagar para os módulos existentes.

| # | Regra | Implementação |
|---|---|---|
| **R01** | Todo número exibido = exatamente 2 casas decimais, em qualquer lugar | `fmtBR()` / `fmtNum()` com `minimumFractionDigits:2, maximumFractionDigits:2` |
| **R02** | Toda tabela com listas usa zebra striping (linhas pares com cinza claro `#E4E8EE`) | CSS `.cad-table tbody tr:nth-child(even)` |
| **R03** | Cores do sistema = SOMENTE paleta Projetta: azul `#003144`, laranja `#c47012`, cinzas claros (acentos), branco. Verde só em popup "Salvo OK". Vermelho só em modal de exclusão | Variáveis CSS `--azul-escuro`, `--laranja`, `--cinza-*` |
| **R04** | Nunca cortar texto ou números em campos. Se não couber, scroll horizontal | `min-width` nas colunas; `overflow-x:auto` em `.cad-table-wrap`; `white-space:nowrap` em colunas numéricas |
| **R05** | Números decimais aceitam vírgula brasileira (`"1,55"`) ou ponto (`"1.55"`). Saída sempre com vírgula BR | Helper `parseBR()` |
| **R06** | Colunas de tabela alinhadas À ESQUERDA. Sem espaços gigantes esticando entre elas | `min-width` fixo nas colunas; sem `1fr`/`auto`; wrapper `width: min-content` |
| **R07** | Toda tela com edição TEM que ter botão "Salvar Alterações" + popup confirmando o save | Helper `showSavedDialog()` com pop-up bloqueante |
| **R08** | Tipografia: Lexend Zetta para títulos (CAIXA ALTA), Montserrat para corpo de texto | Variáveis `--font-display` e `--font-body` |
| **R09** | Módulos isolados: prefixo CSS e scope próprio de Storage/Database | IIFE por módulo + `Storage.scope()` |
| **R10** | Sistema 100% em português (BR), sem acentos em código (apenas em UI visível ao usuário) | Strings hardcoded sem acento em código (ex: `"Codigo"` no JS, `"Código"` pro usuário) |
| **R11** | PROIBIDO fundo colorido atrás de texto. Sem pills coloridos, sem badges com bg de cor (azul claro, amarelo, rosa, roxo etc.) | Pills/badges: SEM background. Apenas cor de TEXTO da paleta |
| **R12** | Toda tabela com lista deve permitir FILTRO e ORDENAÇÃO POR COLUNA | Cabeçalhos `<th>` clicáveis (asc/desc/none). Filtros adicionais por colunas-chave na toolbar como `<select>` |
| **R13** | Toda tabela tem botão para ADICIONAR LINHA e botão para EXCLUIR LINHA completa | Botão "+ Adicionar" na toolbar; última coluna com botão "X" |
| **R14** | Filtro de coluna sempre tem AUTOCOMPLETE | Dentro de `Universal.autoEnhance`. Cada `input.univ-col-filter` ganha `<div.univ-filter-popup>` irmão |
| **R15** | Sub-abas são REORDENÁVEIS por drag-and-drop. A nova ordem persiste entre sessões | `.sub-nav-item draggable="true"`; ordem em `Storage.scope('app')` chave `tabsOrder:<moduloId>` |
| **R16** | Toda tabela com listas TEM botão "Importar planilha" e "Exportar Excel" na toolbar superior. **Exceções:** tabelas read-only (só Exportar — ex: Clientes, que deriva do CRM); tabelas com dados sensíveis (Usuários — sem nenhum dos dois, segurança) | Helpers `Universal.exportXLSX({headers, rows, sheetName, fileName})` e `Universal.readXLSXFile(file, callback)` em `04-universal.js`. Cada módulo chama esses helpers nos seus próprios botões. SheetJS embutido no `index.html` (offline) |
| **R17** | Toda tabela tem layout de toolbar IDÊNTICO: linha 1 com contadores à esquerda + botões à direita (Importar, Exportar, +Adicionar, Salvar — nessa ordem); linha 2 (se necessário) com busca + filtros adicionais. Sem variação entre módulos | CSS `.{prefix}-toolbar-row-1` com `justify-content: space-between`. Botões agrupados em `.{prefix}-toolbar-right` |
| **R18** | Toda tabela TEM `Universal.autoEnhance()` ativo (filtro por coluna com autocomplete + sort por header) E ordenação default A-Z na primeira coluna ao carregar. SEM EXCEÇÃO | Chamar `window.Universal.autoEnhance(tbl, { skipCols: ['actions'] })` no fim do `bindEvents`. No `load()`, fazer `state.lista.sort((a,b) => String(a.{primeiraColuna}).localeCompare(String(b.{primeiraColuna}), 'pt-BR'))` antes de marcar `loaded = true` |
| **R19** | **Tipografia uniforme — sem negrito pesado, sem variação de tamanho.** Felipe tem TOC e exige consistência visual: nenhum elemento em `font-weight: 700` ou `bold`; sem `<strong>` inline destacando palavras dentro de prosa; tamanhos de fonte limitados a uma escala canônica (4-5 valores apenas: 11px tags/filtros, 13px corpo, 16px botões, 24px títulos). Tudo simétrico, alinhado, sem destaques tipográficos isolados | CSS: substituir `font-weight: 700/bold` por `font-weight: 600` (semi-bold leve, tolerado em headers de tabela e contadores). HTML: trocar `<strong>x</strong>` por `<span>x</span>` (mantém estrutura, remove peso). Quando uma célula precisa de alinhamento e outra não tem o mesmo elemento (ex: linha sem botão "X"), usar placeholder invisível com mesmas dimensões pra manter colunas verticalmente alinhadas |
| **R20** | **Capitalização — Primeira letra de cada palavra maiúscula, resto minúscula. SEM EXCEÇÃO.** Aplicado a TODO texto exibido no sistema: descrições, nomes, razões sociais, headers de coluna, labels, botões, breadcrumbs, títulos de página. Qualquer conteúdo de tabela ou form. **Mesmo que o dado venha em CAIXA ALTA da planilha ou da intranet, sempre é normalizado pra Title Case na exibição.** Nada de UPPERCASE em lugar nenhum — Felipe quer simetria visual total. R08 (Lexend Zetta em títulos) é mantida apenas para a *fonte*, não pra capitalização — títulos podem usar Lexend Zetta mas com Title Case | Helper `Universal.titleCase(s)` em `04-universal.js` (faz `s.toLowerCase()` + capitaliza primeira letra de cada palavra). Aplicar no momento de renderizar campos de texto livre (descricao, nome, razao_social etc). Headers de tabela em JS escritos em "Codigo"/"Fornecedor"/etc (não "CODIGO"/"FORNECEDOR"). CSS: REMOVER **todos** os `text-transform: uppercase` do sistema (sem exceção, nem em h1/h2/títulos) — manter texto cru |

---

## Helpers utilitários (reusar quando criar módulo novo)

- `fmtBR(n)` — formatar número (R01)
- `parseBR(str)` — parsear número BR/EN (R05)
- `escapeHtml(s)` — escapar HTML em strings de UI
- `debounce(fn, ms)` — auto-save com debounce
- `showSavedDialog()` — popup "Salvo com sucesso!" (R07)
- `createSaveButton()` — fábrica de botão "Salvar Alterações" (R07)
- `.cad-table` — classe que já aplica R02 + R04 + R06
- `Universal.autoEnhance(table)` — R03 (sort), R14 (filter+autocomplete)
- `Storage.scope(name)` — wrapper de localStorage com prefixo

---

## TROUBLESHOOT (problemas comuns)

### Tela branca com "This site can't be reached" ou "ERR_CONNECTION_REFUSED"
O servidor não subiu. Causas:
- **Python não está instalado** → veja seção "Requisitos" acima.
- **A janela preta foi fechada** → reabra clicando em `iniciar.bat`.
- **Outra coisa está usando a porta 8000** → feche outros servidores ou aplicativos.

### Tela branca em branco mesmo com servidor rodando
- Aperte F5 no navegador (force reload)
- Aperte Ctrl+Shift+R (limpa cache da página)
- Abra o DevTools (F12) → aba Console → manda print do erro

### "Não logo, diz senha errada"
- Verifica que digitou exatamente: usuário `felipe.projetta`, senha `12345` (sem espaços)
- Se você apagou o localStorage ou está num navegador novo, os usuários default são re-criados automaticamente no próximo carregamento

### Os dados antigos sumiram
- localStorage é por origem. Quando antes você abria via `file:///`, e agora abre via `http://localhost:8000`, o navegador trata como sites diferentes. Os dados antigos não foram apagados — estão no `file:///`. 
- Se quiser migrar: abre o `index.html` antigo no navegador, abre DevTools (F12) → Application → Local Storage → exporta. Depois entra em localhost:8000, importa do mesmo jeito. Ou me avisa que faço um script automático.

### Quero usar em outro PC (Thays/Andressa)
- Cada PC precisa ter Python instalado
- Cada PC tem o próprio `localStorage`. Os dados são INDEPENDENTES por PC enquanto não tiver Supabase.
- Quando Supabase entrar (Fase futura), aí sim sincroniza entre todas as máquinas.
