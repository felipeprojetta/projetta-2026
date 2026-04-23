/**
 * 05-aproveitamento_chapas.js
 * Module: APROVEITAMENTO_CHAPAS
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: APROVEITAMENTO_CHAPAS ══ */
var APROV_COLORS=['#4e79a7','#e8851a','#59a14f','#76b7b2','#e15759','#b07aa1','#9c755f','#bab0ac',
  '#6ea6c8','#f7b4b4','#a2d6a0','#ffd880','#c5a0d8','#80c8c0','#d49856','#a0c4e0','#e0a0c0','#98d498','#c8b060','#edc948'];
var APROV_RES=null, APROV_CSI=0, APROV_SD={w:1500,h:5000,mg:10};

function aprovPieces(Lmm,Amm,fol,mod){
  var L=Math.round(Lmm),A=Math.round(Amm);
  var _sis=($('prod-sistema')||{value:''}).value||'';
  var TUB_SUP=(_sis.indexOf('PA007')>=0||(typeof _isInternacional==='function'&&_isInternacional()))?51:38;
  var G4=A-10-TUB_SUP-28+8,G3=Math.round(L-20-343+218),G2=Math.round((L-20-343+256)/2);
  var fW=(fol==2)?G2:G3,bH=G4+116,nL=(fol==2)?4:2,r=[];
  if(mod==='10'||mod==='11'||mod==='12'||mod==='13'||mod==='14'||mod==='15'||mod==='16'||mod==='17'||mod==='18'||mod==='20'||mod==='21'||mod==='23acm'||mod==='23alu'){
    if(fol==1)r.push(['TAMPA MAIOR',fW+40,G4,2]);
    else{r.push(['TAMPA F1',G2+32,G4,1],['TAMPA F2',G2+14,G4,2],['TAMPA F3',G2-4,G4,1]);}
    r.push(['ACAB LAT 1',88.5,G4,nL],['ACAB LAT 2',90,G4,nL],['ACAB LAT Z',110,G4,nL]);
    r.push(['U PORTAL',221,L-20,1],['BAT 01',42,bH,2],['BAT 02Z',51,bH,2],['BAT 03',81,bH,2]);
    r.push(['TAP FURO',119,bH,3],['FIT ACAB ME',76.5,bH,2],['FIT ACAB MA',114.5,bH,2],['FIT ACAB FITA',101,bH,2]);
    if(document.getElementById('carac-tem-alisar')&&document.getElementById('carac-tem-alisar').checked) r.push(['ALISAR ALT',225,A+150,5],['ALISAR LAR',225,L+300,2]);
    if(mod==='23acm'||mod==='23alu'){var ml=Math.max(0,fW-300),ma=823,mb=Math.max(0,G4-675-ma);
      r.push(['MOLD LAR',143,ml,8],['MOLD ALT1',143,ma,(fol==2)?8:4]);if(mb>50)r.push(['MOLD ALT2',143,mb,(fol==2)?8:4]);}
    if(mod==='11')r.push(['FRISO VERT',100,G4,2],['DIST BOR FV',Math.round(fW*.28),G4,2]);
    if(mod==='15'){
      var _ripTotal=($('carac-ripado-total')||{value:'NAO'}).value==='SIM';
      var _rip2L=($('carac-ripado-2lados')||{value:'SIM'}).value==='SIM';
      var _nRipas=_ripTotal?Math.max(1,Math.ceil(fW/98)):Math.max(1,Math.ceil((fW-88.5*2-90-110)/98));
      var _ripMult=(_rip2L?2:1)*((fol==2)?2:1);
      window._qtdRipasTotal=_nRipas*_ripMult;
      r.push(['RIPAS',98,G4,_nRipas*_ripMult]);
    }
  }
  if(mod==='01'||mod==='02'||mod==='03'||mod==='04'||mod==='05'||mod==='06'||mod==='07'||mod==='08'||mod==='09'||mod==='19'||mod==='24'){
    var DC=parseInt($('aprov-dim-cava').value)||150,HC=parseInt($('aprov-h-cava').value)||210;
    var _VED2=35,_TLI2=(TUB_SUP>=51)?101.8:76.2;
    var _TV2=Math.round(A-10-TUB_SUP-28-2*_VED2-2*_TLI2);
    var cH=Math.max(0,_TV2-12);
    var cavaDeduc=DC+HC+2;
    r.push(['CAVA',DC+116,cH,(fol==2)?4:2],['TAMPA CAVA',DC+90,HC,4]);
    if(fol==1)r.push(['TAMPA MAIOR',fW+40-cavaDeduc,G4,2]);
    else{var G2c=Math.round((fW+40-cavaDeduc)/2);r.push(['TAMPA F1',G2c+19,G4,1],['TAMPA F2',G2c,G4,2],['TAMPA F3',G2c-19,G4,1]);}
    r.push(['TAMPA BOR CAVA',HC+38,G4,(fol==2)?4:2]);
    r.push(['ACAB LAT 1',88.5,G4,nL],['ACAB LAT 2',90,G4,nL],['ACAB LAT Z',110,G4,nL]);
    r.push(['U PORTAL',221,L-20,1],['BAT 01',42,bH,2],['BAT 02Z',51,bH,2],['BAT 03',81,bH,2]);
    r.push(['TAP FURO',119,bH,3],['FIT ACAB ME',76.5,bH,2],['FIT ACAB MA',114.5,bH,2],['FIT ACAB FITA',101,bH,2]);
    if(document.getElementById('carac-tem-alisar')&&document.getElementById('carac-tem-alisar').checked) r.push(['ALISAR ALT',225,A+150,5],['ALISAR LAR',225,L+300,2]);
    if(mod==='02'){
      var _qV02ap=parseInt((document.getElementById('plan-friso-v-qty')||{value:1}).value)||1;
      if(_qV02ap<1)_qV02ap=1;
      r.push(['FRISO VERT',100,G4,2*_qV02ap],['TAMPA FRISO',39,G4,2*_qV02ap]);
    }
    if(mod==='08'){
      var _ripTotal=($('carac-ripado-total')||{value:'NAO'}).value==='SIM';
      var _rip2L=($('carac-ripado-2lados')||{value:'SIM'}).value==='SIM';
      var _nRipas=_ripTotal?Math.max(1,Math.ceil(fW/98)):Math.max(1,Math.ceil((fW-HC*2-DC)/98));
      var _ripMult=(_rip2L?2:1)*((fol==2)?2:1);
      window._qtdRipasTotal=_nRipas*_ripMult;
      r.push(['RIPAS',98,G4,_nRipas*_ripMult]);
    }
  }
  /* MODELO 22 — cava larga (DC+360), altura=G4 (PA ALTURA), sem TAMPA CAVA, TAMPA MAIOR -68 */
  if(mod==='22'){
    var DC=parseInt($('aprov-dim-cava').value)||150,HC=parseInt($('aprov-h-cava').value)||210;
    var cavaDeduc=DC+HC+2;
    r.push(['CAVA',DC+360,G4,(fol==2)?4:2]);
    if(fol==1)r.push(['TAMPA MAIOR',fW+40-cavaDeduc-68,G4,2]);
    else{var G2c=Math.round((fW+40-cavaDeduc-68)/2);r.push(['TAMPA F1',G2c+19,G4,1],['TAMPA F2',G2c,G4,2],['TAMPA F3',G2c-19,G4,1]);}
    r.push(['TAMPA BOR CAVA',HC+39,G4,(fol==2)?4:2]);
    r.push(['ACAB LAT 1',88.5,G4,nL],['ACAB LAT 2',90,G4,nL],['ACAB LAT Z',110,G4,nL]);
    r.push(['U PORTAL',221,L-20,1],['BAT 01',42,bH,2],['BAT 02Z',51,bH,2],['BAT 03',81,bH,2]);
    r.push(['TAP FURO',119,bH,3],['FIT ACAB ME',76.5,bH,2],['FIT ACAB MA',114.5,bH,2],['FIT ACAB FITA',101,bH,2]);
    if(document.getElementById('carac-tem-alisar')&&document.getElementById('carac-tem-alisar').checked) r.push(['ALISAR ALT',225,A+150,5],['ALISAR LAR',225,L+300,2]);
  }
  var res=[];
  for(var i=0;i<r.length;i++){var p=r[i];var w=Math.round(p[1]*2)/2,h=Math.round(p[2]*2)/2,q=p[3];
    if(w>0&&h>0&&q>0)res.push({label:p[0],w:w,h:h,qty:q,color:APROV_COLORS[i%APROV_COLORS.length]});}
  return res;
}

