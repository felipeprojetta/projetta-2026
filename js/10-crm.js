/**
 * 10-crm.js
 * Module: CRM
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: CRM ══ */
(function(){
var CK='projetta_crm_v1', SK='projetta_crm_settings_v1';
var _editId=null, _view='kanban', _scope='nacional', _stageId=null, _dragId=null;

/* ── Defaults ──────────────────────────────────── */
var D_STAGES=[
  {id:'s2',label:'Qualificação',color:'#3498db',icon:'🔍'},
  {id:'s3',label:'Fazer Orçamento',color:'#e67e22',icon:'📋'},
  {id:'s3b',label:'Orçamento Pronto',color:'#f39c12',icon:'📧'},
  {id:'s4',label:'Proposta Enviada',color:'#9b59b6',icon:'📤'},
  {id:'s5',label:'Negociação',color:'#e74c3c',icon:'🤝'},
  {id:'s6',label:'Fechado Ganho',color:'#27ae60',icon:'🏆'},
  {id:'s7',label:'Perdido',color:'#7f8c8d',icon:'💔'},
];
var D_ORIGINS=['Weiku do Brasil','WhatsApp','Instagram','Indicação','Parceiro','Digital','Prospecção Ativa','Retorno','Licitação','Feira / Evento','Site'];
var D_PRODUCTS=['Porta ACM Pivotante','Porta ACM de Giro','Fachada ACM','Janela ACM','Revestimento ACM','Cobertura ACM','Projeto Especial'];
var D_TEAM=[
  {name:'ANDRESSA BACHUR LIMA',color:'#9b59b6'},
  {name:'THAYS AGUIAR DOS SANTOS',color:'#27ae60'},
  {name:'FELIPE XAVIER DE LIMA',color:'#003144'},
];

/* ── Settings ───────────────────────────────────── */
function gS(){try{return JSON.parse(localStorage.getItem(SK))||{};}catch(e){return{};}}
function sS(s){localStorage.setItem(SK,JSON.stringify(s));}
function gStages(){
  var s=gS();
  var st=(s.stages||[]).length?s.stages:D_STAGES;
  // Migrar: remover Prospecção (s1) se ainda existir nos salvos
  var had=st.length;
  st=st.filter(function(x){return x.id!=='s1';});
  if(st.length<had){s.stages=st;sS(s);}
  return st;
}
function gOrigins(){var s=gS();return(s.origins||[]).length?s.origins:D_ORIGINS;}
function gProducts(){var s=gS();return(s.products||[]).length?s.products:D_PRODUCTS;}
function gTeam(){var s=gS();return(s.team||[]).length?s.team:D_TEAM;}
function gWReps(){var s=gS();return(s.wreps||[]).length?s.wreps:D_WREPS;}
var D_WREPS=['Adalberto Fanderuff','Adriana Karen de Souza','Adriano Dorigon','Alessandra R. Wihby (MT_ARWC)','Ampliar GO','Camila Vitorassi Preve','Carina Ap. Kazahaya (KAR)','Centenário SP','CRJ','D&A','Diego Luiz Frigeri (Solaris)','Dion Lenon Hernandes','Ericson Venancio dos Santos','Felipe Xavier','Gervásio Santa Rosa','Gustavo Guarenghi (Qualitá 4)','Igor Lopes de Almeida (Lidere MT)','Emily Rocha (Qualitá 3)','João de Lara (Qualitá 5)','Jhonathan S. Matos (Central Coberturas)','Julia Lemes','Leonardo Guarenghi','Luana F. Silveira','Luciane C. de Grabalos (Euro)','Luiz Fernando Starke','Luiz Severino Moretto','Marcelo Abarca de Oliveira','Márcio Daniel Gnigler (MDG)','Nelson E. Colantuano','Primeira Linha MS','Rafael C. Jung Sperotto (Fazsol)','Rodrigo Aguiar Diniz','Ronei de Jesus Lyra','Rosa Madeiras Limeira','Rubens A. Grando Postali (Elo Forte)','Simone Fraga / Deise (Tuti)','Thays (Comercial)'];

/* ── CRM Data ────────────────────────────────────── */
function cLoad(){
  try{
    var data = JSON.parse(localStorage.getItem(CK))||[];
    // Migração silenciosa p/ estrutura opcoes[]. Idempotente, não-destrutiva.
    // Cards sem opcoes[] ganham opt1 contendo suas revisoes atuais.
    if(window.OrcamentoOpcoes){
      for(var i=0;i<data.length;i++){
        try{ window.OrcamentoOpcoes.migrar(data[i]); }catch(e){}
      }
    }
    // ★ Auto-corrigir scope (Felipe 20/04): cards com sinais fortes de intl
    //   mas scope!='internacional' recebem o scope certo. Idempotente.
    //   Evita bug de kanban/KPI/filtro tratarem como nacional.
    var _mig = false;
    for(var j=0;j<data.length;j++){
      var o = data[j];
      if(!o) continue;
      var _sinalIntl = (o.inst_quem||'').toUpperCase()==='INTERNACIONAL'
                    || ['CIF','FOB','EXW'].indexOf((o.inst_incoterm||'').toUpperCase())>=0;
      if(_sinalIntl && o.scope!=='internacional'){
        o.scope='internacional';
        _mig=true;
      }
    }
    if(_mig){
      try{ localStorage.setItem(CK, JSON.stringify(data)); }catch(e){}
    }
    return data;
  }catch(e){ return []; }
}
function cSave(d){
  // ★ Cloud-first (Felipe 20/04): Supabase é fonte da verdade, localStorage
  //   é cache rápido. Se quota estourar, descarta pesados progressivamente.
  try{
    // Antes de serializar: garante que opcoes[ativa].revisoes contém
    // o conteúdo atual de card.revisoes (caso alguém tenha feito
    // reatribuição total ao invés de push/splice na referência).
    if(window.OrcamentoOpcoes && Array.isArray(d)){
      for(var pi=0;pi<d.length;pi++){
        try{ window.OrcamentoOpcoes.persistir(d[pi]); }catch(e){}
      }
    }
    localStorage.setItem(CK,JSON.stringify(d));
  }catch(e){
    if(e && (e.name==='QuotaExceededError' || e.code===22 || e.code===1014 || /quota/i.test(e.message||''))){
      console.warn('[cSave] quota estourou — tentando descarte em camadas');

      // CAMADA 1: remover pdfThumbs (pesados, tem cópia no Supabase como pdfCloud)
      var lite1 = d.map(function(o){
        var c = JSON.parse(JSON.stringify(o));
        if(Array.isArray(c.revisoes)) c.revisoes.forEach(function(r){ delete r.pdfThumb; });
        if(Array.isArray(c.opcoes)) c.opcoes.forEach(function(op){
          if(Array.isArray(op.revisoes)) op.revisoes.forEach(function(r){ delete r.pdfThumb; });
        });
        return c;
      });
      try { localStorage.setItem(CK, JSON.stringify(lite1)); }
      catch(e2){
        // CAMADA 2: remover anexos pesados também
        console.warn('[cSave] camada 1 não bastou — descartando anexos');
        var lite2 = lite1.map(function(o){
          var c = Object.assign({}, o);
          if(c.anexos && c.anexos.length>0){
            c.anexos = c.anexos.map(function(a){ return {name:a.name, type:a.type, date:a.date}; });
          }
          return c;
        });
        try { localStorage.setItem(CK, JSON.stringify(lite2)); }
        catch(e3){
          // CAMADA 3: limpar projetta_v3 (5MB legado) + retry
          console.warn('[cSave] camada 2 não bastou — removendo projetta_v3 legado');
          try { localStorage.removeItem('projetta_v3'); } catch(e){}
          // E qualquer freeze_* local (estão no Supabase)
          try {
            for(var i=localStorage.length-1; i>=0; i--){
              var k = localStorage.key(i);
              if(k && (/^freeze_/.test(k) || /^proposta_img_/.test(k))){
                localStorage.removeItem(k);
              }
            }
          } catch(e){}
          try { localStorage.setItem(CK, JSON.stringify(lite2)); }
          catch(e4){
            console.error('[cSave] nem descartando tudo coube. Dados continuam no Supabase.');
          }
        }
      }
    }
  }

  // Cloud sync — Supabase Projetta (SEMPRE, independente de sucesso local)
  var SB='https://plmliavuwlgpwaizfeds.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var cloudData=d.map(function(o){var c=Object.assign({},o);delete c.anexos;return c;});
  // [LEGADO] Blob único — mantido como fallback durante transição para schema relacional
  fetch(SB+'/rest/v1/configuracoes',{method:'POST',
    headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify({chave:CK,valor:{db:cloudData,ts:new Date().toISOString()}})
  }).catch(function(){});
  // [NOVO] Writes granulares para crm_oportunidades / crm_revisoes / crm_eventos
  // Debounce para não disparar a cada pequena mudança dentro de uma mesma operação
  try{
    if(window.crmDB&&window.crmDB.syncFromBlob){
      clearTimeout(window._crmDB_syncTimer);
      window._crmDB_syncTimer=setTimeout(function(){
        window.crmDB.syncFromBlob(d).catch(function(e){console.warn('crmDB sync:',e);});
      },400);
    }
  }catch(e){console.warn('crmDB hook:',e);}
}
function cCloudLoad(cb){
  var SB='https://plmliavuwlgpwaizfeds.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  fetch(SB+'/rest/v1/configuracoes?chave=eq.'+CK+'&select=valor&limit=1',
    {headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}})
    .then(function(r){return r.json();})
    .then(function(rows){cb(rows&&rows.length?rows[0].valor:null);})
    .catch(function(){cb(null);});
}

/* ── Helpers ────────────────────────────────────── */
function uuid(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function brl(v){return('R$ '+_fmtBRLCeil(v));}
function dateLabel(s){if(!s)return'';var d=new Date(s+'T00:00:00');return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});}
function isThisMonth(s){if(!s)return false;var d=new Date(s),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}
function daysFrom(s){if(!s)return 999;return Math.ceil((new Date(s+'T00:00:00')-new Date())/(1000*86400));}
function escH(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function el(id){return document.getElementById(id);}
function val(id){return(el(id)||{}).value||'';}
function setVal(id,v){var e=el(id);if(e)e.value=v||'';}

/* ★ Helpers de data BR (Felipe 20/04) ─────────────────────────────────
   ISO = 'YYYY-MM-DD' (interno, compat com input type=date)
   BR  = 'DD/MM/AAAA' (display)
   Aceita tb input com time (ISO8601) — so leva em conta a data.
   ─────────────────────────────────────────────────────────────────── */
function isoToBR(iso){
  if(!iso) return '';
  var s = String(iso).slice(0,10); // pega YYYY-MM-DD mesmo se vier com time
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  var p = s.split('-');
  return p[2]+'/'+p[1]+'/'+p[0];
}
function brToIso(br){
  if(!br) return '';
  var m = String(br).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m) return '';
  return m[3]+'-'+m[2]+'-'+m[1];
}

/* ★ MES FISCAL PROJETTA (Felipe 20/04):
   O mes fiscal comeca dia 16 e termina dia 15 do mes seguinte.
   Ex: "Mes fiscal Abril" = 16/04 até 15/05.
   Usado pra filtrar Pipeline, Ganhos Mes, etc. */
function _mesFiscalAtual(){
  var hoje = new Date();
  var dia = hoje.getDate();
  var mes = hoje.getMonth(); // 0-11
  var ano = hoje.getFullYear();
  // Se estamos do dia 16 ao final do mes, o mes fiscal e o mes atual.
  // Se estamos do dia 1 ao 15, ainda estamos no mes fiscal ANTERIOR.
  if(dia < 16){
    mes -= 1;
    if(mes < 0){ mes = 11; ano -= 1; }
  }
  return {mes: mes, ano: ano};
}

/* Retorna intervalo ISO {de, ate} (inclusivo) do mes fiscal dado.
   mesFiscal: objeto {mes: 0-11, ano: YYYY}
   Ex: abril/2026 → de=2026-04-16, ate=2026-05-15 */
function _intervaloMesFiscal(mesFiscal){
  var m = mesFiscal.mes;
  var a = mesFiscal.ano;
  var de = new Date(a, m, 16);
  var mNext = m + 1, aNext = a;
  if(mNext > 11){ mNext = 0; aNext = a + 1; }
  var ate = new Date(aNext, mNext, 15);
  var pad = function(n){ return n<10 ? '0'+n : ''+n; };
  return {
    de:  de.getFullYear()+'-'+pad(de.getMonth()+1)+'-'+pad(de.getDate()),
    ate: ate.getFullYear()+'-'+pad(ate.getMonth()+1)+'-'+pad(ate.getDate())
  };
}

/* ★ Felipe 21/04: label PT-BR curto de um mes fiscal {mes,ano}.
   Ex: {mes:0, ano:2026} → 'jan/26' */
function _mesFiscalBR(mf){
  var NOMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return NOMES[mf.mes] + '/' + String(mf.ano).slice(-2);
}

/* ★ Popular o <select id=ck-gain-mes-sel> com os ultimos 24 meses
   fiscais (passado → presente + futuro-1). Idempotente: re-popula so
   se estiver vazio. */
function _popularGanhoMesSelect(mesAtual){
  var sel = el('ck-gain-mes-sel');
  if(!sel) return;
  if(sel.options.length > 0) return;
  // Gerar 24 meses: 18 passados + atual + 5 futuros
  var opcoes = [];
  var base = new Date(mesAtual.ano, mesAtual.mes, 1);
  for(var i = -18; i <= 5; i++){
    var d = new Date(base.getFullYear(), base.getMonth()+i, 1);
    var val = d.getFullYear()+'-'+(d.getMonth()<9?'0':'')+(d.getMonth()+1);
    var lbl = _mesFiscalBR({mes: d.getMonth(), ano: d.getFullYear()});
    opcoes.push({val: val, lbl: lbl, isAtual: i===0});
  }
  // Ordem: mais recente primeiro
  opcoes.reverse();
  // Construir options
  var _escolhido = localStorage.getItem('projetta_ganho_mes_sel') || '';
  opcoes.forEach(function(op){
    var o = document.createElement('option');
    o.value = op.val;
    o.textContent = op.lbl + (op.isAtual ? ' (atual)' : '');
    if(op.val === _escolhido || (!_escolhido && op.isAtual)) o.selected = true;
    sel.appendChild(o);
  });
}

/* ★ Popular o <select id=ck-gain-ano-sel> com anos de 2022 ao atual+1. */
function _popularGanhoAnoSelect(anoAtual){
  var sel = el('ck-gain-ano-sel');
  if(!sel) return;
  if(sel.options.length > 0) return;
  var _escolhido = parseInt(localStorage.getItem('projetta_ganho_ano_sel'))||0;
  var anos = [];
  for(var y = anoAtual+1; y >= 2022; y--) anos.push(y);
  anos.forEach(function(a){
    var o = document.createElement('option');
    o.value = a;
    o.textContent = a + (a===anoAtual ? ' (atual)' : '');
    if(a === _escolhido || (!_escolhido && a===anoAtual)) o.selected = true;
    sel.appendChild(o);
  });
}

/* ★ Handlers onchange dos dropdowns de Ganho Mes/Ano. Salvam no
   localStorage e re-renderizam os KPIs. */
window.crmGainMesChange = function(){
  var sel = el('ck-gain-mes-sel');
  if(!sel) return;
  var v = sel.value;
  if(v){
    localStorage.setItem('projetta_ganho_mes_sel', v);
  } else {
    localStorage.removeItem('projetta_ganho_mes_sel');
  }
  // Re-render KPIs apenas (sem re-render do kanban completo)
  try { crmRender(); } catch(e){}
};
window.crmGainAnoChange = function(){
  var sel = el('ck-gain-ano-sel');
  if(!sel) return;
  var v = parseInt(sel.value)||0;
  if(v){
    localStorage.setItem('projetta_ganho_ano_sel', v);
  } else {
    localStorage.removeItem('projetta_ganho_ano_sel');
  }
  try { crmRender(); } catch(e){}
};

/* Retorna {de, ate} conforme filtro selecionado. Null se 'total'. */
function _intervaloPeriodoFiltro(){
  var sel = el('crm-f-periodo-filter');
  var v = sel ? sel.value : 'total';
  var hoje = new Date();
  var pad = function(n){ return n<10 ? '0'+n : ''+n; };
  var iso = function(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };

  if(v === 'total') return null;

  if(v === 'mes-atual'){
    return _intervaloMesFiscal(_mesFiscalAtual());
  }
  if(v === 'mes-anterior'){
    var mf = _mesFiscalAtual();
    mf.mes -= 1;
    if(mf.mes < 0){ mf.mes = 11; mf.ano -= 1; }
    return _intervaloMesFiscal(mf);
  }
  if(v === 'ult3'){
    // 3 meses fiscais: comeco do mes-2 até fim do mes atual fiscal
    var mfAtual = _mesFiscalAtual();
    var mfInicio = {mes: mfAtual.mes - 2, ano: mfAtual.ano};
    while(mfInicio.mes < 0){ mfInicio.mes += 12; mfInicio.ano -= 1; }
    var iInicio = _intervaloMesFiscal(mfInicio);
    var iFim = _intervaloMesFiscal(mfAtual);
    return {de: iInicio.de, ate: iFim.ate};
  }
  if(v === 'ano-atual'){
    return {de: hoje.getFullYear()+'-01-01', ate: hoje.getFullYear()+'-12-31'};
  }
  if(v === 'ano-anterior'){
    var ya = hoje.getFullYear()-1;
    return {de: ya+'-01-01', ate: ya+'-12-31'};
  }
  if(v === 'personalizado'){
    var de = (el('crm-f-periodo-de')||{value:''}).value || '';
    var ate = (el('crm-f-periodo-ate')||{value:''}).value || '';
    if(!de && !ate) return null;
    return {de: de || '1900-01-01', ate: ate || '2099-12-31'};
  }
  return null;
}

/* Testa se uma data (ISO ou ISO com time) cai dentro de um intervalo. */
function _dataDentroDe(dataStr, intervalo){
  if(!intervalo) return true;
  if(!dataStr) return false;
  var d = String(dataStr).slice(0,10);
  return d >= intervalo.de && d <= intervalo.ate;
}

window.crmOnPeriodoChange = function(){
  var sel = el('crm-f-periodo-filter');
  var cust = el('crm-f-periodo-custom');
  if(sel && cust){
    cust.style.display = (sel.value === 'personalizado') ? 'flex' : 'none';
    // Pre-popular datas se personalizado ficou vazio
    if(sel.value === 'personalizado'){
      var deEl = el('crm-f-periodo-de');
      var ateEl = el('crm-f-periodo-ate');
      if(deEl && !deEl.value){
        // default: inicio do mes fiscal atual
        var mf = _intervaloMesFiscal(_mesFiscalAtual());
        deEl.value = mf.de;
        if(ateEl && !ateEl.value) ateEl.value = mf.ate;
      }
    }
  }
  crmRender();
};

/* ★ Felipe 20/04: helper pra pegar a 'data de referencia' de um card
   conforme o modo do select #crm-f-data-ref:
   - auto: fechamento_real p/ ganhos, createdAt p/ resto (padrao antigo)
   - chegada: sempre createdAt (quando o card foi criado no pipeline)
   - orcamento: data da ULTIMA revisao (quando o orc foi feito/atualizado)
   - contato: dataContato (1º contato com o cliente)
   - fechamento: fechamento_real (so faz sentido pra ganhos)
   Retorna string ISO ou '' se nao aplicavel. */
function _dataRefCard(o, modoOverride){
  if(!o) return '';
  var modo = modoOverride || (el('crm-f-data-ref')||{value:'auto'}).value;
  if(modo === 'chegada') return o.createdAt || o.updatedAt || '';
  if(modo === 'contato') return o.dataContato || o.createdAt || '';
  if(modo === 'fechamento') return o.fechamento_real || o.fechamento || '';
  if(modo === 'orcamento'){
    // ultima revisao da opcao ativa OU revisao mais recente
    var dt = '';
    if(Array.isArray(o.opcoes)){
      var opAtiva = o.opcoes.find(function(op){return op.ativa;}) || o.opcoes[0];
      if(opAtiva && Array.isArray(opAtiva.revisoes) && opAtiva.revisoes.length){
        dt = opAtiva.revisoes[opAtiva.revisoes.length-1].data || '';
      }
    }
    if(!dt && Array.isArray(o.revisoes) && o.revisoes.length){
      dt = o.revisoes[o.revisoes.length-1].data || '';
    }
    return dt || o.updatedAt || o.createdAt || '';
  }
  // auto (default)
  var stages = gStages();
  var wonIds = stages.filter(function(s){return /gan|won/i.test(s.label);}).map(function(s){return s.id;});
  if(wonIds.indexOf(o.stage) >= 0){
    return o.fechamento_real || o.fechamento || o.updatedAt || o.createdAt || '';
  }
  return o.createdAt || o.updatedAt || '';
}
window._dataRefCard = _dataRefCard;

/* ★ Modal de data de fechamento — usado ao arrastar card pra Ganho.
   Usa <input type="date"> nativo: browser mostra calendario localizado
   (pt-BR → DD/MM/AAAA) mas valor interno permanece ISO.
   valorInicial: ISO YYYY-MM-DD opcional, pra modo "editar data existente" */
function _abrirModalDataFechamento(clienteNome, onOk, onCancel, valorInicial){
  // Remover modal anterior se existir
  var prev = document.getElementById('modal-data-fech');
  if(prev) prev.remove();

  var hoje = new Date().toISOString().slice(0,10);
  var _default = (valorInicial && /^\d{4}-\d{2}-\d{2}$/.test(valorInicial)) ? valorInicial : hoje;
  var _ehEdicao = !!valorInicial;
  var overlay = document.createElement('div');
  overlay.id = 'modal-data-fech';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3200;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);animation:fadeIn .15s';

  overlay.innerHTML =
    '<div style="background:#fff;border-radius:12px;padding:24px 28px;max-width:440px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,.25)">'+
      '<div style="font-size:18px;font-weight:800;color:#003144;margin-bottom:4px">'+(_ehEdicao?'✎ Editar':'🏆')+' Data de Fechamento</div>'+
      '<div style="font-size:13px;color:#666;margin-bottom:16px">'+escH(clienteNome)+'</div>'+
      '<label style="font-size:12px;font-weight:700;color:#003144;text-transform:uppercase;letter-spacing:.04em">Data do Fechamento</label>'+
      '<input type="date" id="md-data-in" value="'+_default+'" max="'+hoje+'" style="width:100%;padding:10px 12px;margin-top:6px;border:1.5px solid #c9c6bf;border-radius:8px;font-size:15px;font-family:inherit;color:#003144;outline:none">'+
      '<div style="font-size:10px;color:#888;margin-top:4px;font-style:italic">Data real em que o contrato foi fechado (formato DD/MM/AAAA)</div>'+
      '<div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end">'+
        '<button id="md-cancel" style="padding:9px 18px;border-radius:8px;border:1.5px solid #ccc;background:#fff;color:#555;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Cancelar</button>'+
        '<button id="md-ok" style="padding:9px 22px;border-radius:8px;border:none;background:#27ae60;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">✓ Confirmar</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(overlay);

  var inp = document.getElementById('md-data-in');
  var btnOk = document.getElementById('md-ok');
  var btnCc = document.getElementById('md-cancel');
  // Focus auto pro user poder digitar / abrir calendario
  setTimeout(function(){ if(inp) inp.focus(); }, 50);

  function fechar(){ overlay.remove(); }
  function confirmar(){
    var v = (inp.value||'').trim();
    if(!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)){
      alert('Por favor selecione uma data valida.');
      return;
    }
    fechar();
    if(typeof onOk === 'function') onOk(v);
  }
  function cancelar(){
    fechar();
    if(typeof onCancel === 'function') onCancel();
  }
  btnOk.addEventListener('click', confirmar);
  btnCc.addEventListener('click', cancelar);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) cancelar(); });
  // Enter = confirmar, Esc = cancelar
  overlay.addEventListener('keydown', function(e){
    if(e.key==='Enter') confirmar();
    if(e.key==='Escape') cancelar();
  });
}

/* ★ Editar data de fechamento — chamada ao clicar na data do card Ganho
   ou no botao "Definir data de fechamento" quando o card nao tem data. */
window.crmEditarDataFech=function(cardId){
  var data = cLoad();
  var idx = data.findIndex(function(o){return o.id===cardId;});
  if(idx<0) return;
  var cli = data[idx].cliente||'Cliente';
  // Pegar data existente (real > legado) pra pre-preencher no modal
  var dataExistente = data[idx].fechamento_real || data[idx].fechamento || '';
  if(dataExistente) dataExistente = String(dataExistente).slice(0,10);
  _abrirModalDataFechamento(cli, function(dataIso){
    if(!dataIso) return;
    data[idx].fechamento_real = dataIso;
    data[idx].fechamento = dataIso; // compat legado
    // NAO atualizar updatedAt — pra nao poluir KPI de ganhos mes
    cSave(data);
    crmRender();
  }, null, dataExistente);
};

function nameColor(name){
  var t=gTeam();var m=t.find(function(x){return x.name===name;});
  if(m)return m.color;
  var c=['#003144','#9b59b6','#27ae60','#e67e22','#2980b9'],h=0;
  for(var i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))&0xFFFFFF;
  return c[Math.abs(h)%c.length];
}

/* ★ Felipe 20/04: valor REAL do card em R$.
   - Nacional: retorna valorFaturamento (ou fallback).
   - Internacional: soma Porta + Instalação + Logística (caixa+fretes).
   Usado no breakdown do card, header das colunas e KPIs. */
function _valorRealCardBRL(o){
  if(!o) return 0;
  var _vPorta = parseFloat(o.valorFaturamento) || parseFloat(o.valorTabela) || parseFloat(o.valor) || 0;
  // Detectar intl por multiplos sinais (scope pode nao estar salvo em cards antigos)
  var _ehIntl = o.scope === 'internacional'
             || (o.inst_quem||'').toUpperCase() === 'INTERNACIONAL'
             || ['CIF','FOB','EXW'].indexOf((o.inst_incoterm||'').toUpperCase()) >= 0
             || !!(o.pais||'').trim();
  if(!_ehIntl) return _vPorta;
  // Internacional
  var _cambio = parseFloat(o.inst_cambio) || 5.20;
  // Instalação: valor salvo OU recalcular
  var _vInst = parseFloat(o.inst_intl_fat) || 0;
  if(_vInst === 0){
    var _passagem = parseFloat(o.inst_passagem) || 0;
    var _hotel = parseFloat(o.inst_hotel) || 0;
    var _alim = parseFloat(o.inst_alim) || 0;
    var _udigru = parseFloat(o.inst_udigru) || 0;
    if((_passagem + _hotel + _alim + _udigru) > 0){
      var _seg = parseFloat(o.inst_seguro) || 0;
      var _carro = parseFloat(o.inst_carro) || 0;
      var _mo = parseFloat(o.inst_mo) || 0;
      var _pes = parseInt(o.inst_pessoas) || 3;
      var _di = parseInt(o.inst_dias) || 3;
      var _dT = _di + 4; var _dH = _dT - 2;
      var _mg = parseFloat(o.inst_margem) || 10;
      var _custo = _udigru + (_passagem*_pes) + (_hotel*_dH) + (_alim*_pes*_dT) + (_seg*_pes) + (_carro*_dT) + (_mo*_dT);
      _vInst = _custo / Math.max(0.01, 1 - _mg/100);
    }
  }
  // Logística
  var _inc = (o.inst_incoterm||'').toUpperCase();
  var _logUsd = 0;
  if(_inc==='CIF' || _inc==='FOB'){
    var _L = parseFloat(o.cif_caixa_l)||0;
    var _A = parseFloat(o.cif_caixa_a)||0;
    var _E = parseFloat(o.cif_caixa_e)||0;
    var _tx = parseFloat(o.cif_caixa_taxa)||100;
    _logUsd += (_L/1000)*(_A/1000)*(_E/1000) * _tx;
    _logUsd += parseFloat(o.cif_frete_terrestre)||0;
  }
  if(_inc==='CIF'){
    _logUsd += parseFloat(o.cif_frete_maritimo)||0;
  }
  return _vPorta + _vInst + (_logUsd * _cambio);
}
window._valorRealCardBRL = _valorRealCardBRL;

/* ── KPIs ────────────────────────────────────────── */
function updateKPIs(all){
  var stages=gStages();
  var wonIds=stages.filter(function(s){return/gan|won/i.test(s.label);}).map(function(s){return s.id;});
  var lostIds=stages.filter(function(s){return/perd|lost/i.test(s.label);}).map(function(s){return s.id;});

  // ★ Felipe 20/04: filtro de periodo (mes fiscal 16→15, ano, personalizado).
  //   - Ganhos filtram por fechamento_real (data real do contrato).
  //   - Ativos/pipeline filtram por createdAt (quando a oportunidade foi criada).
  //   - Se periodo='total', intervalo=null e tudo passa.
  var _intervalo = typeof _intervaloPeriodoFiltro === 'function' ? _intervaloPeriodoFiltro() : null;
  var _labelPeriodo = '';
  if(_intervalo){
    _labelPeriodo = isoToBR(_intervalo.de)+'–'+isoToBR(_intervalo.ate);
  }

  var ativosTodos=all.filter(function(o){return wonIds.indexOf(o.stage)<0&&lostIds.indexOf(o.stage)<0;});
  var ganhosTodos=all.filter(function(o){return wonIds.indexOf(o.stage)>=0;});
  var perdidosTodos=all.filter(function(o){return lostIds.indexOf(o.stage)>=0;});

  // Aplicar filtro de periodo usando data de referencia do select
  var ativos = _intervalo
    ? ativosTodos.filter(function(o){return _dataDentroDe(_dataRefCard(o), _intervalo);})
    : ativosTodos;
  var ganhos = _intervalo
    ? ganhosTodos.filter(function(o){return _dataDentroDe(_dataRefCard(o), _intervalo);})
    : ganhosTodos;
  var perdidos = _intervalo
    ? perdidosTodos.filter(function(o){return _dataDentroDe(_dataRefCard(o), _intervalo);})
    : perdidosTodos;

  // ★ Felipe 20/04: 'Ganho Mês' e 'Ganho Ano' SEMPRE FIXOS — NAO reagem ao
  //   filtro de periodo. Usam SEMPRE fechamento_real (data real do contrato).
  //   Garante que no topo sempre ficam visiveis os numeros do mes fiscal
  //   atual (16→15) e do ano corrente, independente do filtro selecionado.
  // ★ Felipe 21/04: agora o usuario pode ESCOLHER qual mes/ano ver via
  //   dropdown no proprio card (localStorage persiste a escolha). Se a
  //   key nao existir, usa mes fiscal atual / ano atual (padrao).
  var _hoje = new Date();
  var _anoAtual = _hoje.getFullYear();
  var _mesFiscAtual = _mesFiscalAtual();

  // Popular dropdowns se ainda vazios
  _popularGanhoMesSelect(_mesFiscAtual);
  _popularGanhoAnoSelect(_anoAtual);

  // Ler escolha do usuario (ou usar atual como default)
  var _mesEscolhidoStr = localStorage.getItem('projetta_ganho_mes_sel') || '';
  var _anoEscolhido    = parseInt(localStorage.getItem('projetta_ganho_ano_sel'))||0;

  var _mesFiscUsado;
  if(_mesEscolhidoStr && /^\d{4}-\d{2}$/.test(_mesEscolhidoStr)){
    var _parts = _mesEscolhidoStr.split('-');
    _mesFiscUsado = {mes: parseInt(_parts[1])-1, ano: parseInt(_parts[0])};
  } else {
    _mesFiscUsado = _mesFiscAtual;
  }
  if(!_anoEscolhido) _anoEscolhido = _anoAtual;

  var _intervaloMesFisc = _intervaloMesFiscal(_mesFiscUsado);
  var _intervaloAno = {de: _anoEscolhido+'-01-01', ate: _anoEscolhido+'-12-31'};

  var ganhosMes = ganhosTodos.filter(function(o){
    var dt = o.fechamento_real || o.fechamento || o.updatedAt || o.createdAt;
    return _dataDentroDe(dt, _intervaloMesFisc);
  });
  var ganhosAno = ganhosTodos.filter(function(o){
    var dt = o.fechamento_real || o.fechamento || o.updatedAt || o.createdAt;
    return _dataDentroDe(dt, _intervaloAno);
  });

  var intl=all.filter(function(o){return o.scope==='internacional';});
  var pipe=ativos.reduce(function(s,o){return s+_valorRealCardBRL(o);},0);
  var gMes=ganhosMes.reduce(function(s,o){return s+_valorRealCardBRL(o);},0);
  var gAno=ganhosAno.reduce(function(s,o){return s+_valorRealCardBRL(o);},0);
  var ativosComValor=ativos.filter(function(o){return _valorRealCardBRL(o)>0;});
  var ticket=ativosComValor.length>0?pipe/ativosComValor.length:0;
  var conv=(ganhos.length+perdidos.length)>0?Math.round(ganhos.length/(ganhos.length+perdidos.length)*100):0;
  if(el('ck-pipe')){el('ck-pipe').textContent=brl(pipe);el('ck-pipe-s').textContent=ativos.length+' ativas'+(_labelPeriodo?' · '+_labelPeriodo:'');}
  if(el('ck-gain')){
    el('ck-gain').textContent=brl(gMes);
    var _isAtual = _mesFiscUsado.mes === _mesFiscAtual.mes && _mesFiscUsado.ano === _mesFiscAtual.ano;
    var _labelM = _isAtual ? 'mês fiscal atual' : _mesFiscalBR(_mesFiscUsado);
    el('ck-gain-s').textContent=ganhosMes.length+' contratos · '+_labelM;
  }
  if(el('ck-gain-ano')){
    el('ck-gain-ano').textContent=brl(gAno);
    el('ck-gain-ano-s').textContent=ganhosAno.length+' contratos · ano '+_anoEscolhido;
  }
  if(el('ck-ticket'))el('ck-ticket').textContent=brl(ticket);
  var ckTicketSub=document.querySelector('#ck-ticket')&&document.querySelector('#ck-ticket').parentNode?document.querySelector('#ck-ticket').parentNode.querySelector('.crm-kpi-sub'):null;
  if(ckTicketSub) ckTicketSub.textContent=ativosComValor.length+' com valor';
  if(el('ck-conv'))el('ck-conv').textContent=conv+'%';
  if(el('ck-intl')){el('ck-intl').textContent=intl.length;el('ck-intl-s').textContent='internacional'+(intl.length!==1?'s':'');}
  // Total Tabela e Faturamento (ativas do periodo)
  var totTab=ativos.reduce(function(s,o){return s+(parseFloat(o.valorTabela)||0);},0);
  var totFat=ativos.reduce(function(s,o){return s+_valorRealCardBRL(o);},0);
  if(el('ck-tot-tab')){el('ck-tot-tab').textContent=brl(totTab);el('ck-tot-tab-s').textContent=ativos.filter(function(o){return o.valorTabela>0;}).length+' com tabela';}
  if(el('ck-tot-fat')){el('ck-tot-fat').textContent=brl(totFat);el('ck-tot-fat-s').textContent=ativos.filter(function(o){return(o.valorFaturamento||o.valor)>0;}).length+' com faturamento';}
  // Filters
  var resps=[...new Set(all.map(function(o){return o.responsavel;}).filter(Boolean))];
  var rs=el('crm-f-resp-filter');if(rs){var cv=rs.value;rs.innerHTML='<option value="">👤 Todos</option>';resps.forEach(function(r){var o=document.createElement('option');o.value=r;o.textContent=r;if(r===cv)o.selected=true;rs.appendChild(o);});}
  var origs=[...new Set(all.map(function(o){return o.origem;}).filter(Boolean))];
  var os=el('crm-f-origin-filter');if(os){var cv2=os.value;os.innerHTML='<option value="">🔖 Origem</option>';origs.forEach(function(r){var o=document.createElement('option');o.value=r;o.textContent=r;if(r===cv2)o.selected=true;os.appendChild(o);});}
  // Representante Weiku filter
  var wreps=[...new Set(all.map(function(o){return o.wrep;}).filter(Boolean))].sort();
  var ws=el('crm-f-wrep-filter');if(ws){var cv3=ws.value;ws.innerHTML='<option value="">🏢 Representante</option>';wreps.forEach(function(r){var o=document.createElement('option');o.value=r;o.textContent=r;if(r===cv3)o.selected=true;ws.appendChild(o);});}
  // Cidade filter
  var cidades=[...new Set(all.map(function(o){return o.cidade;}).filter(Boolean))].sort();
  var cs=el('crm-f-cidade-filter');if(cs){var cv4=cs.value;cs.innerHTML='<option value="">🏙 Cidade</option>';cidades.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;if(c===cv4)o.selected=true;cs.appendChild(o);});}
  // Estado filter
  var estados=[...new Set(all.map(function(o){return o.estado;}).filter(Boolean))].sort();
  var es=el('crm-f-estado-filter');if(es){var cv5=es.value;es.innerHTML='<option value="">📍 Estado</option>';estados.forEach(function(e){var o=document.createElement('option');o.value=e;o.textContent=e;if(e===cv5)o.selected=true;es.appendChild(o);});}
  // Cor filter (from itens cor_ext)
  var cores=[];all.forEach(function(o){if(o.cor_ext)cores.push(o.cor_ext);if(o.itens)o.itens.forEach(function(it){if(it.cor_ext)cores.push(it.cor_ext);});});
  cores=[...new Set(cores)].sort();
  var crs=el('crm-f-cor-filter');if(crs){var cv6=crs.value;crs.innerHTML='<option value="">🎨 Cor</option>';cores.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;if(c===cv6)o.selected=true;crs.appendChild(o);});}
  // Modelo filter (from itens modelo)
  var modelos=[];all.forEach(function(o){if(o.modelo)modelos.push(o.modelo);if(o.itens)o.itens.forEach(function(it){if(it.modelo)modelos.push(it.modelo);});});
  modelos=[...new Set(modelos)].sort(function(a,b){return(parseInt(a)||99)-(parseInt(b)||99);});
  var ms=el('crm-f-modelo-filter');if(ms){var cv7=ms.value;ms.innerHTML='<option value="">📐 Modelo</option>';modelos.forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent='Mod. '+m;if(m===cv7)o.selected=true;ms.appendChild(o);});}
}

/* ── Render ──────────────────────────────────────── */
window.crmRender=function(){
  var all=cLoad();
  // Migrar cards s1 (Prospecção removida) → s2 (Qualificação)
  var _mig=false;all.forEach(function(o){if(o.stage==='s1'){o.stage='s2';_mig=true;}});if(_mig)cSave(all);
  var q=(val('crm-search')).toLowerCase();
  var fR=val('crm-f-resp-filter'),fO=val('crm-f-origin-filter'),fS=val('crm-f-scope-filter');
  var fReg=val('crm-f-regiao-filter'),fGer=val('crm-f-gerente-filter'),fWrep=val('crm-f-wrep-filter');
  var fCidade=val('crm-f-cidade-filter'),fEstado=val('crm-f-estado-filter'),fCor=val('crm-f-cor-filter'),fModelo=val('crm-f-modelo-filter');
  // ★ Filtro de periodo (fiscal 16→15 ou personalizado)
  var _intervaloFP = typeof _intervaloPeriodoFiltro === 'function' ? _intervaloPeriodoFiltro() : null;
  var _stagesFP = gStages();
  var wonIdsFP = _stagesFP.filter(function(s){return /gan|won/i.test(s.label);}).map(function(s){return s.id;});
  var fil=all.filter(function(o){
    if(q&&!(o.cliente||'').toLowerCase().includes(q)&&!(o.produto||'').toLowerCase().includes(q)&&!(o.cidade||'').toLowerCase().includes(q)&&!(o.wrep||'').toLowerCase().includes(q)&&!(o.agp||'').toLowerCase().includes(q)&&!(o.reserva||'').toLowerCase().includes(q))return false;
    if(fR&&o.responsavel!==fR)return false;
    if(fO&&o.origem!==fO)return false;
    if(fS&&o.scope!==fS)return false;
    if(fWrep&&(o.wrep||'')!==fWrep)return false;
    if(fCidade&&(o.cidade||'')!==fCidade)return false;
    if(fEstado&&(o.estado||'')!==fEstado)return false;
    if(fCor){var _hasC=false;if((o.cor_ext||'')===fCor)_hasC=true;if(!_hasC&&o.itens)o.itens.forEach(function(it){if((it.cor_ext||'')===fCor)_hasC=true;});if(!_hasC)return false;}
    if(fModelo){var _hasM=false;if((o.modelo||'')===fModelo)_hasM=true;if(!_hasM&&o.itens)o.itens.forEach(function(it){if((it.modelo||'')===fModelo)_hasM=true;});if(!_hasM)return false;}
    if(fReg){
      var oreg=getRepRegiao(o.wrep);
      if(!oreg)return false;
      if(fReg.length<=5){if(!oreg.startsWith(fReg))return false;}
      else{if(oreg!==fReg)return false;}
    }
    if(fGer){
      var oreg2=getRepRegiao(o.wrep);
      var gn=getGerenteDaRegiao(oreg2);
      if(gn.toUpperCase()!==fGer.toUpperCase())return false;
    }
    // ★ Felipe 20/04: filtro de periodo. Usa data de referencia conforme
    //   o select 'Por qual data' (#crm-f-data-ref): auto/chegada/orcamento/
    //   contato/fechamento.
    if(_intervaloFP){
      var _dt = _dataRefCard(o);
      if(!_dataDentroDe(_dt, _intervaloFP)) return false;
    }
    return true;
  });
  updateKPIs(all);
  if(_view==='kanban')renderKanban(fil);
  else renderList(fil);
};

/* ── Kanban ──────────────────────────────────────── */
function renderKanban(fil){
  var board=el('crm-pipeline');if(!board)return;
  var stages=gStages();board.innerHTML='';
  stages.forEach(function(st){
    var cards=fil.filter(function(o){return o.stage===st.id;});
    // ★ Felipe 20/04: Fat da coluna agora inclui inst+logistica pros intl
    var tv=cards.reduce(function(s,o){return s+_valorRealCardBRL(o);},0);
    var tvTab=cards.reduce(function(s,o){return s+(parseFloat(o.valorTabela)||0);},0);
    var isFazerOrc=/fazer.*or|orcamento/i.test(st.label);
    var col=document.createElement('div');col.className='crm-stage';col.setAttribute('data-stage',st.id);
    col.innerHTML=
      '<div class="crm-stage-header">'+
        '<div class="crm-stage-title-row">'+
          '<div class="crm-stage-title"><div class="crm-stage-dot" style="background:'+st.color+'"></div><span>'+st.icon+' '+escH(st.label)+'</span></div>'+
          '<span class="crm-stage-count">'+cards.length+'</span>'+
          '<button class="crm-stage-add-top" onclick="crmOpenModal(\''+st.id+'\')" title="Adicionar nova oportunidade nesta coluna" aria-label="Adicionar">+</button>'+
        '</div>'+
        (tvTab>0?'<div class="crm-stage-val" style="color:var(--navy)">Tab: '+brl(tvTab)+'</div>':'')+
        (tv>0?'<div class="crm-stage-val" style="color:#e67e22;font-weight:700">Fat: '+brl(tv)+'</div>':'')+
      '</div>'+
      '<div class="crm-stage-body" id="sb-'+st.id+'"></div>'+
      '<div class="crm-stage-footer"><button class="crm-stage-add-btn" onclick="crmOpenModal(\''+st.id+'\')">+ Adicionar</button></div>';
    board.appendChild(col);
    var body=col.querySelector('#sb-'+st.id);
    body.addEventListener('dragover',function(e){e.preventDefault();body.classList.add('drag-over');});
    body.addEventListener('dragleave',function(e){if(!body.contains(e.relatedTarget))body.classList.remove('drag-over');});
    body.addEventListener('drop',function(e){
      e.preventDefault();body.classList.remove('drag-over');
      if(!_dragId)return;
      var dragIdLocal = _dragId;
      _dragId=null;
      var data=cLoad();var idx=data.findIndex(function(o){return o.id===dragIdLocal;});
      if(idx<0) return;

      var destStage = st;
      var _ehGanho = /ganho|won/i.test(destStage.label||'');

      // ★ Felipe 20/04: pedir data de fechamento se:
      //   - stage destino e Ganho E
      //   - card AINDA nao tem fechamento_real (nosso campo novo)
      //
      //   Isso cobre 3 casos:
      //   1) Card indo pro Ganho pela primeira vez
      //   2) Card que ja esteve em Ganho mas so com 'fechamento' legado
      //      (sem fechamento_real) — pede a data correta agora
      //   3) Card voltou do Ganho pra outra coluna e ta voltando
      if(_ehGanho && !(data[idx].fechamento_real && String(data[idx].fechamento_real).trim())){
        // ★ Modal nativo com <input type="date"> — calendario do browser
        //   exibe no formato local (BR: DD/MM/AAAA). Valor interno continua
        //   ISO (YYYY-MM-DD) pra compatibilidade.
        _abrirModalDataFechamento(data[idx].cliente||'Cliente', function(dataIso){
          if(!dataIso) return; // cancelou
          data[idx].fechamento_real = dataIso;
          data[idx].fechamento = dataIso; // compat legado
          data[idx].stage = destStage.id;
          data[idx].updatedAt = new Date().toISOString();
          cSave(data);
          crmRender();
        }, function(){
          // Cancelou → volta pro stage anterior
          crmRender();
        });
        return; // aguarda callback do modal
      }

      data[idx].stage = destStage.id;
      data[idx].updatedAt = new Date().toISOString();
      cSave(data);
      crmRender();
    });
    if(!cards.length){
      body.innerHTML='<div class="crm-empty"><div class="crm-empty-icon">📭</div>Nenhuma oportunidade</div>';
    } else {
      cards.forEach(function(o){body.appendChild(buildCard(o,st,isFazerOrc));});
    }
  });
}

/* ── Card ────────────────────────────────────────── */
function buildCard(o,st,isFazerOrc){
  var card=document.createElement('div');
  card.className='crm-card'+(o.scope==='internacional'?' intl':'')+(o.prioridade==='alta'?' pri-alta':o.prioridade==='baixa'?' pri-baixa':'');
  card.setAttribute('draggable','true');
  card.addEventListener('dragstart',function(e){_dragId=o.id;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
  card.addEventListener('dragend',function(){card.classList.remove('dragging');_dragId=null;});

  var locStr=o.scope==='internacional'
    ?(o.cidade?o.cidade+', ':'')+escH(o.pais||'')
    :(o.cidade||'')+(o.estado?' – '+o.estado:'');

  // Build card content — only show relevant info
  var html='';
  if(o.scope==='internacional') html+='<div class="crm-card-intl-tag">🌍 INTERNACIONAL</div>';
  html+='<div class="crm-card-client">'+escH(o.cliente||'Sem nome')+'</div>';
  if(locStr) html+='<div class="crm-card-sub">📍 '+locStr+'</div>';
  if(o.produto) html+='<div class="crm-card-sub">'+escH(o.produto)+'</div>';
  if(o.largura||o.altura) html+='<div class="crm-card-dims">📐 '+(o.largura||'?')+'×'+(o.altura||'?')+' mm'+(o.abertura?' · '+o.abertura.charAt(0)+o.abertura.slice(1).toLowerCase():'')+'</div>';
  // Mostrar info de cada item (modelo, folhas, digital, cor)
  if(o.itens&&o.itens.length>0){
    var _itemInfo=o.itens.filter(function(it){return it.tipo==='porta_pivotante'||it.tipo==='porta_interna';}).map(function(it,i){
      var parts=[];
      if(it.largura&&it.altura) parts.push(it.largura+'×'+it.altura);
      if(it.tipo==='porta_interna') parts.push('INT '+(it.sistema_pi||'GIRO'));
      if(it.modelo) parts.push('Mod.'+it.modelo);
      // Felipe 24/04: folhas visiveis sempre (1 folha ou N folhas)
      var _flhIt = it.folhas || it.folhas_pi;
      if(_flhIt){
        var _flhN = parseInt(_flhIt,10);
        if(_flhN >= 1) parts.push(_flhN === 1 ? '1 folha' : _flhN + ' folhas');
      }
      if(it.fech_dig&&it.fech_dig!==''&&it.fech_dig!=='Nenhuma') parts.push('🔒'+it.fech_dig);
      if(it.cor_ext) parts.push('🎨'+it.cor_ext);
      if(it.cor_macico) parts.push('🔷'+it.cor_macico);
      return parts.length?('P'+(i+1)+': '+parts.join(' · ')):'';
    }).filter(Boolean);
    if(_itemInfo.length) html+='<div class="crm-card-sub" style="font-size:10px;line-height:1.5;font-weight:600">'+_itemInfo.join('<br>')+'</div>';
  } else {
    var _singleParts=[];
    if(o.modelo) _singleParts.push('Mod. '+o.modelo);
    // Felipe 24/04: folhas visiveis sempre (1 folha ou N folhas)
    if(o.folhas){
      var _flhSn = parseInt(o.folhas,10);
      if(_flhSn >= 1) _singleParts.push(_flhSn === 1 ? '1 folha' : _flhSn + ' folhas');
    }
    if(o.cor_ext) _singleParts.push('🎨'+o.cor_ext);
    if(o.cor_macico) _singleParts.push('🔷'+o.cor_macico);
    if(_singleParts.length) html+='<div class="crm-card-sub" style="font-size:10px;font-weight:600">'+_singleParts.join(' · ')+'</div>';
  }
  // Exibir responsável comercial conforme origem:
  //   - Weiku do Brasil → 👤 Rep: wrep
  //   - Parceiro        → 🤝 Parceiro: parceiro_nome
  //   - Outras origens  → não exibe
  if(o.origem==='Weiku do Brasil' && o.wrep){
    html+='<div class="crm-card-sub" style="color:#2980b9;font-weight:700;font-size:9px">👤 Rep: '+escH(o.wrep)+'</div>';
  } else if(o.origem==='Parceiro' && o.parceiro_nome){
    html+='<div class="crm-card-sub" style="color:#8e44ad;font-weight:700;font-size:9px">🤝 Parceiro: '+escH(o.parceiro_nome)+'</div>';
  }
  if(o.reserva) html+='<div class="crm-card-sub" style="font-size:9px;color:#1a5276;font-weight:700">📋 Reserva: '+escH(o.reserva)+'</div>';
  if(o.agp) html+='<div class="crm-card-sub" style="font-size:9px;color:#c0392b;font-weight:800">📋 AGP: '+escH(o.agp)+'</div>';
  // Prioridade + Potencial badges
  if(o.prioridade==='alta') html+='<div style="font-size:9px;font-weight:800;color:#e74c3c;background:#fde;padding:2px 6px;border-radius:4px;display:inline-block;margin:2px 0">🔴 PRIORIDADE ALTA</div>';
  else if(o.prioridade==='baixa') html+='<div style="font-size:9px;color:#27ae60;margin:1px 0">🟢 Prioridade baixa</div>';
  if(o.potencial==='alto') html+='<div style="font-size:9px;font-weight:700;color:#e67e22;margin:2px 0">🔥 Alto Potencial</div>';
  else if(o.potencial==='medio') html+='<div style="font-size:9px;color:#f39c12;margin:1px 0">⚡ Médio Potencial</div>';
  else if(o.potencial==='baixo') html+='<div style="font-size:9px;color:#95a5a6;margin:1px 0">💤 Baixo Potencial</div>';
  if(o.anexos&&o.anexos.length>0) html+='<div class="crm-card-attach-badge">📎 '+o.anexos.length+' anexo'+(o.anexos.length>1?'s':'')+'</div>';
  // Valores: Tabela e Faturamento (nacional: simples; internacional: breakdown)
  // ★ Felipe 20/04: obras internacionais mostram breakdown completo no card:
  //   Porta + Instalação + Logística (Caixa+Fretes) = Total. Em R$ e USD.
  //   Detecta intl por qualquer sinal forte (evita bug de scope nao salvo):
  //   scope OU inst_quem=INTERNACIONAL OU tem incoterm (CIF/FOB/EXW) OU tem pais
  var _ehIntl = o.scope === 'internacional'
             || (o.inst_quem||'').toUpperCase() === 'INTERNACIONAL'
             || ['CIF','FOB','EXW'].indexOf((o.inst_incoterm||'').toUpperCase()) >= 0
             || !!(o.pais||'').trim();
  if(o.valorTabela>0 || o.valorFaturamento>0 || o.valor>0){
    if(_ehIntl){
      // --- Cálculo do breakdown ---
      var _vPorta = parseFloat(o.valorFaturamento) || parseFloat(o.valorTabela) || parseFloat(o.valor) || 0;

      // Instalação: preferir valor ja salvo no card (_sv.instIntlFat persistido
      // pelo 03-history_save ao clicar Gerar Custo). Fallback: recalcular a
      // partir dos campos inst_* se nao houver valor salvo mas houver base.
      var _vInst = parseFloat(o.inst_intl_fat) || 0;
      var _cambio = parseFloat(o.inst_cambio) || 5.20; // default; atualizado se card tiver
      if(_vInst === 0){
        // Fallback — recalcular
        var _passagemPorPessoa = parseFloat(o.inst_passagem) || 0;
        var _hotelDia = parseFloat(o.inst_hotel) || 0;
        var _alimDia = parseFloat(o.inst_alim) || 0;
        var _udigru = parseFloat(o.inst_udigru) || 0;
        var _seguroPP = parseFloat(o.inst_seguro) || 0;
        var _carroDia = parseFloat(o.inst_carro) || 0;
        var _moDia = parseFloat(o.inst_mo) || 0;
        var _pessoas = parseInt(o.inst_pessoas) || 3;
        var _diasInst = parseInt(o.inst_dias) || 3;
        var _diasViagem = 4;
        var _diasTotal = _diasInst + _diasViagem;
        var _diasHotel = _diasTotal - 2;
        var _margemInstPct = parseFloat(o.inst_margem) || 10;
        var _temDadosInst = (_passagemPorPessoa + _hotelDia + _alimDia + _udigru) > 0;
        if(_temDadosInst){
          var _custoInst = _udigru + (_passagemPorPessoa*_pessoas) + (_hotelDia*_diasHotel) +
                           (_alimDia*_pessoas*_diasTotal) + (_seguroPP*_pessoas) +
                           (_carroDia*_diasTotal) + (_moDia*_diasTotal);
          var _divisor = Math.max(0.01, 1 - _margemInstPct/100);
          _vInst = _custoInst / _divisor;
        }
      }

      // Logística (caixa + fretes) — depende do incoterm
      var _incoterm = (o.inst_incoterm||'').toUpperCase();
      var _incluirCaixa = _incoterm==='CIF' || _incoterm==='FOB';
      var _incluirTerrestre = _incoterm==='CIF' || _incoterm==='FOB';
      var _incluirMaritimo = _incoterm==='CIF';

      var _caixaUsd = 0;
      if(_incluirCaixa){
        var _L = parseFloat(o.cif_caixa_l)||0;
        var _A = parseFloat(o.cif_caixa_a)||0;
        var _E = parseFloat(o.cif_caixa_e)||0;
        var _taxa = parseFloat(o.cif_caixa_taxa)||100;
        var _vol = (_L/1000)*(_A/1000)*(_E/1000);
        _caixaUsd = _vol * _taxa;
      }
      var _fTerrestreUsd = _incluirTerrestre ? (parseFloat(o.cif_frete_terrestre)||0) : 0;
      var _fMaritimoUsd  = _incluirMaritimo  ? (parseFloat(o.cif_frete_maritimo)||0)  : 0;
      var _logisticaUsd = _caixaUsd + _fTerrestreUsd + _fMaritimoUsd;
      var _logisticaBrl = _logisticaUsd * _cambio;

      var _totalBrl = _vPorta + _vInst + _logisticaBrl;
      var _totalUsd = _cambio > 0 ? _totalBrl / _cambio : 0;

      // --- Render ---
      // Formatters
      var _fBrl = function(v){ return 'R$ '+_fmtBRLCeil(v);};
      var _fUsd = function(v){ return 'US$ '+(v||0).toLocaleString('en-US',{minimumFractionDigits:0, maximumFractionDigits:0}); };

      html += '<div style="margin:4px 0 2px;padding:6px 8px;background:linear-gradient(135deg,rgba(230,81,0,.06),rgba(21,101,192,.04));border-radius:6px;border:0.5px solid rgba(230,81,0,.15);font-size:10px">';
      // Breakdown lines — só mostra se tiver valor
      if(_vPorta>0){
        html += '<div style="display:flex;justify-content:space-between;color:#555"><span>🚪 Porta:</span><span style="font-weight:600">'+_fBrl(_vPorta)+' · '+_fUsd(_vPorta/_cambio)+'</span></div>';
      }
      if(_vInst>0){
        html += '<div style="display:flex;justify-content:space-between;color:#555;margin-top:1px"><span>🔧 Instalação:</span><span style="font-weight:600">'+_fBrl(_vInst)+' · '+_fUsd(_vInst/_cambio)+'</span></div>';
      }
      if(_logisticaUsd>0){
        var _logLabel = _incoterm==='CIF' ? '🚢 Caixa+Fretes' : _incoterm==='FOB' ? '📦 Caixa+Terrestre' : '📦 Logística';
        html += '<div style="display:flex;justify-content:space-between;color:#555;margin-top:1px"><span>'+_logLabel+':</span><span style="font-weight:600">'+_fBrl(_logisticaBrl)+' · '+_fUsd(_logisticaUsd)+'</span></div>';
      }
      // Total — destaque
      html += '<div style="display:flex;justify-content:space-between;margin-top:4px;padding-top:4px;border-top:1px dashed rgba(230,81,0,.3)"><span style="color:#003144;font-weight:800">TOTAL:</span><span style="color:#e65100;font-weight:800;font-size:11px">'+_fBrl(_totalBrl)+'</span></div>';
      html += '<div style="text-align:right;color:#1565c0;font-weight:700;font-size:10px">'+_fUsd(_totalUsd)+'</div>';
      html += '</div>';
    } else {
      // Nacional: Tabela + Faturamento (comportamento antigo)
      html+='<div style="margin:4px 0 2px;padding:5px 7px;background:rgba(0,49,68,.04);border-radius:6px;font-size:10px">';
      if(o.valorTabela>0) html+='<div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#888">Tabela:</span><span style="font-weight:700;color:var(--navy)">'+brl(o.valorTabela)+'</span></div>';
      if(o.valorFaturamento>0) html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1px"><span style="color:#888">Faturamento:</span><span style="font-weight:800;color:#e67e22">'+brl(o.valorFaturamento)+'</span></div>';
      if(!(o.valorTabela>0 || o.valorFaturamento>0) && o.valor>0){
        html+='<div class="crm-card-value">'+brl(o.valor)+'</div>';
      }
      html+='</div>';
    }
  }
  // Revisões badge
  if(o.revisoes&&o.revisoes.length>0){
    var lastRev=o.revisoes[o.revisoes.length-1];
    var badgeLabel=lastRev.label||(o.revisoes.length===1?'Original':'Revisão '+(o.revisoes.length-1));
    var badgeColor=o.revisoes.length===1?'#27ae60':'#9b59b6';
    html+='<div style="display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:wrap">';
    html+='<span style="font-size:10px;font-weight:700;color:#fff;background:'+badgeColor+';border-radius:4px;padding:2px 8px">'+badgeLabel+'</span>';
    if(o.revisoes.length>1) html+='<span style="font-size:9px;color:#888">('+o.revisoes.length+' versões)</span>';
    html+='</div>';
  }
  if(o.dataContato) html+='<div style="font-size:9px;color:var(--hint);margin-top:2px">📅 1º contato: '+dateLabel(o.dataContato)+'</div>';
  // ★ Felipe 20/04: data/hora da ultima revisao do orcamento (se houver)
  var _ultimaRev = null;
  if(Array.isArray(o.opcoes)){
    var _opAtiva = o.opcoes.find(function(op){return op.ativa;}) || o.opcoes[0];
    if(_opAtiva && Array.isArray(_opAtiva.revisoes) && _opAtiva.revisoes.length){
      _ultimaRev = _opAtiva.revisoes[_opAtiva.revisoes.length-1];
    }
  }
  if(!_ultimaRev && Array.isArray(o.revisoes) && o.revisoes.length){
    _ultimaRev = o.revisoes[o.revisoes.length-1];
  }
  if(_ultimaRev && _ultimaRev.data){
    try {
      var _dOrc = new Date(_ultimaRev.data);
      var _dOrcTxt = _dOrc.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      html+='<div style="font-size:9px;color:#8e44ad;margin-top:2px;font-weight:600" title="Data e hora do ultimo orcamento gerado">📝 Orçamento: '+_dOrcTxt+'</div>';
    } catch(e){}
  }

  // ★ Data de fechamento — Felipe 20/04: usa o campo real (fechamento_real)
  //   quando disponivel, senao cai pro legado (fechamento). Formato BR
  //   completo DD/MM/AAAA pra clareza (dateLabel so mostra "20 de abr.",
  //   pouco util pra ganho que as vezes e de outro ano).
  var _dataFech = o.fechamento_real || o.fechamento || '';
  var _ehWon = /ganho|won/i.test(st.label||'') || o.stage==='won' || o.stage==='s6';
  if(_ehWon){
    if(_dataFech){
      // Data visivel + clicavel pra editar
      html+='<div style="font-size:9px;color:#27ae60;margin-top:2px;font-weight:700;cursor:pointer" onclick="event.stopPropagation();crmEditarDataFech(\''+o.id+'\')" title="Clique para editar a data de fechamento">🏆 Fechado: '+isoToBR(_dataFech)+' ✎</div>';
    } else {
      // Ganho sem data → botao de alerta pra preencher
      html+='<div style="font-size:9px;color:#e67e22;margin-top:2px;font-weight:700;cursor:pointer;background:#fff3e0;padding:3px 6px;border-radius:4px;border:1px dashed #e67e22" onclick="event.stopPropagation();crmEditarDataFech(\''+o.id+'\')" title="Clique para definir a data">⚠️ Definir data de fechamento</div>';
    }
  }

  var days=daysFrom(o.fechamento);
  var urgente=days<=3&&o.fechamento&&!/(gan|won|perd|lost)/i.test(st.label);
  html+='<div class="crm-card-footer">'+
    '<div class="crm-card-resp">'+
      (o.responsavel?'<div class="crm-avatar" style="background:'+nameColor(o.responsavel)+'">'+o.responsavel.charAt(0)+'</div><span>'+escH(o.responsavel.split(' ')[0])+'</span>':'<span style="color:var(--hint)">Sem resp.</span>')+
    '</div>'+
  '</div>';

  // Fazer Orçamento button
  if(isFazerOrc){
    html+='<button class="crm-fazer-orc-btn" onclick="event.stopPropagation();crmFazerOrcamento(\''+o.id+'\')">📋 Fazer Orçamento</button>';
  }

  html+='<div class="crm-card-actions">'+
    '<button class="crm-card-act" title="Compartilhar" onclick="event.stopPropagation();crmCompartilharCard(\''+o.id+'\')" style="color:#27ae60">📤</button>'+
    '<button class="crm-card-act" title="Mover" onclick="event.stopPropagation();crmQuickMove(\''+o.id+'\')">↕</button>'+
    '<button class="crm-card-act" title="Editar" onclick="event.stopPropagation();crmOpenModal(null,\''+o.id+'\')">✏</button>'+
    '<button class="crm-card-act" title="Excluir" onclick="event.stopPropagation();crmDeleteOpp(\''+o.id+'\')">🗑</button>'+
  '</div>';

  card.innerHTML=html;
  card.addEventListener('click',function(e){if(!e.target.closest('.crm-card-actions,.crm-fazer-orc-btn'))crmOpenModal(null,o.id);});
  return card;
}

/* ── List View ───────────────────────────────────── */
function renderList(fil){
  var tb=el('crm-list-body');if(!tb)return;
  var stages=gStages();tb.innerHTML='';
  if(!fil.length){tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--hint)">Nenhuma oportunidade encontrada</td></tr>';return;}
  var _totTab=0,_totFat=0;
  fil.forEach(function(o){
    var st=stages.find(function(s){return s.id===o.stage;})||stages[0];
    var locStr=o.scope==='internacional'?(o.cidade||'')+(o.pais?', '+o.pais:''):(o.cidade||'')+(o.estado?' – '+o.estado:'');
    var vTab=o.valorTabela||((o.revisoes&&o.revisoes.length)?o.revisoes[o.revisoes.length-1].valorTabela:0)||0;
    var vFat=o.valorFaturamento||((o.revisoes&&o.revisoes.length)?o.revisoes[o.revisoes.length-1].valorFaturamento:0)||0;
    _totTab+=vTab;_totFat+=vFat;
    var tr=document.createElement('tr');
    tr.onclick=function(){crmOpenModal(null,o.id);};
    tr.innerHTML='<td><b style="color:var(--navy)">'+(o.scope==='internacional'?'🌍 ':'')+escH(o.cliente||'—')+'</b>'+(locStr?'<br><small style="color:var(--muted)">'+escH(locStr)+'</small>':'')+'</td>'+
      '<td style="font-size:11px;color:var(--muted)">'+escH(o.produto||'—')+'</td>'+
      '<td style="font-size:11px;font-family:monospace">'+(o.largura?o.largura+'×'+(o.altura||'?')+'mm':'—')+(o.reserva?' <small style="color:#1a5276">Res:'+o.reserva+'</small>':'')+(o.agp?' <small style="color:#c0392b;font-weight:700">AGP:'+o.agp+'</small>':'')+'</td>'+
      '<td style="text-align:right;font-weight:700;color:var(--navy)">'+brl(vTab)+'</td>'+
      '<td style="text-align:right;font-weight:700;color:#e67e22">'+brl(vFat)+'</td>'+
      '<td><span class="crm-stage-badge" style="background:'+st.color+'22;color:'+st.color+'">'+st.icon+' '+escH(st.label)+'</span></td>'+
      '<td style="font-size:11px">'+escH(o.responsavel||'—')+(
        (o.origem==='Weiku do Brasil' && o.wrep) ? '<br><small style="color:#2980b9">'+escH(o.wrep)+'</small>'
        : (o.origem==='Parceiro' && o.parceiro_nome) ? '<br><small style="color:#8e44ad">🤝 '+escH(o.parceiro_nome)+'</small>'
        : ''
      )+'</td>'+
      '<td style="font-size:11px;color:var(--hint)">'+dateLabel(o.fechamento)+'</td>'+
      '<td><button class="crm-btn-ghost" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation();crmOpenModal(null,\''+o.id+'\')">✏</button></td>';
    tb.appendChild(tr);
  });
  // Totals row
  var ft=el('crm-list-foot');
  if(ft) ft.innerHTML='<tr style="background:#f5f3ee;font-weight:800"><td colspan="3" style="padding:10px 12px;font-size:12px;color:var(--navy)">TOTAL ('+fil.length+' oportunidades)</td><td style="padding:10px 12px;text-align:right;color:var(--navy);font-size:12px">'+brl(_totTab)+'</td><td style="padding:10px 12px;text-align:right;color:#e67e22;font-size:12px">'+brl(_totFat)+'</td><td colspan="4"></td></tr>';
}

/* ── Quick Move ──────────────────────────────────── */
window.crmQuickMove=function(id){
  var data=cLoad();var opp=data.find(function(o){return o.id===id;});if(!opp)return;
  var stages=gStages();
  var div=document.createElement('div');div.style.cssText='position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';
  div.onclick=function(e){if(e.target===div)div.remove();};
  var inner='<div style="background:#fff;border-radius:16px;padding:20px;max-width:300px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3)"><div style="font-weight:800;color:var(--navy);margin-bottom:14px;font-size:14px">↕ Mover: '+escH(opp.cliente)+'</div><div style="display:flex;flex-direction:column;gap:6px">';
  stages.forEach(function(s){inner+='<button onclick="crmMoveStage(\''+id+'\',\''+s.id+'\');this.closest(\'[style*=fixed]\').remove()" style="padding:9px 14px;border-radius:10px;border:2px solid '+s.color+';cursor:pointer;font-size:12px;font-weight:700;text-align:left;transition:.1s;'+(opp.stage===s.id?'background:'+s.color+';color:#fff':'background:#fff;color:var(--navy)')+'">'+(opp.stage===s.id?'✓ ':'')+s.icon+' '+s.label+'</button>';});
  inner+='</div></div>';div.innerHTML=inner;document.body.appendChild(div);
};
window.crmMoveStage=function(id,sid){
  var data=cLoad();var i=data.findIndex(function(o){return o.id===id;});
  if(i>=0){data[i].stage=sid;data[i].updatedAt=new Date().toISOString();
    // Auto-set data fechamento quando mover para Ganho
    if(sid==='won'&&!data[i].fechamento){data[i].fechamento=new Date().toISOString().slice(0,10);}
    cSave(data);crmRender();
    if(sid==='s3b'&&typeof _onStageOrcamentoPronto==='function')_onStageOrcamentoPronto();
  }
};

/* ── View Toggle ─────────────────────────────────── */
window.crmSetView=function(v){
  _view=v;
  el('crm-kanban-view').style.display=v==='kanban'?'block':'none';
  el('crm-list-view').style.display=v==='list'?'block':'none';
  el('crm-vk').classList.toggle('active',v==='kanban');
  el('crm-vl').classList.toggle('active',v==='list');
  crmRender();
};

/* ── Nacional/Internacional ──────────────────────── */
// ★ Helper (Felipe 22/04): o bloco crm-inst-internacional (pais + incoterm +
//   caixa/fretes) tem que aparecer em qualquer uma das 2 situacoes:
//   (a) scope da obra = internacional — clique no botao Internacional ja abre
//       o Incoterm pra user escolher, mesmo que Quem Instala ainda nao esteja
//       definido ou seja PROJETTA/TERCEIROS/SEM (a obra e internacional e
//       precisa de incoterm/embalagem independente de quem executa)
//   (b) Quem Instala = INTERNACIONAL — fluxo antigo preservado
//   Chamada por crmSetScope e crmInstQuemChange.
window._crmUpdateIntlVisibility=function(){
  var intl=document.getElementById('crm-inst-internacional');
  if(!intl) return;
  var isScopeIntl=(_scope==='internacional');
  var quemSel=document.getElementById('crm-o-inst-quem');
  var isQuemIntl=quemSel && quemSel.value==='INTERNACIONAL';
  intl.style.display=(isScopeIntl||isQuemIntl)?'':'none';
};

window.crmSetScope=function(scope){
  _scope=scope;
  var btnNac=el('crm-btn-nac');
  var btnIntl=el('crm-btn-intl');
  if(btnNac){btnNac.style.background=scope==='nacional'?'#e3f2fd':'#fff';btnNac.style.fontWeight=scope==='nacional'?'800':'600';}
  if(btnIntl){btnIntl.style.background=scope==='internacional'?'#fff3e0':'#fff';btnIntl.style.fontWeight=scope==='internacional'?'800':'600';}
  var locNac=el('crm-loc-nacional');if(locNac)locNac.style.display=scope==='nacional'?'block':'none';
  var locIntl=el('crm-loc-internacional');if(locIntl)locIntl.style.display=scope==='internacional'?'block':'none';
  // ★ Sincronizar visibilidade do bloco pais+incoterm+caixa com o scope,
  //   sem alterar o valor escolhido em Quem Instala.
  window._crmUpdateIntlVisibility();
};

/* ── CEP ─────────────────────────────────────────── */
window.crmCepMask=function(inp){
  var v=inp.value.replace(/\D/g,'').slice(0,8);
  if(v.length>5)v=v.slice(0,5)+'-'+v.slice(5);
  inp.value=v;
  if(v.replace('-','').length===8)crmBuscarCep();
};
window.crmBuscarCep=function(){
  var cep=val('crm-o-cep').replace(/\D/g,'');
  var st=el('crm-cep-status');
  if(cep.length!==8){if(st){st.textContent='CEP inválido';st.className='crm-cep-status err';}return;}
  if(st){st.textContent='⏳ Buscando...';st.className='crm-cep-status';}
  // Try fetch first, fallback to JSONP for file:// protocol
  fetch('https://viacep.com.br/ws/'+cep+'/json/')
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.erro){if(st){st.textContent='❌ CEP não encontrado';st.className='crm-cep-status err';}return;}
      setVal('crm-o-estado',d.uf||'');
      setVal('crm-o-cidade-nac',d.localidade||'');
      if(st){st.textContent='✅ '+d.localidade+' – '+d.uf;st.className='crm-cep-status ok';}
    })
    .catch(function(){
      // Fallback: JSONP via script tag (works from file:// protocol)
      var cbName='_viacepCb'+Date.now();
      window[cbName]=function(d){
        delete window[cbName];
        if(!d||d.erro){if(st){st.textContent='❌ CEP não encontrado';st.className='crm-cep-status err';}return;}
        setVal('crm-o-estado',d.uf||'');
        setVal('crm-o-cidade-nac',d.localidade||'');
        if(st){st.textContent='✅ '+d.localidade+' – '+d.uf;st.className='crm-cep-status ok';}
      };
      var sc=document.createElement('script');
      sc.src='https://viacep.com.br/ws/'+cep+'/json/?callback='+cbName;
      sc.onerror=function(){delete window[cbName];if(st){st.textContent='❌ Erro de rede — preencha manualmente';st.className='crm-cep-status err';}};
      document.head.appendChild(sc);
      setTimeout(function(){try{document.head.removeChild(sc);}catch(e){}},5000);
    });
};

/* ── Brasil Cidades ──────────────────────────────── */
var ESTADOS={AC:'Acre',AL:'Alagoas',AM:'Amazonas',AP:'Amapá',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MG:'Minas Gerais',MS:'Mato Grosso do Sul',MT:'Mato Grosso',PA:'Pará',PB:'Paraíba',PE:'Pernambuco',PI:'Piauí',PR:'Paraná',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RO:'Rondônia',RR:'Roraima',RS:'Rio Grande do Sul',SC:'Santa Catarina',SE:'Sergipe',SP:'São Paulo',TO:'Tocantins'};
var CIDADES={AC:['Rio Branco','Cruzeiro do Sul','Feijó','Sena Madureira'],AL:['Maceió','Arapiraca','Rio Largo','Palmeira dos Índios'],AM:['Manaus','Parintins','Itacoatiara','Manacapuru'],AP:['Macapá','Santana'],BA:['Salvador','Feira de Santana','Vitória da Conquista','Camaçari','Juazeiro','Ilhéus','Itabuna','Lauro de Freitas','Barreiras','Jequié','Porto Seguro'],CE:['Fortaleza','Caucaia','Juazeiro do Norte','Maracanaú','Sobral','Crato'],DF:['Brasília','Ceilândia','Taguatinga','Samambaia','Planaltina','Gama'],ES:['Vitória','Vila Velha','Serra','Cariacica','Linhares','Cachoeiro de Itapemirim','Guarapari'],GO:['Goiânia','Aparecida de Goiânia','Anápolis','Rio Verde','Luziânia','Trindade','Formosa','Catalão'],MA:['São Luís','Imperatriz','Timon','Caxias','Açailândia'],MG:['Belo Horizonte','Uberlândia','Contagem','Juiz de Fora','Betim','Montes Claros','Uberaba','Governador Valadares','Ipatinga','Sete Lagoas','Divinópolis','Poços de Caldas','Patos de Minas','Varginha','Araguari','Ituiutaba','Araxá'],MS:['Campo Grande','Dourados','Três Lagoas','Corumbá','Ponta Porã'],MT:['Cuiabá','Várzea Grande','Rondonópolis','Sinop','Tangará da Serra'],PA:['Belém','Ananindeua','Santarém','Marabá','Castanhal','Parauapebas'],PB:['João Pessoa','Campina Grande','Santa Rita','Patos'],PE:['Recife','Caruaru','Olinda','Petrolina','Paulista','Garanhuns','Jaboatão dos Guararapes'],PI:['Teresina','Parnaíba','Picos','Floriano'],PR:['Curitiba','Londrina','Maringá','Ponta Grossa','Cascavel','São José dos Pinhais','Foz do Iguaçu','Colombo','Guarapuava'],RJ:['Rio de Janeiro','São Gonçalo','Duque de Caxias','Nova Iguaçu','Niterói','Belford Roxo','Campos dos Goytacazes','Petrópolis','Macaé','Volta Redonda','Cabo Frio'],RN:['Natal','Mossoró','Parnamirim'],RO:['Porto Velho','Ji-Paraná','Cacoal','Ariquemes'],RR:['Boa Vista'],RS:['Porto Alegre','Caxias do Sul','Pelotas','Canoas','Santa Maria','Gravataí','Novo Hamburgo','São Leopoldo','Rio Grande','Passo Fundo'],SC:['Florianópolis','Joinville','Blumenau','São José','Chapecó','Criciúma','Itajaí','Jaraguá do Sul','Balneário Camboriú'],SE:['Aracaju','Nossa Senhora do Socorro','Lagarto'],SP:['São Paulo','Guarulhos','Campinas','São Bernardo do Campo','Santo André','Osasco','Ribeirão Preto','Sorocaba','Mauá','São José dos Campos','Santos','Mogi das Cruzes','Diadema','Jundiaí','Piracicaba','Bauru','São José do Rio Preto','Franca','Guarujá','Limeira','Praia Grande','Suzano','Taubaté','Barueri','Americana','São Vicente','Marília','São Carlos','Botucatu','Presidente Prudente'],TO:['Palmas','Araguaína','Gurupi']};

function populateStates(){
  var s=el('crm-o-estado');if(!s)return;
  var cur=s.value;s.innerHTML='<option value="">Selecione o estado...</option>';
  Object.keys(ESTADOS).sort().forEach(function(uf){var o=document.createElement('option');o.value=uf;o.textContent=uf+' – '+ESTADOS[uf];if(uf===cur)o.selected=true;s.appendChild(o);});
}
window.crmLoadCities=function(){setVal('crm-o-cidade-nac','');var ac=el('crm-city-ac');if(ac)ac.style.display='none';};
window.crmCityAC=function(){
  var uf=val('crm-o-estado'),q=val('crm-o-cidade-nac').toLowerCase().trim();
  var ac=el('crm-city-ac');if(!ac)return;
  if(!q){ac.style.display='none';return;}
  var cities=uf&&CIDADES[uf]?CIDADES[uf]:Object.values(CIDADES).reduce(function(a,b){return a.concat(b);});
  var matches=cities.filter(function(c){return c.toLowerCase().includes(q);}).slice(0,10);
  if(!matches.length){ac.style.display='none';return;}
  ac.innerHTML='';ac.style.display='block';
  matches.forEach(function(c){var i=document.createElement('div');i.className='crm-ac-item';i.textContent=c;i.onmousedown=function(e){e.preventDefault();setVal('crm-o-cidade-nac',c);ac.style.display='none';};ac.appendChild(i);});
};

/* ── Searchable Dropdowns ────────────────────────── */
window.crmToggleDrop=function(ddId){
  var dd=el(ddId);if(!dd)return;
  var was=dd.classList.contains('open');
  document.querySelectorAll('.crm-select-dropdown.open').forEach(function(d){d.classList.remove('open');});
  if(!was){dd.classList.add('open');var si=dd.querySelector('input[type=text]');if(si){si.value='';crmFilterDrop(ddId,'');si.focus();}}
};
window.crmFilterDrop=function(ddId,q){
  q=q.toLowerCase();
  var dd=el(ddId);if(!dd)return;
  dd.querySelectorAll('.crm-select-opt').forEach(function(opt){opt.style.display=(!q||opt.textContent.toLowerCase().includes(q))?'flex':'none';});
};

function buildDrop(ddId,items,onSelect,current){
  var dd=el(ddId);if(!dd)return;
  var opts=dd.querySelector('[id$="-opts"]');if(!opts)return;
  opts.innerHTML='';
  items.forEach(function(item){
    var label=typeof item==='object'?item.name:item;
    var v=typeof item==='object'?item.name:item;
    var opt=document.createElement('div');opt.className='crm-select-opt'+(v===current?' selected':'');
    if(typeof item==='object'&&item.color){
      opt.innerHTML='<div class="crm-avatar" style="background:'+item.color+';width:20px;height:20px;font-size:9px">'+label.charAt(0)+'</div>'+escH(label);
    } else opt.textContent=label;
    opt.onclick=function(){dd.querySelectorAll('.crm-select-opt').forEach(function(o){o.classList.remove('selected');});opt.classList.add('selected');onSelect(v,label);dd.classList.remove('open');};
    opts.appendChild(opt);
  });
}

/* ── Weiku rep field show/hide ───────────────────── */
function showWeikunField(show){
  var f=el('crm-weiku-field');if(!f)return;
  f.style.display=show?'block':'none';
  if(show){
    // Build reps dropdown
    var reps=[];
    // Try from engine
    var engSel=document.getElementById('rep-sel');
    if(engSel){reps=Array.from(engSel.options).filter(function(o){return o.value;}).map(function(o){return o.text||o.value;});}
    // From settings
    var settReps=gWReps();settReps.forEach(function(r){if(!reps.includes(r))reps.push(r);});
    buildDrop('crm-wrep-dd',reps,function(v){setVal('crm-o-wrep',v);el('crm-o-wrep-text').textContent=v;},val('crm-o-wrep'));
    if(reps.length===0){
      var d=el('crm-wrep-dd');if(d){var opts=d.querySelector('#crm-wrep-opts');if(opts)opts.innerHTML='<div style="padding:10px 12px;font-size:11px;color:var(--muted)">Nenhum representante cadastrado.<br>Adicione em ⚙️ Configurar → Equipe</div>';}
    }
  }
}
window.crmToggleWeikunField=showWeikunField; // expose

function showParceiroField(show){
  var f=el('crm-parceiro-field');if(!f)return;
  f.style.display=show?'block':'none';
}

function buildSelects(opp){
  // Products
  buildDrop('crm-product-dd',gProducts(),function(v){setVal('crm-o-produto',v);el('crm-o-product-text').textContent=v;},opp?opp.produto:'');
  if(opp&&opp.produto)el('crm-o-product-text').textContent=opp.produto;
  else el('crm-o-product-text').textContent='Selecione...';

  // Team
  var team=gTeam();
  buildDrop('crm-resp-dd',team,function(v){
    setVal('crm-o-resp',v);
    var m=team.find(function(t){return t.name===v;});
    el('crm-o-resp-text').innerHTML=(m?'<div class="crm-avatar" style="background:'+m.color+';width:20px;height:20px;font-size:9px">'+v.charAt(0)+'</div>':'')+escH(v);
  },opp?opp.responsavel:'');
  if(opp&&opp.responsavel){
    var m=team.find(function(t){return t.name===opp.responsavel;});
    el('crm-o-resp-text').innerHTML=(m?'<div class="crm-avatar" style="background:'+m.color+';width:20px;height:20px;font-size:9px">'+opp.responsavel.charAt(0)+'</div>':'')+escH(opp.responsavel);
    setVal('crm-o-resp',opp.responsavel);
  } else {el('crm-o-resp-text').textContent='Selecione...';setVal('crm-o-resp','');}

  // Origins — with Weiku trigger
  var dd=el('crm-orig-dd');var opts=el('crm-orig-opts');if(opts)opts.innerHTML='';
  gOrigins().forEach(function(orig){
    var opt=document.createElement('div');opt.className='crm-select-opt'+(opp&&opp.origem===orig?' selected':'');
    var icon=orig==='Weiku do Brasil'?'👤 ':orig==='WhatsApp'?'💬 ':orig==='Instagram'?'📸 ':orig==='Parceiro'?'🤝 ':'';
    opt.innerHTML='<span>'+icon+escH(orig)+'</span>';
    opt.onclick=function(){
      dd.querySelectorAll('.crm-select-opt').forEach(function(o){o.classList.remove('selected');});
      opt.classList.add('selected');
      setVal('crm-o-origem',orig);
      el('crm-o-orig-text').textContent=icon+orig;
      dd.classList.remove('open');
      // Limpar campos dependentes conforme origem (evita dados inconsistentes no card)
      if(orig!=='Weiku do Brasil'){
        setVal('crm-o-wrep','');
        if(el('crm-o-wrep-text'))el('crm-o-wrep-text').textContent='Selecione o representante...';
      }
      if(orig!=='Parceiro'){
        var _pnEl=document.getElementById('crm-o-parceiro-nome');
        if(_pnEl)_pnEl.value='';
      }
      showWeikunField(orig==='Weiku do Brasil');
      showParceiroField(orig==='Parceiro');
    };
    opts.appendChild(opt);
  });
  if(opp&&opp.origem){el('crm-o-orig-text').textContent=opp.origem;setVal('crm-o-origem',opp.origem);}
  else{el('crm-o-orig-text').textContent='Selecione...';setVal('crm-o-origem','');}

  showWeikunField(opp&&opp.origem==='Weiku do Brasil');
  showParceiroField(opp&&opp.origem==='Parceiro');
  if(opp&&opp.parceiro_nome){
    var pnEl=document.getElementById('crm-o-parceiro-nome');
    if(pnEl) pnEl.value=opp.parceiro_nome;
  }
  if(opp&&opp.wrep){
    setVal('crm-o-wrep',opp.wrep);
    if(el('crm-o-wrep-text'))el('crm-o-wrep-text').textContent=opp.wrep;
  }
}

function buildStagePills(curId){
  var sel=el('crm-stage-select');if(!sel)return;
  sel.innerHTML='';
  gStages().forEach(function(s){
    var opt=document.createElement('option');opt.value=s.id;opt.textContent=s.icon+' '+s.label;
    if(s.id===curId)opt.selected=true;
    sel.appendChild(opt);
  });
  _stageId=curId||gStages()[0].id;
  crmUpdateStageDisplay();
}
window.crmUpdateStageDisplay=function(){
  var sel=el('crm-stage-select');var cur=el('crm-stage-current');
  if(!sel||!cur)return;
  var sid=sel.value;_stageId=sid;
  var st=gStages().find(function(s){return s.id===sid;});
  if(st){cur.style.background=st.color;cur.textContent=st.icon+' '+st.label;}
  var stages=gStages();var idx=stages.findIndex(function(s){return s.id===sid;});
  // Prioridade + Potencial: show from Qualificação (index 1) onwards
  var priField=el('crm-prioridade-field');
  if(priField) priField.style.display=(idx>=1)?'grid':'none';
  // ★ Felipe 20/04 (ajuste): Data Fechamento so aparece no modal quando o
  //   card esta em stage 'Fechado Ganho'. Nao faz sentido preencher data
  //   de fechamento em cards ainda ativos (Qualificacao, Fazer Orcamento,
  //   Proposta Enviada, Negociacao).
  var fechField=el('crm-fechamento-field');
  if(fechField){
    var _ehGanhoStage = false;
    if(st) _ehGanhoStage = /ganho|won/i.test(st.label||'');
    if(!_ehGanhoStage && (sid==='won' || sid==='s6')) _ehGanhoStage = true;
    fechField.style.display = _ehGanhoStage ? 'block' : 'none';
  }
  // Reserva: show from Fazer Orçamento (index 1) onwards
  var resRow=el('crm-reserva-agp-row');
  if(resRow) resRow.style.display=(idx>=1)?'grid':'none';
  // AGP: show from Fazer Orçamento (index 1) onwards
  var agpField=el('crm-agp-field');
  if(agpField) agpField.style.display=(idx>=1)?'block':'none';
  // Update field highlights
  crmCheckFieldHighlights();
};

/* ── Highlight new fields only when empty ──────── */
function crmCheckFieldHighlights(){
  document.querySelectorAll('.crm-field-new').forEach(function(field){
    var inp=field.querySelector('input,select');
    if(inp&&inp.value&&inp.value.trim()&&inp.value!==''){
      field.classList.add('crm-field-filled');
    } else {
      field.classList.remove('crm-field-filled');
    }
  });
}
// Attach listeners to new fields
document.addEventListener('change',function(e){
  if(e.target.closest&&e.target.closest('.crm-field-new'))crmCheckFieldHighlights();
});
document.addEventListener('input',function(e){
  if(e.target.closest&&e.target.closest('.crm-field-new'))crmCheckFieldHighlights();
});

/* ── Open Modal ──────────────────────────────────── */
window.crmOpenModal=function(defaultStage,editId){
  _editId=editId||null;
  var modal=el('crm-opp-modal');if(!modal)return;
  populateStates();
  if(typeof _populateCorSelects==='function')_populateCorSelects();
  var opp=editId?cLoad().find(function(o){return o.id===editId;}):null;
  var sid=opp?opp.stage:(defaultStage||gStages()[0].id);
  buildStagePills(sid);
  buildSelects(opp);
  el('crm-modal-title').textContent=editId?'Editar Oportunidade':'Nova Oportunidade';
  el('crm-modal-sub').textContent=opp?'Criado em '+dateLabel(opp.createdAt):'';
  el('crm-del-btn').style.display=editId?'flex':'none';
  if(opp){
    // Load itens
    if(opp.itens&&opp.itens.length>0){
      _crmItensFromCardData(opp.itens);
    } else if(opp.largura&&opp.altura){
      // Backward compat: convert old single-item to itens array
      _crmItensFromCardData([{tipo:'porta_pivotante',qtd:1,largura:opp.largura,altura:opp.altura,modelo:opp.modelo||'',abertura:opp.abertura||'PIVOTANTE',folhas:opp.folhas||'1',cor_ext:opp.cor_ext||'',cor_int:opp.cor_int||'',cor_macico:opp.cor_macico||''}]);
    } else {
      _crmItens=[];_crmItensRender();
    }
    setVal('crm-o-cliente',opp.cliente);setVal('crm-o-contato',opp.contato);setVal('crm-o-email',opp.email||'');
    setVal('crm-o-data-contato',opp.dataContato||opp.createdAt?(opp.dataContato||opp.createdAt.slice(0,10)):'');
    setVal('crm-o-valor',opp.valor||'');setVal('crm-o-fechamento',opp.fechamento_real||opp.fechamento||'');
    setVal('crm-o-prioridade',opp.prioridade||'');setVal('crm-o-potencial',opp.potencial||'');setVal('crm-o-notas',opp.notas);
    setVal('crm-o-largura',opp.largura||'');setVal('crm-o-altura',opp.altura||'');
    setVal('crm-o-abertura',opp.abertura||'');setVal('crm-o-modelo',opp.modelo||'');
    setVal('crm-o-folhas',opp.folhas||'1');
    setVal('crm-o-cor-ext',opp.cor_ext||'');setVal('crm-o-cor-int',opp.cor_int||'');setVal('crm-o-cor-macico',opp.cor_macico||'');
    setVal('crm-o-reserva',opp.reserva||'');setVal('crm-o-agp',opp.agp||'');
    setVal('crm-o-cep',opp.cep||'');
    // Instalação
    setVal('crm-o-inst-quem',opp.inst_quem||'PROJETTA');
    setVal('crm-o-inst-valor',opp.inst_valor||'');
    setVal('crm-o-inst-transp',opp.inst_transp||'');
    setVal('crm-o-inst-pais',opp.inst_pais||'');
    // ★ INCOTERM + CIF load
    setVal('crm-o-inst-incoterm',opp.inst_incoterm||'');
    setVal('crm-o-cif-caixa-l',opp.cif_caixa_l||'');
    setVal('crm-o-cif-caixa-a',opp.cif_caixa_a||'');
    setVal('crm-o-cif-caixa-e',opp.cif_caixa_e||'');
    setVal('crm-o-cif-caixa-taxa',opp.cif_caixa_taxa||100);
    setVal('crm-o-cif-frete-terrestre',opp.cif_frete_terrestre||1700);
    setVal('crm-o-cif-frete-maritimo',opp.cif_frete_maritimo||'');
    setVal('crm-o-inst-aero',opp.inst_aero||'');
    setVal('crm-o-inst-porte',opp.inst_porte||'M');
    setVal('crm-o-inst-pessoas',opp.inst_pessoas||3);
    setVal('crm-o-inst-dias',opp.inst_dias||3);
    setVal('crm-o-inst-udigru',opp.inst_udigru||2000);
    setVal('crm-o-inst-passagem',opp.inst_passagem||10000);
    setVal('crm-o-inst-hotel',opp.inst_hotel||1700);
    setVal('crm-o-inst-alim',opp.inst_alim||300);
    setVal('crm-o-inst-seguro',opp.inst_seguro||300);
    setVal('crm-o-inst-carro',opp.inst_carro||850);
    setVal('crm-o-inst-mo',opp.inst_mo||500);
    setVal('crm-o-inst-margem',opp.inst_margem||10);
    setVal('crm-o-inst-cambio',opp.inst_cambio||5.20);
    if(typeof crmInstQuemChange==='function') crmInstQuemChange();
    // ★ Após restaurar inst_quem e inst_incoterm, garantir que bloco CIF
    //   aparece se for CIF (e recalcula total).
    if(typeof crmIncotermChange==='function') crmIncotermChange();
    var cepSt=el('crm-cep-status');if(cepSt)cepSt.textContent='';
    crmSetScope(opp.scope||'nacional');
    if(opp.scope==='internacional'){setVal('crm-o-pais',opp.pais);setVal('crm-o-cidade-intl',opp.cidade);}
    else{setVal('crm-o-estado',opp.estado||'');setVal('crm-o-cidade-nac',opp.cidade||'');}
    // Load attachments from cloud
    _modalAttachs=[];
    crmRenderAttachments();
    var loadingDiv=el('crm-attach-grid');
    if(loadingDiv)loadingDiv.innerHTML='<div style="font-size:11px;color:var(--hint);padding:6px 0">⏳ Carregando anexos...</div>';
    crmLoadAttachCloud(editId,function(cloudAttachs){
      _modalAttachs=cloudAttachs||[];
      crmRenderAttachments();
    });
    // Render revision history
    var revSec=el('crm-revisoes-section');
    var revList=el('crm-revisoes-list');
    if(revSec&&revList){
      // ═══ Abas de Opções (Opção 1 | Opção 2 | +) ═══════════════════════
      // Cada card pode ter múltiplas opções (ex: cliente quer cotar dois
      // modelos). Cada opção tem seu próprio histórico de revisões.
      revSec.style.display='block';

      // ROLLBACK Felipe 20/04: opções multi-camada removidas. Cada card
      // volta a ter um único orçamento com revisões. UI simples.
      var ah = '';

      if(opp.revisoes&&opp.revisoes.length>0){
        var rh = ah;
        rh+='<table style="width:100%;border-collapse:collapse;font-size:13px">';
        rh+='<tr style="border-bottom:2px solid var(--border-light)"><th style="padding:8px 10px;text-align:left;color:var(--hint);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px">Rev</th><th style="padding:8px 10px;text-align:left;color:var(--hint);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px">Data</th><th style="padding:8px 10px;text-align:right;color:var(--hint);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px">Tabela</th><th style="padding:8px 10px;text-align:right;color:var(--hint);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px">Faturamento</th><th style="width:40px"></th></tr>';
        opp.revisoes.forEach(function(rv,ri){
          var isLast=ri===opp.revisoes.length-1;
          var bg=isLast?'background:rgba(0,49,68,.06)':'';
          var revDisplay=ri===0?(rv.label||'Original'):(rv.label||'Revisão '+ri);
          // Valores: CRM revision é autoritativo (usuario aprovou esses valores)
          var _dispTab=rv.valorTabela||0, _dispFat=rv.valorFaturamento||0;
          rh+='<tr style="border-bottom:1px solid var(--border-light);'+bg+'">';
          rh+='<td style="padding:8px 10px;font-weight:700;font-size:13px;color:'+(ri===0?'#27ae60':'#9b59b6')+';cursor:pointer;text-decoration:underline" ondblclick="crmAbrirRevisao(\''+editId+'\','+ri+')" title="Duplo-clique para abrir o orçamento desta revisão">'+revDisplay+(isLast?' ✓':'')+'</td>';
          rh+='<td style="padding:8px 10px;color:var(--muted);font-size:13px">'+new Date(rv.data).toLocaleDateString('pt-BR')+'</td>';
          rh+='<td style="padding:8px 10px;text-align:right;font-weight:700;font-size:13px;color:var(--navy)">'+brl(_dispTab)+'</td>';
          rh+='<td style="padding:8px 10px;text-align:right;font-weight:800;font-size:13px;color:#e67e22">'+brl(_dispFat)+'</td>';
          var hasProposal=opp.revisoes[ri].pdfCloud||(opp.revisoes[ri].pdfPages&&opp.revisoes[ri].pdfPages.length>0);
          rh+='<td style="padding:4px 6px;text-align:center;white-space:nowrap">';
          if(hasProposal) rh+='<button onclick="event.stopPropagation();crmVerProposta(\''+editId+'\','+ri+')" style="background:none;border:1px solid #27ae60;color:#27ae60;border-radius:6px;font-size:10px;cursor:pointer;padding:3px 6px;font-weight:700;margin-right:3px" title="Ver proposta salva">📄</button>';
          rh+='<button onclick="crmDeleteRevision(\''+editId+'\','+ri+')" style="background:none;border:1px solid #e74c3c;color:#e74c3c;border-radius:6px;font-size:10px;cursor:pointer;padding:3px 6px;font-weight:700" title="Excluir revisão">✕</button></td>';
          rh+='</tr>';
        });
        rh+='</table>';
        // Dropdown para escolher qual revisão exibe no pipeline
        rh+='<div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
        rh+='<label style="font-size:11px;font-weight:700;color:var(--navy)">📊 Valor no Pipeline:</label>';
        rh+='<select id="crm-rev-pipeline-sel" onchange="crmSetPipelineRev(\''+editId+'\',this.value)" style="padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer">';
        opp.revisoes.forEach(function(rv,ri){
          var revDisplay=ri===0?(rv.label||'Original'):(rv.label||'Revisão '+ri);
          var sel=(opp.revPipeline===ri||(opp.revPipeline===undefined&&ri===opp.revisoes.length-1))?'selected':'';
          rh+='<option value="'+ri+'" '+sel+'>'+revDisplay+' — '+brl(rv.valorFaturamento||0)+'</option>';
        });
        rh+='</select>';
        rh+='</div>';
        rh+='<div style="margin-top:8px;padding:8px 10px;background:#fff9e6;border:1px dashed #ffc107;border-radius:6px;font-size:11px;color:#7a5901">💡 <b>Dê duplo-clique em uma revisão</b> acima para abrir o orçamento completo com todos os valores, inclusive para gerar ATP.</div>';
        rh+='<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">';
        rh+='<button onclick="crmFazerOrcamento(\''+editId+'\')" style="background:#e67e22;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(230,126,34,.3)" title="Abre o orçamento da opção ativa pra editar. Salva como nova revisão ao clicar Orçamento Pronto.">📋 Fazer Orçamento</button>';
        rh+='<button onclick="crmNovaRevisao(\''+editId+'\')" style="background:#003144;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer" title="[legado] Abre via DB de histórico">➕ Nova Revisão</button>';
        rh+='</div>';
        revList.innerHTML=rh;
      } else {
        // Opção sem revisões ainda (ex.: opção recém criada sem duplicação bem-sucedida)
        revList.innerHTML = ah +
          '<div style="padding:16px 12px;background:#fff9e6;border:1px dashed #ffc107;border-radius:6px;font-size:12px;color:#7a5901;margin-bottom:10px">' +
          'Esta opção ainda não tem revisões. Clique em <b>Fazer Orçamento</b> pra criar a primeira.' +
          '</div>' +
          '<button onclick="crmFazerOrcamento(\''+editId+'\')" style="background:#e67e22;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(230,126,34,.3)">📋 Fazer Orçamento</button>';
      }
    }
  } else {
    ['crm-o-cliente','crm-o-contato','crm-o-email','crm-o-valor','crm-o-notas','crm-o-pais','crm-o-cidade-intl','crm-o-cidade-nac','crm-o-largura','crm-o-altura','crm-o-cep'].forEach(function(id){setVal(id,'');});
    _crmItens=[];_crmItensRender();
    setVal('crm-o-data-contato',new Date().toISOString().slice(0,10));
    setVal('crm-o-fechamento','');setVal('crm-o-prioridade','');setVal('crm-o-potencial','');
    setVal('crm-o-abertura','');setVal('crm-o-modelo','');setVal('crm-o-estado','');
    setVal('crm-o-folhas','');setVal('crm-o-reserva','');setVal('crm-o-agp','');setVal('crm-o-cor-ext','');setVal('crm-o-cor-int','');
    setVal('crm-o-inst-quem','PROJETTA');setVal('crm-o-inst-valor','');setVal('crm-o-inst-transp','');
    setVal('crm-o-inst-pais','');setVal('crm-o-inst-aero','');setVal('crm-o-inst-porte','M');
    // ★ Reset incoterm + CIF
    setVal('crm-o-inst-incoterm','');
    setVal('crm-o-cif-caixa-l','');setVal('crm-o-cif-caixa-a','');setVal('crm-o-cif-caixa-e','');setVal('crm-o-cif-caixa-taxa',100);
    setVal('crm-o-cif-frete-terrestre',1700);setVal('crm-o-cif-frete-maritimo','');
    setVal('crm-o-inst-pessoas',3);setVal('crm-o-inst-dias',3);setVal('crm-o-inst-udigru',2000);
    setVal('crm-o-inst-passagem',10000);setVal('crm-o-inst-hotel',1700);setVal('crm-o-inst-alim',300);
    setVal('crm-o-inst-seguro',300);setVal('crm-o-inst-carro',850);setVal('crm-o-inst-mo',500);
    setVal('crm-o-inst-margem',10);setVal('crm-o-inst-cambio',5.20);
    if(typeof crmInstQuemChange==='function') crmInstQuemChange();
    var cepSt=el('crm-cep-status');if(cepSt)cepSt.textContent='';
    crmSetScope('nacional');showWeikunField(false);
    _modalAttachs=[];crmRenderAttachments();
    // Hide revision history for new entries
    var revSec=el('crm-revisoes-section');if(revSec)revSec.style.display='none';
  }
  modal.classList.add('open');
  setTimeout(function(){var c=el('crm-o-cliente');if(c)c.focus();crmCheckFieldHighlights();},120);
};
window.crmCloseModal=function(_reason){
  var m = el('crm-opp-modal');
  if(m) m.classList.remove('open');
  _editId=null;
  // Log com stack pra diagnosticar fechamentos espúrios
  try { console.log('[crm] crmCloseModal('+(_reason||'?')+')', new Error().stack); } catch(e){}
};

// ═════════════════════════════════════════════════════════════════════
// Safe bg-close: só fecha se mousedown E mouseup foram NO BACKGROUND.
// Evita fechar quando usuário:
//  - começa clique dentro de input e arrasta/solta fora (seleção de texto)
//  - usa scroll/touch longo que acaba disparando click no bg
//  - interage com dropdown nativo que se desmonta e deixa target=bg
// Padrão usado em Bootstrap, Material-UI, etc.
// ═════════════════════════════════════════════════════════════════════
(function installBgClose(){
  function _setup(){
    var bg = document.getElementById('crm-opp-modal');
    if(!bg){ setTimeout(_setup, 100); return; }
    if(bg._bgCloseInstalled) return;
    bg._bgCloseInstalled = true;
    var downOnBg = false;
    bg.addEventListener('mousedown', function(e){
      downOnBg = (e.target === bg);
    });
    bg.addEventListener('mouseup', function(e){
      if(downOnBg && e.target === bg){
        window.crmCloseModal('click-bg');
      }
      downOnBg = false;
    });
    // Touch equivalents (mobile)
    bg.addEventListener('touchstart', function(e){
      downOnBg = (e.target === bg);
    }, { passive: true });
    bg.addEventListener('touchend', function(e){
      if(downOnBg && e.target === bg){
        window.crmCloseModal('touch-bg');
      }
      downOnBg = false;
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _setup);
  } else {
    _setup();
  }
})();

/* ── SAVE — captura TODOS os campos diretamente ──── */
// Buscar Reserva Weiku no CRM modal
window.crmBuscarReservaWeiku=function(){
  var numEl=document.getElementById('crm-o-reserva');
  var num=(numEl?numEl.value:'').trim();
  var status=document.getElementById('crm-reserva-status');
  if(!num){if(status){status.textContent='⚠ Digite o nº da reserva';status.style.color='#b71c1c';}return;}
  if(status){status.textContent='⏳ Buscando reserva '+num+' na Weiku...';status.style.color='var(--orange)';}

  // Helper: preencher campos do CRM modal a partir dos dados encontrados
  function _preencherCRM(found){
    var nome=found.nome||found.cliente||found.name||found.razao_social||'';
    var email=found.email||found.e_mail||'';
    var tel=found.telefone||found.fone||found.whatsapp||found.celular||found.phone||'';
    var cep=found.cep||found.zip||'';
    var agp=found.agp||found.ag||found.num_agp||found.codigo_agp||'';
    var cidade=found.cidade||found.city||'';
    var uf=found.uf||found.estado||found.state||'';
    var cidadeUf=found.cidade_uf||(cidade&&uf?cidade+'/'+uf:cidade||'');
    var rep=found.representante||found.rep||found.vendedor||found.follow_up||'';
    var produto=found.produto||found.product||found.reserva_para||'';

    var nEl=document.getElementById('crm-o-cliente');if(nEl&&nome)nEl.value=typeof _toTitleCase==='function'?_toTitleCase(nome):nome;
    var eEl=document.getElementById('crm-o-email');if(eEl&&email)eEl.value=email;
    var tEl=document.getElementById('crm-o-contato');if(tEl&&tel)tEl.value=tel;
    if(cep&&cep!=='XXX'){var cEl=document.getElementById('crm-o-cep');if(cEl){cEl.value=cep;if(typeof crmBuscarCep==='function')setTimeout(crmBuscarCep,300);}}
    var aEl=document.getElementById('crm-o-agp');if(aEl&&agp)aEl.value=agp;

    // Cidade/UF
    if(cidadeUf){
      var parts=cidadeUf.split('/');
      var crmCidade=document.getElementById('crm-o-cidade');if(crmCidade)crmCidade.value=(parts[0]||'').trim();
      var crmUf=document.getElementById('crm-o-estado');
      if(crmUf&&(parts[1]||uf)){
        var ufVal=(parts[1]||uf||'').trim().toUpperCase();
        for(var i=0;i<crmUf.options.length;i++){
          if(crmUf.options[i].value===ufVal||crmUf.options[i].text.toUpperCase().indexOf(ufVal)>=0){crmUf.selectedIndex=i;break;}
        }
      }
    }

    // Representante Weiku
    if(rep){
      var repW=document.getElementById('crm-o-wrep');
      if(!repW) repW=document.getElementById('crm-o-rep-weiku');
      if(repW){
        var rn=rep.toUpperCase();
        for(var i=0;i<repW.options.length;i++){
          if(repW.options[i].text.toUpperCase().indexOf(rn)>=0){repW.selectedIndex=i;break;}
        }
      }
    }

    // Produto
    if(produto){
      var prodHidden=document.getElementById('crm-o-produto');
      var prodText=document.getElementById('crm-o-product-text');
      if(prodHidden){
        var pn=produto.toUpperCase();
        var products=gProducts();
        var pm=products.find(function(p){return p.toUpperCase().indexOf(pn)>=0;});
        if(pm){prodHidden.value=pm;if(prodText)prodText.textContent=pm;}
      }
    }

    // Status
    var campos=[];
    if(nome)campos.push('Nome');if(email)campos.push('Email');if(tel)campos.push('WhatsApp');
    if(cep&&cep!=='XXX')campos.push('CEP');if(cidadeUf)campos.push('Cidade');if(rep)campos.push('Rep');if(agp)campos.push('AGP');
    if(status){
      status.innerHTML='✅ <b>'+num+'</b> — '+(typeof _toTitleCase==='function'?_toTitleCase(nome):nome)+(cidadeUf?' | '+cidadeUf:'')+(agp?' | <span style="color:#c0392b;font-weight:800">'+agp+'</span>':'')+' <span style="color:#888">('+campos.join(', ')+')</span>';
      status.style.color='#27ae60';
    }
  }

  // 1) Tentar API Weiku direta
  fetch('https://intranet.weiku.com.br/v2/api/reservas/reserva/'+num,{
    method:'GET',headers:{'Accept':'application/json'},mode:'cors'
  }).then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }).then(function(data){
    // API pode retornar objeto direto ou {data: {...}} ou array
    var found=data;
    if(data.data) found=data.data;
    if(Array.isArray(found)) found=found[0];
    if(!found||(!found.nome&&!found.cliente&&!found.name&&!found.razao_social)){
      throw new Error('Reserva não encontrada na API');
    }
    console.log('[WeikuAPI] Reserva '+num+' encontrada:', found);
    _preencherCRM(found);
  }).catch(function(apiErr){
    console.warn('[WeikuAPI] Falha, tentando Supabase:', apiErr.message);
    if(status){status.textContent='⏳ API indisponível, buscando no cache...';status.style.color='var(--orange)';}
    // 2) Fallback: Supabase cache
    var SB='https://plmliavuwlgpwaizfeds.supabase.co';
    var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
    Promise.all([
      fetch(SB+'/rest/v1/configuracoes?chave=eq.weiku_reservas_detalhe&select=valor&limit=1',{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}}).then(function(r){return r.json();}),
      fetch(SB+'/rest/v1/configuracoes?chave=eq.weiku_reservas&select=valor&limit=1',{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}}).then(function(r){return r.json();})
    ]).then(function(results){
      var detalhes=(results[0]&&results[0][0]&&results[0][0].valor)?results[0][0].valor.reservas:[];
      var basicas=(results[1]&&results[1][0]&&results[1][0].valor)?results[1][0].valor.reservas:[];
      var found=detalhes.find(function(r){return r.reserva===num;})||basicas.find(function(r){return r.reserva===num||r.ag===num;});
      if(!found){
        if(status){status.textContent='⚠ Reserva '+num+' não encontrada (API offline + cache vazio)';status.style.color='#b71c1c';}
        return;
      }
      _preencherCRM(found);
    }).catch(function(e){
      if(status){status.textContent='❌ Erro: '+e.message;status.style.color='#b71c1c';}
    });
  });
};


/* ═══ CRM ITEMS SYSTEM ═══════════════════════════════════════════ */
window._crmItens = [];

var CRM_ITEM_TYPES = {
  porta_pivotante: {label:'Porta Pivotante', icon:'🚪', desc:'Porta de entrada com pivô'},
  fixo:            {label:'Fixo / Lateral',   icon:'🔲', desc:'Vidro fixo, lateral ou bandeira'},
  porta_interna:   {label:'Porta Interna',    icon:'🚪', desc:'Porta interna giro ou correr'},
  revestimento:    {label:'Revestimento',     icon:'🧱', desc:'Painel de revestimento ACM/Alumínio'}
};

window._crmGetCorOptions=function(mode){
  // mode: 'alu' = ALU categories only; default = ACM full list
  if(mode==='alu'){
    return '<option value="">— Selecione —</option><option value="ALU SOLIDA METALIZADA">Sólida / Metalizada</option><option value="ALU MADEIRA">Madeira</option>';
  }
  var mainSel=document.getElementById('carac-cor-ext');
  if(mainSel&&mainSel.options.length>1){
    var h='<option value="">— Selecione —</option>';
    for(var i=1;i<mainSel.options.length;i++) h+='<option value="'+mainSel.options[i].value+'">'+mainSel.options[i].text+'</option>';
    return h;
  }
  return '<option value="">— Selecione —</option>';
}

/* ★ crmItemRevCalc (Felipe 22/04) ─────────────────────────────────────
   Calculo ao vivo de Revestimento de Parede.
   Regras:
   - Chapa ACM 4mm: largura util 1490mm (limite 1500mm). Divide largura
     em N chapas inteiras de 1490 + pedaço restante. Exemplo Felipe:
     4500×3000 → 3×(1490×3000) + 1×(30×3000). Pedaço <= 5mm é ignorado
     (inutilizável). Altura passa direto ate 3200mm; acima disso avisa.
   - Ripado: cada ripa tem 98mm largura. Qtd ripas = ceil(largura/98).
     Altura de cada ripa = altura do revestimento. Tubo padrão PA-51X25.
   - Estrutura Alumínio: barras verticais a cada ~500mm + horizontais
     topo e base. Tubo escolhido pelo user (dropdown).
   - Fita DFIX Transp 1,0mm×12mm×20m (PA-FITDF 12X20X1.0): ~12m por m² de chapa (linha dupla).
   - Silicone estrutural Dow Corning PRIME 995: ~25ml por m² chapa.
   Ainda preliminar — Felipe vai refinar as formulas depois.
*/
window.crmItemRevCalc=function(itemId){
  var pre='crmit-'+itemId+'-';
  var _v=function(id){var e=document.getElementById(id);return e?(e.value||'').trim():'';};
  var _n=function(id){return parseFloat(_v(id))||0;};

  // Sync visibility do wrap do tubo com estrutura SIM/NAO
  var estrutura=_v(pre+'rev_estrutura');
  var wrap=document.getElementById(pre+'rev_tubo_wrap');
  if(wrap) wrap.style.display=(estrutura==='SIM')?'':'none';

  var L=_n(pre+'largura');
  var A=_n(pre+'altura');
  var Q=parseInt(_v(pre+'qtd'))||1;
  var tipo=_v(pre+'rev_tipo')||'CHAPA';
  var tubo=_v(pre+'rev_tubo')||'PA-51X12X1.58';

  var info=document.getElementById(pre+'rev_info');
  if(!info) return;
  if(!L||!A){info.innerHTML='— Preencha Largura e Altura para calcular —';return;}

  var LARG_CHAPA=1500, LARG_UTIL=1490;
  var lines=[];
  lines.push('<b>📐 Medidas:</b> '+L+'×'+A+'mm · Qtd: '+Q+' · Área unit: '+((L*A)/1e6).toFixed(2)+'m²');
  lines.push('<b>📐 Área total:</b> '+((L*A*Q)/1e6).toFixed(2)+'m²');

  if(tipo==='CHAPA'){
    var nInt=Math.floor(L/LARG_UTIL);
    var sobra=L-(nInt*LARG_UTIL);
    var pedaco=sobra>5?sobra:0; // <=5mm considerado inutilizavel
    var totChapas=(nInt+(pedaco>0?1:0))*Q;
    var detalhe=nInt+'×(1490×'+A+')';
    if(pedaco>0) detalhe+=' + 1×('+Math.round(pedaco)+'×'+A+')';
    lines.push('<b>📋 Divisão de chapa:</b> '+detalhe+(Q>1?'  (por peça, total ×'+Q+')':''));
    lines.push('<b>🪟 Chapas ACM 4mm:</b> '+totChapas+' un');
    if(A>3200) lines.push('<span style="color:#c62828">⚠ Altura '+A+'mm excede 3200 — revisar divisão vertical</span>');
    // Fita DFIX Transp 1,0mm×12mm×20m (PA-FITDF 12X20X1.0) — estimativa 12m/m² (linhas paralelas a cada 300mm)
    var fitaM=((L*A*Q)/1e6)*12;
    lines.push('<b>🔖 Fita DFIX Transp 1,0mm×12mm×20m (PA-FITDF 12X20X1.0):</b> '+fitaM.toFixed(1)+' m');
    // Silicone estrutural Dow Corning 995 PRIME — 25ml/m²
    var silML=((L*A*Q)/1e6)*25;
    var silTubos=Math.ceil(silML/300); // tubos de 300ml
    lines.push('<b>🧴 Silicone Dow Corning 995 PRIME:</b> '+silML.toFixed(0)+' ml ('+silTubos+' tubo(s) 300ml)');
  } else if(tipo==='RIPADO'){
    var nRipas=Math.ceil(L/98);
    var totRipas=nRipas*Q;
    lines.push('<b>📋 Ripas (98mm cada):</b> '+nRipas+' un × '+A+'mm de altura'+(Q>1?'  (por peça, total ×'+Q+')':''));
    lines.push('<b>🪵 Total ripas ACM:</b> '+totRipas+' un');
    // ★ Felipe 23/04: CHAPA DE FUNDO (L×A). Divide L por 1490 util + pedaço se sobra>5.
    var _nIntFundo=Math.floor(L/1490);
    var _sobraFundo=L-(_nIntFundo*1490);
    var _pedFundo=_sobraFundo>5?_sobraFundo:0;
    var _chFundoUn=(_nIntFundo+(_pedFundo>0?1:0))*Q;
    var _detFundo=_nIntFundo+'×(1490×'+A+')'+(_pedFundo>0?' + 1×('+Math.round(_pedFundo)+'×'+A+')':'');
    lines.push('<b>🪟 Chapa ACM fundo (atrás das ripas):</b> '+_chFundoUn+' un · '+_detFundo);
    // ★ Felipe 23/04: TUBOS PA-51X12X1.58 de 500mm p/ fixação das ripas.
    //   MESMO perfil que a porta com ripado usa (PA-51X12X1.58).
    //   Qty = ceil(altura/1000) por ripa × total de ripas.
    var _nTubosPorRipa=Math.max(1, Math.ceil(A/1000));
    var _totTubos=_nTubosPorRipa*totRipas;
    lines.push('<b>🔩 Tubos PA-51×25×1.5 (500mm):</b> '+_totTubos+' un <small style="color:#888">('+_nTubosPorRipa+' por ripa × '+totRipas+' ripas)</small>');
    // ★ Felipe 22/04: calcular quantas CHAPAS saem dessas ripas.
    //   Chapa 1500mm largura, util 1490mm. Ripas de 90mm cabem 16 na largura
    //   (1490/90=16,55 → 16 ripas inteiras). Altura da chapa precisa comportar
    //   a altura da ripa (A): usa 5000, 6000 ou 7000 conforme A. Quantas ripas
    //   empilhadas verticalmente cabem = floor(chapaAlt/A).
    var _chapaAlt=5000;
    if(A>4990) _chapaAlt=6000;
    if(A>5990) _chapaAlt=7000;
    if(A>6990) _chapaAlt=0; // excede
    if(_chapaAlt===0){
      lines.push('<span style="color:#c62828">⚠ Altura da ripa '+A+'mm excede 7000mm — fora do padrão de chapa</span>');
    } else {
      var _ripasLarg=Math.floor(1490/98); // 15 (1490÷98=15.2 → 15 ripas de 98mm por chapa)
      var _ripasAlt=Math.floor(_chapaAlt/A);
      var _ripasPorChapa=_ripasLarg*_ripasAlt;
      var _nChapas=Math.ceil(totRipas/_ripasPorChapa);
      lines.push('<b>🪟 Chapas ACM p/ produzir ripas (1500×'+_chapaAlt+'mm):</b> '+_nChapas+' un · '+
                 _ripasPorChapa+' ripa(s) por chapa ('+_ripasLarg+' na largura × '+_ripasAlt+' na altura)');
      // Fita e silicone — mesma regra da CHAPA, usando area util do revestimento
      var _fitaRip=((L*A*Q)/1e6)*12;
      lines.push('<b>🔖 Fita DFIX Transp 1,0mm×12mm×20m (PA-FITDF 12X20X1.0):</b> '+_fitaRip.toFixed(1)+' m');
      var _silMLRip=((L*A*Q)/1e6)*25;
      var _silTubRip=Math.ceil(_silMLRip/300);
      lines.push('<b>🧴 Silicone Dow Corning 995 PRIME:</b> '+_silMLRip.toFixed(0)+' ml ('+_silTubRip+' tubo(s) 300ml)');
    }
  }

  // Estrutura de aluminio (aplicavel a ambos tipos)
  if(estrutura==='SIM'){
    var tuboLabel=tubo.replace('PA-','').replace(/X/g,'×');
    if(tipo==='RIPADO'){
      // Montante vertical atras de cada 3a ripa (~270mm) + travessas topo e base
      var nMontantes=Math.max(2, Math.ceil(L/270));
      var metrosMontantes=(nMontantes*A/1000)*Q;
      var metrosTravessas=(2*L/1000)*Q;
      var totM=metrosMontantes+metrosTravessas;
      var barras6m=Math.ceil(totM/6);
      lines.push('<b>🏗️ Estrutura '+tuboLabel+':</b> '+nMontantes+' montante(s) × '+A+'mm + 2 travessas × '+L+'mm');
      lines.push('&nbsp;&nbsp;&nbsp; → '+totM.toFixed(1)+'m total ('+barras6m+' barra(s) de 6m)');
    } else { // CHAPA
      // Quadro fixo: perimetro + divisoes verticais a cada 500mm
      var nDiv=Math.max(0,Math.ceil(L/500)-1);
      var metrosPerim=(2*(L+A)/1000)*Q;
      var metrosDiv=(nDiv*A/1000)*Q;
      var totM=metrosPerim+metrosDiv;
      var barras6m=Math.ceil(totM/6);
      lines.push('<b>🏗️ Estrutura '+tuboLabel+':</b> perímetro + '+nDiv+' divisão(ões) vertical a cada 500mm');
      lines.push('&nbsp;&nbsp;&nbsp; → '+totM.toFixed(1)+'m total ('+barras6m+' barra(s) de 6m)');
    }
  } else {
    lines.push('<span style="color:#888">ℹ Sem estrutura de alumínio — colagem direta na parede</span>');
  }

  info.innerHTML=lines.join('<br>');
};

/* ★ crmItemRevAddChapa (Felipe 22/04) ───────────────────────────────
   Duplica um item de revestimento abaixo, mantendo a configuracao
   (Tipo CHAPA/RIPADO, Estrutura SIM/NAO, Tubo, Cor interna/externa).
   Zera dimensoes e qtd pra user preencher o proximo revestimento
   rapidamente. Scrolla e foca no campo Largura do novo item.
*/
window.crmItemRevAddChapa=function(origId){
  // Persistir valores atuais antes de rerenderizar
  if(typeof _crmItensSaveFromDOM==='function') _crmItensSaveFromDOM();
  var orig=_crmItens.find(function(i){return i.id===origId;});
  if(!orig) return;
  var item={
    id:'ci_'+Date.now()+'_'+Math.random().toString(36).substr(2,4),
    tipo:'revestimento',
    qtd:1, largura:'', altura:'',
    // Herdar configuracao (Felipe: "mesma configuracao")
    rev_tipo: orig.rev_tipo||'CHAPA',
    rev_estrutura: orig.rev_estrutura||'NAO',
    rev_tubo: orig.rev_tubo||'PA-51X12X1.58',
    tipo_material: orig.tipo_material||'ACM',
    revestimento_lados: orig.revestimento_lados||'1',
    tem_estrutura: orig.tem_estrutura||'NÃO',
    cor_ext: orig.cor_ext||'',
    cor_int: orig.cor_int||'',
    cor_macico: orig.cor_macico||''
  };
  _crmItens.push(item);
  _crmItensRender();
  setTimeout(function(){
    var el=document.getElementById('crm-item-'+item.id);
    if(el){ el.classList.add('open'); el.scrollIntoView({behavior:'smooth',block:'nearest'}); }
    var larg=document.getElementById('crmit-'+item.id+'-largura');
    if(larg) larg.focus();
  },100);
};

window._crmSwitchCorMode=function(itemId){
  var pre='crmit-'+itemId+'-';
  // ★ Maciço (boiserie) só é aplicável em MODELO 23. Se modelo != 23,
  //   força ACM e esconde cor_macico — mesmo se moldura_rev tiver valor
  //   "MACICO" residual de quando o item estava em modelo 23.
  //   Bug Felipe 20/04: ao trocar modelo 23→01, cor_macico ficava grudado
  //   porque moldura_rev ainda estava "MACICO" no DOM (bloco escondido).
  var modEl=document.getElementById(pre+'modelo');
  var modelo=modEl?modEl.value:'';
  var revEl=document.getElementById(pre+'moldura_rev');
  var rev=revEl?revEl.value:'ACM';
  var isMac = (modelo==='23' && rev==='MACICO');
  // Se modelo não é 23, normaliza moldura_rev pra ACM (evita bug ao voltar
  // pro modelo 23 e achar MACICO travado sem o usuário ter re-escolhido)
  if(modelo !== '23' && revEl && revEl.value !== 'ACM'){
    revEl.value = 'ACM';
  }
  // Toggle cor_int (ACM only) vs cor_macico (MACICO only)
  var corIntEl=document.getElementById(pre+'cor_int');
  var corMacEl=document.getElementById(pre+'cor_macico');
  if(corIntEl){var f=corIntEl.closest('.crm-field');if(f)f.style.display=isMac?'none':'';}
  if(corMacEl){var f=corMacEl.closest('.crm-field');if(f)f.style.display=isMac?'':'none';}
  // Label cor_ext
  var corExtLbl=document.getElementById(pre+'cor_ext');
  if(corExtLbl){var lbl=corExtLbl.closest('.crm-field');if(lbl){var lb=lbl.querySelector('label');if(lb)lb.textContent=isMac?'Cor ACM':'Cor Externa';}}
}

window.crmItemAdd=function(){
  // Show type picker
  var list=document.getElementById('crm-itens-list');
  var empty=document.getElementById('crm-itens-empty');
  // Check if picker already open
  if(document.getElementById('crm-type-picker')){document.getElementById('crm-type-picker').remove();return;}
  var picker=document.createElement('div');
  picker.id='crm-type-picker';
  picker.className='crm-type-picker';
  Object.keys(CRM_ITEM_TYPES).forEach(function(key){
    var t=CRM_ITEM_TYPES[key];
    picker.innerHTML+='<div class="crm-type-btn'+(t.disabled?' disabled':'')+'" onclick="'+(t.disabled?'':'crmItemCreate(\''+key+'\')')+'"><span class="icon">'+t.icon+'</span><span class="lbl">'+t.label+'</span><span class="desc">'+t.desc+'</span></div>';
  });
  list.parentNode.insertBefore(picker,list);
}

window.crmItemCreate=function(tipo){
  var picker=document.getElementById('crm-type-picker');if(picker)picker.remove();
  var item={
    id:'ci_'+Date.now()+'_'+Math.random().toString(36).substr(2,4),
    tipo:tipo,
    qtd:1,
    largura:'',altura:'',
    cor_ext:'',cor_int:'',cor_macico:''
  };
  if(tipo==='porta_pivotante'){
    item.modelo='';item.abertura='PIVOTANTE';item.folhas='';
    item.fech_mec='';item.fech_dig='NÃO SE APLICA';item.cilindro='KESO';item.puxador='';
    item.dist_borda_cava='210';item.largura_cava='150';item.cantoneira_cava='30';
    item.tem_alisar=true;
  }
  if(tipo==='fixo'){
    item.tipo_fixacao='';item.revestimento_lados='';item.tem_estrutura='';
    item.tipo_material='';item.tipo_vidro='';
  }
  if(tipo==='porta_interna'){
    item.sistema_pi='GIRO';item.folhas_pi='1';
  }
  if(tipo==='revestimento'){
    // ★ Revestimento (Felipe 22/04): painel independente de ACM ou Aluminio
    //   Maciço. Defaults conservadores — ACM 4mm, 1 lado, sem estrutura.
    //   Campos especificos ainda a definir; usa o mesmo branch 'else' do
    //   renderer por enquanto (qtd + dimensoes + cor).
    item.tipo_material='ACM';
    item.revestimento_lados='1';
    item.tem_estrutura='NÃO';
  }
  _crmItens.push(item);
  _crmItensRender();
  setTimeout(function(){
    var el=document.getElementById('crm-item-'+item.id);
    if(el)el.classList.add('open');
  },50);
}

window.crmItemRemove=function(id){
  if(!confirm('Remover este item?'))return;
  _crmItens=_crmItens.filter(function(i){return i.id!==id;});
  _crmItensRender();
}

// ── Auto-seleção por altura, modelo e fechadura digital ──
window.crmItemAutoSelect=function(id){
  var item=_crmItens.find(function(i){return i.id===id;});
  if(!item)return;
  // ★ Se revestimento, delega para calculo especifico e sai.
  if(item.tipo==='revestimento'){
    if(typeof crmItemRevCalc==='function') crmItemRevCalc(id);
    return;
  }
  if(item.tipo!=='porta_pivotante')return;
  var pre='crmit-'+id+'-';
  var H=parseInt((document.getElementById(pre+'altura')||{value:0}).value)||0;
  var modelo=(document.getElementById(pre+'modelo')||{value:''}).value;
  var fechDig=(document.getElementById(pre+'fech_dig')||{value:''}).value.toUpperCase();

  // Auto-select FECHADURA MECÂNICA por altura (mesma lógica de _autoSelectFechadura)
  if(H>0){
    var TUB=(typeof _isInternacional==='function'&&_isInternacional())?50.8:(H>=4000?50.8:38.1);
    var PA_F=Math.round(H-10-TUB-28+8);
    var inicio=1020;
    if(fechDig.indexOf('PHILIPS')>=0) inicio=1380;
    var opcoes=[
      {val:'24 PINOS',comp:6000},{val:'16 PINOS',comp:4000},
      {val:'12 PINOS',comp:2000},{val:'08 PINOS',comp:800},{val:'04 PINOS',comp:400}
    ];
    var sel=document.getElementById(pre+'fech_mec');
    if(sel){
      var found=false;
      for(var i=0;i<opcoes.length;i++){
        if(inicio+opcoes[i].comp<=PA_F){sel.value=opcoes[i].val;found=true;break;}
      }
      if(!found)sel.value='04 PINOS';
    }
  }

  // Auto-select PUXADOR por modelo (modelos com cava = CAVA, lisa = EXTERNO)
  if(modelo){
    var modInt=parseInt(modelo)||0;
    var cavaMods=[1,2,3,4,5,6,7,8,9,19,22,24]; // modelos com nome "cava"
    var puxSel=document.getElementById(pre+'puxador');
    if(puxSel) puxSel.value=cavaMods.indexOf(modInt)>=0?'CAVA':'EXTERNO';
    // Modelo 22: defaults cava 250/250, friso 0/0
    if(modelo==='22'){
      var dcEl=document.getElementById(pre+'dist_borda_cava');
      var lcEl=document.getElementById(pre+'largura_cava');
      var dfEl=document.getElementById(pre+'dist_borda_friso');
      var lfEl=document.getElementById(pre+'largura_friso');
      if(dcEl&&(!dcEl.value||dcEl.value==='210')) dcEl.value='250';
      if(lcEl&&(!lcEl.value||lcEl.value==='150')) lcEl.value='250';
      if(dfEl&&(!dfEl.value||dfEl.value==='150')) dfEl.value='0';
      if(lfEl&&(!lfEl.value||lfEl.value==='10')) lfEl.value='0';
    }
    // Mostrar/esconder campos de cava ao trocar modelo
    var cavaWrap=document.getElementById(pre+'cava_wrap');
    var frisoWrap=document.getElementById(pre+'friso_wrap');
    if(cavaWrap||frisoWrap){
      var _modSel2=document.getElementById(pre+'modelo');
      var _modTxt2=_modSel2&&_modSel2.selectedIndex>=0?(_modSel2.options[_modSel2.selectedIndex].text||'').toLowerCase():'';
      if(cavaWrap) cavaWrap.style.display=_modTxt2.indexOf('cava')>=0?'':'none';
      if(frisoWrap) frisoWrap.style.display=(_modTxt2.indexOf('friso')>=0||_modTxt2.indexOf('premium')>=0)?'':'none';
      // Toggle friso horizontal vs vertical
      var _isFH=(modelo==='06'||modelo==='16');
      var fhWrap=document.getElementById(pre+'friso_h_wrap');
      var fvWrap=document.getElementById(pre+'friso_v_wrap');
      if(fhWrap) fhWrap.style.display=_isFH?'':'none';
      if(fvWrap) fvWrap.style.display=_isFH?'none':'';
      // Toggle campo "Nº Frisos Verticais" (só Modelo 02)
      var fvqWrap=document.getElementById(pre+'friso_v_qty_wrap');
      if(fvqWrap) fvqWrap.style.display=(modelo==='02')?'':'none';
      // Toggle moldura section for modelo 23
      var moldWrap=document.getElementById(pre+'moldura_wrap');
      if(moldWrap) moldWrap.style.display=(modelo==='23')?'':'none';
      // Toggle ripado section for modelos 08, 15, 20, 21
      var ripWrap=document.getElementById(pre+'ripado_wrap');
      if(ripWrap) ripWrap.style.display=(['08','15','20','21'].indexOf(modelo)>=0)?'':'none';
    }
    // Switch cor options: modelo 23 MACICO → ALU only
    if(typeof _crmSwitchCorMode==='function') _crmSwitchCorMode(id);
    // Tamanho puxador: setar default e mostrar/esconder
    var puxTamRow=document.getElementById(pre+'pux_tam_row');
    var puxTamSel=document.getElementById(pre+'pux_tam');
    if(cavaMods.indexOf(modInt)<0){
      if(puxTamRow) puxTamRow.style.display='';
      // Modelo 23 (Molduras/Boiserie) = puxador enviado pelo CLIENTE por
      // padrão (peça decorativa, cliente harmoniza com hardware escolhido).
      // Outros modelos com puxador externo = default 1.5m.
      // Só auto-seta se usuário ainda não escolheu manualmente (vazio ou
      // no default 1.5); se usuário escolheu outro tamanho, respeita.
      if(puxTamSel){
        var _isVazio = !puxTamSel.value;
        var _isDefault15 = puxTamSel.value === '1.5';
        if(modelo === '23' && (_isVazio || _isDefault15)){
          puxTamSel.value = 'CLIENTE';
        } else if(modelo !== '23' && _isVazio){
          puxTamSel.value = '1.5';
        }
      }
    } else {
      if(puxTamRow) puxTamRow.style.display='none';
    }
  }

  // ★ Felipe 21/04/26: 'sempre que tiver fechadura tedee trave para keso,
  //   nao podera ser mudado para udinese no cilindro'. Fechadura Tedee
  //   requer cilindro Keso por compatibilidade tecnica.
  _tedeeLockCilindro(pre+'fech_dig', pre+'cilindro');
}

/* ★ Trava cilindro em KESO quando fechadura digital e TEDEE.
   Idempotente, funciona tanto no orcamento (carac-*) quanto no CRM
   modal (crmit-ID-*). Forca value='KESO' + disabled=true + visual
   de travado (cinza, cursor not-allowed, tooltip).
   Se fech_dig != TEDEE, re-habilita o select normalmente. */
window._tedeeLockCilindro = function(fechDigId, cilindroId){
  var fd = document.getElementById(fechDigId);
  var ci = document.getElementById(cilindroId);
  if(!fd || !ci) return;
  var isTedee = (fd.value || '').toUpperCase() === 'TEDEE';
  if(isTedee){
    ci.value = 'KESO';
    ci.disabled = true;
    ci.style.background = '#f0f0f0';
    ci.style.cursor = 'not-allowed';
    ci.title = '🔒 Travado em KESO — fechadura Tedee requer cilindro Keso';
  } else {
    ci.disabled = false;
    ci.style.background = '';
    ci.style.cursor = '';
    ci.title = '';
  }
};

// Toggle puxador tamanho visibility no CRM item
window.crmItemPuxChange=function(id){
  var pre='crmit-'+id+'-';
  var pux=(document.getElementById(pre+'puxador')||{value:''}).value;
  var row=document.getElementById(pre+'pux_tam_row');
  if(row) row.style.display=pux==='EXTERNO'?'':'none';
  if(pux==='EXTERNO'){
    var tam=document.getElementById(pre+'pux_tam');
    if(tam&&!tam.value){
      // ★ Felipe 21/04: Modelo 23 (Molduras) → CLIENTE default.
      //   Outros modelos com externo → 1.5 default.
      var mod=(document.getElementById(pre+'modelo')||{value:''}).value;
      tam.value = (mod === '23') ? 'CLIENTE' : '1.5';
    }
  }
}

// Trigger auto-select when altura changes
window.crmItemAlturaChange=function(id){
  crmItemAutoSelect(id);
}

// Show/hide vidro field for fixo items
window.crmItemFixoMaterial=function(id){
  var pre='crmit-'+id+'-';
  var mat=(document.getElementById(pre+'tipo_material')||{value:''}).value;
  var wrap=document.getElementById(pre+'vidro_wrap');
  if(wrap) wrap.style.display=mat==='VIDRO'?'':'none';
  // Toggle cor: MACICO → Cor ACM + Cor Maciço | outros → Cor Ext + Cor Int
  var isMac=mat==='MACICO';
  var corIntW=document.getElementById(pre+'cor_int_wrap');
  var corMacW=document.getElementById(pre+'cor_mac_wrap');
  if(corIntW) corIntW.style.display=isMac?'none':'';
  if(corMacW) corMacW.style.display=isMac?'':'none';
  var corExtLbl=document.getElementById(pre+'cor_ext');
  if(corExtLbl){var lbl=corExtLbl.closest('.crm-field');if(lbl){var lb=lbl.querySelector('label');if(lb)lb.textContent=isMac?'Cor ACM':'Cor Externa';}}
}

// Show/hide instalação fields based on Quem instala
window.crmInstQuemChange=function(){
  var sel=document.getElementById('crm-o-inst-quem');
  var terc=document.getElementById('crm-inst-terceiros');
  if(!sel)return;
  var v=sel.value;
  if(terc) terc.style.display=(v==='TERCEIROS')?'':'none';
  // Visibilidade do bloco internacional agora e OR(scope, quemInstala) — ver
  // _crmUpdateIntlVisibility. Clique em botao Internacional tambem abre este
  // bloco, sem precisar passar por Quem Instala.
  window._crmUpdateIntlVisibility();
  if(v==='INTERNACIONAL'){ crmInstCalcIntl(); crmInstFetchCambio(); }
}

// ★ Handler: mudança no dropdown Incoterm no card CRM.
//   CIF → mostrar caixa + frete terrestre + frete marítimo.
//   FOB → mostrar caixa + frete terrestre (comprador paga marítimo, fica oculto).
//   EXW/DAP/vazio → esconder bloco todo.
window.crmIncotermChange=function(){
  var sel=document.getElementById('crm-o-inst-incoterm');
  var box=document.getElementById('crm-inst-cif-box');
  if(!sel||!box)return;
  var v=sel.value;
  var showBox=(v==='CIF'||v==='FOB');
  box.style.display=showBox?'':'none';
  if(!showBox) return;

  // Ajustar título e rótulo do total conforme incoterm
  var title=document.getElementById('crm-cif-box-title');
  var totLbl=document.getElementById('crm-cif-total-label');
  var marWrap=document.getElementById('crm-cif-maritimo-wrap');
  if(v==='FOB'){
    if(title) title.innerHTML='📦 Embalagem e Frete FOB (valores em USD)';
    if(totLbl) totLbl.textContent='Total FOB (caixa + frete terrestre):';
    if(marWrap) marWrap.style.display='none';
  } else { // CIF
    if(title) title.innerHTML='📦 Embalagem e Frete CIF (valores em USD)';
    if(totLbl) totLbl.textContent='Total CIF (caixa + fretes):';
    if(marWrap) marWrap.style.display='';
  }
  crmCifRecalc();
}

// ★ Recalcular custos CIF: volume da caixa (L×A×E em mm → m³) × US$ 110 +
//   frete terrestre + frete marítimo = total CIF em USD.
window.crmCifRecalc=function(){
  var L=parseFloat((document.getElementById('crm-o-cif-caixa-l')||{value:0}).value)||0;
  var A=parseFloat((document.getElementById('crm-o-cif-caixa-a')||{value:0}).value)||0;
  var E=parseFloat((document.getElementById('crm-o-cif-caixa-e')||{value:0}).value)||0;
  var taxa=parseFloat((document.getElementById('crm-o-cif-caixa-taxa')||{value:100}).value)||100;
  // Volume em m³ (mm→m = /1000 cada dimensão)
  var vol=(L/1000)*(A/1000)*(E/1000);
  var caixaUSD=vol*taxa;

  // ★ Câmbio USD→BRL: pega do campo inst-intl-cambio se preenchido,
  //   senão 5.0 (fallback conservador). Usado só pra mostrar equivalente
  //   em R$ em linha cinza italic abaixo (so pra Felipe ver em reais,
  //   sem destacar — proposta sai so em USD).
  var cambio = parseFloat((document.getElementById('inst-intl-cambio')||{value:0}).value)||0;
  if(!cambio || cambio<=0) cambio = 5.0;
  var _fmtBRL = function(v){ return v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); };

  var infoCaixa=document.getElementById('crm-cif-caixa-info');
  if(infoCaixa){
    if(vol>0){
      infoCaixa.innerHTML='Volume: <b>'+vol.toFixed(3)+' m³</b> × <b>US$ '+taxa+'/m³</b> · Caixa: <b>US$ '+caixaUSD.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</b>';
    } else {
      infoCaixa.innerHTML='Volume: — m³ · Caixa: US$ —';
    }
  }
  var fT=parseFloat((document.getElementById('crm-o-cif-frete-terrestre')||{value:0}).value)||0;
  var fM=parseFloat((document.getElementById('crm-o-cif-frete-maritimo')||{value:0}).value)||0;
  // ★ Em FOB o comprador paga o marítimo, então zera aqui mesmo que o campo
  //   tenha valor residual de quando estava em CIF.
  var _incoterm=(document.getElementById('crm-o-inst-incoterm')||{value:''}).value;
  if(_incoterm==='FOB') fM=0;
  var total=caixaUSD+fT+fM;
  var infoTot=document.getElementById('crm-cif-total-info');
  if(infoTot){
    // Rótulo depende do incoterm: FOB não tem marítimo.
    var _totLbl=(_incoterm==='FOB')?'Total FOB (caixa + frete terrestre):':'Total CIF (caixa + fretes):';
    if(total>0){
      infoTot.innerHTML=_totLbl+' <b style="color:#c47012">US$ '+total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</b>';
    } else {
      infoTot.innerHTML=_totLbl+' US$ —';
    }
  }

  // ★ Linha extra em R$ — só pra Felipe ver equivalente em reais.
  //   NÃO aparece na proposta (ali só USD). Estilo cinza claro italic
  //   pra ficar discreto.
  var infoBRL = document.getElementById('crm-cif-brl-info');
  if(!infoBRL && infoTot && infoTot.parentNode){
    infoBRL = document.createElement('div');
    infoBRL.id = 'crm-cif-brl-info';
    infoBRL.style.cssText = 'font-size:10px;color:#999;margin-top:4px;font-style:italic;font-weight:400';
    infoTot.parentNode.insertBefore(infoBRL, infoTot.nextSibling);
  }
  if(infoBRL){
    if(total>0){
      var caixaBRL = caixaUSD * cambio;
      var fTBRL    = fT * cambio;
      var fMBRL    = fM * cambio;
      var totalBRL = total * cambio;
      var partes = [];
      if(caixaUSD>0) partes.push('caixa R$ '+_fmtBRL(caixaBRL));
      if(fT>0)       partes.push('terrestre R$ '+_fmtBRL(fTBRL));
      if(fM>0)       partes.push('marítimo R$ '+_fmtBRL(fMBRL));
      infoBRL.innerHTML = '≈ em R$ (câmbio '+cambio.toFixed(2)+'): ' + partes.join(' · ') +
                          ' &nbsp;—&nbsp; <span style="color:#777">Total: R$ '+_fmtBRL(totalBRL)+'</span>';
    } else {
      infoBRL.innerHTML = '';
    }
  }
}

// Recalcular valores em R$ da CIF quando o câmbio muda
window.crmCifRecalcBRL = function(){
  if(typeof window.crmCifRecalc === 'function') window.crmCifRecalc();
};

window.crmInstPorteChange=function(){
  var porte=(document.getElementById('crm-o-inst-porte')||{value:'M'}).value;
  var pEl=document.getElementById('crm-o-inst-pessoas');
  var dEl=document.getElementById('crm-o-inst-dias');
  if(porte==='P'){if(pEl)pEl.value=2;if(dEl)dEl.value=2;}
  if(porte==='M'){if(pEl)pEl.value=3;if(dEl)dEl.value=3;}
  if(porte==='G'){if(pEl)pEl.value=3;if(dEl)dEl.value=4;}
  crmInstCalcIntl();
}

window.crmInstCalcIntl=function(){
  var gv=function(id){return parseFloat((document.getElementById(id)||{value:0}).value)||0;};
  var pessoas=gv('crm-o-inst-pessoas');
  var diasInst=gv('crm-o-inst-dias');
  var diasViagem=4; // 2 ida + 2 volta fixo
  var diasTotal=diasInst+diasViagem;
  var cambio=gv('crm-o-inst-cambio')||5.20;
  var margemLiq=gv('crm-o-inst-margem')/100;

  var udiGru=gv('crm-o-inst-udigru');
  var passagem=gv('crm-o-inst-passagem')*pessoas;
  var diasHotel=diasTotal-2;
  var hotel=gv('crm-o-inst-hotel')*diasHotel;
  var alim=gv('crm-o-inst-alim')*pessoas*diasTotal;
  var seguro=gv('crm-o-inst-seguro')*pessoas;
  var carro=gv('crm-o-inst-carro')*diasTotal;
  var mo=gv('crm-o-inst-mo')*diasTotal;

  var custoTotal=udiGru+passagem+hotel+alim+seguro+carro+mo;

  // DRE — impostos NFS-e exportação REMOVIDOS (Felipe 20/04: não pagamos
  // imposto na NFS-e). Campo ainda existe como hidden=0 pra compat;
  // default aqui tambem e 0 caso o DOM nao tenha o input.
  var pctImp=parseFloat((document.getElementById('inst-intl-imp')||{value:0}).value)||0;
  var pctCom=0;
  var pctRep=0;
  var pctGest=0;
  var pctMargemLiq=margemLiq*100;

  // Markup: Preço = Custo / (1 - imp% - com% - rep% - gest% - margem%)
  var totalDeduc=(pctImp+pctCom+pctRep+pctGest+pctMargemLiq)/100;
  var divisor=Math.max(0.01, 1-totalDeduc);
  var precoVenda=custoTotal/divisor;
  var lucroLiq=precoVenda*margemLiq;
  var impostos=precoVenda*(pctImp/100);
  var comissao=precoVenda*(pctCom/100);
  var repasse=precoVenda*(pctRep/100);
  var gestao=precoVenda*(pctGest/100);

  var brl=function(v){return 'R$ '+_fmtBRLCeil(v);};
  var usd=function(v){return 'US$ '+(v/cambio).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var dual=function(v){return brl(v)+' <small style="color:#1565c0">('+usd(v)+')</small>';};

  var res=document.getElementById('crm-inst-intl-result');
  if(!res)return;
  var aero=(document.getElementById('crm-o-inst-aero')||{value:''}).value||'???';
  res.innerHTML=
    '<div style="font-size:9px;color:#666;margin-bottom:4px">GRU → <b>'+aero+'</b> · '+pessoas+' pess × '+diasViagem+' dias ('+diasInst+' inst + 2 viagem) · Câmbio: R$ '+cambio.toFixed(2)+'</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:9.5px">'+
    '<div>🛫 UDI→GRU: '+dual(udiGru)+'</div>'+
    '<div>✈️ Passagens ('+pessoas+'p): '+dual(passagem)+'</div>'+
    '<div>🏨 Hotel ('+diasHotel+'d): '+dual(hotel)+'</div>'+
    '<div>🍽️ Alimentação: '+dual(alim)+'</div>'+
    '<div>🏥 Seguro: '+dual(seguro)+'</div>'+
    '<div>🚗 Carro+Gas: '+dual(carro)+'</div>'+
    '<div>👷 Mão de Obra ('+diasTotal+'d): '+dual(mo)+'</div>'+
    '</div>'+
    '<hr style="margin:6px 0;border:none;border-top:1px solid #90caf9">'+
    '<div style="font-size:9px;font-weight:700;color:#1565c0;margin-bottom:3px">📊 DRE INSTALAÇÃO</div>'+
    '<div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:2px 8px;font-size:9.5px">'+
    '<div>Custo Total:</div><div>'+brl(custoTotal)+'</div><div style="color:#1565c0">'+usd(custoTotal)+'</div>'+
    (pctImp>0?'<div style="color:#c0392b">Impostos ('+pctImp.toFixed(1)+'%):</div><div style="color:#c0392b">- '+brl(impostos)+'</div><div style="color:#c0392b">- '+usd(impostos)+'</div>':'')+
    (pctCom>0?'<div>Comissão ('+pctCom.toFixed(1)+'%):</div><div>- '+brl(comissao)+'</div><div>- '+usd(comissao)+'</div>':'')+
    (pctRep>0?'<div>Repasse ('+pctRep.toFixed(1)+'%):</div><div>- '+brl(repasse)+'</div><div>- '+usd(repasse)+'</div>':'')+
    (pctGest>0?'<div>Gestão ('+pctGest.toFixed(1)+'%):</div><div>- '+brl(gestao)+'</div><div>- '+usd(gestao)+'</div>':'')+
    '</div>'+
    '<hr style="margin:4px 0;border:none;border-top:1px dashed #90caf9">'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">'+
    '<div style="color:#27ae60;font-weight:800">💰 Lucro Líq ('+pctMargemLiq.toFixed(0)+'%): '+brl(lucroLiq)+'</div>'+
    '<div style="color:#27ae60;font-weight:700">'+usd(lucroLiq)+'</div>'+
    '</div>'+
    '<div style="background:#003144;color:#fff;padding:6px 10px;border-radius:5px;margin-top:6px;display:flex;justify-content:space-between;font-size:12px;font-weight:800">'+
    '<span>PREÇO VENDA INSTALAÇÃO:</span>'+
    '<span>'+brl(precoVenda)+'</span>'+
    '</div>'+
    '<div style="text-align:right;font-size:10px;color:#1565c0;font-weight:700;margin-top:2px">'+usd(precoVenda)+'</div>';

  window._instIntlTotal=precoVenda;
  window._instIntlCusto=custoTotal;
}

window.crmInstFetchCambio=function(){
  var info=document.getElementById('crm-inst-cambio-info');
  if(info) info.textContent='Buscando cotação BCB...';
  var end=new Date();var start=new Date();start.setDate(start.getDate()-90);
  var fmt=function(d){var m=''+(d.getMonth()+1),dd=''+d.getDate(),y=d.getFullYear();return m+'/'+dd+'/'+y;};
  fetch('https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@di,dataFinalCotacao=@df)?@di=%27'+fmt(start)+'%27&@df=%27'+fmt(end)+'%27&$format=json&$select=cotacaoVenda,dataHoraCotacao')
  .then(function(r){return r.json();})
  .then(function(data){
    var vals=data.value||[];
    if(vals.length>0){
      var sum=0;vals.forEach(function(v){sum+=v.cotacaoVenda;});
      var media=(sum/vals.length).toFixed(2);
      var el=document.getElementById('crm-o-inst-cambio');
      if(el)el.value=media;
      if(info)info.textContent='✅ Média BCB ('+vals.length+' dias): R$ '+media;
      crmInstCalcIntl();
    }
  }).catch(function(e){
    if(info)info.textContent='⚠️ Erro API BCB. Usando default.';
  });
}

window.crmItemDuplicate=function(id){
  var orig=_crmItens.find(function(i){return i.id===id;});
  if(!orig)return;
  var copy=JSON.parse(JSON.stringify(orig));
  copy.id='ci_'+Date.now()+'_'+Math.random().toString(36).substr(2,4);
  _crmItens.push(copy);
  _crmItensRender();
}

window.crmItemToggle=function(id){
  // Save current open item data before toggling
  _crmItensSaveFromDOM();
  var el=document.getElementById('crm-item-'+id);
  if(el)el.classList.toggle('open');
}

/* ── Salvar Item e abrir próximo ── */
window.crmItemSaveAndNext=function(id){
  // 1. Salvar dados do item atual
  _crmItensSaveFromDOM();
  // 1b. Persistir no localStorage (sem isso, perde ao fechar/reabrir)
  if(typeof crmSaveCard==='function') try{crmSaveCard();}catch(e){}
  // 2. Fechar item atual
  var el=document.getElementById('crm-item-'+id);
  if(el) el.classList.remove('open');
  // 3. Encontrar próximo item e abrir
  var idx=_crmItens.findIndex(function(it){return it.id===id;});
  if(idx>=0 && idx<_crmItens.length-1){
    var nextId=_crmItens[idx+1].id;
    var nextEl=document.getElementById('crm-item-'+nextId);
    if(nextEl){nextEl.classList.add('open');nextEl.scrollIntoView({behavior:'smooth',block:'start'});}
  }
  // Toast
  var toast=document.createElement('div');toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:8px 18px;border-radius:16px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.2)';
  toast.textContent='💾 Item '+(idx+1)+' salvo!'+(idx<_crmItens.length-1?' → Item '+(idx+2):'');
  document.body.appendChild(toast);setTimeout(function(){toast.remove();},2000);
}

window._crmItensSaveFromDOM=function(){
  _crmItens.forEach(function(item){
    var pre='crmit-'+item.id+'-';
    var fields=['qtd','largura','altura','cor_ext','cor_int','cor_macico'];
    if(item.tipo==='porta_pivotante') fields=fields.concat(['modelo','abertura','folhas','fech_mec','fech_dig','cilindro','puxador','pux_tam','dist_borda_cava','largura_cava','cantoneira_cava','dist_borda_friso','largura_friso','friso_h_qty','friso_h_esp','friso_v_qty','refilado','moldura_rev','moldura_larg_qty','moldura_alt_qty','moldura_tipo','moldura_dis1','moldura_dis2','moldura_dis3','moldura_divisao','ripado_total','ripado_2lados']);
    if(item.tipo==='fixo') fields=fields.concat(['tipo_fixacao','tipo_vidro','revestimento_lados','tem_estrutura','tipo_material']);
    if(item.tipo==='porta_interna') fields=fields.concat(['sistema_pi','folhas_pi']);
    // ★ Felipe 22/04: campos especificos do revestimento — sem isso o
    //   crmItemRevAddChapa nao preserva a config ao duplicar.
    if(item.tipo==='revestimento') fields=fields.concat(['rev_tipo','rev_estrutura','rev_tubo','rev_2lados']);
    fields.forEach(function(f){
      var el=document.getElementById(pre+f);
      if(el) item[f]=el.value;
    });
    // Checkbox fields
    var _cbAlisar=document.getElementById(pre+'tem_alisar');
    if(_cbAlisar) item.tem_alisar=_cbAlisar.checked;
  });
}

window._crmItensRender=function(){
  var list=document.getElementById('crm-itens-list');
  var empty=document.getElementById('crm-itens-empty');
  if(!list)return;
  
  // Save current values first
  _crmItensSaveFromDOM();
  
  if(!_crmItens.length){
    list.innerHTML='';
    if(empty)empty.style.display='';
    return;
  }
  if(empty)empty.style.display='none';
  var corOpts=_crmGetCorOptions();
  var modeloOpts='<option value="">— Selecione —</option><option value="01">01 - Cava</option><option value="02">02 - Cava + Friso</option><option value="03">03 - Cava + 2 Frisos H</option><option value="04">04 - Cava + Friso V&H</option><option value="05">05 - Cava + Friso V & 2H</option><option value="06">06 - Cava + Frisos H Variável</option><option value="07">07 - Cava + Frisos V Múltiplo</option><option value="08">08 - Cava + Ripado</option><option value="09">09 - Cava Dupla</option><option value="10">10 - Lisa</option><option value="11">11 - Friso Vertical</option><option value="12">12 - Pux Ext + Friso V&H</option><option value="13">13 - Pux Ext + Friso V & 2H</option><option value="14">14 - Pux Ext + Frisos V Múltiplo</option><option value="15">15 - Ripado</option><option value="16">16 - Pux Ext + Frisos H Variável</option><option value="17">17 - Pux Ext + Frisos H Inclinado</option><option value="18">18 - Pux Ext + Geométricos</option><option value="19">19 - Cava + Geométricos</option><option value="20">20 - Pux Ext + Ripas H</option><option value="21">21 - Friso Angular</option><option value="22">22 - Cava Premium</option><option value="23">23 - Molduras</option><option value="24">24 - Cava Horizontal</option>';
  
  var h='';
  _crmItens.forEach(function(item,idx){
    var t=CRM_ITEM_TYPES[item.tipo]||{label:item.tipo,icon:'📦'};
    var dimStr=(item.largura&&item.altura)?item.largura+'×'+item.altura+'mm':'sem medidas';
    var modStr=item.modelo?('Mod '+item.modelo):'';
    var sub=[dimStr,modStr,item.cor_ext].filter(Boolean).join(' · ');
    
    h+='<div class="crm-item" id="crm-item-'+item.id+'">';
    h+='<div class="crm-item-hdr" onclick="crmItemToggle(\''+item.id+'\')">';
    h+='<span class="crm-item-icon">'+t.icon+'</span>';
    h+='<div class="crm-item-info"><div class="crm-item-title">Item '+(idx+1)+': '+t.label+'</div><div class="crm-item-sub">'+sub+'</div></div>';
    h+='<div class="crm-item-badges">';
    if(item.qtd>1) h+='<span class="crm-item-badge qty">×'+item.qtd+'</span>';
    if(item.largura&&item.altura) h+='<span class="crm-item-badge dim">'+item.largura+'×'+item.altura+'</span>';
    h+='</div>';
    h+='<span class="crm-item-chevron">▶</span>';
    h+='</div>';
    
    // Body with fields
    var pre='crmit-'+item.id+'-';
    h+='<div class="crm-item-body">';
    
    // Common fields: Qtd, Largura, Altura
    // ★ Felipe 22/04: inputs comuns ganham oninput que dispara crmItemAutoSelect
    //   — em revestimento isso delega pra crmItemRevCalc (ver crmItemAutoSelect).
    //   Pra outros tipos o handler e no-op rapido.
    // ★ Felipe 22/04 (2): revestimento tem layout com 3 campos na primeira
    //   linha (Qtd + Largura + Altura) via classe crm-row-3. Os demais tipos
    //   mantem o layout 2+2 tradicional.
    var _isRev=(item.tipo==='revestimento');
    h+='<div class="'+(_isRev?'crm-row-3':'crm-row')+'">';
    h+='<div class="crm-field"><label>Quantidade</label><input type="number" id="'+pre+'qtd" value="'+(item.qtd||1)+'" min="1" max="50" oninput="crmItemAutoSelect(\''+item.id+'\')"></div>';
    h+='<div class="crm-field"><label>Largura (mm)</label><input type="number" id="'+pre+'largura" value="'+(item.largura||'')+'" placeholder="ex: 1996" min="200" max="5000" oninput="crmItemAutoSelect(\''+item.id+'\')" onwheel="event.preventDefault()"></div>';
    if(_isRev) h+='<div class="crm-field"><label>Altura (mm)</label><input type="number" id="'+pre+'altura" value="'+(item.altura||'')+'" placeholder="ex: 4878" min="200" max="8000" oninput="crmItemAutoSelect(\''+item.id+'\')" onwheel="event.preventDefault()"></div>';
    h+='</div>';
    // Segunda row: pra nao-revestimento, abre com altura + branch.
    //              pra revestimento, abre rows proprias (tipo, estrutura, info, botao).
    if(!_isRev){
    h+='<div class="crm-row">';
    h+='<div class="crm-field"><label>Altura (mm)</label><input type="number" id="'+pre+'altura" value="'+(item.altura||'')+'" placeholder="ex: 6174" min="200" max="8000" onchange="crmItemAutoSelect(\''+item.id+'\')" onwheel="event.preventDefault()"></div>';
    
    if(item.tipo==='porta_pivotante'){
      h+='<div class="crm-field"><label>Abertura</label><select id="'+pre+'abertura"><option value="PIVOTANTE"'+(item.abertura==='PIVOTANTE'?' selected':'')+'>Pivotante</option><option value="DOBRADIÇA"'+(item.abertura==='DOBRADIÇA'?' selected':'')+'>Dobradiça</option></select></div>';
      h+='</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Modelo</label><select id="'+pre+'modelo" onchange="crmItemAutoSelect(\''+item.id+'\')"><option value="">— Selecione —</option>'+modeloOpts.replace('value="'+item.modelo+'"','value="'+item.modelo+'" selected')+'</select></div>';
      h+='<div class="crm-field"><label>Folhas</label><select id="'+pre+'folhas"><option value="">— Selecione —</option><option value="1"'+(item.folhas==='1'?' selected':'')+'>1 folha</option><option value="2"'+(item.folhas==='2'?' selected':'')+'>2 folhas</option></select></div>';
      h+='</div>';
      // Fechaduras
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">🔐 Fechaduras</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Mecânica <small style="color:#888">(auto por altura)</small></label><select id="'+pre+'fech_mec"><option value="">— Selecione —</option><option value="04 PINOS">04 pinos</option><option value="08 PINOS">08 pinos</option><option value="12 PINOS">12 pinos</option><option value="16 PINOS">16 pinos</option><option value="24 PINOS">24 pinos</option></select></div>';
      h+='<div class="crm-field"><label>Digital</label><select id="'+pre+'fech_dig" onchange="crmItemAutoSelect(\''+item.id+'\')"><option value="">— Selecione —</option><option value="NÃO SE APLICA">Não se aplica</option><option value="TEDEE">Tedee</option><option value="PHILIPS 9300">Philips 9300</option><option value="EMTECO">Emteco</option><option value="PHILIPS">Philips</option><option value="NUKI">Nuki</option></select></div>';
      h+='</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Cilindro</label><select id="'+pre+'cilindro"><option value="">— Selecione —</option><option value="KESO">Keso</option><option value="UDINESE">Udinese</option></select></div>';
      h+='<div class="crm-field"><label>Puxador <small style="color:#888">(auto por modelo)</small></label><select id="'+pre+'puxador" onchange="crmItemPuxChange(\''+item.id+'\')"><option value="">— Selecione —</option><option value="CAVA">Cava</option><option value="EXTERNO">Puxador Externo</option></select></div>';
      h+='</div>';
      // Tamanho puxador externo
      var _isExt=item.puxador==='EXTERNO'||(!_temCava&&item.modelo);
      h+='<div id="'+pre+'pux_tam_row" class="crm-row" style="'+(_isExt?'':'display:none')+'">';
      // ★ Felipe 21/04: selected reflete APENAS o valor real do item.
      //   Nao forca '1.5' quando vazio — a _crmItemAutoSelect trata de
      //   setar CLIENTE (mod 23) ou 1.5 (outros) conforme o caso.
      h+='<div class="crm-field"><label>Tamanho Puxador</label><select id="'+pre+'pux_tam"><option value=""'+(!item.pux_tam?' selected':'')+'>— Selecione —</option><option value="1.0"'+(item.pux_tam==='1.0'?' selected':'')+'>1.0 m (1000mm)</option><option value="1.5"'+(item.pux_tam==='1.5'?' selected':'')+'>1.5 m (1500mm)</option><option value="1.8"'+(item.pux_tam==='1.8'?' selected':'')+'>1.8 m (1800mm)</option><option value="2.0"'+(item.pux_tam==='2.0'?' selected':'')+'>2.0 m (2000mm)</option><option value="2.5"'+(item.pux_tam==='2.5'?' selected':'')+'>2.5 m (2500mm)</option><option value="3.0"'+(item.pux_tam==='3.0'?' selected':'')+'>3.0 m (3000mm)</option><option value="CLIENTE"'+(item.pux_tam==='CLIENTE'?' selected':'')+'>Envio pelo Cliente</option></select></div>';
      h+='</div>';
      // Config Cava — sempre renderiza, visibilidade controlada por id
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">✂️ Refilado Tampas</div>';
      h+='<div class="crm-row"><div class="crm-field"><label>Refilado (mm)</label><select id="'+pre+'refilado" style="width:100%"><option value="20"'+(item.refilado==='15'||item.refilado==='10'?'':' selected')+'>20 mm (padrão)</option><option value="15"'+(item.refilado==='15'?' selected':'')+'>15 mm</option><option value="10"'+(item.refilado==='10'?' selected':'')+'>10 mm</option></select></div></div>';
      var _modInt=parseInt(item.modelo)||0;
      var _temCava=false;
      var _modOptMatch=modeloOpts.match(new RegExp('value="'+item.modelo+'"[^>]*>([^<]+)'));
      if(_modOptMatch) _temCava=_modOptMatch[1].toLowerCase().indexOf('cava')>=0;
      h+='<div id="'+pre+'cava_wrap" style="'+(_temCava?'':'display:none')+'">';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">⚙️ Configuração da Cava</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Dist. Borda Cava (mm)</label><input type="number" id="'+pre+'dist_borda_cava" value="'+(item.dist_borda_cava||210)+'" min="50" max="500"></div>';
      h+='<div class="crm-field"><label>Largura Cava (mm)</label><input type="number" id="'+pre+'largura_cava" value="'+(item.largura_cava||150)+'" min="50" max="400"></div>';
      h+='</div></div>';
      // Config Friso — visível quando modelo tem "friso" no nome
      var _temFriso=false;
      if(_modOptMatch){var _modTxtLow=_modOptMatch[1].toLowerCase();_temFriso=_modTxtLow.indexOf('friso')>=0||_modTxtLow.indexOf('premium')>=0;}
      if(item.modelo==='22') _temFriso=true;
      var _isFrisoHoriz=(item.modelo==='06'||item.modelo==='16');
      h+='<div id="'+pre+'friso_wrap" style="'+(_temFriso?'':'display:none')+'">';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">📐 Configuração do Friso</div>';
      // Friso HORIZONTAL (modelo 06/16): Quantidade + Espessura
      h+='<div id="'+pre+'friso_h_wrap" class="crm-row" style="'+(_isFrisoHoriz?'':'display:none')+'">';
      h+='<div class="crm-field"><label>Quantidade Frisos</label><input type="number" id="'+pre+'friso_h_qty" value="'+(item.friso_h_qty||3)+'" min="1" max="20"></div>';
      h+='<div class="crm-field"><label>Espessura Friso (mm)</label><input type="number" id="'+pre+'friso_h_esp" value="'+(item.friso_h_esp||10)+'" min="1" max="50"></div>';
      h+='</div>';
      // Friso VERTICAL (outros modelos): Dist. Borda + Espessura
      h+='<div id="'+pre+'friso_v_wrap" class="crm-row" style="'+(!_isFrisoHoriz?'':'display:none')+'">';
      h+='<div class="crm-field"><label>Dist. Borda Friso (mm)</label><input type="number" id="'+pre+'dist_borda_friso" value="'+(item.dist_borda_friso||150)+'" min="0" max="500"></div>';
      h+='<div class="crm-field"><label>Espessura Friso (mm)</label><input type="number" id="'+pre+'largura_friso" value="'+(item.largura_friso||10)+'" min="1" max="200"></div>';
      h+='<div class="crm-field" id="'+pre+'friso_v_qty_wrap" style="'+(item.modelo==='02'?'':'display:none')+'"><label>Nº Frisos Verticais</label><input type="number" id="'+pre+'friso_v_qty" value="'+(item.friso_v_qty||1)+'" min="1" max="20"></div>';
      h+='</div>';
      h+='</div>';
      // 🎨 Cores — render right after friso config
      var _isMacItem = item.modelo==='23' && item.moldura_rev === 'MACICO';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">🎨 Cores</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>'+(_isMacItem?'Cor ACM':'Cor Externa')+'</label><select id="'+pre+'cor_ext" style="font-size:10px">'+corOpts.replace('value="'+item.cor_ext+'"','value="'+item.cor_ext+'" selected')+'</select></div>';
      h+='<div class="crm-field" style="'+(_isMacItem?'display:none':'')+'"><label>Cor Interna</label><select id="'+pre+'cor_int" style="font-size:10px">'+corOpts.replace('value="'+item.cor_int+'"','value="'+item.cor_int+'" selected')+'</select></div>';
      var _aluCorHtml='<option value="">— Selecione —</option>';
      if(typeof ALU_DATA!=='undefined'){ALU_DATA.forEach(function(g){_aluCorHtml+='<optgroup label="'+g.g+'">';var _cs={};g.o.forEach(function(it){var nm=it.l.split('·')[0].split('×')[0].trim();if(!_cs[nm])_cs[nm]=it.l.split('·')[0].trim();});Object.keys(_cs).forEach(function(c){_aluCorHtml+='<option value="'+_cs[c]+'"'+(_cs[c]===item.cor_macico?' selected':'')+'>'+_cs[c]+'</option>';});_aluCorHtml+='</optgroup>';});}
      h+='<div class="crm-field" style="'+(_isMacItem?'':'display:none')+'"><label>🔷 Cor Maciço</label><select id="'+pre+'cor_macico" style="font-size:10px;border-color:#6c3483;color:#6c3483">'+_aluCorHtml+'</select></div>';
      h+='</div>';
      // Config Molduras — visível apenas para modelo 23
      var _isMoldura=(item.modelo==='23');
      h+='<div id="'+pre+'moldura_wrap" style="'+(_isMoldura?'':'display:none')+'">';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">🏛️ Configuração de Molduras</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Revestimento</label><select id="'+pre+'moldura_rev" onchange="_crmSwitchCorMode(\''+item.id+'\')"><option value=""'+(!item.moldura_rev?' selected':'')+'>— Selecione —</option><option value="ACM"'+(item.moldura_rev==='ACM'?' selected':'')+'>ACM 4mm</option><option value="MACICO"'+(item.moldura_rev==='MACICO'?' selected':'')+'>Maciço 2.5mm (Boiserie)</option></select></div>';
      h+='</div>';
      // Config moldura para modelo 23 (ACM e MACICO)
      h+='<div class="crm-row">';
      h+='<input type="hidden" id="'+pre+'moldura_larg_qty" value="'+(item.moldura_larg_qty||2)+'">';
      var _isIgual=item.moldura_divisao==='igual';
      h+='<div class="crm-field"><label>Divisão Altura</label><select id="'+pre+'moldura_divisao" onchange="var v=this.value;var p=\''+pre+'\';var br=document.getElementById(p+\'moldura_alt_qty\');var bw=document.getElementById(p+\'blocos_wrap\');if(v===\'classica\'){if(br)br.value=2;if(bw)bw.style.display=\'none\';}else{if(bw)bw.style.display=\'\';}"><option value="classica"'+(item.moldura_divisao==='classica'||!item.moldura_divisao?' selected':'')+'>Clássica (1048mm)</option><option value="igual"'+(_isIgual?' selected':'')+'>Divisão Igual</option></select></div>';
      h+='<div id="'+pre+'blocos_wrap" class="crm-field" style="'+(_isIgual?'':'display:none')+'"><label>Qtd Blocos</label><input type="number" id="'+pre+'moldura_alt_qty" value="'+(item.moldura_alt_qty||3)+'" min="2" max="8" step="1" onwheel="event.preventDefault()"></div>';
      h+='<div class="crm-field"><label>Tipo Moldura</label><select id="'+pre+'moldura_tipo" onchange="var t=parseInt(this.value)||1;var p=\''+pre+'\';var d2=document.getElementById(p+\'moldura_dis2\');var d3=document.getElementById(p+\'moldura_dis3\');if(d2)d2.closest(\'.crm-field\').style.display=t>=2?\'\':\'none\';if(d3)d3.closest(\'.crm-field\').style.display=t>=3?\'\':\'none\';"><option value="1"'+(item.moldura_tipo==='1'||!item.moldura_tipo?' selected':'')+'>Simples</option><option value="2"'+(item.moldura_tipo==='2'?' selected':'')+'>Dupla</option><option value="3"'+(item.moldura_tipo==='3'?' selected':'')+'>Tripla</option></select></div>';
      h+='<div class="crm-field"><label>Dist. 1ª (mm)</label><input type="number" id="'+pre+'moldura_dis1" value="'+(item.moldura_dis1||150)+'" min="50" max="400" step="10"></div>';
      var _showD2=(item.moldura_tipo==='2'||item.moldura_tipo==='3');
      var _showD3=(item.moldura_tipo==='3');
      h+='<div class="crm-field" style="'+(_showD2?'':'display:none')+'"><label>Dist. 2ª (mm)</label><input type="number" id="'+pre+'moldura_dis2" value="'+(item.moldura_dis2||150)+'" min="50" max="400" step="10"></div>';
      h+='<div class="crm-field" style="'+(_showD3?'':'display:none')+'"><label>Dist. 3ª (mm)</label><input type="number" id="'+pre+'moldura_dis3" value="'+(item.moldura_dis3||150)+'" min="50" max="400" step="10"></div>';
      h+='</div>';
      h+='</div>'; // fechar moldura_wrap
      // Config Ripado — visível para modelos 08, 15, 20, 21
      var _isRipMod=['08','15','20','21'].indexOf(item.modelo)>=0;
      h+='<div id="'+pre+'ripado_wrap" style="'+(_isRipMod?'':'display:none')+'">';
      h+='<div style="font-size:10px;font-weight:700;color:#c47012;margin:8px 0 4px">🔲 Configuração do Ripado</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Ripado Total?</label><select id="'+pre+'ripado_total"><option value="NAO"'+(item.ripado_total==='SIM'?'':' selected')+'>Não (descontando cava/bordas)</option><option value="SIM"'+(item.ripado_total==='SIM'?' selected':'')+'>Sim (largura total)</option></select></div>';
      h+='<div class="crm-field"><label>Ripado 2 lados?</label><select id="'+pre+'ripado_2lados"><option value="SIM"'+(item.ripado_2lados==='NAO'?'':' selected')+'>Sim (frente + verso)</option><option value="NAO"'+(item.ripado_2lados==='NAO'?' selected':'')+'>Não (1 lado)</option></select></div>';
      h+='</div></div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="'+pre+'tem_alisar"'+(item.tem_alisar?' checked':'')+' style="width:14px;height:14px"> Tem Alisar</label></div>';
      h+='<div class="crm-field"></div>';
      h+='</div>';
    } else if(item.tipo==='fixo'){
      h+='<div class="crm-field"><label>Posição</label><select id="'+pre+'tipo_fixacao"><option value="">— Selecione —</option><option value="LATERAL"'+(item.tipo_fixacao==='LATERAL'?' selected':'')+'>Lateral</option><option value="BANDEIRA"'+(item.tipo_fixacao==='BANDEIRA'?' selected':'')+'>Bandeira (superior)</option><option value="INFERIOR"'+(item.tipo_fixacao==='INFERIOR'?' selected':'')+'>Inferior</option></select></div>';
      h+='</div>';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">🔲 Configuração do Fixo</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Revestimento</label><select id="'+pre+'revestimento_lados"><option value="">— Selecione —</option><option value="2"'+(item.revestimento_lados==='2'?' selected':'')+'>2 lados</option><option value="1"'+(item.revestimento_lados==='1'?' selected':'')+'>1 lado</option></select></div>';
      h+='<div class="crm-field"><label>Estrutura Alumínio</label><select id="'+pre+'tem_estrutura"><option value="">— Selecione —</option><option value="SIM"'+(item.tem_estrutura==='SIM'?' selected':'')+'>Sim</option><option value="NÃO"'+(item.tem_estrutura==='NÃO'?' selected':'')+'>Não</option></select></div>';
      h+='</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Tipo Material</label><select id="'+pre+'tipo_material" onchange="crmItemFixoMaterial(\''+item.id+'\')"><option value="">— Selecione —</option><option value="ACM"'+(item.tipo_material==='ACM'?' selected':'')+'>ACM (Chapa)</option><option value="MACICO"'+(item.tipo_material==='MACICO'?' selected':'')+'>Alumínio Maciço 2.5mm</option><option value="VIDRO"'+(item.tipo_material==='VIDRO'?' selected':'')+'>Vidro</option></select></div>';
      h+='<div class="crm-field" id="'+pre+'vidro_wrap" style="'+(item.tipo_material==='VIDRO'?'':'display:none')+'"><label>Tipo de Vidro</label><select id="'+pre+'tipo_vidro"><option value="">— Selecione —</option><option value="TEMPERADO"'+(item.tipo_vidro==='TEMPERADO'?' selected':'')+'>Temperado</option><option value="LAMINADO"'+(item.tipo_vidro==='LAMINADO'?' selected':'')+'>Laminado</option><option value="INSULADO"'+(item.tipo_vidro==='INSULADO'?' selected':'')+'>Insulado</option><option value="PINAZO"'+(item.tipo_vidro==='PINAZO'?' selected':'')+'>Com Pinazo</option></select></div>';
      h+='</div>';
    } else if(item.tipo==='porta_interna'){
      h+='<div class="crm-field"><label>Sistema</label><select id="'+pre+'sistema_pi"><option value="GIRO"'+(item.sistema_pi==='GIRO'||!item.sistema_pi?' selected':'')+'>Giro (dobradiça)</option><option value="CORRER"'+(item.sistema_pi==='CORRER'?' selected':'')+'>De Correr</option></select></div>';
      h+='</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Folhas</label><select id="'+pre+'folhas_pi"><option value="1"'+(item.folhas_pi==='1'||!item.folhas_pi?' selected':'')+'>1 folha</option><option value="2"'+(item.folhas_pi==='2'?' selected':'')+'>2 folhas</option><option value="3"'+(item.folhas_pi==='3'?' selected':'')+'>3 folhas</option></select></div>';
      h+='<div class="crm-field"></div>';
      h+='</div>';
    } else {
      h+='<div class="crm-field"></div></div>';
    }
    } else {
      // ★ Revestimento (Felipe 22/04) — campos proprios: Tipo, Estrutura,
      //   Tubo, info box calculado e botao "+ Adicionar chapa".
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Tipo</label><select id="'+pre+'rev_tipo" onchange="crmItemRevCalc(\''+item.id+'\')"><option value="CHAPA"'+(item.rev_tipo==='CHAPA'||!item.rev_tipo?' selected':'')+'>Chapa ACM 4mm</option><option value="RIPADO"'+(item.rev_tipo==='RIPADO'?' selected':'')+'>Ripado</option></select></div>';
      // ★ Felipe 23/04: campo "2 lados" — quando marcado SIM, multiplica por 2:
      //   ripas, chapa de fundo, tubos, chapas que produzem ripas. Útil pra
      //   divisórias/biombos com ripas dos 2 lados.
      h+='<div class="crm-field"><label>Revestir 2 lados?</label><select id="'+pre+'rev_2lados" onchange="crmItemRevCalc(\''+item.id+'\')"><option value="NAO"'+(item.rev_2lados!=='SIM'?' selected':'')+'>Não (1 face)</option><option value="SIM"'+(item.rev_2lados==='SIM'?' selected':'')+'>Sim (2 faces — tudo ×2)</option></select></div>';
      h+='</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Estrutura de Alumínio?</label><select id="'+pre+'rev_estrutura" onchange="crmItemRevCalc(\''+item.id+'\')"><option value="NAO"'+(item.rev_estrutura!=='SIM'?' selected':'')+'>Não</option><option value="SIM"'+(item.rev_estrutura==='SIM'?' selected':'')+'>Sim</option></select></div>';
      h+='<div class="crm-field" id="'+pre+'rev_tubo_wrap" style="'+(item.rev_estrutura==='SIM'?'':'display:none')+'"><label>Tubo Estrutura</label><select id="'+pre+'rev_tubo" onchange="crmItemRevCalc(\''+item.id+'\')"><option value="PA-51X12X1.58"'+(item.rev_tubo==='PA-51X12X1.58'||!item.rev_tubo?' selected':'')+'>51×25×1.5 (padrão ripado)</option><option value="PA-51X25X2.0"'+(item.rev_tubo==='PA-51X25X2.0'?' selected':'')+'>51×25×2.0</option><option value="PA-51X38X1.98"'+(item.rev_tubo==='PA-51X38X1.98'?' selected':'')+'>51×38×1.98</option><option value="PA-51X51X1.98"'+(item.rev_tubo==='PA-51X51X1.98'?' selected':'')+'>51×51×1.98</option><option value="PA-76X25X2.0"'+(item.rev_tubo==='PA-76X25X2.0'?' selected':'')+'>76×25×2.0</option><option value="PA-76X38X1.98"'+(item.rev_tubo==='PA-76X38X1.98'?' selected':'')+'>76×38×1.98</option></select></div>';
      h+='</div>';
      h+='<div id="'+pre+'rev_info" style="margin-top:8px;background:#f0fbf0;border:1px solid #27ae60;border-radius:6px;padding:8px;font-size:10px;color:#1a5e1a;line-height:1.6;font-weight:600">— Preencha Largura e Altura para calcular —</div>';
      // Botao duplicar mantendo configuracao
      h+='<div style="margin-top:10px;text-align:center"><button type="button" onclick="crmItemRevAddChapa(\''+item.id+'\')" style="padding:8px 18px;border-radius:8px;border:1.5px solid #27ae60;background:#e8f5e9;color:#1a7a20;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit" title="Adiciona nova peça de revestimento abaixo mantendo Tipo, Estrutura, Tubo e Cor">+ Adicionar chapa (mesma config)</button></div>';
    }
    // Cores for fixo and else types (porta_pivotante renders its own above)
    if(item.tipo!=='porta_pivotante'){
      var _isFixoMac=item.tipo_material==='MACICO';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">🎨 Cores</div>';
      h+='<div class="crm-row" id="'+pre+'cor_row">';
      h+='<div class="crm-field"><label>'+(_isFixoMac?'Cor ACM':'Cor Externa')+'</label><select id="'+pre+'cor_ext" style="font-size:10px">'+corOpts.replace('value="'+item.cor_ext+'"','value="'+item.cor_ext+'" selected')+'</select></div>';
      h+='<div class="crm-field" id="'+pre+'cor_int_wrap" style="'+(_isFixoMac?'display:none':'')+'"><label>Cor Interna</label><select id="'+pre+'cor_int" style="font-size:10px">'+corOpts.replace('value="'+item.cor_int+'"','value="'+item.cor_int+'" selected')+'</select></div>';
      var _aluCorFixo='<option value="">— Selecione —</option>';
      if(typeof ALU_DATA!=='undefined'){ALU_DATA.forEach(function(g){_aluCorFixo+='<optgroup label="'+g.g+'">';var _cs={};g.o.forEach(function(it){var nm=it.l.split('·')[0].split('×')[0].trim();if(!_cs[nm])_cs[nm]=it.l.split('·')[0].trim();});Object.keys(_cs).forEach(function(c){_aluCorFixo+='<option value="'+_cs[c]+'"'+(_cs[c]===item.cor_macico?' selected':'')+'>'+_cs[c]+'</option>';});_aluCorFixo+='</optgroup>';});}
      h+='<div class="crm-field" id="'+pre+'cor_mac_wrap" style="'+(_isFixoMac?'':'display:none')+'"><label>🔷 Cor Maciço</label><select id="'+pre+'cor_macico" style="font-size:10px;border-color:#6c3483;color:#6c3483">'+_aluCorFixo+'</select></div>';
      h+='</div>';
    }
    
    // Actions
    h+='<div class="crm-item-actions">';
    h+='<button class="dup" onclick="event.stopPropagation();crmItemSaveAndNext(\''+item.id+'\')" style="background:#27ae60;color:#fff;border-color:#27ae60">💾 Salvar Item</button>';
    h+='<button class="dup" onclick="event.stopPropagation();crmItemDuplicate(\''+item.id+'\')">📋 Duplicar</button>';
    h+='<button class="del" onclick="event.stopPropagation();crmItemRemove(\''+item.id+'\')">🗑 Remover</button>';
    h+='</div>';
    
    h+='</div>'; // body
    h+='</div>'; // crm-item
  });
  
  list.innerHTML=h;
  
  // Re-apply selected values for selects (the replace trick doesn't always work)
  _crmItens.forEach(function(item){
    var pre='crmit-'+item.id+'-';
    var fields=item.tipo==='porta_pivotante'?['modelo','abertura','folhas','fech_mec','fech_dig','cilindro','puxador','pux_tam','cor_ext','cor_int','cor_macico','dist_borda_cava','largura_cava','cantoneira_cava','dist_borda_friso','largura_friso','friso_h_qty','friso_h_esp','friso_v_qty','refilado','moldura_rev','moldura_larg_qty','moldura_alt_qty','moldura_tipo','moldura_dis1','moldura_dis2','moldura_dis3','moldura_divisao','ripado_total','ripado_2lados']:item.tipo==='porta_interna'?['sistema_pi','folhas_pi','cor_ext','cor_int','cor_macico']:['tipo_fixacao','tipo_vidro','revestimento_lados','tem_estrutura','tipo_material','cor_ext','cor_int','cor_macico'];
    fields.forEach(function(f){
      var el=document.getElementById(pre+f);
      if(el&&item[f]) el.value=item[f];
    });
    // ★ Felipe 21/04/26: aplicar trava Tedee→Keso apos popular valores
    _tedeeLockCilindro(pre+'fech_dig', pre+'cilindro');
    // Checkbox
    var _cbA=document.getElementById(pre+'tem_alisar');
    if(_cbA) _cbA.checked=!!item.tem_alisar;
  });
  
  // Auto-select fechadura/puxador for items with altura set
  setTimeout(function(){
    _crmItens.forEach(function(item){
      if(item.tipo==='porta_pivotante' && item.altura && parseInt(item.altura)>0){
        crmItemAutoSelect(item.id);
      }
      if(item.tipo==='fixo'){
        crmItemFixoMaterial(item.id);
      }
      // Re-apply cor values after mode switch (ALU values won't stick on ACM selects)
      var pre='crmit-'+item.id+'-';
      if(item.cor_ext){var ce=document.getElementById(pre+'cor_ext');if(ce)ce.value=item.cor_ext;}
      if(item.cor_int){var ci=document.getElementById(pre+'cor_int');if(ci)ci.value=item.cor_int;}
    });
    // ★ Aplica freeze-lock DEPOIS do auto-select/cores pra não ser sobrescrito
    _crmItensAplicarLock();
    // ★ Felipe 20/04: attach search input em cada select de cor (igual
    //   Representante). Roda em 3 selects por item: cor_ext, cor_int,
    //   cor_macico.
    _crmItens.forEach(function(item){
      var pre='crmit-'+item.id+'-';
      ['cor_ext','cor_int','cor_macico'].forEach(function(f){
        _crmAttachColorSearch(pre+f);
      });
    });
  }, 100);
}

/* ★ Felipe 20/04: adiciona um input de busca acima de um <select>
   pra filtrar as <option> por texto. Usado nos selects de cor
   (PRO111 CHAMPAGNE MET, PRO157 PRETO WXL etc — muitas opcoes).
   Idempotente: se ja foi attachado, nao duplica. */
function _crmAttachColorSearch(selectId){
  var sel = document.getElementById(selectId);
  if(!sel) return;
  // Nao duplicar: se ja tem wrapper, sair
  if(sel.parentNode && sel.parentNode.hasAttribute('data-color-search')) return;

  // Criar wrapper
  var wrap = document.createElement('div');
  wrap.setAttribute('data-color-search','1');
  wrap.style.cssText = 'position:relative';

  // Input de busca
  var inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = '🔍 Buscar cor...';
  inp.className = 'crm-color-search';
  inp.style.cssText = 'width:100%;padding:4px 8px;margin-bottom:3px;font-size:10px;border:1px solid #ddd;border-radius:6px;outline:none;font-family:inherit;background:#fafafa';

  // Inserir no lugar do select, depois colocar o select dentro do wrapper
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(inp);
  wrap.appendChild(sel);

  // Salvar opcoes originais (texto + value) pra restauracao
  var originalHTML = sel.innerHTML;
  sel.setAttribute('data-original-options', originalHTML);

  // Handler de busca: filtrar opcoes via visibilidade
  // <select> nativo nao deixa esconder options em todos browsers
  // (funciona no Chrome via display:none mas pode variar). Pra ser
  // robusto, trocar o innerHTML filtrado.
  inp.addEventListener('input', function(){
    var q = (this.value||'').trim().toLowerCase();
    if(!q){
      // Restaurar todas
      var current = sel.value;
      sel.innerHTML = originalHTML;
      sel.value = current;
      return;
    }
    // Filtrar: parsear originalHTML, manter apenas options cujo text bate
    var tmp = document.createElement('div');
    tmp.innerHTML = originalHTML;
    var origSelect = tmp; // raiz
    var novoHTML = '';
    var primeiraOpcao = null;
    // Itera optgroups + options soltos
    Array.from(origSelect.childNodes).forEach(function(node){
      if(node.nodeType !== 1) return;
      if(node.tagName === 'OPTGROUP'){
        var groupOpts = Array.from(node.querySelectorAll('option')).filter(function(op){
          return (op.textContent||'').toLowerCase().includes(q);
        });
        if(groupOpts.length){
          novoHTML += '<optgroup label="'+(node.getAttribute('label')||'')+'">';
          groupOpts.forEach(function(op){
            novoHTML += op.outerHTML;
            if(!primeiraOpcao) primeiraOpcao = op.getAttribute('value');
          });
          novoHTML += '</optgroup>';
        }
      } else if(node.tagName === 'OPTION'){
        if(!node.value || (node.textContent||'').toLowerCase().includes(q)){
          novoHTML += node.outerHTML;
          if(!primeiraOpcao && node.value) primeiraOpcao = node.getAttribute('value');
        }
      }
    });
    if(!novoHTML){
      novoHTML = '<option value="">— Nenhum resultado —</option>';
    }
    sel.innerHTML = novoHTML;
    // Selecionar a primeira opcao filtrada (pra user ver imediato)
    if(primeiraOpcao) sel.value = primeiraOpcao;
  });

  // Ao escolher uma opcao, limpar a busca pra mostrar o select cheio
  sel.addEventListener('change', function(){
    if(inp.value){
      var current = sel.value;
      sel.innerHTML = originalHTML;
      sel.value = current;
      inp.value = '';
    }
  });
}
window._crmAttachColorSearch = _crmAttachColorSearch;

/* ═════════════════════════════════════════════════════════════════════
   FREEZE-LOCK de itens (Felipe 20/04):
   "uma opção com revisão finalizada NÃO deve mais ser editável. Se
   precisar alterar: usa Nova Revisão ou Nova Opção."

   Regra: se a opção ATIVA já tem pelo menos 1 revisão, todos os inputs
   dos itens ficam read-only/disabled. Banner de aviso aparece no topo
   da lista explicando como desbloquear.

   Botão "Salvar Item" também some (não faz sentido editar).
   "Duplicar" mantido (cópia nova fica editável na mesma opção).
   "Remover" some (não pode remover item com orçamento).
   ═════════════════════════════════════════════════════════════════════ */
// ROLLBACK Felipe 20/04: lock automático por revisão removido.
// Card com revisões finalizadas continua editável; se o usuário quer
// guardar histórico, clica "Nova Revisão" manualmente. Função mantida
// como no-op pra não quebrar chamadas existentes.
window._crmItensAplicarLock=function(){
  // Garantir que nada esteja travado de sessões anteriores (limpa
  // banner/inputs locked caso alguém tenha sido pego pela versão antiga).
  var list = document.getElementById('crm-itens-list');
  if(!list) return;
  var oldBanner = document.getElementById('crm-itens-lock-banner');
  if(oldBanner) oldBanner.remove();
  list.querySelectorAll('input, select, textarea').forEach(function(el){
    if(el.dataset._lockedByRev){
      el.disabled = false;
      el.readOnly = false;
      el.style.cursor = '';
      el.style.opacity = '';
      delete el.dataset._lockedByRev;
    }
  });
  list.querySelectorAll('button.dup, button.del').forEach(function(btn){
    btn.style.display = '';
  });
  var addBtn = document.getElementById('crm-itens-add-btn');
  if(addBtn) addBtn.style.display = '';
};

window._crmItensToCardData=function(){
  _crmItensSaveFromDOM();
  return _crmItens.map(function(item){
    var clean={id:item.id,tipo:item.tipo,qtd:parseInt(item.qtd)||1,largura:parseInt(item.largura)||0,altura:parseInt(item.altura)||0,cor_ext:item.cor_ext||'',cor_int:item.cor_int||'',cor_macico:item.cor_macico||''};
    if(item.tipo==='porta_pivotante'){
      clean.modelo=item.modelo||'';clean.abertura=item.abertura||'PIVOTANTE';clean.folhas=item.folhas||'1';
      clean.fech_mec=item.fech_mec||'';clean.fech_dig=item.fech_dig||'';clean.cilindro=item.cilindro||'';clean.puxador=item.puxador||'';
      // ★ Felipe 21/04: sem fallback '1.5'. Preserva valor real (CLIENTE ou vazio).
      clean.pux_tam=item.pux_tam||'';
      clean.dist_borda_cava=item.dist_borda_cava||'210';clean.largura_cava=item.largura_cava||'150';clean.cantoneira_cava=item.cantoneira_cava||'30';
      clean.dist_borda_friso=item.dist_borda_friso||'';clean.largura_friso=item.largura_friso||'';clean.refilado=item.refilado||'20';
      clean.friso_vert=item.friso_vert||'0';clean.friso_horiz=item.friso_horiz||'0';clean.friso_h_qty=item.friso_h_qty||'3';clean.friso_h_esp=item.friso_h_esp||'10';clean.friso_v_qty=item.friso_v_qty||'1';clean.tem_alisar=!!item.tem_alisar;
      clean.moldura_rev=item.moldura_rev||'ACM';clean.moldura_larg_qty=item.moldura_larg_qty||'2';clean.moldura_alt_qty=item.moldura_alt_qty||'2';
      clean.moldura_tipo=item.moldura_tipo||'1';clean.moldura_dis1=item.moldura_dis1||'150';clean.moldura_dis2=item.moldura_dis2||'150';clean.moldura_dis3=item.moldura_dis3||'150';clean.moldura_divisao=item.moldura_divisao||'classica';
      clean.ripado_total=item.ripado_total||'NAO';clean.ripado_2lados=item.ripado_2lados||'SIM';
    }
    if(item.tipo==='fixo'){
      clean.tipo_vidro=item.tipo_vidro||'';clean.tipo_fixacao=item.tipo_fixacao||'';clean.revestimento_lados=item.revestimento_lados||'2';clean.tem_estrutura=item.tem_estrutura||'SIM';clean.tipo_material=item.tipo_material||'ACM';
    }
    if(item.tipo==='porta_interna'){
      clean.sistema_pi=item.sistema_pi||'GIRO';clean.folhas_pi=item.folhas_pi||'1';
    }
    // ★ Felipe 23/04: BUG CRÍTICO corrigido. Sem este bloco, itens de
    //   revestimento perdiam rev_tipo/rev_estrutura/rev_tubo ao serializar
    //   pro card. Consequência: TIPO="Ripado" selecionado no dropdown do CRM
    //   era dropado silenciosamente e o Orçamento achava que era CHAPA (default).
    //   A Característica do Revestimento mostrava "🪟 Chapa ACM 4mm" mesmo
    //   com Ripado marcado, e o planificador calculava chapas em vez de ripas.
    if(item.tipo==='revestimento'){
      clean.rev_tipo=item.rev_tipo||'CHAPA';
      clean.rev_estrutura=item.rev_estrutura||'NAO';
      clean.rev_tubo=item.rev_tubo||'PA-51X12X1.58';
      clean.rev_2lados=item.rev_2lados||'NAO';
    }
    return clean;
  });
}

window._crmItensFromCardData=function(itens){
  // ★ DEEP-CLONE (Felipe 20/04): shallow clone antes permitia que mutacoes
  //   em props aninhadas vazassem entre opcoes. Usar JSON clone garante
  //   que os itens sao 100% independentes da fonte.
  _crmItens=(itens||[]).map(function(it){
    var copy;
    try { copy = JSON.parse(JSON.stringify(it||{})); }
    catch(e){ copy = Object.assign({},it); }
    if(!copy.id) copy.id = 'ci_'+Date.now()+'_'+Math.random().toString(36).substr(2,4);
    return copy;
  });
  _crmItensRender();
}


window.crmSaveOpp=function(){
  var cliente=val('crm-o-cliente').trim();
  if(!cliente){var c=el('crm-o-cliente');if(c)c.focus();return;}

  // ★ SEMPRE capturar DOM dos itens pra _crmItens ANTES de qualquer leitura.
  //   Senão edições recém-feitas no item (ex: modelo mudado de 23 pra 01)
  //   não refletem em _crmItens[0] e opp.* vai ficar com valor velho.
  try { if(typeof _crmItensSaveFromDOM==='function') _crmItensSaveFromDOM(); }
  catch(e){ console.warn('[crmSaveOpp] _crmItensSaveFromDOM falhou:', e); }

  var scope=_scope;
  var cidade=scope==='internacional'?val('crm-o-cidade-intl').trim():val('crm-o-cidade-nac').trim();
  var now=new Date().toISOString();

  // ★ CRÍTICO (Felipe 20/04): opp.* (campos top-level) devem refletir
  //   _crmItens[0].* sempre que houver item. Antes lia de inputs legacy
  //   do topo do modal que não são mais editados, resultando em opp.modelo
  //   dessincronizado com o modelo REAL editado no bloco do item.
  //   Bug reportado: "alterei modelo no card pra 01, ao fazer orçamento
  //   trouxe modelo 23 da Opção original".
  var _it0 = (_crmItens && _crmItens[0]) || {};
  var _pickItem = function(itemField, legacyInputId, fallback){
    // Prioridade: item.field > input legacy > fallback
    if(_it0[itemField] !== undefined && _it0[itemField] !== '') return _it0[itemField];
    var v = val(legacyInputId);
    if(v) return v;
    return fallback || '';
  };

  // ★ PRESERVAÇÃO DE LOGÍSTICA (Felipe 20/04):
  //   crmSaveCard() é chamado de varios lugares (ex: Fazer Orcamento).
  //   Se o modal CRM nao esta aberto, os inputs 'crm-o-inst-incoterm' etc
  //   nao existem ou estao vazios — e crmSaveOpp SOBRESCREVERIA os campos
  //   de logistica do card com '' / 0. Bug: toda vez que apertava Fazer
  //   Orcamento, os dados CIF se apagavam.
  //
  //   Solucao: carregar card existente e usar valores dele como fallback
  //   quando o input do modal nao tiver valor. Helper:
  //     _preserveInput(inputId, cardField, parseType)
  //   Se input tem valor → usa input. Senao → usa card (se _editId existir).
  var _existingCard = null;
  if(_editId && typeof cLoad === 'function'){
    try { _existingCard = cLoad().find(function(o){return o.id===_editId;}) || null; }
    catch(e){}
  }
  var _preserveInput = function(inputId, cardField, parseType){
    var inputEl = document.getElementById(inputId);
    var inputVal = inputEl ? inputEl.value : '';
    // Se input existe E tem valor → usa input (comportamento normal)
    if(inputEl && inputVal !== '' && inputVal !== null && inputVal !== undefined){
      if(parseType === 'float') return parseFloat(inputVal)||0;
      if(parseType === 'int')   return parseInt(inputVal)||0;
      return inputVal;
    }
    // Senao → usa valor do card persistido (nao deixa sobrescrever com '')
    if(_existingCard && _existingCard[cardField] !== undefined && _existingCard[cardField] !== null){
      return _existingCard[cardField];
    }
    // Ultimo recurso: tipos defaults
    if(parseType === 'float') return 0;
    if(parseType === 'int')   return 0;
    return '';
  };

  var opp={
    cliente:   cliente,
    contato:   val('crm-o-contato').trim(),
    email:     val('crm-o-email').trim(),
    dataContato: val('crm-o-data-contato'),
    produto:   val('crm-o-produto'),
    responsavel: val('crm-o-resp'),
    origem:    val('crm-o-origem'),
    wrep:      val('crm-o-wrep'),          // Weiku rep
    parceiro_nome: val('crm-o-parceiro-nome')||'',
    valor:     parseFloat(val('crm-o-valor'))||0,
    // ★ Felipe 20/04: salvar em AMBOS (fechamento_real novo + fechamento legado)
    fechamento_real: val('crm-o-fechamento')||'',
    fechamento:val('crm-o-fechamento'),
    prioridade:val('crm-o-prioridade')||'',
    potencial: val('crm-o-potencial')||'',
    notas:     val('crm-o-notas').trim(),
    largura:   parseInt(_pickItem('largura','crm-o-largura',0))||0,
    altura:    parseInt(_pickItem('altura', 'crm-o-altura', 0))||0,
    abertura:  _pickItem('abertura','crm-o-abertura',''),
    modelo:    _pickItem('modelo',  'crm-o-modelo',  ''),
    folhas:    _pickItem('folhas',  'crm-o-folhas', '1'),
    cor_ext:   _pickItem('cor_ext', 'crm-o-cor-ext',''),
    cor_int:   _pickItem('cor_int', 'crm-o-cor-int',''),
    cor_macico:  _pickItem('cor_macico',  'crm-o-cor-macico',''),
    moldura_rev: _pickItem('moldura_rev', '',                 ''),
    reserva:   val('crm-o-reserva').trim(),
    itens:     _crmItensToCardData(),
    inst_quem: val('crm-o-inst-quem')||'PROJETTA',
    inst_valor: parseFloat(val('crm-o-inst-valor'))||0,
    inst_transp: parseFloat(val('crm-o-inst-transp'))||0,
    inst_pais: val('crm-o-inst-pais')||'',
    // ★ INCOTERM + CIF: campos usados na proposta CIF (caixa madeira + fretes)
    //   _preserveInput: se input do modal nao tem valor (modal fechado),
    //   mantem o valor existente no card — evita apagar a logistica toda
    //   vez que crmSaveCard() e chamado de fora do modal.
    inst_incoterm:        _preserveInput('crm-o-inst-incoterm',        'inst_incoterm',        'str'),
    cif_caixa_l:          _preserveInput('crm-o-cif-caixa-l',          'cif_caixa_l',          'float'),
    cif_caixa_a:          _preserveInput('crm-o-cif-caixa-a',          'cif_caixa_a',          'float'),
    cif_caixa_e:          _preserveInput('crm-o-cif-caixa-e',          'cif_caixa_e',          'float'),
    cif_caixa_taxa:       _preserveInput('crm-o-cif-caixa-taxa',       'cif_caixa_taxa',       'float') || 100,
    cif_frete_terrestre:  _preserveInput('crm-o-cif-frete-terrestre',  'cif_frete_terrestre',  'float') || 1700,
    cif_frete_maritimo:   _preserveInput('crm-o-cif-frete-maritimo',   'cif_frete_maritimo',   'float'),
    inst_aero: val('crm-o-inst-aero')||'',
    inst_porte: val('crm-o-inst-porte')||'M',
    inst_pessoas: parseInt(val('crm-o-inst-pessoas'))||3,
    inst_dias: parseInt(val('crm-o-inst-dias'))||3,
    inst_udigru: parseFloat(val('crm-o-inst-udigru'))||2000,
    inst_passagem: parseFloat(val('crm-o-inst-passagem'))||10000,
    inst_hotel: parseFloat(val('crm-o-inst-hotel'))||1700,
    inst_alim: parseFloat(val('crm-o-inst-alim'))||300,
    inst_seguro: parseFloat(val('crm-o-inst-seguro'))||300,
    inst_carro: parseFloat(val('crm-o-inst-carro'))||850,
    inst_mo: parseFloat(val('crm-o-inst-mo'))||500,
    inst_margem: parseFloat(val('crm-o-inst-margem'))||10,
    inst_cambio: parseFloat(val('crm-o-inst-cambio'))||5.20,
    inst_intl_total: window._instIntlTotal||0,
    agp:       val('crm-o-agp').trim(),
    cep:       val('crm-o-cep'),
    scope:     scope,
    cidade:    cidade,
    estado:    scope==='nacional'?val('crm-o-estado'):'',
    pais:      scope==='internacional'?val('crm-o-pais').trim():'',
    stage:     _stageId||gStages()[0].id,
    updatedAt: now,
    anexos:    _modalAttachs.map(function(a){return{name:a.name,type:a.type,date:a.date};}), // metadata only in localStorage
  };

  var data=cLoad();
  var dealId=_editId;
  if(_editId){
    var idx=data.findIndex(function(o){return o.id===_editId;});
    if(idx>=0){
      opp.anexos=_modalAttachs.map(function(a){return{name:a.name,type:a.type,date:a.date};});
      // Preservar campos que não estão no modal (revisoes, valorTabela etc)
      var existing=data[idx];
      ['revisoes','revPipeline','valorTabela','valorFaturamento','createdAt'].forEach(function(k){
        if(existing[k]!==undefined && opp[k]===undefined) opp[k]=existing[k];
      });
      data[idx]=Object.assign(data[idx],opp);
    }
  } else {
    dealId=uuid();opp.id=dealId;opp.createdAt=now;data.unshift(opp);
    // CRÍTICO: atualizar _editId para que próximos saves atualizem em vez de criar duplicata
    _editId=dealId;
  }
  cSave(data);
  // Save full attachments (with base64 data) to cloud
  if(_modalAttachs.length>0)crmSaveAttachCloud(dealId,_modalAttachs);
  _modalAttachs=[];
  // NÃO fechar modal — só salvar e mostrar confirmação
  // NÃO re-abrir modal (colapsa items abertos). Só atualizar kanban.
  crmRender();
  var _svToast=document.createElement('div');_svToast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:8px 18px;border-radius:16px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.2)';
  _svToast.textContent='💾 Card salvo!';document.body.appendChild(_svToast);setTimeout(function(){_svToast.remove();},2000);
};

// crmSaveCard: salva items no card (chamado por Salvar Item)
window.crmSaveCard=function(){
  if(_editId && typeof crmSaveOpp==='function'){
    try{crmSaveOpp();}catch(e){console.warn('crmSaveCard:',e);}
  }
};

window.crmDeleteOpp=function(id){
  if(!id)return;
  if(!confirm('Excluir esta oportunidade e todos os orçamentos associados?'))return;
  var data=cLoad();
  var card=data.find(function(o){return o.id===id;});
  var clienteName=card?card.cliente:'';
  var filtered=data.filter(function(o){return o.id!==id;});
  if(filtered.length===data.length){alert('Erro: oportunidade não encontrada.');return;}
  cSave(filtered);
  crmDeleteAttachCloud(id);
  // Também limpar orçamentos associados a este cliente
  if(clienteName){
    var db=loadDB();
    var dbFiltered=db.filter(function(e){return(e.client||'').trim()!==clienteName.trim();});
    if(dbFiltered.length<db.length){
      saveDB(dbFiltered);
      console.log('🗑 Removidos '+(db.length-dbFiltered.length)+' orçamento(s) de '+clienteName);
    }
  }
  crmRender();
  if(typeof renderClientesTab==='function') renderClientesTab();
};
window.crmDeleteFromModal=function(){
  if(_editId){
    var id=_editId;
    crmCloseModal();
    setTimeout(function(){crmDeleteOpp(id);},150);
  }
};

/* ═══ ORC ITEMS — Itens do CRM no Orçamento ═══ */
window._orcItens = [];      // Array of items from CRM
window._orcItemAtual = -1;  // Index of currently editing item

function orcItensFromCRM(itens, cliente){
  window._orcItens = (itens||[]).map(function(it,i){
    return Object.assign({}, it, {_idx:i, _configured:false, _formData:null});
  });
  window._orcItemAtual = -1;

  // ★ Felipe 23/04: LIMPAR state residual de card anterior quando o novo card
  //   é só-revestimento. Antes, _mpItens e _lastOSData guardavam dados de
  //   porta anterior, e _mpCalcCombinedPerfis rodava em cima deles gerando
  //   perfis fantasma (PA-PA006F, PA-76X38, etc) em orçamento de revestimento.
  var _temPortaFixoClear = window._orcItens.some(function(it){
    return it.tipo==='porta_pivotante' || it.tipo==='porta_interna' || it.tipo==='fixo';
  });
  var _temRevClear = window._orcItens.some(function(it){
    return it.tipo==='revestimento' && (it.largura||0)>0 && (it.altura||0)>0;
  });
  if(!_temPortaFixoClear && _temRevClear){
    // Rev-only: zerar state de portas anteriores
    window._mpItens = [];
    window._lastOSData = null;
    window._lastPadroesHTML = '';
    window._lastPerfisTotal = 0;
    window._perfisPerDoor = [];
    window._pesoChapasPerDoor = [];
    // Limpar tabelas de perfis (serão repopuladas corretamente depois)
    ['os-folha-tbody','os-folha-tfoot','os-portal-tbody','os-portal-tfoot',
     'os-fixo-tbody','os-fixo-tfoot','os-barras-tbody','os-barras-tfoot',
     'os-relacao-tbody','os-relacao-tfoot','fab-acm-tbody'].forEach(function(id){
      var _e=document.getElementById(id);
      if(_e) _e.innerHTML='';
    });
    // ★ Felipe 23/04: POPULAR _mpItens com os revestimentos. Sem isso, a
    //   proposta comercial cai no fallback single-door (mostra UMA porta
    //   com largura/altura do campo 'largura'), e _populatePropostaItens
    //   fica sem dados para iterar. Também MO, DRE, etc precisam disso.
    window._orcItens.forEach(function(oi, idx){
      if(oi.tipo !== 'revestimento') return;
      if(!oi.largura || !oi.altura) return;
      var mp = {id:'mp_crm_'+idx};
      mp['largura']    = String(oi.largura||'');
      mp['altura']     = String(oi.altura||'');
      mp['qtd-portas'] = String(oi.qtd||'1');
      mp['folhas-porta']='1';
      mp['carac-cor-ext']= oi.cor_ext || '';
      mp['carac-cor-int']= oi.cor_int || oi.cor_ext || '';
      mp._largura = parseFloat(oi.largura)||0;
      mp._altura  = parseFloat(oi.altura)||0;
      mp._qtd     = parseInt(oi.qtd)||1;
      mp._folhas  = 1;
      mp._tipo    = 'revestimento';
      mp._rev_tipo      = oi.rev_tipo || '';
      mp._rev_estrutura = oi.rev_estrutura || '';
      mp._rev_tubo      = oi.rev_tubo || '';
      mp._rev_2lados    = oi.rev_2lados || '';
      mp._modelo        = '';
      mp._modeloTxt     = 'Revestimento ' + (oi.rev_tipo || 'CHAPA');
      window._mpItens.push(mp);
    });
    try{
      console.log('%c[orcItensFromCRM] rev-only: _mpItens populado com '+window._mpItens.length+' revestimento(s)',
        'background:#6a1b9a;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700');
    }catch(e){}
  }

  var bar = document.getElementById('orc-itens-bar');
  if(bar){
    bar.classList.toggle('show', window._orcItens.length > 0);
  }
  var cliEl = document.getElementById('orc-itens-cli');
  if(cliEl) cliEl.textContent = cliente || 'Cliente';
  
  // ── Criar blocos de fixo a partir dos itens CRM tipo "fixo" ────
  var fixoItens = window._orcItens.filter(function(it){ return it.tipo === 'fixo'; });
  if(fixoItens.length > 0){
    // Ativar sistema de fixos
    var tfEl = document.getElementById('tem-fixo');
    if(tfEl){ tfEl.checked = true; if(typeof toggleFixos==='function') toggleFixos(); }
    // Limpar fixos existentes
    var fList = document.getElementById('fixos-list');
    if(fList) fList.innerHTML = '';
    // Criar bloco para cada fixo do CRM
    fixoItens.forEach(function(fx, fi){
      var qty = parseInt(fx.qtd) || 1;
      if(typeof addFixo === 'function') addFixo();
      var blks = document.querySelectorAll('.fixo-blk');
      var last = blks[blks.length - 1];
      if(last){
        var larg = last.querySelector('.fixo-larg'); if(larg) larg.value = fx.largura || '';
        var alt  = last.querySelector('.fixo-alt');  if(alt)  alt.value  = fx.altura  || '';
        var lados= last.querySelector('.fixo-lados');if(lados)lados.value= fx.revestimento_lados || '2';
        var estr = last.querySelector('.fixo-estr'); if(estr) estr.value = fx.tem_estrutura==='SIM' ? 'sim' : 'nao';
        // Tipo: BANDEIRA → superior, LATERAL → lateral
        var tipo = last.querySelector('.fixo-tipo');
        if(tipo){
          tipo.value = (fx.tipo_fixacao==='LATERAL')?'lateral':'superior';
          toggleFixoTipo(tipo);
        }
        // Lado: só para lateral
        var lado = last.querySelector('.fixo-lado');
        if(lado && fx.tipo_fixacao==='LATERAL') lado.value = 'esquerdo';
        // Quantidade
        var qtyEl = last.querySelector('.fixo-qty'); if(qtyEl) qtyEl.value = qty;

        // ★ Cores do item fixo (Felipe 20/04): guardar como dataset no
        //   bloco. O planificador le esses atributos ao iterar .fixo-blk
        //   e atribui _cor às peças FX, evitando que saiam "SEM COR".
        last.dataset.corExt = fx.cor_ext || '';
        last.dataset.corInt = fx.cor_int || '';
      }
    });
  }
  
  orcItensRender();
  // Auto-select first porta item (or first item)
  if(window._orcItens.length > 0){
    var firstPorta = window._orcItens.findIndex(function(it){ return it.tipo === 'porta_pivotante'; });
    var selectIdx = firstPorta >= 0 ? firstPorta : 0;
    setTimeout(function(){ orcItemSelecionar(selectIdx); }, 200);
    setTimeout(function(){
      var _caracBody = document.getElementById('carac-body');
      if(_caracBody) _caracBody.style.display = '';
    }, 400);
    // ★ Felipe 23/04: se há revestimentos ripados, disparar cálculo de
    //   perfis pra incluir tubos PA-51×25×1.5 no custo (fab-mat-perfis).
    //   Funciona com ou sem porta (recalcPerfisAuto cobre ambos os casos).
    var _temRipado = window._orcItens.some(function(it){
      return it.tipo==='revestimento' && it.rev_tipo==='RIPADO';
    });
    if(_temRipado){
      setTimeout(function(){
        try{ if(typeof recalcPerfisAuto==='function') recalcPerfisAuto(); }catch(e){}
      }, 600);
    }
  }
}

function orcItensRender(){
  var grid = document.getElementById('orc-itens-grid');
  if(!grid) return;
  if(!window._orcItens.length){ grid.innerHTML=''; return; }
  
  var TIPOS = {porta_pivotante:{icon:'🚪',label:'Porta Pivotante'},fixo:{icon:'🔲',label:'Fixo'},porta_interna:{icon:'🚪',label:'Porta Interna'},revestimento:{icon:'🧱',label:'Revestimento'}};
  
  var h = '';
  window._orcItens.forEach(function(it, idx){
    var t = TIPOS[it.tipo] || {icon:'📦',label:it.tipo};
    var isActive = idx === window._orcItemAtual;
    var isDone = it._configured;
    // ★ Felipe 23/04: data-idx pra event delegation (fallback caso inline onclick falhe)
    h += '<div class="orc-item-card'+(isActive?' active':'')+(isDone?' done':'')+'" data-idx="'+idx+'" onclick="orcItemSelecionar('+idx+')">';
    h += '<span class="oic-check">✅</span>';
    if(it.qtd > 1) h += '<span class="oic-qty">×'+it.qtd+'</span>';
    h += '<div class="oic-num">Item '+(idx+1)+'</div>';
    h += '<div class="oic-icon">'+t.icon+'</div>';
    h += '<div class="oic-tipo">'+t.label+'</div>';
    if(it.largura && it.altura) h += '<div class="oic-dim">'+it.largura+' × '+it.altura+' mm</div>';
    var details = [];
    if(it.modelo) details.push('Mod '+it.modelo);
    if(it.cor_ext) details.push(it.cor_ext.substring(0,20));
    if(details.length) h += '<div class="oic-mod">'+details.join(' · ')+'</div>';
    h += '</div>';
  });
  grid.innerHTML = h;
  // ★ Felipe 23/04: event delegation COMO BACKUP — se o inline onclick falhar
  //   por qualquer razão (CSP, propagação, etc), o delegation captura via
  //   event bubbling no container. Flag _delegBound evita registrar 2x.
  if(!grid._delegBound){
    grid._delegBound = true;
    grid.addEventListener('click', function(e){
      var card = e.target.closest('.orc-item-card');
      if(!card) return;
      var idx = parseInt(card.getAttribute('data-idx'));
      if(!isNaN(idx) && idx >= 0){
        // Só chama se _orcItemAtual != idx (evita loops)
        if(window._orcItemAtual !== idx){
          console.log('%c[delegation] click Item '+(idx+1)+' (atual era '+(window._orcItemAtual+1)+')',
            'background:#16a085;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700');
          orcItemSelecionar(idx);
        }
      }
    });
  }
}

function orcItemSalvarAtual(){
  if(window._orcItemAtual < 0 || !window._orcItens.length) return;
  // Capture current form data into the item
  var it = window._orcItens[window._orcItemAtual];
  if(!it) return;
  // Capture from form
  it.largura = parseInt((document.getElementById('largura')||{value:0}).value) || it.largura;
  it.altura = parseInt((document.getElementById('altura')||{value:0}).value) || it.altura;
  it._configured = true;
  // Capture all form data for this item
  if(typeof captureFormData === 'function'){
    it._formData = captureFormData();
  }
  orcItensRender();
  // Toast
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 3px 12px rgba(0,0,0,.2)';
  toast.textContent = '✅ Item '+(window._orcItemAtual+1)+' salvo!';
  document.body.appendChild(toast);
  setTimeout(function(){toast.remove();},2000);
}

function orcItemSelecionar(idx){
  if(idx < 0 || idx >= window._orcItens.length) {
    console.warn('[orcItemSelecionar] idx invalido: '+idx+' (total items: '+(window._orcItens||[]).length+')');
    return;
  }
  
  // ★ Felipe 23/04 v2: log MUITO visível pra confirmar que clique disparou.
  var _itDbg = window._orcItens[idx];
  console.log('%c[orcItemSelecionar] Item '+(idx+1)+' clicado | tipo='+((_itDbg||{}).tipo||'?')+' L='+((_itDbg||{}).largura||'?')+' A='+((_itDbg||{}).altura||'?'),
    'background:#e67e22;color:#fff;padding:3px 12px;border-radius:6px;font-weight:800;font-size:13px');
  
  // Save current item before switching
  if(window._orcItemAtual >= 0 && window._orcItemAtual !== idx){
    var cur = window._orcItens[window._orcItemAtual];
    if(cur && typeof captureFormData === 'function'){
      cur._formData = captureFormData();
      // ★ Só salvar largura/altura do form se o item atual é PORTA (campos
      //   'largura' e 'altura' são do card porta). Se é revestimento, usa
      //   rev-orc-* que é salvo em _orcRevSync.
      if(cur.tipo === 'porta_pivotante' || cur.tipo === 'porta_interna' || cur.tipo === 'fixo' || !cur.tipo){
        cur.largura = parseInt((document.getElementById('largura')||{value:0}).value) || cur.largura;
        cur.altura = parseInt((document.getElementById('altura')||{value:0}).value) || cur.altura;
      }
    }
  }
  
  window._orcItemAtual = idx;
  var it = window._orcItens[idx];
  orcItensRender();

  // ★ Felipe 23/04: atualizar título do card PORTA (se visível)
  var _portaTitle = document.getElementById('porta-card-title');
  if(_portaTitle){
    var _tipoLabel = 'Porta';
    if(it.tipo === 'porta_interna') _tipoLabel = 'Porta Interna';
    else if(it.tipo === 'fixo') _tipoLabel = 'Fixo';
    _portaTitle.innerHTML = 'Características <span style="background:#003144;color:#fff;padding:1px 8px;border-radius:10px;font-size:10px;margin-left:6px">Item '+(idx+1)+'</span> <small style="color:#666;font-weight:400">'+_tipoLabel+'</small>';
  }

  // ★ Felipe 22/04: alternar card "Caracteristicas da porta" ↔ "Caracteristicas
  //   do revestimento" conforme tipo do item. Para revestimento, tambem sincroniza
  //   peças manuais do planificador automaticamente (_orcRevSyncPlanificador).
  var _isRevSel = (it.tipo === 'revestimento');
  var _cardPorta = document.getElementById('card-carac-porta');
  var _cardRev = document.getElementById('card-carac-revestimento');
  if(_cardPorta) _cardPorta.style.display = _isRevSel ? 'none' : '';
  if(_cardRev)   _cardRev.style.display   = _isRevSel ? '' : 'none';
  
  // ★ Felipe 23/04: scroll suave até o card de características (UX: usuário
  //   clica no item e vê imediatamente onde foram os dados).
  setTimeout(function(){
    var _targetCard = _isRevSel ? _cardRev : _cardPorta;
    if(_targetCard && _targetCard.scrollIntoView){
      _targetCard.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }, 100);
  if(_isRevSel){
    // ★ Felipe 22/04 v6: garantir que accordion do revestimento (rev-body)
    //   fique ABERTO ao selecionar item. Sem isso, clicar em outro item de
    //   revestimento nao atualiza visualmente porque o accordion esta
    //   fechado (ou estava fechado na carga inicial).
    var _revBody=document.getElementById('rev-body');
    if(_revBody) _revBody.style.display='block';
    var _revBadge=document.getElementById('rev-badge');
    if(_revBadge) _revBadge.innerHTML='&#9650; fechar';
    // Log de debug pra rastrear troca de item (ver console ao clicar)
    try{console.log('[orcItemSelecionar] idx='+idx+' tipo='+it.tipo+' L='+it.largura+' A='+it.altura+' Q='+it.qtd+' rev_tipo='+(it.rev_tipo||'CHAPA'));}catch(e){}
    // ★ Felipe 23/04: tambem setar carac-cor-ext pro revestimento (antes so
    //   setava em porta/fixo). Sem isso, _filterPlanChapaByCor nao sabe qual
    //   cor foi escolhida e o dropdown plan-chapa continua mostrando TODAS
    //   as opcoes (inclusive Alusense de outras cores).
    if(it.cor_ext && typeof setF==='function') try{ setF('carac-cor-ext', it.cor_ext); }catch(e){}
    if(it.cor_int && typeof setF==='function') try{ setF('carac-cor-int', it.cor_int); }catch(e){}
    // Filtrar dropdown plan-chapa pelos tamanhos disponiveis nessa cor
    if(typeof _filterPlanChapaByCor==='function') try{ _filterPlanChapaByCor(); }catch(e){}
    _orcRevPopularCard(it);
    // Sync automatico pro planificador (ao trocar pra revestimento)
    if(typeof _orcRevSyncPlanificador==='function') _orcRevSyncPlanificador();
    // ★ Felipe 22/04 v4: chamar calc() apos sync pra consolidar custo ACM
    //   no painel RESULTADO. Sem isso, as chapas ACM ficavam populadas em
    //   fab-acm-tbody (R$ 18.085,40) mas subFab/Tab/Fat no card lateral
    //   direito ficavam R$ 0,00 porque calc() so roda quando algum evento
    //   dispara — e selecionar item revestimento nao disparava nenhum.
    //   Delay 200ms pra dar tempo de planUpd rodar e _syncChapaToOrc
    //   popular os blocos escondidos acm-sel-1 que o sumBlocks('acm') le.
    setTimeout(function(){
      if(typeof calc==='function') try{calc();}catch(e){console.warn('[revcalc]',e);}
      // Re-popular card depois do calc pra garantir que values certos
      // (algum codigo downstream de calc pode ter sobrescrito inputs)
      try{_orcRevPopularCard(window._orcItens[window._orcItemAtual]);}catch(e){}
    }, 350);
    return; // revestimento nao precisa do fluxo de restoreFormData/setF
  }
  
  // If item has saved form data, restore it
  if(it._formData && typeof restoreFormData === 'function'){
    restoreFormData(it._formData);
    setTimeout(function(){
      if(typeof calc==='function') try{calc();}catch(e){}
    }, 200);
    return;
  }
  
  // Otherwise, load from CRM item data into form
  function setF(fid,v){
    var e=document.getElementById(fid);
    if(e && v !== undefined && v !== null && v !== ''){
      e.value = v;
      ['input','change'].forEach(function(evt){e.dispatchEvent(new Event(evt,{bubbles:true}));});
    }
  }
  
  setF('qtd-portas', it.qtd || 1);

  // ★ Felipe 23/04: se o item selecionado é REVESTIMENTO, NÃO setar
  //   largura/altura nos inputs da porta — caso contrário, os inputs
  //   legacy de porta recebem dimensões do revestimento e _calcularDadosPerfis
  //   calcula uma 'porta fantasma' 1490×4000, gerando custos errados.
  //   Revestimento usa rev-orc-largura/altura no próprio card.
  if(it.tipo !== 'revestimento'){
    setF('largura', it.largura);
    setF('altura', it.altura);
  } else {
    // Se ÚNICO tipo no orçamento é revestimento, zera os inputs de porta
    // pra forçar calc() a detectar _revOnly (W=H=0).
    var _hasPortaOuFixo = (window._orcItens||[]).some(function(ix){
      return ix.tipo==='porta_pivotante' || ix.tipo==='porta_interna' || ix.tipo==='fixo';
    });
    if(!_hasPortaOuFixo){
      var _elL=document.getElementById('largura'); if(_elL){_elL.value='';_elL.dispatchEvent(new Event('input',{bubbles:true}));}
      var _elA=document.getElementById('altura');  if(_elA){_elA.value='';_elA.dispatchEvent(new Event('input',{bubbles:true}));}
    }
  }
  
  if(it.tipo === 'porta_pivotante'){
    setF('carac-abertura', it.abertura || 'PIVOTANTE');
    setF('carac-modelo', it.modelo);
    setF('folhas-porta', it.folhas || '1');
    setF('carac-folhas', it.folhas || '1');
    if(it.cor_ext) setF('carac-cor-ext', it.cor_ext);
    if(it.cor_int) setF('carac-cor-int', it.cor_int);
    if(it.cor_macico){
      // Guardar para setar depois de _checkCorMode popular as opções
      window._pendingCorMacico = it.cor_macico;
    }
    if(it.fech_mec) setF('carac-fech-mec', it.fech_mec);
    if(it.fech_dig) setF('carac-fech-dig', it.fech_dig);
    if(it.cilindro) setF('carac-cilindro', it.cilindro);
    // ★ Felipe 21/04/26: aplicar trava Tedee→Keso apos restore
    _tedeeLockCilindro('carac-fech-dig','carac-cilindro');
    if(it.puxador) setF('carac-puxador', it.puxador);
    // Cava config
    if(it.dist_borda_cava) setF('carac-dist-borda-cava', it.dist_borda_cava);
    if(it.largura_cava) setF('carac-largura-cava', it.largura_cava);
    if(it.dist_borda_friso) setF('carac-dist-borda-friso', it.dist_borda_friso);
    if(it.largura_friso) setF('carac-largura-friso', it.largura_friso);
    if(it.friso_vert) setF('carac-friso-vert', it.friso_vert);
    if(it.friso_horiz) setF('carac-friso-horiz', it.friso_horiz);
    // Modelo 06/16: carregar quantidade e espessura friso horizontal
    if(it.friso_h_qty) setF('plan-friso-h-qty', it.friso_h_qty);
    if(it.friso_h_esp) setF('plan-friso-h-esp', it.friso_h_esp);
    // Modelo 02: quantidade de frisos verticais
    if(it.friso_v_qty) setF('plan-friso-v-qty', it.friso_v_qty);
    // Modelo 23: carregar configuração de molduras
    if(it.moldura_rev) setF('plan-moldura-rev', it.moldura_rev);
    if(it.moldura_larg_qty) setF('plan-moldura-larg-qty', it.moldura_larg_qty);
    if(it.moldura_alt_qty) setF('plan-moldura-alt-qty', it.moldura_alt_qty);
    if(it.moldura_tipo) setF('plan-moldura-tipo', it.moldura_tipo);
    if(it.moldura_dis1) setF('plan-moldura-dis1', it.moldura_dis1);
    if(it.moldura_dis2) setF('plan-moldura-dis2', it.moldura_dis2);
    if(it.moldura_dis3) setF('plan-moldura-dis3', it.moldura_dis3);
    if(it.moldura_divisao) setF('plan-moldura-divisao', it.moldura_divisao);
    if(typeof _toggleMolduraNiveis==='function') setTimeout(_toggleMolduraNiveis,100);
    if(typeof _toggleMolduraDivisao==='function') setTimeout(_toggleMolduraDivisao,100);
    if(it.refilado) setF('plan-refilado', it.refilado);
    // Ripado config
    if(it.ripado_total) setF('carac-ripado-total', it.ripado_total);
    if(it.ripado_2lados) setF('carac-ripado-2lados', it.ripado_2lados);
    var _alisarEl = document.getElementById('carac-tem-alisar');
    if(_alisarEl) _alisarEl.checked = !!it.tem_alisar;
    if(typeof onModeloChange==='function' && it.modelo) try{onModeloChange();}catch(e){}
    // Forçar verificação cor ALU/ACM após todos campos carregados
    if(typeof _checkCorMode==='function') setTimeout(function(){
      _checkCorMode();
      // Agora setar cor maciço (opções já populadas)
      if(window._pendingCorMacico){
        setF('carac-cor-macico', window._pendingCorMacico);
        window._pendingCorMacico=null;
      }
    }, 200);
  }
  
  if(it.tipo === 'fixo'){
    // For fixo, set dimensions and cor, leave model empty
    if(it.cor_ext) setF('carac-cor-ext', it.cor_ext);
    if(it.cor_int) setF('carac-cor-int', it.cor_int);
  }
  
  setTimeout(function(){
    if(typeof calc==='function') try{calc();}catch(e){}
    // Sync planificador and model
    if(typeof planUpd==='function') try{planUpd();}catch(e){}
    if(typeof onModeloChange==='function') try{onModeloChange();}catch(e){}
    if(typeof _checkCorMode==='function') setTimeout(_checkCorMode, 200);
    if(typeof _osAutoGenerate==='function') try{window._osAutoMode=true;_osAutoGenerate();window._osAutoMode=false;}catch(e){}
  }, 300);
}

/* ★ Helpers Revestimento no Orcamento (Felipe 22/04) ────────────────
   _orcRevPopularCard(it): preenche os campos readonly + inputs do card
     "Caracteristicas do Revestimento" com dados do item selecionado.
   _orcRevSync(): disparado quando user edita Largura/Altura/Qtd no
     card Orcamento — escreve de volta no _orcItens[idx] e re-sync
     planificador.
   _orcRevSyncPlanificador(): percorre todos _orcItens.tipo==='revestimento'
     e adiciona/atualiza peças manuais na seção Peças Manuais do planificador.
*/
window._orcRevPopularCard=function(it){
  if(!it) return;
  var _v=function(id,val){var e=document.getElementById(id);if(e)e.value=(val==null?'':val);};
  var _t=function(id,txt){var e=document.getElementById(id);if(e)e.textContent=txt;};
  // ★ Felipe 23/04: título do card mostra item selecionado ("Item 3" etc)
  var _idxDisplay = (window._orcItemAtual != null) ? (window._orcItemAtual + 1) : '?';
  var _titleEl = document.getElementById('rev-card-title');
  if(_titleEl){
    _titleEl.innerHTML = 'Características <span style="background:#27ae60;color:#fff;padding:1px 8px;border-radius:10px;font-size:10px;margin-left:6px">Item '+_idxDisplay+'</span> <small style="color:#666;font-weight:400">Revestimento</small>';
  }
  _v('rev-orc-largura', it.largura);
  _v('rev-orc-altura', it.altura);
  _v('rev-orc-qtd', it.qtd||1);
  // Area — mostra do item atual + total do orcamento (quando ha >1 revestimento)
  var _L=parseFloat(it.largura)||0, _A=parseFloat(it.altura)||0, _Q=parseInt(it.qtd)||1;
  var _areaItem=(_L&&_A)?((_L*_A*_Q)/1e6):0;
  var _revsAll=(window._orcItens||[]).filter(function(r){return r.tipo==='revestimento' && (r.largura||0)>0 && (r.altura||0)>0;});
  var _areaGeral=_revsAll.reduce(function(s,r){return s+((r.largura||0)*(r.altura||0)*(r.qtd||1)/1e6);},0);
  var _areaTxt;
  if(_areaItem>0){
    _areaTxt=_areaItem.toFixed(2)+' m²';
    if(_revsAll.length>1 && _areaGeral>0){
      _areaTxt+='  <small style="color:#1a7a20;font-weight:600">· total orçamento: '+_areaGeral.toFixed(2)+' m²</small>';
    }
  } else {
    _areaTxt='—';
  }
  var _areaEl=document.getElementById('rev-orc-area');
  if(_areaEl) _areaEl.innerHTML=_areaTxt;
  // Config (readonly)
  var _tipoTxt=it.rev_tipo==='RIPADO'?'🪵 Ripado':'🪟 Chapa ACM 4mm';
  _t('rev-orc-tipo-info', _tipoTxt);
  var _estTxt=it.rev_estrutura==='SIM'?'✅ Sim':'❌ Não';
  _t('rev-orc-estrutura-info', _estTxt);
  var _tuboRow=document.getElementById('rev-orc-tubo-row');
  if(_tuboRow) _tuboRow.style.display=(it.rev_estrutura==='SIM')?'':'none';
  if(it.rev_estrutura==='SIM'){
    var _tuboLbl=(it.rev_tubo||'PA-51X12X1.58').replace('PA-','').replace(/X/g,'×');
    _t('rev-orc-tubo-info', _tuboLbl);
  }
  _t('rev-orc-cor-info', it.cor_ext||'—');
  // Calculo detalhado: reusa a mesma logica do CRM (crmItemRevCalc grava no
  // info div do card CRM). Aqui vamos renderizar um resumo simplificado.
  _orcRevRenderCalc(it);
};

// ★ Felipe 23/04: Helper pra aba Acessórios em orçamento só-revestimento.
//   Retorna array com APENAS 3 itens (fita dupla 12mm, Dowsil 995, Primer)
//   consolidados de todos os revestimentos. Usado por
//   _gerarOSRevestimentoOnly(js/08-os_producao.js) ao chamar _renderOSAcess.
window._revCalcAcessoriosGlobal = function(){
  var revs=(window._orcItens||[]).filter(function(r){
    return r.tipo==='revestimento' && (r.largura||0)>0 && (r.altura||0)>0;
  });
  if(!revs.length) return [];

  var savedP={};
  try{var _s=localStorage.getItem('projetta_comp_precos');if(_s)savedP=JSON.parse(_s);}catch(e){}
  function getPreco(code){
    if(savedP[code]!==undefined) return savedP[code];
    if(typeof COMP_DB!=='undefined'){
      for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===code) return COMP_DB[i].p||0;}
    }
    return 0;
  }
  // ★ Felipe 23/04: descrições DEVEM vir exclusivamente do cadastro (COMP_DB).
  //   Nunca inventar. Se um código novo for necessário, cadastrar primeiro.
  function getDesc(code){
    if(typeof COMP_DB!=='undefined'){
      for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===code) return COMP_DB[i].d||code;}
    }
    return code;
  }

  // Reproduzir lógica do _orcRevRenderCalc pra acumular área + tubos
  var areaTotGeral=0, totTubos5112Rip=0;
  revs.forEach(function(r){
    var L=parseFloat(r.largura)||0, A=parseFloat(r.altura)||0, Q=parseInt(r.qtd)||1;
    if(!L||!A) return;
    // ★ Felipe 23/04: suporte 2 lados → multiplicador global do item
    var _mult2L = (r.ripado_2lados==='SIM' || r.rev_2lados==='SIM') ? 2 : 1;
    areaTotGeral += (L*A*Q*_mult2L)/1e6;
    // Só ripado tem tubos
    if(r.rev_tipo==='RIPADO'){
      var nRipas = Math.floor(L/98);
      var tubosPorRipa = Math.max(1, Math.ceil(A/1000));
      totTubos5112Rip += tubosPorRipa * nRipas * Q * _mult2L;
    }
  });

  // ── Fórmula Dowsil 995 + Fita Dupla Face (Felipe 23/04) ──
  //   Felipe: "largura x 2 altura x 3 fixos, e na largura ainda teremos
  //   h/800 para a quantidade arredondando, para não ficar sem silicone
  //   com mais de 800 mm. Rendimento do dowsil 8m. Fita dupla face:
  //   mesma conta porém rendimento dividido por 20".
  //
  //   Comprimento total de cordão (mm) por peça de revestimento:
  //     Horizontais = 2 + ceil(H / 800)
  //     Verticais   = 3
  //     Comp (mm)   = (L × horizontais + A × 3) × qtd × mult_2lados
  //
  //   Dowsil: 1 sachê (591ml) rende 8m de cordão
  //     unidades = ceil(comp_total_m / 8)
  //
  //   Fita dupla face 12mm: 1 rolo rende 20m
  //     unidades = ceil(comp_total_m / 20)
  var compTotalMM = 0;
  revs.forEach(function(r){
    var L = parseFloat(r.largura) || 0;
    var A = parseFloat(r.altura)  || 0;
    var Q = parseInt(r.qtd) || 1;
    if(!L || !A) return;
    var _mult2L = (r.ripado_2lados==='SIM' || r.rev_2lados==='SIM') ? 2 : 1;
    var horiz = 2 + Math.ceil(A / 800);
    var vert  = 3;
    var compPorPeca = (L * horiz) + (A * vert);
    compTotalMM += compPorPeca * Q * _mult2L;
  });
  var compTotalM = compTotalMM / 1000;

  // ── Fita dupla face: SOMA de 2 componentes ──
  //   1) Fita chapa ↔ parede: mesma fórmula do Dowsil (comp_total_m)
  //   2) Fita tubo ↔ ripa (ripado): tubos × 0.5m × 2 lados
  //      Felipe 23/04: 'voce tirou as fitas dos ripados que era os
  //      500 x 2 x quantidade de perfis do ripado'.
  //   Ambos dividem por 20 (rendimento 20m/rolo).
  var fitaChapaParedeM = compTotalM;
  var fitaRipadoM      = totTubos5112Rip * 0.5 * 2;
  var fitaTotalM       = fitaChapaParedeM + fitaRipadoM;
  var fitaRolos        = fitaTotalM > 0 ? Math.ceil(fitaTotalM / 20) : 0;

  // Dowsil 995 sachê 591ml: rendimento 8 m/sachê
  var silSachets = compTotalM > 0 ? Math.ceil(compTotalM / 8) : 0;
  var silMLTot   = silSachets * 591;

  // ── Primer: 1 un por obra (frasco 940ml serve pra toda a fita)
  var primerQty = 1;

  // ── Parafusos PA-CHA AA PHS 4,2X19: 3 parafusos por tubo PA-51X12 de 500mm.
  //   Felipe 23/04: "quando for ripado vamos colocar esse parafuso — 3
  //   parafuso por tubo de 500mm. Se tem 1054 tubos de 0.5 então 3162".
  var parafusoQty = totTubos5112Rip * 3;

  var rows=[];
  if(fitaRolos>0){
    var _fitaObs = 'Chapa↔parede: '+fitaChapaParedeM.toFixed(2)+'m';
    if(fitaRipadoM > 0) _fitaObs += ' + Ripado ('+totTubos5112Rip+' tubos × 0.5 × 2): '+fitaRipadoM.toFixed(2)+'m';
    _fitaObs += ' = '+fitaTotalM.toFixed(2)+'m ÷ 20m/rolo = '+fitaRolos+' rolo(s)';
    rows.push({
      qty: fitaRolos,
      code: 'PA-FITDF 12X20X1.0',
      desc: getDesc('PA-FITDF 12X20X1.0'),
      preco: getPreco('PA-FITDF 12X20X1.0'),
      apl: 'FAB',
      grp: 'FITA DUPLA FACE',
      obs: _fitaObs
    });
  }
  if(silSachets>0){
    rows.push({
      qty: silSachets,
      code: 'PA-DOWSIL 995 ESTR SH',
      desc: getDesc('PA-DOWSIL 995 ESTR SH'),
      preco: getPreco('PA-DOWSIL 995 ESTR SH'),
      apl: 'FAB',
      grp: 'SELANTES',
      obs: 'Comp.total: '+compTotalM.toFixed(2)+'m ÷ 8m/sachê = '+silSachets+' sachê(s) · '+silMLTot+'ml'
    });
  }
  if(parafusoQty>0){
    rows.push({
      qty: parafusoQty,
      code: 'PA-CHA AA PHS 4,2X19',
      desc: getDesc('PA-CHA AA PHS 4,2X19'),
      preco: getPreco('PA-CHA AA PHS 4,2X19'),
      apl: 'FAB',
      grp: 'PARAFUSOS',
      obs: totTubos5112Rip+' tubos × 3 parafusos/tubo = '+parafusoQty+' un'
    });
  }
  rows.push({
    qty: primerQty,
    code: 'PA-PRIMER',
    desc: getDesc('PA-PRIMER'),
    preco: getPreco('PA-PRIMER'),
    apl: 'OBRA',
    grp: 'SELANTES',
    obs: '1 frasco/obra'
  });

  return rows;
};

window._orcRevRenderCalc=function(it){
  // ★ Felipe 22/04 v5 (MATERIAIS CALCULADOS consolidado): antes mostrava so
  //   os dados do item selecionado (ex: 11.15 m² se Item 1 era 1143×4877×2).
  //   Felipe: "nao adianta trazer so de um, traga a somatoria do m2 total
  //   de revestimento". Agora: totaliza area, chapas ACM, chapas pra ripado,
  //   fita e silicone de TODOS os revestimentos do _orcItens — o usuario
  //   precisa ver o consolidado pra validar contra o planificador e o custo.
  //   O item selecionado (argumento 'it') ainda serve pra dar feedback de
  //   preenchimento rapido (mensagem "preencha L/A" se o atual nao tem).
  var calcEl=document.getElementById('rev-orc-calc');
  if(!calcEl) return;
  var _Lit=parseFloat(it&&it.largura)||0, _Ait=parseFloat(it&&it.altura)||0;
  if(!_Lit||!_Ait){calcEl.innerHTML='— Preencha Largura e Altura —';return;}

  var revs=(window._orcItens||[]).filter(function(r){return r.tipo==='revestimento' && (r.largura||0)>0 && (r.altura||0)>0;});
  if(!revs.length) revs=[it]; // fallback: _orcItens ainda nao carregado

  // Acumuladores
  var areaTotGeral=0, totChapasACM=0, totRipas=0, totChapasRipado=0;
  var totChapasFundoRip=0;     // ★ 23/04: chapa ACM de fundo do ripado (L×A)
  var totTubos5112Rip=0;       // ★ 23/04: tubos PA-51X12 500mm (ceil(A/1000) × ripas × Q)
  var breakdown=[]; // linha compacta por item

  revs.forEach(function(r,i){
    var L=parseFloat(r.largura)||0, A=parseFloat(r.altura)||0, Q=parseInt(r.qtd)||1;
    if(!L||!A) return;
    var aItem=(L*A*Q)/1e6;
    areaTotGeral+=aItem;

    var tipo=r.rev_tipo||'CHAPA';
    var chInfo='';
    if(tipo==='RIPADO'){
      // ★ Felipe 23/04: suporte a revestimento em 2 lados (ripado_2lados='SIM').
      //   Se o item tem ripas nos 2 lados (ex: divisória com ripas dos 2 lados),
      //   todas as quantidades devem ser ×2: ripas, chapa de fundo, tubos,
      //   chapas que produzem as ripas.
      var _rev2L = (r.ripado_2lados==='SIM' || r.rev_2lados==='SIM');
      var _mult2L = _rev2L ? 2 : 1;
      var nRipasItem=Math.ceil(L/98);
      var ripasTotItem=nRipasItem*Q*_mult2L;
      totRipas+=ripasTotItem;
      // ★ Felipe 23/04: CHAPA DE FUNDO do painel ripado (L×A).
      //   As ripas de ACM são coladas sobre uma chapa ACM inteira (painel de fundo).
      //   Usa a mesma lógica de CHAPA: divide L por 1490 (largura útil) + pedaço se sobra>5.
      //   Se 2 lados: ×2 (uma chapa de fundo por face).
      var nIntFundo=Math.floor(L/1490);
      var sobraFundo=L-(nIntFundo*1490);
      var pedFundo=sobraFundo>5?sobraFundo:0;
      var chFundoItem=(nIntFundo+(pedFundo>0?1:0))*Q*_mult2L;
      totChapasFundoRip+=chFundoItem;
      // ★ Felipe 23/04: TUBOS PA-51X12X1.58 de 500mm p/ fixação das ripas.
      //   MESMO perfil que a porta com ripado usa (PA-51X12X1.58, kg 0.595).
      //   Qty = ceil(altura/1000) por ripa × total de ripas (já com Q×2L se 2 lados).
      //   Ex: 1490×4000, Q=1 → 4 × 17 = 68 tubos. Se 2 lados: 136 tubos.
      var nTubosPorRipa=Math.max(1, Math.ceil(A/1000));
      var tubosItem=nTubosPorRipa*ripasTotItem;
      totTubos5112Rip+=tubosItem;
      // Mantém cálculo de chapas que PRODUZEM as ripas (processo de fabricação)
      //   ripasTotItem já inclui ×2 se 2 lados, então _nChR também dobra automaticamente
      var _chAltR=5000; if(A>4990) _chAltR=6000; if(A>5990) _chAltR=7000;
      if(A<=6990){
        var _rPChapaR=Math.floor(1490/98)*Math.floor(_chAltR/A);
        var _nChR=Math.ceil(ripasTotItem/_rPChapaR);
        totChapasRipado+=_nChR;
        var _chapaInfo2L = _rev2L?' <span style="color:#e67e22">(2 lados)</span>':'';
        chInfo=ripasTotItem+' ripas + '+chFundoItem+' ch fundo + '+tubosItem+' tubos'+_chapaInfo2L;
      } else {
        chInfo=ripasTotItem+' ripas <span style="color:#c62828">(A>6990 excede)</span>';
      }
    } else {
      var nInt=Math.floor(L/1490);
      var sobra=L-(nInt*1490);
      var pedaco=sobra>5?sobra:0;
      var ch=(nInt+(pedaco>0?1:0))*Q;
      totChapasACM+=ch;
      chInfo=ch+' ch · '+nInt+'×1490'+(pedaco>0?'+1×'+Math.round(pedaco):'');
    }
    breakdown.push({
      idx:(i+1),
      lbl:L+'×'+A+(Q>1?' ×'+Q:''),
      area:aItem,
      tipo:tipo,
      ch:chInfo
    });
  });

  // ★ Felipe 23/04: Dowsil SUSPENSO até Felipe passar fórmula correta.
  //   Antes: areaTotGeral*25/591 (estimativa errada).
  var silMLTot=0;
  var silTubTot=0;
  // ★ Felipe 23/04 (atualizado): Fita dupla face 12mm vai APENAS entre tubo
  //   e ripa. Fórmula: (qtd_tubos × 0.5m × 2 lados) / 20m/rolo.
  //   NÃO incluir área de revestimento (diferente da porta, onde cola chapa
  //   em toda a face — aqui a colagem da chapa/parede é por silicone, não fita).
  var fitaTubosM=totTubos5112Rip*0.5*2; // metros lineares
  var fitaRolos=Math.ceil(fitaTubosM/20);

  var lines=[];
  lines.push('<b>📐 Área total do orçamento:</b> '+areaTotGeral.toFixed(2)+' m²  <small style="color:#888">('+revs.length+' item(s) de revestimento)</small>');

  // ★ 23/04: Chapas ACM consolidadas = parede lisa + fundo do ripado
  var totChapasACMFinal=totChapasACM+totChapasFundoRip;
  if(totChapasACMFinal>0){
    var _deta=[];
    if(totChapasACM>0) _deta.push(totChapasACM+' parede');
    if(totChapasFundoRip>0) _deta.push(totChapasFundoRip+' fundo ripado');
    lines.push('<b>🪟 Chapas ACM 4mm (total):</b> '+totChapasACMFinal+' un'+(_deta.length>1?'  <small style="color:#888">('+_deta.join(' + ')+')</small>':''));
  }
  if(totRipas>0){
    lines.push('<b>🪵 Ripas 98mm (total):</b> '+totRipas+' un'+(totChapasRipado>0?'  <small style="color:#888">(saem de '+totChapasRipado+' chapa(s) ACM)</small>':''));
  }
  // ★ 23/04: Tubos PA-51×25×1.5 × 500mm para fixação das ripas (mesmo da porta)
  if(totTubos5112Rip>0){
    lines.push('<b>🔩 Tubos PA-51×12 (total):</b> '+totTubos5112Rip+' un × 500mm');
  }
  if(totTubos5112Rip>0){
    lines.push('<b>🔖 Fita DFIX 1,0mm×12mm×20m (PA-FITDF 12X20X1.0) (total):</b> '+fitaRolos+' rolo'+(fitaRolos!==1?'s':'')+' × 20m <small style="color:#888">('+totTubos5112Rip+' tubos × 0.5m × 2 lados = '+fitaTubosM.toFixed(1)+'m)</small>');
  }
  // ⚠ Dowsil SUSPENSO até Felipe passar fórmula correta
  lines.push('<b>🧴 Dowsil 995:</b> <span style="color:#c62828;font-style:italic">⏳ aguardando fórmula</span>');

  // Breakdown compacto (apenas se mais de 1 item, senao ja viu tudo acima)
  if(breakdown.length>1){
    var bl=['<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #c9c6bf"><b style="color:#666;font-size:11px">📋 Breakdown por item:</b></div>'];
    bl.push('<div style="font-size:11px;color:#555;line-height:1.55">');
    breakdown.forEach(function(b){
      var tipoBadge=b.tipo==='RIPADO'?'🪵':'🪟';
      bl.push('<div style="display:flex;gap:8px"><span style="min-width:28px;color:#888">#'+b.idx+'</span><span style="min-width:120px">'+tipoBadge+' '+b.lbl+'</span><span style="min-width:70px;color:#1a7a20;font-weight:600">'+b.area.toFixed(2)+' m²</span><span style="color:#666">'+b.ch+'</span></div>');
    });
    bl.push('</div>');
    lines.push(bl.join(''));
  }

  calcEl.innerHTML=lines.join('<br>');
};

window._orcRevSync=function(){
  if(window._orcItemAtual==null || window._orcItemAtual<0) return;
  var it=window._orcItens[window._orcItemAtual];
  if(!it || it.tipo!=='revestimento') return;
  var L=parseFloat((document.getElementById('rev-orc-largura')||{value:0}).value)||0;
  var A=parseFloat((document.getElementById('rev-orc-altura')||{value:0}).value)||0;
  var Q=parseInt((document.getElementById('rev-orc-qtd')||{value:1}).value)||1;
  it.largura=L; it.altura=A; it.qtd=Q;
  // Atualiza area do item + total orcamento (consolidado Felipe 22/04 v5)
  var _areaItem=(L&&A)?((L*A*Q)/1e6):0;
  var _revsAll=(window._orcItens||[]).filter(function(r){return r.tipo==='revestimento' && (r.largura||0)>0 && (r.altura||0)>0;});
  var _areaGeral=_revsAll.reduce(function(s,r){return s+((r.largura||0)*(r.altura||0)*(r.qtd||1)/1e6);},0);
  var _areaTxt;
  if(_areaItem>0){
    _areaTxt=_areaItem.toFixed(2)+' m²';
    if(_revsAll.length>1 && _areaGeral>0){
      _areaTxt+='  <small style="color:#1a7a20;font-weight:600">· total orçamento: '+_areaGeral.toFixed(2)+' m²</small>';
    }
  } else {
    _areaTxt='—';
  }
  var _areaEl=document.getElementById('rev-orc-area');
  if(_areaEl) _areaEl.innerHTML=_areaTxt;
  _orcRevRenderCalc(it);
  // Sync bar de itens no topo (pra mostrar dimensoes novas)
  if(typeof orcItensRender==='function') orcItensRender();
  // Sync planificador
  _orcRevSyncPlanificador();
  // ★ Felipe 23/04: Recalcular tubos PA-51×25 do revestimento ripado e
  //   injetar no custo (fab-mat-perfis). Roda com ou sem porta.
  setTimeout(function(){
    try{ if(typeof recalcPerfisAuto==='function') recalcPerfisAuto(); }catch(e){}
  }, 200);
  // Re-disparar calc() pro resultado consolidar a area total
  setTimeout(function(){ if(typeof calc==='function') try{calc();}catch(e){} }, 350);
};

window._orcRevSyncPlanificador=function(){
  // ★ Felipe 22/04 v2 (fix pre-cut): popular peças manuais do planificador
  //   com as PEÇAS DE CORTE REAIS de cada revestimento — não com as dimensões
  //   brutas do painel. Sem esse pre-cut, um revestimento 4500×3000 virava
  //   1 peça 4500×3000 que não cabia em chapa 1500×3000 → planificador
  //   silenciava, nada era nestado.
  //
  //   Regra de corte (mesma do crmItemRevCalc):
  //   • CHAPA ACM 4mm: divide L por 1490 (largura útil). N chapas inteiras
  //     de 1490×A + 1 pedaço (L−N×1490)×A quando sobra >5mm.
  //   • RIPADO: ripas de 98mm × A. Total de ripas = ceil(L/98).
  //
  //   Rótulos 'REV N CHAPA', 'REV N SOBRA', 'REV N RIPA' — filtro idempotente
  //   /^REV\s/ cobre todos. Cada revestimento vira 1-2 linhas em Peças Manuais.
  if(!window._orcItens) return;
  var tbody=document.getElementById('plan-manual-tbody');
  if(!tbody) return;
  // Limpar linhas REV* existentes (mantendo as demais peças manuais do user)
  var rows=Array.from(tbody.children);
  rows.forEach(function(r){
    var nameInput=r.querySelector('input[id$="-n"]');
    if(nameInput && /^REV\s/i.test(nameInput.value||'')){
      r.remove();
    }
  });
  // Adicionar peças revestimento atuais — pre-cut conforme tipo
  var LARG_UTIL=1490;
  function _addRow(nome, w, h, qty){
    if(typeof addManualPiece!=='function' || !(w>0) || !(h>0) || !(qty>0)) return;
    addManualPiece();
    var tbRows=tbody.children;
    var last=tbRows[tbRows.length-1];
    if(!last) return;
    var id=last.id;
    var _setVal=function(suf,v){var e=document.getElementById(id+suf);if(e)e.value=v;};
    _setVal('-n', nome);
    _setVal('-w', w);
    _setVal('-h', h);
    _setVal('-q', qty);
  }
  var revs=window._orcItens.filter(function(it){return it.tipo==='revestimento' && it.largura>0 && it.altura>0;});
  // ★ Felipe 23/04 v3: gerar EXATAMENTE o que está no card.
  //
  //   CARD RIPADO → 2 linhas por item:
  //     • REV N FUNDO — chapa inteira L×A×Q (a chapa de fundo do painel)
  //     • REV N RIPA  — 98×A, qtd = ceil(L/90)×Q (ripa largura 98, mas
  //       divisor 90 porque cada ripa ocupa 90mm no painel com gap)
  //
  //   CARD CHAPA → 1 linha por item:
  //     • REV N — chapa L×A×Q
  //
  //   Se 2 lados: Q×2 em tudo.
  revs.forEach(function(it,i){
    var L=parseFloat(it.largura)||0, A=parseFloat(it.altura)||0, Q=parseInt(it.qtd)||1;
    var _mult2L = (it.rev_2lados==='SIM' || it.ripado_2lados==='SIM') ? 2 : 1;
    var _Qtot = Q * _mult2L;
    var tipo = it.rev_tipo || 'CHAPA';
    var revNum = i+1;
    if(tipo === 'RIPADO'){
      // 1. Chapa de fundo (peça inteira do painel)
      _addRow('REV '+revNum+' FUNDO', L, A, _Qtot);
      // 2. Ripas — largura 98mm, altura A, qtd = ceil(L/90) × Q
      var nRipas = Math.ceil(L / 90);
      if(nRipas > 0) _addRow('REV '+revNum+' RIPA', 98, A, nRipas * _Qtot);
    } else {
      // CHAPA lisa: 1 peça L×A
      _addRow('REV '+revNum, L, A, _Qtot);
    }
  });
  // ★ Felipe 22/04 v3 (fix accordion fechado): crmFazerOrcamento chama
  //   resetToDefaults() ANTES de carregar itens, que fecha TODOS os
  //   accordions inclusive plan-body (js/03-history_save.js:1648). Sem
  //   reabrir, a aba Levantamento de Superfícies aparece só com o titulo
  //   "PLANIFICAR CHAPAS" e o user acha que as peças não foram
  //   sincronizadas quando na verdade estão escondidas dentro do
  //   accordion fechado. Reabrir quando ha revestimentos + peças geradas.
  if(revs.length > 0){
    var pb = document.getElementById('plan-body');
    if(pb) pb.style.display = 'block';
    var pbadge = document.getElementById('plan-badge');
    if(pbadge) pbadge.innerHTML = '&#9650; fechar';
  }
  // Trigger planUpd uma unica vez
  if(typeof planUpd==='function') try{planUpd();}catch(e){}
  // Esconder texto de empty se ha peças
  var empty=document.getElementById('plan-manual-empty');
  if(empty) empty.style.display=(tbody.children.length>0)?'none':'';
};

// Backward compat: restore form data
function restoreFormData(data){
  if(!data) return;
  Object.keys(data).forEach(function(key){
    var el = document.getElementById(key);
    if(!el) return;
    if(el.type === 'checkbox'){
      el.checked = (data[key] === true || data[key] === 'true');
    } else {
      el.value = data[key] || '';
    }
  });
  // Trigger change events on key fields
  ['largura','altura','carac-modelo','carac-cor-ext','carac-cor-int','folhas-porta'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.dispatchEvent(new Event('change',{bubbles:true}));
  });
}


/* ── Fazer Orçamento ─────────────────────────────── */
window._crmOrcCardId=null;
window.crmFazerOrcamento=function(id){
  // Salvar dados atuais do CRM antes de carregar
  if(typeof _crmItensSaveFromDOM==='function') try{_crmItensSaveFromDOM();}catch(e){}
  if(typeof crmSaveCard==='function') try{crmSaveCard();}catch(e){}
  var opp=cLoad().find(function(o){return o.id===id;});if(!opp)return;
  window._crmOrcCardId=id;
  // ★ Felipe 23/04: armazenar scope do card CRM globalmente. Isso e a fonte
  //   da verdade pro "é internacional?" em toda a aba Orçamento (idioma da
  //   proposta, moeda, blocos FOB/CIF, tubo 51mm vs 38mm, etc.). O botao
  //   BR Nacional / Internacional do modal Editar Oportunidade é o que define,
  //   independente de quem vai instalar (SEM/PROJETTA/TERCEIROS).
  window._crmScope = opp.scope || 'nacional';
  if(document.body) document.body.setAttribute('data-scope', window._crmScope);
  // ★ Felipe 23/04: aplicar defaults financeiros intl quando scope='internacional'.
  //   Antes só aplicava quando user mudava inst-quem='INTERNACIONAL'. Agora
  //   que scope vem do CRM (botão "Internacional" no modal Editar
  //   Oportunidade), precisa aplicar aqui tb. Reseta flag pra garantir
  //   que aplica (cada card carregado redefine o estado financeiro).
  if(window._crmScope === 'internacional'){
    window._intlDefaultsAplicado = false; // força reaplicar
    if(typeof window._aplicarDefaultsIntl === 'function') window._aplicarDefaultsIntl();
  }
  // ★ Felipe 23/04: dados de logistica internacional (incoterm, caixa, fretes).
  //   Lidos do card e usados na proposta pra gerar bloco FOB/CIF com breakdown
  //   de caixa de madeira fumigada + frete terrestre + frete maritimo (se CIF).
  window._crmIntlData = {
    incoterm:        (opp.inst_incoterm || '').toUpperCase(),
    caixa_a:         parseFloat(opp.cif_caixa_a)||0,
    caixa_l:         parseFloat(opp.cif_caixa_l)||0,
    caixa_e:         parseFloat(opp.cif_caixa_e)||0,
    caixa_taxa:      parseFloat(opp.cif_caixa_taxa)||100,
    frete_terrestre: parseFloat(opp.cif_frete_terrestre)||0,
    frete_maritimo:  parseFloat(opp.cif_frete_maritimo)||0,
    pais:            opp.pais || '',
    cidade:          opp.cidade || ''
  };
  if(typeof switchTab==='function')switchTab('orcamento');
  setTimeout(function(){
    // Salvar orçamento atual se tem dados e iniciar novo
    var clienteAtual=(document.getElementById('cliente')||{}).value;
    if(clienteAtual && clienteAtual.trim() && typeof salvarRapido==='function'){
      try{salvarRapido();}catch(e){}
    }
    // Desconectar do orçamento salvo anterior
    if(typeof currentId!=='undefined'){currentId=null;currentRev=null;}
    if(typeof _persistSession==='function')try{_persistSession();}catch(e){}
    if(typeof window._isATP!=='undefined')window._isATP=false;
    var curBanner=document.getElementById('cur-banner');if(curBanner)curBanner.classList.remove('show');
    // Zerar tudo
    window._snapshotLock=false;
    window._orcLocked=false;
    window._pendingRevision=false;
    window._forceUnlockAfterLoad=false;
    window._custoCalculado=false;
    window._osGeradoUmaVez=false;
    try{_setOrcLock(false);}catch(e){}
    try{_hideMemorial();}catch(e){}
    var lockBanner=document.getElementById('orc-lock-banner');if(lockBanner)lockBanner.style.display='none';
    if(typeof resetToDefaults==='function')try{resetToDefaults();}catch(e){}
    // Reset visual ATP
    var badge=document.getElementById('status-badge');if(badge){badge.textContent='ORÇAMENTO';badge.style.background='#e67e22';}
    var atpRow=document.getElementById('atp-field-row');if(atpRow)atpRow.style.display='none';
    var atpCont=document.getElementById('atp-contato-row');if(atpCont)atpCont.style.display='none';
    var endEl=document.getElementById('atp-endereco');if(endEl)endEl.style.display='none';
    var btnAtp=document.getElementById('btn-gerar-atp');if(btnAtp){btnAtp.textContent='📋 Gerar ATP';btnAtp.style.background='#1a5276';btnAtp.style.borderColor='#1a5276';}

    // Agora preencher com dados do CRM
    function setF(fid,v){var e=document.getElementById(fid);if(e&&v){e.value=v;['input','change'].forEach(function(evt){e.dispatchEvent(new Event(evt,{bubbles:true}));});}}
    setF('cliente',opp.cliente);
    
    // Transfer items to Orçamento
    if(opp.itens && opp.itens.length > 0){
      orcItensFromCRM(opp.itens, opp.cliente);
    } else if(opp.largura && opp.altura){
      // Backward compat: single item
      orcItensFromCRM([{tipo:'porta_pivotante',qtd:1,largura:opp.largura,altura:opp.altura,modelo:opp.modelo||'',abertura:opp.abertura||'PIVOTANTE',folhas:opp.folhas||'1',cor_ext:opp.cor_ext||'',cor_int:opp.cor_int||'',cor_macico:opp.cor_macico||'',moldura_rev:opp.moldura_rev||''}], opp.cliente);
    }
    // Sync multi-porta para planificador
    if(window._orcItens && window._orcItens.length > 1){
      if(typeof _syncOrcToMpItens==='function') setTimeout(_syncOrcToMpItens, 300);
    }
    // Transfer instalação — internacional auto-seleciona instalação internacional
    var instQuem=opp.inst_quem||'PROJETTA';
    // ★ Felipe 23/04: RESPEITAR 'SEM Instalação' acima do scope=internacional.
    //   Antes: 'if(opp.scope==="internacional") instQuem="INTERNACIONAL"'
    //   sobrepunha qualquer valor, inclusive SEM. Resultado: Felipe marcava
    //   'Sem Instalação' no CRM e ainda via o bloco Instalação Internacional
    //   (passagem, hotel, câmbio) no orçamento. Agora só força INTERNACIONAL
    //   se o usuário NÃO escolheu explicitamente SEM.
    if(opp.scope==='internacional' && instQuem!=='SEM') instQuem='INTERNACIONAL';
    setF('inst-quem',instQuem);
    if(instQuem==='TERCEIROS'){
      setF('inst-terceiros-valor',opp.inst_valor||'');
      setF('inst-terceiros-transp',opp.inst_transp||'');
    }
    if(typeof toggleInstQuem==='function') toggleInstQuem();

    // ★ CRÍTICO (Felipe 20/04): preferir opp.itens[0].* sobre opp.* quando
    //   houver. O ITEM do pedido (editado no card) é a fonte de verdade.
    //   opp.* pode estar desatualizado se o usuário editou só no item
    //   e o espelhamento pro nível card não rodou.
    var _firstItem=(opp.itens&&opp.itens.length>0)?opp.itens[0]:{};
    var _pick = function(field, fallback){
      if(_firstItem && _firstItem[field] !== undefined && _firstItem[field] !== '') return _firstItem[field];
      if(opp[field] !== undefined && opp[field] !== '') return opp[field];
      return fallback || '';
    };

    // ★ Felipe 23/04: só setar largura/altura nos inputs LEGACY da porta se
    //   o orçamento TIVER item porta/fixo. Se for só revestimento, esses
    //   inputs precisam ficar VAZIOS pro calc() detectar _revOnly e rodar
    //   a lógica correta (sem simular uma porta fantasma com dimensões do
    //   revestimento, o que fazia _calcularDadosPerfis retornar perfis
    //   de porta pintados por R$ 14.629 indevidamente).
    var _temPortaFixo = (opp.itens||[]).some(function(ix){
      return ix.tipo==='porta_pivotante' || ix.tipo==='porta_interna' || ix.tipo==='fixo';
    });
    if(_temPortaFixo){
      // Pegar PRIMEIRO item porta/fixo pra popular L/A (não um revestimento qualquer)
      var _primeiraPorta = (opp.itens||[]).find(function(ix){
        return ix.tipo==='porta_pivotante' || ix.tipo==='porta_interna' || ix.tipo==='fixo';
      });
      setF('largura', (_primeiraPorta && _primeiraPorta.largura) || _pick('largura',''));
      setF('altura',  (_primeiraPorta && _primeiraPorta.altura)  || _pick('altura',''));
    } else {
      // Orçamento SÓ revestimento: limpar inputs legacy da porta
      var _elL2=document.getElementById('largura'); if(_elL2) _elL2.value='';
      var _elA2=document.getElementById('altura');  if(_elA2) _elA2.value='';
    }
    // Responsavel (Thays/Felipe/Andressa) — map to the select
    if(opp.responsavel){setF('responsavel',opp.responsavel);}
    setF('carac-abertura', _pick('abertura',''));
    setF('carac-modelo',   _pick('modelo',''));
    // Número de Folhas
    var _folhas = _pick('folhas','1');
    if(_folhas){setF('folhas-porta',_folhas);setF('carac-folhas',_folhas);}
    // Cores da chapa
    var _corExt = _pick('cor_ext',''); if(_corExt) setF('carac-cor-ext',_corExt);
    var _corInt = _pick('cor_int',''); if(_corInt) setF('carac-cor-int',_corInt);
    // Moldura rev e cor maciço
    var _moldRev=_pick('moldura_rev','');
    var _corMac=_pick('cor_macico','');
    if(_moldRev)setF('plan-moldura-rev',_moldRev);
    if(_corMac) window._pendingCorMacico=_corMac;
    // Forçar _checkCorMode + planRun após carregamento
    setTimeout(function(){
      if(typeof _checkCorMode==='function') _checkCorMode();
      if(window._pendingCorMacico){
        var macSel=document.getElementById('carac-cor-macico');
        if(macSel){macSel.value=window._pendingCorMacico;window._pendingCorMacico=null;}
      }
      if(typeof planUpd==='function') try{planUpd();}catch(e){}
      if(typeof _autoSelectAndRun==='function') try{_autoSelectAndRun();}catch(e){}
    },500);
    // Número da Reserva
    if(opp.reserva){setF('numprojeto',opp.reserva);}
    if(opp.agp){setF('num-agp',opp.agp);}
    // Transfer CEP
    if(opp.cep)setF('cep-cliente',opp.cep);
    // Representante externo
    var repSel=document.getElementById('rep-sel');
    if(repSel){
      if(opp.origem==='Weiku do Brasil'&&opp.wrep){
        // Try to match Weiku rep
        var matched=false;
        for(var ri=0;ri<repSel.options.length;ri++){
          if(repSel.options[ri].text.toLowerCase().includes(opp.wrep.split('(')[0].trim().toLowerCase().slice(0,10))||
             repSel.options[ri].value.toLowerCase().includes(opp.wrep.split('(')[0].trim().toLowerCase().slice(0,10))){
            repSel.selectedIndex=ri;matched=true;
            repSel.dispatchEvent(new Event('change',{bubbles:true}));break;
          }
        }
      } else {
        // Não é Weiku → usar Projetta Portas como representante
        var projOpt=null;
        for(var ri=0;ri<repSel.options.length;ri++){
          if(repSel.options[ri].text.toLowerCase().includes('projetta')){projOpt=ri;break;}
        }
        if(projOpt!==null){repSel.selectedIndex=projOpt;}
        else{
          // Adicionar opção Projetta se não existe
          var opt=document.createElement('option');opt.value='PROJETTA';opt.text='Projetta Portas Exclusivas LTDA';
          repSel.add(opt);repSel.value='PROJETTA';
        }
        repSel.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
    if(typeof calc==='function')try{calc();}catch(e){}
    if(typeof onModeloChange==='function'&&opp.modelo)try{onModeloChange();}catch(e){}
    // If CEP was set, try to search
    // Auto-buscar CEP do card no orçamento
    if(opp.cep){
      setTimeout(function(){
        var cepEl=document.getElementById('cep-cliente');
        if(cepEl && cepEl.value){
          if(typeof buscaCep==='function') try{buscaCep();}catch(e){}
        }
      }, 600); // aguardar campos preenchidos
    }
    var t=document.createElement('div');t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';t.textContent='✅ '+opp.cliente+' — calculando orçamento...';document.body.appendChild(t);setTimeout(function(){t.remove();},4000);

    // ★ RESTAURAR scratch de dados da aba Orçamento (Felipe 20/04):
    //   Dados como passagens/hotel/câmbio/CIF são digitados na aba
    //   Orçamento. O autosave os persiste em card.orcData. Ao clicar
    //   Fazer Orçamento de novo, restauramos pro usuário continuar
    //   de onde parou.
    //
    //   IMPORTANTE: precisa rodar ANTES de gerarCustoTotal (senao o
    //   calculo inicial usa campos vazios). Antes estava em
    //   setTimeout(900ms) paralelo ao de 1200ms — se o 900 demorasse
    //   um pouco, caia DEPOIS do 1200 e os valores restaurados eram
    //   sobrescritos pelo calc(). Agora encadeamos:
    //     1) setTimeout 800ms → restaurar
    //     2) dentro DESSE, setTimeout 400ms → gerarCustoTotal
    //   Assim a ordem é deterministica.
    setTimeout(function(){
      // Passo 1: restaurar
      if(typeof window._restaurarCamposOrcDoCard === 'function'){
        try { window._restaurarCamposOrcDoCard(id); }
        catch(e){ console.warn('restaurar orcData:', e); }
      }

      // Passo 2: depois gerar custo total (campos ja populados)
      setTimeout(function(){
      // Esconder botão GERAR CUSTO COMPLETO (auto-calculado)
      var gcw=document.getElementById('gerar-custo-wrap');if(gcw)gcw.style.display='none';
      // ── Sincronizar itens CRM → multi-porta para cálculo combinado ──
      if(window._orcItens && window._orcItens.length > 1){
        _syncOrcToMpItens();
      }
      window._osAutoMode=true;
      if(typeof gerarCustoTotal==='function'){
        try{
          gerarCustoTotal();
        }catch(e){
          console.warn('auto-gerarCustoTotal:',e);
          try{if(typeof gerarOS==='function')gerarOS();}catch(e2){console.warn('fallback gerarOS:',e2);}
        }
      }
      window._osAutoMode=false;
      // Auto-run planificador com todas as peças combinadas
      setTimeout(function(){
        try{
          // 1) Sync cor do primeiro item para carac-cor-ext (necessário para planificador)
          var _f1=window._mpItens&&window._mpItens[0];
          if(_f1){
            var _corF=_f1['carac-cor-ext']||'';
            if(_corF&&document.getElementById('carac-cor-ext'))document.getElementById('carac-cor-ext').value=_corF;
          }
          // 2) Atualizar peças
          if(typeof planUpd==='function') planUpd();
          // 3) Simulação + seleção melhor chapa + cor
          if(typeof _autoSelectAndRun==='function') _autoSelectAndRun();
          // 4) Rodar planRun (Calcular aproveitamento) automático
          setTimeout(function(){
            try{
              if(typeof planRun==='function') planRun();
              // 5) Usar resultado nas chapas
              setTimeout(function(){
                try{
                  if(typeof _syncChapaToOrc==='function') _syncChapaToOrc();
                  if(typeof _updateFabChapaResumo==='function') _updateFabChapaResumo();
                  if(typeof calc==='function') calc();
                }catch(e3){console.warn('auto-sync:',e3);}
              },300);
            }catch(e2){console.warn('auto-planRun:',e2);}
          },300);
        }catch(e){console.warn('auto-plan:',e);}
      },600);
      }, 400); // Passo 2 (gerar custo total): roda 400ms apos restaurar
    }, 800); // Passo 1 (restaurar scratch do card)
    // Botões CRM: escondidos até o usuário SALVAR o orçamento
    var btn=document.getElementById('crm-orc-pronto-btn');
    if(btn){btn.style.display='none';btn.setAttribute('data-id',id);}
    var btnAtt=document.getElementById('crm-atualizar-btn');
    if(btnAtt){btnAtt.style.display='none';}
  },350);
};
/* ── Compartilhar Card — Link/WhatsApp/Download ── */
window.crmCompartilharCard=function(cardId){
  var data=cLoad();
  var card=data.find(function(o){return o.id===cardId;});
  if(!card){alert('Card não encontrado.');return;}
  var brl=function(v){return v?'R$ '+_fmtBRLCeil(v):'—';};
  var lastRev=card.revisoes&&card.revisoes.length>0?card.revisoes[card.revisoes.length-1]:null;
  var valorTab=lastRev?brl(lastRev.valorTabela):brl(card.valorTabela||card.valor);
  var valorFat=lastRev?brl(lastRev.valorFaturamento):brl(card.valorFaturamento||card.valor);
  var revLabel=lastRev?lastRev.label:'—';

  // Texto para WhatsApp
  var wppText='*PROJETTA PORTAS EXCLUSIVAS*\n\n'
    +'📋 *Proposta Comercial*\n'
    +'👤 Cliente: *'+card.cliente+'*\n'
    +(card.agp?'📌 AGP: '+card.agp+'\n':'')
    +(card.reserva?'📌 Reserva: '+card.reserva+'\n':'')
    +(card.largura?'📐 Medidas: '+card.largura+' × '+card.altura+' mm\n':'')
    +(card.modelo?'🚪 Modelo: '+card.modelo+'\n':'')
    +'\n💰 *Valores:*\n'
    +'Tabela: '+valorTab+'\n'
    +'Faturamento: '+valorFat+'\n'
    +'Versão: '+revLabel+'\n'
    +'\n📅 '+new Date().toLocaleDateString('pt-BR');

  // Texto para copiar
  var copyText='PROJETTA PORTAS EXCLUSIVAS\n'
    +'Proposta: '+card.cliente+'\n'
    +(card.agp?'AGP: '+card.agp+'\n':'')
    +(card.largura?'Medidas: '+card.largura+'×'+card.altura+'mm\n':'')
    +'Tabela: '+valorTab+' | Fat: '+valorFat+'\n'
    +'Versão: '+revLabel;

  // Modal de compartilhamento
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  var html='<div style="background:#fff;border-radius:12px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;overflow:hidden">';
  html+='<div style="background:linear-gradient(135deg,#27ae60,#2ecc71);color:#fff;padding:14px 18px;border-radius:12px 12px 0 0">';
  html+='<div style="font-size:15px;font-weight:800">📤 Compartilhar Proposta</div>';
  html+='<div style="font-size:11px;opacity:.8">'+card.cliente+' — '+valorFat+'</div></div>';
  html+='<div style="padding:16px;display:flex;flex-direction:column;gap:10px">';

  // WhatsApp
  html+='<a href="https://wa.me/?text='+encodeURIComponent(wppText)+'" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:13px">📱 Enviar por WhatsApp</a>';

  // Email
  var emailSubject='Proposta Projetta - '+card.cliente;
  var emailBody=copyText;
  html+='<a href="mailto:?subject='+encodeURIComponent(emailSubject)+'&body='+encodeURIComponent(emailBody)+'" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;background:#3498db;color:#fff;text-decoration:none;font-weight:700;font-size:13px">📧 Enviar por E-mail</a>';

  // Copiar texto
  html+='<button onclick="navigator.clipboard.writeText(\''+copyText.replace(/'/g,"\\'").replace(/\n/g,"\\n")+'\').then(function(){this.textContent=\'✅ Copiado!\'}.bind(this))" style="padding:12px 16px;border-radius:8px;background:#f0f0f0;border:1px solid #ddd;color:#333;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;text-align:left">📋 Copiar Texto da Proposta</button>';

  // Ver proposta salva (se tiver PDF)
  if(lastRev&&(lastRev.pdfCloud||(lastRev.pdfPages&&lastRev.pdfPages.length>0))){
    html+='<button onclick="document.querySelector(\'div[style*=fixed]\').remove();crmVerProposta(\''+cardId+'\','+(card.revisoes.length-1)+')" style="padding:12px 16px;border-radius:8px;background:#8e44ad;color:#fff;border:none;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">📄 Ver PDF da Proposta</button>';
  }

  // Link direto (gera página standalone)
  html+='<button onclick="_gerarPaginaProposta(\''+cardId+'\')" style="padding:12px 16px;border-radius:8px;background:#e67e22;color:#fff;border:none;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">🔗 Gerar Página da Proposta</button>';

  html+='<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:8px;background:none;border:none;color:#999;font-size:12px;cursor:pointer;font-family:inherit">Fechar</button>';
  html+='</div></div>';
  ov.innerHTML=html;
  document.body.appendChild(ov);
};

/* ── Gerar página standalone da proposta ── */
function _gerarPaginaProposta(cardId){
  var data=cLoad();
  var card=data.find(function(o){return o.id===cardId;});
  if(!card)return;
  var brl=function(v){return v?'R$ '+_fmtBRLCeil(v):'—';};
  var lastRev=card.revisoes&&card.revisoes.length>0?card.revisoes[card.revisoes.length-1]:null;
  var w=window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');
  w.document.write('<title>Proposta - '+card.cliente+'</title>');
  w.document.write('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#f5f5f5;color:#333}');
  w.document.write('.pg{max-width:600px;margin:0 auto;background:#fff;min-height:100vh}');
  w.document.write('.hdr{background:linear-gradient(135deg,#003144,#00526b);color:#fff;padding:24px 20px;text-align:center}');
  w.document.write('.hdr h1{font-size:14px;letter-spacing:2px;opacity:.7;margin-bottom:8px}');
  w.document.write('.hdr h2{font-size:20px;font-weight:800}');
  w.document.write('.body{padding:20px}.card{border:1px solid #eee;border-radius:10px;padding:16px;margin-bottom:12px}');
  w.document.write('.card-t{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px;font-weight:700}');
  w.document.write('.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:14px}');
  w.document.write('.row:last-child{border:none}.lbl{color:#888}.val{font-weight:700;color:#003144}');
  w.document.write('.total{background:#003144;color:#fff;border-radius:10px;padding:16px;text-align:center;margin:12px 0}');
  w.document.write('.total .v{font-size:28px;font-weight:800}');
  w.document.write('.foot{text-align:center;padding:20px;font-size:10px;color:#aaa}');
  w.document.write('img{width:100%;border-radius:8px;margin:8px 0}');
  w.document.write('</style></head><body><div class="pg">');
  w.document.write('<div class="hdr"><h1>PROJETTA PORTAS EXCLUSIVAS</h1><h2>Proposta Comercial</h2></div>');
  w.document.write('<div class="body">');
  // Cliente
  w.document.write('<div class="card"><div class="card-t">Cliente</div>');
  w.document.write('<div class="row"><span class="lbl">Nome</span><span class="val">'+card.cliente+'</span></div>');
  if(card.agp) w.document.write('<div class="row"><span class="lbl">AGP</span><span class="val">'+card.agp+'</span></div>');
  if(card.reserva) w.document.write('<div class="row"><span class="lbl">Reserva</span><span class="val">'+card.reserva+'</span></div>');
  if(card.cidade) w.document.write('<div class="row"><span class="lbl">Cidade</span><span class="val">'+card.cidade+'</span></div>');
  w.document.write('</div>');
  // Produto
  if(card.largura||card.modelo){
    w.document.write('<div class="card"><div class="card-t">Produto</div>');
    if(card.largura) w.document.write('<div class="row"><span class="lbl">Medidas</span><span class="val">'+card.largura+' × '+card.altura+' mm</span></div>');
    if(card.modelo) w.document.write('<div class="row"><span class="lbl">Modelo</span><span class="val">'+card.modelo+'</span></div>');
    if(card.abertura) w.document.write('<div class="row"><span class="lbl">Abertura</span><span class="val">'+card.abertura+'</span></div>');
    w.document.write('</div>');
  }
  // Valores
  w.document.write('<div class="total"><div style="font-size:11px;opacity:.6;margin-bottom:4px">VALOR DA PROPOSTA</div>');
  w.document.write('<div class="v">'+brl(lastRev?lastRev.valorFaturamento:card.valorFaturamento||card.valor)+'</div>');
  w.document.write('<div style="font-size:11px;opacity:.5;margin-top:4px">'+(lastRev?lastRev.label:'')+'</div></div>');
  // Revisões
  if(card.revisoes&&card.revisoes.length>0){
    w.document.write('<div class="card"><div class="card-t">Histórico de Versões</div>');
    card.revisoes.forEach(function(rv){
      w.document.write('<div class="row"><span class="lbl">'+(rv.label||'—')+'</span><span class="val">'+brl(rv.valorFaturamento)+'</span></div>');
    });
    w.document.write('</div>');
  }
  // PDF pages (thumbnail ou local)
  if(lastRev&&(lastRev.pdfThumb||lastRev.pdfPages)){
    w.document.write('<div class="card"><div class="card-t">Proposta Visual</div>');
    if(lastRev.pdfPages){
      lastRev.pdfPages.forEach(function(pg,i){
        w.document.write('<img src="'+pg+'" alt="Página '+(i+1)+'">');
      });
    } else if(lastRev.pdfThumb){
      w.document.write('<img src="'+lastRev.pdfThumb+'" alt="Thumbnail proposta">');
      w.document.write('<p style="color:#888;font-size:10px">Imagem reduzida — versão completa na nuvem</p>');
    }
    w.document.write('</div>');
  }
  w.document.write('<div class="foot">Gerado em '+new Date().toLocaleString('pt-BR')+'<br>Projetta Portas Exclusivas — projetta.com.br</div>');
  w.document.write('</div></div></body></html>');
  w.document.close();
}

/* ── Escolher qual revisão exibe no Pipeline ── */
window.crmSetPipelineRev=function(cardId,revIdx){
  var ri=parseInt(revIdx)||0;
  var data=cLoad();
  var idx=data.findIndex(function(o){return o.id===cardId;});
  if(idx<0)return;
  var opp=data[idx];
  if(!opp.revisoes||!opp.revisoes[ri])return;
  var rv=opp.revisoes[ri];
  opp.revPipeline=ri;
  opp.valor=rv.valorFaturamento||rv.valorTabela||0;
  opp.valorTabela=rv.valorTabela||0;
  opp.valorFaturamento=rv.valorFaturamento||0;
  opp.updatedAt=new Date().toISOString();
  cSave(data);
  if(typeof crmRender==='function') crmRender();
  var revDisplay=ri===0?(rv.label||'Original'):(rv.label||'Revisão '+ri);
  var toast=document.createElement('div');toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#003144;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2)';toast.textContent='📊 Pipeline usando valores de: '+revDisplay+' — Fat: '+brl(rv.valorFaturamento||0);document.body.appendChild(toast);setTimeout(function(){toast.remove();},3000);
};

window.crmDeleteRevision=function(cardId,revIndex){
  if(!confirm('Excluir esta revisão?'))return;
  var data=cLoad();
  var idx=data.findIndex(function(o){return o.id===cardId;});
  if(idx<0)return;
  if(!data[idx].revisoes)return;
  data[idx].revisoes.splice(revIndex,1);
  if(data[idx].revisoes.length>0){
    var last=data[idx].revisoes[data[idx].revisoes.length-1];
    if(last){
      data[idx].valor=last.valorFaturamento||last.valorTabela||data[idx].valor;
      data[idx].valorTabela=last.valorTabela||data[idx].valorTabela;
      data[idx].valorFaturamento=last.valorFaturamento||data[idx].valorFaturamento;
    }
  } else {
    data[idx].valor=0;data[idx].valorTabela=0;data[idx].valorFaturamento=0;
  }
  data[idx].updatedAt=new Date().toISOString();
  cSave(data);
  crmOpenModal(null, cardId);
};

/* ═════════════════════════════════════════════════════════════════════
   OPÇÕES MÚLTIPLAS POR CARD (v1.0)
   API window.crmTrocarOpcao / crmNovaOpcao / crmRenomearOpcao / crmRemoverOpcao.
   Depende de window.OrcamentoOpcoes (js/31-opcoes.js).
   ═════════════════════════════════════════════════════════════════════ */
window.crmTrocarOpcao=function(cardId, opcaoId){
  if(!window.OrcamentoOpcoes) return;

  // ★ CRÍTICO (Felipe 20/04): antes de trocar, PERSISTIR o estado atual
  //   do form (itens editados mas não salvos) na opção CURRENT — senão
  //   edições somem ou vazam pra opção destino. O crmSaveOpp salva TUDO
  //   do modal (incluindo itens via _crmItensToCardData) e roda cSave,
  //   que chama OrcamentoOpcoes.persistir automaticamente.
  try {
    if(typeof crmSaveOpp === 'function' && _editId === cardId){
      crmSaveOpp();
    }
  } catch(e){ console.warn('[crmTrocarOpcao] save-before-switch falhou:', e); }

  var data=cLoad();
  var idx=data.findIndex(function(o){return o.id===cardId;});
  if(idx<0) return;
  window.OrcamentoOpcoes.trocar(data[idx], opcaoId);
  data[idx].updatedAt=new Date().toISOString();
  // Reset do pipeline rev (última da opção nova)
  if(data[idx].revisoes && data[idx].revisoes.length){
    var last = data[idx].revisoes[data[idx].revisoes.length-1];
    data[idx].valor           = last.valorFaturamento || last.valorTabela || 0;
    data[idx].valorTabela     = last.valorTabela || 0;
    data[idx].valorFaturamento= last.valorFaturamento || 0;
    data[idx].revPipeline     = data[idx].revisoes.length-1;
  }
  cSave(data);
  crmOpenModal(null, cardId);
};

window.crmNovaOpcao=function(cardId){
  if(!window.OrcamentoOpcoes){ alert('Sistema de opções não carregado.'); return; }
  var label = prompt('Nome da nova opção (ex.: "Modelo 23 Bronze"):', '');
  if(label === null) return; // cancelou
  label = (label||'').trim();

  var data=cLoad();
  var idx=data.findIndex(function(o){return o.id===cardId;});
  if(idx<0) return;

  // Captura params financeiros da opção origem ANTES de criar a nova
  // (prioridade: opcao.paramsFin → últimaRev.paramsFin → DB legado)
  var origemOpcao = window.OrcamentoOpcoes.ativa(data[idx]);
  var ultimaRevOrigem = origemOpcao && origemOpcao.revisoes && origemOpcao.revisoes.length
                        ? origemOpcao.revisoes[origemOpcao.revisoes.length-1]
                        : null;
  var paramsFinOrigem = null;
  if(origemOpcao && origemOpcao.paramsFinanceiros){
    paramsFinOrigem = Object.assign({}, origemOpcao.paramsFinanceiros);
  } else if(ultimaRevOrigem && ultimaRevOrigem.paramsFinanceiros){
    paramsFinOrigem = Object.assign({}, ultimaRevOrigem.paramsFinanceiros);
  } else {
    paramsFinOrigem = _coletarParamsFinanceiros(cardId);
  }

  // ★ Cria nova opção SEM revisões (editável desde o início).
  //   Itens são deep-clonados da origem como template.
  var nova = window.OrcamentoOpcoes.novaOpcao(data[idx], label);
  if(!nova){ alert('Falha ao criar opção.'); return; }

  // Copia params financeiros (serão usados quando Felipe clicar Fazer
  // Orçamento nessa nova opção)
  if(paramsFinOrigem){
    nova.paramsFinanceiros = paramsFinOrigem;
  }

  cSave(data);

  // Toast explicativo
  var tst = document.createElement('div');
  tst.style.cssText='position:fixed;top:20px;right:20px;background:#27ae60;color:#fff;padding:12px 18px;border-radius:12px;font-size:12px;font-weight:600;z-index:9998;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:340px';
  tst.innerHTML='✅ <b>'+escH(nova.label)+'</b> criada<br><span style="font-weight:400;font-size:11px">Itens e parâmetros herdados da opção anterior. Edite à vontade.</span>';
  document.body.appendChild(tst);
  setTimeout(function(){ tst.remove(); }, 4000);

  crmOpenModal(null, cardId);
};

window.crmRenomearOpcao=function(cardId, opcaoId){
  if(!window.OrcamentoOpcoes) return;
  var data=cLoad();
  var idx=data.findIndex(function(o){return o.id===cardId;});
  if(idx<0) return;
  var opc = (data[idx].opcoes||[]).find(function(o){return o.id===opcaoId;});
  if(!opc) return;
  var novo = prompt('Novo nome da opção:', opc.label || '');
  if(novo === null) return;
  novo = (novo||'').trim();
  if(!novo) return;
  opc.label = novo;
  data[idx].updatedAt = new Date().toISOString();
  cSave(data);
  crmOpenModal(null, cardId);
};

window.crmRemoverOpcao=function(cardId, opcaoId){
  if(!window.OrcamentoOpcoes) return;
  var data=cLoad();
  var idx=data.findIndex(function(o){return o.id===cardId;});
  if(idx<0) return;
  if(!data[idx].opcoes || data[idx].opcoes.length <= 1){
    alert('Não é possível remover a única opção do card.');
    return;
  }
  var opc = data[idx].opcoes.find(function(o){return o.id===opcaoId;});
  if(!opc) return;
  var nRevs = (opc.revisoes||[]).length;
  var msg = 'Remover "'+(opc.label||opcaoId)+'"'+(nRevs?' ('+nRevs+' revisão/revisões)':'')+'?\n\n'+
            'Os freezes no Supabase/localStorage NÃO serão apagados (segurança) — ' +
            'só a referência do card é removida.';
  if(!confirm(msg)) return;
  window.OrcamentoOpcoes.removerOpcao(data[idx], opcaoId);
  data[idx].updatedAt = new Date().toISOString();
  cSave(data);
  crmOpenModal(null, cardId);
};

/* ═════════════════════════════════════════════════════════════════════
   "Fazer Orçamento" da OPÇÃO ativa.

   SEMPRE carrega dados do CARD (ITENS DO PEDIDO, medidas, modelo do
   topo do modal), não do freeze duplicado. Motivação (Felipe 20/04):
   ao criar Opção 2 via duplicação e depois editar o item do card
   pra Modelo 01 Cava, o "Fazer Orçamento" precisa respeitar o item
   ATUALIZADO do card — não o modelo antigo congelado no freeze.

   MAS preserva os PARÂMETROS FINANCEIROS (overhead, impostos, comissões,
   lucro, markup, desconto) do último orçamento salvo. Felipe 20/04:
   "ao fazer Opção 1 deve trazer mesmo parâmetros financeiros".
   Fonte: projetta_v3 (DB legado) — sempre atualizado em cada
   "Orçamento Pronto" via salvarRapido().

   Quem quiser CONTINUAR de uma revisão congelada específica da opção
   usa o duplo-clique na linha da revisão + "Nova Revisão" dentro.

   Ao clicar "Orçamento Pronto" no final, o OrcamentoFreeze descobre
   a opção ativa via _opcaoAtivaDoCard() e salva a rev no lugar certo.
   ═════════════════════════════════════════════════════════════════════ */

// Campos financeiros a preservar entre Fazer Orçamento.
// Ficam no painel "Parâmetros Financeiros" do orçamento.
var _FIN_PARAM_IDS = ['overhead','impostos','com-rep','com-rt','com-gest','lucro-alvo','desconto','markup-desc'];

function _coletarParamsFinanceiros(cardId){
  // ★ Ordem de prioridade (Felipe 20/04):
  //   1) opcao ATIVA.paramsFinanceiros    (setada por crmNovaOpcao ou Orçamento Pronto)
  //   2) última rev da opção ATIVA.paramsFinanceiros
  //   3) rev.data (snapshot de form) de qualquer rev com paramsFin
  //   4) entry legado projetta_v3 ligado ao card
  //   5) null → defaults do form
  try {
    var cdata = (typeof cLoad === 'function') ? cLoad() : [];
    var card = cdata.find(function(o){return o.id===cardId;});

    // 1) Opção ativa
    if(card && window.OrcamentoOpcoes){
      var opAtiva = window.OrcamentoOpcoes.ativa(card);
      if(opAtiva && opAtiva.paramsFinanceiros){
        return Object.assign({}, opAtiva.paramsFinanceiros);
      }
      // 2) Última rev da opção ativa - paramsFinanceiros explícito
      if(opAtiva && Array.isArray(opAtiva.revisoes) && opAtiva.revisoes.length){
        // Procurar DE TRÁS PRA FRENTE por qualquer rev que tenha paramsFin
        for(var i=opAtiva.revisoes.length-1; i>=0; i--){
          var r = opAtiva.revisoes[i];
          if(r && r.paramsFinanceiros){
            return Object.assign({}, r.paramsFinanceiros);
          }
        }
      }
    }

    // 3) rev.data (snapshot de form) em qualquer revisão do entry legado
    //    vinculado ao card. Útil pra cards legados que não tem paramsFinanceiros.
    if(typeof loadDB !== 'function') return null;
    var db = loadDB();
    var entry = db.find(function(e){ return e.crmCardId === cardId; });
    if(!entry){
      if(card && card.cliente){
        var nome = card.cliente.toUpperCase().trim();
        var matches = db.filter(function(e){ return e.client && e.client.toUpperCase().trim()===nome; });
        if(matches.length===1) entry = matches[0];
      }
    }
    if(!entry || !Array.isArray(entry.revisions) || !entry.revisions.length) return null;

    // Procurar DE TRÁS PRA FRENTE pela rev mais recente que tenha data com
    // pelo menos algum param não-default (lucro-alvo != 20 ou desconto != 20)
    for(var k=entry.revisions.length-1; k>=0; k--){
      var rev = entry.revisions[k];
      var data = (rev && rev.data) || null;
      if(!data) continue;
      var out = {};
      var found = false;
      _FIN_PARAM_IDS.forEach(function(id){
        if(data[id] !== undefined && data[id] !== ''){
          out[id] = data[id];
          found = true;
        }
      });
      if(found) return out;
    }

    return null;
  } catch(e){
    console.warn('[_coletarParamsFinanceiros] falhou:', e);
    return null;
  }
}

// Helper: captura params do form atual (tela do orçamento)
function _snapshotParamsDoForm(){
  var out = {};
  var qualquer = false;
  _FIN_PARAM_IDS.forEach(function(id){
    var el = document.getElementById(id);
    if(el && el.value !== undefined && el.value !== ''){
      out[id] = el.value;
      qualquer = true;
    }
  });
  return qualquer ? out : null;
}

function _aplicarParamsFinanceiros(params){
  if(!params) return;
  Object.keys(params).forEach(function(id){
    var el = document.getElementById(id);
    if(el && params[id] !== undefined && params[id] !== ''){
      el.value = params[id];
      // Marcar markup-desc como manual pra auto-calc não sobrescrever
      if(id === 'markup-desc') el.dataset.manual = '1';
      // Disparar eventos pra calc() reagir
      try {
        ['input','change'].forEach(function(evt){
          el.dispatchEvent(new Event(evt,{bubbles:true}));
        });
      } catch(e){}
    }
  });
  // Recalcular se custo já foi gerado
  if(typeof calc === 'function'){
    try { calc(); } catch(e){}
  }
}

// Mantida como alias por compatibilidade com HTML cacheado.
// Internamente só chama crmFazerOrcamento + restaura params financeiros
// da última revisão do card (feature que funciona bem e vale preservar).
window.crmFazerOrcamentoOpcao=function(cardId){
  if(!cardId){ alert('Card inválido'); return; }
  if(typeof crmFazerOrcamento !== 'function'){
    alert('Função crmFazerOrcamento não carregada');
    return;
  }

  // Coletar parâmetros financeiros ANTES do reset
  var pendingParams = _coletarParamsFinanceiros(cardId);

  crmFazerOrcamento(cardId);

  // Re-aplicar params APÓS setTimeout interno do crmFazerOrcamento (~500ms)
  if(pendingParams){
    setTimeout(function(){
      _aplicarParamsFinanceiros(pendingParams);
      console.log('[crmFazerOrcamento] params financeiros da rev anterior restaurados');

      // ★ Felipe 20/04: se a obra e INTERNACIONAL, os defaults intl
      //   tem prioridade sobre params salvos. Re-dispara toggleInstQuem
      //   apos restaurar params pra garantir que imp=0, rep=1, gest=0,
      //   lucro=45 etc sejam aplicados. Reseta a flag primeiro pra
      //   permitir a reaplicacao (senao pula por ja ter aplicado antes).
      setTimeout(function(){
        var _iq = (document.getElementById('inst-quem')||{value:''}).value;
        if(_iq === 'INTERNACIONAL'){
          window._intlDefaultsAplicado = false;
          if(typeof toggleInstQuem === 'function') try { toggleInstQuem(); } catch(e){}
          console.log('[crmFazerOrcamento] defaults intl reaplicados apos restauracao de params');
        }
      }, 100);
    }, 800);
  }
};

/* ── Abrir Revisão do CRM: carrega orçamento + mostra Memorial ── */
window.crmAbrirRevisao=function(cardId, revIdx){
  // ═══ OrcamentoFreeze v1.0 — PRIORIDADE ABSOLUTA ═══
  // Se a revisão tem freezeKey, abre o orçamento inteiro (todas as abas
  // populadas com valores da revisão) em modo somente-leitura com banner.
  // Felipe (20/04/2026): "abrir ele em todas as abas com seus valores".
  try {
    var _crmDataFz = cLoad();
    var _cardFz = _crmDataFz.find(function(o){return o.id===cardId;});
    if(_cardFz && _cardFz.revisoes && _cardFz.revisoes[revIdx||0]){
      var _rFz = _cardFz.revisoes[revIdx||0];
      if(_rFz.freezeKey && window.OrcamentoFreeze && typeof window.OrcamentoFreeze.abrir === 'function'){
        var _modalFz = document.getElementById('crm-modal');
        if(_modalFz) _modalFz.style.display='none';
        window.OrcamentoFreeze.abrir(cardId, revIdx||0)
          .catch(function(err){
            console.error('[Freeze] abrir falhou:', err);
            alert('Erro ao abrir revisão: '+(err.message||err));
          });
        return;
      }
    }
  } catch(e){ console.warn('[Freeze] erro:', e); }

  // Fallback: sistemas antigos (MemorialCem PNG, MemorialV2, legacy)
  // SÓ para revisões CRIADAS antes do Freeze v1.0
  _crmAbrirRevisaoFallback(cardId, revIdx);
};

function _crmAbrirRevisaoFallback(cardId, revIdx){
  // ─── MemorialCem (PNG) ───
  try {
    var _crmDataCem = cLoad();
    var _cardCem = _crmDataCem.find(function(o){return o.id===cardId;});
    if(_cardCem && _cardCem.revisoes && _cardCem.revisoes[revIdx||0]){
      var _rCem = _cardCem.revisoes[revIdx||0];
      if(_rCem.memorialCemKey && window.MemorialCem && typeof window.MemorialCem.abrir === 'function'){
        window.MemorialCem.abrir(cardId, revIdx||0)
          .catch(function(err){
            console.warn('[MemorialCem] falha, tentando V2/legacy:', err);
            _crmAbrirRevisaoV2OuLegacy(cardId, revIdx);
          });
        return;
      }
    }
  } catch(e){ console.warn('[MemorialCem] erro:', e); }
  _crmAbrirRevisaoV2OuLegacy(cardId, revIdx);
}

function _crmAbrirRevisaoV2OuLegacy(cardId, revIdx){
  // ─── Memorial V2: tenta abrir via Supabase primeiro ───
  // Se a revisão tem memorialV2Id, puxa tudo do banco e restaura sem recalcular.
  try {
    var _crmDataV2 = cLoad();
    var _cardV2 = _crmDataV2.find(function(o){return o.id===cardId;});
    if(_cardV2 && _cardV2.revisoes && _cardV2.revisoes[revIdx||0]){
      var _rV2 = _cardV2.revisoes[revIdx||0];
      if(_rV2.memorialV2Id && window.MemorialV2 && typeof window.MemorialV2.abrir === 'function'){
        var _modalV2 = document.getElementById('crm-modal'); if(_modalV2) _modalV2.style.display='none';
        window.MemorialV2.abrir(_rV2.memorialV2Id, { readOnly: true })
          .then(function(row){ console.log('[MemorialV2] aberta revisão:', row.rev_label); })
          .catch(function(err){
            console.warn('[MemorialV2] falha ao abrir, caindo no memorial antigo:', err);
            _crmAbrirRevisaoLegacy(cardId, revIdx);
          });
        return;
      }
    }
  } catch(e){ console.warn('[MemorialV2] erro ao tentar abrir V2:', e); }

  // Fallback: memorial antigo (revisões criadas antes do V2)
  _crmAbrirRevisaoLegacy(cardId, revIdx);
}

function _crmAbrirRevisaoLegacy(cardId, revIdx){
  var db=loadDB();
  var crmData=cLoad();var card=crmData.find(function(o){return o.id===cardId;});

  // 1) Busca match EXATO por crmCardId (único 100% confiável)
  var entry=db.find(function(e){return e.crmCardId===cardId;});

  // 2) Fallback por nome — SÓ se match ÚNICO (Fix C: evita linkar errado em duplicatas)
  if(!entry && card && card.cliente){
    var nome=card.cliente.toUpperCase().trim();
    var matches=db.filter(function(e){return e.client && e.client.toUpperCase().trim()===nome;});
    if(matches.length===1){
      entry=matches[0];
      console.log('[CRM] link por nome (único match):', card.cliente);
    } else if(matches.length>1){
      console.warn('[CRM] nome duplicado — '+matches.length+' matches — NÃO vinculando automaticamente');
    }
  }

  // 3) Fallback por reserva — SÓ se match ÚNICO
  if(!entry && card && card.reserva){
    var matches2=db.filter(function(e){return e.project && e.project===card.reserva;});
    if(matches2.length===1){
      entry=matches2[0];
      console.log('[CRM] link por reserva (único match):', card.reserva);
    } else if(matches2.length>1){
      console.warn('[CRM] reserva duplicada — NÃO vinculando automaticamente');
    }
  }

  // 4) Link crmCardId se faltava (one-shot — só uma vez por card+entry)
  if(entry && !entry.crmCardId){ entry.crmCardId=cardId; saveDB(db); }

  // ★ 5) FALLBACK ESPERTO (Felipe 21/04): se a revisao tem paramsFinanceiros
  //    mas nao tem snapshot nem freezeKey nem memorialV2Id, reconstruir o
  //    orcamento via crmFazerOrcamento + aplicar params da rev especifica.
  //    Isso evita cair no painel simplificado que so mostra valores.
  //    Funciona bem pra 'Original' que foi criada antes do sistema V2.
  var _ri0 = Math.min(revIdx||0, (card.revisoes||[]).length-1);
  var _revAlvo = (card.revisoes||[])[_ri0];
  var _entryHasSnap = false;
  if(entry && entry.revisions && entry.revisions[_ri0]){
    var _r = entry.revisions[_ri0];
    _entryHasSnap = !!(_r.snapshot);
  }
  if(!_entryHasSnap && _revAlvo && _revAlvo.paramsFinanceiros){
    console.log('[Revisao] sem snapshot — reconstruindo via crmFazerOrcamento + paramsFinanceiros da rev', _ri0);
    var _modalCrm = document.getElementById('crm-modal'); if(_modalCrm) _modalCrm.style.display='none';
    // Carregar orcamento do card (dados atuais = estrutura)
    try {
      if(typeof crmFazerOrcamento === 'function') crmFazerOrcamento(cardId);
    } catch(e){ console.warn('[Revisao] crmFazerOrcamento falhou:', e); }
    // Aplicar params financeiros DA REVISAO especifica (nao da ultima)
    setTimeout(function(){
      try {
        if(typeof _aplicarParamsFinanceiros === 'function'){
          _aplicarParamsFinanceiros(_revAlvo.paramsFinanceiros);
        }
      } catch(e){ console.warn('[Revisao] _aplicarParamsFinanceiros falhou:', e); }
      // Mostrar banner indicando modo leitura
      _mostrarBannerRevisao(card, _ri0, _revAlvo);
      // Recalcular e re-rodar planificador pra tudo aparecer
      setTimeout(function(){
        try { if(typeof calc==='function') calc(); } catch(e){}
        try {
          if(typeof window._autoSelectAndRun==='function') window._autoSelectAndRun();
        } catch(e){}
      }, 300);
    }, 900);
    return;
  }

  // 5.5) Sem paramsFinanceiros na rev — caminho antigo (painel simplificado)
  if(!entry){
    if(card && card.revisoes && card.revisoes.length>0){
      var modal=document.getElementById('crm-modal'); if(modal) modal.style.display='none';
      _showMemorialSimplified(card, revIdx||0);
      return;
    }
    alert('Orçamento não encontrado. Clique em "Fazer Orçamento" e depois "Orçamento Pronto para Envio" primeiro.');
    return;
  }

  // 6) Entry achado mas sem snapshot válido na revisão → também usar memorial simplificado
  //    (evita recalcular com valores do último orçamento aberto)
  var ri=Math.min(revIdx||0, entry.revisions.length-1);
  var rev=entry.revisions[ri];
  var snapOk = rev && rev.snapshot && typeof _isSnapshotValid==='function' ? _isSnapshotValid(rev.snapshot) : !!(rev && rev.snapshot);
  if(!snapOk){
    if(card && card.revisoes && card.revisoes.length>0){
      var modal2=document.getElementById('crm-modal'); if(modal2) modal2.style.display='none';
      _showMemorialSimplified(card, ri);
      return;
    }
  }

  // 7) Entry + snapshot válido → fluxo original (memorial completo com custos detalhados)
  var modal3=document.getElementById('crm-modal'); if(modal3) modal3.style.display='none';
  if(typeof loadRevisionMemorial==='function'){
    loadRevisionMemorial(entry.id, ri);
  } else {
    loadRevision(entry.id, ri);
    switchTab('orcamento');
  }
}

/* ★ Banner fixo mostrando qual revisao esta sendo visualizada */
function _mostrarBannerRevisao(card, ri, rev){
  var prev = document.getElementById('rev-view-banner');
  if(prev) prev.remove();
  var banner = document.createElement('div');
  banner.id = 'rev-view-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(90deg,#e67e22,#9b59b6);color:#fff;padding:10px 16px;z-index:9998;font-weight:700;font-size:13px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.15)';
  var dLabel = rev && rev.data ? new Date(rev.data).toLocaleString('pt-BR') : '—';
  banner.innerHTML = '📋 Visualizando <b>'+(rev.label||'Revisão '+ri)+'</b> — '+(card.cliente||'')+' · '+dLabel+
    ' · <a href="#" onclick="(function(){var b=document.getElementById(\'rev-view-banner\');if(b)b.remove();document.body.style.paddingTop=\'\';})();return false;" style="color:#fff;text-decoration:underline">Fechar</a>';
  document.body.appendChild(banner);
  document.body.style.paddingTop = '42px';
}

/* ── Memorial simplificado para cards órfãos (sem snapshot no DB) ──
   Mostra um painel lateral somente-leitura com valores básicos do card.
   Não toca no form global (bug conhecido), não recalcula, não cria entry falso. */
function _showMemorialSimplified(card, revIdx){
  var revs=card.revisoes||[];
  var ri=Math.min(revIdx||0, revs.length-1);
  var rev=revs[ri]||{};

  var mem=document.getElementById('memorial-panel');
  if(!mem){
    mem=document.createElement('div'); mem.id='memorial-panel';
    mem.style.cssText='position:fixed;top:0;right:0;width:420px;height:100vh;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,0.15);z-index:9998;overflow-y:auto;font-family:inherit;transition:transform 0.3s';
    document.body.appendChild(mem);
  }
  mem.style.display='';

  var _brl=function(v){return 'R$ '+_fmtBRLCeil(v);};
  var dLabel=rev.data?new Date(rev.data).toLocaleString('pt-BR'):'—';

  var html='';
  html+='<div style="padding:16px;border-bottom:2px solid #e67e22;background:linear-gradient(135deg,#fef9f0,#fff)">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center"><div>';
  html+='<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#e67e22;font-weight:700">Memorial Simplificado</div>';
  html+='<div style="font-size:16px;font-weight:700;color:#1a3c5e">'+(card.cliente||'—')+'</div>';
  html+='<div style="font-size:11px;color:#888">'+(rev.label||'Revisão')+' · '+dLabel+'</div>';
  html+='</div><button onclick="document.getElementById(\'memorial-panel\').style.display=\'none\'" style="border:none;background:none;font-size:20px;cursor:pointer;color:#999">✕</button></div></div>';

  // Aviso de memorial incompleto
  html+='<div style="margin:14px 16px;padding:12px;background:#fff8e1;border-left:3px solid #f39c12;border-radius:6px;font-size:11px;color:#7a5a00;line-height:1.5">';
  html+='<b>⚠ Memorial detalhado indisponível</b><br>';
  html+='Este orçamento foi criado em outra sessão ou dispositivo, e os dados completos de custos, DRE e acessórios não estão disponíveis no seu histórico local. ';
  html+='Para gerar um memorial completo, clique em <b>+ Nova Revisão</b> no card.';
  html+='</div>';

  // Dados básicos do card
  html+='<div style="padding:10px 16px;border-bottom:1px solid #eee">';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px">📐 Dados do Card</div>';
  html+='<table style="width:100%;font-size:12px;border-collapse:collapse">';
  var _r=function(l,v){return '<tr><td style="padding:3px 0;color:#888;width:45%">'+l+'</td><td style="padding:3px 0;font-weight:600">'+(v||'—')+'</td></tr>';};
  html+=_r('Cliente',card.cliente);
  html+=_r('Produto',card.produto);
  if(card.largura&&card.altura) html+=_r('Dimensões',card.largura+'×'+card.altura+' mm');
  if(card.modelo) html+=_r('Modelo',card.modelo);
  if(card.abertura) html+=_r('Abertura',card.abertura);
  if(card.folhas) html+=_r('Folhas',card.folhas);
  if(card.cor_ext) html+=_r('Cor externa',card.cor_ext);
  if(card.cor_int) html+=_r('Cor interna',card.cor_int);
  if(card.cidade) html+=_r('Cidade',card.cidade+(card.estado?' – '+card.estado:''));
  if(card.reserva) html+=_r('Reserva',card.reserva);
  if(card.agp) html+=_r('AGP',card.agp);
  html+='</table></div>';

  // Valores da revisão
  html+='<div style="padding:14px 16px;border-bottom:1px solid #eee">';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px">💰 Valores (congelados no card)</div>';
  html+='<table style="width:100%;font-size:12px;border-collapse:collapse">';
  html+=_r('Preço Tabela','<span style="color:#1a3c5e;font-weight:700">'+_brl(rev.valorTabela)+'</span>');
  html+=_r('Faturamento','<span style="color:#27ae60;font-weight:700">'+_brl(rev.valorFaturamento)+'</span>');
  html+='</table></div>';

  // Lista de todas as revisões se tiver mais de uma
  if(revs.length>1){
    html+='<div style="padding:14px 16px;border-bottom:1px solid #eee">';
    html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px">📋 Histórico de revisões</div>';
    html+='<table style="width:100%;font-size:11px;border-collapse:collapse">';
    html+='<tr style="color:#888;border-bottom:1px solid #eee"><th style="text-align:left;padding:4px 0">Rev</th><th style="text-align:right">Tabela</th><th style="text-align:right">Fat</th></tr>';
    revs.forEach(function(r,i){
      var _bg=i===ri?'background:#fef9f0;':'';
      html+='<tr style="'+_bg+'border-bottom:0.5px solid #f5f2ee">';
      html+='<td style="padding:4px 0;font-weight:'+(i===ri?'700':'500')+'">'+(r.label||'Rev '+i)+'</td>';
      html+='<td style="text-align:right;padding:4px 0">'+_brl(r.valorTabela)+'</td>';
      html+='<td style="text-align:right;padding:4px 0;color:#27ae60">'+_brl(r.valorFaturamento)+'</td>';
      html+='</tr>';
    });
    html+='</table></div>';
  }

  // Botão Nova Revisão
  html+='<div style="padding:14px 16px">';
  html+='<button onclick="document.getElementById(\'memorial-panel\').style.display=\'none\';crmNovaRevisao(\''+card.id+'\');" style="width:100%;padding:10px;background:#e67e22;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">➕ Nova Revisão (gerar memorial completo)</button>';
  html+='</div>';

  mem.innerHTML=html;
}

/* ── Nova Revisão a partir do CRM ── */
window.crmNovaRevisao=function(cardId){
  var db=loadDB();
  var entry=db.find(function(e){return e.crmCardId===cardId;});
  if(!entry){
    var crmData=cLoad();var card=crmData.find(function(o){return o.id===cardId;});
    // Fallback por nome — SÓ se match único (evita linkar em card duplicado)
    if(card&&card.cliente){
      var nome=card.cliente.toUpperCase().trim();
      var matches=db.filter(function(e){return e.client && e.client.toUpperCase().trim()===nome;});
      if(matches.length===1) entry=matches[0];
      else if(matches.length>1) console.warn('[CRM novaRev] nome duplicado — não vinculando automaticamente');
    }
    // Fallback por reserva — SÓ se match único
    if(!entry&&card&&card.reserva){
      var matches2=db.filter(function(e){return e.project && e.project===card.reserva;});
      if(matches2.length===1) entry=matches2[0];
      else if(matches2.length>1) console.warn('[CRM novaRev] reserva duplicada — não vinculando automaticamente');
    }
    // Auto-link: se card tem revisões mas DB não tem entry, criar link
    //   (aqui é OK criar entry — estamos iniciando uma NOVA revisão editável)
    if(!entry&&card&&card.revisoes&&card.revisoes.length>0){
      var newE={id:'orc_'+Date.now(),crmCardId:cardId,client:card.cliente||'',project:card.reserva||'',
        revisions:card.revisoes.map(function(r,i){return{label:r.label||('Rev '+(i+1)),date:r.date||new Date().toISOString(),valorTabela:r.valorTabela||0,valorFaturamento:r.valorFaturamento||0,snapshot:r.snapshot||null};})};
      db.push(newE);saveDB(db);entry=newE;
    }
    if(entry&&!entry.crmCardId){entry.crmCardId=cardId;saveDB(db);}
  }
  if(!entry){alert('Orçamento não encontrado. Clique em "Fazer Orçamento" e depois "Orçamento Pronto para Envio" primeiro.');return;}
  var modal=document.getElementById('crm-modal');if(modal)modal.style.display='none';
  // Flag: próximo loadRevision NÃO deve travar (será desbloqueado para edição)
  window._forceUnlockAfterLoad=true;
  var lastRev=entry.revisions.length-1;
  loadRevision(entry.id, lastRev);
  switchTab('orcamento');
  // Desbloquear em 3 etapas para garantir
  function _forceUnlock(){
    window._snapshotLock=false;
    window._orcLocked=false;
    window._forceUnlockAfterLoad=false;
    window._custoCalculado=false; // FORÇAR recálculo ao apertar Pronto
    // Desabilitar TODOS inputs forçadamente (bypass wasDisabled)
    var orcTab=document.getElementById('tab-orcamento');
    if(orcTab){
      orcTab.querySelectorAll('input,select,textarea').forEach(function(el){
        el.disabled=false;
        el.style.opacity='';
        el.style.pointerEvents='';
        delete el.dataset.wasDisabled;
      });
    }
    _hideMemorial();
    var lb=document.getElementById('orc-lock-banner');if(lb)lb.style.display='none';
    var gcw=document.getElementById('gerar-custo-wrap');if(gcw)gcw.style.display='';
    var btnPdf=document.getElementById('crm-gerar-pdf-btn');if(btnPdf)btnPdf.style.display='none';
    // Nova revisão
    window._pendingRevision=true;
    var ind=document.getElementById('autosave-ind');
    if(ind){ind.textContent='📝 Editando nova revisão...';ind.style.opacity='1';ind.style.color='#e67e22';}
  }
  setTimeout(function(){
    _forceUnlock();
    if(typeof onModeloChange==='function') try{onModeloChange();}catch(e){}
    if(typeof _checkCorMode==='function') setTimeout(_checkCorMode, 200);
    if(typeof planUpd==='function') try{planUpd();}catch(e){}
    if(typeof calc==='function') try{calc();}catch(e){}

    // Toast Felipe 20/04: deixar claro que params financeiros vieram da rev
    var _rvTst=document.createElement('div');
    _rvTst.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#8e44ad;color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:560px;text-align:center';
    _rvTst.innerHTML='📋 Nova Revisão — <b>parâmetros financeiros preservados</b><br><span style="font-weight:400;font-size:11px">overhead, impostos, comissões, lucro e desconto da revisão anterior. Edite o que precisar.</span>';
    document.body.appendChild(_rvTst);
    setTimeout(function(){_rvTst.remove();}, 5500);
  }, 1000);
  // Segurança: desbloquear de novo em 2s caso algo tenha re-travado
  setTimeout(_forceUnlock, 2000);
};

/* ── Sync _orcItens → _mpItens para planificador multi-porta ── */
window._syncOrcToMpItens=function(){
  if(!window._orcItens||window._orcItens.length<=1) return;

  // ★ Fixos sao itens independentes em _orcItens com tipo='fixo'.
  //   Coletar todos os fixos e anexar em cada porta do _mpItens, pra
  //   que a proposta mostre 'Porta: LxA / Fixo: LxA'. Felipe 20/04:
  //   "sempre que tiver fixo deve aparecer tbm medidas do fixo em
  //   dimensions".
  var _fixosDoCard = window._orcItens.filter(function(it){
    return it.tipo === 'fixo' &&
           parseFloat(it.largura)>0 &&
           parseFloat(it.altura)>0;
  }).map(function(fx){
    return {
      larg: parseFloat(fx.largura)||0,
      alt:  parseFloat(fx.altura)||0,
      qty:  parseInt(fx.qtd)||1,
      tipo_fixacao: fx.tipo_fixacao || 'BANDEIRA',
      revestimento_lados: fx.revestimento_lados || '2',
      tem_estrutura: fx.tem_estrutura || 'SIM',
      tipo_material: fx.tipo_material || 'ACM',
      cor_ext: fx.cor_ext || '',
      cor_int: fx.cor_int || ''
    };
  });

  window._mpItens=[];
  window._orcItens.forEach(function(oi,idx){
    // ★ Felipe 23/04: antes o código pulava tudo que não fosse porta_pivotante.
    //   Com isso, revestimentos NUNCA apareciam no _mpItens e a proposta caía
    //   no fallback de single-door mostrando campos irrelevantes de porta
    //   (SISTEMA, ABERTURA, FECHADURA, etc). Agora aceita revestimento também
    //   e _populatePropostaItens distingue por mp._tipo pra renderizar os
    //   campos certos (tipo RIPADO/LISO, cor ACM, estrutura — sem fechadura
    //   nem modelo).
    if(oi.tipo==='fixo') return; // fixo é anexado em outra porta
    if(oi.tipo!=='porta_pivotante' && oi.tipo!=='revestimento') return;
    var mp={id:'mp_crm_'+idx};
    mp['largura']=String(oi.largura||'');mp['altura']=String(oi.altura||'');
    mp['qtd-portas']=String(oi.qtd||'1');mp['folhas-porta']=String(oi.folhas||'1');
    mp['carac-modelo']=oi.modelo||'01';mp['carac-abertura']=oi.abertura||'PIVOTANTE';
    mp['carac-cor-ext']=oi.cor_ext||'';mp['carac-cor-int']=oi.cor_int||'';mp['carac-cor-macico']=oi.cor_macico||'';
    mp['carac-fech-mec']=oi.fech_mec||'';mp['carac-fech-dig']=oi.fech_dig||'';
    mp['carac-cilindro']=oi.cilindro||'';mp['carac-puxador']=oi.puxador||'';
    // ★ Felipe 21/04: pux_tam NAO pode ter fallback '1.5'. Se o usuario
    //   escolheu 'CLIENTE' (Envio pelo Cliente) ou deixou vazio, deve
    //   permanecer assim — o acessorio de puxador so deve entrar se tem
    //   tamanho concreto (1.0, 1.5, 1.8, 2.0, 2.5, 3.0...). O fallback
    //   anterior '||1.5' estava adicionando puxador 1,5m indevidamente
    //   em modelos 23 (Molduras) cujo padrao e CLIENTE.
    mp['carac-pux-tam']=oi.pux_tam||'';
    mp['carac-dist-borda-cava']=oi.dist_borda_cava||'210';mp['carac-largura-cava']=oi.largura_cava||'150';
    mp['carac-dist-borda-friso']=oi.dist_borda_friso||'';mp['carac-largura-friso']=oi.largura_friso||'';
    mp['carac-friso-vert']=oi.friso_vert||'0';mp['carac-friso-horiz']=oi.friso_horiz||'0';
    mp['plan-friso-v-qty']=oi.friso_v_qty||'1';
    mp['carac-tem-alisar']=oi.tem_alisar?'1':'0';
    mp['carac-ripado-total']=oi.ripado_total||'NAO';mp['carac-ripado-2lados']=oi.ripado_2lados||'SIM';
    mp['plan-refilado']=oi.refilado||'20';
    // ★ Fixos anexados na PRIMEIRA porta somente, pra evitar contar
    //   duplicado no grand total da proposta. Visualmente aparece como
    //   "Porta: L×A / Fixo: L×A" na coluna Dimensions dessa primeira porta.
    //   Portas subsequentes mostram apenas suas proprias medidas.
    var _ehPrimeiraPorta = window._mpItens.length === 0 && oi.tipo==='porta_pivotante';
    mp['tem-fixo']= _ehPrimeiraPorta && _fixosDoCard.length>0;
    mp._fixos    = _ehPrimeiraPorta ? _fixosDoCard : [];
    // Modelo 23 moldura config
    mp['plan-moldura-rev']=oi.moldura_rev||'ACM';
    mp['plan-moldura-tipo']=oi.moldura_tipo||'1';
    mp['plan-moldura-dis1']=oi.moldura_dis1||'150';
    mp['plan-moldura-dis2']=oi.moldura_dis2||'150';
    mp['plan-moldura-dis3']=oi.moldura_dis3||'150';
    mp['plan-moldura-larg-qty']=oi.moldura_larg_qty||'2';
    mp['plan-moldura-alt-qty']=oi.moldura_alt_qty||'2';
    mp['plan-moldura-divisao']=oi.moldura_divisao||'classica';
    mp._modelo=oi.modelo||'01';mp._tipo=oi.tipo||'porta_pivotante';
    // ★ Campos específicos de revestimento (usados por _populatePropostaItens)
    mp._rev_tipo      = oi.rev_tipo || '';      // 'RIPADO' ou ''
    mp._rev_estrutura = oi.rev_estrutura || ''; // 'SIM'/'NAO'
    mp._rev_tubo      = oi.rev_tubo || '';      // ex: 'PA-51X12X1.58'
    var modOpt=document.querySelector('#carac-modelo option[value="'+oi.modelo+'"]');
    mp._modeloTxt=modOpt?modOpt.textContent:(oi.modelo||'');
    mp._largura=parseFloat(oi.largura)||0;mp._altura=parseFloat(oi.altura)||0;
    mp._qtd=parseInt(oi.qtd)||1;mp._folhas=parseInt(oi.folhas)||1;
    window._mpItens.push(mp);
  });
  window._mpEditingIdx=-1;
  if(typeof _mpRender==='function') _mpRender();
  var mpSec=document.getElementById('multi-porta-section');if(mpSec) mpSec.style.display='';
  // Sync form com primeiro item
  var _first=window._mpItens[0];
  if(_first){
    document.getElementById('largura').value=_first._largura||'';
    document.getElementById('altura').value=_first._altura||'';
    if(document.getElementById('carac-modelo'))document.getElementById('carac-modelo').value=_first['carac-modelo']||'01';
    if(document.getElementById('folhas-porta'))document.getElementById('folhas-porta').value=_first['folhas-porta']||'1';
    if(document.getElementById('plan-refilado'))document.getElementById('plan-refilado').value=_first['plan-refilado']||'20';
    if(document.getElementById('carac-cor-ext')&&_first['carac-cor-ext'])document.getElementById('carac-cor-ext').value=_first['carac-cor-ext'];
    if(document.getElementById('carac-cor-int')&&_first['carac-cor-int'])document.getElementById('carac-cor-int').value=_first['carac-cor-int'];
    if(document.getElementById('plan-modelo'))document.getElementById('plan-modelo').value=_first['carac-modelo']||'01';
    if(document.getElementById('plan-folhas'))document.getElementById('plan-folhas').value=_first['folhas-porta']||'1';
    if(document.getElementById('plan-disborcava'))document.getElementById('plan-disborcava').value=_first['carac-dist-borda-cava']||'210';
    if(document.getElementById('plan-largcava'))document.getElementById('plan-largcava').value=_first['carac-largura-cava']||'150';
    if(typeof onModeloChange==='function')try{onModeloChange();}catch(e){}
  }
  // Auto-run planificador
  setTimeout(function(){
    if(typeof planUpd==='function') try{planUpd();}catch(e){}
    if(typeof _autoSelectAndRun==='function') try{_autoSelectAndRun();}catch(e){}
  },400);
};

window.crmOrcamentoPronto=function(){
  try{
  var id=window._crmOrcCardId;
  var revLabel='Original';
  var isFirst=true;  // ← declarado no escopo externo para usar em _salvarSnapshotECRM
  var _origStage=null; // ★ stage anterior — usado pra ROLLBACK se save sair zerado

  // Se tem card CRM vinculado: mover card para Orçamento Pronto (sem salvar valores ainda)
  if(id){
    var data=cLoad();var idx=data.findIndex(function(o){return o.id===id;});
    if(idx>=0){
      _origStage=data[idx].stage; // guarda pra eventual rollback
      isFirst=!data[idx].revisoes||data[idx].revisoes.length===0;
      var stages=gStages();
      var enviarStage=stages.find(function(s){return s.id==='s3b';})||stages.find(function(s){return/pronto|feito|enviar/i.test(s.label);});
      if(enviarStage) data[idx].stage=enviarStage.id;
      data[idx].updatedAt=new Date().toISOString();
      var agpEl=document.getElementById('num-agp');
      if(agpEl&&agpEl.value.trim()) data[idx].agp=agpEl.value.trim();
      var resEl=document.getElementById('numprojeto');
      if(resEl&&resEl.value.trim()) data[idx].reserva=resEl.value.trim();
      if(!data[idx].revisoes) data[idx].revisoes=[];
      var revNum=data[idx].revisoes.length;
      revLabel=isFirst?'Original':'Revisão '+revNum;
      // ⚠️ NÃO fazer push aqui — foi movido para _salvarSnapshotECRM
      //    (evita gravar revisão com valor ZERO quando gerarCustoTotal é assíncrono
      //     e o callback falha — antes: 1º clique zerava 'Original', 2º clique virava 'Revisão 1')
      cSave(data);
    }
  }
  // Esconder botões após envio e TRAVAR orçamento
  var btn=document.getElementById('crm-orc-pronto-btn');if(btn)btn.style.display='none';
  var btnAtt=document.getElementById('crm-atualizar-btn');if(btnAtt)btnAtt.style.display='none';
  // PASSO 1: Verificar se entry atual pertence a ESTE card CRM
  // Se currentId aponta para outro cliente, forçar criação de novo entry
  if(currentId && id){
    var _dbCheck=loadDB();var _oiCheck=_dbCheck.findIndex(function(e){return e.id===currentId;});
    if(_oiCheck>=0 && _dbCheck[_oiCheck].crmCardId && _dbCheck[_oiCheck].crmCardId!==id){
      // Entry atual é de OUTRO card — forçar novo
      currentId=null; currentRev=null;
    }
    // Também verificar se já existe entry vinculado a ESTE card
    var _existente=_dbCheck.find(function(e){return e.crmCardId===id;});
    if(_existente){
      currentId=_existente.id; currentRev=_existente.revisions.length-1;
    }
  }
  // PASSO 2: Salvar entry primeiro (garante currentId)
  // Se NÃO é primeira revisão, FORÇAR criação de nova revisão no histórico
  if(!isFirst) window._pendingRevision=true;
  if(typeof salvarRapido==='function') try{salvarRapido();}catch(e){console.warn('salvarRapido:',e);}
  // PASSO 3: Vincular crmCardId IMEDIATAMENTE
  if(currentId){
    var _db2=loadDB();var _oi=_db2.findIndex(function(e){return e.id===currentId;});
    if(_oi>=0){
      _db2[_oi].crmCardId=id;
      var _rev=_db2[_oi].revisions[currentRev];
      if(_rev) _rev.crmPronto=true;
      saveDB(_db2);
    }
  }
  // PASSO 4: Capturar snapshot + atualizar CRM
  // Função única que salva tudo de uma vez
  var _salvarSnapshotECRM=function(){
    // captureSnapshot() e _captureOrcValues() agora leem de window._calcResult
    var _snap=null;
    try{_snap=captureSnapshot();}catch(e){}
    var _vals=typeof _captureOrcValues==='function'?_captureOrcValues():{tab:0,fat:0};
    // Fallback extra: ler direto do _calcResult se DOM falhou
    if(_vals.tab===0&&_vals.fat===0&&window._calcResult){
      _vals.tab=window._calcResult._tabTotal||0;
      _vals.fat=window._calcResult._fatTotal||0;
    }
    // Fallback: ler do snapshot
    if(_vals.tab===0&&_vals.fat===0&&_snap){
      var _parseSnap=function(s){return parseFloat((s||'0').toString().replace(/[^\d,.]/g,'').replace(/\./g,'').replace(',','.'))||0;};
      _vals.tab=_parseSnap(_snap.tabTotal);
      _vals.fat=_parseSnap(_snap.fatTotal);
    }
    console.log('💾 _salvarSnapshotECRM: tab='+_vals.tab+' fat='+_vals.fat);
    if(currentId){
      var _db3=loadDB();var _oi3=_db3.findIndex(function(e){return e.id===currentId;});
      if(_oi3>=0){
        var _rev3=_db3[_oi3].revisions[currentRev];
        if(_rev3){
          _rev3.snapshot=_snap;
          _rev3.savedAt=new Date().toISOString().replace('T',' ').substring(0,16);
        }
        saveDB(_db3);
      }
    }
    if(id){
      var _crmD=cLoad();var _ci=_crmD.findIndex(function(o){return o.id===id;});
      if(_ci>=0){
        _crmD[_ci].valor=_vals.fat||_vals.tab;
        _crmD[_ci].valorTabela=_vals.tab;
        _crmD[_ci].valorFaturamento=_vals.fat;
        if(!_crmD[_ci].revisoes) _crmD[_ci].revisoes=[];
        // ✅ CRIAR revisão AQUI — só quando temos os valores reais em mãos
        //    Evita gravar revisão zerada no card quando gerarCustoTotal é assíncrono
        var _revNum=_crmD[_ci].revisoes.length;
        var _revLabelFinal=isFirst?'Original':'Revisão '+_revNum;

        // ★ Capturar params financeiros atuais do form pra salvar na rev E
        //   na opção ativa. Assim Nova Revisão / Nova Opção podem puxar.
        var _paramsNow = (typeof _snapshotParamsDoForm==='function') ? _snapshotParamsDoForm() : null;

        _crmD[_ci].revisoes.push({
          rev:_revNum,
          label:_revLabelFinal,
          data:new Date().toISOString(),
          valorTabela:_vals.tab,
          valorFaturamento:_vals.fat,
          paramsFinanceiros: _paramsNow
        });

        // Também salva no nível da OPÇÃO ativa (fonte primária pra novas
        // opções duplicadas e também pra reload do modal)
        if(_paramsNow && window.OrcamentoOpcoes){
          var _opAtivaNow = window.OrcamentoOpcoes.ativa(_crmD[_ci]);
          if(_opAtivaNow){
            _opAtivaNow.paramsFinanceiros = _paramsNow;
          }
        }

        revLabel=_revLabelFinal; // atualiza label externo para o toast
        console.log('📊 '+_revLabelFinal+' criada: Tab='+_vals.tab+' Fat='+_vals.fat+(_paramsNow?' + paramsFin':''));
        cSave(_crmD);
        if(typeof crmRender==='function') crmRender();
      }
    }
    // Toast — amarelo se valores zerados (failsafe provavelmente disparou)
    var _zerado=(!_vals.tab && !_vals.fat);

    // ★ RECUPERAÇÃO (Felipe 20/04): se salvou com valor zero, NÃO travar
    //   o orçamento e NÃO esconder o botão Orçamento Pronto. Assim o user
    //   pode gerar custo de novo e re-clicar SEM ter que refazer tudo.
    //   Também REMOVER a revisão zerada (evita acumular revs R$0 no card).
    if(_zerado){
      // Desfazer o travamento pra permitir retry
      window._snapshotLock=false;
      _setOrcLock(false);

      // Reexibir botões de Orçamento Pronto e Atualizar
      var _btnRetry=document.getElementById('crm-orc-pronto-btn');
      if(_btnRetry){ _btnRetry.style.display=''; _btnRetry.disabled=false; }
      var _btnAttRetry=document.getElementById('crm-atualizar-btn');
      if(_btnAttRetry){ _btnAttRetry.style.display=''; }

      // Remover a revisão zerada recém-criada (a última do card)
      // E FAZER ROLLBACK do stage (voltar pra Fazer Orçamento) — assim o
      // card não fica preso em "Orçamento Pronto" sem valor.
      if(id){
        try {
          var _crmDZ=cLoad();
          var _ciZ=_crmDZ.findIndex(function(o){return o.id===id;});
          if(_ciZ>=0){
            // Remover a revisão zerada recém-criada (a última do card)
            if(_crmDZ[_ciZ].revisoes && _crmDZ[_ciZ].revisoes.length>0){
              var _lastRevZ = _crmDZ[_ciZ].revisoes[_crmDZ[_ciZ].revisoes.length-1];
              if((_lastRevZ.valorTabela||0)===0 && (_lastRevZ.valorFaturamento||0)===0){
                _crmDZ[_ciZ].revisoes.pop();
                _crmDZ[_ciZ].valor=0;
                _crmDZ[_ciZ].valorTabela=0;
                _crmDZ[_ciZ].valorFaturamento=0;
              }
            }
            // Rollback do stage pro anterior (ou Fazer Orçamento se não tinha)
            if(_origStage){
              _crmDZ[_ciZ].stage=_origStage;
            } else {
              var _stagesZ=gStages();
              var _fazerZ=_stagesZ.find(function(s){return s.id==='s3a';})||
                          _stagesZ.find(function(s){return/fazer|orca|preparar/i.test(s.label);});
              if(_fazerZ) _crmDZ[_ciZ].stage=_fazerZ.id;
            }
            cSave(_crmDZ);
          }
        } catch(e){ console.warn('[OrcPronto] rollback falhou:', e); }
      }
    } else {
      window._snapshotLock=true;
      _setOrcLock(true);
    }

    // Mostrar botão Gerar PDF (só se não zerado)
    if(!_zerado){
      var pdfBtn=document.getElementById('crm-gerar-pdf-btn');
      if(pdfBtn)pdfBtn.style.display='inline-flex';
    }

    var toast=document.createElement('div');
    toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:'+(_zerado?'#e67e22':'#27ae60')+';color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:560px;text-align:center';
    if(_zerado){
      toast.innerHTML='⚠️ Custo não gerado — orçamento NÃO foi congelado.<br><span style="font-weight:400;font-size:11px">Clique em <b>⚙ GERAR CUSTO COMPLETO</b> primeiro, depois em <b>Orçamento Pronto</b> de novo. Seus dados estão preservados.</span>';
    } else {
      toast.textContent='✅ '+revLabel+' congelada! Tab: '+brl(_vals.tab)+' Fat: '+brl(_vals.fat);
    }
    document.body.appendChild(toast);
    setTimeout(function(){toast.remove();}, _zerado?10000:5000);
    if(typeof crmRender==='function') crmRender();

    // ─── Memorial V2: salva em paralelo no banco Supabase ───
    // Não bloqueia o fluxo se falhar — só loga. Sistema antigo continua funcionando.
    if(id && window.MemorialV2 && typeof window.MemorialV2.salvar === 'function'){
      var _v2RevNum = 0;
      try {
        var _crmD2 = cLoad();
        var _cix = _crmD2.findIndex(function(o){return o.id===id;});
        if(_cix>=0 && _crmD2[_cix].revisoes) _v2RevNum = _crmD2[_cix].revisoes.length - 1;
      } catch(e){}
      window.MemorialV2.salvar({
        crmCardId: id,
        revNum: _v2RevNum,
        revLabel: revLabel,
        tipo: 'AGP',
        status: 'pronto',
        valorTabela: _vals.tab,
        valorFaturamento: _vals.fat
      }).then(function(row){
        console.log('[MemorialV2] salvo:', row && row.id, '|', revLabel);
        // Guardar o id v2 na revisão do card (pra abrir depois via banco)
        try {
          var _crmD3 = cLoad();
          var _cix2 = _crmD3.findIndex(function(o){return o.id===id;});
          if(_cix2>=0 && _crmD3[_cix2].revisoes && _crmD3[_cix2].revisoes.length>0){
            var _lastRev = _crmD3[_cix2].revisoes[_crmD3[_cix2].revisoes.length-1];
            _lastRev.memorialV2Id = row && row.id;
            cSave(_crmD3);
          }
        } catch(e){ console.warn('[MemorialV2] falhou ao linkar memorialV2Id:', e); }
      }).catch(function(err){
        console.error('[MemorialV2] ERRO salvando:', err);
        var warn = document.createElement('div');
        warn.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#c0392b;color:#fff;padding:8px 16px;border-radius:16px;font-size:11px;z-index:9998';
        warn.textContent = '⚠ Backup Supabase falhou: ' + (err.message||err);
        document.body.appendChild(warn);
        setTimeout(function(){ warn.remove(); }, 6000);
      });
    }

    // ─── OrcamentoFreeze v1.0 — CAPTURA COMPLETA (substitui MemorialCem PNG) ───
    // Felipe: "um orçamento não pode ser perdido informações. Abrir ele
    // em todas as abas com seus valores".
    // Captura TUDO (inputs + selectedIndex + blocos dinâmicos + globals +
    // displaySnap + HTMLs + canvas) num pacote único e envia ao Supabase.
    if(id && window.OrcamentoFreeze && typeof window.OrcamentoFreeze.capturar === 'function'){
      var _fzRevNum = 0;
      try {
        var _crmFz = cLoad();
        var _ciFz = _crmFz.findIndex(function(o){return o.id===id;});
        if(_ciFz>=0 && _crmFz[_ciFz].revisoes) _fzRevNum = _crmFz[_ciFz].revisoes.length - 1;
      } catch(e){}

      var _fzToast = document.createElement('div');
      _fzToast.style.cssText = 'position:fixed;top:20px;right:20px;background:#003144;color:#fff;padding:12px 18px;border-radius:12px;font-size:12px;font-weight:600;z-index:9998;box-shadow:0 4px 16px rgba(0,0,0,.3);min-width:240px';
      _fzToast.innerHTML = '💾 Congelando revisão completa...';
      document.body.appendChild(_fzToast);

      window.OrcamentoFreeze.capturar(id, _fzRevNum, revLabel)
        .then(function(r){
          _fzToast.style.background = '#27ae60';
          _fzToast.innerHTML = '✅ '+revLabel+' congelada ('+Math.round(r.tamanho/1024)+' KB)';
          setTimeout(function(){ _fzToast.remove(); }, 4000);
          if(typeof crmRender === 'function') crmRender();
        })
        .catch(function(err){
          console.error('[Freeze] ERRO:', err);
          _fzToast.style.background = '#c0392b';
          _fzToast.innerHTML = '⚠ Congelar falhou: '+(err.message||err);
          setTimeout(function(){ _fzToast.remove(); }, 6000);
        });
    }
  };
  // Se custo já foi gerado → salvar DIRETO
  // SEMPRE tenta salvar direto primeiro (valores podem estar no DOM)
  var _hasValues=false;
  var _checkTab=document.getElementById('m-tab');
  var _checkFat=document.getElementById('d-fat');
  if(_checkTab&&_checkTab.textContent&&_checkTab.textContent!=='—'&&_checkTab.textContent!=='R$ 0,00') _hasValues=true;
  if(_checkFat&&_checkFat.textContent&&_checkFat.textContent!=='—'&&_checkFat.textContent!=='R$ 0,00') _hasValues=true;
  if(window._calcResult&&(window._calcResult._tabTotal>0||window._calcResult._fatTotal>0)) _hasValues=true;

  if(_hasValues){
    _salvarSnapshotECRM();
  } else {
    // Custo não foi gerado → calcular primeiro, depois salvar
    // gerarCustoTotal atualiza window._calcResult → captureSnapshot/captureOrcValues leem dele
    window._snapshotLock=false;

    // Wrapper idempotente: garante que _salvarSnapshotECRM rode UMA vez só,
    // seja disparado pelo callback (sucesso) seja pelo timeout (failsafe).
    var _jaSalvou=false;
    var _salvarUmaVez=function(origem){
      if(_jaSalvou) return;
      _jaSalvou=true;
      console.log('[crmOrcamentoPronto] salvando via '+origem);
      try { _salvarSnapshotECRM(); }
      catch(e){ console.error('[crmOrcamentoPronto] erro em _salvarSnapshotECRM:', e); }
    };
    window._onCustoCompleto=function(){ _salvarUmaVez('callback_gerarCustoTotal'); };

    // FAILSAFE: gerarCustoTotal tem 1.8s de setTimeouts. Se ele errar/abortar
    // silenciosamente (ex: bug num modelo específico, early-return por lock),
    // _onCustoCompleto nunca dispara → card moveu mas revisão não foi criada.
    // Felipe 20/04: "apertei botão verde, moveu o card mas não enviou valor".
    // Depois de 3s, força salvamento mesmo que com valores zerados —
    // melhor ter uma revisão com 0 (corrigível) do que card órfão.
    setTimeout(function(){
      if(!_jaSalvou){
        console.warn('[crmOrcamentoPronto] FAILSAFE 3s — gerarCustoTotal não finalizou, forçando save');
        _salvarUmaVez('failsafe_timeout_3s');
      }
    }, 3000);

    if(typeof gerarCustoTotal==='function'){
      try{ gerarCustoTotal(); }
      catch(e){
        console.error('[crmOrcamentoPronto] gerarCustoTotal lançou:', e);
        // Falha síncrona → não adianta esperar callback. Salva já com o que tiver.
        _salvarUmaVez('catch_gerarCusto_throw');
      }
    } else {
      // gerarCustoTotal nem existe — salva direto com o que tiver
      _salvarUmaVez('gerarCustoTotal_ausente');
    }
  }
  }catch(err){
    console.error('crmOrcamentoPronto erro:',err);
    alert('Erro ao salvar: '+err.message);
  }
};

/* ── Gerar PDF da Proposta (botão separado) ── */
/* ★ Felipe 21/04/2026: bug 'fica escrito gerando PDF e nada acontece'.
   Fix defensivo: failsafe timeout de 60s restaura o botao mesmo se
   alguma etapa travar (erro silencioso em html2canvas, upload cloud,
   etc). Adiciona tambem try/catch em cada callback pra capturar erros
   individuais sem quebrar o fluxo inteiro. Log persistido em
   localStorage ('projetta_pdf_log') ajuda debug futuro. */
window.crmGerarPDF=function(){
  var id=window._crmOrcCardId;
  var revLabel='Original';
  if(id){
    try {
      var data=JSON.parse(localStorage.getItem('projetta_crm_v1')||'[]');
      var idx=data.findIndex(function(o){return o.id===id;});
      if(idx>=0&&data[idx].revisoes&&data[idx].revisoes.length>0){
        revLabel=data[idx].revisoes[data[idx].revisoes.length-1].label||'Original';
      }
    } catch(e){ console.warn('[PDF] erro lendo revisoes:', e); }
  }
  var btn=document.getElementById('crm-gerar-pdf-btn');
  if(btn){btn.textContent='⏳ Gerando PDF...';btn.disabled=true;}

  // ═══ FAILSAFE: restaurar botao + limpar estado se travar > 60s ═══
  var _pdfDone = false;
  var _pdfLog = [];
  function _logPdf(step, extra){
    var entry = {t: Date.now(), step: step};
    if(extra !== undefined) entry.extra = extra;
    _pdfLog.push(entry);
    console.log('[PDF]', step, extra||'');
  }
  function _finalizarPDF(sucessoMsg){
    if(_pdfDone) return;
    _pdfDone = true;
    clearTimeout(_failsafeTimer);
    if(btn){btn.textContent='📄 Gerar PDF';btn.disabled=false;}
    delete window._pdfClienteOverride;
    if(wasLocked) window._snapshotLock=true;
    // Salvar log pra debug futuro
    try {
      localStorage.setItem('projetta_pdf_log', JSON.stringify({
        ts: Date.now(),
        cardId: id,
        revLabel: revLabel,
        steps: _pdfLog,
        sucesso: !!sucessoMsg,
        msg: sucessoMsg || 'timeout/erro'
      }));
    } catch(e){}
    try { if(typeof crmRender==='function') crmRender(); } catch(e){}
  }
  var _failsafeTimer = setTimeout(function(){
    if(_pdfDone) return;
    _logPdf('FAILSAFE TIMEOUT 60s');
    _showToast('⚠️ PDF demorou muito. Abra F12 > Console pra ver erro. Tente novamente.','#c0392b');
    _finalizarPDF(null);
  }, 60000);

  _logPdf('inicio', {cardId:id, revLabel:revLabel});

  // Temporariamente desbloquear para calc() e populateProposta() funcionarem
  var wasLocked=window._snapshotLock;
  window._snapshotLock=false;
  if(typeof calc==='function') try{calc();_logPdf('calc ok');}catch(e){_logPdf('calc ERRO', e.message);}
  // Capturar nome do cliente UMA VEZ (evita nomes diferentes entre PDF e PNG)
  var _clienteFixo=_getBestClientName();
  window._pdfClienteOverride=_clienteFixo;
  // 1. Gerar PDF download
  _showToast('⏳ Gerando PDF...','#e67e22');
  setTimeout(function(){
    try {
      _logPdf('chamando _gerarPropostaPDF');
      _gerarPropostaPDF(function(pdf,blob){
        _logPdf('_gerarPropostaPDF callback', {hasPdf: !!pdf});
        try {
          pdf.save(_pdfFileName());
          _logPdf('pdf.save ok');
          _showToast('✅ Proposta PDF baixada!','#27ae60');
        } catch(e){
          _logPdf('pdf.save ERRO', e.message);
          _showToast('⚠️ Download bloqueado pelo navegador. Permita downloads.','#e67e22');
        }
        // 2. Gerar RC/MC/MR PNGs (cada um isolado em try/catch)
        setTimeout(function(){
          try {
            if(typeof printPainelRep==='function') {printPainelRep(); _logPdf('printPainelRep ok');}
          } catch(e){ _logPdf('printPainelRep ERRO', e.message); }
          setTimeout(function(){
            try {
              if(typeof printMemorialCalculo==='function') {printMemorialCalculo(); _logPdf('printMemorialCalculo ok');}
            } catch(e){ _logPdf('printMemorialCalculo ERRO', e.message); }
            setTimeout(function(){
              try {
                if(typeof printMargens==='function') {printMargens(); _logPdf('printMargens ok');}
              } catch(e){ _logPdf('printMargens ERRO', e.message); }
              _showToast('✅ PDF + RC + MC + MR baixados!','#27ae60');
            },700);
          },700);
        },500);
        // 3. Salvar imagens no card CRM (com failsafe proprio: se travar, finaliza em 40s)
        try {
          _logPdf('chamando _exportPropostaToCard');
          _exportPropostaToCard(id, revLabel, function(captures){
            var nPages=captures?captures.length:0;
            _logPdf('_exportPropostaToCard callback', {nPages: nPages});
            _showToast('📄 '+nPages+' página(s) salvas no card','#8e44ad');
            _finalizarPDF('ok '+nPages+' paginas');
          });
        } catch(e){
          _logPdf('_exportPropostaToCard ERRO', e.message);
          _showToast('⚠️ Erro ao salvar no card: '+e.message,'#c0392b');
          _finalizarPDF(null);
        }
      });
    } catch(e){
      _logPdf('_gerarPropostaPDF ERRO sincrono', e.message);
      _showToast('❌ Erro ao gerar PDF: '+e.message,'#c0392b');
      _finalizarPDF(null);
    }
  },300);
};

/* ── Atualizar Valor para Card (sem mudar etapa) ── */
window.crmAtualizarValorCard=function(){
  var id=window._crmOrcCardId;if(!id){alert('Nenhum card vinculado. Use "Fazer Orçamento" no CRM primeiro.');return;}
  var data=cLoad();var idx=data.findIndex(function(o){return o.id===id;});
  if(idx<0){alert('Card não encontrado no CRM.');window._crmOrcCardId=null;return;}

  // Callback: salvar valores DEPOIS do cálculo completo
  var _salvarValores=function(){
    var data2=cLoad();var idx2=data2.findIndex(function(o){return o.id===id;});
    if(idx2<0) return;
    var vals=_captureOrcValues();
    if(vals.fat<=0&&vals.tab<=0){alert('Valores zerados — verifique o orçamento.');return;}
    data2[idx2].updatedAt=new Date().toISOString();
    data2[idx2].valor=vals.fat;
    data2[idx2].valorTabela=vals.tab;
    data2[idx2].valorFaturamento=vals.fat;
    // Nova revisão no card
    if(!data2[idx2].revisoes) data2[idx2].revisoes=[];
    var revNum=data2[idx2].revisoes.length;
    var revLabel='Revisão '+revNum;
    data2[idx2].revisoes.push({rev:revNum,label:revLabel,data:new Date().toISOString(),valorTabela:vals.tab,valorFaturamento:vals.fat});
    // AGP e Reserva
    var agpEl=document.getElementById('num-agp');
    if(agpEl&&agpEl.value.trim()) data2[idx2].agp=agpEl.value.trim();
    var resEl=document.getElementById('numprojeto');
    if(resEl&&resEl.value.trim()) data2[idx2].reserva=resEl.value.trim();
    cSave(data2);
    crmRender();
    // Exportar proposta silenciosamente
    _exportPropostaToCard(id, revLabel, function(captures){
      var nPages=captures?captures.length:0;
      var toast2=document.createElement('div');toast2.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#2980b9;color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';toast2.textContent='🔄 '+revLabel+' atualizada! '+nPages+' pág. Tab: '+brl(vals.tab)+' | Fat: '+brl(vals.fat);document.body.appendChild(toast2);setTimeout(function(){toast2.remove();},5000);
    });

    // ─── OrcamentoFreeze: capturar pacote completo da nova revisão ───
    if(window.OrcamentoFreeze && typeof window.OrcamentoFreeze.capturar === 'function'){
      var _fzToast2 = document.createElement('div');
      _fzToast2.style.cssText = 'position:fixed;top:20px;right:20px;background:#003144;color:#fff;padding:12px 18px;border-radius:12px;font-size:12px;font-weight:600;z-index:9998;box-shadow:0 4px 16px rgba(0,0,0,.3);min-width:240px';
      _fzToast2.innerHTML = '💾 Congelando '+revLabel+'...';
      document.body.appendChild(_fzToast2);
      window.OrcamentoFreeze.capturar(id, revNum, revLabel)
        .then(function(r){
          _fzToast2.style.background = '#27ae60';
          _fzToast2.innerHTML = '✅ '+revLabel+' congelada ('+Math.round(r.tamanho/1024)+' KB)';
          setTimeout(function(){ _fzToast2.remove(); }, 4000);
        }).catch(function(err){
          console.error('[Freeze] ERRO:', err);
          _fzToast2.style.background = '#c0392b';
          _fzToast2.innerHTML = '⚠ Congelar falhou: '+(err.message||err);
          setTimeout(function(){ _fzToast2.remove(); }, 6000);
        });
    }
    // Esconder botões e travar
    var btnAtt=document.getElementById('crm-atualizar-btn');if(btnAtt)btnAtt.style.display='none';
    var btnPronto=document.getElementById('crm-orc-pronto-btn');if(btnPronto)btnPronto.style.display='none';
    if(typeof salvarRapido==='function') try{salvarRapido();}catch(e){}
    if(currentId){
      var _db3=loadDB();var _oi3=_db3.findIndex(function(e){return e.id===currentId;});
      if(_oi3>=0&&_db3[_oi3].revisions[currentRev]){
        _db3[_oi3].revisions[currentRev].crmPronto=true;
        try{_db3[_oi3].revisions[currentRev].snapshot=captureSnapshot();}catch(e){}
        saveDB(_db3);
      }
    }
    if(typeof renderClientesTab==='function') try{renderClientesTab();}catch(e){}
    window._snapshotLock=true;
    _setOrcLock(true);
  };

  // FORÇAR recálculo antes de capturar valores (async — callback salva depois)
  window._snapshotLock=false;
  window._custoCalculado=false;
  window._onCustoCompleto=_salvarValores;
  if(typeof gerarCustoTotal==='function') try{gerarCustoTotal();}catch(e){_salvarValores();}
};

/* ── Helper: capturar valores do orçamento ──────── */
/* ── Ver Proposta salva no card ── */
window.crmVerProposta=function(cardId, revIndex){
  var data=cLoad();
  var card=data.find(function(o){return o.id===cardId;});
  if(!card||!card.revisoes||!card.revisoes[revIndex]){alert('Revisão não encontrada.');return;}
  var rev=card.revisoes[revIndex];

  function _showPages(pages){
    var ov=document.createElement('div');
    ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.9);z-index:99999;overflow-y:auto;padding:20px;cursor:pointer';
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    var inner='<div style="max-width:800px;margin:0 auto;text-align:center">';
    inner+='<div style="color:#fff;font-size:14px;font-weight:700;margin-bottom:12px">📄 '+(rev.label||'Proposta')+' — '+(card.cliente||'')+'<br><span style="font-size:11px;opacity:.6">'+(rev.pdfDate?new Date(rev.pdfDate).toLocaleString('pt-BR'):'')+'</span></div>';
    inner+='<div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px"><button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:8px 20px;border-radius:8px;border:none;background:#e74c3c;color:#fff;font-weight:700;cursor:pointer;font-size:13px">✕ Fechar</button></div>';
    for(var i=0;i<pages.length;i++){
      inner+='<div style="margin-bottom:16px"><img src="'+pages[i]+'" style="width:100%;border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,.5)"><div style="color:#888;font-size:10px;margin-top:4px">Página '+(i+1)+' de '+pages.length+'</div></div>';
    }
    inner+='</div>';
    ov.innerHTML=inner;
    document.body.appendChild(ov);
  }

  // Se imagens estão na nuvem, buscar do Supabase
  if(rev.pdfCloud){
    var _sbUrl=window._SB_URL, _sbKey=window._SB_KEY;
    var _imgKey='proposta_img_'+cardId;
    _showToast('☁️ Carregando proposta da nuvem...','#3498db');
    fetch(_sbUrl+'/rest/v1/configuracoes?chave=eq.'+_imgKey+'&select=valor&limit=1',{
      headers:{'apikey':_sbKey,'Authorization':'Bearer '+_sbKey}
    }).then(function(r){return r.json();}).then(function(rows){
      if(rows&&rows[0]&&rows[0].valor&&rows[0].valor.pages){
        _showPages(rows[0].valor.pages);
      } else {
        alert('Imagens não encontradas na nuvem.');
      }
    }).catch(function(e){alert('Erro ao carregar da nuvem: '+e.message);});
    return;
  }
  // Fallback: localStorage (compatibilidade com dados antigos)
  if(!rev.pdfPages||!rev.pdfPages.length){alert('Nenhuma proposta salva nesta revisão.');return;}
  _showPages(rev.pdfPages);
};

function _captureOrcValues(){
  // LER DO DOM — é o que o usuário VÊ na tela
  var _parse=function(el){
    if(!el||!el.textContent)return 0;
    var v=el.textContent.replace(/[^\d,.]/g,'');
    if(!v)return 0;
    // Se tem vírgula → BR format
    if(v.indexOf(',')>=0) v=v.replace(/\./g,'').replace(',','.');
    return parseFloat(v)||0;
  };
  var valorTab=_parse(document.getElementById('m-tab'));
  var valorFat=_parse(document.getElementById('d-fat'));
  // Fallback 1: outros elementos
  if(valorFat===0) valorFat=_parse(document.getElementById('m-fat'));
  // Fallback 2: _calcResult
  if(valorTab===0&&valorFat===0&&window._calcResult){
    valorTab=window._calcResult._tabTotal||0;
    valorFat=window._calcResult._fatTotal||0;
  }
  // ★ Felipe 20/04: capturar tambem instalacao internacional + campos CIF
  //   pra persistir no card e o breakdown funcionar mesmo sem o orc aberto.
  var _v = function(id){ var e=document.getElementById(id); return e? (parseFloat(e.value)||0) : 0; };
  var _vStr = function(id){ var e=document.getElementById(id); return e? (e.value||'') : ''; };
  var _instIntlFat = (typeof window._instIntlFat === 'number') ? window._instIntlFat : 0;
  var _instQuem = _vStr('inst-quem');
  return {
    tab: valorTab,
    fat: valorFat,
    instIntlFat: _instIntlFat,          // Instalação internacional em R$ (faturamento com margem)
    instQuem: _instQuem,                 // PROJETTA / WEIKU / TERCEIROS / INTERNACIONAL
    // Campos logistica CIF — em USD, convertidos em runtime pra R$
    incoterm:         _vStr('inst-incoterm'),
    cifCaixaL:        _v('inst-cif-caixa-l')   || _v('crm-o-cif-caixa-l'),
    cifCaixaA:        _v('inst-cif-caixa-a')   || _v('crm-o-cif-caixa-a'),
    cifCaixaE:        _v('inst-cif-caixa-e')   || _v('crm-o-cif-caixa-e'),
    cifCaixaTaxa:     _v('inst-cif-caixa-taxa')|| _v('crm-o-cif-caixa-taxa') || 100,
    cifFreteTerr:     _v('inst-cif-frete-terrestre')||_v('crm-o-cif-frete-terrestre') || 0,
    cifFreteMar:      _v('inst-cif-frete-maritimo')||_v('crm-o-cif-frete-maritimo') || 0,
    // Campos base de instalacao internacional (pra o breakdown conseguir recalcular)
    instPassagem:     _v('inst-intl-passagem'),
    instHotel:        _v('inst-intl-hotel'),
    instAlim:         _v('inst-intl-alim'),
    instUdigru:       _v('inst-intl-udigru'),
    instSeguro:       _v('inst-intl-seguro'),
    instCarro:        _v('inst-intl-carro'),
    instMO:           _v('inst-intl-mo'),
    instPessoas:      _v('inst-intl-pessoas'),
    instDias:         _v('inst-intl-dias'),
    instMargem:       _v('inst-intl-margem'),
    instCambio:       _v('inst-intl-cambio') || 5.20
  };
}

/* ── Export CSV ──────────────────────────────────── */
window.crmExportCSV=function(){
  var all=cLoad();var stages=gStages();
  var rows=[['Cliente','Data 1° Contato','Escopo','País','Estado','Cidade','CEP','Produto','Largura','Altura','Abertura','Modelo','Folhas','Reserva','AGP','Valor','Valor Tabela','Valor Faturamento','Etapa','Responsável','Rep.Weiku','Origem','Previsão','Prioridade','Notas']];
  all.forEach(function(o){var st=stages.find(function(s){return s.id===o.stage;})||{label:o.stage};rows.push([o.cliente,o.dataContato||'',o.scope==='internacional'?'Internacional':'Nacional',o.pais||'',o.estado||'',o.cidade||'',o.cep||'',o.produto||'',o.largura||'',o.altura||'',o.abertura||'',o.modelo||'',o.folhas||'1',o.reserva||'',o.agp||'',o.valor,o.valorTabela||'',o.valorFaturamento||'',st.label,o.responsavel||'',o.wrep||'',o.origem||'',o.fechamento||'',o.prioridade||'',(o.notas||'').replace(/,/g,';')]);});
  var csv=rows.map(function(r){return r.map(function(c){return'"'+(c||'')+'"';}).join(',');}).join('\n');
  var a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent('\uFEFF'+csv);a.download='crm-projetta-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
};

/* ── Import ──────────────────────────────────────── */
window.crmOpenImport=function(){el('crm-import-modal').classList.add('open');};
window.crmCloseImport=function(){el('crm-import-modal').classList.remove('open');};
window.crmReadImportFile=function(input){
  var f=input.files[0];if(!f)return;
  var r=new FileReader();r.onload=function(e){el('crm-import-text').value=e.target.result;};r.readAsText(f);
};
window.crmDoImport=function(){
  var txt=(el('crm-import-text')||{}).value;if(!txt||!txt.trim()){alert('Cole ou carregue dados primeiro.');return;}
  var lines=txt.trim().split('\n');
  var sep=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
  var headers=lines[0].split(sep).map(function(h){return h.trim().replace(/"/g,'').toLowerCase();});
  var stages=gStages();var data=cLoad();var count=0;
  for(var i=1;i<lines.length;i++){
    var vals=lines[i].split(sep).map(function(v){return v.trim().replace(/"/g,'');});
    if(vals.length<2||!vals[1])continue;
    var get=function(names){for(var n=0;n<names.length;n++){var idx=headers.indexOf(names[n]);if(idx>=0&&vals[idx])return vals[idx];}return '';};
    var cliente=get(['cliente','nome','client','name'])||vals[1]||'';
    if(!cliente)continue;
    // Check duplicates
    if(data.find(function(o){return o.cliente===cliente;}))continue;
    var rep=get(['representante','rep','rep.weiku','wrep']);
    var origem=get(['origem','origin','source'])||'';
    if(!origem&&rep)origem='Weiku do Brasil';
    if(!origem)origem='Direto';
    var valor=parseFloat(get(['valor','vlr','value','vlr_novo'])||'0')||0;
    var stageLabel=get(['etapa','stage','status'])||'';
    var stageId=stages[0].id;
    if(stageLabel){var found=stages.find(function(s){return s.label.toLowerCase().includes(stageLabel.toLowerCase());});if(found)stageId=found.id;}
    var opp={
      id:uuid(),
      cliente:cliente,
      contato:get(['contato','telefone','tel','phone']),
      produto:get(['produto','product','modelo']),
      responsavel:get(['orcamentista','responsavel','resp']),
      origem:origem,
      wrep:rep,
      valor:valor,
      fechamento:get(['fechamento','previsao','date']),
      prioridade:'normal',
      notas:get(['notas','obs','observacoes']),
      largura:parseInt(get(['largura','l','width']))||0,
      altura:parseInt(get(['altura','a','height']))||0,
      abertura:get(['abertura','tipo']),
      modelo:get(['modelo','model']),
      folhas:get(['folhas','num_folhas','numero_folhas'])||'1',
      reserva:get(['reserva','numprojeto','projeto','project']),
      agp:get(['agp','num_agp']),
      cep:get(['cep']),
      scope:'nacional',
      cidade:get(['cidade','city']),
      estado:get(['estado','uf','state']),
      pais:'',
      stage:stageId,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      anexos:[]
    };
    data.unshift(opp);count++;
  }
  if(count>0){cSave(data);crmRender();}
  var st=el('crm-import-status');
  if(st){st.style.display='block';st.textContent='✅ '+count+' oportunidades importadas com sucesso!';}
  if(count>0)setTimeout(function(){crmCloseImport();},1500);
  else{if(st){st.style.display='block';st.style.color='#e74c3c';st.textContent='⚠ Nenhum registro novo importado (duplicatas ou formato inválido).';}}
};

/* ── Attachments (anexos) — Supabase Storage ── */
var _modalAttachs=[];
window._SB_URL=window._SB_URL||'https://plmliavuwlgpwaizfeds.supabase.co';
window._SB_KEY=window._SB_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
var _SB_BUCKET='crm-anexos';

// Ensure bucket exists
(function(){
  fetch(_SB_URL+'/storage/v1/bucket/'+_SB_BUCKET,{headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY}})
    .then(function(r){if(r.status===404){
      fetch(_SB_URL+'/storage/v1/bucket',{method:'POST',headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({id:_SB_BUCKET,name:_SB_BUCKET,public:true})}).catch(function(){});
    }}).catch(function(){});
})();

function _sbUploadFile(dealId,file,cb){
  var ts=Date.now();
  var safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  var path=dealId+'/'+ts+'_'+safeName;
  fetch(_SB_URL+'/storage/v1/object/'+_SB_BUCKET+'/'+path,{
    method:'POST',
    headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY,'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},
    body:file
  }).then(function(r){
    if(r.ok){
      var url=_SB_URL+'/storage/v1/object/public/'+_SB_BUCKET+'/'+path;
      cb({name:file.name,type:file.type,url:url,path:path,date:new Date().toISOString().slice(0,10),size:file.size});
    } else {
      r.text().then(function(t){console.warn('Upload erro:',t);
        // Fallback: salvar como base64
        var reader=new FileReader();
        reader.onload=function(e){cb({name:file.name,type:file.type,data:e.target.result,date:new Date().toISOString().slice(0,10)});};
        reader.readAsDataURL(file);
      });
    }
  }).catch(function(e){console.warn('Upload falhou:',e);
    var reader=new FileReader();
    reader.onload=function(ev){cb({name:file.name,type:file.type,data:ev.target.result,date:new Date().toISOString().slice(0,10)});};
    reader.readAsDataURL(file);
  });
}

function crmSaveAttachCloud(dealId,attachs){
  if(!dealId||!attachs||!attachs.length)return;
  var key='crm_attach_'+dealId;
  // Salvar apenas metadata (URLs) — arquivos já estão no Storage
  var meta=attachs.map(function(a){return{name:a.name,type:a.type,url:a.url||'',path:a.path||'',date:a.date,size:a.size||0};});
  fetch(_SB_URL+'/rest/v1/configuracoes',{method:'POST',
    headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify({chave:key,valor:{attachs:meta,ts:new Date().toISOString()}})
  }).catch(function(e){console.warn('Erro ao salvar metadata anexos:',e);});
}
function crmLoadAttachCloud(dealId,cb){
  if(!dealId){cb([]);return;}
  var key='crm_attach_'+dealId;
  fetch(_SB_URL+'/rest/v1/configuracoes?chave=eq.'+key+'&select=valor&limit=1',
    {headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY}})
    .then(function(r){return r.json();})
    .then(function(rows){cb(rows&&rows.length&&rows[0].valor?rows[0].valor.attachs||[]:[]); })
    .catch(function(){cb([]);});
}
function crmDeleteAttachCloud(dealId){
  if(!dealId)return;
  var key='crm_attach_'+dealId;
  // Deletar metadata
  fetch(_SB_URL+'/rest/v1/configuracoes?chave=eq.'+key,{method:'DELETE',
    headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY}}).catch(function(){});
  // Deletar arquivos do storage
  fetch(_SB_URL+'/storage/v1/object/list/'+_SB_BUCKET,{method:'POST',
    headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({prefix:dealId+'/'})
  }).then(function(r){return r.json();}).then(function(files){
    if(files&&files.length){
      var paths=files.map(function(f){return dealId+'/'+f.name;});
      fetch(_SB_URL+'/storage/v1/object/'+_SB_BUCKET,{method:'DELETE',
        headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({prefixes:paths})}).catch(function(){});
    }
  }).catch(function(){});
}

window.crmHandleAttachFiles=function(files){
  if(!files||!files.length)return;
  var dealId=window._editId||'tmp_'+Date.now();
  var pending=files.length;
  var drop=el('crm-attach-drop');
  if(drop){drop.style.borderColor='#e67e22';drop.innerHTML='⏳ Enviando '+pending+' arquivo(s)...';}
  Array.from(files).forEach(function(f){
    _sbUploadFile(dealId,f,function(att){
      _modalAttachs.push(att);
      pending--;
      crmRenderAttachments();
      if(pending===0){
        if(drop){drop.style.borderColor='#27ae60';drop.innerHTML='✅ Enviado!';
          setTimeout(function(){drop.style.borderColor='';drop.innerHTML='📎 Clique ou arraste imagens/arquivos aqui';},2000);}
      }
    });
  });
  var inp=el('crm-attach-input');if(inp)inp.value='';
};
window.crmRenderAttachments=function(){
  var grid=el('crm-attach-grid');if(!grid)return;
  grid.innerHTML='';
  if(!_modalAttachs.length){grid.innerHTML='<div style="font-size:11px;color:var(--hint);padding:6px 0">Nenhum anexo ainda</div>';return;}
  grid.innerHTML='<span style="font-size:10px;color:var(--hint)">'+_modalAttachs.length+' anexo'+((_modalAttachs.length>1)?'s':'')+'</span>';
  _modalAttachs.forEach(function(a,i){
    var div=document.createElement('div');div.className='crm-attach-item';
    div.style.cssText='display:inline-block;margin:4px;position:relative;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;width:90px;vertical-align:top;cursor:pointer';
    var isImg=a.type&&a.type.startsWith('image/');
    var hasUrl=!!a.url;
    // Thumbnail or icon
    if(isImg && (a.url||a.data)){
      div.innerHTML='<img src="'+(a.url||a.data)+'" style="width:90px;height:70px;object-fit:cover;display:block">';
    } else {
      var icon=a.type&&a.type.indexOf('pdf')>=0?'📄':a.type&&a.type.indexOf('sheet')>=0?'📊':'📎';
      div.innerHTML='<div style="width:90px;height:70px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:28px">'+icon+'</div>';
    }
    div.innerHTML+='<div style="padding:3px 5px;font-size:8px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+a.name+'">'+a.name+'</div>';
    // Delete button
    div.innerHTML+='<button onclick="event.stopPropagation();_modalAttachs.splice('+i+',1);crmRenderAttachments()" style="position:absolute;top:2px;right:2px;background:#e74c3c;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:18px;text-align:center">✕</button>';
    // Click to open
    if(hasUrl){
      div.onclick=function(e){if(e.target.tagName==='BUTTON')return;window.open(a.url,'_blank');};
    } else if(a.data){
      div.onclick=function(e){if(e.target.tagName==='BUTTON')return;window.open(a.data,'_blank');};
    }
    grid.appendChild(div);
  });
};
window.crmRemoveAttach=function(i){_modalAttachs.splice(i,1);crmRenderAttachments();};

/* ── Settings ─────────────────────────────────────── */
window.crmOpenSettings=function(){renderSettings();el('crm-settings-modal').classList.add('open');};
window.crmCloseSettings=function(){el('crm-settings-modal').classList.remove('open');};
window.crmStTab=function(tab,btn){
  document.querySelectorAll('.crm-settings-section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('.crm-stab').forEach(function(b){b.classList.remove('active');});
  el('crm-set-'+tab).classList.add('active');btn.classList.add('active');
};
var _tmpSt=null;
function renderSettings(){
  _tmpSt=null;
  // Stages — with up/down reorder
  var sl=el('crm-stages-list');sl.innerHTML='';
  gStages().forEach(function(st,i,arr){
    var d=document.createElement('div');d.className='crm-stage-item';d.setAttribute('data-idx',i);
    // Grip
    var grip=document.createElement('span');grip.className='crm-stage-grip';grip.title='Arrastar';grip.textContent='☰';d.appendChild(grip);
    // Color
    var colorInp=document.createElement('input');colorInp.type='color';colorInp.className='crm-stage-color';colorInp.value=st.color;
    colorInp.addEventListener('input',function(){crmEditStage(i,'color',this.value);});d.appendChild(colorInp);
    // Icon
    var iconInp=document.createElement('input');iconInp.type='text';iconInp.value=st.icon;iconInp.style.cssText='width:40px;text-align:center';
    iconInp.addEventListener('input',function(){crmEditStage(i,'icon',this.value);});d.appendChild(iconInp);
    // Label
    var labelInp=document.createElement('input');labelInp.type='text';labelInp.value=st.label;labelInp.style.cssText='flex:1';
    labelInp.addEventListener('input',function(){crmEditStage(i,'label',this.value);});d.appendChild(labelInp);
    // Up
    var btnUp=document.createElement('button');btnUp.className='crm-stage-move-btn';btnUp.title='Subir';btnUp.textContent='▲';
    if(i===0)btnUp.disabled=true;btnUp.onclick=function(){crmMoveStageItem(i,-1);};d.appendChild(btnUp);
    // Down
    var btnDn=document.createElement('button');btnDn.className='crm-stage-move-btn';btnDn.title='Descer';btnDn.textContent='▼';
    if(i===arr.length-1)btnDn.disabled=true;btnDn.onclick=function(){crmMoveStageItem(i,1);};d.appendChild(btnDn);
    // Delete
    var btnDel=document.createElement('button');btnDel.style.cssText='background:#fde;color:#e74c3c;border:none;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px';btnDel.textContent='✕';
    btnDel.onclick=function(){crmRemoveStageItem(i);};d.appendChild(btnDel);
    sl.appendChild(d);
  });
  // Origins — same layout as stages (list with inline edit)
  var ol=el('crm-orig-list');if(ol){ol.innerHTML='';
  gOrigins().forEach(function(orig,i,arr){
    var d=document.createElement('div');d.className='crm-stage-item';
    d.innerHTML=
      '<span class="crm-stage-grip">☰</span>'+
      '<input type="text" value="'+escH(orig)+'" style="flex:1" oninput="crmEditOrigin('+i+',this.value)">'+
      '<button class="crm-stage-move-btn" title="Subir" onclick="crmMoveOriginItem('+i+',-1)"'+(i===0?' disabled':'')+'>▲</button>'+
      '<button class="crm-stage-move-btn" title="Descer" onclick="crmMoveOriginItem('+i+',1)"'+(i===arr.length-1?' disabled':'')+'>▼</button>'+
      '<button onclick="crmRemoveOrigin('+i+')" style="background:#fde;color:#e74c3c;border:none;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px">✕</button>';
    ol.appendChild(d);
  });}
  // Products — same layout as stages
  var pl=el('crm-prod-list');if(pl){pl.innerHTML='';
  gProducts().forEach(function(prod,i,arr){
    var d=document.createElement('div');d.className='crm-stage-item';
    d.innerHTML=
      '<span class="crm-stage-grip">☰</span>'+
      '<input type="text" value="'+escH(prod)+'" style="flex:1" oninput="crmEditProduct('+i+',this.value)">'+
      '<button class="crm-stage-move-btn" title="Subir" onclick="crmMoveProductItem('+i+',-1)"'+(i===0?' disabled':'')+'>▲</button>'+
      '<button class="crm-stage-move-btn" title="Descer" onclick="crmMoveProductItem('+i+',1)"'+(i===arr.length-1?' disabled':'')+'>▼</button>'+
      '<button onclick="crmRemoveProduct('+i+')" style="background:#fde;color:#e74c3c;border:none;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px">✕</button>';
    pl.appendChild(d);
  });}
  // Team
  var tl=el('crm-team-list');tl.innerHTML='';
  gTeam().forEach(function(m,i){
    tl.innerHTML+='<div class="crm-team-item"><div class="crm-avatar" style="background:'+m.color+';width:26px;height:26px;font-size:10px">'+m.name.charAt(0)+'</div><span style="flex:1;font-size:12px;font-weight:600">'+escH(m.name)+'</span><button onclick="var s=gS();s.team=gTeam().slice();s.team.splice('+i+',1);sS(s);renderSettings()" style="background:#fde;color:#e74c3c;border:none;border-radius:7px;padding:4px 8px;cursor:pointer;font-size:10px">✕</button></div>';
  });
}
/* ── Stage reorder ──── */
window.crmEditStage=function(i,prop,val){
  if(!_tmpSt)_tmpSt=gStages().map(function(s){return Object.assign({},s);});
  _tmpSt[i][prop]=val;
};
window.crmRemoveStageItem=function(i){
  if(!_tmpSt)_tmpSt=gStages().map(function(s){return Object.assign({},s);});
  _tmpSt.splice(i,1);
  var s=gS();s.stages=_tmpSt;sS(s);
  renderSettings();
};
window.crmMoveStageItem=function(i,dir){
  try{
    var stages=gStages().map(function(s){return Object.assign({},s);}); // Deep copy
    var j=i+dir;if(j<0||j>=stages.length)return;
    var tmp=stages[i];stages[i]=stages[j];stages[j]=tmp;
    _tmpSt=stages;
    var s=gS();s.stages=stages;sS(s);
    renderSettings();
    crmRender();
  }catch(e){console.error('Erro ao mover etapa:',e);}
};
/* ── Origin helpers ──── */
window._tmpOrigins=null;
window.crmEditOrigin=function(i,v){var s=gS();if(!s.origins)s.origins=gOrigins().slice();s.origins[i]=v;sS(s);};
window.crmRemoveOrigin=function(i){var s=gS();s.origins=gOrigins().slice();s.origins.splice(i,1);sS(s);renderSettings();};
window.crmMoveOriginItem=function(i,dir){var s=gS();s.origins=gOrigins().slice();var j=i+dir;if(j<0||j>=s.origins.length)return;var tmp=s.origins[i];s.origins[i]=s.origins[j];s.origins[j]=tmp;sS(s);renderSettings();};
window.crmAddOriginItem=function(){var inp=el('crm-new-orig');if(!inp||!inp.value.trim())return;var s=gS();s.origins=gOrigins().slice();if(!s.origins.includes(inp.value.trim()))s.origins.push(inp.value.trim());sS(s);inp.value='';renderSettings();};
/* ── Product helpers ──── */
window.crmEditProduct=function(i,v){var s=gS();if(!s.products)s.products=gProducts().slice();s.products[i]=v;sS(s);};
window.crmRemoveProduct=function(i){var s=gS();s.products=gProducts().slice();s.products.splice(i,1);sS(s);renderSettings();};
window.crmMoveProductItem=function(i,dir){var s=gS();s.products=gProducts().slice();var j=i+dir;if(j<0||j>=s.products.length)return;var tmp=s.products[i];s.products[i]=s.products[j];s.products[j]=tmp;sS(s);renderSettings();};
window.crmAddProductItem=function(){var inp=el('crm-new-prod');if(!inp||!inp.value.trim())return;var s=gS();s.products=gProducts().slice();if(!s.products.includes(inp.value.trim()))s.products.push(inp.value.trim());sS(s);inp.value='';renderSettings();};
function renderTagList(containerId,items,type){
  var c=el(containerId);if(!c)return;c.innerHTML='';
  items.forEach(function(item,i){
    var tag=document.createElement('div');tag.className='crm-tag';
    tag.innerHTML='<span class="crm-tag-text">'+escH(item)+'</span><span class="crm-tag-del" onclick="removeTag(\''+type+'\','+i+')">✕</span>';
    tag.ondblclick=function(){tag.innerHTML='<input value="'+escH(item)+'" style="border:none;outline:none;font-family:inherit;font-size:11px;font-weight:600;background:transparent;width:140px" onblur="saveTagEdit(\''+type+'\','+i+',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()"><span onclick="renderSettings()" style="cursor:pointer;color:var(--hint);margin-left:4px">✓</span>';tag.querySelector('input').focus();};
    c.appendChild(tag);
  });
}
window.removeTag=function(type,i){
  var s=gS();
  if(type==='origem'){s.origins=gOrigins().slice();s.origins.splice(i,1);}
  else if(type==='produto'){s.products=gProducts().slice();s.products.splice(i,1);}
  else if(type==='wrep'){s.wreps=gWReps().slice();s.wreps.splice(i,1);}
  sS(s);renderSettings();
};
window.saveTagEdit=function(type,i,newVal){
  if(!newVal.trim())return;var s=gS();
  if(type==='origem'){s.origins=gOrigins().slice();s.origins[i]=newVal.trim();}
  else if(type==='produto'){s.products=gProducts().slice();s.products[i]=newVal.trim();}
  else if(type==='wrep'){s.wreps=gWReps().slice();s.wreps[i]=newVal.trim();}
  sS(s);renderSettings();
};
window.crmAddTag=function(type){
  var ids={origem:'crm-new-orig',produto:'crm-new-prod',wrep:'crm-new-wrep'};
  var inpId=ids[type];var v=(el(inpId)||{}).value;if(!v||!v.trim())return;v=v.trim();
  var s=gS();
  if(type==='origem'){s.origins=gOrigins().slice();if(!s.origins.includes(v))s.origins.push(v);}
  else if(type==='produto'){s.products=gProducts().slice();if(!s.products.includes(v))s.products.push(v);}
  else if(type==='wrep'){s.wreps=gWReps().slice();if(!s.wreps.includes(v))s.wreps.push(v);}
  sS(s);setVal(inpId,'');renderSettings();
};
window.crmAddStage=function(){if(!_tmpSt)_tmpSt=gStages().slice();_tmpSt.push({id:'s'+Date.now(),label:'Nova Etapa',color:'#7f8c8d',icon:'⭕'});var s=gS();s.stages=_tmpSt;sS(s);renderSettings();};
window.crmAddMember=function(){
  var name=(el('crm-new-member')||{}).value;if(!name||!name.trim())return;
  var color=(el('crm-new-member-color')||{}).value||'#003144';
  var s=gS();s.team=gTeam().slice();if(!s.team.find(function(m){return m.name===name.trim();}))s.team.push({name:name.trim(),color:color});
  sS(s);setVal('crm-new-member','');renderSettings();
};
window.crmSaveSettings=function(){
  var s=gS();
  if(_tmpSt)s.stages=_tmpSt;
  sS(s);
  // Cloud sync settings
  var SB='https://plmliavuwlgpwaizfeds.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  fetch(SB+'/rest/v1/configuracoes',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},body:JSON.stringify({chave:SK,valor:{data:s,ts:new Date().toISOString()}})}).catch(function(){});
  crmCloseSettings();crmRender();
};

/* ── Click outside ───────────────────────────────── */
document.addEventListener('click',function(e){
  var ac=el('crm-city-ac');
  if(ac&&!ac.contains(e.target)&&e.target.id!=='crm-o-cidade-nac')ac.style.display='none';
  document.querySelectorAll('.crm-select-dropdown.open').forEach(function(dd){
    if(!dd.contains(e.target)){var prev=dd.previousElementSibling;if(!prev||!prev.contains(e.target))dd.classList.remove('open');}
  });
});

/* ── Init + Cloud Sync + Seed Data ────────────────── */
function crmSeedIfEmpty(){
  // CRM zerado — sem seed data
  return;
  var existing=cLoad();
  if(existing.length>0)return;
  var stages=gStages();
  var sEnviada=stages.find(function(s){return/enviada/i.test(s.label);})||{id:'s4'};
  var sFazer=stages.find(function(s){return/fazer/i.test(s.label);})||{id:'s3'};
  var sGanho=stages.find(function(s){return/ganho|won/i.test(s.label);})||{id:'s6'};
  var sPerdido=stages.find(function(s){return/perdido|lost/i.test(s.label);})||{id:'s7'};
  var sProsp=stages[0]||{id:'s1'};
  var now=new Date().toISOString();
  // Key data from ORÇAMENTOS_2026.xlsx — mapped by color:
  // azul claro (theme:8) = Proposta Enviada, verde (theme:9+FECHADO) = Fechado Ganho
  // branco (theme:0) = Fazer Orçamento, vermelho (theme:5) = Perdido, sem cor = Prospecção
  var seed=[
    {c:'FABIO RATTI',d:'2023-01-13',r:'Adalberto Fanderuff',o:'Weiku do Brasil',v:71409,l:1200,a:4850,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'SORAYA FAVILLA',d:'2024-05-21',r:'Thays (Comercial)',o:'Weiku do Brasil',v:70000,l:1349,a:5662,st:sGanho.id,ci:'INDAIATUBA',uf:'SP',md:'23'},
    {c:'SANDRA CURY',d:'2025-04-29',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:82020,l:2050,a:3000,st:sEnviada.id,ci:'VINHEDO',uf:'SP',md:'08'},
    {c:'SIDNEI E ELAINE',d:'2025-05-06',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:174000,l:2650,a:4500,st:sGanho.id,ci:'SANTANA DE PARNAÍBA',uf:'SP',md:'23'},
    {c:'ALEXANDRE E ERIKA',d:'2025-05-27',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:106637,l:1900,a:2500,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'BRUNO HENRIQUE DA SILVA',d:'2025-06-02',r:'Thays (Comercial)',o:'Weiku do Brasil',v:96000,l:2000,a:6500,st:sGanho.id,ci:'ARARAQUARA',uf:'SP',md:'15'},
    {c:'JULIANA WUSTRO',d:'2025-07-07',r:'Adriano Dorigon',o:'Weiku do Brasil',v:88326,l:2200,a:3400,st:sEnviada.id,ci:'CHAPECÓ',uf:'SC',md:'22'},
    {c:'BINO SCHMIDT',d:'2025-07-15',r:'Rubens A. Grando Postali (Elo Forte)',o:'Weiku do Brasil',v:0,l:1300,a:2800,st:sFazer.id,ci:'SEBERI',uf:'RS',md:'10'},
    {c:'EDUARDO ROBERTO E HEGLEN DREZZA',d:'2025-07-18',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:50213,l:1600,a:2850,st:sEnviada.id,ci:'JUNDIAÍ',uf:'SP',md:'01'},
    {c:'EDGAR PASQUALI',d:'2025-07-23',r:'Carina Ap. Kazahaya (KAR)',o:'Weiku do Brasil',v:117716,l:1500,a:5800,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ADRIANO DA SILVA PINHEIRO',d:'2025-09-03',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:72500,l:1500,a:3950,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'MARIANGELA SANTOS',d:'2025-09-19',r:'Luiz Severino Moretto',o:'Weiku do Brasil',v:48806,l:1260,a:2570,st:sEnviada.id,ci:'ITAPEVA',uf:'SP',md:'22'},
    {c:'ELEN E LEANDRO MARIN',d:'2025-10-01',r:'Ericson Venancio dos Santos',o:'Weiku do Brasil',v:89000,l:1750,a:4800,st:sGanho.id,ci:'PRESIDENTE PRUDENTE',uf:'SP',md:'23'},
    {c:'RODRIGO ANDREATTO',d:'2025-10-24',r:'Rubens A. Grando Postali (Elo Forte)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sFazer.id,ci:'',uf:'',md:''},
    {c:'ANDRIOS PASSOS',d:'2025-10-28',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:63811,l:1500,a:2153,st:sEnviada.id,ci:'SANTANA DE PARNAÍBA',uf:'SP',md:'23'},
    {c:'MARCIO PICCHI',d:'2025-11-27',r:'Thays (Comercial)',o:'Weiku do Brasil',v:91000,l:1800,a:5950,st:sGanho.id,ci:'BARUERI',uf:'SP',md:'01'},
    {c:'KRISTINA ELISABETH WOLTERS',d:'2025-12-11',r:'Marcelo Abarca de Oliveira',o:'Weiku do Brasil',v:49543,l:1400,a:3000,st:sFazer.id,ci:'JABOTICABAL',uf:'SP',md:'23'},
    {c:'MM ARQUITETURA',d:'2025-12-17',r:'Thays (Comercial)',o:'Weiku do Brasil',v:200000,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'GUTO SPINA',d:'2025-12-17',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:80000,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'LEO SANTANA',d:'2025-12-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'SUZANE RENIER',d:'2025-12-19',r:'Ronei de Jesus Lyra',o:'Weiku do Brasil',v:52000,l:1400,a:3500,st:sEnviada.id,ci:'',uf:'',md:'23'},
    {c:'ROSE E SERGIO PONTAROLLO',d:'2025-12-22',r:'Carina Ap. Kazahaya (KAR)',o:'Weiku do Brasil',v:85000,l:1700,a:4200,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'MHAMAD KAMEL FAYAD',d:'2025-12-23',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:120000,l:2100,a:5000,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ÉRICA FARDIN',d:'2025-12-23',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:55000,l:1400,a:2800,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'BRUNO DIAS ELIAS',d:'2025-12-23',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:95000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'FERNANDA E THIAGO ZAVIA',d:'2025-12-22',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:78000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'CLOVIS E GIANA',d:'2025-12-22',r:'Adriano Dorigon',o:'Weiku do Brasil',v:65000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'RESIDENCIA BRAUDE - WEIKU',d:'2025-12-22',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:130000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ANDREA E JUAN',d:'2025-12-22',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:60000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ROBERTO B LIMA',d:'2025-12-22',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:45000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'FABIO ARCARO KUHL',d:'2026-01-06',r:'Ericson Venancio dos Santos',o:'Weiku do Brasil',v:50000,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'MATHEUS BALDAN',d:'2026-01-08',r:'Rodrigo Aguiar Diniz',o:'Weiku do Brasil',v:129000,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'DÉBORA E SÉRGIO',d:'2026-01-06',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:75000,l:1500,a:3200,st:sPerdido.id,ci:'',uf:'',md:''},
    {c:'EDIR SOCCOL JUNIOR',d:'2025-12-26',r:'Adriano Dorigon',o:'Weiku do Brasil',v:45000,l:1300,a:2600,st:sPerdido.id,ci:'',uf:'',md:''},
    {c:'FABIANO E PRISCILA',d:'2026-01-07',r:'',o:'Direto',v:0,l:0,a:0,st:sFazer.id,ci:'',uf:'',md:''},
    {c:'GUILHERME E MARIANA DALZOTTO',d:'2026-01-03',r:'',o:'Direto',v:0,l:0,a:0,st:sFazer.id,ci:'',uf:'',md:''},
    {c:'DANILO DE SOUZA SANTOS',d:'2026-01-07',r:'',o:'Direto',v:0,l:0,a:0,st:sFazer.id,ci:'',uf:'',md:''},
    {c:'ADRIANO DORIGON (140966)',d:'2026-01-15',r:'Adriano Dorigon',o:'Weiku do Brasil',v:45182,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'DEMARRE - DESIGN STUDIO',d:'2026-01-20',r:'',o:'Direto',v:237310,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'MARINA LINA (LF)',d:'2026-01-08',r:'Luiz Fernando Starke',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'BERNARDO AMARAL',d:'2026-01-08',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'RESIDÊNCIA FÁBIO',d:'2026-01-08',r:'Gervásio Santa Rosa',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'RAPHAEL LARA',d:'2026-01-09',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'PRISCILA E LINEU',d:'2026-01-09',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'MERYANGELLI E ALEX',d:'2026-01-10',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ALESSANDRA E GUILHERME',d:'2026-01-10',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'LILIAN VIEIRA',d:'2026-01-10',r:'Carina Ap. Kazahaya (KAR)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'FRANCIELLE E GUSTAVO',d:'2026-01-10',r:'',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'VALTER LUIZ MOREIRA DE RESENDE',d:'2026-01-10',r:'Luiz Severino Moretto',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'NEWTON BRIÃO MARQUES',d:'2026-01-10',r:'Gervásio Santa Rosa',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'BIANCA OLIVEIRA DE SOUZA',d:'2026-01-14',r:'Carina Ap. Kazahaya (KAR)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'IGOR E EMMELYN',d:'2026-01-14',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'CARLOS FRAGOSO',d:'2026-01-14',r:'Márcio Daniel Gnigler (MDG)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ISAIAS ROSA RAMOS JUNIOR',d:'2026-01-16',r:'Adalberto Fanderuff',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'MARIA TEREZA H. RIBEIRO',d:'2026-01-16',r:'Adalberto Fanderuff',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'WEIKU DOURADOS',d:'2026-01-17',r:'Primeira Linha MS',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'DOURADOS',uf:'MS',md:''},
    {c:'LUCAS GARBULHA DE CASTRO',d:'2026-01-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'DIANA LOPES',d:'2026-01-17',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'CARLOS ANTÔNIO DA SILVA',d:'2026-01-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'RODRIGO DE OLIVEIRA KATAYAMA',d:'2026-01-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'LEONICE ALVES',d:'2026-01-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
  ];
  var data=[];
  seed.forEach(function(s){
    data.push({
      id:uuid(),cliente:s.c,contato:'',produto:s.md?'Porta ACM Modelo '+s.md:'Porta ACM',
      responsavel:'',origem:s.o,wrep:s.r,valor:s.v,
      fechamento:'',prioridade:'normal',notas:'Importado da planilha ORÇAMENTOS 2026',
      largura:s.l,altura:s.a,abertura:'',modelo:s.md,cep:'',
      scope:'nacional',cidade:s.ci,estado:s.uf,pais:'',
      stage:s.st,createdAt:s.d+'T00:00:00.000Z',updatedAt:now,anexos:[]
    });
  });
  cSave(data);
}

document.addEventListener('DOMContentLoaded',function(){
  var _crmJustCleared=false;
  // CLEAR FLAG removido permanentemente — nunca mais apagar dados automaticamente

  // Seed data if empty (desativado)
  crmSeedIfEmpty();

  // Migration: ensure "Orçamento Pronto" stage exists
  var s=gS();var st=s.stages||[];
  if(st.length>0&&!st.find(function(x){return x.id==='s3b'||/pronto/i.test(x.label);})){
    var idx=st.findIndex(function(x){return/fazer/i.test(x.label);});
    if(idx>=0)st.splice(idx+1,0,{id:'s3b',label:'Orçamento Pronto',color:'#f39c12',icon:'📧'});
    else st.splice(3,0,{id:'s3b',label:'Orçamento Pronto',color:'#f39c12',icon:'📧'});
    s.stages=st;sS(s);
  }
  if(st.length>0){var old=st.find(function(x){return x.id==='s3b'&&(/enviar.*or/i.test(x.label)||/feito/i.test(x.label))&&!/pronto/i.test(x.label);});if(old){old.label='Orçamento Pronto';s.stages=st;sS(s);}}

  // Migration: add Weiku do Brasil to origins if missing
  var ors=s.origins||[];
  if(ors.length>0&&!ors.find(function(x){return x==='Weiku do Brasil';})){
    var wi=ors.indexOf('Representante Weiku');
    if(wi>=0)ors[wi]='Weiku do Brasil'; else ors.unshift('Weiku do Brasil');
    s.origins=ors;sS(s);
  }

  // Migrate existing cards: Representante Weiku → Weiku do Brasil
  if(!_crmJustCleared){
    var data=cLoad();var changed=false;
    data.forEach(function(o){if(o.origem==='Representante Weiku'){o.origem='Weiku do Brasil';changed=true;}});
    if(changed)cSave(data);
  }

  // Migrate: limpar campos dependentes de origem que ficaram sujos (cards antigos)
  //   wrep só faz sentido se origem='Weiku do Brasil'
  //   parceiro_nome só faz sentido se origem='Parceiro'
  if(!_crmJustCleared){
    var data2=cLoad();var changed2=false;
    data2.forEach(function(o){
      if(o.wrep && o.origem!=='Weiku do Brasil'){ o.wrep=''; changed2=true; }
      if(o.parceiro_nome && o.origem!=='Parceiro'){ o.parceiro_nome=''; changed2=true; }
    });
    if(changed2){
      cSave(data2);
      console.log('[CRM migrate] Limpos campos wrep/parceiro_nome inconsistentes com origem');
    }
  }

  // Helper: merge cloud data
  function mergeCloudLocal(cloudDb){
    var local=cLoad();
    var localMap={};local.forEach(function(o){if(o.id)localMap[o.id]=o;});
    return cloudDb.map(function(co){
      var lo=localMap[co.id];
      if(lo&&lo.anexos&&lo.anexos.length>0){co.anexos=lo.anexos;}
      if(lo&&lo.dataContato&&!co.dataContato){co.dataContato=lo.dataContato;}
      return co;
    });
  }

  // Skip cloud sync if we just cleared — render empty CRM
  if(_crmJustCleared){
    crmRender();
  } else {
    // Load settings from cloud
    var SB='https://plmliavuwlgpwaizfeds.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
    fetch(SB+'/rest/v1/configuracoes?chave=eq.'+SK+'&select=valor&limit=1',{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}})
      .then(function(r){return r.json();}).then(function(rows){if(rows&&rows.length&&rows[0].valor&&rows[0].valor.data){sS(rows[0].valor.data);}}).catch(function(){});

    // ★ Sync bidirecional (Felipe 23/04): hidrata localStorage a partir da tabela
    //   relacional crm_oportunidades + crm_revisoes ANTES de ler o blob legado.
    //   Isso garante que edições diretas no Supabase (MCP/SQL) sempre chegam no app.
    //   Se hydrateLocal falhar (offline ou tabela vazia), cai no cCloudLoad (blob).
    var _hydratedOK = false;
    var _hydratePromise = (window.crmDB && typeof window.crmDB.hydrateLocal==='function')
      ? window.crmDB.hydrateLocal({rerender:false, verbose:true}).then(function(opps){
          if(opps && opps.length>0){ _hydratedOK = true; }
          return opps;
        })
      : Promise.resolve(null);

    _hydratePromise.then(function(){
      // Se hydrate funcionou, já temos dados frescos em localStorage — renderiza direto.
      // Senão (fallback), usa o blob legado via cCloudLoad.
      if(_hydratedOK){
        crmRender();
      } else {
        // Load CRM data from cloud (blob legado)
        cCloudLoad(function(val){
          if(val&&val.db&&val.db.length>0){
            var local=cLoad();
            if(val.db.length>=local.length){
              var merged=mergeCloudLocal(val.db);
              localStorage.setItem(CK,JSON.stringify(merged));
            }
          }
          crmRender();
        });
      }
    });
  }

  // ★ Felipe 23/04: Poll de sincronização entre devices/tabs.
  //   Se hydrateLocal funcionou (tabela relacional OK), usa ela como fonte de
  //   verdade — evita que o blob legado (cCloudLoad) traga cards já deletados
  //   no Supabase e sobrescreva o localStorage (bug do "card fantasma que
  //   aparece e some" no F5). Fallback pro cCloudLoad só quando relacional
  //   falha (offline ou tabela vazia).
  var _lastTs=null;
  var _lastHydrateHash=null;
  setInterval(function(){
    if(_crmJustCleared) return; // Don't re-import during clear session
    if(_hydratedOK && window.crmDB && typeof window.crmDB.hydrateLocal==='function'){
      // Polling via tabela relacional (fonte de verdade)
      window.crmDB.hydrateLocal({rerender:false, verbose:false}).then(function(opps){
        if(!opps) return;
        // Hash simples pra detectar mudanças e evitar re-render desnecessário
        var h = opps.length+':'+opps.map(function(o){return (o.id||'')+(o.updatedAt||'');}).join(',');
        if(h !== _lastHydrateHash){
          _lastHydrateHash = h;
          crmRender();
        }
      }).catch(function(){});
    } else {
      // Fallback: blob legado (só se relacional falhou)
      cCloudLoad(function(val){
        if(!val||val.ts===_lastTs){if(!_lastTs&&val)_lastTs=val.ts;return;}
        _lastTs=val.ts;
        if(val.db){
          var merged=mergeCloudLocal(val.db);
          localStorage.setItem(CK,JSON.stringify(merged));
          crmRender();
        }
      });
    }
  },5000);
});

})(); /* end CRM final */

/* ══ END MODULE: CRM ══ */

/* ══ MODULE: MESSAGING ══ */
/* ── NÃO EDITE OUTROS MÓDULOS AO ALTERAR ESTE ── */
/* ── Mensagem padrão + envio WhatsApp/Email ── */
var _MSG_KEY='projetta_msg_padrao';
function _getMsgPadrao(){
  try{var s=localStorage.getItem(_MSG_KEY);if(s)return s;}catch(e){}
  var el=document.getElementById('msg-padrao-texto');
  return el?el.value:'';
}
function salvarMsgPadrao(){
  var el=document.getElementById('msg-padrao-texto');
  if(!el)return;
  try{localStorage.setItem(_MSG_KEY,el.value);}catch(e){}
  var s=document.getElementById('msg-padrao-saved');
  if(s){s.style.display='inline';setTimeout(function(){s.style.display='none';},2000);}
}
function _carregarMsgPadrao(){
  var saved=null;
  try{saved=localStorage.getItem(_MSG_KEY);}catch(e){}
  // Reset if old format (missing new tokens)
  if(saved && (saved.indexOf('{cliente}')<0 || saved.indexOf('{detalhes}')<0 || saved.indexOf('{instalacao}')<0)){
    try{localStorage.removeItem(_MSG_KEY);}catch(e){}
    saved=null;
  }
  if(saved){var el=document.getElementById('msg-padrao-texto');if(el)el.value=saved;}
}
document.addEventListener('DOMContentLoaded',_carregarMsgPadrao);

function _buildMsg(){
  var msg=_getMsgPadrao();
  var cliente=(document.getElementById('crm-o-cliente')||{}).value||'';
  var produto=(document.getElementById('crm-o-produto')||{}).value||'';
  var valorEl=document.getElementById('crm-o-valor');
  var valor=valorEl&&valorEl.value?'R$ '+_fmtBRLCeil(valorEl.value):'—';
  // Details from budget
  var larg=(document.getElementById('largura')||{}).value||(document.getElementById('crm-o-largura')||{}).value||'';
  var alt=(document.getElementById('altura')||{}).value||(document.getElementById('crm-o-altura')||{}).value||'';
  var modSel=document.getElementById('carac-modelo');
  var modelo=modSel&&modSel.selectedIndex>0?modSel.options[modSel.selectedIndex].text:'';
  var folhasSel=document.getElementById('carac-folhas');
  var folhas=folhasSel&&folhasSel.selectedIndex>0?folhasSel.options[folhasSel.selectedIndex].text:'';
  var detalhes='';
  if(larg||alt||modelo||folhas){
    detalhes='*Detalhes do Projeto:*';
    if(larg&&alt) detalhes+='\n• Dimensões: '+larg+' × '+alt+' mm';
    if(modelo) detalhes+='\n• Modelo: '+modelo;
    if(folhas) detalhes+='\n• Folhas: '+folhas;
  }
  // Installation location from CRM or budget
  var cep=(document.getElementById('crm-o-cep')||{}).value||(document.getElementById('cep-cliente')||{}).value||'';
  var cidadeEl=document.getElementById('crm-o-cidade-nac');
  var cidade=cidadeEl?cidadeEl.value:'';
  if(!cidade){var cEl=document.getElementById('cep-cidade');if(cEl)cidade=cEl.textContent||'';}
  var estadoEl=document.getElementById('crm-o-estado');
  var estado=estadoEl&&estadoEl.value?estadoEl.value:'';
  var instalacao='';
  if(cep||cidade||estado){
    instalacao='*Local de Instalação:*';
    if(cidade) instalacao+='\n• Cidade: '+cidade+(estado?' - '+estado:'');
    if(cep) instalacao+='\n• CEP: '+cep;
  }
  // Replace ALL tokens — only what's in the template gets sent
  msg=msg.replace(/\{cliente\}/gi,cliente)
         .replace(/\{produto\}/gi,produto)
         .replace(/\{valor\}/gi,valor)
         .replace(/\{detalhes\}/gi,detalhes)
         .replace(/\{instalacao\}/gi,instalacao);
  return msg;
}

var _cachedPdfBlob=null,_cachedPdfName='';

function _gerarPropostaPDF(cb){
  // Always populate proposta data before capturing
  if(typeof populateProposta==='function')populateProposta();
  var pages=document.querySelectorAll('.proposta-page');
  if(!pages.length){alert('Nenhuma proposta encontrada. Gere o orçamento primeiro.');return;}
  var tab=document.getElementById('tab-proposta');
  var wasHidden=!tab.classList.contains('on');
  if(wasHidden){tab.style.display='block';tab.style.position='absolute';tab.style.left='-9999px';}
  var jsPDF=window.jspdf.jsPDF;
  var pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  var pIdx=0;
  function next(){
    if(pIdx>=pages.length){
      if(wasHidden){tab.style.display='';tab.style.position='';tab.style.left='';}
      var blob=pdf.output('blob');
      _cachedPdfBlob=blob;_cachedPdfName=_pdfFileName();
      cb(pdf,blob);return;
    }
    var pg=pages[pIdx];
    html2canvas(pg,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false}).then(function(canvas){
      var imgData=canvas.toDataURL('image/jpeg',0.92);
      var w=210,h=canvas.height*w/canvas.width;
      if(pIdx>0)pdf.addPage();
      pdf.addImage(imgData,'JPEG',0,0,w,h);
      pIdx++;next();
    }).catch(function(){pIdx++;next();});
  }
  next();
}

function _pdfFileName(){
  var agp=(document.getElementById('num-agp')||document.getElementById('crm-o-agp')||{value:''}).value||'';
  var reserva=(document.getElementById('numprojeto')||document.getElementById('crm-o-reserva')||{value:''}).value||'';
  var cl=_getBestClientName();
  var parts=[agp,reserva,cl].filter(Boolean);
  var name=parts.join(' - ').replace(/[^a-zA-Z0-9\u00C0-\u017F \-]/g,'').replace(/ +/g,' ').trim();
  return (name||'Proposta_Projetta')+'.pdf';
}

// Fonte unificada do nome do cliente (usada por PDF e PNG)
function _getBestClientName(){
  // 0. Override global (usado quando PDF+PNG gerados juntos)
  if(window._pdfClienteOverride) return window._pdfClienteOverride;
  // 1. Se tem card CRM vinculado, usar nome do card (mais confiável)
  if(window._crmOrcCardId){
    try{
      var data=JSON.parse(localStorage.getItem('projetta_crm_v1')||'[]');
      var card=data.find(function(o){return o.id===window._crmOrcCardId;});
      if(card&&card.cliente) return card.cliente;
    }catch(e){}
  }
  // 2. Campo CRM modal (se aberto)
  var crmCli=(document.getElementById('crm-o-cliente')||{value:''}).value;
  if(crmCli) return crmCli;
  // 3. Campo orçamento
  return (document.getElementById('cliente')||{value:''}).value||'';
}

function _showToast(msg,color){
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;color:#fff;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,.3);font-family:Montserrat,sans-serif;background:'+(color||'#27ae60');
  t.textContent=msg;document.body.appendChild(t);
  setTimeout(function(){t.style.opacity='0';t.style.transition='opacity .4s';setTimeout(function(){t.remove();},500);},3500);
}

function _onStageOrcamentoPronto(){
  _showToast('\u23F3 Gerando PDF da proposta...','#e67e22');
  // Garantir cálculo atualizado antes de gerar proposta
  if(typeof calc==='function') calc();
  setTimeout(function(){
    _gerarPropostaPDF(function(pdf,blob){
      pdf.save(_pdfFileName());
      _showToast('\u2705 PDF da proposta gerado e baixado!','#27ae60');
    });
  },500);
}

function crmEnviarWhatsApp(){
  var tel=(document.getElementById('crm-o-contato')||{}).value||'';
  tel=tel.replace(/\D/g,'');
  if(!tel){alert('Preencha o n\u00famero de WhatsApp.');return;}
  if(tel.length<=11)tel='55'+tel;
  var msg=_buildMsg();
  window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(msg),'_blank');
}

function crmEnviarEmail(){
  var email=(document.getElementById('crm-o-email')||{}).value||'';
  if(!email||email.indexOf('@')<0){alert('Preencha o email do cliente.');return;}
  var cliente=(document.getElementById('crm-o-cliente')||{}).value||'Cliente';
  var msg=_buildMsg();
  var subject='Proposta Comercial \u2014 Projetta by Weiku \u2014 '+cliente;
  window.open('mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(msg),'_blank');
}
/* ══ END MODULE: MESSAGING ══ */

/* ══ RELATÓRIO POR REPRESENTANTE/GERENTE ══ */
window.crmGerarRelatorio=function(){
  try{
  var fGer=((document.getElementById('crm-f-gerente-filter')||{}).value||'');
  var fWrep=((document.getElementById('crm-f-wrep-filter')||{}).value||'');
  var fReg=((document.getElementById('crm-f-regiao-filter')||{}).value||'');
  var fResp=((document.getElementById('crm-f-resp-filter')||{}).value||'');
  if(!fGer&&!fWrep&&!fReg&&!fResp){alert('Selecione um filtro no pipeline (Gerente, Representante ou Região) antes de gerar o relatório.');return;}
  var titulo=fWrep||fGer||fReg||fResp||'Geral';

  var data=(function(){try{return JSON.parse(localStorage.getItem('projetta_crm_v1'))||[];}catch(e){return[];}})();
  var stages=(function(){try{var s=JSON.parse(localStorage.getItem('projetta_crm_settings_v1'))||{};return(s.stages||[]).length?s.stages:[{id:'s2',label:'Qualificação',color:'#3498db',icon:'🔍'},{id:'s3',label:'Fazer Orçamento',color:'#e67e22',icon:'📋'},{id:'s3b',label:'Orçamento Pronto',color:'#f39c12',icon:'📧'},{id:'s4',label:'Proposta Enviada',color:'#9b59b6',icon:'📩'},{id:'s5',label:'Negociação',color:'#f1c40f',icon:'💬'},{id:'won',label:'Fechado Ganho',color:'#27ae60',icon:'🏆'}];}catch(e){return[];}})();
  // Filtrar cards usando mesma lógica do pipeline
  var filtered=data.filter(function(o){
    if(o.stage==='lost')return false;
    if(fResp&&(o.responsavel||'')!==fResp)return false;
    if(fWrep&&(o.wrep||'')!==fWrep)return false;
    if(fGer){var oreg=typeof getRepRegiao==='function'?getRepRegiao(o.wrep):'';var ger=typeof getGerenteDaRegiao==='function'?getGerenteDaRegiao(oreg):'';if(ger!==fGer)return false;}
    if(fReg){var oreg2=typeof getRepRegiao==='function'?getRepRegiao(o.wrep):'';if(fReg.length<=5?!oreg2.startsWith(fReg):oreg2!==fReg)return false;}
    return true;
  });

  // Agrupar por etapa
  var grupos={};stages.forEach(function(s){grupos[s.id]={label:s.label,icon:s.icon||'',cards:[]};});
  filtered.forEach(function(o){if(grupos[o.stage])grupos[o.stage].cards.push(o);});

  // Calcular totais
  var totalCards=filtered.length;
  var totalValor=0,totalTab=0,totalFat=0;
  filtered.forEach(function(o){
    totalValor+=(o.valor||0);
    totalTab+=(o.valorTabela||((o.revisoes&&o.revisoes.length)?o.revisoes[o.revisoes.length-1].valorTabela:0)||o.valor||0);
    totalFat+=(o.valorFaturamento||((o.revisoes&&o.revisoes.length)?o.revisoes[o.revisoes.length-1].valorFaturamento:0)||0);
  });

  // Gerar HTML do relatório
  var brl=function(v){return'R$ '+_fmtBRLCeil(v);};
  var _esc=function(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;};
  var hoje=new Date().toLocaleDateString('pt-BR');
  var h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório '+titulo+' — '+hoje+'</title>';
  h+='<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#333;padding:20px}';
  h+='.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1a5276;padding-bottom:10px}';
  h+='.header h1{font-size:16px;color:#1a5276}.header .sub{font-size:11px;color:#666;margin-top:4px}';
  h+='.kpis{display:flex;gap:12px;margin-bottom:16px;justify-content:center}';
  h+='.kpi{background:#f5f5f5;border-radius:6px;padding:8px 16px;text-align:center;border-left:3px solid #1a5276}';
  h+='.kpi .v{font-size:16px;font-weight:800;color:#1a5276}.kpi .l{font-size:9px;color:#888;text-transform:uppercase}';
  h+='.stage{margin-bottom:14px;page-break-inside:avoid}.stage-hdr{background:#1a5276;color:#fff;padding:6px 12px;font-size:12px;font-weight:700;border-radius:4px 4px 0 0;display:flex;justify-content:space-between}';
  h+='table{width:100%;border-collapse:collapse}th{background:#f0f0f0;padding:4px 6px;text-align:left;font-size:9px;text-transform:uppercase;border-bottom:1px solid #ddd}';
  h+='td{padding:4px 6px;border-bottom:1px solid #eee;font-size:10px}tr:nth-child(even){background:#fafafa}';
  h+='.val{text-align:right;font-weight:700;color:#1a5276}.tot{text-align:right;font-weight:800;font-size:11px;color:#1a5276;padding:6px}';
  h+='@media print{body{padding:10px}.stage{page-break-inside:avoid}}</style></head><body>';

  h+='<div class="header"><h1>📋 Relatório Pipeline — '+titulo+'</h1>';
  h+='<div class="sub">Projetta Alumínio · Gerado em '+hoje+'</div></div>';

  h+='<div class="kpis">';
  h+='<div class="kpi"><div class="v">'+totalCards+'</div><div class="l">Oportunidades</div></div>';
  h+='<div class="kpi"><div class="v">'+brl(totalTab)+'</div><div class="l">Total Tabela</div></div>';
  h+='<div class="kpi" style="border-color:#e67e22"><div class="v" style="color:#e67e22">'+brl(totalFat)+'</div><div class="l">Total Faturamento</div></div>';
  h+='</div>';

  stages.forEach(function(s){
    var g=grupos[s.id];if(!g||!g.cards.length)return;
    var stVal=0;g.cards.forEach(function(c){stVal+=(c.valor||0);});
    h+='<div class="stage">';
    h+='<div class="stage-hdr"><span>'+(g.icon||'')+' '+g.label+' ('+g.cards.length+')</span><span>'+brl(stVal)+'</span></div>';
    h+='<table><thead><tr><th>Cliente</th><th>Produto</th><th>Medidas</th><th>Rep</th><th>Cidade</th><th>Reserva</th><th>AGP</th><th style="text-align:right">Tabela</th><th style="text-align:right">Faturamento</th></tr></thead><tbody>';
    g.cards.sort(function(a,b){return(b.valor||0)-(a.valor||0);});
    var stTab=0,stFat=0;
    g.cards.forEach(function(c){
      var dims=(c.largura&&c.altura)?(c.largura+'×'+c.altura):'';
      var vTab=c.valorTabela||((c.revisoes&&c.revisoes.length)?c.revisoes[c.revisoes.length-1].valorTabela:0)||c.valor||0;
      var vFat=c.valorFaturamento||((c.revisoes&&c.revisoes.length)?c.revisoes[c.revisoes.length-1].valorFaturamento:0)||0;
      stTab+=vTab;stFat+=vFat;
      h+='<tr><td style="font-weight:700">'+_esc(c.cliente||'')+'</td>';
      h+='<td>'+_esc(c.produto||'')+'</td>';
      h+='<td>'+dims+'</td>';
      h+='<td>'+_esc((c.wrep||'').split('(')[0].trim().split(' ').slice(0,2).join(' '))+'</td>';
      h+='<td>'+_esc(c.cidade||'')+'</td>';
      h+='<td>'+_esc(c.reserva||'')+'</td>';
      h+='<td>'+_esc(c.agp||'')+'</td>';
      h+='<td class="val">'+brl(vTab)+'</td>';
      h+='<td class="val" style="color:#e67e22">'+brl(vFat)+'</td></tr>';
    });
    h+='<tr><td colspan="7" class="tot">Subtotal '+g.label+'</td><td class="tot">'+brl(stTab)+'</td><td class="tot" style="color:#e67e22">'+brl(stFat)+'</td></tr>';
    h+='</tbody></table></div>';
  });

  h+='<div style="margin-top:20px;text-align:center;font-size:9px;color:#999">Projetta Alumínio by Weiku do Brasil — relatório automático</div>';
  h+='</body></html>';

  var w=window.open('','_blank','width=900,height=700');
  if(!w){alert('Popup bloqueado! Permita popups para gerar o relatório.');return;}
  w.document.write(h);w.document.close();
  setTimeout(function(){try{w.print();}catch(e){}},500);
  }catch(err){alert('Erro ao gerar relatório: '+err.message);console.error(err);}
};
