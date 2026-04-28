/**
 * 15-cadastro_init.js
 * Module: CADASTRO_INIT
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: CADASTRO_INIT ══ */
document.addEventListener('DOMContentLoaded',function(){
  _loadCustomPerfis();
  _loadCustomComps();
  _loadCustomChapas();
  // Filter deleted items
  try{
    var delP=JSON.parse(localStorage.getItem('projetta_deleted_perfis')||'[]');
    if(delP.length) for(var i=PERFIS_DB.length-1;i>=0;i--){if(delP.indexOf(PERFIS_DB[i].c)>=0)PERFIS_DB.splice(i,1);}
    var delC=JSON.parse(localStorage.getItem('projetta_deleted_comps')||'[]');
    if(delC.length) for(var i=COMP_DB.length-1;i>=0;i--){if(delC.indexOf(COMP_DB[i].c)>=0)COMP_DB.splice(i,1);}
  }catch(e){}
  populateReps();
  carregarPrecosFech();
  loadPrecoKg();
  loadModelos();
  if(typeof _populateCorSelects==='function')_populateCorSelects();
  if(typeof resetToDefaults==='function')resetToDefaults();
  _populateManualAcessSelect();
  _populateManualPerfilSelect();
  _populatePlanChapaSelects();
  // Auto-restaurar ultima sessao salva (Felipe 28/04: defensivo - funcao pode nao existir)
  try { if(typeof _autoRestoreSession === 'function') _autoRestoreSession(); }
  catch(e){ console.warn('[15] _autoRestoreSession falhou:', e.message); }
  // Auto-gerar OS se houver dimensões salvas
  setTimeout(function(){ _osAutoUpdate(); }, 500);
});


/* ══ ACESSÓRIOS ══════════════════════════════════════════ */
function getAcessCusto() {
  return getDigitalLockCost();
}
function getDigitalLockCost(){
  var dig = document.getElementById('carac-fech-dig');
  if(!dig || !dig.value || dig.value==='NÃO SE APLICA') return 0;
  // Tedee: soma dos itens individuais (Bridge + Lock + Keypad + Pilha)
  if(dig.value==='TEDEE'){
    var tedeeCodes=['PA-TEDEE-BRIDGE','PA-TEDEE-FEC-PT','PA-TEDEE-TEC-PT','PA-PILHA-AAA-4X'];
    var total=0;
    var savedP={};
    try{var s=localStorage.getItem('projetta_comp_precos');if(s)savedP=JSON.parse(s);}catch(e){}
    tedeeCodes.forEach(function(code){
      if(savedP[code]!==undefined) total+=parseFloat(savedP[code])||0;
      else{
        for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===code){total+=(COMP_DB[i].p||0);break;}}
      }
    });
    return total;
  }
  // Outras fechaduras digitais
  var map = {
    'PHILIPS 9300': 'PA-DIG-PHILIPS9300',
    'EMTECO': 'PA-DIG-EMTECO'
  };
  var code = map[dig.value];
  if(!code) return 0;
  try{
    var saved=JSON.parse(localStorage.getItem('projetta_comp_precos')||'{}');
    if(saved[code]!==undefined) return parseFloat(saved[code])||0;
  }catch(e){}
  var item=COMP_DB.find(function(c){return c.c===code;});
  return item?(item.p||0):0;
}
function salvarPrecosFech(){}
function carregarPrecosFech(){}

