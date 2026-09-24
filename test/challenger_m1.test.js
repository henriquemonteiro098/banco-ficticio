/**
 * test/challenger_m1.test.js
 * 
 * Adversarial Challenger Test Suite for Milestone M1 (Loan Simulator & Credit Hiring - R1)
 * 
 * Empirically challenges and stress-tests:
 * 1. Strict Boundary Conditions on Simulator and Hiring endpoints:
 *    - R$ 499 (reject), R$ 499.99 (reject), R$ 500 (accept), R$ 50.000 (accept), R$ 50.000,01 (reject), R$ 50.001 (reject)
 *    - 5 months (reject), 6 months (accept), 48 months (accept), 49 months (reject)
 *    - Negative numbers, zeros, invalid types (string, null, undefined, empty object, booleans, Infinity)
 *    - Non-existent, negative, zero, and inactive/blocked/closed accounts
 * 2. Financial Precision & Mathematical Oracle (Price Amortization System):
 *    - Independent mathematical oracle verification across key points (500 in 6x, 5000 in 12x, 50000 in 48x, etc.)
 *    - Systematic matrix sweep across values and installment terms
 *    - CET annual rate (25.19%) and monthly rate (1.89%)
 * 3. Atomic Credit Hiring & Direct PostgreSQL Balance Verification:
 *    - Single hiring balance credit and transaction audit in PostgreSQL
 *    - Concurrent hiring race-condition stress test (FOR UPDATE lock verification)
 *    - Inactive/blocked account rejection and zero side-effects verification
 *    - Guaranteed database state restoration
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, getBaseUrl, closeTestServer } = require('./helper');
const { calcularEmprestimo } = require('../assistant');

test.after(async () => {
  await pool.end();
  await closeTestServer();
});

// Independent Mathematical Oracle for Price Amortization
function oraclePrice(valor, meses, taxaMensal = 0.0189) {
  const fator = Math.pow(1 + taxaMensal, meses);
  const pmt = valor * (taxaMensal * fator) / (fator - 1);
  const valorParcela = Math.round(pmt * 100) / 100;
  const totalAPagar = Math.round(valorParcela * meses * 100) / 100;
  const totalJuros = Math.round((totalAPagar - valor) * 100) / 100;
  const cetAnual = Math.round((Math.pow(1 + taxaMensal, 12) - 1) * 10000) / 100;
  return { valorParcela, totalAPagar, totalJuros, cetAnual };
}

// ─── 1. BOUNDARY CONDITIONS STRESS TESTS ─────────────────────────────────────

test('Challenger M1: Boundary Conditions — Loan Simulator Endpoint', async (t) => {
  const baseUrl = await getBaseUrl();
  const simularUrl = `${baseUrl}/api/cliente/emprestimo/simular`;

  const boundaryCases = [
    // Monetary boundary checks
    { label: 'R$ 499 (must reject)', method: 'POST', body: { valor: 499, meses: 12 }, expect: 400 },
    { label: 'R$ 499.99 (must reject)', method: 'POST', body: { valor: 499.99, meses: 12 }, expect: 400 },
    { label: 'R$ 500 (must accept)', method: 'POST', body: { valor: 500, meses: 12 }, expect: 200 },
    { label: 'R$ 500.00 (must accept)', method: 'POST', body: { valor: 500.0, meses: 12 }, expect: 200 },
    { label: 'R$ 50.000 (must accept)', method: 'POST', body: { valor: 50000, meses: 12 }, expect: 200 },
    { label: 'R$ 50.000,01 (must reject)', method: 'POST', body: { valor: 50000.01, meses: 12 }, expect: 400 },
    { label: 'R$ 50.001 (must reject)', method: 'POST', body: { valor: 50001, meses: 12 }, expect: 400 },

    // Installment term boundary checks
    { label: '5 months (must reject)', method: 'POST', body: { valor: 5000, meses: 5 }, expect: 400 },
    { label: '6 months (must accept)', method: 'POST', body: { valor: 5000, meses: 6 }, expect: 200 },
    { label: '48 months (must accept)', method: 'POST', body: { valor: 5000, meses: 48 }, expect: 200 },
    { label: '49 months (must reject)', method: 'POST', body: { valor: 5000, meses: 49 }, expect: 400 },

    // Negative numbers and zeros
    { label: 'Negative valor -500 (must reject)', method: 'POST', body: { valor: -500, meses: 12 }, expect: 400 },
    { label: 'Negative valor -1 (must reject)', method: 'POST', body: { valor: -1, meses: 12 }, expect: 400 },
    { label: 'Zero valor 0 (must reject)', method: 'POST', body: { valor: 0, meses: 12 }, expect: 400 },
    { label: 'Negative meses -12 (must reject)', method: 'POST', body: { valor: 5000, meses: -12 }, expect: 400 },
    { label: 'Zero meses 0 (must reject)', method: 'POST', body: { valor: 5000, meses: 0 }, expect: 400 },

    // Invalid types and malformed bodies
    { label: 'Invalid type valor string "cinco mil" (must reject)', method: 'POST', body: { valor: 'cinco mil', meses: 12 }, expect: 400 },
    { label: 'Invalid type meses string "doze" (must reject)', method: 'POST', body: { valor: 5000, meses: 'doze' }, expect: 400 },
    { label: 'Valor null (must reject)', method: 'POST', body: { valor: null, meses: 12 }, expect: 400 },
    { label: 'Meses null (must reject)', method: 'POST', body: { valor: 5000, meses: null }, expect: 400 },
    { label: 'Empty body object {} (must reject)', method: 'POST', body: {}, expect: 400 },
    { label: 'Valor string "Infinity" (must reject)', method: 'POST', body: { valor: 'Infinity', meses: 12 }, expect: 400 },
    { label: 'Valor string "-Infinity" (must reject)', method: 'POST', body: { valor: '-Infinity', meses: 12 }, expect: 400 },
    { label: 'Valor boolean true (must reject)', method: 'POST', body: { valor: true, meses: 12 }, expect: 400 },
  ];

  for (const c of boundaryCases) {
    await t.test(`Simulate boundary: ${c.label}`, async () => {
      const res = await fetch(simularUrl, {
        method: c.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c.body),
      });

      assert.strictEqual(res.status, c.expect, `Expected HTTP ${c.expect} for ${c.label}`);
      const data = await res.json();
      if (c.expect === 200) {
        assert.strictEqual(data.sucesso, true);
        assert.ok(data.simulacao || data.dados);
      } else {
        assert.strictEqual(data.sucesso, false);
        assert.ok(data.erro, 'Error response must contain erro message');
      }
    });
  }

  // GET query param boundaries
  const getCases = [
    { label: 'GET valor 499 (reject)', query: 'valor=499&meses=12', expect: 400 },
    { label: 'GET valor 500 (accept)', query: 'valor=500&meses=6', expect: 200 },
    { label: 'GET valor 50000 (accept)', query: 'valor=50000&meses=48', expect: 200 },
    { label: 'GET valor 50001 (reject)', query: 'valor=50001&meses=12', expect: 400 },
    { label: 'GET meses 5 (reject)', query: 'valor=5000&meses=5', expect: 400 },
    { label: 'GET meses 49 (reject)', query: 'valor=5000&meses=49', expect: 400 },
    { label: 'GET negative valor -1000 (reject)', query: 'valor=-1000&meses=12', expect: 400 },
    { label: 'GET invalid string "abc" (reject)', query: 'valor=abc&meses=12', expect: 400 },
  ];

  for (const gc of getCases) {
    await t.test(`Simulate GET boundary: ${gc.label}`, async () => {
      const res = await fetch(`${simularUrl}?${gc.query}`);
      assert.strictEqual(res.status, gc.expect, `Expected HTTP ${gc.expect} for ${gc.label}`);
      const data = await res.json();
      assert.strictEqual(data.sucesso, gc.expect === 200);
    });
  }
});

test('Challenger M1: Boundary Conditions — Loan Hiring Endpoint Validation', async (t) => {
  const baseUrl = await getBaseUrl();
  const contratarUrl = `${baseUrl}/api/cliente/emprestimo/contratar`;

  const hiringBoundaryCases = [
    { label: 'Hiring valor 499 (reject)', body: { conta_id: 1, valor: 499, meses: 12 }, expect: 400 },
    { label: 'Hiring valor 50001 (reject)', body: { conta_id: 1, valor: 50001, meses: 12 }, expect: 400 },
    { label: 'Hiring valor negative -500 (reject)', body: { conta_id: 1, valor: -500, meses: 12 }, expect: 400 },
    { label: 'Hiring meses 5 (reject)', body: { conta_id: 1, valor: 5000, meses: 5 }, expect: 400 },
    { label: 'Hiring meses 49 (reject)', body: { conta_id: 1, valor: 5000, meses: 49 }, expect: 400 },
    { label: 'Hiring meses negative -12 (reject)', body: { conta_id: 1, valor: 5000, meses: -12 }, expect: 400 },
    { label: 'Hiring conta_id 0 (reject)', body: { conta_id: 0, valor: 5000, meses: 12 }, expect: 400 },
    { label: 'Hiring conta_id negative -1 (reject)', body: { conta_id: -1, valor: 5000, meses: 12 }, expect: 400 },
    { label: 'Hiring conta_id invalid string "xyz" (reject)', body: { conta_id: 'xyz', valor: 5000, meses: 12 }, expect: 400 },
    { label: 'Hiring conta_id non-existent 999999 (reject 404)', body: { conta_id: 999999, valor: 5000, meses: 12 }, expect: 404 },
    { label: 'Hiring conta_id blocked 9 (reject 400)', body: { conta_id: 9, valor: 5000, meses: 12 }, expect: 400 },
    { label: 'Hiring conta_id closed 15 (reject 400)', body: { conta_id: 15, valor: 5000, meses: 12 }, expect: 400 },
    { label: 'Hiring conta_id inactive 22 (reject 400)', body: { conta_id: 22, valor: 5000, meses: 12 }, expect: 400 },
  ];

  for (const hc of hiringBoundaryCases) {
    await t.test(`Hiring boundary: ${hc.label}`, async () => {
      const res = await fetch(contratarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hc.body),
      });

      assert.strictEqual(res.status, hc.expect, `Expected HTTP ${hc.expect} for ${hc.label}`);
      const data = await res.json();
      assert.strictEqual(data.sucesso, false);
      assert.ok(data.erro);
    });
  }

  // Ensure inactive account balances in PostgreSQL were NOT affected by failed hiring attempts
  const checkAccounts = await pool.query('SELECT id, saldo, status FROM contas WHERE id IN (9, 15, 22)');
  for (const row of checkAccounts.rows) {
    assert.strictEqual(parseFloat(row.saldo), 0.0, `Account ${row.id} (${row.status}) balance must remain 0.00`);
  }
});

// ─── 2. FINANCIAL CALCULATION PRECISION & ORACLE VERIFICATION ─────────────────

test('Challenger M1: Financial Precision — Price Formula Oracle Comparison', async (t) => {
  const baseUrl = await getBaseUrl();

  // Explicit points required by user mission + additional key amortization milestones
  const precisionPoints = [
    { valor: 500, meses: 6, label: 'Boundary Lower: R$ 500 in 6x' },
    { valor: 1000, meses: 6, label: 'R$ 1.000 in 6x' },
    { valor: 1000, meses: 12, label: 'R$ 1.000 in 12x' },
    { valor: 5000, meses: 12, label: 'Standard Case: R$ 5.000 in 12x' },
    { valor: 10000, meses: 24, label: 'R$ 10.000 in 24x' },
    { valor: 20000, meses: 36, label: 'R$ 20.000 in 36x' },
    { valor: 30000, meses: 36, label: 'R$ 30.000 in 36x' },
    { valor: 45000, meses: 42, label: 'R$ 45.000 in 42x' },
    { valor: 50000, meses: 48, label: 'Boundary Upper: R$ 50.000 in 48x' },
  ];

  for (const pt of precisionPoints) {
    await t.test(`Precision Test: ${pt.label}`, async () => {
      // 1. Calculate via independent mathematical oracle
      const expected = oraclePrice(pt.valor, pt.meses);

      // 2. Calculate via internal pure function
      const pureResult = calcularEmprestimo(pt.valor, pt.meses);
      assert.strictEqual(pureResult.valor_parcela, expected.valorParcela, `Installment mismatch for ${pt.label}`);
      assert.strictEqual(pureResult.total_a_pagar, expected.totalAPagar, `Total mismatch for ${pt.label}`);
      assert.strictEqual(pureResult.total_juros, expected.totalJuros, `Interest mismatch for ${pt.label}`);
      assert.strictEqual(pureResult.taxa_anual_cet, expected.cetAnual, `CET mismatch for ${pt.label}`);
      assert.strictEqual(pureResult.taxa_mensal, 0.0189);

      // 3. Calculate via HTTP REST API endpoint
      const res = await fetch(`${baseUrl}/api/cliente/emprestimo/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: pt.valor, meses: pt.meses }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.sucesso, true);

      const apiSim = data.simulacao;
      assert.strictEqual(apiSim.valor_parcela, expected.valorParcela, `API Installment mismatch for ${pt.label}`);
      assert.strictEqual(apiSim.total_a_pagar, expected.totalAPagar, `API Total mismatch for ${pt.label}`);
      assert.strictEqual(apiSim.total_juros, expected.totalJuros, `API Interest mismatch for ${pt.label}`);
      assert.strictEqual(apiSim.taxa_anual_cet, 25.19);
      assert.strictEqual(apiSim.taxa_mensal, 0.0189);

      // Verify contract compatibility node "dados"
      assert.ok(data.dados);
      assert.strictEqual(data.dados.parcela_mensal, expected.valorParcela);
      assert.strictEqual(data.dados.total_a_pagar, expected.totalAPagar);
      assert.strictEqual(data.dados.total_juros, expected.totalJuros);
    });
  }

  // Systematic Matrix Sweep
  await t.test('Systematic Matrix Sweep: 30 Combinations of amounts and terms', async () => {
    const sweepValores = [500, 2500, 7500, 15000, 35000, 50000];
    const sweepMeses = [6, 12, 18, 24, 48];

    for (const v of sweepValores) {
      for (const m of sweepMeses) {
        const oracle = oraclePrice(v, m);
        const actual = calcularEmprestimo(v, m);

        assert.strictEqual(actual.valor_parcela, oracle.valorParcela, `Sweep mismatch at R$ ${v} in ${m}x`);
        assert.strictEqual(actual.total_a_pagar, oracle.totalAPagar, `Sweep total mismatch at R$ ${v} in ${m}x`);
        assert.strictEqual(actual.total_juros, oracle.totalJuros, `Sweep interest mismatch at R$ ${v} in ${m}x`);
      }
    }
  });
});

// ─── 3. ATOMIC CREDIT HIRING & DIRECT POSTGRESQL VERIFICATION ─────────────────

test('Challenger M1: Atomic Hiring & PostgreSQL Integrity Stress Test', async (t) => {
  const baseUrl = await getBaseUrl();
  const contratarUrl = `${baseUrl}/api/cliente/emprestimo/contratar`;

  // Delay 1200ms to guarantee all parallel test suites (tier1, tier4, emprestimo)
  // doing custody reconciliation and initial assertions have fully completed
  await new Promise((r) => setTimeout(r, 1200));

  const targetAccountId = 2; // Conta 2 (Carlos Eduardo Lima)
  const initialRow = await pool.query('SELECT saldo FROM contas WHERE id = $1', [targetAccountId]);
  const initialBalance = parseFloat(initialRow.rows[0].saldo);

  const createdTxIds = [];

  try {
    // 3.1 Single Hiring: R$ 1.500,00 in 12x
    await t.test('Single Atomic Hiring: R$ 1.500,00 in 12x updates PostgreSQL balance and transacoes', async () => {
      const valor = 1500.0;
      const meses = 12;

      const res = await fetch(contratarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conta_id: targetAccountId, valor, meses }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.sucesso, true);
      assert.strictEqual(data.conta_id, targetAccountId);
      assert.strictEqual(data.valor_creditado, valor);
      assert.strictEqual(data.novo_saldo, initialBalance + valor);
      assert.ok(data.transacao_id, 'transacao_id must be returned');
      assert.ok(data.referencia_externa.startsWith('EMP-'), 'referencia_externa must start with EMP-');

      createdTxIds.push(data.transacao_id);

      // Verify PostgreSQL contas row directly
      const dbAcc = await pool.query('SELECT saldo FROM contas WHERE id = $1', [targetAccountId]);
      const actualBalance = parseFloat(dbAcc.rows[0].saldo);
      assert.strictEqual(actualBalance, initialBalance + valor, 'PostgreSQL account balance must be credited accurately');

      // Verify PostgreSQL transacoes row directly
      const dbTx = await pool.query('SELECT * FROM transacoes WHERE id = $1', [data.transacao_id]);
      assert.strictEqual(dbTx.rows.length, 1);
      const tx = dbTx.rows[0];
      assert.strictEqual(tx.tipo, 'deposito');
      assert.strictEqual(tx.status, 'concluida');
      assert.strictEqual(parseFloat(tx.valor), valor);
      assert.strictEqual(tx.conta_destino_id, targetAccountId);
      assert.strictEqual(tx.conta_origem_id, null);
      assert.match(tx.descricao, /Empréstimo Pessoal Contratado/);
      assert.match(tx.descricao, /12 parcelas/);
      assert.strictEqual(tx.referencia_externa, data.referencia_externa);
    });

    // 3.2 Concurrent Atomic Hiring Stress Test
    await t.test('Concurrent Hirings Stress Test: Two parallel requests on same account (FOR UPDATE lock check)', async () => {
      const preRow = await pool.query('SELECT saldo FROM contas WHERE id = $1', [targetAccountId]);
      const balanceBeforeConcurrent = parseFloat(preRow.rows[0].saldo);

      const reqA = { conta_id: targetAccountId, valor: 800.0, meses: 6 };
      const reqB = { conta_id: targetAccountId, valor: 1200.0, meses: 24 };

      // Dispatch both HTTP requests simultaneously
      const [resA, resB] = await Promise.all([
        fetch(contratarUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqA),
        }),
        fetch(contratarUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqB),
        }),
      ]);

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(resB.status, 200);

      const dataA = await resA.json();
      const dataB = await resB.json();

      assert.strictEqual(dataA.sucesso, true);
      assert.strictEqual(dataB.sucesso, true);
      assert.ok(dataA.transacao_id);
      assert.ok(dataB.transacao_id);

      createdTxIds.push(dataA.transacao_id);
      createdTxIds.push(dataB.transacao_id);

      // Verify PostgreSQL balance after concurrent operations
      const postRow = await pool.query('SELECT saldo FROM contas WHERE id = $1', [targetAccountId]);
      const balanceAfterConcurrent = parseFloat(postRow.rows[0].saldo);
      const expectedTotal = balanceBeforeConcurrent + 800.0 + 1200.0;

      assert.strictEqual(
        balanceAfterConcurrent,
        expectedTotal,
        `Concurrent execution must avoid lost updates! Expected ${expectedTotal}, got ${balanceAfterConcurrent}`
      );
    });
  } finally {
    // Guaranteed database state cleanup
    if (createdTxIds.length > 0) {
      await pool.query('DELETE FROM transacoes WHERE id = ANY($1::int[])', [createdTxIds]);
    }
    await pool.query('UPDATE contas SET saldo = $1 WHERE id = $2', [initialBalance, targetAccountId]);

    const finalRow = await pool.query('SELECT saldo FROM contas WHERE id = $1', [targetAccountId]);
    assert.strictEqual(parseFloat(finalRow.rows[0].saldo), initialBalance, 'Account balance must be cleanly restored');
  }
});
