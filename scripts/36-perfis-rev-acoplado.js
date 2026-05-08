/* 36-perfis-rev-acoplado.js — Motor FIXO ACOPLADO
   FONTE: Planilha Pasta1.xlsx aba "FIXO ACOPLADO PORTA SUPERIOR"

   VARIAVEIS:
     TUB1:  PA006=38  PA007=51
     FGLD:  10        FGLE: 10

   PERFIL ALTURA        76x38/101x51   ALTURA                          qty=2
   PERFIL LARGURA       76x38/101x51   LARGURA-FGLD-FGLE               qty=2
   TRAVESSA VERTICAL    76x38/101x51   ALTURA-2*TUB1                   qty=da porta ou 0
   TRAVESSA HORIZONTAL  76x38/101x51   LARGURA-FGLD-FGLE-2*TUB1        qty=1o digito altura
   FRISO VERTICAL       76x76/101x101  ALTURA-2*TUB1                   qty=da porta ou 0
   FRISO HORIZONTAL     76x76/101x101  LARGURA-FGLD-FGLE-2*TUB1        qty=manual(0)
   CAVA                 38x38          ALTURA-2*TUB1-30                 qty=da porta ou 0
   CANTONEIRA CAVA      30x30          ALTURA-2*TUB1                   qty=da porta ou 0
*/

