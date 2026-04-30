/**
 * 17-os_acessorios.js
 * Module: OS_ACESSORIOS
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: OS_ACESSORIOS ══ */

// ══════════════════════════════════════════════════════════════════
// FIXOS — cálculo completo de perfis (cuts), fita/dowsil e chapas
// ══════════════════════════════════════════════════════════════════
function _calcFixosCompleto(sis, getPreco, barraMM){
  var result = {acessRows:[], cuts:[], m2ChapaFixos:0};
  var tfEl = document.getElementById('tem-fixo');
  if(!tfEl || !tfEl.checked) return result;

  barraMM = barraMM || 6000;

  // Código do perfil e kg/m por sistema
  var COD_PERF = sis==='PA006' ? 'PA-76X38X1.98' : 'PA-101X51X2';
  var DIM_PERF = sis==='PA006' ? '76×38mm'       : '101×51mm';
  // Buscar kg/m direto do PERFIS_DB (fonte autoritativa)
  var KG_M = 0;
  var _baseCod = COD_PERF.replace(/-[678]M$/,'');
  for(var i=0;i<PERFIS_DB.length;i++){
    if(PERFIS_DB[i].c===COD_PERF||PERFIS_DB[i].c===_baseCod){KG_M=PERFIS_DB[i].kg||0;break;}
  }

  // Totais fita/dowsil
  var totFD12=0, totFD19=0, totDow=0;

  // Cortes acumulados por fixo
  var allCuts = []; // {desc, subcat, compMM, qty, lh}

  document.querySelectorAll('.fixo-blk').forEach(function(el, idx){
    var L = parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
    var A = parseFloat((el.querySelector('.fixo-alt') ||{value:0}).value)||0;
    var lados = parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
    var temEstr = (el.querySelector('.fixo-estr')||{value:'nao'}).value==='sim';
    if(!L || !A) return;

    var fn = 'F'+(idx+1); // label do fixo
    var Lp=parseFloat((document.getElementById('largura')||{value:0}).value)||0;
    var Ap=parseFloat((document.getElementById('altura')||{value:0}).value)||0;
    var _modF=($('aprov-model')||{value:($('carac-modelo')||{value:'01'}).value}).value||'01';
    var qf=parseInt((el.querySelector('.fixo-qty')||{value:1}).value)||1;

    // ── CHAPA — usar peças reais do fixo (só superior) ──────────────
    var _tipoF=(el.querySelector('.fixo-tipo')||{value:'superior'}).value;
    var _fxPcs=_tipoF==='superior'?aprovFixoPieces(Lp,Ap,L,A,lados,_modF):[{label:'FX LATERAL',w:L+100,h:A+100,qty:lados,color:'#bab0ac'}];
    var m2Pecas=0;
    _fxPcs.forEach(function(p){m2Pecas+=(p.w/1000)*(p.h/1000)*p.qty;});
    result.m2ChapaFixos += m2Pecas*qf;

    // ── FITA / DOWSIL — SÓ para fixo superior (lateral não tem acessórios) ──
    if(_tipoF==='superior'){
      _fxPcs.forEach(function(p){
        if(p.label.indexOf('TAMPA')>=0||p.label.indexOf('CAVA')>=0||p.label.indexOf('FRISO')>=0||p.label.indexOf('RIPA')>=0){
          var perimP=2*(p.w+p.h)*p.qty*qf;
          totFD12+=perimP;
          totFD19+=perimP;
          totDow+=perimP;
        }
      });
    }

    if(!temEstr) return;

    // ── Descontos ────────────────────────────────────────────────────────────
    // Largura: folga 10mm de cada lado → L_ext = L - 20
    // Encaixe perfis: PA006=38.1mm, PA007=50.8mm → desconto = 2×tubo
    // Perfil Altura / Trav Vertical: descontam topo+base (DESC)
    // Trav Horizontal: vai por dentro dos verticais → desconta DESC
    var FOLGA = 20; // 10mm cada lado
    var TUBO  = sis==='PA006' ? 38.1 : 50.8;
    var DESC  = Math.round(2 * TUBO); // 76mm (PA006) ou 102mm (PA007)

    var L_ext  = Math.round(L - FOLGA);     // largura com folga (frame externo)
    var A_perf = Math.round(A - DESC);      // Perf Altura e Trav Vert (por dentro topo/base)
    var L_trav = Math.round(L_ext - DESC);  // Trav Horiz (por dentro verticais + folga)

    // Verificar se modelo tem cava → +2 travessas verticais extras
    var _modElFx = document.getElementById('carac-modelo');
    var _modNomeFx = _modElFx ? (_modElFx.options[_modElFx.selectedIndex]||{text:''}).text.toLowerCase() : '';
    var temCavaFx = _modNomeFx.indexOf('cava') >= 0;

    // ── PERFIL ALTURA (2 pçs — por dentro topo+base) ─────────────────────────
    allCuts.push({desc:'PERF ALTURA — '+fn+' ('+A+'-'+DESC+')', subcat:'PERFIL ALTURA', compMM:A_perf, qty:2, lh:'90/90 A', obs:fn});

    // ── PERFIL LARGURA (2 pçs — frame externo com folga) ─────────────────────
    allCuts.push({desc:'PERF LARGURA — '+fn+' ('+L+'-'+FOLGA+')', subcat:'PERFIL LARGURA', compMM:L_ext, qty:2, lh:'90/90 L', obs:fn});

    // ── TRAVESSAS HORIZONTAIS — qty=ceil(A/1000), comp=L_trav ────────────────
    var qtdTravH = Math.ceil(A / 1000);
    if(qtdTravH > 0){
      allCuts.push({desc:'TRAV HORIZ ('+qtdTravH+'×) — '+fn+' ('+L_ext+'-'+DESC+')', subcat:'TRAVESSA HORIZONTAL', compMM:L_trav, qty:qtdTravH, lh:'90/90 L', obs:fn});
      totFD12 += L_trav * 4 * qtdTravH;
      totFD19 += L_trav * 4 * qtdTravH;
      totDow  += L_trav * 4 * qtdTravH;
    }

    // ── TRAVESSAS VERTICAIS — qty=ceil(L/800)-1 (+2 se cava), comp=A_perf ────
    var qtdTravV = Math.max(0, Math.ceil(L_ext / 800) - 1);
    if(temCavaFx) qtdTravV += 2; // modelo cava → +2 travessas verticais extras
    if(qtdTravV > 0){
      allCuts.push({desc:'TRAV VERT ('+qtdTravV+'×'+(temCavaFx?' +cava':'')+') — '+fn+' ('+A+'-'+DESC+')', subcat:'TRAVESSA VERTICAL', compMM:A_perf, qty:qtdTravV, lh:'90/90 A', obs:fn});
      totFD12 += A_perf * 4 * qtdTravV;
      totFD19 += A_perf * 4 * qtdTravV;
      totDow  += A_perf * 4 * qtdTravV;
    }

    // ── CAVA: Tubo 38×38 (2 pçs) e Cantoneira 30×30 (4 pçs) ─────────────────
    if(temCavaFx){
      var TUB_CA_FX  = Math.round(A_perf - 20);
      var CANT_CA_FX = A_perf;
      allCuts.push({code:'PA-38X38X1.58',      desc:'TUB CAVA — '+fn,  subcat:'PERFIL ALTURA', compMM:TUB_CA_FX,  qty:2, lh:'90/90 A', obs:fn+' BRUTO',     pintado:false});
      allCuts.push({code:'PA-CANT-30X30X2.0', desc:'CANT CAVA — '+fn, subcat:'PERFIL ALTURA', compMM:CANT_CA_FX, qty:4, lh:'90/90 A', obs:fn+' BNF-TECNO', pintado:true});
    }
  });

  // ── MONTAR cuts[] no formato d.cuts ─────────────────────────────
  allCuts.forEach(function(c){
    // Cada item pode ter código próprio (tubo/cant cava) ou usa COD_PERF
    var cutCode = c.code || COD_PERF;
    // Buscar kg/m do código específico em PERFIS_DB
    var cutKg = KG_M;
    if(c.code){
      var _bc2=c.code.replace(/-[678]M$/,'');
      for(var _pk=0;_pk<PERFIS_DB.length;_pk++){
        if(PERFIS_DB[_pk].c===c.code||PERFIS_DB[_pk].c===_bc2){cutKg=PERFIS_DB[_pk].kg||0;break;}
      }
    }
    result.cuts.push({
      code:    cutCode,
      desc:    c.desc,
      subcat:  c.subcat,
      compMM:  c.compMM,
      qty:     c.qty,
      kgM:     cutKg,
      pintado: c.pintado||false,
      secao:   'FIXO',
      barLenMM:barraMM,
      lh:      c.lh,
      obs:     c.obs
    });
  });

  // ── ACESSÓRIOS: fita/dowsil ──────────────────────────────────────
  if(totFD12 > 0){
    var rolosFD12 = Math.ceil(totFD12/1000/20);
    result.acessRows.push({qty:rolosFD12, code:'PA-FITDF 12X20X1.0',
      desc:'Fita DFix 12mm — fixos: '+(totFD12/1000).toFixed(1)+'m ÷ 20m = '+rolosFD12+' rolo(s)',
      preco:getPreco('PA-FITDF 12X20X1.0'), apl:'FAB', grp:'FITA DUPLA FACE', obs:'FD12 FIXO'});
  }
  if(totFD19 > 0){
    var rolosFD19 = Math.ceil(totFD19/1000/20);
    result.acessRows.push({qty:rolosFD19, code:'PA-FITDF 19X20X1.0',
      desc:'Fita DFix 19mm — fixos: '+(totFD19/1000).toFixed(1)+'m ÷ 20m = '+rolosFD19+' rolo(s)',
      preco:getPreco('PA-FITDF 19X20X1.0'), apl:'FAB', grp:'FITA DUPLA FACE', obs:'FD19 FIXO'});
  }
  if(totDow > 0){
    var tubosD = Math.ceil(totDow/1000/8);
    result.acessRows.push({qty:tubosD, code:'PA-DOWSIL 995 ESTR SH',
      desc:'Dowsil 995 — fixos: '+(totDow/1000).toFixed(1)+'m ÷ 8m = '+tubosD+' tubo(s)',
      preco:getPreco('PA-DOWSIL 995 ESTR SH'), apl:'FAB', grp:'SELANTES', obs:'DOWSIL FIXO'});
  }

  return result;
}
// ══════════════════════════════════════════════════════════════════
function _calcAcessoriosOS(d, nFolhas, sis){
  var savedP = {};
  try{ var _s=localStorage.getItem('projetta_comp_precos'); if(_s) savedP=JSON.parse(_s); }catch(e){}

  function getPreco(code){
    if(savedP[code]!==undefined) return savedP[code];
    for(var i=0;i<COMP_DB.length;i++){ if(COMP_DB[i].c===code) return COMP_DB[i].p||0; }
    return 0;
  }
  function maxPrecoByPrefix(prefix){
    var max=0, bestCode='', bestDesc='';
    for(var i=0;i<COMP_DB.length;i++){
      var item=COMP_DB[i];
      if(item.c.indexOf(prefix)===0){
        var p=savedP[item.c]!==undefined?savedP[item.c]:item.p||0;
        if(p>max){max=p;bestCode=item.c;bestDesc=item.d;}
      }
    }
    return {code:bestCode,desc:bestDesc,preco:max};
  }

  var rows=[];
  var H = parseFloat((document.getElementById('altura')||{value:0}).value)||0;
  var L = parseFloat((document.getElementById('largura')||{value:0}).value)||0;

  // ── FABRICAÇÃO — FECHADURA KESO (1 por porta, folha ativa) ──────────────────
  var fechTipo = (document.getElementById('carac-fech-mec')||{value:''}).value||'';
  var fechMap  = {'04 PINOS':'PA-KESO04P','08 PINOS':'PA-KESO08P','12 PINOS':'PA-KESO12','16 PINOS':'PA-KESO16','24 PINOS':'PA-KESO24P'};
  if(fechTipo && fechMap[fechTipo]){
    var fech = maxPrecoByPrefix(fechMap[fechTipo]);
    if(fech.code) rows.push({qty:1,code:fech.code,desc:'Fechadura '+fechTipo+' KESO',preco:fech.preco,apl:'FAB',grp:'FECHADURAS',obs:'FECHADURA'});
  }

  // ── FABRICAÇÃO — ROSETA KESO (2 por porta: frente+verso) ──────────────────
  if(fechTipo){
    var ros = maxPrecoByPrefix('PA-KESO ROS');
    if(ros.code) rows.push({qty:2,code:ros.code,desc:'Roseta KESO',preco:ros.preco,apl:'FAB',grp:'FECHADURAS',obs:'ROSETA'});
  }

  // ── FABRICAÇÃO — CILINDRO (1 por porta) ───────────────────────────────────
  if(fechTipo){
    var _marcaCil = (document.getElementById('carac-cilindro')||{value:''}).value||'KESO';
    var cil, cilDesc;
    if(_marcaCil === 'UDINESE'){
      var cilUdPrefix = sis==='PA006' ? 'PA-CIL UDINE 130 BL' : 'PA-CIL UDINE 150 BL';
      cil = {code:cilUdPrefix, desc:'', preco:getPreco(cilUdPrefix)};
      var cilUdAll = maxPrecoByPrefix(sis==='PA006' ? 'PA-CIL UDINE 130' : 'PA-CIL UDINE 150');
      if(cilUdAll.code) cil = cilUdAll;
      cilDesc = 'Cilindro UDINESE '+(sis==='PA006'?'130':'150')+'mm Preto';
    } else {
      var cilPrefix = sis==='PA006' ? 'PA-KESOCIL130 BT' : 'PA-KESOCIL150 BT';
      cil = maxPrecoByPrefix(cilPrefix);
      cilDesc = 'Cilindro KESO chave-botão '+(sis==='PA006'?'130':'150')+'mm';
    }
    if(cil.code) rows.push({qty:1,code:cil.code,desc:cilDesc,preco:cil.preco,apl:'FAB',grp:'FECHADURAS',obs:'CILINDRO'});
  }

  // ── FABRICAÇÃO — PUXADOR EXTERNO (1 por porta) ────────────────────────────
  // ★ Felipe 21/04: so adiciona o puxador SE:
  //   1. Tipo de puxador = EXTERNO (nao CAVA)
  //   2. Tamanho tem valor CONCRETO (1.0, 1.5, 1.8, 2.0, 2.5, 3.0...)
  //   3. Tamanho NAO e 'CLIENTE' (envio pelo cliente — cliente traz peca)
  //   4. Tamanho NAO e vazio
  //   Modelo 23 (Molduras) por padrao usa CLIENTE, entao nao deve ter
  //   puxador em acessorios.
  var puxTipo = (document.getElementById('carac-puxador')||{value:''}).value||'';
  var puxTam = (document.getElementById('carac-pux-tam')||{value:''}).value||'';
  var _puxTamUpper = String(puxTam).toUpperCase().trim();
  var _skipPuxador = !puxTam || _puxTamUpper === 'CLIENTE' || _puxTamUpper === 'ENVIO PELO CLIENTE';
  if(puxTipo === 'EXTERNO' && !_skipPuxador){
    var tamMap = {'1.0':'1MT','1.5':'1,5MT','2.0':'2MT','2.5':'3MT','3.0':'3MT','3.5':'4MT','4.0':'4MT','4.5':'5MT','5.0':'5MT'};
    var tamCode = tamMap[puxTam] || '';
    if(tamCode){
      var puxPrefix = 'PA-PUX-' + tamCode;
      var pux = maxPrecoByPrefix(puxPrefix);
      if(pux.code) rows.push({qty:1, code:pux.code, desc:'Puxador externo '+puxTam.replace('.',',')+' m', preco:pux.preco, apl:'FAB', grp:'PUXADORES', obs:'PUXADOR'});
    }
  } else if(puxTipo === 'EXTERNO' && _skipPuxador){
    console.log('[OS Acessorios] Puxador externo pulado (tamanho = "'+puxTam+'") — provavelmente envio pelo cliente');
  }

  // ── FABRICAÇÃO — BUCHA 06 + PARAFUSO PIVÔ (12 por folha) ──────────────────
  var qtyPivo = 12 * nFolhas;
  rows.push({qty:qtyPivo,code:'PA-CHA AA PHS 4,8X50',desc:'Parafuso chata AA PHS 4,8×50 DIN7982 A2 — pivô',preco:getPreco('PA-CHA AA PHS 4,8X50'),apl:'FAB',grp:'PARAFUSOS',obs:'PAR PIVO'});
  rows.push({qty:qtyPivo,code:'PA-BUCHA 06',desc:'Bucha Fisher Duopower 6 SC1500 — pivô',preco:getPreco('PA-BUCHA 06'),apl:'FAB',grp:'PARAFUSOS',obs:'BUC FISHER PIVO'});

  // ── FABRICAÇÃO — VEDA PORTA já renderizado separadamente (osa-veda-tbody)

  // ── FABRICAÇÃO — FITA ESCOVINHA Q-LON ─────────────────────────────────────
  // Fita escovinha: PA007=L×4, PA006=L×2 (metros) — unidade MT no cadastro
  var multFita = sis==='PA007' ? 4 : 2;
  var mFita = Math.ceil((L/1000)*multFita);
  if(L>0&&mFita>0) rows.push({qty:mFita,code:'PA-FITA VED 5X20',desc:'Fita veda frestas 5×20mm — L('+Math.round(L)+'mm)×'+multFita+' = '+mFita+'m',preco:getPreco('PA-FITA VED 5X20'),apl:'OBRA',grp:'VEDAÇÕES',obs:'ESCOVINHA'});

  // ── FABRICAÇÃO — VEDA PORTA ──────────────────────────────────────────────────
  if(L > 0){
    var _vedFolha;
    if(nFolhas === 2){
      // 2 folhas: LARGURA FOLHA (VEDA) = (L - 158) / 2 (ref DWG modelo 23)
      _vedFolha = (L - 158) / 2;
    } else {
      _vedFolha = L - 2.5 - 2.5 - 125;
    }
    var _vedSize = Math.max(720, (Math.ceil((_vedFolha - 620) / 100) * 100) + 620);
    // Catálogo vai até PA-VED3520 (maior tamanho disponível)
    if(_vedSize > 3520) _vedSize = 3520;
    var _vedCode = 'PA-VED' + String(_vedSize).padStart(4, '0');
    var _vedQty = nFolhas === 2 ? 4 : 2;
    rows.push({qty:_vedQty, code:_vedCode,
      desc:'Veda porta '+_vedSize+'mm — folha PA-PA: '+Math.round(_vedFolha)+'mm'+(nFolhas===2?' (por folha)':''),
      preco:getPreco(_vedCode), apl:'FAB', grp:'VEDAÇÕES', obs:'VEDA PORTA'});
  }

  // ── FABRICAÇÃO — Q-LON VEDAÇÃO ─────────────────────────────────────────────
  var mQL = Math.ceil((H/1000)*2);
  rows.push({qty:mQL,code:'PA-QL 48800',desc:'Q-LON 48800 Flipper Seal — H×2 = '+mQL+' mt',preco:getPreco('PA-QL 48800'),apl:'FAB',grp:'VEDAÇÕES',obs:'VEDAÇÃO'});
  rows.push({qty:mQL,code:'PA-QL 48700',desc:'Q-LON 48700 — H×2 = '+mQL+' mt',preco:getPreco('PA-QL 48700'),apl:'FAB',grp:'VEDAÇÕES',obs:'VEDAÇÃO'});

  // ── FABRICAÇÃO — ISOLAMENTO ─────────────────────────────────────────────────
  // Fixos: adicionar m² e metro linear de cada fixo
  var m2FixoRocha = 0, mFixoIso = 0;
  var tfElIso = document.getElementById('tem-fixo');
  if(tfElIso && tfElIso.checked){
    document.querySelectorAll('.fixo-blk').forEach(function(el){
      var lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
      var af=parseFloat((el.querySelector('.fixo-alt') ||{value:0}).value)||0;
      var ld=parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
      if(!lf||!af) return;
      m2FixoRocha += (lf/1000)*(af/1000)*ld; // L×H×lados (sem ×2 extra)
      mFixoIso    += Math.ceil((lf/1000)*2+(af/1000)*2);
    });
  }

  // Lã de Rocha: L×H×2 (2 camadas instaladas) + fixos (Lf×Af×lados por fixo)
  var m2RochaPorta = Math.round((L/1000)*(H/1000)*2*100)/100;
  var m2RochaDesc = Math.round((m2RochaPorta + m2FixoRocha)*100)/100; // com decimal para descrição
  var m2Rocha = Math.round(m2RochaDesc); // qty arredondado inteiro
  var rochaDesc = 'Lã de Rocha D32 — L×H×2 = '+m2RochaPorta.toFixed(2)+'m²';
  if(m2FixoRocha>0){
    var _fxRochaParts=[];
    if(tfElIso && tfElIso.checked){
      document.querySelectorAll('.fixo-blk').forEach(function(el,_fi){
        var lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
        var af=parseFloat((el.querySelector('.fixo-alt') ||{value:0}).value)||0;
        var ld=parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
        if(!lf||!af) return;
        var m2f=Math.round((lf/1000)*(af/1000)*100)/100; // L×H apenas
        _fxRochaParts.push('F'.concat((_fi+1),': L×H=',m2f.toFixed(2),'m²'));
      });
    }
    rochaDesc += ' + fixos ('+_fxRochaParts.join(', ')+') = '+m2FixoRocha.toFixed(2)+'m² → total '+m2RochaDesc.toFixed(2)+'m²';
  }
  rows.push({qty:m2Rocha,code:'PA-LADEROCHA',desc:rochaDesc,preco:getPreco('PA-LADEROCHA'),apl:'FAB',grp:'ISOLAMENTO',obs:'ISOLAMENTO'});

  // ── EPS PLACA 50mm: porta L×H×2 + fixo L×H×2 ─────────────────────────────
  var m2PlacaPorta = Math.round((L/1000)*(H/1000)*2*100)/100;
  var m2PlacaFixo  = 0;
  if(tfElIso && tfElIso.checked){
    document.querySelectorAll('.fixo-blk').forEach(function(el){
      var lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
      var af=parseFloat((el.querySelector('.fixo-alt') ||{value:0}).value)||0;
      if(!lf||!af) return;
      m2PlacaFixo += Math.round((lf/1000)*(af/1000)*2*100)/100;
    });
  }
  var m2Placa50Desc = Math.round((m2PlacaPorta + m2PlacaFixo)*100)/100; // com decimal
  var m2Placa50 = Math.round(m2Placa50Desc); // qty inteiro
  var placaDesc = 'EPS Placa 50mm — L×H×2 = '+m2PlacaPorta.toFixed(2)+'m²';
  if(m2PlacaFixo>0){
    var _fxPrancParts=[];
    document.querySelectorAll('.fixo-blk').forEach(function(el,_fi){
      var lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
      var af=parseFloat((el.querySelector('.fixo-alt') ||{value:0}).value)||0;
      if(!lf||!af) return;
      var m2fp=Math.round((lf/1000)*(af/1000)*2*100)/100; // L×H×2
      _fxPrancParts.push('F'.concat((_fi+1),': L×H×2=',m2fp.toFixed(2),'m²'));
    });
    placaDesc += ' + fixos ('+_fxPrancParts.join(', ')+') = '+m2PlacaFixo.toFixed(2)+'m² → total '+m2Placa50Desc.toFixed(2)+'m²';
  }
  rows.push({qty:m2Placa50,code:'PA-ISOPOR PRANC 50',desc:placaDesc,preco:getPreco('PA-ISOPOR PRANC 50'),apl:'FAB',grp:'EMBALAGEM',obs:'EPS PLACA'});

  // Isopor/EPS — selecionar por sistema e modelo
  // PA006 normal→115, PA007 normal→125, PA006 ripado→135, PA007 ripado→165
  var _modNomeIso='';
  var _modElIso=document.getElementById('carac-modelo');
  if(_modElIso&&_modElIso.selectedIndex>=0) _modNomeIso=(_modElIso.options[_modElIso.selectedIndex]||{text:''}).text.toLowerCase();
  var isRipadoIso = _modNomeIso.indexOf('ripado')>=0;
  var isoCode, isoDim, isoDesc2;
  if(sis==='PA006'){
    if(isRipadoIso){ isoCode='PA-ISOPOR 135'; isoDim='EPS CANALETA U MOD 07 135×50'; }
    else           { isoCode='PA-ISOPOR 115'; isoDim='EPS CANALETA U MOD 05 115×50'; }
  } else {
    if(isRipadoIso){ isoCode='PA-ISOPOR 165'; isoDim='EPS CANALETA U MOD 08 165×50'; }
    else           { isoCode='PA-ISOPOR 125'; isoDim='EPS CANALETA U MOD 06 125×50'; }
  }
  var mIsoPorta = Math.ceil((H/1000)*4+(L/1000)*3);
  var mIso = mIsoPorta + mFixoIso;
  // Descrição: fórmula da porta detalhada + fixo só total
  var isoDescTxt = isoDim+' — H×4+L×3 = '+mIsoPorta+'m';
  if(mFixoIso>0){
    // Mostrar fórmula do fixo também (L×2+H×2 por fixo)
    var _fxDescs=[];
    if(tfElIso && tfElIso.checked){
      document.querySelectorAll('.fixo-blk').forEach(function(el,_fi){
        var lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
        var af=parseFloat((el.querySelector('.fixo-alt') ||{value:0}).value)||0;
        if(!lf||!af) return;
        var mFx=Math.ceil((lf/1000)*2+(af/1000)*2);
        _fxDescs.push('F'.concat((_fi+1),': L×2+H×2=',mFx,'m'));
      });
    }
    isoDescTxt += ' + fixos: ('+_fxDescs.join(', ')+') = '+mFixoIso+'m → total '+mIso+'m';
  }
  var _isoGrp=(isoCode==='PA-ISOPOR 125')?'EMBALAGEM':'ISOLAMENTO';
  rows.push({qty:mIso,code:isoCode,desc:isoDescTxt,preco:getPreco(isoCode),apl:'FAB',grp:_isoGrp,obs:'EPS'});

  // ── FABRICAÇÃO — DOWSIL 995 + FITA DFIX (sem fórmula por enquanto) ──────────
  rows.push((function(){
    var A=parseFloat(document.getElementById('altura').value)||0;
    var L=parseFloat(document.getElementById('largura').value)||0;
    var conj=nFolhas===2?4:2;
    var mDow=sis==='PA006'?(A*6+L*4+A*4*conj):(A*4+L*4+A*4*conj);
    var tubos=Math.ceil(mDow/1000/8)||1;
    return {qty:tubos,code:'PA-DOWSIL 995',
      desc:'Dowsil 995 preto sachê 591ml — '+(mDow/1000).toFixed(1)+'m ÷ 8m/tubo = '+tubos+' tubo(s)',
      preco:getPreco('PA-DOWSIL 995 ESTR SH'),apl:'FAB',grp:'SELANTES',obs:'DOWSIL'};
  })());
  rows.push((function(){
    var A=parseFloat(document.getElementById('altura').value)||0;
    var L=parseFloat(document.getElementById('largura').value)||0;
    var conj=nFolhas===2?4:2;
    var mFD19=sis==='PA006'?(A*2+L*2+A*conj):(A*6+L*2+A*conj);
    var rolos=Math.ceil(mFD19/1000/20)||1;
    return {qty:rolos,code:'PA-FITDF 19X20X1.0',
      desc:'Fita DFix 1,0×19mm — '+(mFD19/1000).toFixed(1)+'m ÷ 20m/rolo = '+rolos+' rolo(s)',
      preco:getPreco('PA-FITDF 19X20X1.0'),apl:'FAB',grp:'FITA DUPLA FACE',obs:'FITA DFIX'};
  })());
  rows.push((function(){
    var A=parseFloat(document.getElementById('altura').value)||0;
    var L=parseFloat(document.getElementById('largura').value)||0;
    var mFD12=sis==='PA006'?(A*6+L*4):(A*2+L*4);
    // Modelo 07: +4 fitas por ripa × altura (2 por friso × frente+verso)
    var _mod07=((document.getElementById('carac-modelo')||{value:''}).value==='07'||(document.getElementById('plan-modelo')||{value:''}).value==='07');
    if(_mod07){
      var _nRip07=parseInt((document.getElementById('plan-ripa-qty')||{value:0}).value)||0;
      mFD12+=4*_nRip07*A;
    }
    var rolos=Math.ceil(mFD12/1000/20)||1;
    return {qty:rolos,code:'PA-FITDF 12X20X1.0',
      desc:'Fita DFix 1,0×12mm — '+(mFD12/1000).toFixed(1)+'m ÷ 20m/rolo = '+rolos+' rolo(s)'+(_mod07?' (incl. '+_nRip07+' ripas)':''),
      preco:getPreco('PA-FITDF 12X20X1.0'),apl:'FAB',grp:'FITA DUPLA FACE',obs:'FITA DF12'};
  })());

  // ── OBRA — FECHO UNHA + PUSH&GO (só para 2 folhas) ───────────────────────
  if(nFolhas >= 2){
    if(H > 4000){
      // H > 4000: 1 fecho unha + 1 push & go
      rows.push({qty:1, code:'PA-FECHUNHA',
        desc:'Fecho unha porta 2 folhas',
        preco:getPreco('PA-FECHUNHA'), apl:'OBRA', grp:'FECHADURAS', obs:'FECHO FOLHA'});
      rows.push({qty:1, code:'PA-PUSHGO',
        desc:'Push & Go amortecedor — H='+Math.round(H)+'mm > 4000mm',
        preco:getPreco('PA-PUSHGO'), apl:'OBRA', grp:'FECHADURAS', obs:'PUSH GO'});
    } else {
      // H <= 4000: 2 fecho unha
      rows.push({qty:2, code:'PA-FECHUNHA',
        desc:'Fecho unha porta 2 folhas — 2 un.',
        preco:getPreco('PA-FECHUNHA'), apl:'OBRA', grp:'FECHADURAS', obs:'FECHO FOLHA'});
    }
  }

  // ── OBRA — BUCHA 08 + PARAFUSO PORTAL ─────────────────────────────────────
  // × 2 porque vai nos dois lados (esquerdo + direito) do portal
  var qtyBucha8 = Math.ceil(H/300) * 2;
  rows.push({qty:qtyBucha8,code:'PA-BUCHA 08',desc:'Bucha Duopower 8 SC750 — portal (ceil H÷300 × 2 lados) = '+qtyBucha8+' un.',preco:getPreco('PA-BUCHA 08'),apl:'OBRA',grp:'PARAFUSOS',obs:'BUC FISHER PORTAL'});
  rows.push({qty:qtyBucha8,code:'PA-PAR SOB M6X65',desc:'Parafuso sext sob M6×65 DIN571 A2 — portal (× 2 lados)',preco:getPreco('PA-PAR SOB M6X65'),apl:'OBRA',grp:'PARAFUSOS',obs:'PAR SEXT'});

  // ── OBRA — CONTRA TESTA + CAIXETA + PARAFUSOS ─────────────────────────────
  if(fechTipo){
    rows.push({qty:1*nFolhas,code:'PA-KESO CRT 4P RT CR',desc:'Contra testa inox 04P oblongo RT CRA — 1 por porta',preco:getPreco('PA-KESO CRT 4P RT CR'),apl:'OBRA',grp:'FECHADURAS',obs:'CONTRA TESTA'});
    rows.push({qty:1*nFolhas,code:'PA-KESO CXT 4P',desc:'Caixeta acabamento fechadura 04P — 1 por porta',preco:getPreco('PA-KESO CXT 4P'),apl:'OBRA',grp:'FECHADURAS',obs:'CAIXETA PRINCIPAL'});
    var auxMap={'04 PINOS':0,'08 PINOS':1,'12 PINOS':2,'16 PINOS':3,'24 PINOS':4};
    var qtyAux=(auxMap[fechTipo]||0)*nFolhas;
    if(qtyAux>0){
      rows.push({qty:qtyAux,code:'PA-KESO CRT AUX CR',desc:'Contra testa auxiliar 03P CRA — '+auxMap[fechTipo]+' p/ '+fechTipo,preco:getPreco('PA-KESO CRT AUX CR'),apl:'OBRA',grp:'FECHADURAS',obs:'AUXILIAR CONTRATESTA'});
      rows.push({qty:qtyAux,code:'PA-KESO CXT AUX',desc:'Caixeta acabamento auxiliares 04P',preco:getPreco('PA-KESO CXT  AUX'),apl:'OBRA',grp:'FECHADURAS',obs:'CAIXETA AUXILIAR'});
    }
    var totalCRT=(1*nFolhas)+qtyAux;
    rows.push({qty:totalCRT*4,code:'PA-CHAAA PHS 35X20',desc:'Parafuso zincado 35×20mm — 4 pc × '+totalCRT+' CRT',preco:getPreco('PA-CHAAA PHS 35X20'),apl:'OBRA',grp:'PARAFUSOS',obs:'PARAFUSO CONTRATESTA'});
  }

  // ── OBRA — SELANTES ───────────────────────────────────────────────────────
  rows.push({qty:1,code:'PA-PRIMER',desc:'Primer fita dupla face VHB 940ml',preco:getPreco('PA-PRIMER'),apl:'OBRA',grp:'SELANTES',obs:'PRIMER'});
  var qEspuma=H>4000?2:1;
  rows.push({qty:qEspuma,code:'PA-ESPUMA EXP GUN',desc:'Espuma poliuretano 750ml — H='+Math.round(H)+'mm → '+qEspuma+' lata(s)',preco:getPreco('PA-ESPUMA EXP GUN'),apl:'OBRA',grp:'SELANTES',obs:'ESP EXP'});
  var qHight=H<=3000?2:H<=5000?3:4;
  rows.push({qty:qHight,code:'PA-HIGHTACK BR',desc:'Fix All High Tack branco 290ml — '+qHight+' un.',preco:getPreco('PA-HIGHTACK BR'),apl:'OBRA',grp:'SELANTES',obs:'MS OBRA'});

  // ── FECHADURAS DIGITAIS (Tedee / Emteco / Philips) ──────────────────────────
  var digTipo=(document.getElementById('carac-fech-dig')||{value:''}).value||'';

  if(digTipo==='TEDEE'){
    var tedeeItems=[
      {code:'PA-TEDEE-BRIDGE',    desc:'Tedee Bridge TBV1.0 WiFi c/fonte',                      obs:'FECHADURA DIGITAL'},
      {code:'PA-TEDEE-FEC-PT',    desc:'Tedee Lock PRO Homekit Preta TLV1.0B',                   obs:'FECHADURA DIGITAL'},
      {code:'PA-TEDEE-TEC-PT',    desc:'Tedee Keypad PRO Teclado biométrico TKV2.0',             obs:'TECLADO TEDEE'},
      {code:'PA-PILHA-AAA-4X',    desc:'Pacote pilhas AAA 4un',                                  obs:'PILHA PARA TEDEE'},
    ];
    tedeeItems.forEach(function(item){
      rows.push({qty:1,code:item.code,desc:item.desc,preco:getPreco(item.code),apl:'OBRA',obs:item.obs});
    });
  }

  if(digTipo==='EMTECO'){
    // Emteco Barcelona II — fechadura digital
    var emtecoItems=[
      {code:'PA-DIG EMTECO BAR II', desc:'Fechadura Digital Barcelona II (WiFi) Biometria/Senha/Chave/App', obs:'FECHADURA DIGITAL'},
    ];
    emtecoItems.forEach(function(item){
      rows.push({qty:1,code:item.code,desc:item.desc,preco:getPreco(item.code),apl:'OBRA',obs:item.obs});
    });
  }

  if(digTipo==='PHILIPS'){
    // Philips 9300 — todos os componentes com PA-9300 no código
    var philipsCodes = COMP_DB.filter(function(c){ return c.c.indexOf('9300')>=0 || c.c.indexOf('PA-DIG PH')>=0; });
    philipsCodes.forEach(function(item){
      rows.push({qty:1,code:item.c,desc:item.d||item.c,preco:getPreco(item.c),apl:'OBRA',obs:'FECHADURA DIGITAL'});
    });
  }

  if(digTipo==='NUKI'){
    // Nuki Smart Lock — itens PA-NUKI-*
    var nukiItems=[
      {code:'PA-NUKI-BRI',    desc:'Nuki Bridge WiFi c/fonte',          obs:'FECHADURA DIGITAL'},
      {code:'PA-NUKI-FEC-BL', desc:'Combo Nuki Smartlock Preto',        obs:'FECHADURA DIGITAL'},
      {code:'PA-NUKI-TEC-BL', desc:'Nuki Keypad PRO Teclado Preto',     obs:'TECLADO NUKI'},
      {code:'PA-NUKIBATERIA',  desc:'Bateria para Nuki',                 obs:'BATERIA NUKI'},
    ];
    nukiItems.forEach(function(item){
      rows.push({qty:1,code:item.code,desc:item.desc,preco:getPreco(item.code),apl:'OBRA',obs:item.obs});
    });
  }

  // Calcular fixos separadamente (renderizados em seção própria)
  try{
    var _fixosData = _calcFixosCompleto(sis, getPreco);
    window._lastFixosAcessRows  = (_fixosData && _fixosData.acessRows)  || [];
    window._lastFixosPerfisRows = (_fixosData && _fixosData.perfisRows) || [];
    window._lastFixosM2Chapa    = (_fixosData && _fixosData.m2ChapaFixos) || 0;
  }catch(efx){
    window._lastFixosAcessRows=[]; window._lastFixosPerfisRows=[]; window._lastFixosM2Chapa=0;
    console.warn('fixos calc error', efx);
  }

  // ── Acessórios do Quadro Fixo — juntar com FABRICAÇÃO ──────────────────────
  var _fixAcessRows = window._lastFixosAcessRows || [];
  _fixAcessRows.forEach(function(r){
    rows.push({qty:r.qty, code:r.code, desc:r.desc+' — FIXO',
               preco:r.preco||0, apl:'FAB', grp:'FIXO', obs:'QUADRO FIXO'});
  });

  return rows;
}

