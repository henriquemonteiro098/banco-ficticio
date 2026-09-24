# Project: Banco Fictício (Phase 3 — Fintech Package: Loans, Digital Receipts, Admin Onboarding & Localhost)

## Architecture
- **Frontend**: Vanilla JS (ES6+ async/await), HTML5 semantic markup, TailwindCSS (dark mode), FontAwesome 6, Chart.js, served from `public/`.
- **Backend**: Node.js + Express 4.21.2 (`server.js`), static serving of `public/` and `public/assets/`, REST API for banking operations.
- **Database**: PostgreSQL 18.6 on `127.0.0.1:5432`, database `banco_ficticio`, native connection pool via `pg` (10 connections). Tables: `agencias`, `clientes`, `contas`, `transacoes`, `usuarios`.
- **AI Assistant & Command Engine**: Real-time intent routing and SQL parameterized query engine answering `/` commands and natural language inquiries in <500ms (including `/emprestimo`).
- **Financial Calculation Engine**: Price amortization system at 1.89% a.m. (CET: 25.19% a.a.) with cent precision.
- **Receipts & Cryptographic Attestation**: Deterministic SHA-256 official SPB authentication codes (`XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX`) with protocol generation (`BF-YYYY-XXXXXXXX`).
- **Print / PDF Engine**: Dedicated `@media print` CSS rules isolating the banking receipt on white A4 format with clean layout.
- **Onboarding Engine**: Atomic PostgreSQL transaction provisioning `clientes`, auto-generating 8-digit account numbers + check digit in `contas`, provisioning credentials in `usuarios` (default password `123456`), and logging initial deposits.
- **Testing & Tooling**: Node.js native test runner (`node --test`), automated endpoint and business rule verification.
- **VCS**: Git tracking on branch `main`, remote `origin` (`https://github.com/henriquemonteiro098/banco-ficticio.git`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Loan Price Calculation & Amortization | 1.89% monthly interest rate calculation, monthly installment, CET | M1 | R1, Survey 1 |
| 2 | Loan Simulation Endpoint | `POST /api/cliente/emprestimo/simular` with validation (R$ 500-50.000, 6-48 months) | M1 | R1, Survey 1 |
| 3 | Loan Hiring Atomic Transaction | `POST /api/cliente/emprestimo/contratar` with `BEGIN...COMMIT`, lock on `contas`, credit balance, insert `transacoes` | M1 | R1, Survey 1 |
| 4 | Client Area Loan Simulator UI | Interactive sliders and inputs for amount and term, real-time calculations, 1-click hiring | M1 | R1, Survey 1 |
| 5 | Chat IA `/emprestimo` & Natural Language | Fast command `/emprestimo [valor] [prazo]`, NL loan simulation, interactive chat card | M1 | R1, Survey 1 |
| 6 | Transaction Receipt Endpoint | `GET /api/transacoes/:id/comprovante` with joined sender, recipient, agency, and SHA-256 auth code | M2 | R2, Survey 2 |
| 7 | Official Digital Receipt Modal | Official banking layout modal with bank header, badges, details, and security stamps | M2 | R2, Survey 2 |
| 8 | Bank Statement Clickable Integration | "Ver Comprovante" clickable on any bank statement item + receipt button | M2 | R2, Survey 2 |
| 9 | Receipt Print / PDF Styling | Clean `@media print` rules isolating receipt on A4 white sheet without dashboard background | M2 | R2, Survey 2 |
| 10 | Copy Receipt Action | Formatted text representation copied to clipboard with fallback | M2 | R2, Survey 2 |
| 11 | Admin Account Onboarding Modal | Modal and form in "O Banco" tab for registering new client and account | M3 | R3, Survey 3 |
| 12 | Admin Onboarding Backend Route | `POST /api/banco/clientes` creating `clientes`, `contas`, `usuarios` (pass `123456`), optional initial deposit | M3 | R3, Survey 3 |
| 13 | Account Number & Digit Generator | Automatic generation of 8-digit account number and 1-digit check digit | M3 | R3, Survey 3 |
| 14 | Instant Bank KPI Refresh & Selection | Recalculate KPIs (`kpiCustodia`, `kpiClientes`, `kpiContas`) and immediate selection via `acessarClientePorConta` | M3 | R3, Survey 3 |
| 15 | Localhost Stability & E2E Automated Tests | Server stable on port 3000, automated tests for loans, receipts, and onboarding | M4 | R4, Survey 3 |
| 16 | Git Commit & Push to GitHub | Stage all changes, commit descriptive message, and push to branch `main` on GitHub | M5 | R4, Survey 3 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Loan Simulator & Credit Hiring | Endpoints, atomic transaction, UI simulator, Chat IA `/emprestimo` | none | PLANNED |
| M2 | Official Digital Receipts & Print/PDF | Comprovante endpoint, official modal, statement integration, `@media print`, copy | M1 | PLANNED |
| M3 | Admin Client & Account Onboarding | Admin modal/form, backend creation in PG, account generator, KPI refresh | none | PLANNED |
| M4 | Localhost Stability & Automated Tests | Comprehensive test suite for all new routes, verification of port 3000 | M1, M2, M3 | PLANNED |
| M5 | GitHub Persistence & Remote Push | Commit verified code and push to `origin/main` on GitHub | M4 | PLANNED |

---

## Interface Contracts

### 1. Loan Simulation & Hiring (`server.js` ↔ `public/app.js`)
- `POST /api/cliente/emprestimo/simular`:
  - Body: `{ "valor": 5000, "meses": 12 }`
  - Response:
    ```json
    {
      "sucesso": true,
      "dados": {
        "valor_solicitado": 5000,
        "meses": 12,
        "taxa_mensal": 0.0189,
        "taxa_mensal_formatada": "1,89% a.m.",
        "taxa_anual_cet": 25.19,
        "taxa_anual_cet_formatada": "25,19% a.a.",
        "parcela_mensal": 469.61,
        "total_a_pagar": 5635.32,
        "total_juros": 635.32
      }
    }
    ```
- `POST /api/cliente/emprestimo/contratar`:
  - Body: `{ "conta_id": 1, "valor": 5000, "meses": 12 }`
  - Response:
    ```json
    {
      "sucesso": true,
      "mensagem": "Empréstimo de R$ 5.000,00 contratado com sucesso!",
      "transacao_id": 105,
      "novo_saldo": 13450.00,
      "detalhes": {
        "valor": 5000.00,
        "parcelas": 12,
        "valor_parcela": 469.61,
        "total_a_pagar": 5635.32
      }
    }
    ```

### 2. Transaction Receipt (`server.js` ↔ `public/app.js`)
- `GET /api/transacoes/:id/comprovante`:
  - Response:
    ```json
    {
      "sucesso": true,
      "dados": {
        "id": 9,
        "protocolo": "BF-2026-00000009",
        "codigo_autenticacao": "A1B2.C3D4.E5F6.7890.1234.5678.9ABC.DEF0",
        "tipo": "transferencia",
        "tipo_formatado": "Transferência Bancária",
        "status": "concluida",
        "valor": 500.00,
        "valor_formatado": "R$ 500,00",
        "data_hora": "2026-09-24T10:15:00.000Z",
        "descricao": "PIX Alimentação",
        "remetente": {
          "nome": "Ana Paula Souza",
          "cpf_mascarado": "***.123.456-**",
          "instituicao": "Banco Fictício S.A. (999)",
          "agencia": "0001-7 - Agência Central",
          "conta": "00010001-5"
        },
        "destinatario": {
          "nome": "Carlos Eduardo Lima",
          "cpf_mascarado": "***.987.654-**",
          "instituicao": "Banco Fictício S.A. (999)",
          "agencia": "0002-5 - Agência Paulista",
          "conta": "00020002-3"
        }
      }
    }
    ```

### 3. Admin Account Onboarding (`server.js` ↔ `public/app.js`)
- `POST /api/banco/clientes`:
  - Body:
    ```json
    {
      "nome": "Mariana Ribeiro Santos",
      "cpf": "12345678901",
      "email": "mariana.santos@email.com",
      "telefone": "(11) 98765-4321",
      "cidade": "São Paulo",
      "estado": "SP",
      "agencia_id": 1,
      "tipo_conta": "corrente",
      "saldo_inicial": 1000.00,
      "limite": 2500.00
    }
    ```
  - Response:
    ```json
    {
      "sucesso": true,
      "mensagem": "Cliente e conta cadastrados com sucesso!",
      "dados": {
        "cliente": { "id": 11, "nome": "Mariana Ribeiro Santos", "cpf": "12345678901", "email": "mariana.santos@email.com" },
        "conta": { "id": 13, "numero": "00110001", "digito": "8", "conta_formatada": "00110001-8", "tipo": "corrente", "saldo": 1000.00, "limite": 2500.00 },
        "usuario": { "id": 12, "login": "mariana.santos", "papel": "cliente" }
      }
    }
    ```

---

## Code Layout
- `server.js`: Express endpoints, database transactions, loan calculations, receipt generation, account onboarding.
- `assistant.js`: Command router, NLP matching for `/emprestimo` and loans.
- `public/`:
  - `index.html`: Client Area loan simulator markup, official receipt modal `#modalComprovante`, admin onboarding modal `#modalAberturaConta`.
  - `app.js`: Reactive bindings for loan simulator, receipt modal triggers, print/copy actions, admin onboarding submit and KPI refresh.
  - `styles.css`: Dark mode styles, `@media print` isolation for official receipts.
- `test/`:
  - `emprestimo.test.js`: Automated tests for loan simulation, contracts, limits, and Chat IA `/emprestimo`.
  - `receipts.test.js`: Automated tests for receipt data model, SHA-256 codes, and statement endpoints.
  - `onboarding.test.js`: Automated tests for client, account, and user provisioning and balance initialization.
  - `assistant.test.js`: Regression tests for Assistant and Command Bar.