var PerfisRevAcoplado = (function() {

  // Constantes por sistema (Pasta1.xlsx)
  var SIS = {
    PA006: { TUB1: 38, FGLD: 10, FGLE: 10, perfil: 'PA-76X38X1.98', friso: 'PA-76X76X2.0' },
    PA007: { TUB1: 51, FGLD: 10, FGLE: 10, perfil: 'PA-101X51X2',   friso: 'PA-101X101X2.5' },
  };
  var COD_CAVA       = 'PA-38X38X1.58';
  var COD_CANTONEIRA = 'PA-CANT-30X30X2.0';

  function ehFixoValido(item) {
    return !!(item && item.tipo === 'fixo_acoplado'
      && Number(item.largura) > 0
      && Number(item.altura)  > 0);
  }

  function getSis(item) {
    var k = String(item.sistema || 'PA006').toUpperCase();
    return SIS[k] || SIS.PA006;
  }

  // Le porta principal do orcamento (item anterior ao fixo)
  function obterPortaPrincipal() {
    try {
      var v = window._versaoAtivaParaFixo;
      if (v && v.itens) {
        for (var i = 0; i < v.itens.length; i++) {
          if (v.itens[i] && v.itens[i].tipo === 'porta_externa') return v.itens[i];
        }
      }
    } catch (_) {}
    return null;
  }

  // Qtd travessa vertical da porta
  function qtdTravVertPorta(porta) {
    if (!porta) return 0;
    try {
      var fn = window.PerfisPortaExterna && window.PerfisPortaExterna.travessasVerticais;
      if (!fn) return 0;
      var tv = fn({
        largura: Number(porta.largura) || 0,
        modeloNumero: Number(porta.modeloNumero) || 0,
        modeloNome: String(porta.modeloNome || ''),
        nFolhas: 1,
        distBordaFriso: Number(porta.distanciaBordaFrisoVertical) || 0,
      }) || {};
      return Number(tv.qtyTotal) || 0;
    } catch (_) { return 0; }
  }

  // Qtd cava da porta (0, 2 ou 4)
  function qtdCavaPorta(porta) {
    if (!porta) return 0;
    try {
      var motor = window.PerfisPortaExterna || {};
      var nome = String(porta.modeloNome || '');
      var num  = Number(porta.modeloNumero) || 0;
      if (motor.temCava && !motor.temCava(nome, num)) return 0;
      if (!motor.temCava) return 0;
      var ehDupla = motor.temCavaDupla ? motor.temCavaDupla(nome, num) : false;
      return ehDupla ? 4 : 2;
    } catch (_) { return 0; }
  }

  // Qtd friso vertical da porta
  function qtdFrisoVertPorta(porta) {
    return Number(porta && porta.quantidadeFrisos) || 0;
  }

  // ═══════════════════════════════════════════════════
  // MOTOR PRINCIPAL — formulas da planilha Pasta1.xlsx
  // ═══════════════════════════════════════════════════
  function gerarCortes(item) {
    if (!ehFixoValido(item)) return {};
    if (item.temEstrutura === 'nao') return {};

    var LARGURA = Number(item.largura) || 0;
    var ALTURA  = Number(item.altura)  || 0;
    var s    = getSis(item);
    var TUB1 = s.TUB1;

    // Felipe sessao 13: folgas EDITAVEIS POR ITEM. Default 10mm vem
    // de getSis() (PA006/PA007). Override no item: fglDir/fglEsq.
    // Vazio = usa default. Mesma logica da porta externa.
    function _fg(raw, fb) {
      if (raw === '' || raw === null || raw === undefined) return fb;
      var n = Number(String(raw).replace(',', '.'));
      return (isFinite(n) && n >= 0) ? n : fb;
    }
    var FGLD = _fg(item.fglDir, s.FGLD);
    var FGLE = _fg(item.fglEsq, s.FGLE);
    // Felipe sessao 13: 'perfil da altura nao esta entrando a folga de
    // 10mm da altura'. FGSup (folga superior) descontada do Perfil Altura.
    // Default 10mm. Vazio no item = usa default.
    var FGSup = _fg(item.fgSup, 10);

    // Felipe sessao 13: 'qualquer motor que va pra perfil que va pra
    // chapa que va para acessorios qualquer motor se eu colocar
    // quantidade vezes 2 tem que multiplicar por 2'. Aplicado tambem
    // aqui em gerarCortes — antes cada add() passava qty FIXO (2)
    // sem considerar item.quantidade. 2 fixos = 2x cortes (e nao 1x).
    // Mesma logica dos motores da porta (38-chapas, 31-perfis,
    // 28-acessorios) que ja' faziam isso.
    var qtdItem = Math.max(1, parseInt(item.quantidade, 10) || 1);

    var cortes = {};
    function add(codigo, comp, qty, label) {
      if (!codigo || comp <= 0 || qty <= 0) return;
      if (!cortes[codigo]) cortes[codigo] = [];
      cortes[codigo].push({ comp: Math.round(comp), qty: qty * qtdItem, label: label });
    }

    // ── Formulas Pasta1.xlsx ──
    var compAltura   = ALTURA - FGSup;                     // PERFIL ALTURA (desconta folga superior)
    var compLargura  = LARGURA - FGLD - FGLE;              // PERFIL LARGURA (caso normal)
    var compTravVert = ALTURA - 2 * TUB1;                  // TRAV VERT + FRISO VERT + CANTONEIRA
    var compTravHor  = LARGURA - FGLD - FGLE - 2 * TUB1;  // TRAV HOR + FRISO HOR
    var compCava     = ALTURA - 2 * TUB1 - 30;             // CAVA 38x38

    // ── PERFIL ALTURA: sempre presente (quadro) ──
    add(s.perfil, compAltura, 2, 'Perfil Altura');         // 76x38 ou 101x51

    // Felipe sessao 13: detecta FIXO LATERAL COM VIDRO. Esse caso NAO
    // tem travessa vertical, horizontal, friso, ou cava. E a formula
    // do PERFIL LARGURA muda — desconta tambem 2*TUB1 (38 ou 51).
    // Adiciona 2 perfis estruturais novos do vidro (PA-PF-104, PA-PF-051)
    // com cortes encaixados DENTRO do quadro.
    // PA-GUA411 e PA-GUA413 vao como acessorios (em metros) em
    // 28-acessorios-porta-externa.js.
    var ehLateralVidro = (
      String(item.posicao || '').toLowerCase() === 'lateral'
      && String(item.revestimento || '').toLowerCase() === 'vidro'
    );

    if (ehLateralVidro) {
      // Felipe: 'no fixo lateral teremos somente UMA folga lateral
      // de 10mm e nao 20'. Como o sistema tem 2 campos (Dir/Esq),
      // usa a SOMA — Felipe preenche 10/0 ou 0/10 conforme o lado
      // que encosta na porta. O outro fica zero (encosta).
      var FGL_total = FGLD + FGLE;
      // Perfil Largura no fixo lateral c/ vidro:
      //   L - FOLGA_LATERAL - 2*TUB1
      //   PA006 (TUB1=38): L - FGL - 76
      //   PA007 (TUB1=51): L - FGL - 102
      var compPerfilLarguraVidro = LARGURA - FGL_total - 2 * TUB1;
      // PA-PF (vertical): altura interna = H - 2*TUB1
      // PA-PF (vertical): altura interna entre os 2 Perfis Largura.
      // Usa compAltura (= ALTURA - FGSup), nao ALTURA crua, pra ficar
      // consistente com o Perfil Altura ja' descontado da folga superior.
      var compAlturaInterna = compAltura - 2 * TUB1;

      // Perfil Largura usa formula NOVA (com -2*TUB1)
      add(s.perfil, compPerfilLarguraVidro, 2, 'Perfil Largura');

      // 2 perfis estruturais do vidro:
      //   horizontal = mesmo tamanho do Perfil Largura (encaixa entre alturas)
      //   vertical   = altura interna (H - 2*TUB1)
      ['PA-PF-104', 'PA-PF-051'].forEach(function(cod) {
        add(cod, compPerfilLarguraVidro, 2, cod + ' (horizontal)');
        add(cod, compAlturaInterna,      2, cod + ' (vertical)');
      });

      // SAI antes de gerar travessas/frisos/cava — fixo lateral c/ vidro
      // nao tem nenhum desses.
      return cortes;
    }

    // ── PERFIL LARGURA (caso normal — sem vidro lateral) ──
    add(s.perfil, compLargura, 2, 'Perfil Largura');       // 76x38 ou 101x51

    // ── TRAVESSA HORIZONTAL: 1o digito da ALTURA ──
    // Planilha: "PRIMEIRO NUMERO DA ALTURA = EX 3634 = 3 TRAVESSAS"
    var qtdTH = Math.floor(ALTURA / 1000) || 0;
    if (qtdTH > 0) {
      add(s.perfil, compTravHor, qtdTH, 'Travessa Horizontal');
    }

    // ── CONDICIONAIS: herdam da porta se fixoSegueModelo=sim ──
    var segueModelo = item.fixoSegueModelo === 'sim';
    var porta = segueModelo ? obterPortaPrincipal() : null;

    // TRAVESSA VERTICAL (76x38 / 101x51)
    // Planilha: "MESMA QTD DA TRAVESSA QUE TIVER NA PORTA"
    var qtdTV = segueModelo ? qtdTravVertPorta(porta) : 0;
    if (qtdTV > 0) {
      add(s.perfil, compTravVert, qtdTV, 'Travessa Vertical');
    }

    // FRISO VERTICAL (76x76 / 101x101)
    // Planilha: "MESMA QTD DO FRISO VERTICAL QUE TIVER NA PORTA"
    var qtdFV = segueModelo ? qtdFrisoVertPorta(porta) : 0;
    if (qtdFV > 0) {
      add(s.friso, compTravVert, qtdFV, 'Friso Vertical');
    }

    // FRISO HORIZONTAL (76x76 / 101x101)
    // Planilha: "MANUAL" — default 0, usuario edita no Lev. Perfis

    // CAVA 38x38 + CANTONEIRA 30x30
    // Planilha: "MESMA QTD QUE TIVER NA PORTA"
    var qtdCv = segueModelo ? qtdCavaPorta(porta) : 0;
    if (qtdCv > 0) {
      add(COD_CAVA,       compCava,     qtdCv,     'Tubo Cava');
      add(COD_CANTONEIRA, compTravVert, qtdCv * 2, 'Cantoneira Cava');
    }

    return cortes;
  }

  // ═══════════════════════════════════════════════════
  // CHAPAS (reusa motor da porta com item virtual)
  // ═══════════════════════════════════════════════════
  // Felipe (sessao 12): altura efetiva da chapa do fixo cobre o quadro
  // do fixo + tubo do portal da porta + reforco. Por isso o motor de
  // chapas da porta recebe H = altura_fixo + TUBLPORTAL + REF.
  //   TUBLPORTAL = 38 (PA006/'76') ou 51 (PA007/'101') — espelha
  //                VARS_FAM_DEFAULT.TUBLPORTAL em 38-chapas-porta-externa.js
  //   REF        = 20 — espelha VARS_CHAPAS_DEFAULT.REF
  var TUBLPORTAL_BY_FAM = { '76': 38, '101': 51 };
  var REF_CHAPA = 20;

  function criarItemVirtualChapas(item) {
    if (!ehFixoValido(item)) return null;
    var segueModelo = item.fixoSegueModelo === 'sim';
    var porta = segueModelo ? obterPortaPrincipal() : null;
    var fonte = porta || item;
    var fam = String(item.sistema || 'PA006') === 'PA007' ? '101' : '76';
    var tublportal = TUBLPORTAL_BY_FAM[fam] || 38;
    var alturaEfetiva = Number(item.altura) + tublportal + REF_CHAPA;

    var modeloNum = segueModelo && porta ? Number(porta.modeloNumero) || 1 : Number(item.modeloNumero) || 1;
    var modeloNome = segueModelo && porta ? String(porta.modeloNome || '') : 'Liso';

    // Felipe sessao 12: cor herdada da porta quando segueModelo, com
    // fallback pro item do fixo (caso usuario tenha setado direto).
    // Sem isso o motor de chapas retornava p.cor='' e peso ficava 0.
    var corExt  = (segueModelo && porta && porta.corExterna) ? String(porta.corExterna).trim() : String(item.corExterna || '').trim();
    var corInt  = (segueModelo && porta && porta.corInterna) ? String(porta.corInterna).trim() : String(item.corInterna || '').trim();
    var corCava = (segueModelo && porta && porta.corCava)    ? String(porta.corCava).trim()    : String(item.corCava    || '').trim();

    return {
      tipo: 'porta_externa',
      quantidade: 1,
      largura: Number(item.largura),
      altura:  alturaEfetiva,
      nFolhas: 1,
      modeloNumero: modeloNum,
      modeloNome: modeloNome,
      modeloExterno: modeloNum,
      modeloInterno: modeloNum,
      sistema: fam,
      familia: fam,
      corExterna: corExt,
      corInterna: corInt,
      corCava:    corCava,
      revestimento: item.revestimento || '',
      tamanhoCava:                   segueModelo && porta ? (Number(porta.tamanhoCava) || 0)                   : 0,
      distanciaBordaCava:            segueModelo && porta ? (Number(porta.distanciaBordaCava) || 0)            : 0,
      quantidadeFrisos:              segueModelo && porta ? (Number(porta.quantidadeFrisos) || 0)              : 0,
      espessuraFriso:                segueModelo && porta ? (Number(porta.espessuraFriso) || 0)                : 0,
      distanciaBordaFrisoVertical:   segueModelo && porta ? (Number(porta.distanciaBordaFrisoVertical) || 0)   : 0,
      distanciaBordaFrisoHorizontal: segueModelo && porta ? (Number(porta.distanciaBordaFrisoHorizontal) || 0) : 0,
      espacamentoRipas:              segueModelo && porta ? (Number(porta.espacamentoRipas) || 0)              : 0,
      tipoRipado:                    segueModelo && porta ? String(porta.tipoRipado || '')                     : '',
      __origemFixo: true,
    };
  }

  // Felipe sessao 12 (refinado): regras de filtragem das pecas que o
  // motor da porta gera, pra montar a saida de pecas do fixo.
  //
  // INCLUI categoria='porta' EXCETO os 3 acabamentos laterais
  //   (acab_lat_1, acab_lat_2, acab_lat_z) que sao especificos da
  //   moldura da porta e nao se aplicam ao fixo.
  // INCLUI categoria='portal' SOMENTE as 3 fitas de acabamento
  //   (fit_acab_me, fit_acab_ma, fit_acab_lar) que precisam vir
  //   pro fixo. Demais pecas 'portal' (alisar, batente, u_portal,
  //   tap_furo) sao do marco/portal e nao pertencem ao fixo.
  var IDS_PORTA_EXCLUIR = {
    'acab_lat_1': true,
    'acab_lat_2': true,
    'acab_lat_z': true,
  };
  var IDS_PORTAL_QUE_VAO_PRO_FIXO = {
    'fit_acab_me':  true,
    'fit_acab_ma':  true,
    'fit_acab_lar': true,
  };

  function gerarPecasChapa(item, lado) {
    if (!ehFixoValido(item)) return [];
    // Felipe sessao 13: 'no fixo acoplado a porta, lateral, quando tem vidro,
    // eu nao te passei nada ainda de chapa de ECM, tem varias coisas la,
    // elimine tudo.' Fixo Lateral c/ Vidro NAO tem chapas vindo do reuso
    // do motor da porta (Tampa Maior, Cava etc). Gera apenas as 2 pecas
    // ACM proprias: Fita Acabamento do PF + Revestimento do Tubo.
    var ehLateralVidro = (
      String(item.posicao || '').toLowerCase() === 'lateral'
      && String(item.revestimento || '').toLowerCase() === 'vidro'
    );
    if (ehLateralVidro) return gerarPecasACMLatVidro(item, lado);

    var lados = item.lados === '2lados' ? 2 : 1;
    if (lados === 1 && lado === 'interno') return [];
    if (!window.ChapasPortaExterna || !window.ChapasPortaExterna.gerarPecasChapa) return [];
    var iv = criarItemVirtualChapas(item);
    if (!iv) return [];

    // Felipe sessao 12: comprimento da CHAPA DA CAVA do fixo segue o
    // comprimento da TRAVESSA VERTICAL do fixo (= ALTURA - 2*TUB1, ver
    // linha 112 'compTravVert'), nao a formula da porta (alturaQuadro -
    // 240/293) que desconta espaco de pivo/topo que o fixo nao tem.
    // Override post-processing pra nao precisar mexer no motor da porta.
    //   PA006: altura_fixo - 76     (TUB1=38)
    //   PA007: altura_fixo - 102    (TUB1=51)
    // Mesmo valor da cantoneira da cava do fixo (linha 153).
    var sis = getSis(item);
    var compChapaCava = Number(item.altura) - 2 * sis.TUB1;

    try {
      var raw = window.ChapasPortaExterna.gerarPecasChapa(iv, lado) || [];
      var result = [];
      for (var i = 0; i < raw.length; i++) {
        var p = raw[i];
        if (p.categoria === 'porta') {
          if (IDS_PORTA_EXCLUIR[p.id]) continue;
        } else if (p.categoria === 'portal') {
          if (!IDS_PORTAL_QUE_VAO_PRO_FIXO[p.id]) continue;
        } else {
          continue; // outras categorias nao vao pro fixo
        }
        if (p.id === 'cava' && compChapaCava > 0) {
          p = Object.assign({}, p, { altura: Math.round(compChapaCava * 100) / 100 });
        }
        result.push(p);
      }
      return result;
    } catch (e) {
      console.warn('[PerfisRevAcoplado] chapas falhou:', e);
      return [];
    }
  }

  // Felipe sessao 13: pecas ACM do FIXO LATERAL COM VIDRO.
  //
  // 2 pecas geradas (categoria 'fixo_lateral' — badge azul no levantamento):
  //
  // 1. FITA ACABAMENTO DO PF
  //    Largura: 52 + REFILADO  (REF=20 do cadastro regras_variaveis_chapas)
  //    Cortes:  2 verticais (H+100) + 2 horizontais (L+100)
  //
  // 2. REVESTIMENTO DO TUBO
  //    Largura: formula do U Portal 1 Cor (TUBLPORTAL+4+TUBLPORTA+TUBLPORTAL+4+9)
  //             PA006 (familia 76):  38+4+38 +38+4+9 = 131
  //             PA007 (familia 101): 51+4+102+51+4+9 = 221
  //    Cortes:  2 verticais (H+100) + 2 horizontais (L+100)
  //
  // Cor:
  //   lado='externo' -> item.corExterna (cor ACM Externa preenchida no form)
  //   lado='interno' -> item.corInterna (cor ACM Interna preenchida no form)
  //   Se Felipe setar igual, agrupador une como cor unica.
  //
  // qtdItem multiplica naturalmente cada qty de corte (item.quantidade
  // = numero de fixos, ex: 2 fixos -> dobra todas as pecas).
  function gerarPecasACMLatVidro(item, lado) {
    var L = Number(item.largura) || 0;
    var H = Number(item.altura)  || 0;
    if (L <= 0 || H <= 0) return [];

    var qtdItem = Math.max(1, parseInt(item.quantidade, 10) || 1);

    // REFILADO do cadastro (default 20mm)
    var REF = 20;
    try {
      if (window.Storage && window.Storage.scope) {
        var v = window.Storage.scope('cadastros').get('regras_variaveis_chapas');
        if (v && Number(v.REF) > 0) REF = Number(v.REF);
      }
    } catch (_) {}

    var largFita = 52 + REF;
    var largRev  = (String(item.sistema).toUpperCase() === 'PA007') ? 221 : 131;

    var corLado = (lado === 'externo')
      ? String(item.corExterna || '').trim()
      : String(item.corInterna || '').trim();
    // Felipe sessao 13: 'se e a mesma cor fazer tudo junto para
    // aproveitar ao maximo a chapa'. As pecas ACM da Porta no Mod23+AM
    // saem com cor 'ACM — Branco' (prefixo aplicado em 38-chapas-porta-
    // externa.js materializar). Pra agrupar essas pecas com as do Fixo
    // Lateral c/ Vidro, o prefixo precisa ser identico aqui tambem.
    // Sem o prefixo, planificador trata 'Branco' (fixo) e 'ACM — Branco'
    // (porta) como cores diferentes -> 2 chapas separadas mesmo cor real
    // sendo a mesma. Com o prefixo, agrupar() une as 2 numa chapa so'.
    var corComPrefixo = corLado ? ('ACM — ' + corLado) : 'ACM';

    var pecas = [];
    var ord = 100;

    function add(label, larg, comp, qty) {
      if (!larg || comp <= 0 || qty <= 0) return;
      pecas.push({
        id: 'flv_' + label.toLowerCase().replace(/\W+/g, '_') + '_' + Math.round(comp),
        label: label,
        largura: Math.round(larg * 100) / 100,
        altura:  Math.round(comp),
        qtd:     qty * qtdItem,
        podeRotacionar: false,
        cor:     corComPrefixo,
        lado:    lado,
        categoria: 'fixo_lateral',
        materialEspecial: null,
        _ordem: ord++,
      });
    }

    add('Fita Acabamento do PF', largFita, H + 100, 2);
    add('Fita Acabamento do PF', largFita, L + 100, 2);
    add('Revestimento do Tubo',  largRev,  H + 100, 2);
    add('Revestimento do Tubo',  largRev,  L + 100, 2);

    return pecas;
  }

  function descricaoItem(item) {
    if (!ehFixoValido(item)) return 'Fixo Acoplado, ?x?mm';
    var lados = item.lados === '2lados' ? '2 lados' : '1 lado';
    var extra = item.temEstrutura === 'nao' ? ' - so chapas' : '';
    return 'Fixo Acoplado, ' + item.largura + 'x' + item.altura + 'mm (' + lados + extra + ')';
  }

  return {
    SIS: SIS,
    COD_CAVA: COD_CAVA,
    COD_CANTONEIRA: COD_CANTONEIRA,
    ehFixoValido: ehFixoValido,
    gerarCortes: gerarCortes,
    gerarPecasChapa: gerarPecasChapa,
    descricaoItem: descricaoItem,
  };
})();
window.PerfisRevAcoplado = PerfisRevAcoplado;
