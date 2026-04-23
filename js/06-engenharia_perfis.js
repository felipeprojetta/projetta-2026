/**
 * 06-engenharia_perfis.js
 * Module: ENGENHARIA_PERFIS
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: ENGENHARIA_PERFIS ══ */
// ── SHARED: calcular dados de perfis ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// CONJUNTOS DE PERFIS POR SISTEMA
// Define qual código de perfil usar em cada função, por sistema PA006/PA007.
// CAVA: sempre 38×38 + CANT 30×30 — sem alteração por sistema.
// ══════════════════════════════════════════════════════════════════════════════
const CONJUNTOS_PERFIS = {
  // ═══════════════════════════════════════════════════════════════════
  // CONJUNTO PA007 — Portas ≥ 4000mm de altura
  // ═══════════════════════════════════════════════════════════════════
  PA007: {
    // Perfis especiais (extrusão WEIKU/TECNOPERFIL)
    pa_altura:      'PA-PA007F',          // PA ALTURA — perfil F da folha (altura)
    ved_inf_sup:    'PA-PA007V',          // VED INF & SUP — vedação (fórmula a confirmar)
    alt_portal:     'PA-PA007P',          // ALT PORTAL — perfil P do portal (altura)

    // Tubulares estruturais — FOLHA
    lar_inf_sup:    'PA-101X101X2.5',     // LAR INF & SUP — largura inf/sup (101×101)
    trav_vert:      'PA-101X51X2',        // TRAV VERT — travessa vertical (101×51)
    tra_hor:        'PA-101X51X2',        // TRA HOR MEIO — travessa horizontal (101×51)

    // Frisos (decorativos/acabamento) — 101×101 para PA007
    friso_vert:     'PA-101X101X2.5',     // FRISO VERTICAL (101×101) ← mesmo que LAR
    friso_horiz:    'PA-101X51X2',        // FRISO HORIZONTAL (101×51) — retangular (horizontal)

    // Portal
    lar_portal:     'PA-101X51X2',        // LAR PORTAL — travessa horiz do portal (101×51)

    // Cava — sem alteração por sistema
    tub_cava:       'PA-38X38X1.58',      // TUB CAVA (38×38)
    cant_cava:      'PA-CANT-30X30X2.0',  // CANT CAVA (30×30)
    travamento:     'PA-51X12X1.58',      // TRAVAMENTO CAVA
    canal_esc:      'PA-CHR908',          // CANAL ESC
    tra_portal:     'PA-35X25-OLHAL',     // TRA PORTAL
  },

  // ═══════════════════════════════════════════════════════════════════
  // CONJUNTO PA006 — Portas < 4000mm de altura
  // ═══════════════════════════════════════════════════════════════════
  PA006: {
    // Perfis especiais
    pa_altura:      'PA-PA006F',          // PA ALTURA — perfil F da folha
    ved_inf_sup:    'PA-PA006V',          // VED INF & SUP — vedação (fórmula a confirmar)
    alt_portal:     'PA-PA006P',          // ALT PORTAL — perfil P do portal

    // Tubulares estruturais — FOLHA (série 76mm para PA006)
    lar_inf_sup:    'PA-76X76X2.0',       // LAR INF & SUP — largura inf/sup (76×76)
    trav_vert:      'PA-76X38X1.98',      // TRAV VERT — travessa vertical (76×38)
    tra_hor:        'PA-76X38X1.98',      // TRA HOR MEIO — travessa horizontal (76×38)

    // Frisos (decorativos/acabamento) — 76×76 para PA006
    friso_vert:     'PA-76X76X2.0',       // FRISO VERTICAL (76×76) ← mesmo que LAR
    friso_horiz:    'PA-76X38X1.98',      // FRISO HORIZONTAL (76×38) — retangular (horizontal)

    // Portal
    lar_portal:     'PA-76X38X1.98',      // LAR PORTAL — travessa horiz do portal (76×38)

    // Cava — sem alteração por sistema
    tub_cava:       'PA-38X38X1.58',      // TUB CAVA — tubo da cava (38×38) — igual PA007
    cant_cava:      'PA-CANT-30X30X2.0',  // CANT CAVA — cantoneira da cava (30×30) — igual PA007
    travamento:     'PA-51X12X1.58',      // TRAVAMENTO CAVA — igual PA007
    canal_esc:      'PA-CHR908',          // CANAL ESC — igual PA007
    tra_portal:     'PA-35X25-OLHAL',     // TRA PORTAL — igual PA007
  }
};

