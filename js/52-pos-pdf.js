/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.posorc.pdf — Submódulo de geração de PDF
 * ─────────────────────────────────────────────────────────────────────
 *
 * RESPONSABILIDADE ÚNICA: capturar as abas do orçamento em PNG, montar
 * PDF multi-página e fazer upload pro Supabase Storage.
 *
 * CONTRATO:
 *   - Depende de html2canvas + jsPDF já carregados (CDN).
 *   - Cada aba vira 1 página do PDF.
 *   - Retorna Blob pronto pra upload.
 *   - Upload é separado — chamador decide quando fazer.
 *
 * API PÚBLICA:
 *   PROJETTA.posorc.pdf.capturarPaginas(opcoes)
 *     → Promise<[{ aba, dataUrl, w, h }, ...]>
 *
 *   PROJETTA.posorc.pdf.gerar(opcoes)
 *     → Promise<Blob>  (PDF completo)
 *
 *   PROJETTA.posorc.pdf.upload(blob, cardId, revNum)
 *     → Promise<string>  (URL pública do PDF no Storage)
 *
 *   PROJETTA.posorc.pdf.temBibliotecas()
 *     → boolean
 *
 * OBS: As 6 abas que serão capturadas serão parametrizáveis na próxima
 * iteração. Por enquanto, aceita array de seletores CSS via opcoes.abas.
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.posorc = window.PROJETTA.posorc || {};

(function(ns){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var BUCKET       = 'orcamentos-pdf';

  var DEFAULT_ABAS = [
    { id: 'caracteristicas', seletor: '#bloco-carac',      titulo: 'Características' },
    { id: 'fabricacao',      seletor: '#bloco-fabric',     titulo: 'Fabricação' },
    { id: 'instalacao',      seletor: '#bloco-instal',     titulo: 'Instalação' },
    { id: 'lev_acessorios',  seletor: '#bloco-acess-lev',  titulo: 'Lev. Acessórios' },
    { id: 'lev_perfis',      seletor: '#bloco-perfis-lev', titulo: 'Lev. Perfis' },
    { id: 'lev_chapas',      seletor: '#bloco-chapas-lev', titulo: 'Lev. Chapas' }
  ];

  function _temBibliotecas(){
    return typeof window.html2canvas === 'function' && 
           typeof window.jspdf !== 'undefined' && 
           typeof window.jspdf.jsPDF === 'function';
  }

  async function _capturarElemento(el){
    if(!el) return null;
    var canvas = await window.html2canvas(el, {
      scale:           2,
      useCORS:         true,
      backgroundColor: '#ffffff',
      logging:         false
    });
    return {
      dataUrl: canvas.toDataURL('image/png'),
      w:       canvas.width,
      h:       canvas.height
    };
  }

  async function _capturarPaginas(opcoes){
    opcoes = opcoes || {};
    var abas = Array.isArray(opcoes.abas) ? opcoes.abas : DEFAULT_ABAS;
    if(!_temBibliotecas()){
      throw new Error('[posorc.pdf] html2canvas + jsPDF não carregados');
    }
    var paginas = [];
    for(var i = 0; i < abas.length; i++){
      var aba = abas[i];
      var el  = document.querySelector(aba.seletor);
      if(!el){
        console.warn('[posorc.pdf] aba não encontrada: ' + aba.seletor);
        continue;
      }
      var cap = await _capturarElemento(el);
      if(cap){
        paginas.push({
          aba:     aba.id,
          titulo:  aba.titulo,
          dataUrl: cap.dataUrl,
          w:       cap.w,
          h:       cap.h
        });
      }
    }
    return paginas;
  }

  async function _montarPdf(paginas){
    if(!paginas || !paginas.length){
      throw new Error('[posorc.pdf] nenhuma página pra montar PDF');
    }
    var jsPDF = window.jspdf.jsPDF;
    var pdf   = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    var pageW = pdf.internal.pageSize.getWidth();
    var pageH = pdf.internal.pageSize.getHeight();

    paginas.forEach(function(p, idx){
      if(idx > 0) pdf.addPage();
      var ratio = Math.min(pageW / (p.w / 4), pageH / (p.h / 4));
      var imgW  = (p.w / 4) * ratio;
      var imgH  = (p.h / 4) * ratio;
      var offX  = (pageW - imgW) / 2;
      var offY  = (pageH - imgH) / 2;
      pdf.addImage(p.dataUrl, 'PNG', offX, offY, imgW, imgH);
    });

    return pdf.output('blob');
  }

  async function _upload(blob, cardId, revNum){
    if(!blob)    throw new Error('[posorc.pdf] blob vazio');
    if(!cardId)  throw new Error('[posorc.pdf] cardId obrigatório');
    if(!revNum)  throw new Error('[posorc.pdf] revNum obrigatório');

    var path = cardId + '/rev' + revNum + '-' + Date.now() + '.pdf';
    var url  = SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + path;
    var res  = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey':        ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
        'Content-Type':  'application/pdf',
        'x-upsert':      'true'
      },
      body: blob
    });
    if(!res.ok){
      var txt = await res.text();
      throw new Error('[posorc.pdf] upload falhou: HTTP ' + res.status + ' — ' + txt);
    }
    return SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
  }

  ns.pdf = {
    version: '1.0',
    DEFAULT_ABAS: DEFAULT_ABAS,

    temBibliotecas:     _temBibliotecas,
    capturarPaginas:    _capturarPaginas,

    /**
     * Gera Blob de PDF multi-página das abas do orçamento atual.
     * @param {object} opcoes - { abas?: [{id, seletor, titulo}, ...] }
     * @returns {Promise<Blob>}
     */
    async gerar(opcoes){
      var paginas = await _capturarPaginas(opcoes);
      return await _montarPdf(paginas);
    },

    /**
     * Faz upload do PDF pro Supabase Storage.
     * @param {Blob}   blob    - PDF
     * @param {string} cardId  - id do card
     * @param {number} revNum  - número da revisão
     * @returns {Promise<string>} URL pública
     */
    upload: _upload
  };

  console.log('[PROJETTA.posorc.pdf] v' + ns.pdf.version + ' carregado' +
              (_temBibliotecas() ? '' : ' (aviso: html2canvas/jsPDF ainda não prontos)'));
})(window.PROJETTA.posorc);