/* ── Helper: calcula acessórios para todos os itens multi-porta ── */
function _calcAcessoriosAllItems(d, sis){
  console.log('🔧 _calcAcessoriosAllItems chamada. _mpItens='+((window._mpItens&&window._mpItens.length)||0));
  if(!window._mpItens || window._mpItens.length === 0){
    console.log('  → Single door mode');
    // Single door
    var nFol=parseInt((document.getElementById('folhas-porta')||{value:1}).value)||1;
    var rows=_calcAcessoriosOS(d, nFol, sis);
    var qP=window._qPOS||parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
    if(qP>1) rows.forEach(function(r){r.qty=r.qty*qP;});
    return rows;
  }
  // Multi-porta: iterar cada item
  console.log('  → Multi-porta mode: '+window._mpItens.length+' itens');
  var allRows=[];
  var saved={};
  ['largura','altura','carac-modelo','carac-abertura','folhas-porta','carac-fech-mec','carac-fech-dig','carac-cilindro','carac-puxador','carac-pux-tam'].forEach(function(id){
    var el=document.getElementById(id);saved[id]=el?el.value:'';
  });
  window._mpItens.forEach(function(mpIt,idx){
    ['largura','altura','carac-modelo','carac-abertura','folhas-porta','carac-fech-mec','carac-fech-dig','carac-cilindro','carac-puxador','carac-pux-tam'].forEach(function(id){
      var el=document.getElementById(id);
      if(el){
        var mpKey=id;
        var altKey=id.replace('carac-','').replace(/-/g,'_');
        el.value=mpIt[mpKey]||mpIt['_'+altKey]||mpIt[altKey]||'';
      }
    });
    // Fallback: campos meta
    if(document.getElementById('largura'))document.getElementById('largura').value=mpIt['largura']||mpIt._largura||'';
    if(document.getElementById('altura'))document.getElementById('altura').value=mpIt['altura']||mpIt._altura||'';
    var fmVal=(document.getElementById('carac-fech-mec')||{value:''}).value;
    console.log('  Item '+(idx+1)+': L='+document.getElementById('largura').value+' A='+document.getElementById('altura').value+' fech='+fmVal+' mod='+((document.getElementById('carac-modelo')||{value:''}).value));
    var nFolI=parseInt(mpIt['folhas-porta']||mpIt._folhas)||1;
    // ★ FIX CILINDRO: recalcular sistema PA006/PA007 POR PORTA baseado na altura desta porta
    //   antes o parâmetro sis era fixo → cilindros vinham todos 150mm mesmo quando
    //   porta menor precisava 130mm (PA006). Agora: < 4000mm → PA006 (130mm),
    //   >= 4000mm → PA007 (150mm). Mesma regra usada em outros cálculos (tubo, fita, etc).
    var _altPorta = parseFloat(mpIt['altura']||mpIt._altura)||0;
    var sisPorta = _altPorta < 4000 ? 'PA006' : 'PA007';
    try{
      var iRows=_calcAcessoriosOS(d, nFolI, sisPorta);
      var qI=parseInt(mpIt['qtd-portas']||mpIt._qtd)||1;
      if(qI>1) iRows.forEach(function(r){r.qty=r.qty*qI;});
      // Marcar de qual item veio
      iRows.forEach(function(r){r._itemIdx=idx;r._itemLabel='Item '+(idx+1)+': '+(mpIt._largura||mpIt['largura']||'?')+'×'+(mpIt._altura||mpIt['altura']||'?');});
      allRows=allRows.concat(iRows);
    }catch(e){console.warn('Acess item '+idx+':',e);}
  });
  // Restaurar form
  Object.keys(saved).forEach(function(id){var el=document.getElementById(id);if(el)el.value=saved[id];});

  // ── MERGE: somar itens iguais (mesmo código) ──
  var merged=[];
  var mergeMap={};
  allRows.forEach(function(r){
    // Merge key: código + preço (desc pode variar por porta)
    var key=r.code+'|||'+(r.preco||0);
    if(mergeMap[key]!==undefined){
      var existing=merged[mergeMap[key]];
      existing.qty+=r.qty;
      // Acumular detalhes de cada porta
      if(r._itemLabel){
        existing._perDoor.push({label:r._itemLabel,qty:r.qty,desc:r.desc});
      }
    } else {
      mergeMap[key]=merged.length;
      var nr=Object.assign({},r);
      nr._perDoor=[{label:r._itemLabel||'',qty:r.qty,desc:r.desc}];
      merged.push(nr);
    }
  });
  // Atualizar descrição para mostrar fórmula de cada porta
  merged.forEach(function(r){
    if(r._perDoor && r._perDoor.length>1){
      // Verificar se todas as descrições são iguais
      var allSame=r._perDoor.every(function(d){return d.desc===r._perDoor[0].desc;});
      if(allSame){
        // Mesmo cálculo para todas as portas — só adicionar (P1+P2)
        var labels=r._perDoor.map(function(d){return d.label.split(':')[0];}).join('+');
        r.desc=r._perDoor[0].desc+' ('+labels+')';
      } else {
        // Fórmulas diferentes — mostrar cada uma e total
        var parts=r._perDoor.map(function(d){
          var pLabel=d.label.split(':')[0]; // "P1" ou "P2"
          // Extrair a parte da fórmula da descrição
          var formulaPart=d.desc.replace(r.code,'').replace(/^[\s—-]+/,'');
          return pLabel+': '+formulaPart+' (×'+d.qty+')';
        });
        r.desc=r.desc.split('—')[0].trim()+' — '+parts.join(' + ')+' = '+r.qty+' total';
      }
    }
  });

  // Ordenar por grupo para manter categorias juntas (VEDAÇÕES, FECHADURAS, etc.)
  var grpOrder={'FECHADURAS':1,'VEDAÇÕES':2,'ISOLAMENTO':3,'SELANTES':4,'EMBALAGEM':5,'FITA DUPLA FACE':6,'PARAFUSOS':7,'FIXO':8};
  merged.sort(function(a,b){
    var ga=grpOrder[a.grp]||99, gb=grpOrder[b.grp]||99;
    if(ga!==gb) return ga-gb;
    return (a.code||'').localeCompare(b.code||'');
  });

  console.log('  → Total acessórios: '+allRows.length+' raw → '+merged.length+' merged (de '+window._mpItens.length+' itens)');
  return merged;
}

