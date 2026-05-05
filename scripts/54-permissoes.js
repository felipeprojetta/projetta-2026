/* 54-permissoes.js — Cadastros > Permissões
   ====================================================================
   Felipe sessao 2026-08-02: 'permissoes vazio? aonde vou controlar
   quem pode acessar cada coisa, eu preciso ter controle caso precise
   dar acesso pra alterar preco acessorios por exemplo'.

   Como funciona:
   - Felipe (admin) vê uma matriz: Usuários × Permissões.
   - Pra cada usuário marca quais permissões EXTRAS ele ganha além do
     padrão do role dele.
   - Storage: scope='cadastros', key='permissoes_overrides',
     value: { 'thays.projetta': ['cadastros:acessorios:editar', 'cadastros:regras:editar'] }
   - Auth.can(acao) consulta primeiro o override; se nao achar, usa role.

   Granularidade:
     Por padrao Auth.can('cadastros:editar') é tudo-ou-nada.
     Permissoes adiciona granularidade fina:
       cadastros:acessorios:editar
       cadastros:perfis:editar
       cadastros:superficies:editar
       cadastros:modelos:editar
       cadastros:regras:editar
       cadastros:representantes:editar
       cadastros:mensagens:editar
       config:editar

   Felipe (admin fixo) tem TUDO sempre - ignorado nas overrides.
   ==================================================================== */

