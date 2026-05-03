// Netlify Function: recebe PDF base64, extrai texto com pdf-parse, retorna campos
import pdf from 'pdf-parse/lib/pdf-parse.js';

export default async (req) => {
  try {
    const body = await req.json();
    if (!body.base64) return new Response(JSON.stringify({error:'base64 required'}), {status:400});

    const buffer = Buffer.from(body.base64, 'base64');
    const data = await pdf(buffer);
    const text = data.text || '';

    // Parsear campos do checklist Projetta
    const info = { largura:'', altura:'', modelo:'', cor:'', fechaduraDigital:'', textoCompleto: text.substring(0, 500) };

    // Dimensoes: 1300x2600
    const mDim = text.match(/(\d{3,5})\s*[xX×]\s*(\d{3,5})/);
    if (mDim) { info.largura = mDim[1]; info.altura = mDim[2]; }

    // O PDF tem valores soltos apos os labels. Estrategia: buscar por posicao.
    // Apos "1300x2600" e o texto de observacoes, o proximo numero de 1-2 digitos e o modelo
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Encontrar indice da dimensao
    let dimIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^\d{3,5}[xX×]\d{3,5}$/)) { dimIdx = i; break; }
    }
    
    // Apos dimensao: pular observacoes, encontrar modelo (1-2 digitos solto)
    if (dimIdx >= 0) {
      for (let i = dimIdx + 1; i < Math.min(dimIdx + 10, lines.length); i++) {
        if (lines[i].match(/^\d{1,2}$/) && parseInt(lines[i]) >= 1 && parseInt(lines[i]) <= 24) {
          info.modelo = lines[i];
          // Proximo: representante (pular), depois cliente (pular), depois cor
          // Cor e a linha com PRO ou codigo de cor
          for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
            if (lines[j].match(/^PRO|^RAL|^WOOD|PRETO|BRANCO|MOGNO/i)) {
              info.cor = lines[j];
              break;
            }
          }
          break;
        }
      }
    }

    // Fechadura digital: procurar "NÃO SE APLICA" ou "SIM" apos a cor
    const fechIdx = text.toUpperCase().indexOf('FECHADURA DIGITAL');
    if (fechIdx >= 0) {
      // Buscar nas linhas de valores (que vem depois dos labels)
      const afterCor = info.cor ? text.indexOf(info.cor) : -1;
      if (afterCor >= 0) {
        const rest = text.substring(afterCor + info.cor.length).trim();
        const firstLine = rest.split('\n')[0].trim().toUpperCase();
        info.fechaduraDigital = (firstLine.includes('NAO') || firstLine.includes('NÃO') || firstLine.includes('APLICA')) ? 'nao' : 'sim';
      }
    }

    return new Response(JSON.stringify(info), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch(e) {
    return new Response(JSON.stringify({error: e.message}), {status:500});
  }
};

export const config = { path: '/api/parse-pdf' };
