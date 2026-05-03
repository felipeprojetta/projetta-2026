# PROJETO 14 — 5 pendências do Felipe

| # | Pendência | Status | Arquivos |
|---|-----------|--------|----------|
| 1 | Site em minúscula + ícones Instagram/Web "Siga-nos nas redes sociais" | ✅ | 12-orcamento.js + 41-empresa.js + 27-relatorios.css |
| 2 | Não abrir impressora — exportar direto para download | ✅ | 12-orcamento.js |
| 3 | "A - 1 - Proposta Comercial - Previa" → "Proposta Comercial - 1ª Versão" | ✅ | 12-orcamento.js |
| 4 | DRE aprovada → todas as abas somente leitura | ✅ | 12-orcamento.js + 13-orcamento.css |
| 5 | PDF picado em várias páginas — quebra correta | ✅ | 12-orcamento.js |

---

## Item 1 — Rodapé com redes sociais

**Pedido textual:** *"COLOQUE SITE EM LETRA MINUSCULA E UM SIMBOLO DE
WEBSITE. COLOQUE ACIMA DO SITE @PROJETTAALUMINIO COM SIMBOLO DO
INSTAGRAM. EM CIMA DESTE SIGA NOS NAS REDES SOCIAIS"*

**Correção:** Rodapé da proposta agora tem 3 linhas centralizadas:

```
            Siga-nos nas redes sociais
       📷  @projettaaluminio              ← bold
       🌐  www.projettaaluminio.com       ← minúsculo
```

Detalhes:
- **CTA**: "Siga-nos nas redes sociais" em itálico cinza, font 10px
- **Ícone Instagram**: SVG inline (câmera + círculo) — não depende de
  bibliotecas externas, renderiza em PDF
- **Ícone Web/Globo**: SVG inline (globo com meridianos)
- **Site em minúsculas**: `www.projettaaluminio.com` (era `WWW.PROJETTAALUMINIO.COM`)
- **Layout**: flex column, gap 4px, centralizado

CSS novo: `.rel-prop-footer-redes`, `.rel-prop-footer-cta`,
`.rel-prop-footer-rede`, `.rel-prop-footer-icon`,
`.rel-prop-footer-handle`, `.rel-prop-footer-site`.

Módulo `41-empresa.js` agora expõe também `instagram: '@projettaaluminio'`
junto do `site` em minúsculo, caso seja usado em outros relatórios.

---

## Item 2 — Exportar PDF direto (sem impressora)

**Pedido textual:** *"NAO ABRA IMPRESSORA SEMPRE AO CLICAR EXPORTE
DIRETO PARA DOWNLOAD"*

**Causa raiz:** O botão `🖨 Imprimir / Exportar PDF` chamava
`window.print()` — que abre a caixa de diálogo de impressão do
navegador (com checkbox "Salvar como PDF" escondido entre as opções,
e visual ruim).

**Correção:** Criada função `exportarPropostaPDF()` análoga à
`exportarPadroesCortesPDF()` que já existia no projeto. Estratégia:

1. Lazy-load de `jspdf` e `html2canvas` via CDN (igual padrões de cortes)
2. Clona `.rel-prop-folha` em container off-screen com largura A4 (794px @ 96dpi)
3. Itera sobre cada `.rel-prop-pagina` individual
4. Captura cada uma em canvas separado com `html2canvas`
5. Adiciona ao PDF como página única (jsPDF.addPage entre elas)
6. `pdf.save('Proposta_<cliente>_<data>.pdf')` → download direto

Botão renomeado: `🖨 Imprimir / Exportar PDF` → `📄 Exportar PDF`.
Tooltip: *"Baixa o PDF da proposta direto (não abre impressora)"*.

Durante a geração, mostra `⏳ Gerando...` no botão (tempo médio: 2-4s
dependendo do número de páginas).

---

## Item 3 — Cabeçalho com "1ª Versão"

**Pedido textual:** *"A - 1 · Proposta Comercial — Previa - ISSO NO
CABECALHO SERIA O QUE? O QUE SERIA A-1? COLOQUE 'PROPOSTA COMERCIAL -
1ª VERSAO' E DEPOIS AO IR FAZENDO OUTRAS VERSOES VAI ALTERANDO ALI EM CIMA"*

**Correção:** Antes a proposta mostrava `A - 1 · Proposta Comercial — Previa`
(letra da opção + número da versão). A letra da opção (A, B, C...)
nunca foi explicada pra Felipe e a palavra "Prévia" também não fazia
sentido pra ele.

```js
// ANTES
const numeroDoc = `A - 1`;
tituloRelatorio: 'Proposta Comercial — Previa'

// DEPOIS
const numVersao = versao.numero || 1;
const tituloProposta = `Proposta Comercial - ${numVersao}ª Versao`;
const numeroDoc = `V${numVersao}`;
```

Resultado no header da proposta:
- Versão 1: `V1 · Proposta Comercial - 1ª Versao`
- Versão 2: `V2 · Proposta Comercial - 2ª Versao`
- Versão 3: `V3 · Proposta Comercial - 3ª Versao`

Conforme o Felipe vai criando novas versões (botão `+ Nova Versão` da
sessão 12), o título atualiza automaticamente.

---

## Item 4 — DRE aprovada bloqueia TODAS as abas

**Pedido textual:** *"AO GERAR DRE DEVE TRAVAR TODAS AS ABAS DEVE SER
SOMENTE LEITURA"*

**Correção:** Modo readonly global aplicado via classe CSS no container
do orçamento. Implementação em 2 partes:

### JS (12-orcamento.js)
Função `render(container, tabId)` (entry-point de todas as abas)
inicializa a sessão e checa `versaoEhImutavel()`:

