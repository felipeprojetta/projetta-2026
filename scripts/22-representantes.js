/* 22-representantes.js — Cadastros > Representantes.
   Cadastro de representantes (entidades juridicas) cruzado
   com seus contatos pessoais (nome/cargo/tel/email).

   Funcao primaria: dado um followup que vem da intranet Weiku
   (ex: 'ANDERSON_JARAGUA'), retornar a razao social e o nome
   do contato principal pra preencher no CRM.

   Storage: projetta:cadastros:representantes_lista
   Seed: 55 reps importados da planilha "Controle Representantes
   Projetta - TEL EMAIL.xlsx". */

/* ============================================================
   MODULO: REPRESENTANTES
   ============================================================
   Cadastro de representantes (entidades juridicas) cruzado
   com seus contatos pessoais (nome/cargo/tel/email).

   Funcao primaria: dado um followup que vem da intranet Weiku
   (ex: 'ANDERSON_JARAGUA'), retornar a razao social e o nome
   do contato principal pra preencher no CRM.

   Storage: projetta:cadastros:representantes_lista
   Seed: 55 reps importados da planilha "Controle Representantes
   Projetta - TEL EMAIL.xlsx" (cruzando ETIELE + ADAPTADO).
   ============================================================ */
const Representantes = (() => {
  const SEED_REPRESENTANTES = [{"followup":"ANDERSON_JARAGUA","bra":"BRA01.01","razao_social":"Andy Representações Comerciais Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Luiz Starke","vendedores":"","contatos":[{"nome":"ANDERSON SCHNEIDER","cargo":"REPRESENTANTE","telefone":"(47) 98416-0071","email":"anderson.s@weiku.com.br"}]},{"followup":"SC_JOAOBEHLING","bra":"BRA01.01","razao_social":"João Tiago Behling – ME","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Luiz Starke","vendedores":"","contatos":[]},{"followup":"NELSON_COLANTUANO","bra":"BRA01.01","razao_social":"Nec Representações Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Luiz Starke","vendedores":"","contatos":[{"nome":"RAFAEL COLANTUANO","cargo":"REPRESENTANTE","telefone":"(47)99170-4030","email":"representacoes.nec@gmail.com"},{"nome":"RENATA CONLANTUANO","cargo":"REPRESENTANTE","telefone":"(47)99170-4030","email":"representacoes.nec@gmail.com"}]},{"followup":"SC_POSTESPAIM_REP","bra":"BRA01.01","razao_social":"Pontes Paim Representação Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Luiz Starke","vendedores":"José Carlos e Adilson","contatos":[]},{"followup":"SC_SOLARIS_DECOR","bra":"BRA01.01","razao_social":"Solaris Decor Eireli","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Luiz Starke","supervisor":"Luiz Starke","vendedores":"Diego e Larissa","contatos":[{"nome":"LARISSA FORMIGONI","cargo":"REPRESENTANTE","telefone":"(47) 98813-3058","email":"vendas85@weiku.com.br"},{"nome":"GUSTAVO THONSEN","cargo":"REPRESENTANTE","telefone":"(47) 98827-3056","email":"vendas88@weiku.com.br"},{"nome":"KELLEN ROCHA","cargo":"REPRESENTANTE","telefone":"(47) 98829-4928","email":"vendas88@weiku.com.br"},{"nome":"DIEGO FRIGERI","cargo":"REPRESENTANTE","telefone":"47) 988294928","email":"bc.rep@weiku.com.br"}]},{"followup":"LEO_CERUTTI","bra":"BRA01.01","razao_social":"Léo Cerutti","classificacao":"Vendedor","comissao_maxima":0.02,"gerente":"Luiz Starke","supervisor":"Luiz Starke","vendedores":"","contatos":[{"nome":"LÉO CERUTTI","cargo":"REPRESENTANTE","telefone":"(47)99614-7541","email":"leo.c@weiku.com.br"}]},{"followup":"RS_CARINA_BACKES","bra":"BRA01.02","razao_social":"Carina Backes Alves - Representações","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"","contatos":[{"nome":"CARINA BACKES","cargo":"REPRESENTANTE","telefone":"(51) 99883-9283","email":"novohamburgo.rep@weiku.com.br"}]},{"followup":"RS_ELY_ENGENHARIA","bra":"BRA01.02","razao_social":"Ely Engenharia e Consultoria Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"","contatos":[{"nome":"RICARDO SHLEMM ELY","cargo":"REPRESENTANTE","telefone":"(51) 99808-0582","email":"vendas57@weiku.com.br"},{"nome":"ANDRE DEHNHARDT ELY","cargo":"REPRESENTANTE","telefone":"(51) 99981-7789","email":"andreely79@gmail.com"}]},{"followup":"RS_LUCIANA_CUNHA","bra":"BRA01.02","razao_social":"Luciana Cunha de Oliveira Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"","contatos":[{"nome":"LUCIANA CUNHA DE OLIVEIRA","cargo":"REPRESENTANTE","telefone":"(53) 98111-4345","email":"pelotas.rep@weiku.com.br"}]},{"followup":"RS_TUTIPROJETOS_REP","bra":"BRA01.02","razao_social":"Tuti Projetos Arquitetonicos Ltda","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"Simone e Deise","contatos":[{"nome":"DEISE DE CONTO","cargo":"REPRESENTANTE","telefone":"(54)99914-5918","email":"vendas45@weiku.com.br"}]},{"followup":"RS_DION_H","bra":"BRA01.02","razao_social":"Dion Lenon Nunes Hernandes Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"","contatos":[{"nome":"DION LENON NUNES HERNANDES","cargo":"REPRESENTANTE","telefone":"(51) 99905-6943","email":"portoalegre.rep@weiku.com.br"}]},{"followup":"MARCOS_TIMBO","bra":"BRA01.02","razao_social":"Marcos Daniel Leonhardt","classificacao":"Vendedor","comissao_maxima":0.02,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"","contatos":[{"nome":"MARCOS DANIEL LEONHARDT","cargo":"REPRESENTANTE","telefone":"(47) 99649-1222","email":"vendas26@weiku.com.br"}]},{"followup":"DANIEL_FLORES","bra":"BRA01.02","razao_social":"Flores Consultoria Empresarial Ltda","classificacao":"Coordenador","comissao_maxima":0.0,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"","contatos":[{"nome":"DANIEL DE MELLO FLORES","cargo":"COORDENADOR DE VENDAS","telefone":"(47) 98803-8440","email":"daniel.flores@weiku.com.br"}]},{"followup":"RS_ESTEVAN","bra":"BRA01.02","razao_social":"Estevan Furlan da Silva Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"","contatos":[{"nome":"ESTEVAN FURLAN DA SILVA","cargo":"REPRESENTANTE","telefone":"(54)99229-4126","email":"vendas11@weiku.com.br"}]},{"followup":"RS_LUZ4","bra":"BRA01.02","razao_social":"Luz 4 Representações Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"","contatos":[]},{"followup":"ELO_FORTE_F._WESTPHALEN","bra":"BRA01.02","razao_social":"Elo Forte Representações Ltda","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"","contatos":[]},{"followup":"RS_PANISSON","bra":"BRA01.02","razao_social":"Panisson Representações Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"Anderson e Luciana","contatos":[{"nome":"ANDERSON PANISSON","cargo":"REPRESENTANTE","telefone":"(54) 99691-6768","email":"vendas86@weiku.com.br"},{"nome":"LUCIANA CAMARGO","cargo":"REPRESENTANTE","telefone":"(54) 99691-6768","email":"vendas86@weiku.com.br"}]},{"followup":"RS_LUANA.NADALON","bra":"BRA01.02","razao_social":"Luana Nadalon Godoi","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Daniel Flores","vendedores":"Marcelo Nunes","contatos":[]},{"followup":"SC_ADRIANO","bra":"BRA01.03","razao_social":"Adriano Dorigon Representações Comerciais Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Luiz Starke","vendedores":"Adriano e Junior","contatos":[{"nome":"CARLOS MONTAGNA JUNIOR","cargo":"REPRESENTANTE","telefone":"(49) 9998-0034","email":"chapeco.rep@weiku.com.br"},{"nome":"ADRIANO DORIGON","cargo":"REPRESENTANTE","telefone":"(49) 9998-0034","email":"chapeco.rep@weiku.com.br"}]},{"followup":"ADALBERTO","bra":"BRA01.03","razao_social":"Adalberto Fanderuff & Cia Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Luiz Starke","supervisor":"Luiz Starke","vendedores":"Adalberto e Ladislau","contatos":[{"nome":"ADALBERTO FANDERUFF","cargo":"REPRESENTANTE","telefone":"(47) 99996-5351","email":"betofandera@gmail.com"}]},{"followup":"QUALITA3","bra":"BRA02.01","razao_social":"Bel-Master 3 Representações","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"Yanara Abreu","contatos":[{"nome":"YANARA ABREU","cargo":"REPRESENTANTE","telefone":"(41) 99641-0143","email":"yanara.qualita@weiku.com.br"}]},{"followup":"QUALITA4","bra":"BRA02.01","razao_social":"Bel-Master 4 Representações","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"Eduardo Frasson","contatos":[{"nome":"EDUARDO FRASSON","cargo":"REPRESENTANTE","telefone":"(41) 99644-0161","email":"eduardo.qualita@weiku.com.br"}]},{"followup":"QUALITA5","bra":"BRA02.01","razao_social":"Bel-Master 5 Representações","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"Gustavo Guarengui","contatos":[{"nome":"GUSTAVO GUARENGHI","cargo":"REPRESENTANTE","telefone":"(41) 99875-0822","email":"gustavo.qualita@weiku.com.br"}]},{"followup":"QUALITA6","bra":"BRA02.01","razao_social":"Bel-Master 6 Representações","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"Emily Rocha","contatos":[{"nome":"EMILY ROCHA","cargo":"REPRESENTANTE","telefone":"(41) 99803 0509","email":"iara.qualita@weiku.com.br"}]},{"followup":"PR_KAR_REP","bra":"BRA02.01","razao_social":"KAR Representação Comercial Ltda","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"Carina","contatos":[{"nome":"CARINA AP DA CUNHA KAZAHAYA","cargo":"REPRESENTANTE","telefone":"(42)99911-6110","email":"representacoeskar@gmail.com"},{"nome":"JURILDO CUNHA","cargo":"REPRESENTANTE","telefone":"(41) 8859-1244","email":"camposgerais.rep@weiku.com.br"}]},{"followup":"PR_KAR_REP","bra":"BRA02.01","razao_social":"KAR Representação Comercial Ltda","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"Carina e Leandro Ono","contatos":[{"nome":"CARINA AP DA CUNHA KAZAHAYA","cargo":"REPRESENTANTE","telefone":"(42)99911-6110","email":"representacoeskar@gmail.com"},{"nome":"JURILDO CUNHA","cargo":"REPRESENTANTE","telefone":"(41) 8859-1244","email":"camposgerais.rep@weiku.com.br"}]},{"followup":"PR_FAZSOL","bra":"BRA02.01","razao_social":"Fazsol Empreendimentos de Geração Solar Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"","contatos":[{"nome":"RAFAEL CARLOS JUNG SPEROTTO","cargo":"REPRESENTANTE","telefone":"(45) 98429-2717","email":"vendas47@weiku.com.br"}]},{"followup":"MS_PRIMEIRA_LINHA_REP","bra":"BRA02.01","razao_social":"Zenith Esquadrias Especiais Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"Sérgio e Giovani","contatos":[{"nome":"GEOVANI BRAGA","cargo":"REPRESENTANTE","telefone":"(67) 99985-5502","email":"dourados.rep@weiku.com.br"}]},{"followup":"SP_CENTENARIO","bra":"BRA02.01","razao_social":"Leal Batista Construtora Ltda (Bom Piso)","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"Adriano e Arthur","contatos":[]},{"followup":"SP_MDG","bra":"BRA02.01","razao_social":"MDG Representação Comercial Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"","contatos":[{"nome":"MARCIO DANIEL GNIGLER","cargo":"REPRESENTANTE","telefone":"(17) 98143-5034","email":"vendas49@weiku.com.br"}]},{"followup":"PR_GROHE","bra":"BRA02.01","razao_social":"Grohe Representações e Engenharia Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"","contatos":[{"nome":"GIOVANA MELRIAN GROHE","cargo":"REPRESENTANTE","telefone":"(46)98413-1641","email":"gmelrian@gmail.com"}]},{"followup":"SP_ABARCA","bra":"BRA02.01","razao_social":"Abarca Representações Comerciais Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"SP_ABARCA","contatos":[{"nome":"MARCELO ABARCA DE OLIVEIRA","cargo":"REPRESENTANTE","telefone":"(16)99390-0077","email":"vendas80@weiku.com.br"}]},{"followup":"SP_V2","bra":"BRA02.01","razao_social":"V2 Comércio de Pisos e Revestimentos Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Marcos Matos","supervisor":"Marcos Matos","vendedores":"","contatos":[{"nome":"VICTOR MENDES DE SÁ","cargo":"REPRESENTANTE","telefone":"(14) 98156-0066","email":"victor_llooll@hotmail.com"}]},{"followup":"PR_LEONARDO_GUARENGHI","bra":"BRA02.02","razao_social":"Critério Acabamentos Finos Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Marcos Matos","supervisor":"Luiz Moretto","vendedores":"","contatos":[{"nome":"LEONARDO GUARENGHI","cargo":"REPRESENTANTE","telefone":"(41) 99604-1956","email":"angradoce.rep@weiku.com.br"}]},{"followup":"PR_ADRIANA_LONDRINA","bra":"BRA02.02","razao_social":"Adriana Karen de Souza ME","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Marcos Matos","supervisor":"Luiz Moretto","vendedores":"","contatos":[{"nome":"ADRIANA KAREN DE SOUZA","cargo":"REPRESENTANTE","telefone":"(43) 98816-7289","email":"londrina.rep@weiku.com.br"},{"nome":"BRUNA PAIXÃO","cargo":"REPRESENTANTE","telefone":"(43) 98816-7289","email":"londrina.rep@weiku.com.br"}]},{"followup":"SP_ERICSON_VENANCIO","bra":"BRA02.02","razao_social":"Ericson Venancio dos Santos - ME","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Marcos Matos","supervisor":"Luiz Moretto","vendedores":"","contatos":[{"nome":"ERICSON VENANCIO DOS SANTOS","cargo":"REPRESENTANTE","telefone":"(18) 99717-0100","email":"ericsonvenancio@hotmail.com"}]},{"followup":"GERVASIO_MARINGA","bra":"BRA02.02","razao_social":"Evoluart - Gervásio","classificacao":"Showroom","comissao_maxima":0.07,"gerente":"Marcos Matos","supervisor":"Luiz Moretto","vendedores":"Gervásio e Paulo","contatos":[{"nome":"GERVÁSIO SANTA ROSA","cargo":"REPRESENTANTE","telefone":"(44) 99973-5948","email":"maringa.rep@weiku.com.br"},{"nome":"PAULO RIVADÁVIA","cargo":"REPRESENTANTE","telefone":"(44) 99973-5948","email":"maringa.rep@weiku.com.br"}]},{"followup":"RJ_FABI_BORGES","bra":"BRA03.01","razao_social":"Fabi Representações Eireli","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Kátia Glatz","vendedores":"","contatos":[]},{"followup":"ES_BASE_DECORACOES","bra":"BRA03.01","razao_social":"ZFM Decor Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Kátia Glatz","vendedores":"","contatos":[]},{"followup":"SP_LP2_REP","bra":"BRA03.02","razao_social":"LP2 Representação Comercial Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Douglas Moreto","vendedores":"Aureo e Leonardo Pivetta","contatos":[{"nome":"LEONARDO PIVETTA","cargo":"REPRESENTANTE","telefone":"(11) 99127-5377","email":"abc.rep@weiku.com.br"},{"nome":"AUREO BARBOSA","cargo":"REPRESENTANTE","telefone":"(11) 99919-5145","email":"aureo@novaartebrasil.com.br"}]},{"followup":"SP_BARUERI_PREVE","bra":"BRA03.02","razao_social":"Preve Representações Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Douglas Moreto","vendedores":"","contatos":[{"nome":"CAMILA PREVE / DANILO","cargo":"REPRESENTANTE","telefone":"(11) 96340-4164","email":"barueri.rep@weiku.com.br"}]},{"followup":"SP_SOBREIRA_REPRESENTACOES","bra":"BRA03.02","razao_social":"Sobreira Representações S/S Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Douglas Moreto","vendedores":"","contatos":[]},{"followup":"SP_LUANA.S","bra":"BRA03.02","razao_social":"Luana F. Silveira Representação Comercial","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Douglas Moreto","vendedores":"","contatos":[{"nome":"LUANA SILVEIRA","cargo":"REPRESENTANTE","telefone":"(11) 97305-2565","email":"luana@weiku.com.br"}]},{"followup":"SP_LYRA","bra":"BRA03.02","razao_social":"Lyra Soluções Comerciais Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Douglas Moreto","vendedores":"","contatos":[{"nome":"RONEI DE JESUS LYRA","cargo":"REPRESENTANTE","telefone":"(11) 99523-2214","email":"vendas82@weiku.com.br"}]},{"followup":"SP_CASAGRAND","bra":"BRA03.02","razao_social":"Casagrand Buildpoint Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Douglas Moreto","vendedores":"","contatos":[{"nome":"EDSON CASAGRANDE JUNIOR","cargo":"REPRESENTANTE","telefone":"(15) 99107-3909","email":"casagrandejr.rep@gmail.com"}]},{"followup":"ROSA MADEIRAS_LIMEIRA","bra":"BRA03.02","razao_social":"Central Coberturas","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Douglas Moreto","vendedores":"","contatos":[]},{"followup":"SP_LEONARDO","bra":"BRA03.02","razao_social":"Leonardo Devezas Lopes - ME","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Douglas Moreto","vendedores":"Leonardo e Matheus","contatos":[{"nome":"MATHEUS DEVEZAS","cargo":"REPRESENTANTE","telefone":"(13) 99689-2937","email":"santos.rep@weiku.com.br"},{"nome":"LEONARDO DEVEZAS LOPES","cargo":"REPRESENTANTE","telefone":"(13) 99689-2937","email":"santos.rep@weiku.com.br"}]},{"followup":"GO_AMPLIAR","bra":"BRA03.03","razao_social":"Ampliar Comércio e Representações Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Pablo Cavalcante","vendedores":"","contatos":[{"nome":"ADÃO GILSON SOUZA","cargo":"REPRESENTANTE","telefone":"(62) 99825-7737","email":"adao@ampliarcomercial.com.br"}]},{"followup":"GO_REA","bra":"BRA03.03","razao_social":"R e A Piscinas Verginassi Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Pablo Cavalcante","vendedores":"","contatos":[{"nome":"RODRIGO JOSÉ VERGINASSI","cargo":"REPRESENTANTE","telefone":"(64) 99346-4767","email":"vendas84@weiku.com.br"},{"nome":"ADRIANA VERGINASSI","cargo":"REPRESENTANTE","telefone":"(64) 99346-4767","email":"jatai@igui.com"}]},{"followup":"MG_RODRIGO_DINIZ","bra":"BRA03.03","razao_social":"Representações Aguiar Diniz Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Pablo Cavalcante","vendedores":"","contatos":[{"nome":"RODRIGO AGUIAR DINIZ","cargo":"REPRESENTANTE","telefone":"(31) 99102-5344","email":"bh.rep@weiku.com.br"}]},{"followup":"MG_LUIZ_FERNANDO","bra":"BRA03.03","razao_social":"Societa Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Pablo Cavalcante","vendedores":"","contatos":[]},{"followup":"DR_VRA","bra":"BRA03.03","razao_social":"VRA Concept Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Kátia Glatz","supervisor":"Pablo Cavalcante","vendedores":"Alicia","contatos":[]},{"followup":"MG_PABLO","bra":"BRA03.03","razao_social":"Pablo Cavalcante","classificacao":"Supervisor","comissao_maxima":0.0,"gerente":"Kátia Glatz","supervisor":"Pablo Cavalcante","vendedores":"","contatos":[{"nome":"PABLO EDUARDO CAVALCANTE SILVA","cargo":"SUPERVISOR DE VENDAS","telefone":"(34) 98803-6869","email":"vendas42@weiku.com.br"}]},{"followup":"MT_LIDERE","bra":"BRA04.01","razao_social":"Lidere Comércio e Serviço Ltda","classificacao":"Coordenador","comissao_maxima":0.0,"gerente":"Philipp Kilian","supervisor":"Igor Lopes","vendedores":"","contatos":[{"nome":"IGOR LOPES DE ALMEIDA","cargo":"COORDENADOR DE VENDAS","telefone":"(65) 99207-2791","email":"vendas19@weiku.com.br"}]},{"followup":"MT_ARWC","bra":"BRA04.01","razao_social":"ARWC Representações Comerciais Ltda","classificacao":"Representante","comissao_maxima":0.06,"gerente":"Philipp Kilian","supervisor":"Igor Lopes","vendedores":"","contatos":[{"nome":"ALESSANDRA RICCI","cargo":"REPRESENTANTE","telefone":"(65) 98129-0086","email":"vendas56@weiku.com.br"}]}];

  const store = Storage.scope('cadastros');
  // state.tableSort     = { coluna: null, dir: null }   (universal R12)
  // state.tableFilters  = { [colKey]: Set<string>|null } (universal R12)
  const state = {
    reps: [],
    busca: '',
    drawerOpen: null,
    sort: { coluna: null, dir: null },
    tableSort: { coluna: null, dir: null },
    tableFilters: {},
    filtroGerente: '',
    filtroCoordenador: '',
    filtroSupervisor: '',
  };
  let loaded = false;

  // Lista de pessoas que sao coordenadoras (vs supervisoras) na
  // estrutura comercial. Usado UMA VEZ na migracao para separar o
  // antigo campo unico `supervisor` em dois: `coordenador` e
  // `supervisor`. Editavel pelo usuario via drawer dropdown.
  const COORDENADORES_CONHECIDOS = ['Daniel Flores', 'Douglas Moreto', 'Igor Lopes'];

  // Pessoas que NAO sao supervisor de verdade (sao gerente ou gestor).
  // Usado pela migracao v2 pra limpar o campo `supervisor` quando
  // contem o nome de um gerente/gestor por engano (resquicio do seed
  // antigo onde o campo era preenchido com o "chefe imediato" sem
  // distinguir nivel hierarquico).
  const NAO_SUPERVISORES = ['Luiz Starke', 'Marcos Matos', 'Kátia Glatz', 'Katia Glatz', 'Philipp Kilian'];

  function migrarCampoCoordenador() {
    // Adiciona campo `coordenador` em cada rep. Se o `supervisor`
    // existente for um coordenador conhecido, move pra coordenador.
    let mudou = false;
    state.reps.forEach(r => {
      if (typeof r.coordenador !== 'string') {
        r.coordenador = '';
        const sup = String(r.supervisor || '').trim();
        if (sup && COORDENADORES_CONHECIDOS.some(n => n.toLowerCase() === sup.toLowerCase())) {
          r.coordenador = sup;
          r.supervisor = '';
        }
        mudou = true;
      }
    });
    if (mudou) save();
  }

  // Migracao 1x: a classificacao "Weiku" nao existe. Mapeia entradas
  // antigas para a classificacao correta com base no followup_id
  // (conforme organograma comercial fornecido pelo cliente).
  function migrarClassificacaoWeiku() {
    if (store.get('migracao_weiku_v1_done')) return;
    const MAPA_WEIKU = {
      'DANIEL_FLORES': 'Coordenador',
      'MG_PABLO':      'Supervisor',
      'MT_LIDERE':     'Coordenador',
    };
    let mudou = false;
    state.reps.forEach(r => {
      if (r.classificacao === 'Weiku') {
        const novo = MAPA_WEIKU[r.followup];
        if (novo) { r.classificacao = novo; mudou = true; }
      }
    });
    if (mudou) save();
    store.set('migracao_weiku_v1_done', true);
  }

  // Hierarquia comercial superior — gerentes, coordenadores, supervisores
  // e gestores que aparecem no organograma. Sao pessoas internas da
  // estrutura comercial (nao representantes externos) que precisam
  // existir como linhas proprias na tabela. Telefone/email em branco
  // pra serem preenchidos pelo usuario via UI.
  const HIERARQUIA_SUPERIOR = [
    {"followup":"GERENTE_LUIZ_STARKE","bra":"BRA01","razao_social":"LF Consultoria Ltda","classificacao":"Gerente","comissao_maxima":0.0,"gerente":"","supervisor":"","coordenador":"","vendedores":"","contatos":[{"nome":"LUIZ FERNANDO STARKE","cargo":"GERENTE DE VENDAS","telefone":"","email":""}]},
    {"followup":"GERENTE_MARCOS_MATOS","bra":"BRA02","razao_social":"MMatos Consultoria Ltda","classificacao":"Gerente","comissao_maxima":0.0,"gerente":"","supervisor":"","coordenador":"","vendedores":"","contatos":[{"nome":"MARCOS MATOS","cargo":"GERENTE DE VENDAS","telefone":"","email":""}]},
    {"followup":"SUPERVISOR_LUIZ_MORETTO","bra":"BRA02.02","razao_social":"Moretto Representações Comerciais Ltda","classificacao":"Supervisor","comissao_maxima":0.0,"gerente":"Marcos Matos","supervisor":"Luiz Moretto","coordenador":"","vendedores":"","contatos":[{"nome":"LUIZ SEVERINO MORETTO","cargo":"SUPERVISOR DE VENDAS","telefone":"","email":""}]},
    {"followup":"GERENTE_KATIA_GLATZ","bra":"BRA03","razao_social":"Katia Tatiana Glatz Serviços","classificacao":"Gerente","comissao_maxima":0.0,"gerente":"","supervisor":"","coordenador":"","vendedores":"","contatos":[{"nome":"KATIA TATIANA GLATZ","cargo":"GERENTE DE VENDAS","telefone":"","email":""}]},
    {"followup":"COORDENADOR_DOUGLAS_MORETO","bra":"BRA03.02","razao_social":"Douglas José Coneglian Moreto","classificacao":"Coordenador","comissao_maxima":0.0,"gerente":"Kátia Glatz","supervisor":"","coordenador":"Douglas Moreto","vendedores":"","contatos":[{"nome":"DOUGLAS JOSÉ CONEGLIAN MORETO","cargo":"COORDENADOR DE VENDAS","telefone":"","email":""}]},
    {"followup":"GESTOR_PHILIPP_KILIAN","bra":"BRA04","razao_social":"Philipp Kilian","classificacao":"Gestor","comissao_maxima":0.0,"gerente":"","supervisor":"","coordenador":"","vendedores":"","contatos":[{"nome":"PHILIPP KILIAN","cargo":"GESTOR DE VENDAS","telefone":"","email":""}]},
  ];

  // Migracao 1x: garante que as pessoas da hierarquia comercial superior
  // (organograma) estejam presentes como linhas proprias. Idempotente:
  // dedup por followup, so adiciona o que falta.
  function migrarHierarquiaSuperior() {
    if (store.get('migracao_hierarquia_superior_v1_done')) return;
    let mudou = false;
    HIERARQUIA_SUPERIOR.forEach(novo => {
      if (!state.reps.some(r => r.followup === novo.followup)) {
        state.reps.push(novo);
        mudou = true;
      }
    });
    if (mudou) save();
    store.set('migracao_hierarquia_superior_v1_done', true);
  }

  function load() {
    if (loaded) return;
    const lista = store.get('representantes_lista');
    // Felipe (sessao 30 - PROTECAO ANTI-SEED): bloqueia seed global
    // se sistema ja' foi inicializado em qualquer scope. Evita
    // sobrescrita acidental dos 75+ representantes/vendedores reais
    // que afetam comissoes, contatos e atribuicoes de orcamento.
    const _seedPermitido = typeof SystemProtection !== 'undefined'
      ? SystemProtection.podeRodarSeed()
      : true;
    if (_seedPermitido && (lista === null || (Array.isArray(lista) && lista.length === 0 && !store.get('representantes_seeded')))) {
      state.reps = SEED_REPRESENTANTES.slice();
      store.set('representantes_lista', state.reps);
      store.set('representantes_seeded', true);
    } else {
      state.reps = lista || [];
    }
    loaded = true;
    // Felipe (R20): normaliza Title Case dos contatos. O seed entra
    // UPPERCASE e o `data-titlecase` so' aplica no `blur` durante
    // digitacao — sem isso, a coluna Contatos mostra "ANDERSON SCHNEIDER"
    // em vez de "Anderson Schneider". Aplica uma vez e persiste.
    normalizarContatosTitleCase();
    // Migracao para o campo coordenador (uma vez)
    migrarCampoCoordenador();
    // Migracao da classificacao "Weiku" -> classificacao correta (uma vez)
    migrarClassificacaoWeiku();
    // Migracao da hierarquia comercial superior (gerentes/coordenadores/etc)
    migrarHierarquiaSuperior();
    // Migracao v2: limpa campo `supervisor` quando contem nome de gerente/gestor
    // ou de coordenador (resquicio do seed antigo onde o campo era preenchido
    // com o "chefe imediato" sem distinguir nivel hierarquico).
    migrarLimpezaSupervisorV2();
  }

  function normalizarContatosTitleCase() {
    if (store.get('migracao_contatos_titlecase_done')) return;
    const tc = (s) => (window.Universal && window.Universal.titleCase)
      ? window.Universal.titleCase(s || '')
      : (s || '');
    let mudou = false;
    state.reps.forEach(r => {
      if (!Array.isArray(r.contatos)) return;
      r.contatos.forEach(c => {
        if (c.nome && c.nome !== tc(c.nome))   { c.nome  = tc(c.nome);  mudou = true; }
        if (c.cargo && c.cargo !== tc(c.cargo)) { c.cargo = tc(c.cargo); mudou = true; }
      });
    });
    if (mudou) store.set('representantes_lista', state.reps);
    store.set('migracao_contatos_titlecase_done', true);
  }

  // Migracao v2 — limpa campos supervisor incorretos.
  // Antes: muitos reps tinham r.supervisor = "Luiz Starke" (gerente),
  // "Marcos Matos" (gerente), "Kátia Glatz" (gerente) etc. Isso fazia
  // o filtro SUPERVISOR mostrar 6 nomes em vez de 2.
  // Depois desta migracao: r.supervisor so contem nomes de supervisores
  // de verdade (Luiz Moretto, Pablo Cavalcante).
  function migrarLimpezaSupervisorV2() {
    if (store.get('migracao_limpa_supervisor_v2_done')) return;
    let mudou = false;
    state.reps.forEach(r => {
      const sup = String(r.supervisor || '').trim();
      if (!sup) return;
      // Se o valor for um gerente/gestor: limpa.
      if (NAO_SUPERVISORES.some(n => n.toLowerCase() === sup.toLowerCase())) {
        r.supervisor = '';
        mudou = true;
        return;
      }
      // Se for um coordenador conhecido: move pra coordenador (caso ainda nao tenha
      // sido movido pela migracao v1, ex: novo nome adicionado em
      // COORDENADORES_CONHECIDOS como Douglas Moreto).
      if (COORDENADORES_CONHECIDOS.some(n => n.toLowerCase() === sup.toLowerCase())) {
        if (!r.coordenador) r.coordenador = sup;
        r.supervisor = '';
        mudou = true;
      }
    });
    if (mudou) save();
    store.set('migracao_limpa_supervisor_v2_done', true);
  }

  function save() { store.set('representantes_lista', state.reps); }

  // ── BUSCA POR FOLLOWUP — usado pelo WeikuClient ──
  // Dado um followup ('ANDERSON_JARAGUA'), retorna o representante
  // resolvido com o nome do primeiro contato (ou razao social se
  // nao houver contato). Retorna null se nao encontrar.
  function buscarPorFollowup(followup) {
    load();
    if (!followup) return null;
    const fup = String(followup).trim();
    const rep = state.reps.find(r => String(r.followup).trim() === fup);
    if (!rep) return null;
    const contato = (rep.contatos && rep.contatos[0]) || null;
    return {
      followup: rep.followup,
      razao_social: rep.razao_social,
      bra: rep.bra,
      classificacao: rep.classificacao,
      // Nome a ser exibido no CRM: razao social (entidade que recebe a comissao)
      nome_exibicao: rep.razao_social,
      // Primeiro contato (pessoa fisica) se houver
      contato_principal: contato ? {
        nome: contato.nome,
        cargo: contato.cargo,
        telefone: contato.telefone,
        email: contato.email,
      } : null,
      total_contatos: (rep.contatos || []).length,
    };
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtPercent(n) {
    if (n == null || isNaN(n)) return '—';
    return (Number(n) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }

  function classPillClass(c) {
    // Mantida apenas por compatibilidade com o drawer (que ainda
    // usa rep-class-pill como wrapper textual). Ja' nao adiciona
    // background — apenas serve de hook semantico (R11).
    const safe = String(c || '').replace(/[^a-zA-Z0-9]/g, '');
    return 'rep-class-' + (safe || 'Outro');
  }

  // Felipe (sessao 2026-05): listas migradas para Cadastros > Filtros.
  // ATUALIZACAO: Cargo do Contato agora usa a MESMA lista da
  // Classificacao do Representante (rep_classificacao) — Felipe pediu
  // pra unificar, ja que sao essencialmente a mesma hierarquia.
  // O fallback hardcoded preservado pra compatibilidade.
  const _SEED_CLASSIFICACOES = ['Representante', 'Vendedor', 'Showroom', 'Supervisor', 'Coordenador', 'Gerente', 'Diretor', 'Gestor'];
  const _SEED_CARGOS_CONTATO = ['Representante', 'Vendedor', 'Gerente', 'Coordenador', 'Supervisor'];
  function getClassificacoesEditaveis() {
    if (window.Filtros && typeof window.Filtros.listar === 'function') {
      return window.Filtros.listar('rep_classificacao', _SEED_CLASSIFICACOES);
    }
    return _SEED_CLASSIFICACOES.slice();
  }
  function getCargosContato() {
    // Felipe (sessao 2026-05): unificado com Classificacao do Representante.
    // Antes lia 'rep_cargo' (filtro separado). Agora le 'rep_classificacao'
    // — uma lista so' pros dois usos.
    if (window.Filtros && typeof window.Filtros.listar === 'function') {
      return window.Filtros.listar('rep_classificacao', _SEED_CARGOS_CONTATO);
    }
    return _SEED_CARGOS_CONTATO.slice();
  }
  // Aliases mantidos pra compatibilidade com o resto do modulo
  // (variaveis sao re-avaliadas a cada chamada via funcoes acima).
  const CLASSIFICACOES_EDITAVEIS = _SEED_CLASSIFICACOES; // mantido pra .includes() no codigo legado
  const CARGOS_CONTATO = _SEED_CARGOS_CONTATO;            // idem

  // Regra de negocio (FIXA): comissao maxima de cada classificacao.
  //   Representante -> 6,00%
  //   Showroom      -> 7,00%
  // Quando o usuario muda a classificacao no select, a comissao
  // maxima e' atualizada automaticamente seguindo essa tabela.
  const COMISSAO_POR_CLASSIFICACAO = {
    'Representante': 0.06,
    'Showroom':      0.07,
  };
  function comissaoPadraoPara(classificacao) {
    return Object.prototype.hasOwnProperty.call(COMISSAO_POR_CLASSIFICACAO, classificacao)
      ? COMISSAO_POR_CLASSIFICACAO[classificacao]
      : null;
  }

  // --- Helpers de filtro e ordenacao (R12) ----------------------

  // Lista unica de gerentes (ordenada A-Z) para o dropdown da toolbar.
  // Exclui gestores (Philipp Kilian) — gestor nao tem filtro proprio
  // (decisao do usuario: gestor aparece como linha na tabela mas nao
  // como opcao no dropdown filtro).
  const GESTORES = ['Philipp Kilian'];
  function listarGerentes() {
    const set = new Set();
    state.reps.forEach(r => {
      if (r.gerente && !GESTORES.some(g => g.toLowerCase() === r.gerente.toLowerCase())) {
        set.add(r.gerente);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function listarCoordenadores() {
    const set = new Set();
    state.reps.forEach(r => { if (r.coordenador) set.add(r.coordenador); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function listarSupervisores() {
    const set = new Set();
    state.reps.forEach(r => { if (r.supervisor) set.add(r.supervisor); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  // Devolve uma chave de comparacao para ordenacao (string ou numero).
  function chaveSortRep(r, coluna) {
    switch (coluna) {
      case 'razao_social':  return String(r.razao_social || '').toLowerCase();
      case 'followup':      return String(r.followup || '').toLowerCase();
      case 'bra':           return String(r.bra || '').toLowerCase();
      case 'classificacao': return String(r.classificacao || '').toLowerCase();
      case 'contatos':      {
        // sort por nome do primeiro contato (em ordem alfabetica), com vazios no fim
        const primeiro = (r.contatos || []).find(c => (c.nome || '').trim());
        return primeiro ? String(primeiro.nome).toLowerCase() : '\uffff';
      }
      case 'comissao':      return Number(r.comissao_maxima) || 0;
      default:              return '';
    }
  }

  // Compara dois reps de acordo com state.sort.
  function compararReps(a, b) {
    const { coluna, dir } = state.sort;
    if (!coluna || !dir) return 0;
    const ka = chaveSortRep(a, coluna);
    const kb = chaveSortRep(b, coluna);
    let cmp;
    if (typeof ka === 'number' && typeof kb === 'number') {
      cmp = ka - kb;
    } else {
      cmp = String(ka).localeCompare(String(kb), 'pt-BR');
    }
    return dir === 'asc' ? cmp : -cmp;
  }

  // Cicla a ordenacao da coluna: nada -> asc -> desc -> nada.
  function ciclarSort(coluna) {
    if (state.sort.coluna !== coluna) {
      state.sort = { coluna, dir: 'asc' };
      return;
    }
    if (state.sort.dir === 'asc')      state.sort.dir = 'desc';
    else if (state.sort.dir === 'desc') state.sort = { coluna: null, dir: null };
    else                                state.sort = { coluna, dir: 'asc' };
  }

  // Seta da ordenacao para o cabecalho.
  function setaSort(coluna) {
    if (state.sort.coluna !== coluna || !state.sort.dir) return '↕';
    return state.sort.dir === 'asc' ? '▲' : '▼';
  }

  function renderTable() {
    const termo = state.busca.trim().toLowerCase();
    let filtrados = state.reps.filter(r => {
      // Filtro por gerente (R12)
      if (state.filtroGerente && r.gerente !== state.filtroGerente) return false;
      // Filtro por coordenador (R12)
      if (state.filtroCoordenador && r.coordenador !== state.filtroCoordenador) return false;
      // Filtro por supervisor (R12)
      if (state.filtroSupervisor && r.supervisor !== state.filtroSupervisor) return false;
      // Busca livre
      if (!termo) return true;
      const blob = [r.razao_social, r.followup, r.bra, r.classificacao,
        r.gerente, r.coordenador, r.supervisor,
        ...(r.contatos || []).flatMap(c => [c.nome, c.email, c.telefone, c.cargo])
      ].join(' ').toLowerCase();
      return blob.includes(termo);
    });
    // Ordenacao (R12)
    if (state.sort.coluna && state.sort.dir) {
      filtrados = filtrados.slice().sort(compararReps);
    }

    if (filtrados.length === 0) {
      return `<div style="padding:24px;text-align:center;color:var(--text-muted);">Nenhum representante encontrado.</div>`;
    }

    const rows = filtrados.map((r, idx) => {
      const total = (r.contatos || []).length;
      const badgeClass = total > 0 ? 'has-data' : 'no-data';
      // Felipe pediu: mostrar NOME do contato em vez do numero.
      // Se tiver mais de 1, mostra o primeiro + " +N" indicador discreto.
      const primeiro = (r.contatos || []).find(c => (c.nome || '').trim()) || null;
      const nomePrim = primeiro ? primeiro.nome : '';
      const sufixo   = total > 1 ? ` <span class="rep-contatos-extra">+${total - 1}</span>` : '';
      const contatoHtml = total > 0 && nomePrim
        ? `<span class="rep-contatos-nome">${escapeHtml(nomePrim)}</span>${sufixo}`
        : `<span class="rep-contatos-vazio">—</span>`;
      const indexNoEstado = state.reps.indexOf(r);
      const classAtual = r.classificacao || '';
      const _classListaAtual = getClassificacoesEditaveis();
      const opcoes = _classListaAtual.map(c =>
        `<option value="${escapeHtml(c)}" ${c === classAtual ? 'selected' : ''}>${escapeHtml(c)}</option>`
      ).join('');
      const opcaoExtra = (classAtual && !_classListaAtual.includes(classAtual))
        ? `<option value="${escapeHtml(classAtual)}" selected>${escapeHtml(classAtual)}</option>`
        : '';
      return `
        <tr data-followup="${escapeHtml(r.followup)}" data-idx="${indexNoEstado}">
          <td><span class="t-strong">${escapeHtml(r.razao_social)}</span></td>
          <td><span class="rep-followup-code">${escapeHtml(r.followup)}</span></td>
          <td><span class="rep-bra-tag">${escapeHtml(r.bra || '—')}</span></td>
          <td>
            <select class="rep-class-select" data-idx="${indexNoEstado}" onclick="event.stopPropagation();">
              ${opcoes}${opcaoExtra}
            </select>
          </td>
          <td><span class="rep-contatos-cell ${badgeClass}">${contatoHtml}</span></td>
          <td class="rep-comissao" data-idx="${indexNoEstado}">${fmtPercent(r.comissao_maxima)}</td>
          <td class="actions" onclick="event.stopPropagation();">
            <button type="button" class="rep-btn-remove" data-action="remover-rep" data-idx="${indexNoEstado}" title="Excluir representante">×</button>
          </td>
        </tr>
      `;
    }).join('');

    // Cabecalho com colunas ordenaveis (R12)
    const th = (coluna, label) => {
      const ativo = state.sort.coluna === coluna && state.sort.dir;
      const cls = 'is-sortable' + (ativo ? ' is-sorted' : '');
      return `<th class="${cls}" data-sort="${coluna}">${escapeHtml(label)}<span class="rep-sort-arrow">${setaSort(coluna)}</span></th>`;
    };

    return `
      <div class="rep-table-wrap">
        <table class="rep-table">
          <thead>
            <tr>
              ${th('razao_social',  'Razao Social')}
              ${th('followup',      'FollowUp')}
              ${th('bra',           'BRA')}
              ${th('classificacao', 'Classificacao')}
              ${th('contatos',      'Contatos')}
              ${th('comissao',      'Comissao')}
              <th class="actions" data-no-sort="1" data-no-filter="1"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderDrawer(rep) {
    const idx = state.reps.indexOf(rep);
    const contatos = rep.contatos || [];
    // Bloco de contatos: cada contato tem campos editaveis em linha
    const blocoContatos = contatos.length === 0 ? `
      <div class="rep-contato-empty">
        Nenhum contato cadastrado. Clique em "+ Adicionar Contato" acima para inserir um novo.
      </div>
    ` : contatos.map((c, ci) => {
      const cargoAtual = c.cargo || 'Representante';
      // Garante que o valor atual exista no select (mesmo se for um cargo nao mapeado)
      const _cargosAtuais = getCargosContato();
      const opcoes = _cargosAtuais.map(opt =>
        `<option value="${escapeHtml(opt)}" ${opt.toLowerCase() === cargoAtual.toLowerCase() ? 'selected' : ''}>${escapeHtml(opt)}</option>`
      ).join('');
      const opcaoExtra = (cargoAtual && !_cargosAtuais.some(o => o.toLowerCase() === cargoAtual.toLowerCase()))
        ? `<option value="${escapeHtml(cargoAtual)}" selected>${escapeHtml(cargoAtual)}</option>`
        : '';
      // Tag visual de papel hierarquico
      const cargoUpper = cargoAtual.toUpperCase();
      const isHier = ['GERENTE', 'COORDENADOR', 'SUPERVISOR'].includes(cargoUpper);
      const tagCls = isHier ? '' : (cargoUpper === 'VENDEDOR' ? 'is-vendedor' : 'is-rep');
      return `
        <div class="rep-contato-card" data-rep-idx="${idx}" data-contato-idx="${ci}">
          <div class="rep-contato-head">
            <span class="rep-contato-cargo-tag ${tagCls}">${escapeHtml(cargoAtual)}</span>
            <button class="rep-btn-remove" data-action="remover-contato"
                    data-rep-idx="${idx}" data-contato-idx="${ci}"
                    title="Remover este contato">Remover</button>
          </div>
          <div class="rep-info-grid">
            <div class="rep-info-item">
              <label>Nome</label>
              <input class="rep-edit-input" data-campo-contato="nome" data-titlecase="1"
                     data-rep-idx="${idx}" data-contato-idx="${ci}"
                     value="${escapeHtml(c.nome || '')}" placeholder="" />
            </div>
            <div class="rep-info-item">
              <label>Cargo</label>
              <select class="rep-edit-select" data-campo-contato="cargo"
                      data-rep-idx="${idx}" data-contato-idx="${ci}">
                ${opcoes}${opcaoExtra}
              </select>
            </div>
            <div class="rep-info-item">
              <label>Telefone</label>
              <input class="rep-edit-input" data-campo-contato="telefone"
                     data-rep-idx="${idx}" data-contato-idx="${ci}"
                     value="${escapeHtml(c.telefone || '')}" placeholder="" />
            </div>
            <div class="rep-info-item">
              <label>Email</label>
              <input class="rep-edit-input" data-campo-contato="email"
                     data-rep-idx="${idx}" data-contato-idx="${ci}"
                     value="${escapeHtml(c.email || '')}" placeholder="" />
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Lista de gerentes para o select (mesma fonte do filtro da toolbar)
    const gerentes = listarGerentes();
    const gerOpcoes = gerentes.map(g =>
      `<option value="${escapeHtml(g)}" ${g === rep.gerente ? 'selected' : ''}>${escapeHtml(g)}</option>`
    ).join('');
    const gerExtra = (rep.gerente && !gerentes.includes(rep.gerente))
      ? `<option value="${escapeHtml(rep.gerente)}" selected>${escapeHtml(rep.gerente)}</option>`
      : '';

    return `
      <div class="rep-drawer-overlay" id="rep-drawer-overlay">
        <div class="rep-drawer">
          <div class="rep-drawer-header">
            <div>
              <div class="rep-drawer-title">${escapeHtml(rep.razao_social)}</div>
              <div class="rep-drawer-subtitle">
                <span class="rep-followup-code">${escapeHtml(rep.followup)}</span>
                <span class="rep-class-pill">${escapeHtml(rep.classificacao || '—')}</span>
                <span class="rep-bra-tag">${escapeHtml(rep.bra || '—')}</span>
              </div>
            </div>
            <button class="rep-drawer-close" id="rep-drawer-close" title="Fechar">×</button>
          </div>

          <div class="rep-drawer-section">
            <h4>Estrutura</h4>
            <div class="rep-info-grid">
              <div class="rep-info-item">
                <label>Gerente</label>
                <select class="rep-edit-select" data-campo-rep="gerente" data-rep-idx="${idx}">
                  <option value="">— sem gerente —</option>
                  ${gerOpcoes}${gerExtra}
                </select>
              </div>
              <div class="rep-info-item">
                <label>Coordenador / Supervisor</label>
                <input class="rep-edit-input" data-campo-rep="supervisor" data-rep-idx="${idx}" data-titlecase="1"
                       value="${escapeHtml(rep.supervisor || '')}" placeholder="" />
              </div>
              <div class="rep-info-item">
                <label>Comissao Maxima</label>
                <input class="rep-edit-input" data-campo-rep="comissao_maxima" data-rep-idx="${idx}"
                       value="${fmtPercent(rep.comissao_maxima)}" inputmode="decimal"
                       placeholder="" />
              </div>
            </div>
          </div>

          <div class="rep-drawer-section">
            <div class="rep-section-head">
              <h4>Contatos (${contatos.length})</h4>
              <button class="rep-btn-add" data-action="adicionar-contato" data-rep-idx="${idx}">+ Adicionar Contato</button>
            </div>
            ${blocoContatos}
          </div>
        </div>
      </div>
    `;
  }

  function abrirDrawer(container, followup) {
    const rep = state.reps.find(r => r.followup === followup);
    if (!rep) return;
    state.drawerOpen = followup;
    const mount = container.querySelector('#rep-drawer-mount');
    if (!mount) return;
    mount.innerHTML = renderDrawer(rep);
    bindDrawerEvents(container);
    bindDrawerEditFields(container);
  }

  function fecharDrawer(container) {
    state.drawerOpen = null;
    const mount = container.querySelector('#rep-drawer-mount');
    if (mount) mount.innerHTML = '';
  }

  // Estado de "alteracoes pendentes" (regra R07): quando o usuario
  // edita a classificacao, o botao Salvar Alteracoes fica laranja
  // e ao salvar (manual ou auto-save) volta verde + popup "Salvo OK".
  let dirty = false;
  let btnSalvarRef = null;

  function setBtnSalvarEstado(isDirty) {
    if (!btnSalvarRef) return;
    btnSalvarRef.classList.toggle('is-dirty', !!isDirty);
    btnSalvarRef.textContent = isDirty ? 'Salvar Alteracoes' : '✓ Tudo salvo';
  }

  function markDirty() {
    dirty = true;
    setBtnSalvarEstado(true);
  }

  function salvarManual() {
    save();
    dirty = false;
    setBtnSalvarEstado(false);
    if (typeof window.showSavedDialog === 'function') {
      window.showSavedDialog('Alteracoes salvas com sucesso.');
    }
  }

  function render(container) {
    load();
    const total = state.reps.length;
    const comContato = state.reps.filter(r => (r.contatos || []).length > 0).length;
    const semContato = total - comContato;

    // Contagens por classificacao (campo `classificacao` da entidade rep).
    // Antes contava por cargo do contato, mas os cargos sao "GERENTE DE
    // VENDAS"/"REPRESENTANTE" etc. — nao tem ninguem com cargo "Vendedor"
    // exatamente, entao Vendedor sempre dava 0. Agora conta pela
    // classificacao da linha (R10).
    const totGer = state.reps.filter(r => r.classificacao === 'Gerente').length;
    const totCoord = state.reps.filter(r => r.classificacao === 'Coordenador').length;
    const totSup = state.reps.filter(r => r.classificacao === 'Supervisor').length;
    const totVend = state.reps.filter(r => r.classificacao === 'Vendedor').length;

    // Lista de gerentes para o dropdown de filtro (R12)
    const gerentes = listarGerentes();
    const optsGer = gerentes.map(g =>
      `<option value="${escapeHtml(g)}" ${g === state.filtroGerente ? 'selected' : ''}>${escapeHtml(g)}</option>`
    ).join('');
    const coordenadores = listarCoordenadores();
    const optsCoord = coordenadores.map(c =>
      `<option value="${escapeHtml(c)}" ${c === state.filtroCoordenador ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');
    const supervisores = listarSupervisores();
    const optsSup = supervisores.map(s =>
      `<option value="${escapeHtml(s)}" ${s === state.filtroSupervisor ? 'selected' : ''}>${escapeHtml(s)}</option>`
    ).join('');

    container.innerHTML = `
      <div class="rep-toolbar">
        <div class="rep-toolbar-row rep-toolbar-row-1">
          <div class="rep-toolbar-left">
            <span><span class="t-strong">${total}</span> representantes</span>
            <span><span class="t-strong">${comContato}</span> com contato</span>
            ${semContato > 0 ? `<span><span class="t-strong">${semContato}</span> sem contato</span>` : ''}
            <span style="border-left:1px solid var(--line); padding-left:18px;">
              <span class="t-strong">${totGer}</span> gerentes &nbsp;·&nbsp;
              <span class="t-strong">${totCoord}</span> coordenadores &nbsp;·&nbsp;
              <span class="t-strong">${totSup}</span> supervisores &nbsp;·&nbsp;
              <span class="t-strong">${totVend}</span> vendedores
            </span>
          </div>
          <div class="rep-toolbar-right">
            <button type="button" class="btn btn-ghost btn-sm" id="rep-btn-import">⤓ Importar planilha</button>
            <button type="button" class="btn btn-ghost btn-sm" id="rep-btn-export">⬇ Exportar Excel</button>
            <input type="file" id="rep-import-file" accept=".xlsx,.xls,.csv" style="display:none" />
            <button type="button" class="rep-btn-add" id="rep-btn-add-novo">+ Novo Representante</button>
            <button type="button" class="univ-btn-save" id="rep-btn-salvar">✓ Tudo salvo</button>
          </div>
        </div>
        <div class="rep-toolbar-row rep-toolbar-row-2">
          <input type="text" class="rep-search" id="rep-search"
            placeholder="Buscar por razao social, followup, BRA, contato..."
            value="${escapeHtml(state.busca)}" />
          <div class="rep-filter-group">
            <label for="rep-filtro-gerente">Gerente:</label>
            <select class="rep-filter-select" id="rep-filtro-gerente">
              <option value="">— todos —</option>
              ${optsGer}
            </select>
          </div>
          <div class="rep-filter-group">
            <label for="rep-filtro-coordenador">Coordenador:</label>
            <select class="rep-filter-select" id="rep-filtro-coordenador">
              <option value="">— todos —</option>
              ${optsCoord}
            </select>
          </div>
          <div class="rep-filter-group">
            <label for="rep-filtro-supervisor">Supervisor:</label>
            <select class="rep-filter-select" id="rep-filtro-supervisor">
              <option value="">— todos —</option>
              ${optsSup}
            </select>
          </div>
        </div>
      </div>
      <div id="rep-table-mount">${renderTable()}</div>

      <!-- Felipe (sessao 2026-08): "CADE A ABA DE ADICIONAR
           REPRESENTANTES QUE JA PEDI 200X". Form inline embaixo,
           padrao Perfis. Os campos essenciais aqui criam o
           representante; Felipe edita o resto no drawer/inline. -->
      <div class="cad-add-form">
        <h4>+ Adicionar Novo Representante</h4>
        <div class="cad-add-grid">
          <div>
            <div class="cad-param-label">Followup</div>
            <input id="rep-add-followup" class="cad-input" type="text" placeholder="ex: SP_NOVO_REP" />
          </div>
          <div>
            <div class="cad-param-label">Razao Social</div>
            <input id="rep-add-razao" class="cad-input" type="text" placeholder="" />
          </div>
          <div>
            <div class="cad-param-label">BRA</div>
            <input id="rep-add-bra" class="cad-input" type="text" placeholder="ex: BRA01.01" />
          </div>
          <div>
            <div class="cad-param-label">Classificacao</div>
            <select id="rep-add-classificacao" class="cad-input">
              <option value="Representante">Representante</option>
              <option value="Showroom">Showroom</option>
              <option value="Vendedor">Vendedor</option>
              <option value="Gerente">Gerente</option>
              <option value="Coordenador">Coordenador</option>
              <option value="Supervisor">Supervisor</option>
            </select>
          </div>
          <div>
            <div class="cad-param-label">Comissao (%)</div>
            <input id="rep-add-comissao" class="cad-input" type="text" inputmode="decimal" placeholder="6,00" />
          </div>
          <button class="btn btn-primary btn-sm" id="rep-btn-add-form" style="height:34px;">+ Adicionar</button>
        </div>
      </div>
      <div id="rep-drawer-mount"></div>
    `;
    btnSalvarRef = container.querySelector('#rep-btn-salvar');
    dirty = false;
    setBtnSalvarEstado(false);
    bindEvents(container);
  }

  function bindEvents(container) {
    // Busca em tempo real
    const search = container.querySelector('#rep-search');
    if (search) {
      search.addEventListener('input', (e) => {
        state.busca = e.target.value;
        redrawTable(container);
      });
    }
    // Filtro por gerente (R12)
    const filtroGer = container.querySelector('#rep-filtro-gerente');
    if (filtroGer) {
      filtroGer.addEventListener('change', (e) => {
        state.filtroGerente = e.target.value;
        redrawTable(container);
        // Recalcula totais na toolbar (filtro nao muda total geral,
        // mas a contagem visivel reflete o filtro). Por enquanto
        // mantemos a contagem geral; pode evoluir se precisar.
      });
    }
    // Filtro por coordenador (R12)
    const filtroCoord = container.querySelector('#rep-filtro-coordenador');
    if (filtroCoord) {
      filtroCoord.addEventListener('change', (e) => {
        state.filtroCoordenador = e.target.value;
        redrawTable(container);
      });
    }
    // Filtro por supervisor (R12)
    const filtroSup = container.querySelector('#rep-filtro-supervisor');
    if (filtroSup) {
      filtroSup.addEventListener('change', (e) => {
        state.filtroSupervisor = e.target.value;
        redrawTable(container);
      });
    }
    // Botao Salvar Alteracoes (R07)
    const btnSalvar = container.querySelector('#rep-btn-salvar');
    if (btnSalvar) btnSalvar.addEventListener('click', salvarManual);
    // R13: Adicionar novo representante
    const btnAddNovo = container.querySelector('#rep-btn-add-novo');
    if (btnAddNovo) btnAddNovo.addEventListener('click', () => adicionarRepresentante(container));

    // Felipe (sessao 2026-08): handler do form inline "+ Adicionar
    // novo representante" (padrao Perfis).
    container.querySelector('#rep-btn-add-form')?.addEventListener('click', () => {
      const followup    = container.querySelector('#rep-add-followup')?.value.trim() || '';
      const razao       = container.querySelector('#rep-add-razao')?.value.trim() || '';
      const bra         = container.querySelector('#rep-add-bra')?.value.trim() || '';
      const classificacao = container.querySelector('#rep-add-classificacao')?.value || 'Representante';
      const comissaoStr = container.querySelector('#rep-add-comissao')?.value || '';
      // Comissao em %, salva como decimal (6 → 0.06)
      const comissaoPct = window.parseBR ? window.parseBR(comissaoStr) : (parseFloat(comissaoStr.replace(',', '.')) || 0);
      const comissao_maxima = comissaoPct > 1 ? (comissaoPct / 100) : comissaoPct;

      if (!followup) {
        alert('Informe o Followup do representante (identificador unico).');
        return;
      }
      if (!razao) {
        alert('Informe a Razao Social.');
        return;
      }
      if (state.reps.some(r => r.followup === followup)) {
        if (!confirm(`Ja existe representante com followup "${followup}". Adicionar mesmo assim?`)) return;
      }
      const novo = {
        followup, bra, razao_social: razao, classificacao, comissao_maxima,
        gerente: '', supervisor: '', vendedores: '', contatos: [],
      };
      state.reps.unshift(novo);
      markDirty();
      // Re-render full pra atualizar contadores e dropdowns
      render(container);
      // Limpa form
      setTimeout(() => {
        ['rep-add-followup', 'rep-add-razao', 'rep-add-bra', 'rep-add-comissao'].forEach(id => {
          const el = container.querySelector('#' + id);
          if (el) el.value = '';
        });
        const inpFu = container.querySelector('#rep-add-followup');
        if (inpFu) inpFu.focus();
      }, 30);
    });
    // R16: Importar/Exportar Excel
    const btnExport = container.querySelector('#rep-btn-export');
    if (btnExport) btnExport.addEventListener('click', exportarRepsXLSX);
    const btnImport = container.querySelector('#rep-btn-import');
    const fileInput = container.querySelector('#rep-import-file');
    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        importarRepsXLSX(file);
        e.target.value = ''; // permite reimportar mesmo arquivo
      });
    }
    // R13: Excluir representante (delegado nas linhas)
    bindRowClicks(container);
    bindClassSelects(container);
    bindSortHeaders(container);
    bindRowDeleteButtons(container);
    // R12: sort+filtro universal em toda tabela
    const tbl = container.querySelector('.rep-table');
    if (tbl && window.Universal) window.Universal.autoEnhance(tbl);
  }

  // R13: handler de exclusao em massa (cada linha)
  function bindRowDeleteButtons(container) {
    container.querySelectorAll('[data-action="remover-rep"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        if (isNaN(idx) || !state.reps[idx]) return;
        const nome = state.reps[idx].razao_social || '(sem nome)';
        if (!confirm(`Excluir o representante "${nome}"?\n\nEssa acao nao pode ser desfeita.`)) return;
        state.reps.splice(idx, 1);
        markDirty();
        redrawTable(container);
      });
    });
  }

  // R13: cria novo representante em branco e abre o drawer pra editar
  function adicionarRepresentante(container) {
    const novo = {
      followup: 'NOVO_' + Date.now(),
      bra: '',
      razao_social: 'Novo Representante',
      classificacao: 'Representante',
      comissao_maxima: 0.06,
      gerente: '',
      supervisor: '',
      vendedores: '',
      contatos: [],
    };
    state.reps.unshift(novo);
    markDirty();
    // Re-renderiza tudo (toolbar pra atualizar contadores e dropdown de gerente)
    render(container);
    // Abre o drawer no novo representante
    abrirDrawer(container, novo.followup);
  }

  // Reescreve apenas a tabela (sem recriar a toolbar inteira).
  function redrawTable(container) {
    const mount = container.querySelector('#rep-table-mount');
    if (mount) mount.innerHTML = renderTable();
    bindRowClicks(container);
    bindClassSelects(container);
    bindSortHeaders(container);
    bindRowDeleteButtons(container);
    // R12: sort+filtro universal por coluna em toda tabela
    const tbl = container.querySelector('.rep-table');
    if (tbl && window.Universal) window.Universal.autoEnhance(tbl);
  }

  // Cabecalhos clicaveis para ordenar (R12).
  function bindSortHeaders(container) {
    container.querySelectorAll('.rep-table thead th.is-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (!col) return;
        ciclarSort(col);
        redrawTable(container);
      });
    });
  }

  // Handler do select de classificacao em cada linha. Na mudanca:
  //   1) atualiza o registro em state.reps
  //   2) aplica a regra de comissao da classificacao escolhida
  //      (Representante=6%, Showroom=7%)
  //   3) marca dirty (R07)
  //   4) reescreve a celula de comissao da linha
  function bindClassSelects(container) {
    container.querySelectorAll('.rep-class-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = Number(sel.dataset.idx);
        if (isNaN(idx) || !state.reps[idx]) return;
        const novoValor = sel.value;
        state.reps[idx].classificacao = novoValor;
        const novaComissao = comissaoPadraoPara(novoValor);
        if (novaComissao != null) {
          state.reps[idx].comissao_maxima = novaComissao;
          const tr = sel.closest('tr');
          const tdCom = tr ? tr.querySelector('.rep-comissao') : null;
          if (tdCom) tdCom.textContent = fmtPercent(novaComissao);
        }
        markDirty();
      });
    });
  }

  // --- Handlers do drawer (edicao de campos do rep e dos contatos) ---

  // Aplica edicao nos campos do proprio representante (gerente,
  // supervisor, comissao). Recebe o input/select alterado.
  function aplicarEdicaoCampoRep(el) {
    const idx = Number(el.dataset.repIdx);
    const campo = el.dataset.campoRep;
    if (isNaN(idx) || !state.reps[idx] || !campo) return;
    let valor = el.value;
    if (campo === 'comissao_maxima') {
      // Aceita "6,00%", "6,00", "6", "0.06", etc — converte pra fracao
      const num = parseBR(String(valor).replace('%', ''));
      if (num == null || isNaN(num)) return;
      // Se vier numero >= 1, assume porcentagem (ex: 6 = 6%)
      state.reps[idx].comissao_maxima = num >= 1 ? num / 100 : num;
    } else {
      state.reps[idx][campo] = valor;
    }
    markDirty();
  }

  // Aplica edicao nos campos de um contato individual.
  function aplicarEdicaoCampoContato(el) {
    const idx = Number(el.dataset.repIdx);
    const ci = Number(el.dataset.contatoIdx);
    const campo = el.dataset.campoContato;
    if (isNaN(idx) || isNaN(ci) || !state.reps[idx] || !campo) return;
    const lista = state.reps[idx].contatos || (state.reps[idx].contatos = []);
    if (!lista[ci]) return;
    lista[ci][campo] = el.value;
    markDirty();
    // Se mudou cargo, atualiza a tag visual sem rerenderizar tudo
    if (campo === 'cargo') {
      const card = el.closest('.rep-contato-card');
      const tag = card && card.querySelector('.rep-contato-cargo-tag');
      if (tag) {
        tag.textContent = el.value;
        const up = String(el.value || '').toUpperCase();
        tag.className = 'rep-contato-cargo-tag';
        if (up === 'VENDEDOR')      tag.classList.add('is-vendedor');
        else if (up === 'REPRESENTANTE') tag.classList.add('is-rep');
        // Gerente/Coord/Sup ficam sem classe extra (cor laranja default da tag)
      }
    }
  }

  function adicionarContato(container, repIdx) {
    if (!state.reps[repIdx]) return;
    if (!Array.isArray(state.reps[repIdx].contatos)) state.reps[repIdx].contatos = [];
    state.reps[repIdx].contatos.push({
      nome: '', cargo: 'Representante', telefone: '', email: '',
    });
    markDirty();
    // Re-renderiza o drawer pra mostrar o novo card; tabela tambem pra atualizar contagem
    const mount = container.querySelector('#rep-drawer-mount');
    if (mount) mount.innerHTML = renderDrawer(state.reps[repIdx]);
    bindDrawerEvents(container);
    bindDrawerEditFields(container);
    redrawTable(container);
  }

  function removerContato(container, repIdx, ci) {
    if (!state.reps[repIdx] || !Array.isArray(state.reps[repIdx].contatos)) return;
    state.reps[repIdx].contatos.splice(ci, 1);
    markDirty();
    const mount = container.querySelector('#rep-drawer-mount');
    if (mount) mount.innerHTML = renderDrawer(state.reps[repIdx]);
    bindDrawerEvents(container);
    bindDrawerEditFields(container);
    redrawTable(container);
  }

  // Pluga listeners nos campos editaveis do drawer.
  function bindDrawerEditFields(container) {
    // Campos do representante (gerente, supervisor, comissao)
    container.querySelectorAll('[data-campo-rep]').forEach(el => {
      const evt = (el.tagName === 'SELECT') ? 'change' : 'change';
      el.addEventListener(evt, () => aplicarEdicaoCampoRep(el));
      if (el.tagName === 'INPUT') {
        // tambem salva ao perder foco (caso usuario digite e sai)
        el.addEventListener('blur', () => aplicarEdicaoCampoRep(el));
      }
    });
    // Campos de contato (nome, cargo, telefone, email)
    container.querySelectorAll('[data-campo-contato]').forEach(el => {
      el.addEventListener('change', () => aplicarEdicaoCampoContato(el));
      if (el.tagName === 'INPUT') {
        el.addEventListener('blur', () => aplicarEdicaoCampoContato(el));
      }
    });
    // Botao "+ Adicionar Contato"
    container.querySelectorAll('[data-action="adicionar-contato"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.repIdx);
        if (!isNaN(idx)) adicionarContato(container, idx);
      });
    });
    // Botao "Remover" em cada contato
    container.querySelectorAll('[data-action="remover-contato"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.repIdx);
        const ci = Number(btn.dataset.contatoIdx);
        if (!isNaN(idx) && !isNaN(ci)) removerContato(container, idx, ci);
      });
    });
  }

  function bindRowClicks(container) {
    container.querySelectorAll('.rep-table tbody tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const fup = tr.dataset.followup;
        if (fup) abrirDrawer(container, fup);
      });
    });
  }

  function bindDrawerEvents(container) {
    const overlay = container.querySelector('#rep-drawer-overlay');
    const btnClose = container.querySelector('#rep-drawer-close');
    if (btnClose) btnClose.addEventListener('click', () => fecharDrawer(container));
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) fecharDrawer(container);
      });
    }
  }

  /* ============================================================
     R16 — EXPORT/IMPORT XLSX
     ============================================================
     Exporta os campos editaveis. Importacao por Followup (PK):
     - Followup novo  → adiciona representante
     - Followup existente → atualiza campos editaveis
     - Followup ausente no arquivo → MANTEM no sistema (NAO remove)
       (estrategia mais segura que sync total — usuario pode importar
        atualizacao parcial sem perder dados)
     Contatos NAO sao importados via Excel (estrutura aninhada).
     Pra editar contatos use o drawer (clique na linha).
     ============================================================ */
  function exportarRepsXLSX() {
    const headers = ['Followup','BRA','Razao Social','Classificacao','Comissao Maxima %','Gerente','Coordenador','Supervisor','Vendedores','Qtd Contatos'];
    const rows = state.reps.map(r => [
      r.followup || '',
      r.bra || '',
      r.razao_social || '',
      r.classificacao || 'Representante',
      Number(((Number(r.comissao_maxima) || 0) * 100).toFixed(2)),
      r.gerente || '',
      r.coordenador || '',
      r.supervisor || '',
      r.vendedores || '',
      (r.contatos || []).length,
    ]);
    if (window.Universal && window.Universal.exportXLSX) {
      window.Universal.exportXLSX({
        headers, rows,
        sheetName: 'Representantes',
        fileName: 'representantes_projetta',
      });
    } else {
      alert('Universal.exportXLSX nao disponivel.');
    }
  }

  function importarRepsXLSX(file) {
    if (!window.Universal || !window.Universal.readXLSXFile) {
      alert('Universal.readXLSXFile nao disponivel.');
      return;
    }
    window.Universal.readXLSXFile(file, (aoa, fileName) => {
      if (!aoa || aoa.length < 2) {
        alert('A planilha esta vazia ou sem linhas de dados.');
        return;
      }
      const idx = window.Universal.parseHeaders(aoa[0], {
        followup:     'followup',
        bra:          'bra',
        razao_social: 'razao social',
        classificacao:'classificacao',
        comissao:     'comissao maxima %',
        gerente:      'gerente',
        coordenador:  'coordenador',
        supervisor:   'supervisor',
        vendedores:   'vendedores',
      });
      if (idx.followup === -1) {
        alert('A planilha nao tem coluna "Followup". Esse campo eh obrigatorio (chave do registro).\n\nEsperado: ' + ['Followup','BRA','Razao Social','Classificacao','Comissao Maxima %','Gerente','Coordenador','Supervisor','Vendedores'].join(', '));
        return;
      }

      let novos = 0, atualizados = 0, ignorados = 0;
      for (let i = 1; i < aoa.length; i++) {
        const row = aoa[i];
        const followup = String(row[idx.followup] || '').trim();
        if (!followup) { ignorados++; continue; }

        const dados = {
          followup,
          bra:           idx.bra >= 0           ? String(row[idx.bra] || '').trim() : '',
          razao_social:  idx.razao_social >= 0  ? String(row[idx.razao_social] || '').trim() : '',
          classificacao: idx.classificacao >= 0 ? String(row[idx.classificacao] || 'Representante').trim() : 'Representante',
          comissao_maxima: idx.comissao >= 0    ? (Number(String(row[idx.comissao] || '0').replace(',','.')) || 0) / 100 : 0,
          gerente:       idx.gerente >= 0       ? String(row[idx.gerente] || '').trim() : '',
          coordenador:   idx.coordenador >= 0   ? String(row[idx.coordenador] || '').trim() : '',
          supervisor:    idx.supervisor >= 0    ? String(row[idx.supervisor] || '').trim() : '',
          vendedores:    idx.vendedores >= 0    ? String(row[idx.vendedores] || '').trim() : '',
        };

        const existente = state.reps.find(r => r.followup === followup);
        if (existente) {
          // Preserva contatos (nao vem na planilha)
          Object.assign(existente, dados);
          atualizados++;
        } else {
          state.reps.push({ ...dados, contatos: [] });
          novos++;
        }
      }

      if (novos + atualizados === 0) {
        alert(`Nenhuma linha valida encontrada em "${fileName}".`);
        return;
      }

      const ok = confirm(`Importar de "${fileName}"?\n\n` +
        `${novos} novo(s) representante(s) serao adicionados.\n` +
        `${atualizados} existente(s) serao atualizados.\n` +
        (ignorados > 0 ? `${ignorados} linha(s) sem followup serao ignoradas.\n` : '') +
        `\nContatos existentes NAO serao alterados (planilha nao traz contatos).\n\nConfirmar?`);
      if (!ok) {
        // Reverte: como ja modifiquei state.reps em memoria, recarrego do storage
        state.reps = store.get('representantes_lista') || state.reps;
        return;
      }

      save();
      const tbl = document.querySelector('.rep-table');
      const mount = document.querySelector('#rep-table-mount');
      if (mount) mount.innerHTML = renderTable();
      // Re-bind após re-render
      const container = mount && mount.parentElement;
      if (container) {
        bindRowClicks(container);
        bindClassSelects(container);
        bindSortHeaders(container);
        bindRowDeleteButtons(container);
        const t2 = container.querySelector('.rep-table');
        if (t2 && window.Universal) window.Universal.autoEnhance(t2);
      }
      if (window.showSavedDialog) {
        window.showSavedDialog(`Importacao concluida!\n\n${novos} novo(s), ${atualizados} atualizado(s).`);
      }
    });
  }

  // Expoe `listar()` pro CRM (e quem mais precisar) puxar o cadastro
  // sem depender da aba ter sido aberta.
  function listar() {
    load();
    return state.reps.slice();
  }

  return { render, buscarPorFollowup, listar };
})();

// Expoe globalmente pra ser consumido pelo WeikuClient
if (typeof window !== 'undefined') {
  window.Representantes = Representantes;
}

App.register('representantes', {
  render(container) {
    Representantes.render(container);
  }
});
