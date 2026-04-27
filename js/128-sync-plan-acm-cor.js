(() => {
  if (window.__MOD_128_LOADED) return;
  window.__MOD_128_LOADED = true;

  function syncPlanAcm() {
    try {
      var corEl = document.getElementById('carac-cor-ext');
      var planAcm = document.getElementById('plan-acm-cor');
      if (!corEl || !planAcm) return;
      if (!planAcm.options || planAcm.options.length < 2) return;

      var corVal = (corEl.value || '').toUpperCase().trim();
      if (!corVal) return;

      // Pega o codigo PRO da cor selecionada (ex: "PRO37373")
      var corCode = (corVal.match(/PRO\w+/) || [''])[0];

      // Texto da opcao atualmente selecionada do planificador
      var planIdx = planAcm.selectedIndex;
      var planTxt = (planIdx >= 0 && planAcm.options[planIdx])
                    ? (planAcm.options[planIdx].text || '').toUpperCase()
                    : '';

      // Se ja bate (substring exata ou codigo PRO), nao mexe
      if (corVal && planTxt.indexOf(corVal) >= 0) return;
      if (corCode && planTxt.indexOf(corCode) >= 0) return;

      // Procura match: 1) substring exata 2) codigo PRO
      var bestIdx = -1;
      for (var i = 1; i < planAcm.options.length; i++) {
        var optTxt = (planAcm.options[i].text || '').toUpperCase();
        if (corVal && optTxt.indexOf(corVal) >= 0) {
          bestIdx = i;
          break;
        }
      }
      if (bestIdx < 0 && corCode) {
        for (var j = 1; j < planAcm.options.length; j++) {
          var optTxt2 = (planAcm.options[j].text || '').toUpperCase();
          if (optTxt2.indexOf(corCode) >= 0) {
            bestIdx = j;
            break;
          }
        }
      }

      if (bestIdx >= 0 && bestIdx !== planIdx) {
        planAcm.selectedIndex = bestIdx;
        planAcm.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[mod 128] plan-acm-cor sincronizado com carac-cor-ext:', planAcm.options[bestIdx].text);
      }
    } catch(e) { console.warn('[mod 128] erro:', e); }
  }

  // Hook em change do carac-cor-ext
  document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'carac-cor-ext') {
      setTimeout(syncPlanAcm, 100);
      setTimeout(syncPlanAcm, 500);
    }
  }, true);

  // Periodico a cada 2s — pega timing de reabertura
  setInterval(syncPlanAcm, 2000);

  // Inicial em multiplos timings
  setTimeout(syncPlanAcm, 500);
  setTimeout(syncPlanAcm, 1500);
  setTimeout(syncPlanAcm, 3000);

  console.log('[mod 128] Sync plan-acm-cor (planificador) com carac-cor-ext (porta) carregado');
})();
