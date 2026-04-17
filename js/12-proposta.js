/**
 * 12-proposta.js
 * Module: PROPOSTA
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: PROPOSTA ══ */
function printPainelRep(){
  var cli=(typeof _getBestClientName==='function')?_getBestClientName():(($('cliente')||{value:''}).value||($('crm-o-cliente')||{value:''}).value||'—');
  var agp=($('num-agp')||$('crm-o-agp')||{value:''}).value||'';
  var reserva=($('numprojeto')||$('crm-o-reserva')||{value:''}).value||'';
  var L=Math.round(parseFloat(($('largura')||{value:0}).value)||0);
  var A=Math.round(parseFloat(($('altura')||{value:0}).value)||0);
  var modEl=$('carac-modelo')||$('plan-modelo');
  var modTxt=modEl&&modEl.selectedIndex>=0?(modEl.options[modEl.selectedIndex].text||''):'—';
  var folTxt=($('folhas-porta')||{value:'1'}).value+' folha(s)';
  var qtdP=parseInt(($('qtd-portas')||{value:1}).value)||1;
  var pTab=($('m-tab-porta')||{textContent:''}).textContent;
  var pFat=($('m-fat-porta')||{textContent:''}).textContent;
  var tm2=($('s-tm2')||{textContent:''}).textContent;
  var fm2=($('s-fm2')||{textContent:''}).textContent;
  var tm2p=($('s-tm2p')||{textContent:''}).textContent;
  var fm2p=($('s-fm2p')||{textContent:''}).textContent;
  var comRep=($('com-rep')||{value:'0'}).value;
  var comRt=($('com-rt')||{value:'0'}).value;
  var desc=($('desconto')||{value:'0'}).value;
  var m2=((L/1000)*(A/1000)*qtdP).toFixed(2);
  var corExt='';var ceEl=$('carac-cor-ext');if(ceEl&&ceEl.selectedIndex>=0)corExt=(ceEl.options[ceEl.selectedIndex].text||'');

  // Nome do arquivo: AGP - RESERVA - CLIENTE - RC
  var _pdfParts=[];
  if(agp) _pdfParts.push(agp.replace(/\s+/g,''));
  if(reserva) _pdfParts.push(reserva);
  if(cli&&cli!=='—') _pdfParts.push(cli.replace(/[^\w\sÀ-ú]/g,'').replace(/\s+/g,'_').substring(0,30));
  _pdfParts.push('RC');
  var _pdfName=_pdfParts.join(' - ')+'.png';

  // Criar div temporário para captura
  var tmp=document.createElement('div');
  tmp.style.cssText='position:absolute;left:-9999px;top:0;width:600px;background:#fff;padding:30px;font-family:Arial,Helvetica,sans-serif;color:#1a3a4a';
  var h='';
  h+='<div style="background:#003144;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;text-align:center">';
  h+='<h1 style="margin:0;font-size:18px;letter-spacing:1px">PROJETTA by WEIKU</h1>';
  h+='<div style="font-size:11px;opacity:.7;margin-top:4px">Painel Comercial — Representante</div></div>';
  h+='<div style="border:1px solid #ddd;border-top:none;border-radius:0 0 10px 10px;padding:20px">';
  h+='<div style="display:flex;flex-wrap:wrap;gap:6px 20px;margin-bottom:16px;font-size:11px;color:#555">';
  h+='<span>Cliente: <b style="color:#003144">'+cli+'</b></span>';
  if(agp) h+='<span>AGP: <b style="color:#003144">'+agp+'</b></span>';
  if(reserva) h+='<span>Reserva: <b style="color:#003144">'+reserva+'</b></span>';
  h+='<span>Dimensão: <b style="color:#003144">'+L+' × '+A+' mm</b></span>';
  h+='<span>Modelo: <b style="color:#003144">'+modTxt+'</b></span>';
  h+='<span>'+folTxt+' · '+qtdP+' porta(s) · '+m2+' m²</span>';
  if(corExt) h+='<span>Cor: <b style="color:#003144">'+corExt+'</b></span>';
  h+='</div>';
  h+='<div style="display:flex;gap:16px;margin-bottom:20px">';
  h+='<div style="flex:1;background:#f8f6f0;border-radius:8px;padding:14px;text-align:center"><div style="font-size:10px;text-transform:uppercase;color:#888;font-weight:700">Preço Tabela</div><div style="font-size:22px;font-weight:800;color:#003144;margin-top:4px">'+pTab+'</div></div>';
  h+='<div style="flex:1;background:#f8f6f0;border-radius:8px;padding:14px;text-align:center"><div style="font-size:10px;text-transform:uppercase;color:#888;font-weight:700">Preço Faturamento</div><div style="font-size:22px;font-weight:800;color:#e65100;margin-top:4px">'+pFat+'</div></div>';
  h+='</div>';
  h+='<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">';
  h+='<tr><th colspan="2" style="background:#f0ede8;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#888">Valores por m²</th></tr>';
  h+='<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">Preço tabela/m² <b>porta+inst</b></td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#003144">'+tm2+'</td></tr>';
  h+='<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">Preço fat./m² <b>porta+inst</b></td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#003144">'+fm2+'</td></tr>';
  h+='<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">Preço tabela/m² <b>só porta</b></td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#003144">'+tm2p+'</td></tr>';
  h+='<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">Preço fat./m² <b>só porta</b></td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#003144">'+fm2p+'</td></tr>';
  h+='</table>';
  h+='<div style="display:flex;gap:12px;margin-top:16px">';
  h+='<div style="flex:1;background:#f0f7ff;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;text-transform:uppercase;color:#888;font-weight:700">Comissão Rep.</div><div style="font-size:18px;font-weight:800;color:#1a5276;margin-top:2px">'+comRep+'%</div></div>';
  h+='<div style="flex:1;background:#f0f7ff;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;text-transform:uppercase;color:#888;font-weight:700">Comissão Arq.</div><div style="font-size:18px;font-weight:800;color:#1a5276;margin-top:2px">'+comRt+'%</div></div>';
  h+='<div style="flex:1;background:#f0f7ff;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;text-transform:uppercase;color:#888;font-weight:700">Desconto</div><div style="font-size:18px;font-weight:800;color:#1a5276;margin-top:2px">'+desc+'%</div></div>';
  h+='</div>';
  h+='<div style="margin-top:20px;font-size:9px;color:#aaa;text-align:center">Gerado em '+new Date().toLocaleString('pt-BR')+' — Projetta 2026</div>';
  h+='</div>';
  tmp.innerHTML=h;
  document.body.appendChild(tmp);

  // Capturar e gerar PNG de alta resolução com download direto
  html2canvas(tmp,{scale:3,useCORS:true,backgroundColor:'#ffffff'}).then(function(canvas){
    document.body.removeChild(tmp);
    canvas.toBlob(function(blob){
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;
      a.download=_pdfName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){URL.revokeObjectURL(url);},1000);
    },'image/png');
  }).catch(function(err){
    document.body.removeChild(tmp);
    console.error('Erro ao gerar PNG:',err);
    alert('Erro ao gerar imagem. Tente novamente.');
  });
}

/* ── Memorial de Cálculo PNG (Resumo da Obra) ── */
function printMemorialCalculo(){
  var cli=window._pdfClienteOverride||(typeof _getBestClientName==='function'?_getBestClientName():'—');
  var agp=($('num-agp')||$('crm-o-agp')||{value:''}).value||'';
  var reserva=($('numprojeto')||$('crm-o-reserva')||{value:''}).value||'';
  var _parts=[];
  if(agp) _parts.push(agp.replace(/\s+/g,''));
  if(reserva) _parts.push(reserva);
  if(cli&&cli!=='—') _parts.push(cli.replace(/[^\w\sÀ-ú]/g,'').replace(/\s+/g,'_').substring(0,30));
  _parts.push('MC');
  var _fname=_parts.join(' - ')+'.png';

  var src=document.getElementById('resumo-obra');
  if(!src){console.warn('resumo-obra não encontrado');return;}

  // Garantir visibilidade para captura
  var wasHidden=src.style.display==='none';
  var body=document.getElementById('resumo-obra-body');
  var bodyWasHidden=body&&body.style.display==='none';
  if(wasHidden) src.style.display='';
  if(body&&bodyWasHidden) body.style.display='';

  // Clone off-screen para captura limpa
  var clone=src.cloneNode(true);
  clone.style.cssText='position:absolute;left:-9999px;top:0;width:1100px;background:#fff;font-family:Arial,Helvetica,sans-serif';
  clone.style.display='';
  var cb=clone.querySelector('#resumo-obra-body');
  if(cb) cb.style.display='flex';
  var hdr=clone.querySelector('[onclick]');
  if(hdr) hdr.removeAttribute('onclick');
  document.body.appendChild(clone);

  html2canvas(clone,{scale:3,useCORS:true,backgroundColor:'#ffffff'}).then(function(canvas){
    document.body.removeChild(clone);
    if(wasHidden) src.style.display='none';
    if(body&&bodyWasHidden) body.style.display='none';
    canvas.toBlob(function(blob){
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;a.download=_fname;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(function(){URL.revokeObjectURL(url);},1000);
    },'image/png');
  }).catch(function(err){
    document.body.removeChild(clone);
    if(wasHidden) src.style.display='none';
    if(body&&bodyWasHidden) body.style.display='none';
    console.error('Erro ao gerar Memorial de Cálculo PNG:',err);
  });
}

/* ── Margens PNG (DRE + parâmetros) ── */
function printMargens(){
  var cli=window._pdfClienteOverride||(typeof _getBestClientName==='function'?_getBestClientName():'—');
  var agp=($('num-agp')||$('crm-o-agp')||{value:''}).value||'';
  var reserva=($('numprojeto')||$('crm-o-reserva')||{value:''}).value||'';
  var _parts=[];
  if(agp) _parts.push(agp.replace(/\s+/g,''));
  if(reserva) _parts.push(reserva);
  if(cli&&cli!=='—') _parts.push(cli.replace(/[^\w\sÀ-ú]/g,'').replace(/\s+/g,'_').substring(0,30));
  _parts.push('MR');
  var _fname=_parts.join(' - ')+'.png';

  var L=Math.round(parseFloat(($('largura')||{value:0}).value)||0);
  var A=Math.round(parseFloat(($('altura')||{value:0}).value)||0);
  var modEl=$('carac-modelo')||$('plan-modelo');
  var modTxt=modEl&&modEl.selectedIndex>=0?(modEl.options[modEl.selectedIndex].text||''):'—';
  var folTxt=($('folhas-porta')||{value:'1'}).value+' folha(s)';
  var qtdP=parseInt(($('qtd-portas')||{value:1}).value)||1;

  // Ler parâmetros de margem
  var ov=($('overhead')||{value:'5'}).value;
  var imp=($('impostos')||{value:'18'}).value;
  var rep=($('com-rep')||{value:'7'}).value;
  var rt=($('com-rt')||{value:'5'}).value;
  var gest=($('com-gest')||{value:'1'}).value;
  var lucro=($('lucro-alvo')||{value:'15'}).value;
  var mkup=($('markup-desc')||{value:'20'}).value;
  var desc=($('desconto')||{value:'20'}).value;

  // Ler DRE do DOM
  function gT(id){var el=document.getElementById(id);return el?el.textContent:'—';}

  var tmp=document.createElement('div');
  tmp.style.cssText='position:absolute;left:-9999px;top:0;width:600px;background:#fff;padding:30px;font-family:Arial,Helvetica,sans-serif;color:#1a3a4a';
  var h='';
  h+='<div style="background:#003144;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;text-align:center">';
  h+='<h1 style="margin:0;font-size:18px;letter-spacing:1px">PROJETTA by WEIKU</h1>';
  h+='<div style="font-size:11px;opacity:.7;margin-top:4px">Painel de Margens</div></div>';
  h+='<div style="border:1px solid #ddd;border-top:none;border-radius:0 0 10px 10px;padding:20px">';
  // Info cliente
  h+='<div style="display:flex;flex-wrap:wrap;gap:6px 20px;margin-bottom:16px;font-size:11px;color:#555">';
  h+='<span>Cliente: <b style="color:#003144">'+cli+'</b></span>';
  if(agp) h+='<span>AGP: <b style="color:#003144">'+agp+'</b></span>';
  if(reserva) h+='<span>Reserva: <b style="color:#003144">'+reserva+'</b></span>';
  h+='<span>'+L+' × '+A+' mm · '+modTxt+' · '+folTxt+' · '+qtdP+' porta(s)</span>';
  h+='</div>';
  // Tabela parâmetros
  h+='<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">';
  h+='<tr style="background:#f0ede8"><th colspan="2" style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#888">Parâmetros de Margem</th></tr>';
  var params=[
    ['Overhead (custos indiretos)',ov+'%'],
    ['Impostos sobre receita',imp+'%'],
    ['Comissão representante',rep+'%'],
    ['Comissão RT / arquiteto',rt+'%'],
    ['Comissão gestão interna',gest+'%'],
    ['Lucro líquido alvo',lucro+'%'],
    ['Markup de desconto',mkup+'%'],
    ['Desconto negociado',desc+'%']
  ];
  params.forEach(function(p){
    h+='<tr><td style="padding:5px 10px;border-bottom:1px solid #eee">'+p[0]+'</td>';
    h+='<td style="padding:5px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#003144">'+p[1]+'</td></tr>';
  });
  h+='</table>';
  // DRE resumida
  h+='<table style="width:100%;border-collapse:collapse;font-size:12px">';
  h+='<tr style="background:#003144;color:#fff"><th colspan="2" style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em">DRE Simplificada</th></tr>';
  var dre=[
    ['(+) Preço tabela',gT('d-tab'),'#003144'],
    ['(−) Desconto',gT('d-desc-val'),'#c0392b'],
    ['(=) Receita faturamento',gT('d-fat'),'#e67e22'],
    ['(−) Impostos',gT('d-imp'),'#c0392b'],
    ['(−) Comissão rep.',gT('d-rep'),'#c0392b'],
    ['(−) Comissão RT',gT('d-rt'),'#c0392b'],
    ['(−) Comissão gestão',gT('d-gest'),'#c0392b'],
    ['(−) Custo total',gT('d-custo'),'#c0392b'],
    ['(=) Lucro bruto',gT('d-lb'),'#1a5276'],
    ['(−) IRPJ+CSLL 34%',gT('d-irpj'),'#c0392b'],
    ['(=) LUCRO LÍQUIDO',gT('d-ll'),'#27ae60']
  ];
  dre.forEach(function(d,i){
    var bg=i===dre.length-1?'#f0fff0':(i===2?'#fff8f0':'#fff');
    var fw=i===dre.length-1||i===2||i===8?'800':'400';
    var fs=i===dre.length-1?'14px':'12px';
    h+='<tr style="background:'+bg+'"><td style="padding:5px 10px;border-bottom:1px solid #eee;font-weight:'+fw+'">'+d[0]+'</td>';
    h+='<td style="padding:5px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;font-size:'+fs+';color:'+d[2]+'">'+d[1]+'</td></tr>';
  });
  h+='</table>';
  h+='<div style="margin-top:16px;font-size:9px;color:#aaa;text-align:center">Gerado em '+new Date().toLocaleString('pt-BR')+' — Projetta 2026</div>';
  h+='</div>';
  tmp.innerHTML=h;
  document.body.appendChild(tmp);

  html2canvas(tmp,{scale:3,useCORS:true,backgroundColor:'#ffffff'}).then(function(canvas){
    document.body.removeChild(tmp);
    canvas.toBlob(function(blob){
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;a.download=_fname;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(function(){URL.revokeObjectURL(url);},1000);
    },'image/png');
  }).catch(function(err){
    document.body.removeChild(tmp);
    console.error('Erro ao gerar Margens PNG:',err);
  });
}

