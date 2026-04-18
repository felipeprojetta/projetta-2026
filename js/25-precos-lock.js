/**
 * 25-precos-lock.js
 * Module: PRECOS-LOCK — Guardião dos preços de kg de perfis e pintura
 *
 * O QUE FAZ:
 *  1. Snapshot periódico dos valores dos campos de preço (30s).
 *  2. Intercepta _loadPerfisCloud() — se já há valores nos campos, BLOQUEIA sobrescrita.
 *  3. MutationObserver nos inputs — se valor mudar sem foco humano, avisa no console.
 *  4. Zero alteração em arquivos existentes; tudo vive neste módulo.
 *
 * O QUE NÃO FAZ:
 *  - Não altera nenhum valor sozinho.
 *  - Não toca em PERFIS_DB, 12-proposta.js, 15-cadastro_init.js.
 *  - Não bloqueia edição manual pelo usuário (input, change, blur funcionam normal).
 *
 * Slot de backup próprio: localStorage['projetta_precos_backup']
 * (não conflita com 'projetta_perfis_kg' usado pelo 12-proposta.js).
 */
(function(){
'use strict';

var CAMPOS = ['pf-kg-tecnoperfil','pf-kg-mercado','pf-kg-weiku','pf-preco-pintura',
              'pf-ded-tecnoperfil','pf-ded-mercado','pf-ded-weiku','pf-ded-pintura'];
var BACKUP_KEY = 'projetta_precos_backup';
var LOG_PREFIX = '%c[precos-lock]';
var LOG_STYLE  = 'color:#003144;font-weight:700';

/* ── Ler valores atuais dos campos ── */
function _lerCampos(){
  var out={};
  CAMPOS.forEach(function(id){
    var el=document.getElementById(id);
    if(el) out[id]=el.value;
  });
  return out;
}

/* ── Tem pelo menos 1 campo com valor? ── */
function _temValores(obj){
  return Object.keys(obj||{}).some(function(k){
    var v=obj[k]; return v!==undefined && v!==null && String(v).trim()!=='';
  });
}

/* ── Salvar snapshot ── */
function _snapshot(motivo){
  var valores=_lerCampos();
  if(!_temValores(valores)) return; // não salva snapshot vazio
  try{
    localStorage.setItem(BACKUP_KEY, JSON.stringify({
      valores:valores,
      timestamp:new Date().toISOString(),
      source:motivo||'snapshot_auto'
    }));
  }catch(e){}
}

/* ── Ler último snapshot ── */
function _loadBackup(){
  try{return JSON.parse(localStorage.getItem(BACKUP_KEY)||'null');}catch(e){return null;}
}

/* ── Restaurar do backup nos campos ── */
function _restaurar(){
  var bkp=_loadBackup();
  if(!bkp||!bkp.valores) return false;
  var restaurados=0;
  Object.keys(bkp.valores).forEach(function(id){
    var el=document.getElementById(id);
    if(el && el.value!==bkp.valores[id]){
      el.value=bkp.valores[id];
      restaurados++;
    }
  });
  if(restaurados>0){
    console.log(LOG_PREFIX+' RESTAURADOS '+restaurados+' campos do backup ('+bkp.timestamp+')', LOG_STYLE);
  }
  return restaurados>0;
}

/* ──────────────────────────────────────────────────
   1. INTERCEPTOR: _loadPerfisCloud
   ──────────────────────────────────────────────────
   Se já existem valores nos campos, BLOQUEIA a sobrescrita
   automática que vem da nuvem. O usuário continua podendo
   editar manualmente, só impedimos o overwrite silencioso.
   ────────────────────────────────────────────────── */
function _instalarInterceptador(){
  if(typeof window._loadPerfisCloud!=='function'){
    // Função ainda não definida (12-proposta.js ainda carregando). Tenta depois.
    return false;
  }
  if(window._loadPerfisCloud._locked){return true;} // já interceptado

  var original = window._loadPerfisCloud;
  window._loadPerfisCloud = function(){
    var atuais=_lerCampos();
    if(_temValores(atuais)){
      console.warn(LOG_PREFIX+' _loadPerfisCloud() BLOQUEADO — campos já têm valores, evitando sobrescrita automática.', LOG_STYLE);
      console.log('  valores atuais:', atuais);
      return; // não chama o original
    }
    // Campos realmente vazios — permite sincronizar
    console.log(LOG_PREFIX+' _loadPerfisCloud() permitido (campos vazios)', LOG_STYLE);
    return original.apply(this, arguments);
  };
  window._loadPerfisCloud._locked = true;
  window._loadPerfisCloud._original = original;
  return true;
}

/* ──────────────────────────────────────────────────
   2. OBSERVER: detecta mudança sem foco humano
   ──────────────────────────────────────────────────
   MutationObserver no atributo `value` dos inputs de preço.
   Se valor mudar enquanto o campo NÃO está em foco, loga aviso.
   (não restaura automático — só avisa, pra não criar outro bug)
   ────────────────────────────────────────────────── */
function _instalarObserver(){
  if(window._precosLockObserver) return true;
  var obs=new MutationObserver(function(muts){
    muts.forEach(function(m){
      if(m.type==='attributes'&&m.attributeName==='value'){
        var el=m.target;
        if(document.activeElement!==el){
          console.warn(LOG_PREFIX+' Campo '+el.id+' alterado sem foco: "'+m.oldValue+'" → "'+el.value+'"', LOG_STYLE);
        }
      }
    });
  });
  CAMPOS.forEach(function(id){
    var el=document.getElementById(id);
    if(el) obs.observe(el,{attributes:true, attributeOldValue:true, attributeFilter:['value']});
  });
  window._precosLockObserver=obs;
  return true;
}

/* ──────────────────────────────────────────────────
   3. SNAPSHOT AUTOMÁTICO a cada 30s (se tem valores)
   ────────────────────────────────────────────────── */
function _iniciarSnapshots(){
  if(window._precosLockTimer) return;
  // Snapshot imediato se já houver valores
  setTimeout(function(){_snapshot('boot');},2000);
  // A cada 30s enquanto a aba estiver ativa
  window._precosLockTimer=setInterval(function(){
    if(document.visibilityState==='visible') _snapshot('interval');
  },30000);
}

/* ──────────────────────────────────────────────────
   API PÚBLICA (debug / uso manual)
   ────────────────────────────────────────────────── */
window.precosLock = {
  snapshot: function(){ _snapshot('manual'); return _loadBackup(); },
  backup:   function(){ return _loadBackup(); },
  restaurar: function(){ return _restaurar(); },
  status:   function(){
    return {
      interceptor_instalado: !!(window._loadPerfisCloud && window._loadPerfisCloud._locked),
      observer_instalado:    !!window._precosLockObserver,
      snapshot_timer:        !!window._precosLockTimer,
      backup_atual:          _loadBackup(),
      valores_campos:        _lerCampos()
    };
  }
};

/* ──────────────────────────────────────────────────
   BOOT
   ────────────────────────────────────────────────── */
function _boot(){
  _instalarInterceptador();
  _instalarObserver();
  _iniciarSnapshots();
  console.log(LOG_PREFIX+' 🔒 Guardião de preços ativo', LOG_STYLE);
}

// _loadPerfisCloud pode não existir no momento do boot, tenta algumas vezes
function _tentativas(){
  var tries=0;
  var iv=setInterval(function(){
    tries++;
    var ok=_instalarInterceptador();
    if(ok || tries>=20){ // 20 × 500ms = 10s máx
      _instalarObserver();
      _iniciarSnapshots();
      clearInterval(iv);
      console.log(LOG_PREFIX+' 🔒 Guardião de preços ativo (interceptor='+(ok?'OK':'não encontrado')+')', LOG_STYLE);
    }
  },500);
}

if(document.readyState==='complete'||document.readyState==='interactive'){
  setTimeout(_tentativas,100);
} else {
  document.addEventListener('DOMContentLoaded',function(){setTimeout(_tentativas,100);});
}

})();
