/* ═══════════════════════════════════════════════════════════════════════════
   MEMORIAL CEM — Sistema de congelamento baseado em PNGs (v1.0)

   Felipe: "no CEM é assim, ele fica ali congelado e quando clico para abrir
   simplesmente aparece tudo pra mim".

   Abordagem: ZERO restauração de estado JavaScript.
   - Ao congelar revisão: captura PNG de cada aba (orçamento, perfis, acessórios,
     superfícies, proposta) com html2canvas e upload ao Supabase.
   - Ao abrir memorial: viewer overlay simples que mostra os PNGs salvos.

   Vantagens vs sistema anterior:
   - PNG não depende de variáveis JS, cores cadastradas, versão do código
   - 100% fiel: mostra exatamente o que o usuário viu quando congelou
   - Futuro-prova: revisões antigas continuam abrindo mesmo após refatorações
   - Simples: impossível "quebrar" como no sistema com restauração de estado

   Depende de: html2canvas (já carregado), _SB_URL + _SB_KEY (Supabase).
   ═══════════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  // Abas que vão virar PNG no memorial. Cada uma gera 1 imagem alta.
  // Ordem deliberada: começa pelo orçamento (mais importante), termina com proposta (já tem PDF).
  var ABAS_MEMORIAL = [
    { key:'orcamento',     tabId:'tab-orcamento',    nome:'Orçamento',               tabName:'orcamento' },
    { key:'perfis',        tabId:'tab-os',           nome:'Levantamento de Perfis',  tabName:'os' },
    { key:'acessorios',    tabId:'tab-os-acess',     nome:'Levantamento de Acessórios', tabName:'os-acess' },
    { key:'superficies',   tabId:'tab-planificador', nome:'Levantamento de Superfícies', tabName:'planificador' },
    { key:'proposta',      tabId:'tab-proposta',     nome:'Proposta Comercial',      tabName:'proposta' }
  ];

  // ───────────────────────────────────────────────────────────────────
  // Helper: expandir acordeões de uma aba antes de capturar.
  // A aba Orçamento tem 5 acordeões (Identificação, Parâmetros Financeiros,
  // Características, Custo Fabricação, Custo Instalação). Sem expandir,
  // o PNG captura só os cabeçalhos.
  // ───────────────────────────────────────────────────────────────────
  function _expandirAcordeoes(abaEl){
    if(!abaEl) return [];
    var restoreList = [];
    // Detalhes <details> nativo
    abaEl.querySelectorAll('details').forEach(function(d){
      if(!d.open){ restoreList.push({el:d, prop:'open', old:false}); d.open = true; }
    });
    // Divs com classe .ac (accordion) — padrão do projeto
    abaEl.querySelectorAll('.ac').forEach(function(ac){
      if(!ac.classList.contains('open')){
        restoreList.push({el:ac, prop:'class', old:ac.className});
        ac.classList.add('open');
      }
      // Body interno
      var body = ac.querySelector('.ac-bd, .ac-body, .ac-content');
      if(body && (body.style.display === 'none' || getComputedStyle(body).display === 'none')){
        restoreList.push({el:body, prop:'style.display', old:body.style.display});
        body.style.display = 'block';
      }
    });
    return restoreList;
  }

  function _restaurarAcordeoes(restoreList){
    restoreList.forEach(function(r){
      try {
        if(r.prop === 'open') r.el.open = r.old;
        else if(r.prop === 'class') r.el.className = r.old;
        else if(r.prop === 'style.display') r.el.style.display = r.old;
      } catch(e){}
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // Captura uma aba como PNG dataURL.
  // Técnica: torna aba visível off-screen, expande acordeões, html2canvas,
  // restaura estilo original. Não troca aba ativa (usuário não vê nada).
  // ───────────────────────────────────────────────────────────────────
  function _capturarAba(tabId){
    return new Promise(function(resolve, reject){
      if(typeof html2canvas === 'undefined'){
        return reject(new Error('html2canvas não carregado'));
      }
      var tab = document.getElementById(tabId);
      if(!tab){ return reject(new Error('Aba não encontrada: '+tabId)); }

      // Salvar estilo original
      var origStyle = tab.getAttribute('style') || '';
      var origDisplay = tab.style.display;

      // Tornar visível off-screen
      tab.style.display = 'block';
      tab.style.position = 'absolute';
      tab.style.left = '-99999px';
      tab.style.top = '0';
      tab.style.width = '1280px'; // largura fixa pra PNG consistente
      tab.style.opacity = '1';
      tab.style.visibility = 'visible';
      tab.style.pointerEvents = 'none';

      // Expandir acordeões
      var restoreList = _expandirAcordeoes(tab);

      // Forçar reflow + aguardar render
      void tab.offsetHeight;

      setTimeout(function(){
        html2canvas(tab, {
          scale: 1.2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1280
        }).then(function(canvas){
          // Restaurar estilo original ANTES de resolver (pra usuário não ver glitch)
          _restaurarAcordeoes(restoreList);
          tab.setAttribute('style', origStyle);
          if(!origStyle) tab.removeAttribute('style');
          // Se a aba não estava ativa, esconder de novo
          if(!tab.classList.contains('on')) tab.style.display = 'none';

          // JPEG 0.5 — equilibrio entre tamanho e qualidade (similar ao _exportPropostaToCard)
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        }).catch(function(e){
          _restaurarAcordeoes(restoreList);
          tab.setAttribute('style', origStyle);
          if(!origStyle) tab.removeAttribute('style');
          if(!tab.classList.contains('on')) tab.style.display = 'none';
          reject(e);
        });
      }, 400);
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // Upload: salva PNGs no Supabase (tabela configuracoes, chave/valor).
  // Mesma abordagem do _exportPropostaToCard — não precisa criar bucket novo.
  // ───────────────────────────────────────────────────────────────────
  function _uploadPngs(cardId, revIdx, pngs){
    return new Promise(function(resolve, reject){
      var _sbUrl = window._SB_URL, _sbKey = window._SB_KEY;
      if(!_sbUrl || !_sbKey){ return reject(new Error('Supabase não configurado')); }
      var chave = 'memorial_pngs_'+cardId+'_rev'+revIdx;
      var body = {
        chave: chave,
        valor: {
          pngs: pngs,  // {orcamento:dataURL, perfis:dataURL, ...}
          date: new Date().toISOString(),
          cardId: cardId,
          revIdx: revIdx
        }
      };
      fetch(_sbUrl+'/rest/v1/configuracoes', {
        method: 'POST',
        headers: {
          'apikey': _sbKey,
          'Authorization': 'Bearer '+_sbKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(body)
      }).then(function(r){
        if(r.ok){ console.log('[MemorialCem] ☁️ '+Object.keys(pngs).length+' PNGs salvos em '+chave); resolve(chave); }
        else { reject(new Error('Upload falhou: HTTP '+r.status)); }
      }).catch(reject);
    });
  }

  function _downloadPngs(chave){
    return new Promise(function(resolve, reject){
      var _sbUrl = window._SB_URL, _sbKey = window._SB_KEY;
      if(!_sbUrl || !_sbKey){ return reject(new Error('Supabase não configurado')); }
      fetch(_sbUrl+'/rest/v1/configuracoes?chave=eq.'+encodeURIComponent(chave)+'&select=valor', {
        headers: { 'apikey':_sbKey, 'Authorization':'Bearer '+_sbKey }
      }).then(function(r){ return r.json(); })
        .then(function(arr){
          if(!arr || !arr.length) return reject(new Error('Memorial não encontrado no banco'));
          resolve(arr[0].valor);
        })
        .catch(reject);
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // API PÚBLICA: capturarRevisao
  // Chamado ao congelar revisão. Roda em BACKGROUND — não bloqueia UI.
  // Captura cada aba sequencialmente (paralelo pode sobrecarregar html2canvas).
  // ───────────────────────────────────────────────────────────────────
  async function capturarRevisao(cardId, revIdx, opts){
    opts = opts || {};
    var onProgress = opts.onProgress || function(){};
    var pngs = {};
    console.log('[MemorialCem] 📸 Iniciando captura de '+ABAS_MEMORIAL.length+' abas — card '+cardId+' rev '+revIdx);

    for(var i=0; i<ABAS_MEMORIAL.length; i++){
      var aba = ABAS_MEMORIAL[i];
      try {
        onProgress({step:i+1, total:ABAS_MEMORIAL.length, nome:aba.nome, status:'capturando'});
        var dataURL = await _capturarAba(aba.tabId);
        pngs[aba.key] = dataURL;
        console.log('[MemorialCem] ✓ '+aba.nome+' capturada ('+Math.round(dataURL.length/1024)+' KB)');
      } catch(e){
        console.warn('[MemorialCem] ✗ Falhou capturar '+aba.nome+':', e.message);
        onProgress({step:i+1, total:ABAS_MEMORIAL.length, nome:aba.nome, status:'erro', erro:e.message});
      }
    }

    if(Object.keys(pngs).length === 0){
      throw new Error('Nenhuma aba foi capturada com sucesso');
    }

    // Upload
    onProgress({step:ABAS_MEMORIAL.length, total:ABAS_MEMORIAL.length, nome:'uploading', status:'uploading'});
    var chave = await _uploadPngs(cardId, revIdx, pngs);

    // Atualizar card com flag + chave
    try {
      var CK = 'projetta_crm_v1';
      var data = JSON.parse(localStorage.getItem(CK) || '[]');
      var ci = data.findIndex(function(o){ return o.id === cardId; });
      if(ci >= 0 && data[ci].revisoes && data[ci].revisoes[revIdx]){
        data[ci].revisoes[revIdx].memorialCemKey = chave;
        data[ci].revisoes[revIdx].memorialCemAbas = Object.keys(pngs);
        data[ci].revisoes[revIdx].memorialCemDate = new Date().toISOString();
        localStorage.setItem(CK, JSON.stringify(data));
      }
    } catch(e){ console.warn('[MemorialCem] Erro ao atualizar card:', e); }

    onProgress({step:ABAS_MEMORIAL.length, total:ABAS_MEMORIAL.length, status:'done', chave:chave});
    console.log('[MemorialCem] ✅ Captura completa — '+Object.keys(pngs).length+' abas salvas em '+chave);
    return { chave: chave, abas: Object.keys(pngs) };
  }

  // ───────────────────────────────────────────────────────────────────
  // API PÚBLICA: abrir — abre viewer tela cheia com os PNGs da revisão.
  // ───────────────────────────────────────────────────────────────────
  async function abrir(cardId, revIdx){
    // Buscar chave no card
    var data = JSON.parse(localStorage.getItem('projetta_crm_v1') || '[]');
    var card = data.find(function(o){ return o.id === cardId; });
    if(!card || !card.revisoes || !card.revisoes[revIdx]){
      throw new Error('Revisão não encontrada');
    }
    var rev = card.revisoes[revIdx];
    var chave = rev.memorialCemKey;
    if(!chave){
      throw new Error('Esta revisão ainda não tem memorial PNG. Congele uma nova revisão pra gerar.');
    }

    // Buscar PNGs
    var valor = await _downloadPngs(chave);
    if(!valor || !valor.pngs){
      throw new Error('PNGs não encontrados no banco');
    }

    _renderViewer({
      cliente: card.cliente || '—',
      agp:     card.agp || '—',
      revLabel: rev.label || ('Revisão '+revIdx),
      revDate:  rev.data || rev.date || valor.date,
      valorTabela: rev.valorTabela,
      valorFaturamento: rev.valorFaturamento,
      pngs: valor.pngs
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // Viewer: modal fullscreen com sidebar + imagem principal
  // ───────────────────────────────────────────────────────────────────
  function _renderViewer(ctx){
    // Remove viewer anterior se existir
    var old = document.getElementById('memorial-cem-viewer');
    if(old) old.remove();

    var abasPresentes = ABAS_MEMORIAL.filter(function(a){ return !!ctx.pngs[a.key]; });
    if(!abasPresentes.length){
      alert('Memorial sem PNGs válidos.');
      return;
    }

    var primeira = abasPresentes[0];

    // Formato BRL
    var brl = function(v){
      if(v==null || isNaN(v)) return '—';
      return 'R$ '+Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    };

    var dt = ctx.revDate ? new Date(ctx.revDate).toLocaleString('pt-BR') : '';

    var overlay = document.createElement('div');
    overlay.id = 'memorial-cem-viewer';
    overlay.style.cssText = 'position:fixed;inset:0;background:#1a1a1a;z-index:99999;display:flex;flex-direction:column;font-family:inherit';

    overlay.innerHTML = ''+
      '<div style="background:#003144;color:#fff;padding:14px 20px;display:flex;align-items:center;gap:20px;box-shadow:0 2px 10px rgba(0,0,0,.4)">'+
        '<button id="mcem-voltar" style="background:#c47012;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">← Voltar ao CRM</button>'+
        '<div style="flex:1">'+
          '<div style="font-size:17px;font-weight:800;letter-spacing:.3px">🔒 MEMORIAL — '+_escHTML(ctx.cliente)+'</div>'+
          '<div style="font-size:12px;opacity:.85;margin-top:2px">'+_escHTML(ctx.revLabel)+(dt?' · salvo em '+dt:'')+(ctx.agp!=='—'?' · '+_escHTML(ctx.agp):'')+'</div>'+
        '</div>'+
        '<div style="text-align:right">'+
          (ctx.valorTabela ? '<div style="font-size:11px;opacity:.85">Preço Tabela</div><div style="font-size:15px;font-weight:800">'+brl(ctx.valorTabela)+'</div>' : '')+
        '</div>'+
        '<div style="text-align:right">'+
          (ctx.valorFaturamento ? '<div style="font-size:11px;opacity:.85">Faturamento</div><div style="font-size:15px;font-weight:800;color:#7be07b">'+brl(ctx.valorFaturamento)+'</div>' : '')+
        '</div>'+
      '</div>'+
      '<div style="flex:1;display:flex;min-height:0">'+
        '<div style="width:220px;background:#222;color:#ddd;padding:14px 0;overflow-y:auto;border-right:1px solid #333">'+
          '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:.5;padding:0 16px 8px 16px">Navegação</div>'+
          '<div id="mcem-navlist"></div>'+
        '</div>'+
        '<div id="mcem-content" style="flex:1;overflow:auto;padding:20px;background:#2a2a2a;text-align:center">'+
          '<img id="mcem-img" src="" style="max-width:100%;height:auto;box-shadow:0 4px 20px rgba(0,0,0,.5);background:#fff">'+
        '</div>'+
      '</div>';

    document.body.appendChild(overlay);

    // Preencher sidebar
    var nav = overlay.querySelector('#mcem-navlist');
    abasPresentes.forEach(function(aba, i){
      var btn = document.createElement('div');
      btn.className = 'mcem-nav-item';
      btn.dataset.key = aba.key;
      btn.style.cssText = 'padding:12px 16px;cursor:pointer;font-size:13px;border-left:3px solid transparent;transition:background .1s';
      btn.innerHTML = '<div style="font-weight:600">'+_escHTML(aba.nome)+'</div>';
      btn.addEventListener('click', function(){ _selecionarAba(overlay, aba.key, ctx.pngs); });
      btn.addEventListener('mouseenter', function(){ if(!btn.classList.contains('active')) btn.style.background = '#333'; });
      btn.addEventListener('mouseleave', function(){ if(!btn.classList.contains('active')) btn.style.background = ''; });
      nav.appendChild(btn);
    });

    // Ativar primeira
    _selecionarAba(overlay, primeira.key, ctx.pngs);

    // Botão voltar — apenas fecha o overlay
    overlay.querySelector('#mcem-voltar').addEventListener('click', function(){
      overlay.remove();
    });

    // ESC fecha
    var escHandler = function(e){
      if(e.key === 'Escape'){
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  function _selecionarAba(overlay, key, pngs){
    overlay.querySelectorAll('.mcem-nav-item').forEach(function(el){
      if(el.dataset.key === key){
        el.classList.add('active');
        el.style.background = '#c47012';
        el.style.borderLeftColor = '#fff';
        el.style.color = '#fff';
      } else {
        el.classList.remove('active');
        el.style.background = '';
        el.style.borderLeftColor = 'transparent';
        el.style.color = '#ddd';
      }
    });
    var img = overlay.querySelector('#mcem-img');
    if(img && pngs[key]){
      img.src = pngs[key];
      // Rolar pro topo
      overlay.querySelector('#mcem-content').scrollTop = 0;
    }
  }

  function _escHTML(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ───────────────────────────────────────────────────────────────────
  // API PÚBLICA
  // ───────────────────────────────────────────────────────────────────
  window.MemorialCem = {
    version: '1.0',
    abas: ABAS_MEMORIAL,
    capturar: capturarRevisao,
    abrir: abrir
  };

  console.log('[MemorialCem] v1.0 carregado — '+ABAS_MEMORIAL.length+' abas configuradas');
})();
