/* ============================================================
   EMPRESA — constantes e helpers compartilhados
   ============================================================
   Felipe (do doc): TODO relatorio precisa ter cabecalho padronizado:
     - Logo Projetta
     - Dados da empresa (CNPJ, endereco, CEP, site)
     - Nome cliente, AGP, Endereco, Vendedor

   Este modulo expoe os dados via window.Empresa pra qualquer modulo
   que precise montar relatorios usar. R09: API publica.
   ============================================================ */

(function () {
  'use strict';

  // Felipe (do doc): dados da empresa Projetta — fixos por enquanto,
  // depois podem virar editaveis em Configuracoes.
  const DADOS_EMPRESA = Object.freeze({
    razaoSocial: 'Projetta Portas Exclusivas LTDA',
    cnpj: '35.582.302/0001-08',
    endereco: 'Avenida dos Siquierolis, 51',
    bairro: 'Bairro Nossa Senhora das Graças',
    cep: 'CEP 38401-708',
    cidadeUf: 'Uberlandia / MG',
    site: 'www.projettaaluminio.com',
    instagram: '@projettaaluminio',
    // Logo embutido como SVG no shell (index.html) — referenciado pelo header
    logoUrl: 'images/projetta-logo.png',
  });

  /**
   * Helper: monta o HTML do cabecalho padrao usado em TODOS os relatorios.
   * Inputs:
   *   - opcoes.lead: objeto com cliente, numeroAGP, cidade, estado, etc
   *   - opcoes.vendedor: nome do vendedor (representante_followup ou contato)
   *   - opcoes.tituloRelatorio: ex "Proposta Comercial — Previa"
   *   - opcoes.numeroDocumento: ex "001 - 1" ou "PRP-V1"
   *   - opcoes.validade: dias uteis (default 15)
   * Retorna string HTML.
   */
  function montarHeaderRelatorio(opcoes) {
    opcoes = opcoes || {};
    const lead = opcoes.lead || {};
    const titulo = opcoes.tituloRelatorio || 'Relatorio';
    const numeroDoc = opcoes.numeroDocumento || '—';
    const validade = opcoes.validade != null ? opcoes.validade : 15;
    const cidade = lead.cidade || '—';
    const estado = lead.estado || '';
    const cidadeUf = estado ? `${cidade} / ${estado}` : cidade;
    const cliente = lead.cliente || '—';
    const agp = lead.numeroAGP || '—';
    const reserva = lead.numeroReserva || '—';
    const dataEmissao = new Date().toLocaleDateString('pt-BR');
    const horaEmissao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Felipe (do doc): NA PROPOSTA, nao puxa followup. Puxa razao social
    // do representante + nome dele (contato principal). Lookup via
    // window.Representantes.listar(). Se opcoes.vendedor for passado
    // explicito, usa esse. Se nao, faz o lookup.
    let vendedor = opcoes.vendedor || '';
    if (!vendedor) {
      const fup = (lead.representante_followup || '').trim();
      if (fup && window.Representantes && typeof window.Representantes.listar === 'function') {
        const reps = window.Representantes.listar();
        const rep = reps.find(r => String(r.followup || '').trim() === fup);
        if (rep) {
          // Razao social + nome do contato principal
          const razao = (rep.razao_social || '').trim();
          const contato = (lead.representante_contato || '').trim();
          const contatoFallback = (rep.contatos && rep.contatos[0] && rep.contatos[0].nome) || '';
          const nomeContato = contato || contatoFallback;
          if (razao && nomeContato) {
            vendedor = `${razao} (${nomeContato})`;
          } else if (razao) {
            vendedor = razao;
          } else {
            vendedor = nomeContato || fup;
          }
        } else if (fup === 'PROJETTA') {
          vendedor = 'PROJETTA (venda interna)';
        } else {
          vendedor = fup;
        }
      } else {
        vendedor = lead.representante_contato || '—';
      }
    }

    // Felipe sessao 31: detecta lead internacional pra traduzir labels do header.
    const internacional = lead && lead.destinoTipo === 'internacional';
    const tr = (pt, en) => internacional ? en : pt;

    // 'PROJETTA (venda interna)' tambem vira EN se internacional
    if (vendedor === 'PROJETTA (venda interna)' && internacional) {
      vendedor = 'PROJETTA (internal sales)';
    }

    return `
      <div class="rel-header-wrap">
        <!-- Bloco 1: Logo + dados da empresa -->
        <div class="rel-header-empresa">
          <div class="rel-header-empresa-logo">
            <img src="${DADOS_EMPRESA.logoUrl}" alt="Projetta" onerror="this.style.display='none'" />
          </div>
          <div class="rel-header-empresa-info">
            <div class="rel-header-empresa-nome">${escapeHtml(DADOS_EMPRESA.razaoSocial)}</div>
            <div class="rel-header-empresa-detalhe">
              CNPJ ${escapeHtml(DADOS_EMPRESA.cnpj)} ·
              ${escapeHtml(DADOS_EMPRESA.endereco)} —
              ${escapeHtml(DADOS_EMPRESA.bairro)} · ${escapeHtml(DADOS_EMPRESA.cep)}
            </div>
          </div>
        </div>

        <!-- Bloco 2: Numero do documento + titulo -->
        <div class="rel-header-titulo">${escapeHtml(numeroDoc)} · ${escapeHtml(titulo)}</div>

        <!-- Bloco 3: Tabela do cliente (Obra/Reserva/Cliente/Cidade/Representante) -->
        <table class="rel-header-cliente-table">
          <tbody>
            <tr>
              <th>${tr('Obra:','Project:')}</th>
              <td>${escapeHtml(agp)}</td>
              <th>${tr('Reserva:','Reservation:')}</th>
              <td>${escapeHtml(reserva)}</td>
            </tr>
            <tr>
              <th>${tr('Cliente:','Customer:')}</th>
              <td colspan="3">${escapeHtml(cliente)}</td>
            </tr>
            <tr>
              <th>${tr('Cidade:','City:')}</th>
              <td>${escapeHtml(cidadeUf)}</td>
              <th>${tr('Representante:','Representative:')}</th>
              <td>${escapeHtml(vendedor)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Bloco 4: Banner de validade + emissao -->
        <div class="rel-header-validade">
          <span class="rel-header-validade-emissao">${tr('Emitido por','Issued by')} ${escapeHtml(window.Auth?.usuarioAtual?.()?.nome || 'Sistema')}
            ${tr('em','on')} ${dataEmissao}, ${tr('as','at')} ${horaEmissao}</span>
          <span class="rel-header-validade-prazo">${tr('Validade','Validity')}: ${validade} ${tr('dias uteis','business days')}</span>
        </div>
      </div>
    `;
  }

  // Helper local — evita dependencia circular com escapeHtml de outros modulos.
  // Se window.escapeHtml ja existe, usa; senao, faz inline.
  function escapeHtml(s) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // R09: expoe via window.Empresa
  window.Empresa = {
    DADOS: DADOS_EMPRESA,
    montarHeaderRelatorio,
  };
})();
