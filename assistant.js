// =============================================================================
// assistant.js — Motor de Inteligência & Consultas em Tempo Real
// Executa comandos rápidos (/) e consultas em linguagem natural contra o PostgreSQL
// Latência esperada: < 10ms (requisito: < 500ms)
// Padrão Humanizer: pt-BR formal, direto, sem clichês de IA
// =============================================================================

/**
 * Formata um valor numérico para o padrão de moeda Real Brasileiro (R$ X.XXX,XX).
 * @param {number|string} valor
 * @returns {string}
 */
function formatarBRL(valor) {
  const num = typeof valor === 'number' ? valor : parseFloat(valor || 0);
  return 'R$ ' + num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata uma data ISO/PostgreSQL para o padrão pt-BR: DD/MM/YYYY às HH:MM.
 * @param {Date|string} dateVal
 * @returns {string}
 */
function formatarDataHora(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);

  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', ' às');
}

/**
 * Normaliza e resolve a conta de referência a partir de conta_id ou cliente_id.
 */
async function resolverConta(pool, contaId, clienteId) {
  if (contaId) {
    const res = await pool.query(`
      SELECT ct.id, ct.numero, ct.digito, ct.tipo, ct.status, ct.saldo, ct.limite,
             (ct.saldo + ct.limite) AS saldo_disponivel,
             cl.id AS cliente_id, cl.nome AS titular,
             ag.codigo AS agencia_codigo, ag.nome AS agencia_nome
      FROM contas ct
      JOIN clientes cl ON cl.id = ct.cliente_id
      JOIN agencias ag ON ag.id = ct.agencia_id
      WHERE ct.id = $1
    `, [contaId]);
    if (res.rows.length > 0) return res.rows[0];
  }

  if (clienteId) {
    const res = await pool.query(`
      SELECT ct.id, ct.numero, ct.digito, ct.tipo, ct.status, ct.saldo, ct.limite,
             (ct.saldo + ct.limite) AS saldo_disponivel,
             cl.id AS cliente_id, cl.nome AS titular,
             ag.codigo AS agencia_codigo, ag.nome AS agencia_nome
      FROM contas ct
      JOIN clientes cl ON cl.id = ct.cliente_id
      JOIN agencias ag ON ag.id = ct.agencia_id
      WHERE ct.cliente_id = $1 AND ct.status = 'ativa'
      ORDER BY (ct.tipo = 'corrente') DESC, ct.id ASC
      LIMIT 1
    `, [clienteId]);
    if (res.rows.length > 0) return res.rows[0];
  }

  // Fallback padrão: primeira conta ativa do banco
  const res = await pool.query(`
    SELECT ct.id, ct.numero, ct.digito, ct.tipo, ct.status, ct.saldo, ct.limite,
           (ct.saldo + ct.limite) AS saldo_disponivel,
           cl.id AS cliente_id, cl.nome AS titular,
           ag.codigo AS agencia_codigo, ag.nome AS agencia_nome
    FROM contas ct
    JOIN clientes cl ON cl.id = ct.cliente_id
    JOIN agencias ag ON ag.id = ct.agencia_id
    WHERE ct.status = 'ativa'
    ORDER BY ct.id ASC
    LIMIT 1
  `);
  return res.rows[0] || null;
}

// ─── Tratadores de Comandos Rápidos (/) ───────────────────────────────────────

async function tratarComandoSaldo(pool, contaId, clienteId) {
  const conta = await resolverConta(pool, contaId, clienteId);
  if (!conta) {
    return {
      sucesso: false,
      comando: 'saldo',
      tipo_resposta: 'saldo',
      tipo: 'comando',
      titulo: 'Conta não localizada',
      texto: 'Nenhuma conta ativa foi localizada para os parâmetros informados.',
      dados: null,
    };
  }

  const saldo = parseFloat(conta.saldo);
  const limite = parseFloat(conta.limite || 0);
  const saldoDisponivel = parseFloat(conta.saldo_disponivel || (saldo + limite));
  const numContaFmt = `${conta.numero}-${conta.digito}`;

  return {
    sucesso: true,
    comando: 'saldo',
    tipo_resposta: 'saldo',
    tipo: 'comando',
    titulo: 'Saldo da Conta Ativa',
    texto: `O saldo atual da conta ${numContaFmt} (${conta.tipo}) é de ${formatarBRL(saldo)}, com limite especial de ${formatarBRL(limite)} (Total disponível: ${formatarBRL(saldoDisponivel)}).`,
    dados: {
      conta: numContaFmt,
      conta_id: conta.id,
      numero: conta.numero,
      digito: conta.digito,
      tipo: conta.tipo,
      saldo,
      limite,
      saldo_disponivel: saldoDisponivel,
      titular: conta.titular,
      agencia: `${conta.agencia_codigo} - ${conta.agencia_nome}`,
      agencia_codigo: conta.agencia_codigo,
      agencia_nome: conta.agencia_nome,
    },
  };
}

