/* ═══════════════════════════════════════════════════════════════════════════
   ORCAMENTO OPCOES — Múltiplas opções dentro de um mesmo card CRM (v1.0)

   Felipe (20/04/2026): "preciso dentro de um card me permita ter duas
   opções dentro dele mesmo, cliente pode pedir modelo 1 e modelo 2 ou
   cor X ou Y. Dentro de cada opção ter seus orçamentos originais e
   suas revisões."

   ═══════════════════════════════════════════════════════════════════════════

   ESTRUTURA DE DADOS:

   Antes:
     card = { id, cliente, ..., revisoes: [ {label, freezeKey, ...}, ... ] }

   Depois:
     card = {
       id, cliente, ...,
       opcoes: [
         { id:'opt1', label:'Opção 1', revisoes: [ ... ], criadoEm: ISO },
         { id:'opt2', label:'Opção 2 (Modelo 23 Bronze)', revisoes: [ ... ] }
       ],
       opcaoAtivaId: 'opt1',
       revisoes: <mesma ref de opcoes[ativa].revisoes>
     }

   TRUQUE DE COMPAT: `card.revisoes` continua existindo apontando (por
   REFERÊNCIA, não cópia) para `opcoes[ativa].revisoes`. Todo código
   legado que lê/escreve `card.revisoes` continua funcionando — opera
   sempre na opção ativa.

   CHAVE DE FREEZE:
   - opt1 (opção padrão / cards migrados) → formato ANTIGO:
       freeze_<cardId>_rev<N>      (zero migração no Supabase)
   - opt2+ → formato NOVO:
       freeze_<cardId>_<optId>_rev<N>

   API:
     window.OrcamentoOpcoes = {
       version,
       migrar(card)               // garante opcoes[], idempotente
       ativa(card)                // retorna a opção ativa
       indexAtiva(card)           // índice da opção ativa
       sincronizar(card)          // card.revisoes ← opcoes[ativa].revisoes
       persistir(card)            // opcoes[ativa].revisoes ← card.revisoes
       trocar(card, opcaoId)      // muda opcaoAtivaId e sincroniza
       novaOpcao(card, label)     // cria opção duplicando última rev
       removerOpcao(card, id)     // remove (não permite remover a única)
       freezeKey(cardId, opcaoId, revNum)
     }
   ═══════════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  var VERSION = '1.0';

  // ───────────────────────────────────────────────────────────────
  // Gerador de IDs sequenciais: opt1, opt2, opt3...
  // Legíveis em logs e no Supabase (ao contrário de UUIDs longos).
  // ───────────────────────────────────────────────────────────────
  function _nextOpcaoId(card){
    var used = {};
    (card.opcoes||[]).forEach(function(o){ used[o.id] = 1; });
    var n = 1;
    while(used['opt'+n]) n++;
    return 'opt'+n;
  }

  // ───────────────────────────────────────────────────────────────
  // migrar: idempotente. Garante que o card tem estrutura opcoes[].
  // Se já tem, só corrige opcaoAtivaId (caso referencie opção removida)
  // e re-sincroniza card.revisoes.
  // ───────────────────────────────────────────────────────────────
  function migrar(card){
    if(!card) return card;

    // Caminho A: já tem opcoes válido
    if(Array.isArray(card.opcoes) && card.opcoes.length > 0){
      var idOk = card.opcaoAtivaId &&
                 card.opcoes.some(function(o){return o.id===card.opcaoAtivaId;});
      if(!idOk) card.opcaoAtivaId = card.opcoes[0].id;
      sincronizar(card);
      return card;
    }

    // Caminho B: card legado — wrap card.revisoes em opt1
    card.opcoes = [{
      id:       'opt1',
      label:    'Opção 1',
      revisoes: Array.isArray(card.revisoes) ? card.revisoes : [],
      criadoEm: card.createdAt || new Date().toISOString()
    }];
    card.opcaoAtivaId = 'opt1';
    sincronizar(card);
    return card;
  }

  function ativa(card){
    if(!card || !Array.isArray(card.opcoes) || !card.opcoes.length) return null;
    return card.opcoes.find(function(o){return o.id===card.opcaoAtivaId;}) ||
           card.opcoes[0];
  }

  function indexAtiva(card){
    if(!card || !Array.isArray(card.opcoes) || !card.opcoes.length) return -1;
    var i = card.opcoes.findIndex(function(o){return o.id===card.opcaoAtivaId;});
    return i >= 0 ? i : 0;
  }

  // ───────────────────────────────────────────────────────────────
  // sincronizar: card.revisoes APONTA (por referência) pro array da
  // opção ativa. Mutações em card.revisoes são mutações na opção.
  // ───────────────────────────────────────────────────────────────
  function sincronizar(card){
    var a = ativa(card);
    if(a){
      if(!Array.isArray(a.revisoes)) a.revisoes = [];
      card.revisoes = a.revisoes;
    }
    return card;
  }

  // ───────────────────────────────────────────────────────────────
  // persistir: antes de serializar, garante que opcoes[ativa].revisoes
  // contém o conteúdo de card.revisoes. Necessário quando alguém
  // REATRIBUI card.revisoes = [...] (quebra a referência compartilhada).
  // ───────────────────────────────────────────────────────────────
  function persistir(card){
    var a = ativa(card);
    if(a && Array.isArray(card.revisoes)){
      a.revisoes = card.revisoes;
    }
    return card;
  }

  function trocar(card, opcaoId){
    if(!card || !Array.isArray(card.opcoes)) return card;
    persistir(card);
    var o = card.opcoes.find(function(o){return o.id===opcaoId;});
    if(!o) return card;
    card.opcaoAtivaId = opcaoId;
    sincronizar(card);
    return card;
  }

  // ───────────────────────────────────────────────────────────────
  // novaOpcao: cria uma opção nova duplicando SÓ a última revisão
  // da opção ativa (decisão Felipe 20/04/2026). A nova opção vira
  // a opção ativa. ATENÇÃO: o freezeKey da rev duplicada fica
  // pendente — o caller precisa copiar o freeze no Supabase e
  // atribuir o novo freezeKey à rev retornada.
  // ───────────────────────────────────────────────────────────────
  function novaOpcao(card, label){
    if(!card) return null;
    migrar(card);
    persistir(card);

    var novoId = _nextOpcaoId(card);
    var n      = card.opcoes.length + 1;
    var lbl    = (label && String(label).trim()) || ('Opção '+n);
    var atual  = ativa(card);
    var ultima = atual && Array.isArray(atual.revisoes) && atual.revisoes.length
                 ? atual.revisoes[atual.revisoes.length-1]
                 : null;

    var revs = [];
    if(ultima){
      // Clone profundo pra não compartilhar refs.
      var nv = JSON.parse(JSON.stringify(ultima));
      nv.label       = 'Original';
      nv.rev         = 0;
      nv.data        = new Date().toISOString();
      nv.duplicadoDe = {
        opcaoId: atual.id,
        revNum:  atual.revisoes.length-1,
        freezeKeyOriginal: ultima.freezeKey || null
      };
      // freezeKey NÃO é preenchida aqui — o caller precisa copiar o
      // freeze no Supabase antes e gravar a chave nova.
      delete nv.freezeKey;
      delete nv.freezeDate;
      delete nv.freezeVersion;
      revs.push(nv);
    }

    var nova = {
      id:       novoId,
      label:    lbl,
      revisoes: revs,
      criadoEm: new Date().toISOString()
    };
    card.opcoes.push(nova);
    card.opcaoAtivaId = novoId;
    sincronizar(card);
    return nova;
  }

  function removerOpcao(card, opcaoId){
    if(!card || !Array.isArray(card.opcoes) || card.opcoes.length <= 1) return false;
    var i = card.opcoes.findIndex(function(o){return o.id===opcaoId;});
    if(i < 0) return false;
    card.opcoes.splice(i,1);
    if(card.opcaoAtivaId === opcaoId){
      card.opcaoAtivaId = card.opcoes[0].id;
    }
    sincronizar(card);
    return true;
  }

  // ───────────────────────────────────────────────────────────────
  // freezeKey: gera a chave de Supabase.
  // - opt1 → formato antigo (compat com freezes existentes)
  // - opt2+ → formato novo com optId embutido
  // ───────────────────────────────────────────────────────────────
  function freezeKey(cardId, opcaoId, revNum){
    if(!opcaoId || opcaoId === 'opt1') return 'freeze_'+cardId+'_rev'+revNum;
    return 'freeze_'+cardId+'_'+opcaoId+'_rev'+revNum;
  }

  window.OrcamentoOpcoes = {
    version:      VERSION,
    migrar:       migrar,
    ativa:        ativa,
    indexAtiva:   indexAtiva,
    sincronizar:  sincronizar,
    persistir:    persistir,
    trocar:       trocar,
    novaOpcao:    novaOpcao,
    removerOpcao: removerOpcao,
    freezeKey:    freezeKey
  };

  console.log('[OrcamentoOpcoes] v'+VERSION+' carregado');
})();
