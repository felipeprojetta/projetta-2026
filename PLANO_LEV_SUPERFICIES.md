# Plano — Levantamento de Superfícies (Chapas)

**Estado**: Etapa 1 concluída + motor base do quadro/peças criado (Modelo 10).
Próxima: implementar mais modelos + algoritmo de aproveitamento.

---

## ✅ Especificações consolidadas (Felipe — sessão 2026-05)

### Constantes globais
- **Kerf** (largura do disco/serra): **4 mm**
- **Margem da chapa-mãe**: **10 mm** (área de segurança nas bordas)
- **Veio**: chapas Wood (madeira) **NÃO podem rotacionar**
- **Inversão L↔H manual por peça**: campo de orientação por peça (não automático)
- **Preço**: **por chapa inteira** (unidade), já existe em `Cadastros > Superfícies`

### Tamanhos de chapa-mãe (cadastrados em Cadastros > Superfícies)
- **ACM**: largura 1500 ou 1250 mm × comprimentos 5, 6, 7, 8 m
- **Alumínio Maciço**: largura 1500 ou 1250 mm × comprimentos 3, 5, 6 m
- **HPL**: outros tamanhos (Felipe vai cadastrar)
- **Vidro**: outros (Felipe vai cadastrar)

### Cor interna ≠ cor externa = chapas separadas
Cada lado da porta calcula peças e quantidade de chapas **separadamente**.
Mesmo se as cores forem iguais, são 2 conjuntos de peças (1 pra cada lado).

### Modelo Externo + Modelo Interno (NOVO)
Adicionados em `Características do Item`. Botão "↘ Copiar Externo → Interno"
para quando os 2 lados são iguais. Implementado nesta sessão.

---

## 🧱 Estrutura PORTAL vs PORTA

### PORTAL — peças FIXAS (mesmas em todo modelo, só mudam tamanho com a família PA-006/007F)
- `U_PORTAL_UNICO` ou `U_PORTAL_BIPARTIDO` (depende de nFolhas)
- `BAT_01`, `BAT_02`, `BAT_03`
- `TAP_FURO`
- `FIT_ACAB_ME`, `FIT_ACAB_LARGURA`
- `ALISAR_ALTURA`, `ALISAR_LARGURA` (só se tem_alisar = Sim)

### PORTA — peças que variam por MODELO

**Sempre presente** (todos os modelos):
- `TAMPA` — peça grande do quadro inteiro

**Aparecem em alguns modelos**:
- `TAMPA_BORDA_CAVA` — modelos com cava (1, 2, 4, 22, etc)
- `TAMPA_BORDA_FRISO_VERTICAL` — modelos com friso vertical (2, 4, 5, 7, 11, etc)
- `TAMPA_BORDA_FRISO_HORIZONTAL` — modelos com friso horizontal (3, 4, 12, 13)
- `CAVA` — corte do tubo de cava
- `CANTONEIRA_CAVA` — perfil cantoneira
- `ACAB_LAT_1`, `ACAB_LAT_2`, `ACAB_LAT_Z` — acabamentos laterais
- (lista completa: depende do modelo)

---

## 📐 Conceito: o QUADRO

O **quadro** é a área retangular interna onde as peças de chapa são posicionadas.
Suas dimensões definem o **limite de cálculo** de TODAS as peças do lado externo
ou interno.

### ALTURA DO QUADRO
Igual à altura da chapa da folha (PA-006F ou PA-007F):
```
ALT_QUADRO = A − FGA − TUBLPORTAL − ESPPIV + TRANSPIV
```

Para família 76: `ALT_QUADRO = A − 10 − 38.1 − 28 + 8 = A − 68.1`
Para família 101: `ALT_QUADRO = A − 10 − 50.8 − 28 + 8 = A − 80.8`

