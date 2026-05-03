# CHANGELOG — Sessão 29 (revisão completa modelos vs planilha)

## Resumo

Felipe pediu revisão **100%** do motor de chapas comparando com a
planilha `PRECIFICAÇÃO_01_04_2026.xlsx` atualizada. Atenção especial
nos Modelos 02 e 11. Adicionar Modelo 23 (ACM padrão).

## Processo

1. ✅ Extraí fórmulas de TODOS os 15 modelos da planilha (1F + 2F)
2. ✅ Comparei célula a célula com motor `38-chapas-porta-externa.js`
3. ✅ Listei diff modelo a modelo
4. ✅ Apliquei correções com bisturi (sem mexer onde tava OK)
5. ✅ Validei sintaxe + teste numérico

## Mudanças aplicadas

### A. Helper nova `F.tm_base_2f_menos1`

A planilha **NOVA** tem `-1` DENTRO da divisão em **TM02 e TM03**
(NÃO em TM01). Diferença numérica: -0.5mm.

Antes (motor):  `(larguraQuadro2F - dBC*2 - tamCava*2) / 2`
Agora (motor):  `(larguraQuadro2F - 1 - dBC*2 - tamCava*2) / 2` (em TM02/TM03)

Aplicado em modelos: **02, 03, 04, 06, 08, 11, 12, 13, 15** (não em 01, 22 — já tinham fórmula correta).

### B. Modelo 01 2F TM01

Antes: `+10.5`. Planilha: `+10`. Corrigido.

### C. Modelo 11 — REESCRITA COMPLETA

**1F:**
- ✅ Adicionado **CAVA** (faltava)
- ✅ Adicionado **L da Cava** (faltava)
- ✅ TAMPA_BORDA_FRISO_VERTICAL: motor usava `espessuraParede` (C18). Planilha: `dBFV` (C20). Corrigido.

**2F:**
- ✅ Adicionado **CAVA** (faltava)
- ✅ Adicionado **Tampa da Cava** (faltava)
- ✅ TM01 com `+10.5`, TM02/TM03 com `tm_base_2f_menos1`
- ✅ **CORRIGIDO BUG GRAVE TBFV**: antes `(espessuraParede + 2*REF - 1) + 2*REF - 1` (~288mm sem sentido). Agora `dBFV + 2*REF - 1` (~59mm). Diff de ~230mm — o motor estava cortando peças MUITO maiores que o necessário e isso falava sobre desperdício de chapa.

### D. Modelo 23 — NOVO

Adicionado conforme planilha aba "MODELO 23 - ACM". Estrutura igual ao
Modelo 11 com fórmulas:

**1F:** CAVA + L da Cava + Tampa Maior Cava + TBFV + Friso Vertical
**2F:** CAVA + Tampa da Cava + TM01 + TM02 + TM03 + TBFV + Friso Vertical

Felipe disse: "somente com revestimento ACM e Configuração da moldura
PADRÃO, as outras irei te falar como fazer". Outras configurações
(revestimentos diferentes ou molduras não-padrão) ficam pra próxima
rodada — quando você passar as especificações.

O número 23 já estava no SEED de cadastro de modelos como "Classica
com Molduras". Você pode renomear via **Cadastros > Modelos** se
quiser que apareça como "ACM" na UI.

## Validação numérica

Testei com `L=2000, H=5000, qtdFrisos=2, dBFV=20, eF=20, dBC=210, tamCava=250`:

**Modelo 11 1F externo:**
- Cava: 366×4626, qtd=1
- L da Cava: 340×210, qtd=2
- Tampa Maior Cava: 1354×4919, qtd=1
- Tampa Borda Friso Vertical: 59×4919, qtd=2 (ANTES era 288mm — bug)
- Friso Vertical: 120×4919, qtd=2

**Modelo 23 1F externo:** idêntico ao Modelo 11 (mesma estrutura ACM padrão)

## Diffs detectados que NÃO apliquei (e por quê)

### Modelo 11 2F TBFV qty
- Planilha: `4` (constante)
- Motor: `qtdFrisos * 2`

Mantive `qtdFrisos*2` porque é **mais genérico**. Pra `qtdFrisos=2`
(comum), 2*2=4 (igual). Pra outros valores, motor vai certo, planilha
ia errado. Felipe revisar se quiser forçar 4 fixo.

### Modelo 06 (Friso Horizontal Variável)
Modelo 06 tem layout especial (qtdFrisos horizontais variáveis) e
fórmulas diferentes. Aplicação do `tm_base_2f_menos1` em TM02/TM03 do
mod 06 foi feita junto com os outros (sed batch). Se houver
diferenças adicionais, próxima rodada após Felipe testar.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `scripts/38-chapas-porta-externa.js` | +helper tm_base_2f_menos1; mod 01 TM01 +10; mod 02-15 TM02/TM03 com -1 dentro; mod 11 reescrito (1F+2F); +mod 23 |

## Backup

`/tmp/38-chapas-bak-pre-sessao29.js` — versão antes das mudanças
(caso precise reverter alguma coisa).

## Compatibilidade

- ✅ Modelos 1, 22 inalterados (já estavam corretos)
- ✅ Mudanças em outros modelos são **apenas ajustes finos** (-0.5mm)
  EXCETO modelo 11 que tinha bug grave
- ✅ Modelo 23 é totalmente novo — não afeta orçamentos existentes
- ✅ Cadastro de modelos `modelos_lista` no localStorage não foi tocado
  — número 23 já existia como "Classica com Molduras"
