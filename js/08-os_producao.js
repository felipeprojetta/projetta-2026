/**
 * 08-os_producao.js
 * Module: OS_PRODUCAO
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: OS_PRODUCAO ══ */
window._osGeradoUmaVez = false; // somente true quando usuario clicar em Gerar OS

// Debounce de 300ms para não gerar a cada tecla
var _osAutoTimer = null;
function _osAutoUpdate(){
  // Desativado — calculo agora e manual via botao "Gerar Custo"
  // Apenas atualiza o planificador (pecas preview, sem custo)
  clearTimeout(_osAutoTimer);
  _osAutoTimer = setTimeout(function(){planUpd();}, 300);
}

// Regenera OS — agora chamado apenas pelo botao
function _osAutoGenerate(){
  var L=parseFloat((document.getElementById('largura')||{value:0}).value)||0;
  var H=parseFloat((document.getElementById('altura')||{value:0}).value)||0;
  var modelo=(document.getElementById('carac-modelo')||{value:''}).value||'';
  if(L<=0||H<=0||!modelo) return;
  window._osAutoMode=true;
  try{gerarOS();}catch(e){console.warn('_osAutoGenerate:',e);}
  window._osAutoMode=false;
}

/* ── GERAR CUSTO TOTAL (botao principal) ─────────────────────────────────── */
function gerarCustoTotal(){
  if(window._snapshotLock) return;
  var L=parseFloat((document.getElementById('largura')||{value:0}).value)||0;
  var H=parseFloat((document.getElementById('altura')||{value:0}).value)||0;
  var modelo=(document.getElementById('carac-modelo')||{value:''}).value||'';
  var _hasMP=window._mpItens&&window._mpItens.length>0;
  if(L<=0||H<=0){if(!_hasMP&&!window._osAutoMode)alert('Preencha Largura e Altura primeiro.');if(!_hasMP)return;}
  if(!modelo){if(!_hasMP&&!window._osAutoMode)alert('Selecione o Modelo da porta.');if(!_hasMP)return;}

  var btn=document.querySelector('[onclick="gerarCustoTotal()"]');

  // FASE 0: Feedback visual — processando
  if(btn){
    btn.innerHTML='⏳ Calculando...';
    btn.style.background='linear-gradient(135deg,#7f5c00,#b8860b)';
    btn.disabled=true;
  }

  // FASE 1 — imediato: OS de perfis e acessórios
  try{if(typeof _syncCavaToPlano==='function') _syncCavaToPlano();}catch(e){console.warn('syncCava:',e);}
  try{_autoSelectFechadura();}catch(e){console.warn('autoFech:',e);}
  window._osAutoMode = true;
  try{gerarOS();}catch(e){console.warn('gerarOS error:',e);}
  window._osAutoMode = false;

  // FASE 2 — 500ms: planificador calcula chapas → captura quantidade
  setTimeout(function(){
    if(typeof filtrarChapasACM==='function') try{filtrarChapasACM();}catch(e){}
    if(typeof planUpd==='function') try{planUpd();}catch(e){}
    if(typeof _autoSelectAndRun==='function') _autoSelectAndRun();

    // Após planificador rodar, capturar número de chapas e calcular h-corte
    setTimeout(function(){
      // Somar todas as quantidades de chapas ACM
      var nChapas=0;
      if(window._chapasCalculadas){
        nChapas=window._chapasCalculadas;
      } else {
        for(var _qi=1;_qi<=20;_qi++){
          var _qEl=document.getElementById('acm-qty-'+_qi);
          if(!_qEl) break;
          nChapas+=parseInt(_qEl.value)||0;
        }
        if(!nChapas) nChapas=parseInt((document.getElementById('plan-acm-qty')||{value:0}).value)||0;
      }
      // Modelo ripado?
      var _mSel=document.getElementById('carac-modelo')||document.getElementById('plan-modelo');
      var _mVal=_mSel?_mSel.value:'';
      var _isRip=['08','15','20','21'].indexOf(_mVal)>=0;
      // nChapas já inclui todas as portas (nesting rodou com peças multiplicadas)
      var nChapasTotal=nChapas;
      var corteAuto=nChapasTotal>0?(_isRip?nChapasTotal+2:nChapasTotal+1):0;
      var hCorteEl=document.getElementById('h-corte');
      if(hCorteEl && corteAuto>0 && hCorteEl.dataset.manual!=='1'){
        hCorteEl.value=corteAuto;
        hCorteEl.dataset.auto='1';
        var lbl=document.getElementById('h-corte-auto');
        if(lbl) lbl.textContent='(auto: '+nChapas+' chapas '+(_isRip?'+2 ripado':'+1')+' = '+corteAuto+'h)';
      }

      // FASE 3 — 1500ms total: liberar tela com todos os dados de fabricação e instalação
      setTimeout(function(){
        // Forçar renderização de acessórios para sincronizar FAB+OBRA+FechDig → fab-custo-acess
        try{
          var _d=window._lastOSData;
          var _sis=(_d&&_d.sis)||(document.getElementById('prod-sistema')||{value:''}).value||'PA006';
          var _aRows=_calcAcessoriosAllItems(_d,_sis);
          var _qPTotal=window._mpItens&&window._mpItens.length>0?window._mpItens.reduce(function(s,it){return s+(parseInt(it._qtd||it['qtd-portas'])||1);},0):parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
          var _vInfo=null;
          // Multi-porta: calcular veda porta para CADA porta (larguras diferentes)
          if(window._mpItens && window._mpItens.length>1){
            var _vedaList=[];
            window._mpItens.forEach(function(mpIt,mpIdx){
              var _mpL=parseInt(mpIt.largura||mpIt._largura)||0;
              if(_mpL<=0) return;
              var _mpQty=parseInt(mpIt._qtd||mpIt['qtd-portas'])||1;
              var _mpFolhas=parseInt(mpIt.folhas||mpIt._folhas||mpIt['folhas-porta'])||1;
              // Fórmula original: FOLHA_PA_PA = L - FGL - FGR - 125 (FGL=FGR=2.5)
              var _mpFOLHA=_mpL-2.5-2.5-125;
              // VEDA_SIZE = max(720, ceil((FOLHA-620)/100)*100 + 620)
              var _mpVedaSize=Math.max(720, (Math.ceil((_mpFOLHA-620)/100)*100)+620);
              if(_mpVedaSize>1820) _mpVedaSize=1820;
              var _mpVedaCode='PA-VED'+String(_mpVedaSize).padStart(4,'0');
              var _mpVedaQty=_mpFolhas===2?4:2;
              _vedaList.push({size:_mpVedaSize,code:_mpVedaCode,qty:_mpVedaQty*_mpQty,label:'P'+(mpIdx+1)+': '+_mpL+'mm',folhaPAPA:Math.round(_mpFOLHA)});
            });
            if(_vedaList.length>0) _vInfo={multi:true,list:_vedaList};
          } else {
            _vInfo=_d&&_d.vedaSize?{qty:_d.vedaQty*_qPTotal,code:_d.vedaCode,size:_d.vedaSize}:null;
          }
          _renderOSAcess(_d,_aRows,_vInfo);
        }catch(_e){ console.warn('acess sync:',_e); }
        if(typeof calc==='function') calc();

        // Sinalizar conclusão — snapshot seguro agora
        window._custoCalculado=true;
        if(typeof window._onCustoCompleto==='function'){
          try{window._onCustoCompleto();}catch(e){}
          window._onCustoCompleto=null;
        }

        if(btn){
          btn.innerHTML='✅ Custo gerado!';
          btn.style.background='linear-gradient(135deg,#1a7a20,#27ae60)';
          btn.disabled=false;
          setTimeout(function(){
            btn.innerHTML='⚙ GERAR CUSTO COMPLETO';
            btn.style.background='linear-gradient(135deg,#003144,#00526b)';
          },3000);
        }
      }, 1000); // total ~1.5s (500 + 1000)
    }, 300); // aguardar planificador finalizar dentro do 500ms
  }, 500); // fase 2 em 500ms
}

