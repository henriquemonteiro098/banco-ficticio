# TEST_INFRA.md — Testing Infrastructure & Methodology
**Project**: Banco Fictício S.A.  
**Phase**: Phase 2 — Command Bar, Banking AI, 1k Visual Assets, Humanizer & GitHub Sync  
**Framework**: Native Node.js Test Runner (`node:test` & `node:assert/strict`)  
**Target Environment**: Node.js v26.8.2, Express API, PostgreSQL 18.6 (`banco_ficticio`)  

---

## 1. Overview & Architecture

This document formalizes the multi-tier opaque-box End-to-End (E2E) testing methodology for Banco Fictício. The test suite validates all functional, performance, security, and linguistic requirements defined in `ORIGINAL_REQUEST.md` (§ 2026-09-24T00:38:04Z) and `PROJECT.md`.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BANCO FICTÍCIO TEST TIERS                       │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 1: Feature Coverage (Core Commands & Natural Language Routing)    │
│  • /saldo, /extrato, /pix, /contas, /agencias, /ajuda                  │
│  • Natural language questions with entity extraction and real SQL data  │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 2: Boundaries, Edge Cases & Latency Under 500ms                   │
│  • Sub-500ms HTTP round-trip verification                              │
│  • Malformed payloads, SQL injection resilience, extreme lengths        │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 3: Cross-Feature Combinations & State Consistency                │
│  • Real-time transfers and immediate balance & statement updates       │
│  • PIX suggestions excluding self-account, cross-client isolation      │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 4: Real-World Scenarios, Custody & Humanizer Linguistic Audit    │
│  • Global custody reconciliation with PostgreSQL aggregates            │
│  • Strict ban on AI chatbot clichés, sycophancy, and robotic idioms   │
├────────────────────────────────────────────────────────────────────────┤
│  Visual Assets Tier: 1k Asset Fidelity & Layout Integrity              │
│  • Texture (1024x645), Banner (1024x384), Avatars (>=512x512)         │
│  • Anti-glitch checks, file size budgets (<500KB), CSS integration     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 4-Tier Testing Methodology (+ Assets Tier)

### Tier 1: Feature Coverage (`test/tier1_features.test.js`)
- **Objective**: Verify that every required command and supported natural language inquiry returns valid, structured, and factual data directly from PostgreSQL.
- **Scope**:
  - `POST /api/assistente/consulta` with:
    - `/saldo`: returns current balance, credit limit, and total available for the active account.
    - `/extrato`: returns recent account transactions with amounts, directions (`entrada`/`saida`), descriptions, and dates.
    - `/pix`: returns recipient suggestions from other active accounts (excluding the originating account).
    - `/contas`: lists all accounts linked to the active client.
    - `/agencias`: lists active bank branches with branch codes, locations, and contact info.
    - `/ajuda`: catalogs all available slash commands and example natural language questions.
    - Natural language: *"Qual o saldo da Ana Paula?"* -> dynamically extracts client name and returns real account balances.
    - Natural language: *"Quanto temos sob custódia no banco?"* -> executes live aggregation of active accounts.
    - Natural language: *"Qual foi a última transferência?"* -> queries the most recent transfer record.
- **Authoritative Oracles**:
  - PostgreSQL database `banco_ficticio` (seed dataset `02_seed.sql`).
  - Interface contracts defined in `PROJECT.md` § Interface Contracts.

### Tier 2: Boundaries, Latency & Edge Conditions (`test/tier2_boundaries.test.js`)
- **Objective**: Verify strict latency budgets and resilience under abnormal or hostile inputs.
- **Scope**:
  - **Latency SLA (<500ms)**: Every command and natural language query must execute and return within 500ms end-to-end. Latency is measured from HTTP request start to response completion.
  - **Empty and Whitespace Inputs**: Requests with empty string `""`, missing `mensagem` property, or whitespace strings (`"   "`).
  - **Invalid Commands**: Unrecognized slash commands (e.g. `/desconhecido`, `/foo`) returning polite fallbacks and guiding the user to `/ajuda`.
  - **Unrecognized Inquiries**: Out-of-domain questions (e.g. *"Qual o clima hoje em Marte?"*) returning professional fallback guidance without crashing.
  - **Non-Existent Entities**: Requests specifying non-existent `conta_id` (e.g. `999999`) or `cliente_id` handled gracefully without unhandled 500 errors.
  - **SQL Injection Prevention**: Malicious SQL injection payloads in `mensagem` (e.g. `'; DROP TABLE contas; --`, `' OR '1'='1`) executed safely via parameterized queries without syntax errors or data tampering.
  - **Oversized Payloads**: Large text inputs (>5,000 characters) processed safely without buffer overflows.

