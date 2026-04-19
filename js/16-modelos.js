/**
 * 16-modelos.js
 * Module: MODELOS
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: MODELOS ══ */
var _modeloImgCache={};        // foto 1 folha (retrocompatível)
var _modeloImgCache2fls={};    // foto 2 folhas (nova)
var _MODELOS_DEFAULT = {
  '01':'Cava','02':'Cava + 01 Friso Vertical','03':'Cava + 02 Friso Horizontal',
  '04':'Cava + 01 Friso Vertical & 01 Friso Horizontal','05':'Cava + 01 Friso Vertical & 02 Friso Horizontal',
  '06':'Cava + Friso Horizontal Variável','07':'Cava + Frisos Vertical Multiplo','08':'Cava + Ripado','09':'Cava Dupla',
  '10':'Puxador Externo Lisa','11':'Puxador Externo + 01 Friso Vertical',
  '12':'Puxador Externo + 01 Friso Vertical & 01 Friso Horizontal',
  '13':'Puxador Externo + 01 Friso Vertical & 02 Friso Horizontal','14':'Puxador Externo + Frisos Vertical Multiplo',
  '15':'Puxador Externo + Ripado','16':'Puxador Externo + Friso Horizontal Variável',
  '17':'Puxador Externo + Friso Horizontal Variável Inclinado','18':'Puxador Externo + Friso Geométricos',
  '19':'Cava + Friso Geométricos','20':'Puxador Externo + Friso Horizontal Variável (Ripas)',
  '21':'Friso Angular','22':'Cava Premium','23':'Classica com Molduras','24':'Cava Horizontal'
};
var _MODELOS_FIXED_CODES=['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24'];

/* ── PARÂMETROS CONFIGURÁVEIS POR MODELO (inspirado CEM Esquad Group) ────── */
var _MODELOS_PARAMS_FIELDS = [
  {key:'FGA',    label:'Folga Altura (mm)',         def:10,   min:0, max:50,  step:1,  grp:'FOLGAS'},
  {key:'FGL',    label:'Folga Largura Esq. (mm)',   def:10,   min:0, max:50,  step:1,  grp:'FOLGAS'},
  {key:'FGR',    label:'Folga Largura Dir. (mm)',   def:10,   min:0, max:50,  step:1,  grp:'FOLGAS'},
  {key:'PIV',    label:'Espessura Pivô (mm)',       def:28,   min:10,max:60,  step:0.5,grp:'ESTRUTURA'},
  {key:'TRANS',  label:'Transpasse ACM (mm)',       def:8,    min:0, max:30,  step:1,  grp:'ESTRUTURA'},
  {key:'VED',    label:'Veda Porta (mm)',           def:35,   min:0, max:80,  step:1,  grp:'ESTRUTURA'},
  {key:'ESPACM', label:'Espaçamento Montagem (mm)', def:4,   min:0, max:20,  step:1,  grp:'ESTRUTURA'},
  {key:'LARG_CAVA',label:'Largura Cava padrão (mm)',def:150, min:50,max:500, step:5,  grp:'CAVA'},
  {key:'TRAV_CAVA_ADD',label:'Travamento Cava +mm', def:100, min:50,max:300, step:10, grp:'CAVA'},
  {key:'H_PORTAL',label:'Horas Portal (base ≤2800)',def:5,   min:1, max:30,  step:1,  grp:'HORAS'},
  {key:'H_QUADRO',label:'Horas Quadro (base ≤2800)',def:5,   min:1, max:30,  step:1,  grp:'HORAS'},
  {key:'H_CONF',  label:'Horas Conferência (base)', def:3,   min:1, max:20,  step:1,  grp:'HORAS'},
  {key:'DIAS_COLAGEM',label:'Dias Colagem (base)',  def:0,   min:0, max:15,  step:1,  grp:'HORAS'},
];