function gerarOS(){
  var _foiPrimeiraOS = !window._osGeradoUmaVez;
  window._osGeradoUmaVez = true; // marca que o usuário gerou a OS
  // Timing gerido por gerarCustoTotal()
  // Show loading state immediately
  var _emEl=document.getElementById('os-empty');
  if(_emEl){_emEl.style.display='';_emEl.innerHTML='<div style="text-align:center;padding:20px;color:#888">⚙ Gerando OS...</div>';}
  var _docEl=document.getElementById('os-doc');
  if(_docEl) _docEl.style.display='none';

  try {
  var L=parseFloat((document.getElementById('largura')||{value:0}).value)||0;
  var H=parseFloat((document.getElementById('altura')||{value:0}).value)||0;
  if(L<=0||H<=0){
    if(_emEl){_emEl.innerHTML='<div style="color:#e67e22;padding:16px;text-align:center;font-size:13px"><b>⚠ Preencha Largura e Altura no Orçamento primeiro.</b></div>';}
    return;
  }
  var nFolhas=parseInt((document.getElementById('folhas-porta')||{value:1}).value)||1;
  var barraMM=(parseFloat((document.getElementById('pf-barra-m')||{value:6}).value)||6)*1000;

  var d;
  // ── Multi-porta: calcular combinado ──
  if(window._mpItens && window._mpItens.length > 0){
    d=_mpCalcCombinedPerfis(barraMM);
    if(d.error){
      if(!window._osAutoMode) alert(d.error);
      return;
    }
    window._qPOS=1; // multi-door gerencia qtd internamente
    // Usar dimensões do primeiro item para cabeçalho
    L=window._mpItens[0].largura; H=window._mpItens[0].altura;
    nFolhas=window._mpItens[0].folhas||1;
  } else {
    d=_calcularDadosPerfis(L,H,nFolhas,barraMM);
    if(d.error){
      if(!window._osAutoMode) alert(d.error);
      return;
    }
    window._qPOS=parseInt(($('qtd-portas')||{value:'1'}).value)||1;
  }

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  var cliente=(document.getElementById('nome-cliente')||{value:''}).value||
              (document.getElementById('cli-nome')||{value:''}).value||'—';
  var obra=(document.getElementById('cep-cliente')||{value:''}).value||'—';
  var modelo=(document.getElementById('plan-modelo')||{value:''}).value||'01-CAVA';
  var now=new Date();
  var dataStr=now.toLocaleDateString('pt-BR')+' '+now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  var osNum='OS-'+now.getFullYear()+(now.getMonth()+1+'').padStart(2,'0')+(now.getDate()+'').padStart(2,'0')+'-'+L+'x'+H;

  var el=function(id){return document.getElementById(id);};
  el('os-numero').textContent=osNum;
  el('os-data').textContent=dataStr;
  el('os-cliente').textContent=cliente;
  el('os-obra').textContent=obra;
  // VÃO ACABADO: mostrar todas as portas quando multi-porta
  var _vaoTxt=L+' × '+H+' mm';
  if(window._mpItens && window._mpItens.length>1){
    _vaoTxt=window._mpItens.map(function(it,i){return 'P'+(i+1)+': '+it.largura+'×'+it.altura;}).join('  |  ')+' mm';
  }
  el('os-vao').textContent=_vaoTxt;
  el('os-sistema').textContent=d.sis+' (tubo '+(d.sis==='PA007'?51:38)+'mm)';
  el('os-folhas').textContent=nFolhas+' folha'+(nFolhas>1?'s':'');
  el('os-modelo').textContent=modelo?'Modelo '+modelo:'—';

  // ── Chapa Frontal — referência para conferência manual ──
  var _cfDiv=el('os-chapa-frontal');
  if(_cfDiv){
    var _cfTUB=(d.sis==='PA007')?51:38;
    var _cfRows='';
    if(window._mpItens && window._mpItens.length>1){
      window._mpItens.forEach(function(it,idx){
        var _mL=parseInt(it.largura)||0, _mA=parseInt(it.altura)||0;
        var _mG4=Math.round(_mA-10-_cfTUB-28+8);
        var _mG3=Math.round(_mL-20-343+218);
        var _mG2=Math.round(_mL-20-343+256);
        _cfRows+='<div style="display:flex;gap:16px;align-items:center;padding:2px 0">'
          +'<span style="font-size:10px;font-weight:800;color:#003144">P'+(idx+1)+' ('+_mL+'×'+_mA+')</span>'
          +'<span style="font-size:11px">ALT: <b>'+_mG4+'</b></span>'
          +'<span style="font-size:11px;color:#1a5276">LAR 1flh: <b>'+_mG3+'</b></span>'
          +'<span style="font-size:11px;color:#6c3483">LAR 2flh: <b>'+_mG2+'</b></span></div>';
      });
    } else {
      var _cfG4=Math.round(H-10-_cfTUB-28+8);
      var _cfG3=Math.round(L-20-343+218);
      var _cfG2=Math.round(L-20-343+256);
      _cfRows='<div style="display:flex;gap:16px;align-items:center">'
        +'<span style="font-size:11px">ALT: <b>'+_cfG4+'</b> mm</span>'
        +'<span style="font-size:11px;color:#1a5276">LAR 1 folha: <b>'+_cfG3+'</b> mm</span>'
        +'<span style="font-size:11px;color:#6c3483">LAR 2 folhas: <b>'+_cfG2+'</b> mm</span></div>';
    }
    _cfDiv.style.display='';
    _cfDiv.innerHTML='<div style="background:#f0f7ff;border:1px solid #b0cfe0;border-radius:6px;padding:8px 14px">'
      +'<span style="font-size:10px;font-weight:800;color:#003144;text-transform:uppercase;letter-spacing:.04em">📐 Chapa Frontal (ref.)</span>'
      +_cfRows+'</div>';
  }

  // ── Render seção genérica ────────────────────────────────────────────────
  function renderSecao(secao,tbodyId,tfootId,themeColor){
    var tbody=el(tbodyId); if(!tbody)return;
    tbody.innerHTML='';
    var secCuts=d.cuts.filter(function(c){return c.secao===secao && c.qty>0;});
    var pos=1,totKg=0;
    secCuts.forEach(function(c){
      var kgLiq=c.compMM/1000*c.kgM*c.qty;
      totKg+=kgLiq;
      var ip=d.isPintado(c.code);
      var barLen=c.barLenMM/1000;
      if(c.isSplit && c.splitPieces && c.splitPieces.length > 1){
        // Emenda: mostrar 2 linhas — peça principal + complemento
        var bg0='#fff9f0';
        var bl0='border-left:3px solid #e67e22;';
        // Agrupar peças: primeira peça (maior) e complemento (menor)
        var p0=c.splitPieces[0], p1=c.splitPieces.slice(1);
        var compMM_compl = p1.reduce(function(s,x){return s+x;},0);
        var kgP0=p0/1000*c.kgM*c.qty;
        var kgP1=compMM_compl/1000*c.kgM*c.qty;
        // Linha da peça principal (5990mm)
        tbody.innerHTML+='<tr style="background:'+bg0+';'+bl0+'">'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;color:#e67e22;font-size:10px">'+pos+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;font-weight:700;font-size:10px;white-space:nowrap;color:'+(ip?'#8e44ad':themeColor)+'">'+c.code+(ip?' 🎨':'')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;font-size:10px">'+c.desc+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;font-size:10px;color:#888">'+c.lh+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;font-size:10px">'+barLen+'M</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-weight:700;font-size:11px;color:#e67e22">'+p0+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-size:10px">'+c.qty+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-size:10px;color:#666">'+c.kgM.toFixed(3).replace('.',',')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-weight:700;font-size:11px;color:#e67e22">'+kgP0.toFixed(3).replace('.',',')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;font-size:9px;color:#e67e22;white-space:nowrap">✂ EMENDA'+c.obs.replace('BRUTO','').replace('BNF-TECNO','')+'</td>'
          +'</tr>';
        pos++;
        // Linha do complemento
        tbody.innerHTML+='<tr style="background:#fff9f0;'+bl0+'">'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;color:#e67e22;font-size:10px">'+pos+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;font-weight:700;font-size:10px;white-space:nowrap;color:'+(ip?'#8e44ad':themeColor)+'">'+c.code+(ip?' 🎨':'')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;font-size:10px">'+c.desc+' ↩ compl.</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;font-size:10px;color:#888">'+c.lh+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;font-size:10px">'+barLen+'M</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-weight:700;font-size:11px;color:#e67e22">'+compMM_compl+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-size:10px">'+c.qty+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-size:10px;color:#666">'+c.kgM.toFixed(3).replace('.',',')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-weight:700;font-size:11px;color:#e67e22">'+kgP1.toFixed(3).replace('.',',')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;font-size:9px;color:#e67e22;white-space:nowrap">↩ complemento '+c.obs.replace('BRUTO','').replace('BNF-TECNO','')+'</td>'
          +'</tr>';
      } else {
        var bg=ip?'#fef9f0':pos%2===0?'#fff':'#f9f8f5';
        var bl=ip?'border-left:3px solid #8e44ad;':'';
        var _ilbl=c._itemLabel?'<span style="font-size:8px;color:#e65100;font-weight:600;margin-left:4px">'+c._itemLabel+'</span>':'';
        tbody.innerHTML+='<tr style="background:'+bg+';'+bl+'">'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;color:#888;font-size:10px">'+pos+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;font-weight:700;font-size:10px;white-space:nowrap;color:'+(ip?'#8e44ad':themeColor)+'">'+c.code+(ip?' 🎨':'')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;font-size:10px">'+c.desc+_ilbl+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;font-size:10px;color:#888">'+c.lh+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;font-size:10px">'+barLen+'M</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-weight:700;font-size:11px">'+c.compMM+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-size:10px">'+c.qty+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-size:10px;color:#666">'+c.kgM.toFixed(3).replace('.',',')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;text-align:right;font-weight:700;font-size:11px;color:'+themeColor+'">'+kgLiq.toFixed(3).replace('.',',')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #ddd;font-size:9px;color:'+(ip?'#8e44ad':'#888')+';white-space:nowrap">'+c.obs+'</td>'
          +'</tr>';
      }
      pos++;
    });
    var tfoot=el(tfootId);
    if(tfoot) tfoot.innerHTML='<tr style="background:#f0f4f6;font-weight:700">'
      +'<td colspan="8" style="padding:5px 8px;border:0.5px solid #ddd;font-size:11px;color:#555">SUBTOTAL '+secao+' — Peso Líquido</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ddd;text-align:right;font-size:12px;color:'+themeColor+'">'+totKg.toFixed(3).replace('.',',')+'</td>'
      +'<td style="border:0.5px solid #ddd"></td>'
      +'</tr>';
    return totKg;
  }

  var kgFolha=renderSecao('FOLHA','os-folha-tbody','os-folha-tfoot','#003144');
  var kgPortal=renderSecao('PORTAL','os-portal-tbody','os-portal-tfoot','#444');

  // ── QUADRO FIXO — injetar cuts e renderizar ──────────────────────────────
  var _fixosD = _calcFixosCompleto(d.sis, function(code){
    var sp={}; try{var _s=localStorage.getItem('projetta_comp_precos');if(_s)sp=JSON.parse(_s);}catch(e){}
    if(sp[code]!==undefined) return sp[code];
    for(var ci=0;ci<COMP_DB.length;ci++){if(COMP_DB[ci].c===code)return COMP_DB[ci].p||0;}
    return 0;
  }, 6000); // fixo sempre usa barras de 6m

  // Guardar para seções separadas
  window._lastFixosAcessRows  = _fixosD.acessRows;
  window._lastFixosPerfisRows = _fixosD.cuts;
  window._lastFixosM2Chapa    = _fixosD.m2ChapaFixos;

  // Definir kgM dos cortes do fixo via PERFIS_DB e empurrar em d.cuts
  // Multiplicar fixos por qtd portas (mesmo tratamento da porta principal)
  var _qPFixo;
  if(window._mpItens&&window._mpItens.length>0){
    _qPFixo=window._mpItens.reduce(function(s,it){return s+it.qtd;},0);
  } else {
    _qPFixo=parseInt(($('qtd-portas')||{value:'1'}).value)||1;
  }
  _fixosD.cuts.forEach(function(fc){
    if(!fc.kgM){
      var kgFound=0, baseCode=fc.code.replace(/-[678]M$/,'');
      for(var _pi=0;_pi<PERFIS_DB.length;_pi++){
        if(PERFIS_DB[_pi].c===fc.code||PERFIS_DB[_pi].c===baseCode){kgFound=PERFIS_DB[_pi].kg||0;break;}
      }
      fc.kgM=kgFound;
    }
    fc.barLenMM=6000; // fixo sempre 6m
    if(_qPFixo>1) fc.qty=fc.qty*_qPFixo;
    d.cuts.push(fc);
  });
  // Multiplicar acessórios do fixo × qP
  if(_qPFixo>1 && _fixosD.acessRows){
    _fixosD.acessRows.forEach(function(ar){ ar.qty=ar.qty*_qPFixo; });
  }
  // Multiplicar m² chapa fixo × qP
  if(_qPFixo>1 && _fixosD.m2ChapaFixos){
    _fixosD.m2ChapaFixos=_fixosD.m2ChapaFixos*_qPFixo;
    window._lastFixosM2Chapa=_fixosD.m2ChapaFixos;
  }

  // Renderizar QUADRO FIXO — tabela unificada, mesmo renderSecao
  var hasFix = _fixosD.cuts.some(function(c){return c.qty>0;});
  var fixoHdrRow = document.getElementById('os-fixo-header-row');
  if(hasFix){
    if(fixoHdrRow) fixoHdrRow.style.display = '';
    renderSecao('FIXO','os-fixo-tbody','os-fixo-tfoot','#555');
  } else {
    if(fixoHdrRow) fixoHdrRow.style.display = 'none';
    var fixoTb = document.getElementById('os-fixo-tbody');
    var fixoTf = document.getElementById('os-fixo-tfoot');
    if(fixoTb) fixoTb.innerHTML = '';
    if(fixoTf) fixoTf.innerHTML = '';
  }

  // ── Tabela de barras ─────────────────────────────────────────────────────
  var barrasTbody=el('os-barras-tbody'); if(!barrasTbody)return;
  barrasTbody.innerHTML='';
  var totKgLiq=0,totKgBruto=0,totCusto=0,totBarsCount=0;

  d.seenKeys.forEach(function(key){
    var r=d.groupRes[key];if(!r||r.nBars===0)return;
    var ip=r.pintado;
    totKgLiq+=r.kgLiq;totKgBruto+=r.kgBruto;totCusto+=r.custoTotal;totBarsCount+=r.nBars;

    // Build cuts-per-bar detail string
    var barDetail=r.barsDetail.map(function(b,bi){
      // Count repeated cuts
      var counts={};
      b.items.forEach(function(x){counts[x]=(counts[x]||0)+1;});
      var parts=Object.keys(counts).map(function(k){return counts[k]>1?counts[k]+'×'+k:k;});
      var aprovBar=b.len>0?Math.round((b.len-(b.sobra!=null?b.sobra:b.remaining))/b.len*100):0;
      return 'B'+(bi+1)+': ['+parts.join(', ')+'] → sobra '+(b.remaining)+'mm ('+aprovBar+'%)';
    }).join(' | ');

    var aprovStr=r.aprov>0?r.aprov.toFixed(1).replace('.',',')+'%':'—';
    var bg=ip?'#fef9f0':totBarsCount%2===0?'#fff':'#f9f8f5';
    barrasTbody.innerHTML+='<tr style="background:'+bg+(ip?';border-left:3px solid #8e44ad':'')+'">'
      +'<td style="padding:5px 8px;border:0.5px solid #ccc;font-weight:700;font-size:10px;white-space:nowrap;color:'+(ip?'#8e44ad':'#003144')+'">'+key+(ip?' 🎨':'')+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:center;font-size:10px">'+(r.barLenMM/1000)+'m</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:center;font-weight:700;font-size:12px;color:var(--orange)">'+r.nBars+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ccc;font-size:9px;color:#666;max-width:340px;word-break:break-all;overflow-wrap:break-word;white-space:normal;line-height:1.4">'+barDetail+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:right;font-size:10px">'+r.kgLiq.toFixed(3).replace('.',',')+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:right;font-weight:600;font-size:10px">'+r.kgBruto.toFixed(3).replace('.',',')+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:center;font-size:10px;color:'+(r.aprov<70?'#e74c3c':r.aprov<85?'#e67e22':'#27ae60')+'">'+aprovStr+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:right;font-size:10px">'+r.kgLiq.toFixed(3).replace('.',',')+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:right;font-weight:700;font-size:11px;color:#003144">'+r.kgBruto.toFixed(3).replace('.',',')+'</td>'
      +'</tr>';
  });

  var tfoot=el('os-barras-tfoot');
  if(tfoot) tfoot.innerHTML='<tr style="background:#2c3e50;color:#fff">'
    +'<td style="padding:6px 8px;border:0.5px solid #444;font-weight:700;font-size:11px">TOTAL</td>'
    +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:center;font-size:10px">—</td>'
    +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:center;font-weight:700;font-size:12px">'+totBarsCount+'</td>'
    +'<td style="padding:6px 8px;border:0.5px solid #444;font-size:10px;opacity:.7">barras a comprar</td>'
    +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:right;font-size:11px">'+totKgLiq.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
    +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:right;font-weight:700;font-size:11px">'+totKgBruto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
    +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:center;font-size:10px;opacity:.7">—</td>'
    +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:right;font-size:11px">'+totKgLiq.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
    +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:right;font-weight:700;font-size:12px">'+totKgBruto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
    +'</tr>';

  // ── FIXO: adicionar barras do fixo ao aproveitamento de barras ──────────────
  var fixoCutsAll = (_fixosD && _fixosD.cuts) ? _fixosD.cuts.filter(function(c){return c.qty>0;}) : [];
  if(fixoCutsAll.length > 0){
    var fixoGroups={};
    fixoCutsAll.forEach(function(fc){
      var key=fc.code;
      fc.barLenMM=6000; // fixo sempre 6m
      if(!fixoGroups[key]) fixoGroups[key]={allCuts:[],barLenMM:6000,kgM:fc.kgM||0,pintado:fc.pintado||false};
      // Aplicar split se corte > 5990mm
      for(var i=0;i<fc.qty;i++){
        if(fc.compMM>5990){
          var _fps=_splitCut(fc.compMM,6000);
          _fps.forEach(function(p){fixoGroups[key].allCuts.push(p);});
        } else {
          fixoGroups[key].allCuts.push(fc.compMM);
        }
      }
    });
    Object.keys(fixoGroups).forEach(function(key){
      var fg=fixoGroups[key];
      var bars=binPackFFD(fg.allCuts,fg.barLenMM);
      var fUsed=fg.allCuts.reduce(function(s,x){return s+x;},0);
      var fBruto=bars.reduce(function(s,b){return s+b.barLen;},0);
      var fAprov=fBruto>0?fUsed/fBruto*100:0;
      var fKgLiq=fUsed/1000*fg.kgM, fKgBru=fBruto/1000*fg.kgM;
      totKgLiq+=fKgLiq; totKgBruto+=fKgBru; totBarsCount+=bars.length;
      var barDetail=bars.map(function(b,bi){
        var counts={};
        b.items.forEach(function(x){counts[x]=(counts[x]||0)+1;});
        var parts=Object.keys(counts).map(function(k){return counts[k]>1?counts[k]+'×'+k:k;});
        var aprovBar=b.len>0?Math.round((b.len-(b.remaining||0))/b.len*100):0;
        return 'B'+(bi+1)+': ['+parts.join(', ')+'] → sobra '+(b.remaining||0)+'mm ('+aprovBar+'%)';
      }).join(' | ');
      var aprovStr=fAprov>0?fAprov.toFixed(1).replace('.',',')+'%':'—';
      barrasTbody.innerHTML+='<tr style="background:#edf2f7;border-left:3px solid #2e4057">'
        +'<td style="padding:5px 8px;border:0.5px solid #ccc;font-weight:700;font-size:10px;white-space:nowrap;color:#2e4057">'+key+' ⬛</td>'
        +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:center;font-size:10px">'+(fg.barLenMM/1000)+'m</td>'
        +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:center;font-weight:700;font-size:12px;color:var(--orange)">'+bars.length+'</td>'
        +'<td style="padding:5px 8px;border:0.5px solid #ccc;font-size:9px;color:#666;max-width:340px;word-break:break-all;white-space:normal;line-height:1.4">'+barDetail+'</td>'
        +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:right;font-size:10px">'+fKgLiq.toFixed(3).replace('.',',')+'</td>'
        +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:right;font-weight:600;font-size:10px">'+fKgBru.toFixed(3).replace('.',',')+'</td>'
        +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:center;font-size:10px;color:'+(fAprov<70?'#e74c3c':fAprov<85?'#e67e22':'#27ae60')+'">'+aprovStr+'</td>'
        +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:right;font-size:10px">'+fKgLiq.toFixed(3).replace('.',',')+'</td>'
        +'<td style="padding:5px 8px;border:0.5px solid #ccc;text-align:right;font-weight:700;font-size:11px;color:#2e4057">'+fKgBru.toFixed(3).replace('.',',')+'</td>'
        +'</tr>';
    });
    // Atualizar total geral (porta + fixo)
    if(tfoot) tfoot.innerHTML='<tr style="background:#2c3e50;color:#fff">'
      +'<td style="padding:6px 8px;border:0.5px solid #444;font-weight:700;font-size:11px">TOTAL</td>'
      +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:center;font-size:10px">—</td>'
      +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:center;font-weight:700;font-size:12px">'+totBarsCount+'</td>'
      +'<td style="padding:6px 8px;border:0.5px solid #444;font-size:10px;opacity:.7">barras a comprar</td>'
      +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:right;font-size:11px">'+totKgLiq.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:right;font-weight:700;font-size:11px">'+totKgBruto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:center;font-size:10px;opacity:.7">—</td>'
      +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:right;font-size:11px">'+totKgLiq.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:6px 8px;border:0.5px solid #444;text-align:right;font-weight:700;font-size:12px">'+totKgBruto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'</tr>';
  }

  var aprovGlobal=totKgLiq>0?(totKgLiq/totKgBruto*100).toFixed(1).replace('.',','):'—';
  var perdaKg=(totKgBruto-totKgLiq).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  el('os-resumo').innerHTML=
    '<div style="flex:1;min-width:120px;border:1.5px solid #003144;border-radius:6px;padding:10px 12px;text-align:center">'
      +'<div style="font-size:9px;font-weight:700;color:#003144;letter-spacing:.04em;margin-bottom:3px">KG LÍQUIDO</div>'
      +'<div style="font-size:16px;font-weight:700;color:#003144">'+totKgLiq.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'
      +'<div style="font-size:9px;color:#888">peso real das peças</div></div>'
    +'<div style="flex:1;min-width:120px;border:1.5px solid #c47012;border-radius:6px;padding:10px 12px;text-align:center;background:#fff8f0">'
      +'<div style="font-size:9px;font-weight:700;color:#c47012;letter-spacing:.04em;margin-bottom:3px">KG BRUTO ★</div>'
      +'<div style="font-size:16px;font-weight:700;color:#003144">'+totKgBruto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'
      +'<div style="font-size:9px;color:#888">barras inteiras — base precificação</div></div>'
    +'<div style="flex:1;min-width:100px;border:1px solid #ddd;border-radius:6px;padding:10px 12px;text-align:center">'
      +'<div style="font-size:9px;font-weight:700;color:#666;letter-spacing:.04em;margin-bottom:3px">APROVEITAMENTO</div>'
      +'<div style="font-size:16px;font-weight:700;color:'+(parseFloat(aprovGlobal.replace(',','.'))<80?'#e74c3c':parseFloat(aprovGlobal.replace(',','.'))<88?'#e67e22':'#27ae60')+'">'+aprovGlobal+'%</div>'
      +'<div style="font-size:9px;color:#888">média geral das barras</div></div>'
    +'<div style="flex:1;min-width:100px;border:1px solid #ddd;border-radius:6px;padding:10px 12px;text-align:center">'
      +'<div style="font-size:9px;font-weight:700;color:#666;letter-spacing:.04em;margin-bottom:3px">TOTAL BARRAS</div>'
      +'<div style="font-size:16px;font-weight:700;color:#444">'+totBarsCount+'</div>'
      +'<div style="font-size:9px;color:#888">peças a comprar</div></div>'
    +'<div style="flex:1;min-width:100px;border:1px solid #ddd;border-radius:6px;padding:10px 12px;text-align:center">'
      +'<div style="font-size:9px;font-weight:700;color:#888;letter-spacing:.04em;margin-bottom:3px">PERDA</div>'
      +'<div style="font-size:16px;font-weight:700;color:#aaa">'+perdaKg+'</div>'
      +'<div style="font-size:9px;color:#888">kg de sobra de corte</div></div>';


  // ── Padrões de Cortes — guardados para o drawer lateral ─────────────────────
  // Adicionar fixo ao d.groupRes para aparecer no gráfico de aproveitamento
  if(_fixosD && _fixosD.cuts.length > 0){
    var _fxGroups={};
    _fixosD.cuts.forEach(function(fc){
      if(!fc.qty||!fc.compMM) return;
      // Garantir kgM via PERFIS_DB se não definido
      if(!fc.kgM){
        var _bfc=fc.code.replace(/-[678]M$/,'');
        for(var _pf=0;_pf<PERFIS_DB.length;_pf++){
          if(PERFIS_DB[_pf].c===fc.code||PERFIS_DB[_pf].c===_bfc){fc.kgM=PERFIS_DB[_pf].kg||0;break;}
        }
      }
      fc.barLenMM = 6000; // fixo sempre 6m
      if(!_fxGroups[fc.code]) _fxGroups[fc.code]={allCuts:[],barLenMM:6000,kgM:fc.kgM||0,pintado:fc.pintado||false};
      // Aplicar split se corte > 5990mm (6000 - 10mm end waste)
      var _fxUsable = 5990;
      for(var _fi=0;_fi<fc.qty;_fi++){
        if(fc.compMM > _fxUsable){
          var _fxPs=_splitCut(fc.compMM, 6000);
          _fxPs.forEach(function(p){ _fxGroups[fc.code].allCuts.push(p); });
        } else {
          _fxGroups[fc.code].allCuts.push(fc.compMM);
        }
      }
    });
    Object.keys(_fxGroups).forEach(function(key){
      var fg=_fxGroups[key];
      var bars=binPackFFD(fg.allCuts,fg.barLenMM);
      var fUsed=fg.allCuts.reduce(function(s,x){return s+x;},0);
      var fBruto=bars.reduce(function(s,b){return s+b.barLen;},0);
      var fAprov=fBruto>0?fUsed/fBruto*100:0;
      var fKgLiq=fUsed/1000*fg.kgM, fKgBru=fBruto/1000*fg.kgM;
      var fBarsDetail=bars.map(function(b){
        return {len:b.barLen,items:b.items.slice().sort(function(a,x){return x-a;}),
                remaining:b.remaining,sobra:b.sobra!=null?b.sobra:b.remaining};
      });
      if(d.groupRes[key]){
        // Perfil já existe na porta — apenas adicionar os cortes ao groupRes existente
        var existing=d.groupRes[key];
        // Reconstruir allCuts originais da porta a partir do barsDetail
        var allOrigCuts=[];
        if(existing.barsDetail){
          existing.barsDetail.forEach(function(b){
            b.items.forEach(function(p){allOrigCuts.push(p);});
          });
        }
        var allCombined=allOrigCuts.concat(fg.allCuts); // porta(já split) + fixo(já split)
        var kgM=fg.kgM||(existing.totUsed>0?existing.kgLiq/(existing.totUsed/1000):0)||0;
        var cBars=binPackFFD(allCombined,existing.barLenMM);
        var cUsed=allCombined.reduce(function(s,x){return s+x;},0);
        var cBruto=cBars.reduce(function(s,b){return s+b.barLen;},0);
        existing.nBars=cBars.length;
        existing.totUsed=cUsed; existing.totBruto=cBruto;
        existing.aprov=cBruto>0?cUsed/cBruto*100:0;
        existing.kgLiq=cUsed/1000*kgM;
        existing.kgBruto=cBruto/1000*kgM;
        existing.barsDetail=cBars.map(function(b){return {len:b.barLen,items:b.items.slice().sort(function(a,x){return x-a;}),remaining:b.remaining,sobra:b.sobra!=null?b.sobra:b.remaining};});
      } else {
        // Perfil novo (só no fixo) — adicionar ao groupRes e seenKeys
        d.groupRes[key]={nBars:bars.length,totUsed:fUsed,totBruto:fBruto,aprov:fAprov,
          kgLiq:fKgLiq,kgBruto:fKgBru,precoKg:0,custoPerfil:0,custoPintura:0,custoTotal:0,
          barLenMM:fg.barLenMM,pintado:false,barsDetail:fBarsDetail};
        d.seenKeys.push(key);
      }
    });
  }

  window._lastPadroesHTML = _renderPadroesContent(d, 9);

  // ── Relação de Barras (CEM format) ────────────────────────────────────────
  // Group profiles: BNF-PA-TECNOPERFIL (pintados) vs BRUTO
  // Weight calc: round(kg/m * barLen_m, 2) * nBars  [CEM standard]
  var precoPint=d.precoPint; // declarado ANTES do forEach que o usa
  var bnfRows=[], brutoRows=[];

  d.seenKeys.forEach(function(key){
    var r=d.groupRes[key];if(!r)return;
    var perf=d.cuts.filter(function(c){return c.code===key;})[0];
    var kgM=perf&&perf.perf?perf.perf.kg:(perf&&perf.kgM?perf.kgM:0);
    // fallback: buscar em PERFIS_DB
    if(!kgM){ var _bc=key.replace(/-[678]M$/,''); for(var _pi=0;_pi<PERFIS_DB.length;_pi++){if(PERFIS_DB[_pi].c===key||PERFIS_DB[_pi].c===_bc){kgM=PERFIS_DB[_pi].kg||0;break;}} }
    var barLenM=r.barLenMM/1000;
    var kgPerBarRnd=Math.round(kgM*barLenM*100)/100;
    var pesoBrutoRnd=Math.round(kgPerBarRnd*r.nBars*1000)/1000;
    var precoKgMat=r.precoKg||0;
    var precoKgPint=r.pintado?(precoPint||0):0;
    var precoTotal=precoKgMat+precoKgPint;
    /* ╔══════════════════════════════════════════════════════════════════╗
       ║  REGRA DE PREÇO PERFIS:                                        ║
       ║  custo = PESO BRUTO (total barras) × PREÇO por KG (líquido)   ║
       ║  NÃO ALTERE esta lógica!                                       ║
       ╚══════════════════════════════════════════════════════════════════╝ */
    var custoLinha=Math.round(pesoBrutoRnd*precoTotal*100)/100;
    var _isBois=!!(r._isBoiserie||r._barPrice);
    // Boiserie: custo = nBars × R$150 (não por kg)
    if(_isBois && r._barPrice){
      custoLinha=r.nBars*(r._barPrice||150);
      precoKgMat=0; precoKgPint=0; precoTotal=0;
    }
    var row={
      code:key, nBars:r.nBars, barLen:r.barLenMM, barLenM:barLenM,
      kgPerBarRnd:kgPerBarRnd, pesoBruto:pesoBrutoRnd||0,
      pintado:r.pintado, _isBoiserie:_isBois, _barPrice:r._barPrice||0,
      precoKgMat:precoKgMat, precoKgPint:precoKgPint, precoTotal:precoTotal,
      custo:custoLinha||0, kgLiq:r.kgLiq||0
    };
    if(r.pintado) bnfRows.push(row); else brutoRows.push(row);
  });

  function renderRelacaoGroup(rows,groupLabel,groupBg,groupColor,startPR){
    var html='';
    var subtotalKg=0, subtotalCusto=0;
    var pr=startPR;
    // Group header
    html+='<tr style="background:'+groupBg+'">'
      +'<td colspan="9" style="padding:5px 10px;border:0.5px solid #ddd;font-weight:700;font-size:11px;color:'+groupColor+'">'
      +groupLabel+'</td></tr>';
    rows.forEach(function(row){
      subtotalKg+=row.pesoBruto;
      subtotalCusto+=row.custo;
      var pintaStr=row.pintado
        ?'+ R$ '+((row.precoKgPint||0).toFixed(2))+'/kg pint.'
        :'';
      var precoColStr='R$ '+((row.precoKgMat||0).toFixed(2));
      // Boiserie: mostrar preço por barra
      if(row._isBoiserie && row._barPrice){
        pintaStr='';
        precoColStr='R$ '+row._barPrice+'/barra';
      }
      html+='<tr style="background:#fff">'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;color:#aaa;font-size:10px">'+pr+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;font-weight:700;font-size:10.5px;color:'+(row.pintado?'#6c3483':'#003144')+'">'+row.code+(row.pintado?' 🎨':'')+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;font-weight:700;font-size:11px;color:var(--orange)">'+row.nBars+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;font-size:10px">'+row.barLen+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:right;font-weight:700;font-size:11px">'+((row.pesoBruto||0).toFixed(3)).replace('.',',')+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;border-right:2px dashed #ccc;color:#ddd">___</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:right;font-size:10px;color:#555">'+precoColStr+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:right;font-weight:700;font-size:11px;color:#003144">R$ '+((row.custo||0).toFixed(2)).replace('.',',')+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;font-size:9px;color:#888">'+pintaStr+'</td>'
        +'</tr>';
      pr++;
    });
    // Subtotal row
    html+='<tr style="background:#f0f4f0;font-weight:700">'
      +'<td colspan="4" style="padding:5px 8px;border:0.5px solid #ddd;font-size:10px;color:#555">Subtotal '+groupLabel+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ddd;text-align:right;font-weight:700;font-size:12px">'+subtotalKg.toFixed(3).replace('.',',')+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ddd"></td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ddd"></td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ddd;text-align:right;font-weight:700;font-size:12px;color:#003144">R$ '+subtotalCusto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:5px 8px;border:0.5px solid #ddd"></td>'
      +'</tr>';
    return {html:html,kg:subtotalKg,custo:subtotalCusto,pr:pr};
  }

  // ── Acessórios (fechadura, roseta, cilindro) ─────────────────────────────────
  var _acessRows=_calcAcessoriosAllItems(d, d.sis||sis);
  var _qPAc=window._mpItens&&window._mpItens.length>0?window._mpItens.reduce(function(s,it){return s+(parseInt(it._qtd||it['qtd-portas'])||1);},0):window._qPOS||parseInt(($('qtd-portas')||{value:'1'}).value)||1;
  var _totalAcess = _renderAcessoriosOS(_acessRows);
  // Nota: o valor total de acessórios será sincronizado com fab-custo-acess
  // pela função _renderOSAcess, que inclui o pivô no cálculo.

  // ── Veda Porta ──────────────────────────────────────────────────────────────
  var vedaTbody = el('osa-veda-tbody');
  if(vedaTbody && (d.vedaSize || (vedaInfo&&vedaInfo.multi))){
    var phRow = document.getElementById('osa-veda-placeholder');
    if(phRow) phRow.style.display = 'none';
    var savedPrecos = {};
    try{ var _s=localStorage.getItem('projetta_comp_precos'); if(_s) savedPrecos=JSON.parse(_s); }catch(e){}

    if(vedaInfo&&vedaInfo.multi){
      // Multi-porta: uma linha por porta
      var _vedaHTML='';
      var _vedaTotalGeral=0;
      vedaInfo.list.forEach(function(vi){
        var vedaPreco=0;
        for(var _i=0;_i<COMP_DB.length;_i++){if(COMP_DB[_i].c===vi.code){vedaPreco=savedPrecos[vi.code]!==undefined?savedPrecos[vi.code]:COMP_DB[_i].p;break;}}
        var vedaTotal=vedaPreco*vi.qty;
        _vedaTotalGeral+=vedaTotal;
        _vedaHTML+='<tr style="background:#f9f8f5">'
          +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;font-weight:700">'+vi.qty+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #eee;font-weight:700;color:#1a5276">'+vi.code+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #eee">Veda porta '+vi.size+'mm — <b>'+vi.label+'</b></td>'
          +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:center">'+vi.size+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:right">'+(vedaPreco>0?'R$ '+vedaPreco.toFixed(2):'—')+'</td>'
          +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:right;font-weight:700">'+(vedaTotal>0?'R$ '+vedaTotal.toFixed(2):'—')+'</td>'
          +'</tr>'
          +'<tr style="background:#fafafa"><td colspan="6" style="padding:2px 8px;font-size:9px;color:#888;border:0.5px solid #eee">'
          +'Folha PA-PA: '+vi.folhaPAPA+'mm → Veda: '+vi.size+'mm'
          +'</td></tr>';
      });
      vedaTbody.innerHTML=_vedaHTML;
    } else {
      // Single porta (original)
      var vedaPreco = 0;
      for(var _i=0;_i<COMP_DB.length;_i++){
        if(COMP_DB[_i].c===d.vedaCode){
          vedaPreco = savedPrecos[d.vedaCode]!==undefined ? savedPrecos[d.vedaCode] : COMP_DB[_i].p;
          break;
        }
      }
      var _vedaQtyTotal=d.vedaQty*(_qPAc||1);
      var vedaTotal = vedaPreco * _vedaQtyTotal;
      vedaTbody.innerHTML = '<tr style="background:#f9f8f5">'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;font-weight:700">'+_vedaQtyTotal+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;font-weight:700;color:#1a5276">'+d.vedaCode+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee">Veda porta '+(d.vedaSize)+'mm</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:center">'+d.vedaSize+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:right">'+(vedaPreco>0?'R$ '+vedaPreco.toFixed(2):'—')+'</td>'
        +'<td style="padding:4px 8px;border:0.5px solid #eee;text-align:right;font-weight:700">'+(vedaTotal>0?'R$ '+vedaTotal.toFixed(2):'—')+'</td>'
        +'</tr>'
        +'<tr style="background:#fafafa"><td colspan="2" style="padding:3px 8px;font-size:9px;color:#888;border:0.5px solid #eee">'
        +'Folha PA-PA: '+Math.round(d.folhaPAPA)+'mm → Veda selecionado: '+d.vedaSize+'mm'
        +'</td><td colspan="4" style="padding:3px 8px;font-size:9px;color:#888;border:0.5px solid #eee">'
        +(vedaPreco===0?'⚠ Cadastre o preço na aba Acessórios':'')
        +'</td></tr>';
    }
  }

  // ── Padrões de Cortes ─────────────────────────────────────────────────────
    window._lastPadroesHTML = _renderPadroesContent(d, 9);
  window._lastOSData = d; // store for weight recalc

  // ── Atualizar aba OS Acessórios ───────────────────────────────────────────
  var _vedaInfo = d.vedaSize ? {qty:d.vedaQty*(_qPAc||1), code:d.vedaCode, size:d.vedaSize, folhaPAPA:d.folhaPAPA} : null;
  window._lastVedaInfo = _vedaInfo; // global for _calcAcessoriosOS
  _renderOSAcess(d, _acessRows, _vedaInfo);
  var btnAprov = document.getElementById('btn-aproveitamento');
  if(btnAprov) btnAprov.style.display = '';  // mostra o botão

  var relTbody=el('os-relacao-tbody');
  if(relTbody){
    var bnfResult=renderRelacaoGroup(bnfRows,'BNF-PA-TECNOPERFIL','#eef4fb','#003144',1);
    var brutoResult=renderRelacaoGroup(brutoRows,'BRUTO','#f5f5f2','#444',bnfResult.pr);
    relTbody.innerHTML=bnfResult.html+brutoResult.html;

    var grandKg=bnfResult.kg+brutoResult.kg;
    var grandCusto=bnfResult.custo+brutoResult.custo;
    var relTfoot=el('os-relacao-tfoot');
    if(relTfoot) relTfoot.innerHTML='<tr style="background:#003144;color:#fff">'
      +'<td colspan="4" style="padding:6px 10px;border:0.5px solid #555;font-weight:700;font-size:11px;letter-spacing:.04em">TOTAL:</td>'
      +'<td style="padding:6px 10px;border:0.5px solid #555;text-align:right;font-weight:700;font-size:12px">'+grandKg.toFixed(3).replace('.',',')+'</td>'
      +'<td colspan="2" style="border:0.5px solid #555"></td>'
      +'<td style="padding:6px 10px;border:0.5px solid #555;text-align:right;font-weight:700;font-size:12px">R$ '+grandCusto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="border:0.5px solid #555"></td>'
      +'</tr>';
  }

  window._lastPerfisTotal=totCusto;

  // ── Lançar custos na aba Fabricação ──────────────────────────────────────
  var totalMatFab=0, totalPinFab=0;
  d.seenKeys.forEach(function(key){
    var r=d.groupRes[key];if(!r)return;
    totalMatFab+=r.custoPerfil||0;
    totalPinFab+=r.custoPintura||0;
  });
  var elMat2=document.getElementById('fab-mat-perfis');
  var elPin2=document.getElementById('fab-custo-pintura');
  _fabSetSysValue('mat', totalMatFab);
  _fabSetSysValue('pin', totalPinFab);
  syncFabPerfisTotal();
  calc();

  el('os-empty').style.display='none';
  el('os-doc').style.display='';
  // Renderizar perfis do fixo separados
  try{ _renderFixosPerfis(); }catch(efxp){}

  // switchTab('os') só quando chamado explicitamente pelo botão
  if (!window._osAutoMode) switchTab('os');
  } catch(err) {
    console.error('[gerarOS] ERROR:', err);
    var emEl = document.getElementById('os-empty');
    if(emEl) {
      emEl.style.display='';
      emEl.innerHTML = '<div style="color:#c0392b;padding:16px;background:#fdf0f0;border-radius:6px;border:1px solid #e74c3c;font-size:12px">'
        + '<b>Erro ao gerar OS:</b><br>' + (err.message||String(err))
        + '<br><small style="color:#888">Informe este erro para suporte.</small></div>';
    } else {
      alert('ERRO: ' + err.message);
    }
  }
}

