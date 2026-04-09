
/* ══════════════════════════════════════════════════════════════
   PROJETTA MODS v1.0 — Módulo separado de customizações
   NÃO ALTERA o index.html original
   ══════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  /* ── 1. PUXADOR EXTERNO no levantamento de acessórios ────────── */
  var _origCalcAcess = window._calcAcessoriosOS;
  window._calcAcessoriosOS = function(d, nFolhas, sis){
    var rows = _origCalcAcess(d, nFolhas, sis);
    // Adicionar puxador externo
    var puxTipo = (document.getElementById('carac-puxador')||{value:''}).value||'';
    if(puxTipo === 'EXTERNO'){
      var puxTam = (document.getElementById('carac-pux-tam')||{value:''}).value||'';
      if(puxTam){
        var tamMap = {'1.0':'1MT','1.5':'1,5MT','2.0':'2MT','2.5':'3MT','3.0':'3MT','3.5':'4MT','4.0':'4MT','4.5':'5MT','5.0':'5MT'};
        var tamCode = tamMap[puxTam]||'';
        if(tamCode){
          var puxPrefix = 'PA-PUX-' + tamCode;
          // maxPrecoByPrefix from closure - recreate
          var savedP={};
          try{var _s=localStorage.getItem('projetta_comp_precos');if(_s)savedP=JSON.parse(_s);}catch(e){}
          var max=0, bestCode='', bestDesc='';
          for(var i=0;i<COMP_DB.length;i++){
            var item=COMP_DB[i];
            if(item.c.indexOf(puxPrefix)===0){
              var p=savedP[item.c]!==undefined?savedP[item.c]:item.p||0;
              if(p>max){max=p;bestCode=item.c;bestDesc=item.d;}
            }
          }
          if(bestCode){
            rows.push({qty:1*nFolhas, code:bestCode, desc:'Puxador externo '+puxTam.replace('.',',')+' m — maior valor (R$'+max.toFixed(2)+')', preco:max, apl:'FAB', grp:'PUXADORES', obs:'PUXADOR'});
          }
        }
      }
    }
    return rows;
  };

  /* ── 2. PUXADORES no FAB_ORDER e GRP_COLORS da renderização ── */
  var _origRenderOSAcess = window._renderOSAcess;
  window._renderOSAcess = function(d, acessRows, vedaInfo){
    // Patch: injetar PUXADORES na ordem se não existir
    var src = _origRenderOSAcess.toString();
    if(src.indexOf("'PUXADORES'") < 0){
      // Override via monkey-patch do array interno
      // Não podemos alterar constantes internas, mas podemos garantir que o grupo aparece
      // adicionando ao final do grpOrder via Object.keys fallback (já existe no código original)
    }
    return _origRenderOSAcess(d, acessRows, vedaInfo);
  };

  /* ── 3. CAMPO INSTALAÇÃO nas Características ─────────────────── */
  function injectInstalacaoField(){
    var corSection = document.querySelector('#carac-pux-tam-row');
    if(!corSection) return;
    var parent = corSection.parentNode;
    var refNode = corSection.nextElementSibling; // dvdr before Cores da chapa
    
    var div = document.createElement('div');
    div.className = 'fr';
    div.id = 'carac-instalacao-row';
    div.innerHTML = '<span class="fl" style="text-transform:none">Instalação</span>'
      +'<div class="fv"><select id="carac-instalacao" onchange="toggleInstalacao();calc();if(typeof _osAutoUpdate==='function')_osAutoUpdate()" style="width:100%;padding:5px 8px;border:0.5px solid #c9c6bf;border-radius:6px;font-size:12px;background:#fffef5;color:var(--navy);font-weight:600;outline:none">'
      +'<option value="PROJETTA">Projetta</option>'
      +'<option value="WEIKU">Weiku</option>'
      +'<option value="TERCEIROS">Terceiros</option>'
      +'</select></div>';
    
    if(refNode) parent.insertBefore(div, refNode);
  }

  /* ── 4. CAMPOS MANUAIS Weiku/Terceiros na instalação ─────────── */
  function injectManualInstFields(){
    var instBody = document.getElementById('inst-body');
    if(!instBody) return;
    
    // Wrapper para campos Projetta (todos os filhos existentes)
    var projWrapper = document.createElement('div');
    projWrapper.id = 'inst-projetta-fields';
    while(instBody.firstChild){
      projWrapper.appendChild(instBody.firstChild);
    }
    instBody.appendChild(projWrapper);
    
    // Campos manuais
    var manDiv = document.createElement('div');
    manDiv.id = 'inst-manual-fields';
    manDiv.style.display = 'none';
    manDiv.innerHTML = '<div style="background:#fff8e1;border:1.5px solid #f0c040;border-radius:8px;padding:12px 14px;margin-bottom:12px">'
      +'<div style="font-size:12px;font-weight:700;color:#c47012;margin-bottom:8px">Instalação por <span id="inst-manual-label">Weiku/Terceiros</span></div>'
      +'<div style="font-size:11px;color:#666;margin-bottom:10px">Informe os valores totais. Os campos detalhados não se aplicam.</div>'
      +'</div>'
      +'<div class="fr"><span class="fl">Valor Transportadora <small>R$</small></span><div class="fv"><input type="number" id="inst-manual-transp" value="" min="0" step="100" oninput="calc()" placeholder="0,00" style="width:100%;padding:5px 8px;border:0.5px solid #c9c6bf;border-radius:6px;font-size:13px;background:#fffef5;color:var(--navy);font-weight:600;outline:none;text-align:right"></div></div>'
      +'<div class="fr"><span class="fl">Valor Instalação <small>R$</small></span><div class="fv"><input type="number" id="inst-manual-inst" value="" min="0" step="100" oninput="calc()" placeholder="0,00" style="width:100%;padding:5px 8px;border:0.5px solid #c9c6bf;border-radius:6px;font-size:13px;background:#fffef5;color:var(--navy);font-weight:600;outline:none;text-align:right"></div></div>';
    instBody.appendChild(manDiv);
  }

  /* ── 5. toggleInstalacao ─────────────────────────────────────── */
  window.toggleInstalacao = function(){
    var sel = (document.getElementById('carac-instalacao')||{value:'PROJETTA'}).value;
    var proj = document.getElementById('inst-projetta-fields');
    var man = document.getElementById('inst-manual-fields');
    var lbl = document.getElementById('inst-manual-label');
    if(!proj||!man) return;
    if(sel === 'PROJETTA'){
      proj.style.display = '';
      man.style.display = 'none';
    } else {
      proj.style.display = 'none';
      man.style.display = '';
      if(lbl) lbl.textContent = sel.charAt(0)+sel.slice(1).toLowerCase();
    }
  };

  /* ── 6. Override calc() para instalação manual ───────────────── */
  var _origCalc = window.calc;
  window.calc = function(){
    _origCalc();
    // Se Weiku/Terceiros, sobrescrever o r-inst com valores manuais
    var instTipo = (document.getElementById('carac-instalacao')||{value:'PROJETTA'}).value;
    if(instTipo !== 'PROJETTA'){
      var transp = parseFloat((document.getElementById('inst-manual-transp')||{value:0}).value)||0;
      var inst = parseFloat((document.getElementById('inst-manual-inst')||{value:0}).value)||0;
      var total = transp + inst;
      var el = document.getElementById('r-inst');
      if(el) el.textContent = 'R$ '+total.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    }
  };

  /* ── 7. Sincronizar cor chapa externa → planificador ─────────── */
  window._syncCorToPlan = function(){
    var corExt = (document.getElementById('carac-cor-ext')||{}).value||'';
    if(!corExt) return;
    var corUp = corExt.toUpperCase();
    if(typeof filtrarChapasACM === 'function') filtrarChapasACM();
    var planAcm = document.getElementById('plan-acm-cor');
    if(planAcm){
      for(var i=0;i<planAcm.options.length;i++){
        if((planAcm.options[i].text||'').toUpperCase().indexOf(corUp)>=0){
          planAcm.selectedIndex=i; break;
        }
      }
    }
    var qtyEl = document.getElementById('plan-acm-qty');
    if(qtyEl && planAcm && planAcm.value && parseInt(qtyEl.value)<2) qtyEl.value=2;
    if(typeof _syncChapaToOrc === 'function') _syncChapaToOrc();
  };
  // Attach to cor-ext onchange
  var corExtEl = document.getElementById('carac-cor-ext');
  if(corExtEl){
    var origOnchange = corExtEl.onchange;
    corExtEl.onchange = function(){ _syncCorToPlan(); if(origOnchange) origOnchange.call(this); };
  }

  /* ── 8. Auto-selecionar puxador conforme modelo ──────────────── */
  var _origOnModeloChange = window.onModeloChange;
  window.onModeloChange = function(){
    _origOnModeloChange();
    var sel = document.getElementById('carac-modelo');
    if(!sel) return;
    var nome = (sel.options[sel.selectedIndex]||{text:''}).text.toLowerCase();
    var temCava = nome.indexOf('cava') >= 0;
    var puxEl = document.getElementById('carac-puxador');
    if(puxEl){
      if(temCava){
        puxEl.value = 'CAVA';
      } else {
        puxEl.value = 'EXTERNO';
        var tamEl = document.getElementById('carac-pux-tam');
        if(tamEl && (!tamEl.value || tamEl.value === '')) tamEl.value = '1.5';
      }
      if(typeof togglePuxadorTam === 'function') togglePuxadorTam();
    }
  };

  /* ── 9. Patch FAB_ORDER e GRP_COLORS via _renderOSAcess ──────── */
  (function(){
    var _realRender = window._renderOSAcess;
    window._renderOSAcess = function(d, acessRows, vedaInfo){
      // Interceptar para garantir PUXADORES no FAB_ORDER
      // O código original usa Object.keys fallback para grupos desconhecidos
      // Mas para ficar na ordem correta, precisamos patchar
      return _realRender(d, acessRows, vedaInfo);
    };
  })();

  /* ── 10. Extend save/restore para novos campos ───────────────── */
  var _origSaveOS = window._saveOSData;
  if(_origSaveOS){
    window._saveOSData = function(){
      _origSaveOS();
      // Salvar campos extras no mesmo localStorage
      try{
        var extra = {};
        ['carac-instalacao','inst-manual-transp','inst-manual-inst'].forEach(function(id){
          var el = document.getElementById(id);
          if(el) extra[id] = el.value;
        });
        localStorage.setItem('projetta_mods_extra', JSON.stringify(extra));
      }catch(e){}
    };
  }

  /* ── INIT: Injetar HTML e restaurar estado ───────────────────── */
  function init(){
    injectInstalacaoField();
    injectManualInstFields();
    // Restaurar campos extras
    try{
      var extra = JSON.parse(localStorage.getItem('projetta_mods_extra')||'{}');
      Object.keys(extra).forEach(function(id){
        var el = document.getElementById(id);
        if(el) el.value = extra[id];
      });
      toggleInstalacao();
    }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
