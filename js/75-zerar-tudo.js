/**
 * 75-zerar-tudo.js v5
 *   - PROTEGE parâmetros financeiros (overhead, impostos, comissões, markup, desconto)
 *   - ZERA displays de RESULTADO manualmente (cards com R$ 0) depois do clear
 *   - Chama calc() pra recalcular com inputs vazios
 *   - Auto-calc planificador (chama planRun)
 *   - CSS: plan-auto-info sempre visível + esconde Anexos + melhora busca cor
 */
(function(){
  'use strict';

  // ─── CSS INJETADO ──────────────────────────────────────────────────────
  var css = document.createElement('style');
  css.id = 'projetta-fixes-css';
  css.textContent = [
    '#crm-attach-section, #crm-attach-section + * { display:none !important; }',
    '.crm-section-label[data-felipe-hide-anexos="1"] { display:none !important; }',
    '.crm-color-search { padding:6px 10px !important; font-size:12px !important; }',
    '.crm-color-search::placeholder { color:#aaa; font-size:11px; }',
    '.crm-color-search:focus { background:#fff !important; border-color:#4caf50 !important; }',
    '#plan-auto-info { display:block !important; min-height:80px; }',
    '#plan-auto-info:empty::before { content:"👇 Preencha os campos acima ou clique em Calcular aproveitamento"; color:#7a8794; font-size:11px; display:block; text-align:center; padding:18px 10px; font-weight:600; }'
  ].join('\n');
  if(document.head) document.head.appendChild(css);
  else setTimeout(function(){ if(document.head) document.head.appendChild(css); }, 500);

  // Esconder label "Anexos" quando aparece
  function _esconderLabelAnexos(){
    var labels = document.querySelectorAll('.crm-section-label');
    for(var i=0;i<labels.length;i++){
      if((labels[i].textContent||'').indexOf('Anexos') >= 0){
        labels[i].setAttribute('data-felipe-hide-anexos','1');
      }
    }
  }
  setInterval(_esconderLabelAnexos, 1500);

  // ─── WHITELIST DE PROTEGIDOS ─────────────────────────────────────────
  // PARÂMETROS FINANCEIROS: NUNCA zerar — são configurações do negócio
  var ID_PROTEGIDOS = {};
  [// Financeiro (CRÍTICO — Felipe 24/04)
   'overhead','impostos','com-rep','com-rt','com-gest','lucro-alvo','markup-desc','desconto',
   // Login/Admin
   'login-user','login-pass','admin-new-user','admin-new-pass',
   // CRM filtros
   'crm-search','crm-new-orig','crm-new-prod','crm-new-member','crm-new-member-color',
   'crm-f-periodo-de','crm-f-periodo-ate','crm-f-periodo-filter',
   'crm-f-scope-filter','crm-f-data-ref','crm-f-resp-filter',
   'crm-f-wrep-filter','crm-f-gerente-filter','crm-f-regiao-filter',
   'crm-f-cor-filter','crm-f-modelo-filter','crm-f-origin-filter',
   'crm-f-cidade-filter','crm-f-estado-filter','crm-map-filter',
   'cli-hist-sort','cli-hist-search','hist-search',
   'ck-gain-ano-sel','ck-gain-mes-sel',
   'cad-wrep-busca','cad-wrep-cargo','cad-wrep-regiao','cad-wrep-gerente',
   'eomie-search','eomie-f-com-saldo','eomie-f-abaixo-min',
   'pf-kg-weiku','pf-kg-mercado','pf-kg-tecnoperfil',
   'pf-ded-weiku','pf-ded-mercado','pf-ded-tecnoperfil','pf-ded-pintura',
   'pf-preco-pintura','pf-barra-m','pf-db-filtro','pf-f-desc','pf-f-forn','pf-f-cod',
   'msg-padrao-texto',
   'import-acess','import-perfis','import-precos',
   'crm-import-file','crm-import-text','crm-attach-input',
   'plan-manual-xls-file','nfe-upload','nfe-chave',
   'new-chapa-nome','new-chapa-tipo','new-chapa-preco',
   'new-cp-un','new-cp-cat','new-cp-code','new-cp-desc','new-cp-forn','new-cp-preco',
   'new-pf-kg','new-pf-code','new-pf-desc','new-pf-forn',
   'comp-f-cat','comp-f-cod','comp-f-desc','comp-f-forn','comp-filtro',
   'frete-admin-id','frete-admin-dap','frete-admin-obs','frete-admin-ex-ams',
   'frete-admin-usd-cbm','frete-admin-usd-flat','frete-admin-validade',
   'frete-admin-destino-uf','frete-admin-destino-nome','frete-admin-destino-pais',
   'frete-admin-modal','frete-admin-ex-handling','frete-admin-ex-customs-fcl',
   'frete-admin-ex-customs-lcl','frete-admin-ex-prestacking',
   'frete-admin-thc-override','frete-admin-loading-override','frete-admin-ad-valorem',
   'filtro-logicas-perfis'
  ].forEach(function(id){ ID_PROTEGIDOS[id] = 1; });

  // IDs de DISPLAYS de resultado (pra zerar manualmente)
  var DISPLAYS_VALOR = [
    'm-custo-porta','m-custo-porta-m2','m-mkp-porta',
    'm-tab-porta','m-tab-porta-m2','m-fat-porta','m-fat-porta-m2',
    'd-custo-fab','d-custo-inst','d-tab-sp','d-fat-sp','d-tab-inst','d-fat-inst',
    's-cm2','s-tm2','s-fm2','s-tm2p','s-fm2p',
    'r-total-tabela','r-total-fat','r-custo-fab','r-custo-inst',
    'r-custo-total','r-markup','r-margem-bruta','r-margem-liquida',
    'r-custo-m2','r-tab-m2','r-fat-m2',
    'prop-area-total','prop-total-orc'
  ];
  var DISPLAYS_PCT = ['pct-mb-porta','pct-ml-porta'];
  var BARRAS = ['bar-mb-porta','bar-ml-porta'];

  function _toast(msg, cor, ms){
    var t = document.getElementById('zerar-toast');
    if(t) t.remove();
    t = document.createElement('div');
    t.id = 'zerar-toast';
    t.style.cssText =
      'position:fixed;top:80px;right:20px;background:' + cor + ';color:#fff;' +
      'padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;' +
      'z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);font-family:inherit';
    t.innerHTML = msg;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 3500);
  }

  function zerarTudo(){
    if(!confirm('⚠ ZERAR ORÇAMENTO?\n\nItens, cliente, dimensões e resultado serão apagados.\nParâmetros financeiros, CRM e login NÃO serão afetados.\n\nContinuar?')) return;

    // 1) Arrays globais
    window._orcItens = [];
    window._mpItens = [];
    window._crmItens = [];
    window._orcItemAtual = -1;
    window._mpEditingIdx = -1;
    window._crmOrcCardId = null;
    window._crmScope = null;
    window._pendingRevision = false;
    window._osGeradoUmaVez = false;
    window._calcResult = null;
    try { window.currentId = null; window.currentRev = null; } catch(e){}
    if(document.body) document.body.removeAttribute('data-scope');

    // 2) Zerar inputs/selects/textareas (exceto whitelist)
    var els = document.querySelectorAll('input, select, textarea');
    var count = 0;
    for(var i = 0; i < els.length; i++){
      var el = els[i];
      if(el.id && ID_PROTEGIDOS[el.id]) continue;
      if(el.type === 'file') continue;
      if(el.type === 'checkbox' || el.type === 'radio'){
        if(el.checked){ el.checked = false; count++; }
      } else if(el.tagName.toLowerCase() === 'select'){
        if(el.value !== ''){ el.selectedIndex = 0; el.value = ''; count++; }
      } else {
        if(el.value !== ''){ el.value = ''; count++; }
      }
    }

    // 3) FORÇAR ZERO nos displays de resultado
    DISPLAYS_VALOR.forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.textContent = 'R$ 0';
    });
    DISPLAYS_PCT.forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.textContent = '0%';
    });
    BARRAS.forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.style.width = '0%';
    });

    // 4) Esconder painéis contextuais
    ['memorial-panel','cur-banner','orc-lock-banner','resumo-obra',
     'crm-orc-pronto-btn','crm-atualizar-btn','preorc-badge-area'
    ].forEach(function(id){
      var el = document.getElementById(id);
      if(el){ el.style.display='none'; el.classList.remove('show','open'); }
    });

    var ibar = document.getElementById('orc-itens-bar');
    if(ibar) ibar.classList.remove('show');

    // 5) Re-render e recalcular
    try { if(typeof orcItensRender === 'function') orcItensRender(); } catch(e){}
    try { if(typeof _crmItensRender === 'function') _crmItensRender(); } catch(e){}
    try { if(typeof calc === 'function') calc(); } catch(e){}
    try { if(typeof switchTab === 'function') switchTab('orcamento'); } catch(e){}

    _toast(
      '✅ <b>Orçamento zerado!</b><br>' +
      '<span style="font-size:11px;font-weight:400">' + count + ' campo(s) limpo(s) · Parâmetros financeiros preservados</span>',
      '#27ae60', 4000
    );
    console.log('%c[zerar v5] ✓ ' + count + ' campos + ' + DISPLAYS_VALOR.length + ' displays',
                'color:#27ae60;font-weight:700');
  }

  window.zerarValores = zerarTudo;
  window.zerarTudo    = zerarTudo;

  // ─── HOOK PLANIFICADOR: auto-calc ──────────────────────────────────
  function _instalarAutoCalcChapa(){
    var ids = ['plan-modelo','plan-folhas','plan-chapa','plan-chapa-larg','plan-chapa-alt',
      'plan-acm-cor','plan-acm-qty','plan-alu-cor','plan-alu-qty',
      'plan-layout','plan-refilado','plan-largcava','plan-largfriso',
      'plan-disborcava','plan-disbordafriso','plan-friso-v-qty','plan-friso-h-qty',
      'plan-friso-h-esp','plan-moldura-rev','plan-moldura-tipo','plan-moldura-divisao',
      'plan-moldura-dis1','plan-moldura-dis2','plan-moldura-dis3',
      'plan-moldura-alt-qty','plan-moldura-larg-qty','plan-moldura-blocos',
      'plan-ripa-qty','plan-ripa-larg','plan-ripa-dist'];
    var timer = null;
    function dispararCalc(){
      if(timer) clearTimeout(timer);
      timer = setTimeout(function(){
        if(typeof window.planRun === 'function'){
          try { window.planRun(); } catch(e){}
        } else if(typeof planRun === 'function'){
          try { planRun(); } catch(e){}
        }
      }, 600);
    }
    ids.forEach(function(id){
      var el = document.getElementById(id);
      if(el && !el._hookedAutoCalc){
        el.addEventListener('change', dispararCalc);
        el.addEventListener('input', dispararCalc);
        el._hookedAutoCalc = true;
      }
    });
  }
  setTimeout(_instalarAutoCalcChapa, 1000);
  setInterval(_instalarAutoCalcChapa, 2500);

  console.log('%c[75 v5] Zerar+Financeiro protegido + Auto-calc + CSS',
              'color:#0C447C;font-weight:700;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
