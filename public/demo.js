// Dados da demonstração: roda sem chave de API, para quem visita o portfólio.
export const PERFIL_DEMO = {
  cargo: "Analista de atendimento a parceiros",
  area: "Suporte a restaurantes parceiros em um app de delivery",
  ferramentas: "Gmail, Google Sheets, Slack, Zendesk",
};

export const ROTEIRO_DEMO = [
  {
    pergunta: "Oi! Vamos descobrir onde a IA pode te devolver tempo. Para começar: como é um dia típico seu, do momento em que você abre o computador até o fim do expediente?",
    resposta: "Abro o Zendesk e a caixa do Gmail, respondo os chamados dos restaurantes (dúvida de repasse, cardápio fora do ar, pedido cancelado). À tarde atualizo a planilha de casos e no fim do dia mando um resumo no Slack para a liderança.",
  },
  {
    pergunta: "Quantos chamados você responde por dia, e quanto tempo leva em média cada um?",
    resposta: "Uns 40 por dia. Os simples levam 3 a 5 minutos, mas metade é a mesma dúvida de repasse e eu copio e colo resposta de um documento.",
  },
  {
    pergunta: "E a planilha de casos: o que você registra nela e quanto tempo isso toma por dia?",
    resposta: "Registro restaurante, motivo, se resolvi ou escalei. Faço tudo à mão copiando do Zendesk, uns 50 minutos por dia.",
  },
  {
    pergunta: "Entendi. E o resumo do fim do dia para a liderança, como você monta e quanto tempo leva?",
    resposta: "Olho a planilha, conto os motivos mais comuns e escrevo um texto no Slack. Uns 30 minutos.",
  },
  {
    pergunta: "Última: existe alguma tarefa semanal ou mensal que te consome bastante tempo?",
    resposta: "Toda segunda eu reviso os restaurantes com mais reclamações na semana e mando e-mail para cada um com orientações. Leva umas 3 horas.",
  },
];

export const RELATORIO_DEMO = {
  resumo_funcao:
    "Você é a ponte entre os restaurantes parceiros e a operação. O maior desperdício está em respostas repetidas e em copiar dados do Zendesk para a planilha: mais de 9 horas por semana de trabalho que não exige julgamento.",
  tarefas: [
    {
      nome: "Responder dúvidas de repasse",
      descricao: "Responde cerca de 20 chamados por dia com a mesma explicação, copiando de um documento.",
      frequencia: "diária",
      horas_por_semana: 7,
      potencial: "alto",
      percentual_automatizavel: 75,
      como_automatizar: "A IA classifica o chamado que chega no Zendesk, identifica dúvidas de repasse e escreve a resposta com os dados do restaurante. Você só revisa e envia.",
      ferramentas_sugeridas: ["n8n", "Claude API", "Zendesk"],
      o_que_continua_humano: "Revisar a resposta antes de enviar e tratar os casos fora do padrão.",
    },
    {
      nome: "Registrar casos na planilha",
      descricao: "Copia restaurante, motivo e status de cada chamado do Zendesk para o Google Sheets.",
      frequencia: "diária",
      horas_por_semana: 4.2,
      potencial: "alto",
      percentual_automatizavel: 95,
      como_automatizar: "Um fluxo no n8n lê os chamados fechados e grava uma linha na planilha, com o motivo classificado pela IA.",
      ferramentas_sugeridas: ["n8n", "Google Sheets", "Claude API"],
      o_que_continua_humano: "Corrigir uma classificação errada de vez em quando.",
    },
    {
      nome: "Resumo diário no Slack",
      descricao: "Conta os motivos mais comuns na planilha e escreve um texto para a liderança.",
      frequencia: "diária",
      horas_por_semana: 2.5,
      potencial: "alto",
      percentual_automatizavel: 85,
      como_automatizar: "Às 17h a IA lê a planilha do dia, resume números e tendências e posta o rascunho no seu Slack para você aprovar.",
      ferramentas_sugeridas: ["n8n", "Google Sheets", "Slack", "Claude API"],
      o_que_continua_humano: "Acrescentar contexto que só você sabe (um caso grave, uma conversa com o parceiro).",
    },
    {
      nome: "Orientar restaurantes com reclamações",
      descricao: "Toda segunda revisa os restaurantes com mais reclamações e escreve um e-mail para cada um.",
      frequencia: "semanal",
      horas_por_semana: 3,
      potencial: "medio",
      percentual_automatizavel: 50,
      como_automatizar: "A IA agrupa as reclamações por restaurante e escreve um rascunho de e-mail personalizado para cada um.",
      ferramentas_sugeridas: ["n8n", "Gmail", "Claude API"],
      o_que_continua_humano: "Ajustar o tom com cada parceiro e decidir quando ligar em vez de mandar e-mail.",
    },
    {
      nome: "Chamados fora do padrão",
      descricao: "Pedidos cancelados, cardápio fora do ar e outros casos que exigem investigação.",
      frequencia: "diária",
      horas_por_semana: 10,
      potencial: "baixo",
      percentual_automatizavel: 15,
      como_automatizar: "A IA pode só puxar o histórico do restaurante e sugerir uma hipótese, poupando a busca inicial.",
      ferramentas_sugeridas: ["Claude API", "Zendesk"],
      o_que_continua_humano: "A investigação e a decisão: é aqui que seu conhecimento faz diferença.",
    },
  ],
  primeiro_passo:
    "Comece pelo registro automático na planilha: é o fluxo mais simples de montar (sem enviar nada para cliente), economiza 4 horas por semana e os dados dele alimentam o resumo diário depois.",
};

