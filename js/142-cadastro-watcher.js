/* ============================================================================
 * js/142-cadastro-watcher.js  —  watcher independente (28-abr-2026)
 *
 * O 140 sobrescreve localStorage.setItem para detectar mudancas.
 * Mas se OUTRO script sobrescrever setItem APOS o 140, ou se o save
 * ja tinha rolado antes do 140 carregar, mudancas passam despercebidas.
 *
 * ESTE script faz o backup dessa estrategia: verifica hash das chaves
 * a cada 3s e empurra ao banco se mudaram. Tambem faz um PUSH ONE-TIME
 * no boot (depois do download inicial do 140) para garantir que tudo
 * que ta no localStorage local va pro banco.
 *
 * Tudo via fetch direto (sem dependencia de window.supabase).
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta142Applied) return;
  window.__projetta142Applied = true;

  var SB = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  // Mesmas chaves do 140 (deve ficar em sync com lista do 140)
  var CHAVES = [
    'projetta_comp_precos','projetta_preco_kg','projetta_perfis_kg',
    'projetta_custom_chapas','projetta_custom_comps','projetta_custom_perfis',
    'projetta_deleted_chapas','projetta_deleted_comps','projetta_deleted_perfis',
    'projetta_modelos','projetta_modelo_params',
    'projetta_users_v1','projetta_perms_v1','projetta_rep_cargos','projetta_rep_comms',
    'projetta_nfe_hist','projetta_crm_settings_v1'
  ];

  var ultimosHashes = {}; // hash do que ja empurramos
  var primeiraVez = true;

  function hash(s){
    var h = 0; if(!s) return 0;
    for(var i=0; i<s.length; i++) h = ((h<<5)-h+s.charCodeAt(i))|0;
    return h;
  }

  function uploadChave(k, valor){
    var parsed; try { parsed = JSON.parse(valor); } catch(e){ parsed = valor; }
    return fetch(SB + '/rest/v1/configuracoes', {
      method: 'POST',
      headers: Object.assign({}, H, {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }),
      body: JSON.stringify({
        chave: k,
        valor: parsed,
        updated_at: new Date().toISOString()
      })
    }).then(function(r){
      if(r.ok) console.log('[142 watcher] enviei ao banco:', k, '(' + valor.length + ' chars)');
      else console.warn('[142 watcher] falhou:', k, r.status);
      return r.ok;
    }).catch(function(e){
      console.warn('[142 watcher] erro:', k, e.message);
      return false;
    });
  }

  // Le hashes do BANCO antes da primeira passada para nao re-uploadar
  // o que ja esta la (evita disparar guerras com last-write-wins)
  function carregarHashesIniciais(cb){
    var inList = '(' + CHAVES.map(function(k){ return '"'+k+'"'; }).join(',') + ')';
    fetch(SB + '/rest/v1/configuracoes?chave=in.' + encodeURIComponent(inList) + '&select=chave,valor',
          { headers: H })
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(rows){
        rows.forEach(function(row){
          var v = (typeof row.valor === 'string') ? row.valor : JSON.stringify(row.valor);
          ultimosHashes[row.chave] = hash(v);
        });
        console.log('[142 watcher] iniciado - ' + rows.length + ' chaves ja sincronizadas');
        cb();
      })
      .catch(function(){ cb(); });
  }

  function checkAll(){
    CHAVES.forEach(function(k){
      var localV = localStorage.getItem(k);
      if(localV == null) return; // chave nao existe localmente - skip
      var hLocal = hash(localV);
      if(ultimosHashes[k] !== hLocal){
        // Mudou (ou nunca foi enviado)
        ultimosHashes[k] = hLocal;
        if(primeiraVez){
          // Primeira passada: pode ser dado antigo do localStorage que ainda nao
          // foi pro banco. Empurra so se nao tem nada no banco OU o local ja
          // estava com hash diferente do remoto (carregado em carregarHashesIniciais).
          uploadChave(k, localV);
        } else {
          // Mudanca em runtime - empurra na hora
          uploadChave(k, localV);
        }
      }
    });
    primeiraVez = false;
  }

  function init(){
    carregarHashesIniciais(function(){
      // Primeira passada: aguarda 1.5s para 140 fazer o download do servidor primeiro
      setTimeout(checkAll, 1500);
      // Depois: a cada 3s
      setInterval(checkAll, 3000);
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
