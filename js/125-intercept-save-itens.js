(() => {
  if (window.__MOD_125_LOADED) return;
  window.__MOD_125_LOADED = true;

  function getValByLabel(labelRegex) {
    const labels = [...document.querySelectorAll('label,div,span,p,strong')];
    for (const l of labels) {
      if (!labelRegex.test(l.textContent || '')) continue;
      const wrapper = l.closest('div,fieldset,section') || l.parentElement;
      const ctrl = wrapper && wrapper.querySelector('select,input[type="number"],input[type="text"],input:not([type])');
      if (ctrl) {
        if (ctrl.tagName === 'SELECT') {
          const opt = ctrl.options[ctrl.selectedIndex];
          return { val: ctrl.value, text: (opt && opt.text) || '' };
        }
        if (ctrl.type === 'checkbox') return { val: String(ctrl.checked), text: '' };
        return { val: ctrl.value, text: '' };
      }
    }
    return null;
  }

  function lerDom() {
    const r = {};
    const m = getValByLabel(/^\s*modelo\s*$/i);
    if (m) { const num = (m.text||'').match(/^(\d+)/); r.modelo = num ? num[1] : m.val; }
    const ce = getValByLabel(/cor\s*(chapa)?\s*externa/i);
    if (ce) r.cor_ext = ce.text || ce.val;
    const ci = getValByLabel(/cor\s*(chapa)?\s*interna/i);
    if (ci) r.cor_int = ci.text || ci.val;
    const px = getValByLabel(/^\s*puxador\s*$/i);
    if (px) r.puxador = (px.text || px.val || '').toUpperCase();
    const pt = getValByLabel(/tamanho\s*puxador/i);
    if (pt) {
      const t = (pt.text||pt.val||'').replace(',', '.').match(/[\d.]+/);
      if (t) r.pux_tam = t[0];
    }
    const fm = getValByLabel(/fechadura\s*mec/i);
    if (fm) r.fech_mec = (fm.text||fm.val||'').toUpperCase();
    const fd = getValByLabel(/fechadura\s*dig/i);
    if (fd) r.fech_dig = (fd.text||fd.val||'').toUpperCase();
    const cil = getValByLabel(/^\s*cilindro\s*$/i);
    if (cil) r.cilindro = (cil.text||cil.val||'').toUpperCase();
    const lar = getValByLabel(/^\s*largura\s*$/i);
    if (lar) r.largura = lar.val;
    const alt = getValByLabel(/^\s*altura\s*$/i);
    if (alt) r.altura = alt.val;
    const dbf = getValByLabel(/dist[aâ]ncia.*borda.*friso/i);
    if (dbf) r.dist_borda_friso = dbf.val;
    const lf = getValByLabel(/largura\s*do\s*friso/i);
    if (lf) r.largura_friso = lf.val;
    const fv = getValByLabel(/frisos?\s*verticais/i);
    if (fv) r.friso_v_qty = fv.val;
    const al = getValByLabel(/alisar/i);
    if (al) r.tem_alisar = al.val;
    return r;
  }

  function patchItens(body, dados) {
    if (!body || typeof body !== 'object') return body;
    if (Array.isArray(body.itens) && body.itens.length > 0) {
      body.itens = body.itens.map((it, idx) => idx === 0 ? Object.assign({}, it, dados) : it);
    }
    return body;
  }

  const origFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      const isTarget = /\/rest\/v1\/(pre_orcamentos|versoes_aprovadas)/i.test(url);
      const method = ((init && init.method) || 'GET').toUpperCase();
      if (isTarget && ['POST','PATCH','PUT'].includes(method) && init && init.body) {
        const dados = lerDom();
        if (Object.keys(dados).length > 0) {
          let body;
          try { body = JSON.parse(init.body); } catch(e){ body = null; }
          if (body) {
            if (Array.isArray(body)) body = body.map(b => patchItens(b, dados));
            else body = patchItens(body, dados);
            init = Object.assign({}, init, { body: JSON.stringify(body) });
            console.log('[mod 125] payload patcheado com DOM:', dados);
          }
        }
      }
    } catch(err) { console.warn('[mod 125] erro no patch:', err); }
    return origFetch.call(this, input, init);
  };

  console.log('[mod 125] Intercept save de itens carregado.');
})();