export function planoDemo(tarefa) {
  if (tarefa.nome === "Registrar casos na planilha") {
    return {
      nome_fluxo: "Chamados fechados → planilha de casos",
      objetivo: "Registrar automaticamente cada chamado fechado no Zendesk na planilha de casos, com o motivo classificado pela IA.",
      gatilho: { tipo: "agendado", detalhe: "a cada 30 minutos, em horário comercial" },
      passos: [
        { tipo: "http", nome: "Buscar chamados fechados", o_que_faz: "Busca no Zendesk os chamados fechados nos últimos 30 minutos.", configuracao: "GET https://SUA_EMPRESA.zendesk.com/api/v2/search.json?query=status:solved updated>30minutes, com credencial do Zendesk." },
        { tipo: "codigo", nome: "Separar um item por chamado", o_que_faz: "Transforma a lista em um item por chamado.", configuracao: "return $json.results.map(c => ({ json: { id: c.id, assunto: c.subject, texto: c.description, restaurante: c.organization_id } }));" },
        { tipo: "ia_claude", nome: "Classificar motivo", o_que_faz: "Lê o chamado e devolve o motivo em uma categoria fixa.", configuracao: "Classifique o chamado abaixo em UMA categoria: repasse, cardapio, pedido_cancelado, cadastro, outro. Responda só com a categoria.\n\nAssunto: {{ $json.assunto }}\nTexto: {{ $json.texto }}" },
        { tipo: "google_sheets", nome: "Gravar na planilha", o_que_faz: "Adiciona uma linha na planilha de casos.", configuracao: "Operação: Append row. Colunas: data, id do chamado, restaurante, motivo (saída da IA), status = resolvido." },
      ],
      como_testar: "Feche um chamado de teste no Zendesk, rode o fluxo manualmente e confira se a linha apareceu na planilha com o motivo certo.",
      horas_economizadas_semana: 4,
    };
  }
  if (tarefa.nome === "Responder dúvidas de repasse") {
    return {
      nome_fluxo: "Rascunho automático para dúvidas de repasse",
      objetivo: "Quando chega um chamado novo, a IA verifica se é dúvida de repasse e deixa a resposta pronta no chamado para você revisar e enviar.",
      gatilho: { tipo: "webhook", detalhe: "o Zendesk avisa o n8n a cada chamado novo" },
      passos: [
        { tipo: "ia_claude", nome: "Classificar chamado", o_que_faz: "Diz se o chamado é dúvida de repasse.", configuracao: "Este chamado de um restaurante parceiro é uma dúvida sobre repasse (pagamento, valor, data, desconto)? Responda só SIM ou NAO.\n\nAssunto: {{ $json.body.assunto }}\nTexto: {{ $json.body.texto }}" },
        { tipo: "condicao", nome: "É repasse?", o_que_faz: "Segue só se a IA respondeu SIM.", configuracao: "Condição: o texto da resposta da IA contém SIM." },
        { tipo: "google_sheets", nome: "Buscar dados do restaurante", o_que_faz: "Pega o calendário e os valores de repasse do restaurante.", configuracao: "Operação: Get rows na planilha de repasses, filtrando pelo ID do restaurante do chamado." },
        { tipo: "ia_claude", nome: "Escrever resposta", o_que_faz: "Escreve a resposta usando os dados reais do restaurante.", configuracao: "Você é analista de atendimento a restaurantes parceiros. Responda a dúvida de repasse abaixo de forma cordial e objetiva, usando SOMENTE os dados fornecidos. Se faltar dado, diga que vai verificar.\n\nDúvida: {{ $('Gatilho').item.json.body.texto }}\nDados do restaurante: {{ JSON.stringify($json) }}" },
        { tipo: "http", nome: "Salvar como nota interna", o_que_faz: "Grava a resposta como nota interna no chamado, sem enviar ao cliente.", configuracao: "PUT https://SUA_EMPRESA.zendesk.com/api/v2/tickets/{id}.json com comment.public = false e o texto da IA. Você revisa e publica." },
      ],
      como_testar: "Abra um chamado de teste perguntando sobre a data do repasse e confira se a nota interna aparece em menos de 1 minuto.",
      horas_economizadas_semana: 5.3,
    };
  }
  // Plano genérico para as demais tarefas da demonstração.
  const usaSlack = tarefa.ferramentas_sugeridas.includes("Slack");
  const usaGmail = tarefa.ferramentas_sugeridas.includes("Gmail");
  return {
    nome_fluxo: tarefa.nome,
    objetivo: tarefa.como_automatizar,
    gatilho: { tipo: "agendado", detalhe: tarefa.frequencia === "semanal" ? "toda segunda às 8h" : "todo dia às 17h" },
    passos: [
      { tipo: "google_sheets", nome: "Ler dados do período", o_que_faz: "Lê os registros do período na planilha.", configuracao: "Operação: Get rows, filtrando pela data do período." },
      { tipo: "ia_claude", nome: "Escrever rascunho", o_que_faz: "A IA escreve o rascunho a partir dos dados.", configuracao: `Você ajuda um profissional a ganhar tempo. Com base nos dados abaixo, escreva o rascunho para a tarefa "${tarefa.nome}". Seja objetivo e cordial.\n\nDados: {{ JSON.stringify($json) }}` },
      { tipo: usaSlack ? "slack" : usaGmail ? "gmail" : "slack", nome: "Enviar para aprovação", o_que_faz: "Manda o rascunho para você revisar antes de seguir.", configuracao: usaGmail ? "Criar rascunho no Gmail (não enviar)." : "Mensagem direta para você no Slack com o rascunho." },
    ],
    como_testar: "Rode o fluxo manualmente com a planilha de exemplo e confira o rascunho recebido.",
    horas_economizadas_semana: Math.round(tarefa.horas_por_semana * tarefa.percentual_automatizavel) / 100,
  };
}

