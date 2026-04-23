/**
 * 02-orcamento_calc.js
 * Module: ORCAMENTO_CALC
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: ORCAMENTO_CALC ══ */
function sumBlocks(type,max){
  let tot=0;
  for(let i=1;i<=max;i++){
    if(!$(type+'-blk-'+i)) continue;
    const sel=$(type+'-sel-'+i);
    const qty=parseFloat($(type+'-qty-'+i).value)||0;
    const [pS,aS]=sel.value.split('|');
    const p=parseFloat(pS)||0,a=parseFloat(aS)||0;
    const sub=p*qty; tot+=sub;
    const inf=$(type+'-inf-'+i);
    if(inf){
      const sp=inf.querySelectorAll('span');
      if(p>0){
        sp[0].textContent='R$ '+p.toLocaleString('pt-BR',{minimumFractionDigits:2})+'/chapa';
        sp[1].textContent=a+' m²/chapa';
        sp[2].textContent=qty>0?'Subtotal: '+brl(sub):'';
      } else {sp[0].textContent='—';sp[1].textContent='';sp[2].textContent='';}
    }
  }
  return tot;
}

/* ══ MAIN CALC ════════════════════════════════════════════ */
function calc(){
  // Se snapshot congelado, não recalcular
  // Segurança: se não tem orçamento ativo, desbloquear (lock fantasma de sessão anterior)
  if(window._snapshotLock && !currentId && !window._pendingRevision){
    window._snapshotLock=false;
    window._orcLocked=false;
    try{_setOrcLock(false);}catch(e){}
  }
  if(window._snapshotLock) return;
  var W=n('largura')/1000,H=n('altura')/1000,m2=W*H;
  // ★ Felipe 22/04 v4 (fix revestimento-only): quando o orcamento tem SO
  //   itens revestimento (sem porta/fixo), os inputs gerais 'largura' e
  //   'altura' (que sao da porta) ficam vazios → W=H=0 e o guard abaixo
  //   zerava tudo e retornava. Resultado: aba Levantamento populava
  //   11 chapas ACM = R$ 18.085,40 corretamente, mas 'RESULTADO — PORTA'
  //   ficava R$ 0,00 porque calc() nunca consolidava subFab/Tab/Fat.
  //
  //   Detectar cenario revestimento-only: usar somatorio de areas dos
  //   revestimentos como m2 de referencia e setar W/H ficticios (sqrt(m2))
  //   pra evitar divisoes por zero a jusante. subAcm vai vir do fab-acm-tbody
  //   ja populado pelo planificador → subFab = subAcm → markup/impostos rodam
  //   normalmente sobre esse valor.
  var _revOnly=false;
  if(W<=0||H<=0){
    if(window._orcItens && window._orcItens.length>0){
      var _revsChk=window._orcItens.filter(function(it){return it.tipo==='revestimento' && (it.largura||0)>0 && (it.altura||0)>0;});
      var _hasPortaOuFixo=window._orcItens.some(function(it){return it.tipo==='porta_pivotante' || it.tipo==='porta_interna' || it.tipo==='fixo';});
      if(_revsChk.length>0 && !_hasPortaOuFixo){
        _revOnly=true;
        m2=_revsChk.reduce(function(s,it){return s+((it.largura||0)*(it.altura||0)*(it.qtd||1)/1e6);},0);
        if(m2>0){ W=Math.sqrt(m2); H=Math.sqrt(m2); }
      }
    }
  }
  // Guard: sem dimensões E sem revestimentos → zerar resultados e sair
  if((W<=0||H<=0) && !_revOnly){
    var zeros=['m-custo-porta','m-tab-porta','m-fat-porta','m-custo','m-tab','m-fat','d-tab','d-tab-porta','d-desc-val',
               'd-fat','d-imp','d-rep','d-rt','d-gest','d-custo','d-lb','d-irpj','d-ll',
               'r-fab','r-inst','sub-sal','r-diesel','sub-hotel','sub-alim','r-inst'];
    zeros.forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='R$ 0';});
    var dashes=['m-custo-m2','m-tab-porta-m2','m-fat-porta-m2','m-tab-m2','m-fat-m2','r-m2'];
    dashes.forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='—';});
    ['m-mkp-porta','pct-mb-porta','pct-ml-porta','m-mkp','pct-mb','pct-ml'].forEach(function(id){
      var el=document.getElementById(id);if(el)el.textContent='—';
    });
    return; // não calcular nada sem dimensões
  }
  // Exportar flag pra outras funcoes detectarem revestimento-only
  window._revOnlyMode=_revOnly;
  if(!window._osGeradoUmaVez){
    ['h-portal','h-quadro','h-corte','h-colagem','h-conf'].forEach(function(id){
      var el=document.getElementById(id);
      if(el&&el.dataset.manual!=='1'){ el.value=''; el.dataset.auto=''; }
      var lbl=document.getElementById(id+'-auto');
      if(lbl) lbl.textContent='';
    });
  }
  $('r-m2').textContent=m2>0?(Math.round(m2*100)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' m²':'—';
  var m2Fixos=0; var tfEl=document.getElementById('tem-fixo');
  if(tfEl&&tfEl.checked){
    document.querySelectorAll('.fixo-blk').forEach(function(el){
      var lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
      var af=parseFloat((el.querySelector('.fixo-alt') ||{value:0}).value)||0;
      var ld=parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
      var m2f=(lf/1000)*(af/1000)*ld; m2Fixos+=m2f;
      var idN=el.id.replace('fixo-blk-','');
      var m2El=document.getElementById('fixo-m2-'+idN);
      if(m2El) m2El.textContent=m2f>0?m2f.toFixed(3)+' m²':'—';
    });
  }
  var m2T=m2+m2Fixos,rm2t=document.getElementById('r-m2-total');
  if(rm2t)rm2t.textContent=m2T>0?m2T.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' m² (porta: '+m2.toFixed(2)+' + fixos: '+m2Fixos.toFixed(2)+')':'—';

  /* FABRICAÇÃO */
  var _qPcalc;
  if(window._mpItens && window._mpItens.length > 0){
    _qPcalc=window._mpItens.reduce(function(s,it){return s+it.qtd;},0);
  } else {
    _qPcalc=parseInt($('qtd-portas').value)||1;
  }
  // Chapas: NÃO multiplicar por qP — planificador já calculou com todas as peças
  var subAcm=sumBlocks('acm',aC);
  var subAlu=sumBlocks('alu',lC);

  // ★ FALLBACK CRÍTICO (Felipe 20/04 — bug "prejuízo" Resumo/Custo Total):
  //   Se sumBlocks retornou 0 (bloco escondido alu-sel-1/acm-sel-1 não foi
  //   sincronizado corretamente com plan-*-cor), ler direto de
  //   plan-*-cor × plan-*-qty. Mesma fonte que _updateFabChapaResumo usa
  //   pra tabela do CUSTO DE FABRICAÇÃO — sempre consistente.
  //   Sem esse fallback, subFab (=subAcm+subAlu+perfis+subMO) subestima,
  //   Tab/Fat são calculados pra menos e a venda sai com prejuízo.
  if(subAlu===0){
    var _paCor=document.getElementById('plan-alu-cor');
    var _paQty=document.getElementById('plan-alu-qty');
    if(_paCor && _paCor.value && _paQty){
      var _ppA=parseFloat((_paCor.value.split('|')[0]))||0;
      var _pqA=parseInt(_paQty.value)||0;
      if(_ppA>0 && _pqA>0){
        subAlu = _ppA*_pqA;
        // Alinhar bloco escondido para próximas leituras (evita divergências)
        var _hs=document.getElementById('alu-sel-1');
        var _hq=document.getElementById('alu-qty-1');
        if(_hs && _hs.options.length>1) _hs.value=_paCor.value;
        if(_hq) _hq.value=_pqA;
      }
    }
  }
  if(subAcm===0){
    // Multi-cor: somar de cada bloco (cada cor tem preço e qtd próprios)
    if(window._PLN_COLOR_KEYS && window._PLN_COLOR_KEYS.length>=2){
      var _colorKeysCalc = window._PLN_COLOR_KEYS;
      var _byColorCalc = window._PLN_RES_BY_COLOR || {};
      _colorKeysCalc.forEach(function(ck, idx){
        var res = _byColorCalc[ck];
        var qBlk = res ? (res.numSheets||0) : 0;
        var selBlk = document.getElementById('acm-sel-'+(idx+1));
        if(selBlk && selBlk.value && qBlk>0){
          var pBlk = parseFloat((selBlk.value.split('|')[0]))||0;
          subAcm += pBlk*qBlk;
        }
      });
    } else {
      // Single-cor: plan-acm-cor × plan-acm-qty
      var _pcCor=document.getElementById('plan-acm-cor');
      var _pcQty=document.getElementById('plan-acm-qty');
      if(_pcCor && _pcCor.value && _pcQty){
        var _ppC=parseFloat((_pcCor.value.split('|')[0]))||0;
        var _pqC=parseInt(_pcQty.value)||0;
        if(_ppC>0 && _pqC>0){
          subAcm = _ppC*_pqC;
          var _hsC=document.getElementById('acm-sel-1');
          var _hqC=document.getElementById('acm-qty-1');
          if(_hsC && _hsC.options.length>1) _hsC.value=_pcCor.value;
          if(_hqC) _hqC.value=_pqC;
        }
      }
    }
  }
  // ★ Felipe 22/04 v6 (FALLBACK FINAL): se ainda subAcm===0 mas fab-acm-tbody
  //   ja tem linhas renderizadas (Custo Fabricacao > Chapas ACM mostra qtd
  //   e subtotal na tela), ler direto dali. Isso cobre o cenario revestimento-
  //   only onde plan-acm-cor/qty pode nao estar sincronizado mas o
  //   _updateFabChapaResumo ja populou a tabela visivel. Evita R$ 0,00 no
  //   RESULTADO quando a tabela de custo mostra valor real.
  if(subAcm===0){
    var _acmTb=document.getElementById('fab-acm-tbody');
    if(_acmTb && _acmTb.children.length>0){
      for(var _ri=0; _ri<_acmTb.children.length; _ri++){
        var _row=_acmTb.children[_ri];
        var _cells=_row.querySelectorAll('td');
        if(_cells.length>=4){
          // Subtotal na ultima celula, formato "R$ 21.702,48"
          var _subTxt=(_cells[_cells.length-1].textContent||'').trim();
          var _subVal=parseFloat(_subTxt.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;
          if(_subVal>0) subAcm+=_subVal;
        }
      }
      if(subAcm>0 && typeof console!=='undefined') console.log('[calc] subAcm fallback fab-acm-tbody:',subAcm);
    }
  }
  const fabMatPerf=n('fab-mat-perfis')||0;
  const fabPintura=n('fab-custo-pintura')||0;
  const fabAcess=n('fab-custo-acess')||0;
  const fabExtra=n('fab-custo-extra')||0;
  const perfis=fabMatPerf+fabPintura+fabAcess+fabExtra;
  // Sync hidden #perfis for compatibility
  var _ph=document.getElementById('perfis'); if(_ph) _ph.value=perfis;
  
  // ══ AUTO-CALC PORTAL, QUADRO e COLAGEM ══════════════════════════════
  var _altMM = n('altura'); // altura em mm
  var _nFol  = parseInt(($('folhas-porta')||{value:'1'}).value)||1;
  var _modSel= ($('modelo')||$('plan-modelo')||{value:''}).value||'';
  var _isRip = ['08','15','20','21'].indexOf(_modSel)>=0;
  // _isCava: verificar pelo nome do modelo (contém "cava") OU pelo número
  var _modNome = '';
  var _modEl2 = document.getElementById('carac-modelo');
  if(_modEl2 && _modEl2.selectedIndex >= 0) _modNome = (_modEl2.options[_modEl2.selectedIndex]||{text:''}).text.toLowerCase();
  var _isCava = _modNome.indexOf('cava') >= 0 || ['01','02','03','04','05','06','07','08','09','19','22','24'].indexOf(_modSel)>=0;

  // Portal: horas por faixa de altura (1 folha) + 3h se 2 folhas
  function _horasPortal(altMM, nFol){
    var h = altMM<=2800?5 : altMM<=3800?7 : altMM<=6500?9 : 14;
    return nFol===2 ? h+3 : h;
  }
  // Quadro: horas por faixa de altura × 2 se 2 folhas
  function _horasQuadro(altMM, nFol){
    var h = altMM<=2800?5 : altMM<=3800?7 : altMM<=6500?9 : 14;
    return nFol===2 ? h*2 : h;
  }
  // Colagem: dias por tipo de porta
  function _diasColagem(altMM, nFol, isCava, isRip){
    var d;
    if(isCava){
      // Porta cava: faixas de altura
      d = altMM<=2800?2 : altMM<=4000?3 : 4;
    } else {
      // Porta lisa: 1 dia menos que cava equivalente
      var dCava = altMM<=2800?2 : altMM<=4000?3 : 4;
      d = Math.max(1, dCava - 1);
    }
    // Ripado: +1d até 4m, +2d acima de 4m
    if(isRip){
      d += altMM <= 4000 ? 1 : 2;
    }
    d = Math.max(2, d); // mínimo 2 dias de colagem sempre
    return nFol===2 ? d*2 : d;
  }

  // ── Qtd portas para multiplicar horas de fabricação ──
  var _qPh;
  if(window._mpItens && window._mpItens.length > 0){
    _qPh=window._mpItens.reduce(function(s,it){return s+(parseInt(it._qtd||it['qtd-portas'])||1);},0);
  } else {
    _qPh=parseInt($('qtd-portas').value)||1;
  }
  var _qPnote=_qPh>1?' × '+_qPh+'p':'';

  // ── Multi-porta: calcular horas por porta e somar ──
  if(window._mpItens && window._mpItens.length > 0 && window._osGeradoUmaVez){
    var _hPortalTotal=0,_hQuadroTotal=0,_hColagemTotal=0,_hConfTotal=0;
    var _hPortalDetail=[],_hQuadroDetail=[],_hColagemDetail=[],_hConfDetail=[];
    var _mpAcmSel=document.getElementById('plan-acm-cor');
    var _mpAcmTxt=_mpAcmSel&&_mpAcmSel.selectedIndex>0?(_mpAcmSel.options[_mpAcmSel.selectedIndex].text||'').toUpperCase():'';
    var _isAlusense=_mpAcmTxt.indexOf('AS')===0||_mpAcmTxt.indexOf('ALUSENSE')>=0;
    window._mpItens.forEach(function(mpIt,di){
      var iA=parseFloat(mpIt._altura||mpIt['altura'])||0;
      var iF=parseInt(mpIt._folhas||mpIt['folhas-porta'])||1;
      var iQ=parseInt(mpIt._qtd||mpIt['qtd-portas'])||1;
      var iMod=mpIt._modelo||mpIt['carac-modelo']||'01';
      var iModNome=(mpIt._modeloTxt||'').toLowerCase();
      var iCava=iModNome.indexOf('cava')>=0||['01','02','03','04','05','06','07','08','09','19','22','24'].indexOf(iMod)>=0;
      var iRip=['08','15','20','21'].indexOf(iMod)>=0;
      var tag='P'+(di+1);
      // Portal
      var hp=_horasPortal(iA,iF)*iQ;_hPortalTotal+=hp;
      _hPortalDetail.push(tag+':'+hp+'h');
      // Quadro
      var hq=_horasQuadro(iA,iF)*iQ;_hQuadroTotal+=hq;
      _hQuadroDetail.push(tag+':'+hq+'h');
      // Colagem
      var cd=_diasColagem(iA,iF,iCava,iRip);
      if(iMod==='06') cd+=1; // Modelo 06: +1d frisos
      if(_isAlusense) cd+=1; // Alusense: +1d secagem
      var hc=cd*9*iQ;_hColagemTotal+=hc;
      _hColagemDetail.push(tag+':'+cd+'d×9h='+(cd*9)+'h');
      // Conf
      var cfB=iA<6000?3:4;
      var hcf=(iF===2?cfB*2:cfB)*iQ;_hConfTotal+=hcf;
      _hConfDetail.push(tag+':'+hcf+'h');
    });
    var hPortalEl=$('h-portal');
    if(hPortalEl) _setHoraAuto('h-portal',_hPortalTotal,'h-portal-auto','(auto: '+_hPortalDetail.join(' + ')+')');
    var hQuadroEl=$('h-quadro');
    if(hQuadroEl) _setHoraAuto('h-quadro',_hQuadroTotal,'h-quadro-auto','(auto: '+_hQuadroDetail.join(' + ')+')');
    var hColagemEl=$('h-colagem');
    if(hColagemEl)
      _setHoraAuto('h-colagem',_hColagemTotal,'h-colagem-auto','(auto: '+_hColagemDetail.join(' + ')+')');
    var hConfEl=$('h-conf');
    if(hConfEl) _setHoraAuto('h-conf',_hConfTotal,'h-conf-auto','(auto: '+_hConfDetail.join(' + ')+')');
  } else {
  // Aplicar Portal × qP (cada porta precisa ser montada)
  var hPortalEl=$('h-portal');
  if(hPortalEl && _altMM>0 && window._osGeradoUmaVez){
    var _pAuto=_horasPortal(_altMM,_nFol)*_qPh;
    _setHoraAuto('h-portal',_pAuto,'h-portal-auto',_qPh>1?'(auto: '+_horasPortal(_altMM,_nFol)+'h × '+_qPh+'p = '+_pAuto+'h)':'(auto: '+_pAuto+'h)');
  }
  // Aplicar Quadro × qP
  var hQuadroEl=$('h-quadro');
  if(hQuadroEl && _altMM>0 && window._osGeradoUmaVez){
    var _qAuto=_horasQuadro(_altMM,_nFol)*_qPh;
    _setHoraAuto('h-quadro',_qAuto,'h-quadro-auto',_qPh>1?'(auto: '+_horasQuadro(_altMM,_nFol)+'h × '+_qPh+'p = '+_qAuto+'h)':'(auto: '+_qAuto+'h)');
  }
  // Aplicar Colagem × qP (9h por dia × qP)
  var hColagemEl=$('h-colagem');
  if(hColagemEl && _altMM>0 && window._osGeradoUmaVez && (hColagemEl.value==='' || hColagemEl.dataset.auto==='1' || hColagemEl.value==='0')){
    var _cDias=_diasColagem(_altMM,_nFol,_isCava,_isRip);
    // Modelo 06 (Frisos Horizontais): +1 dia de colagem por causa das junções
    if(_modSel==='06') _cDias+=1;
    // Alusense: +1 dia de colagem (secagem mais lenta)
    var _acmSel=document.getElementById('plan-acm-cor');
    var _acmTxt=_acmSel&&_acmSel.selectedIndex>0?(_acmSel.options[_acmSel.selectedIndex].text||'').toUpperCase():'';
    var _isAlusense=_acmTxt.indexOf('AS')===0||_acmTxt.indexOf('ALUSENSE')>=0;
    if(_isAlusense) _cDias+=1;
    var _cHoras=_cDias*9*_qPh;
    var _cTipo=_isCava?'cava':(_isRip?'ripado':'lisa');
    var _cExtra=(_modSel==='06'?'+1d friso':'') + (_isAlusense?'+1d alusense':'');
    _setHoraAuto('h-colagem',_cHoras>0?_cHoras:'','h-colagem-auto',_cHoras>0?'(auto '+_cTipo+(_cExtra?' '+_cExtra:'')+': '+_cDias+'d×9h×'+_qPh+'p='+_cHoras+'h)':'');
  }
  // Aplicar Conf & Bem × qP (conferência e embalagem)
  var hConfEl=$('h-conf');
  if(hConfEl && _altMM>0 && window._osGeradoUmaVez){
    var _cfBase = _altMM < 6000 ? 3 : 4;
    var _cfPer = _nFol === 2 ? _cfBase * 2 : _cfBase;
    var _cfAuto = _cfPer*_qPh;
    _setHoraAuto('h-conf',_cfAuto,'h-conf-auto',_qPh>1?'(auto: '+_cfPer+'h × '+_qPh+'p = '+_cfAuto+'h)':'(auto: '+_cfAuto+'h)');
  }
  } // end single-door
  // ══════════════════════════════════════════════════════════════════════

  // Auto-calc Corte e usinagem: aguardar planUpd (1s) depois calcular
  // chapas + 1 (normal) | chapas + 2 (ripado)
  var hCorteEl=$('h-corte');
  if(hCorteEl && (hCorteEl.value==='' || hCorteEl.dataset.auto==='1' || hCorteEl.value==='0')){
  // Corte calculado em gerarCustoTotal() com timing correto
  } else {
    var corteLabel=$('h-corte-auto');if(corteLabel)corteLabel.textContent='(manual)';
  }
  
  const totalH=(n('h-portal')+n('h-quadro')+n('h-corte')+n('h-colagem')+n('h-conf'))*2;
  const cH=n('custo-hora');
  const subMO=totalH*cH;
  const subFab=subAcm+subAlu+perfis+subMO;

  $('r-horas').textContent=totalH+' h';
  // ★ Felipe 22/04 v5 (fix revestimento-only RESULTADO): _osGeradoUmaVez
  //   só vira true ao clicar "Gerar OS" (Ordem de Servico de porta).
  //   Revestimento nao tem OS, entao a flag nunca vira true e subFab/Tab/Fat
  //   ficavam todos R$ 0,00 mesmo com R$ 18.085,40 em chapas calculadas.
  //   Fix: _osOK inclui _revOnly — pra revestimento, exibir resultados
  //   direto sem precisar de "Gerar OS".
  var _osOK = window._osGeradoUmaVez || _revOnly;
  var _brlOS=function(v){return _osOK?brl(v):'—';};
  $('sub-acm').textContent=_brlOS(subAcm);
  $('sub-alu').textContent=_brlOS(subAlu);
  $('sub-perf-mat').textContent=_brlOS(fabMatPerf);
  $('sub-perf-pin').textContent=_brlOS(fabPintura);
  $('sub-perf-acess').textContent=_brlOS(fabAcess);
  var _spExt=$('sub-perf-extra'); if(_spExt) _spExt.textContent=_brlOS(fabExtra);
  $('sub-perf').textContent=_brlOS(perfis);
  $('sub-mo').textContent=_brlOS(subMO);
  $('sub-h').textContent=totalH;
  $('sub-ch').textContent=cH;
  $('r-fab').textContent=_osOK?brl(subFab):'—';

  /* INSTALAÇÃO */
  // Auto-calc Dias de instalação — só quando OS foi gerada e altura preenchida
  var _diasEl=$('dias'), _pessoasEl=$('pessoas');
  var _altMM2=n('altura'), _nFol2=parseInt(($('folhas-porta')||{value:'1'}).value)||1;
  if(_diasEl && (_diasEl.value==='' || _diasEl.dataset.auto==='1')){
    if(window._mpItens && window._mpItens.length > 0){
      // Multi-porta: dias por porta e somar
      var _dTotal=0,_dDetail=[];
      window._mpItens.forEach(function(mpIt,di){
        var iA=parseFloat(mpIt._altura||mpIt['altura'])||0;
        var iF=parseInt(mpIt._folhas||mpIt['folhas-porta'])||1;
        var iQ=parseInt(mpIt._qtd||mpIt['qtd-portas'])||1;
        var dB=iA<=3800?1:iA<=5500?2:3;
        var dI=iF===2?dB+1:dB;
        _dTotal+=dI*iQ;
        _dDetail.push('P'+(di+1)+':'+dI+'d');
      });
      _diasEl.value=_dTotal;
      _diasEl.dataset.auto='1';
      var _dLbl=document.getElementById('dias-auto');
      if(_dLbl) _dLbl.textContent='(auto: '+_dDetail.join(' + ')+' = '+_dTotal+'d)';
    } else if(_altMM2>0){
      var _dBase = _altMM2<=3800?1 : _altMM2<=5500?2 : 3;
      var _dPerDoor = _nFol2===2 ? _dBase+1 : _dBase;
      var _dAuto = _dPerDoor * _qPh; // multiplicar por quantidade de portas
      _diasEl.value=_dAuto;
      _diasEl.dataset.auto='1';
      var _dLbl=document.getElementById('dias-auto');
      if(_dLbl) _dLbl.textContent=_qPh>1?'(auto: '+_dPerDoor+'d × '+_qPh+'p = '+_dAuto+'d)':'(auto: '+_dAuto+' dia'+(_dAuto>1?'s':'')+')';
    }
  }
  // Auto-calc Quantidade de pessoas — só quando OS foi gerada e altura preenchida
  var _maxAlt=_altMM2;
  if(window._mpItens&&window._mpItens.length>0){
    _maxAlt=0;window._mpItens.forEach(function(it){var a=parseFloat(it._altura||it['altura'])||0;if(a>_maxAlt)_maxAlt=a;});
  }
  if(_pessoasEl && _maxAlt>0 && (_pessoasEl.value==='' || _pessoasEl.dataset.auto==='1')){
    var _pNum = (window._mpItens&&window._mpItens.length>1) ? 3 : (_maxAlt>5500 ? 3 : 2);
    _pessoasEl.value=_pNum;
    _pessoasEl.dataset.auto='1';
    var _pLbl=document.getElementById('pessoas-auto');
    if(_pLbl) _pLbl.textContent='(auto: '+_pNum+' pessoas)';
  }
  // Auto-calc Qtd de carros: 2 quando pessoas > 5
  var _carrosEl=$('carros');
  if(_carrosEl && (_carrosEl.value==='' || _carrosEl.dataset.auto==='1')){
    var _pesAtual=parseInt(($('pessoas')||{value:'2'}).value)||2;
    var _carsAuto = _pesAtual>5 ? 2 : 1;
    _carrosEl.value=_carsAuto;
    _carrosEl.dataset.auto='1';
    var _carLbl=document.getElementById('carros-auto');
    if(_carLbl) _carLbl.textContent='(auto: '+_carsAuto+')';
  }
  // Alerta caminhão: largura > 2400mm
  var _larguraAlerta = n('largura');
  var _alertaCaminhao = document.getElementById('alerta-caminhao');
  if(_alertaCaminhao){
    _alertaCaminhao.style.display = _larguraAlerta > 2400 ? 'block' : 'none';
  }
  // Alerta andaime: altura > 3m (3000mm)
  var _alturaAlerta = n('altura');
  var _alertaAndaime = document.getElementById('alerta-andaime');
  if(_alertaAndaime){
    _alertaAndaime.style.display = _alturaAlerta > 3000 ? 'block' : 'none';
  }
  // Alerta munk: peso bruto > 500kg
  var _alertaMunk = document.getElementById('alerta-munk');
  if(_alertaMunk){
    var _pesoBrutoEl = document.getElementById('plan-peso-bruto');
    var _pesoBrutoVal = 0;
    if(_pesoBrutoEl){
      _pesoBrutoVal = parseFloat((_pesoBrutoEl.textContent||'0').replace(/[^\d.,]/g,'').replace(',','.')) || 0;
    }
    _alertaMunk.style.display = _pesoBrutoVal > 500 ? 'block' : 'none';
  }

  const diasInst=n('dias'),pessoas=n('pessoas'),diaria=n('diaria');
  const km=n('km'),carros=n('carros'),hotelDia=n('hotel-dia'),alimVal=n('alim');

  // Deslocamento: km=0 → sem viagem | ≤300=0,5 | 301-800=1 | 801-1300=1,5 | >1300=2
  let deslIda=0, deslVolta=0, deslDesc='';
  const deslOverride=$('desl-override')?parseFloat($('desl-override').value):NaN;
  if(!isNaN(deslOverride)&&deslOverride>=0){
    // Override manual
    const deslManual=deslOverride;
    deslIda=deslManual/2; deslVolta=deslManual/2;
    deslDesc='✏️ Manual: '+deslManual+' dias de deslocamento';
  } else if(km<=0){ deslIda=0; deslVolta=0; deslDesc='—'; }
  else if(km<=300){ deslIda=0.5; deslVolta=0.5; deslDesc=km+' km - 0,5 dia ida + 0,5 volta'; }
  else if(km<=800){ deslIda=1; deslVolta=1; deslDesc=km+' km - 1 dia ida + 1 volta'; }
  else if(km<=1300){ deslIda=1.5; deslVolta=1.5; deslDesc=km+' km - 1,5 dia ida + 1,5 volta'; }
  else{ deslIda=2; deslVolta=2; deslDesc=km+' km - 2 dias ida + 2 volta'; }
  const deslTotal=deslIda+deslVolta;
  const diasTotal=deslTotal+diasInst; // deslocamento + instalação

  // Atualizar badges do deslocamento
  if($('desl-badge')) $('desl-badge').textContent=deslTotal>0?deslTotal+' dias':'0 dias (sem deslocamento)';
  if($('desl-detail')) $('desl-detail').textContent=km>0?deslDesc:'informe a distância em km';
  if($('r-total-dias')) $('r-total-dias').textContent=diasTotal>0?diasTotal.toLocaleString('pt-BR')+' dias':'0 dias';

  // Custo: (deslocamento + instalação) × pessoas × diária
  const salarios=diasTotal*pessoas*diaria;
  const diesel=km>0?(km+50)*(1/8*7)*2*carros:0; // só calcula se km informado
  const noites=Math.max(diasTotal-1,0);
  const quartos=pessoas<=2?1:pessoas<=4?2:pessoas<=6?3:Math.ceil(pessoas/2);
  const hotel=noites*hotelDia*quartos;
  const alimentacao=diasTotal*pessoas*alimVal;

  // Descrição dos quartos e link Booking
  const hotRoomInfo=$('hotel-rooms-info');
  if(hotRoomInfo && pessoas>0 && noites>0){
    hotRoomInfo.style.display='';
    const roomDesc=$('hotel-rooms-desc');
    if(roomDesc){
      let desc='';
      if(quartos===1) desc=`${quartos} quarto (${pessoas} pessoa${pessoas>1?'s':''}) × ${noites} noite${noites>1?'s':''} × R$${hotelDia}/noite = ${brl(hotel)}`;
      else if(pessoas%2===0) desc=`${quartos} quartos (${quartos}× 2 pessoas) × ${noites} noite${noites>1?'s':''} × R$${hotelDia}/noite = ${brl(hotel)}`;
      else desc=`${quartos} quartos (${Math.floor(pessoas/2)}× duplo + 1× individual) × ${noites} noite${noites>1?'s':''} × R$${hotelDia}/noite = ${brl(hotel)}`;
      roomDesc.textContent=desc;
    }
    // Atualizar link Booking.com com cidade destino e quartos
    const bookLink=$('hotel-booking-link');
    const cidadeSpan=$('cep-cidade');
    if(bookLink && cidadeSpan && cidadeSpan.textContent){
      const cidadeText=cidadeSpan.textContent.replace(' - ','%2C+').replace(' ','+');
      bookLink.href='https://www.booking.com/search.html?ss='+cidadeText+
        '&no_rooms='+quartos+'&group_adults='+Math.min(pessoas,quartos*2)+
        '&selected_currency=BRL&lang=pt-br';
    }
  } else if(hotRoomInfo){
    hotRoomInfo.style.display='none';
  }
  const andaime=H>3?550:0;
  const munk=n('munk'),terceiros=n('terceiros');
  const pedagio=n('pedagio');

  // Estimativa de pedágio: km × 2 (ida+volta) × R$0,15/km arredondado para cima de R$50
  const pedagioEst=km>0 ? Math.ceil((km*2*0.15)/50)*50 : 0;
  const pedagioDescEl=$('pedagio-desc');
  if(pedagioDescEl&&km>0){
    pedagioDescEl.textContent=`${km}km × 2 × R$0,15/km = R$ ${pedagioEst.toLocaleString('pt-BR')} (arredondado para cima)`;
    $('pedagio-est').style.display='';
    // Atualizar info da rota Sem Parar
    const cidadeEl=$('cep-cidade');
    const cidade=cidadeEl?cidadeEl.textContent.trim():'';
    const rotaEl=$('pedagio-rota');
    const destEl=$('ped-destino');
    if(rotaEl&&destEl&&cidade.length>2){
      destEl.textContent=cidade;
      rotaEl.style.display='';
    }
  } else if(pedagioDescEl){
    $('pedagio-est').style.display='none';
    const rotaEl=$('pedagio-rota');
    if(rotaEl) rotaEl.style.display='none';
  }

  // ── Terceiros: usar valores manuais ──
  var instQuem=(document.getElementById('inst-quem')||{value:'PROJETTA'}).value;
  var subInst;
  if(instQuem==='TERCEIROS'){
    var tercValor=parseFloat((document.getElementById('inst-terceiros-valor')||{value:''}).value)||0;
    var tercTransp=parseFloat((document.getElementById('inst-terceiros-transp')||{value:''}).value)||0;
    subInst=tercValor+tercTransp;
    $('sub-sal').textContent='—'; $('r-diesel').textContent='—'; $('r-hotel').textContent='—';
    $('sub-alim').textContent='—'; $('r-andaime').textContent='—'; $('sub-munk').textContent='—';
    $('sub-ped').textContent='—'; $('sub-terc').textContent='—';
    $('r-inst').textContent=_osOK?brl(subInst):'—';
  } else if(instQuem==='INTERNACIONAL'){
    var _intlCusto=typeof calcInstIntl==='function'?calcInstIntl():0;
    // Só inclui no resultado quando botão FINALIZAR foi clicado
    subInst=window._instIntlFinalizado?_intlCusto:0;
    $('sub-sal').textContent='—'; $('r-diesel').textContent='—'; $('r-hotel').textContent='—';
    $('sub-alim').textContent='—'; $('r-andaime').textContent='—'; $('sub-munk').textContent='—';
    $('sub-ped').textContent='—'; $('sub-terc').textContent='—';
    $('r-inst').textContent=window._instIntlFinalizado?brl(subInst):'⏳ Aguardando finalizar';
  } else if(instQuem==='SEM'){
    subInst=0;
    $('sub-sal').textContent='—'; $('r-diesel').textContent='—'; $('r-hotel').textContent='—';
    $('sub-alim').textContent='—'; $('r-andaime').textContent='—'; $('sub-munk').textContent='—';
    $('sub-ped').textContent='—'; $('sub-terc').textContent='—';
    $('r-inst').textContent='R$ 0';
  } else {
  const subInst_calc=salarios+diesel+hotel+alimentacao+andaime+munk+pedagio+terceiros;
  subInst=subInst_calc;

  $('sub-sal').textContent=_osOK?brl(salarios):'—';
  $('sub-desl').textContent=deslTotal; $('sub-dinst').textContent=diasInst; $('sub-dtot').textContent=diasTotal;
  $('sub-p').textContent=pessoas; $('sub-di').textContent=diaria;
  $('r-diesel').textContent=_osOK?brl(diesel):'—';
  $('r-hotel').textContent=_osOK?brl(hotel):'—';
  $('sub-noites').textContent=noites; $('sub-hdia').textContent=hotelDia; $('sub-qts').textContent=quartos;
  $('sub-alim').textContent=_osOK?brl(alimentacao):'—';
  $('sub-ad').textContent=diasTotal; $('sub-ap').textContent=pessoas; $('sub-av').textContent=alimVal;
  $('sub-noites').textContent=noites;
  $('r-andaime').textContent=brl(andaime);
  $('andaime-note').textContent=andaime?'auto — altura > 3m':'não aplicável';
  $('sub-munk').textContent=_osOK?brl(munk):'—';
  $('sub-ped').textContent=_osOK?brl(pedagio):'—';
  if($('sub-ped-desc')) $('sub-ped-desc').textContent=pedagio>0?`R$0,15/km × ${km}km × 2`:'campo manual acima';
  $('sub-terc').textContent=_osOK?brl(terceiros):'—';
  $('r-inst').textContent=_osOK?brl(subInst):'—';
  } // close else (Projetta/Weiku)

  /* CUSTO TOTAL */
  const ov=n('overhead')/100;
  // ★ _osOK (OS gerada OU revestimento-only) permite consolidar custo mesmo sem "Gerar OS"
  var _subFabEfetivo=_osOK?subFab:0;
  var _subInstEfetivo=_osOK?subInst:0;
  // Internacional: instalação separada, não entra no custo da porta
  var _isIntl=(document.getElementById('inst-quem')||{value:''}).value==='INTERNACIONAL';
  var _subInstNoCusto=_isIntl?0:_subInstEfetivo;
  const custo=_subFabEfetivo+_subInstNoCusto+(_subFabEfetivo+_subInstNoCusto)*ov;
  $('m-custo').textContent=brl(custo);
  $('m-custo-m2').textContent=m2>0?br2(custo/m2)+'/m²':'—';

  /* ══ PREÇOS PORTA ══ */
  const imp=n('impostos')/100,rep=n('com-rep')/100,rt=n('com-rt')/100,gest=n('com-gest')/100;
  const irpj=0.34,lu=n('lucro-alvo')/100;
  // Markup de desconto: auto=20% se RT=5%, 15% se RT=0%; editável manualmente
  var mkupDescEl=document.getElementById('markup-desc');
  var mkupDescAuto = rt>=0.05 ? 15 : 20; // RT=5%→15%, RT=0%→20%
  if(mkupDescEl && !mkupDescEl.dataset.manual){
    mkupDescEl.value=mkupDescAuto;
    var mkupLbl=document.getElementById('markup-desc-auto');
    if(mkupLbl) mkupLbl.textContent='(auto: RT='+(rt*100).toFixed(0)+'%→'+mkupDescAuto+'%)';
  }
  // Campo markup vazio → reverter para auto (limpar estado manual)
  if(mkupDescEl && mkupDescEl.value==='' && mkupDescEl.dataset.manual){
    mkupDescEl.dataset.manual='';
    mkupDescEl.style.borderColor='';mkupDescEl.style.background='';
    mkupDescEl.style.color='';mkupDescEl.style.fontWeight='';
    var _mkupLbl2=document.getElementById('markup-desc-auto');
    if(_mkupLbl2) _mkupLbl2.textContent='(auto: RT='+(rt*100).toFixed(0)+'%→'+mkupDescAuto+'%)';
  }
  var _mkupRaw=mkupDescEl&&mkupDescEl.value!==''?parseFloat(mkupDescEl.value):mkupDescAuto;
  if(isNaN(_mkupRaw)) _mkupRaw=mkupDescAuto;
  var mkupDescPct=_mkupRaw/100; // 0 é válido (sem markup)
  // Auto-ajustar desconto negociado conforme RT (se campo não foi editado manualmente)
  var descontoEl=document.getElementById('desconto');
  if(descontoEl && !descontoEl.dataset.manual){
    var _descontoAuto = rt>=0.05 ? 15 : 20; // RT=5%→15%, RT=0%→20%
    descontoEl.value = _descontoAuto;
  }
  const descPrj=n('desconto')/100;

  const lbn=lu/(1-irpj);
  const td=imp+(rep+rt+gest)+lbn;
  const fF=td<1?1/(1-td):0;
  // Markup de desconto: pTab = pFat / (1 - mkupDescPct)
  // Ex: markup=20% → pTab = pFat/0.80 = pFat×1.25
  // Dar 20% desconto sobre pTab: pFatReal = pTab×0.80 = pFat ✓ margem preservada
  const fT=(td>0.001&&mkupDescPct>0&&mkupDescPct<1)?fF/(1-mkupDescPct):fF;
  const pFat=custo*fF,pTab=custo*fT,dVal=pTab*descPrj;
  const mkp=custo>0?(pTab/custo-1)*100:0;

  // Painel PORTA (custos já incluem todas as portas via otimização)
  const qP=parseInt($('qtd-portas').value)||1;
  // pFatReal = preço que o cliente paga = tabela × (1 − desconto negociado)
  const pFatReal=pTab*(1-descPrj);
  $('m-custo-porta').textContent=brl(custo);
  $('m-custo-porta-m2').textContent=m2>0?br2(custo/m2)+'/m²':'—';
  $('m-mkp-porta').textContent=pf(mkp);
  $('m-tab-porta').textContent=brl(pTab);
  $('m-fat-porta').textContent=brl(pFatReal);
  $('m-tab-porta-m2').textContent=m2>0?br2(pTab/m2)+'/m²':'—';
  $('m-fat-porta-m2').textContent=m2>0?br2(pFatReal/m2)+'/m²':'—';

  // Margens porta
  const vI_p=pFatReal*imp,vR_p=pFatReal*rep,vT_p=pFatReal*rt,vG_p=pFatReal*gest;
  const lb_p=pFatReal-vI_p-vR_p-vT_p-vG_p-custo;
  const vi_p=lb_p>0?lb_p*irpj:0,ll_p=lb_p-vi_p;
  const mb_p=pFatReal>0?lb_p/pFatReal*100:0,ml_p=pFatReal>0?ll_p/pFatReal*100:0;
  $('pct-mb-porta').textContent=pf(mb_p);$('bar-mb-porta').style.width=Math.min(Math.max(mb_p*1.5,0),100)+'%';
  $('pct-ml-porta').textContent=pf(ml_p);$('bar-ml-porta').style.width=Math.min(Math.max(ml_p*1.5,0),100)+'%';

  // m² porta
  $('s-cm2').textContent=m2>0?br2(custo/m2)+'/m²':'—';
  $('s-tm2').textContent=m2>0?br2(pTab/m2)+'/m²':'—';
  $('s-fm2').textContent=m2>0?br2(pFatReal/m2)+'/m²':'—';
  // Só porta (sem instalação)
  var custoSoPorta=_subFabEfetivo+_subFabEfetivo*ov;
  var pTabSoPorta=custoSoPorta*fT;
  var pFatSoPorta=pTabSoPorta*(1-descPrj);
  $('s-tm2p').textContent=m2>0?br2(pTabSoPorta/m2)+'/m²':'—';
  $('s-fm2p').textContent=m2>0?br2(pFatSoPorta/m2)+'/m²':'—';
  $('s-desc').textContent=pf(descPrj*100)+' → −'+brl(dVal);
  // Detalhamento fab + inst
  var custoFabOv=_subFabEfetivo+_subFabEfetivo*ov;
  var custoInstOv=_subInstNoCusto+_subInstNoCusto*ov;
  var tabInst=custoInstOv*fT;
  var fatInst=tabInst*(1-descPrj);
  var dCF=$('d-custo-fab');if(dCF)dCF.textContent=brl(custoFabOv);
  var dCI=$('d-custo-inst');if(dCI)dCI.textContent=brl(custoInstOv);
  var dTSP=$('d-tab-sp');if(dTSP)dTSP.textContent=brl(pTabSoPorta);
  var dFSP=$('d-fat-sp');if(dFSP)dFSP.textContent=brl(pFatSoPorta);
  var dTI=$('d-tab-inst');if(dTI)dTI.textContent=brl(tabInst);
  var dFI=$('d-fat-inst');if(dFI)dFI.textContent=brl(fatInst);

  // ══ RESULTADO TOTAL INTERNACIONAL ══
  var _intlPanel=$('resultado-intl-total');
  if(_intlPanel){
    // ★ Felipe 20/04: painel agora aparece SEMPRE que e internacional,
    //   mesmo sem instalacao cotada. Antes exigia _subInstEfetivo>0 —
    //   isso escondia o painel quando o cliente nao pedia instalacao.
    //   Agora: se for internacional e tiver preco de porta, mostra.
    //   USD da porta e preenchido desde o inicio (nao espera frete).
    if(_isIntl && pFatReal>0){
      _intlPanel.style.display='';
      var _cambioIntl=parseFloat(($('inst-intl-cambio')||{value:5.20}).value)||5.20;
      // _instIntlFat é setado por calcInstIntl() em 14-reps_sync.js — se nao
      // tem instalacao, fica 0 (nao aparece na linha instalacao).
      var _precoInstIntl = window._instIntlFat || 0;

      // Porta em R$ e USD (sempre aparece)
      $('intl-preco-porta').textContent=brl(pFatReal);
      var _portaUsdEl=$('intl-preco-porta-usd');
      if(_portaUsdEl) _portaUsdEl.textContent='US$ '+Math.round(pFatReal/_cambioIntl).toLocaleString('en-US');

      // Instalacao so se > 0
      if(_precoInstIntl>0){
        $('intl-preco-inst').textContent=brl(_precoInstIntl);
        $('intl-preco-inst-usd').textContent='US$ '+Math.round(_precoInstIntl/_cambioIntl).toLocaleString('en-US');
      } else {
        $('intl-preco-inst').textContent='—';
        $('intl-preco-inst-usd').textContent='';
      }

      var _totalIntlFat=pFatReal+_precoInstIntl;
      $('intl-total-fat').textContent=brl(_totalIntlFat);
      $('intl-total-usd').textContent='US$ '+Math.round(_totalIntlFat/_cambioIntl).toLocaleString('en-US');
    } else {
      _intlPanel.style.display='none';
    }
  }

  // Fechadura digital: custo já incluído em fab-custo-acess (sem cálculo separado)
  const custoAc=0, pFatAc=0, pTabAc=0;

  /* ══ RESULTADO GERAL (PORTA + FECHADURA) × QTD ══ */
  const pFatTotal=pFatReal; // preço real pago (tabela − desconto negociado)
  const pTabTotal=pTab;
  const custoTotal=custo;
  const mkpTotal=custoTotal>0?(pTabTotal/custoTotal-1)*100:0;

  $('m-custo').textContent=brl(custoTotal);
  $('m-custo-m2').textContent=m2>0?br2(custoTotal/m2)+'/m²':'—';
  $('m-mkp').textContent=pf(mkpTotal);
  $('m-tab').textContent=brl(pTabTotal);
  $('m-fat').textContent=brl(pFatTotal);
  $('m-tab-m2').textContent=m2>0?br2(pTabTotal/m2)+'/m²':'—';
  $('m-fat-m2').textContent=m2>0?br2(pFatTotal/m2)+'/m²':'—';

  /* DRE CONSOLIDADA — base é o faturamento real (tabela − desconto negociado) */
  var _pFatDRE = pFatRealTotal || pFatTotal; // usar pFatRealTotal se calculado
  const vI=_pFatDRE*imp,vR=_pFatDRE*rep,vT=_pFatDRE*rt,vG=_pFatDRE*gest;
  const lb=_pFatDRE-vI-vR-vT-vG-custoTotal;
  const vi=lb>0?lb*irpj:0,ll=lb-vi;
  const mb=_pFatDRE>0?lb/_pFatDRE*100:0,ml=_pFatDRE>0?ll/_pFatDRE*100:0;

  // DRE: Preço Tabela → Desconto → Faturamento
  // Desconto = desconto negociado (dVal = pTab * descPrj)
  var dDescTotal=dVal; // desconto sobre preço tabela da porta
  var pFatRealTotal=pTabTotal-dDescTotal; // receita faturamento = tabela - desconto negociado
  $('d-tab').textContent=brl(pTabTotal);
  $('d-tab-porta').textContent=brl(pTab);
  if(custoAc>0&&$('d-tab-fech')) $('d-tab-fech').textContent=brl(pTabAc);
  if($('d-tab-fech-row')) $('d-tab-fech-row').style.display=custoAc>0?'':'none';
  $('d-desc-val').textContent=dDescTotal>0?'−'+brl(dDescTotal):'R$ 0';
  $('d-desc-pct').textContent=descPrj>0?pf(descPrj*100)+' aplicado':'sem desconto';
  $('d-fat').textContent=brl(pFatRealTotal);
  $('d-fat-porta').textContent=brl(pTab-dVal);
  if(custoAc>0) $('d-fat-fech').textContent=brl(pTabAc*(1-descPrj));
  $('d-imp').textContent='−'+brl(vI);$('d-imp-pct').textContent=pf(imp*100);
  $('d-rep').textContent='−'+brl(vR);$('d-rep-pct').textContent=pf(rep*100);
  $('d-rt').textContent='−'+brl(vT);$('d-rt-pct').textContent=pf(rt*100);
  $('d-gest').textContent='−'+brl(vG);$('d-gest-pct').textContent=pf(gest*100);
  $('d-custo').textContent='−'+brl(custoTotal);
  $('d-custo-porta').textContent='−'+brl(custo);
  if(custoAc>0) $('d-custo-fech').textContent='−'+brl(custoAc);
  $('d-lb').textContent=brl(lb);
  $('d-irpj').textContent='−'+brl(vi);
  $('d-ll').textContent=brl(ll);

  const cl=v=>Math.min(Math.max(v,0),100)+'%';
  $('pct-mb').textContent=pf(mb);$('bar-mb').style.width=cl(mb*1.5);
  $('pct-ml').textContent=pf(ml);$('bar-ml').style.width=cl(ml*1.5);
  $('pct-meta').textContent=pf(lu*100);$('bar-meta').style.width=cl(lu*150);

  const diff=ml-lu*100,bd=$('badge-st');
  if(!pFat){bd.className='badge';bd.textContent='—';}
  else if(diff>=-0.1){bd.className='badge ok';bd.textContent='Meta atingida ✓ '+pf(ml);}
  else if(diff>=-2){bd.className='badge wn';bd.textContent='Próximo da meta '+pf(ml);}
  else{bd.className='badge bd';bd.textContent='Abaixo da meta '+pf(ml);}

  // ══ SALVAR VALORES NUMÉRICOS — fonte única para snapshot/CRM ══
  window._calcResult={
    ts: new Date().toISOString(),
    // Numéricos (para CRM)
    _custoTotal: custoTotal, _tabTotal: pTabTotal, _fatTotal: pFatTotal,
    _subFab: subFab, _subInst: subInst,
    // Formatados (para snapshot/memorial)
    custoTotal: brl(custoTotal), custoM2: m2>0?br2(custoTotal/m2)+'/m²':'—',
    custoPorta: brl(custo), custoPortaM2: m2>0?br2(custo/m2)+'/m²':'—',
    tabTotal: brl(pTabTotal), tabM2: m2>0?br2(pTabTotal/m2)+'/m²':'—',
    tabPorta: brl(pTab), tabPortaM2: m2>0?br2(pTab/m2)+'/m²':'—',
    fatTotal: brl(pFatTotal), fatM2: m2>0?br2(pFatTotal/m2)+'/m²':'—',
    fatPorta: brl(pFatReal), fatPortaM2: m2>0?br2(pFatReal/m2)+'/m²':'—',
    mkp: pf(mkpTotal), mkpPorta: pf(custoTotal>0?(pTab/custo-1)*100:0),
    mbPorta: pf(mb_p||0), mlPorta: pf(ml_p||0), mb: pf(mb), ml: pf(ml),
    metaLucro: pf(lu*100), badge: bd.textContent,
    // DRE
    dreTab: brl(pTabTotal), dreDescVal: dDescTotal>0?'−'+brl(dDescTotal):'R$ 0',
    dreDescPct: descPrj>0?pf(descPrj*100)+' aplicado':'sem desconto',
    dreFat: brl(pFatRealTotal||pFatTotal),
    dreImp: '−'+brl(vI), dreImpPct: pf(imp*100),
    dreRep: '−'+brl(vR), dreRepPct: pf(rep*100),
    dreRt: '−'+brl(vT), dreRtPct: pf(rt*100),
    dreGest: '−'+brl(vG), dreGestPct: pf(gest*100),
    dreCusto: '−'+brl(custoTotal), dreLb: brl(lb), dreIrpj: '−'+brl(vi), dreLl: brl(ll),
    // Fabricação
    subFab: brl(subFab),
    subAcm: brl(subAcm), subAlu: brl(subAlu),
    matPerfis: (document.getElementById('fab-mat-perfis')||{}).value||'',
    custoPintura: (document.getElementById('fab-custo-pintura')||{}).value||'',
    custoAcess: (document.getElementById('fab-custo-acess')||{}).value||'',
    subInst: brl(subInst),
    subMO: brl(subMO||0), subSal: brl(salarios||0),
    m2: m2>0?(Math.round(m2*100)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' m²':'—',
  };

  autoSave();
  _updatePesoAcessorios();
  if(typeof _updateResumoObra==='function') _updateResumoObra();
}

/* ── Zerar Instalação: limpa todos campos de instalação ── */
window.zerarInstalacao=function(){
  ['km','dias','pessoas','carros','desl-override','hotel-dia','alim','munk','terceiros','pedagio','inst-terceiros-valor','inst-terceiros-transp'].forEach(function(id){
    var el=document.getElementById(id);
    if(el){el.value='';el.dataset.auto='';el.dataset.manual='';}
  });
  var dEl=document.getElementById('diaria');if(dEl)dEl.value='0';
  var kmEl=document.getElementById('km');if(kmEl)kmEl.dataset.manual='1'; // impede auto-fill CEP
  calc();
  var toast=document.createElement('div');toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#e74c3c;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999';toast.textContent='🗑 Instalação zerada!';document.body.appendChild(toast);setTimeout(function(){toast.remove();},2000);
};

/* ── Modo Manual: desativa auto-calc de dias/pessoas/carros ── */
window.instManual=function(){
  ['dias','pessoas','carros'].forEach(function(id){
    var el=document.getElementById(id);
    if(el){el.dataset.auto='';el.dataset.manual='1';}
  });
  var kmEl=document.getElementById('km');if(kmEl)kmEl.dataset.manual='1';
  var toast=document.createElement('div');toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999';toast.textContent='✏️ Modo manual ativado — preencha os campos!';document.body.appendChild(toast);setTimeout(function(){toast.remove();},2000);
};

/* ══ END MODULE: ORCAMENTO_CALC ══ */