// Defaults por TIPO de modelo (cava, lisa, ripado)
var _TIPO_MODELO = {
  '01':'cava','02':'cava','03':'cava','04':'cava','05':'cava','06':'cava','07':'cava',
  '08':'ripado','09':'cava',
  '10':'lisa','11':'lisa','12':'lisa','13':'lisa','14':'lisa',
  '15':'ripado','16':'lisa','17':'lisa','18':'lisa',
  '19':'cava','20':'ripado','21':'ripado','22':'cava','23':'cava','24':'cava'
};

var _DEFAULTS_POR_TIPO = {
  'cava':    {DIAS_COLAGEM:3, H_PORTAL:5, H_QUADRO:5, H_CONF:3},
  'lisa':    {DIAS_COLAGEM:2, H_PORTAL:5, H_QUADRO:5, H_CONF:3},
  'ripado':  {DIAS_COLAGEM:4, H_PORTAL:5, H_QUADRO:5, H_CONF:3}
};

function _getModeloParams(code){
  var tipo=_TIPO_MODELO[code]||'cava';
  var tipoDefaults=_DEFAULTS_POR_TIPO[tipo]||{};
  // Base: defaults globais + defaults por tipo
  var params={};
  _MODELOS_PARAMS_FIELDS.forEach(function(f){ params[f.key]=tipoDefaults[f.key]!==undefined?tipoDefaults[f.key]:f.def; });
  // Override com salvos no localStorage
  try{
    var saved=localStorage.getItem('projetta_modelo_params');
    if(saved){
      var all=JSON.parse(saved);
      if(all[code]){
        Object.keys(all[code]).forEach(function(k){ params[k]=all[code][k]; });
      }
    }
  }catch(e){}
  return params;
}

function _saveModeloParams(code, params){
  try{
    var saved=localStorage.getItem('projetta_modelo_params');
    var all=saved?JSON.parse(saved):{};
    all[code]=params;
    localStorage.setItem('projetta_modelo_params',JSON.stringify(all));
  }catch(e){console.warn('Erro salvando params modelo:',e);}
}

function _getModeloParamsForCurrent(){
  var modEl=document.getElementById('carac-modelo');
  var code=modEl?modEl.value:'01';
  return _getModeloParams(code||'01');
}

function _getModelosNomes(){
  var base=Object.assign({},_MODELOS_DEFAULT);
  try{
    var saved=localStorage.getItem('projetta_modelos');
    if(saved){
      var s=JSON.parse(saved);
      // Only load user-added models (not fixed ones)
      Object.keys(s).forEach(function(k){
        if(_MODELOS_FIXED_CODES.indexOf(k)===-1) base[k]=s[k]||'Modelo '+k;
      });
    }
  }catch(e){}
  return base;
}

function _getModelosCodes(){
  var nomes=_getModelosNomes();
  return Object.keys(nomes).sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});
}

