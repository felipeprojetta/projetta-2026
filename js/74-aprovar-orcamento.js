/**
 * ═══════════════════════════════════════════════════════════════════════
 * 74-aprovar-orcamento.js — Botão "🏆 Aprovar para Envio"
 * ─────────────────────────────────────────────────────────────────────
 *
 * FLUXO:
 *   1. Valida card vinculado (_crmOrcCardId)
 *   2. Confirma com usuário
 *   3. Calcula próxima versão do AGP (AGP0566 → AGP0566-1 → -2...)
 *   4. PATCH crm_oportunidades:
 *        stage='s3b' (Orçamento Pronto)
 *        valor_tabela, valor_faturamento, agp=AGP{n}-{v}
 *   5. PATCH pre_orcamentos (último): aprovado=true, versao_aprovada
 *   6. Dispara geração automática: printProposta, printMargens,
 *      printMemorialCalculo, printPainelRep
 *   7. Toast final
 *
 * Não remove botões antigos — Felipe decide depois quando confirmar
 * que está tudo OK.
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _hdrs(){
    return {
      apikey:         ANON_KEY,
      Authorization:  'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json'
    };
  }

  function _toast(html, cor, ms){
    var t = document.getElementById('projetta-save-toast');
    if(t) t.remove();
    t = document.createElement('div');
    t.id = 'projetta-save-toast';
    t.style.cssText =
      'position:fixed;top:80px;right:20px;background:' + cor + ';color:#fff;' +
      'padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;' +
      'z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);' +
      'max-width:480px;line-height:1.45;font-family:inherit';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 6000);
  }

  function _parseMoeda(txt){
    if(!txt) return null;
    var s = String(txt).replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function _txt(id){
    var el = document.getElementById(id);
    if(!el) return '';
    return (el.textContent || el.innerText || '').trim();
  }

  // "AGP004613"      → { base:"AGP004613", versao:1, proximo:"AGP004613-1" }
  // "AGP004613-1"    → { base:"AGP004613", versao:2, proximo:"AGP004613-2" }
  // "AGP004613-9"    → { base:"AGP004613", versao:10, proximo:"AGP004613-10" }
  // ""               → { base:null, versao:1, proximo:null }
  function _calcProximaVersao(agp){
    if(!agp || typeof agp !== 'string') return { base:null, versao:1, proximo:null };
    var m = agp.match(/^(.+?)-(\d+)$/);
    var base, versaoAtual;
    if(m){
      base = m[1];
      versaoAtual = parseInt(m[2], 10) || 0;
    } else {
      base = agp;
      versaoAtual = 0;
    }
    var proxima = versaoAtual + 1;
    return { base: base, versao: proxima, proximo: base + '-' + proxima };
  }

  async function _patchCard(cardId, dados){
    var r = await fetch(
      SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId),
      {
        method:  'PATCH',
        headers: Object.assign({}, _hdrs(), { Prefer: 'return=minimal' }),
        body:    JSON.stringify(dados)
      }
    );
    if(!r.ok){
      var txt = await r.text();
      throw new Error('PATCH card falhou: HTTP ' + r.status + ' — ' + txt);
    }
    return true;
  }

  async function _marcarPreOrcAprovado(cardId, versao){
    // Pega o pré-orçamento mais recente não-aprovado desse card
    var r1 = await fetch(
      SUPABASE_URL + '/rest/v1/pre_orcamentos' +
      '?card_id=eq.' + encodeURIComponent(cardId) +
      '&deleted_at=is.null&aprovado=eq.false' +
      '&order=created_at.desc&limit=1',
      { headers: _hdrs() }
    );
    if(!r1.ok) return null;
    var arr = await r1.json();
    if(!arr.length) return null;
    var po = arr[0];

    var r2 = await fetch(
      SUPABASE_URL + '/rest/v1/pre_orcamentos?id=eq.' + encodeURIComponent(po.id),
      {
        method:  'PATCH',
        headers: Object.assign({}, _hdrs(), { Prefer: 'return=minimal' }),
        body: JSON.stringify({
          aprovado: true,
          aprovado_em: new Date().toISOString(),
          versao_aprovada: versao
        })
      }
    );
    if(!r2.ok) console.warn('[aprovar] falha ao marcar pre-orc aprovado');
    return po.id;
  }

  async function _gerarArquivos(){
    // Dispara as 4 funções de impressão em sequência (se existirem)
    // Cada uma costuma abrir janela/download separado — delay pra não travar
    var fns = [
      { nome: 'Proposta Comercial (PDF)',       fn: window.printProposta },
      { nome: 'Painel de Margens (MC.png)',     fn: window.printMargens },
      { nome: 'Resumo da Obra (MR.png)',        fn: window.printMemorialCalculo },
      { nome: 'Painel Representante (RC.png)',  fn: window.printPainelRep }
    ];
    var gerados = [];
    for(var i = 0; i < fns.length; i++){
      var f = fns[i];
      if(typeof f.fn === 'function'){
        try {
          f.fn();
          gerados.push('✓ ' + f.nome);
          await new Promise(function(res){ setTimeout(res, 800); });
        } catch(e){
          console.warn('[aprovar] erro em ' + f.nome + ':', e);
          gerados.push('⚠ ' + f.nome + ' (erro)');
        }
      } else {
        gerados.push('— ' + f.nome + ' (função não disponível)');
      }
    }
    return gerados;
  }

  window.aprovarOrcamentoParaEnvio = async function(){
    var cardId = window._crmOrcCardId;
    if(!cardId){
      _toast(
        '⚠ <b>Sem card vinculado</b><br>' +
        '<span style="font-size:11px;font-weight:400">Abra esta aba via "Fazer Orçamento" a partir de um card no CRM</span>',
        '#c0392b', 5000
      );
      return;
    }

    // Ler AGP atual do campo
    var agpEl = document.getElementById('num-agp') || document.getElementById('agp');
    var agpAtual = agpEl ? (agpEl.value || '').trim() : '';
    if(!agpAtual){
      _toast(
        '⚠ <b>AGP não preenchido</b><br>' +
        '<span style="font-size:11px;font-weight:400">Preencha o número AGP antes de aprovar</span>',
        '#c0392b', 5000
      );
      return;
    }

    // Calcular próxima versão
    var v = _calcProximaVersao(agpAtual);
    var novoAgp = v.proximo;

    // Valores calculados (parse dos campos do painel direito)
    var valTabela = _parseMoeda(_txt('r-total-tabela'));
    var valFat    = _parseMoeda(_txt('r-total-fat'));

    // Confirm
    var ok = confirm(
      '🏆 APROVAR ORÇAMENTO PARA ENVIO?\n\n' +
      'AGP atual:        ' + agpAtual + '\n' +
      'Novo AGP:         ' + novoAgp + '  (versão ' + v.versao + ')\n' +
      'Valor tabela:     R$ ' + (valTabela ? valTabela.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '(não calculado)') + '\n' +
      'Valor faturamento: R$ ' + (valFat ? valFat.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '(não calculado)') + '\n\n' +
      'Ao confirmar:\n' +
      '  • Card será movido pra "📧 Orçamento Pronto"\n' +
      '  • Valores serão gravados como ORIGINAL\n' +
      '  • AGP mudará pra ' + novoAgp + '\n' +
      '  • PDF (proposta) + 3 PNGs (MC/MR/RC) serão gerados\n\n' +
      'Prosseguir?'
    );
    if(!ok) return;

    _toast('⏳ <b>Aprovando orçamento...</b><br><span style="font-size:11px;font-weight:400">Atualizando card no banco</span>', '#7f8c8d', 4000);

    try {
      // 1) PATCH card
      var dadosCard = {
        stage:              's3b',   // Orçamento Pronto
        agp:                novoAgp,
        updated_at:         new Date().toISOString()
      };
      if(valTabela != null) dadosCard.valor_tabela      = valTabela;
      if(valFat    != null) dadosCard.valor_faturamento = valFat;
      if(valFat    != null) dadosCard.valor             = valFat; // valor principal = faturamento

      await _patchCard(cardId, dadosCard);

      // 2) Marcar pre_orcamento como aprovado
      var preorcId = await _marcarPreOrcAprovado(cardId, v.versao);

      // 3) Atualizar campo AGP no form
      if(agpEl) agpEl.value = novoAgp;

      // 4) Gerar os arquivos
      _toast('📄 <b>Gerando arquivos...</b><br><span style="font-size:11px;font-weight:400">PDF + 3 PNGs em sequência</span>', '#0C447C', 4000);
      var gerados = await _gerarArquivos();

      // 5) Toast final
      _toast(
        '🏆 <b>Orçamento APROVADO para envio!</b><br>' +
        '<span style="font-size:12px;font-weight:600">AGP ' + novoAgp + ' · ' + (valFat ? 'R$ ' + valFat.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '') + '</span><br>' +
        '<span style="font-size:10px;font-weight:400;opacity:.9;display:block;margin-top:6px;line-height:1.5">' +
        '✓ Card movido pra Orçamento Pronto<br>' +
        '✓ Valores gravados no card<br>' +
        (preorcId ? '✓ Pré-orçamento marcado como aprovado (versão ' + v.versao + ')<br>' : '') +
        gerados.join('<br>') +
        '</span>',
        '#27ae60', 10000
      );
      console.log('%c[aprovar] ✓ orçamento aprovado:', 'color:#27ae60;font-weight:700', { cardId: cardId, novoAgp: novoAgp, versao: v.versao });

    } catch(err){
      _toast('❌ <b>Erro ao aprovar</b><br><span style="font-size:11px;font-weight:400">' + (err.message || err) + '</span>', '#c0392b', 8000);
      console.error('[aprovar] erro:', err);
    }
  };

  console.log('%c[74-aprovar-orcamento] v1.0 pronto — window.aprovarOrcamentoParaEnvio()',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