async function tratarComandoExtrato(pool, contaId, clienteId) {
  const conta = await resolverConta(pool, contaId, clienteId);
  if (!conta) {
    return {
      sucesso: false,
      comando: 'extrato',
      tipo_resposta: 'extrato',
      tipo: 'comando',
      titulo: 'Conta não localizada',
      texto: 'Nenhuma conta ativa foi localizada para gerar o extrato.',
      dados: [],
    };
  }

  const res = await pool.query(`
    SELECT t.id, t.tipo, t.status, t.valor, t.descricao, t.realizada_em,
           CASE WHEN t.conta_destino_id = $1 THEN 'entrada' ELSE 'saida' END AS direcao,
           orig.numero AS conta_origem, cl_orig.nome AS remetente,
           dest.numero AS conta_destino, cl_dest.nome AS destinatario
    FROM transacoes t
    LEFT JOIN contas orig ON orig.id = t.conta_origem_id
    LEFT JOIN clientes cl_orig ON cl_orig.id = orig.cliente_id
    LEFT JOIN contas dest ON dest.id = t.conta_destino_id
    LEFT JOIN clientes cl_dest ON cl_dest.id = dest.cliente_id
    WHERE t.conta_origem_id = $1 OR t.conta_destino_id = $1
    ORDER BY t.realizada_em DESC
    LIMIT 5
  `, [conta.id]);

  const numContaFmt = `${conta.numero}-${conta.digito}`;
  const lancamentos = res.rows.map(t => {
    const valorNum = parseFloat(t.valor);
    const dataFmt = formatarDataHora(t.realizada_em);
    const contraparte = t.direcao === 'entrada'
      ? (t.remetente || 'Depósito')
      : (t.destinatario || 'Pagamento / Débito');

    return {
      id: parseInt(t.id, 10),
      tipo: t.tipo,
      status: t.status,
      direcao: t.direcao,
      valor: valorNum,
      valor_formatado: `${t.direcao === 'entrada' ? '+' : '-'} ${formatarBRL(valorNum)}`,
      descricao: t.descricao,
      realizada_em: t.realizada_em,
      data_formatada: dataFmt,
      contraparte,
      conta_origem: t.conta_origem,
      conta_destino: t.conta_destino,
    };
  });

  let texto;
  if (lancamentos.length === 0) {
    texto = `Nenhum lançamento recente encontrado para a conta ${numContaFmt}.`;
  } else {
    const linhas = lancamentos.map(l =>
      `• ${l.data_formatada} | ${l.descricao} | ${l.valor_formatado} (${l.contraparte})`
    ).join('\n');
    texto = `Últimos lançamentos da conta ${numContaFmt}:\n${linhas}`;
  }

  return {
    sucesso: true,
    comando: 'extrato',
    tipo_resposta: 'extrato',
    tipo: 'comando',
    titulo: 'Últimos Lançamentos',
    texto,
    dados: lancamentos,
  };
}

async function tratarComandoPix(pool, contaId) {
  const res = await pool.query(`
    SELECT DISTINCT ON (cl.id)
           ct.id AS conta_id, ct.numero, ct.digito, cl.id AS cliente_id, cl.nome AS titular,
           cl.cpf, cl.email, ct.tipo, ag.codigo AS agencia, ag.nome AS agencia_nome
    FROM contas ct
    JOIN clientes cl ON cl.id = ct.cliente_id
    JOIN agencias ag ON ag.id = ct.agencia_id
    WHERE ct.status = 'ativa'
      AND ($1::int IS NULL OR (
        ct.id != $1 AND ct.cliente_id != COALESCE((SELECT cliente_id FROM contas WHERE id = $1), 0)
      ))
    ORDER BY cl.id, ct.id
    LIMIT 5
  `, [contaId || null]);

  const contatos = res.rows.map(c => ({
    conta_id: c.conta_id,
    conta: `${c.numero}-${c.digito}`,
    numero: c.numero,
    digito: c.digito,
    titular: c.titular,
    cpf: c.cpf,
    email: c.email,
    tipo: c.tipo,
    agencia: c.agencia,
    agencia_nome: c.agencia_nome,
  }));

  const linhas = contatos.map(c => {
    const cpfMascarado = c.cpf ? `${c.cpf.slice(0, 3)}.***.***-${c.cpf.slice(-2)}` : 'Não informado';
    return `• ${c.titular} (Conta ${c.conta}, Agência ${c.agencia}, CPF ${cpfMascarado})`;
  }).join('\n');

  return {
    sucesso: true,
    comando: 'pix',
    tipo_resposta: 'pix',
    tipo: 'comando',
    titulo: 'Sugestões para PIX',
    texto: `Contatos frequentes sugeridos para transferência imediata via PIX:\n${linhas}`,
    dados: contatos,
  };
}

async function tratarComandoContas(pool, clienteId) {
  let query;
  let params = [];

  if (clienteId) {
    query = `
      SELECT ct.id, ct.numero, ct.digito, ct.tipo, ct.status, ct.saldo, ct.limite,
             (ct.saldo + ct.limite) AS saldo_disponivel,
             ag.codigo AS agencia_codigo, ag.nome AS agencia_nome,
             cl.nome AS titular
      FROM contas ct
      JOIN clientes cl ON cl.id = ct.cliente_id
      JOIN agencias ag ON ag.id = ct.agencia_id
      WHERE ct.cliente_id = $1
      ORDER BY (ct.status = 'ativa') DESC, ct.tipo ASC
    `;
    params = [clienteId];
  } else {
    query = `
      SELECT ct.id, ct.numero, ct.digito, ct.tipo, ct.status, ct.saldo, ct.limite,
             (ct.saldo + ct.limite) AS saldo_disponivel,
             ag.codigo AS agencia_codigo, ag.nome AS agencia_nome,
             cl.nome AS titular
      FROM contas ct
      JOIN clientes cl ON cl.id = ct.cliente_id
      JOIN agencias ag ON ag.id = ct.agencia_id
      WHERE ct.status = 'ativa'
      ORDER BY ct.saldo DESC
      LIMIT 10
    `;
  }

  const res = await pool.query(query, params);
  const contas = res.rows.map(ct => ({
    conta_id: ct.id,
    conta: `${ct.numero}-${ct.digito}`,
    numero: ct.numero,
    digito: ct.digito,
    tipo: ct.tipo,
    status: ct.status,
    saldo: parseFloat(ct.saldo),
    saldo_formatado: formatarBRL(ct.saldo),
    limite: parseFloat(ct.limite),
    saldo_disponivel: parseFloat(ct.saldo_disponivel),
    titular: ct.titular,
    agencia: `${ct.agencia_codigo} - ${ct.agencia_nome}`,
  }));

  const linhas = contas.map(c =>
    `• Conta ${c.conta} (${c.tipo}) | Titular: ${c.titular} | Saldo: ${c.saldo_formatado}`
  ).join('\n');

  return {
    sucesso: true,
    comando: 'contas',
    tipo_resposta: 'contas',
    tipo: 'comando',
    titulo: 'Contas Cadastradas',
    texto: `Contas encontradas no sistema:\n${linhas}`,
    dados: contas,
  };
}