function _renderAcessoriosOS(rows){
  var tbody = document.getElementById('os-acess-tbody');
  var tfoot = document.getElementById('os-acess-tfoot');
  var lbl   = document.getElementById('os-acess-total-label');
  if(!tbody) return 0;
  if(!rows||rows.length===0){
    tbody.innerHTML='<tr><td colspan="5" style="padding:8px;text-align:center;color:#aaa;font-size:10px">Selecione a fechadura nas Características da Porta</td></tr>';
    if(tfoot) tfoot.innerHTML='';
    return 0;
  }
  var totalAcess=0;
  var html='';
  rows.forEach(function(r,i){
    var tot=r.preco*r.qty;
    totalAcess+=tot;
    var bg=i%2===0?'#f9f8f5':'#fff';
    html+='<tr style="background:'+bg+'">'
      +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;font-weight:700">'+r.qty+'</td>'
      +'<td style="padding:3px 8px;border:0.5px solid #eee;font-size:9px;color:#1a3a4a">'+r.code+'</td>'
      +'<td style="padding:3px 8px;border:0.5px solid #eee">'+r.desc+'</td>'
      +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:right">'+(r.preco>0?'R$ '+r.preco.toFixed(2):'—')+'</td>'
      +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:right;font-weight:700">'+(tot>0?'R$ '+tot.toFixed(2):'—')+'</td>'
      +'</tr>';
  });
  tbody.innerHTML=html;
  if(tfoot) tfoot.innerHTML='<tr style="background:#f0f4f6;font-weight:700">'
    +'<td colspan="4" style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-size:10px">Total acessórios</td>'
    +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;color:#1a5276">R$ '+totalAcess.toFixed(2)+'</td>'
    +'</tr>';
  if(lbl) lbl.textContent='Total: R$ '+totalAcess.toFixed(2);
  return totalAcess;
}


