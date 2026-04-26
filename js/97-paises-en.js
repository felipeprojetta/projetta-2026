/* ============================================================================
 * js/97-paises-en.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "coloque o nome dos paises em ingles"
 *
 * Conforme regras de blindagem:
 *  - NAO modifica nenhum arquivo JS existente
 *  - NAO deleta linhas de codigo
 *  - Apenas injeta um <datalist> e ajusta o placeholder do input crm-o-inst-pais
 *
 * COMPORTAMENTO:
 *  - Cria <datalist id="projetta-paises-en"> com ~250 paises ISO em ingles
 *  - Conecta ao input crm-o-inst-pais via attribute "list"
 *  - Substitui placeholder PT por equivalente EN
 *  - Polling 800ms apenas se modal CRM aberto e modo INTERNACIONAL
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta97PaisesEnApplied) return;
  window.__projetta97PaisesEnApplied = true;
  console.log('[97-paises-en] iniciando');

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

  var DATALIST_ID = 'projetta-paises-en';
  var PLACEHOLDER_EN = 'e.g. Portugal, United States, United Arab Emirates';

  function ensureDatalist(){
    var dl = document.getElementById(DATALIST_ID);
    if(dl) return dl;
    dl = document.createElement('datalist');
    dl.id = DATALIST_ID;
    PAISES_EN.forEach(function(nome){
      var opt = document.createElement('option');
      opt.value = nome;
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);
    return dl;
  }

  function modalAberto(){
    var titulos = document.querySelectorAll('h2,h3,h4,div');
    for(var i = 0; i < titulos.length; i++){
      var t = (titulos[i].textContent||'').trim();
      if(/^(Editar|Nova) Oportunidade/.test(t) && titulos[i].children.length < 3 && titulos[i].offsetParent !== null) return true;
    }
    return false;
  }

  function aplicarNoInput(){
    var inp = document.getElementById('crm-o-inst-pais');
    if(!inp) return;
    if(inp.__projetta97Applied) return;
    inp.__projetta97Applied = true;

    ensureDatalist();
    inp.setAttribute('list', DATALIST_ID);
    inp.placeholder = PLACEHOLDER_EN;
    inp.setAttribute('autocomplete', 'off');
    inp.title = 'Type to autocomplete from the official ISO country list (in English)';
  }

  function tick(){
    if(!modalAberto()) return;
    aplicarNoInput();
  }

  setInterval(tick, 800);
  setTimeout(tick, 200);

  console.log('[97-paises-en] instalado (' + PAISES_EN.length + ' paises carregados)');
})();