function _calcularDadosPerfis(L, H, nFolhas, barraMM) {
  // ── Parâmetros: lê da fase do projeto (Orçamento/Produção) ──────────────────
  var _isIntlSis=(document.getElementById('inst-quem')||{value:''}).value==='INTERNACIONAL';
  var _p = (typeof _getParams === 'function') ? _getParams() : {FGA:10,FGL:10,FGR:10,PIV:28,TRANS:8,VED:35,TUB:_isIntlSis?50.8:(H>=4000?50.8:38.1),sis:_isIntlSis?'PA007':(H>=4000?'PA007':'PA006')};
  var TUB = _p.TUB;
  var sis = _p.sis;
  var C   = CONJUNTOS_PERFIS[sis];

  // Preços BRUTOS (valor digitado no cadastro)
  var kgTecnoBru = parseFloat((document.getElementById('pf-kg-tecnoperfil')||{value:0}).value)||0;
  var kgMercBru  = parseFloat((document.getElementById('pf-kg-mercado')||{value:0}).value)||0;
  var kgWeikuBru = parseFloat((document.getElementById('pf-kg-weiku')||{value:0}).value)||0;
  var precoPintBru = parseFloat((document.getElementById('pf-preco-pintura')||{value:0}).value)||0;

  // Deduções (%) — lê direto do DOM para não depender de arquivo externo
  var dedTecno = parseFloat((document.getElementById('pf-ded-tecnoperfil')||{value:0}).value)||0;
  var dedMerc  = parseFloat((document.getElementById('pf-ded-mercado')||{value:0}).value)||0;
  var dedWeiku = parseFloat((document.getElementById('pf-ded-weiku')||{value:0}).value)||0;
  var dedPint  = parseFloat((document.getElementById('pf-ded-pintura')||{value:0}).value)||0;

  // Preços LÍQUIDOS (após dedução) — base para cálculo de custo
  var kgTecno   = kgTecnoBru * (1 - dedTecno/100);
  var kgMerc    = kgMercBru  * (1 - dedMerc/100);
  var kgWeiku   = kgWeikuBru * (1 - dedWeiku/100);
  var precoPint = precoPintBru * (1 - dedPint/100);

  // ★ Felipe 23/04: Detectar "só revestimento" (sem porta/fixo).
  //   Nesse caso, pular TODA a geração de perfis da porta (PA007, PA-CANT,
  //   VEDA, BOISERIE, etc.) e processar SOMENTE os tubos PA-51X25X1.5 de
  //   fixação das ripas do revestimento. Antes, esse branch não existia e
  //   quando o user abria o orçamento, os inputs legacy 'largura'/'altura'
  //   eram setados com as dimensões do REVESTIMENTO (ex: 1490×4000),
  //   fazendo _calcularDadosPerfis tratar como uma porta fantasma de
  //   1490×4000 e gerar R$ 14.629 em material + R$ 624 em pintura.
  var _revRipSoOnly = (window._orcItens||[]).filter(function(it){
    return it.tipo==='revestimento' && it.rev_tipo==='RIPADO' && (it.largura||0)>0 && (it.altura||0)>0;
  });
  var _temPortaFixo = (window._orcItens||[]).some(function(it){
    return it.tipo==='porta_pivotante' || it.tipo==='porta_interna' || it.tipo==='fixo';
  });
  var _revOnlyMode = (!_temPortaFixo) && _revRipSoOnly.length>0;

  if(_revOnlyMode){
    function _getPerfRev(code){
      for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===code)return PERFIS_DB[i];}
      return null;
    }
    // Acumular total de tubos de todos os itens ripados
    var _totalTubosRev=0, _descDetalhes=[];
    _revRipSoOnly.forEach(function(it, idx){
      var _Lr=parseFloat(it.largura)||0, _Ar=parseFloat(it.altura)||0, _Qr=parseInt(it.qtd)||1;
      var _nRipas=Math.ceil(_Lr/90);
      var _nTubosRipa=Math.max(1,Math.ceil(_Ar/1000));
      var _qtyItem=_nRipas*_nTubosRipa*_Qr;
      _totalTubosRev+=_qtyItem;
      _descDetalhes.push('REV'+(idx+1)+':'+_qtyItem);
    });
    if(_totalTubosRev<=0) return {error:'Revestimento ripado sem dimensoes validas'};

    // Monta single-cut pra entrar na mesma pipeline de groupRes/barras
    var _cuts=[{code:'PA-51X25X1.5',
      desc:'FIXAÇÃO RIPAS REVESTIMENTO ('+_descDetalhes.join(' ')+')',
      compMM:500, qty:_totalTubosRev, pintado:false, secao:'FOLHA',
      barLenMM:6000, lh:'90/90 L', obs:'BRUTO REV'}];
    _cuts.forEach(function(c){ c.perf=_getPerfRev(c.code); c.kgM=c.perf?c.perf.kg:0; });
    // Bin pack (inline, igual lógica do caller)
    var _barLen=6000, _usable=5990;
    var _allCuts=[];
    for(var _i=0;_i<_totalTubosRev;_i++) _allCuts.push(500);
    var _bars=(typeof binPackFFD==='function')?binPackFFD(_allCuts,_barLen):[];
    var _nBars=_bars.length || Math.ceil(_totalTubosRev/11); // fallback: 11 tubos/barra 6m
    var _totUsed=_allCuts.reduce(function(s,x){return s+x;},0);
    var _totBruto=_nBars*_barLen;
    var _aprov=_totBruto>0?(_totUsed/_totBruto*100):0;
    var _kgM=0.595;
    var _kgLiq=(_totUsed/1000)*_kgM;
    var _kgBruto=(_totBruto/1000)*_kgM;
    var _custoPerfil=_kgBruto*kgMerc;
    var _custoPerfilBru=_kgBruto*kgMercBru;
    var _barsDetail=_bars.length>0 ? _bars.map(function(b){
      return {len:b.barLen, items:b.items.slice().sort(function(a,x){return x-a;}),
              remaining:b.remaining, sobra:b.sobra!=null?b.sobra:b.remaining};
    }) : [];
    var _groupRes={'PA-51X25X1.5':{
      nBars:_nBars, totUsed:_totUsed, totBruto:_totBruto, aprov:_aprov,
      kgLiq:_kgLiq, kgBruto:_kgBruto, precoKg:kgMerc,
      custoPerfil:_custoPerfil, custoPintura:0, custoTotal:_custoPerfil,
      custoPerfilBru:_custoPerfilBru, custoPinturaBru:0, custoTotalBru:_custoPerfilBru,
      barLenMM:_barLen, pintado:false, barsDetail:_barsDetail,
      _isBoiserie:false, _barPrice:0
    }};
    return {cuts:_cuts, groupRes:_groupRes, seenKeys:['PA-51X25X1.5'],
            sis:'REV_ONLY', N_H:0, temCava:false, larguraCava:0, travCavaSize:0,
            vedaSize:0, vedaCode:'', vedaQty:0, folhaPAPA:0,
            kgTecno:kgTecno, kgMerc:kgMerc, precoPint:precoPint,
            isPintado:function(){return false;},
            kgTecnoBru:kgTecnoBru, kgMercBru:kgMercBru, kgWeikuBru:kgWeikuBru, precoPintBru:precoPintBru,
            dedTecno:dedTecno, dedMerc:dedMerc, dedWeiku:dedWeiku, dedPint:dedPint,
            _revOnly:true};
  }


  var FGA       = _p.FGA;   // Folga altura (padrão 10mm)
  var FGL       = _p.FGL;   // Folga largura esquerda (padrão 10mm)
  var FGR       = _p.FGR;   // Folga largura direita (padrão 10mm)
  var PIV       = _p.PIV;   // Espessura pivô (padrão 28mm)
  var TRANS     = _p.TRANS; // Transpasse ACM (padrão 8mm)
  var VED_PORTA = _p.VED;   // Veda porta (padrão 35mm)
  // ── Dimensões exatas dos tubos (conforme planilha FORMULAS_PARA_PERFIS) ───
  var TUBO_LAR_INT = (sis === 'PA007') ? 101.8 : 76.2;  // TUBLPORTA
  var ESPACM       = _p.ESPACM!==undefined?_p.ESPACM:4;  // Espaçamento montagem (configurável)

  // ── Quantidade de travessas horizontais = floor(H/1000) ─────────────────
  // Planilha: "arredondada para BAIXO — ex: 4500 terá 4 travessas"
  var N_H = Math.floor(H / 1000);

  // Modelos com cava — TUB CAVA e CANT CAVA só são usados quando há cava
  var _selEl     = document.getElementById('carac-modelo');
  var modeloSel  = _selEl ? (_selEl.value || '') : '';
  var _semModelo = (modeloSel === '');
  var _selOpt    = _selEl && _selEl.selectedIndex >= 0 ? _selEl.options[_selEl.selectedIndex] : null;
  var _modeloNome= _selOpt ? (_selOpt.text||'').toLowerCase() : '';
  var temCava    = _modeloNome.indexOf('cava') >= 0;

  // ── LARGURA DA CAVA (lida do input do orçamento/planificador) ───────────
  var _cavLargEl = document.getElementById('carac-largura-cava');
  var _cavLargDefault = _p.LARG_CAVA!==undefined?_p.LARG_CAVA:150;
  var _travCavaAdd = _p.TRAV_CAVA_ADD!==undefined?_p.TRAV_CAVA_ADD:100;
  var LARGURA_CAVA = _cavLargEl ? (parseFloat(_cavLargEl.value) || _cavLargDefault) : _cavLargDefault;
  var TRAV_CAVA = LARGURA_CAVA + _travCavaAdd;  // Travamento da cava = largura cava + 100mm

  // ── TRAV VERT quantidade por folha (planilha FORMULAS_PARA_PERFIS) ──────
  // 1 FOLHA: L<2200=1 | 2201-3000=2 | >3001=3 | com cava: +2
  // 2 FOLHAS: mesma regra base | com cava: +4
  var _travBase = L > 3000 ? 3 : L > 2200 ? 2 : 1;
  // Modelos Cava e Cava Premium < 1500mm: não precisa travessa vertical adicional (só as da cava)
  var _isCavaOrPremium = (modeloSel==='01'||modeloSel==='22'||modeloSel==='09'||modeloSel==='24');
  if(_isCavaOrPremium && L < 1500) _travBase = 0;
  var _distBorda=parseFloat((document.getElementById('carac-dist-borda-cava')||{value:210}).value)||210;
  var _cavaTravAdd = temCava ? (_distBorda <= 158 ? 1 : 2) : 0;  // dist≤158mm: 1 trav, >158mm: 2 trav
  var TRAV_V_QTY_PF = _semModelo ? 0 : (_travBase + _cavaTravAdd);
  var TRAV_V_QTY    = TRAV_V_QTY_PF * nFolhas;

  // Quantidade de frisos: lida manualmente dos inputs (por modelo)
  function _readFriso(id,def){var el=document.getElementById(id);return el?Math.max(0,parseInt(el.value)||0):def;}
  var QTY_FRISO_VERT  = _readFriso('carac-friso-vert',  0);
  var QTY_FRISO_HORIZ = _readFriso('carac-friso-horiz', 0);
  // Modelo 06/16: garantir leitura direta do planificador (sync pode não ter rodado)
  if((modeloSel==='06'||modeloSel==='16') && QTY_FRISO_HORIZ<=0){
    QTY_FRISO_HORIZ = parseInt((document.getElementById('plan-friso-h-qty')||{value:3}).value)||3;
  }

  // ── TRA HOR quantidade = floor(H/1000) por folha (planilha) ─────────────
  // Modelo 06/16: travessas horizontais anuladas (substituídas por frisos horizontais)
  var _isFrisoHMod = (modeloSel==='06'||modeloSel==='16');
  var TRA_HOR_QTY_PF = _semModelo ? 0 : (_isFrisoHMod ? 0 : N_H);
  var TRA_HOR_QTY    = TRA_HOR_QTY_PF * nFolhas;

  function selBar(c){return c<=6000?6000:c<=7000?7000:8000;}
  var PINTADOS=['PA-PA006F','PA-PA006P','PA-PA006V','PA-PA007F','PA-PA007P','PA-PA007V','PA-CANT-30X30X2.0'];
  function isPintado(cod){return PINTADOS.some(function(p){return cod.indexOf(p)===0;});}
  function getPerf(code){
    for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===code)return PERFIS_DB[i];}
    var base=code.replace(/-[678]M$/,'');
    for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===base)return PERFIS_DB[i];}
    return null;
  }
  function getPrecoKg(p){
    if(!p)return kgMerc;
    var f=p.f||'';
    if(f==='TECNOPERFIL'||f==='PROJETTA')return kgTecno;
    if(f==='WEIKU')return kgWeiku;
    if(f==='PERFISUD')return kgTecno;
    return kgMerc;
  }
  function getPrecoKgBru(p){
    if(!p)return kgMercBru;
    var f=p.f||'';
    if(f==='TECNOPERFIL'||f==='PROJETTA')return kgTecnoBru;
    if(f==='WEIKU')return kgWeikuBru;
    if(f==='PERFISUD')return kgTecnoBru;
    return kgMercBru;
  }

  // ── FÓRMULAS PROJETTA (planilha FORMULAS_PARA_PERFIS.xlsx) ────────────────
  // PA ALTURA FOLHA: ALTURA - FGA - TUBLPORTAL - ESPPIV + TRANSPIV
  var PA_F = Math.round(H - FGA - TUB - PIV + TRANS);

  // TRAV VERT: ALTURA - FGA - TUBLPORTAL - ESPPIV - VEDPT - VEDPT - TUBLPORTA - TUBLPORTA
  var TRAV_V = Math.round(H - FGA - TUB - PIV - 2*VED_PORTA - 2*TUBO_LAR_INT);

  // TUB CAVA = TRAV_V - 20 (cantoneira)
  var TUB_CA  = Math.round(TRAV_V - 20);
  var CANT_CA = TRAV_V;

  // LAR INF & SUP: 
  // 1 folha: LARGURA - FGLD - FGLE - 171.7 - 171.5
  // 2 folhas: (LARGURA - FGLD - FGLE - 171.7 - 171.5 - 235) / 2
  var LAR_IS = nFolhas === 2
    ? Math.round((L - FGL - FGR - 171.7 - 171.5 - 235) / 2)
    : Math.round(L - FGL - FGR - 171.7 - 171.5);

  // VEDA PORTA (VED INF & SUP): LAR_IS + 110 + 110
  var VED_IS = Math.round(LAR_IS + 110 + 110);

  // CANAL ESCOVA: VEDA PORTA + 10
  var CAN_E  = Math.round(VED_IS + 10);

  // TRA HOR MEIO = LAR INF & SUP (mesma fórmula da planilha)
  var TRA_HM = LAR_IS;

  // FRISO HORIZ: mesmo comprimento que LAR INF & SUP
  var FRISO_H = LAR_IS;

  // ALT PORTAL: ALTURA - FGA - TUBLPORTAL - ESPACM
  var PA_P   = Math.round(H - FGA - TUB - ESPACM);

  // LAR PORTAL: LARGURA - FGLD - FGLE
  var LAR_PO = Math.round(L - FGL - FGR);

  // TRA PORTAL (OLHAL): LARGURA - FGLD - FGLE - 46.5 - 46.5
  var TRA_PO = Math.round(L - FGL - FGR - 46.5 - 46.5);

  // VEDA PORTA (componente — borracha de vedação, não perfil)
  var FOLHA_PA_PA  = L - FGL - FGR - 125;
  var VEDA_SIZE    = Math.max(720, (Math.ceil((FOLHA_PA_PA - 620) / 100) * 100) + 620);
  var VEDA_CODE    = 'PA-VED' + VEDA_SIZE;
  var VEDA_QTY     = nFolhas === 2 ? 4 : 2;

  if(PA_F<=0||TRAV_V<=0||LAR_IS<=0||TRA_HM<=0)
    return {error:'Dimensoes invalidas para '+sis+'. Verifique L e H.'};

  // ── ENCHIMENTOS (100mm × comprimento × 2 frente/costas) ──────────────────
  var ENCH_W=100; // largura enchimento em mm
  var enchVertArea=ENCH_W*TRAV_V*2*TRAV_V_QTY/1e6; // m² (frente+costas × qty)
  var enchHorArea=ENCH_W*TRA_HM*2*(N_H*nFolhas)/1e6; // m²
  // Enchimento fixo largura (cima+baixo, frente+costas): usa VEDA_SIZE como medida largura
  var enchFixoArea=ENCH_W*VEDA_SIZE*2*2*nFolhas/1e6; // 2=cima+baixo, 2=frente+costas
  var enchTotalArea=enchVertArea+enchHorArea+enchFixoArea;
  var enchPeso=enchTotalArea*6.5; // kg (mesma densidade ACM)
  window._enchimentoPeso=enchPeso;
  window._enchimentoDetail={vert:enchVertArea,hor:enchHorArea,fixo:enchFixoArea,total:enchTotalArea,kg:enchPeso};

  // ── LÃ DE ROCHA (32 kg/m³) ──────────────────────────────────────────────
  var espPorta=sis==='PA007'?110:90; // mm
  var laVolume=(LAR_IS*TRAV_V*espPorta)/1e9; // m³
  var laPeso=laVolume*32; // 32 kg/m³
  window._laRochaPeso=laPeso;
  window._laRochaDetail={largura:LAR_IS,altura:TRAV_V,esp:espPorta,vol:laVolume,kg:laPeso};

  var paFBarLen=selBar(PA_F), paPBarLen=selBar(PA_P);

  // ── LISTA DE CORTES ────────────────────────────────────────────────────────
  // Quantidade travessa vertical = 2 (com cava obrigatório)
  // Quantidade friso vertical = 2 (mesmo que trav vert)
  // Quantidade travessa/friso horizontal = N_H × 2 (por folha)
  // 2 folhas → dobro em todos os perfis de folha
  var cuts = [
    // FOLHA — perfis especiais
    {code:C.pa_altura+'-'+paFBarLen/1000+'M', desc:'PA ALTURA',      compMM:PA_F,    qty:2*nFolhas,     pintado:true, secao:'FOLHA', barLenMM:paFBarLen, lh:'90/90 A', obs:'BNF-TECNO'},
    // FOLHA — travessas estruturais (verticais)
    // Modelo 22: 2 obrigatórias por folha em 101×101 (= lar_inf_sup), demais em 101×51
    {code:modeloSel==='22'?C.lar_inf_sup:C.trav_vert, desc:modeloSel==='22'?'TRAV VERT 101':'TRAV VERT', compMM:TRAV_V, qty:modeloSel==='22'?2*nFolhas:TRAV_V_QTY, pintado:false,secao:'FOLHA', barLenMM:barraMM, lh:'90/90 A', obs:'BRUTO'},
    {code:C.trav_vert,   desc:'TRAV VERT',     compMM:TRAV_V,        qty:modeloSel==='22'?Math.max(0,TRAV_V_QTY-2*nFolhas):0, pintado:false,secao:'FOLHA', barLenMM:barraMM, lh:'90/90 A', obs:'BRUTO'},
    {code:C.tub_cava,    desc:'TUB CAVA',      compMM:TUB_CA,        qty:(temCava&&modeloSel!=='22')?2*nFolhas:0, pintado:false,secao:'FOLHA', barLenMM:barraMM,   lh:'90/90 A', obs:'BRUTO'},
    {code:C.cant_cava,   desc:'CANT CAVA',     compMM:CANT_CA,       qty:(temCava&&modeloSel!=='22')?4*nFolhas:0, pintado:true, secao:'FOLHA', barLenMM:barraMM,   lh:'90/90 A', obs:'BNF-TECNO'},
    // FOLHA — travessas estruturais (horizontais)
    {code:C.lar_inf_sup, desc:'LAR INF & SUP', compMM:LAR_IS,        qty:2*nFolhas,     pintado:false,secao:'FOLHA', barLenMM:barraMM,   lh:'90/90 L', obs:'BRUTO'},
    {code:C.ved_inf_sup, desc:'VED INF & SUP', compMM:VED_IS,        qty:2*nFolhas,     pintado:true, secao:'FOLHA', barLenMM:barraMM,   lh:'90/90 L', obs:'BNF-TECNO'},
    {code:C.canal_esc,   desc:'CANAL ESC',     compMM:CAN_E,         qty:2*nFolhas,     pintado:false,secao:'FOLHA', barLenMM:barraMM,   lh:'90/90 L', obs:'BRUTO'},
    {code:C.tra_hor,     desc:'TRAVESSA HORIZONTAL',  compMM:TRA_HM,        qty:TRA_HOR_QTY,   pintado:false,secao:'FOLHA', barLenMM:barraMM,   lh:'90/90 L', obs:'BRUTO'},
    {code:C.travamento,  desc:'TRAVAMENTO CAVA',compMM:TRAV_CAVA,    qty:(temCava && sis==='PA007')?N_H*nFolhas:0,   pintado:false,secao:'FOLHA', barLenMM:barraMM,   lh:'90/90 L', obs:'BRUTO'},
    // FOLHA — frisos (friso vert = mesmo corte que trav vert)
    {code:C.friso_vert,  desc:'FRISO VERT',    compMM:TRAV_V,        qty:QTY_FRISO_VERT,  pintado:false,secao:'FOLHA', barLenMM:barraMM,   lh:'90/90 A', obs:'BRUTO'},
    // FOLHA — friso horiz = mesmo corte que LAR INF & SUP
    {code:C.friso_horiz, desc:'FRISO HORIZ',   compMM:FRISO_H,       qty:QTY_FRISO_HORIZ, pintado:false,secao:'FOLHA', barLenMM:barraMM,   lh:'90/90 L', obs:'BRUTO'},
    // PORTAL
    {code:C.lar_portal,  desc:'LAR PORTAL',    compMM:LAR_PO,        qty:1,             pintado:false,secao:'PORTAL',barLenMM:barraMM,   lh:'90/90 L', obs:'BRUTO'},
    {code:C.alt_portal+'-'+paPBarLen/1000+'M',desc:'ALT PORTAL',     compMM:PA_P,       qty:2,         pintado:true, secao:'PORTAL',barLenMM:paPBarLen, lh:'90/90 A', obs:'BNF-TECNO'},
    {code:C.tra_portal,  desc:'TRA PORTAL',    compMM:TRA_PO,        qty:3,             pintado:false,secao:'PORTAL',barLenMM:barraMM,   lh:'90/90 L', obs:'BRUTO'},
  ];

  // ── MODELO 23 MACIÇO: adicionar barras PA-PERFILBOISERIE ──────────────────
  if(modeloSel==='23'){
    var _moldRev=(document.getElementById('plan-moldura-rev')||{value:'ACM'}).value;
    if(_moldRev==='MACICO'){
      var _N_COL=parseInt((document.getElementById('plan-moldura-larg-qty')||{value:2}).value)||2;
      var _N_ROW=parseInt((document.getElementById('plan-moldura-alt-qty')||{value:2}).value)||2;
      var _CENTRO=1048, _FRAME_B=75;
      var _nNiveis=parseInt((document.getElementById('plan-moldura-tipo')||{value:1}).value)||1;
      var _dis1=parseInt((document.getElementById('plan-moldura-dis1')||{value:150}).value)||150;
      var _dis2=parseInt((document.getElementById('plan-moldura-dis2')||{value:150}).value)||150;
      var _dis3=parseInt((document.getElementById('plan-moldura-dis3')||{value:150}).value)||150;
      var _disArr=[_dis1,_dis2,_dis3];
      var _facesMult1=nFolhas===1?2:4; // faces para vert (1flh=2, 2flh=4)

      // Gerar boiserie para cada nível de moldura (Simples/Dupla/Tripla)
      for(var _nv=0;_nv<_nNiveis;_nv++){
        var _dedTotal=0;
        for(var _di=0;_di<=_nv;_di++) _dedTotal+=_disArr[_di]*2;
        var _nvLabel=_nNiveis>1?' N'+(_nv+1):'';

        // ── HORIZONTAIS (largura = TAMPA - dedução) ──
        if(nFolhas===1){
          var _tampaW=L-140;
          var _boisH=Math.round(_tampaW-_dedTotal);
          if(_boisH>50) cuts.push({code:'PA-PERFILBOISERIE', desc:'BOISERIE HORIZ'+_nvLabel, compMM:_boisH,
            qty:_N_ROW*4, pintado:true, secao:'FOLHA', barLenMM:6000, lh:'90/90 L', obs:'R$150/BARRA',
            perf:{c:'PA-PERFILBOISERIE',kg:0.293,f:'MERCADO',p:0}, _isBoiserie:true, _barPrice:150});
        } else {
          var _baseMac=(L-97)/2;
          var _T1=Math.round(_baseMac+16);
          var _T2=Math.round(_baseMac-PIV);
          var _T3=Math.round(_T2-TUB+TRANS);
          var _bH1=Math.round(_T1-_dedTotal);
          var _bH2=Math.round(_T2-_dedTotal);
          var _bH3=Math.round(_T3-_dedTotal);
          if(_bH1>50) cuts.push({code:'PA-PERFILBOISERIE', desc:'BOISERIE H (T1)'+_nvLabel, compMM:_bH1,
            qty:_N_ROW*2, pintado:true, secao:'FOLHA', barLenMM:6000, lh:'90/90 L', obs:'R$150/BARRA',
            perf:{c:'PA-PERFILBOISERIE',kg:0.293,f:'MERCADO',p:0}, _isBoiserie:true, _barPrice:150});
          if(_bH2>50) cuts.push({code:'PA-PERFILBOISERIE', desc:'BOISERIE H (T2)'+_nvLabel, compMM:_bH2,
            qty:_N_ROW*4, pintado:true, secao:'FOLHA', barLenMM:6000, lh:'90/90 L', obs:'R$150/BARRA',
            perf:{c:'PA-PERFILBOISERIE',kg:0.293,f:'MERCADO',p:0}, _isBoiserie:true, _barPrice:150});
          if(_bH3>50) cuts.push({code:'PA-PERFILBOISERIE', desc:'BOISERIE H (T3)'+_nvLabel, compMM:_bH3,
            qty:_N_ROW*2, pintado:true, secao:'FOLHA', barLenMM:6000, lh:'90/90 L', obs:'R$150/BARRA',
            perf:{c:'PA-PERFILBOISERIE',kg:0.293,f:'MERCADO',p:0}, _isBoiserie:true, _barPrice:150});
        }

        // ── VERTICAIS (altura por bloco) ──
        if(_N_ROW===2){
          // 2 blocos: fixo no CENTRO=1048 (compatível com CAD)
          var _moldInf=_CENTRO-_dedTotal/2-_FRAME_B;
          var _moldSup=Math.round(PA_F-_CENTRO-_dedTotal/2-_FRAME_B);
          if(_moldInf>50) cuts.push({code:'PA-PERFILBOISERIE', desc:'BOISERIE VERT INF'+_nvLabel, compMM:Math.round(_moldInf),
            qty:_N_COL*_facesMult1, pintado:true, secao:'FOLHA', barLenMM:6000, lh:'90/90 A', obs:'R$150/BARRA',
            perf:{c:'PA-PERFILBOISERIE',kg:0.293,f:'MERCADO',p:0}, _isBoiserie:true, _barPrice:150});
          if(_moldSup>50) cuts.push({code:'PA-PERFILBOISERIE', desc:'BOISERIE VERT SUP'+_nvLabel, compMM:_moldSup,
            qty:_N_COL*_facesMult1, pintado:true, secao:'FOLHA', barLenMM:6000, lh:'90/90 A', obs:'R$150/BARRA',
            perf:{c:'PA-PERFILBOISERIE',kg:0.293,f:'MERCADO',p:0}, _isBoiserie:true, _barPrice:150});
        } else {
          // 3+ blocos: dividir igualmente — (N+1) espaçamentos de DIS entre blocos
          var _disPerGap=_dedTotal/2; // DIS por gap (ex: 150mm)
          var _usableH=PA_F-(_N_ROW+1)*_disPerGap;
          var _blockH=Math.round(_usableH/_N_ROW);
          if(_blockH>50) cuts.push({code:'PA-PERFILBOISERIE', desc:'BOISERIE VERT'+_nvLabel, compMM:_blockH,
            qty:_N_COL*_facesMult1*_N_ROW, pintado:true, secao:'FOLHA', barLenMM:6000, lh:'90/90 A', obs:'R$150/BARRA',
            perf:{c:'PA-PERFILBOISERIE',kg:0.293,f:'MERCADO',p:0}, _isBoiserie:true, _barPrice:150});
        }
      }
    }
  }

  // ── RIPADO: tubo PA-51X25X1.5 suporte das ripas ──────────────────────────
  var _isRipMod = ['08','15','20','21'].indexOf(modeloSel) >= 0;
  if(_isRipMod && window._qtdRipasTotal > 0){
    // Qty ripas vem do planificador (window._qtdRipasTotal) — já inclui 2 lados e folhas
    var _totalRipas = window._qtdRipasTotal * nFolhas;
    // Suporte: tubo 51×25, comprimento 500mm, qty = round(PA_F/1000) × total ripas
    var _nSupPorRipa = Math.max(1, Math.round(PA_F / 1000));
    var _totalSup = _nSupPorRipa * _totalRipas;
    cuts.push({code:'PA-51X25X1.5', desc:'SUPORTE RIPA 51×25', compMM:500,
      qty:_totalSup, pintado:false, secao:'FOLHA', barLenMM:barraMM,
      lh:'90/90 L', obs:'BRUTO'});
  }

  // ── REVESTIMENTO RIPADO: tubos PA-51X25X1.5 de fixação das ripas de parede ─
  // ★ Felipe 23/04: quando o orçamento tem revestimentos ripados (parede),
  //   cada ripa precisa de tubos horizontais de 500mm a cada 1000mm de altura.
  //   Qty por item = ceil(L/90) ripas × ceil(A/1000) tubos × qtd. Agrupa no
  //   mesmo código PA-51X25X1.5 da porta — somam no mesmo groupRes e aparecem
  //   como 1 único bloco no visual do Levantamento de Perfis.
  var _revRip = (window._orcItens||[]).filter(function(it){
    return it.tipo==='revestimento' && it.rev_tipo==='RIPADO' && (it.largura||0)>0 && (it.altura||0)>0;
  });
  if(_revRip.length > 0){
    var _totalTubosRev = 0;
    var _descDetalhes = [];
    _revRip.forEach(function(it, idx){
      var _Lr = parseFloat(it.largura)||0;
      var _Ar = parseFloat(it.altura)||0;
      var _Qr = parseInt(it.qtd)||1;
      if(!_Lr || !_Ar) return;
      var _nRipas = Math.ceil(_Lr/90);
      var _nTubosRipa = Math.max(1, Math.ceil(_Ar/1000));
      var _qtyItem = _nRipas * _nTubosRipa * _Qr;
      _totalTubosRev += _qtyItem;
      _descDetalhes.push('REV'+(idx+1)+':'+_qtyItem);
    });
    if(_totalTubosRev > 0){
      cuts.push({code:'PA-51X25X1.5',
        desc:'FIXAÇÃO RIPAS REVESTIMENTO ('+_descDetalhes.join(' ')+')',
        compMM:500, qty:_totalTubosRev, pintado:false, secao:'FOLHA',
        barLenMM:barraMM, lh:'90/90 L', obs:'BRUTO REV'});
    }
  }

  cuts.forEach(function(c){if(!c.perf){c.perf=getPerf(c.code);c.kgM=c.perf?c.perf.kg:0;}else{c.kgM=c.perf.kg||0;}});

  // ── Regra de emenda: corte > barLen-10mm → split em peças ──────────────────
  // PA007P/F/V podem usar 7m e 8m. Todos os outros: max 6m.
  // Kerf: 4mm por corte. End waste: 10mm por barra (furo da pintura).
  function _splitCut(compMM, barLen){
    var END=10, KERF=4;
    var usable=barLen-END; // ex: 5990mm para barra 6m
    if(compMM<=usable) return [compMM];
    var pieces=[], rem=compMM;
    while(rem>usable){ pieces.push(usable); rem=rem-usable; }
    // Complemento = sobra exata (kerf fica no aproveitamento da barra, não no corte)
    pieces.push(Math.round(rem));
    return pieces;
  }

  // Regra de barra por código:
  // Só códigos com -7M ou -8M no nome podem ter cortes > 6m
  // Ex: PA-PA007F-7M → 7000mm | PA-PA007P-8M → 8000mm
  // Todos os outros: forçar 6000mm
  cuts.forEach(function(c){
    var has7M = c.code.indexOf('-7M')>=0;
    var has8M = c.code.indexOf('-8M')>=0;
    if(has7M)       c.barLenMM=7000;
    else if(has8M)  c.barLenMM=8000;
    else            c.barLenMM=6000; // TODOS os outros = 6m fixo
    var usable = c.barLenMM-10;
    c.isSplit = c.compMM > usable;
    if(c.isSplit){
      var ps=_splitCut(c.compMM,c.barLenMM);
      c.splitPieces=ps;
      c.splitDesc='(emenda: '+ps[0]+'+'+(ps.slice(1).join('+'))+'mm)';
    }
  });

  // ── Multiplicar cortes por qtd portas ANTES da otimização de barras ──
  var _qPerfis=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
  if(_qPerfis>1){
    cuts.forEach(function(c){ c.qty=c.qty*_qPerfis; });
  }
  // DEBUG: verificar quantidades

  var groups={},seenKeys=[];
  cuts.forEach(function(c){
    var key=c.code;
    if(!groups[key]){groups[key]={code:key,allCuts:[],pintado:c.pintado,barLenMM:c.barLenMM,perf:c.perf,precoKg:getPrecoKg(c.perf),precoKgBru:getPrecoKgBru(c.perf),_isBoiserie:!!c._isBoiserie,_barPrice:c._barPrice||0};seenKeys.push(key);}
    for(var i=0;i<c.qty;i++){
      if(c.isSplit && c.splitPieces){
        c.splitPieces.forEach(function(p){ groups[key].allCuts.push(p); });
      } else {
        groups[key].allCuts.push(c.compMM);
      }
    }
  });

  var groupRes={};
  seenKeys.forEach(function(key){
    var g=groups[key];
    var bars=binPackFFD(g.allCuts,g.barLenMM);
    var nBars=bars.length;
    var totUsed =g.allCuts.reduce(function(s,x){return s+x;},0);
    var totBruto=bars.reduce(function(s,b){return s+b.barLen;},0);
    var aprov   =totBruto>0?totUsed/totBruto*100:0;
    var kgM     =g.perf?g.perf.kg:0;
    var kgLiq   =totUsed/1000*kgM;
    var kgBruto =totBruto/1000*kgM;
    var custoPerfil =kgBruto*g.precoKg;
    var custoPintura=g.pintado?kgBruto*precoPint:0;
    var custoPerfilBru =kgBruto*g.precoKgBru;
    var custoPinturaBru=g.pintado?kgBruto*precoPintBru:0;
    // Boiserie: preço fixo R$150/barra (já inclui pintura)
    if(g._isBoiserie && g._barPrice){
      custoPerfil=nBars*g._barPrice;
      custoPerfilBru=nBars*g._barPrice;
      custoPintura=0;
      custoPinturaBru=0;
    }
    var barsDetail=bars.map(function(b){
      return {len:b.barLen,items:b.items.slice().sort(function(a,x){return x-a;}),
              remaining:b.remaining,sobra:b.sobra!=null?b.sobra:b.remaining};
    });
    groupRes[key]={nBars:nBars,totUsed:totUsed,totBruto:totBruto,aprov:aprov,
      kgLiq:kgLiq,kgBruto:kgBruto,precoKg:g.precoKg,
      custoPerfil:custoPerfil,custoPintura:custoPintura,custoTotal:custoPerfil+custoPintura,
      custoPerfilBru:custoPerfilBru,custoPinturaBru:custoPinturaBru,custoTotalBru:custoPerfilBru+custoPinturaBru,
      barLenMM:g.barLenMM,pintado:g.pintado,barsDetail:barsDetail,
      _isBoiserie:!!g._isBoiserie,_barPrice:g._barPrice||0};
  });

  // Peso líquido só da FOLHA + FRISO (perfis da porta, sem portal/fixo)
  var pesoPerfisFolha=0;
  cuts.forEach(function(c){
    if((c.secao==='FOLHA'||c.secao==='FRISO') && c.perf){
      pesoPerfisFolha+=(c.compMM/1000)*(c.perf.kg||0)*c.qty;
    }
  });
  window._pesoPerfisFolha=pesoPerfisFolha;

  return {cuts:cuts,groupRes:groupRes,seenKeys:seenKeys,sis:sis,N_H:N_H,
          temCava:temCava,larguraCava:LARGURA_CAVA,travCavaSize:TRAV_CAVA,
          vedaSize:VEDA_SIZE,vedaCode:VEDA_CODE,vedaQty:VEDA_QTY,folhaPAPA:FOLHA_PA_PA,
          kgTecno:kgTecno,kgMerc:kgMerc,precoPint:precoPint,isPintado:isPintado,
          kgTecnoBru:kgTecnoBru,kgMercBru:kgMercBru,kgWeikuBru:kgWeikuBru,precoPintBru:precoPintBru,
          dedTecno:dedTecno,dedMerc:dedMerc,dedWeiku:dedWeiku,dedPint:dedPint};
}

// ── BAR VISUAL HELPERS ─────────────────────────────────────────────────────────

/* ══ END MODULE: ENGENHARIA_PERFIS ══ */