### LARGURA DO QUADRO
**1 folha** (`nFolhas = 1`):
```
LARG_QUADRO = L − FGLD − FGLE − 171.7 − 171.5 + 90 + 128
            = L − 145.2  (com FGLD=FGLE=10)
```

**2 folhas** (`nFolhas = 2`):
```
LARG_QUADRO_TOTAL = L − FGLD − FGLE − 171.7 − 171.5 + 128 + 128
                  = L − 109.2  (com FGLD=FGLE=10)

LARG_QUADRO_POR_FOLHA = LARG_QUADRO_TOTAL / 2
```
> ⚠ **Confirmar com Felipe**: estou interpretando que pra 2 folhas a fórmula
> dá o quadro TOTAL ocupado por ambas. Cada folha individual fica com metade.

---

## 📋 Algoritmo de geração de peças (por lado, por modelo)

```javascript
function gerarPecasChapa(item, lado /* 'externo' | 'interno' */) {
  const quadro = calcularQuadro(item);
  const modeloDoLado  = (lado === 'externo') ? item.modeloExterno : item.modeloInterno;
  const corDoLado     = (lado === 'externo') ? item.corExterna   : item.corInterna;
  const temVeio       = detectarVeio(corDoLado);

  switch (modeloDoLado) {
    case 10:  // Porta lisa — só TAMPA
      return [{ label: 'Tampa', largura: quadro.larg, altura: quadro.alt, qtd: 1 }];

    case 1:   // Cava
      // TODO Felipe: especificação detalhada
      return [...];

    // outros modelos...
  }
}
```

---

## 🛠 Arquivos criados nesta rodada

### `scripts/38-chapas-porta-externa.js` (NOVO)
- `ChapasPortaExterna.calcularQuadro(item)` → `{larguraQuadro, alturaQuadro, familia, nFolhas}`
- `ChapasPortaExterna.gerarPecasChapa(item, lado)` → `[{label, largura, altura, qtd, podeRotacionar, cor, lado, modelo}]`
- `ChapasPortaExterna.obterFamilia(item)` → `'76'` ou `'101'`
- Constantes compartilhadas com `31-perfis-porta-externa.js` (storage `regras_variaveis_porta_externa`)

### `scripts/12-orcamento.js` (alterado)
- Schema do item: `modeloExterno`, `modeloInterno` separados
- Migração defensiva em `normalizarItem()` (itens legados ganham os 2 campos)
- UI: 2 dropdowns + botão "↘ Copiar"
- Validação no Calcular: exige ambos preenchidos

### `scripts/26-superficies.js` (alterado na rodada anterior)
- Schema chapa-mãe: `largura`, `altura`, `tem_veio` (extraídos automaticamente da descrição)

---

## 🚀 Próximas rodadas

| Etapa | O que entrega |
|-------|---------------|
| **2. Algoritmo nesting** | `38-chapas-otimizador.js` — Guillotine BL + Best Fit. Roda em N tamanhos de chapa-mãe e retorna o melhor. |
| **3. Mais modelos** | Adicionar Modelo 1 (Cava), 2 (Cava+Friso), 3 (Friso H), etc. Felipe especifica peça por peça. |
| **4. Peças PORTAL** | `gerarPecasPortal(item)` — peças fixas (BAT_01/02/03, ALISAR, etc). Independente de modelo. |
| **5. UI Lev. Superfícies** | Tabela de peças + 4 cards de comparação por tamanho de chapa. SVG do layout. |
| **6. Conectar custo** | Botão "Usar resultado" → `versao.custoFab.total_revestimento`. |
| **7. Import/Export XLSX** | Felipe (sessão 2026-05): exportar lista de peças + layout escolhido. Importar lista de peças vinda de outro orçamento ou planilha externa. Aproveitar `04-universal.js` (já tem helpers de XLSX). |

---

## 📤 Especificação do Import/Export Excel (Etapa 7)