async function tratarComandoAgencias(pool) {
  const res = await pool.query(`
    SELECT ag.id, ag.codigo, ag.nome, ag.cidade, ag.estado, ag.telefone,
           COUNT(ct.id) AS total_contas,
           COALESCE(SUM(ct.saldo), 0) AS saldo_total
    FROM agencias ag
    LEFT JOIN contas ct ON ct.agencia_id = ag.id AND ct.status = 'ativa'
    WHERE ag.ativa = true
    GROUP BY ag.id
    ORDER BY ag.codigo ASC
  `);

  const agencias = res.rows.map(a => ({
    id: a.id,
    codigo: a.codigo,
    nome: a.nome,
    cidade: a.cidade,
    estado: a.estado,
    telefone: a.telefone,
    total_contas: parseInt(a.total_contas, 10),
    saldo_total: parseFloat(a.saldo_total),
    saldo_total_formatado: formatarBRL(a.saldo_total),
  }));

  const linhas = agencias.map(a =>
    `• Agência ${a.codigo} - ${a.nome} (${a.cidade}/${a.estado}) | Tel: ${a.telefone} | ${a.total_contas} contas ativas`
  ).join('\n');

  return {
    sucesso: true,
    comando: 'agencias',
    tipo_resposta: 'agencias',
    tipo: 'comando',
    titulo: 'Rede de Agências',
    texto: `O Banco Fictício conta com ${agencias.length} agências ativas:\n${linhas}`,
    dados: agencias,
  };
}

function tratarComandoAjuda() {
  const texto = [
    'Comandos rápidos disponíveis:',
    '• /saldo: Exibe saldo atual, limite especial e total disponível da conta ativa.',
    '• /extrato: Apresenta os últimos lançamentos com entradas e saídas.',
    '• /pix: Sugere destinatários frequentes para transferências imediatas.',
    '• /contas: Consulta as contas cadastradas e seus saldos.',
    '• /agencias: Lista as agências bancárias, códigos e cidades.',
    '• /emprestimo: Simulação e contratação de crédito pessoal a 1,89% a.m.',
    '• /ajuda: Apresenta este guia de comandos e orientações.',
    '',
    'Exemplos de perguntas em linguagem natural:',
    '• "Qual o saldo da Ana Paula?"',
    '• "Quanto temos sob custódia no banco?"',
    '• "Qual foi a última transferência?"',
    '• "Quanto fica um empréstimo de 5000 em 12x?"',
    '• "Quantos clientes temos cadastrados?"',
    '• "Quais são as maiores agências do banco?"',
    '• "Qual foi o maior depósito realizado?"',
  ].join('\n');

  return {
    sucesso: true,
    comando: 'ajuda',
    tipo_resposta: 'ajuda',
    tipo: 'comando',
    titulo: 'Guia de Comandos e Ajuda',
    texto,
    dados: {
      comandos: [
        { comando: '/saldo', descricao: 'Consulta saldo, limite e total disponível da conta ativa' },
        { comando: '/extrato', descricao: 'Exibe histórico recente de entradas e saídas' },
        { comando: '/pix', descricao: 'Sugestões de destinatários para transferência instantânea' },
        { comando: '/contas', descricao: 'Listagem de contas ativas cadastradas' },
        { comando: '/agencias', descricao: 'Rede de agências bancárias e contatos' },
        { comando: '/emprestimo', descricao: 'Simulação e contratação de crédito pessoal a 1,89% a.m.' },
        { comando: '/ajuda', descricao: 'Catálogo de comandos e exemplos de uso' },
      ],
      exemplos_perguntas: [
        'Qual o saldo da Ana Paula?',
        'Quanto temos sob custódia no banco?',
        'Qual foi a última transferência?',
        'Quanto fica um empréstimo de 5000 em 12x?',
        'Quantos clientes temos cadastrados?',
        'Quais são as maiores agências do banco?',
        'Qual foi o maior depósito realizado?',
      ],
    },
  };
}

/**
 * Realiza os cálculos financeiros de um empréstimo pelo Sistema Francês / Tabela Price.
 * Taxa mensal fixa de 1,89% a.m. (CET: 25,19% a.a.)
 * @param {number|string} valor
 * @param {number|string} meses
 * @returns {object}
 */
function calcularEmprestimo(valor, meses) {
  const vParsed = parseFloat(valor);
  const v = Math.min(Math.max(isNaN(vParsed) ? 5000 : vParsed, 500), 50000);
  const nParsed = parseInt(meses, 10);
  const n = Math.min(Math.max(isNaN(nParsed) ? 12 : nParsed, 6), 48);
  const taxaMensal = 0.0189; // 1,89% a.m.

  const fator = Math.pow(1 + taxaMensal, n);
  const pmt = v * (taxaMensal * fator) / (fator - 1);
  const valorParcela = Math.round(pmt * 100) / 100;
  const total = Math.round(valorParcela * n * 100) / 100;
  const juros = Math.round((total - v) * 100) / 100;
  const cetAnual = Math.round((Math.pow(1 + taxaMensal, 12) - 1) * 10000) / 100; // 25.19%

  return {
    valor_solicitado: Math.round(v * 100) / 100,
    valor_solicitado_formatado: formatarBRL(v),
    meses: n,
    taxa_mensal: taxaMensal,
    taxa_mensal_formatada: '1,89% a.m.',
    taxa_mensal_percentual: '1,89% a.m.',
    taxa_anual_cet: cetAnual,
    taxa_anual_cet_formatada: '25,19% a.a.',
    cet_anual_percentual: '25,19% a.a.',
    valor_parcela: valorParcela,
    parcela_mensal: valorParcela,
    valor_parcela_formatado: formatarBRL(valorParcela),
    total_a_pagar: total,
    total_a_pagar_formatado: formatarBRL(total),
    total_juros: juros,
    total_juros_formatado: formatarBRL(juros),
  };
}

