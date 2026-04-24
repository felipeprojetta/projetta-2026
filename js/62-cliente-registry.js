/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.cliente — Fachada do bloco CLIENTE
 * ─────────────────────────────────────────────────────────────────────
 * Une campos (60) + persistência (61) em operações de alto nível que
 * a UI chama diretamente.
 *
 * API:
 *   await PROJETTA.cliente.salvarDoForm(cardId)     → Promise<dados>
 *   await PROJETTA.cliente.carregarNoForm(cardId)   → Promise<{dados, n}>
 *   await PROJETTA.cliente.atualizarPartial(cardId, dadosParciais)
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.cliente = window.PROJETTA.cliente || {};

(function(ns){
  'use strict';

  ns.version = '1.0';

  /**
   * Captura form → valida → salva no banco.
   * Lança Error se validação falhar ou HTTP falhar.
   */
  ns.salvarDoForm = async function(cardId){
    if(!cardId) throw new Error('[cliente] cardId obrigatório');
    if(!ns.campos)       throw new Error('[cliente] submódulo campos indisponível');
    if(!ns.persistencia) throw new Error('[cliente] submódulo persistencia indisponível');

    var dados = ns.campos.capturarForm();
    var erros = ns.campos.validar(dados);
    if(erros.length){
      throw new Error('[cliente] validação falhou:\n  • ' + erros.join('\n  • '));
    }
    await ns.persistencia.atualizar(cardId, dados);
    return dados;
  };

  /**
   * Lê do banco → popula o form.
   */
  ns.carregarNoForm = async function(cardId){
    if(!cardId) throw new Error('[cliente] cardId obrigatório');
    if(!ns.campos || !ns.persistencia) throw new Error('[cliente] submódulos indisponíveis');

    var dados = await ns.persistencia.ler(cardId);
    if(!dados) throw new Error('[cliente] card não encontrado: ' + cardId);
    var n = ns.campos.restaurarForm(dados);
    return { dados: dados, camposRestaurados: n };
  };

  /**
   * Atualiza só os campos passados (parcial, sem validar obrigatórios).
   * Útil pra autosave de 1 campo só (ex: onBlur de input).
   */
  ns.atualizarPartial = async function(cardId, dadosParciais){
    if(!cardId) throw new Error('[cliente] cardId obrigatório');
    if(!dadosParciais) throw new Error('[cliente] dadosParciais obrigatórios');
    await ns.persistencia.atualizar(cardId, dadosParciais);
    return dadosParciais;
  };

  setTimeout(function(){
    var s = 'campos:' + (ns.campos ? '✓' : '✗') +
            ' persistencia:' + (ns.persistencia ? '✓' : '✗');
    console.log('%c[PROJETTA.cliente] v' + ns.version + ' registry — ' + s,
                'color:#0C447C;font-weight:500;background:#E6F1FB;padding:2px 6px;border-radius:3px');
  }, 150);
})(window.PROJETTA.cliente);
