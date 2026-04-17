/**
 * 11-crm_map.js
 * Module: CRM_MAP
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: CRM_MAP ══ */
(function(){
var _map=null,_markers=[],_allDeals=[],_geoCache={},_stageLabels={};
var GEO_LS='projetta_geocache_v1';
try{_geoCache=JSON.parse(localStorage.getItem(GEO_LS))||{};}catch(e){}
function _saveGeoCache(){try{localStorage.setItem(GEO_LS,JSON.stringify(_geoCache));}catch(e){}}

var STAGE_COLORS={'s1':'#95a5a6','s2':'#3498db','s3':'#e67e22','s3b':'#f39c12','s4':'#9b59b6','s5':'#e74c3c','s6':'#27ae60','s7':'#7f8c8d'};

function _pinIcon(color){
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="'+color+'" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>';
  return L.divIcon({className:'',html:svg,iconSize:[28,40],iconAnchor:[14,40],popupAnchor:[0,-36]});
}
var _factoryIcon=L.divIcon({className:'',html:'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect x="2" y="10" width="32" height="24" rx="2" fill="#c47012" stroke="#fff" stroke-width="2"/><rect x="6" y="14" width="6" height="6" rx="1" fill="#fff" opacity=".9"/><rect x="15" y="14" width="6" height="6" rx="1" fill="#fff" opacity=".9"/><rect x="24" y="14" width="6" height="6" rx="1" fill="#fff" opacity=".9"/><rect x="6" y="24" width="6" height="8" rx="1" fill="#fff" opacity=".9"/><rect x="15" y="24" width="6" height="8" rx="1" fill="#fff" opacity=".9"/><rect x="24" y="24" width="6" height="8" rx="1" fill="#fff" opacity=".9"/><polygon points="2,10 10,2 18,10" fill="#003144" stroke="#fff" stroke-width="1.5"/><rect x="26" y="2" width="5" height="8" rx="1" fill="#003144" stroke="#fff" stroke-width="1.5"/><rect x="27.5" y="0" width="2" height="4" fill="#888" stroke="#fff" stroke-width=".5"/></svg>',iconSize:[36,36],iconAnchor:[18,34],popupAnchor:[0,-30]});

function _geocode(key,cb){
  if(_geoCache[key]){cb(_geoCache[key]);return;}
  var url='https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(key+', Brasil')+'&format=json&limit=1';
  fetch(url,{headers:{'User-Agent':'Projetta-Map/1.0','Accept-Language':'pt-BR'}})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d&&d.length){var c={lat:parseFloat(d[0].lat),lon:parseFloat(d[0].lon)};_geoCache[key]=c;_saveGeoCache();cb(c);}
      else cb(null);
    }).catch(function(){cb(null);});
}

window.crmOpenMap=function(){
  var modal=document.getElementById('crm-map-modal');
  modal.style.display='';
  if(!_map){
    _map=L.map('crm-map').setView([-15.8,-47.9],5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'© OpenStreetMap © CARTO',maxZoom:18,subdomains:'abcd'}).addTo(_map);
    // Factory pin
    L.marker([FACTORY_LAT,FACTORY_LON],{icon:_factoryIcon}).addTo(_map).bindPopup('<b>🏭 Projetta Alumínio</b><br>Uberlândia - MG');
  }
  setTimeout(function(){_map.invalidateSize();},150);
  _loadDeals();
};

window.crmCloseMap=function(){document.getElementById('crm-map-modal').style.display='none';};

function _loadDeals(){
  var deals=[];
  try{deals=JSON.parse(localStorage.getItem('projetta_crm_v1'))||[];}catch(e){}
  _allDeals=deals;
  // Populate stage filter
  var sel=document.getElementById('crm-map-filter');
  var stageMap={};
  deals.forEach(function(d){if(d.stage){stageMap[d.stage]=1;}});
  var stages;
  try{var s=JSON.parse(localStorage.getItem('projetta_crm_settings_v1'))||{};stages=(s.stages||[]).length?s.stages:null;}catch(e){}
  if(!stages)stages=[{id:'s1',label:'Prospecção'},{id:'s2',label:'Qualificação'},{id:'s3',label:'Fazer Orçamento'},{id:'s3b',label:'Orçamento Pronto'},{id:'s4',label:'Proposta Enviada'},{id:'s5',label:'Negociação'},{id:'s6',label:'Fechado Ganho'},{id:'s7',label:'Perdido'}];
  var stageLabels={};
  stages.forEach(function(st){stageLabels[st.id]=st.label;});
  sel.innerHTML='<option value="">Todas etapas</option>';
  stages.forEach(function(st){if(stageMap[st.id])sel.innerHTML+='<option value="'+st.id+'">'+st.label+'</option>';});
  _stageLabels=stageLabels;
  _renderPins('');
}

function _renderPins(filterStage){
  _markers.forEach(function(m){_map.removeLayer(m);});
  _markers=[];
  var bounds=[];
  var queue=[];
  var count=0;
  _allDeals.forEach(function(d){
    if(filterStage&&d.stage!==filterStage)return;
    var locKey=d.cidade?(d.cidade+(d.estado?' '+d.estado:'')):(d.cep||'');
    if(!locKey)return;
    count++;
    queue.push({deal:d,key:locKey});
  });
  document.getElementById('crm-map-count').textContent=count+' obras com localização';
  var delay=0;
  queue.forEach(function(item,i){
    setTimeout(function(){
      _geocode(item.key,function(c){
        if(!c)return;
        var d=item.deal;
        var color=STAGE_COLORS[d.stage]||'#003144';
        var valor=d.valor?'R$ '+Number(d.valor).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—';
        var popup='<div style="font-size:12px;line-height:1.6;min-width:160px"><b>'+_esc(d.cliente||'Sem nome')+'</b><br>'
          +'📍 '+(d.cidade||'')+(d.estado?' – '+d.estado:'')+'<br>'
          +'📦 '+(d.produto||'—')+'<br>'
          +'💰 '+valor+'<br>'
          +'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+color+';margin-right:4px"></span>'
          +(_stageLabels[d.stage]||d.stage||'')+'</div>';
        var m=L.marker([c.lat,c.lon],{icon:_pinIcon(color)}).addTo(_map).bindPopup(popup);
        _markers.push(m);
        bounds.push([c.lat,c.lon]);
        if(bounds.length>1)_map.fitBounds(bounds,{padding:[40,40]});
        else if(bounds.length===1)_map.setView(bounds[0],8);
      });
    },delay);
    delay+=(_geoCache[item.key]?0:350); // throttle Nominatim
  });
}

function _esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

window.crmMapFilter=function(){
  var v=document.getElementById('crm-map-filter').value;
  _renderPins(v);
};
})();
/* ══ END MODULE: CRM_MAP ══ */
