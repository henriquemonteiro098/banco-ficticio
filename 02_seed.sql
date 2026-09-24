-- =============================================================================
-- 02_seed.sql — Banco Fictício
-- Dados de teste: 10 agências, 20 clientes, 30 contas, ~100 transações
-- Usa ON CONFLICT DO NOTHING — idempotente
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Agências
-- -----------------------------------------------------------------------------
INSERT INTO agencias (codigo, nome, cidade, estado, cep, telefone) VALUES
  ('0001-7', 'Agência Centro SP',        'São Paulo',        'SP', '01310-100', '(11) 3000-0001'),
  ('0002-5', 'Agência Paulista',          'São Paulo',        'SP', '01310-200', '(11) 3000-0002'),
  ('0003-3', 'Agência Centro RJ',         'Rio de Janeiro',   'RJ', '20040-020', '(21) 3000-0003'),
  ('0004-1', 'Agência Ipanema',           'Rio de Janeiro',   'RJ', '22420-010', '(21) 3000-0004'),
  ('0005-0', 'Agência Centro BH',         'Belo Horizonte',   'MG', '30130-110', '(31) 3000-0005'),
  ('0006-8', 'Agência Savassi',           'Belo Horizonte',   'MG', '30140-070', '(31) 3000-0006'),
  ('0007-6', 'Agência Centro POA',        'Porto Alegre',     'RS', '90010-150', '(51) 3000-0007'),
  ('0008-4', 'Agência Moinhos de Vento',  'Porto Alegre',     'RS', '90570-020', '(51) 3000-0008'),
  ('0009-2', 'Agência Centro Recife',     'Recife',           'PE', '50010-010', '(81) 3000-0009'),
  ('0010-6', 'Agência Boa Viagem',        'Recife',           'PE', '51020-010', '(81) 3000-0010')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------
INSERT INTO clientes (nome, cpf, email, telefone, data_nascimento, cidade, estado) VALUES
  ('Ana Paula Souza',         '12345678901', 'ana.souza@email.com',         '(11) 91111-0001', '1985-03-15', 'São Paulo',       'SP'),
  ('Bruno Costa Lima',        '23456789012', 'bruno.lima@email.com',        '(11) 91111-0002', '1990-07-22', 'São Paulo',       'SP'),
  ('Carla Mendes Ferreira',   '34567890123', 'carla.ferreira@email.com',    '(21) 91111-0003', '1978-11-30', 'Rio de Janeiro',  'RJ'),
  ('Diego Alves Ribeiro',     '45678901234', 'diego.ribeiro@email.com',     '(21) 91111-0004', '1995-01-08', 'Rio de Janeiro',  'RJ'),
  ('Elena Martins Castro',    '56789012345', 'elena.castro@email.com',      '(31) 91111-0005', '1982-06-18', 'Belo Horizonte',  'MG'),
  ('Felipe Rocha Santos',     '67890123456', 'felipe.santos@email.com',     '(31) 91111-0006', '1998-09-25', 'Belo Horizonte',  'MG'),
  ('Gabriela Pinto Dias',     '78901234567', 'gabriela.dias@email.com',     '(51) 91111-0007', '1973-04-12', 'Porto Alegre',    'RS'),
  ('Henrique Moura Cardoso',  '89012345678', 'henrique.cardoso@email.com',  '(51) 91111-0008', '1988-12-03', 'Porto Alegre',    'RS'),
  ('Isabela Cruz Teixeira',   '90123456789', 'isabela.teixeira@email.com',  '(81) 91111-0009', '1993-08-27', 'Recife',          'PE'),
  ('João Pedro Viana Neto',   '01234567890', 'joao.viana@email.com',        '(81) 91111-0010', '1970-02-14', 'Recife',          'PE'),
  ('Karen Lopes Freitas',     '11111222233', 'karen.freitas@email.com',     '(11) 91111-0011', '1987-05-09', 'São Paulo',       'SP'),
  ('Lucas Barbosa Gomes',     '22222333344', 'lucas.gomes@email.com',       '(11) 91111-0012', '1992-10-16', 'São Paulo',       'SP'),
  ('Mariana Faria Cunha',     '33333444455', 'mariana.cunha@email.com',     '(21) 91111-0013', '1980-07-31', 'Rio de Janeiro',  'RJ'),
  ('Nicolas Borges Araújo',   '44444555566', 'nicolas.araujo@email.com',    '(21) 91111-0014', '1997-03-20', 'Rio de Janeiro',  'RJ'),
  ('Olivia Campos Rezende',   '55555666677', 'olivia.rezende@email.com',    '(31) 91111-0015', '1975-09-05', 'Belo Horizonte',  'MG'),
  ('Pedro Henrique Macedo',   '66666777788', 'pedro.macedo@email.com',      '(31) 91111-0016', '1991-01-28', 'Belo Horizonte',  'MG'),
  ('Quésia Andrade Nogueira', '77777888899', 'quesia.nogueira@email.com',   '(51) 91111-0017', '1984-11-13', 'Porto Alegre',    'RS'),
  ('Rafael Duarte Monteiro',  '88888999900', 'rafael.monteiro@email.com',   '(81) 91111-0018', '1999-06-07', 'Recife',          'PE'),
  ('Sabrina Esteves Paiva',   '99999000011', 'sabrina.paiva@email.com',     '(11) 91111-0019', '1976-08-22', 'São Paulo',       'SP'),
  ('Tiago Correia Batista',   '10101010102', 'tiago.batista@email.com',     '(51) 91111-0020', '1989-04-01', 'Porto Alegre',    'RS')
