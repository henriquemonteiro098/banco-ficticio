#!/usr/bin/env bash
# =============================================================================
# setup.sh — Banco Fictício
# Bootstrap completo do ambiente de desenvolvimento
# Idempotente: pode ser executado várias vezes sem erros
# =============================================================================
set -euo pipefail

# ─── Cores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}  ✔  ${RESET}$*"; }
info() { echo -e "${BLUE}  ℹ  ${RESET}$*"; }
warn() { echo -e "${YELLOW}  ⚠  ${RESET}$*"; }
fail() { echo -e "${RED}  ✘  ${RESET}$*"; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }

# ─── Configurações (auto-detectadas, podem ser sobrescritas por variáveis de ambiente) ──
DB_NAME="${BANCO_DB_NAME:-banco_ficticio}"
DB_PORT="${BANCO_DB_PORT:-5432}"
DB_HOST="${BANCO_DB_HOST:-127.0.0.1}"

# Detecta usuário PostgreSQL: prefere $BANCO_DB_USER, depois $USER, depois whoami
DB_USER="${BANCO_DB_USER:-${USER:-$(whoami)}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Header ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║          🏦  Banco Fictício — Setup              ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# =============================================================================
# PASSO 1 — Verificar PostgreSQL instalado
# =============================================================================
step "Verificando instalação do PostgreSQL..."

if ! command -v psql &>/dev/null; then
    fail "psql não encontrado. Instale com: brew install postgresql@18"
fi

PG_VERSION=$(psql --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
ok "PostgreSQL ${PG_VERSION} encontrado em $(command -v psql)"

# =============================================================================
# PASSO 2 — Verificar serviço rodando
# =============================================================================
step "Verificando serviço PostgreSQL..."

if ! pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -q 2>/dev/null; then
    warn "PostgreSQL não está respondendo na porta ${DB_PORT}. Tentando iniciar..."
    if command -v brew &>/dev/null; then
        # Detecta a versão major para iniciar o serviço correto
        PG_MAJOR="${PG_VERSION%%.*}"
        brew services start "postgresql@${PG_MAJOR}" 2>/dev/null \
            || brew services start postgresql 2>/dev/null \
            || fail "Não foi possível iniciar o PostgreSQL. Execute manualmente: brew services start postgresql@${PG_MAJOR}"
        sleep 3
    else
        fail "PostgreSQL não está rodando. Inicie o serviço manualmente."
    fi
fi

pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -q \
    && ok "PostgreSQL está rodando em ${DB_HOST}:${DB_PORT}" \
    || fail "PostgreSQL ainda não responde em ${DB_HOST}:${DB_PORT}"

# =============================================================================
# PASSO 3 — Identificar ambiente
# =============================================================================
step "Identificando ambiente PostgreSQL..."

# Verifica se o usuário existe
if ! psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "SELECT 1;" &>/dev/null; then
    warn "Usuário '${DB_USER}' não conectou. Tentando com 'postgres'..."
    DB_USER="postgres"
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "SELECT 1;" &>/dev/null \
        || fail "Não foi possível conectar ao PostgreSQL. Verifique as credenciais."
fi

ok "Usuário PostgreSQL: ${BOLD}${DB_USER}${RESET}"
ok "Porta            : ${BOLD}${DB_PORT}${RESET}"
ok "Host             : ${BOLD}${DB_HOST}${RESET}"

# Lista databases
info "Databases disponíveis:"
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
    -c "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;" \
    --tuples-only 2>/dev/null | sed 's/^ */    - /'

# =============================================================================
# PASSO 4 — Criar database se não existir
# =============================================================================
step "Verificando database '${DB_NAME}'..."

DB_EXISTS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
    --tuples-only -c "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" 2>/dev/null | tr -d '[:space:]')

if [ "${DB_EXISTS}" = "1" ]; then
    ok "Database '${DB_NAME}' já existe."