// ---------------------------------------------------------------------------
// Exemplo 2: operações de logística (entregadores)
// ---------------------------------------------------------------------------
const PERFIL_LOGISTICA = {
  cargo: "Analista de operações logísticas",
  area: "Operação de entregas e suporte a entregadores em um app de delivery",
  ferramentas: "Google Sheets, Looker Studio, Slack, WhatsApp Business, Gmail",
};

const ROTEIRO_LOGISTICA = [
  {
    pergunta: "Oi! Vamos descobrir onde a IA pode te devolver tempo. Para começar: como é um dia típico seu, do momento em que você abre o computador até o fim do expediente?",
    resposta: "Começo vendo o painel de entregas da noite anterior e procuro regiões com atraso alto. Depois respondo os entregadores que mandaram mensagem sobre pagamento ou conta bloqueada, e no fim da semana preparo os incentivos para os horários de pico.",
  },
  {
    pergunta: "Quantas mensagens de entregadores você responde por dia, e quanto tempo leva cada uma?",
    resposta: "Umas 60 por dia no WhatsApp de suporte. A maioria é a mesma pergunta: quando cai o pagamento, por que a conta foi bloqueada. Uns 2 minutos cada.",
  },
  {
    pergunta: "E a análise de atrasos da manhã: o que você faz e quanto tempo leva?",
    resposta: "Exporto do painel, filtro na planilha por região e horário e escrevo um resumo dos pontos críticos no Slack. Uns 40 minutos por dia.",
  },
  {
    pergunta: "Como você define os incentivos dos horários de pico, e quanto tempo isso toma?",
    resposta: "Cruzo a previsão de demanda com quantos entregadores costumam ficar online e proponho o bônus por região. Umas 4 horas por semana, e o coordenador aprova.",
  },
  {
    pergunta: "Última: tem alguma tarefa semanal que consome muito tempo?",
    resposta: "Toda sexta junto as ocorrências da semana (reclamações de clientes, incidentes nas entregas) num relatório para a coordenação. Copio de e-mails e planilhas, leva umas 3 horas.",
  },
];