function printProposta(){
  populateProposta();
  switchTab('proposta');
  var ad=document.getElementById('aprov-drawer');if(ad)ad.style.display='none';
  var ab=document.getElementById('aprov-backdrop');if(ab)ab.style.display='none';
  var origTitle=document.title;
  // Nome PDF: RESERVA_DATA_AGP_RESERVA_CLIENTE
  var _cli=($('crm-o-cliente')||$('cliente')||{value:''}).value||'';
  var _agp=($('num-agp')||$('crm-o-agp')||{value:''}).value||'';
  var _res=($('numprojeto')||$('crm-o-reserva')||{value:''}).value||'';
  var _dt=new Date().toLocaleDateString('pt-BR').replace(/\//g,'');
  var _pp=[];
  if(_res) _pp.push(_res);
  _pp.push(_dt);
  if(_agp) _pp.push(_agp.replace(/\s+/g,''));
  if(_res) _pp.push(_res);
  if(_cli) _pp.push(_cli.replace(/[^\w\sÀ-ú]/g,'').replace(/\s+/g,'_').substring(0,30));
  _pp.push('pdf');
  document.title=_pp.join('_');
  setTimeout(function(){
    window.print();
    document.title=origTitle;
  },300);
}

/* ── Exportar proposta silenciosamente e salvar no card CRM ── */
function _exportPropostaToCard(cardId, revLabel, callback){
  if(typeof html2canvas==='undefined'){console.warn('html2canvas não carregado');if(callback)callback(null);return;}
  populateProposta();
  // Tornar proposta visível off-screen para captura (sem trocar aba)
  var propostaTab=document.getElementById('tab-proposta');
  var origStyle=propostaTab?propostaTab.getAttribute('style'):'';
  if(propostaTab){
    propostaTab.style.display='block';
    propostaTab.style.position='absolute';
    propostaTab.style.left='-9999px';
    propostaTab.style.top='0';
    propostaTab.style.opacity='1';
    propostaTab.style.pointerEvents='none';
    propostaTab.style.visibility='visible';
    propostaTab.style.width='210mm';
  }
  var pages=document.querySelectorAll('.proposta-page');
  if(!pages.length){
    if(propostaTab) propostaTab.setAttribute('style',origStyle||'');
    if(callback)callback(null);return;
  }
  var captures=[];
  var idx=0;
  function captureNext(){
    if(idx>=pages.length){
      // Restaurar aba
      if(propostaTab) propostaTab.setAttribute('style',origStyle||'display:none');
      // Salvar PDF dentro da ÚLTIMA REVISÃO do card
      if(cardId){
        // Salvar imagens na NUVEM (Supabase) em vez de localStorage
        var _sbUrl=window._SB_URL, _sbKey=window._SB_KEY;
        if(_sbUrl && _sbKey && captures.length>0){
          var _imgKey='proposta_img_'+cardId;
          fetch(_sbUrl+'/rest/v1/configuracoes',{
            method:'POST',
            headers:{'apikey':_sbKey,'Authorization':'Bearer '+_sbKey,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
            body:JSON.stringify({chave:_imgKey,valor:{pages:captures,date:new Date().toISOString(),label:revLabel||'Original'}})
          }).then(function(r){
            if(r.ok) console.log('☁️ Proposta salva na nuvem: '+captures.length+' páginas');
            else console.warn('☁️ Erro salvar proposta:',r.status);
          }).catch(function(e){console.warn('☁️ Rede err proposta:',e);});
        }
        // Também salvar referência leve no card (sem imagens pesadas)
        try{
          var CK_PDF='projetta_crm_v1';
          var data=JSON.parse(localStorage.getItem(CK_PDF)||'[]');
          var ci=data.findIndex(function(o){return o.id===cardId;});
          if(ci>=0 && data[ci].revisoes && data[ci].revisoes.length>0){
            var lastRev=data[ci].revisoes[data[ci].revisoes.length-1];
            lastRev.pdfDate=new Date().toISOString();
            lastRev.pdfCloud=true; // flag: imagens estão na nuvem
            lastRev.pdfPagesCount=captures.length;
            // Guardar apenas thumbnail pequeno no localStorage (1 página, baixa qualidade)
            if(captures[0]){
              var _tn=document.createElement('canvas');var _ti=new Image();_ti.src=captures[0];
              _tn.width=Math.round(_ti.width/3);_tn.height=Math.round(_ti.height/3);
              var _tc=_tn.getContext('2d');_tc.drawImage(_ti,0,0,_tn.width,_tn.height);
              lastRev.pdfThumb=_tn.toDataURL('image/jpeg',0.2);
            }
            delete lastRev.pdfPages; // remover imagens pesadas do localStorage
            localStorage.setItem(CK_PDF,JSON.stringify(data));
            console.log('✅ Referência salva no card (imagens na nuvem)');
          }
        }catch(e){console.warn('Erro ao salvar referência no card:',e);}
      }
      if(callback) callback(captures);
      return;
    }
    html2canvas(pages[idx],{scale:1.2,useCORS:true,logging:false,backgroundColor:'#ffffff'}).then(function(canvas){
      captures.push(canvas.toDataURL('image/jpeg',0.35));
      idx++;
      captureNext();
    }).catch(function(e){
      console.warn('Erro captura pg'+idx+':',e);
      idx++;
      captureNext();
    });
  }
  // Forçar reflow antes de capturar
  if(propostaTab) void propostaTab.offsetHeight;
  setTimeout(captureNext, 800);
}

function populateProposta(){
  var g=function(id){var el=document.getElementById(id);if(!el)return '—';if(el.tagName==='SELECT'||el.tagName==='INPUT'||el.tagName==='TEXTAREA')return el.value||'—';return el.textContent||'—';};
  var brl=function(v){return 'R$ '+(Math.round(v*100)/100).toLocaleString('pt-BR',{minimumFractionDigits:2});};
  // Dados do cliente
  var cliente=g('cliente')||'—';
  var agp=g('num-agp')||'—';
  var reserva=g('numprojeto')||'—';
  document.getElementById('prop-agp').textContent=agp;
  document.getElementById('prop-obra').textContent=agp;
  document.getElementById('prop-reserva').textContent=reserva;
  document.getElementById('prop-cliente').textContent=cliente;
  document.getElementById('prop-assin-cliente').textContent=cliente;
  // Dados de endereço (se CEP buscado)
  var cidadeEl=document.getElementById('cep-cidade');
  document.getElementById('prop-cidade').textContent=cidadeEl?cidadeEl.textContent:'—';
  // Representante
  var repEl=document.getElementById('rep-sel');
  var repTxt=repEl&&repEl.selectedIndex>0?repEl.options[repEl.selectedIndex].text:'—';
  document.getElementById('prop-representante').textContent=repTxt;
  // Responsável
  var resp=g('responsavel');
  document.getElementById('prop-emitido').textContent='Emitido por '+resp+' em '+(new Date().toLocaleDateString('pt-BR'))+', às '+(new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
  // Logo pg3
  var mainLogo=document.querySelector('.header-brand img');
  var pg3Logo=document.getElementById('prop-pg3-logo');
  if(mainLogo&&pg3Logo) pg3Logo.src=mainLogo.src;
  // Dimensões — somente single-door (multi-door popula via _populatePropostaItens)
  var _isMulti=window._mpItens&&window._mpItens.length>0;
  var larg=parseFloat(g('largura'))||0;
  var alt=parseFloat(g('altura'))||0;
  var area=Math.round(larg*alt/1e6*100)/100;
  if(!_isMulti){
  document.getElementById('prop-larg').textContent=Math.round(larg);
  document.getElementById('prop-alt').textContent=Math.round(alt);
  document.getElementById('prop-area').textContent=area.toFixed(2);
  document.getElementById('prop-area-total').textContent=area.toFixed(1);
  // Folhas
  var folhas=g('carac-folhas')||g('folhas-porta');
  document.getElementById('prop-folhas').textContent=folhas==='2'?'2 FOLHAS':'1 FOLHA';
  // Sistema
  var sistema=alt<4000?'PA006 NOVO':'PA007 NOVO';
  document.getElementById('prop-sistema').textContent=sistema;
  // Tipo de abertura
  var abertura=g('carac-abertura')||'PIVOTANTE';
  document.getElementById('prop-abertura').textContent=abertura;
  // Modelo (from characteristics)
  var caracMod=document.getElementById('carac-modelo');
  var modVal=caracMod?caracMod.value:'';
  var modTxt=caracMod&&caracMod.selectedIndex>0?caracMod.options[caracMod.selectedIndex].text:'—';
  document.getElementById('prop-modelo').textContent=modTxt.toUpperCase();
  // Model image on proposal — check Supabase cache first, then default MODEL_IMGS
  var propImg=document.getElementById('prop-img-porta');
  var propPh=document.getElementById('prop-img-porta-ph');
  var _customModelImg = (typeof _modeloImgCache!=='undefined'&&_modeloImgCache[modVal])||null;
  if(modVal && (_customModelImg || MODEL_IMGS[modVal])){
    propImg.src = _customModelImg || MODEL_IMGS[modVal];
    propImg.style.display='';
    propPh.style.display='none';
  } else {
    propImg.style.display='none';
    propPh.style.display='';
  }
  // Fechadura mecânica — mostrar com destaque de pinos
  var _fechMecVal=g('carac-fech-mec')||'—';
  var _fechMecEl=document.getElementById('prop-fech-mec');
  if(_fechMecEl){
    if(_fechMecVal&&_fechMecVal!=='—'){
      _fechMecEl.innerHTML='<strong style="color:#003144;font-size:105%">'+_fechMecVal.toUpperCase()+'</strong> — KESO';
    } else {
      _fechMecEl.textContent='—';
    }
  }
  // Fechadura digital — destaque quando ativa, fundo cinza quando não aplica
  var _fechDigVal=g('carac-fech-dig')||'—';
  var _fechDigEl=document.getElementById('prop-fech-dig');
  var _fechDigLine=document.getElementById('prop-fech-dig-line');
  if(_fechDigEl&&_fechDigLine){
    if(_fechDigVal&&_fechDigVal!=='—'&&_fechDigVal!=='NÃO SE APLICA'&&_fechDigVal!=='Nenhuma'){
      _fechDigEl.innerHTML='<strong style="color:#8e44ad;font-size:110%">✅ '+_fechDigVal.toUpperCase()+'</strong>';
      _fechDigLine.style.cssText='background:#f3e8ff;border:2px solid #8e44ad;border-radius:6px;padding:6px 10px;margin:4px 0;font-weight:700';
    } else {
      _fechDigEl.innerHTML='<span style="color:#c0392b;font-weight:700">NÃO SE APLICA</span>';
      _fechDigLine.style.cssText='background:rgba(231,76,60,0.08);border:1.5px solid rgba(231,76,60,0.3);border-radius:6px;padding:6px 10px;margin:4px 0';
    }
  }
  // Puxador
  var puxVal=g('carac-puxador')||'—';
  document.getElementById('prop-puxador').textContent=puxVal;
  var puxTamLine=document.getElementById('prop-pux-tam-line');
  if(puxVal==='EXTERNO'){
    puxTamLine.style.display='';
    document.getElementById('prop-pux-tam').textContent=g('carac-pux-tam')||'—';
  } else {
    puxTamLine.style.display='none';
  }
  // Cilindro — destaque quando Udinese
  var _cilVal=g('carac-cilindro')||'—';
  var _cilEl=document.getElementById('prop-cilindro');
  var _cilLine=document.getElementById('prop-cilindro-line');
  if(_cilEl&&_cilLine){
    if(_cilVal.toUpperCase().indexOf('UDINESE')>=0){
      _cilEl.innerHTML='<strong style="color:#c0392b;font-size:110%">UDINESE</strong>';
      _cilLine.style.cssText='background:rgba(231,76,60,0.08);border:1.5px solid rgba(231,76,60,0.3);border-radius:6px;padding:6px 10px;margin:4px 0;font-weight:700';
    } else {
      _cilEl.textContent=_cilVal;
      _cilLine.style.cssText='';
    }
  }
  // Alisar — destaque
  var _alisarCb=document.getElementById('carac-tem-alisar');
  var _alisarEl=document.getElementById('prop-alisar');
  var _alisarLine=document.getElementById('prop-alisar-line');
  if(_alisarEl&&_alisarLine){
    if(_alisarCb&&_alisarCb.checked){
      _alisarEl.innerHTML='<strong style="color:#27ae60;font-size:110%">✅ SIM — COM ALISAR</strong>';
      _alisarLine.style.cssText='background:#e8f5e9;border:2px solid #27ae60;border-radius:6px;padding:6px 10px;margin:4px 0;font-weight:700';
    } else {
      _alisarEl.innerHTML='<span style="color:#c0392b;font-weight:700">SEM ALISAR</span>';
      _alisarLine.style.cssText='background:rgba(231,76,60,0.08);border:1.5px solid rgba(231,76,60,0.3);border-radius:6px;padding:6px 10px;margin:4px 0';
    }
  }
  // Cor da chapa — from Características fields
  var corExt=g('carac-cor-ext');
  var corInt=g('carac-cor-int');
  document.getElementById('prop-cor-ext').textContent=corExt||'—';
  document.getElementById('prop-cor-int').textContent=corInt||'—';
  if(corExt&&corExt!=='—') document.getElementById('prop-linha').textContent='PORTA PROJETTA';
  var acmSel=document.getElementById('acm-sel-1');
  // Fallback: if no carac color selected, try ACM/ALU selects
  if((!corExt||corExt==='—')&&acmSel&&acmSel.selectedIndex>0){
    var corTxt=acmSel.options[acmSel.selectedIndex].text.split('·')[0].trim();
    document.getElementById('prop-cor-ext').textContent=corTxt;
    document.getElementById('prop-cor-int').textContent=corTxt;
    document.getElementById('prop-linha').textContent='PORTA PROJETTA';
  }
  var aluSel=document.getElementById('alu-sel-1');
  if(aluSel&&aluSel.selectedIndex>0){
    var corAlu=aluSel.options[aluSel.selectedIndex].text.split('·')[0].trim();
    document.getElementById('prop-cor-ext').textContent=corAlu;
    document.getElementById('prop-cor-int').textContent=corAlu;
    document.getElementById('prop-linha').textContent='PORTA PROJETTA';
  }
  } // end if(!_isMulti) — single-door element population
  // Quantidade (suporte multi-porta)
  var qtdPortas=parseInt(g('qtd-portas'))||1;
  if(window._mpItens&&window._mpItens.length>0){
    qtdPortas=window._mpItens.reduce(function(s,it){return s+(parseInt(it._qtd||it['qtd-portas'])||1);},0);
  }
  // Popular tabela de itens da proposta (multi-porta)
  _populatePropostaItens();
  var qtdFech=parseInt(g('qtd-fechaduras'))||1;
  var _pq=document.getElementById('prop-qtd');if(_pq)_pq.textContent=qtdPortas;
  var _pqp=document.getElementById('prop-qtd-porta');if(_pqp)_pqp.textContent=qtdPortas;
  // Medidas na proposta (single-door)
  var _propMed=document.getElementById('prop-medidas');
  if(_propMed&&(!window._mpItens||window._mpItens.length===0)){
    _propMed.textContent=g('largura')+' × '+g('altura');
  }

  // Valores do painel (já multiplicados por qtd no calc)
  var parseVal=function(el){
    if(!el) return 0;
    var t=el.textContent||'';
    return parseFloat(t.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;
  };
  var brl2=function(v){return v>0?'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2}):'—';};
  
  if(!_isMulti){
  // Porta: PREÇO TABELA (valor cheio para o cliente)
  var tabPortaTotal=parseVal(document.getElementById('m-tab-porta'));
  var tabPortaUn=qtdPortas>0?tabPortaTotal/qtdPortas:0;
  document.getElementById('prop-valor-un').textContent=brl2(tabPortaUn);
  document.getElementById('prop-valor-total-porta').textContent=brl2(tabPortaTotal);
  
  // Fechadura/Acessório - PREÇO TABELA
  var tabFechTotal=parseVal(document.getElementById('m-tab-fech'));
  var rowFech=document.getElementById('prop-row-fech');
  if(tabFechTotal>0){
    rowFech.style.display='';
    document.getElementById('prop-qtd-fech').textContent=qtdFech;
    var tabFechUn=qtdFech>0?tabFechTotal/qtdFech/qtdPortas:0;
    document.getElementById('prop-valor-un-fech').textContent=brl2(tabFechUn);
    document.getElementById('prop-valor-total-fech').textContent=brl2(tabFechTotal);
    // Nome do acessório (TEDEE, PHILIPS 9300, EMTECO...)
    var digSel=document.getElementById('carac-fech-dig');
    var acSel=document.getElementById('ac-fechadura');
    var nomeFech='';
    if(digSel&&digSel.value&&digSel.value!=='NÃO SE APLICA') nomeFech=digSel.value;
    else if(acSel&&acSel.selectedIndex>0) nomeFech=acSel.options[acSel.selectedIndex].text;
    document.getElementById('prop-nome-fech').textContent=nomeFech||'Fechadura Digital';
  } else {
    rowFech.style.display='none';
  }
  
  // Total geral = Preço Tabela Total do painel
  var tabGeral=parseVal(document.getElementById('m-tab'));
  document.getElementById('prop-total-orc').textContent=brl2(tabGeral);
  document.getElementById('prop-area-total').textContent=(area*qtdPortas).toFixed(1);
  } // end if(!_isMulti) — single-door values
  // Logo no rodapé
  var headerLogo=document.querySelector('.header-brand img');
  var footerLogo=document.getElementById('prop-footer-logo-img');
  if(headerLogo&&footerLogo) footerLogo.src=headerLogo.src;
}

/* ══ CADASTRO DE PERFIS ══ */
const PERFIS_DB=[
{c:"CDA-L-009",d:"Cantoneira abas iguais 19,05×1,59mm",kg:0.150,f:"MERCADO",l:"MERCADO"},
{c:"PA-101X101X2.5",d:"Tubular 101.6×101.6×2.5 TQ-034",kg:2.685,f:"TECNOPERFIL",l:"MERCADO"},
{c:"PA-101X101X6.0",d:"Tubular 101.6×101.6×6.0 TQ-076",kg:6.556,f:"MERCADO",l:"MERCADO"},
{c:"PA-101X38X2.4",d:"Tubular 101.6×38.1×2.4 TG-018",kg:1.755,f:"MERCADO",l:"MERCADO"},
{c:"PA-101X51X2",d:"Tubular 101.6×50.8×2.0 TG-072",kg:1.608,f:"TECNOPERFIL",l:"MERCADO"},
{c:"PA-101X51X3.17",d:"Tubular 101.6×50.8×3.17 TG-021",kg:2.510,f:"MERCADO",l:"MERCADO"},
{c:"PA-12X12X1.58",d:"Tubular 12.7×12.7×1.58 TQ-002",kg:0.190,f:"MERCADO",l:"MERCADO"},
{c:"PA-152X38X3.2",d:"Tubular 152.4×38.1×3.2 TG024",kg:3.193,f:"MERCADO",l:"MERCADO"},
{c:"PA-15X15X1.58",d:"Tubular 15.87×15.87×1.58 TQ-003",kg:0.245,f:"MERCADO",l:"MERCADO"},
{c:"PA-19X19X1.6",d:"Tubular 19.05×19.05×1.6 TQ-006",kg:0.303,f:"MERCADO",l:"MERCADO"},
{c:"PA-25X12X1.58",d:"Tubular 25.4×12.7×1.58 TG-001",kg:0.299,f:"MERCADO",l:"MERCADO"},
{c:"PA-25X25X1.58",d:"Tubular 25.4×25.4×1.58 TQ009",kg:0.408,f:"MERCADO",l:"MERCADO"},
{c:"PA-31X31X1.58",d:"Tubular 31.75×31.75×1.58 TQ-012",kg:0.517,f:"MERCADO",l:"MERCADO"},
{c:"PA-35X25-OLHAL",d:"Tubular 35.1×25.4 c/ olhal D055",kg:0.502,f:"TECNOPERFIL",l:"MERCADO"},
{c:"PA-35X35-OLHAL",d:"Tubular 35.1×35.1×1.5 olhal D081",kg:0.667,f:"MERCADO",l:"MERCADO"},
{c:"PA-38X38X1.58",d:"Tubular 38.1×38.1×1.58 TQ-014",kg:0.595,f:"TECNOPERFIL",l:"MERCADO"},
{c:"PA-51X12X1.2",d:"Tubular 50.8×12.7×1.2",kg:0.397,f:"MERCADO",l:"MERCADO"},
{c:"PA-51X12X1.58",d:"Tubular 50.8×12.7×1.58 TG-004",kg:0.517,f:"TECNOPERFIL",l:"MERCADO"},
{c:"PA-51X25X1.5",d:"Tubular 50.8×25.4×1.5 TG005",kg:0.595,f:"MERCADO",l:"MERCADO"},
{c:"PA-51X25X2.0",d:"Tubular 50.8×25.4×2.0 TG007",kg:0.783,f:"MERCADO",l:"MERCADO"},
{c:"PA-51X38X1.98",d:"Tubular 50.8×38.1×1.98 TG008",kg:0.912,f:"MERCADO",l:"MERCADO"},
{c:"PA-51X51X1.98",d:"Tubular 50.8×50.8×1.98 TG017",kg:1.048,f:"MERCADO",l:"MERCADO"},
{c:"PA-76X25X2.0",d:"Tubular 76.2×25.4×2.0 TG013",kg:1.058,f:"MERCADO",l:"MERCADO"},
{c:"PA-76X38X1.98",d:"Tubular 76.2×38.1×1.98 TG-014",kg:1.184,f:"TECNOPERFIL",l:"MERCADO"},
{c:"PA-76X76X2.0",d:"Tubular 76.2×76.2×2.0 TQ-072",kg:1.609,f:"MERCADO",l:"MERCADO"},
{c:"PA-CANT-12X12X1.59",d:"Cantoneira 12×12×1.59 CT-001",kg:0.102,f:"MERCADO",l:"MERCADO"},
{c:"PA-CANT-16X31X1.3",d:"Cantoneira 16×31×1.3 CT209",kg:0.165,f:"MERCADO",l:"MERCADO"},
{c:"PA-CANT-25X25X1.59",d:"Cantoneira 25×25×1.59 CT-016",kg:0.210,f:"MERCADO",l:"MERCADO"},
{c:"PA-CANT-30X30X2.0",d:"Cantoneira 30×30×2.0 CT-082",kg:0.270,f:"MERCADO",l:"MERCADO"},
{c:"PA-CANT-32X32X3.18",d:"Cantoneira 31.75×31.75×3.18 L-018",kg:0.519,f:"MERCADO",l:"MERCADO"},
{c:"PA-CHR908",d:"Arremate inferior Chroma natural",kg:0.188,f:"MERCADO",l:"MERCADO"},
{c:"PA-CLICKPERFILBOISER",d:"Conector Click 01 JAT anod 6MT",kg:0.001,f:"MERCADO",l:"MERCADO"},
{c:"PA-DS152",d:"Trilho superior porta correr",kg:0.765,f:"MERCADO",l:"MERCADO"},
{c:"PA-FV001",d:"Perfil FV001 pint. preto",kg:0.461,f:"MERCADO",l:"MERCADO"},
{c:"PA-LG028",d:"Mata junta",kg:0.455,f:"MERCADO",l:"MERCADO"},
{c:"PA-PA006F-6M",d:"PA006 Folha TP-8269/T5/6063",kg:3.454,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PA006P-6M",d:"PA006 Portal TP-8270/T5/6063",kg:1.695,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PA006V",d:"PA006 Visor TP-8271/T5/6063",kg:1.553,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PA007F-6M",d:"PA007 Folha 6000 TP-8240",kg:5.151,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PA007F-7M",d:"PA007 Folha 7000 TP-8240",kg:5.151,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PA007F-8M",d:"PA007 Folha 8000 TP-8240",kg:5.151,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PA007P-6M",d:"PA007 Portal 6000 TP-8267",kg:2.783,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PA007P-7M",d:"PA007 Portal 7000 TP-8267",kg:2.783,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PA007P-8M",d:"PA007 Portal 8000 TP-8267",kg:2.783,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PA007V",d:"PA007 Visor TP-8268/T5/6063",kg:2.389,f:"TECNOPERFIL",l:"PROJETTA"},
{c:"PA-PERFILBOISERIE",d:"Boiserie 9602 JAT anod 6MT",kg:0.001,f:"MERCADO",l:"MERCADO"},
{c:"PA-PF-050",d:"PF 050 - 04 a 06 mm",kg:0.282,f:"MERCADO",l:"MERCADO"},
{c:"PA-PF-051",d:"PF 051 - 08 a 10 mm",kg:0.258,f:"MERCADO",l:"MERCADO"},
{c:"PA-PF-052",d:"PF 052 - 12 a 14 mm",kg:0.238,f:"MERCADO",l:"MERCADO"},
{c:"PA-PF-053",d:"PF 053 - 16 a 18 mm",kg:0.211,f:"MERCADO",l:"MERCADO"},
{c:"PA-PF-054",d:"PF 054 - 20 a 22 mm",kg:0.198,f:"MERCADO",l:"MERCADO"},
{c:"PA-PF-055",d:"PF 055 - 26 a 28 mm",kg:0.165,f:"MERCADO",l:"MERCADO"},
{c:"PA-PF-104",d:"Marco fixo para vidro",kg:0.720,f:"MERCADO",l:"MERCADO"},
{c:"PA-WEIKUBAGUETE",d:"Baguete pivotante 12-16mm PDS-1769",kg:0.401,f:"WEIKU",l:"WEIKU"},
{c:"PA-WEIKU_BT_QLON",d:"Batente folha pivotante PDS-1771",kg:1.003,f:"WEIKU",l:"WEIKU"},
{c:"PA-WEIKU_FLH_ALTURA",d:"Folha pivotante lateral PDS-1768",kg:2.908,f:"WEIKU",l:"WEIKU"},
{c:"PA-WEIKU_FLH_LARGURA",d:"Folha pivotante inf/sup PDS-1770",kg:2.837,f:"WEIKU",l:"WEIKU"},
{c:"PA-WEIKU_PORTAL",d:"Caixilho pivotante PDS-1774",kg:2.233,f:"WEIKU",l:"WEIKU"},
{c:"PA-WKU-001",d:"PA007-P WKU-001 6000",kg:2.822,f:"PERFISUD",l:"PROJETTA"},
{c:"PA-WKU-002",d:"PA007-F WKU-002 6000",kg:4.521,f:"PERFISUD",l:"PROJETTA"},
{c:"PA-WKU-003",d:"PA007-V WKU-003 6000",kg:1.814,f:"PERFISUD",l:"PROJETTA"},
{c:"PA-WKU-004",d:"PA006-P WKU-004",kg:1.700,f:"PERFISUD",l:"PROJETTA"},
{c:"PA-WKU-005",d:"PA006-F WKU-005 6000",kg:1.089,f:"PERFISUD",l:"PROJETTA"},
{c:"PA-WKU-006",d:"PA006-V WKU-006 6000",kg:1.414,f:"PERFISUD",l:"PROJETTA"},
{c:"PF45.017",d:"Complemento pivotante",kg:0.242,f:"MERCADO",l:"MERCADO"},
{c:"PF45.019",d:"Marco pivotante",kg:1.250,f:"MERCADO",l:"MERCADO"},
{c:"PF45.023",d:"Matajunta pivotante",kg:0.414,f:"MERCADO",l:"MERCADO"},
{c:"PF45.024",d:"Folha pivotante",kg:1.560,f:"MERCADO",l:"MERCADO"},
];

function renderPerfisDB(){
  var kgTecno=parseFloat($('pf-kg-tecnoperfil').value)||0;
  var kgMerc=parseFloat($('pf-kg-mercado').value)||0;
  var kgWeiku=parseFloat($('pf-kg-weiku').value)||0;
  var precoPint=parseFloat($('pf-preco-pintura').value)||0;
  var barraM=parseFloat($('pf-barra-m').value)||6;
  // Deduções fiscais (Lucro Real: ICMS+PIS+COFINS)
  var dedTecno=parseFloat(($('pf-ded-tecnoperfil')||{value:0}).value)||0;
  var dedMerc=parseFloat(($('pf-ded-mercado')||{value:0}).value)||0;
  var dedWeiku=parseFloat(($('pf-ded-weiku')||{value:0}).value)||0;
  var dedPint=parseFloat(($('pf-ded-pintura')||{value:0}).value)||0;
  // Preços LÍQUIDOS (após dedução fiscal)
  var liqTecno=kgTecno*(1-dedTecno/100);
  var liqMerc=kgMerc*(1-dedMerc/100);
  var liqWeiku=kgWeiku*(1-dedWeiku/100);
  var liqPint=precoPint*(1-dedPint/100);
  // Mostrar líquido nos labels
  var _liqEl1=$('pf-liq-tecnoperfil');if(_liqEl1)_liqEl1.textContent='Líq: '+liqTecno.toFixed(2);
  var _liqEl2=$('pf-liq-mercado');if(_liqEl2)_liqEl2.textContent='Líq: '+liqMerc.toFixed(2);
  var _liqEl3=$('pf-liq-weiku');if(_liqEl3)_liqEl3.textContent='Líq: '+liqWeiku.toFixed(2);
  var _liqEl4=$('pf-liq-pintura');if(_liqEl4)_liqEl4.textContent='Líq: '+liqPint.toFixed(2);
  // Perfis que recebem pintura
  var pintados=['PA-PA006F','PA-PA006P','PA-PA006V','PA-PA007F','PA-PA007P','PA-PA007V','PA-CANT-30X30X2.0'];
  function temPintura(cod){
    for(var i=0;i<pintados.length;i++){if(cod.indexOf(pintados[i])===0)return true;}
    return false;
  }
  var tb=$('pf-db-tbody');
  if(!tb) return;
  var pfFCod  =(($('pf-f-cod') ?$('pf-f-cod').value  :'')||'').toUpperCase().trim();
  var pfFDesc =(($('pf-f-desc')?$('pf-f-desc').value :'')||'').toUpperCase().trim();
  var pfFForn =(($('pf-f-forn')?$('pf-f-forn').value :'')||'').toUpperCase().trim();
  var rows='';
  PERFIS_DB.forEach(function(p,i){
    if(pfFCod  && (p.c||'').toUpperCase().indexOf(pfFCod)<0)  return;
    if(pfFDesc && (p.d||'').toUpperCase().indexOf(pfFDesc)<0) return;
    if(pfFForn && (p.f||'').toUpperCase().indexOf(pfFForn)<0) return;
    var effBarraM=barraM;if(p.c&&/-7M$/.test(p.c))effBarraM=7;else if(p.c&&/-8M$/.test(p.c))effBarraM=8;var kgBarra=Math.round(p.kg*effBarraM*100)/100;
    var precoKg=liqMerc;
    if(p.f==='TECNOPERFIL') precoKg=liqTecno;
    else if(p.f==='WEIKU') precoKg=liqWeiku;
    else if(p.f==='PERFISUD') precoKg=liqTecno;
    var precoPerfil=kgBarra*precoKg;
    var pinta=temPintura(p.c);
    var precoPintura=pinta?kgBarra*liqPint:0;
    var precoTotal=precoPerfil+precoPintura;
    var bg=pinta?'#fef9f0':i%2===0?'#fff':'#f9f8f5';
    var fnColor=p.f==='TECNOPERFIL'?'font-weight:800;color:#1a3a4a':p.f==='WEIKU'?'font-weight:800;color:var(--orange)':p.f==='PERFISUD'?'font-weight:800;color:#1a3a4a':'color:#666';
    var codStyle=pinta?'font-weight:800;font-size:11px;color:#8e44ad':'font-weight:600;font-size:11px';
    var pintTag=pinta?' 🎨':'';
    rows+='<tr style="background:'+bg+(pinta?';border-left:3px solid #8e44ad':'')+'">'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;'+codStyle+'">'+p.c+pintTag+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;font-size:11px;'+(pinta?'font-weight:700':'')+'">'+p.d+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:center;font-size:11px;'+fnColor+'">'+p.f+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;font-weight:600;font-size:11px">'+p.kg.toFixed(3).replace('.',',')+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;font-size:11px">'+kgBarra.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;font-size:11px;color:var(--navy)">'+precoPerfil.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;font-size:11px;color:'+(pinta?'#8e44ad':'#ccc')+';'+(pinta?'font-weight:700':'')+'">'+(pinta?precoPintura.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—')+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:right;font-weight:700;font-size:12px;color:var(--navy)">R$ '+precoTotal.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:2px 2px;border-bottom:0.5px solid #eee;text-align:center"><button onclick="_deletePerfil('+i+')" title="Excluir perfil" style="border:none;background:none;color:#ccc;font-size:13px;cursor:pointer;padding:0 2px;line-height:1" onmouseover="this.style.color=\'#b71c1c\'" onmouseout="this.style.color=\'#ccc\'">×</button></td>'
      +'</tr>';
  });
  tb.innerHTML=rows;
}
function salvarPerfisKg(){
  /* ╔══════════════════════════════════════════════════════════════════╗
     ║  PROTEÇÃO: Nunca salvar se todos os campos estão vazios/zero.   ║
     ║  Isso evita que um bug zere os preços salvos no localStorage.   ║
     ╚══════════════════════════════════════════════════════════════════╝ */
  try{
    var t=$('pf-kg-tecnoperfil').value;
    var m=$('pf-kg-mercado').value;
    var w=$('pf-kg-weiku').value;
    var p=$('pf-preco-pintura').value;
    // Se TODOS vazios, não salvar (proteção contra reset acidental)
    if(!t&&!m&&!w&&!p) return;
    localStorage.setItem('projetta_perfis_kg',JSON.stringify({
      tecnoperfil:t,
      mercado:m,
      weiku:w,
      pintura:p,
      ded_tecnoperfil:$('pf-ded-tecnoperfil').value,
      ded_mercado:$('pf-ded-mercado').value,
      ded_weiku:$('pf-ded-weiku').value,
      ded_pintura:$('pf-ded-pintura').value
    }));
    // Backup na nuvem
    if(typeof _savePerfisCloud==='function') _savePerfisCloud();
  }catch(e){}
  _updateLiqPerfis();
}
function _updateLiqPerfis(){
  ['tecnoperfil','mercado','weiku','pintura'].forEach(function(k){
    var prId=k==='pintura'?'pf-preco-pintura':'pf-kg-'+k;
    var pr=parseFloat(($(prId)||{value:0}).value)||0;
    var ded=parseFloat(($('pf-ded-'+k)||{value:0}).value)||0;
    var liq=pr*(1-ded/100);
    var el=$('pf-liq-'+k);
    if(el) el.textContent=ded>0?' Líq: '+liq.toFixed(2):'';
  });
}
function _getPfLiq(tipo){
  var map={TECNOPERFIL:'tecnoperfil',PROJETTA:'tecnoperfil',PERFISUD:'tecnoperfil',MERCADO:'mercado',WEIKU:'weiku'};
  var k=map[tipo]||'mercado';
  var prId=k==='pintura'?'pf-preco-pintura':'pf-kg-'+k;
  var pr=parseFloat(($(prId)||{value:0}).value)||0;
  var ded=parseFloat(($('pf-ded-'+k)||{value:0}).value)||0;
  return pr*(1-ded/100);
}
function _getPintLiq(){
  var pr=parseFloat(($('pf-preco-pintura')||{value:0}).value)||0;
  var ded=parseFloat(($('pf-ded-pintura')||{value:0}).value)||0;
  return pr*(1-ded/100);
}
function loadPrecoKg(){
  try{
    var s=localStorage.getItem('projetta_perfis_kg');
    if(s){
      var d=JSON.parse(s);
      if(d.tecnoperfil) $('pf-kg-tecnoperfil').value=d.tecnoperfil;
      if(d.mercado) $('pf-kg-mercado').value=d.mercado;
      if(d.weiku) $('pf-kg-weiku').value=d.weiku;
      if(d.pintura) $('pf-preco-pintura').value=d.pintura;
      if(d.ded_tecnoperfil) $('pf-ded-tecnoperfil').value=d.ded_tecnoperfil;
      if(d.ded_mercado) $('pf-ded-mercado').value=d.ded_mercado;
      if(d.ded_weiku) $('pf-ded-weiku').value=d.ded_weiku;
      if(d.ded_pintura) $('pf-ded-pintura').value=d.ded_pintura;
    } else {
      var old=localStorage.getItem('projetta_preco_kg');
      if(old) $('pf-kg-mercado').value=old;
    }
    // Se localStorage vazio, tentar carregar do Supabase
    if(!s || (!$('pf-kg-tecnoperfil').value && !$('pf-kg-mercado').value)){
      _loadPerfisCloud();
    }
  }catch(e){}
  _updateLiqPerfis();
}
// Cloud backup/restore para preços de perfis
function _savePerfisCloud(){
  try{
    var data={
      tecnoperfil:$('pf-kg-tecnoperfil').value,mercado:$('pf-kg-mercado').value,
      weiku:$('pf-kg-weiku').value,pintura:$('pf-preco-pintura').value,
      ded_tecnoperfil:$('pf-ded-tecnoperfil').value,ded_mercado:$('pf-ded-mercado').value,
      ded_weiku:$('pf-ded-weiku').value,ded_pintura:$('pf-ded-pintura').value
    };
    if(!data.tecnoperfil&&!data.mercado)return;
    fetch(window._SB_URL+'/rest/v1/configuracoes',{method:'POST',
      headers:{'apikey':window._SB_KEY,'Authorization':'Bearer '+window._SB_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({chave:'precos_perfis',valor:data})
    }).catch(function(){});
  }catch(e){}
}
function _loadPerfisCloud(){
  try{
    fetch(window._SB_URL+'/rest/v1/configuracoes?chave=eq.precos_perfis&select=valor&limit=1',
      {headers:{'apikey':window._SB_KEY,'Authorization':'Bearer '+window._SB_KEY}})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(rows&&rows.length&&rows[0].valor){
          var d=rows[0].valor;
          if(d.tecnoperfil){$('pf-kg-tecnoperfil').value=d.tecnoperfil;}
          if(d.mercado){$('pf-kg-mercado').value=d.mercado;}
          if(d.weiku){$('pf-kg-weiku').value=d.weiku;}
          if(d.pintura){$('pf-preco-pintura').value=d.pintura;}
          if(d.ded_tecnoperfil){$('pf-ded-tecnoperfil').value=d.ded_tecnoperfil;}
          if(d.ded_mercado){$('pf-ded-mercado').value=d.ded_mercado;}
          if(d.ded_weiku){$('pf-ded-weiku').value=d.ded_weiku;}
          if(d.ded_pintura){$('pf-ded-pintura').value=d.ded_pintura;}
          // Salvar no localStorage também
          localStorage.setItem('projetta_perfis_kg',JSON.stringify(d));
          _updateLiqPerfis();
          console.log('✅ Preços perfis restaurados do Supabase');
        }
      }).catch(function(){});
  }catch(e){}
}


const COMP_DB=[
{c:"PA-ATELIER-ROS-RD DR",d:"ROSETA CLASSICA - ATELIER DUMETAL",f:"ATELIER DU METAL",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"ECV-0512",d:"ESCOVA DE VEDAÇÃO 5X12MM",f:"CDA METAIS",p:0.0,u:"MT",cat:"VEDAÇÃO"},
{c:"PA-STRETCH",d:"FILME STRETCH 25X500 SEM TUBETE TR",f:"CENTROOESTE",p:0.0,u:"RL",cat:"OUTROS"},
{c:"PFCON37520C",d:"CONEXÃO DE AUXÍLIO PARA CANTO 90º NO PF45.019",f:"DECAMP",p:0.0,u:"PC",cat:"OUTROS"},
{c:"PFCON41063C",d:"CONEXÃO DE AUXÍLIO PARA CANTO 90º NO PF45.024",f:"DECAMP",p:0.0,u:"PC",cat:"OUTROS"},
{c:"PFPVESC550",d:"ESCOVA DE VEDAÇÃO 5 X 5 MM",f:"DECAMP",p:0.0,u:"MT",cat:"VEDAÇÃO"},
{c:"PA-TEDEE-BRIDGE",d:"Tedee Bridge TBV1.0 conexao wireless de Sinal Wifi com fonte de alimentacao para Lock TLV",f:"DOORWIN",p:664.72,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-TEDEE-FEC-BRONZE",d:"Tedee Lock - PRO Homekit Fechadura Inteligente Stainless Steel TLV1.0C HK",f:"DOORWIN",p:2174.41,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-TEDEE-FEC-DOURADA",d:"Tedee Lock - PRO Homekit Fechadura Inteligente Dourada Preta TLV1.0D HK",f:"DOORWIN",p:2174.41,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-TEDEE-FEC-PRT/BRA",d:"Tedee Lock - PRO Homekit Fechadura Inteligente Prata / Branca TLV1.0A HK",f:"DOORWIN",p:1993.51,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-TEDEE-FEC-PT",d:"Tedee Lock - PRO Homekit Fechadura Inteligente Preta TLV1.0B HK",f:"DOORWIN",p:1993.51,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-TEDEE-TEC-BR",d:"Tedee Keypad-PRO Teclado biometrica inteligente TKV2.0 , com Senha (PIN) e impressao digital cor Bra",f:"DOORWIN",p:664.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-TEDEE-TEC-PT",d:"Tedee Keypad-PRO Teclado biometrica inteligente TKV2.0 , com Senha (PIN) e impressao digital cor Pre",f:"DOORWIN",p:664.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-TEDEE-CONT SEC",d:"Contato Seco / Dry Contact (DC) Tedee BLE modelo TDCV1.0A",f:"DOORWIN",p:476.48,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-MOLA GUIA DIR",d:"GUIA DESLIZANTE C/ BRACO DIR. P/ ITS - 914.20.96200",f:"DORMAKABA",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-MOLA GUIA ESQ",d:"GUIA DESLIZANTE C/ BRACO ESQ. P/ ITS - 914.20.96100",f:"DORMAKABA",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-MOLA ITS-96",d:"PA-MOLA ITS-96",f:"DORMAKABA",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-MOLA TRAVA PARADA",d:"TRAVA DE PARADA RF P/ CALHA DESLIZANTE TS93/ITS96 - 905.05.14000",f:"DORMAKABA",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-DOWSIL 995 ESTR SH",d:"DOWSIL 995 PRETO SACHE 591ML",f:"DOWSIL",p:73.9,u:"PC",cat:"SELANTE"},
{c:"PA-DOWSIL PRETO",d:"DOWSIL 791 PRETO TUBO 300ML - P0000036",f:"DOWSIL",p:29.4,u:"PC",cat:"SELANTE"},
{c:"PA-DOWSIL BRONZE",d:"DOWSIL 791 BRONZE TUBO 300ML - P0000022",f:"DOWSIL",p:29.4,u:"PC",cat:"SELANTE"},
{c:"PA-DOWSIL BRANCO",d:"DOWSIL 791 BRANCO TUBO 300ML - P0000020",f:"DOWSIL",p:29.4,u:"PC",cat:"SELANTE"},
{c:"PA-DOWSIL INCOLOR",d:"DOWSIL 768 INCOLOR TUBO 300ML - P0000008",f:"DOWSIL",p:21.95,u:"PC",cat:"SELANTE"},
{c:"PA-DOWSIL CPS BR",d:"DOWSIL CPS BRANCO SACHE 591ML",f:"DOWSIL",p:44.28,u:"PC",cat:"SELANTE"},
{c:"PA-CREMONA MAGNETICA",d:"CREMONA MAGNETICA - CROMADA - 4100NL",f:"ECLISSE",p:981.58,u:"PC",cat:"FECHADURA"},
{c:"PA-PIV FRIST M32+SCG",d:"PIVOT COM MOLA SYSTEM M32",f:"ECLISSE",p:0.0,u:"PC",cat:"PIVÔ"},
{c:"PA-PIV FRIST M42+SCG",d:"PIVOT COM MOLA SYSTEM M42+ SCG 500 KG kit completo - ST.M+.70.G.S.SS",f:"ECLISSE",p:0.0,u:"PC",cat:"PIVÔ"},
{c:"PA-DIG EMTECO BAR II",d:"FECHADURA DIGITAL BARCELONA II (WIFI) BIOMETRIA/SENHA/CHAVE/APP - EMBUTIR",f:"EMTECO",p:2395.8,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-QL 48700",d:"Q-LON 48700 PRETO R-250 9005",f:"SCHLEGEL",p:6.99,u:"PC",cat:"VEDAÇÃO"},
{c:"PA-QL 48750",d:"Q-LON 48 750 PRETA R-600",f:"SCHLEGEL",p:5.09,u:"MT",cat:"VEDAÇÃO"},
{c:"PA-QL 48800",d:"Q-LON 48 800 PRETA FLIPPER SEAL R-250",f:"SCHLEGEL",p:7.58,u:"MT",cat:"VEDAÇÃO"},
{c:"PA-BUCHA 06",d:"DUOPOWER 6 - SC1500",f:"FISCHER",p:0.18,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-BUCHA 08",d:"DUOPOWER 8 - SC750",f:"FISCHER",p:0.3,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-BUCHA 10",d:"BUCHA SX10 - SC300",f:"FISCHER",p:0.44,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-MOLA MARIX",d:"MOLA MARIX P/ PORTA DE ALUMINIO C/TP INOX - 199i",f:"HANDCRAFT",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA - PILHA AA 4X",d:"PACOTE DE PILHA (AA) COM 4 UNIDADES",f:"HOMEX",p:0.0,u:"PC",cat:"PILHA"},
{c:"PA - PILHA AAA 4X",d:"PACOTE DE PILHA (AA) COM 4 UNIDADES",f:"HOMEX",p:0.0,u:"PC",cat:"PILHA"},
{c:"PA - TAG",d:"TAG",f:"HOMEX",p:0.0,u:"PC",cat:"OUTROS"},
{c:"PA-9300",d:"FECHADURA ELETRONICA MODELO 9300 COR PRETA - PHILIPS/HOMEX",f:"HOMEX",p:4093.87,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-9300-KIT",d:"KIT EXTENSOR 9300",f:"HOMEX",p:52.18,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-9300ALONGA38-60",d:"KET DO ALONGADOR 9300 38-60 (INCLUSO NA PA-9300)",f:"HOMEX",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-9300ALONGA90-120",d:"KIT DO ALONGADOR 9300 90-120 (INCLUSO NA PA-9300)",f:"HOMEX",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-9300CAIXETA",d:"CAIXETA DA 9300 (INCLUSO NA PA-9300)",f:"HOMEX",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-9300CHMONTFIX",d:"CHAPA DE MONTAGEM DA FIXAÇÃO INTERNA 9300 (INCLUSO NA PA-9300)",f:"HOMEX",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-9300CHMONTGEST",d:"CHAPA DE MONTAGEM DA ESTRUTURA 9300 (INCLUSO NA PA-9300)",f:"HOMEX",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-9300CONTRATESTA",d:"CONTRA TESTA PARA FECHADURA 9300 (INCLUSO NA PA-9300)",f:"HOMEX",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-9300GATEWAY",d:"GATEWAY PARA 9300 (INCLUSO NA PA-9300)",f:"HOMEX",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-9300MOTRIZE",d:"MORTIZE PARA 9300 (INCLUSO NA PA-9300)",f:"HOMEX",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-DIG PH EK K9300",d:"FECHADURA ELETRONICA, MODELO 9300, COR PRETA",f:"HOMEX",p:4145.95,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PAR1029NAT",d:"PAR.A/A.CAB.PANELA 4,2X38MM FDA.PHS. (DIN 7981) INOX304 NATURAL (PC)",f:"HYDRO",p:0.0,u:"PC",cat:"OUTROS"},
{c:"PA-CHAAA PHS 35X20",d:"PARAFUSOS DIVERSOS ZINCADO  35X20MM (6407/00)",f:"INOX-PAR",p:0.32,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PAN AA PHS 4,2X13",d:"CHATA AA PHS 4,2 X 13 BROC. 410",f:"INOX-PAR",p:0.0,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PAN AA PHS 4,2X19",d:"PAN AA PHS 4,2 X 19 BROC. 410 - 7504N4.2X19410",f:"INOX-PAR",p:0.1,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PAR BRO 5,5X38",d:"SEXT AA BROC. 5,5 X 38 C/ ARR. NEOPR. 410 - ASX5.5X38BRC410",f:"INOX-PAR",p:0.47,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PAR BRO 5,5X50",d:"PARAFUSO SEXTAVADO C/ARRUELA PHS PONTA BROCA 12X2 - 3058",f:"INOX-PAR",p:0.0,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PAR BRO 5,5X58",d:"SEXT AA 5.5 X 58 C/ARR. N EOPRENE BROC. PONTA COSTU RA 410 - ASX5.5X58PC410",f:"INOX-PAR",p:0.57,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PAR BRO 5,5X90",d:"PARAFUSO SEXTAVADO BROCANTE 5,5X1.1/2\"(38MM)",f:"INOX-PAR",p:0.0,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PAR SOB M6X100",d:"SEXT SOB M6 X 100 DIN 571 A2 - 5716X100A2",f:"INOX-PAR",p:0.91,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PAR SOB M6X65",d:"SEXT SOB M6 X 65 DIN 571 A2 - 5716X65A2",f:"INOX-PAR",p:0.57,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-REBTAPA04012NA",d:"REB. DE REP. REPUXO TP CEGO 4,0X120 ALUMINIO - CAS412",f:"INOX-PAR",p:0.07,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PUX-1,5MT ESC",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1500MM ACAB. ESCOVADO - 01069",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-1,5MT POL",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1500MM ACAB. POLIDO - 01066",f:"INSTALE",p:370.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-1,5MT PRE",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1500MM ACAB. PRETO FOSCO - 01081",f:"INSTALE",p:560.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-1MT ESC",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1000MM ACAB. ESCOVADO - 2513",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-1MT POL",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1000MM ACAB. POLIDO - 125125",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-1MT PRE",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1000MM ACAB. PRETO FOSCO - 01077",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-2MT ESC",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X2000MM ACAB. ESCOVADO - 01071",f:"INSTALE",p:590.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-2MT POL",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X2000 MM ACAB. POLIDO - 01067",f:"INSTALE",p:840.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-2MT PRE",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X2000MM ACAB. PRETO FOSCO - 01079",f:"INSTALE",p:680.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-3MT ESC",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X3000MM ACAB. ESCOVADO - FORMA6",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-3MT POL",d:"FORMATTO - PUXADOR DUPLA FIXACAO EM ACO INOX 304 TAM. 50X20X3000MM ACAB. POLIDO - 05012",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-3MT PRE",d:"FORMATTO - PUXADOR DUPLA FIXACAO EM ACO INOX 304 TAM. 50X20X3000MM ACAB. PRETO FOSCO - 16546",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-4MT ESC",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X4000MM ACAB. ESCOVADO - FORMA1",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-4MT POL",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X4000MM ACAB. POLIDO - 0320101",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-4MT PRE",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X4000MM ACAB. PRETO FOSCO - FORMA4",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-5MT ESC",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X5000MM ACAB. ESCOVADO - FORMA3",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-5MT POL",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X5000MM ACAB. POLIDO - FORMA2",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-PUX-5MT PRE",d:"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X5000MM ACAB. PRETO FOSCO - FORMA5",f:"INSTALE",p:0.0,u:"PC",cat:"PUXADOR"},
{c:"PA-CHAVESEG",d:"CHAVE DE SEGURANÇA",f:"KESO",p:36.41,u:"PC",cat:"OUTROS"},
{c:"PA-KESO CRT 4P RL BL",d:"CONTRA TESTA EM INOX 04 PINOS SEM A DOBRA FURO OBLONGO ACAB. PRETO",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO CRT 4P RL CR",d:"CONTRA TESTA EM INOX 04 PINOS SEM A DOBRA FURO OBLONGO ACAB. CRA",f:"KESO",p:31.88,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO CRT 4P RT BL",d:"CONTRA TESTA EM INOX FURO OBLONGO DA 04 PINOS 60291BLR",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO CRT 4P RT CR",d:"CONTRA TESTA EM INOX FURO OBLONGO DA 04 PINOS 60291CRA",f:"KESO",p:36.61,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO CRT AUX BL",d:"CONTRA TESTA EM INOX AUXILIAR DA 03 PONTOS FURO OBLONGO ACAB.PRETO",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO CRT AUX CR",d:"CONTRA TESTA EM INOX AUXILIAR DA 03 PONTOS FURO OBLONGO ACAB.CRA",f:"KESO",p:28.63,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO CRT TRA BL",d:"CONTRA TESTA EM INOX PRETO PORTA E BATENTE FECHAMENTO TRASEIRO",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO CRT TRA CR",d:"CONTRA TESTA EM INOX ESCOVADO PORTA E BATENTE FECHAMENTO TRASEIRO",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO CXT  AUX",d:"CAIXETA DE ACABAMENTO P/ AUXILIARES 04 PINOS",f:"KESO",p:25.7,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO CXT 4P",d:"CAIXETA DE ACABAMENTO P/ FECHADURA ROLETE  04 PINOS",f:"KESO",p:35.09,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO ROS QD BL",d:"ENTRADA P/EURO 53x53x8 QUADRADA E06 INOX PRETO - 00000405",f:"KESO",p:14.48,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO ROS QD P",d:"ENTRADA P/EURO 53x53x8 QUADRADA E06 INOX P - 00000400",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO ROS QD S",d:"ENTRADA P/EURO 53x53x8 QUADRADA E06 INOX S - 00000401",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO ROS RD BL",d:"ROSETA ENTRADA P/CIL.EURO G009 BL INOX PRETO - 00000648",f:"KESO",p:15.26,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO ROS RD CR",d:"ROSETA ENTRADA P/CIL.EURO G009 CR INOX - 00000743",f:"KESO",p:15.26,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO ROS RD CRA",d:"ROSETA ENTRADA P/CIL.EURO G009 CRA INOX - 00000744",f:"KESO",p:15.26,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO ROS RD LP",d:"ENTRADA P/EUROPERFIL M14S LP(F71) - 00000645",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO-MACANETA BL",d:"MEIA MACANETA S229L/G009/PZ/ INOX PRETO - 00001569",f:"KESO",p:99.49,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO-MACANETA CR",d:"MEIA MACANETA S229L/G009/PZ/INOX S - 00001570",f:"KESO",p:77.42,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESO04P RL BL",d:"FECHADURA NIVA PLUS 04P TRINCO ROLETE BL - 30306BL",f:"KESO",p:245.47,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO04P RL CR",d:"FECHADURA NIVA PLUS 04P TRINCO ROLETE CR - 30306CR",f:"KESO",p:226.37,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO04P RT BL",d:"FECHADURA NIVA PLUS 04P VOLPER BL TRINCO RETO - 30305BL",f:"KESO",p:203.14,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO04P RT CR",d:"FECHADURA NIVA PLUS 04P VOLPER CR TRINCO RETO - 30305CR",f:"KESO",p:177.09,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO08P RL BL",d:"FECHADURA NIVA PLUS 08P VOLPER ROLETE 60MM BL - 30317BL",f:"KESO",p:397.96,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO08P RL CR",d:"FECHADURA NIVA PLUS 08P VOLPER ROLETE 60MM CR - 30317CR",f:"KESO",p:397.96,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO08P RT BL",d:"FECHADURA NIVA PLUS 08P VOLPER TRINCO RETO 60MM BL - 30316BL",f:"KESO",p:397.96,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO08P RT CR",d:"FECHADURA NIVA PLUS 08P VOLPER TRINCO RETO 60MM CR - 30316CR",f:"KESO",p:397.96,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO08P+1 RL BL",d:"FECHADURA NIVA PLUS 08P VOLPER ROLETE 60MM BL C/ FECHAMENTO ATRAS - 32317BL",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO08P+1 RL CR",d:"FECHADURA NIVA PLUS 08P VOLPER ROLETE 60MM CR C/ FECHAMENTO ATRAS - 32317CR",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO08P+1 RT BL",d:"FECHADURA NIVA PLUS 08P VOLPER TRINCO 60MM BL C/ FECHAMENTO ATRAS",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO08P+1 RT CR",d:"FECHADURA NIVA PLUS 08P VOLPER TRINCO 60MM CR C/ FECHAMENTO ATRAS",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO1/2C 65 BL",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 65MM",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 65 CF",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 65MM",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 70 BL",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 70MM",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 70 BL BT",d:"MEIO CILINDRO EUROPERFIL BL BT LIG.ACO 70MM",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 70 CF",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 70MM - 8970CFR",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 70 CF BT",d:"MEIO CILINDRO EUROPERFIL CF BT LIG.ACO 70MM",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 70BLBTTD",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 70MM COM BOTAO. P/SMART TEDEE",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 70BLNK",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 70MM P/SMART LOCK NUKI",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 70CFBTTD",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 70MM COM BOTAO. P/SMART TEDEE - 8970CFRK",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 70CFNK",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 70MM P/SMART LOCK NUKI",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 75 BL",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 75MM - 8975BLR",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 75 BL BT",d:"MEIO CILINDRO EUROPERFIL LIG.ACO 75MM C/ BOTAO - BL - 8975BLRK",f:"KESO",p:340.94,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 75 CF",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 75MM",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 75 CF BT",d:"MEIO CILINDRO EUROPERFIL LIG.ACO 75MM C/ BOTAO LP - CF",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 75 DR BT",d:"MEIO CILINDRO EUROPERFIL LIG.ACO 75MM C/ BOTAO LP - DOURADO - 8975U3RK",f:"KESO",p:360.27,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 75BLBTTD",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 75MM COM BOTAO. P/SMART TEDEE",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 75BLNK",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 75MM P/SMART LOCK NUKI",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 75CFBTTD",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 75MM COM BOTAO. P/SMART TEDEE",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 75CFNK",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 75MM P/SMART LOCK NUKI",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 85 BL",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 85MM",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 85 BL BT",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 85MM C/ BOTÃO - 8977BLRK",f:"KESO",p:427.33,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 85 CF",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 85MM",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 85 CF BT",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 85MM C/ BOTÃO",f:"KESO",p:427.33,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 85BLBTTD",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 85MM COM BOTAO. P/SMART TEDEE",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 85BLNK",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 85MM P/SMART LOCK NUKI",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 85CFBTTD",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 85MM COM BOTAO. P/SMART TEDEE",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO1/2C 85CFNK",d:"MEIO CILINDRO EUROPERFIL CF LIG.ACO 85MM P/SMART LOCK NUKI",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESO12P+2A72RLBL",d:"FECHADURA NIVA PLUS 12P 70200  VOLPER ROLETE BL C/ 02 FECHAMENTO ATRAS",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P+2A72RLCR",d:"FECHADURA NIVA PLUS 12P 70200  VOLPER ROLETE CR C/ 02 FECHAMENTO ATRAS",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P+2A72RTBL",d:"FECHADURA NIVA PLUS 12P 70200  VOLPER TRINCO RETO BL C/ 02 FECHAMENTO ATRAS",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P+2A72RTCL",d:"FECHADURA NIVA PLUS 12P 70200  VOLPER TRINCO RETO CR C/ 02 FECHAMENTO ATRAS",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P+2ACM RL B",d:"FECHADURA NIVA PLUS 12P ACM  VOLPER ROLETE BL C/ 02 FECHAMENTO ATRAS - 405215BL",f:"KESO",p:863.94,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P+2ACM RL C",d:"FECHADURA NIVA PLUS 12P ACM  VOLPER ROLETE C C/ 02 FECHAMENTO ATRAS",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P+2ACM RT B",d:"FECHADURA NIVA PLUS 12P ACM  VOLPER TRINCO RETO BL C/ 02 FECHAMENTO ATRAS - 305215BL",f:"KESO",p:814.66,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P+2ACM RT C",d:"FECHADURA NIVA PLUS 12P ACM  VOLPER TRINCO RETO C C/ 02 FECHAMENTO ATRAS - 305215CR",f:"KESO",p:847.94,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P7020 RL BL",d:"FECHADURA NIVA PLUS 12P 70200 VOLPER ROLETE BL - 40215BL",f:"KESO",p:686.17,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P7020 RL CR",d:"FECHADURA NIVA PLUS 12P 70200 VOLPER ROLETE CR",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P7020 RT BL",d:"FECHADURA NIVA PLUS 12P 70200 VOLPER TRINCO RETO BL - 30215BL",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12P7020 RT CR",d:"FECHADURA NIVA PLUS 12P 70200 VOLPER TRINCO RETO CR",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12PACM RL BL",d:"FECHADURA NIVA PLUS 12P ACM VOLPER ROLETE BL - 404215BL",f:"KESO",p:686.99,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12PACM RL CR",d:"FECHADURA NIVA PLUS 12P ACM VOLPER ROLETE CR - 404215CR",f:"KESO",p:648.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12PACM RT BL",d:"FECHADURA NIVA PLUS 12P ACM VOLPER TRINCO RETO BL - 304215BL",f:"KESO",p:677.36,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO12PACM RT CR",d:"FECHADURA NIVA PLUS 12P ACM VOLPER TRINCO RETO CR - 304215CR",f:"KESO",p:653.24,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO16P+2ACM RL B",d:"FECHADURA NIVA PLUS 16P ACM  VOLPER ROLETE BL C/ 02 FECHAMENTO ATRAS - 406216BL",f:"KESO",p:1196.94,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO16P+2ACM RL C",d:"FECHADURA NIVA PLUS 16P ACM  VOLPER ROLETE CR C/ 02 FECHAMENTO ATRAS - 406216CR",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO16P+2ACM RT B",d:"FECHADURA NIVA PLUS 16P ACM  VOLPER TRINCO RETO BL C/ 02 FECHAMENTO ATRAS - 306216BL",f:"KESO",p:1296.51,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO16P+2ACM RT C",d:"FECHADURA NIVA PLUS 16P ACM  VOLPER TRINCO RETO CR C/ 02 FECHAMENTO ATRAS  - 306216CR",f:"KESO",p:1203.51,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO16PACM RL BL",d:"FECHADURA NIVA PLUS 16P ACM VOLPER ROLETE BL - 406215BL",f:"KESO",p:1151.28,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO16PACM RL CR",d:"FECHADURA NIVA PLUS 16P ACM VOLPER ROLETE CR - 406215CR",f:"KESO",p:1090.51,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO16PACM RT BL",d:"FECHADURA NIVA PLUS 16P ACM VOLPER TRINCO RETO BL - 306215BL",f:"KESO",p:1242.73,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO16PACM RT CR",d:"FECHADURA NIVA PLUS 16P ACM VOLPER TRINCO RETO CR - 306215CR",f:"KESO",p:1242.73,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO24P RL BL",d:"FECHADURA NIVA PLUS 24P ACM VOLPER ROLETE BL - 41600BL",f:"KESO",p:1554.88,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO24P RL CR",d:"FECHADURA NIVA PLUS 24P ACM VOLPER ROLETE CR - 41600CR",f:"KESO",p:855.7,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO24P RT BL",d:"FECHADURA NIVA PLUS 24P ACM VOLPER TRINCO RETO BL",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO24P RT CR",d:"FECHADURA NIVA PLUS 24P ACM VOLPER TRICNCO RETO CR",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO24P+2 RL BL",d:"FECHADURA NIVA PLUS 24 ACM 06 PONTOS ROLETE BL C/ 02 FECHAMENTO ATRAS - 41601BL",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO24P+2 RL CR",d:"FECHADURA NIVA PLUS 24 ACM 06 PONTOS ROLETE CR C/ 02 FECHAMENTO ATRAS - 41601CR",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO24P+2 RT BL",d:"FECHADURA NIVA PLUS 24 ACM 06 PONTOS TRINCO RETO BL C/ 02 FECHAMENTO ATRAS",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESO24P+2 RT CR",d:"FECHADURA NIVA PLUS 24 ACM 06 PONTOS TRINCO RETO CR C/ 02 FECHAMENTO ATRAS",f:"KESO",p:0.0,u:"PC",cat:"FECHADURA"},
{c:"PA-KESOCIL 060 CF",d:"CILINDRO EUROPERFIL CF 60/00/00 LIG.ACO - 8000CFR",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL 075 BL",d:"MEIO CILINDRO EUROPERFIL BL LIG.ACO 75MM - 8975BLR",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL 080 BL",d:"CILINDRO EUROPERFIL BL 80/10/10 LIG.INOX - 8020BLR",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL 080 CF",d:"CILINDRO EUROPERFIL CF 80/10/10 LIG.ACO - 8020CFR",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL 090 BL",d:"CILINDRO EUROPERFIL BL 90/15/15 LIG.ACO - 8027BLR",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL 090 BT BL",d:"CILINDRO EURO.BL 90/15/15 C/BOTAO LIG.ACO - 8027BLRK",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL 090 BT CF",d:"CILINDRO EURO.CF 90/15/15 C/BOTAO L.INOX - 8027CFRK",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL 090 CF",d:"CILINDRO EUROPERFIL CF 90/15/15 LIG.ACO - 8027CFR",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL 100 BT BL",d:"CILINDRO EUROPERFIL BL 100/20/20 LIG.ACO PARA SMART LOCK C/BOTÃO P/SMART T",f:"KESO",p:533.4,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL0 060 BL",d:"CILINDRO EUROPERFIL BL 60/00/00 LIG.ACO - 8000BLR",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL115 BLNK",d:"CILINDRO EUROPERFIL BL 115/35/20 LIG.ACO  PARA SMART LOCK NUKI.",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL115 CFNK",d:"CILINDRO EUROPERFIL CF 115/35/20 LIG.ACO  PARA SMART LOCK NUKI. (8945CFR)",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL115BLNKCF",d:"CILINDRO EUROPERFIL BL/CF 115/35/20 LIG.ACO  PARA SMART LOCK NUKI. CF",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL115CFNKBL",d:"CILINDRO EUROPERFIL BL/CF 115/35/20 LIG.ACO  PARA SMART LOCK NUKI. BL",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130 BL",d:"CILINDRO EUROPERFIL BL 130/35/35 LIG.ACO - 8039BLR",f:"KESO",p:626.78,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130 BLCF",d:"CILINDRO EUROPERFIL BL/CF 130/35/35 LIG.ACO",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130 BLTD",d:"CILINDRO EUROPERFIL BL 130/35/35 PARA SMART LOCK C/BOTAO. TEDEE (8930BLRK )",f:"KESO",p:670.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130 BT BL",d:"CILINDRO EUROPERFIL CF 130/35/35 LIG.ACO C/ BOTAO - 8039BLRK",f:"KESO",p:670.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130 BT CF",d:"CILINDRO EUROPERFIL BL 130/35/35 LIG.ACO C/ BOTAO - 8039CFRK",f:"KESO",p:670.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130 CF",d:"CILINDRO EUROPERFIL CF 130/35/35 LIG.ACO - 8039CFR",f:"KESO",p:626.78,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130 CFTD",d:"CILINDRO EUROPERFIL CF 130/35/35 C/BOTAO PARA SMART TEDEE. (8930CFRK)",f:"KESO",p:670.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130BLBTCF",d:"CILINDRO EUROPERFIL BL/CF 130/35/35 LIG.ACO C/ BOTAO CF",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130BLTDCF",d:"CILINDRO EUROPERFIL BL/CF 130/35/35 LIG.ACO PARA SMART LOCK C/BOTAO. TEDEE CF",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130CFBTBL",d:"CILINDRO EUROPERFIL CF/BL 130/35/35 LIG.ACO C/ BOTAO BL",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL130CFTDBL",d:"CILINDRO EUROPERFIL BL/CF 130/35/35 LIG.ACO PARA SMART LOCK C/BOTAO. TEDEE  BL",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL135 BLNK",d:"CILINDRO EUROPERFIL BL 135/45/30 LIG.ACO  PARA SMART LOCK NUKI.",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL135 CFNK",d:"CILINDRO EUROPERFIL CF 135/45/30 LIG.ACO  PARA SMART LOCK NUKI.",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL135BLNKCF",d:"CILINDRO EUROPERFIL BL/CF 135/45/30 LIG.ACO  PARA SMART LOCK NUKI. CF",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL135CFNKBL",d:"CILINDRO EUROPERFIL BL/CF 135/45/30 LIG.ACO  PARA SMART LOCK NUKI. BL",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150 BL",d:"CILINDRO EUROPERFIL BL 150/45/45 LIG.ACO - 8150BLR",f:"KESO",p:760.89,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL190 BL",d:"CILINDRO EUROPERFIL BL 190/65/65  LIG.ACO",f:"KESO",p:980.04,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150 BL TD",d:"CILINDRO EUROPERFIL BL 150/45/45 LIG.ACO  PARA SMART LOCK C/BOTAO. TEDDE. (8912BLRK )",f:"KESO",p:807.58,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150 BLCF",d:"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150 BT BL",d:"CILINDRO EUROPERFIL BL 150/45/45 LIG.ACO COM BOTAO - 8150BLRK",f:"KESO",p:804.11,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150 BT CF",d:"CILINDRO EUROPERFIL CF 150/45/45 LIG.ACO COM BOTAO CF - 8150CFRK",f:"KESO",p:859.63,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150 CF",d:"CILINDRO EUROPERFIL CF 150/45/45 LIG.ACO - 8150CFR",f:"KESO",p:760.9,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150 CFTD",d:"CILINDRO EUROPERFIL CF 150/45/45 LIG.ACO  PARA SMART LOCK C/BOTAO. TEDEE. (8912CFRK)",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150BLBTCF",d:"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO COM BOTAO CF",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150BLTDCF",d:"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO  PARA SMART LOCK C/BOTAO TEDEE. CF",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150CFBTBL",d:"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO COM BOTAO BL",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESOCIL150CFTDBL",d:"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO  PARA SMART LOCK C/BOTAO TEDEE. BL",f:"KESO",p:0.0,u:"PC",cat:"CILINDRO"},
{c:"PA-KESODOB 30 BL",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE CURTA RETA ACAB.INOX PRETO - 1152/00 - 30 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 30 CR",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE CURTA RETA ACAB.INOX ESCOVADO - 1152/00 - 30 mm",f:"KESO",p:20.49,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 40 BL",d:"DOBRA CONTRA TESTA ROLETE PADRAO RETA ACAB.INOX PRETO - 1139/00 - 40 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 40 CR",d:"DOBRA CONTRA TESTA ROLETE PADRAO RETA ACAB.INOX ESCOVADO - 1139/00 - 40 mm",f:"KESO",p:22.86,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 50 BL",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO A ACAB.INOX PRETO - 1140/00 - 50 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 50 CR",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO A ACAB.INOX ESCOVADO - 1140/00 - 50 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 60 BL",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO B ACAB.INOX PRETO - 1141/00 - 60 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 60 CR",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO B ACAB.INOX ESCOVADO - 1141/00 - 60 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 70 BL",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO C ACAB.INOX PRETO - 1142/00 - 70 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 70 CR",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO C ACAB.INOX CROMADO",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 80 BL",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO D ACAB.INOX PRETO - 1143/00 - 80 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 80 CR",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO D ACAB.INOX ESCOVADO - 1143/00 - 80 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 90 BL",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO E ACAB.INOX PRETO - 1144/00 - 90 mm",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-KESODOB 90 CR",d:"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO E ACAB.INOX CROMADO",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-PILHATEDEEAAA",d:"PILHA AAA PARA TECLADO TEDEE",f:"DOORWIN",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-TEDEECABO",d:"CABO TIPO C TEDEE",f:"DOORWIN",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-DOBRAINV",d:"DOB.ENCAIXE RAPIDO 4 POLIDA - 01043100074 (DOBRADICA INVISIVEL)",f:"MAHLHER",p:0.0,u:"PC",cat:"DOBRADIÇA"},
{c:"PA-CHA AA PHS 4,2X13",d:"CHATA AA PHS 4,2 X 13 BROC. 410 - 7504P4.2X13410",f:"MERCADO",p:0.09,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-CHA AA PHS 4,2X19",d:"CHATA AA PHS 4,2 X 19 BROC. 410 - 7504P4.2X19410",f:"MERCADO",p:0.17,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-CHA AA PHS 4,2X38",d:"CHATA AA PHS 4,2 X 38 BROC. 410 - 7504P4.2X38410",f:"MERCADO",p:0.23,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-CHA AA PHS 4,8X50",d:"CHATA AA PHS 4,8 X 50 DIN 7982 A2 - 79824.8X50A2",f:"MERCADO",p:0.24,u:"PC",cat:"FIXAÇÃO"},
{c:"PA-PIVOT 350 KG",d:"PIVOT CONJUNTO - SUPERIOR / INFERIOR COM CAPACIDADE P/350KG INOX 304 (REFORCO NA SOLDA PADRAI PROJET",f:"NEOMEC",p:532.0,u:"PC",cat:"PIVÔ"},
{c:"PA-PIVOT 600 KG",d:"PIVOT CONJ SUP/INF - INOX - P/600KG - CONF. PROJETO",f:"NEOMEC",p:749.66,u:"PC",cat:"PIVÔ"},
{c:"PA-PIVOT 350KG JNF",d:"PIVOT HIDRAULICO PARA PORTA DE MADEIRA DE ATE 350KG",f:"JNF",p:7437.28,u:"PC",cat:"PIVÔ"},
{c:"PA-PIVOT 500KG JNF",d:"PIVOT HIDRAULICO PARA PORTA DE MADEIRA DE ATE 500KG",f:"JNF",p:15283.2,u:"PC",cat:"PIVÔ"},
{c:"PA-NUKI-BRI",d:"NUKI BRIDGE CONEXÃO WIRILLES DE SINAL WIFI COM FONTE DE ALIMENTAÇÃO",f:"NUKI",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-NUKI-FEC-BL",d:"COMBO NUKI SMARTLOCK BL",f:"NUKI",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-NUKI-FEC-BR",d:"COMBO NUKI SMARTLOCK BR",f:"NUKI",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-NUKI-TEC-BL",d:"NUKI KEYPAD-PRO TECLADO BL",f:"NUKI",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-NUKI-TEC-BR",d:"NUKI KEYPAD-PRO TECLADO BR",f:"NUKI",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-NUKIBATERIA",d:"BATERIA PARA NUKI",f:"NUKI",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-NUKISUPORTE",d:"SUPORTE PARA NUKI",f:"NUKI",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-CIL CVL55X75",d:"CILINDRO DESCENTRALIZADO 55X75",f:"CVL",p:250.0,u:"PC",cat:"CILINDRO"},
{c:"PA-CVL3PT",d:"FECHADURA 3 PONTOS TRAVAMENTO",f:"CVL",p:510.0,u:"PC",cat:"FECHADURA"},
{c:"PA-DIG SOLENOIDE",d:"FECHADURA SOLENOIDE FS 1011",f:"PORTTAL",p:0.0,u:"PC",cat:"FECHADURA DIGITAL"},
{c:"PA-VED0720",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 720 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:0.0,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED0820",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 820 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:308.41,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED0920",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 920 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:326.46,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1020",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1020 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:319.2,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1120",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1120 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:368.11,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1220",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1120 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:448.44,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1320",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1320 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:483.95,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1420",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1420 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:540.59,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1520",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1520 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:593.86,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1620",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1620 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:648.19,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1720",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1720 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:692.97,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1820",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1820 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:713.91,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED1920",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1920 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:699.3,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2020",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2020 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:826.04,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2120",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2120 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:869.46,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2220",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2220 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:940.3,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2320",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2320 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:988.74,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2420",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2420 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:973.52,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2520",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2520 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:1001.18,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2620",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2620 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:1059.36,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2720",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2720 MM - COM FURACAO",f:"PRIMA FERRAGENS",p:1076.51,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2820",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 2820 MM - 00.255.40-282",f:"PRIMA FERRAGENS",p:1115.45,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED2920",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 2920 MM - 00.255.40-292",f:"PRIMA FERRAGENS",p:1143.45,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED3020",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3020 MM - 00.255.40-302",f:"PRIMA FERRAGENS",p:1171.01,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED3120",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3120 MM - 00.255.40-312",f:"PRIMA FERRAGENS",p:1240.4,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED3220",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3220 MM - 00.255.40-322",f:"PRIMA FERRAGENS",p:1268.84,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED3320",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3320 MM - 00.255.40-332",f:"PRIMA FERRAGENS",p:1297.19,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED3420",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3420 MM - 00.255.40-342",f:"PRIMA FERRAGENS",p:1324.66,u:"PC",cat:"VEDA PORTA"},
{c:"PA-VED3520",d:"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3520 MM - 00.255.40-352",f:"PRIMA FERRAGENS",p:1390.64,u:"PC",cat:"VEDA PORTA"},
{c:"PA-FITDF 12X20X1.0",d:"FITA DFIX TRANSP 1,0MM X 12MM X 20M",f:"PROJETOAL",p:17.59,u:"PC",cat:"FITA"},
{c:"PA-FITDF 19X20X1.0",d:"FITA DFIX TRANSP 1,0MM X 19MM X 20M",f:"PROJETOAL",p:27.37,u:"PC",cat:"FITA"},
{c:"PA-FITDF 19X20X2.0",d:"FITA DFIX ACM BRANCA 2.0MM X 19 MM X 20 MTS",f:"PROJETOAL",p:117.24,u:"PC",cat:"FITA"},
{c:"PA-DOBINOX 3.5X3 ESC",d:"DOBRADICA VOLPER 3 1/2X3X2,5 SEM PINO INOX CRA - 2003/CA",f:"KESO",p:0.0,u:"UN",cat:"DOBRADIÇA"},
{c:"PA-DOBINOX 3.5X3 POL",d:"DOBRADICA VOLPER 3 1/2 x 3 x 2,5mm S PINO INOX P - 2003/CR",f:"KESO",p:0.0,u:"PC",cat:"DOBRADIÇA"},
{c:"PA-DOBINOX 3.5X3 PRE",d:"DOBRADICA VOLPER 3 1/2 x 3 x 2,5mm S PINO INOX P - 2003/PRE",f:"KESO",p:0.0,u:"PC",cat:"DOBRADIÇA"},
{c:"PA-DOBKESO 4X3X3 ESC",d:"DOBRADICA VOLPER 4X3X3 COM PINO INOX ACETINADO - 2005/CA",f:"KESO",p:0.0,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-DOBKESO 4X3X3 POL",d:"DOBRADICA VOLPER 4X3X3 COM PINO INOX POLIDO",f:"KESO",p:54.37,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-DOBKESO 4X3X3 PRE",d:"DOBRADICA VOLPER 4X3X3 COM PINO INOX PRETO",f:"KESO",p:54.37,u:"PC",cat:"ACESSÓRIO KESO"},
{c:"PA-FECHUNHA",d:"FECHO UNHA SQUARE 400MM INOX + GUARDA PO FECHO UNHA INOX",f:"UDINESE",p:78.63,u:"PC",cat:"OUTROS"},
{c:"PA-FITA VED 5X15",d:"Escovinha Veda Frestas Encaixe Comum 5x15mm Preta 45m Veda - MLB2963314656",f:"MERCADO",p:2.6,u:"PC",cat:"FITA"},
{c:"PA-FITA VED 5X20",d:"Escovinha Veda Frestas Porta Janela De Encaixe 5x20 Pt 50mt - MLB3779108168_178158049",f:"MERCADO",p:2.08,u:"MT",cat:"FITA"},
{c:"PA-LPT02012",d:"LIMITADOR P/TRILHO",f:"MERCADO",p:0.0,u:"PC",cat:"OUTROS"},
{c:"PA-RGU01042",d:"ROLETE GUIA PEQUENO CHAPA RETA 9 MM",f:"MERCADO",p:0.0,u:"PC",cat:"OUTROS"},
{c:"PA-RNB04031CHF02",d:"ROLDANA 4 RODAS BANDA COM ROLAMENTO 80 KG- CHAPA RETA",f:"MERCADO",p:0.0,u:"PC",cat:"OUTROS"},
{c:"PA-HIGHTACK BL",d:"FIX ALL HIGH TACK PRETO 290 ML",f:"SOLDAL",p:37.25,u:"PC",cat:"SELANTE"},
{c:"PA-HIGHTACK BR",d:"FIX ALL HIGH TACK BRANCO 290 ML - 2839",f:"SOLDAL",p:37.25,u:"PC",cat:"SELANTE"},
{c:"PA-HIGHTACK TURBO BR",d:"FIX ALL TURBO ES/PT BRANCO 290ML",f:"SOLDAL",p:39.56,u:"PC",cat:"SELANTE"},
{c:"PA-ESPUMA EXP GUN",d:"SOUDAFOAM GUN 750ML - ESPUMA DE POLIURETANO EXPANSIVA",f:"SOLDAL",p:26.88,u:"PC",cat:"SELANTE"},
{c:"PA-GUN ESPUMA EXP",d:"GUN E FOAM CLEANER 500ML/400G - ONU 1950 AEROSSOIS, 2.1",f:"SOLDAL",p:28.91,u:"PC",cat:"SELANTE"},
{c:"PA-ISOPOR 100",d:"EPS CANALETA U MOD 04 100X50",f:"STYRO",p:6.76,u:"MT",cat:"EPS"},
{c:"PA-ISOPOR 115",d:"EPS CANALETA U MOD 05 115X50 - P006",f:"STYRO",p:6.93,u:"MT",cat:"EPS"},
{c:"PA-ISOPOR 125",d:"EPS CANALETA U MOD 06 125X50",f:"STYRO",p:7.01,u:"MT",cat:"EMBALAGEM"},
{c:"PA-ISOPOR 135",d:"EPS CANALETA U MOD 07 135X50",f:"STYRO",p:0.0,u:"MT",cat:"EPS"},
{c:"PA-ISOPOR 165",d:"EPS CANALETA U MOD 08 165X50",f:"STYRO",p:0.0,u:"MT",cat:"EPS"},
{c:"PA-PRIMER",d:"PRIMER FITA DUPLA FACE VHB 940ML - 9820.822.005",f:"UNIFORT",p:135.74,u:"L",cat:"FITA"},
{c:"PA-ISOPOR FIT ACAB",d:"EPS CANALETA U F. MOD 03 2000X140 FITA DE ACABAMENTO",f:"STYRO",p:0.0,u:"MT",cat:"FITA"},
{c:"PA-ISOPOR PA006 ENC",d:"EPS CANALETA PA 006 2000X200X120MM - PA006 ENCAIXE",f:"STYRO",p:6.94,u:"MT",cat:"EPS"},
{c:"PA-ISOPOR PA007 ENC",d:"EPS CANALETA PA 007 2000X225X120MM - PA007 ENCAIXE",f:"STYRO",p:7.87,u:"MT",cat:"EPS"},
{c:"PA-LADEROCHA",d:"Lã de Rocha D32 placa 1200×600×50mm",f:"MERCADO",p:9.41,u:"M2",cat:"ISOLAMENTO"},
{c:"PA-ISOPOR PRANC 50",d:"EPS Placa I 2000×1000×50mm",f:"STYRO",p:9.01,u:"M2",cat:"EMBALAGEM"},
{c:"PA-ISOPOR PRANC 30",d:"EPS Placa I 2000×1000×30mm",f:"STYRO",p:4.4,u:"M2",cat:"EPS"},
{c:"PA-MS BRA",d:"MS POLIMERO 40 BRANCO 230ML/400G - 0892101161",f:"WURTH",p:27.2,u:"PC",cat:"SELANTE"},
{c:"PA-MS INC",d:"MS ULTRA CLEAR INCOLOR 280ML/285G - 0892412901",f:"WURTH",p:37.13,u:"PC",cat:"SELANTE"},
{c:"PA-MS PRE",d:"SELANTE MS ACM PRETO 230ML/400G - 0892110323",f:"WURTH",p:27.2,u:"PC",cat:"SELANTE"},
{c:"PA-GUA411",d:"BORRACHA GUA411 EPDM - 1053",f:"ZAKA",p:0.0,u:"MT",cat:"VEDAÇÃO"},
{c:"PA-GUA413",d:"BORRACHA GUA413 EPDM - 1052",f:"ZAKA",p:0.0,u:"MT",cat:"VEDAÇÃO"},
{c:"PA-GUA414",d:"BORRACHA GUA414 EPDM - 1051",f:"ZAKA",p:0.0,u:"PC",cat:"VEDAÇÃO"},
{c:"PA-CIL UDINE 130 BL",d:"CILINDRO EUROPEU 130MM (65X65) LATAO PTF **",f:"UDINESE",p:143.0,u:"PC",cat:"CILINDRO"},
{c:"PA-CIL UDINE 130 CR",d:"CILINDRO EUROPEU 130MM (65X65) LATAO CRF **",f:"UDINESE",p:143.0,u:"PC",cat:"CILINDRO"},
{c:"PA-CIL UDINE 150 BL",d:"CILINDRO EUROPEU 150MM (75X75) LATAO PTF **",f:"UDINESE",p:188.15,u:"PC",cat:"CILINDRO"},
{c:"PA-CIL UDINE 150 CR",d:"CILINDRO EUROPEU 150MM (75X75) LATAO CRF **",f:"UDINESE",p:188.15,u:"PC",cat:"CILINDRO"}
];

function renderCompDB(){
  var tb=$('comp-db-tbody');
  if(!tb) return;
  var filtro=($('comp-filtro')?$('comp-filtro').value:'').toUpperCase();
  var fCod  =(($('comp-f-cod') ?$('comp-f-cod').value  :'')||'').toUpperCase().trim();
  var fDesc =(($('comp-f-desc')?$('comp-f-desc').value :'')||'').toUpperCase().trim();
  var fForn =(($('comp-f-forn')?$('comp-f-forn').value :'')||'').toUpperCase().trim();
  var fCat  =(($('comp-f-cat') ?$('comp-f-cat').value  :'')||'').toUpperCase().trim();
  var rows='';
  var count=0;
  // Load saved prices
  var saved={};
  try{var s=localStorage.getItem('projetta_comp_precos');if(s)saved=JSON.parse(s);}catch(e){}
  COMP_DB.forEach(function(p,i){
    if(filtro && p.cat!==filtro) return;
    if(fCod  && (p.c||'').toUpperCase().indexOf(fCod)<0)  return;
    if(fDesc && (p.d||'').toUpperCase().indexOf(fDesc)<0) return;
    if(fForn && (p.f||'').toUpperCase().indexOf(fForn)<0) return;
    if(fCat  && (p.cat||'').toUpperCase().indexOf(fCat)<0) return;
    count++;
    var bg=count%2===0?'#fff':'#f9f8f5';
    var preco=saved[p.c]!==undefined?saved[p.c]:p.p;
    var catColor={'FECHADURA':'#1a3a4a','CILINDRO':'#5b4a8a','ACESSÓRIO KESO':'#666','PIVÔ':'#d35400','PUXADOR':'#2980b9','VEDAÇÃO':'#27ae60','SELANTE':'#8e44ad','FIXAÇÃO':'#95a5a6','DOBRADIÇA':'#c0392b','FITA':'#f39c12','EPS':'#1abc9c','OUTROS':'#999'};
    var cc=catColor[p.cat]||'#666';
    var isZero=(!preco||preco<=0);
    var bg=isZero?'#ffebee':count%2===0?'#fff':'#f9f8f5';
    var boldStyle=isZero?'font-weight:800;':'';
    rows+='<tr style="background:'+bg+(isZero?';border-left:3px solid #b71c1c':'')+'">'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;font-size:11px;font-weight:600">'+p.c+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;font-size:11px">'+p.d+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;font-size:11px;text-align:center">'+p.f+'</td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;font-size:11px;text-align:center;color:'+cc+';font-weight:600">'+p.cat+'</td>'
      +'<td style="padding:3px 5px;border-bottom:0.5px solid #eee;text-align:right">'
        +(isZero?'<span style="display:block;font-size:8px;color:#b71c1c;font-weight:700;margin-bottom:2px">⚠ SEM PREÇO</span>':'')
        +'<input type="number" value="'+(preco||0)+'" min="0" step="0.01" data-comp="'+p.c+'" onchange="saveCompPreco(this)" style="width:90px;padding:4px 6px;border:1px solid '+(isZero?'#ef9a9a':'#ddd')+';border-radius:4px;font-size:12px;font-weight:700;text-align:right;color:'+(isZero?'#b71c1c':'var(--navy)')+';background:'+(isZero?'#fff5f5':'#fff')+'"></td>'
      +'<td style="padding:5px 8px;border-bottom:0.5px solid #eee;font-size:11px;text-align:center">'+p.u+'</td>'
      +'<td style="padding:2px 2px;border-bottom:0.5px solid #eee;text-align:center"><button onclick="_deleteComp('+i+')" title="Excluir acessório" style="border:none;background:none;color:#ccc;font-size:13px;cursor:pointer;padding:0 2px;line-height:1" onmouseover="this.style.color=\'#b71c1c\'" onmouseout="this.style.color=\'#ccc\'">×</button></td>'
      +'</tr>';
  });
  tb.innerHTML=rows;
  var ct=$('comp-count');if(ct)ct.textContent=count+' itens';
}
function saveCompPreco(el){
  var code=el.getAttribute('data-comp');
  var val=parseFloat(el.value)||0;
  try{
    var saved={};
    var s=localStorage.getItem('projetta_comp_precos');if(s)saved=JSON.parse(s);
    saved[code]=val;
    localStorage.setItem('projetta_comp_precos',JSON.stringify(saved));
  }catch(e){}
}

/* ══ EXCLUIR PERFIL / ACESSÓRIO DO CADASTRO ═════════════════ */
function _deletePerfil(index){
  if(index<0||index>=PERFIS_DB.length) return;
  var item=PERFIS_DB[index];
  if(!confirm('Excluir perfil "'+item.c+'"?')) return;
  // Track deletion
  try{
    var del=JSON.parse(localStorage.getItem('projetta_deleted_perfis')||'[]');
    if(del.indexOf(item.c)<0) del.push(item.c);
    localStorage.setItem('projetta_deleted_perfis',JSON.stringify(del));
  }catch(e){}
  PERFIS_DB.splice(index,1);
  _saveCustomPerfis();
  renderPerfisDB();
  if(typeof _populateManualPerfilSelect==='function') _populateManualPerfilSelect();
}

function _deleteComp(index){
  if(index<0||index>=COMP_DB.length) return;
  var item=COMP_DB[index];
  if(!confirm('Excluir acessório "'+item.c+'"?')) return;
  // Track deletion
  try{
    var del=JSON.parse(localStorage.getItem('projetta_deleted_comps')||'[]');
    if(del.indexOf(item.c)<0) del.push(item.c);
    localStorage.setItem('projetta_deleted_comps',JSON.stringify(del));
  }catch(e){}
  COMP_DB.splice(index,1);
  _saveCustomComps();
  renderCompDB();
  if(typeof _populateManualAcessSelect==='function') _populateManualAcessSelect();
  try{
    var saved={};var s=localStorage.getItem('projetta_comp_precos');if(s)saved=JSON.parse(s);
    delete saved[item.c];
    localStorage.setItem('projetta_comp_precos',JSON.stringify(saved));
  }catch(e){}
}

/* ══ ADICIONAR NOVO PERFIL MANUALMENTE ══════════════════════ */
function _addNewPerfil(){
  var code = (document.getElementById('new-pf-code').value||'').trim();
  var desc = (document.getElementById('new-pf-desc').value||'').trim();
  var kg   = parseFloat(document.getElementById('new-pf-kg').value)||0;
  var forn = document.getElementById('new-pf-forn').value||'MERCADO';
  if(!code||!desc||kg<=0){ alert('Preencha código, descrição e kg/m.'); return; }
  // Check duplicate
  for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===code){alert('Código "'+code+'" já existe!');return;}}
  PERFIS_DB.push({c:code, d:desc, kg:kg, f:forn, l:'MERCADO', _custom:true});
  // Save custom perfis to localStorage
  _saveCustomPerfis();
  renderPerfisDB();
  // Clear form
  document.getElementById('new-pf-code').value='';
  document.getElementById('new-pf-desc').value='';
  document.getElementById('new-pf-kg').value='';
  alert('Perfil "'+code+'" adicionado com sucesso!');
}

function _saveCustomPerfis(){
  try{
    var custom=[];
    PERFIS_DB.forEach(function(p){if(p._custom) custom.push(p);});
    localStorage.setItem('projetta_custom_perfis',JSON.stringify(custom));
  }catch(e){}
}

function _loadCustomPerfis(){
  try{
    var s=localStorage.getItem('projetta_custom_perfis');
    if(!s) return;
    var custom=JSON.parse(s);
    custom.forEach(function(p){
      var exists=false;
      for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===p.c){exists=true;break;}}
      if(!exists){p._custom=true; PERFIS_DB.push(p);}
    });
  }catch(e){}
}

/* ══ ADICIONAR NOVO COMPONENTE/ACESSÓRIO MANUALMENTE ════════ */
function _addNewComp(){
  var code  = (document.getElementById('new-cp-code').value||'').trim();
  var desc  = (document.getElementById('new-cp-desc').value||'').trim();
  var forn  = (document.getElementById('new-cp-forn').value||'').trim()||'MERCADO';
  var cat   = document.getElementById('new-cp-cat').value||'OUTROS';
  var preco = parseFloat(document.getElementById('new-cp-preco').value)||0;
  var un    = document.getElementById('new-cp-un').value||'PC';
  if(!code||!desc){ alert('Preencha código e descrição.'); return; }
  // Check duplicate
  for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===code){alert('Código "'+code+'" já existe!');return;}}
  COMP_DB.push({c:code, d:desc, f:forn, p:preco, u:un, cat:cat, _custom:true});
  // Save custom comps to localStorage
  _saveCustomComps();
  // Save price
  try{
    var saved={};var s=localStorage.getItem('projetta_comp_precos');if(s)saved=JSON.parse(s);
    saved[code]=preco;localStorage.setItem('projetta_comp_precos',JSON.stringify(saved));
  }catch(e){}
  renderCompDB();
  if(typeof _populateManualAcessSelect==='function') _populateManualAcessSelect();
  // Clear form
  document.getElementById('new-cp-code').value='';
  document.getElementById('new-cp-desc').value='';
  document.getElementById('new-cp-preco').value='';
  alert('Acessório "'+code+'" adicionado com sucesso!');
}

function _saveCustomComps(){
  try{
    var custom=[];
    COMP_DB.forEach(function(p){if(p._custom) custom.push(p);});
    localStorage.setItem('projetta_custom_comps',JSON.stringify(custom));
  }catch(e){}
}

function _loadCustomComps(){
  try{
    var s=localStorage.getItem('projetta_custom_comps');
    if(!s) return;
    var custom=JSON.parse(s);
    custom.forEach(function(p){
      var exists=false;
      for(var i=0;i<COMP_DB.length;i++){if(COMP_DB[i].c===p.c){exists=true;break;}}
      if(!exists){p._custom=true; COMP_DB.push(p);}
    });
  }catch(e){}
}

function syncPerfisTab(){
  try{
    var L=parseFloat(document.getElementById('largura').value)||0;
    var A=parseFloat(document.getElementById('altura').value)||0;
    var F=document.getElementById('folhas-porta').value||'1';
    var pL=document.getElementById('pf-L');if(pL)pL.textContent=L>0?Math.round(L)+' mm':'—';
    var pA=document.getElementById('pf-A');if(pA)pA.textContent=A>0?Math.round(A)+' mm':'—';
    var pF=document.getElementById('pf-F');if(pF)pF.textContent=F+' folha'+(F==='2'?'s':'');
    var mEl=document.getElementById('plan-modelo');
    var mTxt=mEl&&mEl.selectedIndex>=0?mEl.options[mEl.selectedIndex].text:'—';
    var pM=document.getElementById('pf-M');if(pM)pM.textContent=mTxt;
  }catch(e){}
}

/* ══ CALCULAR PERFIS E ACESSORIOS ═══════════════════════ */
// ── BIN PACKING 1D (First Fit Decreasing) ──────────────────────────────────
function binPackFFD(cuts,barLen,kerf){
  kerf=kerf||9; // 9mm por corte (serra dupla 4mm + tolerância — padrão CEM)
  var all=cuts.slice().sort(function(a,b){return b-a;});
  var bars=[];
  all.forEach(function(c){
    var need=c+kerf;
    if(need>barLen){bars.push({items:[c],remaining:barLen-need,special:true,barLen:barLen,sobra:barLen-need});return;}
    for(var i=0;i<bars.length;i++){
      if(!bars[i].special&&bars[i].remaining>=need){
        bars[i].items.push(c);bars[i].remaining-=need;bars[i].sobra=bars[i].remaining;return;
      }
    }
    bars.push({items:[c],remaining:barLen-need,special:false,barLen:barLen,sobra:barLen-need});
  });
  return bars;
}

// ── LEVANTAMENTO DE PERFIS (CEM-BASED) ─────────────────────────────────────
function calcPerfis(){
  var L=parseFloat(document.getElementById('largura').value)||0;
  var H=parseFloat(document.getElementById('altura').value)||0;
  if(L<=0||H<=0){alert('Preencha Largura e Altura no Orçamento primeiro.');return;}
  var nFolhas=parseInt(document.getElementById('folhas-porta').value)||1;
  var barraMM=(parseFloat(document.getElementById('pf-barra-m').value)||6)*1000;
  var kgTecnoBru=parseFloat(document.getElementById('pf-kg-tecnoperfil').value)||31;
  var kgMercBru=parseFloat(document.getElementById('pf-kg-mercado').value)||38;
  var kgWeikuBru=parseFloat(document.getElementById('pf-kg-weiku').value)||35;
  var precoPintBru=parseFloat(document.getElementById('pf-preco-pintura').value)||5.7;
  var dedTecno=parseFloat((document.getElementById('pf-ded-tecnoperfil')||{value:0}).value)||0;
  var dedMerc=parseFloat((document.getElementById('pf-ded-mercado')||{value:0}).value)||0;
  var dedWeiku=parseFloat((document.getElementById('pf-ded-weiku')||{value:0}).value)||0;
  var dedPint=parseFloat((document.getElementById('pf-ded-pintura')||{value:0}).value)||0;
  var kgTecno=kgTecnoBru*(1-dedTecno/100);
  var kgMerc=kgMercBru*(1-dedMerc/100);
  var kgWeiku=kgWeikuBru*(1-dedWeiku/100);
  var precoPint=precoPintBru*(1-dedPint/100);

  var TUB=(typeof _isInternacional==='function'&&_isInternacional())?50.8:(H>=4000?50.8:38.1);
  var sis=TUB===50.8?'PA007':'PA006';

  // ── Parâmetros (planilha FORMULAS_PARA_PERFIS) ─────────────────────────
  var FGA=10,FGL=10,FGR=10,PIV=28,TRANS=8,VED=35,ESPACM=4;
  var TUBO_LAR=(sis==='PA007')?101.8:76.2;
  var N_H=Math.floor(H/1000);
  var _cavLargEl=document.getElementById('carac-largura-cava');
  var LARGURA_CAVA=_cavLargEl?(parseFloat(_cavLargEl.value)||150):150;
  var TRAVAMENTO_CAVA=LARGURA_CAVA+100;
  var C=CONJUNTOS_PERFIS[sis]; // conjunto do sistema corrente

  function selBar(c){return c<=6000?6000:c<=7000?7000:8000;}
  var PINTADOS=['PA-PA006F','PA-PA006P','PA-PA006V','PA-PA007F','PA-PA007P','PA-PA007V','PA-CANT-30X30X2.0'];
  function isPintado(cod){return PINTADOS.some(function(p){return cod.indexOf(p)===0;});}

  // PA ALTURA: H - folga - tuboPortal - pivô + transpasse
  var PA_F=Math.round(H-FGA-TUB-PIV+TRANS);

  var TRAV_V=Math.round(H-FGA-TUB-PIV-2*VED-2*TUBO_LAR);
  var TUB_CA=Math.round(TRAV_V-20);
  var CANT_CA=TRAV_V;

  // LAR INF & SUP:
  // 1 folha: LARGURA - FGLD - FGLE - 171.7 - 171.5
  // 2 folhas: (LARGURA - FGLD - FGLE - 171.7 - 171.5 - 235) / 2
  var LAR_IS = nFolhas === 2
    ? Math.round((L - FGL - FGR - 171.7 - 171.5 - 235) / 2)
    : Math.round(L - FGL - FGR - 171.7 - 171.5);

  var VED_IS=Math.round(LAR_IS+110+110);
  var CAN_E=Math.round(VED_IS+10);
  var TRA_HM=LAR_IS;
  var FRISO_H=LAR_IS;
  var PA_P=Math.round(H-FGA-TUB-ESPACM);
  var LAR_PO=Math.round(L-FGL-FGR);
  var TRA_PO=Math.round(L-FGL-FGR-46.5-46.5);

  if(PA_F<=0||TRAV_V<=0||LAR_IS<=0||TRA_HM<=0){
    alert('Dimensões inválidas para '+sis+'. Verifique L e H.');return;
  }

  // Qty travessas verticais (mesma lógica do _calcularDadosPerfis)
  var _selEl=document.getElementById('carac-modelo');
  var modeloSel=_selEl?(_selEl.value||''):'';
  var _modeloNome=_selEl&&_selEl.selectedIndex>=0?(_selEl.options[_selEl.selectedIndex].text||'').toLowerCase():'';
  var temCava=_modeloNome.indexOf('cava')>=0;
  var _travBase=L>3000?3:L>2200?2:1;
  var _distBorda=parseFloat((document.getElementById('carac-dist-borda-cava')||{value:210}).value)||210;
  var _cavaTravAdd=temCava?(_distBorda<=158?1:2):0;
  var TRAV_V_QTY=(_travBase+_cavaTravAdd)*nFolhas;

  // Qty frisos
  var QTY_FRISO_VERT=parseInt((document.getElementById('carac-friso-vert')||{value:0}).value)||0;
  var QTY_FRISO_HORIZ=parseInt((document.getElementById('carac-friso-horiz')||{value:0}).value)||0;
  if((modeloSel==='06'||modeloSel==='16')&&QTY_FRISO_HORIZ<=0)
    QTY_FRISO_HORIZ=parseInt((document.getElementById('plan-friso-h-qty')||{value:3}).value)||3;

  // Qty travessas horizontais
  var _isFrisoHMod=(modeloSel==='06'||modeloSel==='16');
  var TRA_HOR_QTY=(_isFrisoHMod?0:N_H)*nFolhas;

  var paFBarLen=selBar(PA_F);
  var paPBarLen=selBar(PA_P);
  var _modCEM=modeloSel;

  var cuts=[
    // FOLHA — perfis especiais
    {code:C.pa_altura+'-'+paFBarLen/1000+'M',desc:'PA ALTURA',compMM:PA_F,qty:2*nFolhas,obs:'BNF-TECNO',pintado:true,secao:'FOLHA',barLenMM:paFBarLen},
    // FOLHA — travessas verticais
    {code:_modCEM==='22'?C.lar_inf_sup:C.trav_vert,desc:_modCEM==='22'?'TRAV VERT 101':'TRAV VERT',compMM:TRAV_V,qty:TRAV_V_QTY,obs:'BRUTO',pintado:false,secao:'FOLHA',barLenMM:barraMM},
    {code:C.tub_cava,desc:'TUB CAVA',compMM:TUB_CA,qty:(temCava&&_modCEM!=='22')?2*nFolhas:0,obs:'BRUTO',pintado:false,secao:'FOLHA',barLenMM:barraMM},
    {code:C.cant_cava,desc:'CANT CAVA',compMM:CANT_CA,qty:(temCava&&_modCEM!=='22')?4*nFolhas:0,obs:'BNF-TECNO',pintado:true,secao:'FOLHA',barLenMM:barraMM},
    // FOLHA — horizontais
    {code:C.lar_inf_sup,desc:'LAR INF & SUP',compMM:LAR_IS,qty:2*nFolhas,obs:'BRUTO',pintado:false,secao:'FOLHA',barLenMM:barraMM},
    {code:C.ved_inf_sup,desc:'VED INF & SUP',compMM:VED_IS,qty:2*nFolhas,obs:'BNF-TECNO',pintado:true,secao:'FOLHA',barLenMM:barraMM},
    {code:C.canal_esc,desc:'CANAL ESC',compMM:CAN_E,qty:2*nFolhas,obs:'BRUTO',pintado:false,secao:'FOLHA',barLenMM:barraMM},
    {code:C.tra_hor,desc:'TRAVESSA HORIZONTAL',compMM:TRA_HM,qty:TRA_HOR_QTY,obs:'BRUTO',pintado:false,secao:'FOLHA',barLenMM:barraMM},
    {code:C.travamento,desc:'TRAVAMENTO CAVA',compMM:TRAVAMENTO_CAVA,qty:(temCava&&sis==='PA007')?N_H*nFolhas:0,obs:'BRUTO',pintado:false,secao:'FOLHA',barLenMM:barraMM},
    // FOLHA — frisos
    {code:C.friso_vert,desc:'FRISO VERT',compMM:TRAV_V,qty:QTY_FRISO_VERT,obs:'BRUTO',pintado:false,secao:'FOLHA',barLenMM:barraMM},
    {code:C.friso_horiz,desc:'FRISO HORIZ',compMM:FRISO_H,qty:QTY_FRISO_HORIZ,obs:'BRUTO',pintado:false,secao:'FOLHA',barLenMM:barraMM},
    // PORTAL (não multiplica por nFolhas — portal é único)
    {code:C.lar_portal,desc:'LAR PORTAL',compMM:LAR_PO,qty:1,obs:'BRUTO',pintado:false,secao:'PORTAL',barLenMM:barraMM},
    {code:C.alt_portal+'-'+paPBarLen/1000+'M',desc:'ALT PORTAL',compMM:PA_P,qty:2,obs:'BNF-TECNO',pintado:true,secao:'PORTAL',barLenMM:paPBarLen},
    {code:C.tra_portal,desc:'TRA PORTAL',compMM:TRA_PO,qty:3,obs:'BRUTO',pintado:false,secao:'PORTAL',barLenMM:barraMM},
  ];

  // ── PERFIS_DB lookup ────────────────────────────────────────────────────
  function getPerf(code){
    for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===code)return PERFIS_DB[i];}
    var base=code.replace(/-[678]M$/,'');
    for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===base||PERFIS_DB[i].c.indexOf(base)===0)return PERFIS_DB[i];}
    return null;
  }
  function getPrecoKg(p){
    if(!p)return kgMerc;
    var f=p.f||'';
    if(f==='TECNOPERFIL'||f==='PROJETTA')return kgTecno;
    if(f==='WEIKU')return kgWeiku;
    if(f==='PERFISUD')return kgTecno;
    return kgMerc;
  }

  // ── Multiplicar cortes por qtd portas ANTES da otimização de barras ──
  var _qPLev=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
  if(_qPLev>1){
    cuts.forEach(function(c){ c.qty=c.qty*_qPLev; });
  }

  // ── Group cuts by code for bin packing ──────────────────────────────────
  var groups={};
  var seenKeys=[];
  cuts.forEach(function(c){
    var key=c.code;
    if(!groups[key]){
      var perf=getPerf(key);
      groups[key]={code:key,allCuts:[],pintado:c.pintado,barLenMM:c.barLenMM,perf:perf};
      seenKeys.push(key);
    }
    for(var i=0;i<c.qty;i++)groups[key].allCuts.push(c.compMM);
  });

  // ── Bin pack & calculate costs per group ───────────────────────────────
  var groupRes={};
  seenKeys.forEach(function(key){
    var g=groups[key];
    var bars=binPackFFD(g.allCuts,g.barLenMM);
    var nBars=bars.length;
    var totUsed=g.allCuts.reduce(function(s,x){return s+x;},0);
    var totBruto=bars.reduce(function(s,b){return s+b.barLen;},0);
    var aprov=totBruto>0?totUsed/totBruto*100:0;
    var kgM=g.perf?g.perf.kg:0;
    var kgLiq=totUsed/1000*kgM;
    var kgBruto=totBruto/1000*kgM;
    var precoKg=getPrecoKg(g.perf);
    var custoPerfil=kgBruto*precoKg;
    var custoPintura=g.pintado?kgBruto*precoPint:0;
    var custoTotal=custoPerfil+custoPintura;
    groupRes[key]={nBars:nBars,totUsed:totUsed,totBruto:totBruto,aprov:aprov,kgLiq:kgLiq,kgBruto:kgBruto,precoKg:precoKg,custoPerfil:custoPerfil,custoPintura:custoPintura,custoTotal:custoTotal,barLenMM:g.barLenMM,pintado:g.pintado};
  });

  // ── Render cut list ─────────────────────────────────────────────────────
  var tbody=document.getElementById('pf-lev-tbody');
  tbody.innerHTML='';
  var pos=1,curSec='';
  cuts.forEach(function(c){
    var perf=getPerf(c.code);
    var kgM=perf?perf.kg:0;
    var kgLiq=c.compMM/1000*kgM*c.qty;
    var ip=isPintado(c.code);
    if(c.secao!==curSec){
      curSec=c.secao;
      tbody.innerHTML+='<tr style="background:#e8eff4"><td colspan="8" style="padding:4px 8px;font-size:10px;font-weight:700;color:#1a3a4a;letter-spacing:.05em">— '+c.secao+' —</td></tr>';
    }
    var bg=ip?'#fef9f0':pos%2===0?'#fff':'#f9f8f5';
    var bl=ip?'border-left:3px solid #8e44ad;':'';
    var lh=c.secao==='FOLHA'?'90/90 A':'90/90 L';
    tbody.innerHTML+='<tr style="background:'+bg+';'+bl+'">'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;font-size:10px;color:#999">'+pos+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;font-weight:700;font-size:10px;white-space:nowrap;color:'+(ip?'#8e44ad':'var(--navy)')+'">'+c.code+(ip?' 🎨':'')+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;font-size:10px">'+c.desc+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:center;font-size:9px;color:#888">'+lh+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-weight:700;font-size:10px">'+c.compMM+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-size:10px">'+c.qty+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-size:10px;color:#888">'+kgM.toFixed(3).replace('.',',')+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-weight:700;font-size:10px;color:var(--navy)">'+kgLiq.toFixed(3).replace('.',',')+'</td>'
      +'</tr>';
    pos++;
  });

  // ── Render bars table ───────────────────────────────────────────────────
  var barsTbody=document.getElementById('pf-bars-tbody');
  barsTbody.innerHTML='';
  var totKgLiq=0,totKgBruto=0,totCusto=0;
  seenKeys.forEach(function(key){
    var r=groupRes[key];if(!r)return;
    var ip=r.pintado;
    totKgLiq+=r.kgLiq;totKgBruto+=r.kgBruto;totCusto+=r.custoTotal;
    var aprovStr=r.aprov>0?r.aprov.toFixed(1).replace('.',',')+'%':'—';
    barsTbody.innerHTML+='<tr style="background:'+(ip?'#fef9f0':'#fff')+(ip?';border-left:3px solid #8e44ad':'')+'">'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;font-weight:700;font-size:10px;white-space:nowrap;color:'+(ip?'#8e44ad':'var(--navy)')+'">'+key+(ip?' 🎨':'')+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-size:10px">'+(r.barLenMM/1000).toFixed(0)+'m</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-weight:700;font-size:11px;color:var(--orange)">'+r.nBars+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-size:10px">'+aprovStr+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-size:10px">'+r.kgLiq.toFixed(3).replace('.',',')+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-weight:600;font-size:10px">'+r.kgBruto.toFixed(3).replace('.',',')+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-size:10px;color:#666">R$ '+r.precoKg.toFixed(0)+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-size:10px;color:'+(ip?'#8e44ad':'#bbb')+'">'+(ip?'R$ '+r.custoPintura.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—')+'</td>'
      +'<td style="padding:4px 7px;border-bottom:0.5px solid #eee;text-align:right;font-weight:700;font-size:11px;color:var(--navy)">R$ '+r.custoTotal.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'</tr>';
  });

  var tfoot=document.getElementById('pf-bars-tfoot');
  tfoot.innerHTML='<tr style="background:#1a3a4a;color:#fff">'
    +'<td colspan="4" style="padding:6px 8px;font-weight:700;font-size:11px">TOTAL GERAL</td>'
    +'<td style="padding:6px 8px;text-align:right;font-size:11px">'+totKgLiq.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
    +'<td style="padding:6px 8px;text-align:right;font-size:11px">'+totKgBruto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
    +'<td colspan="2" style="padding:6px 8px;text-align:right;font-size:10px;opacity:.8">pintura incl.</td>'
    +'<td style="padding:6px 8px;text-align:right;font-weight:700;font-size:14px">R$ '+totCusto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
    +'</tr>';

  // ── Sistema info ────────────────────────────────────────────────────────
  document.getElementById('pf-sistema-info').innerHTML=
    'Sistema: <b>'+sis+'</b>'
    +' &nbsp;│&nbsp; Vão: <b>'+L+' × '+H+' mm</b>'
    +' &nbsp;│&nbsp; Folhas: <b>'+nFolhas+'</b>'
    +' &nbsp;│&nbsp; Barra padrão: <b>'+(barraMM/1000)+'m</b>'
    +' &nbsp;│&nbsp; Trav. Horiz.: <b>'+N_H+'</b>'
    +' &nbsp;│&nbsp; Porta: <b>'+(H-81)+' × '+(L-363)+' mm</b>';

  // ── Cost cards ──────────────────────────────────────────────────────────
  document.getElementById('pf-cost-summary').innerHTML=
    '<div style="flex:1;min-width:110px;border:1px solid #dde;border-radius:6px;padding:8px 10px;text-align:center">'
      +'<div style="font-size:9px;color:#888;font-weight:700;margin-bottom:2px">KG LÍQUIDO</div>'
      +'<div style="font-size:14px;font-weight:700;color:var(--navy)">'+totKgLiq.toFixed(1).replace('.',',')+'</div>'
      +'<div style="font-size:9px;color:#999">peso real das peças</div></div>'
    +'<div style="flex:1;min-width:110px;border:1px solid #dde;border-radius:6px;padding:8px 10px;text-align:center">'
      +'<div style="font-size:9px;color:#888;font-weight:700;margin-bottom:2px">KG BRUTO</div>'
      +'<div style="font-size:14px;font-weight:700;color:#666">'+totKgBruto.toFixed(1).replace('.',',')+'</div>'
      +'<div style="font-size:9px;color:#999">barras inteiras compradas</div></div>'
    +'<div style="flex:2;min-width:160px;border:2px solid #e67e22;border-radius:6px;padding:8px 10px;text-align:center;background:#fff8f0">'
      +'<div style="font-size:9px;color:#e67e22;font-weight:700;margin-bottom:2px">CUSTO TOTAL PERFIS</div>'
      +'<div style="font-size:16px;font-weight:700;color:#1a3a4a">R$ '+totCusto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'
      +'<div style="font-size:9px;color:#999">material + pintura (bruto)</div></div>';

  window._lastPerfisTotal=totCusto;
  document.getElementById('pf-empty-card').style.display='none';
  document.getElementById('pf-result-card').style.display='';
  switchTab('perfis');
}

// ── SINCRONIZA TOTAL DOS PERFIS NO PAINEL ────────────────────────────────────
function syncFabPerfisTotal(){
  var mat=parseFloat((document.getElementById('fab-mat-perfis').value||'0').replace(/\./g,'').replace(',','.'))||0;
  var pin=parseFloat((document.getElementById('fab-custo-pintura').value||'0').replace(/\./g,'').replace(',','.'))||0;
  var ac =parseFloat((document.getElementById('fab-custo-acess').value||'0').replace(/\./g,'').replace(',','.'))||0;
  var tot=mat+pin+ac;
  var el=document.getElementById('fab-total-perfis');
  if(el) el.textContent='R$ '+tot.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  var ph=document.getElementById('perfis');
  if(ph){ph.value=tot;}
}

// ── SISTEMA DE ALERTA: VALOR MANUAL vs SISTEMA ─────────────────────────────
// Armazena valores calculados pelo sistema
window._fabSysValues = {mat:0, pin:0, acess:0};
window._fabManual    = {mat:false, pin:false, acess:false};

var _fabFieldMap = {
  mat:   {input:'fab-mat-perfis',   alert:'fab-mat-alert',   sysval:'fab-mat-sysval'},
  pin:   {input:'fab-custo-pintura',alert:'fab-pin-alert',   sysval:'fab-pin-sysval'},
  acess: {input:'fab-custo-acess',  alert:'fab-acess-alert', sysval:'fab-acess-sysval'}
};

// Chamado pelo SISTEMA quando o levantamento calcula um valor
function _fabSetSysValue(field, value){
  var v = Math.round(value);
  window._fabSysValues[field] = v;
  var m = _fabFieldMap[field];
  if(!m) return;
  var sysEl = document.getElementById(m.sysval);
  if(sysEl) sysEl.textContent = 'R$ ' + v.toLocaleString('pt-BR');
  if(!window._fabManual[field]){
    var inp = document.getElementById(m.input);
    if(inp) inp.value = v.toLocaleString('pt-BR');
    var alertEl = document.getElementById(m.alert);
    if(alertEl) alertEl.style.display = 'none';
  } else {
    _fabCheckAlert(field);
  }
}

// Chamado pelo USUÁRIO ao digitar no campo (oninput)
function _onFabFieldManual(field){
  var m = _fabFieldMap[field];
  if(!m) return;
  var inp = document.getElementById(m.input);
  var userVal = parseInt((inp.value||'0').replace(/\./g,'').replace(',','.'))||0;
  var sysVal  = window._fabSysValues[field]||0;
  // Marcar como manual se diferente do sistema
  if(userVal !== sysVal && sysVal > 0){
    window._fabManual[field] = true;
    inp.style.background = '#fff8e1';
    inp.style.borderColor = '#ffb300';
  } else {
    window._fabManual[field] = false;
    _fabRestoreInputStyle(field);
  }
  _fabCheckAlert(field);
  syncFabPerfisTotal();
  calc();
}

// Verifica e mostra/esconde o alerta
function _fabCheckAlert(field){
  var m = _fabFieldMap[field];
  if(!m) return;
  var alertEl = document.getElementById(m.alert);
  if(!alertEl) return;
  var sysVal = window._fabSysValues[field]||0;
  if(window._fabManual[field] && sysVal > 0){
    alertEl.style.display = 'flex';
    var sysEl = document.getElementById(m.sysval);
    if(sysEl) sysEl.textContent = 'R$ ' + sysVal;
  } else {
    alertEl.style.display = 'none';
  }
}

// Restaurar valor do sistema
function _fabRestore(field){
  var m = _fabFieldMap[field];
  if(!m) return;
  window._fabManual[field] = false;
  var inp = document.getElementById(m.input);
  if(inp) inp.value = (window._fabSysValues[field]||0).toLocaleString('pt-BR');
  _fabRestoreInputStyle(field);
  var alertEl = document.getElementById(m.alert);
  if(alertEl) alertEl.style.display = 'none';
  syncFabPerfisTotal();
  calc();
}

function _fabRestoreInputStyle(field){
  // Estilo padrão — sem cor de fundo
  var inp = document.getElementById((_fabFieldMap&&_fabFieldMap[field])?_fabFieldMap[field].input:'');
  if(inp){ inp.style.background = ''; inp.style.borderColor = ''; }
}

// ── RECALCULA CUSTOS DOS PERFIS AUTOMATICAMENTE ───────────────────────────────
// Chamado quando: preços mudam na aba Perfis, ou ao gerar OS
function recalcPerfisAuto(){
  var L=parseFloat((document.getElementById('largura')||{value:0}).value)||0;
  var H=parseFloat((document.getElementById('altura')||{value:0}).value)||0;
  if(L<=0||H<=0) return; // sem dimensões, não recalcula
  var barraMM=(parseFloat((document.getElementById('pf-barra-m')||{value:6}).value)||6)*1000;
  var nFolhas=parseInt((document.getElementById('folhas-porta')||{value:1}).value)||1;
  // 2 folhas: suportado (quantidades × 2, larguras provisórias)

  try {
    var d=_calcularDadosPerfis(L,H,nFolhas,barraMM);
    if(d.error) return;

    // Extrair custo material e custo pintura separados
    var totalMat=0, totalPin=0;
    d.seenKeys.forEach(function(key){
      var r=d.groupRes[key];if(!r)return;
      totalMat+=r.custoPerfil||0;
      totalPin+=r.custoPintura||0;
    });

    // Atualizar campos de fabricação via sistema (não direto, para não disparar flag manual)
    _fabSetSysValue('mat', totalMat);
    _fabSetSysValue('pin', totalPin);

    // Guardar dados para o OS drawer
    window._lastPadroesHTML = _renderPadroesContent(d,9);
    window._lastPerfisTotal = totalMat+totalPin;

    syncFabPerfisTotal();
    calc();

    // Atualizar botão de aproveitamento se visível
    var btnAprov=document.getElementById('btn-aproveitamento');
    if(btnAprov) btnAprov.style.display='';

    // Regenerar OS automaticamente se já havia sido gerada
    _osAutoGenerate();
  } catch(e){ console.warn('recalcPerfisAuto:', e); }
}

function applyPerfisToOrc(){
  var val=window._lastPerfisTotal||0;
  if(!val){alert('Calcule os perfis primeiro.');return;}
  var el=document.getElementById('perfis');
  if(el){el.value=Math.round(val);if(typeof calc==='function')calc();}
  switchTab('orcamento');
}



/* ══ ATUALIZAR PRECOS DE CHAPAS ACM ═════════════════════ */
/* Variáveis de preço removidas — chapas usam valor líquido direto */

/* ══ ADICIONAR NOVA CHAPA MANUALMENTE ═══════════════════════ */
function _addNewChapa(){
  var nome  = (document.getElementById('new-chapa-nome').value||'').trim();
  var tipo  = document.getElementById('new-chapa-tipo').value||'ACM';
  var preco = parseFloat(document.getElementById('new-chapa-preco').value)||0;
  if(!nome){ alert('Informe o nome/código da cor.'); return; }
  if(preco<=0){ alert('Informe o preço líquido da chapa 1.5×5.0.'); return; }
  var baseArea = 7.5; // 1.5 × 5.0
  var data = tipo==='ACM' ? ACM_DATA : ALU_DATA;
  // Create options for all standard sizes
  var sizes = tipo==='ACM'
    ? [{n:'5000',a:7.5},{n:'6000',a:9.0},{n:'7000',a:10.5},{n:'8000',a:12.0}]
    : [{n:'3000',a:4.5},{n:'5000',a:7.5},{n:'6000',a:9.0},{n:'6600',a:9.9}];
  var opts = [];
  sizes.forEach(function(s){
    var p = Math.round(preco * (s.a / baseArea) * 100) / 100;
    opts.push({l:nome+' · 1500×'+s.n, p:p, a:s.a});
  });
  // Check duplicate
  for(var i=0;i<data.length;i++){
    if(data[i].g && data[i].g.indexOf(nome)>=0){ alert('Chapa "'+nome+'" já existe!'); return; }
  }
  data.push({g:'MANUAL — '+nome, seco:0, o:opts, _custom:true});
  // Save custom chapas
  _saveCustomChapas();
  // Refresh
  renderPrecosACM();
  _refreshChapaSelects();
  // Clear form
  document.getElementById('new-chapa-nome').value='';
  document.getElementById('new-chapa-preco').value='';
  alert('Chapa "'+nome+'" adicionada com sucesso!');
}
function _saveCustomChapas(){
  try{
    var customACM=[],customALU=[];
    ACM_DATA.forEach(function(g){if(g._custom)customACM.push(g);});
    ALU_DATA.forEach(function(g){if(g._custom)customALU.push(g);});
    localStorage.setItem('projetta_custom_chapas',JSON.stringify({acm:customACM,alu:customALU}));
  }catch(e){}
}
function _loadCustomChapas(){
  try{
    var s=localStorage.getItem('projetta_custom_chapas');if(!s)return;
    var d=JSON.parse(s);
    if(d.acm) d.acm.forEach(function(g){g._custom=true;ACM_DATA.push(g);});
    if(d.alu) d.alu.forEach(function(g){g._custom=true;ALU_DATA.push(g);});
  }catch(e){}
}
function _refreshChapaSelects(){
  try{
    var ACM_OPTS_NEW=mkOpts(ACM_DATA);
    var ALU_OPTS_NEW=mkOpts(ALU_DATA);
    for(var i=1;i<=20;i++){
      var s1=document.getElementById('acm-sel-'+i);if(s1){var v1=s1.value;s1.innerHTML=ACM_OPTS_NEW;s1.value=v1;}
      var s2=document.getElementById('alu-sel-'+i);if(s2){var v2=s2.value;s2.innerHTML=ALU_OPTS_NEW;s2.value=v2;}
    }
  }catch(e){}
}

function _deleteChapa(secIdx, grpIdx){
  var data = secIdx===0 ? ACM_DATA : ALU_DATA;
  if(grpIdx<0||grpIdx>=data.length) return;
  var grp = data[grpIdx];
  if(!confirm('Excluir grupo "'+grp.g+'" e todas as suas cores?')) return;
  data.splice(grpIdx, 1);
  _saveCustomChapas();
  // Track deletion
  try{
    var del=JSON.parse(localStorage.getItem('projetta_deleted_chapas')||'[]');
    del.push(grp.g);
    localStorage.setItem('projetta_deleted_chapas',JSON.stringify(del));
  }catch(e){}
  renderPrecosACM();
  _refreshChapaSelects();
}

/* ══ SINCRONIZAR CHAPAS DO PLANIFICADOR → ORÇAMENTO ═══════════ */
function _populatePlanChapaSelects(){
  // Delega para filtrarChapasACM que filtra por tamanho de chapa selecionado
  if(typeof filtrarChapasACM==='function') filtrarChapasACM();
}

function _syncCorToChapa(){
  var el=document.getElementById('carac-cor-ext');
  if(!el||!el.value) return;
  var corName=el.value.trim().toUpperCase();
  // Ensure ACM options are filtered for current sheet size
  if(typeof filtrarChapasACM==='function') filtrarChapasACM();
  var planAcm=document.getElementById('plan-acm-cor');
  if(!planAcm) return;
  var found=false;
  for(var i=0;i<planAcm.options.length;i++){
    var optTxt=(planAcm.options[i].text||'').toUpperCase();
    // Match by full color name (before the · separator)
    var optName=optTxt.split('·')[0].trim();
    if(optName===corName || optTxt.indexOf(corName)>=0){
      planAcm.selectedIndex=i;
      found=true;
      console.log('[SyncCor] Auto-selected ACM: '+planAcm.options[i].text);
      break;
    }
  }
  if(!found) console.log('[SyncCor] Cor "'+corName+'" não encontrada em '+planAcm.options.length+' opções');
  _syncChapaToOrc();
}

function _syncOrcAcmQty(){
  // Somar qtd de todas as chapas ACM do orçamento e sincronizar com plan-acm-qty
  var total=0;
  for(var i=1;i<=aC;i++){var el=document.getElementById('acm-qty-'+i);if(el)total+=parseInt(el.value)||0;}
  var pq=document.getElementById('plan-acm-qty');if(pq)pq.value=total;
  _syncChapasToCorte();
}
function _syncChapasToCorte(){
  var nChapas=parseInt((document.getElementById('plan-acm-qty')||{value:0}).value)||0;
  var _mSel=document.getElementById('carac-modelo')||document.getElementById('plan-modelo');
  var _mVal=_mSel?_mSel.value:'';
  var _isRip=['08','15','20','21'].indexOf(_mVal)>=0;
  var corteAuto=nChapas>0?(_isRip?nChapas+2:nChapas+1):0;
  var hCorteEl=document.getElementById('h-corte');
  if(hCorteEl && corteAuto>0 && hCorteEl.dataset.manual!=='1'){
    hCorteEl.value=corteAuto;
    hCorteEl.dataset.auto='1';
    var lbl=document.getElementById('h-corte-auto');
    if(lbl) lbl.textContent='(auto: '+nChapas+' chapas '+(_isRip?'+2 ripado':'+1')+' = '+corteAuto+'h)';
  }
  calc();
}

function _syncChapaToOrc(){
  var acmSel=document.getElementById('plan-acm-cor');
  // Auto-switch chapa para 1250mm quando Alusense selecionado
  if(acmSel&&acmSel.selectedIndex>0){
    var _acmTxt=(acmSel.options[acmSel.selectedIndex].text||'').toUpperCase();
    var _isAS=_acmTxt.indexOf('AS')===0||_acmTxt.indexOf('ALUSENSE')>=0;
    var chapaSel=document.getElementById('plan-chapa');
    if(chapaSel&&chapaSel.value!=='custom'){
      var parts=chapaSel.value.split('|');
      var curW=parseInt(parts[0])||1500,curH=parseInt(parts[1])||5000;
      if(_isAS&&curW!==1250){
        var newVal='1250|'+curH;
        for(var i=0;i<chapaSel.options.length;i++){if(chapaSel.options[i].value===newVal){chapaSel.value=newVal;break;}}
      } else if(!_isAS&&curW===1250){
        var newVal2='1500|'+curH;
        for(var i=0;i<chapaSel.options.length;i++){if(chapaSel.options[i].value===newVal2){chapaSel.value=newVal2;break;}}
      }
    }
  }
  // ACM → hidden block
  var acmQty=parseInt((document.getElementById('plan-acm-qty')||{value:0}).value)||0;
  var hiddenAcmSel=document.getElementById('acm-sel-1');
  if(hiddenAcmSel && acmSel){ hiddenAcmSel.value=acmSel.value; }
  var hiddenAcmQty=document.getElementById('acm-qty-1');
  if(hiddenAcmQty) hiddenAcmQty.value=acmQty;

  // ALU MACIÇO → hidden block (usa plan-alu-cor e plan-alu-qty)
  var aluSel=document.getElementById('plan-alu-cor');
  var aluQtyEl=document.getElementById('plan-alu-qty');
  var aluQty=aluQtyEl?parseInt(aluQtyEl.value)||0:0;
  if(aluQty>0){
    if(!document.getElementById('alu-blk-1')&&typeof addALU==='function') addALU(null,1);
    var hiddenAluSel=document.getElementById('alu-sel-1');
    var hiddenAluQty=document.getElementById('alu-qty-1');
    if(hiddenAluSel && aluSel && aluSel.value) hiddenAluSel.value=aluSel.value;
    if(hiddenAluQty) hiddenAluQty.value=aluQty;
  }

  _updateFabChapaResumo();
  calc();
}

function _updateFabChapaResumo(){
  // ACM
  var acmTb=document.getElementById('fab-acm-tbody'), acmTbl=document.getElementById('fab-acm-table'), acmE=document.getElementById('fab-acm-empty');
  var acmSel=document.getElementById('plan-acm-cor'), acmQty=parseInt((document.getElementById('plan-acm-qty')||{value:0}).value)||0;
  if(acmTb && acmSel && acmSel.value && acmQty>0){
    var opt=acmSel.options[acmSel.selectedIndex]; var label=opt?opt.text:'—';
    var preco=0; var pm=label.match(/R\$\s*([\d.,]+)/); if(pm)preco=parseFloat(pm[1].replace('.','').replace(',','.'))||0;
    var sub=preco*acmQty;
    var _chapaSize='';
    var _cSel=document.getElementById('plan-chapa');
    if(_cSel&&_cSel.value==='custom'){
      _chapaSize=((document.getElementById('plan-chapa-larg')||{value:1500}).value)+'×'+((document.getElementById('plan-chapa-alt')||{value:5000}).value)+'mm';
    } else if(_cSel&&_cSel.value){
      var _cp=_cSel.value.split('|');_chapaSize=_cp[0]+'×'+_cp[1]+'mm';
    } else if(window.PLN_SD){
      _chapaSize=PLN_SD.w+'×'+PLN_SD.h+'mm';
    }
    var _chapaSizeTag=_chapaSize?' <span style="font-size:9px;color:#888;font-weight:400">('+_chapaSize+')</span>':'';
    acmTb.innerHTML='<tr><td style="padding:4px 6px;border-bottom:1px solid #eee;font-size:11px;font-weight:600;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+label+'">'+label.split('·')[0].trim()+_chapaSizeTag+'</td>'
      +'<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center;font-weight:700">'+acmQty+'</td>'
      +'<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">R$ '+(preco>0?preco.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—')+'</td>'
      +'<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:var(--navy)">R$ '+sub.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>';
    if(acmTbl)acmTbl.style.display=''; if(acmE)acmE.style.display='none';
  } else { if(acmTb)acmTb.innerHTML=''; if(acmTbl)acmTbl.style.display='none'; if(acmE)acmE.style.display=''; }
  // ALU
  var aluTb=document.getElementById('fab-alu-tbody'), aluTbl=document.getElementById('fab-alu-table'), aluE=document.getElementById('fab-alu-empty');
  var aluCorSel=document.getElementById('plan-alu-cor');
  var aluQtyEl2=document.getElementById('plan-alu-qty');
  var _aluQ=aluQtyEl2?parseInt(aluQtyEl2.value)||0:0;
  var _aluPr=0, _aluLbl='ALU Maciço 2.5mm';
  if(aluCorSel&&aluCorSel.selectedIndex>0){
    var _aluOpt=aluCorSel.options[aluCorSel.selectedIndex];
    _aluLbl=_aluOpt?_aluOpt.text.split('·')[0].trim():'ALU Maciço';
    var _aluVP=aluCorSel.value.split('|');
    _aluPr=parseFloat(_aluVP[0])||0;
  }
  if(aluTb && _aluQ>0 && _aluPr>0){
    var _aluSub=_aluPr*_aluQ;
    var _aluSzTag='';
    var _aCSel2=document.getElementById('plan-chapa-alu');
    if(_aCSel2&&_aCSel2.value){var _acp2=_aCSel2.value.split('|');_aluSzTag=' <span style="font-size:9px;color:#6c3483;font-weight:400">('+_acp2[0]+'×'+_acp2[1]+'mm)</span>';}
    aluTb.innerHTML='<tr><td style="padding:4px 6px;border-bottom:1px solid #eee;font-size:11px;font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🔷 '+_aluLbl+_aluSzTag+'</td>'
      +'<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center;font-weight:700">'+_aluQ+'</td>'
      +'<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">R$ '+_aluPr.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#1a5276">R$ '+_aluSub.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>';
    if(aluTbl)aluTbl.style.display=''; if(aluE)aluE.style.display='none';
  } else { if(aluTb)aluTb.innerHTML=''; if(aluTbl)aluTbl.style.display='none'; if(aluE)aluE.style.display=''; }
}

/* ══ PREÇOS SIMPLIFICADOS — SOMENTE LÍQUIDO FINAL ═══════════ */

function renderPrecosACM(){
  var container=document.getElementById('precos-acm-container');
  if(!container) return;
  var html='';
  var allSec=[{title:'CHAPAS ACM',data:ACM_DATA,si:0,cor:'#e67e22'},
              {title:'CHAPAS ALUMÍNIO MACIÇO',data:ALU_DATA,si:1,cor:'#003144'}];
  allSec.forEach(function(sec){
    html+='<div style="font-size:12px;font-weight:800;color:#fff;background:'+sec.cor+';padding:8px 12px;border-radius:6px 6px 0 0;margin-top:12px;letter-spacing:.04em">'+sec.title+'</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:11px;border:1px solid #ddd;border-top:none;margin-bottom:8px">';
    sec.data.forEach(function(grp,gi){
      var cores={};var corOrder=[];
      grp.o.forEach(function(item){
        var cor=item.l.split(' · ')[0];
        if(!cores[cor]){cores[cor]={items:[]};corOrder.push(cor);}
        cores[cor].items.push(item);
      });
      var firstCor=corOrder[0];
      var grpSizes=cores[firstCor].items.map(function(it){
        var m=it.l.match(/(\d{3,4})×(\d{4,})/);
        return {w:m?parseInt(m[1]):1500,h:m?parseInt(m[2]):5000,a:it.a};
      });
      // Group header row
      html+='<tr style="background:#f5f3ee;border-top:2px solid #ddd">'
        +'<td style="padding:6px 10px;font-weight:700;font-size:11px;color:#555;letter-spacing:.03em">'+grp.g+'</td>';
      grpSizes.forEach(function(sz){
        html+='<td style="padding:6px 8px;text-align:center;font-weight:700;font-size:10px;color:#006600;width:120px">'+sz.w+'×'+sz.h+'</td>';
      });
      // Pad if fewer than 4 columns
      for(var pad=grpSizes.length;pad<4;pad++) html+='<td style="width:120px"></td>';
      html+='<td style="width:30px;padding:0 4px;text-align:center"><button onclick="_deleteChapa('+sec.si+','+gi+')" title="Excluir" style="border:none;background:none;color:#ccc;font-size:13px;cursor:pointer" onmouseover="this.style.color=\'#b71c1c\'" onmouseout="this.style.color=\'#ccc\'">×</button></td></tr>';
      // Data rows
      var ci=0;
      corOrder.forEach(function(cor){
        var c=cores[cor]; var id='prc-'+sec.si+'-'+gi+'-'+ci;
        var bg=ci%2===0?'#fff':'#fafaf7';
        html+='<tr style="background:'+bg+'">';
        html+='<td style="padding:5px 10px;font-weight:600;font-size:11px;border-bottom:0.5px solid #eee;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+cor+'">'+cor+'</td>';
        grpSizes.forEach(function(sz,szi){
          var item=c.items[szi];
          var val=item?item.p:(c.items[0].p*(sz.a/grpSizes[0].a));
          if(szi===0){
            html+='<td style="padding:3px 4px;text-align:right;border-bottom:0.5px solid #eee"><input type="number" id="'+id+'" data-si="'+sec.si+'" data-gi="'+gi+'" data-ci="'+ci+'" value="'+val.toFixed(2)+'" step="0.01" min="0" style="width:90px;padding:4px 6px;border:1px solid #c5e1c5;border-radius:4px;font-size:11px;text-align:right;background:#f5fff5;color:#006600;font-weight:700" oninput="_recalcLiq(this)"></td>';
          } else {
            html+='<td style="padding:5px 8px;text-align:right;color:#006600;font-size:11px;border-bottom:0.5px solid #eee" id="'+id+'-l'+szi+'">'+val.toFixed(2)+'</td>';
          }
        });
        for(var pad=grpSizes.length;pad<4;pad++) html+='<td style="border-bottom:0.5px solid #eee"></td>';
        html+='<td style="border-bottom:0.5px solid #eee"></td></tr>';
        ci++;
      });
    });
    html+='</table>';
  });
  container.innerHTML=html;
}
function _recalcLiq(inp){
  var id=inp.id,si=parseInt(inp.dataset.si),gi=parseInt(inp.dataset.gi);
  var baseVal=parseFloat(inp.value)||0;
  var data=si===0?ACM_DATA:ALU_DATA;
  var grp=data[gi];if(!grp)return;
  // Pegar áreas reais dos itens do grupo
  var firstCor=grp.o[0].l.split(' · ')[0];
  var items=grp.o.filter(function(it){return it.l.split(' · ')[0]===firstCor;});
  var baseA=items[0]?items[0].a:7.5;
  for(var i=1;i<items.length;i++){
    var el=document.getElementById(id+'-l'+i);
    if(el) el.textContent=(baseVal*(items[i].a/baseA)).toFixed(2);
  }
}
function salvarPrecos(){
  var updated=0;
  [{data:ACM_DATA,si:0},{data:ALU_DATA,si:1}].forEach(function(sec){
    sec.data.forEach(function(grp,gi){
      var cores={};var ci=0;
      grp.o.forEach(function(item){var cor=item.l.split(' · ')[0];if(!cores[cor]){cores[cor]={ci:ci,items:[]};ci++;}cores[cor].items.push(item);});
      for(var cor in cores){
        var info=cores[cor];
        var inp=document.getElementById('prc-'+sec.si+'-'+gi+'-'+info.ci);
        if(!inp)continue;
        var baseVal=parseFloat(inp.value)||0;
        var baseA=info.items[0].a;
        info.items.forEach(function(item){
          item.p=Math.round(baseVal*(item.a/baseA)*100)/100;
          updated++;
        });
      }
    });
  });
  _refreshChapaSelects();
  alert(updated+' preços líquidos atualizados!');
}

/* ══ INIT ════════════════════════════════════════════════ */
// Init is handled by DOMContentLoaded → autoRestore() → resetToDefaults() fallback
try{$('hist-count').textContent=loadDB().length;}catch(e){}

/* ══ END MODULE: PROPOSTA ══ */