// ── FIXO PIECES — chapas do fixo conforme planilha de precificação ──
function aprovFixoPieces(Lporta,Aporta,Lfixo,Afixo,lados,mod){
  if(!Lfixo||!Afixo) return [];
  var is2L=(lados===2);
  var FGA=10,FGLA=20,PIV=28,TPIV=8,REF=20;
  var _sisF=($('prod-sistema')||{value:''}).value||'';
  var TUB=(_sisF.indexOf('PA007')>=0||(typeof _isInternacional==='function'&&_isInternacional()))?51:38;
  // Door reference values
  var G3=Math.round(Lporta-FGLA-171.5-171.5+90+128); // LAR CH FRONTAL 1FLH
  var G4=Math.round(Aporta-FGA-TUB-PIV+TPIV);          // ALT CH FRONTAL
  var bH=G4+116; // batente height

  // Cava params from form (models 01,02,08)
  var DC=parseInt(($('carac-largura-cava')||$('aprov-dim-cava')||{value:150}).value)||150;
  var HC=parseInt(($('carac-dist-borda-cava')||$('aprov-h-cava')||{value:210}).value)||210;

  // Door intermediate widths needed for fixo
  var CAVA_W=DC+116;          // PORTA_01 width = LAR_CAVA+23+23+35+35
  var L_CAVA_W=DC+90;         // PORTA_02 width = LAR_CAVA+100-10
  var TAMPA_MAIOR_W=Math.round((G3-HC-1-DC-1)+40); // PORTA_03 width
  var TAMPA_BORDA_W=HC+REF*2-2;                     // PORTA_04 width
  var M_TAMPA=TAMPA_MAIOR_W-REF*2;  // M9 = net width TAMPA_MAIOR
  var M_BORDA=TAMPA_BORDA_W-REF*2;  // M10 = net width TAMPA_BORDA
  var TAMPA_FINAL=G3;               // C19
  var TAMPA_REF=G3-1+REF+REF;       // C20

  // Fixo heights
  var hCavaFix=Afixo-TUB-TUB;          // FIXO_01 H: altura fixo - 2×tub
  var hTampaFix=Afixo+TUB+REF;         // FIXO_03-06 H: tampa maior/borda
  var hFitFix=Afixo+100;               // FIXO_07-08 H: fit acabamento
  var hFitLar=Lporta+100;              // FIXO_09 H: fit largura fita

  var r=[];
  var q1=is2L?2:1, q2=is2L?4:2;

  // Categorizar modelo: CAVA ou LISA
  var _isCavaMod=['01','02','03','04','05','06','07','08','09','19','22','24'].indexOf(mod)>=0;
  var _isLisaMod=['10','11','12','13','14','15','16','17','18','20','21','23acm','23alu'].indexOf(mod)>=0;

  if(_isCavaMod && mod!=='22'){
    // Peças com CAVA — TAMPAS primeiro (igual à porta)
    r.push(['FX TAMPA MAIOR',M_TAMPA+44+REF,hTampaFix,1]);
    if(is2L) r.push(['FX TAMPA MAIOR 2L',M_TAMPA+82+REF,hTampaFix,1]);
    r.push(['FX TAMPA BOR CAVA',M_BORDA+44+REF,hTampaFix,1]);
    if(is2L) r.push(['FX TAMPA BOR CAVA 2L',M_BORDA+82+REF,hTampaFix,1]);
    r.push(['FX CAVA SUP',CAVA_W,hCavaFix,q1]);
    r.push(['FX L CAVA',L_CAVA_W,210,q2]);
    r.push(['FX FIT ME',76.5,hFitFix,q1]);
    r.push(['FX FIT MA',114.5,hFitFix,q1]);
    r.push(['FX FIT FITA',101,hFitLar,q1]);
    r.push(['FX BAT 01',47,bH,q1]);
    r.push(['FX BAT 03',70,bH,q1]);
    // Modelo 02: friso no fixo
    if(mod==='02'){
      var larFriso=parseInt((document.getElementById('carac-friso-larg')||{value:50}).value)||50;
      var _qV02fx=parseInt((document.getElementById('plan-friso-v-qty')||{value:1}).value)||1;
      if(_qV02fx<1)_qV02fx=1;
      r.push(['FX FRISO',larFriso+100,hTampaFix,q1*_qV02fx]);
    }
    // Modelo 08: ripado no fixo (peças estreitas repetidas)
    if(mod==='08'){
      var _fxRipTotal=($('carac-ripado-total')||{value:'NAO'}).value==='SIM';
      var _fxRip2L=($('carac-ripado-2lados')||{value:'SIM'}).value==='SIM';
      var nRipas=_fxRipTotal?Math.max(1,Math.round(Lfixo/98)):Math.max(1,Math.round((Lfixo-330)/98));
      var _fxRipMult=(_fxRip2L?2:1)*q1;
      r.push(['FX RIPAS',98,hCavaFix,nRipas*_fxRipMult]);
    }
  }

  if(mod==='22'){
    // Modelo 22 — CAVA larga (DC+360), sem TAMPA CAVA/L CAVA, TAMPA MAIOR -68
    var M_TAMPA22=M_TAMPA-68;
    r.push(['FX TAMPA MAIOR',M_TAMPA22+44+REF,hTampaFix,1]);
    if(is2L) r.push(['FX TAMPA MAIOR 2L',M_TAMPA22+82+REF,hTampaFix,1]);
    r.push(['FX TAMPA BOR CAVA',M_BORDA+44+REF,hTampaFix,1]);
    if(is2L) r.push(['FX TAMPA BOR CAVA 2L',M_BORDA+82+REF,hTampaFix,1]);
    r.push(['FX CAVA SUP',DC+360,hCavaFix,q1]);
    r.push(['FX FIT ME',76.5,hFitFix,q1]);
    r.push(['FX FIT MA',114.5,hFitFix,q1]);
    r.push(['FX FIT FITA',101,hFitLar,q1]);
    r.push(['FX BAT 01',47,bH,q1]);
    r.push(['FX BAT 03',70,bH,q1]);
  }

  if(_isLisaMod){
    // Lisa — sem cava, tampa cobre toda largura
    // Door TAMPA_MAIOR for Lisa: G3+40 (approx)
    var lisaTW=G3+40;
    var M_lisaT=lisaTW-REF*2;
    r.push(['FX TAMPA MAIOR',M_lisaT+44+82-1,hTampaFix,1]);
    if(is2L) r.push(['FX TAMPA MAIOR 2L',M_lisaT+44+44-1,hTampaFix,1]);
    r.push(['FX FIT ME',76.5,hFitFix,q1]);
    r.push(['FX FIT MA',114.5,hFitFix,q1]);
    r.push(['FX FIT FITA',101,hFitLar,q1]);
    r.push(['FX BAT 01',47,bH,q1]);
    r.push(['FX BAT 03',70,bH,q1]);
    // Modelo 11: friso vertical
    if(mod==='11'){
      var larFriso11=parseInt((document.getElementById('carac-friso-larg')||{value:10}).value)||10;
      r.push(['FX FRISO',larFriso11+100,hTampaFix,q1]);
    }
    // Modelo 15: ripas
    if(mod==='15'){
      var _fxRipTotal15=($('carac-ripado-total')||{value:'NAO'}).value==='SIM';
      var _fxRip2L15=($('carac-ripado-2lados')||{value:'SIM'}).value==='SIM';
      var nRipas15=_fxRipTotal15?Math.max(1,Math.round(Lfixo/98)):Math.max(1,Math.round((Lfixo-180)/98));
      var _fxRipMult15=(_fxRip2L15?2:1)*q1;
      r.push(['FX RIPAS',98,hCavaFix||Afixo-TUB*2,nRipas15*_fxRipMult15]);
    }
  }

  // Montar resultado com cores
  var res=[];
  for(var i=0;i<r.length;i++){var p=r[i];var w=Math.round(p[1]*2)/2,h=Math.round(p[2]*2)/2,q=p[3];
    if(w>0&&h>0&&q>0)res.push({label:p[0],w:w,h:h,qty:q,color:APROV_COLORS[(i+12)%APROV_COLORS.length]});}
  return res;
}

