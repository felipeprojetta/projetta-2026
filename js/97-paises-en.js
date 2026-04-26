/* ============================================================================
 * js/97-paises-en.js  —  Modulo NOVO (26-abr-2026, v2)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "coloque o nome dos paises em ingles"
 *
 * v2 (atualizacao): O sistema ja tem um datalist em PT criado pelo modulo
 *  '97-pais-autocomplete-fix-caixa.js' (id 'projetta-paises-datalist-97').
 *  Em vez de criar datalist proprio (que era sobrescrito pelo PT), agora
 *  esse modulo SUBSTITUI as options do datalist existente por nomes em
 *  ingles, garantindo que o autocomplete fique em ingles independente da
 *  ordem de carregamento.
 *
 * COMPORTAMENTO:
 *  - Aguarda o datalist 'projetta-paises-datalist-97' existir
 *  - Substitui todas as <option> por equivalentes em ingles (ISO 3166-1)
 *  - Atualiza placeholder de crm-o-inst-pais para EN
 *  - MutationObserver pro caso do datalist ser recriado
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta97PaisesEnApplied) return;
  window.__projetta97PaisesEnApplied = true;
  console.log('[97-paises-en] iniciando v2');

  // Lista oficial ISO 3166-1 (em ingles), ordenada alfabeticamente
  var PAISES_EN = [
    'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
    'Argentina','Armenia','Australia','Austria','Azerbaijan',
    'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize',
    'Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil',
    'Brunei','Bulgaria','Burkina Faso','Burundi',
    'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic',
    'Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia',
    'Cuba','Cyprus','Czech Republic',
    'Denmark','Djibouti','Dominica','Dominican Republic',
    'East Timor','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea',
    'Estonia','Eswatini','Ethiopia',
    'Fiji','Finland','France',
    'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada',
    'Guatemala','Guinea','Guinea-Bissau','Guyana',
    'Haiti','Honduras','Hong Kong','Hungary',
    'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
    'Ivory Coast',
    'Jamaica','Japan','Jordan',
    'Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan',
    'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein',
    'Lithuania','Luxembourg',
    'Macao','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta',
    'Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia',
    'Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
    'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger',
    'Nigeria','North Korea','North Macedonia','Norway',
    'Oman',
    'Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay',
    'Peru','Philippines','Poland','Portugal','Puerto Rico',
    'Qatar',
    'Romania','Russia','Rwanda',
    'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines',
    'Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal',
    'Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia',
    'Solomon Islands','Somalia','South Africa','South Korea','South Sudan',
    'Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
    'Taiwan','Tajikistan','Tanzania','Thailand','Togo','Tonga',
    'Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
    'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States',
    'Uruguay','Uzbekistan',
    'Vanuatu','Vatican City','Venezuela','Vietnam',
    'Yemen',
    'Zambia','Zimbabwe'
  ];

  // ID do datalist criado pelo outro modulo PT (e que vamos preencher em EN)
  var DATALIST_ID_EXISTENTE = 'projetta-paises-datalist-97';
  var PLACEHOLDER_EN = 'e.g. Portugal, United States, United Arab Emirates';

  function preencherDatalist(dl){
    if(!dl) return false;
    if(dl.__projetta97FilledEn) return false;
    // Limpar todas as options atuais
    while(dl.firstChild) dl.removeChild(dl.firstChild);
    // Adicionar as em ingles
    PAISES_EN.forEach(function(nome){
      var opt = document.createElement('option');
      opt.value = nome;
      dl.appendChild(opt);
    });
    dl.__projetta97FilledEn = true;
    console.log('[97-paises-en] datalist preenchido com ' + PAISES_EN.length + ' paises em ingles');
    return true;
  }

  function reaplicar(){
    var dl = document.getElementById(DATALIST_ID_EXISTENTE);
    if(!dl) return;

    // Se o datalist foi recriado (novas options em PT), refazer em EN
    var primeiraOpt = dl.options[0];
    if(primeiraOpt && primeiraOpt.value !== 'Afghanistan' && dl.options.length !== PAISES_EN.length){
      dl.__projetta97FilledEn = false; // forcar reset
      preencherDatalist(dl);
    } else if(!dl.__projetta97FilledEn){
      preencherDatalist(dl);
    }

    // Atualizar placeholder do input
    var inp = document.getElementById('crm-o-inst-pais');
    if(inp && inp.placeholder !== PLACEHOLDER_EN){
      inp.placeholder = PLACEHOLDER_EN;
      inp.title = 'Type to autocomplete from the official ISO country list (in English)';
    }
  }

  // Polling 800ms (lightweight) — cobre datalist sendo recriado pelo modulo PT
  setInterval(reaplicar, 800);
  setTimeout(reaplicar, 200);
  setTimeout(reaplicar, 1000);
  setTimeout(reaplicar, 3000);

  // MutationObserver opcional: se o datalist for substituido por novo elemento
  if(typeof MutationObserver !== 'undefined'){
    var mo = new MutationObserver(function(muts){
      muts.forEach(function(m){
        if(m.type === 'childList' && m.addedNodes){
          for(var i = 0; i < m.addedNodes.length; i++){
            var n = m.addedNodes[i];
            if(n.id === DATALIST_ID_EXISTENTE){
              setTimeout(reaplicar, 50);
            }
          }
        }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log('[97-paises-en] v2 instalado');
})();
