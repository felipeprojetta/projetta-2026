/* ============================================================================
 * js/143-sync-indicator.js — Indicador visual de sync (28-abr-2026)
 *
 * Adiciona um BADGE no canto superior direito mostrando:
 *  - Verde: tudo sincronizado
 *  - Amarelo: enviando dados
 *  - Vermelho: erro
 *
 * Clicando no badge: forca push + pull imediato + reload da pagina.
 *
 * Funciona junto com 140 (sync hook) e 142 (watcher).
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta143Applied) return;
  window.__projetta143Applied = true;

  var SB = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  var CHAVES_SYNC = [
    'projetta_comp_precos','projetta_preco_kg','projetta_perfis_kg',
    'projetta_custom_chapas','projetta_custom_comps','projetta_custom_perfis',
    'projetta_deleted_chapas','projetta_deleted_comps','projetta_deleted_perfis',
    'projetta_modelos','projetta_modelo_params',
    'projetta_users_v1','projetta_perms_v1','projetta_rep_cargos','projetta_rep_comms',
    'projetta_nfe_hist','projetta_crm_settings_v1'
  ];

  var statusEl = null;
  var corAtual = 'verde';
  var ultimaAcao = 'Boot inicial';

  function criarBadge(){
    if(document.getElementById('proj143-badge')) return;
    var el = document.createElement('div');
    el.id = 'proj143-badge';
    el.title = 'Status de sincronizacao - clique para forcar sync';
    el.style.cssText = [
      'position:fixed','top:12px','right:170px','z-index:99998',
      'background:#10b981','color:#fff','padding:6px 12px','border-radius:20px',
      'font-size:11px','font-weight:700','cursor:pointer',
      'font-family:Montserrat,Arial,sans-serif',
      'box-shadow:0 2px 6px rgba(0,0,0,.15)',
      'display:flex','align-items:center','gap:6px',
      'transition:background .3s,transform .2s',
      'user-select:none'
    ].join(';');
    el.innerHTML = '<span style="width:8px;height:8px;background:#fff;border-radius:50%;display:inline-block"></span><span id="proj143-txt">Sincronizado</span>';
    el.addEventListener('mouseenter', function(){ this.style.transform = 'scale(1.05)'; });
    el.addEventListener('mouseleave', function(){ this.style.transform = 'scale(1)'; });
    el.addEventListener('click', forcarSync);
    document.body.appendChild(el);
    statusEl = el;
  }

  function setStatus(cor, texto){
    if(!statusEl) return;
    corAtual = cor;
    ultimaAcao = texto;
    var cores = { verde: '#10b981', amarelo: '#f59e0b', vermelho: '#ef4444', azul: '#3b82f6' };
    statusEl.style.background = cores[cor] || cores.verde;
    var t = statusEl.querySelector('#proj143-txt');
    if(t) t.textContent = texto;
  }

  function forcarSync(){
    setStatus('amarelo','Sincronizando agora...');

    // 1) Push: empurra TUDO do localStorage pro banco
    var promessasPush = CHAVES_SYNC.map(function(k){
      var v = localStorage.getItem(k);
      if(v == null) return Promise.resolve();
      var parsed; try { parsed = JSON.parse(v); } catch(e){ parsed = v; }
      return fetch(SB + '/rest/v1/configuracoes', {
        method: 'POST',
        headers: Object.assign({}, H, {
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        }),
        body: JSON.stringify({ chave: k, valor: parsed, updated_at: new Date().toISOString() })
      });
    });

    Promise.all(promessasPush).then(function(){
      setStatus('azul','Recarregando...');
      // 2) Pull + reload (vai pegar tudo fresco do banco)
      setTimeout(function(){
        try { sessionStorage.removeItem('_crmDB_lastSnapshot'); } catch(e){}
        location.reload();
      }, 600);
    }).catch(function(e){
      setStatus('vermelho','Erro - tentar de novo');
      console.error('[143] forcarSync falhou:', e);
      setTimeout(function(){ setStatus('verde','Sincronizado'); }, 4000);
    });
  }

  // Hook: quando 140 ou 142 disparam upload, mostra "enviando"
  // Detectamos via console.log patterns? Mais robusto: monitorar fetch global
  var _origFetch = window.fetch;
  window.fetch = function(url, opts){
    if(typeof url === 'string' && url.indexOf('/rest/v1/configuracoes') >= 0){
      var metodo = (opts && opts.method) || 'GET';
      if(metodo === 'POST' || metodo === 'DELETE' || metodo === 'PATCH'){
        setStatus('amarelo','Enviando...');
        return _origFetch.apply(this, arguments).then(function(r){
          if(r.ok) setTimeout(function(){ setStatus('verde','Sincronizado'); }, 800);
          else setTimeout(function(){ setStatus('vermelho','Falha'); }, 0);
          return r;
        }).catch(function(e){
          setTimeout(function(){ setStatus('vermelho','Sem rede'); }, 0);
          throw e;
        });
      }
    }
    return _origFetch.apply(this, arguments);
  };

  function init(){
    criarBadge();
    setStatus('verde','Sincronizado');
    console.log('[143-sync-indicator] badge criado no canto superior direito');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
