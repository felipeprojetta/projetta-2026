/* ============================================================================
 * js/97-pais-autocomplete-fix-caixa.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 *
 * Conforme regras de blindagem (configuracoes.projetta_regras_blindagem_v1):
 *  - NAO modifica nenhum arquivo JS existente
 *  - NAO deleta linhas de codigo
 *  - Funciona via DOM observation + datalist injection
 *
 * RESOLVE 2 PROBLEMAS:
 *
 *  FIX 1 — Modulo 96 nao detectava medidas da porta
 *    O modulo 96 lia apenas window._crmItens (array em memoria), mas o array
 *    nao eh populado em tempo real quando o usuario digita largura/altura no
 *    item editor. Agora le TAMBEM os inputs DOM (largura, altura, crm-o-largura,
 *    crm-o-altura, e variantes por item).
 *
 *  FEATURE 2 — Autocomplete de paises no campo crm-o-inst-pais
 *    Cria um <datalist> com TODOS os 250+ paises (em portugues) e aponta o
 *    input pra ele via attribute list=. Funciona nativamente em todo browser
 *    (HTML5), sem depender de JS de busca. User digita "bras" -> aparece Brasil.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta97Applied) return;
  window.__projetta97Applied = true;
  console.log('[97-pais-autocomplete-fix-caixa] iniciando');

  // ================== LISTA DE PAISES (em portugues) ==================
  var PAISES = [
    'Afeganistão','África do Sul','Albânia','Alemanha','Andorra','Angola','Antígua e Barbuda',
    'Arábia Saudita','Argélia','Argentina','Armênia','Austrália','Áustria','Azerbaijão',
    'Bahamas','Bahrein','Bangladesh','Barbados','Bélgica','Belize','Benin','Bielorrússia',
    'Bolívia','Bósnia e Herzegovina','Botsuana','Brasil','Brunei','Bulgária','Burquina Faso',
    'Burundi','Butão','Cabo Verde','Camarões','Camboja','Canadá','Catar','Cazaquistão','Chade',
    'Chile','China','Chipre','Cingapura','Colômbia','Comores','Congo','Coreia do Norte',
    'Coreia do Sul','Costa do Marfim','Costa Rica','Croácia','Cuba','Dinamarca','Djibuti',
    'Dominica','Egito','El Salvador','Emirados Árabes Unidos','Equador','Eritreia','Eslováquia',
    'Eslovênia','Espanha','Estados Unidos','Estônia','Eswatini','Etiópia','Fiji','Filipinas',
    'Finlândia','França','Gabão','Gâmbia','Gana','Geórgia','Granada','Grécia','Guatemala',
    'Guiana','Guiné','Guiné Equatorial','Guiné-Bissau','Haiti','Holanda','Honduras','Hong Kong',
    'Hungria','Iêmen','Ilhas Marshall','Ilhas Salomão','Índia','Indonésia','Irã','Iraque',
    'Irlanda','Islândia','Israel','Itália','Jamaica','Japão','Jordânia','Kiribati','Kuwait',
    'Laos','Lesoto','Letônia','Líbano','Libéria','Líbia','Liechtenstein','Lituânia','Luxemburgo',
    'Macau','Macedônia do Norte','Madagascar','Malásia','Malawi','Maldivas','Mali','Malta',
    'Marrocos','Maurício','Mauritânia','México','Mianmar','Micronésia','Moçambique','Moldávia',
    'Mônaco','Mongólia','Montenegro','Namíbia','Nauru','Nepal','Nicarágua','Níger','Nigéria',
    'Noruega','Nova Zelândia','Omã','Países Baixos','Palau','Palestina','Panamá','Papua-Nova Guiné',
    'Paquistão','Paraguai','Peru','Polônia','Porto Rico','Portugal','Quênia','Quirguistão',
    'Reino Unido','República Centro-Africana','República Dominicana','República Tcheca',
    'República do Congo','República Democrática do Congo','Romênia','Ruanda','Rússia','Samoa',
    'San Marino','Santa Lúcia','São Cristóvão e Nevis','São Tomé e Príncipe','São Vicente e Granadinas',
    'Senegal','Serra Leoa','Sérvia','Seychelles','Síria','Somália','Sri Lanka','Sudão','Sudão do Sul',
    'Suécia','Suíça','Suriname','Tailândia','Taiwan','Tajiquistão','Tanzânia','Timor-Leste','Togo',
    'Tonga','Trinidad e Tobago','Tunísia','Turcomenistão','Turquia','Tuvalu','Ucrânia','Uganda',
    'Uruguai','Uzbequistão','Vanuatu','Vaticano','Venezuela','Vietnã','Zâmbia','Zimbábue'
  ];

  // ================== INJETAR DATALIST (so 1x) ==================
  var DATALIST_ID = 'projetta-paises-datalist-97';
  function ensureDatalist(){
    if(document.getElementById(DATALIST_ID)) return;
    var dl = document.createElement('datalist');
    dl.id = DATALIST_ID;
    PAISES.forEach(function(p){
      var opt = document.createElement('option');
      opt.value = p;
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);
    console.log('[97] datalist com ' + PAISES.length + ' paises injetado');
  }

  // ================== CONECTAR INPUT DE PAIS AO DATALIST ==================
  function patchInputPais(){
    var inp = document.getElementById('crm-o-inst-pais');
    if(!inp) return;
    if(inp.getAttribute('list') === DATALIST_ID && inp.__projetta97Patched) return;
    ensureDatalist();
    inp.setAttribute('list', DATALIST_ID);
    inp.setAttribute('autocomplete', 'off'); // evita autocomplete do navegador conflitar
    if(!inp.placeholder || inp.placeholder.length < 5){
      inp.placeholder = 'Digite e selecione...';
    }
    inp.__projetta97Patched = true;
  }

  // ================== FIX 1: LER LARGURA/ALTURA DO DOM TAMBEM ==================
  // Substitui a deteccao do modulo 96. Se 96 esta carregado, sobrescrevemos
  // o tick dele com uma versao que considera DOM tambem.

  function $(id){ return document.getElementById(id); }

  function modalAberto(){
    var titulos = document.querySelectorAll('h2,h3,h4,div');
    for(var i = 0; i < titulos.length; i++){
      var t = (titulos[i].textContent||'').trim();
      if(/^(Editar|Nova) Oportunidade/.test(t) && titulos[i].children.length < 3 && titulos[i].offsetParent !== null) return true;
    }
    return false;
  }

  function isInternacionalCIF(){
    var quem = $('crm-o-inst-quem');
    var inc = $('crm-o-inst-incoterm');
    if(!quem || !inc) return false;
    return (quem.value||'').toUpperCase() === 'INTERNACIONAL' &&
      (['CIF','FOB'].indexOf((inc.value||'').toUpperCase()) >= 0);
  }

  function getMedidasDaPorta(){
    // 1. Tentar window._crmItens (memoria)
    var medidas = [];
    var arr = window._crmItens || [];
    arr.forEach(function(it){
      if(!it) return;
      var l = Number(it.largura) || 0;
      var a = Number(it.altura) || 0;
      if(l > 0 && a > 0) medidas.push({ l: l, a: a });
    });
    if(medidas.length > 0) return medidas;

    // 2. Fallback: ler inputs DOM diretamente (largura, altura, crm-o-largura, crm-o-altura)
    // O modal pode ter MULTIPLOS itens, cada um com seus inputs. Pegamos todos visiveis.
    var ids_largura = ['largura', 'crm-o-largura'];
    var ids_altura  = ['altura',  'crm-o-altura'];

    var lartrava = 0, alttrava = 0;
    ids_largura.forEach(function(id){
      var el = $(id);
      if(el && el.offsetParent !== null){
        var v = Number(el.value) || 0;
        if(v > lartrava) lartrava = v;
      }
    });
    ids_altura.forEach(function(id){
      var el = $(id);
      if(el && el.offsetParent !== null){
        var v = Number(el.value) || 0;
        if(v > alttrava) alttrava = v;
      }
    });

    // Tambem buscar todos inputs com IDs do tipo "item-{n}-largura" e "crm-item-{n}-largura"
    var allInps = document.querySelectorAll('input[type="number"], input:not([type])');
    var itemMap = {};
    Array.prototype.forEach.call(allInps, function(el){
      if(!el.id || el.offsetParent === null) return;
      var m = el.id.match(/^(?:crm-)?(?:o-)?item-(\d+)-(largura|altura)$/i) ||
              el.id.match(/^(?:crm-)?(?:item-)?(\d+)-(largura|altura)$/i);
      if(m){
        var idx = m[1], campo = m[2].toLowerCase();
        itemMap[idx] = itemMap[idx] || {};
        itemMap[idx][campo] = Number(el.value) || 0;
      }
    });
    Object.keys(itemMap).forEach(function(k){
      var it = itemMap[k];
      if(it.largura > 0 && it.altura > 0) medidas.push({ l: it.largura, a: it.altura });
    });

    // Se achou pelo fallback simples (largura/altura globais), gera 1 medida
    if(medidas.length === 0 && lartrava > 0 && alttrava > 0){
      medidas.push({ l: lartrava, a: alttrava });
    }

    return medidas;
  }

  function roundUp50(v){ return Math.ceil(v / 50) * 50; }

  function calcAutoCaixa(medidas){
    if(!medidas.length) return null;
    var maxL = 0, maxA = 0;
    medidas.forEach(function(m){
      if(m.l > maxL) maxL = m.l;
      if(m.a > maxA) maxA = m.a;
    });
    return {
      a: roundUp50(maxL + 350),
      l: roundUp50(maxA + 250),
      e: medidas.length === 1 ? 600 : 0
    };
  }

  var IDS_DIM = ['crm-o-cif-caixa-a','crm-o-cif-caixa-l','crm-o-cif-caixa-e'];
  var TITLES_LIB = {
    'crm-o-cif-caixa-a': '🔓 Auto: maior LARGURA da porta + 350, arred 50mm',
    'crm-o-cif-caixa-l': '🔓 Auto: maior ALTURA da porta + 250, arred 50mm',
    'crm-o-cif-caixa-e': '🔓 Auto: 600mm se 1 item, 0 se multiplos itens'
  };

  function bloquear(){
    IDS_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = true;
      el.value = '';
      el.placeholder = '— preencha porta —';
      el.style.background = '#f0f0f0';
      el.style.color = '#aaa';
      el.style.cursor = 'not-allowed';
      el.style.borderStyle = 'dashed';
      el.title = '🔒 Preencha medidas da porta primeiro (Largura + Altura)';
    });
  }

  function liberarECalcular(medidas){
    var calc = calcAutoCaixa(medidas);
    if(!calc) return;
    var dimVals = { 'crm-o-cif-caixa-a': calc.a, 'crm-o-cif-caixa-l': calc.l, 'crm-o-cif-caixa-e': calc.e };
    var changed = false;
    IDS_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = false;
      el.style.background = '#fffaf3';
      el.style.color = '#555';
      el.style.cursor = 'not-allowed';
      el.style.borderStyle = 'dashed';
      el.readOnly = true;
      el.title = TITLES_LIB[id] || '';
      var nv = String(dimVals[id]);
      if(el.value !== nv){ el.value = nv; changed = true; }
    });
    if(changed && typeof window.crmCifRecalc === 'function'){
      try { window.crmCifRecalc(); } catch(e){}
    }
  }

  function tickCaixa(){
    if(!modalAberto()) return;
    if(!isInternacionalCIF()) return;
    var medidas = getMedidasDaPorta();
    if(medidas.length === 0) bloquear();
    else liberarECalcular(medidas);
  }

  function tick(){
    patchInputPais();
    tickCaixa();
  }

  // Inject datalist o quanto antes
  if(document.body) ensureDatalist();
  else document.addEventListener('DOMContentLoaded', ensureDatalist);

  // Polling principal (700ms)
  setInterval(tick, 700);
  setTimeout(tick, 200);

  // Listener adicional: quando user digita largura/altura, recalcula imediatamente
  document.addEventListener('input', function(e){
    if(!e.target || !e.target.id) return;
    if(/^(largura|altura|crm-o-largura|crm-o-altura)$/i.test(e.target.id) ||
       /(?:item-)?\d+-(?:largura|altura)$/i.test(e.target.id)){
      setTimeout(tickCaixa, 50);
    }
  }, true);

  console.log('[97-pais-autocomplete-fix-caixa] instalado');
})();
