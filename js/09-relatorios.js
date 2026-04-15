/**
 * 09-relatorios.js
 * Module: RELATORIOS
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: RELATORIOS ══ */
function _abrirDrawer(titulo, subtitulo, html){
  document.getElementById('aprov-title').textContent=titulo;
  document.getElementById('aprov-subtitle').textContent=subtitulo;
  document.getElementById('aprov-content').innerHTML=html;
  var bd=document.getElementById('aprov-backdrop');
  var dr=document.getElementById('aprov-drawer');
  bd.style.display='block';dr.style.display='block';
  dr.offsetHeight;
  bd.classList.add('open');dr.classList.add('open');
  document.body.style.overflow='hidden';
}

function relatorioBarras(){
  if(!window._lastOSData){alert('Gere o levantamento de perfis primeiro.');return;}
  var d=window._lastOSData;
  var groups={};
  var precoPintLiq=d.precoPint||0;
  d.seenKeys.forEach(function(key){
    var r=d.groupRes[key];if(!r||r.nBars===0)return;
    var perfil=null;for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===key){perfil=PERFIS_DB[i];break;}}
    var forn=perfil?perfil.f:'BRUTO';
    if(!groups[forn])groups[forn]=[];
    groups[forn].push({code:key,desc:perfil?perfil.d:key,qty:r.nBars,barra:r.barLenMM||6000,kgBruto:r.kgBruto||0,precoKg:r.precoKg||0,custo:r.custoTotal||0,pintado:r.pintado,precoKgPint:r.pintado?precoPintLiq:0});
  });
  var h='';
  var grandKg=0,grandCusto=0,n=0;
  for(var forn in groups){
    var items=groups[forn],subKg=0,subCusto=0;
    h+='<div style="border:1px solid #d5d8dc;border-radius:6px;margin-bottom:12px;overflow:hidden">';
    h+='<div style="background:#f0f4f6;padding:7px 12px;display:flex;justify-content:space-between;align-items:center"><span style="font-weight:800;font-size:13px;color:#c47012;letter-spacing:.03em">'+forn+'</span></div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="background:#eee"><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center;width:30px">PR</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Perfil</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Qtde</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Barra</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:right">Peso Bruto (kg)</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:right">R$/kg</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:right">Custo R$</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Obs.</th></tr></thead><tbody>';
    items.forEach(function(it){
      n++;subKg+=it.kgBruto;subCusto+=it.custo;
      var obs=it.pintado?'+ R$ '+(it.precoKgPint||0).toFixed(2)+'/kg pint.':'';
      h+='<tr><td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;color:#888">'+n+'</td><td style="padding:4px 8px;border:0.5px solid #eee;font-weight:600;color:#003144">'+it.code+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:center">'+it.qty+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:center">'+it.barra+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:right">'+it.kgBruto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:right;color:#888">R$ '+(it.precoKg||0).toFixed(2)+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:right;font-weight:700;color:#003144">R$ '+it.custo.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</td><td style="padding:4px 8px;border:0.5px solid #eee;font-size:9px;color:#888">'+obs+'</td></tr>';
    });
    h+='<tr style="background:#f8f8f8"><td colspan="4" style="padding:4px 8px;text-align:right;font-weight:700;font-size:10px;color:#1a3a4a">Subtotal '+forn+'</td><td style="padding:4px 8px;text-align:right;font-weight:700">'+subKg.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td></td><td style="padding:4px 8px;text-align:right;font-weight:700;color:#1a5276">R$ '+subCusto.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</td><td></td></tr>';
    h+='</tbody></table></div>';
    grandKg+=subKg;grandCusto+=subCusto;
  }
  // ── Fixos: adicionar barras dos fixos ao relatório ──────────────────────────
  var fixoPerfsRel = window._lastFixosPerfisRows || [];
  if(fixoPerfsRel.length > 0){
    var fMapRel = {};
    fixoPerfsRel.forEach(function(r){
      var k = r.code;
      if(!fMapRel[k]) fMapRel[k] = {code:r.code, desc:r.desc, cuts:[], totalKg:0};
      var barras = Math.ceil(r.mm * r.qty / 6000);
      fMapRel[k].cuts.push({qty:r.qty, mm:r.mm, barras:barras});
      grandKg += 0; // fixos não têm kg no DB ainda
    });
    h += '<div style="border:1px solid #6c3483;border-radius:6px;margin-bottom:12px;overflow:hidden">';
    h += '<div style="background:#6c3483;padding:7px 12px"><span style="font-weight:800;font-size:13px;color:#fff">🔲 QUADRO FIXO</span></div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="background:#f3ecfa"><th style="padding:4px 8px">Qtd</th><th style="padding:4px 8px">Código</th><th style="padding:4px 8px">Tam (mm)</th><th style="padding:4px 8px">Barras 6m</th></tr></thead><tbody>';
    Object.keys(fMapRel).forEach(function(k){
      fMapRel[k].cuts.forEach(function(c, i){
        h += '<tr style="background:'+(i%2===0?'#faf7fc':'#fff')+'"><td style="padding:3px 8px;text-align:center;font-weight:700">'+c.qty+'</td><td style="padding:3px 8px;color:#6c3483;font-weight:600;font-size:9px">'+k+'</td><td style="padding:3px 8px;text-align:center">'+c.mm+'</td><td style="padding:3px 8px;text-align:center;font-weight:700;color:#6c3483">'+c.barras+'</td></tr>';
      });
    });
    h += '</tbody></table></div>';
  }

  h+='<div style="background:#003144;color:#fff;border-radius:6px;padding:8px 14px;display:flex;justify-content:flex-end;gap:30px;font-size:12px;font-weight:800"><span>TOTAL: '+grandKg.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' kg</span><span>R$ '+grandCusto.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</span></div>';
  _abrirDrawer('Relacao de Barras — Protocolo de Entrega de Materiais','Pesos arredondados Normal com 2 casas decimais',h);
}

function relatorioComponentes(){
  var content=document.getElementById('osa-content');
  if(!content||!content.innerHTML.trim()||content.innerHTML.indexOf('Nenhum')>=0){alert('Gere o levantamento de acessorios primeiro.');return;}
  var savedP={};
  try{var _s=localStorage.getItem('projetta_comp_precos');if(_s)savedP=JSON.parse(_s);}catch(e){}
  function getP(code){if(savedP[code]!==undefined)return savedP[code];for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===code)return COMP_DB[i].p||0;}return 0;}
  var rows=[];
  content.querySelectorAll('table').forEach(function(tbl){
    tbl.querySelectorAll('tr').forEach(function(tr){
      var tds=tr.querySelectorAll('td');
      if(tds.length>=4){
        var qty=parseInt(tds[0].textContent)||0,code=(tds[1].textContent||'').trim(),desc=(tds[2].textContent||'').trim();
        if(qty>0&&code){
          var item=null;for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===code){item=COMP_DB[i];break;}}
          var custoUn=getP(code);
          rows.push({code:code,desc:item?item.d:desc,forn:item?item.f:'OUTROS',qty:qty,un:item?item.u:'PC',custoUn:custoUn,custoTotal:custoUn*qty});
        }
      }
    });
  });
  if(!rows.length){alert('Nenhum componente encontrado.');return;}
  var groups={};rows.forEach(function(r){if(!groups[r.forn])groups[r.forn]=[];groups[r.forn].push(r);});
  var h='',grandTotal=0;
  for(var forn in groups){
    var items=groups[forn],subTotal=0;
    h+='<div style="border:1px solid #d5d8dc;border-radius:6px;margin-bottom:12px;overflow:hidden">';
    h+='<div style="background:#f0f4f6;padding:7px 12px"><span style="font-weight:800;font-size:13px;color:#c47012">REFERENCIA: '+forn+'</span></div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="background:#eee"><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Codigo</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Descricao</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Qtd</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Un.</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:right">Custo Liq.</th><th style="padding:4px 8px;border:0.5px solid #ddd;text-align:right">Custo Total</th></tr></thead><tbody>';
    items.forEach(function(it){
      subTotal+=it.custoTotal;
      h+='<tr><td style="padding:4px 8px;border:0.5px solid #eee;font-weight:600;color:#003144">'+it.code+'</td><td style="padding:4px 8px;border:0.5px solid #eee;font-size:9px;max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+it.desc.substring(0,70)+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:center">'+it.qty+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;color:#888">'+it.un+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:right">'+it.custoUn.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:right;font-weight:700;color:#003144">R$ '+it.custoTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</td></tr>';
    });
    h+='<tr style="background:#f8f8f8"><td colspan="4" style="padding:4px 8px;text-align:right;font-weight:700;font-size:10px;color:#1a3a4a">Subtotal:</td><td></td><td style="padding:4px 8px;text-align:right;font-weight:700;color:#1a5276">R$ '+subTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</td></tr>';
    h+='</tbody></table></div>';
    grandTotal+=subTotal;
  }
  h+='<div style="background:#003144;color:#fff;border-radius:6px;padding:8px 14px;display:flex;justify-content:flex-end;font-size:12px;font-weight:800"><span>TOTAL: R$ '+grandTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</span></div>';
  _abrirDrawer('Relacao de Componentes — IPI nao Incluso','Acessorios e componentes com custos por referencia',h);
}

