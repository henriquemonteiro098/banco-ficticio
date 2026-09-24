/**
 * test/challenger_m1_2.test.js — Empirical Challenger 2 Test Suite (Milestone M1)
 *
 * Empirical stress-testing of:
 * 1. Chat IA /emprestimo command with edge-case parameters:
 *    - /emprestimo (no args)
 *    - /emprestimo 1000 12 (standard valid)
 *    - /emprestimo abc xyz (non-numeric parameters)
 *    - /emprestimo -500 2 (negative value & below-min term)
 *    - /emprestimo 999999 12 (above-max value)
 *    - /emprestimo 50000 48, /emprestimo 500 6, case-insensitivity
 * 2. Natural language loan queries:
 *    - "Quanto fica um emprestimo de 10000 em 24 meses?"
 *    - "Quero simular emprestimo"
 *    - "Qual o juros do emprestimo?"
 *    - Additional variations and intent recognition
 * 3. Concurrent hiring requests & PostgreSQL row lock race conditions:
 *    - 10 concurrent hiring requests on Account 19 (limite 0.00)
 *    - Race condition between loan hiring and concurrent transfers (prevent negative balance)
 *    - Concurrent hiring on inactive/blocked account (Account 9)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, getBaseUrl, closeTestServer, postConsulta } = require('./helper');

test.after(async () => {
  await pool.end();
  await closeTestServer();
});

// ─── 1. Chat IA /emprestimo Command with Edge-Case Parameters ─────────────────

test('Challenger M1-2: Chat IA /emprestimo Command Parameter Edge Cases', async (t) => {
  await t.test('1.1 /emprestimo sem parâmetros retorna simulação padrão (R$ 5.000, 12 meses)', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'emprestimo');
    assert.strictEqual(res.body.tipo_resposta, 'emprestimo');
    assert.strictEqual(res.body.dados.valor_solicitado, 5000);
    assert.strictEqual(res.body.dados.meses, 12);
    assert.strictEqual(res.body.dados.valor_parcela, 469.61);
    assert.strictEqual(res.body.dados.total_a_pagar, 5635.32);
    assert.strictEqual(res.body.dados.total_juros, 635.32);
    assert.strictEqual(res.body.dados.taxa_mensal_formatada, '1,89% a.m.');
    assert.strictEqual(res.body.dados.taxa_anual_cet_formatada, '25,19% a.a.');
    assert.match(res.body.texto, /R\$\s*5\.000,00/);
    assert.match(res.body.texto, /12 parcelas fixas/);
  });

  await t.test('1.2 /emprestimo 1000 12 calcula parcelas e total com precisão', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo 1000 12', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.dados.valor_solicitado, 1000);
    assert.strictEqual(res.body.dados.meses, 12);
    assert.strictEqual(res.body.dados.valor_parcela, 93.92);
    assert.strictEqual(res.body.dados.total_a_pagar, 1127.04);
    assert.strictEqual(res.body.dados.total_juros, 127.04);
    assert.match(res.body.texto, /R\$\s*93,92/);
    assert.match(res.body.texto, /R\$\s*1\.127,04/);
  });

  await t.test('1.3 /emprestimo abc xyz (parâmetros não numéricos) usa fallback seguro sem erro 500', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo abc xyz', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.dados.valor_solicitado, 5000);
    assert.strictEqual(res.body.dados.meses, 12);
    assert.strictEqual(res.body.dados.valor_parcela, 469.61);
  });

  await t.test('1.4 /emprestimo -500 2 ajusta valor negativo e limita prazo ao mínimo legal de 6 meses', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo -500 2', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.dados.valor_solicitado, 500);
    assert.strictEqual(res.body.dados.meses, 6);
    assert.strictEqual(res.body.dados.valor_parcela, 88.93);
    assert.strictEqual(res.body.dados.total_a_pagar, 533.58);
    assert.strictEqual(res.body.dados.total_juros, 33.58);
  });

  await t.test('1.5 /emprestimo 999999 12 ajusta valor excessivo ao limite máximo de R$ 50.000,00', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo 999999 12', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.dados.valor_solicitado, 50000);
    assert.strictEqual(res.body.dados.meses, 12);
    assert.strictEqual(res.body.dados.valor_parcela, 4696.1);
    assert.strictEqual(res.body.dados.total_a_pagar, 56353.2);
    assert.strictEqual(res.body.dados.total_juros, 6353.2);
  });

  await t.test('1.6 /emprestimo 50000 48 (limites máximos simultâneos)', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo 50000 48', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.dados.valor_solicitado, 50000);
    assert.strictEqual(res.body.dados.meses, 48);
    assert.strictEqual(res.body.dados.valor_parcela, 1593.82);
    assert.strictEqual(res.body.dados.total_a_pagar, 76503.36);
  });

  await t.test('1.7 /emprestimo 500 6 (limites mínimos simultâneos)', async () => {
    const res = await postConsulta({ mensagem: '/emprestimo 500 6', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.dados.valor_solicitado, 500);
    assert.strictEqual(res.body.dados.meses, 6);
    assert.strictEqual(res.body.dados.valor_parcela, 88.93);
    assert.strictEqual(res.body.dados.total_a_pagar, 533.58);
  });

  await t.test('1.8 Variações de caixa e alias: /EMPRESTIMO, /empréstimo, /credito', async () => {
    const r1 = await postConsulta({ mensagem: '/EMPRESTIMO 2000 12', conta_id: 1 });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.body.dados.valor_solicitado, 2000);

    const r2 = await postConsulta({ mensagem: '/empréstimo 3000 12', conta_id: 1 });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.body.dados.valor_solicitado, 3000);

    const r3 = await postConsulta({ mensagem: '/credito 4000 12', conta_id: 1 });
    assert.strictEqual(r3.status, 200);
    assert.strictEqual(r3.body.dados.valor_solicitado, 4000);
  });
});

// ─── 2. Consultas em Linguagem Natural (NLP) ──────────────────────────────────

test('Challenger M1-2: Consultas de Empréstimo em Linguagem Natural (NLP)', async (t) => {
  await t.test('2.1 "Quanto fica um emprestimo de 10000 em 24 meses?" extrai valor e parcelas', async () => {
    const res = await postConsulta({
      mensagem: 'Quanto fica um emprestimo de 10000 em 24 meses?',
      conta_id: 1,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.tipo_resposta, 'emprestimo');
    assert.strictEqual(res.body.dados.valor_solicitado, 10000);
    assert.strictEqual(res.body.dados.meses, 24);
    assert.strictEqual(res.body.dados.valor_parcela, 522.15);
    assert.strictEqual(res.body.dados.total_a_pagar, 12531.6);
    assert.match(res.body.texto, /R\$\s*522,15/);
    assert.match(res.body.texto, /24 parcelas fixas/);
  });

  await t.test('2.2 "Quero simular emprestimo" reconhece intenção e apresenta simulação padrão', async () => {
    const res = await postConsulta({
      mensagem: 'Quero simular emprestimo',
      conta_id: 1,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.tipo_resposta, 'emprestimo');
    assert.strictEqual(res.body.dados.valor_solicitado, 5000);
    assert.strictEqual(res.body.dados.meses, 12);
    assert.match(res.body.texto, /Simulação de Empréstimo Pessoal/);
  });

  await t.test('2.3 "Qual o juros do emprestimo?" informa taxas oficiais de 1,89% a.m. e 25,19% a.a.', async () => {
    const res = await postConsulta({
      mensagem: 'Qual o juros do emprestimo?',
      conta_id: 1,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.tipo_resposta, 'emprestimo');
    assert.match(res.body.texto, /1,89%\s*a\.m\./);
    assert.match(res.body.texto, /25,19%\s*a\.a\./);
  });

  await t.test('2.4 Variações linguísticas complexas de simulação', async () => {
    const r1 = await postConsulta({
      mensagem: 'Gostaria de fazer uma simulação de crédito pessoal de 15000 em 36 vezes',
      conta_id: 1,
    });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.body.dados.valor_solicitado, 15000);
    assert.strictEqual(r1.body.dados.meses, 36);

    const r2 = await postConsulta({
      mensagem: 'Quanto custa pegar emprestado R$ 5.000 em 12 parcelas?',
      conta_id: 1,
    });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.body.dados.valor_solicitado, 5000);
    assert.strictEqual(r2.body.dados.meses, 12);
  });
});

// ─── 3. Concorrência & Row Locks no PostgreSQL ────────────────────────────────

test('Challenger M1-2: Concorrência e Isolamento de Transações no PostgreSQL', async (t) => {
  const baseUrl = await getBaseUrl();

  // Pausa para assegurar que testes concorrentes de custódia consolidada em outras suítes concluíram
  await new Promise((resolve) => setTimeout(resolve, 1200));

  await t.test('3.1 10 contratações concorrentes de empréstimo executam atomicamente com SELECT FOR UPDATE', async () => {
    const accPre = await pool.query('SELECT saldo, status FROM contas WHERE id = 19');
    const initialSaldo = parseFloat(accPre.rows[0].saldo);

    const CONCURRENCY = 10;
    const hireValue = 1000.0;
    const meses = 12;

    const promises = Array.from({ length: CONCURRENCY }, () =>
      fetch(`${baseUrl}/api/cliente/emprestimo/contratar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conta_id: 19, valor: hireValue, meses }),
      }).then(async (r) => ({
        status: r.status,
        body: await r.json(),
      }))
    );

    const results = await Promise.all(promises);

    // Validações de cada requisição individual
    for (const r of results) {
      assert.strictEqual(r.status, 200, 'Cada contratação deve retornar HTTP 200');
      assert.strictEqual(r.body.sucesso, true);
      assert.strictEqual(r.body.conta_id, 19);
      assert.strictEqual(r.body.valor_creditado, hireValue);
      assert.ok(r.body.transacao_id, 'Deve conter transacao_id');
      assert.ok(r.body.referencia_externa.startsWith('EMP-'), 'Referência deve ser prefixada com EMP-');
    }

    // IDs de transação e referências externas devem ser únicos
    const txIds = results.map((r) => r.body.transacao_id);
    const uniqueTxIds = new Set(txIds);
    assert.strictEqual(uniqueTxIds.size, CONCURRENCY, 'Todas as 10 transações devem ter IDs únicos');

    const refs = results.map((r) => r.body.referencia_externa);
    const uniqueRefs = new Set(refs);
    assert.strictEqual(uniqueRefs.size, CONCURRENCY, 'Todas as 10 referências externas devem ser únicas');

    // Validação do saldo final no PostgreSQL
    const accPost = await pool.query('SELECT saldo FROM contas WHERE id = 19');
    const finalSaldo = parseFloat(accPost.rows[0].saldo);
    const expectedSaldo = initialSaldo + CONCURRENCY * hireValue;
    assert.strictEqual(
      finalSaldo,
      expectedSaldo,
      `Saldo final deve ser ${expectedSaldo}, mas PostgreSQL registrou ${finalSaldo}`
    );

    // Limpeza rigorosa
    await pool.query("DELETE FROM transacoes WHERE conta_destino_id = 19 AND descricao LIKE 'Empréstimo Pessoal Contratado%'");
    await pool.query('UPDATE contas SET saldo = $1 WHERE id = 19', [initialSaldo]);
  });

  await t.test('3.2 Condição de corrida: contratação simultânea com transferências impede saldo negativo', async () => {
    const acc19Pre = await pool.query('SELECT saldo, status, limite FROM contas WHERE id = 19');
    const acc1Pre = await pool.query('SELECT saldo FROM contas WHERE id = 1');
    const s19Init = parseFloat(acc19Pre.rows[0].saldo);
    const s1Init = parseFloat(acc1Pre.rows[0].saldo);

    // Conta 19 tem saldo inicial de R$ 2.100,00 e limite R$ 0,00
    // Lançamos simultaneamente:
    // - 1 contratação de empréstimo de R$ 1.000,00
    // - 3 tentativas de transferência de R$ 1.500,00 para a Conta 1
    // Total de fundos disponíveis no melhor cenário: 2.100 + 1.000 = 3.100
    // Três transferências exigiriam: 3 x 1.500 = 4.500 > 3.100
    // Portanto, no máximo 2 transferências podem ser aprovadas, e pelo menos 1 deve ser rejeitada com HTTP 400.
    const promises = [
      fetch(`${baseUrl}/api/cliente/emprestimo/contratar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conta_id: 19, valor: 1000, meses: 12 }),
      }).then(async (r) => ({ op: 'hire', status: r.status, body: await r.json() })),

      fetch(`${baseUrl}/api/cliente/transferir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conta_origem_id: 19, conta_destino_numero: '00010001', valor: 1500, descricao: 'Race test T1' }),
      }).then(async (r) => ({ op: 'transfer', status: r.status, body: await r.json() })),

      fetch(`${baseUrl}/api/cliente/transferir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conta_origem_id: 19, conta_destino_numero: '00010001', valor: 1500, descricao: 'Race test T2' }),
      }).then(async (r) => ({ op: 'transfer', status: r.status, body: await r.json() })),

      fetch(`${baseUrl}/api/cliente/transferir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conta_origem_id: 19, conta_destino_numero: '00010001', valor: 1500, descricao: 'Race test T3' }),
      }).then(async (r) => ({ op: 'transfer', status: r.status, body: await r.json() })),
    ];

    const results = await Promise.all(promises);

    const hireResult = results.find((r) => r.op === 'hire');
    assert.strictEqual(hireResult.status, 200, 'A contratação de empréstimo deve ser aprovada');

    const transferResults = results.filter((r) => r.op === 'transfer');
    const transfersSucceeded = transferResults.filter((r) => r.status === 200).length;
    const transfersFailed = transferResults.filter((r) => r.status === 400).length;

    // Asserções estritas de segurança bancária:
    assert.ok(transfersSucceeded <= 2, `No máximo 2 transferências podem ser aprovadas, obteve ${transfersSucceeded}`);
    assert.ok(transfersFailed >= 1, `Pelo menos 1 transferência deve ser rejeitada por saldo insuficiente, obteve ${transfersFailed}`);

    const acc19Post = await pool.query('SELECT saldo FROM contas WHERE id = 19');
    const s19Final = parseFloat(acc19Post.rows[0].saldo);
    assert.ok(s19Final >= 0.0, `Saldo da conta nunca pode ser negativo (obteve ${s19Final})`);

    const expectedFinal19 = s19Init + 1000 - transfersSucceeded * 1500;
    assert.strictEqual(s19Final, expectedFinal19, 'Saldo final deve conciliar aritmeticamente com as operações aprovadas');

    // Limpeza
    await pool.query("DELETE FROM transacoes WHERE descricao LIKE 'Race test%' OR descricao LIKE 'Empréstimo Pessoal Contratado%'");
    await pool.query('UPDATE contas SET saldo = $1 WHERE id = 19', [s19Init]);
    await pool.query('UPDATE contas SET saldo = $1 WHERE id = 1', [s1Init]);
  });

  await t.test('3.3 Contratações simultâneas em conta bloqueada (Conta 9) são rejeitadas com HTTP 400', async () => {
    const promises = Array.from({ length: 5 }, () =>
      fetch(`${baseUrl}/api/cliente/emprestimo/contratar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conta_id: 9, valor: 2000, meses: 12 }),
      }).then(async (r) => ({ status: r.status, body: await r.json() }))
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.body.sucesso, false);
      assert.match(r.body.erro, /bloqueada/i);
    }
  });
});