const RELATORIO_LOGISTICA = {
  resumo_funcao:
    "Você garante que as entregas aconteçam no tempo e que os entregadores tenham suporte. O maior peso está nas mesmas perguntas respondidas dezenas de vezes por dia no WhatsApp: 10 horas por semana, sete delas sem exigir análise.",
  tarefas: [
    {
      nome: "Responder dúvidas de entregadores",
      descricao: "Responde cerca de 60 mensagens por dia no WhatsApp, a maioria sobre data de pagamento e bloqueio de conta.",
      frequencia: "diária",
      horas_por_semana: 10,
      potencial: "alto",
      percentual_automatizavel: 70,
      como_automatizar: "A IA lê cada mensagem, responde sozinha as perguntas frequentes com os dados do entregador e encaminha para você só o que precisa de análise.",
      ferramentas_sugeridas: ["n8n", "WhatsApp Business", "Claude API", "Google Sheets"],
      o_que_continua_humano: "Os casos de bloqueio que exigem investigação e as conversas mais delicadas.",
    },
    {
      nome: "Resumo diário de atrasos",
      descricao: "Exporta o painel, filtra por região e horário e escreve os pontos críticos no Slack.",
      frequencia: "diária",
      horas_por_semana: 3.3,
      potencial: "alto",
      percentual_automatizavel: 85,
      como_automatizar: "Às 8h um fluxo puxa os dados do painel, a IA identifica as regiões fora do padrão e posta o resumo no Slack para você conferir.",
      ferramentas_sugeridas: ["n8n", "Google Sheets", "Claude API", "Slack"],
      o_que_continua_humano: "Decidir a ação para cada região crítica.",
    },
    {
      nome: "Relatório semanal de ocorrências",
      descricao: "Junta reclamações e incidentes de e-mails e planilhas num relatório para a coordenação.",
      frequencia: "semanal",
      horas_por_semana: 3,
      potencial: "alto",
      percentual_automatizavel: 65,
      como_automatizar: "A IA coleta as ocorrências da semana, agrupa por tipo e região e monta o rascunho do relatório.",
      ferramentas_sugeridas: ["n8n", "Gmail", "Google Sheets", "Claude API"],
      o_que_continua_humano: "Revisar os casos sensíveis e escrever as recomendações.",
    },
    {
      nome: "Propor incentivos de pico",
      descricao: "Cruza previsão de demanda com entregadores online e propõe bônus por região.",
      frequencia: "semanal",
      horas_por_semana: 4,
      potencial: "medio",
      percentual_automatizavel: 40,
      como_automatizar: "A IA prepara a tabela cruzada e uma proposta inicial de bônus com a justificativa de cada região.",
      ferramentas_sugeridas: ["Google Sheets", "Claude API"],
      o_que_continua_humano: "A decisão final dos valores e a negociação com o coordenador.",
    },
    {
      nome: "Investigar bloqueios de conta",
      descricao: "Analisa o histórico do entregador para decidir se o bloqueio se mantém.",
      frequencia: "diária",
      horas_por_semana: 3,
      potencial: "baixo",
      percentual_automatizavel: 20,
      como_automatizar: "A IA pode só reunir o histórico do entregador num resumo antes da sua análise.",
      ferramentas_sugeridas: ["Claude API"],
      o_que_continua_humano: "A investigação e a decisão, que afetam a renda de uma pessoa.",
    },
  ],
  primeiro_passo:
    "Comece pela resposta automática às dúvidas de pagamento: é o maior ganho (7 horas por semana) e o entregador recebe resposta na hora, em vez de esperar na fila.",
};

