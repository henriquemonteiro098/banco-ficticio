# Banco Fictício: relational database and banking interface

A hands-on study project with PostgreSQL, a Node.js management dashboard, and a client-facing online banking interface.

This repository is built for learning database modeling, SQL transactions, and full-stack integration without dealing with real-world financial risks.

## Prerequisites

| Tool | Recommended version |
|---|---|
| macOS | 13+ |
| PostgreSQL | 14+ (tested on 18.6) |
| Node.js | 18+ (tested on v26.8) |
| VS Code and SQLTools extension | Recent |
| Git and GitHub CLI (`gh`) | Recent |

## Quick start

### 1. Database setup
```bash
# Checks prerequisites, creates the database, schema, and sample data
./setup.sh
```

### 2. Start the web interface (dashboard and online banking)
```bash
# Install dependencies
npm install

# Start the server on port 3000
npm start
```

Open your browser at [http://localhost:3000](http://localhost:3000).

---

## Access credentials

| Role | Username | Password | Notes |
|---|---|---|---|
| General administrator | `admin` | `admin` | Full access to branch balances, treasury, and administrative operations |
| Customer (sample 1) | `ana.souza` | `123456` | Online banking for Ana Paula Souza |
| Customer (sample 2) | `carla.ferreira` | `123456` | Online banking for Carla Mendes |
| Customer (sample 3) | `bruno.lima` | `123456` | Online banking for Bruno Costa Lima |

The login page includes quick-fill buttons for testing each account in one click.

---

## Web interface features

The application is split into two main sections:

### 1. Bank management dashboard (treasury)
- Balance overview: total funds under custody, active clients, registered accounts, and total transaction volume.
- Operations chart: breakdown of transaction volume by type (PIX, deposits, withdrawals, payments, fees).
- Branch ranking: volume held across branches.
- Account management: searchable table of all accounts with quick links to view client details.
- Audit log: complete transaction history with filtering by operation type.
- Administrative tools: deposit cash at the counter or apply maintenance fees with immediate balance updates in PostgreSQL.

### 2. Customer portal (online banking)
- Account card: virtual card displaying account number, branch, and holder name.
- Balance details: current balance, overdraft limit, and total available funds.
- Account switcher: toggle between different accounts owned by the same user (checking, savings).
- Instant transfers (PIX): transfer form with balance checks and atomic execution (`BEGIN ... COMMIT`) that updates both accounts in real time.
- Bill payments: settle bills with balance deduction and statement logging.
- Detailed statement: filterable history of inflows (+) and outflows (-) showing counterparty details.

---

## Repository structure

```
banco-ficticio/
├── server.js              # Node.js and Express server with a PostgreSQL connection pool
├── package.json           # Dependencies (express, pg, cors, dotenv)
├── public/                # Web frontend
│   ├── index.html         # Responsive interface built with Tailwind CSS
│   ├── app.js             # UI state, Chart.js graphs, and API calls
│   └── styles.css         # Custom styling
├── setup.sh               # Shell script for database verification and setup
├── 01_schema.sql          # Tables (usuarios, agencias, clientes, contas, transacoes)
├── 02_seed.sql            # Seed data for branches, users, accounts, and transactions
├── 03_consultas.sql       # 15 documented SQL queries for reporting and analytics
├── .gitignore             # Standard ignore rules for Node and local files
└── .vscode/
    └── settings.json      # Connection profile for the SQLTools extension
```

---

## Relational data model

```
             ┌────────── usuarios (admin/cliente)
             │                │
             │                ▼
agencias ────┼──────────── clientes
             │                │
             ▼                ▼
           contas ──────── transacoes
```

---

## Running queries in VS Code with SQLTools

1. Open the project in VS Code (`code .`).
2. Go to the SQLTools tab on the left sidebar.
3. Click the connection named `banco_ficticio (local)` configured in `.vscode/settings.json`.
4. Open [`03_consultas.sql`](./03_consultas.sql), select any query, and press `Ctrl+E Ctrl+E` to run it.

---

## Connecting with pgAdmin 4

1. Open pgAdmin 4.
2. Click Add New Server.
3. In General, set Name to `Banco Fictício Local`.
4. In Connection, enter:
   - Host: `127.0.0.1`
   - Port: `5432`
   - Database: `banco_ficticio`
   - Username: `henriquemonteiro`
   - Password: (leave empty if using peer/trust local authentication)
5. Click Save.

---

## Repository link

GitHub repository:
[https://github.com/henriquemonteiro098/banco-ficticio](https://github.com/henriquemonteiro098/banco-ficticio)
