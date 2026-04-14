/**
 * 07-bar_visual.js
 * Module: BAR_VISUAL
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: BAR_VISUAL ══ */
function _barVisualHTML(items, barLen, kerf){
  kerf = kerf||9;
  var sobra = barLen - items.reduce(function(s,c){return s+c+kerf;},0);
  
  // Build proportional segments
  var segs = '';
  var COLORS = ['#1a5276','#1f618d','#2471a3','#2980b9','#3498db','#5dade2','#85c1e9'];
  var colorMap = {};  var ci = 0;
  items.forEach(function(c){
    if(!colorMap[c]){colorMap[c]=COLORS[ci%COLORS.length];ci++;}
  });
  
  items.forEach(function(c){
    var pct = (c/barLen*100).toFixed(3);
    var kpct = (kerf/barLen*100).toFixed(3);
    var showLabel = c > barLen*0.08; // only show label if segment wide enough
    segs += '<div style="width:'+pct+'%;background:'+colorMap[c]+';display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;font-size:8px;font-weight:700;color:#fff;flex-shrink:0;min-width:1px">'+(showLabel?c:'')+'</div>';
    segs += '<div style="width:'+kpct+'%;background:#333;flex-shrink:0;min-width:1.5px"></div>';
  });
  // Sobra
  if(sobra>0){
    var spct = (sobra/barLen*100).toFixed(3);
    segs += '<div style="width:'+spct+'%;background:#d5d8dc;display:flex;align-items:center;justify-content:center;font-size:8px;color:#888;flex-shrink:0">'+(sobra>barLen*0.08?sobra+'mm':'')+'</div>';
  }
  
  // Notation: group by cut length
  var grps = {};
  items.forEach(function(c){grps[c]=(grps[c]||0)+1;});
  var notParts = Object.keys(grps).sort(function(a,b){return b-a;}).map(function(c){
    var n=grps[c], tot=n*parseInt(c), tk=n*kerf;
    return tot+'+'+tk;
  });
  
  return '<div style="display:flex;height:22px;border:1px solid #aaa;border-radius:2px;overflow:hidden;background:#e8e8e8">'+segs+'</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:9px;color:#555;margin-top:1px;padding:0 1px">'
    +'<span>'+notParts.join('&nbsp;&nbsp;')+'</span>'
    +'<span style="font-weight:700;color:'+(sobra<50?'#c0392b':sobra<500?'#e67e22':'#555')+'">Sobra: '+sobra+'mm</span>'
    +'</div>';
}

