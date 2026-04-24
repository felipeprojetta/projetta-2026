/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.projeto — Fachada do bloco PROJETO
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.projeto = window.PROJETTA.projeto || {};

(function(ns){
  'use strict';

  ns.version = '1.0';

  ns.salvarDoForm = async function(cardId){
    if(!cardId) throw new Error('[projeto] cardId obrigatório');
    if(!ns.campos || !ns.persistencia) throw new Error('[projeto] submódulos indisponíveis');

    var dados = ns.campos.capturarForm();
    var erros = ns.campos.validar(dados);
    if(erros.length){
      throw new Error('[projeto] validação falhou:\n  • ' + erros.join('\n  • '));
    }
    await ns.persistencia.atualizar(cardId, dados);
    return dados;
  };

  ns.carregarNoForm = async function(cardId){
    if(!cardId) throw new Error('[projeto] cardId obrigatório');
    if(!ns.campos || !ns.persistencia) throw new Error('[projeto] submódulos indisponíveis');

    var dados = await ns.persistencia.ler(cardId);
    if(!dados) throw new Error('[projeto] card não encontrado: ' + cardId);
    var n = ns.campos.restaurarForm(dados);
    return { dados: dados, camposRestaurados: n };
  };

  ns.atualizarPartial = async function(cardId, dadosParciais){
    if(!cardId) throw new Error('[projeto] cardId obrigatório');
    if(!dadosParciais) throw new Error('[projeto] dadosParciais obrigatórios');
    await ns.persistencia.atualizar(cardId, dadosParciais);
    return dadosParciais;
  };

  setTimeout(function(){
    var s = 'campos:' + (ns.campos ? '✓' : '✗') +
            ' persistencia:' + (ns.persistencia ? '✓' : '✗');
    console.log('%c[PROJETTA.projeto] v' + ns.version + ' registry — ' + s,
                'color:#085041;font-weight:500;background:#E1F5EE;padding:2px 6px;border-radius:3px');
  }, 150);
})(window.PROJETTA.projeto);
