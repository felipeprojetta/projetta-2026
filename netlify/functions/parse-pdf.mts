export default async (req: Request) => {
  try {
    const body = await req.json();
    if (!body.base64) {
      return new Response(JSON.stringify({ error: "base64 required" }), { status: 400 });
    }

    // Import pdf-parse dynamicamente
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = Buffer.from(body.base64, "base64");
    const data = await pdfParse(buffer);
    const text = data.text || "";

    const info: any = { largura: "", altura: "", modelo: "", cor: "", fechaduraDigital: "", textoCompleto: text.substring(0, 500) };

    // Dimensoes: 1300x2600
    const mDim = text.match(/(\d{3,5})\s*[xX×]\s*(\d{3,5})/);
    if (mDim) { info.largura = mDim[1]; info.altura = mDim[2]; }

    // Modelo: numero de 1-2 digitos apos "MODELO"
    const mMod = text.match(/MODELO[:\s]+(\d{1,2})/i);
    if (mMod) info.modelo = mMod[1];

    // Cor: "COR PORTA:" ou "COR CHAPA EXTERNA:" etc
    const mCor = text.match(/COR\s*(?:PORTA|CHAPA\s*(?:EXTERNA)?)?[:\s]+(PRO\w*\s*[-–]\s*[^\n]{3,40})/i);
    if (mCor) info.cor = mCor[1].trim();
    if (!info.cor) {
      const mCor2 = text.match(/(PRO\d{3,5}\w*\s*[-–]\s*[^\n]{3,40})/i);
      if (mCor2) info.cor = mCor2[1].trim();
    }

    // Fechadura digital
    const mFech = text.match(/FECHADURA\s*DIGITAL[:\s]+([^\n]{3,30})/i);
    if (mFech) {
      const fd = mFech[1].toUpperCase();
      info.fechaduraDigital = (fd.includes("NAO") || fd.includes("NÃO") || fd.includes("APLICA")) ? "nao" : "sim";
    }

    return new Response(JSON.stringify(info), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const config = {
  path: "/api/parse-pdf"
};
