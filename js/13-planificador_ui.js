/**
 * 13-planificador_ui.js
 * Module: PLANIFICADOR_UI
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: PLANIFICADOR_UI ══ */
/* ══════════════════════════════════════════════════════
   PLANIFICAR CHAPAS — integrado na precificação
   Kerf: 4mm fixo | Borda: 10mm fixo | Rotação: não
   L e A vêm dos campos largura/altura do orçamento
══════════════════════════════════════════════════════ */

var PLN_COLORS = [
  '#4e79a7','#e8851a','#59a14f','#76b7b2','#e15759',
  '#b07aa1','#9c755f','#bab0ac','#6ea6c8','#f7b4b4',
  '#a2d6a0','#ffd880','#c5a0d8','#80c8c0','#d49856',
  '#a0c4e0','#e0a0c0','#98d498','#c8b060','#edc948'
];

var PLN_KERF = 4;    // 4mm fresa por corte
var PLN_MG   = 5;    // 5mm folga de borda cada lado
var PLN_RES  = null;
var PLN_CSI  = 0;
var PLN_SD   = { w: 1500, h: 5000 };

/* ── CALCULAR PECAS ─────────────────────────────────── */
function plnPecas(Lmm, Amm, fol, mod) {
  var L  = Math.round(Lmm);
  var A  = Math.round(Amm);
  var TUB_SUP = (typeof _isInternacional==='function'&&_isInternacional())?51:(A < 4000 ? 38 : 51);
  var FGA = 10, PIV = 28, TRANS_PIV = 8, FGLA = 20, REF = parseInt((document.getElementById('plan-refilado')||{value:20}).value)||20;
  var G4 = A - FGA - TUB_SUP - PIV + TRANS_PIV;
  var G2total = L - FGLA - 343 + 256;
  var G3 = L - FGLA - 343 + 218;
  var fW = (fol == 2) ? Math.round(G2total / 2) : G3;
  var bH = G4 + 116;
  var nL = (fol == 2) ? 4 : 2;
  var acabLat1 = (fol == 2) ? 89 : 88.5;
  var r  = [];

  /* MODELOS LISA (10, 11, 15, 23) */
  if (mod === '10' || mod === '11' || mod === '15' || mod === '23acm' || mod === '23alu') {
    // Detectar MACICO para modelo 23
    var _isMacico = (mod === '23acm' || mod === '23alu') && (document.getElementById('plan-moldura-rev')||{value:'ACM'}).value === 'MACICO';
    var _mAlu = _isMacico ? 'alu' : 'acm';  // TAMPA+FIT → chapa ALU separada
    var LARG_FRISO = 0, DIS_BOR_FRI = 0, frisoDeduc = 0;
    if (mod === '11') {
      LARG_FRISO  = parseInt(document.getElementById('plan-largfriso').value) || 10;
      DIS_BOR_FRI = parseInt(document.getElementById('plan-disbordafriso').value) || 210;
      frisoDeduc = DIS_BOR_FRI + LARG_FRISO;
    }
    if (fol == 1) {
      if(_isMacico){
        // Maciço 1FLH: TAMPA = L - 140 (ref Excel MACICO)
        var _tamMac1 = L - 140;
        r.push(['TAMPA MAIOR', _tamMac1, G4, 2, _mAlu]);
      } else if(mod === '23acm' || mod === '23alu'){
        // ACM 1FLH mod23: TAMPA = L - 105 (ref Excel ACM)
        r.push(['TAMPA MAIOR', L - 105, G4, 2]);
      } else {
        r.push(['TAMPA MAIOR', fW + 2*REF - frisoDeduc, G4, 2, _mAlu]);
      }
    } else {
      if(_isMacico){
        // Maciço 2FLH: base = (L-97)/2
        var _base2Mac = (L - 97) / 2;
        var _T1m = _base2Mac + 16;
        var _T2m = _base2Mac - PIV;
        var _T3m = _T2m - TUB_SUP + TRANS_PIV;
        r.push(['TAMPA MAIOR 01', _T1m, G4, 1, _mAlu]);
        r.push(['TAMPA MAIOR 02', _T2m, G4, 2, _mAlu]);
        r.push(['TAMPA MAIOR 03', _T3m, G4, 1, _mAlu]);
      } else if(mod === '23acm' || mod === '23alu'){
        // ACM 2FLH mod23: base = (L-107)/2 (ref Excel ACM) [107 = 2*FGL(2.5) + 2*TUB]
        var _base2Acm = (L - 5 - 2*TUB_SUP) / 2;
        var _T1a = _base2Acm + FGA + FGLA*2 - 1;
        var _T2a = _base2Acm + FGLA*2 - PIV;
        var _T3a = _T2a - 38; // deducção fixa 38mm para ACM mod23
        r.push(['TAMPA MAIOR 01', _T1a, G4, 1]);
        r.push(['TAMPA MAIOR 02', _T2a, G4, 2]);
        r.push(['TAMPA MAIOR 03', _T3a, G4, 1]);
      } else {
        var base2 = G2total / 2;
        var T1 = base2 + FGA + FGLA*2 - 1;
        var T2 = base2 + FGLA*2 - PIV;
        var T3 = T2 - TUB_SUP;
        r.push(['TAMPA MAIOR 01', T1, G4, 1, _mAlu]);
        r.push(['TAMPA MAIOR 02', T2, G4, 2, _mAlu]);
        r.push(['TAMPA MAIOR 03', T3, G4, 1, _mAlu]);
      }
    }
    if (mod === '11') {
      r.push(['TAMPA FRISO', DIS_BOR_FRI + (2*REF-1), G4, (fol==2) ? 4 : 2]);
      r.push(['FRISO', LARG_FRISO + 100, G4, (fol==2) ? 4 : 2]);
    }
    if(_isMacico){
      // Maciço: só ACAB_LAT_Z (sem LAT_1 e LAT_2)
      r.push(['ACAB LAT Z', 110, G4, nL]);
    } else {
      r.push(['ACAB LAT 1', acabLat1, G4, nL], ['ACAB LAT 2', 90, G4, nL], ['ACAB LAT Z', 110, G4, nL]);
    }
    r.push(['U PORTAL', 221, L-REF, 1]);
    r.push(['BAT 01', 42, bH, 2], ['BAT 02Z', 51, bH, 2], ['BAT 03', 81, bH, 2]);
    r.push(['TAP FURO', 119, bH, _isMacico?4:3]);
    if(_isMacico){
      // FIT maciço: dimensões do Excel (35, 75, 60)
      r.push(['FIT ACAB ME', 35, bH, 2, _mAlu], ['FIT ACAB MA', 75, bH, 2, _mAlu], ['FIT ACAB FITA', 60, bH, 2, _mAlu]);
    } else {
      r.push(['FIT ACAB ME', 76.5, bH, 2, _mAlu], ['FIT ACAB MA', 114.5, bH, 2, _mAlu], ['FIT ACAB FITA', 101, bH, 2, _mAlu]);
    }
    if(document.getElementById('carac-tem-alisar')&&document.getElementById('carac-tem-alisar').checked) r.push(['ALISAR ALT', 225, A+150, 5], ['ALISAR LAR', 225, L+300, 2]);
    if (mod === '23acm' || mod === '23alu') {
      var _moldRev = (document.getElementById('plan-moldura-rev')||{value:'ACM'}).value;
      // Molduras ACM: peças 143mm largura no planificador (mesmas fórmulas da boiserie)
      if (_moldRev !== 'MACICO') {
        var _MW=143; // largura fixa moldura ACM
        var _N_COL_P=parseInt((document.getElementById('plan-moldura-larg-qty')||{value:2}).value)||2;
        var _N_ROW_P=parseInt((document.getElementById('plan-moldura-alt-qty')||{value:2}).value)||2;
        var _nNiveisP=parseInt((document.getElementById('plan-moldura-tipo')||{value:1}).value)||1;
        var _dis1P=parseInt((document.getElementById('plan-moldura-dis1')||{value:150}).value)||150;
        var _dis2P=parseInt((document.getElementById('plan-moldura-dis2')||{value:150}).value)||150;
        var _dis3P=parseInt((document.getElementById('plan-moldura-dis3')||{value:150}).value)||150;
        var _disArrP=[_dis1P,_dis2P,_dis3P];
        var _CENTRO_P=1048;
        var _fmP=fol==2?4:2; // faces (frente+verso × folhas)

        for(var _nvP=0;_nvP<_nNiveisP;_nvP++){
          var _dedP=0;
          for(var _dj=0;_dj<=_nvP;_dj++) _dedP+=_disArrP[_dj]*2;
          var _nvL=_nNiveisP>1?' N'+(_nvP+1):'';

          // ── HORIZONTAIS: MOLD = TAMPA_ACM - 2*REF - DIS×2 (ref Excel ACM) ──
          if(fol==1){
            var _tAcm=L-105; // TAMPA ACM 1FLH
            var _mH=Math.round(_tAcm-2*REF-_dedP);
            if(_mH>50) r.push(['MOLD HORIZ'+_nvL, _MW, _mH, _N_ROW_P*2]);
          } else {
            // 2flh: usar fórmulas ACM mod23 (base=(L-107)/2)
            var _bAcm=(L-5-2*TUB_SUP)/2;
            var _aT1=_bAcm+FGA+FGLA*2-1;
            var _aT2=_bAcm+FGLA*2-PIV;
            var _aT3=_aT2-38;
            var _mT1=Math.round(_aT1-2*REF-_dedP);
            var _mT2=Math.round(_aT2-2*REF-_dedP);
            var _mT3=Math.round(_aT3-2*REF-_dedP);
            if(_mT1>50) r.push(['MOLD H (T1)'+_nvL, _MW, _mT1, _N_ROW_P*2]);
            if(_mT2>50) r.push(['MOLD H (T2)'+_nvL, _MW, _mT2, _N_ROW_P*4]);
            if(_mT3>50) r.push(['MOLD H (T3)'+_nvL, _MW, _mT3, _N_ROW_P*2]);
          }

          // ── VERTICAIS: altura por bloco ──
          if(_N_ROW_P===2){
            // Clássica: 2 blocos fixos no CENTRO
            var _vInf=_CENTRO_P-_dedP/2-75;
            var _vSup=Math.round(G4-_CENTRO_P-_dedP/2-75);
            if(_vInf>50) r.push(['MOLD VERT INF'+_nvL, _MW, Math.round(_vInf), _N_COL_P*_fmP]);
            if(_vSup>50) r.push(['MOLD VERT SUP'+_nvL, _MW, _vSup, _N_COL_P*_fmP]);
          } else {
            // Igual: N blocos
            var _disGapP=_dedP/2;
            var _usH=G4-(_N_ROW_P+1)*_disGapP;
            var _blH=Math.round(_usH/_N_ROW_P);
            if(_blH>50) r.push(['MOLD VERT'+_nvL, _MW, _blH, _N_COL_P*_fmP*_N_ROW_P]);
          }
        }
      } // end if not MACICO
    }
    if (mod === '15') {
      var _rip2L15=($('carac-ripado-2lados')||{value:'SIM'}).value==='SIM';
      var _ripTotal15=($('carac-ripado-total')||{value:'NAO'}).value==='SIM';
      var qtdRipas15 = _ripTotal15
        ? Math.ceil(fW / 90)
        : Math.ceil((fW - acabLat1*2 - 90 - 110) / 90);
      var qtdRipasTotal15 = qtdRipas15 * (_rip2L15 ? 2 : 1);
      window._qtdRipasTotal = qtdRipasTotal15;
      r.push(['RIPAS', 98, G4, qtdRipasTotal15]);
    }
  }

  /* MODELOS CAVA (01, 02, 08) */
  if (mod === '01' || mod === '02' || mod === '07' || mod === '08') {
    var DIS_BOR_CAVA = parseInt(document.getElementById('plan-disborcava').value) || 210;
    var LARG_CAVA    = parseInt(document.getElementById('plan-largcava').value)   || 150;
    // Cava altura = TRAV_V - 12mm
    var _VED=35, _TUBO_LAR=(TUB_SUP>=51)?101.8:76.2;
    var _TRAV_V=Math.round(A-FGA-TUB_SUP-PIV-2*_VED-2*_TUBO_LAR);
    var cavaH = Math.max(0, _TRAV_V - 12);
    var cavaDeduc = LARG_CAVA + DIS_BOR_CAVA + 2;
    var frisoDeduc = 0;
    var LARG_FRISO = 0, DIS_BOR_FRI = 0;
    if (mod === '02') {
      LARG_FRISO  = parseInt(document.getElementById('plan-largfriso').value) || 50;
      DIS_BOR_FRI = parseInt(document.getElementById('plan-disbordafriso').value) || 210;
      var QTY_FRISO_V = parseInt((document.getElementById('plan-friso-v-qty')||{value:1}).value) || 1;
      if (QTY_FRISO_V < 1) QTY_FRISO_V = 1;
      frisoDeduc = QTY_FRISO_V * (DIS_BOR_FRI + LARG_FRISO);
    }
    // Modelo 07: múltiplas ripas rebaixadas
    var _nRipas07=0, _largRipa07=0, _distRipa07=0;
    if (mod === '07') {
      _nRipas07 = parseInt((document.getElementById('plan-ripa-qty')||{value:5}).value) || 5;
      _largRipa07 = parseInt((document.getElementById('plan-ripa-larg')||{value:50}).value) || 50;
      _distRipa07 = parseInt((document.getElementById('plan-ripa-dist')||{value:10}).value) || 10;
      // Deduz: nRipas × larguraRipa + nRipas × distFriso
      frisoDeduc = _nRipas07 * _largRipa07 + _nRipas07 * _distRipa07;
    }
    r.push(['CAVA', LARG_CAVA + 116, cavaH, (fol==2) ? 4 : 2]);
    r.push(['TAMPA CAVA', LARG_CAVA + 90, DIS_BOR_CAVA, (fol==2) ? 8 : 4]);
    if (fol == 1) {
      var tampaW = fW + 2*REF - cavaDeduc - frisoDeduc;
      r.push(['TAMPA MAIOR', tampaW, G4, 2]);
    } else {
      var DBC = DIS_BOR_CAVA, LC = LARG_CAVA;
      var baseA = (G2total - DBC*2 - LC*2) / 2;
      var baseB = (G2total - 1 - DBC*2 - LC*2) / 2;
      // Modelo 02: descontar N frisos verticais das tampas (T1, T2, T3 via base)
      if (mod === '02') {
        baseA -= frisoDeduc;
        baseB -= frisoDeduc;
      }
      var T1 = baseA + FGA + FGLA*2 - 1;
      var T2 = baseB + FGLA*2 - PIV - 1;
      var T3 = T2 - TUB_SUP;
      r.push(['TAMPA MAIOR 01', T1, G4, 1]);
      r.push(['TAMPA MAIOR 02', T2, G4, 2]);
      r.push(['TAMPA MAIOR 03', T3, G4, 1]);
    }
    if (fol == 1) {
      r.push(['TAMPA BOR CAVA', DIS_BOR_CAVA + (2*REF-2), G4, 2]);
    } else {
      r.push(['TAMPA MENOR', DIS_BOR_CAVA + REF*2 - 2, G4, 4]);
    }
    if (mod === '02') {
      var _qV02 = parseInt((document.getElementById('plan-friso-v-qty')||{value:1}).value) || 1;
      if (_qV02 < 1) _qV02 = 1;
      r.push(['TAMPA FRISO', DIS_BOR_FRI + (2*REF-1), G4, ((fol==2) ? 4 : 2) * _qV02]);
      r.push(['FRISO', LARG_FRISO + 100, G4, ((fol==2) ? 4 : 2) * _qV02]);
    }
    if (mod === '07') {
      // Cada ripa: FRISO peça = largRipa + 2×REF (refilado)
      var _frisoW07 = _largRipa07 + 2*REF;
      var _qFriso07 = _nRipas07 * (fol==2 ? 4 : 2);
      r.push(['FRISO RIPA', _frisoW07, G4, _qFriso07]);
    }
    r.push(['ACAB LAT 1', acabLat1, G4, nL], ['ACAB LAT 2', 90, G4, nL], ['ACAB LAT Z', 110, G4, nL]);
    r.push(['U PORTAL', 221, L-REF, 1]);
    r.push(['BAT 01', 42, bH, 2], ['BAT 02Z', 51, bH, 2], ['BAT 03', 81, bH, 2]);
    r.push(['TAP FURO', 119, bH, 3], ['FIT ACAB ME', 76.5, bH, 2], ['FIT ACAB MA', 114.5, bH, 2], ['FIT ACAB FITA', 101, bH, 2]);
    if(document.getElementById('carac-tem-alisar')&&document.getElementById('carac-tem-alisar').checked) r.push(['ALISAR ALT', 225, A+150, 5], ['ALISAR LAR', 225, L+300, 2]);
    if (mod === '08') {
      var _rip2L08=($('carac-ripado-2lados')||{value:'SIM'}).value==='SIM';
      var _ripTotal08=($('carac-ripado-total')||{value:'NAO'}).value==='SIM';
      var qtdRipas = _ripTotal08
        ? Math.ceil(fW / 90)
        : Math.ceil((fW - DIS_BOR_CAVA*2 - LARG_CAVA) / 90);
      var qtdRipasTotal = qtdRipas * (_rip2L08 ? 2 : 1);
      window._qtdRipasTotal = qtdRipasTotal;
      r.push(['RIPAS', 98, G4, qtdRipasTotal]);
    }
  }

  /* MODELO 06 — Cava + Frisos Horizontais (chapa dividida em faixas) */
  if (mod === '06') {
    var DIS_BOR_CAVA = parseInt(document.getElementById('plan-disborcava').value) || 210;
    var LARG_CAVA    = parseInt(document.getElementById('plan-largcava').value)   || 150;
    var _VED06=35, _TUBO_LAR06=(TUB_SUP>=51)?101.8:76.2;
    var _TRAV_V06=Math.round(A-FGA-TUB_SUP-PIV-2*_VED06-2*_TUBO_LAR06);
    var cavaH06 = Math.max(0, _TRAV_V06 - 12);
    var cavaDeduc06 = LARG_CAVA + DIS_BOR_CAVA + 2;
    // Parâmetros do friso horizontal
    var N_FRISOS = parseInt((document.getElementById('plan-friso-h-qty')||{value:3}).value) || 3;
    var ESP_FRISO = parseInt((document.getElementById('plan-friso-h-esp')||{value:10}).value) || 10;
    var N_PARTS = N_FRISOS + 1;
    var LIMITE_CHAPA = 1450; // largura útil máxima da chapa (1500 - 20ref - 20ref)
    // Medida bruta de cada faixa = (G4 - gaps dos frisos) / nº partes
    var altUtil = G4 - (N_FRISOS * ESP_FRISO);
    var medidaBruta = altUtil / N_PARTS;
    var medidaCorte = medidaBruta + 2 * REF; // +20 refilado cada lado
    // CAVA (mesma lógica do modelo 01)
    r.push(['CAVA', LARG_CAVA + 116, cavaH06, (fol==2) ? 4 : 2]);
    // TAMPA CAVA — NÃO dividida (peça pequena, mesma do modelo 01)
    r.push(['TAMPA CAVA', LARG_CAVA + 90, DIS_BOR_CAVA, (fol==2) ? 8 : 4]);
    // TAMPA MAIOR — dividida em N_PARTS faixas horizontais
    if (fol == 1) {
      var tampaW06 = fW + 2*REF - cavaDeduc06;
      r.push(['TAMPA MAIOR', tampaW06, medidaCorte, N_PARTS * 2]);
    } else {
      var DBC06 = DIS_BOR_CAVA, LC06 = LARG_CAVA;
      var baseA06 = (G2total - DBC06*2 - LC06*2) / 2;
      var baseB06 = (G2total - 1 - DBC06*2 - LC06*2) / 2;
      var T1_06 = baseA06 + FGA + FGLA*2 - 1;
      var T2_06 = baseB06 + FGLA*2 - PIV - 1;
      var T3_06 = T2_06 - TUB_SUP;
      r.push(['TAMPA MAIOR 01', T1_06, medidaCorte, N_PARTS * 1]);
      r.push(['TAMPA MAIOR 02', T2_06, medidaCorte, N_PARTS * 2]);
      r.push(['TAMPA MAIOR 03', T3_06, medidaCorte, N_PARTS * 1]);
    }
    // TAMPA BOR CAVA — também dividida em faixas
    if (fol == 1) {
      r.push(['TAMPA BOR CAVA', DIS_BOR_CAVA + (2*REF-2), medidaCorte, N_PARTS * 2]);
    } else {
      r.push(['TAMPA MENOR', DIS_BOR_CAVA + REF*2 - 2, medidaCorte, N_PARTS * 4]);
    }
    // Peças padrão (mesma do modelo 01)
    r.push(['ACAB LAT 1', acabLat1, G4, nL], ['ACAB LAT 2', 90, G4, nL], ['ACAB LAT Z', 110, G4, nL]);
    r.push(['U PORTAL', 221, L-REF, 1]);
    r.push(['BAT 01', 42, bH, 2], ['BAT 02Z', 51, bH, 2], ['BAT 03', 81, bH, 2]);
    r.push(['TAP FURO', 119, bH, 3], ['FIT ACAB ME', 76.5, bH, 2], ['FIT ACAB MA', 114.5, bH, 2], ['FIT ACAB FITA', 101, bH, 2]);
    if(document.getElementById('carac-tem-alisar')&&document.getElementById('carac-tem-alisar').checked) r.push(['ALISAR ALT', 225, A+150, 5], ['ALISAR LAR', 225, L+300, 2]);
    // CHAPAS FRISO HORIZONTAL — largura=medida veda porta, altura=espessura+100, qty=frisos×2 (frente+verso)
    var _LAR_IS_06 = Math.round(L - 10 - 10 - 171.7 - 171.5);
    var _frisoW06 = Math.round(_LAR_IS_06 + 110 + 110); // mesma medida VEDA PORTA
    var _frisoH06 = ESP_FRISO + 100;
    var _MAX_CHAPA_UTIL = 1490; // 1500 - 2×5mm margem
    if (_frisoW06 > _MAX_CHAPA_UTIL) {
      // Quebra/emenda: peça 1 = 1490, peça 2 = restante
      var _frisoResto = _frisoW06 - _MAX_CHAPA_UTIL;
      r.push(['FRISO HORIZ 1', _MAX_CHAPA_UTIL, _frisoH06, N_FRISOS * 2]);
      r.push(['FRISO HORIZ 2', _frisoResto, _frisoH06, N_FRISOS * 2]);
    } else {
      r.push(['FRISO HORIZ', _frisoW06, _frisoH06, N_FRISOS * 2]);
    }
  }

  /* MODELO 22 — cava larga (DC+360), altura=G4 (PA ALTURA), sem TAMPA CAVA, TAMPA MAIOR -68 */
  if (mod === '22') {
    var DIS_BOR_CAVA = parseInt(document.getElementById('plan-disborcava').value) || 210;
    var LARG_CAVA    = parseInt(document.getElementById('plan-largcava').value)   || 150;
    var cavaDeduc = LARG_CAVA + DIS_BOR_CAVA + 2;
    // Friso vertical (opcional)
    var LARG_FRISO = parseInt(document.getElementById('plan-largfriso').value) || 0;
    var DIS_BOR_FRI = parseInt(document.getElementById('plan-disbordafriso').value) || 0;
    var frisoDeduc = (LARG_FRISO > 0 && DIS_BOR_FRI > 0) ? DIS_BOR_FRI + LARG_FRISO : 0;
    r.push(['CAVA', LARG_CAVA + 360, G4, (fol==2) ? 4 : 2]);
    if (fol == 1) {
      r.push(['TAMPA MAIOR', fW + 2*REF - cavaDeduc - 68 - frisoDeduc, G4, 2]);
    } else {
      var DBC = DIS_BOR_CAVA, LC = LARG_CAVA;
      var baseA = (G2total - DBC*2 - LC*2) / 2;
      var baseB = (G2total - 1 - DBC*2 - LC*2) / 2;
      var T1 = baseA + FGA + FGLA*2 - 1 - 34;
      var T2 = baseB + FGLA*2 - PIV - 1 - 34;
      var T3 = T2 - TUB_SUP;
      r.push(['TAMPA MAIOR 01', T1, G4, 1]);
      r.push(['TAMPA MAIOR 02', T2, G4, 2]);
      r.push(['TAMPA MAIOR 03', T3, G4, 1]);
    }
    if (fol == 1) {
      r.push(['TAMPA BOR CAVA', DIS_BOR_CAVA + (2*REF-1), G4, 2]);
    } else {
      r.push(['TAMPA MENOR', DIS_BOR_CAVA + REF*2 - 1, G4, 4]);
    }
    // Friso vertical peças (se configurado)
    if (frisoDeduc > 0) {
      r.push(['TAMPA FRISO', DIS_BOR_FRI + (2*REF-1), G4, (fol==2) ? 4 : 2]);
      r.push(['FRISO VERT', LARG_FRISO + 100, G4, (fol==2) ? 4 : 2]);
    }
    r.push(['ACAB LAT 1', acabLat1, G4, nL], ['ACAB LAT 2', 90, G4, nL], ['ACAB LAT Z', 110, G4, nL]);
    r.push(['U PORTAL', 221, L-REF, 1]);
    r.push(['BAT 01', 42, bH, 2], ['BAT 02Z', 51, bH, 2], ['BAT 03', 81, bH, 2]);
    r.push(['TAP FURO', 119, bH, 3], ['FIT ACAB ME', 76.5, bH, 2], ['FIT ACAB MA', 114.5, bH, 2], ['FIT ACAB FITA', 101, bH, 2]);
    if(document.getElementById('carac-tem-alisar')&&document.getElementById('carac-tem-alisar').checked) r.push(['ALISAR ALT', 225, A+150, 5], ['ALISAR LAR', 225, L+300, 2]);
  }
  var out = [];
  for (var i = 0; i < r.length; i++) {
    var p = r[i], w = Math.round(p[1]*2)/2, h = Math.round(p[2]*2)/2, q = p[3];
    if (w > 0 && h > 0 && q > 0) out.push({ label: p[0], w: w, h: h, qty: q, color: PLN_COLORS[i % PLN_COLORS.length], mat: p[4] || 'acm' });
  }
  return out;
}