function aprovMaxRects(pieces,SW,SH,kerf,rot,mg){
  var todo=[];
  for(var i=0;i<pieces.length;i++)for(var j=0;j<pieces[i].qty;j++){
    var p=pieces[i];
    // Rotação DESATIVADA — chapas ACM nunca devem ser rotacionadas
    todo.push({label:p.label,w:p.w,h:p.h,color:p.color,rotated:false});
  }
  // Agrupar peças iguais juntas (por label), depois por altura desc
  var PIECE_PRIORITY={'TAMPA MAIOR':1,'TAMPA BOR CAVA':1,'TAMPA CAVA':1,'CAVA':2,
    'ACAB LAT 1':3,'ACAB LAT 2':3,'ACAB LAT Z':3,'ALISAR ALT':4,'ALISAR LAR':4,
    'BAT 01':5,'BAT 02Z':5,'BAT 03':5,'TAP FURO':6,'FIT ACAB ME':6,'FIT ACAB MA':6,
    'FIT ACAB FITA':6,'U PORTAL':7,
    'FX TAMPA MAIOR':9,'FX TAMPA MAIOR 2L':9,'FX TAMPA BOR CAVA':9,'FX TAMPA BOR CAVA 2L':9,
    'FX CAVA SUP':10,'FX L CAVA':10,'FX FIT ME':11,'FX FIT MA':11,'FX FIT FITA':11,
    'FX BAT 01':12,'FX BAT 03':12,'FX FRISO':12,'FX RIPAS':13};
  function _prio(lbl){var p=PIECE_PRIORITY[lbl];return p||8;}
  todo.sort(function(a,b){
    var pa=_prio(a.label),pb=_prio(b.label);
    if(pa!==pb) return pa-pb;           // prioridade primeiro
    if(a.label!==b.label) return a.label<b.label?-1:1; // agrupa iguais
    return b.h-a.h||b.w-a.w;           // depois por tamanho
  });
  var placed=[],failed=[];
  var usableW=SW-2*mg,usableH=SH-2*mg;
  var sheets=[{strips:[],nextY:0}];

  for(var k=0;k<todo.length;k++){
    var p=todo[k],done=false;
    // 1. Encaixar em faixa existente com menor desperdício de altura
    for(var si=0;si<sheets.length&&!done;si++){
      var bestStrip=null,bestWaste=Infinity;
      for(var ri=0;ri<sheets[si].strips.length;ri++){
        var s=sheets[si].strips[ri];
        if(p.h<=s.h&&p.w<=usableW-s.usedW){
          var waste=s.h-p.h;
          if(waste<bestWaste){bestWaste=waste;bestStrip=ri;}
        }
      }
      if(bestStrip!==null){
        var s=sheets[si].strips[bestStrip];
        placed.push({sheet:si,x:mg+s.usedW,y:mg+s.y,w:p.w,h:p.h,label:p.label,color:p.color,rotated:p.rotated});
        s.usedW+=p.w+kerf;done=true;
      }
    }
    // 2. Nova faixa em chapa existente
    if(!done){
      for(var si=0;si<sheets.length&&!done;si++){
        if(p.h<=usableH-sheets[si].nextY&&p.w<=usableW){
          var s={y:sheets[si].nextY,h:p.h,usedW:p.w+kerf};
          sheets[si].strips.push(s);sheets[si].nextY+=p.h+kerf;
          placed.push({sheet:si,x:mg,y:mg+s.y,w:p.w,h:p.h,label:p.label,color:p.color,rotated:p.rotated});
          done=true;
        }
      }
    }
    // 3. Nova chapa — só criar se a peça couber
    if(!done){
      if(p.h<=usableH&&p.w<=usableW){
        var si2=sheets.length;sheets.push({strips:[],nextY:0});
        var sn={y:0,h:p.h,usedW:p.w+kerf};
        sheets[si2].strips.push(sn);sheets[si2].nextY=p.h+kerf;
        placed.push({sheet:si2,x:mg,y:mg,w:p.w,h:p.h,label:p.label,color:p.color,rotated:p.rotated});
      } else failed.push(p);
    }
  }
  // Remover chapas vazias e remapear índices
  var sheetRemap={},activeCount=0;
  for(var i=0;i<sheets.length;i++){
    if(placed.some(function(pl){return pl.sheet===i;})){sheetRemap[i]=activeCount++;} 
  }
  placed.forEach(function(pl){if(sheetRemap[pl.sheet]!==undefined)pl.sheet=sheetRemap[pl.sheet];});
  var numS=activeCount;
  var stats=[];
  for(var i=0;i<numS;i++){var ps=placed.filter(function(p){return p.sheet===i;});
    var used=ps.reduce(function(s,p){return s+p.w*p.h;},0);
    stats.push({count:ps.length,used:used,total:SW*SH,pct:used/(SW*SH)*100});}
  /* ── COMPACTAÇÃO: mover peças de chapas sub-utilizadas para chapas com espaço ── */
  var COMPACT_THRESHOLD=25; // chapas com < 25% → tentar realocar
  var _changed=true, _maxIter=10;
  while(_changed && _maxIter-->0){
    _changed=false;
    // Recalcular stats
    var _cstats=[];
    for(var cs=0;cs<numS;cs++){
      var cps=placed.filter(function(p){return p.sheet===cs;});
      var cused=cps.reduce(function(s,p){return s+p.w*p.h;},0);
      _cstats.push({pct:cused/(SW*SH)*100,count:cps.length});
    }
    // Encontrar chapa menos utilizada
    var _worstSheet=-1,_worstPct=100;
    for(var ws=0;ws<numS;ws++){
      if(_cstats[ws].count>0&&_cstats[ws].pct<COMPACT_THRESHOLD&&_cstats[ws].pct<_worstPct){
        _worstPct=_cstats[ws].pct;_worstSheet=ws;
      }
    }
    if(_worstSheet<0)break;
    // Extrair peças desta chapa
    var _movePieces=placed.filter(function(p){return p.sheet===_worstSheet;});
    var _otherPieces=placed.filter(function(p){return p.sheet!==_worstSheet;});
    // Reconstruir strips das outras chapas
    var _otherSheets={};
    _otherPieces.forEach(function(p){
      if(!_otherSheets[p.sheet])_otherSheets[p.sheet]={strips:[],nextY:0,maxY:0};
    });
    // Rebuild strips from placed pieces (approximate)
    for(var os in _otherSheets){
      var osInt=parseInt(os);
      var osPieces=_otherPieces.filter(function(p){return p.sheet===osInt;});
      // Group by Y position to reconstruct strips
      var yGroups={};
      osPieces.forEach(function(p){
        var yKey=Math.round(p.y);
        if(!yGroups[yKey])yGroups[yKey]={y:p.y-mg,h:0,usedW:0};
        yGroups[yKey].h=Math.max(yGroups[yKey].h,p.h);
        yGroups[yKey].usedW=Math.max(yGroups[yKey].usedW,p.x-mg+p.w+kerf);
      });
      for(var yk in yGroups)_otherSheets[osInt].strips.push(yGroups[yk]);
      _otherSheets[osInt].strips.sort(function(a,b){return a.y-b.y;});
      var lastS=_otherSheets[osInt].strips[_otherSheets[osInt].strips.length-1];
      if(lastS)_otherSheets[osInt].nextY=lastS.y+lastS.h+kerf;
    }
    // Tentar realocar cada peça
    var _allMoved=true;
    for(var mp=0;mp<_movePieces.length;mp++){
      var p=_movePieces[mp],done2=false;
      // Try existing strips on other sheets
      for(var os2 in _otherSheets){
        if(done2)break;
        var osInt2=parseInt(os2);
        for(var sr=0;sr<_otherSheets[osInt2].strips.length;sr++){
          var s=_otherSheets[osInt2].strips[sr];
          if(p.h<=s.h&&p.w<=usableW-s.usedW){
            p.sheet=osInt2;p.x=mg+s.usedW;p.y=mg+s.y;
            s.usedW+=p.w+kerf;done2=true;break;
          }
        }
        // Try new strip
        if(!done2&&p.h<=usableH-_otherSheets[osInt2].nextY&&p.w<=usableW){
          var ns={y:_otherSheets[osInt2].nextY,h:p.h,usedW:p.w+kerf};
          _otherSheets[osInt2].strips.push(ns);
          _otherSheets[osInt2].nextY+=p.h+kerf;
          p.sheet=osInt2;p.x=mg;p.y=mg+ns.y;done2=true;
        }
      }
      if(!done2)_allMoved=false;
    }
    if(_allMoved){
      // Remove worst sheet, remap indices
      placed=placed.filter(function(p){return p.sheet!==_worstSheet;});
      placed.forEach(function(p){if(p.sheet>_worstSheet)p.sheet--;});
      numS--;_changed=true;
    }
  }
  /* ── FIM COMPACTAÇÃO ── */

  // Recalcular stats finais
  stats=[];
  for(var i=0;i<numS;i++){var ps=placed.filter(function(p){return p.sheet===i;});
    var used=ps.reduce(function(s,p){return s+p.w*p.h;},0);
    stats.push({count:ps.length,used:used,total:SW*SH,pct:used/(SW*SH)*100});}
  return{numSheets:numS,placed:placed,stats:stats,failed:failed};
}

