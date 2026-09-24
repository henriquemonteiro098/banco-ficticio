// =============================================================================
// server.js — Banco Fictício API & Web Server
// Conectado diretamente ao PostgreSQL na database banco_ficticio
// =============================================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();
const { processarConsultaAssistente, calcularEmprestimo, formatarBRL } = require('./assistant');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Pool PostgreSQL
const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'banco_ficticio',
  user: process.env.PGUSER || process.env.USER || 'henriquemonteiro',
  password: process.env.PGPASSWORD || undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Healthcheck & Teste de Conexão ───────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS agora, version();');
    res.json({
      status: 'online',
      banco: 'banco_ficticio',
      servidor: result.rows[0].version,
      timestamp: result.rows[0].agora,
    });
  } catch (err) {
    res.status(500).json({ status: 'erro', mensagem: err.message });
  }
});

// ─── Autenticação ─────────────────────────────────────────────────────────────

// Login (suporta admin:admin e clientes)
app.post('/api/auth/login', async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) {
    return res.status(400).json({ erro: 'Login e senha são obrigatórios' });
  }

  try {
    const userQuery = await pool.query(
      `SELECT u.id, u.login, u.nome, u.papel, u.cliente_id, u.ativo,
              c.email, c.cpf, c.cidade, c.estado
       FROM usuarios u
       LEFT JOIN clientes c ON c.id = u.cliente_id
       WHERE u.login = $1 AND u.senha = $2 AND u.ativo = true`,
      [login.trim().toLowerCase(), senha.trim()]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas. (Para teste de admin: admin / admin)' });
    }

    const usuario = userQuery.rows[0];

    // Se for cliente, busca suas contas
    let contas = [];
    if (usuario.cliente_id) {
      const contasQuery = await pool.query(
        `SELECT ct.id, ct.numero, ct.digito, ct.tipo, ct.status, ct.saldo, ct.limite,
                ag.codigo AS agencia_codigo, ag.nome AS agencia_nome
         FROM contas ct
         JOIN agencias ag ON ag.id = ct.agencia_id
         WHERE ct.cliente_id = $1
         ORDER BY ct.status = 'ativa' DESC, ct.tipo ASC`,
        [usuario.cliente_id]
      );
      contas = contasQuery.rows;
    }

    res.json({
      sucesso: true,
      usuario: {
        id: usuario.id,
        login: usuario.login,
        nome: usuario.nome,
        papel: usuario.papel,
        cliente_id: usuario.cliente_id,
        email: usuario.email,
        cpf: usuario.cpf,
        cidade: usuario.cidade,
        estado: usuario.estado,
        contas,
      },
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao autenticar', detalhe: err.message });
  }
});