function _renderModeloRow(code,name){
  var isFixed=_MODELOS_FIXED_CODES.indexOf(code)!==-1;
  var hasImg=!!_modeloImgCache[code];
  var nameHtml=isFixed
    ?'<span id="mod-name-'+code+'" style="flex:1;min-width:160px;padding:6px 10px;font-size:13px;color:var(--navy);font-family:inherit;font-weight:600">'+_escAttr(name)+'</span>'
    :'<input type="text" id="mod-name-'+code+'" value="'+_escAttr(name)+'" '
    +'style="flex:1;min-width:160px;padding:6px 10px;border:0.5px solid #c9c6bf;border-radius:6px;font-size:13px;background:#fffef5;color:var(--navy);outline:none;font-family:inherit">';
  var delHtml=isFixed?'':'<button onclick="deletarModelo(\''+code+'\')" '
    +'style="padding:5px 8px;border-radius:6px;border:1px solid #b71c1c;color:#b71c1c;font-size:11px;cursor:pointer;background:#fff;font-family:inherit" title="Excluir modelo">🗑</button>';
  return '<div id="mod-row-'+code+'" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid #eee;flex-wrap:wrap">'
    +'<span style="font-size:13px;font-weight:700;color:var(--navy);min-width:32px">'+code+'</span>'
    // ── Slot 1 folha (existente)
    +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px">'
    +'<div style="font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px">1 folha</div>'
    +'<img id="mod-img-'+code+'" src="" alt="" onclick="zoomModelImg(this)" '
    +'style="width:120px;height:220px;object-fit:contain;border-radius:8px;border:1px solid #ddd;background:#f9f8f5;display:none;cursor:pointer">'
    +'<div id="mod-img-placeholder-'+code+'" '
    +'style="width:120px;height:220px;border-radius:8px;border:1.5px dashed #c9c6bf;background:#f9f8f5;'
    +'display:flex;align-items:center;justify-content:center;font-size:18px;color:#ccc;flex-shrink:0">🖼</div>'
    +'<div style="display:flex;gap:4px">'
    +'<label style="cursor:pointer;padding:3px 8px;border-radius:6px;border:1px solid #c47012;color:#c47012;font-size:10px;font-weight:700;white-space:nowrap;font-family:inherit;background:#fff;display:inline-block" title="Carregar imagem 1 folha">'
    +'📷<input type="file" accept="image/*" style="display:none" onchange="carregarImagemModelo(\''+code+'\',this,\'1fl\')"></label>'
    +'<button onclick="removerImagemModelo(\''+code+'\',\'1fl\')" id="mod-img-del-'+code+'" '
    +'style="display:none;padding:3px 6px;border-radius:6px;border:1px solid #e74c3c;color:#e74c3c;font-size:10px;cursor:pointer;background:#fff;font-family:inherit" title="Remover imagem">✕</button>'
    +'</div></div>'
    // ── Slot 2 folhas (novo)
    +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px">'
    +'<div style="font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px">2 folhas</div>'
    +'<img id="mod-img-2fls-'+code+'" src="" alt="" onclick="zoomModelImg(this)" '
    +'style="width:120px;height:220px;object-fit:contain;border-radius:8px;border:1px solid #ddd;background:#f9f8f5;display:none;cursor:pointer">'
    +'<div id="mod-img-placeholder-2fls-'+code+'" '
    +'style="width:120px;height:220px;border-radius:8px;border:1.5px dashed #c9c6bf;background:#f9f8f5;'
    +'display:flex;align-items:center;justify-content:center;font-size:18px;color:#ccc;flex-shrink:0">🖼</div>'
    +'<div style="display:flex;gap:4px">'
    +'<label style="cursor:pointer;padding:3px 8px;border-radius:6px;border:1px solid #c47012;color:#c47012;font-size:10px;font-weight:700;white-space:nowrap;font-family:inherit;background:#fff;display:inline-block" title="Carregar imagem 2 folhas">'
    +'📷<input type="file" accept="image/*" style="display:none" onchange="carregarImagemModelo(\''+code+'\',this,\'2fls\')"></label>'
    +'<button onclick="removerImagemModelo(\''+code+'\',\'2fls\')" id="mod-img-del-2fls-'+code+'" '
    +'style="display:none;padding:3px 6px;border-radius:6px;border:1px solid #e74c3c;color:#e74c3c;font-size:10px;cursor:pointer;background:#fff;font-family:inherit" title="Remover imagem">✕</button>'
    +'</div></div>'
    +nameHtml
    +delHtml
    +'<button onclick="_abrirParamsModelo(\''+code+'\',\''+_escAttr(name).replace(/'/g,'')+'\')" '
    +'style="padding:5px 12px;border-radius:6px;border:1px solid #8e44ad;color:#8e44ad;font-size:11px;cursor:pointer;background:#fff;font-family:inherit;font-weight:700;white-space:nowrap" title="Configurar parâmetros deste modelo">⚙ Fórmulas</button>'
    +'</div>';
}
function _escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;');}

function renderModelos(){
  var container=document.getElementById('mod-list');
  if(!container)return;
  var codes=_getModelosCodes();
  var html='';
  var nomes=_getModelosNomes();
  codes.forEach(function(c){html+=_renderModeloRow(c,nomes[c]||'');});
  container.innerHTML=html;
  // Aplicar cache em memória imediatamente
  var cached=0;
  codes.forEach(function(c){
    if(_modeloImgCache[c]){_aplicarImagemModelo(c,_modeloImgCache[c],'1fl');cached++;}
    if(_modeloImgCache2fls[c]){_aplicarImagemModelo(c,_modeloImgCache2fls[c],'2fls');cached++;}
  });
  console.log('🔄 renderModelos: '+codes.length+' modelos, '+cached+' imagens do cache');
  _loadAllModeloImgsCloud(codes);
}

function _applyModelosToSelect(nomes){
  var sel=document.getElementById('carac-modelo');
  if(!sel)return;
  var current=sel.value;
  sel.innerHTML='<option value="">— Selecionar —</option>';
  var codes=Object.keys(nomes).sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});
  codes.forEach(function(c){
    sel.innerHTML+='<option value="'+c+'">'+c+' - '+_escAttr(nomes[c])+'</option>';
  });
  sel.value=current;
}