/* ── ADVANCED GUILLOTINE NESTING (multi-strategy, rotation, backfill) ──────── */
function plnMaxRects(pieces, SW, SH, mode) {
  var MG=PLN_MG, KF=PLN_KERF;
  var usW=SW-2*MG, usH=SH-2*MG;

  // Expandir peças individuais
  var todo=[];
  for(var i=0;i<pieces.length;i++)
    for(var j=0;j<pieces[i].qty;j++)
      todo.push({label:pieces[i].label,w:pieces[i].w,h:pieces[i].h,color:pieces[i].color});

  if(!todo.length) return {numSheets:0,placed:[],failed:[],stats:[]};

  // ══ ALGORITMO 1: STRIP PACKING (estilo MaxCut — guilhotina) ══
  // Agrupa peças em faixas horizontais de altura similar
  function stripPack(items){
    var sheets=[],failed=[];
    var remaining=items.slice();

    while(remaining.length>0){
      var strip_y=0;
      var placed=[];
      var leftover=[];

      // Fase 1: criar faixas com as peças mais altas primeiro
      var strips=[];
      for(var i=0;i<remaining.length;i++){
        var p=remaining[i], fitted=false;
        // Tentar encaixar em faixa existente
        for(var s=0;s<strips.length;s++){
          if(p.h<=strips[s].h+2 && strips[s].usedW+p.w+KF<=usW){
            strips[s].pieces.push({x:strips[s].usedW,p:p});
            strips[s].usedW+=p.w+KF;
            fitted=true;break;
          }
        }
        // Criar nova faixa se cabe na chapa
        if(!fitted){
          var nextY=strips.reduce(function(s,st){return s+st.h+KF;},0);
          if(nextY+p.h<=usH && p.w<=usW){
            strips.push({y:nextY,h:p.h,usedW:p.w+KF,pieces:[{x:0,p:p}]});
            fitted=true;
          }
        }
        if(fitted) placed.push(p);
        else leftover.push(p);
      }

      // Fase 2: BACKFILL — preencher gaps verticais entre faixas
      var newLeftover=[];
      for(var li=0;li<leftover.length;li++){
        var lp=leftover[li],backfilled=false;
        for(var s=0;s<strips.length&&!backfilled;s++){
          // Gap vertical acima de peças mais baixas nesta faixa
          var gapW=usW-strips[s].usedW;
          if(lp.w<=gapW && lp.h<=strips[s].h+2){
            strips[s].pieces.push({x:strips[s].usedW,p:lp});
            strips[s].usedW+=lp.w+KF;
            placed.push(lp);backfilled=true;
          }
        }
        // Tentar criar mini-faixa no espaço restante
        if(!backfilled){
          var totalStripH=strips.reduce(function(s,st){return s+st.h+KF;},0);
          var remainH=usH-totalStripH;
          if(lp.h<=remainH && lp.w<=usW){
            strips.push({y:totalStripH,h:lp.h,usedW:lp.w+KF,pieces:[{x:0,p:lp}]});
            placed.push(lp);backfilled=true;
          }
        }
        if(!backfilled) newLeftover.push(lp);
      }

      // Registrar esta chapa
      if(placed.length>0){
        var sheetIdx=sheets.length;
        var sheetPlaced=[];
        strips.forEach(function(st){
          st.pieces.forEach(function(sp){
            sheetPlaced.push({sheet:sheetIdx,x:MG+sp.x,y:MG+st.y,w:sp.p.w,h:sp.p.h,label:sp.p.label,color:sp.p.color,rot:false});
          });
        });
        sheets.push(sheetPlaced);
      }
      remaining=newLeftover;
      if(placed.length===0){failed=remaining;break;} // nenhuma peça coube
    }
    var allPlaced=[];
    sheets.forEach(function(s){s.forEach(function(p){allPlaced.push(p);});});
    var totalUsed=allPlaced.reduce(function(s,p){return s+p.w*p.h;},0);
    var aprov=sheets.length>0?totalUsed/(sheets.length*usW*usH)*100:0;
    return {placed:allPlaced,failed:failed,numSheets:sheets.length,aprov:aprov};
  }

  // ══ ALGORITMO 2: MAXRECTS FREE-RECT (melhor para peças irregulares) ══
  function MaxRectsSheet(){
    this.freeRects=[{x:0,y:0,w:usW,h:usH}];
    this.placed=[];
  }
  MaxRectsSheet.prototype.findBest=function(pw,ph){
    var bestScore=Infinity,bestIdx=-1,bestX=0,bestY=0;
    for(var i=0;i<this.freeRects.length;i++){
      var r=this.freeRects[i];
      if(pw<=r.w && ph<=r.h){
        var leftW=r.w-pw, leftH=r.h-ph;
        var score=Math.min(leftW,leftH);
        if(score<bestScore){bestScore=score;bestIdx=i;bestX=r.x;bestY=r.y;}
      }
    }
    if(bestIdx<0) return null;
    return {x:bestX,y:bestY,w:pw,h:ph};
  };
  MaxRectsSheet.prototype.place=function(rect){
    var pw=rect.w+KF, ph=rect.h+KF;
    var newFree=[];
    for(var i=0;i<this.freeRects.length;i++){
      var r=this.freeRects[i];
      if(rect.x>=r.x+r.w || rect.x+pw<=r.x || rect.y>=r.y+r.h || rect.y+ph<=r.y){
        newFree.push(r); continue;
      }
      if(rect.x>r.x) newFree.push({x:r.x,y:r.y,w:rect.x-r.x,h:r.h});
      if(rect.x+pw<r.x+r.w) newFree.push({x:rect.x+pw,y:r.y,w:r.x+r.w-rect.x-pw,h:r.h});
      if(rect.y>r.y) newFree.push({x:r.x,y:r.y,w:r.w,h:rect.y-r.y});
      if(rect.y+ph<r.y+r.h) newFree.push({x:r.x,y:rect.y+ph,w:r.w,h:r.y+r.h-rect.y-ph});
    }
    this.freeRects=[];
    for(var i=0;i<newFree.length;i++){
      var a=newFree[i]; if(a.w<10||a.h<10) continue;
      var contained=false;
      for(var j=0;j<newFree.length;j++){
        if(i===j) continue;
        var b=newFree[j];
        if(a.x>=b.x && a.y>=b.y && a.x+a.w<=b.x+b.w && a.y+a.h<=b.y+b.h){contained=true;break;}
      }
      if(!contained) this.freeRects.push(a);
    }
    this.placed.push(rect);
  };

  function maxRectsPack(items){
    var sheets=[new MaxRectsSheet()];
    var failed=[];
    for(var i=0;i<items.length;i++){
      var p=items[i], placed=false;
      var bestFit=null, bestSheet=-1, bestScore=Infinity;
      for(var si=0;si<sheets.length;si++){
        var fit=sheets[si].findBest(p.w,p.h);
        if(fit){
          var freeRect=null;
          for(var fi=0;fi<sheets[si].freeRects.length;fi++){
            var r=sheets[si].freeRects[fi];
            if(p.w<=r.w&&p.h<=r.h){freeRect=r;break;}
          }
          var score=freeRect?Math.min(freeRect.w-p.w,freeRect.h-p.h):0;
          score+=si*10000;
          if(score<bestScore){bestScore=score;bestFit=fit;bestSheet=si;}
        }
      }
      if(bestFit){
        bestFit.label=p.label;bestFit.color=p.color;bestFit.rot=false;bestFit.sheet=bestSheet;
        sheets[bestSheet].place(bestFit);placed=true;
      }
      if(!placed){
        var ns=new MaxRectsSheet();sheets.push(ns);
        var fit2=ns.findBest(p.w,p.h);
        if(fit2){fit2.label=p.label;fit2.color=p.color;fit2.rot=false;fit2.sheet=sheets.length-1;ns.place(fit2);placed=true;}
        if(!placed) failed.push(p);
      }
    }
    var allPlaced=[],nonEmpty=[];
    sheets.forEach(function(s,idx){
      if(s.placed.length>0){var ni=nonEmpty.length;s.placed.forEach(function(pp){pp.sheet=ni;pp.x+=MG;pp.y+=MG;allPlaced.push(pp);});nonEmpty.push(s);}
    });
    var totalUsed=allPlaced.reduce(function(s,pp){return s+pp.w*pp.h;},0);
    var aprov=nonEmpty.length>0?totalUsed/(nonEmpty.length*usW*usH)*100:0;
    return {placed:allPlaced,failed:failed,numSheets:nonEmpty.length,aprov:aprov};
  }

  // ══ MULTI-SEED: testar MUITAS ordenações com AMBOS algoritmos ══
  var strategies=[
    function(a,b){return(b.w*b.h)-(a.w*a.h);},
    function(a,b){return b.w-a.w||b.h-a.h;},
    function(a,b){return b.h-a.h||b.w-a.w;},
    function(a,b){return Math.max(b.w,b.h)-Math.max(a.w,a.h)||(b.w*b.h)-(a.w*a.h);},
    function(a,b){return(b.w+b.h)-(a.w+a.h);},
    function(a,b){return Math.min(b.w,b.h)-Math.min(a.w,a.h)||(b.w*b.h)-(a.w*a.h);},
    function(a,b){var ha=Math.round(a.h/100)*100,hb=Math.round(b.h/100)*100;if(ha!==hb)return hb-ha;return b.w-a.w;},
    function(a,b){var wa=Math.round(a.w/50)*50,wb=Math.round(b.w/50)*50;if(wa!==wb)return wb-wa;return b.h-a.h;},
    function(a,b){if(a.h!==b.h)return b.h-a.h;return b.w-a.w;},
    function(a,b){if(a.w!==b.w)return b.w-a.w;return b.h-a.h;},
    function(a,b){return(b.w/b.h)-(a.w/a.h);},
    function(a,b){return(a.w/a.h)-(b.w/b.h);}
  ];

  var bestResult=null,bestSheets=Infinity,bestAprov=0;
  for(var si=0;si<strategies.length;si++){
    var sorted=todo.slice().sort(strategies[si]);
    // Testar Strip Packing
    var res1=stripPack(sorted);
    if(res1.numSheets<bestSheets||(res1.numSheets===bestSheets&&res1.aprov>bestAprov)){
      bestSheets=res1.numSheets;bestAprov=res1.aprov;bestResult=res1;
    }
    // Testar MaxRects
    var res2=maxRectsPack(sorted);
    if(res2.numSheets<bestSheets||(res2.numSheets===bestSheets&&res2.aprov>bestAprov)){
      bestSheets=res2.numSheets;bestAprov=res2.aprov;bestResult=res2;
    }
  }
  if(!bestResult) bestResult={placed:[],failed:todo,numSheets:0,aprov:0};

  // ── Stats por chapa ──
  var stats=[];
  for(var i=0;i<bestResult.numSheets;i++){
    var ps=bestResult.placed.filter(function(p){return p.sheet===i;});
    var used=ps.reduce(function(s,p){return s+p.w*p.h;},0);
    stats.push({idx:i,count:ps.length,used:used,total:SW*SH,pct:used/(SW*SH)*100});
  }
  stats.sort(function(a,b){return b.used-a.used;});
  var remap={};
  for(var i=0;i<stats.length;i++){remap[stats[i].idx]=i;delete stats[i].idx;}
  for(var i=0;i<bestResult.placed.length;i++){
    bestResult.placed[i].sheet=remap[bestResult.placed[i].sheet];
  }
  bestResult.stats=stats;
  return bestResult;
}