```js
function render(container, tabId) {
  inicializarSessao();
  const versaoR = versaoAtiva();
  if (versaoR && versaoEhImutavel(versaoR)) {
    container.classList.add('is-orc-readonly');
  } else {
    container.classList.remove('is-orc-readonly');
  }
  // ... renderiza aba
}
```

### CSS (13-orcamento.css)
Banner topo + bloqueio de inputs/buttons:

```css
.is-orc-readonly::before {
  content: "📜 Modo Memorial — versao APROVADA/FECHADA, somente leitura...";
  display: block;
  background: #fff5ed;
  border: 1px solid var(--laranja);
  /* ... */
}
.is-orc-readonly input:not([data-allow-readonly]),
.is-orc-readonly select:not(.orc-banner-versao-sel):not(.lvp-edit) {
  pointer-events: none;
  background: var(--cinza-mais-claro) !important;
  cursor: not-allowed;
}
.is-orc-readonly button:not(.orc-btn-back):not(.orc-btn-nova-versao):not([id="orc-prop-imprimir"]):...
{
  opacity: 0.5;
  pointer-events: none;
}
```

**Whitelist** de elementos que continuam funcionando mesmo em readonly:
- `.orc-btn-back` (← Voltar pro CRM)
- `.orc-btn-nova-versao` (+ Nova Versão)
- `#orc-prop-imprimir` (📄 Exportar PDF)
- `#orc-btn-calcular` (Recalcular — já tem proteção própria)
- `.lvp-subtab`, `.tab`, `.subtab` (navegação entre abas)
- `[data-action="select-item"]` (alternar entre itens)
- `.orc-banner-versao-sel` (alternar versão no banner)

Tudo mais (inputs de campos, botões "+ Adicionar", "🗑 Zerar", etc)
ficam desabilitados visualmente (cinza + cursor not-allowed) e sem
clique.

---

## Item 5 — PDF picado → quebra correta

**Pedido textual:** *"VEJA QUE DENTRO DO SISTEMA ESTA TUDO EM UMA
PAGINA. IMPRESSO PDF ESTA PICADO CONFIGURE"*

**Causa raiz:** `window.print()` deixava o navegador decidir os pontos
de quebra automaticamente — geralmente cortando no meio de um card
(metade da porta na pág 1, metade na pág 2, etc).

**Correção:** A função `exportarPropostaPDF()` (novo, do Item 2)
captura **cada `.rel-prop-pagina` separadamente** e adiciona ao PDF
como página única. As páginas já estão estruturalmente divididas no
HTML com:
- `.rel-prop-pagina` (uma por bloco lógico — capa, tabela, observações...)
- `min-height: 1123px` (= A4 a 96dpi)
- `box-sizing: border-box`

Por isso cada captura vira **exatamente** uma página A4 do PDF, sem
nenhum corte no meio.

```js
const paginas = cloneHost.querySelectorAll('.rel-prop-pagina');
for (let i = 0; i < paginas.length; i++) {
  const canvas = await html2canvas(paginas[i], { scale: 2, ... });
  if (i > 0) pdf.addPage();
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, larguraImg, alturaImg);
}
```

**Fallback de segurança:** se algum `.rel-prop-pagina` ficar maior
que A4 (raro — só se conteúdo for muito longo), redimensiona pra
caber na altura preservando proporção.

---

## Princípios respeitados

- **Modular**: novo método de PDF reusa carregamento de libs já
  existente (jsPDF + html2canvas)
- **Backward compatible**: `window.print()` ainda funciona via
  `Ctrl+P` no navegador (quem quiser imprimir físico pode)
- **Whitelist explícita** no readonly CSS: cada classe que continua
  ativa está documentada e justificada
- **Sem regressão**: `versaoEhImutavel` já existia (sessão 12), só
  estendemos uso pra todas as abas

## Arquivos alterados

```
scripts/12-orcamento.js  (~150 linhas)
  - Rodapé com Instagram + Site (~45 linhas)
  - exportarPropostaPDF (nova função, ~80 linhas)
  - Título "Proposta Comercial - Nª Versão" (~8 linhas)
  - Modo readonly em render() (~10 linhas)
  - Botão Exportar PDF chama nova função em vez de window.print

scripts/41-empresa.js  (~2 linhas)
  - site em minúsculo + adicionado handle do Instagram

styles/27-relatorios.css  (~37 linhas)
  - .rel-prop-footer-redes e elementos filhos

styles/13-orcamento.css  (~36 linhas)
  - .is-orc-readonly (banner + bloqueio de inputs/buttons)
```

## Pendências conhecidas

- O modo readonly bloqueia inputs/buttons via CSS (`pointer-events: none`).
  Isso é seguro pra UX mas se o usuário inspecionar o DOM e remover a
  classe `.is-orc-readonly`, conseguiria editar. Pra blindar 100%, a
  validação também deve estar no código JS (no momento de salvar).
  Já existe em `atualizarVersao` que lança throw — essa segunda camada
  protege contra contorno via DevTools.

- A nova exportação PDF requer internet (CDN de jsPDF/html2canvas).
  Numa instalação totalmente offline, seria preciso baixar essas libs
  localmente. Mesma situação dos Padrões de Cortes — já tinha esse
  comportamento desde antes.

## Como reverter

1. **Item 1**: voltar `<div class="rel-prop-footer-site">` simples
2. **Item 2**: voltar `window.print()` no handler (REINTRODUZ ABRIR IMPRESSORA)
3. **Item 3**: voltar `numeroDoc = '${opcao.letra} - ${versao.numero}'`
4. **Item 4**: remover `if (versaoEhImutavel) container.classList.add('is-orc-readonly')`
5. **Item 5**: voltar `window.print()` (idem item 2)