/**
 * Extrai parâmetros de empréstimo (valor e parcelas) de mensagens em linguagem natural.
 * @param {string} msg
 * @returns {{ valor: number|null, meses: number|null }}
 */
function extrairParametrosEmprestimoNLP(msg) {
  let meses = null;
  let valor = null;

  // Busca número de parcelas: "12x", "em 12 parcelas", "24 vezes", "36 meses"
  const matchParcelas = msg.match(/(?:em\s+)?(\d{1,2})\s*(?:x|vezes|meses|parcelas)\b/i);
  if (matchParcelas) {
    meses = parseInt(matchParcelas[1], 10);
  }

  // Busca valores monetários: "5000", "5.000", "10000", "R$ 5.000,00"
  const msgSemParcelas = msg.replace(/(?:em\s+)?\d{1,2}\s*(?:x|vezes|meses|parcelas)\b/gi, '');
  const matchValor = msgSemParcelas.match(/(?:r\$\s*|de\s+)?(\d{1,3}(?:\.\d{3})+|\d{3,5})(?:,\d{2})?/i);
  if (matchValor) {
    const rawVal = matchValor[1].replace(/\./g, '');
    const v = parseFloat(rawVal);
    if (!isNaN(v) && v >= 100) {
      valor = v;
    }
  }

  return { valor, meses };
}

/**
 * Trata comando ou consulta de simulação de empréstimo.
 */
async function tratarComandoEmprestimo(pool, contaId, clienteId, valor, meses, isCommand = true) {
  const conta = await resolverConta(pool, contaId, clienteId);
  const simulacao = calcularEmprestimo(valor, meses);

  const numContaFmt = conta ? `${conta.numero}-${conta.digito}` : '00010001-5';
  const titular = conta ? conta.titular : 'Titular';

  const texto = [
    `Simulação de Empréstimo Pessoal para a conta ${numContaFmt} (${titular}):`,
    `• Valor Solicitado: ${simulacao.valor_solicitado_formatado}`,
    `• Prazo: ${simulacao.meses} parcelas fixas`,
    `• Taxa de Juros: 1,89% a.m. (CET: 25,19% a.a.)`,
    `• Parcela Mensal: ${simulacao.valor_parcela_formatado}`,
    `• Total a Pagar: ${simulacao.total_a_pagar_formatado} (Juros: ${simulacao.total_juros_formatado})`,
    `Você pode efetivar a contratação imediata em 1 clique abaixo ou personalizar as parcelas no simulador.`,
  ].join('\n');

  return {
    sucesso: true,
    comando: 'emprestimo',
    tipo_resposta: 'emprestimo',
    tipo: isCommand ? 'comando' : 'pergunta',
    titulo: 'Simulação de Empréstimo Pessoal',
    texto,
    dados: {
      conta_id: conta ? conta.id : 1,
      conta: numContaFmt,
      titular,
      ...simulacao,
    },
  };
}

// ─── Tratadores de Perguntas em Linguagem Natural ────────────────────────────

/**
 * Consulta saldo de um cliente específico por nome.
 * Exemplo: "Qual o saldo da Ana Paula?"
 */
async function consultarSaldoClientePorNome(pool, nomeBuscado) {
  const nomeLimpo = nomeBuscado.replace(/[?!.,;]/g, '').trim();
  const res = await pool.query(`
    SELECT c.id AS cliente_id, c.nome, c.cpf,
           ct.id AS conta_id, ct.numero, ct.digito, ct.tipo, ct.saldo, ct.limite,
           (ct.saldo + ct.limite) AS saldo_disponivel,
           ag.codigo AS agencia_codigo, ag.nome AS agencia_nome
    FROM clientes c
    JOIN contas ct ON ct.cliente_id = c.id
    JOIN agencias ag ON ag.id = ct.agencia_id
    WHERE c.nome ILIKE $1 AND ct.status = 'ativa'
    ORDER BY ct.tipo ASC
  `, [`%${nomeLimpo}%`]);

  if (res.rows.length === 0) {
    // Tenta busca com a primeira palavra se tiver mais de uma
    const partes = nomeLimpo.split(/\s+/);
    if (partes.length > 1) {
      const resPrimeira = await pool.query(`
        SELECT c.id AS cliente_id, c.nome, c.cpf,
               ct.id AS conta_id, ct.numero, ct.digito, ct.tipo, ct.saldo, ct.limite,
               (ct.saldo + ct.limite) AS saldo_disponivel,
               ag.codigo AS agencia_codigo, ag.nome AS agencia_nome
        FROM clientes c
        JOIN contas ct ON ct.cliente_id = c.id
        JOIN agencias ag ON ag.id = ct.agencia_id
        WHERE c.nome ILIKE $1 AND ct.status = 'ativa'
        ORDER BY ct.tipo ASC
      `, [`%${partes[0]}%`]);
      if (resPrimeira.rows.length > 0) {
        return formatarRespostaSaldoCliente(resPrimeira.rows);
      }
    }

    return {
      sucesso: true,
      comando: null,
      tipo_resposta: 'saldo_cliente',
      tipo: 'pergunta',
      titulo: 'Cliente não localizado',
      texto: `Não foi encontrado nenhum cliente ativo com o nome "${nomeLimpo}" na base de dados.`,
      dados: { termo_busca: nomeLimpo, encontrado: false },
    };
  }

  return formatarRespostaSaldoCliente(res.rows);
}