/* ── DESENHAR (VERTICAL como MaxCut) ───────────────── */
function plnDraw(si) {
  var cv  = document.getElementById('plan-canvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  // Detectar se é chapa ALU (index >= _chapasACM)
  var _nACMd = window._chapasACM || PLN_RES.numSheets;
  var _isALUSheet = si >= _nACMd && window._chapasALU > 0;
  var SW, SH;
  if(_isALUSheet && window._chapaALU_SW && window._chapaALU_SH){
    SW = window._chapaALU_SW;
    SH = window._chapaALU_SH;
  } else {
    SW = PLN_SD.w;
    SH = PLN_SD.h;
  }
  var PAD = 20;
  // HORIZONTAL: comprimento (SH) no eixo X, largura (SW) no eixo Y
  var maxCW = 1100, maxCH = 280;
  var sc  = Math.min((maxCW-PAD*2)/SH, (maxCH-PAD*2)/SW);
  cv.width  = Math.round(SH*sc + PAD*2);
  cv.height = Math.round(SW*sc + PAD*2);

  // fundo
  ctx.fillStyle='#9a9691'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.fillStyle='#f8f8f6'; ctx.fillRect(PAD,PAD,SH*sc,SW*sc);



  // peças desta chapa
  var kv = Math.max(1, Math.round(PLN_KERF/2 * sc));
  var ps = PLN_RES.placed.filter(function(p){return p.sheet===si;});

  // detectar limites das faixas (strip boundaries) para linhas guilhotina
  var stripYs = {}; // y -> maxY (y + h)
  for (var i=0; i<ps.length; i++) {
    var p = ps[i], py = p.y, ph = p.h;
    if (!stripYs[py] || (py+ph) > stripYs[py]) stripYs[py] = py + ph;
  }
  var maxUsedY = PLN_MG; // maior Y usado nesta chapa

  // Ordenar peças: maiores primeiro visualmente (maior área)
  ps.sort(function(a,b){ return (b.w*b.h) - (a.w*a.h); });

  // desenhar peças (transposto: x↔y para layout horizontal)
  for (var i=0; i<ps.length; i++) {
    var p = ps[i];
    var cx = PAD + p.y * sc + kv;
    var cy = PAD + p.x * sc + kv;
    var cw = p.h * sc - kv*2;
    var ch = p.w * sc - kv*2;
    if(cw<2||ch<2) continue;
    // rastrear extensão máxima
    if (p.y + p.h > maxUsedY) maxUsedY = p.y + p.h;
    ctx.globalAlpha=0.88; ctx.fillStyle=p.color; ctx.fillRect(cx,cy,cw,ch);
    ctx.globalAlpha=1; ctx.strokeStyle='rgba(0,0,0,.2)'; ctx.lineWidth=1; ctx.strokeRect(cx+.5,cy+.5,cw-1,ch-1);
    // labels — texto vertical se peça é mais alta que larga
    if (cw>14 && ch>14) {
      ctx.save(); ctx.beginPath(); ctx.rect(cx+1,cy+1,cw-2,ch-2); ctx.clip();
      var isVert = ch > cw * 1.8;
      if (isVert) {
        // texto rotacionado 90° para peças estreitas e altas
        ctx.translate(cx+cw/2, cy+ch/2);
        ctx.rotate(-Math.PI/2);
        var fs=Math.max(7,Math.min(11,Math.min(ch/(p.label.length*.55),cw*.45)));
        ctx.font='700 '+fs+'px Montserrat,Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='rgba(0,0,0,.78)';
        ctx.fillText(p.label, 0, -(cw>fs*3?fs*.2:0));
        if (cw>fs*2.5) { ctx.font='600 '+Math.max(6,fs-1)+'px Montserrat,Arial'; ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillText(p.w+'×'+p.h+(p.rot?' ↻':''), 0, fs*.8); }
      } else {
        var fs=Math.max(7,Math.min(11,Math.min(cw/(p.label.length*.55),ch*.35)));
        ctx.font='700 '+fs+'px Montserrat,Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='rgba(0,0,0,.78)';
        ctx.fillText(p.label, cx+cw/2, cy+ch/2-(ch>fs*3?fs*.3:0));
        if (ch>fs*3) { ctx.font='600 '+Math.max(6,fs-1)+'px Montserrat,Arial'; ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillText(p.w+'×'+p.h+(p.rot?' ↻':''), cx+cw/2, cy+ch/2+fs*.85); }
      }
      ctx.restore();
    }
  }

  // ── LINHAS GUILHOTINA (cortes horizontais entre faixas) ──
  ctx.setLineDash([6,4]); ctx.strokeStyle='rgba(180,0,0,.45)'; ctx.lineWidth=1.5;
  var drawnLines = {};
  for (var yKey in stripYs) {
    var cutY = stripYs[yKey] + PLN_KERF/2;
    var lineKey = Math.round(cutY);
    if (drawnLines[lineKey] || cutY >= SH - PLN_MG) continue;
    drawnLines[lineKey] = true;
    var canvasY = PAD + cutY * sc;
    ctx.beginPath(); ctx.moveTo(PAD, canvasY); ctx.lineTo(PAD + SH*sc, canvasY); ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── SOBRA REUTILIZÁVEL (área vazia abaixo das peças) ──
  var sobraY = maxUsedY + PLN_KERF;
  var sobraH = SH - PLN_MG - sobraY;
  if (sobraH > 50) { // mostrar se sobra > 50mm
    var sx = PAD + PLN_MG * sc;
    var sy = PAD + sobraY * sc;
    var sw = (SW - 2*PLN_MG) * sc;
    var sh = sobraH * sc;
    // fundo amarelo
    ctx.globalAlpha=0.25; ctx.fillStyle='#f5c518'; ctx.fillRect(sx, sy, sw, sh);
    ctx.globalAlpha=1;
    ctx.setLineDash([4,3]); ctx.strokeStyle='#b8960f'; ctx.lineWidth=1.5;
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);
    // label com dimensões
    var sobraWmm = SW - 2*PLN_MG, sobraHmm = Math.round(sobraH);
    var sobraM2 = (sobraWmm * sobraHmm / 1e6).toFixed(2);
    ctx.fillStyle='#7a5d00'; ctx.font='bold 11px Montserrat,Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if (sh > 30) {
      ctx.fillText('SOBRA REUTILIZÁVEL', sx+sw/2, sy+sh/2 - 8);
      ctx.font='bold 10px Montserrat,Arial'; ctx.fillStyle='#996e00';
      ctx.fillText(sobraWmm+' × '+sobraHmm+' mm  ('+sobraM2+' m²)', sx+sw/2, sy+sh/2 + 8);
    } else {
      ctx.fillText('SOBRA: '+sobraWmm+'×'+sobraHmm+'mm ('+sobraM2+'m²)', sx+sw/2, sy+sh/2);
    }
    // cotas laterais
    ctx.fillStyle='#7a5d00'; ctx.font='bold 9px Montserrat,Arial';
    ctx.textAlign='right'; ctx.textBaseline='middle';
    ctx.fillText(sobraHmm+' mm', sx-4, sy+sh/2);
  }

  // ── COTAS DE LARGURA (dimensões no topo) ──
  // mostrar largura das peças na primeira faixa
  var firstStripPieces = ps.filter(function(p){ return p.y === PLN_MG; }).sort(function(a,b){return a.x-b.x;});
  ctx.fillStyle='#333'; ctx.font='bold 8px Montserrat,Arial'; ctx.textAlign='center'; ctx.textBaseline='bottom';
  for (var i=0; i<firstStripPieces.length; i++) {
    var p = firstStripPieces[i];
    var cx = PAD + p.x * sc, cw = p.w * sc;
    if (cw > 25) ctx.fillText(p.w+' mm', cx+cw/2, PAD-2);
  }

  // borda externa (transposta: SH no eixo X, SW no eixo Y)
  ctx.strokeStyle='#444'; ctx.lineWidth=2; ctx.strokeRect(PAD,PAD,SH*sc,SW*sc);

  // labels do cabeçalho e rodapé
  ctx.fillStyle='#333'; ctx.font='bold 10px Montserrat,Arial';
  ctx.textAlign='left'; ctx.textBaseline='top';
  var _sheetLabel=_isALUSheet?'🔷 ALU '+(si-_nACMd+1):'Chapa '+(si+1);
  ctx.fillText(_sheetLabel+'  |  '+SW+'×'+SH+' mm  |  kerf 4mm',PAD,4);
  // cota da largura total no topo
  ctx.textAlign='center';
  ctx.fillText(SH+' mm', PAD+SH*sc/2, PAD+SW*sc+4);
  // cota da altura total na lateral
  ctx.save(); ctx.translate(PAD-6, PAD+SW*sc/2); ctx.rotate(-Math.PI/2);
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText(SW+' mm', 0, 0);
  ctx.restore();

  ctx.textAlign='right'; ctx.textBaseline='bottom';
  ctx.fillStyle='#555'; ctx.font='bold 9px Montserrat,Arial';
  ctx.fillText(ps.length+' peças  ·  '+PLN_RES.stats[si].pct.toFixed(1)+'% aproveitamento',PAD+SH*sc,cv.height-2);

  // info row HTML
  var st=PLN_RES.stats[si];
  var sobraInfo = sobraH > 50 ? '  ·  <strong style="color:#7a5d00">Sobra: '+(SW-2*PLN_MG)+'×'+Math.round(sobraH)+'mm ('+(sobraH*(SW-2*PLN_MG)/1e6).toFixed(2)+' m²)</strong>' : '';
  document.getElementById('plan-cinfo').innerHTML=
    '<span>Peças: <strong>'+st.count+'</strong></span>'+
    '<span>Usada: <strong>'+(st.used/1e6).toFixed(3)+' m²</strong></span>'+
    '<span>Total chapa: <strong>'+(st.total/1e6).toFixed(3)+' m²</strong></span>'+
    '<span>Aproveit.: <strong style="color:var(--orange)">'+st.pct.toFixed(1)+'%</strong></span>'+
    '<span>Desperdício: <strong>'+(100-st.pct).toFixed(1)+'%</strong></span>'+sobraInfo;
}

function plnBuildTabs() {
  var el = document.getElementById('plan-tabs'); el.innerHTML='';
  var _nACM = window._chapasACM || PLN_RES.numSheets;
  for (var i=0; i<PLN_RES.numSheets; i++) {
    (function(idx){
      var isALU = idx >= _nACM;
      var lbl = isALU ? 'ALU '+(idx-_nACM+1) : 'Chapa '+(idx+1);
      var bg = isALU ? 'background:#e8f0fe;border-color:#1a5276;color:#1a5276' : '';
      var b=document.createElement('button');
      b.className='tab'+(idx===PLN_CSI?' on':'');
      if(bg) b.style.cssText=bg;
      b.innerHTML=lbl+' <span style="font-size:10px;opacity:.7">'+PLN_RES.stats[idx].pct.toFixed(0)+'%</span>';
      b.onclick=function(){
        PLN_CSI=idx;
        var tabs=document.getElementById('plan-tabs').querySelectorAll('button');
        for(var t=0;t<tabs.length;t++) tabs[t].className='tab'+(t===idx?' on':'');
        plnDraw(idx);
      };
      el.appendChild(b);
    })(i);
  }
}

function plnLegend(pieces) {
  var html='';
  for(var i=0;i<pieces.length;i++) {
    html+='<span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted)">'+
      '<span style="width:11px;height:11px;border-radius:2px;flex-shrink:0;background:'+pieces[i].color+'"></span>'+pieces[i].label+'</span>';
  }
  document.getElementById('plan-leg').innerHTML=html;
}

// ★ ETAPA 2: Barra de tabs POR COR (acima das tabs de chapa)
// Só aparece quando há >= 2 cores em window._PLN_COLOR_KEYS.
// Ao clicar: troca PLN_RES para _PLN_RES_BY_COLOR[cor], zera PLN_CSI,
// e redesenha as tabs de chapa + canvas.
function _plnRenderColorTabs(){
  var el = document.getElementById('plan-color-tabs');
  if(!el) return;
  var keys = window._PLN_COLOR_KEYS || [];
  if(keys.length < 2){
    el.style.display='none';
    el.innerHTML='';
    return;
  }
  el.style.display='flex';
  el.innerHTML='';
  var active = window._PLN_ACTIVE_COLOR || keys[0];
  // Label de legenda antes dos botões
  var lbl=document.createElement('span');
  lbl.style.cssText='font-size:9px;font-weight:800;color:var(--navy);text-transform:uppercase;letter-spacing:.08em;align-self:center;margin-right:4px;opacity:.75';
  lbl.textContent='Cor da chapa:';
  el.appendChild(lbl);
  keys.forEach(function(ck){
    var res = window._PLN_RES_BY_COLOR && window._PLN_RES_BY_COLOR[ck];
    var nChapas = res ? (res.numSheets || 0) : 0;
    var b=document.createElement('button');
    var isActive = (ck===active);
    b.className='tab'+(isActive?' on':'');
    b.style.cssText = 'font-size:10px;padding:4px 10px;'+(isActive?'background:var(--navy);color:#fff;border-color:var(--navy);font-weight:700':'');
    b.innerHTML='🎨 '+ck+' <span style="font-size:9px;opacity:.7">('+nChapas+' chapa'+(nChapas!==1?'s':'')+')</span>';
    b.onclick=function(){
      if(!window._PLN_RES_BY_COLOR || !window._PLN_RES_BY_COLOR[ck]) return;
      window._PLN_ACTIVE_COLOR = ck;
      PLN_RES = window._PLN_RES_BY_COLOR[ck];
      PLN_CSI = 0;
      _plnRenderColorTabs();   // atualiza estado on/off
      plnBuildTabs();          // re-renderiza tabs de chapa
      plnDraw(0);              // redesenha canvas
    };
    el.appendChild(b);
  });
}

var _plnPiecesRef=[];
var _plnManualOv={}; // {label: {w:X, h:Y, qty:Z}}
function _plnPieceEdited(idx){
  var p=_plnPiecesRef[idx];if(!p)return;
  var el=function(s){return document.getElementById('pp-'+idx+'-'+s);};
  var newW=parseFloat((el('w')||{value:0}).value)||0;
  var newH=parseFloat((el('h')||{value:0}).value)||0;
  var newQ=parseInt((el('q')||{value:0}).value)||0;
  p.w=newW;p.h=newH;p.qty=newQ;
  // Store/clear override
  var wDiff=Math.abs(newW-(p._autoW||0))>0.1;
  var hDiff=Math.abs(newH-(p._autoH||0))>0.1;
  var qDiff=Math.abs(newQ-(p._autoQ||0))>0.1;
  if(wDiff||hDiff||qDiff){
    _plnManualOv[p.label]={w:newW,h:newH,qty:newQ};
  } else {
    delete _plnManualOv[p.label];
  }
  // Show/hide reset button
  var rstBtn=document.getElementById('plan-reset-ov-btn');
  if(rstBtn){
    var cnt=Object.keys(_plnManualOv).length;
    rstBtn.style.display=cnt>0?'inline-block':'none';
    rstBtn.textContent='🔓 Limpar '+cnt+' alteraç'+(cnt===1?'ão':'ões')+' manual'+(cnt===1?'':'is');
  }
  var a=(newW*newH*newQ/1e6).toFixed(4);
  var kg=(newW*newH*newQ/1e6*6.5).toFixed(2);
  var aEl=document.getElementById('pp-'+idx+'-a');if(aEl)aEl.textContent=a;
  var kgEl=document.getElementById('pp-'+idx+'-kg');if(kgEl)kgEl.textContent=kg;
  ['w','h','q'].forEach(function(fld){
    var inp=el(fld);if(!inp)return;
    var auto=parseFloat(inp.getAttribute('data-auto'))||0;
    var cur=parseFloat(inp.value)||0;
    var changed=Math.abs(cur-auto)>0.1;
    inp.style.borderColor=changed?'#e65100':'#ddd';
    inp.style.background=changed?'#fff3e0':'#fff';
    inp.style.color=changed?'#e65100':'';
    var warn=inp.nextElementSibling;
    if(changed&&(!warn||warn.tagName!=='DIV')){warn=document.createElement('div');warn.style.cssText='font-size:8px;color:#e65100;font-weight:600';inp.parentNode.appendChild(warn);}
    if(warn&&warn.tagName==='DIV')warn.textContent=changed?'auto:'+auto:'';
    if(!changed&&warn&&warn.tagName==='DIV')warn.remove();
  });
  // Show recalculate button
  var rb=document.getElementById('plan-recalc-btn');if(rb)rb.style.display='';
  // Update summaries
  var tb=document.getElementById('plan-piece-tbody');
  tb.querySelectorAll('tr[data-sum]').forEach(function(r){r.remove();});
  var pesoPorta=0,pesoPortal=0,pesoFixo=0;
  for(var j=0;j<_plnPiecesRef.length;j++){var pp=_plnPiecesRef[j];var k=pp.w*pp.h*pp.qty/1e6*6.5;if(pp._local==='PORTA')pesoPorta+=k;else if(pp._local==='FIXO')pesoFixo+=k;else pesoPortal+=k;}
  function _sR(l,k,b,co){var tr=document.createElement('tr');tr.setAttribute('data-sum','1');tr.innerHTML='<td colspan="6" style="padding:5px 7px;background:'+b+';font-weight:700;font-size:11px;color:'+co+';text-align:right;border-top:1.5px solid '+co+'">'+l+'</td><td style="padding:5px 7px;background:'+b+';font-weight:800;font-size:12px;color:'+co+';text-align:right;border-top:1.5px solid '+co+'">'+k.toFixed(2)+'</td><td colspan="2" style="padding:5px 7px;background:'+b+';border-top:1.5px solid '+co+'"></td>';tb.appendChild(tr);}
  _sR('Chapas PORTA:',pesoPorta,'#e8f5e9','#2e7d32');_sR('Chapas PORTAL:',pesoPortal,'#fff3e0','#e65100');
  if(pesoFixo>0)_sR('Chapas FIXO:',pesoFixo,'#e3f2fd','#1565c0');
  _sR('TOTAL CHAPAS:',pesoPorta+pesoPortal+pesoFixo,'#003144','#fff');
}

function _plnResetOverrides(){
  _plnManualOv={};
  var btn=document.getElementById('plan-reset-ov-btn');if(btn)btn.style.display='none';
  planUpd();
}