const PLANOS_LOGISTICA = {
  "Responder dúvidas de entregadores": {
    nome_fluxo: "Resposta automática para dúvidas de entregadores",
    objetivo: "Responder na hora as perguntas frequentes dos entregadores no WhatsApp e mandar para a fila humana só o que precisa de análise.",
    gatilho: { tipo: "webhook", detalhe: "o WhatsApp Business avisa o n8n a cada mensagem nova" },
    passos: [
      { tipo: "ia_claude", nome: "Classificar mensagem", o_que_faz: "Diz se é dúvida de pagamento, bloqueio ou outro assunto.", configuracao: "Classifique a mensagem de um entregador em UMA categoria: pagamento, bloqueio, outro. Responda só com a categoria.\n\nMensagem: {{ $json.body.texto }}" },
      { tipo: "condicao", nome: "É sobre pagamento?", o_que_faz: "Segue no fluxo automático só se for pagamento.", configuracao: "Condição: a categoria é igual a pagamento. As demais vão para a fila de atendimento humano." },
      { tipo: "google_sheets", nome: "Buscar calendário de pagamento", o_que_faz: "Pega a data e o valor previsto do repasse do entregador.", configuracao: "Operação: Get rows na planilha de pagamentos, filtrando pelo telefone do entregador." },
      { tipo: "ia_claude", nome: "Escrever resposta", o_que_faz: "Escreve uma resposta curta e cordial com os dados reais.", configuracao: "Você é do suporte a entregadores. Responda em até 3 frases, de forma simples e cordial, usando SOMENTE estes dados. Se faltar dado, diga que um atendente vai verificar.\n\nPergunta: {{ $('Gatilho').item.json.body.texto }}\nDados: {{ JSON.stringify($json) }}" },
      { tipo: "whatsapp", nome: "Enviar resposta", o_que_faz: "Manda a resposta para o entregador.", configuracao: "POST na API do WhatsApp Business com o número do entregador e o texto gerado." },
      { tipo: "google_sheets", nome: "Registrar atendimento", o_que_faz: "Guarda o que foi respondido, para você auditar.", configuracao: "Operação: Append row com data, telefone, pergunta, resposta enviada." },
    ],
    como_testar: "Mande do seu celular para o número de teste a pergunta 'quando cai meu pagamento?' e confira se a resposta chega em menos de 1 minuto e aparece na planilha.",
    horas_economizadas_semana: 7,
  },
};

// ---------------------------------------------------------------------------
// Exemplo 3: comercial (novos restaurantes)
// ---------------------------------------------------------------------------
const PERFIL_COMERCIAL = {
  cargo: "Executiva comercial de expansão",
  area: "Trazer novos restaurantes para um app de delivery",
  ferramentas: "Salesforce, Gmail, WhatsApp, Google Maps, Google Sheets",
};

