/**
 * 01-shared.js
 * Module: SHARED
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ CLOUD SYNC HELPERS ══ */
window._cloudPush=function(key,data){
  var u=window._SB_URL,k=window._SB_KEY;if(!u||!k)return;
  fetch(u+'/rest/v1/configuracoes',{method:'POST',
    headers:{'apikey':k,'Authorization':'Bearer '+k,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify({chave:'cloud_'+key,valor:{data:data,ts:new Date().toISOString()}})
  }).then(function(r){if(!r.ok)console.warn('☁️ Erro save '+key+':',r.status);else console.log('☁️ Salvo: '+key);})
  .catch(function(e){console.warn('☁️ Rede err '+key+':',e);});
};
window._cloudPull=function(key,cb){
  var u=window._SB_URL,k=window._SB_KEY;if(!u||!k){cb(null);return;}
  fetch(u+'/rest/v1/configuracoes?chave=eq.cloud_'+key+'&select=valor&limit=1',
    {headers:{'apikey':k,'Authorization':'Bearer '+k}})
  .then(function(r){return r.json();})
  .then(function(rows){cb(rows&&rows.length&&rows[0].valor?rows[0].valor.data:null);})
  .catch(function(){cb(null);});
};
/* ══ END CLOUD SYNC HELPERS ══ */

/* ══ MODULE: SHARED ══ */
/* ══════════════════════════════════════════════════════
   CHAPA DATA
   ══════════════════════════════════════════════════════ */
const MODEL_IMGS={
  // Imagens dos modelos carregadas da nuvem via _modeloImgCache
  // Arquivos estáticos removidos na limpeza base64
};
const ACM_DATA=[
  {g:"KYNAR 4300 — Sólidas e Metalizadas",seco:1431.03,o:[
    {l:"PRO571 BONE WHITE · 1500×5000",p:1214.25,a:7.5},{l:"PRO571 BONE WHITE · 1500×6000",p:1457.10,a:9.0},{l:"PRO571 BONE WHITE · 1500×7000",p:1699.95,a:10.5},{l:"PRO571 BONE WHITE · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO9003 BRANCO RAL9003 · 1500×5000",p:1214.24,a:7.5},{l:"PRO9003 BRANCO RAL9003 · 1500×6000",p:1457.09,a:9.0},{l:"PRO9003 BRANCO RAL9003 · 1500×7000",p:1699.94,a:10.5},{l:"PRO9003 BRANCO RAL9003 · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO5818 BRONZE 1001 MET · 1500×5000",p:1214.24,a:7.5},{l:"PRO5818 BRONZE 1001 MET · 1500×6000",p:1457.09,a:9.0},{l:"PRO5818 BRONZE 1001 MET · 1500×7000",p:1699.94,a:10.5},{l:"PRO5818 BRONZE 1001 MET · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO3316 BRONZE 1002 MET · 1500×5000",p:1214.24,a:7.5},{l:"PRO3316 BRONZE 1002 MET · 1500×6000",p:1457.09,a:9.0},{l:"PRO3316 BRONZE 1002 MET · 1500×7000",p:1699.94,a:10.5},{l:"PRO3316 BRONZE 1002 MET · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO5062 BRONZE 1003 SB · 1500×5000",p:1214.24,a:7.5},{l:"PRO5062 BRONZE 1003 SB · 1500×6000",p:1457.09,a:9.0},{l:"PRO5062 BRONZE 1003 SB · 1500×7000",p:1699.94,a:10.5},{l:"PRO5062 BRONZE 1003 SB · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO1363 CINZA ESCURO UMBRAGRAU · 1500×5000",p:1214.24,a:7.5},{l:"PRO1363 CINZA ESCURO UMBRAGRAU · 1500×6000",p:1457.09,a:9.0},{l:"PRO1363 CINZA ESCURO UMBRAGRAU · 1500×7000",p:1699.94,a:10.5},{l:"PRO1363 CINZA ESCURO UMBRAGRAU · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO7263 CINZA PEWTER MET · 1500×5000",p:1214.24,a:7.5},{l:"PRO7263 CINZA PEWTER MET · 1500×6000",p:1457.09,a:9.0},{l:"PRO7263 CINZA PEWTER MET · 1500×7000",p:1699.94,a:10.5},{l:"PRO7263 CINZA PEWTER MET · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO111 CHAMPAGNE MET · 1500×5000",p:1214.24,a:7.5},{l:"PRO111 CHAMPAGNE MET · 1500×6000",p:1457.09,a:9.0},{l:"PRO111 CHAMPAGNE MET · 1500×7000",p:1699.94,a:10.5},{l:"PRO111 CHAMPAGNE MET · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO1874 DARK GREY JLR MET · 1500×5000",p:1214.24,a:7.5},{l:"PRO1874 DARK GREY JLR MET · 1500×6000",p:1457.09,a:9.0},{l:"PRO1874 DARK GREY JLR MET · 1500×7000",p:1699.94,a:10.5},{l:"PRO1874 DARK GREY JLR MET · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO121 GOLDEN MET · 1500×5000",p:1214.24,a:7.5},{l:"PRO121 GOLDEN MET · 1500×6000",p:1457.09,a:9.0},{l:"PRO121 GOLDEN MET · 1500×7000",p:1699.94,a:10.5},{l:"PRO121 GOLDEN MET · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO136 SAND GOLDEN MET · 1500×5000",p:1214.24,a:7.5},{l:"PRO136 SAND GOLDEN MET · 1500×6000",p:1457.09,a:9.0},{l:"PRO136 SAND GOLDEN MET · 1500×7000",p:1699.94,a:10.5},{l:"PRO136 SAND GOLDEN MET · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO135 SILVER GOLDEN MET · 1500×5000",p:1214.24,a:7.5},{l:"PRO135 SILVER GOLDEN MET · 1500×6000",p:1457.09,a:9.0},{l:"PRO135 SILVER GOLDEN MET · 1500×7000",p:1699.94,a:10.5},{l:"PRO135 SILVER GOLDEN MET · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO134 SMOKE SILVER MET · 1500×5000",p:1214.24,a:7.5},{l:"PRO134 SMOKE SILVER MET · 1500×6000",p:1457.09,a:9.0},{l:"PRO134 SMOKE SILVER MET · 1500×7000",p:1699.94,a:10.5},{l:"PRO134 SMOKE SILVER MET · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO225 OLIVE GREEN HAUS FO · 1500×5000",p:1214.24,a:7.5},{l:"PRO225 OLIVE GREEN HAUS FO · 1500×6000",p:1457.09,a:9.0},{l:"PRO225 OLIVE GREEN HAUS FO · 1500×7000",p:1699.94,a:10.5},{l:"PRO225 OLIVE GREEN HAUS FO · 1500×8000",p:1942.79,a:12.0},
  ]},
  {g:"WEATHER 4300 — Texturizado",seco:1431.03,o:[
    {l:"PRO9003T BRANCO TEX · 1500×5000",p:1214.24,a:7.5},{l:"PRO9003T BRANCO TEX · 1500×6000",p:1457.09,a:9.0},{l:"PRO9003T BRANCO TEX · 1500×7000",p:1699.94,a:10.5},{l:"PRO9003T BRANCO TEX · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO5818T BRONZE 1001 TEX · 1500×5000",p:1214.24,a:7.5},{l:"PRO5818T BRONZE 1001 TEX · 1500×6000",p:1457.09,a:9.0},{l:"PRO5818T BRONZE 1001 TEX · 1500×7000",p:1699.94,a:10.5},{l:"PRO5818T BRONZE 1001 TEX · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO1363T CINZA ESCURO TEX · 1500×5000",p:1214.24,a:7.5},{l:"PRO1363T CINZA ESCURO TEX · 1500×6000",p:1457.09,a:9.0},{l:"PRO1363T CINZA ESCURO TEX · 1500×7000",p:1699.94,a:10.5},{l:"PRO1363T CINZA ESCURO TEX · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO7263T CINZA PEWTER TEX · 1500×5000",p:1214.24,a:7.5},{l:"PRO7263T CINZA PEWTER TEX · 1500×6000",p:1457.09,a:9.0},{l:"PRO7263T CINZA PEWTER TEX · 1500×7000",p:1699.94,a:10.5},{l:"PRO7263T CINZA PEWTER TEX · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO4631T DARK GREY TEX · 1500×5000",p:1214.24,a:7.5},{l:"PRO4631T DARK GREY TEX · 1500×6000",p:1457.09,a:9.0},{l:"PRO4631T DARK GREY TEX · 1500×7000",p:1699.94,a:10.5},{l:"PRO4631T DARK GREY TEX · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO0157T PRETO WXL TEX · 1500×5000",p:1214.24,a:7.5},{l:"PRO0157T PRETO WXL TEX · 1500×6000",p:1457.09,a:9.0},{l:"PRO0157T PRETO WXL TEX · 1500×7000",p:1699.94,a:10.5},{l:"PRO0157T PRETO WXL TEX · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO3316T BRONZE 1002 TEX · 1500×5000",p:1214.24,a:7.5},{l:"PRO3316T BRONZE 1002 TEX · 1500×6000",p:1457.09,a:9.0},{l:"PRO3316T BRONZE 1002 TEX · 1500×7000",p:1699.94,a:10.5},{l:"PRO3316T BRONZE 1002 TEX · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO5062T BRONZE 1003 TEX · 1500×5000",p:1214.24,a:7.5},{l:"PRO5062T BRONZE 1003 TEX · 1500×6000",p:1457.09,a:9.0},{l:"PRO5062T BRONZE 1003 TEX · 1500×7000",p:1699.94,a:10.5},{l:"PRO5062T BRONZE 1003 TEX · 1500×8000",p:1942.79,a:12.0},
    {l:"PRO225T OLIVE GREEN TEX · 1500×5000",p:1214.24,a:7.5},{l:"PRO225T OLIVE GREEN TEX · 1500×6000",p:1457.09,a:9.0},{l:"PRO225T OLIVE GREEN TEX · 1500×7000",p:1699.94,a:10.5},{l:"PRO225T OLIVE GREEN TEX · 1500×8000",p:1942.79,a:12.0},
  ]},
  {g:"PVDF 4300 — WOOD Anti-scratch",seco:1644.90,o:[
    {l:"PRO1277 WOOD AMBAR · 1500×5000",p:1395.72,a:7.5},{l:"PRO1277 WOOD AMBAR · 1500×6000",p:1674.86,a:9.0},{l:"PRO1277 WOOD AMBAR · 1500×7000",p:1954.01,a:10.5},{l:"PRO1277 WOOD AMBAR · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO210 WOOD AMENDOA RUSTICA · 1500×5000",p:1395.72,a:7.5},{l:"PRO210 WOOD AMENDOA RUSTICA · 1500×6000",p:1674.86,a:9.0},{l:"PRO210 WOOD AMENDOA RUSTICA · 1500×7000",p:1954.01,a:10.5},{l:"PRO210 WOOD AMENDOA RUSTICA · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO37729 WOOD CARVALHO MEL · 1500×5000",p:1395.72,a:7.5},{l:"PRO37729 WOOD CARVALHO MEL · 1500×6000",p:1674.86,a:9.0},{l:"PRO37729 WOOD CARVALHO MEL · 1500×7000",p:1954.01,a:10.5},{l:"PRO37729 WOOD CARVALHO MEL · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO37748 WOOD CARVALHO AMERICANO · 1500×5000",p:1395.72,a:7.5},{l:"PRO37748 WOOD CARVALHO AMERICANO · 1500×6000",p:1674.86,a:9.0},{l:"PRO37748 WOOD CARVALHO AMERICANO · 1500×7000",p:1954.01,a:10.5},{l:"PRO37748 WOOD CARVALHO AMERICANO · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO1280 WOOD EBANO · 1500×5000",p:1395.72,a:7.5},{l:"PRO1280 WOOD EBANO · 1500×6000",p:1674.86,a:9.0},{l:"PRO1280 WOOD EBANO · 1500×7000",p:1954.01,a:10.5},{l:"PRO1280 WOOD EBANO · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO828 WOOD EXPRESSO · 1500×5000",p:1395.72,a:7.5},{l:"PRO828 WOOD EXPRESSO · 1500×6000",p:1674.86,a:9.0},{l:"PRO828 WOOD EXPRESSO · 1500×7000",p:1954.01,a:10.5},{l:"PRO828 WOOD EXPRESSO · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO046 WOOD LOURO FREIJÓ · 1500×5000",p:1395.72,a:7.5},{l:"PRO046 WOOD LOURO FREIJÓ · 1500×6000",p:1674.86,a:9.0},{l:"PRO046 WOOD LOURO FREIJÓ · 1500×7000",p:1954.01,a:10.5},{l:"PRO046 WOOD LOURO FREIJÓ · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO004 WOOD MAPLE · 1500×5000",p:1395.72,a:7.5},{l:"PRO004 WOOD MAPLE · 1500×6000",p:1674.86,a:9.0},{l:"PRO004 WOOD MAPLE · 1500×7000",p:1954.01,a:10.5},{l:"PRO004 WOOD MAPLE · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO209 WOOD MOGNO · 1500×5000",p:1395.72,a:7.5},{l:"PRO209 WOOD MOGNO · 1500×6000",p:1674.86,a:9.0},{l:"PRO209 WOOD MOGNO · 1500×7000",p:1954.01,a:10.5},{l:"PRO209 WOOD MOGNO · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO170414 WOOD NOGUEIRA · 1500×5000",p:1395.72,a:7.5},{l:"PRO170414 WOOD NOGUEIRA · 1500×6000",p:1674.86,a:9.0},{l:"PRO170414 WOOD NOGUEIRA · 1500×7000",p:1954.01,a:10.5},{l:"PRO170414 WOOD NOGUEIRA · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO824 WOOD NUT · 1500×5000",p:1395.72,a:7.5},{l:"PRO824 WOOD NUT · 1500×6000",p:1674.86,a:9.0},{l:"PRO824 WOOD NUT · 1500×7000",p:1954.01,a:10.5},{l:"PRO824 WOOD NUT · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO37524 WOOD SUCUPIRA · 1500×5000",p:1395.72,a:7.5},{l:"PRO37524 WOOD SUCUPIRA · 1500×6000",p:1674.86,a:9.0},{l:"PRO37524 WOOD SUCUPIRA · 1500×7000",p:1954.01,a:10.5},{l:"PRO37524 WOOD SUCUPIRA · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO1705252 WOOD CARVALHO BRONZE · 1500×5000",p:1395.72,a:7.5},{l:"PRO1705252 WOOD CARVALHO BRONZE · 1500×6000",p:1674.86,a:9.0},{l:"PRO1705252 WOOD CARVALHO BRONZE · 1500×7000",p:1954.01,a:10.5},{l:"PRO1705252 WOOD CARVALHO BRONZE · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO37730 WOOD CARVALHO MEL COBRE · 1500×5000",p:1395.72,a:7.5},{l:"PRO37730 WOOD CARVALHO MEL COBRE · 1500×6000",p:1674.86,a:9.0},{l:"PRO37730 WOOD CARVALHO MEL COBRE · 1500×7000",p:1954.01,a:10.5},{l:"PRO37730 WOOD CARVALHO MEL COBRE · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO37373 WOOD CASTANHA · 1500×5000",p:1395.72,a:7.5},{l:"PRO37373 WOOD CASTANHA · 1500×6000",p:1674.86,a:9.0},{l:"PRO37373 WOOD CASTANHA · 1500×7000",p:1954.01,a:10.5},{l:"PRO37373 WOOD CASTANHA · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO37375 WOOD CEREJEIRA ESCURA · 1500×5000",p:1395.72,a:7.5},{l:"PRO37375 WOOD CEREJEIRA ESCURA · 1500×6000",p:1674.86,a:9.0},{l:"PRO37375 WOOD CEREJEIRA ESCURA · 1500×7000",p:1954.01,a:10.5},{l:"PRO37375 WOOD CEREJEIRA ESCURA · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO203 WOOD IMBUIA · 1500×5000",p:1395.72,a:7.5},{l:"PRO203 WOOD IMBUIA · 1500×6000",p:1674.86,a:9.0},{l:"PRO203 WOOD IMBUIA · 1500×7000",p:1954.01,a:10.5},{l:"PRO203 WOOD IMBUIA · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO1231 WOOD JATOBÁ · 1500×5000",p:1395.72,a:7.5},{l:"PRO1231 WOOD JATOBÁ · 1500×6000",p:1674.86,a:9.0},{l:"PRO1231 WOOD JATOBÁ · 1500×7000",p:1954.01,a:10.5},{l:"PRO1231 WOOD JATOBÁ · 1500×8000",p:2233.15,a:12.0},
  ]},
  {g:"EURA 4500 — WOOD Nogueira Colonial",seco:2096.06,o:[
    {l:"PRO2007 WOOD NOGUEIRA COLONIAL · 1500×5000",p:2156.15,a:7.5},{l:"PRO2007 WOOD NOGUEIRA COLONIAL · 1500×6000",p:2587.38,a:9.0},{l:"PRO2007 WOOD NOGUEIRA COLONIAL · 1500×7000",p:3018.61,a:10.5},{l:"PRO2007 WOOD NOGUEIRA COLONIAL · 1500×8000",p:3449.83,a:12.0},
  ]},
  {g:"KYNAR 4300 — Corten / Concreto",seco:0,o:[
    {l:"PRO1236 AÇO CORTEN SB · 1500×5000",p:1349.16,a:7.5},{l:"PRO1236 AÇO CORTEN SB · 1500×6000",p:1618.99,a:9.0},{l:"PRO1236 AÇO CORTEN SB · 1500×7000",p:1888.82,a:10.5},{l:"PRO1236 AÇO CORTEN SB · 1500×8000",p:2158.66,a:12.0},
    {l:"PRO2425 CONCRETO BERLIM · 1500×5000",p:1395.72,a:7.5},{l:"PRO2425 CONCRETO BERLIM · 1500×6000",p:1674.86,a:9.0},{l:"PRO2425 CONCRETO BERLIM · 1500×7000",p:1954.01,a:10.5},{l:"PRO2425 CONCRETO BERLIM · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO2391 CONCRETO SHANGAI · 1500×5000",p:1395.72,a:7.5},{l:"PRO2391 CONCRETO SHANGAI · 1500×6000",p:1674.86,a:9.0},{l:"PRO2391 CONCRETO SHANGAI · 1500×7000",p:1954.01,a:10.5},{l:"PRO2391 CONCRETO SHANGAI · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO2372 CORTEN OXIDADO RED FO · 1500×5000",p:1395.72,a:7.5},{l:"PRO2372 CORTEN OXIDADO RED FO · 1500×6000",p:1674.86,a:9.0},{l:"PRO2372 CORTEN OXIDADO RED FO · 1500×7000",p:1954.01,a:10.5},{l:"PRO2372 CORTEN OXIDADO RED FO · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO2374 CORTEN OXIDADO VERMELHO · 1500×5000",p:1395.72,a:7.5},{l:"PRO2374 CORTEN OXIDADO VERMELHO · 1500×6000",p:1674.86,a:9.0},{l:"PRO2374 CORTEN OXIDADO VERMELHO · 1500×7000",p:1954.01,a:10.5},{l:"PRO2374 CORTEN OXIDADO VERMELHO · 1500×8000",p:2233.15,a:12.0},
    {l:"PRO1237 BROWN CORTEN · 1500×5000",p:1473.16,a:7.5},{l:"PRO1237 BROWN CORTEN · 1500×6000",p:1767.79,a:9.0},{l:"PRO1237 BROWN CORTEN · 1500×7000",p:2062.43,a:10.5},{l:"PRO1237 BROWN CORTEN · 1500×8000",p:2357.06,a:12.0},
    {l:"PRO1238 BLACK CORTEN · 1500×5000",p:1473.16,a:7.5},{l:"PRO1238 BLACK CORTEN · 1500×6000",p:1767.79,a:9.0},{l:"PRO1238 BLACK CORTEN · 1500×7000",p:2062.43,a:10.5},{l:"PRO1238 BLACK CORTEN · 1500×8000",p:2357.06,a:12.0},
    {l:"PRO3025 PATINA CORTEN · 1500×5000",p:1473.26,a:7.5},{l:"PRO3025 PATINA CORTEN · 1500×6000",p:1767.92,a:9.0},{l:"PRO3025 PATINA CORTEN · 1500×7000",p:2062.57,a:10.5},{l:"PRO3025 PATINA CORTEN · 1500×8000",p:2357.22,a:12.0},
  ]},
  {g:"EURA 4500 — Corten Texturizado",seco:2212.60,o:[
    {l:"PRO3016G10 EURACORTEN TEX · 1500×5000",p:2275.94,a:7.5},{l:"PRO3016G10 EURACORTEN TEX · 1500×6000",p:2731.13,a:9.0},{l:"PRO3016G10 EURACORTEN TEX · 1500×7000",p:3186.32,a:10.5},{l:"PRO3016G10 EURACORTEN TEX · 1500×8000",p:3641.50,a:12.0},
  ]},
  {g:"BLACK DOOR",seco:0,frete:false,o:[
    {l:"BLACK DOOR · 1500×6000",p:1779.42,a:9.0},{l:"BLACK DOOR · 1500×7000",p:2075.99,a:10.5},{l:"BLACK DOOR · 1500×8000",p:2372.56,a:12.0},
  ]},
  {g:"ALUSENSE — Concreto / Granito",seco:0,o:[
    {l:"AS079 CONCRETO ANTOCATTO · 1250×5000",p:1398.75,a:6.25},{l:"AS079 CONCRETO ANTOCATTO · 1250×6000",p:1678.50,a:7.50},{l:"AS079 CONCRETO ANTOCATTO · 1250×7000",p:1958.25,a:8.75},{l:"AS079 CONCRETO ANTOCATTO · 1250×8000",p:2238.00,a:10.0},
    {l:"AS505 CONCRETO GREY · 1250×5000",p:1398.75,a:6.25},{l:"AS505 CONCRETO GREY · 1250×6000",p:1678.50,a:7.50},{l:"AS505 CONCRETO GREY · 1250×7000",p:1958.25,a:8.75},{l:"AS505 CONCRETO GREY · 1250×8000",p:2238.00,a:10.0},
    {l:"AS505 CONCRETO LIGHT GREY · 1250×5000",p:1398.75,a:6.25},{l:"AS505 CONCRETO LIGHT GREY · 1250×6000",p:1678.50,a:7.50},{l:"AS505 CONCRETO LIGHT GREY · 1250×7000",p:1958.25,a:8.75},{l:"AS505 CONCRETO LIGHT GREY · 1250×8000",p:2238.00,a:10.0},
    {l:"AS616 GRANITO TEXTURIZADO · 1250×5000",p:1398.75,a:6.25},{l:"AS616 GRANITO TEXTURIZADO · 1250×6000",p:1678.50,a:7.50},{l:"AS616 GRANITO TEXTURIZADO · 1250×7000",p:1958.25,a:8.75},{l:"AS616 GRANITO TEXTURIZADO · 1250×8000",p:2238.00,a:10.0},
  ]},
  {g:"ALUSENSE — Wood",seco:0,o:[
    {l:"AS002 WOOD CARVALHO EUROPEU · 1250×5000",p:1398.75,a:6.25},{l:"AS002 WOOD CARVALHO EUROPEU · 1250×6000",p:1678.50,a:7.50},{l:"AS002 WOOD CARVALHO EUROPEU · 1250×7000",p:1958.25,a:8.75},{l:"AS002 WOOD CARVALHO EUROPEU · 1250×8000",p:2238.00,a:10.0},
    {l:"AS042 WOOD CARVALHO LAVADO · 1250×5000",p:1398.75,a:6.25},{l:"AS042 WOOD CARVALHO LAVADO · 1250×6000",p:1678.50,a:7.50},{l:"AS042 WOOD CARVALHO LAVADO · 1250×7000",p:1958.25,a:8.75},{l:"AS042 WOOD CARVALHO LAVADO · 1250×8000",p:2238.00,a:10.0},
    {l:"AS076 WOOD JACARANDÁ · 1250×5000",p:1398.78,a:6.25},{l:"AS076 WOOD JACARANDÁ · 1250×6000",p:1678.54,a:7.50},{l:"AS076 WOOD JACARANDÁ · 1250×7000",p:1958.29,a:8.75},{l:"AS076 WOOD JACARANDÁ · 1250×8000",p:2238.05,a:10.0},
    {l:"AS046 WOOD LOURO FREIJÓ · 1250×5000",p:1398.78,a:6.25},{l:"AS046 WOOD LOURO FREIJÓ · 1250×6000",p:1678.54,a:7.50},{l:"AS046 WOOD LOURO FREIJÓ · 1250×7000",p:1958.29,a:8.75},{l:"AS046 WOOD LOURO FREIJÓ · 1250×8000",p:2238.05,a:10.0},
    {l:"AS003 WOOD MAPLE · 1250×5000",p:1398.75,a:6.25},{l:"AS003 WOOD MAPLE · 1250×6000",p:1678.50,a:7.50},{l:"AS003 WOOD MAPLE · 1250×7000",p:1958.25,a:8.75},{l:"AS003 WOOD MAPLE · 1250×8000",p:2238.00,a:10.0},
  ]},
];
const ALU_DATA=[
  {g:"Alumínio 2,5mm — Sólida / Metalizada",seco:0,frete:false,o:[
    {l:"ALU 2,5mm SÓLIDA · 1500×3000",p:1429.38,a:4.5},{l:"ALU 2,5mm SÓLIDA · 1500×5000",p:2382.30,a:7.5},{l:"ALU 2,5mm SÓLIDA · 1500×6000",p:2858.76,a:9.0},{l:"ALU 2,5mm SÓLIDA · 1500×6600",p:3045.64,a:9.9},
  ]},
  {g:"Alumínio 2,5mm — Madeira",seco:0,frete:false,o:[
    {l:"ALU 2,5mm MADEIRA · 1500×3000",p:2291.87,a:4.5},{l:"ALU 2,5mm MADEIRA · 1500×5000",p:3819.78,a:7.5},{l:"ALU 2,5mm MADEIRA · 1500×6000",p:4583.73,a:9.0},{l:"ALU 2,5mm MADEIRA · 1500×6600",p:4883.37,a:9.9},
  ]},
];

/* ══ SELECT OPTIONS ══════════════════════════════════════ */
function mkOpts(data){
  let h='<option value="0|0">— Selecionar —</option>';
  data.forEach(g=>{
    h+=`<optgroup label="${g.g}">`;
    g.o.forEach(it=>{
      const pf=it.p.toLocaleString('pt-BR',{minimumFractionDigits:2});
      h+=`<option value="${it.p}|${it.a}">${it.l}  ·  R$ ${pf}/chapa</option>`;
    });
    h+='</optgroup>';
  });
  return h;
}
const ACM_OPTS=mkOpts(ACM_DATA);
const ALU_OPTS=mkOpts(ALU_DATA);

function _populateCorSelects(mode){
  // mode: 'acm' (default) = todas as cores ACM | 'alu' = só categorias alumínio maciço
  var html='<option value="">— Selecione —</option>';
  if(mode==='alu'){
    // ALU: mostrar só as 2 categorias (Sólida/Metalizada e Madeira)
    html+='<option value="ALU SOLIDA METALIZADA">Sólida / Metalizada</option>';
    html+='<option value="ALU MADEIRA">Madeira</option>';
  } else {
    var cores={};
    ACM_DATA.forEach(function(g){
      g.o.forEach(function(item){
        var nome=item.l.split('·')[0].trim();
        if(!cores[nome])cores[nome]=g.g;
      });
    });
    var lastGroup='';
    Object.keys(cores).forEach(function(cor){
      var grp=cores[cor];
      if(grp!==lastGroup){
        if(lastGroup)html+='</optgroup>';
        html+='<optgroup label="'+grp+'">';
        lastGroup=grp;
      }
      html+='<option value="'+cor+'">'+cor+'</option>';
    });
    if(lastGroup)html+='</optgroup>';
  }
  var ids=['carac-cor-ext','carac-cor-int','crm-o-cor-ext','crm-o-cor-int'];
  ids.forEach(function(id){var s=document.getElementById(id);if(s){var v=s.value;s.innerHTML=html;if(v)s.value=v;}});
  window._corListaGlobal = mode==='alu'?['ALU SOLIDA METALIZADA','ALU MADEIRA']:Object.keys(cores||{});
  window._corMode=mode||'acm';
}

function _checkCorMode(){
  var modEl=document.getElementById('carac-modelo');
  var mod=modEl?modEl.value:'';
  var revEl=document.getElementById('plan-moldura-rev');
  var rev=revEl?revEl.value:'ACM';
  var isMacico=(mod==='23'&&rev==='MACICO');
  // Sempre manter cor ACM nos selects
  if(window._corMode==='alu') _populateCorSelects('acm');
  // Mostrar/esconder campo Cor Maciço
  var macRow=document.getElementById('carac-cor-macico-row');
  if(macRow) macRow.style.display=isMacico?'':'none';
  window._corMode='acm';
}

/* ══ DYNAMIC BLOCKS ══════════════════════════════════════ */
let aC=0,lC=0;

function addACM(selVal,qty){
  const id=++aC;
  const d=document.createElement('div');
  d.className='cbl';d.id='acm-blk-'+id;
  d.innerHTML=`
    <div class="cbl-top">
      <select id="acm-sel-${id}" onchange="calc()">${acmOptsFiltered(getCurrentPlanSize())}</select>
      <button class="rem-btn" onclick="rm('acm',${id})">×</button>
    </div>
    <div class="cbl-mid">
      <label>Qtd (unidades):</label>
      <input type="number" id="acm-qty-${id}" value="${qty||1}" min="0" step="1" oninput="_syncOrcAcmQty();calc()">
    </div>
    <div class="cbl-bot" id="acm-inf-${id}">
      <span class="ci-p">—</span><span class="ci-a"></span><span class="ci-s"></span>
    </div>`;
  document.getElementById('acm-list').appendChild(d);
  if(selVal) document.getElementById('acm-sel-'+id).value=selVal;
  calc();
}
function addALU(selVal,qty){
  const id=++lC;
  const d=document.createElement('div');
  d.className='cbl';d.id='alu-blk-'+id;
  d.innerHTML=`
    <div class="cbl-top">
      <select id="alu-sel-${id}" onchange="calc()">${ALU_OPTS}</select>
      <button class="rem-btn" onclick="rm('alu',${id})">×</button>
    </div>
    <div class="cbl-mid">
      <label>Qtd (unidades):</label>
      <input type="number" id="alu-qty-${id}" value="${qty||1}" min="0" step="1" oninput="calc()">
    </div>
    <div class="cbl-bot" id="alu-inf-${id}">
      <span class="ci-p">—</span><span class="ci-a"></span><span class="ci-s"></span>
    </div>`;
  document.getElementById('alu-list').appendChild(d);
  if(selVal) document.getElementById('alu-sel-'+id).value=selVal;
  calc();
}
function rm(t,id){document.getElementById(t+'-blk-'+id).remove();calc();}

/* ══ HELPERS ═════════════════════════════════════════════ */
const $=id=>document.getElementById(id);
window.$=$; // Ensure $ is globally accessible
const n=id=>{var v=$(id).value;if(typeof v==='string')v=v.replace(/\./g,'').replace(',','.');return parseFloat(v)||0;};
const brl=v=>'R$ '+Math.round(v).toLocaleString('pt-BR');
const br2=v=>'R$ '+(Math.round(v*100)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const pf=v=>(Math.round(v*10)/10).toFixed(1).replace('.',',')+'%';
const fmtBRL=v=>v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

/* ── Title Case: "RICARDO PORTOLAN ARQ." → "Ricardo Portolan Arq." ── */
function _toTitleCase(str){
  if(!str) return '';
  return str.toLowerCase().replace(/(?:^|\s|\.)\S/g, function(c){return c.toUpperCase();});
}

/* ══ END MODULE: SHARED ══ */