function plnPieceTable(pieces, placed) {
  _plnPiecesRef=[];
  var tb=document.getElementById('plan-piece-tbody'); tb.innerHTML='';
  // Mapa de refilado (largura) por peça — usado apenas para exibição do "L sem refilado"
  // Não afeta nenhum cálculo; somente anotação visual abaixo do input L(mm).
  var _REFval = parseInt((document.getElementById('plan-refilado')||{value:20}).value)||20;
  var _REF_POR_PECA = {
    'TAMPA MAIOR': 2*_REFval,
    'TAMPA MAIOR 01': 40, 'TAMPA MAIOR 02': 40, 'TAMPA MAIOR 03': 40,
    'TAMPA BOR CAVA': 2*_REFval - 2,
    'TAMPA MENOR': 2*_REFval - 2,
    'TAMPA FRISO': 2*_REFval - 1,
    'FRISO': 100,
    'FRISO RIPA': 2*_REFval,
    'FIT ACAB ME': 2*_REFval,
    'FIT ACAB MA': 2*_REFval,
    'FIT ACAB FITA': 2*_REFval
  };
  function _refLatDaPeca(label){
    var base = (label||'').split('[')[0].split('EXT')[0].split('INT')[0].trim();
    return _REF_POR_PECA[base] || 0;
  }
  // Ordenar maiores dimensões (área) primeiro
  var _portaPecas=['TAMPA MAIOR','TAMPA MAIOR 01','TAMPA MAIOR 02','TAMPA MAIOR 03','CAVA','TAMPA BOR CAVA','TAMPA CAVA','TAMPA MENOR','ACAB LAT 1','ACAB LAT 2','ACAB LAT Z','TAMPA FRISO','FRISO','FRISO VERT','DIST BOR FV','RIPAS'];
  function _isPortaPiece(lbl){var base=lbl.split('[')[0].split('EXT')[0].split('INT')[0].trim();if(base.indexOf('MOLD ')===0)return true;for(var k=0;k<_portaPecas.length;k++){if(base===_portaPecas[k])return true;}return false;}
  var _pSorted=pieces.slice().map(function(p,idx){
    var _isP=_isPortaPiece(p.label);
    p._local=p.label.indexOf('FX ')===0?'FIXO':_isP?'PORTA':'PORTAL';
    p._localOrd=p._local==='PORTA'?0:p._local==='PORTAL'?1:2;
    // Within PORTA: tampas first (by area desc), then others by original order
    var isTampa=p.label.indexOf('TAMPA')===0;
    p._subOrd=isTampa?0:1;
    p._area=p.w*p.h;
    p._origIdx=idx;
    return p;
  }).sort(function(a,b){
    if(a._localOrd!==b._localOrd) return a._localOrd-b._localOrd;
    // Within same local group
    if(a._local==='PORTA'){
      // Tampas first, sorted by area descending
      if(a._subOrd!==b._subOrd) return a._subOrd-b._subOrd;
      if(a._subOrd===0) return b._area-a._area; // tampas: maior primeiro
      return a._origIdx-b._origIdx; // other PORTA: original order
    }
    return a._origIdx-b._origIdx; // PORTAL/FIXO: original order
  });
  for(var i=0;i<_pSorted.length;i++){
    var p=_pSorted[i];
    _plnPiecesRef.push(p);
    var a=(p.w*p.h*p.qty/1e6).toFixed(4);
    // which sheets this piece appears on
    var sheetsUsed={};
    for(var j=0;j<placed.length;j++) if(placed[j].label===p.label) sheetsUsed[placed[j].sheet+1]=true;
    var sheetList=Object.keys(sheetsUsed).sort().join(', ');
    var isFailed=sheetList==='';
    var tr=document.createElement('tr');
    if(isFailed) tr.setAttribute('data-failed','1');
    var _kgPerM2 = (p.mat==='alu') ? 10.125 : 6.5;
    var pesoKg=(p.w*p.h*p.qty/1e6*_kgPerM2).toFixed(2);
    var local=p._local||'PORTA';
    var matBadge = (p.mat==='alu') ? ' <span style="background:#1a5276;color:#fff;padding:1px 4px;border-radius:3px;font-size:7px;font-weight:700">ALU</span>' : '';
    var lcl=local==='PORTA'?'<span style="background:#e8f5e9;color:#2e7d32;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:700">PORTA</span>':local==='PORTAL'?'<span style="background:#fff3e0;color:#e65100;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:700">PORTAL</span>':'<span style="background:#e3f2fd;color:#1565c0;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:700">FIXO</span>';
    var bgRow=isFailed?'background:#ffebee;':(local==='PORTA'?'background:#e8f5e9;':local==='PORTAL'?'background:#fff3e0;':local==='FIXO'?'background:#e3f2fd;':'');
    var failTag=isFailed?'<span style="background:#c62828;color:#fff;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:700">⚠ NÃO COUBE</span>':'';
    var _id='pp-'+i;
    var _inSt='width:55px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;font-size:11px;text-align:right;font-weight:600;font-family:inherit;outline:none;';
    var _mkIn=function(fld,val,orig){
      var changed=Math.abs(val-orig)>0.1;
      var st=_inSt+(changed?'border-color:#e65100;background:#fff3e0;color:#e65100;':'');
      var warn=changed?'<div style="font-size:8px;color:#e65100;font-weight:600">auto:'+orig+'</div>':'';
      return '<input type="number" id="'+_id+'-'+fld+'" value="'+val+'" data-auto="'+orig+'" step="0.5" onchange="_plnPieceEdited('+i+')" style="'+st+'">'+warn;
    };
    p._autoW=p._autoW||p.w; p._autoH=p._autoH||p.h; p._autoQ=p._autoQ||p.qty;
    var _refLat = _refLatDaPeca(p.label);
    var _netWHtml = (_refLat>0 && p.w>_refLat) ? '<div style="font-size:8px;color:#888;margin-top:1px;text-align:right;font-weight:600">s/ref: '+(p.w-_refLat).toFixed(1).replace(/\.0$/,'')+'</div>' : '';
    tr.innerHTML='<td style="padding:5px 7px;border-bottom:0.5px solid #f5f2ee;'+bgRow+'"><span style="width:11px;height:11px;border-radius:2px;display:inline-block;background:'+p.color+'"></span></td>'+
      '<td style="padding:5px 7px;border-bottom:0.5px solid #f5f2ee;'+bgRow+'">'+p.label+matBadge+'</td>'+
      '<td style="padding:3px 4px;border-bottom:0.5px solid #f5f2ee;'+bgRow+'">'+_mkIn('w',p.w,p._autoW)+_netWHtml+'</td>'+
      '<td style="padding:3px 4px;border-bottom:0.5px solid #f5f2ee;'+bgRow+'">'+_mkIn('h',p.h,p._autoH)+'</td>'+
      '<td style="padding:3px 4px;border-bottom:0.5px solid #f5f2ee;'+bgRow+'">'+_mkIn('q',p.qty,p._autoQ)+'</td>'+
      '<td style="padding:5px 7px;border-bottom:0.5px solid #f5f2ee;text-align:right;'+bgRow+'" id="'+_id+'-a">'+a+'</td>'+
      '<td style="padding:5px 7px;border-bottom:0.5px solid #f5f2ee;text-align:right;'+bgRow+'font-weight:600" id="'+_id+'-kg">'+pesoKg+'</td>'+
      '<td style="padding:5px 7px;border-bottom:0.5px solid #f5f2ee;text-align:center;'+bgRow+'">'+lcl+'</td>'+
      '<td style="padding:5px 7px;border-bottom:0.5px solid #f5f2ee;text-align:center;color:var(--navy);font-weight:600;'+bgRow+'">'+(isFailed?failTag:sheetList)+'</td>';
    tb.appendChild(tr);
  }
  // Sumário peso por local
  var pesoPorta=0,pesoPortal=0,pesoFixo=0;
  var _pesoChapasPerDoor={};
  for(var i=0;i<_pSorted.length;i++){
    var kg=_pSorted[i].w*_pSorted[i].h*_pSorted[i].qty/1e6*6.5;
    if(_pSorted[i]._local==='PORTA'){
      pesoPorta+=kg;
      var _di=_pSorted[i]._itemIdx;
      if(_di!==undefined){_pesoChapasPerDoor[_di]=(_pesoChapasPerDoor[_di]||0)+kg;}
    }
    else if(_pSorted[i]._local==='FIXO') pesoFixo+=kg;
    else pesoPortal+=kg;
  }
  window._pesoChapasPerDoor=_pesoChapasPerDoor;
  var pesoTotal=pesoPorta+pesoPortal+pesoFixo;
  function _sumRow(label,kg,bg,color){
    var tr=document.createElement('tr');
    tr.innerHTML='<td colspan="6" style="padding:5px 7px;background:'+bg+';font-weight:700;font-size:11px;color:'+color+';text-align:right;border-top:1.5px solid '+color+'">'+label+'</td>'+
      '<td style="padding:5px 7px;background:'+bg+';font-weight:800;font-size:12px;color:'+color+';text-align:right;border-top:1.5px solid '+color+'">'+kg.toFixed(2)+'</td>'+
      '<td colspan="2" style="padding:5px 7px;background:'+bg+';border-top:1.5px solid '+color+'"></td>';
    tb.appendChild(tr);
  }
  _sumRow('Chapas PORTA:',pesoPorta,'#e8f5e9','#2e7d32');
  _sumRow('Chapas PORTAL:',pesoPortal,'#fff3e0','#e65100');
  if(pesoFixo>0) _sumRow('Chapas FIXO:',pesoFixo,'#e3f2fd','#1565c0');
  _sumRow('TOTAL CHAPAS:',pesoTotal,'#003144','#fff');
}

/* ── UI ─────────────────────────────────────────────── */
function togglePlan() {
  var b=document.getElementById('plan-body');
  var badge=document.getElementById('plan-badge');
  if (b.style.display==='none') { b.style.display='block'; if(badge) badge.innerHTML='&#9650; fechar'; if(typeof planUpd==='function') planUpd(); }
  else { b.style.display='none'; badge.innerHTML='&#9660; clique para abrir'; }
}



function planUpd() {
  var Lv=parseFloat(document.getElementById('largura').value)||0;
  var Av=parseFloat(document.getElementById('altura').value)||0;
  var dims=document.getElementById('plan-dims');
  if (Lv>0&&Av>0) dims.textContent=Math.round(Lv)+' x '+Math.round(Av)+' mm = '+(Lv/1000*Av/1000).toFixed(2)+' m2';
  else dims.textContent='preencha largura e altura acima';

  var Mv=document.getElementById('plan-modelo').value;
  var isCava=(Mv==='01'||Mv==='02'||Mv==='06'||Mv==='07'||Mv==='08'||Mv==='22');
  var isFriso=(Mv==='02'||Mv==='11'||Mv==='22'||Mv==='23acm'||Mv==='23alu');
  var isFrisoH=(Mv==='06'||Mv==='16');
  var isRipa07=(Mv==='07');
  document.getElementById('plan-cava-row').style.display=isCava?'':'none';
  document.getElementById('plan-friso-row').style.display=isFriso?'':'none';
  var ripaRow=document.getElementById('plan-ripa-row');
  if(ripaRow) ripaRow.style.display=isRipa07?'':'none';
  var frisoHRow=document.getElementById('plan-friso-h-row');
  if(frisoHRow) frisoHRow.style.display=isFrisoH?'':'none';
  // Moldura row (modelo 23)
  var moldRow=document.getElementById('plan-moldura-row');
  if(moldRow) moldRow.style.display=(Mv==='23acm'||Mv==='23alu')?'':'none';
  // Update friso-h calc preview
  if(isFrisoH&&Lv>0&&Av>0){
    var _nf=parseInt((document.getElementById('plan-friso-h-qty')||{value:3}).value)||3;
    var _ef=parseInt((document.getElementById('plan-friso-h-esp')||{value:10}).value)||10;
    var _REF2=parseInt((document.getElementById('plan-refilado')||{value:20}).value)||20;
    var _TUB2=(typeof _isInternacional==='function'&&_isInternacional())?51:(Av<4000?38:51);
    var _G4c=Av-10-_TUB2-28+8;
    var _parts=_nf+1;
    var _bruta=(_G4c-_nf*_ef)/_parts;
    var _corte=_bruta+2*_REF2;
    var calcEl=document.getElementById('plan-friso-h-calc');
    if(calcEl) calcEl.innerHTML=_parts+' partes × '+Math.round(_bruta)+'mm bruta ('+Math.round(_corte)+'mm corte) '+(_corte>1450?'<b style="color:red">⚠️ EXCEDE 1450!</b>':'<b style="color:green">✓ OK</b>');
    // Sync friso horizontal qty → carac-friso-horiz (para cálculo de perfis)
    var _fhSync=document.getElementById('carac-friso-horiz');
    if(_fhSync) _fhSync.value=_nf;
  }
  // Ripa calc preview (mod 07)
  if(isRipa07&&Lv>0&&Av>0){
    var _nRip=parseInt((document.getElementById('plan-ripa-qty')||{value:5}).value)||5;
    var _lRip=parseInt((document.getElementById('plan-ripa-larg')||{value:50}).value)||50;
    var _dRip=parseInt((document.getElementById('plan-ripa-dist')||{value:10}).value)||10;
    var _ripaCalcEl=document.getElementById('plan-ripa-calc');
    var _ripaDeducTotal=_nRip*_lRip+_nRip*_dRip;
    if(_ripaCalcEl) _ripaCalcEl.innerHTML=_nRip+' ripas × '+_lRip+'mm = '+(_nRip*_lRip)+'mm + '+_nRip+' frisos × '+_dRip+'mm = '+(_nRip*_dRip)+'mm — <b>deduz '+_ripaDeducTotal+'mm da tampa</b>';
  }

  var pieces=[];
  if(window._mpItens && window._mpItens.length > 0){
    try{ pieces=_mpCalcAllPiecesCombined()||[]; }catch(e){console.warn('planUpd mp pieces:',e);pieces=[];}
  } else {
    if(Mv&&Lv>0&&Av>0){
      var Fv=parseInt(document.getElementById('plan-folhas').value)||1;
      pieces=plnPecas(Lv,Av,Fv,Mv);
    }
    // Adicionar peças dos fixos ao planificador
    var _tfPln=document.getElementById('tem-fixo');
    if(_tfPln&&_tfPln.checked){
      document.querySelectorAll('.fixo-blk').forEach(function(el){
        var Lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
        var Af=parseFloat((el.querySelector('.fixo-alt')||{value:0}).value)||0;
        var ld=parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
        var qf=parseInt((el.querySelector('.fixo-qty')||{value:1}).value)||1;
        var tp=(el.querySelector('.fixo-tipo')||{value:'superior'}).value;
        if(Lf>0&&Af>0){
          var fp=tp==='superior'?aprovFixoPieces(Lv,Av,Lf,Af,ld,Mv||'01'):
            [{label:'FX LATERAL',w:Lf+100,h:Af+100,qty:ld,color:'#bab0ac'}];
          if(qf>1) fp.forEach(function(p){p.qty=p.qty*qf;});
          pieces=pieces.concat(fp);
        }
      });
    }
    var manualP=(typeof getManualPieces==='function')?getManualPieces():[];
    for(var i=0;i<manualP.length;i++) pieces.push(manualP[i]);
    var _qPUpd=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
    if(_qPUpd>1){ pieces.forEach(function(p){ if(p.qty) p.qty=p.qty*_qPUpd; else if(p[3]) p[3]=p[3]*_qPUpd; }); }
  }

  // Apply manual overrides (persist across sheet/model changes)
  for(var oi=0;oi<pieces.length;oi++){
    var ov=_plnManualOv[pieces[oi].label];
    if(ov){
      pieces[oi]._autoW=pieces[oi].w;
      pieces[oi]._autoH=pieces[oi].h;
      pieces[oi]._autoQ=pieces[oi].qty;
      pieces[oi].w=ov.w;
      pieces[oi].h=ov.h;
      pieces[oi].qty=ov.qty;
    }
  }

  if(pieces.length===0){
    document.getElementById('plan-summary-txt').textContent=(!Mv?'selecione um modelo ou adicione pecas manuais':'preencha largura e altura');
    var infoEl=document.getElementById('plan-auto-info');if(infoEl)infoEl.style.display='none';
    return;
  }

  var totA=0,totQ=0;
  for(var i=0;i<pieces.length;i++){
    var pw=pieces[i].w||pieces[i][1]||0, ph=pieces[i].h||pieces[i][2]||0, pq=pieces[i].qty||pieces[i][3]||1;
    totA+=pw*ph*pq; totQ+=pq;
  }
  var autoCount=pieces.length-manualP.length;
  var manualTxt=manualP.length>0?' + '+manualP.length+' manual(is)':'';
  // Somar m2 dos fixos (chapas)
  var m2Fixos = window._lastFixosM2Chapa || 0;
  var totalAreaM2 = totA/1e6 + m2Fixos;
  var fixoTxt = m2Fixos > 0 ? '  +  fixo: '+m2Fixos.toFixed(3)+' m²' : '';
  document.getElementById('plan-summary-txt').textContent=
    totQ+' peças  |  '+autoCount+' auto'+manualTxt+'  |  porta: '+(totA/1e6).toFixed(3)+' m²'+fixoTxt+'  |  TOTAL: '+totalAreaM2.toFixed(3)+' m²';
}

/* ── AUTO-SELECAO DE CHAPA + CALCULO AUTOMATICO ──────────────────────────── */
function _isModelReady(){
  var Lv=parseFloat(document.getElementById('largura').value)||0;
  var Av=parseFloat(document.getElementById('altura').value)||0;
  var Mv=document.getElementById('plan-modelo').value;
  if(!Mv||Lv<=0||Av<=0) return false;

  // Sync cava do orcamento → planificador antes de verificar
  if(typeof _syncCavaToPlano==='function') _syncCavaToPlano();

  var isCava=(Mv==='01'||Mv==='02'||Mv==='03'||Mv==='04'||Mv==='05'||Mv==='06'||Mv==='07'||Mv==='08'||Mv==='09'||Mv==='19'||Mv==='22'||Mv==='24');
  if(isCava){
    // Checa primeiro no orcamento (fonte), fallback para planificador
    var distB=parseFloat((document.getElementById('carac-dist-borda-cava')||{value:''}).value)
           || parseFloat((document.getElementById('plan-disborcava')||{value:''}).value)||0;
    var largC=parseFloat((document.getElementById('carac-largura-cava')||{value:''}).value)
           || parseFloat((document.getElementById('plan-largcava')||{value:''}).value)||0;
    if(distB<=0||largC<=0) return false;
  }
  var isFriso=(Mv==='02'||Mv==='11');
  // Modelo 22: friso é OPCIONAL (só valida se friso qty > 0)
  if(Mv==='22'){
    var _fqV=parseInt((document.getElementById('carac-friso-vert')||{value:0}).value)||0;
    if(_fqV>0) isFriso=true;
  }
  if(isFriso){
    var distF=parseFloat((document.getElementById('plan-disbordafriso')||{value:''}).value)||0;
    var largF=parseFloat((document.getElementById('plan-largfriso')||{value:''}).value)||0;
    if(distF<=0||largF<=0) return false;
  }
  return true;
}

/* ── AUTO-SELECAO FECHADURA MECANICA ──────────────────────────────────────── */
function _isInternacional(){return (document.getElementById('inst-quem')||{value:''}).value==='INTERNACIONAL';}
function _autoSelectFechadura(){
  var H=parseFloat((document.getElementById('altura')||{value:0}).value)||0;
  if(H<=0) return;
  var TUB=(typeof _isInternacional==='function'&&_isInternacional())?50.8:(H>=4000?50.8:38.1);
  var PA_F=Math.round(H-10-TUB-28+8);
  var fechDigEl=document.getElementById('carac-fech-dig');
  var fechDig=fechDigEl?(fechDigEl.value||'').toUpperCase():'';
  var inicio=1020;
  if(fechDig.indexOf('PHILIPS')>=0) inicio=1380;
  var opcoes=[
    {val:'24 PINOS', comp:6000},{val:'16 PINOS', comp:4000},
    {val:'12 PINOS', comp:2000},{val:'08 PINOS', comp:800},{val:'04 PINOS', comp:400}
  ];
  var sel=document.getElementById('carac-fech-mec');
  if(!sel) return;
  var autoVal='04 PINOS';
  for(var i=0;i<opcoes.length;i++){if(inicio+opcoes[i].comp<=PA_F){autoVal=opcoes[i].val;break;}}
  window._fechMecAuto=autoVal;
  if(window._fechMecManual && sel.value!==autoVal){
    var warn=document.getElementById('fech-mec-warn');
    if(warn) warn.innerHTML='<span style="color:#e65100;font-size:9px;font-weight:600">\u26a0 Auto: '+autoVal+' | Selecionado: '+sel.value+'</span>';
    return;
  }
  sel.value=autoVal;
  window._fechMecManual=false;
  var warn=document.getElementById('fech-mec-warn');
  if(warn) warn.innerHTML='';
}