function formatarRespostaSaldoCliente(rows) {
  const cliente = rows[0];
  const contas = rows.map(r => ({
    conta_id: r.conta_id,
    conta: `${r.numero}-${r.digito}`,
    tipo: r.tipo,
    saldo: parseFloat(r.saldo),
    saldo_formatado: formatarBRL(r.saldo),
    limite: parseFloat(r.limite),
    saldo_disponivel: parseFloat(r.saldo_disponivel),
    saldo_disponivel_formatado: formatarBRL(r.saldo_disponivel),
    agencia: `${r.agencia_codigo} - ${r.agencia_nome}`,
  }));

  const totalSaldo = contas.reduce((acc, c) => acc + c.saldo, 0);
  const totalDisponivel = contas.reduce((acc, c) => acc + c.saldo_disponivel, 0);

  let texto;
  if (contas.length === 1) {
    const c = contas[0];
    texto = `${cliente.nome} possui a conta ${c.tipo} ${c.conta} na agência ${c.agencia}, com saldo de ${c.saldo_formatado} e limite de ${formatarBRL(c.limite)}. O saldo total disponível é de ${c.saldo_disponivel_formatado}.`;
  } else {
    const detalheContas = contas.map(c =>
      `Conta ${c.tipo === 'corrente' ? 'Corrente' : 'Poupança'} ${c.conta} com saldo de ${c.saldo_formatado} (limite ${formatarBRL(c.limite)})`
    ).join(' e ');
    texto = `${cliente.nome} possui ${contas.length} contas ativas na ${contas[0].agencia}: ${detalheContas}. O saldo total disponível consolidado é de ${formatarBRL(totalDisponivel)}.`;
  }

  return {
    sucesso: true,
    comando: null,
    tipo_resposta: 'saldo_cliente',
    tipo: 'pergunta',
    titulo: `Saldo de ${cliente.nome}`,
    texto,
    dados: {
      cliente_id: cliente.cliente_id,
      nome: cliente.nome,
      total_saldo: totalSaldo,
      total_saldo_formatado: formatarBRL(totalSaldo),
      total_disponivel: totalDisponivel,
      total_disponivel_formatado: formatarBRL(totalDisponivel),
      contas,
    },
  };
}

/**
 * Consulta o total sob custódia no banco.
 * Exemplo: "Quanto temos sob custódia no banco?"
 */
async function consultarCustodiaTotal(pool) {
  const [custodiaRes, extrasRes] = await Promise.all([
    pool.query(`
      SELECT COALESCE(SUM(saldo), 0) AS total_custodia,
             COUNT(*) AS total_contas_ativas
      FROM contas
      WHERE status = 'ativa'
    `),
    pool.query(`
      SELECT COUNT(DISTINCT ag.estado) AS total_estados,
             COUNT(DISTINCT cl.id) AS total_clientes
      FROM contas ct
      JOIN agencias ag ON ag.id = ct.agencia_id
      JOIN clientes cl ON cl.id = ct.cliente_id
      WHERE ct.status = 'ativa'
    `),
  ]);

  const totalCustodia = parseFloat(custodiaRes.rows[0].total_custodia);
  const totalContas = parseInt(custodiaRes.rows[0].total_contas_ativas, 10);
  const totalEstados = parseInt(extrasRes.rows[0].total_estados, 10);
  const totalClientes = parseInt(extrasRes.rows[0].total_clientes, 10);

  const texto = `O Banco Fictício possui atualmente ${formatarBRL(totalCustodia)} sob custódia consolidada em suas contas ativas, distribuídos em ${totalContas} contas de clientes em ${totalEstados} estados.`;

  return {
    sucesso: true,
    comando: null,
    tipo_resposta: 'custodia_total',
    tipo: 'pergunta',
    titulo: 'Custódia Consolidada do Banco',
    texto,
    dados: {
      total_custodia: totalCustodia,
      total_custodia_formatado: formatarBRL(totalCustodia),
      total_contas_ativas: totalContas,
      total_clientes_ativos: totalClientes,
      total_estados: totalEstados,
    },
  };
}

/**
 * Consulta a última transferência ou movimentação registrada.
 * Exemplo: "Qual foi a última transferência?"
 */