// ── OS ACESSÓRIOS TAB ─────────────────────────────────────────────────────────
function _calcPesoPorta(d){
  // Perfis: só da FOLHA (porta), sem portal/friso/fixo
  var pesoPerfis = window._pesoPerfisFolha || 0;
  // Fallback: se não tiver FOLHA calculado, usa total
  if(!pesoPerfis && d && d.seenKeys){
    d.seenKeys.forEach(function(key){
      var r=d.groupRes[key]; if(!r) return;
      pesoPerfis += r.kgLiq||0;
    });
  }
  // Chapas ACM: só peças da PORTA (sem U Portal, sem Fixo)
  var pesoChapas = window._planPesoPortaACM || window._planPesoLiqACM || 0;
  // Enchimentos (100mm × comprimento travessas × 2 frente/costas)
  var pesoEnchimento = window._enchimentoPeso || 0;
  // Lã de rocha (32 kg/m³ × largura_interna × altura_interna × espessura porta)
  var pesoLaRocha = window._laRochaPeso || 0;
  return {pesoPerfis:pesoPerfis, pesoChapas:pesoChapas, pesoEnchimento:pesoEnchimento, pesoLaRocha:pesoLaRocha, total:pesoPerfis+pesoChapas+pesoEnchimento+pesoLaRocha};
}