function loadModelos(){
  renderModelos();
  _applyModelosToSelect(_getModelosNomes());
}

function salvarModelos(){
  var codes=_getModelosCodes();
  var nomes={};
  codes.forEach(function(c){
    if(_MODELOS_FIXED_CODES.indexOf(c)!==-1) return; // skip fixed
    var inp=document.getElementById('mod-name-'+c);
    nomes[c]=inp?inp.value.trim()||c:c;
  });
  try{localStorage.setItem('projetta_modelos',JSON.stringify(nomes));}catch(e){}
  _applyModelosToSelect(_getModelosNomes());
  var msg=document.getElementById('mod-saved-msg');
  if(msg){msg.style.display='block';setTimeout(function(){msg.style.display='none';},2500);}
}

function adicionarModelo(){
  var codes=_getModelosCodes();
  // Find next number
  var max=0;
  codes.forEach(function(c){var n=parseInt(c,10);if(n>max)max=n;});
  var next=String(max+1).padStart(2,'0');
  var nomes=_getModelosNomes();
  nomes[next]='Novo modelo '+next;
  try{localStorage.setItem('projetta_modelos',JSON.stringify(nomes));}catch(e){}
  renderModelos();
  _applyModelosToSelect(nomes);
  // Scroll to new row
  var row=document.getElementById('mod-row-'+next);
  if(row)row.scrollIntoView({behavior:'smooth',block:'center'});
}

function deletarModelo(code){
  if(_MODELOS_FIXED_CODES.indexOf(code)!==-1) return;
  if(!confirm('Excluir modelo '+code+'? Essa ação não pode ser desfeita.'))return;
  var nomes=_getModelosNomes();
  delete nomes[code];
  try{
    localStorage.setItem('projetta_modelos',JSON.stringify(nomes));
    localStorage.removeItem('projetta_modelo_img_'+code);
    localStorage.removeItem('projetta_modelo_img_'+code+'_2fls');
    delete _modeloImgCache[code];
    delete _modeloImgCache2fls[code];
    fetch(_SB_URL+'/rest/v1/configuracoes?chave=eq.modelo_img_'+code,{method:'DELETE',
      headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY}}).catch(function(){});
    fetch(_SB_URL+'/rest/v1/configuracoes?chave=eq.modelo_img_'+code+'_2fls',{method:'DELETE',
      headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY}}).catch(function(){});
  }catch(e){}
  renderModelos();
  _applyModelosToSelect(nomes);
}

// ── IMAGENS DOS MODELOS ──
function carregarImagemModelo(code,input,variant){
  variant = variant || '1fl';  // retrocompatível: sem variant = 1fl
  console.log('📷 carregarImagemModelo code='+code+' variant='+variant);
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var MAX_W=400,MAX_H=800;
      var w=img.width,h=img.height;
      if(w>MAX_W){h=Math.round(h*(MAX_W/w));w=MAX_W;}
      if(h>MAX_H){w=Math.round(w*(MAX_H/h));h=MAX_H;}
      var canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      var dataUrl=canvas.toDataURL('image/jpeg',0.7);
      console.log('📷 Imagem comprimida: '+Math.round(dataUrl.length/1024)+'KB ('+variant+')');
      if(variant==='2fls'){ _modeloImgCache2fls[code]=dataUrl; }
      else                { _modeloImgCache[code]=dataUrl; }
      _aplicarImagemModelo(code,dataUrl,variant);
      _saveModeloImgCloud(code,dataUrl,variant);
      var sel=document.getElementById('carac-modelo');
      if(sel&&sel.value===code)_atualizarImagemCarac(code);
      _syncModeloImgProposta();
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
  input.value='';
}

