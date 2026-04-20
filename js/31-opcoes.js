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

  var VERSION = '1.3';

  // Campos derivados dos itens (primeiro item) que precisam ser espelhados
  // no nível do card pra compatibilidade com leitores legados (proposta,
  // planificador, etc). Cada opção tem seus PRÓPRIOS valores desses campos.
  // Quando troca de opção, esses campos são re-espelhados pro card.
  var ITEM_DERIVED_FIELDS = [
    'largura','altura','modelo','abertura','folhas',
    'cor_ext','cor_int','cor_macico','moldura_rev'
  ];

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

      // Backfill itens: se a opção ativa ainda não tem itens próprios mas o card
      // sim (primeira migração do schema v1.0 → v1.1), copiar do card pra opção.
      var atual = ativa(card);
      if(atual && !Array.isArray(atual.itens) && Array.isArray(card.itens)){
        atual.itens = card.itens;
        ITEM_DERIVED_FIELDS.forEach(function(f){
          if(card[f] !== undefined && atual[f] === undefined) atual[f] = card[f];
        });
      }

      // ★ Backfill paramsFinanceiros (v1.2 — Felipe 20/04):
      //   Opções criadas antes do commit cd8d4fd não têm paramsFinanceiros.
      //   Procurar entre todas as opções a primeira que tenha (direto na
      //   opção ou na última rev dela) e propagar pras que não têm.
      //   Isso garante que TODAS as opções respeitem os params da Opção 1.
      var paramsCanonical = null;
      for(var pi=0; pi<card.opcoes.length; pi++){
        var op = card.opcoes[pi];
        if(op.paramsFinanceiros){ paramsCanonical = op.paramsFinanceiros; break; }
        if(Array.isArray(op.revisoes)){
          for(var ri=op.revisoes.length-1; ri>=0; ri--){
            if(op.revisoes[ri] && op.revisoes[ri].paramsFinanceiros){
              paramsCanonical = op.revisoes[ri].paramsFinanceiros;
              break;
            }
          }
          if(paramsCanonical) break;
        }
      }
      if(paramsCanonical){
        card.opcoes.forEach(function(op){
          if(!op.paramsFinanceiros){
            op.paramsFinanceiros = Object.assign({}, paramsCanonical);
          }
        });
      }

      // ★ Limpeza retroativa v1.3 (Felipe 20/04 — "opção nova vem travada"):
      //   novaOpcao antigo copiava a última rev da origem como placeholder
      //   na nova opção. Isso disparava o lock automático imediatamente.
      //   Detectar essas revisões-fantasma e remover:
      //     - rev.duplicadoDe existe (marcada como cópia duplicada)
      //     - AND rev.freezeKey ausente (nunca foi realmente congelada)
      //   Depois dessa limpeza, a opção volta a estar editável.
      card.opcoes.forEach(function(op){
        if(!Array.isArray(op.revisoes) || !op.revisoes.length) return;
        op.revisoes = op.revisoes.filter(function(rv){
          var ehFantasma = rv && rv.duplicadoDe && !rv.freezeKey;
          return !ehFantasma;
        });
      });

      sincronizar(card);
      return card;
    }

    // Caminho B: card legado — wrap em opt1 com itens + campos derivados
    var opt1 = {
      id:       'opt1',
      label:    'Opção 1',
      revisoes: Array.isArray(card.revisoes) ? card.revisoes : [],
      itens:    Array.isArray(card.itens) ? card.itens : [],
      criadoEm: card.createdAt || new Date().toISOString()
    };
    ITEM_DERIVED_FIELDS.forEach(function(f){
      if(card[f] !== undefined) opt1[f] = card[f];
    });
    card.opcoes = [opt1];
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
  // sincronizar: card.revisoes e card.itens APONTAM (por referência)
  // pros arrays da opção ativa. Mutações via card.* = mutações na opção.
  // Campos derivados (modelo, largura, etc) são COPIADOS pro card pra
  // leitores legados enxergarem o valor da opção ativa.
  // ───────────────────────────────────────────────────────────────
  function sincronizar(card){
    var a = ativa(card);
    if(a){
      if(!Array.isArray(a.revisoes)) a.revisoes = [];
      if(!Array.isArray(a.itens))    a.itens    = [];
      card.revisoes = a.revisoes;
      card.itens    = a.itens;
      // Espelha campos derivados pra o card (leitores legados)
      ITEM_DERIVED_FIELDS.forEach(function(f){
        card[f] = (a[f] !== undefined) ? a[f] : '';
      });
    }
    return card;
  }

  // ───────────────────────────────────────────────────────────────
  // persistir: antes de serializar, puxa card.revisoes, card.itens e
  // campos derivados pra opção ativa. Necessário se alguém reatribuiu
  // card.* = [...] em vez de mutar a referência.
  // ───────────────────────────────────────────────────────────────
  function persistir(card){
    var a = ativa(card);
    if(a){
      if(Array.isArray(card.revisoes)) a.revisoes = card.revisoes;
      if(Array.isArray(card.itens))    a.itens    = card.itens;
      ITEM_DERIVED_FIELDS.forEach(function(f){
        if(card[f] !== undefined) a[f] = card[f];
      });
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
  // novaOpcao: cria uma opção nova vazia (sem revisões) com os ITENS
  // clonados da opção origem pra servirem como template editável.
  //
  // Felipe 20/04: "opção nova é NOVA, deve trazer tudo da original
  // mas editável". Se copiássemos a última revisão, o lock automático
  // travava a opção nova — usuário não conseguia editar nada.
  //
  // Comportamento: a nova opção vira a opção ativa. Felipe edita à
  // vontade (modelo, cores, dimensões). Quando clicar Orçamento Pronto,
  // a PRIMEIRA revisão é criada aí — aí sim trava.
  // ───────────────────────────────────────────────────────────────
  function novaOpcao(card, label){
    if(!card) return null;
    migrar(card);
    persistir(card);

    var novoId = _nextOpcaoId(card);
    var n      = card.opcoes.length + 1;
    var lbl    = (label && String(label).trim()) || ('Opção '+n);
    var atual  = ativa(card);

    // ★ CRÍTICO (Felipe 20/04 — bug "opção nova vem travada"):
    //   DEEP-CLONE dos itens da opção origem servem como TEMPLATE editável.
    //   Sem clone: mesma referência vazaria edições entre opções.
    //   Novo ID por item evita conflito de DOM quando se abre o modal.
    var clonedItens = [];
    if(atual && Array.isArray(atual.itens) && atual.itens.length){
      clonedItens = JSON.parse(JSON.stringify(atual.itens));
      clonedItens.forEach(function(it){
        if(it && typeof it === 'object'){
          it.id = 'it-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
        }
      });
    }

    var nova = {
      id:       novoId,
      label:    lbl,
      revisoes: [], // ★ SEM revisões — nasce editável. Primeira rev cria em Orçamento Pronto.
      itens:    clonedItens,
      criadoEm: new Date().toISOString()
    };
    // Copia campos derivados da origem pra nova opção (largura, altura,
    // modelo, cor etc servem como valor inicial — podem ser editados)
    ITEM_DERIVED_FIELDS.forEach(function(f){
      if(atual && atual[f] !== undefined) nova[f] = atual[f];
      else if(card[f] !== undefined) nova[f] = card[f];
    });

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