function _renderOSAcess(d, acessRows, vedaInfo){
  var content_el = document.getElementById('osa-content');
  var totalWrap  = document.getElementById('osa-total-wrap');
  if(!content_el) return;

  // ★ Felipe 23/04: em orçamento só-revestimento, pular cálculo de pivô/
  //   dobradiça/fechadura — só devem aparecer as 3 linhas já passadas em
  //   acessRows (fita 12mm, Dowsil 995, Primer). Evita herança acidental
  //   de carac-abertura='PIVOTANTE' de card anterior.
  var _temPortaFixo_rv = (window._orcItens||[]).some(function(it){
    return it.tipo==='porta_pivotante' || it.tipo==='porta_interna' || it.tipo==='fixo';
  });
  var _temRev_rv = (window._orcItens||[]).some(function(it){
    return it.tipo==='revestimento' && (it.largura||0)>0 && (it.altura||0)>0;
  });
  var _isRevOnlyRender = !_temPortaFixo_rv && _temRev_rv;

  var savedP={};
  try{var _s=localStorage.getItem('projetta_comp_precos');if(_s)savedP=JSON.parse(_s);}catch(e){}
  function getPreco(code){
    if(savedP[code]!==undefined) return savedP[code];
    for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===code) return COMP_DB[i].p||0;}
    return 0;
  }

  // Door weight
  var peso = _calcPesoPorta(d);
  var pesoEl=document.getElementById('osa-peso-perfis');
  var chapEl=document.getElementById('osa-peso-chapas');
  var totEl =document.getElementById('osa-peso-total');
  if(pesoEl) pesoEl.textContent=peso.pesoPerfis.toFixed(1)+' kg';
  if(chapEl) chapEl.textContent=peso.pesoChapas.toFixed(1)+' kg';
  if(totEl)  totEl.textContent =peso.total.toFixed(1)+' kg';

  // ── Pivô ou Dobradiça conforme tipo de abertura ──
  var abertura = (document.getElementById('carac-abertura')||{value:''}).value||'';
  // ★ Felipe 23/04: em rev-only, forçar abertura vazia pra não gerar pivô/dobradiça
  if(_isRevOnlyRender) abertura = '';
  var _qPHw=window._mpItens&&window._mpItens.length>0?window._mpItens.reduce(function(s,it){return s+(parseInt(it._qtd||it['qtd-portas'])||1);},0):parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
  var _nFolHw=parseInt((document.getElementById('folhas-porta')||{value:1}).value)||1;
  var hardwareRows = [];

  // Limpar alerta anterior
  var oldAlert = document.getElementById('osa-dob-alert');
  if(oldAlert) oldAlert.remove();

  if(window._mpItens&&window._mpItens.length>0){
    // Multi-porta: abertura PER ITEM
    window._mpItens.forEach(function(mpIt,di){
      var itemAbertura=mpIt['carac-abertura']||abertura||'PIVOTANTE';
      var qI=parseInt(mpIt._qtd||mpIt['qtd-portas'])||1;
      var pPerfis=(window._perfisPerDoor&&window._perfisPerDoor[di])||0;
      var pChapas=(window._pesoChapasPerDoor&&window._pesoChapasPerDoor[di])||0;
      var pEnch=peso.pesoEnchimento/_qPHw*qI;
      var pLa=peso.pesoLaRocha/_qPHw*qI;
      var pTotal=pPerfis+pChapas+pEnch+pLa;
      var L=mpIt._largura||mpIt['largura']||'?';
      var A=mpIt._altura||mpIt['altura']||'?';

      if(itemAbertura==='DOBRADIÇA'){
        var qtyDob=pTotal<=100?3:4;
        var dobCode='PA-DOBKESO 4X3X3 PRE';
        var dobPreco=getPreco(dobCode);
        var detailDob='<b>P'+(di+1)+' '+L+'×'+A+'</b> ('+pTotal.toFixed(1)+' kg — '+qtyDob+' un.)';
        hardwareRows.push({qty:qtyDob*qI,code:dobCode,desc:'Dobradiça Volper 4×3×3 Inox Preto<br>'+detailDob,preco:dobPreco,apl:'FAB',grp:'DOBRADIÇAS',obs:'DOBRADIÇA P'+(di+1)});
      } else {
        var pivCode=pTotal<=350?'PA-PIVOT 350 KG':'PA-PIVOT 600 KG';
        var pivPreco=getPreco(pivCode);
        var pivDesc=pTotal<=350?'Pivô conj. sup/inf 350kg inox 304':'Pivô conj. sup/inf 650kg inox';
        var detailHtml='<b>P'+(di+1)+' '+L+'×'+A+'</b>'
          +'<br>├ Perfis folha: <b>'+pPerfis.toFixed(1)+'</b> kg'
          +'<br>├ Chapas porta: <b>'+pChapas.toFixed(1)+'</b> kg'
          +'<br>├ Enchimento: <b>'+pEnch.toFixed(1)+'</b> kg'
          +'<br>├ Lã de rocha: <b>'+pLa.toFixed(1)+'</b> kg'
          +'<br>└ <b style="color:#c0392b">TOTAL: '+pTotal.toFixed(1)+' kg</b> → '+pivCode;
        hardwareRows.push({qty:qI,code:pivCode,desc:pivDesc+'<br>'+detailHtml,preco:pivPreco,apl:'FAB',grp:'PIVÔ',obs:'PIVÔ P'+(di+1)});
      }
    });
  } else if(abertura === 'DOBRADIÇA'){
    if(peso.total > 150){
      var alertDiv = document.createElement('div');
      alertDiv.id = 'osa-dob-alert';
      alertDiv.style.cssText = 'background:#ffebee;border:2px solid #e74c3c;border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:12px;color:#b71c1c;line-height:1.6';
      alertDiv.innerHTML = '<b>⚠ ALERTA: Peso da porta ('+peso.total.toFixed(1)+' kg) excede o limite de 150 kg para dobradiças!</b><br>'
        +'Recomendação: altere o tipo de abertura para <b>PIVOTANTE</b> nas Características da Porta.';
      content_el.parentNode.insertBefore(alertDiv, content_el);
    }
    var qtyDob = peso.total <= 100 ? 3 : 4;
    var dobCode = 'PA-DOBKESO 4X3X3 PRE';
    var dobPreco = getPreco(dobCode);
    var dobDesc = 'Dobradiça Volper 4×3×3 Inox Preto';
    hardwareRows.push({qty:qtyDob*_qPHw, code:dobCode, desc:dobDesc+' (porta: '+peso.total.toFixed(1)+'kg — '+qtyDob+' un.×'+_qPHw+')', preco:dobPreco, apl:'FAB', grp:'DOBRADIÇAS', obs:'DOBRADIÇA'});
  } else if(abertura === 'PIVOTANTE'){
    var pivotCode  = peso.total<=350?'PA-PIVOT 350 KG':'PA-PIVOT 600 KG';
    var pivotPreco = getPreco(pivotCode);
    var pivotDesc  = peso.total<=350?'Pivô conj. sup/inf 350kg inox 304':'Pivô conj. sup/inf 650kg inox';
    var singleDetail='<br>├ Perfis folha: <b>'+peso.pesoPerfis.toFixed(1)+'</b> kg'
      +'<br>├ Chapas porta: <b>'+peso.pesoChapas.toFixed(1)+'</b> kg'
      +'<br>├ Enchimento: <b>'+peso.pesoEnchimento.toFixed(1)+'</b> kg'
      +'<br>├ Lã de rocha: <b>'+peso.pesoLaRocha.toFixed(1)+'</b> kg'
      +'<br>└ <b style="color:#c0392b">TOTAL: '+peso.total.toFixed(1)+' kg</b>';
    hardwareRows.push({qty:_qPHw*_nFolHw, code:pivotCode, desc:pivotDesc+singleDetail, preco:pivotPreco, apl:'FAB', grp:'PIVÔ', obs:'PIVÔ'});
  }
  // Se abertura não selecionada: sem pivô nem dobradiça

  var allRows = hardwareRows.concat(acessRows||[]);
  // Agregar itens iguais (mesmo código): somar quantidades
  var _aggMap={},_aggOrder=[];
  allRows.forEach(function(r){
    var key=r.code+'|'+r.apl+'|'+r.grp+'|'+(r.obs||'');
    if(_aggMap[key]){
      _aggMap[key].qty+=r.qty;
    } else {
      _aggMap[key]={code:r.code,desc:r.desc,qty:r.qty,preco:r.preco,apl:r.apl,grp:r.grp,obs:r.obs};
      _aggOrder.push(key);
    }
  });
  allRows=_aggOrder.map(function(k){return _aggMap[k];});

  if(!allRows||allRows.length===0){
    content_el.innerHTML='<div style="text-align:center;color:#aaa;padding:40px">Preencha as Características da Porta para gerar automaticamente.</div>';
    return 0;
  }

  // Separar: fechaduras digitais (Tedee/Emteco/Philips) → seção própria
  function _isFechDig(code){ var c=(code||'').toUpperCase(); return (c.indexOf('TEDEE')>=0&&c.indexOf('KESO')<0)||c.indexOf('EMTECO')>=0||c.indexOf('9300')>=0||c.indexOf('PA-DIG PH')>=0||c.indexOf('BARCELONA')>=0||c.indexOf('PILHATEDEE')>=0||c.indexOf('TEDEECABO')>=0||c.indexOf('PILHA-AAA')>=0||c.indexOf('PA-NUKI')>=0||c.indexOf('NUKIBAT')>=0||c.indexOf('NUKISUP')>=0||c.indexOf('PA-DIG SOL')>=0; }
  var fabRows    = allRows.filter(function(r){return r.apl!=='OBRA' && !_isFechDig(r.code);});
  var obraRows   = allRows.filter(function(r){return r.apl==='OBRA' && !_isFechDig(r.code);});
  var fechDigRows = allRows.filter(function(r){return _isFechDig(r.code);});

  var FAB_ORDER  = ['PIVÔ','DOBRADIÇAS','FECHADURAS','PARAFUSOS','VEDAÇÕES','ISOLAMENTO','SELANTES','OUTROS'];
  var OBRA_ORDER = ['FECHADURAS','PARAFUSOS','SELANTES','OUTROS'];
  var GRP_COLORS = {
    'PIVÔ':'#d35400','DOBRADIÇAS':'#c0392b','FECHADURAS':'#2c3e50','PARAFUSOS':'#5d6d7e',
    'VEDAÇÕES':'#1a5276','ISOLAMENTO':'#1e8449','SELANTES':'#6c3483','OUTROS':'#888'
  };

  var totalGeral=0;
  var html='';

  function renderApl(label, color, rows, order){
    if(!rows||rows.length===0) return;
    var grpMap={};
    rows.forEach(function(item){
      var g=item.grp||'OUTROS';
      if(!grpMap[g]) grpMap[g]=[];
      grpMap[g].push(item);
    });
    var grpOrder=order.slice();
    Object.keys(grpMap).forEach(function(g){if(grpOrder.indexOf(g)<0) grpOrder.push(g);});

    html+='<div style="margin-bottom:16px;border:0.5px solid #ccc;border-radius:8px;overflow:hidden">';
    html+='<div style="background:'+color+';color:#fff;padding:9px 14px;font-size:12px;font-weight:700;letter-spacing:.05em">'+label+'</div>';
    var aplTotal=0;

    // Single table for the entire application block
    html+='<table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">';
    html+='<colgroup><col style="width:46px"><col style="width:160px"><col><col style="width:130px"><col style="width:80px"><col style="width:90px"></colgroup>';
    html+='<thead><tr style="background:#f8f7f5">'
         +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Qtd</th>'
         +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Código</th>'
         +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Descrição</th>'
         +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Obs.</th>'
         +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:right">Preço</th>'
         +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:right">Total</th>'
         +'</tr></thead><tbody>';

    grpOrder.forEach(function(grpName){
      var items=grpMap[grpName];
      if(!items||items.length===0) return;
      var gc=GRP_COLORS[grpName]||'#888';
      // Group header as full-width row
      html+='<tr><td colspan="6" style="background:'+gc+'15;border-top:1.5px solid '+gc+'50;padding:4px 14px;font-size:10px;font-weight:700;color:'+gc+';letter-spacing:.07em;text-transform:uppercase">'+grpName+'</td></tr>';
      items.forEach(function(item,i){
        var tot=item.preco*item.qty;
        aplTotal+=tot; totalGeral+=tot;
        var isZero=(!item.preco||item.preco<=0);
        var bg=isZero?'#ffebee':i%2===0?'#f9f8f5':'#fff';
        var boldCls=isZero?'font-weight:800;':'';
        html+='<tr style="background:'+bg+(isZero?';border-left:3px solid #b71c1c':'')+'">'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;font-weight:700;'+boldCls+'">'+item.qty+'</td>'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;font-size:9.5px;color:'+gc+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'+boldCls+'">'+item.code+'</td>'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;overflow:hidden;text-overflow:ellipsis;'+boldCls+'">'+item.desc+'</td>'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;font-size:9px;color:#888;overflow:hidden;text-overflow:ellipsis">'+(item.obs||'')+'</td>'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:right;white-space:nowrap;'+boldCls+(isZero?'color:#b71c1c;':'')+'">'+(item.preco>0?'R$ '+item.preco.toFixed(2):'⚠ SEM PREÇO')+'</td>'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:right;font-weight:700;white-space:nowrap;'+(isZero?'color:#b71c1c;':'')+'">'+(tot>0?'R$ '+tot.toFixed(2):'—')+'</td>'
             +'</tr>';
      });
    });
    html+='</tbody></table>';

    html+='<div style="padding:6px 14px;background:#f5f3f0;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:'+color+'">'
         +'<span>Subtotal '+label+'</span>'
         +'<span>'+(aplTotal>0?'R$ '+aplTotal.toFixed(2):'—')+'</span>'
         +'</div>';
    html+='</div>';
  }

  renderApl('Aplicação: FABRICAÇÃO','#1a3a4a',fabRows, FAB_ORDER);
  renderApl('Aplicação: OBRA',       '#8e3400',obraRows,OBRA_ORDER);

  // ── SUBTOTAL FAB + OBRA ──────────────────────────────────────────────────────
  var totalFabObraOnly = fabRows.reduce(function(s,r){return s+(r.preco||0)*(r.qty||0);},0)
                       + obraRows.reduce(function(s,r){return s+(r.preco||0)*(r.qty||0);},0);
  if(totalFabObraOnly > 0){
    html += '<div style="margin-bottom:12px;padding:10px 16px;background:#1a3a4a;border-radius:8px;display:flex;justify-content:space-between;align-items:center">'
          +'<span style="color:#fff;font-size:12px;font-weight:700;letter-spacing:.04em">SUBTOTAL FABRICAÇÃO + OBRA</span>'
          +'<span style="color:#f0c040;font-size:15px;font-weight:900">R$ '+totalFabObraOnly.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</span>'
          +'</div>';
  }

  // ── FECHADURAS DIGITAIS (Tedee / Emteco / Philips) — margem 10% separada ──
  if(fechDigRows.length > 0){
    var fdTotal = 0;
    var fdColor = '#1a3a4a';
    html += '<div style="margin-bottom:16px;border:2px solid #7d3c98;border-radius:8px;overflow:hidden">';
    html += '<div style="background:#7d3c98;color:#fff;padding:9px 14px;font-size:12px;font-weight:700;letter-spacing:.05em">🔐 FECHADURAS DIGITAIS — Tedee / Emteco / Philips <span style="font-weight:400;font-size:10px;opacity:.8">(margem 10% aplicada separado)</span></div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">';
    html += '<colgroup><col style="width:46px"><col style="width:160px"><col><col style="width:130px"><col style="width:80px"><col style="width:90px"></colgroup>';
    html += '<thead><tr style="background:#f5eefa"><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Qtd</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Código</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Descrição</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Obs.</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:right">Preço</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:right">Total</th></tr></thead><tbody>';
    fechDigRows.forEach(function(item,i){
      var tot=(item.preco||0)*(item.qty||0); fdTotal+=tot;
      var isZero=(!item.preco||item.preco<=0);
      var bg=isZero?'#ffebee':i%2===0?'#f9f7fd':'#fff';
      html+='<tr style="background:'+bg+(isZero?';border-left:3px solid #b71c1c':'')+'">'
           +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;font-weight:700">'+item.qty+'</td>'
           +'<td style="padding:3px 8px;border:0.5px solid #eee;font-size:9.5px;color:#7d3c98;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">'+item.code+'</td>'
           +'<td style="padding:3px 8px;border:0.5px solid #eee;overflow:hidden;text-overflow:ellipsis">'+item.desc+'</td>'
           +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;font-size:9px;color:#888">'+(item.obs||'')+'</td>'
           +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:right;white-space:nowrap;'+(isZero?'color:#b71c1c;font-weight:700':'')+'">'+(item.preco>0?'R$ '+item.preco.toFixed(2):'⚠ SEM PREÇO')+'</td>'
           +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:right;font-weight:700;white-space:nowrap">'+(tot>0?'R$ '+tot.toFixed(2):'—')+'</td>'
           +'</tr>';
    });
    html+='</tbody></table>';
    html+='<div style="padding:6px 14px;background:#f0e8f8;border-top:1px solid #d7bde2;display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#7d3c98">'
         +'<span>Subtotal Fechaduras Digitais <span style="font-weight:400;font-size:10px">(+ 10% margem no orçamento)</span></span>'
         +'<span>'+(fdTotal>0?'R$ '+fdTotal.toFixed(2):'—')+'</span>'
         +'</div>';
    html += '</div>';
    // Sincronizar com o campo de custo de fechadura digital
    var fdCustoEl = document.getElementById('fab-custo-fech-dig');
    if(fdCustoEl && !fdCustoEl.dataset.manual) fdCustoEl.value = fdTotal.toFixed(2);
    window._lastFechDigTotal = fdTotal;
  }

  content_el.innerHTML = html||'<div style="text-align:center;color:#aaa;padding:20px">Nenhum acessório calculado.</div>';
  if(totalWrap){
    totalWrap.style.display='flex';
    // Total geral inclui FAB + OBRA + Fechaduras Digitais
    var _totalComFechDig = totalGeral; // fechDigRows somados depois
    document.getElementById('osa-total-geral').textContent='R$ '+_totalComFechDig.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  // ── Calcular total Tedee (vai separado no painel Fechadura com 10% margem) ──
  var tedeeCodes=['PA-TEDEE-BRIDGE','PA-TEDEE-FEC-PT','PA-TEDEE-FEC-PRT/BRA','PA-TEDEE-FEC-BRONZE','PA-TEDEE-FEC-DOURADA','PA-TEDEE-TEC-PT','PA-TEDEE-TEC-BR','PA-TEDEE-CONT SEC','PA-PILHA-AAA-4X'];
  var totalTedee=0;
  allRows.forEach(function(r){
    for(var i=0;i<tedeeCodes.length;i++){
      if(r.code===tedeeCodes[i]){totalTedee+=r.preco*r.qty;break;}
    }
  });

  // ── Sincronizar total de acessórios com a aba Orçamento ──
  // totalGeral = FAB + OBRA; fechDigRows ficam em seção separada mas somam no custo
  var totalFechDig = fechDigRows.reduce(function(s,r){return s+(r.preco||0)*(r.qty||0);},0);
  var totalParaFab = totalGeral + totalFechDig; // FAB + OBRA + Fechaduras digitais

  // Atualizar display do total geral para incluir fechaduras digitais
  var _osaTotalEl = document.getElementById('osa-total-geral');
  if(_osaTotalEl){
    _osaTotalEl.textContent='R$ '+totalParaFab.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  if(!window._syncingAcess){
    window._syncingAcess = true;
    // Acessórios: quantidades já multiplicadas por qP na geração
    _fabSetSysValue('acess', totalParaFab);
    if(typeof syncFabPerfisTotal === 'function') syncFabPerfisTotal();
    if(typeof calc === 'function') calc();
    window._syncingAcess = false;
  }

  // Acessórios do fixo agora aparecem dentro do grupo FABRICAÇÃO (mesclados)
  // A seção separada foi removida — fixoAcessRows são adicionados via _calcAcessoriosOS
  var fixoSecEl = document.getElementById('osa-fixo-section');
  if(fixoSecEl){ fixoSecEl.innerHTML=''; fixoSecEl.style.display='none'; }

  return totalGeral;
}


function _updatePesoAcessorios(){
  if(window._syncingAcess) return; // guard against recursion from _renderOSAcess → calc → here
  if(!window._osGeradoUmaVez) return; // só atualiza se OS já foi gerada
  var d = window._lastOSData;
  if(!d) return;

  // ★ Felipe 23/04: detectar rev-only. Antes, calc() chamava essa função
  //   que gerava acessRows completos (parafusos, vedações, isolamento, etc)
  //   via _calcAcessoriosAllItems e sobrescrevia meu render de 3 linhas
  //   (fita 12mm, Dowsil, Primer) feito em _gerarOSRevestimentoOnly.
  var _temPortaFixoUp = (window._orcItens||[]).some(function(it){
    return it.tipo==='porta_pivotante' || it.tipo==='porta_interna' || it.tipo==='fixo';
  });
  var _temRevUp = (window._orcItens||[]).some(function(it){
    return it.tipo==='revestimento' && (it.largura||0)>0 && (it.altura||0)>0;
  });
  if(!_temPortaFixoUp && _temRevUp){
    if(typeof window._revCalcAcessoriosGlobal==='function'){
      var _revRows = window._revCalcAcessoriosGlobal();
      _renderOSAcess(d, _revRows, null);
    }
    return;
  }

  // Recalculate accessories with updated weight (chapas may have changed)
  var nFolhas = parseInt((document.getElementById('folhas-porta')||{value:1}).value)||1;
  var sis = (d && d.sis) || (document.getElementById('prod-sistema')||{value:''}).value || 'PA006';
  var acessRows = _calcAcessoriosAllItems(d, sis);
  var _qPUpAc=1; // _calcAcessoriosAllItems já multiplica internamente
  var _qPVeda=window._mpItens&&window._mpItens.length>0?window._mpItens.reduce(function(s,it){return s+(parseInt(it._qtd||it['qtd-portas'])||1);},0):(window._qPOS||parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1);
  var vedaInfo = d.vedaSize ? {qty:d.vedaQty*_qPVeda, code:d.vedaCode, size:d.vedaSize} : null;
  _renderOSAcess(d, acessRows, vedaInfo);
}

/* ══════════════════════════════════════════════════════
   IMPRIMIR ACESSÓRIOS
   ══════════════════════════════════════════════════════ */
function imprimirAcessorios(){
  var content = document.getElementById('osa-content');
  var total   = document.getElementById('osa-total-wrap');
  if(!content) return;
  var win = window.open('','','width=900,height=700');
  var cliente = (document.getElementById('cliente')||{value:''}).value||'—';
  var agp     = (document.getElementById('num-agp')||{value:''}).value||'';
  var atp     = (document.getElementById('num-atp')||{value:''}).value||'';
  var logoSrc = '';
  var mainLogo = document.querySelector('.header-brand img');
  if(mainLogo) logoSrc = mainLogo.src;
  win.document.write('<html><head><title>Acessórios — '+agp+'</title>');
  win.document.write('<style>body{font-family:Montserrat,Arial,sans-serif;font-size:11px;color:#222;padding:20px;margin:0}');
  win.document.write('table{width:100%;border-collapse:collapse}td,th{padding:4px 8px;border:0.5px solid #ddd}');
  win.document.write('.logo-hdr{display:flex;align-items:center;gap:14px;padding:10px 0;margin-bottom:10px;border-bottom:2px solid #003144}');
  win.document.write('.logo-hdr img{height:50px}.logo-hdr .nm{font-size:13px;font-weight:800;color:#003144;letter-spacing:.04em}.logo-hdr .inf{font-size:10px;color:#003144}');
  win.document.write('.hd{background:#1a3a4a;color:#fff;padding:12px 16px;border-radius:6px;margin-bottom:14px}');
  win.document.write('.hd h2{margin:0;font-size:14px;letter-spacing:.04em}.hd p{margin:4px 0 0;font-size:10px;opacity:.7}');
  win.document.write('.tot{background:#f0f4f8;padding:10px 16px;border-radius:6px;margin-top:12px;display:flex;justify-content:space-between;font-weight:700}');
  win.document.write('@media print{body{padding:10px}}</style></head><body>');
  if(logoSrc) win.document.write('<div class="logo-hdr"><img src="'+logoSrc+'" alt="Projetta"><div><div class="nm">PROJETTA PORTAS EXCLUSIVAS LTDA</div><div class="inf">CNPJ 35.582.302/0001-08 · Av. dos Siquierolis, 51 — Bairro N. Sra. das Graças · CEP 38401-708</div></div></div>');
  win.document.write('<div class="hd"><h2>PROJETTA — Lista de Acessórios</h2><p>Cliente: '+cliente+' &nbsp;|&nbsp; AGP: '+agp+' &nbsp;|&nbsp; ATP: '+atp+'</p></div>');
  win.document.write(content.innerHTML);
  if(total) win.document.write('<div class="tot">'+total.innerHTML+'</div>');
  win.document.write('<div style="margin-top:12px;text-align:center" class="noprint"><button onclick="window.print()" style="padding:10px 24px;background:#1a5276;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer">🖨 Imprimir</button></div>');
  win.document.write('<style>.noprint{}@media print{.noprint{display:none!important}}</style>');
  win.document.write('</body></html>');
  win.document.close();
}

/* ══════════════════════════════════════════════════════
   ACESSÓRIOS MANUAIS (do cadastro COMP_DB)
   ══════════════════════════════════════════════════════ */
var _manualAcessCount = 0;

function _populateManualAcessSelect(){
  var sel = document.getElementById('osa-manual-sel');
  if(!sel) return;
  var savedP={};
  try{var s=localStorage.getItem('projetta_comp_precos');if(s)savedP=JSON.parse(s);}catch(e){}
  var html='<option value="">— Selecionar acessório do cadastro —</option>';
  COMP_DB.forEach(function(item){
    var preco = savedP[item.c]!==undefined ? savedP[item.c] : item.p;
    var precoStr = preco>0 ? ' | R$'+preco.toFixed(2) : '';
    html+='<option value="'+item.c+'" data-preco="'+preco+'">'+item.c+' · '+item.d.substring(0,45)+precoStr+'</option>';
  });
  sel.innerHTML=html;
}

function _addManualAcessFromDB(){
  var sel = document.getElementById('osa-manual-sel');
  if(!sel||!sel.value){ alert('Selecione um item do cadastro.'); return; }
  var code = sel.value;
  var opt  = sel.options[sel.selectedIndex];
  var preco = parseFloat(opt.getAttribute('data-preco'))||0;
  var item = null;
  for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===code){item=COMP_DB[i];break;}}
  if(!item) return;

  _manualAcessCount++;
  var id = 'osa-m-' + _manualAcessCount;
  var tbody = document.getElementById('osa-manual-tbody');
  var empty = document.getElementById('osa-manual-empty');
  if(empty) empty.style.display = 'none';
  var totalEl = document.getElementById('osa-manual-total');
  if(totalEl) totalEl.style.display = '';

  var tr = document.createElement('tr');
  tr.id = id;
  tr.setAttribute('data-code',code);
  tr.setAttribute('data-preco',preco);
  tr.innerHTML =
    '<td style="padding:3px 4px;border-bottom:1px solid #eee;text-align:center"><input type="number" id="'+id+'-q" value="1" min="1" style="width:38px;padding:4px;border:1px solid #c9c6bf;border-radius:5px;text-align:center;font-size:11px;font-weight:700" oninput="_calcManualAcessTotals()"></td>'
   +'<td style="padding:3px 6px;border-bottom:1px solid #eee;font-size:10px;font-weight:600;color:#1a5276;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+code+'</td>'
   +'<td style="padding:3px 6px;border-bottom:1px solid #eee;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+item.d+'">'+item.d+'</td>'
   +'<td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right;font-size:10px">'+(preco>0?'R$ '+preco.toFixed(2):'—')+'</td>'
   +'<td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700;font-size:10px" id="'+id+'-t">'+(preco>0?'R$ '+preco.toFixed(2):'—')+'</td>'
   +'<td style="padding:3px 2px;border-bottom:1px solid #eee;text-align:center"><button onclick="_removeManualAcess(\''+id+'\')" style="border:none;background:none;color:#b71c1c;font-size:14px;cursor:pointer;padding:0 2px">×</button></td>';
  tbody.appendChild(tr);
  sel.selectedIndex = 0;
  _calcManualAcessTotals();
}