async function consultarUltimaTransferencia(pool) {
  const res = await pool.query(`
    SELECT t.id, t.tipo, t.status, t.valor, t.descricao, t.realizada_em,
           orig.numero AS conta_origem, cl_orig.nome AS remetente,
           dest.numero AS conta_destino, cl_dest.nome AS destinatario
    FROM transacoes t
    LEFT JOIN contas orig ON orig.id = t.conta_origem_id
    LEFT JOIN clientes cl_orig ON cl_orig.id = orig.cliente_id
    LEFT JOIN contas dest ON dest.id = t.conta_destino_id
    LEFT JOIN clientes cl_dest ON cl_dest.id = dest.cliente_id
    WHERE t.tipo = 'transferencia' OR t.descricao ILIKE '%pix%'
    ORDER BY t.realizada_em DESC
    LIMIT 1
  `);

  if (res.rows.length === 0) {
    // Se não houver transferência com tipo explícito, busca última transação geral
    const resGeral = await pool.query(`
      SELECT t.id, t.tipo, t.status, t.valor, t.descricao, t.realizada_em,
             orig.numero AS conta_origem, cl_orig.nome AS remetente,
             dest.numero AS conta_destino, cl_dest.nome AS destinatario
      FROM transacoes t
      LEFT JOIN contas orig ON orig.id = t.conta_origem_id
      LEFT JOIN clientes cl_orig ON cl_orig.id = orig.cliente_id
      LEFT JOIN contas dest ON dest.id = t.conta_destino_id
      LEFT JOIN clientes cl_dest ON cl_dest.id = dest.cliente_id
      ORDER BY t.realizada_em DESC
      LIMIT 1
    `);

    if (resGeral.rows.length === 0) {
      return {
        sucesso: true,
        comando: null,
        tipo_resposta: 'ultima_transferencia',
        tipo: 'pergunta',
        titulo: 'Nenhuma movimentação registrada',
        texto: 'Não há registros de transferências ou movimentações na base de dados.',
        dados: null,
      };
    }
    return formatarRespostaUltimaTransferencia(resGeral.rows[0]);
  }

  return formatarRespostaUltimaTransferencia(res.rows[0]);
}

function formatarRespostaUltimaTransferencia(t) {
  const valor = parseFloat(t.valor);
  const dataFmt = formatarDataHora(t.realizada_em);
  const remetente = t.remetente ? `${t.remetente} (Conta ${t.conta_origem})` : `Conta ${t.conta_origem || 'externa'}`;
  const destinatario = t.destinatario ? `${t.destinatario} (Conta ${t.conta_destino})` : `Conta ${t.conta_destino || 'externa'}`;

  const texto = `A última transferência registrada foi no valor de ${formatarBRL(valor)} em ${dataFmt}. Remetente: ${remetente} para ${destinatario}, com a descrição: "${t.descricao}".`;

  return {
    sucesso: true,
    comando: null,
    tipo_resposta: 'ultima_transferencia',
    tipo: 'pergunta',
    titulo: 'Última Transferência Registrada',
    texto,
    dados: {
      id: parseInt(t.id, 10),
      tipo: t.tipo,
      valor,
      valor_formatado: formatarBRL(valor),
      data: t.realizada_em,
      data_formatada: dataFmt,
      remetente: t.remetente,
      conta_origem: t.conta_origem,
      destinatario: t.destinatario,
      conta_destino: t.conta_destino,
      descricao: t.descricao,
    },
  };
}

/**
 * Consulta a contagem de clientes cadastrados.
 * Exemplo: "Quantos clientes temos cadastrados?"
 */
async function consultarTotalClientes(pool) {
  const res = await pool.query(`
    SELECT COUNT(*) AS total_clientes,
           COUNT(*) FILTER (WHERE ativo = true) AS clientes_ativos
    FROM clientes
  `);

  const total = parseInt(res.rows[0].total_clientes, 10);
  const ativos = parseInt(res.rows[0].clientes_ativos, 10);

  return {
    sucesso: true,
    comando: null,
    tipo_resposta: 'total_clientes',
    tipo: 'pergunta',
    titulo: 'Total de Clientes',
    texto: `O Banco Fictício possui atualmente ${total} clientes cadastrados, sendo ${ativos} com cadastro ativo no sistema.`,
    dados: {
      total_clientes: total,
      clientes_ativos: ativos,
    },
  };
}

/**
 * Consulta o ranking das maiores agências do banco.
 * Exemplo: "Quais são as maiores agências?"
 */
async function consultarMaioresAgencias(pool) {
  const res = await pool.query(`
    SELECT ag.id, ag.codigo, ag.nome, ag.cidade, ag.estado,
           COUNT(ct.id) AS qtd_contas,
           COALESCE(SUM(ct.saldo), 0) AS saldo_total
    FROM agencias ag
    LEFT JOIN contas ct ON ct.agencia_id = ag.id AND ct.status = 'ativa'
    WHERE ag.ativa = true
    GROUP BY ag.id, ag.codigo, ag.nome, ag.cidade, ag.estado
    ORDER BY saldo_total DESC
    LIMIT 3
  `);

  const agencias = res.rows.map(a => ({
    id: a.id,
    codigo: a.codigo,
    nome: a.nome,
    cidade: a.cidade,
    estado: a.estado,
    qtd_contas: parseInt(a.qtd_contas, 10),
    saldo_total: parseFloat(a.saldo_total),
    saldo_total_formatado: formatarBRL(a.saldo_total),
  }));

  const detalhes = agencias.map((a, i) =>
    `${i + 1}º ${a.nome} (${a.codigo} - ${a.cidade}/${a.estado}) com ${a.saldo_total_formatado} em ${a.qtd_contas} contas`
  ).join('; ');

  return {
    sucesso: true,
    comando: null,
    tipo_resposta: 'ranking_agencias',
    tipo: 'pergunta',
    titulo: 'Maiores Agências por Volume',
    texto: `As principais agências em volume sob gestão são: ${detalhes}.`,
    dados: agencias,
  };
}

/**
 * Consulta o maior depósito registrado.
 * Exemplo: "Qual foi o maior depósito?"
 */