**Felipe (sessão 2026-05): "PERMITIR IMPORTACAO E EXPORTACAO EXEL PARA APROVEIMANTO DE CHAPA"**

### Export — botão "↓ Exportar XLSX" na aba Lev. Superfícies
Gera arquivo com 3 abas:
1. **Peças** — lista completa: id, label, lado, modelo, cor, largura, altura, qtd, podeRotacionar
2. **Chapas-mãe escolhidas** — para cada cor, qual tamanho foi escolhido + qtd de chapas + custo
3. **Layout** — texto/CSV das posições x,y,w,h de cada peça em cada chapa (compatível com Cut2D Pro)

### Import — botão "↑ Importar XLSX"
Aceita planilha com aba "Peças" no mesmo formato do export. Sobrescreve ou MERGE com peças geradas
pelo motor (escolha do usuário).

### Como integra: usa `Universal.exportXLSX()` e `Universal.readXLSXFile()` de `04-universal.js`.

---

## ❓ Perguntas pendentes pra Felipe

1. **2 folhas**: a fórmula `LARG_QUADRO = L − 109.2` é a largura TOTAL ocupada pelas 2 folhas (e cada folha individual tem metade)? Ou é a largura individual de cada folha?

2. **Modelo 10**: é uma porta totalmente lisa (sem cava, sem friso, sem ripado)? Confirmando essa interpretação.

3. **Próximo modelo**: depois do 10, qual você prefere atacar? Tem o Modelo 1 (Cava) que é o mais comum, mas é mais complexo. Ou prefere ordem numérica?

4. **Peças do PORTAL**: para implementar BAT_01, BAT_02, BAT_03, TAP_FURO, FIT_ACAB_ME, FIT_ACAB_LARGURA, ALISAR_ALTURA, ALISAR_LARGURA — me passa as fórmulas de comprimento × largura × qtd de cada uma.


---

## 📚 O que estudei nos 3 sites de referência

### Cut2D Pro (Vectric) — `maxcutsoftware.com`
- Software profissional de CAM 2D para CNC
- "Otimizar peças": diâmetro da ferramenta, folga (kerf), margem da chapa
- Opções: rotacionar peças (90°), espelhar, aninhar frente/verso
- Direção do corte: ao longo de X ou Y
- Suporte a múltiplas folhas com folha ativa selecionável
- Algoritmo: **Bottom-Left Fill** com rotação opcional

### Otimize Nesting — `otimizenesting.com.br`
- Online, CNC ou corte convencional
- Atenção a **veio** (texturas, escovado, xadrez) — peças com veio NÃO podem rotacionar
- Padronização: tudo em milímetros, larguras × comprimentos do cadastro
- Quanto MAIS peças e tamanhos diferentes, MELHOR o aproveitamento (combinatória)
- Sobras: software armazena pra reuso futuro

### Corte Certo — `cortecerto.com`
- Suporta múltiplas chapas-mãe heterogêneas
- Versão Web em nuvem
- Calcula **número de chapas** necessárias e gera orçamento
- Inclui fitas de borda na soma (pra marcenaria)

---

## 🧠 Algoritmo proposto

**Guillotine Bottom-Left com Best Fit Decreasing Area** + árvore binária de retângulos livres

### Por que esse?
1. **Guillotine** = cortes vão de borda à borda (vertical OU horizontal). Esse é o caso REAL da serra/disco/laser usado em fabricação industrial. **Não-guillotine** (cortes em "L") só faz sentido pra plotter/laser super preciso.
2. **Bottom-Left** = posiciona cada peça o mais à baixo e à esquerda possível na chapa. Heurística simples e eficaz.
3. **Best Fit** = entre todos os retângulos livres na chapa, escolhe o que melhor encaixa a peça (menor sobra de área).
4. **Decreasing Area** = peças ordenadas por área decrescente (maiores primeiro). Isso evita "buracos" inúteis no fim.

### Como funciona (passo a passo)

