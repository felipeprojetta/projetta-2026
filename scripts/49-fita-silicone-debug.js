/* ═══════════════════════════════════════════════════════════════════════
   49-fita-silicone-debug.js
   ─────────────────────────────────────────────────────────────────────
   Felipe sessao 2026-08: 'me traga suas contas detalhadas'.

   Modal que mostra o BREAKDOWN do calculo de Fita Dupla Face + Silicone
   por item. Quando Felipe pergunta "de onde vieram esses 16 tubos de
   Dowsil?", esse modal responde linha a linha.

   Lê o cache window._fitaSiliconeBreakdownCache[itemId] preenchido pelo
   modulo 28-acessorios-porta-externa.js durante o calculo de custos.

   Cada linha mostra:
     ORIGEM (peca/perfil): "PA-PA006: Altura Folha 2790mm × 2 (5.58m)"
     REGRA APLICADA:       "altura_folha"
     METROS:                5.58m
     MULTIPLICADORES:       FD19=1, FD12=0, MS=8
     CONTRIBUICAO:          FD19=5.58m, FD12=0m, MS=44.64m

   API publica:
     window.FitaSiliconeDebug.abrir(itemId)
     window.debugFitaSilicone(itemId)  ← alias

   Nao modifica nenhum modulo existente.
   ═══════════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function fmtNum(n, d) {
    return (Number(n) || 0).toFixed(d == null ? 2 : d);
  }

  function injetarCSS() {
    if (document.getElementById('fsd-css')) return;
    var st = document.createElement('style');
    st.id = 'fsd-css';
    st.textContent = ''
      + '.fsd-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:99998; display:flex; align-items:center; justify-content:center; }'
      + '.fsd-modal { background:#fff; border-radius:12px; width:96%; max-width:1100px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.25); }'
      + '.fsd-header { padding:16px 20px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; }'
      + '.fsd-header h3 { margin:0; color:#003144; font-size:17px; }'
      + '.fsd-close { background:none; border:none; font-size:22px; cursor:pointer; color:#6b7280; }'
      + '.fsd-body { padding:16px 20px; overflow-y:auto; flex:1; }'
      + '.fsd-resumo { display:flex; gap:12px; flex-wrap:wrap; padding:12px; background:#f8fafc; border-radius:8px; margin-bottom:16px; }'
      + '.fsd-card { flex:1; min-width:180px; padding:10px 14px; background:#fff; border-radius:6px; border:1px solid #e5e7eb; }'
      + '.fsd-card-titulo { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; }'
      + '.fsd-card-valor { font-size:18px; font-weight:700; color:#003144; margin-top:4px; }'
      + '.fsd-card-sub { font-size:11px; color:#9ca3af; margin-top:2px; }'
      + '.fsd-tab { width:100%; border-collapse:collapse; font-size:12px; }'
      + '.fsd-tab th { background:#003144; color:#fff; padding:8px 10px; text-align:left; font-weight:600; }'
      + '.fsd-tab td { padding:6px 10px; border-bottom:1px solid #f1f5f9; }'
      + '.fsd-tab tr:nth-child(even) td { background:#fafbfc; }'
      + '.fsd-tab tfoot td { font-weight:700; background:#fef3c7; padding:10px; border-top:2px solid #f59e0b; }'
      + '.fsd-num { text-align:right; font-variant-numeric:tabular-nums; }'
      + '.fsd-mult { color:#6b7280; font-size:11px; }'
      + '.fsd-vazio { padding:32px; text-align:center; color:#6b7280; font-style:italic; }'
      + '.fsd-footer { padding:12px 20px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; gap:12px; }'
      + '.fsd-info { font-size:11px; color:#6b7280; flex:1; }'
      + '.fsd-btn { padding:8px 16px; border-radius:6px; border:none; cursor:pointer; font-size:13px; font-weight:600; }'
      + '.fsd-btn-cancel { background:#f3f4f6; color:#374151; }'
      + '';
    document.head.appendChild(st);
  }

  function abrir(itemId) {
    injetarCSS();
    var cache = window._fitaSiliconeBreakdownCache || {};
    var dados = cache[itemId];
    if (!dados) {
      // Tenta buscar qualquer entrada se itemId nao bate
      var keys = Object.keys(cache);
      if (keys.length === 1) {
        dados = cache[keys[0]];
      } else if (keys.length > 1) {
        // Pega o mais recente
        var maisRecente = keys.reduce(function(acc, k) {
          return (!acc || cache[k].ts > cache[acc].ts) ? k : acc;
        }, null);
        dados = cache[maisRecente];
      }
    }
    if (!dados) {
      alert('Calculo de Fita+Silicone nao encontrado. Abra a aba Custos do orcamento primeiro pra disparar o calculo.');
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'fsd-overlay';

    var b = dados.breakdown || [];
    var t = dados.totais   || {};
    var dim= dados.itemDim || {};

    // Linhas da tabela (ordenadas por contribuicao de MS desc)
    var linhasOrdenadas = b.slice().sort(function(a,b2){
      return (b2.contrib.ms||0) - (a.contrib.ms||0);
    });

    var linhasHtml = linhasOrdenadas.map(function(e){
      var msContrib = e.contrib.ms || 0;
      var pct = t.mMS > 0 ? (msContrib / t.mMS) * 100 : 0;
      return ''
        + '<tr>'
        +   '<td>' + escHtml(e.origem) + '</td>'
        +   '<td><code style="font-size:11px;color:#6b7280">' + escHtml(e.regra) + '</code></td>'
        +   '<td class="fsd-num">' + fmtNum(e.metros) + 'm</td>'
        +   '<td class="fsd-mult fsd-num">×' + fmtNum(e.mult.fd19, 1) + ' / ×' + fmtNum(e.mult.fd12, 1) + ' / ×' + fmtNum(e.mult.ms, 1) + '</td>'
        +   '<td class="fsd-num">' + fmtNum(e.contrib.fd19) + 'm</td>'
        +   '<td class="fsd-num">' + fmtNum(e.contrib.fd12) + 'm</td>'
        +   '<td class="fsd-num" style="font-weight:600;color:' + (pct > 20 ? '#b91c1c' : '#003144') + '">'
        +     fmtNum(msContrib) + 'm <span style="font-size:10px;color:#9ca3af">(' + fmtNum(pct, 0) + '%)</span>'
        +   '</td>'
        + '</tr>';
    }).join('');

    overlay.innerHTML = ''
      + '<div class="fsd-modal">'
      +   '<div class="fsd-header">'
      +     '<h3>📊 Detalhamento Fita Dupla + Silicone</h3>'
      +     '<button class="fsd-close" type="button" title="Fechar">×</button>'
      +   '</div>'
      +   '<div class="fsd-body">'
      +     '<div style="margin-bottom:12px;color:#374151;font-size:13px">'
      +       '<b>Item:</b> ' + escHtml(dados.itemTipo || '?') + '  '
      +       '· <b>Dimensoes:</b> ' + (dim.L||0) + ' × ' + (dim.H||0) + 'mm  '
      +       '· <b>Folhas:</b> ' + (dim.nFolhas||1) + '  '
      +       '· <b>Qtd:</b> ' + (dim.qtdPortas||1)
      +     '</div>'
      +     '<div class="fsd-resumo">'
      +       '<div class="fsd-card">'
      +         '<div class="fsd-card-titulo">Fita Dupla Face 19mm</div>'
      +         '<div class="fsd-card-valor">' + fmtNum(t.mFD19, 1) + ' m</div>'
      +         '<div class="fsd-card-sub">' + dados.rolosFD19 + ' rolo(s) de 20m</div>'
      +       '</div>'
      +       '<div class="fsd-card">'
      +         '<div class="fsd-card-titulo">Fita Dupla Face 12mm</div>'
      +         '<div class="fsd-card-valor">' + fmtNum(t.mFD12, 1) + ' m</div>'
      +         '<div class="fsd-card-sub">' + dados.rolosFD12 + ' rolo(s) de 20m</div>'
      +       '</div>'
      +       '<div class="fsd-card" style="border-color:#f59e0b">'
      +         '<div class="fsd-card-titulo">Silicone Dowsil 995</div>'
      +         '<div class="fsd-card-valor" style="color:#b45309">' + fmtNum(t.mMS, 1) + ' m</div>'
      +         '<div class="fsd-card-sub">' + dados.tubosMS + ' tubo(s) de 8m</div>'
      +       '</div>'
      +     '</div>'
      +     (linhasOrdenadas.length === 0
        ? '<div class="fsd-vazio">Nenhuma peca/perfil contribuiu pro calculo. Verifique se o Levantamento de Superficies e os perfis foram gerados.</div>'
        : ''
          + '<table class="fsd-tab">'
          +   '<thead><tr>'
          +     '<th>Peca / Perfil</th>'
          +     '<th>Regra</th>'
          +     '<th class="fsd-num">Metros</th>'
          +     '<th class="fsd-num">Mult. (FD19/FD12/MS)</th>'
          +     '<th class="fsd-num">FD19</th>'
          +     '<th class="fsd-num">FD12</th>'
          +     '<th class="fsd-num">Silicone</th>'
          +   '</tr></thead>'
          +   '<tbody>' + linhasHtml + '</tbody>'
          +   '<tfoot><tr>'
          +     '<td colspan="4">TOTAL</td>'
          +     '<td class="fsd-num">' + fmtNum(t.mFD19) + 'm</td>'
          +     '<td class="fsd-num">' + fmtNum(t.mFD12) + 'm</td>'
          +     '<td class="fsd-num">' + fmtNum(t.mMS) + 'm</td>'
          +   '</tr></tfoot>'
          + '</table>'
      )
      +   '</div>'
      +   '<div class="fsd-footer">'
      +     '<div class="fsd-info">💡 Os multiplicadores estao em <b>Cadastro &gt; Regras e Logicas &gt; Fita Dupla Face + Silicone</b>. Pode editar la se quiser ajustar.</div>'
      +     '<button class="fsd-btn fsd-btn-cancel" type="button">Fechar</button>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    function fechar() { overlay.remove(); }
    overlay.addEventListener('click', function(ev){ if (ev.target === overlay) fechar(); });
    overlay.querySelector('.fsd-close').addEventListener('click', fechar);
    overlay.querySelector('.fsd-btn-cancel').addEventListener('click', fechar);
  }

  window.FitaSiliconeDebug = { abrir: abrir };
  // Alias mais curto pra console
  window.debugFitaSilicone = abrir;
})();