// ── DRAWER APROVEITAMENTO ─────────────────────────────────────────────────────
function abrirAproveitamento(){
  var html = window._lastPadroesHTML || '<div style="text-align:center;color:#888;padding:32px">Gere a OS primeiro.</div>';
  document.getElementById('aprov-title').textContent='Padrões de Cortes — Aproveitamento de Barras';
  document.getElementById('aprov-subtitle').textContent='Serra: 9mm/corte  |  Algoritmo: First Fit Decreasing (FFD)';
  document.getElementById('aprov-content').innerHTML = html;
  var bd = document.getElementById('aprov-backdrop');
  var dr = document.getElementById('aprov-drawer');
  bd.style.display = 'block';
  dr.style.display = 'block';
  // Force reflow for transition
  dr.offsetHeight;
  bd.classList.add('open');
  dr.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function fecharAproveitamento(){
  var bd = document.getElementById('aprov-backdrop');
  var dr = document.getElementById('aprov-drawer');
  bd.classList.remove('open');
  dr.classList.remove('open');
  setTimeout(function(){
    bd.style.display = 'none';
    dr.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}
function _printAproveitamento(){
  var mainLogo = document.querySelector('.header-brand img');
  var printLogo = document.getElementById('aprov-print-logo');
  if(mainLogo && printLogo) printLogo.src = mainLogo.src;
  var info = document.getElementById('aprov-print-info');
  if(info){
    var cli=($('cliente')||{value:''}).value||'—';
    var agp=($('num-agp')||{value:''}).value||'—';
    var atp=($('num-atp')||{value:''}).value||'—';
    info.textContent='Cliente: '+cli+'  |  AGP: '+agp+'  |  ATP: '+atp;
  }
  var hdr = document.getElementById('aprov-print-hdr');
  if(hdr) hdr.style.display = 'flex';
  document.body.classList.add('print-aprov');
  window.print();
  document.body.classList.remove('print-aprov');
  if(hdr) hdr.style.display = 'none';
}

/* ══ RELATÓRIO: RELAÇÃO DE BARRAS ═══════════════════════════════════════════ */

/* ══ END MODULE: OS_PRODUCAO ══ */
