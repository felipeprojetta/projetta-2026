/**
 * 22-reservas-weiku.js
 * Module: RESERVAS-WEIKU
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
(function(){
var SB='https://plmliavuwlgpwaizfeds.supabase.co';
var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
var H={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
var _cache=null;

/* ── Carregar stats ── */
window.wrkLoadStats=function(){
  var infoEl=document.getElementById('wrk-info');
  if(infoEl) infoEl.textContent='Carregando...';
  // Total count
  fetch(SB+'/rest/v1/weiku_reservas?select=num_reserva&limit=1',{headers:Object.assign({},H,{'Prefer':'count=exact'})})
  .then(function(r){
    var range=r.headers.get('content-range')||'';
    var total=range.split('/')[1]||'0';
    document.getElementById('wrk-total').textContent=total;
    return r.json();
  }).catch(function(e){document.getElementById('wrk-total').textContent='Erro';});
  // This month
  var now=new Date();
  var ym=now.getFullYear()+'-'+(now.getMonth()+1<10?'0':'')+(now.getMonth()+1);
  fetch(SB+'/rest/v1/weiku_reservas?select=num_reserva&data_reserva=gte.'+ym+'-01&limit=1',{headers:Object.assign({},H,{'Prefer':'count=exact'})})
  .then(function(r){
    var range=r.headers.get('content-range')||'';
    var mes=range.split('/')[1]||'0';
    document.getElementById('wrk-mes').textContent=mes;
  }).catch(function(){});
  // Last reservation
  fetch(SB+'/rest/v1/weiku_reservas?select=num_reserva,data_reserva&order=num_reserva.desc&limit=1',{headers:H})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d&&d[0]) document.getElementById('wrk-ultima').textContent=d[0].num_reserva;
  }).catch(function(){});
  // Load first 200 for table
  wrkSearch();
};

/* ── Buscar reservas ── */
window.wrkSearch=function(){
  var q=(document.getElementById('wrk-search')||{}).value||'';
  var reg=(document.getElementById('wrk-regiao-filter')||{}).value||'';
  var url=SB+'/rest/v1/weiku_reservas?select=*&order=data_reserva.desc,num_reserva.desc&limit=200';
  if(q){
    // Search by num_reserva or agp
    if(/^\d+$/.test(q.trim())){
      url+='&num_reserva=eq.'+q.trim();
    } else if(/^AGP/i.test(q.trim())){
      url+='&agp=ilike.*'+q.trim()+'*';
    } else {
      url+='&or=(followup.ilike.*'+q.trim()+'*,reserva_interna.ilike.*'+q.trim()+'*,regiao.ilike.*'+q.trim()+'*,agp.ilike.*'+q.trim()+'*)';
    }
  }
  if(reg) url+='&regiao=like.'+reg+'*';
  fetch(url,{headers:Object.assign({},H,{'Prefer':'count=exact'})})
  .then(function(r){
    var range=r.headers.get('content-range')||'';
    var total=range.split('/')[1]||'?';
    var info=document.getElementById('wrk-info');
    if(info) info.textContent='Mostrando até 200 de '+total+' resultado(s)'+(q?' para "'+q+'"':'');
    return r.json();
  })
  .then(function(data){
    var tbody=document.getElementById('wrk-tbody');if(!tbody)return;
    if(!data||!data.length){tbody.innerHTML='<tr><td colspan="7" style="padding:20px;text-align:center;color:#888">Nenhuma reserva encontrada</td></tr>';return;}
    var html='';
    data.forEach(function(r){
      var dt=r.data_reserva?new Date(r.data_reserva+'T12:00:00').toLocaleDateString('pt-BR'):'—';
      html+='<tr style="border-bottom:1px solid #f0f0f0">';
      html+='<td style="padding:6px;font-weight:700;color:#003144">'+r.num_reserva+'</td>';
      html+='<td style="padding:6px">'+dt+'</td>';
      html+='<td style="padding:6px"><span style="background:#e8f4fd;color:#1a5276;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600">'+r.regiao+'</span></td>';
      html+='<td style="padding:6px;color:'+(r.agp?'#27ae60':'#ccc')+'">'+( r.agp||'—')+'</td>';
      html+='<td style="padding:6px;color:'+(r.atp?'#8e44ad':'#ccc')+'">'+(r.atp||'—')+'</td>';
      html+='<td style="padding:6px;font-size:10px">'+r.followup+'</td>';
      html+='<td style="padding:6px;font-size:10px">'+r.reserva_interna+'</td>';
      html+='</tr>';
    });
    tbody.innerHTML=html;
  }).catch(function(e){
    var tbody=document.getElementById('wrk-tbody');
    if(tbody) tbody.innerHTML='<tr><td colspan="7" style="padding:20px;text-align:center;color:#e74c3c">Erro: '+e.message+'</td></tr>';
  });
};

