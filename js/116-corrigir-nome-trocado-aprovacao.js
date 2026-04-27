/* ============================================================================
 * js/116-corrigir-nome-trocado-aprovacao.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: corrigir bug onde app aprova versao com nome trocado
 *
 * BUG OBSERVADO:
 *  Felipe abriu pre_orcamento "Principal" (R$ 83.738), clicou em Aprovar.
 *  App enviou POST com opcao_nome="Opcao 2 - Sem Alisar" mas valores da Principal.
 *  PDF foi impresso com nome errado (Opcao 2) e valores da Principal.
 *
 * COMPORTAMENTO:
 *  Antes do POST /versoes_aprovadas chegar no banco:
 *  1. Pega body: opcao_nome=X, valor_tabela=Y, valor_faturamento=Z, card_id=C
 *  2. Busca pre_orcamentos do card_id
 *  3. Acha o pre cujo valor_faturamento bate com Z (tolerancia R$ 1)
 *  4. Se o pre achado tem opcao_nome DIFERENTE de X → CORRIGE o body com nome correto
 *  5. Mostra aviso azul "Nome de opcao corrigido para: X"
 *
 * Carregado APOS mod 115 — interceptor encadeado:
 *  fetch original → mod 115 (lock 3s) → mod 116 (corrige nome)
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/81-fix-fluxo-nativo.js (BLINDADO)
 *  - Atua via fetch interceptor (apos mod 115)
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta116CorrigirNomeApplied) return;
  window.__projetta116CorrigirNomeApplied = true;
  console.log("[116-corrigir-nome] iniciando");

  var origFetch = window.fetch;
  if(!origFetch) return;
  var SB_URL = "https://plmliavuwlgpwaizfeds.supabase.co";
  var TOLERANCIA_BRL = 1.0;  // tolerancia em reais para match de valor_faturamento

  function isVersaoAprovadaPost(urlStr, method){
    if(!urlStr || method !== "POST") return false;
    return /\/rest\/v1\/versoes_aprovadas(?:\?|$)/.test(urlStr);
  }

  function showAviso(opcaoCorreta, opcaoErrada){
    var aviso = document.createElement("div");
    aviso.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#3b82f6;color:#fff;padding:14px 24px;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.4);z-index:1000000;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;max-width:640px";
    aviso.innerHTML = "🛡 <b>Nome de opção corrigido automaticamente</b><br>"+
      "<span style=\"font-size:12px;font-weight:400;opacity:0.9\">"+
      "App enviou nome \""+opcaoErrada+"\" mas os valores são da \""+opcaoCorreta+"\". Salvei como <b>"+opcaoCorreta+"</b>.</span>";
    document.body.appendChild(aviso);
    setTimeout(function(){ aviso.style.opacity = "0"; aviso.style.transition = "opacity 0.5s"; }, 5000);
    setTimeout(function(){ aviso.remove(); }, 5600);
  }

  // Le valor_faturamento numerico de um pre_orcamento (multiplos formatos possiveis)
  function getFatPreOrc(p){
    if(!p) return null;
    // 1. globais._calcResult._fatTotal (numerico, mais confiavel)
    try {
      var v = p && p.globais && p.globais._calcResult && p.globais._calcResult._fatTotal;
      if(v && !isNaN(parseFloat(v))) return parseFloat(v);
    } catch(e){}
    // 2. resultado.preco_fat (string BRL)
    try {
      var s = p && p.resultado && p.resultado.preco_fat;
      if(s){
        var n = parseFloat(String(s).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
        if(!isNaN(n)) return n;
      }
    } catch(e){}
    return null;
  }

  window.fetch = async function(input, init){
    try {
      var urlStr = "";
      if(typeof input === "string") urlStr = input;
      else if(input && input.url) urlStr = input.url;
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

      if(isVersaoAprovadaPost(urlStr, method)){
        init = init || {};
        var bodyStr = init.body || (input && input.body) || null;
        if(typeof bodyStr === "string" && bodyStr.length > 0){
          var parsed = null;
          try { parsed = JSON.parse(bodyStr); } catch(e){}
          if(parsed){
            var isArr = Array.isArray(parsed);
            var registros = isArr ? parsed : [parsed];
            var r = registros[0];

            if(r && r.card_id && r.opcao_nome && (r.valor_faturamento || r.valor_tabela)){
              var fatEnviado = parseFloat(r.valor_faturamento);
              if(!isNaN(fatEnviado) && fatEnviado > 0){
                // Buscar pre_orcamentos do card_id
                var qBuscar = "/rest/v1/pre_orcamentos?card_id=eq." + encodeURIComponent(r.card_id) + "&deleted_at=is.null&select=opcao_nome,resultado,globais";
                var rPre = await origFetch(SB_URL + qBuscar, {
                  headers: { apikey: window._SB_KEY, Authorization: "Bearer " + window._SB_KEY }
                });
                var pres = [];
                if(rPre.ok){ pres = await rPre.json(); }

                // Achar o pre cujo valor_faturamento bate com fatEnviado
                var matchPre = null;
                var menorDif = TOLERANCIA_BRL + 1;
                for(var i = 0; i < pres.length; i++){
                  var fp = getFatPreOrc(pres[i]);
                  if(fp === null) continue;
                  var dif = Math.abs(fp - fatEnviado);
                  if(dif < menorDif){
                    menorDif = dif;
                    matchPre = pres[i];
                  }
                }

                if(matchPre && matchPre.opcao_nome && matchPre.opcao_nome !== r.opcao_nome){
                  // BUG DETECTADO! Corrigir o opcao_nome
                  console.warn("[116-corrigir-nome] CORRIGINDO body: opcao_nome era \"" + r.opcao_nome + "\" virou \"" + matchPre.opcao_nome + "\" (fat=" + fatEnviado + " bateu com pre_orc " + matchPre.opcao_nome + ")");
                  showAviso(matchPre.opcao_nome, r.opcao_nome);
                  var nomeErrado = r.opcao_nome;
                  r.opcao_nome = matchPre.opcao_nome;
                  // Tambem atualizar dados_projeto se tiver opcao la (defensivo)
                  if(r.dados_projeto && typeof r.dados_projeto === "object" && r.dados_projeto.opcao_nome === nomeErrado){
                    r.dados_projeto.opcao_nome = matchPre.opcao_nome;
                  }
                  // Reescrever body
                  if(isArr){ parsed[0] = r; init.body = JSON.stringify(parsed); }
                  else { init.body = JSON.stringify(r); }
                  console.log("[116-corrigir-nome] body reescrito com opcao_nome=" + matchPre.opcao_nome);
                } else if(matchPre){
                  console.log("[116-corrigir-nome] OK — opcao_nome \"" + r.opcao_nome + "\" bate com pre_orc dos valores enviados");
                } else {
                  console.log("[116-corrigir-nome] AVISO — nao achei pre_orc com fat=" + fatEnviado + " (tolerancia " + TOLERANCIA_BRL + "). Deixando passar sem alteracao.");
                }
              }
            }
          }
        }
      }
    } catch(e){
      console.warn("[116-corrigir-nome] erro:", e);
    }
    return origFetch.apply(this, arguments);
  };

  console.log("[116-corrigir-nome] instalado (tolerancia R$ " + TOLERANCIA_BRL + ")");
})();