```
1. Ordena lista de peças por área decrescente
2. Para cada peça:
   a. Procura entre todos os retângulos livres das chapas abertas
   b. Tenta orientação normal E rotacionada 90° (se a peça permite)
   c. Escolhe o retângulo livre que deixa MENOS sobra
   d. Posiciona no canto inferior-esquerdo desse retângulo
   e. Divide o retângulo livre em 2 novos retângulos livres
      (corte guillotine: horizontal OU vertical, escolhe o que minimiza desperdício)
3. Se nenhuma chapa aberta couber a peça → abre nova chapa
4. Repete até esgotar peças
5. Calcula aproveitamento (% área usada / área total)
```

### Estrutura de dados (JS)

```javascript
// Cada chapa é uma árvore de retângulos livres
const chapa = {
  largura: 1500, altura: 6000, cor: 'As003',
  pecasPosicionadas: [
    { peca: 'TAMPA MAIOR', x: 0, y: 0, w: 1233, h: 3232, rotacionada: false },
    // ...
  ],
  retangulosLivres: [  // pos-corte
    { x: 1233, y: 0, w: 267, h: 3232 },
    { x: 0, y: 3232, w: 1500, h: 2768 },
    // ...
  ],
  areaUsada: 7370764,  // mm²
  areaTotal: 9000000,
  aproveitamento: 0.819,  // 81.9 %
};
```

### Parâmetros de entrada

| Parâmetro | Default | O que controla |
|-----------|---------|----------------|
| `kerf` (folga corte) | 4 mm | gap entre peças (largura do disco/laser) |
| `margem_chapa` | 10 mm | borda morta da chapa-mãe |
| `permite_rotacao` | true | peças podem virar 90° |
| `tem_veio` | false | se true, ignora `permite_rotacao` (peça fixa na orientação) |
| `direcao_grao` | 'longitudinal' | só usado se `tem_veio = true` |

---

## 🎯 Como vai aparecer no Projetta

### Aba "Levantamento de Superfícies" — estrutura

```
┌─────────────────────────────────────────────────────────────┐
│ [Header padrão]                                             │
│                                                             │
│ ITEM 1 — Porta Externa Pivotante 2000×3000mm                │
│   Cor Externa: As003 — Wood Maple Alusense LDPE             │
│   Cor Interna: As003 — Wood Maple Alusense LDPE             │
│                                                             │
│  Peças necessárias:                                         │
│  ┌──────────────┬──────┬──────┬─────┬────────┬───────────┐ │
│  │ Peça         │ L mm │ A mm │ Qtd │ Local  │ Cor       │ │
│  ├──────────────┼──────┼──────┼─────┼────────┼───────────┤ │
│  │ TAMPA MAIOR  │ 1233 │ 3232 │  2  │ Folha  │ As003 ext │ │
│  │ TAMPA BORDA  │  248 │ 3232 │  2  │ Folha  │ As003 ext │ │
│  │ TAMPA CAVA   │  240 │  210 │  4  │ Folha  │ As003 ext │ │
│  │ ...                                                     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ SIMULAÇÃO DE CHAPAS — As003 ────────────────────────┐  │
│  │ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │  │
│  │ │ 1500×5000│  │ 1500×6000│  │ 1500×7000│  │1500×8M │ │  │
│  │ │ 4 chapas │  │ 3 chapas │  │ 2 chapas │  │2 chapas│ │  │
│  │ │ 76.2%    │  │ 81.9%    │  │ 85.3% ⭐ │  │ 79.1%  │ │  │
│  │ │ R$ 4.856 │  │ R$ 5.828 │  │ R$ 3.399 │  │R$ 3.885│ │  │
│  │ │          │  │          │  │ ✓ MELHOR │  │        │ │  │
│  │ │  [Usar]  │  │  [Usar]  │  │  [Usar]  │  │ [Usar] │ │  │
│  │ └──────────┘  └──────────┘  └──────────┘  └────────┘ │  │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Felipe escolhe → R$ X vai pro custo "Revestimento"         │
└─────────────────────────────────────────────────────────────┘
```

