/* 99-boot.js — entry point. Roda quando DOM carrega.
   Felipe (sessao 31): TUDO sincronizado via Supabase.
   Ordem: syncFromCloud -> migracoes -> App.init -> syncToCloud.
   O sync BLOQUEIA o boot pra garantir dados atualizados. */

document.addEventListener('DOMContentLoaded', async () => {

  // Felipe sessao 12: helpers do overlay de boot (definido inline no HTML)
  function bootShowError(msg) {
    var sub = document.getElementById('boot-loading-sub');
    var retry = document.getElementById('boot-loading-retry');
    var err = document.getElementById('boot-loading-err');
    if (sub) sub.style.display = 'none';
    if (retry) retry.style.display = 'block';
    if (err) err.textContent = msg;
  }
  function bootHide() {
    var ov = document.getElementById('boot-loading');
    if (ov && ov.parentNode) {
      ov.style.transition = 'opacity 200ms';
      ov.style.opacity = '0';
      setTimeout(function(){ if (ov.parentNode) ov.parentNode.removeChild(ov); }, 220);
    }
  }
  function bootSetMsg(m) {
    var el = document.getElementById('boot-loading-msg');
    if (el) el.textContent = m;
  }

  // 1. SYNC DO CLOUD (ANTES de tudo) - BLOQUEANTE com retry.
  // Felipe sessao 12: se falhar, NAO deixa o usuario trabalhar - mostra
  // botao "tentar novamente" no overlay. Antes seguia em modo offline
  // silencioso e o user achava que estava tudo OK, mas ao salvar sobre-
  // -escrevia dados de outros (last-write-wins com cache stale).
  // Felipe sessao 32: ATALHO DE EMERGENCIA. URL com ?offline=1 pula o
  // syncFromCloud bloqueante e entra direto em modo offline. Usar quando:
  //   - Boot travado em 'Carregando banco de dados...'
  //   - Rede pessimo e nao quer esperar 7 tentativas (~3.5min)
  //   - Quer trabalhar com cache local AGORA
  // URL: https://projetta-2026.netlify.app/?offline=1
  var _ehOfflineFlag = false;
  try {
    _ehOfflineFlag = new URLSearchParams(location.search).get('offline') === '1';
  } catch(_) {}

  if (_ehOfflineFlag) {
    console.warn('[Boot] ⚠️ ATALHO ?offline=1 detectado. Pulando syncFromCloud e entrando em MODO OFFLINE.');
    bootSetMsg('Entrando em modo offline...');
    if (Database && Database.forceLiberarEscrita) {
      try { Database.forceLiberarEscrita(); } catch(_) {}
    }
    // Tenta sync em background sem bloquear (best-effort)
    if (Database && Database.syncFromCloud) {
      setTimeout(function() {
        Database.syncFromCloud().catch(function(e) {
          console.warn('[Boot] sync background falhou (esperado em modo offline):', e.message);
        });
      }, 500);
    }
  } else if (Database && Database.syncFromCloud) {
    let tentativa = 0;
    let ok = false;
    // Felipe sessao 32: retries silenciosos com backoff antes de incomodar
    // o user. Sintoma anterior: "Erro ao conectar" aparecia VARIAS VEZES
    // antes do sistema entrar. Agora as 6 primeiras falhas ficam visiveis
    // como progresso ("Sincronizando... (N/6)"), sem popup vermelho.
    // Backoff curto pra acelerar recovery em redes lentas.
    const MAX_SILENT_RETRIES = 6;
    const RETRY_DELAYS_MS = [200, 500, 1000, 1500, 2000, 3000];
    while (!ok) {
      tentativa++;
      // Mensagem amigavel - mostra progresso explicito a partir da 2a tentativa
      if (tentativa === 1) {
        bootSetMsg('Carregando banco de dados...');
      } else if (tentativa <= MAX_SILENT_RETRIES) {
        bootSetMsg('Sincronizando... (tentativa ' + tentativa + '/' + (MAX_SILENT_RETRIES + 1) + ')');
      } else {
        bootSetMsg('Tentativa ' + tentativa + '...');
      }
      try {
        await Database.syncFromCloud();
        // syncFromCloud so' libera _readOnlyMode se sucesso.
        // Se nao liberou, considera falha (servidor offline / sem rows).
        if (Database.isReadOnly && Database.isReadOnly()) {
          // Felipe sessao 32: usa o erro REAL do syncStatus pra dar contexto
          // ao usuario. Antes mostrava generico 'offline ou banco vazio' que
          // mascarava bug HTTP (filtro malformado, RLS bloqueando, etc).
          var statusReal = (Database.getSyncStatus && Database.getSyncStatus()) || {};
          var msgReal = statusReal.error
            ? 'Falha: ' + statusReal.error
            : 'Servidor nao retornou dados (offline ou banco vazio)';
          throw new Error(msgReal);
        }
        ok = true;
      } catch (e) {
        console.warn('[Boot] syncFromCloud tentativa ' + tentativa + ' falhou:', e.message);
        // Felipe sessao 32: nas primeiras N tentativas, retry AUTOMATICO
        // sem mostrar erro vermelho. Backoff exponencial pra dar tempo
        // pra rede estabilizar.
        if (tentativa <= MAX_SILENT_RETRIES) {
          const delayIdx = Math.min(tentativa - 1, RETRY_DELAYS_MS.length - 1);
          await new Promise(function(resolve) { setTimeout(resolve, RETRY_DELAYS_MS[delayIdx]); });
          continue;
        }
        // So' apos esgotar retries silenciosos, mostra popup pro user
        bootShowError(e.message || 'Falha desconhecida');
        // Espera o usuario clicar em "tentar novamente" OU "continuar offline"
        // Felipe sessao 32: novo botao "continuar offline" pra desbloquear
        // o user quando Supabase esta lento/offline. Libera modo escrita
        // com cache local (Supabase volta a sync assim que conectar).
        var resolveAcao = await new Promise(function(resolve) {
          var btnRetry   = document.getElementById('boot-retry-btn');
          var btnOffline = document.getElementById('boot-offline-btn');
          if (!btnRetry && !btnOffline) return resolve('retry');
          if (btnRetry) {
            btnRetry.onclick = function() {
              // Reseta UI pra estado de loading
              var sub = document.getElementById('boot-loading-sub');
              var retry = document.getElementById('boot-loading-retry');
              if (sub) sub.style.display = 'block';
              if (retry) retry.style.display = 'none';
              resolve('retry');
            };
          }
          if (btnOffline) {
            btnOffline.onclick = function() {
              resolve('offline');
            };
          }
        });
        if (resolveAcao === 'offline') {
          // Sai do loop em modo offline. Libera escrita local (Supabase
          // continua tentando em background via realtime polling).
          console.warn('[Boot] Usuario escolheu CONTINUAR OFFLINE. Sistema em modo local.');
          if (Database && Database.forceLiberarEscrita) {
            try { Database.forceLiberarEscrita(); } catch(_) {}
          }
          ok = true; // sai do while
        }
      }
    }
  }

  // 1b. Felipe sessao 2026-08-02 V2: apos syncFromCloud, forca
  // re-validacao da sessao do usuario logado. SyncFromCloud pode ter
  // sobrescrito a chave 'projetta:auth:session' com versao desatualizada
  // do Supabase. Aqui chamamos isAdmin() que internamente consulta a
  // lista de users e auto-corrige o role.
  try {
    if (typeof Auth !== 'undefined' && Auth.isAdmin) {
      const ehAdm = Auth.isAdmin();
      console.log('[Boot] Sessao validada. isAdmin:', ehAdm);
    }
  } catch(_) {}

  // 2. Migracoes
  try {
    Migracoes.rodarTodas();
  } catch (e) {
    console.error('[Boot] Erro nas migracoes:', e);
  }

  // 3. App.init
  // Felipe sessao 31: 'sempre que iniciar sistema quero tela de
  // orcamento limpa, nao precisa trazer o ultimo que estava carregado'.
  // A chave 'orcamento_lead_ativo' persiste no localStorage entre
  // sessoes — quando Felipe abria o sistema, o orcamento abria com
  // o ultimo lead que tinha sido aberto (Fernando, etc). Limpa aqui
  // antes do App.init pra garantir que orcamento entra em modo dev
  // (limpo) ao boot. Se Felipe vai abrir um lead, ele faz isso pelo
  // botao 'Montar Orcamento' do CRM (que seta a flag de novo).
  try {
    if (typeof Storage !== 'undefined' && Storage.scope) {
      Storage.scope('app').remove('orcamento_lead_ativo');
    }
  } catch(_) {}
  App.init();

  // Felipe sessao 12: app inicializado, sync OK -> tira overlay de boot
  bootHide();

  // 4. Seed de cadastros
  try {
    if (window.Acessorios && typeof window.Acessorios.listar === 'function') window.Acessorios.listar();
    if (window.Superficies && typeof window.Superficies.listar === 'function') window.Superficies.listar();
    if (window.Perfis && typeof window.Perfis.listar === 'function') window.Perfis.listar();
    if (window.Modelos && typeof window.Modelos.listar === 'function') window.Modelos.listar();
  } catch (e) {
    console.error('[Boot] Erro forcando seed:', e);
  }

  // 5. Exposicao global
  window.Projetta = { App, Auth, Storage, Database, Events };
  window.App = App;

  // syncToCloud REMOVIDO — causava perda de dados.

  // 6b. REALTIME: polling a cada 10s pra sync entre usuarios
  if (Database && Database.startRealtime) {
    Database.startRealtime();
  }

  // 7. TAB navigation fix
  document.querySelectorAll('.nav-item, #logout-btn').forEach(function(el) {
    if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1');
  });

  // 8. Combobox universal + empty-mark + titlecase
  if (window.Universal && typeof window.Universal.autoAttachCombobox === 'function') {
    window.Universal.autoAttachCombobox();
    if (typeof window.Universal.autoAttachTitleCase === 'function') window.Universal.autoAttachTitleCase();
    if (typeof window.Universal.autoAttachEmptyMark === 'function') window.Universal.autoAttachEmptyMark();
    if (typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function(mutations) {
        for (var mi = 0; mi < mutations.length; mi++) {
          var m = mutations[mi];
          if (m.type === 'attributes' && m.target && m.attributeName === 'value') {
            if (window.Universal.updateEmptyMark) window.Universal.updateEmptyMark(m.target);
          }
          for (var ni = 0; ni < (m.addedNodes || []).length; ni++) {
            var node = m.addedNodes[ni];
            if (node.nodeType !== 1) continue;
            if (node.matches && node.matches('input[list]')) window.Universal.attachCombobox(node);
            if (node.querySelectorAll) node.querySelectorAll('input[list]').forEach(function(inp) { window.Universal.attachCombobox(inp); });
            if (window.Universal.attachTitleCase) {
              if (node.matches && node.matches('input[data-titlecase], textarea[data-titlecase]')) window.Universal.attachTitleCase(node);
              if (node.querySelectorAll) node.querySelectorAll('input[data-titlecase], textarea[data-titlecase]').forEach(function(inp) { window.Universal.attachTitleCase(inp); });
            }
            if (window.Universal.attachEmptyMark) {
              if (node.matches && node.matches('input, select, textarea')) window.Universal.attachEmptyMark(node);
              if (node.querySelectorAll) node.querySelectorAll('input, select, textarea').forEach(function(el) { window.Universal.attachEmptyMark(el); });
            }
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
  }

  // Carregar modulos extras dinamicamente
  // Felipe sessao 2026-05: agente automatico REMOVIDO. Leads criados manualmente.
  ['scripts/44-email-crm.js', 'scripts/35-outlook.js', 'scripts/46-cadastros-autosync.js', 'scripts/50-estoque-omie.js'].forEach(function(src) {
    var s = document.createElement('script');
    s.src = src + '?v=' + Date.now();
    document.body.appendChild(s);
  });

  // Inicializar sync automatico de cadastros (Supabase = source of truth)
  setTimeout(function() {
    if (window.CadastrosAutosync && typeof window.CadastrosAutosync.init === 'function') {
      window.CadastrosAutosync.init();
    }
  }, 800);

  // Registrar módulo Estoque Omie
  setTimeout(function() {
    if (!App.register) return;
    App.register('estoque', {
      render: function(container) {
        if (window.EstoqueOmie) {
          window.EstoqueOmie.render(container);
        } else {
          container.innerHTML = '<div class="info-banner">Modulo Estoque Omie carregando...</div>';
          setTimeout(function() {
            if (window.EstoqueOmie) window.EstoqueOmie.render(container);
          }, 1500);
        }
      }
    });
  }, 600);

  // Registrar módulo Email (Outlook readonly, SEM agente automatico)
  // Felipe sessao 2026-05: removido o agente. Leads manuais via CRM.
  setTimeout(function() {
    if (!App.register) return;
    App.register('email', {
      render: function(container) {
        container.innerHTML = '<div id="outlook-tab-content" style="padding:12px;"></div>';
        if (typeof outlookRenderTab === 'function') {
          outlookRenderTab();
        }
      }
    });
  }, 800);
});