async function consultarMaiorDeposito(pool) {
  const res = await pool.query(`
    SELECT t.id, t.tipo, t.valor, t.descricao, t.realizada_em,
           dest.numero AS conta_destino, dest.digito AS destino_digito,
           cl_dest.nome AS destinatario
    FROM transacoes t
    JOIN contas dest ON dest.id = t.conta_destino_id
    JOIN clientes cl_dest ON cl_dest.id = dest.cliente_id
    WHERE t.tipo = 'deposito' AND t.status = 'concluida'
    ORDER BY t.valor DESC
    LIMIT 1
  `);

  if (res.rows.length === 0) {
    return {
      sucesso: true,
      comando: null,
      tipo_resposta: 'maior_deposito',
      tipo: 'pergunta',
      titulo: 'Depósitos',
      texto: 'Nenhum depósito concluído foi encontrado na base de dados.',
      dados: null,
    };
  }

  const row = res.rows[0];
  const valor = parseFloat(row.valor);
  const dataFmt = formatarDataHora(row.realizada_em);
  const contaFmt = `${row.conta_destino}-${row.destino_digito}`;

  return {
    sucesso: true,
    comando: null,
    tipo_resposta: 'maior_deposito',
    tipo: 'pergunta',
    titulo: 'Maior Depósito Registrado',
    texto: `O maior depósito registrado no sistema foi de ${formatarBRL(valor)} em ${dataFmt}, creditado na conta ${contaFmt} de ${row.destinatario}.`,
    dados: {
      id: parseInt(row.id, 10),
      valor,
      valor_formatado: formatarBRL(valor),
      data: row.realizada_em,
      data_formatada: dataFmt,
      conta_destino: contaFmt,
      titular: row.destinatario,
      descricao: row.descricao,
    },
  };
}

/**
 * Consulta a distribuição das contas por status (bloqueadas, inativas, ativas).
 * Exemplo: "Quantas contas estão bloqueadas ou inativas?"
 */
async function consultarStatusContas(pool) {
  const res = await pool.query(`
    SELECT status, COUNT(*) AS total
    FROM contas
    GROUP BY status
    ORDER BY total DESC
  `);

  const statusMap = {
    ativa: 'ativas',
    inativa: 'inativas',
    bloqueada: 'bloqueadas',
    encerrada: 'encerradas',
  };

  const partes = res.rows.map(r => `${r.total} ${statusMap[r.status] || r.status}`);
  const texto = `Distribuição atual das contas no banco: ${partes.join(', ')}.`;

  return {
    sucesso: true,
    comando: null,
    tipo_resposta: 'status_contas',
    tipo: 'pergunta',
    titulo: 'Status das Contas',
    texto,
    dados: res.rows.map(r => ({ status: r.status, total: parseInt(r.total, 10) })),
  };
}

// ─── Roteador de Consultas Semântico ──────────────────────────────────────────

/**
 * Roteia a mensagem do usuário (comando ou pergunta) e retorna o resultado formatado.
 */