function aprovDraw(si){
  var cv=document.getElementById('aprov-canvas'),ctx=cv.getContext('2d');
  var SW=APROV_SD.w,SH=APROV_SD.h,MG=APROV_SD.mg,PAD=20;
  var sc=Math.min((860-PAD*2)/SW,(620-PAD*2)/SH);
  cv.width=Math.round(SW*sc+PAD*2);cv.height=Math.round(SH*sc+PAD*2);
  ctx.fillStyle='#9a9691';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.fillStyle='#f8f8f6';ctx.fillRect(PAD,PAD,SW*sc,SH*sc);


  var ps=APROV_RES.placed.filter(function(p){return p.sheet===si;});
  for(var i=0;i<ps.length;i++){var p=ps[i];
    var px=PAD+p.x*sc,py=PAD+(SH-p.y-p.h)*sc,pw=p.w*sc,ph=p.h*sc;
    ctx.globalAlpha=0.82;ctx.fillStyle=p.color;ctx.fillRect(px,py,pw,ph);
    ctx.globalAlpha=1;ctx.strokeStyle=p.color;ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,pw-1,ph-1);
    if(pw>22&&ph>12){ctx.save();ctx.beginPath();ctx.rect(px+1,py+1,pw-2,ph-2);ctx.clip();
      var fs=Math.max(7.5,Math.min(10.5,Math.min(pw/(p.label.length*.65),ph*.22)));
      ctx.font='600 '+fs+'px Montserrat,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(0,0,0,.72)';
      ctx.fillText(p.label,px+pw/2,py+ph/2-(ph>fs*3?fs*.35:0));
      if(ph>fs*3){ctx.font=Math.max(7,fs-.5)+'px Montserrat,Arial';ctx.fillStyle='rgba(0,0,0,.45)';
        ctx.fillText(p.w+'x'+p.h+(p.rotated?' R':''),px+pw/2,py+ph/2+fs*.9);}ctx.restore();}}
  ctx.fillStyle='rgba(0,49,68,0.5)';ctx.font='bold 9px Montserrat,Arial';
  ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText('(0,0)',PAD+2,PAD+SH*sc-2);
  ctx.strokeStyle='#555';ctx.lineWidth=1.5;ctx.strokeRect(PAD,PAD,SW*sc,SH*sc);
  ctx.fillStyle='#333';ctx.font='bold 11px Montserrat,Arial';
  ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText('Chapa '+(si+1)+'  -  '+SW+'x'+SH+'mm  (folga '+MG+'mm)',PAD,4);
  ctx.textAlign='right';ctx.textBaseline='bottom';
  ctx.fillText(ps.length+' peças  -  '+APROV_RES.stats[si].pct.toFixed(1)+'% aproveitamento',PAD+SW*sc,cv.height-2);
  var st=APROV_RES.stats[si];
  document.getElementById('m-cinfo').innerHTML='<span>Peças: <strong>'+st.count+'</strong></span>'+
    '<span>Usada: <strong>'+(st.used/1e6).toFixed(3)+' m²</strong></span>'+
    '<span>Aproveitamento: <strong style="color:var(--orange)">'+st.pct.toFixed(1)+'%</strong></span>'+
    '<span>Sobra: <strong>'+(100-st.pct).toFixed(1)+'%</strong></span>';
}

