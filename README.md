# 🏦 Banco Fictício — Sistema Bancário Completo

Projeto prático de banco de dados relacional com PostgreSQL, painel de gestão financeira e interface de Internet Banking.

## Pré-requisitos

| Ferramenta | Versão recomendada |
|---|---|
| macOS | 13+ |
| PostgreSQL | 14+ (testado no 18.6) |
| Node.js | 18+ (testado no v26.8) |
| VS Code & SQLTools | Recente |
| Git & GitHub CLI (`gh`) | Recente |

## 🚀 Inicialização Rápida

### 1. Bootstrap do Banco de Dados
```bash
# Executa a verificação, criação do banco, schema e dados de teste (idempotente)
./setup.sh
```

### 2. Iniciar a Interface Web (Dashboard & Internet Banking)
```bash
# Instala dependências (se ainda não instalou)
npm install

# Inicia o servidor na porta 3000
npm start
```

Acesse no seu navegador: **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Credenciais de Acesso

| Perfil | Usuário (Login) | Senha | Descrição |
|---|---|---|---|
| **Administrador Geral** | `admin` | `admin` | Acesso completo ao painel do banco, tesouraria e operações |
| **Cliente (Exemplo 1)** | `ana.souza` | `123456` | Acesso ao Internet Banking de Ana Paula Souza |
| **Cliente (Exemplo 2)** | `carla.ferreira` | `123456` | Acesso ao Internet Banking de Carla Mendes |
| **Cliente (Exemplo 3)** | `bruno.lima` | `123456` | Acesso ao Internet Banking de Bruno Costa Lima |

*(Na tela de login há botões de atalho para preenchimento e teste imediato em 1 clique).*

---

## 💻 Funcionalidades da Interface Visual

A aplicação web possui duas áreas principais:

### 1. 🏛️ O Banco (Painel Gerencial / Tesouraria)
- **Indicadores em Tempo Real**: Total sob custódia (saldo consolidado), clientes ativos, contas cadastradas e volume movimentado.
- **Gráfico Interativo**: Distribuição do volume financeiro por tipo de operação (PIX, depósitos, saques, pagamentos, tarifas).
- **Ranking de Agências**: Volume financeiro sob custódia por agência.
- **Gestão de Contas**: Tabela de todas as contas com busca instantânea e atalho de acesso direto ao cliente.
- **Auditoria de Transações Globais**: Histórico de todas as transações com filtro por tipo.
- **Operação Administrativa do Banco**: Realizar depósitos em dinheiro no caixa ou lançamentos de tarifas com atualização imediata de saldo no PostgreSQL.

### 2. 👤 Área do Cliente (Internet Banking)
- **Cartão Digital**: Cartão bancário estilizado com número da conta, agência e titular.
- **Visão de Saldo**: Saldo em conta, limite de cheque especial e saldo total disponível.
- **Seletor de Contas**: Alternar facilmente entre contas do cliente (corrente, poupança, etc.).
- **Transferência / PIX Instantâneo**: Formulário com validação de saldo e execução atômica (`BEGIN ... COMMIT`) debitando o remetente e creditando o destinatário no PostgreSQL em tempo real.
- **Pagamento de Títulos**: Liquidação de boletos/contas com dedução de saldo e registro no extrato.
- **Extrato Detalhado**: Histórico de entradas (+) e saídas (-) com filtros por tipo e contrapartes identificadas.

---

## 📁 Estrutura do Repositório

```
banco-ficticio/
├── server.js              # Servidor Node.js + Express conectado via pool PostgreSQL
├── package.json           # Dependências (express, pg, cors, dotenv)
├── public/                # Frontend da aplicação web
│   ├── index.html         # Estrutura HTML responsiva (TailwindCSS)
│   ├── app.js             # Lógica reativa, Chart.js e integração com a API
│   └── styles.css         # Estilização refinada
├── setup.sh               # Script bash de automação e validação completa
├── 01_schema.sql          # DDL: tabelas (usuarios, agencias, clientes, contas, transacoes)
├── 02_seed.sql            # DML: agencias, clientes, contas, transações e usuarios (admin/clientes)
├── 03_consultas.sql       # 15 consultas demonstrativas e analíticas documentadas
├── .gitignore             # Ignora node_modules, logs e arquivos de ambiente
├── .vscode/
│   └── settings.json      # Conexão automática para a extensão SQLTools
└── docs/                  # Documentações adicionais
```

---

## 🗄️ Modelo Relacional (PostgreSQL)

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

## 🛠️ Usando no VS Code com SQLTools

1. Com o VS Code aberto no projeto (`code .`), acesse o painel **SQLTools** na barra lateral esquerda.
2. Clique na conexão **banco_ficticio (local)** configurada em `.vscode/settings.json`.
3. Abra [`03_consultas.sql`](./03_consultas.sql), selecione qualquer consulta e pressione `Ctrl+E Ctrl+E` para executá-la diretamente.

---

## 🐘 Usando no pgAdmin 4

1. Abra o **pgAdmin 4**.
2. Clique em **Add New Server**.
3. Em **General** → Nome: `Banco Fictício Local`.
4. Em **Connection**:
   - Host: `127.0.0.1`
   - Port: `5432`
   - Database: `banco_ficticio`
   - Username: `henriquemonteiro`
   - Password: *(em branco)*
5. Clique em **Save**.

---

## 🔗 Repositório Oficial

Repositório público no GitHub:
[https://github.com/henriquemonteiro098/banco-ficticio](https://github.com/henriquemonteiro098/banco-ficticio)
