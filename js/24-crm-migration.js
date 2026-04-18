/**
 * 24-crm-migration.js
 * Migration: blob projetta_crm_v1 (configuracoes) → tabelas relacionais
 *
 * Executar UMA VEZ após rodar sql/crm_schema.sql no Supabase.
 *
 * Uso (no console do navegador ou via botão UI):
 *   crmMigration.run()         // migra tudo
 *   crmMigration.dryRun()      // só relatório, não escreve
 *   crmMigration.verify()      // compara contagens
 *
 * Seguro: idempotente (upsert por PK). Pode rodar várias vezes.
 */
(function(){
'use strict';

var SB  = 'https://plmliavuwlgpwaizfeds.supabase.co';
var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
var H   = {apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'};

function log(msg, color){
  console.log('%c[migration] '+msg, 'color:'+(color||'#003144')+';font-weight:700');
}

async function _loadLegacyBlob(){
  var r=await fetch(SB+'/rest/v1/configuracoes?chave=eq.projetta_crm_v1&select=valor&limit=1',{headers:H});
  var j=await r.json();
  if(!j||!j[0]||!j[0].valor||!j[0].valor.db){throw new Error('Blob legado projetta_crm_v1 não encontrado');}
  return j[0].valor.db;
}

async function _loadLegacySettings(){
  var r=await fetch(SB+'/rest/v1/configuracoes?chave=eq.projetta_crm_settings_v1&select=valor&limit=1',{headers:H});
  var j=await r.json();
  return j&&j[0]?(j[0].valor||{}):{};
}

function _oppToRow(o){
  return {
    id:o.id,
    cliente:o.cliente||'Cliente '+o.id,
    scope:o.scope||'nacional',
    pais:o.pais||null, estado:o.estado||null, cidade:o.cidade||null, cep:o.cep||null,
    telefone:o.telefone||null, email:o.email||null, endereco:o.endereco||null,
    stage:o.stage||'s2',
    origem:o.origem||null, produto:o.produto||null, responsavel:o.responsavel||null,
    wrep:o.wrep||null, prioridade:o.prioridade||null, potencial:o.potencial||null,
    largura: _num(o.largura), altura:_num(o.altura),
    abertura:o.abertura||null, modelo:o.modelo||null, folhas:_int(o.folhas),
    reserva:o.reserva||null, agp:o.agp||null,
    valor:_num(o.valor)||0,
    valor_tabela:_num(o.valorTabela)||0,
    valor_faturamento:_num(o.valorFaturamento)||0,
    data_contato:o.dataContato||null, fechamento:o.fechamento||null, previsao:o.previsao||null,
    rev_pipeline:_int(o.revPipeline),
    notas:o.notas||null,
    extras: _buildExtras(o),
    created_at:o.createdAt||new Date().toISOString(),
    updated_at:o.updatedAt||o.createdAt||new Date().toISOString()
  };
}
function _buildExtras(o){
  var known={id:1,cliente:1,scope:1,pais:1,estado:1,cidade:1,cep:1,telefone:1,email:1,endereco:1,
    stage:1,origem:1,produto:1,responsavel:1,wrep:1,prioridade:1,potencial:1,
    largura:1,altura:1,abertura:1,modelo:1,folhas:1,reserva:1,agp:1,
    valor:1,valorTabela:1,valorFaturamento:1,
    dataContato:1,fechamento:1,previsao:1,revPipeline:1,notas:1,
    revisoes:1,anexos:1,createdAt:1,updatedAt:1};
  var ext={};
  Object.keys(o||{}).forEach(function(k){if(!known[k])ext[k]=o[k];});
  // Anexos inline (base64 pequeno legado) são preservados em extras.anexos_legacy
  if(o.anexos&&o.anexos.length) ext.anexos_legacy=o.anexos;
  return ext;
}
function _num(v){if(v==null||v==='')return null;var n=Number(v);return isNaN(n)?null:n;}
function _int(v){if(v==null||v==='')return null;var n=parseInt(v,10);return isNaN(n)?null:n;}

async function _upsertBatch(url, rows, prefer){
  if(!rows.length)return 0;
  var chunk=100;
  var total=0;
  for(var i=0;i<rows.length;i+=chunk){
    var slice=rows.slice(i,i+chunk);
    var r=await fetch(SB+url,{
      method:'POST',
      headers:Object.assign({},H,{'Prefer':prefer||'resolution=merge-duplicates,return=minimal'}),
      body:JSON.stringify(slice)
    });
    if(!r.ok){var t=await r.text();throw new Error('HTTP '+r.status+': '+t);}
    total+=slice.length;
    log('  + '+total+'/'+rows.length, '#888');
  }
  return total;
}

async function run(opts){
  opts=opts||{};
  var dry=!!opts.dryRun;
  log('═══ MIGRATION START'+(dry?' (DRY-RUN)':'')+' ═══', '#003144');

  // 1. Carregar blob legado
  var db=await _loadLegacyBlob();
  log('Blob legado: '+db.length+' oportunidades');

  // 2. Preparar rows
  var oppRows=db.map(_oppToRow);
  var revRows=[];
  var revCount=0;
  db.forEach(function(o){
    if(o.revisoes&&o.revisoes.length){
      o.revisoes.forEach(function(rv,idx){
        revCount++;
        revRows.push({
          opp_id:o.id,
          rev_num:(rv.rev!=null?rv.rev:idx),
          label:rv.label||(idx===0?'Original':'Revisão '+idx),
          data:rv.data||o.createdAt||new Date().toISOString(),
          valor_tabela:_num(rv.valorTabela)||0,
          valor_faturamento:_num(rv.valorFaturamento)||0,
          snapshot:rv.snapshot||null,
          pdf_cloud:rv.pdfCloud||null,
          pdf_pages:rv.pdfPages||null,
          crm_pronto:!!rv.crmPronto,
          created_by:'migration'
        });
      });
    }
  });
  log('Revisões: '+revCount);

  // 3. Configs (stages, origins, products, team, wreps)
  var cfg=await _loadLegacySettings();
  var cfgRows=[];
  ['stages','origins','products','team','wreps'].forEach(function(k){
    if(cfg[k]) cfgRows.push({chave:k, valor:cfg[k], updated_by:'migration'});
  });

  if(dry){
    log('── DRY RUN: nada escrito ──', '#e67e22');
    return {oportunidades:oppRows.length, revisoes:revRows.length, config:cfgRows.length, dry:true};
  }

  // 4. Escrever
  log('→ Upsert crm_oportunidades...');
  await _upsertBatch('/rest/v1/crm_oportunidades', oppRows);

  log('→ Upsert crm_revisoes...');
  await _upsertBatch('/rest/v1/crm_revisoes?on_conflict=opp_id,rev_num', revRows);

  if(cfgRows.length){
    log('→ Upsert crm_config...');
    await _upsertBatch('/rest/v1/crm_config', cfgRows);
  }

  // 5. Evento de auditoria
  await fetch(SB+'/rest/v1/crm_eventos',{
    method:'POST', headers:Object.assign({},H,{'Prefer':'return=minimal'}),
    body:JSON.stringify({tipo:'migration', descricao:'Migration blob→relacional: '+oppRows.length+' opps, '+revRows.length+' revs', user_name:'migration'})
  });

  log('═══ MIGRATION OK: '+oppRows.length+' opps, '+revRows.length+' revs, '+cfgRows.length+' configs ═══', '#27ae60');
  return {oportunidades:oppRows.length, revisoes:revRows.length, config:cfgRows.length};
}

async function dryRun(){return run({dryRun:true});}

async function verify(){
  log('═══ VERIFY ═══', '#003144');
  var blob=await _loadLegacyBlob();
  async function cnt(t,f){
    var r=await fetch(SB+'/rest/v1/'+t+'?select=id&limit=1'+(f?'&'+f:''),{headers:Object.assign({},H,{'Prefer':'count=exact'})});
    var range=r.headers.get('content-range')||'';
    return parseInt(range.split('/')[1]||'0',10);
  }
  var blobRevs=0;blob.forEach(function(o){if(o.revisoes)blobRevs+=o.revisoes.length;});
  var r={
    blob_opps:blob.length,
    blob_revs:blobRevs,
    sql_opps: await cnt('crm_oportunidades','deleted_at=is.null'),
    sql_revs: await cnt('crm_revisoes',null),
    sql_events: await cnt('crm_eventos',null)
  };
  console.table(r);
  var ok=r.sql_opps>=r.blob_opps && r.sql_revs>=r.blob_revs;
  log(ok?'✅ CONSISTENTE':'⚠️ FALTAM DADOS — rode run() novamente', ok?'#27ae60':'#e74c3c');
  return r;
}

window.crmMigration = {run:run, dryRun:dryRun, verify:verify};
console.log('✓ crmMigration pronto. Use: crmMigration.dryRun() → crmMigration.run() → crmMigration.verify()');
})();
