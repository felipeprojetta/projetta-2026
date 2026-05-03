/* 35-regras.js — Modulo Regras e Logicas (Cadastros).
   Felipe (req: aba dentro de Cadastros): cada logica de calculo (Perfis,
   Chapas, etc) aparece numa sub-aba propria, editavel. Variaveis
   (FGA=10, ESPPIV=28, etc) podem ser alteradas e o motor le do storage
   no proximo recalculo. Orcamentos ja' fechados (com snapshot) NAO sao
   afetados — so' os novos.

   Estado nesta versao:
     - Variaveis: TOTALMENTE editaveis e persistidas.
     - Formulas: mostradas em READ-ONLY com sintaxe destacada (Felipe pode
       inspecionar). Edicao programatica de formula vai ser implementada
       quando definirmos o parser de expressao (proxima sessao).

   Persistencia: Storage.scope('cadastros').get('regras_variaveis_porta_externa')
   Estrutura: { '76': { FGA, ESPPIV, ... }, '101': { FGA, ESPPIV, ... } }
*/

const Regras = (() => {
  const store = Storage.scope('cadastros');

  // Sub-abas (cada logica de calculo do sistema)
  const SUBABAS = [
    { id: 'porta-externa', label: 'Calculo de Perfis · Porta Externa' },
    { id: 'chapas',        label: 'Calculo de Chapas' },
    { id: 'frete',         label: 'Frete Internacional' },
    { id: 'comissao',      label: 'Comissoes' },
  ];

  // Estado da sub-aba ativa (compartilhado entre renders)
  const UI = { subaba: 'porta-externa' };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmtBR(n) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ============================================================
  // VARIAVEIS — Le do storage com fallback no DEFAULT do motor
  // ============================================================
  function getDefaults() {
    return (window.PerfisPortaExterna && window.PerfisPortaExterna._VARS_FAM_DEFAULT) || {
      '76':  { ESPPIV:28, TRANSPIV:8, FGLD:10, FGLE:10, FGA:10, TUBLPORTAL:38.1,  TUBLPORTA:76.2,  VEDPT:35 },
      '101': { ESPPIV:28, TRANSPIV:8, FGLD:10, FGLE:10, FGA:10, TUBLPORTAL:50.8,  TUBLPORTA:101.6, VEDPT:35 },
    };
  }
  function getVarsAtuais() {
    const def = getDefaults();
    const salvas = store.get('regras_variaveis_porta_externa');
    if (salvas && salvas['76'] && salvas['101']) {
      return {
        '76':  Object.assign({}, def['76'],  salvas['76']),
        '101': Object.assign({}, def['101'], salvas['101']),
      };
    }
    return def;
  }
  function salvarVars(vars) {
    store.set('regras_variaveis_porta_externa', vars);
  }
  function resetarVars() {
    store.set('regras_variaveis_porta_externa', null);
  }

  // ============================================================
  // Felipe (sessao 2026-05): VARIAVEIS DO CALCULO DE CHAPAS
  // ============================================================
  // Separadas das variaveis de PERFIS porque sao um conceito
  // diferente (refilado da chapa, margem de seguranca, etc).
  // Storage proprio: 'regras_variaveis_chapas'.
  //
  // Hoje so' tem REF (refilado, default 20mm). Conforme Felipe
  // for especificando outras peças, novas variaveis aparecem aqui.
  // ============================================================
  const VARS_CHAPAS_DEFAULT = {
    REF:            20,
    PORTAL_LD:      171.5,
    PORTAL_LE:      171.5,
    U_LARG_1F:      90,
    U_LARG_2F:      128,
    U_LARG_CENTRAL: 128,
    // Felipe (sessao 2026-05): variaveis do nesting (algoritmo BLF)
    // Felipe (sessao 27 fix): KERF_NEST default 0 — Felipe nao quer
    // perda de 4mm entre pecas no corte de chapa. Se quiser usar, edita
    // em Cadastros > Regras.
    KERF_NEST:      4,            // espessura disco da serra (mm) — MaxCut padrao
    APARAR_NEST:    5,            // margem de aparar a chapa (mm)
    MAX_GIROS_NEST: 6,            // niveis de varias fases
  };
  // Selects (texto) — METODO e DESPERDICIO
  const VARS_CHAPAS_DEFAULT_TEXTO = {
    METODO_NEST:      'multi_horiz',  // 'normal' | 'multi_horiz' | 'multi_vert'
    DESPERDICIO_NEST: 'inferior',     // 'inferior' | 'amplie'
  };
  const SIGNIFICADO_CHAPAS = {
    REF:            'Refilado (margem de descarte ao cortar peca da chapa)',
    PORTAL_LD:      'Ocupacao do PORTAL na lateral DIREITA — usado em larguraQuadro',
    PORTAL_LE:      'Ocupacao do PORTAL na lateral ESQUERDA — usado em larguraQuadro',
    U_LARG_1F:      'Ganho de largura util pelo lado da DOBRADICA — porta 1 folha',
    U_LARG_2F:      'Ganho de largura util pelo lado da DOBRADICA — porta 2 folhas',
    U_LARG_CENTRAL: 'Ganho de largura util do lado FECHADURA/CENTRAL',
    KERF_NEST:      'Espessura do disco da serra (KERF) — espaco entre pecas no corte',
    APARAR_NEST:    'Aparar chapa — margem de descarte na borda da chapa-mae',
    MAX_GIROS_NEST: 'Niveis de varias fases (numero maximo de giros por folha)',
  };
  const OPCOES_METODO = [
    { id: 'normal',      label: 'Normal — encaixe livre (BLF)' },
    { id: 'multi_horiz', label: 'Multiplos estagios — primeiro corte segue COMPRIMENTO' },
    { id: 'multi_vert',  label: 'Multiplos estagios — primeiro corte segue LARGURA' },
  ];
  const OPCOES_DESPERDICIO = [
    { id: 'inferior', label: 'Agrupado na parte inferior' },
    { id: 'amplie',   label: 'Amplie (espalhado entre pecas)' },
  ];

  function getVarsChapasAtuais() {
    const def = Object.assign({}, VARS_CHAPAS_DEFAULT, VARS_CHAPAS_DEFAULT_TEXTO);
    const salvas = store.get('regras_variaveis_chapas');
    if (salvas && typeof salvas === 'object') {
      return Object.assign({}, def, salvas);
    }
    return def;
  }
  function salvarVarsChapas(vars) {
    store.set('regras_variaveis_chapas', vars);
  }
  function resetarVarsChapas() {
    store.set('regras_variaveis_chapas', null);
  }

  // ============================================================
  // SIGNIFICADO DAS VARIAVEIS (pra Felipe entender no UI)
  // ============================================================
  const SIGNIFICADO = {
    FGA:        'Folga superior (entre folha e portal, no topo)',
    FGLD:       'Folga lateral direita',
    FGLE:       'Folga lateral esquerda',
    ESPPIV:     'Espessura do pivot',
    TRANSPIV:   'Transferencia do pivot (compensacao)',
    TUBLPORTAL: 'Espessura do tubo do portal (perfil P)',
    TUBLPORTA:  'Espessura do tubo da porta (perfil F)',
    VEDPT:      'Espessura da veda porta',
  };

  // ============================================================
  // FORMULAS — Felipe (do doc): separar 1 folha vs 2 folhas e mostrar
  // QUANTIDADES tambem (nao so' comprimentos). Cada cdor tem fórmula de
  // comprimento E formula de quantidade pra cada nFolhas.
  // Read-only nesta sessao. Edicao programatica vai vir depois com
  // parser de expressao.
  // ============================================================
  const FORMULAS = [
    {
      label: 'Altura Folha (PA_F)',
      codigo: 'PA-PA006F / PA-PA007F',
      comp1F: 'A − FGA − TUBLPORTAL − ESPPIV + TRANSPIV',
      qty1F:  '2',
      comp2F: 'A − FGA − TUBLPORTAL − ESPPIV + TRANSPIV',
      qty2F:  '4',
      explica: 'Altura da folha. Em 2 folhas o comprimento e o mesmo, dobra apenas a quantidade.',
    },
    {
      label: 'Largura Inferior & Superior',
      codigo: 'PA-76X76X2.0 / PA-101X101X2.5',
      comp1F: 'L − FGLD − FGLE − 171,7 − 171,5',
      qty1F:  '2',
      comp2F: '(L − FGLD − FGLE − 171,7 − 171,5 − 235) ÷ 2',
      qty2F:  '4',
      explica: 'Em 2 folhas a formula desconta o encontro central de 235mm e divide por 2.',
    },
    {
      label: 'Travessa Horizontal',
      codigo: 'PA-76X38X1.98 / PA-101X51X2',
      comp1F: 'L − FGLD − FGLE − 171,7 − 171,5',
      qty1F:  'qtdTH(altura) — varia por altura',
      comp2F: '(L − FGLD − FGLE − 171,7 − 171,5 − 235) ÷ 2',
      qty2F:  'qtdTH(altura) × 2',
      explica: 'Felipe (atualizacao): a Travessa Horizontal usa a MESMA formula da Largura Inferior & Superior (1F ou 2F). Em 2 folhas o comprimento divide por 2 e quantidade dobra.',
    },
    {
      label: 'Travessa Vertical',
      codigo: 'PA-76X38X1.98 / PA-101X51X2',
      comp1F: 'A − FGA − TUBLPORTAL − ESPPIV − VEDPT × 2 − TUBLPORTA × 2',
      qty1F:  'qtdTV(modelo, largura, nFolhas)',
      comp2F: 'A − FGA − TUBLPORTAL − ESPPIV − VEDPT × 2 − TUBLPORTA × 2',
      qty2F:  'qtdTV(modelo, largura, nFolhas)',
      explica: 'Felipe (sessao 2026-05): regra correta. (1) Cava simples = 2 travessas obrigatorias por folha. (2) Cava dupla (modelo 9) = 4 travessas obrigatorias por folha. (3) Bonus pela LARGURA TOTAL: L > 1500 → +1 adicional; L > 2500 → +2 adicionais. Multiplica obrigatorias por nFolhas; bonus de largura nao multiplica.',
    },
    {
      label: 'Veda Porta',
      codigo: 'PA-PA006V / PA-PA007V',
      comp1F: 'LARG_INT_FOLHA + 110 + 110',
      qty1F:  '2',
      comp2F: 'LARG_INT_FOLHA + 110 + 110',
      qty2F:  '4',
      explica: 'Largura da folha + sobras laterais. Inferior e superior, 2 por folha.',
    },
    {
      label: 'Canal Escova (CHR908)',
      codigo: 'PA-CHR908',
      comp1F: 'LARG_INT_FOLHA + 110 + 110 + 10',
      qty1F:  '2',
      comp2F: 'LARG_INT_FOLHA + 110 + 110 + 10',
      qty2F:  '4',
      explica: 'Igual Veda Porta + 10mm de folga. Inferior e superior, 2 por folha.',
    },
    {
      label: 'Cava (Tubo)',
      codigo: 'PA-38X38X1.58',
      comp1F: 'TRAV_VERT − 30',
      qty1F:  '2 (so em modelos com cava)',
      comp2F: 'TRAV_VERT − 30',
      qty2F:  '4 (so em modelos com cava)',
      explica: 'Tubo de aluminio que vira cava de fechadura. So aplica em modelos com cava.',
    },
    {
      label: 'Altura Portal',
      codigo: 'PA-PA006P / PA-PA007P',
      comp1F: 'A − FGA − TUBLPORTAL − ESPACM',
      qty1F:  '2',
      comp2F: 'A − FGA − TUBLPORTAL − ESPACM',
      qty2F:  '2',
      explica: 'ESPACM vem do revestimento (ACM 4mm, HPL 4mm, etc). 1F e 2F: 2 alturas.',
    },
    {
      label: 'Largura Portal',
      codigo: 'PA-76X38X1.98 / PA-101X51X2 (travHor)',
      comp1F: 'L − FGLD − FGLE',
      qty1F:  '1',
      comp2F: 'L − FGLD − FGLE',
      qty2F:  '1',
      explica: 'Largura total do portal. 1 corte unico em 1F e 2F.',
    },
    {
      label: 'Travessa Portal',
      codigo: 'PA-35X25-OLHAL',
      comp1F: 'LAR_PORTAL − 93',
      qty1F:  'max(2, floor(altura/2000) + 1)',
      comp2F: 'LAR_PORTAL − 93',
      qty2F:  'max(2, floor(altura/2000) + 1)',
      explica: 'Travessas internas do portal. Quantidade aumenta a cada 2000mm de altura.',
    },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  function render(container) {
    const subabasHtml = SUBABAS.map(s =>
      `<button type="button" class="reg-subtab ${s.id === UI.subaba ? 'is-active' : ''}" data-subaba="${s.id}">${escapeHtml(s.label)}</button>`
    ).join('');

    container.innerHTML = `
      <div class="reg-wrap">
        <div class="reg-subtabs">${subabasHtml}</div>
        <div class="reg-content" id="reg-content"></div>
      </div>
    `;

    container.querySelectorAll('.reg-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.subaba = btn.dataset.subaba;
        render(container);
      });
    });

    const mount = container.querySelector('#reg-content');
    if (UI.subaba === 'porta-externa') renderPortaExterna(mount);
    else if (UI.subaba === 'chapas')   renderCalculoChapas(mount);
    else renderEmDesenvolvimento(mount, UI.subaba);
  }

  function renderEmDesenvolvimento(mount, subId) {
    const labels = {
      'frete':    'Frete Internacional',
      'comissao': 'Comissoes',
    };
    mount.innerHTML = `
      <div class="info-banner">
        <span class="t-strong">${escapeHtml(labels[subId] || subId)}:</span>
        sub-aba reservada. Felipe me passa as regras e eu implemento separadamente,
        sem afetar outras logicas.
      </div>
      <div class="placeholder">
        <div class="icon-big">⚙️</div>
        <h3>Aguardando especificacao</h3>
        <p>Quando voce me passar a logica desta sub-aba, ela vira editavel aqui (igual a de Porta Externa).</p>
      </div>
    `;
  }

  /**
   * Felipe (sessao 2026-05): Sub-aba "Calculo de Chapas".
   * Mostra:
   *   1. Variavel REF (refilado) — editavel.
   *   2. Tabela de pecas UNIVERSAIS 1 folha — mesma da planilha do Felipe.
   *      Read-only por enquanto, edicoes vem em proximas rodadas.
   *   3. Tabela de pecas EXCLUSIVAS do Modelo 01 — fórmulas literais.
   *
   * Conforme outros modelos forem implementados (Modelo 02, 03... e
   * 2 folhas), novas tabelas aparecem aqui sem mexer nas outras.
   */
  function renderCalculoChapas(mount) {
    const vc = getVarsChapasAtuais();

    // Variaveis do QUADRO (geometria das pecas)
    const varsQuadro = ['REF', 'PORTAL_LD', 'PORTAL_LE', 'U_LARG_1F', 'U_LARG_2F', 'U_LARG_CENTRAL'];
    const linhasVarsQuadro = varsQuadro.map(k => {
      const valorAtual = vc[k];
      const valorDefault = VARS_CHAPAS_DEFAULT[k];
      const editado = Number(valorAtual) !== Number(valorDefault);
      return `
        <tr>
          <td class="reg-var-cod">${escapeHtml(k)}</td>
          <td class="reg-var-sig">${escapeHtml(SIGNIFICADO_CHAPAS[k] || '—')}</td>
          <td class="num">
            <input type="number" step="0.01" data-vchapa="${k}" value="${escapeHtml(String(valorAtual))}" />
          </td>
          <td class="num reg-var-default">${escapeHtml(String(valorDefault))} mm</td>
          <td>${editado ? '<span class="reg-var-tag-editado">editado</span>' : '<span class="reg-var-tag-padrao">padrao</span>'}</td>
        </tr>`;
    }).join('');

    // Variaveis do NESTING (aproveitamento)
    const varsNestNum = ['KERF_NEST', 'APARAR_NEST', 'MAX_GIROS_NEST'];
    const linhasNestNum = varsNestNum.map(k => {
      const valorAtual = vc[k];
      const valorDefault = VARS_CHAPAS_DEFAULT[k];
      const editado = Number(valorAtual) !== Number(valorDefault);
      const unidade = (k === 'MAX_GIROS_NEST') ? '' : 'mm';
      return `
        <tr>
          <td class="reg-var-cod">${escapeHtml(k)}</td>
          <td class="reg-var-sig">${escapeHtml(SIGNIFICADO_CHAPAS[k] || '—')}</td>
          <td class="num">
            <input type="number" step="0.5" data-vchapa="${k}" value="${escapeHtml(String(valorAtual))}" />
          </td>
          <td class="num reg-var-default">${escapeHtml(String(valorDefault))} ${unidade}</td>
          <td>${editado ? '<span class="reg-var-tag-editado">editado</span>' : '<span class="reg-var-tag-padrao">padrao</span>'}</td>
        </tr>`;
    }).join('');

    // Selects: METODO e DESPERDICIO
    const metodoAtual = vc.METODO_NEST || 'multi_horiz';
    const desperdicioAtual = vc.DESPERDICIO_NEST || 'inferior';
    const optMetodo = OPCOES_METODO.map(o =>
      `<option value="${o.id}" ${o.id === metodoAtual ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
    ).join('');
    const optDesp = OPCOES_DESPERDICIO.map(o =>
      `<option value="${o.id}" ${o.id === desperdicioAtual ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
    ).join('');

    // Felipe (sessao 2026-05): pecas UNIVERSAIS 1 folha — implementadas
    // em scripts/38-chapas-porta-externa.js. Tabela read-only espelhando
    // o que o motor calcula. Quando Felipe pedir edicao, viramos
    // editavel (tipo as variaveis FGA/FGLD/etc da Porta Externa).
    const universais1F = [
      { codigo: 'ACAB_LAT_1',         larg76: '70 + 19',                                  larg101: '70 + 19',                                comp: 'alturaQuadro',         qtd: '1', cat: 'porta'  },
      { codigo: 'ACAB_LAT_2',         larg76: '70 + REF',                                 larg101: '70 + REF',                               comp: 'alturaQuadro',         qtd: '1', cat: 'porta'  },
      { codigo: 'ACAB_LAT_Z',         larg76: '18.5 + 53.5 + 13',                         larg101: '18.5 + 78.5 + 13',                       comp: 'alturaQuadro',         qtd: '1', cat: 'porta'  },
      { codigo: 'U_PORTAL (cor unica)',     larg76: '42 + 86 + 86',                       larg101: '55 + 111 + 55',                          comp: 'L − FGLD − FGLE',      qtd: '1 (so externo)', cat: 'portal' },
      { codigo: 'U_PORTAL (cores ≠)',       larg76: '42 + 43 + 86',                       larg101: '55 + 55 + 55',                           comp: 'L − FGLD − FGLE',      qtd: '1 por lado',     cat: 'portal' },
      { codigo: 'BAT_01',             larg76: '18.5 + 24',                                larg101: '18.5 + 23',                              comp: 'altura + 100',         qtd: '1', cat: 'portal' },
      { codigo: 'BAT_02_Z',           larg76: '56 + 19',                                  larg101: '33 + 19',                                comp: 'altura + 100',         qtd: '1', cat: 'portal' },
      { codigo: 'BAT_03',             larg76: '62 + 20',                                  larg101: '61 + 20',                                comp: 'altura + 100',         qtd: '1', cat: 'portal' },
      { codigo: 'TAP_FURO',           larg76: '54 + 2 × REF',                             larg101: '79 + 2 × REF',                           comp: 'altura + 100',         qtd: '2', cat: 'portal' },
      { codigo: 'FIT_ACAB_ME',        larg76: '36.5 + 2 × REF',                           larg101: '36.5 + 2 × REF',                         comp: 'altura + 100',         qtd: '2', cat: 'portal' },
      { codigo: 'FIT_ACAB_MA',        larg76: '74.5 + 2 × REF',                           larg101: '74.5 + 2 × REF',                         comp: 'altura + 100',         qtd: '2', cat: 'portal' },
      { codigo: 'FIT_ACAB_LAR_FITA',  larg76: '61 + 2 × REF',                             larg101: '61 + 2 × REF',                           comp: 'largura + 100',        qtd: '2', cat: 'portal' },
      { codigo: 'ALISAR_ALTURA',      larg76: '(esp_parede − 80)/2 + 5 + larg_alisar + 2 × REF', larg101: 'idem',                              comp: 'altura + larg_alisar', qtd: '2', cat: 'portal' },
      { codigo: 'ALISAR_LARGURA',     larg76: '(esp_parede − 80)/2 + 5 + larg_alisar + 2 × REF', larg101: 'idem',                              comp: 'largura + 100',        qtd: '1', cat: 'portal' },
    ];

    const linhasUniversais = universais1F.map(p => `
      <tr class="reg-form-cat-${p.cat}">
        <td class="reg-form-cod">${escapeHtml(p.codigo)}</td>
        <td><code>${escapeHtml(p.larg76)}</code></td>
        <td><code>${escapeHtml(p.larg101)}</code></td>
        <td><code>${escapeHtml(p.comp)}</code></td>
        <td class="reg-form-qty">${escapeHtml(p.qtd)}</td>
        <td>${p.cat === 'porta' ? 'Porta' : 'Portal'}</td>
      </tr>`).join('');

    // Felipe (sessao 2026-05): pecas EXCLUSIVAS do Modelo 01 (Cava).
    // Implementadas em scripts/38-chapas-porta-externa.js linhas 304+.
    const modelo01 = [
      { codigo: 'O1_CAVA',             larg: '3 × REF + dBordaCava − 2',                       comp: 'alturaQuadro',     qtd: '1', cor: 'corCava' },
      { codigo: 'O1_L_DA_CAVA',        larg: 'tamanhoCava + 90',                               comp: 'distanciaBordaCava', qtd: '2', cor: 'corCava' },
      { codigo: 'O1_TAMPA_MAIOR',      larg: 'larguraQuadro − dBordaCava − tamCava + 2 × REF − 2', comp: 'alturaQuadro',     qtd: '1', cor: 'cor do lado' },
      { codigo: 'O1_TAMPA_BORDA_CAVA', larg: 'dBordaCava + 2 × REF − 2',                       comp: 'alturaQuadro',     qtd: '1', cor: 'corCava' },
    ];
    const linhasModelo01 = modelo01.map(p => `
      <tr>
        <td class="reg-form-cod">${escapeHtml(p.codigo)}</td>
        <td><code>${escapeHtml(p.larg)}</code></td>
        <td><code>${escapeHtml(p.comp)}</code></td>
        <td class="reg-form-qty">${escapeHtml(p.qtd)}</td>
        <td>${escapeHtml(p.cor)}</td>
      </tr>`).join('');

    mount.innerHTML = `
      <div class="info-banner">
        <span class="t-strong">Calculo de Chapas:</span>
        variaveis e formulas usadas no <b>Levantamento de Superficies</b>
        (motor de aproveitamento de chapas-mae).
      </div>

      <div class="reg-section">
        <div class="reg-section-title">Variaveis do QUADRO (geometria das pecas)</div>
        <p class="reg-section-help">
          Definem o tamanho do <b>quadro</b> (limite das pecas de chapa) em funcao
          da largura/altura da porta. Editar aqui muda imediatamente as dimensoes
          calculadas pelas pecas.
        </p>
        <table class="reg-vars-table">
          <thead>
            <tr>
              <th style="min-width:110px;">Variavel</th>
              <th>Significado</th>
              <th class="num" style="min-width:120px;">Valor atual</th>
              <th class="num" style="min-width:110px;">Padrao</th>
              <th style="min-width:90px;">Status</th>
            </tr>
          </thead>
          <tbody>${linhasVarsQuadro}</tbody>
        </table>
      </div>

      <div class="reg-section">
        <div class="reg-section-title">Configuracoes do NESTING (aproveitamento de chapas)</div>
        <p class="reg-section-help">
          Parametros do algoritmo de aproveitamento que decide quantas chapas-mae
          comprar e como cortar. <b>Metodo</b> de otimizacao define a estrategia
          de corte. <b>KERF</b> e' a espessura do disco da serra entre pecas.
          <b>Aparar chapa</b> e' a margem de descarte na borda. Mude com cuidado.
        </p>

        <table class="reg-vars-table">
          <thead>
            <tr>
              <th style="min-width:110px;">Variavel</th>
              <th>Significado</th>
              <th class="num" style="min-width:120px;">Valor atual</th>
              <th class="num" style="min-width:110px;">Padrao</th>
              <th style="min-width:90px;">Status</th>
            </tr>
          </thead>
          <tbody>${linhasNestNum}</tbody>
        </table>

        <div class="reg-nest-selects">
          <div class="reg-nest-select-row">
            <label class="reg-nest-select-label">
              <span class="reg-nest-select-title">Metodo de Otimizacao</span>
              <span class="reg-nest-select-help">Como organizar as pecas dentro da chapa-mae.</span>
            </label>
            <select class="reg-nest-select" data-vchapa-text="METODO_NEST">
              ${optMetodo}
            </select>
          </div>
          <div class="reg-nest-select-row">
            <label class="reg-nest-select-label">
              <span class="reg-nest-select-title">Definicao do Desperdicio</span>
              <span class="reg-nest-select-help">Onde colocar a sobra (area amarela no layout).</span>
            </label>
            <select class="reg-nest-select" data-vchapa-text="DESPERDICIO_NEST">
              ${optDesp}
            </select>
          </div>
        </div>
      </div>

      <div class="reg-actions-bar">
        <button type="button" class="univ-btn-save" id="reg-btn-save-chapas">💾 Salvar Variaveis</button>
        <button type="button" class="reg-btn-reset" id="reg-btn-reset-chapas">↺ Restaurar Padroes</button>
        <span class="reg-status" id="reg-status-chapas"></span>
      </div>

      <div class="reg-section">
        <div class="reg-section-title">Formula do QUADRO (limite das pecas de chapa)</div>
        <p class="reg-section-help">
          O <b>quadro</b> e' a area retangular interna da folha onde as
          pecas de chapa (revestimento) sao posicionadas. Suas dimensoes
          sao calculadas em funcao da largura/altura da porta + variaveis
          de PERFIS (ver sub-aba Porta Externa) + variaveis de CHAPAS
          (PORTAL_LD/LE/U_LARG_*).
        </p>
        <table class="reg-formulas-table">
          <thead>
            <tr>
              <th>Dimensao</th>
              <th>1 Folha</th>
              <th>2 Folhas</th>
              <th>Observacao</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="reg-form-cod">alturaQuadro</td>
              <td><code>A − FGA − TUBLPORTAL − ESPPIV + TRANSPIV</code></td>
              <td><code>A − FGA − TUBLPORTAL − ESPPIV + TRANSPIV</code></td>
              <td class="reg-form-obs">Igual em 1F e 2F. <code>A</code> = altura da porta.</td>
            </tr>
            <tr>
              <td class="reg-form-cod">larguraQuadro</td>
              <td><code>L − FGLD − FGLE − PORTAL_LD − PORTAL_LE + U_LARG_1F + U_LARG_CENTRAL</code></td>
              <td><code>L − FGLD − FGLE − PORTAL_LD − PORTAL_LE + U_LARG_2F + U_LARG_CENTRAL</code></td>
              <td class="reg-form-obs">2 folhas: largura TOTAL — divide por 2 pra ter cada folha.</td>
            </tr>
          </tbody>
        </table>
        <p class="reg-section-help" style="margin-top:8px;">
          <b>Com defaults atuais:</b><br>
          alturaQuadro (familia 76)  = A − 10 − 38.1 − 28 + 8 = <b>A − 68.1</b><br>
          alturaQuadro (familia 101) = A − 10 − 50.8 − 28 + 8 = <b>A − 80.8</b><br>
          larguraQuadro (1 folha)    = L − 10 − 10 − 171.5 − 171.5 + 90 + 128 = <b>L − 145</b><br>
          larguraQuadro (2 folhas)   = L − 10 − 10 − 171.5 − 171.5 + 128 + 128 = <b>L − 107</b>
        </p>
      </div>

      <div class="reg-section">
        <div class="reg-section-title">Pecas Universais — 1 Folha (todos os modelos)</div>
        <p class="reg-section-help">
          Aparecem em <b>todos os modelos</b> de porta com 1 folha (Modelo 01,
          02, 03, ..., 10, 11, 23). Variam por familia (PA-006F = altura
          &lt; 4000mm; PA-007F = altura ≥ 4000mm).
        </p>
        <table class="reg-formulas-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Largura PA-006F (mm)</th>
              <th>Largura PA-007F (mm)</th>
              <th>Comprimento (mm)</th>
              <th>Qtd</th>
              <th>Categoria</th>
            </tr>
          </thead>
          <tbody>${linhasUniversais}</tbody>
        </table>
      </div>

      <div class="reg-section">
        <div class="reg-section-title">Modelo 01 (Cava) — 1 Folha · pecas exclusivas</div>
        <p class="reg-section-help">
          Pecas que aparecem <b>apenas no Modelo 01</b>. Somam com as
          universais acima. As pecas da CAVA usam <code>corCava</code>
          (se preenchida no item) — caso contrario, herdam a cor do lado.
        </p>
        <table class="reg-formulas-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Largura (mm)</th>
              <th>Comprimento (mm)</th>
              <th>Qtd</th>
              <th>Cor da peca</th>
            </tr>
          </thead>
          <tbody>${linhasModelo01}</tbody>
        </table>
      </div>

      <div class="reg-section">
        <div class="reg-section-title">Modelos pendentes</div>
        <p class="reg-section-help">
          Modelos <b>02, 03, ..., 09, 10 (lisa só TAMPA), 11, ..., 23</b>:
          aguardando Felipe enviar a lista de pecas + formulas.
          Modelo 01 com <b>2 folhas</b>: idem.
          Quando chegar, basta adicionar uma nova tabela aqui sem mexer
          nas outras.
        </p>
      </div>
    `;

    // Bind do salvar
    const inputsChapas = mount.querySelectorAll('input[data-vchapa]');
    const selectsChapas = mount.querySelectorAll('select[data-vchapa-text]');
    const saveBtn = mount.querySelector('#reg-btn-save-chapas');
    const status  = mount.querySelector('#reg-status-chapas');
    const resetBtn = mount.querySelector('#reg-btn-reset-chapas');
    let dirty = false;
    function setDirty(v) {
      dirty = v;
      if (saveBtn) {
        saveBtn.classList.toggle('is-dirty', v);
        saveBtn.textContent = v ? '💾 Salvar Variaveis (mudancas pendentes)' : '✓ Tudo salvo';
      }
    }
    setDirty(false);
    inputsChapas.forEach(inp => inp.addEventListener('input', () => setDirty(true)));
    selectsChapas.forEach(sel => sel.addEventListener('change', () => setDirty(true)));

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const novoChapas = Object.assign({}, VARS_CHAPAS_DEFAULT, VARS_CHAPAS_DEFAULT_TEXTO);
        inputsChapas.forEach(inp => {
          const k = inp.dataset.vchapa;
          const v = parseFloat(String(inp.value).replace(',', '.'));
          if (!isNaN(v) && k) novoChapas[k] = v;
        });
        selectsChapas.forEach(sel => {
          const k = sel.dataset.vchapaText;
          if (k) novoChapas[k] = sel.value;
        });
        salvarVarsChapas(novoChapas);
        setDirty(false);
        if (status) {
          status.textContent = '✓ Variaveis salvas. Proximo recalculo de chapas usa os novos valores.';
          status.classList.add('is-ok');
          setTimeout(() => { status.textContent = ''; status.classList.remove('is-ok'); }, 4000);
        }
        if (window.showSavedDialog) window.showSavedDialog('Variaveis de chapas salvas com sucesso!');
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!confirm('Restaurar variaveis de chapas pros valores padrao?\n\nEsta acao nao afeta as variaveis de Porta Externa.')) return;
        resetarVarsChapas();
        renderCalculoChapas(mount);
      });
    }
  }

  function renderPortaExterna(mount) {
    const vars = getVarsAtuais();
    const def = getDefaults();
    const FAMS = ['76', '101'];

    const linhasFam = (fam) => {
      const v = vars[fam];
      const d = def[fam];
      const chaves = Object.keys(d);
      return chaves.map(k => {
        const valorAtual = v[k];
        const valorDefault = d[k];
        const editado = Number(valorAtual) !== Number(valorDefault);
        return `
          <tr>
            <td class="reg-var-cod">${escapeHtml(k)}</td>
            <td class="reg-var-sig">${escapeHtml(SIGNIFICADO[k] || '—')}</td>
            <td class="num">
              <input type="number" step="0.01" data-fam="${fam}" data-var="${k}" value="${escapeHtml(String(valorAtual))}" />
            </td>
            <td class="num reg-var-default">${escapeHtml(String(valorDefault))} mm</td>
            <td>${editado ? '<span class="reg-var-tag-editado">editado</span>' : '<span class="reg-var-tag-padrao">padrao</span>'}</td>
          </tr>
        `;
      }).join('');
    };

    // Felipe (do doc): mostra fórmulas separadas em colunas 1 Folha vs
    // 2 Folhas, com comprimento E quantidade. Read-only nesta sessao.
    const formulasTabelaHtml = `
      <table class="reg-formulas-table">
        <thead>
          <tr>
            <th rowspan="2" style="min-width:160px;">Item</th>
            <th rowspan="2" style="min-width:180px;">Codigo</th>
            <th colspan="2" class="reg-folhas-col-1f">Porta 1 Folha</th>
            <th colspan="2" class="reg-folhas-col-2f">Porta 2 Folhas</th>
            <th rowspan="2">Observacao</th>
          </tr>
          <tr>
            <th class="reg-folhas-col-1f">Comprimento</th>
            <th class="reg-folhas-col-1f">Quantidade</th>
            <th class="reg-folhas-col-2f">Comprimento</th>
            <th class="reg-folhas-col-2f">Quantidade</th>
          </tr>
        </thead>
        <tbody>
          ${FORMULAS.map(f => `
            <tr>
              <td class="reg-form-label">${escapeHtml(f.label)}</td>
              <td class="reg-form-cod">${escapeHtml(f.codigo)}</td>
              <td class="reg-folhas-col-1f"><code>${escapeHtml(f.comp1F)}</code></td>
              <td class="reg-folhas-col-1f reg-form-qty">${escapeHtml(f.qty1F)}</td>
              <td class="reg-folhas-col-2f"><code>${escapeHtml(f.comp2F)}</code></td>
              <td class="reg-folhas-col-2f reg-form-qty">${escapeHtml(f.qty2F)}</td>
              <td class="reg-form-obs">${escapeHtml(f.explica)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    mount.innerHTML = `
      <div class="info-banner">
        <span class="t-strong">Variaveis sao editaveis.</span>
        Mudancas afetam orcamentos NOVOS no proximo Recalcular. Versoes ja salvas
        ficam congeladas no valor antigo (snapshot na hora do salvamento).
      </div>

      <div class="reg-section">
        <div class="reg-section-title">Variaveis · Familia 76 (altura &lt; 4000mm)</div>
        <table class="reg-vars-table">
          <thead>
            <tr>
              <th style="min-width:110px;">Variavel</th>
              <th>Significado</th>
              <th class="num" style="min-width:120px;">Valor atual (mm)</th>
              <th class="num" style="min-width:110px;">Padrao</th>
              <th style="min-width:90px;">Status</th>
            </tr>
          </thead>
          <tbody>${linhasFam('76')}</tbody>
        </table>
      </div>

      <div class="reg-section">
        <div class="reg-section-title">Variaveis · Familia 101 (altura ≥ 4000mm)</div>
        <table class="reg-vars-table">
          <thead>
            <tr>
              <th style="min-width:110px;">Variavel</th>
              <th>Significado</th>
              <th class="num" style="min-width:120px;">Valor atual (mm)</th>
              <th class="num" style="min-width:110px;">Padrao</th>
              <th style="min-width:90px;">Status</th>
            </tr>
          </thead>
          <tbody>${linhasFam('101')}</tbody>
        </table>
      </div>

      <div class="reg-actions-bar">
        <button type="button" class="univ-btn-save" id="reg-btn-save">💾 Salvar Variaveis</button>
        <button type="button" class="reg-btn-reset" id="reg-btn-reset">↺ Restaurar Padroes</button>
        <span class="reg-status" id="reg-status"></span>
      </div>

      <div class="reg-section">
        <div class="reg-section-title">Formulas · Calculo de Cortes — separadas por N° de Folhas</div>
        <p class="reg-section-help">
          Cada item tem formula de <b>comprimento</b> e formula de <b>quantidade</b>, separadas
          por porta de 1 folha vs 2 folhas. As formulas usam as variaveis acima — alterar
          <code>FGA</code> de 10 pra 20 ja se refletira nos calculos do proximo orcamento.
        </p>
        <div class="reg-formulas-tabela-wrap">${formulasTabelaHtml}</div>
      </div>
    `;

    // Bind: marcar dirty ao mudar input
    const inputs = mount.querySelectorAll('input[data-fam][data-var]');
    let dirty = false;
    const saveBtn = mount.querySelector('#reg-btn-save');
    const status = mount.querySelector('#reg-status');

    function setDirty(v) {
      dirty = v;
      if (saveBtn) {
        saveBtn.classList.toggle('is-dirty', v);
        saveBtn.textContent = v ? '💾 Salvar Variaveis (mudancas pendentes)' : '✓ Tudo salvo';
      }
    }
    setDirty(false);

    inputs.forEach(inp => {
      inp.addEventListener('input', () => setDirty(true));
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const novo = { '76': {}, '101': {} };
        const def = getDefaults();
        // Copia DEFAULT pra garantir todas as chaves
        Object.keys(def['76']).forEach(k => novo['76'][k] = def['76'][k]);
        Object.keys(def['101']).forEach(k => novo['101'][k] = def['101'][k]);
        // Sobrescreve com valores do form
        inputs.forEach(inp => {
          const fam = inp.dataset.fam;
          const k = inp.dataset.var;
          const v = parseFloat(String(inp.value).replace(',', '.'));
          if (!isNaN(v) && novo[fam]) novo[fam][k] = v;
        });
        salvarVars(novo);

        setDirty(false);
        if (status) {
          status.textContent = '✓ Variaveis salvas. Proximo Recalcular vai usar os novos valores.';
          status.classList.add('is-ok');
          setTimeout(() => { status.textContent = ''; status.classList.remove('is-ok'); }, 4000);
        }
        if (window.showSavedDialog) window.showSavedDialog('Variaveis de calculo salvas com sucesso!');
      });
    }

    const resetBtn = mount.querySelector('#reg-btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!confirm('Restaurar TODAS as variaveis de Porta Externa pros valores padrao?\n\nIsso desfaz suas edicoes apenas nas variaveis de PERFIS. Variaveis de Chapas (REF) ficam intactas — restaure separadamente em Calculo de Chapas. Orcamentos ja salvos NAO sao afetados.')) return;
        resetarVars();
        renderPortaExterna(mount);
      });
    }
  }

  return { render };
})();

if (typeof window !== 'undefined') window.Regras = Regras;
