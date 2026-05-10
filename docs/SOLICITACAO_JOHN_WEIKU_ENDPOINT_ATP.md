# SOLICITAÇÃO PARA JOHN (TI Weiku) — Endpoint ATP (Contrato)

**Data:** 10/05/2026
**De:** Felipe (Projetta)
**Para:** John (TI Weiku)
**Assunto:** Endpoint para puxar dados de Contrato (ATP) — igual ao que já existe pra Reservas

---

## CONTEXTO

Estamos desenvolvendo o **Projetta v7** (sistema interno de gestão de produção e CRM). Hoje já temos integração com o Weiku para puxar dados de **Reservas** automaticamente (via WeikuAPI já fornecida).

Agora precisamos da **mesma estrutura** para puxar dados de **Contratos (ATP/Pedidos)**, pra alimentar a aba "ATP" dentro do card do trabalho no Projetta sem digitação manual.

---

## O QUE QUEREMOS

Um endpoint REST que receba o **número do ATP** (ex: `ATP000406`) e retorne um **JSON** com os dados do contrato, equivalente ao que vocês já fazem pra Reservas.

```
GET /api/contrato/{numero_atp}
GET /api/contrato/ATP000406
```

Ou seguindo o padrão da WeikuAPI atual (intranet.weiku.com.br), o que for mais fácil pra vocês.

---

## CAMPOS NECESSÁRIOS NO RETORNO

Esses são os campos que precisamos puxar do contrato. Já temos eles preenchidos manualmente na nossa aba ATP — agora queremos vir automático.

### Dados Principais do Pedido

| Campo Projetta | Descrição | Exemplo |
|---|---|---|
| `numero_atp` | Número do contrato | `ATP000406` |
| `numero_agp` | Número do orçamento vinculado | `AGP004125` |
| `numero_reserva` | Número da reserva | `140060` |
| `data_fechamento_contrato` | Data fechamento contrato | `2026-04-15` |
| `data_assinatura_contrato` | Data assinatura contrato | `2026-04-20` |
| `numero_garantia` | Número da garantia | (texto) |
| **`prazo_entrega_dias`** | **Prazo de entrega em dias** ⭐ | `90` |

> ⭐ **CRÍTICO:** o `prazo_entrega_dias` é o que mais precisamos. Hoje a gente assume 90 dias default, mas o real varia por contrato. Este campo determina toda a programação de produção.

### Dados do Comprador (conforme contrato)

| Campo | Descrição |
|---|---|
| `nome_contrato` | Nome completo no contrato (pode ser diferente do orçamento) |
| `cpf_cnpj` | CPF ou CNPJ |
| `rg_ie` | RG ou Inscrição Estadual |
| `email_contrato` | Email cadastrado no contrato |
| `telefone_contrato` | Telefone do comprador |

### Endereço de Cobrança

| Campo |
|---|
| `cobranca_cep` |
| `cobranca_logradouro` |
| `cobranca_numero` |
| `cobranca_complemento` |
| `cobranca_bairro` |
| `cobranca_cidade` |
| `cobranca_estado` |

### Endereço de Entrega (Obra)

| Campo |
|---|
| `entrega_cep` |
| `entrega_logradouro` |
| `entrega_numero` |
| `entrega_complemento` |
| `entrega_bairro` |
| `entrega_cidade` |
| `entrega_estado` |
| `pessoa_autorizada_obra` |
| `telefone_obra` |
| `ponto_referencia_obra` |

### Itens / Produto

| Campo | Descrição |
|---|---|
| `modelo` | Modelo da porta/produto |
| `dimensao` | Dimensão (LARG x ALT) |
| `cor` | Cor do acabamento |
| `tipo_fechamento` | Tipo de fechamento (digital, biométrico, etc) |
| `quantidade` | Quantidade de itens |

### Comerciais

| Campo |
|---|
| `representante` |
| `coordenador` |
| `supervisor` |
| `gestor` |
| `gerente` |
| `regiao` |

---

## AUTENTICAÇÃO

Pode ser o mesmo método que já usamos pra Reservas (clientId `191085ef` no Outlook ou outro token que você definir). Estamos abertos a:

- API Key no header
- OAuth (se preferir)
- Token estático compartilhado
- Cookie de sessão (como funciona no `intranet.weiku.com.br`)

---

## ALTERNATIVAS (se endpoint dedicado não for viável)

Se criar endpoint novo for trabalhoso, qualquer uma dessas opções resolve:

1. **Endpoint genérico** que aceita o tipo (`?tipo=contrato&numero=ATP000406`)
2. **Exportar o HTML** da página `editar-contrato.php` em formato estruturado (XML/JSON nos data-attributes)
3. **Acesso ao banco** (somente leitura) com query SQL definida por vocês

---

## TIMING

Não tem urgência crítica — estamos preenchendo manualmente por enquanto. Mas quanto antes a gente integrar, melhor (evita erro de digitação e economiza tempo da equipe).

---

## CONTATO

Qualquer dúvida me avisa.

**Felipe**
Projetta
