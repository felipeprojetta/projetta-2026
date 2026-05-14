/* 25-acessorios.js — Cadastros > Acessorios.
   Tabela mestre de acessorios (puxadores, fechaduras, dobradicas, vedacoes etc.)
   Persistencia: Storage.scope('cadastros') chave 'acessorios_lista'.
   SEED: 312 acessorios da Pasta2.xlsx, com Familia cruzada do Pivot.xlsx
         (164 dos 312 ja vem com Familia preenchida; resto fica vazio).
   Colunas: Codigo (PK) | Fornecedor | Descricao | Familia | Preco. */

const Acessorios = (() => {
  const store = Storage.scope('cadastros');

  // Felipe (sessao 2026-05): listas migradas para Cadastros > Filtros.
  // Fallback hardcoded preservado pra compatibilidade total.
  const _SEED_FORNECEDORES = ["ATELIER DU METAL", "CDA METAIS", "CENTROOESTE", "CVL", "DECAMP", "DOORWIN", "DORMAKABA", "DOWSIL", "ECLISSE", "EMTECO", "FISCHER", "HANDCRAFT", "HOMEX", "HYDRO", "INOX-PAR", "INSTALE", "JNF", "KESO", "MAHLHER", "MERCADO", "NEOMEC", "NUKI", "PORTTAL", "PRIMA FERRAGENS", "PROJETOAL", "SCHLEGEL", "SOLDAL", "STYRO", "UDINESE", "UNIFORT", "WURTH", "ZAKA"];
  const _SEED_FAMILIAS     = ["Buchas", "Caixetas", "Calços", "Cilindros", "Contra Testa", "Dobradiças", "Dobras", "Embalagem", "Esferas", "Fechadura Digital", "Fechadura Magnética", "Fechadura Mecânica", "Fechos", "Fitas Adesivas", "Isolante termico", "Maçanetas", "Mola aérea", "Outros Insumos Produção&Instalação", "Parafusos", "Pivô", "Puxadores", "Roldanas", "Rosetas", "Selantes > Silicones > Quimicos", "Spray", "Trava Porta", "Uso e Consumo Produção&Instalação", "Veda Porta", "Vedações"];
  function getFornecedores() {
    if (window.Filtros && typeof window.Filtros.listar === 'function') {
      return window.Filtros.listar('acessorios_fornecedor', _SEED_FORNECEDORES);
    }
    return _SEED_FORNECEDORES.slice();
  }
  function getFamilias() {
    if (window.Filtros && typeof window.Filtros.listar === 'function') {
      return window.Filtros.listar('acessorios_familia', _SEED_FAMILIAS);
    }
    return _SEED_FAMILIAS.slice();
  }

  const SEED_ACESSORIOS = [{"codigo":"PA-ATELIER-ROS-RD DR","fornecedor":"ATELIER DU METAL","descricao":"ROSETA CLASSICA - ATELIER DUMETAL","familia":"Rosetas","preco":0},{"codigo":"ECV-0512","fornecedor":"CDA METAIS","descricao":"ESCOVA DE VEDAÇÃO 5X12MM","familia":"","preco":0},{"codigo":"PA-STRETCH","fornecedor":"CENTROOESTE","descricao":"FILME STRETCH 25X500 SEM TUBETE TR","familia":"Embalagem","preco":0},{"codigo":"PFCON37520C","fornecedor":"DECAMP","descricao":"CONEXÃO DE AUXÍLIO PARA CANTO 90º NO PF45.019","familia":"Outros Insumos Produção&Instalação","preco":0},{"codigo":"PFCON41063C","fornecedor":"DECAMP","descricao":"CONEXÃO DE AUXÍLIO PARA CANTO 90º NO PF45.024","familia":"Outros Insumos Produção&Instalação","preco":0},{"codigo":"PFPVESC550","fornecedor":"DECAMP","descricao":"ESCOVA DE VEDAÇÃO 5 X 5 MM","familia":"","preco":0},{"codigo":"PA-TEDEE-BRIDGE","fornecedor":"DOORWIN","descricao":"Tedee Bridge TBV1.0 conexao wireless de Sinal Wifi com fonte de alimentacao para Lock TLV","familia":"Tedee","preco":0},{"codigo":"PA-TEDEE-FEC-BRONZE","fornecedor":"DOORWIN","descricao":"Tedee Lock - PRO Homekit Fechadura Inteligente Stainless Steel TLV1.0C HK","familia":"Fechadura Digital","preco":0},{"codigo":"PA-TEDEE-FEC-DOURADA","fornecedor":"DOORWIN","descricao":"Tedee Lock - PRO Homekit Fechadura Inteligente Dourada Preta TLV1.0D HK","familia":"Fechadura Digital","preco":0},{"codigo":"PA-TEDEE-FEC-PRT/BRA","fornecedor":"DOORWIN","descricao":"Tedee Lock - PRO Homekit Fechadura Inteligente Prata / Branca TLV1.0A HK","familia":"Fechadura Digital","preco":0},{"codigo":"PA-TEDEE-FEC-PT","fornecedor":"DOORWIN","descricao":"Tedee Lock - PRO Homekit Fechadura Inteligente Preta TLV1.0B HK","familia":"Fechadura Digital","preco":0},{"codigo":"PA-TEDEE-TEC-BR","fornecedor":"DOORWIN","descricao":"Tedee Keypad-PRO Teclado biometrica inteligente TKV2.0 , com Senha (PIN) e impressao digital cor Bra","familia":"Tedee","preco":0},{"codigo":"PA-TEDEE-TEC-PT","fornecedor":"DOORWIN","descricao":"Tedee Keypad-PRO Teclado biometrica inteligente TKV2.0 , com Senha (PIN) e impressao digital cor Pre","familia":"Tedee","preco":0},{"codigo":"PA-TEDEE-CONT SEC","fornecedor":"DOORWIN","descricao":"Contato Seco / Dry Contact (DC) Tedee BLE modelo TDCV1.0A","familia":"Tedee","preco":0},{"codigo":"PA-MOLA GUIA DIR","fornecedor":"DORMAKABA","descricao":"GUIA DESLIZANTE C/ BRACO DIR. P/ ITS - 914.20.96200","familia":"Mola aérea","preco":0},{"codigo":"PA-MOLA GUIA ESQ","fornecedor":"DORMAKABA","descricao":"GUIA DESLIZANTE C/ BRACO ESQ. P/ ITS - 914.20.96100","familia":"Mola aérea","preco":0},{"codigo":"PA-MOLA ITS-96","fornecedor":"DORMAKABA","descricao":"PA-MOLA ITS-96","familia":"Mola aérea","preco":0},{"codigo":"PA-MOLA TRAVA PARADA","fornecedor":"DORMAKABA","descricao":"TRAVA DE PARADA RF P/ CALHA DESLIZANTE TS93/ITS96 - 905.05.14000","familia":"Mola aérea","preco":0},{"codigo":"PA-DOWSIL 995 ESTR SH","fornecedor":"DOWSIL","descricao":"DOWSIL 995 PRETO SACHE 591ML","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-DOWSIL PRETO","fornecedor":"DOWSIL","descricao":"DOWSIL 791 PRETO TUBO 300ML - P0000036","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-DOWSIL BRONZE","fornecedor":"DOWSIL","descricao":"DOWSIL 791 BRONZE TUBO 300ML - P0000022","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-DOWSIL BRANCO","fornecedor":"DOWSIL","descricao":"DOWSIL 791 BRANCO TUBO 300ML - P0000020","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-DOWSIL INCOLOR","fornecedor":"DOWSIL","descricao":"DOWSIL 768 INCOLOR TUBO 300ML - P0000008","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-DOWSIL CPS BR","fornecedor":"DOWSIL","descricao":"DOWSIL CPS BRANCO SACHE 591ML","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-CREMONA MAGNETICA","fornecedor":"ECLISSE","descricao":"CREMONA MAGNETICA - CROMADA - 4100NL","familia":"Fechos","preco":0},{"codigo":"PA-PIV FRIST M32+SCG","fornecedor":"ECLISSE","descricao":"PIVOT COM MOLA SYSTEM M32","familia":"","preco":0},{"codigo":"PA-PIV FRIST M42+SCG","fornecedor":"ECLISSE","descricao":"PIVOT COM MOLA SYSTEM M42+ SCG 500 KG kit completo - ST.M+.70.G.S.SS","familia":"Pivô","preco":0},{"codigo":"PA-DIG EMTECO BAR II","fornecedor":"EMTECO","descricao":"FECHADURA DIGITAL BARCELONA II (WIFI) BIOMETRIA/SENHA/CHAVE/APP - EMBUTIR","familia":"Fechadura Digital","preco":0},{"codigo":"PA-QL 48700","fornecedor":"SCHLEGEL","descricao":"Q-LON 48700 PRETO R-250 9005","familia":"Vedações","preco":6.99},{"codigo":"PA-QL 48750","fornecedor":"SCHLEGEL","descricao":"Q-LON 48 750 PRETA R-600","familia":"Vedações","preco":0},{"codigo":"PA-QL 48800","fornecedor":"SCHLEGEL","descricao":"Q-LON 48 800 PRETA FLIPPER SEAL R-250","familia":"Vedações","preco":7.58},{"codigo":"PA-BUCHA 06","fornecedor":"FISCHER","descricao":"DUOPOWER 6 - SC1500","familia":"Buchas","preco":0.18},{"codigo":"PA-BUCHA 08","fornecedor":"FISCHER","descricao":"DUOPOWER 8 - SC750","familia":"Buchas","preco":0},{"codigo":"PA-BUCHA 10","fornecedor":"FISCHER","descricao":"BUCHA SX10 - SC300","familia":"Buchas","preco":0},{"codigo":"PA-MOLA MARIX","fornecedor":"HANDCRAFT","descricao":"MOLA MARIX P/ PORTA DE ALUMINIO C/TP INOX - 199i","familia":"Pivô","preco":0},{"codigo":"PA - PILHA AA 4X","fornecedor":"HOMEX","descricao":"PACOTE DE PILHA (AA) COM 4 UNIDADES","familia":"","preco":0},{"codigo":"PA - PILHA AAA 4X","fornecedor":"HOMEX","descricao":"PACOTE DE PILHA (AA) COM 4 UNIDADES","familia":"","preco":0},{"codigo":"PA - TAG","fornecedor":"HOMEX","descricao":"TAG","familia":"","preco":0},{"codigo":"PA-9300-KIT","fornecedor":"HOMEX","descricao":"KIT EXTENSOR 9300","familia":"Acessorios 9300","preco":0},{"codigo":"PA-9300ALONGA38-60","fornecedor":"HOMEX","descricao":"KET DO ALONGADOR 9300 38-60","familia":"","preco":0},{"codigo":"PA-9300ALONGA90-120","fornecedor":"HOMEX","descricao":"KIT DO ALONGADOR 9300 90-120","familia":"","preco":0},{"codigo":"PA-9300CAIXETA","fornecedor":"HOMEX","descricao":"CAIXETA DA 9300","familia":"","preco":0},{"codigo":"PA-9300CHMONTFIX","fornecedor":"HOMEX","descricao":"CHAPA DE MONTAGEM DA FIXAÇÃO INTERNA 9300","familia":"","preco":0},{"codigo":"PA-9300CHMONTGEST","fornecedor":"HOMEX","descricao":"CHAPA DE MONTAGEM DA ESTRUTURA 9300","familia":"","preco":0},{"codigo":"PA-9300CONTRATESTA","fornecedor":"HOMEX","descricao":"CONTRA TESTA PARA FECHADURA 9300","familia":"","preco":0},{"codigo":"PA-9300GATEWAY","fornecedor":"HOMEX","descricao":"GATEWAY PARA 9300","familia":"","preco":0},{"codigo":"PA-9300MOTRIZE","fornecedor":"HOMEX","descricao":"MORTIZE PARA 9300","familia":"","preco":0},{"codigo":"PA-DIG PH EK K9300","fornecedor":"HOMEX","descricao":"FECHADURA ELETRONICA, MODELO 9300, COR PRETA","familia":"Fechadura Digital","preco":0},{"codigo":"PAR1029NAT","fornecedor":"HYDRO","descricao":"PAR.A/A.CAB.PANELA 4,2X38MM FDA.PHS. (DIN 7981) INOX304 NATURAL (PC)","familia":"","preco":0},{"codigo":"PA-CHAAA PHS 35X20","fornecedor":"INOX-PAR","descricao":"PARAFUSOS DIVERSOS ZINCADO  35X20MM (6407/00)","familia":"Parafusos","preco":0},{"codigo":"PA-PAN AA PHS 4,2X13","fornecedor":"INOX-PAR","descricao":"CHATA AA PHS 4,2 X 13 BROC. 410","familia":"","preco":0},{"codigo":"PA-PAN AA PHS 4,2X19","fornecedor":"INOX-PAR","descricao":"PAN AA PHS 4,2 X 19 BROC. 410 - 7504N4.2X19410","familia":"Parafusos","preco":0},{"codigo":"PA-PAR BRO 5,5X38","fornecedor":"INOX-PAR","descricao":"SEXT AA BROC. 5,5 X 38 C/ ARR. NEOPR. 410 - ASX5.5X38BRC410","familia":"Parafusos","preco":0},{"codigo":"PA-PAR BRO 5,5X50","fornecedor":"INOX-PAR","descricao":"PARAFUSO SEXTAVADO C/ARRUELA PHS PONTA BROCA 12X2 - 3058","familia":"Parafusos","preco":0},{"codigo":"PA-PAR BRO 5,5X58","fornecedor":"INOX-PAR","descricao":"SEXT AA 5.5 X 58 C/ARR. N EOPRENE BROC. PONTA COSTU RA 410 - ASX5.5X58PC410","familia":"Parafusos","preco":0},{"codigo":"PA-PAR BRO 5,5X90","fornecedor":"INOX-PAR","descricao":"PARAFUSO SEXTAVADO BROCANTE 5,5X1.1/2\"(38MM)","familia":"","preco":0},{"codigo":"PA-PAR SOB M6X100","fornecedor":"INOX-PAR","descricao":"SEXT SOB M6 X 100 DIN 571 A2 - 5716X100A2","familia":"Parafusos","preco":0},{"codigo":"PA-PAR SOB M6X65","fornecedor":"INOX-PAR","descricao":"SEXT SOB M6 X 65 DIN 571 A2 - 5716X65A2","familia":"Parafusos","preco":0},{"codigo":"PA-REBTAPA04012NA","fornecedor":"INOX-PAR","descricao":"REB. DE REP. REPUXO TP CEGO 4,0X120 ALUMINIO - CAS412","familia":"Parafusos","preco":0},{"codigo":"PA-PUX-1,5MT ESC","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1500MM ACAB. ESCOVADO - 01069","familia":"","preco":0},{"codigo":"PA-PUX-1,5MT POL","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1500MM ACAB. POLIDO - 01066","familia":"","preco":0},{"codigo":"PA-PUX-1,5MT PRE","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1500MM ACAB. PRETO FOSCO - 01081","familia":"","preco":0},{"codigo":"PA-PUX-1MT ESC","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1000MM ACAB. ESCOVADO - 2513","familia":"","preco":0},{"codigo":"PA-PUX-1MT POL","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1000MM ACAB. POLIDO - 125125","familia":"","preco":0},{"codigo":"PA-PUX-1MT PRE","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X1000MM ACAB. PRETO FOSCO - 01077","familia":"","preco":0},{"codigo":"PA-PUX-2MT ESC","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X2000MM ACAB. ESCOVADO - 01071","familia":"","preco":0},{"codigo":"PA-PUX-2MT POL","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X2000 MM ACAB. POLIDO - 01067","familia":"","preco":0},{"codigo":"PA-PUX-2MT PRE","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X2000MM ACAB. PRETO FOSCO - 01079","familia":"","preco":0},{"codigo":"PA-PUX-3MT ESC","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X3000MM ACAB. ESCOVADO - FORMA6","familia":"","preco":0},{"codigo":"PA-PUX-3MT POL","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR DUPLA FIXACAO EM ACO INOX 304 TAM. 50X20X3000MM ACAB. POLIDO - 05012","familia":"","preco":0},{"codigo":"PA-PUX-3MT PRE","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR DUPLA FIXACAO EM ACO INOX 304 TAM. 50X20X3000MM ACAB. PRETO FOSCO - 16546","familia":"","preco":0},{"codigo":"PA-PUX-4MT ESC","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X4000MM ACAB. ESCOVADO - FORMA1","familia":"","preco":0},{"codigo":"PA-PUX-4MT POL","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X4000MM ACAB. POLIDO - 0320101","familia":"","preco":0},{"codigo":"PA-PUX-4MT PRE","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X4000MM ACAB. PRETO FOSCO - FORMA4","familia":"","preco":0},{"codigo":"PA-PUX-5MT ESC","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X5000MM ACAB. ESCOVADO - FORMA3","familia":"","preco":0},{"codigo":"PA-PUX-5MT POL","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X5000MM ACAB. POLIDO - FORMA2","familia":"","preco":0},{"codigo":"PA-PUX-5MT PRE","fornecedor":"INSTALE","descricao":"FORMATTO - PUXADOR EM ACO INOX 304 DUPLA FIXACAO TAM. 50X20X5000MM ACAB. PRETO FOSCO - FORMA5","familia":"","preco":0},{"codigo":"PA-CHAVESEG","fornecedor":"KESO","descricao":"CHAVE DE SEGURANÇA","familia":"","preco":0},{"codigo":"PA-KESO CRT 4P RL BL","fornecedor":"KESO","descricao":"CONTRA TESTA EM INOX 04 PINOS SEM A DOBRA FURO OBLONGO ACAB. PRETO","familia":"Contra Testa","preco":0},{"codigo":"PA-KESO CRT 4P RL CR","fornecedor":"KESO","descricao":"CONTRA TESTA EM INOX 04 PINOS SEM A DOBRA FURO OBLONGO ACAB. CRA","familia":"Contra Testa","preco":0},{"codigo":"PA-KESO CRT 4P RT BL","fornecedor":"KESO","descricao":"CONTRA TESTA EM INOX FURO OBLONGO DA 04 PINOS 60291BLR","familia":"Contra Testa","preco":0},{"codigo":"PA-KESO CRT 4P RT CR","fornecedor":"KESO","descricao":"CONTRA TESTA EM INOX FURO OBLONGO DA 04 PINOS 60291CRA","familia":"Contra Testa","preco":36.61},{"codigo":"PA-KESO CRT AUX BL","fornecedor":"KESO","descricao":"CONTRA TESTA EM INOX AUXILIAR DA 03 PONTOS FURO OBLONGO ACAB.PRETO","familia":"Contra Testa","preco":0},{"codigo":"PA-KESO CRT AUX CR","fornecedor":"KESO","descricao":"CONTRA TESTA EM INOX AUXILIAR DA 03 PONTOS FURO OBLONGO ACAB.CRA","familia":"Contra Testa","preco":0},{"codigo":"PA-KESO CRT TRA BL","fornecedor":"KESO","descricao":"CONTRA TESTA EM INOX PRETO PORTA E BATENTE FECHAMENTO TRASEIRO","familia":"Contra Testa","preco":0},{"codigo":"PA-KESO CRT TRA CR","fornecedor":"KESO","descricao":"CONTRA TESTA EM INOX ESCOVADO PORTA E BATENTE FECHAMENTO TRASEIRO","familia":"","preco":0},{"codigo":"PA-KESO CXT  AUX","fornecedor":"KESO","descricao":"CAIXETA DE ACABAMENTO P/ AUXILIARES 04 PINOS","familia":"Caixetas","preco":0},{"codigo":"PA-KESO CXT 4P","fornecedor":"KESO","descricao":"CAIXETA DE ACABAMENTO P/ FECHADURA ROLETE  04 PINOS","familia":"Caixetas","preco":35.09},{"codigo":"PA-KESO ROS QD BL","fornecedor":"KESO","descricao":"ENTRADA P/EURO 53x53x8 QUADRADA E06 INOX PRETO - 00000405","familia":"Rosetas","preco":0},{"codigo":"PA-KESO ROS QD P","fornecedor":"KESO","descricao":"ENTRADA P/EURO 53x53x8 QUADRADA E06 INOX P - 00000400","familia":"Rosetas","preco":0},{"codigo":"PA-KESO ROS QD S","fornecedor":"KESO","descricao":"ENTRADA P/EURO 53x53x8 QUADRADA E06 INOX S - 00000401","familia":"Rosetas","preco":0},{"codigo":"PA-KESO ROS RD BL","fornecedor":"KESO","descricao":"ROSETA ENTRADA P/CIL.EURO G009 BL INOX PRETO - 00000648","familia":"Rosetas","preco":15.26},{"codigo":"PA-KESO ROS RD CR","fornecedor":"KESO","descricao":"ROSETA ENTRADA P/CIL.EURO G009 CR INOX - 00000743","familia":"Rosetas","preco":0},{"codigo":"PA-KESO ROS RD CRA","fornecedor":"KESO","descricao":"ROSETA ENTRADA P/CIL.EURO G009 CRA INOX - 00000744","familia":"Rosetas","preco":0},{"codigo":"PA-KESO ROS RD LP","fornecedor":"KESO","descricao":"ENTRADA P/EUROPERFIL M14S LP(F71) - 00000645","familia":"Rosetas","preco":0},{"codigo":"PA-KESO-MACANETA BL","fornecedor":"KESO","descricao":"MEIA MACANETA S229L/G009/PZ/ INOX PRETO - 00001569","familia":"Maçanetas","preco":0},{"codigo":"PA-KESO-MACANETA CR","fornecedor":"KESO","descricao":"MEIA MACANETA S229L/G009/PZ/INOX S - 00001570","familia":"Maçanetas","preco":0},{"codigo":"PA-KESO04P RL BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 04P TRINCO ROLETE BL - 30306BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO04P RL CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 04P TRINCO ROLETE CR - 30306CR","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO04P RT BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 04P VOLPER BL TRINCO RETO - 30305BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO04P RT CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 04P VOLPER CR TRINCO RETO - 30305CR","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO08P RL BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 08P VOLPER ROLETE 60MM BL - 30317BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO08P RL CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 08P VOLPER ROLETE 60MM CR - 30317CR","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO08P RT BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 08P VOLPER TRINCO RETO 60MM BL - 30316BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO08P RT CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 08P VOLPER TRINCO RETO 60MM CR - 30316CR","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO08P+1 RL BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 08P VOLPER ROLETE 60MM BL C/ FECHAMENTO ATRAS - 32317BL","familia":"","preco":0},{"codigo":"PA-KESO08P+1 RL CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 08P VOLPER ROLETE 60MM CR C/ FECHAMENTO ATRAS - 32317CR","familia":"","preco":0},{"codigo":"PA-KESO08P+1 RT BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 08P VOLPER TRINCO 60MM BL C/ FECHAMENTO ATRAS","familia":"","preco":0},{"codigo":"PA-KESO08P+1 RT CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 08P VOLPER TRINCO 60MM CR C/ FECHAMENTO ATRAS","familia":"","preco":0},{"codigo":"PA-KESO1/2C 65 BL","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 65MM","familia":"","preco":0},{"codigo":"PA-KESO1/2C 65 CF","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 65MM","familia":"","preco":0},{"codigo":"PA-KESO1/2C 70 BL","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 70MM","familia":"","preco":0},{"codigo":"PA-KESO1/2C 70 BL BT","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL BT LIG.ACO 70MM","familia":"","preco":0},{"codigo":"PA-KESO1/2C 70 CF","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 70MM - 8970CFR","familia":"Cilindros","preco":0},{"codigo":"PA-KESO1/2C 70 CF BT","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF BT LIG.ACO 70MM","familia":"","preco":0},{"codigo":"PA-KESO1/2C 70BLBTTD","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 70MM COM BOTAO. P/SMART TEDEE","familia":"","preco":0},{"codigo":"PA-KESO1/2C 70BLNK","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 70MM P/SMART LOCK NUKI","familia":"","preco":0},{"codigo":"PA-KESO1/2C 70CFBTTD","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 70MM COM BOTAO. P/SMART TEDEE - 8970CFRK","familia":"Cilindros","preco":0},{"codigo":"PA-KESO1/2C 70CFNK","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 70MM P/SMART LOCK NUKI","familia":"","preco":0},{"codigo":"PA-KESO1/2C 75 BL","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 75MM - 8975BLR","familia":"","preco":0},{"codigo":"PA-KESO1/2C 75 BL BT","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL LIG.ACO 75MM C/ BOTAO - BL - 8975BLRK","familia":"","preco":0},{"codigo":"PA-KESO1/2C 75 CF","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 75MM","familia":"","preco":0},{"codigo":"PA-KESO1/2C 75 CF BT","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL LIG.ACO 75MM C/ BOTAO LP - CF","familia":"","preco":0},{"codigo":"PA-KESO1/2C 75 DR BT","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL LIG.ACO 75MM C/ BOTAO LP - DOURADO - 8975U3RK","familia":"","preco":0},{"codigo":"PA-KESO1/2C 75BLBTTD","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 75MM COM BOTAO. P/SMART TEDEE","familia":"","preco":0},{"codigo":"PA-KESO1/2C 75BLNK","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 75MM P/SMART LOCK NUKI","familia":"","preco":0},{"codigo":"PA-KESO1/2C 75CFBTTD","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 75MM COM BOTAO. P/SMART TEDEE","familia":"","preco":0},{"codigo":"PA-KESO1/2C 75CFNK","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 75MM P/SMART LOCK NUKI","familia":"","preco":0},{"codigo":"PA-KESO1/2C 85 BL","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 85MM","familia":"","preco":0},{"codigo":"PA-KESO1/2C 85 BL BT","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 85MM C/ BOTÃO - 8977BLRK","familia":"Cilindros","preco":0},{"codigo":"PA-KESO1/2C 85 CF","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 85MM","familia":"","preco":0},{"codigo":"PA-KESO1/2C 85 CF BT","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 85MM C/ BOTÃO","familia":"","preco":0},{"codigo":"PA-KESO1/2C 85BLBTTD","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 85MM COM BOTAO. P/SMART TEDEE","familia":"Cilindros","preco":0},{"codigo":"PA-KESO1/2C 85BLNK","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 85MM P/SMART LOCK NUKI","familia":"","preco":0},{"codigo":"PA-KESO1/2C 85CFBTTD","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 85MM COM BOTAO. P/SMART TEDEE","familia":"","preco":0},{"codigo":"PA-KESO1/2C 85CFNK","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL CF LIG.ACO 85MM P/SMART LOCK NUKI","familia":"","preco":0},{"codigo":"PA-KESO12P+2A72RLBL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P 70200  VOLPER ROLETE BL C/ 02 FECHAMENTO ATRAS","familia":"","preco":0},{"codigo":"PA-KESO12P+2A72RLCR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P 70200  VOLPER ROLETE CR C/ 02 FECHAMENTO ATRAS","familia":"","preco":0},{"codigo":"PA-KESO12P+2A72RTBL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P 70200  VOLPER TRINCO RETO BL C/ 02 FECHAMENTO ATRAS","familia":"","preco":0},{"codigo":"PA-KESO12P+2A72RTCL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P 70200  VOLPER TRINCO RETO CR C/ 02 FECHAMENTO ATRAS","familia":"","preco":0},{"codigo":"PA-KESO12P+2ACM RL B","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P ACM  VOLPER ROLETE BL C/ 02 FECHAMENTO ATRAS - 405215BL","familia":"","preco":863.94},{"codigo":"PA-KESO12P+2ACM RL C","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P ACM  VOLPER ROLETE C C/ 02 FECHAMENTO ATRAS","familia":"","preco":0},{"codigo":"PA-KESO12P+2ACM RT B","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P ACM  VOLPER TRINCO RETO BL C/ 02 FECHAMENTO ATRAS - 305215BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO12P+2ACM RT C","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P ACM  VOLPER TRINCO RETO C C/ 02 FECHAMENTO ATRAS - 305215CR","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO12P7020 RL BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P 70200 VOLPER ROLETE BL - 40215BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO12P7020 RL CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P 70200 VOLPER ROLETE CR","familia":"","preco":0},{"codigo":"PA-KESO12P7020 RT BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P 70200 VOLPER TRINCO RETO BL - 30215BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO12P7020 RT CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P 70200 VOLPER TRINCO RETO CR","familia":"","preco":0},{"codigo":"PA-KESO12PACM RL BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P ACM VOLPER ROLETE BL - 404215BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO12PACM RL CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P ACM VOLPER ROLETE CR - 404215CR","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO12PACM RT BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P ACM VOLPER TRINCO RETO BL - 304215BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO12PACM RT CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 12P ACM VOLPER TRINCO RETO CR - 304215CR","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO16P+2ACM RL B","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 16P ACM  VOLPER ROLETE BL C/ 02 FECHAMENTO ATRAS - 406216BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO16P+2ACM RL C","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 16P ACM  VOLPER ROLETE CR C/ 02 FECHAMENTO ATRAS - 406216CR","familia":"","preco":0},{"codigo":"PA-KESO16P+2ACM RT B","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 16P ACM  VOLPER TRINCO RETO BL C/ 02 FECHAMENTO ATRAS - 306216BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO16P+2ACM RT C","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 16P ACM  VOLPER TRINCO RETO CR C/ 02 FECHAMENTO ATRAS  - 306216CR","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO16PACM RL BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 16P ACM VOLPER ROLETE BL - 406215BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO16PACM RL CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 16P ACM VOLPER ROLETE CR - 406215CR","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO16PACM RT BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 16P ACM VOLPER TRINCO RETO BL - 306215BL","familia":"Fechadura Mecânica","preco":0},{"codigo":"PA-KESO16PACM RT CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 16P ACM VOLPER TRINCO RETO CR - 306215CR","familia":"","preco":0},{"codigo":"PA-KESO24P RL BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 24P ACM VOLPER ROLETE BL - 41600BL","familia":"","preco":0},{"codigo":"PA-KESO24P RL CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 24P ACM VOLPER ROLETE CR - 41600CR","familia":"","preco":0},{"codigo":"PA-KESO24P RT BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 24P ACM VOLPER TRINCO RETO BL","familia":"","preco":0},{"codigo":"PA-KESO24P RT CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 24P ACM VOLPER TRICNCO RETO CR","familia":"","preco":0},{"codigo":"PA-KESO24P+2 RL BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 24 ACM 06 PONTOS ROLETE BL C/ 02 FECHAMENTO ATRAS - 41601BL","familia":"","preco":0},{"codigo":"PA-KESO24P+2 RL CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 24 ACM 06 PONTOS ROLETE CR C/ 02 FECHAMENTO ATRAS - 41601CR","familia":"","preco":0},{"codigo":"PA-KESO24P+2 RT BL","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 24 ACM 06 PONTOS TRINCO RETO BL C/ 02 FECHAMENTO ATRAS","familia":"","preco":0},{"codigo":"PA-KESO24P+2 RT CR","fornecedor":"KESO","descricao":"FECHADURA NIVA PLUS 24 ACM 06 PONTOS TRINCO RETO CR C/ 02 FECHAMENTO ATRAS","familia":"","preco":0},{"codigo":"PA-KESOCIL 060 CF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 60/00/00 LIG.ACO - 8000CFR","familia":"","preco":0},{"codigo":"PA-KESOCIL 075 BL","fornecedor":"KESO","descricao":"MEIO CILINDRO EUROPERFIL BL LIG.ACO 75MM - 8975BLR","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL 080 BL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 80/10/10 LIG.INOX - 8020BLR","familia":"","preco":0},{"codigo":"PA-KESOCIL 080 CF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 80/10/10 LIG.ACO - 8020CFR","familia":"","preco":0},{"codigo":"PA-KESOCIL 090 BL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 90/15/15 LIG.ACO - 8027BLR","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL 090 BT BL","fornecedor":"KESO","descricao":"CILINDRO EURO.BL 90/15/15 C/BOTAO LIG.ACO - 8027BLRK","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL 090 BT CF","fornecedor":"KESO","descricao":"CILINDRO EURO.CF 90/15/15 C/BOTAO L.INOX - 8027CFRK","familia":"","preco":0},{"codigo":"PA-KESOCIL 090 CF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 90/15/15 LIG.ACO - 8027CFR","familia":"","preco":0},{"codigo":"PA-KESOCIL 100 BT BL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 100/20/20 LIG.ACO PARA SMART LOCK C/BOTÃO P/SMART T","familia":"","preco":0},{"codigo":"PA-KESOCIL0 060 BL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 60/00/00 LIG.ACO - 8000BLR","familia":"","preco":0},{"codigo":"PA-KESOCIL115 BLNK","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 115/35/20 LIG.ACO  PARA SMART LOCK NUKI.","familia":"","preco":0},{"codigo":"PA-KESOCIL115 CFNK","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 115/35/20 LIG.ACO  PARA SMART LOCK NUKI. (8945CFR)","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL115BLNKCF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 115/35/20 LIG.ACO  PARA SMART LOCK NUKI. CF","familia":"","preco":0},{"codigo":"PA-KESOCIL115CFNKBL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 115/35/20 LIG.ACO  PARA SMART LOCK NUKI. BL","familia":"","preco":0},{"codigo":"PA-KESOCIL130 BL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 130/35/35 LIG.ACO - 8039BLR","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL130 BLCF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 130/35/35 LIG.ACO","familia":"","preco":0},{"codigo":"PA-KESOCIL130 BLTD","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 130/35/35 PARA SMART LOCK C/BOTAO. TEDEE (8930BLRK )","familia":"","preco":0},{"codigo":"PA-KESOCIL130 BT BL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 130/35/35 LIG.ACO C/ BOTAO - 8039BLRK","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL130 BT CF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 130/35/35 LIG.ACO C/ BOTAO - 8039CFRK","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL130 CF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 130/35/35 LIG.ACO - 8039CFR","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL130 CFTD","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 130/35/35 C/BOTAO PARA SMART TEDEE. (8930CFRK)","familia":"","preco":0},{"codigo":"PA-KESOCIL130BLBTCF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 130/35/35 LIG.ACO C/ BOTAO CF","familia":"","preco":0},{"codigo":"PA-KESOCIL130BLTDCF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 130/35/35 LIG.ACO PARA SMART LOCK C/BOTAO. TEDEE CF","familia":"","preco":0},{"codigo":"PA-KESOCIL130CFBTBL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF/BL 130/35/35 LIG.ACO C/ BOTAO BL","familia":"","preco":0},{"codigo":"PA-KESOCIL130CFTDBL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 130/35/35 LIG.ACO PARA SMART LOCK C/BOTAO. TEDEE  BL","familia":"","preco":0},{"codigo":"PA-KESOCIL135 BLNK","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 135/45/30 LIG.ACO  PARA SMART LOCK NUKI.","familia":"","preco":0},{"codigo":"PA-KESOCIL135 CFNK","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 135/45/30 LIG.ACO  PARA SMART LOCK NUKI.","familia":"","preco":0},{"codigo":"PA-KESOCIL135BLNKCF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 135/45/30 LIG.ACO  PARA SMART LOCK NUKI. CF","familia":"","preco":0},{"codigo":"PA-KESOCIL135CFNKBL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 135/45/30 LIG.ACO  PARA SMART LOCK NUKI. BL","familia":"","preco":0},{"codigo":"PA-KESOCIL150 BL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 150/45/45 LIG.ACO - 8150BLR","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL190 BL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 190/65/65  LIG.ACO","familia":"","preco":0},{"codigo":"PA-KESOCIL150 BL TD","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 150/45/45 LIG.ACO  PARA SMART LOCK C/BOTAO. TEDDE. (8912BLRK )","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL150 BLCF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO","familia":"","preco":0},{"codigo":"PA-KESOCIL150 BT BL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL 150/45/45 LIG.ACO COM BOTAO - 8150BLRK","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL150 BT CF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 150/45/45 LIG.ACO COM BOTAO CF - 8150CFRK","familia":"Cilindros","preco":859.63},{"codigo":"PA-KESOCIL150 CF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 150/45/45 LIG.ACO - 8150CFR","familia":"Cilindros","preco":0},{"codigo":"PA-KESOCIL150 CFTD","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL CF 150/45/45 LIG.ACO  PARA SMART LOCK C/BOTAO. TEDEE. (8912CFRK)","familia":"","preco":0},{"codigo":"PA-KESOCIL150BLBTCF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO COM BOTAO CF","familia":"","preco":0},{"codigo":"PA-KESOCIL150BLTDCF","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO  PARA SMART LOCK C/BOTAO TEDEE. CF","familia":"","preco":0},{"codigo":"PA-KESOCIL150CFBTBL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO COM BOTAO BL","familia":"","preco":0},{"codigo":"PA-KESOCIL150CFTDBL","fornecedor":"KESO","descricao":"CILINDRO EUROPERFIL BL/CF 150/45/45 LIG.ACO  PARA SMART LOCK C/BOTAO TEDEE. BL","familia":"","preco":0},{"codigo":"PA-KESODOB 30 BL","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE CURTA RETA ACAB.INOX PRETO - 1152/00 - 30 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 30 CR","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE CURTA RETA ACAB.INOX ESCOVADO - 1152/00 - 30 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 40 BL","fornecedor":"KESO","descricao":"DOBRA CONTRA TESTA ROLETE PADRAO RETA ACAB.INOX PRETO - 1139/00 - 40 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 40 CR","fornecedor":"KESO","descricao":"DOBRA CONTRA TESTA ROLETE PADRAO RETA ACAB.INOX ESCOVADO - 1139/00 - 40 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 50 BL","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO A ACAB.INOX PRETO - 1140/00 - 50 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 50 CR","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO A ACAB.INOX ESCOVADO - 1140/00 - 50 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 60 BL","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO B ACAB.INOX PRETO - 1141/00 - 60 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 60 CR","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO B ACAB.INOX ESCOVADO - 1141/00 - 60 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 70 BL","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO C ACAB.INOX PRETO - 1142/00 - 70 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 70 CR","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO C ACAB.INOX CROMADO","familia":"","preco":0},{"codigo":"PA-KESODOB 80 BL","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO D ACAB.INOX PRETO - 1143/00 - 80 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 80 CR","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO D ACAB.INOX ESCOVADO - 1143/00 - 80 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 90 BL","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO E ACAB.INOX PRETO - 1144/00 - 90 mm","familia":"Dobras","preco":0},{"codigo":"PA-KESODOB 90 CR","fornecedor":"KESO","descricao":"DOBRA ESPECIAL CONTRA TESTA ROLETE MODELO E ACAB.INOX CROMADO","familia":"","preco":0},{"codigo":"PA-PILHATEDEEAAA","fornecedor":"DOORWIN","descricao":"PILHA AAA PARA TECLADO TEDEE","familia":"","preco":0},{"codigo":"PA-TEDEECABO","fornecedor":"DOORWIN","descricao":"CABO TIPO C TEDEE","familia":"","preco":0},{"codigo":"PA-DOBRAINV","fornecedor":"MAHLHER","descricao":"DOB.ENCAIXE RAPIDO 4 POLIDA - 01043100074 (DOBRADICA INVISIVEL)","familia":"","preco":0},{"codigo":"PA-CHA AA PHS 4,2X13","fornecedor":"MERCADO","descricao":"CHATA AA PHS 4,2 X 13 BROC. 410 - 7504P4.2X13410","familia":"Parafusos","preco":0},{"codigo":"PA-CHA AA PHS 4,2X19","fornecedor":"MERCADO","descricao":"CHATA AA PHS 4,2 X 19 BROC. 410 - 7504P4.2X19410","familia":"Parafusos","preco":0},{"codigo":"PA-CHA AA PHS 4,2X38","fornecedor":"MERCADO","descricao":"CHATA AA PHS 4,2 X 38 BROC. 410 - 7504P4.2X38410","familia":"Parafusos","preco":0},{"codigo":"PA-CHA AA PHS 4,8X50","fornecedor":"MERCADO","descricao":"CHATA AA PHS 4,8 X 50 DIN 7982 A2 - 79824.8X50A2","familia":"Parafusos","preco":0.24},{"codigo":"PA-PIVOT 350 KG","fornecedor":"NEOMEC","descricao":"PIVOT CONJUNTO - SUPERIOR / INFERIOR COM CAPACIDADE P/350KG INOX 304 (REFORCO NA SOLDA PADRAI PROJET","familia":"Pivô","preco":532.0},{"codigo":"PA-PIVOT 600 KG","fornecedor":"NEOMEC","descricao":"PIVOT CONJ SUP/INF - INOX - P/600KG - CONF. PROJETO","familia":"Pivô","preco":0},{"codigo":"PA-PIVOT 350KG JNF","fornecedor":"JNF","descricao":"PIVOT HIDRAULICO PARA PORTA DE MADEIRA DE ATE 350KG","familia":"Pivô","preco":0},{"codigo":"PA-PIVOT 500KG JNF","fornecedor":"JNF","descricao":"PIVOT HIDRAULICO PARA PORTA DE MADEIRA DE ATE 500KG","familia":"","preco":0},{"codigo":"PA-NUKI-BRI","fornecedor":"NUKI","descricao":"NUKI BRIDGE CONEXÃO WIRILLES DE SINAL WIFI COM FONTE DE ALIMENTAÇÃO (FORA DE LINHA)","familia":"","preco":0},{"codigo":"PA-NUKI-FEC-BL","fornecedor":"NUKI","descricao":"COMBO NUKI SMARTLOCK BL","familia":"","preco":0},{"codigo":"PA-NUKI-FEC-BR","fornecedor":"NUKI","descricao":"COMBO NUKI SMARTLOCK BR","familia":"","preco":0},{"codigo":"PA-NUKI-TEC-BL","fornecedor":"NUKI","descricao":"NUKI KEYPAD-PRO TECLADO BL","familia":"","preco":0},{"codigo":"PA-NUKI-TEC-BR","fornecedor":"NUKI","descricao":"NUKI KEYPAD-PRO TECLADO BR","familia":"","preco":0},{"codigo":"PA-NUKIBATERIA","fornecedor":"NUKI","descricao":"BATERIA PARA NUKI (FORA DE LINHA)","familia":"","preco":0},{"codigo":"PA-NUKISUPORTE","fornecedor":"NUKI","descricao":"SUPORTE PARA NUKI (FORA DE LINHA)","familia":"","preco":0},{"codigo":"PA-CIL CVL55X75","fornecedor":"CVL","descricao":"CILINDRO DESCENTRALIZADO 55X75 (FORNECEDOR NÃO TRABALHA  COM ESSE MODELO)","familia":"","preco":0},{"codigo":"PA-CVL3PT","fornecedor":"CVL","descricao":"FECHADURA 3 PONTOS TRAVAMENTO","familia":"","preco":0},{"codigo":"PA-DIG SOLENOIDE","fornecedor":"PORTTAL","descricao":"FECHADURA SOLENOIDE FS 1011","familia":"Fechadura Digital","preco":0},{"codigo":"PA-VED0720","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 720 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED0820","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 820 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED0920","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 920 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED1020","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1020 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED1120","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1120 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED1220","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1120 MM - COM FURACAO","familia":"Veda Porta","preco":448.44},{"codigo":"PA-VED1320","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1320 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED1420","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1420 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED1520","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1520 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED1620","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1620 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED1720","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1720 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED1820","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1820 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED1920","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 1920 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED2020","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2020 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED2120","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2120 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED2220","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2220 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED2320","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2320 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED2420","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2420 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED2520","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2520 MM - COM FURACAO","familia":"","preco":0},{"codigo":"PA-VED2620","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2620 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED2720","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE - COM ROLETE - EMBUTIDO PRETO 2720 MM - COM FURACAO","familia":"Veda Porta","preco":0},{"codigo":"PA-VED2820","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 2820 MM - 00.255.40-282","familia":"","preco":0},{"codigo":"PA-VED2920","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 2920 MM - 00.255.40-292","familia":"","preco":0},{"codigo":"PA-VED3020","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3020 MM - 00.255.40-302","familia":"","preco":0},{"codigo":"PA-VED3120","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3120 MM - 00.255.40-312","familia":"","preco":0},{"codigo":"PA-VED3220","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3220 MM - 00.255.40-322","familia":"","preco":0},{"codigo":"PA-VED3320","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3320 MM - 00.255.40-332","familia":"","preco":0},{"codigo":"PA-VED3420","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3420 MM - 00.255.40-342","familia":"","preco":0},{"codigo":"PA-VED3520","fornecedor":"PRIMA FERRAGENS","descricao":"VEDA PORTA AUTOMATICO - MOD. 255 - PIVOTANTE COM ROLETE - EMB PRETO 3520 MM - 00.255.40-352","familia":"","preco":0},{"codigo":"PA-FITDF 12X20X1.0","fornecedor":"PROJETOAL","descricao":"FITA DFIX TRANSP 1,0MM X 12MM X 20M","familia":"Fitas Adesivas","preco":17.59},{"codigo":"PA-FITDF 19X20X1.0","fornecedor":"PROJETOAL","descricao":"FITA DFIX TRANSP 1,0MM X 19MM X 20M","familia":"Fitas Adesivas","preco":27.37},{"codigo":"PA-FITDF 19X20X2.0","fornecedor":"PROJETOAL","descricao":"FITA DFIX ACM BRANCA 2.0MM X 19 MM X 20 MTS","familia":"Fitas Adesivas","preco":0},{"codigo":"PA-DOBINOX 3.5X3 ESC","fornecedor":"KESO","descricao":"DOBRADICA VOLPER 3 1/2X3X2,5 SEM PINO INOX CRA - 2003/CA","familia":"","preco":0},{"codigo":"PA-DOBINOX 3.5X3 POL","fornecedor":"KESO","descricao":"DOBRADICA VOLPER 3 1/2 x 3 x 2,5mm S PINO INOX P - 2003/CR","familia":"","preco":0},{"codigo":"PA-DOBINOX 3.5X3 PRE","fornecedor":"KESO","descricao":"DOBRADICA VOLPER 3 1/2 x 3 x 2,5mm S PINO INOX P - 2003/PRE","familia":"","preco":0},{"codigo":"PA-DOBKESO 4X3X3 ESC","fornecedor":"KESO","descricao":"DOBRADICA VOLPER 4X3X3 COM PINO INOX ACETINADO - 2005/CA","familia":"","preco":0},{"codigo":"PA-DOBKESO 4X3X3 POL","fornecedor":"KESO","descricao":"DOBRADICA VOLPER 4X3X3 COM PINO INOX POLIDO","familia":"Dobradiças","preco":0},{"codigo":"PA-DOBKESO 4X3X3 PRE","fornecedor":"KESO","descricao":"DOBRADICA VOLPER 4X3X3 COM PINO INOX PRETO","familia":"Dobradiças","preco":0},{"codigo":"PA-FECHUNHA","fornecedor":"UDINESE","descricao":"FECHO UNHA SQUARE 400MM INOX + GUARDA PO FECHO UNHA INOX","familia":"","preco":0},{"codigo":"PA-FITA VED 5X15","fornecedor":"MERCADO","descricao":"Escovinha Veda Frestas Encaixe Comum 5x15mm Preta 45m Veda - MLB2963314656","familia":"Vedações","preco":0},{"codigo":"PA-FITA VED 5X20","fornecedor":"MERCADO","descricao":"Escovinha Veda Frestas Porta Janela De Encaixe 5x20 Pt 50mt - MLB3779108168_178158049","familia":"Vedações","preco":0},{"codigo":"PA-LPT02012","fornecedor":"MERCADO","descricao":"LIMITADOR P/TRILHO","familia":"","preco":0},{"codigo":"PA-RGU01042","fornecedor":"MERCADO","descricao":"ROLETE GUIA PEQUENO CHAPA RETA 9 MM","familia":"","preco":0},{"codigo":"PA-RNB04031CHF02","fornecedor":"MERCADO","descricao":"ROLDANA 4 RODAS BANDA COM ROLAMENTO 80 KG- CHAPA RETA","familia":"","preco":0},{"codigo":"PA-HIGHTACK BL","fornecedor":"SOLDAL","descricao":"FIX ALL HIGH TACK PRETO 290 ML","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-HIGHTACK BR","fornecedor":"SOLDAL","descricao":"FIX ALL HIGH TACK BRANCO 290 ML - 2839","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-HIGHTACK TURBO BR","fornecedor":"SOLDAL","descricao":"FIX ALL TURBO ES/PT BRANCO 290ML","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-ESPUMA EXP GUN","fornecedor":"SOLDAL","descricao":"SOUDAFOAM GUN 750ML - ESPUMA DE POLIURETANO EXPANSIVA","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-GUN ESPUMA EXP","fornecedor":"SOLDAL","descricao":"GUN E FOAM CLEANER 500ML/400G - ONU 1950 AEROSSOIS, 2.1","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-ISOPOR 100","fornecedor":"STYRO","descricao":"EPS CANALETA U MOD 04 100X50","familia":"Embalagem","preco":0},{"codigo":"PA-ISOPOR 115","fornecedor":"STYRO","descricao":"EPS CANALETA U MOD 05 115X50 - P006","familia":"Embalagem","preco":0},{"codigo":"PA-ISOPOR 125","fornecedor":"STYRO","descricao":"EPS CANALETA U MOD 06 125X50","familia":"Embalagem","preco":7.01},{"codigo":"PA-ISOPOR 135","fornecedor":"STYRO","descricao":"EPS CANALETA U MOD 07 135X50","familia":"Embalagem","preco":0},{"codigo":"PA-ISOPOR 165","fornecedor":"STYRO","descricao":"EPS CANALETA U MOD 08 165X50","familia":"Embalagem","preco":0},{"codigo":"PA-PRIMER","fornecedor":"UNIFORT","descricao":"PRIMER FITA DUPLA FACE VHB 940ML - 9820.822.005","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-ISOPOR FIT ACAB","fornecedor":"STYRO","descricao":"EPS CANALETA U F. MOD 03 2000X140 FITA DE ACABAMENTO","familia":"Embalagem","preco":0},{"codigo":"PA-ISOPOR PA006 ENC","fornecedor":"STYRO","descricao":"EPS CANALETA PA 006 2000X200X120MM - PA006 ENCAIXE","familia":"Embalagem","preco":0},{"codigo":"PA-ISOPOR PA007 ENC","fornecedor":"STYRO","descricao":"EPS CANALETA PA 007 2000X225X120MM - PA007 ENCAIXE","familia":"Embalagem","preco":0},{"codigo":"PA-MS BRA","fornecedor":"WURTH","descricao":"MS POLIMERO 40 BRANCO 230ML/400G - 0892101161","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-MS INC","fornecedor":"WURTH","descricao":"MS ULTRA CLEAR INCOLOR 280ML/285G - 0892412901","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-MS PRE","fornecedor":"WURTH","descricao":"SELANTE MS ACM PRETO 230ML/400G - 0892110323","familia":"Selantes > Silicones > Quimicos","preco":0},{"codigo":"PA-GUA411","fornecedor":"ZAKA","descricao":"BORRACHA GUA411 EPDM - 1053","familia":"","preco":0},{"codigo":"PA-GUA413","fornecedor":"ZAKA","descricao":"BORRACHA GUA413 EPDM - 1052","familia":"","preco":0},{"codigo":"PA-GUA414","fornecedor":"ZAKA","descricao":"BORRACHA GUA414 EPDM - 1051","familia":"","preco":0},{"codigo":"PA-CIL UDINE 130 BL","fornecedor":"UDINESE","descricao":"CILINDRO EUROPEU 130MM (65X65) LATAO PTF **","familia":"Cilindros","preco":0},{"codigo":"PA-CIL UDINE 130 CR","fornecedor":"UDINESE","descricao":"CILINDRO EUROPEU 130MM (65X65) LATAO CRF **","familia":"","preco":0},{"codigo":"PA-CIL UDINE 150 BL","fornecedor":"UDINESE","descricao":"CILINDRO EUROPEU 150MM (75X75) LATAO PTF **","familia":"","preco":0},{"codigo":"PA-CIL UDINE 150 CR","fornecedor":"UDINESE","descricao":"CILINDRO EUROPEU 150MM (75X75) LATAO CRF **","familia":"","preco":0},{"codigo":"PA-LADEROCHA","fornecedor":"MERCADO","descricao":"LA DE ROCHA D32","familia":"Isolante termico","preco":9.41},{"codigo":"PA-DOWSIL 995","fornecedor":"DOWSIL","descricao":"DOWSIL 995 PRETO SACHE 591ML","familia":"Selantes > Silicones > Quimicos","preco":73.9},{"codigo":"PA-ISOPOR PRANC 50","fornecedor":"STYRO","descricao":"EPS PLACA 50MM","familia":"Embalagem","preco":9.01}];

  const state = {
    acessorios: [],
    busca: '',
    filtroFornecedor: '',
    filtroFamilia: '',
  };
  let loaded = false;
  let dirty = false;
  let btnSalvarRef = null;

  function load() {
    if (loaded) return;
    const lista = store.get('acessorios_lista');
    // Felipe (sessao 30 - PROTECAO ANTI-SEED): bloqueia seed global se
    // sistema ja' foi inicializado em qualquer scope. Catalogo de
    // acessorios tem precos/codigos negociados — sobrescrita zera tudo.
    const _seedPermitido = typeof SystemProtection !== 'undefined'
      ? SystemProtection.podeRodarSeed()
      : true;
    if (_seedPermitido && (lista === null || (Array.isArray(lista) && lista.length === 0 && !store.get('acessorios_seeded')))) {
      // R20: aplica titleCase no SEED antes de salvar
      state.acessorios = SEED_ACESSORIOS.map(normalize);
      // Felipe sessao 2026-08-02: em read-only o Storage.set retorna
      // silenciosamente. Nao quebra fluxo - state.acessorios fica em
      // memoria, sistema pode mostrar mas nao salva.
      store.set('acessorios_lista', state.acessorios);
      store.set('acessorios_seeded', true);
    } else {
      // R20: normaliza tambem dados antigos (migracao silenciosa)
      state.acessorios = (lista || []).map(normalize);
    }
    // Felipe sessao 2026-08-03: limpa codigos com espacos extras e
    // deduplica entradas equivalentes. Cobre caso onde planilha original
    // tinha codigo com trailing space (ex: 'PA-DOWSIL 995 ') que ficou
    // como entrada separada do 'PA-DOWSIL 995' limpo.
    migrarLimpezaCodigos();
    // Felipe: Tedee Lock/Keypad/Bridge/Contato Seco/Kit Extensor 9300 nao
    // sao fechaduras digitais (sao acessorios). So sao fechaduras digitais
    // de verdade: Barcelona II, Eletronica 9300, Solenoide FS 1011.
    // Migracao reaplica famílias corretas pra usuarios que ja tem o seed
    // antigo no storage. Roda 1x por sessao.
    migrarFamiliaTedee();
    migrarPrecosAcessPdf();
    state.acessorios.sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR'));
    loaded = true;
  }

  /**
   * Felipe (sessao 2026-08): "lance todos os acessorios que te encaminhei".
   * PDF acess.pdf tinha 17 itens com codigos especificos. 14 existiam no
   * SEED com preco=0; 3 nao existiam (PA-LADEROCHA, PA-DOWSIL 995,
   * PA-ISOPOR PRANC 50).
   *
   * Esta migracao roda 1x por usuario:
   *   1. Atualiza preco dos 14 itens existentes (so' se o usuario nao
   *      mudou — preserva edicoes manuais).
   *   2. Adiciona os 3 itens novos se ainda nao existem no storage.
   *
   * Idempotente via flag 'migracao_precos_acess_pdf_v1'.
   */
  function migrarPrecosAcessPdf() {
    if (store.get('migracao_precos_acess_pdf_v1')) return;

    const PRECOS = {
      "PA-PIVOT 350 KG":         532.00,
      "PA-KESO12P+2ACM RL B":    863.94,
      "PA-KESO ROS RD BL":        15.26,
      "PA-KESOCIL150 BT CF":     859.63,
      "PA-CHA AA PHS 4,8X50":      0.24,
      "PA-BUCHA 06":               0.18,
      "PA-VED1220":              448.44,
      "PA-QL 48800":               7.58,
      "PA-QL 48700":               6.99,
      "PA-ISOPOR 125":             7.01,
      "PA-FITDF 19X20X1.0":       27.37,
      "PA-FITDF 12X20X1.0":       17.59,
      "PA-KESO CRT 4P RT CR":     36.61,
      "PA-KESO CXT 4P":           35.09,
    };
    const NOVOS = [
      { codigo: "PA-LADEROCHA",       fornecedor: "MERCADO", descricao: "LA DE ROCHA D32",              familia: "Isolante termico",                     preco: 9.41 },
      { codigo: "PA-DOWSIL 995",      fornecedor: "DOWSIL",  descricao: "DOWSIL 995 PRETO SACHE 591ML", familia: "Selantes > Silicones > Quimicos",      preco: 73.90 },
      { codigo: "PA-ISOPOR PRANC 50", fornecedor: "STYRO",   descricao: "EPS PLACA 50MM",               familia: "Embalagem",                            preco: 9.01 },
    ];

    let precosAtualizados = 0;
    state.acessorios.forEach(a => {
      const novoPreco = PRECOS[a.codigo];
      if (novoPreco != null) {
        // Preserva edicoes do usuario: so' atualiza se preco atual e' 0
        // (item nunca teve preco) ou se e' o mesmo do SEED antigo (0).
        const precoAtual = Number(a.preco) || 0;
        if (precoAtual === 0) {
          a.preco = novoPreco;
          precosAtualizados++;
        }
      }
    });

    let novosAdicionados = 0;
    const codigosExistentes = new Set(state.acessorios.map(a => a.codigo));
    NOVOS.forEach(novo => {
      if (!codigosExistentes.has(novo.codigo)) {
        state.acessorios.push(normalize(novo));
        novosAdicionados++;
      }
    });

    if (precosAtualizados > 0 || novosAdicionados > 0) {
      console.log(`[Acessorios] Migracao acess.pdf: ${precosAtualizados} preco(s) atualizado(s), ${novosAdicionados} novo(s) adicionado(s)`);
      store.set('acessorios_lista', state.acessorios);
    }
    store.set('migracao_precos_acess_pdf_v1', true);
  }

  // ────────────────────────────────────────────────────────────────────
  // Felipe sessao 2026-08-03: migracao de limpeza de codigos
  // ────────────────────────────────────────────────────────────────────
  // Cadastros antigos podem ter codigos com:
  //   - Espacos no inicio/fim:    'PA-DOWSIL 995 ' (trailing)
  //   - Espacos duplos no meio:   'PA-DOWSIL  995'
  //   - Variacoes de capitalizacao
  //
  // Resultado: importacao de planilha com 'PA-DOWSIL 995' (limpo) nao
  // encontrava o cadastro existente 'PA-DOWSIL 995 ' (sujo) e criava
  // uma nova entrada duplicada. O motor de orcamento procurava 'PA-DOWSIL 995'
  // exato e podia pegar a entrada errada (sem preco).
  //
  // Esta migracao:
  //   1. Limpa codigos (trim + collapse de espacos duplos)
  //   2. Deduplica entradas equivalentes
  //   3. Em conflito de preco, vence o que tem preco > 0
  // ────────────────────────────────────────────────────────────────────
  function migrarLimpezaCodigos() {
    if (store.get('migracao_limpeza_codigos_v1')) return;

    function normCmp(s) {
      return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
    }
    function limpaCodigo(s) {
      return String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
    }

    // Agrupa por codigo normalizado
    const grupos = {};
    state.acessorios.forEach(a => {
      const key = normCmp(a.codigo);
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(a);
    });

    // Pra cada grupo, escolhe um vencedor e limpa o codigo
    const novaLista = [];
    let limpos = 0, dedupados = 0;
    Object.keys(grupos).forEach(key => {
      const grupo = grupos[key];
      if (grupo.length === 1) {
        const a = grupo[0];
        const codigoLimpo = limpaCodigo(a.codigo);
        if (codigoLimpo !== a.codigo) {
          a.codigo = codigoLimpo;
          limpos++;
        }
        novaLista.push(a);
      } else {
        // Conflito: mescla pegando o melhor de cada
        // - codigo: limpo
        // - preco: maior (preco preenchido vence sobre 0)
        // - demais campos: do com preco > 0; senao do primeiro
        const comPreco = grupo.find(g => Number(g.preco) > 0);
        const base = comPreco || grupo[0];
        const merged = { ...base };
        merged.codigo = limpaCodigo(base.codigo);
        // Pega valores nao-vazios dos demais (campos que estao vazios na base)
        grupo.forEach(g => {
          ['fornecedor', 'descricao', 'familia'].forEach(campo => {
            if ((!merged[campo] || merged[campo] === '') && g[campo]) {
              merged[campo] = g[campo];
            }
          });
        });
        console.log('[Acessorios] Deduplicando "' + key + '": ' + grupo.length + ' entradas → 1 (preco final R$ ' + (merged.preco || 0) + ')');
        novaLista.push(merged);
        dedupados += (grupo.length - 1);
      }
    });

    if (limpos > 0 || dedupados > 0) {
      console.log('[Acessorios] ✅ Limpeza de codigos: ' + limpos + ' codigos limpos, ' + dedupados + ' entradas duplicadas mescladas');
      state.acessorios = novaLista;
      try {
        store.set('acessorios_lista', state.acessorios);
      } catch(_) {}
    }
    try {
      store.set('migracao_limpeza_codigos_v1', true);
    } catch(_) {}
  }

  function migrarFamiliaTedee() {
    // v3: Felipe quer Tedee Lock (a fechadura inteligente, 4 cores) APARECENDO
    // como Fechadura Digital. Tedee Keypad / Bridge / Contato Seco continuam
    // fora (sao perifericos). PA-9300-KIT continua como "Acessorios 9300".
    if (store.get('migracao_familia_tedee_v3_done')) return;
    const trocas = {
      // Tedee Lock = Fechadura Digital de verdade
      'PA-TEDEE-FEC-BRONZE':  'Fechadura Digital',
      'PA-TEDEE-FEC-DOURADA': 'Fechadura Digital',
      'PA-TEDEE-FEC-PRT/BRA': 'Fechadura Digital',
      'PA-TEDEE-FEC-PT':      'Fechadura Digital',
      // Periféricos Tedee = familia Tedee (fora do dropdown de fech digital)
      'PA-TEDEE-BRIDGE':      'Tedee',
      'PA-TEDEE-TEC-BR':      'Tedee',
      'PA-TEDEE-TEC-PT':      'Tedee',
      'PA-TEDEE-CONT SEC':    'Tedee',
      // Acessorios 9300 (kit extensor) — fora de fechadura
      'PA-9300-KIT':          'Acessorios 9300',
    };
    let mudou = false;
    state.acessorios.forEach(a => {
      const nova = trocas[a.codigo];
      // Aceita migrar de qualquer estado anterior (Fechadura Digital v0,
      // Acessorio Fechadura Digital v1, ou Tedee/Acessorios 9300 v2)
      if (nova && a.familia !== nova) {
        a.familia = nova;
        mudou = true;
      }
    });
    if (mudou) save();
    store.set('migracao_familia_tedee_v3_done', true);
  }

  function save() { store.set('acessorios_lista', state.acessorios); }

  function fmt(n) { return window.fmtBR ? window.fmtBR(n) : Number(n||0).toFixed(2); }
  function esc(s) { return window.escapeHtml ? window.escapeHtml(s) : String(s == null ? '' : s); }
  function parseN(v) { return window.parseBR ? window.parseBR(v) : Number(String(v||'0').replace(',','.')) || 0; }
  // R20: capitalizacao Title Case em campos de texto livre.
  function tc(s) { return window.Universal?.titleCase ? window.Universal.titleCase(s) : String(s||''); }
  // Normaliza um registro inteiro (descricao, fornecedor, familia em Title Case).
  // Codigo NAO eh normalizado — eh identificador, preserva exatamente.
  // Felipe (sessao 26 fix): preserva campos de impostos opcionais quando vierem
  // (preco_bruto, ipi, icm, pis, cofins). Se nao tiver, fica undefined (compat).
  // Felipe sessao 12: ESPACOS DUPLOS no codigo causavam codigos "fantasma"
  // tipo "PA-KESO CXT  AUX" (2 espacos). Felipe: "salvo e volta de novo
  // ai da erro, esse que escrevi e o correto". Agora trim + colapsa
  // multiplos whitespace em 1 espaco. Case preservado (pode ser
  // intencional). Comentario antigo "Codigo NAO eh normalizado" continua
  // valido pra case/letras — so' espacos sao limpos.
  function normalize(a) {
    var codigoLimpo = String(a.codigo == null ? '' : a.codigo).trim().replace(/\s+/g, ' ');
    const out = {
      codigo: codigoLimpo,
      fornecedor: tc(a.fornecedor),
      descricao: tc(a.descricao),
      familia: tc(a.familia),
      preco: Number(a.preco) || 0,
    };
    // Campos de impostos sao OPCIONAIS — so' inclui se vier algum valor preenchido
    if (a.preco_bruto !== undefined && a.preco_bruto !== null && a.preco_bruto !== '') {
      out.preco_bruto = Number(a.preco_bruto) || 0;
    }
    if (a.ipi !== undefined && a.ipi !== null && a.ipi !== '') {
      out.ipi = Number(a.ipi) || 0;
    }
    if (a.icm !== undefined && a.icm !== null && a.icm !== '') {
      out.icm = Number(a.icm) || 0;
    }
    if (a.pis !== undefined && a.pis !== null && a.pis !== '') {
      out.pis = Number(a.pis) || 0;
    }
    if (a.cofins !== undefined && a.cofins !== null && a.cofins !== '') {
      out.cofins = Number(a.cofins) || 0;
    }
    return out;
  }

  function setBtnSalvarEstado(isDirty) {
    if (!btnSalvarRef) return;
    btnSalvarRef.classList.toggle('is-dirty', !!isDirty);
    btnSalvarRef.textContent = isDirty ? 'Salvar Alteracoes' : '✓ Tudo salvo';
  }
  function markDirty() { dirty = true; setBtnSalvarEstado(true); }
  function salvarManual() {
    save();
    dirty = false;
    setBtnSalvarEstado(false);
    if (window.showSavedDialog) window.showSavedDialog('Alteracoes salvas com sucesso.');
  }

  function listarFornecedoresAtivos() {
    const set = new Set();
    state.acessorios.forEach(a => { if (a.fornecedor) set.add(a.fornecedor); });
    return Array.from(set).sort((a,b) => a.localeCompare(b, 'pt-BR'));
  }
  function listarFamiliasAtivas() {
    const set = new Set();
    state.acessorios.forEach(a => { if (a.familia) set.add(a.familia); });
    return Array.from(set).sort((a,b) => a.localeCompare(b, 'pt-BR'));
  }

  function aplicarBuscaEFiltros(lista) {
    const q = state.busca.trim().toLowerCase();
    return lista.filter(a => {
      if (state.filtroFornecedor && a.fornecedor !== state.filtroFornecedor) return false;
      if (state.filtroFamilia && a.familia !== state.filtroFamilia) return false;
      if (!q) return true;
      return [a.codigo, a.descricao, a.fornecedor, a.familia]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }
  function ordenar(lista) {
    // Sort eh feito por Universal.autoEnhance no DOM (R12+R18). Stub mantido
    // pra nao quebrar referencias; retorna lista intacta.
    return lista;
  }

  function render(container) {
    load();
    const total = state.acessorios.length;
    const comFamilia = state.acessorios.filter(a => a.familia).length;
    const comPreco = state.acessorios.filter(a => Number(a.preco) > 0).length;

    const fornAtivos = listarFornecedoresAtivos();
    const optsForn = fornAtivos.map(f =>
      `<option value="${esc(f)}" ${f === state.filtroFornecedor ? 'selected' : ''}>${esc(f)}</option>`
    ).join('');
    const famsAtivas = listarFamiliasAtivas();
    const optsFam = famsAtivas.map(f =>
      `<option value="${esc(f)}" ${f === state.filtroFamilia ? 'selected' : ''}>${esc(f)}</option>`
    ).join('');

    container.innerHTML = `
      <div class="ace-toolbar">
        <div class="ace-toolbar-row ace-toolbar-row-1">
          <div class="ace-toolbar-left">
            <span><span class="t-strong">${total}</span> acessorios</span>
            <span><span class="t-strong">${comFamilia}</span> com familia</span>
            <span><span class="t-strong">${comPreco}</span> com preco</span>
          </div>
          <div class="ace-toolbar-right">
            <button type="button" class="univ-btn-import" id="ace-btn-import">⤓ Importar planilha</button>
            <button type="button" class="univ-btn-export" id="ace-btn-export">⬇ Exportar Excel</button>
            <input type="file" id="ace-import-file" accept=".xlsx,.xls,.csv" style="display:none" />
            <button type="button" class="ace-btn-add" id="ace-btn-add-novo">+ Novo Acessorio</button>
            <button type="button" class="univ-btn-save" id="ace-btn-salvar">✓ Tudo salvo</button>
          </div>
        </div>
        <div class="ace-toolbar-row ace-toolbar-row-2">
          <input type="text" class="ace-search" id="ace-search"
            placeholder="Buscar por codigo, descricao, fornecedor, familia..."
            value="${esc(state.busca)}" />
          <div class="ace-filter-group">
            <label for="ace-filtro-fornecedor">Fornecedor:</label>
            <select class="ace-filter-select" id="ace-filtro-fornecedor">
              <option value="">— todos —</option>
              ${optsForn}
            </select>
          </div>
          <div class="ace-filter-group">
            <label for="ace-filtro-familia">Familia:</label>
            <select class="ace-filter-select" id="ace-filtro-familia">
              <option value="">— todas —</option>
              ${optsFam}
            </select>
          </div>
        </div>
      </div>
      <div id="ace-table-mount">${renderTable()}</div>

      <!-- Felipe (sessao 2026-08): "CADE A ABA DE ADICIONAR ACESSORIOS
           QUE JA PEDI 200X". Antes so' tinha botao "+ Novo Acessorio"
           na toolbar (em cima) que adicionava linha vazia. Felipe quer
           o mesmo padrao do cadastro de Perfis: formulario inline
           EMBAIXO da lista, com campos pra preencher e "+ Adicionar". -->
      <div class="cad-add-form">
        <h4>+ Adicionar Novo Acessorio</h4>
        <div class="cad-add-grid">
          <div>
            <div class="cad-param-label">Codigo</div>
            <input id="ace-add-codigo" class="cad-input" type="text" placeholder="" />
          </div>
          <div>
            <div class="cad-param-label">Fornecedor</div>
            <select id="ace-add-fornecedor" class="cad-input">
              <option value=""></option>
              ${getFornecedores().map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="cad-param-label">Descricao</div>
            <input id="ace-add-descricao" class="cad-input" type="text" placeholder="" />
          </div>
          <div>
            <div class="cad-param-label">Familia</div>
            <select id="ace-add-familia" class="cad-input">
              <option value=""></option>
              ${getFamilias().map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="cad-param-label">Preco (R$)</div>
            <input id="ace-add-preco" class="cad-input" type="text" inputmode="decimal" placeholder="0,00" />
          </div>
          <button class="btn btn-primary btn-sm" id="ace-btn-add-form" style="height:34px;">+ Adicionar</button>
        </div>
      </div>
    `;

    btnSalvarRef = container.querySelector('#ace-btn-salvar');
    dirty = false;
    setBtnSalvarEstado(false);

    bindEvents(container);
  }

  function renderTable() {
    const filtrados = ordenar(aplicarBuscaEFiltros(state.acessorios));
    if (filtrados.length === 0) {
      return `<div class="ace-empty">Nenhum acessorio encontrado.</div>`;
    }
    const linhas = filtrados.map((a) => {
      const idx = state.acessorios.indexOf(a);
      // Felipe (sessao 2026-08): "SE TIVER VALOR ZERADO EM ACESSORIOS,
      // TANTO EM CADASTRO QUANTO EM ORCAMENTO DESTACAR COM VERMELHO
      // BEM CLARO". Linhas com preco=0 ficam com fundo vermelho claro
      // pra Felipe identificar imediatamente o que falta cadastrar.
      const zerado = (Number(a.preco) || 0) === 0;
      const cls = zerado ? 'ace-row-zerado' : '';
      return `
        <tr data-idx="${idx}" class="${cls}">
          <td><input class="ace-input" data-field="codigo" value="${esc(a.codigo)}" /></td>
          <td>
            <select class="ace-input ace-select" data-field="fornecedor">
              ${['<option value=""></option>'].concat(getFornecedores().map(f => { const v = tc(f); return `<option value="${esc(v)}" ${v === a.fornecedor ? 'selected' : ''}>${esc(v)}</option>`; })).join('')}
            </select>
          </td>
          <td><input class="ace-input ace-input-wide" data-field="descricao" value="${esc(a.descricao)}" /></td>
          <td>
            <select class="ace-input ace-select" data-field="familia">
              ${['<option value=""></option>'].concat(getFamilias().map(f => { const v = tc(f); return `<option value="${esc(v)}" ${v === a.familia ? 'selected' : ''}>${esc(v)}</option>`; })).join('')}
            </select>
          </td>
          <td><input class="ace-input ace-input-num" data-field="preco" value="${fmt(a.preco)}" inputmode="decimal" /></td>
          <td><button type="button" class="ace-btn-remove" data-action="remover" data-idx="${idx}" title="Excluir acessorio">×</button></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="ace-table-wrap">
        <table class="ace-table cad-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Fornecedor</th>
              <th>Descricao</th>
              <th>Familia</th>
              <th class="ace-th-num" data-no-filter="1">R$</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    `;
  }

  function rerenderTable(container) {
    const mount = container.querySelector('#ace-table-mount');
    if (!mount) return;
    mount.innerHTML = renderTable();
    bindRowEvents(container);
    const tbl = container.querySelector('.ace-table');
    if (tbl && window.Universal) window.Universal.autoEnhance(tbl, { skipCols: ['actions'] });
  }
  function rerenderTudo(container) { render(container); }

  function bindEvents(container) {
    container.querySelector('#ace-btn-salvar')?.addEventListener('click', salvarManual);
    container.querySelector('#ace-btn-add-novo')?.addEventListener('click', () => {
      state.acessorios.unshift({ codigo: '', fornecedor: '', descricao: '', familia: '', preco: 0 });
      markDirty();
      save();
      rerenderTudo(container);
      setTimeout(() => {
        const first = container.querySelector('input[data-field="codigo"]');
        if (first) first.focus();
      }, 30);
    });

    // Felipe (sessao 2026-08): handler do form inline "+ Adicionar
    // novo acessorio" (embaixo da lista, padrao Perfis).
    container.querySelector('#ace-btn-add-form')?.addEventListener('click', () => {
      const codigo     = container.querySelector('#ace-add-codigo')?.value.trim() || '';
      const fornecedor = container.querySelector('#ace-add-fornecedor')?.value.trim() || '';
      const descricao  = container.querySelector('#ace-add-descricao')?.value.trim() || '';
      const familia    = container.querySelector('#ace-add-familia')?.value.trim() || '';
      const precoStr   = container.querySelector('#ace-add-preco')?.value || '';
      const preco      = window.parseBR ? window.parseBR(precoStr) : (parseFloat(precoStr.replace(',', '.')) || 0);
      if (!codigo) {
        alert('Informe o codigo do acessorio.');
        return;
      }
      if (state.acessorios.some(a => String(a.codigo).toLowerCase() === codigo.toLowerCase())) {
        if (!confirm(`Ja existe um acessorio com codigo "${codigo}". Adicionar mesmo assim?`)) return;
      }
      state.acessorios.unshift({ codigo, fornecedor, descricao, familia, preco });
      markDirty();
      save();
      rerenderTudo(container);
      // limpa o form e foca no codigo pra proxima entrada
      setTimeout(() => {
        const inpCodigo = container.querySelector('#ace-add-codigo');
        if (inpCodigo) {
          inpCodigo.value = '';
          inpCodigo.focus();
        }
        const inpDesc = container.querySelector('#ace-add-descricao');
        if (inpDesc) inpDesc.value = '';
        const inpPreco = container.querySelector('#ace-add-preco');
        if (inpPreco) inpPreco.value = '';
      }, 30);
    });

    container.querySelector('#ace-btn-export')?.addEventListener('click', exportarXLSX);
    const fileInput = container.querySelector('#ace-import-file');
    container.querySelector('#ace-btn-import')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importarXLSX(f, container);
      e.target.value = '';
    });

    const busca = container.querySelector('#ace-search');
    busca?.addEventListener('input', (e) => {
      state.busca = e.target.value;
      rerenderTable(container);
    });
    container.querySelector('#ace-filtro-fornecedor')?.addEventListener('change', (e) => {
      state.filtroFornecedor = e.target.value;
      rerenderTudo(container);
    });
    container.querySelector('#ace-filtro-familia')?.addEventListener('change', (e) => {
      state.filtroFamilia = e.target.value;
      rerenderTudo(container);
    });

    // R12 + R14 + R18 via Universal helper
    const tbl = container.querySelector('.ace-table');
    if (tbl && window.Universal) window.Universal.autoEnhance(tbl, { skipCols: ['actions'] });

    bindRowEvents(container);
  }

  function bindRowEvents(container) {
    container.querySelectorAll('.ace-table tbody tr').forEach(tr => {
      const idx = Number(tr.dataset.idx);
      const a = state.acessorios[idx];
      if (!a) return;
      tr.querySelectorAll('input, select').forEach(el => {
        const field = el.dataset.field;
        if (!field) return;
        el.addEventListener('change', () => {
          if (field === 'preco') {
            a.preco = parseN(el.value);
            el.value = fmt(a.preco);
          } else if (field === 'codigo') {
            a.codigo = el.value; // codigo nao normaliza
          } else {
            // R20: campos de texto livre normalizam pra Title Case
            a[field] = tc(el.value);
            el.value = a[field];
          }
          markDirty();
          save();
        });
      });
    });
    container.querySelectorAll('.ace-btn-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const a = state.acessorios[idx];
        if (!a) return;
        const ok = confirm(`Excluir acessorio "${a.codigo || '(sem codigo)'}"?\n\n${a.descricao || ''}\n\nEsta acao nao pode ser desfeita.`);
        if (!ok) return;
        state.acessorios.splice(idx, 1);
        markDirty();
        save();
        const c = btn.closest('.ace-toolbar')?.parentElement || document.querySelector('#main-content');
        if (c) rerenderTudo(c);
      });
    });
  }

  /**
   * Felipe (sessao 26 fix): exporta planilha com FORMULAS de impostos.
   * Estrutura compativel com a planilha que Felipe usa internamente:
   *   A: Codigo
   *   B: Fornecedor
   *   C: Descricao
   *   D: Familia
   *   E: Preco (R$)         = formula =L{n} (preco LIQUIDO calculado)
   *   F: (sem header)        = preco_bruto (valor)
   *   G: IPI                 (% — informativo)
   *   H: ICM                 (% — usado na formula)
   *   I: PIS                 (% — usado na formula)
   *   J: COFINS              (% — usado na formula)
   *   K: (sem header)
   *   L: (sem header)        = formula liquido = F - F*H - (F - F*H)*(I+J)
   *   M: (sem header)
   *   N: (sem header)        = formula desconto efetivo = IF(L=0,0,1-(L/F))
   *
   * Felipe atualiza alíquotas/bruto na planilha → fórmulas recalculam →
   * coluna E mantém o líquido sempre certo. Re-importar pega só E.
   *
   * Compat: registros antigos sem preco_bruto/impostos sao exportados
   * com F=preco (líquido vira bruto, default), impostos = 0. Daí L=F=E.
   */
  function exportarXLSX() {
    const headers = ['Codigo','Fornecedor','Descricao','Familia','Preco (R$)','','IPI','ICM','PIS','COFINS','','','',''];
    const rows = state.acessorios.map((a, i) => {
      const linha = i + 2; // linha 1 = header, dados começam em 2
      // Fallback: se item nao tem dados de impostos cadastrados, usa preco
      // como bruto (compat). Felipe pode atualizar depois.
      const bruto  = (a.preco_bruto !== undefined && a.preco_bruto !== null && a.preco_bruto !== '')
                     ? Number(a.preco_bruto) : (Number(a.preco) || 0);
      const ipi    = Number(a.ipi)    || 0;
      const icm    = Number(a.icm)    || 0;
      const pis    = Number(a.pis)    || 0;
      const cofins = Number(a.cofins) || 0;

      return [
        a.codigo || '',                                                         // A
        a.fornecedor || '',                                                     // B
        a.descricao || '',                                                      // C
        a.familia || '',                                                        // D
        // E: formula =L{n} com formato R$
        { f: `L${linha}`, t: 'n', z: '"R$ "#,##0.0000' },
        // F: preco bruto (input do Felipe)
        { v: bruto, t: 'n', z: '"R$ "#,##0.0000' },
        // G: IPI (decimal — 0.04 = 4%)
        { v: ipi, t: 'n', z: '0.00%' },
        // H: ICM
        { v: icm, t: 'n', z: '0.00%' },
        // I: PIS
        { v: pis, t: 'n', z: '0.00%' },
        // J: COFINS
        { v: cofins, t: 'n', z: '0.00%' },
        '',  // K
        // L: formula liquido — F - F*H - (F - F*H)*(I+J)
        { f: `F${linha}-(F${linha}*H${linha})-(F${linha}-(F${linha}*H${linha}))*(I${linha}+J${linha})`, t: 'n', z: '"R$ "#,##0.0000' },
        '',  // M
        // N: formula desconto efetivo
        { f: `IF(L${linha}=0,0,1-(L${linha}/F${linha}))`, t: 'n', z: '0.00%' },
      ];
    });

    // Larguras de coluna
    const colWidths = [22, 18, 50, 22, 14, 14, 8, 8, 8, 9, 4, 14, 4, 12];

    if (window.Universal?.exportXLSXAvancado) {
      window.Universal.exportXLSXAvancado({
        headers, rows, colWidths,
        sheetName: 'Acessorios', fileName: 'acessorios_projetta',
      });
    } else if (window.Universal?.exportXLSX) {
      // Fallback: export simples sem formulas (versao antiga do Universal)
      const headersSimples = ['Codigo','Fornecedor','Descricao','Familia','Preco (R$)'];
      const rowsSimples = state.acessorios.map(a => [
        a.codigo || '', a.fornecedor || '', a.descricao || '',
        a.familia || '', Number(a.preco) || 0,
      ]);
      window.Universal.exportXLSX({
        headers: headersSimples, rows: rowsSimples,
        sheetName: 'Acessorios', fileName: 'acessorios_projetta',
      });
    }
  }

  function importarXLSX(file, container) {
    if (!window.Universal?.readXLSXFile) return;
    window.Universal.readXLSXFile(file, (aoa, fileName) => {
      if (!aoa || aoa.length < 2) {
        alert('A planilha esta vazia ou sem linhas de dados.');
        return;
      }
      // Felipe (sessao 26 fix): aceitar colunas extras de impostos.
      // Felipe enviou planilha com IPI/ICM/PIS/COFINS pra documentar
      // o calculo do liquido. Importacao pega o "Preco (R$)" (col E,
      // que tem formula =L resolvida pelo Excel = LIQUIDO ja calculado)
      // e SE existir, tambem salva preco_bruto e impostos para o export
      // posterior conseguir reconstruir as formulas.
      const idx = window.Universal.parseHeaders(aoa[0], {
        codigo:      'codigo',
        fornecedor:  'fornecedor',
        descricao:   'descricao',
        familia:     'familia',
        preco:       'preco (r$)',
        ipi:         'ipi',
        icm:         'icm',
        pis:         'pis',
        cofins:      'cofins',
      });
      if (idx.codigo === -1) {
        alert('A planilha nao tem coluna "Codigo" (chave do registro).\nColunas esperadas: Codigo, Fornecedor, Descricao, Familia, Preco (R$)');
        return;
      }
      let novos = 0, atualizados = 0, ignorados = 0;
      // Felipe (sessao 2026-05): coletar valores NOVOS de fornecedor/familia
      // que ainda nao estao no cadastro de Filtros — depois oferecer
      // adicionar pra liberar uso desses valores no select dos formularios.
      const fornecedoresAtuais = new Set(getFornecedores().map(s => String(s).toLowerCase()));
      const familiasAtuais     = new Set(getFamilias().map(s => String(s).toLowerCase()));
      const novosFornecedores  = new Set();
      const novasFamilias      = new Set();

      // Felipe (sessao 26 fix): se a planilha tem coluna "preco_bruto"
      // (col F sem header) ou estrutura nossa de export, captura isso.
      // No padrao do Felipe a coluna F nao tem header, entao tentamos
      // achar pelo INDICE proximo ao Preco (E). Se Preco esta no indice
      // X, F = bruto = X+1. Mas so' faz isso se nao houver header de
      // outra coluna ali (defensivo).
      const idxPrecoBrutoFallback = (idx.preco >= 0 && (aoa[0][idx.preco + 1] === '' || aoa[0][idx.preco + 1] === undefined))
                                    ? idx.preco + 1 : -1;

      for (let i = 1; i < aoa.length; i++) {
        const row = aoa[i];
        const codigo = String(row[idx.codigo] || '').trim();
        if (!codigo) { ignorados++; continue; }
        const dados = {
          codigo,
          fornecedor: idx.fornecedor >= 0 ? tc(String(row[idx.fornecedor] || '').trim()) : '',
          descricao:  idx.descricao >= 0  ? tc(String(row[idx.descricao] || '').trim()) : '',
          familia:    idx.familia >= 0    ? tc(String(row[idx.familia] || '').trim()) : '',
          preco:      idx.preco >= 0      ? parseN(row[idx.preco]) : 0,
        };
        // Campos opcionais — captura se vierem na planilha
        if (idxPrecoBrutoFallback >= 0) {
          const v = parseN(row[idxPrecoBrutoFallback]);
          if (v > 0) dados.preco_bruto = v;
        }
        if (idx.ipi    >= 0) { const v = parseN(row[idx.ipi]);    if (v > 0) dados.ipi    = v; }
        if (idx.icm    >= 0) { const v = parseN(row[idx.icm]);    if (v > 0) dados.icm    = v; }
        if (idx.pis    >= 0) { const v = parseN(row[idx.pis]);    if (v > 0) dados.pis    = v; }
        if (idx.cofins >= 0) { const v = parseN(row[idx.cofins]); if (v > 0) dados.cofins = v; }
        // Felipe (sessao 26 fix): fallback — se preco=0 mas tem bruto > 0,
        // calcula o liquido pela formula (caso Felipe nao abra no Excel
        // antes de re-importar, formula nao tem cache e vem como 0):
        //   liquido = bruto - (bruto * icm) - (bruto - bruto*icm) * (pis + cofins)
        if (dados.preco === 0 && dados.preco_bruto && dados.preco_bruto > 0) {
          const F = dados.preco_bruto;
          const H = dados.icm    || 0;
          const I = dados.pis    || 0;
          const J = dados.cofins || 0;
          dados.preco = F - (F * H) - (F - (F * H)) * (I + J);
        }
        // Detectar valores novos
        if (dados.fornecedor && !fornecedoresAtuais.has(dados.fornecedor.toLowerCase())) {
          novosFornecedores.add(dados.fornecedor);
        }
        if (dados.familia && !familiasAtuais.has(dados.familia.toLowerCase())) {
          novasFamilias.add(dados.familia);
        }
        // Felipe sessao 2026-08-03: comparacao normalizada do codigo.
        // Cadastros antigos podem ter espacos extras (ex: 'PA-DOWSIL 995 '
        // com trailing space). Importacao limpa o novo (trim) mas precisa
        // achar o existente mesmo se ele estiver sujo. Comparamos as duas
        // versoes normalizadas (trim + collapse de espacos duplos + lower).
        function normCodigoCmp(s) {
          return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
        }
        const codigoNorm = normCodigoCmp(codigo);
        const existente = state.acessorios.find(a => normCodigoCmp(a.codigo) === codigoNorm);
        if (existente) {
          // Aproveita pra limpar o codigo do existente tambem (se estava sujo)
          if (existente.codigo !== codigo) {
            console.log('[Acessorios] Normalizando codigo: ' + JSON.stringify(existente.codigo) + ' -> ' + JSON.stringify(codigo));
          }
          Object.assign(existente, dados);
          existente.codigo = codigo; // forca uso do codigo limpo
          atualizados++;
        } else {
          state.acessorios.push(dados);
          novos++;
        }
      }
      if (novos + atualizados === 0) {
        alert(`Nenhuma linha valida em "${fileName}".`);
        return;
      }
      const ok = confirm(`Importar de "${fileName}"?\n\n${novos} novo(s), ${atualizados} atualizado(s).\n` +
        (ignorados > 0 ? `${ignorados} linha(s) sem codigo serao ignoradas.\n` : '') +
        `\nAcessorios existentes que NAO estao no arquivo serao MANTIDOS no cadastro (so' os listados na planilha sao alterados).\n\nConfirmar?`);
      if (!ok) {
        state.acessorios = store.get('acessorios_lista') || state.acessorios;
        return;
      }
      save();
      // Felipe (sessao 13): "EU IPORTO PLANILHA ALTERA, AI NAO FICA SALVO".
      // Causa provavel: sbUpsert tem debounce de 500ms. Se o usuario fechar
      // a aba ou navegar antes do timer disparar, o sync com Supabase
      // nunca acontece. Outras maquinas (e o proprio reload) puxam a
      // versao stale do cloud e o import "some". FIX: forca flush imediato
      // dos saves pendentes (cancela debounce e dispara fetch agora).
      try {
        if (window.Database && typeof window.Database.flushSbUpsertPendentes === 'function') {
          window.Database.flushSbUpsertPendentes();
          console.log('[Acessorios] Import: flush sbUpsert pendentes disparado (sync imediato com cloud).');
        }
      } catch (e) {
        console.warn('[Acessorios] Import: flushSbUpsertPendentes falhou:', e);
      }
      rerenderTudo(container);

      // Felipe (sessao 2026-05): apos importar com sucesso, perguntar
      // sobre valores novos detectados em fornecedor/familia.
      // Se modulo Filtros nao estiver disponivel, ignora silenciosamente.
      if (window.Filtros && typeof window.Filtros.adicionar === 'function') {
        if (novosFornecedores.size > 0) {
          const lista = Array.from(novosFornecedores).sort();
          const msg = `A planilha trouxe ${lista.length} fornecedor(es) que NAO estao no cadastro de Filtros:\n\n` +
                      `• ${lista.join('\n• ')}\n\n` +
                      `Deseja ADICIONAR esses fornecedores ao cadastro de Filtros (Cadastros > Filtros > Fornecedor de Acessorios)?\n\n` +
                      `→ OK = adicionar todos\n→ Cancelar = manter fora do cadastro (ainda visiveis nos itens importados, mas nao selecionaveis em novos cadastros)`;
          if (confirm(msg)) {
            let adicionados = 0;
            lista.forEach(f => { if (window.Filtros.adicionar('acessorios_fornecedor', f)) adicionados++; });
            console.log(`[acessorios] ${adicionados} fornecedor(es) adicionados ao Filtros`);
          }
        }
        if (novasFamilias.size > 0) {
          const lista = Array.from(novasFamilias).sort();
          const msg = `A planilha trouxe ${lista.length} familia(s) que NAO estao no cadastro de Filtros:\n\n` +
                      `• ${lista.join('\n• ')}\n\n` +
                      `Deseja ADICIONAR essas familias ao cadastro de Filtros (Cadastros > Filtros > Familia de Acessorios)?\n\n` +
                      `→ OK = adicionar todas\n→ Cancelar = manter fora do cadastro (ainda visiveis nos itens importados, mas nao selecionaveis em novos cadastros)`;
          if (confirm(msg)) {
            let adicionadas = 0;
            lista.forEach(f => { if (window.Filtros.adicionar('acessorios_familia', f)) adicionadas++; });
            console.log(`[acessorios] ${adicionadas} familia(s) adicionadas ao Filtros`);
          }
        }
      }

      if (window.showSavedDialog) {
        const totaisNovos = novosFornecedores.size + novasFamilias.size;
        const sufixo = totaisNovos > 0 ? `\n\n${totaisNovos} valor(es) novo(s) detectado(s) em filtros — ver pop-ups acima.` : '';
        window.showSavedDialog(`Importacao concluida!\n${novos} novo(s), ${atualizados} atualizado(s).${sufixo}`);
      }
    });
  }

  // Felipe (R-inegociavel): tudo puxa do cadastro. Helper exposto pra
  // garantir que o seed seja inserido mesmo se a aba nao foi aberta —
  // evita o bug em que o orcamento via `cad.get('acessorios_lista')`
  // retornar [] quando o usuario nunca renderizou Cadastros > Acessorios.
  function listar() {
    load();
    return state.acessorios.slice();
  }

  return { render, listar };
})();

if (typeof window !== 'undefined') {
  window.Acessorios = Acessorios;
}