function _getACMPrice(colorCode, sheetH){
  if(!colorCode || typeof ACM_DATA==='undefined') return 0;
  var code=colorCode.toUpperCase();
  var sh=String(sheetH);
  for(var gi=0;gi<ACM_DATA.length;gi++){
    var opts=ACM_DATA[gi].o||[];
    for(var oi=0;oi<opts.length;oi++){
      var lbl=(opts[oi].l||'').toUpperCase();
      // Match color code AND sheet height anywhere in label
      if(lbl.indexOf(code)>=0 && lbl.indexOf(sh)>=0){
        return opts[oi].p||0;
      }
    }
  }
  return 0;
}

function _getCorCode(){
  var el=document.getElementById('carac-cor-ext');
  if(!el) return '';
  // Try value first (value = full color name like "PRO1874 DARK GREY JLR MET")
  var txt=(el.value||'').toUpperCase();
  if(!txt){
    // Fallback to selected option text
    var opt=el.options[el.selectedIndex];
    txt=opt?(opt.text||'').toUpperCase():'';
  }
  var m=txt.match(/(PRO\w+)/);
  console.log('[AutoChapa] _getCorCode: txt="'+txt+'" → code="'+(m?m[1]:'')+'"');
  return m?m[1]:txt.trim();
}

function _autoSelectAndRun(){
  // Multi-porta: bypass _isModelReady (peças já calculadas por _mpCalcAllPiecesCombined)
  if(!(window._mpItens&&window._mpItens.length>0)){
    if(!_isModelReady()) return;
  }

  var Lv=parseFloat(document.getElementById('largura').value)||0;
  var Av=parseFloat(document.getElementById('altura').value)||0;
  var Mv=document.getElementById('plan-modelo').value;
  var Fv=parseInt(document.getElementById('plan-folhas').value)||1;
  var pieces, pcsNorm;
  // ── Multi-porta: usar peças combinadas ──
  if(window._mpItens && window._mpItens.length > 0){
    pcsNorm=_mpCalcAllPiecesCombined();
  } else {
    pieces=plnPecas(Lv,Av,Fv,Mv);
    // Fixo pieces
    var _tfPln2=document.getElementById('tem-fixo');
    if(_tfPln2&&_tfPln2.checked){
      document.querySelectorAll('.fixo-blk').forEach(function(el){
        var Lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
        var Af=parseFloat((el.querySelector('.fixo-alt')||{value:0}).value)||0;
        var ld=parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
        var qf=parseInt((el.querySelector('.fixo-qty')||{value:1}).value)||1;
        var tp=(el.querySelector('.fixo-tipo')||{value:'superior'}).value;
        if(Lf>0&&Af>0){
          var fp=tp==='superior'?aprovFixoPieces(Lv,Av,Lf,Af,ld,Mv||'01'):
            [{label:'FX LATERAL',w:Lf+100,h:Af+100,qty:ld,color:'#bab0ac'}];
          if(qf>1) fp.forEach(function(p){p.qty=p.qty*qf;});
          pieces=pieces.concat(fp);
        }
      });
    }
    var manualP=(typeof getManualPieces==='function')?getManualPieces():[];
    for(var i=0;i<manualP.length;i++) pieces.push(manualP[i]);
    if(!pieces.length) return;
    pcsNorm=pieces.map(function(p){
      if(Array.isArray(p)) return {label:p[0],w:p[1],h:p[2],qty:p[3]||1};
      return p;
    });
    var _qPAuto=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
    if(_qPAuto>1){ pcsNorm.forEach(function(p){ p.qty=p.qty*_qPAuto; }); }
  }
  if(!pcsNorm||!pcsNorm.length) return;

  // Separar peças ACM e ALU para otimização independente
  var _pcsACM=[], _pcsALU=[];
  pcsNorm.forEach(function(p){
    if(p.mat==='alu') _pcsALU.push(p); else _pcsACM.push(p);
  });
  var _hasALU=_pcsALU.length>0;

  var maxDim=0;
  _pcsACM.forEach(function(p){var d=Math.max(p.w,p.h);if(d>maxDim)maxDim=d;});

  var corCode=_getCorCode();
  // Fallback: extrair código da cor do dropdown do planificador
  if(!corCode){
    var planCor=document.getElementById('plan-acm-cor');
    if(planCor&&planCor.selectedIndex>0){
      var planTxt=(planCor.options[planCor.selectedIndex].text||'').toUpperCase();
      var pm=planTxt.match(/(PRO\w+)/);
      if(pm) corCode=pm[1];
    }
  }

  var SW=1500;
  // ALUSENSE (código AS) usa largura 1250mm
  var _isAlusense=corCode&&corCode.toUpperCase().indexOf('AS')===0;
  if(_isAlusense) SW=1250;
  var chapas=[5000,6000,7000,8000];
  var validas=chapas.filter(function(c){return c>=maxDim;});
  if(!validas.length) validas=[8000];

  var layoutMode=(document.getElementById('plan-layout')||{value:'v'}).value||'v';
  // Forçar horizontal como padrão se não foi definido manualmente
  if(!document.getElementById('plan-layout').dataset.manual) layoutMode='v';
  var melhor=null;
  // Fallback: pegar preço referência por tamanho de chapa (usa cor selecionada ou primeira disponível)
  function _getRefPrice(SH){
    if(corCode){var p=_getACMPrice(corCode,SH);if(p>0)return p;}
    var sh=String(SH);
    for(var gi=0;gi<ACM_DATA.length;gi++){
      var opts=ACM_DATA[gi].o||[];
      for(var oi=0;oi<opts.length;oi++){
        if((opts[oi].l||'').indexOf(sh)>=0 && opts[oi].p>0) return opts[oi].p;
      }
    }
    return 0;
  }
  var resultados=[];

  validas.forEach(function(SH){
    try{
      var res=plnMaxRects(_pcsACM, SW, SH, layoutMode);
      var totalPecas=0;
      _pcsACM.forEach(function(p){totalPecas+=p.w*p.h*p.qty;});
      var totalChapa=res.numSheets*SW*SH;
      var aprov=totalChapa>0?(totalPecas/totalChapa*100):0;
      var precoUn=_getRefPrice(SH);
      var custoTotal=res.numSheets*precoUn;

      resultados.push({sh:SH,n:res.numSheets,aprov:aprov,precoUn:precoUn,custo:custoTotal});

      // Melhor = menor custo total (se tem preco), senao menor qty chapas
      if(!melhor){
        melhor={sh:SH,n:res.numSheets,aprov:aprov,precoUn:precoUn,custo:custoTotal};
      } else if(precoUn>0 && melhor.precoUn>0){
        if(custoTotal<melhor.custo) melhor={sh:SH,n:res.numSheets,aprov:aprov,precoUn:precoUn,custo:custoTotal};
      } else {
        if(res.numSheets<melhor.n||(res.numSheets===melhor.n&&aprov>melhor.aprov))
          melhor={sh:SH,n:res.numSheets,aprov:aprov,precoUn:precoUn,custo:custoTotal};
      }
    }catch(e){}
  });

  if(!melhor) return;

  // Setar dropdown chapa
  var sel=document.getElementById('plan-chapa');
  if(sel){
    var tv=SW+'|'+melhor.sh;
    for(var i=0;i<sel.options.length;i++){if(sel.options[i].value===tv){sel.value=tv;break;}}
  }

  // Filtrar opcoes ACM pela chapa selecionada
  if(typeof filtrarChapasACM==='function') filtrarChapasACM();

  // Selecionar cor correta e quantidade
  var corEl=document.getElementById('carac-cor-ext');
  var corName2=corEl?(corEl.value||'').trim().toUpperCase():'';
  var corCode2=_getCorCode();
  var planAcm=document.getElementById('plan-acm-cor');

  function _tryMatchCor(){
    if(!planAcm||((!corName2)&&(!corCode2))) return false;
    for(var i=0;i<planAcm.options.length;i++){
      var optTxt=(planAcm.options[i].text||'').toUpperCase();
      var optName=optTxt.split('·')[0].trim();
      if((corName2 && (optName===corName2 || optTxt.indexOf(corName2)>=0)) ||
         (corCode2 && optTxt.indexOf(corCode2.toUpperCase())>=0)){
        planAcm.selectedIndex=i;
        console.log('[AutoChapa] Cor ACM idx='+i+': '+planAcm.options[i].text);
        return true;
      }
    }
    return false;
  }

  var found=_tryMatchCor();
  // Se cor não encontrada na chapa selecionada, tentar outras chapas
  if(!found && (corName2||corCode2) && resultados.length>0){
    var sortedRes=resultados.slice().sort(function(a,b){return a.n-b.n||(b.aprov-a.aprov);});
    for(var ri=0;ri<sortedRes.length;ri++){
      var trySH=sortedRes[ri].sh;
      if(trySH===melhor.sh) continue;
      var selChapa=document.getElementById('plan-chapa');
      if(selChapa){
        var tryVal=SW+'|'+trySH;
        for(var si=0;si<selChapa.options.length;si++){if(selChapa.options[si].value===tryVal){selChapa.value=tryVal;break;}}
      }
      if(typeof filtrarChapasACM==='function') filtrarChapasACM();
      found=_tryMatchCor();
      if(found){
        melhor=sortedRes[ri];
        console.log('[AutoChapa] Trocou chapa para '+trySH+' (cor disponível)');
        break;
      }
    }
  }
  if(!found) console.log('[AutoChapa] Cor '+(corName2||corCode2)+' NAO encontrada em nenhuma chapa');
  // Se nenhuma cor selecionada, pegar primeira opção disponível como referência
  if(planAcm && planAcm.selectedIndex<=0 && planAcm.options.length>1){
    planAcm.selectedIndex=1;
    console.log('[AutoChapa] Sem cor → selecionou referência: '+planAcm.options[1].text);
  }

  // Setar quantidade de chapas
  var qtyEl=document.getElementById('plan-acm-qty');
  if(qtyEl) qtyEl.value=melhor.n;

  // Sincronizar com orcamento + atualizar fabricacao
  if(typeof _syncChapaToOrc==='function') _syncChapaToOrc();
  if(typeof _updateFabChapaResumo==='function') _updateFabChapaResumo();

  // Salvar resultados globalmente para re-render
  window._simData={resultados:resultados,chapas:chapas,maxDim:maxDim,selSH:melhor.sh,corCode:corCode,sw:SW};

  // ── Otimização ALU Maciço (se houver peças ALU) ─────────────────────────
  if(_hasALU && _pcsALU.length>0){
    var aluSizes=[3000,5000,6000];
    var maxDimALU=0;
    _pcsALU.forEach(function(p){var d=Math.max(p.w,p.h);if(d>maxDimALU)maxDimALU=d;});
    var aluValidas=aluSizes.filter(function(s){return s>=maxDimALU;});
    if(!aluValidas.length) aluValidas=[6000];
    var melhorALU=null;
    aluValidas.forEach(function(SH){
      try{
        var res=plnMaxRects(_pcsALU, 1500, SH, layoutMode);
        var totP=0; _pcsALU.forEach(function(p){totP+=p.w*p.h*p.qty;});
        var totC=res.numSheets*1500*SH;
        var apv=totC>0?(totP/totC*100):0;
        if(!melhorALU || res.numSheets<melhorALU.n || (res.numSheets===melhorALU.n && apv>melhorALU.aprov)){
          melhorALU={sh:SH,n:res.numSheets,aprov:apv};
        }
      }catch(e){}
    });
    if(melhorALU){
      var aluSel2=document.getElementById('plan-chapa-alu');
      if(aluSel2){
        var aluVal='1500|'+melhorALU.sh;
        for(var ai2=0;ai2<aluSel2.options.length;ai2++){if(aluSel2.options[ai2].value===aluVal){aluSel2.value=aluVal;break;}}
      }
      if(typeof filtrarChapasACM==='function') filtrarChapasACM();
    }
  }

  // Renderizar cards horizontais
  _renderSimCards(melhor.sh);

  // Executar planRun, depois setar cor e qty
  var _bestN=melhor.n;
  var _corCC=_getCorCode();
  var _corName=(document.getElementById('carac-cor-ext')||{value:''}).value.trim().toUpperCase();
  setTimeout(function(){
    planRun();
    setTimeout(function(){
      // ACM cor match
      var pa=document.getElementById('plan-acm-cor');
      if(pa && (_corName||_corCC)){
        for(var i=0;i<pa.options.length;i++){
          var ot=(pa.options[i].text||'').toUpperCase();
          var on=ot.split('·')[0].trim();
          if((_corName && (on===_corName||ot.indexOf(_corName)>=0))||
             (_corCC && ot.indexOf(_corCC.toUpperCase())>=0)){
            pa.selectedIndex=i; break;
          }
        }
      }
      // ALU cor match (baseado em carac-cor-macico ou _pendingCorMacico)
      var palu=document.getElementById('plan-alu-cor');
      if(palu && palu.options.length>1){
        var _corMacico=(document.getElementById('carac-cor-macico')||{value:''}).value.toUpperCase();
        if(!_corMacico && window._pendingCorMacico) _corMacico=window._pendingCorMacico.toUpperCase();
        var _aluMatched=false;
        if(_corMacico){
          for(var ai=0;ai<palu.options.length;ai++){
            if((palu.options[ai].text||'').toUpperCase().indexOf(_corMacico)>=0){
              palu.selectedIndex=ai; _aluMatched=true; break;
            }
          }
        }
        // Fallback: selecionar primeira opção válida
        if(!_aluMatched && palu.selectedIndex<=0) palu.selectedIndex=1;
      }
      // Qty ACM: usar _chapasACM (planRun já separou)
      var qe=document.getElementById('plan-acm-qty');
      if(qe) qe.value=window._chapasACM||_bestN;
      if(typeof _syncChapaToOrc==='function') _syncChapaToOrc();
      if(typeof _updateFabChapaResumo==='function') _updateFabChapaResumo();
      if(typeof calc==='function') calc();
    },200);
  },100);
}
/* ── RENDER SIMULACAO CARDS HORIZONTAIS ────────────────────────────────── */
function _renderSimCards(selSH){
  var d=window._simData; if(!d) return;
  var infoEl=document.getElementById('plan-auto-info'); if(!infoEl) return;
  infoEl.style.display='';
  d.selSH=selSH;
  var SW=d.sw||1500;
  var brl=function(v){return'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var h='<div style="font-size:11px;font-weight:800;color:#003144;margin-bottom:8px;text-transform:uppercase;letter-spacing:.03em">Simulação de Chapas'+(d.corCode?' — '+d.corCode:'')+'</div>';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  d.chapas.forEach(function(SH){
    var r=null;
    for(var i=0;i<d.resultados.length;i++){if(d.resultados[i].sh===SH){r=d.resultados[i];break;}}
    var isSel=SH===selSH;
    var invalid=SH<d.maxDim;
    var bg=isSel?'#003144':invalid?'#f5e6e6':'#f0f4f6';
    var fg=isSel?'#fff':invalid?'#aaa':'#003144';
    var bdr=isSel?'2px solid #c47012':'1px solid #ddd';
    var click=invalid?'':'onclick="_selectChapaSim('+SH+','+(r?r.n:0)+')"';
    var cur=invalid?'default':'pointer';
    h+='<div style="flex:1;min-width:140px;background:'+bg+';color:'+fg+';border:'+bdr+';border-radius:10px;padding:10px 12px;cursor:'+cur+';transition:all .2s" '+click+'>';
    h+='<div style="font-size:10px;font-weight:800;letter-spacing:.03em;opacity:.7">'+SW+' × '+SH+'</div>';
    if(invalid){
      h+='<div style="font-size:10px;margin-top:6px;font-style:italic">Não cabe</div>';
    } else {
      h+='<div style="font-size:22px;font-weight:900;margin:4px 0">'+r.n+' <span style="font-size:11px;font-weight:600">chapas</span></div>';
      h+='<div style="font-size:10px;opacity:.8">Aprov. '+r.aprov.toFixed(0)+'%</div>';
      if(r.precoUn>0){
        h+='<div style="font-size:10px;margin-top:4px;opacity:.7">'+brl(r.precoUn)+'/un</div>';
        h+='<div style="font-size:13px;font-weight:800;margin-top:2px">'+brl(r.custo)+'</div>';
      }
      if(isSel) h+='<div style="font-size:9px;margin-top:4px;color:#f0c040;font-weight:700">✅ SELECIONADO</div>';
    }
    h+='</div>';
  });
  h+='</div>';
  infoEl.innerHTML=h;
}

function _selectChapaSim(sheetH, numChapas){
  // 1) Atualizar destaque visual
  if(window._simData) _renderSimCards(sheetH);
  // 2) Setar dropdown chapa
  var sel=document.getElementById('plan-chapa');
  if(sel){
    var _sw=(window._simData&&window._simData.sw)||1500;
    var tv=_sw+'|'+sheetH;
    for(var i=0;i<sel.options.length;i++){if(sel.options[i].value===tv){sel.value=tv;break;}}
  }
  // 3) Filtrar cores pela nova chapa
  if(typeof filtrarChapasACM==='function') filtrarChapasACM();
  // 4) Setar cor e qty
  var cc=_getCorCode();
  var pa=document.getElementById('plan-acm-cor');
  if(pa && cc){
    var cu=cc.toUpperCase();
    for(var i=0;i<pa.options.length;i++){
      if((pa.options[i].text||'').toUpperCase().indexOf(cu)>=0){pa.selectedIndex=i;break;}
    }
  }
  var qe=document.getElementById('plan-acm-qty');
  if(qe) qe.value=numChapas;
  window._chapasCalculadas=numChapas; // global para h-corte
  // 5) Re-run planRun (re-renderiza aproveitamento visual)
  planRun();
  // 6) Sync apos render
  setTimeout(function(){
    if(pa && cc){
      var cu=cc.toUpperCase();
      for(var i=0;i<pa.options.length;i++){
        if((pa.options[i].text||'').toUpperCase().indexOf(cu)>=0){pa.selectedIndex=i;break;}
      }
    }
    if(qe) qe.value=numChapas;
    window._chapasCalculadas=numChapas;
    if(typeof _syncChapaToOrc==='function') _syncChapaToOrc();
    if(typeof _updateFabChapaResumo==='function') _updateFabChapaResumo();
    if(typeof calc==='function') calc();
  },200);
}

