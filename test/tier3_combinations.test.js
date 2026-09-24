/**
 * test/tier3_combinations.test.js
 * Tier 3: Combinations & Cross-Feature Interactions (Opaque-Box E2E Tests)
 * Tests multi-step financial flows, balance & statement synchronization after transfers,
 * account isolation, and PIX suggestion consistency.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { postConsulta, getBaseUrl, pool, closeTestServer } = require('./helper');

test.after(async () => {
  await pool.end();
  await closeTestServer();
});

test('Tier 3: Combinations — Transfer, Balance & Statement Synchronization', async (t) => {
  const baseUrl = await getBaseUrl();
  const transferAmount = 25.0;

  // 1. Consulta saldos iniciais de Conta 4 (Carla Mendes) e Conta 7 (Elena Martins)
  const sOrigemAntes = await postConsulta({ mensagem: '/saldo', conta_id: 4 });
  const sDestinoAntes = await postConsulta({ mensagem: '/saldo', conta_id: 7 });

  assert.strictEqual(sOrigemAntes.status, 200);
  assert.strictEqual(sDestinoAntes.status, 200);

  const saldo4Antes = sOrigemAntes.body.dados.saldo;
  const saldo7Antes = sDestinoAntes.body.dados.saldo;

  await t.test('Executa transferência atômica entre Conta 4 e Conta 7', async () => {
    const txRes = await fetch(`${baseUrl}/api/cliente/transferir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conta_origem_id: 4,
        conta_destino_numero: '00050001',
        valor: transferAmount,
        descricao: 'PIX E2E Teste Tier 3',
        chave_pix: 'contato@elenamartins.com.br',
      }),
    });

    assert.strictEqual(txRes.status, 200);
    const txData = await txRes.json();
    assert.strictEqual(txData.sucesso, true);
  });

  await t.test('Saldo da conta de origem reflete débito imediato via /saldo', async () => {
    const sOrigemDepois = await postConsulta({ mensagem: '/saldo', conta_id: 4 });
    assert.strictEqual(sOrigemDepois.status, 200);
    assert.strictEqual(sOrigemDepois.body.dados.saldo, saldo4Antes - transferAmount);
  });

  await t.test('Saldo da conta de destino reflete crédito imediato via /saldo', async () => {
    const sDestinoDepois = await postConsulta({ mensagem: '/saldo', conta_id: 7 });
    assert.strictEqual(sDestinoDepois.status, 200);
    assert.strictEqual(sDestinoDepois.body.dados.saldo, saldo7Antes + transferAmount);
  });

  await t.test('Extrato da conta de origem lista a saída como lançamento mais recente', async () => {
    const extratoOrigem = await postConsulta({ mensagem: '/extrato', conta_id: 4 });
    assert.strictEqual(extratoOrigem.status, 200);

    const primeiroLancamento = extratoOrigem.body.dados[0];
    assert.strictEqual(primeiroLancamento.direcao, 'saida');
    assert.strictEqual(primeiroLancamento.valor, transferAmount);
    assert.match(primeiroLancamento.descricao, /PIX E2E Teste Tier 3/i);
    assert.match(primeiroLancamento.contraparte, /Elena Martins/i);
  });

  await t.test('Extrato da conta de destino lista a entrada correspondente', async () => {
    const extratoDestino = await postConsulta({ mensagem: '/extrato', conta_id: 7 });
    assert.strictEqual(extratoDestino.status, 200);

    const primeiroLancamento = extratoDestino.body.dados[0];
    assert.strictEqual(primeiroLancamento.direcao, 'entrada');
    assert.strictEqual(primeiroLancamento.valor, transferAmount);
    assert.match(primeiroLancamento.contraparte, /Carla Mendes/i);
  });

  await t.test('Pergunta NL "Qual foi a última transferência?" reflete o lançamento recém-executado', async () => {
    const nlRes = await postConsulta({ mensagem: 'Qual foi a última transferência?' });
    assert.strictEqual(nlRes.status, 200);
    assert.strictEqual(nlRes.body.sucesso, true);

    const dados = nlRes.body.dados;
    assert.strictEqual(dados.valor, transferAmount);
    assert.match(dados.remetente, /Carla Mendes/i);
    assert.match(dados.destinatario, /Elena Martins/i);
  });

  await t.test('Reversão da transferência para manter isolamento e integridade do banco', async () => {
    const revRes = await fetch(`${baseUrl}/api/cliente/transferir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conta_origem_id: 7,
        conta_destino_numero: '00030001',
        valor: transferAmount,
        descricao: 'Reversão E2E Tier 3',
      }),
    });
    assert.strictEqual(revRes.status, 200);
    const revData = await revRes.json();
    assert.strictEqual(revData.sucesso, true);

    const s4Final = await postConsulta({ mensagem: '/saldo', conta_id: 4 });
    const s7Final = await postConsulta({ mensagem: '/saldo', conta_id: 7 });

    assert.strictEqual(s4Final.body.dados.saldo, saldo4Antes, 'Saldo de Conta 4 deve retornar ao valor original');
    assert.strictEqual(s7Final.body.dados.saldo, saldo7Antes, 'Saldo de Conta 7 deve retornar ao valor original');
  });
});

test('Tier 3: Combinations — Account Context Isolation', async (t) => {
  await t.test('Consultas consecutivas com conta_id distintos mantêm isolamento rigoroso', async () => {
    const resConta1 = await postConsulta({ mensagem: '/saldo', conta_id: 1 });
    const resConta2 = await postConsulta({ mensagem: '/saldo', conta_id: 2 });
    const resConta3 = await postConsulta({ mensagem: '/saldo', conta_id: 3 });

    assert.notStrictEqual(resConta1.body.dados.conta, resConta2.body.dados.conta);
    assert.notStrictEqual(resConta2.body.dados.conta, resConta3.body.dados.conta);

    assert.strictEqual(resConta1.body.dados.tipo, 'corrente');
    assert.strictEqual(resConta2.body.dados.tipo, 'poupanca');
    assert.strictEqual(resConta3.body.dados.titular, 'Bruno Costa Lima');
  });
});

test('Tier 3: Combinations — PIX Destination Self-Exclusion', async (t) => {
  await t.test('Sugestões de PIX para Conta 1 nunca incluem a própria Conta 1', async () => {
    const res = await postConsulta({ mensagem: '/pix', conta_id: 1 });
    assert.strictEqual(res.status, 200);

    const sugestoes = res.body.dados;
    for (const sug of sugestoes) {
      assert.notStrictEqual(sug.conta_id, 1, 'Conta 1 não pode sugerir a si mesma como destinatário');
      assert.notStrictEqual(sug.conta, '00010001-5');
    }
  });

  await t.test('Sugestões de PIX para Conta 3 nunca incluem a própria Conta 3', async () => {
    const res = await postConsulta({ mensagem: '/pix', conta_id: 3 });
    assert.strictEqual(res.status, 200);

    const sugestoes = res.body.dados;
    for (const sug of sugestoes) {
      assert.notStrictEqual(sug.conta_id, 3, 'Conta 3 não pode sugerir a si mesma como destinatário');
      assert.notStrictEqual(sug.conta, '00020001-8');
    }
  });
});

test('Tier 3: Combinations — Contas List vs. Saldo Consistency', async (t) => {
  await t.test('Saldos individuais em /contas correspondem exatamente aos saldos em /saldo', async () => {
    const contasRes = await postConsulta({ mensagem: '/contas', cliente_id: 1 });
    assert.strictEqual(contasRes.status, 200);
    const contas = contasRes.body.dados;

    let somaContas = 0;
    for (const c of contas) {
      const saldoRes = await postConsulta({ mensagem: '/saldo', conta_id: c.conta_id });
      assert.strictEqual(saldoRes.status, 200);
      assert.strictEqual(saldoRes.body.dados.saldo, c.saldo);
      assert.strictEqual(saldoRes.body.dados.limite, c.limite);
      somaContas += c.saldo;
    }

    // Valida com pergunta em linguagem natural sobre o titular
    const nlRes = await postConsulta({ mensagem: 'Qual o saldo da Ana Paula?' });
    assert.strictEqual(nlRes.status, 200);
    assert.strictEqual(nlRes.body.dados.total_saldo, somaContas);
  });
});
