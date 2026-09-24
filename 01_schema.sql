-- =============================================================================
-- 01_schema.sql — Banco Fictício
-- Schema completo: tabelas, tipos, constraints e índices
-- Idempotente: pode ser re-executado sem erros
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Limpar schema anterior (ordem inversa de dependências)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS usuarios      CASCADE;
DROP TABLE IF EXISTS transacoes    CASCADE;
DROP TABLE IF EXISTS contas        CASCADE;
DROP TABLE IF EXISTS clientes      CASCADE;
DROP TABLE IF EXISTS agencias      CASCADE;

DROP TYPE IF EXISTS tipo_conta        CASCADE;
DROP TYPE IF EXISTS status_conta      CASCADE;
DROP TYPE IF EXISTS tipo_transacao    CASCADE;
DROP TYPE IF EXISTS status_transacao  CASCADE;

-- -----------------------------------------------------------------------------
-- ENUMs
-- -----------------------------------------------------------------------------
CREATE TYPE tipo_conta AS ENUM (
    'corrente',
    'poupanca',
    'salario',
    'investimento'
);

CREATE TYPE status_conta AS ENUM (
    'ativa',
    'inativa',
    'bloqueada',
    'encerrada'
);

CREATE TYPE tipo_transacao AS ENUM (
    'deposito',
    'saque',
    'transferencia',
    'pagamento',
    'estorno',
    'tarifa'
);

CREATE TYPE status_transacao AS ENUM (
    'pendente',
    'concluida',
    'cancelada',
    'estornada'
);