/* ── Importar JSON ── */
window.wrkImportJSON=function(input){
  if(!input.files||!input.files[0])return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      if(!Array.isArray(data)||!data.length){alert('JSON inválido ou vazio.');return;}
      if(!confirm('Importar '+data.length+' reservas para o Supabase?\n\nRegistros duplicados serão ignorados.')){input.value='';return;}
      // Upload in batches of 200
      var batches=[];
      for(var i=0;i<data.length;i+=200) batches.push(data.slice(i,i+200));
      var done=0,errors=0;
      var info=document.getElementById('wrk-info');
      if(info) info.textContent='Importando... 0/'+batches.length+' lotes';
      batches.reduce(function(chain,batch,bi){
        return chain.then(function(){
          return fetch(SB+'/rest/v1/weiku_reservas',{
            method:'POST',
            headers:Object.assign({},H,{'Prefer':'return=minimal,resolution=merge-duplicates'}),
            body:JSON.stringify(batch)
          }).then(function(r){
            done++;
            if(!r.ok) errors++;
            if(info) info.textContent='Importando... '+done+'/'+batches.length+' lotes'+(errors?' ('+errors+' erros)':'');
          });
        });
      },Promise.resolve()).then(function(){
        alert('Importação concluída!\n\n'+done+' lotes processados'+(errors?'\n'+errors+' erros':''));
        wrkLoadStats();
        input.value='';
      });
    }catch(err){alert('Erro ao ler JSON: '+err.message);}
  };
  reader.readAsText(input.files[0]);
};

/* ── Sincronizar da Weiku (instruções) ── */
window.wrkSyncFromWeiku=function(){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  var box=document.createElement('div');
  box.style.cssText='background:#fff;border-radius:16px;padding:24px;max-width:500px;width:90%;font-family:inherit;box-shadow:0 8px 32px rgba(0,0,0,.2)';
  box.innerHTML='<div style="font-size:16px;font-weight:800;color:#003144;margin-bottom:12px">🔄 Sincronizar Reservas da Weiku</div>'
    +'<div style="font-size:12px;line-height:1.6;color:#444;margin-bottom:16px">'
    +'<b>Passo 1:</b> Abra a intranet Weiku → Comercial<br>'
    +'<b>Passo 2:</b> Use o Claude para extrair dados (como fizemos hoje)<br>'
    +'<b>Passo 3:</b> O JSON será baixado automaticamente<br>'
    +'<b>Passo 4:</b> Use o botão <b>"📤 Importar JSON"</b> acima para subir<br><br>'
    +'<span style="color:#e67e22;font-weight:700">💡 Dica:</span> Registros duplicados são ignorados automaticamente (merge por nº reserva).'
    +'</div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end">'
    +'<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:8px 20px;background:#003144;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit">Entendi</button>'
    +'<a href="https://intranet.weiku.com.br/v2/main/?location=new-dashboard/dashboard-comercial[]/" target="_blank" style="padding:8px 20px;background:#e67e22;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;font-size:13px">Abrir Weiku</a>'
    +'</div>';
  overlay.appendChild(box);
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  document.body.appendChild(overlay);
};

console.log('🔄 Reservas Weiku module loaded');
})();