// Lista de usuários para atalhos de teste na interface
app.get('/api/auth/usuarios-demo', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.login, u.nome, u.papel, u.cliente_id, c.cpf
       FROM usuarios u
       LEFT JOIN clientes c ON c.id = u.cliente_id
       WHERE u.ativo = true
       ORDER BY u.papel ASC, u.id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── 🏛️ O Banco (Painel Gerencial / Tesouraria) ───────────────────────────────

app.get('/api/banco/dashboard', async (req, res) => {
  try {
    const [kpis, distribuicao, ultimasTx, rankingAgencias] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE((SELECT SUM(saldo) FROM contas WHERE status = 'ativa'), 0) AS total_custodia,
          (SELECT COUNT(*) FROM clientes WHERE ativo = true) AS total_clientes,
          (SELECT COUNT(*) FROM contas WHERE status = 'ativa') AS total_contas_ativas,
          (SELECT COUNT(*) FROM agencias WHERE ativa = true) AS total_agencias_ativas,
          (SELECT COUNT(*) FROM transacoes WHERE status = 'concluida') AS total_transacoes,
          COALESCE((SELECT SUM(valor) FROM transacoes WHERE status = 'concluida'), 0) AS volume_total
      `),
      pool.query(`
        SELECT tipo, COUNT(*) AS quantidade, SUM(valor) AS volume
        FROM transacoes
        WHERE status = 'concluida'
        GROUP BY tipo
        ORDER BY volume DESC
      `),
      pool.query(`
        SELECT t.id, t.tipo, t.status, t.valor, t.descricao, t.realizada_em,
               orig.numero AS conta_origem, cl_orig.nome AS remetente,
               dest.numero AS conta_destino, cl_dest.nome AS destinatario
        FROM transacoes t
        LEFT JOIN contas orig ON orig.id = t.conta_origem_id
        LEFT JOIN clientes cl_orig ON cl_orig.id = orig.cliente_id
        LEFT JOIN contas dest ON dest.id = t.conta_destino_id
        LEFT JOIN clientes cl_dest ON cl_dest.id = dest.cliente_id
        ORDER BY t.realizada_em DESC
        LIMIT 12
      `),
      pool.query(`
        SELECT ag.id, ag.codigo, ag.nome, ag.cidade, ag.estado,
               COUNT(ct.id) AS qtd_contas,
               COALESCE(SUM(ct.saldo), 0) AS saldo_total
        FROM agencias ag
        LEFT JOIN contas ct ON ct.agencia_id = ag.id AND ct.status = 'ativa'
        WHERE ag.ativa = true
        GROUP BY ag.id, ag.codigo, ag.nome, ag.cidade, ag.estado
        ORDER BY saldo_total DESC
      `),
    ]);

    res.json({
      kpis: kpis.rows[0],
      distribuicao: distribuicao.rows,
      ultimasTransacoes: ultimasTx.rows,
      rankingAgencias: rankingAgencias.rows,
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar dados do banco', detalhe: err.message });
  }
});

// Listagem de todas as contas para gestão
app.get('/api/banco/contas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ct.id, ct.numero, ct.digito, ct.tipo, ct.status, ct.saldo, ct.limite,
             cl.id AS cliente_id, cl.nome AS cliente_nome, cl.cpf,
             ag.codigo AS agencia_codigo, ag.nome AS agencia_nome
      FROM contas ct
      JOIN clientes cl ON cl.id = ct.cliente_id
      JOIN agencias ag ON ag.id = ct.agencia_id
      ORDER BY ct.saldo DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Listagem de todas as agências
app.get('/api/banco/agencias', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ag.*, COUNT(ct.id) AS total_contas, COALESCE(SUM(ct.saldo), 0) AS saldo_total
      FROM agencias ag
      LEFT JOIN contas ct ON ct.agencia_id = ag.id AND ct.status = 'ativa'
      GROUP BY ag.id
      ORDER BY ag.codigo ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Listagem de todas as transações com busca e filtros
app.get('/api/banco/transacoes', async (req, res) => {
  const { tipo, status, limite = 50 } = req.query;
  try {
    let query = `
      SELECT t.id, t.tipo, t.status, t.valor, t.descricao, t.realizada_em,
             orig.numero AS conta_origem, cl_orig.nome AS remetente,
             dest.numero AS conta_destino, cl_dest.nome AS destinatario
      FROM transacoes t
      LEFT JOIN contas orig ON orig.id = t.conta_origem_id
      LEFT JOIN clientes cl_orig ON cl_orig.id = orig.cliente_id
      LEFT JOIN contas dest ON dest.id = t.conta_destino_id
      LEFT JOIN clientes cl_dest ON cl_dest.id = dest.cliente_id
      WHERE 1=1
    `;
    const params = [];

    if (tipo && tipo !== 'todos') {
      params.push(tipo);
      query += ` AND t.tipo = $${params.length}`;
    }
    if (status && status !== 'todos') {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    query += ` ORDER BY t.realizada_em DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limite, 10));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Operação bancária administrativa (Depósito ou Tarifa)
app.post('/api/banco/operacao', async (req, res) => {
  const { conta_id, tipo, valor, descricao } = req.body;
  const numValor = parseFloat(valor);

  if (!conta_id || isNaN(numValor) || numValor <= 0) {
    return res.status(400).json({ erro: 'Conta e valor válido maior que zero são obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Valida conta
    const contaRes = await client.query('SELECT id, numero, saldo, status FROM contas WHERE id = $1 FOR UPDATE', [conta_id]);
    if (contaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Conta não encontrada' });
    }

    const conta = contaRes.rows[0];
    if (conta.status !== 'ativa') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: `A conta ${conta.numero} está com status "${conta.status}"` });
    }

    let novoSaldo = parseFloat(conta.saldo);
    let origemId = null;
    let destinoId = null;

    if (tipo === 'deposito') {
      novoSaldo += numValor;
      destinoId = conta.id;
    } else if (tipo === 'tarifa' || tipo === 'saque') {
      novoSaldo -= numValor;
      origemId = conta.id;
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Tipo de operação não suportado' });
    }

    // Atualiza saldo da conta
    await client.query('UPDATE contas SET saldo = $1 WHERE id = $2', [novoSaldo, conta.id]);

    // Registra a transação
    const txRes = await client.query(
      `INSERT INTO transacoes (tipo, status, valor, descricao, conta_origem_id, conta_destino_id, realizada_em)
       VALUES ($1, 'concluida', $2, $3, $4, $5, NOW()) RETURNING id, realizada_em`,
      [tipo, numValor, descricao || `Operação administrativa: ${tipo}`, origemId, destinoId]
    );

    await client.query('COMMIT');
    res.json({
      sucesso: true,
      transacao_id: txRes.rows[0].id,
      novo_saldo: novoSaldo,
      mensagem: `${tipo === 'deposito' ? 'Depósito' : 'Operação'} de R$ ${numValor.toFixed(2)} efetuado com sucesso!`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Falha na operação', detalhe: err.message });
  } finally {
    client.release();
  }
});

// ─── 👤 Área do Cliente (Internet Banking) ───────────────────────────────────

// Obter dados completos do cliente e suas contas
app.get('/api/cliente/:clienteId/resumo', async (req, res) => {
  const { clienteId } = req.params;
  try {
    const [clienteRes, contasRes] = await Promise.all([
      pool.query('SELECT * FROM clientes WHERE id = $1', [clienteId]),
      pool.query(`
        SELECT ct.id, ct.numero, ct.digito, ct.tipo, ct.status, ct.saldo, ct.limite,
               ag.codigo AS agencia_codigo, ag.nome AS agencia_nome
        FROM contas ct
        JOIN agencias ag ON ag.id = ct.agencia_id
        WHERE ct.cliente_id = $1
        ORDER BY ct.status = 'ativa' DESC, ct.tipo ASC
      `, [clienteId]),
    ]);

    if (clienteRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    res.json({
      cliente: clienteRes.rows[0],
      contas: contasRes.rows,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Extrato bancário de uma conta específica
app.get('/api/cliente/conta/:contaId/extrato', async (req, res) => {
  const { contaId } = req.params;
  try {
    const contaRes = await pool.query(`
      SELECT ct.*, ag.codigo AS agencia_codigo, ag.nome AS agencia_nome, cl.nome AS cliente_nome
      FROM contas ct
      JOIN agencias ag ON ag.id = ct.agencia_id
      JOIN clientes cl ON cl.id = ct.cliente_id
      WHERE ct.id = $1
    `, [contaId]);

    if (contaRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Conta não encontrada' });
    }

    const txRes = await pool.query(`
      SELECT t.id, t.tipo, t.status, t.valor, t.descricao, t.realizada_em,
             CASE
               WHEN t.conta_destino_id = $1 THEN 'entrada'
               WHEN t.conta_origem_id = $1  THEN 'saida'
               ELSE 'neutro'
             END AS direcao,
             orig.numero AS conta_origem, cl_orig.nome AS remetente,
             dest.numero AS conta_destino, cl_dest.nome AS destinatario
      FROM transacoes t
      LEFT JOIN contas orig ON orig.id = t.conta_origem_id
      LEFT JOIN clientes cl_orig ON cl_orig.id = orig.cliente_id
      LEFT JOIN contas dest ON dest.id = t.conta_destino_id
      LEFT JOIN clientes cl_dest ON cl_dest.id = dest.cliente_id
      WHERE t.conta_origem_id = $1 OR t.conta_destino_id = $1
      ORDER BY t.realizada_em DESC
      LIMIT 100
    `, [contaId]);

    res.json({
      conta: contaRes.rows[0],
      extrato: txRes.rows,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Realizar Transferência / PIX (Atômica com BEGIN ... COMMIT)
app.post('/api/cliente/transferir', async (req, res) => {
  const { conta_origem_id, conta_destino_numero, valor, descricao, chave_pix } = req.body;
  const numValor = parseFloat(valor);

  if (!conta_origem_id || !conta_destino_numero || isNaN(numValor) || numValor <= 0) {
    return res.status(400).json({ erro: 'Conta de origem, número da conta de destino e valor positivo são obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Bloqueia conta de origem para leitura e atualização
    const origemRes = await client.query(
      'SELECT id, numero, saldo, limite, status, tipo FROM contas WHERE id = $1 FOR UPDATE',
      [conta_origem_id]
    );

    if (origemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Conta de origem não encontrada' });
    }

    const contaOrigem = origemRes.rows[0];
    if (contaOrigem.status !== 'ativa') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: `Sua conta de origem está ${contaOrigem.status}` });
    }

    const saldoDisponivel = parseFloat(contaOrigem.saldo) + parseFloat(contaOrigem.limite || 0);
    if (saldoDisponivel < numValor) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        erro: `Saldo insuficiente. Disponível (com limite): R$ ${saldoDisponivel.toFixed(2)}, Valor solicitado: R$ ${numValor.toFixed(2)}`,
      });
    }

    // 2. Busca e bloqueia conta de destino (remove qualquer pontuação)
    const numeroDestinoLimpo = conta_destino_numero.toString().replace(/[^0-9]/g, '');
    const destinoRes = await client.query(
      'SELECT id, numero, saldo, status FROM contas WHERE numero = $1 FOR UPDATE',
      [numeroDestinoLimpo]
    );

    if (destinoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: `Conta de destino número "${conta_destino_numero}" não encontrada` });
    }

    const contaDestino = destinoRes.rows[0];
    if (contaDestino.id === contaOrigem.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'A conta de destino não pode ser a mesma de origem' });
    }

    if (contaDestino.status !== 'ativa') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: `A conta de destino está ${contaDestino.status}` });
    }

    // 3. Atualiza saldos
    const novoSaldoOrigem = parseFloat(contaOrigem.saldo) - numValor;
    const novoSaldoDestino = parseFloat(contaDestino.saldo) + numValor;

    await client.query('UPDATE contas SET saldo = $1 WHERE id = $2', [novoSaldoOrigem, contaOrigem.id]);
    await client.query('UPDATE contas SET saldo = $1 WHERE id = $2', [novoSaldoDestino, contaDestino.id]);

    // 4. Registra a transação
    const descTx = descricao || (chave_pix ? `PIX chave ${chave_pix}` : `Transferência para conta ${contaDestino.numero}`);
    const txRes = await client.query(
      `INSERT INTO transacoes (tipo, status, valor, descricao, conta_origem_id, conta_destino_id, referencia_externa, realizada_em)
       VALUES ('transferencia', 'concluida', $1, $2, $3, $4, $5, NOW())
       RETURNING id, realizada_em`,
      [numValor, descTx, contaOrigem.id, contaDestino.id, chave_pix || null]
    );

    await client.query('COMMIT');

    res.json({
      sucesso: true,
      mensagem: `Transferência de R$ ${numValor.toFixed(2)} realizada com sucesso!`,
      transacao_id: txRes.rows[0].id,
      data: txRes.rows[0].realizada_em,
      novo_saldo: novoSaldoOrigem,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao processar transferência', detalhe: err.message });
  } finally {
    client.release();
  }
});

// Realizar Pagamento (Boleto, Contas de consumo, etc.)
app.post('/api/cliente/pagamento', async (req, res) => {
  const { conta_origem_id, valor, descricao, codigo_barras } = req.body;
  const numValor = parseFloat(valor);

  if (!conta_origem_id || isNaN(numValor) || numValor <= 0) {
    return res.status(400).json({ erro: 'Conta e valor válido são obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const origemRes = await client.query(
      'SELECT id, numero, saldo, limite, status FROM contas WHERE id = $1 FOR UPDATE',
      [conta_origem_id]
    );

    if (origemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Conta de origem não encontrada' });
    }

    const contaOrigem = origemRes.rows[0];
    const saldoDisponivel = parseFloat(contaOrigem.saldo) + parseFloat(contaOrigem.limite || 0);

    if (saldoDisponivel < numValor) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Saldo insuficiente para efetuar o pagamento' });
    }

    const novoSaldo = parseFloat(contaOrigem.saldo) - numValor;
    await client.query('UPDATE contas SET saldo = $1 WHERE id = $2', [novoSaldo, contaOrigem.id]);

    const txRes = await client.query(
      `INSERT INTO transacoes (tipo, status, valor, descricao, conta_origem_id, conta_destino_id, referencia_externa, realizada_em)
       VALUES ('pagamento', 'concluida', $1, $2, $3, NULL, $4, NOW())
       RETURNING id, realizada_em`,
      [numValor, descricao || 'Pagamento de título / boleto', contaOrigem.id, codigo_barras || null]
    );

    await client.query('COMMIT');

    res.json({
      sucesso: true,
      mensagem: `Pagamento de R$ ${numValor.toFixed(2)} liquidado com sucesso!`,
      transacao_id: txRes.rows[0].id,
      novo_saldo: novoSaldo,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao liquidar pagamento', detalhe: err.message });
  } finally {
    client.release();
  }
});

// ─── 💳 Módulo de Empréstimos & Simulação de Crédito (R1) ────────────────────

// Simulação de Empréstimo Pessoal (Price: 1,89% a.m., CET: 25,19% a.a.)
const tratarSimulacaoEmprestimo = (req, res) => {
  const rawValor = req.body?.valor !== undefined ? req.body.valor : req.query?.valor;
  const rawMeses = req.body?.meses !== undefined ? req.body.meses : req.query?.meses;

  if (rawValor === undefined || rawValor === null || isNaN(parseFloat(rawValor))) {
    return res.status(400).json({
      sucesso: false,
      erro: 'O valor solicitado é obrigatório e deve ser numérico.',
    });
  }

  if (rawMeses === undefined || rawMeses === null || isNaN(parseInt(rawMeses, 10))) {
    return res.status(400).json({
      sucesso: false,
      erro: 'O prazo em meses é obrigatório e deve ser um número inteiro.',
    });
  }

  const v = parseFloat(rawValor);
  const n = parseInt(rawMeses, 10);

  if (v < 500 || v > 50000) {
    return res.status(400).json({
      sucesso: false,
      erro: 'O valor do empréstimo deve estar entre R$ 500,00 e R$ 50.000,00.',
    });
  }

  if (n < 6 || n > 48) {
    return res.status(400).json({
      sucesso: false,
      erro: 'O prazo do empréstimo deve estar entre 6 e 48 meses.',
    });
  }

  const simulacao = calcularEmprestimo(v, n);

  res.json({
    sucesso: true,
    simulacao,
    dados: simulacao,
  });
};

app.post('/api/cliente/emprestimo/simular', tratarSimulacaoEmprestimo);
app.get('/api/cliente/emprestimo/simular', tratarSimulacaoEmprestimo);

// Contratação de Empréstimo em 1 Clique (Transação Atômica com BEGIN ... COMMIT)
app.post('/api/cliente/emprestimo/contratar', async (req, res) => {
  const { conta_id, valor, meses } = req.body || {};

  const numContaId = parseInt(conta_id, 10);
  const numValor = parseFloat(valor);
  const numMeses = parseInt(meses, 10);

  if (isNaN(numContaId) || numContaId <= 0) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Conta de destino válida é obrigatória para a contratação.',
    });
  }

  if (isNaN(numValor) || numValor < 500 || numValor > 50000) {
    return res.status(400).json({
      sucesso: false,
      erro: 'O valor do empréstimo deve estar entre R$ 500,00 e R$ 50.000,00.',
    });
  }

  if (isNaN(numMeses) || numMeses < 6 || numMeses > 48) {
    return res.status(400).json({
      sucesso: false,
      erro: 'O prazo do empréstimo deve estar entre 6 e 48 meses.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bloqueia a conta para concorrência e consistência estrita
    const contaRes = await client.query(
      'SELECT id, numero, digito, saldo, status FROM contas WHERE id = $1 FOR UPDATE',
      [numContaId]
    );

    if (contaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        sucesso: false,
        erro: 'Conta não encontrada.',
      });
    }

    const conta = contaRes.rows[0];
    if (conta.status !== 'ativa') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        sucesso: false,
        erro: `A conta ${conta.numero}-${conta.digito} está com status "${conta.status}". Apenas contas ativas podem contratar crédito.`,
      });
    }

    const simulacao = calcularEmprestimo(numValor, numMeses);
    const novoSaldo = Math.round((parseFloat(conta.saldo) + numValor) * 100) / 100;

    // Atualiza saldo na conta
    await client.query('UPDATE contas SET saldo = $1 WHERE id = $2', [novoSaldo, conta.id]);

    // Descrição e código de autenticação / protocolo
    const desc = `Empréstimo Pessoal Contratado - ${numMeses} parcelas de ${formatarBRL(simulacao.valor_parcela)}`;
    const refExterna = 'EMP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    // Insere transação de crédito como tipo 'deposito'
    const txRes = await client.query(
      `INSERT INTO transacoes (
        tipo, status, valor, descricao, conta_origem_id, conta_destino_id, referencia_externa, realizada_em
      ) VALUES (
        'deposito', 'concluida', $1, $2, NULL, $3, $4, NOW()
      ) RETURNING id, realizada_em`,
      [numValor, desc, conta.id, refExterna]
    );

    await client.query('COMMIT');

    const transacaoId = txRes.rows[0].id;
    const dataContratacao = txRes.rows[0].realizada_em;

    res.json({
      sucesso: true,
      mensagem: `Empréstimo de ${formatarBRL(numValor)} contratado com sucesso!`,
      transacao_id: transacaoId,
      conta_id: conta.id,
      conta_numero: `${conta.numero}-${conta.digito}`,
      valor_creditado: numValor,
      novo_saldo: novoSaldo,
      referencia_externa: refExterna,
      data_contratacao: dataContratacao,
      detalhes: {
        valor: numValor,
        parcelas: numMeses,
        valor_parcela: simulacao.valor_parcela,
        total_a_pagar: simulacao.total_a_pagar,
      },
      contrato: {
        valor_solicitado: numValor,
        meses: numMeses,
        taxa_mensal: 0.0189,
        taxa_mensal_percentual: '1,89% a.m.',
        taxa_anual_cet: 25.19,
        cet_anual_percentual: '25,19% a.a.',
        valor_parcela: simulacao.valor_parcela,
        total_a_pagar: simulacao.total_a_pagar,
        total_juros: simulacao.total_juros,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({
      sucesso: false,
      erro: 'Falha ao processar a contratação do empréstimo.',
      detalhe: err.message,
    });
  } finally {
    client.release();
  }
});

// ─── 🤖 Assistente Bancário & Command Palette ────────────────────────────────
app.post('/api/assistente/consulta', async (req, res) => {
  const { mensagem, conta_id, cliente_id, papel } = req.body || {};

  if (!mensagem || typeof mensagem !== 'string' || !mensagem.trim()) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Mensagem não informada.',
      detalhe: 'O campo mensagem é obrigatório no corpo da requisição.',
    });
  }

  try {
    const parsedContaId = conta_id && !isNaN(parseInt(conta_id, 10)) ? parseInt(conta_id, 10) : undefined;
    const parsedClienteId = cliente_id && !isNaN(parseInt(cliente_id, 10)) ? parseInt(cliente_id, 10) : undefined;

    const resposta = await processarConsultaAssistente(pool, {
      mensagem: mensagem.trim(),
      conta_id: parsedContaId,
      cliente_id: parsedClienteId,
      papel,
    });
    res.json(resposta);
  } catch (err) {
    res.status(500).json({
      sucesso: false,
      mensagem: 'Não foi possível processar a consulta bancária no momento.',
      detalhe: err.message,
    });
  }
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🏦 Servidor Banco Fictício rodando com sucesso!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🐘 Conectado ao PostgreSQL: banco_ficticio`);
    console.log(`🔑 Login Admin: admin / admin`);
    console.log(`======================================================\n`);
  });
}

module.exports = { app, pool };

