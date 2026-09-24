# 🏦 Banco Fictício

Projeto de estudo e demonstração de banco de dados relacional com PostgreSQL.

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| macOS | 13+ |
| PostgreSQL | 14+ |
| VS Code | 1.80+ |
| Git | 2.x |

## Setup Rápido

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd banco-ficticio

# Execute o bootstrap (idempotente — pode rodar várias vezes)
chmod +x setup.sh
./setup.sh
```

O script `setup.sh` irá automaticamente:
- Verificar se PostgreSQL está instalado e rodando
- Criar o database `banco_ficticio` (se não existir)
- Aplicar o schema (`01_schema.sql`)
- Popular com dados de teste (`02_seed.sql`)
- Exibir um resumo do ambiente configurado

## Estrutura do Projeto

```
banco-ficticio/
├── README.md            # Este arquivo
├── setup.sh             # Bootstrap do ambiente
├── 01_schema.sql        # DDL — estrutura das tabelas
├── 02_seed.sql          # DML — dados de teste
├── 03_consultas.sql     # Consultas de demonstração
├── .gitignore
├── .vscode/
│   └── settings.json    # Conexão SQLTools (VS Code)
└── docs/                # Documentação adicional
```

## Schema

```
agencias ────────────┐
                     │
clientes ────────────┤
                     ▼
               contas ──────► transacoes
```

### Tabelas

| Tabela | Descrição |
|---|---|
| `agencias` | Agências bancárias |
| `clientes` | Clientes cadastrados |
| `contas` | Contas corrente ou poupança |
| `transacoes` | Movimentações financeiras |

## Usando no VS Code com SQLTools

1. Instale as extensões:
   - **SQLTools** (`mtxr.sqltools`)
   - **SQLTools PostgreSQL Driver** (`mtxr.sqltools-driver-pg`)
2. Abra o painel SQLTools (`Ctrl+Shift+P` → `SQLTools: Connect`)
3. Selecione **banco_ficticio (local)**
4. Abra `03_consultas.sql` e execute com `Ctrl+E Ctrl+E`

## Usando no pgAdmin 4

1. Abra pgAdmin 4
2. Clique em **Add New Server**
3. **General** → Name: `Banco Fictício Local`
4. **Connection**:
   - Host: `127.0.0.1`
   - Port: `5432`
   - Database: `banco_ficticio`
   - Username: `henriquemonteiro`
   - Password: *(em branco)*
5. Clique em **Save**

## Consultas de Exemplo

Veja o arquivo [`03_consultas.sql`](./03_consultas.sql) para exemplos de:
- Extrato por conta
- Saldo consolidado por cliente
- Ranking de movimentações
- Clientes sem conta ativa
- Relatório por agência

## Git & GitHub

```bash
# Após criar o repositório no GitHub:
git remote add origin https://github.com/<seu-usuario>/banco-ficticio.git
git push -u origin main
```

---

> Projeto criado com fins educacionais. Os dados são fictícios.