(function() {
  'use strict';

  if (typeof window === 'undefined' || !window.Auth || !window.Storage) {
    console.warn('[Permissoes] Auth ou Storage nao disponiveis');
    return;
  }

  // Lista de permissoes granulares disponiveis
  var PERMISSOES_DISPONIVEIS = [
    { id: 'cadastros:acessorios:editar',     label: 'Editar Acessórios',     descricao: 'Adicionar, alterar preços, deletar acessórios' },
    { id: 'cadastros:perfis:editar',         label: 'Editar Perfis',         descricao: 'Adicionar, alterar perfis de alumínio' },
    { id: 'cadastros:superficies:editar',    label: 'Editar Superfícies',    descricao: 'Cores, ACM, HPL, vidros, alumínio maciço' },
    { id: 'cadastros:modelos:editar',        label: 'Editar Modelos',        descricao: 'Modelos de portas (01, 02, etc)' },
    { id: 'cadastros:regras:editar',         label: 'Editar Regras e Lógicas', descricao: 'Fita+Silicone, multiplicadores, cálculos' },
    { id: 'cadastros:representantes:editar', label: 'Editar Representantes', descricao: 'Empresas, contatos, comissões' },
    { id: 'cadastros:mensagens:editar',      label: 'Editar Mensagens',      descricao: 'Templates de email e WhatsApp' },
    { id: 'cadastros:filtros:editar',        label: 'Editar Filtros',        descricao: 'Filtros do orçamento' },
    { id: 'config:editar',                   label: 'Editar Configurações',  descricao: 'Configurações do sistema' },
  ];

  var Permissoes = (function() {
    function store() { return window.Storage.scope('cadastros'); }

    // Pega overrides salvas: { 'thays.projetta': ['cadastros:acessorios:editar', ...] }
    function getOverrides() {
      return store().get('permissoes_overrides') || {};
    }

    function salvarOverrides(overrides) {
      store().set('permissoes_overrides', overrides);
    }

    // Verifica se user tem permissao especifica (granular)
    // Chamado por Auth.can quando a acao tem 3 niveis (cadastros:X:editar)
    function userTemPermissao(username, acao) {
      var overrides = getOverrides();
      var lista = overrides[username] || [];
      return lista.indexOf(acao) >= 0;
    }

    // Mapa de "acao granular" -> "scope+chave bloqueada no Storage"
    // Ex: 'cadastros:acessorios:editar' libera acessorios_lista
    var MAPA_ACAO_CHAVES = {
      'cadastros:acessorios:editar':     ['acessorios_lista'],
      'cadastros:perfis:editar':         ['perfis_lista'],
      'cadastros:superficies:editar':    ['superficies_lista', 'cores_lista'],
      'cadastros:modelos:editar':        ['modelos_lista'],
      'cadastros:regras:editar':         ['regras_porta_externa', 'regras_chapas', 'regras_fita_silicone',
                                          'rendimentos_fita_silicone', 'precificacao_porta_externa',
                                          'precificacao_revestimento_parede'],
      'cadastros:representantes:editar': ['representantes_lista', 'comissoes_lista'],
      'cadastros:mensagens:editar':      ['mensagens_templates'],
      'cadastros:filtros:editar':        ['filtros_lista'],
    };

    // Reverso: dado uma chave (acessorios_lista), qual acao granular libera?
    function acaoQueeLibera(chave) {
      for (var acao in MAPA_ACAO_CHAVES) {
        if (MAPA_ACAO_CHAVES[acao].indexOf(chave) >= 0) return acao;
      }
      return null;
    }

    // Funcao chave: dado um username e uma chave de cadastros, ele pode editar?
    function podeEditarChave(username, chave) {
      // Felipe e' admin fixo, sempre pode tudo
      var users = window.Auth.listUsers();
      var u = users.find(function(x) { return x.username === username; });
      if (u && u.role === 'admin') return true;
      // Procura override granular pra essa chave
      var acao = acaoQueeLibera(chave);
      if (!acao) return false; // chave nao mapeada = bloqueado pra nao-admin
      return userTemPermissao(username, acao);
    }

    function render(container) {
      var users = window.Auth.listUsers();
      var overrides = getOverrides();

      // Header + tabela de matriz
      var html = '';
      html += '<div class="cadastros-tela">';
      html += '<div class="info-banner" style="margin-bottom:14px;">';
      html += '<span class="t-strong">Permissões:</span> ';
      html += 'Marque quais áreas cada usuário pode editar. ';
      html += 'Por padrão, só o admin (Felipe) pode editar tudo. ';
      html += 'Usuários comuns só visualizam, mas você pode liberar acessos específicos aqui.';
      html += '</div>';

      // Filtro só de não-admins (admin vê tudo por padrão, não precisa override)
      var naoAdmins = users.filter(function(u) { return u.role !== 'admin'; });

      if (naoAdmins.length === 0) {
        html += '<div class="placeholder"><h3>Nenhum usuário não-admin cadastrado</h3>' +
                '<p>Cadastre usuários em <b>Cadastros &gt; Usuários</b> antes de configurar permissões.</p></div>';
        html += '</div>';
        container.innerHTML = html;
        return;
      }

      // Tabela: linhas = permissoes, colunas = usuarios
      html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">';
      html += '<table style="width:100%;border-collapse:collapse;">';
      html += '<thead>';
      html += '<tr style="background:#003144;color:#fff;">';
      html += '<th style="padding:12px 16px;text-align:left;font-size:13px;letter-spacing:0.3px;min-width:280px;">Permissão</th>';
      naoAdmins.forEach(function(u) {
        html += '<th style="padding:12px 16px;text-align:center;font-size:13px;min-width:140px;">';
        html += '<div style="font-weight:700;">' + escHtml(u.name || u.username) + '</div>';
        html += '<div style="font-size:10px;opacity:0.7;font-weight:400;">' + escHtml(u.username) + '</div>';
        html += '</th>';
      });
      html += '</tr>';
      html += '</thead>';

      html += '<tbody>';
      PERMISSOES_DISPONIVEIS.forEach(function(perm, idx) {
        var bgRow = idx % 2 === 0 ? '#fafafa' : '#fff';
        html += '<tr style="background:' + bgRow + ';border-top:1px solid #e5e7eb;">';
        html += '<td style="padding:12px 16px;">';
        html += '<div style="font-weight:600;color:#1f3658;font-size:13px;">' + escHtml(perm.label) + '</div>';
        html += '<div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.4;">' + escHtml(perm.descricao) + '</div>';
        html += '</td>';
        naoAdmins.forEach(function(u) {
          var temPerm = (overrides[u.username] || []).indexOf(perm.id) >= 0;
          html += '<td style="padding:12px 16px;text-align:center;" data-no-readonly="1">';
          html += '<label style="display:inline-flex;align-items:center;cursor:pointer;user-select:none;">';
          html += '<input type="checkbox" class="perm-checkbox" ' +
                  'data-username="' + escHtml(u.username) + '" ' +
                  'data-perm="' + escHtml(perm.id) + '" ' +
                  (temPerm ? 'checked' : '') + ' ' +
                  'style="width:20px;height:20px;cursor:pointer;accent-color:#16a34a;" />';
          html += '</label>';
          html += '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody>';
      html += '</table>';
      html += '</div>';

      // Status + ajuda
      html += '<div id="perm-status" style="margin-top:10px;font-size:13px;color:#16a34a;font-weight:600;height:20px;"></div>';
      html += '<div style="margin-top:14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px 14px;font-size:12px;color:#075985;line-height:1.5;">';
      html += '<b>💡 Como funciona:</b><br>';
      html += '• <b>Padrão:</b> usuários comuns só visualizam Cadastros (não editam).<br>';
      html += '• <b>Marcando uma caixa:</b> aquele usuário ganha permissão de editar aquela área específica.<br>';
      html += '• <b>Salvamento automático:</b> as alterações aplicam imediatamente. O usuário precisa atualizar a página (F5) pra ver os novos botões aparecerem.<br>';
      html += '• <b>Felipe (admin):</b> tem todas as permissões automaticamente, não aparece na lista.';
      html += '</div>';

      html += '</div>';
      container.innerHTML = html;

      // Wire up checkboxes
      container.querySelectorAll('.perm-checkbox').forEach(function(cb) {
        cb.addEventListener('change', function() {
          var username = cb.dataset.username;
          var perm = cb.dataset.perm;
          var ovs = getOverrides();
          var lista = ovs[username] || [];
          if (cb.checked) {
            if (lista.indexOf(perm) < 0) lista.push(perm);
          } else {
            lista = lista.filter(function(p) { return p !== perm; });
          }
          ovs[username] = lista;
          // Limpa entradas vazias
          if (lista.length === 0) delete ovs[username];
          try {
            salvarOverrides(ovs);
            mostrarStatus('✅ Permissão atualizada — ' + (cb.checked ? 'liberada' : 'removida') + ' pra ' + username);
          } catch(e) {
            mostrarStatus('❌ Erro: ' + e.message, true);
            // Reverte checkbox
            cb.checked = !cb.checked;
          }
        });
      });
    }

    function mostrarStatus(msg, isError) {
      var el = document.getElementById('perm-status');
      if (!el) return;
      el.textContent = msg;
      el.style.color = isError ? '#dc2626' : '#16a34a';
      setTimeout(function() {
        if (el.textContent === msg) el.textContent = '';
      }, 3500);
    }

    function escHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    return {
      render: render,
      podeEditarChave: podeEditarChave,
      userTemPermissao: userTemPermissao,
      getOverrides: getOverrides,
    };
  })();

  window.Permissoes = Permissoes;
})();