// ── Supabase: salvar imagem ──
function _saveModeloImgCloud(code,dataUrl,variant){
  variant = variant || '1fl';
  var key = 'modelo_img_'+code + (variant==='2fls' ? '_2fls' : '');
  fetch(_SB_URL+'/rest/v1/configuracoes',{method:'POST',
    headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY,
      'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify({chave:key,valor:{img:dataUrl,ts:new Date().toISOString()}})
  }).then(function(r){
    if(!r.ok) console.warn('Erro salvar img modelo '+code+' ('+variant+'):',r.status);
    else console.log('✅ Img modelo '+code+' ('+variant+') salva no Supabase');
  }).catch(function(e){console.warn('Erro rede img modelo:',e);});
}

// ── Supabase: carregar todas imagens ──
function _loadAllModeloImgsCloud(codes){
  console.log('☁️ Buscando imagens do Supabase...');
  fetch(_SB_URL+'/rest/v1/configuracoes?chave=like.modelo_img_*&select=chave,valor',
    {headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY}})
  .then(function(r){console.log('☁️ Supabase resp status:',r.status);return r.json();})
  .then(function(rows){
    console.log('☁️ Supabase retornou '+(rows?rows.length:0)+' registros de imagens');
    if(rows&&rows.length){
      rows.forEach(function(row){
        if(!row.chave||!row.valor||!row.valor.img)return;
        // chave pode ser 'modelo_img_02' (1fl) ou 'modelo_img_02_2fls' (2fls)
        var raw = row.chave.replace('modelo_img_','');
        var is2fls = /_2fls$/.test(raw);
        var c = is2fls ? raw.replace(/_2fls$/,'') : raw;
        if(is2fls){ _modeloImgCache2fls[c]=row.valor.img; _aplicarImagemModelo(c,row.valor.img,'2fls'); }
        else     { _modeloImgCache[c]=row.valor.img;     _aplicarImagemModelo(c,row.valor.img,'1fl'); }
      });
    }
    _migrateLocalImgsToCloud(codes);
  }).catch(function(e){
    console.warn('Erro carregar imgs Supabase:',e);
    codes.forEach(function(c){
      try{
        var d=localStorage.getItem('projetta_modelo_img_'+c);
        if(d){_modeloImgCache[c]=d;_aplicarImagemModelo(c,d,'1fl');}
        var d2=localStorage.getItem('projetta_modelo_img_'+c+'_2fls');
        if(d2){_modeloImgCache2fls[c]=d2;_aplicarImagemModelo(c,d2,'2fls');}
      }catch(ex){}
    });
  });
}

// ── Migração localStorage → Supabase (uma vez) ──
function _migrateLocalImgsToCloud(codes){
  codes.forEach(function(c){
    try{
      var d=localStorage.getItem('projetta_modelo_img_'+c);
      if(d&&!_modeloImgCache[c]){
        _modeloImgCache[c]=d;_aplicarImagemModelo(c,d,'1fl');
        _saveModeloImgCloud(c,d,'1fl');
        console.log('Migrado img modelo '+c+' (1fl) → Supabase');
      }
      if(d) localStorage.removeItem('projetta_modelo_img_'+c);
      // 2 folhas
      var d2=localStorage.getItem('projetta_modelo_img_'+c+'_2fls');
      if(d2&&!_modeloImgCache2fls[c]){
        _modeloImgCache2fls[c]=d2;_aplicarImagemModelo(c,d2,'2fls');
        _saveModeloImgCloud(c,d2,'2fls');
        console.log('Migrado img modelo '+c+' (2fls) → Supabase');
      }
      if(d2) localStorage.removeItem('projetta_modelo_img_'+c+'_2fls');
    }catch(ex){}
  });
}