function _removeManualAcess(id){
  var tr = document.getElementById(id);
  if(tr) tr.remove();
  var tbody = document.getElementById('osa-manual-tbody');
  var empty = document.getElementById('osa-manual-empty');
  var totalEl = document.getElementById('osa-manual-total');
  if(tbody && tbody.children.length === 0){
    if(empty) empty.style.display = '';
    if(totalEl) totalEl.style.display = 'none';
  }
  _calcManualAcessTotals();
}

function _calcManualAcessTotals(){
  var tbody = document.getElementById('osa-manual-tbody');
  if(!tbody) return;
  var grandTotal = 0;
  for(var i=0;i<tbody.children.length;i++){
    var tr = tbody.children[i];
    var id = tr.id;
    var q = parseFloat(document.getElementById(id+'-q').value)||0;
    var p = parseFloat(tr.getAttribute('data-preco'))||0;
    var t = q * p;
    grandTotal += t;
    var tEl = document.getElementById(id+'-t');
    if(tEl) tEl.textContent = t>0 ? 'R$ '+t.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  }
  var valEl = document.getElementById('osa-manual-total-val');
  if(valEl) valEl.textContent = 'R$ '+grandTotal.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

/* ══════════════════════════════════════════════════════
   PERFIS MANUAIS (Levantamento de Perfis — do cadastro PERFIS_DB)
   ══════════════════════════════════════════════════════ */
var _manualPerfilCount = 0;

function _populateManualPerfilSelect(){
  var sel = document.getElementById('osp-manual-sel');
  if(!sel) return;
  var html='<option value="">— Selecionar perfil do cadastro —</option>';
  PERFIS_DB.forEach(function(p){
    html+='<option value="'+p.c+'" data-kg="'+p.kg+'" data-desc="'+p.d+'" data-forn="'+p.f+'">'+p.c+' · '+p.d.substring(0,40)+' ('+p.kg.toFixed(3)+' kg/m)</option>';
  });
  sel.innerHTML=html;
}

function _addManualPerfilFromDB(){
  var sel = document.getElementById('osp-manual-sel');
  if(!sel||!sel.value){ alert('Selecione um perfil do cadastro.'); return; }
  var corte = parseInt(document.getElementById('osp-manual-corte').value)||0;
  if(corte<=0){ alert('Informe o corte em mm.'); return; }
  var qty = parseInt(document.getElementById('osp-manual-qty').value)||1;
  var opt = sel.options[sel.selectedIndex];
  var code = sel.value;
  var kg   = parseFloat(opt.getAttribute('data-kg'))||0;
  var desc = opt.getAttribute('data-desc')||'';
  var peso = qty * (corte/1000) * kg;

  _manualPerfilCount++;
  var id = 'osp-m-' + _manualPerfilCount;
  var tbody = document.getElementById('osp-manual-tbody');
  var empty = document.getElementById('osp-manual-empty');
  if(empty) empty.style.display = 'none';

  var tr = document.createElement('tr');
  tr.id = id;
  tr.setAttribute('data-kg', kg);
  tr.innerHTML =
    '<td style="padding:3px 4px;border-bottom:1px solid #eee;text-align:center"><input type="number" id="'+id+'-q" value="'+qty+'" min="1" style="width:38px;padding:4px;border:1px solid #c9c6bf;border-radius:5px;text-align:center;font-size:11px;font-weight:700" oninput="_calcManualPerfilRow(\''+id+'\')"></td>'
   +'<td style="padding:3px 6px;border-bottom:1px solid #eee;font-size:10px;font-weight:600;color:#1a5276;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+code+'</td>'
   +'<td style="padding:3px 6px;border-bottom:1px solid #eee;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+desc+'">'+desc+'</td>'
   +'<td style="padding:3px 4px;border-bottom:1px solid #eee;text-align:right"><input type="number" id="'+id+'-mm" value="'+corte+'" min="1" step="1" style="width:62px;padding:4px;border:1px solid #c9c6bf;border-radius:5px;text-align:right;font-size:11px;font-weight:700" oninput="_calcManualPerfilRow(\''+id+'\')"></td>'
   +'<td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right;font-size:10px;color:#888">'+kg.toFixed(3)+'</td>'
   +'<td style="padding:3px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700;font-size:10px" id="'+id+'-p">'+peso.toFixed(3).replace('.',',')+'</td>'
   +'<td style="padding:3px 2px;border-bottom:1px solid #eee;text-align:center"><button onclick="_removeManualPerfil(\''+id+'\')" style="border:none;background:none;color:#b71c1c;font-size:14px;cursor:pointer;padding:0 2px">×</button></td>';
  tbody.appendChild(tr);
  sel.selectedIndex = 0;
  document.getElementById('osp-manual-corte').value='';
  document.getElementById('osp-manual-qty').value='1';
}

function _removeManualPerfil(id){
  var tr = document.getElementById(id);
  if(tr) tr.remove();
  var tbody = document.getElementById('osp-manual-tbody');
  var empty = document.getElementById('osp-manual-empty');
  if(tbody && tbody.children.length === 0 && empty) empty.style.display = '';
}

function _calcManualPerfilRow(id){
  var q  = parseFloat(document.getElementById(id+'-q').value)||0;
  var mm = parseFloat(document.getElementById(id+'-mm').value)||0;
  var tr = document.getElementById(id);
  var kg = parseFloat(tr.getAttribute('data-kg'))||0;
  var peso = q * (mm/1000) * kg;
  document.getElementById(id+'-p').textContent = peso.toFixed(3).replace('.',',');
}

/* ══ END MODULE: OS_ACESSORIOS ══ */

/* Felipe 28/04: bloco MODULE CUSTO_REAL (NFE) ELIMINADO PARA SEMPRE */