const ROTEIRO_COMERCIAL = [
  {
    pergunta: "Oi! Vamos descobrir onde a IA pode te devolver tempo. Para começar: como é um dia típico seu, do momento em que você abre o computador até o fim do expediente?",
    resposta: "Pesquiso restaurantes da minha região que ainda não estão no app, mando mensagem para os donos, faço ligações e visitas. Quando fecham, faço o cadastro e acompanho a primeira semana deles.",
  },
  {
    pergunta: "Como você encontra esses restaurantes, e quanto tempo gasta nessa pesquisa?",
    resposta: "Procuro no Google Maps e no Instagram, vejo nota, tipo de cozinha, se já faz entrega própria. Monto uma lista na planilha. Umas 5 horas por semana.",
  },
  {
    pergunta: "E as mensagens para os donos: quantas manda por dia e quanto tempo leva cada uma?",
    resposta: "Umas 30 por dia. Adapto um modelo para cada restaurante, uns 3 minutos cada. Depois faço o acompanhamento de quem não respondeu.",
  },
  {
    pergunta: "Como funciona o cadastro de um restaurante que fechou com você?",
    resposta: "O pior é o cardápio: o dono manda foto do cardápio de papel e eu digito item por item, com preço e descrição. Leva 1h30 por restaurante, e fecho uns 4 por semana.",
  },
  {
    pergunta: "Última: tem alguma tarefa de registro ou relatório que consome tempo?",
    resposta: "Atualizo o Salesforce no fim do dia com o que aconteceu em cada conversa. Uns 30 minutos por dia.",
  },
];

const RELATORIO_COMERCIAL = {
  resumo_funcao:
    "Seu valor está na conversa com o dono do restaurante, mas quase metade da semana vai para digitação e pesquisa. Digitar cardápios, sozinho, consome 6 horas por semana que uma IA com visão faz em minutos.",
  tarefas: [
    {
      nome: "Digitar cardápios de novos parceiros",
      descricao: "Transcreve à mão o cardápio de papel de cada restaurante novo: itens, preços e descrições.",
      frequencia: "semanal",
      horas_por_semana: 6,
      potencial: "alto",
      percentual_automatizavel: 85,
      como_automatizar: "O dono manda a foto do cardápio; a IA lê a imagem, monta a planilha de itens no formato do cadastro e escreve descrições melhores.",
      ferramentas_sugeridas: ["n8n", "Claude API (visão)", "Google Sheets"],
      o_que_continua_humano: "Conferir preços e confirmar o cardápio com o dono.",
    },
    {
      nome: "Escrever mensagens de prospecção",
      descricao: "Adapta um modelo de mensagem para cerca de 30 restaurantes por dia.",
      frequencia: "diária",
      horas_por_semana: 7.5,
      potencial: "alto",
      percentual_automatizavel: 60,
      como_automatizar: "A IA escreve uma primeira mensagem personalizada para cada restaurante da lista, citando a cozinha e as avaliações dele, e deixa os rascunhos prontos.",
      ferramentas_sugeridas: ["n8n", "Claude API", "Google Sheets"],
      o_que_continua_humano: "Enviar, responder e construir a relação com cada dono.",
    },
    {
      nome: "Pesquisar restaurantes para prospectar",
      descricao: "Busca restaurantes no Google Maps e Instagram e monta a lista na planilha.",
      frequencia: "semanal",
      horas_por_semana: 5,
      potencial: "alto",
      percentual_automatizavel: 70,
      como_automatizar: "Um fluxo busca os restaurantes da região, a IA avalia o potencial de cada um e entrega a lista já priorizada.",
      ferramentas_sugeridas: ["n8n", "Google Places", "Claude API", "Google Sheets"],
      o_que_continua_humano: "Escolher em quais apostar, com o que você conhece do bairro.",
    },
    {
      nome: "Atualizar o CRM",
      descricao: "Registra no Salesforce o resultado de cada conversa do dia.",
      frequencia: "diária",
      horas_por_semana: 2.5,
      potencial: "alto",
      percentual_automatizavel: 80,
      como_automatizar: "Você grava um áudio de 1 minuto no fim do dia; a IA transcreve, separa por restaurante e atualiza cada registro.",
      ferramentas_sugeridas: ["n8n", "Whisper", "Claude API", "Salesforce"],
      o_que_continua_humano: "Conferir as atualizações antes de salvar.",
    },
    {
      nome: "Visitas e negociação",
      descricao: "Liga, visita e negocia condições com os donos.",
      frequencia: "diária",
      horas_por_semana: 12,
      potencial: "baixo",
      percentual_automatizavel: 5,
      como_automatizar: "A IA pode só preparar um resumo do restaurante antes de cada visita.",
      ferramentas_sugeridas: ["Claude API"],
      o_que_continua_humano: "Toda a negociação: é aqui que você fecha contratos.",
    },
  ],
  primeiro_passo:
    "Comece pelo cardápio por foto: é o fluxo com maior percentual de ganho, o restaurante entra no ar mais rápido e você deixa de digitar 6 horas por semana.",
};