function aprovBuildTabs(){
  var el=document.getElementById('modal-tabs');el.innerHTML='';
  for(var i=0;i<APROV_RES.numSheets;i++){
    var b=document.createElement('button');b.className='modal-tab'+(i===APROV_CSI?' on':'');
    b.innerHTML='Chapa '+(i+1)+' <span style="font-size:10px;opacity:.7">'+APROV_RES.stats[i].pct.toFixed(0)+'%</span>';
    (function(idx){b.onclick=function(){APROV_CSI=idx;aprovBuildTabs();aprovDraw(idx);};})(i);
    el.appendChild(b);}
}
function aprovBuildLegend(){
  var seen={},items=[],html='';
  for(var i=0;i<APROV_RES.placed.length;i++){var p=APROV_RES.placed[i];if(!seen[p.label]){seen[p.label]=p.color;items.push(p);}}
  for(var i=0;i<items.length;i++)html+='<span class="m-li"><span class="m-ls" style="background:'+items[i].color+'"></span>'+items[i].label+'</span>';
  document.getElementById('m-legend').innerHTML=html;
}

function aprovToggleCava(){
  var mod=$('aprov-model').value, isCava=(mod==='01'||mod==='02'||mod==='08'||mod==='22');
  var mc=document.getElementById('modal-cava');
  if(mc) mc.className='cava-vars'+(isCava?' show':'');
}

