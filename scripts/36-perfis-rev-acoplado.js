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

    // Felipe sessao 2026-05-10: Tubo Interno das Ripas deve ser gerado
    // MESMO sem estrutura. Felipe: 'item 3 coloquei que e ripado, ainda
    // nao calcula perfis ripado'. O tubo das ripas e' INTERNO a chapa
    // ripa (vai dentro da peca de revestimento), nao faz parte da
    // estrutura/quadro. Por isso aparece tanto com quanto sem estrutura.
    //
    // Logica replicada do bloco original (que estava DEPOIS do return {}
    // quando temEstrutura='nao' - bug). Agora executa primeiro.
    var LARGURA = Number(item.largura) || 0;
    var ALTURA  = Number(item.altura)  || 0;
    var qtdItem = Math.max(1, parseInt(item.quantidade, 10) || 1);

    var ehLateralRipadoOuMoldura = item.posicao === 'lateral' &&
                                   (item.tipoLateral === 'ripado' ||
                                    item.tipoLateral === 'moldura');
    var segueModelo = item.fixoSegueModelo === 'sim' || ehLateralRipadoOuMoldura;
    var portaPreCheck = segueModelo ? obterPortaPrincipal() : null;

    var cortesPreEstrutura = {};
    function addPreEst(codigo, comp, qty, label) {
      if (!codigo || comp <= 0 || qty <= 0) return;
      if (!cortesPreEstrutura[codigo]) cortesPreEstrutura[codigo] = [];
      cortesPreEstrutura[codigo].push({ comp: Math.round(comp), qty: qty * qtdItem, label: label });
    }

    if (segueModelo && portaPreCheck && LARGURA > 0 && ALTURA > 0) {
      var modeloFixoPre = Number(portaPreCheck.modeloNumero) || 1;
      if (modeloFixoPre === 8 || modeloFixoPre === 15) {
        var espacRipasPre = parseFloat(String(portaPreCheck.espacamentoRipas || portaPreCheck.espacRipas || 30).replace(',', '.')) || 30;
        var tipoRipadoPre = String(portaPreCheck.tipoRipado || 'total').toLowerCase();
        var tamCavaPortaPre = Number(portaPreCheck.tamanhoCava) || 0;
        var denomPre = 60 + espacRipasPre;
        var FGLD_pre = Number(item.fglDir) || 0;
        var FGLE_pre = Number(item.fglEsq) || 0;
        var numeradorPre = (tipoRipadoPre === 'parcial')
          ? (LARGURA - FGLD_pre - tamCavaPortaPre - FGLE_pre)
          : LARGURA;
        var qtdRipasPre = denomPre > 0 ? Math.ceil(numeradorPre / denomPre) : 0;
        var pedacosPorRipaPre = Math.max(1, Math.floor(ALTURA / 1000));
        var qtdTuboRipaPre = qtdRipasPre * pedacosPorRipaPre;
        if (qtdTuboRipaPre > 0) {
          addPreEst('PA-51X12X1.58', 500, qtdTuboRipaPre, 'Tubo Interno das Ripas');
        }
      }
    }

    // Felipe sessao 2026-05-10: Sem estrutura - retorna SOMENTE o tubo
    // interno das ripas (se aplicavel) - sem perfis de quadro.
    if (item.temEstrutura === 'nao') return cortesPreEstrutura;

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

    // Felipe sessao 2026-05-10: inicializa cortes com o tubo das ripas
    // ja' calculado no bloco PRE-estrutura (antes do check temEstrutura
    // === 'nao'). Assim o caminho com-estrutura tambem inclui o tubo.
    var cortes = cortesPreEstrutura;
    function add(codigo, comp, qty, label) {
      if (!codigo || comp <= 0 || qty <= 0) return;
      if (!cortes[codigo]) cortes[codigo] = [];
      cortes[codigo].push({ comp: Math.round(comp), qty: qty * qtdItem, label: label });
    }

    // ── Formulas Pasta1.xlsx ──
    var compAltura   = ALTURA - FGSup;                     // PERFIL ALTURA (desconta folga superior)
    var compLargura  = LARGURA - FGLD - FGLE;              // PERFIL LARGURA (caso normal)
    // Felipe (sessao 18): compTravVert tambem desconta FGSup. Antes
    // ficava 'ALTURA - 2*TUB1' (sem folga superior). Bug reportado:
    // "no fixo lateral acoplado a porta a travessa vertical nao esta
    //  desconto a folga da altura". Mesma logica do compAltura: a
    // folga superior reduz a altura util entre os tubos do portal.
    // Afeta os 3 perfis verticais que usam compTravVert:
    //   - Travessa Vertical (linha 260)
    //   - Friso Vertical    (linha 267)
    //   - Cantoneira Cava   (linha 278)
    var compTravVert = ALTURA - FGSup - 2 * TUB1;          // TRAV VERT + FRISO VERT + CANTONEIRA
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
    // Felipe sessao 2026-05-10 (FIX 2): Lateral + Ripado/Moldura tambem
    // herda da porta (mesmo espacamento). Replicada a mesma logica do
    // criarItemVirtualChapas pra consistencia entre perfis e chapas.
    //
    // Felipe (sessao 18): Fixo lateral LISA NAO replica nada da porta.
    // Felipe: 'fixo acoplado lateral da porta, ele nao replica nada da
    // porta, somente quando e superior que colocamos se segue modelo
    // da porta pois vai em cima da porta'.
    // FORCA segueModelo=false quando lateral lisa, independente do
    // fixoSegueModelo (default 'sim'). Bug reportado: fixo lateral
    // 400x2750mm lisa estava gerando Tubo Cava, Cantoneira Cava e
    // Travessa Vertical herdados da porta. A travessa vertical local
    // (regra propria) e' adicionada depois do bloco da cava.
    var ehLateralLisa = item.posicao === 'lateral' &&
                        (item.tipoLateral === 'lisa' || !item.tipoLateral);
    var ehLateralRipadoOuMoldura = item.posicao === 'lateral' &&
                                   (item.tipoLateral === 'ripado' ||
                                    item.tipoLateral === 'moldura');
    var segueModelo = !ehLateralLisa &&
                      (item.fixoSegueModelo === 'sim' || ehLateralRipadoOuMoldura);
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

    // Felipe (sessao 18): Fixo lateral LISA tem travessa vertical
    // PROPRIA (nao herda da porta). Felipe (refinamento): regra baseada
    // na largura do PERFIL LARGURA (PA-76X38X1.98 = compLargura), NAO
    // em VEDA da porta. Limites tambem diferentes da porta:
    //   compLargura > 2500 → 2 travessas
    //   compLargura > 1200 → 1 travessa
    //   compLargura <= 1200 → 0
    // compLargura = LARGURA - FGLD - FGLE.
    // Caso real Felipe: fixo lateral 400x2750mm lisa → compLargura
    // = 380 → 0 travessas (antes: 4 herdadas da porta indevidamente).
    if (ehLateralLisa) {
      var bonusTV = 0;
      if (compLargura > 2500)      bonusTV = 2;
      else if (compLargura > 1200) bonusTV = 1;
      if (bonusTV > 0) {
        add(s.perfil, compTravVert, bonusTV, 'Travessa Vertical');
      }
    }

    // Felipe sessao 2026-05-10: 'Tubo Interno das Ripas' ja' foi gerado
    // no inicio (bloco pre-estrutura) - aplicavel mesmo sem estrutura.

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

    // Felipe sessao 2026-05-10: 2 fixes combinados pra herdar parametros
    // do modelo da porta:
    //
    // FIX 2 (LATERAL + tipoLateral): quando o user escolhe 'Ripado' ou
    // 'Moldura' no campo 'Tipo de chapa' do lateral, deve usar o MESMO
    // espacamento/moldura da porta. Felipe: 'mesmo espacamento da porta'.
    // Lateral + 'lisa' continua sem herdar (chapa simples).
    //
    // FIX 3 (SUPERIOR + Segue modelo = Sim): alem dos campos atuais
    // (cava/frisos/ripado), agora herda TODOS os campos de MOLDURA do
    // Mod23 (qtdMolduras, dist1a2a, dist2a3a, dist1aMoldura) +
    // modeloDuasFaces. Sem isso o motor de chapas (38-chapas-...)
    // recebia qtdMolduras=1 (default) e nao gerava as molduras 2/3.
    // Felipe pediu 'TODOS (qtdMolduras, dist1a2a, dist2a3a,
    // dist1aMoldura, modeloDuasFaces)'.
    //
    // ALISAR (largura_alisar, espessura_parede, tem_alisar):
    // NAO herda. Felipe: 'herdar somente campos que interferem na
    // porta' - alisar e' do portal da porta, nao do fixo.
    var ehLateralRipadoOuMoldura = item.posicao === 'lateral' &&
                                   (item.tipoLateral === 'ripado' ||
                                    item.tipoLateral === 'moldura');
    var segueModelo = item.fixoSegueModelo === 'sim' || ehLateralRipadoOuMoldura;
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

    // Felipe (sessao 2026-05-10): BUGFIX - aproveitamento de chapas
    // mostrava 'Aluminio Macico — Black Door' no Item 2 (fixo AM).
    //
    // Causa: quando revestimento='Aluminio Macico 2mm', o user preenche
    // a cor AM no MESMO campo corExterna/corInterna (form do fixo nao
    // tem campo separado corChapaAM_Ext/Int como o form da porta).
    // O motor de chapas (38-chapas-porta-externa.js) busca corChapaAM_Ext
    // pra resolver cor de pecas AM, falha (item virtual nao passava
    // esse campo), cai em cascata de fallbacks e acaba pegando
    // corCava='Black Door' (herdada da porta principal).
    //
    // Fix: quando este fixo for AM, espelha a cor escolhida nos campos
    // corChapaAM_Ext/Int do item virtual - assim o motor pega no 1o
    // fallback e nao precisa cair em corCava (ACM da porta principal).
    var ehFixoAM = /alum[ií]n[ií]o\s*maci[cç]o/i.test(item.revestimento || '');
    var corChapaAM_Ext = ehFixoAM ? corExt : '';
    var corChapaAM_Int = ehFixoAM ? corInt : '';

    return {
      tipo: 'porta_externa',
      // Felipe sessao 2026-05-10: BUGFIX - 'que burrice e idiotice e essa
      // que ate hoje quando se tem 2 itens na quantidade nao se multiplica
      // por 2'. Antes 'quantidade: 1' hardcoded fazia o motor de chapas
      // (38-chapas-porta-externa.js linha 1597) usar qtdItem=1 mesmo quando
      // item.quantidade=2. Resultado: fixo qtd=2 gerava apenas 1 conjunto
      // de chapas. Agora propaga corretamente.
      quantidade: Math.max(1, parseInt(item.quantidade, 10) || 1),
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
      // Felipe sessao 2026-05-10: passa cores AM pro item virtual quando
      // este fixo eh AM (espelha corExterna/Interna pra evitar fallback
      // erroneo via corCava da porta principal).
      corChapaAM_Ext: corChapaAM_Ext,
      corChapaAM_Int: corChapaAM_Int,
      revestimento: item.revestimento || '',
      tamanhoCava:                   segueModelo && porta ? (Number(porta.tamanhoCava) || 0)                   : 0,
      distanciaBordaCava:            segueModelo && porta ? (Number(porta.distanciaBordaCava) || 0)            : 0,
      quantidadeFrisos:              segueModelo && porta ? (Number(porta.quantidadeFrisos) || 0)              : 0,
      espessuraFriso:                segueModelo && porta ? (Number(porta.espessuraFriso) || 0)                : 0,
      distanciaBordaFrisoVertical:   segueModelo && porta ? (Number(porta.distanciaBordaFrisoVertical) || 0)   : 0,
      distanciaBordaFrisoHorizontal: segueModelo && porta ? (Number(porta.distanciaBordaFrisoHorizontal) || 0) : 0,
      espacamentoRipas:              segueModelo && porta ? (Number(porta.espacamentoRipas) || 0)              : 0,
      tipoRipado:                    segueModelo && porta ? String(porta.tipoRipado || '')                     : '',
      // Felipe sessao 2026-05-10 (FIX 3): campos de MOLDURA do Mod23.
      // Sem esses campos, o motor de chapas (38-chapas-porta-externa.js)
      // assumia qtdMolduras=1 (default em parseInt) e nao gerava as
      // molduras 2 e 3 quando a porta tinha qtdMolduras=2 ou 3.
      // 'distanciaBorda1aMoldura' tem default 150 no motor, mas pra
      // segueModelo o correto e' herdar da porta.
      quantidadeMolduras:            segueModelo && porta ? (Number(porta.quantidadeMolduras) || 1)            : 1,
      distancia1a2aMoldura:          segueModelo && porta ? (Number(porta.distancia1a2aMoldura) || 0)          : 0,
      distancia2a3aMoldura:          segueModelo && porta ? (Number(porta.distancia2a3aMoldura) || 0)          : 0,
      distanciaBorda1aMoldura:       segueModelo && porta ? (Number(porta.distanciaBorda1aMoldura) || 0)       : 0,
      // Felipe sessao 2026-05-10 (FIX 3): modeloDuasFaces afeta se o
      // motor gera pecas pra face interna tambem. Herda da porta quando
      // segue modelo.
      modeloDuasFaces:               segueModelo && porta ? String(porta.modeloDuasFaces || 'sim')             : (item.lados === '2lados' ? 'sim' : 'nao'),
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

    // Felipe (sessao 18): fixo lateral LISA NAO reutiliza motor da porta.
    // Felipe: 'fixo lateral chapas tbm tudo errado, coloquei chapa lisa,
    // ou vai ser chapa lisa ou com ripado ou clasissca, nao tem nada de
    // cava nesse fixo lateral. chapa vai ser largura do fixo - folga
    // lateral + 100 x altura do fixo - folga superior, 1 vez se for
    // somente interno 2x se for interno e externo. considere mais fita
    // de acabamento 50 + ref, 2x se for somente externo e 4x se for
    // interno e externo pela altura do fixo + 100.'
    // Caso real: fixo 400x2750mm lisa estava gerando Cava, L da Cava,
    // Tampa Borda Cava, Fitas — tudo do mod 1 (cava). Agora gera
    // apenas Tampa + Fita Acabamento. Ripado/Moldura/Superior NAO
    // sao afetados (continuam reusando motor da porta).
    var ehLateralLisa = String(item.posicao || '').toLowerCase() === 'lateral' &&
                        (item.tipoLateral === 'lisa' || !item.tipoLateral);
    if (ehLateralLisa) {
      var ladosL = item.lados === '2lados' ? 2 : 1;
      if (ladosL === 1 && lado === 'interno') return [];
      return gerarPecasFixoLateralLisa(item, lado);
    }

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

    // Felipe (sessao atual): chapas com 'tampa' ou 'friso' no id, no fixo
    // SUPERIOR (acima da porta), devem ter altura = altura_fixo + TUB1 + REF.
    //   PA006: altura_fixo + 38 + 20 = altura_fixo + 58
    //   PA007: altura_fixo + 51 + 20 = altura_fixo + 71
    // Motivo: o motor da porta calcula essas alturas baseado em alturaQuadro
    // (descontando dBC/dBFV/etc), mas no fixo superior elas atravessam o
    // tubo de extremidade + aba de revestimento, entao precisam crescer.
    // REF=20 do motor da porta (38-chapas-porta-externa.js linha 31).
    var REF_FIXO = 20;
    var posicao  = String(item.posicao || '').toLowerCase();
    var ehSuperior = posicao === 'superior';
    var ehLateral  = posicao === 'lateral';
    var compTampaFrisoSup = ehSuperior
      ? Math.round((Number(item.altura) + sis.TUB1 + REF_FIXO) * 100) / 100
      : 0;

    // Felipe (sessao 2026-05-10): sufixo no label pra identificar no
    // planificador qual peca eh do fixo (superior ou lateral) — evita
    // confusao com pecas de mesmo nome vindas da porta.
    //   'Tampa Maior Cava' -> 'Tampa Maior Cava - fixo superior'
    //   'Cava'             -> 'Cava - fixo lateral'
    var sufixoFixo = '';
    if (ehSuperior) sufixoFixo = ' - fixo superior';
    else if (ehLateral) sufixoFixo = ' - fixo lateral';

    function aplicarSufixoLabel(label) {
      if (!sufixoFixo) return label;
      var s = String(label || '');
      // idempotente: se ja tem o sufixo, nao duplica
      if (s.indexOf(sufixoFixo) >= 0) return s;
      return s + sufixoFixo;
    }

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
        // Override altura tampa/friso no fixo SUPERIOR
        if (compTampaFrisoSup > 0 && /^(tampa|friso)/.test(p.id || '')) {
          p = Object.assign({}, p, { altura: compTampaFrisoSup });
        }
        // Felipe: sufixo no label pra identificar no planificador
        if (sufixoFixo) {
          p = Object.assign({}, p, { label: aplicarSufixoLabel(p.label) });
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
  // ====================================================================
  // gerarPecasFixoLateralLisa(item, lado)
  // Felipe (sessao 18): chapas do fixo lateral LISA — NAO reusa motor
  // da porta. Apenas 2 tipos de peca:
  //   1. Tampa: 1 unidade por face
  //      largura = larguraFixo - FGLD - FGLE + 100
  //      altura  = alturaFixo  - FGSup
  //   2. Fita Acabamento: 2 unidades por face
  //      largura = 50 + REF (do cadastro, default 20)
  //      altura  = alturaFixo + 100
  // Totais (esperados pelo Felipe):
  //   1 face : 1 tampa + 2 fitas
  //   2 faces: 2 tampas + 4 fitas
  // ====================================================================
  function gerarPecasFixoLateralLisa(item, lado) {
    var L = Number(item.largura) || 0;
    var H = Number(item.altura)  || 0;
    if (L <= 0 || H <= 0) return [];

    var qtdItem = Math.max(1, parseInt(item.quantidade, 10) || 1);

    // REF do cadastro (default 20mm)
    var REF = 20;
    try {
      if (window.Storage && window.Storage.scope) {
        var v = window.Storage.scope('cadastros').get('regras_variaveis_chapas');
        if (v && Number(v.REF) > 0) REF = Number(v.REF);
      }
    } catch (_) {}

    // Folgas editaveis por item (mesma logica do gerarCortes _fg helper)
    function _fg(raw, fb) {
      if (raw === '' || raw === null || raw === undefined) return fb;
      var n = Number(String(raw).replace(',', '.'));
      return (isFinite(n) && n >= 0) ? n : fb;
    }
    var FGLD  = _fg(item.fglDir, 10);
    var FGLE  = _fg(item.fglEsq, 10);
    var FGSup = _fg(item.fgSup, 10);

    var corLado = (lado === 'externo')
      ? String(item.corExterna || '').trim()
      : String(item.corInterna || '').trim();
    var corComPrefixo = corLado || 'ACM';

    var largTampa = L - FGLD - FGLE + 100;
    var altTampa  = H - FGSup;
    var largFita  = 50 + REF;
    var altFita   = H + 100;

    var pecas = [];
    var ord = 100;
    function add(label, larg, comp, qty) {
      if (!larg || comp <= 0 || qty <= 0) return;
      var labelComSufixo = (String(label).indexOf(' - fixo lateral') >= 0)
        ? label
        : label + ' - fixo lateral';
      pecas.push({
        id: 'fll_' + label.toLowerCase().replace(/\W+/g, '_') + '_' + Math.round(comp),
        label: labelComSufixo,
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

    add('Tampa Maior',     largTampa, altTampa, 1);
    add('Fita Acabamento', largFita,  altFita,  2);

    return pecas;
  }

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
    // Felipe sessao 14: cor SEM prefixo "ACM —". Pedido Felipe:
    // "independente do item, sempre que tiver a mesma cor deve fazer
    // aproveitamento de chapas juntos". Pecas ACM de qualquer item
    // (porta, fixo, fixo lateral c/vidro, revestimento) com a mesma
    // cor agora caem no MESMO grupo de aproveitamento. Pecas AM
    // continuam prefixadas "Aluminio Macico —" porque vao pra
    // chapa-mae diferente.
    var corComPrefixo = corLado || 'ACM';

    var pecas = [];
    var ord = 100;

    function add(label, larg, comp, qty) {
      if (!larg || comp <= 0 || qty <= 0) return;
      // Felipe (sessao 2026-05-10): sufixo no label pra identificar no
      // planificador. Aqui SEMPRE eh fixo lateral (gerarPecasACMLatVidro).
      var labelComSufixo = (String(label).indexOf(' - fixo lateral') >= 0)
        ? label
        : label + ' - fixo lateral';
      pecas.push({
        id: 'flv_' + label.toLowerCase().replace(/\W+/g, '_') + '_' + Math.round(comp),
        label: labelComSufixo,
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