const PLANOS_COMERCIAL = {
  "Digitar cardápios de novos parceiros": {
    nome_fluxo: "Cardápio por foto",
    objetivo: "Transformar a foto do cardápio de papel em uma planilha pronta para o cadastro, com descrições melhores.",
    gatilho: { tipo: "novo_email", detalhe: "chega um e-mail com a foto do cardápio" },
    passos: [
      { tipo: "codigo", nome: "Preparar imagens", o_que_faz: "Converte as fotos anexadas para o formato que a IA lê.", configuracao: "Para cada anexo de imagem, gere o base64 e o tipo (image/jpeg ou image/png)." },
      { tipo: "ia_claude", nome: "Ler o cardápio", o_que_faz: "Extrai todos os itens da foto em formato estruturado.", configuracao: "Envie a imagem como bloco do tipo image. Prompt: Extraia todos os itens deste cardápio. Responda em JSON: lista de objetos com categoria, nome, preco (número) e descricao_original. Não invente itens nem preços." },
      { tipo: "ia_claude", nome: "Melhorar descrições", o_que_faz: "Escreve descrições curtas e apetitosas para cada item.", configuracao: "Para cada item, escreva uma descrição de até 20 palavras, apetitosa e fiel aos ingredientes. Não mude nome nem preço. Devolva o mesmo JSON com o campo descricao_nova." },
      { tipo: "google_sheets", nome: "Criar planilha do cardápio", o_que_faz: "Grava os itens no modelo de cadastro.", configuracao: "Operação: Append rows na planilha modelo de cardápio, uma linha por item." },
      { tipo: "gmail", nome: "Enviar para conferência", o_que_faz: "Manda a planilha para você e o dono conferirem os preços.", configuracao: "Criar rascunho de e-mail para o dono com o link da planilha, pedindo confirmação dos preços." },
    ],
    como_testar: "Mande para o e-mail do fluxo a foto de um cardápio real e compare os preços da planilha com a foto, item por item.",
    horas_economizadas_semana: 5.1,
  },
};

// ---------------------------------------------------------------------------
// Lista de exemplos mostrada na página inicial
// ---------------------------------------------------------------------------
const PLANOS_ATENDIMENTO = {};

export const DEMOS = [
  { id: "atendimento", rotulo: "Atendimento a restaurantes", numero: "2026-0247", perfil: PERFIL_DEMO, roteiro: ROTEIRO_DEMO, relatorio: RELATORIO_DEMO, planos: PLANOS_ATENDIMENTO },
  { id: "logistica", rotulo: "Operações com entregadores", numero: "2026-0312", perfil: PERFIL_LOGISTICA, roteiro: ROTEIRO_LOGISTICA, relatorio: RELATORIO_LOGISTICA, planos: PLANOS_LOGISTICA },
  { id: "comercial", rotulo: "Comercial de novos restaurantes", numero: "2026-0458", perfil: PERFIL_COMERCIAL, roteiro: ROTEIRO_COMERCIAL, relatorio: RELATORIO_COMERCIAL, planos: PLANOS_COMERCIAL },
];

export function planoDoExemplo(demo, tarefa) {
  return demo.planos[tarefa.nome] || planoDemo(tarefa);
}
