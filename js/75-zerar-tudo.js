/**
 * ═══════════════════════════════════════════════════════════════════════
 * 75-zerar-tudo.js — Botão "Zerar" de verdade
 * ─────────────────────────────────────────────────────────────────────
 *
 * Sobrescreve window.zerarValores com versão AGRESSIVA que zera:
 *   • Arrays globais (_orcItens, _mpItens, _crmItens, _crmOrcCardId, etc)
 *   • Inputs/selects/textareas de TODAS as abas operacionais
 *   • Displays de valores (R$ 0)
 *   • Lista renderizada de itens
 *
 * PRESERVA:
 *   • Login / credenciais
 *   • CRM kanban (cards)
 *   • Filtros do CRM (crm-search, crm-f-*)
 *   • Cadastros (admin, wrep, etc)
 *   • Histórico
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  // Prefixes que devem ser zerados
  var ZERAR_PREFIXES = [
    'crmit-', 'crm-o-', 'carac-', 'plan-', 'aprov-', 'mp-', 'atp-',
    'rev-orc-', 'fab-', 'osa-', 'osp-', 'frete-calc-', 'inst-',
    'pf-f-', 'comp-f-', 'h-', 'crm-import-'
  ];

  // Prefixes que NUNCA devem ser zerados
  var PROTEGER_PREFIXES = [
    'login-', 'admin-', 'crm-search', 'crm-f-', 'crm-new-', 'crm-map-',
    'hist-', 'cli-hist-', 'ck-gain-', 'cad-wrep-', 'pf-kg-', 'pf-ded-',
    'cad-', 'eomie-', 'boletos-', 'frete-admin-', 'new-chapa-', 'new-cp-',
    'new-pf-', 'filtro-', 'pf-preco-', 'msg-padrao-', 'pf-barra-',
    'import-', 'nfe-'
  ];

  // IDs específicos que devem ser zerados
  var ZERAR_IDS = [
    'cliente','contato','telefone','email','cep','cidade','estado',
    'endereco','pais','largura','altura','folhas','folhas-porta',
    'abertura','modelo','produto','notas','num-agp','numprojeto','num-atp',
    'reserva','agp','responsavel','wrep','custo-hora','overhead','impostos',
    'markup-desc','desconto','diaria','lucro-alvo','com-rep','com-rt',
    'com-gest','dias','carros','pessoas','alim','hotel-dia','perfis','km',
    'pedagio','munk','prioridade','potencial','rep-sel','modal-name',
    'dataprojeto','fechamento','data-contato','previsao','terceiros',
    'lr-valor','lr-frete','lr-ipi','lr-pis','lr-cofins','lr-icms','lr-qtd',
    'desl-override','h-conf','h-corte','h-portal','h-quadro','h-colagem',
    'prod-pivo','prod-fga','prod-fgl','prod-fgr','prod-ved','prod-transpasse',
    'cep-cliente','cli-telefone','cli-email','qtd-portas','qtd-fechaduras',
    'rev-pipeline','ac-fechadura'
  ];

  function _toast(html, cor, ms){
    var t = document.getElementById('projetta-save-toast');
    if(t) t.remove();
    t = document.createElement('div');
    t.id = 'projetta-save-toast';
    t.style.cssText =
      'position:fixed;top:80px;right:20px;background:' + cor + ';color:#fff;' +
      'padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;' +
      'z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);' +
      'max-width:440px;line-height:1.45;font-family:inherit';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 4000);
  }

  function _deveZerar(id){
    if(!id) return false;
    for(var i = 0; i < PROTEGER_PREFIXES.length; i++){
      if(id.indexOf(PROTEGER_PREFIXES[i]) === 0) return false;
    }
    for(var j = 0; j < ZERAR_PREFIXES.length; j++){
      if(id.indexOf(ZERAR_PREFIXES[j]) === 0) return true;
    }
    if(ZERAR_IDS.indexOf(id) >= 0) return true;
    return false;
  }

  function zerarTudo(){
    var ok = confirm(
      '⚠ ZERAR TUDO?\n\n' +
      'Será apagado:\n' +
      '  • Cliente, projeto e AGP\n' +
      '  • Todos os itens do orçamento\n' +
      '  • Valores calculados (tabela, faturamento)\n' +
      '  • Campos da proposta comercial\n' +
      '  • Dados do planificador\n' +
      '  • Vínculo com card do CRM\n\n' +
      'NÃO será afetado: CRM kanban, login, cadastros.\n\n' +
      'Prosseguir?'
    );
    if(!ok) return;

    // 1) Arrays globais
    window._orcItens      = [];
    window._mpItens       = [];
    window._crmItens      = [];
    window._orcItemAtual  = -1;
    window._mpEditingIdx  = -1;
    window._crmOrcCardId  = null;
    window._crmScope      = null;
    window._pendingRevision = false;
    try { window.currentId = null; window.currentRev = null; } catch(e){}

    // 2) Limpar scope do body
    if(document.body) document.body.removeAttribute('data-scope');

    // 3) Zerar inputs/selects/textareas
    var inputs = document.querySelectorAll('input, select, textarea');
    var count = 0;
    for(var k = 0; k < inputs.length; k++){
      var el = inputs[k];
      if(!_deveZerar(el.id)) continue;
      if(el.type === 'checkbox' || el.type === 'radio'){
        if(el.checked){ el.checked = false; count++; }
      } else if(el.tagName.toLowerCase() === 'select'){
        if(el.value !== ''){
          el.selectedIndex = 0;
          el.value = '';
          count++;
        }
      } else {
        if(el.value !== ''){ el.value = ''; count++; }
      }
    }

    // 4) Zerar displays de valores calculados
    var displays = [
      'r-total-tabela','r-total-fat','r-custo-fab','r-custo-inst',
      'r-tab-porta','r-fat-porta','r-tab-inst','r-fat-inst',
      'r-custo-total','r-markup','r-margem-bruta','r-margem-liquida',
      'r-custo-m2','r-tab-m2','r-fat-m2',
      'm-custo-porta','m-custo-porta-m2','m-markup','m-markup-m2',
      'm-tabela','m-tabela-m2','m-faturamento','m-faturamento-m2'
    ];
    for(var d = 0; d < displays.length; d++){
      var disp = document.getElementById(displays[d]);
      if(disp) disp.textContent = 'R$ 0';
    }

    // 5) Esconder banners/painéis contextuais
    var panels = ['memorial-panel','cur-banner','orc-lock-banner',
                  'crm-orc-pronto-btn','crm-atualizar-btn'];
    for(var p = 0; p < panels.length; p++){
      var painel = document.getElementById(panels[p]);
      if(painel){
        painel.style.display = 'none';
        painel.classList.remove('show');
      }
    }

    // 6) Esconder barra de itens do CRM
    var ibar = document.getElementById('orc-itens-bar');
    if(ibar) ibar.classList.remove('show');

    // 7) Re-renderizar lista (vai ficar vazia)
    try { if(typeof orcItensRender === 'function') orcItensRender(); } catch(e){}
    try { if(typeof _crmItensRender === 'function') _crmItensRender(); } catch(e){}
    try { if(typeof _clearResultDisplay === 'function') _clearResultDisplay(); } catch(e){}

    // 8) Navegar pra aba Orçamento
    try { if(typeof switchTab === 'function') switchTab('orcamento'); } catch(e){}

    _toast(
      '✅ <b>Tudo zerado!</b><br>' +
      '<span style="font-size:11px;font-weight:400">' + count + ' campo(s) limpo(s) · arrays resetados · vínculo removido</span>',
      '#27ae60', 4000
    );
    console.log('%c[zerarTudo] ✓ ' + count + ' campos zerados', 'color:#27ae60;font-weight:700');
  }

  // Sobrescrever globais
  window.zerarValores = zerarTudo;
  window.zerarTudo    = zerarTudo;

  console.log('%c[75-zerar-tudo] v1.0 ativo — window.zerarValores sobrescrita',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
