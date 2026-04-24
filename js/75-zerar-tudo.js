/**
 * 75-zerar-tudo.js v4 — Zerar + CSS fixes + hooks
 *
 * Inclui:
 *   1. window.zerarValores() agressivo (whitelist mínima)
 *   2. CSS injetado:
 *       - esconde seção "Anexos" do modal CRM
 *       - melhora campo "Buscar cor" (sem ícone 🔍 fixo cortando texto)
 *   3. Hook no planificador: quando muda campo, chama calcular aproveitamento auto
 */
(function(){
  'use strict';

  // ─── 1. CSS INJETADO ──────────────────────────────────────────────────
  var css = document.createElement('style');
  css.id = 'projetta-fixes-css';
  css.textContent = [
    /* Esconder seção Anexos do modal CRM — Felipe 24/04 */
    '#crm-attach-section, #crm-attach-section + * { display:none !important; }',
    '.crm-section-label { /* manter visível os outros */ }',
    /* Esconder especificamente o label de Anexos */
    '.crm-section-label[data-felipe-hide-anexos="1"] { display:none !important; }',
    /* Campo busca cor: melhor estilo, sem cortar texto */
    '.crm-color-search { padding:6px 10px !important; font-size:12px !important; }',
    '.crm-color-search::placeholder { color:#aaa; font-size:11px; }',
    '.crm-color-search:focus { background:#fff !important; border-color:#4caf50 !important; }'
  ].join('\n');
  if(document.head) document.head.appendChild(css);
  else setTimeout(function(){ if(document.head) document.head.appendChild(css); }, 500);

  // Observer pra marcar o label "Anexos" e esconder — percorre a cada modal
  function _esconderLabelAnexos(){
    var labels = document.querySelectorAll('.crm-section-label');
    for(var i = 0; i < labels.length; i++){
      var txt = (labels[i].textContent || '');
      if(txt.indexOf('Anexos') >= 0){
        labels[i].setAttribute('data-felipe-hide-anexos','1');
      }
    }
  }
  setInterval(_esconderLabelAnexos, 1500);

  // ─── 2. ZERAR AGRESSIVO ───────────────────────────────────────────────
  var ID_PROTEGIDOS = {};
  ['login-user','login-pass','admin-new-user','admin-new-pass',
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
    if(!confirm('⚠ ZERAR TUDO?\n\nTodos os dados do orçamento serão apagados.\nConfigurações, CRM e login NÃO serão afetados.\n\nContinuar?')) return;

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

    var els = document.querySelectorAll('input, select, textarea');
    var count = 0;
    for(var i = 0; i < els.length; i++){
      var el = els[i];
      if(el.id && ID_PROTEGIDOS[el.id]) continue;
      if(el.type === 'file') continue;
      if(el.type === 'checkbox' || el.type === 'radio'){
        if(el.checked){ el.checked = false; count++; }
      } else if(el.tagName.toLowerCase() === 'select'){
        if(el.value !== ''){
          el.selectedIndex = 0; el.value = ''; count++;
        }
      } else {
        if(el.value !== ''){ el.value = ''; count++; }
      }
    }

    ['r-total-tabela','r-total-fat','r-custo-fab','r-custo-inst',
     'r-tab-porta','r-fat-porta','r-tab-inst','r-fat-inst',
     'r-custo-total','r-markup','r-margem-bruta','r-margem-liquida',
     'r-custo-m2','r-tab-m2','r-fat-m2',
     'm-custo-porta','m-custo-porta-m2','m-markup','m-markup-m2',
     'm-tabela','m-tabela-m2','m-faturamento','m-faturamento-m2',
     'prop-area-total','prop-total-orc'
    ].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.textContent = 'R$ 0';
    });

    ['memorial-panel','cur-banner','orc-lock-banner','resumo-obra',
     'crm-orc-pronto-btn','crm-atualizar-btn','preorc-badge-area'
    ].forEach(function(id){
      var el = document.getElementById(id);
      if(el){
        el.style.display = 'none';
        el.classList.remove('show','open');
      }
    });

    var ibar = document.getElementById('orc-itens-bar');
    if(ibar) ibar.classList.remove('show');

    try { if(typeof orcItensRender === 'function') orcItensRender(); } catch(e){}
    try { if(typeof _crmItensRender === 'function') _crmItensRender(); } catch(e){}
    try { if(typeof _clearResultDisplay === 'function') _clearResultDisplay(); } catch(e){}
    try { if(typeof switchTab === 'function') switchTab('orcamento'); } catch(e){}

    _toast(
      '✅ <b>Tudo zerado!</b><br>' +
      '<span style="font-size:11px;font-weight:400">' + count + ' campo(s) limpo(s)</span>',
      '#27ae60', 3500
    );
    console.log('%c[zerar v4] ✓ ' + count + ' campos', 'color:#27ae60;font-weight:700');
  }

  window.zerarValores = zerarTudo;
  window.zerarTudo    = zerarTudo;

  // ─── 3. HOOK PLANIFICADOR: auto-calcular aproveitamento quando muda campo ─
  function _instalarAutoCalcChapa(){
    // Ao mudar QUALQUER campo do planificador, dispara recalculo
    var planificadorIds = [
      'plan-modelo','plan-folhas','plan-chapa','plan-chapa-larg','plan-chapa-alt',
      'plan-acm-cor','plan-acm-qty','plan-alu-cor','plan-alu-qty',
      'plan-layout','plan-refilado','plan-largcava','plan-largfriso',
      'plan-disborcava','plan-disbordafriso','plan-friso-v-qty','plan-friso-h-qty',
      'plan-friso-h-esp','plan-moldura-rev','plan-moldura-tipo','plan-moldura-divisao',
      'plan-moldura-dis1','plan-moldura-dis2','plan-moldura-dis3',
      'plan-moldura-alt-qty','plan-moldura-larg-qty','plan-moldura-blocos',
      'plan-ripa-qty','plan-ripa-larg','plan-ripa-dist'
    ];
    var timer = null;
    function dispararCalc(){
      if(timer) clearTimeout(timer);
      timer = setTimeout(function(){
        if(typeof window.calcularAproveitamento === 'function'){
          try { window.calcularAproveitamento(); } catch(e){ console.warn('[auto-calc]', e); }
        } else if(typeof window.calcPlanificador === 'function'){
          try { window.calcPlanificador(); } catch(e){}
        }
      }, 600);
    }
    planificadorIds.forEach(function(id){
      var el = document.getElementById(id);
      if(el && !el._hookedAutoCalc){
        el.addEventListener('change', dispararCalc);
        el.addEventListener('input', dispararCalc);
        el._hookedAutoCalc = true;
      }
    });
  }
  // Instalar hook + re-tentar a cada 2s (pra campos adicionados dinamicamente)
  setTimeout(_instalarAutoCalcChapa, 1000);
  setInterval(_instalarAutoCalcChapa, 2500);

  console.log('%c[75-zerar-tudo v4] CSS + Zerar + Auto-calc planificador ativos',
              'color:#0C447C;font-weight:700;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
