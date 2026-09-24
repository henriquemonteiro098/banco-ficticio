/**
 * test/tier1_features.test.js
 * Tier 1: Feature Coverage (Opaque-Box E2E Tests)
 * Validates commands (/saldo, /extrato, /pix, /contas, /agencias, /ajuda)
 * and natural language inquiries against PostgreSQL data.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { postConsulta, pool, closeTestServer } = require('./helper');

test.after(async () => {
  await pool.end();
  await closeTestServer();
});

test('Tier 1: Feature Coverage — Command /saldo', async (t) => {
  await t.test('Retorna saldo, limite e total disponível para conta corrente ativa (Conta 1 - Ana Paula)', async () => {
    const res = await postConsulta({ mensagem: '/saldo', conta_id: 1, cliente_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'saldo');
    assert.strictEqual(res.body.tipo_resposta, 'saldo');

    const dados = res.body.dados;
    assert.ok(dados, 'Campo dados deve existir');
    assert.strictEqual(dados.conta, '00010001-5');
    assert.strictEqual(dados.tipo, 'corrente');
    assert.strictEqual(typeof dados.saldo, 'number');
    assert.strictEqual(typeof dados.limite, 'number');
    assert.strictEqual(dados.saldo_disponivel, dados.saldo + dados.limite);
    assert.strictEqual(dados.titular, 'Ana Paula Souza');

    // Valida texto humanizado contendo valores formatados
    assert.match(res.body.texto, /saldo atual/i);
    assert.match(res.body.texto, /00010001-5/);
    assert.match(res.body.texto, /R\$\s*8\.450,00/);
  });

  await t.test('Retorna saldo correto para conta poupança (Conta 2 - Ana Paula)', async () => {
    const res = await postConsulta({ mensagem: '/saldo', conta_id: 2, cliente_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);

    const dados = res.body.dados;
    assert.strictEqual(dados.conta, '00010002-3');
    assert.strictEqual(dados.tipo, 'poupanca');
    assert.strictEqual(dados.saldo, 15200);
    assert.strictEqual(dados.limite, 0);
    assert.strictEqual(dados.saldo_disponivel, 15200);
  });

  await t.test('Fallback para primeira conta ativa quando conta_id não for fornecido', async () => {
    const res = await postConsulta({ mensagem: '/saldo' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.ok(res.body.dados.conta_id >= 1);
    assert.ok(res.body.dados.saldo !== undefined);
  });
});

test('Tier 1: Feature Coverage — Command /extrato', async (t) => {
  await t.test('Retorna histórico de lançamentos com direção e valores formatados', async () => {
    const res = await postConsulta({ mensagem: '/extrato', conta_id: 1, cliente_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'extrato');
    assert.strictEqual(res.body.tipo_resposta, 'extrato');

    const lancamentos = res.body.dados;
    assert.ok(Array.isArray(lancamentos), 'dados deve ser um array de lançamentos');
    assert.ok(lancamentos.length > 0, 'Deve conter pelo menos um lançamento');

    for (const item of lancamentos) {
      assert.ok(['entrada', 'saida'].includes(item.direcao), 'direção deve ser entrada ou saída');
      assert.strictEqual(typeof item.valor, 'number');
      assert.ok(item.valor > 0, 'valor da transação deve ser positivo');
      assert.ok(item.descricao, 'deve possuir descrição');
      assert.ok(item.data_formatada, 'deve possuir data formatada');
      assert.match(item.valor_formatado, /R\$\s*[\d\.,]+/);
    }
  });
});

test('Tier 1: Feature Coverage — Command /pix', async (t) => {
  await t.test('Retorna sugestões de contatos para envio rápido via PIX', async () => {
    const res = await postConsulta({ mensagem: '/pix', conta_id: 1, cliente_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'pix');
    assert.strictEqual(res.body.tipo_resposta, 'pix');

    const sugestoes = res.body.dados;
    assert.ok(Array.isArray(sugestoes), 'dados deve ser uma lista de sugestões');
    assert.ok(sugestoes.length > 0, 'Deve retornar ao menos um contato sugerido');

    for (const sug of sugestoes) {
      assert.ok(sug.titular, 'sugestão deve conter nome do titular');
      assert.ok(sug.conta, 'sugestão deve conter número da conta');
      assert.ok(sug.tipo, 'sugestão deve conter tipo de conta');
    }

    assert.match(res.body.texto, /PIX/i);
    assert.match(res.body.texto, /contatos/i);
  });
});

test('Tier 1: Feature Coverage — Command /contas', async (t) => {
  await t.test('Retorna todas as contas cadastradas do cliente 1 (Ana Paula)', async () => {
    const res = await postConsulta({ mensagem: '/contas', cliente_id: 1 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'contas');
    assert.strictEqual(res.body.tipo_resposta, 'contas');

    const contas = res.body.dados;
    assert.ok(Array.isArray(contas), 'dados deve ser um array de contas');
    assert.strictEqual(contas.length, 2, 'Ana Paula deve ter exatamente 2 contas cadastradas');

    const numeros = contas.map((c) => c.conta);
    assert.ok(numeros.includes('00010001-5'), 'Deve conter a conta corrente 00010001-5');
    assert.ok(numeros.includes('00010002-3'), 'Deve conter a conta poupança 00010002-3');

    for (const c of contas) {
      assert.strictEqual(typeof c.saldo, 'number');
      assert.strictEqual(typeof c.limite, 'number');
      assert.ok(c.agencia, 'Deve conter informação da agência');
    }
  });

  await t.test('Visão geral de contas ativas quando cliente_id não for informado', async () => {
    const res = await postConsulta({ mensagem: '/contas' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.ok(Array.isArray(res.body.dados));
    assert.ok(res.body.dados.length > 0);
  });
});

test('Tier 1: Feature Coverage — Command /agencias', async (t) => {
  await t.test('Retorna catálogo de agências ativas com códigos e cidades', async () => {
    const res = await postConsulta({ mensagem: '/agencias' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'agencias');
    assert.strictEqual(res.body.tipo_resposta, 'agencias');

    const agencias = res.body.dados;
    assert.ok(Array.isArray(agencias), 'dados deve ser um array de agências');
    assert.strictEqual(agencias.length, 10, 'O banco possui exatamente 10 agências ativas');

    const codigos = agencias.map((a) => a.codigo);
    assert.ok(codigos.includes('0001-7'), 'Deve conter agência 0001-7');
    assert.ok(codigos.includes('0002-5'), 'Deve conter agência 0002-5');

    for (const ag of agencias) {
      assert.ok(ag.nome, 'Agência deve ter nome');
      assert.ok(ag.cidade, 'Agência deve ter cidade');
      assert.ok(ag.estado, 'Agência deve ter estado');
      assert.strictEqual(typeof ag.total_contas, 'number');
    }

    assert.match(res.body.texto, /10 agências ativas/i);
  });
});

test('Tier 1: Feature Coverage — Command /ajuda', async (t) => {
  await t.test('Retorna lista de todos os comandos e exemplos de perguntas', async () => {
    const res = await postConsulta({ mensagem: '/ajuda' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.comando, 'ajuda');
    assert.strictEqual(res.body.tipo_resposta, 'ajuda');

    assert.ok(res.body.dados, 'dados deve conter comandos e exemplos');
    const { comandos, exemplos_perguntas } = res.body.dados;

    assert.ok(Array.isArray(comandos));
    const nomesComandos = comandos.map((c) => c.comando);
    assert.ok(nomesComandos.includes('/saldo'), 'Deve listar /saldo');
    assert.ok(nomesComandos.includes('/extrato'), 'Deve listar /extrato');
    assert.ok(nomesComandos.includes('/pix'), 'Deve listar /pix');
    assert.ok(nomesComandos.includes('/contas'), 'Deve listar /contas');
    assert.ok(nomesComandos.includes('/agencias'), 'Deve listar /agencias');
    assert.ok(nomesComandos.includes('/ajuda'), 'Deve listar /ajuda');

    assert.ok(Array.isArray(exemplos_perguntas));
    assert.ok(exemplos_perguntas.length >= 3);
  });
});

test('Tier 1: Feature Coverage — Natural Language Queries', async (t) => {
  await t.test('Pergunta: "Qual o saldo da Ana Paula?" consulta e retorna contas do cliente', async () => {
    const res = await postConsulta({ mensagem: 'Qual o saldo da Ana Paula?' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.tipo_resposta, 'saldo_cliente');

    assert.match(res.body.texto, /Ana Paula Souza/i);
    assert.match(res.body.texto, /00010001-5/);
    assert.match(res.body.texto, /R\$\s*8\.450,00/);

    const dados = res.body.dados;
    assert.ok(dados, 'Deve conter objeto dados');
    assert.strictEqual(dados.nome, 'Ana Paula Souza');
    assert.strictEqual(dados.contas.length, 2);
  });

  await t.test('Pergunta: "Quanto temos sob custódia no banco?" retorna total consolidado', async () => {
    const res = await postConsulta({ mensagem: 'Quanto temos sob custódia no banco?' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.tipo_resposta, 'custodia_total');

    assert.match(res.body.texto, /custódia consolidada/i);
    assert.match(res.body.texto, /R\$\s*387\.650,00/);

    assert.strictEqual(res.body.dados.total_custodia, 387650);
    assert.strictEqual(res.body.dados.total_contas_ativas, 19);
  });

  await t.test('Pergunta: "Qual foi a última transferência?" retorna dados da transação', async () => {
    const res = await postConsulta({ mensagem: 'Qual foi a última transferência?' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sucesso, true);
    assert.strictEqual(res.body.tipo_resposta, 'ultima_transferencia');

    const dados = res.body.dados;
    assert.ok(dados, 'deve retornar objeto dados com a última transferência');
    assert.ok(dados.valor > 0, 'valor da transferência deve ser positivo');
    assert.ok(dados.remetente, 'deve identificar o remetente');
    assert.ok(dados.destinatario, 'deve identificar o destinatário');
    assert.match(res.body.texto, /última transferência/i);
  });
});