function relatorioExpedicao(){
  var content=document.getElementById('osa-content');
  if(!content||!content.innerHTML.trim()||content.innerHTML.indexOf('Nenhum')>=0){alert('Gere o levantamento de acessorios primeiro.');return;}
  var rows=[];
  content.querySelectorAll('table').forEach(function(tbl){
    tbl.querySelectorAll('tr').forEach(function(tr){
      var tds=tr.querySelectorAll('td');
      if(tds.length>=4){
        var qty=parseInt(tds[0].textContent)||0,code=(tds[1].textContent||'').trim(),desc=(tds[2].textContent||'').trim();
        if(qty>0&&code){
          var item=null;for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===code){item=COMP_DB[i];break;}}
          rows.push({code:code,desc:item?item.d:desc,qty:qty,un:item?item.u:'PC'});
        }
      }
    });
  });
  if(!rows.length){alert('Nenhum componente encontrado.');return;}
  var h='<div style="border:1px solid #d5d8dc;border-radius:6px;overflow:hidden">';
  h+='<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="background:#eee"><th style="padding:5px 8px;border:0.5px solid #ddd;text-align:center;width:30px">OK</th><th style="padding:5px 8px;border:0.5px solid #ddd;text-align:left">Codigo</th><th style="padding:5px 8px;border:0.5px solid #ddd;text-align:left">Descricao</th><th style="padding:5px 8px;border:0.5px solid #ddd;text-align:center">Qtd</th><th style="padding:5px 8px;border:0.5px solid #ddd;text-align:center">Un.</th><th style="padding:5px 8px;border:0.5px solid #ddd;width:80px">Conferido</th></tr></thead><tbody>';
  rows.forEach(function(r){
    h+='<tr><td style="padding:5px 8px;border:0.5px solid #eee;text-align:center;font-size:16px">&#9744;</td><td style="padding:4px 8px;border:0.5px solid #eee;font-weight:600;color:#003144;font-size:10px">'+r.code+'</td><td style="padding:4px 8px;border:0.5px solid #eee;font-size:9px;max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+r.desc.substring(0,65)+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;font-weight:700">'+r.qty+'</td><td style="padding:4px 8px;border:0.5px solid #eee;text-align:center;color:#888">'+r.un+'</td><td style="padding:4px 8px;border:0.5px solid #eee"></td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="margin-top:14px;display:flex;gap:24px"><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#003144">Conferido por:</div><div style="border-bottom:1px solid #ccc;height:28px;margin-top:6px"></div></div><div style="flex:0 0 200px"><div style="font-size:10px;font-weight:700;color:#003144">Data:</div><div style="border-bottom:1px solid #ccc;height:28px;margin-top:6px"></div></div></div>';
  _abrirDrawer('Relacao de Expedicao — Conferencia de Materiais','Checklist de acessorios para conferencia antes da saida',h);
}
function _getRelDados(){
  return {
    cliente: ($('cliente')||{value:''}).value||'—',
    agp: ($('num-agp')||{value:''}).value||'—',
    atp: ($('num-atp')||{value:''}).value||'—',
    resp: ($('responsavel')||{value:''}).value||'—',
    telefone: ($('cli-telefone')||{value:''}).value||'',
    email: ($('cli-email')||{value:''}).value||'',
    rua: ($('atp-rua')||{value:''}).value||'',
    numero: ($('atp-numero')||{value:''}).value||'',
    bairro: ($('atp-bairro')||{value:''}).value||'',
    complemento: ($('atp-complemento')||{value:''}).value||'',
    cidade: ($('atp-cidade')||{value:''}).value||'',
    cep: ($('atp-cep')||{value:''}).value||($('cep-cliente')||{value:''}).value||'',
    largura: ($('largura')||{value:''}).value||'—',
    altura: ($('altura')||{value:''}).value||'—',
    qtd: ($('qtd-portas')||{value:'1'}).value||'1',
    logoSrc: (document.querySelector('.header-brand img')||{src:''}).src
  };
}

function _relCSS(){
  return 'body{font-family:Montserrat,Arial,sans-serif;font-size:10px;color:#222;margin:0;padding:14px 18px}'
    +'@page{size:A4 portrait;margin:8mm}'
    +'*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
    +'.rel-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;gap:16px}'
    +'.rel-hdr img{height:50px}'
    +'.rel-hdr-right{text-align:right}'
    +'.rel-title{font-size:16px;font-weight:800;color:#003144;margin:0}'
    +'.rel-emitido{font-size:10px;color:#666;margin:2px 0}'
    +'.rel-info{display:grid;grid-template-columns:1fr 1fr;gap:0;font-size:10px;border:1.5px solid #003144;margin-bottom:10px}'
    +'.rel-info>div{display:flex;border-bottom:0.5px solid #ddd;padding:4px 8px}'
    +'.rel-lbl{font-weight:700;color:#003144;min-width:70px;display:inline-block;font-size:10px}'
    +'.rel-val{color:#222;font-size:10px}'
    +'.rel-section{font-size:12px;font-weight:800;color:#003144;text-decoration:underline;margin:12px 0 6px;padding:4px 0}'
    +'.rel-lines{min-height:80px;border-top:1px solid #ccc}'
    +'.rel-line{border-bottom:1px solid #eee;height:24px}'
    +'.rel-footer{margin-top:16px;font-size:8px;color:#888;display:flex;justify-content:space-between;border-top:2px solid #003144;padding-top:4px}'
    +'table.rel-tbl{width:100%;border-collapse:collapse;margin:8px 0}table.rel-tbl th{background:#003144;color:#fff;padding:4px 6px;font-size:9px;text-align:left}'
    +'table.rel-tbl td{padding:4px 6px;border:0.5px solid #ddd;font-size:9px}'
    +'.rel-decl{background:#f5f0e8;border:2px solid #003144;border-radius:6px;padding:10px;font-size:10px;font-weight:700;color:#003144;line-height:1.5;margin-top:16px}'
    +'.rel-sign{margin-top:20px;text-align:center}.rel-sign-line{border-bottom:1px solid #333;width:260px;margin:24px auto 4px;height:1px}.rel-sign-lbl{font-size:9px;color:#666}'
    +'.noprint{margin-top:12px}@media print{.noprint{display:none!important}}';
}

function _relInfoBlock(w, d){
  var endereco = d.rua+(d.numero?', '+d.numero:'');
  w.document.write('<div class="rel-info">');
  w.document.write('<div><span class="rel-lbl">Cliente:</span> '+d.cliente+'</div>');
  w.document.write('<div><span class="rel-lbl">Tel.:</span> '+d.telefone+'</div>');
  w.document.write('<div><span class="rel-lbl">Endereço:</span> '+endereco+'</div>');
  w.document.write('<div><span class="rel-lbl">Bairro:</span> '+d.bairro+'</div>');
  w.document.write('<div><span class="rel-lbl">Cidade:</span> '+d.cidade+'</div>');
  w.document.write('<div><span class="rel-lbl">CEP:</span> '+d.cep+'</div>');
  w.document.write('</div>');
}

function _relPrintBtn(w){
  w.document.write('<div class="noprint" style="text-align:center"><button onclick="window.print()" style="padding:10px 24px;background:#1a5276;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer">🖨 Imprimir</button></div>');
}
function gerarRelNaoConformidade(){
  var d = _getRelDados();
  var w = window.open('','','width=900,height=800');
  w.document.write('<html><head><title>Não Conformidade — '+d.agp+'</title><style>'+_relCSS()+'</style></head><body>');
  _relHeaderBar(w, d);
  w.document.write('<div class="rel-hdr">');
  if(d.logoSrc) w.document.write('<img src="'+d.logoSrc+'" alt="Projetta">');
  w.document.write('<div class="rel-hdr-right"><div class="rel-title">Relatório Não Conformidade:<br>'+d.agp+'</div><div class="rel-emitido">Emitido por: '+d.resp+'</div></div></div>');
  _relInfoBlock(w, d);
  w.document.write('<div style="text-align:center;font-weight:800;font-size:12px;color:#003144;margin:10px 0;border:1.5px solid #003144;padding:5px">DADOS GERAIS</div>');
  w.document.write('<div style="margin-bottom:6px"><span class="rel-lbl">RESPONSÁVEL(IS) PELA INSTALAÇÃO / MANUTENÇÃO:</span></div>');
  w.document.write('<div class="rel-lines"><div class="rel-line"></div><div class="rel-line"></div></div>');
  w.document.write('<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0"><div><span class="rel-lbl">DATA DE INÍCIO:</span><div class="rel-line" style="margin-top:6px"></div></div>');
  w.document.write('<div><span class="rel-lbl">DATA DE TÉRMINO:</span><div class="rel-line" style="margin-top:6px"></div></div></div>');
  w.document.write('<div class="rel-section">NÃO CONFORMIDADES DURANTE A FABRICAÇÃO</div>');
  for(var i=0;i<8;i++) w.document.write('<div class="rel-line"></div>');
  w.document.write('<div class="rel-section">NÃO CONFORMIDADES DURANTE A INSTALAÇÃO</div>');
  for(var i=0;i<8;i++) w.document.write('<div class="rel-line"></div>');
  w.document.write('<div class="rel-section">SERVIÇO PENDENTE / MATERIAIS A SEREM FABRICADOS</div>');
  for(var i=0;i<6;i++) w.document.write('<div class="rel-line"></div>');
  w.document.write('<div class="rel-footer" style="justify-content:center"><span style="font-weight:800;font-size:10px;color:#003144">PROJETTA PORTAS EXCLUSIVAS LTDA</span></div>');
  _relPrintBtn(w);
  w.document.write('</body></html>');
  w.document.close();
}

function _relHeaderBar(w, d){
  w.document.write('<div style="display:flex;align-items:center;border:1.5px solid #003144;border-radius:4px;padding:6px 14px;margin-bottom:14px;gap:14px">');
  if(d.logoSrc) w.document.write('<img src="'+d.logoSrc+'" style="height:42px" alt="Projetta">');
  w.document.write('<div style="border-left:1.5px solid #ddd;padding-left:14px"><div style="font-size:13px;font-weight:800;color:#003144;letter-spacing:.04em">PROJETTA PORTAS EXCLUSIVAS LTDA</div>');
  w.document.write('<div style="font-size:8px;color:#777;margin-top:1px">CNPJ 35.582.302/0001-08 &middot; Av. dos Siquierolis, 51 &mdash; Bairro N. Sra. das Gra&ccedil;as &middot; CEP 38401-708</div>');
  w.document.write('</div></div>');
}

function gerarRelEntrega(){
  var d = _getRelDados();
  var endereco = d.rua+(d.numero?', '+d.numero:'');
  var w = window.open('','','width=900,height=900');
  w.document.write('<!DOCTYPE html><html><head><title>Entrega - '+d.atp+'</title><style>');
  w.document.write('body{font-family:Montserrat,Arial,sans-serif;font-size:10px;color:#222;margin:0;padding:14px 20px}');
  w.document.write('@page{size:A4 portrait;margin:8mm}');
  w.document.write('*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box}');
  w.document.write('.title{font-size:20px;font-weight:800;color:#003144;text-align:right;margin-bottom:2px}');
  w.document.write('.emitido{font-size:9px;color:#666;text-align:right}');
  w.document.write('.info{margin:12px 0;font-size:10px}');
  w.document.write('.info-row{display:flex;gap:0;margin-bottom:0}');
  w.document.write('.info-left{flex:1;padding:4px 0;border-bottom:0.5px solid #ccc}');
  w.document.write('.info-right{flex:0 0 45%;padding:4px 0;border-bottom:0.5px solid #ccc}');
  w.document.write('.lbl{font-weight:800;color:#003144;min-width:80px;display:inline-block}');
  w.document.write('table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10px}');
  w.document.write('th{background:#003144;color:#fff;padding:5px 8px;font-size:9px;font-weight:700;text-align:left}');
  w.document.write('td{padding:5px 8px;border:0.5px solid #ddd}');
  w.document.write('.section{font-size:11px;font-weight:800;color:#222;margin:10px 0 4px}');
  w.document.write('.line{border-bottom:1px solid #ddd;height:18px}');
  w.document.write('.decl{background:#f8f4ec;border:2px solid #003144;padding:10px 12px;font-size:9px;font-weight:700;color:#003144;line-height:1.5;margin-top:12px}');
  w.document.write('.sign-area{display:flex;justify-content:space-between;margin-top:14px;gap:20px}');
  w.document.write('.sign-left{flex:0 0 200px}');
  w.document.write('.sign-right{flex:1;display:flex;flex-direction:column;gap:16px}');
  w.document.write('.sign-box{border-bottom:1px solid #333;padding-bottom:4px;text-align:center}');
  w.document.write('.sign-lbl{font-size:9px;color:#888;text-align:right;margin-top:2px}');
  w.document.write('.footer{margin-top:20px;font-size:8px;color:#888;display:flex;justify-content:space-between;border-top:1.5px solid #003144;padding-top:4px}');
  w.document.write('.noprint{margin-top:12px}@media print{.noprint{display:none!important}}');
  w.document.write('</style></head><body>');

  // Header bar
  _relHeaderBar(w, d);

  // Title
  w.document.write('<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">');
  w.document.write('<div></div>');
  w.document.write('<div><div class="title">Comprovante de Entrega e Instala&ccedil;&atilde;o</div>');
  w.document.write('<div class="emitido">Emitido por: '+d.resp.toUpperCase()+'</div></div>');
  w.document.write('</div>');

  // Info block (matching CEM layout exactly)
  w.document.write('<div class="info">');
  w.document.write('<div class="info-row"><div class="info-left"><span class="lbl">Cliente:</span> '+d.cliente.toUpperCase()+'</div><div class="info-right"><span class="lbl">Tel.:</span> '+d.telefone+'</div></div>');
  w.document.write('<div class="info-row"><div class="info-left"><span class="lbl">Obra:</span> '+d.atp+'</div><div class="info-right"><span class="lbl">Contato:</span> </div></div>');
  w.document.write('<div class="info-row"><div class="info-left"><span class="lbl">Endere&ccedil;o:</span> '+endereco+'</div><div class="info-right"><span class="lbl">Bairro:</span> '+d.bairro+'</div></div>');
  w.document.write('<div class="info-row"><div class="info-left"><span class="lbl">Cidade:</span> '+d.cidade+'</div><div class="info-right"></div></div>');
  w.document.write('</div>');

  // Table
  w.document.write('<table><thead><tr><th style="width:30px"></th><th style="width:40px">Tipo</th><th style="width:40px">Qtde</th><th>Descri&ccedil;&atilde;o</th><th style="width:50px;text-align:center">L</th><th style="width:20px;text-align:center">x</th><th style="width:50px;text-align:center">H</th><th>Localiza&ccedil;&atilde;o</th></tr></thead><tbody>');
  w.document.write('<tr><td style="text-align:center;font-weight:700">1</td><td style="text-align:center">1</td><td style="text-align:center">'+d.qtd+'</td><td>PORTA PROJETTA BY WEIKU</td><td style="text-align:center">'+d.largura+'</td><td style="text-align:center;font-weight:700">x</td><td style="text-align:center">'+d.altura+'</td><td></td></tr>');
  w.document.write('</tbody></table>');

  // Feedback Cliente
  w.document.write('<div class="section">Feedback Cliente:</div>');
  for(var i=0;i<8;i++) w.document.write('<div class="line"></div>');

  // Observacoes Tecnicas
  w.document.write('<div class="section">Observa&ccedil;&otilde;es T&eacute;cnicas:</div>');
  for(var i=0;i<10;i++) w.document.write('<div class="line"></div>');

  // Itens Entregues
  w.document.write('<div class="section">Itens Entregues:</div>');
  for(var i=0;i<5;i++) w.document.write('<div class="line"></div>');

  // Declaracao
  w.document.write('<div class="decl">DECLARO, PARA OS DEVIDOS FINS, QUE RECEBI OS PRODUTOS ACIMA DESCRITOS EM PERFEITAS CONDI&Ccedil;&Otilde;ES DE USO E FUNCIONAMENTO, EM CONFORMIDADE COM O CONTRATO FIRMADO, TENDO CONFERIDO INTEGRALMENTE TODOS OS ITENS NO ATO DA ENTREGA E INSTALA&Ccedil;&Atilde;O.</div>');

  // Signature area (matching CEM layout)
  w.document.write('<div class="sign-area">');
  w.document.write('<div class="sign-left"><div style="margin-top:20px;font-size:11px">Data: _____/_____/______</div></div>');
  w.document.write('<div class="sign-right">');
  w.document.write('<div><div class="sign-box" style="min-width:280px">&nbsp;</div><div class="sign-lbl">Nome Leg&iacute;vel</div></div>');
  w.document.write('<div><div class="sign-box" style="min-width:280px">&nbsp;</div><div class="sign-lbl">Fun&ccedil;&atilde;o</div></div>');
  w.document.write('<div><div class="sign-box" style="min-width:280px">&nbsp;</div><div class="sign-lbl">Assinatura</div></div>');
  w.document.write('</div></div>');

  // Footer
  w.document.write('<div class="footer" style="margin-top:12px;font-size:8px;color:#888;display:flex;justify-content:center;border-top:1.5px solid #003144;padding-top:4px"><span style="font-weight:800;font-size:10px;color:#003144">PROJETTA PORTAS EXCLUSIVAS LTDA</span></div>');

  // Print button
  w.document.write('<div class="noprint" style="text-align:center"><button onclick="window.print()" style="padding:10px 24px;background:#003144;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#128424; Imprimir</button></div>');
  w.document.write('</body></html>');
  w.document.close();
}
function gerarResumoCustos(){
  function rv(id){var e=document.getElementById(id);if(!e)return 0;var t=(e.textContent||e.value||'').replace(/[R$\s\.]/g,'').replace(',','.');return parseFloat(t)||0;}
  function n(id){var e=document.getElementById(id);return e?parseFloat(e.value)||0:0;}
  var W=n('largura')/1000,H=n('altura')/1000,m2=W*H;
  var qP=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
  var cliente=(document.getElementById('cliente')||{value:''}).value||'---';
  var agp=(document.getElementById('num-agp')||{value:''}).value||'---';
  var atp=(document.getElementById('num-atp')||{value:''}).value||'---';
  var _p=(typeof _getParams==='function')?_getParams():{sis:'PA007'};
  var sistema=_p.sis||'PA007';
  var fabMat=n('fab-mat-perfis')||0,fabPin=n('fab-custo-pintura')||0,fabAcess=n('fab-custo-acess')||0;
  var pesoLiq=0,pesoBru=0;
  if(window._lastOSData){var d=window._lastOSData;d.seenKeys.forEach(function(key){var r=d.groupRes[key];if(!r||r.nBars===0)return;pesoLiq+=r.kgLiq||0;pesoBru+=r.kgBruto||0;});}
  var sobraKg=pesoBru-pesoLiq,sobraPct=pesoBru>0?(sobraKg/pesoBru*100):0;
  var pSLEl=document.getElementById('plan-peso-liq'),pSBEl=document.getElementById('plan-peso-bruto');
  var pesoSupLiq=pSLEl?parseFloat((pSLEl.textContent||'0').replace(/[^\d.,]/g,'').replace(',','.'))||0:0;
  var pesoSupBru=pSBEl?parseFloat((pSBEl.textContent||'0').replace(/[^\d.,]/g,'').replace(',','.'))||0:0;
  var totalH=(n('h-portal')+n('h-quadro')+n('h-corte')+n('h-colagem')+n('h-conf'))*2;
  var cH=n('custo-hora'),subMO=totalH*cH;
  var subAcm=rv('sub-acm'),subAlu=rv('sub-alu'),subInst=rv('r-inst');
  var ov=n('overhead')/100;
  var subFab=subAcm+subAlu+fabMat+fabPin+fabAcess+subMO;
  var custoTotal=subFab+subInst+(subFab+subInst)*ov;
  var pTab=rv('m-tab'),pFat=rv('m-fat');
  var mkp=custoTotal>0?((pTab/custoTotal-1)*100):0;
  function brl(v){return'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function fmt(v){return v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function pct(v){return v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';}

  var w=window.open('','_blank','width=700,height=900');
  w.document.write('<!DOCTYPE html><html><head><title>Resumo de Custos</title><style>');
  w.document.write('*{box-sizing:border-box;margin:0;padding:0}');
  w.document.write('body{font-family:Montserrat,Segoe UI,Arial,sans-serif;background:#f7f6f3;color:#2c2c2c;padding:16px}');
  w.document.write('@page{size:A4 portrait;margin:10mm}');
  w.document.write('.pg{max-width:600px;margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.06);overflow:hidden}');
  w.document.write('.hdr{background:linear-gradient(135deg,#003144,#00526b);color:#fff;padding:16px 20px}');
  w.document.write('.hdr h1{font-size:14px;font-weight:800;letter-spacing:.04em}');
  w.document.write('.hdr-sub{font-size:9px;opacity:.65;margin-top:2px}');
  w.document.write('.hdr-info{font-size:9px;opacity:.8;margin-top:6px;line-height:1.5}');
  w.document.write('.body{padding:16px 20px}');
  w.document.write('.card{border:1px solid #d5d8dc;border-radius:6px;margin-bottom:10px;overflow:hidden}');
  w.document.write('.card-h{background:#f0f4f6;padding:6px 12px;font-size:10px;font-weight:800;color:#c47012;text-transform:uppercase;letter-spacing:.06em}');
  w.document.write('.r{display:flex;justify-content:space-between;padding:4px 12px;font-size:10px;border-bottom:0.5px solid #f5f3ef}');
  w.document.write('.r:last-child{border-bottom:none}');
  w.document.write('.r .l{color:#777}');
  w.document.write('.r .v{font-weight:700;color:#003144}');
  w.document.write('.sep{border:none;border-top:1px solid #f0ede8;margin:0}');
  w.document.write('.total{background:#003144;color:#fff;border-radius:6px;padding:14px 16px;margin-bottom:10px}');
  w.document.write('.total .card-h{background:transparent;color:rgba(255,255,255,.5);padding:0 0 6px}');
  w.document.write('.total .r{border-bottom-color:rgba(255,255,255,.1)}');
  w.document.write('.total .r .l{color:rgba(255,255,255,.65)}');
  w.document.write('.total .r .v{color:#fff}');
  w.document.write('.total .big{font-size:16px;font-weight:800}');
  w.document.write('.total .gold{color:#f0c040}');
  w.document.write('.total .green{color:#6ee6a0}');
  w.document.write('.foot{text-align:center;font-size:8px;color:#bbb;padding:10px 20px;border-top:1px solid #f0ede8}');
  w.document.write('.noprint{margin:12px auto;text-align:center}');
  w.document.write('@media print{body{background:#fff;padding:0}.pg{box-shadow:none;border-radius:0}.noprint{display:none!important}}');
  w.document.write('</style></head><body>');

  w.document.write('<div class="pg">');
  w.document.write('<div class="hdr"><h1>RESUMO DE CUSTOS</h1>');
  w.document.write('<div class="hdr-sub">Projetta Portas Exclusivas &mdash; '+new Date().toLocaleDateString('pt-BR')+'</div>');
  w.document.write('<div class="hdr-info">Cliente: <b>'+cliente+'</b> &nbsp;&middot;&nbsp; AGP: '+agp+' &nbsp;&middot;&nbsp; ATP: '+atp+'<br>'+sistema+' &nbsp;&middot;&nbsp; '+n('largura')+'&times;'+n('altura')+'mm &nbsp;&middot;&nbsp; '+fmt(m2)+' m&sup2;</div>');
  w.document.write('</div><div class="body">');

  // Perfis
  w.document.write('<div class="card"><div class="card-h">Perfis</div>');
  w.document.write('<div class="r"><span class="l">Peso L&iacute;quido</span><span class="v">'+fmt(pesoLiq)+' kg</span></div>');
  w.document.write('<div class="r"><span class="l">Peso Bruto</span><span class="v">'+fmt(pesoBru)+' kg</span></div>');
  w.document.write('<div class="r"><span class="l">Sobras</span><span class="v">'+fmt(sobraKg)+' kg ('+pct(sobraPct)+')</span></div>');
  w.document.write('<hr class="sep">');
  w.document.write('<div class="r"><span class="l">Material</span><span class="v">'+brl(fabMat)+'</span></div>');
  w.document.write('<div class="r"><span class="l">Pintura</span><span class="v">'+brl(fabPin)+'</span></div>');
  w.document.write('<div class="r" style="background:#f8f8f8"><span class="l"><b>Total Perfis</b></span><span class="v"><b>'+brl(fabMat+fabPin)+'</b></span></div>');
  w.document.write('</div>');

  // Acabamento + Superficies
  w.document.write('<div class="card"><div class="card-h">Acabamento / Chapas</div>');
  w.document.write('<div class="r"><span class="l">Peso L&iacute;q. ACM</span><span class="v">'+fmt(pesoSupLiq)+' kg</span></div>');
  w.document.write('<div class="r"><span class="l">Peso Bruto ACM</span><span class="v">'+fmt(pesoSupBru)+' kg</span></div>');
  w.document.write('<hr class="sep">');
  w.document.write('<div class="r"><span class="l">ACM</span><span class="v">'+brl(subAcm)+'</span></div>');
  w.document.write('<div class="r"><span class="l">Alum&iacute;nio</span><span class="v">'+brl(subAlu)+'</span></div>');
  w.document.write('<div class="r" style="background:#f8f8f8"><span class="l"><b>Total Chapas</b></span><span class="v"><b>'+brl(subAcm+subAlu)+'</b></span></div>');
  w.document.write('</div>');

  // Acessorios
  w.document.write('<div class="card"><div class="card-h">Acess&oacute;rios</div>');
  w.document.write('<div class="r"><span class="l"><b>Total</b></span><span class="v"><b>'+brl(fabAcess)+'</b></span></div>');
  w.document.write('</div>');

  // Mao de Obra
  w.document.write('<div class="card"><div class="card-h">M&atilde;o de Obra</div>');
  w.document.write('<div class="r"><span class="l">Horas</span><span class="v">'+totalH+' h</span></div>');
  w.document.write('<div class="r"><span class="l">R$/hora</span><span class="v">'+brl(cH)+'</span></div>');
  w.document.write('<div class="r" style="background:#f8f8f8"><span class="l"><b>Total MO</b></span><span class="v"><b>'+brl(subMO)+'</b></span></div>');
  w.document.write('</div>');

  // Fabricacao
  w.document.write('<div class="card"><div class="card-h">Fabrica&ccedil;&atilde;o</div>');
  w.document.write('<div class="r"><span class="l">Perfis</span><span class="v">'+brl(fabMat+fabPin)+'</span></div>');
  w.document.write('<div class="r"><span class="l">Chapas</span><span class="v">'+brl(subAcm+subAlu)+'</span></div>');
  w.document.write('<div class="r"><span class="l">Acess&oacute;rios</span><span class="v">'+brl(fabAcess)+'</span></div>');
  w.document.write('<div class="r"><span class="l">M&atilde;o de Obra</span><span class="v">'+brl(subMO)+'</span></div>');
  w.document.write('<div class="r" style="background:#f8f8f8"><span class="l"><b>Subtotal Fab.</b></span><span class="v"><b>'+brl(subFab)+'</b></span></div>');
  w.document.write('</div>');

  // Instalacao
  w.document.write('<div class="card"><div class="card-h">Instala&ccedil;&atilde;o</div>');
  w.document.write('<div class="r"><span class="l">Total Instal.</span><span class="v">'+brl(subInst)+'</span></div>');
  w.document.write('<div class="r"><span class="l">Overhead ('+n('overhead')+'%)</span><span class="v">'+brl((subFab+subInst)*ov)+'</span></div>');
  w.document.write('</div>');

  // Resumo Geral
  w.document.write('<div class="total"><div class="card-h">RESUMO GERAL</div>');
  w.document.write('<div class="r"><span class="l">Custo Total</span><span class="v big">'+brl(custoTotal)+'</span></div>');
  w.document.write('<div class="r"><span class="l">Markup</span><span class="v">'+pct(mkp)+'</span></div>');
  w.document.write('<div class="r"><span class="l">Valor Tabela</span><span class="v big gold">'+brl(pTab)+'</span></div>');
  w.document.write('<div class="r"><span class="l">Valor Faturamento</span><span class="v big green">'+brl(pFat)+'</span></div>');
  w.document.write('</div>');

  w.document.write('</div>');// body
  w.document.write('<div class="foot">Projetta Portas Exclusivas LTDA &mdash; CNPJ 35.582.302/0001-08 &mdash; '+new Date().toLocaleString('pt-BR')+'</div>');
  w.document.write('</div>');// pg
  w.document.write('<div class="noprint"><button onclick="window.print()" style="padding:10px 24px;background:#003144;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#128424; Imprimir</button></div>');
  w.document.write('</body></html>');
  w.document.close();
}
function imprimirOS(){
  if(!document.getElementById('os-doc')||document.getElementById('os-doc').style.display==='none'){
    alert('Gere a OS primeiro.');return;
  }
  // Inject logo and info
  var mainLogo = document.querySelector('.header-brand img');
  var printLogo = document.getElementById('os-print-logo');
  if(mainLogo && printLogo) printLogo.src = mainLogo.src;
  var info = document.getElementById('os-print-info');
  if(info){
    var cli=($('cliente')||{value:''}).value||'—';
    var agp=($('num-agp')||{value:''}).value||'—';
    var atp=($('num-atp')||{value:''}).value||'—';
    info.textContent='Cliente: '+cli+'  |  AGP: '+agp+'  |  ATP: '+atp;
  }
  var orig=document.title;
  document.title='OS Corte de Perfis — Projetta';
  document.body.classList.add('print-os');
  window.print();
  document.body.classList.remove('print-os');
  document.title=orig;
}

/* ═══════════════════════════════════════════════════
   OS COLAGEM — Relatório estilo CEM Pro
   Gera OS completa com perfis, componentes e chapas
═══════════════════════════════════════════════════ */
function printOSColagem(){
  if(!window._lastOSData){alert('Gere a OS primeiro (clique em ⚙ Gerar OS).');return;}
  var d=window._lastOSData;
  var rd=_getRelDados();
  var L=parseFloat(($('largura')||{value:0}).value)||0;
  var H=parseFloat(($('altura')||{value:0}).value)||0;
  var nFolhas=parseInt(($('folhas-porta')||{value:1}).value)||1;
  var modelo=($('carac-modelo')||{value:''}).value||($('plan-modelo')||{value:''}).value||'01';
  var modeloNome={'01':'CAVA','02':'CAVA+FRISO','08':'CAVA+RIPAS','10':'LISA','11':'FRISO','15':'RIPAS','22':'CAVA PREMIUM','23acm':'MOLDURA ACM','23alu':'MOLDURA ALU'}[modelo]||modelo;
  var TUB=(typeof _isInternacional==='function'&&_isInternacional())?51:(H>=4000?51:38);
  var sis=d.sis||($('prod-sistema')||{value:''}).value||'PA006';

  // Dimensões: Vão, Porta, Portal
  var folgaL=20,folgaH=10;
  var portaL=L-folgaL-343+218+40; // approx from system
  var portaH=H-folgaH-TUB-28+8+116;
  // Simplificado: usar L/H do vão e calcular portal
  var portalL=L-folgaL;
  var portalH=H-folgaH;
  var portaLarg=Math.round(L-145);
  var portaAlt=Math.round(H-85);

  // Config técnica
  var _v=function(id){var e=$(id);return e?(e.tagName==='SELECT'?(e.options[e.selectedIndex]||{}).text||e.value:e.value):'';}
  var corExt=_v('carac-cor-ext')||'';
  var corInt=_v('carac-cor-int')||'';
  var abertura=_v('carac-abertura')||'PIVOTANTE';
  var fechMec=_v('carac-fech-mec')||'';
  var fechDig=_v('carac-fech-dig')||'';
  var puxador=_v('carac-puxador')||'';
  var cilindro=_v('carac-cilindro')||'';

  // Perfis: extrair de d.cuts + d.groupRes
  var perfisRows=[];
  var pesoTotal=0;
  d.seenKeys.forEach(function(key){
    var r=d.groupRes[key];if(!r||r.nBars===0)return;
    var cuts=d.cuts.filter(function(c){return c.code===key&&c.qty>0;});
    cuts.forEach(function(c){
      var kgLiq=c.compMM/1000*c.kgM*c.qty;
      pesoTotal+=kgLiq;
      var ip=d.isPintado(c.code);
      perfisRows.push({
        code:c.code, lh:'90/90', tamanho:c.compMM, qty:c.qty,
        peso:kgLiq, obs:c.desc||c.label||'', tipo:ip?'BNF-PA-TECNOPERFIL':'BRUTO'
      });
    });
  });

  // Acessórios
  var acessRows=[];
  try{
    var _ar=_calcAcessoriosOS(d,nFolhas,sis);
    _ar.forEach(function(r){
      acessRows.push({code:r.code||r.cod||'',desc:r.desc||r.nome||'',qty:r.qty||0,unid:r.unid||'PC',obs:r.obs||'',aplic:'FÁBRICA'});
    });
  }catch(e){console.warn('OS Colagem: acessórios não disponíveis',e);}

  // Chapas / Superfícies
  var chapasRows=[];
  try{
    var fol=nFolhas;
    var mod=modelo;
    var pieces=aprovPieces(L,H,fol,mod);
    // Adicionar peças dos fixos
    var _tfOS=document.getElementById('tem-fixo');
    if(_tfOS&&_tfOS.checked){
      document.querySelectorAll('.fixo-blk').forEach(function(el){
        var Lf=parseFloat((el.querySelector('.fixo-larg')||{value:0}).value)||0;
        var Af=parseFloat((el.querySelector('.fixo-alt')||{value:0}).value)||0;
        var ld=parseInt((el.querySelector('.fixo-lados')||{value:1}).value)||1;
        var qf=parseInt((el.querySelector('.fixo-qty')||{value:1}).value)||1;
        if(Lf>0&&Af>0){
          var _tipo=(el.querySelector(".fixo-tipo")||{value:"superior"}).value;
          var fp=_tipo==="superior"?aprovFixoPieces(L,H,Lf,Af,ld,mod):[{label:"FX LATERAL",w:Lf+100,h:Af+100,qty:ld,color:APROV_COLORS[15]}];
          if(qf>1) fp.forEach(function(p){p.qty=p.qty*qf;});
          pieces=pieces.concat(fp);
        }
      });
    }
    var chapaDesc=($('aprov-chapa-sel')||{value:''}).value||'BLACK DOOR 4X1500X6000';
    pieces.forEach(function(p){
      chapasRows.push({code:'HDKRAL',desc:chapaDesc,qty:p.qty,lxh:Math.round(p.w)+' x '+Math.round(p.h),obs:p.label});
    });
  }catch(e){console.warn('OS Colagem: chapas não disponíveis',e);}

  // Montar HTML
  var now=new Date();
  var dataStr=now.toLocaleDateString('pt-BR')+' '+now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  var w=window.open('','_blank','width=900,height=900');
  w.document.write('<!DOCTYPE html><html><head><title>OS Colagem — Projetta</title>');
  w.document.write('<style>');
  w.document.write('*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}');
  w.document.write('body{font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:10px;color:#222;margin:0;padding:0}');
  w.document.write('@page{size:A4 portrait;margin:8mm 10mm 12mm 10mm}');
  w.document.write('@media print{.noprint{display:none!important}.page-break{page-break-before:always}}');
  w.document.write('.page{padding:14px 20px;max-width:210mm;margin:0 auto}');
  // Header
  w.document.write('.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}');
  w.document.write('.hdr-logo{font-size:22px;font-weight:900;color:#1B3A5C;letter-spacing:1px}');
  w.document.write('.hdr-logo span{color:#E8732C}');
  w.document.write('.hdr-logo small{display:block;font-size:10px;color:#E8732C;font-weight:400;font-style:italic;letter-spacing:0}');
  w.document.write('.hdr-right{text-align:right}');
  w.document.write('.hdr-title{font-size:20px;font-weight:800;color:#1B3A5C}');
  w.document.write('.hdr-modelo{font-size:13px;font-weight:700;color:#222;margin-top:2px}');
  w.document.write('.hdr-qtd{font-size:10px;color:#666;font-style:italic}');
  w.document.write('.sep{height:2.5px;background:#E8732C;margin:6px 0 10px}');
  // Info block
  w.document.write('.info-tbl{width:100%;border-collapse:collapse;margin-bottom:6px}');
  w.document.write('.info-tbl td{padding:3px 6px;border-bottom:0.5px solid #ddd;font-size:10px}');
  w.document.write('.info-tbl .lbl{font-weight:700;color:#1B3A5C;width:100px}');
  w.document.write('.info-tbl .titulo{font-weight:700;font-style:italic;color:#222;font-size:10px}');
  // Sub header
  w.document.write('.sub-hdr{display:flex;justify-content:space-between;border-bottom:1.5px solid #1B3A5C;padding:3px 0 5px;margin-bottom:8px;font-size:10px;font-weight:700;color:#1B3A5C}');
  // Dim table
  w.document.write('.dim-tbl{border-collapse:collapse;margin:6px 0 10px}');
  w.document.write('.dim-tbl th,.dim-tbl td{padding:4px 14px;border:0.5px solid #ccc;font-size:10px;text-align:center}');
  w.document.write('.dim-tbl th{background:#f5f5f5;font-weight:700}');
  // Config
  w.document.write('.cfg{font-size:9px;line-height:1.6;margin:4px 0}');
  w.document.write('.cfg b{color:#1B3A5C}');
  // Section header
  w.document.write('.sec-hdr{background:#1B3A5C;color:#fff;font-size:9px;font-weight:700;padding:4px 8px;display:flex;justify-content:space-between}');
  // Data table
  w.document.write('table.dt{width:100%;border-collapse:collapse;font-size:9px}');
  w.document.write('table.dt th{background:#1B3A5C;color:#fff;padding:4px 6px;font-size:8px;font-weight:700;text-align:left;white-space:nowrap}');
  w.document.write('table.dt td{padding:3px 6px;border:0.5px solid #ddd;vertical-align:middle}');
  w.document.write('table.dt tr:nth-child(even){background:#f9f9f9}');
  w.document.write('table.dt .code{font-weight:700;font-size:9px}');
  w.document.write('table.dt .tipo{font-size:7px;color:#888;display:block}');
  w.document.write('table.dt .right{text-align:right}');
  w.document.write('table.dt .center{text-align:center}');
  w.document.write('.peso-total{text-align:right;font-weight:700;font-size:10px;border-top:1.5px solid #1B3A5C;padding:4px 6px;margin-top:2px}');
  // Aplicação label
  w.document.write('.aplic-lbl{background:#e8e8e8;font-weight:700;font-size:9px;padding:3px 8px;color:#1B3A5C}');
  // Footer
  w.document.write('.footer{position:fixed;bottom:0;left:0;right:0;padding:0 20px 6px}');
  w.document.write('.atencao{background:#C0392B;color:#fff;font-size:7px;font-weight:700;padding:3px 8px;margin-bottom:3px}');
  w.document.write('.foot-bar{display:flex;justify-content:space-between;font-size:7px;color:#888}');
  w.document.write('.foot-bar b{color:#1B3A5C;font-size:8px}');
  w.document.write('</style></head><body>');

  // ═══ PÁGINA 1: CAPA ═══
  w.document.write('<div class="page">');
  // Header
  w.document.write('<div class="hdr">');
  w.document.write('<div class="hdr-logo">PRO<span>JE</span>TTA<small>by weiku</small></div>');
  w.document.write('<div class="hdr-right"><div class="hdr-title">OS - Colagem</div>');
  w.document.write('<div class="hdr-modelo">Modelo: '+modelo+' - '+modeloNome+'</div>');
  w.document.write('<div class="hdr-qtd">('+rd.qtd+' unid.)</div></div></div>');
  w.document.write('<div class="sep"></div>');

  // Info cliente
  w.document.write('<table class="info-tbl">');
  w.document.write('<tr><td colspan="2" class="titulo">PORTA PROJETTA BY WEIKU</td></tr>');
  w.document.write('<tr><td class="lbl">Obra:</td><td>'+rd.agp+' - '+rd.atp+'</td></tr>');
  w.document.write('<tr><td class="lbl">Cliente:</td><td>'+rd.cliente+'</td></tr>');
  w.document.write('<tr><td class="lbl">Cor:</td><td>'+(corExt||'—')+'</td></tr>');
  w.document.write('<tr><td class="lbl">Projetista:</td><td>PROJETTA 2025</td></tr>');
  w.document.write('<tr><td class="lbl">Localização:</td><td></td></tr>');
  w.document.write('<tr><td class="lbl">Vidros:</td><td></td></tr>');
  w.document.write('<tr><td class="lbl">Obs:</td><td></td></tr>');
  w.document.write('</table>');

  w.document.write('<div style="text-align:right;font-size:7px;color:#888;margin:4px 0">Emitido por: '+rd.resp+' em '+dataStr+'</div>');

  // Dimensões
  w.document.write('<div style="font-weight:700;font-size:10px;color:#1B3A5C;margin-top:10px">Dimensões:</div>');
  w.document.write('<table class="dim-tbl">');
  w.document.write('<tr><th></th><th>Vão Acabado:</th><th>Porta:</th><th>Portal:</th></tr>');
  w.document.write('<tr><th>Largura:</th><td>'+L+'</td><td>'+portaLarg+'</td><td>'+portalL+'</td></tr>');
  w.document.write('<tr><th>Altura:</th><td>'+H+'</td><td>'+portaAlt+'</td><td>'+portalH+'</td></tr>');
  w.document.write('</table>');
  w.document.write('</div>');

  // ═══ PÁGINA 2: CONFIG + PERFIS ═══
  w.document.write('<div class="page-break"></div><div class="page">');
  w.document.write('<div class="sub-hdr"><span>Modelo: '+modelo+' - '+modeloNome+' ('+rd.qtd+' unid.)</span><span>Obra: '+rd.agp+' - '+rd.atp+'</span></div>');

  // Config técnica
  w.document.write('<div class="cfg">');
  var cfg=[
    ['FASE','PRODUÇÃO'],['SISTEMA',sis],['TIPO DE ABERTURA',abertura],
    ['NUMERO DE FOLHAS',nFolhas+' FOLHA'+(nFolhas>1?'S':'')],
    ['FOLGA LARGURA',folgaL],['FOLGA ALTURA',folgaH],
    ['TUBO DO PORTAL',TUB],['MODELO',modelo+' - '+modeloNome],
    ['FECHADURA MECÂNICA',fechMec],['FECHADURA DIGITAL',fechDig],
    ['PUXADOR',puxador],['CILINDRO',cilindro],
    ['COR CHAPA EXTERNA',corExt],['COR CHAPA INTERNA',corInt]
  ];
  cfg.forEach(function(c){
    if(c[1]) w.document.write('<b>'+c[0]+'</b> : '+c[1]+'<br>');
  });
  w.document.write('</div>');

  // Tabela Perfis
  w.document.write('<div class="sec-hdr"><span>PERFIS</span><span>PESO = Peso Líquido</span></div>');
  w.document.write('<table class="dt"><tr><th>Código</th><th>L/H</th><th>Tamanho</th><th>Quantidade</th><th>Peso</th><th>Observação</th></tr>');
  perfisRows.forEach(function(p){
    w.document.write('<tr>');
    w.document.write('<td><span class="code">'+p.code+'</span><span class="tipo">'+p.tipo+'</span></td>');
    w.document.write('<td class="center">'+p.lh+'</td>');
    w.document.write('<td class="center">'+p.tamanho+'</td>');
    w.document.write('<td class="center">'+p.qty+'</td>');
    w.document.write('<td class="right">'+p.peso.toFixed(3)+'</td>');
    w.document.write('<td>'+p.obs+'</td>');
    w.document.write('</tr>');
  });
  w.document.write('</table>');
  w.document.write('<div class="peso-total">Peso Total: '+pesoTotal.toFixed(3)+' kg</div>');
  w.document.write('</div>');

  // ═══ PÁGINA 3: COMPONENTES ═══
  if(acessRows.length>0){
    w.document.write('<div class="page-break"></div><div class="page">');
    w.document.write('<div class="sub-hdr"><span>Modelo: '+modelo+' - '+modeloNome+' ('+rd.qtd+' unid.)</span><span>Obra: '+rd.agp+' - '+rd.atp+'</span></div>');
    w.document.write('<div class="sec-hdr"><span>COMPONENTES</span></div>');
    w.document.write('<table class="dt"><tr><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Observação</th></tr>');
    w.document.write('<tr><td colspan="4" class="aplic-lbl">Aplicação: FÁBRICA</td></tr>');
    acessRows.forEach(function(a){
      w.document.write('<tr>');
      w.document.write('<td><span class="code">'+a.code+'</span></td>');
      w.document.write('<td>'+a.desc+'</td>');
      w.document.write('<td class="center">'+a.qty+' '+a.unid+'</td>');
      w.document.write('<td>'+a.obs+'</td>');
      w.document.write('</tr>');
    });
    w.document.write('</table></div>');
  }

  // ═══ PÁGINA 4: SUPERFÍCIES / CHAPAS ═══
  if(chapasRows.length>0){
    w.document.write('<div class="page-break"></div><div class="page">');
    w.document.write('<div class="sub-hdr"><span>Modelo: '+modelo+' - '+modeloNome+' ('+rd.qtd+' unid.)</span><span>Obra: '+rd.agp+' - '+rd.atp+'</span></div>');
    w.document.write('<div class="sec-hdr"><span>SUPERFÍCIES</span></div>');
    w.document.write('<table class="dt"><tr><th>Código</th><th>Descrição</th><th>Qtde</th><th>L x H</th><th>Observação</th></tr>');
    chapasRows.forEach(function(c){
      w.document.write('<tr>');
      w.document.write('<td><span class="code">'+c.code+'</span></td>');
      w.document.write('<td>'+c.desc+'</td>');
      w.document.write('<td class="center">'+c.qty+'</td>');
      w.document.write('<td class="center">'+c.lxh+'</td>');
      w.document.write('<td>'+c.obs+'</td>');
      w.document.write('</tr>');
    });
    w.document.write('</table></div>');
  }

  // Footer em todas as páginas (via CSS fixed)
  w.document.write('<div class="footer">');
  w.document.write('<div class="atencao">Atenção: Todos os resultados devem ser conferidos por profissional devidamente habilitado, previamente à execução dos serviços.</div>');
  w.document.write('<div class="foot-bar"><span>CEM Pro - Alumisoft Sistemas</span><b>PROJETTA PORTAS EXCLUSIVAS LTDA</b><span></span></div>');
  w.document.write('</div>');

  // Botão imprimir
  w.document.write('<div class="noprint" style="text-align:center;padding:20px"><button onclick="window.print()" style="padding:12px 30px;background:#1B3A5C;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🖨 Imprimir / Exportar PDF</button></div>');
  w.document.write('</body></html>');
  w.document.close();
}

/* ═══════════════════════════════════════════════════
   CLIENTES TAB — Visão por Cliente com Histórico
   Mostra clientes do CRM + Orçamentos salvos
═══════════════════════════════════════════════════ */
function renderClientesTab(){
  var body=$('cli-hist-body');if(!body)return;
  var db=loadDB();
  var crmData=[];try{crmData=JSON.parse(localStorage.getItem('projetta_crm_v1'))||[];}catch(e){}
  var searchEl=$('cli-hist-search');
  var q=searchEl?searchEl.value.toLowerCase().trim():'';
  var sortBy=($('cli-hist-sort')||{value:'recent'}).value;

  // Agrupar por cliente — combinar CRM + Orçamentos
  var groups={};

  // 1) CRM cards
  var _stagesMap={};
  try{
    var _st=JSON.parse(localStorage.getItem('projetta_crm_settings_v1'))||{};
    (_st.stages||[]).forEach(function(s){_stagesMap[s.id]=s;});
  }catch(e){}
  // Default stages
  if(!Object.keys(_stagesMap).length){
    [{id:'s1',label:'Prospecção',icon:'🎯'},{id:'s2',label:'Qualificação',icon:'🔍'},{id:'s3',label:'Fazer Orçamento',icon:'📋'},{id:'s4',label:'Proposta Enviada',icon:'📩'},{id:'s5',label:'Negociação',icon:'🤝'},{id:'s6',label:'Fechado ✅',icon:'🏆'},{id:'s7',label:'Perdido',icon:'❌'}].forEach(function(s){_stagesMap[s.id]=s;});
  }

  crmData.forEach(function(card){
    var cli=(card.cliente||'').trim();
    if(!cli)return;
    if(q){
      var text=cli+' '+(card.contato||'')+' '+(card.email||'')+' '+(card.agp||'')+' '+(card.reserva||'')+' '+(card.notas||'');
      if(text.toLowerCase().indexOf(q)<0)return;
    }
    if(!groups[cli])groups[cli]={name:cli,entries:[],crmCards:[],lastDate:'',totalVal:0};
    groups[cli].crmCards.push(card);
    if(card.valor)groups[cli].totalVal+=parseFloat(card.valor)||0;
    var dt=card.updatedAt||card.createdAt||'';
    if(dt>groups[cli].lastDate)groups[cli].lastDate=dt;
  });

  // 2) Orçamentos salvos — SÓ associar a clientes que JÁ têm CRM card
  db.forEach(function(e){
    if(q){
      var text=(e.name||'')+' '+(e.client||'')+' '+(e.project||'');
      if(e.revisions)e.revisions.forEach(function(r){text+=' '+(r.label||'');if(r.data){text+=' '+(r.data['num-atp']||'')+' '+(r.data['num-agp']||'')+' '+(r.data['numprojeto']||'');}});
      if(text.toLowerCase().indexOf(q)<0)return;
    }
    var cli=(e.client||'Sem cliente').trim();
    if(!cli)cli='Sem cliente';
    // SÓ adicionar se o cliente já existe no CRM (groups já tem o nome)
    if(!groups[cli]) return; // Sem CRM card = não aparece
    // SÓ mostrar orçamentos vinculados ao CRM (Orçamento Pronto)
    if(!e.crmCardId) return;
    groups[cli].entries.push(e);
    var lastRev=e.revisions&&e.revisions.length?e.revisions[e.revisions.length-1]:null;
    if(lastRev&&lastRev.data){
      var vt=parseFloat(lastRev.data['valor-final']||lastRev.data['total-geral']||0);
      if(vt)groups[cli].totalVal+=vt;
    }
    if(e.createdAt&&e.createdAt>groups[cli].lastDate)groups[cli].lastDate=e.createdAt;
  });

  var list=Object.values(groups);

  // Ordenar
  if(sortBy==='alpha') list.sort(function(a,b){return a.name.localeCompare(b.name);});
  else if(sortBy==='count') list.sort(function(a,b){return (b.entries.length+b.crmCards.length)-(a.entries.length+a.crmCards.length);});
  else list.sort(function(a,b){return b.lastDate>a.lastDate?1:b.lastDate<a.lastDate?-1:0;});

  // Stats
  var totalClientes=list.length;
  var totalOrcs=0,totalRevs=0,totalCrmCards=0;
  list.forEach(function(g){totalOrcs+=g.entries.length;totalCrmCards+=g.crmCards.length;g.entries.forEach(function(e){totalRevs+=(e.revisions||[]).length;});});

  var h='<div class="cli-stats">';
  h+='<div class="cli-stat"><div class="num">'+totalClientes+'</div><div class="lbl">Clientes</div></div>';
  h+='<div class="cli-stat"><div class="num">'+totalCrmCards+'</div><div class="lbl">Cards CRM</div></div>';
  h+='<div class="cli-stat"><div class="num">'+totalOrcs+'</div><div class="lbl">Orçamentos</div></div>';
  h+='<div class="cli-stat"><div class="num">'+totalRevs+'</div><div class="lbl">Revisões</div></div>';
  h+='</div>';

  if(!list.length){
    h+='<div class="cli-empty">📂 Nenhum cliente encontrado'+(q?' para "'+q+'"':'')+'</div>';
    body.innerHTML=h;return;
  }

  list.forEach(function(grp,gi){
    var nOrc=grp.entries.length;
    var nCrm=grp.crmCards.length;
    var nTotal=nOrc+nCrm;
    h+='<div class="cli-card" id="cli-grp-'+gi+'">';
    h+='<div class="cli-hdr" onclick="toggleCliCard('+gi+')">';
    h+='<div style="flex:1;min-width:0"><div class="cli-name">'+grp.name+'</div>';
    h+='<div style="font-size:10px;color:#888;margin-top:2px">';
    if(nCrm) h+='<span style="background:#e8f4fd;color:#1a5276;padding:1px 6px;border-radius:4px;font-weight:600;margin-right:4px">'+nCrm+' card'+(nCrm>1?'s':'')+'</span>';
    if(nOrc) h+='<span style="background:#e8f8e8;color:#1a7a20;padding:1px 6px;border-radius:4px;font-weight:600">'+nOrc+' orçamento'+(nOrc>1?'s':'')+'</span>';
    h+='</div></div>';
    h+='<div class="cli-badges">';
    if(grp.totalVal>0) h+='<span class="cli-badge val">R$ '+grp.totalVal.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</span>';
    h+='</div>';
    h+='<span class="cli-chevron">▶</span>';
    h+='</div>';

    h+='<div class="cli-body">';

    // ── CRM CARDS ──
    grp.crmCards.forEach(function(card){
      var stg=_stagesMap[card.stage]||{label:'—',icon:'',color:'#999'};
      h+='<div class="cli-orc" style="border-left:3px solid '+(stg.color||'#ccc')+'">';
      h+='<div class="cli-orc-info">';
      h+='<div class="cli-orc-name" style="color:#1a5276">'+stg.icon+' CRM — '+stg.label+'</div>';
      h+='<div class="cli-orc-meta">';
      if(card.contato) h+='<b>Contato:</b> '+card.contato+' &nbsp; ';
      if(card.email) h+='<b>Email:</b> '+card.email+' &nbsp; ';
      if(card.agp) h+='<b>AGP:</b> '+card.agp+' &nbsp; ';
      if(card.reserva) h+='<b>Reserva:</b> '+card.reserva+' &nbsp; ';
      h+='</div>';
      h+='<div class="cli-orc-vals">';
      if(card.largura&&card.altura) h+='<span class="cli-orc-val"><b>Vão:</b> '+card.largura+'×'+card.altura+'mm</span>';
      if(card.modelo) h+='<span class="cli-orc-val"><b>Mod:</b> '+card.modelo+'</span>';
      if(card.cor_ext) h+='<span class="cli-orc-val"><b>Cor:</b> '+card.cor_ext+'</span>';
      if(card.valor) h+='<span class="cli-orc-val" style="background:#e8f8e8"><b>Valor:</b> R$ '+(parseFloat(card.valorFaturamento||card.valor)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})+'</span>';
      if(card.valorTabela&&card.valorTabela!=card.valorFaturamento) h+='<span class="cli-orc-val" style="background:#fef3e0"><b>Tabela:</b> R$ '+(parseFloat(card.valorTabela)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})+'</span>';
      h+='</div>';
      // Revisões do CRM card
      if(card.revisoes&&card.revisoes.length>0){
        h+='<div class="cli-orc-revs">';
        card.revisoes.forEach(function(rv,ri){
          var rvVal=rv.valorFaturamento||rv.valorTabela||0;
          var rvStr=rvVal?'R$ '+(+rvVal).toLocaleString('pt-BR',{minimumFractionDigits:2}):'';
          h+='<span class="cli-rev-pill '+(ri===0?'orig':'')+'" style="cursor:default">';
          h+=(rv.label||'Rev '+ri);
          if(rvStr) h+=' — '+rvStr;
          if(rv.data) h+='<span class="rev-date">'+new Date(rv.data).toLocaleDateString('pt-BR')+'</span>';
          h+='</span>';
        });
        h+='</div>';
      }
      if(card.notas) h+='<div style="font-size:9px;color:#888;margin-top:4px;font-style:italic">'+card.notas.substring(0,100)+(card.notas.length>100?'...':'')+'</div>';
      h+='</div>';
      h+='<div class="cli-orc-actions">';
      h+='<button onclick="crmEditOpp(\''+card.id+'\');switchTab(\'crm\')" title="Abrir no CRM">📊 CRM</button>';
      // Buscar entry vinculado: 1) por crmCardId, 2) por nome cliente, 3) por reserva
      var _le=grp.entries.find(function(e){return e.crmCardId===card.id;});
      if(!_le) _le=grp.entries.find(function(e){return e.client&&card.cliente&&e.client.toUpperCase()===card.cliente.toUpperCase();});
      if(!_le&&card.reserva) _le=grp.entries.find(function(e){return e.project&&e.project===card.reserva;});
      if(!_le&&grp.entries.length===1) _le=grp.entries[0]; // grupo tem 1 só entry
      if(_le){
        h+='<button onclick="loadRevisionMemorial(\''+_le.id+'\',0)" title="Memorial" style="background:#e67e22;color:#fff;border-color:#e67e22">📋 Memorial</button>';
        h+='<button onclick="loadRevision(\''+_le.id+'\',0);switchTab(\'orcamento\')" title="Original">📂 Original</button>';
        h+='<button onclick="loadRevision(\''+_le.id+'\','+(_le.revisions.length-1)+');switchTab(\'orcamento\');setTimeout(novaRevisao,300)" title="Nova revisão">➕ Nova Rev</button>';
        h+='<button class="del" onclick="event.stopPropagation();if(confirm(\'Excluir orçamento?\'))deleteOrc(\''+_le.id+'\');setTimeout(renderClientesTab,200)" title="Excluir">🗑 Excluir</button>';
      }
      h+='</div>';
      h+='</div>';
    });

    // ── ORÇAMENTOS ──
    grp.entries.forEach(function(e){
      var lastRev=e.revisions&&e.revisions.length?e.revisions[e.revisions.length-1]:null;
      var _d=lastRev?lastRev.data||{}:{};
      var _L=_d['largura']||'';
      var _A=_d['altura']||'';
      var _mod=_d['carac-modelo-txt']||_d['carac-modelo']||'';
      var _cor=_d['carac-cor-ext']||'';
      var _agp=_d['num-agp']||'';
      var _atp=_d['num-atp']||'';
      var _reserva=_d['numprojeto']||e.project||'';
      var _total=_d['valor-final']||_d['total-geral']||'';
      var _custo=_d['custo-total']||'';

      h+='<div class="cli-orc">';
      h+='<div class="cli-orc-info">';
      h+='<div class="cli-orc-name">'+(e.name||'Sem nome')+'</div>';
      h+='<div class="cli-orc-meta">';
      if(_agp) h+='<b>AGP:</b> '+_agp+' &nbsp; ';
      if(_atp) h+='<b>ATP:</b> '+_atp+' &nbsp; ';
      if(_reserva) h+='<b>Reserva:</b> '+_reserva+' &nbsp; ';
      h+='Criado: '+(e.createdAt||'—');
      h+='</div>';

      // Valores
      h+='<div class="cli-orc-vals">';
      if(_L&&_A) h+='<span class="cli-orc-val"><b>Vão:</b> '+_L+'×'+_A+'mm</span>';
      if(_mod) h+='<span class="cli-orc-val"><b>Mod:</b> '+_mod+'</span>';
      if(_cor) h+='<span class="cli-orc-val"><b>Cor:</b> '+_cor+'</span>';
      if(_total) h+='<span class="cli-orc-val" style="background:#e8f8e8"><b>Venda:</b> R$ '+(parseFloat(_total)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})+'</span>';
      if(_custo) h+='<span class="cli-orc-val" style="background:#fef3e0"><b>Custo:</b> R$ '+(parseFloat(_custo)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})+'</span>';
      h+='</div>';

      // Pills de revisão
      h+='<div class="cli-orc-revs">';
      (e.revisions||[]).forEach(function(r,ri){
        var isCurrent=(currentId===e.id&&currentRev===ri);
        var rv=r.data||{};
        var rvTotal=rv['valor-final']||rv['total-geral']||'';
        var rvLabel=(r.label||'Rev '+ri);
        if(rvTotal) rvLabel+=' — R$ '+(parseFloat(rvTotal)||0).toLocaleString('pt-BR',{minimumFractionDigits:2});
        h+='<button class="cli-rev-pill '+(ri===0?'orig ':' ')+(isCurrent?'active':'')+'" onclick="loadRevision(\''+e.id+'\','+ri+');switchTab(\'orcamento\')">';
        h+=rvLabel;
        if(r.savedAt) h+='<span class="rev-date">'+r.savedAt+'</span>';
        h+='</button>';
      });
      h+='</div>';

      h+='</div>'; // cli-orc-info

      h+='<div class="cli-orc-actions">';
      h+='<button onclick="loadRevisionMemorial(\''+e.id+'\',0)" title="Ver memorial de cálculo congelado" style="background:#e67e22;color:#fff;border-color:#e67e22">📋 Memorial</button>';
      h+='<button onclick="loadRevision(\''+e.id+'\',0);switchTab(\'orcamento\')" title="Abrir versão original">📂 Original</button>';
      if(e.revisions.length>1) h+='<button onclick="loadRevision(\''+e.id+'\','+(e.revisions.length-1)+');switchTab(\'orcamento\')" title="Abrir última revisão">📝 Última Rev</button>';
      h+='<button onclick="loadRevision(\''+e.id+'\','+(e.revisions.length-1)+');switchTab(\'orcamento\');setTimeout(novaRevisao,300)" title="Criar nova revisão a partir da última">➕ Nova Rev</button>';
      h+='<button class="del" onclick="event.stopPropagation();if(confirm(\'Excluir este orçamento e todas as revisões?\'))deleteOrc(\''+e.id+'\');setTimeout(renderClientesTab,200)" title="Excluir">🗑 Excluir</button>';
      h+='</div>';

      h+='</div>'; // cli-orc
    });
    h+='</div>'; // cli-body
    h+='</div>'; // cli-card
  });

  body.innerHTML=h;
}