function _autoSelectCorACM(){
  var corExtEl=document.getElementById('carac-cor-ext');
  if(!corExtEl||!corExtEl.value) return;
  var corNome=(corExtEl.options[corExtEl.selectedIndex]||{text:''}).text.toUpperCase();
  if(!corNome) return;
  var codeCor=corNome.split(' ')[0].split('-')[0].trim();
  if(codeCor.length<3) return;
  var planAcm=document.getElementById('plan-acm-cor');
  if(!planAcm) return;
  for(var i=0;i<planAcm.options.length;i++){
    if((planAcm.options[i].text||'').toUpperCase().indexOf(codeCor)>=0){
      planAcm.selectedIndex=i;  // ONLY selectedIndex
      if(typeof _syncChapaToOrc==='function') _syncChapaToOrc();
      break;
    }
  }
}

var _autoTimer=null;
function _planAutoDebounce(){
  if(_autoTimer) clearTimeout(_autoTimer);
  _autoTimer=setTimeout(function(){_autoSelectAndRun();},800);
}

/* ── PECAS MANUAIS ──────────────────────────────────── */
var manualPieceCount=0;
function addManualPiece(){
  var tb=document.getElementById('plan-manual-tbody');
  var id='mp-'+manualPieceCount++;
  var tr=document.createElement('tr');
  tr.id=id;
  tr.innerHTML='<td style="padding:3px 4px;border-bottom:0.5px solid var(--border)"><input type="text" id="'+id+'-n" placeholder="Ex: Fixo lateral" style="width:100%;padding:3px 5px;border:0.5px solid #c9c6bf;border-radius:4px;font-size:11px;background:#fffef5;color:var(--navy);font-weight:600"></td>'+
    '<td style="padding:3px 4px;border-bottom:0.5px solid var(--border)"><input type="number" id="'+id+'-w" placeholder="0" min="1" step="1" style="width:100%;padding:3px 5px;border:0.5px solid #c9c6bf;border-radius:4px;font-size:11px;text-align:right;background:#fffef5;font-weight:600" oninput="planUpd()"></td>'+
    '<td style="padding:3px 4px;border-bottom:0.5px solid var(--border)"><input type="number" id="'+id+'-h" placeholder="0" min="1" step="1" style="width:100%;padding:3px 5px;border:0.5px solid #c9c6bf;border-radius:4px;font-size:11px;text-align:right;background:#fffef5;font-weight:600" oninput="planUpd()"></td>'+
    '<td style="padding:3px 4px;border-bottom:0.5px solid var(--border)"><input type="number" id="'+id+'-q" value="1" min="1" step="1" style="width:100%;padding:3px 5px;border:0.5px solid #c9c6bf;border-radius:4px;font-size:11px;text-align:right;background:#fffef5;font-weight:600" oninput="planUpd()"></td>'+
    '<td style="padding:3px 4px;border-bottom:0.5px solid var(--border);text-align:center"><button onclick="removeManualPiece(\''+id+'\')" style="background:none;border:none;color:#b71c1c;font-size:14px;cursor:pointer;font-weight:700;padding:0 4px" title="Remover">✕</button></td>';
  tb.appendChild(tr);
  document.getElementById('plan-manual-empty').style.display='none';
  planUpd();
}
function removeManualPiece(id){
  var tr=document.getElementById(id);
  if(tr) tr.remove();
  var tb=document.getElementById('plan-manual-tbody');
  if(tb.children.length===0) document.getElementById('plan-manual-empty').style.display='';
  planUpd();
}
function getManualPieces(){
  var result=[];
  var rows=document.getElementById('plan-manual-tbody').children;
  for(var i=0;i<rows.length;i++){
    var id=rows[i].id;
    var n=document.getElementById(id+'-n').value||('MANUAL '+(i+1));
    var w=parseFloat(document.getElementById(id+'-w').value)||0;
    var h=parseFloat(document.getElementById(id+'-h').value)||0;
    var q=parseInt(document.getElementById(id+'-q').value)||1;
    if(w>0&&h>0) result.push({label:'✱ '+n,w:w,h:h,qty:q});
  }
  return result;
}

function _onChapaChange(){
  var sel=document.getElementById('plan-chapa');
  var cust=document.getElementById('plan-chapa-custom');
  if(sel.value==='custom'){
    cust.style.display='flex';
  } else {
    cust.style.display='none';
  }
  planUpd();filtrarChapasACM();_syncCorToChapa();_syncChapaToOrc();_osAutoUpdate();
}
function _onChapaCustomChange(){
  planUpd();_osAutoUpdate();
}
function _getChapaSize(){
  var sel=document.getElementById('plan-chapa');
  if(sel.value==='custom'){
    var larg=parseInt((document.getElementById('plan-chapa-larg')||{value:1500}).value)||1500;
    var alt=parseInt((document.getElementById('plan-chapa-alt')||{value:5000}).value)||5000;
    return {w:larg,h:alt};
  }
  var parts=sel.value.split('|');
  var w=parseInt(parts[0]),h=parseInt(parts[1]);
  // Alusense (AS): forçar largura 1250mm
  var planAcm=document.getElementById('plan-acm-cor');
  if(planAcm&&planAcm.selectedIndex>0){
    var acmTxt=(planAcm.options[planAcm.selectedIndex].text||'').toUpperCase();
    if(acmTxt.indexOf('AS')===0||acmTxt.indexOf('ALUSENSE')>=0) w=1250;
  }
  return {w:w,h:h};
}

function _planRecalcEdited(){
  if(!_plnPiecesRef.length) return;
  var _cs=_getChapaSize();
  var SW=_cs.w,SH=_cs.h;
  PLN_SD={w:SW,h:SH};
  var layoutMode=(document.getElementById('plan-layout').value)||'v';
  // Use edited pieces
  var pieces=_plnPiecesRef.map(function(p){return {label:p.label,w:p.w,h:p.h,qty:p.qty,color:p.color,_autoW:p._autoW,_autoH:p._autoH,_autoQ:p._autoQ};});
  PLN_RES=plnMaxRects(pieces,SW,SH,layoutMode);
  PLN_CSI=0;
  var totPA=0;
  for(var i=0;i<pieces.length;i++) totPA+=pieces[i].w*pieces[i].h*pieces[i].qty;
  var totSA=PLN_RES.numSheets*SW*SH;
  var util=(totPA/totSA*100).toFixed(1);
  var usable=(SW-2*PLN_MG)*(SH-2*PLN_MG);
  var KG_ACM=6.5;
  var pesoLiqACM=totPA/1e6*KG_ACM;
  var pesoBrutoACM=totSA/1e6*KG_ACM;
  var _portaPecasN=['TAMPA MAIOR','TAMPA MAIOR 01','TAMPA MAIOR 02','TAMPA MAIOR 03','CAVA','TAMPA BOR CAVA','TAMPA CAVA','TAMPA MENOR','ACAB LAT 1','ACAB LAT 2','ACAB LAT Z','TAMPA FRISO','FRISO','FRISO VERT','DIST BOR FV','RIPAS'];
  function _isPPN(lbl){var base=lbl.split('[')[0].split('EXT')[0].split('INT')[0].trim();for(var k=0;k<_portaPecasN.length;k++){if(base===_portaPecasN[k])return true;}return false;}
  var pesoPortaACM=0;
  for(var i=0;i<pieces.length;i++){if(_isPPN(pieces[i].label))pesoPortaACM+=(pieces[i].w*pieces[i].h*pieces[i].qty)/1e6*KG_ACM;}
  window._planPesoLiqACM=pesoLiqACM;window._planPesoPortaACM=pesoPortaACM;window._planPesoBrutoACM=pesoBrutoACM;
  _updatePesoAcessorios();
  var eff=(Math.ceil(totPA/Math.max(1,usable))/PLN_RES.numSheets*100).toFixed(0);
  document.getElementById('plan-sN').textContent=PLN_RES.numSheets;
  document.getElementById('plan-sU').textContent=util+'%';
  document.getElementById('plan-sW').textContent=(100-parseFloat(util)).toFixed(1)+'%';
  document.getElementById('plan-sE').textContent=eff+'%';
  var wd=document.getElementById('plan-warn');
  if(PLN_RES.failed.length>0){
    var tags='';for(var i=0;i<PLN_RES.failed.length;i++)tags+='<span style="background:#ffcdd2;border-radius:4px;padding:2px 7px;display:inline-block;margin:2px;font-size:11px;font-weight:600">'+PLN_RES.failed[i].label+' ('+PLN_RES.failed[i].w+'x'+PLN_RES.failed[i].h+'mm)</span>';
    wd.innerHTML='<strong>Atenção: '+PLN_RES.failed.length+' peça(s) não couberam!</strong> Ajuste as medidas e recalcule.<br>'+tags;wd.style.display='';
  } else {wd.style.display='none';}
  plnPieceTable(pieces,PLN_RES.placed);
  plnBuildTabs();plnLegend(pieces);plnDraw(0);
  var rb=document.getElementById('plan-recalc-btn');if(rb)rb.style.display='none';
}

function planRun() {
  var Lv=parseFloat(document.getElementById('largura').value)||0;
  var Av=parseFloat(document.getElementById('altura').value)||0;
  var Mv=document.getElementById('plan-modelo').value;
  var pieces=[];
  // ── Multi-porta: usar peças combinadas ──
  if(window._mpItens && window._mpItens.length > 0){
    pieces=_mpCalcAllPiecesCombined();
  } else {
    if(Mv&&Lv>0&&Av>0){
      var Fv=parseInt(document.getElementById('plan-folhas').value)||1;
      pieces=plnPecas(Lv,Av,Fv,Mv);
    }
    // Fixo pieces para planRun
    var _tfPR=document.getElementById('tem-fixo');
    if(_tfPR&&_tfPR.checked){
      document.querySelectorAll('.fixo-blk').forEach(function(el){
        var Lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
        var Af=parseFloat((el.querySelector('.fixo-alt')||{value:0}).value)||0;
        var ld=parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
        var qf=parseInt((el.querySelector('.fixo-qty')||{value:1}).value)||1;
        var tp=(el.querySelector('.fixo-tipo')||{value:'superior'}).value;
        if(Lf>0&&Af>0){
          var fp=tp==='superior'?aprovFixoPieces(Lv,Av,Lf,Af,ld,Mv||'01'):
            [{label:'FX LATERAL',w:Lf+100,h:Af+100,qty:ld,color:'#bab0ac'}];
          if(qf>1) fp.forEach(function(p){p.qty=p.qty*qf;});
          pieces=pieces.concat(fp);
        }
      });
    }
    var manualP=getManualPieces();
    for(var i=0;i<manualP.length;i++) pieces.push(manualP[i]);
    var _qPlan=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
    if(_qPlan>1){ pieces.forEach(function(p){ p.qty=p.qty*_qPlan; }); }
  }
  // Apply manual overrides (user-edited piece dimensions persist across sheet changes)
  for(var oi=0;oi<pieces.length;oi++){
    var ov=_plnManualOv[pieces[oi].label];
    if(ov){
      pieces[oi]._autoW=pieces[oi].w;
      pieces[oi]._autoH=pieces[oi].h;
      pieces[oi]._autoQ=pieces[oi].qty;
      pieces[oi].w=ov.w;
      pieces[oi].h=ov.h;
      pieces[oi].qty=ov.qty;
    }
  }
  if(pieces.length===0){alert('Nenhuma peça para calcular. Selecione um modelo ou adicione peças manuais.');return;}
  // Garantir cor em todas as peças
  for(var ci=0;ci<pieces.length;ci++){
    if(!pieces[ci].color) pieces[ci].color=PLN_COLORS[ci%PLN_COLORS.length];
  }

  var _cs=_getChapaSize();
  var SW=_cs.w,SH=_cs.h;
  PLN_SD={w:SW,h:SH};
  var layoutMode = (document.getElementById('plan-layout').value) || 'v';

  // ── Separar peças ALU e ACM ────────────────────────────────────────────────
  var piecesACM=[], piecesALU=[];
  for(var pi=0;pi<pieces.length;pi++){
    if(pieces[pi].mat==='alu') piecesALU.push(pieces[pi]);
    else piecesACM.push(pieces[pi]);
  }

  // ── Nesting ACM (principal) ────────────────────────────────────────────────
  var hasALU=piecesALU.length>0;
  // Show/hide ALU row
  var _aluRow=document.getElementById('plan-chapa-alu-row');
  if(_aluRow) _aluRow.style.display=hasALU?'':'none';

  // ★ ETAPA 1: AGRUPAR PEÇAS ACM POR COR ────────────────────────────────────
  // Objetivo: cada cor precisa ser cortada em chapas separadas (impossível
  // misturar BLACK com DARK GREY na mesma chapa).
  //
  // _cor vem populado em _mpCalcAllPiecesCombined() (js/18-auth.js):
  //   - Para peças de superfície com cor EXT≠INT, há peças "EXT" com _cor=corExt
  //     e "INT" com _cor=corInt (labels terminam em EXT/INT).
  //   - Para peças de estrutura ou cor única, _cor=corExt.
  //
  // Quando só há 1 cor (ou single-door sem _cor), comportamento é idêntico ao
  // antigo: 1 único grupo ACM.
  var _acmByColor = {};
  for(var pci=0; pci<piecesACM.length; pci++){
    var _p = piecesACM[pci];
    var _corKey = (_p._cor || '').toString().trim().toUpperCase() || 'SEM COR';
    if(!_acmByColor[_corKey]) _acmByColor[_corKey] = [];
    _acmByColor[_corKey].push(_p);
  }
  var _colorKeys = Object.keys(_acmByColor);
  // Ordem determinística: cor com mais peças primeiro, depois alfabética
  _colorKeys.sort(function(a,b){
    var da=_acmByColor[a].length, db=_acmByColor[b].length;
    if(da!==db) return db-da;
    return a.localeCompare(b);
  });
  // Rodar bin-packing separado POR COR
  var _resByColor = {};
  for(var ki=0; ki<_colorKeys.length; ki++){
    var _ck = _colorKeys[ki];
    _resByColor[_ck] = plnMaxRects(_acmByColor[_ck], SW, SH, layoutMode);
  }
  // Expor globalmente para Etapa 2 (UI de tabs) e Etapa 3/4 (aproveitamento + OS)
  window._PLN_RES_BY_COLOR = _resByColor;
  window._PLN_COLOR_KEYS = _colorKeys;
  window._PLN_ACTIVE_COLOR = _colorKeys[0] || null;

  // COMPAT: PLN_RES aponta para a primeira cor (para não quebrar código existente
  // que acessa PLN_RES.placed, PLN_RES.stats, PLN_RES.numSheets diretamente).
  // Nas Etapas 2+ a UI vai trocar dinamicamente qual cor está ativa.
  PLN_RES = _colorKeys.length>0 ? _resByColor[_colorKeys[0]] : {numSheets:0,placed:[],failed:[],stats:[]};
  PLN_CSI=0;

  // ── Nesting ALU (se houver) — usa tamanho de chapa ALU separado ──────────
  var SW_ALU=SW, SH_ALU=SH;
  var _aluSel=document.getElementById('plan-chapa-alu');
  if(_aluSel&&_aluSel.value){var _ap=_aluSel.value.split('|');SW_ALU=parseInt(_ap[0])||1500;SH_ALU=parseInt(_ap[1])||3000;}
  var PLN_RES_ALU = hasALU ? plnMaxRects(piecesALU,SW_ALU,SH_ALU,layoutMode) : {numSheets:0,placed:[],failed:[],stats:[]};
  window._plnResALU = PLN_RES_ALU;

  // Save ACM count BEFORE merge
  var numSheetsACM = PLN_RES.numSheets;
  var numSheetsALU = PLN_RES_ALU.numSheets;
  var numSheetsTotal = numSheetsACM + numSheetsALU;

  // Merge ALU into PLN_RES for unified display (tabs/canvas)
  if(hasALU && numSheetsALU > 0){
    for(var ai=0;ai<PLN_RES_ALU.placed.length;ai++){
      var ap=Object.assign({},PLN_RES_ALU.placed[ai]);
      ap.sheet = ap.sheet + numSheetsACM;
      ap.label = '🔷'+ap.label;
      PLN_RES.placed.push(ap);
    }
    for(var si=0;si<PLN_RES_ALU.stats.length;si++){
      var st2=Object.assign({},PLN_RES_ALU.stats[si]);
      st2._isALU=true;
      PLN_RES.stats.push(st2);
    }
    PLN_RES.numSheets = numSheetsTotal;
    PLN_RES.failed = PLN_RES.failed.concat(PLN_RES_ALU.failed);
  }

  // Área peças
  var totPA_ACM=0, totPA_ALU=0;
  for(var i=0;i<piecesACM.length;i++) totPA_ACM+=piecesACM[i].w*piecesACM[i].h*piecesACM[i].qty;
  for(var i=0;i<piecesALU.length;i++) totPA_ALU+=piecesALU[i].w*piecesALU[i].h*piecesALU[i].qty;
  var totPA=totPA_ACM+totPA_ALU;
  var totSA_ACM=numSheetsACM*SW*SH;
  var totSA_ALU=numSheetsALU*SW_ALU*SH_ALU;
  var totSA=totSA_ACM+totSA_ALU;
  var util=totSA>0?(totPA/totSA*100).toFixed(1):'0';
  var usable=(SW-2*PLN_MG)*(SH-2*PLN_MG);

  // ── PESO CHAPAS ──────────────────────────────────────────────────────────────
  var KG_ACM = 6.5, KG_ALU = 10.125; // kg/m²: ACM 4mm=6.5, ALU 2.5mm=10.125
  var pesoLiqACM  = totPA_ACM / 1e6 * KG_ACM;
  var pesoBrutoACM= totSA_ACM / 1e6 * KG_ACM;
  var pesoLiqALU  = totPA_ALU / 1e6 * KG_ALU;
  var pesoBrutoALU= totSA_ALU / 1e6 * KG_ALU;
  var _portaPecasNomes=['TAMPA MAIOR','TAMPA MAIOR 01','TAMPA MAIOR 02','TAMPA MAIOR 03','CAVA','TAMPA BOR CAVA','TAMPA CAVA','TAMPA MENOR','ACAB LAT 1','ACAB LAT 2','ACAB LAT Z','TAMPA FRISO','FRISO','FRISO VERT','DIST BOR FV','RIPAS','FIT ACAB ME','FIT ACAB MA','FIT ACAB FITA'];
  function _isPPN2(lbl){var base=(lbl||'').split('[')[0].split('EXT')[0].split('INT')[0].trim();if(base.indexOf('MOLD ')===0)return true;for(var k=0;k<_portaPecasNomes.length;k++){if(base===_portaPecasNomes[k])return true;}return false;}
  var pesoPortaACM=0, pesoPortaALU=0;
  for(var i=0;i<piecesACM.length;i++){if(_isPPN2(piecesACM[i].label))pesoPortaACM+=(piecesACM[i].w*piecesACM[i].h*piecesACM[i].qty)/1e6*KG_ACM;}
  for(var i=0;i<piecesALU.length;i++){if(_isPPN2(piecesALU[i].label))pesoPortaALU+=(piecesALU[i].w*piecesALU[i].h*piecesALU[i].qty)/1e6*KG_ALU;}
  window._planPesoLiqACM   = pesoLiqACM + pesoLiqALU;
  window._planPesoPortaACM = pesoPortaACM + pesoPortaALU;
  window._planPesoBrutoACM = pesoBrutoACM + pesoBrutoALU;
  // Separados para custo
  window._chapasACM = numSheetsACM;
  window._chapasALU = numSheetsALU;
  window._chapasCalculadas = numSheetsTotal;
  window._chapaALU_SW = SW_ALU;
  window._chapaALU_SH = SH_ALU;
  // Atualizar campos qty ACM e ALU separadamente
  var _qACMel=document.getElementById('plan-acm-qty');
  if(_qACMel) _qACMel.value=numSheetsACM;
  var _qALUel=document.getElementById('plan-alu-qty');
  if(_qALUel) _qALUel.value=numSheetsALU;
  // Show weights
  var elPLiq = document.getElementById('plan-peso-liq');
  var elPBrt = document.getElementById('plan-peso-bruto');
  if(elPLiq) elPLiq.textContent = (pesoLiqACM+pesoLiqALU).toFixed(2)+' kg';
  if(elPBrt) elPBrt.textContent = (pesoBrutoACM+pesoBrutoALU).toFixed(2)+' kg';
  // ALU qty label
  var _aluLbl=document.getElementById('plan-alu-qty-lbl');
  if(_aluLbl) _aluLbl.textContent=hasALU?numSheetsALU+' chapa'+(numSheetsALU>1?'s':'')+' ALU ('+SW_ALU+'×'+SH_ALU+')':'';
  _updatePesoAcessorios();

  var eff=numSheetsTotal>0?(Math.ceil(totPA/Math.max(1,usable))/numSheetsTotal*100).toFixed(0):'0';

  // Stats display
  // ★ ETAPA 3 (resumo): breakdown por cor quando há >= 2 cores ACM,
  //   pra que a área de compras saiba quantas chapas de cada cor pedir.
  var sNTxt;
  var _colorKeysR = window._PLN_COLOR_KEYS || [];
  if(_colorKeysR.length >= 2){
    // Multi-cor: "12 (4 BLACK DOOR + 8 DARK GREY" + (ALU se houver)
    var _parts = _colorKeysR.map(function(ck){
      var r = window._PLN_RES_BY_COLOR && window._PLN_RES_BY_COLOR[ck];
      return (r ? r.numSheets : 0) + ' ' + ck;
    });
    if(hasALU) _parts.push(numSheetsALU+' ALU');
    sNTxt = numSheetsTotal + ' (' + _parts.join(' + ') + ')';
  } else {
    sNTxt = hasALU ? numSheetsTotal+' ('+numSheetsACM+' ACM + '+numSheetsALU+' ALU)' : String(numSheetsTotal);
  }
  document.getElementById('plan-sN').textContent=sNTxt;
  document.getElementById('plan-sU').textContent=util+'%';
  document.getElementById('plan-sW').textContent=(100-parseFloat(util)).toFixed(1)+'%';
  document.getElementById('plan-sE').textContent=eff+'%';

  // Combined failures already in PLN_RES.failed
  var _allFailed = PLN_RES.failed.concat(PLN_RES_ALU.failed);
  var wd=document.getElementById('plan-warn');
  if (_allFailed.length>0) {
    var tags='';
    for(var i=0;i<_allFailed.length;i++)
      tags+='<span style="background:#ffcdd2;border-radius:4px;padding:2px 7px;display:inline-block;margin:2px;font-size:11px;font-weight:600">'+_allFailed[i].label+' ('+_allFailed[i].w+'x'+_allFailed[i].h+'mm)</span>';
    wd.innerHTML='<strong>Atenção: '+_allFailed.length+' peça(s) não couberam!</strong> Altere as medidas na tabela abaixo e clique Recalcular.<br>'+tags;
    wd.style.display='';
  } else { wd.style.display='none'; }

  plnPieceTable(pieces, PLN_RES.placed);
  document.getElementById('plan-result').style.display='';

  // ── Chapa Frontal — referência no planificador ──
  var _pfDiv=document.getElementById('plan-chapa-frontal');
  if(_pfDiv){
    var _pfL=Math.round(parseFloat((document.getElementById('largura')||{value:0}).value)||0);
    var _pfA=Math.round(parseFloat((document.getElementById('altura')||{value:0}).value)||0);
    var _pfSis=(document.getElementById('prod-sistema')||{value:''}).value||'';
    var _pfTUB=(_pfSis.indexOf('PA007')>=0||_pfA>=4000)?51:38;
    var _pfG4=Math.round(_pfA-10-_pfTUB-28+8);
    var _pfG3=Math.round(_pfL-20-343+218);
    var _pfG2=Math.round(_pfL-20-343+256);
    if(_pfL>0&&_pfA>0){
      _pfDiv.style.display='';
      _pfDiv.innerHTML='<div style="background:#f0f7ff;border:1px solid #b0cfe0;border-radius:6px;padding:8px 14px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">'
        +'<span style="font-size:10px;font-weight:800;color:#003144;text-transform:uppercase;letter-spacing:.04em">📐 Chapa Frontal</span>'
        +'<span style="font-size:11px"><b>ALT:</b> '+_pfG4+'</span>'
        +'<span style="font-size:11px;color:#1a5276"><b>LAR 1flh:</b> '+_pfG3+'</span>'
        +'<span style="font-size:11px;color:#6c3483"><b>LAR 2flh:</b> '+_pfG2+'</span>'
        +'</div>';
    }
  }
  document.getElementById('plan-use-btn').style.display='';
  document.getElementById('plan-print-btn').style.display='';
  plnBuildTabs();
  _plnRenderColorTabs();  // ★ Etapa 2: barra de cores (só mostra se >1 cor)
  plnLegend(pieces);
  plnDraw(0);
}

