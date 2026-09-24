# Project: Banco Fictício (Environment & GitHub Setup)

## Architecture
- **Environment**: macOS Darwin arm64 with Homebrew at `/opt/homebrew`.
- **Version Control**: Git repository at `/Users/henriquemonteiro/Projetos/banco-ficticio` on branch `main`.
- **Remote Platform**: GitHub public repository `https://github.com/<user>/banco-ficticio`.
- **Tools**: Git CLI, GitHub CLI (`gh`), Homebrew (`brew`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Global Git User Name | Set global Git user.name to `José Henrique de Souza Monteiro` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Global Git User Email | Set global Git user.email to `mega.monteiro0908@gmail.com` | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Local Hygiene Exclusion | Add `.agents/` to `.git/info/exclude` to safeguard metadata | M1 | Survey Explorer 3 |
| 4 | Amend Initial Commit | Amend commit `f6e0915` to update author/committer email, preserving message | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Install GitHub CLI | Install GitHub CLI (`gh`) via Homebrew (`brew install gh`) | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Authenticate GitHub CLI | Authenticate via `gh auth login` interactive browser flow | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Create Public Repo | Create public repository `banco-ficticio` on GitHub without remote README | M3 | ORIGINAL_REQUEST §R3 |
| 8 | Configure Origin Remote | Configure `origin` remote pointing to new GitHub repository URL | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Push Main Branch | Push `main` branch to `origin` and establish upstream tracking | M3 | ORIGINAL_REQUEST §R3 |
| 10 | E2E Acceptance Verification | Verify all 8 acceptance criteria from ORIGINAL_REQUEST.md | M4 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Git Identity & Commit Amend | Configure global git config, exclude .agents, amend initial commit author | none | DONE |
| M2 | GitHub CLI Install & Authentication | Install gh via Homebrew, authenticate via browser flow, verify auth status | none | DONE |
| M3 | Repository Creation & Push | Create public repo on GitHub, set origin remote, push main branch | M1, M2 | DONE |
| M4 | Comprehensive E2E Verification | Verify all git configs, author, gh version, auth status, remote, push, public URL | M3 | IN_PROGRESS |

## Code Layout
- Repository Root: `/Users/henriquemonteiro/Projetos/banco-ficticio`
- Tracked Files:
  - `01_schema.sql` (PostgreSQL schema DDL)
  - `02_seed.sql` (PostgreSQL initial data DML)
  - `03_consultas.sql` (Analytical SQL queries)
  - `setup.sh` (Database bootstrap script)
  - `README.md` (Project documentation)
  - `.gitignore` (Git ignore rules)
  - `.vscode/settings.json` (SQLTools connection configuration)
- Excluded / Metadata Files:
  - `.agents/` (Agent metadata and workspace files - ignored locally via `.git/info/exclude`)