function toggleCliCard(idx){
  var card=$('cli-grp-'+idx);
  if(card) card.classList.toggle('open');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('on'); });
  document.querySelectorAll('.main-tab').forEach(function(b){ b.classList.remove('on'); });
  var panel = document.getElementById('tab-'+tabId);
  if (panel) panel.classList.add('on');
  var tabs = document.querySelectorAll('.main-tab');
  for(var i=0;i<tabs.length;i++){
    if(tabs[i].getAttribute('onclick').indexOf(tabId)>=0) tabs[i].classList.add('on');
  }
  if (tabId==='perfis'||tabId==='cadastro') { syncPerfisTab(); renderPerfisDB(); renderCompDB(); renderPrecosACM(); }
  if (tabId==='clientes') { renderClientesTab(); }
  if (tabId==='custoreal') { renderNFeHist(); }
  if (tabId==='acessorios'||tabId==='cadastro') { renderCompDB();
  loadModelos();
  loadModeloImagens(); }
  if (tabId==='precos'||tabId==='cadastro') renderPrecosACM();
  if (tabId==='proposta') populateProposta();
  if (tabId==='os') { _osAutoGenerate(); }
  if (tabId==='planificador') { /* planificador loaded */ }
  if (tabId==='os-acess') { _osAutoGenerate(); }
}


/* ═══════════════════════════════════════════════════
   CRM PROJETTA — Engine Final (sem monkey-patching)
   Todos os campos integrados diretamente
═══════════════════════════════════════════════════ */

/* ══ END MODULE: RELATORIOS ══ */
