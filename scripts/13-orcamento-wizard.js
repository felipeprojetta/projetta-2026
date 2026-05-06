/* 13-orcamento-wizard.js — Felipe (do doc - msg wizard)
   Controla o fluxo sequencial obrigatorio das abas do modulo Orcamento.

   Ordem fixa:
     1. Caracteristicas do Item        ('item')
     2. Levantamento de Perfis         ('lev-perfis')
     3. Levantamento de Acessorios     ('lev-acessorios')
     4. Levantamento de Superficies    ('lev-superficies')
     5. Custo de Fabricacao e Inst.    ('fab-inst')
     6. DRE                             ('custo')
     7. Proposta Comercial             ('proposta')

   Estado por versao: `versao.wizardEtapaMaxima` = id da etapa MAIS
   AVANCADA ja desbloqueada (default 'item'). Tudo depois disso fica
   bloqueado (sub-nav-item.is-locked).

   Avancar:  apertou "Proximo" na aba atual → desbloqueia a proxima
   Voltar/refazer: alterou item ou itens → reseta wizard pra 'item'

   Funcoes expostas em window.OrcamentoWizard:
   - ETAPAS (array)
   - tabLiberada(tabId)
   - proximaTab(tabAtual)
   - avancar(tabAtual)
   - resetar()
   - alertarBloqueio(tabId)
   - getEtapaMaxima()
*/
(() => {
  'use strict';

  // Ordem oficial das etapas
  const ETAPAS = [
    { id: 'item',            label: 'Caracteristicas do Item' },
    { id: 'lev-perfis',      label: 'Levantamento de Perfis' },
    { id: 'lev-acessorios',  label: 'Levantamento de Acessorios' },
    { id: 'lev-superficies', label: 'Levantamento de Superficies' },
    { id: 'fab-inst',        label: 'Custo de Fabricacao e Instalacao' },
    { id: 'custo',           label: 'DRE' },
    { id: 'proposta',        label: 'Proposta Comercial' },
  ];

  function indiceEtapa(tabId) {
    return ETAPAS.findIndex(e => e.id === tabId);
  }

  function getVersaoAtiva() {
    if (!window.Orcamento || typeof window.Orcamento._getVersaoAtivaWizard !== 'function') return null;
    return window.Orcamento._getVersaoAtivaWizard();
  }

  function getEtapaMaxima() {
    const versao = getVersaoAtiva();
    if (!versao) return 'item';
    return versao.wizardEtapaMaxima || 'item';
  }

  function setEtapaMaxima(novaEtapa) {
    if (indiceEtapa(novaEtapa) < 0) return;
    if (!window.Orcamento || typeof window.Orcamento._setWizardEtapa !== 'function') return;
    window.Orcamento._setWizardEtapa(novaEtapa);
  }

  /**
   * Retorna true se a aba esta liberada (pode ser clicada).
   * Aba so' libera se o seu indice <= indice de wizardEtapaMaxima.
   * Abas fora do wizard (ex: 'relatorios') sempre liberadas.
   *
   * Felipe sessao 12: em MODO MEMORIAL (versao aprovada/fechada), TODAS
   * as abas ficam liberadas pra navegacao/consulta. Felipe pediu: 'preciso
   * navegar por tudo conferir tudo'. CSS .is-orc-readonly continua impedindo
   * edicao, mas navegacao livre.
   */
  function tabLiberada(tabId) {
    if (window.Orcamento && typeof window.Orcamento.versaoAtualEhImutavel === 'function') {
      try {
        if (window.Orcamento.versaoAtualEhImutavel()) return true;
      } catch(_) {}
    }
    const ix = indiceEtapa(tabId);
    if (ix < 0) return true; // aba fora do wizard
    const ixMax = indiceEtapa(getEtapaMaxima());
    return ix <= ixMax;
  }

  /** Retorna o id da proxima aba apos tabAtual (ou null se ultima). */
  function proximaTab(tabAtual) {
    const ix = indiceEtapa(tabAtual);
    if (ix < 0 || ix >= ETAPAS.length - 1) return null;
    return ETAPAS[ix + 1].id;
  }

  /** Retorna o label de uma aba pelo id. */
  function labelDaTab(tabId) {
    const e = ETAPAS.find(x => x.id === tabId);
    return e ? e.label : tabId;
  }

  /**
   * Avanca o wizard: marca a proxima etapa como liberada e navega ate' ela.
   * Felipe: validacao do conteudo da etapa atual fica a cargo do orcamento
   * (ele decide se pode avancar — ex: characteristicas precisam estar
   * completas pra liberar perfis).
   */
  function avancar(tabAtual) {
    const prox = proximaTab(tabAtual);
    if (!prox) return false;
    // Atualiza so' se a proxima etapa eh > etapa maxima atual.
    const ixMaxAtual = indiceEtapa(getEtapaMaxima());
    const ixProx = indiceEtapa(prox);
    if (ixProx > ixMaxAtual) {
      setEtapaMaxima(prox);
    }
    if (window.App && typeof window.App.navigateTo === 'function') {
      window.App.navigateTo('orcamento', prox);
    }
    return true;
  }

  /**
   * Reseta o wizard pra 'item' — chamado quando algo nas Caracteristicas
   * (ou itens) muda. Forca o usuario a refazer o fluxo (etapa por etapa)
   * pra garantir que todos os calculos foram revistos.
   */
  function resetar() {
    setEtapaMaxima('item');
    // Re-renderiza a sub-nav pra refletir os novos locks (todas as
    // abas posteriores a 'item' viram is-locked).
    if (window.App && typeof window.App.navigateTo === 'function' && window.App.state) {
      const tabAtual = window.App.state.currentTab || 'item';
      window.App.navigateTo('orcamento', tabAtual);
    }
  }

  /** Mostra alert quando o usuario clica numa aba bloqueada. */
  function alertarBloqueio(tabId) {
    const ixDestino = indiceEtapa(tabId);
    const ixMax = indiceEtapa(getEtapaMaxima());
    const proximaPendente = ETAPAS[ixMax + 1];
    if (!proximaPendente) {
      alert('Esta aba ainda nao foi liberada.');
      return;
    }
    alert(
      `Conclua a etapa "${ETAPAS[ixMax].label}" antes de avancar.\n` +
      `Apos confirmar, clique em "Proximo" pra ir pra "${proximaPendente.label}".`
    );
  }

  // Expoe globalmente
  window.OrcamentoWizard = {
    ETAPAS,
    indiceEtapa,
    tabLiberada,
    proximaTab,
    labelDaTab,
    avancar,
    resetar,
    alertarBloqueio,
    getEtapaMaxima,
  };

})();