async function processarConsultaAssistente(pool, { mensagem, conta_id, cliente_id, papel }) {
  const inicioHr = process.hrtime.bigint();
  const rawMsg = (mensagem || '').trim();
  const lowerMsg = rawMsg.toLowerCase();

  let resposta;

  // 1. Roteamento de Comandos Rápidos com barra (/)
  if (rawMsg.startsWith('/')) {
    const cmd = rawMsg.slice(1).trim().split(/\s+/)[0].toLowerCase();

    switch (cmd) {
      case 'saldo':
        resposta = await tratarComandoSaldo(pool, conta_id, cliente_id);
        break;
      case 'extrato':
        resposta = await tratarComandoExtrato(pool, conta_id, cliente_id);
        break;
      case 'pix':
        resposta = await tratarComandoPix(pool, conta_id);
        break;
      case 'contas':
        resposta = await tratarComandoContas(pool, cliente_id);
        break;
      case 'agencias':
      case 'agência':
      case 'agencia':
        resposta = await tratarComandoAgencias(pool);
        break;
      case 'emprestimo':
      case 'empréstimo':
      case 'emprestimos':
      case 'empréstimos':
      case 'credito':
      case 'crédito': {
        const partes = rawMsg.slice(1).trim().split(/\s+/);
        let valorArg = null;
        let mesesArg = null;
        if (partes.length > 1) {
          const vNum = parseFloat(partes[1].replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(vNum)) valorArg = vNum;
        }
        if (partes.length > 2) {
          const mNum = parseInt(partes[2].replace(/[^0-9]/g, ''), 10);
          if (!isNaN(mNum)) mesesArg = mNum;
        }
        resposta = await tratarComandoEmprestimo(pool, conta_id, cliente_id, valorArg, mesesArg, true);
        break;
      }
      case 'ajuda':
      case 'help':
        resposta = tratarComandoAjuda();
        break;
      default:
        resposta = {
          sucesso: false,
          comando: cmd,
          tipo_resposta: 'erro_comando',
          tipo: 'comando',
          titulo: 'Comando não reconhecido',
          texto: `Comando "/${cmd}" não reconhecido. Digite /ajuda para consultar os comandos disponíveis.`,
          dados: null,
        };
        break;
    }
  } else {
    // 2. Roteamento de Perguntas em Linguagem Natural

    // Caso Empréstimo / Crédito Pessoal
    if (/(?:empr[eé]stimo|cr[eé]dito\s+pessoal|simular\s+cr[eé]dito|financiar|financiamento|pegar\s+emprestado)/i.test(lowerMsg)) {
      const params = extrairParametrosEmprestimoNLP(rawMsg);
      resposta = await tratarComandoEmprestimo(pool, conta_id, cliente_id, params.valor, params.meses, false);
      resposta.tipo = 'pergunta';
    }
    // Caso A: Custódia total / patrimônio do banco
    else if (/(?:cust[óo]dia|patrim[ôo]nio|sob\s+gest[ãa]o|total.*guardado|volume.*banco|total.*no\s+banco)/i.test(lowerMsg)) {
      resposta = await consultarCustodiaTotal(pool);
    }
    // Caso B: Última transferência / movimentação / PIX
    else if (/(?:[úu]ltima|[úu]ltimo)\s+(?:transfer[êe]ncia|transferencia|movimenta[çc][ãa]o|opera[çc][ãa]o|transa[çc][ãa]o|pix|ted|doc)/i.test(lowerMsg)) {
      resposta = await consultarUltimaTransferencia(pool);
    }
    // Caso C: Total de clientes cadastrados
    else if (/quantos\s+clientes|total\s+de\s+clientes|n[úu]mero\s+de\s+clientes|base\s+de\s+clientes/i.test(lowerMsg)) {
      resposta = await consultarTotalClientes(pool);
    }
    // Caso D: Maiores agências / ranking
    else if (/maiores\s+ag[êe]ncias|ranking.*ag[êe]ncias|principais\s+ag[êe]ncias|ag[êe]ncias\s+com\s+mais/i.test(lowerMsg)) {
      resposta = await consultarMaioresAgencias(pool);
    }
    // Caso E: Maior depósito realizado
    else if (/maior\s+(?:dep[óo]sito|deposito|aporte)/i.test(lowerMsg)) {
      resposta = await consultarMaiorDeposito(pool);
    }
    // Caso F: Status das contas (bloqueadas, inativas)
    else if (/contas?\s+(?:bloqueadas?|inativas?|encerradas?)|status\s+das\s+contas/i.test(lowerMsg)) {
      resposta = await consultarStatusContas(pool);
    }
    // Caso G: Meu saldo (linguagem natural do usuário logado)
    else if (/meu\s+saldo|saldo\s+da\s+minha\s+conta|quanto\s+(?:eu\s+)?tenho|ver\s+meu\s+saldo/i.test(lowerMsg)) {
      resposta = await tratarComandoSaldo(pool, conta_id, cliente_id);
      resposta.tipo = 'pergunta';
    }
    // Caso H: Meu extrato (linguagem natural do usuário logado)
    else if (/meu\s+extrato|extrato\s+da\s+minha\s+conta|minhas\s+movimenta[çc][õo]es|minhas\s+transa[çc][õo]es/i.test(lowerMsg)) {
      resposta = await tratarComandoExtrato(pool, conta_id, cliente_id);
      resposta.tipo = 'pergunta';
    }
    // Caso I: Como fazer PIX / transferir
    else if (/fazer\s+(?:um\s+)?pix|enviar\s+pix|transferir\s+pix/i.test(lowerMsg)) {
      resposta = await tratarComandoPix(pool, conta_id);
      resposta.tipo = 'pergunta';
    }
    // Caso J: Onde tem agências / agências bancárias
    else if (/(?:onde\s+(?:est[ãa]o|ficam|tem)|quais\s+s[ãa]o)\s+as\s+ag[êe]ncias|lista\s+de\s+ag[êe]ncias/i.test(lowerMsg)) {
      resposta = await tratarComandoAgencias(pool);
      resposta.tipo = 'pergunta';
    }
    // Caso K: Saldo de um cliente específico por nome (ex: "Qual o saldo da Ana Paula?")
    else if (/(?:saldo|quanto\s+tem|dinheiro|dispon[íi]vel).*(?:d[aeo]|para|cliente)?\s+([\p{L}\s]+)/iu.test(lowerMsg)) {
      const match = lowerMsg.match(/(?:saldo|quanto\s+tem|dinheiro|dispon[íi]vel).*(?:d[aeo]|para|cliente)?\s+([\p{L}\s]+)/iu);
      const nomeEncontrado = match ? match[1].replace(/[?!.,;]/g, '').trim() : '';

      // Se o termo for "meu" ou "minha conta", trata como a conta do usuário
      if (!nomeEncontrado || /^(?:meu|minha|mim)$/i.test(nomeEncontrado)) {
        resposta = await tratarComandoSaldo(pool, conta_id, cliente_id);
        resposta.tipo = 'pergunta';
      } else {
        resposta = await consultarSaldoClientePorNome(pool, nomeEncontrado);
      }
    }
    // Caso L: Saudações cordiais
    else if (/^(?:ol[áa]|oi|bom\s+dia|boa\s+tarde|boa\s+noite|menu|in[íi]cio)$/i.test(lowerMsg)) {
      resposta = {
        sucesso: true,
        comando: null,
        tipo_resposta: 'saudacao',
        tipo: 'pergunta',
        titulo: 'Assistente Banco Fictício',
        texto: 'Olá. Sou o assistente financeiro do Banco Fictício. Você pode consultar saldos, extratos, contas e informações do banco digitando comandos como /saldo ou /ajuda, ou fazendo perguntas diretas.',
        dados: null,
      };
    }
    // Caso M: Pedido genérico de ajuda / instruções
    else if (/ajuda|help|o\s+que\s+voc[êe]\s+faz|comandos/i.test(lowerMsg)) {
      resposta = tratarComandoAjuda();
      resposta.tipo = 'pergunta';
    }
    // Fallback: orienta o usuário de forma profissional e objetiva
    else {
      resposta = {
        sucesso: true,
        comando: null,
        tipo_resposta: 'ajuda',
        tipo: 'pergunta',
        titulo: 'Consulta não compreendida',
        texto: 'Não identifiquei uma consulta específica para essa mensagem. Você pode utilizar comandos rápidos como /saldo, /extrato, /pix, /contas ou /agencias, ou digitar /ajuda para ver as perguntas suportadas.',
        dados: null,
      };
    }
  }

  // Medição precisa do tempo de processamento
  const fimHr = process.hrtime.bigint();
  const tempoMs = Number((Number(fimHr - inicioHr) / 1e6).toFixed(2));

  resposta.tempo_ms = tempoMs;
  resposta.tempo_execucao_ms = tempoMs;

  return resposta;
}

module.exports = {
  formatarBRL,
  formatarDataHora,
  resolverConta,
  calcularEmprestimo,
  extrairParametrosEmprestimoNLP,
  tratarComandoEmprestimo,
  processarConsultaAssistente,
};
