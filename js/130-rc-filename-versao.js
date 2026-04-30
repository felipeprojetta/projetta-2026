(() => {
  if (window.__MOD_130_LOADED) return;
  window.__MOD_130_LOADED = true;

  // Hook em <a download> antes do click — corrige nome do RC pra ficar igual MC/MR:
  //   "AGP - RESERVA - Rubiela_E_Alessandro - RC.png"
  // vira
  //   "AGP - RESERVA - Rubiela E Alessandro - V<N> - RC.png"
  document.addEventListener('click', function(e) {
    try {
      var a = e.target && e.target.closest && e.target.closest('a');
      if (!a) return;
      if (!a.download) return;
      var nome = a.download;
      // So mexe se for "...- RC.png" (Painel Representante)
      if (!/\s-\sRC\.png$/i.test(nome)) return;

      var ver = window._mod129VersaoAlvo;
      if (!ver) {
        console.warn('[mod 130] _mod129VersaoAlvo nao setado — nao vai injetar V<N> no RC');
      }

      // Estrutura: "AGP - RESERVA - CLIENTE_COM_UNDERSCORE - RC.png"
      // Quero:     "AGP - RESERVA - CLIENTE COM ESPACO - V<N> - RC.png"
      var semExt = nome.replace(/\s-\sRC\.png$/i, '');
      var partes = semExt.split(' - ');
      if (partes.length < 2) return;

      // Substituir underscores na ultima parte (cliente) por espacos
      partes[partes.length - 1] = partes[partes.length - 1].replace(/_/g, ' ');

      var novoNome;
      if (ver) {
        novoNome = partes.join(' - ') + ' - V' + ver + ' - RC.png';
      } else {
        novoNome = partes.join(' - ') + ' - RC.png';
      }

      if (novoNome !== nome) {
        a.download = novoNome;
        console.log('[mod 130] RC renomeado:');
        console.log('  antes: "' + nome + '"');
        console.log('  depois: "' + novoNome + '"');
      }
    } catch(err) {
      console.warn('[mod 130] erro:', err);
    }
  }, true);

  console.log('[mod 130] Hook RC filename carregado — injeta V<N> e troca _ por espaco');
})();
