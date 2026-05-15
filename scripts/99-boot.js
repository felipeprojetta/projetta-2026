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
  if (Database && Database.syncFromCloud) {
    let tentativa = 0;
    let ok = false;
    while (!ok) {
      tentativa++;
      bootSetMsg(tentativa === 1 ? 'Carregando banco de dados...' : 'Tentativa ' + tentativa + '...');
      try {
        await Database.syncFromCloud();
        // syncFromCloud so' libera _readOnlyMode se sucesso.
        // Se nao liberou, considera falha (servidor offline / sem rows).
        if (Database.isReadOnly && Database.isReadOnly()) {
          throw new Error('Servidor nao retornou dados (offline ou banco vazio)');
        }
        ok = true;
      } catch (e) {
        console.warn('[Boot] syncFromCloud tentativa ' + tentativa + ' falhou:', e.message);
        bootShowError(e.message || 'Falha desconhecida');
        // Espera o usuario clicar em "tentar novamente"
        await new Promise(function(resolve) {
          var btn = document.getElementById('boot-retry-btn');
          if (!btn) return resolve(); // fallback se HTML faltar
          btn.onclick = function() {
            // Reseta UI pra estado de loading
            var sub = document.getElementById('boot-loading-sub');
            var retry = document.getElementById('boot-loading-retry');
            if (sub) sub.style.display = 'block';
            if (retry) retry.style.display = 'none';
            resolve();
          };
        });
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