function _onAprovChapaChange(){
  var sel=document.getElementById('aprov-chapa');
  var cust=document.getElementById('aprov-chapa-custom');
  if(cust)cust.style.display=sel.value==='custom'?'flex':'none';
}
function _getAprovChapaSize(){
  var sel=document.getElementById('aprov-chapa');
  if(sel.value==='custom'){
    var l=parseInt((document.getElementById('aprov-chapa-larg')||{value:1500}).value)||1500;
    var a=parseInt((document.getElementById('aprov-chapa-alt')||{value:5000}).value)||5000;
    return {w:l,h:a};
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

function aprovCalc(){
  var L=n('largura'),A=n('altura');
  var fol=parseInt($('aprov-folhas').value)||1;
  var mod=$('aprov-model').value;
  var kerf=parseInt($('aprov-kerf').value)||4;
  var mg=parseInt($('aprov-mg').value)||0;
  var rot=$('aprov-rot').value==='1';
  var _acs=_getAprovChapaSize();
  var SW=_acs.w,SH=_acs.h;
  APROV_SD={w:SW,h:SH,mg:mg};
  var pieces=aprovPieces(L,A,fol,mod);
  // Adicionar peças dos fixos
  var tfEl2=document.getElementById('tem-fixo');
  if(tfEl2&&tfEl2.checked){
    document.querySelectorAll('.fixo-blk').forEach(function(el){
      var Lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
      var Af=parseFloat((el.querySelector('.fixo-alt')||{value:0}).value)||0;
      var ld=parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
      var qf=parseInt((el.querySelector('.fixo-qty')||{value:1}).value)||1;
      if(Lf>0&&Af>0){
        var _tipo=(el.querySelector(".fixo-tipo")||{value:"superior"}).value;
        var fp=_tipo==="superior"?aprovFixoPieces(L,A,Lf,Af,ld,mod):[{label:"FX LATERAL",w:Lf+100,h:Af+100,qty:ld,color:APROV_COLORS[15]}];
        if(qf>1) fp.forEach(function(p){p.qty=p.qty*qf;});
        pieces=pieces.concat(fp);
      }
    });
  }
  // Multiplicar peças por quantidade de portas antes do nesting
  var _qPA=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
  if(_qPA>1){ pieces.forEach(function(p){ p.qty=p.qty*_qPA; }); }
  APROV_RES=aprovMaxRects(pieces,SW,SH,kerf,rot,mg);
  // Reordenar chapas: maior aproveitamento primeiro
  if(APROV_RES.numSheets>1){
    // Criar mapeamento de ordem por pct desc
    var _sheetOrder=[];
    for(var _si=0;_si<APROV_RES.numSheets;_si++) _sheetOrder.push(_si);
    _sheetOrder.sort(function(a,b){return APROV_RES.stats[b].pct-APROV_RES.stats[a].pct;});
    // Remapear índices das peças
    var _remap={};
    _sheetOrder.forEach(function(oldIdx,newIdx){_remap[oldIdx]=newIdx;});
    APROV_RES.placed.forEach(function(p){p.sheet=_remap[p.sheet];});
    // Reordenar stats
    var _newStats=_sheetOrder.map(function(i){return APROV_RES.stats[i];});
    APROV_RES.stats=_newStats;
  }
  APROV_CSI=0;
  var totPA=pieces.reduce(function(s,p){return s+p.w*p.h*p.qty;},0);
  var totSA=APROV_RES.numSheets*SW*SH;
  var util=(totPA/totSA*100).toFixed(1);
  var usable=(SW-2*mg)*(SH-2*mg);
  var minS=Math.ceil(totPA/Math.max(1,usable));
  var eff=(minS/APROV_RES.numSheets*100).toFixed(0);
  document.getElementById('mst-n').textContent=APROV_RES.numSheets;
  document.getElementById('mst-u').textContent=util+'%';
  document.getElementById('mst-w').textContent=(100-parseFloat(util)).toFixed(1)+'%';
  document.getElementById('mst-e').textContent=eff+'%';
  document.getElementById('modal-sg').style.display='';
  var mw=document.getElementById('modal-warn');
  if(APROV_RES.failed.length>0){
    var tags='';for(var i=0;i<APROV_RES.failed.length;i++)tags+='<b>'+APROV_RES.failed[i].label+'</b> ('+APROV_RES.failed[i].w+'x'+APROV_RES.failed[i].h+'mm) ';
    mw.innerHTML='<strong>Atenção: '+APROV_RES.failed.length+' peça(s) não couberam!</strong> Escolha uma chapa maior. '+tags;
    mw.style.display='block';
  } else mw.style.display='none';
  document.getElementById('modal-aprov-title').textContent=
    'Plano de Corte — '+APROV_RES.numSheets+' chapa(s) '+SW+'×'+SH+'mm · '+util+'% aproveitamento';
  aprovBuildTabs();aprovBuildLegend();aprovDraw(0);
  return APROV_RES.numSheets;
}

function aprovRun(){
  // sync dims display
  var L=n('largura'),A=n('altura');
  $('aprov-dims').textContent=Math.round(L)+' × '+Math.round(A)+' mm';
  var fol=parseInt($('aprov-folhas').value)||1;
  var mod=$('aprov-model').value;
  var _acs=_getAprovChapaSize();
  var SW=_acs.w,SH=_acs.h;
  var pieces=aprovPieces(L,A,fol,mod);
  // Adicionar peças dos fixos
  var _tfR=document.getElementById('tem-fixo');
  if(_tfR&&_tfR.checked){
    document.querySelectorAll('.fixo-blk').forEach(function(el){
      var Lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
      var Af=parseFloat((el.querySelector('.fixo-alt')||{value:0}).value)||0;
      var ld=parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
      var qf=parseInt((el.querySelector('.fixo-qty')||{value:1}).value)||1;
      if(Lf>0&&Af>0){
        var _tipo=(el.querySelector(".fixo-tipo")||{value:"superior"}).value;
        var fp=_tipo==="superior"?aprovFixoPieces(L,A,Lf,Af,ld,mod):[{label:"FX LATERAL",w:Lf+100,h:Af+100,qty:ld,color:APROV_COLORS[15]}];
        if(qf>1) fp.forEach(function(p){p.qty=p.qty*qf;});
        pieces=pieces.concat(fp);
      }
    });
  }
  var totPA=pieces.reduce(function(s,p){return s+p.w*p.h*p.qty;},0);
  var usable=SW*SH;
  var nChapas=Math.ceil(totPA/usable)+1; // conservative before detailed calc
  // quick calc
  APROV_SD={w:SW,h:SH,mg:10};
  var kerf=4,rot=true,mg=10;
  var _qPAR=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
  if(_qPAR>1){ pieces.forEach(function(p){ p.qty=p.qty*_qPAR; }); }
  var res=aprovMaxRects(pieces,SW,SH,kerf,rot,mg);
  APROV_RES=res;APROV_CSI=0;
  APROV_SD={w:SW,h:SH,mg:mg};
  var totSA=res.numSheets*SW*SH;
  var util=(totPA/totSA*100).toFixed(1);
  // update compact result
  var summary=res.numSheets+' chapa(s) '+SW+'×'+SH+'mm  ·  '+util+'% aproveit.';
  if(res.failed.length>0) summary+='  ·  ⚠ '+res.failed.length+' peça(s) não couberam';
  document.getElementById('aprov-summary').textContent=summary;
  var chips='<span class="aprov-chip or">'+res.numSheets+' chapa(s)</span>'+
    '<span class="aprov-chip '+(parseFloat(util)>80?'ok':'warn')+'">'+util+'% aproveit.</span>';
  if(res.failed.length>0) chips+='<span class="aprov-chip bad">'+res.failed.length+' peça(s) falharam</span>';
  document.getElementById('aprov-chips').innerHTML=chips;
  document.getElementById('aprov-result').className='aprov-result show';
}

function aprovOpenModal(){
  var mod=document.getElementById('modal-aprov');
  mod.className='modal-aprov open';
  aprovToggleCava();
  if(APROV_RES){aprovBuildTabs();aprovBuildLegend();aprovDraw(0);
    document.getElementById('modal-sg').style.display='';}
  mod.addEventListener('click',function(e){if(e.target===mod)aprovCloseModal();},{once:true});
}
function aprovCloseModal(){document.getElementById('modal-aprov').className='modal-aprov';}

/* ══ SWITCH TABS ═════════════════════════════════════════ */

/* ══ PRINT CSS for OS ══════════════════════════════════════════════════════ */
/* Injected via JS to avoid conflicts with existing print CSS */

/* ══ END MODULE: APROVEITAMENTO_CHAPAS ══ */