### Visualização do layout (igual à screenshot do usuário)

Após escolher o tamanho:

```
┌─────────────────────────── Chapa 1 (85.3% aproveitamento) ──┐
│                                                              │
│  ┌────────────────┬────────────────────┬───┐                │
│  │                │                    │   │                │
│  │  TAMPA MAIOR   │    TAMPA MAIOR     │ s │                │
│  │  1233×3232     │    1233×3232       │ o │                │
│  │                │                    │ b │                │
│  │                │                    │ r │                │
│  ├────────────────┴────────────────────┤ a │                │
│  │  TAMPA BOR CAVA       1648×3232     │   │                │
│  └────────────────────────────────────────┘                  │
│                                                              │
│  Peças: 8     Usada: 9.775 m²    Sobra: 1.490 m²            │
└──────────────────────────────────────────────────────────────┘
```

Renderizado com **SVG inline** — sem dependências externas, leve.

---

## 🛠 Arquitetura (proposta)

### Novo módulo: `38-chapas-otimizador.js`
Motor puro de aproveitamento. Sem UI, só lógica.

```javascript
window.ChapasOtimizador = (function () {
  /**
   * Otimiza um conjunto de peças em chapas-mãe.
   *
   * @param {Array} pecas - lista de peças. Cada peça:
   *   { id, label, w, h, qty, podeRotacionar, cor }
   * @param {Object} chapaMae - chapa-mãe disponível:
   *   { w, h, cor, kerf, margem, permiteRotacao, temVeio }
   * @returns {Object}
   *   { chapas: [...], qtdChapas, aproveitamentoMedio, sobraTotal }
   */
  function otimizar(pecas, chapaMae) { /* ... */ }

  /**
   * Roda otimização em N tamanhos e retorna o melhor (ou todos).
   */
  function compararTamanhos(pecas, listaChapas) { /* ... */ }

  return { otimizar, compararTamanhos };
})();
```

### Motor de geração de peças por modelo
Cada modelo de porta (1 = Cava, 2 = Cava+Friso, etc) gera SUAS peças de chapa.

Cria-se: `38-pecas-chapa-porta-externa.js` — análogo ao `31-perfis-porta-externa.js` mas para chapas. Função `gerarPecasChapa(item)` retorna a lista de cortes pra cada item.

### UI no orçamento: nova função em `12-orcamento.js`
- `renderLevSuperficiesTab(container)` — render da aba
- Usa cores `corExterna` e `corInterna` do item para agrupar peças por cor
- Roda `ChapasOtimizador.compararTamanhos()` em cada cor
- Renderiza cards de comparação dos 4 tamanhos
- Ao escolher → grava `versao.escolhaChapas[itemIdx][cor] = tamanhoEscolhido`
- Calcula custo total e injeta em `versao.custoFab.total_revestimento` (já existe campo)

### CSS novo: `15-lev-superficies.css`
Layout 2D com SVG, cards de comparação, tabelas de peças.

---

## ⚙ Onde se conecta com o resto do sistema

### Cadastros > Superfícies (já existe)
Hoje tem 249 chapas em 4 categorias: ACM, HPL, Vidro, Alumínio Maciço. Cada chapa tem `descricao`, `preco`, `categoria`. **Falta** adicionar:
- `largura` (ex: 1500 mm)
- `altura` (ex: 5000, 6000, 7000, 8000 mm)
- `tem_veio` (boolean)

Vou propor migração: ao detectar chapa sem `largura/altura`, popular do nome (regex sobre `descricao`) ou marcar como "configuração pendente".

