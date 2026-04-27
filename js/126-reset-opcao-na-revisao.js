(() => {
  if (window.__MOD_126_LOADED) return;
  window.__MOD_126_LOADED = true;

  // Quando usuario clica em REVISAO, limpa _currentOpcaoNome.
  // Assim quando ele salvar depois, mod 81 abre modal de escolha
  // (Sobrescrever / Nova Opcao) em vez de gravar direto por cima.
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('button,a,div[role="button"],span[role="button"]');
    if (!btn) return;
    var txt = (btn.textContent || btn.innerText || '').trim();
    // Match "Revisao", "Revisão", "✏ Revisão", "Revisar" etc
    if (/revis[aã]o|revisar|✏.*revis/i.test(txt) && txt.length < 30) {
      window._currentOpcaoNome = null;
      console.log('[mod 126] REVISAO detectado — _currentOpcaoNome=null. Modal de escolha aparecera no Save.');
    }
  }, true);

  console.log('[mod 126] Reset _currentOpcaoNome em Revisao carregado');
})();
