/**
 * 04-orcamento_ui.js
 * Module: ORCAMENTO_UI
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: ORCAMENTO_UI ══ */
function zerarValores(){
  if(!confirm('Zerar TUDO? O orçamento volta ao estado inicial, sem cliente e sem vínculo.')) return;
  // 1. Cancelar timers e destravar
  void 0;
  window._snapshotLock=false;
  window._orcLocked=false;
  (window._orcLocked=false);
  (function(){var p=document.getElementById("memorial-panel");if(p)p.style.display="none";})();
  _clearResultDisplay();
  // 2. Desconectar do orçamento salvo
  currentId=null; currentRev=null;
  window._pendingRevision=false;
  void 0;
  window._crmOrcCardId=null;
  // ★ Felipe 23/04: resetar scope do card pra não ficar travado em internacional
  window._crmScope=null;
  if(document.body) document.body.removeAttribute('data-scope');
  // 3. Esconder banner
  var curBanner=document.getElementById('cur-banner');
  if(curBanner) curBanner.classList.remove('show');
  var lockBanner=document.getElementById('orc-lock-banner');
  if(lockBanner) lockBanner.style.display='none';
  // 4. Esconder botões CRM
  var btnP=document.getElementById('crm-orc-pronto-btn');if(btnP)btnP.style.display='none';
  var btnA=document.getElementById('crm-atualizar-btn');if(btnA)btnA.style.display='none';
  // 5. Reset formulário
  resetToDefaults();
  var ind=document.getElementById('autosave-ind');
  if(ind){ind.textContent='✓ Zerado — novo orçamento';ind.style.opacity='1';setTimeout(function(){ind.style.opacity='0';},3000);}
}
function newOrcamento(){
  // Hide CRM items bar
  window._orcItens=[];window._orcItemAtual=-1;
  var ibar=document.getElementById('orc-itens-bar');if(ibar)ibar.classList.remove('show');
  // Show GERAR CUSTO COMPLETO back
  var gcw=document.getElementById('gerar-custo-wrap');if(gcw)gcw.style.display='';
  // Show inst-quem in orçamento for direct mode
  var iqw=document.getElementById('inst-quem-wrap');if(iqw)iqw.style.display='';

  if(!confirm('Iniciar novo orçamento? O orçamento atual será salvo automaticamente.')) return;
  // Unlock form
  void 0;
  window._snapshotLock=false;
  window._orcLocked=false;
  try{(window._orcLocked=false);}catch(e){}
  (function(){var p=document.getElementById("memorial-panel");if(p)p.style.display="none";})();
  _clearResultDisplay();
  // Salvar o orçamento atual se existem dados
  var clienteAtual=($('cliente')||{}).value;
  if(clienteAtual && clienteAtual.trim()){
    void 0; // Salva o que está aberto
  }
  currentId=null; currentRev=null;
  window._isATP=false;
  void 0;
  // Reset visual ATP
  var badge=$('status-badge');if(badge){badge.textContent='ORÇAMENTO';badge.style.background='#e67e22';}
  var atpRow=$('atp-field-row');if(atpRow)atpRow.style.display='none';var atpCont=$('atp-contato-row');if(atpCont)atpCont.style.display='none';
  var end=$('atp-endereco');if(end)end.style.display='none';
  var btn=$('btn-gerar-atp');if(btn){btn.textContent='📋 Gerar ATP';btn.style.background='#1a5276';btn.style.borderColor='#1a5276';}
  $('cur-banner').classList.remove('show');
  try{localStorage.removeItem(AUTOSAVE_KEY);}catch(e){}
  // Limpar vínculo CRM
  window._crmOrcCardId=null;
  // ★ Felipe 23/04: resetar scope do card
  window._crmScope=null;
  if(document.body) document.body.removeAttribute('data-scope');
  var crmBtn=document.getElementById('crm-orc-pronto-btn');if(crmBtn)crmBtn.style.display='none';
  resetToDefaults();
  var ind=document.getElementById('autosave-ind');
  if(ind){ind.textContent='✓ Novo orçamento iniciado';ind.style.opacity='1';setTimeout(function(){ind.style.opacity='0';},2500);}
}

/* ══ APROVEITAMENTO ═══════════════════════════════════════ */

/* ══ END MODULE: ORCAMENTO_UI ══ */
