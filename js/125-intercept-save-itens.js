(() => {
  if (window.__MOD_125_V2_LOADED) return;
  window.__MOD_125_V2_LOADED = true;

  // Le valor de um campo pelo ID. Para SELECT retorna text do option selecionado.
  function gv(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (el.tagName === 'SELECT') {
      var opt = el.options[el.selectedIndex];
      var text = (opt && opt.text || '').trim();
      // Remove "— Selecione —" e similares
      if (/^[—-]\s*selecione\s*[—-]?$/i.test(text)) return null;
      return text || el.value || null;
    }
    if (el.type === 'checkbox') return el.checked ? 'SIM' : 'NAO';
    var v = (el.value || '').trim();
    return v || null;
  }

  function gvNum(id) {
    var v = gv(id);
    if (v == null) return null;
    var m = String(v).replace(',', '.').match(/-?[\d.]+/);
    return m ? m[0] : null;
  }

  function gvModelo() {
    // carac-modelo: value="22", text="22 - Cava Premium" → queremos "22"
    var el = document.getElementById('carac-modelo');
    if (!el) return null;
    return el.value || null;
  }

  function lerDom() {
    var r = {};
    var put = function(k, v) { if (v != null && v !== '') r[k] = v; };

    put('modelo',           gvModelo());
    put('abertura',         gv('carac-abertura'));
    put('folhas',           gv('carac-folhas'));
    put('cor_ext',          gv('carac-cor-ext'));
    put('cor_int',          gv('carac-cor-int'));
    put('cor_macico',       gv('carac-cor-macico'));
    put('puxador',          gv('carac-puxador'));
    put('pux_tam',          gvNum('carac-pux-tam'));
    put('fech_mec',         gv('carac-fech-mec'));
    put('fech_dig',         gv('carac-fech-dig'));
    put('cilindro',         gv('carac-cilindro'));
    put('largura',          gvNum('largura'));
    put('altura',           gvNum('altura'));
    put('dist_borda_cava',  gvNum('carac-dist-borda-cava'));
    put('largura_cava',     gvNum('carac-largura-cava'));
    put('dist_borda_friso', gvNum('carac-dist-borda-friso'));
    put('largura_friso',    gvNum('carac-largura-friso'));
    put('friso_vert',       gvNum('carac-friso-vert'));
    put('friso_horiz',      gvNum('carac-friso-horiz'));
    put('ripado_total',     gv('carac-ripado-total'));
    put('ripado_2lados',    gv('carac-ripado-2lados'));
    put('tem_alisar',       gv('carac-tem-alisar'));

    return r;
  }

  function patchItens(body, dados) {
    if (!body || typeof body !== 'object') return body;
    if (Array.isArray(body.itens) && body.itens.length > 0) {
      body.itens = body.itens.map(function(it, idx) {
        return idx === 0 ? Object.assign({}, it, dados) : it;
      });
    }
    return body;
  }

  var origFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var isTarget = /\/rest\/v1\/(pre_orcamentos|versoes_aprovadas)/i.test(url);
      var method = ((init && init.method) || 'GET').toUpperCase();
      if (isTarget && ['POST','PATCH','PUT'].includes(method) && init && init.body) {
        var dados = lerDom();
        if (Object.keys(dados).length > 0) {
          var body;
          try { body = JSON.parse(init.body); } catch(e){ body = null; }
          if (body) {
            if (Array.isArray(body)) body = body.map(function(b){ return patchItens(b, dados); });
            else body = patchItens(body, dados);
            init = Object.assign({}, init, { body: JSON.stringify(body) });
            console.log('[mod 125 v2] payload patcheado com DOM:', dados);
          }
        }
      }
    } catch(err) { console.warn('[mod 125 v2] erro no patch:', err); }
    return origFetch.call(this, input, init);
  };

  console.log('[mod 125 v2] Intercept save de itens (IDs diretos) carregado');
})();
