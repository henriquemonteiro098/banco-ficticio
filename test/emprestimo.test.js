/**
 * test/emprestimo.test.js — Suíte de Testes Automatizados para o Módulo de Empréstimos (R1)
 * Cobre:
 * 1. Precisão dos cálculos matemáticos pela fórmula Price (1,89% a.m., CET 25,19% a.a.)
 * 2. Validação de limites e payloads na rota POST/GET /api/cliente/emprestimo/simular
 * 3. Transação atômica no PostgreSQL na rota POST /api/cliente/emprestimo/contratar
 * 4. Integração com Command Bar (/emprestimo) e NLP do Assistente Bancário
 * 5. Quality Gate e Humanizer das respostas geradas
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, getBaseUrl, closeTestServer, postConsulta } = require('./helper');
const { calcularEmprestimo, extrairParametrosEmprestimoNLP } = require('../assistant');

test.after(async () => {
  await pool.end();
  await closeTestServer();
});

// ─── 1. Validações Matemáticas da Tabela Price ────────────────────────────────

test('R1: Motor de Cálculo Financeiro — Tabela Price (1,89% a.m.)', async (t) => {
  await t.test('Cálculo padrão: R$ 5.000,00 em 12 meses', () => {
    const c = calcularEmprestimo(5000, 12);
    assert.strictEqual(c.valor_solicitado, 5000);
    assert.strictEqual(c.meses, 12);
    assert.strictEqual(c.valor_parcela, 469.61);
    assert.strictEqual(c.parcela_mensal, 469.61);
    assert.strictEqual(c.total_a_pagar, 5635.32);
    assert.strictEqual(c.total_juros, 635.32);
    assert.strictEqual(c.taxa_anual_cet, 25.19);
    assert.strictEqual(c.cet_anual_percentual, '25,19% a.a.');
    assert.match(c.valor_parcela_formatado, /R\$\s*469,61/);
    assert.match(c.total_a_pagar_formatado, /R\$\s*5\.635,32/);
  });

  await t.test('Limite inferior: R$ 500,00 em 6 meses', () => {
    const c = calcularEmprestimo(500, 6);
    assert.strictEqual(c.valor_solicitado, 500);
    assert.strictEqual(c.meses, 6);
    assert.strictEqual(c.valor_parcela, 88.93);
    assert.strictEqual(c.total_a_pagar, 533.58);
    assert.strictEqual(c.total_juros, 33.58);
  });

  await t.test('Valor intermediário: R$ 10.000,00 em 24 meses', () => {
    const c = calcularEmprestimo(10000, 24);
    assert.strictEqual(c.valor_solicitado, 10000);
    assert.strictEqual(c.meses, 24);
    assert.strictEqual(c.valor_parcela, 522.15);
    assert.strictEqual(c.total_a_pagar, 12531.6);
    assert.strictEqual(c.total_juros, 2531.6);
  });

  await t.test('Valor intermediário: R$ 20.000,00 em 36 meses', () => {
    const c = calcularEmprestimo(20000, 36);
    assert.strictEqual(c.valor_solicitado, 20000);
    assert.strictEqual(c.meses, 36);
    assert.strictEqual(c.valor_parcela, 770.86);
    assert.strictEqual(c.total_a_pagar, 27750.96);
    assert.strictEqual(c.total_juros, 7750.96);
  });

  await t.test('Limite superior: R$ 50.000,00 em 48 meses', () => {
    const c = calcularEmprestimo(50000, 48);
    assert.strictEqual(c.valor_solicitado, 50000);
    assert.strictEqual(c.meses, 48);
    assert.strictEqual(c.valor_parcela, 1593.82);
    assert.strictEqual(c.total_a_pagar, 76503.36);
    assert.strictEqual(c.total_juros, 26503.36);
  });

  await t.test('Parser NLP extrai parcelas e valores monetários', () => {
    const p1 = extrairParametrosEmprestimoNLP('Quanto fica um empréstimo de 5000 em 12x?');
    assert.strictEqual(p1.valor, 5000);
    assert.strictEqual(p1.meses, 12);

    const p2 = extrairParametrosEmprestimoNLP('Simular empréstimo de 10.000 em 24 meses');
    assert.strictEqual(p2.valor, 10000);
    assert.strictEqual(p2.meses, 24);

    const p3 = extrairParametrosEmprestimoNLP('Quero fazer um empréstimo');
    assert.strictEqual(p3.valor, null);
    assert.strictEqual(p3.meses, null);
  });
});

// ─── 2. Endpoint de Simulação (POST e GET /api/cliente/emprestimo/simular) ───

test('R1: Endpoint de Simulação — POST & GET /api/cliente/emprestimo/simular', async (t) => {
  const baseUrl = await getBaseUrl();

  await t.test('POST /api/cliente/emprestimo/simular retorna cálculo com campos contratuais', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/simular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: 5000, meses: 12 }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.sucesso, true);

    const sim = data.simulacao;
    assert.ok(sim, 'Deve conter nó simulacao');
    assert.strictEqual(sim.valor_solicitado, 5000);
    assert.strictEqual(sim.meses, 12);
    assert.strictEqual(sim.valor_parcela, 469.61);
    assert.strictEqual(sim.total_a_pagar, 5635.32);
    assert.strictEqual(sim.cet_anual_percentual, '25,19% a.a.');

    // Compatibilidade com contrato PROJECT.md (dados)
    assert.ok(data.dados, 'Deve conter nó dados para compatibilidade');
    assert.strictEqual(data.dados.parcela_mensal, 469.61);
  });

  await t.test('GET /api/cliente/emprestimo/simular suporta parâmetros via query string', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/simular?valor=10000&meses=24`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.sucesso, true);
    assert.strictEqual(data.simulacao.valor_solicitado, 10000);
    assert.strictEqual(data.simulacao.meses, 24);
    assert.strictEqual(data.simulacao.valor_parcela, 522.15);
  });

  await t.test('Validação de limite inferior: valor < 500 retorna HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/simular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: 499, meses: 12 }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.sucesso, false);
    assert.match(data.erro, /500/);
  });

  await t.test('Validação de limite superior: valor > 50000 retorna HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/simular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: 50001, meses: 12 }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.sucesso, false);
    assert.match(data.erro, /50\.000/);
  });

  await t.test('Validação de prazo inferior: meses < 6 retorna HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/simular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: 5000, meses: 5 }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.sucesso, false);
    assert.match(data.erro, /6/);
  });

  await t.test('Validação de prazo superior: meses > 48 retorna HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/simular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: 5000, meses: 49 }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.sucesso, false);
    assert.match(data.erro, /48/);
  });

  await t.test('Payload vazio ou sem valor numérico retorna HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/simular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
  });
});

// ─── 3. Contratação de Empréstimo com Transação Atômica no PostgreSQL ─────────

test('R1: Contratação de Empréstimo — Transação Atômica & Integridade', async (t) => {
  const baseUrl = await getBaseUrl();
  const valorEmprestimo = 2500.0;
  const mesesEmprestimo = 12;

  // Consulta saldo inicial da Conta 2 (Carlos Eduardo Lima) para evitar colisão com Conta 1
  const contaPre = await pool.query('SELECT saldo FROM contas WHERE id = 2');
  const saldoPre = parseFloat(contaPre.rows[0].saldo);

  // Aguarda 600ms para garantir que asserções de custódia consolidada em testes paralelos já concluíram
  await new Promise((resolve) => setTimeout(resolve, 600));

  let transacaoIdCriada = null;

  try {
    await t.test('Executa contratação atômica de R$ 2.500,00 na Conta 2', async () => {
      const res = await fetch(`${baseUrl}/api/cliente/emprestimo/contratar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conta_id: 2,
          valor: valorEmprestimo,
          meses: mesesEmprestimo,
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.sucesso, true);
      assert.strictEqual(data.conta_id, 2);
      assert.strictEqual(data.valor_creditado, valorEmprestimo);
      assert.strictEqual(data.novo_saldo, saldoPre + valorEmprestimo);
      assert.ok(data.transacao_id, 'Deve retornar transacao_id');
      assert.ok(data.referencia_externa.startsWith('EMP-'), 'Referência externa deve iniciar com EMP-');
      assert.strictEqual(data.detalhes.valor, valorEmprestimo);
      assert.strictEqual(data.detalhes.parcelas, mesesEmprestimo);

      transacaoIdCriada = data.transacao_id;
    });

    await t.test('Confirma que o saldo da conta foi atualizado no PostgreSQL', async () => {
      const contaPos = await pool.query('SELECT saldo FROM contas WHERE id = 2');
      const saldoPos = parseFloat(contaPos.rows[0].saldo);
      assert.strictEqual(saldoPos, saldoPre + valorEmprestimo);
    });

    await t.test('Confirma que o lançamento em transacoes foi registrado como depósito', async () => {
      assert.ok(transacaoIdCriada);
      const txRes = await pool.query('SELECT * FROM transacoes WHERE id = $1', [transacaoIdCriada]);
      assert.strictEqual(txRes.rows.length, 1);

      const tx = txRes.rows[0];
      assert.strictEqual(tx.tipo, 'deposito');
      assert.strictEqual(tx.status, 'concluida');
      assert.strictEqual(parseFloat(tx.valor), valorEmprestimo);
      assert.strictEqual(tx.conta_destino_id, 2);
      assert.strictEqual(tx.conta_origem_id, null);
      assert.match(tx.descricao, /Empréstimo Pessoal Contratado/);
      assert.match(tx.descricao, /12 parcelas/);
    });
  } finally {
    // Reversão limpa da transação
    if (transacaoIdCriada) {
      await pool.query('DELETE FROM transacoes WHERE id = $1', [transacaoIdCriada]);
    }
    await pool.query('UPDATE contas SET saldo = $1 WHERE id = 2', [saldoPre]);
  }

  await t.test('Contratação em conta inexistente (999999) retorna HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/contratar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id: 999999, valor: 5000, meses: 12 }),
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.sucesso, false);
  });

  await t.test('Contratação com valor inválido (< 500) retorna HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/contratar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id: 2, valor: 200, meses: 12 }),
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('Contratação com meses inválidos (> 48) retorna HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/cliente/emprestimo/contratar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id: 2, valor: 5000, meses: 60 }),
    });
    assert.strictEqual(res.status, 400);
  });
});

// ─── 4. Assistente Bancário & Command Bar (/emprestimo) ───────────────────────

test('R1: Chat IA & Command Palette — Comando /emprestimo e Linguagem Natural', async (t) => {
  await t.test('Comando /emprestimo sem argumentos retorna simulação padrão de R$ 5.000 em 12x', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'emprestimo');
    assert.strictEqual(res.body.tipo_resposta, 'emprestimo');
    assert.strictEqual(res.body.dados.valor_solicitado, 5000);
    assert.strictEqual(res.body.dados.meses, 12);
    assert.strictEqual(res.body.dados.valor_parcela, 469.61);
    assert.strictEqual(res.body.dados.total_a_pagar, 5635.32);
    assert.strictEqual(res.body.dados.cet_anual_percentual, '25,19% a.a.');
  });

  await t.test('Comando rápido com argumentos: /emprestimo 10000 24', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo 10000 24', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.dados.valor_solicitado, 10000);
    assert.strictEqual(res.body.dados.meses, 24);
    assert.strictEqual(res.body.dados.valor_parcela, 522.15);
    assert.strictEqual(res.body.dados.total_a_pagar, 12531.6);
  });

  await t.test('Linguagem Natural: "Quanto fica um empréstimo de 5000 em 12x?"', async () => {
    const res = await postConsulta({ mensagem: 'Quanto fica um empréstimo de 5000 em 12x?', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.tipo_resposta, 'emprestimo');
    assert.strictEqual(res.body.dados.valor_solicitado, 5000);
    assert.strictEqual(res.body.dados.meses, 12);
    assert.strictEqual(res.body.dados.valor_parcela, 469.61);
  });

  await t.test('Linguagem Natural: "Quero fazer um empréstimo"', async () => {
    const res = await postConsulta({ mensagem: 'Quero fazer um empréstimo', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.tipo_resposta, 'emprestimo');
    assert.strictEqual(res.body.dados.valor_solicitado, 5000);
  });

  await t.test('Linguagem Natural: "Simular empréstimo de 10.000 em 24 meses"', async () => {
    const res = await postConsulta({ mensagem: 'Simular empréstimo de 10.000 em 24 meses', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.dados.valor_solicitado, 10000);
    assert.strictEqual(res.body.dados.meses, 24);
    assert.strictEqual(res.body.dados.valor_parcela, 522.15);
  });

  await t.test('Guia de ajuda (/ajuda) lista o comando /emprestimo', async () => {
    const res = await postConsulta({ mensagem: '/ajuda' });
    assert.strictEqual(res.status, 200);
    const nomes = res.body.dados.comandos.map(c => c.comando);
    assert.ok(nomes.includes('/emprestimo'), 'Deve listar /emprestimo no guia');
    assert.match(res.body.texto, /\/emprestimo/);
  });

  await t.test('SLA de Latência: consulta de empréstimo deve processar em menos de 500ms', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo 5000 12', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.ok(res.durationMs < 500, `Latência deve ser < 500ms, obteve ${res.durationMs}ms`);
  });

  await t.test('Humanizer Quality Gate: sem clichês de IA, sem travessões dash e com BRL', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo 5000 12', conta_id: 1 });
    const texto = res.body.texto;

    assert.ok(!texto.includes('—'), 'Não deve conter travessão dash (—)');
    assert.ok(!texto.includes('“') && !texto.includes('”'), 'Não deve conter aspas curvas');
    assert.match(texto, /R\$\s*469,61/);
    assert.match(texto, /1,89%\s*a\.m\./);
  });
});
