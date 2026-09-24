# Project: Banco Fictício (Phase 2 — Command Bar, Banking AI, 1k Visual Assets, Humanizer & GitHub Sync)

## Architecture
- **Frontend**: Vanilla JS (ES6+ async/await), HTML5 semantic markup, TailwindCSS (dark mode), FontAwesome 6, Chart.js, served from `public/`.
- **Backend**: Node.js + Express 4.21.2 (`server.js`), static serving of `public/` and `public/assets/`, REST API for banking operations.
- **Database**: PostgreSQL 18.6 on `127.0.0.1:5432`, database `banco_ficticio`, native connection pool via `pg` (10 connections). Tables: `agencias`, `clientes`, `contas`, `transacoes`, `usuarios`.
- **AI Assistant & Command Engine**: Real-time intent routing and SQL parameterized query engine answering `/` commands and natural language inquiries in <500ms (measured at 2-10ms).
- **Visual Assets**: 1k high-definition graphics in `public/assets/` (Credit Card Black texture, Cofre Digital & Tesouraria banner, customer/operation avatars).
- **Quality Gate & Humanizer**: Anti-glitch inspection on visual assets, natural and professional pt-BR banking language standards for all AI outputs and UI text.
- **Testing & Tooling**: Node.js native test runner (`node --test`), automated endpoint and asset verification.
- **VCS**: Git tracking on branch `main`, remote `origin` (`https://github.com/henriquemonteiro098/banco-ficticio.git`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Credit Card Black 1k Texture | 1024x645 texture (dark glassmorphism, carbon fiber, subtle gold) for Black card UI | M1 | R2, Survey 3 |
| 2 | Cofre Digital & Tesouraria Banner | 1024x384 1k high-tech vault banner for managerial dashboard header | M1 | R2, Survey 3 |
| 3 | Client & Operation Avatars | 1k avatars and operation badges for clients, accounts and transactions | M1 | R2, Survey 3 |
| 4 | Asset Responsive Integration | Integrate textures and banners in `index.html` & `styles.css` without breaking layout | M1 | R2, Survey 1 |
| 5 | Visual Anti-Glitch Quality Gate | Verification that no AI glitches, deformed hands, or garbled text exist in assets | M1 | R3, Survey 3 |
| 6 | Assistant Endpoint & Intent Router | `POST /api/assistente/consulta` handling commands & NL questions in <500ms | M2 | R1, Survey 2 |
| 7 | Real-time `/saldo` Execution | Return active account balance, limit, and total available directly from PostgreSQL | M2 | R1, Survey 2 |
| 8 | Real-time `/extrato` Execution | Query recent entries and exits with (+/-) badges directly from PostgreSQL | M2 | R1, Survey 2 |
| 9 | Real-time `/pix` Execution | PIX fast transfer flow with recipient suggestion from active accounts | M2 | R1, Survey 2 |
| 10 | Real-time `/contas` Execution | Quick view of registered accounts from PostgreSQL | M2 | R1, Survey 2 |
| 11 | Real-time `/agencias` Execution | Quick query of bank branches, codes, and locations | M2 | R1, Survey 2 |
| 12 | Interactive `/ajuda` Execution | Catalog of all actions and example questions the assistant can answer | M2 | R1, Survey 2 |
| 13 | Real-time Natural Language Banking Queries | Dynamic answers to "Qual o saldo da Ana Paula?", "Quanto temos sob custódia?", "Qual foi a última transferência?" | M2 | R1, Survey 2 |
| 14 | Header Global Search Bar Trigger | Top search bar in header with `/` shortcut badge opening palette | M3 | R1, Survey 1 |
| 15 | Global Keyboard Hotkey (`/`) | Pressing `/` anywhere opens Command Palette (excluding active inputs); `Escape` closes | M3 | R1, Survey 1 |
| 16 | Dynamic Suggested Commands Menu | Interactive dropdown showing `/` commands with keyboard (Up/Down/Enter) & click navigation | M3 | R1, Survey 1 |
| 17 | Interactive Chat Feed UI | Rich conversation history rendering cards for balance, transactions, accounts and answers | M3 | R1, Survey 1 |
| 18 | Humanizer Text & Tone Audit | Ensure all chat answers and UI text are natural, professional pt-BR without robotic tropes | M4 | R3, Survey 3 |
| 19 | Automated Test Suite | Local unit and integration tests for endpoints, latency, assets and Humanizer rules | M4 | R4, Survey 3 |
| 20 | Git Commit & Push to GitHub | Stage all changes, commit, and push to `origin/main` | M5 | R4, Survey 3 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | System Survey | Map frontend, backend, DB, assets, tooling & git | none | DONE |
| M1 | 1k Visual Assets & Quality Gate | Generate 1k assets, audit against glitches, integrate in UI/CSS | M0 | DONE |
| M2 | Banking AI Backend & PostgreSQL Queries | `POST /api/assistente/consulta` with sub-500ms commands & NL queries | M0 | DONE |
| M3 | Command Bar & Interactive Chat UI | Global search bar, `/` hotkey, suggestions palette, interactive chat cards | M1, M2 | DONE |
| M4 | Quality Gate, Humanizer Audit & E2E Testing | Automated test suite, latency verification, Humanizer audit, challenger & auditor gates | M1, M2, M3 | DONE |
| M5 | GitHub Persistence & Remote Push | Commit verified code and push to `origin/main` on GitHub | M4 | DONE |

---

## Interface Contracts

### Backend ↔ Frontend: `POST /api/assistente/consulta`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "mensagem": "/saldo",
    "conta_id": 1,
    "cliente_id": 1
  }
  ```
- **Response Format (Success 200)**:
  ```json
  {
    "sucesso": true,
    "comando": "saldo",
    "tipo_resposta": "saldo",
    "texto": "O saldo atual da conta 00010001-5 é de R$ 8.450,00, com limite especial de R$ 2.000,00 (Total disponível: R$ 10.450,00).",
    "dados": {
      "conta": "00010001-5",
      "tipo": "corrente",
      "saldo": 8450.00,
      "limite": 2000.00,
      "saldo_disponivel": 10450.00,
      "titular": "Ana Paula Souza"
    },
    "tempo_ms": 4.2
  }
  ```
- **Error Response (400 / 500)**:
  ```json
  {
    "sucesso": false,
    "mensagem": "Não foi possível processar a consulta bancária no momento.",
    "detalhe": "Motivo resumido"
  }
  ```

### Static Assets
- `public/assets/cartao_black_texture.png`: 1024x645 px, PNG, <500KB
- `public/assets/banner_cofre_tesouraria.png`: 1024x384 px, PNG, <500KB
- `public/assets/avatars/`: PNG avatars 1k / 512px

---

## Code Layout
- `server.js`: Express application, routes, database queries, static middleware.
- `public/`:
  - `index.html`: Main HTML structure, layout, modals, header, command palette modal.
  - `app.js`: Client-side logic, API calls, state management, hotkey listener, chat rendering.
  - `styles.css`: Custom utility classes, animations, scrollbars, premium asset overlays.
  - `assets/`: Generated 1k visual assets (credit card texture, treasury banner, avatars).
- `test/`:
  - `assistant.test.js`: Integration tests for `/api/assistente/consulta`, latency, and database validation.
  - `assets.test.js`: Validation of image dimensions, file existence, and responsive styles.
  - `humanizer.test.js`: Linguistic audit tests against AI/chatbot tropes.
