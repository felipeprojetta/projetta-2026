/**
 * 23-crm-db.js
 * Module: CRM-DB (Camada de acesso profissional)
 *
 * Arquitetura:
 *  - Dual-write: local + Supabase (tabelas relacionais) + blob legado (fallback)
 *  - Writes granulares: só oportunidade/revisão tocada, não o DB inteiro
 *  - Audit automático: cada mudança vira event em crm_eventos
 *  - Anexos: upload pro Storage, metadados em crm_anexos
 *  - Backward-compatible: cSave(d) antigo continua funcionando e chama esta camada
 *
 * NÃO TOQUE no fluxo de snapshot (captureSnapshot, _salvarSnapshotECRM) —
 * essa camada só persiste, não muda como os dados são capturados.
 */
(function(){
'use strict';

var SB  = 'https://plmliavuwlgpwaizfeds.supabase.co';
var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
var H   = {'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};

var CK_OLD = 'projetta_crm_v1';
var SNAP_KEY = '_crmDB_lastSnapshot';   // compara versões pra detectar mudanças

/* ─────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────── */
function _currentUser(){
  try{
    var u=JSON.parse(localStorage.getItem('projetta_current_user')||'{}');
    return {name:u.name||u.username||u.email||'anon', email:u.email||''};
  }catch(e){return {name:'anon',email:''};}
}
function _fetch(url, opts){
  opts=opts||{};
  opts.headers=Object.assign({},H,opts.headers||{});
  return fetch(SB+url, opts).then(function(r){
    if(!r.ok) return r.text().then(function(t){throw new Error('HTTP '+r.status+': '+t);});
    return r.status===204 ? null : r.json().catch(function(){return null;});
  });
}

function _oppToRow(o){
  // Converte formato legado (blob) pra linha em crm_oportunidades
  return {
    id: o.id,
    cliente: o.cliente||'',
    scope: o.scope||'nacional',
    pais: o.pais||null,
    estado: o.estado||null,
    cidade: o.cidade||null,
    cep: o.cep||null,
    telefone: o.telefone||null,
    email: o.email||null,
    endereco: o.endereco||null,
    stage: o.stage||'s2',
    origem: o.origem||null,
    produto: o.produto||null,
    responsavel: o.responsavel||null,
    wrep: o.wrep||null,
    prioridade: o.prioridade||null,
    potencial: o.potencial||null,
    largura: _num(o.largura),
    altura: _num(o.altura),
    abertura: o.abertura||null,
    modelo: o.modelo||null,
    folhas: _int(o.folhas),
    reserva: o.reserva||null,
    agp: o.agp||null,
    valor: _num(o.valor)||0,
    valor_tabela: _num(o.valorTabela)||0,
    valor_faturamento: _num(o.valorFaturamento)||0,
    data_contato: o.dataContato||null,
    fechamento: o.fechamento||null,
    previsao: o.previsao||null,
    rev_pipeline: _int(o.revPipeline),
    notas: o.notas||null,
    extras: _buildExtras(o),
    updated_at: new Date().toISOString(),
    updated_by: _currentUser().name
  };
}
function _rowToOpp(r, revisoes){
  // Converte linha + revisões no formato legado (para compatibilidade com UI existente)
  var ext=r.extras||{};
  var o={
    id:r.id, cliente:r.cliente, scope:r.scope, pais:r.pais, estado:r.estado, cidade:r.cidade,
    cep:r.cep, telefone:r.telefone, email:r.email, endereco:r.endereco,
    stage:r.stage, origem:r.origem, produto:r.produto, responsavel:r.responsavel,
    wrep:r.wrep, prioridade:r.prioridade, potencial:r.potencial,
    largura:r.largura, altura:r.altura, abertura:r.abertura, modelo:r.modelo,
    folhas:r.folhas, reserva:r.reserva, agp:r.agp,
    valor:Number(r.valor)||0,
    valorTabela:Number(r.valor_tabela)||0,
    valorFaturamento:Number(r.valor_faturamento)||0,
    dataContato:r.data_contato, fechamento:r.fechamento, previsao:r.previsao,
    revPipeline:(r.rev_pipeline==null?undefined:r.rev_pipeline),
    notas:r.notas,
    createdAt:r.created_at, updatedAt:r.updated_at,
    revisoes:(revisoes||[]).map(function(rv){
      return {
        rev: rv.rev_num,
        label: rv.label,
        data: rv.data,
        valorTabela: Number(rv.valor_tabela)||0,
        valorFaturamento: Number(rv.valor_faturamento)||0,
        snapshot: rv.snapshot,
        pdfCloud: rv.pdf_cloud,
        pdfPages: rv.pdf_pages,
        crmPronto: rv.crm_pronto,
        _revId: rv.id
      };
    }),
    anexos: ext.anexos||[]
  };
  Object.keys(ext).forEach(function(k){ if(o[k]===undefined) o[k]=ext[k]; });
  return o;
}
function _buildExtras(o){
  // Campos não mapeados para colunas dedicadas vão pra extras jsonb
  var known={id:1,cliente:1,scope:1,pais:1,estado:1,cidade:1,cep:1,telefone:1,email:1,endereco:1,
    stage:1,origem:1,produto:1,responsavel:1,wrep:1,prioridade:1,potencial:1,
    largura:1,altura:1,abertura:1,modelo:1,folhas:1,reserva:1,agp:1,
    valor:1,valorTabela:1,valorFaturamento:1,
    dataContato:1,fechamento:1,previsao:1,revPipeline:1,notas:1,
    revisoes:1,anexos:1,createdAt:1,updatedAt:1};
  var ext={};
  Object.keys(o||{}).forEach(function(k){ if(!known[k]) ext[k]=o[k]; });
  // ★ Felipe 28/04: se inst_quem !== INTERNACIONAL, ZERAR todos campos inst_intl_*
  // antes de gravar (impede valor fantasma de passagem/hotel/etc no banco)
  var _quem = (ext.inst_quem || '').toString().toUpperCase();
  if(_quem !== 'INTERNACIONAL'){
    ['inst_passagem','inst_hotel','inst_alim','inst_udigru','inst_carro',
     'inst_mo','inst_seguro','inst_aero','inst_dias','inst_pessoas',
     'inst_margem','inst_intl_total','inst_intl_fat','inst_intl_tab',
     'inst_valor','inst_transp'].forEach(function(k){ ext[k]=0; });
  }
  // Anexos grandes são tratados à parte (crm_anexos + Storage). Aqui só guardamos
  // referência leve quando já vieram como base64 pequeno (legado).
  return ext;
}
function _num(v){if(v==null||v==='')return null;var n=Number(v);return isNaN(n)?null:n;}
function _int(v){if(v==null||v==='')return null;var n=parseInt(v,10);return isNaN(n)?null:n;}

/* ─────────────────────────────────────────────────────────────
   API pública: crmDB
   ───────────────────────────────────────────────────────────── */
var API = {
  /* ── Carregar TODAS oportunidades (com revisões) ── */
  loadAll: function(){
    // 1) oportunidades ativas
    return _fetch('/rest/v1/crm_oportunidades?deleted_at=is.null&select=*&order=updated_at.desc')
      .then(function(opps){
        if(!opps||!opps.length) return [];
        // 2) revisões em 1 query só
        var ids=opps.map(function(o){return o.id;});
        var inList=ids.map(function(id){return '"'+id+'"';}).join(',');
        return _fetch('/rest/v1/crm_revisoes?opp_id=in.('+inList+')&select=*&order=rev_num.asc')
          .then(function(revs){
            var byOpp={};
            (revs||[]).forEach(function(rv){(byOpp[rv.opp_id]=byOpp[rv.opp_id]||[]).push(rv);});
            return opps.map(function(r){return _rowToOpp(r, byOpp[r.id]||[]);});
          });
      });
  },

  /* ── Hidratar localStorage a partir da tabela normalizada ──
     Uso: chama no startup OU após edições diretas no Supabase (ex: corrigir dados via MCP).
     Baixa crm_oportunidades + crm_revisoes → sobrescreve projetta_crm_v1 local
     → atualiza snapshot (evita re-enviar os mesmos dados como "mudança local"). */
  hydrateLocal: function(opts){
    opts=opts||{};
    return API.loadAll().then(function(opps){
      if(!opps||!Array.isArray(opps)) return [];
      // Preserva campos locais que não estão na tabela (anexos grandes, drafts) via merge leve
      try{
        var localRaw=localStorage.getItem(CK_OLD);
        var local = localRaw ? JSON.parse(localRaw) : [];
        var localMap={};
        (local||[]).forEach(function(o){ if(o&&o.id) localMap[o.id]=o; });
        opps.forEach(function(co){
          var lo=localMap[co.id];
          // Mantém anexos locais (base64 grandes) e dataContato legado se não veio do cloud
          if(lo){
            if(lo.anexos && lo.anexos.length>0 && (!co.anexos||co.anexos.length===0)) co.anexos=lo.anexos;
            if(lo.dataContato && !co.dataContato) co.dataContato=lo.dataContato;
          }
        });
      }catch(e){ /* se falhar o merge, usa direto do cloud */ }
      // Sobrescreve blob local
      try{ localStorage.setItem(CK_OLD, JSON.stringify(opps)); }
      catch(e){ console.warn('[crmDB] hydrateLocal: falha salvar localStorage', e); }
      // Atualiza snapshot para NÃO re-enviar esses dados como "mudança local"
      try{ sessionStorage.setItem(SNAP_KEY, _hash(opps)); }catch(e){}
      if(opts.verbose!==false) console.log('[crmDB] hydrateLocal: '+opps.length+' opps sincronizadas do Supabase');
      // Re-render se CRM já está montado
      if(opts.rerender!==false && typeof window.crmRender==='function'){
        try{ window.crmRender(); }catch(e){}
      }
      return opps;
    }).catch(function(e){
      console.warn('[crmDB] hydrateLocal falhou (app continua com localStorage existente):', e.message||e);
      return null;
    });
  },

  /* ── Salvar (upsert) 1 oportunidade ── */
  saveOpp: function(opp, opts){
    opts=opts||{};
    var row=_oppToRow(opp);
    if(!row.id){ row.id = 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
    return _fetch('/rest/v1/crm_oportunidades',{
      method:'POST',
      headers:{'Prefer':'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify(row)
    }).then(function(res){
      // evento
      if(!opts.skipEvent){
        API.logEvent({opp_id:row.id, tipo: opts.tipo||'update', descricao: opts.descricao||'Oportunidade salva'});
      }
      return res&&res[0]?res[0]:row;
    });
  },

  /* ── Deletar (soft) 1 oportunidade ── */
  deleteOpp: function(id){
    return _fetch('/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(id),{
      method:'PATCH',
      body:JSON.stringify({deleted_at:new Date().toISOString(), updated_by:_currentUser().name})
    }).then(function(){
      API.logEvent({opp_id:id, tipo:'delete', descricao:'Oportunidade removida'});
    });
  },

  /* ── Mudar stage (PATCH mínimo) ── */
  updateStage: function(id, stage){
    return _fetch('/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(id),{
      method:'PATCH',
      body:JSON.stringify({stage:stage, updated_by:_currentUser().name})
    }).then(function(){
      API.logEvent({opp_id:id, tipo:'stage_change', campo:'stage', valor_depois:{stage:stage}, descricao:'Card movido para '+stage});
    });
  },

  /* ── Upsert revisão ── */
  saveRevisao: function(oppId, revNum, data){
    var row={
      opp_id: oppId,
      rev_num: revNum,
      label: data.label||('Revisão '+revNum),
      data: data.data||new Date().toISOString(),
      valor_tabela: _num(data.valorTabela)||0,
      valor_faturamento: _num(data.valorFaturamento)||0,
      snapshot: data.snapshot||null,
      pdf_cloud: data.pdfCloud||null,
      pdf_pages: data.pdfPages||null,
      crm_pronto: !!data.crmPronto,
      observacoes: data.observacoes||null,
      created_by: _currentUser().name
    };
    return _fetch('/rest/v1/crm_revisoes?on_conflict=opp_id,rev_num',{
      method:'POST',
      headers:{'Prefer':'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify(row)
    }).then(function(res){
      API.logEvent({opp_id:oppId, tipo:'rev_update', descricao:'Revisão '+revNum+' ('+row.label+') salva', valor_depois:{rev_num:revNum, valor_tabela:row.valor_tabela, valor_faturamento:row.valor_faturamento}});
      return res&&res[0]?res[0]:row;
    });
  },

  /* ── Deletar revisão ── */
  deleteRevisao: function(oppId, revNum){
    return _fetch('/rest/v1/crm_revisoes?opp_id=eq.'+encodeURIComponent(oppId)+'&rev_num=eq.'+revNum,{
      method:'DELETE'
    }).then(function(){
      API.logEvent({opp_id:oppId, tipo:'rev_delete', descricao:'Revisão '+revNum+' removida'});
    });
  },

  /* ── Audit log ── */
  logEvent: function(ev){
    var u=_currentUser();
    var row=Object.assign({
      user_name:u.name,
      user_email:u.email,
      user_agent:(navigator.userAgent||'').slice(0,200)
    }, ev);
    // fire-and-forget
    fetch(SB+'/rest/v1/crm_eventos',{
      method:'POST',
      headers:Object.assign({},H,{'Prefer':'return=minimal'}),
      body:JSON.stringify(row)
    }).catch(function(){});
  },

  /* ── Consultar eventos de 1 oportunidade ── */
  loadEvents: function(oppId, limit){
    return _fetch('/rest/v1/crm_eventos?opp_id=eq.'+encodeURIComponent(oppId)+'&select=*&order=created_at.desc&limit='+(limit||100));
  },

  /* ── Anexos: upload pro Storage + metadado em crm_anexos ── */
  uploadAnexo: function(oppId, file, opts){
    opts=opts||{};
    var ts=Date.now();
    var safe=(file.name||'anexo').replace(/[^\w.\-]/g,'_');
    var path=oppId+'/'+ts+'_'+safe;
    var url=SB+'/storage/v1/object/crm-anexos/'+encodeURIComponent(path);
    return fetch(url,{
      method:'POST',
      headers:{'Authorization':'Bearer '+KEY,'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},
      body:file
    }).then(function(r){
      if(!r.ok) throw new Error('Storage HTTP '+r.status);
      return _fetch('/rest/v1/crm_anexos',{
        method:'POST',
        headers:{'Prefer':'return=representation'},
        body:JSON.stringify({
          opp_id: oppId,
          rev_id: opts.revId||null,
          nome: file.name,
          tipo_mime: file.type,
          tamanho_bytes: file.size,
          storage_path: path,
          storage_bucket: 'crm-anexos',
          descricao: opts.descricao||null,
          created_by: _currentUser().name
        })
      });
    }).then(function(res){
      API.logEvent({opp_id:oppId, tipo:'anexo_add', descricao:'Anexo adicionado: '+file.name});
      return res&&res[0]?res[0]:null;
    });
  },

  loadAnexos: function(oppId){
    return _fetch('/rest/v1/crm_anexos?opp_id=eq.'+encodeURIComponent(oppId)+'&select=*&order=created_at.desc');
  },

  deleteAnexo: function(anexoId, storagePath){
    return _fetch('/rest/v1/crm_anexos?id=eq.'+encodeURIComponent(anexoId),{method:'DELETE'})
      .then(function(){
        if(storagePath){
          fetch(SB+'/storage/v1/object/crm-anexos/'+encodeURIComponent(storagePath),{
            method:'DELETE',
            headers:{'Authorization':'Bearer '+KEY}
          }).catch(function(){});
        }
      });
  },

  anexoUrl: function(storagePath){
    return SB+'/storage/v1/object/public/crm-anexos/'+storagePath;
  },

  /* ─────────────────────────────────────────────────────────
     DUAL-WRITE: sincroniza blob completo → writes granulares
     ─────────────────────────────────────────────────────────
     Chamado pelo cSave() patched. Compara com snapshot anterior
     e só manda pra nuvem as oportunidades/revisões que mudaram.
     ───────────────────────────────────────────────────────── */
  syncFromBlob: function(dbArray){
    var prev={};
    try{prev=JSON.parse(sessionStorage.getItem(SNAP_KEY)||'{}');}catch(e){}

    var curr={};
    var toUpsert=[];
    var revsToUpsert=[]; // {oppId, revNum, data}

    (dbArray||[]).forEach(function(o){
      var key=o.id;
      var hash=_hash(o);
      curr[key]=hash;
      if(prev[key]!==hash){
        toUpsert.push(o);
        // Revisões: comparar uma a uma (hash inclui revisoes[])
        if(o.revisoes&&o.revisoes.length){
          o.revisoes.forEach(function(rv, idx){
            revsToUpsert.push({oppId:o.id, revNum:(rv.rev!=null?rv.rev:idx), data:rv});
          });
        }
      }
    });

    // Soft-delete: estava antes, sumiu agora
    var deleted=Object.keys(prev).filter(function(k){return !(k in curr);});

    // Persistir snapshot novo
    try{sessionStorage.setItem(SNAP_KEY, JSON.stringify(curr));}catch(e){}

    // Nada mudou?
    if(!toUpsert.length && !deleted.length){
      return Promise.resolve({upserts:0, revs:0, deletes:0, skipped:true});
    }

    console.log('[crmDB] sync: '+toUpsert.length+' opps, '+revsToUpsert.length+' revs, '+deleted.length+' deletes');

    // Upserts em bulk (PostgREST aceita array)
    var promises=[];
    if(toUpsert.length){
      var rows=toUpsert.map(_oppToRow);
      promises.push(_fetch('/rest/v1/crm_oportunidades',{
        method:'POST',
        headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(rows)
      }).catch(function(e){console.warn('[crmDB] upsert opps:',e);}));
    }
    if(revsToUpsert.length){
      var revRows=revsToUpsert.map(function(x){
        return {
          opp_id:x.oppId, rev_num:x.revNum,
          label:x.data.label||'Revisão '+x.revNum,
          data:x.data.data||new Date().toISOString(),
          valor_tabela:_num(x.data.valorTabela)||0,
          valor_faturamento:_num(x.data.valorFaturamento)||0,
          snapshot:x.data.snapshot||null,
          pdf_cloud:x.data.pdfCloud||null,
          pdf_pages:x.data.pdfPages||null,
          crm_pronto:!!x.data.crmPronto,
          created_by:_currentUser().name
        };
      });
      promises.push(_fetch('/rest/v1/crm_revisoes?on_conflict=opp_id,rev_num',{
        method:'POST',
        headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(revRows)
      }).catch(function(e){console.warn('[crmDB] upsert revs:',e);}));
    }
    if(deleted.length){
      deleted.forEach(function(id){
        promises.push(_fetch('/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(id),{
          method:'PATCH',
          body:JSON.stringify({deleted_at:new Date().toISOString()})
        }).catch(function(e){console.warn('[crmDB] delete:',e);}));
      });
    }

    return Promise.all(promises).then(function(){
      return {upserts:toUpsert.length, revs:revsToUpsert.length, deletes:deleted.length};
    });
  },

  /* Reset do cache de snapshot (força re-sync completo) */
  resetSnapshot: function(){ try{sessionStorage.removeItem(SNAP_KEY);}catch(e){} },

  /* Info */
  _internal: {_fetch:_fetch, _oppToRow:_oppToRow, _rowToOpp:_rowToOpp, SB:SB, KEY:KEY, H:H}
};

/* Hash estável (jsonify com keys ordenadas, djb2) */
function _hash(obj){
  try{
    var s=_stableStringify(obj);
    var h=5381, i=s.length;
    while(i) h=(h*33)^s.charCodeAt(--i);
    return (h>>>0).toString(36);
  }catch(e){return Math.random().toString(36);}
}
function _stableStringify(o){
  if(o===null||typeof o!=='object') return JSON.stringify(o);
  if(Array.isArray(o)) return '['+o.map(_stableStringify).join(',')+']';
  var keys=Object.keys(o).sort();
  return '{'+keys.map(function(k){return JSON.stringify(k)+':'+_stableStringify(o[k]);}).join(',')+'}';
}

window.crmDB = API;
console.log('✓ crmDB (camada profissional) carregado');
})();
