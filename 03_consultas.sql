-- =============================================================================
-- 03_consultas.sql — Banco Fictício
-- Consultas de demonstração — execute no VS Code (SQLTools) ou pgAdmin 4
-- Atalho VS Code: selecione a consulta e pressione Ctrl+E Ctrl+E
-- =============================================================================


-- =============================================================================
-- 1. VISÃO GERAL DO BANCO
-- =============================================================================

-- 1.1 Resumo de totais
SELECT
    (SELECT COUNT(*) FROM agencias WHERE ativa = true)    AS agencias_ativas,
    (SELECT COUNT(*) FROM clientes  WHERE ativo  = true)  AS clientes_ativos,
    (SELECT COUNT(*) FROM contas    WHERE status = 'ativa') AS contas_ativas,
    (SELECT COUNT(*) FROM transacoes)                     AS total_transacoes,
    (SELECT SUM(saldo) FROM contas WHERE status = 'ativa') AS saldo_total_banco;


-- =============================================================================
-- 2. CLIENTES
-- =============================================================================

-- 2.1 Todos os clientes ativos com número de contas
SELECT
    c.id,
    c.nome,
    c.email,
    c.cidade,
    c.estado,
    COUNT(ct.id)     AS total_contas,
    SUM(ct.saldo)    AS saldo_total
FROM clientes c
LEFT JOIN contas ct ON ct.cliente_id = c.id AND ct.status = 'ativa'
WHERE c.ativo = true
GROUP BY c.id, c.nome, c.email, c.cidade, c.estado
ORDER BY saldo_total DESC NULLS LAST;


-- 2.2 Clientes sem nenhuma conta ativa
SELECT
    c.id,
    c.nome,
    c.email,
    c.cidade
FROM clientes c
WHERE c.ativo = true
  AND NOT EXISTS (
      SELECT 1 FROM contas ct
      WHERE ct.cliente_id = c.id
        AND ct.status = 'ativa'
  )
ORDER BY c.nome;


-- 2.3 Top 5 clientes com maior saldo consolidado
SELECT
    c.nome,
    c.email,
    SUM(ct.saldo) AS saldo_total
FROM clientes c
JOIN contas ct ON ct.cliente_id = c.id AND ct.status = 'ativa'
GROUP BY c.id, c.nome, c.email
ORDER BY saldo_total DESC
LIMIT 5;


-- =============================================================================
-- 3. CONTAS
-- =============================================================================

-- 3.1 Todas as contas com dados do cliente e da agência
SELECT
    ct.numero,
    ct.digito,
    ct.tipo,
    ct.status,
    ct.saldo,
    ct.limite,
    cl.nome   AS cliente,
    ag.codigo AS agencia,
    ag.cidade AS cidade_agencia
FROM contas ct
JOIN clientes cl ON cl.id = ct.cliente_id
JOIN agencias ag ON ag.id = ct.agencia_id
ORDER BY ct.status, cl.nome;


-- 3.2 Contas com saldo negativo (cheque especial utilizado)
SELECT
    ct.numero,
    cl.nome     AS cliente,
    ct.saldo,
    ct.limite,
    ct.saldo + ct.limite AS limite_disponivel
FROM contas ct
JOIN clientes cl ON cl.id = ct.cliente_id
WHERE ct.saldo < 0
ORDER BY ct.saldo;


-- 3.3 Distribuição de contas por tipo
SELECT
    tipo,
    COUNT(*)              AS quantidade,
    SUM(saldo)            AS saldo_total,
    AVG(saldo)            AS saldo_medio,
    MIN(saldo)            AS saldo_minimo,
    MAX(saldo)            AS saldo_maximo
FROM contas
WHERE status = 'ativa'
GROUP BY tipo
ORDER BY saldo_total DESC;


-- =============================================================================
-- 4. EXTRATO POR CONTA
-- =============================================================================

-- 4.1 Extrato completo da conta 00010001 (Ana Paula - corrente)
SELECT
    t.realizada_em::DATE                        AS data,
    t.tipo,
    t.status,
    CASE
        WHEN t.conta_destino_id = ct.id THEN  t.valor   -- entrada
        ELSE                                 -t.valor   -- saída
    END                                         AS valor,
    t.descricao,
    CASE
        WHEN t.conta_origem_id = ct.id  THEN 'saída'
        WHEN t.conta_destino_id = ct.id THEN 'entrada'
    END                                         AS direcao
FROM contas ct
JOIN transacoes t
    ON t.conta_origem_id = ct.id
    OR t.conta_destino_id = ct.id
WHERE ct.numero = '00010001'
ORDER BY t.realizada_em DESC;


-- 4.2 Extrato resumido por mês (conta 00030001 — Carla Mendes)
SELECT
    TO_CHAR(t.realizada_em, 'YYYY-MM') AS mes,
    COUNT(*)                            AS qtd_transacoes,
    SUM(CASE WHEN t.conta_destino_id = ct.id THEN  t.valor ELSE 0 END) AS total_entradas,
    SUM(CASE WHEN t.conta_origem_id  = ct.id THEN  t.valor ELSE 0 END) AS total_saidas
FROM contas ct
JOIN transacoes t
    ON t.conta_origem_id = ct.id
    OR t.conta_destino_id = ct.id
WHERE ct.numero = '00030001'
GROUP BY mes
ORDER BY mes DESC;


