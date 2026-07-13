/* ============================================================
   56-comparar-versoes.js — Painel "Comparar Versões"
   ------------------------------------------------------------
   Felipe sessao 37: "faca um painel aonde possamos comparar
   algumas versoes... me abre os custos, relatorios, paineis de
   um x o outro".

   Caso motivador: Conrado Engel V4 x V5 — item 2 (fixo) foi de
   ~15k pra ~23k SEM mudar nada no item. Causa: item 1 virou
   Aco Inox (chapa R$6.000 vs ACM R$1.253) e o rateio de chapas
   e' por m² bruto do item, cego ao material — o fixo absorveu
   parte do custo do inox. Este painel expoe exatamente isso:
   decomposicao por componente, lado a lado, com deltas e uma
   secao "O que mudou" (diff dos campos dos itens).

   Isolamento:
     - IIFE proprio, prefixo CSS .cmpv-
     - CSS injetado pelo proprio modulo (zero toque em styles/)
     - LE' dados via API publica window.Orcamento
       (valoresPropostaDaVersao / obterVersao / _getVersaoAtivaWizard)
     - NAO escreve nada em Storage/Supabase — leitura pura
     - Botao "⇆ Comparar versoes" injetado no .orc-banner via
       MutationObserver (zero edicao no HTML do 12-orcamento.js)
   ============================================================ */