function plnPrintAll(){
  if(!PLN_RES||!PLN_RES.placed.length){alert('Calcule o aproveitamento primeiro.');return;}
  var SW=PLN_SD.w, SH=PLN_SD.h, NS=PLN_RES.numSheets;
  var w=window.open('','_blank','width=1100,height=800');
  // Header info
  var cli=document.getElementById('nome-cliente');
  var cliTxt=cli?cli.value:'—';
  var Lmm=Math.round(parseFloat(document.getElementById('largura').value)||0);
  var Amm=Math.round(parseFloat(document.getElementById('altura').value)||0);
  var modEl=document.getElementById('plan-modelo')||document.getElementById('carac-modelo');
  var modTxt=modEl&&modEl.selectedIndex>=0?(modEl.options[modEl.selectedIndex].text||''):'';
  var folTxt=(document.getElementById('plan-folhas')||{value:'1'}).value+' folha(s)';
  var qtdP=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
  // Legend
  var seen={},legItems=[];
  PLN_RES.placed.forEach(function(p){if(!seen[p.label]){seen[p.label]=p.color;legItems.push({l:p.label,c:p.color});}});
  // Piece summary table
  var pMap={};
  PLN_RES.placed.forEach(function(p){
    var k=p.label;
    if(!pMap[k])pMap[k]={label:k,w:p.w,h:p.h,qty:0,color:p.color};
    pMap[k].qty++;
  });
  var pArr=Object.values(pMap);
  // Build HTML
  var html='<!DOCTYPE html><html><head><title>Plano de Corte — '+cliTxt+'</title>';
  html+='<style>';
  html+='body{font-family:Arial,Helvetica,sans-serif;margin:20px;color:#1a3a4a}';
  html+='h1{font-size:16px;margin:0 0 4px}';
  html+='.info{font-size:11px;color:#555;margin-bottom:10px}';
  html+='.sheet{page-break-inside:avoid;margin-bottom:24px;border:1px solid #ddd;border-radius:6px;padding:12px}';
  html+='.sheet h2{font-size:13px;margin:0 0 8px;color:#e65100}';
  html+='.legend{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}';
  html+='.leg-item{display:flex;align-items:center;gap:4px;font-size:9px;font-weight:700}';
  html+='.leg-sq{width:12px;height:12px;border-radius:2px;border:1px solid rgba(0,0,0,.15)}';
  html+='table{border-collapse:collapse;font-size:10px;margin-top:8px;width:100%}';
  html+='th{background:#f0ede8;padding:4px 6px;text-align:left;border-bottom:1px solid #ccc;font-size:9px;text-transform:uppercase}';
  html+='td{padding:3px 6px;border-bottom:1px solid #eee}';
  html+='canvas{display:block;margin:0 auto}';
  html+='@media print{body{margin:10px}.sheet{border:none;page-break-after:always}}';
  html+='</style></head><body>';
  html+='<h1>Plano de Corte — Chapas ACM</h1>';
  html+='<div class="info">Cliente: <b>'+cliTxt+'</b> &nbsp;|&nbsp; '+Lmm+'×'+Amm+'mm &nbsp;|&nbsp; '+modTxt+' &nbsp;|&nbsp; '+folTxt+' &nbsp;|&nbsp; '+qtdP+' porta(s) &nbsp;|&nbsp; Chapa: '+SW+'×'+SH+'mm &nbsp;|&nbsp; <b>'+NS+' chapa(s)</b></div>';
  // Legend
  html+='<div class="legend">';
  legItems.forEach(function(it){html+='<span class="leg-item"><span class="leg-sq" style="background:'+it.c+'"></span>'+it.l+'</span>';});
  html+='</div>';
  // Summary table
  html+='<table><thead><tr><th>Peça</th><th style="text-align:right">L (mm)</th><th style="text-align:right">A (mm)</th><th style="text-align:center">Qtd</th><th style="text-align:right">Área m²</th></tr></thead><tbody>';
  var totA=0;
  pArr.forEach(function(p){
    var a=p.w*p.h*p.qty/1e6;totA+=a;
    html+='<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'+p.color+';vertical-align:middle;margin-right:4px"></span>'+p.label+'</td><td style="text-align:right">'+p.w+'</td><td style="text-align:right">'+p.h+'</td><td style="text-align:center">'+p.qty+'</td><td style="text-align:right">'+a.toFixed(3)+'</td></tr>';
  });
  html+='<tr style="font-weight:700"><td colspan="4">TOTAL</td><td style="text-align:right">'+totA.toFixed(3)+'</td></tr>';
  html+='</tbody></table>';
  // Each sheet
  for(var si=0;si<NS;si++){
    html+='<div class="sheet"><h2>Chapa '+(si+1)+' de '+NS+' — '+SW+'×'+SH+'mm</h2>';
    html+='<canvas id="pc'+si+'" width="1050" height="300"></canvas>';
    // piece list for this sheet
    var sps=PLN_RES.placed.filter(function(p){return p.sheet===si;});
    var sCounts={};
    sps.forEach(function(p){if(!sCounts[p.label])sCounts[p.label]={l:p.label,w:p.w,h:p.h,q:0,c:p.color};sCounts[p.label].q++;});
    html+='<div style="font-size:9px;color:#888;margin-top:6px">';
    Object.values(sCounts).forEach(function(c){html+='<span style="margin-right:10px"><b style="color:'+c.c+'">■</b> '+c.l+' '+c.w+'×'+c.h+' ×'+c.q+'</span>';});
    // Stats
    var st=PLN_RES.stats?PLN_RES.stats[si]:null;
    if(st) html+=' &nbsp;— <b>'+st.pct.toFixed(1)+'% aproveit.</b>';
    html+='</div></div>';
  }
  html+='<script>';
  html+='var PLN_RES='+JSON.stringify(PLN_RES)+';';
  html+='var SW='+SW+',SH='+SH+',MG='+PLN_MG+',KF='+PLN_KERF+',NS='+NS+';';
  html+='for(var si=0;si<NS;si++){';
  html+='  var cv=document.getElementById("pc"+si);if(!cv)continue;';
  html+='  var ctx=cv.getContext("2d");';
  html+='  var PAD=15,sc=Math.min((cv.width-PAD*2)/SH,(cv.height-PAD*2)/SW);';
  html+='  cv.width=Math.round(SH*sc+PAD*2);cv.height=Math.round(SW*sc+PAD*2);';
  html+='  ctx.fillStyle="#e8e5e0";ctx.fillRect(0,0,cv.width,cv.height);';
  html+='  ctx.fillStyle="#f8f8f6";ctx.fillRect(PAD,PAD,SH*sc,SW*sc);';
  html+='  var kv=Math.max(1,Math.round(KF/2*sc));';
  html+='  var ps=PLN_RES.placed.filter(function(p){return p.sheet===si;});';
  html+='  for(var i=0;i<ps.length;i++){';
  html+='    var p=ps[i];';
  html+='    var cx=PAD+p.y*sc+kv,cy=PAD+p.x*sc+kv,cw=p.h*sc-kv*2,ch=p.w*sc-kv*2;';
  html+='    if(cw<2||ch<2)continue;';
  html+='    ctx.globalAlpha=0.85;ctx.fillStyle=p.color;ctx.fillRect(cx,cy,cw,ch);';
  html+='    ctx.globalAlpha=1;ctx.strokeStyle="rgba(0,0,0,.25)";ctx.lineWidth=1;ctx.strokeRect(cx+.5,cy+.5,cw-1,ch-1);';
  html+='    if(cw>12&&ch>12){';
  html+='      ctx.save();ctx.beginPath();ctx.rect(cx+1,cy+1,cw-2,ch-2);ctx.clip();';
  html+='      var isV=ch>cw*1.8;';
  html+='      if(isV){ctx.translate(cx+cw/2,cy+ch/2);ctx.rotate(-Math.PI/2);';
  html+='        var fs=Math.max(7,Math.min(11,Math.min(ch/(p.label.length*.55),cw*.4)));';
  html+='        ctx.font="700 "+fs+"px Arial";ctx.textAlign="center";ctx.textBaseline="middle";';
  html+='        ctx.fillStyle="rgba(0,0,0,.8)";ctx.fillText(p.label,0,-(cw>fs*3?fs*.2:0));';
  html+='        if(cw>fs*2.5){ctx.font="600 "+Math.max(6,fs-1)+"px Arial";ctx.fillStyle="rgba(0,0,0,.4)";ctx.fillText(p.w+"x"+p.h,0,fs*.8);}';
  html+='      }else{';
  html+='        var fs=Math.max(7,Math.min(11,Math.min(cw/(p.label.length*.55),ch*.3)));';
  html+='        ctx.font="700 "+fs+"px Arial";ctx.textAlign="center";ctx.textBaseline="middle";';
  html+='        ctx.fillStyle="rgba(0,0,0,.8)";ctx.fillText(p.label,cx+cw/2,cy+ch/2-(ch>fs*3?fs*.3:0));';
  html+='        if(ch>fs*3){ctx.font="600 "+Math.max(6,fs-1)+"px Arial";ctx.fillStyle="rgba(0,0,0,.4)";ctx.fillText(p.w+"x"+p.h,cx+cw/2,cy+ch/2+fs*.85);}';
  html+='      }ctx.restore();';
  html+='    }';
  html+='  }';
  html+='}';
  html+='setTimeout(function(){window.print();},400);';
  html+='<\/script></body></html>';
  w.document.write(html);w.document.close();
}

function planUsarResultado() {
  if (!PLN_RES) return;
  var n = PLN_RES.numSheets;
  // Atualizar quantidade no planificador
  var planQty = document.getElementById('plan-acm-qty');
  if (planQty) planQty.value = n;
  // Sincronizar cor e quantidade para o orçamento (hidden selects + resumo)
  _syncChapaToOrc();
  alert('Quantidade de chapas atualizada para ' + n + ' unidade(s). Orçamento sincronizado.');
}


/* ══ CEP LOOKUP + DISTÂNCIA ════════════════════════════
   Busca CEP via ViaCEP, geocodifica via Nominatim OSM,
   calcula distância haversine de Uberlândia e arredonda
   para cima de 100 em 100 km
══════════════════════════════════════════════════════ */

// Uberlândia - MG coordenadas
// Fábrica: Av. dos Siquierolis, 51 - N. Sra. das Graças - Uberlândia-MG - CEP 38401-708
var UDI_LAT = -18.9045, UDI_LON = -48.2515;
var FACTORY_LAT = -18.9045, FACTORY_LON = -48.2515;
var FACTORY_ADDR = 'Avenida dos Siquierolis 51, Nossa Senhora das Graças, Uberlândia, MG';

// Geocodifica fábrica via Nominatim na primeira busca de CEP
function geocodeFactory() {
  if (FACTORY_LAT !== UDI_LAT) return Promise.resolve();
  var url = 'https://nominatim.openstreetmap.org/search?q=' +
    encodeURIComponent(FACTORY_ADDR) + '&format=json&limit=1';
  return fetch(url, {headers:{'User-Agent':'Projetta/1.0','Accept-Language':'pt-BR'}})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d&&d.length){
        FACTORY_LAT=parseFloat(d[0].lat);
        FACTORY_LON=parseFloat(d[0].lon);
      }
    }).catch(function(){});
}

/* ══ BUSCAR RESERVA NA INTRANET ══════════════════════════ */
// ⚠️ CONFIGURAR: Pedir ao programador a URL base da API da intranet
var RESERVA_API_URL = 'https://plmliavuwlgpwaizfeds.supabase.co'; // Supabase
var RESERVA_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

