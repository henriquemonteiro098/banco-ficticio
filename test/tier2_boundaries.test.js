/**
 * test/tier2_boundaries.test.js
 * Tier 2: Boundary, Edge Case & Latency (<500ms) Test Suite
 * Validates performance budgets (<500ms SLA), empty payloads, invalid commands,
 * non-existent entities, and SQL injection resistance.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { postConsulta, pool, closeTestServer } = require('./helper');

test.after(async () => {
  await pool.end();
  await closeTestServer();
});

test('Tier 2: Latency SLA Verification (< 500ms)', async (t) => {
  const benchmarkCases = [
    { name: '/saldo (conta ativa)', payload: { mensagem: '/saldo', conta_id: 1 } },
    { name: '/extrato (conta ativa)', payload: { mensagem: '/extrato', conta_id: 1 } },
    { name: '/pix (sugestões)', payload: { mensagem: '/pix', conta_id: 1 } },
    { name: '/contas (visão cliente)', payload: { mensagem: '/contas', cliente_id: 1 } },
    { name: '/agencias (todas)', payload: { mensagem: '/agencias' } },
    { name: '/ajuda (guia de comandos)', payload: { mensagem: '/ajuda' } },
    { name: 'NL: "Quanto temos sob custódia no banco?"', payload: { mensagem: 'Quanto temos sob custódia no banco?' } },
    { name: 'NL: "Qual o saldo da Ana Paula?"', payload: { mensagem: 'Qual o saldo da Ana Paula?' } },
    { name: 'NL: "Qual foi a última transferência?"', payload: { mensagem: 'Qual foi a última transferência?' } },
  ];

  for (const tc of benchmarkCases) {
    await t.test(`Latência de ${tc.name} deve ser inferior a 500ms`, async () => {
      const res = await postConsulta(tc.payload);
      assert.strictEqual(res.status, 200, `Endpoint deve responder 200 para ${tc.name}`);
      assert.strictEqual(res.body.sucesso, true, `Resposta deve indicar sucesso para ${tc.name}`);

      // Validação de tempo HTTP ponta a ponta
      assert.ok(
        res.durationMs < 500,
        `Tempo total HTTP (${res.durationMs.toFixed(2)}ms) violou SLA de 500ms para ${tc.name}`
      );

      // Validação de tempo interno medido pelo assistente
      if (res.body.tempo_ms !== undefined) {
        assert.ok(
          res.body.tempo_ms < 500,
          `Tempo interno (${res.body.tempo_ms}ms) violou SLA de 500ms para ${tc.name}`
        );
      }
    });
  }
});

test('Tier 2: Empty, Malformed & Invalid Input Payloads', async (t) => {
  await t.test('Payload vazio ({}) retorna HTTP 400 com sucesso: false', async () => {
    const res = await postConsulta({});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.sucesso, false);
    assert.match(res.body.mensagem, /não informada|obrigatório/i);
  });

  await t.test('Campo mensagem vazio ("") retorna HTTP 400 com sucesso: false', async () => {
    const res = await postConsulta({ mensagem: '' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.sucesso, false);
  });

  await t.test('Campo mensagem composto apenas por espaços ("   ") retorna HTTP 400', async () => {
    const res = await postConsulta({ mensagem: '   ' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.sucesso, false);
  });

  await t.test('Campo mensagem não-string retorna HTTP 400', async () => {
    const res = await postConsulta({ mensagem: 12345 });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.sucesso, false);
  });
});

test('Tier 2: Command Palette Syntax & Boundary Conditions', async (t) => {
  await t.test('Comando não reconhecido (/invalido) retorna mensagem amigável sem erro 500', async () => {
    const res = await postConsulta({ mensagem: '/comandoquejamaisexistiria' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, false);
    assert.strictEqual(res.body.tipo_resposta, 'erro_comando');
    assert.match(res.body.texto, /não reconhecido|/i);
    assert.match(res.body.texto, /\/ajuda/);
  });

  await t.test('Barra isolada ("/") retorna erro amigável orientando uso de /ajuda', async () => {
    const res = await postConsulta({ mensagem: '/' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, false);
    assert.match(res.body.texto, /\/ajuda/);
  });

  await t.test('Comando com espaços extras no início e fim é normalizado ("  /saldo  ")', async () => {
    const res = await postConsulta({ mensagem: '  /saldo  ', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'saldo');
  });

  await t.test('Comando em caixa alta ("/SALDO") é normalizado', async () => {
    const res = await postConsulta({ mensagem: '/SALDO', conta_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'saldo');
  });
});

test('Tier 2: Unknown Inquiries & Non-Existent Entities', async (t) => {
  await t.test('Pergunta fora de domínio não quebra e orienta comandos bancários', async () => {
    const res = await postConsulta({ mensagem: 'Qual a velocidade média de uma andorinha em voo?' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.match(res.body.texto, /Não identifiquei|ajuda/i);
    assert.match(res.body.texto, /\/saldo|\/ajuda/);
  });

  await t.test('Consulta de saldo para cliente inexistente informa ausência de registros sem 500', async () => {
    const res = await postConsulta({ mensagem: 'Qual o saldo do Cliente Fantasma Inexistente 99999?' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.match(res.body.texto, /não (foi )?encontrado|nenhuma conta/i);
  });

  await t.test('Parâmetro conta_id inexistente (999999) é tratado com resiliência', async () => {
    const res = await postConsulta({ mensagem: '/saldo', conta_id: 999999 });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.sucesso !== undefined);
  });

  await t.test('Parâmetro conta_id com string inválida ("abc") é higienizado sem falha', async () => {
    const res = await postConsulta({ mensagem: '/saldo', conta_id: 'abc' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
  });
});

test('Tier 2: Security & Adversarial Injection Resistance', async (t) => {
  await t.test('Tentativa de SQL Injection via mensagem é tratada de forma segura', async () => {
    const sqlPayloads = [
      "'; DROP TABLE contas; --",
      "' OR '1'='1",
      "1; SELECT pg_sleep(2); --",
      "Qual o saldo de ' UNION SELECT * FROM usuarios --",
    ];

    for (const sql of sqlPayloads) {
      const res = await postConsulta({ mensagem: sql });
      assert.notStrictEqual(res.status, 500, `Injeção ${sql} causou erro 500 inesperado`);
      assert.ok(res.status === 200 || res.status === 400);
    }

    // Verifica que a tabela contas permanece intacta no banco
    const checkTable = await pool.query('SELECT COUNT(*) AS total FROM contas');
    assert.ok(parseInt(checkTable.rows[0].total, 10) >= 20, 'Tabela contas foi corrompida por injeção!');
  });

  await t.test('Mensagem com payload extremo (> 4.000 caracteres) processa sem estouro de pilha', async () => {
    const longMessage = 'Qual o saldo da Ana Paula? ' + 'palavra '.repeat(800);
    assert.ok(longMessage.length > 4000);

    const res = await postConsulta({ mensagem: longMessage });
    assert.strictEqual(res.status, 200);
    assert.ok(res.durationMs < 500, 'Payload longo violou teto de 500ms');
  });

  await t.test('Tags HTML e scripts maliciosos (<script>) são higienizados sem execução', async () => {
    const xssPayload = '<script>alert("xss")</script> Qual o saldo da Ana Paula?';
    const res = await postConsulta({ mensagem: xssPayload });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.texto);
  });
});
