/* ============================================================================
 * js/141-realtime-tabelas.js  —  NOVO (28-abr-2026)
 *
 * Felipe 28/04: "TUDO DEVE SER SINCRONIZADO EM TEMPO REAL".
 *
 * Complementa o 140 (que sync chaves de configuracao) cobrindo as TABELAS
 * relacionais com Realtime postgres_changes:
 *
 *   - crm_oportunidades   (cards do CRM)
 *   - pre_orcamentos      (pre-orcamentos por card)
 *   - versoes_aprovadas   (versoes finais)
 *   - orcamentos_fechados (fechamentos congelados)
 *   - crm_anexos          (arquivos anexados)
 *   - crm_eventos         (audit trail)
 *   - weiku_reservas      (reservas weiku)
 *   - weiku_pedidos_fechados (pedidos fechados weiku)
 *
 * Quando outra maquina insere/altera/apaga em qualquer dessas tabelas, o
 * front recebe o evento em ~1-2 segundos e dispara reload local apropriado.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta141Applied) return;
  window.__projetta141Applied = true;

  function sb(){ return window.supa || window.supabase || window._supabase || null; }

  // Toast
  var _lastToastTime = 0;
  function toast(msg){
    var now = Date.now();
    if(now - _lastToastTime < 800) return; // throttle
    _lastToastTime = now;
    var el = document.getElementById('proj141-toast');
    if(el) el.remove();
    el = document.createElement('div');
    el.id = 'proj141-toast';
    el.textContent = '☁️ ' + msg;
    el.style.cssText = 'position:fixed;top:20px;right:20px;background:#1a3a4a;color:#fff;padding:10px 18px;border-radius:8px;font-size:12px;font-weight:700;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif';
    document.body.appendChild(el);
    setTimeout(function(){
      el.style.opacity='0';
      el.style.transition='opacity .4s';
      setTimeout(function(){ el.remove(); }, 400);
    }, 2000);
  }

  // Debounce reload do CRM (multiplos eventos rapidos viram uma so atualizacao)
  var _crmReloadTimer = null;
  function agendarRecargaCRM(){
    if(_crmReloadTimer) clearTimeout(_crmReloadTimer);
    _crmReloadTimer = setTimeout(function(){
      // Felipe 28/04: SEMPRE forcar - banco e fonte unica da verdade.
      // hidratarCrmLocal({forcar:true}) sobrescreve localStorage com banco.
      try {
        if(typeof window.hidratarCrmLocal === 'function'){
          window.hidratarCrmLocal({forcar:true, verbose:false}).then(function(){
            // Apos hidratar, re-render
            if(typeof window.crmRender === 'function') window.crmRender();
            if(typeof window.renderClientesTab === 'function') window.renderClientesTab();
          }).catch(function(e){
            console.warn('[141] hidratar falhou:', e);
            if(typeof window.crmRender === 'function') window.crmRender();
          });
        } else if(typeof window._syncSilencioso === 'function'){
          window._syncSilencioso('realtime');
        }
      } catch(e){ console.warn('[141] erro ao recarregar CRM:', e); }
    }, 350);
  }

  // Mapeamento: tabela → callback
  var TABELAS = {
    'crm_oportunidades': {
      label: 'Card do CRM',
      onChange: function(payload){
        agendarRecargaCRM();
        var ev = payload.eventType;
        var cliente = (payload.new && payload.new.cliente) || (payload.old && payload.old.cliente) || '';
        if(ev === 'INSERT')      toast('Novo card: ' + cliente);
        else if(ev === 'DELETE') toast('Card removido: ' + cliente);
        // UPDATE silencioso (toast a cada movimentacao seria barulho)
      }
    },
    'pre_orcamentos': {
      label: 'Pre-orcamento',
      onChange: function(payload){
        agendarRecargaCRM();
        if(payload.eventType !== 'UPDATE') return; // muito frequente
        var foiDelete = payload.new && payload.new.deleted_at && !(payload.old && payload.old.deleted_at);
        if(foiDelete) toast('Pre-orcamento apagado');
      }
    },
    'versoes_aprovadas': {
      label: 'Versao aprovada',
      onChange: function(payload){
        agendarRecargaCRM();
        if(payload.eventType === 'INSERT') toast('Nova versao aprovada');
      }
    },
    'orcamentos_fechados': {
      label: 'Orcamento fechado',
      onChange: function(payload){
        agendarRecargaCRM();
        if(payload.eventType === 'INSERT') toast('Pedido fechado');
      }
    },
    'crm_anexos': {
      label: 'Anexo',
      onChange: function(payload){
        if(payload.eventType === 'INSERT') toast('Novo anexo');
      }
    },
    'weiku_reservas': {
      label: 'Reserva Weiku',
      onChange: function(payload){
        if(payload.eventType === 'INSERT') toast('Nova reserva Weiku');
        if(typeof window._syncReservas === 'function'){
          try{ window._syncReservas(); }catch(e){}
        }
      }
    }
  };

  function instalar(){
    var s = sb();
    if(!s){ setTimeout(instalar, 1500); return; }
    var canal = s.channel('projetta-realtime-tabelas');
    Object.keys(TABELAS).forEach(function(tabela){
      canal.on('postgres_changes',
        { event: '*', schema: 'public', table: tabela },
        function(payload){
          try {
            console.log('[141 realtime] ' + tabela + ' ' + payload.eventType);
            TABELAS[tabela].onChange(payload);
          } catch(e){ console.error('[141] erro callback ' + tabela, e); }
        }
      );
    });
    canal.subscribe(function(status){
      console.log('[141-realtime-tabelas] status:', status);
    });
    window._141Canal = canal;
  }

  function init(){
    // Felipe 28/04: forcar hidratacao do banco no boot.
    // Garante que localStorage (potencialmente desatualizado) seja sobrescrito
    // pelo estado real do banco antes do CRM renderizar.
    setTimeout(function(){
      if(typeof window.hidratarCrmLocal === 'function'){
        window.hidratarCrmLocal({forcar:true, verbose:false}).then(function(r){
          console.log('[141 boot] hidratacao forcada:', r);
          if(typeof window.crmRender === 'function') window.crmRender();
        }).catch(function(e){ console.warn('[141 boot] hidratar falhou:', e); });
      }
    }, 800);
    setTimeout(instalar, 1400);
    console.log('[141-realtime-tabelas] iniciado - escuta ' + Object.keys(TABELAS).length + ' tabelas');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