function removerImagemModelo(code,variant){
  variant = variant || '1fl';
  var sufix = variant==='2fls' ? '_2fls' : '';
  if(variant==='2fls') delete _modeloImgCache2fls[code];
  else                 delete _modeloImgCache[code];
  try{localStorage.removeItem('projetta_modelo_img_'+code+sufix);}catch(e){}
  _aplicarImagemModelo(code,null,variant);
  fetch(_SB_URL+'/rest/v1/configuracoes?chave=eq.modelo_img_'+code+sufix,{method:'DELETE',
    headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY}}).catch(function(){});
  var sel=document.getElementById('carac-modelo');
  if(sel&&sel.value===code)_atualizarImagemCarac(code);
  _syncModeloImgProposta();
}

function _syncModeloImgProposta(){
  var caracMod=document.getElementById('carac-modelo');
  var modVal=caracMod?caracMod.value:'';
  var propImg=document.getElementById('prop-img-porta');
  var propPh=document.getElementById('prop-img-porta-ph');
  if(!propImg||!propPh)return;
  var nFol=parseInt((document.getElementById('folhas-porta')||{value:'1'}).value)||1;
  var customImg = (nFol===2 && _modeloImgCache2fls[modVal]) ? _modeloImgCache2fls[modVal] : (_modeloImgCache[modVal]||null);
  if(modVal&&(customImg||(typeof MODEL_IMGS!=='undefined'&&MODEL_IMGS[modVal]))){
    propImg.src=customImg||(typeof MODEL_IMGS!=='undefined'?MODEL_IMGS[modVal]:'');
    propImg.style.display='';propPh.style.display='none';
  }else{propImg.style.display='none';propPh.style.display='';}
}

function _aplicarImagemModelo(code,dataUrl,variant){
  variant = variant || '1fl';
  var sufixId = variant==='2fls' ? '-2fls' : '';
  var img=document.getElementById('mod-img'+sufixId+'-'+code);
  var ph =document.getElementById('mod-img-placeholder'+sufixId+'-'+code);
  var del=document.getElementById('mod-img-del'+sufixId+'-'+code);
  if(!img)return;
  if(dataUrl){img.src=dataUrl;img.style.display='block';if(ph)ph.style.display='none';if(del)del.style.display='';}
  else{img.src='';img.style.display='none';if(ph)ph.style.display='flex';if(del)del.style.display='none';}
}

function _atualizarImagemCarac(code){
  var el=document.getElementById('carac-modelo-img');if(!el)return;
  var nFol=parseInt((document.getElementById('folhas-porta')||{value:'1'}).value)||1;
  // Prioriza 2fls se porta de 2 folhas e existe; fallback para 1fl
  var d = (nFol===2 && _modeloImgCache2fls[code]) ? _modeloImgCache2fls[code] : (_modeloImgCache[code]||null);
  if(d){el.src=d;el.style.display='';}else{el.src='';el.style.display='none';}
}

function loadModeloImagens(){
  // handled by renderModelos → _loadAllModeloImgsCloud
}

/* ── Zoom lightbox for model images ── */
function zoomModelImg(img){
  if(!img.src||img.style.display==='none')return;
  var ov=document.getElementById('mod-zoom-overlay');
  if(!ov){
    ov=document.createElement('div');ov.id='mod-zoom-overlay';
    ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
    ov.onclick=function(){ov.style.display='none';};
    var im=document.createElement('img');im.id='mod-zoom-img';
    im.style.cssText='max-width:90vw;max-height:90vh;border-radius:10px;box-shadow:0 4px 30px rgba(0,0,0,.6)';
    ov.appendChild(im);document.body.appendChild(ov);
  }
  document.getElementById('mod-zoom-img').src=img.src;
  ov.style.display='flex';
}
/* ══ END MODULE: MODELOS ══ */
