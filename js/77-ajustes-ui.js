/**
 * ═══════════════════════════════════════════════════════════════════════
 * 77-ajustes-ui.js — Ajustes finos de UI solicitados pelo Felipe
 * ─────────────────────────────────────────────────────────────────────
 *
 * 1. Esconde a descrição detalhada do item revestimento (#*-rev_info)
 *    "Medidas: ... · Qtd: ... · Área total: ... · Divisão de chapa:..."
 *
 * 2. Melhora o campo "🔍 Buscar cor...":
 *    - Match parcial CASE-INSENSITIVE em qualquer parte da string
 *    - Busca ao digitar (keyup)
 *
 * 3. Remove qualquer elemento visível com texto exato "rascunho"
 *    (na seção OBSERVAÇÕES)
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  // ═══════════════════════════════════════════════════════
  // 1. Esconder rev_info via CSS
  // ═══════════════════════════════════════════════════════
  var css = document.createElement('style');
  css.id = 'projetta-77-styles';
  css.textContent = [
    '/* Esconde descricao detalhada do item revestimento */',
    '[id$="-rev_info"],',
    '[id$="rev_info"].rev-info-box,',
    '[id*="rev_info"] { display:none !important; }'
  ].join('\n');
  document.head.appendChild(css);

  // ═══════════════════════════════════════════════════════
  // 2. Melhorar busca de cor (match parcial, case-insensitive)
  // ═══════════════════════════════════════════════════════
  function _melhorarBuscaCor(){
    var inputs = document.querySelectorAll('input.crm-color-search, input[placeholder*="Buscar cor"]');
    inputs.forEach(function(inp){
      if(inp._melhorado) return;
      inp._melhorado = true;

      // Trocar placeholder pra mais claro
      inp.placeholder = '🔍 Digite qualquer parte do nome da cor';

      // Handler melhorado: filtra <option> do select mais próximo
      inp.addEventListener('input', function(){
        var termo = (inp.value || '').trim().toLowerCase();
        // Buscar select associado (geralmente próximo no DOM)
        var wrap = inp.parentElement;
        var sel = wrap && wrap.querySelector('select');
        if(!sel){
          // Tentar próximo irmão
          var sib = inp.nextElementSibling;
          while(sib && sib.tagName !== 'SELECT'){ sib = sib.nextElementSibling; }
          sel = sib;
        }
        if(!sel) return;

        // Filtrar options
        var opts = sel.querySelectorAll('option');
        var firstMatch = null;
        opts.forEach(function(o){
          if(!o.value){ o.style.display = ''; return; } // preservar "Selecione..."
          var txt = (o.textContent || '').toLowerCase();
          var match = termo === '' || txt.indexOf(termo) !== -1;
          o.style.display = match ? '' : 'none';
          if(match && !firstMatch && o.value) firstMatch = o;
        });
        // Auto-selecionar primeiro match quando só 1 sobrar E for match exato
        if(termo.length >= 3 && firstMatch){
          // Só auto-seleciona se tem 1 match visível
          var visiveis = Array.prototype.filter.call(opts, function(o){
            return o.style.display !== 'none' && o.value;
          });
          if(visiveis.length === 1){
            sel.value = visiveis[0].value;
          }
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════
  // 3. Remover texto "rascunho" da UI
  // ═══════════════════════════════════════════════════════
  function _removerRascunho(){
    // Buscar elementos que tem APENAS o texto "rascunho" (case-insensitive)
    var all = document.querySelectorAll('span, div, small, p, label, em, i, b');
    all.forEach(function(el){
      // Se tem filhos elemento, não mexer (evita quebrar layouts)
      if(el.children.length > 0) return;
      var txt = (el.textContent || '').trim().toLowerCase();
      if(txt === 'rascunho' || txt === '(rascunho)' || txt === 'rascunho...'){
        el.style.display = 'none';
      }
    });

    // Limpar placeholders "rascunho" em inputs/textareas
    var campos = document.querySelectorAll('input[placeholder*="rascunho" i], input[placeholder*="Rascunho"], textarea[placeholder*="rascunho" i], textarea[placeholder*="Rascunho"]');
    campos.forEach(function(c){
      c.placeholder = c.placeholder
        .replace(/\brascunho\b/gi, '')
        .replace(/\s*\(\s*\)\s*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    });
  }

  // ═══════════════════════════════════════════════════════
  // Aplicar ao carregar e em mutations (UI dinâmica)
  // ═══════════════════════════════════════════════════════
  function _aplicarTudo(){
    try { _melhorarBuscaCor(); } catch(e){ console.warn('[77-ajustes]', e); }
    try { _removerRascunho();  } catch(e){ console.warn('[77-ajustes]', e); }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _aplicarTudo);
  } else {
    _aplicarTudo();
  }

  // Monitor: toda vez que DOM muda, reaplica (cobre UI dinâmica)
  var debounce = null;
  new MutationObserver(function(){
    clearTimeout(debounce);
    debounce = setTimeout(_aplicarTudo, 300);
  }).observe(document.body, { childList: true, subtree: true });

  console.log('%c[77-ajustes-ui] v1.0 ativo — rev_info oculto, busca-cor melhorada, rascunho removido',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