-- =============================================================================
-- 5. TRANSAÇÕES
-- =============================================================================

-- 5.1 Últimas 20 transações concluídas
SELECT
    t.id,
    t.realizada_em,
    t.tipo,
    t.valor,
    t.descricao,
    orig.numero  AS conta_origem,
    dest.numero  AS conta_destino
FROM transacoes t
LEFT JOIN contas orig ON orig.id = t.conta_origem_id
LEFT JOIN contas dest ON dest.id = t.conta_destino_id
WHERE t.status = 'concluida'
ORDER BY t.realizada_em DESC
LIMIT 20;


-- 5.2 Volume financeiro por tipo de transação
SELECT
    tipo,
    COUNT(*)        AS quantidade,
    SUM(valor)      AS volume_total,
    AVG(valor)      AS ticket_medio,
    MAX(valor)      AS maior_transacao
FROM transacoes
WHERE status = 'concluida'
GROUP BY tipo
ORDER BY volume_total DESC;


-- 5.3 Transações pendentes
SELECT
    t.id,
    t.tipo,
    t.valor,
    t.descricao,
    t.realizada_em,
    orig.numero AS conta_origem,
    cl.nome     AS cliente
FROM transacoes t
LEFT JOIN contas orig ON orig.id = t.conta_origem_id
LEFT JOIN clientes cl ON cl.id = orig.cliente_id
WHERE t.status = 'pendente'
ORDER BY t.realizada_em;


-- 5.4 Transferências realizadas (com dados de ambas as contas)
SELECT
    t.realizada_em::DATE            AS data,
    t.valor,
    cl_orig.nome                    AS remetente,
    orig.numero                     AS conta_origem,
    cl_dest.nome                    AS destinatario,
    dest.numero                     AS conta_destino,
    t.descricao
FROM transacoes t
JOIN contas  orig    ON orig.id    = t.conta_origem_id
JOIN contas  dest    ON dest.id    = t.conta_destino_id
JOIN clientes cl_orig ON cl_orig.id = orig.cliente_id
JOIN clientes cl_dest ON cl_dest.id = dest.cliente_id
WHERE t.tipo = 'transferencia'
ORDER BY t.realizada_em DESC;


-- =============================================================================
-- 6. AGÊNCIAS
-- =============================================================================

-- 6.1 Ranking de agências por saldo total
SELECT
    ag.codigo,
    ag.nome,
    ag.cidade,
    ag.estado,
    COUNT(ct.id)    AS total_contas,
    SUM(ct.saldo)   AS saldo_total
FROM agencias ag
LEFT JOIN contas ct ON ct.agencia_id = ag.id AND ct.status = 'ativa'
WHERE ag.ativa = true
GROUP BY ag.id, ag.codigo, ag.nome, ag.cidade, ag.estado
ORDER BY saldo_total DESC NULLS LAST;


-- 6.2 Clientes por agência
SELECT
    ag.codigo,
    ag.nome         AS agencia,
    ag.cidade,
    cl.nome         AS cliente,
    ct.tipo         AS tipo_conta,
    ct.saldo
FROM agencias ag
JOIN contas   ct ON ct.agencia_id  = ag.id
JOIN clientes cl ON cl.id          = ct.cliente_id
WHERE ct.status = 'ativa'
ORDER BY ag.codigo, cl.nome;


-- =============================================================================
-- 7. VIEW — usar a view pré-criada no schema
-- =============================================================================

-- 7.1 Resumo de clientes via view
SELECT *
FROM vw_resumo_clientes
ORDER BY saldo_total DESC NULLS LAST;


-- =============================================================================
-- 8. ANÁLISES AVANÇADAS
-- =============================================================================

-- 8.1 Clientes com maior volume de transações nos últimos 30 dias
SELECT
    cl.nome,
    COUNT(t.id)     AS qtd_transacoes,
    SUM(t.valor)    AS volume_total
FROM clientes cl
JOIN contas ct ON ct.cliente_id = cl.id
JOIN transacoes t
    ON (t.conta_origem_id = ct.id OR t.conta_destino_id = ct.id)
   AND t.realizada_em >= NOW() - INTERVAL '30 days'
WHERE t.status = 'concluida'
GROUP BY cl.id, cl.nome
ORDER BY volume_total DESC;


-- 8.2 Média de saldo por estado
SELECT
    cl.estado,
    COUNT(DISTINCT cl.id)   AS total_clientes,
    COUNT(ct.id)            AS total_contas,
    AVG(ct.saldo)           AS saldo_medio,
    SUM(ct.saldo)           AS saldo_total
FROM clientes cl
JOIN contas ct ON ct.cliente_id = cl.id AND ct.status = 'ativa'
GROUP BY cl.estado
ORDER BY saldo_total DESC;


-- 8.3 Frequência de transações por dia da semana
SELECT
    TO_CHAR(realizada_em, 'Day')    AS dia_semana,
    EXTRACT(DOW FROM realizada_em)  AS num_dia,
    COUNT(*)                        AS qtd_transacoes,
    SUM(valor)                      AS volume
FROM transacoes
WHERE status = 'concluida'
GROUP BY dia_semana, num_dia
ORDER BY num_dia;

-- =============================================================================
-- Fim das consultas de demonstração
-- =============================================================================