else
    info "Criando database '${DB_NAME}'..."
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
        -c "CREATE DATABASE ${DB_NAME} WITH ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0;" \
        || fail "Falha ao criar database '${DB_NAME}'"
    ok "Database '${DB_NAME}' criado com sucesso."
fi

# =============================================================================
# PASSO 5 — Aplicar schema
# =============================================================================
step "Aplicando schema (01_schema.sql)..."

SCHEMA_FILE="${SCRIPT_DIR}/01_schema.sql"
[ -f "${SCHEMA_FILE}" ] || fail "Arquivo não encontrado: ${SCHEMA_FILE}"

psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    -f "${SCHEMA_FILE}" -v ON_ERROR_STOP=1 \
    && ok "Schema aplicado com sucesso." \
    || fail "Erro ao aplicar schema. Verifique 01_schema.sql."

# =============================================================================
# PASSO 6 — Aplicar seed
# =============================================================================
step "Aplicando dados de teste (02_seed.sql)..."

SEED_FILE="${SCRIPT_DIR}/02_seed.sql"
[ -f "${SEED_FILE}" ] || fail "Arquivo não encontrado: ${SEED_FILE}"

psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    -f "${SEED_FILE}" -v ON_ERROR_STOP=1 \
    && ok "Seed aplicado com sucesso." \
    || fail "Erro ao aplicar seed. Verifique 02_seed.sql."

# =============================================================================
# PASSO 7 — Validação das tabelas
# =============================================================================
step "Validando dados inseridos..."

run_count() {
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
        --tuples-only -c "SELECT COUNT(*) FROM $1;" 2>/dev/null | tr -d '[:space:]'
}

COUNT_AG=$(run_count agencias)
COUNT_CL=$(run_count clientes)
COUNT_CT=$(run_count contas)
COUNT_TR=$(run_count transacoes)
COUNT_US=$(run_count usuarios)

ok "agencias   : ${COUNT_AG} registros"
ok "clientes   : ${COUNT_CL} registros"
ok "contas     : ${COUNT_CT} registros"
ok "transacoes : ${COUNT_TR} registros"
ok "usuarios   : ${COUNT_US} registros (admin:admin disponível)"

# Verifica saldo total
SALDO_TOTAL=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --tuples-only -c "SELECT TO_CHAR(SUM(saldo), 'FM999G999G990D00') FROM contas WHERE status = 'ativa';" \
    2>/dev/null | tr -d '[:space:]')
ok "Saldo total em contas ativas: R\$ ${SALDO_TOTAL}"

# =============================================================================
# RESUMO FINAL
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║         ✅  Ambiente configurado com sucesso!    ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Conexão PostgreSQL:${RESET}"
echo -e "    Host     : ${CYAN}${DB_HOST}${RESET}"
echo -e "    Porta    : ${CYAN}${DB_PORT}${RESET}"
echo -e "    Database : ${CYAN}${DB_NAME}${RESET}"
echo -e "    Usuário  : ${CYAN}${DB_USER}${RESET}"
echo ""
echo -e "  ${BOLD}Interface Visual (Web App):${RESET}"
echo -e "    Iniciar servidor: ${CYAN}npm start${RESET}"
echo -e "    Acessar no navegador: ${CYAN}http://localhost:3000${RESET}"
echo -e "    Credenciais de Administrador: ${CYAN}admin${RESET} / ${CYAN}admin${RESET}"
echo ""
echo -e "  ${BOLD}Próximos passos:${RESET}"
echo -e "    1. Inicie a interface web: ${CYAN}npm start${RESET}"
echo -e "    2. Abra o projeto no VS Code: ${CYAN}code .${RESET}"
echo -e "    3. Conecte via SQLTools → banco_ficticio (local)"
echo -e "    4. Execute as consultas em ${CYAN}03_consultas.sql${RESET}"
echo ""
echo -e "  ${BOLD}pgAdmin 4:${RESET}"
echo -e "    Host: 127.0.0.1 | Porta: ${DB_PORT} | DB: ${DB_NAME} | User: ${DB_USER}"
echo ""
