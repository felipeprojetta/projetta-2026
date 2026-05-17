/* ============================================================
   ORCAMENTO — modulo 12
   ----------------------------------------------------------------
   ETAPA 2 — INFRAESTRUTURA SILENCIOSA
   Sem UI ainda. Esta etapa expoe APENAS a camada de dados:
     - schema imutavel de Negocios → Opcoes → Versoes
     - CRUD basico
     - API publica (window.Orcamento) pros outros modulos consumirem
       (em especial o CRM, na Etapa 5, quando o botao "Montar Orcamento"
        chamar Orcamento.criarNegocio)

   Estrutura hierarquica:

   Negocio (1 por lead do CRM)
   └── Opcao A, B, C... (alternativas dentro do mesmo negocio)
       └── Versao 1, 2, 3... (revisoes da mesma opcao,
                              cada versao = SNAPSHOT IMUTAVEL
                              dos precos+inputs+calculos do momento)

   Persistencia: Storage.scope('orcamentos'), chave 'negocios'.
   Schema versionado em store.get('schema_version') para migracao futura.

   Isolado: prefixo CSS .orc-* (quando UI vier), Storage.scope proprio.
   ============================================================ */

const Orcamento = (() => {
  const store = Storage.scope('orcamentos');
  const SCHEMA_VERSION = 1;

  // ============================================================
  //                  CONSTANTES DE NEGOCIO
  // ============================================================

  // IRPJ + CSLL fixo (regime brasileiro)
  const IRPJ = 0.34;

  // Defaults dos 8 parametros do DRE.
  // Felipe pode editar caso a caso na aba Custo, ou trocar globalmente
  // num futuro modulo de Configuracoes.
  const PARAMS_DEFAULT = {
    overhead:    5,   // % rateio fixo (0-30)
    impostos:    18,  // % PIS + COFINS + ISS + ICMS (0-40)
    com_rep:     7,   // % comissao representante (0-20) — vem do cadastro de Reps
    com_rt:      5,   // % comissao RT/arquiteto (0-15)
    com_gest:    1,   // % comissao gestao interna (0-10)
    lucro_alvo:  15,  // % lucro liquido apos IRPJ+CSLL
    markup_desc: 20,  // % markup de desconto (auto: 15 se RT>=5%, 20 se RT<5%)
    desconto:    20,  // % desconto negociado (auto: mesma regra)
  };

  // Felipe sessao 31: 'internacional deixe r.t = 0 markup desconto = 0
  // desconto = 0 imposto = 0 Comissao Gest = 0 Lucro Alvo 45% Comissao RT = 0
  // Comissao Rep = 0'. Defaults aplicados quando lead.destinoTipo='internacional'
  // (exportacao nao tem PIS/COFINS/ISS/ICMS, sem comissao de representante
  // local, e Felipe quer lucro 45% pra absorver os custos internacionais).
  const PARAMS_DEFAULT_INTERNACIONAL = {
    overhead:    5,   // mantem rateio interno
    impostos:    0,   // exportacao tem aliquota zero
    com_rep:     0,   // sem rep nacional na exportacao
    com_rt:      0,   // sem RT/arquiteto
    com_gest:    0,   // sem gestao interna
    lucro_alvo: 45,   // lucro alvo Felipe definiu
    markup_desc: 0,   // sem markup de desconto na exportacao
    desconto:    0,   // sem desconto negociado
  };

  /**
   * Retorna o conjunto de defaults apropriado:
   * - Internacional se o lead ativo for internacional
   * - Nacional padrao caso contrario
   */
  function paramsDefaultParaLead() {
    try {
      const lead = (typeof lerLeadAtivo === 'function') ? lerLeadAtivo() : null;
      if (lead && lead.destinoTipo === 'internacional') {
        return Object.assign({}, PARAMS_DEFAULT_INTERNACIONAL);
      }
    } catch (e) { /* fallback abaixo */ }
    return Object.assign({}, PARAMS_DEFAULT);
  }

  // Tipos de item suportados. Por agora so porta_externa tem form completo;
  // os outros sao placeholder ate Felipe especificar a regra de cada um.
  const TIPOS_ITEM = [
    { id: 'porta_externa',       label: 'Porta Externa' },
    { id: 'porta_interna',       label: 'Porta Interna' },
    { id: 'fixo_acoplado',       label: 'Fixo Acoplado' },
    { id: 'revestimento_parede', label: 'Revestimento de Parede' },
    { id: 'pergolado',           label: 'Pergolado' },
  ];
  function labelTipo(id) {
    return TIPOS_ITEM.find(t => t.id === id)?.label || id;
  }

  // Etapas de fabricacao. Calculadas automaticamente pelas regras Felipe
  // (Portal/Quadro/Corte/Colagem/Conferencia) baseadas em altura/modelo/folhas/qtd.
  // O usuario ainda pode dar override manual por etapa.
  const HORAS_POR_DIA = 9;
  const ETAPAS_FAB = [
    // Felipe (do doc - msg "volte os itens que tinha"):
    // Portal, Folha da porta, Colagem, Corte e Usinagem, Conferencia e Embalagem
    { id: 'portal',           label: 'Portal' },
    { id: 'folha_porta',      label: 'Folha da porta' },
    { id: 'colagem',          label: 'Colagem' },
    { id: 'corte_usinagem',   label: 'Corte e Usinagem' },
    { id: 'conf_embalagem',   label: 'Conferencia e Embalagem' },
  ];

  // Conjuntos de modelos por categoria (passados pelo Felipe).
  // Modelo 08 e' tanto cava quanto ripado simultaneamente (cumulativo).
  const MODELOS_CAVA   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 19, 22, 24];
  const MODELOS_RIPADO = [8, 15, 20, 21];
  const MODELO_FRISO_HORIZONTAL = 6;

  function isCava(n)   { return MODELOS_CAVA.includes(Number(n)); }
  function isRipado(n) { return MODELOS_RIPADO.includes(Number(n)); }
  function isFrisoH(n) { return Number(n) === MODELO_FRISO_HORIZONTAL; }
  /** "Lisa" significa SEM cava — independente de ter ripado/frisos. */
  function isLisa(n)   { return n && !isCava(n); }

  /**
   * REGRA 1 — Portal (montagem do aro), em horas.
   *   altura ≤ 2500mm → 5h
   *   altura ≤ 3800mm → 7h
   *   altura ≤ 6500mm → 9h
   *   altura > 6500mm → 14h
   *   Se 2 folhas: +3h (não multiplica)
   *   × qtd de portas
   */
  function regraPortal(altura, nFolhas, qtdPortas) {
    if (!altura || !qtdPortas) return 0;
    let base;
    if (altura <= 2500)      base = 5;
    else if (altura <= 3800) base = 7;
    else if (altura <= 6500) base = 9;
    else                     base = 14;
    if (Number(nFolhas) === 2) base += 3;
    return base * qtdPortas;
  }

  /**
   * REGRA 2 — Quadro (montagem da folha), em horas.
   *   Mesmas faixas do Portal por altura.
   *   Se 2 folhas: ×2 (multiplica)
   *   × qtd de portas
   */
  function regraQuadro(altura, nFolhas, qtdPortas) {
    if (!altura || !qtdPortas) return 0;
    let base;
    if (altura <= 2500)      base = 5;
    else if (altura <= 3800) base = 7;
    else if (altura <= 6500) base = 9;
    else                     base = 14;
    if (Number(nFolhas) === 2) base *= 2;
    return base * qtdPortas;
  }

  /**
   * REGRA 3 — Corte e usinagem, em horas.
   *   qtd_chapas + 1   → porta lisa (default)
   *   qtd_chapas + 2   → porta ripado (modelos 08, 15, 20, 21)
   *   × qtd de portas (cada porta consome chapas separadamente)
   *   Tambem aplica × 2 quando 2 folhas (mais chapas).
   */
  function regraCorte(qtdChapas, modeloNumero, nFolhas, qtdPortas) {
    if (!qtdChapas || !qtdPortas) return 0;
    const base = Number(qtdChapas) + (isRipado(modeloNumero) ? 2 : 1);
    const fol = Number(nFolhas) === 2 ? base * 2 : base;
    return fol * qtdPortas;
  }

  /**
   * REGRA 4 — Colagem, em DIAS (horas = dias × 9 × qtd).
   *   PORTA CAVA   ≤ 2800 → 2 dias | ≤ 4000 → 3 dias | > 4000 → 4 dias
   *   PORTA LISA   = cava - 1 dia (mín 2)
   *   PORTA RIPADO = +1 dia até 4m, +2 dias acima de 4m (acumula)
   *   Modelo 06 (Frisos Horizontais) → +1 dia (acumula)
   *   Chapa Alusense → +1 dia (secagem) (acumula)
   *   Mínimo SEMPRE 2 dias.
   *   Se 2 folhas: ×2.
   *   × qtd de portas.
   */
  function regraColagem(altura, modeloNumero, nFolhas, qtdPortas, isAlusense) {
    if (!altura || !modeloNumero || !qtdPortas) return { dias: 0, horas: 0 };

    let dias;
    if (altura <= 2800)      dias = 2;
    else if (altura <= 4000) dias = 3;
    else                     dias = 4;

    if (isLisa(modeloNumero)) dias = Math.max(2, dias - 1);
    if (isRipado(modeloNumero)) dias += (altura <= 4000 ? 1 : 2);
    if (isFrisoH(modeloNumero)) dias += 1;
    if (isAlusense) dias += 1;

    dias = Math.max(2, dias);
    if (Number(nFolhas) === 2) dias *= 2;

    const horas = dias * HORAS_POR_DIA * qtdPortas;
    return { dias, horas };
  }

  /**
   * REGRA 5 — Conferencia & Embalagem, em horas.
   *   altura < 6000mm → 3h base
   *   altura ≥ 6000mm → 4h base
   *   Se 2 folhas: ×2.
   *   × qtd de portas.
   */
  function regraConferencia(altura, nFolhas, qtdPortas) {
    if (!altura || !qtdPortas) return 0;
    let base = altura < 6000 ? 3 : 4;
    if (Number(nFolhas) === 2) base *= 2;
    return base * qtdPortas;
  }

  /**
   * Detecta se a cor (interna/externa) e' chapa Alusense — faz +1 dia
   * na colagem (regra 4).
   */
  function corEhAlusense(item) {
    const c1 = String(item.corInterna || '').toLowerCase();
    const c2 = String(item.corExterna || '').toLowerCase();
    return /alusense/i.test(c1) || /alusense/i.test(c2);
  }

  /**
   * Calcula horas auto por etapa pra UM item porta_externa.
   * Devolve um objeto com as 5 etapas + dias da colagem (pra exibir).
   */
  function horasItemPortaExterna(item) {
    const altura  = parseFloat(String(item.altura || '').replace(',', '.')) || 0;
    const qtd     = Math.max(1, Number(item.quantidade) || 1);
    const folhas  = Number(item.nFolhas) || 1;
    const chapas  = Number(item.qtdChapas) || 0;
    const modelo  = Number(item.modeloNumero) || 0;
    const alus    = corEhAlusense(item);

    const colag = regraColagem(altura, modelo, folhas, qtd, alus);
    return {
      portal:         regraPortal(altura, folhas, qtd),
      quadro:         regraQuadro(altura, folhas, qtd),
      corte_usinagem: regraCorte(chapas, modelo, folhas, qtd),
      colagem:        colag.horas,
      colagem_dias:   colag.dias,
      conf_bem:       regraConferencia(altura, folhas, qtd),
    };
  }

  // Defaults da fabricacao (sao salvos por versao, editaveis)
  const FAB_DEFAULT = {
    // Felipe (do doc - msg "campos vazios"): defaults vazios pra
    // ficar laranja transparente ate o usuario preencher.
    n_operarios: '',
    custo_hora: '',
    // 5 componentes que somam ao subMO pra dar subFab.
    // Felipe (sessao 2026-05): adicionado total_revestimento — antes
    // chapas/revestimentos iam pelo "Extras". Agora tem campo proprio
    // (ficara automatico quando o motor de chapas estiver pronto).
    total_perfis:        '',
    total_pintura:       '',
    total_acessorios:    '',
    total_fechadura_digital: '',  // Felipe sessao 31: separado
    total_revestimento:  '',
    total_extras:        '',
    etapas: ETAPAS_FAB.reduce((acc, e) => { acc[e.id] = { dias: 0 }; return acc; }, {}),
  };

  // Defaults da instalacao — schema das 10 regras do Felipe.
  // Modo PROJETTA: calcula tudo a partir de km, pessoas, dias, etc.
  // Modo TERCEIROS: subInst = inst_terceiros_valor + inst_terceiros_transp
  //                 (componentes individuais ficam como "—")
  const INST_DEFAULT = {
    modo: 'projetta',          // 'projetta' | 'terceiros' | 'internacional'

    // Dados base
    distancia_km: '',          // Felipe: vazio pra ficar laranja, alerta antes de avancar
    altura_porta_mm: 0,        // virá auto do item
    peso_bruto_kg: 0,          // virá auto do item — alerta se > 500

    // Override manual de deslocamento (vazio/null = auto pelo km)
    desl_override: null,

    // Dias de instalacao no local (manual; auto pelo tipo de porta depois)
    // Felipe (do doc): comeca vazio — usuario preenche
    // Felipe sessao 12: 'na instalacao colque quantidade de carro ja
    // automatico 1 dia'. Default dias_instalacao=1, n_carros=1. Felipe
    // ainda pode editar pra cima se a obra exigir.
    // Felipe sessao 13: 'dias de instalcao ainda esta vindo automatico
    // 1 deve vir zerado'. Default agora 0 — Felipe preenche manual.
    dias_instalacao: 0,

    // Equipe
    // Felipe (do doc - msg "todos campos 0,00 deixe vazio"): comecam vazios
    n_pessoas: '',
    diaria_pessoa: '',
    n_carros: 1,

    // Hotel
    diaria_hotel: '',

    // Alimentacao
    alimentacao_dia: '',

    // Munk (manual)
    munk_caminhao: '',

    // Pedagio (manual; auto se vazio)
    pedagio_manual: null,

    // Modo TERCEIROS / INTERNACIONAL (manual sempre)
    inst_terceiros_valor:  '',
    inst_terceiros_transp: '',
  };

  // Tabela de dias de deslocamento por km (regra 1)
  function deslocamentoPorKm(km) {
    if (km <= 0) return 0;
    if (km <= 300) return 1;
    if (km <= 800) return 2;
    if (km <= 1300) return 3;
    return 4;
  }

  // Tabela de quartos por pessoas (regra 4)
  function quartosPorPessoas(p) {
    if (p <= 2) return 1;
    if (p <= 4) return 2;
    if (p <= 6) return 3;
    return Math.ceil(p / 2);
  }

  /**
   * Calcula custo total de fabricacao a partir do schema.
   */
  /**
   * Calcula custo de fabricacao a partir das regras Felipe aplicadas a cada
   * item porta_externa da versao. Soma a contribuicao de cada item por etapa.
   *
   *   horas_etapa  = sum(item → regra_etapa(item))     ou override manual
   *   total_horas  = sum(horas_etapa) × n_operarios     (HH = ×2 default)
   *   subMO        = total_horas × custo_hora           (R$ 110/h default)
   *   subFab       = subMO + total_perfis_pintura_acessorios + chapas
   */
  function calcularFab(fab, itens) {
    const f = Object.assign({}, FAB_DEFAULT, fab || {});
    const etapas = Object.assign({}, FAB_DEFAULT.etapas, f.etapas || {});
    const n_op   = Number(f.n_operarios) || 0;
    const r_h    = Number(f.custo_hora)  || 0;
    // 5 componentes separados (Felipe pediu) — somam pra compor o total
    // Felipe (sessao 2026-05): adicionado total_revestimento (chapas).
    const tPerfis      = Number(f.total_perfis)       || 0;
    const tPintura     = Number(f.total_pintura)      || 0;
    const tAcessorios  = Number(f.total_acessorios)   || 0;
    const tRevestiment = Number(f.total_revestimento) || 0;
    const tExtras      = Number(f.total_extras)       || 0;
    // Felipe (sessao 31): fechadura digital em campo proprio
    const tFechDigital = Number(f.total_fechadura_digital) || 0;
    const tInsumos     = tPerfis + tPintura + tAcessorios + tRevestiment + tExtras + tFechDigital;

    // Soma horas calculadas das regras pra cada etapa (todos os itens porta_externa)
    const portas = (itens || []).filter(i => i && i.tipo === 'porta_externa');
    const horasAuto = ETAPAS_FAB.reduce((acc, e) => { acc[e.id] = 0; return acc; }, {});
    let diasColagem = 0;  // pra exibir o detalhe
    portas.forEach(it => {
      const h = horasItemPortaExterna(it);
      horasAuto.portal         += h.portal;
      horasAuto.folha_porta    += h.quadro;          // quadro → folha_porta (renomeado)
      horasAuto.corte_usinagem += h.corte_usinagem;
      horasAuto.colagem        += h.colagem;
      horasAuto.conf_embalagem += h.conf_bem;        // conf_bem → conf_embalagem (renomeado)
      diasColagem = Math.max(diasColagem, h.colagem_dias || 0);
    });

    // Aplica override por etapa (se preenchido)
    // Felipe (sessao 28): "QUANDO TENHO MULTI ITENS COLOQUE AO LADO Custo
    // de Fabricacao OUTRA COLUNA POIS CADA ITEM TEM SEU TEMPO E DEPOIS
    // SOMA TODAS AS HORAS". Estrutura nova:
    //   etapas[id].horasPorItem = { '0': N, '1': N, ... }  (1 valor por item)
    //   etapas[id].horasOverride = N                       (fallback global, compat)
    //
    // Logica:
    //   - Se horasPorItem tem qualquer chave preenchida → soma TODAS as
    //     entradas (chaves vazias = 0). horasOverride e' ignorado.
    //   - Se horasPorItem vazio e horasOverride preenchido → usa
    //     horasOverride (comportamento antigo).
    //   - Se ambos vazios → usa o calculado automatico.
    const detalhes = ETAPAS_FAB.map(e => {
      const ent = etapas[e.id] || {};
      const auto = horasAuto[e.id] || 0;
      const ov = ent.horasOverride;
      const porItem = ent.horasPorItem || {};

      // Soma horasPorItem (alguma entrada preenchida → ja conta como override)
      const chavesPorItem = Object.keys(porItem);
      const algumPreenchidoPorItem = chavesPorItem.some(k => {
        const v = porItem[k];
        return v != null && v !== '' && Number.isFinite(Number(v));
      });

      let horas;
      let temOverride;
      if (algumPreenchidoPorItem) {
        horas = chavesPorItem.reduce((s, k) => {
          const v = Number(porItem[k]);
          return s + (Number.isFinite(v) ? v : 0);
        }, 0);
        temOverride = true;
      } else if (ov != null && ov !== '') {
        horas = Number(ov);
        temOverride = (Number(ov) !== auto);
      } else {
        // Felipe (sessao 31): "continua puxando 100 hora e pra ficar
        // 100% manual". Quando vazio, horas = 0 (nao usa auto).
        // O auto fica APENAS como referencia visual na coluna
        // "Calculado pelas regras" — nao entra no calculo.
        horas = 0;
        temOverride = false;
      }

      return {
        id: e.id,
        label: e.label,
        horasAuto: auto,
        horas,
        // Felipe (sessao 28): expoe horasPorItem pra UI renderizar coluna
        // de cada item. UI vai usar e.horasPorItem[idx] OU calcular fallback.
        horasPorItem: porItem,
        override: temOverride,
      };
    });

    const horas_etapas   = detalhes.reduce((s, d) => s + d.horas, 0);
    const total_horas    = horas_etapas * n_op;
    const subtotal_horas = total_horas * r_h;
    const total          = subtotal_horas + tInsumos;

    return {
      detalhes,
      horas_etapas,
      n_operarios: n_op,
      total_horas,
      custo_hora: r_h,
      subtotal_horas,
      total_perfis:        tPerfis,
      total_pintura:       tPintura,
      total_acessorios:    tAcessorios,
      total_fechadura_digital: tFechDigital,
      total_revestimento:  tRevestiment,
      total_extras:        tExtras,
      total_insumos:       tInsumos,
      total,
      diasColagem,
      qtdItens: portas.length,
    };
  }

  /**
   * Calcula custo de instalacao seguindo as 10 regras passadas pelo Felipe:
   *
   *  1. Dias de deslocamento (auto pelo km — override manual em desl_override)
   *  2. Salarios = diasTotal × pessoas × diaria
   *  3. Diesel = (km + 50) × 0,875 × 2 × carros   (so se km > 0)
   *  4. Hotel = noites × hotel-dia × quartos
   *     noites = max(diasTotal - 1, 0)
   *     quartos: pessoas <= 2 → 1; <=4 → 2; <=6 → 3; else ceil(p/2)
   *  5. Alimentacao = diasTotal × pessoas × alim
   *  6. Andaime (auto): altura > 3000mm → R$ 550; senao 0
   *  7. Pedagio (auto se vazio): ceil(km × 2 × 0,15 / 50) × 50
   *  8. Munk (manual + alerta visual se peso bruto > 500 kg)
   *  9. SubInst PROJETTA = sal + diesel + hotel + aliment + andaime + munk + pedagio
   * 10. SubInst TERCEIROS = inst_terceiros_valor + inst_terceiros_transp
   *     (componentes individuais ficam como "—")
   */
  function calcularInst(inst) {
    const i = Object.assign({}, INST_DEFAULT, inst || {});
    const km       = Number(i.distancia_km)     || 0;
    const altura   = Number(i.altura_porta_mm)  || 0;
    const peso     = Number(i.peso_bruto_kg)    || 0;
    const pessoas  = Number(i.n_pessoas)        || 0;
    const diaria   = Number(i.diaria_pessoa)    || 0;
    // Felipe sessao 13: n_carros default automatico = 1 (nao 0). Se item
    // legado/novo vier sem n_carros, assume 1 carro pra calculo.
    const carros   = Number(i.n_carros) >= 1 ? Number(i.n_carros) : 1;
    const hotelDia = Number(i.diaria_hotel)     || 0;
    const alim     = Number(i.alimentacao_dia)  || 0;

    // Regra 1: dias de deslocamento (override manual ou auto pelo km)
    const overrideRaw = i.desl_override;
    const temOverride = overrideRaw !== null && overrideRaw !== '' && overrideRaw !== undefined && !Number.isNaN(Number(overrideRaw));
    const deslocamentoDias = temOverride ? (Number(overrideRaw) || 0) : deslocamentoPorKm(km);

    const diasInst  = Number(i.dias_instalacao) || 0;
    const diasTotal = deslocamentoDias + diasInst;

    // Modo TERCEIROS / INTERNACIONAL — soma simples, componentes individuais "—"
    // Felipe (do doc - msg frete/inst): "Internacional" se comporta igual
    // a "Terceiros" (valores manuais).
    if (i.modo === 'terceiros' || i.modo === 'internacional') {
      const valor  = Number(i.inst_terceiros_valor)  || 0;
      const transp = Number(i.inst_terceiros_transp) || 0;
      return {
        modo: i.modo,
        deslocamentoDias,
        diasInst,
        diasTotal,
        // null sinaliza pra UI exibir "—"
        salarios:    null,
        diesel:      null,
        hotel:       null,
        alimentacao: null,
        andaime:     null,
        munk:        null,
        munk_alerta: false,
        pedagio:     null,
        noites:      null,
        quartos:     null,
        inst_terceiros_valor:  valor,
        inst_terceiros_transp: transp,
        total: valor + transp,
      };
    }

    // Modo PROJETTA — todas as fórmulas
    // Regra 2: salarios
    const salarios = diasTotal * pessoas * diaria;

    // Regra 3: diesel (so se km > 0)
    const diesel = km > 0 ? (km + 50) * 0.875 * 2 * carros : 0;

    // Regra 4: hotel
    const noites  = Math.max(diasTotal - 1, 0);
    const quartos = quartosPorPessoas(pessoas);
    const hotel   = noites * hotelDia * quartos;

    // Regra 5: alimentacao
    const alimentacao = diasTotal * pessoas * alim;

    // Regra 6: andaime (auto pela altura)
    const andaime = altura > 3000 ? 550 : 0;

    // Regra 7: pedagio (auto se manual vazio)
    const pedagioRaw = i.pedagio_manual;
    const temPedagioManual = pedagioRaw !== null && pedagioRaw !== '' && pedagioRaw !== undefined && !Number.isNaN(Number(pedagioRaw));
    const pedagio = temPedagioManual
      ? (Number(pedagioRaw) || 0)
      : (km > 0 ? Math.ceil(km * 2 * 0.15 / 50) * 50 : 0);

    // Regra 8: munk (manual; alerta se peso > 500)
    const munk = Number(i.munk_caminhao) || 0;
    const munk_alerta = peso > 500;

    // Regra 9: subInst PROJETTA
    const total = salarios + diesel + hotel + alimentacao + andaime + munk + pedagio;

    return {
      modo: 'projetta',
      deslocamentoDias,
      diasInst,
      diasTotal,
      noites,
      quartos,
      salarios,
      diesel,
      hotel,
      alimentacao,
      andaime,
      munk,
      munk_alerta,
      pedagio,
      total,
    };
  }

  /**
   * Calcula DRE completo a partir de subtotais e parametros.
   * Formulas conforme spec passada pelo Felipe (sistema antigo da Weiku):
   *   custo    = (subFab + subInst) + (subFab + subInst) × overhead
   *   lbn      = lucro_alvo / (1 − IRPJ)        (lucro bruto necessario)
   *   td       = impostos + com_rep + com_rt + com_gest + lbn
   *   fF       = 1 / (1 − td)                   (fator faturamento)
   *   pFat     = custo × fF
   *   fT       = fF / (1 − markup_desc)         (fator tabela)
   *   pTab     = custo × fT
   *   pFatReal = pTab × (1 − desconto)
   *   markup%  = (pTab / custo − 1) × 100
   *
   * Retorna todos os valores intermediarios pra exibir DRE detalhada.
   * Se td >= 1 ou markup_desc >= 1, retorna fatores em 0 (protecao).
   */
  function calcularDRE(subFab, subInst, params) {
    const p = Object.assign({}, PARAMS_DEFAULT, params || {});
    const overhead    = (Number(p.overhead)    || 0) / 100;
    const impostos    = (Number(p.impostos)    || 0) / 100;
    const com_rep     = (Number(p.com_rep)     || 0) / 100;
    const com_rt      = (Number(p.com_rt)      || 0) / 100;
    const com_gest    = (Number(p.com_gest)    || 0) / 100;
    const lucro_alvo  = (Number(p.lucro_alvo)  || 0) / 100;
    const markup_desc = (Number(p.markup_desc) || 0) / 100;
    const desconto    = (Number(p.desconto)    || 0) / 100;

    const sub = (Number(subFab) || 0) + (Number(subInst) || 0);
    const custo = sub + sub * overhead;

    const lbn = lucro_alvo / (1 - IRPJ);
    const td  = impostos + com_rep + com_rt + com_gest + lbn;
    const fF  = (td < 1)  ? 1 / (1 - td)             : 0;
    const fT  = (markup_desc < 1) ? fF / (1 - markup_desc) : 0;
    const pFat     = custo * fF;
    const pTab     = custo * fT;
    const pFatReal = pTab * (1 - desconto);
    const markupPct = custo > 0 ? (pTab / custo - 1) * 100 : 0;

    return {
      // entradas (echo)
      subFab: Number(subFab) || 0,
      subInst: Number(subInst) || 0,
      params: p,
      // intermediarios (em fracao 0-1, exceto markupPct)
      lbn, td, fF, fT,
      // resultado em R$
      custo, pFat, pTab, pFatReal,
      // markup % (visual)
      markupPct,
    };
  }

  /**
   * Felipe (sessao 2026-06): calcula valores POR ITEM pra exibir na
   * proposta comercial.
   *
   * Pedido textual: "fabricacao vai ter que ser separado portanto vai
   * ter que ter fabricacao item 1, item 2, item 3 etc, para jogar esse
   * custo neste item. Somente instalacao que vai ser junto. Para proposta
   * comercial vai ter que jogar valor porta 1 + porta 2 normal custo
   * fabricacao e preco final com markup e custo e preco final da
   * instalacao dividir proporcional ao custo de cada pra nao sair vazio
   * na proposta."
   *
   * Estrategia:
   *  1. Calcula HORAS por item (horasItemPortaExterna ja' considera
   *     item.quantidade).
   *  2. Distribui subFab proporcional as horas (item maior = mais horas
   *     = mais custo de fabricacao).
   *  3. Distribui subInst proporcional ao subFab de cada item
   *     (Felipe: "dividir proporcional ao custo de cada").
   *  4. Aplica formula DRE em cada item separadamente.
   *  5. Valor unitario = precoFinal / item.quantidade.
   *
   * Retorna { porItem: [...], totalGeral }.
   */
  function calcularValoresProposta(versao, params) {
    const itens = (versao && versao.itens) || [];
    if (!itens.length) return { porItem: [], totalGeral: 0 };

    // 1. Horas por item (considera quantidade interna do horasItemPortaExterna)
    const horasPorIdx = {};
    let horasTotal = 0;
    itens.forEach((it, idx) => {
      if (it && it.tipo === 'porta_externa') {
        const h = horasItemPortaExterna(it);
        horasPorIdx[idx] = (h.portal || 0) + (h.quadro || 0) +
                           (h.corte_usinagem || 0) + (h.colagem || 0) +
                           (h.conf_bem || 0);
      } else {
        horasPorIdx[idx] = 0;
      }
      horasTotal += horasPorIdx[idx];
    });

    // 2. SubFab e SubInst totais (vem do storage, ja' calculados)
    const subFabTotal  = Number(versao.subFab)  || 0;
    const subInstTotal = Number(versao.subInst) || 0;

    // 3. Distribui subFab proporcional as horas
    const subFabPorIdx  = [];
    const subInstPorIdx = [];
    itens.forEach((it, idx) => {
      const propHoras = horasTotal > 0
        ? (horasPorIdx[idx] / horasTotal)
        : (1 / itens.length);
      subFabPorIdx.push(subFabTotal * propHoras);
    });

    // 4. Distribui subInst proporcional ao subFab de cada item
    const subFabSomado = subFabPorIdx.reduce((s, v) => s + v, 0);
    itens.forEach((it, idx) => {
      const propFab = subFabSomado > 0
        ? (subFabPorIdx[idx] / subFabSomado)
        : (1 / itens.length);
      subInstPorIdx.push(subInstTotal * propFab);
    });

    // 5. DRE por item — mesmos parametros, custos diferentes
    const porItem = itens.map((it, idx) => {
      const dreItem = calcularDRE(subFabPorIdx[idx], subInstPorIdx[idx], params);
      const qtd = Math.max(1, Number(it.quantidade) || 1);
      const precoFinal = Number(dreItem.pTab) || 0;
      return {
        idx,
        item: it,
        qtd,
        subFab:    subFabPorIdx[idx],
        subInst:   subInstPorIdx[idx],
        custo:     dreItem.custo,
        precoFinal,
        valorUn:   qtd > 0 ? precoFinal / qtd : 0,
      };
    });

    const totalGeral = porItem.reduce((s, x) => s + x.precoFinal, 0);

    return { porItem, totalGeral };
  }


  // ---------- helpers internos ----------
  function uid(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }
  function nowIso() {
    return new Date().toISOString();
  }
  function userAtual() {
    try {
      return (window.Auth && Auth.getCurrentUser && Auth.getCurrentUser()?.username) || 'desconhecido';
    } catch (e) {
      return 'desconhecido';
    }
  }
  // 1 → 'A', 2 → 'B', 27 → 'AA' (futuro-proof)
  function letraOpcao(n) {
    if (n < 1) return 'A';
    let s = '';
    let x = n;
    while (x > 0) {
      const r = (x - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  }

  // ---------- camada de armazenamento ----------
  function loadAll() {
    return store.get('negocios') || [];
  }
  function saveAll(negocios) {
    try {
      store.set('negocios', negocios);
      store.set('schema_version', SCHEMA_VERSION);
    } catch (e) {
      // Felipe (sessao 2026-09): saveAll defensivo.
      // Quando localStorage estoura (QuotaExceededError), antes de
      // explodir o app inteiro, tenta:
      //   1) Auto-limpar precos_snapshot de drafts (sem perder dados)
      //   2) Salvar de novo
      //   3) Se ainda falhar, propaga o erro (UI ja deve estar resiliente)
      const isQuota = (e && (e.name === 'QuotaExceededError'
                           || e.code === 22
                           || e.code === 1014
                           || /quota/i.test(String(e.message || ''))));
      if (!isQuota) throw e;
      console.warn('[Orcamento] localStorage cheio — tentando auto-limpar snapshots de drafts...');
      let liberados = 0;
      negocios.forEach(n => (n.opcoes || []).forEach(o => (o.versoes || []).forEach(v => {
        // Drafts nao precisam de snapshot completo. Versoes fechadas
        // sao preservadas (snapshot legitimo de historico imutavel).
        if (v.status !== 'fechada' && v.precos_snapshot
            && (v.precos_snapshot.acessorios || v.precos_snapshot.perfis)) {
          v.precos_snapshot = { pendente: true, tiradoEm: v.precos_snapshot.tiradoEm || nowIso() };
          liberados++;
        }
      })));
      if (liberados > 0) {
        try {
          store.set('negocios', negocios);
          store.set('schema_version', SCHEMA_VERSION);
          console.warn(`[Orcamento] Auto-limpou ${liberados} snapshots de drafts. Storage salvo.`);
          return;
        } catch (e2) {
          console.error('[Orcamento] Auto-limpeza nao foi suficiente. Erro:', e2);
          throw e2;
        }
      }
      throw e;  // sem nada pra limpar, propaga
    }
    // Felipe (sessao 31): sync pro Supabase em background (nao bloqueia)
    if (window.SupabaseSync && window.SupabaseSync.syncAll) {
      window.SupabaseSync.syncAll(negocios).catch(function(err) {
        console.warn('[Orcamento] Supabase sync falhou (dados locais OK):', err.message);
      });
    }
  }

  // ---------- snapshot de precos (Etapa 3 vai usar de verdade) ----------
  // Felipe (sessao 2026-09 — fix de quota localStorage):
  //
  // O snapshot original copiava TODO o cadastro (acessorios, superficies,
  // perfis, representantes) em CADA criacao de versao — inclusive em
  // drafts efemeros. Resultado: 33 versoes × 65 KB = 2.15 MB so' em
  // dados redundantes. Estourava o limite de 5 MB do localStorage.
  //
  // Verificado no codigo (grep "precos_snapshot"): o snapshot e' apenas
  // ESCRITO, nunca LIDO. E' codigo reservado para "Etapa 3" futura. Logo,
  // posso reduzir a um marcador leve sem impacto funcional.
  //
  // Estrategia:
  //   - Drafts (criacao normal de versao) → snapshotPrecosLeve() — 1 obj
  //     pequeno {pendente, tiradoEm}. Quando Etapa 3 chegar, le do
  //     cadastro atual + flag pendente.
  //   - Fechamento de versao (fecharVersao, status='fechada') → snapshot
  //     completo (snapshotPrecosCompleto), porque ai' vira historico
  //     imutavel e merece persistir.
  //
  // Backward compat: versoes existentes com precos_snapshot completo
  // continuam funcionando (estrutura maior, mas valida).
  function snapshotPrecosLeve() {
    return {
      pendente: true,            // marcador: snapshot ainda nao consolidado
      tiradoEm: nowIso(),
    };
  }

  function snapshotPrecosCompleto() {
    const cad = Storage.scope('cadastros');
    const acessorios  = cad.get('acessorios_lista')  || [];
    const superficies = cad.get('superficies_lista') || [];
    const perfis      = cad.get('perfis_lista')      || [];
    const reps        = cad.get('representantes_lista') || [];
    return {
      acessorios:  acessorios.map(a  => ({ codigo: a.codigo, descricao: a.descricao, preco: Number(a.preco) || 0 })),
      superficies: superficies.map(s => ({ descricao: s.descricao, preco: Number(s.preco) || 0 })),
      perfis:      perfis.map(p      => ({ codigo: p.codigo, nome: p.nome, kg_m: p.kg_m, preco_kg: p.preco_kg })),
      representantes: reps.map(r     => ({ razao_social: r.razao_social, comissao_maxima: r.comissao_maxima })),
      tiradoEm: nowIso(),
    };
  }

  // Alias de compatibilidade — outros lugares no codigo (fora deste
  // arquivo) podem chamar snapshotPrecosAtual. Mantem o nome antigo
  // apontando para a versao LEVE (default seguro).
  function snapshotPrecosAtual() {
    return snapshotPrecosLeve();
  }

  // ============================================================
  //                       API PUBLICA
  // ============================================================

  /**
   * Cria um novo Negocio vinculado a um lead, ja com Opcao A e Versao 1 vazia.
   * @param {Object} args
   * @param {string} args.leadId - ID do lead no CRM
   * @param {string} args.clienteNome - nome do cliente (snapshot, lead pode renomear)
   * @returns {Object} negocio criado, com referencia primeiraVersaoId pra navegar
   */
  function criarNegocio({ leadId, clienteNome }) {
    if (!leadId) throw new Error('criarNegocio: leadId obrigatorio');
    const negocios = loadAll();

    // Se ja existe negocio pra esse lead, retorna o existente (idempotencia)
    const existente = negocios.find(n => n.leadId === leadId);
    if (existente) return existente;

    const negocioId = uid('neg');
    const opcaoId   = uid('opc');
    const versaoId  = uid('ver');
    const criadoPor = userAtual();
    const criadoEm  = nowIso();

    const versao = {
      id: versaoId,
      numero: 1,
      status: 'draft',  // 'draft' (mutavel) | 'fechada' (imutavel)
      criadoEm, criadoPor,
      observacao: '',
      itens: [],
      precos_snapshot: snapshotPrecosAtual(),
      // Subtotais de fabricacao e instalacao — por enquanto editaveis
      // manualmente na aba Custo. Quando o calculo automatico de
      // perfis/acessorios/chapas vier, vai sair direto dos itens.
      subFab: 0,
      subInst: 0,
      custoFab: Object.assign({}, FAB_DEFAULT, { etapas: Object.assign({}, FAB_DEFAULT.etapas) }),
      custoInst: Object.assign({}, INST_DEFAULT),
      parametros: paramsDefaultParaLead(),
      subtotais: { acessorios: 0, superficies: 0, perfis: 0, frete: 0, comissao: 0 },
      total: 0,
    };
    const opcao = {
      id: opcaoId,
      letra: 'A',
      criadoEm, criadoPor,
      versoes: [versao],
    };
    const negocio = {
      id: negocioId,
      leadId,
      clienteNome: clienteNome || '',
      criadoEm, criadoPor,
      opcoes: [opcao],
    };

    negocios.push(negocio);
    saveAll(negocios);
    return negocio;
  }

  /**
   * Felipe (regra 3 do CRM): card so exibe Modelo / Folhas / Cor / Cidade /
   * Estado / Rep depois que o usuario salvou pelo menos UMA versao oficial
   * ('fechada'). Drafts nao aparecem.
   *
   * Retorna:
   *   {
   *     hasVersaoFechada: boolean,        // se ha pelo menos 1 versao fechada
   *     valor: number,                    // total da ultima versao fechada
   *     modelo: string,                   // do primeiro item da ultima versao fechada
   *     nFolhas: string,                  // ex: "1 folha", "2 folhas"
   *     corInterna: string, corExterna: string,
   *     versoes: [                        // lista pra UI mostrar dropdown/abrir
   *       { id, numero, status, valor, criadoEm, opcaoLetra }, ...
   *     ]
   *   }
   * Se o lead nao tem negocio ainda, retorna null.
   */
  function resumoParaCardCRM(leadId) {
    const negocio = obterNegocioPorLeadId(leadId);
    if (!negocio) return null;

    // Achata todas as versoes (de todas as opcoes) pra facilitar UI
    // Felipe (sessao 2026-06): "ao alterar e reaprovar com valor R$
    // 133.606,46 o card permaneceu valor antigo". Bug: estava lendo
    // v.total (campo inicializado em 0 e nunca atualizado). Agora le
    // v.valorAprovado (que SIM e' setado por aprovarOrcamento na
    // linha 1075). Fallback p/ v.total p/ versoes legadas.
    // Tambem expoe precoProposta (pTab — preco antes do desconto).
    // Felipe (sessao 2026-08): "ORCAMENTO APROVADO, VALOR NAO FOI PARA
    // O CARD". Bug: a logica abaixo procurava versao com status='fechada',
    // mas aprovarOrcamento NAO muda status — so' seta aprovadoEm.
    // Como Felipe aprova mas nao fecha, a versao ficava com aprovadoEm
    // setado mas status ainda 'draft' → card nunca atualizava. Solucao:
    // considera tambem versoes com aprovadoEm como "fechada pro card".
    const versoesFlat = [];
    (negocio.opcoes || []).forEach(o => {
      (o.versoes || []).forEach(v => {
        const ehImutavelParaCard = v.status === 'fechada' || !!v.aprovadoEm;
        versoesFlat.push({
          id: v.id,
          numero: v.numero,
          status: v.status,
          aprovadoEm: v.aprovadoEm,                      // novo: card precisa saber
          ehImutavelParaCard,                            // novo: marca pra ordenacao/filter
          valor: Number(v.valorAprovado) || Number(v.total) || 0,
          precoProposta: Number(v.precoProposta) || Number(v.valorAprovado) || 0,
          criadoEm: v.criadoEm,
          opcaoLetra: o.letra,
          opcaoId: o.id,
        });
      });
    });

    // Ordena: imutaveis primeiro (mais recente primeiro), draft por ultimo
    versoesFlat.sort((a, b) => {
      if (a.ehImutavelParaCard !== b.ehImutavelParaCard) return a.ehImutavelParaCard ? -1 : 1;
      return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
    });

    // Felipe (sessao 2026-08): aceita aprovadoEm OU status='fechada'.
    const ultimaFechada = versoesFlat.find(v => v.ehImutavelParaCard) || null;

    if (!ultimaFechada) {
      return { hasVersaoFechada: false, valor: 0, precoProposta: 0, versoes: versoesFlat };
    }

    // Pega versao completa pra ler itens
    const r = obterVersao(ultimaFechada.id);
    const item0 = (r && r.versao && r.versao.itens && r.versao.itens[0]) || {};

    // Felipe (sessao 2026-05): expoe comissoes e desconto pro template
    // de email/whatsapp do representante. params da versao tem com_rep,
    // com_rt e desconto em %. Calcula R$ sobre o valorComDesconto.
    const params = Object.assign({}, PARAMS_DEFAULT, (r && r.versao && r.versao.parametros) || {});
    const valorComDesc  = Number(ultimaFechada.valor) || 0;
    const valorOriginal = Number(ultimaFechada.precoProposta) || 0;
    const com_rep_pct   = Number(params.com_rep) || 0;
    const com_rt_pct    = Number(params.com_rt)  || 0;
    const desconto_pct  = valorOriginal > 0 ? Math.max(0, (1 - (valorComDesc / valorOriginal)) * 100) : 0;
    const com_rep_rs    = valorComDesc * (com_rep_pct / 100);
    const com_rt_rs     = valorComDesc * (com_rt_pct  / 100);
    const desconto_rs   = Math.max(0, valorOriginal - valorComDesc);

    return {
      hasVersaoFechada: true,
      valor: ultimaFechada.valor,                  // pFatReal — Cliente Paga (com desconto)
      precoProposta: ultimaFechada.precoProposta,  // pTab — Preco da Proposta (sem desconto)
      // Felipe sessao 2026-05: dados pro template de email rep
      comissaoRepPct:  com_rep_pct,
      comissaoRepRs:   com_rep_rs,
      comissaoArqPct:  com_rt_pct,
      comissaoArqRs:   com_rt_rs,
      descontoPct:     desconto_pct,
      descontoRs:      desconto_rs,
      modelo: item0.modeloNumero || item0.modelo || '',
      nFolhas: item0.nFolhas ? `${item0.nFolhas} folha${String(item0.nFolhas) === '1' ? '' : 's'}` : '',
      corInterna: item0.corInterna || '',
      corExterna: item0.corExterna || '',
      versoes: versoesFlat,
    };
  }

  function obterNegocioPorLeadId(leadId) {
    return loadAll().find(n => n.leadId === leadId) || null;
  }
  function obterNegocio(negocioId) {
    return loadAll().find(n => n.id === negocioId) || null;
  }
  function obterOpcao(opcaoId) {
    for (const n of loadAll()) {
      const o = (n.opcoes || []).find(o => o.id === opcaoId);
      if (o) return { negocio: n, opcao: o };
    }
    return null;
  }
  function obterVersao(versaoId) {
    for (const n of loadAll()) {
      for (const o of (n.opcoes || [])) {
        const v = (o.versoes || []).find(v => v.id === versaoId);
        if (v) {
          // Felipe (do doc): injeta defaults dos campos novos (alisar,
          // parede, etc) em itens antigos. Idempotente.
          normalizarItensVersao(v);
          return { negocio: n, opcao: o, versao: v };
        }
      }
    }
    return null;
  }
  function listarNegocios() {
    return loadAll().slice();
  }
  function listarOpcoes(negocioId) {
    const n = obterNegocio(negocioId);
    return n ? (n.opcoes || []).slice() : [];
  }
  function listarVersoes(opcaoId) {
    const r = obterOpcao(opcaoId);
    return r ? (r.opcao.versoes || []).slice() : [];
  }

  /**
   * Cria nova Opcao (B, C, D...) dentro do mesmo Negocio.
   * Pode partir do zero (versao vazia) ou clonar de uma versao existente.
   */
  function criarOpcao({ negocioId, baseadoEmVersaoId }) {
    const negocios = loadAll();
    const negocio = negocios.find(n => n.id === negocioId);
    if (!negocio) throw new Error('criarOpcao: negocio nao encontrado');

    const proximaLetra = letraOpcao((negocio.opcoes?.length || 0) + 1);
    const opcaoId  = uid('opc');
    const versaoId = uid('ver');
    const criadoEm = nowIso();
    const criadoPor = userAtual();

    let itensBase = [];
    if (baseadoEmVersaoId) {
      const r = obterVersao(baseadoEmVersaoId);
      if (r && r.versao) itensBase = JSON.parse(JSON.stringify(r.versao.itens || []));
    }

    const novaVersao = {
      id: versaoId,
      numero: 1,
      status: 'draft',
      criadoEm, criadoPor,
      observacao: '',
      itens: itensBase,
      precos_snapshot: snapshotPrecosAtual(),
      subFab: 0,
      subInst: 0,
      custoFab: Object.assign({}, FAB_DEFAULT, { etapas: Object.assign({}, FAB_DEFAULT.etapas) }),
      custoInst: Object.assign({}, INST_DEFAULT),
      parametros: paramsDefaultParaLead(),
      subtotais: { acessorios: 0, superficies: 0, perfis: 0, frete: 0, comissao: 0 },
      total: 0,
    };
    const novaOpcao = {
      id: opcaoId,
      letra: proximaLetra,
      criadoEm, criadoPor,
      versoes: [novaVersao],
    };
    negocio.opcoes.push(novaOpcao);
    saveAll(negocios);
    return novaOpcao;
  }

  /**
   * Cria nova Versao (V N+1) dentro de uma Opcao existente.
   * SEMPRE clona inputs da versao anterior + tira NOVO snapshot de precos.
   * Versao anterior fica intocada (imutavel apos virar 'fechada').
   */
  function criarVersao({ opcaoId, baseadoEmVersaoId }) {
    const negocios = loadAll();
    let target = null;
    for (const n of negocios) {
      const o = (n.opcoes || []).find(o => o.id === opcaoId);
      if (o) { target = { negocio: n, opcao: o }; break; }
    }
    if (!target) throw new Error('criarVersao: opcao nao encontrada');
    const opcao = target.opcao;

    // Versao base: a explicita ou a ultima da opcao
    let base = null;
    if (baseadoEmVersaoId) {
      base = (opcao.versoes || []).find(v => v.id === baseadoEmVersaoId);
    } else {
      base = (opcao.versoes || []).slice(-1)[0];
    }

    // Felipe sessao 12: ANTES era (length+1) — falhava quando cache stale
    // tinha menos versoes que o cloud. Resultado: 2 versoes com numero=1.
    // Agora pega MAIOR numero existente + 1 (independente do tamanho).
    let _maiorNumExistente = 0;
    (opcao.versoes || []).forEach(v => {
      const n = Number(v.numero) || 0;
      if (n > _maiorNumExistente) _maiorNumExistente = n;
    });
    const proximoNumero = _maiorNumExistente + 1;

    // Felipe (sessao 2026-05): se nao ha versao base, popular defaults
    // de Fab/Inst com os valores do cadastro de Precificacao. Mantem
    // compatibilidade: se o cadastro nao existir ou modulo nao estiver
    // carregado, usa os FAB_DEFAULT/INST_DEFAULT (que sao vazios).
    // Isso so' atinge versoes NOVAS sem base — versoes clonadas a partir
    // de outra continuam herdando da base (comportamento original intacto).
    function _fabDefaultsComCadastro() {
      const baseFab = Object.assign({}, FAB_DEFAULT, { etapas: Object.assign({}, FAB_DEFAULT.etapas) });
      try {
        if (window.Precificacao && typeof window.Precificacao.obterValores === 'function') {
          const v = window.Precificacao.obterValores();
          if (v.n_operarios)    baseFab.n_operarios = v.n_operarios;
          if (v.custo_hora_fab) baseFab.custo_hora  = v.custo_hora_fab;
        }
      } catch (e) { /* fallback silencioso pros defaults */ }
      return baseFab;
    }
    function _instDefaultsComCadastro() {
      const baseInst = Object.assign({}, INST_DEFAULT);
      try {
        if (window.Precificacao && typeof window.Precificacao.obterValores === 'function') {
          const v = window.Precificacao.obterValores();
          // Para Hotel: tenta cotacao por cidade (se lead tem cidade), senao fallback
          let diariaHotel = v.diaria_hotel;
          try {
            const lead = (typeof lerLeadAtivo === 'function') ? lerLeadAtivo() : null;
            if (lead && lead.cidade && typeof window.Precificacao.obterDiariaHotelCidade === 'function') {
              diariaHotel = window.Precificacao.obterDiariaHotelCidade(lead);
            }
          } catch (e) { /* mantem fallback */ }
          if (v.diaria_pessoa)   baseInst.diaria_pessoa   = v.diaria_pessoa;
          if (diariaHotel)       baseInst.diaria_hotel    = diariaHotel;
          if (v.alimentacao_dia) baseInst.alimentacao_dia = v.alimentacao_dia;
        }
      } catch (e) { /* fallback silencioso */ }
      return baseInst;
    }

    const novaVersao = {
      id: uid('ver'),
      numero: proximoNumero,
      status: 'draft',
      criadoEm: nowIso(),
      criadoPor: userAtual(),
      observacao: '',
      itens: base ? JSON.parse(JSON.stringify(base.itens || [])) : [],
      precos_snapshot: snapshotPrecosAtual(),
      // Clona subFab/subInst/parametros da base se existir, senão default
      subFab: base?.subFab || 0,
      subInst: base?.subInst || 0,
      custoFab: base?.custoFab ? JSON.parse(JSON.stringify(base.custoFab)) : _fabDefaultsComCadastro(),
      custoInst: base?.custoInst ? JSON.parse(JSON.stringify(base.custoInst)) : _instDefaultsComCadastro(),
      parametros: Object.assign({}, PARAMS_DEFAULT, base?.parametros || {}),
      subtotais: { acessorios: 0, superficies: 0, perfis: 0, frete: 0, comissao: 0 },
      total: 0,
    };
    opcao.versoes.push(novaVersao);
    saveAll(negocios);
    return novaVersao;
  }

  /**
   * Felipe (sessao 2026-06): "criar nova versao com 2 opcoes:
   *   1) em branco — mantem so' largura/altura
   *   2) copiar atual — duplica tudo p/ ajustar pontual"
   *
   * Esta funcao recebe a versao atual (mesmo que aprovada/fechada),
   * fecha ela como historico e cria a nova versao no modo escolhido.
   * A nova versao vira a ATIVA automaticamente.
   *
   * @param {string} versaoBaseId - id da versao atual
   * @param {'em-branco'|'copiar'} modo
   */
  function criarNovaVersao(versaoBaseId, modo) {
    // Felipe sessao 2026-08: novo modo 'reset-calculos' — mantem caracteristicas
    // do item INTEIRAS (largura/altura/modelo/cor/alisar/revestimento/...) e
    // zera APENAS calculos/DRE/custos/aprovacoes. E o modo padrao do botao
    // "+ Nova Versao" do CRM.
    if (modo !== 'em-branco' && modo !== 'copiar' && modo !== 'reset-calculos') {
      throw new Error('criarNovaVersao: modo invalido (' + modo + ')');
    }
    const r = obterVersao(versaoBaseId);
    if (!r) throw new Error('criarNovaVersao: versao base nao encontrada');
    const versaoBase = r.versao;
    const opcao      = r.opcao;

    // 1. Fecha a versao base se ainda nao estiver fechada.
    //    Versoes aprovadas (mas nao fechadas) viram fechadas aqui — pra
    //    historico ficar congelado.
    if (versaoBase.status !== 'fechada') {
      try { fecharVersao(versaoBase.id); }
      catch (e) { console.warn('[orcamento] falha ao fechar versao base:', e.message); }
    }

    // 2. Cria nova versao a partir da base
    const nova = criarVersao({ opcaoId: opcao.id, baseadoEmVersaoId: versaoBase.id });

    // 3. Se modo "em-branco": LIMPA tudo exceto largura/altura/numFolhas/sistema
    //    (campos basicos de identificacao da porta — Felipe quer manter isso)
    if (modo === 'em-branco') {
      const negocios = loadAll();
      for (const n of negocios) {
        for (const o of (n.opcoes || [])) {
          const v = (o.versoes || []).find(v => v.id === nova.id);
          if (v) {
            // Mantem APENAS largura/altura por item, zera resto
            v.itens = (versaoBase.itens || []).map(it => ({
              tipo: it.tipo,
              largura: it.largura,
              altura: it.altura,
              quantidade: it.quantidade || 1,
              nFolhas: it.nFolhas,
              sistema: it.sistema || '',
            }));
            // Zera toda a parte de calculo
            v.subFab    = 0;
            v.subInst   = 0;
            v.custoFab  = Object.assign({}, FAB_DEFAULT, { etapas: Object.assign({}, FAB_DEFAULT.etapas) });
            v.custoInst = Object.assign({}, INST_DEFAULT);
            v.parametros = paramsDefaultParaLead();
            v.subtotais  = { acessorios: 0, superficies: 0, perfis: 0, frete: 0, comissao: 0 };
            v.total      = 0;
            v.calculadoEm = null;
            v.calcDirty   = true;
            v.chapasSelecionadas = {};
            saveAll(negocios);
            break;
          }
        }
      }
    }
    // modo 'copiar' nao faz nada — criarVersao ja' duplicou tudo da base
    // Felipe sessao 2026-08: modo 'reset-calculos' — preserva o item
    // INTEIRO (todas as caracteristicas digitadas pelo usuario) e zera
    // SO calculos/DRE/custos/aprovacoes. Itens ja' vem clonados da base
    // pelo criarVersao; aqui so' garantimos zerar campos de calculo e
    // limpar qualquer flag de aprovacao herdada (defesa extra).
    if (modo === 'reset-calculos') {
      const negocios = loadAll();
      for (const n of negocios) {
        for (const o of (n.opcoes || [])) {
          const v = (o.versoes || []).find(v => v.id === nova.id);
          if (v) {
            // ITENS: ja' vieram clonados da base via criarVersao — preserva.
            // Zera apenas calculos/DRE/custos/aprovacoes:
            v.subFab    = 0;
            v.subInst   = 0;
            v.custoFab  = Object.assign({}, FAB_DEFAULT, { etapas: Object.assign({}, FAB_DEFAULT.etapas) });
            v.custoInst = Object.assign({}, INST_DEFAULT);
            v.parametros = paramsDefaultParaLead();
            v.subtotais  = { acessorios: 0, superficies: 0, perfis: 0, frete: 0, comissao: 0 };
            v.total      = 0;
            v.calculadoEm = null;
            v.calcDirty   = true;
            v.chapasSelecionadas = {};
            // Defesa: criarVersao ja' nao copia aprovadoEm, mas garantimos
            delete v.aprovadoEm;
            delete v.aprovadoPor;
            delete v.valorAprovado;
            delete v.precoProposta;
            delete v.enviadoParaCard;
            saveAll(negocios);
            break;
          }
        }
      }
    }

    // 4. Ativa a nova versao na UI
    UI.versaoAtivaId = nova.id;
    return nova;
  }

  /**
   * Atualiza dados de uma Versao 'draft'. Versao 'fechada' nao aceita mudanca.
   * Use isto durante a edicao do orcamento; quando user salvar definitivo,
   * chame fecharVersao() pra travar.
   */
  function atualizarVersao(versaoId, dadosNovos) {
    const negocios = loadAll();
    let alvo = null;
    for (const n of negocios) {
      for (const o of (n.opcoes || [])) {
        const v = (o.versoes || []).find(v => v.id === versaoId);
        if (v) { alvo = v; break; }
      }
      if (alvo) break;
    }
    if (!alvo) throw new Error('atualizarVersao: versao nao encontrada');
    if (alvo.status === 'fechada') {
      throw new Error('atualizarVersao: versao fechada eh imutavel — crie nova versao com criarVersao()');
    }
    // campos permitidos de atualizar
    // Felipe (sessao 2026-05): adicionado 'chapasSelecionadas' — antes
    // o duplo clique tentava salvar via window.OrcamentoCore (que NUNCA
    // foi definido), entao a selecao virava lixo. Agora persiste de
    // verdade na versao.
    const camposPermitidos = ['itens', 'observacao', 'subtotais', 'total', 'subFab', 'subInst', 'custoFab', 'custoInst', 'parametros', 'calculadoEm', 'calcDirty', 'wizardEtapaMaxima', '_zerosIntencionais', 'aprovadoEm', 'aprovadoPor', 'valorAprovado', 'chapasSelecionadas'];
    camposPermitidos.forEach(k => {
      if (k in dadosNovos) alvo[k] = dadosNovos[k];
    });
    // Felipe (R-fluxo Calcular/Recalcular): qualquer mudanca em `itens`
    // marca a versao como suja — outras abas (DRE, Lev. Perfis, Custo
    // Fab/Inst, Padroes de Cortes) ficam bloqueadas ate o usuario apertar
    // Recalcular em Caracteristicas do Item. Mudancas via o proprio
    // botao Calcular passam `calcDirty: false` explicitamente e nao sao
    // re-marcadas porque o set abaixo ja foi feito antes.
    if ('itens' in dadosNovos && !('calcDirty' in dadosNovos)) {
      alvo.calcDirty = true;
    }
    saveAll(negocios);
    return alvo;
  }

  /**
   * Fecha uma Versao — torna imutavel. Apos fechar, so consegue criar nova
   * versao (criarVersao) com base nessa.
   */
  function fecharVersao(versaoId) {
    const negocios = loadAll();
    let alvo = null;
    for (const n of negocios) {
      for (const o of (n.opcoes || [])) {
        const v = (o.versoes || []).find(v => v.id === versaoId);
        if (v) { alvo = v; break; }
      }
      if (alvo) break;
    }
    if (!alvo) throw new Error('fecharVersao: versao nao encontrada');
    alvo.status = 'fechada';
    alvo.fechadoEm = nowIso();
    // Felipe (sessao 2026-09): captura snapshot COMPLETO so' aqui.
    // Versoes em draft tem snapshot leve {pendente:true} — quando a
    // versao e' fechada (imutavel), tira o snapshot pesado pra
    // preservar precos historicos.
    if (!alvo.precos_snapshot || alvo.precos_snapshot.pendente) {
      alvo.precos_snapshot = snapshotPrecosCompleto();
    }
    saveAll(negocios);
    return alvo;
  }

  /**
   * Felipe (sessao 2026-06): "preciso de uma opcao para deletar as
   * versoes". Remove uma versao do array da opcao. Protecoes:
   *   - Nao deleta a ultima versao (precisa sobrar pelo menos 1)
   *   - Se a versao deletada e' a ATIVA, troca pra outra antes
   *   - Se a opcao fica vazia, mantem (nao apaga opcao automaticamente)
   */
  function deletarVersao(versaoId) {
    const negocios = loadAll();
    let achou = false;
    for (const n of negocios) {
      for (const o of (n.opcoes || [])) {
        const idx = (o.versoes || []).findIndex(v => v.id === versaoId);
        if (idx !== -1) {
          // Conta quantas versoes existem em TODAS as opcoes desse negocio
          const totalNoNegocio = (n.opcoes || [])
            .reduce((s, op) => s + ((op.versoes || []).length), 0);

          // Felipe sessao 12: TOMBSTONE - marca id como deletado no negocio.
          // Sem isso, o merge protetor de orcamentos/negocios re-injetava
          // versoes "deletadas" porque ainda estavam no cloud (Felipe:
          // 'APERTO PARA DELETAR E NAO ESTA DELETANDO'). Agora o merge
          // respeita a lista _versoesDeletadas do negocio e nao re-adiciona.
          n._versoesDeletadas = Array.isArray(n._versoesDeletadas) ? n._versoesDeletadas : [];
          if (!n._versoesDeletadas.includes(versaoId)) {
            n._versoesDeletadas.push(versaoId);
          }

          // Felipe sessao 12: deletar a ULTIMA versao agora E permitido
          // — cria uma versao nova zerada no lugar (reset) em vez de
          // bloquear. Se quiser comecar do zero o usuario consegue.
          o.versoes.splice(idx, 1);
          achou = true;

          if (totalNoNegocio <= 1) {
            // Era a ultima — cria versao vazia nova na mesma opcao
            const novaVersao = {
              id: uid('ver'),
              numero: 1,
              status: 'draft',
              criadoEm: nowIso(),
              criadoPor: userAtual(),
              observacao: '',
              itens: [],
              precos_snapshot: snapshotPrecosAtual(),
              subFab: 0,
              subInst: 0,
              custoFab:  Object.assign({}, FAB_DEFAULT,  { etapas: Object.assign({}, FAB_DEFAULT.etapas) }),
              custoInst: Object.assign({}, INST_DEFAULT),
              parametros: paramsDefaultParaLead(),
              subtotais: { acessorios: 0, superficies: 0, perfis: 0, frete: 0, comissao: 0 },
              total: 0,
            };
            o.versoes.push(novaVersao);
            UI.versaoAtivaId = novaVersao.id;
            UI.opcaoAtivaId  = o.id;
          } else if (UI.versaoAtivaId === versaoId) {
            // Versao deletada era a ativa, mas ainda ha outras — ativa outra
            for (const op of (n.opcoes || [])) {
              if (op.versoes && op.versoes.length) {
                UI.versaoAtivaId = op.versoes[0].id;
                UI.opcaoAtivaId = op.id;
                break;
              }
            }
          }
          break;
        }
      }
      if (achou) break;
    }
    if (!achou) throw new Error('deletarVersao: versao nao encontrada');
    saveAll(negocios);

    // Felipe sessao 12: ao deletar versao, se NAO sobrou nenhuma aprovada
    // no negocio, zera valor/precoProposta do lead no CRM e volta etapa
    // pra "fazer-orcamento" (se estava em "orcamento-pronto" ou
    // "orcamento-aprovado"). Sem isso o card mostrava preco orfao de
    // versao deletada — Felipe pediu: "ao apagar versao se nao tiver
    // nenhuma retirar preco do card".
    try {
      const negociosAtualizados = loadAll();
      for (const n of negociosAtualizados) {
        let temAprovada = false;
        for (const o of (n.opcoes || [])) {
          for (const v of (o.versoes || [])) {
            if (v.aprovadoEm || v.valorAprovado || v.enviadoParaCard) { temAprovada = true; break; }
          }
          if (temAprovada) break;
        }
        if (!temAprovada && n.leadId) {
          const leads = Storage.scope('crm').get('leads') || [];
          const lead = leads.find(l => l.id === n.leadId);
          if (lead && (Number(lead.valor) > 0 || Number(lead.precoProposta) > 0 ||
              lead.etapa === 'orcamento-pronto' || lead.etapa === 'orcamento-aprovado')) {
            lead.valor = 0;
            lead.precoProposta = 0;
            // Se etapa estava "pronto" ou "aprovado" (que dependiam da versao
            // deletada), volta pra "fazer-orcamento". Mantem etapas posteriores
            // (negociacao/fechado) pra preservar trabalho do usuario.
            if (lead.etapa === 'orcamento-pronto' || lead.etapa === 'orcamento-aprovado') {
              lead.etapa = 'fazer-orcamento';
            }
            Storage.scope('crm').set('leads', leads);
            try {
              if (typeof Events !== 'undefined') Events.emit('crm:reload');
              if (window.Crm && typeof window.Crm.forceReload === 'function') {
                window.Crm.forceReload(null);
              }
            } catch(_) {}
          }
        }
      }
    } catch(e) {
      console.warn('[deletarVersao] zerar valor do card falhou:', e);
    }

    return true;
  }

  /**
   * Felipe (sessao 2026-05): Aprovar Orcamento — empurra o pFatReal
   * (preco real apos desconto) pro lead correspondente do CRM, atualiza
   * a etapa pra "orcamento-pronto" e marca timestamp na versao.
   *
   * Regra: o card do CRM SO mostra valor a partir de "orcamento-pronto"
   * pra frente. Antes disso o valor fica oculto, porque o sistema ainda
   * nao sabe o preco. O botao Aprovar e' o que dispara essa transicao.
   */
  function aprovarOrcamento(versaoId, valorFaturamento, precoPropostaSemDesconto, opts) {
    const valor = Number(valorFaturamento) || 0;
    const precoProposta = Number(precoPropostaSemDesconto) || valor;  // fallback: usa o mesmo valor
    if (valor <= 0) {
      throw new Error('aprovarOrcamento: valor invalido (' + valor + ')');
    }
    // Felipe sessao 2026-08: novo opt-out — quando V2+ aprova localmente
    // (sem substituir valor da V1 no card), passa { enviarParaCard: false }.
    // Default true preserva retrocompat (V1 e Reaprovacao continuam empurrando).
    const enviarParaCard = !opts || opts.enviarParaCard !== false;
    // 1. Marca a versao como aprovada
    const negocios = loadAll();
    let alvo = null;
    for (const n of negocios) {
      for (const o of (n.opcoes || [])) {
        const v = (o.versoes || []).find(v => v.id === versaoId);
        if (v) { alvo = v; break; }
      }
      if (alvo) break;
    }
    if (!alvo) throw new Error('aprovarOrcamento: versao nao encontrada');
    // Felipe sessao 12: BLOQUEIO ANTI-SOBRESCRITA. Versao 'fechada' representa
    // historico imutavel (foi fechada quando uma nova versao foi criada).
    // SOBRESCREVER aprovadoEm/valorAprovado destruia historico real.
    // Cenario do bug Julliana Wagner (sessao 12): UI carregou V1 fechada por
    // engano, Felipe editou DRE, aprovou - sobrescreveu valorAprovado da V1
    // com numeros da "V2" e a V2 foi perdida. Agora rejeita explicitamente.
    if (alvo.status === 'fechada') {
      throw new Error('aprovarOrcamento: versao ' + alvo.numero + ' esta fechada (historico imutavel). Use Revisar ou crie Nova Versao.');
    }
    alvo.aprovadoEm    = nowIso();
    alvo.aprovadoPor   = userAtual();
    alvo.valorAprovado = valor;
    // Felipe (sessao 2026-06): salva tambem o preco DA PROPOSTA (sem
    // desconto = pTab) pra mostrar no card do CRM junto com o valor
    // que o cliente paga (pFatReal).
    alvo.precoProposta = precoProposta;
    // Felipe sessao 2026-08: marca se essa aprovacao empurrou pro card.
    // Importante pra UI saber se mostra "Aprovada localmente" ou nao.
    alvo.enviadoParaCard = enviarParaCard;
    saveAll(negocios);

    // 2. Empurra valor pro lead do CRM e avanca etapa, se aplicavel
    //    Felipe sessao 2026-08: SO empurra se enviarParaCard. V2+ aprovada
    //    localmente NAO substitui o valor que o cliente ja viu (V1 aprovada).
    if (enviarParaCard) {
      try {
        const leadAtivo = lerLeadAtivo();
        if (leadAtivo && leadAtivo.id) {
          const leads = Storage.scope('crm').get('leads') || [];
          const lead = leads.find(l => l.id === leadAtivo.id);
          if (lead) {
            lead.valor = valor;
            lead.precoProposta = precoProposta;  // novo campo
            // So' avanca a etapa se estiver ANTES de orcamento-pronto.
            // Se ja estiver em etapa avancada (negociacao, fechado), preserva.
            const etapasAntes = ['qualificacao', 'fazer-orcamento'];
            if (etapasAntes.includes(lead.etapa)) {
              lead.etapa = 'orcamento-pronto';
            }
            Storage.scope('crm').set('leads', leads);
            // Felipe sessao 2026-08: storage foi atualizado mas o cache em
            // memoria do CRM (state.leads) ainda tem etapa antiga. Sem isso,
            // ao voltar pro CRM o card mostra valor novo (puxado do storage)
            // mas continua na coluna antiga ate F5. Mesma solucao do
            // email-import: emit crm:reload + forceReload direto.
            try {
              if (typeof Events !== 'undefined') Events.emit('crm:reload');
              if (window.Crm && typeof window.Crm.forceReload === 'function') {
                window.Crm.forceReload(null);
              }
            } catch (e) {
              console.warn('[orcamento] reload do CRM apos aprovacao falhou:', e);
            }
          }
        }
      } catch (e) {
        console.warn('[orcamento] aprovarOrcamento: falha ao atualizar lead:', e.message);
      }
    }

    // Felipe sessao 12 (bug Noemi - lead salvo mas versao nao):
    // Forca flush imediato dos saves pendentes (negocios + crm/leads)
    // pra garantir atomicidade. Sem isso, podia acontecer:
    //   1. saveAll(negocios) marca debounce de 500ms
    //   2. lead.valor atualizado, set('leads') marca outro debounce
    //   3. User fecha aba antes dos 500ms
    //   4. Pequeno (lead 23kb) flusha via keepalive, grande (negocios
    //      67kb) excede limite keepalive 64kb e e' descartado
    //   5. Resultado: lead com valor mas versao sem aprovadoEm
    //
    // Fix: flushSbUpsertPendentes() cancela debounces e dispara
    // imediato as 2 requests. Background (sem await) pra UI nao trava.
    try {
      if (window.Database && window.Database.flushSbUpsertPendentes) {
        window.Database.flushSbUpsertPendentes()
          .catch(function(e) { console.warn('[orcamento] flush pos-aprovacao falhou:', e); });
      }
    } catch(_){}

    return alvo;
  }

  /**
   * Felipe sessao 2026-08: "apos aprovar v1 nao pode alterar mais nada,
   * somente se eu apertar botao revisar". Destrava uma versao removendo
   * flags de aprovacao + revertendo status='fechada' pra 'draft'. lead.valor
   * no card NAO eh alterado — permanece com o valor da aprovacao anterior
   * ate o usuario reaprovar.
   *
   * Usado pelo botao Revisar do CRM (OrcDocs.revisarVersaoComConfirma).
   */
  function destravarVersao(versaoId) {
    const negocios = loadAll();
    let alvo = null;
    for (const n of negocios) {
      for (const o of (n.opcoes || [])) {
        const v = (o.versoes || []).find(v => v.id === versaoId);
        if (v) { alvo = v; break; }
      }
      if (alvo) break;
    }
    if (!alvo) throw new Error('destravarVersao: versao nao encontrada');
    // Remove flags de aprovacao
    delete alvo.aprovadoEm;
    delete alvo.aprovadoPor;
    delete alvo.valorAprovado;
    delete alvo.precoProposta;
    delete alvo.enviadoParaCard;
    // Reverte status fechada -> draft
    if (alvo.status === 'fechada') {
      alvo.status = 'draft';
    }
    // calcDirty pra forcar recalculo na proxima abertura
    alvo.calcDirty = true;
    saveAll(negocios);
    return alvo;
  }

  /**
   * Apaga um Negocio inteiro (e todas as suas opcoes/versoes).
   * Uso restrito — em geral nunca se apaga, fica historico.
   */
  function deletarNegocio(negocioId) {
    const negocios = loadAll().filter(n => n.id !== negocioId);
    saveAll(negocios);
  }

  /**
   * Demonstracao de Resultado contabil partindo dos numeros calculados.
   * Recebe o resultado de calcularDRE() e devolve as linhas:
   *   receita_bruta = pFatReal (cliente paga)
   *   - impostos, com_rep, com_rt, com_gest (todos sobre receita_bruta)
   *   = receita_liquida
   *   - custo_direto (subFab + subInst + overhead)
   *   = lucro_bruto
   *   - irpj_csll (34% sobre lucro_bruto)
   *   = lucro_liquido (deve bater com lucro_alvo × receita_bruta)
   *
   * Cada linha vem com valor em R$ e percentual sobre a receita_bruta.
   * Usado pra gerar a Conferencia (tabela tipo DRE oficial).
   */
  function demonstracaoResultado(r) {
    const p = r.params || {};
    const receita = r.pFatReal || 0;
    const pct = (frac) => receita > 0 ? (frac / receita) * 100 : 0;

    const impostos = receita * ((p.impostos || 0) / 100);
    const com_rep  = receita * ((p.com_rep  || 0) / 100);
    const com_rt   = receita * ((p.com_rt   || 0) / 100);
    const com_gest = receita * ((p.com_gest || 0) / 100);
    const total_deducoes = impostos + com_rep + com_rt + com_gest;
    const receita_liquida = receita - total_deducoes;
    const custo_direto = r.custo || 0;
    const lucro_bruto = receita_liquida - custo_direto;
    const irpj_csll = lucro_bruto * IRPJ;
    const lucro_liquido = lucro_bruto - irpj_csll;
    return {
      receita,
      impostos, com_rep, com_rt, com_gest, total_deducoes,
      receita_liquida,
      custo_direto,
      lucro_bruto,
      irpj_csll,
      lucro_liquido,
      // percentuais sobre receita
      pct: {
        impostos: pct(impostos),
        com_rep:  pct(com_rep),
        com_rt:   pct(com_rt),
        com_gest: pct(com_gest),
        total_deducoes: pct(total_deducoes),
        receita_liquida: pct(receita_liquida),
        custo_direto: pct(custo_direto),
        lucro_bruto:  pct(lucro_bruto),
        irpj_csll:    pct(irpj_csll),
        lucro_liquido: pct(lucro_liquido),
      },
    };
  }

  // ============================================================
  const UI = {
    negocioAtivoId: null,
    versaoAtivaId: null,
    leadAtivo: null,           // null se modo dev
    itemSelecionadoIdx: 0,     // qual item da lista esta sendo editado
  };

  // Pra teste local: cria/recupera negocio "dev" enquanto a Etapa 5 (CRM)
  // ainda nao plugou o "Montar Orcamento". Quando o CRM plugar, esse stub some.
  const LEAD_ID_DEV = '__dev_test__';

  // Le qual lead foi sinalizado pelo CRM (via Storage.scope('app').orcamento_lead_ativo).
  // Retorna o lead inteiro do CRM, ou null se nao houver.
  function lerLeadAtivo() {
    try {
      const leadId = Storage.scope('app').get('orcamento_lead_ativo');
      if (!leadId) return null;
      const leads = Storage.scope('crm').get('leads') || [];
      return leads.find(l => l.id === leadId) || null;
    } catch (e) {
      return null;
    }
  }

  function limparLeadAtivo() {
    try { Storage.scope('app').set('orcamento_lead_ativo', null); } catch (e) {}
  }

  /**
   * Zera todo o orcamento do negocio ativo: remove opcoes/versoes existentes
   * e cria uma nova Opcao A · Versao 1 vazia (1 item porta_externa, parametros default).
   * NAO mexe no lead do CRM, so no banco de orcamentos do negocio atual.
   */
  function zerarNegocioAtivo() {
    if (!UI.negocioAtivoId) return;
    const negocios = loadAll();
    const neg = negocios.find(n => n.id === UI.negocioAtivoId);
    if (!neg) return;

    // Felipe sessao 2026-08 REVISAO: "ZERAR E LIMPAR A TELA, NAO APAGAR
    // DADOS DO CARD". Antes (versao errada) recriava neg.opcoes do zero,
    // apagando versoes APROVADAS e fazendo o card perder valor/etapa.
    // Agora preserva o historico:
    //
    //   1. Versoes APROVADAS sao intocadas (continuam no historico)
    //   2. Versao ativa atual:
    //      - Se DRAFT: zera os campos in-place (mantem o id, mas todos
    //        os campos editaveis voltam ao default). UI fica em branco
    //        mas a versao continua sendo a mesma, sem poluir historico.
    //      - Se APROVADA: cria uma nova versao DRAFT em branco com numero
    //        maior e ativa ela. A aprovada permanece intacta.
    //   3. lead.valor / lead.etapa NAO sao tocados (estao no CRM, separado
    //      das versoes do orcamento)
    //
    // Felipe sessao 2026-08 REVISAO 2: BUG do 'Zerar nao zera'. Antes
    // pegava versaoAtual via obterVersao() que faz NOVO loadAll() — e'
    // outra COPIA do storage, descolada do 'neg' que sera salvo.
    // Modificacoes em versaoAtual nao apareciam apos saveAll(negocios).
    // Fix: procurar a versao DENTRO do 'neg' carregado, garantindo
    // mesma referencia.
    let versaoAtual = null;
    for (const o of (neg.opcoes || [])) {
      const v = (o.versoes || []).find(v => v.id === UI.versaoAtivaId);
      if (v) { versaoAtual = v; break; }
    }
    const ehAprovada = !!(versaoAtual && (versaoAtual.aprovadoEm || versaoAtual.valorAprovado));

    if (versaoAtual && !ehAprovada) {
      // ZERA IN-PLACE: limpa todos os campos editaveis mantendo o ID da versao
      versaoAtual.itens = [novoItem('')];
      versaoAtual.subFab = 0;
      versaoAtual.subInst = 0;
      versaoAtual.custoFab = Object.assign({}, FAB_DEFAULT, { etapas: Object.assign({}, FAB_DEFAULT.etapas) });
      versaoAtual.custoInst = Object.assign({}, INST_DEFAULT);
      versaoAtual.parametros = paramsDefaultParaLead();
      versaoAtual.subtotais = { acessorios: 0, superficies: 0, perfis: 0, frete: 0, comissao: 0 };
      versaoAtual.total = 0;
      versaoAtual.calculadoEm = null;
      versaoAtual.calcDirty = false;
      versaoAtual.observacao = '';
      delete versaoAtual.chapasSelecionadas;
      delete versaoAtual.aprovadoEm;
      delete versaoAtual.valorAprovado;
      delete versaoAtual.precoPropostaSemDesconto;
      delete versaoAtual.aprovacaoLocal;
      // Mantem id, numero, criadoEm, criadoPor, status (volta pra draft)
      versaoAtual.status = 'draft';
      // Felipe sessao 31: marca o timestamp do zero pra mergeProtegido_negocios
      // (00-database.js) saber que e' uma limpeza intencional recente e NAO
      // rehidratar os campos do cloud. Sem essa marca, o merge detectava
      // 'localZerado && cloudPreenchido' como stale e restaurava os dados
      // antigos -> 'botao Limpar Tela nao esta limpando'. Marca vence em
      // 60s (depois disso, e' cache real, nao limpeza recente).
      versaoAtual._zeradoEm = nowIso();
    } else {
      // Versao ativa e' aprovada (ou nao existe). Cria nova versao DRAFT
      // em branco com numero maior. Versao aprovada NAO e' tocada.
      let maiorNumero = 0;
      (neg.opcoes || []).forEach(o => (o.versoes || []).forEach(v => {
        if (v.numero > maiorNumero) maiorNumero = v.numero;
      }));
      // Garante que existe pelo menos uma opcao
      if (!neg.opcoes || !neg.opcoes.length) {
        neg.opcoes = [{
          id: uid('opc'),
          letra: 'A',
          titulo: '',
          criadoEm: nowIso(),
          criadoPor: userAtual(),
          versoes: [],
        }];
      }
      const opcA = neg.opcoes[0];
      const versaoId = uid('ver');
      const criadoEm = nowIso();
      const criadoPor = userAtual();
      const versaoNova = {
        id: versaoId,
        numero: maiorNumero + 1,
        status: 'draft',
        criadoEm, criadoPor,
        observacao: '',
        itens: [novoItem('')],
        precos_snapshot: snapshotPrecosAtual(),
        subFab: 0,
        subInst: 0,
        custoFab: Object.assign({}, FAB_DEFAULT, { etapas: Object.assign({}, FAB_DEFAULT.etapas) }),
        custoInst: Object.assign({}, INST_DEFAULT),
        parametros: paramsDefaultParaLead(),
        subtotais: { acessorios: 0, superficies: 0, perfis: 0, frete: 0, comissao: 0 },
        total: 0,
      };
      opcA.versoes.unshift(versaoNova);
      UI.versaoAtivaId = versaoId;
    }

    neg.atualizadoEm = nowIso();
    saveAll(negocios);
    UI.itemSelecionadoIdx = 0;
    // Felipe (sessao 2026-08): "BOTAO ZERAR DEVE ZERAR 100% TUDO, E
    // PRECISO IR NO CARD, APERTAR PARA ABRIR E AI SIM VOLTAR TODOS DADOS".
    // Flag transitoria que suprime a repopulacao na PROXIMA chamada de
    // inicializarSessao (o render que vem logo apos zerar). Quando user
    // volta pelo CRM via "Montar Orcamento", o signal
    // orcamento_repopular_do_lead limpa a flag e força repopulacao.
    UI._suprimirRepopulacaoLead = true;
  }

  // Helpers para o UI atual.
  // Felipe (sessao 2026-05): fmtData local — corrige bug "fmtData is not
  // defined" no botao "Aprovar Orcamento". A funcao existia em 10-crm.js
  // e 11-clientes.js mas em escopo IIFE local (nao exportado). Como o
  // 12-orcamento usa a mesma formatacao em 1 lugar (linha do "aprovado em"),
  // duplico aqui pra manter modulos isolados.
  function fmtData(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }
  function versaoAtiva() {
    if (!UI.versaoAtivaId) return null;
    const r = obterVersao(UI.versaoAtivaId);
    return r ? r.versao : null;
  }
  function itensDaVersao() {
    return versaoAtiva()?.itens || [];
  }
  function itemAtual() {
    const lista = itensDaVersao();
    if (!lista.length) return null;
    const idx = Math.min(UI.itemSelecionadoIdx, lista.length - 1);
    return lista[idx];
  }

  function inicializarSessao() {
    // Sempre re-le o lead ativo (pode ter mudado se user voltou pro CRM)
    const lead = lerLeadAtivo();
    let leadIdAlvo, clienteNome;
    if (lead) {
      leadIdAlvo  = lead.id;
      clienteNome = lead.cliente || '(sem nome)';
    } else {
      leadIdAlvo  = LEAD_ID_DEV;
      clienteNome = 'Cliente dev (modo teste local)';
    }
    let neg = obterNegocioPorLeadId(leadIdAlvo);
    if (!neg) neg = criarNegocio({ leadId: leadIdAlvo, clienteNome });
    UI.negocioAtivoId = neg.id;

    // Felipe (sessao 2026-08): "PERMITA EU FAZER CALCULOS DE TODOS OS
    // ITENS SEM CARD CRM, POSSO COLOCAR TUDO CALCULAR ELE SO NAO VAI
    // SALVAR EM LUGAR NENHUM DO CARD, E SE EU APERTAR ZERAR ZERA TUDO".
    //
    // Antes (sessao 2026-05): em modo dev sempre zerava ao entrar.
    // Agora: preserva os dados — usuario pode entrar/sair e continuar
    // calculando. Em modo dev nao tem card pra salvar mesmo, entao
    // os calculos ficam apenas no localStorage (negocio_dev). Quando
    // aperta o botao "🗑 Zerar" ai sim limpa tudo.
    //
    // Comportamento atual:
    //  - Modo COM LEAD: persiste em negocio do lead (workflow normal)
    //  - Modo DEV (sem lead): persiste em negocio_dev — nao vai pra
    //    nenhum card, mas Felipe pode continuar de onde parou.

    // Felipe (req 7 do CRM): se o CRM sinalizou uma versao especifica
    // (dropdown 'Abrir Versao' no card), abre nela. Senao, primeira versao.
    let versaoAlvo = null;

    // Felipe sessao 2026-08 REVISAO: signal "forcar repopulacao do lead"
    // setado pelo botao "Montar Orcamento" do CRM. Limpa a flag de
    // suprimir-repopulacao (que pode ter sido setada por Zerar anterior)
    // e força repopulação dos dados do lead na tela inicial.
    const forcarRepop = Storage.scope('app').get('orcamento_repopular_do_lead');
    if (forcarRepop === '1') {
      UI._suprimirRepopulacaoLead = false;
      Storage.scope('app').remove('orcamento_repopular_do_lead');
    }

    const versaoSinalizadaId = Storage.scope('app').get('orcamento_versao_ativa');
    if (versaoSinalizadaId) {
      // Felipe sessao 2026-08: vir do CRM (signal setado) limpa a flag
      // de suprimir-repopulacao. Usuario veio explicitamente pra ver os
      // dados (clicou no card → "abrir versao"), entao queremos repopular.
      UI._suprimirRepopulacaoLead = false;
      const r = obterVersao(versaoSinalizadaId);
      // So aceita se a versao ainda existe E pertence ao mesmo negocio
      if (r && r.negocio && r.negocio.id === neg.id) {
        versaoAlvo = r.versao;
      }
      // Limpa pra nao "grudar" — proxima abertura volta pra padrao
      Storage.scope('app').remove('orcamento_versao_ativa');
    }
    if (!versaoAlvo) {
      // Felipe sessao 12: ANTES pegava versoes[0] cegamente. Como criarVersao
      // faz .push (nova versao vai pro fim), versoes[0] era a MAIS ANTIGA -
      // possivelmente uma versao 'fechada' (historico). Bug Julliana Wagner:
      // V1 aprovada+fechada (idx 0), V2 ativa (idx 1). Sem signal, sistema
      // jogava em V1 fechada. Felipe editava sem perceber e a aprovacao
      // sobrescrevia a V1 - a V2 ficava orfa.
      // FIX: prioriza versoes NAO fechadas. Se houver alguma com status='draft',
      // pega a MAIOR numero. Se todas fechadas, pega a MAIOR numero (mais recente).
      const todasVersoes = neg.opcoes[0].versoes || [];
      const naoFechadas = todasVersoes.filter(v => v.status !== 'fechada');
      const candidatas = naoFechadas.length > 0 ? naoFechadas : todasVersoes;
      // Pega versao com MAIOR numero (mais recente)
      versaoAlvo = candidatas.reduce((maior, v) => {
        if (!maior) return v;
        return (Number(v.numero) || 0) > (Number(maior.numero) || 0) ? v : maior;
      }, null);
      if (!versaoAlvo) versaoAlvo = todasVersoes[0]; // fallback final
    }
    UI.versaoAtivaId = versaoAlvo.id;
    // FIX 2026-05-04: prepopular tambem quando ja existe Item 1 mas
    // virgem (caso AGP004647). Antes: so' rodava quando itens.length===0.
    // Resultado: usuario abria orcamento, voltava pro card, preenchia
    // os dados da porta, clicava Montar Orcamento, e os campos vinham
    // vazios pq o item 1 ja existia. Agora detecta "item virgem" e
    // popula sem criar novo item.
    function _itemVirgem(it) {
      if (!it) return true;
      const lar = String(it.largura || '').trim();
      const alt = String(it.altura  || '').trim();
      const mod = String(it.modeloExterno || it.modeloInterno || it.modeloNumero || '').trim();
      const cor = String(it.corExterna || it.corInterna || '').trim();
      return !lar && !alt && !mod && !cor;
    }

    // Felipe sessao 2026-08: detecta revestimento da chapa baseado na cor.
    // Faz lookup em Storage('cadastros').superficies_lista procurando uma
    // superficie cuja descricao contenha o codigo/nome da cor importada.
    // Retorna a string que casa com as opcoes do select Revestimento:
    //   'ACM 4mm' | 'HPL 4mm' | 'Aluminio Macico 2mm' | 'Vidro' | ''
    // Ex: cor='PRO0157T - PRETO WEATHERXL BB LDPE' cadastrada como
    // 'PRO0157T - PRETO WEATHERXL BB LDPE - ACM 4mm 1500x5000' (categoria
    // 'acm') -> retorna 'ACM 4mm'.
    function _detectarRevestimentoPorCor(corStr) {
      if (!corStr) return '';
      const cor = String(corStr).trim();
      if (!cor) return '';
      try {
        const lista = Storage.scope('cadastros').get('superficies_lista') || [];
        if (!lista.length) return '';

        // Extrai o codigo da cor (parte antes do primeiro '-' ou ' ')
        // Ex: 'PRO0157T - PRETO WEATHERXL BB LDPE' -> 'PRO0157T'
        const codigoMatch = cor.match(/^[A-Z0-9]+/i);
        const codigoCor = codigoMatch ? codigoMatch[0].toUpperCase() : '';
        const corLower = cor.toLowerCase();

        // Procura: 1) match exato pelo codigo, 2) descricao contem cor inteira
        let achada = null;
        if (codigoCor) {
          achada = lista.find(s => {
            const d = String(s.descricao || '').toUpperCase();
            return d.indexOf(codigoCor) >= 0;
          });
        }
        if (!achada) {
          achada = lista.find(s => String(s.descricao || '').toLowerCase().indexOf(corLower) >= 0);
        }
        if (!achada) return '';

        const cat = String(achada.categoria || '').toLowerCase();
        // Mapa categoria -> opcao do select
        if (cat === 'acm')              return 'ACM 4mm';
        if (cat === 'hpl')              return 'HPL 4mm';
        if (cat === 'aluminio_macico')  return 'Aluminio Macico 2mm';
        if (cat === 'vidro')            return 'Vidro';
        return '';
      } catch (e) {
        console.warn('[orcamento] _detectarRevestimentoPorCor falhou:', e);
        return '';
      }
    }
    const itensAtuais = versaoAlvo.itens || [];
    const versaoVazia = itensAtuais.length === 0;
    const primeiroVirgem = itensAtuais.length === 1 && _itemVirgem(itensAtuais[0]);

    // Felipe (sessao 2026-08): flag setada por zerarNegocioAtivo. PERSISTE
    // entre abas internas (item, custo, dre, proposta, etc) - so' e' limpa
    // quando user volta pelo CRM (signal orcamento_versao_ativa) ou
    // recarrega pagina (UI in-memory reseta). Sem essa persistencia,
    // trocar de aba apos Zerar repopulava os dados de novo.
    const suprimirRepop = !!UI._suprimirRepopulacaoLead;

    if ((versaoVazia || primeiroVirgem) && !suprimirRepop) {
      // Caso vazio: cria item novo. Caso virgem: reusa item existente
      // (preserva o id pra nao quebrar referencias).
      const itemInicial = versaoVazia ? novoItem('') : Object.assign({}, itensAtuais[0]);
      // Pre-preenche com dados da porta vindos do agente de email OU do lead manual
      if (lead && (lead.porta_largura || lead.porta_modelo)) {
        itemInicial.tipo = 'porta_externa';
        // Preenche APENAS se o campo do item estiver vazio (nao sobrescreve
        // edicao manual do usuario - protecao extra).
        if (!itemInicial.largura && lead.porta_largura) itemInicial.largura = lead.porta_largura;
        if (!itemInicial.altura  && lead.porta_altura)  itemInicial.altura  = lead.porta_altura;
        // Felipe sessao 12: quantidade do card -> quantidade do item no orcamento.
        // Default 1 se nao tiver no lead. So aplica se o item ainda nao foi editado
        // (item virgem com qtd=1) pra preservar edicao manual.
        const leadQtd = Math.max(1, parseInt(lead.porta_quantidade, 10) || 1);
        if ((Number(itemInicial.quantidade) || 1) === 1 && leadQtd > 1) {
          itemInicial.quantidade = leadQtd;
        } else if (!itemInicial.quantidade) {
          itemInicial.quantidade = leadQtd;
        }
        if (lead.porta_modelo) {
          if (!itemInicial.modeloNumero)  itemInicial.modeloNumero  = lead.porta_modelo;
          if (!itemInicial.modeloExterno) itemInicial.modeloExterno = lead.porta_modelo;
          if (!itemInicial.modeloInterno) itemInicial.modeloInterno = lead.porta_modelo;
        }
        if (lead.porta_cor) {
          if (!itemInicial.corExterna) itemInicial.corExterna = lead.porta_cor;
          if (!itemInicial.corInterna) itemInicial.corInterna = lead.porta_cor;
          // Felipe sessao 2026-08: auto-detecta revestimento pela cor.
          // Se a cor importada esta cadastrada em Superficies (acm/hpl/
          // aluminio_macico/vidro), preenche o select de Revestimento
          // automaticamente. Felipe pode trocar manualmente depois.
          if (!itemInicial.revestimento) {
            const revAuto = _detectarRevestimentoPorCor(lead.porta_cor);
            if (revAuto) itemInicial.revestimento = revAuto;
          }
        }
        // Fechadura Digital: agora pode ser codigo real (PA-DIG ...) ou 'sim'/'nao' antigo
        var fd = lead.porta_fechadura_digital;
        if (fd && fd !== 'nao' && fd !== '' && !itemInicial.fechaduraDigital) {
          itemInicial.fechaduraDigital = (fd === 'sim') ? 'Sim' : fd;  // codigo do acessorio
        }
        // Felipe sessao 2026-05: aplica regras automaticas (fechadura mecanica
        // por altura, sistema por largura, cilindro KESO default) AGORA que os
        // campos estao preenchidos. Antes, isso so' rodava quando o usuario
        // editava campo - resultado: lead vinha sem fechadura mecanica auto.
        try { aplicarRegrasAutoItem(itemInicial); } catch (e) { console.warn('[orcamento] aplicarRegrasAutoItem falhou:', e); }
      }

      // Felipe sessao 12 (Etapa 2): leva os itens_extras do card pro orcamento.
      // CRM tipo -> Orcamento tipo:
      //   porta_externa       -> porta_externa
      //   porta_interna       -> porta_interna
      //   rev_acoplado_porta  -> fixo_acoplado
      //   rev_parede          -> revestimento_parede
      const TIPO_CRM_TO_ORC = {
        'porta_externa':      'porta_externa',
        'porta_interna':      'porta_interna',
        'rev_acoplado_porta': 'fixo_acoplado',
        'rev_parede':         'revestimento_parede',
      };
      const itensExtrasOrc = [];
      const itensExtrasLead = (lead && Array.isArray(lead.itens_extras)) ? lead.itens_extras : [];
      itensExtrasLead.forEach(ext => {
        const tipoOrc = TIPO_CRM_TO_ORC[ext.tipo];
        if (!tipoOrc) return; // tipo desconhecido — pula
        const novo = novoItem(tipoOrc);
        novo.quantidade = Math.max(1, parseInt(ext.quantidade, 10) || 1);

        // Felipe sessao 12: rev_parede tem campos diferentes — usa
        // largura_total/altura_total (nao largura/altura) e modo automatico
        // se vier medida do card. Card mostra largura+altura+cor.
        if (tipoOrc === 'revestimento_parede') {
          if (ext.largura) novo.largura_total = ext.largura;
          if (ext.altura)  novo.altura_total  = ext.altura;
          // Tem medida -> modo automatico (default era 'manual')
          if (ext.largura && ext.altura) novo.modo = 'automatico';
          // Cor: rev_parede tem 1 face so' (campo 'cor', nao corExterna/Interna)
          if (ext.cor) {
            novo.cor = ext.cor;
            // Detecta revestimento (ACM/HPL/Aluminio/Vidro) pela cor
            if (!novo.revestimento) {
              const revAutoR = _detectarRevestimentoPorCor(ext.cor);
              if (revAutoR) novo.revestimento = revAutoR;
            }
          }
          itensExtrasOrc.push(novo);
          return;
        }

        if (ext.largura) novo.largura = ext.largura;
        if (ext.altura)  novo.altura  = ext.altura;
        // Modelo (so faz sentido pra portas)
        if (ext.modelo && (tipoOrc === 'porta_externa' || tipoOrc === 'porta_interna')) {
          novo.modeloNumero  = ext.modelo;
          novo.modeloExterno = ext.modelo;
          novo.modeloInterno = ext.modelo;
        }
        // Modelo do fixo_acoplado tb aceita modeloNumero
        if (ext.modelo && tipoOrc === 'fixo_acoplado') {
          novo.modeloNumero = ext.modelo;
          novo.fixoSegueModelo = 'nao'; // se tem modelo proprio, nao segue porta
        }
        // Cor (porta_externa/fixo_acoplado tem corExterna+corInterna; outros so corExterna)
        if (ext.cor) {
          if ('corExterna' in novo) novo.corExterna = ext.cor;
          if ('corInterna' in novo) novo.corInterna = ext.cor;
          // Detecta revestimento automatico pela cor
          if ('revestimento' in novo && !novo.revestimento) {
            const revAuto = _detectarRevestimentoPorCor(ext.cor);
            if (revAuto) novo.revestimento = revAuto;
          }
        }
        // Aplica regras auto pra portas (fechadura mecanica/cilindro/sistema)
        if (tipoOrc === 'porta_externa') {
          try { aplicarRegrasAutoItem(novo); } catch(_){}
        }
        itensExtrasOrc.push(novo);
      });

      // So adiciona itens novos se ainda nao foram adicionados (evita duplicar
      // ao reabrir o orcamento). Detecta por: itemInicial e' o unico, e nao
      // tem outros itens depois.
      const itensFinaisVersao = itensExtrasOrc.length > 0
        ? [itemInicial].concat(itensExtrasOrc)
        : [itemInicial];
      atualizarVersao(versaoAlvo.id, { itens: itensFinaisVersao });
      // Felipe sessao 12: 'revestimento parede 7 nao deixa apagar sendo que
      // nem tem 7 itens no card'. Apos sync executado, marca a flag pra
      // BLOQUEAR sync novo na proxima abertura. Sem isso, Felipe deletava
      // um item, voltava pro card e abria de novo - sync recriava o item
      // (recriation loop). Pra rodar sync novamente, Felipe usa botao
      // 'Montar Orcamento' do CRM (que limpa a flag em forcarRepop).
      UI._suprimirRepopulacaoLead = true;
    } else if (!suprimirRepop && lead && Array.isArray(lead.itens_extras) && lead.itens_extras.length > 0) {
      // Felipe sessao 12 (caso adicional): orcamento ja tem Item 1 (porta
      // principal), mas o lead ganhou novos itens_extras DEPOIS que o orcamento
      // foi populado pela 1a vez. Adiciona so os que ainda nao estao no orcamento
      // (compara por tipo+largura+altura+cor pra heuristica de "ja' existe").
      // Sem isso, adicionar item no card depois nao chegava no orcamento.
      const TIPO_CRM_TO_ORC = {
        'porta_externa':      'porta_externa',
        'porta_interna':      'porta_interna',
        'rev_acoplado_porta': 'fixo_acoplado',
        'rev_parede':         'revestimento_parede',
      };
      const itensJa = versaoAlvo.itens || [];
      // Felipe sessao 12: chave usa cor pra rev_parede (item.cor) E corExterna pra portas/fixo
      const chaveItem = (it) => {
        const corChave = it.tipo === 'revestimento_parede'
          ? (it.cor || '')
          : (it.corExterna || '');
        const larChave = it.tipo === 'revestimento_parede' ? (it.largura_total || '') : (it.largura || '');
        const altChave = it.tipo === 'revestimento_parede' ? (it.altura_total  || '') : (it.altura  || '');
        return [it.tipo, larChave, altChave, corChave].join('|');
      };
      const setExistente = new Set(itensJa.map(chaveItem));
      const novosItens = [];
      lead.itens_extras.forEach(ext => {
        const tipoOrc = TIPO_CRM_TO_ORC[ext.tipo];
        if (!tipoOrc) return;
        // Pula porta_externa que casa com Item 1 (porta principal ja' la)
        if (tipoOrc === 'porta_externa' &&
            String(ext.largura) === String(lead.porta_largura || '') &&
            String(ext.altura)  === String(lead.porta_altura  || '')) return;
        const novo = novoItem(tipoOrc);
        novo.quantidade = Math.max(1, parseInt(ext.quantidade, 10) || 1);

        // Felipe sessao 12: rev_parede usa largura_total/altura_total + modo
        // automatico se vier medida + cor (1 face so').
        if (tipoOrc === 'revestimento_parede') {
          if (ext.largura) novo.largura_total = ext.largura;
          if (ext.altura)  novo.altura_total  = ext.altura;
          if (ext.largura && ext.altura) novo.modo = 'automatico';
          if (ext.cor) {
            novo.cor = ext.cor;
            if (!novo.revestimento) {
              const revAutoR = _detectarRevestimentoPorCor(ext.cor);
              if (revAutoR) novo.revestimento = revAutoR;
            }
          }
          if (!setExistente.has(chaveItem(novo))) {
            novosItens.push(novo);
            setExistente.add(chaveItem(novo));
          }
          return;
        }

        if (ext.largura) novo.largura = ext.largura;
        if (ext.altura)  novo.altura  = ext.altura;
        if (ext.modelo && (tipoOrc === 'porta_externa' || tipoOrc === 'porta_interna')) {
          novo.modeloNumero  = ext.modelo;
          novo.modeloExterno = ext.modelo;
          novo.modeloInterno = ext.modelo;
        }
        if (ext.modelo && tipoOrc === 'fixo_acoplado') {
          novo.modeloNumero = ext.modelo;
          novo.fixoSegueModelo = 'nao';
        }
        if (ext.cor) {
          if ('corExterna' in novo) novo.corExterna = ext.cor;
          if ('corInterna' in novo) novo.corInterna = ext.cor;
          if ('revestimento' in novo && !novo.revestimento) {
            const revAuto = _detectarRevestimentoPorCor(ext.cor);
            if (revAuto) novo.revestimento = revAuto;
          }
        }
        if (tipoOrc === 'porta_externa') {
          try { aplicarRegrasAutoItem(novo); } catch(_){}
        }
        // So adiciona se nao tem item igual (heuristica simples)
        if (!setExistente.has(chaveItem(novo))) {
          novosItens.push(novo);
          setExistente.add(chaveItem(novo));
        }
      });
      if (novosItens.length > 0) {
        atualizarVersao(versaoAlvo.id, { itens: itensJa.concat(novosItens) });
      }
      // Felipe sessao 12: marca pra travar re-sync na proxima abertura.
      // Mesma logica do bloco 1 acima.
      UI._suprimirRepopulacaoLead = true;
    }
    UI.leadAtivo = lead;
    // Mantem itemSelecionadoIdx valido (re-le pra pegar lista atualizada)
    const lista = itensDaVersao();
    if (UI.itemSelecionadoIdx >= lista.length) {
      UI.itemSelecionadoIdx = 0;
    }
  }

  /**
   * Factory de itens. Cada tipo tem sua estrutura propria.
   * Por enquanto apenas porta_externa tem campos completos;
   * os outros sao stubs ate Felipe especificar.
   *
   * Felipe (Sessao 2 do Orcamento): tipo='' (vazio) e o estado inicial.
   * A UI mostra tela de escolha (4 cards) ate o usuario escolher.
   */
  /**
   * Felipe (do doc): garante que TODA porta tenha os campos novos com
   * defaults — tem_alisar, largura_alisar (100), espessura_parede (250),
   * larguraBordaCava, espessuraCava, larguraBordaFriso. Itens antigos
   * que nao tinham esses campos ganham os defaults aqui sem precisar
   * de migracao no storage.
   *
   * Chamado quando itens sao lidos pra renderizar/calcular. Idempotente.
   */
  function normalizarItem(item) {
    if (!item || item.tipo !== 'porta_externa') return item;
    if (item.tem_alisar === undefined || item.tem_alisar === null) item.tem_alisar = 'Sim';
    if (item.largura_alisar === undefined || item.largura_alisar === null || item.largura_alisar === '') item.largura_alisar = 100;
    if (item.espessura_parede === undefined || item.espessura_parede === null || item.espessura_parede === '') item.espessura_parede = 250;
    // Felipe (sessao 2026-05): MIGRACAO RETRO-COMPAT do modelo unico
    // pra modeloExterno + modeloInterno separados. Se o item legado tem
    // modeloNumero preenchido E modeloExterno vazio → copia. Mesmo pra
    // modeloInterno (assume que itens antigos tinham mesmo modelo nos
    // 2 lados). Idempotente: se ja foi migrado, nao sobrescreve.
    if (item.modeloExterno === undefined || item.modeloExterno === null || item.modeloExterno === '') {
      item.modeloExterno = item.modeloNumero || '';
    }
    if (item.modeloInterno === undefined || item.modeloInterno === null || item.modeloInterno === '') {
      item.modeloInterno = item.modeloNumero || '';
    }
    // Mantem modeloNumero sincronizado com modeloExterno (calculo legado
    // de regras de fabricacao usa modeloNumero — se mudar so o externo,
    // o codigo legado continua funcionando porque modeloNumero acompanha).
    if (item.modeloExterno && item.modeloNumero !== item.modeloExterno) {
      item.modeloNumero = item.modeloExterno;
    }
    // Felipe (do doc): renomeacao dos campos da CAVA. Antes:
    //   larguraBordaCava → agora: distanciaBordaCava
    //   espessuraCava    → agora: tamanhoCava
    //   larguraBordaFriso → agora: distanciaBordaFrisoVertical
    //   distanciaBordaFriso → agora: distanciaBordaFrisoHorizontal (fallback do antigo)
    // Migra valores antigos (alias retroativo) sem perder dados ja gravados.
    if (item.distanciaBordaCava === undefined || item.distanciaBordaCava === '') {
      if (item.larguraBordaCava !== undefined && item.larguraBordaCava !== '') {
        item.distanciaBordaCava = item.larguraBordaCava;
      } else {
        item.distanciaBordaCava = '';
      }
    }
    if (item.tamanhoCava === undefined || item.tamanhoCava === '') {
      if (item.espessuraCava !== undefined && item.espessuraCava !== '') {
        item.tamanhoCava = item.espessuraCava;
      } else {
        item.tamanhoCava = '';
      }
    }
    if (item.distanciaBordaFrisoVertical === undefined || item.distanciaBordaFrisoVertical === '') {
      if (item.larguraBordaFriso !== undefined && item.larguraBordaFriso !== '') {
        item.distanciaBordaFrisoVertical = item.larguraBordaFriso;
      } else {
        item.distanciaBordaFrisoVertical = '';
      }
    }
    if (item.distanciaBordaFrisoHorizontal === undefined) {
      // distanciaBordaFriso era o nome legacy generico
      item.distanciaBordaFrisoHorizontal = item.distanciaBordaFriso || '';
    }
    // Garante que TODAS as chaves existem (vazias) pra inputs renderizarem
    const camposNovos = ['distanciaBordaFrisoHorizontal1', 'distanciaBordaFrisoHorizontal2',
                          'espessuraFriso', 'quantidadeFrisos', 'larguraRipas',
                          'tipoRipado', 'espacamentoRipas',
                          'tipoMoldura', 'quantasDivisoesMoldura', 'quantidadeMolduras',
                          'distanciaBorda1aMoldura', 'distancia1a2aMoldura', 'distancia2a3aMoldura',
                          'perfilMoldura',
                          // Felipe (sessao 2026-05): corCava — em modelos
                          // com cava, a cava pode ter cor diferente.
                          'corCava'];
    camposNovos.forEach(c => {
      if (item[c] === undefined) item[c] = '';
    });
    // Felipe (Modelo 23 - msg molduras): renomeacao retroativa.
    //   distanciaBordaMoldura → distanciaBorda1aMoldura
    //   materialMoldura ('Aluminio Macico'/'Outro') → descartado (perfilMoldura agora e' o codigo)
    if (item.distanciaBordaMoldura !== undefined && item.distanciaBordaMoldura !== '' &&
        (item.distanciaBorda1aMoldura === undefined || item.distanciaBorda1aMoldura === '')) {
      item.distanciaBorda1aMoldura = item.distanciaBordaMoldura;
    }
    return item;
  }
  function normalizarItensVersao(versao) {
    if (!versao || !Array.isArray(versao.itens)) return;
    versao.itens.forEach(normalizarItem);
  }

  // Felipe sessao 14: le folgas do cadastro Regras > Variaveis (FGLD/FGLE/FGA)
  // pra popular item NOVO. Se cadastro mudar de 10 pra 15, novos itens vem
  // com 15 (existentes mantem o que foi salvo). Usa familia '76' (PA006)
  // como padrao - PA007 tem mesmos defaults entao tanto faz.
  function lerFolgasPadraoCadastro() {
    try {
      const v = (window.Storage ? Storage.scope('cadastros').get('regras_variaveis_porta_externa') : null);
      const fam = (v && v['76']) || null;
      if (fam) {
        return {
          fglDir: (fam.FGLD != null ? Number(fam.FGLD) : 10),
          fglEsq: (fam.FGLE != null ? Number(fam.FGLE) : 10),
          fgSup:  (fam.FGA  != null ? Number(fam.FGA)  : 10),
        };
      }
    } catch(_) {}
    return { fglDir: 10, fglEsq: 10, fgSup: 10 };
  }

  // Felipe sessao 14 (continuacao): usado nos inputs do form. Se item esta
  // com folga vazia (item antigo, criado antes do auto-fill), exibe o valor
  // do cadastro como value visivel. Usuario ve 10 (ou 15 se mudou cadastro)
  // em vez de campo vazio. Motor de calculo ja faz mesmo fallback (28-...,
  // 36-..., 38-...), entao bate com o que aparece na UI.
  function _folgaParaInput(item, field) {
    const v = item && item[field];
    if (v === '' || v === null || v === undefined) {
      const fg = lerFolgasPadraoCadastro();
      const def = fg[field];
      return def != null ? String(def) : '10';
    }
    return String(v);
  }

  // Felipe (sessao 2026-05-10): novoItem agora aceita versaoAtual
  // opcional pra herdar revestimento/cor da PORTA ANTERIOR ao criar
  // um Fixo Acoplado. Pedido Felipe: "quando for fixo acoplado a
  // porta, ja traga revestimento e cor igual da porta, muito raro
  // voce ter cor diferente, mas ao criar o fixo acoplado a porta
  // pegue as caracteristicas de cor e revestimento o item anterior
  // que deve ser uma porta, deixe livre para escolha, mas mantenha
  // igual, se alterar a cor e revestimento da porta altere tambem
  // do fixo acoplado a porta".
  //
  // Strategy:
  //   - Cria item normal (defaults).
  //   - Se for fixo_acoplado E versaoAtual tem porta_externa antes,
  //     copia revestimento + cores (corExterna, corInterna, corCava,
  //     corChapaAM_Ext, corChapaAM_Int) DA ULTIMA porta da versao.
  //   - Marca __syncPortaIdx pra rastrear sync.
  //   - Quando o user edita manualmente qualquer campo no fixo, o
  //     handler limpa __syncPortaIdx (perde sincronia).
  //   - Quando o user edita rev/cor da porta, handler propaga pros
  //     fixos que AINDA estao com __syncPortaIdx === idx_da_porta.
  function novoItem(tipo, versaoAtual) {
    if (!tipo)                    return { tipo: '', quantidade: 1 };
    if (tipo === 'porta_externa') return novoItemPortaExterna();
    if (tipo === 'porta_interna') return {
      tipo: 'porta_interna',
      quantidade: 1,
      largura: '',
      altura: '',
      // Felipe sessao 31: largura da parede (espessura) — campo
      // informativo nas Caracteristicas. Pode ser usado em peças
      // futuras (vedações que dependem da parede).
      larguraParede: '',
      modeloNumero: 1,
      // Felipe sessao 31: 3 folgas UNIFICADAS (igual porta externa), defaults 5
      //   fglEsq → desconto na largura (esquerda)
      //   fglDir → desconto na largura (direita)
      //   fgSup  → desconto na altura (superior)
      // Aplicam em TODOS os perfis: batente, click batente, folha, click folha.
      fglEsq: 5,
      fglDir: 5,
      fgSup:  5,
      // Felipe sessao 31: revestimento+cor SEPARADOS pra cada face
      revestimentoExterno: '',
      revestimentoInterno: '',
      corExterna: '',
      corInterna: '',
      // Felipe sessao 31: fechadura com modo conjunto/personalizado
      // Conjunto: 1 kit Hafele (fechaduraInternaCodigo)
      // Personalizado: maquina + macaneta + cilindro separados
      fechaduraModo: 'conjunto',
      fechaduraInternaCodigo: '',  // usado no modo CONJUNTO (kit Hafele)
      fechaduraInternaCor: '',
      maquinaInternaCodigo: '',    // usado no modo PERSONALIZADO (familia Fechadura Mecanica)
      macanetaInternaCodigo: '',   // usado em PERSONALIZADO (familia Macanetas)
      cilindroInternaCodigo: '',   // usado em PERSONALIZADO (familia Cilindros)
      dobradicaCor: '',
    };
    if (tipo === 'fixo_acoplado') {
      const fg = lerFolgasPadraoCadastro();
      const novo = {
      tipo: 'fixo_acoplado',
      quantidade: 1,
      largura: '',
      altura: '',
      // Felipe sessao 30: campos pro motor de calculo
      posicao: 'superior',         // 'superior' | 'lateral'
      temEstrutura: 'sim',         // 'sim' (quadro+chapas) ou 'nao' (so chapas, sem perfis)
      sistema: 'PA006',            // PA006 (espTubo 51) ou PA007 (espTubo 38) — so' aparece se temEstrutura='sim'
      modeloNumero: 1,             // 1 = Liso (default — pode ser editado)
      revestimento: '',            // material da chapa: ACM 4mm | HPL 4mm | Aluminio Macico 2mm | Vidro
      // Felipe sessao 13: quando revestimento='Vidro', vidroDescricao
      // guarda a descricao do vidro escolhido no cadastro de superficies
      // (ex: 'Laminado Incolor 3+3...'). Cada vidro tem campo 'cobranca'
      // m2|chapa que define como precificar.
      vidroDescricao: '',
      // Felipe sessao 13: tipoLateral so' aplica quando posicao='lateral'
      // e revestimento != Vidro. Lateral nao replica modelo da porta —
      // normalmente e' chapa lisa, mas pode ser Ripado ou Moldura.
      tipoLateral: 'lisa',         // 'lisa' | 'ripado' | 'moldura'
      corExterna: '',
      corInterna: '',
      lados: '1lado',              // '1lado' (so externo) ou '2lados' (externo+interno) — ignorado se vidro
      fixoSegueModelo: 'sim',      // 'sim' (default — replica porta) ou 'nao' (escolher modelo proprio)
      // Felipe sessao 14: folgas vem POPULADAS do cadastro Regras >
      // Variaveis (FGLD/FGLE/FGA). Usuario pode editar caso queira
      // override por item.
      fglDir: fg.fglDir,
      fglEsq: fg.fglEsq,
      fgSup:  fg.fgSup,
    };

      // Felipe sessao 2026-05-10: herda rev/cor da ULTIMA porta da versao.
      try {
        const itens = (versaoAtual && Array.isArray(versaoAtual.itens))
          ? versaoAtual.itens : [];
        // procura a ultima porta_externa
        let portaIdx = -1;
        for (let i = itens.length - 1; i >= 0; i--) {
          if (itens[i] && itens[i].tipo === 'porta_externa') { portaIdx = i; break; }
        }
        if (portaIdx >= 0) {
          const porta = itens[portaIdx];
          if (porta.revestimento)  novo.revestimento  = porta.revestimento;
          if (porta.corExterna)    novo.corExterna    = porta.corExterna;
          if (porta.corInterna)    novo.corInterna    = porta.corInterna;
          if (porta.corCava)       novo.corCava       = porta.corCava;
          if (porta.corChapaAM_Ext) novo.corChapaAM_Ext = porta.corChapaAM_Ext;
          if (porta.corChapaAM_Int) novo.corChapaAM_Int = porta.corChapaAM_Int;
          // Marca sync: se user editar rev/cor da porta, propaga.
          // Se user editar no fixo, perde sync.
          novo.__syncPortaIdx = portaIdx;

          // Felipe sessao 2026-05-10: 'quando tem fixo superior alisar
          // e somente interno e essa decisao alterara quantidade de
          // pecas nas chapas'. Felipe confirmou: 'detectar fixo superior
          // automaticamente e mudar default pra 1 lado'.
          //
          // Fixo nasce com posicao='superior' (default em novoItem).
          // Marca tem_alisar='Interno' na porta SE:
          //   - posicao do novo fixo eh 'superior' (default)
          //   - porta ainda tem tem_alisar='Sim' (legado/default, user
          //     nao editou manualmente)
          // Flag __alisarAutoFixoSuperior rastreia mudanca automatica
          // pra permitir reverter se user trocar pra lateral.
          if (novo.posicao === 'superior' && (porta.tem_alisar === 'Sim' || porta.tem_alisar === undefined)) {
            porta.tem_alisar = 'Interno';
            porta.__alisarAutoFixoSuperior = portaIdx;  // marca que foi auto
            console.log('[Sync] Fixo superior criado - porta', portaIdx, 'tem_alisar -> Interno (automatico)');
          }
        }
      } catch (_) {
        // sem porta anterior - cria item vazio normalmente
      }

      return novo;
    }
    if (tipo === 'revestimento_parede') return {
      tipo: 'revestimento_parede',
      quantidade: 1,
      area: '',
      modo: 'manual',
      pecas: [],
      // Felipe sessao 14: estilo do revestimento (lisa | ripada | classica)
      // Por agora apenas registro/diferenciacao no item, sem efeito em
      // calculo. Quando Felipe especificar regras (ex: ripada exige espessura
      // X de tubo, classica exige moldura Y) eu engancho na regra.
      estilo: '',
      // Felipe sessao 2026-05: campos de estrutura (default sem)
      temEstrutura: 'nao',
      tuboEstrutura: '',
      largura_total: '',
      altura_total: '',
    };
    // Felipe sessao 18: pergolado.
    // Bug 'clico no card e nada acontece': novoItem('pergolado') caia no
    // return {tipo:''} no final → item vazio → tela voltava pra Escolha
    // Tipo. Agora cria item populado.
    if (tipo === 'pergolado') return {
      tipo: 'pergolado',
      quantidade: 1,
      tubo: 'PA-51X51X1.98',       // tubo default (Felipe sessao 31: codigo real)
      espacamentoRipas: 30,        // espacamento default
      revestimento: '',
      cor: '',
      largura_total: '',
      altura_total: '',
      paredes: [{
        largura_total: '',
        altura_total:  '',
        quantidade:    1,
      }],
    };
    return { tipo: '', quantidade: 1 };
  }

  function novoItemPortaExterna() {
    const fg = lerFolgasPadraoCadastro();
    return {
      tipo: 'porta_externa',
      quantidade: 1,
      // Tudo vazio. As regras automaticas (sistema/fechadura/cilindro)
      // so atuam DEPOIS que largura+altura forem preenchidos.
      largura: '',
      altura: '',
      nFolhas: '',         // 1 ou 2 — afeta perfis, chapas, acessorios e fabricacao
      qtdChapas: '',       // numero de chapas de revestimento — depois auto pelo levantamento
      // Felipe (sessao 2026-05): MODELO agora separado por LADO da porta.
      // modeloExterno e modeloInterno podem ser diferentes. Para retro-compat
      // mantemos modeloNumero (fallback para modeloExterno em itens legados).
      modeloNumero: '',     // legado — preservado pra nao quebrar regras antigas
      modeloExterno: '',    // numero do modelo da face externa
      modeloInterno: '',    // numero do modelo da face interna
      revestimento: '',
      corInterna: '',
      corExterna: '',
      // Felipe sessao 13: no Modelo 23 + Aluminio Maciço 2mm a porta
      // mistura 2 chapas — AM (corpo: tampas, fitas, cava) e ACM
      // (portal: batentes, tampa de furo, acab lateral, u portal).
      // corExterna/corInterna passam a ser cor da CHAPA ACM nesse caso.
      // corChapaAM_Ext/Int sao cores da CHAPA AM. Vazio = usa AM default
      // (sem cor). Pra qualquer outro modelo/revestimento, esses campos
      // sao ignorados.
      corChapaAM_Ext: '',
      corChapaAM_Int: '',
      sistema: '',
      fechaduraMecanica: '',
      fechaduraDigital: '',
      cilindro: '',
      // Felipe sessao 14: 'ELE TEM QUE APARECER O QUE TEM NO CAMPO'.
      // Default antes era '' (vazio) — mas o select mostra visualmente
      // 'Enviado pelo cliente' (1a opcao) e o usuario achava que o item
      // tinha esse valor. Resultado: item ficava com '' no banco e PDF
      // saia '—'. Default agora bate com o que o usuario ve' no select.
      tamanhoPuxador: 'Enviado pelo cliente',
      // Felipe (do doc): TODA porta tem que ter — se tem alisar (sim/nao),
      // qual a largura do alisar (default 100mm) e a espessura da parede
      // (default 250mm). Sao usados na proposta comercial e nos cortes
      // de portal/alisar.
      tem_alisar: 'Sim',
      largura_alisar: 100,
      espessura_parede: 250,
      // ----------------------------------------------------------------
      // CAMPOS POR MODELO — Felipe (do doc): cada modelo tem seu
      // conjunto de variaveis. Ver CAMPOS_POR_MODELO + CATALOGO_CAMPOS_MODELO
      // pra saber quais aparecem em cada um. Sao todos opcionais aqui;
      // a UI mostra so' os que pertencem ao modelo escolhido.
      // ----------------------------------------------------------------
      distanciaBordaCava: '',         // Modelos 01,02,03,04,05,06,07,08,09,11,22
      tamanhoCava: '',                // Modelos 01,02,03,04,05,06,07,08,09,11,22,24
      distanciaBordaFrisoVertical: '',// Modelos 02,04,05,07,11,13,14,22
      distanciaBordaFrisoHorizontal: '',  // Modelos 03,04,12,13
      distanciaBordaFrisoHorizontal1: '', // Modelo 05 (so')
      distanciaBordaFrisoHorizontal2: '', // Modelo 05 (so')
      espessuraFriso: '',             // Modelos 02,03,04,05,06,07,11,12,13,14,16,22
      quantidadeFrisos: '',           // Modelos 02,06,07,11,14,16,22
      larguraRipas: '',               // Modelos 07,14
      tipoRipado: '',                 // Modelos 08,15  ('Total' / 'Parcial')
      espacamentoRipas: '',           // Modelos 08,15
      tipoMoldura: '',                // Modelo 23 ('Padrao' / 'Divisoes Iguais' / 'Personalizado')
      quantasDivisoesMoldura: '',     // Modelo 23 — so' se tipoMoldura = 'Divisoes Iguais'
      quantidadeMolduras: '',         // Modelo 23 ('1' / '2' / '3')
      // Felipe (do doc): distancias progressivas conforme qtde de molduras
      distanciaBorda1aMoldura: '',    // Modelo 23 — sempre se qtde >= 1
      distancia1a2aMoldura: '',       // Modelo 23 — so' se qtde >= 2
      distancia2a3aMoldura: '',       // Modelo 23 — so' se qtde >= 3
      // Felipe: perfil/codigo da moldura — so' aparece se Revestimento = Aluminio Macico 2mm
      perfilMoldura: '',
      // Felipe sessao 14: folgas vem POPULADAS do cadastro Regras >
      // Variaveis (FGLD/FGLE/FGA). Usuario pode editar caso queira
      // override por item.
      fglDir: fg.fglDir,
      fglEsq: fg.fglEsq,
      fgSup:  fg.fgSup,
      // marcadores: campos editados manualmente pelo usuario sao registrados aqui
      // pra exibir o aviso "fora da regra" quando saem do valor calculado
      _overrides: {},
    };
  }

  // ============================================================
  // CATALOGO DE CAMPOS POR MODELO
  // Felipe (do doc): cada modelo tem variaveis especificas que aparecem
  // na aba Caracteristicas do Item quando o modelo e' escolhido. A
  // estrutura e' separada do form: o catalogo descreve como cada campo
  // e' renderizado, e o mapping diz quais campos cada modelo usa.
  //
  // Pra ADICIONAR campos a um modelo novo (ex: Modelo 17 quando o Felipe
  // mandar): basta adicionar a entrada em CAMPOS_POR_MODELO. Se for um
  // tipo novo de campo, adicionar tambem em CATALOGO_CAMPOS_MODELO.
  // ============================================================
  const CATALOGO_CAMPOS_MODELO = {
    distanciaBordaCava:         { label: 'Distancia da borda ate a cava (mm)', tipo: 'number', min: 0, step: 1 },
    // Felipe (sessao 2026-05): renomeado de "Tamanho da cava" pra
    // "Largura da cava" — mais descritivo. Chave interna `tamanhoCava`
    // mantida pra preservar compat com dados ja salvos.
    tamanhoCava:                { label: 'Largura da cava (mm)', tipo: 'number', min: 0, step: 1 },
    distanciaBordaFrisoVertical:    { label: 'Distancia da borda ao friso vertical (mm)', tipo: 'number', min: 0, step: 1 },
    distanciaBordaFrisoHorizontal:  { label: 'Distancia da borda ao friso horizontal (mm)', tipo: 'number', min: 0, step: 1 },
    distanciaBordaFrisoHorizontal1: { label: 'Distancia da borda ao friso horizontal 1 (mm)', tipo: 'number', min: 0, step: 1 },
    distanciaBordaFrisoHorizontal2: { label: 'Distancia da borda ao friso horizontal 2 (mm)', tipo: 'number', min: 0, step: 1 },
    espessuraFriso:             { label: 'Espessura do friso (mm)', tipo: 'number', min: 0, step: 1 },
    quantidadeFrisos:           { label: 'Quantidade de frisos', tipo: 'number', min: 0, step: 1 },
    larguraRipas:               { label: 'Largura das ripas (mm)', tipo: 'number', min: 0, step: 1 },
    tipoRipado:                 { label: 'Ripado', tipo: 'select', opcoes: ['', 'Total', 'Parcial'] },
    espacamentoRipas:           { label: 'Espacamento entre ripas (mm)', tipo: 'number', min: 0, step: 1 },
    // Felipe (do doc - msg molduras): no Modelo 23 a "configuracao da moldura"
    // (Padrao/Divisoes Iguais/Personalizado) e' SEMPRE visivel. As distancias
    // sao progressivas conforme quantidade de molduras (1, 2 ou 3).
    tipoMoldura:                { label: 'Configuracao da moldura', tipo: 'select', opcoes: ['', 'Padrao', 'Divisoes Iguais', 'Personalizado'] },
    // Felipe: se Configuracao = "Divisoes Iguais", abre campo "Quantas divisoes"
    quantasDivisoesMoldura:     { label: 'Quantas divisoes', tipo: 'number', min: 1, step: 1 },
    quantidadeMolduras:         { label: 'Quantidade de molduras', tipo: 'select', opcoes: ['', '1', '2', '3'] },
    distanciaBorda1aMoldura:    { label: 'Distancia da borda a 1a moldura (mm)', tipo: 'number', min: 0, step: 1 },
    distancia1a2aMoldura:       { label: 'Distancia da 1a a 2a moldura (mm)', tipo: 'number', min: 0, step: 1 },
    distancia2a3aMoldura:       { label: 'Distancia da 2a a 3a moldura (mm)', tipo: 'number', min: 0, step: 1 },
    // Felipe (do doc): perfil/codigo da moldura. So' aparece se Revestimento
    // for "Aluminio Macico 2mm" (porque nesse caso ele tera varios codigos
    // pra escolher: PA-PERFILBOISERIE etc).
    perfilMoldura:              { label: 'Tipo de moldura (perfil)', tipo: 'select',
                                  opcoes: ['', 'PA-PERFILBOISERIE'] },
  };

  // Mapeamento modelo → array de campos. As chaves sao numeros do modelo
  // (1 a 24). Modelos nao listados aqui (10, 17, 18, 19, 20, 21) ainda
  // nao foram especificados pelo Felipe — quando ele passar, basta
  // adicionar a entrada.
  // Felipe (sessao 2026-05): campo corCava removido daqui — agora fica
  // na seção "Acabamento" junto com Cor Externa/Interna, com botão de
  // copiar (mesmo padrão das outras cores). Ver renderização condicional
  // no `mostraCorCava` em renderItemTab.
  const CAMPOS_POR_MODELO = {
    1:  ['distanciaBordaCava', 'tamanhoCava'],
    2:  ['distanciaBordaCava', 'tamanhoCava', 'distanciaBordaFrisoVertical', 'espessuraFriso', 'quantidadeFrisos'],
    3:  ['distanciaBordaCava', 'tamanhoCava', 'distanciaBordaFrisoHorizontal', 'espessuraFriso'],
    4:  ['distanciaBordaCava', 'tamanhoCava', 'distanciaBordaFrisoHorizontal', 'distanciaBordaFrisoVertical', 'espessuraFriso'],
    5:  ['distanciaBordaCava', 'tamanhoCava', 'distanciaBordaFrisoHorizontal1', 'distanciaBordaFrisoHorizontal2', 'distanciaBordaFrisoVertical', 'espessuraFriso'],
    6:  ['distanciaBordaCava', 'tamanhoCava', 'quantidadeFrisos', 'espessuraFriso'],
    7:  ['distanciaBordaCava', 'tamanhoCava', 'distanciaBordaFrisoVertical', 'espessuraFriso', 'larguraRipas', 'quantidadeFrisos'],
    8:  ['distanciaBordaCava', 'tamanhoCava', 'tipoRipado', 'espacamentoRipas'],
    9:  ['distanciaBordaCava', 'tamanhoCava'],
    // Felipe (sessao 18): mod 11 e' "Puxador Externo + Friso Vertical".
    // NAO tem cava (do 10 pra frente sao todos puxador externo, exceto 22).
    // Antes tinha distanciaBordaCava/tamanhoCava indevidamente.
    11: ['distanciaBordaFrisoVertical', 'espessuraFriso', 'quantidadeFrisos'],
    12: ['distanciaBordaFrisoHorizontal', 'espessuraFriso'],
    13: ['distanciaBordaFrisoHorizontal', 'distanciaBordaFrisoVertical', 'espessuraFriso'],
    14: ['distanciaBordaFrisoVertical', 'espessuraFriso', 'larguraRipas', 'quantidadeFrisos'],
    15: ['tipoRipado', 'espacamentoRipas'],
    16: ['quantidadeFrisos', 'espessuraFriso'],
    22: ['distanciaBordaCava', 'tamanhoCava', 'distanciaBordaFrisoVertical', 'espessuraFriso', 'quantidadeFrisos'],
    23: ['tipoMoldura', 'quantasDivisoesMoldura', 'quantidadeMolduras', 'distanciaBorda1aMoldura', 'distancia1a2aMoldura', 'distancia2a3aMoldura', 'perfilMoldura'],
    24: ['tamanhoCava'],
    // Felipe (sessao 18): Mod 25 = "Puxador Externo + ripado vertical sem
    // elevacao". Base mod 10 (liso) + frisos verticais que FATIAM a tampa
    // em (qtdFrisos+1) chapas. Sem cava, sem ripa fisica.
    25: ['quantidadeFrisos', 'espessuraFriso'],
  };

  /**
   * Felipe (sessao 2026-05): true se o modelo tem CAVA (campos
   * distanciaBordaCava ou tamanhoCava). Usado pra decidir se a Cor da
   * Cava aparece na seção Acabamento.
   */
  function modeloTemCava(modeloNumero) {
    const num = Number(modeloNumero);
    const campos = CAMPOS_POR_MODELO[num] || [];
    return campos.includes('distanciaBordaCava') || campos.includes('tamanhoCava');
  }

  /**
   * Felipe (Modelo 23): regras de visibilidade condicional. Usado pra
   * decidir se cada campo do CATALOGO_CAMPOS_MODELO deve aparecer ou
   * nao na tela, baseado em outros campos ja preenchidos do item.
   *
   * Retorna true se o campo deve aparecer, false se deve esconder.
   */
  function campoModeloVisivel(chave, item) {
    const qtdMolduras = parseInt(item.quantidadeMolduras, 10) || 0;
    // Felipe: distancias da moldura sao progressivas
    //   qtde 0 (nao escolhido) -> nada
    //   qtde 1 -> so distanciaBorda1aMoldura
    //   qtde 2 -> + distancia1a2aMoldura
    //   qtde 3 -> + distancia2a3aMoldura
    if (chave === 'distanciaBorda1aMoldura') return qtdMolduras >= 1;
    if (chave === 'distancia1a2aMoldura')    return qtdMolduras >= 2;
    if (chave === 'distancia2a3aMoldura')    return qtdMolduras >= 3;
    // Felipe (do doc - msg modelo 23 divisoes iguais): "Quantas divisoes"
    // so' aparece se Configuracao da moldura = "Divisoes Iguais"
    if (chave === 'quantasDivisoesMoldura') {
      return item.tipoMoldura === 'Divisoes Iguais';
    }
    // Felipe: perfilMoldura (PA-PERFILBOISERIE etc) so' aparece quando
    // o Revestimento e' "Aluminio Macico 2mm" (ou similar).
    if (chave === 'perfilMoldura') {
      const rev = String(item.revestimento || '').toLowerCase();
      return /aluminio.*macico/.test(rev) && /2\s*mm/.test(rev);
    }
    return true;
  }

  /**
   * Renderiza dinamicamente os campos do modelo escolhido. Se o modelo
   * nao tem mapeamento (10, 17-21 ainda), nao mostra nada.
   */
  function renderCamposPorModelo(item) {
    return renderCamposPorModeloEspecifico(item, Number(item.modeloNumero));
  }

  /**
   * Felipe (sessao 2026-05): variante que aceita o numero do modelo
   * explicitamente — usada quando externo e interno sao diferentes
   * (ex: cava por fora, classica por dentro). Cada lado renderiza
   * seu proprio conjunto de campos.
   */
  function renderCamposPorModeloEspecifico(item, numModelo) {
    const num = Number(numModelo);
    const campos = CAMPOS_POR_MODELO[num];
    if (!campos || !campos.length) return '';
    const inputs = campos
      .filter(chave => campoModeloVisivel(chave, item))
      .map(chave => {
        const meta = CATALOGO_CAMPOS_MODELO[chave];
        if (!meta) return '';
        const val = item[chave] != null ? String(item[chave]) : '';
        if (meta.tipo === 'select') {
          const opts = (meta.opcoes || []).map(op =>
            `<option value="${escapeHtml(op)}" ${val === op ? 'selected' : ''}>${escapeHtml(op || '—')}</option>`
          ).join('');
          return `
            <div class="orc-field orc-f-modelo-var">
              <label>${escapeHtml(meta.label)}</label>
              <select data-field="${chave}">${opts}</select>
            </div>`;
        }
        // Felipe (sessao 2026-05): tipo 'cor' (corCava) foi movido pra
        // seção Acabamento (renderizado direto no template do mostraCor).
        // Removido daqui pra evitar duplicacao de datalist com mesmo ID.
        return `
          <div class="orc-field orc-f-modelo-var">
            <label>${escapeHtml(meta.label)}</label>
            <input type="number" min="${meta.min || 0}" step="${meta.step || 1}" data-field="${chave}" value="${escapeHtml(val)}" />
          </div>`;
      }).join('');
    if (!inputs) return '';
    return `
      <div class="orc-form-row" id="orc-modelo-vars-row">
        ${inputs}
      </div>`;
  }

  // ============================================================
  //                       ROOT RENDER (router por aba)
  // ============================================================
  function render(container, tabId) {
    const aba = tabId || 'item';

    // Felipe sessao 12 (2a vez): 'nao gostei disso tire esse bloqueio'.
    // Congelamento via CSS .is-orc-readonly REMOVIDO. Banner 'Modo Memorial'
    // continua aparecendo como AVISO VISUAL nao-bloqueante, mas Felipe pode
    // editar campos livremente em qualquer versao. Versoes com status='fechada'
    // ainda dao erro tecnico em atualizarVersao (linha 1262) - intencional
    // pra preservar historico apos Nova Versao.
    inicializarSessao();
    container.classList.remove('is-orc-readonly');

    if (aba === 'item')             return renderItemTab(container);
    if (aba === 'fab-inst')         return renderFabInstTab(container);
    if (aba === 'custo')            return renderCustoTab(container);
    if (aba === 'proposta')         return renderPropostaTab(container);
    if (aba === 'lev-perfis')       return renderLevPerfisTab(container);
    if (aba === 'lev-superficies')  return renderLevSuperficiesTab(container);
    if (aba === 'lev-acessorios')   return renderLevAcessoriosTab(container);
    if (aba === 'relatorios')       return renderRelatoriosTab(container);
    return renderPlaceholderTab(container, aba);
  }

  // ============================================================
  //                      ABA: CARACTERISTICAS DO ITEM
  // ============================================================

  /**
   * Felipe (Sessao 2): tela inicial vazia. Item recem-criado tem tipo=''
   * e cai aqui — usuario escolhe entre Porta Externa / Porta Interna /
   * Fixo Acoplado / Revestimento de Parede. Apos escolha, item.tipo e'
   * setado e renderItemTab redireciona pro form especifico do tipo.
   */
  function renderEscolhaTipo(container, negocio, opcao, versao) {
    const TIPOS = [
      {
        id: 'porta_externa',
        label: 'Porta Externa',
        icon: '🚪',
        desc: 'Porta externa pivotante, com perfis de aluminio, acabamento e fechadura.',
        ativo: true,
      },
      {
        id: 'porta_interna',
        label: 'Porta Interna',
        icon: '🚪',
        desc: 'Porta interna (entre comodos). Calculo simplificado.',
        // Felipe sessao 31: liberado pra testes. Motor 35-perfis-porta-interna.js
        // ja tem Batente + Folha + Click da Folha; demais perfis virao por commit.
        ativo: true,
      },
      {
        id: 'fixo_acoplado',
        label: 'Fixo Acoplado a Porta',
        icon: '⬜',
        desc: 'Painel fixo lateral ou superior acoplado a uma porta.',
        // Felipe (sessao 2026-05): "pq nao esta liberado fixo acoplado a porta?
        // Ja fiz dos calculos dos perfis dele" — habilitado. Os motores ja existiam:
        //   - scripts/12-orcamento.js linha 5384 (PerfisRevAcoplado)
        //   - form proprio renderItemTab + visualizacao em 2826
        ativo: true,
      },
      {
        id: 'revestimento_parede',
        label: 'Revestimento de Parede',
        icon: '🟨',
        desc: 'Revestimento decorativo de parede (sem porta).',
        // Felipe (sessao 2026-07): "pq nao esta liberado revestimento
        // de parede?" — habilitado. Os motores ja' existiam:
        //   - scripts/37-perfis-rev-parede.js (window.PerfisRevParede)
        //   - scripts/40-chapas-rev-parede.js (window.ChapasRevParede)
        // E o form proprio em renderItemTab linha ~2398.
        ativo: true,
      },
      {
        id: 'pergolado',
        label: 'Pergolado',
        icon: '🟧',
        desc: 'Pergolado de tubos espacados (51x51, 101x51, 38x38, 76x38).',
        // Felipe sessao 18: novo item. Motores:
        //   - scripts/41-chapas-pergolado.js (window.ChapasPergolado)
        //   - scripts/42-perfis-pergolado.js (window.PerfisPergolado)
        // Form proprio em renderItemPergolado.
        ativo: true,
      },
    ];

    const headerOrcamento = `
      <div class="orc-banner">
        <span class="t-strong">${escapeHtml(negocio?.clienteNome || '')}</span>
        · Opcao ${escapeHtml(opcao?.letra || 'A')} · Versao ${versao?.numero || 1}
        · <span class="orc-banner-status">${versao?.status === 'fechada' ? 'fechada' : 'em edicao'}</span>
      </div>
    `;

    container.innerHTML = `
      ${headerOrcamento}
      <div class="orc-tipo-wrap">
        <div class="orc-tipo-titulo">Escolha o tipo do item</div>
        <div class="orc-tipo-help">Cada tipo tem um formulario proprio. Voce pode adicionar mais itens depois.</div>
        <div class="orc-tipo-cards">
          ${TIPOS.map(t => `
            <button type="button" class="orc-tipo-card ${t.ativo ? '' : 'is-disabled'}" data-tipo="${t.id}" ${t.ativo ? '' : 'disabled'}>
              <div class="orc-tipo-icon">${t.icon}</div>
              <div class="orc-tipo-label">${escapeHtml(t.label)}</div>
              <div class="orc-tipo-desc">${escapeHtml(t.desc)}</div>
              ${t.ativo
                ? `<div class="orc-tipo-status is-ok">✓ Disponivel</div>`
                : `<div class="orc-tipo-status is-pending">${escapeHtml(t.statusLabel)}</div>`}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.orc-tipo-card[data-tipo]:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const tipo = btn.dataset.tipo;
        const v = versaoAtiva();
        if (!v) return;
        const lista = (v.itens || []).slice();
        // Substitui o item atual (que era vazio) por um do tipo escolhido
        const idx = Math.min(UI.itemSelecionadoIdx, lista.length - 1);
        // Mantem quantidade se ja foi setada
        const qtdAntiga = (lista[idx] && lista[idx].quantidade) || 1;
        lista[idx] = novoItem(tipo);
        if (qtdAntiga > 1) lista[idx].quantidade = qtdAntiga;
        atualizarVersao(v.id, { itens: lista });
        renderItemTab(container);
      });
    });
  }

  // ============================================================
  // Felipe (sessao 2026-05): FORM DO REVESTIMENTO DE PAREDE
  // ============================================================
  /**
   * Schema do item revestimento_parede:
   *   - quantidade: int (do orçamento, ex: 3 = 3 paredes idênticas)
   *   - estilo: '' | 'lisa' | 'ripada' | 'classica' (Felipe sessao 14)
   *   - revestimento: ACM 4mm | HPL 4mm | Aluminio Macico 2mm | Vidro 6/8mm
   *   - cor: string (1 só — chapa tem 1 face)
   *   - modo: 'manual' | 'automatico'
   *   - // se modo === 'automatico'
   *   - largura_total: mm (largura da parede inteira, ex: 10000)
   *   - altura_total:  mm (altura da parede, ex: 5000)
   *   - divisao_largura: 'maxima' | 'igual'
   *     - maxima: faixas de larguraMaxima + sobra na ponta (10000 → 6×1440 + 1×1360)
   *     - igual:  todas as faixas iguais (10000 / 7 = 1428,57 cada)
   *   - com_refilado: 'sim' | 'nao' (se sim, larguraMaxima = 1500 - 2*REF = 1460)
   *   - // se modo === 'manual'
   *   - pecas: [{ largura, altura, quantidade }, ...]
   *
   * Renderiza form com sections: Tipo (rev/cor) → Modo (radio) →
   * Campos do modo escolhido → botao Salvar.
   */
  function renderItemRevestimentoParede(container, negocio, opcao, versao, item) {
    // Garante defaults (item legado pode ter so {tipo, quantidade, area})
    if (item.modo === undefined) item.modo = 'manual';
    if (item.divisao_largura === undefined) item.divisao_largura = 'maxima';
    if (item.com_refilado === undefined) item.com_refilado = 'sim';
    if (!Array.isArray(item.pecas)) item.pecas = [];

    // Felipe sessao 18: 'varias medidas nesse mesmo item revestimento
    // medidas diferentes e quantidades mas calcula tudo junto. cada
    // parede usa o que estiver marcado (compensar vs igual)'.
    //
    // Migracao back-compat: cria item.paredes derivado de
    // largura_total/altura_total/quantidade. Mantem campos legados em
    // espelho com a PRIMEIRA parede (23 sitios espalhados acessam
    // item.largura_total/altura_total — preservar funcionalidade).
    if (!Array.isArray(item.paredes)) item.paredes = [];
    if (item.paredes.length === 0 && (item.largura_total || item.altura_total)) {
      item.paredes.push({
        largura_total: item.largura_total || '',
        altura_total:  item.altura_total  || '',
        quantidade:    Math.max(1, Number(item.quantidade) || 1),
        divisao_largura: item.divisao_largura || 'maxima',
        com_refilado:    item.com_refilado    || 'sim',
      });
    }
    if (item.paredes.length === 0) {
      // Item novo: 1 parede em branco
      item.paredes.push({
        largura_total: '',
        altura_total:  '',
        quantidade:    1,
        divisao_largura: 'maxima',
        com_refilado:    'sim',
      });
    }

    const cad = Storage.scope('cadastros');
    const superficies = cad.get('superficies_lista') || [];

    // Filtra cores conforme revestimento (mesma logica da porta_externa)
    function filtrarCoresRev(rev) {
      let lista = superficies;
      if (rev) {
        const cat = (rev === 'Aluminio Macico 2mm') ? 'aluminio_macico'
                  : (rev === 'ACM 4mm')             ? 'acm'
                  : (rev === 'HPL 4mm')             ? 'hpl'
                  : (rev === 'Vidro') ? 'vidro'
                  : null;
        if (cat) {
          const auto = window.Superficies?.categoriaAuto || (() => 'acm');
          lista = (superficies || []).filter(s => (s.categoria || auto(s.descricao)) === cat);
        }
      }
      // Dedup por nome curto (sem sufixo de tamanho)
      const seen = new Set();
      const dedup = [];
      (lista || []).forEach(s => {
        const nome = String(s.descricao || '')
          .replace(/\s*[-–]\s*\d{3,4}\s*[xX×]\s*\d{3,4}\s*$/, '')
          .trim();
        if (!nome) return;
        const k = nome.toUpperCase();
        if (seen.has(k)) return;
        seen.add(k);
        dedup.push({ ...s, descricao: nome });
      });
      return dedup;
    }
    const coresFiltradas = filtrarCoresRev(item.revestimento);

    const revestimentos = ['ACM 4mm', 'HPL 4mm', 'Aluminio Macico 2mm', 'Vidro'];

    function tagsLeadHtml() {
      if (!UI.leadAtivo) return '';
      const lead = UI.leadAtivo;
      const partes = [];
      if (lead.cliente) partes.push(escapeHtml(lead.cliente));
      if (lead.agp)     partes.push('AGP ' + escapeHtml(lead.agp));
      if (lead.reserva) partes.push('Reserva ' + escapeHtml(lead.reserva));
      return partes.length
        ? `<span class="orc-tag-lead">${partes.join(' · ')}</span>`
        : '';
    }

    container.innerHTML = `
      ${(() => {
        const leadIt = lerLeadAtivo() || {};
        const numDocIt = `${(opcao?.letra || 'A')} - ${versao.numero}`;
        const headerItHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
          ? window.Empresa.montarHeaderRelatorio({
              lead: leadIt,
              tituloRelatorio: 'Caracteristicas do Item',
              numeroDocumento: numDocIt,
              validade: 15,
            })
          : '';
        // Felipe sessao 31: bannerCaracteristicasItens (painel laranja com
        // Item 1/2/3/4/5) FALTAVA em renderItemRevestimentoParede — antes so
        // tinha headerItHtml sozinho. Felipe reclamou que so aparecia nos
        // itens porta_externa. Agora replica padrao do renderItemTab pra
        // cabecalho ser FIXO em todas as telas de itens.
        return headerItHtml + bannerCaracteristicasItens(versao);
      })()}
      <div class="orc-banner">
        <div class="orc-banner-info">
          <span class="t-strong">Negocio em edicao:</span>
          ${escapeHtml(negocio?.clienteNome || '—')}
          ${tagsLeadHtml()}
          · Opcao ${escapeHtml(opcao.letra)}
          · Versao ${versao.numero}
        </div>
        <!-- Felipe sessao 18: 'se eu tiver somente revestimento parede
             nao tem botao de calcular'. Banner do rev parede nao tinha
             orc-banner-actions (so o orc-banner-info). Agora replica os
             mesmos botoes do banner da porta_externa (calcular, salvar,
             limpar, voltar). -->
        <div class="orc-banner-actions">
          <button type="button" class="orc-btn-calcular ${versao.calcDirty || !versao.calculadoEm ? 'is-dirty' : 'is-ok'}" id="orc-btn-calcular" title="${versao.calculadoEm ? 'Atualiza DRE, Levantamentos, Custo Fab/Inst com os valores atuais' : 'Roda os calculos pela primeira vez'}">${versao.calculadoEm ? '↻ Recalcular' : '▶ Calcular'}</button>
          <button type="button" class="univ-btn-save" id="orc-btn-salvar">✓ Tudo salvo</button>
          <button class="orc-btn-zerar" id="orc-btn-zerar" title="Limpa os inputs da tela e cria nova versao em branco preservando o historico.">🧹 Limpar Tela</button>
          ${UI.leadAtivo ? `<button class="orc-btn-back" id="orc-btn-back-crm" title="Voltar para o card no CRM">← Voltar pro CRM</button>` : ''}
        </div>
      </div>

      <!-- Felipe (sessao 2026-06): chips de items + botao "+ Adicionar item"
           — antes essa funcao renderItemRevestimentoParede nao tinha esse
           bloco, entao quando o item ativo era revestimento_parede sumiam
           os chips dos outros itens E o X de deletar. Felipe reclamou:
           "se eu clico em revestimento fica diferente de quando clico em
           porta interna ... revestimento parede entra dentro do
           revestimento e nao tem X pra deletar". Agora replica EXATAMENTE
           o mesmo bloco do renderItemTab principal. -->
      <div class="orc-itens-list">
        ${(versao.itens || []).map((it, idx) => {
          const ativo = idx === UI.itemSelecionadoIdx;
          // Felipe (sessao 2026-08): "QUANDO SO TEM UM ITEM NAO TEM
          // OPCAO DE DELETAR ELE MESMO". Botao X sempre presente.
          // Ao deletar o ultimo, volta pra tela de escolha de tipo.
          return `
            <div class="orc-item-chip ${ativo ? 'is-active' : ''}" data-idx="${idx}">
              <button class="orc-item-chip-label" data-action="select-item" data-idx="${idx}">
                Item ${idx + 1}: ${escapeHtml(labelTipo(it.tipo))}
              </button>
              <button class="orc-item-chip-remove" data-action="remove-item" data-idx="${idx}" title="Remover este item">✕</button>
            </div>
          `;
        }).join('')}
        <div class="orc-item-add-wrapper">
          <select class="orc-item-add" id="orc-item-add">
            <option value="">+ Adicionar item</option>
            ${TIPOS_ITEM.map(t => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="orc-item">
        <div class="orc-item-header">
          <div class="orc-item-titulo">Item ${UI.itemSelecionadoIdx + 1} — Revestimento de Parede</div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Quantidade</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-qtd">
              <label>Quantidade (paredes idênticas)</label>
              <input type="number" min="1" data-field="quantidade" value="${escapeHtml(String(item.quantidade || 1))}" />
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Acabamento</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-revestimento">
              <label>Estilo</label>
              <select data-field="estilo">
                <option value="" ${!item.estilo ? 'selected' : ''}>— Selecione —</option>
                <option value="lisa"     ${item.estilo === 'lisa'     ? 'selected' : ''}>Lisa</option>
                <option value="ripada"   ${item.estilo === 'ripada'   ? 'selected' : ''}>Ripada</option>
                <option value="classica" ${item.estilo === 'classica' ? 'selected' : ''}>Classica</option>
              </select>
            </div>
            <div class="orc-field orc-f-revestimento">
              <label>Revestimento</label>
              <select data-field="revestimento">
                <option value=""></option>
                ${revestimentos.map(r => `<option value="${escapeHtml(r)}" ${item.revestimento === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
              </select>
            </div>
            ${item.estilo === 'ripada' ? `
            <!-- Felipe sessao 18: 'coloquei ripado nao me perguntou qual
                 espacamento, nem soltou perfis de aluminio nem os ripados
                 nas chapas'. Campo aparece somente quando estilo=ripada.
                 Default 30mm (mesmo da porta externa mod 8/15). -->
            <div class="orc-field orc-f-revestimento">
              <label>Espaçamento das ripas (mm)</label>
              <input type="number" min="0" data-field="espacamentoRipas"
                     value="${escapeHtml(String(item.espacamentoRipas || 30))}"
                     placeholder="30" />
            </div>
            ` : ''}
          </div>
          <div class="orc-form-row">
            <div class="orc-cor-stack">
              <div class="orc-field orc-f-cor">
                <label>Cor</label>
                <input type="text" list="orc-superficies-list-rev" data-field="cor" value="${escapeHtml(item.cor || '')}" placeholder="" title="${escapeHtml(item.cor || '')}" />
              </div>
            </div>
            <datalist id="orc-superficies-list-rev">
              ${(() => {
                // Felipe sessao 12: 'em Revestimento de Parede faca a escolha da
                // chapa igual na porta de entrada, esta muito ruim escolher a cor
                // do jeito que esta o filtro'. Voltado pra input+datalist (igual
                // porta_externa). Datalist mostra todas as cores filtradas pelo
                // revestimento e Felipe pode digitar pra buscar.
                const vistas = new Set();
                const opts = [];
                coresFiltradas.forEach(s => {
                  const limpo = nomeCurtoSuperficie(s.descricao);
                  if (!limpo || vistas.has(limpo)) return;
                  vistas.add(limpo);
                  opts.push(`<option value="${escapeHtml(limpo)}"></option>`);
                });
                return opts.join('');
              })()}
            </datalist>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Estrutura</div>
          <div class="orc-form-row">
            <div class="orc-field">
              <label>Tem estrutura?</label>
              <select data-field="temEstrutura">
                <option value="nao" ${item.temEstrutura !== 'sim' ? 'selected' : ''}>Sem estrutura (so chapas)</option>
                <option value="sim" ${item.temEstrutura === 'sim' ? 'selected' : ''}>Com estrutura (tubos de aluminio)</option>
              </select>
            </div>
          </div>
          ${item.temEstrutura === 'sim' ? `
          <div class="orc-form-row">
            <div class="orc-field">
              <label>Tubo da estrutura</label>
              <select data-field="tuboEstrutura">
                <option value="" ${!item.tuboEstrutura ? 'selected' : ''}>— Escolha um tubo</option>
                <option value="PA-25X12X1.58" ${item.tuboEstrutura === 'PA-25X12X1.58' ? 'selected' : ''}>Tubo 25 × 12 × 1.58 (0,30 kg/m)</option>
                <option value="PA-51X12X1.2"  ${item.tuboEstrutura === 'PA-51X12X1.2'  ? 'selected' : ''}>Tubo 51 × 12 × 1.2 (0,40 kg/m)</option>
                <option value="PA-51X12X1.58" ${item.tuboEstrutura === 'PA-51X12X1.58' ? 'selected' : ''}>Tubo 51 × 12 × 1.58 (0,52 kg/m)</option>
                <option value="PA-51X25X1.5"  ${item.tuboEstrutura === 'PA-51X25X1.5'  ? 'selected' : ''}>Tubo 51 × 25 × 1.5 (0,59 kg/m)</option>
                <option value="PA-51X25X2.0"  ${item.tuboEstrutura === 'PA-51X25X2.0'  ? 'selected' : ''}>Tubo 51 × 25 × 2.0 (0,78 kg/m)</option>
                <option value="PA-76X38X1.98" ${item.tuboEstrutura === 'PA-76X38X1.98' ? 'selected' : ''}>Tubo 76 × 38 × 1.98 (1,18 kg/m)</option>
              </select>
            </div>
          </div>
          ${item.modo === 'manual' ? `
          <div class="orc-form-row">
            <div class="orc-field">
              <label>Largura total da parede (mm)</label>
              <input type="number" min="0" data-field="largura_total" value="${escapeHtml(String(item.largura_total || ''))}" placeholder="ex: 5000" />
            </div>
            <div class="orc-field">
              <label>Altura total da parede (mm)</label>
              <input type="number" min="0" data-field="altura_total" value="${escapeHtml(String(item.altura_total || ''))}" placeholder="ex: 3000" />
            </div>
          </div>
          <div style="font-size:12px;color:#666;margin-top:4px">
            Necessario quando tem estrutura no modo manual (a estrutura precisa das medidas totais da parede).
          </div>
          ` : ''}
          ` : ''}
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Modo de Calculo</div>
          <div class="orc-form-row">
            <div class="orc-field">
              <label>
                <input type="radio" name="rev-modo" data-field="modo" value="manual" ${item.modo === 'manual' ? 'checked' : ''} />
                Manual — adicionar várias peças com medidas individuais
              </label>
            </div>
          </div>
          <div class="orc-form-row">
            <div class="orc-field">
              <label>
                <input type="radio" name="rev-modo" data-field="modo" value="automatico" ${item.modo === 'automatico' ? 'checked' : ''} />
                Automatico — informar a parede inteira e dividir em chapas
              </label>
            </div>
          </div>
        </div>

        ${item.modo === 'automatico' ? renderRevAutomatico(item) : renderRevManual(item)}

        <div class="orc-actions-bar">
          <button class="univ-btn-save" id="orc-btn-salvar">💾 Salvar</button>
          <button class="orc-btn-calcular" id="orc-btn-calcular">↻ Calcular</button>
        </div>
      </div>
    `;

    bindItemRevParedeEvents(container);
    // Felipe sessao 18: 'botao ir para levantamento so tem em porta
    // externa quando mudo para revestimento ele some'. O wizard
    // (botao Proximo: Levantamento de Perfis) era anexado so no
    // renderItemTab principal — quando o item e' rev parede, esse
    // caminho retorna cedo e o botao sumia. Anexa o mesmo wizard
    // aqui pra ter botao fixo em ambos os tipos de item.
    adicionarBotaoWizard(container, 'item');
  }

  /**
   * Felipe sessao 18: NOVO ITEM PERGOLADO.
   * Form proprio: tubo (select), espacamento, multi-paredes.
   * Motores: scripts/41-chapas-pergolado + 42-perfis-pergolado.
   */
  function renderItemPergolado(container, negocio, opcao, versao, item) {
    // Defaults
    // Felipe sessao 31: migracao silenciosa de IDs antigos inventados
    // (PA-51X51, PA-101X51, PA-38X38, PA-76X38) pros codigos reais
    // cadastrados em perfis_lista. Helper migrarTuboId() em
    // 41-chapas-pergolado.js mantem a tabela de migracao centralizada.
    if (window.ChapasPergolado && window.ChapasPergolado.migrarTuboId) {
      if (item.tubo) item.tubo = window.ChapasPergolado.migrarTuboId(item.tubo);
    }
    if (!item.tubo) item.tubo = 'PA-51X51X1.98';
    if (item.espacamentoRipas == null) item.espacamentoRipas = 30;
    if (!Array.isArray(item.paredes)) item.paredes = [];
    if (item.paredes.length === 0) {
      // Migracao legado / item novo
      item.paredes.push({
        largura_total: item.largura_total || '',
        altura_total:  item.altura_total  || '',
        quantidade:    Math.max(1, Number(item.quantidade) || 1),
      });
    }
    // Espelha primeira parede no top-level (back-compat)
    function syncTopParede0(it) {
      const p0 = it.paredes[0];
      if (p0) {
        it.largura_total = Number(p0.largura_total) || 0;
        it.altura_total  = Number(p0.altura_total)  || 0;
      }
    }
    syncTopParede0(item);

    const cad = Storage.scope('cadastros');
    const revestimentos = cad.get('revestimentos_lista') || ['ACM 4mm'];
    const TUBOS = (window.ChapasPergolado?.TUBOS) || [];

    // Felipe sessao 31: Pergolado tambem precisa de dropdown de cor
    // filtrado pelo revestimento (igual rev_parede e porta_externa).
    // Antes era input text livre, agora datalist com cores das chapas
    // cadastradas em superficies_lista.
    const superficies = cad.get('superficies_lista') || [];
    function filtrarCoresPergo(rev) {
      let lista = superficies;
      if (rev) {
        const cat = (rev === 'Aluminio Macico 2mm') ? 'aluminio_macico'
                  : (rev === 'ACM 4mm')             ? 'acm'
                  : (rev === 'HPL 4mm')             ? 'hpl'
                  : (rev === 'Vidro') ? 'vidro'
                  : null;
        if (cat) {
          const auto = window.Superficies?.categoriaAuto || (() => 'acm');
          lista = (superficies || []).filter(s => (s.categoria || auto(s.descricao)) === cat);
        }
      }
      // Dedup por nome curto (sem sufixo de tamanho)
      const seen = new Set();
      const dedup = [];
      (lista || []).forEach(s => {
        const nome = String(s.descricao || '')
          .replace(/\s*[-–]\s*\d{3,4}\s*[xX×]\s*\d{3,4}\s*$/, '')
          .trim();
        if (!nome) return;
        const k = nome.toUpperCase();
        if (seen.has(k)) return;
        seen.add(k);
        dedup.push({ ...s, descricao: nome });
      });
      return dedup;
    }
    const coresFiltradasPergo = filtrarCoresPergo(item.revestimento);

    function renderUmaParede(p, i) {
      const tuboObj = (window.ChapasPergolado?.getTubo?.(item.tubo)) || { menor: 51 };
      const espac = Number(item.espacamentoRipas) || 30;
      const L = Number(p.largura_total) || 0;
      const denom = tuboObj.menor + 9 + espac;
      const qtdRipas = L > 0 && denom > 0 ? Math.ceil(L / denom) : 0;
      const hint = L > 0
        ? `<b>Calculo:</b> ${qtdRipas} ripas (${L} / ${denom} = ${qtdRipas})`
        : '<i>Preencha largura para ver o calculo.</i>';
      return `
        <div class="orc-rev-parede" data-parede-idx="${i}"
             style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;background:#fafbfc;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="font-weight:700;color:#1e3a8a;">Parede ${i + 1}</div>
            ${item.paredes.length > 1 ? `
              <button type="button" class="sup-btn-remove" data-action="remover-parede-pergo" data-parede-idx="${i}"
                      style="padding:2px 8px;font-size:12px;" title="Remover parede">× remover</button>
            ` : ''}
          </div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-dim">
              <label>Largura total (mm)</label>
              <input type="number" min="0" data-field-parede-pergo="largura_total" data-parede-idx="${i}"
                     value="${escapeHtml(String(p.largura_total || ''))}" placeholder="ex: 3000" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Altura total (mm)</label>
              <input type="number" min="0" data-field-parede-pergo="altura_total" data-parede-idx="${i}"
                     value="${escapeHtml(String(p.altura_total || ''))}" placeholder="ex: 5000" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Quantidade</label>
              <input type="number" min="1" data-field-parede-pergo="quantidade" data-parede-idx="${i}"
                     value="${escapeHtml(String(p.quantidade || 1))}" />
            </div>
          </div>
          <p class="orc-hint-text" style="margin-top:6px;margin-bottom:0;">${hint}</p>
        </div>
      `;
    }

    // Felipe sessao 18 (fix click pergolado): tagsLeadHtml e' funcao
    // LOCAL de renderItemRevestimentoParede, nao visivel aqui.
    // Inline a mesma logica pra evitar ReferenceError no template
    // (que estourava silenciosamente e impedia o render).
    const _tagsLeadHtml = (() => {
      if (!UI.leadAtivo) return '';
      const lead = UI.leadAtivo;
      const partes = [];
      if (lead.cliente) partes.push(escapeHtml(lead.cliente));
      if (lead.agp)     partes.push('AGP ' + escapeHtml(lead.agp));
      if (lead.reserva) partes.push('Reserva ' + escapeHtml(lead.reserva));
      return partes.length
        ? `<span class="orc-tag-lead">${partes.join(' · ')}</span>`
        : '';
    })();

    container.innerHTML = `
      ${(() => {
        // Felipe sessao 31: header empresa + painel "Caracteristicas dos
        // Items" — antes pergolado nao tinha esse bloco, entao quando o
        // item ativo era pergolado o painel laranja com Item 1/2/3/4/5
        // sumia. Replica EXATAMENTE o padrao do renderItemTab (porta_externa)
        // pra cabecalho ser FIXO em todas as telas de itens.
        const leadIt = lerLeadAtivo() || {};
        const numDocIt = `${(opcao?.letra || 'A')} - ${versao.numero}`;
        const headerItHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
          ? window.Empresa.montarHeaderRelatorio({
              lead: leadIt,
              tituloRelatorio: 'Caracteristicas do Item',
              numeroDocumento: numDocIt,
              validade: 15,
            })
          : '';
        return headerItHtml + bannerCaracteristicasItens(versao);
      })()}
      <div class="orc-banner">
        <div class="orc-banner-info">
          <span class="t-strong">Negocio em edicao:</span>
          ${escapeHtml(negocio?.clienteNome || '—')}
          ${_tagsLeadHtml}
          · Opcao ${escapeHtml(opcao.letra)}
          · Versao ${versao.numero}
        </div>
        <div class="orc-banner-actions">
          <button type="button" class="orc-btn-calcular ${versao.calcDirty || !versao.calculadoEm ? 'is-dirty' : 'is-ok'}" id="orc-btn-calcular">${versao.calculadoEm ? '↻ Recalcular' : '▶ Calcular'}</button>
          <button type="button" class="univ-btn-save" id="orc-btn-salvar">✓ Tudo salvo</button>
          <button class="orc-btn-zerar" id="orc-btn-zerar" title="Limpa os inputs da tela e cria nova versao em branco preservando o historico.">🧹 Limpar Tela</button>
          ${UI.leadAtivo ? `<button class="orc-btn-back" id="orc-btn-back-crm" title="Voltar para o card no CRM">← Voltar pro CRM</button>` : ''}
        </div>
      </div>

      <!-- Felipe (sessao 31): chips de items + botao "+ Adicionar item"
           — antes renderItemPergolado nao tinha esse bloco, entao quando
           o item ativo era pergolado SUMIAM os chips dos outros itens.
           Felipe reclamou: "quando clico pra adicionar um pergolado todo
           restante dos outros itens some". Agora replica EXATAMENTE o
           mesmo bloco do renderItemRevestimentoParede / renderItemTab. -->
      <div class="orc-itens-list">
        ${(versao.itens || []).map((it, idx) => {
          const ativo = idx === UI.itemSelecionadoIdx;
          return `
            <div class="orc-item-chip ${ativo ? 'is-active' : ''}" data-idx="${idx}">
              <button class="orc-item-chip-label" data-action="select-item" data-idx="${idx}">
                Item ${idx + 1}: ${escapeHtml(labelTipo(it.tipo))}
              </button>
              <button class="orc-item-chip-remove" data-action="remove-item" data-idx="${idx}" title="Remover este item">✕</button>
            </div>
          `;
        }).join('')}
        <div class="orc-item-add-wrapper">
          <select class="orc-item-add" id="orc-item-add">
            <option value="">+ Adicionar item</option>
            ${TIPOS_ITEM.map(t => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="orc-tab-conteudo">
        <h2 class="orc-tab-title">Item ${UI.itemSelecionadoIdx + 1} — Pergolado</h2>

        <div class="orc-section">
          <div class="orc-section-title">Tubo e Espacamento</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-revestimento">
              <label>Tubo</label>
              <select data-field-pergo="tubo">
                ${TUBOS.map(t => `<option value="${escapeHtml(t.id)}" ${item.tubo === t.id ? 'selected' : ''}>${escapeHtml(t.label)} (menor: ${t.menor}mm)</option>`).join('')}
              </select>
            </div>
            <div class="orc-field orc-f-revestimento">
              <label>Espacamento entre ripas (mm)</label>
              <input type="number" min="0" data-field-pergo="espacamentoRipas"
                     value="${escapeHtml(String(item.espacamentoRipas || 30))}" placeholder="30" />
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Acabamento</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-revestimento">
              <label>Revestimento</label>
              <select data-field-pergo="revestimento">
                <option value=""></option>
                ${revestimentos.map(r => `<option value="${escapeHtml(r)}" ${item.revestimento === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
              </select>
            </div>
            <div class="orc-field orc-f-revestimento">
              <label>Cor</label>
              <input type="text" list="orc-pergo-cores-list" data-field-pergo="cor" value="${escapeHtml(item.cor || '')}" placeholder="" title="${escapeHtml(item.cor || '')}" />
              <datalist id="orc-pergo-cores-list">
                ${(() => {
                  // Felipe sessao 31: igual a porta_externa e rev_parede.
                  // Datalist com cores filtradas pelo revestimento escolhido.
                  // Comeca vazio se nao tem revestimento — Felipe escolhe rev,
                  // dai abre as cores.
                  const vistas = new Set();
                  const opts = [];
                  coresFiltradasPergo.forEach(s => {
                    const limpo = String(s.descricao || '').trim();
                    if (!limpo || vistas.has(limpo.toUpperCase())) return;
                    vistas.add(limpo.toUpperCase());
                    opts.push(`<option value="${escapeHtml(limpo)}"></option>`);
                  });
                  return opts.join('');
                })()}
              </datalist>
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Medidas das Paredes</div>
          <div id="orc-pergo-paredes-wrap">
            ${item.paredes.map((p, i) => renderUmaParede(p, i)).join('')}
          </div>
          <button type="button" class="orc-btn-add-peca" id="orc-pergo-add-parede" style="margin-top:6px;">+ adicionar parede</button>
        </div>
      </div>
    `;

    bindItemPergoladoEvents(container);
    adicionarBotaoWizard(container, 'item');
  }

  function bindItemPergoladoEvents(container) {
    function getRoot() {
      const r = obterVersao(UI.versaoAtivaId);
      if (!r || !r.versao) return null;
      const itens = r.versao.itens || [];
      const item = itens[UI.itemSelecionadoIdx];
      if (!item) return null;
      return { versao: r.versao, item };
    }
    function persistir(root) {
      atualizarVersao(root.versao.id, { itens: root.versao.itens });
    }
    function reRender() {
      const r = obterVersao(UI.versaoAtivaId);
      if (!r || !r.versao) return;
      const item = (r.versao.itens || [])[UI.itemSelecionadoIdx];
      if (!item) return;
      const negocio = obterNegocio(UI.negocioAtivoId);
      renderItemPergolado(container, negocio, r.opcao, r.versao, item);
    }

    // Campos top-level (tubo, espacamento, revestimento, cor)
    container.querySelectorAll('[data-field-pergo]').forEach(el => {
      el.addEventListener('change', () => {
        const root = getRoot();
        if (!root) return;
        const field = el.dataset.fieldPergo;
        const v = el.value;
        if (field === 'espacamentoRipas') {
          root.item.espacamentoRipas = parseFloat(String(v).replace(',', '.')) || 30;
        } else {
          root.item[field] = v;
        }
        persistir(root);
        if (window.OrcamentoWizard?.resetar) window.OrcamentoWizard.resetar();
        reRender();
      });
    });

    // Campos das paredes
    container.querySelectorAll('[data-field-parede-pergo]').forEach(el => {
      el.addEventListener('change', () => {
        const root = getRoot();
        if (!root) return;
        const item = root.item;
        if (!Array.isArray(item.paredes)) item.paredes = [];
        const idx = parseInt(el.dataset.paredeIdx, 10);
        const field = el.dataset.fieldParedePergo;
        if (!(idx >= 0 && idx < item.paredes.length)) return;
        if (field === 'quantidade') {
          item.paredes[idx].quantidade = Math.max(1, parseInt(el.value, 10) || 1);
        } else {
          item.paredes[idx][field] = parseFloat(String(el.value).replace(',', '.')) || 0;
        }
        // Sincroniza top-level com paredes[0]
        const p0 = item.paredes[0];
        if (p0) {
          item.largura_total = Number(p0.largura_total) || 0;
          item.altura_total  = Number(p0.altura_total)  || 0;
        }
        persistir(root);
        if (window.OrcamentoWizard?.resetar) window.OrcamentoWizard.resetar();
        reRender();
      });
    });

    // Botoes adicionar/remover parede
    container.querySelector('#orc-pergo-add-parede')?.addEventListener('click', () => {
      const root = getRoot();
      if (!root) return;
      if (!Array.isArray(root.item.paredes)) root.item.paredes = [];
      root.item.paredes.push({ largura_total: '', altura_total: '', quantidade: 1 });
      persistir(root);
      reRender();
    });
    container.querySelectorAll('[data-action="remover-parede-pergo"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const root = getRoot();
        if (!root) return;
        const idx = parseInt(btn.dataset.paredeIdx, 10);
        if (!Array.isArray(root.item.paredes)) return;
        if (root.item.paredes.length <= 1) return;
        if (idx >= 0 && idx < root.item.paredes.length) {
          root.item.paredes.splice(idx, 1);
          const p0 = root.item.paredes[0];
          if (p0) {
            root.item.largura_total = Number(p0.largura_total) || 0;
            root.item.altura_total  = Number(p0.altura_total)  || 0;
          }
          persistir(root);
          reRender();
        }
      });
    });

    // Botoes do banner topo (reutiliza handlers existentes)
    container.querySelector('#orc-btn-salvar')?.addEventListener('click', () => {
      if (window.showSavedDialog) window.showSavedDialog('Salvo.');
    });
    container.querySelector('#orc-btn-calcular')?.addEventListener('click', () => {
      const r = obterVersao(UI.versaoAtivaId);
      if (!r?.versao) return;
      atualizarVersao(r.versao.id, { calculadoEm: nowIso(), calcDirty: false });
      if (window.showSavedDialog) window.showSavedDialog('Calculado.');
      renderItemTab(container);
    });
    bindZerarButton(container, () => renderItemTab(container));
    container.querySelector('#orc-btn-back-crm')?.addEventListener('click', () => {
      limparLeadAtivo();
      UI.negocioAtivoId = null;
      UI.versaoAtivaId  = null;
      UI.leadAtivo      = null;
      UI.itemSelecionadoIdx = 0;
      if (typeof App !== 'undefined' && App.navigateTo) App.navigateTo('crm');
    });

    // Felipe sessao 31: handlers dos chips de itens em pergolado
    // (selecionar/remover item, adicionar novo).
    container.querySelectorAll('button[data-action="select-item"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        if (Number.isNaN(idx)) return;
        UI.itemSelecionadoIdx = idx;
        renderItemTab(container);
      });
    });
    container.querySelectorAll('button[data-action="remove-item"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        const versao = versaoAtiva();
        if (!versao || Number.isNaN(idx)) return;
        const lista = (versao.itens || []).slice();
        if (idx < 0 || idx >= lista.length) return;
        const tipoLabel = labelTipo(lista[idx].tipo) || 'item';
        if (!confirm(`Remover este ${tipoLabel}?`)) return;
        lista.splice(idx, 1);
        atualizarVersao(versao.id, { itens: lista });
        if (UI.itemSelecionadoIdx >= lista.length) UI.itemSelecionadoIdx = Math.max(0, lista.length - 1);
        renderItemTab(container);
      });
    });
    container.querySelector('#orc-item-add')?.addEventListener('change', (e) => {
      const tipo = e.target.value;
      if (!tipo) return;
      const versao = versaoAtiva();
      if (!versao) return;
      const novaLista = [...(versao.itens || []), novoItem(tipo, versao)];
      atualizarVersao(versao.id, { itens: novaLista });
      UI.itemSelecionadoIdx = novaLista.length - 1;
      renderItemTab(container);
    });
  }

  /**
   * Form do MODO AUTOMATICO — varias paredes, cada uma com medidas
   * proprias + escolhas independentes de divisao/refilado.
   * Felipe sessao 18: 'varias medidas nesse mesmo item revestimento
   * medidas diferente e quantidades mas calcula tudo junto.
   * Independente — cada parede usa o que estiver marcado'.
   */
  function renderRevAutomatico(item) {
    const REF = (window.Storage?.scope?.('cadastros').get('regras_variaveis_chapas')?.REF) || 20;
    const LARGURA_CHAPA = 1500;

    function renderUmaParede(p, i) {
      const larguraMax = (p.com_refilado === 'sim') ? (LARGURA_CHAPA - 2 * REF) : LARGURA_CHAPA;
      const L = Number(p.largura_total) || 0;
      let hint;
      if (!L) {
        hint = '<i>Preencha largura para ver o calculo.</i>';
      } else if (p.divisao_largura === 'maxima') {
        const nInt = Math.floor(L / larguraMax);
        const sobra = L - nInt * larguraMax;
        hint = `<b>Calculo:</b> ${nInt} faixa(s) de ${larguraMax}mm` +
          (sobra > 0.5 ? ` + 1 faixa de sobra de ${sobra.toFixed(1)}mm` : ' (sem sobra)');
      } else {
        const n = Math.ceil(L / larguraMax);
        const f = (L / n).toFixed(1);
        hint = `<b>Calculo:</b> ${n} faixa(s) iguais de ${f}mm cada`;
      }

      return `
        <div class="orc-rev-parede" data-parede-idx="${i}"
             style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;background:#fafbfc;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="font-weight:700;color:#1e3a8a;">Parede ${i + 1}</div>
            ${item.paredes.length > 1 ? `
              <button type="button" class="sup-btn-remove" data-action="remover-parede" data-parede-idx="${i}"
                      style="padding:2px 8px;font-size:12px;" title="Remover parede">× remover</button>
            ` : ''}
          </div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-dim">
              <label>Largura total (mm)</label>
              <input type="number" min="0" data-field-parede="largura_total" data-parede-idx="${i}"
                     value="${escapeHtml(String(p.largura_total || ''))}" placeholder="ex: 3860" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Altura total (mm)</label>
              <input type="number" min="0" data-field-parede="altura_total" data-parede-idx="${i}"
                     value="${escapeHtml(String(p.altura_total || ''))}" placeholder="ex: 7800" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Quantidade</label>
              <input type="number" min="1" data-field-parede="quantidade" data-parede-idx="${i}"
                     value="${escapeHtml(String(p.quantidade || 1))}" />
            </div>
          </div>
          <div class="orc-form-row">
            <div class="orc-field">
              <label>Tipo de divisao da largura</label>
              <select data-field-parede="divisao_largura" data-parede-idx="${i}">
                <option value="maxima" ${p.divisao_largura === 'maxima' ? 'selected' : ''}>
                  Largura maxima (faixas inteiras + sobra)
                </option>
                <option value="igual" ${p.divisao_largura === 'igual' ? 'selected' : ''}>
                  Divisao igual (todas as faixas iguais)
                </option>
              </select>
            </div>
            <div class="orc-field">
              <label>Com refilado?</label>
              <select data-field-parede="com_refilado" data-parede-idx="${i}">
                <option value="sim" ${p.com_refilado === 'sim' ? 'selected' : ''}>Sim — diminui 20mm de cada lado (REF)</option>
                <option value="nao" ${p.com_refilado === 'nao' ? 'selected' : ''}>Nao — usa largura inteira</option>
              </select>
            </div>
          </div>
          <p class="orc-hint-text" style="margin-top:6px;margin-bottom:0;">${hint}</p>
        </div>
      `;
    }

    return `
      <div class="orc-section">
        <div class="orc-section-title">Medidas da Parede (modo Automatico)</div>
        <div id="orc-rev-paredes-wrap">
          ${item.paredes.map((p, i) => renderUmaParede(p, i)).join('')}
        </div>
        <button type="button" class="orc-btn-add-peca" id="orc-rev-add-parede"
                style="margin-top:6px;">+ adicionar parede</button>
      </div>
    `;
  }

  /**
   * Form do MODO MANUAL — lista de pecas individuais.
   */
  function renderRevManual(item) {
    const pecas = item.pecas || [];
    const linhas = pecas.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><input type="number" min="0" data-field-peca="largura" data-peca-idx="${i}" value="${escapeHtml(String(p.largura || ''))}" placeholder="largura" /></td>
        <td><input type="number" min="0" data-field-peca="altura"  data-peca-idx="${i}" value="${escapeHtml(String(p.altura  || ''))}" placeholder="altura"  /></td>
        <td><input type="number" min="1" data-field-peca="quantidade" data-peca-idx="${i}" value="${escapeHtml(String(p.quantidade || 1))}" /></td>
        <td><button type="button" class="sup-btn-remove" data-action="remover-peca" data-peca-idx="${i}" title="Remover">×</button></td>
      </tr>
    `).join('');
    return `
      <div class="orc-section">
        <div class="orc-section-title">Pecas (modo Manual)</div>
        <table class="cad-table">
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th>Largura (mm)</th>
              <th>Altura (mm)</th>
              <th>Quantidade</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody id="rev-pecas-tbody">
            ${linhas || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Nenhuma peca adicionada. Clique no botao abaixo.</td></tr>'}
          </tbody>
        </table>
        <div style="margin-top:10px;">
          <button type="button" class="univ-btn-secondary" id="rev-btn-add-peca">+ Adicionar peca</button>
        </div>
      </div>
    `;
  }

  /**
   * Bind de eventos do form do revestimento de parede.
   */
  function bindItemRevParedeEvents(container) {
    // Felipe (sessao 2026-06 — BUG FIX CRITICO): Storage.get faz JSON.parse
    // a cada chamada -> obterVersao() retorna CLONE NOVO toda vez. O bug:
    //   1. const item = getItem();  // CLONE 1
    //   2. item.revestimento = v;    // muta CLONE 1
    //   3. atualizarVersao(id, { itens: obterVersao().versao.itens });
    //                          ^^^ chama obterVersao DE NOVO -> CLONE 2 sem mutacao!
    //   4. CLONE 2 e' salvo, mutacao perdida.
    // Felipe via: "Cor e Revestimento nao ficam, na realidade nada ali
    // funciona". Selects pareciam responder mas re-render restaurava ''.
    // Solucao: getRoot() retorna o CLONE COMPLETO da versao + index do
    // item — handler muta esse clone e passa o MESMO clone pra
    // atualizarVersao (sem chamar obterVersao de novo).
    function getRoot() {
      const r = obterVersao(UI.versaoAtivaId);
      if (!r?.versao) return null;
      const item = r.versao.itens?.[UI.itemSelecionadoIdx];
      if (!item) return null;
      return { versao: r.versao, item };
    }
    function persistir(root) {
      atualizarVersao(root.versao.id, { itens: root.versao.itens });
    }
    function reRender() {
      const r = obterVersao(UI.versaoAtivaId);
      if (r?.versao) {
        const item = r.versao.itens[UI.itemSelecionadoIdx];
        renderItemRevestimentoParede(container,
          obterNegocio(UI.negocioAtivoId), r.opcao, r.versao, item);
      }
    }

    // Campos top-level
    container.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('change', () => {
        const root = getRoot();
        if (!root) return;
        const item = root.item;
        const field = el.dataset.field;
        const v = el.value;
        if (field === 'quantidade') {
          item.quantidade = Math.max(1, parseInt(v, 10) || 1);
        } else if (field === 'revestimento') {
          // Trocar revestimento → zera cor
          const antigo = item.revestimento || '';
          item.revestimento = v;
          if (antigo && antigo !== v) item.cor = '';
        } else if (field === 'revestimentoExterno') {
          // Felipe sessao 31 porta_interna: trocar revestimento externo zera cor externa
          const antigo = item.revestimentoExterno || '';
          item.revestimentoExterno = v;
          if (antigo && antigo !== v) item.corExterna = '';
        } else if (field === 'revestimentoInterno') {
          // Felipe sessao 31 porta_interna: trocar revestimento interno zera cor interna
          const antigo = item.revestimentoInterno || '';
          item.revestimentoInterno = v;
          if (antigo && antigo !== v) item.corInterna = '';
        } else if (field === 'fechaduraInternaCodigo') {
          // Felipe sessao 31 porta_interna: trocar fechadura zera cor derivada
          // (proximo render recalcula a cor com base no novo codigo)
          item.fechaduraInternaCodigo = v;
          if (!v) item.fechaduraInternaCor = '';
        } else if (field === 'largura_total' || field === 'altura_total') {
          item[field] = parseFloat(v.replace(',', '.')) || 0;
        } else if (field === 'espacamentoRipas') {
          // Felipe sessao 18: campo numerico (default 30mm)
          item.espacamentoRipas = parseFloat(String(v).replace(',', '.')) || 30;
        } else {
          item[field] = v;
        }
        persistir(root);  // ← MESMO clone, com a mutacao
        if (window.OrcamentoWizard?.resetar) window.OrcamentoWizard.resetar();
        // Campos que mudam o layout precisam re-render
        if (['modo', 'revestimento', 'divisao_largura', 'com_refilado',
             'largura_total', 'altura_total',
             'temEstrutura', 'estilo',
             // Felipe sessao 31 porta_interna: trocas que afetam o layout do form
             'revestimentoExterno', 'revestimentoInterno',
             'fechaduraModo', 'fechaduraInternaCodigo'].includes(field)) {
          reRender();
        }
      });
    });

    // Campos de pecas (modo manual)
    container.querySelectorAll('[data-field-peca]').forEach(el => {
      el.addEventListener('change', () => {
        const root = getRoot();
        if (!root || !Array.isArray(root.item.pecas)) return;
        const idx = parseInt(el.dataset.pecaIdx, 10);
        const field = el.dataset.fieldPeca;
        if (idx >= 0 && idx < root.item.pecas.length) {
          root.item.pecas[idx][field] = parseFloat(el.value.replace(',', '.')) || 0;
          persistir(root);
          if (window.OrcamentoWizard?.resetar) window.OrcamentoWizard.resetar();
        }
      });
    });

    // Felipe sessao 18: campos de paredes (modo automatico multi-parede).
    // 'varias medidas nesse mesmo item revestimento medidas diferente
    // e quantidades mas calcula tudo junto'.
    function syncTopLevelComPrimeiraParede(item) {
      // Mantem item.largura_total/altura_total/divisao_largura/com_refilado
      // espelhados com a PRIMEIRA parede (back-compat com ~23 sitios que
      // leem esses campos diretamente: gerarPecasAutomatico, perfis, etc).
      const p0 = (item.paredes || [])[0];
      if (p0) {
        item.largura_total   = Number(p0.largura_total) || 0;
        item.altura_total    = Number(p0.altura_total)  || 0;
        item.divisao_largura = p0.divisao_largura || 'maxima';
        item.com_refilado    = p0.com_refilado    || 'sim';
      }
    }
    container.querySelectorAll('[data-field-parede]').forEach(el => {
      el.addEventListener('change', () => {
        const root = getRoot();
        if (!root) return;
        const item = root.item;
        if (!Array.isArray(item.paredes)) item.paredes = [];
        const idx = parseInt(el.dataset.paredeIdx, 10);
        const field = el.dataset.fieldParede;
        if (!(idx >= 0 && idx < item.paredes.length)) return;
        if (field === 'quantidade') {
          item.paredes[idx].quantidade = Math.max(1, parseInt(el.value, 10) || 1);
        } else if (field === 'largura_total' || field === 'altura_total') {
          item.paredes[idx][field] = parseFloat(String(el.value).replace(',', '.')) || 0;
        } else {
          item.paredes[idx][field] = el.value;
        }
        syncTopLevelComPrimeiraParede(item);
        persistir(root);
        if (window.OrcamentoWizard?.resetar) window.OrcamentoWizard.resetar();
        // Sempre re-renderiza pra atualizar o hint de calculo
        reRender();
      });
    });

    // Botao + adicionar parede
    container.querySelector('#orc-rev-add-parede')?.addEventListener('click', () => {
      const root = getRoot();
      if (!root) return;
      if (!Array.isArray(root.item.paredes)) root.item.paredes = [];
      root.item.paredes.push({
        largura_total: '',
        altura_total:  '',
        quantidade:    1,
        divisao_largura: 'maxima',
        com_refilado:    'sim',
      });
      persistir(root);
      reRender();
    });

    // Botao remover parede
    container.querySelectorAll('[data-action="remover-parede"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const root = getRoot();
        if (!root) return;
        const idx = parseInt(btn.dataset.paredeIdx, 10);
        if (!Array.isArray(root.item.paredes)) return;
        if (root.item.paredes.length <= 1) return;  // mantem pelo menos 1
        if (idx >= 0 && idx < root.item.paredes.length) {
          root.item.paredes.splice(idx, 1);
          syncTopLevelComPrimeiraParede(root.item);
          persistir(root);
          reRender();
        }
      });
    });

    // Botao adicionar peca
    container.querySelector('#rev-btn-add-peca')?.addEventListener('click', () => {
      const root = getRoot();
      if (!root) return;
      if (!Array.isArray(root.item.pecas)) root.item.pecas = [];
      root.item.pecas.push({ largura: 0, altura: 0, quantidade: 1 });
      persistir(root);
      reRender();
    });

    // Botao remover peca
    container.querySelectorAll('[data-action="remover-peca"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const root = getRoot();
        const idx = parseInt(btn.dataset.pecaIdx, 10);
        if (root && Array.isArray(root.item.pecas) && idx >= 0 && idx < root.item.pecas.length) {
          root.item.pecas.splice(idx, 1);
          persistir(root);
          reRender();
        }
      });
    });

    // Salvar
    container.querySelector('#orc-btn-salvar')?.addEventListener('click', () => {
      if (window.showSavedDialog) window.showSavedDialog();
      else alert('Salvo!');
    });

    // Felipe (sessao 2026-08): "REVESTIMENTO BOTAO CALCULAR NAO FUNCIONA".
    // Bug: bindItemRevParedeEvents nunca tinha handler pro botao
    // #orc-btn-calcular — so' o handler do renderItemTab principal tinha,
    // mas em revestimento_parede o renderItemTab redireciona pro
    // renderItemRevestimentoParede ANTES de fazer o bind. Solucao:
    // adiciona o handler aqui, com comportamento equivalente.
    container.querySelector('#orc-btn-calcular')?.addEventListener('click', () => {
      const r = obterVersao(UI.versaoAtivaId);
      if (!r?.versao) return;
      const versao = r.versao;
      // Marca como calculado (fluxo Calcular/Recalcular). Libera as
      // abas DRE, Lev. Perfis, Custo Fab/Inst, etc.
      atualizarVersao(versao.id, {
        calculadoEm: nowIso(),
        calcDirty: false,
      });
      if (window.showSavedDialog) window.showSavedDialog('Calculado.');
      // Re-renderiza pra atualizar visual do botao (↻ Calcular -> ↻ Recalcular)
      renderItemTab(container);
    });

    // Felipe sessao 18: 'se eu tiver somente revestimento parede nao
    // tem botao de calcular'. Bug colateral: botoes Limpar Tela e
    // Voltar pro CRM tambem nao tinham handler nesse caminho — sem
    // o orc-banner-actions no banner, eles nem existiam. Agora que
    // o banner foi adicionado, registra handlers tambem.
    bindZerarButton(container, () => renderItemTab(container));
    container.querySelector('#orc-btn-back-crm')?.addEventListener('click', () => {
      limparLeadAtivo();
      UI.negocioAtivoId = null;
      UI.versaoAtivaId  = null;
      UI.leadAtivo      = null;
      UI.itemSelecionadoIdx = 0;
      if (typeof App !== 'undefined' && App.navigateTo) App.navigateTo('crm');
    });

    // Felipe (sessao 2026-06): bindings do chip list (Item 1, Item 2... ✕)
    // e do dropdown "+ Adicionar item". Antes esses handlers so eram bound
    // em bindEventos do renderItemTab principal, entao quando o item ativo
    // era revestimento_parede o chip list aparecia mas os botoes nao
    // funcionavam. Agora replicados aqui pra paridade total com o item
    // tipo porta_externa.

    // Trocar de item ativo (clica no chip)
    container.querySelectorAll('[data-action="select-item"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        if (!isNaN(idx)) {
          UI.itemSelecionadoIdx = idx;
          renderItemTab(container);
        }
      });
    });

    // Remover item (botao X)
    container.querySelectorAll('[data-action="remove-item"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        const versao = versaoAtiva();
        if (!versao) return;
        const lista = versao.itens || [];
        if (!confirm(`Remover Item ${idx + 1} (${labelTipo(lista[idx].tipo)})?`)) return;
        // Felipe (sessao 2026-08): "QUERO PODER DELETAR E VOLTAR A TELA
        // INICIAL QUE ESCOLHO QUAL ITEM IRE USAR". Se e o ULTIMO item,
        // em vez de deixar lista vazia, reseta o tipo dele pra '' —
        // assim renderItemTab cai automaticamente em renderEscolhaTipo.
        if (lista.length <= 1) {
          const itemReset = { ...lista[0], tipo: '' };
          atualizarVersao(versao.id, { itens: [itemReset] });
          UI.itemSelecionadoIdx = 0;
          renderItemTab(container);
          return;
        }
        const novaLista = lista.filter((_, i) => i !== idx);
        atualizarVersao(versao.id, { itens: novaLista });
        if (UI.itemSelecionadoIdx >= novaLista.length) UI.itemSelecionadoIdx = novaLista.length - 1;
        renderItemTab(container);
      });
    });

    // Dropdown "+ Adicionar item"
    container.querySelector('#orc-item-add')?.addEventListener('change', (e) => {
      const tipo = e.target.value;
      if (!tipo) return;
      const versao = versaoAtiva();
      if (!versao) return;
      // Felipe sessao 2026-05-10: passa versao pra novoItem herdar
      // rev/cor da porta anterior quando criar um fixo_acoplado.
      const novaLista = [...(versao.itens || []), novoItem(tipo, versao)];
      atualizarVersao(versao.id, { itens: novaLista });
      UI.itemSelecionadoIdx = novaLista.length - 1;
      renderItemTab(container);
    });
  }

  function renderItemTab(container) {
    inicializarSessao();
    const item = itemAtual();
    const negocio = obterNegocio(UI.negocioAtivoId);
    const versao = obterVersao(UI.versaoAtivaId).versao;
    const opcao  = obterVersao(UI.versaoAtivaId).opcao;
    // Felipe (sessao 09): responsável pelo orçamento (salvo no lead)
    const leadResp = lerLeadAtivo() || {};
    const leadResponsavel = leadResp.responsavel_orcamento || '';

    if (!item) {
      // Defesa em profundidade — em teoria nunca acontece pq inicializarSessao
      // garante pelo menos 1 item, mas evita o crash.
      container.innerHTML = `
        <div class="orc-banner">
          <span class="t-strong">Sem item selecionado.</span> Use "+ Adicionar item" pra comecar.
        </div>
      `;
      return;
    }

    // Felipe (Sessao 2): tela vazia ate o usuario escolher o tipo do item.
    // Aqui mostra 4 cards e re-renderiza ao escolher um.
    if (!item.tipo) {
      renderEscolhaTipo(container, negocio, opcao, versao);
      return;
    }

    // Felipe (sessao 2026-05): revestimento_parede tem form proprio
    // (modo manual com lista de pecas OU automatico com largura/altura
    // total da parede + opcoes de divisao e refilado). Renderiza em
    // funcao separada e retorna.
    if (item.tipo === 'revestimento_parede') {
      renderItemRevestimentoParede(container, negocio, opcao, versao, item);
      return;
    }
    // Felipe sessao 18: novo item PERGOLADO. Form proprio com tubo
    // selecionavel, espacamento, multi-paredes. Motor de chapas/perfis
    // em scripts/41/42-pergolado.
    if (item.tipo === 'pergolado') {
      renderItemPergolado(container, negocio, opcao, versao, item);
      return;
    }

    const cad = Storage.scope('cadastros');
    const modelos     = cad.get('modelos_lista')     || [];
    const acessorios  = cad.get('acessorios_lista')  || [];
    const superficies = cad.get('superficies_lista') || [];

    // Felipe (sessao 2026-05): suporte a modelo externo + interno
    // separados. Retro-compat: itens antigos com modeloNumero unico ja
    // foram migrados em normalizarItem() pra ter modeloExterno =
    // modeloInterno = modeloNumero. Aqui so faz lookup nas 2 chaves.
    const modeloExternoAtual = modelos.find(m =>
      Number(m.numero) === Number(item.modeloExterno)
    ) || null;
    const modeloInternoAtual = modelos.find(m =>
      Number(m.numero) === Number(item.modeloInterno)
    ) || null;
    // modeloAtual continua existindo pras regras de calculo legado —
    // aponta pro EXTERNO (lado principal do projeto).
    const modeloAtual = modeloExternoAtual;
    const nomeModelo = String(modeloAtual?.nome || '');

    // --- regras condicionais (calculadas pra render ---
    // Medidas sempre em milimetros.
    const largura = parseFloat(String(item.largura).replace(',', '.')) || 0;
    const altura  = parseFloat(String(item.altura).replace(',', '.'))  || 0;
    const temMedidas = largura > 0 && altura > 0;

    // === REGRA SISTEMA ===
    // <1200 → dobradica travada. >=1200 → escolha livre (vazio inicial).
    const forcaDobradica = largura > 0 && largura < 1200;

    // === REGRA FECHADURA MECANICA por altura ===
    // padrao: <3100=08 | 3101-5100=12 | 5101-7100=16 | >7100=24
    // Philips 9300: soma +560 em todos os limiares (porta inteligente fica mais alta).
    const ehPhilips9300 = /philips/i.test(item.fechaduraDigital || '') && /9300/.test(item.fechaduraDigital || '');
    const offsetPhilips = ehPhilips9300 ? 560 : 0;
    const fmAuto = (() => {
      if (!altura) return '';
      if (altura < 3100 + offsetPhilips) return '08 pinos';
      if (altura <= 5100 + offsetPhilips) return '12 pinos';
      if (altura <= 7100 + offsetPhilips) return '16 pinos';
      return '24 pinos';
    })();
    // Helper: compara so o numero base de pinos (ignora variante "+1").
    // Ex: pinosBase("08 pinos") === pinosBase("08 pinos +1") === "08"
    const pinosBase = (s) => { const m = String(s||'').match(/\d+/); return m ? m[0] : ''; };
    const fmForaDaRegra = altura > 0 && item.fechaduraMecanica &&
      pinosBase(item.fechaduraMecanica) !== pinosBase(fmAuto);

    // === REGRA CILINDRO ===
    // Default sempre KESO. Se Tedee selecionada → KESO obrigatorio (trava).
    const ehTedee = /tedee/i.test(item.fechaduraDigital || '');
    const cilindroTravado = ehTedee;
    const cilindroAuto = 'KESO seguranca';

    const ehCava = /\bcava\b/i.test(nomeModelo);
    const ehFriso = /friso/i.test(nomeModelo);
    const mostraCor = ['ACM 4mm', 'Aluminio Macico 2mm', 'HPL 4mm', 'Vidro'].includes(item.revestimento);

    // Filtra superficies por revestimento usando a categoria canonica
    // do cadastro (ACM/HPL/Vidro/Aluminio Macico). A funcao auto e' compartilhada.
    function filtrarSuperficies(rev) {
      let lista = superficies;
      if (rev) {
        const cat = (rev === 'Aluminio Macico 2mm') ? 'aluminio_macico'
                  : (rev === 'ACM 4mm')             ? 'acm'
                  : (rev === 'HPL 4mm')             ? 'hpl'
                  : (rev === 'Vidro') ? 'vidro'
                  : null;
        if (cat) {
          const auto = window.Superficies?.categoriaAuto || (() => 'acm');
          lista = (superficies || []).filter(s => (s.categoria || auto(s.descricao)) === cat);
        }
      }
      // Felipe: a descricao nao deve mostrar a medida da chapa.
      // O cadastro tem 4 entradas por cor (1500x5000, 6000, 7000, 8000) — deduplica
      // pelo nome curto. O tamanho real sera escolhido pelo aproveitamento de chapas.
      const seen = new Set();
      const dedup = [];
      (lista || []).forEach(s => {
        const nome = nomeCurtoSuperficie(s.descricao);
        if (!nome) return;
        const k = nome.toUpperCase();
        if (seen.has(k)) return;
        seen.add(k);
        dedup.push({ ...s, descricao: nome });
      });
      return dedup;
    }
    // Remove sufixo " - 1500 x 5000", " -1500 X 6000", " - 1500 X8000" etc.
    // Aceita variacoes de espacos, x/X, e separadores.
    function nomeCurtoSuperficie(desc) {
      if (!desc) return '';
      return String(desc)
        .replace(/\s*[-–]\s*\d{3,4}\s*[xX×]\s*\d{3,4}\s*$/, '')
        .trim();
    }
    const superficiesFiltradas = filtrarSuperficies(item.revestimento);

    // Felipe sessao 13: Modelo 23 + Aluminio Maciço 2mm precisa de 2 datalists
    // separados — um pra cores AM (campos corChapaAM_Ext/Int) e outro pra
    // cores ACM (campos corExterna/corInterna que viram chapa ACM nesse caso).
    // Bug do commit anterior: todos os 4 campos usavam o mesmo datalist
    // 'orc-superficies-list' que filtrava pelo revestimento (= AM), entao
    // os 4 mostravam so' cores AM. Felipe nao conseguia escolher cor ACM.
    const _modNumPort = Number(item.modeloExterno || item.modeloInterno || item.modeloNumero) || 0;
    const _revLow = String(item.revestimento || '').toLowerCase();
    const ehMod23AM = (_modNumPort === 23) && /aluminio.*macico/.test(_revLow) && /2\s*mm/.test(_revLow);
    const superficiesAM  = ehMod23AM ? filtrarSuperficies('Aluminio Macico 2mm') : [];
    const superficiesACM = ehMod23AM ? filtrarSuperficies('ACM 4mm')             : [];

    const ehUSA = false;  // Etapa 5 vai plugar com lead.destinoPais === 'United States'
    const mostraPlusUm = ehUSA && largura > 2400;

    // Fechaduras digitais: filtra acessorios pela familia
    const fechDigitais = acessorios.filter(a => /Fechadura Digital/i.test(a.familia || ''));

    // Tamanhos puxador externo — em mm, de 1500 a 5000 step 500
    const tamanhosPuxador = ['Enviado pelo cliente', 'Nao se aplica'];
    for (let t = 1500; t <= 5000; t += 500) tamanhosPuxador.push(t + ' mm');

    // Fechaduras mecanicas — sempre todas visiveis com "X pinos" e variantes "+1".
    // A regra automatica calcula o NÚMERO BASE de pinos pela altura (08/12/16/24).
    // O usuario pode trocar pra variante "+1" sem isso ser "fora da regra"
    // (e' so uma especificacao adicional, nao uma violacao de altura).
    const fechMecanicas = [
      '04 pinos',
      '08 pinos', '08 pinos +1',
      '12 pinos', '12 pinos +1',
      '16 pinos', '16 pinos +1',
      '24 pinos', '24 pinos +1',
    ];

    // Revestimentos fixos
    const revestimentos = ['ACM 4mm', 'HPL 4mm', 'Aluminio Macico 2mm', 'Vidro'];

    // Helpers de markup
    const opt = (v, sel, lbl) => `<option value="${escapeHtml(v)}" ${v === sel ? 'selected' : ''}>${escapeHtml(lbl != null ? lbl : v)}</option>`;
    const optEmpty = '<option value=""></option>';

    // Felipe: banner mostra Reserva e AGP em vez de "Lead #03".
    // Reserva primeiro, AGP depois. Sem reserva e sem AGP, fallback
    // pro Lead #N pra nao ficar sem identificacao.
    function tagsLeadHtml() {
      if (!UI.leadAtivo) return '<span class="orc-tag-dev">modo teste local</span>';
      const r = (UI.leadAtivo.numeroReserva || '').trim();
      const a = (UI.leadAtivo.numeroAGP || '').trim();
      const partes = [];
      if (r) partes.push(`Reserva ${escapeHtml(r)}`);
      if (a) partes.push(`AGP ${escapeHtml(a)}`);
      if (partes.length === 0) {
        // fallback: "Lead #03" (curto)
        const idCurto = UI.leadAtivo.id.startsWith('lead_')
          ? UI.leadAtivo.id.replace('lead_', '#')
          : '#' + String(UI.leadAtivo.id).slice(-6);
        return `<span class="orc-tag-lead">Lead ${escapeHtml(idCurto)}</span>`;
      }
      return `<span class="orc-tag-lead">${partes.join(' · ')}</span>`;
    }

    container.innerHTML = `
      ${(() => {
        // Felipe (do doc - msg "em todas as abas preciso largura altura modelo"):
        // cabecalho da empresa + banner com caracteristicas dos itens em TODAS as abas.
        const leadIt = lerLeadAtivo() || {};
        const numDocIt = `${(opcao?.letra || 'A')} - ${versao.numero}`;
        const headerItHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
          ? window.Empresa.montarHeaderRelatorio({
              lead: leadIt,
              tituloRelatorio: 'Caracteristicas do Item',
              numeroDocumento: numDocIt,
              validade: 15,
            })
          : '';
        // Felipe (sessao 2026-06): banner MEMORIAL pra versoes imutaveis
        // (aprovadas ou fechadas). Avisa que dados podem ter sido
        // calculados com cadastros antigos. Valores exibidos sao os
        // que estavam salvos na versao quando ela foi aprovada/fechada.
        const memorialBanner = versaoEhImutavel(versao) ? `
          <div class="orc-banner-memorial">
            <span class="orc-banner-memorial-icon">📜</span>
            <span class="orc-banner-memorial-msg">
              <b>Modo Memorial / Somente Leitura</b> —
              ${versao.aprovadoEm ? 'esta versao foi APROVADA e o valor foi enviado pro CRM.' : 'esta versao esta FECHADA como historico.'}
              Os dados aqui ficam congelados como referencia. Pra alterar, use <b>+ Nova Versao</b> no banner acima.
            </span>
          </div>` : '';
        // Felipe (sessao 2026-08 v3): BUG CRITICO — havia duas IIFEs
        // concatenadas mal-formadas que faziam vazar como TEXTO literal:
        //   "return headerItHtml + bannerCaracteristicasItens(versao); })()"
        // Esse texto aparecia no topo da pagina e podia travar o sistema
        // dependendo de como o navegador interpretava o HTML quebrado.
        // Solucao: UMA IIFE so, retornando header + memorial + caracteristicas.
        return headerItHtml + bannerCaracteristicasItens(versao);
      })()}
      <div class="orc-banner">
        <div class="orc-banner-info">
          <span class="t-strong">Negocio em edicao:</span>
          ${escapeHtml(negocio?.clienteNome || '—')}
          ${tagsLeadHtml()}
          · Opcao ${escapeHtml(opcao.letra)}
        </div>
        <div class="orc-banner-actions">
          <button type="button" class="orc-btn-calcular ${versao.calcDirty || !versao.calculadoEm ? 'is-dirty' : 'is-ok'}" id="orc-btn-calcular" title="${versao.calculadoEm ? 'Atualiza DRE, Levantamentos, Custo Fab/Inst com os valores atuais' : 'Roda os calculos pela primeira vez'}">${versao.calculadoEm ? '↻ Recalcular' : '▶ Calcular'}</button>
          <button type="button" class="univ-btn-save" id="orc-btn-salvar">✓ Tudo salvo</button>
          <!-- Felipe (sessao 2026-08): "RETIRE ESSA VERSOES DO CALCULO
               VAMOS TER QUE REPENSAR DO ZERO". Removidos da UI:
               seletor de versao, +Nova Versao, banner memorial,
               tag FECHADA/APROVADA/draft. A estrutura interna
               (negocio.opcoes[].versoes[]) continua existindo em
               background mas o usuario so' interage com a primeira
               versao. -->
          <button class="orc-btn-zerar" id="orc-btn-zerar" title="Limpa os inputs da tela e cria nova versao em branco preservando o historico.">🧹 Limpar Tela</button>
          ${UI.leadAtivo ? `<button class="orc-btn-back" id="orc-btn-back-crm" title="Voltar para o card no CRM">← Voltar pro CRM</button>` : ''}
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin:8px 0;padding:8px 12px;background:#f0f7ff;border:1px solid #c5d9ed;border-radius:4px;">
        <label style="font-size:12px;font-weight:700;color:#1a5276;white-space:nowrap;">Responsável:</label>
        <select id="orc-responsavel" style="padding:4px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;flex:1;max-width:200px;">
          <option value="">— selecionar —</option>
          <option value="Felipe" ${(leadResponsavel === 'Felipe') ? 'selected' : ''}>Felipe</option>
          <option value="Andressa" ${(leadResponsavel === 'Andressa') ? 'selected' : ''}>Andressa</option>
          <option value="Thays" ${(leadResponsavel === 'Thays') ? 'selected' : ''}>Thays</option>
        </select>
      </div>

      <div class="orc-itens-list">
        ${(versao.itens || []).map((it, idx) => {
          const ativo = idx === UI.itemSelecionadoIdx;
          // Felipe (sessao 2026-08): "QUANDO SO TEM UM ITEM NAO TEM
          // OPCAO DE DELETAR ELE MESMO". Botao X sempre presente.
          // Ao deletar o ultimo, volta pra tela de escolha de tipo.
          return `
            <div class="orc-item-chip ${ativo ? 'is-active' : ''}" data-idx="${idx}">
              <button class="orc-item-chip-label" data-action="select-item" data-idx="${idx}">
                Item ${idx + 1}: ${escapeHtml(labelTipo(it.tipo))}
              </button>
              <button class="orc-item-chip-remove" data-action="remove-item" data-idx="${idx}" title="Remover este item">✕</button>
            </div>
          `;
        }).join('')}
        <div class="orc-item-add-wrapper">
          <select class="orc-item-add" id="orc-item-add">
            <option value="">+ Adicionar item</option>
            ${TIPOS_ITEM.map(t => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="orc-item">
        <div class="orc-item-header">
          <div class="orc-item-titulo">Item ${UI.itemSelecionadoIdx + 1} — ${escapeHtml(labelTipo(item.tipo))}</div>
        </div>

        ${item.tipo === 'fixo_acoplado' ? `
        <!-- Felipe (sessao 30): Form do FIXO ACOPLADO. Item independente
             que reusa motor da porta com nFolhas=1 e largura/altura proprias. -->
        <div class="orc-section">
          <div class="orc-section-title">Dimensoes</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-qtd">
              <label>Quantidade</label>
              <input type="number" min="1" data-field="quantidade" value="${escapeHtml(String(item.quantidade || 1))}" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Largura (mm)</label>
              <input type="text" data-field="largura" value="${escapeHtml(String(item.largura || ''))}" placeholder="" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Altura (mm)</label>
              <input type="text" data-field="altura" value="${escapeHtml(String(item.altura || ''))}" placeholder="" />
            </div>
          </div>
        </div>

        <!-- Felipe sessao 13: FOLGAS editaveis por item no Fixo Acoplado.
             Mesma feature da porta externa. Vazio = usa default 10mm.
             Preenchido = override so' nesse fixo. -->
        <div class="orc-section">
          <div class="orc-section-title">Folgas (mm)</div>
          <p style="font-size:12px; color: var(--text-muted); margin: 0 0 8px 0;">
            Padrao: 10mm em cada lado. No fixo lateral, normalmente o lado
            que encosta na porta nao tem folga (deixe 0).
          </p>
          <div class="orc-form-row">
            <div class="orc-field orc-f-qtd">
              <label>Lateral Esquerda</label>
              <input type="number" min="0" step="1" data-field="fglEsq"
                     value="${escapeHtml(_folgaParaInput(item, 'fglEsq'))}"
                     />
            </div>
            <div class="orc-field orc-f-qtd">
              <label>Lateral Direita</label>
              <input type="number" min="0" step="1" data-field="fglDir"
                     value="${escapeHtml(_folgaParaInput(item, 'fglDir'))}"
                     />
            </div>
            <div class="orc-field orc-f-qtd">
              <label>Superior</label>
              <input type="number" min="0" step="1" data-field="fgSup"
                     value="${escapeHtml(_folgaParaInput(item, 'fgSup'))}"
                     />
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Configuracao do Fixo</div>

          <!-- Felipe sessao 13: Revestimento e a PRIMEIRA pergunta. Se for
               Vidro, esconde 'Lados revestidos' (vidro e' unico, atravessa)
               e abre selector pra escolher qual vidro do cadastro. -->
          <div class="orc-form-row">
            <div class="orc-field">
              <label>Revestimento</label>
              <select data-field="revestimento">
                <option value=""></option>
                ${revestimentos.map(r => `<option value="${escapeHtml(r)}" ${item.revestimento === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
              </select>
            </div>
            ${item.revestimento === 'Vidro' ? `
            <div class="orc-field" style="flex:2;">
              <label>Tipo de vidro</label>
              <select data-field="vidroDescricao">
                <option value=""></option>
                ${(() => {
                  try {
                    const sups = (window.Storage ? Storage.scope('cadastros').get('superficies_lista') : null) || [];
                    const vidros = sups.filter(s => String(s.categoria || '').toLowerCase() === 'vidro');
                    return vidros.map(v => {
                      const cob = v.cobranca === 'chapa' ? ' [chapa]' : ' [m²]';
                      const sel = item.vidroDescricao === v.descricao ? 'selected' : '';
                      return `<option value="${escapeHtml(v.descricao)}" ${sel}>${escapeHtml(v.descricao)}${cob}</option>`;
                    }).join('');
                  } catch(_) { return ''; }
                })()}
              </select>
            </div>
            ` : ''}
          </div>

          <div class="orc-form-row">
            <div class="orc-field">
              <label>Posicao</label>
              <select data-field="posicao">
                <option value="superior" ${item.posicao !== 'lateral' ? 'selected' : ''}>Superior (em cima da porta)</option>
                <option value="lateral" ${item.posicao === 'lateral' ? 'selected' : ''}>Lateral (ao lado da porta)</option>
              </select>
            </div>
            <div class="orc-field">
              <label>Tem estrutura de aluminio?</label>
              <select data-field="temEstrutura">
                <option value="sim" ${(item.temEstrutura || 'sim') === 'sim' ? 'selected' : ''}>Sim</option>
                <option value="nao" ${item.temEstrutura === 'nao' ? 'selected' : ''}>Nao</option>
              </select>
            </div>
            ${item.revestimento !== 'Vidro' ? `
            <div class="orc-field">
              <label>Lados revestidos</label>
              <select data-field="lados">
                <option value="1lado" ${item.lados !== '2lados' ? 'selected' : ''}>1 lado (so externo)</option>
                <option value="2lados" ${item.lados === '2lados' ? 'selected' : ''}>2 lados (externo + interno)</option>
              </select>
            </div>
            ` : ''}
            ${item.temEstrutura !== 'nao' ? (() => {
              // Felipe (sessao 14): "puxe isso automatico pela porta
              // anterior ao item fixo - se a porta anterior for PA006
              // ou PA007 pela regra da altura, busca isso da porta".
              // Regra: altura < 4000 = PA006, altura >= 4000 = PA007
              // (mesma regra usada em 28-acessorios-porta-externa.js
              // e 31-perfis-porta-externa.js fam '76' vs '101').
              let sysAuto = null;
              try {
                const itensV = (versao && versao.itens) || [];
                const idxFixo = UI.itemSelecionadoIdx;
                // 1) Procura porta IMEDIATAMENTE anterior na lista
                let porta = null;
                for (let i = idxFixo - 1; i >= 0; i--) {
                  const it = itensV[i];
                  if (it && it.tipo === 'porta_externa') { porta = it; break; }
                }
                // 2) Fallback: qualquer porta da versao
                if (!porta) {
                  porta = itensV.find(it => it && it.tipo === 'porta_externa') || null;
                }
                if (porta) {
                  const h = parseFloat(String(porta.altura || '').replace(',', '.')) || 0;
                  if (h > 0) sysAuto = h < 4000 ? 'PA006' : 'PA007';
                }
              } catch (_) {}
              // Se inferiu da porta, atualiza item.sistema (mantem
              // sincronizado pro motor de calculo). Se ja estava no
              // mesmo valor, nao faz nada. Sem porta valida, mantem
              // o que ja estava (default PA006 do novoItem).
              if (sysAuto && item.sistema !== sysAuto) {
                item.sistema = sysAuto;
              }
              const sysAtual = item.sistema || 'PA006';
              const lockedAuto = !!sysAuto;
              const helpTxt = lockedAuto
                ? `<span style="font-size:10px; color: var(--cinza-medio, #8c92a0); font-weight:400;"> · auto da porta (alt ${sysAuto === 'PA006' ? '<' : '≥'} 4000mm)</span>`
                : '';
              return `
            <div class="orc-field">
              <label>Sistema${helpTxt}</label>
              <select data-field="sistema"${lockedAuto ? ' disabled title="Definido automaticamente pela altura da porta. Edite a altura da porta para alterar."' : ''}>
                <option value="PA006" ${sysAtual !== 'PA007' ? 'selected' : ''}>PA006</option>
                <option value="PA007" ${sysAtual === 'PA007' ? 'selected' : ''}>PA007</option>
              </select>
            </div>
              `;
            })() : ''}
          </div>
          ${item.revestimento !== 'Vidro' ? `
          <div class="orc-form-row">
            ${item.posicao !== 'lateral' ? `
              <!-- Felipe sessao 13: SUPERIOR mantem 'Segue modelo da porta?'
                   (replica o modelo da porta principal — comportamento original)
                   Felipe sessao 2026-05-10: 'se eu coloco que tem estrutura
                   aparece opcao de dizer que segue modelo da porta entao vc
                   saberia que porta e ripado mas... se coloco que nao tem
                   estrutura essa opcao some (corrija isso deve aparecer)'.
                   Aparece sempre (com ou sem estrutura) - assim o motor de
                   chapas tambem sabe qual modelo seguir mesmo sem perfis. -->
              <div class="orc-field">
                <label>Segue modelo da porta?</label>
                <select data-field="fixoSegueModelo">
                  <option value="sim" ${(item.fixoSegueModelo || 'sim') === 'sim' ? 'selected' : ''}>Sim — replica modelo da porta</option>
                  <option value="nao" ${item.fixoSegueModelo === 'nao' ? 'selected' : ''}>Nao — escolher modelo proprio</option>
                </select>
              </div>
              ${item.fixoSegueModelo === 'nao' ? `
              <div class="orc-field orc-f-modelo">
                <label>Modelo do Fixo</label>
                <select data-field="modeloNumero">
                  ${(() => {
                    try {
                      const modelos = (window.Storage ? Storage.scope('cadastros').get('modelos_lista') : null) || [];
                      const opcoes = modelos.length
                        ? modelos.map(m => `<option value="${m.numero}" ${String(item.modeloNumero) === String(m.numero) ? 'selected' : ''}>${m.numero} — ${escapeHtml(m.nome || '')}</option>`).join('')
                        : '<option value="1">1 — Liso (default)</option>';
                      return opcoes;
                    } catch (_) {
                      return '<option value="1">1 — Liso</option>';
                    }
                  })()}
                </select>
              </div>
              ` : ''}
            ` : `
              <!-- Felipe sessao 13: LATERAL nao replica modelo da porta
                   (normalmente e' uma chapa lisa). Em vez disso pergunta
                   o tipo de chapa: lisa, ripado ou moldura.
                   Felipe sessao 2026-05-10: 'Tipo de chapa ripado lisa
                   moldura, some quando colocamos sem estrutura deve manter'.
                   O tipo de chapa afeta AS CHAPAS, nao a estrutura -
                   precisa estar visivel mesmo sem perfis. -->
              <div class="orc-field">
                <label>Tipo de chapa</label>
                <select data-field="tipoLateral">
                  <option value="lisa"    ${(item.tipoLateral || 'lisa') === 'lisa'    ? 'selected' : ''}>Chapa lisa</option>
                  <option value="ripado"  ${item.tipoLateral === 'ripado'  ? 'selected' : ''}>Ripado</option>
                  <option value="moldura" ${item.tipoLateral === 'moldura' ? 'selected' : ''}>Moldura</option>
                </select>
              </div>
            `}
          </div>
          ` : ''}
        </div>

        ${(() => {
          // Felipe sessao 13: cor de chapa do FIXO ACOPLADO.
          // - Superior/Lateral + ACM/HPL/Aluminio Macico  -> mostra cor (categoria do rev)
          // - Lateral + Vidro                              -> mostra cor ACM (NOVO!)
          //   (porque o fixo lateral c/ vidro tem pecas ACM:
          //   Fita Acabamento do PF + Revestimento do Tubo)
          // - Superior + Vidro                             -> NAO mostra
          //   (vidro puro, sem chapa de revestimento)
          if (!item.revestimento) return '';
          const ehLatVidro = item.posicao === 'lateral' && item.revestimento === 'Vidro';
          if (item.revestimento === 'Vidro' && !ehLatVidro) return '';
          // Quando Lateral+Vidro, forca filtro pra categoria 'acm' e label 'ACM'.
          // Nos outros casos, usa o revestimento do item.
          const revFiltro = ehLatVidro ? 'ACM 4mm' : item.revestimento;
          const labelMat  = ehLatVidro ? 'ACM' : item.revestimento;
          return `
        <div class="orc-section">
          <div class="orc-section-title">Acabamento${ehLatVidro ? ' (Chapa ACM do Fixo Lateral)' : ''}</div>
          ${ehLatVidro ? `
          <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px 0;">
            Cores das peças ACM que vao no fixo lateral com vidro
            (Fita Acabamento do PF + Revestimento do Tubo).
          </p>
          ` : ''}
          <div class="orc-cor-stack">
            <div class="orc-field orc-f-cor">
              <label>Cor ${escapeHtml(labelMat)} Externa</label>
              <input type="text" list="orc-superficies-list-fixo" data-field="corExterna"
                     value="${escapeHtml(item.corExterna || '')}"
                     placeholder="" title="${escapeHtml(item.corExterna || '')}" />
            </div>
            <button type="button" class="orc-btn-copiar-stack" id="orc-btn-copiar-cor-ext-int-fixo"
                    title="Copia a Cor Externa para a Cor Interna (caso sejam iguais)">
              ↓ Copiar Externo → Interno
            </button>
            <div class="orc-field orc-f-cor">
              <label>Cor ${escapeHtml(labelMat)} Interna</label>
              <input type="text" list="orc-superficies-list-fixo" data-field="corInterna"
                     value="${escapeHtml(item.corInterna || '')}"
                     placeholder="" title="${escapeHtml(item.corInterna || '')}" />
            </div>
          </div>
          <datalist id="orc-superficies-list-fixo">
            ${(() => {
              const sup = filtrarSuperficies(revFiltro) || [];
              const vistas = new Set();
              const opts = [];
              sup.forEach(s => {
                const limpo = nomeCurtoSuperficie(s.descricao);
                if (!limpo || vistas.has(limpo)) return;
                vistas.add(limpo);
                opts.push('<option value="' + escapeHtml(limpo) + '"></option>');
              });
              return opts.join('');
            })()}
          </datalist>
        </div>
          `;
        })()}
        ` : item.tipo === 'porta_externa' ? `` : item.tipo === 'porta_interna' ? (() => {
          // Felipe sessao 31 v2: form de PORTA INTERNA REVISADO.
          // Felipe pediu (mensagem):
          //   - Largura, altura
          //   - Cor INTERNA e cor EXTERNA (separadas) + REVESTIMENTO antes
          //     pra filtrar as cores (ACM, HPL, Vidro, Aluminio Macico)
          //   - Modo fechadura: Conjunto OU Personalizado
          //   - Conjunto: 6 fechaduras Hafele (sem filtro EXT/WC)
          //   - Personalizado: fechadura + macaneta separadas (com aviso
          //     se nao tem macaneta cadastrada)
          //   - Cor da dobradica oculta (Preta/Escovada/Branca)

          // 1) Modelos internos
          const modelosInt = (window.Modelos && window.Modelos.listarInternas)
            ? window.Modelos.listarInternas()
            : [{ id: 'seed_modelo_int_01', numero: 1, nome: 'Lisa' }];

          // 2) Listas dos cadastros
          const _todosAcessorios = (() => {
            try {
              return (window.Acessorios && window.Acessorios.listar)
                ? window.Acessorios.listar() : [];
            } catch (_) { return []; }
          })();
          const fechHafele = _todosAcessorios.filter(a => /^PA-FECHINT 911\.80/.test(a.codigo || ''));
          const dobInvInt  = _todosAcessorios.filter(a => /^PA-DOBINVINT/.test(a.codigo || ''));
          const macanetas  = _todosAcessorios.filter(a => {
            const fam = String(a.familia || '').toUpperCase();
            return fam.indexOf('MACANETA') >= 0 || fam.indexOf('MAÇANETA') >= 0;
          });
          // Felipe sessao 31: modo personalizado precisa de 3 listas
          // separadas (familia exata no cadastro de acessorios).
          // Kits Hafele (PA-FECHINT 911.*) tem familia "Fechaduras Internas"
          // e SO aparecem no modo conjunto — sao excluidos das maquinas.
          const maquinas  = _todosAcessorios.filter(a => {
            const fam = String(a.familia || '').toUpperCase();
            return fam.indexOf('FECHADURA MEC') >= 0;
          });
          const cilindros = _todosAcessorios.filter(a => {
            const fam = String(a.familia || '').toUpperCase();
            return fam.indexOf('CILINDRO') >= 0;
          });

          // 3) Superficies + revestimento
          const cadInt = Storage.scope('cadastros');
          const superficiesInt = cadInt.get('superficies_lista') || [];
          const revestimentosInt = ['ACM 4mm', 'HPL 4mm', 'Aluminio Macico 2mm', 'Vidro'];
          function filtrarCoresPI(rev) {
            let lista = superficiesInt;
            if (rev) {
              const cat = (rev === 'Aluminio Macico 2mm') ? 'aluminio_macico'
                        : (rev === 'ACM 4mm')             ? 'acm'
                        : (rev === 'HPL 4mm')             ? 'hpl'
                        : (rev === 'Vidro')               ? 'vidro'
                        : null;
              if (cat) {
                const auto = window.Superficies?.categoriaAuto || (() => 'acm');
                lista = (superficiesInt || []).filter(s => (s.categoria || auto(s.descricao)) === cat);
              }
            }
            const seenPI = new Set();
            const dedupPI = [];
            (lista || []).forEach(s => {
              const nome = String(s.descricao || '')
                .replace(/\s*[-–]\s*\d{3,4}\s*[xX×]\s*\d{3,4}\s*$/, '')
                .trim();
              if (!nome) return;
              const k = nome.toUpperCase();
              if (seenPI.has(k)) return;
              seenPI.add(k);
              dedupPI.push({ ...s, descricao: nome });
            });
            return dedupPI;
          }
          const coresExtPI = filtrarCoresPI(item.revestimentoExterno);
          const coresIntPI = filtrarCoresPI(item.revestimentoInterno);

          // Modo da fechadura
          const modoFech = item.fechaduraModo || 'conjunto'; // default conjunto
          const semMacanetas = macanetas.length === 0;
          const semMaquinas  = maquinas.length === 0;
          const semCilindros = cilindros.length === 0;

          return `
        <div class="orc-section">
          <div class="orc-section-title">Dimensoes</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-qtd">
              <label>Quantidade</label>
              <input type="number" min="1" data-field="quantidade" value="${escapeHtml(String(item.quantidade || 1))}" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Largura (mm)</label>
              <input type="text" data-field="largura" value="${item.largura ? escapeHtml(String(item.largura)) : ''}" placeholder="" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Altura (mm)</label>
              <input type="text" data-field="altura" value="${item.altura ? escapeHtml(String(item.altura)) : ''}" placeholder="" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Largura da Parede (mm)</label>
              <input type="text" data-field="larguraParede" value="${item.larguraParede ? escapeHtml(String(item.larguraParede)) : ''}" placeholder="ex: 150" title="Espessura da parede. Informativo." />
            </div>
            <div class="orc-field orc-f-modelo">
              <label>Modelo</label>
              <select data-field="modeloNumero">
                ${modelosInt.map(m => `<option value="${m.numero}" ${Number(item.modeloNumero || 1) === m.numero ? 'selected' : ''}>${escapeHtml(String(m.numero).padStart(2,'0'))} - ${escapeHtml(m.nome)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Folgas (mm)</div>
          <p style="font-size:12px; color: var(--text-muted); margin: 0 0 8px 0;">
            Folgas entre o vao e a porta. Padrao 5mm em cada lado.
            Aplicam em todos os perfis (batente, click batente, folha, click folha).
          </p>
          <div class="orc-form-row">
            <div class="orc-field orc-f-qtd">
              <label>Lateral Esquerda</label>
              <input type="number" min="0" step="0.1" data-field="fglEsq"
                     value="${escapeHtml(String(item.fglEsq != null && item.fglEsq !== '' ? item.fglEsq : 5))}" />
            </div>
            <div class="orc-field orc-f-qtd">
              <label>Lateral Direita</label>
              <input type="number" min="0" step="0.1" data-field="fglDir"
                     value="${escapeHtml(String(item.fglDir != null && item.fglDir !== '' ? item.fglDir : 5))}" />
            </div>
            <div class="orc-field orc-f-qtd">
              <label>Superior</label>
              <input type="number" min="0" step="0.1" data-field="fgSup"
                     value="${escapeHtml(String(item.fgSup != null && item.fgSup !== '' ? item.fgSup : 5))}" />
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Face Externa</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-revestimento">
              <label>Revestimento</label>
              <select data-field="revestimentoExterno">
                <option value=""></option>
                ${revestimentosInt.map(r => `<option value="${escapeHtml(r)}" ${item.revestimentoExterno === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
              </select>
            </div>
            <div class="orc-field orc-f-revestimento">
              <label>Cor externa</label>
              <input type="text" list="orc-pi-cores-ext-list" data-field="corExterna" value="${escapeHtml(item.corExterna || '')}" placeholder="${item.revestimentoExterno ? '' : 'Escolha o revestimento primeiro'}" title="${escapeHtml(item.corExterna || '')}" />
              <datalist id="orc-pi-cores-ext-list">
                ${(() => {
                  const vistas = new Set();
                  const opts = [];
                  coresExtPI.forEach(s => {
                    const limpo = String(s.descricao || '').trim();
                    if (!limpo || vistas.has(limpo.toUpperCase())) return;
                    vistas.add(limpo.toUpperCase());
                    opts.push(`<option value="${escapeHtml(limpo)}"></option>`);
                  });
                  return opts.join('');
                })()}
              </datalist>
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title-bar">
            <div class="orc-section-actions">
              <button type="button" id="orc-btn-copiar-face-ext-pi"
                      style="font-size:11px; font-weight:600; padding:5px 12px; border:1px solid var(--laranja, #d97706); background:#fff7ed; color:var(--laranja, #c2410c); border-radius:5px; cursor:pointer; letter-spacing:0.3px; text-transform:uppercase;"
                      title="Copia revestimento e cor da Face Externa para a Face Interna">
                ⇆ Copiar Face Externa
              </button>
            </div>
            <div class="orc-section-title">Face Interna</div>
          </div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-revestimento">
              <label>Revestimento</label>
              <select data-field="revestimentoInterno">
                <option value=""></option>
                ${revestimentosInt.map(r => `<option value="${escapeHtml(r)}" ${item.revestimentoInterno === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
              </select>
            </div>
            <div class="orc-field orc-f-revestimento">
              <label>Cor interna</label>
              <input type="text" list="orc-pi-cores-int-list" data-field="corInterna" value="${escapeHtml(item.corInterna || '')}" placeholder="${item.revestimentoInterno ? '' : 'Escolha o revestimento primeiro'}" title="${escapeHtml(item.corInterna || '')}" />
              <datalist id="orc-pi-cores-int-list">
                ${(() => {
                  const vistas = new Set();
                  const opts = [];
                  coresIntPI.forEach(s => {
                    const limpo = String(s.descricao || '').trim();
                    if (!limpo || vistas.has(limpo.toUpperCase())) return;
                    vistas.add(limpo.toUpperCase());
                    opts.push(`<option value="${escapeHtml(limpo)}"></option>`);
                  });
                  return opts.join('');
                })()}
              </datalist>
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Fechadura</div>
          <div class="orc-form-row">
            <div class="orc-field" style="grid-column: span 6;">
              <label>Modo</label>
              <div style="display:flex;gap:16px;padding-top:6px;">
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:normal;">
                  <input type="radio" name="fechaduraModo_${item.id || 'pi'}" data-field="fechaduraModo" value="conjunto" ${modoFech === 'conjunto' ? 'checked' : ''} />
                  Conjunto (fechadura + macaneta juntos)
                </label>
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:normal;">
                  <input type="radio" name="fechaduraModo_${item.id || 'pi'}" data-field="fechaduraModo" value="personalizado" ${modoFech === 'personalizado' ? 'checked' : ''} />
                  Personalizado (escolher separado)
                </label>
              </div>
            </div>
          </div>

          ${modoFech === 'conjunto' ? `
            <div class="orc-form-row" style="margin-top:8px;">
              <div class="orc-field" style="grid-column: span 6;">
                <label>Conjunto Hafele</label>
                <select data-field="fechaduraInternaCodigo">
                  <option value=""></option>
                  ${fechHafele.map(f => `<option value="${escapeHtml(f.codigo)}" ${item.fechaduraInternaCodigo === f.codigo ? 'selected' : ''}>${escapeHtml(f.codigo)} — ${escapeHtml(f.descricao)}</option>`).join('')}
                </select>
              </div>
            </div>
            ${item.fechaduraInternaCodigo ? (() => {
              const fechSel = fechHafele.find(f => f.codigo === item.fechaduraInternaCodigo);
              const desc = String(fechSel?.descricao || '').toUpperCase();
              let corFech = '';
              if (desc.includes('NIQ FOSCO') || desc.includes('NIQUEL FOSCO')) corFech = 'Niquel Fosco';
              else if (desc.includes('TITANIUM')) corFech = 'Titanium';
              else if (desc.includes('PRETO')) corFech = 'Preta';
              return `<div class="orc-form-row" style="margin-top:6px;">
                <div class="orc-field" style="grid-column: span 6;">
                  <label>Cor do conjunto <span class="orc-hint-auto">auto: derivada do codigo</span></label>
                  <input type="text" data-field="fechaduraInternaCor" value="${escapeHtml(corFech)}" readonly style="background:#f5f5f5;" />
                </div>
              </div>`;
            })() : ''}
          ` : `
            ${semMaquinas || semMacanetas || semCilindros ? `
              <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:10px;margin:8px 0;font-size:13px;color:#92400e;">
                ⚠ Faltam acessorios cadastrados para o modo personalizado:
                ${semMaquinas ? '<b>Maquinas</b> (familia "Fechadura Mecanica") ' : ''}
                ${semMacanetas ? '<b>Macanetas</b> (familia "Macanetas/Maçanetas") ' : ''}
                ${semCilindros ? '<b>Cilindros</b> (familia "Cilindros") ' : ''}
                — cadastre em <b>Cadastros &gt; Acessorios</b>.
              </div>
            ` : ''}
            <div class="orc-form-row" style="margin-top:8px;">
              <div class="orc-field" style="grid-column: span 4;">
                <label>Maquina / Fechadura mecanica</label>
                <select data-field="maquinaInternaCodigo" ${semMaquinas ? 'disabled' : ''}>
                  <option value=""></option>
                  ${maquinas.map(f => `<option value="${escapeHtml(f.codigo)}" ${item.maquinaInternaCodigo === f.codigo ? 'selected' : ''}>${escapeHtml(f.codigo)} — ${escapeHtml(f.descricao)}</option>`).join('')}
                </select>
              </div>
              <div class="orc-field" style="grid-column: span 4;">
                <label>Macaneta <span class="orc-hint-auto">com rosetas integradas</span></label>
                <select data-field="macanetaInternaCodigo" ${semMacanetas ? 'disabled' : ''}>
                  <option value=""></option>
                  ${macanetas.map(m => `<option value="${escapeHtml(m.codigo)}" ${item.macanetaInternaCodigo === m.codigo ? 'selected' : ''}>${escapeHtml(m.codigo)} — ${escapeHtml(m.descricao)}</option>`).join('')}
                </select>
              </div>
              <div class="orc-field" style="grid-column: span 4;">
                <label>Cilindro</label>
                <select data-field="cilindroInternaCodigo" ${semCilindros ? 'disabled' : ''}>
                  <option value=""></option>
                  ${cilindros.map(c => `<option value="${escapeHtml(c.codigo)}" ${item.cilindroInternaCodigo === c.codigo ? 'selected' : ''}>${escapeHtml(c.codigo)} — ${escapeHtml(c.descricao)}</option>`).join('')}
                </select>
              </div>
            </div>
          `}
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Dobradica oculta</div>
          <div class="orc-form-row">
            <div class="orc-field" style="grid-column: span 6;">
              <label>Cor da dobradica</label>
              <select data-field="dobradicaCor">
                <option value=""></option>
                <option value="Preta" ${item.dobradicaCor === 'Preta' ? 'selected' : ''}>Preta — PA-DOBINVINTPRE</option>
                <option value="Escovada" ${item.dobradicaCor === 'Escovada' ? 'selected' : ''}>Escovada — PA-DOBINVINTESC</option>
                <option value="Branca" ${item.dobradicaCor === 'Branca' ? 'selected' : ''}>Branca — PA-DOBINVINTBRA</option>
              </select>
            </div>
          </div>
        </div>

        <div class="orc-section" style="background:#fffbeb; border:1px solid #fcd34d; border-radius:6px; padding:12px; margin-top:12px;">
          <div class="orc-section-title" style="color:#92400e;">⚠ Modulo em construcao</div>
          <p style="font-size:13px; color: #92400e; margin:6px 0 0;">
            Porta interna: formulario completo. Motor de cortes ja' tem o BATENTE
            (PA-BATENTEINT) implementado. Click batente, folha, click folha,
            travessas 46×46 e demais perfis serao implementados conforme Felipe
            definir as formulas (cotas do AutoCAD).
          </p>
        </div>
          `;
        })() : `
        <div class="orc-section">
          <div class="orc-section-title">Em desenvolvimento</div>
          <p style="font-size:13px; color: var(--text-muted); padding: 8px 0;">
            O formulario detalhado de <span class="t-strong">${escapeHtml(labelTipo(item.tipo))}</span> ainda nao foi implementado.
            Por enquanto so <span class="t-strong">Porta Externa</span>, <span class="t-strong">Porta Interna</span>, <span class="t-strong">Fixo Acoplado</span> e <span class="t-strong">Revestimento de Parede</span> tem campos completos.
          </p>
          <div class="orc-form-row">
            <div class="orc-field orc-f-qtd">
              <label>Quantidade</label>
              <input type="number" min="1" data-field="quantidade" value="${((item.quantidade || 1) === '' || (item.quantidade || 1) === null || (item.quantidade || 1) === undefined || Number(item.quantidade || 1) === 0) ? '' : escapeHtml(String(item.quantidade || 1))}" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Largura (mm)</label>
              <input type="text" data-field="largura" value="${((item.largura || '') === '' || (item.largura || '') === null || (item.largura || '') === undefined || Number(item.largura || '') === 0) ? '' : escapeHtml(String(item.largura || ''))}" placeholder="" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Altura (mm)</label>
              <input type="text" data-field="altura" value="${((item.altura || '') === '' || (item.altura || '') === null || (item.altura || '') === undefined || Number(item.altura || '') === 0) ? '' : escapeHtml(String(item.altura || ''))}" placeholder="" />
            </div>
          </div>
        </div>
        `}
        ${item.tipo === 'porta_externa' ? `

        <div class="orc-section">
          <div class="orc-section-title">Dimensoes</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-qtd">
              <label>Quantidade</label>
              <input type="number" min="1" data-field="quantidade" value="${((item.quantidade) === '' || (item.quantidade) === null || (item.quantidade) === undefined || Number(item.quantidade) === 0) ? '' : escapeHtml(String(item.quantidade))}" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Largura (mm)</label>
              <input type="text" data-field="largura" value="${((item.largura) === '' || (item.largura) === null || (item.largura) === undefined || Number(item.largura) === 0) ? '' : escapeHtml(String(item.largura))}" placeholder="" />
            </div>
            <div class="orc-field orc-f-dim">
              <label>Altura (mm)</label>
              <input type="text" data-field="altura" value="${((item.altura) === '' || (item.altura) === null || (item.altura) === undefined || Number(item.altura) === 0) ? '' : escapeHtml(String(item.altura))}" placeholder="" />
            </div>
            <div class="orc-field orc-f-folhas">
              <label>N° folhas</label>
              <select data-field="nFolhas">
                <option value=""></option>
                <option value="1" ${String(item.nFolhas) === '1' ? 'selected' : ''}>1 folha</option>
                <option value="2" ${String(item.nFolhas) === '2' ? 'selected' : ''}>2 folhas</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Felipe sessao 13: FOLGAS editaveis por item. Default global =
             10mm (cadastro regras_variaveis_porta_externa). Vazio aqui
             = usa o default global. Preenchido = override so' nesse item. -->
        <div class="orc-section">
          <div class="orc-section-title">Folgas (mm)</div>
          <p style="font-size:12px; color: var(--text-muted); margin: 0 0 8px 0;">
            Padrao: 10mm em cada lado. Edite caso o vao exija folga diferente.
          </p>
          <div class="orc-form-row">
            <div class="orc-field orc-f-qtd">
              <label>Lateral Esquerda</label>
              <input type="number" min="0" step="1" data-field="fglEsq"
                     value="${escapeHtml(_folgaParaInput(item, 'fglEsq'))}"
                     />
            </div>
            <div class="orc-field orc-f-qtd">
              <label>Lateral Direita</label>
              <input type="number" min="0" step="1" data-field="fglDir"
                     value="${escapeHtml(_folgaParaInput(item, 'fglDir'))}"
                     />
            </div>
            <div class="orc-field orc-f-qtd">
              <label>Superior</label>
              <input type="number" min="0" step="1" data-field="fgSup"
                     value="${escapeHtml(_folgaParaInput(item, 'fgSup'))}"
                     />
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Modelo</div>
          <!-- Felipe (sessao 2026-05): layout VERTICAL compacto.
               Externo em cima, botao Copiar, Interno embaixo.
               NAO ocupa largura inteira — caixa compacta. -->
          <div class="orc-modelo-stack">
            <div class="orc-field orc-f-modelo">
              <label>Modelo Externo</label>
              <input type="text" list="orc-modelos-list" data-field="modeloExterno"
                     value="${escapeHtml(modeloExternoAtual ? `${modeloExternoAtual.numero} — ${modeloExternoAtual.nome}` : '')}"
                     placeholder="" />
            </div>
            <button type="button" class="orc-btn-copiar-stack" id="orc-btn-copiar-modelo-ext-int"
                    title="Copia o Modelo Externo para o Modelo Interno (caso sejam iguais)">
              ↓ Copiar Externo → Interno
            </button>
            <div class="orc-field orc-f-modelo">
              <label>Modelo Interno</label>
              <input type="text" list="orc-modelos-list" data-field="modeloInterno"
                     value="${escapeHtml(modeloInternoAtual ? `${modeloInternoAtual.numero} — ${modeloInternoAtual.nome}` : '')}"
                     placeholder="" />
            </div>
            <datalist id="orc-modelos-list">
              ${modelos.map(m => `<option value="${m.numero} — ${escapeHtml(m.nome)}"></option>`).join('')}
            </datalist>
          </div>
          ${(() => {
            // Felipe (sessao 2026-05): renderiza Características DE AMBOS
            // os modelos quando externo ≠ interno. Caso "Cava por fora,
            // Clássica por dentro" → 2 seções, uma pra cada lado.
            //
            // Quando externo === interno: 1 seção (caso normal).
            // Quando externo ≠ interno: 2 seções, cada uma com seus campos.
            //
            // Os campos físicos (distanciaBordaCava, tamanhoCava) podem
            // ser compartilhados entre modelos com cava — nesse caso,
            // ambas as seções editam o mesmo valor no item (sincronizam
            // via re-render).
            const numExt = Number(item.modeloExterno || item.modeloNumero);
            const numInt = Number(item.modeloInterno || item.modeloNumero);
            const camposExt = CAMPOS_POR_MODELO[numExt];
            const camposInt = CAMPOS_POR_MODELO[numInt];

            const temExt = camposExt && camposExt.length > 0;
            const temInt = camposInt && camposInt.length > 0;
            const modelosDiferentes = numExt !== numInt;

            // Helper pra renderizar uma seção (label + campos do modelo)
            function secaoModelo(numModelo, nomeModelo, prefixoTitulo) {
              if (!numModelo) return '';
              const campos = CAMPOS_POR_MODELO[numModelo];
              if (!campos || !campos.length) return '';
              const tituloLado = prefixoTitulo
                ? `${prefixoTitulo} — Modelo ${numModelo}${nomeModelo ? ` — ${escapeHtml(nomeModelo)}` : ''}`
                : `Caracteristicas do Modelo ${numModelo}${nomeModelo ? ` — ${escapeHtml(nomeModelo)}` : ''}`;
              return `
                <div class="orc-section orc-section-modelo-vars">
                  <div class="orc-section-title">${tituloLado}</div>
                  ${renderCamposPorModeloEspecifico(item, numModelo)}
                </div>`;
            }

            // Caso 1: modelos iguais → 1 seção (igual antes)
            if (!modelosDiferentes) {
              if (!temExt) return '';
              return secaoModelo(numExt, modeloExternoAtual?.nome, '');
            }

            // Caso 2: modelos diferentes → 2 seções
            const partes = [];
            if (temExt) partes.push(secaoModelo(numExt, modeloExternoAtual?.nome, 'Externo'));
            if (temInt) partes.push(secaoModelo(numInt, modeloInternoAtual?.nome, 'Interno'));
            return partes.join('');
          })()}
        </div>

        <!-- Felipe (do doc): TODA porta tem alisar/parede. Default: alisar SIM,
             largura 100, parede 250.
             Felipe (msg "sem alisar nao mostra"): se tem_alisar = Nao,
             esconde Largura do alisar e Espessura da parede. -->
        <div class="orc-section" id="orc-section-alisar-parede">
          <div class="orc-section-title">Alisar e Parede</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-alisar">
              <label>Tem alisar?</label>
              <!-- Felipe sessao 2026-05-10: 'coloque opcao alisar somente
                   1 lado ou dos dois lados, pois quando tem fixo superior
                   alisar e somente interno e essa decisao alterara
                   quantidade de pecas nas chapas'.
                   Felipe confirmou 4 opcoes: Externo, Interno, Externo+Interno, Sem.
                   Valor 'Sim' (legado) preservado = 'Externo + Interno' pra
                   compat com itens ja' salvos. Valores novos: 'Externo' e 'Interno'.
                   Default automatico: se ha fixo superior no orcamento ->
                   'Interno' (sem alisar externo onde fica o fixo). -->
              <select data-field="tem_alisar">
                <option value="Sim"     ${(item.tem_alisar || 'Sim') === 'Sim' ? 'selected' : ''}>Externo + Interno (dois lados)</option>
                <option value="Externo" ${item.tem_alisar === 'Externo' ? 'selected' : ''}>Somente Externo (um lado)</option>
                <option value="Interno" ${item.tem_alisar === 'Interno' ? 'selected' : ''}>Somente Interno (um lado)</option>
                <option value="Nao"     ${item.tem_alisar === 'Nao' ? 'selected' : ''}>Sem alisar</option>
              </select>
            </div>
            ${(item.tem_alisar !== 'Nao') ? `
            <div class="orc-field orc-f-alisar">
              <label>Largura do alisar (mm)</label>
              <input type="number" min="0" step="1" data-field="largura_alisar" value="${((item.largura_alisar || 100) === '' || (item.largura_alisar || 100) === null || (item.largura_alisar || 100) === undefined || Number(item.largura_alisar || 100) === 0) ? '' : escapeHtml(String(item.largura_alisar || 100))}" />
            </div>
            <div class="orc-field orc-f-alisar">
              <label>Espessura da parede (mm)</label>
              <input type="number" min="0" step="1" data-field="espessura_parede" value="${((item.espessura_parede || 250) === '' || (item.espessura_parede || 250) === null || (item.espessura_parede || 250) === undefined || Number(item.espessura_parede || 250) === 0) ? '' : escapeHtml(String(item.espessura_parede || 250))}" />
            </div>
            ` : ''}
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Acabamento</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-revestimento">
              <label>Revestimento</label>
              <select data-field="revestimento">
                <option value=""></option>
                ${revestimentos.map(r => opt(r, item.revestimento)).join('')}
              </select>
            </div>
            ${mostraCor ? `
            <!-- Felipe (sessao 2026-05): Cor EXTERNA em cima, botao copiar,
                 Cor INTERNA embaixo. Padrao identico ao Modelo Externo/Interno.
                 Cores diferentes = chapas separadas (1 pra cada lado).
                 Cor da CAVA aparece embaixo, condicional ao modelo ter cava
                 (modelos 1-9, 11, 22, 24). Botao "Copiar Externo → Cava"
                 entre Cor Interna e Cor da Cava. -->
            <div class="orc-cor-stack">
              <div class="orc-field orc-f-cor">
                <label>${ehMod23AM ? 'Cor ACM Externa' : 'Cor Externa'}</label>
                <input type="text" list="${ehMod23AM ? 'orc-superficies-list-acm' : 'orc-superficies-list'}" data-field="corExterna" value="${escapeHtml(item.corExterna)}" placeholder="" title="${escapeHtml(item.corExterna)}" />
              </div>
              <button type="button" class="orc-btn-copiar-stack" id="orc-btn-copiar-cor-ext-int"
                      title="Copia a Cor Externa para a Cor Interna (caso sejam iguais)">
                ↓ Copiar Externo → Interno
              </button>
              <div class="orc-field orc-f-cor">
                <label>${ehMod23AM ? 'Cor ACM Interna' : 'Cor Interna'}</label>
                <input type="text" list="${ehMod23AM ? 'orc-superficies-list-acm' : 'orc-superficies-list'}" data-field="corInterna" value="${escapeHtml(item.corInterna)}" placeholder="" title="${escapeHtml(item.corInterna)}" />
              </div>
              ${modeloTemCava(item.modeloExterno || item.modeloNumero) ? `
              <button type="button" class="orc-btn-copiar-stack" id="orc-btn-copiar-cor-ext-cava"
                      title="Copia a Cor Externa para a Cor da Cava (caso sejam iguais)">
                ↓ Copiar Externo → Cava
              </button>
              <div class="orc-field orc-f-cor">
                <label>Cor da Cava</label>
                <input type="text" list="orc-superficies-list" data-field="corCava" value="${escapeHtml(item.corCava || '')}" placeholder="" title="${escapeHtml(item.corCava || '')}" />
              </div>
              ` : ''}
              ${ehMod23AM ? `
                <div class="orc-cor-am-aviso" style="margin:8px 0;padding:8px 10px;background:#fff7e8;border-left:3px solid #d97706;border-radius:4px;font-size:12px;color:#7c3a00;">
                  <b>Modelo 23 + Alumínio Maciço:</b> as cores acima são da
                  <b>chapa ACM</b> (batentes, tampa de furo, acabamentos laterais,
                  U portal, alisar). Preencha abaixo as cores da <b>chapa AM</b>
                  (tampa maior, fitas de acabamento, cava).
                </div>
                <div class="orc-field orc-f-cor">
                  <label>Cor AM Externa</label>
                  <input type="text" list="orc-superficies-list-am" data-field="corChapaAM_Ext"
                         value="${escapeHtml(item.corChapaAM_Ext || '')}"
                         placeholder="" title="${escapeHtml(item.corChapaAM_Ext || '')}" />
                </div>
                <button type="button" class="orc-btn-copiar-stack" id="orc-btn-copiar-cor-am-ext-int"
                        title="Copia a Cor AM Externa para a Cor AM Interna (caso sejam iguais)">
                  ↓ Copiar AM Externo → AM Interno
                </button>
                <div class="orc-field orc-f-cor">
                  <label>Cor AM Interna</label>
                  <input type="text" list="orc-superficies-list-am" data-field="corChapaAM_Int"
                         value="${escapeHtml(item.corChapaAM_Int || '')}"
                         placeholder="" title="${escapeHtml(item.corChapaAM_Int || '')}" />
                </div>
              ` : ''}
            </div>
            <datalist id="orc-superficies-list">
              ${(() => {
                // Felipe sessao 2026-05: deduplicar pra mostrar so' nome sem medidas.
                const vistas = new Set();
                const opts = [];
                superficiesFiltradas.forEach(s => {
                  const limpo = nomeCurtoSuperficie(s.descricao);
                  if (!limpo || vistas.has(limpo)) return;
                  vistas.add(limpo);
                  opts.push(`<option value="${escapeHtml(limpo)}"></option>`);
                });
                return opts.join('');
              })()}
            </datalist>
            ${ehMod23AM ? `
            <!-- Felipe sessao 13: datalists separados pro Mod23+AM. -->
            <datalist id="orc-superficies-list-am">
              ${(() => {
                const vistas = new Set();
                const opts = [];
                superficiesAM.forEach(s => {
                  const limpo = nomeCurtoSuperficie(s.descricao);
                  if (!limpo || vistas.has(limpo)) return;
                  vistas.add(limpo);
                  opts.push(`<option value="${escapeHtml(limpo)}"></option>`);
                });
                return opts.join('');
              })()}
            </datalist>
            <datalist id="orc-superficies-list-acm">
              ${(() => {
                const vistas = new Set();
                const opts = [];
                superficiesACM.forEach(s => {
                  const limpo = nomeCurtoSuperficie(s.descricao);
                  if (!limpo || vistas.has(limpo)) return;
                  vistas.add(limpo);
                  opts.push(`<option value="${escapeHtml(limpo)}"></option>`);
                });
                return opts.join('');
              })()}
            </datalist>
            ` : ''}
            ` : ''}
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Sistema</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-sistema">
              <select data-field="sistema" ${forcaDobradica ? 'disabled' : ''}>
                <option value=""></option>
                ${opt('dobradica',  forcaDobradica ? 'dobradica' : item.sistema, 'Dobradica')}
                ${opt('pivotante', item.sistema, 'Pivotante')}
              </select>
              ${forcaDobradica ? '<span class="orc-hint-auto">auto: largura &lt; 1200 mm</span>' : (item._overrides?.sistema ? '<span class="orc-hint-warn">⚠ editado fora da regra</span>' : '')}
            </div>
          </div>
        </div>

        <div class="orc-section">
          <div class="orc-section-title">Fechaduras e cilindro</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-fech-mec">
              <label>Fechadura mecanica ${fmAuto && altura ? `<span class="orc-hint-auto">auto: ${ehPhilips9300 ? 'Philips 9300 (+560)' : 'altura'} → ${fmAuto}</span>` : ''} ${fmForaDaRegra ? '<span class="orc-hint-warn">⚠ editado fora da regra</span>' : ''}</label>
              <select data-field="fechaduraMecanica">
                <option value=""></option>
                ${fechMecanicas.map(f => opt(f, item.fechaduraMecanica)).join('')}
              </select>
            </div>
            <div class="orc-field orc-f-fech-dig">
              <label>Fechadura digital</label>
              <input type="text" list="orc-fech-digitais-list" data-field="fechaduraDigital" value="${escapeHtml(item.fechaduraDigital)}" placeholder="" title="${escapeHtml(item.fechaduraDigital)}" />
              <datalist id="orc-fech-digitais-list">
                <option value="Nao se aplica"></option>
                ${fechDigitais.map(a => `<option value="${escapeHtml(a.descricao)}"></option>`).join('')}
              </datalist>
            </div>
            <div class="orc-field orc-f-cilindro">
              <label>Cilindro ${cilindroTravado ? '<span class="orc-hint-auto">Tedee → KESO obrigatorio</span>' : ''} ${item._overrides?.cilindro ? '<span class="orc-hint-warn">⚠ editado fora da regra</span>' : ''}</label>
              <select data-field="cilindro" ${cilindroTravado ? 'disabled' : ''}>
                <option value=""></option>
                ${opt('KESO seguranca', cilindroTravado ? 'KESO seguranca' : item.cilindro)}
                ${opt('Udinese chave comum', item.cilindro)}
              </select>
            </div>
          </div>
        </div>

        ${!ehCava && nomeModelo ? `
        <div class="orc-section" id="orc-field-tamanho-puxador">
          <div class="orc-section-title">Puxador externo</div>
          <div class="orc-form-row">
            <div class="orc-field orc-f-puxador">
              <label>Tamanho</label>
              <select data-field="tamanhoPuxador">
                ${tamanhosPuxador.map(t => opt(t, item.tamanhoPuxador)).join('')}
              </select>
            </div>
          </div>
        </div>` : ''}
        ` : ''}
      </div>
    `;

    bindItemEvents(container);
    // Felipe (do doc - msg wizard): botao "Proximo: Levantamento de Perfis"
    adicionarBotaoWizard(container, 'item');
  }

  /**
   * Aplica as regras automaticas no item se o usuario AINDA NAO sobrescreveu
   * manualmente o campo. Devolve o item modificado (mesma referencia).
   *
   * Regras:
   *   - largura<1200    → sistema = dobradica (trava)
   *   - altura          → fechaduraMecanica baseado em faixa (Philips 9300 +560)
   *   - tedee           → cilindro = KESO (trava)
   *   - default cilindro = KESO seguranca quando vazio
   */
  function aplicarRegrasAutoItem(item) {
    if (!item) return item;
    if (!item._overrides) item._overrides = {};

    const lar = parseFloat(String(item.largura).replace(',', '.')) || 0;
    const alt = parseFloat(String(item.altura).replace(',', '.'))  || 0;
    const tedee = /tedee/i.test(item.fechaduraDigital || '');
    const philips9300 = /philips/i.test(item.fechaduraDigital || '') && /9300/.test(item.fechaduraDigital || '');
    const offsetPh = philips9300 ? 560 : 0;

    // Sistema: largura<1200 trava em dobradica (sobrescreve override)
    // Felipe sessao 12: 'ja inicie com sistema pivotate, claro se for
    // menor que 1100 eu acho e dobradica obrigatorio'. Mantém 1200 como
    // threshold (regra estabelecida). Default pivotante quando >=1200
    // E sistema ainda nao foi escolhido pelo user.
    if (lar > 0 && lar < 1200) {
      item.sistema = 'dobradica';
      delete item._overrides.sistema;
    } else if (lar >= 1200 && !item.sistema && !item._overrides.sistema) {
      // Default pivotante pra portas grandes
      item.sistema = 'pivotante';
    } else if (!item._overrides.sistema && lar === 0) {
      // sem largura ainda → mantem como esta (vazio inicialmente)
    }

    // Fechadura mecanica auto pela altura (so se nao foi editado manualmente).
    // Auto retorna "X pinos" (sem +1). User pode trocar pra variante "+1" via override.
    if (alt > 0 && !item._overrides.fechaduraMecanica) {
      let fm;
      if (alt < 3100 + offsetPh)        fm = '08 pinos';
      else if (alt <= 5100 + offsetPh)  fm = '12 pinos';
      else if (alt <= 7100 + offsetPh)  fm = '16 pinos';
      else                              fm = '24 pinos';
      item.fechaduraMecanica = fm;
    }

    // Cilindro: Tedee trava em KESO. Se nao Tedee e nao foi editado manualmente, default KESO.
    if (tedee) {
      item.cilindro = 'KESO seguranca';
      delete item._overrides.cilindro;
    } else if (!item._overrides.cilindro && !item.cilindro) {
      item.cilindro = 'KESO seguranca';
    }

    // Felipe sessao 12: 'ja inicie fechadura digital nao se aplica, caso
    // nao tenha alguma fechadura ja indicada no card'. Se chegou aqui sem
    // fechaduraDigital setada (card nao indicou), default 'Nao se aplica'.
    if (!item.fechaduraDigital && !item._overrides.fechaduraDigital) {
      item.fechaduraDigital = 'Nao se aplica';
    }

    // Felipe sessao 12: 'quando tiver cava, ja inicie ali com Distancia
    // da borda ate a cava (mm) 210 e Largura da cava (mm) 150'. Se o
    // modelo (externo OU interno) tem cava E os campos estao vazios,
    // aplica defaults. User pode editar depois.
    const numExt = Number(item.modeloExterno || item.modeloNumero || 0);
    const numInt = Number(item.modeloInterno || item.modeloNumero || 0);
    const temCava = modeloTemCava(numExt) || modeloTemCava(numInt);
    if (temCava) {
      if (item.distanciaBordaCava === '' || item.distanciaBordaCava == null) {
        item.distanciaBordaCava = 210;
      }
      if (item.tamanhoCava === '' || item.tamanhoCava == null) {
        item.tamanhoCava = 150;
      }
    }

    return item;
  }

  function bindItemEvents(container) {
    container.querySelectorAll('[data-field]').forEach(el => {
      // SEMPRE 'change' — dispara no blur. Nunca usar 'input' aqui porque
      // os campos gatilho (largura, altura, modelo, revestimento, fechaduraDigital)
      // re-renderizam a aba, o que faria o usuario perder o foco a cada tecla.
      el.addEventListener('change', () => {
        const v = el.value;

        // CRITICO: 1 load so por handler.
        const r = obterVersao(UI.versaoAtivaId);
        if (!r || !r.versao) return;
        const versao = r.versao;
        const idx = UI.itemSelecionadoIdx;
        const item = (versao.itens || [])[idx];
        if (!item) return;

        const field = el.dataset.field;
        if (!item._overrides) item._overrides = {};

        if (field === 'modeloNumero') {
          const num = parseInt(v, 10);
          item.modeloNumero = isNaN(num) ? '' : num;
          // Felipe (sessao 2026-05): modeloNumero legado tambem
          // sincroniza modeloExterno (legado vira o lado externo).
          item.modeloExterno = item.modeloNumero;
          if (!item.modeloInterno) item.modeloInterno = item.modeloNumero;
        } else if (field === 'modeloExterno') {
          // Felipe (sessao 2026-05): novo campo. Atualiza tambem o
          // modeloNumero legado (regras de fabricacao usam ele) — ele
          // segue o EXTERNO. Se modeloInterno estiver vazio, herda
          // do externo (defensivo).
          const num = parseInt(v, 10);
          item.modeloExterno = isNaN(num) ? '' : num;
          item.modeloNumero  = item.modeloExterno;
          if (item.modeloInterno === '' || item.modeloInterno === undefined) {
            item.modeloInterno = item.modeloExterno;
          }
        } else if (field === 'modeloInterno') {
          // Felipe (sessao 2026-05): novo campo independente do externo.
          // Pode ser diferente — ai levantamento de chapas calcula 2x
          // conjuntos de pecas (1 pra cada lado).
          const num = parseInt(v, 10);
          item.modeloInterno = isNaN(num) ? '' : num;
        } else if (field === 'quantidade') {
          item.quantidade = Math.max(1, parseInt(v, 10) || 1);
        } else if (field === 'revestimento') {
          // Felipe (sessao 2026-05): cada revestimento (ACM, HPL, Aluminio
          // Macico, Vidro) tem um cadastro PROPRIO de cores em Cadastros >
          // Superficies. Trocar revestimento invalida as cores anteriores
          // (eram da categoria antiga). Zera pra forçar usuario a escolher
          // de novo dentro da nova categoria.
          const revAntigo = item.revestimento || '';
          item.revestimento = v;
          if (revAntigo && revAntigo !== v) {
            item.corExterna = '';
            item.corInterna = '';
            item.corCava    = '';
          }
        } else {
          item[field] = v;
        }

        // ============================================================
        // Felipe sessao 2026-05-10: SYNC Porta <-> Fixo Acoplado.
        // 2 caminhos:
        //
        // A) Se ESTE item eh fixo_acoplado E user editou rev/cor:
        //    -> perde sync com a porta (__syncPortaIdx vira null).
        //    Pedido: "deixe livre para escolha [...] mesmo assim fica
        //    livre para alterar caso necessario".
        //
        // B) Se ESTE item eh porta_externa E user editou rev/cor:
        //    -> propaga pros fixos que AINDA estao em sync com esta
        //    porta (__syncPortaIdx === idx desta porta).
        //    Pedido: "se alterar a cor e revestimento da porta altere
        //    tambem do fixo acoplado a porta".
        //
        // Campos rastreados: revestimento, corExterna, corInterna,
        // corCava, corChapaAM_Ext, corChapaAM_Int.
        const CAMPOS_SYNC = ['revestimento', 'corExterna', 'corInterna',
                             'corCava', 'corChapaAM_Ext', 'corChapaAM_Int'];
        if (CAMPOS_SYNC.includes(field)) {
          if (item.tipo === 'fixo_acoplado' && item.__syncPortaIdx != null) {
            // A) User editou um fixo - perde sync (decisao deliberada do user)
            console.log('[Sync] Fixo idx', idx, 'editou', field, '- perdeu sync com porta',
                        item.__syncPortaIdx);
            delete item.__syncPortaIdx;
          } else if (item.tipo === 'porta_externa') {
            // B) Propaga pros fixos sincronizados com ESTA porta
            const itens = versao.itens || [];
            let propagados = 0;
            itens.forEach((it, i) => {
              if (!it || it.tipo !== 'fixo_acoplado') return;
              if (it.__syncPortaIdx !== idx) return;
              // Espelha o mesmo valor
              if (field === 'revestimento') {
                const revAntigoFixo = it.revestimento || '';
                it.revestimento = v;
                // Quando porta muda revestimento, zera as cores do fixo
                // (cores de ACM nao casam com cores HPL/AM/Vidro).
                // Cores serao re-copiadas no proximo edit de cor da porta.
                if (revAntigoFixo && revAntigoFixo !== v) {
                  it.corExterna = '';
                  it.corInterna = '';
                  it.corCava    = '';
                  it.corChapaAM_Ext = '';
                  it.corChapaAM_Int = '';
                }
              } else {
                it[field] = v;
              }
              propagados++;
            });
            if (propagados > 0) {
              console.log('[Sync] Porta idx', idx, 'mudou', field, 'para', JSON.stringify(v),
                          '- propagado pra', propagados, 'fixo(s) sincronizado(s)');
            }
          }
        }

        // === REGISTRO DE OVERRIDE ===
        // Override só faz sentido quando a REGRA ESTÁ ATIVA e o usuario escolhe
        // diferente dela. Se a regra nao impoe nada (ex: largura ≥ 1200 → escolha
        // livre Dobradica/Pivo), nao e' override — e' uma escolha valida.
        const lar = parseFloat(String(item.largura || '').replace(',', '.')) || 0;
        const alt = parseFloat(String(item.altura  || '').replace(',', '.')) || 0;
        const ehTedeeLocal = /tedee/i.test(item.fechaduraDigital || '');
        const ehPh9300Local = /philips/i.test(item.fechaduraDigital || '') && /9300/.test(item.fechaduraDigital || '');
        const offsPh = ehPh9300Local ? 560 : 0;

        function regraAtivaSistema()  { return lar > 0 && lar < 1200; }
        function regraAtivaCilindro() { return ehTedeeLocal; }
        function regraAtivaFM()       { return alt > 0; }

        function calcAutoFM() {
          if (alt < 3100 + offsPh)       return '08 pinos';
          if (alt <= 5100 + offsPh)      return '12 pinos';
          if (alt <= 7100 + offsPh)      return '16 pinos';
          return '24 pinos';
        }
        // Helper: compara fechadura mecanica so pelo numero base (08/12/16/24)
        // — variantes "+1" NAO contam como fora da regra.
        const pinBase = (s) => { const m = String(s||'').match(/\d+/); return m ? m[0] : ''; };

        if (field === 'sistema') {
          // Sistema só vira "fora da regra" se largura<1200 (regra ativa) e usuario
          // escolhe pivotante. Em qualquer outro caso e' livre.
          if (regraAtivaSistema() && v && v !== 'dobradica') {
            item._overrides.sistema = true;
          } else {
            delete item._overrides.sistema;
          }
        } else if (field === 'cilindro') {
          // Cilindro só vira "fora da regra" se Tedee (regra ativa) e usuario
          // escolhe diferente de KESO.
          if (regraAtivaCilindro() && v && v !== 'KESO seguranca') {
            item._overrides.cilindro = true;
          } else {
            delete item._overrides.cilindro;
          }
        } else if (field === 'fechaduraMecanica') {
          // Fechadura mecanica vira "fora da regra" só se altura > 0 (regra ativa)
          // e o NÚMERO BASE de pinos diverge do que a regra dita.
          // Variantes "+1" NAO contam (sao especificacoes adicionais).
          if (regraAtivaFM() && v && pinBase(v) !== pinBase(calcAutoFM())) {
            item._overrides.fechaduraMecanica = true;
          } else {
            delete item._overrides.fechaduraMecanica;
          }
        }

        // Se mudou largura/altura/fechaduraDigital/modelo, RE-aplica as regras
        // automaticas nos campos que ainda nao tem override.
        // Felipe sessao 12: modeloExterno/modeloInterno tambem disparam
        // pra aplicar defaults de cava (210/150) quando troca pro Modelo 1.
        const gatilhosRegras = ['largura', 'altura', 'fechaduraDigital', 'modeloNumero', 'modeloExterno', 'modeloInterno'];
        if (gatilhosRegras.includes(field)) {
          aplicarRegrasAutoItem(item);
        }

        try {
          // Recalcula Fab pq mudancas em altura/modelo/folhas/chapas/cor afetam horas
          const camposAfetamFab = ['altura', 'modeloNumero', 'nFolhas', 'qtdChapas', 'corInterna', 'corExterna', 'quantidade'];
          if (camposAfetamFab.includes(field)) {
            const fab = Object.assign({}, FAB_DEFAULT, versao.custoFab || {});
            fab.etapas = Object.assign({}, FAB_DEFAULT.etapas, fab.etapas || {});
            const rFab = calcularFab(fab, versao.itens);
            atualizarVersao(versao.id, { itens: versao.itens, subFab: rFab.total });
          } else {
            atualizarVersao(versao.id, { itens: versao.itens });
          }
          // Felipe (do doc - msg wizard): qualquer alteracao em
          // Caracteristicas invalida etapas seguintes. Volta wizard pra
          // 'item' — usuario tem que clicar Proximo de novo a cada etapa.
          if (window.OrcamentoWizard && typeof window.OrcamentoWizard.resetar === 'function') {
            window.OrcamentoWizard.resetar();
          }
        } catch (e) {
          console.warn('[orcamento] erro ao salvar item:', e.message);
        }

        // Re-render: campos podem aparecer/sumir e regras automaticas mudaram.
        // Tambem re-renderiza quando overrides em campos com regra pra mostrar
        // o aviso "⚠ editado fora da regra".
        // Felipe (Modelo 23): mudar quantidadeMolduras tambem re-renderiza
        // (pra mostrar/esconder distancia 1a-2a, 2a-3a). Mudar revestimento
        // tambem (pra mostrar/esconder perfilMoldura). Mudar tipoMoldura
        // (pra mostrar quantasDivisoes quando = Divisoes Iguais). Mudar
        // tem_alisar (pra esconder largura_alisar/espessura_parede).
        const camposGatilho = ['largura', 'altura', 'modeloNumero', 'modeloExterno', 'modeloInterno', 'revestimento', 'fechaduraDigital', 'quantidadeMolduras', 'tipoMoldura', 'tem_alisar'];
        const camposComRegraRender = ['sistema', 'fechaduraMecanica', 'cilindro'];
        if (camposGatilho.includes(field) || camposComRegraRender.includes(field)) {
          renderItemTab(container);
        }
      });
    });

    // Felipe (sessao 2026-05): botao "Copiar Externo → Interno" — atalho
    // pra quando os 2 modelos sao iguais. Copia o valor de modeloExterno
    // pro input de modeloInterno e dispara change pra salvar + re-render.
    container.querySelector('#orc-btn-copiar-modelo-ext-int')?.addEventListener('click', () => {
      const inpExt = container.querySelector('input[data-field="modeloExterno"]');
      const inpInt = container.querySelector('input[data-field="modeloInterno"]');
      if (!inpExt || !inpInt) return;
      const valExt = inpExt.value || '';
      if (!valExt.trim()) {
        alert('Selecione primeiro o Modelo Externo, depois copie pro Interno.');
        return;
      }
      inpInt.value = valExt;
      // Dispara change pra acionar o handler que persiste no banco e re-renderiza
      inpInt.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Felipe (sessao 2026-05): mesmo padrao pra Cor Externa → Interna.
    container.querySelector('#orc-btn-copiar-cor-ext-int')?.addEventListener('click', () => {
      const inpExt = container.querySelector('input[data-field="corExterna"]');
      const inpInt = container.querySelector('input[data-field="corInterna"]');
      if (!inpExt || !inpInt) return;
      const valExt = inpExt.value || '';
      if (!valExt.trim()) {
        alert('Selecione primeiro a Cor Externa, depois copie pra Interna.');
        return;
      }
      inpInt.value = valExt;
      inpInt.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Felipe (sessao 2026-05): mesmo padrao pra Cor Externa → Cava.
    container.querySelector('#orc-btn-copiar-cor-ext-cava')?.addEventListener('click', () => {
      const inpExt  = container.querySelector('input[data-field="corExterna"]');
      const inpCava = container.querySelector('input[data-field="corCava"]');
      if (!inpExt || !inpCava) return;
      const valExt = inpExt.value || '';
      if (!valExt.trim()) {
        alert('Selecione primeiro a Cor Externa, depois copie pra Cor da Cava.');
        return;
      }
      inpCava.value = valExt;
      inpCava.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Felipe sessao 13: copiar Cor AM Externa -> Cor AM Interna
    // (pareado com as cores ACM acima quando Mod23 + Aluminio Macico).
    container.querySelector('#orc-btn-copiar-cor-am-ext-int')?.addEventListener('click', () => {
      const inpExt = container.querySelector('input[data-field="corChapaAM_Ext"]');
      const inpInt = container.querySelector('input[data-field="corChapaAM_Int"]');
      if (!inpExt || !inpInt) return;
      const valExt = inpExt.value || '';
      if (!valExt.trim()) {
        alert('Selecione primeiro a Cor AM Externa, depois copie pra AM Interna.');
        return;
      }
      inpInt.value = valExt;
      inpInt.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Felipe sessao 13: copiar Cor Externa -> Cor Interna no FIXO ACOPLADO.
    // O fixo usa os mesmos data-fields corExterna/corInterna que a porta,
    // mas o botao tem id propio pra evitar conflito quando ambos os items
    // estiverem no DOM (improvavel pq form e' um item por vez, mas seguro).
    container.querySelector('#orc-btn-copiar-cor-ext-int-fixo')?.addEventListener('click', () => {
      const inpExt = container.querySelector('input[data-field="corExterna"]');
      const inpInt = container.querySelector('input[data-field="corInterna"]');
      if (!inpExt || !inpInt) return;
      const valExt = inpExt.value || '';
      if (!valExt.trim()) {
        alert('Selecione primeiro a Cor Externa, depois copie pra Cor Interna.');
        return;
      }
      inpInt.value = valExt;
      inpInt.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Felipe sessao 31: copiar Face Externa -> Face Interna no PORTA INTERNA.
    // Copia AMBOS: revestimentoExterno -> revestimentoInterno E
    //              corExterna           -> corInterna.
    // 1) Seta revestimento primeiro (dispara change que pode zerar a cor interna)
    // 2) Seta a cor por ultimo (pra nao ser sobrescrita)
    container.querySelector('#orc-btn-copiar-face-ext-pi')?.addEventListener('click', () => {
      const selRevExt = container.querySelector('select[data-field="revestimentoExterno"]');
      const selRevInt = container.querySelector('select[data-field="revestimentoInterno"]');
      const inpCorExt = container.querySelector('input[data-field="corExterna"]');
      const inpCorInt = container.querySelector('input[data-field="corInterna"]');
      if (!selRevExt || !selRevInt || !inpCorExt || !inpCorInt) return;
      const valRev = selRevExt.value || '';
      const valCor = inpCorExt.value || '';
      if (!valRev.trim()) {
        alert('Selecione primeiro o Revestimento Externo, depois copie pra Face Interna.');
        return;
      }
      // 1) Revestimento (dispara re-render do form, que invalida refs do DOM)
      selRevInt.value = valRev;
      selRevInt.dispatchEvent(new Event('change', { bubbles: true }));
      // 2) Cor — busca o input de novo (re-render pode ter recriado o nodo)
      setTimeout(() => {
        const inpCorInt2 = container.querySelector('input[data-field="corInterna"]');
        if (!inpCorInt2) return;
        inpCorInt2.value = valCor;
        inpCorInt2.dispatchEvent(new Event('change', { bubbles: true }));
      }, 0);
    });

    container.querySelector('#orc-btn-salvar')?.addEventListener('click', () => {
      salvarItensNoBanco();
      if (window.showSavedDialog) window.showSavedDialog();
      else alert('Caracteristicas salvas!');
    });

    // Felipe (R-fluxo Calcular/Recalcular): aperta Calcular -> grava
    // timestamp e limpa flag dirty. As outras abas (DRE, Lev. Perfis,
    // Custo Fab/Inst, Padroes de Cortes) ficam liberadas. Qualquer
    // mudanca em itens depois disso re-marca dirty automaticamente
    // (logica em atualizarVersao).
    // Felipe (sessao 2026-06): "botao recalcular nao funcionando" —
    // bug era que clicar com versao FECHADA causava throw silencioso
    // dentro de atualizarVersao (porque versao fechada e' imutavel).
    // Agora detecta antes e oferece criar nova versao.
    // Felipe (sessao 09): handler responsável pelo orçamento
    container.querySelector('#orc-responsavel')?.addEventListener('change', (e) => {
      const lead = lerLeadAtivo();
      if (!lead) return;
      lead.responsavel_orcamento = e.target.value;
      const store = Storage.scope('crm');
      const leads = store.get('leads') || [];
      const idx = leads.findIndex(l => l.id === lead.id);
      if (idx >= 0) { leads[idx] = lead; store.set('leads', leads); }
    });

    container.querySelector('#orc-btn-calcular')?.addEventListener('click', () => {
      // Salva quaisquer edicoes pendentes nos inputs antes de calcular
      salvarItensNoBanco();
      const versaoAtual = obterVersao(UI.versaoAtivaId).versao;

      // Felipe (sessao 2026-08): "RETIRE ESSA VERSOES DO CALCULO" —
      // recalcular nao oferece mais "criar nova versao". Recalcula
      // direto, mesmo se versao foi aprovada antes.
      // (versaoEhImutavel removido daqui)

      // Felipe (do doc): bloqueia calculo se algum item estiver incompleto
      if (algumItemIncompleto(versaoAtual)) {
        const itens = versaoAtual.itens || [];
        const detalhes = [];
        itens.forEach((it, idx) => {
          if (!itemEstaIncompleto(it)) return;
          if (!it.tipo) {
            detalhes.push(`Item ${idx+1}: tipo nao escolhido`);
          } else if (it.tipo === 'porta_externa') {
            const faltam = ['largura', 'altura', 'nFolhas', 'modeloExterno', 'modeloInterno', 'sistema',
                            'fechaduraMecanica', 'cilindro', 'corInterna', 'corExterna']
              .filter(c => {
                const v = it[c];
                return v === null || v === undefined || String(v).trim() === '';
              });
            detalhes.push(`Item ${idx+1}: faltam ${faltam.join(', ')}`);
          }
        });
        alert(
          'Nao da pra calcular ainda — ha campos obrigatorios em branco:\n\n' +
          detalhes.join('\n') +
          '\n\nPreencha todos os campos da aba Caracteristicas do Item primeiro.'
        );
        return;
      }
      try {
        // Felipe sessao 2026-08: 'isso deve varrer todos os valores pos
        // calculo'. ANTES de marcar calculadoEm, FORCA sync dos campos
        // auto-populados do Custo Fab/Inst (perfis, pintura, acessorios,
        // fechadura digital). Sem isso, Felipe via valores antigos no
        // Custo Fab/Inst (ex: 6.034,36 acessorios) enquanto o relatorio
        // de Fabricacao ja' refletia o novo (5.577,83) - desincronia.
        try { forcarSyncCustoFabAuto(versaoAtual); }
        catch(e) { console.warn('[Recalcular] forcarSyncCustoFabAuto:', e); }

        atualizarVersao(versaoAtual.id, { calculadoEm: Date.now(), calcDirty: false });
        renderItemTab(container);
        // Felipe (sessao 2026-06): "ao apertar recalcular de aviso que
        // foi recalculado e podemos seguir em frente" — feedback visivel.
        if (window.showSavedDialog) {
          window.showSavedDialog('Recalculado — DRE, Lev. Perfis e Custo Fab/Inst atualizados.');
        }
      } catch (e) {
        alert('Falha ao recalcular: ' + e.message);
      }
    });

    // Felipe: botao "Salvar como Versao N" — trava a versao atual como
    // historico (status=fechada) e cria automaticamente a Versao N+1 em
    // draft, clonada da atual, pra continuar editando. Versoes fechadas
    // ficam imutaveis e podem ser reabertas pela aba Clientes (drill-down).
    container.querySelector('#orc-btn-salvar-versao')?.addEventListener('click', () => {
      const r = obterVersao(UI.versaoAtivaId);
      if (!r) return;
      const versaoAtual = r.versao;
      const opcao       = r.opcao;
      const numAtual    = versaoAtual.numero;
      const numNova     = numAtual + 1;
      const ok = confirm(
        `Salvar como Versao ${numAtual}?\n\n` +
        `- A Versao ${numAtual} sera travada como historico (nao podera mais ser editada).\n` +
        `- Sera criada a Versao ${numNova} em draft, clonada desta, pra continuar editando.\n\n` +
        `Confirma?`
      );
      if (!ok) return;
      try {
        // 1. Salva pendencias e fecha a versao atual
        salvarItensNoBanco();
        fecharVersao(versaoAtual.id);
        // 2. Cria nova versao baseada na atual
        const novaVersao = criarVersao({
          opcaoId: opcao.id,
          baseadoEmVersaoId: versaoAtual.id,
        });
        // 3. Torna a nova versao ativa
        UI.versaoAtivaId = novaVersao.id;
        // 4. Re-renderiza a tela
        renderItemTab(container);
        // 5. Popup de confirmacao (R07)
        if (window.showSavedDialog) {
          window.showSavedDialog(`Versao ${numAtual} salva no historico. Editando agora a Versao ${numNova}.`);
        }
      } catch (err) {
        console.error('[orc-btn-salvar-versao]', err);
        alert('Nao foi possivel salvar a versao: ' + (err.message || err));
      }
    });

    // Trocar de item ativo (clica no chip)
    container.querySelectorAll('[data-action="select-item"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        if (!isNaN(idx)) {
          UI.itemSelecionadoIdx = idx;
          renderItemTab(container);
        }
      });
    });

    // Remover item (botao X)
    container.querySelectorAll('[data-action="remove-item"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        const versao = versaoAtiva();
        if (!versao) return;
        const lista = versao.itens || [];
        if (!confirm(`Remover Item ${idx + 1} (${labelTipo(lista[idx].tipo)})?`)) return;
        // Felipe (sessao 2026-08): "QUERO PODER DELETAR E VOLTAR A TELA
        // INICIAL QUE ESCOLHO QUAL ITEM IRE USAR". Se e o ULTIMO item,
        // em vez de deixar lista vazia, reseta o tipo dele pra '' —
        // assim renderItemTab cai automaticamente em renderEscolhaTipo.
        if (lista.length <= 1) {
          const itemReset = { ...lista[0], tipo: '' };
          atualizarVersao(versao.id, { itens: [itemReset] });
          UI.itemSelecionadoIdx = 0;
          renderItemTab(container);
          return;
        }
        const novaLista = lista.filter((_, i) => i !== idx);
        atualizarVersao(versao.id, { itens: novaLista });
        if (UI.itemSelecionadoIdx >= novaLista.length) UI.itemSelecionadoIdx = novaLista.length - 1;
        renderItemTab(container);
      });
    });

    // Adicionar novo item (select)
    container.querySelector('#orc-item-add')?.addEventListener('change', (e) => {
      const tipo = e.target.value;
      if (!tipo) return;
      const versao = versaoAtiva();
      if (!versao) return;
      // Felipe sessao 2026-05-10: passa versao pra novoItem herdar
      // rev/cor da porta anterior quando criar um fixo_acoplado.
      const novaLista = [...(versao.itens || []), novoItem(tipo, versao)];
      atualizarVersao(versao.id, { itens: novaLista });
      UI.itemSelecionadoIdx = novaLista.length - 1;
      renderItemTab(container);
    });

    // Botao "Voltar pro CRM": limpa sessao e navega
    container.querySelector('#orc-btn-back-crm')?.addEventListener('click', () => {
      limparLeadAtivo();
      // Reset estado UI pra forçar re-init na próxima entrada
      UI.negocioAtivoId = null;
      UI.versaoAtivaId  = null;
      UI.leadAtivo      = null;
      UI.itemSelecionadoIdx = 0;
      if (typeof App !== 'undefined' && App.navigateTo) App.navigateTo('crm');
    });

    // Felipe (sessao 2026-06): seletor de versao no banner — alterna
    // entre versoes da OPCAO atual sem precisar voltar pro CRM.
    container.querySelector('#orc-banner-versao-sel')?.addEventListener('change', (e) => {
      const novaId = e.target.value;
      if (!novaId || novaId === UI.versaoAtivaId) return;
      UI.versaoAtivaId = novaId;
      UI.itemSelecionadoIdx = 0;  // reseta selecao de item
      renderItemTab(container);
    });

    // Felipe (sessao 2026-06): botao "+ Nova Versao" — sempre presente.
    // Pergunta o modo (em-branco vs copiar) e cria.
    container.querySelector('#orc-btn-nova-versao')?.addEventListener('click', () => {
      const versao = versaoAtiva();
      if (!versao) return;
      const escolha = prompt(
        'Criar nova versao a partir da Versao ' + versao.numero + ':\n\n' +
        '  1 = Em branco (mantem so' + ' largura e altura dos itens)\n' +
        '  2 = Copia atual (duplica tudo, edita o que quiser)\n' +
        '  Cancelar = nao fazer nada\n\n' +
        'Digite 1 ou 2:'
      );
      let modo = null;
      if (escolha === '1') modo = 'em-branco';
      else if (escolha === '2') modo = 'copiar';
      else return;
      try {
        const nova = criarNovaVersao(versao.id, modo);
        if (window.showSavedDialog) {
          window.showSavedDialog('Nova Versao ' + nova.numero + ' criada (' + modo + '). Edicao liberada.');
        }
        renderItemTab(container);
      } catch (e) {
        alert('Falha ao criar nova versao: ' + e.message);
      }
    });

    bindZerarButton(container, () => renderItemTab(container));
  }

  /**
   * Felipe (sessao 2026-06): central UNICA pra decidir se uma versao
   * esta bloqueada para edicao. Conta como bloqueada se:
   *   - status === 'fechada' (versao explicitamente fechada como historico)
   *   - aprovadoEm setado (DRE foi aprovada e enviada pro CRM)
   *
   * Felipe quer que apos aprovar o DRE, a versao fique imutavel —
   * mesmo sem ter sido formalmente "fechada". Pra alterar algo,
   * tem que criar nova versao.
   */
  function versaoEhImutavel(versao) {
    if (!versao) return false;
    if (versao.status === 'fechada') return true;
    if (versao.aprovadoEm) return true;
    return false;
  }

  /**
   * Felipe (sessao 2026-06): dialog padronizado quando o usuario
   * tenta editar/zerar/recalcular numa versao bloqueada. Oferece
   * opcao de criar nova versao em 2 modos:
   *   1) Em branco — mantem so' largura/altura
   *   2) Copia atual — duplica tudo p/ ajustar pontualmente
   *
   * Retorna true se o usuario criou nova versao, false caso contrario.
   * O caller deve interromper a acao se retornar false.
   */
  function avisarVersaoBloqueadaECriarNova(versao, motivoAcao) {
    if (!versao) return false;
    const motivo = versao.aprovadoEm
      ? 'DRE aprovada — esta versao foi enviada pro CRM e ja vale como contrato.'
      : 'Esta versao esta FECHADA (imutavel) como historico.';
    const acaoMsg = motivoAcao ? `\n\nVoce tentou: ${motivoAcao}` : '';
    const escolha = prompt(
      motivo + acaoMsg + '\n\n' +
      'Pra alterar, crie nova versao:\n' +
      '  1 = Em branco (mantem so' + ' largura e altura)\n' +
      '  2 = Copia atual (duplica tudo, edita pontual)\n' +
      '  Cancelar = nao fazer nada\n\n' +
      'Digite 1 ou 2:'
    );
    if (escolha === '1') {
      try {
        criarNovaVersao(versao.id, 'em-branco');
        if (window.showSavedDialog) window.showSavedDialog('Nova versao criada (em branco). Edicao liberada.');
        return true;
      } catch (e) {
        alert('Falha ao criar nova versao: ' + e.message);
        return false;
      }
    }
    if (escolha === '2') {
      try {
        criarNovaVersao(versao.id, 'copiar');
        if (window.showSavedDialog) window.showSavedDialog('Nova versao criada (copia da atual). Edicao liberada.');
        return true;
      } catch (e) {
        alert('Falha ao criar nova versao: ' + e.message);
        return false;
      }
    }
    return false;  // cancelou
  }

  /**
   * Liga o botao Zerar a uma callback de re-render. Usado pelas duas abas
   * (Item e Custo) — cada uma passa seu proprio render como callback.
   */
  function bindZerarButton(container, reRender) {
    container.querySelector('#orc-btn-zerar')?.addEventListener('click', () => {
      // Felipe (sessao 2026-08): "BOTAO ZERAR NAO FUNCIONA CLICA EM 1
      // CONFIRMA, MAS MANTEM TODAS AS CONFIGURACOES". Antes o botao
      // Zerar em versao aprovada chamava avisarVersaoBloqueadaECriarNova,
      // que criava nova versao "em branco" preservando largura/altura/
      // nFolhas/sistema. Felipe ja' tinha pedido pra remover o sistema
      // de versoes da UI — entao o Zerar agora ZERA tudo direto, sem
      // popup de versao. Single-confirm: "Zerar TODO?" → zerarNegocioAtivo.
      if (!confirm('Limpar a tela do orcamento atual?\n\nIsso limpa os inputs visiveis. Em versao APROVADA/FECHADA, cria uma nova versao em branco preservando o historico (V1 continua intacta).\n\n(O lead no CRM nao e afetado.)')) return;
      zerarNegocioAtivo();
      reRender();
      if (window.showSavedDialog) window.showSavedDialog();
    });
  }

  function salvarItensNoBanco() {
    if (!UI.versaoAtivaId) return;
    const lista = itensDaVersao();
    try {
      atualizarVersao(UI.versaoAtivaId, { itens: lista });
    } catch (e) {
      console.warn('[orcamento] nao foi possivel salvar:', e.message);
    }
  }

  // ============================================================
  //              ABA: CUSTO FAB / INST  (alimenta a DRE)
  // ============================================================
  // Felipe (R-fluxo Calcular/Recalcular): abas que dependem de calculo
  // (Custo Fab/Inst, DRE, Lev. Perfis, Padroes de Cortes) so renderizam
  // resultados depois que o usuario aperta "Calcular" em Caracteristicas
  // do Item. Se a versao tem `calcDirty` true ou nunca foi calculada,
  // mostra placeholder com instrucao.
  /**
   * Felipe (do doc): regras pra bloquear calculos:
   *   - 'never': nunca foi calculada (ainda nao apertou Calcular)
   *   - 'dirty': editou apos ultimo calculo
   *   - 'incompleto': item(ns) sem campos obrigatorios preenchidos
   *   - 'sem_fab': aba Fab/Inst sem valores (subFab=0 e subInst=0)
   * Retorna null se ok pra renderizar.
   *
   * O parametro 'aba' pode ser 'item' (so checa never/dirty/incompleto)
   * ou 'dre' (checa tudo). Outras abas: 'fab' so' checa never/dirty.
   */
  function precisaCalcular(versao, aba) {
    aba = aba || 'item';
    // Aba CARACTERISTICAS DO ITEM: nao exibe bloqueio (e' a propria aba
    // de input). Em outras abas, primeiro checa 'never' e 'dirty'.
    if (!versao.calculadoEm) return 'never';   // nunca foi calculada
    if (versao.calcDirty)    return 'dirty';   // editou apos ultimo calculo

    // DRE: requer subtotais nao-zero E todos itens completos
    if (aba === 'dre') {
      // Item incompleto?
      if (algumItemIncompleto(versao)) return 'incompleto';
      // Subtotais zerados? (Fab e Inst nao foram preenchidos)
      const subFab = Number(versao.subFab) || 0;
      const subInst = Number(versao.subInst) || 0;
      if (subFab === 0 && subInst === 0) return 'sem_fab';
      // Felipe (sessao 2026-05): bloqueio adicional pra avancar pra DRE
      // se ha campos numericos criticos vazios/zero EM Fab/Inst que NAO
      // foram explicitamente marcados como "zerado intencional" pelo
      // usuario. Garante que a DRE nao seja calculada com furos.
      const pend = coletarPendenciasFabInst(versao);
      if (pend.length > 0) return 'pendencias_zerados';
    }
    return null;
  }

  /**
   * Felipe (sessao 2026-05): coleta campos numericos criticos do Custo
   * Fab/Inst que estao vazios ou em zero E nao estao marcados como
   * "zerado intencional" em versao._zerosIntencionais.
   *
   * Estrutura retornada:
   *   [{ chave, label, aba, valor, secao }]
   *
   *   chave: identificador unico (ex: 'fab.total_perfis') — usado pra
   *          marcar como "zerado intencional" via _zerosIntencionais
   *   label: nome amigavel pra UI
   *   aba:   id da aba pra navegar (sempre 'fab-inst' aqui)
   *   secao: 'Fabricacao' | 'Instalacao'
   */
  function coletarPendenciasFabInst(versao) {
    if (!versao) return [];
    const fab  = Object.assign({}, FAB_DEFAULT, versao.custoFab || {});
    const inst = Object.assign({}, INST_DEFAULT, versao.custoInst || {});
    const zeros = (versao._zerosIntencionais || {});

    function ehZero(v) {
      if (v === null || v === undefined) return true;
      const s = String(v).trim();
      if (s === '') return true;
      const n = Number(String(s).replace(/\./g, '').replace(',', '.'));
      return !Number.isFinite(n) || n === 0;
    }

    const pend = [];
    function checkar(chave, label, valor, secao) {
      if (!ehZero(valor)) return;
      if (zeros[chave])    return;  // marcado como intencional
      pend.push({ chave, label, aba: 'fab-inst', valor, secao });
    }

    // ---- Fabricacao (sempre exigidos) ----
    checkar('fab.n_operarios',     'Operarios',                 fab.n_operarios,     'Fabricacao');
    checkar('fab.custo_hora',      'Custo por hora',            fab.custo_hora,      'Fabricacao');
    checkar('fab.total_perfis',    'Total Perfis',              fab.total_perfis,    'Fabricacao');
    checkar('fab.total_pintura',   'Total Pintura',             fab.total_pintura,   'Fabricacao');
    checkar('fab.total_acessorios','Total Acessorios',          fab.total_acessorios,'Fabricacao');
    checkar('fab.total_extras',    'Extras (chapas/livres)',    fab.total_extras,    'Fabricacao');

    // ---- Instalacao (depende do modo) ----
    const ehTerceiros = (inst.modo === 'terceiros' || inst.modo === 'internacional');
    if (ehTerceiros) {
      checkar('inst.inst_terceiros_valor',  'Valor da instalacao',    inst.inst_terceiros_valor,  'Instalacao');
      checkar('inst.inst_terceiros_transp', 'Frete / transporte',     inst.inst_terceiros_transp, 'Instalacao');
    } else {
      // Modo Projetta — equipe propria
      checkar('inst.distancia_km',    'Distancia (km)',           inst.distancia_km,    'Instalacao');
      checkar('inst.dias_instalacao', 'Dias de instalacao',       inst.dias_instalacao, 'Instalacao');
      checkar('inst.n_pessoas',       'Quantidade de pessoas',    inst.n_pessoas,       'Instalacao');
      checkar('inst.diaria_pessoa',   'Diaria por pessoa',        inst.diaria_pessoa,   'Instalacao');
      checkar('inst.n_carros',        'Qtd de carros',            inst.n_carros,        'Instalacao');
      checkar('inst.diaria_hotel',    'Diaria de hotel',          inst.diaria_hotel,    'Instalacao');
      checkar('inst.alimentacao_dia', 'Alimentacao (R$/pax/dia)', inst.alimentacao_dia, 'Instalacao');
    }
    return pend;
  }

  /**
   * Marca um campo como "zerado intencional" — usuario confirmou que
   * o zero/vazio e' proposital. Persiste em versao._zerosIntencionais.
   */
  function marcarZeradoIntencional(versaoId, chave, marcar) {
    const r = obterVersao(versaoId);
    if (!r || !r.versao) return;
    const versao = r.versao;
    const atual = Object.assign({}, versao._zerosIntencionais || {});
    if (marcar) {
      atual[chave] = true;
    } else {
      delete atual[chave];
    }
    atualizarVersao(versaoId, { _zerosIntencionais: atual });
  }

  /**
   * Item porta_externa precisa de: largura, altura, nFolhas, modeloNumero,
   * sistema, fechaduraMecanica, cilindro, corInterna, corExterna.
   * Item porta_interna/fixo/revestimento: ainda em desenvolvimento, nao bloqueia.
   * Item sem tipo (recem-criado): conta como incompleto.
   */
  function algumItemIncompleto(versao) {
    const itens = versao.itens || [];
    if (itens.length === 0) return true;
    return itens.some(item => itemEstaIncompleto(item));
  }
  function itemEstaIncompleto(item) {
    if (!item || !item.tipo) return true;
    if (item.tipo !== 'porta_externa') return false; // outros tipos nao bloqueiam (ainda)
    const camposObr = ['largura', 'altura', 'nFolhas', 'modeloNumero',
                        'sistema', 'fechaduraMecanica', 'cilindro',
                        'corInterna', 'corExterna'];
    for (const c of camposObr) {
      const v = item[c];
      if (v === null || v === undefined) return true;
      if (String(v).trim() === '') return true;
    }
    return false;
  }
  function renderPrecisaCalcular(container, versao, motivo, nomeAba) {
    let titulo, icone, texto;
    let pendenciasHtml = '';
    if (motivo === 'dirty') {
      titulo = 'Resultados desatualizados';
      icone = '⚠';
      texto = 'Voce editou Caracteristicas do Item depois do ultimo calculo. Volte para a aba <b>Caracteristicas do Item</b> e aperte <b>↻ Recalcular</b> para atualizar os resultados aqui.';
    } else if (motivo === 'incompleto') {
      titulo = 'Item(ns) incompleto(s)';
      icone = '⚠';
      const itens = versao.itens || [];
      const incompletos = itens.filter(i => itemEstaIncompleto(i));
      const detalhes = [];
      itens.forEach((item, idx) => {
        if (!itemEstaIncompleto(item)) return;
        if (!item.tipo) {
          detalhes.push(`Item ${idx+1}: tipo nao escolhido`);
        } else if (item.tipo === 'porta_externa') {
          const faltam = ['largura', 'altura', 'nFolhas', 'modeloNumero', 'sistema',
                          'fechaduraMecanica', 'cilindro', 'corInterna', 'corExterna']
            .filter(c => {
              const v = item[c];
              return v === null || v === undefined || String(v).trim() === '';
            });
          detalhes.push(`Item ${idx+1}: faltam ${faltam.join(', ')}`);
        }
      });
      texto = `${incompletos.length} item${incompletos.length !== 1 ? 's' : ''} incompleto${incompletos.length !== 1 ? 's' : ''}. Volte pra <b>Caracteristicas do Item</b> e preencha:<ul style="margin:8px 0 0 0;padding-left:20px;text-align:left;">${detalhes.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`;
    } else if (motivo === 'sem_fab') {
      titulo = 'Custo de Fabricacao/Instalacao em zero';
      icone = '⚠';
      texto = 'A DRE precisa dos custos de Fabricacao e Instalacao pra calcular margem. Vai pra aba <b>Custo de Fabricacao e Instalacao</b> e confirme que perfis, chapas e pintura estao com valores.';
    } else if (motivo === 'pendencias_zerados') {
      // Felipe (sessao 2026-05): bloqueio fino — campos especificos do
      // Custo Fab/Inst estao em zero/vazio. Mostra cada um com a opcao
      // de "marcar como zerado intencional" (ai libera o avanco) ou
      // voltar pra Fab/Inst e preencher.
      titulo = 'Campos zerados em Fabricacao / Instalacao';
      icone = '⚠';
      const pend = coletarPendenciasFabInst(versao);
      // Agrupa por secao
      const porSecao = {};
      pend.forEach(p => {
        if (!porSecao[p.secao]) porSecao[p.secao] = [];
        porSecao[p.secao].push(p);
      });
      const blocos = Object.keys(porSecao).map(secao => {
        const linhas = porSecao[secao].map(p => `
          <li class="orc-pend-row" data-chave="${escapeHtml(p.chave)}">
            <span class="orc-pend-label">${escapeHtml(p.label)}</span>
            <span class="orc-pend-valor">vazio / 0</span>
            <button type="button" class="orc-pend-btn-zerar"
                    data-chave="${escapeHtml(p.chave)}"
                    title="Confirma que este campo deve mesmo ficar em zero — libera o avanco">
              ☑ Marcar como zerado
            </button>
          </li>
        `).join('');
        return `
          <div class="orc-pend-secao">
            <div class="orc-pend-secao-titulo">${escapeHtml(secao)}</div>
            <ul class="orc-pend-lista">${linhas}</ul>
          </div>
        `;
      }).join('');
      pendenciasHtml = `
        <div class="orc-pend-wrap">
          <p class="orc-pend-instr">
            <b>${pend.length} campo${pend.length === 1 ? '' : 's'} em zero/vazio</b>
            sem confirmacao. Para avancar para a DRE / Proposta:
          </p>
          <ul class="orc-pend-instr-passos">
            <li><b>Opcao A</b> — clique em <b>"Ir para Custo Fab/Inst"</b> e preencha os valores reais.</li>
            <li><b>Opcao B</b> — clique em <b>"Marcar como zerado"</b> ao lado de cada item se o zero for proposital. So' apos marcar TODOS o avanco e' liberado.</li>
          </ul>
          ${blocos}
        </div>
      `;
      texto = '';
    } else {
      titulo = 'Aguardando calculo';
      icone = '▶';
      texto = 'Preencha as Caracteristicas do Item e aperte <b>▶ Calcular</b> para que esta aba mostre os resultados. Os calculos so rodam apos o comando explicito.';
    }
    const tagPrincipal = (motivo === 'dirty') ? '<span class="orc-tag-dirty">⚠ desatualizado</span>'
      : (motivo === 'incompleto' || motivo === 'sem_fab' || motivo === 'pendencias_zerados') ? '<span class="orc-tag-dirty">⚠ bloqueado</span>'
      : '<span class="orc-tag-pending">aguardando calculo</span>';
    const btnDest = (motivo === 'sem_fab' || motivo === 'pendencias_zerados') ? 'fab-inst' : 'item';
    const btnLabel = (motivo === 'sem_fab' || motivo === 'pendencias_zerados') ? '→ Ir para Custo Fab/Inst' : '→ Ir para Caracteristicas do Item';
    container.innerHTML = `
      <div class="orc-banner">
        <div class="orc-banner-info">
          <span class="t-strong">${escapeHtml(nomeAba)}</span>
          ${tagPrincipal}
        </div>
      </div>
      <div class="orc-needs-calc">
        <div class="orc-needs-calc-icon">${icone}</div>
        <h3>${escapeHtml(titulo)}</h3>
        ${texto ? `<p>${texto}</p>` : ''}
        ${pendenciasHtml}
        <button type="button" class="orc-needs-calc-btn" id="orc-go-item">${escapeHtml(btnLabel)}</button>
      </div>
    `;
    container.querySelector('#orc-go-item')?.addEventListener('click', () => {
      if (window.App && App.navigateTo) App.navigateTo('orcamento', btnDest);
    });
    // Handler dos botoes "Marcar como zerado"
    container.querySelectorAll('.orc-pend-btn-zerar').forEach(btn => {
      btn.addEventListener('click', () => {
        const chave = btn.dataset.chave;
        if (!chave) return;
        marcarZeradoIntencional(versao.id, chave, true);
        // Re-renderiza a aba inteira pra recheckar pendencias e
        // possivelmente liberar (se for a ultima).
        const novoMotivo = precisaCalcular(obterVersao(versao.id).versao, 'dre');
        if (novoMotivo === 'pendencias_zerados') {
          // Ainda ha pendencias — re-render mostra lista atualizada
          renderPrecisaCalcular(container, obterVersao(versao.id).versao, novoMotivo, nomeAba);
        } else {
          // Liberado — re-renderiza a aba destino (DRE/Proposta/etc.)
          // chamando o router via App.navigateTo na MESMA aba (refresh).
          if (window.App && App.navigateTo) {
            App.navigateTo('orcamento', App.state?.currentTab || 'custo');
          }
        }
      });
    });
  }

  function renderFabInstTab(container) {
    inicializarSessao();
    const versao = obterVersao(UI.versaoAtivaId).versao;
    const motivoBloqueio = precisaCalcular(versao);
    if (motivoBloqueio) {
      return renderPrecisaCalcular(container, versao, motivoBloqueio, 'Custo de Fabricacao e Instalacao');
    }
    const negocio = obterNegocio(UI.negocioAtivoId);
    const opcao  = obterVersao(UI.versaoAtivaId).opcao;

    const fab  = Object.assign({}, FAB_DEFAULT, versao.custoFab || {});
    fab.etapas = Object.assign({}, FAB_DEFAULT.etapas, fab.etapas || {});
    const inst = Object.assign({}, INST_DEFAULT, versao.custoInst || {});

    // Felipe (sessao 2026-05): se algum campo critico de Fab/Inst esta
    // vazio/zero E a Precificacao tem valor pra ele, AUTO-PREENCHE e
    // PERSISTE na versao. Garante que versoes antigas (criadas antes
    // do cadastro de Precificacao existir) peguem os defaults atuais.
    // Se o usuario propositalmente quer 0, ele edita no input e o
    // valor explicito 0 NAO e' substituido (so' campos vazios/null).
    function _ehVazioOuZero(v) {
      if (v === null || v === undefined) return true;
      const s = String(v).trim();
      if (s === '') return true;
      const n = Number(String(s).replace(/\./g, '').replace(',', '.'));
      return !Number.isFinite(n) || n === 0;
    }
    let _autoPreenchido = false;
    try {
      if (window.Precificacao && typeof window.Precificacao.obterValores === 'function') {
        const pv = window.Precificacao.obterValores();
        // Fabricacao
        if (_ehVazioOuZero(fab.n_operarios) && pv.n_operarios) {
          fab.n_operarios = pv.n_operarios; _autoPreenchido = true;
        }
        if (_ehVazioOuZero(fab.custo_hora) && pv.custo_hora_fab) {
          fab.custo_hora = pv.custo_hora_fab; _autoPreenchido = true;
        }
        // Instalacao (so' pra modo Projetta — terceiros nao precisa)
        const ehTerceiros = (inst.modo === 'terceiros' || inst.modo === 'internacional');
        if (!ehTerceiros) {
          if (_ehVazioOuZero(inst.diaria_pessoa) && pv.diaria_pessoa) {
            inst.diaria_pessoa = pv.diaria_pessoa; _autoPreenchido = true;
          }
          if (_ehVazioOuZero(inst.alimentacao_dia) && pv.alimentacao_dia) {
            inst.alimentacao_dia = pv.alimentacao_dia; _autoPreenchido = true;
          }
          // Hotel: tenta cidade especifica, fallback no padrao
          if (_ehVazioOuZero(inst.diaria_hotel)) {
            let diariaHotel = pv.diaria_hotel;
            try {
              const lead = lerLeadAtivo();
              if (lead && lead.cidade && typeof window.Precificacao.obterDiariaHotelCidade === 'function') {
                const dh = window.Precificacao.obterDiariaHotelCidade(lead);
                if (dh) diariaHotel = dh;
              }
            } catch (e) {}
            if (diariaHotel) { inst.diaria_hotel = diariaHotel; _autoPreenchido = true; }
          }
        }
      }
    } catch (e) { /* fallback silencioso */ }
    // Persiste o auto-preenchimento na versao pra que o usuario veja
    // os valores no proximo render e o calculo use valores reais.
    if (_autoPreenchido) {
      try {
        atualizarVersao(versao.id, {
          custoFab:  Object.assign({}, versao.custoFab || {}, fab),
          custoInst: Object.assign({}, versao.custoInst || {}, inst),
        });
      } catch (e) { /* nao bloqueia render */ }
    }

    // Felipe (R-inegociavel): tudo puxa da Caracteristica do Item.
    // Auto-popula altura_porta_mm do MAIOR item (gatilho de andaime > 3m).
    // Peso bruto continua zero ate o motor de peso por item estar pronto.
    const alturasItens = (versao.itens || [])
      .map(it => Number(it.altura) || 0)
      .filter(v => v > 0);
    if (alturasItens.length > 0) {
      inst.altura_porta_mm = Math.max(...alturasItens);
    }
    // Peso bruto: por enquanto soma 0 (calculo nao implementado).
    // Quando o motor de peso por item estiver pronto, somar aqui.
    inst.peso_bruto_kg = Number(inst.peso_bruto_kg) || 0;

    // Auto-popula perfis e pintura usando resultado direto do calculo
    try {
      // Felipe (sessao 09): SEMPRE recalcula perfis e pintura.
      // Antes: só sobrescrevia se vazio. Resultado: mudava item
      // e o custo ficava travado no primeiro cálculo.
      {
        const itensCalc = (versao.itens || []);
        if (itensCalc.length > 0) {
          const rPerfis = recalcularPerfisESalvarNoFab(versao, itensCalc);
          if (rPerfis && rPerfis.result) {
            const cp = Math.round((rPerfis.result.custoPerfis  || 0) * 100) / 100;
            const ct = Math.round((rPerfis.result.custoPintura || 0) * 100) / 100;
            if (cp > 0) fab.total_perfis = cp;
            if (ct > 0) fab.total_pintura = ct;
          }
        }
      }
    } catch (e) { console.warn('[Custo Fab/Inst] auto-perfis/pintura falhou:', e); }

    // Felipe (sessao 2026-08): "CUSTO ACESSORIO ZERADO SENDO JA TEMOS
    // CUSTO EM LEVANTAMENTO DE ACESSORIOS". Auto-popula total_acessorios
    // somando o resultado do motor AcessoriosPortaExterna pra todos os
    // itens porta_externa da versao. So' sobrescreve se o campo estiver
    // vazio/zero (preserva edicao manual do usuario).
    //
    // Felipe (sessao 2026-08 REVISAO): "MUDEI TIREI A PHILIPS 9300
    // RECALCULEI, SAIU DE ACESSORIOS MAS CONTINUA EM CUSTO FABRICACAO".
    // 2 BUGS combinados:
    //   1. O bloco inteiro era pulado se total_acessorios ja tinha valor
    //      (preservacao de edicao manual). Logo total_fechadura_digital
    //      tambem nao atualizava.
    //   2. 'if (totalDigital > 0) fab.total_fechadura_digital = totalDigital'
    //      so' sobrescrevia quando havia fechadura. Se Felipe removia,
    //      totalDigital=0 e o valor antigo permanecia.
    // Fix: SEMPRE roda o calculo e SEMPRE atualiza total_fechadura_digital
    // (refletir estado atual da fechadura). total_acessorios continua
    // sobrescrevendo so' se vazio (preserva edicao manual).
    try {
      if (window.AcessoriosPortaExterna) {
        const cadAcess = Storage.scope('cadastros').get('acessorios_lista') || [];
        // Felipe (sessao 2026-09): cadastro de perfis pra calcular peso
        // da folha (necessario pra escolher pivo 350 vs 600 kg).
        const perfisCad = (typeof construirCadastroPerfis === 'function')
          ? construirCadastroPerfis() : {};
        let totalAcess = 0;
        let totalDigital = 0;
        (versao.itens || []).forEach(item => {
          // Felipe sessao 31: filtro alinhado com o motor 28-acessorios-porta-
          // externa.js, que ja' processa porta_interna, fixo_acoplado,
          // revestimento_parede e pergolado. Antes filtrava SO' porta_externa
          // -> acessorios da porta interna (fechadura+macaneta+dobradicas)
          // nao iam pro campo Acessorios do Custo Fab/Inst.
          if (!item) return;
          const tipoOK = item.tipo === 'porta_externa'
                      || item.tipo === 'porta_interna'
                      || item.tipo === 'fixo_acoplado'
                      || item.tipo === 'revestimento_parede'
                      || item.tipo === 'pergolado';
          if (!tipoOK) return;
          let pesoFolhaTotal = 0;
          let pesoFolhaPerfis = 0;
          let pesoFolhaChapas = 0;
          try {
            const r = calcularPesoFolhaItem(item, perfisCad) || {};
            pesoFolhaTotal  = r.peso || 0;
            pesoFolhaPerfis = (r.detalhe && r.detalhe.perfis) || 0;
            pesoFolhaChapas = (r.detalhe && r.detalhe.chapas) || 0;
          } catch (_) {}
          const linhas = window.AcessoriosPortaExterna.calcularAcessoriosPorItem(
            item, cadAcess, { pesoFolhaTotal, pesoFolhaPerfis, pesoFolhaChapas }
          );
          // Felipe (sessao 30): "acessorios esta puxando um valor nada
          // haver Custo de Fabricacao acessorios e o somatorio total
          // dos acessorios. separar fechadura digital do resto".
          // Felipe (sessao 2026-08): 'fechadura digital independente se e
          // tedee keso emteco qualquer uma'. Fix: checar digital PRIMEIRO
          // (vai sempre pro totalDigital, qualquer aplicacao), depois
          // filtrar 'fab' pro resto. Mesma logica do Lev. Acessorios.
          linhas.forEach(l => {
            // 1) Fechadura Digital sempre vai pro campo proprio,
            //    INDEPENDENTE da aplicacao (qualquer marca: Tedee,
            //    Emteco, Philips, Nuki, etc).
            if (String(l.categoria || '').toLowerCase().includes('fechadura digital')) {
              totalDigital += Number(l.total) || 0;
              return;
            }
            // 2) Felipe (sessao 09): TODOS os acessorios (fab + obra)
            //    entram no campo Acessorios. Antes so' 'fab' entrava
            //    e 'obra' (R$ 983) ficava perdido sem somar em nada.
            totalAcess += Number(l.total) || 0;
          });
        });

        // Felipe (sessao 09): atualiza total_acessorios APENAS se motor
        // retornou valor > 0. Se motor retorna 0 (ex: cadastros nao carregados),
        // PRESERVA valor existente pra nao destruir dados.
        if (totalAcess > 0) {
          fab.total_acessorios = totalAcess;
        }
        // Fechadura digital: atualiza se motor retornou algo OU se havia valor
        // e agora e 0 (usuario removeu a fechadura). Mas só se cadastros carregados.
        const valorDigitalAntigo = Number(fab.total_fechadura_digital) || 0;
        const cadCarregado = cadAcess && cadAcess.length > 0;
        if (cadCarregado && Math.abs(valorDigitalAntigo - totalDigital) > 0.01) {
          fab.total_fechadura_digital = totalDigital > 0 ? totalDigital : '';
        }
        // Persiste custoFab + recalcula subFab
        {
          const rFab = calcularFab(fab, versao.itens);
          atualizarVersao(versao.id, {
            custoFab: Object.assign({}, versao.custoFab || {}, fab),
            subFab: rFab.total,
          });
        }
      }
    } catch (e) {
      console.warn('[Custo Fab/Inst] auto-acessorios falhou:', e);
    }

    const rFab  = calcularFab(fab, versao.itens);
    const rInst = calcularInst(inst);

    // Felipe (do doc): TODO relatorio tem cabecalho padronizado.
    const leadFi = lerLeadAtivo() || {};
    const numDocFi = `${(opcao?.letra || 'A')} - ${versao.numero}`;
    const headerFiHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
      ? window.Empresa.montarHeaderRelatorio({
          lead: leadFi,
          tituloRelatorio: 'Custo de Fabricacao e Instalacao',
          numeroDocumento: numDocFi,
          validade: 15,
        })
      : '';

    container.innerHTML = `
      ${headerFiHtml}
      ${bannerCaracteristicasItens(versao)}
      <div class="orc-banner">
        <div class="orc-banner-info">
          <span class="t-strong">Custo Fab/Inst</span>
          · ${escapeHtml(negocio?.clienteNome || '—')}
          · Opcao ${escapeHtml(opcao.letra)} V${versao.numero}
        </div>
        <div class="orc-banner-actions">
          <button type="button" class="univ-btn-save" id="orc-btn-salvar-fi">✓ Tudo salvo</button>
          <button class="orc-btn-zerar" id="orc-btn-zerar" title="Limpa os inputs da tela e cria nova versao em branco preservando o historico.">🧹 Limpar Tela</button>
        </div>
      </div>

      <!-- ========== FABRICACAO ========== -->
      <div class="orc-section-card">
        <div class="orc-section-title">Custo Horas de Fabricacao e Materia Prima</div>

        <div class="orc-fi-fab-config">
          <div class="orc-field orc-fi-w-money">
            <label>Perfis (R$)</label>
            <input type="text" data-field="total_perfis" data-fab="1" value="${escapeHtml(fmtBROrEmpty(fab.total_perfis))}" />
            <span class="orc-fi-help">vira auto do Lev. Perfis</span>
          </div>
          <div class="orc-field orc-fi-w-money">
            <label>Pintura (R$)</label>
            <input type="text" data-field="total_pintura" data-fab="1" value="${escapeHtml(fmtBROrEmpty(fab.total_pintura))}" />
            <span class="orc-fi-help">vira auto do Lev. Perfis</span>
          </div>
          <div class="orc-field orc-fi-w-money">
            <label>Acessorios (R$)</label>
            <input type="text" data-field="total_acessorios" data-fab="1" value="${escapeHtml(fmtBROrEmpty(fab.total_acessorios))}" />
            <span class="orc-fi-help">vira auto do Lev. Acessorios</span>
          </div>
          <!-- Felipe (sessao 31): fechadura digital separada dos acessorios -->
          <div class="orc-field orc-fi-w-money">
            <label>Fechadura Digital (R$)</label>
            <input type="text" data-field="total_fechadura_digital" data-fab="1" value="${escapeHtml(fmtBROrEmpty(fab.total_fechadura_digital))}" />
            <span class="orc-fi-help">auto do Lev. Acessorios (digital)</span>
          </div>
          <!-- Felipe (sessao 2026-05): novo campo Revestimento, entre
               Acessorios e Extras. Manual ou automatico (futuro: vira
               auto quando o motor de chapas estiver pronto). -->
          <div class="orc-field orc-fi-w-money">
            <label>Revestimento (R$)</label>
            <input type="text" data-field="total_revestimento" data-fab="1" value="${escapeHtml(fmtBROrEmpty(fab.total_revestimento))}" />
            <span class="orc-fi-help">chapas / superficies (auto futuro)</span>
          </div>
          <div class="orc-field orc-fi-w-money">
            <label>Extras (R$)</label>
            <input type="text" data-field="total_extras" data-fab="1" value="${escapeHtml(fmtBROrEmpty(fab.total_extras))}" />
            <span class="orc-fi-help">livres / outros (manual)</span>
          </div>
          <div class="orc-field orc-fi-w-money">
            <label>Soma insumos</label>
            <input type="text" value="${escapeHtml(fmtBROrEmpty(rFab.total_insumos))}" disabled data-no-empty-marker="1" />
            <span class="orc-fi-help">perfis + pintura + acess. + fech.digital + revest. + extras</span>
          </div>
        </div>

        <div class="orc-fi-fab-config">
          <div class="orc-field orc-fi-w-num">
            <label>Operarios</label>
            <input type="text" data-field="n_operarios" data-fab="1" value="${escapeHtml(fab.n_operarios === '' || fab.n_operarios === null || fab.n_operarios === undefined ? '' : String(fab.n_operarios))}" />
          </div>
          <div class="orc-field orc-fi-w-money">
            <label>Custo por hora (R$/h)</label>
            <input type="text" data-field="custo_hora" data-fab="1" value="${escapeHtml(fmtBROrEmpty(fab.custo_hora))}" />
          </div>
        </div>

        <!-- Felipe (do doc - msg "volte os itens que tinha, era so para
             manter campo vazio nao deletear"): tabela de etapas COM
             campos vazios — Portal, Folha da porta, Colagem, Corte e
             Usinagem, Conferencia e Embalagem. Usuario preenche horas. -->
        <!-- Felipe (sessao 28): "QUANDO TENHO MULTI ITENS COLOQUE AO LADO
             Custo de Fabricacao OUTRA COLUNA POIS CADA ITEM TEM SEU TEMPO
             E DEPOIS SOMA TODAS AS HORAS". Tabela agora tem 1 coluna por
             item + coluna Total. Cada celula salva em
             etapas[id].horasPorItem[idx]. Se ha um unico item, mostra so' 1
             coluna (compat). -->
        ${(() => {
          const itensFab = (versao.itens || []).filter(i => i && i.tipo === 'porta_externa');
          const nItens = itensFab.length;
          // Cabecalho dinamico — uma coluna por item
          const colunasItens = nItens > 0
            ? itensFab.map((it, idx) => {
                const dim = (it.largura && it.altura) ? `${it.largura}×${it.altura}` : `Item ${idx + 1}`;
                return `<span class="orc-fi-col-item-h" title="Item ${idx + 1}: ${escapeHtml(dim)}">It ${idx + 1}<small style="display:block;font-weight:400;font-size:10px;opacity:0.7;">${escapeHtml(dim)}</small></span>`;
              }).join('')
            : '<span class="orc-fi-col-horas">Horas (editavel)</span>';
          // Mostra coluna Total so' se ha 2+ itens
          const colunaTotal = nItens >= 2
            ? '<span class="orc-fi-col-total-h">Total</span>'
            : '';
          return `
            <div class="orc-fi-etapas">
              <div class="orc-fi-etapa-head">
                <span class="orc-fi-col-etapa">Etapa</span>
                ${colunasItens}
                ${colunaTotal}
              </div>
              ${ETAPAS_FAB.map(et => {
                const ent = (fab.etapas && fab.etapas[et.id]) || {};
                const horasManual = ent.horasOverride;
                const porItem = ent.horasPorItem || {};
                const detalheEtapa = (rFab.detalhes || []).find(d => d.id === et.id) || {};

                // Felipe sessao 2026-08: pra etapa 'Corte e Usinagem' mostra
                // quantas chapas de revestimento (ACM/HPL/etc) serao usadas
                // ao lado do label, ajudando Felipe a decidir as horas.
                //
                // FONTE PRIMARIA: versao.chapasSelecionadas (dados reais do
                // Lev. Superficies — Felipe seleciona as chapas la e o
                // sistema grava {numChapas, custoTotal, etc}).
                // FALLBACK: item.qtdChapas (campo manual antigo).
                // Se ambos vazios, mostra dica pra preencher.
                let labelExtra = '';
                if (et.id === 'corte_usinagem' && nItens > 0) {
                  let totalCh = 0;
                  let detalheTxt = '';

                  // Tenta primeiro chapasSelecionadas (dado real do Lev. Sup)
                  const sel = (versao && versao.chapasSelecionadas) || {};

                  // Felipe sessao 13: 'saiu 9 chapas, corrige por favor'.
                  // Bug: chapasSelecionadas podia ter COres ORFAS — cores
                  // selecionadas no Lev. Superficies em algum momento, mas
                  // que nao tem mais peca atualmente (ex: usuario mudou
                  // cor de 'Branco F00' pra 'Branco F00f00' — a entrada
                  // antiga ficava no objeto somando chapas indevidamente).
                  // Solucao: usa pecasPorCor (recalculado das pecas atuais)
                  // como fonte da verdade — so' soma cores que TEM peca
                  // viva agora.
                  let coresAtivas;
                  try {
                    const pecasPorCorAtual = coletarPecasPorCor(versao.itens || []);
                    coresAtivas = Object.keys(pecasPorCorAtual || {});
                  } catch (_) {
                    coresAtivas = Object.keys(sel);
                  }

                  if (coresAtivas.length > 0) {
                    const partes = [];
                    coresAtivas.forEach(cor => {
                      const dado = sel[cor];
                      const n = dado ? Number(dado.numChapas) || 0 : 0;
                      if (n > 0) {
                        totalCh += n;
                        const corCurta = String(cor).split('-')[0].trim().substring(0, 12);
                        partes.push(`${corCurta}:${n}`);
                      }
                    });
                    if (partes.length > 1) detalheTxt = ' (' + partes.join(' · ') + ')';
                  }

                  // Fallback: item.qtdChapas
                  if (totalCh === 0) {
                    const chapasArr = itensFab.map(it => Number(it.qtdChapas) || 0);
                    totalCh = chapasArr.reduce((a, b) => a + b, 0);
                    if (totalCh > 0 && nItens > 1) {
                      detalheTxt = ' (' + chapasArr.map((n, i) => `It${i + 1}:${n}`).join(' · ') + ')';
                    }
                  }

                  if (totalCh > 0) {
                    labelExtra = `<small style="display:block;font-weight:600;font-size:11px;color:#c46b20;margin-top:4px;letter-spacing:0.02em;">📐 ${totalCh} chapa${totalCh !== 1 ? 's' : ''} de revestimento${detalheTxt}</small>`;
                  } else {
                    // Nenhum item tem qtd preenchida e nenhuma chapa selecionada
                    labelExtra = `<small style="display:block;font-weight:500;font-size:10px;color:#9a3412;margin-top:4px;font-style:italic;">📐 selecione chapas no Lev. Superficies</small>`;
                  }
                }

                // Inputs por item
                let inputsPorItem;
                let totalEtapa = 0;
                if (nItens > 0) {
                  inputsPorItem = itensFab.map((it, idx) => {
                    // Valor da celula: prefer horasPorItem[idx], senao
                    // horasOverride (so' pro primeiro item — pra Felipe ver o
                    // valor antigo migrado), senao vazio.
                    let val = porItem[String(idx)];
                    if ((val == null || val === '') && idx === 0
                        && horasManual != null && horasManual !== ''
                        && Object.keys(porItem).length === 0) {
                      val = horasManual;
                    }
                    const valStr = (val != null && val !== '') ? String(val) : '';
                    if (valStr !== '' && Number.isFinite(Number(valStr))) {
                      totalEtapa += Number(valStr);
                    }
                    return `<span class="orc-fi-col-item-h">
                      <input type="text" data-fab-etapa="${et.id}" data-fab-sub="horas-item" data-item-idx="${idx}" value="${escapeHtml(valStr)}" placeholder="" title="Aceita expressao: 9+5, 8*2, 10-3. Vazio = zero horas." />
                    </span>`;
                  }).join('');
                } else {
                  // Sem itens — fallback pro input antigo
                  const valorInput = (horasManual !== null && horasManual !== undefined && horasManual !== '') ? String(horasManual) : '';
                  inputsPorItem = `<span class="orc-fi-col-horas">
                    <input type="text" data-field="etapa_${et.id}_horas" data-fab-etapa="${et.id}" data-fab-sub="horas" value="${escapeHtml(valorInput)}" placeholder="" title="Aceita expressao: 9+5, 8*2, 10-3. Vazio = zero horas." />
                  </span>`;
                  totalEtapa = Number(valorInput) || 0;
                }
                const totalCol = nItens >= 2
                  ? `<span class="orc-fi-col-total-h"><b>${totalEtapa || ''}</b></span>`
                  : '';
                return `
                  <div class="orc-fi-etapa-row">
                    <span class="orc-fi-col-etapa">${escapeHtml(et.label)}${labelExtra}</span>
                    ${inputsPorItem}
                    ${totalCol}
                  </div>
                `;
              }).join('')}
              <!-- Felipe (sessao 2026-05): linha de TOTAL DE HORAS visivel,
                   somando todas as etapas × n_operarios. Antes so' aparecia
                   dentro do label "Subtotal horas (X h × R$ Y)". -->
              <div class="orc-fi-etapa-row orc-fi-etapa-total">
                <span class="orc-fi-col-etapa"><span class="t-strong">Total de horas</span></span>
                ${nItens > 0 ? itensFab.map((_, idx) => {
                  // Soma vertical: soma de horasPorItem[idx] em todas as etapas
                  let totalItem = 0;
                  ETAPAS_FAB.forEach(et => {
                    const ent2 = (fab.etapas && fab.etapas[et.id]) || {};
                    const v = (ent2.horasPorItem || {})[String(idx)];
                    if (v != null && v !== '') totalItem += Number(v) || 0;
                    else if (idx === 0 && Object.keys(ent2.horasPorItem || {}).length === 0
                             && ent2.horasOverride != null && ent2.horasOverride !== '') {
                      totalItem += Number(ent2.horasOverride) || 0;
                    }
                  });
                  return `<span class="orc-fi-col-item-h"><span class="t-strong">${totalItem || ''}</span></span>`;
                }).join('') : `<span class="orc-fi-col-horas orc-fi-total-horas-valor"><span class="t-strong">${rFab.total_horas} h</span></span>`}
                ${nItens >= 2 ? `<span class="orc-fi-col-total-h orc-fi-total-horas-valor"><span class="t-strong">${rFab.total_horas} h</span></span>` : ''}
              </div>
            </div>
          `;
        })()}

        <!-- Felipe (do doc - msg totais): formato simplificado
             Subtotal horas (X h × R$ Y) → A
             Custo Fabricacao → B
             Total → A + B -->
        <div class="orc-fi-totais">
          <div class="orc-fi-total-row">
            <span class="orc-fi-total-label">Subtotal horas (${rFab.total_horas} h × R$ ${fmtBR(rFab.custo_hora)})</span>
            <span class="orc-fi-total-valor">R$ ${fmtBR(rFab.subtotal_horas)}</span>
          </div>
          <div class="orc-fi-total-row">
            <span class="orc-fi-total-label">Custo Fabricacao</span>
            <span class="orc-fi-total-valor">R$ ${fmtBR(rFab.total_insumos)}</span>
          </div>
          <div class="orc-fi-total-row orc-fi-total-final">
            <span class="orc-fi-total-label">Total</span>
            <span class="orc-fi-total-valor">R$ ${fmtBR(rFab.total)}</span>
          </div>
        </div>
      </div>

      <!-- Felipe (sessao 2026-06): "fabricacao vai ter que ser separado
           portanto vai ter que ter fabricacao item 1, item 2, item 3 etc,
           para jogar esse custo neste item, somente instalacao que vai
           ser junto". Tabela mostra a distribuicao do custo de Fabricacao
           por item — proporcional as horas calculadas pra cada um. -->
      <!-- Felipe (sessao 2026-07): "CUSTOS FABRICACAO AINDA NAO
           ALTEROU POR ITEM CONTINUA 1 SO" — antes a tabela so'
           aparecia se ha 2+ itens. Agora sempre aparece, mesmo com
           1 item, pra Felipe ver o custo de fabricacao + instalacao
           + preco final daquele item. -->
      ${(versao.itens && versao.itens.length >= 1) ? (() => {
        const params = Object.assign({}, PARAMS_DEFAULT, versao.parametros || {});
        const vp = calcularValoresProposta(versao, params);
        if (!vp.porItem.length) return '';
        const subFabSum = vp.porItem.reduce((s, x) => s + x.subFab, 0);
        const linhas = vp.porItem.map(v => {
          const it = v.item || {};
          const desc = (typeof obterDescricaoItem === 'function')
            ? obterDescricaoItem(it)
            : 'Item';
          const med = `${parseBR(it.largura) || it.largura || ''} × ${parseBR(it.altura) || it.altura || ''}`;
          const pctFab = subFabSum > 0 ? (v.subFab / subFabSum * 100) : 0;
          return `
            <tr>
              <td class="num">${String(v.idx + 1).padStart(2, '0')}</td>
              <td>${escapeHtml(desc)}</td>
              <td>${escapeHtml(med)}</td>
              <td class="num">${v.qtd}</td>
              <td class="num">R$ ${fmtBR(v.subFab)}</td>
              <td class="num">${fmtBR(pctFab)} %</td>
              <td class="num">R$ ${fmtBR(v.subInst)}</td>
              <td class="num"><b>R$ ${fmtBR(v.precoFinal)}</b></td>
            </tr>`;
        }).join('');
        return `
          <div class="orc-section-card">
            <div class="orc-section-title">Distribuicao por Item</div>
            <p class="orc-helptext">
              Custo de <b>Fabricacao</b> distribuido proporcional as horas de cada item.
              Custo de <b>Instalacao</b> dividido proporcional ao subFab de cada item
              (item maior = mais participacao no frete/montagem).
              Preco Final ja' aplica o markup do DRE — esses valores aparecem
              na proposta comercial em "Valor (un.)" e "Valor Total".
            </p>
            <div class="orc-fi-distrib-wrap">
              <table class="orc-fi-distrib-tabela">
                <thead>
                  <tr>
                    <th class="num">Item</th>
                    <th>Descricao</th>
                    <th>Medidas</th>
                    <th class="num">Qtd</th>
                    <th class="num">Custo Fab</th>
                    <th class="num">% Fab</th>
                    <th class="num">Custo Inst</th>
                    <th class="num">Preco Final (pTab)</th>
                  </tr>
                </thead>
                <tbody>${linhas}</tbody>
                <tfoot>
                  <tr class="orc-fi-distrib-total">
                    <td colspan="4"><b>Total</b></td>
                    <td class="num"><b>R$ ${fmtBR(subFabSum)}</b></td>
                    <td class="num">100,00 %</td>
                    <td class="num"><b>R$ ${fmtBR(vp.porItem.reduce((s, x) => s + x.subInst, 0))}</b></td>
                    <td class="num"><b>R$ ${fmtBR(vp.totalGeral)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        `;
      })() : ''}

      <!-- ========== Felipe sessao 31: CUSTOS INTERNACIONAIS ========== 
           So' aparece se o lead esta marcado como destino=Internacional.
           Mostra caixa fumigada + frete terrestre + frete maritimo em R$ + USD. -->
      ${(() => {
        const lead = lerLeadAtivo();
        if (!lead || lead.destinoTipo !== 'internacional') return '';
        const taxa = (window.Cambio && window.Cambio.taxaAtual()) || 0;
        const a = Number(lead.caixaAltura) || 0;
        const e = Number(lead.caixaEspessura) || 0;
        const c = Number(lead.caixaComprimento) || 0;
        const m3 = (a * e * c) / 1e9;
        const caixaUsd = (window.FreteTarifas ? window.FreteTarifas.calcularCaixa(m3) : m3 * 100);
        const terrUsd  = Number(lead.freteTerrestreUsd) || 0;
        const marUsd   = Number(lead.freteMaritimoUsd)  || 0;
        const totalUsd = caixaUsd + terrUsd + marUsd;
        const fmtUsd = v => 'USD ' + v.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
        const fmtBRL = v => taxa > 0 ? 'R$ ' + (v * taxa).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '—';
        const incoterm = lead.freteIncoterm || 'FOB';
        const modal    = lead.freteModal    || 'LCL';
        const regiao   = lead.freteRegiao   || '—';
        return `
          <div class="orc-section-card" style="background:#eff8ff; border:1px solid #b8dbff;">
            <div class="orc-section-title" style="color:#0c5485;">🚢 Custos Internacionais</div>
            <p class="orc-helptext">
              Origem: <b>Uberlandia / Brasil</b> · Destino: <b>${escapeHtml(lead.destinoPais || '—')}</b> ·
              Incoterm <b>${escapeHtml(incoterm)}</b> · Modal <b>${escapeHtml(modal)}</b>
              ${modal === 'FCL' ? '· Container <b>' + escapeHtml(lead.freteContainer || '40HC') + '</b>' : ''}
              ${taxa > 0 ? '· Taxa USD ' + taxa.toFixed(4) : '· Taxa USD nao configurada'}
            </p>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:8px;">
              <div style="background:#fff; border:1px solid #cfd8e3; border-radius:6px; padding:10px;">
                <div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">📦 Caixa Fumigada</div>
                <div style="font-size:11px; color:#666;">Vol: ${m3.toFixed(3)} m³</div>
                <div style="font-size:15px; font-weight:700; color:#0c5485; margin-top:4px;">${fmtUsd(caixaUsd)}</div>
                <div style="font-size:12px; color:#155724;">${fmtBRL(caixaUsd)}</div>
              </div>
              <div style="background:#fff; border:1px solid #cfd8e3; border-radius:6px; padding:10px;">
                <div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">🚛 Frete Terrestre</div>
                <div style="font-size:11px; color:#666;">Uberlandia → Santos</div>
                <div style="font-size:15px; font-weight:700; color:#0c5485; margin-top:4px;">${fmtUsd(terrUsd)}</div>
                <div style="font-size:12px; color:#155724;">${fmtBRL(terrUsd)}</div>
              </div>
              <div style="background:#fff; border:1px solid #cfd8e3; border-radius:6px; padding:10px;">
                <div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">🚢 Frete Maritimo ${modal}</div>
                <div style="font-size:11px; color:#666;">${escapeHtml(regiao)}</div>
                <div style="font-size:15px; font-weight:700; color:#0c5485; margin-top:4px;">${fmtUsd(marUsd)}</div>
                <div style="font-size:12px; color:#155724;">${fmtBRL(marUsd)}</div>
              </div>
            </div>
            <div style="margin-top:10px; padding:10px 12px; background:#0c5485; color:#fff; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:13px; font-weight:600;">TOTAL CUSTOS INTERNACIONAIS</span>
              <span style="font-size:16px; font-weight:700;">${fmtUsd(totalUsd)} ${taxa > 0 ? ' · ' + fmtBRL(totalUsd) : ''}</span>
            </div>
            <p class="orc-helptext" style="margin-top:8px;">
              Valores editaveis no card do lead (CRM). Estes custos entram no DRE conforme o
              incoterm escolhido: EXW = nada · FOB = caixa + terrestre · CIF/CIP = +maritimo +seguro · DAP/DDP = entrega no destino.
            </p>
          </div>
        `;
      })()}

      <!-- ========== INSTALACAO — 10 regras ========== -->
      <div class="orc-section-card">
        <div class="orc-fi-inst-header">
          <div class="orc-section-title">Custo Instalacao</div>
          <div class="orc-fi-modo-toggle">
            <label class="${inst.modo === 'projetta' ? 'is-ativo' : ''}">
              <input type="radio" name="inst-modo" data-field="modo" data-inst="1" value="projetta" ${inst.modo === 'projetta' ? 'checked' : ''} />
              Projetta
            </label>
            <label class="${inst.modo === 'terceiros' ? 'is-ativo' : ''}">
              <input type="radio" name="inst-modo" data-field="modo" data-inst="1" value="terceiros" ${inst.modo === 'terceiros' ? 'checked' : ''} />
              Terceiros
            </label>
            <!-- Felipe (do doc - msg frete/inst): novo modo "Projetta Internacional".
                 Funciona igual ao Terceiros (valores manuais de instalacao + frete) -->
            <label class="${inst.modo === 'internacional' ? 'is-ativo' : ''}">
              <input type="radio" name="inst-modo" data-field="modo" data-inst="1" value="internacional" ${inst.modo === 'internacional' ? 'checked' : ''} />
              Projetta Internacional
            </label>
          </div>
        </div>

        ${(inst.modo === 'terceiros' || inst.modo === 'internacional') ? `
          <p class="orc-helptext">${inst.modo === 'internacional' ? 'Modo Projetta Internacional: equipe deslocada para o exterior — valores manuais de instalacao e frete.' : 'Modo terceiros: subcontratado faz a instalacao. Apenas dois valores manuais; componentes individuais ficam como "—".'}</p>
          <div class="orc-fi-inst-grid">
            <div class="orc-field orc-fi-w-money">
              <label>Valor da instalacao (R$)</label>
              <input type="text" data-field="inst_terceiros_valor" data-inst="1" value="${escapeHtml(fmtBROrEmpty(inst.inst_terceiros_valor))}" />
            </div>
            <div class="orc-field orc-fi-w-money">
              <label>Frete / transporte (R$)</label>
              <input type="text" data-field="inst_terceiros_transp" data-inst="1" value="${escapeHtml(fmtBROrEmpty(inst.inst_terceiros_transp))}" />
            </div>
          </div>
          ${inst.modo === 'internacional' ? `
            <!-- Felipe sessao 31: links rapidos pra cotar passagens (Decolar) e hotel (Booking).
                 Felipe preenche os 2 campos acima manualmente apos cotar nos sites. -->
            <div class="orc-fi-inst-links" style="margin-top:10px; padding:10px 12px; background:#f0f7ff; border:1px solid #cfe2ff; border-radius:6px;">
              <div style="font-size:11px; font-weight:600; color:#0c5485; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
                🌐 Cotar custos da viagem
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <a href="https://www.decolar.com/passagens-aereas" target="_blank" rel="noopener"
                   style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:#fff; border:1px solid #cfe2ff; border-radius:6px; color:#0c5485; text-decoration:none; font-size:12px; font-weight:500; transition:all 0.2s;"
                   onmouseover="this.style.background='#0c5485'; this.style.color='#fff';"
                   onmouseout="this.style.background='#fff'; this.style.color='#0c5485';">
                  ✈️ Decolar &middot; Passagens aereas
                </a>
                <a href="https://www.booking.com" target="_blank" rel="noopener"
                   style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:#fff; border:1px solid #cfe2ff; border-radius:6px; color:#0c5485; text-decoration:none; font-size:12px; font-weight:500; transition:all 0.2s;"
                   onmouseover="this.style.background='#003580'; this.style.color='#fff';"
                   onmouseout="this.style.background='#fff'; this.style.color='#0c5485';">
                  🏨 Booking &middot; Hoteis
                </a>
                <a href="https://www.google.com/flights" target="_blank" rel="noopener"
                   style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:#fff; border:1px solid #cfe2ff; border-radius:6px; color:#0c5485; text-decoration:none; font-size:12px; font-weight:500; transition:all 0.2s;"
                   onmouseover="this.style.background='#1a73e8'; this.style.color='#fff';"
                   onmouseout="this.style.background='#fff'; this.style.color='#0c5485';">
                  🔎 Google Flights
                </a>
              </div>
              <div style="font-size:10px; color:#5a7a99; margin-top:6px;">
                Depois de cotar nos sites, preencha os valores acima manualmente.
              </div>
            </div>
          ` : ''}
        ` : `
          <p class="orc-helptext">Equipe propria. Componentes calculados automaticamente; preenchimento manual apenas onde indicado.</p>

          <!-- Bloco: dados da rota (Distancia se mantem por orcamento) -->
          <div class="orc-fi-inst-grid">
            <div class="orc-field orc-fi-w-num">
              <label>Distancia (km)</label>
              <div style="display:flex; gap:6px; align-items:center;">
                <input type="text" data-field="distancia_km" data-inst="1" value="${escapeHtml(fmtBROrEmpty(inst.distancia_km))}" style="flex:0 0 100px;" />
                <button type="button" id="orc-btn-calc-cep" class="univ-btn-export" style="padding:6px 10px; font-size:11px;" title="Calcula rota de carro pela API OSRM (OpenStreetMap)">📍 CEP</button>
              </div>
              <span class="orc-fi-help" id="orc-cep-status">virá auto pelo CEP do lead</span>
            </div>
          </div>

          <!-- Felipe (R-inegociavel): tudo puxa da Caracteristica do Item.
               Lista vertical empilhada — uma "ficha" por item com Largura,
               Altura e Peso. Largura/Altura ja existem; Peso virá quando
               o calculo de peso bruto por item estiver pronto. -->
          <div class="orc-fi-itens">
            <div class="orc-fi-itens-titulo">Dimensoes dos Itens <span class="orc-fi-help">auto · Caracteristica do Item</span></div>
            ${(versao.itens || []).length === 0 ? `
              <div class="orc-fi-item-vazio">Nenhum item cadastrado nesta versao.</div>
            ` : (versao.itens || []).map((item, idx) => {
              const tipo = labelTipo(item.tipo) || 'Item';
              const lar = Number(item.largura) || 0;
              const alt = Number(item.altura)  || 0;
              const qtd = Number(item.quantidade) || 1;
              return `
                <div class="orc-fi-item-card">
                  <div class="orc-fi-item-titulo">Item ${idx + 1} — ${escapeHtml(tipo)}</div>
                  <div class="orc-fi-item-row">
                    <span class="orc-fi-item-lbl">Largura</span>
                    <span class="orc-fi-item-val">${lar > 0 ? lar + ' mm' : '—'}</span>
                  </div>
                  <div class="orc-fi-item-row">
                    <span class="orc-fi-item-lbl">Altura</span>
                    <span class="orc-fi-item-val">${alt > 0 ? alt + ' mm' : '—'}</span>
                  </div>
                  <div class="orc-fi-item-row">
                    <span class="orc-fi-item-lbl">Peso bruto</span>
                    <span class="orc-fi-item-val orc-fi-item-pendente">— <span class="orc-fi-help">aguardando calculo</span></span>
                  </div>
                  <div class="orc-fi-item-row">
                    <span class="orc-fi-item-lbl">Quantidade</span>
                    <span class="orc-fi-item-val">${qtd}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          ${rInst.andaime > 0 ? `
            <div class="orc-fi-alerta orc-fi-alerta-info">
              <span class="t-strong">Andaime incluido — R$ 550,00.</span>
              Porta com altura acima de 3,0 m — custo de andaime adicionado automaticamente ao custo de instalacao.
            </div>
          ` : ''}

          ${rInst.munk_alerta ? `
            <div class="orc-fi-alerta orc-fi-alerta-warn">
              <span class="t-strong">Atencao: peso bruto acima de 500 kg.</span>
              Avalie a necessidade de munk / caminhao guindaste — informe o valor manualmente abaixo.
            </div>
          ` : ''}

          <!-- Bloco: dias -->
          <div class="orc-fi-bloco">
            <div class="orc-fi-bloco-label">Deslocamento (calculado pelo km)</div>
            <div class="orc-fi-bloco-valor">${rInst.deslocamentoDias} dias</div>
          </div>
          <div class="orc-fi-bloco-sub">
            <span>Override manual:</span>
            <input type="text" data-field="desl_override" data-inst="1" value="${inst.desl_override === null || inst.desl_override === undefined ? '' : escapeHtml(String(inst.desl_override))}" placeholder="auto" />
            <span class="orc-fi-help">deixe vazio = automatico pelo km</span>
          </div>

          <div class="orc-fi-inst-grid">
            <div class="orc-field orc-fi-w-num">
              <label>Dias de instalacao</label>
              <input type="text" data-field="dias_instalacao" data-inst="1" value="${((inst.dias_instalacao) === '' || (inst.dias_instalacao) === null || (inst.dias_instalacao) === undefined || Number(inst.dias_instalacao) === 0) ? '' : escapeHtml(String(inst.dias_instalacao))}" />
              <span class="orc-fi-help">somente dias de trabalho no local</span>
            </div>
          </div>

          <div class="orc-fi-bloco orc-fi-bloco-destaque">
            <div class="orc-fi-bloco-label">Total dias</div>
            <div class="orc-fi-bloco-detalhe">deslocamento + instalacao</div>
            <div class="orc-fi-bloco-valor">${rInst.diasTotal} dias</div>
          </div>

          <!-- Bloco: equipe e custos -->
          <div class="orc-fi-inst-grid">
            <div class="orc-field orc-fi-w-num">
              <label>Quantidade de pessoas</label>
              <input type="text" data-field="n_pessoas" data-inst="1" value="${((inst.n_pessoas) === '' || (inst.n_pessoas) === null || (inst.n_pessoas) === undefined || Number(inst.n_pessoas) === 0) ? '' : escapeHtml(String(inst.n_pessoas))}" />
            </div>
            <div class="orc-field orc-fi-w-money">
              <label>Diaria por pessoa (R$)</label>
              <input type="text" data-field="diaria_pessoa" data-inst="1" value="${escapeHtml(fmtBROrEmpty(inst.diaria_pessoa))}" />
            </div>
            <div class="orc-field orc-fi-w-num">
              <label>Qtd de carros</label>
              <!-- Felipe sessao 13: 'quantidade de carro deve 1 automatico'.
                   Diferente do dias_instalacao (que mostra vazio quando 0
                   pra Felipe preencher), o n_carros sempre tem que mostrar
                   pelo menos 1. Fallback no display: se vazio/null/0, exibe 1. -->
              <input type="text" data-field="n_carros" data-inst="1" value="${(() => {
                const n = Number(inst.n_carros);
                return Number.isFinite(n) && n >= 1 ? escapeHtml(String(inst.n_carros)) : '1';
              })()}" />
            </div>
            <div class="orc-field orc-fi-w-money">
              <label>Valor diaria hotel (R$)</label>
              <input type="text" data-field="diaria_hotel" data-inst="1" value="${escapeHtml(fmtBROrEmpty(inst.diaria_hotel))}" />
            </div>
            <div class="orc-field orc-fi-w-money">
              <label>Alimentacao (R$/pax/dia)</label>
              <input type="text" data-field="alimentacao_dia" data-inst="1" value="${escapeHtml(fmtBROrEmpty(inst.alimentacao_dia))}" />
            </div>
            <div class="orc-field orc-fi-w-money">
              <label>Munk / caminhao (R$)</label>
              <input type="text" data-field="munk_caminhao" data-inst="1" value="${escapeHtml(fmtBROrEmpty(inst.munk_caminhao))}" />
              <span class="orc-fi-help">manual; nao soma sozinho</span>
            </div>
            <div class="orc-field orc-fi-w-money">
              <label>Pedagio (ida + volta)</label>
              <input type="text" data-field="pedagio_manual" data-inst="1" value="${inst.pedagio_manual === null || inst.pedagio_manual === undefined ? '' : escapeHtml(fmtBR(inst.pedagio_manual))}" placeholder="auto" />
              <span class="orc-fi-help">deixe vazio = estimativa automatica</span>
            </div>
          </div>

          <div class="orc-fi-bloco orc-fi-bloco-info">
            <span class="t-strong">Hotel:</span> ${rInst.quartos} quarto${rInst.quartos > 1 ? 's' : ''} × ${rInst.noites} noite${rInst.noites !== 1 ? 's' : ''} × R$ ${fmtBR(Number(inst.diaria_hotel) || 0)} / noite
          </div>
        `}

        <!-- Resumo da instalacao -->
        <div class="orc-fi-resumo">
          <div class="orc-fi-resumo-titulo">Resumo Instalacao</div>
          ${(() => {
            const linha = (label, valor) => {
              const v = (valor === null || valor === undefined)
                ? '<span class="orc-fi-traco">—</span>'
                : `R$ ${fmtBR(Number(valor) || 0)}`;
              return `<div class="orc-fi-resumo-row"><span>${label}</span><span>${v}</span></div>`;
            };
            const linhas = [];
            const ehManual = (inst.modo === 'terceiros' || inst.modo === 'internacional');
            const labelModo = inst.modo === 'internacional' ? 'Projetta Internacional' : 'Terceiros';
            if (ehManual) {
              linhas.push(linha('Salarios da equipe', null));
              linhas.push(linha('Combustivel (diesel)', null));
              linhas.push(linha('Hotel', null));
              linhas.push(linha('Alimentacao', null));
              linhas.push(linha('Andaime', null));
              linhas.push(linha('Munk / caminhao', null));
              linhas.push(linha('Pedagio', null));
              linhas.push(linha(`Instalacao (${labelModo}) — valor`, rInst.inst_terceiros_valor));
              linhas.push(linha(`Frete / transporte (${labelModo})`, rInst.inst_terceiros_transp));
            } else {
              linhas.push(`<div class="orc-fi-resumo-row"><span>Total dias</span><span>${rInst.diasTotal} dia${rInst.diasTotal !== 1 ? 's' : ''}</span></div>`);
              linhas.push(linha(`Salarios da equipe (${rInst.diasTotal} d × ${Number(inst.n_pessoas) || 0} p × R$ ${fmtBR(Number(inst.diaria_pessoa) || 0)})`, rInst.salarios));
              linhas.push(linha(`Diesel ((km + 50) × 0,875 × 2 × ${Number(inst.n_carros) || 0} carro${Number(inst.n_carros) === 1 ? '' : 's'})`, rInst.diesel));
              linhas.push(linha(`Hotel (${rInst.noites} noite${rInst.noites !== 1 ? 's' : ''} × R$ ${fmtBR(Number(inst.diaria_hotel) || 0)} × ${rInst.quartos} quarto${rInst.quartos !== 1 ? 's' : ''})`, rInst.hotel));
              linhas.push(linha(`Alimentacao (${rInst.diasTotal} d × ${Number(inst.n_pessoas) || 0} p × R$ ${fmtBR(Number(inst.alimentacao_dia) || 0)})`, rInst.alimentacao));
              linhas.push(linha('Andaime (auto — altura > 3 m)', rInst.andaime));
              linhas.push(linha('Munk / caminhao', rInst.munk));
              linhas.push(linha('Pedagio (ida + volta)', rInst.pedagio));
            }
            return linhas.join('');
          })()}
          <div class="orc-fi-resumo-row orc-fi-total-final">
            <span>Total Instalacao</span>
            <span>R$ ${fmtBR(rInst.total)}</span>
          </div>
        </div>
      </div>

      <!-- ========== TOTAIS QUE VAO PRA DRE ========== -->
      <div class="orc-section-card orc-conferencia">
        <div class="orc-section-title">Totais que alimentam a DRE</div>
        <div class="orc-conf-resumo">
          <div class="orc-conf-resumo-bloco orc-conf-destaque">
            <div class="orc-conf-resumo-label">subFab</div>
            <div class="orc-conf-resumo-valor">R$ ${fmtBR(rFab.total)}</div>
            <div class="orc-conf-resumo-detalhe">soma do card Fabricacao</div>
          </div>
          <div class="orc-conf-resumo-bloco orc-conf-destaque">
            <div class="orc-conf-resumo-label">subInst</div>
            <div class="orc-conf-resumo-valor">R$ ${fmtBR(rInst.total)}</div>
            <div class="orc-conf-resumo-detalhe">soma do card Instalacao</div>
          </div>
          <div class="orc-conf-resumo-bloco">
            <div class="orc-conf-resumo-label">Total bruto (antes overhead)</div>
            <div class="orc-conf-resumo-valor">R$ ${fmtBR(rFab.total + rInst.total)}</div>
            <div class="orc-conf-resumo-detalhe">subFab + subInst</div>
          </div>
        </div>
      </div>
    `;

    bindFabInstEvents(container);
    // Felipe (do doc - msg wizard): "Proximo: DRE"
    adicionarBotaoWizard(container, 'fab-inst');
  }

  function bindFabInstEvents(container) {
    bindZerarButton(container, () => renderFabInstTab(container));

    container.querySelector('#orc-btn-salvar-fi')?.addEventListener('click', () => {
      if (window.showSavedDialog) window.showSavedDialog();
    });

    // Botao "Calcular pelo CEP" — geocoda ambos CEPs (ViaCEP) e roteia (OSRM)
    container.querySelector('#orc-btn-calc-cep')?.addEventListener('click', async () => {
      const status = container.querySelector('#orc-cep-status');
      const inputDist = container.querySelector('input[data-field="distancia_km"]');
      if (!inputDist || !status) return;

      // Origem fixa: Av. Sicupiras 51, Uberlandia/MG (CEP 38401-708)
      const ORIG_LAT = -18.918628;
      const ORIG_LNG = -48.276695;

      const lead = lerLeadAtivo();
      if (!lead) { status.textContent = '✗ Sem lead ativo'; status.className = 'orc-fi-help orc-fi-help-error'; return; }

      const cepDest = (lead.cep || '').replace(/\D/g, '');
      const cidade  = (lead.cidade || '').trim();
      const uf      = (lead.estado || '').trim();
      if (!cepDest && !(cidade && uf)) {
        status.textContent = '✗ Lead sem CEP nem Cidade/UF';
        status.className = 'orc-fi-help orc-fi-help-error';
        return;
      }

      status.textContent = 'Geocodificando destino...';
      status.className = 'orc-fi-help';
      try {
        // (1) Geocodifica destino via Nominatim (OpenStreetMap, gratis sem auth).
        // Tenta CEP primeiro; se falhar, usa "cidade, UF, Brasil".
        let destLat, destLng;
        const queryNominatim = async (q) => {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=br&limit=1`;
          const r = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
          if (!r.ok) return null;
          const data = await r.json();
          if (!data.length) return null;
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        };

        if (cepDest) {
          const c = await queryNominatim(cepDest + ', Brasil');
          if (c) { destLat = c.lat; destLng = c.lng; }
        }
        if (destLat == null && cidade && uf) {
          const c = await queryNominatim(`${cidade}, ${uf}, Brasil`);
          if (c) { destLat = c.lat; destLng = c.lng; }
        }
        if (destLat == null) {
          status.textContent = '✗ Endereco nao localizado';
          status.className = 'orc-fi-help orc-fi-help-error';
          return;
        }

        status.textContent = 'Calculando rota OSRM...';
        // (2) OSRM publico: rota de carro real, retorna distancia em metros.
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${ORIG_LNG},${ORIG_LAT};${destLng},${destLat}?overview=false`;
        const rRoute = await fetch(osrmUrl);
        if (!rRoute.ok) throw new Error('OSRM indisponivel');
        const rd = await rRoute.json();
        if (!rd.routes || !rd.routes.length) throw new Error('Sem rota');
        const distMetros = rd.routes[0].distance;
        // Arredonda 50 em 50 km (regra do Felipe)
        const km = Math.ceil(distMetros / 1000 / 50) * 50;

        // Persiste no inst.distancia_km e re-renderiza (atualiza dias/Total)
        const v = obterVersao(UI.versaoAtivaId);
        if (!v || !v.versao) return;
        const inst = Object.assign({}, INST_DEFAULT, v.versao.custoInst || {});
        inst.distancia_km = km;
        atualizarVersao(UI.versaoAtivaId, { custoInst: inst });
        renderFabInstTab(container);
        const newStatus = container.querySelector('#orc-cep-status');
        if (newStatus) {
          newStatus.textContent = `✓ ${km} km (rota OSRM, arredondado 50 km)`;
          newStatus.className = 'orc-fi-help orc-fi-help-ok';
        }
      } catch (err) {
        status.textContent = '✗ ' + (err.message || 'erro');
        status.className = 'orc-fi-help orc-fi-help-error';
      }
    });

    // Toda mudanca: 1 load so, modifica, salva, sincroniza com DRE.
    // Felipe (sessao 31 fix): selector inclui [data-fab-etapa] porque
    // os inputs de horas-por-item NAO tem data-field (so data-fab-etapa).
    // Sem isso, a calculadora (parseBRExpr) nao dispara neles.
    container.querySelectorAll('[data-field], [data-fab-etapa]').forEach(el => {
      el.addEventListener('change', () => {
        const r = obterVersao(UI.versaoAtivaId);
        if (!r || !r.versao) return;
        const versao = r.versao;
        if (versao.status === 'fechada') return;

        const field = el.dataset.field;
        const fab = Object.assign({}, FAB_DEFAULT, versao.custoFab || {});
        fab.etapas = Object.assign({}, FAB_DEFAULT.etapas, fab.etapas || {});
        const inst = Object.assign({}, INST_DEFAULT, versao.custoInst || {});

        if (el.dataset.fabEtapa) {
          // input de etapa: pode ser 'dias', 'horas' (override global) ou
          // 'horas-item' (por item, Felipe sessao 28).
          const eid = el.dataset.fabEtapa;
          const sub = el.dataset.fabSub || 'dias';
          const ent = fab.etapas[eid] || {};
          if (sub === 'dias') {
            ent.dias = parseBR(el.value) || 0;
            // Quando user mexe em dias, limpa o override de horas
            // (volta a calcular auto). Felipe quer aviso quando user MUDA
            // horas manualmente, nao quando muda dias.
            delete ent.horasOverride;
          } else if (sub === 'horas') {
            const raw = String(el.value || '').trim();
            const auto = (Number(ent.dias) || 0) * HORAS_POR_DIA;
            // Felipe (do doc): aceita expressao simples ('9+5' = 14)
            const num = parseBRExpr(raw);
            // Se vazio ou igual ao auto, limpa o override (volta pro automatico)
            if (raw === '' || num === auto) {
              delete ent.horasOverride;
            } else {
              ent.horasOverride = num;
              // Reescreve o valor do input com o resultado da expressao
              // (ex: "9+5" → "14") pra Felipe ver o calculado
              if (/[+\-*/]/.test(raw.replace(/^-/, '')) && num > 0) {
                el.value = String(num).replace('.', ',');
              }
            }
          } else if (sub === 'horas-item') {
            // Felipe (sessao 28): horas POR ITEM. Salva em horasPorItem[idx].
            // Limpa horasOverride global (incompativel com por-item) na
            // primeira edicao por item.
            const idx = String(el.dataset.itemIdx || '0');
            const raw = String(el.value || '').trim();
            const num = parseBRExpr(raw);
            if (!ent.horasPorItem) ent.horasPorItem = {};
            if (raw === '') {
              delete ent.horasPorItem[idx];
            } else {
              ent.horasPorItem[idx] = num;
              // Reescreve expressao calculada
              if (/[+\-*/]/.test(raw.replace(/^-/, '')) && num > 0) {
                el.value = String(num).replace('.', ',');
              }
            }
            // Quando comeca a usar por-item, limpa horasOverride global
            // (evita ambiguidade — calcularFab da preferencia ao por-item
            // mas eh melhor remover pra ficar limpo).
            if (Object.keys(ent.horasPorItem).length > 0) {
              delete ent.horasOverride;
            }
          }
          fab.etapas[eid] = ent;
        } else if (el.dataset.fab) {
          fab[field] = parseBR(el.value) || 0;
        } else if (el.dataset.inst) {
          if (el.type === 'checkbox') {
            inst[field] = el.checked;
          } else if (el.type === 'radio') {
            // toggle modo projetta/terceiros
            if (el.checked) inst[field] = el.value;
          } else if (field === 'desl_override' || field === 'pedagio_manual') {
            // campo "auto se vazio": null = automatico, numero = override manual
            const raw = String(el.value || '').trim();
            inst[field] = raw === '' ? null : (parseBR(raw) || 0);
          } else {
            inst[field] = parseBR(el.value) || 0;
          }
        }

        // Recalcula e salva subFab/subInst direto na versao (alimenta a DRE)
        const rFab  = calcularFab(fab, versao.itens);
        const rInst = calcularInst(inst);
        try {
          atualizarVersao(versao.id, {
            custoFab: fab,
            custoInst: inst,
            subFab: rFab.total,
            subInst: rInst.total,
          });
        } catch (e) {
          console.warn('[orcamento] erro ao salvar fab/inst:', e.message);
        }
        renderFabInstTab(container);
      });
    });
  }

  // ============================================================
  //                      ABA: CUSTO E MARGEM
  // ============================================================
  /**
   * Helper: recalcula subFab/subInst a partir de custoFab/custoInst e
   * persiste se os valores mudaram. Garante que DRE, Aprovacao, Proposta
   * e Relatorios usem SEMPRE os mesmos valores (BUG FIX sessao 2026-05-06).
   *
   * NAO roda motores (perfis/acessorios) — esses so rodam na aba
   * Custo Fab/Inst. Se rodassem aqui com cadastros nao carregados,
   * zerariam os valores reais (BUG CRITICO historico).
   */
  function _sincronizarSubFabInst(versao) {
    try {
      const fabDre  = Object.assign({}, FAB_DEFAULT, versao.custoFab  || {});
      fabDre.etapas = Object.assign({}, FAB_DEFAULT.etapas, fabDre.etapas || {});
      const instDre = Object.assign({}, INST_DEFAULT, versao.custoInst || {});
      // Auto-popula altura pra andaime
      const alturasDre = (versao.itens || [])
        .map(it => Number(it.altura) || 0).filter(v => v > 0);
      if (alturasDre.length > 0) instDre.altura_porta_mm = Math.max(...alturasDre);
      // Recalcula subFab/subInst SEM rodar motores
      const rFabDre  = calcularFab(fabDre, versao.itens);
      const rInstDre = calcularInst(instDre);
      const newSubFab  = rFabDre.total;
      const newSubInst = rInstDre.total;
      const mudouFab  = Math.abs(newSubFab  - (Number(versao.subFab)  || 0)) > 0.005;
      const mudouInst = Math.abs(newSubInst - (Number(versao.subInst) || 0)) > 0.005;
      versao.subFab  = newSubFab;
      versao.subInst = newSubInst;
      if ((mudouFab || mudouInst) && versao.status !== 'fechada') {
        try {
          const dadosPersist = {};
          if (mudouFab)  dadosPersist.subFab  = newSubFab;
          if (mudouInst) dadosPersist.subInst = newSubInst;
          atualizarVersao(versao.id, dadosPersist);
        } catch(ePersist) { console.warn('[sync] persist subFab/subInst:', ePersist); }
      }
    } catch(e) { console.warn('[sync] recalc subFab/subInst:', e); }
  }

  function renderCustoTab(container) {
    inicializarSessao();
    const versao = obterVersao(UI.versaoAtivaId).versao;
    // Felipe (do doc): DRE so calcula se item esta completo E Fab/Inst
    // tem valores de perfis/chapas/pintura. Modo 'dre' valida ambos.
    const motivoBloqueio = precisaCalcular(versao, 'dre');
    if (motivoBloqueio) {
      return renderPrecisaCalcular(container, versao, motivoBloqueio, 'DRE');
    }
    // Felipe (sessao 09): DRE so RECALCULA subFab/subInst do custoFab
    // existente. NAO roda motores (perfis/acessorios) — esses so rodam
    // na aba Custo Fab/Inst. Se rodassem aqui com cadastros nao carregados,
    // zerariam os valores reais (BUG CRITICO que destruiu dados).
    _sincronizarSubFabInst(versao);

    const negocio = obterNegocio(UI.negocioAtivoId);
    const opcao  = obterVersao(UI.versaoAtivaId).opcao;
    const subFab = Number(versao.subFab) || 0;
    const subInst = Number(versao.subInst) || 0;
    const params = Object.assign({}, PARAMS_DEFAULT, versao.parametros || {});

    // Lookup representante ANTES de calcular DRE
    let repInfoDre = null;
    try {
      const lead = lerLeadAtivo();
      const fup = lead && (lead.representante_followup || '');
      if (fup) {
        const reps = (window.Representantes && typeof window.Representantes.listar === 'function')
          ? window.Representantes.listar() : [];
        const rep = reps.find(re => String(re.followup || '').trim() === fup);
        if (rep) {
          repInfoDre = {
            nome: rep.razao_social || fup,
            classificacao: rep.classificacao || 'Representante',
            comissaoMaximaPct: ((Number(rep.comissao_maxima) || 0) * 100),
          };
        } else if (fup === 'PROJETTA') {
          repInfoDre = { nome: 'PROJETTA (venda interna)', classificacao: 'Projetta', comissaoMaximaPct: 0 };
        }
      }
    } catch (e) {
      console.warn('[DRE] lookup do representante falhou:', e);
    }

    // Auto-aplica comissao do representante se campo nao editado.
    // Felipe sessao 12: filosofia last-write-wins do cadastro. Antes era
    // restrito a (default OR vazio), o que travava casos onde o rep mudou
    // e o com_rep ja tinha valor != default. Agora SEMPRE aplica quando o
    // user nao editou manualmente, independente do valor atual.
    if (repInfoDre && repInfoDre.comissaoMaximaPct > 0) {
      const paramsSalvos = versao.parametros || {};
      const editouManual = !!paramsSalvos._com_rep_manual;
      const valorAtual   = paramsSalvos.com_rep;
      const precisaAtualizar = (
        !editouManual &&
        Number(valorAtual) !== Number(repInfoDre.comissaoMaximaPct)
      );
      if (precisaAtualizar) {
        params.com_rep = repInfoDre.comissaoMaximaPct;
        atualizarVersao(versao.id, { parametros: Object.assign({}, paramsSalvos, { com_rep: repInfoDre.comissaoMaximaPct }) });
      }
    }

    // Felipe sessao 12: auto-deriva markup_desc e desconto a partir de
    // com_rt no render (regra: 20 - com_rt). Antes so disparava no handler
    // de edicao do com_rt - se o orcamento ja vinha com defaults
    // dessincronizados (com_rt=5, markup=20, desconto=20), nunca corrigia.
    // Respeita override manual via flags _markup_desc_manual / _desconto_manual.
    {
      const paramsSalvos = versao.parametros || {};
      const rtVal = Number(params.com_rt) || 0;
      const auto = 20 - rtVal;
      const editouMarkup   = !!paramsSalvos._markup_desc_manual;
      const editouDesconto = !!paramsSalvos._desconto_manual;
      const updates = Object.assign({}, paramsSalvos);
      let mudou = false;
      if (!editouMarkup && Number(params.markup_desc) !== auto) {
        params.markup_desc = auto; updates.markup_desc = auto; mudou = true;
      }
      if (!editouDesconto && Number(params.desconto) !== auto) {
        params.desconto = auto; updates.desconto = auto; mudou = true;
      }
      if (mudou) atualizarVersao(versao.id, { parametros: updates });
    }

    const r = calcularDRE(subFab, subInst, params);

    const fmtPct = (frac) => fmtBR((frac || 0) * 100) + ' %';
    const fmtN3  = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

    // Felipe (do doc): TODO relatorio tem cabecalho padronizado.
    const leadDre = lerLeadAtivo() || {};
    const numDocDre = `${(opcao?.letra || 'A')} - ${versao.numero}`;
    const headerDreHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
      ? window.Empresa.montarHeaderRelatorio({
          lead: leadDre,
          tituloRelatorio: 'DRE — Custo e Margem',
          numeroDocumento: numDocDre,
          validade: 15,
        })
      : '';

    container.innerHTML = `
      ${headerDreHtml}
      ${bannerCaracteristicasItens(versao)}
      <div class="orc-banner">
        <div class="orc-banner-info">
          <span class="t-strong">Custo e Margem</span>
          · ${escapeHtml(negocio?.clienteNome || '—')}
          · Opcao ${escapeHtml(opcao.letra)} V${versao.numero}
        </div>
        <div class="orc-banner-actions">
          <button type="button" class="univ-btn-save" id="orc-btn-salvar-custo">✓ Tudo salvo</button>
          <!-- Felipe (sessao 2026-08): "RETIRE ESSA VERSOES DO CALCULO" —
               botao "Salvar como Versao N e Congelar" removido. Versoes
               vao ser repensadas do zero. -->
          <button class="orc-btn-zerar" id="orc-btn-zerar" title="Limpa os inputs da tela e cria nova versao em branco preservando o historico.">🧹 Limpar Tela</button>
        </div>
      </div>

      ${repInfoDre ? `
      <div class="orc-rep-banner ${repInfoDre.classificacao.toLowerCase() === 'showroom' ? 'is-showroom' : ''}">
        <span class="orc-rep-banner-label">Representante deste lead:</span>
        <span class="orc-rep-banner-nome">${escapeHtml(repInfoDre.nome)}</span>
        <span class="orc-rep-banner-class">${escapeHtml(repInfoDre.classificacao)}</span>
        <span class="orc-rep-banner-com">comissao maxima ${fmtBR(repInfoDre.comissaoMaximaPct)}%</span>
        <button type="button" class="orc-rep-banner-btn" id="orc-btn-aplicar-comissao" title="Aplica a comissao maxima do representante no campo Comissao Rep">↓ Aplicar no campo Comissao Rep</button>
      </div>
      ` : ''}

      <div class="orc-section-card">
        <div class="orc-section-title">Subtotais (vindos da aba Custo Fab/Inst)</div>
        <p class="orc-helptext">Edite os valores na aba <span class="t-strong">Custo Fab/Inst</span>. A DRE le esses totais automaticamente.</p>
        <div class="orc-form-row">
          <div class="orc-field orc-f-money">
            <label>Custo Fabricacao (R$)</label>
            <input type="text" value="${escapeHtml(fmtBROrEmpty(subFab))}" disabled />
          </div>
          <div class="orc-field orc-f-money">
            <label>Custo Instalacao (R$)</label>
            <input type="text" value="${escapeHtml(fmtBROrEmpty(subInst))}" disabled />
          </div>
        </div>
      </div>

      <div class="orc-section-card">
        <div class="orc-section-title" style="display:flex; align-items:center; justify-content:space-between;">
          <span>Parametros (% sobre o preco)</span>
          ${(() => {
            const lead = lerLeadAtivo();
            if (!lead || lead.destinoTipo !== 'internacional') return '';
            // So' mostra o botao se os params atuais NAO sao os internacionais
            const ehInternacional =
              Number(params.impostos)    === 0 &&
              Number(params.com_rep)     === 0 &&
              Number(params.com_rt)      === 0 &&
              Number(params.com_gest)    === 0 &&
              Number(params.markup_desc) === 0 &&
              Number(params.desconto)    === 0 &&
              Number(params.lucro_alvo)  === 45;
            return ehInternacional
              ? `<span style="font-size:11px; color:#0c5485; background:#eff8ff; padding:4px 10px; border-radius:4px; font-weight:600;">🌍 INTERNACIONAL — defaults aplicados</span>`
              : `<button type="button" id="orc-dre-aplicar-intl" style="font-size:11px; color:#fff; background:#0c5485; border:none; padding:6px 12px; border-radius:5px; cursor:pointer; font-weight:600;">🌍 Aplicar defaults Internacional</button>`;
          })()}
        </div>
        <div class="orc-form-row">
          <div class="orc-field orc-f-pct">
            <label>Overhead</label>
            <input type="text" data-field="overhead" data-param="1" value="${escapeHtml(fmtBROrEmpty(params.overhead))}" />
            <span class="orc-field-hint">rateio fixo (0-30 %)</span>
          </div>
          <div class="orc-field orc-f-pct">
            <label>Impostos</label>
            <input type="text" data-field="impostos" data-param="1" value="${escapeHtml(fmtBROrEmpty(params.impostos))}" />
            <span class="orc-field-hint">PIS+COFINS+ISS+ICMS</span>
          </div>
          <div class="orc-field orc-f-pct">
            <label>Comissao Rep</label>
            <input type="text" data-field="com_rep" data-param="1" value="${escapeHtml(fmtBROrEmpty(params.com_rep))}" />
            <span class="orc-field-hint">representante (0-20 %)</span>
          </div>
          <div class="orc-field orc-f-pct">
            <label>Comissao RT</label>
            <input type="text" data-field="com_rt" data-param="1" value="${escapeHtml(fmtBROrEmpty(params.com_rt))}" />
            <span class="orc-field-hint">RT/arquiteto (0-15 %)</span>
          </div>
        </div>
        <div class="orc-form-row" style="margin-top:14px;">
          <div class="orc-field orc-f-pct">
            <label>Comissao Gest</label>
            <input type="text" data-field="com_gest" data-param="1" value="${escapeHtml(fmtBROrEmpty(params.com_gest))}" />
            <span class="orc-field-hint">gestao interna</span>
          </div>
          <div class="orc-field orc-f-pct">
            <label>Lucro Alvo</label>
            <!-- Felipe sessao 12: 'liberar para margem casas decimais
                 livres tbm'. Lucro Alvo agora mostra ate 4 casas decimais
                 (15,4271 etc) - precisao necessaria pra Ajustar Margem
                 acertar exato o Valor Final Desejado. fmtBROrEmpty padrao
                 cortaria em 2 casas. -->
            <input type="text" data-field="lucro_alvo" data-param="1" data-precisao="4"
                   value="${escapeHtml(((params.lucro_alvo === '' || params.lucro_alvo == null || Number(params.lucro_alvo) === 0)
                     ? ''
                     : Number(params.lucro_alvo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })))}" />
            <span class="orc-field-hint">liquido pos IRPJ+CSLL · ate 4 decimais</span>
          </div>
          <div class="orc-field orc-f-pct">
            <label>Markup Desc</label>
            <input type="text" data-field="markup_desc" data-param="1" value="${escapeHtml(fmtBROrEmpty(params.markup_desc))}" />
            <span class="orc-field-hint">auto: 20 − RT (${params.com_rt || 0}) = ${20 - (Number(params.com_rt) || 0)}%</span>
          </div>
          <div class="orc-field orc-f-pct">
            <label>Desconto</label>
            <input type="text" data-field="desconto" data-param="1" value="${escapeHtml(fmtBROrEmpty(params.desconto))}" />
            <span class="orc-field-hint">auto: 20 − RT (${params.com_rt || 0}) = ${20 - (Number(params.com_rt) || 0)}%</span>
          </div>
        </div>
          <div class="orc-field orc-f-pct">
            <label>IRPJ + CSLL</label>
            <input type="text" value="34,00" disabled />
            <span class="orc-field-hint">constante (34 %)</span>
          </div>
        </div>
      </div>

      <div class="orc-section-card orc-resultado">
        <div class="orc-section-title">Resultado DRE</div>
        <div class="orc-dre">
          <div class="orc-dre-row is-custo">
            <span class="orc-dre-label">Custo total</span>
            <span class="orc-dre-formula">(subFab + subInst) × (1 + overhead)</span>
            <span class="orc-dre-valor">R$ ${fmtBR(r.custo)}</span>
          </div>
          <div class="orc-dre-row">
            <span class="orc-dre-label">Lucro bruto necessario (LBN)</span>
            <span class="orc-dre-formula">lucro_alvo / (1 − 0,34)</span>
            <span class="orc-dre-valor">${fmtPct(r.lbn)}</span>
          </div>
          <div class="orc-dre-row">
            <span class="orc-dre-label">Total % sobre preco (td)</span>
            <span class="orc-dre-formula">impostos + com_rep + com_rt + com_gest + lbn</span>
            <span class="orc-dre-valor">${fmtPct(r.td)}</span>
          </div>
          <div class="orc-dre-row">
            <span class="orc-dre-label">Fator faturamento (fF)</span>
            <span class="orc-dre-formula">1 / (1 − td)</span>
            <span class="orc-dre-valor">${fmtN3(r.fF)}</span>
          </div>
          <div class="orc-dre-row">
            <span class="orc-dre-label">Fator tabela (fT)</span>
            <span class="orc-dre-formula">fF / (1 − markup_desc)</span>
            <span class="orc-dre-valor">${fmtN3(r.fT)}</span>
          </div>
          <div class="orc-dre-divisor"></div>
          <div class="orc-dre-row orc-dre-destaque is-receita is-subtotal">
            <span class="orc-dre-label">Com Desconto</span>
            <span class="orc-dre-formula">custo × fF</span>
            <span class="orc-dre-valor">R$ ${fmtBR(r.pFat)}</span>
          </div>
          <div class="orc-dre-row orc-dre-destaque is-receita is-subtotal">
            <span class="orc-dre-label">Original</span>
            <span class="orc-dre-formula">custo × fT</span>
            <span class="orc-dre-valor">R$ ${fmtBR(r.pTab)}</span>
          </div>
          <div class="orc-dre-row orc-dre-destaque is-receita is-total">
            <span class="orc-dre-label">Preco real (apos desconto)</span>
            <span class="orc-dre-formula">pTab × (1 − desconto)</span>
            <span class="orc-dre-valor">R$ ${fmtBR(r.pFatReal)}</span>
          </div>
          <div class="orc-dre-row">
            <span class="orc-dre-label">Markup visual</span>
            <span class="orc-dre-formula">(pTab / custo − 1) × 100</span>
            <span class="orc-dre-valor">${fmtBR(r.markupPct)} %</span>
          </div>
        </div>
      </div>

      <div class="orc-section-card orc-conferencia">
        <div class="orc-section-title">Conferencia — Custo e Preco Final</div>
        <div class="orc-conf-resumo">
          <div class="orc-conf-resumo-bloco">
            <div class="orc-conf-resumo-label">Custo total</div>
            <div class="orc-conf-resumo-valor">R$ ${fmtBR(r.custo)}</div>
            <div class="orc-conf-resumo-detalhe">subFab + subInst + overhead</div>
          </div>
          <div class="orc-conf-resumo-bloco orc-conf-destaque">
            <div class="orc-conf-resumo-label">Preco da Proposta</div>
            <div class="orc-conf-resumo-valor">R$ ${fmtBR(r.pTab)}</div>
            <div class="orc-conf-resumo-detalhe">preco de tabela (pTab)</div>
          </div>
          <div class="orc-conf-resumo-bloco orc-conf-destaque">
            <div class="orc-conf-resumo-label">Cliente Paga</div>
            <div class="orc-conf-resumo-valor">R$ ${fmtBR(r.pFatReal)}</div>
            <div class="orc-conf-resumo-detalhe">apos ${fmtBR(params.desconto)} % de desconto</div>
          </div>
        </div>

        <!-- Felipe sessao 31: bloco INTERNACIONAL no DRE detalhado.
             Detalha quais custos entram no preco final conforme o INCOTERM. -->
        ${(() => {
          const lead = lerLeadAtivo();
          if (!lead || lead.destinoTipo !== 'internacional') return '';
          const taxa = (window.Cambio && window.Cambio.taxaAtual()) || 0;
          if (!taxa) {
            return `
              <div class="orc-section" style="margin-top:18px; padding:14px; background:#fff3cd; border:1px solid #ffc107; border-radius:8px;">
                <div style="font-weight:700; color:#856404; font-size:13px;">⚠️ Internacional sem taxa USD</div>
                <p style="font-size:12px; color:#856404; margin:8px 0 0 0;">Cadastre a taxa USD em Config → Cambio pra ver o desdobramento internacional.</p>
              </div>
            `;
          }
          const incoterm = lead.freteIncoterm || 'FOB';
          const itc = window.Incoterms ? window.Incoterms.byCodigo(incoterm) : null;
          if (!itc) return '';

          const a = Number(lead.caixaAltura) || 0;
          const e = Number(lead.caixaEspessura) || 0;
          const c = Number(lead.caixaComprimento) || 0;
          const m3 = (a * e * c) / 1e9;
          const caixaUsd = (window.FreteTarifas ? window.FreteTarifas.calcularCaixa(m3) : m3 * 100);
          const terrUsd  = Number(lead.freteTerrestreUsd) || 0;
          const marUsd   = Number(lead.freteMaritimoUsd)  || 0;

          // Valor da carga (preco do produto, em BRL → converte pra USD)
          const valorCargaUsd = r.pFatReal / taxa;
          const seguroUsd = itc.seguroMaritimo ? Math.max(35, valorCargaUsd * 0.005 * 1.10) : 0;

          // Decide o que entra conforme incoterm
          const inclui = {
            caixa:     true, // SEMPRE faz parte da exportacao
            terrestre: itc.freteTerrestre,
            maritimo:  itc.freteMaritimo,
            seguro:    itc.seguroMaritimo,
          };

          const fmtUsd = v => 'USD ' + v.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
          const fmtBRL2 = v => 'R$ ' + (v * taxa).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
          const linha = (label, usd, incluso) => `
            <div style="display:grid; grid-template-columns:1fr 100px 130px 70px; gap:8px; padding:6px 0; border-bottom:1px solid #eef3f8; align-items:center; ${incluso ? '' : 'opacity:0.45; text-decoration:line-through;'}">
              <span style="font-size:12px;">${label}</span>
              <span style="font-size:12px; text-align:right; color:#666;">${fmtUsd(usd)}</span>
              <span style="font-size:12px; text-align:right; color:#155724;">${fmtBRL2(usd)}</span>
              <span style="font-size:11px; text-align:center; font-weight:700; color:${incluso ? '#0c5485' : '#999'};">
                ${incluso ? '✓ SIM' : '✗ NAO'}
              </span>
            </div>
          `;

          const totalFreteUsd = (inclui.terrestre ? terrUsd : 0)
                              + (inclui.maritimo  ? marUsd  : 0)
                              + (inclui.caixa     ? caixaUsd: 0)
                              + (inclui.seguro    ? seguroUsd:0);
          const totalFinalBrl = r.pFatReal + (totalFreteUsd * taxa);
          const totalFinalUsd = (r.pFatReal / taxa) + totalFreteUsd;

          return `
            <div class="orc-section" style="margin-top:18px; padding:16px; background:#eff8ff; border:2px solid #0c5485; border-radius:8px;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <span style="font-size:20px;">🌍</span>
                <div style="font-weight:700; color:#0c5485; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">
                  Desdobramento Internacional &middot; Incoterm <span style="background:#0c5485; color:#fff; padding:2px 8px; border-radius:4px; font-size:12px;">${escapeHtml(incoterm)}</span>
                </div>
              </div>
              <p style="font-size:11px; color:#5a7a99; margin:0 0 10px 0;">
                <b>${escapeHtml(itc.nome)}</b> (${escapeHtml(itc.nomePt)}). ${escapeHtml(itc.descricao)}
              </p>
              <div style="display:grid; grid-template-columns:1fr 100px 130px 70px; gap:8px; padding:6px 0; border-bottom:2px solid #0c5485; font-size:10px; font-weight:700; color:#0c5485; text-transform:uppercase;">
                <span>Componente</span>
                <span style="text-align:right;">USD</span>
                <span style="text-align:right;">R$ convert.</span>
                <span style="text-align:center;">No preco?</span>
              </div>
              ${linha('Valor do produto (FCA fabrica)', valorCargaUsd, true)}
              ${linha('📦 Caixa de madeira fumigada (' + m3.toFixed(2) + ' m³)', caixaUsd, inclui.caixa)}
              ${linha('🚛 Frete terrestre Uberlandia → Santos', terrUsd, inclui.terrestre)}
              ${linha('🚢 Frete maritimo ' + (lead.freteModal || 'LCL'), marUsd, inclui.maritimo)}
              ${linha('🛡️ Seguro maritimo (0,5% × valor × 110%)', seguroUsd, inclui.seguro)}
              <div style="margin-top:12px; padding:12px 14px; background:#0c5485; color:#fff; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <span style="font-size:11px; opacity:0.8;">TOTAL FRETE+CAIXA+SEGURO (incluso)</span>
                  <span style="font-size:13px; font-weight:600;">${fmtUsd(totalFreteUsd)} &middot; ${fmtBRL2(totalFreteUsd)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid rgba(255,255,255,0.3);">
                  <span style="font-size:13px; font-weight:600;">CLIENTE PAGA (com ${escapeHtml(incoterm)})</span>
                  <div style="text-align:right;">
                    <div style="font-size:17px; font-weight:700;">${fmtUsd(totalFinalUsd)}</div>
                    <div style="font-size:13px; opacity:0.9;">R$ ${fmtBR(totalFinalBrl)}</div>
                  </div>
                </div>
              </div>
              <p style="font-size:10px; color:#5a7a99; margin:8px 0 0 0; font-style:italic;">
                ✓ inc = componente incluso no preco final conforme incoterm ${escapeHtml(incoterm)} · — exc = comprador paga separado.
                Em DDP, ainda haveria impostos/duties do pais destino (nao calculados aqui).
              </p>
            </div>
          `;
        })()}

        <!-- Felipe sessao 12: 'me de um campo ali valor manual, aonde
             eu coloco valor manual que quero final e voce ajusta a
             margem para chegar no valor por exemplo esse valor ai
             esta em 114.709,76, fechei em 120 mil preciso aumentar
             a margem para chegar em 120 mil ai eu coloco valor manual
             proposto e voce altera a margem para chegar em 120 mil'.

             Campo recebe o valor que o cliente vai pagar (pFatReal alvo).
             Calcula o lucro_alvo necessario pra chegar la, considerando
             desconto + markup_desc + impostos + comissoes atuais. -->
        <div class="orc-section orc-valor-manual" style="margin-top:18px;padding:14px;background:linear-gradient(180deg,#fef3c7,#fff8e7);border:2px solid #f59e0b;border-radius:8px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <span style="font-size:18px;">🎯</span>
            <div style="font-weight:700;color:#92400e;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
              Ajustar pra Valor Final Desejado
            </div>
          </div>
          <p style="font-size:12px;color:#78350f;margin:0 0 12px 0;line-height:1.5;">
            Negociou um valor final com o cliente diferente do calculado? Digita aqui
            o valor que o cliente vai pagar e o sistema ajusta a <b>Margem (lucro alvo)</b>
            automatico pra chegar nesse numero.
          </p>
          <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <label style="display:block;font-size:11px;color:#92400e;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">
                Valor Final Desejado (Cliente Paga)
              </label>
              <!-- Felipe sessao 12: 'quando for colocar o numero ali deixei
                   normal 0 0,0 00,0 000,0 nao tem segredo igual esta ali'.
                   Trocado type=number pra type=text - aceita formato BR
                   livre (1234, 1.234, 1234,56, 1.234,56). parseBR no
                   handler converte. -->
              <input type="text" id="orc-input-valor-manual"
                     placeholder="Ex: 120.000,00"
                     style="width:100%;padding:10px 14px;font-size:18px;font-weight:700;color:#7c2d12;border:2px solid #fbbf24;border-radius:6px;background:#fff;font-variant-numeric:tabular-nums;"
                     value="${(r.pFatReal && r.pFatReal > 0) ? fmtBR(r.pFatReal) : ''}" />
            </div>
            <button type="button" id="orc-btn-aplicar-valor-manual"
                    style="padding:10px 20px;background:#92400e;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer;height:44px;white-space:nowrap;">
              ⚡ Ajustar Margem
            </button>
            <button type="button" id="orc-btn-resetar-margem" title="Volta lucro_alvo pra 15%"
                    style="padding:10px 14px;background:#fff;color:#92400e;border:2px solid #fbbf24;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;height:44px;white-space:nowrap;">
              ↺ Resetar
            </button>
          </div>
          <div id="orc-valor-manual-feedback" style="margin-top:10px;font-size:12px;color:#78350f;min-height:18px;"></div>
        </div>

        <!-- Felipe (sessao 2026-05): botao Aprovar Orcamento empurra o
             pFatReal pro lead correspondente do CRM, atualiza a etapa
             pra "orcamento-pronto" e marca timestamp de aprovacao.
             So' a partir desse momento o card do CRM mostra valor. -->
        ${(() => {
          const aprovado = !!versao.aprovadoEm;
          const valorAprovado = Number(versao.valorAprovado) || 0;
          const podeAprovar = (Number(r.pFatReal) || 0) > 0;
          // Felipe sessao 2026-08: distinguir aprovado-com-envio vs aprovado-local.
          // V2+ pode ter sido aprovada sem enviar pro card (Felipe escolheu "2").
          // Default true preserva visual antigo pra versoes ja aprovadas.
          const enviadoParaCard = versao.enviadoParaCard !== false;
          if (aprovado) {
            const cardClass = enviadoParaCard ? 'is-aprovado' : 'is-aprovado-local';
            const tituloTxt = enviadoParaCard ? 'Orcamento Aprovado' : 'Aprovado Localmente';
            const detalheTxt = enviadoParaCard
              ? `Valor de <span class="t-strong">R$ ${fmtBR(valorAprovado)}</span> enviado pro CRM em ${fmtData(versao.aprovadoEm)}.`
              : `Versao ${versao.numero} aprovada por <span class="t-strong">R$ ${fmtBR(valorAprovado)}</span> em ${fmtData(versao.aprovadoEm)}. <br><span style="color:#b45309;">Card do CRM mantem o valor da versao anterior.</span>`;
            const btnReaprovarTxt = enviadoParaCard
              ? `↻ Re-aprovar com R$ ${fmtBR(r.pFatReal)}`
              : `↻ Aprovar de novo (e escolher se envia pro card)`;
            return `
              <div class="orc-aprovacao-card ${cardClass}" ${!enviadoParaCard ? 'style="background:#fef3c7;border-color:#f59e0b;"' : ''}>
                <div class="orc-aprovacao-info">
                  <span class="orc-aprovacao-icon">${enviadoParaCard ? '✓' : '📝'}</span>
                  <div>
                    <div class="orc-aprovacao-titulo">${tituloTxt}</div>
                    <div class="orc-aprovacao-detalhe">${detalheTxt}</div>
                  </div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <button type="button" class="orc-aprovacao-btn-reaprovar" id="orc-btn-reaprovar"
                          title="Re-aprovar com o valor atual">
                    ${btnReaprovarTxt}
                  </button>
                  <button type="button" id="orc-btn-gerar-documentos"
                          title="Gerar PDF Proposta + PNGs e abrir email"
                          style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:700;">
                    📄 Gerar Documentos
                  </button>
                </div>
              </div>
            `;
          }
          return `
            <div class="orc-aprovacao-card">
              <div class="orc-aprovacao-info">
                <div>
                  <div class="orc-aprovacao-titulo">Pronto pra aprovar?</div>
                  <div class="orc-aprovacao-detalhe">
                    Ao clicar, o valor de <span class="t-strong">R$ ${fmtBR(r.pFatReal)}</span>
                    e enviado pro card do CRM, e a etapa do lead muda pra "Orcamento Pronto".
                  </div>
                </div>
              </div>
              <button type="button" class="orc-aprovacao-btn ${podeAprovar ? '' : 'is-disabled'}"
                      id="orc-btn-aprovar" ${podeAprovar ? '' : 'disabled'}
                      title="${podeAprovar ? 'Aprovar e empurrar pro CRM' : 'Calcule o orcamento primeiro'}">
                ✓ Aprovar ${(Number(versao.numero) || 1) > 1 ? 'Versao ' + versao.numero : 'Orcamento'}
              </button>
            </div>
          `;
        })()}

        ${(() => {
          const d = demonstracaoResultado(r);
          // Felipe (sessao 2026-06): linhas que comecam com "(−)" sao
          // deducoes/custos — recebem classe .is-deducao pra valor
          // aparecer em VERMELHO no DRE (Felipe pediu).
          const linha = (label, valor, pctVal, opts) => {
            const isDeducao = String(label).trim().startsWith('(−)') ||
                              String(label).trim().startsWith('(-)');
            return `
            <div class="orc-dre-conf-row ${opts?.destaque ? 'is-destaque' : ''} ${opts?.subtotal ? 'is-subtotal' : ''} ${isDeducao ? 'is-deducao' : ''}">
              <span class="orc-dre-conf-label">${label}</span>
              <span class="orc-dre-conf-valor">R$ ${fmtBR(valor)}</span>
              <span class="orc-dre-conf-pct">${fmtBR(pctVal)} %</span>
            </div>
          `;
          };
          const lucroOk = Math.abs(d.pct.lucro_liquido - (params.lucro_alvo || 0)) < 0.5;
          return `
          <div class="orc-dre-conf">
            ${linha('Receita Bruta', d.receita, 100, { destaque: true })}
            ${linha('(−) Impostos Sobre Receita',  d.impostos, d.pct.impostos)}
            ${linha('(−) Comissao Representante',  d.com_rep,  d.pct.com_rep)}
            ${linha('(−) Comissao RT / Arquiteto', d.com_rt,   d.pct.com_rt)}
            ${linha('(−) Comissao Gestao Interna', d.com_gest, d.pct.com_gest)}
            ${linha('Total Deducoes', d.total_deducoes, d.pct.total_deducoes, { subtotal: true })}
            ${linha('Receita Liquida', d.receita_liquida, d.pct.receita_liquida, { destaque: true })}
            ${linha('(−) Custo Direto (Fab + Inst + Overhead)', d.custo_direto, d.pct.custo_direto)}
            ${linha('Lucro Bruto (Antes IRPJ + CSLL)', d.lucro_bruto, d.pct.lucro_bruto, { destaque: true })}
            ${linha('(−) IRPJ + CSLL (34 % Sobre Lucro Bruto)', d.irpj_csll, d.pct.irpj_csll)}
            ${linha(`Lucro Liquido ${lucroOk ? '✓ bate com lucro_alvo' : ''}`, d.lucro_liquido, d.pct.lucro_liquido, { destaque: true })}
          </div>
          `;
        })()}
      </div>
    `;

    bindCustoEvents(container);
    // Felipe (do doc - msg wizard): "Proximo: Proposta Comercial"
    adicionarBotaoWizard(container, 'custo');
  }

  function bindCustoEvents(container) {
    bindZerarButton(container, () => renderCustoTab(container));

    // Botao Salvar (padrao do projeto: univ-btn-save).
    // Os campos ja salvam em autosave nos change handlers — o botao
    // serve pra dar feedback visual de "✓ Tudo salvo" e disparar o dialog.
    container.querySelector('#orc-btn-salvar-custo')?.addEventListener('click', () => {
      if (window.showSavedDialog) window.showSavedDialog();
    });

    // Felipe (sessao 2026-07): "no DRE que salva como versao 1 e
    // congela 100% da planilha". Botao migrado da aba Item pra ca.
    // Fecha a versao atual (vira historico) e cria nova versao
    // baseada em copia.
    container.querySelector('#orc-btn-salvar-versao-dre')?.addEventListener('click', () => {
      const r = obterVersao(UI.versaoAtivaId);
      if (!r) return;
      const versaoAtual = r.versao;
      const opcao       = r.opcao;
      const numAtual    = versaoAtual.numero;
      const numNova     = numAtual + 1;
      const ok = confirm(
        `Salvar Versao ${numAtual} no historico e congelar 100%?\n\n` +
        `- A Versao ${numAtual} sera FECHADA (imutavel).\n` +
        `- Sera criada a Versao ${numNova} em draft, clonada, pra continuar editando.\n\n` +
        `Confirma?`
      );
      if (!ok) return;
      try {
        salvarItensNoBanco();
        fecharVersao(versaoAtual.id);
        const novaVersao = criarVersao({
          opcaoId: opcao.id,
          baseadoEmVersaoId: versaoAtual.id,
        });
        UI.versaoAtivaId = novaVersao.id;
        renderCustoTab(container);
        if (window.showSavedDialog) {
          window.showSavedDialog(`Versao ${numAtual} congelada. Editando agora a Versao ${numNova}.`);
        }
      } catch (err) {
        console.error('[orc-btn-salvar-versao-dre]', err);
        alert('Nao foi possivel salvar a versao: ' + (err.message || err));
      }
    });

    // Felipe (do doc): aplica a comissao maxima do representante no campo
    // Comissao Rep. User clica → puxa do cadastro do rep (6% ou 7%).
    container.querySelector('#orc-btn-aplicar-comissao')?.addEventListener('click', () => {
      try {
        const lead = lerLeadAtivo();
        const fup = lead && (lead.representante_followup || '');
        if (!fup) return;
        const reps = (window.Representantes && typeof window.Representantes.listar === 'function')
          ? window.Representantes.listar() : [];
        const rep = reps.find(re => String(re.followup || '').trim() === fup);
        if (!rep) return;
        const comPct = (Number(rep.comissao_maxima) || 0) * 100;
        const versao = versaoAtiva();
        if (!versao) return;
        const novosParams = Object.assign({}, versao.parametros || {});
        novosParams.com_rep = comPct;
        // Felipe sessao 2026-08: limpa flag _com_rep_manual - aplicar
        // comissao do rep e' acao automatica, deve voltar comportamento
        // de auto-aplicacao nos proximos renders.
        delete novosParams._com_rep_manual;
        atualizarVersao(versao.id, { parametros: novosParams });
        renderCustoTab(container);
        if (window.showSavedDialog) window.showSavedDialog(`Comissao Rep aplicada: ${comPct}%`);
      } catch (e) {
        console.warn('[DRE] aplicar comissao falhou:', e);
      }
    });

    // Felipe (sessao 2026-05): botao "Aprovar Orcamento" — empurra
    // pFatReal pro lead do CRM e avanca etapa pra "orcamento-pronto".
    // Felipe (sessao 2026-06): "deixe no card ambos valores Preco da
    // Proposta e Cliente Paga" — agora passa AMBOS ao aprovarOrcamento.
    // Felipe (sessao 2026-08): V2+ pergunta antes de empurrar pro card.
    function _executarAprovacao(versao, opts) {
      const subFab  = Number(versao.subFab) || 0;
      const subInst = Number(versao.subInst) || 0;
      const params  = Object.assign({}, PARAMS_DEFAULT, versao.parametros || {});
      const dre     = calcularDRE(subFab, subInst, params);
      const precoProposta     = Number(dre.pTab) || 0;       // preco de tabela (com markup)
      const precoComDesconto  = Number(dre.pFatReal) || 0;   // apos desconto (cliente paga)
      if (precoComDesconto <= 0) {
        alert('Calcule o orcamento primeiro — preco real esta em zero.');
        return;
      }
      try {
        aprovarOrcamento(versao.id, precoComDesconto, precoProposta, opts);
        renderCustoTab(container);
        if (window.showSavedDialog) {
          const enviou = !opts || opts.enviarParaCard !== false;
          if (enviou) {
            window.showSavedDialog(`Orcamento aprovado: R$ ${fmtBR(precoComDesconto)} enviado pro CRM.`);
          } else {
            window.showSavedDialog(`Versao ${versao.numero} aprovada localmente. Card do CRM mantem valor anterior.`);
          }
        }
      } catch (e) {
        alert('Falha ao aprovar: ' + e.message);
      }
    }
    // Felipe sessao 2026-08: helper — pergunta na V2+ se quer enviar pro card
    function _perguntarEnvioCardEAprovar(versao) {
      if (versao.numero <= 1) {
        // V1: fluxo padrao - sempre envia pro card
        const ok = confirm('Aprovar este orcamento e enviar valor pro CRM?\n\nO card do lead vai mostrar o valor e a etapa avanca para "Orcamento Pronto" (se ainda nao estiver).');
        if (!ok) return;
        _executarAprovacao(versao, { enviarParaCard: true });
        return;
      }
      // V2+: pergunta antes
      const subFab  = Number(versao.subFab) || 0;
      const subInst = Number(versao.subInst) || 0;
      const params  = Object.assign({}, PARAMS_DEFAULT, versao.parametros || {});
      const dre     = calcularDRE(subFab, subInst, params);
      const valor   = Number(dre.pFatReal) || 0;
      const escolha = prompt(
        `Aprovar Versao ${versao.numero} — R$ ${fmtBR(valor)}\n\n` +
        `  1 = Aprovar e ENVIAR pro card (substitui valor anterior)\n` +
        `  2 = Aprovar SO LOCALMENTE (card mantem valor da V1)\n` +
        `  Cancelar\n\n` +
        'Digite 1 ou 2:'
      );
      if (escolha === '1')      _executarAprovacao(versao, { enviarParaCard: true });
      else if (escolha === '2') _executarAprovacao(versao, { enviarParaCard: false });
      // qualquer outra coisa = cancelou
    }
    container.querySelector('#orc-btn-aprovar')?.addEventListener('click', () => {
      const versao = versaoAtiva();
      if (!versao) return;
      if (versao.status === 'fechada') {
        alert('Versao fechada — nao e possivel aprovar.');
        return;
      }
      _perguntarEnvioCardEAprovar(versao);
    });
    container.querySelector('#orc-btn-reaprovar')?.addEventListener('click', () => {
      const versao = versaoAtiva();
      if (!versao) return;
      if (versao.status === 'fechada') {
        alert('Versao fechada — nao e possivel re-aprovar.');
        return;
      }
      _perguntarEnvioCardEAprovar(versao);
    });
    // Felipe sessao 12: 'me de um campo ali valor manual, aonde eu coloco
    // valor manual que quero final e voce ajusta a margem para chegar no
    // valor'. Calcula lucro_alvo necessario pra chegar no pFatReal alvo.
    //
    // Formula reversa:
    //   pFatReal = pTab × (1 - desconto)
    //   pTab = custo × fT = custo × fF / (1 - markup_desc)
    //   fF = 1 / (1 - td)
    //   td = impostos + com_rep + com_rt + com_gest + lbn
    //   lbn = lucro_alvo / (1 - 0.34)
    //
    // Dado pFatReal_alvo, isolar lucro_alvo:
    //   pTab_alvo = pFatReal_alvo / (1 - desconto)
    //   fT_alvo = pTab_alvo / custo
    //   fF_alvo = fT_alvo × (1 - markup_desc)
    //   td_alvo = 1 - 1/fF_alvo
    //   lbn_alvo = td_alvo - (impostos + com_rep + com_rt + com_gest)
    //   lucro_alvo_novo = lbn_alvo × (1 - 0.34)
    // Felipe sessao 12: 'ainda esta escrevendo sem ter sequencia decimal
    // ,1 depois 1,2 depois 12,0 depois 120,0 e assim por diante'.
    // Quer mascara monetaria classica BR onde cada digito desliza:
    //   1 -> 0,01    12 -> 0,12    120 -> 1,20    1200 -> 12,00
    //   12000 -> 120,00    120000 -> 1.200,00    12000000 -> 120.000,00
    // User so digita digitos, formatacao automatica.
    const inputValorManual = container.querySelector('#orc-input-valor-manual');
    if (inputValorManual) {
      inputValorManual.addEventListener('input', (e) => {
        const raw = String(e.target.value || '').replace(/\D/g, '');
        if (!raw) {
          e.target.value = '';
          return;
        }
        // Converte digitos pra numero com 2 casas decimais (centavos)
        const num = parseInt(raw, 10) / 100;
        // Formata BR: 1.234,56
        e.target.value = num.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      });
    }

    container.querySelector('#orc-btn-aplicar-valor-manual')?.addEventListener('click', () => {
      const versao = versaoAtiva();
      if (!versao) return;
      if (versao.status === 'fechada') {
        alert('Versao fechada — nao e possivel ajustar margem.');
        return;
      }
      const inp = container.querySelector('#orc-input-valor-manual');
      const fb = container.querySelector('#orc-valor-manual-feedback');
      // Felipe sessao 12: 'pode ser por causa do numero de casas decimais'.
      // parseBR aceita '120000', '120.000', '120000,50', '120.000,50' (BR).
      // MAS parseBR arredonda em 2 casas - aqui o user digita o ALVO em
      // R\$, 2 casas e' suficiente.
      const valorAlvo = parseBR(inp?.value || '');
      if (valorAlvo <= 0) {
        if (fb) { fb.textContent = '⚠ Digite um valor valido (> 0)'; fb.style.color = '#dc2626'; }
        return;
      }
      // Recalcula r FRESH (params podem ter mudado entre render e click)
      const params = Object.assign({}, PARAMS_DEFAULT, versao.parametros || {});
      const dreAtual = calcularDRE(versao.subFab, versao.subInst, params);
      const custoBase = dreAtual.custo;
      if (custoBase <= 0) {
        if (fb) { fb.textContent = '⚠ Custo zero - preencha Fab/Inst antes'; fb.style.color = '#dc2626'; }
        return;
      }

      const desconto = (Number(params.desconto) || 0) / 100;
      const markup_desc = (Number(params.markup_desc) || 0) / 100;
      const impostos = (Number(params.impostos) || 0) / 100;
      const com_rep  = (Number(params.com_rep)  || 0) / 100;
      const com_rt   = (Number(params.com_rt)   || 0) / 100;
      const com_gest = (Number(params.com_gest) || 0) / 100;

      // Inverte formula
      const pTab_alvo = valorAlvo / Math.max(0.01, 1 - desconto);
      const fT_alvo = pTab_alvo / custoBase;
      const fF_alvo = fT_alvo * (1 - markup_desc);
      if (fF_alvo <= 1) {
        if (fb) { fb.textContent = '⚠ Valor abaixo do custo + impostos. Aumente o valor desejado.'; fb.style.color = '#dc2626'; }
        return;
      }
      const td_alvo = 1 - 1 / fF_alvo;
      const lbn_alvo = td_alvo - (impostos + com_rep + com_rt + com_gest);
      if (lbn_alvo <= 0) {
        if (fb) { fb.textContent = '⚠ Impostos + comissoes ja consomem todo o valor. Aumente o valor desejado.'; fb.style.color = '#dc2626'; }
        return;
      }
      const lucro_alvo_novo = lbn_alvo * (1 - IRPJ) * 100; // em %
      if (lucro_alvo_novo > 80) {
        if (fb) { fb.textContent = `⚠ Margem necessaria muito alta (${lucro_alvo_novo.toFixed(1)}%). Considere reduzir desconto.`; fb.style.color = '#dc2626'; }
        return;
      }

      // Felipe sessao 12: 'pode ser por causa do numero de casa decimais,
      // liberar para margem casas decimais livres tbm'. Antes salvava com
      // toFixed(2) - perdia precisao e o pFatReal final ficava ~R\$ 5
      // abaixo do alvo. Agora salva o Number JS direto (preserva ~15
      // digitos significativos) - resultado bate exato com o alvo.
      const paramsNovos = Object.assign({}, params, {
        lucro_alvo: lucro_alvo_novo,  // SEM toFixed - precisao maxima
      });
      atualizarVersao(versao.id, { parametros: paramsNovos });

      const lucroAntigo = (Number(params.lucro_alvo) || 0).toFixed(2);
      const lucroNovo = lucro_alvo_novo.toFixed(4);  // mostra 4 casas no feedback
      if (fb) {
        fb.innerHTML = `✓ Margem ajustada de <b>${lucroAntigo}%</b> para <b>${lucroNovo}%</b>. Cliente Paga = <b>R$ ${fmtBR(valorAlvo)}</b>.`;
        fb.style.color = '#15803d';
      }
      // Re-renderiza DRE pra refletir
      setTimeout(() => renderCustoTab(container), 100);
    });

    // Resetar margem pra default (15%)
    container.querySelector('#orc-btn-resetar-margem')?.addEventListener('click', () => {
      const versao = versaoAtiva();
      if (!versao) return;
      if (versao.status === 'fechada') return;
      const params = Object.assign({}, versao.parametros || {});
      params.lucro_alvo = 15;
      atualizarVersao(versao.id, { parametros: params });
      setTimeout(() => renderCustoTab(container), 100);
    });

    // Felipe (sessao 2026-11): Gerar Documentos direto do DRE quando aprovado.
    // Tambem disponivel no card do CRM. Delega pro modulo OrcDocs.
    container.querySelector('#orc-btn-gerar-documentos')?.addEventListener('click', () => {
      const leadId = (typeof Storage !== 'undefined' && Storage.scope)
        ? Storage.scope('app').get('orcamento_lead_ativo')
        : null;
      if (!leadId) {
        alert('Nenhum lead ativo. Volte pro CRM e clique em "Abrir Orcamento" do lead.');
        return;
      }
      if (window.OrcDocs && typeof window.OrcDocs.gerarDocumentos === 'function') {
        window.OrcDocs.gerarDocumentos(leadId);
      } else {
        alert('Modulo OrcDocs nao carregado. Recarregue a pagina.');
      }
    });

    // Inputs de subFab/subInst e parametros — recalcula em tempo real
    container.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('change', () => {
        const versao = versaoAtiva();
        if (!versao || versao.status === 'fechada') return;

        // Felipe sessao 12: 'liberar para margem casas decimais livres
        // tbm'. Inputs com data-precisao=4 usam parseBR de 4 casas
        // decimais (padrao parseBR arredonda em 2 - perdia precisao do
        // Lucro Alvo calculado pelo Ajustar Margem).
        let v;
        if (el.dataset.precisao === '4') {
          // Parser inline mais preciso: aceita formato BR mas mantem 4+ decimais
          const s = String(el.value || '').trim();
          let clean;
          if (s.includes(',')) {
            clean = s.replace(/\./g, '').replace(',', '.');
          } else {
            clean = s;
          }
          const n = parseFloat(clean);
          v = isNaN(n) ? 0 : Math.round(n * 10000) / 10000;  // 4 casas
        } else {
          v = parseBR(el.value);
        }
        const field = el.dataset.field;
        const dadosUpdate = {};
        if (el.dataset.versaoField) {
          // subFab ou subInst
          dadosUpdate[field] = v;
        } else if (el.dataset.param) {
          // parametros
          const novosParams = Object.assign({}, versao.parametros || {});
          novosParams[field] = v;
          // Felipe sessao 2026-08: edicao manual de com_rep marca flag
          // pra bloquear auto-aplicacao da comissao do rep no proximo
          // render (senao toda vez que entrasse na DRE sobrescreveria
          // de volta com a comissao do rep).
          if (field === 'com_rep') {
            novosParams._com_rep_manual = true;
          }
          // Felipe sessao 12: mesma logica pra markup_desc e desconto -
          // edicao manual desliga a auto-derivacao (20 - com_rt).
          if (field === 'markup_desc') {
            novosParams._markup_desc_manual = true;
          }
          if (field === 'desconto') {
            novosParams._desconto_manual = true;
          }

          // Felipe (sessao 09): RT muda markup E desconto juntos.
          // RT=5 → markup=15, desconto=15 (lucro = exatamente lucro_alvo)
          // RT=0 → markup=20, desconto=20 (lucro = exatamente lucro_alvo)
          // Felipe sessao 12: editar com_rt LIMPA flags manual de markup/
          // desconto - intencao do user e' resetar esses dois pra auto.
          if (field === 'com_rt') {
            const rtVal = Number(novosParams.com_rt) || 0;
            novosParams.markup_desc = 20 - rtVal;
            novosParams.desconto = 20 - rtVal;
            delete novosParams._markup_desc_manual;
            delete novosParams._desconto_manual;
          }
          dadosUpdate.parametros = novosParams;
        }
        try {
          atualizarVersao(versao.id, dadosUpdate);
          renderCustoTab(container);  // re-render pra atualizar resultado
        } catch (e) {
          console.warn('[orcamento] erro ao salvar parametro:', e.message);
        }
      });
    });

    // Felipe sessao 31: botao 'Aplicar defaults Internacional' no DRE.
    // So' aparece quando lead.destinoTipo='internacional'. Aplica os valores
    // padrao internacionais (impostos=0, com_rep/rt/gest=0, lucro=45, sem markup/desconto).
    const btnIntl = container.querySelector('#orc-dre-aplicar-intl');
    if (btnIntl) {
      btnIntl.addEventListener('click', () => {
        const novosParams = Object.assign(
          {},
          versao.parametros || {},
          PARAMS_DEFAULT_INTERNACIONAL,
          // Limpa flags manuais pra nao bloquear futuros recalculos
          { _com_rep_manual: false, _markup_desc_manual: false, _desconto_manual: false }
        );
        try {
          atualizarVersao(versao.id, { parametros: novosParams });
          renderCustoTab(container);
        } catch (e) {
          console.warn('[orcamento] erro ao aplicar defaults internacional:', e.message);
        }
      });
    }
  }

  // ============================================================
  //                      ABA: LEV. PERFIS
  // ============================================================
  /**
   * Renderiza levantamento de perfis pra todos os itens da versao
   * ativa. Aplica REGRAS_PERFIS.xlsx via PerfisCalc.gerarCortesPortaExterna,
   * agrega por codigo, faz FFD, mostra:
   *   - Tabela "Folha — Perfis de Corte" e "Portal — Perfis de Corte"
   *   - Cards: kg liquido / kg bruto / aproveitamento / total barras / perda
   *   - "Relacao de Barras" agrupada BNF-TECNO (com pintura) / BRUTO (sem)
   *   - Botao "Padroes de Cortes" abre modal com bins barra a barra
   */
  /**
   * Dispatcher: dado um item, escolhe o motor de calculo certo.
   * Cada motor e' completamente isolado — nao compartilha logica
   * com nenhum outro. Mudar regra de um nao afeta os demais.
   */
  function motorPerfisPorTipo(tipo) {
    if (tipo === 'porta_externa')       return window.PerfisPortaExterna;
    if (tipo === 'porta_interna')       return window.PerfisPortaInterna;
    if (tipo === 'fixo_acoplado')       return window.PerfisRevAcoplado;
    if (tipo === 'revestimento_parede') return window.PerfisRevParede;
    if (tipo === 'pergolado')           return window.PerfisPergolado;
    return null;
  }

  // Estado da sub-aba dentro de Lev. Perfis (compartilhado entre renders)
  if (typeof UI.subLevPerfis === 'undefined') UI.subLevPerfis = 'cortes';

  /**
   * ORDEM DA TABELA — definida pelo Felipe (nomes completos, ordem fixa):
   * FOLHA:
   *   1) ALTURA FOLHA
   *   2) TRAVESSA VERTICAL
   *   3) FRISO VERTICAL
   *   4) CANTONEIRA CAVA
   *   5) TUBO CAVA
   *   6) LARGURA INFERIOR & SUPERIOR
   *   7) TRAVESSA HORIZONTAL
   *   8) FRISO HORIZONTAL
   *   9) VEDA PORTA INFERIOR & SUPERIOR
   *  10) CANAL ESCOVA
   *  11) TRAVAMENTO CAVA (sempre por ultimo)
   * PORTAL: ALTURA PORTAL → LARGURA PORTAL → TRAVESSA PORTAL
   */
  const ORDEM_FOLHA = [
    'ALTURA FOLHA',
    'TRAVESSA VERTICAL',
    'FRISO VERTICAL',
    'CANTONEIRA CAVA',
    'TUBO CAVA',
    'LARGURA INFERIOR & SUPERIOR',
    'TRAVESSA HORIZONTAL',
    'FRISO HORIZONTAL',
    'VEDA PORTA INFERIOR & SUPERIOR',
    'CANAL ESCOVA',
    'TRAVAMENTO CAVA',
  ];
  const ORDEM_PORTAL = ['ALTURA PORTAL', 'LARGURA PORTAL', 'TRAVESSA PORTAL'];
  // Felipe (R20): labels do motor estao em Title Case ('Altura Portal'),
  // mas as constantes de ordem estao em UPPER. Comparacao precisa ser
  // case-insensitive — senao 'Altura Portal' nao bate com 'ALTURA PORTAL'
  // e vai pro grupo Folha errado.
  function _normLabel(s) { return String(s || '').toUpperCase().trim(); }
  function ordemDoLabel(label) {
    const u = _normLabel(label);
    const i1 = ORDEM_FOLHA.indexOf(u);
    if (i1 >= 0) return i1;
    const i2 = ORDEM_PORTAL.indexOf(u);
    if (i2 >= 0) return 1000 + i2;
    return 9999;
  }
  function ehLinhaPortal(label) {
    return ORDEM_PORTAL.includes(_normLabel(label));
  }

  /**
   * Felipe (sessao 2026-09): calcula peso liquido total da FOLHA de um
   * item (perfis FOLHA + chapas FOLHA). Usado pra escolher pivo 350 vs
   * 600 kg em Lev. Acessorios. Helper isolado: nao modifica motores
   * existentes, so' le os resultados deles.
   *
   * Estrategia:
   *   - Perfis: roda motorPerfisPorTipo(item.tipo).gerarCortes(item),
   *     soma (comp/1000) × kgM × qty para cortes que NAO sao do PORTAL
   *     (FOLHA + FIXO sao tratados como "estrutura da folha" pra peso).
   *   - Chapas: usa ChapasPortaExterna.gerarPecasChapa(item, lado) pros
   *     2 lados, soma area das pecas categoria !== 'portal' × kg/m² da
   *     chapa-mae. Como nao temos acesso facil ao kg/m² aqui sem rodar
   *     a otimizacao de chapa, usa fallback de 8 kg/m² (ACM 4mm padrao)
   *     se nao conseguir descobrir.
   *
   * Retorna { peso, detalhe } onde detalhe explica a composicao.
   * Se nao tem dados pra calcular, retorna { peso: 0 }.
   */
  function calcularPesoFolhaItem(item, perfisCadastro) {
    if (!item || item.tipo !== 'porta_externa') return { peso: 0 };
    let pesoPerfis = 0;
    let pesoChapas = 0;
    let pesoEnchimento = 0;
    // Felipe sessao 2026-08-03: reusa cortes pra calcular enchimento.
    // Travessas vertical e horizontal entram aqui.
    let _cortes = {};

    // --- Perfis FOLHA ---
    try {
      const motor = motorPerfisPorTipo(item.tipo);
      if (motor && motor.gerarCortes) {
        // Anexa modeloNome (igual recalcularPerfisESalvarNoFab faz)
        const modelos = (window.Storage ? Storage.scope('cadastros').get('modelos_lista') : null) || [];
        const numModelo = parseInt(String(item.modeloNumero || '').replace(/\D/g, ''), 10) || 0;
        const modeloAtual = modelos.find(m => Number(m.numero) === numModelo);
        const itemEnriquecido = Object.assign({}, item, { modeloNome: (modeloAtual && modeloAtual.nome) || '' });
        _cortes = motor.gerarCortes(itemEnriquecido) || {};
        for (const cod in _cortes) {
          const cad = (perfisCadastro && perfisCadastro[cod]) || {};
          const kgM = Number(cad.kgPorMetro) || 0;
          if (!kgM) continue;
          (_cortes[cod] || []).forEach(c => {
            // Soma somente FOLHA (label nao em ORDEM_PORTAL).
            // FIXO e' raro em porta_externa e nao tem label estavel
            // ainda; conta como folha (afeta peso, ok).
            if (ehLinhaPortal(c.label)) return;
            const peso = (Number(c.comp) || 0) / 1000 * kgM * (Number(c.qty) || 0);
            pesoPerfis += peso;
          });
        }
      }
    } catch (e) {
      console.warn('[calcularPesoFolhaItem] perfis falhou:', e);
    }

    // --- Chapas FOLHA ---
    try {
      if (window.ChapasPortaExterna && window.ChapasPortaExterna.gerarPecasChapa) {
        // Felipe sessao 2026-08-03 BUG FIX:
        // Antes o sistema procurava por item.revestimento ('ACM 4mm',
        // 'HPL 4mm', etc - valor generico) na lista de superficies, mas
        // o cadastro tem cada cor com nome completo (ex: 'Pro4631t -
        // Dark Grey Texturizado Weather4300 Ldpe - 1500 X 6000').
        // Nunca batia → kgM2 sempre 0 → chapas nao entravam no peso da
        // folha → pivo escolhia sempre 350kg em vez de 600kg.
        //
        // FIX: procura primeiro por item.corExterna (que e' a descricao
        // especifica selecionada), depois corInterna como fallback.
        let kgM2 = 0;
        try {
          const supList = (window.Storage ? Storage.scope('cadastros').get('superficies_lista') : null) || [];
          const candidatos = [
            String(item.corExterna  || '').toUpperCase().trim(),
            String(item.corInterna  || '').toUpperCase().trim(),
            String(item.revestimento|| '').toUpperCase().trim(),
          ].filter(Boolean);
          for (const c of candidatos) {
            const sup = supList.find(s => String(s.descricao || '').toUpperCase().trim() === c);
            if (sup && Number(sup.peso_kg_m2) > 0) {
              kgM2 = Number(sup.peso_kg_m2);
              break;
            }
          }
          // Fallback final: pega QUALQUER superficie da mesma categoria
          // do revestimento ('ACM 4mm' -> categoria 'acm' -> primeira ACM
          // com peso > 0). Util quando cliente cadastrou peso em UMA
          // chapa ACM e outras ainda nao.
          if (!kgM2 && item.revestimento) {
            const rev = String(item.revestimento).toUpperCase().trim();
            const catAlvo = rev.includes('ACM') ? 'acm'
                          : rev.includes('ALUMINIO') ? 'aluminio_macico'
                          : rev.includes('HPL') ? 'hpl'
                          : null;
            if (catAlvo) {
              const sup = supList.find(s => s.categoria === catAlvo && Number(s.peso_kg_m2) > 0);
              kgM2 = Number(sup && sup.peso_kg_m2) || 0;
            }
          }
        } catch (_) {}
        // Se kgM2=0 (cadastro nao tem peso ou material nao encontrado),
        // pesoChapas fica 0 — Felipe prefere zero a chute errado.

        if (kgM2 > 0) {
          // Felipe sessao 2026-08-03: 'deve somar somente o peso das
          // chapas que estao no campo porta'. WHITELIST explicita -
          // so' soma categoria='porta' (folha). Categoria 'portal'
          // (marco) e 'revestimento' (parede) NAO entram.
          ['externo', 'interno'].forEach(lado => {
            try {
              const pecas = window.ChapasPortaExterna.gerarPecasChapa(item, lado) || [];
              pecas.forEach(p => {
                if (p.categoria !== 'porta') return;  // SO' chapas da folha
                const m2 = (Number(p.largura) || 0) * (Number(p.altura) || 0) * (Number(p.qtd) || 1) / 1000000;
                pesoChapas += m2 * kgM2;
              });
            } catch (_) {}
          });
        }
      }
    } catch (e) {
      console.warn('[calcularPesoFolhaItem] chapas falhou:', e);
    }

    // --- Enchimento (frisos internos das travessas) ---
    // Felipe sessao 2026-08-03: '(100 x comprimento travessa vertical)
    // x quantidade de travessa vertical x 6 kg/m², mesma coisa para
    // travessa horizontal'.
    // Formula: m² = (100mm × comp_mm × qty) / 1.000.000 → kg = m² × 6
    try {
      const ENCH_KG_M2 = 6; // ACM 4mm padrao
      for (const cod in _cortes) {
        (_cortes[cod] || []).forEach(c => {
          if (/TRAVESSA (VERTICAL|HORIZONTAL)/i.test(c.label)) {
            const m2 = (100 * (Number(c.comp) || 0) * (Number(c.qty) || 0)) / 1000000;
            pesoEnchimento += m2 * ENCH_KG_M2;
          }
        });
      }
    } catch (e) {
      console.warn('[calcularPesoFolhaItem] enchimento falhou:', e);
    }

    // Felipe sessao 2026-08-03: peso da porta = perfis + chapas +
    // enchimento, COM 10% de margem de seguranca.
    const subtotal = pesoPerfis + pesoChapas + pesoEnchimento;
    const peso = subtotal * 1.10;
    return {
      peso,
      detalhe: {
        perfis: pesoPerfis,
        chapas: pesoChapas,
        enchimento: pesoEnchimento,
        subtotal: subtotal,
        comMargem: peso,
      },
    };
  }

  // Felipe (sessao 30 debug): expoe a funcao pra ele rodar no console e
  // me mandar o resultado quando o peso do pivo nao bate. Loga cada
  // peca individualmente pra eu ver de onde vem o peso.
  window.debugPivo = function(itemIdx) {
    const versao = obterVersaoAtiva && obterVersaoAtiva();
    if (!versao || !versao.itens) {
      console.error('[debugPivo] versao nao encontrada');
      return null;
    }
    const idx = (Number(itemIdx) || 1) - 1;
    const item = versao.itens[idx];
    if (!item) {
      console.error('[debugPivo] item', itemIdx, 'nao existe. Itens disponiveis:', versao.itens.length);
      return null;
    }
    const perfisCadastro = construirCadastroPerfis();
    console.group(`[debugPivo] Item ${idx + 1} — ${item.largura}×${item.altura}mm, ${item.nFolhas}F, modelo ${item.modeloNumero}, sistema ${item.sistema}`);

    // Perfis
    let pesoPerfisFolha = 0, pesoPerfisPortal = 0;
    const motor = motorPerfisPorTipo(item.tipo);
    if (motor && motor.gerarCortes) {
      const modelos = (window.Storage ? Storage.scope('cadastros').get('modelos_lista') : null) || [];
      const numModelo = parseInt(String(item.modeloNumero || '').replace(/\D/g, ''), 10) || 0;
      const modeloAtual = modelos.find(m => Number(m.numero) === numModelo);
      const itemEnriq = Object.assign({}, item, { modeloNome: (modeloAtual && modeloAtual.nome) || '' });
      const cortes = motor.gerarCortes(itemEnriq) || {};
      console.group('PERFIS');
      console.table(Object.keys(cortes).flatMap(cod => {
        const kgM = (perfisCadastro[cod] && perfisCadastro[cod].kgPorMetro) || 0;
        return (cortes[cod] || []).map(c => {
          const peso = (Number(c.comp) || 0) / 1000 * kgM * (Number(c.qty) || 0);
          const eh = ehLinhaPortal(c.label) ? 'PORTAL' : 'FOLHA';
          if (eh === 'PORTAL') pesoPerfisPortal += peso; else pesoPerfisFolha += peso;
          return { codigo: cod, label: c.label, comp: c.comp, qty: c.qty, kgM: kgM, peso: Number(peso.toFixed(2)), tipo: eh };
        });
      }));
      console.log(`Perfis FOLHA: ${pesoPerfisFolha.toFixed(2)}kg`);
      console.log(`Perfis PORTAL: ${pesoPerfisPortal.toFixed(2)}kg`);
      console.log(`Perfis TOTAL: ${(pesoPerfisFolha + pesoPerfisPortal).toFixed(2)}kg`);
      console.groupEnd();
    }

    // Chapas
    let pesoChapasFolha = 0, pesoChapasPortal = 0, kgM2 = 0;
    if (window.ChapasPortaExterna && window.ChapasPortaExterna.gerarPecasChapa) {
      // Felipe sessao 2026-08-03 BUG FIX: usa corExterna/corInterna primeiro
      // (descricao especifica), depois revestimento como fallback.
      try {
        const supList = (window.Storage ? Storage.scope('cadastros').get('superficies_lista') : null) || [];
        const candidatos = [
          String(item.corExterna  || '').toUpperCase().trim(),
          String(item.corInterna  || '').toUpperCase().trim(),
          String(item.revestimento|| '').toUpperCase().trim(),
        ].filter(Boolean);
        for (const c of candidatos) {
          const sup = supList.find(s => String(s.descricao || '').toUpperCase().trim() === c);
          if (sup && Number(sup.peso_kg_m2) > 0) {
            kgM2 = Number(sup.peso_kg_m2);
            break;
          }
        }
        if (!kgM2 && item.revestimento) {
          const rev = String(item.revestimento).toUpperCase().trim();
          const catAlvo = rev.includes('ACM') ? 'acm'
                        : rev.includes('ALUMINIO') ? 'aluminio_macico'
                        : rev.includes('HPL') ? 'hpl'
                        : null;
          if (catAlvo) {
            const sup = supList.find(s => s.categoria === catAlvo && Number(s.peso_kg_m2) > 0);
            kgM2 = Number(sup && sup.peso_kg_m2) || 0;
          }
        }
      } catch (_) {}
      const kgM2Final = kgM2 || 0;
      const labelKgM2 = kgM2 ? kgM2 + ' kg/m² (cadastro: corExterna/corInterna/revestimento)' : 'NAO ENCONTRADO no cadastro — peso = 0';
      console.group(`CHAPAS — corExterna "${item.corExterna || '?'}" / corInterna "${item.corInterna || '?'}" / rev "${item.revestimento || '?'}" → ${labelKgM2}`);
      const todasPecas = [];
      // Felipe sessao 2026-08-03: WHITELIST - so' categoria='porta' soma na folha
      ['externo', 'interno'].forEach(lado => {
        const pecas = window.ChapasPortaExterna.gerarPecasChapa(item, lado) || [];
        pecas.forEach(p => {
          const m2 = (Number(p.largura) || 0) * (Number(p.altura) || 0) * (Number(p.qtd) || 1) / 1000000;
          const peso = m2 * kgM2Final;
          if (p.categoria === 'porta')        pesoChapasFolha  += peso;
          else if (p.categoria === 'portal')  pesoChapasPortal += peso;
          // outras categorias (revestimento de parede, etc) NAO somam
          todasPecas.push({ lado, tipo: p.tipo, largura: p.largura, altura: p.altura, qtd: p.qtd, m2: Number(m2.toFixed(3)), peso: Number(peso.toFixed(2)), categoria: p.categoria });
        });
      });
      console.table(todasPecas);
      console.log(`Chapas FOLHA (categoria='porta'): ${pesoChapasFolha.toFixed(2)}kg`);
      console.log(`Chapas PORTAL (categoria='portal'): ${pesoChapasPortal.toFixed(2)}kg — NAO entra na folha`);
      console.log(`Chapas TOTAL: ${(pesoChapasFolha + pesoChapasPortal).toFixed(2)}kg`);
      console.groupEnd();
    }

    // Resumo
    const totalFolha = pesoPerfisFolha + pesoChapasFolha;
    const nF = Number(item.nFolhas) || 1;
    console.group('RESUMO');
    console.log(`Item ${idx + 1}: ${nF} folhas`);
    console.log(`Peso FOLHA item (perfis+chapas folha): ${totalFolha.toFixed(2)}kg`);
    console.log(`Peso por folha (÷${nF}): ${(totalFolha / nF).toFixed(2)}kg`);
    console.log(`  → perfis/folha: ${(pesoPerfisFolha / nF).toFixed(2)}kg`);
    console.log(`  → chapas/folha: ${(pesoChapasFolha / nF).toFixed(2)}kg`);
    console.log(`Decisao pivo: ${(totalFolha / nF) > 350 ? 'PA-PIVOT 600 KG' : 'PA-PIVOT 350 KG'}`);
    console.groupEnd();
    console.groupEnd();
    return {
      perfisFolha: pesoPerfisFolha,
      perfisPortal: pesoPerfisPortal,
      chapasFolha: pesoChapasFolha,
      chapasPortal: pesoChapasPortal,
      kgM2: kgM2,
      kgM2_origem: kgM2 ? 'cadastro' : 'NAO ENCONTRADO',
      totalFolha,
      pesoPorFolha: totalFolha / nF,
    };
  };

  /**
   * Recalcula os totais do Planificador e PERSISTE em fab.total_perfis e
   * fab.total_pintura (e' assim que o DRE recebe os custos auto). Chamado
   * sempre que abre Lev. Perfis ou o DRE — mantem os 2 sincronizados.
   * Retorna { result, totalBarras, perda, aprovGeral, blocosPorItem }
   */
  /* Felipe sessao 2026-08: 'isso deve varrer todos os valores pos calculo'.
     Forca o sync de TODOS os campos auto-populados do Custo Fab/Inst,
     sobrescrevendo qualquer valor anterior (incluindo edicao manual).

     A logica em renderCustoTab so' atualiza se o campo estiver vazio
     (preserva edicao manual). Bom pro abrir-a-aba, mas RUIM quando
     Felipe muda algum input em Caracteristicas do Item, recalcula, e
     espera que o Custo Fab/Inst reflita o novo valor.

     Esta funcao e' chamada SO' pelo botao 'Recalcular' - explicito.
     Garante que apos Recalcular:
       - total_perfis        = soma do Lev. Perfis
       - total_pintura       = soma do Lev. Perfis (pintura)
       - total_acessorios    = soma do Lev. Acessorios FAB sem digital
       - total_fechadura_digital = soma do Lev. Acessorios DIGITAL
     total_revestimento e total_extras continuam manuais (sem motor
     automatico ainda). */
  function forcarSyncCustoFabAuto(versao) {
    if (!versao || !versao.itens) return;
    const fab = Object.assign({}, versao.custoFab || {});
    const itens = versao.itens || [];
    if (!itens.length) return;

    let mudou = false;

    // 1) Perfis e pintura: usa motor existente recalcularPerfisESalvarNoFab
    try {
      const rPerfis = recalcularPerfisESalvarNoFab(versao, itens);
      if (rPerfis && rPerfis.result) {
        const cp = Math.round((rPerfis.result.custoPerfis  || 0) * 100) / 100;
        const ct = Math.round((rPerfis.result.custoPintura || 0) * 100) / 100;
        if (Math.abs((Number(fab.total_perfis)  || 0) - cp) > 0.01) { fab.total_perfis  = cp > 0 ? cp : ''; mudou = true; }
        if (Math.abs((Number(fab.total_pintura) || 0) - ct) > 0.01) { fab.total_pintura = ct > 0 ? ct : ''; mudou = true; }
      }
    } catch(e) { console.warn('[forcarSyncCustoFabAuto] perfis/pintura:', e); }

    // 2) Acessorios e Fechadura Digital: chama AcessoriosPortaExterna por item
    try {
      if (window.AcessoriosPortaExterna) {
        const cadAcess = Storage.scope('cadastros').get('acessorios_lista') || [];
        const perfisCad = (typeof construirCadastroPerfis === 'function')
          ? construirCadastroPerfis() : {};
        let totalAcess = 0;
        let totalDigital = 0;
        itens.forEach(item => {
          if (!item || item.tipo !== 'porta_externa') return;
          let pesoFolhaTotal = 0, pesoFolhaPerfis = 0, pesoFolhaChapas = 0;
          try {
            const r = calcularPesoFolhaItem(item, perfisCad) || {};
            pesoFolhaTotal  = r.peso || 0;
            pesoFolhaPerfis = (r.detalhe && r.detalhe.perfis) || 0;
            pesoFolhaChapas = (r.detalhe && r.detalhe.chapas) || 0;
          } catch(_){}
          const linhas = window.AcessoriosPortaExterna.calcularAcessoriosPorItem(
            item, cadAcess, { pesoFolhaTotal, pesoFolhaPerfis, pesoFolhaChapas }
          );
          linhas.forEach(l => {
            if (String(l.categoria || '').toLowerCase().includes('fechadura digital')) {
              totalDigital += Number(l.total) || 0;
              return;
            }
            // Felipe (sessao 09): FAB + OBRA somam juntos em Acessorios
            totalAcess += Number(l.total) || 0;
          });
        });
        // SOBRESCREVE (diferente da logica em renderCustoTab)
        const totalAcessRound = Math.round(totalAcess * 100) / 100;
        const totalDigRound   = Math.round(totalDigital * 100) / 100;
        if (Math.abs((Number(fab.total_acessorios) || 0) - totalAcessRound) > 0.01) {
          fab.total_acessorios = totalAcessRound > 0 ? totalAcessRound : '';
          mudou = true;
        }
        if (Math.abs((Number(fab.total_fechadura_digital) || 0) - totalDigRound) > 0.01) {
          fab.total_fechadura_digital = totalDigRound > 0 ? totalDigRound : '';
          mudou = true;
        }
      }
    } catch(e) { console.warn('[forcarSyncCustoFabAuto] acessorios:', e); }

    // 3) Persiste se houve qualquer mudanca
    if (mudou) {
      atualizarVersao(versao.id, {
        custoFab: Object.assign({}, versao.custoFab || {}, fab),
      });
    }
  }

  function recalcularPerfisESalvarNoFab(versao, itens) {
    const perfisCadastro = construirCadastroPerfis();
    const cortesPorCodigo = {};
    // Cadastro de modelos pra resolver modeloNumero -> nome (deteccao "cava" por descricao)
    const modelos = (window.Storage ? Storage.scope('cadastros').get('modelos_lista') : null) || [];

    // Felipe (sessao 30): expoe versao ativa pra o motor de fixo_acoplado
    // poder ler a porta principal quando fixoSegueModelo='sim'. Approach
    // simples — sem refatorar interface dos motores.
    window._versaoAtivaParaFixo = versao;

    // Felipe (sessao 27 fix): le overrides/excluidas/extras de lev_ajustes
    // pra aplicar antes de gerar cortesPorCodigo. Sem isso, editar Qtd ou
    // Tamanho na aba "Cortes por Item" nao atualizava os cards de Kg
    // Liquido / Kg Bruto / Aproveitamento (usavam cortes ORIGINAIS).
    // Felipe (sessao 28 fix CRITICO): usar 'store' local (definido na
    // linha ~27 como Storage.scope('orcamentos')), NAO window.store
    // (que nao existe — bug da sessao 27 fez o fix nao funcionar).
    const ajustesAll = store.get('lev_ajustes') || {};
    const ajustesV = (versao && ajustesAll[versao.id]) || {};
    const overrides = ajustesV.overrides || {};
    const excluidas = new Set(ajustesV.excluidas || []);
    const extras    = ajustesV.extras    || [];
    const keyLinha  = (itemIdx, codigo, descricao) => `${itemIdx}|${codigo}|${descricao}`;

    const blocosPorItem = itens.map((item, idx) => {
      const motor = motorPerfisPorTipo(item.tipo);
      if (!motor) {
        return { itemIdx: idx + 1, item, descricao: `Item ${idx + 1}: tipo desconhecido`, cortes: {}, temRegra: false };
      }
      // Anexa nome do modelo pro motor poder detectar "cava" pela descricao
      // sem mudar a interface dele (motor recebe o item, nao o cadastro inteiro).
      const numModelo = parseInt(String(item.modeloNumero || '').replace(/\D/g, ''), 10) || 0;
      const modeloAtual = modelos.find(m => Number(m.numero) === numModelo);
      const itemEnriquecido = { ...item, modeloNome: modeloAtual?.nome || '' };
      let cortes = motor.gerarCortes(itemEnriquecido) || {};

      // Felipe (sessao 27 fix): aplica overrides + remove excluidas
      const itemIdx = idx + 1;
      const cortesAjustados = {};
      for (const cod in cortes) {
        const arr = (cortes[cod] || []).map(c => {
          const k = keyLinha(itemIdx, cod, c.label || '');
          if (excluidas.has(k)) return null;
          const ov = overrides[k];
          if (ov) {
            return Object.assign({}, c, {
              comp: (Number.isFinite(ov.comp) && ov.comp > 0) ? ov.comp : c.comp,
              qty:  (Number.isFinite(ov.qty)  && ov.qty  > 0) ? ov.qty  : c.qty,
            });
          }
          return c;
        }).filter(Boolean);
        if (arr.length > 0) cortesAjustados[cod] = arr;
      }
      cortes = cortesAjustados;

      const temRegra = Object.keys(cortes).length > 0;
      // Agrega no cortesPorCodigo global pra Planificador rodar FFD
      for (const cod in cortes) {
        if (!cortesPorCodigo[cod]) cortesPorCodigo[cod] = [];
        cortes[cod].forEach(c => cortesPorCodigo[cod].push({ ...c, itemIdx: idx + 1 }));
      }
      return {
        itemIdx,
        item,
        descricao: motor.descricaoItem ? motor.descricaoItem(item) : `Item ${idx + 1}`,
        cortes,
        temRegra,
      };
    });

    // Felipe (sessao 27 fix): adiciona linhas EXTRAS (manuais) ao
    // cortesPorCodigo global. Cada extra tem itemIdx, codigo, descricao
    // (label), comp, qty, kgM, barLen.
    extras.forEach(ex => {
      const cod = String(ex.codigo || '').trim();
      if (!cod) return;
      if (!cortesPorCodigo[cod]) cortesPorCodigo[cod] = [];
      cortesPorCodigo[cod].push({
        comp: Number(ex.comp) || 0,
        qty:  Number(ex.qty)  || 0,
        label: ex.descricao || '',
        itemIdx: ex.itemIdx || 1,
      });
    });

    const result = window.PerfisCore.calcularPorCodigo(cortesPorCodigo, perfisCadastro);
    const totalBarras = result.itens.reduce((s, i) => s + i.nBars, 0);
    const perda = result.kgBrutoTotal - result.kgLiqTotal;
    const aprovGeral = result.kgBrutoTotal > 0 ? (result.kgLiqTotal / result.kgBrutoTotal) * 100 : 0;

    // === AUTO-SALVA no fab.total_perfis e fab.total_pintura ===
    // Se o usuario nao editou manualmente esses campos (auto-fill).
    if (versao && versao.status !== 'fechada') {
      const fab = Object.assign({}, FAB_DEFAULT, versao.custoFab || {});
      fab.etapas = Object.assign({}, FAB_DEFAULT.etapas, fab.etapas || {});
      const novoTPerfis  = Math.round(result.custoPerfis  * 100) / 100;
      const novoTPintura = Math.round(result.custoPintura * 100) / 100;
      const mudou = (Math.abs((Number(fab.total_perfis)  || 0) - novoTPerfis)  > 0.01)
                 || (Math.abs((Number(fab.total_pintura) || 0) - novoTPintura) > 0.01);
      if (mudou) {
        fab.total_perfis  = novoTPerfis;
        fab.total_pintura = novoTPintura;
        atualizarVersao(UI.versaoAtivaId, { custoFab: fab });
      }
    }

    return { result, blocosPorItem, totalBarras, perda, aprovGeral, perfisCadastro };
  }

  function renderLevPerfisTab(container) {
    inicializarSessao();
    const versao = versaoAtiva();
    const motivoBloqueio = versao ? precisaCalcular(versao) : null;
    if (motivoBloqueio) {
      return renderPrecisaCalcular(container, versao, motivoBloqueio, 'Levantamento de Perfis');
    }
    const itens = (versao && versao.itens) || [];
    if (!itens.length) {
      container.innerHTML = `
        <div class="placeholder">
          <div class="icon-big">📏</div>
          <h3>Sem itens nessa versao</h3>
          <p>Adicione itens na aba "Caracteristicas do Item" pra ver o levantamento.</p>
        </div>`;
      return;
    }

    // Roda o calculo + persiste totais no FAB (DRE auto-puxa)
    const calc = recalcularPerfisESalvarNoFab(versao, itens);

    // Felipe (do doc): TODO relatorio tem cabecalho padronizado.
    const lead = lerLeadAtivo() || {};
    const opcaoLev = obterVersao(versao.id)?.opcao;
    const numDocLev = `${(opcaoLev?.letra || 'A')} - ${versao.numero}`;
    const headerLevHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
      ? window.Empresa.montarHeaderRelatorio({
          lead,
          tituloRelatorio: 'Levantamento de Perfis',
          numeroDocumento: numDocLev,
          validade: 15,
        })
      : '';

    // Header com sub-abas Cortes / Planificador (pedido do Felipe)
    const subAbaAtiva = UI.subLevPerfis || 'cortes';

    // Felipe (sessao 2026-05): aviso visivel quando o motor de perfis
    // pede codigos que NAO estao no cadastro. Antes ficava silenciado
    // com peso/preco zerado — agora o usuario ve a falta e sabe quais
    // perfis precisam ser adicionados em Cadastros > Perfis.
    let bannerFaltantes = '';
    try {
      const faltantes = (calc.perfisCadastro && calc.perfisCadastro._codigosFaltantes) || new Set();
      if (faltantes.size > 0) {
        const lista = Array.from(faltantes).sort();
        bannerFaltantes = `
          <div class="orc-banner-aviso orc-banner-aviso-erro">
            <div class="orc-banner-aviso-icon">⚠</div>
            <div class="orc-banner-aviso-conteudo">
              <div class="orc-banner-aviso-titulo">
                ${lista.length} codigo(s) de perfil pedido(s) pelo motor NAO existem no cadastro
              </div>
              <div class="orc-banner-aviso-detalhe">
                Esses perfis aparecem com <b>peso/preco zerado</b> nas tabelas abaixo. Para corrigir,
                adicione cada um em <b>Cadastros &gt; Perfis</b> com seu kg/m correto:
                <ul class="orc-banner-aviso-lista">
                  ${lista.map(c => `<li><code>${escapeHtml(c)}</code></li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        `;
      }
    } catch (e) { /* nao bloqueia render */ }

    container.innerHTML = `
      ${headerLevHtml}
      ${bannerCaracteristicasItens(versao)}
      ${bannerFaltantes}
      <div class="lvp-subtabs">
        <button type="button" class="lvp-subtab ${subAbaAtiva === 'cortes' ? 'is-active' : ''}" data-subtab="cortes">📋 Cortes por Item</button>
        <button type="button" class="lvp-subtab ${subAbaAtiva === 'planificador' ? 'is-active' : ''}" data-subtab="planificador">🧩 Aproveitamento de Barras</button>
        <div class="lvp-subtabs-spacer"></div>
        <!-- Felipe (sessao 2026-08): "permita imprimir todas as abas
             do levantamento de perfis" — botoes PNG e PDF nas duas sub-abas -->
        <button type="button" class="rep-export-btn" id="lvp-btn-export-png" title="Exporta esta sub-aba como imagem PNG">🖼 PNG</button>
        <button type="button" class="rep-export-btn" id="lvp-btn-export-pdf" title="Exporta esta sub-aba como PDF">📄 PDF</button>
        <button type="button" class="univ-btn-export" id="lvp-btn-recalcular">↻ Recalcular</button>
      </div>
      <div id="lvp-content"></div>
    `;

    const renderConteudo = () => {
      const mount = container.querySelector('#lvp-content');
      if (!mount) return;
      if (UI.subLevPerfis === 'planificador') {
        renderPlanificadorContent(mount, calc, versao);
      } else {
        renderCortesPorItemContent(mount, calc);
      }
    };
    renderConteudo();

    // Sub-abas
    container.querySelectorAll('.lvp-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.subLevPerfis = btn.dataset.subtab;
        container.querySelectorAll('.lvp-subtab').forEach(b => b.classList.toggle('is-active', b.dataset.subtab === UI.subLevPerfis));
        renderConteudo();
      });
    });

    // Felipe (sessao 2026-08): exportar a sub-aba ativa como PNG ou PDF
    container.querySelector('#lvp-btn-export-png')?.addEventListener('click', () => {
      const cliente = (lerLeadAtivo()?.cliente || 'cliente');
      const aba = UI.subLevPerfis === 'planificador' ? 'aproveitamento-barras' : 'cortes-por-item';
      const alvo = container.querySelector('#lvp-content');
      if (!alvo) return;
      // Da um id temporario pra exportar
      alvo.id = 'lvp-content-export';
      exportarRelatorioPNG('lvp-content-export', `LevPerfis_${aba}_${cliente}`);
      // Restaura id original (renderConteudo recria)
      setTimeout(() => { if (alvo) alvo.id = 'lvp-content'; }, 200);
    });
    container.querySelector('#lvp-btn-export-pdf')?.addEventListener('click', () => {
      const cliente = (lerLeadAtivo()?.cliente || 'cliente');
      const aba = UI.subLevPerfis === 'planificador' ? 'aproveitamento-barras' : 'cortes-por-item';
      const alvo = container.querySelector('#lvp-content');
      if (!alvo) return;
      alvo.id = 'lvp-content-export';
      exportarRelatorioPDF('lvp-content-export', `LevPerfis_${aba}_${cliente}`);
      setTimeout(() => { if (alvo) alvo.id = 'lvp-content'; }, 200);
    });

    // Recalcular — R13: avisa antes de descartar ajustes manuais
    container.querySelector('#lvp-btn-recalcular')?.addEventListener('click', () => {
      // Felipe (sessao 28 fix): se o usuario digitou em algum input
      // editavel e clicou DIRETO em Recalcular sem Tab/blur, o evento
      // change pode nao ter disparado. Forca capturar valores dos
      // inputs ANTES de qualquer logica.
      try {
        container.querySelectorAll('.lvp-edit-comp, .lvp-edit-qty').forEach(inp => {
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        });
      } catch (e) { /* nao bloqueia */ }

      const versaoAtual = versaoAtiva();
      let nManuais = 0, nExcluidas = 0, nOverrides = 0;
      if (versaoAtual) {
        const all = store.get('lev_ajustes') || {};
        const a = all[versaoAtual.id] || { extras: [], excluidas: [], overrides: {} };
        nManuais   = (a.extras    || []).length;
        nExcluidas = (a.excluidas || []).length;
        nOverrides = Object.keys(a.overrides || {}).length;
      }
      // Felipe (sessao 28 fix): considera tambem overrides na contagem
      // (antes so' contava extras+excluidas — overrides recalcular
      // descartava silenciosamente sem avisar).
      if (nManuais > 0 || nExcluidas > 0 || nOverrides > 0) {
        const partes = [];
        if (nManuais > 0)   partes.push(`${nManuais} linha${nManuais   > 1 ? 's' : ''} adicionada${nManuais   > 1 ? 's' : ''} manualmente`);
        if (nExcluidas > 0) partes.push(`${nExcluidas} linha${nExcluidas > 1 ? 's' : ''} excluida${nExcluidas > 1 ? 's' : ''} manualmente`);
        if (nOverrides > 0) partes.push(`${nOverrides} edicao${nOverrides > 1 ? 'oes' : ''} de Tamanho/Qtd`);
        const ok = confirm(
          `Voce tem ajustes manuais nesta versao (${partes.join(' e ')}).\n\n` +
          `Recalcular vai DESCARTAR todos esses ajustes e regenerar a tabela do zero.\n\n` +
          `Continuar?`
        );
        if (!ok) {
          // Felipe (sessao 28 fix): mesmo se NAO confirmar, re-renderiza
          // a aba pra refletir os ajustes que foram capturados pelo
          // dispatchEvent acima (caso o usuario tinha digitado mas o
          // change ainda nao tinha disparado).
          renderLevPerfisTab(container);
          return;
        }
        // Limpa ajustes desta versao
        if (versaoAtual) {
          const all = store.get('lev_ajustes') || {};
          delete all[versaoAtual.id];
          store.set('lev_ajustes', all);
        }
      }
      renderLevPerfisTab(container);  // re-renderiza tudo
    });

    // Felipe (do doc - msg wizard): "Proximo: Levantamento de Acessorios"
    adicionarBotaoWizard(container, 'lev-perfis');
  }

  /**
   * Sub-aba "Cortes por Item" — lista por item, cortes ordenados pela
   * sequencia que Felipe definiu (PA00F → TRAV → FRISO → CAVA → LAR/VED/CANAL → TRAVAMENTO).
   */
  function renderCortesPorItemContent(mount, calc) {
    const { blocosPorItem, perfisCadastro } = calc;
    const versao = versaoAtiva();

    // ============================================================
    // R13 — Ajustes manuais (linhas extras + linhas excluidas)
    // ============================================================
    // Persistencia: chave 'lev_ajustes' no scope 'orcamentos', mapeada
    // por id da versao. Estrutura por versao:
    //   { extras: [ {id, itemIdx, secao, codigo, descricao, comp, qty, kgM, barLen} ],
    //     excluidas: [ "key1", "key2", ... ],
    //     overrides: { "key1": { comp: number, qty: number }, ... } }
    // Onde key = `${itemIdx}|${codigo}|${descricao}`.
    //
    // Felipe (sessao 2026-06): "DEIXE CAMPO LARGURA ALTURA E QTD EDITAVEIS
    // SE EU ALTERAR CLARO PRECISO REALCULAR" — overrides permitem editar
    // os valores calculados pelas formulas inline na tabela. O Peso kg
    // e o Corte mm sao recalculados automaticamente. Botao Recalcular
    // descarta os overrides.
    function keyLinha(itemIdx, codigo, descricao) {
      return `${itemIdx}|${codigo}|${descricao}`;
    }
    function getAjustes() {
      if (!versao) return { extras: [], excluidas: [], overrides: {} };
      const all = store.get('lev_ajustes') || {};
      const a = all[versao.id] || { extras: [], excluidas: [], overrides: {} };
      // Garante estrutura
      a.extras    = Array.isArray(a.extras) ? a.extras : [];
      a.excluidas = Array.isArray(a.excluidas) ? a.excluidas : [];
      a.overrides = (a.overrides && typeof a.overrides === 'object') ? a.overrides : {};
      return a;
    }
    function setAjustes(a) {
      if (!versao) return;
      const all = store.get('lev_ajustes') || {};
      all[versao.id] = a;
      store.set('lev_ajustes', all);
    }
    function temAjustes() {
      const a = getAjustes();
      return (a.extras.length > 0)
          || (a.excluidas.length > 0)
          || (Object.keys(a.overrides || {}).length > 0);
    }
    function limparAjustes() {
      if (!versao) return;
      const all = store.get('lev_ajustes') || {};
      delete all[versao.id];
      store.set('lev_ajustes', all);
    }
    const ajustes = getAjustes();

    let kgLiqTotalGlobal = 0;
    let totalCortes = 0;
    blocosPorItem.forEach(b => {
      for (const codigo in b.cortes) {
        const cad = perfisCadastro[codigo] || {};
        b.cortes[codigo].forEach(c => {
          kgLiqTotalGlobal += (c.comp / 1000) * (cad.kgPorMetro || 0) * c.qty;
          totalCortes += c.qty;
        });
      }
    });

    function blocoItemHtml(b) {
      if (!b.temRegra) {
        const tipoLabel = labelTipo(b.item?.tipo) || 'item';
        const semDim = (!b.item?.largura || !b.item?.altura);
        // Detecta se o motor existe globalmente (se não, é cache antigo)
        const motorEsperado = b.item?.tipo === 'porta_externa' ? window.PerfisPortaExterna
                            : b.item?.tipo === 'porta_interna' ? window.PerfisPortaInterna
                            : b.item?.tipo === 'fixo_acoplado' ? window.PerfisRevAcoplado
                            : b.item?.tipo === 'revestimento_parede' ? window.PerfisRevParede
                            : b.item?.tipo === 'pergolado' ? window.PerfisPergolado
                            : null;
        const motorAusente = !!b.item?.tipo && !motorEsperado;
        // Felipe sessao 2026-05-10: caso especifico - fixo_acoplado SEM
        // estrutura nao gera perfis (so' chapas - decisao legitima do
        // user). Antes mostrava 'Motor de calculo nao foi implementado'
        // (mensagem ERRADA - o motor existe, so' nao tem perfis pra
        // gerar). Felipe reportou: 'Motor de calculo de Fixo Acoplado
        // ainda nao foi implementado' aparecia indevidamente.
        const ehFixoSemEstrutura = b.item?.tipo === 'fixo_acoplado' &&
                                   b.item?.temEstrutura === 'nao';
        let motivo, acaoExtra = '';
        if (semDim) {
          motivo = 'Largura e/ou altura nao foram preenchidas em "Caracteristicas do Item".';
        } else if (motorAusente) {
          motivo = `O motor de calculo nao foi carregado (provavelmente cache do navegador antigo). Recarregue a pagina.`;
          acaoExtra = `<button onclick="location.reload(true)" style="margin-top:10px;padding:8px 16px;background:#1a5276;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer">🔄 Recarregar agora</button>`;
        } else if (ehFixoSemEstrutura) {
          motivo = 'Sem estrutura de aluminio - o fixo sera produzido somente com chapas, sem perfis. As chapas aparecem em "Levantamento de Superficies".';
        } else {
          motivo = `Motor de calculo de "${tipoLabel}" ainda nao foi implementado.`;
        }
        return `
          <details class="lvp-item-bloco lvp-item-collapse" data-item-idx="${b.itemIdx}">
            <summary class="lvp-item-summary">
              <span class="lvp-item-summary-chevron">▶</span>
              <span class="lvp-item-num">ITEM ${b.itemIdx}</span>
              <span class="lvp-item-desc">${escapeHtml(b.descricao)}</span>
              <span class="lvp-item-summary-warn">⚠ vazio</span>
            </summary>
            <div class="lvp-item-vazio">
              ⚠ ${escapeHtml(motivo)}
              ${acaoExtra}
            </div>
          </details>`;
      }

      // Achata cortes em linhas e ORDENA pela sequencia Felipe
      const linhas = [];
      let pos = 0;
      for (const codigo in b.cortes) {
        b.cortes[codigo].forEach(c => {
          const cad = perfisCadastro[codigo] || {};
          const kgM = cad.kgPorMetro || 0;
          const linha = {
            codigo,
            descricao: c.label,
            comp: c.comp,
            qty: c.qty,
            kgM,
            pesoKg: (c.comp / 1000) * kgM * c.qty,
            barLen: window.PerfisCore.tamanhoBarraPorCodigo(codigo),
            temPintura: !!cad.precoKgPintura,
            ordem: ordemDoLabel(c.label),
            ehManual: false,
          };
          // Felipe sessao 31: motor pode declarar secao explicita ('portal'|'folha'|'fixo').
          // Quando declarada, vira forcaSecao (mesma semantica das linhas manuais).
          // Quando nao declarada, segue o classificador de label (ehLinhaPortal).
          if (c.secao) linha.forcaSecao = c.secao;
          linhas.push(linha);
        });
      }

      // R13 — injeta linhas extras manuais deste item, ja com peso calculado
      const extrasItem = ajustes.extras.filter(e => e.itemIdx === b.itemIdx);
      extrasItem.forEach(e => {
        const cad = perfisCadastro[e.codigo] || {};
        const kgM = Number(e.kgM) || cad.kgPorMetro || 0;
        const barLen = Number(e.barLen) || (window.PerfisCore.tamanhoBarraPorCodigo
          ? window.PerfisCore.tamanhoBarraPorCodigo(e.codigo) : 6000);
        // ordem por grupo: folha=998, portal=9999, fixo=99999 — sempre por
        // ultimo dentro de cada grupo, mas grupo Fixo aparece sempre depois.
        const ordemPorGrupo = e.secao === 'fixo' ? 99999 : (e.secao === 'portal' ? 9999 : 998);
        linhas.push({
          codigo: e.codigo,
          descricao: e.descricao,
          comp: Number(e.comp) || 0,
          qty: Number(e.qty) || 0,
          kgM,
          pesoKg: ((Number(e.comp) || 0) / 1000) * kgM * (Number(e.qty) || 0),
          barLen,
          temPintura: !!cad.precoKgPintura,
          ordem: ordemPorGrupo,
          ehManual: true,
          extraId: e.id,
          forcaSecao: e.secao,  // 'folha' | 'portal' | 'fixo'
        });
      });

      linhas.sort((a, b) => a.ordem - b.ordem);

      // R13 — filtra linhas excluidas (apenas linhas calculadas; manuais sao
      // removidas pelo proprio botao X delete)
      const excSet = new Set(ajustes.excluidas);
      const linhasVisiveis = linhas.filter(l => {
        if (l.ehManual) return true;  // manuais nunca sao "excluidas" (delete remove)
        return !excSet.has(keyLinha(b.itemIdx, l.codigo, l.descricao));
      });

      // Felipe (sessao 2026-06): aplica OVERRIDES de comp/qty editados
      // inline pelo usuario. Se a linha tem override, sobrescreve comp
      // e/ou qty e RECALCULA pesoKg = (comp/1000) * kgM * qty.
      // O override fica em ajustes.overrides[key] (key = itemIdx|codigo|descricao).
      // Manuais tambem podem ter override (mas geralmente o usuario edita
      // direto pelos inputs do form de extra).
      linhasVisiveis.forEach(l => {
        const k = keyLinha(b.itemIdx, l.codigo, l.descricao);
        const ov = ajustes.overrides[k];
        if (ov) {
          if (Number.isFinite(ov.comp) && ov.comp > 0) l.comp = ov.comp;
          if (Number.isFinite(ov.qty)  && ov.qty  > 0) l.qty  = ov.qty;
          // Recalcula peso com novos valores
          l.pesoKg = (Number(l.comp) / 1000) * (Number(l.kgM) || 0) * Number(l.qty);
          l.temOverride = true;  // pra mostrar visual diferente
        }
      });

      // Felipe: 3 grupos Folha / Portal / Fixo. Cada grupo tem subtotal kg
      // proprio + total geral = soma dos 3. O motor das fórmulas só gera
      // linhas pra Folha e Portal por enquanto. Fixo aceita só linhas
      // manuais (forcaSecao === 'fixo') — quando Felipe definir as fórmulas
      // do fixo, o motor passa a popular automaticamente.
      const linhasFolha  = linhasVisiveis
        .filter(l => l.forcaSecao ? l.forcaSecao === 'folha' : !ehLinhaPortal(l.descricao))
        .map((l, i) => ({ ...l, pos: i + 1 }));
      const linhasPortal = linhasVisiveis
        .filter(l => l.forcaSecao ? l.forcaSecao === 'portal' : ehLinhaPortal(l.descricao))
        .map((l, i) => ({ ...l, pos: linhasFolha.length + i + 1 }));
      const linhasFixo   = linhasVisiveis
        .filter(l => l.forcaSecao === 'fixo')
        .map((l, i) => ({ ...l, pos: linhasFolha.length + linhasPortal.length + i + 1 }));
      const subtFolha  = linhasFolha.reduce((s, l) => s + l.pesoKg, 0);
      const subtPortal = linhasPortal.reduce((s, l) => s + l.pesoKg, 0);
      const subtFixo   = linhasFixo.reduce((s, l) => s + l.pesoKg, 0);
      const totalKgGrupos = subtFolha + subtPortal + subtFixo;

      // Felipe (sessao 2026-05-10): linha "+" inline no FIM de cada
      // secao (Folha/Portal/Fixo). Substitui o popup de 4 prompts
      // anterior.
      //
      // Felipe (sessao 2026-05-10 - iter 2): "faca igual os existentes
      // codigo, descricao, ou eu escolho codigo e puxa descricao, ou
      // escolho descricao e puxa codigo, tamanho da barra, tamanho
      // corte, qt, kg por mt, tudo todas as colunas".
      //
      // Linha agora tem TODAS as 9 colunas:
      //   Pos.  Codigo  Descricao  L/H  Tamanho  Qtd  kg/m  Peso kg  Obs
      // Inputs editaveis: Codigo (com datalist), Descricao (com datalist),
      // Tamanho, Qtd. Demais sao read-only (auto-calculados).
      //
      // Busca bidirecional:
      //   - Escolhe codigo -> descricao + kg/m + barra auto
      //   - Escolhe descricao -> codigo + kg/m + barra auto
      //   - Datalist do codigo lista "CODIGO" (visualmente)
      //   - Datalist da descricao lista "DESCRICAO" (visualmente)
      // O matching e' por valor EXATO em ambos casos.
      //
      // Schema preservado (lev_ajustes.extras): {id, itemIdx, secao,
      // codigo, descricao, comp, qty, kgM, barLen}.
      function linhaAddInline(itemIdx, secao, secaoLabel) {
        const dlistCodId = `lvp-perfis-dlist-cod-${itemIdx}-${secao}`;
        const dlistDescId = `lvp-perfis-dlist-desc-${itemIdx}-${secao}`;
        return `
          <tr class="lvp-row-add-inline" data-item-idx="${itemIdx}" data-secao="${secao}">
            <td class="lvp-pos">＋</td>
            <td class="lvp-cod">
              <input type="text" list="${dlistCodId}"
                     class="lvp-add-codigo"
                     data-item-idx="${itemIdx}" data-secao="${secao}"
                     placeholder="Codigo..." />
              <datalist id="${dlistCodId}"></datalist>
            </td>
            <td>
              <input type="text" list="${dlistDescId}"
                     class="lvp-add-descricao"
                     data-item-idx="${itemIdx}" data-secao="${secao}"
                     placeholder="Descricao..." />
              <datalist id="${dlistDescId}"></datalist>
            </td>
            <td class="lvp-add-lh-cell">—</td>
            <td class="num">
              <input type="number" min="1" step="1"
                     class="lvp-add-tamanho"
                     data-item-idx="${itemIdx}" data-secao="${secao}"
                     placeholder="mm" />
            </td>
            <td class="num">
              <input type="number" min="1" step="1"
                     class="lvp-add-qtd"
                     data-item-idx="${itemIdx}" data-secao="${secao}"
                     placeholder="qtd" />
            </td>
            <td class="num lvp-add-kgm-cell">—</td>
            <td class="num lvp-add-pesokg-cell">—</td>
            <td class="lvp-obs">
              <button type="button" class="lvp-btn-add-confirm"
                      data-item-idx="${itemIdx}" data-secao="${secao}"
                      title="Adicionar linha em ${escapeHtml(secaoLabel)}">+ Adicionar</button>
            </td>
          </tr>`;
      }

      function rowHtml(l) {
        const dataAttr = l.ehManual
          ? `data-manual="1" data-extra-id="${escapeHtml(l.extraId)}"`
          : `data-key="${escapeHtml(keyLinha(b.itemIdx, l.codigo, l.descricao))}"`;
        const manualBadge = l.ehManual ? '<span class="lvp-manual-tag">manual</span>' : '';
        const ovBadge = l.temOverride ? '<span class="lvp-override-tag" title="Valor editado manualmente — clique em Recalcular pra restaurar o calculado">edit</span>' : '';
        const compVal = Math.round(Number(l.comp) || 0);
        const qtyVal  = Number(l.qty) || 0;
        // Felipe (sessao 2026-06): Tamanho e Qtd editaveis inline.
        // Inputs minusculos pra nao alargar a tabela. Salva em
        // ajustes.overrides no change. R01 — sem casas decimais
        // pra esses (mm e unidades inteiras).
        // Felipe (sessao 30): coluna "Corte mm" REMOVIDA DEFINITIVAMENTE.
        // Felipe ja' pediu pra tirar varias vezes — nunca mais voltar.
        return `
          <tr ${dataAttr}>
            <td class="lvp-pos">${l.pos}</td>
            <td class="lvp-cod">${escapeHtml(l.codigo)}</td>
            <td>${escapeHtml(l.descricao)} ${manualBadge}${ovBadge}</td>
            <td>${l.barLen / 1000}M</td>
            <td class="num">
              <input type="number" min="1" step="1"
                     class="lvp-edit lvp-edit-comp ${l.temOverride ? 'is-override' : ''}"
                     data-edit-comp data-item-idx="${b.itemIdx}"
                     data-codigo="${escapeHtml(l.codigo)}"
                     data-descricao="${escapeHtml(l.descricao)}"
                     value="${compVal}" />
            </td>
            <td class="num">
              <input type="number" min="1" step="1"
                     class="lvp-edit lvp-edit-qty ${l.temOverride ? 'is-override' : ''}"
                     data-edit-qty data-item-idx="${b.itemIdx}"
                     data-codigo="${escapeHtml(l.codigo)}"
                     data-descricao="${escapeHtml(l.descricao)}"
                     value="${qtyVal}" />
            </td>
            <td class="num">${escapeHtml(fmtBR(l.kgM))}</td>
            <td class="num">${escapeHtml(fmtBR(l.pesoKg))}</td>
            <td class="lvp-obs ${l.temPintura ? 'lvp-bnf' : 'lvp-bruto'}">
              ${l.temPintura ? 'BNF-TECNO' : 'BRUTO'}
              <button type="button" class="lvp-row-delete" title="Excluir linha">×</button>
            </td>
          </tr>`;
      }

      // Felipe sessao 12: 'fava a mesma coisa de setas para ocultar e
      // expandir nos perfis'. Cada bloco de item agora e' details colapsavel.
      // Por padrao FECHADO. Summary mostra item + descricao + total kg/peso.
      return `
        <details class="lvp-item-bloco lvp-item-collapse" data-item-idx="${b.itemIdx}">
          <summary class="lvp-item-summary">
            <span class="lvp-item-summary-chevron">▶</span>
            <span class="lvp-item-num">ITEM ${b.itemIdx}</span>
            <span class="lvp-item-desc">${escapeHtml(b.descricao)}</span>
            <span class="lvp-item-summary-total">${fmtBR(totalKgGrupos)} kg</span>
          </summary>
          <div class="lvp-item-collapse-body">
          <table class="lvp-table">
            <thead>
              <!-- ============================================================
                   PROMESSA AO FELIPE (sessao 30): NUNCA MAIS adicionar
                   coluna "Corte mm" / "KERF" aqui. Felipe pediu pra tirar
                   varias vezes, sempre voltava — agora ela some PRA SEMPRE.
                   Se vc esta lendo isso e pensando em adicionar uma coluna
                   de KERF/corte, NAO ADICIONE. KERF eh interno (motor), nao
                   exposto pro usuario.
                   ============================================================ -->
              <tr>
                <th>Pos.</th>
                <th>Codigo</th>
                <th>Descricao</th>
                <th>L/H</th>
                <th class="num">Tamanho</th>
                <th class="num">Qtd</th>
                <th class="num">kg/m</th>
                <th class="num">Peso kg</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              <!-- Felipe (sessao 30): label do bloco e' dinamico baseado no tipo
                   do item. Pra fixo_acoplado, mostra "FIXO SUPERIOR" ou "FIXO
                   LATERAL" conforme item.posicao (em vez de "FOLHA"). -->
              ${(() => {
                const ehFixo = b.item && b.item.tipo === 'fixo_acoplado';
                const labelGrupo = ehFixo
                  ? `FIXO ${b.item.posicao === 'lateral' ? 'LATERAL' : 'SUPERIOR'}`
                  : 'FOLHA';
                // Felipe (sessao 2026-05-10): linha inline "+" em cada
                // secao (Folha/Portal/Fixo). Substitui o popup de 4
                // prompts. Mantida estrutura .lvp-row-add reutilizavel
                // pras 3 secoes - so' muda data-secao.
                const secaoFolhaId = ehFixo ? 'folha' : 'folha';
                return `
                  <tr class="lvp-grupo"><td colspan="10">${labelGrupo} — Perfis de Corte</td></tr>
                  ${linhasFolha.map(rowHtml).join('')}
                  ${linhaAddInline(b.itemIdx, secaoFolhaId, labelGrupo)}
                  <tr class="lvp-subtotal"><td colspan="8">SUBTOTAL ${labelGrupo} — Peso Liquido</td><td class="num">${fmtBR(subtFolha)}</td><td></td></tr>
                `;
              })()}
              ${linhasPortal.length ? `
                <tr class="lvp-grupo"><td colspan="10">PORTAL — Perfis de Corte</td></tr>
                ${linhasPortal.map(rowHtml).join('')}
                ${linhaAddInline(b.itemIdx, 'portal', 'Portal')}
                <tr class="lvp-subtotal"><td colspan="8">SUBTOTAL PORTAL — Peso Liquido</td><td class="num">${fmtBR(subtPortal)}</td><td></td></tr>
              ` : `
                <tr class="lvp-grupo"><td colspan="10">PORTAL — Perfis de Corte</td></tr>
                ${linhaAddInline(b.itemIdx, 'portal', 'Portal')}
              `}
              ${linhasFixo.length ? `
                <tr class="lvp-grupo"><td colspan="10">FIXO — Perfis de Corte</td></tr>
                ${linhasFixo.map(rowHtml).join('')}
                ${linhaAddInline(b.itemIdx, 'fixo', 'Fixo')}
                <tr class="lvp-subtotal"><td colspan="8">SUBTOTAL FIXO — Peso Liquido</td><td class="num">${fmtBR(subtFixo)}</td><td></td></tr>
              ` : `
                <tr class="lvp-grupo"><td colspan="10">FIXO — Perfis de Corte</td></tr>
                ${linhaAddInline(b.itemIdx, 'fixo', 'Fixo')}
              `}
              <tr class="lvp-total-grupos"><td colspan="8">TOTAL DO ITEM — Peso Liquido${(b.item && b.item.tipo === 'fixo_acoplado') ? '' : ' (Folha + Portal + Fixo)'}</td><td class="num">${fmtBR(totalKgGrupos)}</td><td></td></tr>
            </tbody>
          </table>
          </div>
        </details>`;
    }

    mount.innerHTML = `
      <div class="lvp-wrap">
        <div class="lvp-header">
          <div class="lvp-header-titulo">
            <div class="lvp-header-empresa">Projetta Portas Exclusivas</div>
            <div class="lvp-header-sub">Ordem de Servico — Corte de Perfis de Aluminio (por item)</div>
          </div>
          <div class="lvp-header-os">
            <div class="lvp-os-num">OS-${(versao?.id || '').slice(-12)}</div>
            <div class="lvp-os-data">${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <div class="lvp-summary">
          <div class="lvp-summary-cell">
            <span class="lvp-summary-lbl">Itens</span>
            <span class="lvp-summary-val">${blocosPorItem.length}</span>
          </div>
          <div class="lvp-summary-cell">
            <span class="lvp-summary-lbl">Cortes Totais</span>
            <span class="lvp-summary-val">${totalCortes}</span>
          </div>
          <div class="lvp-summary-cell">
            <span class="lvp-summary-lbl">Kg Liquido Total</span>
            <span class="lvp-summary-val">${fmtBR(kgLiqTotalGlobal)}</span>
          </div>
        </div>

        ${blocosPorItem.length >= 2 ? `
        <div class="orc-item-toolbar">
          <button type="button" class="btn-secondary" data-act="lvp-expand-all">▼ Expandir todos</button>
          <button type="button" class="btn-secondary" data-act="lvp-collapse-all">▶ Recolher todos</button>
        </div>` : ''}

        ${blocosPorItem.map(blocoItemHtml).join('')}
      </div>
    `;

    // Felipe sessao 12: botoes expandir/recolher todos os items na Lev. Perfis.
    const btnLvpExpandAll = mount.querySelector('[data-act="lvp-expand-all"]');
    if (btnLvpExpandAll) {
      btnLvpExpandAll.addEventListener('click', () => {
        mount.querySelectorAll('details.lvp-item-collapse').forEach(d => d.open = true);
      });
    }
    const btnLvpCollapseAll = mount.querySelector('[data-act="lvp-collapse-all"]');
    if (btnLvpCollapseAll) {
      btnLvpCollapseAll.addEventListener('click', () => {
        mount.querySelectorAll('details.lvp-item-collapse').forEach(d => d.open = false);
      });
    }

    // R12 + R14 + R18: aplica sort por header + filtro com autocomplete em
    // cada .lvp-table renderizada. Linhas de grupo/subtotal (com colspan)
    // sao puladas automaticamente pelo helper.
    if (window.Universal && typeof window.Universal.autoEnhance === 'function') {
      mount.querySelectorAll('.lvp-table').forEach(tbl => {
        try { window.Universal.autoEnhance(tbl); }
        catch (e) { console.warn('[lev-perfis] autoEnhance falhou:', e); }
      });
    }

    // R13 — bind: excluir linha (X overlay)
    mount.querySelectorAll('.lvp-row-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tr = btn.closest('tr');
        if (!tr) return;
        const a = getAjustes();
        if (tr.dataset.manual === '1') {
          // Linha extra manual: remove do array de extras
          const id = tr.dataset.extraId;
          a.extras = a.extras.filter(x => x.id !== id);
        } else {
          // Linha calculada: marca como excluida
          const key = tr.dataset.key;
          if (key && !a.excluidas.includes(key)) a.excluidas.push(key);
        }
        setAjustes(a);
        renderCortesPorItemContent(mount, calc);  // re-render desta sub-aba apenas
      });
    });

    // Felipe (sessao 2026-05-10): NOVO handler - linha "+" inline em
    // cada secao. Substitui o handler antigo dos botoes de popup
    // (4 prompts sequenciais).
    //
    // Felipe (sessao 2026-05-10 - iter 2): "faca igual os existentes
    // codigo, descricao, [...], tudo todas as colunas". Linha agora
    // tem todas as 9 colunas + busca bidirecional + auto-preencher.
    //
    // Fluxo:
    //   1. Popula datalists de codigo E descricao com lista do cadastro
    //   2. Lookup bidirecional:
    //      - Escolhe codigo -> preenche descricao + L/H + kg/m
    //      - Escolhe descricao -> preenche codigo + L/H + kg/m
    //   3. Recalcula Peso kg em tempo real (kg/m * comp/1000 * qty)
    //   4. Botao "+ Adicionar" valida e persiste em ajustes.extras
    //
    // Reutiliza o MESMO schema do popup antigo - retrocompat 100%.
    {
      // 1. Carrega cadastro de Perfis (62 perfis CEM Pro).
      let listaPerfis = [];
      try {
        if (window.Perfis && typeof window.Perfis.listar === 'function') {
          listaPerfis = window.Perfis.listar() || [];
        }
      } catch (e) {
        console.warn('[Lev. Perfis] Erro ao listar perfis cadastrados:', e);
      }
      // Ordena por codigo
      listaPerfis = listaPerfis.slice().sort((a, b) => {
        const cA = String(a.codigo || '').toUpperCase();
        const cB = String(b.codigo || '').toUpperCase();
        return cA.localeCompare(cB);
      });

      // 2. Popula AMBOS datalists (codigo e descricao) de cada linha.
      const optionsCodHtml = listaPerfis.map(p => {
        const cod = String(p.codigo || '').toUpperCase().trim();
        if (!cod) return '';
        return `<option value="${escapeHtml(cod)}"></option>`;
      }).filter(Boolean).join('');
      const optionsDescHtml = listaPerfis.map(p => {
        const desc = String(p.descricao || '').trim();
        if (!desc) return '';
        return `<option value="${escapeHtml(desc)}"></option>`;
      }).filter(Boolean).join('');
      mount.querySelectorAll('datalist[id^="lvp-perfis-dlist-cod-"]').forEach(dl => {
        dl.innerHTML = optionsCodHtml;
      });
      mount.querySelectorAll('datalist[id^="lvp-perfis-dlist-desc-"]').forEach(dl => {
        dl.innerHTML = optionsDescHtml;
      });

      // 3. Maps codigo->dados e descricao->dados pra lookup bidirecional.
      const perfilPorCodigo = {};
      const perfilPorDescricao = {};
      listaPerfis.forEach(p => {
        const cod = String(p.codigo || '').toUpperCase().trim();
        const desc = String(p.descricao || '').trim();
        const dados = {
          codigo: cod,
          descricao: desc,
          kg_m: Number(p.kg_m || p.kgPorMetro || 0),
          barra: Number(p.barra || 6),
        };
        if (cod) perfilPorCodigo[cod] = dados;
        if (desc) perfilPorDescricao[desc] = dados;
      });

      // 4. Helper: atualiza cells read-only (L/H, kg/m, Peso kg) na linha.
      function atualizarCellsReadOnly(tr) {
        const inputCod = tr.querySelector('.lvp-add-codigo');
        const inputDesc = tr.querySelector('.lvp-add-descricao');
        const inputTam = tr.querySelector('.lvp-add-tamanho');
        const inputQtd = tr.querySelector('.lvp-add-qtd');
        const cellLH = tr.querySelector('.lvp-add-lh-cell');
        const cellKgM = tr.querySelector('.lvp-add-kgm-cell');
        const cellPeso = tr.querySelector('.lvp-add-pesokg-cell');

        // Resolve perfil via codigo OU descricao (codigo tem prioridade)
        const codigoTxt = (inputCod?.value || '').trim().toUpperCase();
        const descricaoTxt = (inputDesc?.value || '').trim();
        let perfil = perfilPorCodigo[codigoTxt];
        if (!perfil && descricaoTxt) {
          perfil = perfilPorDescricao[descricaoTxt];
        }
        if (perfil) {
          // L/H (barra em metros)
          if (cellLH) cellLH.textContent = (perfil.barra || 6) + 'M';
          // kg/m
          if (cellKgM) cellKgM.textContent = fmtBR(perfil.kg_m || 0);
          // Peso kg = kgM * comp(mm)/1000 * qty
          const comp = parseFloat(String(inputTam?.value || '').replace(',', '.')) || 0;
          const qty  = parseInt(inputQtd?.value || '0', 10) || 0;
          const peso = (perfil.kg_m || 0) * (comp / 1000) * qty;
          if (cellPeso) cellPeso.textContent = peso > 0 ? fmtBR(peso) : '—';
        } else {
          if (cellLH) cellLH.textContent = '—';
          if (cellKgM) cellKgM.textContent = '—';
          if (cellPeso) cellPeso.textContent = '—';
        }
      }

      // 5. Bind: quando escolhe CODIGO via datalist, preenche descricao.
      mount.querySelectorAll('.lvp-add-codigo').forEach(inp => {
        inp.addEventListener('input', () => {
          const codTxt = (inp.value || '').trim().toUpperCase();
          const perfil = perfilPorCodigo[codTxt];
          const tr = inp.closest('tr.lvp-row-add-inline');
          if (!tr) return;
          if (perfil) {
            // Preenche descricao auto se for diferente
            const inputDesc = tr.querySelector('.lvp-add-descricao');
            if (inputDesc && inputDesc.value !== perfil.descricao) {
              inputDesc.value = perfil.descricao;
            }
          }
          atualizarCellsReadOnly(tr);
        });
      });

      // 6. Bind: quando escolhe DESCRICAO via datalist, preenche codigo.
      mount.querySelectorAll('.lvp-add-descricao').forEach(inp => {
        inp.addEventListener('input', () => {
          const descTxt = (inp.value || '').trim();
          const perfil = perfilPorDescricao[descTxt];
          const tr = inp.closest('tr.lvp-row-add-inline');
          if (!tr) return;
          if (perfil) {
            const inputCod = tr.querySelector('.lvp-add-codigo');
            if (inputCod && inputCod.value !== perfil.codigo) {
              inputCod.value = perfil.codigo;
            }
          }
          atualizarCellsReadOnly(tr);
        });
      });

      // 7. Bind: tamanho/qtd recalculam Peso kg em tempo real.
      mount.querySelectorAll('.lvp-add-tamanho, .lvp-add-qtd').forEach(inp => {
        inp.addEventListener('input', () => {
          const tr = inp.closest('tr.lvp-row-add-inline');
          if (tr) atualizarCellsReadOnly(tr);
        });
      });

      // 8. Bind: botao confirmar persiste a linha em ajustes.extras.
      mount.querySelectorAll('.lvp-btn-add-confirm').forEach(btn => {
        btn.addEventListener('click', () => {
          const tr = btn.closest('tr.lvp-row-add-inline');
          if (!tr) return;
          const itemIdx = parseInt(tr.dataset.itemIdx || '0', 10);
          const secao   = tr.dataset.secao || 'folha';
          if (!itemIdx) return;

          const inputCod = tr.querySelector('.lvp-add-codigo');
          const inputDesc = tr.querySelector('.lvp-add-descricao');
          const inputTam = tr.querySelector('.lvp-add-tamanho');
          const inputQtd = tr.querySelector('.lvp-add-qtd');
          const codigoRaw = (inputCod?.value || '').trim().toUpperCase();
          const descricaoRaw = (inputDesc?.value || '').trim();
          const tamanhoRaw = String(inputTam?.value || '').replace(',', '.');
          const qtdRaw    = String(inputQtd?.value || '');

          // Resolve perfil. Codigo tem prioridade; senao tenta descricao.
          const perfil = perfilPorCodigo[codigoRaw] || perfilPorDescricao[descricaoRaw] || null;

          // Validacoes (silenciosas via focus - sem alert popup).
          // Precisa ter (codigo OU descricao) + tamanho + qtd.
          if (!codigoRaw && !descricaoRaw) { inputCod?.focus(); return; }
          const tamanho = parseFloat(tamanhoRaw);
          if (!tamanho || tamanho <= 0) { inputTam?.focus(); return; }
          const qty = parseInt(qtdRaw, 10);
          if (!qty || qty <= 0) { inputQtd?.focus(); return; }

          // Se nao casou com cadastro, usa o que o user digitou.
          const codigoFinal = perfil ? perfil.codigo : (codigoRaw || descricaoRaw.toUpperCase());
          const descricaoFinal = perfil ? perfil.descricao : (descricaoRaw || codigoRaw);
          const kgM    = perfil ? perfil.kg_m : 0;
          const barLen = perfil ? Math.round(perfil.barra * 1000) : 6000;

          const a = getAjustes();
          a.extras.push({
            id: 'ext_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            itemIdx, secao,
            codigo: codigoFinal,
            descricao: descricaoFinal,
            comp: Math.round(tamanho),
            qty,
            kgM, barLen,
          });
          setAjustes(a);
          renderCortesPorItemContent(mount, calc);
        });
      });

      // 9. Bind: Enter em qualquer input dispara o confirm da mesma linha.
      mount.querySelectorAll('.lvp-row-add-inline input').forEach(inp => {
        inp.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            const tr = inp.closest('tr.lvp-row-add-inline');
            const btn = tr?.querySelector('.lvp-btn-add-confirm');
            if (btn) btn.click();
          }
        });
      });
    }

    // Expoe helpers no scope da aba pra que o handler de Recalcular consiga
    // verificar/limpar ajustes antes de recalcular.
    mount._levAjustes = { temAjustes, limparAjustes };

    // Felipe (sessao 2026-06): handlers dos inputs editaveis de Tamanho
    // e Qtd. No change, salva override em ajustes.overrides[key] e
    // re-renderiza pra mostrar o novo Peso kg recalculado.
    // Felipe (sessao 28 fix CRITICO):
    //   1. 'window.store' nao existe (era const local) — corrigido em
    //      recalcularPerfisESalvarNoFab.
    //   2. Re-render aba inteira pra cards atualizarem.
    //   3. Bind 'change' E 'blur' pra cobrir cenarios onde change nao
    //      dispara (ex: usuario digita e clica direto em outro botao).
    //   4. Debounce no 'input' tambem cobre uso do spinner numerico.
    function bindEditInput(inp) {
      if (inp._lvpBound) return;  // evita bind duplicado
      inp._lvpBound = true;
      let pendingTimer = null;
      const aplicarMudanca = () => {
        const itemIdx = parseInt(inp.dataset.itemIdx, 10);
        const codigo = inp.dataset.codigo;
        const descricao = inp.dataset.descricao;
        if (!itemIdx || !codigo || descricao == null) return;
        const k = `${itemIdx}|${codigo}|${descricao}`;
        const valor = parseFloat(String(inp.value || '').replace(',', '.'));
        if (!Number.isFinite(valor) || valor <= 0) {
          alert('Valor invalido. Use um numero maior que zero.');
          renderCortesPorItemContent(mount, calc);
          return;
        }
        const a = getAjustes();
        if (!a.overrides[k]) a.overrides[k] = {};
        if (inp.classList.contains('lvp-edit-comp')) {
          a.overrides[k].comp = Math.round(valor);
        } else if (inp.classList.contains('lvp-edit-qty')) {
          a.overrides[k].qty = Math.max(1, Math.round(valor));
        }
        setAjustes(a);
        // console.log debug visivel pro Felipe ver no DevTools se precisar
        try { console.log('[LevPerfis] override aplicado', k, a.overrides[k]); } catch (e) {}
        // Re-render ABA INTEIRA pra cards atualizarem.
        const containerRaiz = mount.parentElement;
        if (containerRaiz && typeof renderLevPerfisTab === 'function') {
          renderLevPerfisTab(containerRaiz);
        } else {
          renderCortesPorItemContent(mount, calc);
        }
      };
      // change: dispara quando perde foco com valor diferente
      inp.addEventListener('change', aplicarMudanca);
      // blur: garante que aplica mesmo se change nao disparar (alguns navegadores)
      inp.addEventListener('blur', () => {
        // Pequeno delay pra change disparar primeiro se for o caso
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => {
          // Se o valor mudou em relacao ao salvo, aplica
          const itemIdx = parseInt(inp.dataset.itemIdx, 10);
          const codigo = inp.dataset.codigo;
          const descricao = inp.dataset.descricao;
          if (!itemIdx || !codigo || descricao == null) return;
          const k = `${itemIdx}|${codigo}|${descricao}`;
          const a = getAjustes();
          const ov = a.overrides[k] || {};
          const valor = parseFloat(String(inp.value || '').replace(',', '.'));
          if (!Number.isFinite(valor) || valor <= 0) return;
          const valorAtual = inp.classList.contains('lvp-edit-comp')
            ? Math.round(valor) : Math.max(1, Math.round(valor));
          const valorSalvo = inp.classList.contains('lvp-edit-comp') ? ov.comp : ov.qty;
          if (valorAtual !== valorSalvo) {
            aplicarMudanca();
          }
        }, 50);
      });
    }
    mount.querySelectorAll('.lvp-edit-comp, .lvp-edit-qty').forEach(bindEditInput);
  }
  function construirCadastroPerfis() {
    // Felipe (R-inegociavel): preco do kg e da pintura SEMPRE puxa
    // da aba Cadastro > Perfis. SEM fallback hardcoded. Se o cadastro
    // tem zero ou o codigo nao existe, retorna zero. Isso garante
    // que "tudo puxa de um lugar so".
    //
    // Estrutura real do cadastro de Perfis (20-perfis.js):
    //   - Cada perfil tem: codigo, kg_m, fornecedor, tratamento, barra
    //   - Os PRECOS sao globais por fornecedor: state.params[fornecedor].rs_kg
    //   - Pintura: state.params.pintura.rs_kg (somado quando tratamento='Pintura')
    const cadastro = {};
    let params = {};
    if (window.Perfis && typeof window.Perfis.listar === 'function') {
      const lista = window.Perfis.listar() || [];
      params = (typeof window.Perfis.getParams === 'function') ? window.Perfis.getParams() : {};
      lista.forEach(p => {
        const cod = String(p.codigo || '').toUpperCase();
        const kgM = Number(p.kg_m || p.kgPorMetro || p.kg_por_metro || 0);
        // Determina fornecedor (default mercado para legados)
        const fornKey = String(p.fornecedor || 'mercado').toLowerCase();
        const forn = params[fornKey] || params.mercado || {};
        const precoKg = Number(forn.rs_kg || 0);
        // Tratamento: 'Pintura' (oficial) ou 'Pintado' (variacao histor.
        // do seed da porta interna) somam preco de pintura. 'Natural' nao.
        // Felipe sessao 31 fix: cadastro seed de porta interna (20-perfis.js
        // linha 596+) tinha "Pintado" enquanto a UI oferece "Pintura".
        // Comparacao strict "=== 'Pintura'" deixava esses perfis sempre
        // como BRUTO. Fix: normaliza e aceita ambos os formatos.
        const tratamento = p.tratamento || 'Pintura';
        const tratNorm   = String(tratamento).toLowerCase().trim();
        const aplicaPintura = (tratNorm === 'pintura' || tratNorm === 'pintado');
        const precoPintura = aplicaPintura ? Number((params.pintura || {}).rs_kg || 0) : 0;
        cadastro[cod] = {
          kgPorMetro:    kgM,
          precoPorKg:    precoKg,
          precoKgPintura: precoPintura,
        };
      });
    }
    // Felipe (sessao 2026-05): index normalizado pra match defensivo —
    // ignora diferenca de hifen vs espaco e variacoes de caixa.
    // Exemplo: motor pede 'PA-CANT-30X30X2.0' e cadastro tem
    // 'PA-CANT 30X30X2.0' → match. Mantem comportamento exato como
    // primeira tentativa (preserva precisao quando codigos batem).
    const cadastroNormalizado = {};
    function _normalizarCodigo(c) {
      return String(c || '').toUpperCase().replace(/\s+/g, '').replace(/-+/g, '-');
    }
    Object.keys(cadastro).forEach(k => {
      cadastroNormalizado[_normalizarCodigo(k)] = cadastro[k];
    });

    // Felipe (sessao 2026-05): registra codigos pedidos pelo motor que
    // NAO existem no cadastro. Usado pra renderizar aviso visivel no
    // Lev. Perfis (em vez de calar zeros silenciosamente).
    const codigosFaltantes = new Set();

    function buscar(cod) {
      const codUp = String(cod || '').toUpperCase();
      if (cadastro[codUp]) return cadastro[codUp];
      // Codigos com sufixo -6M, -7M, -8M sao variantes do mesmo perfil base
      const semSufixo = codUp.replace(/-6M$|-7M$|-8M$/, '');
      if (cadastro[semSufixo]) return cadastro[semSufixo];
      // Felipe (sessao 2026-05): tenta match normalizado (hifen/espaco)
      const norm = _normalizarCodigo(codUp);
      if (cadastroNormalizado[norm]) return cadastroNormalizado[norm];
      const normSemSufixo = _normalizarCodigo(semSufixo);
      if (cadastroNormalizado[normSemSufixo]) return cadastroNormalizado[normSemSufixo];
      // Nao achou nem por fuzzy — registra falta pra UI avisar
      codigosFaltantes.add(codUp);
      return { kgPorMetro: 0, precoPorKg: 0, precoKgPintura: 0, _faltante: true };
    }
    const proxy = new Proxy(cadastro, {
      get(target, prop) {
        if (typeof prop !== 'string') return target[prop];
        if (prop === '_codigosFaltantes') return codigosFaltantes;
        return buscar(prop);
      }
    });
    return proxy;
  }

  // ============================================================
  //                      ABA: PLANIFICADOR
  // ============================================================
  /**
   * Recebe TODOS os cortes de TODOS os itens (cada item passou pelo
   * seu motor proprio) e roda o FFD compartilhando barras entre itens
   * do mesmo codigo de perfil.
   *
   * Saida: kg liquido total, kg bruto total, total de barras, custo
   * (perfil + pintura) — esse e' o numero que vai pro DRE no campo
   * total_perfis (perfil) e total_pintura (pintura).
   */
  /** Sub-aba "Planificador (FFD)" — renderiza usando o `calc` ja pronto
   *  (vem do recalcularPerfisESalvarNoFab). O calc ja salvou totais no fab. */
  function renderPlanificadorContent(mount, calc, versao) {
    const { result, totalBarras, perda, aprovGeral, perfisCadastro, blocosPorItem } = calc;

    if (result.itens.length === 0) {
      mount.innerHTML = `
        <div class="placeholder">
          <div class="icon-big">🧩</div>
          <h3>Sem cortes pra planificar</h3>
          <p>Os itens cadastrados nao geraram cortes. Confira a aba "Caracteristicas do Item".</p>
        </div>`;
      return;
    }

    const relBarras = result.itens.map(it => ({
      codigo: it.codigo,
      qtd: it.nBars,
      barra: it.barLen,
      kgBruto: it.kgBruto,
      precoKg: (perfisCadastro[it.codigo] || {}).precoPorKg || 0,
      precoKgPintura: (perfisCadastro[it.codigo] || {}).precoKgPintura || 0,
      custoPerfil: it.custoPerfil,
      custoPintura: it.custoPintura,
    }));
    const grupoBnf   = relBarras.filter(r => r.precoKgPintura > 0);
    const grupoBruto = relBarras.filter(r => !r.precoKgPintura);

    function relRow(r, i) {
      return `
        <tr>
          <td>${i + 1}</td>
          <td class="lvp-cod">${escapeHtml(r.codigo)}</td>
          <td class="num">${r.qtd}</td>
          <td class="num">${r.barra}</td>
          <td class="num">${escapeHtml(fmtBR(r.kgBruto))}</td>
          <td class="num">R$ ${escapeHtml(fmtBR(r.precoKg))}</td>
          <td class="num">R$ ${escapeHtml(fmtBR(r.custoPerfil))}</td>
          <td class="lvp-rb-obs">${r.precoKgPintura > 0 ? `+ R$ ${fmtBR(r.precoKgPintura)}/kg pint.` : ''}</td>
        </tr>`;
    }
    const subtBnfKg  = grupoBnf.reduce((s, r) => s + r.kgBruto, 0);
    const subtBnfR$  = grupoBnf.reduce((s, r) => s + r.custoPerfil, 0);
    const subtBruKg  = grupoBruto.reduce((s, r) => s + r.kgBruto, 0);
    const subtBruR$  = grupoBruto.reduce((s, r) => s + r.custoPerfil, 0);
    // Felipe sessao 14: separa pintura do subtotal de perfis e mostra
    // "Total Perfis" + "Pintura" + "Subtotal Geral".
    const subtPinturaKg = subtBnfKg;                                      // pintura aplica so' nos BNF
    const subtPinturaR$ = grupoBnf.reduce((s, r) => s + (r.custoPintura || 0), 0);
    const totalPerfisKg = subtBnfKg + subtBruKg;
    const totalPerfisR$ = subtBnfR$ + subtBruR$;
    const subtotalGeralKg = totalPerfisKg;                                // pintura nao adiciona peso
    const subtotalGeralR$ = totalPerfisR$ + subtPinturaR$;

    // Felipe (do doc - msg "Aproveitamento de Barras nao tem cabecalho, todo
    // item exportavel deve conter cabecalho"): adiciona cabecalho da empresa
    // + banner com caracteristicas do item antes do conteudo do planificador.
    const leadPl = lerLeadAtivo() || {};
    const versaoAtual = versaoAtiva();
    const opcaoAtual = obterVersao(UI.versaoAtivaId)?.opcao;
    const numDocPl = `${(opcaoAtual?.letra || 'A')} - ${versaoAtual?.numero || 1}`;
    const headerPlHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
      ? window.Empresa.montarHeaderRelatorio({
          lead: leadPl,
          tituloRelatorio: 'Planificador de Cortes / Aproveitamento de Barras',
          numeroDocumento: numDocPl,
          validade: 15,
        })
      : '';

    mount.innerHTML = `
      ${headerPlHtml}
      ${bannerCaracteristicasItens(versaoAtual)}
      <div class="lvp-wrap">
        <div class="lvp-header">
          <div class="lvp-header-titulo">
            <div class="lvp-header-empresa">APROVEITAMENTO DE BARRAS</div>
            <div class="lvp-header-sub">Bin packing FFD — barras compartilhadas entre todos os itens · Disco 4mm</div>
          </div>
          <div class="lvp-header-os">
            <div class="lvp-os-num">${blocosPorItem.length} itens · ${result.itens.length} codigos</div>
          </div>
        </div>

        <div class="lvp-cards">
          <div class="lvp-card">
            <div class="lvp-card-lbl">Kg Liquido</div>
            <div class="lvp-card-val">${fmtBR(result.kgLiqTotal)}</div>
            <div class="lvp-card-sub">peso real das pecas</div>
          </div>
          <div class="lvp-card lvp-card-destaque">
            <div class="lvp-card-lbl">Kg Bruto <span class="lvp-star">★</span></div>
            <div class="lvp-card-val">${fmtBR(result.kgBrutoTotal)}</div>
            <div class="lvp-card-sub">barras inteiras — base precificacao</div>
          </div>
          <div class="lvp-card">
            <div class="lvp-card-lbl">Aproveitamento</div>
            <div class="lvp-card-val lvp-card-aprov">${aprovGeral.toFixed(1)}%</div>
            <div class="lvp-card-sub">media geral das barras</div>
          </div>
          <div class="lvp-card">
            <div class="lvp-card-lbl">Total Barras</div>
            <div class="lvp-card-val">${totalBarras}</div>
            <div class="lvp-card-sub">pecas a comprar</div>
          </div>
          <div class="lvp-card">
            <div class="lvp-card-lbl">Perda</div>
            <div class="lvp-card-val lvp-card-perda">${fmtBR(perda)}</div>
            <div class="lvp-card-sub">kg de sobra de corte</div>
          </div>
        </div>

        <table class="lvp-rel-barras">
          <thead>
            <tr><th class="lvp-rel-titulo" colspan="8">Relacao de Barras — Total Geral (todos os itens)</th></tr>
            <tr>
              <th>PR</th><th>Perfil</th><th class="num">Qtde</th><th class="num">Barra</th>
              <th class="num">Peso Bruto (kg)</th><th class="num">R$/kg</th><th class="num">Custo R$</th><th>Observacao</th>
            </tr>
          </thead>
          <tbody>
            ${grupoBnf.length ? `<tr class="lvp-rb-grupo"><td colspan="8">BNF / PA-TECNOPERFIL</td></tr>` : ''}
            ${grupoBnf.map(relRow).join('')}
            ${grupoBnf.length ? `<tr class="lvp-rb-subtotal"><td colspan="4">Subtotal BNF/PA-TECNOPERFIL</td><td class="num">${fmtBR(subtBnfKg)}</td><td></td><td class="num">R$ ${fmtBR(subtBnfR$)}</td><td></td></tr>` : ''}
            ${grupoBruto.length ? `<tr class="lvp-rb-grupo"><td colspan="8">BRUTO</td></tr>` : ''}
            ${grupoBruto.map((r, i) => relRow(r, grupoBnf.length + i)).join('')}
            ${grupoBruto.length ? `<tr class="lvp-rb-subtotal"><td colspan="4">Subtotal BRUTO</td><td class="num">${fmtBR(subtBruKg)}</td><td></td><td class="num">R$ ${fmtBR(subtBruR$)}</td><td></td></tr>` : ''}
            <tr class="lvp-rb-subtotal lvp-rb-soma-perfis"><td colspan="4">Total Perfis (BNF + BRUTO)</td><td class="num">${fmtBR(totalPerfisKg)}</td><td></td><td class="num">R$ ${fmtBR(totalPerfisR$)}</td><td></td></tr>
            ${subtPinturaR$ > 0 ? `<tr class="lvp-rb-subtotal lvp-rb-pintura"><td colspan="4">+ Pintura (sobre ${fmtBR(subtPinturaKg)} kg BNF/Tecnoperfil)</td><td class="num"></td><td></td><td class="num">R$ ${fmtBR(subtPinturaR$)}</td><td></td></tr>` : ''}
            <tr class="lvp-rb-total-geral"><td colspan="4">SUBTOTAL GERAL (Perfis + Pintura)</td><td class="num">${fmtBR(subtotalGeralKg)}</td><td></td><td class="num">R$ ${fmtBR(subtotalGeralR$)}</td><td></td></tr>
          </tbody>
        </table>

        <div class="lvp-actions">
          <button type="button" class="univ-btn-export" id="lvp-btn-padroes">📊 Padroes de Cortes (FFD barra a barra)</button>
        </div>

        <div id="lvp-modal-mount"></div>
      </div>
    `;

    mount.querySelector('#lvp-btn-padroes')?.addEventListener('click', () => {
      const mountModal = mount.querySelector('#lvp-modal-mount');
      // Felipe (sessao 2026-05): passa lead + opcao + versao pro modal
      // poder montar o cabecalho padrao via Empresa.montarHeaderRelatorio.
      // Isso garante que o PDF exportado identifique o cliente.
      const ctxLead = (typeof lerLeadAtivo === 'function') ? (lerLeadAtivo() || {}) : {};
      const ctxOpcao  = obterVersao(UI.versaoAtivaId)?.opcao || null;
      const ctxVersao = obterVersao(UI.versaoAtivaId)?.versao || null;
      mountModal.innerHTML = renderModalPadroesCortes(result, { lead: ctxLead, opcao: ctxOpcao, versao: ctxVersao });
      mountModal.querySelector('#lvp-modal-close')?.addEventListener('click', () => { mountModal.innerHTML = ''; });
      mountModal.querySelector('#lvp-modal-pdf')?.addEventListener('click', exportarPadroesCortesPDF);
      mountModal.querySelector('.lvp-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('lvp-modal-overlay')) mountModal.innerHTML = '';
      });
    });
  }

  /** Modal "Padroes de Cortes" — agora usado pelo Planificador.
   *  Redesign estilo imagem 8 com cores Projetta:
   *  - Cabecalho azul escuro distinto (texto branco)
   *  - Tabela de cortes agregada acima das barras
   *  - Barras com fundo branco/cinza claro, segmentos azul escuro distintos
   *  - Cores Projetta: azul-escuro, branco, #E4E8EE, laranja em destaques.
   *
   *  Felipe (sessao 2026-05): aceita 2o argumento `ctx` opcional com
   *  { lead, opcao, versao } pra montar cabecalho padrao Projetta no
   *  PDF (identificacao do cliente). Se ctx.lead nao vier, omite o
   *  cabecalho — comportamento antigo preservado.
   */
  function renderModalPadroesCortes(result, ctx) {
    const KERF = (window.PerfisCore && window.PerfisCore.KERF) || 4;
    const blocosHtml = result.itens.map(it => {
      // Agrega TODOS os cortes do perfil (somando de todas as barras)
      // para montar a tabela de cortes (estilo imagem 8).
      const cortesAgreg = {};
      (it.bins || []).forEach(b => {
        b.cortes.forEach(c => {
          const k = `${c.comp}__${c.label || ''}`;
          if (!cortesAgreg[k]) {
            cortesAgreg[k] = { qtd: 0, comp: c.comp, label: c.label || '' };
          }
          cortesAgreg[k].qtd++;
        });
      });
      const cortesArr = Object.values(cortesAgreg).sort((a, b) => b.comp - a.comp);
      const qtdTotalCortes = cortesArr.reduce((s, c) => s + c.qtd, 0);

      const tabCortesHtml = `
        <table class="lvp-pad-tabela-cortes">
          <thead>
            <tr>
              <th class="num">Qtde</th>
              <th class="num">Tam (mm)</th>
              <th class="num">Corte</th>
              <th>Descricao</th>
            </tr>
          </thead>
          <tbody>
            ${cortesArr.map(c => `
              <tr>
                <td class="num"><b>${c.qtd}</b></td>
                <td class="num">${c.comp}</td>
                <td class="num">${KERF}/${KERF}</td>
                <td>${escapeHtml(c.label.toUpperCase())}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="lvp-pad-qtde-total"><b>${qtdTotalCortes}</b> &lt;&lt;&lt; Qtde total do item</div>
      `;

      const binsHtml = (it.bins || []).map((b, idx) => {
        const aprov = b.usado / it.barLen * 100;
        const cortesContagem = {};
        b.cortes.forEach(c => {
          const k = `${c.comp}_${c.label || ''}`;
          if (!cortesContagem[k]) cortesContagem[k] = { comp: c.comp, label: c.label, n: 0 };
          cortesContagem[k].n++;
        });
        const compostoCortes = Object.values(cortesContagem)
          .map(g => `${g.n}×${g.comp}`).join('  ');
        const visualCortes = b.cortes.map((c, i) => {
          const pct = (c.comp / it.barLen * 100).toFixed(2);
          // Alterna tons de azul para distinguir cortes adjacentes
          const tone = i % 2 === 0 ? 'is-tone-a' : 'is-tone-b';
          return `<div class="lvp-cut-segment ${tone}" style="width:${pct}%;" title="${escapeHtml(c.label || '')}">${c.comp}</div>`;
        }).join('');
        const sobraPct = ((it.barLen - b.usado) / it.barLen * 100).toFixed(2);
        const sobraMm = Math.round(it.barLen - b.usado);
        return `
          <div class="lvp-bin">
            <div class="lvp-bin-info-row">
              <span><b>Barra ${idx + 1}</b> | ${it.barLen}mm | Util: ${it.barLen}mm | ${it.bins.length} barras total</span>
              <span class="lvp-bin-aprov-text ${aprov >= 85 ? 'is-good' : aprov >= 75 ? 'is-mid' : 'is-low'}">Aprov: ${aprov.toFixed(0)}% | Sobra: ${sobraMm}mm</span>
            </div>
            <div class="lvp-bin-cortes-list">${compostoCortes}</div>
            <div class="lvp-bin-cortes">
              ${visualCortes}<div class="lvp-cut-sobra" style="width:${sobraPct}%;">${sobraMm}mm</div>
            </div>
            <div class="lvp-bin-sobra-row">
              <span></span>
              <span class="lvp-bin-sobra-text">Sobra: ${sobraMm}mm</span>
            </div>
          </div>`;
      }).join('');
      return `
        <div class="lvp-pad-bloco">
          <div class="lvp-pad-head">
            <div class="lvp-pad-head-left">
              <span class="lvp-cod-pill">${escapeHtml(it.codigo)}</span>
            </div>
            <div class="lvp-pad-head-mid">
              <span class="lvp-pad-bars-pill">${it.nBars} barras × ${it.barLen / 1000}m</span>
            </div>
            <div class="lvp-pad-head-right">
              Aproveitamento: <b>${it.aproveitamento.toFixed(1)}%</b>
            </div>
          </div>
          ${tabCortesHtml}
          ${binsHtml}
        </div>`;
    }).join('');

    // Felipe (sessao 2026-05): cabecalho padrao Projetta (logo + dados
    // empresa + cliente + AGP + reserva + cidade + representante).
    // So' renderiza se o ctx tiver lead — assim o modal continua
    // funcionando sem cabecalho em chamadas legadas.
    let headerPadCortesHtml = '';
    if (ctx && ctx.lead && window.Empresa && typeof window.Empresa.montarHeaderRelatorio === 'function') {
      const numDoc = ctx.opcao && ctx.versao
        ? `${(ctx.opcao.letra || 'A')} - ${ctx.versao.numero}`
        : '—';
      headerPadCortesHtml = window.Empresa.montarHeaderRelatorio({
        lead: ctx.lead,
        tituloRelatorio: 'Padroes de Cortes — Aproveitamento de Barras',
        numeroDocumento: numDoc,
        validade: 15,
      });
    }

    return `
      <div class="lvp-modal-overlay">
        <div class="lvp-modal">
          <div class="lvp-modal-head">
            <div>
              <div class="lvp-modal-titulo">Padroes de Cortes — Aproveitamento de Barras</div>
              <div class="lvp-modal-sub">Serra: ${KERF}mm/corte | Algoritmo: First Fit Decreasing (FFD)</div>
            </div>
            <div class="lvp-modal-actions">
              <button type="button" id="lvp-modal-pdf" class="lvp-modal-pdf-btn" title="Baixa um PDF direto, sem abrir tela de impressao">⬇ Exportar PDF</button>
              <button type="button" id="lvp-modal-close" class="lvp-modal-close-btn">× Fechar</button>
            </div>
          </div>
          <div class="lvp-modal-body" id="lvp-modal-body-print">
            ${headerPadCortesHtml}
            ${blocosHtml}
          </div>
        </div>
      </div>`;
  }

  // Felipe (R-pdf): exporta o conteudo do modal Padroes de Cortes
  // direto em PDF, sem abrir a caixa de dialogo de impressao do navegador.
  // Estrategia: lazy-load das libs jsPDF e html2canvas via CDN na primeira
  // chamada; renderiza o modal-body em canvas; fatia em paginas A4 e
  // dispara o download.
  function carregarLib(src) {
    return new Promise((resolve, reject) => {
      const existente = document.querySelector(`script[src="${src}"]`);
      if (existente) {
        if (existente.dataset.loaded === '1') return resolve();
        existente.addEventListener('load', () => resolve());
        existente.addEventListener('error', () => reject(new Error('Falha carregando ' + src)));
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload  = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('Falha carregando ' + src));
      document.head.appendChild(s);
    });
  }
  async function exportarPadroesCortesPDF() {
    const corpo = document.getElementById('lvp-modal-body-print');
    if (!corpo) return;
    const btn = document.getElementById('lvp-modal-pdf');
    const btnTextoOriginal = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Gerando...'; }

    // Felipe: PDF estava cortado porque #lvp-modal-body-print tem
    // overflow-y:auto e max-height. html2canvas so capturava a viewport
    // visivel do scroll. Solucao: clonar o conteudo num container
    // off-screen sem scroll/max-height, capturar dali, e remover.
    let cloneHost = null;
    try {
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const html2canvas = window.html2canvas;
      const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!html2canvas || !jsPDF) throw new Error('Libs nao disponiveis');

      // Clona o conteudo em um host off-screen com largura fixa do modal
      cloneHost = document.createElement('div');
      cloneHost.style.cssText = `
        position: absolute;
        top: 0;
        left: -10000px;
        width: 1200px;
        background: #ffffff;
        padding: 24px;
        z-index: -1;
      `;
      cloneHost.innerHTML = corpo.innerHTML;
      document.body.appendChild(cloneHost);

      // Captura o conteudo COMPLETO (sem scroll cropando)
      const canvas = await html2canvas(cloneHost, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth:  cloneHost.scrollWidth,
        windowHeight: cloneHost.scrollHeight,
      });

      // PDF A4 retrato (210x297 mm) com margem 10mm
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margem = 10;
      const larguraImg = pageW - 2 * margem;
      const alturaImg  = (canvas.height * larguraImg) / canvas.width;

      // Se cabe em uma pagina, adiciona direto
      if (alturaImg <= pageH - 2 * margem) {
        const dataUrl = canvas.toDataURL('image/png');
        pdf.addImage(dataUrl, 'PNG', margem, margem, larguraImg, alturaImg);
      } else {
        // Fatiar em multiplas paginas
        const escala = larguraImg / canvas.width;       // mm por pixel
        const sliceH = (pageH - 2 * margem) / escala;   // pixels por pagina
        let yPx = 0;
        let primeiraPag = true;
        while (yPx < canvas.height) {
          const alturaPx = Math.min(sliceH, canvas.height - yPx);
          const slice = document.createElement('canvas');
          slice.width  = canvas.width;
          slice.height = alturaPx;
          const ctx = slice.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, yPx, canvas.width, alturaPx, 0, 0, canvas.width, alturaPx);
          if (!primeiraPag) pdf.addPage();
          primeiraPag = false;
          pdf.addImage(slice.toDataURL('image/png'), 'PNG', margem, margem, larguraImg, alturaPx * escala);
          yPx += alturaPx;
        }
      }

      const dataStr = new Date().toISOString().slice(0, 10);
      pdf.save(`Padroes_de_Cortes_${dataStr}.pdf`);
    } catch (e) {
      console.error('[exportarPadroesCortesPDF]', e);
      alert('Nao foi possivel gerar o PDF: ' + (e.message || e));
    } finally {
      if (cloneHost && cloneHost.parentNode) cloneHost.parentNode.removeChild(cloneHost);
      if (btn) { btn.disabled = false; btn.innerHTML = btnTextoOriginal; }
    }
  }

  /**
   * Felipe (sessao 2026-07): "nao abra impressora sempre ao clicar
   * exporte direto para download" + "impresso PDF esta picado configure".
   *
   * Estrategia: igual a exportarPadroesCortesPDF, mas em vez de capturar
   * o conteudo todo num canvas unico, captura CADA .rel-prop-pagina
   * separadamente (cada uma vira 1 pagina A4 do PDF). Isso garante
   * quebras nos pontos certos (entre capa, paginas de itens, tabela
   * final, etc) — nao corta no meio de cards.
   *
   * Tambem clona pra container off-screen pra burlar overflow do
   * conteudo da aba.
   */
  /**
   * Felipe sessao 14: helper unificado pra montar PDF A4 a partir de N
   * elementos .rel-prop-pagina, EMPILHANDO capturas curtas na mesma pagina
   * fisica A4 do PDF em vez de gastar 1 pagina A4 cheia por elemento.
   *
   * Por que: ANTES cada .rel-prop-pagina era forcada com minHeight=1123px
   * antes da captura — daí mesmo um chunk com 1 card pequeno virava uma
   * pagina A4 inteira no PDF (~80% em branco). AGORA a captura usa altura
   * NATURAL do conteudo. As capturas que cabem juntas em 297mm sao
   * empilhadas na mesma pagina; quando estouram 297mm, addPage e reseta yPos.
   *
   * Usado em:
   *   - exportarPropostaPDF (botao "Exportar PDF" da aba Proposta Comercial)
   *   - gerarPropostaComercialPDFBlob (PDF anexo do email do representante)
   *
   * NAO mexe em: gerarRelatorioPNGBlob (4 PNGs internos do dossie),
   * gerarPropostaPDFBlob (dossie agregado), nem em outras geracoes que
   * tem 1 pagina so.
   *
   * @param {jsPDF} pdf - instancia ja inicializada (orientation portrait, A4)
   * @param {NodeList} paginas - elementos .rel-prop-pagina pra capturar
   * @param {function} html2canvas - referencia pra lib carregada
   * @param {Object} opts - { scale, formato='png'|'jpeg', qualidade, pageW, pageH }
   */
  async function _paginarCapturasPDFEmpilhadas(pdf, paginas, html2canvas, opts) {
    const scale = opts.scale || 2;
    const formato = (opts.formato || 'png').toLowerCase();
    const qualidade = opts.qualidade || 1.0;
    const pageW = opts.pageW;
    const pageH = opts.pageH;
    const mime = formato === 'jpeg' ? 'image/jpeg' : 'image/png';
    const tipo = formato === 'jpeg' ? 'JPEG' : 'PNG';

    // 1. Captura cada pagina com altura NATURAL (sem forcar minHeight)
    const capturas = [];
    for (let i = 0; i < paginas.length; i++) {
      const pag = paginas[i];
      pag.style.boxSizing = 'border-box';
      // IMPORTANTE: NAO setar pag.style.minHeight - quer altura real do conteudo
      const canvas = await html2canvas(pag, {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth:  pag.scrollWidth,
        windowHeight: pag.scrollHeight,
      });
      const larguraImg = pageW;
      const alturaImg = (canvas.height * larguraImg) / canvas.width;
      const dataUrl = formato === 'jpeg'
        ? canvas.toDataURL(mime, qualidade)
        : canvas.toDataURL(mime);
      capturas.push({ dataUrl, alturaImg });
    }

    // 2. Empilha capturas em paginas A4. jsPDF ja' tem 1 pagina criada na
    //    inicializacao - usa ela primeiro, addPage so' quando estoura ou
    //    quando captura nao cabe na pagina atual.
    let yPos = 0;
    let primeira = true;
    const epsilon = 0.1; // tolerancia mm pra arredondamento
    for (const cap of capturas) {
      if (cap.alturaImg > pageH + epsilon) {
        // Captura maior que A4 (raro — pagina HTML mt comprida): redimensiona
        // pra caber na altura, ocupa pagina propria
        if (!primeira) pdf.addPage();
        const ratio = pageH / cap.alturaImg;
        const novaLargura = pageW * ratio;
        const offsetX = (pageW - novaLargura) / 2;
        pdf.addImage(cap.dataUrl, tipo, offsetX, 0, novaLargura, pageH);
        yPos = pageH; // forca proxima a abrir nova pagina
        primeira = false;
      } else if (yPos + cap.alturaImg > pageH + epsilon) {
        // Nao cabe na pagina atual: nova pagina, captura no topo
        pdf.addPage();
        pdf.addImage(cap.dataUrl, tipo, 0, 0, pageW, cap.alturaImg);
        yPos = cap.alturaImg;
        primeira = false;
      } else {
        // Cabe na pagina atual: empilha em yPos
        pdf.addImage(cap.dataUrl, tipo, 0, yPos, pageW, cap.alturaImg);
        yPos += cap.alturaImg;
        primeira = false;
      }
    }
  }

  async function exportarPropostaPDF() {
    const folha = document.querySelector('.rel-prop-folha');
    if (!folha) {
      alert('Conteudo da proposta nao encontrado.');
      return;
    }
    const btn = document.getElementById('orc-prop-imprimir');
    const btnTextoOriginal = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Gerando...'; }

    let cloneHost = null;
    try {
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const html2canvas = window.html2canvas;
      const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!html2canvas || !jsPDF) throw new Error('Libs nao disponiveis');

      // Clona a folha inteira em host off-screen (sem overflow / sem
      // padding da aba) na largura exata de A4 a 96dpi (~ 794px).
      cloneHost = document.createElement('div');
      cloneHost.style.cssText = `
        position: absolute;
        top: 0;
        left: -10000px;
        width: 794px;
        background: #ffffff;
        z-index: -1;
      `;
      cloneHost.innerHTML = folha.outerHTML;
      document.body.appendChild(cloneHost);

      // Pega cada pagina individual do clone
      const paginas = cloneHost.querySelectorAll('.rel-prop-pagina');
      if (!paginas.length) throw new Error('Nenhuma .rel-prop-pagina encontrada');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();    // 210mm
      const pageH = pdf.internal.pageSize.getHeight();   // 297mm

      // Felipe sessao 14: ANTES forcava minHeight=1123px em cada .rel-prop-pagina,
      // resultando em cada captura ser uma pagina A4 inteira no PDF — mesmo que
      // o conteudo fosse pequeno (ex: chunk com 1 card sozinho). Isso gerava
      // espacos brancos enormes entre paginas. AGORA captura com altura natural
      // do conteudo e empilha capturas que cabem na mesma pagina A4 do PDF.
      await _paginarCapturasPDFEmpilhadas(pdf, paginas, html2canvas, {
        scale: 2, formato: 'png', pageW, pageH,
      });

      const dataStr = new Date().toISOString().slice(0, 10);
      const cliente = (document.querySelector('.rel-header-cliente-table td')?.textContent || 'cliente')
        .trim().replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
      pdf.save(`Proposta_${cliente}_${dataStr}.pdf`);
    } catch (e) {
      console.error('[exportarPropostaPDF]', e);
      alert('Nao foi possivel gerar o PDF: ' + (e.message || e));
    } finally {
      if (cloneHost && cloneHost.parentNode) cloneHost.parentNode.removeChild(cloneHost);
      if (btn) { btn.disabled = false; btn.innerHTML = btnTextoOriginal; }
    }
  }

  // ============================================================
  //                      OUTRAS ABAS (placeholder)
  // ============================================================
  // ============================================================
  //                  ABA: PROPOSTA COMERCIAL
  // ============================================================
  /**
   * Felipe (do doc): a aba Proposta Comercial deve trazer:
   *   - Cabecalho padrao (logo Projetta + dados empresa + cliente + AGP +
   *     endereco + vendedor) — via window.Empresa.montarHeaderRelatorio
   *   - Para cada item: imagem do modelo (do cadastro), todas as
   *     caracteristicas, banner com alertas (alisar sim/nao, fechadura,
   *     cilindro)
   *   - Tabela final: Item, Descricao, Medidas, Qtd, Valor un, Valor Total
   *   - Total Area, Total Orcamento, Observacoes, Condicoes, Assinaturas
   *
   * Esta versao implementa a estrutura completa baseada no PDF que o
   * Felipe enviou (Proposta_1777651977765.pdf).
   */
  function renderPropostaTab(container) {
    inicializarSessao();
    const versao = obterVersao(UI.versaoAtivaId).versao;

    // Bloqueio: mesma regra do DRE — itens completos + Fab/Inst com valor
    const motivoBloqueio = precisaCalcular(versao, 'dre');
    if (motivoBloqueio) {
      return renderPrecisaCalcular(container, versao, motivoBloqueio, 'Proposta Comercial');
    }

    const negocio = obterNegocio(UI.negocioAtivoId);
    const opcao   = obterVersao(UI.versaoAtivaId).opcao;
    const lead    = lerLeadAtivo() || {};
    const inst    = Object.assign({}, INST_DEFAULT, versao.custoInst || {});

    // Felipe sessao 31: detecta internacional e cria helper de traducao
    // pra renderizar a proposta em INGLES quando o destino e' internacional.
    // Helper tr(pt, en) retorna a string apropriada conforme bandeira.
    const internacional = lead.destinoTipo === 'internacional';
    const tr = (pt, en) => internacional ? en : pt;
    const taxa = (window.Cambio && window.Cambio.taxaAtual()) || 0;

    // Felipe (do doc - msg frete/inst): frase dinamica baseada no modo
    // de instalacao + valores manuais. Regras:
    //   modo 'projetta'                   → "Frete e instalacao inclusos"
    //   modo 'terceiros' | 'internacional' → depende dos valores:
    //     inst > 0, frete = 0  → "Instalacao inclusa, frete nao incluso"
    //     inst = 0, frete > 0  → "Frete incluso, instalacao nao inclusa"
    //     inst > 0, frete > 0  → "Frete e instalacao inclusos"
    //     inst = 0, frete = 0  → "Frete e instalacao nao inclusos"
    // Considera "incluso" apenas se valor > 0 (zero/null/vazio = nao incluso).
    const fraseFreteInst = (() => {
      if (inst.modo === 'projetta') {
        return tr('Frete e instalacao inclusos', 'Freight and installation included');
      }
      const valInst  = Number(inst.inst_terceiros_valor)  || 0;
      const valFrete = Number(inst.inst_terceiros_transp) || 0;
      const temInst  = valInst > 0;
      const temFrete = valFrete > 0;
      if (temInst && temFrete)   return tr('Frete e instalacao inclusos',            'Freight and installation included');
      if (temInst && !temFrete)  return tr('Instalacao inclusa, frete nao incluso',  'Installation included, freight not included');
      if (!temInst && temFrete)  return tr('Frete incluso, instalacao nao inclusa',  'Freight included, installation not included');
      return                              tr('Frete e instalacao nao inclusos',      'Freight and installation not included');
    })();

    // Cabecalho via modulo Empresa
    // Felipe (sessao 2026-07): "A - 1 - Proposta Comercial - Previa
    // isso no cabecalho seria o que? O que seria A-1? Coloque
    // 'Proposta Comercial - 1ª Versão' e depois ao ir fazendo outras
    // versoes vai alterando ali em cima". Removi a letra da opcao
    // (A) que confundia. Numero do doc agora reflete numero da versao.
    const numVersao = versao.numero || 1;
    // Sufixos ordinais: 1ª, 2ª, 3ª... (em PT-BR sempre o mesmo "ª")
    const tituloProposta = internacional
      ? `Commercial Proposal - Version ${numVersao}`
      : `Proposta Comercial - ${numVersao}ª Versao`;
    const numeroDoc = `V${numVersao}`;
    const headerHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
      ? window.Empresa.montarHeaderRelatorio({
          lead,
          tituloRelatorio: tituloProposta,
          numeroDocumento: numeroDoc,
          validade: 15,
        })
      : '<div class="info-banner">Cabecalho indisponivel</div>';

    // Felipe sessao 12: filtra itens vazios (sem dim alguma) - nao adianta
    // mostrar 'Item 06 - Revestimento de Parede 0x0 R$ 0,00' na proposta.
    const itens = (versao.itens || []).filter(it => {
      if (!it.tipo) return false;
      const lar = parseBR(it.largura) || parseBR(it.largura_total) || 0;
      const alt = parseBR(it.altura)  || parseBR(it.altura_total)  || 0;
      const temPecasManuais = Array.isArray(it.pecas) && it.pecas.some(
        p => Number(p.largura) > 0 && Number(p.altura) > 0
      );
      return (lar > 0 && alt > 0) || temPecasManuais;
    });

    // Felipe sessao 12: 'quero a proposta igual quando tem so uma porta,
    // ocupando largura bacana. ai como tem mais item faca uma quebra,
    // sem cortar detalhamento de um item'.
    //
    // ANTES: TODOS os cards iam num unico .rel-prop-pagina-conteudo. Se
    // tinha 7 itens, a pagina crescia verticalmente (overflow). Felipe
    // achou estreito por contraste com o caso 1 item (que cabia certinho).
    //
    // AGORA: distribui cards em multiplas paginas A4 - cada pagina com
    // largura cheia 210mm. 1a pagina: header + 3 cards. 2a pagina:
    // proximos 3-4 cards. Ultima pagina: tabela final + totais +
    // observacoes + pagamento + assinaturas. Sem cortar item entre paginas.
    const CARDS_POR_PAGINA = 3;
    const cardsList = itens.map((item, idx) => renderCardItemProposta(item, idx, versao));
    // Divide em chunks
    const cardsChunks = [];
    for (let k = 0; k < cardsList.length; k += CARDS_POR_PAGINA) {
      cardsChunks.push(cardsList.slice(k, k + CARDS_POR_PAGINA));
    }
    if (!cardsChunks.length) cardsChunks.push([]);

    // Felipe (sessao 13, msg "proposta comercial quando couber tudo em uma
    // folha faca, nesse caso baerria tranquiloamente"): com 1 item so', o
    // card + tabela + observacoes + assinaturas cabem TUDO em 1 folha A4.
    // Antes: card numa folha + tabela final em OUTRA folha = espaco enorme
    // em branco entre elas. Agora: detecta caso 1-item e junta tudo numa
    // unica .rel-prop-pagina (sem paginaItensHtml separada da pagina final).
    const unicaPagina = (cardsList.length <= 1);

    // Se for unicaPagina, paginaItensHtml fica vazio (header+card vao na
    // pagina final). Se for multi-itens, mantem comportamento da sessao 12.
    const paginaItensHtml = unicaPagina ? '' : cardsChunks.map((chunk, pgIdx) => {
      const headerNaPagina = pgIdx === 0 ? headerHtml : '';
      return `
        <div class="rel-prop-pagina rel-prop-pagina-conteudo">
          ${headerNaPagina}
          ${chunk.length ? chunk.join('') : '<div class="rel-prop-empty">Nenhum item.</div>'}
        </div>`;
    }).join('');
    // Manter cardsItens pra compatibilidade (nao usado mais no innerHTML)
    const cardsItens = cardsList.join('');
    let totalArea = 0;
    let totalGeral = 0;
    // Felipe (do doc - msg "PORPOSTA DEVE CABER EM UMA PAGINA"): com 1 item,
    // tudo cabe numa pagina so'. Felipe sessao 12: agora cards distribuidos
    // em paginas A4 separadas via paginaItensHtml (acima).
    itens.forEach(item => {
      const ehRev = item.tipo === 'revestimento_parede';
      const lar = ehRev
        ? (parseBR(item.largura_total) || 0)
        : (parseBR(item.largura) || 0);
      const alt = ehRev
        ? (parseBR(item.altura_total) || 0)
        : (parseBR(item.altura) || 0);
      const qtd = Number(item.quantidade) || 1;
      const areaUn = (lar / 1000) * (alt / 1000);
      totalArea += areaUn * qtd;
      // Valor por item: distribui o preco total da versao proporcional ao subtotal
      // (provisorio — depois substituido por preco-por-item real)
    });

    // Preco total da proposta: usa o pTab (PRECO DE TABELA) — e' o
    // valor "cheio" mostrado pro cliente. O desconto (pFatReal) e'
    // negociado em separado. Felipe (sessao 2026-05): trocado de
    // pFatReal pra pTab — a proposta deve mostrar o "Preco da Proposta"
    // (linha "Preco da Proposta" no card de Conferencia do DRE), nao
    // o "Cliente Paga".
    _sincronizarSubFabInst(versao);
    const subFab  = Number(versao.subFab) || 0;
    const subInst = Number(versao.subInst) || 0;
    const params  = Object.assign({}, PARAMS_DEFAULT, versao.parametros || {});
    const dre     = calcularDRE(subFab, subInst, params);
    totalGeral    = Number(dre.pTab) || 0;

    // Tabela com 1 linha por item — valores calculados via
    // calcularValoresProposta (Felipe sessao 2026-06):
    //   subFab por item: proporcional as horas
    //   subInst por item: proporcional ao subFab de cada item
    //   precoFinal por item = pTab (preco com markup, antes do desconto)
    //   valorUn = precoFinal / item.quantidade
    const valoresProposta = calcularValoresProposta(versao, params);
    const valoresPorIdx = {};
    valoresProposta.porItem.forEach(v => { valoresPorIdx[v.idx] = v; });

    const linhasTabela = itens.map((item, idx) => {
      // Felipe sessao 12: rev_parede usa largura_total/altura_total (nao
      // largura/altura). Antes saia '0 x 0' nas tabelas pra revs.
      // Felipe sessao 31: PERGOLADO tem dimensoes em paredes[0] —
      // largura_total/altura_total top-level ficam vazios. Antes saia
      // '0 × 0' tambem pra pergolado. Agora usa primeira parede com
      // largura/altura preenchidas.
      //
      // Felipe sessao 31 (v2): 'ou coloque medida de todas as paredes
      // ou escreva variado'. Quando o item tem MULTIPLAS paredes
      // preenchidas, em vez de 1 linha 'NxN', mostra a palavra
      // 'Variado' (e o card detalha cada parede). Aplica a rev_parede
      // E pergolado (ambos podem ter paredes[]).
      const ehRev = item.tipo === 'revestimento_parede';
      const ehPergolado = item.tipo === 'pergolado';
      let lar, alt;
      let medidasStr = '';
      if (ehPergolado || ehRev) {
        const paredesValidas = (Array.isArray(item.paredes) ? item.paredes : [])
          .filter(p => Number(p.largura_total) > 0 && Number(p.altura_total) > 0);
        if (paredesValidas.length > 1) {
          medidasStr = 'Variado';
          lar = Number(paredesValidas[0].largura_total);
          alt = Number(paredesValidas[0].altura_total);
        } else if (paredesValidas.length === 1) {
          lar = Number(paredesValidas[0].largura_total);
          alt = Number(paredesValidas[0].altura_total);
          medidasStr = `${lar} × ${alt}`;
        } else {
          lar = parseBR(item.largura_total) || 0;
          alt = parseBR(item.altura_total)  || 0;
          medidasStr = `${lar} × ${alt}`;
        }
      } else {
        lar = parseBR(item.largura) || 0;
        alt = parseBR(item.altura)  || 0;
        medidasStr = `${lar} × ${alt}`;
      }
      const qtd = Number(item.quantidade) || 1;
      const descricaoItem = obterDescricaoItem(item, internacional);
      // Valor por item — se nao temos calculado (fallback), mostra "—"
      const v = valoresPorIdx[idx];
      const valorUnStr   = (v && v.precoFinal > 0) ? `R$ ${fmtBR(v.valorUn)}`    : '—';
      const valorTotStr  = (v && v.precoFinal > 0) ? `R$ ${fmtBR(v.precoFinal)}` : '—';
      return `
        <tr>
          <td class="rel-prop-tabela-num">${String(idx + 1).padStart(2, '0')}</td>
          <td>${escapeHtml(descricaoItem)}</td>
          <td>${escapeHtml(medidasStr)}</td>
          <td class="num">${qtd}</td>
          <td class="num">${valorUnStr}</td>
          <td class="num">${valorTotStr}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="orc-banner">
        <div class="orc-banner-info">
          <span class="t-strong">${tr('Proposta Comercial', 'Commercial Proposal')}</span>
          · ${escapeHtml(negocio?.clienteNome || '—')}
          · ${tr('Opcao', 'Option')} ${escapeHtml(opcao.letra)} V${versao.numero}
        </div>
        <div class="orc-banner-actions">
          <button type="button" class="univ-btn-save" id="orc-prop-imprimir" title="${tr('Baixa o PDF da proposta direto (nao abre impressora)', 'Download PDF directly')}">📄 ${tr('Exportar PDF', 'Export PDF')}</button>
        </div>
      </div>

      <div class="rel-prop-folha">
        <!-- Felipe (sessao 2026-05): paginas 01 e 02 da proposta agora
             usam DIRETO o PDF que o Felipe enviou (01.pdf capa, 03.pdf
             mapa). Antes era HTML/CSS tentando reproduzir o layout, mas
             ficava feio. Agora e' simplesmente a imagem do PDF dele em
             tela cheia — sem editar, sem reescrever, sem copiar texto. -->
        <div class="rel-prop-pagina rel-prop-pagina-pdf">
          <img src="images/proposta-pag1.jpg" alt="Capa Proposta Comercial 2026" class="rel-prop-pdf-img" />
        </div>

        <div class="rel-prop-pagina rel-prop-pagina-pdf">
          <img src="images/proposta-pag2.jpg" alt="Nossa Portas pelo Mundo" class="rel-prop-pdf-img" />
        </div>

        <!-- Felipe sessao 12: 'ai como tem mais item faca uma quebra,
             sem cortar detalhamento de um item'. Multiplas paginas A4 -
             header + 3 cards na 1a, mais 3 cards nas seguintes, ultima
             tem tabela final + totais + observacoes + assinaturas. Cada
             pagina tem largura cheia 210mm.
             Felipe sessao 13: caso 1-item, paginaItensHtml fica vazio e
             header+card vao na pagina final junto com tabela+obs+ass. -->
        ${paginaItensHtml}

        <div class="rel-prop-pagina rel-prop-pagina-conteudo">
          ${unicaPagina ? headerHtml : ''}
          ${unicaPagina ? (cardsList[0] || '') : ''}
          <table class="rel-prop-tabela-final">
            <thead>
              <tr>
                <th class="rel-prop-tabela-num">${tr('Item','Item')}</th>
                <th>${tr('Descricao','Description')}</th>
                <th>${tr('Medidas','Dimensions')}</th>
                <th class="num">${tr('Qtd','Qty')}</th>
                <th class="num">${tr('Valor (un.)','Unit Price')}</th>
                <th class="num">${tr('Valor Total','Total')}</th>
              </tr>
            </thead>
            <tbody>${linhasTabela}</tbody>
          </table>
          <div class="rel-prop-totais-row">
            <div class="rel-prop-total-area">
              <span class="rel-prop-total-label">${tr('Total Area Portas:','Total Door Area:')}</span>
              <span class="rel-prop-total-valor">${fmtBR(totalArea)} m²</span>
            </div>
            <div class="rel-prop-total-orc">
              <span class="rel-prop-total-label">${tr('Total Orcamento:','Grand Total:')}</span>
              <span class="rel-prop-total-valor">R$ ${fmtBR(totalGeral)}${(internacional && taxa > 0) ? ' · USD ' + (totalGeral / taxa).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }) : ''}</span>
            </div>
          </div>

          <div class="rel-prop-observacoes">
            <div class="rel-prop-obs-titulo">${tr('Observacoes','Remarks')}</div>
            <ul class="rel-prop-obs-lista">
              <li>${tr('Chapa 4 mm com pintura Kynar — 15 anos pro-rata','4 mm sheet with Kynar paint — 15 year pro-rata warranty')}</li>
              <li>${tr('Fechaduras de seguranca KESO','KESO security locks')}</li>
              <li>${tr('Pivo em aco inox 304 / 316 L','Stainless steel pivot 304 / 316 L')}</li>
              <li>${tr('Vedacao da porta automatica superior e inferior','Automatic top and bottom door seal')}</li>
              <li>${tr('Vedacao dupla (folha e batente) por Q-LON','Double seal (leaf and frame) by Q-LON')}</li>
              ${(() => {
                const itensVidro = (versao.itens || [])
                  .map((it, i) => ({ it, i }))
                  .filter(({ it }) => it && it.tipo === 'fixo_acoplado'
                                   && it.revestimento === 'Vidro'
                                   && it.vidroDescricao);
                if (!itensVidro.length) return '';
                return itensVidro.map(({ it, i }) => {
                  const pos = String(it.posicao || '').toLowerCase() === 'lateral'
                    ? tr('Lateral','Side') : (String(it.posicao || '').toLowerCase() === 'superior' ? tr('Superior','Top') : '');
                  const label = tr('Item','Item') + ` ${i + 1} (${tr('Fixo Acoplado','Coupled Fixed')}${pos ? ' ' + pos : ''})`;
                  return `<li><b>${tr('VIDRO','GLASS')} ${escapeHtml(label)}:</b> ${escapeHtml(it.vidroDescricao)}</li>`;
                }).join('');
              })()}
              <li><b>*** ${escapeHtml(fraseFreteInst.toUpperCase())}</b></li>
            </ul>
          </div>

          ${internacional && taxa > 0 ? (() => {
            const incoterm = lead.freteIncoterm || 'FOB';
            const itc = window.Incoterms ? window.Incoterms.byCodigo(incoterm) : null;
            if (!itc) return '';
            const a = Number(lead.caixaAltura) || 0;
            const e = Number(lead.caixaEspessura) || 0;
            const c = Number(lead.caixaComprimento) || 0;
            const m3 = (a * e * c) / 1e9;
            const caixaUsd = (window.FreteTarifas ? window.FreteTarifas.calcularCaixa(m3) : m3 * 100);
            const terrUsd  = Number(lead.freteTerrestreUsd) || 0;
            const marUsd   = Number(lead.freteMaritimoUsd)  || 0;
            const valorUsd = totalGeral / taxa;
            const seguroUsd = itc.seguroMaritimo ? Math.max(35, valorUsd * 0.005 * 1.10) : 0;
            const incluir = {
              caixa:     true,
              terrestre: itc.freteTerrestre,
              maritimo:  itc.freteMaritimo,
              seguro:    itc.seguroMaritimo,
            };
            const subFrete = (incluir.caixa     ? caixaUsd : 0)
                           + (incluir.terrestre ? terrUsd  : 0)
                           + (incluir.maritimo  ? marUsd   : 0)
                           + (incluir.seguro    ? seguroUsd: 0);
            const finalUsd = valorUsd + subFrete;
            const fmtUsd = v => 'USD ' + v.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
            const linha = (label, usd, incluso) => `
              <tr style="${incluso ? '' : 'opacity:0.4; text-decoration:line-through;'}">
                <td>${label}</td>
                <td class="num">${fmtUsd(usd)}</td>
                <td class="num" style="font-weight:700; color:${incluso ? '#0c5485' : '#999'}; font-size:14px;">${incluso ? '✓ YES' : '✗ NO'}</td>
              </tr>
            `;
            return `
              <div class="rel-prop-internacional" style="margin-top:18px; padding:14px; background:#eff8ff; border:2px solid #0c5485; border-radius:8px;">
                <div style="font-weight:700; color:#0c5485; font-size:13px; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">
                  🌍 International Shipping &middot; Incoterm <span style="background:#0c5485; color:#fff; padding:2px 8px; border-radius:4px;">${escapeHtml(incoterm)}</span>
                </div>
                <p style="font-size:11px; color:#5a7a99; margin:0 0 10px 0;">
                  <b>${escapeHtml(itc.nome)}</b>. ${escapeHtml(itc.descricao)}
                </p>
                <table style="width:100%; font-size:12px; border-collapse:collapse;">
                  <thead>
                    <tr style="border-bottom:2px solid #0c5485; color:#0c5485; font-weight:700;">
                      <th style="text-align:left; padding:4px 0;">Component</th>
                      <th style="text-align:right; padding:4px 0;">USD</th>
                      <th style="text-align:center; padding:4px 0; width:60px;">Included</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linha('Product value (FCA factory)', valorUsd, true)}
                    ${linha('📦 Fumigated wood crate (' + m3.toFixed(2) + ' m³)', caixaUsd, incluir.caixa)}
                    ${linha('🚛 Inland freight Uberlandia → Santos', terrUsd, incluir.terrestre)}
                    ${linha('🚢 Ocean freight ' + (lead.freteModal || 'LCL'), marUsd, incluir.maritimo)}
                    ${linha('🛡️ Marine insurance (0.5% × value × 110%)', seguroUsd, incluir.seguro)}
                  </tbody>
                </table>
                <div style="margin-top:10px; padding:10px 12px; background:#0c5485; color:#fff; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:12px; font-weight:600;">TOTAL ${escapeHtml(incoterm)} ${escapeHtml(lead.destinoPais || '')}</span>
                  <span style="font-size:17px; font-weight:700;">${fmtUsd(finalUsd)}</span>
                </div>
                <p style="font-size:10px; color:#5a7a99; margin-top:8px; font-style:italic;">
                  Origin: Uberlandia / Brazil &middot; Destination: ${escapeHtml(lead.destinoPais || '—')}
                  ${lead.freteModal === 'FCL' ? '&middot; Container: ' + escapeHtml(lead.freteContainer || '40HC') : ''}
                  &middot; USD rate: ${taxa.toFixed(4)} (BCB PTAX)
                </p>
              </div>
            `;
          })() : ''}

          <div class="rel-prop-pagamento">
            <div class="rel-prop-pag-row"><b>${tr('Condicoes de Pagamento:','Payment Terms:')}</b> ${tr('6X','6 installments')}</div>
            <div class="rel-prop-pag-row"><b>${tr('Forma de Pagamento:','Payment Method:')}</b> ${tr('Boleto', internacional ? 'Wire Transfer' : 'Boleto')}</div>
            <div class="rel-prop-pag-row"><b>${tr('Prazo de Entrega:','Delivery Time:')}</b> ${tr('90 dias apos aprovacao do recalculo.','90 days after approval of recalculation.')}</div>
          </div>

          <div class="rel-prop-assinaturas">
            <div class="rel-prop-assinatura">
              <div class="rel-prop-assinatura-linha"></div>
              <div class="rel-prop-assinatura-label">${escapeHtml(lead.cliente || '—')}</div>
            </div>
            <div class="rel-prop-assinatura">
              <div class="rel-prop-assinatura-linha"></div>
              <div class="rel-prop-assinatura-label">PROJETTA PORTAS EXCLUSIVAS LTDA</div>
            </div>
          </div>

          <!-- Felipe (sessao 2026-07): "coloque site em letra minuscula
               e um simbolo de website. Coloque acima do site
               @projettaaluminio com simbolo do instagram. Em cima
               deste 'siga-nos nas redes sociais'." Layout em 3 linhas:
                  Siga-nos nas redes sociais
                  📷 @projettaaluminio
                  🌐 www.projettaaluminio.com -->
          <div class="rel-prop-footer-redes">
            <div class="rel-prop-footer-cta">${tr('Siga-nos nas redes sociais','Follow us on social media')}</div>
            <div class="rel-prop-footer-rede">
              <span class="rel-prop-footer-icon">
                <!-- Instagram (SVG simples — camera + circulo) -->
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </span>
              <span class="rel-prop-footer-handle">@projettaaluminio</span>
            </div>
            <div class="rel-prop-footer-rede">
              <span class="rel-prop-footer-icon">
                <!-- Globe / Website -->
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </span>
              <span class="rel-prop-footer-site">www.projettaaluminio.com</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Felipe (sessao 2026-07): "nao abra impressora sempre ao clicar
    // exporte direto para download". Botao agora gera PDF direto via
    // jsPDF + html2canvas (mesma estrategia do Padroes de Cortes).
    container.querySelector('#orc-prop-imprimir')?.addEventListener('click', () => {
      exportarPropostaPDF();
    });
  }

  /**
   * Felipe (do doc): descricao do item na tabela da Proposta:
   *   - tipo='porta_externa' → "PORTA EXTERNA (Pivotante)" ou "PORTA EXTERNA (Dobradica)"
   *     (puxa de item.sistema)
   *   - tipo='porta_interna' → "PORTA INTERNA"
   *   - tipo='fixo_acoplado' → "FIXO ACOPLADO A PORTA"
   *   - tipo='revestimento_parede' → "REVESTIMENTO DE PAREDE"
   *   - tipo vazio → "—"
   */
  function obterDescricaoItem(item, internacional) {
    if (!item || !item.tipo) return '—';
    const tr = (pt, en) => internacional ? en : pt;
    if (item.tipo === 'porta_externa') {
      const sistema = (item.sistema || '').toLowerCase();
      let abertura = '';
      if (sistema.includes('pivot'))      abertura = tr('Pivotante','Pivoting');
      else if (sistema.includes('dobrad')) abertura = tr('Dobradica','Hinged');
      else if (sistema) abertura = item.sistema;
      return abertura
        ? `${tr('PORTA EXTERNA','EXTERIOR DOOR')} (${abertura})`
        : tr('PORTA EXTERNA','EXTERIOR DOOR');
    }
    if (item.tipo === 'porta_interna') return tr('PORTA INTERNA','INTERIOR DOOR');
    if (item.tipo === 'fixo_acoplado') {
      let base = tr('FIXO ACOPLADO A PORTA','COUPLED FIXED PANEL');
      const pos = String(item.posicao || '').toLowerCase();
      if (pos === 'lateral')  base += ` (${tr('Lateral','Side')})`;
      if (pos === 'superior') base += ` (${tr('Superior','Top')})`;
      if (item.revestimento === 'Vidro' && item.vidroDescricao) {
        base += ` — ${tr('Vidro','Glass')}: ${item.vidroDescricao}`;
      }
      if (item.revestimento !== 'Vidro') {
        const lados = String(item.lados || '1lado').toLowerCase();
        if (lados === '2lados') {
          base += tr(' — Revestido nos 2 lados (externo + interno)',' — Coated on both sides (exterior + interior)');
        } else {
          base += tr(' — Revestido em 1 lado (somente externo)',' — Coated on one side (exterior only)');
        }
      }
      return base;
    }
    if (item.tipo === 'revestimento_parede') return tr('REVESTIMENTO DE PAREDE','WALL CLADDING');
    return item.tipo.toUpperCase();
  }

  // ============================================================
  // Felipe (do doc - msg "em todas as abas preciso largura altura
  // modelo junto ao cabecalho"): banner compacto com caracteristicas
  // dos itens, EXIBIDO EM TODAS AS ABAS depois do cabecalho da empresa.
  // E' o ponto-chave de toda conferencia.
  // ============================================================
  function bannerCaracteristicasItens(versao) {
    const itens = (versao && versao.itens) || [];
    if (!itens.length) return '';
    // Lookup nomes dos modelos (Cadastro)
    let modelosLista = [];
    if (window.Modelos && typeof window.Modelos.listar === 'function') {
      modelosLista = window.Modelos.listar();
    }
    const linhas = itens.map((item, idx) => {
      const numero = idx + 1;
      const tipo = obterDescricaoItem(item);
      const lar = Number(item.largura) || null;
      const alt = Number(item.altura) || null;
      const medidas = (lar && alt) ? `${lar} × ${alt} mm` : '—';
      let modeloLabel = '—';
      if (item.modeloNumero) {
        const m = modelosLista.find(x => Number(x.numero) === Number(item.modeloNumero));
        modeloLabel = m ? `Modelo ${item.modeloNumero} — ${m.nome}` : `Modelo ${item.modeloNumero}`;
      }
      const folhas = item.nFolhas ? `${item.nFolhas} folha${Number(item.nFolhas) > 1 ? 's' : ''}` : '';
      const qtd = Number(item.quantidade) || 1;
      // Monta a linha com as caracteristicas-chave
      const partes = [
        `<span class="orc-bcar-num">Item ${numero}</span>`,
        `<span class="orc-bcar-tipo">${escapeHtml(tipo)}</span>`,
        `<span class="orc-bcar-medidas">${escapeHtml(medidas)}</span>`,
        `<span class="orc-bcar-modelo">${escapeHtml(modeloLabel)}</span>`,
        folhas ? `<span class="orc-bcar-folhas">${escapeHtml(folhas)}</span>` : '',
        qtd > 1 ? `<span class="orc-bcar-qtd">Qtd ${qtd}</span>` : '',
      ].filter(Boolean).join('');
      return `<div class="orc-bcar-row">${partes}</div>`;
    }).join('');
    return `
      <div class="orc-bcar">
        <div class="orc-bcar-titulo">Caracteristicas do${itens.length > 1 ? 's' : ''} Item${itens.length > 1 ? 's' : ''}</div>
        ${linhas}
      </div>
    `;
  }

  /**
   * Card de UM item na proposta comercial — imagem do modelo + caracteristicas
   * + banners de alertas (alisar, fechadura, cilindro).
   *
   * Felipe sessao 2026-08:
   *   - FIXO ACOPLADO A PORTA NAO gera card visual aqui (e' parte do
   *     conjunto da porta - aparece apenas na tabela inferior).
   *   - REVESTIMENTO DE PAREDE gera card sem imagem, mostrando so' as
   *     variaveis do item.
   */
  function renderCardItemProposta(item, idx, versao) {
    // Felipe sessao 2026-08: fixo acoplado nao gera card visual proprio.
    // 'E UM ITEM UNICO COM A PORTA - SOMENTE DESCRICAO E PRECO FICA
    // MESCLADO ENTRE PORTA E FIXO ACOPLADO A PORTA'.
    if (item.tipo === 'fixo_acoplado') return '';

    // Felipe sessao 31: PERGOLADO tambem nao gera card visual.
    // 'tenho 3 portas, um pergolado (saiu ali como se fosse porta retire
    // isso tudo, deixe so na lista)'. Card de porta tem puxador, fechadura,
    // cilindro, alisar, modelo, num folhas — nada disso aplica ao pergolado.
    // So' aparece na tabela final (linhas 10249+).
    if (item.tipo === 'pergolado') return '';

    // Felipe sessao 31: detecta destino internacional pra traduzir labels.
    const _lead = (typeof lerLeadAtivo === 'function') ? (lerLeadAtivo() || {}) : {};
    const internacional = _lead.destinoTipo === 'internacional';
    const tr = (pt, en) => internacional ? en : pt;

    // Felipe sessao 2026-08: revestimento de parede tem card sem imagem,
    // so' com as variaveis (cor da peca, dimensoes, area, estrutura, etc).
    if (item.tipo === 'revestimento_parede') {
      return renderCardItemPropostaRevestimento(item, idx, versao);
    }

    // Lookup do modelo no cadastro pra pegar imagem e nome
    let modeloInfo = null;
    if (window.Modelos && typeof window.Modelos.listar === 'function') {
      const lista = window.Modelos.listar();
      modeloInfo = lista.find(m => Number(m.numero) === Number(item.modeloNumero));
    }
    const modeloNome = modeloInfo
      ? `${item.modeloNumero} — ${modeloInfo.nome}`
      : (item.modeloNumero ? `Modelo ${item.modeloNumero}` : '—');

    // Imagem: usa img_1f ou img_2f conforme nFolhas
    const nFolhas = Number(item.nFolhas) || 1;
    const imgSrc = modeloInfo
      ? (nFolhas === 2 ? (modeloInfo.img_2f || modeloInfo.img_1f) : modeloInfo.img_1f)
      : null;

    const lar = parseBR(item.largura) || 0;
    const alt = parseBR(item.altura)  || 0;
    const areaM2 = (lar / 1000) * (alt / 1000);

    // Felipe (do doc): banners de alertas — alisar, fechadura, cilindro
    const temAlisar = (item.tem_alisar || 'Sim') === 'Sim';
    const bannerAlisar = temAlisar
      ? `<div class="rel-prop-banner-alisar is-sim">${tr('ALISAR','WALL TRIM')}: <b>${tr('SIM — COM ALISAR','YES — WITH TRIM')}</b> (${tr('largura','width')} ${item.largura_alisar || 100}mm · ${tr('parede','wall')} ${item.espessura_parede || 250}mm)</div>`
      : `<div class="rel-prop-banner-alisar is-nao">${tr('ALISAR','WALL TRIM')}: <b>${tr('NAO — SEM ALISAR','NO — WITHOUT TRIM')}</b></div>`;

    const temFechDigital = item.fechaduraDigital && item.fechaduraDigital !== 'Nao se aplica' && item.fechaduraDigital !== '';
    const bannerFechDigital = temFechDigital
      ? `<div class="rel-prop-banner-fech is-sim">${tr('FECHADURA DIGITAL','DIGITAL LOCK')}: <b>${escapeHtml(item.fechaduraDigital)}</b></div>`
      : `<div class="rel-prop-banner-fech is-nao">${tr('FECHADURA DIGITAL','DIGITAL LOCK')}: <b>${tr('NAO SE APLICA','NOT APPLICABLE')}</b></div>`;

    const sistema = item.sistema || '—';
    const sistemaFmt = sistema && sistema !== '—'
      ? (() => {
          const base = sistema.charAt(0).toUpperCase() + sistema.slice(1).toLowerCase();
          if (internacional) {
            const low = base.toLowerCase();
            if (low === 'pivotante') return 'Pivoting';
            if (low === 'dobradica' || low === 'dobradiça') return 'Hinged';
          }
          return base;
        })()
      : '—';

    // Felipe sessao 2026-08-03: em modelo CAVA, puxador deve aparecer como 'Cava'
    // (nao um modelo de puxador especifico)
    // Felipe sessao 14: 'ELE TEM QUE APARECER O QUE TEM NO CAMPO, NAO E
    // FORCAR ALGO. Se modelo for Cava, sai Cava. Se nao for, e' o que
    // tem no campo'. Mas pra itens ANTIGOS (criados antes do default
    // 'Enviado pelo cliente') o item.tamanhoPuxador esta '' — visualmente
    // o select mostra 'Enviado pelo cliente' (1a opcao) e usuario espera
    // ver isso na proposta. Trata '' como 'Enviado pelo cliente'.
    //
    // Felipe sessao 14 (2a msg): 'quando for por conta do cliente destaque
    // igual quando alisar nao e incluso, cliente tem que estar ciente que
    // nao esta incluso'. Quando puxador e' 'Enviado pelo cliente' ou
    // 'Nao se aplica', renderiza BANNER LARANJA (mesmo estilo do
    // 'ALISAR NAO — SEM ALISAR'). Outros tamanhos (Cava, XX mm) saem
    // como linha simples.
    const ehModeloCava = isCava(item.modeloNumero);
    const puxadorRaw = ehModeloCava
      ? 'Cava'
      : (item.tamanhoPuxador || 'Enviado pelo cliente');
    const puxadorPorContaDoCliente = !ehModeloCava && (
      puxadorRaw === 'Enviado pelo cliente' ||
      puxadorRaw === 'Nao se aplica' ||
      puxadorRaw === ''
    );
    const linhaPuxador = puxadorPorContaDoCliente
      ? `<div class="rel-prop-banner-alisar is-nao">${tr('PUXADOR EXTERNO','EXTERIOR HANDLE')}: <b>${escapeHtml((internacional && /enviado/i.test(puxadorRaw) ? 'SENT BY CLIENT' : puxadorRaw).toUpperCase())} — ${tr('NAO INCLUSO','NOT INCLUDED')}</b></div>`
      : `<div class="rel-prop-item-linha"><span class="lbl">${tr('PUXADOR','HANDLE')}:</span> <span>${escapeHtml(puxadorRaw)}</span></div>`;

    // Felipe sessao 31: badge 'ITEM N' no titulo do card pra alinhar com
    // o card de revestimento e a tabela final. Antes nao tinha nada
    // identificando 'Item 2 / Item 3 / Item 4'.
    const _numItem = (typeof idx === 'number' && idx >= 0) ? (idx + 1) : null;
    const _tituloBadge = _numItem
      ? `<span class="rel-prop-item-num-badge" style="display:inline-block;background:#c46b20;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:8px;letter-spacing:0.05em;">ITEM ${String(_numItem).padStart(2,'0')}</span>`
      : '';

    return `
      <div class="rel-prop-item-card">
        <div class="rel-prop-item-img">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="Modelo ${item.modeloNumero}" />`
            : `<div class="rel-prop-item-img-placeholder">Imagem do<br>modelo</div>`}
          <!-- Felipe sessao 18: disclaimer abaixo da imagem - 'As imagens/Modelo
               visual sao meramente ilustrativos. O cliente aprovara os desenhos
               finais para producao.' -->
          <div class="rel-prop-item-img-disclaimer">
            ${tr('Imagem meramente ilustrativa. O cliente aprovara os desenhos finais para producao.','Image for illustration only. Client will approve final drawings for production.')}
          </div>
        </div>
        <div class="rel-prop-item-info">
          <div class="rel-prop-item-titulo">${_tituloBadge}${tr('PORTA PROJETTA BY WEIKU','PROJETTA DOOR BY WEIKU')}</div>
          <!-- Felipe (msg "TUDO A ESQUERDA"): cada linha label+valor compacto,
               sem espacos largos, alinhado a esquerda. R04. -->
          <div class="rel-prop-item-linhas">
            <div class="rel-prop-item-linha"><span class="lbl">${tr('Qtd','Qty')}:</span> <span>${Number(item.quantidade) || 1}</span></div>
            <div class="rel-prop-item-linha"><span class="lbl">${tr('L','W')}:</span> <span>${lar}</span></div>
            <div class="rel-prop-item-linha"><span class="lbl">H:</span> <span>${alt}</span></div>
            <div class="rel-prop-item-linha"><span class="lbl">${tr('Area Porta','Door Area')}:</span> <span>${fmtBR(areaM2)} m²</span></div>
            <div class="rel-prop-item-linha"><span class="lbl">${tr('SISTEMA','SYSTEM')}:</span> <span>${escapeHtml(sistemaFmt)}</span></div>
            <div class="rel-prop-item-linha"><span class="lbl">${tr('NUMERO DE FOLHAS','NUMBER OF LEAVES')}:</span> <span>${nFolhas} ${tr('FOLHA','LEAF')}${nFolhas > 1 ? (internacional ? 'S' : 'S') : ''}</span></div>
            <div class="rel-prop-item-linha"><span class="lbl">${tr('MODELO','MODEL')}:</span> <span>${escapeHtml(modeloNome)}</span></div>
            <div class="rel-prop-item-linha"><span class="lbl">${tr('FECHADURA MECANICA','MECHANICAL LOCK')}:</span> <span>${escapeHtml(item.fechaduraMecanica || '—')}</span></div>
          </div>
          ${bannerFechDigital}
          <div class="rel-prop-item-linhas">
            ${linhaPuxador}
            ${(() => {
              // Felipe sessao 13: 'na proposta comercial da 23 precisamos
              // melhorar nao tem cor da chapa de aluminio macico'. Quando
              // Mod23+AM, a porta tem 2 chapas (AM corpo + ACM portal).
              // Mostra 4 cores em vez de 2, com labels ACM/AM explicitos.
              const m = Number(item.modeloExterno || item.modeloInterno || item.modeloNumero) || 0;
              const rev = String(item.revestimento || '').toLowerCase();
              const ehMod23AM = m === 23 && /aluminio.*macico/.test(rev) && /2\s*mm/.test(rev);
              if (ehMod23AM) {
                return `
                  <div class="rel-prop-item-linha"><span class="lbl">${tr('CHAPA ACM ACABAMENTO EXTERNO','ACM SHEET EXTERIOR FINISH')}:</span> <span>${escapeHtml(item.corExterna || '—')}</span></div>
                  <div class="rel-prop-item-linha"><span class="lbl">${tr('CHAPA ACM ACABAMENTO INTERNO','ACM SHEET INTERIOR FINISH')}:</span> <span>${escapeHtml(item.corInterna || '—')}</span></div>
                  <div class="rel-prop-item-linha"><span class="lbl">${tr('CHAPA AM EXTERNA','AM SHEET EXTERIOR')}:</span> <span>${escapeHtml(item.corChapaAM_Ext || '—')}</span></div>
                  <div class="rel-prop-item-linha"><span class="lbl">${tr('CHAPA AM INTERNA','AM SHEET INTERIOR')}:</span> <span>${escapeHtml(item.corChapaAM_Int || '—')}</span></div>
                `;
              }
              return `
                <div class="rel-prop-item-linha"><span class="lbl">${tr('COR CHAPA EXTERNA','EXTERIOR SHEET COLOR')}:</span> <span>${escapeHtml(item.corExterna || '—')}</span></div>
                <div class="rel-prop-item-linha"><span class="lbl">${tr('COR CHAPA INTERNA','INTERIOR SHEET COLOR')}:</span> <span>${escapeHtml(item.corInterna || '—')}</span></div>
              `;
            })()}
            <div class="rel-prop-item-linha"><span class="lbl">${tr('CILINDRO','CYLINDER')}:</span> <span>${escapeHtml(item.cilindro || '—')}</span></div>
          </div>
          ${(() => {
            // Caracteristicas do modelo (so se preenchidas)
            const num = Number(item.modeloNumero);
            const campos = CAMPOS_POR_MODELO[num];
            if (!campos || !campos.length) return '';
            const linhas = campos
              .filter(c => item[c] !== undefined && item[c] !== '' && item[c] !== null)
              .map(c => {
                const meta = CATALOGO_CAMPOS_MODELO[c];
                if (!meta) return '';
                // Felipe sessao 30 fix: o sufixo " mm" so' deve aparecer em
                // campos que SAO em milimetros. Antes adicionava em qualquer
                // campo number, fazendo 'quantidadeFrisos' virar "1 mm" e
                // 'quantasDivisoesMoldura' virar "3 mm" (errado: sao contagens).
                // Decisao: usa o label original como fonte da verdade — se ele
                // termina com "(mm)", adiciona " mm" no valor; senao, deixa puro.
                const ehMm = /\(mm\)\s*$/i.test(meta.label);
                let lbl = meta.label.replace(/\s*\(mm\)\s*$/, '');
                let valor = `${item[c]}${ehMm ? ' mm' : ''}`;
                // Felipe sessao 13: customizacoes de DISPLAY na proposta
                // comercial (so' aqui — nao afeta form/cadastros).
                // - 'Padrao' vira frase explicativa
                // - 'Quantidade de molduras' vira 'Quantidade moldura por modulo'
                // - 'Distancia da borda a 1a moldura' vira '1ª' (ordinal feminino)
                // - 'Distancia da 1a a 2a' tambem -> '1ª a 2ª'
                if (c === 'tipoMoldura' && item[c] === 'Padrao') {
                  valor = 'Padrão — 2 molduras com divisão central centralizada ao eixo do cilindro';
                } else if (c === 'quantidadeMolduras') {
                  lbl = 'Quantidade moldura por módulo';
                } else if (c === 'distanciaBorda1aMoldura') {
                  lbl = 'Distancia da borda a 1ª moldura';
                } else if (c === 'distancia1a2aMoldura') {
                  lbl = 'Distancia da 1ª a 2ª moldura';
                } else if (c === 'distancia2a3aMoldura') {
                  lbl = 'Distancia da 2ª a 3ª moldura';
                }
                return `<div class="rel-prop-item-linha"><span class="lbl">${escapeHtml(lbl.toUpperCase())}:</span> <span>${escapeHtml(valor)}</span></div>`;
              }).join('');
            if (!linhas) return '';
            // Felipe sessao 13: nota explicativa quando o modelo tem moldura
            // (Mod 23) — 'devemos deixar explicito que chapa frontal e molduras
            // sao aluminio com pintura eletrostatica'.
            //
            // Felipe sessao 2026-05-10 (BUGFIX): a obs SO' faz sentido pro
            // caso Mod23 + Aluminio Macico (chapa AM frontal). Pra Mod23 +
            // ACM/HPL/Vidro, a chapa NAO eh aluminio - so' as molduras
            // (perfis Boiserie) sao. Falar "Chapa frontal em aluminio"
            // pra Mod23 ACM eh ENGANOSO no PDF da proposta.
            //
            // Sintoma reportado pelo Felipe: 'revestimento escolhido em
            // acm, proposta falando que e em aluminio macico totalmente
            // errado'.
            const ehMod23 = num === 23;
            const revLower = String(item.revestimento || '').toLowerCase();
            const ehAM = /alum[ií]n[ií]o.*maci[cç]o/.test(revLower) && /2\s*mm/.test(revLower);
            const notaPintura = (ehMod23 && ehAM)
              ? `<div class="rel-prop-item-linha" style="margin-top:6px;padding:6px 8px;background:#fff7e8;border-left:3px solid #d97706;border-radius:3px;font-size:11px;color:#7c3a00;font-style:italic;"><span style="font-weight:600;">Obs.:</span> Chapa frontal e molduras em alumínio com pintura eletrostática.</div>`
              : '';
            return `<div class="rel-prop-item-linhas rel-prop-item-modelo-vars">${linhas}${notaPintura}</div>`;
          })()}
          ${bannerAlisar}
        </div>
      </div>
    `;
  }

  /**
   * Felipe sessao 2026-08: card especifico pra REVESTIMENTO DE PAREDE
   * na proposta comercial. SEM IMAGEM (Felipe pediu: 'NOVA VISUALISACAO
   * COM CARACTERISTICA MAS SEM IMAGEM ALGUMA TRAGA SO AS VARIAVEIS DO
   * ITEM'). Largura 100% (ocupa todo card sem area de img).
   * Variaveis exibidas: Qtd, L_total, H_total, Area, Estrutura, Tubo,
   * Modo, e lista de pecas (largura/altura/cor por peca, se houver).
   */
  function renderCardItemPropostaRevestimento(item, idx, versao) {
    const lar = parseBR(item.largura_total) || 0;
    const alt = parseBR(item.altura_total) || 0;
    const areaM2 = (lar / 1000) * (alt / 1000);
    const qtd = Number(item.quantidade) || 1;
    const temEstr = item.temEstrutura === 'sim';
    const tubo = item.tuboEstrutura ? escapeHtml(item.tuboEstrutura) : '—';
    const modoTxt = (item.modo || 'manual').toUpperCase();

    // Felipe sessao 31: 'esta trazendo somente medidas da primeira parede,
    // ali tem varias preciso mostrar tudo que esta sendo considerado'.
    // Antes mostrava so item.pecas (do modo manual) com PECA 1. Agora
    // prioriza item.paredes[] (back-compat criado em runtime — linha
    // 2926+), que contem TODAS as paredes do revestimento, e mostra
    // todas como linhas PAREDE 1, PAREDE 2, ...
    let blocoPecas = '';
    const paredes = (Array.isArray(item.paredes) ? item.paredes : [])
      .filter(p => p && (Number(p.largura_total) > 0 || Number(p.altura_total) > 0));
    if (paredes.length) {
      const linhasP = paredes.map((p, i) => {
        const w = p.largura_total || '—';
        const h = p.altura_total || '—';
        const q = Number(p.quantidade) || 1;
        return `<div class="rel-prop-item-linha"><span class="lbl">PAREDE ${i + 1}:</span> <span>${w} × ${h} mm${q > 1 ? ` (qtd ${q})` : ''}</span></div>`;
      }).join('');
      blocoPecas = `<div class="rel-prop-item-linhas rel-prop-item-rev-pecas" style="margin-top:6px;border-top:1px solid #e5e7eb;padding-top:6px;">${linhasP}</div>`;
    } else {
      // Fallback antigo (modo manual com item.pecas)
      const pecas = (item.pecas || []).filter(p => p && (p.largura || p.altura || p.cor));
      if (pecas.length) {
        const linhasP = pecas.map((p, i) => {
          const w = p.largura || '—';
          const h = p.altura || '—';
          const c = p.cor ? escapeHtml(p.cor) : '—';
          const q = p.qtd || p.quantidade || 1;
          return `<div class="rel-prop-item-linha"><span class="lbl">PECA ${i + 1}:</span> <span>${w} × ${h} mm — ${c}${q > 1 ? ` (qtd ${q})` : ''}</span></div>`;
        }).join('');
        blocoPecas = `<div class="rel-prop-item-linhas rel-prop-item-rev-pecas" style="margin-top:6px;border-top:1px solid #e5e7eb;padding-top:6px;">${linhasP}</div>`;
      }
    }

    // Felipe sessao 31: badge 'Item N' no titulo do card pra alinhar com
    // outros cards (porta_externa). Antes nao aparecia em revestimento.
    const numItem = (typeof idx === 'number' && idx >= 0) ? (idx + 1) : null;
    const tituloBadge = numItem
      ? `<span class="rel-prop-item-num-badge" style="display:inline-block;background:#c46b20;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:8px;letter-spacing:0.05em;">ITEM ${String(numItem).padStart(2,'0')}</span>`
      : '';

    return `
      <div class="rel-prop-item-card rel-prop-item-card-no-img" style="display:flex;">
        <div class="rel-prop-item-info" style="width:100%;flex:1;">
          <div class="rel-prop-item-titulo">${tituloBadge}REVESTIMENTO DE PAREDE PROJETTA BY WEIKU</div>
          <div class="rel-prop-item-linhas">
            <div class="rel-prop-item-linha"><span class="lbl">Qtd:</span> <span>${qtd}</span></div>
            ${lar ? `<div class="rel-prop-item-linha"><span class="lbl">L total:</span> <span>${lar} mm</span></div>` : ''}
            ${alt ? `<div class="rel-prop-item-linha"><span class="lbl">H total:</span> <span>${alt} mm</span></div>` : ''}
            ${(lar && alt) ? `<div class="rel-prop-item-linha"><span class="lbl">Area:</span> <span>${fmtBR(areaM2)} m²</span></div>` : ''}
            <div class="rel-prop-item-linha"><span class="lbl">TEM ESTRUTURA:</span> <span>${temEstr ? 'SIM' : 'NAO'}</span></div>
            ${temEstr ? `<div class="rel-prop-item-linha"><span class="lbl">TUBO DA ESTRUTURA:</span> <span>${tubo}</span></div>` : ''}
          </div>
          ${blocoPecas}
        </div>
      </div>
    `;
  }

  // ============================================================
  // Felipe (do doc - msg wizard): helper que ANEXA um botao "Proximo"
  // no final do container da aba, pra avancar pro proximo passo do
  // wizard. Bloqueia avanco em casos especificos:
  //  - 'item': nao avanca se algum item esta incompleto
  // Cria a barra de acoes e attacha o handler de click.
  // ============================================================
  function adicionarBotaoWizard(container, tabAtual) {
    if (!window.OrcamentoWizard) return;
    const W = window.OrcamentoWizard;
    const proxId = W.proximaTab(tabAtual);
    if (!proxId) return; // ultima aba ('proposta'), sem botao
    const proxLabel = W.labelDaTab(proxId);

    // Detecta se a aba atual ja foi liberada pra avancar — se ja
    // estiver em etapa >= proxId, mostra label diferente ("Ir para X")
    // mas o botao continua funcionando (re-confirma o avanco).
    const versao = _getVersaoAtivaWizard();
    const ixMax  = W.indiceEtapa(W.getEtapaMaxima());
    const ixProx = W.indiceEtapa(proxId);
    const jaLiberado = ixMax >= ixProx;

    // Validacao especifica por aba
    let bloqueado = false;
    let msgBloqueio = '';
    let pendList = []; // Felipe (sessao 2026-05): lista de pendencias por campo zerado
    if (tabAtual === 'item') {
      // Felipe: nao deixa avancar se algum item esta incompleto
      if (versao && algumItemIncompleto(versao)) {
        bloqueado = true;
        msgBloqueio = 'Preencha todas as caracteristicas dos itens antes de avancar.';
      }
    }
    if (tabAtual === 'fab-inst') {
      // Felipe (sessao 2026-05): bloqueio expandido — todos os campos
      // criticos do Fab/Inst que estao em zero/vazio bloqueiam o avanco.
      // Cada item pode ser confirmado como "zerado intencional" para
      // liberar o avanco — UX inline (botao no proprio aviso).
      if (versao) {
        pendList = coletarPendenciasFabInst(versao);
        if (pendList.length > 0) {
          bloqueado = true;
          msgBloqueio = `${pendList.length} campo${pendList.length === 1 ? '' : 's'} em zero/vazio. Confirme cada um abaixo OU preencha o valor.`;
        }
      }
    }

    const barra = document.createElement('div');
    barra.className = 'orc-wizard-actions';

    // Bloco de pendencias inline (so' aparece se ha campos zerados)
    let pendInlineHtml = '';
    if (bloqueado && pendList.length > 0) {
      const itensHtml = pendList.map(p => `
        <li class="orc-wizard-pend-row" data-chave="${escapeHtml(p.chave)}">
          <span class="orc-wizard-pend-label">
            <span class="orc-wizard-pend-secao">${escapeHtml(p.secao)}</span>
            ${escapeHtml(p.label)}
          </span>
          <button type="button" class="orc-wizard-pend-btn"
                  data-chave="${escapeHtml(p.chave)}"
                  title="Confirma que este campo deve ficar mesmo em zero">
            ☑ Item zerado
          </button>
        </li>
      `).join('');
      pendInlineHtml = `
        <details class="orc-wizard-pend-details" open>
          <summary class="orc-wizard-pend-summary">
            Ver e marcar campos zerados (${pendList.length})
          </summary>
          <ul class="orc-wizard-pend-lista">${itensHtml}</ul>
        </details>
      `;
    }

    barra.innerHTML = `
      ${bloqueado ? `<div class="orc-wizard-aviso">⚠ ${escapeHtml(msgBloqueio)}</div>` : ''}
      ${pendInlineHtml}
      <button type="button" class="orc-wizard-btn-proximo${bloqueado ? ' is-disabled' : ''}" ${bloqueado ? 'disabled' : ''}>
        ${jaLiberado ? 'Ir' : 'Proximo'}: ${escapeHtml(proxLabel)} →
      </button>
    `;
    container.appendChild(barra);

    // Handler dos botoes "Item zerado" — marca o campo e re-renderiza
    // a aba para reavaliar bloqueios.
    barra.querySelectorAll('.orc-wizard-pend-btn').forEach(b => {
      b.addEventListener('click', () => {
        const chave = b.dataset.chave;
        if (!chave || !versao) return;
        marcarZeradoIntencional(versao.id, chave, true);
        // Re-renderiza a aba atual pra atualizar contagem de pendencias
        if (window.App && App.navigateTo) {
          App.navigateTo('orcamento', tabAtual);
        }
      });
    });
    const btn = barra.querySelector('.orc-wizard-btn-proximo');
    if (btn && !bloqueado) {
      btn.addEventListener('click', () => W.avancar(tabAtual));
    }

    // Felipe (sessao 09): botao duplicado NO TOPO — SEMPRE aparece
    // (desabilitado se bloqueado). "Quero todas as abas com botao
    // em cima e em baixo."
    {
      const barraTopo = document.createElement('div');
      barraTopo.className = 'orc-wizard-actions orc-wizard-actions-top';
      barraTopo.innerHTML = `
        <button type="button" class="orc-wizard-btn-proximo${bloqueado ? ' is-disabled' : ''}" ${bloqueado ? 'disabled' : ''}>
          ${jaLiberado ? 'Ir' : 'Proximo'}: ${escapeHtml(proxLabel)} →
        </button>
      `;
      if (!bloqueado) {
        barraTopo.querySelector('.orc-wizard-btn-proximo')
          .addEventListener('click', () => W.avancar(tabAtual));
      }
      container.prepend(barraTopo);
    }
  }

  // ============================================================
  //                      ABA: RELATORIOS
  // ============================================================
  /**
   * Felipe (sessao 2026-05): aba "Levantamento de Superficies" mostra
   * as PEÇAS DE CHAPA geradas pelo motor para cada item do orcamento.
   *
   * Pra cada item:
   *   - Cabeçalho: nome do item + dimensoes do QUADRO (limite das pecas)
   *   - 2 sub-listas: peças do LADO EXTERNO e peças do LADO INTERNO
   *     (cada lado calcula separado, mesmo se cores forem iguais).
   *
   * Cada peça tem: descricao (com lado + cor pra rastrear no planificador),
   * dimensoes em mm, qtd, e flag "podeRotacionar" (false pra cores Wood
   * com veio).
   *
   * Etapas pendentes (proximas rodadas):
   *   - Algoritmo de aproveitamento (nesting) — Etapa 2
   *   - UI de comparacao entre tamanhos de chapa-mae (4 cards) — Etapa 5
   *   - Botao "Usar resultado" → injeta no DRE (custoFab.total_revestimento)
   *   - Import/Export XLSX (3 abas: Pecas, Chapas-mae, Layout)
   */
  function renderLevSuperficiesTab(container) {
    inicializarSessao();
    const r = obterVersao(UI.versaoAtivaId);
    if (!r || !r.versao) {
      container.innerHTML = `
        <div class="info-banner">
          <span class="t-strong">Sem versao ativa.</span>
          Volte para o CRM e abra um negocio para ver as pecas de chapa.
        </div>`;
      return;
    }
    const versao = r.versao;
    // Felipe (sessao 2026-05): processa TODOS os itens com tipo definido,
    // nao so porta_externa. Multiplos itens (3 portas, 1 revestimento, etc)
    // sao todos considerados juntos — peças com cores iguais sao agrupadas
    // na mesma chapa-mae no aproveitamento.
    const itens = (versao.itens || []).filter(it => it && it.tipo);

    if (!itens.length) {
      container.innerHTML = `
        <div class="info-banner">
          Nenhum item nesta versao. Volte para "Caracteristicas do Item"
          e adicione itens (Porta Externa, Revestimento de Parede, etc).
        </div>`;
      return;
    }

    if (!window.ChapasPortaExterna) {
      container.innerHTML = `
        <div class="info-banner orc-banner-aviso-erro">
          Motor de chapas (ChapasPortaExterna) nao carregado. Recarregue a pagina (Ctrl+F5).
        </div>`;
      return;
    }
    if (!window.ChapasAproveitamento) {
      container.innerHTML = `
        <div class="info-banner orc-banner-aviso-erro">
          Motor de aproveitamento (ChapasAproveitamento) nao carregado. Recarregue a pagina (Ctrl+F5).
        </div>`;
      return;
    }

    // Coleta TODAS as peças de TODOS os itens, agrupadas por cor
    const pecasPorCor = coletarPecasPorCor(itens);

    // Felipe (sessao 2026-05): pega lista de superficies pra calculo
    // de peso individual das pecas. Usa Superficies.listar() (dispara
    // seed automaticamente se vazio) ou fallback do storage.
    const todasSupGlobal = (window.Superficies?.listar?.())
      || (window.Storage?.scope?.('cadastros').get('superficies_lista'))
      || [];

    // Renderiza um bloco por item — porta_externa mostra peças completas;
    // outros tipos (revestimento_parede, etc) mostram aviso "ainda nao implementado".
    const blocosItens = itens.map((item, idx) => renderItemSuperficies(item, idx, todasSupGlobal)).join('');
    const blocosAproveitamento = renderAproveitamentoChapas(pecasPorCor);

    // Felipe (sessao 2026-06): SYNC AUTOMATICO do total_revestimento
    // ao abrir a aba. Antes, se o usuario selecionasse chapas em cores
    // diferentes em momentos diferentes, o handler de duplo clique
    // calculava o total mas as listeners acumuladas (memory leak por
    // re-render) podiam capturar valores stale. Resultado: campo
    // "Revestimento (R$)" no Custo Fab/Inst pegava so' uma cor
    // (R$ 8.645,90) em vez do total (R$ 22.479,35).
    // Solucao: sempre que a aba renderiza, recalcula e sincroniza.
    try {
      const rSync = obterVersao(UI.versaoAtivaId);
      if (rSync && rSync.versao && rSync.versao.status !== 'fechada') {
        const totalRevSync = computeRevestimentoPorCor(rSync.versao, pecasPorCor, todasSupGlobal).total;
        const fabAtual = Object.assign({}, FAB_DEFAULT, rSync.versao.custoFab || {});
        const dif = Math.abs((Number(fabAtual.total_revestimento) || 0) - totalRevSync);
        if (dif > 0.01) {
          fabAtual.total_revestimento = totalRevSync;
          const rFabSync = calcularFab(fabAtual, rSync.versao.itens);
          atualizarVersao(rSync.versao.id, {
            custoFab: fabAtual,
            subFab: rFabSync.total,
          });
        }
      }
    } catch (errSync) {
      console.warn('[Lev Superficies] sync total_revestimento falhou:', errSync);
    }

    // Conta quantos itens de cada tipo pra resumo no topo
    const portasCnt = itens.filter(i => i.tipo === 'porta_externa').length;
    const revsCnt   = itens.filter(i => i.tipo === 'revestimento_parede').length;
    const fixosCnt  = itens.filter(i => i.tipo === 'fixo_acoplado').length;
    const portasIntCnt = itens.filter(i => i.tipo === 'porta_interna').length;
    const cntsTxt = [];
    if (portasCnt) cntsTxt.push(`${portasCnt} porta${portasCnt > 1 ? 's' : ''} externa${portasCnt > 1 ? 's' : ''}`);
    if (portasIntCnt) cntsTxt.push(`${portasIntCnt} porta${portasIntCnt > 1 ? 's' : ''} interna${portasIntCnt > 1 ? 's' : ''}`);
    if (fixosCnt) cntsTxt.push(`${fixosCnt} fixo${fixosCnt > 1 ? 's' : ''}`);
    if (revsCnt)  cntsTxt.push(`${revsCnt} revestimento${revsCnt > 1 ? 's' : ''} de parede`);

    container.innerHTML = `
      <div class="orc-lev-sup-banner-recalc" style="display:none;
           position:sticky;top:0;z-index:10;background:#fef3c7;
           border:1px solid #f59e0b;border-radius:6px;padding:10px 14px;
           margin-bottom:12px;display:flex;justify-content:space-between;
           align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="color:#78350f;font-size:13px;font-weight:600;">
          ⚠️ Você alterou valores. Clique em <b>Salvar</b> pra aplicar.
        </span>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="orc-lev-sup-btn-resetar-tudo"
                  title="Descartar todas as edicoes manuais deste item e voltar ao calculo padrao do motor"
                  style="background:#fff;color:#78350f;border:1px solid #f59e0b;border-radius:5px;
                         padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;">
            ↩ Voltar ao Padrão
          </button>
          <button type="button" class="orc-lev-sup-btn-recalcular"
                  title="Salvar as edicoes manuais e recalcular peso/aproveitamento"
                  style="background:#d97706;color:#fff;border:none;border-radius:5px;
                         padding:7px 16px;font-size:13px;font-weight:600;cursor:pointer;">
            💾 Salvar
          </button>
        </div>
      </div>
      <div class="orc-wizard-actions orc-wizard-actions-top">
        <button type="button" class="orc-wizard-btn-proximo orc-btn-proxima-aba" data-aba-destino="fab-inst">
          Proxima pagina: Custo de Fabricacao e Instalacao →
        </button>
      </div>
      <div class="orc-section orc-lev-superficies-header">
        <div class="orc-section-title">Levantamento de Superficies (Chapas)</div>
        <p class="orc-hint-text">
          ${itens.length} item${itens.length > 1 ? 's' : ''} no orcamento (${cntsTxt.join(' + ')}).
          Cada porta gera peças do <b>lado externo</b> (cor externa) e
          <b>lado interno</b> (cor interna). Quando a cor é igual nos 2
          lados, as peças sao somadas numa lista só. Pecas da CAVA usam a
          cor da cava (se preenchida) ou herdam a cor do lado.
        </p>
        <p class="orc-hint-text">
          <b>Múltiplos itens</b>: o algoritmo agrupa peças de
          <b>cores iguais</b> (independente do item de origem) numa
          mesma chapa-mãe. Cores distintas viram chapas-mãe separadas.
        </p>
        <div class="orc-lev-sup-actions">
          <button type="button" class="orc-btn-link" data-acao="recalcular"
                  title="Reaplica os overrides Sim/Nao e recalcula peso e aproveitamento">
            ↻ Recalcular
          </button>
          <!-- Felipe (sessao 2026-06): "elimine exportar e importar xml"
               — removidos os botoes XML. Mantidos os de Excel (.xlsx)
               porque Felipe usa Excel pra editar overrides Rotaciona. -->
          <button type="button" class="orc-btn-link" data-acao="exportar-modelo-xlsx"
                  title="Baixa um arquivo Excel (.xlsx) com todas as pecas atuais. Edite a coluna Rotaciona e reimporte.">
            ↓ Exportar Modelo Excel
          </button>
          <button type="button" class="orc-btn-link" data-acao="importar-xlsx"
                  title="Importa overrides de Rotaciona Sim/Nao a partir do Excel">
            ↑ Importar Excel
          </button>
          <input type="file" class="orc-lev-sup-file-input"
                 accept=".xml,application/xml,text/xml"
                 style="display:none;">
          <input type="file" class="orc-lev-sup-file-input-xlsx"
                 accept=".xlsx,.xls,.csv"
                 style="display:none;">
        </div>
      </div>
      ${blocosItens}
      ${blocosAproveitamento}

      <!-- Felipe (sessao 30): "ja pedi pra tirar esse relatorio das
           chapas ficou horrivel". Bloco "Relatorio de Chapas" + botoes
           PNG/PDF removidos da aba Lev. Superficies. Funcao
           renderRelChapas continua disponivel pra outras abas (ex:
           Relatorios) caso seja chamada. Handlers PNG/PDF removidos
           junto pra nao gerarem erro. -->

      <div class="orc-aba-rodape">
        ${(() => {
          // Felipe sessao 2026-08: aviso visual quando ainda faltam
          // cores sem chapa-mae selecionada explicitamente. Ajuda
          // Felipe a ver na hora que precisa dar duplo clique antes
          // de avancar (alem do alert que aparece se clicar Proxima).
          const cores = Object.keys(pecasPorCor || {});
          if (cores.length === 0) return '';
          const sel = versao.chapasSelecionadas || {};
          const faltando = cores.filter(cor => !sel[cor]);
          if (faltando.length === 0) return '';
          return `
            <div style="background:#fff8ed;border:1px solid #fed7aa;border-left:4px solid #c46b20;padding:10px 14px;border-radius:6px;margin-bottom:12px;font-size:13px;color:#7c2d12;">
              <b>⚠️ Selecione qual chapa-mae vai usar</b> antes de avancar pra proxima pagina.<br>
              Falta${faltando.length > 1 ? 'm' : ''} <b>${faltando.length}</b> cor${faltando.length > 1 ? 'es' : ''}: ${faltando.map(c => '<code style="background:#fde6c5;padding:1px 5px;border-radius:3px;font-size:11px;">' + escapeHtml(c) + '</code>').join(' ')}<br>
              <small style="color:#9a3412;">Faca <b>duplo clique</b> na opcao desejada (a destacada em verde e\\' a mais economica).</small>
            </div>
          `;
        })()}
        <button type="button" class="orc-btn-proxima-aba" data-aba-destino="fab-inst">
          Proxima pagina: Custo de Fabricacao e Instalacao →
        </button>
      </div>
    `;

    // Felipe (sessao 30): handlers PNG/PDF do "Relatorio de Chapas"
    // removidos junto com o bloco. Cliente nao usado mais aqui.
    // const cliente = (lerLeadAtivo()?.cliente || 'cliente');

    // Felipe (sessao 2026-05): bind delegado pros botoes "Ver layout"
    // e tabs entre chapas. Como o HTML e' gerado como string, usamos
    // delegacao no container.
    // Felipe sessao 12: GUARD anti-duplicacao. renderLevSuperficiesTab e'
    // chamada em varios momentos (recalcular, navegar entre abas e voltar).
    // Cada chamada estava adicionando OUTRO listener no mesmo container.
    // Resultado: 2 listeners abrem+fecham (toggle 2x = invisivel), 3
    // listeners abrem (3x toggle = visivel), 4 fecham. Bug "tem hora que
    // abre, hora que nao". Agora flag persistente impede registro duplo.
    if (!container._levSupListenersAdded) {
      container._levSupListenersAdded = true;
      container.addEventListener('click', (e) => {
      // Toggle do layout (botao "Ver layout de corte")
      const btnLayout = e.target.closest('[data-toggle-layout]');
      if (btnLayout) {
        // Felipe (sessao 2026-06): "clico em ver layout e nao vai tenho
        // que passar para aba seguinte voltar para ai sim conseguir ver
        // layout". Causa raiz: o handler usava document.getElementById,
        // que pega o PRIMEIRO elemento com esse id no documento inteiro.
        // Se renderizacoes anteriores deixaram elementos com mesmo id
        // (DOM stale), o getElementById pegava o errado e o toggle
        // afetava um layout invisivel. Agora busca RELATIVO ao botao
        // clicado — funciona sempre, em qualquer estado do DOM.
        const cardWrap = btnLayout.closest('.orc-aprov-card-wrap');
        const layoutEl = cardWrap?.querySelector('.orc-aprov-layout-wrap');
        if (!layoutEl) return;
        const visivel = layoutEl.style.display !== 'none';
        layoutEl.style.display = visivel ? 'none' : '';
        btnLayout.textContent = visivel ? '📐 Ver layout de corte' : '✕ Esconder layout';
        return;
      }

      // ========================================================
      // Felipe (sessao 2026-05): botoes da toolbar de superficies
      // ========================================================
      // Recalcular: re-renderiza a aba inteira (re-aplica overrides
      // Sim/Nao e recalcula peso/aproveitamento). Sem chamadas externas
      // — so' regera HTML a partir da versao atual.
      const btnRecalc = e.target.closest('[data-acao="recalcular"]');
      if (btnRecalc) {
        renderLevSuperficiesTab(container);
        if (window.showSavedDialog) {
          window.showSavedDialog('Recalculo concluido — pesos e aproveitamento atualizados.');
        }
        return;
      }

      // Exportar modelo XML: gera arquivo com todas as pecas + flag
      // Sim/Nao atual. Felipe edita e reimporta.
      const btnExpXml = e.target.closest('[data-acao="exportar-modelo-xml"]');
      if (btnExpXml) {
        try {
          // Felipe sessao 12: itens FRESH do storage (closure stale)
          const rExp = obterVersao(UI.versaoAtivaId);
          const itensFresh = (rExp && rExp.versao && rExp.versao.itens) || itens;
          const xml = gerarModeloXmlSuperficies(itensFresh);
          const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
          a.href = url;
          a.download = `projetta-superficies-modelo-${stamp}.xml`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (err) {
          console.error('[Lev Superficies] erro ao exportar XML:', err);
          alert('Erro ao gerar XML: ' + err.message);
        }
        return;
      }

      // Importar XML: dispara o file picker.
      const btnImpXml = e.target.closest('[data-acao="importar-xml"]');
      if (btnImpXml) {
        const fileInput = container.querySelector('.orc-lev-sup-file-input');
        if (fileInput) fileInput.click();
        return;
      }

      // Felipe (sessao 2026-06): Exportar Modelo Excel — paralelo ao XML.
      const btnExpXlsx = e.target.closest('[data-acao="exportar-modelo-xlsx"]');
      if (btnExpXlsx) {
        try {
          // Felipe sessao 12: itens FRESH do storage
          const rExpX = obterVersao(UI.versaoAtivaId);
          const itensFreshX = (rExpX && rExpX.versao && rExpX.versao.itens) || itens;
          const { headers, rows } = gerarModeloXlsxSuperficies(itensFreshX);
          if (window.Universal?.exportXLSX) {
            window.Universal.exportXLSX({
              headers, rows,
              sheetName: 'Superficies',
              fileName: 'projetta-superficies-modelo',
            });
          } else {
            alert('Modulo Universal.exportXLSX nao disponivel.');
          }
        } catch (err) {
          console.error('[Lev Superficies] erro ao exportar XLSX:', err);
          alert('Erro ao gerar Excel: ' + err.message);
        }
        return;
      }

      // Felipe (sessao 2026-06): Importar Excel — dispara file picker xlsx.
      const btnImpXlsx = e.target.closest('[data-acao="importar-xlsx"]');
      if (btnImpXlsx) {
        const fileInputX = container.querySelector('.orc-lev-sup-file-input-xlsx');
        if (fileInputX) fileInputX.click();
        return;
      }

      // Tab entre chapas (Chapa 1, Chapa 2...)
      // Felipe (sessao 27 fix): "ainda dificuldade para abrir layout
      // tenho que ir de uma pagina pra outra". Antes: clicar na tab
      // SO trocava o SVG visivel embaixo, e ele tinha que clicar no
      // SVG pra abrir modal. Agora: clicar na tab JA abre o modal
      // direto na chapa correspondente.
      const btnTab = e.target.closest('[data-tab-chapa]');
      if (btnTab) {
        const cardId = btnTab.dataset.card;
        const idx = btnTab.dataset.tabChapa;
        const layoutEl = document.getElementById(`${cardId}-layout`);
        if (!layoutEl) return;
        // Atualiza estado visual das tabs e SVGs (mantém comportamento original
        // pra quando o usuario nao quer abrir modal — alguma tab/SVG fica certo).
        layoutEl.querySelectorAll('.orc-aprov-svg-wrap').forEach(el => {
          el.style.display = (el.dataset.chapaIdx === idx) ? '' : 'none';
        });
        layoutEl.querySelectorAll('.orc-aprov-svg-tab').forEach(el => {
          el.classList.toggle('is-active', el.dataset.tabChapa === idx);
        });
        // Felipe (sessao 27): ABRIR MODAL com essa chapa direto.
        const layoutWrap = btnTab.closest('.orc-aprov-layout');
        if (layoutWrap) {
          const titulo = layoutWrap.querySelector('.orc-aprov-layout-titulo')?.textContent || 'Layout de Corte';
          const todosSvgs = Array.from(layoutWrap.querySelectorAll('.orc-aprov-svg-wrap'));
          const lista = todosSvgs.map((wrap, i) => {
            const svgEl = wrap.querySelector('svg.orc-aprov-svg');
            const tab = layoutWrap.querySelector(`.orc-aprov-svg-tab[data-tab-chapa="${i}"]`);
            const titChapa = tab?.textContent?.trim() || `Chapa ${i + 1}`;
            return { svg: svgEl ? svgEl.outerHTML : '', titulo: titChapa };
          }).filter(x => x.svg);
          if (lista.length > 0 && typeof abrirModalLayout === 'function') {
            abrirModalLayout(lista, titulo, parseInt(idx, 10) || 0);
          }
        }
        return;
      }

      // Felipe (sessao 2026-05): botao "Proxima pagina" — usa o
      // Wizard pra AVANCAR (libera a proxima etapa + navega).
      // Antes a gente so' clicava na aba, mas isso nao liberava o
      // wizard, entao caia no alerta "esta bloqueada".
      const btnProx = e.target.closest('[data-aba-destino]');
      if (btnProx) {
        const destino = btnProx.dataset.abaDestino;
        // Felipe sessao 2026-08: 'nao deixe passar para proxima pagina
        // sem selecionar qual chapa vou usar'. Valida que todas as
        // cores tem selecao explicita em chapasSelecionadas. Se faltar,
        // bloqueia com alerta listando as cores pendentes.
        //
        // Felipe sessao 18: 'chapa ja selecionada e nao deixa seguir em
        // frente'. Cores que aparecem em pecasPorCor mas nao tem CARD
        // selecionavel no DOM (sem variante de chapa-mae no cadastro,
        // ou todas as chapas sao inviaveis) eram listadas como
        // 'faltando selecao' — mas nao tinha como selecionar! Bloqueava
        // o avanco indevidamente.
        //
        // FIX: filtra cores pra incluir SO' aquelas com bloco
        // [data-cor-validar="..."] no DOM (= bloco principal com cards
        // selecionaveis renderizado por renderBlocoCor return 12431).
        // Blocos 'aguardando' (sem cadastro), 'inviavel' (chapa pequena
        // demais) e '(sem cor)' nao tem esse marcador e nao entram na
        // validacao.
        const cores = Object.keys(pecasPorCor || {});
        const coresSelecionaveis = new Set();
        container.querySelectorAll('[data-cor-validar]').forEach(div => {
          const c = div.getAttribute('data-cor-validar');
          if (c) coresSelecionaveis.add(c);
        });
        if (cores.length > 0) {
          // Re-le versao do storage pra pegar selecoes recem-feitas
          // (closure 'versao' pode estar stale apos duplo-clique).
          const vAtual = obterVersao(UI.versaoAtivaId)?.versao;
          const sel = (vAtual && vAtual.chapasSelecionadas) || {};
          const faltando = cores.filter(cor => coresSelecionaveis.has(cor) && !sel[cor]);
          if (faltando.length > 0) {
            const lista = faltando.map(c => '  • ' + c).join('\n');
            alert(
              '⚠️  Selecione qual chapa-mae vai usar antes de avancar!\n\n' +
              `Falta${faltando.length > 1 ? 'm' : ''} ${faltando.length} cor${faltando.length > 1 ? 'es' : ''} sem selecao explicita:\n` +
              lista + '\n\n' +
              'Faca DUPLO CLIQUE na opcao desejada (ex: 1500 × 6000 mm — 3 chapas).\n' +
              'A opcao destacada em verde e\' a mais economica, mas voce precisa\n' +
              'confirmar a escolha pra travar o calculo.'
            );
            // Rola ate a primeira cor sem selecao pra Felipe ver onde clicar
            try {
              const blocoChapas = container.querySelector('.orc-aprov-chapas, [data-aprov-cor]');
              if (blocoChapas) blocoChapas.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch(_){}
            return;
          }
        }
        if (window.OrcamentoWizard?.avancar) {
          // 'lev-superficies' e' a aba atual; avancar() libera a proxima
          // (que e' fab-inst) e ja navega pra ela.
          const ok = window.OrcamentoWizard.avancar('lev-superficies');
          if (!ok) {
            console.warn('[Aproveitamento] avancar wizard falhou, tentando navegacao direta');
            const tabBtn = document.querySelector(`button.sub-nav-item[data-tab="${destino}"]`);
            tabBtn?.click();
          }
        } else {
          // Fallback: clica direto na aba (caso wizard nao esteja disponivel)
          const tabBtn = document.querySelector(`button.sub-nav-item[data-tab="${destino}"]`);
          if (tabBtn) {
            if (tabBtn.classList.contains('is-locked')) {
              alert('A proxima aba esta bloqueada. Conclua os requisitos primeiro.');
              return;
            }
            tabBtn.click();
          }
        }
        return;
      }

      // Felipe (sessao 2026-05): clique no SVG abre modal de zoom
      // com TODAS as chapas dessa configuracao (pra Felipe navegar
      // entre Chapa 1, Chapa 2, Chapa 3, Chapa 4 com setas/botoes).
      const svgClick = e.target.closest('.orc-aprov-svg-wrap');
      if (svgClick) {
        const layoutWrap = svgClick.closest('.orc-aprov-layout');
        if (!layoutWrap) return;
        const titulo = layoutWrap.querySelector('.orc-aprov-layout-titulo')?.textContent || 'Layout de Corte';
        // Pega TODOS os SVGs (um por chapa) do layout
        const todosSvgs = Array.from(layoutWrap.querySelectorAll('.orc-aprov-svg-wrap'));
        const lista = todosSvgs.map((wrap, i) => {
          const svgEl = wrap.querySelector('svg.orc-aprov-svg');
          // Acha a tab correspondente pra pegar o titulo (ex: "Chapa 2 47%")
          const tab = layoutWrap.querySelector(`.orc-aprov-svg-tab[data-tab-chapa="${i}"]`);
          const titChapa = tab?.textContent?.trim() || `Chapa ${i + 1}`;
          return {
            svg: svgEl ? svgEl.outerHTML : '',
            titulo: titChapa,
          };
        }).filter(x => x.svg);
        // Indice da chapa que estava VISIVEL quando clicou (a que tinha display != none)
        const idxClicado = todosSvgs.findIndex(w => w === svgClick);
        abrirModalLayout(lista, titulo, idxClicado >= 0 ? idxClicado : 0);
        return;
      }
    });

    // ========================================================
    // Felipe (sessao 2026-05): listener CHANGE pra:
    //   1) Select editavel de Rotaciona Sim/Nao por linha
    //   2) File input do "Importar XML"
    // ========================================================
    container.addEventListener('change', (e) => {
      // 1. Select Sim/Nao — salva override no item e persiste no storage
      const sel = e.target.closest('.orc-lev-sup-rot-select');
      if (sel) {
        const idx = Number(sel.dataset.itemIdx);
        const chave = sel.dataset.pecaKey;
        const valor = sel.value === 'sim' ? 'sim' : 'nao';
        // Felipe sessao 12: le itens FRESH do storage (closure 'itens' eh
        // da primeira render, vira stale apos re-renders). Bug: 'AO MUDAR
        // ALGUMA CHAPA NAO ESTA SALVANDO E RECALCULANDO'.
        const r = obterVersao(UI.versaoAtivaId);
        if (!r || !r.versao) return;
        const item = (r.versao.itens || [])[idx];
        if (!item) return;
        if (!item.rotacionaOverrides) item.rotacionaOverrides = {};
        item.rotacionaOverrides[chave] = valor;
        // Atualiza visual da celula (laranja se Nao)
        const cell = sel.closest('.orc-lev-sup-rot-cell');
        if (cell) cell.classList.toggle('t-warn', valor === 'nao');
        try {
          atualizarVersao(r.versao.id, { itens: r.versao.itens });
        } catch (err) {
          console.warn('[Lev Superficies] erro ao salvar override:', err);
        }
        return;
      }
      // Felipe sessao 12: input editavel de rev_parede (Largura/Altura/Qtd).
      // Salva DIRETO em item.superficiesOverrides[chave] - rev_parede nao
      // tem motor pesado igual porta_externa, entao salvar direto eh OK
      // (sem banner Recalcular). Aplica em proxima leitura.
      const inpRevEdit = e.target.closest('input[data-rev-edit]');
      if (inpRevEdit) {
        const idx = Number(inpRevEdit.dataset.itemIdx);
        const chave = inpRevEdit.dataset.pecaKey;
        const campo = inpRevEdit.dataset.revEdit;
        const valor = Number(inpRevEdit.value);
        if (!Number.isFinite(valor) || valor <= 0) return;
        const r = obterVersao(UI.versaoAtivaId);
        if (!r || !r.versao) return;
        const item = (r.versao.itens || [])[idx];
        if (!item || item.tipo !== 'revestimento_parede') return;
        if (!item.superficiesOverrides) item.superficiesOverrides = {};
        if (!item.superficiesOverrides[chave]) item.superficiesOverrides[chave] = {};
        item.superficiesOverrides[chave][campo] = valor;
        // Visual: marca como editado (azul)
        inpRevEdit.classList.add('orc-lev-sup-input-editado');
        try {
          atualizarVersao(r.versao.id, { itens: r.versao.itens });
        } catch (err) {
          console.warn('[Lev Sup rev_parede] erro ao salvar override:', err);
        }
        return;
      }
      // Felipe sessao 2026-08: input editavel de Largura/Altura/Qtd. Marca
      // a peca como pendente (visual laranja) e mostra banner Recalcular.
      // Persistencia so' acontece quando user clica Recalcular.
      const inpEdit = e.target.closest('.orc-lev-sup-input-edit');
      if (inpEdit) {
        // Marca o input como modificado (visual)
        inpEdit.classList.add('orc-lev-sup-input-pendente');
        // Mostra banner Recalcular
        const banner = container.querySelector('.orc-lev-sup-banner-recalc');
        if (banner) banner.style.display = '';
        return;
      }
      // 2. File input — usuario escolheu arquivo XML
      const fileInput = e.target.closest('.orc-lev-sup-file-input');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const f = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const xml = String(ev.target.result || '');
            // Felipe sessao 12: itens FRESH (closure stale apos re-renders)
            const rImp = obterVersao(UI.versaoAtivaId);
            const itensImp = (rImp && rImp.versao && rImp.versao.itens) || itens;
            const res = importarOverridesXml(xml, itensImp);
            if (res.aplicados > 0) {
              try {
                if (rImp && rImp.versao) {
                  atualizarVersao(rImp.versao.id, { itens: itensImp });
                }
              } catch (err) {
                console.warn('[Lev Superficies] erro ao salvar XML:', err);
              }
            }
            // Mostra resumo
            const linhas = [
              `Importacao concluida.`,
              `  • ${res.aplicados} override(s) aplicado(s)`,
              `  • ${res.ignorados} entrada(s) ignorada(s) (peca nao encontrada ou valor invalido)`,
            ];
            if (res.erros.length) linhas.push('Erros:\n  - ' + res.erros.join('\n  - '));
            alert(linhas.join('\n'));
            // Re-renderiza pra mostrar os novos valores nos selects
            renderLevSuperficiesTab(container);
          } catch (err) {
            console.error('[Lev Superficies] erro ao importar XML:', err);
            alert('Erro ao importar XML: ' + err.message);
          }
        };
        reader.onerror = () => alert('Falha ao ler arquivo: ' + (reader.error?.message || 'desconhecido'));
        reader.readAsText(f, 'UTF-8');
        // Reseta input pra permitir re-importar mesmo arquivo se quiser
        fileInput.value = '';
        return;
      }

      // Felipe (sessao 2026-06): 3. File input XLSX — usuario escolheu .xlsx
      const fileInputX = e.target.closest('.orc-lev-sup-file-input-xlsx');
      if (fileInputX && fileInputX.files && fileInputX.files[0]) {
        const fX = fileInputX.files[0];
        if (!window.Universal?.readXLSXFile) {
          alert('Modulo Universal.readXLSXFile nao disponivel.');
          fileInputX.value = '';
          return;
        }
        window.Universal.readXLSXFile(fX, (aoa) => {
          try {
            // Felipe sessao 12: itens FRESH (closure stale)
            const rImpX = obterVersao(UI.versaoAtivaId);
            const itensImpX = (rImpX && rImpX.versao && rImpX.versao.itens) || itens;
            const res = importarOverridesXlsx(aoa, itensImpX);
            if (res.aplicados > 0) {
              try {
                if (rImpX && rImpX.versao) {
                  atualizarVersao(rImpX.versao.id, { itens: itensImpX });
                }
              } catch (err) {
                console.warn('[Lev Superficies] erro ao salvar XLSX:', err);
              }
            }
            const linhas = [
              `Importacao Excel concluida.`,
              `  • ${res.aplicados} override(s) aplicado(s)`,
              `  • ${res.ignorados} entrada(s) ignorada(s) (peca nao encontrada ou valor invalido)`,
            ];
            if (res.erros.length) linhas.push('Erros:\n  - ' + res.erros.join('\n  - '));
            alert(linhas.join('\n'));
            renderLevSuperficiesTab(container);
          } catch (err) {
            console.error('[Lev Superficies] erro ao importar XLSX:', err);
            alert('Erro ao importar Excel: ' + err.message);
          }
        });
        fileInputX.value = '';
        return;
      }
    });

    // Felipe sessao 2026-08: listener CLICK pra botoes da edicao manual de
    // superficies/chapas - botao + (adicionar peca), 🗑 (remover manual),
    // ↺ (resetar override pra valor original), 🔄 Recalcular (salva todos
    // os pendentes e re-renderiza a aba).
    container.addEventListener('click', (e) => {
      // 1. Botao "+ adicionar peca manual"
      const btnAdd = e.target.closest('.orc-lev-sup-btn-add-peca');
      if (btnAdd) {
        const idx = Number(btnAdd.dataset.itemIdx);
        const corLado = btnAdd.dataset.cor || '';
        // Felipe sessao 12: le itens fresh do storage (closure stale)
        const r1 = obterVersao(UI.versaoAtivaId);
        if (!r1 || !r1.versao) return;
        const item = (r1.versao.itens || [])[idx];
        if (!item) return;
        // Pega os inputs da linha de adicionar (mesmo data-item-idx)
        const linhaAdd = btnAdd.closest('tr');
        const labelInp = linhaAdd.querySelector('.orc-lev-sup-input-add-label');
        const catInp   = linhaAdd.querySelector('.orc-lev-sup-input-add-cat');
        const largInp  = linhaAdd.querySelector('.orc-lev-sup-input-add-largura');
        const altInp   = linhaAdd.querySelector('.orc-lev-sup-input-add-altura');
        const qtdInp   = linhaAdd.querySelector('.orc-lev-sup-input-add-qtd');
        const label = (labelInp.value || '').trim();
        const cat   = catInp.value || 'porta';
        const larg  = parseInt(largInp.value, 10) || 0;
        const alt   = parseInt(altInp.value, 10) || 0;
        const qtd   = parseInt(qtdInp.value, 10) || 1;
        if (!label) { alert('Preencha o nome da peça.'); labelInp.focus(); return; }
        if (larg <= 0) { alert('Largura inválida.'); largInp.focus(); return; }
        if (alt <= 0)  { alert('Altura inválida.');  altInp.focus(); return; }
        if (qtd <= 0)  { alert('Quantidade inválida.'); qtdInp.focus(); return; }
        if (!item.pecasManuaisExtras) item.pecasManuaisExtras = [];
        item.pecasManuaisExtras.push({
          label, categoria: cat, largura: larg, altura: alt, qtd,
          cor: corLado, podeRotacionar: false,
        });
        // Salva e re-renderiza
        try {
          atualizarVersao(r1.versao.id, { itens: r1.versao.itens });
        } catch (err) { console.warn('[Lev Sup] erro ao salvar peça manual:', err); }
        renderLevSuperficiesTab(container);
        return;
      }
      // Felipe sessao 14: botao 🗑 unificado — funciona em peca manual E auto.
      // data-manual="1" → splice de pecasManuaisExtras (comportamento antigo)
      // data-manual="0" → adiciona chave em item.pecasRemovidas[] (cria array se nao existir)
      const btnRm = e.target.closest('.orc-lev-sup-btn-remover-peca');
      if (btnRm) {
        const idx = Number(btnRm.dataset.itemIdx);
        const chave = btnRm.dataset.pecaKey;
        const isManual = btnRm.dataset.manual === '1';
        const r2 = obterVersao(UI.versaoAtivaId);
        if (!r2 || !r2.versao) return;
        const item = (r2.versao.itens || [])[idx];
        if (!item) return;
        const partes = chave.split('|');
        const labelAlvo = partes[0];
        const largAlvo  = Number(partes[1]);
        const altAlvo   = Number(partes[2]);
        if (isManual) {
          // peca manual: splice direto de pecasManuaisExtras
          if (!item.pecasManuaisExtras) return;
          const idxRemover = item.pecasManuaisExtras.findIndex(p =>
            p.label === labelAlvo && Number(p.largura) === largAlvo && Number(p.altura) === altAlvo
          );
          if (idxRemover === -1) return;
          if (!confirm(`Remover peça manual "${labelAlvo}" (${largAlvo}×${altAlvo})?`)) return;
          item.pecasManuaisExtras.splice(idxRemover, 1);
        } else {
          // peca automatica: adiciona chave em pecasRemovidas[]
          if (!confirm(`Remover esta peça do calculo?\n\n"${labelAlvo}" (${largAlvo}×${altAlvo})\n\nEla some do levantamento e do aproveitamento. Pra trazer de volta, use "↩ Voltar ao Padrao".`)) return;
          if (!Array.isArray(item.pecasRemovidas)) item.pecasRemovidas = [];
          if (item.pecasRemovidas.indexOf(chave) === -1) item.pecasRemovidas.push(chave);
        }
        try {
          atualizarVersao(r2.versao.id, { itens: r2.versao.itens });
        } catch (err) { console.warn('[Lev Sup] erro ao remover peça:', err); }
        renderLevSuperficiesTab(container);
        return;
      }
      // 3. Botao ↺ resetar override (volta ao valor original calculado)
      const btnReset = e.target.closest('.orc-lev-sup-btn-resetar-edit');
      if (btnReset) {
        const idx = Number(btnReset.dataset.itemIdx);
        const chave = btnReset.dataset.pecaKey;
        const r3 = obterVersao(UI.versaoAtivaId);
        if (!r3 || !r3.versao) return;
        const item = (r3.versao.itens || [])[idx];
        if (!item || !item.superficiesOverrides) return;
        if (!confirm('Restaurar valores originais dessa peça?')) return;
        delete item.superficiesOverrides[chave];
        try {
          atualizarVersao(r3.versao.id, { itens: r3.versao.itens });
        } catch (err) { console.warn('[Lev Sup] erro ao resetar:', err); }
        renderLevSuperficiesTab(container);
        return;
      }
      // Felipe sessao 12: Botao "↩ Voltar ao Padrao" - descarta TODOS os
      // overrides manuais do item (todas as edicoes de qtd/largura/altura) e
      // tambem as pecas manuais adicionadas. Volta ao calculo do motor.
      const btnResetTudo = e.target.closest('.orc-lev-sup-btn-resetar-tudo');
      if (btnResetTudo) {
        if (!confirm('Voltar ao calculo padrao do motor?\n\nIsso descarta todas as edicoes manuais (qtd, largura, altura, nome, categoria), remove pecas adicionadas manualmente E restaura pecas removidas. Os valores Sim/Nao de rotacao sao mantidos.')) return;
        const rR = obterVersao(UI.versaoAtivaId);
        if (!rR || !rR.versao) return;
        // Apaga overrides em TODOS os itens da versao (porque o banner e' por
        // tela inteira, nao por item especifico - simplifica fluxo do Felipe).
        (rR.versao.itens || []).forEach(it => {
          delete it.superficiesOverrides;
          delete it.pecasManuaisExtras;
          delete it.pecasRemovidas;  // Felipe sessao 14: limpa lista de pecas removidas
        });
        try {
          atualizarVersao(rR.versao.id, { itens: rR.versao.itens });
        } catch (err) { console.warn('[Lev Sup] erro ao resetar tudo:', err); }
        renderLevSuperficiesTab(container);
        return;
      }
      // 4. Botao 💾 Salvar - salva todos os inputs pendentes e re-renderiza
      const btnRecalc = e.target.closest('.orc-lev-sup-btn-recalcular');
      if (btnRecalc) {
        // Le todos os inputs pendentes (com classe orc-lev-sup-input-pendente)
        const pendentes = container.querySelectorAll('.orc-lev-sup-input-pendente');
        if (!pendentes.length) {
          // Sem pendentes - oculta banner e sai
          const banner = container.querySelector('.orc-lev-sup-banner-recalc');
          if (banner) banner.style.display = 'none';
          return;
        }
        // Felipe sessao 12: BUG FIX - 'AO MUDAR ALGUMA CHAPA NAO ESTA SALVANDO
        // E RECALCULANDO'. CAUSA: handlers estavam dentro do guard
        // _levSupListenersAdded (commit 1398df1) - sao registrados na PRIMEIRA
        // render. Capturam 'itens' da closure inicial. Em re-renders posteriores,
        // mutacoes em 'itens[idx]' vao pro array antigo (lixo em memoria), mas
        // 'r.versao.itens' usado no atualizarVersao vem fresh do storage SEM as
        // mutacoes. Tudo era perdido. FIX: mutar diretamente em r.versao.itens
        // (do storage atual) em vez do 'itens' da closure.
        const rRecalc = obterVersao(UI.versaoAtivaId);
        if (!rRecalc || !rRecalc.versao) {
          console.warn('[Lev Sup] versao atual nao encontrada ao recalcular');
          return;
        }
        const itensAtual = rRecalc.versao.itens || [];
        pendentes.forEach(inp => {
          const idx = Number(inp.dataset.itemIdx);
          const chave = inp.dataset.pecaKey;
          const field = inp.dataset.field;  // 'largura' | 'altura' | 'qtd' | 'label' | 'categoria'
          const isManual = inp.dataset.manual === '1';
          // Felipe sessao 14: campos string (label, categoria) sao tratados
          // diferente dos numericos. Categoria vem de <select>, label de <input text>.
          const isStringField = (field === 'label' || field === 'categoria');
          const valor = isStringField
            ? String(inp.value || '').trim()
            : (parseInt(inp.value, 10) || 0);
          const item = itensAtual[idx];   // <-- FRESH do storage
          if (!item) return;
          if (isStringField) {
            if (!valor) return; // string vazia ignora
          } else if (valor <= 0) {
            return;
          }
          if (isManual) {
            // Edicao em peca manual: atualiza diretamente em pecasManuaisExtras
            if (!item.pecasManuaisExtras) return;
            const partes = chave.split('|');
            const labelAlvo = partes[0];
            const largAlvo  = Number(partes[1]);
            const altAlvo   = Number(partes[2]);
            const pecaManual = item.pecasManuaisExtras.find(p =>
              p.label === labelAlvo && Number(p.largura) === largAlvo && Number(p.altura) === altAlvo
            );
            if (pecaManual) {
              pecaManual[field] = valor;
            }
          } else {
            // Edicao em peca calculada pelo motor: salva em superficiesOverrides
            if (!item.superficiesOverrides) item.superficiesOverrides = {};
            if (!item.superficiesOverrides[chave]) item.superficiesOverrides[chave] = {};
            item.superficiesOverrides[chave][field] = valor;
          }
        });
        try {
          atualizarVersao(rRecalc.versao.id, { itens: itensAtual });
        } catch (err) { console.warn('[Lev Sup] erro ao salvar overrides:', err); }
        renderLevSuperficiesTab(container);
        return;
      }
    });

    // Felipe (sessao 2026-05): duplo clique no card da chapa = SELECIONA
    // essa chapa pra ser usada no custo de superficies do orcamento.
    // Marca com classe .is-selecionada e salva no orcamento.
    //
    // BUG-FIX (sessao 2026-05): antes usava window.OrcamentoCore.* que
    // NUNCA foi definido — entao o objeto `orc` virava `{}` local e a
    // selecao era perdida. Agora persiste de verdade via obterVersao/
    // atualizarVersao e atualiza o campo Revestimento (R$) do Custo
    // Fabricacao instantaneamente.
    container.addEventListener('dblclick', (e) => {
      const card = e.target.closest('.orc-aprov-card[data-chapa-info]');
      if (!card) return;
      e.preventDefault();
      let info;
      try { info = JSON.parse(card.dataset.chapaInfo); }
      catch (err) { console.warn('[Aproveitamento] info invalida no card', err); return; }

      // Acha o WRAP da cor (.orc-aprov-cor) — todas as chapas da MESMA
      // cor estao no mesmo wrap. Desmarca outros cards e marca este.
      const wrapCor = card.closest('.orc-aprov-cor');
      if (wrapCor) {
        wrapCor.querySelectorAll('.orc-aprov-card').forEach(c =>
          c.classList.remove('is-selecionada'));
      }
      card.classList.add('is-selecionada');

      try {
        const r = obterVersao(UI.versaoAtivaId);
        if (!r || !r.versao) {
          console.warn('[Aproveitamento] versao atual nao encontrada');
          return;
        }
        const versao = r.versao;
        // Felipe (sessao 28 fix): "PDF QUE GERAR NAS Lev. Superficies
        // ISSO AI NADA DO QUE PEDI". Causa raiz: o save antigo so salvava
        // metadados (descricao, preco, custoTotal). O renderRelChapas
        // espera `opcoes[idxEscolhido].chapas[].pecasPosicionadas` —
        // como nada disso era salvo, mostrava "Sem dados de aproveitamento".
        // Solucao: pegar resultado COMPLETO do cache global (preenchido
        // ao renderizar os cards), extrair so' o que o relatorio precisa
        // (sem `pecasNaoCouberam`, sem `pecasOriginais` etc — economia
        // de localStorage), e salvar como `opcoes[0]`.
        const cardId = card.dataset.cardId;
        const resultadoCompleto = (window.__projettaResultadosNesting || {})[cardId];
        const opcao = resultadoCompleto ? {
          chapaMae: {
            descricao: resultadoCompleto.chapaMae.descricao,
            largura:   resultadoCompleto.chapaMae.largura,
            altura:    resultadoCompleto.chapaMae.altura,
            preco:     resultadoCompleto.chapaMae.preco,
            peso_kg_m2: resultadoCompleto.chapaMae.peso_kg_m2,
          },
          taxaAproveitamento: resultadoCompleto.taxaAproveitamento,
          custoTotal:         resultadoCompleto.custoTotal,
          numChapas:          resultadoCompleto.numChapas,
          // Pra cada chapa, salva só o minimo pro relatorio:
          //   - taxa
          //   - pecasPosicionadas[] com {peca:{label}, larg, alt}
          //   - sobrasRetangulos[] com {w, h} (sem x,y — relatorio nao precisa)
          chapas: (resultadoCompleto.chapas || []).map(c => ({
            taxa: c.taxa,
            pecasPosicionadas: (c.pecasPosicionadas || []).map(pp => ({
              peca: { label: pp.peca?.label || '' },
              larg: pp.larg,
              alt:  pp.alt,
            })),
            sobrasRetangulos: (c.sobrasRetangulos || []).map(s => ({
              w: s.w, h: s.h,
            })),
          })),
        } : null;

        // Persiste selecao por COR (existing chapasSelecionadas + esta cor)
        const chapasSel = Object.assign({}, versao.chapasSelecionadas || {});
        chapasSel[info.cor] = {
          descricao: info.descricao,
          largura: info.largura,
          altura: info.altura,
          preco: info.preco,
          numChapas: info.numChapas,
          custoTotal: info.custoTotal,
          peso_kg_m2: info.peso_kg_m2,
          pesoTotal: info.pesoTotal,
          // Felipe (sessao 28 fix): estrutura completa pro relatorio
          idxEscolhido: 0,
          opcoes: opcao ? [opcao] : [],
        };

        // Felipe (sessao 2026-05): atualiza fab.total_revestimento
        // automaticamente — soma de TODAS as chapas selecionadas + fallback
        // automatico nas cores que ainda nao foram selecionadas.
        const futVersao = Object.assign({}, versao, { chapasSelecionadas: chapasSel });
        const totalRev = computeRevestimentoPorCor(futVersao, pecasPorCor, todasSupGlobal).total;
        const novoFab = Object.assign({}, FAB_DEFAULT, versao.custoFab || {});
        novoFab.total_revestimento = totalRev;
        // Recalcula subFab pra DRE refletir mudanca instantaneamente
        const rFab = calcularFab(novoFab, versao.itens);

        atualizarVersao(versao.id, {
          chapasSelecionadas: chapasSel,
          custoFab: novoFab,
          subFab: rFab.total,
        });

        // Re-renderiza a aba inteira pra mostrar:
        //   - Resumo Total atualizado (tabela com nova linha)
        //   - Card destacado em verde
        renderLevSuperficiesTab(container);

        if (window.showSavedDialog) {
          window.showSavedDialog(
            `Chapa selecionada: ${info.numChapas}× ${info.largura}×${info.altura}mm de "${info.cor}"\n` +
            `Custo: R$ ${fmtBR(info.custoTotal)}\n` +
            `Revestimento total atualizado: R$ ${fmtBR(totalRev)}`
          );
        }
      } catch (err) {
        console.warn('[Aproveitamento] erro ao persistir selecao', err);
        alert('Erro ao salvar selecao: ' + err.message);
      }
    });

    // Felipe sessao 18: 'me de a opcao de altera quantidade, as vezes
    // deu uma chapa e meia, ou as vezes de 2 chapas mas tenho sobra
    // que consigo fazer com uma'. Permite editar manualmente a qtd
    // de chapas na tabela 'Custo por cor'. Aceita fracoes (ex 1.5 =
    // 1 chapa e meia, 0.5 = meia chapa, 1 = chapa cheia mas usei sobra).
    // Persiste em versao.chapasSelecionadas[cor].numChapas e recalcula
    // custoTotal = numChapas × preco_un, atualizando subFab.
    container.addEventListener('change', (e) => {
      const inp = e.target.closest('[data-aprov-rev-qtd]');
      if (!inp) return;
      const cor = inp.getAttribute('data-aprov-rev-qtd');
      const novaQtd = parseFloat(String(inp.value).replace(',', '.'));
      if (!Number.isFinite(novaQtd) || novaQtd < 0) {
        alert('Quantidade invalida. Use numeros (ex: 1, 1.5, 2).');
        return;
      }
      try {
        const r = obterVersao(UI.versaoAtivaId);
        if (!r || !r.versao) return;
        const versao = r.versao;
        const sel = Object.assign({}, versao.chapasSelecionadas || {});
        const linhaAtual = sel[cor];
        if (!linhaAtual) {
          // Linha veio do fallback 'auto' (cor sem selecao previa).
          // Pra salvar override de qtd, precisamos primeiro materializar
          // como selecao. Pega dados do auto via calcularDadosTotaisCor.
          alert('Para editar a qtd, primeiro selecione uma chapa-mae (duplo-clique no card de aproveitamento).');
          inp.value = inp.defaultValue;
          return;
        }
        const precoUnit = (Number(linhaAtual.numChapas) > 0)
          ? Number(linhaAtual.custoTotal) / Number(linhaAtual.numChapas)
          : Number(linhaAtual.preco) || 0;
        sel[cor] = Object.assign({}, linhaAtual, {
          numChapas: novaQtd,
          custoTotal: precoUnit * novaQtd,
          _qtdManual: true,
        });
        // Recalcula total revestimento e subFab
        const futVersao = Object.assign({}, versao, { chapasSelecionadas: sel });
        const totalRev = computeRevestimentoPorCor(futVersao, pecasPorCor, todasSupGlobal).total;
        const novoFab = Object.assign({}, FAB_DEFAULT, versao.custoFab || {});
        novoFab.total_revestimento = totalRev;
        const rFab = calcularFab(novoFab, versao.itens);
        atualizarVersao(versao.id, {
          chapasSelecionadas: sel,
          custoFab: novoFab,
          subFab: rFab.total,
        });
        // Re-renderiza aba pra atualizar Subtotal, Resumo Total e DRE
        renderLevSuperficiesTab(container);
      } catch (err) {
        console.warn('[Aproveitamento] erro ao atualizar qtd:', err);
        alert('Erro ao atualizar quantidade: ' + err.message);
      }
    });
    } // fim if(!_levSupListenersAdded) — Felipe sessao 12: guard anti-duplo

    // Felipe (sessao 2026-05): re-aplica chapas ja' selecionadas (caso
    // o usuario tenha selecionado antes e re-aberto a aba). Le da versao
    // ativa e marca os cards correspondentes.
    setTimeout(() => {
      try {
        const r = obterVersao(UI.versaoAtivaId);
        const sel = (r && r.versao && r.versao.chapasSelecionadas) || {};
        Object.keys(sel).forEach(cor => {
          const escolhida = sel[cor];
          // Procura cards com mesma cor + dimensoes
          container.querySelectorAll('.orc-aprov-card[data-chapa-info]').forEach(card => {
            try {
              const info = JSON.parse(card.dataset.chapaInfo);
              if (info.cor === cor &&
                  Number(info.largura) === Number(escolhida.largura) &&
                  Number(info.altura)  === Number(escolhida.altura)) {
                card.classList.add('is-selecionada');
              }
            } catch (e) { /* ignora */ }
          });
        });
      } catch (e) { /* ignora */ }
    }, 50);
  }

  /**
   * Felipe (sessao 2026-05): coleta TODAS as peças de TODOS os itens
   * de porta externa e agrupa por COR.
   *
   * Por que agrupar por cor: cada cor é uma chapa-mae diferente. Um
   * orcamento com 3 portas pode ter 5 cores distintas (ext1, int1,
   * cava1, ext2, int2). Cada cor tem sua propria pilha de pecas pra
   * encaixar nas chapas-mae da categoria correspondente.
   *
   * Retorna: { 'As002 - Wood Carvalho': [pecas...], 'White Glossy': [...] }
   */
  function coletarPecasPorCor(itens) {
    const Chapas = window.ChapasPortaExterna;
    const ChapasRev = window.ChapasRevParede;
    const grupos = {};
    itens.forEach((item, idx) => {
      // Felipe (sessao 2026-05): trata cada tipo com seu motor proprio.
      // Quando outros tipos ganharem motor (porta_interna, fixo_acoplado),
      // basta adicionar mais cases aqui.
      // Felipe (sessao 2026-05 — Sim/Nao manual): aplica overrides do
      // usuario ANTES de enviar pro aproveitamento, pra que o motor de
      // chapas use a flag editada (e nao a calculada automaticamente).
      // Felipe (sessao 28 fix): tambem aplica qtdOverrides (importado do Excel).
      // Felipe sessao 12: TAMBEM aplica aplicarSuperficiesOverrides (largura/
      // altura/qtd editados manualmente na tabela) E adicionarPecasManuaisExtras
      // (pecas adicionadas pelo Felipe). Antes essa funcao IGNORAVA esses dois,
      // entao o calculo de aproveitamento (chapas a comprar) usava valor original
      // mesmo quando Felipe editava na tabela. Bug 'mudo de 3 para 2 e nao
      // recalcula tirando essa peca'.
      if (item.tipo === 'porta_externa' && Chapas) {
        // Felipe sessao 12 fix: pra COR UNICA (corExt = corInt), peças com
        // override de QTD (_qtdOverride) NAO sao duplicadas entre os 2 lados.
        // O override de qtd representa a qtd FINAL desejada pelo usuario, nao
        // por lado. Sem isso o aproveitamento contava 2× (ext+int) o valor
        // editado e calculava chapas-mae a mais.
        //
        // Felipe sessao 30 fix: ANTES filtrava por _editado (qualquer edicao).
        // Mas _editado=true tambem fica setado quando o usuario edita SO a
        // largura ou SO a altura (sem mexer na qtd). Resultado: peca com
        // altura editada (mas qtd original 1+1) tinha o lado interno filtrado
        // erroneamente -> aproveitamento via 1 peca quando devia ver 2.
        // Bug reportado: 'Tampa Maior qtd=2 mas no layout aparece 1'.
        // Solucao igual a unificarPecas linha 13499: usar _qtdOverride (so
        // marca true quando QTD foi editada, nao quando dimensao foi).
        const corExt2 = String(item.corExterna || '').trim();
        const corInt2 = String(item.corInterna || '').trim();
        const corUnica2 = corExt2 && corExt2 === corInt2;
        // Coleta primeiro o externo e marca chaves com qtd editada pra pular no interno.
        const chavesEditadasExt = new Set();
        ['externo', 'interno'].forEach(lado => {
          let pecas = Chapas.gerarPecasChapa(item, lado) || [];
          pecas = aplicarRotacionaOverrides(pecas, item);
          pecas = aplicarQtdOverrides(pecas, item, lado);
          pecas = aplicarSuperficiesOverrides(pecas, item);
          // Cor unica: pula no INTERNO peças com QTD editada ja contadas no EXTERNO
          if (corUnica2 && lado === 'interno') {
            pecas = pecas.filter(p => !(p._qtdOverride && chavesEditadasExt.has(rotacionaKey(p))));
          }
          // Marca chaves com QTD editada do externo pra usar no interno (1a passada)
          if (corUnica2 && lado === 'externo') {
            pecas.forEach(p => { if (p._qtdOverride) chavesEditadasExt.add(rotacionaKey(p)); });
          }
          pecas.forEach(p => agrupar(grupos, p, idx, item));
        });
        // Felipe sessao 14 BUG FIX: pecas manuais entram UMA VEZ por item.
        // ANTES: filtro p.cor === 'externo'|'interno' dentro do forEach de
        // lados nunca batia — porque p.cor e' a COR REAL da chapa (ex:
        // "Pro5818 - Bronze 1001 Met Kynar4300 Ldpe"), nao o nome do lado.
        // Resultado: zero pecas manuais entravam no aproveitamento. Agora
        // agrupar() agrupa cada manual pela sua cor real (igual peca automatica).
        adicionarPecasManuaisExtras([], item).forEach(p => agrupar(grupos, p, idx, item));
      } else if (item.tipo === 'fixo_acoplado' && window.PerfisRevAcoplado) {
        ['externo', 'interno'].forEach(lado => {
          let pecas = window.PerfisRevAcoplado.gerarPecasChapa(item, lado) || [];
          pecas = aplicarRotacionaOverrides(pecas, item);
          pecas = aplicarQtdOverrides(pecas, item, lado);
          pecas = aplicarSuperficiesOverrides(pecas, item);
          pecas.forEach(p => agrupar(grupos, p, idx, item));
        });
        // Felipe sessao 14 BUG FIX: idem porta_externa, manuais UMA VEZ por item
        adicionarPecasManuaisExtras([], item).forEach(p => agrupar(grupos, p, idx, item));
      } else if (item.tipo === 'porta_interna' && window.ChapasPortaInterna) {
        // Felipe sessao 31: chapas frontais da porta interna (externa 25,5 + interna 37,5).
        // Padrao igual porta_externa: itera ['externo','interno'], passa pelos
        // mesmos pipelines de overrides, e agrupa por cor.
        ['externo', 'interno'].forEach(lado => {
          let pecas = window.ChapasPortaInterna.gerarPecasChapa(item, lado) || [];
          pecas = aplicarRotacionaOverrides(pecas, item);
          pecas = aplicarQtdOverrides(pecas, item, lado);
          pecas = aplicarSuperficiesOverrides(pecas, item);
          pecas.forEach(p => agrupar(grupos, p, idx, item));
        });
        adicionarPecasManuaisExtras([], item).forEach(p => agrupar(grupos, p, idx, item));
      } else if (item.tipo === 'revestimento_parede' && ChapasRev) {
        let pecas = ChapasRev.gerarPecasRevParede(item) || [];
        pecas = aplicarRotacionaOverrides(pecas, item);
        pecas = aplicarQtdOverrides(pecas, item, null);
        pecas = aplicarSuperficiesOverrides(pecas, item);
        // revestimento: peca manual sem filtro de lado
        const extrasRev = item.pecasManuaisExtras || [];
        if (extrasRev.length) {
          pecas = pecas.concat(extrasRev.map(p => Object.assign({
            podeRotacionar: false, qtd: 1, categoria: p.categoria || 'porta',
          }, p, { _manual: true })));
        }
        pecas.forEach(p => agrupar(grupos, p, idx, item));
      } else if (item.tipo === 'pergolado' && window.ChapasPergolado) {
        // Felipe sessao 18: pergolado tem motor proprio
        let pecas = window.ChapasPergolado.gerarPecasPergolado(item) || [];
        pecas = aplicarRotacionaOverrides(pecas, item);
        pecas = aplicarQtdOverrides(pecas, item, null);
        pecas = aplicarSuperficiesOverrides(pecas, item);
        const extrasPergo = item.pecasManuaisExtras || [];
        if (extrasPergo.length) {
          pecas = pecas.concat(extrasPergo.map(p => Object.assign({
            podeRotacionar: false, qtd: 1, categoria: p.categoria || 'pergolado',
          }, p, { _manual: true })));
        }
        pecas.forEach(p => agrupar(grupos, p, idx, item));
      }
    });
    return grupos;
  }

  /**
   * Helper que agrupa peça no objeto `grupos` por cor.
   */
  function agrupar(grupos, peca, origemIdx, item) {
    const cor = peca.cor || '(sem cor)';
    if (!grupos[cor]) grupos[cor] = [];
    grupos[cor].push(Object.assign({}, peca, {
      origemItemIdx: origemIdx,
      origemItemTipo: item.tipo,
      revestimento: item.revestimento || '',
    }));
  }

  /**
   * Felipe (sessao 2026-05): renderiza a seção de APROVEITAMENTO DE
   * CHAPAS — pra cada cor, mostra:
   *   - Total de peças nessa cor
   *   - 4 chapas-mae da categoria (ACM/HPL/Aluminio/Vidro)
   *   - Pra cada uma: quantas chapas necessárias + taxa aproveitamento + custo
   *   - Destaca a melhor configuração (menor custo)
   */
  function renderAproveitamentoChapas(pecasPorCor) {
    const cores = Object.keys(pecasPorCor);
    if (!cores.length) {
      return `
        <div class="orc-section">
          <div class="orc-section-title">Aproveitamento de Chapas</div>
          <p class="orc-hint-text">Sem pecas geradas — preencha os itens primeiro.</p>
        </div>`;
    }

    // Felipe (sessao 2026-05): usa Superficies.listar() (que dispara
    // load() do modulo 26-superficies.js, garantindo que o SEED de
    // 249 chapas seja carregado mesmo se o usuario nunca abriu a aba
    // Cadastros > Superficies). Fallback: storage direto.
    const todasSuperficies = (window.Superficies?.listar?.())
      || (window.Storage?.scope?.('cadastros').get('superficies_lista'))
      || [];

    // Felipe (sessao 2026-05 — peso v3): acumula totais consolidados.
    const totaisGerais = {
      pesoPorta: 0, pesoPortal: 0, pesoRev: 0,
      pesoUtil: 0, pesoComprado: 0, pesoDesperdicio: 0,
      pesoTotal: 0,  // backward-compat = comprado
      custoTotal: 0, numChapas: 0,
      semPesoCadastrado: false,
    };

    // Felipe sessao 31: le chapasSelecionadas ANTES de renderizar os
    // blocos pra que renderBlocoCor consiga marcar o card escolhido
    // como .is-selecionada no proprio template (sem depender de
    // setTimeout pos-render — que falhava quando o parse de
    // data-chapa-info quebrava). Render direto = robustez total.
    const _versaoPraSelecao = (obterVersao(UI.versaoAtivaId) || {}).versao || {};
    const _chapasSelMap = (_versaoPraSelecao && _versaoPraSelecao.chapasSelecionadas) || {};

    const blocos = cores.map(cor => {
      const bloco = renderBlocoCor(cor, pecasPorCor[cor], todasSuperficies, _chapasSelMap[cor] || null);
      const dadosTotal = calcularDadosTotaisCor(pecasPorCor[cor], todasSuperficies);
      if (dadosTotal) {
        totaisGerais.pesoPorta       += dadosTotal.pesoPorta;
        totaisGerais.pesoPortal      += dadosTotal.pesoPortal;
        totaisGerais.pesoRev         += dadosTotal.pesoRev;
        totaisGerais.pesoUtil        += dadosTotal.pesoUtil || 0;
        totaisGerais.pesoComprado    += dadosTotal.pesoComprado || dadosTotal.pesoTotal || 0;
        totaisGerais.pesoDesperdicio += dadosTotal.pesoDesperdicio || 0;
        totaisGerais.pesoTotal       += dadosTotal.pesoTotal;
        totaisGerais.custoTotal      += dadosTotal.custoTotal;
        totaisGerais.numChapas       += dadosTotal.numChapas;
        if (!dadosTotal.temPeso) totaisGerais.semPesoCadastrado = true;
      }
      return bloco;
    }).join('');

    // Felipe (sessao 2026-05): TABELA detalhada de revestimento por cor.
    // Felipe pediu: "ali resumo quero preco unitatio de cada chapa x
    // quantidade por cor — entao se tem 3 cores tem 3 linhas com preco
    // unitario x quantidade de cada cor e um valor total para conferencia".
    // Usa chapa SELECIONADA (duplo clique) ou MELHOR auto se nao escolheu.
    const versaoAtual = (obterVersao(UI.versaoAtivaId) || {}).versao || {};
    const revPorCor = computeRevestimentoPorCor(versaoAtual, pecasPorCor, todasSuperficies);
    const tabelaCustosHtml = revPorCor.linhas.length ? `
      <div class="orc-aprov-resumo-tabela-wrap">
        <div class="orc-aprov-resumo-tabela-titulo">💵 Custo por cor — Preço unitário × Qtd</div>
        <table class="orc-aprov-resumo-tabela">
          <thead>
            <tr>
              <th>Cor</th>
              <th>Chapa</th>
              <th class="num">Preço unit. (R$)</th>
              <th class="num">Qtd</th>
              <th class="num">Subtotal (R$)</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            ${revPorCor.linhas.map(l => `
              <tr class="${l.fonte === 'selecionada' ? 'orc-aprov-rev-sel' : (l.fonte === 'vidro_m2' ? 'orc-aprov-rev-vidro' : 'orc-aprov-rev-auto')}">
                <td>${escapeHtml(l.cor)}</td>
                <td class="orc-aprov-rev-desc">${escapeHtml(l.descricao)}</td>
                <td class="num">${fmtBR(l.precoUnit)}${l.fonte === 'vidro_m2' ? '<span style="font-size:10px;color:#666;"> /m²</span>' : ''}</td>
                <td class="num">${
                  l.fonte === 'vidro_m2'
                    ? fmtBR(l.qtd) + ' m²'
                    : `<input type="number" min="0" step="0.5" value="${l.qtd}" data-aprov-rev-qtd="${escapeHtml(l.cor)}" style="width:60px;text-align:right;padding:2px 4px;border:1px solid #cbd5e1;border-radius:4px;font:inherit;" title="Editar quantidade de chapas (ex: 1.5 = 1 chapa e meia)">`
                }</td>
                <td class="num"><b>${fmtBR(l.subtotal)}</b></td>
                <td class="orc-aprov-rev-fonte">${l.fonte === 'selecionada' ? '✓ selecionada' : (l.fonte === 'vidro_m2' ? '🔷 vidro m²' : 'auto (melhor)')}</td>
              </tr>
            `).join('')}
            <tr class="orc-aprov-rev-total">
              <td colspan="4">Total Geral (vai pro campo Revestimento em Custo Fab/Inst)</td>
              <td class="num"><b>R$ ${fmtBR(revPorCor.total)}</b></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    ` : '';

    // Resumo final consolidado
    // Felipe (sessao 2026-05 — peso v3): destaca PESO UTIL (peso real
    // da porta pronta) — esse e' o peso que vai pro frete + montagem.
    // PESO COMPRADO (chapa-mae × num) so' importa pra custo do material.
    const resumoFinal = (cores.length > 0 && totaisGerais.numChapas > 0) ? `
      <div class="orc-aprov-resumo-total">
        <div class="orc-aprov-resumo-titulo">📦 Resumo Total — Todas as Cores</div>
        <div class="orc-aprov-resumo-grid">
          <div class="orc-aprov-resumo-card">
            <div class="orc-aprov-resumo-label">Total de chapas-mãe</div>
            <div class="orc-aprov-resumo-valor"><b>${totaisGerais.numChapas}</b></div>
          </div>
          <div class="orc-aprov-resumo-card orc-aprov-resumo-destaque-laranja">
            <div class="orc-aprov-resumo-label">💰 Custo total (revestimento)</div>
            <div class="orc-aprov-resumo-valor"><b>R$ ${fmtBR(revPorCor.total)}</b></div>
          </div>
          ${totaisGerais.pesoPorta > 0 ? `
          <div class="orc-aprov-resumo-card">
            <div class="orc-aprov-resumo-label">Peso da Porta (peças)</div>
            <div class="orc-aprov-resumo-valor"><b>${fmtBR(totaisGerais.pesoPorta)} kg</b></div>
          </div>` : ''}
          ${totaisGerais.pesoPortal > 0 ? `
          <div class="orc-aprov-resumo-card">
            <div class="orc-aprov-resumo-label">Peso do Portal (peças)</div>
            <div class="orc-aprov-resumo-valor"><b>${fmtBR(totaisGerais.pesoPortal)} kg</b></div>
          </div>` : ''}
          ${totaisGerais.pesoRev > 0 ? `
          <div class="orc-aprov-resumo-card">
            <div class="orc-aprov-resumo-label">Peso Revestimento (peças)</div>
            <div class="orc-aprov-resumo-valor"><b>${fmtBR(totaisGerais.pesoRev)} kg</b></div>
          </div>` : ''}
          <div class="orc-aprov-resumo-card orc-aprov-resumo-destaque">
            <div class="orc-aprov-resumo-label">📦 Peso ÚTIL (porta pronta)</div>
            <div class="orc-aprov-resumo-valor"><b>${fmtBR(totaisGerais.pesoUtil)} kg</b></div>
          </div>
          <div class="orc-aprov-resumo-card">
            <div class="orc-aprov-resumo-label">🧾 Peso comprado (chapas)</div>
            <div class="orc-aprov-resumo-valor"><b>${fmtBR(totaisGerais.pesoComprado)} kg</b></div>
          </div>
          ${totaisGerais.pesoDesperdicio > 0 ? `
          <div class="orc-aprov-resumo-card orc-aprov-resumo-desperdicio">
            <div class="orc-aprov-resumo-label">↳ desperdício</div>
            <div class="orc-aprov-resumo-valor"><b>${fmtBR(totaisGerais.pesoDesperdicio)} kg</b></div>
          </div>` : ''}
        </div>
        ${tabelaCustosHtml}
        ${totaisGerais.semPesoCadastrado
          ? `<p class="orc-hint-text orc-aprov-resumo-aviso">
              ⚠ Algumas superfícies não têm peso cadastrado.
              Preencha "Peso (kg/m²)" em Cadastros > Superfícies pra ter o peso completo.
            </p>` : ''}
      </div>
    ` : '';

    return `
      <div class="orc-section orc-aproveitamento-section">
        <div class="orc-section-title">Aproveitamento de Chapas — quantas chapas-mãe vamos gastar?</div>
        <p class="orc-hint-text">
          Para cada cor, o algoritmo encaixa todas as peças numa chapa-mãe
          de tamanho fixo e calcula quantas chapas precisamos. Os tamanhos
          vêm do <b>Cadastros > Superfícies</b> (categoria de cada cor —
          ACM, HPL, Alumínio Maciço ou Vidro).
          A configuração com menor custo total fica destacada em verde.
        </p>
        ${blocos}
        ${resumoFinal}
      </div>`;
  }

  /**
   * Helper: calcula peso e custo da MELHOR config pra UMA cor (usado no
   * acumulado total).
   */
  function calcularDadosTotaisCor(pecas, todasSuperficies) {
    const cor = pecas[0]?.cor || '';
    const nomeCurto = nomeCurtoSuperficie(cor);
    if (!nomeCurto) return null;
    // Felipe (sessao 2026-05): MESMA lógica de matching do renderBlocoCor.
    // 4 camadas: exato → substring → primeira palavra → digitos do codigo.
    const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const nomeCurtoNorm = norm(nomeCurto);

    // Camada 1: exato
    let variantes = todasSuperficies.filter(s => {
      const sNome = nomeCurtoSuperficie(s.descricao);
      return sNome && norm(sNome) === nomeCurtoNorm;
    });
    // Camada 2: substring
    if (variantes.length === 0 && nomeCurtoNorm.length >= 4) {
      variantes = todasSuperficies.filter(s => {
        const n = norm(nomeCurtoSuperficie(s.descricao));
        return n.length >= 4 && (n.includes(nomeCurtoNorm) || nomeCurtoNorm.includes(n));
      });
    }
    // Camada 3: primeira palavra-chave
    if (variantes.length === 0) {
      const primPal = String(cor || '').trim().split(/[\s\-–—]+/)[0] || '';
      const primPalNorm = norm(primPal);
      if (primPalNorm.length >= 5) {
        variantes = todasSuperficies.filter(s => norm(s.descricao).startsWith(primPalNorm));
      }
    }
    // Camada 4: digitos do codigo
    if (variantes.length === 0) {
      const matchDig = String(cor || '').match(/\d{4,}/);
      if (matchDig) {
        const dig = matchDig[0];
        variantes = todasSuperficies.filter(s => String(s.descricao || '').includes(dig));
      }
    }
    // Aplica o mesmo fallback de extracao de dimensoes
    function extrairDims(desc) {
      const d = String(desc || '');
      const tentarMatch = (str) => {
        const m = str.match(/(\d+(?:[.,]\d+)?)\s*(?:m)?\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(m)?/i);
        if (!m) return null;
        let l = parseFloat(m[1].replace(',', '.')); let a = parseFloat(m[2].replace(',', '.'));
        const ehMetros = !!m[3] || (l > 0 && l <= 5);
        if (ehMetros) { l *= 1000; a *= 1000; }
        return { largura: Math.round(l), altura: Math.round(a) };
      };
      // Preferencia: so' apos o ultimo traco (evita "Kynar4300 X5")
      const idxU = Math.max(d.lastIndexOf(' - '), d.lastIndexOf(' — '));
      if (idxU !== -1) {
        const r = tentarMatch(d.substring(idxU + 3).trim());
        if (r && r.largura >= 800 && r.largura <= 3000 && r.altura >= 1500 && r.altura <= 15000) return r;
      }
      // Fallback com sanidade
      const re = /(\d+(?:[.,]\d+)?)\s*(?:m)?\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(m)?/gi;
      let match;
      while ((match = re.exec(d)) !== null) {
        let l = parseFloat(match[1].replace(',', '.')); let a = parseFloat(match[2].replace(',', '.'));
        const ehMetros = !!match[3] || (l > 0 && l <= 5);
        if (ehMetros) { l *= 1000; a *= 1000; }
        l = Math.round(l); a = Math.round(a);
        if (l >= 800 && l <= 3000 && a >= 1500 && a <= 15000) return { largura: l, altura: a };
      }
      return { largura: 0, altura: 0 };
    }
    // Felipe (sessao 11): mesma validacao de sanidade
    function dimsChapaSaoValidas2(l, a) {
      return l >= 800 && l <= 3000 && a >= 1500 && a <= 15000;
    }
    variantes = variantes.map(v => {
      const l = Number(v.largura) || 0, a = Number(v.altura) || 0;
      if (l > 0 && a > 0 && dimsChapaSaoValidas2(l, a)) return v;
      const d = extrairDims(v.descricao);
      return Object.assign({}, v, { largura: d.largura, altura: d.altura });
    }).filter(v => Number(v.largura) > 0 && Number(v.altura) > 0);
    if (!variantes.length) return null;

    const resultados = window.ChapasAproveitamento.compararConfiguracoes(
      pecas,
      variantes.map(v => ({
        descricao: v.descricao,
        largura:   Number(v.largura),
        altura:    Number(v.altura),
        preco:     Number(v.preco) || 0,
        peso_kg_m2: Number(v.peso_kg_m2) || 0,
      }))
    );
    // Felipe (sessao 2026-05): pega a melhor pela flag isMelhor
    // (ordem natural por dimensao mantida).
    const melhor = resultados.find(r => r.isMelhor) || null;
    if (!melhor) return null;
    const pesos = calcularPesosPorCategoria(pecas, melhor);
    return {
      pesoPorta:    pesos.porta,
      pesoPortal:   pesos.portal,
      pesoRev:      pesos.revestimento,
      pesoUtil:     pesos.pecasUtil,    // novo: util (peças)
      pesoComprado: pesos.comprado,     // novo: comprado (chapa)
      pesoDesperdicio: pesos.desperdicio, // novo: sobra
      pesoTotal:    pesos.comprado,     // backward-compat
      custoTotal:   melhor.custoTotal,
      numChapas:    melhor.numChapas,
      temPeso:      pesos.temPeso,
    };
  }

  /**
   * Felipe (sessao 2026-05): calcula o custo de revestimento (chapas)
   * por COR, usando a chapa SELECIONADA pelo usuario (duplo clique) ou
   * caindo na MELHOR opcao automatica se nao tem selecao pra essa cor.
   *
   * Retorna { linhas, total }:
   *   linhas: [{cor, descricao, precoUnit, qtd, subtotal, fonte}]
   *   total: soma dos subtotais
   *   fonte: 'selecionada' (usuario escolheu) | 'auto' (fallback)
   *
   * Usado em 3 lugares:
   *   1. Duplo clique pra atualizar fab.total_revestimento instantaneamente
   *   2. Resumo Total da aba Lev. Superficies (tabela 1 linha por cor)
   *   3. Sincronizacao quando o usuario abre Custo Fab/Inst
   */
  function computeRevestimentoPorCor(versao, pecasPorCor, todasSuperficies) {
    const linhas = [];
    let total = 0;
    const sel = (versao && versao.chapasSelecionadas) || {};
    const cores = Object.keys(pecasPorCor || {});
    cores.forEach(cor => {
      if (sel[cor]) {
        // Usuario selecionou explicitamente esta chapa
        const c = sel[cor];
        const qtd = Number(c.numChapas) || 0;
        const subtotal = Number(c.custoTotal) || 0;
        const precoUnit = qtd > 0 ? subtotal / qtd : (Number(c.preco) || 0);
        linhas.push({
          cor,
          descricao: c.descricao || cor,
          largura: Number(c.largura) || 0,
          altura: Number(c.altura) || 0,
          precoUnit,
          qtd,
          subtotal,
          fonte: 'selecionada',
        });
        total += subtotal;
      } else {
        // Fallback automatico = melhor opcao
        const dadosTotal = calcularDadosTotaisCor(pecasPorCor[cor], todasSuperficies);
        if (dadosTotal) {
          const qtd = Number(dadosTotal.numChapas) || 0;
          const subtotal = Number(dadosTotal.custoTotal) || 0;
          const precoUnit = qtd > 0 ? subtotal / qtd : 0;
          linhas.push({
            cor,
            descricao: cor + ' (auto)',
            largura: 0,
            altura: 0,
            precoUnit,
            qtd,
            subtotal,
            fonte: 'auto',
          });
          total += subtotal;
        }
      }
    });

    // Felipe sessao 13: VIDROS M² entram no custo de superficies tambem.
    // Itens fixo_acoplado com revestimento='Vidro' e a superficie do vidro
    // tem cobranca='m2': calcula L*H em m² × qtd item × preco_m2 e adiciona
    // como linha extra. NAO usa pecasPorCor (que e' so' chapas com motor).
    // Busca a superficie no cadastro pela descricao salva em item.vidroDescricao.
    try {
      const itens = (versao && versao.itens) || [];
      const sups = todasSuperficies || [];
      itens.forEach(item => {
        if (!item) return;
        // Por enquanto so' fixo_acoplado tem campo vidroDescricao. Quando
        // outros tipos ganharem, basta ampliar a condicao.
        if (item.tipo !== 'fixo_acoplado') return;
        if (String(item.revestimento || '').toLowerCase() !== 'vidro') return;
        const desc = String(item.vidroDescricao || '').trim();
        if (!desc) return;
        // Acha superficie pela descricao (case-insensitive)
        const sup = sups.find(s =>
          s && String(s.descricao || '').trim().toLowerCase() === desc.toLowerCase()
        );
        if (!sup) return;
        const cobranca = String(sup.cobranca || 'm2').toLowerCase();
        const L_mm = parseFloat(String(item.largura || '').replace(',', '.')) || 0;
        const H_mm = parseFloat(String(item.altura  || '').replace(',', '.')) || 0;
        const qtd  = Math.max(1, Number(item.quantidade) || 1);
        if (L_mm <= 0 || H_mm <= 0) return;
        if (cobranca === 'm2') {
          const m2_unit  = (L_mm * H_mm) / 1_000_000;
          const m2_total = m2_unit * qtd;
          const preco_m2 = Number(sup.preco) || 0;
          const subtotal = m2_total * preco_m2;
          const corChave = `Vidro — ${sup.descricao}`;
          linhas.push({
            cor: corChave,
            descricao: `${sup.descricao} [m²]`,
            largura: L_mm,
            altura: H_mm,
            precoUnit: preco_m2,
            qtd: m2_total,        // qtd em m² (nao chapas)
            subtotal,
            fonte: 'vidro_m2',
            unidade: 'm²',
          });
          total += subtotal;
        } else if (cobranca === 'chapa') {
          // Felipe sessao 14: vidros com cobranca=chapa (ex: Switchglass,
          // Corstone) sao vendidos por chapa inteira do tamanho cadastrado.
          // Antes: caia em "if (cobranca !== 'm2') return" e nao aparecia
          // no resumo - vidro Switchglass nunca era cobrado.
          // Calculo: ceil(L_item/L_chapa) × ceil(H_item/H_chapa) × qtd_item.
          const L_chapa = Number(sup.largura) || 0;
          const H_chapa = Number(sup.altura)  || 0;
          const preco_chapa = Number(sup.preco) || 0;
          // Se a chapa cadastrada nao tem dimensao, fallback 1 chapa por item
          const nLargura = (L_chapa > 0) ? Math.ceil(L_mm / L_chapa) : 1;
          const nAltura  = (H_chapa > 0) ? Math.ceil(H_mm / H_chapa) : 1;
          const chapasPorItem = Math.max(1, nLargura * nAltura);
          const totalChapas = chapasPorItem * qtd;
          const subtotal = totalChapas * preco_chapa;
          const corChave = `Vidro — ${sup.descricao}`;
          linhas.push({
            cor: corChave,
            descricao: `${sup.descricao} [chapa ${L_chapa}×${H_chapa}]`,
            largura: L_chapa,
            altura: H_chapa,
            precoUnit: preco_chapa,
            qtd: totalChapas,
            subtotal,
            fonte: 'vidro_chapa',
            unidade: 'chapa',
          });
          total += subtotal;
        }
      });
    } catch (e) {
      console.error('[computeRevestimentoPorCor vidros] erro:', e);
    }

    return { linhas, total };
  }

  /**
   * Renderiza o bloco de comparação de UMA cor.
   */
  // ============================================================
  // Felipe (sessao 2026-05): Layout visual do nesting (SVG)
  // ============================================================

  /**
   * Cor por categoria pra pintar peca no SVG (paleta MaxCut-like)
   */
  function corPecaSvg(peca) {
    // Paleta inspirada no MaxCut (laranja=peças principais, etc)
    const cat = peca.categoria || 'porta';
    if (cat === 'porta')   return { fill: '#f97316', stroke: '#9a3412', text: '#1f1109' };
    if (cat === 'portal')  return { fill: '#fb923c', stroke: '#7c2d12', text: '#1f1109' };
    if (cat === 'revestimento') return { fill: '#fbbf24', stroke: '#78350f', text: '#1f1109' };
    return { fill: '#fb923c', stroke: '#9a3412', text: '#1f1109' };
  }

  /**
   * Gera SVG de UMA chapa (peças posicionadas + sobras).
   * @param {Object} chapa - { largura, altura, pecasPosicionadas, sobrasRetangulos }
   * @param {Number} numChapaAtual - numero desta chapa (1-based)
   * @param {Number} numChapasTotal
   */
  function renderSvgChapa(chapa, numChapaAtual, numChapasTotal) {
    // Felipe (sessao 2026-05): chapa SEMPRE renderizada na HORIZONTAL —
    // o lado MAIOR vira a largura visual (eixo X) e o lado MENOR vira
    // a altura visual (eixo Y). Isso faz a chapa parecer "deitada"
    // como no MaxCut, e da espaco util pras pecas serem visiveis.
    //
    // Logica: se a chapa tem altura > largura (caso real, 1500x7000),
    // a gente roda 90 graus pra desenhar.
    const precisaGirar = chapa.altura > chapa.largura;
    const chapaWView = precisaGirar ? chapa.altura : chapa.largura;
    const chapaHView = precisaGirar ? chapa.largura : chapa.altura;

    // SVG dimensoes — tamanho generoso pra ficar legivel
    const SVG_W = 1400;
    const PADDING = 50;
    const wDisp = SVG_W - 2 * PADDING;
    // Altura proporcional ao formato visual (deitado)
    let svgH = wDisp * (chapaHView / chapaWView) + 2 * PADDING;
    svgH = Math.max(280, Math.min(svgH, 500));
    const hDisp = svgH - 2 * PADDING;
    const escalaX = wDisp / chapaWView;
    const escalaY = hDisp / chapaHView;
    const escala = Math.min(escalaX, escalaY);
    const offX = (SVG_W - chapaWView * escala) / 2;
    const offY = (svgH - chapaHView * escala) / 2;

    // Helpers de coordenada — converte coord da chapa REAL pra SVG.
    // Quando precisaGirar, troca os eixos: peca em (x_real, y_real)
    // vai pra (y_real, x_real) no SVG, e dimensoes invertidas.
    const tx = (xReal, yReal) => offX + (precisaGirar ? yReal : xReal) * escala;
    const ty = (xReal, yReal) => offY + (precisaGirar ? xReal : yReal) * escala;
    const tw = (wReal, hReal) => (precisaGirar ? hReal : wReal) * escala;
    const th = (wReal, hReal) => (precisaGirar ? wReal : hReal) * escala;

    // Background da chapa
    let svg = `
      <svg viewBox="0 0 ${SVG_W} ${svgH}" xmlns="http://www.w3.org/2000/svg"
           class="orc-aprov-svg" preserveAspectRatio="xMidYMid meet"
           style="cursor: zoom-in;">
        <rect x="${offX}" y="${offY}" width="${chapaWView * escala}" height="${chapaHView * escala}"
              fill="#fef3c7" stroke="#1f3658" stroke-width="2" />
    `;

    // Sobras (areas amarelas)
    chapa.sobrasRetangulos.forEach(s => {
      const xPx = tx(s.x, s.y);
      const yPx = ty(s.x, s.y);
      const wPx = tw(s.w, s.h);
      const hPx = th(s.w, s.h);
      svg += `<rect x="${xPx}" y="${yPx}" width="${wPx}" height="${hPx}"
                    fill="#fde68a" stroke="#a16207" stroke-width="0.5" stroke-dasharray="4 2" />`;
    });

    // Peças posicionadas
    chapa.pecasPosicionadas.forEach(pp => {
      const c = corPecaSvg(pp.peca);
      const xPx = tx(pp.x, pp.y);
      const yPx = ty(pp.x, pp.y);
      const wPx = tw(pp.larg, pp.alt);
      const hPx = th(pp.larg, pp.alt);

      svg += `<rect x="${xPx}" y="${yPx}" width="${wPx}" height="${hPx}"
                    fill="${c.fill}" stroke="${c.stroke}" stroke-width="1" />`;

      // Felipe (sessao 2026-06): mudou de ideia — "nao vejo problema
      // ter o id desde que tenha nessa imagem identificacao com nome
      // da peca e as medidas ate facilita". Voltar mostrar #id +
      // label + dimensoes. Para pecas pequenas, mostra label
      // encurtado + #id.
      const idStr = `#${pp.peca.id}`;
      const labelStr = pp.peca.label || '';
      const dimStr = `${Math.round(pp.larg)}×${Math.round(pp.alt)}`;
      const cx = xPx + wPx / 2;
      const cy = yPx + hPx / 2;

      // Texto: usa o lado MAIOR do retangulo no SVG pra calibrar fonte
      const ladoMaior = Math.max(wPx, hPx);
      const ladoMenor = Math.min(wPx, hPx);

      if (ladoMaior >= 60 && ladoMenor >= 24) {
        const fonteLabel = Math.min(11, ladoMaior / 12, ladoMenor / 3.5);
        const fonteDim = Math.min(9, ladoMaior / 14, ladoMenor / 5);
        const labelClipado = labelStr.length > 16 ? labelStr.slice(0, 16) + '…' : labelStr;
        // Se peca for mais alta que larga no SVG, escreve verticalmente
        const ehVertical = hPx > wPx * 1.5;
        const transformAttr = ehVertical
          ? `transform="rotate(-90 ${cx} ${cy})"`
          : '';
        svg += `<text x="${cx}" y="${cy - fonteLabel/2}" text-anchor="middle"
                      font-size="${fonteLabel.toFixed(1)}" fill="${c.text}"
                      font-weight="600" font-family="monospace" ${transformAttr}>
                  ${escapeHtml(labelClipado)} ${escapeHtml(idStr)}
                </text>`;
        svg += `<text x="${cx}" y="${cy + fonteLabel}" text-anchor="middle"
                      font-size="${fonteDim.toFixed(1)}" fill="${c.text}"
                      font-family="monospace" opacity="0.85" ${transformAttr}>
                  ${escapeHtml(dimStr)} mm
                </text>`;
      } else if (ladoMaior >= 30 && ladoMenor >= 12) {
        const fonte = Math.min(9, ladoMaior / 5, ladoMenor / 2.5);
        const ehVertical = hPx > wPx * 1.5;
        const transformAttr = ehVertical
          ? `transform="rotate(-90 ${cx} ${cy})"`
          : '';
        // Felipe (sessao 2026-06): pecas pequenas — mostra label
        // encurtado + #id. Se label e' muito longo, fica so' #id.
        const labelCurto = labelStr.length > 6 ? labelStr.slice(0, 6) + '…' : labelStr;
        const textoFinal = labelCurto ? `${labelCurto} ${idStr}` : idStr;
        svg += `<text x="${cx}" y="${cy + fonte/3}" text-anchor="middle"
                      font-size="${fonte.toFixed(1)}" fill="${c.text}"
                      font-family="monospace" ${transformAttr}>
                  ${escapeHtml(textoFinal)}
                </text>`;
      }
    });

    // Cotas externas — reflete dimensao REAL da chapa
    const corCota = '#1f3658';
    // Cota do lado HORIZONTAL no SVG (que e' o lado MAIOR da chapa real)
    const xMidSvg = offX + (chapaWView * escala) / 2;
    const yTopoCota = offY - 12;
    const dimensaoTopo = chapaWView;  // dimensao real
    svg += `<text x="${xMidSvg}" y="${yTopoCota}" text-anchor="middle"
                  font-size="12" fill="${corCota}" font-weight="700" font-family="monospace">
              ${dimensaoTopo} mm
            </text>`;
    // Cota do lado VERTICAL no SVG (lado MENOR)
    const xEsqCota = offX - 12;
    const yMidSvg = offY + (chapaHView * escala) / 2;
    const dimensaoLado = chapaHView;
    svg += `<text x="${xEsqCota}" y="${yMidSvg}" text-anchor="middle"
                  font-size="12" fill="${corCota}" font-weight="700" font-family="monospace"
                  transform="rotate(-90 ${xEsqCota} ${yMidSvg})">
              ${dimensaoLado} mm
            </text>`;

    svg += `</svg>`;
    return svg;
  }

  /**
   * Renderiza o painel de detalhes + SVG(s) de uma configuração.
   * Se tem mais de 1 chapa, mostra navegação tipo abas (Chapa 1, Chapa 2...).
   */
  function renderLayoutNesting(resultado, cardId) {
    const cfg = resultado.cfg || {};
    const numChapas = resultado.chapas.length;
    if (!numChapas) return '';

    // Se sao multiplas chapas, gera abas; senao, so um SVG
    const totaisPecas = resultado.chapas.reduce((s, c) => s + c.pecasPosicionadas.length, 0);

    // Painel detalhes
    const desperdicioGeral = ((1 - resultado.taxaAproveitamento) * 100).toFixed(2);
    const m2Chapa = (resultado.chapaMae.largura * resultado.chapaMae.altura / 1000000).toFixed(3);
    const m2Total = (m2Chapa * numChapas).toFixed(3);
    const m2Usado = (resultado.areaUsadaTotal / 1000000).toFixed(3);
    const m2Sobra = (m2Total - m2Usado).toFixed(3);

    const metodoLabel = {
      'normal': 'Normal (BLF)',
      'multi_horiz': 'Multiplos estagios — comprimento',
      'multi_vert': 'Multiplos estagios — largura',
    }[cfg.METODO] || cfg.METODO;

    const painelDetalhes = `
      <div class="orc-aprov-detalhes">
        <div class="orc-aprov-detalhes-titulo">Detalhes da Distribuicao</div>
        <div class="orc-aprov-detalhes-row"><span>Total de chapas:</span><b>${numChapas}</b></div>
        <div class="orc-aprov-detalhes-row"><span>Total de pecas:</span><b>${totaisPecas}</b></div>
        <div class="orc-aprov-detalhes-row"><span>Aproveitamento:</span><b>${(resultado.taxaAproveitamento * 100).toFixed(2)}%</b></div>
        <div class="orc-aprov-detalhes-row"><span>Desperdicio:</span><b>${desperdicioGeral}%</b></div>
        <div class="orc-aprov-detalhes-row"><span>Area chapa:</span><b>${m2Chapa} m²</b></div>
        <div class="orc-aprov-detalhes-row"><span>Area total comprada:</span><b>${m2Total} m²</b></div>
        <div class="orc-aprov-detalhes-row"><span>Area usada (peças):</span><b>${m2Usado} m²</b></div>
        <div class="orc-aprov-detalhes-row"><span>Area sobra:</span><b>${m2Sobra} m²</b></div>
        <div class="orc-aprov-detalhes-row"><span>Espessura serra (kerf):</span><b>${cfg.KERF || 4} mm</b></div>
        <div class="orc-aprov-detalhes-row"><span>Aparar chapa:</span><b>${cfg.APARAR || 5} mm (todas as bordas)</b></div>
        <div class="orc-aprov-detalhes-row"><span>Metodo:</span><b>${escapeHtml(metodoLabel)}</b></div>
      </div>
    `;

    // Tabs de chapa (se mais de 1)
    let tabsHtml = '';
    let svgHtml = '';
    if (numChapas === 1) {
      svgHtml = `<div class="orc-aprov-svg-wrap" data-chapa-idx="0">
                   ${renderSvgChapa(resultado.chapas[0], 1, 1)}
                 </div>`;
    } else {
      const tabs = resultado.chapas.map((c, i) => {
        const taxa = (c.taxa * 100).toFixed(0);
        return `<button type="button" class="orc-aprov-svg-tab ${i === 0 ? 'is-active' : ''}"
                       data-tab-chapa="${i}" data-card="${cardId}">
                  Chapa ${i + 1} <span class="orc-aprov-svg-tab-taxa">${taxa}%</span>
                </button>`;
      }).join('');
      tabsHtml = `<div class="orc-aprov-svg-tabs">${tabs}</div>`;
      svgHtml = resultado.chapas.map((c, i) => `
        <div class="orc-aprov-svg-wrap" data-chapa-idx="${i}"
             style="${i === 0 ? '' : 'display:none;'}">
          ${renderSvgChapa(c, i + 1, numChapas)}
        </div>
      `).join('');
    }

    // Legenda de cores
    const legenda = `
      <div class="orc-aprov-legenda">
        <span class="orc-aprov-legenda-item">
          <span class="orc-aprov-legenda-cor" style="background:#fb923c;border:1px solid #9a3412"></span>
          Pecas
        </span>
        <span class="orc-aprov-legenda-item">
          <span class="orc-aprov-legenda-cor" style="background:#fde68a;border:1px solid #a16207;border-style:dashed"></span>
          Sobra (desperdicio)
        </span>
        <span class="orc-aprov-legenda-item">
          <span class="orc-aprov-legenda-cor" style="background:#fef3c7;border:1px solid #1f3658"></span>
          Chapa-mae
        </span>
      </div>
    `;

    return `
      <div class="orc-aprov-layout">
        <div class="orc-aprov-layout-header">
          <span class="orc-aprov-layout-titulo">Layout de Corte — ${escapeHtml(resultado.chapaMae.descricao || '')}</span>
        </div>
        <div class="orc-aprov-layout-body">
          <div class="orc-aprov-layout-top">
            ${painelDetalhes}
            <div class="orc-aprov-layout-info">
              ${tabsHtml}
              ${legenda}
            </div>
          </div>
          <div class="orc-aprov-layout-svg-area">
            ${svgHtml}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Felipe (sessao 2026-05): abre modal full-width com o(s) SVG(s)
   * do layout em zoom grande. Se a configuracao tem MULTIPLAS chapas,
   * adiciona botoes "← Chapa anterior" / "Proxima chapa →" no footer
   * pra Felipe navegar entre elas sem fechar o modal.
   *
   * @param {Array} chapasSvgs - [{ svg: '<svg...>', titulo: 'Chapa 1' }, ...]
   * @param {string} tituloBase - titulo do layout (header do modal)
   * @param {number} idxInicial - indice da chapa a abrir (0-based)
   */
  function abrirModalLayout(chapasSvgs, tituloBase, idxInicial) {
    document.querySelectorAll('.orc-aprov-modal-overlay').forEach(m => m.remove());

    const lista = Array.isArray(chapasSvgs) ? chapasSvgs : [];
    if (!lista.length) return;
    let idxAtual = Math.max(0, Math.min(idxInicial || 0, lista.length - 1));
    const numChapas = lista.length;

    const overlay = document.createElement('div');
    overlay.className = 'orc-aprov-modal-overlay';
    overlay.innerHTML = `
      <div class="orc-aprov-modal-conteudo" role="dialog" aria-modal="true">
        <div class="orc-aprov-modal-header">
          <span class="orc-aprov-modal-titulo">
            ${escapeHtml(tituloBase)}
            <span class="orc-aprov-modal-chapa-info"></span>
          </span>
          <button type="button" class="orc-aprov-modal-fechar" aria-label="Fechar">✕</button>
        </div>
        <div class="orc-aprov-modal-body">
          <div class="orc-aprov-modal-svg-slot"></div>
        </div>
        <div class="orc-aprov-modal-footer">
          <span class="orc-aprov-modal-tip">
            🔍 Use o scroll do mouse pra dar zoom · ESC ou clique fora pra fechar
          </span>
          <div class="orc-aprov-modal-nav">
            <button type="button" class="orc-aprov-modal-prev"
                    ${numChapas > 1 ? '' : 'style="display:none"'}
                    title="Chapa anterior">← Chapa anterior</button>
            <button type="button" class="orc-aprov-modal-next"
                    ${numChapas > 1 ? '' : 'style="display:none"'}
                    title="Proxima chapa">Proxima chapa →</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const slotSvg = overlay.querySelector('.orc-aprov-modal-svg-slot');
    const infoSpan = overlay.querySelector('.orc-aprov-modal-chapa-info');
    const btnPrev = overlay.querySelector('.orc-aprov-modal-prev');
    const btnNext = overlay.querySelector('.orc-aprov-modal-next');

    function renderChapa() {
      slotSvg.innerHTML = lista[idxAtual].svg;
      infoSpan.innerHTML = numChapas > 1
        ? ` — <b>${escapeHtml(lista[idxAtual].titulo || `Chapa ${idxAtual + 1}`)}</b> <span class="orc-aprov-modal-chapa-cnt">(${idxAtual + 1} de ${numChapas})</span>`
        : '';
      // Atualiza estado dos botoes
      btnPrev.disabled = (idxAtual === 0);
      btnNext.disabled = (idxAtual === numChapas - 1);
      // Aplica zoom no SVG novo
      const svgEl = slotSvg.querySelector('svg.orc-aprov-svg');
      if (svgEl) {
        svgEl.style.cursor = 'grab';
        svgEl.style.maxWidth = '100%';
        svgEl.style.height = 'auto';
        svgEl.style.transform = 'scale(1)';
        svgEl.style.transformOrigin = 'top left';
      }
    }
    renderChapa();

    function fechar() {
      overlay.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function irChapa(delta) {
      const novoIdx = idxAtual + delta;
      if (novoIdx < 0 || novoIdx >= numChapas) return;
      idxAtual = novoIdx;
      renderChapa();
    }
    function onKey(e) {
      if (e.key === 'Escape') fechar();
      else if (e.key === 'ArrowRight') irChapa(1);
      else if (e.key === 'ArrowLeft')  irChapa(-1);
    }
    overlay.querySelector('.orc-aprov-modal-fechar').addEventListener('click', fechar);
    btnPrev.addEventListener('click', () => irChapa(-1));
    btnNext.addEventListener('click', () => irChapa(1));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fechar();
    });
    document.addEventListener('keydown', onKey);

    // Felipe (sessao 2026-05): zoom no scroll dentro do SVG
    let escalaZoom = 1;
    overlay.querySelector('.orc-aprov-modal-body').addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.1;
      escalaZoom = Math.max(0.5, Math.min(4, escalaZoom + delta));
      const svgEl = slotSvg.querySelector('svg.orc-aprov-svg');
      if (svgEl) {
        svgEl.style.transform = `scale(${escalaZoom})`;
        svgEl.style.transformOrigin = 'top left';
      }
    }, { passive: false });
  }

  function renderBlocoCor(cor, pecas, todasSuperficies, selecaoCor) {
    if (cor === '(sem cor)') {
      return `
        <div class="orc-aprov-cor">
          <div class="orc-aprov-cor-titulo">${escapeHtml(cor)}</div>
          <p class="orc-hint-text">${pecas.length} peca(s) sem cor definida — preencha as cores no item primeiro.</p>
        </div>`;
    }

    // Encontra os tamanhos disponiveis no cadastro pra esta cor.
    const nomeCurto = nomeCurtoSuperficie(cor);

    // Felipe (sessao 2026-05): se as superficies foram cadastradas ANTES
    // da feature de largura/altura, os campos estao zerados. Tentamos
    // EXTRAIR da descricao na hora (mesma logica de 26-superficies.js).
    // Assim funciona retroativamente sem o usuario precisar reabrir
    // Cadastros > Superficies.
    function extrairDimsDaDesc(desc) {
      const d = String(desc || '');
      // Helper de parse
      const tentarMatch = (str) => {
        const m = str.match(/(\d+(?:[.,]\d+)?)\s*(?:m)?\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(m)?/i);
        if (!m) return null;
        let l = parseFloat(m[1].replace(',', '.'));
        let a = parseFloat(m[2].replace(',', '.'));
        const ehMetros = !!m[3] || (l > 0 && l <= 5);
        if (ehMetros) { l *= 1000; a *= 1000; }
        return { largura: Math.round(l), altura: Math.round(a) };
      };
      // 1. PREFERENCIA — so' apos o ULTIMO " - " ou " — "
      //    (Felipe sessao 11: "Kynar4300 X5" no nome pegava 4300x5 errado)
      const idxTS = d.lastIndexOf(' - ');
      const idxTE = d.lastIndexOf(' — ');
      const idxU  = Math.max(idxTS, idxTE);
      if (idxU !== -1) {
        const r = tentarMatch(d.substring(idxU + 3).trim());
        if (r && r.largura >= 800 && r.largura <= 3000 && r.altura >= 1500 && r.altura <= 15000) return r;
      }
      // 2. FALLBACK — global com sanidade (largura 800-3000, altura 1500-15000)
      const re = /(\d+(?:[.,]\d+)?)\s*(?:m)?\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(m)?/gi;
      let match;
      while ((match = re.exec(d)) !== null) {
        let l = parseFloat(match[1].replace(',', '.'));
        let a = parseFloat(match[2].replace(',', '.'));
        const ehMetros = !!match[3] || (l > 0 && l <= 5);
        if (ehMetros) { l *= 1000; a *= 1000; }
        l = Math.round(l); a = Math.round(a);
        if (l >= 800 && l <= 3000 && a >= 1500 && a <= 15000) {
          return { largura: l, altura: a };
        }
      }
      return { largura: 0, altura: 0 };
    }

    // Felipe (sessao 2026-05): normalizacao DEFENSIVA pra matching.
    // Importacao XLSX pode trazer espacos non-breaking (\u00a0), tab,
    // espacos duplicados, hifens diferentes (-, –, —), etc. Ao inves
    // de tentar listar todos, removemos TUDO que nao e' alfanumerico.
    // "Pro37524 - Wood Sucupira Pvdf4300 Ldpe" e "Pro37524 Wood Sucupira Pvdf4300 Ldpe"
    // e "PRO37524-Wood-Sucupira-PVDF4300-LDPE" todos viram "PRO37524WOODSUCUPIRAPVDF4300LDPE".
    function normalizarParaMatch(s) {
      return String(s || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');   // SO alfanumerico maiusculo
    }
    const nomeCurtoNorm = normalizarParaMatch(nomeCurto);

    // Filtra variantes da mesma cor e enriquece com largura/altura
    // extraidas da descricao quando o cadastro nao tem.
    let variantesBrutas = todasSuperficies.filter(s => {
      const sNomeCurto = nomeCurtoSuperficie(s.descricao);
      return normalizarParaMatch(sNomeCurto) === nomeCurtoNorm;
    });

    // Fallback: substring (caso 1 nome contenha o outro)
    if (variantesBrutas.length === 0 && nomeCurtoNorm.length >= 4) {
      variantesBrutas = todasSuperficies.filter(s => {
        const sNomeCurtoNorm = normalizarParaMatch(nomeCurtoSuperficie(s.descricao));
        return sNomeCurtoNorm.length >= 4 && (
          sNomeCurtoNorm.includes(nomeCurtoNorm) ||
          nomeCurtoNorm.includes(sNomeCurtoNorm)
        );
      });
      if (variantesBrutas.length > 0) {
        console.log('[Aproveitamento] Match por substring achou', variantesBrutas.length,
          'variante(s) pra cor', JSON.stringify(cor));
      }
    }

    // Felipe (sessao 2026-05): 3a camada — primeira palavra-chave (codigo).
    if (variantesBrutas.length === 0) {
      const primeiraPalavraOriginal = String(cor || '').trim().split(/[\s\-–—]+/)[0] || '';
      const primeiraPalavraNorm = normalizarParaMatch(primeiraPalavraOriginal);
      if (primeiraPalavraNorm.length >= 5) {
        variantesBrutas = todasSuperficies.filter(s => {
          const sNorm = normalizarParaMatch(s.descricao);
          return sNorm.startsWith(primeiraPalavraNorm);
        });
        if (variantesBrutas.length > 0) {
          console.log('[Aproveitamento] Match por 1a palavra-chave achou',
            variantesBrutas.length, 'variante(s) com codigo', primeiraPalavraNorm);
        }
      }
    }

    // Felipe (sessao 2026-05): 4a camada — apenas DIGITOS do codigo.
    // Ultimo recurso. Se cor escolhida tem "Pro37524" e qualquer chapa
    // do cadastro contem "37524" (sequencia de 4+ digitos), considera
    // match. Resolve casos onde o codigo tem prefixo diferente (Pro/PR/
    // sem prefixo) ou caracteres especiais "PR0" vs "PRO".
    if (variantesBrutas.length === 0) {
      const matchDigitos = String(cor || '').match(/\d{4,}/);
      if (matchDigitos) {
        const digitos = matchDigitos[0];
        variantesBrutas = todasSuperficies.filter(s => {
          return String(s.descricao || '').includes(digitos);
        });
        if (variantesBrutas.length > 0) {
          console.log('[Aproveitamento] Match por digitos do codigo achou',
            variantesBrutas.length, 'variante(s) com', digitos);
        }
      }
    }

    // Felipe (sessao 11): validacao de sanidade — cadastro pode ter
    // dimensoes erradas (ex: 4300x5 extraido de "Kynar4300 X5").
    // Chapa real: largura 800-3000mm, altura 1500-15000mm.
    function dimsChapaSaoValidas(l, a) {
      return l >= 800 && l <= 3000 && a >= 1500 && a <= 15000;
    }

    const variantes = variantesBrutas
      .map(s => {
        const larg = Number(s.largura) || 0;
        const alt  = Number(s.altura)  || 0;
        if (larg > 0 && alt > 0 && dimsChapaSaoValidas(larg, alt)) return s;
        // Fallback: extrai da descricao (valores ausentes OU insanos)
        const dims = extrairDimsDaDesc(s.descricao);
        return Object.assign({}, s, {
          largura: dims.largura,
          altura:  dims.altura,
        });
      })
      .filter(s => Number(s.largura) > 0 && Number(s.altura) > 0);

    if (!variantes.length) {
      // Felipe (sessao 2026-05): mostra na TELA quais chapas existem
      // com a primeira palavra-chave (ex: "PRO37524") — assim Felipe
      // ve com seus olhos como esta cadastrado e identifica o problema.
      //
      // BUG ANTERIOR: usava nomeCurtoNorm (alfanumerico tudo junto)
      // pra extrair "primeira palavra", que pegava a string INTEIRA.
      // Agora pego do nome ORIGINAL antes da normalizacao.
      const primeiraPalavraOriginal = String(cor || '').trim().split(/[\s-–—]+/)[0] || '';
      const primeiraPalavraNorm = normalizarParaMatch(primeiraPalavraOriginal);
      const semelhantes = primeiraPalavraNorm
        ? todasSuperficies
            .filter(s => normalizarParaMatch(s.descricao).startsWith(primeiraPalavraNorm))
            .slice(0, 12)
            .map(s => s.descricao)
        : [];

      // Felipe (sessao 2026-05): debug mais completo no console pra
      // analisar o caso. Se Felipe abrir F12 ja' ve' tudo.
      console.warn('[Aproveitamento] Nao achou variantes pra cor:', {
        corEscolhida: cor,
        nomeCurto: nomeCurto,
        nomeCurtoNorm: nomeCurtoNorm,
        primeiraPalavraOriginal,
        primeiraPalavraNorm,
        totalSuperficiesCadastro: todasSuperficies.length,
        variantesBrutas: variantesBrutas.length,
        semelhantes,
        // Mostra ate 5 nomes brutos do storage que tem a primeira palavra
        amostraStorage: todasSuperficies
          .filter(s => normalizarParaMatch(s.descricao).startsWith(primeiraPalavraNorm))
          .slice(0, 5)
          .map(s => ({ desc: s.descricao, descNorm: normalizarParaMatch(s.descricao) })),
      });

      // Felipe (sessao 2026-05): se nada deu match, mostra TUDO do
      // storage que tem qualquer numero parecido com o codigo da cor.
      // Ultimo recurso pra debug visual.
      const matchDigitos = String(cor || '').match(/\d{4,}/);
      const digitos = matchDigitos ? matchDigitos[0] : '';
      const todasComDigitos = digitos
        ? todasSuperficies
            .filter(s => String(s.descricao || '').includes(digitos))
            .slice(0, 30)
            .map(s => s.descricao)
        : [];

      const semelhantesHtml = semelhantes.length
        ? `<br><br><b>Chapas que comecam com "${escapeHtml(primeiraPalavraOriginal)}" no SEU cadastro (${semelhantes.length} encontrada${semelhantes.length !== 1 ? 's' : ''}):</b>
           <ul style="margin: 4px 0; padding-left: 20px; font-size: 11px;">
             ${semelhantes.map(d => `<li><code>${escapeHtml(d)}</code></li>`).join('')}
           </ul>`
        : todasComDigitos.length
        ? `<br><br><b>Nao achei chapa que comece com "${escapeHtml(primeiraPalavraOriginal)}",
           mas estas tem "${escapeHtml(digitos)}" no nome:</b>
           <ul style="margin: 4px 0; padding-left: 20px; font-size: 11px;">
             ${todasComDigitos.map(d => `<li><code>${escapeHtml(d)}</code></li>`).join('')}
           </ul>`
        : `<br><br>Cadastro tem <b>${todasSuperficies.length} chapa(s)</b> total, mas nenhuma com "${escapeHtml(primeiraPalavraOriginal)}" ou "${escapeHtml(digitos || '?')}".
           <details style="margin-top: 8px;"><summary style="cursor:pointer; font-size: 11px;">▶ Mostrar primeiras 30 chapas do meu cadastro (debug)</summary>
           <ul style="margin: 4px 0; padding-left: 20px; font-size: 11px;">
             ${todasSuperficies.slice(0, 30).map(s => `<li><code>${escapeHtml(s.descricao)}</code></li>`).join('')}
           </ul></details>`;

      const msg = variantesBrutas.length > 0
        ? `Achei ${variantesBrutas.length} variante(s) com esse nome no cadastro, mas nenhuma tem largura/altura preenchidas (nem extraido do nome). Reabra <b>Cadastros > Superficies</b> e preencha "Largura (mm)" e "Altura (mm)" — ou edite o nome da chapa pra incluir o tamanho ex: "...1500 X 5000".`
        : `Cor escolhida: <code>${escapeHtml(cor)}</code>${semelhantesHtml}`;

      return `
        <div class="orc-aprov-cor">
          <div class="orc-aprov-cor-titulo">${escapeHtml(cor)}</div>
          <p class="orc-hint-text orc-banner-aviso-erro">${msg}</p>
          <p class="orc-hint-text">${pecas.length} peca(s) aguardando.</p>
        </div>`;
    }

    // Roda o algoritmo nos tamanhos disponiveis
    const resultados = window.ChapasAproveitamento.compararConfiguracoes(
      pecas,
      variantes.map(v => ({
        descricao: v.descricao,
        largura:   Number(v.largura),
        altura:    Number(v.altura),
        preco:     Number(v.preco) || 0,
        peso_kg_m2: Number(v.peso_kg_m2) || 0,
      }))
    );

    // Felipe (sessao 2026-05): mantem a ORDEM NATURAL das chapas
    // (5000 → 6000 → 7000 → 8000) — ja' vem ordenada de
    // compararConfiguracoes. NAO separa em viaveis/inviaveis na saida,
    // so' identifica a melhor pela flag isMelhor.
    const melhor = resultados.find(r => r.isMelhor) || null;

    // Felipe (sessao 2026-05 — peso v2): calcula peso da PORTA, do PORTAL
    // e total para a melhor configuração.
    const pesos = melhor ? calcularPesosPorCategoria(pecas, melhor) :
      { temPeso: false, porta: 0, portal: 0, revestimento: 0, total: 0 };

    // Felipe (sessao 2026-05): TODOS os cards na ORDEM NATURAL (1500x5000,
    // 1500x6000, 1500x7000, 1500x8000) — viaveis com layout completo e
    // botao de selecao, inviaveis com aviso e SEM botoes.
    // Felipe (sessao 28 fix): cacheia resultados completos por cardId
    // pra serem recuperados no duplo-click (sem inflar dataset com
    // chapas[] grande — JSON.stringify de pecasPosicionadas seria pesado).
    if (!window.__projettaResultadosNesting) window.__projettaResultadosNesting = {};
    const corNorm = String(cor || '').replace(/[^a-zA-Z0-9]/g, '_');
    const cards = resultados.map((r, idx) => {
      const ehMelhor = r.isMelhor;
      const ehViavel = r.pecasNaoCouberam.length === 0;
      // Felipe sessao 31: chapa selecionada pelo usuario (duplo-clique)
      // renderiza com .is-selecionada DIRETO no template — sem depender
      // de setTimeout pos-render que era fragil. Comparacao por largura
      // x altura (apos validar viabilidade).
      const ehSelecionada = ehViavel && selecaoCor &&
        Number(selecaoCor.largura) === Number(r.chapaMae.largura) &&
        Number(selecaoCor.altura)  === Number(r.chapaMae.altura);
      const dimSize = `${r.chapaMae.largura} × ${r.chapaMae.altura} mm`;
      const cardId = `aprov-${corNorm}-${idx}`;
      // Cacheia resultado completo pra dblclick salvar
      window.__projettaResultadosNesting[cardId] = r;

      // Card INVIAVEL — peca maior que a chapa
      if (!ehViavel) {
        const naoCouberam = r.pecasNaoCouberam.length;
        const maiorNaoCoube = r.pecasNaoCouberam.reduce((maior, p) =>
          (p.largura * p.altura > (maior?.largura || 0) * (maior?.altura || 0)) ? p : maior
        , null);
        const motivoTxt = maiorNaoCoube
          ? `Peça "${maiorNaoCoube.label}" (${maiorNaoCoube.largura}×${maiorNaoCoube.altura}mm) maior que a chapa.`
          : `${naoCouberam} peça(s) maior(es) que a chapa.`;
        return `
          <div class="orc-aprov-card-wrap">
            <div class="orc-aprov-card is-inviavel">
              <div class="orc-aprov-card-tam">${escapeHtml(dimSize)}</div>
              <div class="orc-aprov-card-inviavel">
                <span class="orc-aprov-card-inviavel-icon">✕</span>
                <b>Não pode ser usada</b>
              </div>
              <div class="orc-aprov-card-inviavel-motivo">${escapeHtml(motivoTxt)}</div>
            </div>
          </div>`;
      }

      // Card VIAVEL — com layout
      const taxa = (r.taxaAproveitamento * 100).toFixed(1);
      const precoUnit = Number(r.chapaMae.preco) || 0;
      const precoUnitStr = precoUnit > 0 ? `R$ ${fmtBR(precoUnit)}` : '—';
      const custoStr = r.custoTotal > 0
        ? `R$ ${fmtBR(r.custoTotal)}`
        : '— sem preço';
      const m2PorChapa = (r.chapaMae.largura * r.chapaMae.altura) / 1000000;
      const pesoTotalChapas = (Number(r.chapaMae.peso_kg_m2) || 0) * m2PorChapa * r.numChapas;
      const pesoStr = pesoTotalChapas > 0
        ? `${pesoTotalChapas.toFixed(1).replace('.', ',')} kg`
        : '— sem peso';
      const layoutHtml = renderLayoutNesting(r, cardId);

      // Felipe (sessao 2026-05): atributos pra duplo clique selecionar
      // a chapa pra computar o custo. Os dados precisam estar no DOM
      // pra serem lidos pelo handler do duplo-clique.
      const dadosChapaSel = JSON.stringify({
        descricao: r.chapaMae.descricao,
        largura: r.chapaMae.largura,
        altura: r.chapaMae.altura,
        preco: precoUnit,
        numChapas: r.numChapas,
        custoTotal: r.custoTotal,
        peso_kg_m2: Number(r.chapaMae.peso_kg_m2) || 0,
        pesoTotal: pesoTotalChapas,
        cor: cor,
      });

      return `
        <div class="orc-aprov-card-wrap">
          <div class="orc-aprov-card ${ehMelhor ? 'is-melhor' : ''} ${ehSelecionada ? 'is-selecionada' : ''}" id="${cardId}-card"
               data-chapa-info='${escapeHtml(dadosChapaSel)}'
               data-card-id="${cardId}"
               title="Duplo clique para selecionar esta chapa">
            ${ehMelhor ? '<div class="orc-aprov-melhor-badge">★ Melhor opção</div>' : ''}
            <div class="orc-aprov-card-selecionada-badge">★ Selecionada</div>
            <div class="orc-aprov-card-tam">${escapeHtml(dimSize)}</div>
            <div class="orc-aprov-card-num"><b>${r.numChapas}</b> chapa${r.numChapas !== 1 ? 's' : ''}</div>
            <div class="orc-aprov-card-taxa">Aproveitamento: <b>${taxa}%</b></div>
            <div class="orc-aprov-card-precos">
              <div class="orc-aprov-card-preco-row">
                <span>Preço unitário:</span><b>${escapeHtml(precoUnitStr)}</b>
              </div>
              <div class="orc-aprov-card-preco-row orc-aprov-card-preco-total">
                <span>Total (${r.numChapas} chapa${r.numChapas !== 1 ? 's' : ''}):</span><b>${escapeHtml(custoStr)}</b>
              </div>
            </div>
            <div class="orc-aprov-card-peso">Peso: ${escapeHtml(pesoStr)}</div>
            <div class="orc-aprov-card-actions">
              <button type="button" class="orc-aprov-card-btn-layout"
                      data-toggle-layout="${cardId}">
                📐 Ver layout de corte
              </button>
              <span class="orc-aprov-card-tip">duplo clique pra selecionar</span>
            </div>
          </div>
          <div class="orc-aprov-layout-wrap" id="${cardId}-layout" style="display:none;">
            ${layoutHtml}
          </div>
        </div>
      `;
    }).join('');

    // Verifica se ha pelo menos 1 viavel
    const algumaViavel = resultados.some(r => r.pecasNaoCouberam.length === 0);
    if (!algumaViavel) {
      // Felipe sessao 12: 'se a chapa for maior, demonstre destaque qual
      // chapa e para ajuste'. Banner agora mostra destaque vermelho com
      // titulo grande + lista das pecas problemáticas + sugestoes acionaveis.
      // Coleta TODAS as pecas que nao cabem (de qq resultado) - sao as
      // mesmas em todas as chapas. Pega uma amostra do 1º resultado.
      const pecasProblema = (resultados[0] && resultados[0].pecasNaoCouberam) || [];
      const dedupProblema = [];
      const seenLabels = new Set();
      pecasProblema.forEach(p => {
        const k = `${p.label}|${p.largura}|${p.altura}`;
        if (seenLabels.has(k)) return;
        seenLabels.add(k);
        dedupProblema.push(p);
      });
      const maiorPeca = dedupProblema.reduce((maior, p) =>
        (p.largura * p.altura > (maior?.largura || 0) * (maior?.altura || 0)) ? p : maior
      , null);
      const chapasDispDim = resultados.map(r => `${r.chapaMae.largura}×${r.chapaMae.altura}mm`).join(', ');
      return `
        <div class="orc-aprov-cor orc-aprov-cor-inviavel">
          <div class="orc-aprov-cor-titulo orc-aprov-cor-titulo-erro">
            🚨 <b>${escapeHtml(cor)}</b> — Nenhuma chapa comporta as peças
          </div>
          <div class="orc-banner-aviso-erro" style="padding:14px 18px;border-radius:8px;border-left:4px solid #dc2626;background:#fef2f2;">
            <div style="font-weight:700;font-size:14px;color:#7f1d1d;margin-bottom:8px;">
              ⚠️ Esta cor precisa de ajuste — todas as ${resultados.length} chapas-mãe disponíveis sao menores que ${dedupProblema.length} peça${dedupProblema.length>1?'s':''} do item.
            </div>
            ${maiorPeca ? `
            <div style="background:#fff;padding:10px 14px;border-radius:6px;border:1px solid #fca5a5;margin:8px 0;">
              <div style="font-size:11px;color:#7f1d1d;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Maior peça que não cabe</div>
              <div style="font-weight:700;color:#991b1b;font-size:15px;">
                ${escapeHtml(maiorPeca.label)} — <span style="font-variant-numeric:tabular-nums;">${maiorPeca.largura}×${maiorPeca.altura}mm</span>
              </div>
            </div>` : ''}
            <div style="font-size:13px;color:#7f1d1d;margin-top:6px;">
              <b>Chapas-mãe disponíveis:</b> ${escapeHtml(chapasDispDim)}
            </div>
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #fca5a5;">
              <div style="font-weight:600;color:#7f1d1d;margin-bottom:6px;">O que fazer:</div>
              <ul style="margin:0 0 0 18px;color:#7f1d1d;font-size:13px;line-height:1.5;">
                <li>Cadastrar uma chapa-mãe maior em <b>Cadastros > Superfícies</b> (ex: 1500×8000mm)</li>
                <li>Revisar dimensões do item — talvez a peça esteja com medida fora do esperado</li>
                <li>Trocar pra cor que tenha chapa cadastrada compatível</li>
              </ul>
            </div>
          </div>
          <div class="orc-aprov-cards">${cards}</div>
        </div>`;
    }

    const totalPecas = pecas.reduce((s, p) => s + (p.qtd || 1), 0);
    const totalArea = pecas.reduce((s, p) => s + p.largura * p.altura * (p.qtd || 1), 0);
    const totalAreaM2 = (totalArea / 1000000).toFixed(2);

    // Bloco de PESOS (só aparece se tem peso cadastrado).
    // Felipe (sessao 2026-05 — peso v3): mostra 3 grupos:
    //   1. PESO ÚTIL (peças que vão pra porta) — porta + portal + rev
    //   2. PESO COMPRADO (chapa-mãe inteira × num_chapas)
    //   3. DESPERDÍCIO (sobra) = comprado - util
    const blocoPesos = pesos.temPeso ? `
      <div class="orc-aprov-pesos">
        <div class="orc-aprov-pesos-titulo">Distribuição do peso (melhor opção)</div>

        <div class="orc-aprov-pesos-grupo">
          <div class="orc-aprov-pesos-grupo-titulo">📦 Peso ÚTIL — vai pra porta pronta</div>
          ${pesos.porta > 0 ? `
          <div class="orc-aprov-pesos-row">
            <span>Porta (folha):</span>
            <b>${fmtBR(pesos.porta)} kg</b>
          </div>` : ''}
          ${pesos.portal > 0 ? `
          <div class="orc-aprov-pesos-row">
            <span>Portal (moldura fixa):</span>
            <b>${fmtBR(pesos.portal)} kg</b>
          </div>` : ''}
          ${pesos.revestimento > 0 ? `
          <div class="orc-aprov-pesos-row">
            <span>Revestimento de parede:</span>
            <b>${fmtBR(pesos.revestimento)} kg</b>
          </div>` : ''}
          <div class="orc-aprov-pesos-row orc-aprov-pesos-subtotal">
            <span>Subtotal útil (peças):</span>
            <b>${fmtBR(pesos.pecasUtil)} kg</b>
          </div>
        </div>

        <div class="orc-aprov-pesos-grupo">
          <div class="orc-aprov-pesos-grupo-titulo">🧾 Peso COMPRADO — vai pro frete e custo</div>
          <div class="orc-aprov-pesos-row">
            <span>Chapas-mãe (inclui sobra):</span>
            <b>${fmtBR(pesos.comprado)} kg</b>
          </div>
          <div class="orc-aprov-pesos-row orc-aprov-pesos-desp">
            <span>↳ desperdício (sobra):</span>
            <b>${fmtBR(pesos.desperdicio)} kg</b>
          </div>
        </div>
      </div>
    ` : '';

    return `
      <div class="orc-aprov-cor" data-cor-validar="${escapeHtml(cor)}">
        <div class="orc-aprov-cor-header">
          <div class="orc-aprov-cor-titulo">${escapeHtml(cor)}</div>
          <div class="orc-aprov-cor-stats">
            ${totalPecas} peca${totalPecas !== 1 ? 's' : ''} · ${totalAreaM2} m² total
          </div>
        </div>
        <div class="orc-aprov-cards">
          ${cards}
        </div>
        ${blocoPesos}
      </div>`;
  }

  /**
   * Felipe (sessao 2026-05 — peso): calcula peso da PORTA, do PORTAL e
   * peso TOTAL pra um conjunto de peças e a melhor configuração de chapa.
   *
   * Lógica:
   *   - PESO TOTAL = num_chapas × peso_por_chapa (peso COMPRADO, inclui sobra)
   *   - Distribuir esse peso entre PORTA e PORTAL proporcionalmente à
   *     ÁREA TOTAL DAS PEÇAS de cada categoria (porta vs portal).
   *
   *   Ex: 10kg total, peças porta=60% da área das peças, peças portal=40%
   *       → peso porta = 6kg, peso portal = 4kg, total = 10kg
   */
  /**
   * Felipe (sessao 2026-05 — peso v3): calcula peso REAL das pecas e
   * peso COMPRADO separadamente. Felipe pegou o bug: antes a gente
   * distribuia o peso COMPRADO (incluindo desperdicio) entre porta e
   * portal — agora calcula o peso REAL de cada categoria pela area
   * das pecas × kg/m². Desperdicio fica como info separada.
   *
   * Retorna:
   *   - porta:         peso REAL das pecas categoria 'porta' (kg)
   *   - portal:        peso REAL das pecas categoria 'portal' (kg)
   *   - revestimento:  peso REAL das pecas categoria 'revestimento' (kg)
   *   - pecasUtil:     soma dos 3 acima (peso da PORTA pronta, sem sobra)
   *   - comprado:      peso da chapa-mae inteira × num_chapas (inclui sobra)
   *   - desperdicio:   comprado - pecasUtil (peso da sobra)
   *   - total:         (compatibilidade) = comprado
   */
  function calcularPesosPorCategoria(pecas, resultadoMelhor) {
    const pesoKgM2 = Number(resultadoMelhor?.chapaMae?.peso_kg_m2) || 0;
    const largChapa = Number(resultadoMelhor?.chapaMae?.largura) || 0;
    const altChapa  = Number(resultadoMelhor?.chapaMae?.altura) || 0;
    if (!pesoKgM2 || !resultadoMelhor.numChapas || !largChapa || !altChapa) {
      return { temPeso: false, porta: 0, portal: 0, revestimento: 0,
               pecasUtil: 0, comprado: 0, desperdicio: 0, total: 0 };
    }
    const m2PorChapa = (largChapa * altChapa) / 1000000;
    const pesoComprado = pesoKgM2 * m2PorChapa * resultadoMelhor.numChapas;

    // Felipe (sessao 2026-05 — peso v3): peso REAL por categoria
    // (area das pecas em m² × kg/m²). NAO rateia o desperdicio.
    let pesoPorta  = 0;
    let pesoPortal = 0;
    let pesoRev    = 0;
    pecas.forEach(p => {
      const m2 = (Number(p.largura) || 0) * (Number(p.altura) || 0) * (Number(p.qtd) || 1) / 1000000;
      const peso = m2 * pesoKgM2;
      if (p.categoria === 'portal')             pesoPortal += peso;
      else if (p.categoria === 'revestimento')  pesoRev    += peso;
      else                                       pesoPorta  += peso;
    });
    const pesoPecasUtil = pesoPorta + pesoPortal + pesoRev;
    const pesoDesperdicio = Math.max(0, pesoComprado - pesoPecasUtil);

    return {
      temPeso: true,
      porta:        pesoPorta,           // peso REAL das pecas categoria porta
      portal:       pesoPortal,          // idem portal
      revestimento: pesoRev,             // idem revestimento
      pecasUtil:    pesoPecasUtil,       // soma das 3 acima (peso real da porta)
      comprado:     pesoComprado,        // chapa-mae × num_chapas (com sobra)
      desperdicio:  pesoDesperdicio,     // sobra = comprado - util
      total:        pesoComprado,        // backward-compat
    };
  }

  /**
   * Helper: extrai nome curto da superficie (ignorando sufixo de tamanho).
   * "As002 - Wood Carvalho - 1500x5000" → "As002 - Wood Carvalho"
   */
  function nomeCurtoSuperficie(desc) {
    if (!desc) return '';
    return String(desc)
      .replace(/\s*[-–]\s*\d{3,4}\s*[xX×]\s*\d{3,4}\s*$/, '')
      .trim();
  }

  /**
   * Felipe (sessao 2026-05): renderiza bloco do revestimento_parede
   * na aba Lev. Superficies. Mostra resumo do modo (manual/automatico)
   * e tabela de peças geradas pelo motor ChapasRevParede.
   */
  function renderItemRevSuperficies(item, idx) {
    const numItem = idx + 1;
    // Felipe sessao 18: pergolado reusa essa funcao mas com seu proprio
    // motor de chapas (ChapasPergolado.gerarPecasPergolado).
    const ehPergolado = item.tipo === 'pergolado';
    const Motor = ehPergolado ? window.ChapasPergolado : window.ChapasRevParede;
    const tituloTipo = ehPergolado ? 'Pergolado' : 'Revestimento de Parede';
    if (!Motor) {
      return `<div class="orc-section orc-lev-sup-item">
        <div class="orc-section-title">Item ${numItem} — ${tituloTipo}</div>
        <p class="orc-hint-text orc-banner-aviso-erro">
          Motor (${ehPergolado ? 'ChapasPergolado' : 'ChapasRevParede'}) nao carregado. Recarregue (Ctrl+F5).
        </p>
      </div>`;
    }
    // Felipe sessao 12: 'os itens do revestimento parede tbm devem ficar
    // editaveis'. Aplica overrides ja' existentes (rotaciona +
    // largura/altura/qtd) que o motor de superficies do orcamento usa
    // pra portas externas. Reuso garante consistencia.
    let pecas = ehPergolado
      ? (Motor.gerarPecasPergolado(item) || [])
      : (Motor.gerarPecasRevParede(item) || []);
    pecas = aplicarRotacionaOverrides(pecas, item);
    pecas = aplicarSuperficiesOverrides(pecas, item);
    const modoLabel = item.modo === 'automatico' ? 'Modo Automatico' : 'Modo Manual';
    const cor = item.cor || '— sem cor';
    const refilLabel = item.com_refilado === 'nao' ? 'sem refilado' : 'com refilado (REF)';

    let metaHtml = '';
    if (item.modo === 'automatico') {
      const L = Number(item.largura_total) || 0;
      const H = Number(item.altura_total) || 0;
      const div = item.divisao_largura === 'igual' ? 'divisao igual' : 'largura maxima';
      metaHtml = `Parede: ${L}×${H}mm · ${div} · ${refilLabel}`;
    } else {
      metaHtml = `${(item.pecas || []).length} pecas individuais`;
    }

    if (!pecas.length) {
      return `<div class="orc-section orc-lev-sup-item">
        <div class="orc-section-title">
          Item ${numItem} — Revestimento de Parede
          <span class="orc-lev-sup-meta">${escapeHtml(modoLabel)} · ${escapeHtml(metaHtml)}</span>
        </div>
        <p class="orc-hint-text orc-lev-sup-empty">
          Nenhuma peca gerada. Preencha as medidas em "Caracteristicas do Item".
        </p>
      </div>`;
    }

    const linhas = pecas.map(p => {
      // Felipe (sessao 2026-05): SELECT editavel Sim/Nao em vez de "Nao (veio)"
      const chave = rotacionaKey(p);
      const valor = p.podeRotacionar ? 'sim' : 'nao';
      const editado = !!p._editado;
      const selectHtml = `
        <select class="orc-lev-sup-rot-select"
                data-item-idx="${idx}"
                data-peca-key="${escapeHtml(chave)}">
          <option value="sim" ${valor === 'sim' ? 'selected' : ''}>Sim</option>
          <option value="nao" ${valor === 'nao' ? 'selected' : ''}>Nao</option>
        </select>`;
      // Felipe sessao 12: Largura/Altura/Qtd editaveis via input number.
      // data-rev-edit identifica os inputs - listener separado salva em
      // item.superficiesOverrides[chave] = {largura?, altura?, qtd?}.
      const cssEdit = editado ? 'orc-lev-sup-input-editado' : '';
      // Felipe sessao 14: 'as pecas que tem o refilado podedria ao lado me
      // dar a peca seca, sem o aumento do refilado'. Mostra abaixo do
      // input em texto cinza pequeno: 'sec NNN'. Aparece SO em pecas
      // com nome iniciando em 'Tampa' OU 'Fita Acabamento' (Felipe pediu
      // restrito a essas pecas — outras nao precisam do hint).
      // REF pode ser 0/1/2 vezes em cada dimensao — calculo dinamico em
      // 38-chapas-porta-externa.js (roda formula com REF=0 e compara).
      const _lblPeca = String(p.label || '');
      const _ehTampaOuFita = /^(Tampa|Fita Acabamento)\b/i.test(_lblPeca);
      const _largSec = Number(p.larguraSemRef);
      const _altSec  = Number(p.alturaSemRef);
      const _hintLarg = (_ehTampaOuFita && Number.isFinite(_largSec) && _largSec > 0 && Math.abs(_largSec - Number(p.largura)) >= 0.5)
        ? `<div class="orc-lev-sup-hint-sec">sec ${_largSec}</div>` : '';
      const _hintAlt  = (_ehTampaOuFita && Number.isFinite(_altSec)  && _altSec  > 0 && Math.abs(_altSec  - Number(p.altura))  >= 0.5)
        ? `<div class="orc-lev-sup-hint-sec">sec ${_altSec}</div>` : '';
      const inputLargura = `<input type="number" class="orc-lev-sup-input ${cssEdit}"
        data-rev-edit="largura" data-item-idx="${idx}" data-peca-key="${escapeHtml(chave)}"
        value="${p.largura}" min="1" step="1" style="width:70px;text-align:right;" />${_hintLarg}`;
      const inputAltura = `<input type="number" class="orc-lev-sup-input ${cssEdit}"
        data-rev-edit="altura" data-item-idx="${idx}" data-peca-key="${escapeHtml(chave)}"
        value="${p.altura}" min="1" step="1" style="width:70px;text-align:right;" />${_hintAlt}`;
      const inputQtd = `<input type="number" class="orc-lev-sup-input ${cssEdit}"
        data-rev-edit="qtd" data-item-idx="${idx}" data-peca-key="${escapeHtml(chave)}"
        value="${p.qtd}" min="1" step="1" style="width:60px;text-align:right;" />`;
      return `
      <tr>
        <td>${escapeHtml(p.label)}</td>
        <td>${inputLargura}</td>
        <td>${inputAltura}</td>
        <td class="t-num">${inputQtd}</td>
        <td class="orc-lev-sup-rot-cell ${p.podeRotacionar ? '' : 't-warn'}">${selectHtml}</td>
        <td class="orc-lev-sup-cor">${escapeHtml(p.cor || '—')}</td>
      </tr>`;
    }).join('');

    return `
      <div class="orc-section orc-lev-sup-item">
        <div class="orc-section-title">
          Item ${numItem} — Revestimento de Parede
          <span class="orc-lev-sup-meta">${escapeHtml(modoLabel)} · ${escapeHtml(metaHtml)}</span>
        </div>
        <div class="orc-lev-sup-quadro">
          <span class="orc-lev-sup-quadro-label">Cor:</span>
          <b>${escapeHtml(cor)}</b>
        </div>
        <div class="orc-lev-sup-lado">
          <div class="orc-lev-sup-lado-title">Pecas geradas</div>
          <table class="cad-table orc-lev-sup-table">
            <thead>
              <tr>
                <th>Peca</th>
                <th>Largura (mm)</th>
                <th>Altura (mm)</th>
                <th>Qtd</th>
                <th>Pode rotacionar?</th>
                <th>Cor</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </div>`;
  }

  /**
   * Renderiza um bloco por item: cabeçalho com quadro, depois 2 tabelas
   * (peças externas + peças internas).
   */
  function renderItemSuperficies(item, idx, todasSuperficies) {
    const numItem = idx + 1;
    const Chapas = window.ChapasPortaExterna;

    // Felipe (sessao 2026-05): revestimento_parede tem bloco proprio
    // (mostra peças geradas pelo motor ChapasRevParede).
    if (item.tipo === 'revestimento_parede') {
      return renderItemRevSuperficies(item, idx);
    }

    // Felipe sessao 18: pergolado tambem usa renderItemRevSuperficies
    // (mesma estrutura - lista de pecas do motor proprio).
    if (item.tipo === 'pergolado') {
      return renderItemRevSuperficies(item, idx);
    }

    // Felipe sessao 12: fixo_acoplado renderiza igual porta_externa,
    // mas usando o motor PerfisRevAcoplado (que filtra/ajusta as pecas
    // herdadas do motor da porta). Reusa renderTabelaPecas/unificarPecas/
    // adicionarPecasManuaisExtras pra zero duplicacao.
    if (item.tipo === 'fixo_acoplado') {
      return renderItemFixoSuperficies(item, idx, todasSuperficies);
    }

    // Felipe sessao 31: porta_interna tem 2 chapas frontais (externa + interna).
    // Motor: window.ChapasPortaInterna (38b-chapas-porta-interna.js).
    if (item.tipo === 'porta_interna') {
      return renderItemPortaInternaSuperficies(item, idx, todasSuperficies);
    }

    // Outros tipos sem motor de chapas ainda
    if (item.tipo !== 'porta_externa') {
      const tipoLabel = ({
        porta_interna: 'Porta Interna',
      })[item.tipo] || item.tipo;
      return `
        <div class="orc-section orc-lev-sup-item">
          <div class="orc-section-title">
            Item ${numItem} — ${escapeHtml(tipoLabel)}
            <span class="orc-lev-sup-meta">tipo nao implementado ainda</span>
          </div>
          <p class="orc-hint-text orc-lev-sup-empty">
            Pecas de chapa pra <b>${escapeHtml(tipoLabel)}</b> ainda nao foram
            especificadas. Quando voce passar as fórmulas das peças desse
            tipo, ele entra no calculo de aproveitamento junto com as portas
            externas (cores iguais sao agrupadas na mesma chapa).
          </p>
        </div>`;
    }

    const quadro = Chapas.calcularQuadro(item);
    if (!quadro) {
      return `
        <div class="orc-section orc-lev-sup-item">
          <div class="orc-section-title">Item ${numItem} — sem dimensoes</div>
          <p class="orc-hint-text">
            Volte para "Caracteristicas do Item" e preencha largura, altura e numero de folhas.
          </p>
        </div>`;
    }

    const familiaLabel = quadro.familia === '76' ? 'PA-006F (familia 76)' : 'PA-007F (familia 101)';
    // Felipe (sessao 2026-05): aplica overrides de Rotaciona Sim/Nao salvos
    // pelo usuario no select da tabela. Sem override -> usa valor calculado
    // pelo motor (cor Wood = false).
    // Felipe (sessao 2026-08): aplica TAMBEM overrides de largura/altura/qtd
    // (edicoes manuais inline) e concatena pecas manuais extras.
    let pecasExt = aplicarRotacionaOverrides(Chapas.gerarPecasChapa(item, 'externo'), item);
    let pecasInt = aplicarRotacionaOverrides(Chapas.gerarPecasChapa(item, 'interno'), item);
    pecasExt = aplicarSuperficiesOverrides(pecasExt, item);
    pecasInt = aplicarSuperficiesOverrides(pecasInt, item);

    const modeloExt = Number(item.modeloExterno || item.modeloNumero) || 0;
    const modeloInt = Number(item.modeloInterno || item.modeloNumero) || 0;

    // Felipe (sessao 2026-05): se cor externa === cor interna E modelo
    // externo === interno, mostra UMA tabela so' com quantidades somadas.
    // Felipe pediu: "esta a mesma cor entao nao deveria parecer interno
    // e externo e sim tudo uma coisa so somando as quantidades".
    const corExt = String(item.corExterna || '').trim();
    const corInt = String(item.corInterna || '').trim();
    const corUnica = corExt && corExt === corInt && modeloExt === modeloInt;

    let tabelasHtml = '';
    if (corUnica) {
      // Junta as pecas dos 2 lados, somando quantidades por (label + dimensoes).
      // Quando externo e interno geram exatamente as mesmas pecas, a soma
      // simplesmente dobra as quantidades (porque o motor ja exclui
      // U_PORTAL do interno em cor unica — entao a U_PORTAL fica qtd 1).
      let pecasUnificadas = unificarPecas(pecasExt, pecasInt);
      // Felipe sessao 2026-08: adiciona pecas manuais extras (apenas 1x na
      // visualizacao unificada).
      pecasUnificadas = adicionarPecasManuaisExtras(pecasUnificadas, item);
      tabelasHtml = renderTabelaPecas(
        'Externo + Interno (cor unica)',
        pecasUnificadas, modeloExt, corExt, todasSuperficies, idx
      );
    } else {
      // Cores diferentes: 2 tabelas separadas como antes
      // Pecas manuais extras vao no Externo (Felipe pode duplicar manualmente
      // no Interno se quiser).
      const pecasExtComExtras = adicionarPecasManuaisExtras(pecasExt, item);
      tabelasHtml = `
        ${renderTabelaPecas('Lado Externo', pecasExtComExtras, modeloExt, item.corExterna, todasSuperficies, idx)}
        ${renderTabelaPecas('Lado Interno', pecasInt, modeloInt, item.corInterna, todasSuperficies, idx)}
      `;
    }

    return `
      <div class="orc-section orc-lev-sup-item">
        <div class="orc-section-title">
          Item ${numItem} — Porta Externa
          <span class="orc-lev-sup-meta">
            ${item.largura}×${item.altura} mm,
            ${quadro.nFolhas} folha${quadro.nFolhas > 1 ? 's' : ''} · ${familiaLabel}
            · <b>${Math.max(1, parseInt(item.quantidade, 10) || 1)} porta${(item.quantidade || 1) > 1 ? 's' : ''}</b>
          </span>
        </div>
        <div class="orc-lev-sup-quadro">
          <span class="orc-lev-sup-quadro-label">Quadro (limite das pecas):</span>
          <b>${quadro.larguraQuadro} × ${quadro.alturaQuadro} mm</b>
        </div>
        ${tabelasHtml}
      </div>
    `;
  }

  /**
   * Felipe sessao 12: render do levantamento de superficies para FIXO
   * ACOPLADO. Reusa as helpers da porta (renderTabelaPecas/unificarPecas/
   * adicionarPecasManuaisExtras) - zero duplicacao - chamando o motor
   * PerfisRevAcoplado.gerarPecasChapa que ja filtra/ajusta pecas.
   */
  /**
   * Felipe sessao 31: render do bloco de Superficies pra PORTA INTERNA.
   * Espelhada em renderItemFixoSuperficies — 2 chapas (ext + int), formula
   * propria do motor 38b-chapas-porta-interna.js.
   */
  function renderItemPortaInternaSuperficies(item, idx, todasSuperficies) {
    const numItem = idx + 1;
    const Motor = window.ChapasPortaInterna;
    if (!Motor || !Motor.gerarPecasChapa) {
      return `
        <div class="orc-section orc-lev-sup-item">
          <div class="orc-section-title">Item ${numItem} — Porta Interna</div>
          <p class="orc-hint-text orc-lev-sup-empty">
            Motor de chapas (ChapasPortaInterna) nao carregado. Recarregue a pagina (Ctrl+Shift+R).
          </p>
        </div>`;
    }

    // Aceita formato BR (virgula) — _toNum interno do motor ja lida
    const larg = (window.parseBR ? window.parseBR(item.largura) : Number(item.largura)) || 0;
    const alt  = (window.parseBR ? window.parseBR(item.altura)  : Number(item.altura))  || 0;
    if (!larg || !alt) {
      return `
        <div class="orc-section orc-lev-sup-item">
          <div class="orc-section-title">Item ${numItem} — Porta Interna — sem dimensoes</div>
          <p class="orc-hint-text">Volte para "Caracteristicas do Item" e preencha largura e altura.</p>
        </div>`;
    }

    let pecasExt = aplicarRotacionaOverrides(Motor.gerarPecasChapa(item, 'externo') || [], item);
    let pecasInt = aplicarRotacionaOverrides(Motor.gerarPecasChapa(item, 'interno') || [], item);
    pecasExt = aplicarSuperficiesOverrides(pecasExt, item);
    pecasInt = aplicarSuperficiesOverrides(pecasInt, item);

    const corExt = String(item.corExterna || '').trim();
    const corInt = String(item.corInterna || '').trim();
    const modeloEfetivo = Number(item.modeloNumero) || 0;
    // Cor unica: ambas iguais (mesmo se ambas vazias — caso novo item)
    const corUnica = corExt === corInt;

    let tabelasHtml = '';
    if (corUnica) {
      let pecasUnificadas = unificarPecas(pecasExt, pecasInt);
      pecasUnificadas = adicionarPecasManuaisExtras(pecasUnificadas, item);
      tabelasHtml = renderTabelaPecas(
        'Externo + Interno (cor unica)',
        pecasUnificadas, modeloEfetivo, corExt, todasSuperficies, idx
      );
    } else {
      const pecasExtComExtras = adicionarPecasManuaisExtras(pecasExt, item);
      tabelasHtml = `
        ${renderTabelaPecas('Lado Externo', pecasExtComExtras, modeloEfetivo, corExt, todasSuperficies, idx)}
        ${renderTabelaPecas('Lado Interno', pecasInt,         modeloEfetivo, corInt, todasSuperficies, idx)}
      `;
    }

    const qtdItem = Math.max(1, parseInt(item.quantidade, 10) || 1);

    return `
      <div class="orc-section orc-lev-sup-item">
        <div class="orc-section-title">
          Item ${numItem} — Porta Interna
          <span class="orc-lev-sup-meta">
            ${larg}×${alt} mm
            · <b>${qtdItem} porta${qtdItem > 1 ? 's' : ''}</b>
            · 2 chapas (ext + int)
          </span>
        </div>
        ${tabelasHtml}
      </div>
    `;
  }

  function renderItemFixoSuperficies(item, idx, todasSuperficies) {
    const numItem = idx + 1;
    const Motor = window.PerfisRevAcoplado;
    if (!Motor || !Motor.gerarPecasChapa) {
      return `
        <div class="orc-section orc-lev-sup-item">
          <div class="orc-section-title">Item ${numItem} — Fixo Acoplado</div>
          <p class="orc-hint-text orc-lev-sup-empty">Motor de chapas do fixo nao carregado.</p>
        </div>`;
    }

    const larg = Number(item.largura) || 0;
    const alt  = Number(item.altura)  || 0;
    if (!larg || !alt) {
      return `
        <div class="orc-section orc-lev-sup-item">
          <div class="orc-section-title">Item ${numItem} — Fixo Acoplado — sem dimensoes</div>
          <p class="orc-hint-text">Volte para "Caracteristicas do Item" e preencha largura e altura.</p>
        </div>`;
    }

    const sis = String(item.sistema || 'PA006').toUpperCase();
    const familiaLabel = sis === 'PA007' ? 'PA-007F (familia 101)' : 'PA-006F (familia 76)';
    const lados2 = item.lados === '2lados';

    let pecasExt = aplicarRotacionaOverrides(Motor.gerarPecasChapa(item, 'externo') || [], item);
    let pecasInt = lados2 ? aplicarRotacionaOverrides(Motor.gerarPecasChapa(item, 'interno') || [], item) : [];
    pecasExt = aplicarSuperficiesOverrides(pecasExt, item);
    if (lados2) pecasInt = aplicarSuperficiesOverrides(pecasInt, item);

    // Felipe sessao 12: cor efetiva — herda da porta principal quando
    // fixoSegueModelo='sim' E item nao tem cor propria. Antes lia
    // item.corExterna direto e mostrava 'cor: —' + peso 0.
    const segueModelo = item.fixoSegueModelo === 'sim';
    const portaPrincipal = (() => {
      if (!segueModelo || !window._versaoAtivaParaFixo) return null;
      const v = window._versaoAtivaParaFixo;
      if (!v.itens) return null;
      return v.itens.find(it => it && it.tipo === 'porta_externa') || null;
    })();
    const corExt = (segueModelo && portaPrincipal && portaPrincipal.corExterna)
      ? String(portaPrincipal.corExterna).trim()
      : String(item.corExterna || '').trim();
    const corInt = (segueModelo && portaPrincipal && portaPrincipal.corInterna)
      ? String(portaPrincipal.corInterna).trim()
      : String(item.corInterna || '').trim();
    const modeloEfetivo = Number(item.modeloNumero) || 0;

    // Felipe sessao 12: 1 tabela quando sao iguais (incluindo ambas vazias).
    // Antes 'corExt && corExt===corInt' falhava se cores fossem '' — caia
    // no else (separadas) mesmo em fixo simples sem cor.
    const corUnica = lados2 ? (corExt === corInt) : true;

    let tabelasHtml = '';
    if (!lados2) {
      // Fixo de 1 lado: so' tem externo
      const pecasExtComExtras = adicionarPecasManuaisExtras(pecasExt, item);
      tabelasHtml = renderTabelaPecas('Lado Externo', pecasExtComExtras, modeloEfetivo, corExt, todasSuperficies, idx);
    } else if (corUnica) {
      let pecasUnificadas = unificarPecas(pecasExt, pecasInt);
      pecasUnificadas = adicionarPecasManuaisExtras(pecasUnificadas, item);
      tabelasHtml = renderTabelaPecas(
        'Externo + Interno (cor unica)',
        pecasUnificadas, modeloEfetivo, corExt, todasSuperficies, idx
      );
    } else {
      const pecasExtComExtras = adicionarPecasManuaisExtras(pecasExt, item);
      tabelasHtml = `
        ${renderTabelaPecas('Lado Externo', pecasExtComExtras, modeloEfetivo, corExt, todasSuperficies, idx)}
        ${renderTabelaPecas('Lado Interno', pecasInt,         modeloEfetivo, corInt, todasSuperficies, idx)}
      `;
    }

    const qtdItem = Math.max(1, parseInt(item.quantidade, 10) || 1);
    const posLabel = item.posicao === 'lateral' ? 'Lateral' : 'Superior';

    return `
      <div class="orc-section orc-lev-sup-item">
        <div class="orc-section-title">
          Item ${numItem} — Fixo Acoplado (${posLabel})
          <span class="orc-lev-sup-meta">
            ${larg}×${alt} mm · ${familiaLabel}
            · <b>${qtdItem} fixo${qtdItem > 1 ? 's' : ''}</b>
            · ${lados2 ? '2 lados' : '1 lado'}
          </span>
        </div>
        ${tabelasHtml}
      </div>
    `;
  }

  /**
   * Felipe (sessao 2026-05): unifica pecas externas + internas, somando
   * qtds quando label + dimensoes batem. Usado quando cor externa ===
   * cor interna E modelo externo === modelo interno.
   *
   * Felipe (sessao 26 fix): garantir que pecas de PORTA fiquem juntas no
   * inicio e PORTAL no fim. Sem este sort, pecas que so' aparecem no lado
   * interno (ex: Tampa Maior 03 do mod 02) iam parar no fim da lista
   * (depois das universais do portal) por causa da ordem de insercao.
   */
  function unificarPecas(pecasExt, pecasInt) {
    const mapa = new Map();
    const adicionar = (p) => {
      const chave = `${p.label}|${p.largura}|${p.altura}|${p.cor || ''}`;
      const existe = mapa.get(chave);
      if (existe) {
        // Felipe sessao 12 fix: 'mudo de 4 para 2 e volta pra 4'.
        // CAUSA: aplicarSuperficiesOverrides aplica o override em CADA lado
        // (ext e int) ANTES de unificar. Se Felipe edita qtd=2, ext=2 e int=2.
        // Aqui antes somava 2+2=4. Solucao: se a peca tem _qtdOverride=true
        // (qtd foi alterada manualmente), o valor JA representa a qtd
        // FINAL desejada por Felipe - nao soma de novo entre os lados.
        //
        // Felipe sessao 13 fix: distincao entre _editado (qualquer
        // alteracao — pra UI mostrar borda azul) e _qtdOverride (so
        // qtd alterada — pra nao somar). Bug que motivou: editar
        // largura 1510→1490 fazia qtd cair de 2 pra 1 porque _editado=true
        // bloqueava a soma. Agora so' o flag especifico de qtd bloqueia.
        if (existe._qtdOverride || p._qtdOverride) {
          // Qtd foi editada manualmente em pelo menos um dos lados.
          // Mantem qtd do primeiro lado processado (ja' tem o override aplicado).
          existe._qtdOverride = true;
          existe._editado = true;
        } else {
          // Comportamento original: soma qtd dos 2 lados.
          // Inclui o caso de edicao SO de dimensao (largura/altura) sem qtd.
          existe.qtd = (existe.qtd || 1) + (p.qtd || 1);
          if (existe._editado || p._editado) existe._editado = true;
        }
      } else {
        mapa.set(chave, Object.assign({}, p));
      }
    };
    pecasExt.forEach(adicionar);
    pecasInt.forEach(adicionar);
    const arr = Array.from(mapa.values());
    // Felipe sessao 13: ORDENAR pela ordem da planilha (_ordem) em vez
    // de por categoria. O sort antigo (porta=0, portal=1, outras=2)
    // jogava todas as pecas AM (categoria='aluminio_macico') pro fim,
    // misturando TM01/TM02/TM03 com FIT_ACAB e bagunçando a sequencia
    // que Felipe espera (TM antes de ACAB_LAT, depois TBFV/FRISO,
    // depois ACAB_LAT/U_PORTAL/BAT/TAP_FURO/FIT_ACAB/ALISAR — ordem
    // exata da planilha v3 PRECIFICACAO_01_04_2026).
    //
    // Campo _ordem e' setado pelo materializar() em 38-chapas-porta-externa.js
    // como o indice na pecasDef original. Pecas extras manuais ou de
    // outros geradores podem nao ter _ordem — caem no final (999).
    //
    // Sort estavel (V8 desde 2018): pecas com mesmo _ordem mantem
    // ordem de insercao.
    arr.sort((a, b) => {
      const oA = (typeof a._ordem === 'number') ? a._ordem : 999;
      const oB = (typeof b._ordem === 'number') ? b._ordem : 999;
      return oA - oB;
    });
    return arr;
  }

  // ============================================================
  // Felipe (sessao 2026-05): OVERRIDES DE ROTACIONA SIM/NAO
  // ============================================================
  // O motor `ChapasPortaExterna.gerarPecasChapa(item, lado)` calcula
  // `podeRotacionar: true|false` automaticamente baseado na cor (cores
  // Wood com veio = false). Felipe pediu pra poder EDITAR esse flag
  // manualmente por linha (peca) — overrides ficam em
  //   item.rotacionaOverrides[chave] = 'sim' | 'nao'
  // onde chave = `${label}|${largura}|${altura}` (sem lado, porque
  // peca fisica nao muda entre externo/interno).
  //
  // Helpers:
  //   - rotacionaKey(p)               -> string chave da peca
  //   - aplicarRotacionaOverrides(...)-> aplica overrides salvos
  //   - gerarModeloXmlSuperficies(...)-> exporta XML modelo pra Felipe editar
  //   - importarOverridesXml(...)     -> le XML e atualiza overrides
  // ============================================================
  function rotacionaKey(p) {
    return `${p.label}|${p.largura}|${p.altura}`;
  }
  function aplicarRotacionaOverrides(pecas, item) {
    const ov = (item && item.rotacionaOverrides) || {};
    if (!Object.keys(ov).length) return pecas;
    return pecas.map(p => {
      const k = rotacionaKey(p);
      if (k in ov) {
        return Object.assign({}, p, { podeRotacionar: ov[k] === 'sim' });
      }
      return p;
    });
  }

  // Felipe sessao 2026-08: overrides editaveis de Largura/Altura/Qtd nas
  // pecas calculadas pelo motor. Salvos em item.superficiesOverrides:
  //   item.superficiesOverrides[chave] = { largura?, altura?, qtd? }
  // chave = mesma do rotacionaKey (label + largura_orig + altura_orig).
  // Aplica overrides sobrescrevendo so' os campos que o user alterou.
  // Marca _editado=true pra UI mostrar visual diferenciado (borda laranja).
  function aplicarSuperficiesOverrides(pecas, item) {
    const ov = (item && item.superficiesOverrides) || {};
    const removidas = (item && Array.isArray(item.pecasRemovidas)) ? item.pecasRemovidas : [];
    const removidasSet = new Set(removidas);
    // Felipe sessao 14: filtra pecas marcadas como removidas (chave = rotacionaKey(p))
    let base = removidasSet.size
      ? pecas.filter(p => !removidasSet.has(rotacionaKey(p)))
      : pecas;
    if (!Object.keys(ov).length) return base;
    return base.map(p => {
      const k = rotacionaKey(p);
      if (k in ov) {
        const o = ov[k];
        const ret = Object.assign({}, p);
        let qtdEditada = false;
        if (o.largura !== undefined && o.largura !== '' && o.largura !== null) {
          const n = Number(o.largura);
          if (!isNaN(n) && n > 0) ret.largura = n;
        }
        if (o.altura !== undefined && o.altura !== '' && o.altura !== null) {
          const n = Number(o.altura);
          if (!isNaN(n) && n > 0) ret.altura = n;
        }
        if (o.qtd !== undefined && o.qtd !== '' && o.qtd !== null) {
          const n = Number(o.qtd);
          if (!isNaN(n) && n > 0) {
            ret.qtd = n;
            qtdEditada = true;
          }
        }
        // Felipe sessao 14: label e categoria editaveis inline
        if (typeof o.label === 'string' && o.label.trim() !== '') {
          ret.label = o.label.trim();
        }
        if (typeof o.categoria === 'string' && o.categoria.trim() !== '') {
          ret.categoria = o.categoria.trim();
        }
        ret._editado = true;  // pra UI marcar visualmente (qualquer edicao)
        // Felipe sessao 13: flag especifica pra qtd. unificarPecas precisa
        // distinguir 'qtd editada manualmente' (nao somar ext+int) de
        // 'so dimensao editada' (continuar somando ext+int normalmente).
        // Bug: editar largura 1510→1490 fazia qtd 2 virar 1 porque
        // _editado=true bloqueava a soma.
        if (qtdEditada) ret._qtdOverride = true;
        return ret;
      }
      return p;
    });
  }

  // Felipe sessao 2026-08: peças adicionadas manualmente pelo Felipe
  // (linha extra no fim da tabela). Salvas em item.pecasManuaisExtras.
  // Estrutura: [{label, categoria, largura, altura, qtd, cor, podeRotacionar}, ...]
  function adicionarPecasManuaisExtras(pecas, item) {
    const extras = (item && item.pecasManuaisExtras) || [];
    if (!extras.length) return pecas;
    return pecas.concat(extras.map(p => Object.assign({
      podeRotacionar: false,
      qtd: 1,
      categoria: p.categoria || 'porta',
    }, p, { _manual: true })));
  }
  /**
   * Felipe (sessao 28 fix): override de QUANTIDADE por peca×face.
   * Chave inclui lado (ex: "Tampa Maior 01|1480|5679|externo") OU sem
   * lado pra aplicar em ambos. Se chave especifica nao bater, tenta
   * chave sem lado (compat).
   *
   * @param {Array} pecas - array retornado por gerarPecasChapa
   * @param {Object} item - item do orcamento (com qtdOverrides salvos)
   * @param {String} lado - 'externo' | 'interno' | null
   */
  function aplicarQtdOverrides(pecas, item, lado) {
    const ov = (item && item.qtdOverrides) || {};
    if (!Object.keys(ov).length) return pecas;
    return pecas.map(p => {
      const kSem = rotacionaKey(p);                          // sem lado
      const kCom = lado ? `${kSem}|${lado}` : null;          // com lado (se conhecido)
      // Prioriza override com lado (mais especifico) antes do sem lado
      if (kCom && (kCom in ov)) {
        const novaQtd = Number(ov[kCom]);
        if (Number.isFinite(novaQtd) && novaQtd >= 0) {
          return Object.assign({}, p, { qtd: novaQtd });
        }
      }
      if (kSem in ov) {
        const novaQtd = Number(ov[kSem]);
        if (Number.isFinite(novaQtd) && novaQtd >= 0) {
          return Object.assign({}, p, { qtd: novaQtd });
        }
      }
      return p;
    });
  }
  function escXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  /**
   * Gera XML modelo com TODAS as pecas atuais e flag rotaciona.
   * Felipe edita o XML (troca Sim/Nao) e depois reimporta.
   */
  function gerarModeloXmlSuperficies(itens) {
    const Chapas = window.ChapasPortaExterna;
    const ChapasRev = window.ChapasRevParede;
    const linhas = [];
    linhas.push('<?xml version="1.0" encoding="UTF-8"?>');
    linhas.push('<projetta-superficies versao="1">');
    linhas.push('  <!-- ====================================================== -->');
    linhas.push('  <!-- MODELO PADRAO — Overrides de Rotaciona Sim/Nao         -->');
    linhas.push('  <!-- ====================================================== -->');
    linhas.push('  <!-- Edite a tag <rotaciona>Sim</rotaciona> ou <rotaciona>Nao</rotaciona> -->');
    linhas.push('  <!-- de cada peca, salve o arquivo, e clique em "Importar XML"          -->');
    linhas.push('  <!-- na aba Lev. Superficies pra aplicar suas mudancas.                  -->');
    linhas.push('  <!-- A chave de busca e\' label + largura + altura (sem lado).            -->');
    (itens || []).forEach((item, idx) => {
      if (item.tipo === 'porta_externa' && Chapas) {
        const ext = aplicarRotacionaOverrides(Chapas.gerarPecasChapa(item, 'externo') || [], item);
        const int = aplicarRotacionaOverrides(Chapas.gerarPecasChapa(item, 'interno') || [], item);
        // Unifica por chave pra nao duplicar peca igual em externo/interno
        const mapa = new Map();
        [...ext, ...int].forEach(p => { mapa.set(rotacionaKey(p), p); });
        if (!mapa.size) return;
        linhas.push(`  <item indice="${idx + 1}" tipo="porta_externa" descricao="${escXml(item.largura + 'x' + item.altura + 'mm')}">`);
        mapa.forEach(p => {
          linhas.push('    <peca>');
          linhas.push(`      <label>${escXml(p.label)}</label>`);
          linhas.push(`      <largura>${p.largura}</largura>`);
          linhas.push(`      <altura>${p.altura}</altura>`);
          linhas.push(`      <rotaciona>${p.podeRotacionar ? 'Sim' : 'Nao'}</rotaciona>`);
          linhas.push('    </peca>');
        });
        linhas.push('  </item>');
      } else if (item.tipo === 'revestimento_parede' && ChapasRev) {
        const pecas = aplicarRotacionaOverrides(ChapasRev.gerarPecasRevParede(item) || [], item);
        if (!pecas.length) return;
        linhas.push(`  <item indice="${idx + 1}" tipo="revestimento_parede">`);
        pecas.forEach(p => {
          linhas.push('    <peca>');
          linhas.push(`      <label>${escXml(p.label)}</label>`);
          linhas.push(`      <largura>${p.largura}</largura>`);
          linhas.push(`      <altura>${p.altura}</altura>`);
          linhas.push(`      <rotaciona>${p.podeRotacionar ? 'Sim' : 'Nao'}</rotaciona>`);
          linhas.push('    </peca>');
        });
        linhas.push('  </item>');
      } else if (item.tipo === 'pergolado' && window.ChapasPergolado) {
        // Felipe sessao 18: pergolado no XML export
        const pecas = aplicarRotacionaOverrides(window.ChapasPergolado.gerarPecasPergolado(item) || [], item);
        if (!pecas.length) return;
        linhas.push(`  <item indice="${idx + 1}" tipo="pergolado">`);
        pecas.forEach(p => {
          linhas.push('    <peca>');
          linhas.push(`      <label>${escXml(p.label)}</label>`);
          linhas.push(`      <largura>${p.largura}</largura>`);
          linhas.push(`      <altura>${p.altura}</altura>`);
          linhas.push(`      <rotaciona>${p.podeRotacionar ? 'Sim' : 'Nao'}</rotaciona>`);
          linhas.push('    </peca>');
        });
        linhas.push('  </item>');
      }
    });
    linhas.push('</projetta-superficies>');
    return linhas.join('\n') + '\n';
  }
  /**
   * Le um XML no formato do modelo e aplica os overrides nos itens.
   * Retorna { aplicados, ignorados, erros }.
   */
  function importarOverridesXml(xmlString, itens) {
    const out = { aplicados: 0, ignorados: 0, erros: [] };
    let doc;
    try {
      doc = new DOMParser().parseFromString(xmlString, 'application/xml');
      // DOMParser nao da throw em XML invalido — checa parseError.
      // Usa getElementsByTagName em vez de querySelector pra compat
      // com parsers XML antigos/alternativos.
      const perr = doc.getElementsByTagName('parsererror');
      if (perr && perr.length) {
        out.erros.push('XML mal formado: ' + (perr[0].textContent || '').slice(0, 200));
        return out;
      }
    } catch (e) {
      out.erros.push('Erro ao ler XML: ' + e.message);
      return out;
    }
    const itemNodes = doc.getElementsByTagName('item');
    for (let i = 0; i < itemNodes.length; i++) {
      const itemNode = itemNodes[i];
      const indice = Number(itemNode.getAttribute('indice')) - 1;
      const item = itens[indice];
      if (!item) { out.ignorados++; continue; }
      if (!item.rotacionaOverrides) item.rotacionaOverrides = {};
      const pecaNodes = itemNode.getElementsByTagName('peca');
      for (let j = 0; j < pecaNodes.length; j++) {
        const pecaNode = pecaNodes[j];
        const tag = (n) => {
          const els = pecaNode.getElementsByTagName(n);
          return els && els.length ? (els[0].textContent || '').trim() : '';
        };
        const label = tag('label');
        const largura = Number(tag('largura'));
        const altura  = Number(tag('altura'));
        const rot = tag('rotaciona').toLowerCase();
        if (!label || !largura || !altura) { out.ignorados++; continue; }
        if (rot !== 'sim' && rot !== 'nao' && rot !== 'não') { out.ignorados++; continue; }
        const chave = `${label}|${largura}|${altura}`;
        item.rotacionaOverrides[chave] = (rot === 'sim') ? 'sim' : 'nao';
        out.aplicados++;
      }
    }
    return out;
  }

  /**
   * Felipe (sessao 2026-06): "preciso em chapas exportar e importa
   * arquivo Excel nao HTML". Versao Excel das funcoes XML — gera
   * planilha .xlsx com colunas Item / Tipo / Label / Largura / Altura
   * / Rotaciona. Felipe edita coluna Rotaciona (Sim/Nao) e reimporta.
   */
  function gerarModeloXlsxSuperficies(itens) {
    const Chapas = window.ChapasPortaExterna;
    const ChapasRev = window.ChapasRevParede;
    // Felipe (sessao 28 fix): "PLANILHA QUE EXPORTA MODELO PARA CHAPAS
    // NAO COLOCA QUANTIDADE COMO VOU CONSEGUIR IMPORTAR ALGUMA COISA E
    // CALCULAR SE A IMPORTACAO NAO TRAZ QUANTIDADE?".
    // Solucao: adicionar colunas `Lado` (Externo/Interno) e `Quantidade`.
    // Cada peca vai numa linha por face (sem dedupe — antes deduplicava
    // ext+int e perdia info de qty). Com Lado, fica um registro
    // editavel por peca×face.
    const headers = ['Item', 'Tipo', 'Descricao Item', 'Lado', 'Label Peca', 'Largura', 'Altura', 'Quantidade', 'Rotaciona'];
    const rows = [];
    (itens || []).forEach((item, idx) => {
      if (item.tipo === 'porta_externa' && Chapas) {
        // Felipe (sessao 28 fix): aplica AMBOS overrides (rotaciona + qty)
        // antes de exportar, pra Felipe ver o estado atual da edicao.
        let ext = Chapas.gerarPecasChapa(item, 'externo') || [];
        ext = aplicarRotacionaOverrides(ext, item);
        ext = aplicarQtdOverrides(ext, item, 'externo');
        let int = Chapas.gerarPecasChapa(item, 'interno') || [];
        int = aplicarRotacionaOverrides(int, item);
        int = aplicarQtdOverrides(int, item, 'interno');
        const desc = `${item.largura}x${item.altura}mm`;
        // 1 linha por face (com Quantidade real), sem dedupe
        ext.forEach(p => {
          rows.push([
            idx + 1, 'porta_externa', desc, 'Externo',
            p.label, p.largura, p.altura,
            Number(p.qtd) || 0,
            p.podeRotacionar ? 'Sim' : 'Nao',
          ]);
        });
        int.forEach(p => {
          rows.push([
            idx + 1, 'porta_externa', desc, 'Interno',
            p.label, p.largura, p.altura,
            Number(p.qtd) || 0,
            p.podeRotacionar ? 'Sim' : 'Nao',
          ]);
        });
      } else if (item.tipo === 'revestimento_parede' && ChapasRev) {
        let pecas = ChapasRev.gerarPecasRevParede(item) || [];
        pecas = aplicarRotacionaOverrides(pecas, item);
        pecas = aplicarQtdOverrides(pecas, item, null);
        pecas.forEach(p => {
          rows.push([
            idx + 1, 'revestimento_parede', '—', '—',
            p.label, p.largura, p.altura,
            Number(p.qtd) || 0,
            p.podeRotacionar ? 'Sim' : 'Nao',
          ]);
        });
      }
    });
    return { headers, rows };
  }

  /**
   * Felipe (sessao 2026-06): le um array-of-arrays do .xlsx (a partir
   * de Universal.readXLSXFile) e aplica overrides de Rotaciona em cada
   * item. Mesma logica do importarOverridesXml — chave = label + larg + alt.
   *
   * Felipe (sessao 28 fix): tambem aceita coluna `Quantidade` (opcional).
   * Se presente e diferente do calculado, salva override em
   * `item.qtdOverrides[chave_com_lado]`. Lado e' opcional — se nao tiver,
   * aplica em ambas as faces.
   */
  function importarOverridesXlsx(aoa, itens) {
    const out = { aplicados: 0, ignorados: 0, erros: [], qtdAplicados: 0 };
    if (!Array.isArray(aoa) || aoa.length < 2) {
      out.erros.push('Planilha vazia ou sem linhas de dados.');
      return out;
    }
    const idx = window.Universal?.parseHeaders?.(aoa[0], {
      item:        'item',
      tipo:        'tipo',
      label:       'label',
      lado:        'lado',         // novo (opcional)
      largura:     'largura',
      altura:      'altura',
      quantidade:  'quantidade',   // novo (opcional)
      rotaciona:   'rotaciona',
    }) || {};
    if (idx.label === -1 || idx.largura === -1 || idx.altura === -1) {
      out.erros.push('Cabecalhos faltando (precisa pelo menos: Label Peca, Largura, Altura).');
      return out;
    }
    for (let i = 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row || !row.length) continue;
      const label = String(row[idx.label] || '').trim();
      const largura = Number(row[idx.largura]) || 0;
      const altura  = Number(row[idx.altura])  || 0;
      if (!label || !largura || !altura) {
        out.ignorados++;
        continue;
      }
      // Lado opcional (aceita "Externo", "Interno", vazio)
      const ladoStr = (idx.lado >= 0)
        ? String(row[idx.lado] || '').trim().toLowerCase()
        : '';
      const lado = (ladoStr === 'externo' || ladoStr === 'ext') ? 'externo'
                 : (ladoStr === 'interno' || ladoStr === 'int') ? 'interno'
                 : null;  // null = ambas as faces

      // Rotaciona (mantem comportamento anterior — chave SEM lado)
      const rotStr = (idx.rotaciona >= 0)
        ? String(row[idx.rotaciona] || '').trim().toLowerCase()
        : '';
      const valorRot = (rotStr === 'sim' || rotStr === 's' || rotStr === '1' || rotStr === 'true')
        ? 'sim'
        : (rotStr === 'nao' || rotStr === 'não' || rotStr === 'n' || rotStr === '0' || rotStr === 'false')
          ? 'nao'
          : null;

      // Quantidade (novo — chave COM lado se especificado)
      const qtdNum = (idx.quantidade >= 0)
        ? Number(row[idx.quantidade])
        : NaN;
      const qtdValida = Number.isFinite(qtdNum) && qtdNum >= 0;

      if (!valorRot && !qtdValida) {
        out.ignorados++;
        continue;
      }

      // Aplica em TODOS os itens que tem essa peca (por label + dimensoes)
      const chaveSemLado = `${label}|${largura}|${altura}`;
      let achou = false;
      itens.forEach(it => {
        if (!it.rotacionaOverrides) it.rotacionaOverrides = {};
        if (!it.qtdOverrides)       it.qtdOverrides = {};
        // Verifica se a peca existe nesse item (porta_externa ou revestimento)
        const Chapas = window.ChapasPortaExterna;
        const ChapasRev = window.ChapasRevParede;
        let pecasItem = [];
        if (it.tipo === 'porta_externa' && Chapas) {
          pecasItem = [
            ...(Chapas.gerarPecasChapa(it, 'externo') || []),
            ...(Chapas.gerarPecasChapa(it, 'interno') || []),
          ];
        } else if (it.tipo === 'revestimento_parede' && ChapasRev) {
          pecasItem = ChapasRev.gerarPecasRevParede(it) || [];
        }
        const match = pecasItem.find(p => rotacionaKey(p) === chaveSemLado);
        if (match) {
          if (valorRot) {
            it.rotacionaOverrides[chaveSemLado] = valorRot;
          }
          if (qtdValida) {
            // Chave com lado se especificado, senao chave sem lado (ambas)
            const kQtd = lado ? `${chaveSemLado}|${lado}` : chaveSemLado;
            it.qtdOverrides[kQtd] = qtdNum;
            out.qtdAplicados++;
          }
          achou = true;
        }
      });
      if (achou) out.aplicados++;
      else out.ignorados++;
    }
    return out;
  }

  /**
   * Renderiza tabela de pecas de UM lado (externo OU interno).
   * @param {number} itemIdx — indice do item no array da versao
   *   (necessario pro select de Rotaciona Sim/Nao saber em qual item gravar).
   */
  function renderTabelaPecas(tituloLado, pecas, modelo, corLado, todasSuperficies, itemIdx) {
    if (!pecas || !pecas.length) {
      return `
        <div class="orc-lev-sup-lado">
          <div class="orc-lev-sup-lado-title">${tituloLado}</div>
          <p class="orc-hint-text orc-lev-sup-empty">
            ${modelo
              ? `Modelo ${modelo} ainda nao tem mapeamento de pecas. Felipe vai especificar
                 quais pecas ele tem (Tampa, Tampa Borda Cava, Cava, etc) e as formulas.`
              : 'Modelo nao escolhido — selecione em "Caracteristicas do Item".'}
          </p>
        </div>`;
    }

    // Felipe sessao 13: 'na frente o que for aluminio macico, descreva como
    // aluminio macico. O que nao for aluminio macico voce ja sabe que e ACM,
    // descreva na frente tambem como ACM. Isso somente para o modelo 23,
    // quando o revestimento for aluminio macico.'
    // Quando ALGUMA peca do conjunto tem materialEspecial='AM', e' Mod23+AM
    // (so' esse caso seta materialEspecial). Nessa condicao adiciona uma
    // COLUNA EXTRA 'Material' com badge AM/ACM na frente de cada peca.
    // Nos demais casos (modelos normais, Mod23 ACM, vidro etc) a coluna
    // nao aparece — layout original preservado.
    const temAM_naLista = pecas.some(p => p.materialEspecial === 'AM');

    // Felipe (sessao 2026-05 / sessao 30 fix): pra cada peca, calcula
    // peso individual baseado no kg/m² da CHAPA-MAE da cor da peca.
    // Felipe sessao 30: "SE ESTIVER COM PESO 0 DEIXE ZERO NUNCA PUXE
    // NENHUM PESO QUE NAO SAIBA". Sem fallback chumbado — se nao acha
    // chapa-mae cadastrada com peso > 0, retorna 0.
    function pesoPorPeca(p) {
      let kgM2 = 0;
      if (todasSuperficies && p.cor) {
        const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const corNorm = norm(p.cor.replace(/\s*[-–]\s*\d{3,4}\s*[xX×]\s*\d{3,4}\s*$/, ''));
        const chapa = todasSuperficies.find(s => {
          const sNorm = norm(String(s.descricao).replace(/\s*[-–]\s*\d{3,4}\s*[xX×]\s*\d{3,4}\s*$/, ''));
          return sNorm === corNorm || sNorm.includes(corNorm) || corNorm.includes(sNorm);
        });
        if (chapa && Number(chapa.peso_kg_m2) > 0) {
          kgM2 = Number(chapa.peso_kg_m2);
        }
      }
      // peso_unidade = larg_m × alt_m × kg_m2 (zero se kg/m² nao cadastrado)
      const m2 = (Number(p.largura) * Number(p.altura)) / 1000000;
      const pesoUnidade = m2 * kgM2;
      const pesoTotal = pesoUnidade * (Number(p.qtd) || 1);
      return { unidade: pesoUnidade, total: pesoTotal };
    }

    function badgeCategoria(cat) {
      if (cat === 'portal') return '<span class="orc-cat-badge orc-cat-portal">Portal</span>';
      if (cat === 'porta')  return '<span class="orc-cat-badge orc-cat-porta">Porta</span>';
      if (cat === 'revestimento') return '<span class="orc-cat-badge orc-cat-rev">Rev. Parede</span>';
      // Felipe sessao 13: peças marcadas como aluminio_macico ganham
      // badge propria com texto "Al. Maciço" (cor amarela).
      if (cat === 'aluminio_macico') return '<span class="orc-cat-badge" style="background:#fbbf24;color:#78350f;font-weight:700;">Al. Maciço</span>';
      // Felipe sessao 13: badge novo 'Fixo Lateral' (azul) pras pecas
      // ACM do Fixo Lateral c/ Vidro (Fita Acab do PF + Revestimento Tubo).
      if (cat === 'fixo_lateral') return '<span class="orc-cat-badge" style="background:#dbeafe;color:#1e3a8a;font-weight:700;">Fixo Lateral</span>';
      return '<span class="orc-cat-badge">—</span>';
    }

    let pesoTotalLado = 0;
    const linhas = pecas.map(p => {
      const peso = pesoPorPeca(p);
      pesoTotalLado += peso.total;
      // Felipe (sessao 2026-05): SELECT editavel Sim/Nao em vez de
      // texto estatico "Nao (veio)". Felipe controla manualmente
      // quando uma peca pode ou nao rotacionar (override salvo
      // em item.rotacionaOverrides via change event).
      const chave = rotacionaKey(p);
      const valor = p.podeRotacionar ? 'sim' : 'nao';
      const selectHtml = `
        <select class="orc-lev-sup-rot-select"
                data-item-idx="${itemIdx}"
                data-peca-key="${escapeHtml(chave)}"
                title="Pode rotacionar a peca em 90 graus pra encaixar na chapa? (cores Wood com veio = Nao)">
          <option value="sim" ${valor === 'sim' ? 'selected' : ''}>Sim</option>
          <option value="nao" ${valor === 'nao' ? 'selected' : ''}>Nao</option>
        </select>`;
      // Felipe sessao 2026-08: largura/altura/qtd viram inputs editaveis.
      // Visual marca _editado (override) e _manual (peca extra adicionada).
      const inputStyle = 'width:78px;padding:3px 6px;border:1px solid #d1d5db;border-radius:3px;font-size:12px;text-align:right;background:#fff;';
      const inputStyleQtd = 'width:50px;padding:3px 6px;border:1px solid #d1d5db;border-radius:3px;font-size:12px;text-align:center;background:#fff;';
      const editClass = p._editado ? ' orc-lev-sup-input-editado' : '';
      const manualClass = p._manual ? ' orc-lev-sup-input-manual' : '';
      // Felipe sessao 14: hint 'sec NNN' (medida sem REF) abaixo do input
      // largura/altura. Aparece SO em pecas Tampa* ou Fita Acabamento*.
      const _lblSec = String(p.label || '');
      const _ehTampaOuFita = /^(Tampa|Fita Acabamento)\b/i.test(_lblSec);
      const _largSecVal = Number(p.larguraSemRef);
      const _altSecVal  = Number(p.alturaSemRef);
      const _hintLargSec = (_ehTampaOuFita && Number.isFinite(_largSecVal) && _largSecVal > 0 && Math.abs(_largSecVal - Number(p.largura)) >= 0.5)
        ? `<div class="orc-lev-sup-hint-sec">sem REF ${_largSecVal}</div>` : '';
      const _hintAltSec = (_ehTampaOuFita && Number.isFinite(_altSecVal)  && _altSecVal  > 0 && Math.abs(_altSecVal  - Number(p.altura))  >= 0.5)
        ? `<div class="orc-lev-sup-hint-sec">sem REF ${_altSecVal}</div>` : '';
      const inputLargura = `<input type="number" min="1" step="1" class="orc-lev-sup-input-edit${editClass}${manualClass}"
                              data-item-idx="${itemIdx}" data-peca-key="${escapeHtml(chave)}" data-field="largura"
                              data-manual="${p._manual ? '1' : '0'}"
                              value="${p.largura}" style="${inputStyle}" />${_hintLargSec}`;
      const inputAltura = `<input type="number" min="1" step="1" class="orc-lev-sup-input-edit${editClass}${manualClass}"
                              data-item-idx="${itemIdx}" data-peca-key="${escapeHtml(chave)}" data-field="altura"
                              data-manual="${p._manual ? '1' : '0'}"
                              value="${p.altura}" style="${inputStyle}" />${_hintAltSec}`;
      const inputQtd = `<input type="number" min="1" step="1" class="orc-lev-sup-input-edit${editClass}${manualClass}"
                              data-item-idx="${itemIdx}" data-peca-key="${escapeHtml(chave)}" data-field="qtd"
                              data-manual="${p._manual ? '1' : '0'}"
                              value="${p.qtd}" style="${inputStyleQtd}" />`;
      // Felipe sessao 14: nome e categoria editaveis inline em TODAS as pecas
      // (auto + manuais). Mantem badge "MANUAL" pra distinguir visualmente.
      const inputLabelStyle = 'width:100%;min-width:130px;padding:3px 6px;border:1px solid #d1d5db;border-radius:3px;font-size:12px;background:#fff;'
        + (p._manual ? 'color:#7c3aed;font-weight:600;' : '');
      const inputLabel = `<input type="text" class="orc-lev-sup-input-edit${editClass}${manualClass}"
                            data-item-idx="${itemIdx}" data-peca-key="${escapeHtml(chave)}" data-field="label"
                            data-manual="${p._manual ? '1' : '0'}"
                            value="${escapeHtml(p.label || '')}" style="${inputLabelStyle}" />`
        + (p._manual ? ' <span style="font-size:9px;background:#ddd6fe;color:#5b21b6;padding:1px 5px;border-radius:8px;font-weight:700;">MANUAL</span>' : '');
      const catVal = p.categoria || 'porta';
      const selectCategoria = `<select class="orc-lev-sup-input-edit${editClass}${manualClass}"
                                  data-item-idx="${itemIdx}" data-peca-key="${escapeHtml(chave)}" data-field="categoria"
                                  data-manual="${p._manual ? '1' : '0'}"
                                  style="padding:3px 4px;border:1px solid #d1d5db;border-radius:3px;font-size:11px;background:#fff;">
          <option value="porta" ${catVal === 'porta' ? 'selected' : ''}>Porta</option>
          <option value="portal" ${catVal === 'portal' ? 'selected' : ''}>Portal</option>
          <option value="revestimento" ${catVal === 'revestimento' ? 'selected' : ''}>Rev. Parede</option>
          <option value="aluminio_macico" ${catVal === 'aluminio_macico' ? 'selected' : ''}>Al. Maciço</option>
          <option value="fixo_lateral" ${catVal === 'fixo_lateral' ? 'selected' : ''}>Fixo Lateral</option>
        </select>`;
      // Felipe sessao 14: botao 🗑 em TODAS as pecas. data-manual distingue:
      //   1 = peca extra → splice de pecasManuaisExtras
      //   0 = peca automatica → adiciona key em pecasRemovidas[]
      // Botao ↺ continua aparecendo SO em pecas auto com override (_editado).
      let acaoHtml = '';
      const btnRemover = `<button type="button" class="orc-lev-sup-btn-remover-peca"
                            data-item-idx="${itemIdx}" data-peca-key="${escapeHtml(chave)}"
                            data-manual="${p._manual ? '1' : '0'}"
                            title="${p._manual ? 'Remover peça manual' : 'Remover esta peça do calculo'}"
                            style="background:transparent;border:none;color:#dc2626;cursor:pointer;font-size:14px;padding:2px 4px;">🗑</button>`;
      if (!p._manual && p._editado) {
        acaoHtml = `<button type="button" class="orc-lev-sup-btn-resetar-edit"
                            data-item-idx="${itemIdx}" data-peca-key="${escapeHtml(chave)}"
                            title="Restaurar valores originais"
                            style="background:transparent;border:none;color:#0284c7;cursor:pointer;font-size:14px;padding:2px 4px;">↺</button>` + btnRemover;
      } else {
        acaoHtml = btnRemover;
      }
      // Felipe sessao 13: linha destacada (amarelo claro) quando peça
      // e' de aluminio macico — visual claro pro usuario distinguir.
      const trStyle = (p.categoria === 'aluminio_macico') ? ' style="background:#fffbeb;"' : '';
      // Felipe sessao 13: badge Material so' quando a tabela tem pecas AM.
      // Mostra 'AM' (laranja) ou 'ACM' (cinza) — ajuda Felipe a separar
      // visualmente as 2 chapas do Mod23+AM.
      const badgeMaterial = !temAM_naLista ? '' : (
        p.materialEspecial === 'AM'
          ? '<td><span style="display:inline-block;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700;background:#fef3c7;color:#92400e;border:1px solid #d97706;">AM</span></td>'
          : '<td><span style="display:inline-block;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700;background:#e5e7eb;color:#374151;border:1px solid #9ca3af;">ACM</span></td>'
      );
      // Felipe sessao 18: COLUNA COR — mostra a cor que o sistema
      // atribuiu a cada peca, pra Felipe validar se a logica
      // (ehDaCava → corCava vs corLado) ta resolvendo a cor certa.
      // Felipe pediu apos ver Tampa Borda Cava com cor errada.
      // Sem cor explicita: cai pro corLado (parametro do render).
      const corDaPeca = p.cor || corLado || '';
      const corCellHtml = corDaPeca
        ? `<td style="font-size:11px;color:#374151;">${escapeHtml(corDaPeca)}</td>`
        : `<td style="font-size:11px;color:#9ca3af;font-style:italic;">— sem cor</td>`;
      return `
      <tr${trStyle}>
        <td>${inputLabel}</td>
        <td>${selectCategoria}</td>
        ${badgeMaterial}
        <td class="t-num">${inputLargura}</td>
        <td class="t-num">${inputAltura}</td>
        <td class="t-num">${inputQtd}</td>
        <td class="t-num">${fmtBR(peso.unidade)}</td>
        <td class="t-num"><b>${fmtBR(peso.total)}</b></td>
        ${corCellHtml}
        <td class="orc-lev-sup-rot-cell ${p.podeRotacionar ? '' : 't-warn'}">${selectHtml}</td>
        <td style="text-align:center;width:54px;white-space:nowrap;">${acaoHtml}</td>
      </tr>`;
    }).join('');

    // Felipe sessao 2026-08: linha sempre visivel no fim pra adicionar peca manual.
    // Inputs vazios + botao + pra confirmar.
    const linhaAdicionar = `
      <tr class="orc-lev-sup-row-add" style="background:#fefce8;">
        <td>
          <input type="text" class="orc-lev-sup-input-add-label"
                 data-item-idx="${itemIdx}"
                 placeholder="Nome da peça"
                 style="width:100%;padding:3px 6px;border:1px solid #d1d5db;border-radius:3px;font-size:12px;background:#fff;" />
        </td>
        <td>
          <select class="orc-lev-sup-input-add-cat" data-item-idx="${itemIdx}"
                  style="padding:3px 4px;border:1px solid #d1d5db;border-radius:3px;font-size:11px;background:#fff;">
            <option value="porta">Porta</option>
            <option value="portal">Portal</option>
            <option value="revestimento">Rev.</option>
          </select>
        </td>
        ${temAM_naLista ? '<td style="text-align:center;color:#9ca3af;font-size:10px;">—</td>' : ''}
        <td class="t-num">
          <input type="number" min="1" step="1" class="orc-lev-sup-input-add-largura"
                 data-item-idx="${itemIdx}"
                 style="width:78px;padding:3px 6px;border:1px solid #d1d5db;border-radius:3px;font-size:12px;text-align:right;background:#fff;" />
        </td>
        <td class="t-num">
          <input type="number" min="1" step="1" class="orc-lev-sup-input-add-altura"
                 data-item-idx="${itemIdx}"
                 style="width:78px;padding:3px 6px;border:1px solid #d1d5db;border-radius:3px;font-size:12px;text-align:right;background:#fff;" />
        </td>
        <td class="t-num">
          <input type="number" min="1" step="1" class="orc-lev-sup-input-add-qtd"
                 data-item-idx="${itemIdx}"
                 style="width:50px;padding:3px 6px;border:1px solid #d1d5db;border-radius:3px;font-size:12px;text-align:center;background:#fff;" />
        </td>
        <td class="t-num" style="color:#9ca3af;font-style:italic;font-size:11px;">auto</td>
        <td class="t-num" style="color:#9ca3af;font-style:italic;font-size:11px;">auto</td>
        <td style="font-size:11px;color:#9ca3af;font-style:italic;">${escapeHtml(corLado || '— sem cor')}</td>
        <td style="text-align:center;color:#9ca3af;font-size:10px;">—</td>
        <td style="text-align:center;width:34px;">
          <button type="button" class="orc-lev-sup-btn-add-peca"
                  data-item-idx="${itemIdx}"
                  data-cor="${escapeHtml(corLado || '')}"
                  title="Adicionar peça manual"
                  style="background:#16a34a;color:#fff;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;font-weight:700;line-height:1;">+</button>
        </td>
      </tr>
    `;

    return `
      <div class="orc-lev-sup-lado">
        <div class="orc-lev-sup-lado-title">
          ${tituloLado} <span class="orc-lev-sup-cor-info">cor: ${escapeHtml(corLado || '—')}</span>
          <span class="orc-lev-sup-peso-total">Peso total: <b>${fmtBR(pesoTotalLado)} kg</b></span>
        </div>
        <table class="cad-table orc-lev-sup-table">
          <thead>
            <tr>
              <th>Peca</th>
              <th>Cat</th>
              ${temAM_naLista ? '<th>Material</th>' : ''}
              <th>Largura (mm)</th>
              <th>Altura (mm)</th>
              <th>Qtd</th>
              <th>Peso/un (kg)</th>
              <th>Peso total (kg)</th>
              <th>Cor</th>
              <th>Rotaciona?</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${linhas}${linhaAdicionar}</tbody>
        </table>
      </div>`;
  }

  /**
   * Felipe (sessao 2026-05): aba Relatorios e' o hub dos relatorios
   * comerciais. Comeca com o "Painel Comercial — Representante", que
   * resume cada item da versao com:
   *   - Identificacao (Cliente / AGP / Reserva)
   *   - Dimensao / Modelo / Folhas / Portas / m² / Cor
   *   - Preco Tabela (sem desconto) e Preco Faturamento (com desconto)
   *   - Valores por m² (porta+inst e so' porta) — tabela e fat
   *   - Comissoes (Rep, RT/Arq) e Desconto
   *
   * Layout em CARDS isolados — um card por item da versao. Se o
   * orcamento tem 3 itens, sao 3 cards. Ainda nao distribui preco
   * por item individualmente (motor da DRE so' tem total da versao);
   * por enquanto cada card mostra os valores GERAIS da versao —
   * Felipe vai detalhar a regra de rateio depois.
   */
  function renderRelatoriosTab(container) {
    inicializarSessao();
    const r = obterVersao(UI.versaoAtivaId);
    if (!r || !r.versao) {
      container.innerHTML = `
        <div class="info-banner">
          <span class="t-strong">Sem versao ativa.</span>
          Volte para o CRM e abra um negocio para ver os relatorios.
        </div>`;
      return;
    }
    const versao = r.versao;
    const opcao  = r.opcao;

    // Felipe (sessao 2026-08): "quando bloqueia apos aprovar dre liberar
    // relatorios" — Relatorios NAO bloqueia mais por motivoBloqueio.
    // Se o orcamento ainda nao foi calculado, mostra resumo informativo
    // mas nao bloqueia o acesso.
    const motivoBloqueio = precisaCalcular(versao, 'dre');

    const negocio = obterNegocio(UI.negocioAtivoId);
    const lead    = lerLeadAtivo() || {};

    // Calcula DRE (mesmos numeros que aparecem na aba DRE / Proposta)
    // BUG FIX (sessao 2026-05-06): recalcula subFab/subInst do custoFab
    // atual antes de montar DRE — senão Resumo da Obra mostra dados antigos.
    _sincronizarSubFabInst(versao);
    const subFab  = Number(versao.subFab)  || 0;
    const subInst = Number(versao.subInst) || 0;
    const params  = Object.assign({}, PARAMS_DEFAULT, versao.parametros || {});
    const dre     = calcularDRE(subFab, subInst, params);

    // Helpers de formatacao locais
    const fmtMoney = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtMoneyM2 = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '/m²';
    const fmtPct = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';

    // Identificacao do lead
    const cliente  = lead.cliente || (negocio?.clienteNome) || '—';
    const agp      = lead.numeroAGP || '—';
    const reserva  = lead.numeroReserva || '—';

    // Sub-aba ativa (default: comercial)
    const subAbaAtiva = UI.relSubAba || 'comercial';

    // Felipe (sessao 2026-08): se nao foi calculado ainda, mostra aviso
    // mas continua deixando navegar pelas sub-abas (algumas vao mostrar
    // "calcule o orcamento primeiro" inline).
    const avisoCalc = motivoBloqueio ? `
      <div class="orc-banner-aviso orc-banner-aviso-erro" style="margin-bottom:12px;">
        <div class="orc-banner-aviso-icon">⚠</div>
        <div class="orc-banner-aviso-conteudo">
          <div class="orc-banner-aviso-titulo">${escapeHtml(motivoBloqueio)}</div>
          <div class="orc-banner-aviso-detalhe">
            Os numeros abaixo podem estar zerados ou desatualizados. Volte na aba <b>Caracteristicas do Item</b> e clique em <b>Recalcular</b> pra atualizar.
          </div>
        </div>
      </div>` : '';

    // Header padrao Empresa (uma vez so')
    const numVersao = versao.numero || 1;
    const numeroDoc = `V${numVersao}`;
    const headerEmpresaHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
      ? window.Empresa.montarHeaderRelatorio({
          lead,
          tituloRelatorio: `Relatorios - ${numVersao}ª Versao`,
          numeroDocumento: numeroDoc,
          validade: 15,
        })
      : '';

    // Renderiza sub-aba ativa
    let conteudoSubAba = '';
    if (subAbaAtiva === 'comercial') {
      conteudoSubAba = renderRelComercial(versao, opcao, lead, negocio, dre, params, cliente, agp, reserva, fmtMoney, fmtMoneyM2, fmtPct);
    } else if (subAbaAtiva === 'resultado-porta') {
      conteudoSubAba = renderRelResultadoPorta(versao, dre, params, fmtMoney, fmtPct);
    } else if (subAbaAtiva === 'dre') {
      conteudoSubAba = renderRelDRE(versao, dre, params, fmtMoney, fmtPct);
    } else if (subAbaAtiva === 'obra') {
      conteudoSubAba = renderRelObra(versao, dre, fmtMoney);
    }

    container.innerHTML = `
      ${headerEmpresaHtml}

      <div class="rel-tabs">
        <button type="button" class="rel-tab-btn ${subAbaAtiva === 'comercial'        ? 'is-active' : ''}" data-rel-subtab="comercial">📊 Painel Comercial</button>
        <button type="button" class="rel-tab-btn ${subAbaAtiva === 'resultado-porta'  ? 'is-active' : ''}" data-rel-subtab="resultado-porta">🚪 Resultado por Porta</button>
        <button type="button" class="rel-tab-btn ${subAbaAtiva === 'dre'              ? 'is-active' : ''}" data-rel-subtab="dre">💰 DRE Resumida</button>
        <button type="button" class="rel-tab-btn ${subAbaAtiva === 'obra'             ? 'is-active' : ''}" data-rel-subtab="obra">🧱 Resumo da Obra</button>
        <div class="rel-tabs-spacer"></div>
        <button type="button" class="rep-export-btn" data-export-png="rel-pane-${subAbaAtiva}" title="Exporta esta aba como imagem PNG">🖼 Exportar PNG</button>
        <button type="button" class="rep-export-btn" data-export-pdf="rel-pane-${subAbaAtiva}" title="Exporta esta aba como PDF">📄 Exportar PDF</button>
      </div>

      ${avisoCalc}

      <div class="rel-pane" id="rel-pane-${subAbaAtiva}">
        ${conteudoSubAba}
      </div>
    `;

    // Bind sub-abas
    container.querySelectorAll('[data-rel-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.relSubAba = btn.dataset.relSubtab;
        renderRelatoriosTab(container);
      });
    });

    // Bind exports
    container.querySelectorAll('[data-export-png]').forEach(btn => {
      btn.addEventListener('click', () => {
        const alvoId = btn.dataset.exportPng;
        exportarRelatorioPNG(alvoId, `Relatorio_${subAbaAtiva}_${cliente}`);
      });
    });
    container.querySelectorAll('[data-export-pdf]').forEach(btn => {
      btn.addEventListener('click', () => {
        const alvoId = btn.dataset.exportPdf;
        exportarRelatorioPDF(alvoId, `Relatorio_${subAbaAtiva}_${cliente}`);
      });
    });
  }

  /**
   * Sub-aba "Painel Comercial — Representante".
   * Felipe sessao 12: 'esse painel e unico somente 1 do valor global,
   * nao esse tanto de cards, sempre painel representante independente
   * de quanto itens tiver e so um global, com valores globais'.
   *
   * ANTES: 1 card por item da versao (6 itens = 6 cards). Cada card
   * tinha preco rateado proporcional a area.
   * AGORA: 1 card UNICO sempre. Valores GLOBAIS (toda a versao).
   */
  function renderRelComercial(versao, opcao, lead, negocio, dre, params, cliente, agp, reserva, fmtMoney, fmtMoneyM2, fmtPct) {
    const itens = (versao.itens || []);
    if (itens.length === 0) {
      return `<div class="rep-empty">
        <div class="rep-empty-icon">📋</div>
        <p>Nenhum item na versao ativa.</p>
      </div>`;
    }

    const subFab  = Number(versao.subFab)  || 0;
    const subInst = Number(versao.subInst) || 0;

    // Calcula area TOTAL de toda a versao (todos os itens)
    // Felipe sessao 12: rev_parede usa largura_total/altura_total
    const areaTotal = itens.reduce((s, it) => {
      const ehRev = it.tipo === 'revestimento_parede';
      const lar = ehRev
        ? (parseBR(it.largura_total) || parseBR(it.largura) || 0)
        : (parseBR(it.largura) || 0);
      const alt = ehRev
        ? (parseBR(it.altura_total) || parseBR(it.altura) || 0)
        : (parseBR(it.altura) || 0);
      const qtd = Number(it.quantidade) || 1;
      return s + (lar / 1000) * (alt / 1000) * qtd;
    }, 0);

    const subTotalCusto = subFab + subInst;
    const ratioInst = subTotalCusto > 0 ? subInst / subTotalCusto : 0;

    // Precos GLOBAIS (toda a versao)
    const precoTabTotal = Number(dre.pTab)     || 0;
    const precoFatTotal = Number(dre.pFatReal) || 0;
    const m2Base = areaTotal || 1;
    const precoTabM2_porInst = precoTabTotal / m2Base;
    const precoFatM2_porInst = precoFatTotal / m2Base;
    const precoTabM2_soPorta = precoTabM2_porInst * (1 - ratioInst);
    const precoFatM2_soPorta = precoFatM2_porInst * (1 - ratioInst);

    // Resumo de itens: tipos + quantidades
    const totalPortas = itens.filter(it => it.tipo === 'porta_externa').reduce((s, it) => s + (Number(it.quantidade) || 1), 0);
    const totalRevs   = itens.filter(it => it.tipo === 'revestimento_parede').reduce((s, it) => s + (Number(it.quantidade) || 1), 0);
    const m2Str = areaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const resumoItens = [
      totalPortas > 0 ? `${totalPortas} porta(s)` : null,
      totalRevs > 0 ? `${totalRevs} revestimento(s)` : null,
    ].filter(Boolean).join(' · ');

    const cardHtml = `
      <div class="rep-card">
        <div class="rep-card-head">
          <div class="rep-card-titulo">PROJETTA <span>by WEIKU</span></div>
          <div class="rep-card-sub">Painel Comercial — Resumo Global</div>
        </div>
        <div class="rep-card-id">
          <div class="rep-id-row">
            <span class="rep-id-label">Cliente:</span><span class="rep-id-val">${escapeHtml(cliente)}</span>
            <span class="rep-id-label">AGP:</span><span class="rep-id-val">${escapeHtml(agp)}</span>
            <span class="rep-id-label">Reserva:</span><span class="rep-id-val">${escapeHtml(reserva)}</span>
          </div>
          <div class="rep-id-row">
            <span class="rep-id-val rep-id-meta">${itens.length} itens · ${escapeHtml(resumoItens || 'sem itens')} · ${m2Str} m² total</span>
          </div>
        </div>
        <div class="rep-precos">
          <div class="rep-preco-bloco rep-preco-tabela">
            <div class="rep-preco-label">ORIGINAL</div>
            <div class="rep-preco-valor">${fmtMoney(precoTabTotal)}</div>
          </div>
          <div class="rep-preco-bloco rep-preco-fat">
            <div class="rep-preco-label">COM DESCONTO</div>
            <div class="rep-preco-valor">${fmtMoney(precoFatTotal)}</div>
          </div>
        </div>
        <div class="rep-m2">
          <div class="rep-m2-titulo">VALORES POR M²</div>
          <table class="rep-m2-tabela">
            <tbody>
              <tr><td>Original/m² <span class="t-strong">porta+inst</span></td><td class="num">${fmtMoneyM2(precoTabM2_porInst)}</td></tr>
              <tr><td>Com Desconto/m² <span class="t-strong">porta+inst</span></td><td class="num">${fmtMoneyM2(precoFatM2_porInst)}</td></tr>
              <tr><td>Original/m² <span class="t-strong">só porta</span></td><td class="num">${fmtMoneyM2(precoTabM2_soPorta)}</td></tr>
              <tr><td>Com Desconto/m² <span class="t-strong">só porta</span></td><td class="num">${fmtMoneyM2(precoFatM2_soPorta)}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="rep-comissoes">
          <div class="rep-com-bloco"><div class="rep-com-label">COMISSÃO REP.</div><div class="rep-com-valor">${fmtPct(params.com_rep)}</div></div>
          <div class="rep-com-bloco"><div class="rep-com-label">COMISSÃO ARQ.</div><div class="rep-com-valor">${fmtPct(params.com_rt)}</div></div>
          <div class="rep-com-bloco rep-com-desc"><div class="rep-com-label">DESCONTO</div><div class="rep-com-valor">${fmtPct(params.desconto)}</div></div>
        </div>
      </div>`;

    return `
      <div class="rep-section-head">
        <h3 class="rep-section-titulo">Painel Comercial — Representante</h3>
        <p class="rep-section-sub">
          Resumo GLOBAL da versao: precos Original e Com Desconto, valores por m² (porta+inst e so' porta), comissoes e desconto aplicado.
        </p>
      </div>
      <div class="rep-grid">${cardHtml}</div>
    `;
  }

  /**
   * Sub-aba "DRE Resumida" — mesmo estilo do Painel Comercial mas com
   * os numeros de receita / dedicoes / lucro alvo. Felipe queria igual
   * em layout, so' trocando o conteudo.
   */
  function renderRelDRE(versao, dre, params, fmtMoney, fmtPct) {
    const itens = (versao.itens || []);
    const numItens = itens.length;
    const m2Total = itens.reduce((s, it) => {
      const lar = parseBR(it.largura) || 0;
      const alt = parseBR(it.altura)  || 0;
      const qtd = Number(it.quantidade) || 1;
      return s + (lar / 1000) * (alt / 1000) * qtd;
    }, 0);

    const receitaBruta  = dre.pFatReal || 0;
    const impostos      = receitaBruta * (params.impostos || 0) / 100;
    const comRep        = receitaBruta * (params.com_rep || 0) / 100;
    const comRT         = receitaBruta * (params.com_rt || 0) / 100;
    const comGest       = receitaBruta * (params.com_gest || 0) / 100;
    const totalDeducoes = impostos + comRep + comRT + comGest;
    const receitaLiq    = receitaBruta - totalDeducoes;
    const custoDireto   = (Number(versao.subFab)||0) + (Number(versao.subInst)||0);
    const lucroBruto    = receitaLiq - (custoDireto * (1 + (Number(params.overhead)||0)/100));
    const irpjCsll      = lucroBruto * 0.34;
    const lucroLiq      = lucroBruto - irpjCsll;
    const margem        = receitaBruta > 0 ? (lucroLiq / receitaBruta) * 100 : 0;

    return `
      <div class="rep-section-head">
        <h3 class="rep-section-titulo">DRE — Resultado da Operacao</h3>
        <p class="rep-section-sub">
          Demonstrativo de Resultado do Exercicio para esta versao do orcamento.
        </p>
      </div>

      <div class="rep-card" style="max-width: 720px; margin: 0 0 16px 0;">
        <div class="rep-card-head">
          <div class="rep-card-titulo">PROJETTA <span>by WEIKU</span></div>
          <div class="rep-card-sub">DRE Resumida — Versao ${versao.numero}</div>
        </div>

        <div class="rep-card-id">
          <div class="rep-id-row">
            <span class="rep-id-label">Itens:</span><span class="rep-id-val">${numItens}</span>
            <span class="rep-id-label">Area Total:</span><span class="rep-id-val">${m2Total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} m²</span>
          </div>
        </div>

        <div class="rep-precos">
          <div class="rep-preco-bloco rep-preco-tabela">
            <div class="rep-preco-label">RECEITA BRUTA</div>
            <div class="rep-preco-valor">${fmtMoney(receitaBruta)}</div>
          </div>
          <div class="rep-preco-bloco rep-preco-fat">
            <div class="rep-preco-label">LUCRO LIQUIDO</div>
            <div class="rep-preco-valor">${fmtMoney(lucroLiq)}</div>
          </div>
        </div>

        <div class="rep-m2">
          <div class="rep-m2-titulo">DETALHAMENTO</div>
          <table class="rep-m2-tabela">
            <tbody>
              <tr><td>Receita Bruta</td><td class="num">${fmtMoney(receitaBruta)}</td></tr>
              <tr><td>(−) Impostos sobre Receita ${fmtPct(params.impostos)}</td><td class="num" style="color:#c43a3a;">${fmtMoney(-impostos)}</td></tr>
              <tr><td>(−) Comissao Representante ${fmtPct(params.com_rep)}</td><td class="num" style="color:#c43a3a;">${fmtMoney(-comRep)}</td></tr>
              <tr><td>(−) Comissao RT/Arquiteto ${fmtPct(params.com_rt)}</td><td class="num" style="color:#c43a3a;">${fmtMoney(-comRT)}</td></tr>
              <tr><td>(−) Comissao Gestao ${fmtPct(params.com_gest)}</td><td class="num" style="color:#c43a3a;">${fmtMoney(-comGest)}</td></tr>
              <tr style="border-top: 1px solid #ccc;"><td><span class="t-strong">Total Deducoes</span></td><td class="num" style="color:#c43a3a;"><span class="t-strong">${fmtMoney(-totalDeducoes)}</span></td></tr>
              <tr><td><span class="t-strong">Receita Liquida</span></td><td class="num"><span class="t-strong">${fmtMoney(receitaLiq)}</span></td></tr>
              <tr><td>(−) Custo Direto + Overhead</td><td class="num" style="color:#c43a3a;">${fmtMoney(-custoDireto * (1 + (Number(params.overhead)||0)/100))}</td></tr>
              <tr><td><span class="t-strong">Lucro Bruto (antes IRPJ+CSLL)</span></td><td class="num"><span class="t-strong">${fmtMoney(lucroBruto)}</span></td></tr>
              <tr><td>(−) IRPJ + CSLL (34%)</td><td class="num" style="color:#c43a3a;">${fmtMoney(-irpjCsll)}</td></tr>
              <tr style="border-top: 2px solid var(--azul-escuro);"><td><span class="t-strong">Lucro Liquido</span></td><td class="num" style="color:#1a7a3f;"><span class="t-strong">${fmtMoney(lucroLiq)}</span></td></tr>
              <tr><td>Margem Liquida</td><td class="num" style="color:${margem >= (params.lucro_alvo||15) ? '#1a7a3f' : '#c43a3a'};"><span class="t-strong">${margem.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 2})}%</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Sub-aba "Resumo da Obra" — Felipe quer no mesmo estilo do Painel
   * Comercial mas mostrando esquadrias + perfis + chapas + componentes
   * + mao de obra + instalacao = custo total. NA VERTICAL (cards
   * empilhados) em vez de linha horizontal.
   */
  function renderRelObra(versao, dre, fmtMoney) {
    const itens = (versao.itens || []);
    const m2Total = itens.reduce((s, it) => {
      const lar = parseBR(it.largura) || 0;
      const alt = parseBR(it.altura)  || 0;
      const qtd = Number(it.quantidade) || 1;
      return s + (lar / 1000) * (alt / 1000) * qtd;
    }, 0);
    const numPortas = itens.reduce((s, it) => s + (Number(it.quantidade) || 1), 0);

    const fab = Object.assign({}, FAB_DEFAULT, versao.custoFab || {});

    const custoPerfis    = Number(fab.total_perfis)      || 0;
    const custoPintura   = Number(fab.total_pintura)     || 0;
    const custoAcess     = Number(fab.total_acessorios)  || 0;
    const custoChapas    = Number(fab.total_revestimento)|| 0;
    const custoExtras    = Number(fab.total_extras)      || 0;
    const custoFechDig   = Number(fab.total_fechadura_digital) || 0;

    // FIX 2026-05-04 (AGP004647): mao de obra vinha 0h porque as etapas
    // foram renomeadas (quadro->folha_porta, conf_bem->conf_embalagem) mas
    // este bloco ainda lia os IDs antigos. Agora soma DINAMICAMENTE todas
    // as etapas existentes em fab.etapas — robusto a renomeacoes futuras.
    let totalHoras = 0;
    if (fab.etapas && typeof fab.etapas === 'object') {
      Object.keys(fab.etapas).forEach(k => {
        const v = Number(fab.etapas[k]);
        if (!isNaN(v) && v > 0) totalHoras += v;
      });
    }
    // Fallback: se o usuario nao preencheu etapas manualmente, calcula via
    // auto-regras de cada item (mesma logica de calcularValoresProposta).
    if (totalHoras === 0 && itens.length > 0) {
      itens.forEach(it => {
        if (it && it.tipo === 'porta_externa') {
          const h = horasItemPortaExterna(it);
          totalHoras += (Number(h.portal)||0) + (Number(h.quadro)||0)
                      + (Number(h.corte_usinagem)||0) + (Number(h.colagem)||0)
                      + (Number(h.conf_bem)||0);
        }
      });
    }
    const numOp       = Number(fab.n_operarios) || 1;
    const custoHora   = Number(fab.custo_hora) || 0;
    const custoMaoObra = totalHoras * numOp * custoHora;

    const subInstTotal = Number(versao.subInst) || 0;
    const subFabTotal  = Number(versao.subFab)  || 0;
    const custoTotalFab = subFabTotal + subInstTotal;

    // Felipe (sessao 2026-08): "resumo da obra nao ficou mesmo estilo
    // dos outros". Refeito usando rep-card (mesma estrutura do Painel
    // Comercial e DRE Resumida) com tabela de detalhamento dentro.
    return `
      <div class="rep-card" style="max-width: 720px; margin: 0 0 16px 0;">
        <div class="rep-card-head">
          <div class="rep-card-titulo">PROJETTA <span>by WEIKU</span></div>
          <div class="rep-card-sub">Resumo da Obra — Versao ${versao.numero}</div>
        </div>

        <div class="rep-card-id">
          <div class="rep-id-row">
            <span class="rep-id-label">Itens:</span><span class="rep-id-val">${itens.length}</span>
            <span class="rep-id-label">Portas:</span><span class="rep-id-val">${numPortas}</span>
            <span class="rep-id-label">Area Total:</span><span class="rep-id-val">${m2Total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} m²</span>
          </div>
        </div>

        <div class="rep-precos">
          <div class="rep-preco-bloco rep-preco-tabela">
            <div class="rep-preco-label">CUSTO TOTAL DA OBRA</div>
            <div class="rep-preco-valor">${fmtMoney(custoTotalFab)}</div>
          </div>
          <div class="rep-preco-bloco rep-preco-fat">
            <div class="rep-preco-label">COM DESCONTO</div>
            <div class="rep-preco-valor">${fmtMoney(dre.pFatReal || 0)}</div>
          </div>
        </div>

        <div class="rep-m2">
          <div class="rep-m2-titulo">DETALHAMENTO POR CATEGORIA</div>
          <table class="rep-m2-tabela">
            <tbody>
              <tr><td>🚪 Esquadrias</td><td class="num">${m2Total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} m² · ${numPortas} porta(s)</td></tr>
              <tr><td>📏 Perfis de Aluminio</td><td class="num">${fmtMoney(custoPerfis)}</td></tr>
              ${custoPintura > 0 ? `<tr><td>🎨 Pintura dos Perfis</td><td class="num">${fmtMoney(custoPintura)}</td></tr>` : ''}
              <tr><td>🟫 Chapas / Revestimento</td><td class="num">${fmtMoney(custoChapas)}</td></tr>
              <tr><td>🔩 Componentes (acessorios + fechaduras)</td><td class="num">${fmtMoney(custoAcess + custoExtras + custoFechDig)}</td></tr>
              <tr><td>👷 Mao de Obra (${(Math.round(totalHoras*10)/10).toLocaleString('pt-BR')}h × ${numOp} op. × ${fmtMoney(custoHora)}/h)</td><td class="num">${fmtMoney(custoMaoObra)}</td></tr>
              <tr><td>🚛 Instalacao</td><td class="num">${fmtMoney(subInstTotal)}</td></tr>
              <tr style="border-top: 2px solid var(--azul-escuro);"><td><span class="t-strong">Custo Total da Obra</span></td><td class="num"><span class="t-strong">${fmtMoney(custoTotalFab)}</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Sub-aba "Resultado por Porta" — mostra POR ITEM os custos detalhados.
   * Felipe sessao 12: 'aba resultado da porta a mesma coisa' - 1 card
   * UNICO global, nao 1 por item. Antes tinha 6 cards pra 6 itens.
   */
  function renderRelResultadoPorta(versao, dre, params, fmtMoney, fmtPct) {
    const itens = (versao.itens || []);
    if (itens.length === 0) {
      return `<div class="rep-empty">
        <div class="rep-empty-icon">🚪</div>
        <p>Nenhum item na versao ativa.</p>
      </div>`;
    }

    const subInst = Number(versao.subInst) || 0;
    const subFab  = Number(versao.subFab)  || 0;
    const custoTotal = subFab + subInst;
    const ratioInst = custoTotal > 0 ? subInst / custoTotal : 0;
    const desconto  = Number(params.desconto) || 0;
    const lucroAlvo = Number(params.lucro_alvo) || 15;

    // Area TOTAL da versao (rev usa largura_total/altura_total)
    const m2Total = itens.reduce((s, it) => {
      const ehRev = it.tipo === 'revestimento_parede';
      const lar = ehRev
        ? (parseBR(it.largura_total) || parseBR(it.largura) || 0)
        : (parseBR(it.largura) || 0);
      const alt = ehRev
        ? (parseBR(it.altura_total) || parseBR(it.altura) || 0)
        : (parseBR(it.altura) || 0);
      const qtd = Number(it.quantidade) || 1;
      return s + (lar / 1000) * (alt / 1000) * qtd;
    }, 0);

    // Precos GLOBAIS (toda a versao)
    const precoTab = Number(dre.pTab)     || 0;
    const precoFat = Number(dre.pFatReal) || 0;

    // Decompoem porta vs instalacao no preco
    const precoFatInst  = precoFat * ratioInst;
    const precoFatPorta = precoFat - precoFatInst;
    const precoTabInst  = precoTab * ratioInst;
    const precoTabPorta = precoTab - precoTabInst;

    // Markup s/ custo
    const markupVisual = custoTotal > 0 ? ((precoTab - custoTotal) / custoTotal * 100) : 0;
    // Margem bruta = (preco fat - custo) / preco fat
    const margemBruta = precoFat > 0 ? ((precoFat - custoTotal) / precoFat * 100) : 0;
    // Margem liquida (apos impostos+comissoes+IRPJ)
    const impostos = precoFat * (Number(params.impostos)||0)/100;
    const comRep   = precoFat * (Number(params.com_rep)||0)/100;
    const comRT    = precoFat * (Number(params.com_rt)||0)/100;
    const comGest  = precoFat * (Number(params.com_gest)||0)/100;
    const lucroBruto = precoFat - impostos - comRep - comRT - comGest - custoTotal * (1 + (Number(params.overhead)||0)/100);
    const irpjCsll = lucroBruto * 0.34;
    const lucroLiq = lucroBruto - irpjCsll;
    const margemLiquida = precoFat > 0 ? (lucroLiq / precoFat * 100) : 0;

    // Por m²
    const m2Den = m2Total || 1;
    const custoM2 = custoTotal / m2Den;
    const precoTabM2_porInst = precoTab / m2Den;
    const precoFatM2_porInst = precoFat / m2Den;
    const precoTabM2_soPorta = precoTabPorta / m2Den;
    const precoFatM2_soPorta = precoFatPorta / m2Den;

    const totalPortas = itens.filter(it => it.tipo === 'porta_externa').reduce((s, it) => s + (Number(it.quantidade) || 1), 0);
    const totalRevs   = itens.filter(it => it.tipo === 'revestimento_parede').reduce((s, it) => s + (Number(it.quantidade) || 1), 0);
    const m2Str = m2Total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const resumoItens = [
      totalPortas > 0 ? `${totalPortas} porta(s)` : null,
      totalRevs > 0 ? `${totalRevs} revestimento(s)` : null,
    ].filter(Boolean).join(' · ');

    return `
      <div class="rep-card" style="max-width: 720px; margin: 0 0 16px 0;">
        <div class="rep-card-head">
          <div class="rep-card-titulo">PROJETTA <span>by WEIKU</span></div>
          <div class="rep-card-sub">Resultado — Resumo Global</div>
        </div>

        <div class="rep-card-id">
          <div class="rep-id-row">
            <span class="rep-id-val rep-id-meta">${itens.length} itens · ${escapeHtml(resumoItens || 'sem itens')} · Area total: ${m2Str} m²</span>
          </div>
        </div>

        <div class="rep-precos">
          <div class="rep-preco-bloco rep-preco-tabela">
            <div class="rep-preco-label">CUSTO TOTAL</div>
            <div class="rep-preco-valor">${fmtMoney(custoTotal)}</div>
            <div class="rep-preco-meta">${fmtMoney(custoM2)}/m²</div>
          </div>
          <div class="rep-preco-bloco rep-preco-fat">
            <div class="rep-preco-label">MARKUP S/ CUSTO</div>
            <div class="rep-preco-valor">${markupVisual.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</div>
            <div class="rep-preco-meta">sobre tabela</div>
          </div>
        </div>

        <div class="rep-precos">
          <div class="rep-preco-bloco rep-preco-tabela">
            <div class="rep-preco-label">ORIGINAL</div>
            <div class="rep-preco-valor">${fmtMoney(precoTab)}</div>
            <div class="rep-preco-meta">${fmtMoney(precoTabM2_porInst)}/m²</div>
          </div>
          <div class="rep-preco-bloco rep-preco-fat">
            <div class="rep-preco-label">COM DESCONTO</div>
            <div class="rep-preco-valor">${fmtMoney(precoFat)}</div>
            <div class="rep-preco-meta">${fmtMoney(precoFatM2_porInst)}/m²</div>
          </div>
        </div>

        <div class="rep-m2">
          <div class="rep-m2-titulo">DETALHAMENTO</div>
          <table class="rep-m2-tabela">
            <tbody>
              <tr><td>Custo fabricacao</td><td class="num">${fmtMoney(subFab)}</td></tr>
              <tr><td>Custo instalacao</td><td class="num">${fmtMoney(subInst)}</td></tr>
              <tr><td>Original so' porta</td><td class="num">${fmtMoney(precoTabPorta)}</td></tr>
              <tr><td>Com Desconto so' porta</td><td class="num">${fmtMoney(precoFatPorta)}</td></tr>
              <tr><td>Original instalacao</td><td class="num">${fmtMoney(precoTabInst)}</td></tr>
              <tr><td>Com Desconto instalacao</td><td class="num">${fmtMoney(precoFatInst)}</td></tr>
              <tr style="border-top: 1px solid #ccc;"><td>Margem bruta</td><td class="num">${margemBruta.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td></tr>
              <tr><td>Margem liquida</td><td class="num" style="color:${margemLiquida >= lucroAlvo ? '#1a7a3f' : '#c43a3a'};"><span class="t-strong">${margemLiquida.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</span></td></tr>
            </tbody>
          </table>
        </div>

        <div class="rep-m2">
          <div class="rep-m2-titulo">POR M²</div>
          <table class="rep-m2-tabela">
            <tbody>
              <tr><td>Custo/m²</td><td class="num">${fmtMoney(custoM2)}/m²</td></tr>
              <tr><td>Original/m² <span class="t-strong">porta+inst</span></td><td class="num">${fmtMoney(precoTabM2_porInst)}/m²</td></tr>
              <tr><td>Com Desconto/m² <span class="t-strong">porta+inst</span></td><td class="num">${fmtMoney(precoFatM2_porInst)}/m²</td></tr>
              <tr><td>Original/m² <span class="t-strong">so' porta</span></td><td class="num">${fmtMoney(precoTabM2_soPorta)}/m²</td></tr>
              <tr><td>Com Desconto/m² <span class="t-strong">so' porta</span></td><td class="num">${fmtMoney(precoFatM2_soPorta)}/m²</td></tr>
              ${desconto > 0 ? `<tr><td>Desconto aplicado</td><td class="num" style="color:var(--laranja);"><span class="t-strong">${desconto.toLocaleString('pt-BR')}% → -${fmtMoney(precoTab - precoFat)}</span></td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /**
   * Felipe (sessao 2026-08): "relatorio de superficie coloque na propria
   * aba de superficies e nao em relatorio". Funcao mantida pra ser
   * exposta via window.Orcamento e chamada pelo modulo Superficies.
   *
   * Renderiza relatorio com itens, pecas e layout das chapas escolhidas.
   */
  function renderRelChapas(versao) {
    const chapasSelecionadas = versao.chapasSelecionadas || {};
    const cores = Object.keys(chapasSelecionadas);
    if (cores.length === 0) {
      return `
        <div class="rep-empty">
          <div class="rep-empty-icon">📐</div>
          <p>Nenhuma chapa selecionada ainda.</p>
          <p style="font-size:12px;color:var(--text-muted);">Volte na aba <b>Levantamento de Superficies</b> e escolha as chapas-mae.</p>
        </div>`;
    }

    // Felipe (sessao 27 fix): "precisava desta parte geral, custo
    // unitario custo total no relatorio e principalmente a disposicao
    // das chapas em cada layout".
    // Relatorio agora mostra:
    //   1) Resumo geral por cor (chapas, aproveitamento, custo unit, total)
    //   2) Tabela DETALHADA por chapa (#, peças, area, taxa, peso, custo)
    //   3) Lista das peças posicionadas em cada chapa
    const blocos = cores.map(cor => {
      const sel = chapasSelecionadas[cor] || {};
      const idxEscolhido = sel.idxEscolhido !== undefined ? sel.idxEscolhido : 0;
      let opcoes = sel.opcoes || [];
      let opcao = opcoes[idxEscolhido];

      // Felipe (sessao 28 fix): se a chapa foi selecionada ANTES desta
      // versao do codigo, nao tem `opcoes[].chapas[]` salvo. Monta uma
      // opcao MINIMA com os metadados disponiveis pra mostrar pelo menos
      // o resumo geral. Disposicao das pecas ficara vazia ate o usuario
      // re-selecionar a chapa (duplo-click no card).
      if (!opcao && (sel.descricao || sel.numChapas)) {
        opcao = {
          chapaMae: {
            descricao:  sel.descricao || cor,
            largura:    sel.largura || 0,
            altura:     sel.altura || 0,
            preco:      sel.preco || 0,
            peso_kg_m2: sel.peso_kg_m2 || 0,
          },
          taxaAproveitamento: 0,  // nao temos — mostra "—"
          custoTotal:         Number(sel.custoTotal) || 0,
          numChapas:          Number(sel.numChapas) || 0,
          chapas:             [],  // sem dados de disposicao
        };
      }

      if (!opcao) {
        return `<div class="rel-chapas-bloco">
          <h4>${escapeHtml(cor)}</h4>
          <p style="color:var(--text-muted);">Sem dados de aproveitamento.</p>
        </div>`;
      }
      const numChapas    = opcao.numChapas || (opcao.chapas?.length || 0);
      const aprovMedio   = ((opcao.taxaAproveitamento || 0) * 100).toFixed(1);
      const custoTot     = Number(opcao.custoTotal)     || 0;
      const custoUnit    = numChapas > 0 ? custoTot / numChapas : 0;
      const chapaMae     = opcao.chapaMae || {};
      const dimChapa     = (chapaMae.largura && chapaMae.altura)
                           ? `${chapaMae.largura}×${chapaMae.altura} mm`
                           : '—';
      // Aviso se nao tem disposicao salva
      const semDisposicao = (!opcao.chapas || opcao.chapas.length === 0);
      // Soma total de peças e área usada
      let totalPecas = 0;
      let areaUsada = 0;
      let areaSobra = 0;
      (opcao.chapas || []).forEach(c => {
        totalPecas += (c.pecasPosicionadas || []).length;
        (c.pecasPosicionadas || []).forEach(pp => {
          areaUsada += (Number(pp.larg) || 0) * (Number(pp.alt) || 0);
        });
        (c.sobrasRetangulos || []).forEach(s => {
          areaSobra += (Number(s.w) || 0) * (Number(s.h) || 0);
        });
      });
      const areaUsadaM2 = areaUsada / 1e6;
      const areaSobraM2 = areaSobra / 1e6;

      // Tabela detalhada por chapa
      const linhasTabela = (opcao.chapas || []).map((c, idx) => {
        const taxa = ((c.taxa || 0) * 100).toFixed(1);
        const numPecas = (c.pecasPosicionadas || []).length;
        let aTotal = 0;
        (c.pecasPosicionadas || []).forEach(pp => {
          aTotal += (Number(pp.larg) || 0) * (Number(pp.alt) || 0);
        });
        const aTotalM2 = (aTotal / 1e6).toFixed(2);
        return `
          <tr>
            <td class="num"><b>${idx + 1}</b></td>
            <td class="num">${numPecas}</td>
            <td class="num">${aTotalM2} m²</td>
            <td class="num">${taxa}%</td>
            <td class="num">R$ ${fmtBR(custoUnit)}</td>
          </tr>`;
      }).join('');

      // Lista de peças por chapa — agrupa por (label + dim) pra ficar limpa
      const blocosPecasPorChapa = (opcao.chapas || []).map((c, idx) => {
        if (!c.pecasPosicionadas || c.pecasPosicionadas.length === 0) {
          return `<div class="rel-chapa-detalhe">
            <h5>Chapa ${idx + 1} — vazia</h5>
          </div>`;
        }
        // Agrupar peças repetidas
        const mapa = new Map();
        c.pecasPosicionadas.forEach(pp => {
          const label = (pp.peca && pp.peca.label) || '—';
          // Felipe sessao 13: destaque AM. Vem do 38-chapas-porta-externa.js
          // (set quando peça virou categoria='aluminio_macico' no Modelo 23 + AM).
          const matEsp = (pp.peca && pp.peca.materialEspecial) || null;
          const k = `${label}|${Math.round(pp.larg)}×${Math.round(pp.alt)}|${matEsp || ''}`;
          const existe = mapa.get(k);
          if (existe) {
            existe.qtd++;
          } else {
            mapa.set(k, { label, dim: `${Math.round(pp.larg)}×${Math.round(pp.alt)}`, qtd: 1, materialEspecial: matEsp });
          }
        });
        const linhas = Array.from(mapa.values()).map(p => {
          // Felipe sessao 13: "escrito chapa aluminio macico quando for".
          // Em vez de badge AM curto, exibimos texto completo abaixo do
          // nome da peça quando ela e' de aluminio macico.
          const subtituloAM = (p.materialEspecial === 'AM')
            ? '<div style="font-size:11px;color:#92400e;font-weight:600;margin-top:2px;">Chapa Alumínio Maciço</div>'
            : '';
          return `
          <tr${p.materialEspecial === 'AM' ? ' style="background:#fffbeb;"' : ''}>
            <td>${escapeHtml(p.label)}${subtituloAM}</td>
            <td class="num">${p.dim} mm</td>
            <td class="num">${p.qtd}</td>
          </tr>`;
        }).join('');
        const taxaC = ((c.taxa || 0) * 100).toFixed(1);
        return `
          <div class="rel-chapa-detalhe">
            <h5>Chapa ${idx + 1} <span style="color:var(--text-muted);font-weight:400;">— ${taxaC}% aproveitamento, ${c.pecasPosicionadas.length} peça(s)</span></h5>
            <table class="rel-chapa-pecas-tabela">
              <thead><tr><th>Peça</th><th class="num">Dimensão</th><th class="num">Qtd</th></tr></thead>
              <tbody>${linhas}</tbody>
            </table>
          </div>`;
      }).join('');

      return `
        <div class="rel-chapas-bloco">
          <h4>${escapeHtml(cor)}</h4>

          ${semDisposicao ? `
            <div style="background:#fef9c3;border:1px solid #facc15;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#78350f;">
              ⚠ Disposição das peças não foi salva nesta seleção.
              Para ver custo unitário, área usada e a disposição em cada chapa,
              <b>volte na aba Lev. Superfícies</b> e dê <b>duplo-clique</b> no
              card da chapa novamente.
            </div>` : ''}

          <!-- Resumo geral -->
          <div class="rel-chapas-resumo">
            <div><span class="rel-chapas-lbl">Chapa-mãe:</span> ${escapeHtml(chapaMae.descricao || '—')}</div>
            <div><span class="rel-chapas-lbl">Dimensão:</span> ${dimChapa}</div>
            <div><span class="rel-chapas-lbl">Total chapas:</span> <b>${numChapas}</b></div>
            <div><span class="rel-chapas-lbl">Total peças:</span> <b>${semDisposicao ? '—' : totalPecas}</b></div>
            <div><span class="rel-chapas-lbl">Aproveitamento médio:</span> <b>${semDisposicao ? '—' : aprovMedio + '%'}</b></div>
            <div><span class="rel-chapas-lbl">Área usada:</span> ${semDisposicao ? '—' : areaUsadaM2.toFixed(2) + ' m²'}</div>
            <div><span class="rel-chapas-lbl">Área sobra:</span> ${semDisposicao ? '—' : areaSobraM2.toFixed(2) + ' m²'}</div>
            <div><span class="rel-chapas-lbl">Custo unitário:</span> <b>R$ ${fmtBR(custoUnit)}</b></div>
            <div><span class="rel-chapas-lbl">Custo total:</span> <b style="color:var(--accent);">R$ ${fmtBR(custoTot)}</b></div>
          </div>

          ${semDisposicao ? '' : `
          <!-- Tabela por chapa -->
          <table class="rel-chapas-tabela" style="margin-top:12px;">
            <thead>
              <tr>
                <th class="num">Chapa</th>
                <th class="num">Peças</th>
                <th class="num">Área usada</th>
                <th class="num">Aprov.</th>
                <th class="num">Custo R$</th>
              </tr>
            </thead>
            <tbody>${linhasTabela}</tbody>
            <tfoot>
              <tr style="font-weight:bold;border-top:2px solid var(--border);">
                <td>Total</td>
                <td class="num">${totalPecas}</td>
                <td class="num">${areaUsadaM2.toFixed(2)} m²</td>
                <td class="num">${aprovMedio}%</td>
                <td class="num">R$ ${fmtBR(custoTot)}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Disposição das peças por chapa -->
          <div class="rel-chapas-disposicao" style="margin-top:16px;">
            <h5 style="margin:0 0 8px 0;">Disposição das peças em cada chapa</h5>
            ${blocosPecasPorChapa}
          </div>`}
        </div>`;
    }).join('');

    return `
      <div class="rep-section-head">
        <h3 class="rep-section-titulo">Chapas / Aproveitamento</h3>
        <p class="rep-section-sub">
          Resumo geral, custo unitário e total, e disposição das peças em cada chapa.
        </p>
      </div>
      ${blocos}
    `;
  }

  /**
   * Felipe (sessao 2026-08): "permita exportar mas dessa vez em png".
   * Felipe (sessao 2026-08 v2): "esta imprimindo toda lateral quero
   * somente o quadro dos relatorios". Estrategia agora:
   *   1. Localiza dentro do `elementoId` o(s) card(s) reais
   *      (.rep-card, .rel-chapas-bloco) — ignora section-head, padding
   *      do container, etc.
   *   2. Clona em host off-screen com fundo branco e largura otimizada
   *   3. Captura SO' o clone — nao tem bordas/lateral da aba
   */
  async function exportarRelatorioPNG(elementoId, nomeArquivo) {
    const elemento = document.getElementById(elementoId);
    if (!elemento) {
      alert('Conteudo do relatorio nao encontrado.');
      return;
    }
    let cloneHost = null;
    try {
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      const html2canvas = window.html2canvas;

      // Busca os cards reais (sem o section-head e sem bordas externas)
      const cards = elemento.querySelectorAll('.rep-card, .rel-chapas-bloco');
      let conteudoHtml = '';
      if (cards.length > 0) {
        conteudoHtml = Array.from(cards).map(c => c.outerHTML).join('<div style="height: 12px;"></div>');
      } else {
        // Fallback — captura tudo se nao achar cards
        conteudoHtml = elemento.innerHTML;
      }

      // Host off-screen com fundo branco e largura adequada.
      // Felipe sessao 2026-05: 720px era pequeno - tabela do Lev Perfis
      // tem 10 colunas e cortava "Peso kg" e "Obs." no PNG.
      // 1100px comporta a tabela inteira sem corte.
      cloneHost = document.createElement('div');
      cloneHost.style.cssText = `
        position: absolute;
        top: 0;
        left: -10000px;
        width: 1100px;
        background: #ffffff;
        padding: 20px;
        z-index: -1;
      `;
      cloneHost.innerHTML = conteudoHtml;
      document.body.appendChild(cloneHost);

      const canvas = await html2canvas(cloneHost, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth:  cloneHost.scrollWidth,
        windowHeight: cloneHost.scrollHeight,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeName = String(nomeArquivo || 'relatorio').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
      const dataStr = new Date().toISOString().slice(0, 10);
      link.download = `${safeName}_${dataStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('[exportarRelatorioPNG]', e);
      alert('Nao foi possivel gerar o PNG: ' + (e.message || e));
    } finally {
      if (cloneHost && cloneHost.parentNode) cloneHost.parentNode.removeChild(cloneHost);
    }
  }

  /**
   * Felipe (sessao 2026-08): exporta relatorio como PDF (1 pagina).
   * Felipe (sessao 2026-08 v2): captura SO' os cards (sem lateral).
   */
  async function exportarRelatorioPDF(elementoId, nomeArquivo) {
    const elemento = document.getElementById(elementoId);
    if (!elemento) return;
    let cloneHost = null;
    try {
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const html2canvas = window.html2canvas;
      const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;

      // Mesmo tratamento do PNG: captura so' os cards reais
      const cards = elemento.querySelectorAll('.rep-card, .rel-chapas-bloco');
      let conteudoHtml = '';
      if (cards.length > 0) {
        conteudoHtml = Array.from(cards).map(c => c.outerHTML).join('<div style="height: 12px;"></div>');
      } else {
        conteudoHtml = elemento.innerHTML;
      }
      cloneHost = document.createElement('div');
      cloneHost.style.cssText = `
        position: absolute;
        top: 0;
        left: -10000px;
        width: 1100px;
        background: #ffffff;
        padding: 20px;
        z-index: -1;
      `;
      cloneHost.innerHTML = conteudoHtml;
      document.body.appendChild(cloneHost);

      const canvas = await html2canvas(cloneHost, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true,
        windowWidth: cloneHost.scrollWidth, windowHeight: cloneHost.scrollHeight,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margem = 10;
      const larguraImg = pageW - 2 * margem;
      const alturaImg  = (canvas.height * larguraImg) / canvas.width;

      if (alturaImg <= pageH - 2 * margem) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margem, margem, larguraImg, alturaImg);
      } else {
        // Fatia em paginas (caso o relatorio seja muito longo)
        const escala = larguraImg / canvas.width;
        const sliceH = (pageH - 2 * margem) / escala;
        let yPx = 0;
        let primeira = true;
        while (yPx < canvas.height) {
          const alturaPx = Math.min(sliceH, canvas.height - yPx);
          const slice = document.createElement('canvas');
          slice.width = canvas.width;
          slice.height = alturaPx;
          const ctx = slice.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, yPx, canvas.width, alturaPx, 0, 0, canvas.width, alturaPx);
          if (!primeira) pdf.addPage();
          primeira = false;
          pdf.addImage(slice.toDataURL('image/png'), 'PNG', margem, margem, larguraImg, alturaPx * escala);
          yPx += alturaPx;
        }
      }
      const safeName = String(nomeArquivo || 'relatorio').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
      const dataStr = new Date().toISOString().slice(0, 10);
      pdf.save(`${safeName}_${dataStr}.pdf`);
    } catch (e) {
      console.error('[exportarRelatorioPDF]', e);
      alert('Nao foi possivel gerar o PDF: ' + (e.message || e));
    } finally {
      if (cloneHost && cloneHost.parentNode) cloneHost.parentNode.removeChild(cloneHost);
    }
  }

  // ============================================================
  //                      ABA: LEVANTAMENTO DE ACESSORIOS
  // ============================================================
  /**
   * Felipe (sessao 2026-08): "JA IMPLEMENTE TODAS REGRAS DOS PERFIS,
   * LEMBRE QUE ASSIM COMO PERFIS E CHAPAS O CALCULO E INDIVIDUAL POR
   * ITEM". Usa AcessoriosPortaExterna.calcularAcessoriosPorItem pra
   * cada item porta_externa. Cada bloco mostra UM item com sua tabela
   * propria de acessorios. Tabela tem R12+R18 (filtro/sort universal).
   *
   * Regras vindas do PDF acess.pdf + complementos do Felipe (sessao
   * 2026-08). Documentadas em REGRAS_ACESSORIOS.md.
   */
  function renderLevAcessoriosTab(container) {
    inicializarSessao();
    const r = obterVersao(UI.versaoAtivaId);
    if (!r || !r.versao) {
      container.innerHTML = `<div class="info-banner">Sem versao ativa.</div>`;
      return;
    }
    const versao = r.versao;
    // Felipe sessao 2026-08: aceita revestimento_parede e fixo_acoplado
    // (so' calcula fita+silicone pra esses tipos, motor 28-acessorios-porta-
    // externa.js foi estendido pra processar os 3 tipos).
    // Felipe sessao 31: tambem aceita porta_interna (fluxo simples - so'
    // fechadura, macaneta e dobradicas, sem fita/silicone/pivo).
    const itens = (versao.itens || []).filter(it =>
      it && (it.tipo === 'porta_externa' || it.tipo === 'revestimento_parede' || it.tipo === 'fixo_acoplado' || it.tipo === 'porta_interna')
    );

    if (itens.length === 0) {
      container.innerHTML = `
        ${bannerCaracteristicasItens(versao)}
        <div class="info-banner">
          <span class="t-strong">Sem item de Porta Externa, Porta Interna, Revestimento de Parede ou Fixo Acoplado nesta versao.</span>
          Acessorios so' sao calculados para esses tipos.
        </div>`;
      return;
    }

    if (!window.AcessoriosPortaExterna) {
      container.innerHTML = `
        <div class="info-banner orc-banner-aviso-erro">
          Motor de acessorios (AcessoriosPortaExterna) nao carregado.
          Recarregue a pagina (Ctrl+F5).
        </div>`;
      return;
    }

    const cadAcess = Storage.scope('cadastros').get('acessorios_lista') || [];
    const fmtMoney = (n) => `R$ ${fmtBR(Number(n) || 0)}`;
    // R01: TODO numero exibido = 2 casas decimais. Antes este fmtQtd
    // retornava inteiros sem decimais (12, 28...) — viola R01.
    const fmtQtd = (n) => fmtBR(Number(n) || 0);

    // Renderiza UM bloco por item
    let totalGeralFab = 0;
    let totalGeralObra = 0;
    // Felipe (sessao 30): separar fechadura digital
    let totalGeralDigital = 0;

    // Felipe (sessao 2026-09): cadastro de perfis carregado UMA vez aqui
    // (fora do map) pra ser passado em todos os itens — usado pra
    // calcular peso da folha → escolher pivo 350 vs 600 kg.
    const perfisCadLevAcess = (typeof construirCadastroPerfis === 'function')
      ? construirCadastroPerfis() : {};

    // Felipe sessao 14 BUG FIX: renderBreakdownInline PRECISA estar no
    // escopo da funcao pai (renderLevAcessoriosTab), nao dentro do .map.
    // Antes (commit a447f4c): declarada dentro do map -> bloco consolidado
    // de revestimento (rodando depois do map) acessava fora do escopo
    // -> ReferenceError 'renderBreakdownInline is not defined' que
    // travava a aba Acessorios inteira. Agora em escopo de funcao,
    // acessivel tanto dentro do map quanto no bloco consolidado.
    const renderBreakdownInline = (idItem) => {
      const cache = window._fitaSiliconeBreakdownCache || {};
      const dados = cache[idItem];
      if (!dados || !dados.breakdown || !dados.breakdown.length) return '';

      const t = dados.totais || {};
      const dim = dados.itemDim || {};
      const ordenado = dados.breakdown.slice().sort((a, b) =>
        (b.contrib?.ms || 0) - (a.contrib?.ms || 0)
      );

      const linhasHtml = ordenado.map(e => {
        const ms = e.contrib?.ms || 0;
        const fd19 = e.contrib?.fd19 || 0;
        const fd12 = e.contrib?.fd12 || 0;
        const cps = e.contrib?.cps || 0;
        const ht = e.contrib?.hightack || 0;
        const pctMs = t.mMS > 0 ? (ms / t.mMS) * 100 : 0;
        const corDestaque = pctMs > 25 ? '#b91c1c' : pctMs > 10 ? '#b45309' : '#374151';
        const cs = 'text-align:center;padding:6px 10px;font-variant-numeric:tabular-nums;font-size:12px;';
        return `
          <tr>
            <td style="padding:6px 10px;font-weight:500;color:#1f2937;font-size:12px;">${escapeHtml(e.origem || '?')}</td>
            <td style="${cs}color:#475569;">${(e.metros || 0).toFixed(2)}m</td>
            <td style="${cs}font-size:11px;color:#6b7280;">×${e.mult?.fd19 || 0} / ×${e.mult?.fd12 || 0} / ×${e.mult?.ms || 0} / ×${e.mult?.cps || 0} / ×${e.mult?.hightack || 0}</td>
            <td style="${cs}color:#1e3a8a;background:#eff6ff;">${fd19 > 0 ? fd19.toFixed(2) + 'm' : '—'}</td>
            <td style="${cs}color:#1e3a8a;background:#dbeafe;">${fd12 > 0 ? fd12.toFixed(2) + 'm' : '—'}</td>
            <td style="${cs}font-weight:700;color:${corDestaque};background:#fef3c7;">${ms > 0 ? ms.toFixed(2) + 'm' : '—'}${ms > 0 ? `<span style="font-size:10px;font-weight:400;color:#9ca3af;"> (${pctMs.toFixed(0)}%)</span>` : ''}</td>
            <td style="${cs}font-weight:700;color:#15803d;background:#dcfce7;">${cps > 0 ? cps.toFixed(2) + 'm' : '—'}</td>
            <td style="${cs}font-weight:700;color:#0369a1;background:#e0f2fe;">${ht > 0 ? ht.toFixed(2) + 'm' : '—'}</td>
          </tr>
        `;
      }).join('');

      const rends = dados.rendimentos || { fd19_rolo: 20, fd12_rolo: 20, ms_tubo: 12, cps_sache: 12, hightack_tubo: 8 };
      const cpsRend = rends.cps_sache || rends.ms_tubo || 12;
      const rolosFD19 = t.mFD19 > 0 ? Math.ceil(t.mFD19 / rends.fd19_rolo) : 0;
      const rolosFD12 = t.mFD12 > 0 ? Math.ceil(t.mFD12 / rends.fd12_rolo) : 0;
      const tubosMS   = t.mMS   > 0 ? Math.ceil(t.mMS   / rends.ms_tubo)   : 0;
      const sachesCPS = (t.mCPS || 0) > 0 ? Math.ceil(t.mCPS / cpsRend)    : 0;
      const mFD19_obra = Number(t.mFD19_obra) || 0;
      const mFD12_obra = Number(t.mFD12_obra) || 0;
      const mHIGHTACK  = Number(t.mHIGHTACK)  || 0;
      // Felipe sessao 2026-05-10: HighTack FAB separado (regras FAB com
      // campo hightack > 0, ex: moldura Mod23 ACM). Soma com mHIGHTACK
      // (OBRA) pra exibir TOTAL real no badge e na linha TOTAL.
      const mHIGHTACK_fab = Number(t.mHIGHTACK_fab) || 0;
      const mHIGHTACK_total = mHIGHTACK + mHIGHTACK_fab;
      const hightackRend = rends.hightack_tubo || 8;
      const rolosFD19_obra = mFD19_obra > 0 ? Math.ceil(mFD19_obra / rends.fd19_rolo)  : 0;
      const rolosFD12_obra = mFD12_obra > 0 ? Math.ceil(mFD12_obra / rends.fd12_rolo)  : 0;
      const tubosHIGHTACK  = mHIGHTACK  > 0 ? Math.ceil(mHIGHTACK  / hightackRend)     : 0;

      return `
        <details style="margin-top:12px;background:#fffbeb;border:2px solid #f59e0b;border-radius:6px;">
          <summary style="cursor:pointer;padding:12px 16px;font-weight:700;color:#b45309;font-size:14px;list-style:none;display:flex;align-items:center;gap:10px;user-select:none;">
            <span style="display:inline-block;transition:transform 0.2s;font-size:12px;color:#b45309;" class="fsd-arrow">▶</span>
            📊 Abrir Detalhamento — Fita Dupla Face e Silicone Estrutural
            <span style="margin-left:auto;font-size:11px;font-weight:500;color:#92400e;background:#fef3c7;padding:3px 10px;border-radius:12px;">
              ${((t.mFD19 || 0) + (t.mFD19_obra || 0)).toFixed(1)}m + ${((t.mFD12 || 0) + (t.mFD12_obra || 0)).toFixed(1)}m + ${(t.mMS || 0).toFixed(1)}m 995 + ${(t.mCPS || 0).toFixed(1)}m CPS${mHIGHTACK_total > 0 ? ' + ' + mHIGHTACK_total.toFixed(1) + 'm HIGHTACK' : ''} · clique pra ver de onde
            </span>
          </summary>

          <div style="padding:0 16px 16px 16px;border-top:1px solid #fde68a;margin-top:4px;">
            <div style="display:flex;gap:12px;align-items:flex-start;margin:14px 0;">

            <table style="border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;">
            <thead>
              <tr style="background:#1f2937;color:#fff;">
                <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;">Peça / Perfil (com dimensões)</th>
                <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;white-space:nowrap;">Metros</th>
                <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;white-space:nowrap;">Mult. (19/12/995/CPS/HT)</th>
                <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#1e3a8a;white-space:nowrap;">FD 19mm</th>
                <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#1e40af;white-space:nowrap;">FD 12mm</th>
                <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#b45309;white-space:nowrap;">Silicone</th>
                <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#15803d;white-space:nowrap;">CPS BR</th>
                <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#0369a1;white-space:nowrap;">HIGHTACK</th>
              </tr>
            </thead>
            <tbody>${linhasHtml}</tbody>
            <tfoot>
              <tr style="background:#fef3c7;font-weight:800;border-top:2px solid #f59e0b;">
                <td style="padding:8px 10px;font-size:12px;color:#92400e;" colspan="3">TOTAL</td>
                <td style="text-align:center;padding:8px 10px;font-size:12px;color:#1e3a8a;">${((t.mFD19 || 0) + (t.mFD19_obra || 0)).toFixed(2)}m</td>
                <td style="text-align:center;padding:8px 10px;font-size:12px;color:#1e3a8a;">${((t.mFD12 || 0) + (t.mFD12_obra || 0)).toFixed(2)}m</td>
                <td style="text-align:center;padding:8px 10px;font-size:13px;color:#b45309;">${(t.mMS || 0).toFixed(2)}m</td>
                <td style="text-align:center;padding:8px 10px;font-size:13px;color:#15803d;background:#dcfce7;">${(t.mCPS || 0).toFixed(2)}m</td>
                <td style="text-align:center;padding:8px 10px;font-size:13px;color:#0369a1;background:#e0f2fe;">${mHIGHTACK_total.toFixed(2)}m</td>
              </tr>
            </tfoot>
          </table>

          </div>

          <div style="margin-top:10px;font-size:11px;color:#6b7280;line-height:1.5;">
            💡 Os multiplicadores estão em <b>Cadastro &gt; Regras e Lógicas &gt; Fita Dupla Face + Silicone</b>.
            Linhas com mais de 25% do total estão em vermelho (revisar se for excessivo).
          </div>
          </div>
        </details>
        <style>
          details[open] > summary > .fsd-arrow { transform: rotate(90deg); }
          details > summary::-webkit-details-marker { display:none; }
          details > summary { outline:none; }
          details:hover > summary { background:#fff7d6; }
        </style>
      `;
    };

    // Felipe sessao 12: rev_parede agora consolidado em UM bloco no fim
    // (commit a seguir). PRIMER unico nao depende mais de
    // _ehPrimeiroRevParede - a consolidacao adiciona 1× PRIMER se houver
    // qualquer rev_parede no orcamento.
    const blocosItens = itens.map((item, idx) => {
      let pesoFolhaTotal = 0;
      let pesoFolhaPerfis = 0;
      let pesoFolhaChapas = 0;
      let pesoFolhaEnchimento = 0;
      let pesoFolhaSubtotal = 0;
      let pesoFolhaComMargem = 0;
      try {
        const r = calcularPesoFolhaItem(item, perfisCadLevAcess) || {};
        pesoFolhaTotal       = r.peso || 0;
        pesoFolhaPerfis      = (r.detalhe && r.detalhe.perfis) || 0;
        pesoFolhaChapas      = (r.detalhe && r.detalhe.chapas) || 0;
        pesoFolhaEnchimento  = (r.detalhe && r.detalhe.enchimento) || 0;
        pesoFolhaSubtotal    = (r.detalhe && r.detalhe.subtotal) || 0;
        pesoFolhaComMargem   = (r.detalhe && r.detalhe.comMargem) || pesoFolhaTotal;
      } catch (_) {}
      // Felipe sessao 2026-08-03: 'Coloca um quadro tipo Resumo do
      // peso da porta no topo da Lev. Acessorios'.
      // Mostra a composicao do peso usado pra escolher o pivo:
      //   perfis FOLHA + chapas (categoria='porta') + enchimento (frisos)
      //   subtotal + 10% margem = peso final que o pivo precisa segurar
      const nFolhasItem = Number(item.nFolhas) || 1;
      const subtotalPorFolha = pesoFolhaSubtotal / nFolhasItem;
      const margemPorFolha   = pesoFolhaComMargem / nFolhasItem;
      const fmtKg = (n) => (Number(n) || 0).toFixed(2) + ' kg';
      const quadroPesoPorta = (item.tipo === 'porta_externa' && pesoFolhaSubtotal > 0)
        ? `
        <div style="background:#f0f9ff;border:2px solid #0284c7;border-radius:8px;padding:14px 18px;margin-bottom:14px;">
          <div style="font-weight:700;color:#075985;font-size:13px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            ⚖️ Resumo do peso da porta ${nFolhasItem > 1 ? `(${nFolhasItem} folhas — peso por folha)` : ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:6px 24px;font-size:13px;color:#1e293b;">
            <div>Peso liquido perfis (folha)</div>
            <div style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${fmtKg(pesoFolhaPerfis / nFolhasItem)}</div>
            <div>Peso liquido chapas (folha)</div>
            <div style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${fmtKg(pesoFolhaChapas / nFolhasItem)}</div>
            <div>Peso enchimento (frisos)</div>
            <div style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${fmtKg(pesoFolhaEnchimento / nFolhasItem)}</div>
            <div style="border-top:1px solid #cbd5e1;padding-top:6px;margin-top:2px;">Subtotal</div>
            <div style="border-top:1px solid #cbd5e1;padding-top:6px;margin-top:2px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;">${fmtKg(subtotalPorFolha)}</div>
            <div style="color:#92400e;">+ 10% margem de seguranca</div>
            <div style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#92400e;">${fmtKg(margemPorFolha - subtotalPorFolha)}</div>
            <div style="font-weight:800;color:#075985;font-size:14px;border-top:2px solid #0284c7;padding-top:8px;margin-top:4px;">PESO TOTAL DA PORTA (folha)</div>
            <div style="font-weight:800;color:#075985;font-size:14px;border-top:2px solid #0284c7;padding-top:8px;margin-top:4px;text-align:right;font-variant-numeric:tabular-nums;">${fmtKg(margemPorFolha)}</div>
          </div>
        </div>`
        : '';

      // Felipe sessao 2026-08: BUG - itens novos nao tem 'id' (criados
      // por novoItemPortaExterna sem id). Cache do breakdown era gravado
      // com timestamp aleatorio e o render buscava por undefined ->
      // quadro nunca aparecia. Fix: atribui _cacheKey deterministico
      // (combinacao versao + idx) que ambos lados usam.
      const cacheKey = `${versao.id || 'v?'}:${idx}`;
      item._cacheKey = cacheKey;
      const linhas = window.AcessoriosPortaExterna.calcularAcessoriosPorItem(
        item, cadAcess, { pesoFolhaTotal, pesoFolhaPerfis, pesoFolhaChapas }
      );
      // Felipe (sessao 30): "separar fechadura digital do resto dos
      // outros acessorios". 3 grupos agora:
      //   - Fab    (aplicacao=fab, sem digital)
      //   - Obra   (aplicacao=obra, sem digital)
      //   - Digital (categoria contem "Fechadura Digital", qualquer aplicacao)
      const ehDigital = (l) => String(l.categoria || '').toLowerCase().includes('fechadura digital');
      const linhasFab     = linhas.filter(l => l.aplicacao === 'fab'  && !ehDigital(l));
      const linhasObra    = linhas.filter(l => l.aplicacao === 'obra' && !ehDigital(l));
      const linhasDigital = linhas.filter(ehDigital);
      const totalFab     = linhasFab.reduce(    (s, l) => s + (Number(l.total) || 0), 0);
      const totalObra    = linhasObra.reduce(   (s, l) => s + (Number(l.total) || 0), 0);
      const totalDigital = linhasDigital.reduce((s, l) => s + (Number(l.total) || 0), 0);
      totalGeralFab     += totalFab;
      totalGeralObra    += totalObra;
      totalGeralDigital += totalDigital;

      const renderTabela = (idTab, linhasGrupo, titulo, total) => {
        if (!linhasGrupo.length) return '';

        // Felipe (sessao 09): agrupar por categoria (Fechaduras, Parafusos, etc.)
        const categorias = {};
        const ordemCat = [];
        linhasGrupo.forEach(l => {
          const cat = l.categoria || 'Outros';
          if (!categorias[cat]) { categorias[cat] = []; ordemCat.push(cat); }
          categorias[cat].push(l);
        });

        let corpo = '';
        ordemCat.forEach(cat => {
          const itens = categorias[cat];
          const subtotalCat = itens.reduce((s, l) => s + (Number(l.total) || 0), 0);
          corpo += `<tr class="lvac-cat-header">
            <td colspan="6" style="background:#eef2f7;padding:6px 10px;font-weight:700;font-size:12px;color:#1f2937;border-top:2px solid #cbd5e1;letter-spacing:0.3px;">${escapeHtml(cat)}</td>
            <td style="background:#eef2f7;padding:6px 10px;font-weight:700;font-size:11px;color:#64748b;border-top:2px solid #cbd5e1;text-align:right;">${fmtMoney(subtotalCat)}</td>
          </tr>`;
          itens.forEach(l => {
            const zerado = (Number(l.preco_un) || 0) === 0;
            const cls = zerado ? 'lvac-row-zerado' : '';
            const cod = String(l.codigo || '').toUpperCase();
            const ehFitaOuSilicone = /^PA-FITDF|^PA-DOWSIL/.test(cod);
            const btnLinhaDetalhar = ehFitaOuSilicone && item && item.id
              ? ` <button type="button"
                    onclick="event.stopPropagation(); window.FitaSiliconeDebug && window.FitaSiliconeDebug.abrir('${escapeHtml(item.id)}')"
                    style="background:#fef3c7;border:1px solid #f59e0b;color:#b45309;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;cursor:pointer;margin-left:6px;vertical-align:middle"
                    title="Ver de onde sairam os metros">
                    📊 Detalhar
                  </button>`
              : '';
            corpo += `
              <tr class="${cls}">
                <td class="num">${fmtQtd(l.qtd)}</td>
                <td><code>${escapeHtml(l.codigo)}</code></td>
                <td>${escapeHtml(l.descricao)}</td>
                <td>${escapeHtml(l.categoria)}</td>
                <td class="num">${fmtMoney(l.preco_un)}</td>
                <td class="num">${fmtMoney(l.total)}</td>
                <td>${escapeHtml(l.observacao || '')}${btnLinhaDetalhar}</td>
              </tr>`;
          });
        });
        const ehFab = titulo.includes('Fabricacao');
        const ehObra = titulo.includes('Obra');
        const corBorda = ehFab ? '#2e7d32' : ehObra ? '#1565c0' : '#7b1fa2';
        const corFundo = ehFab ? '#e8f5e9' : ehObra ? '#e3f2fd' : '#f3e5f5';
        return `
          <div class="orc-section">
            <div class="orc-section-title" style="background:${corFundo};padding:8px 12px;border-radius:4px;border-left:4px solid ${corBorda};">
              ${titulo} — Subtotal: <span style="font-weight:700;font-size:1.1em;color:${corBorda}">${fmtMoney(total)}</span>
            </div>
            <table class="lvp-table cad-table orc-acess-tab" id="${idTab}" style="table-layout:fixed;width:100%;">
              <colgroup>
                <col style="width:5%;">
                <col style="width:13%;">
                <col style="width:32%;">
                <col style="width:11%;">
                <col style="width:8%;">
                <col style="width:9%;">
                <col style="width:22%;">
              </colgroup>
              <thead>
                <tr>
                  <th class="num">Qtd</th>
                  <th>Codigo</th>
                  <th>Descricao</th>
                  <th>Categoria</th>
                  <th class="num">Preco Unit.</th>
                  <th class="num">Total</th>
                  <th>Observacao</th>
                </tr>
              </thead>
              <tbody>${corpo}</tbody>
            </table>
          </div>`;
      };


      // Felipe sessao 12: 'item 3 esta colocando como se fosse uma porta...
      // todos estao como porta'. Titulo era chumbado 'Porta Externa'. Agora
      // usa labelTipo(item.tipo) - 'Revestimento de Parede', 'Fixo Acoplado',
      // 'Porta Externa', etc. Meta tambem adapta: rev_parede usa largura_total/
      // altura_total e NAO tem folhas/modelo (e' chapa colada na parede).
      const ehRevTitulo = item.tipo === 'revestimento_parede';
      const dim = ehRevTitulo
        ? `${item.largura_total || 0} × ${item.altura_total || 0} mm`
        : `${item.largura || 0} × ${item.altura || 0} mm`;
      const meta = ehRevTitulo
        ? `${dim} · ${item.modo === 'automatico' ? 'auto' : 'manual'} · qtd ${item.quantidade || 1}`
        : `${dim} · ${item.nFolhas || 1} folha${String(item.nFolhas) === '1' ? '' : 's'} · Modelo ${item.modeloExterno || item.modeloNumero || '—'} · qtd ${item.quantidade || 1}`;
      // Felipe sessao 12: 'quando tiver multiplos permita ocultar a seta pra
      // abrir ou fechar detalhamento de cada item, vai ficar melhor comecar
      // tudo ocultado e ir abrindo so o que voce quer ver'.
      // Cada bloco de item agora e' <details> colapsavel. Por padrao FECHADO
      // - Felipe abre so' o item que quer conferir. Summary mostra titulo +
      // dimensoes + total geral pra Felipe ver tudo de relance sem abrir.
      // CSS: cursor pointer no summary, chevron rotaciona, hover destaca.
      const totalGeralItem = totalFab + totalObra + totalDigital;
      return `
        <details class="orc-item-collapse" data-item-idx="${idx}">
          <summary class="orc-item-summary">
            <span class="orc-item-summary-chevron">▶</span>
            <span class="orc-item-summary-titulo">Item ${idx + 1} — ${escapeHtml(labelTipo(item.tipo))}</span>
            <span class="orc-item-summary-meta">${meta}</span>
            <span class="orc-item-summary-total">${fmtMoney(totalGeralItem)}</span>
          </summary>
          <div class="orc-item-collapse-body">
            ${quadroPesoPorta}
            ${renderTabela(`lvac-fab-${idx}`,     linhasFab,     '🏭 Fabricacao',        totalFab)}
            ${item.tipo === 'revestimento_parede' ? '' : renderBreakdownInline(item._cacheKey || item.id)}
            ${renderTabela(`lvac-obra-${idx}`,    linhasObra,    '🚧 Obra',              totalObra)}
            ${renderTabela(`lvac-digital-${idx}`, linhasDigital, '🔐 Fechadura Digital', totalDigital)}
            <div style="background:#fff3e0;border:2px solid #e65100;border-radius:6px;padding:12px 16px;margin-top:12px;">
              <div style="font-weight:700;color:#bf360c;">
                Total deste Item — Fabricacao: <span style="color:#2e7d32">${fmtMoney(totalFab)}</span>
                · Obra: <span style="color:#1565c0">${fmtMoney(totalObra)}</span>
                · Digital: <span style="color:#7b1fa2">${fmtMoney(totalDigital)}</span>
                · <span style="font-size:1.2em;text-decoration:underline;">Geral: ${fmtMoney(totalGeralItem)}</span>
              </div>
            </div>
          </div>
        </details>`;
    }).join('');

    // R20: "TOTAL GERAL" → "Total Geral". R19: <strong> → <span>
    // Felipe (sessao 28): "ESTA MULTI ITEM? SE COLOCAR 10 PORTAS IRA
    // MULTIPLICAR POR 10? ...". RESPOSTA: SIM. Banner agora deixa claro.
    const totalUnidades = itens.reduce((s, it) => s + (Number(it.quantidade) || 1), 0);

    // Felipe sessao 12: bloco CONSOLIDADO de Revestimento de Parede.
    // 'revestimento de parede pode juntar todos o que tiverem somente em
    // um calculo, pois da muita perca as vezes um item da 10 mts mas rolo
    // de fita tem 20, entao some tudo e um unico item revestimento de
    // parede junte tudo em um so para obter rolo de fita e de hightack'.
    // Cada item rev_parede armazenou seus metros no _fitaSiliconeBreakdownCache.
    // Agora: soma metros de todos os revs do orcamento e calcula UMA vez
    // FD19+HIGHTACK. Plus 1 PRIMER global. Total adicionado ao totalGeralObra.
    let blocoRevConsolidado = '';
    let totalRevConsolidado = 0;
    const revsItens = itens.filter(it => it.tipo === 'revestimento_parede');
    if (revsItens.length > 0) {
      // Le rendimentos editaveis (mesma logica do motor)
      let RENDIMENTOS_FS;
      try {
        RENDIMENTOS_FS = (window.Regras && typeof window.Regras.getRendimentos === 'function')
          ? window.Regras.getRendimentos()
          : { fd19_rolo: 20, hightack_tubo: 8 };
      } catch(e) {
        RENDIMENTOS_FS = { fd19_rolo: 20, hightack_tubo: 8 };
      }
      const FD19_POR_ROLO     = Number(RENDIMENTOS_FS.fd19_rolo)     > 0 ? Number(RENDIMENTOS_FS.fd19_rolo)     : 20;
      const HIGHTACK_POR_TUBO = Number(RENDIMENTOS_FS.hightack_tubo) > 0 ? Number(RENDIMENTOS_FS.hightack_tubo) : 8;

      // Soma metros de FD19 e MS de TODOS os revs (cache foi populado no .map acima)
      let totFD19m = 0;
      let totMSm = 0;
      const cache = window._fitaSiliconeBreakdownCache || {};
      revsItens.forEach((it, i) => {
        // Os items rev_parede recem-processados tem _cacheKey atribuido no map.
        // Se nao tem (caso edge), pula - ja' nao consumiu material no item.
        const ck = it._cacheKey;
        if (!ck || !cache[ck]) return;
        const t = cache[ck].totais || {};
        totFD19m += Number(t.mFD19) || 0;
        totMSm   += Number(t.mMS)   || 0;
      });

      // Busca preco unitario nos cadastros
      const cadAcessLocal = Storage.scope('cadastros').get('acessorios_lista') || [];
      function precoCad(codigo) {
        const a = cadAcessLocal.find(x => String(x.codigo).toUpperCase() === codigo.toUpperCase());
        return a ? (Number(a.preco) || 0) : 0;
      }

      const linhasRev = [];
      // 1. PRIMER (1 global, sempre que tem rev no orcamento)
      const precoPrimer = precoCad('PA-PRIMER');
      linhasRev.push({
        codigo: 'PA-PRIMER',
        descricao: 'Primer Fita Dupla Face',
        qtd: 1,
        precoUnit: precoPrimer,
        total: precoPrimer * 1,
        obs: '1 unidade global pra todos os revestimentos',
      });
      // 2. FITA 19 (consolidada)
      if (totFD19m > 0) {
        const rolosFD19 = Math.ceil(totFD19m / FD19_POR_ROLO);
        const precoFD19 = precoCad('PA-FITDF 19X20X1.0');
        linhasRev.push({
          codigo: 'PA-FITDF 19X20X1.0',
          descricao: 'Fita Dupla Face 19mm',
          qtd: rolosFD19,
          precoUnit: precoFD19,
          total: precoFD19 * rolosFD19,
          obs: `${revsItens.length} rev × consolidado: ${totFD19m.toFixed(1)}m / ${FD19_POR_ROLO}m por rolo = ${rolosFD19} rolo(s)`,
        });
      }
      // 3. HIGHTACK (consolidado)
      if (totMSm > 0) {
        const tubosHT = Math.ceil(totMSm / HIGHTACK_POR_TUBO);
        const precoHT = precoCad('PA-HIGHTACK BR');
        linhasRev.push({
          codigo: 'PA-HIGHTACK BR',
          descricao: 'Fix All High Tack Branco',
          qtd: tubosHT,
          precoUnit: precoHT,
          total: precoHT * tubosHT,
          obs: `${revsItens.length} rev × consolidado: ${totMSm.toFixed(1)}m / ${HIGHTACK_POR_TUBO}m por tubo = ${tubosHT} tubo(s)`,
        });
      }
      totalRevConsolidado = linhasRev.reduce((s, l) => s + (Number(l.total) || 0), 0);
      totalGeralObra += totalRevConsolidado;

      // Felipe sessao 14 PARTE 2: Felipe pediu "PODE COLOCAR DETALHAMENTO
      // TUDO JUNTO ESTA TENDO ABA DEMAIS PRA ABRIR... NAO QUERO UMA ABA
      // PARA CADA COISA". Antes: 1 painel por rev (3 abas). Agora: UM
      // painel agregado mostrando todas as pecas de todos os revs juntos
      // com prefixo "Rev N:" pra identificar a origem.
      const breakdownsRevHtml = (() => {
        const cache = window._fitaSiliconeBreakdownCache || {};
        // Agrega: cada peca de cada rev vira uma linha, com prefixo "Rev N: "
        const todasPecas = [];
        let totFD19 = 0, totFD12 = 0, totMS = 0, totCPS = 0, totHT = 0;
        let rendsRef = null;
        revsItens.forEach((it, idxRev) => {
          const ck = it._cacheKey;
          if (!ck || !cache[ck]) return;
          const dados = cache[ck];
          if (!rendsRef) rendsRef = dados.rendimentos;
          const t = dados.totais || {};
          totFD19 += Number(t.mFD19) || 0;
          totFD12 += Number(t.mFD12) || 0;
          totMS   += Number(t.mMS)   || 0;
          totCPS  += Number(t.mCPS)  || 0;
          totHT   += (Number(t.mHIGHTACK) || 0) + (Number(t.mHIGHTACK_fab) || 0);
          (dados.breakdown || []).forEach(e => {
            todasPecas.push({
              ...e,
              origem: `Rev ${idxRev + 1}: ${e.origem || '?'}`,
            });
          });
        });
        if (!todasPecas.length) return '';
        // Ordena por contribuicao MS desc (igual renderBreakdownInline)
        todasPecas.sort((a, b) => (b.contrib?.ms || 0) - (a.contrib?.ms || 0));

        const linhasHtmlBd = todasPecas.map(e => {
          const ms = e.contrib?.ms || 0;
          const fd19 = e.contrib?.fd19 || 0;
          const fd12 = e.contrib?.fd12 || 0;
          const cps = e.contrib?.cps || 0;
          const ht = e.contrib?.hightack || 0;
          const pctMs = totMS > 0 ? (ms / totMS) * 100 : 0;
          const corDestaque = pctMs > 25 ? '#b91c1c' : pctMs > 10 ? '#b45309' : '#374151';
          const cs = 'text-align:center;padding:6px 10px;font-variant-numeric:tabular-nums;font-size:12px;';
          return `
            <tr>
              <td style="padding:6px 10px;font-weight:500;color:#1f2937;font-size:12px;">${escapeHtml(e.origem)}</td>
              <td style="${cs}color:#475569;">${(e.metros || 0).toFixed(2)}m</td>
              <td style="${cs}font-size:11px;color:#6b7280;">×${e.mult?.fd19 || 0} / ×${e.mult?.fd12 || 0} / ×${e.mult?.ms || 0} / ×${e.mult?.cps || 0} / ×${e.mult?.hightack || 0}</td>
              <td style="${cs}color:#1e3a8a;background:#eff6ff;">${fd19 > 0 ? fd19.toFixed(2) + 'm' : '—'}</td>
              <td style="${cs}color:#1e3a8a;background:#dbeafe;">${fd12 > 0 ? fd12.toFixed(2) + 'm' : '—'}</td>
              <td style="${cs}font-weight:700;color:${corDestaque};background:#fef3c7;">${ms > 0 ? ms.toFixed(2) + 'm' : '—'}${ms > 0 ? `<span style="font-size:10px;font-weight:400;color:#9ca3af;"> (${pctMs.toFixed(0)}%)</span>` : ''}</td>
              <td style="${cs}font-weight:700;color:#15803d;background:#dcfce7;">${cps > 0 ? cps.toFixed(2) + 'm' : '—'}</td>
              <td style="${cs}font-weight:700;color:#0369a1;background:#e0f2fe;">${ht > 0 ? ht.toFixed(2) + 'm' : '—'}</td>
            </tr>
          `;
        }).join('');

        return `
          <details style="margin-top:12px;background:#fffbeb;border:2px solid #f59e0b;border-radius:6px;">
            <summary style="cursor:pointer;padding:12px 16px;font-weight:700;color:#b45309;font-size:14px;list-style:none;display:flex;align-items:center;gap:10px;user-select:none;">
              <span style="display:inline-block;transition:transform 0.2s;font-size:12px;color:#b45309;" class="fsd-arrow">▶</span>
              📊 Detalhamento das Fitas e Silicone — todos os revestimentos
              <span style="margin-left:auto;font-size:11px;font-weight:500;color:#92400e;background:#fef3c7;padding:3px 10px;border-radius:12px;">
                ${totFD19.toFixed(1)}m fita + ${totMS.toFixed(1)}m hightack · ${revsItens.length} rev${revsItens.length>1?'s':''}
              </span>
            </summary>
            <div style="padding:0 16px 16px 16px;border-top:1px solid #fde68a;margin-top:4px;">
              <div style="margin:14px 0;">
                <table style="border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;width:100%;">
                  <thead>
                    <tr style="background:#1f2937;color:#fff;">
                      <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;">Peça (com origem)</th>
                      <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;white-space:nowrap;">Metros</th>
                      <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;white-space:nowrap;">Mult. (19/12/995/CPS/HT)</th>
                      <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#1e3a8a;white-space:nowrap;">FD 19mm</th>
                      <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#1e40af;white-space:nowrap;">FD 12mm</th>
                      <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#b45309;white-space:nowrap;">Silicone</th>
                      <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#15803d;white-space:nowrap;">CPS BR</th>
                      <th style="text-align:center;padding:8px 10px;font-size:11px;font-weight:700;background:#0369a1;white-space:nowrap;">HIGHTACK</th>
                    </tr>
                  </thead>
                  <tbody>${linhasHtmlBd}</tbody>
                  <tfoot>
                    <tr style="background:#fef3c7;font-weight:800;border-top:2px solid #f59e0b;">
                      <td style="padding:8px 10px;font-size:12px;color:#92400e;" colspan="3">TOTAL CONSOLIDADO</td>
                      <td style="text-align:center;padding:8px 10px;font-size:12px;color:#1e3a8a;">${totFD19.toFixed(2)}m</td>
                      <td style="text-align:center;padding:8px 10px;font-size:12px;color:#1e3a8a;">${totFD12.toFixed(2)}m</td>
                      <td style="text-align:center;padding:8px 10px;font-size:13px;color:#b45309;">${totMS.toFixed(2)}m</td>
                      <td style="text-align:center;padding:8px 10px;font-size:13px;color:#15803d;background:#dcfce7;">${totCPS.toFixed(2)}m</td>
                      <td style="text-align:center;padding:8px 10px;font-size:13px;color:#0369a1;background:#e0f2fe;">${totHT.toFixed(2)}m</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style="font-size:11px;color:#6b7280;line-height:1.5;">
                💡 Multiplicadores em <b>Cadastro &gt; Regras e Lógicas &gt; Fita Dupla Face + Silicone</b>.
                Linhas com mais de 25% do total Silicone destacadas em vermelho.
              </div>
            </div>
          </details>`;
      })();

      // HTML do bloco
      const linhasHtml = linhasRev.map(l => `
        <tr>
          <td class="num">${fmtBR(l.qtd)}</td>
          <td><code>${escapeHtml(l.codigo)}</code></td>
          <td>${escapeHtml(l.descricao)}</td>
          <td>Selantes</td>
          <td class="num">${fmtMoney(l.precoUnit)}</td>
          <td class="num"><b>${fmtMoney(l.total)}</b></td>
          <td><span style="color:#666;font-size:12px;">${escapeHtml(l.obs)}</span></td>
        </tr>
      `).join('');

      blocoRevConsolidado = `
        <details class="orc-item-collapse" data-item-idx="rev-consolidado" open>
          <summary class="orc-item-summary" style="background:linear-gradient(180deg,#e0f2fe,#bae6fd);">
            <span class="orc-item-summary-chevron">▶</span>
            <span class="orc-item-summary-titulo">📦 Revestimento de Parede — Consolidado</span>
            <span class="orc-item-summary-meta">${revsItens.length} item${revsItens.length>1?'s':''} · ${totFD19m.toFixed(1)}m fita · ${totMSm.toFixed(1)}m hightack</span>
            <span class="orc-item-summary-total">${fmtMoney(totalRevConsolidado)}</span>
          </summary>
          <div class="orc-item-collapse-body">
            <div class="info-banner" style="margin-bottom:10px;">
              <span class="t-strong">Por que consolidado?</span>
              Felipe sessao 12: 'as vezes um item da 10 mts mas rolo de fita tem 20'.
              Somar metros de TODOS os revs e calcular rolos/tubos UMA vez reduz
              arredondamento e perda. Material vai pra OBRA (instalado na obra).
            </div>
            <table class="cad-table">
              <thead>
                <tr>
                  <th class="num">Qtd</th>
                  <th>Codigo</th>
                  <th>Descricao</th>
                  <th>Categoria</th>
                  <th class="num">Preco Unit.</th>
                  <th class="num">Total</th>
                  <th>Observacao</th>
                </tr>
              </thead>
              <tbody>
                ${linhasHtml}
              </tbody>
            </table>
            ${breakdownsRevHtml}
            <div style="background:#fff3e0;border:2px solid #e65100;border-radius:6px;padding:12px 16px;margin-top:12px;">
              <div style="font-weight:700;color:#bf360c;">
                Subtotal Consolidado Revestimento (Obra): <span style="font-size:1.2em;text-decoration:underline;">${fmtMoney(totalRevConsolidado)}</span>
              </div>
            </div>
          </div>
        </details>`;
    }

    container.innerHTML = `
      ${bannerCaracteristicasItens(versao)}
      ${itens.length >= 2 ? `<div class="info-banner orc-banner-aviso">
        <span class="t-strong">Levantamento de Acessorios — Multi-Item</span><br>
        <b>${itens.length}</b> tipo(s) de Porta Externa, totalizando <b>${totalUnidades}</b> unidade(s).
        Quantidade de cada acessorio e' multiplicada pela qtd do item.
      </div>` : ''}
      ${itens.length >= 2 ? `
      <div class="orc-item-toolbar">
        <button type="button" class="btn-secondary" data-act="expand-all">▼ Expandir todos</button>
        <button type="button" class="btn-secondary" data-act="collapse-all">▶ Recolher todos</button>
      </div>` : ''}
      ${blocosItens}
      ${blocoRevConsolidado}
      ${itens.length >= 2 ? `
      <div style="background:linear-gradient(135deg,#1a3a5c,#2a5a8c);border-radius:8px;padding:16px 20px;margin-top:16px;color:#fff;">
        <div style="font-weight:700;font-size:1.1em;">Total Geral (${itens.length} itens · ${totalUnidades} unid.)</div>
        <div style="margin-top:8px;">
          Fabricacao: <span style="font-weight:700;font-size:1.2em;color:#a5d6a7;">${fmtMoney(totalGeralFab)}</span>
          · Obra: <span style="font-weight:700;font-size:1.2em;color:#90caf9;">${fmtMoney(totalGeralObra)}</span>
          · <span style="font-weight:700;font-size:1.4em;color:#ffeb3b;">Geral: ${fmtMoney(totalGeralFab + totalGeralObra)}</span>
        </div>
      </div>` : ''}
    `;

    // Felipe sessao 12: botoes expandir/recolher todos os items.
    const btnExpandAll = container.querySelector('[data-act="expand-all"]');
    if (btnExpandAll) {
      btnExpandAll.addEventListener('click', () => {
        container.querySelectorAll('details.orc-item-collapse').forEach(d => d.open = true);
      });
    }
    const btnCollapseAll = container.querySelector('[data-act="collapse-all"]');
    if (btnCollapseAll) {
      btnCollapseAll.addEventListener('click', () => {
        container.querySelectorAll('details.orc-item-collapse').forEach(d => d.open = false);
      });
    }

    // R18: aplica autoEnhance em todas as tabelas (filtro + sort)
    if (window.Universal && window.Universal.autoEnhance) {
      container.querySelectorAll('table.cad-table').forEach(tbl => {
        try {
          window.Universal.autoEnhance(tbl);
        } catch (e) {
          console.warn('[lev-acessorios] autoEnhance falhou:', e);
        }
      });
    }

    adicionarBotaoWizard(container, 'lev-acessorios');
  }

  // ============================================================
  //                      OUTRAS ABAS (placeholder)
  // ============================================================
  function renderPlaceholderTab(container, tabId) {
    container.innerHTML = `
      <div class="info-banner">
        <span class="t-strong">Aba "${escapeHtml(tabId)}" sera implementada em breve.</span>
        O banco de dados ja esta preparado e isolado nas demais abas.
      </div>
      <div class="placeholder">
        <div class="icon-big">⚙️</div>
        <h3>Em construcao</h3>
        <p>Modulo Orcamento — aba <code>${escapeHtml(tabId)}</code></p>
      </div>
    `;
    // Felipe: tambem adiciona "Proximo" pra abas placeholder
    // (lev-acessorios, lev-superficies) — pra usuario poder avancar
    adicionarBotaoWizard(container, tabId);
  }

  // Felipe (do doc - msg wizard): helpers privados pro modulo Wizard.
  // Le e atualiza versao.wizardEtapaMaxima.
  function _getVersaoAtivaWizard() {
    if (!UI || !UI.versaoAtivaId) return null;
    const r = obterVersao(UI.versaoAtivaId);
    return r ? r.versao : null;
  }
  function _setWizardEtapa(novaEtapa) {
    if (!UI || !UI.versaoAtivaId) return;
    atualizarVersao(UI.versaoAtivaId, { wizardEtapaMaxima: novaEtapa });
  }

  // -------------------------------------------------------------------
  // Felipe (sessao 2026-11): geracao de Blobs pra OrcDocs
  // -------------------------------------------------------------------

  /**
   * Resolve todos os dados pro render dos relatorios. Mesma logica
   * do renderRelatoriosTab, mas reutilizavel offscreen.
   */
  function _resolverDadosRelatorio(versaoId) {
    const r = obterVersao(versaoId);
    if (!r || !r.versao) throw new Error('versao nao encontrada: ' + versaoId);
    const versao  = r.versao;
    const opcao   = r.opcao;
    const negocio = r.negocio;

    // Calcula DRE (mesmos numeros das abas DRE/Proposta)
    _sincronizarSubFabInst(versao);
    const subFab  = Number(versao.subFab)  || 0;
    const subInst = Number(versao.subInst) || 0;
    const params  = Object.assign({}, PARAMS_DEFAULT, versao.parametros || {});
    const dre     = calcularDRE(subFab, subInst, params);

    // Lead: prefere o do negocio, fallback lerLeadAtivo
    let lead = null;
    try {
      const crmStore = (typeof Storage !== 'undefined' && Storage.scope) ? Storage.scope('crm') : null;
      const cards = crmStore ? (crmStore.get('crmCards') || crmStore.get('leads') || []) : [];
      lead = cards.find(c => c && c.id === negocio.leadId) || null;
    } catch (_) { /* fallback abaixo */ }
    if (!lead) lead = lerLeadAtivo() || {};

    const fmtMoney = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtMoneyM2 = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '/m²';
    const fmtPct = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';

    const cliente = lead.cliente || (negocio?.clienteNome) || '—';
    const agp     = lead.numeroAGP || '—';
    const reserva = lead.numeroReserva || '—';

    return { versao, opcao, negocio, lead, dre, params, fmtMoney, fmtMoneyM2, fmtPct, cliente, agp, reserva };
  }

  /**
   * Renderiza um painel de relatorio em host offscreen e retorna o
   * elemento DOM. Caller deve chamar removerHost() apos uso.
   *
   * subAba: 'comercial' | 'resultado-porta' | 'dre' | 'obra'
   */
  function _montarHostOffscreen(versaoId, subAba) {
    const d = _resolverDadosRelatorio(versaoId);
    let html = '';
    if (subAba === 'comercial') {
      html = renderRelComercial(d.versao, d.opcao, d.lead, d.negocio, d.dre, d.params,
                                d.cliente, d.agp, d.reserva, d.fmtMoney, d.fmtMoneyM2, d.fmtPct);
    } else if (subAba === 'resultado-porta') {
      html = renderRelResultadoPorta(d.versao, d.dre, d.params, d.fmtMoney, d.fmtPct);
    } else if (subAba === 'dre') {
      html = renderRelDRE(d.versao, d.dre, d.params, d.fmtMoney, d.fmtPct);
    } else if (subAba === 'obra') {
      html = renderRelObra(d.versao, d.dre, d.fmtMoney);
    } else {
      throw new Error('subAba invalida: ' + subAba);
    }

    // Header empresa (se modulo Empresa carregado)
    const numVersao = d.versao.numero || 1;
    const numeroDoc = `V${numVersao}`;
    const headerEmpresaHtml = (window.Empresa && window.Empresa.montarHeaderRelatorio)
      ? window.Empresa.montarHeaderRelatorio({
          lead: d.lead, numeroDoc, dataDoc: nowIso(),
          tituloDoc: subAba === 'comercial' ? 'Painel Comercial' :
                     subAba === 'resultado-porta' ? 'Resultado por Porta' :
                     subAba === 'dre' ? 'DRE Resumida' : 'Resumo da Obra',
        })
      : '';

    const host = document.createElement('div');
    host.style.cssText = `
      position: absolute; top: 0; left: -10000px;
      width: 1100px; background: #ffffff; padding: 20px;
      z-index: -1; font-family: inherit;
    `;
    host.innerHTML = `${headerEmpresaHtml}<div class="rel-pane">${html}</div>`;
    document.body.appendChild(host);
    return host;
  }

  /**
   * Gera PNG Blob de um relatorio.
   *   versaoId: id da versao
   *   subAba:   'comercial' | 'resultado-porta' | 'dre' | 'obra'
   * Retorna Promise<Blob>.
   */
  async function gerarRelatorioPNGBlob(versaoId, subAba) {
    let host = null;
    try {
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      const html2canvas = window.html2canvas;
      if (!html2canvas) throw new Error('html2canvas nao carregou');

      host = _montarHostOffscreen(versaoId, subAba);
      // Aguarda fonts/imgs renderizarem
      await new Promise(r => setTimeout(r, 200));

      const canvas = await html2canvas(host, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth:  host.scrollWidth,
        windowHeight: host.scrollHeight,
      });

      return await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
    } finally {
      if (host && host.parentNode) host.parentNode.removeChild(host);
    }
  }

  /**
   * Gera PDF Blob da Proposta Comercial — concatenando os 4 paineis em
   * paginas separadas (1 por pagina A4). Cada painel ja vem formatado.
   */
  async function gerarPropostaPDFBlob(versaoId) {
    await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const html2canvas = window.html2canvas;
    const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!html2canvas || !jsPDF) throw new Error('libs nao carregaram');

    const subAbas = ['comercial', 'resultado-porta', 'dre', 'obra'];
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const maxW = pageW - 2 * margin;
    const maxH = pageH - 2 * margin;

    let primeiraPagina = true;
    for (const subAba of subAbas) {
      let host = null;
      try {
        host = _montarHostOffscreen(versaoId, subAba);
        await new Promise(r => setTimeout(r, 200));
        const canvas = await html2canvas(host, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          windowWidth:  host.scrollWidth,
          windowHeight: host.scrollHeight,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        // Calcula tamanho proporcional cabendo na pagina
        const ratio = canvas.width / canvas.height;
        let drawW = maxW;
        let drawH = maxW / ratio;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = maxH * ratio;
        }
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        if (!primeiraPagina) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', x, y, drawW, drawH);
        primeiraPagina = false;
      } finally {
        if (host && host.parentNode) host.parentNode.removeChild(host);
      }
    }

    // Retorna Blob
    return pdf.output('blob');
  }

  /**
   * Felipe (sessao 2026-08): Gera PDF da PROPOSTA COMERCIAL (cliente
   * final) em separado do "PDF agregado interno" (que junta os 4 paineis
   * comerciais com DRE/custos).
   *
   * Estrategia: renderiza renderPropostaTab(container) numa div offscreen
   * com UI.versaoAtivaId/UI.negocioAtivoId temporariamente fixados. Pega
   * cada .rel-prop-pagina e converte com html2canvas em paginas A4.
   *
   * Reuso de renderPropostaTab garante que o PDF da Proposta Comercial e'
   * IDENTICO ao que o usuario ve na aba "Proposta Comercial" do orcamento,
   * incluindo todas as formatacoes, banners, tabelas, totais e assinaturas.
   *
   * NAO mexe em: gerarPropostaPDFBlob (atual, gera dossie agregado),
   * gerarRelatorioPNGBlob (4 PNGs internos), exportarPropostaPDF (botao
   * Exportar PDF da propria aba).
   */
  async function gerarPropostaComercialPDFBlob(versaoId) {
    // 1. Resolve negocio/versao a partir do versaoId
    const r = obterVersao(versaoId);
    if (!r || !r.versao) throw new Error('versao nao encontrada: ' + versaoId);
    const negocioId = r.negocio.id;

    // 2. Salva UI atual e seta pra essa versao temporariamente
    const UIversaoOrig  = UI.versaoAtivaId;
    const UInegocioOrig = UI.negocioAtivoId;

    let host = null;
    try {
      // 3. Carrega libs em paralelo com criar host
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const html2canvas = window.html2canvas;
      const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!html2canvas || !jsPDF) throw new Error('libs html2canvas/jsPDF nao carregaram');

      // 4. Cria host offscreen na largura A4 96dpi (~794px - mesma usada
      //    em exportarPropostaPDF pra garantir layout identico)
      host = document.createElement('div');
      host.style.cssText = `
        position: absolute;
        top: 0;
        left: -10000px;
        width: 794px;
        background: #ffffff;
        z-index: -1;
      `;
      document.body.appendChild(host);

      // 5. Seta UI pra versao alvo e renderiza renderPropostaTab dentro do host
      UI.versaoAtivaId  = versaoId;
      UI.negocioAtivoId = negocioId;
      renderPropostaTab(host);

      // 6. Aguarda fontes/imagens (banners, modelos de porta) renderizarem
      await new Promise(rs => setTimeout(rs, 350));

      // 7. Pega cada pagina .rel-prop-pagina (renderPropostaTab pode gerar
      //    1+ paginas dependendo de quantos itens)
      const paginas = host.querySelectorAll('.rel-prop-pagina');
      if (!paginas.length) throw new Error('Nenhuma .rel-prop-pagina encontrada na proposta');

      // 8. Monta PDF A4 — mesma logica de exportarPropostaPDF
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();    // 210mm
      const pageH = pdf.internal.pageSize.getHeight();   // 297mm

      // Felipe sessao 14: empilha capturas curtas na mesma pagina A4 do PDF
      // (corta espacos brancos enormes quando chunk tem poucos cards).
      // scale=1.7 + JPEG 0.92 mantidos pra reduzir tamanho do PDF anexo do
      // email (~4MB limite Microsoft Graph).
      await _paginarCapturasPDFEmpilhadas(pdf, paginas, html2canvas, {
        scale: 1.7, formato: 'jpeg', qualidade: 0.92, pageW, pageH,
      });

      return pdf.output('blob');
    } finally {
      // 9. SEMPRE restaura UI e limpa host (mesmo em erro)
      if (host && host.parentNode) host.parentNode.removeChild(host);
      UI.versaoAtivaId  = UIversaoOrig;
      UI.negocioAtivoId = UInegocioOrig;
    }
  }

  return {
    // ciclo do App
    render,
    // API publica pra outros modulos
    criarNegocio,
    obterNegocioPorLeadId,
    resumoParaCardCRM,
    obterNegocio,
    obterOpcao,
    obterVersao,
    listarNegocios,
    listarOpcoes,
    listarVersoes,
    criarOpcao,
    criarVersao,
    criarNovaVersao,
    atualizarVersao,
    fecharVersao,
    destravarVersao,
    deletarVersao,
    deletarNegocio,
    // Felipe (sessao 2026-11): geracao de Blobs pra OrcDocs
    gerarRelatorioPNGBlob,
    gerarPropostaPDFBlob,
    // Felipe (sessao 2026-08): nova - PDF Proposta Comercial separado
    gerarPropostaComercialPDFBlob,
    // Felipe sessao 18: 'fiz uma versao 2, saiu versao 2 no pdf otimo
    // isso, mas a descricao quando foi salvar o nome arquivo saiu v1
    // em vez de v2'. resumoParaCardCRM ordena por status imutavel ->
    // se V1 estiver aprovada e V2 em draft, retorna V1. OrcDocs deve
    // preferir a versao ATIVA aberta (mesma que gera o PDF), caindo
    // pra resumoParaCardCRM so' como fallback.
    obterVersaoAtivaParaDocs: function(leadId) {
      try {
        // Se ha versao ativa no UI, valida que pertence ao lead
        if (UI && UI.versaoAtivaId) {
          const r = obterVersao(UI.versaoAtivaId);
          if (r && r.versao && r.negocio && r.negocio.leadId === leadId) {
            return { id: r.versao.id, numero: r.versao.numero };
          }
        }
      } catch(_) {}
      return null;
    },
    // helpers expostos pra debugging
    _snapshotPrecosAtual: snapshotPrecosAtual,
    _snapshotPrecosCompleto: snapshotPrecosCompleto,
    _letraOpcao: letraOpcao,
    // wizard
    _getVersaoAtivaWizard,
    _setWizardEtapa,
    // Felipe sessao 12: pra wizard (tabLiberada) saber se a versao
    // atual eh imutavel. Em modo memorial, libera todas as abas pra
    // navegacao/consulta sem permitir edicao (CSS .is-orc-readonly cuida).
    versaoAtualEhImutavel: function() {
      try {
        const v = versaoAtiva();
        return !!(v && versaoEhImutavel(v));
      } catch(_) { return false; }
    },
    // Felipe (sessao 2026-09): manutencao de storage on-demand.
    // Uso no console: Orcamento.manutencao.relatorio()  ou  .limparSnapshotsDrafts()
    manutencao: {
      relatorio() {
        const ng = loadAll();
        let drafts = 0, fechadas = 0, snapsLeves = 0, snapsPesados = 0;
        ng.forEach(n => (n.opcoes || []).forEach(o => (o.versoes || []).forEach(v => {
          if (v.status === 'fechada') fechadas++; else drafts++;
          if (v.precos_snapshot && v.precos_snapshot.acessorios) snapsPesados++;
          if (v.precos_snapshot && v.precos_snapshot.pendente) snapsLeves++;
        })));
        const tam = (localStorage.getItem('projetta:orcamentos:negocios') || '').length;
        const r = { negocios: ng.length, drafts, fechadas, snapsLeves, snapsPesados,
                     tamanhoKB: (tam / 1024).toFixed(0) };
        console.table(r);
        return r;
      },
      limparSnapshotsDrafts() {
        const ng = loadAll();
        let n = 0;
        ng.forEach(neg => (neg.opcoes || []).forEach(o => (o.versoes || []).forEach(v => {
          if (v.status !== 'fechada' && v.precos_snapshot && v.precos_snapshot.acessorios) {
            v.precos_snapshot = { pendente: true, tiradoEm: v.precos_snapshot.tiradoEm || nowIso() };
            n++;
          }
        })));
        if (n > 0) saveAll(ng);
        console.log(`Limpou ${n} snapshots de drafts.`);
        return n;
      },
    },
  };
})();

// Registra no App
if (typeof App !== 'undefined' && App.register) {
  App.register('orcamento', { render: Orcamento.render });
}

// Expoe pra outros modulos consumirem (CRM em particular, na Etapa 5)
window.Orcamento = Orcamento;