-- -----------------------------------------------------------------------------
-- Tabela: agencias
-- -----------------------------------------------------------------------------
CREATE TABLE agencias (
    id              SERIAL          PRIMARY KEY,
    codigo          VARCHAR(10)     NOT NULL UNIQUE,
    nome            VARCHAR(100)    NOT NULL,
    cidade          VARCHAR(80)     NOT NULL,
    estado          CHAR(2)         NOT NULL,
    cep             VARCHAR(9),
    telefone        VARCHAR(20),
    ativa           BOOLEAN         NOT NULL DEFAULT true,
    criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  agencias         IS 'Agências bancárias do Banco Fictício';
COMMENT ON COLUMN agencias.codigo  IS 'Código único da agência (ex: 0001-7)';
COMMENT ON COLUMN agencias.estado  IS 'UF — duas letras maiúsculas';

-- -----------------------------------------------------------------------------
-- Tabela: clientes
-- -----------------------------------------------------------------------------
CREATE TABLE clientes (
    id              SERIAL          PRIMARY KEY,
    nome            VARCHAR(150)    NOT NULL,
    cpf             CHAR(11)        NOT NULL UNIQUE,
    email           VARCHAR(200)    NOT NULL UNIQUE,
    telefone        VARCHAR(20),
    data_nascimento DATE,
    endereco        TEXT,
    cidade          VARCHAR(80),
    estado          CHAR(2),
    cep             VARCHAR(9),
    ativo           BOOLEAN         NOT NULL DEFAULT true,
    criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  clientes     IS 'Clientes cadastrados no banco';
COMMENT ON COLUMN clientes.cpf IS 'Apenas dígitos, sem pontuação';

-- -----------------------------------------------------------------------------
-- Tabela: usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios (
    id              SERIAL          PRIMARY KEY,
    login           VARCHAR(50)     NOT NULL UNIQUE,
    senha           VARCHAR(255)    NOT NULL,
    nome            VARCHAR(100)    NOT NULL,
    papel           VARCHAR(20)     NOT NULL DEFAULT 'cliente', -- 'admin' ou 'cliente'
    cliente_id      INT             REFERENCES clientes(id) ON DELETE SET NULL,
    ativo           BOOLEAN         NOT NULL DEFAULT true,
    criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  usuarios       IS 'Usuários do sistema bancário (admin e clientes)';
COMMENT ON COLUMN usuarios.login IS 'Login único para autenticação';
COMMENT ON COLUMN usuarios.papel IS 'Papel do usuário: admin ou cliente';

-- -----------------------------------------------------------------------------
-- Tabela: contas
-- -----------------------------------------------------------------------------
CREATE TABLE contas (
    id              SERIAL          PRIMARY KEY,
    numero          VARCHAR(20)     NOT NULL UNIQUE,
    digito          CHAR(1)         NOT NULL,
    tipo            tipo_conta      NOT NULL,
    status          status_conta    NOT NULL DEFAULT 'ativa',
    saldo           NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
    limite          NUMERIC(15, 2)           DEFAULT 0.00,
    cliente_id      INT             NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    agencia_id      INT             NOT NULL REFERENCES agencias(id) ON DELETE RESTRICT,
    aberta_em       DATE            NOT NULL DEFAULT CURRENT_DATE,
    encerrada_em    DATE,
    criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_saldo_nao_negativo
        CHECK (tipo != 'corrente' OR saldo >= -limite),
    CONSTRAINT chk_encerrada_apos_abertura
        CHECK (encerrada_em IS NULL OR encerrada_em > aberta_em)
);

COMMENT ON TABLE  contas        IS 'Contas bancárias vinculadas a clientes e agências';
COMMENT ON COLUMN contas.saldo  IS 'Saldo atual em reais (R$)';
COMMENT ON COLUMN contas.limite IS 'Limite de crédito / cheque especial';

-- -----------------------------------------------------------------------------
-- Tabela: transacoes
-- -----------------------------------------------------------------------------
CREATE TABLE transacoes (
    id                  BIGSERIAL       PRIMARY KEY,
    tipo                tipo_transacao  NOT NULL,
    status              status_transacao NOT NULL DEFAULT 'concluida',
    valor               NUMERIC(15, 2)  NOT NULL CHECK (valor > 0),
    descricao           TEXT,
    conta_origem_id     INT             REFERENCES contas(id) ON DELETE SET NULL,
    conta_destino_id    INT             REFERENCES contas(id) ON DELETE SET NULL,
    referencia_externa  VARCHAR(100),   -- número do boleto, código PIX, etc.
    realizada_em        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    criado_em           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_transacao_tem_conta
        CHECK (conta_origem_id IS NOT NULL OR conta_destino_id IS NOT NULL),
    CONSTRAINT chk_transferencia_contas_distintas
        CHECK (conta_origem_id IS DISTINCT FROM conta_destino_id)
);

COMMENT ON TABLE  transacoes              IS 'Movimentações financeiras entre contas';
COMMENT ON COLUMN transacoes.valor        IS 'Valor absoluto da transação (sempre positivo)';
COMMENT ON COLUMN transacoes.referencia_externa IS 'Código externo: boleto, PIX, TED, etc.';

-- -----------------------------------------------------------------------------
-- Índices de performance
-- -----------------------------------------------------------------------------
CREATE INDEX idx_contas_cliente_id     ON contas      (cliente_id);
CREATE INDEX idx_contas_agencia_id     ON contas      (agencia_id);
CREATE INDEX idx_contas_status         ON contas      (status);
CREATE INDEX idx_transacoes_origem     ON transacoes  (conta_origem_id);
CREATE INDEX idx_transacoes_destino    ON transacoes  (conta_destino_id);
CREATE INDEX idx_transacoes_realizada  ON transacoes  (realizada_em DESC);
CREATE INDEX idx_transacoes_tipo       ON transacoes  (tipo);
CREATE INDEX idx_clientes_cpf          ON clientes    (cpf);
CREATE INDEX idx_clientes_email        ON clientes    (email);
CREATE INDEX idx_usuarios_login        ON usuarios    (login);
CREATE INDEX idx_usuarios_cliente_id   ON usuarios    (cliente_id);

-- -----------------------------------------------------------------------------
-- Trigger: atualizar coluna atualizado_em automaticamente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agencias_atualizado_em
    BEFORE UPDATE ON agencias
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

CREATE TRIGGER trg_clientes_atualizado_em
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

CREATE TRIGGER trg_contas_atualizado_em
    BEFORE UPDATE ON contas
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

CREATE TRIGGER trg_usuarios_atualizado_em
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- -----------------------------------------------------------------------------
-- View: resumo de contas por cliente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_resumo_clientes AS
SELECT
    c.id                                AS cliente_id,
    c.nome                              AS cliente_nome,
    c.email,
    COUNT(ct.id)                        AS total_contas,
    SUM(ct.saldo)                       AS saldo_total,
    COUNT(ct.id) FILTER (WHERE ct.status = 'ativa')  AS contas_ativas
FROM clientes c
LEFT JOIN contas ct ON ct.cliente_id = c.id
GROUP BY c.id, c.nome, c.email;

COMMENT ON VIEW vw_resumo_clientes IS 'Consolidado de contas e saldo por cliente';

-- =============================================================================
-- Schema aplicado com sucesso!
-- =============================================================================
