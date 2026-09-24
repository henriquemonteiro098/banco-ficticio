/**
 * test/tier4_real_world.test.js
 * Tier 4: Real-World Scenarios, Custody Integrity & Humanizer Linguistic Checks
 * Reconciles global bank custody across DB, dashboard and assistant;
 * performs strict linguistic audit against AI tropes, sycophancy, and robotic clichés.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { postConsulta, getBaseUrl, pool, closeTestServer } = require('./helper');

test.after(async () => {
  await pool.end();
  await closeTestServer();
});

test('Tier 4: Real-World Scenarios — Custody & Aggregate Financial Reconciliation', async (t) => {
  const baseUrl = await getBaseUrl();

  await t.test('Custódia total do assistente concilia perfeitamente com Dashboard e PostgreSQL', async () => {
    // 1. Consulta via Chat IA / Assistente
    const chatRes = await postConsulta({ mensagem: 'Quanto temos sob custódia no banco?' });
    assert.strictEqual(chatRes.status, 200);
    assert.strictEqual(chatRes.body.sucesso, true);
    const custodiaChat = chatRes.body.dados.total_custodia;

    // 2. Consulta via Endpoint do Dashboard
    const dashHttp = await fetch(`${baseUrl}/api/banco/dashboard`);
    assert.strictEqual(dashHttp.status, 200);
    const dashData = await dashHttp.json();
    const custodiaDash = parseFloat(dashData.kpis.total_custodia);

    // 3. Consulta direta ao banco de dados PostgreSQL
    const dbRes = await pool.query(`SELECT COALESCE(SUM(saldo), 0) AS total FROM contas WHERE status = 'ativa'`);
    const custodiaDb = parseFloat(dbRes.rows[0].total);

    // Reconciliação dos três canais
    assert.strictEqual(custodiaChat, custodiaDb, 'Custódia do chat deve ser idêntica ao banco de dados');
    assert.strictEqual(custodiaDash, custodiaDb, 'Custódia do dashboard deve ser idêntica ao banco de dados');
    assert.strictEqual(custodiaChat, 387650, 'Custódia ativa esperada do seed deve ser R$ 387.650,00');

    // Validação de formatação monetária padrão pt-BR no texto do assistente
    assert.match(chatRes.body.texto, /R\$\s*387\.650,00/);
  });

  await t.test('Contagem de contas e clientes ativos é consistente entre fontes', async () => {
    const chatRes = await postConsulta({ mensagem: 'Quanto temos sob custódia no banco?' });
    const dashHttp = await fetch(`${baseUrl}/api/banco/dashboard`);
    const dashData = await dashHttp.json();

    const dbContas = await pool.query(`SELECT COUNT(*) AS total FROM contas WHERE status = 'ativa'`);
    const totalContasDb = parseInt(dbContas.rows[0].total, 10);

    assert.strictEqual(chatRes.body.dados.total_contas_ativas, totalContasDb);
    assert.strictEqual(parseInt(dashData.kpis.total_contas_ativas, 10), totalContasDb);
    assert.strictEqual(parseInt(dashData.kpis.total_clientes, 10), 20);
  });
});

test('Tier 4: Humanizer Quality Gate & Linguistic Audit (Requirement R3)', async (t) => {
  // Lista de clichês proibidos baseados nas diretrizes do Humanizer e WikiProject AI Cleanup
  const clichesProibidos = [
    // Identificações robóticas artificiais
    /como (um )?modelo de (ia|linguagem)/i,
    /como inteligência artificial/i,
    /como uma ia/i,
    /sou seu assistente bancário com inteligência artificial/i,
    // Bajulação e puxa-saquismo (sycophancy)
    /excelente pergunta/i,
    /ótima pergunta/i,
    /perfeito!/i,
    /ótima escolha/i,
    /certamente!/i,
    /com certeza!/i,
    /com todo prazer/i,
    /sem dúvidas!/i,
    // Encerramentos robóticos de chatbot genérico
    /espero ter ajudado/i,
    /espero ter esclarecido/i,
    /fico à disposição/i,
    /qualquer dúvida estou à disposição/i,
    /tenha um excelente dia/i,
    // Jargões ocos e buzzwords corporativas
    /robusto ecossistema/i,
    /soluções de ponta/i,
    /jornada de transformação digital/i,
  ];

  // Amostra diversificada de mensagens cobrindo todos os comandos e perguntas
  const casosTeste = [
    { mensagem: '/saldo', conta_id: 1 },
    { mensagem: '/extrato', conta_id: 1 },
    { mensagem: '/pix', conta_id: 1 },
    { mensagem: '/contas', cliente_id: 1 },
    { mensagem: '/agencias' },
    { mensagem: '/ajuda' },
    { mensagem: 'Qual o saldo da Ana Paula?' },
    { mensagem: 'Quanto temos sob custódia no banco?' },
    { mensagem: 'Qual foi a última transferência?' },
    { mensagem: 'Quantos clientes temos cadastrados?' },
    { mensagem: 'Quais são as maiores agências?' },
    { mensagem: 'Qual foi o maior depósito?' },
    { mensagem: 'Quantas contas estão bloqueadas ou inativas?' },
    { mensagem: '/comandoinvalido' },
    { mensagem: 'Qual a previsão do tempo para Marte?' },
  ];

  for (const caso of casosTeste) {
    await t.test(`Resposta para "${caso.mensagem}" cumpre padrão Humanizer sem clichês de IA`, async () => {
      const res = await postConsulta(caso);
      const texto = res.body?.texto || '';

      assert.ok(texto.length > 0, `Mensagem "${caso.mensagem}" gerou resposta de texto vazia`);

      // 1. Auditoria contra clichês de IA
      for (const pattern of clichesProibidos) {
        assert.doesNotMatch(
          texto,
          pattern,
          `Texto da consulta "${caso.mensagem}" contém clichê proibido de IA: ${pattern}`
        );
      }

      // 2. Proibição de travessão em dash (—) como muleta estilística
      assert.ok(
        !texto.includes('—'),
        `Texto da consulta "${caso.mensagem}" utiliza travessão em dash (—) não permitido pelo Humanizer`
      );

      // 3. Proibição de aspas curvas (“ ou ”)
      assert.ok(
        !texto.includes('“') && !texto.includes('”'),
        `Texto da consulta "${caso.mensagem}" utiliza aspas curvas não recomendadas`
      );
    });
  }

  await t.test('Valores monetários seguem estritamente o formato pt-BR (R$ X.XXX,XX)', async () => {
    const resSaldo = await postConsulta({ mensagem: '/saldo', conta_id: 1 });
    const resCustodia = await postConsulta({ mensagem: 'Quanto temos sob custódia no banco?' });

    assert.match(resSaldo.body.texto, /R\$\s*\d{1,3}(\.\d{3})*,\d{2}/);
    assert.match(resCustodia.body.texto, /R\$\s*\d{1,3}(\.\d{3})*,\d{2}/);
  });

  await t.test('Identificadores de conta seguem estritamente o padrão com hífen (XXXXXXXX-X)', async () => {
    const resSaldo = await postConsulta({ mensagem: '/saldo', conta_id: 1 });
    assert.match(resSaldo.body.dados.conta, /^\d{8}-\d$/);
  });
});