const CompararVersoes = (() => {
  'use strict';

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function fmt(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtInt(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  const TIPO_LABEL = {
    porta_externa: 'Porta Externa',
    porta_interna: 'Porta Interna',
    fixo_acoplado: 'Fixo Acoplado',
    revestimento_acoplado: 'Rev. Acoplado',
    revestimento_parede: 'Rev. Parede',
    pergolado: 'Pergolado',
  };
  function descItem(it) {
    if (!it) return '—';
    const tipo = TIPO_LABEL[it.tipo] || it.tipo || 'Item';
    let med = '';
    if (it.tipo === 'revestimento_parede' || it.tipo === 'pergolado') {
      const w = Number(it.largura_total) || 0, h = Number(it.altura_total) || 0;
      if (w && h) med = ` ${w}×${h}`;
    } else {
      const w = Number(it.largura) || 0, h = Number(it.altura) || 0;
      if (w && h) med = ` ${w}×${h}`;
    }
    const rev = it.revestimento ? ` · ${it.revestimento}` : '';
    const mod = (it.modeloNumero != null && it.modeloNumero !== '') ? ` · mod ${it.modeloNumero}` : '';
    return `${tipo}${med}${rev}${mod}`;
  }
  function fmtDataCurta(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' +
             d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return ''; }
  }

  // ------------------------------------------------------------------
  // CSS (injetado uma vez)
  // ------------------------------------------------------------------
  let cssInjetado = false;
  function injetarCss() {
    if (cssInjetado) return;
    cssInjetado = true;
    const st = document.createElement('style');
    st.id = 'cmpv-css';
    st.textContent = `
.cmpv-btn-abrir{margin-left:10px;padding:2px 10px;font-size:12px;border:1px solid rgba(255,255,255,.45);
  border-radius:6px;background:transparent;color:inherit;cursor:pointer;vertical-align:middle}
.cmpv-btn-abrir:hover{background:rgba(255,255,255,.12)}
.cmpv-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9500;display:flex;
  align-items:flex-start;justify-content:center;padding:4vh 16px;overflow:auto}
.cmpv-modal{background:#fff;border-radius:12px;max-width:1100px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.35);
  display:flex;flex-direction:column;max-height:92vh}
.cmpv-head{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 18px;border-bottom:1px solid #e2e8f0}
.cmpv-titulo{font-size:16px;font-weight:700;color:#0f172a}
.cmpv-sub{font-size:12px;color:#64748b;margin-top:2px}
.cmpv-fechar{border:none;background:none;font-size:20px;cursor:pointer;color:#64748b;padding:4px 8px}
.cmpv-fechar:hover{color:#0f172a}
.cmpv-body{padding:14px 18px;overflow:auto}
.cmpv-sel{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.cmpv-sel-chip{display:flex;align-items:center;gap:6px;border:1px solid #cbd5e1;border-radius:8px;
  padding:6px 10px;font-size:12.5px;cursor:pointer;user-select:none;background:#f8fafc}
.cmpv-sel-chip input{margin:0}
.cmpv-sel-chip.is-on{border-color:#0f766e;background:#f0fdfa;color:#134e4a;font-weight:600}
.cmpv-aviso{font-size:12px;color:#b45309;margin:6px 0 10px}
.cmpv-tabela-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px}
.cmpv-tabela{border-collapse:collapse;width:100%;font-size:12.5px;min-width:560px}
.cmpv-tabela th,.cmpv-tabela td{padding:6px 10px;text-align:right;border-bottom:1px solid #f1f5f9;white-space:nowrap}
.cmpv-tabela th:first-child,.cmpv-tabela td:first-child{text-align:left}
.cmpv-tabela thead th{background:#0f172a;color:#fff;font-weight:600;position:sticky;top:0}
.cmpv-item-head td{background:#f1f5f9;font-weight:700;color:#0f172a;border-top:2px solid #cbd5e1}
.cmpv-linha-total td{font-weight:700;background:#f8fafc;border-top:1px solid #cbd5e1}
.cmpv-geral td{font-weight:700;background:#0f766e0d}
.cmpv-delta-pos{color:#b91c1c;font-weight:600}
.cmpv-delta-neg{color:#15803d;font-weight:600}
.cmpv-delta-zero{color:#94a3b8}
.cmpv-secao-tit{font-size:13px;font-weight:700;color:#0f172a;margin:18px 0 8px}
.cmpv-chapas{font-size:12px;color:#334155;line-height:1.6}
.cmpv-chapas b{color:#0f172a}
.cmpv-mudou{font-size:12px;color:#334155;line-height:1.6}
.cmpv-mudou code{background:#f1f5f9;border-radius:4px;padding:1px 5px;font-size:11.5px}
.cmpv-mudou .cmpv-de{color:#b91c1c;text-decoration:line-through}
.cmpv-mudou .cmpv-para{color:#15803d;font-weight:600}
.cmpv-badge-dirty{display:inline-block;font-size:10.5px;background:#fef3c7;color:#92400e;
  border-radius:6px;padding:1px 6px;margin-left:6px;font-weight:600}
.cmpv-vazio{padding:24px;text-align:center;color:#64748b;font-size:13px}
`;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------
  // Estado do modal
  // ------------------------------------------------------------------
  let overlayEl = null;
  let negocioAtual = null;      // negocio carregado no modal
  let selecionadas = [];        // ids de versao marcados (ordem de numero)

  function fechar() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    negocioAtual = null;
    selecionadas = [];
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') fechar(); }

  // Lista achatada de versoes do negocio: [{id, numero, letra, status, criadoEm}]
  function listarVersoesDoNegocio(negocio) {
    const out = [];
    (negocio.opcoes || []).forEach(o => {
      (o.versoes || []).forEach(v => {
        out.push({
          id: v.id, numero: v.numero, letra: o.letra || 'A',
          status: v.status || 'draft', criadoEm: v.criadoEm,
        });
      });
    });
    out.sort((a, b) => (a.letra === b.letra)
      ? (Number(a.numero) - Number(b.numero))
      : String(a.letra).localeCompare(String(b.letra)));
    return out;
  }

  // ------------------------------------------------------------------
  // Diff de itens ("O que mudou") — compara itens por indice entre a
  // 1a versao selecionada e cada outra. Ignora chaves internas (_*).
  // ------------------------------------------------------------------
  function diffItens(versaoA, versaoB) {
    const linhas = [];
    const ia = (versaoA && versaoA.itens) || [];
    const ib = (versaoB && versaoB.itens) || [];
    const n = Math.max(ia.length, ib.length);
    for (let i = 0; i < n; i++) {
      const a = ia[i], b = ib[i];
      if (!a && b) { linhas.push({ item: i, campo: '(item novo)', de: '—', para: descItem(b) }); continue; }
      if (a && !b) { linhas.push({ item: i, campo: '(item removido)', de: descItem(a), para: '—' }); continue; }
      const chaves = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
      chaves.forEach(k => {
        if (k.charAt(0) === '_') return; // _cacheKey, _overrides etc
        const va = JSON.stringify(a[k]);
        const vb = JSON.stringify(b[k]);
        if (va !== vb) {
          linhas.push({
            item: i, campo: k,
            de: va === undefined ? '—' : va,
            para: vb === undefined ? '—' : vb,
          });
        }
      });
    }
    return linhas;
  }

  // ------------------------------------------------------------------
  // Render da comparacao
  // ------------------------------------------------------------------
  const COMPONENTES = [
    ['perfis',  'Perfis'],
    ['pintura', 'Pintura'],
    ['chapas',  'Chapas'],
    ['acess',   'Acessórios'],
    ['fechDig', 'Fech. Digital'],
    ['extras',  'Extras'],
    ['maoObra', 'Mão de obra'],
  ];

  function celDelta(base, atual) {
    const d = (Number(atual) || 0) - (Number(base) || 0);
    if (Math.abs(d) < 0.005) return '<span class="cmpv-delta-zero">—</span>';
    const cls = d > 0 ? 'cmpv-delta-pos' : 'cmpv-delta-neg';
    const sinal = d > 0 ? '+' : '−';
    return `<span class="${cls}">${sinal}${fmt(Math.abs(d))}</span>`;
  }

  function renderComparacao() {
    const alvo = overlayEl && overlayEl.querySelector('.cmpv-resultado');
    if (!alvo) return;
    if (selecionadas.length < 2) {
      alvo.innerHTML = '<div class="cmpv-vazio">Marque pelo menos 2 versões pra comparar.</div>';
      return;
    }

    // Carrega o rateio de cada versao selecionada
    const cols = [];
    for (const vid of selecionadas) {
      let r = null;
      try { r = window.Orcamento.valoresPropostaDaVersao(vid); } catch (e) { console.warn('[cmpv]', e); }
      if (r) cols.push(r);
    }
    if (cols.length < 2) {
      alvo.innerHTML = '<div class="cmpv-vazio">Não consegui calcular os custos dessas versões.</div>';
      return;
    }
    // Ordena colunas por opcao/numero pra leitura natural
    cols.sort((a, b) => Number(a.versao.numero) - Number(b.versao.numero));

    const base = cols[0];
    const mostrarDelta = cols.length === 2;
    const nItens = Math.max(...cols.map(c => (c.vp.porItem || []).length));

    // Cabecalho
    let head = '<tr><th>Componente</th>';
    cols.forEach(c => {
      const dirty = c.versao.calcDirty ? '<span class="cmpv-badge-dirty">recalcular</span>' : '';
      head += `<th>V${esc(c.versao.numero)}${dirty}</th>`;
    });
    if (mostrarDelta) head += '<th>Δ (V' + esc(cols[1].versao.numero) + '−V' + esc(base.versao.numero) + ')</th>';
    head += '</tr>';

    // Corpo: bloco por item
    let body = '';
    for (let idx = 0; idx < nItens; idx++) {
      const itemRef = cols.map(c => (c.vp.porItem || [])[idx]).find(x => x && x.item);
      body += `<tr class="cmpv-item-head"><td colspan="${cols.length + (mostrarDelta ? 2 : 1)}">Item ${idx + 1} — ${esc(descItem(itemRef && itemRef.item))}</td></tr>`;

      COMPONENTES.forEach(([k, label]) => {
        const vals = cols.map(c => {
          const pi = (c.vp.porItem || [])[idx];
          return pi ? (pi._detalhe ? pi._detalhe[k] : 0) : null;
        });
        if (vals.every(v => !v)) return; // linha toda zero: esconde
        body += `<tr><td>${esc(label)}</td>`;
        vals.forEach(v => { body += `<td>${v == null ? '—' : 'R$ ' + fmt(v)}</td>`; });
        if (mostrarDelta) body += `<td>${celDelta(vals[0], vals[1])}</td>`;
        body += '</tr>';
      });

      // Fab / Inst / Preco final do item
      const linhasTot = [
        ['subFab',  '= Custo Fabricação'],
        ['subInst', 'Instalação (rateada)'],
        ['custo',   '= Custo total item'],
        ['precoFinal', 'Preço final item (c/ DRE)'],
      ];
      linhasTot.forEach(([k, label]) => {
        const vals = cols.map(c => { const pi = (c.vp.porItem || [])[idx]; return pi ? pi[k] : null; });
        if (vals.every(v => !v)) return;
        body += `<tr class="cmpv-linha-total"><td>${esc(label)}</td>`;
        vals.forEach(v => { body += `<td>${v == null ? '—' : 'R$ ' + fmt(v)}</td>`; });
        if (mostrarDelta) body += `<td>${celDelta(vals[0], vals[1])}</td>`;
        body += '</tr>';
      });

      // Pesos do rateio (horas / m² / kg) — pra entender POR QUE rateou assim
      const pesos = [['horas', 'Horas', 'h'], ['m2', 'm² (rateio chapas)', 'm²'], ['kgLiq', 'Kg líq (rateio perfis)', 'kg']];
      pesos.forEach(([k, label, un]) => {
        const vals = cols.map(c => { const pi = (c.vp.porItem || [])[idx]; return pi && pi._detalhe ? pi._detalhe[k] : null; });
        if (vals.every(v => !v)) return;
        body += `<tr><td style="color:#64748b">${esc(label)}</td>`;
        vals.forEach(v => { body += `<td style="color:#64748b">${v == null ? '—' : fmtInt(v) + ' ' + un}</td>`; });
        if (mostrarDelta) body += '<td></td>';
        body += '</tr>';
      });
    }

    // Totais gerais da versao
    body += `<tr class="cmpv-item-head"><td colspan="${cols.length + (mostrarDelta ? 2 : 1)}">Totais da versão</td></tr>`;
    const gerais = [
      [c => Number(c.versao.subFab) || 0,  'Custo Fabricação (subFab)'],
      [c => Number(c.versao.subInst) || 0, 'Custo Instalação (subInst)'],
      [c => c.vp.totalGeral || 0,          'Preço proposta (soma itens)'],
      [c => Number(c.versao.valorAprovado) || 0, 'Valor aprovado'],
    ];
    gerais.forEach(([getter, label]) => {
      const vals = cols.map(getter);
      if (vals.every(v => !v)) return;
      body += `<tr class="cmpv-geral"><td>${esc(label)}</td>`;
      vals.forEach(v => { body += `<td>R$ ${fmt(v)}</td>`; });
      if (mostrarDelta) body += `<td>${celDelta(vals[0], vals[1])}</td>`;
      body += '</tr>';
    });

    // Chapas usadas por versao
    let chapasHtml = '';
    cols.forEach(c => {
      const cs = c.versao.chapasSelecionadas || {};
      const tipos = Object.keys(cs);
      if (!tipos.length) return;
      let l = `<div><b>V${esc(c.versao.numero)}:</b> `;
      l += tipos.map(t => {
        const info = cs[t] || {};
        const preco = Number(info.preco) || 0;
        let qtd = 0;
        try { qtd = ((info.opcoes || [])[0] || {}).chapas.length || 0; } catch (_) {}
        return `${esc(t)} — ${qtd} chapa(s) × R$ ${fmt(preco)} = <b>R$ ${fmt(qtd * preco)}</b>`;
      }).join(' &nbsp;|&nbsp; ');
      l += '</div>';
      chapasHtml += l;
    });

    // "O que mudou" — so' com exatamente 2 versoes (diff par a par)
    let mudouHtml = '';
    if (mostrarDelta) {
      const difs = diffItens(base.versao, cols[1].versao);
      if (difs.length) {
        mudouHtml = difs.map(d =>
          `<div>Item ${d.item + 1} · <code>${esc(d.campo)}</code>: ` +
          `<span class="cmpv-de">${esc(d.de)}</span> → ` +
          `<span class="cmpv-para">${esc(d.para)}</span></div>`
        ).join('');
      } else {
        mudouHtml = '<div>Nenhuma diferença nos campos dos itens — a variação de custo vem de preços/cadastros/horas ou do rateio.</div>';
      }
    }

    alvo.innerHTML = `
      <div class="cmpv-tabela-wrap">
        <table class="cmpv-tabela">
          <thead>${head}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      ${chapasHtml ? `<div class="cmpv-secao-tit">Chapas usadas (aproveitamento)</div><div class="cmpv-chapas">${chapasHtml}</div>` : ''}
      ${mudouHtml ? `<div class="cmpv-secao-tit">O que mudou nos itens</div><div class="cmpv-mudou">${mudouHtml}</div>` : ''}
      <div class="cmpv-aviso" style="margin-top:12px">
        Rateio atual: perfis/pintura por kg líquido · chapas por m² do item · mão de obra por horas ·
        instalação proporcional ao custo fab (munk 100% na porta maior). Chapas por m² não distinguem
        material — se um item usa chapa mais cara (ex: inox), o custo é diluído entre todos os itens pelo m².
      </div>`;
  }

  // ------------------------------------------------------------------
  // Abrir modal
  // ------------------------------------------------------------------
  function abrir(versaoIdOpcional) {
    injetarCss();
    if (!window.Orcamento) { alert('Módulo Orçamento não carregado.'); return; }

    // Resolve negocio: pela versao passada, ou pela versao ativa do wizard
    let ref = null;
    try {
      if (versaoIdOpcional) ref = window.Orcamento.obterVersao(versaoIdOpcional);
      if (!ref) {
        const va = window.Orcamento._getVersaoAtivaWizard && window.Orcamento._getVersaoAtivaWizard();
        if (va) ref = window.Orcamento.obterVersao(va.id);
      }
    } catch (e) { console.warn('[cmpv] abrir:', e); }
    if (!ref || !ref.negocio) { alert('Abra um orçamento primeiro pra comparar versões.'); return; }

    negocioAtual = ref.negocio;
    const versoes = listarVersoesDoNegocio(negocioAtual);
    if (versoes.length < 2) { alert('Este negócio só tem 1 versão — nada pra comparar ainda.'); return; }

    // Default: as 2 ultimas versoes da opcao da versao ativa
    const letraAtiva = ref.opcao ? (ref.opcao.letra || 'A') : 'A';
    const daOpcao = versoes.filter(v => v.letra === letraAtiva);
    const pool = daOpcao.length >= 2 ? daOpcao : versoes;
    selecionadas = pool.slice(-2).map(v => v.id);

    fechar(); // garante 1 modal so'
    negocioAtual = ref.negocio; // fechar() zera; restaura

    overlayEl = document.createElement('div');
    overlayEl.className = 'cmpv-overlay';
    overlayEl.innerHTML = `
      <div class="cmpv-modal" role="dialog" aria-label="Comparar versões">
        <div class="cmpv-head">
          <div>
            <div class="cmpv-titulo">Comparar versões — ${esc(negocioAtual.clienteNome || '')}</div>
            <div class="cmpv-sub">Marque as versões e veja custo por item, decomposição do rateio e o que mudou.</div>
          </div>
          <button type="button" class="cmpv-fechar" aria-label="Fechar">✕</button>
        </div>
        <div class="cmpv-body">
          <div class="cmpv-sel">
            ${versoes.map(v => `
              <label class="cmpv-sel-chip ${selecionadas.includes(v.id) ? 'is-on' : ''}" data-vid="${esc(v.id)}">
                <input type="checkbox" ${selecionadas.includes(v.id) ? 'checked' : ''}>
                Opção ${esc(v.letra)} · V${esc(v.numero)} · ${esc(v.status)}
                ${v.criadoEm ? `<span style="color:#94a3b8">(${esc(fmtDataCurta(v.criadoEm))})</span>` : ''}
              </label>`).join('')}
          </div>
          <div class="cmpv-resultado"></div>
        </div>
      </div>`;
    document.body.appendChild(overlayEl);
    document.addEventListener('keydown', onEsc);

    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) { fechar(); return; }
      if (e.target.closest('.cmpv-fechar')) { fechar(); return; }
    });
    overlayEl.addEventListener('change', (e) => {
      const chip = e.target.closest('.cmpv-sel-chip');
      if (!chip) return;
      const vid = chip.getAttribute('data-vid');
      const on = chip.querySelector('input').checked;
      chip.classList.toggle('is-on', on);
      if (on) { if (!selecionadas.includes(vid)) selecionadas.push(vid); }
      else { selecionadas = selecionadas.filter(x => x !== vid); }
      renderComparacao();
    });

    renderComparacao();
  }

  // ------------------------------------------------------------------
  // Injecao do botao no banner do orcamento (.orc-banner).
  // MutationObserver: zero edicao no HTML do 12-orcamento.js.
  // ------------------------------------------------------------------
  function injetarBotoes(root) {
    const banners = (root || document).querySelectorAll
      ? (root || document).querySelectorAll('.orc-banner:not(.cmpv-com-botao)')
      : [];
    banners.forEach(b => {
      b.classList.add('cmpv-com-botao');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cmpv-btn-abrir';
      btn.textContent = '⇆ Comparar versões';
      btn.addEventListener('click', (e) => { e.stopPropagation(); abrir(); });
      b.appendChild(btn);
    });
  }
  function iniciarObserver() {
    injetarCss();
    injetarBotoes(document);
    const mo = new MutationObserver(() => injetarBotoes(document));
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarObserver);
  } else {
    iniciarObserver();
  }

  return { abrir };
})();

window.CompararVersoes = CompararVersoes;
