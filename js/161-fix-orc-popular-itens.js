/* ============================================================================
 * js/161-fix-orc-popular-itens.js  —  (28-abr-2026)
 *
 * Felipe 28/04: "campos ficam todos selecione, nao consigo salvar orcamento"
 *
 * BUG RAIZ em js/10-crm.js (linhas ~191800 e ~197808):
 *   1. orcItemConfigurar grava `it._formData = ({})` — objeto VAZIO
 *      (deveria chamar captureFormData() que nao existe mais)
 *   2. orcItemSelecionar:
 *        if(it._formData && typeof restoreFormData === 'function'){
 *          void 0;        ← LITERAL NADA (deveria ser restoreFormData(...))
 *          return;        ← retorna sem popular!
 *        }
 *
 * Resultado: depois que o user "configura" um item uma vez, todas as
 *   proximas vezes que clicar no item os campos carac-* ficam VAZIOS.
 *   Isso causa: (1) Selecione em tudo, (2) PNGs vazios, (3) orçamento
 *   incompleto que nao salva.
 *
 * FIX: hook em orcItemSelecionar.
 *  - ANTES: deletar it._formData (forca branch "load from CRM")
 *  - DEPOIS: re-popula manualmente como GARANTIA (caso o hook acima nao
 *    funcione por timing). Espelho fiel do que a funcao original faria
 *    no path "load from CRM".
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta161Applied) return;
  window.__projetta161Applied = true;

  function $(id){ return document.getElementById(id); }

  function setF(fid, v){
    var e = $(fid);
    if(!e) return;
    if(v === undefined || v === null || v === '') return;
    e.value = v;
    try {
      ['input','change'].forEach(function(evt){
        e.dispatchEvent(new Event(evt, { bubbles: true }));
      });
    } catch(err){}
  }

  function setCheckbox(fid, v){
    var e = $(fid);
    if(!e) return;
    e.checked = !!v;
    try {
      e.dispatchEvent(new Event('change', { bubbles: true }));
    } catch(err){}
  }

  // POPULATE forte: lê _orcItens[idx] e seta TODOS campos carac-* + plan-*
  function populateFromItem(it){
    if(!it) return;
    var tipo = it.tipo || '';

    // Quantidade / dimensões base (todos os tipos)
    setF('qtd-portas', it.qtd || 1);

    // Para revestimento, NAO setar largura/altura (eles tem inputs proprios)
    if(tipo !== 'revestimento'){
      if(it.largura) setF('largura', it.largura);
      if(it.altura) setF('altura', it.altura);
    }

    if(tipo === 'porta_pivotante'){
      // Caracteristicas principais
      setF('carac-abertura', it.abertura || 'PIVOTANTE');
      if(it.modelo) setF('carac-modelo', it.modelo);
      setF('folhas-porta', it.folhas || '1');
      setF('carac-folhas', it.folhas || '1');

      // Cores
      if(it.cor_ext) setF('carac-cor-ext', it.cor_ext);
      if(it.cor_int) setF('carac-cor-int', it.cor_int);
      if(it.cor_macico) window._pendingCorMacico = it.cor_macico;

      // Fechaduras
      if(it.fech_mec) setF('carac-fech-mec', it.fech_mec);
      if(it.fech_dig) setF('carac-fech-dig', it.fech_dig);
      if(it.cilindro) setF('carac-cilindro', it.cilindro);
      if(typeof window._tedeeLockCilindro === 'function'){
        try { window._tedeeLockCilindro('carac-fech-dig','carac-cilindro'); } catch(e){}
      }

      // Puxador
      if(it.puxador) setF('carac-puxador', it.puxador);
      if(it.pux_tam) setF('carac-pux-tam', it.pux_tam);

      // Cava
      if(it.dist_borda_cava) setF('carac-dist-borda-cava', it.dist_borda_cava);
      if(it.largura_cava) setF('carac-largura-cava', it.largura_cava);

      // Friso (mod 02/11 - vertical)
      if(it.dist_borda_friso) setF('carac-dist-borda-friso', it.dist_borda_friso);
      if(it.largura_friso) setF('carac-largura-friso', it.largura_friso);
      if(it.friso_vert) setF('carac-friso-vert', it.friso_vert);
      if(it.friso_horiz) setF('carac-friso-horiz', it.friso_horiz);

      // Friso horizontal modelo 06/16
      if(it.friso_h_qty) setF('plan-friso-h-qty', it.friso_h_qty);
      if(it.friso_h_esp) setF('plan-friso-h-esp', it.friso_h_esp);

      // Friso vertical modelo 02
      if(it.friso_v_qty) setF('plan-friso-v-qty', it.friso_v_qty);

      // Modelo 23 (Classica Molduras)
      if(it.moldura_rev) setF('plan-moldura-rev', it.moldura_rev);
      if(it.moldura_larg_qty) setF('plan-moldura-larg-qty', it.moldura_larg_qty);
      if(it.moldura_alt_qty) setF('plan-moldura-alt-qty', it.moldura_alt_qty);
      if(it.moldura_tipo) setF('plan-moldura-tipo', it.moldura_tipo);
      if(it.moldura_dis1) setF('plan-moldura-dis1', it.moldura_dis1);
      if(it.moldura_dis2) setF('plan-moldura-dis2', it.moldura_dis2);
      if(it.moldura_dis3) setF('plan-moldura-dis3', it.moldura_dis3);
      if(it.moldura_divisao) setF('plan-moldura-divisao', it.moldura_divisao);

      // Refilado tampas
      if(it.refilado) setF('plan-refilado', it.refilado);

      // Ripado
      if(it.ripado_total) setF('carac-ripado-total', it.ripado_total);
      if(it.ripado_2lados) setF('carac-ripado-2lados', it.ripado_2lados);

      // Tem alisar (checkbox)
      setCheckbox('carac-tem-alisar', it.tem_alisar);

      // Tampa orient (do js/160)
      if(it.tampa_orient){
        setF('plan-tampa-orient', it.tampa_orient);
      }

      // Disparar onModeloChange para mostrar/esconder seções corretas
      if(typeof window.onModeloChange === 'function' && it.modelo){
        try { window.onModeloChange(); } catch(e){}
      }
      // Verificar cor mode + setar cor maciço apos populate
      if(typeof window._checkCorMode === 'function'){
        setTimeout(function(){
          try { window._checkCorMode(); } catch(e){}
          if(window._pendingCorMacico){
            setF('carac-cor-macico', window._pendingCorMacico);
            window._pendingCorMacico = null;
          }
        }, 250);
      }
    } else if(tipo === 'fixo'){
      if(it.cor_ext) setF('carac-cor-ext', it.cor_ext);
      if(it.cor_int) setF('carac-cor-int', it.cor_int);
    }
  }

  function instalarHook(){
    var orig = window.orcItemSelecionar;
    if(typeof orig !== 'function'){ setTimeout(instalarHook, 600); return; }
    if(orig.__sub161Hooked){ return; }
    window.orcItemSelecionar = function(idx){
      // ANTES da chamada original: limpar _formData (força "load from CRM")
      try {
        if(window._orcItens && window._orcItens[idx]){
          // _formData vazio é o bug; deletando força o branch certo
          if(window._orcItens[idx]._formData){
            delete window._orcItens[idx]._formData;
          }
        }
      } catch(e){ console.warn('[161] limpar _formData err:', e); }

      // Chamar original
      var r;
      try { r = orig.apply(this, arguments); } catch(e){ console.error('[161] orig err:', e); }

      // DEPOIS: re-popular manualmente como GARANTIA
      try {
        var it = (window._orcItens || [])[idx];
        if(it){
          // 100ms — depois do scroll smooth (100ms) mas antes do calc (300ms)
          setTimeout(function(){ populateFromItem(it); }, 120);
          // 400ms — depois do calc, garante que campos não foram zerados
          setTimeout(function(){ populateFromItem(it); }, 400);
        }
      } catch(e){ console.warn('[161] populate err:', e); }
      return r;
    };
    window.orcItemSelecionar.__sub161Hooked = true;
    console.log('[161-fix-orc-popular-itens] orcItemSelecionar hooked');
  }

  // Tambem: ao orcItensFromCRM popular, re-popular o item ATIVO manualmente
  function instalarHookFromCRM(){
    var orig = window.orcItensFromCRM;
    if(typeof orig !== 'function'){ setTimeout(instalarHookFromCRM, 600); return; }
    if(orig.__sub161Hooked){ return; }
    window.orcItensFromCRM = function(){
      var r = orig.apply(this, arguments);
      // Após CRM->orc populate, garantir que items não tenham _formData fantasma
      try {
        if(window._orcItens){
          window._orcItens.forEach(function(it){
            if(it && it._formData) delete it._formData;
          });
        }
      } catch(e){}
      return r;
    };
    window.orcItensFromCRM.__sub161Hooked = true;
  }

  // Tambem hook em orcItemConfigurar pra NÃO criar _formData = {} fantasma
  function instalarHookConfigurar(){
    var orig = window.orcItemConfigurar;
    if(typeof orig !== 'function'){ setTimeout(instalarHookConfigurar, 600); return; }
    if(orig.__sub161Hooked){ return; }
    window.orcItemConfigurar = function(){
      var r = orig.apply(this, arguments);
      // Limpar _formData = {} que a original cria (bug raiz)
      try {
        if(window._orcItens){
          window._orcItens.forEach(function(it){
            if(it && it._formData && typeof it._formData === 'object' && Object.keys(it._formData).length === 0){
              delete it._formData;
            }
          });
        }
      } catch(e){}
      return r;
    };
    window.orcItemConfigurar.__sub161Hooked = true;
  }

  function init(){
    setTimeout(function(){
      instalarHook();
      instalarHookFromCRM();
      instalarHookConfigurar();
    }, 800);
    // Reforço periodico (caso outro script remonte a função)
    setInterval(function(){
      try {
        instalarHook();
        instalarHookFromCRM();
        instalarHookConfigurar();
      } catch(e){}
    }, 5000);
    console.log('[161-fix-orc-popular-itens] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