function _renderPadroesContent(data, kerf){
  kerf = kerf||9;
  var html = '';
  data.seenKeys.forEach(function(key){
    var r = data.groupRes[key];
    if(!r || r.nBars===0) return; // skip profiles with zero cuts

    var perf = null;
    for(var i=0;i<PERFIS_DB.length;i++){
      if(PERFIS_DB[i].c===key||PERFIS_DB[i].c===key.replace(/-[678]M$/,'')){perf=PERFIS_DB[i];break;}
    }
    var descr    = perf ? perf.d : key;
    var trat     = r.pintado ? 'PINTURA PRETO' : 'NATURAL';
    var barLenMm = r.barLenMM || 6000;
    var barLenM  = barLenMm / 1000;

    var cutList  = data.cuts.filter(function(c){return c.code===key;});
    var totalQtd = 0; // acumulado no forEach abaixo (considera split)

    // ── Profile block ───────────────────────────────────────────────────────
    html += '<div style="border:1px solid #d5d8dc;border-radius:6px;margin-bottom:12px;overflow:hidden">';

    // Header
    html += '<div style="background:#f0f4f6;padding:7px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">'
          +'<div>'
          +'<span style="font-weight:800;font-size:14px;color:#c47012;letter-spacing:.03em">'+key+(r.pintado?' 🎨':'')+'</span>'
          +'<span style="font-size:10px;color:#666;margin-left:8px">'+descr+'</span>'
          +'</div>'
          +'<div style="text-align:right;display:flex;align-items:center;gap:10px;justify-content:flex-end">'
          +'<span style="background:#003144;color:#fff;font-size:15px;font-weight:900;padding:4px 16px;border-radius:20px">'
          +r.nBars+' barra'+(r.nBars>1?'s':'')+' &times; '+barLenM+'m'
          +'</span>'
          +'<span style="font-size:10px;color:#555">Aproveitamento: '+r.aprov.toFixed(1)+'%'
          +' &nbsp;|&nbsp; Trat.: '+trat+'</span>'
          +'</div></div>';

    // Cut list table
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:10px">';
    html += '<thead><tr style="background:#eee">'
          +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Qtde</th>'
          +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Tam (mm)</th>'
          +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Corte</th>'
          +'<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Descrição</th>'
          +'</tr></thead><tbody>';
    cutList.forEach(function(c){
      if(c.isSplit && c.splitPieces && c.splitPieces.length > 1){
        var pieceCounts={};
        c.splitPieces.forEach(function(p){ pieceCounts[p]=(pieceCounts[p]||0)+c.qty; });
        Object.keys(pieceCounts).forEach(function(p){
          var pQty=pieceCounts[p];
          totalQtd+=pQty;
          html+='<tr style="background:#fffbf0">'
               +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;font-weight:700;color:#e67e22">'+pQty+'</td>'
               +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;color:#e67e22">'+p+'</td>'
               +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center">90/90</td>'
               +'<td style="padding:3px 8px;border:0.5px solid #eee;color:#e67e22;font-size:10px">✂ '+c.desc+' (emenda '+c.compMM+'mm)</td>'
               +'</tr>';
        });
      } else {
        totalQtd+=c.qty;
        html+='<tr>'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;font-weight:700">'+c.qty+'</td>'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center">'+c.compMM+'</td>'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center">90/90</td>'
             +'<td style="padding:3px 8px;border:0.5px solid #eee;color:#555">'+c.desc+'</td>'
             +'</tr>';
      }
    });
    html += '<tr style="background:#f8f8f8;font-weight:700">'
          +'<td colspan="4" style="padding:3px 8px;border:0.5px solid #eee;font-size:10px;color:#1a3a4a">'
          +totalQtd+' <<< Qtde total do item'
          +'</td></tr>';
    html += '</tbody></table></div>';

    // Bar diagrams — always visible inside drawer
    if(r.barsDetail && r.barsDetail.length > 0){
      html += '<div style="padding:8px 12px;background:#fafafa;border-top:1px solid #e8e8e8">';
      r.barsDetail.forEach(function(bar, bi){
        var bLen     = (bar.len && bar.len > 0) ? bar.len : barLenMm;
        var sobra    = bar.sobra != null ? bar.sobra : bar.remaining;
        var usedMm   = bar.items.reduce(function(s,c){return s+c+kerf;},0);
        var aprovPct = bLen > 0 ? Math.round(usedMm / bLen * 100) : 0;
        var aprovColor = aprovPct < 75 ? '#c0392b' : aprovPct < 88 ? '#e67e22' : '#27ae60';

        html += '<div style="margin-bottom:10px">';
        // Bar header info
        html += '<div style="font-size:9px;color:#777;margin-bottom:2px;display:flex;justify-content:space-between;align-items:center">'
              +'<span><b>Barra '+(bi+1)+'</b> &nbsp;|&nbsp; '+bLen+'mm &nbsp;|&nbsp; Útil: '+bLen+'mm'
              +(r.nBars>1?' &nbsp;|&nbsp; '+r.nBars+' barras total':'')+'</span>'
              +'<span style="color:'+aprovColor+';font-weight:700">Aprov: '+aprovPct+'% &nbsp;|&nbsp; Sobra: '+sobra+'mm</span>'
              +'</div>';
        // Cuts summary line
        var cutSummary = bar.items.slice().sort(function(a,b){return b-a;})
                             .map(function(c){return '1\u00d7'+c;}).join('  ');
        html += '<div style="font-size:9px;color:#666;margin-bottom:3px;font-family:monospace">'+cutSummary+'</div>';
        // Visual bar
        html += _barVisualHTML(bar.items, bLen, kerf);
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="padding:6px 12px;background:#fafafa;border-top:1px solid #e8e8e8;font-size:9px;color:#aaa">Sem dados de barras.</div>';
    }

    html += '</div>'; // end profile block
  });

  // ── FIXOS: bloco de barras do quadro fixo (junto no aproveitamento) ─────────
  var fixoPerfs = window._lastFixosPerfisRows || [];
  if(fixoPerfs.length > 0){
    var fMap = {};
    fixoPerfs.forEach(function(r){
      var k = r.code+'|'+r.mm;
      if(!fMap[k]) fMap[k]={code:r.code,desc:r.desc,mm:r.mm,qty:0};
      fMap[k].qty += r.qty;
    });
    var totalBarrasFixo=0;
    var fRows=[];
    Object.keys(fMap).forEach(function(k){
      var r=fMap[k];
      var barras=Math.ceil(r.mm*r.qty/6000);
      totalBarrasFixo+=barras;
      fRows.push({code:r.code,desc:r.desc,mm:r.mm,qty:r.qty,barras:barras});
    });
    html+='<div style="border:2px solid #6c3483;border-radius:6px;margin-bottom:12px;overflow:hidden">';
    html+='<div style="background:#6c3483;color:#fff;padding:7px 12px;display:flex;justify-content:space-between;align-items:center">';
    html+='<span style="font-weight:800;font-size:13px;letter-spacing:.03em">🔲 QUADRO FIXO — Perfis</span>';
    html+='<span style="font-size:10px;opacity:.85">'+totalBarrasFixo+' barra(s) de 6m</span></div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="background:#f3ecfa">';
    html+='<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Qtd</th>';
    html+='<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Tam(mm)</th>';
    html+='<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Código</th>';
    html+='<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:left">Descrição</th>';
    html+='<th style="padding:4px 8px;border:0.5px solid #ddd;text-align:center">Barras 6m</th>';
    html+='</tr></thead><tbody>';
    fRows.forEach(function(r,i){
      var bg=i%2===0?'#faf7fc':'#fff';
      html+='<tr style="background:'+bg+'">'+
        '<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;font-weight:700">'+r.qty+'</td>'+
        '<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center">'+r.mm+'</td>'+
        '<td style="padding:3px 8px;border:0.5px solid #eee;color:#6c3483;font-weight:600;font-size:9px">'+r.code+'</td>'+
        '<td style="padding:3px 8px;border:0.5px solid #eee;color:#555">'+r.desc+'</td>'+
        '<td style="padding:3px 8px;border:0.5px solid #eee;text-align:center;font-weight:700;color:#6c3483">'+r.barras+'</td>'+
        '</tr>';
    });
    html+='</tbody></table></div>';
  }

  return html;
}


// ── FLAG: OS gerada ao menos uma vez pelo usuário ─────────────────────────────

/* ══ END MODULE: BAR_VISUAL ══ */