function buscarReserva() {
  var numEl = document.getElementById('numprojeto') || document.getElementById('crm-o-reserva');
  var num = (numEl ? numEl.value : '').trim();
  var status = document.getElementById('reserva-status');
  if (!num) { if(status){status.textContent = '⚠ digite o nº da reserva'; status.style.color = '#b71c1c';} return; }
  if(status){status.textContent = '⏳ buscando reserva ' + num + '...'; status.style.color = 'var(--orange)';}

  // ══ 1. Tentar API Weiku (homologação) ══
  var weikuUrl='https://intranet.weiku.com.br/v2/api/reservas/reserva/'+encodeURIComponent(num);
  fetch(weikuUrl,{method:'GET',headers:{'Accept':'application/json'}})
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
  .then(function(found){
    if(!found||!found.reserva){throw new Error('vazio');}
    // Preencher campos do ORÇAMENTO
    var np=$('numprojeto');if(np)np.value=found.reserva||num;
    var agp=$('num-agp');if(agp&&found.codigo)agp.value=found.codigo;
    var c=$('cliente');if(c&&found.cliente&&!c.value)c.value=_toTitleCase(found.cliente);
    // Preencher campos do CRM modal
    var crmReserva=$('crm-o-reserva');if(crmReserva)crmReserva.value=found.reserva||num;
    var crmAgp=$('crm-o-agp');if(crmAgp&&found.codigo)crmAgp.value=found.codigo;
    var crmCliente=$('crm-o-cliente');if(crmCliente&&found.cliente)crmCliente.value=_toTitleCase(found.cliente);
    var crmEmail=$('crm-o-email');if(crmEmail&&found.email)crmEmail.value=found.email;
    var crmCep=$('crm-o-cep');if(crmCep&&found.cep)crmCep.value=found.cep;
    // CEP do orçamento
    var cepOrc=$('cep-cliente');if(cepOrc&&found.cep)cepOrc.value=found.cep;
    // Status visual
    var campos=['Reserva: '+found.reserva];
    if(found.codigo) campos.push('AGP: '+found.codigo);
    if(found.representante) campos.push('Rep: '+found.representante);
    if(found.tipo) campos.push('Tipo: '+found.tipo);
    if(found.email) campos.push('Email: '+found.email);
    if(status){
      status.innerHTML='✅ <b>'+found.reserva+'</b> | '+_toTitleCase(found.cliente||'')+(found.representante?' | Rep: '+found.representante:'')+(found.tipo?' | '+found.tipo:'');
      status.style.color='#27ae60';
    }
  }).catch(function(e){
    // ══ 2. Fallback: Supabase ══
    var url = RESERVA_API_URL+'/rest/v1/weiku_reservas?';
    if(/^\d+$/.test(num)){
      url += 'num_reserva=eq.'+num;
    } else if(/^AGP/i.test(num)){
      url += 'agp=ilike.*'+num+'*';
    } else {
      url += 'or=(followup.ilike.*'+num+'*,reserva_interna.ilike.*'+num+'*)';
    }
    url += '&limit=1';
    fetch(url, {headers:{'apikey':RESERVA_API_KEY,'Authorization':'Bearer '+RESERVA_API_KEY}})
    .then(function(r){return r.json();})
    .then(function(data){
      if(!data||!data.length){
        if(status){status.textContent='⚠ Reserva '+num+' não encontrada.';status.style.color='#b71c1c';}
        return;
      }
      var found=data[0];
      var np=$('numprojeto');if(np)np.value=found.num_reserva||num;
      var agp=$('num-agp');if(agp&&found.agp)agp.value=found.agp;
      var crmReserva=$('crm-o-reserva');if(crmReserva)crmReserva.value=found.num_reserva||num;
      var crmAgp=$('crm-o-agp');if(crmAgp&&found.agp)crmAgp.value=found.agp;
      var clienteName=found.followup||found.reserva_interna||'';
      clienteName=clienteName.replace(/^(SP_|MG_|PR_|RS_|SC_|RJ_|ES_|GO_|MT_|MS_)/i,'').replace(/_/g,' ');
      var c=$('cliente');if(c&&clienteName&&!c.value)c.value=clienteName;
      var dataRes=found.data_reserva?new Date(found.data_reserva+'T12:00:00').toLocaleDateString('pt-BR'):'';
      if(status){
        status.innerHTML='✅ <b>'+found.num_reserva+'</b> | '+found.regiao+' | '+(found.followup||'—')+' | '+dataRes;
        status.style.color='#27ae60';
      }
    }).catch(function(e2){
      if(status){status.textContent='❌ Erro: '+e2.message;status.style.color='#b71c1c';}
    });
  });
}

function cepMask(el) {
  var v = el.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
  el.value = v;
}

function limparCep() {
  var cepEl = document.getElementById('cep-cliente');
  if (cepEl) cepEl.value = '';
  var kmEl = document.getElementById('km');
  if (kmEl) kmEl.value = '';
  var info = document.getElementById('cep-info');
  if (info) info.style.display = 'none';
  var cidadeEl = document.getElementById('cep-cidade');
  if (cidadeEl) cidadeEl.textContent = '';
  var distEl = document.getElementById('cep-dist');
  if (distEl) distEl.textContent = '';
  var linksEl = document.getElementById('cep-links');
  if (linksEl) { linksEl.innerHTML = ''; linksEl.style.display = 'none'; }
  var pedagioEl = document.getElementById('pedagio');
  if (pedagioEl) pedagioEl.value = '';
  var pedEstEl = document.getElementById('pedagio-est');
  if (pedEstEl) pedEstEl.style.display = 'none';
  var rotaEl = document.getElementById('pedagio-rota');
  if (rotaEl) rotaEl.style.display = 'none';
  var hotRoomInfo = document.getElementById('hotel-rooms-info');
  if (hotRoomInfo) hotRoomInfo.style.display = 'none';
  calc();
}

/* ══ BUSCA CEP PARA ENDEREÇO ATP ═══════════════════════════ */
function buscaCepATP(){
  var cep = ($('atp-cep')||{value:''}).value.replace(/\D/g,'');
  if(cep.length!==8){ alert('CEP inválido. Digite 8 dígitos.'); return; }
  var st = $('atp-cep-status');
  if(st){ st.style.display=''; st.textContent='⏳ Buscando CEP...'; st.style.color='var(--orange)'; }
  fetch('https://viacep.com.br/ws/'+cep+'/json/')
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.erro){ if(st){st.textContent='❌ CEP não encontrado';st.style.color='#b71c1c';} return; }
      if(d.logradouro) $('atp-rua').value = d.logradouro;
      if(d.bairro) $('atp-bairro').value = d.bairro;
      if(d.complemento && !$('atp-complemento').value) $('atp-complemento').value = d.complemento;
      $('atp-cidade').value = (d.localidade||'') + ' - ' + (d.uf||'');
      if(st){ st.textContent='✅ '+d.logradouro+', '+d.bairro+' — '+(d.localidade||'')+'/'+d.uf; st.style.color='#27ae60'; }
    })
    .catch(function(e){
      if(st){ st.textContent='❌ Erro ao buscar CEP'; st.style.color='#b71c1c'; }
    });
}

function _haversineKm(lat1,lon1,lat2,lon2){
  var R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function _fetchTimeout(url,opts,ms){
  return new Promise(function(resolve,reject){
    var timer=setTimeout(function(){reject(new Error('timeout'));},ms||8000);
    fetch(url,opts).then(function(r){clearTimeout(timer);resolve(r);}).catch(function(e){clearTimeout(timer);reject(e);});
  });
}
function _cepSetResult(cidade,uf,distKm,isEstrada){
  var distEl=document.getElementById('cep-dist');
  var distArred=Math.ceil(distKm/100)*100;
  var tipo=isEstrada?'rota carro':'aprox. linha reta ×1.3';
  distEl.textContent='Distância de Uberlândia: '+distArred+' km ('+tipo+', real '+Math.round(distKm)+' km)';
  distEl.style.color='var(--orange)';
  var kmEl=document.getElementById('km');
  if(kmEl&&!kmEl.dataset.manual){kmEl.value=distArred;calc();}
  var mapsUrl='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(FACTORY_ADDR)+'&destination='+encodeURIComponent(cidade+', '+uf+', Brasil')+'&travelmode=driving';
  var linksEl=document.getElementById('cep-links');
  if(linksEl){linksEl.innerHTML='<a href="'+mapsUrl+'" target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:#003144;color:#fff;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;margin-top:4px">&#x1F5FA; Ver rota no Google Maps</a>';linksEl.style.display='';}
}
function buscaCep() {
  var cep = (document.getElementById('cep-cliente').value || '').replace(/\D/g, '');
  if (cep.length !== 8) return;
  var info     = document.getElementById('cep-info');
  var cidadeEl = document.getElementById('cep-cidade');
  var distEl   = document.getElementById('cep-dist');
  cidadeEl.textContent = 'Buscando...';
  info.style.display = '';
  distEl.textContent = '';

  geocodeFactory().then(function(){
    // Tentar ViaCEP e BrasilAPI em paralelo
    var done=false;
    function _onCepFound(cidade,uf){
      if(done)return;done=true;
      cidadeEl.textContent=cidade+' - '+uf;
      distEl.textContent='Calculando distância...';
      // Geocode: tentar Nominatim structured → Nominatim q → fallback coords capitais
      var _geoHeaders={'Accept':'application/json'};
      var geoUrl1='https://nominatim.openstreetmap.org/search?city='+encodeURIComponent(cidade)+'&state='+encodeURIComponent(uf)+'&country=Brazil&format=json&limit=1';
      var geoUrl2='https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(cidade+', '+uf+', Brasil')+'&format=json&limit=1';
      var _geoDone=false;
      function _onGeoResult(dLat,dLon){
        if(_geoDone)return;_geoDone=true;
        // Valhalla
        var vUrl='https://valhalla1.openstreetmap.de/route';
        var vBody=JSON.stringify({locations:[{lat:FACTORY_LAT,lon:FACTORY_LON},{lat:dLat,lon:dLon}],costing:'auto',units:'km'});
        fetch(vUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:vBody})
          .then(function(r){return r.json();}).then(function(vr){
            if(vr&&vr.trip&&vr.trip.summary&&vr.trip.summary.length>0)_cepSetResult(cidade,uf,vr.trip.summary.length,true);
            else throw new Error('x');
          }).catch(function(){
            // OSRM
            fetch('https://router.project-osrm.org/route/v1/driving/'+FACTORY_LON+','+FACTORY_LAT+';'+dLon+','+dLat+'?overview=false')
              .then(function(r){return r.json();}).then(function(rt){
                if(rt&&rt.routes&&rt.routes.length)_cepSetResult(cidade,uf,rt.routes[0].distance/1000,true);
                else throw new Error('x');
              }).catch(function(){
                // Haversine fallback
                _cepSetResult(cidade,uf,_haversineKm(FACTORY_LAT,FACTORY_LON,dLat,dLon)*1.3,false);
              });
          });
      }
      // Capitais brasileiras para fallback
      var _CAPS={AC:[-9.97,-67.81],AL:[-9.66,-35.74],AP:[0.03,-51.06],AM:[-3.12,-60.02],BA:[-12.97,-38.51],CE:[-3.72,-38.52],DF:[-15.78,-47.93],ES:[-20.32,-40.34],GO:[-16.68,-49.25],MA:[-2.53,-44.28],MT:[-15.60,-56.10],MS:[-20.44,-54.65],MG:[-19.92,-43.94],PA:[-1.46,-48.50],PB:[-7.12,-34.86],PR:[-25.43,-49.27],PE:[-8.05,-34.87],PI:[-5.09,-42.80],RJ:[-22.91,-43.17],RN:[-5.79,-35.21],RS:[-30.03,-51.23],RO:[-8.76,-63.90],RR:[2.82,-60.67],SC:[-27.59,-48.55],SP:[-23.55,-46.63],SE:[-10.91,-37.07],TO:[-10.18,-48.33]};
      // Geocode attempt 1: Nominatim structured
      fetch(geoUrl1,{headers:_geoHeaders}).then(function(r){return r.json();}).then(function(geo){
        if(geo&&geo.length) _onGeoResult(parseFloat(geo[0].lat),parseFloat(geo[0].lon));
        else throw new Error('empty');
      }).catch(function(){
        // Geocode attempt 2: Nominatim q= format
        fetch(geoUrl2,{headers:_geoHeaders}).then(function(r){return r.json();}).then(function(geo2){
          if(geo2&&geo2.length) _onGeoResult(parseFloat(geo2[0].lat),parseFloat(geo2[0].lon));
          else throw new Error('empty2');
        }).catch(function(){
          // Geocode attempt 3: geocode.maps.co
          fetch('https://geocode.maps.co/search?q='+encodeURIComponent(cidade+', '+uf+', Brazil')+'&format=json&limit=1').then(function(r){return r.json();}).then(function(geo3){
            if(geo3&&geo3.length) _onGeoResult(parseFloat(geo3[0].lat),parseFloat(geo3[0].lon));
            else{var cap3=_CAPS[uf.toUpperCase()];if(cap3)_onGeoResult(cap3[0],cap3[1]);else if(distEl)distEl.textContent='Digite km manualmente';}
          }).catch(function(){
            // Fallback final: coordenadas da capital do estado
            var cap=_CAPS[uf.toUpperCase()];
            if(cap) _onGeoResult(cap[0],cap[1]);
            else if(distEl) distEl.textContent='Digite km manualmente';
          });
        });
      });
    }
    // API 1: ViaCEP
    fetch('https://viacep.com.br/ws/'+cep+'/json/').then(function(r){return r.json();}).then(function(d){
      if(d&&!d.erro&&d.localidade)_onCepFound(d.localidade,d.uf);
    }).catch(function(){});
    // API 2: BrasilAPI
    fetch('https://brasilapi.com.br/api/cep/v1/'+cep).then(function(r){return r.json();}).then(function(d){
      if(d&&d.city)_onCepFound(d.city,d.state);
    }).catch(function(){});
    // Timeout 8s
    setTimeout(function(){if(!done){cidadeEl.textContent='CEP não encontrado (timeout)';done=true;}},8000);
  }).catch(function(){cidadeEl.textContent='Erro geocodificação';});
}



/* ══ FILTRAR CHAPAS ACM POR TAMANHO ════════════════════
   Quando o tamanho da chapa muda no planificar,
   filtra o dropdown de ACM para mostrar só esse tamanho.
   Ex: 1500×5000 → só opções "5000" aparecem.
══════════════════════════════════════════════════════ */

function acmOptsFiltered(sizeStr) {
  // sizeStr = "5000" | "6000" | "7000" | "8000"
  let html = '<option value="0|0">— Selecionar chapa —</option>';
  ACM_DATA.forEach(g => {
    const items = g.o.filter(it => it.l.includes('×' + sizeStr) || it.l.includes('x' + sizeStr));
    if (!items.length) return;
    html += `<optgroup label="${g.g}">`;
    items.forEach(it => {
      const pf = it.p.toLocaleString('pt-BR', {minimumFractionDigits:2});
      html += `<option value="${it.p}|${it.a}">${it.l}  ·  R$ ${pf}/chapa</option>`;
    });
    html += '</optgroup>';
  });
  return html;
}

function aluOptsFiltered(sizeStr) {
  let html = '<option value="0|0">— Selecionar chapa —</option>';
  ALU_DATA.forEach(g => {
    const items = g.o.filter(it => it.l.includes('×' + sizeStr) || it.l.includes('x' + sizeStr));
    if (!items.length) return;
    html += `<optgroup label="${g.g}">`;
    items.forEach(it => {
      const pf = it.p.toLocaleString('pt-BR', {minimumFractionDigits:2});
      html += `<option value="${it.p}|${it.a}">${it.l}  ·  R$ ${pf}/chapa</option>`;
    });
    html += '</optgroup>';
  });
  return html;
}

function getCurrentPlanSize() {
  const sel = document.getElementById('plan-chapa');
  if (!sel) return '5000';
  const parts = sel.value.split('|');
  return parts[1] || '5000';
}

function filtrarChapasACM() {
  const size = getCurrentPlanSize();
  const filteredACM = acmOptsFiltered(size);
  // ALU: usar tamanho da chapa ALU (não da ACM)
  var aluSizeSel=document.getElementById('plan-chapa-alu');
  var aluSize=aluSizeSel&&aluSizeSel.value?(aluSizeSel.value.split('|')[1]||'3000'):'3000';
  const filteredALU = aluOptsFiltered(aluSize);
  // Atualiza blocos ACM ocultos
  for (let i = 1; i <= aC; i++) {
    const sel = document.getElementById('acm-sel-' + i);
    if (!sel) continue;
    const oldVal = sel.value;
    sel.innerHTML = filteredACM;
    try { sel.value = oldVal; } catch(e) {}
    if (!sel.value || sel.value === 'null') sel.value = '0|0';
  }
  // Atualiza dropdowns do Planificador
  var planAcm = document.getElementById('plan-acm-cor');
  if (planAcm) {
    var oldText = planAcm.selectedIndex>=0 ? (planAcm.options[planAcm.selectedIndex].text||'') : '';
    var oldCode = ''; var mc=oldText.match(/(PRO\w+)/); if(mc) oldCode=mc[1].toUpperCase();
    var oldName = oldText.split('·')[0].trim().toUpperCase();
    planAcm.innerHTML = '<option value="">— Sem chapa ACM —</option>' + filteredACM.replace('<option value="0|0">— Selecionar chapa —</option>','');
    // Restore by color code or full name in TEXT
    var restored=false;
    if(oldCode||oldName){
      for(var ri=0;ri<planAcm.options.length;ri++){
        var rTxt=(planAcm.options[ri].text||'').toUpperCase();
        var rName=rTxt.split('·')[0].trim();
        if((oldCode && rTxt.indexOf(oldCode)>=0)||(oldName && oldName.length>2 && rName===oldName)){
          planAcm.selectedIndex=ri; restored=true; break;
        }
      }
    }
    if (!restored) planAcm.selectedIndex = 0;
  }
  var planAlu = document.getElementById('plan-alu-cor');
  if (planAlu) {
    var oldAlu = planAlu.value;
    planAlu.innerHTML = '<option value="">— Sem chapa alumínio —</option>' + filteredALU.replace('<option value="0|0">— Selecionar chapa —</option>','');
    planAlu.value = oldAlu;
    if (!planAlu.value) planAlu.selectedIndex = 0;
  }
  // Nota: _syncChapaToOrc removido daqui — chamado explicitamente apos selecao de cor
}


function aplicarPedagio(){
  var km=n('km');
  if(km<=0) return;
  var est=Math.ceil((km*2*0.15)/50)*50;
  document.getElementById('pedagio').value=est;
  calc();
}

function abrirSemParar(e) {
  // Sem Parar não aceita parâmetros de URL — abre a calculadora
  // O link Sem Parar vai direto para a calculadora de rotas
  var cidadeEl = document.getElementById('cep-cidade');
  var cidade = cidadeEl ? cidadeEl.textContent.trim() : '';
  var km = n('km');

  // Tenta usar Google Maps como fallback com informação de pedágio
  // O Sem Parar não tem URL com parâmetros, então abrimos a página deles
  // e mostramos a rota para o usuário preencher manualmente
  var link = document.getElementById('semparar-link');
  if (link) {
    // Sem Parar calculator URL — sem suporte a parâmetros de URL diretos
    link.href = 'https://www.semparar.com.br/trace-sua-rota';
  }
  // Mostrar info da rota
  var rotaEl = document.getElementById('pedagio-rota');
  var destEl = document.getElementById('ped-destino');
  if (rotaEl && destEl) {
    destEl.textContent = cidade && cidade.length > 2 ? cidade : 'preencha o CEP primeiro';
    rotaEl.style.display = cidade && cidade.length > 2 ? '' : 'none';
  }
}


/* ── TOGGLE SECTIONS ─────────────────────────────────── */
function toggleSection(bodyId, badgeId) {
  var body  = document.getElementById(bodyId);
  var badge = document.getElementById(badgeId);
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (badge) badge.innerHTML = isOpen ? '&#9660; clique para abrir' : '&#9650; fechar';
}


function atualizaBookingLink(el) {
  var cidadeEl = document.getElementById('cep-cidade');
  var cidade = cidadeEl ? cidadeEl.textContent.trim() : '';
  var quartos = 1;
  var pessoas = parseFloat(document.getElementById('pessoas').value) || 2;
  quartos = Math.max(1, Math.ceil(pessoas/2));
  if (cidade && cidade.length > 2) {
    el.href = 'https://www.booking.com/search.html?ss=' +
      encodeURIComponent(cidade) +
      '&no_rooms=' + quartos +
      '&group_adults=' + Math.min(pessoas, quartos*2) +
      '&selected_currency=BRL&lang=pt-br';
  } else {
    el.href = 'https://www.booking.com/?selected_currency=BRL&lang=pt-br';
  }
}


// autoMargem removida — lucro-alvo sempre 20%

/* ══ END MODULE: PLANIFICADOR_UI ══ */