### Caracteristicas do Item — campos já presentes
- `revestimento`: tipo (ACM 4mm, HPL 4mm, Vidro 8mm, etc) — usa pra filtrar chapas no cadastro
- `corExterna`: cor (ex: "As003 - Wood Maple Alusense LDPE")
- `corInterna`: idem para face interna

### Custo Fab/Inst
- Campo `total_revestimento` (criado na sessão 2026-05) recebe o resultado do otimizador.
- Hint do campo: "chapas / superficies (auto futuro)" — vai virar AUTO depois.

### Lev. Acessórios (existe)
Tem fitas de borda (Q-LON, baguete) e parafusos. **Não muda** — paralelo ao Lev. Superfícies.

---

## 📋 Roadmap de implementação (proposto, 6 etapas)

| Etapa | O que entrega | Estimativa |
|-------|---------------|------------|
| **1. Schema chapas-mãe** | Adicionar `largura/altura/tem_veio` em Cadastros > Superfícies. UI pra editar. Migração defensiva. | 1 rodada |
| **2. Motor `38-chapas-otimizador.js`** | Algoritmo Guillotine BL puro. Testes node sem UI. | 2 rodadas |
| **3. Geração peças por modelo** | `38-pecas-chapa-porta-externa.js` para Modelo 1 (Cava). Lista de peças igual à do Cut2D do usuário. | 2 rodadas |
| **4. UI Lev. Superfícies** | Tabela de peças + 4 cards de comparação. Render por cor. | 2 rodadas |
| **5. Visualização SVG do layout** | Desenho 2D das chapas com peças posicionadas, cores, dimensões. Igual à screenshot 3. | 1 rodada |
| **6. Conectar custo** | Botão "Usar resultado" → grava escolha + custo vai pro `total_revestimento`. | 1 rodada |

**Total estimado**: 9 rodadas. Posso entregar incremental: cada etapa funcional sozinha.

---

## ❓ Perguntas para o Felipe antes de começar

1. **Lista de peças por modelo**: tenho o exemplo do Modelo 1 (Cava) na screenshot:
   - TAMPA MAIOR (2x), TAMPA BOR CAVA (2x), TAMPA CAVA (4x), CAVA (2x), ACAB LAT 1/2/Z (2x cada),
   - U PORTAL (1x), BAT 01/02/03 (2x cada), TAP FURO (3x), FIT ACAB ME/MA/FITA (2x cada)
   - **Confirma que essa é a lista oficial do Modelo Cava?** Ou tem variação?

2. **Modelo 2, 3, 4...**: cada modelo (do 1 ao 23) tem SUA lista de peças? Posso começar só com Modelo 1 e expandir?

3. **Kerf padrão**: 4mm está OK pra serra Projetta? Ou outro valor?

4. **Margem da chapa**: 10mm de borda morta está OK?

5. **Veio do material**: tem materiais com veio na linha Projetta (As003 Wood Maple, por exemplo)? Se sim, **as peças NÃO devem rotacionar** quando a cor tem veio. Posso marcar veio diretamente na descrição da chapa?

6. **Custo unitário**: a chapa-mãe vem com `preco` em Cadastros > Superfícies. É o preço POR CHAPA INTEIRA, certo? Não por m², não por kg?

7. **Múltiplas cores no mesmo item**: porta com Cor Externa A + Cor Interna B usa **chapas diferentes** (1 conjunto de peças por cor)? Confirmando o entendimento.

8. **Sobras**: quer que o sistema **registre sobras** das chapas pra reuso futuro (estoque de retalhos)?  Otimize Nesting tem isso. Pode ficar na fase 2.

---

## 📦 Output esperado da Etapa 1 (próxima rodada)

Não codifico nada ainda. **Após você responder as perguntas acima**, começo na próxima rodada com a Etapa 1: schema das chapas-mãe.

Se preferir, posso implementar diretamente uma **versão MVP** (Etapas 2+3+4 simultâneas) com hardcoded para Modelo 1 e expansão depois — me avisa qual fluxo prefere.