/* ══ SALVAR ALTERAÇÕES (distribui para precificação) ══ */
var vlItens=[];
function calcNfLiquido(){
  var cod=$('nf-cod').value.trim()||'—';
  var desc=$('nf-desc').value.trim()||'—';
  var qtd=parseFloat($('nf-qtd').value)||0;
  var merc=parseFloat($('nf-merc').value)||0;
  var icms=parseFloat($('nf-icms').value)||0;
  var pis=parseFloat($('nf-pis').value)||0;
  var cofins=parseFloat($('nf-cofins').value)||0;
  var ipi=parseFloat($('nf-ipi').value)||0;
  if(qtd<=0||merc<=0){alert('Preencha Quantidade e Valor Mercadoria.');return;}
  var liqTotal=merc-icms-pis-cofins;
  var liqUn=liqTotal/qtd;
  var brl=function(v){return v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};
  // Mostrar resultado
  var res=$('nf-resultado');
  res.style.display='inline';
  res.innerHTML='( Merc: '+brl(merc)+' - ICMS: '+brl(icms)+' - PIS: '+brl(pis)+' - COFINS: '+brl(cofins)+' ) / '+qtd+' = <strong style="font-size:15px">R$ '+brl(liqUn)+'</strong> /un';
  // Adicionar à tabela com valor NF original (bruto por unidade) para referência
  // Mas usar o líquido calculado diretamente
  vlItens.push({cod:cod,desc:desc,qtd:qtd,valor:merc/qtd,unid:'PC',
    nfMerc:merc,nfIcms:icms,nfPis:pis,nfCofins:cofins,nfIpi:ipi,
    liqUn:liqUn,liqTotal:liqTotal,isNf:true});
  renderVlTabela();
}
function addVlItem(){
  var cod=$('vl-cod').value.trim()||'—';
  var desc=$('vl-desc').value.trim()||'—';
  var qtd=parseInt($('vl-qtd').value)||1;
  var valor=parseFloat($('vl-valor').value)||0;
  var unid=$('vl-unid').value||'PC';
  if(valor<=0){alert('Informe o valor unitário da NF.');return;}
  vlItens.push({cod:cod,desc:desc,qtd:qtd,valor:valor,unid:unid});
  $('vl-cod').value='';$('vl-desc').value='';$('vl-qtd').value='1';$('vl-valor').value='';
  renderVlTabela();
}
function removeVlItem(idx){vlItens.splice(idx,1);renderVlTabela();}
function limparVlItens(){vlItens=[];renderVlTabela();}
function renderVlTabela(){
  var pis=(parseFloat($('vl-pis').value)||0)/100;
  var cofins=(parseFloat($('vl-cofins').value)||0)/100;
  var icms=(parseFloat($('vl-icms').value)||0)/100;
  var tb=$('vl-tbody');
  var brl2=function(v){return v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var rows='';
  var totBruto=0,totCred=0,totLiq=0;
  vlItens.forEach(function(it,i){
    var vPis,vCofins,vIcms,liqUn,liqTotal,brutoTotal;
    if(it.isNf){
      // Itens da NF: valores absolutos já calculados
      vPis=it.nfPis/it.qtd;
      vCofins=it.nfCofins/it.qtd;
      vIcms=it.nfIcms/it.qtd;
      liqUn=it.liqUn;
      liqTotal=it.liqTotal;
      brutoTotal=it.nfMerc;
      totCred+=(it.nfPis+it.nfCofins+it.nfIcms);
    } else {
      // Itens manuais: usa alíquotas %
      vPis=it.valor*pis;
      vCofins=it.valor*cofins;
      vIcms=it.valor*icms;
      liqUn=it.valor-vPis-vCofins-vIcms;
      liqTotal=liqUn*it.qtd;
      brutoTotal=it.valor*it.qtd;
      totCred+=(vPis+vCofins+vIcms)*it.qtd;
    }
    totBruto+=brutoTotal;
    totLiq+=liqTotal;
    var bg=it.isNf?'#fff8e1':i%2===0?'#fff':'#f9f8f5';
    var nfTag=it.isNf?'<span style="font-size:8px;background:#e65100;color:#fff;padding:1px 4px;border-radius:3px;margin-left:4px">NF</span>':'';
    rows+='<tr style="background:'+bg+'">'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;font-weight:600">'+it.cod+nfTag+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee">'+it.desc+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:center">'+it.qtd+(it.unid?' '+it.unid:'')+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;font-weight:600">'+brl2(it.isNf?it.nfMerc/it.qtd:it.valor)+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;color:#c0392b">-'+brl2(vPis)+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;color:#c0392b">-'+brl2(vCofins)+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;color:#c0392b">-'+brl2(vIcms)+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;font-weight:700;color:#27ae60">'+brl2(liqUn)+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;font-weight:800;color:#27ae60">R$ '+brl2(liqTotal)+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:center"><button onclick="removeVlItem('+i+')" style="border:none;background:none;color:#c0392b;font-size:14px;cursor:pointer;font-weight:700">✕</button></td>'
      +'</tr>';
  });
  tb.innerHTML=rows;
  var totDiv=$('vl-totais');if(totDiv)totDiv.style.display=vlItens.length>0?'flex':'none';
  $('vl-total-bruto').textContent='R$ '+brl2(totBruto);
  $('vl-total-creditos').textContent='-R$ '+brl2(totCred);
  $('vl-total-liquido').textContent='R$ '+brl2(totLiq);
  $('vl-pct-ded').textContent=totBruto>0?(totCred/totBruto*100).toFixed(1)+'%':'0%';
}
function aplicarVlPrecos(){
  if(vlItens.length===0){alert('Adicione itens primeiro.');return;}
  var pis=(parseFloat($('vl-pis').value)||0)/100;
  var cofins=(parseFloat($('vl-cofins').value)||0)/100;
  var icms=(parseFloat($('vl-icms').value)||0)/100;
  var saved={};try{var s=localStorage.getItem('projetta_comp_precos');if(s)saved=JSON.parse(s);}catch(e){}
  var count=0;
  vlItens.forEach(function(it){
    if(it.cod&&it.cod!=='—'){
      var liq;
      if(it.isNf){
        liq=it.liqUn;
      } else {
        liq=it.valor-(it.valor*pis)-(it.valor*cofins)-(it.valor*icms);
      }
      saved[it.cod]=Math.round(liq*10000)/10000;
      count++;
    }
  });
  localStorage.setItem('projetta_comp_precos',JSON.stringify(saved));
  showSaveToast(count+' preços líquidos aplicados ao Cadastro de Acessórios!');
}

/* ══ SALVAR ALTERAÇÕES ══ */
function salvarPerfisAll(){
  salvarPerfisKg();
  renderPerfisDB();
  calc();
  showSaveToast('Perfis salvos e distribuídos para precificação!');
}
function salvarAcessAll(){
  // All component prices already save on change via saveCompPreco
  // Force recalc to distribute digital lock prices
  calc();
  showSaveToast('Acessórios salvos e distribuídos para precificação!');
}
function salvarSuperfAll(){
  salvarPrecos();
  calc();
  showSaveToast('Superfícies salvas e distribuídas para precificação!');
}
function showSaveToast(msg){
  var t=document.createElement('div');
  t.textContent='✓ '+msg;
  t.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a3a4a;color:#fff;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif';
  document.body.appendChild(t);
  setTimeout(function(){t.style.opacity='0';t.style.transition='opacity .5s';setTimeout(function(){t.remove();},500);},2500);
}

/* ══ EXPORTAR / IMPORTAR PREÇOS ══ */
function exportarPerfis(){
  if(typeof XLSX==='undefined'){alert('Biblioteca XLSX não carregada.');return;}
  var wb=XLSX.utils.book_new();
  var kgTecno=parseFloat($('pf-kg-tecnoperfil').value)||0;
  var kgMerc=parseFloat($('pf-kg-mercado').value)||0;
  var kgWeiku=parseFloat($('pf-kg-weiku').value)||0;
  var precoPint=parseFloat($('pf-preco-pintura').value)||0;
  var barraM=parseFloat($('pf-barra-m').value)||6;
  // Aba config
  var cfgData=[['Parâmetro','Valor'],['R$/kg TECNOPERFIL',kgTecno],['R$/kg MERCADO',kgMerc],['R$/kg WEIKU',kgWeiku],['R$/kg PINTURA',precoPint],['Barra (m)',barraM]];
  var wsCfg=XLSX.utils.aoa_to_sheet(cfgData);
  wsCfg['!cols']=[{wch:22},{wch:12}];
  XLSX.utils.book_append_sheet(wb,wsCfg,'Configuração');
  // Aba perfis
  var data=[['Código','Descrição','Fornecedor','Linha','kg/m','kg/barra','R$ perfil','R$ pintura','R$ total/barra']];
  PERFIS_DB.forEach(function(p){
    var kgB=p.kg*barraM;
    var precoKg=p.f==='TECNOPERFIL'||p.f==='PERFISUD'?kgTecno:p.f==='WEIKU'?kgWeiku:kgMerc;
    var pPerf=kgB*precoKg;var pPint=kgB*precoPint;
    data.push([p.c,p.d,p.f,p.l,p.kg,Math.round(kgB*100)/100,Math.round(pPerf*100)/100,Math.round(pPint*100)/100,Math.round((pPerf+pPint)*100)/100]);
  });
  var ws=XLSX.utils.aoa_to_sheet(data);
  ws['!cols']=[{wch:22},{wch:42},{wch:16},{wch:12},{wch:8},{wch:10},{wch:12},{wch:12},{wch:14}];
  XLSX.utils.book_append_sheet(wb,ws,'Perfis');
  XLSX.writeFile(wb,'Projetta_Perfis_'+new Date().toISOString().slice(0,10)+'.xlsx');
}
function importarPerfis(input){
  if(typeof XLSX==='undefined'){alert('Biblioteca XLSX não carregada.');return;}
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
    var wsCfg=wb.Sheets['Configuração']||wb.Sheets['Configuracao'];
    if(wsCfg){
      var rows=XLSX.utils.sheet_to_json(wsCfg,{header:1});
      rows.forEach(function(r){
        if(r[0]==='R$/kg TECNOPERFIL'&&r[1]!==undefined) $('pf-kg-tecnoperfil').value=r[1];
        if(r[0]==='R$/kg MERCADO'&&r[1]!==undefined) $('pf-kg-mercado').value=r[1];
        if(r[0]==='R$/kg WEIKU'&&r[1]!==undefined) $('pf-kg-weiku').value=r[1];
        if(r[0]==='R$/kg PINTURA'&&r[1]!==undefined) $('pf-preco-pintura').value=r[1];
      });
      salvarPerfisKg();
      renderPerfisDB();
      alert('✓ Preços de perfis atualizados!');
    } else {
      alert('Aba "Configuração" não encontrada no arquivo.');
    }
    input.value='';
  };
  reader.readAsArrayBuffer(file);
}
function exportarAcessorios(){
  if(typeof XLSX==='undefined'){alert('Biblioteca XLSX não carregada.');return;}
  var wb=XLSX.utils.book_new();
  var saved={};try{var s=localStorage.getItem('projetta_comp_precos');if(s)saved=JSON.parse(s);}catch(e){}
  var data=[['Código','Descrição','Fornecedor','Categoria','Preço Líquido','Unidade']];
  COMP_DB.forEach(function(p){
    var preco=saved[p.c]!==undefined?saved[p.c]:p.p;
    data.push([p.c,p.d,p.f,p.cat,preco,p.u]);
  });
  var ws=XLSX.utils.aoa_to_sheet(data);
  ws['!cols']=[{wch:24},{wch:48},{wch:16},{wch:20},{wch:14},{wch:6}];
  XLSX.utils.book_append_sheet(wb,ws,'Acessórios');
  XLSX.writeFile(wb,'Projetta_Acessorios_'+new Date().toISOString().slice(0,10)+'.xlsx');
}
function importarAcessorios(input){
  if(typeof XLSX==='undefined'){alert('Biblioteca XLSX não carregada.');return;}
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
    var ws=wb.Sheets[wb.SheetNames[0]];
    var rows=XLSX.utils.sheet_to_json(ws,{header:1});
    var saved={};try{var s=localStorage.getItem('projetta_comp_precos');if(s)saved=JSON.parse(s);}catch(e){}
    var count=0;
    for(var i=1;i<rows.length;i++){
      var row=rows[i];
      if(row[0]&&row[4]!==undefined&&row[4]!==null){
        saved[row[0]]=parseFloat(row[4])||0;
        count++;
      }
    }
    localStorage.setItem('projetta_comp_precos',JSON.stringify(saved));
    renderCompDB();
    alert('✓ '+count+' preços de acessórios atualizados!');
    input.value='';
  };
  reader.readAsArrayBuffer(file);
}
function exportarPrecos(){
  if(typeof XLSX==='undefined'){alert('Biblioteca XLSX não carregada. Verifique conexão com internet.');return;}
  var wb=XLSX.utils.book_new();
  // Aba 1: Perfis
  var pfData=[['Código','Descrição','Fornecedor','kg/m','Barra (m)','R$/kg']];
  var precoKg=parseFloat(document.getElementById('pf-preco-kg').value)||0;
  var barraM=parseFloat(document.getElementById('pf-barra-m').value)||6;
  PERFIS_DB.forEach(function(p){pfData.push([p.c,p.d,p.f,p.kg,barraM,precoKg]);});
  var ws1=XLSX.utils.aoa_to_sheet(pfData);
  ws1['!cols']=[{wch:22},{wch:40},{wch:16},{wch:8},{wch:10},{wch:10}];
  XLSX.utils.book_append_sheet(wb,ws1,'Perfis');
  // Aba 2: Acessórios
  var compData=[['Código','Descrição','Fornecedor','Categoria','Preço Líq.','Unidade']];
  var saved={};try{var s=localStorage.getItem('projetta_comp_precos');if(s)saved=JSON.parse(s);}catch(e){}
  COMP_DB.forEach(function(p){
    var preco=saved[p.c]!==undefined?saved[p.c]:p.p;
    compData.push([p.c,p.d,p.f,p.cat,preco,p.u]);
  });
  var ws2=XLSX.utils.aoa_to_sheet(compData);
  ws2['!cols']=[{wch:24},{wch:45},{wch:16},{wch:18},{wch:12},{wch:6}];
  XLSX.utils.book_append_sheet(wb,ws2,'Acessórios');
  XLSX.writeFile(wb,'Projetta_Precos_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

function importarPrecos(input){
  if(typeof XLSX==='undefined'){alert('Biblioteca XLSX não carregada.');return;}
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    var data=new Uint8Array(e.target.result);
    var wb=XLSX.read(data,{type:'array'});
    var imported=0;
    // Importar Acessórios
    var wsAcess=wb.Sheets['Acessórios']||wb.Sheets['Acessorios'];
    if(wsAcess){
      var rows=XLSX.utils.sheet_to_json(wsAcess,{header:1});
      var saved={};try{var s=localStorage.getItem('projetta_comp_precos');if(s)saved=JSON.parse(s);}catch(e){}
      for(var i=1;i<rows.length;i++){
        var row=rows[i];
        if(row[0]&&row[4]!==undefined&&row[4]!==null){
          saved[row[0]]=parseFloat(row[4])||0;
          imported++;
        }
      }
      localStorage.setItem('projetta_comp_precos',JSON.stringify(saved));
    }
    // Importar Perfis (R$/kg)
    var wsPerfis=wb.Sheets['Perfis'];
    if(wsPerfis){
      var rows=XLSX.utils.sheet_to_json(wsPerfis,{header:1});
      if(rows.length>1&&rows[1][5]!==undefined){
        var kg=parseFloat(rows[1][5])||38;
        document.getElementById('pf-preco-kg').value=kg;
        localStorage.setItem('projetta_preco_kg',kg);
        imported++;
      }
    }
    alert('✓ '+imported+' preços importados com sucesso!');
    renderCompDB();
    renderPerfisDB();
    input.value='';
  };
  reader.readAsArrayBuffer(file);
}
function onAcessChange() {
  calc();
}


// ── CADASTRO DE MODELOS ────────────────────────────────────────────────────────

/* ══ END MODULE: CADASTRO_INIT ══ */