ON CONFLICT (cpf) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Contas (referencia IDs das agências e clientes)
-- -----------------------------------------------------------------------------
INSERT INTO contas (numero, digito, tipo, status, saldo, limite, cliente_id, agencia_id) VALUES
  -- Ana Paula (cliente 1)
  ('00010001', '5', 'corrente',    'ativa',    8500.00,  2000.00, 1,  1),
  ('00010002', '3', 'poupanca',    'ativa',    15200.00, 0.00,    1,  1),
  -- Bruno Costa (cliente 2)
  ('00020001', '8', 'corrente',    'ativa',    3200.00,  1000.00, 2,  1),
  -- Carla Mendes (cliente 3)
  ('00030001', '2', 'corrente',    'ativa',    12000.00, 5000.00, 3,  3),
  ('00030002', '7', 'poupanca',    'ativa',    45600.00, 0.00,    3,  3),
  -- Diego Alves (cliente 4)
  ('00040001', '4', 'salario',     'ativa',    2800.00,  0.00,    4,  4),
  -- Elena Martins (cliente 5)
  ('00050001', '1', 'corrente',    'ativa',    6700.00,  3000.00, 5,  5),
  ('00050002', '9', 'investimento','ativa',    88000.00, 0.00,    5,  5),
  -- Felipe Rocha (cliente 6)
  ('00060001', '6', 'corrente',    'bloqueada',0.00,     500.00,  6,  6),
  -- Gabriela Pinto (cliente 7)
  ('00070001', '3', 'corrente',    'ativa',    4100.00,  1500.00, 7,  7),
  ('00070002', '8', 'poupanca',    'ativa',    9800.00,  0.00,    7,  7),
  -- Henrique Moura (cliente 8)
  ('00080001', '1', 'corrente',    'ativa',    500.00,   500.00,  8,  8),
  -- Isabela Cruz (cliente 9)
  ('00090001', '4', 'salario',     'ativa',    3900.00,  0.00,    9,  9),
  ('00090002', '2', 'poupanca',    'ativa',    22100.00, 0.00,    9,  9),
  -- João Pedro (cliente 10)
  ('00100001', '7', 'corrente',    'encerrada',0.00,     0.00,    10, 10),
  -- Karen Lopes (cliente 11)
  ('00110001', '5', 'corrente',    'ativa',    7300.00,  2500.00, 11, 2),
  -- Lucas Barbosa (cliente 12)
  ('00120001', '9', 'poupanca',    'ativa',    18400.00, 0.00,    12, 2),
  -- Mariana Faria (cliente 13)
  ('00130001', '3', 'corrente',    'ativa',    11500.00, 4000.00, 13, 3),
  -- Nicolas Borges (cliente 14)
  ('00140001', '6', 'salario',     'ativa',    2100.00,  0.00,    14, 4),
  -- Sabrina Esteves (cliente 19)
  ('00190001', '2', 'investimento','ativa',    125000.00,0.00,    19, 1),
  -- Tiago Correia (cliente 20)
  ('00200001', '4', 'corrente',    'ativa',    950.00,   800.00,  20, 8),
  -- Olivia Campos (cliente 15) — sem conta ativa (para demonstrar consulta)
  ('00150001', '8', 'corrente',    'inativa',  0.00,     0.00,    15, 5)
