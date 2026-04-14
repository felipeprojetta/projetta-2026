/**
 * 20-block-20.js
 * Module: BLOCK-20
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
// ── Inicialização: calcular instalação ao carregar a página ──────────────────
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    // Se não houver sessão restaurada, rodar calc() para popular campos de instalação
    if(typeof calc === 'function'){
      // Garantir valor padrão da diária
      var dEl = document.getElementById('diaria');
      if(dEl && (!dEl.value || dEl.value === '0')) dEl.value = 550;
      var aEl = document.getElementById('alim');
      if(aEl && (!aEl.value || aEl.value === '0')) aEl.value = 90;
      var hEl = document.getElementById('hotel-dia');
      if(hEl && (!hEl.value || hEl.value === '0')) hEl.value = 350;
      calc();
    }
  }, 300);
});

// ── Markup de desconto — edição manual ───────────────────────────────────────
function _onMarkupDescManual(el){
  el.dataset.manual='1';
  el.style.borderColor='#e67e22';
  el.style.background='#fff8f0';
  el.style.color='#c0392b';
  el.style.fontWeight='700';
  var lbl=document.getElementById('markup-desc-auto');
  if(lbl) lbl.textContent='(editado manualmente — limpe para voltar ao auto)';
  el.addEventListener('input',function(){
    if(this.value===''){
      this.dataset.manual='';
      this.style.borderColor='';this.style.background='';
      this.style.color='';this.style.fontWeight='';
    }
  },{once:true});
}

