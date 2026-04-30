/* ============================================================================
 * js/144-subtabs-orcamento.js  —  Sub-navegacao da aba Orcamento (28-abr-2026)
 *
 * Felipe 28/04: 5 abas (Proposta Comercial, Levantamento Perfis, Acessorios,
 * Superficies, Relatorios) viraram sub-abas DENTRO da aba Orcamento.
 *
 * Mostra a barra de sub-abas SO quando a aba ativa e uma das 6:
 *   orcamento, proposta, os, os-acess, planificador, relatorios.
 *
 * Hook em window.switchTab para gerenciar visibilidade e estado ativo.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta144Applied) return;
  window.__projetta144Applied = true;

  var SUB_TABS = ['orcamento','proposta','os','os-acess','planificador','relatorios'];

  function aplicarEstadoSubNav(tab){
    var subNav = document.getElementById('sub-tabs-orc');
    if(!subNav) return;
    var noEscopo = SUB_TABS.indexOf(tab) >= 0;
    subNav.style.display = noEscopo ? 'flex' : 'none';

    if(noEscopo){
      // Marca tambem o botao "Orcamento" do main-tab como ativo (visualmente)
      var btnOrc = document.getElementById('btn-tab-orcamento');
      if(btnOrc){
        document.querySelectorAll('.main-tab').forEach(function(b){ b.classList.remove('on'); });
        btnOrc.classList.add('on');
      }

      // Marcar sub-tab ativa
      subNav.querySelectorAll('.sub-tab').forEach(function(b){
        var ativa = b.getAttribute('data-tab') === tab;
        b.classList.toggle('on', ativa);
        b.style.background = ativa ? '#0C447C' : 'rgba(255,255,255,.6)';
        b.style.color = ativa ? '#fff' : '#333';
        b.style.borderColor = ativa ? '#0C447C' : 'transparent';
        b.style.boxShadow = ativa ? '0 2px 6px rgba(12,68,124,.25)' : 'none';
      });
    }
  }

  // Hook switchTab original
  function instalarHook(){
    var orig = window.switchTab;
    if(!orig){
      // Tenta de novo em 100ms - switchTab ainda nao foi definido
      setTimeout(instalarHook, 100);
      return;
    }
    if(orig.__sub144Hooked) return;

    window.switchTab = function(tab){
      var r = orig.apply(this, arguments);
      try { aplicarEstadoSubNav(tab); } catch(e){ console.warn('[144 subnav]', e); }
      return r;
    };
    window.switchTab.__sub144Hooked = true;
    console.log('[144 subnav] hook instalado em switchTab');
  }

  function init(){
    instalarHook();
    // Aplicar estado inicial baseado na aba atualmente ativa
    setTimeout(function(){
      var ativa = document.querySelector('.main-tab.on');
      if(!ativa) return;
      var m = (ativa.getAttribute('onclick') || '').match(/switchTab\(['"]([\w-]+)['"]\)/);
      if(m && m[1]) aplicarEstadoSubNav(m[1]);
    }, 300);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