### Tier 3: Cross-Feature Combinations & State Consistency (`test/tier3_combinations.test.js`)
- **Objective**: Ensure that independent operations correctly affect downstream queries and state across features.
- **Scope**:
  - **Transfer & Balance Synchronization**:
    1. Query `/saldo` on Account 1 (`00010001-5`).
    2. Execute a real financial transfer (`POST /api/cliente/transferir`) from Account 1 to Account 3 (`00020001-8`).
    3. Query `/saldo` again on Account 1 and verify balance reduced by exact transfer amount.
    4. Query `/saldo` on Account 3 and verify balance increased by exact transfer amount.
    5. Query `/extrato` on Account 1 and verify new outgoing transaction appears with negative direction.
    6. Query natural language *"Qual foi a última transferência?"* and verify it reports this latest transfer.
    7. Execute reverse transfer to leave the database in its initial state (test isolation).
  - **Account Context Switching**: Ensure queries for Account 1 vs. Account 2 (Poupança) return distinct and correct balances for the same client.
  - **PIX Suggestion Exclusion**: Verify PIX suggestion engine never suggests the originating account itself as a recipient.

### Tier 4: Real-World Scenarios, Custody & Humanizer Linguistic Checks (`test/tier4_real_world.test.js`)
- **Objective**: Guarantee absolute financial integrity and enforce strict professional Portuguese communication standards.
- **Scope**:
  - **Custody Reconciliation**: Sum of balances across all active accounts from `POST /api/assistente/consulta` (*"Quanto temos sob custódia no banco?"*) reconciled against `GET /api/banco/dashboard` and direct database aggregate `SELECT SUM(saldo) FROM contas WHERE status = 'ativa'`.
  - **Humanizer Linguistic Audit**:
    - Every assistant output audited against the Wikipedia AI Cleanup / Humanizer guidelines.
    - Prohibited AI clichés:
      - `Como modelo de IA`, `Como inteligência artificial`, `Como modelo de linguagem`
      - `Certamente!`, `Com certeza!`, `Com todo prazer!`
      - `Olá! Sou seu assistente bancário com inteligência artificial`
      - `Excelente pergunta!`, `Ótima pergunta!`, `Perfeito!`
      - `Espero ter ajudado!`, `Qualquer dúvida estou à disposição`, `Tenha um excelente dia!`
      - Buzzwords: `robusto ecossistema financeiro integrado`, `soluções de ponta`
    - Punctuation & Style: Straight quotes only, no artificial em dashes (`—`) as crutches, proper currency formatting (`R$ 8.450,00`).

### Visual Assets Tier (`test/assets.test.js`)
- **Objective**: Validate resolution, format, anti-glitch rules, and CSS integration for visual assets.
- **Scope**:
  - `public/assets/cartao_black_texture.png`: Width >= 1024px (1024x645), ratio ~1.586:1, size < 500KB.
  - `public/assets/banner_cofre_tesouraria.png`: Width >= 1024px (1024x384), size < 500KB.
  - `public/assets/avatars/`: High-resolution avatars (`avatar-1.png` to `avatar-8.png`), width >= 512px, size < 150KB.
  - `public/assets/operacoes/`: Operation badges (`op-pix.png`, `op-transferencia.png`, `op-deposito.png`, etc.).
  - Responsive CSS integration in `public/styles.css` and `public/index.html`.

---

## 3. Test Runner & Execution Commands

The test suite runs on Node.js native test runner without third-party test dependencies:

```bash
# Run all test suites
node --test test/*.test.js

# Run specific tiers
node --test test/tier1_features.test.js
node --test test/tier2_boundaries.test.js
node --test test/tier3_combinations.test.js
node --test test/tier4_real_world.test.js
node --test test/assets.test.js
```

---

## 4. Test Configuration & Environment Variables

- `TEST_BASE_URL`: Base URL of the running API (defaults to `http://127.0.0.1:3000`).
- `PGDATABASE`: Database name (defaults to `banco_ficticio`).
- `PGHOST`: Host for PostgreSQL connection (defaults to `127.0.0.1`).
- `PGPORT`: Port for PostgreSQL connection (defaults to `5432`).
- `PGUSER`: Database user (defaults to system user).

All tests are independent, idempotent, and non-destructive.
