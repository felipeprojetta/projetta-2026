/* 08-helpers.js — helpers globais de UI usados por varios modulos.
   - fmtBR / fmtNum: formatacao numerica BR (R01: 2 casas decimais)
   - parseBR: aceita "1,55" ou "1.55" ou Number puro (R05)
   - escapeHtml: sanitizacao de strings em templates HTML
   - debounce: throttling de inputs/eventos
   - showSavedDialog: popup "Salvo com sucesso!" (R07, exposto em window)
   - createSaveButton: fabrica de botao "Salvar Alteracoes" (R07, exposto em window)

   Originalmente estavam dentro de (function CadastrosModule() {})() —
   foram extraidos pra escopo global pra que cada modulo separado os use. */

/* ---------- helpers ---------- */
// PADRAO DO SISTEMA: SEMPRE 2 casas decimais. Sem excecoes.
const fmtBR = (n) => {
  if (n === '' || n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
// Felipe (do doc - msg "todos campos 0,00 deixe vazio"): variante do fmtBR
// que retorna STRING VAZIA em vez de '—' quando o valor e' vazio/null/zero.
// Usar em <input value="..."> pra que campos vazios fiquem MESMO vazios
// (assim o auto-empty-marker pinta de laranja).
const fmtBROrEmpty = (n) => {
  if (n === '' || n === null || n === undefined || isNaN(n)) return '';
  // Numero zero tambem fica vazio (Felipe: "todos campos que vem 00,00 deixe vazio")
  if (Number(n) === 0) return '';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtNum = (n) => {
  if (n === '' || n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
// Aceita "1,55" (BR), "1.55" (numero JS), "1.234,56" (BR com milhar) ou um Number puro
const parseBR = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  // Se ja e number, so arredonda
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  const s = String(val).trim();
  let clean;
  if (s.includes(',')) {
    // Tem virgula: assume formato BR. Pontos sao separadores de milhar.
    clean = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Sem virgula: numero formato JS/EN (ponto e decimal). Mantem como esta.
    clean = s;
  }
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
};
/**
 * Felipe (do doc): permitir digitar expressoes simples como "9+5" no
 * campo de horas e o sistema retornar 14. Suporta + - * / e parenteses,
 * com numeros em formato BR (1,5) ou EN (1.5).
 *
 * Seguro: regex valida que a string SO tem digitos, operadores e
 * espacos. Sem letras, sem chamadas de funcao. Usa Function() em vez
 * de eval direto pra contexto isolado.
 *
 * Uso: parseBRExpr("9+5") = 14 ; parseBRExpr("2,5*3") = 7.5 ; parseBRExpr("5,5") = 5.5
 */
const parseBRExpr = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  const s = String(val).trim();
  if (!s) return 0;
  // Se nao tem operador alem de ponto/virgula, cai no parseBR normal
  if (!/[+\-*/]/.test(s.replace(/^-/, ''))) return parseBR(s);
  // Normaliza: virgula → ponto. Remove pontos de milhar (sequencias de
  // 3+ digitos seguidos por ponto + 3 digitos no meio do numero).
  // Pra simplificar: troca virgula por ponto. Pontos sao decimal.
  let expr = s.replace(/,/g, '.');
  // Sanitiza: aceita SO digitos, ponto, operadores, parenteses, espaco
  if (!/^[\d+\-*/(). ]+$/.test(expr)) return parseBR(val);
  try {
    // Function isolado — sem acesso a window/this
    const result = (new Function(`"use strict"; return (${expr});`))();
    if (typeof result === 'number' && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
  } catch (e) {
    // Expressao invalida (ex: '9++5', '9+', '(9+5'), cai no parse normal
  }
  return parseBR(val);
};
const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/* ============================================================
   HELPERS UNIVERSAIS DE UI (regras R07 e similares)
   ============================================================ */

/* showSavedDialog() — popup bloqueante "Salvo com sucesso!"
   Usado por TODOS os modulos no clique do botao "Salvar Alteracoes".
   Aplica a regra universal R07: o usuario precisa ver e fechar
   a confirmacao para ter certeza que os dados foram persistidos. */
function showSavedDialog(message) {
  const msg = message || 'Alteracoes salvas com sucesso!';
  // Cria overlay se ainda nao existe
  let overlay = document.getElementById('univ-saved-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'univ-saved-overlay';
    overlay.className = 'univ-saved-overlay';
    overlay.innerHTML = `
      <div class="univ-saved-dialog" role="alertdialog" aria-modal="true">
        <div class="univ-saved-icon">✓</div>
        <div class="univ-saved-title">Salvo</div>
        <div class="univ-saved-msg" id="univ-saved-msg"></div>
        <button class="univ-saved-btn" id="univ-saved-ok">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.querySelector('#univ-saved-msg').textContent = msg;
  overlay.classList.add('is-open');
  const btnOk = overlay.querySelector('#univ-saved-ok');
  const close = () => overlay.classList.remove('is-open');
  btnOk.onclick = close;
  // ESC tambem fecha
  const onEsc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);
  // Foca no botao OK pra usuario poder dar Enter
  setTimeout(() => btnOk.focus(), 50);
}

/* createSaveButton(opts) — fabrica de botao "Salvar Alteracoes"
   Aplica a regra universal R07. Retorna um elemento <button>
   configurado: verde quando "tudo salvo", laranja pulsante quando
   ha alteracoes pendentes. Use setDirty(true|false) pra alternar.
   Quando clicado, chama opts.onSave() e dispara showSavedDialog(). */
function createSaveButton(opts) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn univ-btn-save';
  btn.id = opts && opts.id ? opts.id : 'btn-save-' + Math.random().toString(36).slice(2,7);
  btn.textContent = '✓ Tudo salvo';
  let dirty = false;
  btn.setDirty = (val) => {
    dirty = !!val;
    if (dirty) {
      btn.classList.add('is-dirty');
      btn.textContent = '💾 Salvar Alteracoes';
    } else {
      btn.classList.remove('is-dirty');
      btn.textContent = '✓ Tudo salvo';
    }
  };
  btn.isDirty = () => dirty;
  btn.addEventListener('click', () => {
    try {
      if (opts && typeof opts.onSave === 'function') opts.onSave();
    } finally {
      btn.setDirty(false);
      showSavedDialog((opts && opts.savedMessage) || 'Alteracoes salvas com sucesso!');
    }
  });
  return btn;
}

// Expoe os helpers universais em window para uso por outros modulos
if (typeof window !== 'undefined') {
  window.fmtBR = fmtBR;
  window.fmtBROrEmpty = fmtBROrEmpty;
  window.fmtNum = fmtNum;
  window.parseBR = parseBR;
  window.escapeHtml = escapeHtml;
  window.debounce = debounce;
  window.showSavedDialog = showSavedDialog;
  window.createSaveButton = createSaveButton;
}