ON CONFLICT (numero) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Transações
-- -----------------------------------------------------------------------------
INSERT INTO transacoes (tipo, status, valor, descricao, conta_origem_id, conta_destino_id, realizada_em) VALUES
  -- Depósitos iniciais
  ('deposito',      'concluida',  8500.00, 'Depósito inicial',               NULL, 1,  NOW() - INTERVAL '6 months'),
  ('deposito',      'concluida', 15200.00, 'Depósito poupança',              NULL, 2,  NOW() - INTERVAL '5 months'),
  ('deposito',      'concluida',  3200.00, 'Depósito salário',               NULL, 3,  NOW() - INTERVAL '6 months'),
  ('deposito',      'concluida', 12000.00, 'Abertura de conta',              NULL, 4,  NOW() - INTERVAL '8 months'),
  ('deposito',      'concluida', 45600.00, 'Poupança reserva emergência',    NULL, 5,  NOW() - INTERVAL '8 months'),
  ('deposito',      'concluida',  2800.00, 'Primeiro salário',               NULL, 6,  NOW() - INTERVAL '1 month'),
  ('deposito',      'concluida',  6700.00, 'Depósito inicial',               NULL, 7,  NOW() - INTERVAL '4 months'),
  ('deposito',      'concluida', 88000.00, 'Aporte investimento',            NULL, 8,  NOW() - INTERVAL '2 years'),

  -- Transferências entre contas
  ('transferencia', 'concluida',  1500.00, 'PIX para Bruno',                 1,  3,  NOW() - INTERVAL '2 months'),
  ('transferencia', 'concluida',  500.00,  'TED para conta poupança',        3,  2,  NOW() - INTERVAL '45 days'),
  ('transferencia', 'concluida',  2000.00, 'Transferência entre contas',     4,  5,  NOW() - INTERVAL '30 days'),
  ('transferencia', 'concluida',  300.00,  'PIX Karen para Lucas',           16, 17, NOW() - INTERVAL '10 days'),
  ('transferencia', 'concluida',  800.00,  'TED Mariana para Nicolas',       18, 19, NOW() - INTERVAL '5 days'),
  ('transferencia', 'concluida',  1200.00, 'PIX Henrique para Isabela',      12, 13, NOW() - INTERVAL '3 days'),
  ('transferencia', 'concluida',  250.00,  'Tiago para Ana Paula',           21, 1,  NOW() - INTERVAL '1 day'),

  -- Saques
  ('saque',         'concluida',  200.00,  'Saque caixa eletrônico',         1,  NULL, NOW() - INTERVAL '20 days'),
  ('saque',         'concluida',  100.00,  'Saque 24h',                      3,  NULL, NOW() - INTERVAL '15 days'),
  ('saque',         'concluida',  500.00,  'Saque agência',                  7,  NULL, NOW() - INTERVAL '7 days'),
  ('saque',         'concluida',  150.00,  'Saque caixa 24h',                10, NULL, NOW() - INTERVAL '2 days'),
  ('saque',         'concluida',  400.00,  'Retirada em espécie',            16, NULL, NOW() - INTERVAL '4 days'),

  -- Pagamentos
  ('pagamento',     'concluida',  189.90,  'Conta de luz — ENEL',            1,  NULL, NOW() - INTERVAL '25 days'),
  ('pagamento',     'concluida',  89.90,   'Internet — Vivo',                3,  NULL, NOW() - INTERVAL '20 days'),
  ('pagamento',     'concluida',  450.00,  'Cartão de crédito',              4,  NULL, NOW() - INTERVAL '5 days'),
  ('pagamento',     'concluida',  1200.00, 'Aluguel — boleto',               7,  NULL, NOW() - INTERVAL '30 days'),
  ('pagamento',     'concluida',  350.00,  'Plano de saúde',                 10, NULL, NOW() - INTERVAL '15 days'),
  ('pagamento',     'concluida',  75.00,   'Streaming + assinaturas',        16, NULL, NOW() - INTERVAL '8 days'),
  ('pagamento',     'concluida',  2800.00, 'IPTU parcela',                   18, NULL, NOW() - INTERVAL '2 months'),

  -- Tarifas bancárias
  ('tarifa',        'concluida',  12.00,   'Manutenção mensal — Agosto',     1,  NULL, NOW() - INTERVAL '2 months'),
  ('tarifa',        'concluida',  12.00,   'Manutenção mensal — Setembro',   1,  NULL, NOW() - INTERVAL '1 month'),
  ('tarifa',        'concluida',  12.00,   'Manutenção mensal',              3,  NULL, NOW() - INTERVAL '1 month'),
  ('tarifa',        'concluida',  12.00,   'Manutenção mensal',              7,  NULL, NOW() - INTERVAL '1 month'),
  ('tarifa',        'concluida',   5.00,   'Tarifa PIX lote',                16, NULL, NOW() - INTERVAL '10 days'),

  -- Estorno
  ('estorno',       'concluida',  189.90,  'Estorno cobrança indevida ENEL', NULL, 1, NOW() - INTERVAL '22 days'),

  -- Transações recentes (últimas 24h)
  ('deposito',      'concluida',  3500.00, 'Salário referente a setembro',   NULL, 3,  NOW() - INTERVAL '2 hours'),
  ('pagamento',     'pendente',   980.00,  'Financiamento — parcela 12/48',  10, NULL, NOW() - INTERVAL '30 minutes'),
  ('transferencia', 'pendente',   600.00,  'PIX agendado — amanhã',          1,  13,  NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Usuários (Acesso ao Sistema e Interface Web)
-- -----------------------------------------------------------------------------
INSERT INTO usuarios (login, senha, nome, papel, cliente_id) VALUES
  ('admin',          'admin',  'Administrador do Banco', 'admin',   NULL),
  ('ana.souza',      '123456', 'Ana Paula Souza',        'cliente', 1),
  ('bruno.lima',     '123456', 'Bruno Costa Lima',       'cliente', 2),
  ('carla.ferreira', '123456', 'Carla Mendes Ferreira', 'cliente', 3),
  ('diego.ribeiro',  '123456', 'Diego Alves Ribeiro',    'cliente', 4),
  ('elena.castro',   '123456', 'Elena Martins Castro',   'cliente', 5)
ON CONFLICT (login) DO NOTHING;

-- =============================================================================
-- Seed aplicado com sucesso!
-- =============================================================================
