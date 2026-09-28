# Chatquiry

AI-first customer service for banks. The AI handles repeatable requests; people decide sensitive ones.

## Repository layout

One repository, independent deploy units. Each top-level folder builds and ships on its own.

| Path | What | Deploys to |
|---|---|---|
| `frontend/` | Next.js 16 app (landing, staff workspace, test chat) | AWS Amplify |
| `backend/` | FastAPI service (orchestrator, API, auth) | EC2 via Docker image in ECR |
| `pipeline/` | Data pipeline (bronze, silver, gold) | Runs as a job; loads Postgres |
| `ml/` | Intake classifier training and evaluation | Offline |
| `eval/` | End-to-end evaluation harness | Offline and CI |
| `infra/` | Terraform | Applied manually from CI |
| `docs/` | Scope, architecture, results | Not deployed |

CI lives in `.github/workflows/`, one workflow per unit, filtered by path so a change in `frontend/` never rebuilds the backend.

Each unit has its own tooling: `npm` in `frontend/`, `uv` in `backend/`, `pipeline/`, `ml/` and `eval/`. Read the unit's own `AGENTS.md` when it has one (for example `frontend/AGENTS.md`).

## Commits

One line, Conventional Commits style:

```
type(scope): short description in lowercase
```

- `type`: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `ci`
- `scope`: the unit touched: `frontend`, `backend`, `data`, `ml`, `eval`, `infra`, `docs`
- Imperative mood, no trailing period, 72 characters or fewer.
- No body, no trailers, no co-author lines, no tool or assistant references.
- Do not use the long dash character anywhere in commit messages.
- One logical change per commit. A change that touches two units is two commits.

Examples:

```
feat(frontend): add dark mode and locale preference to profile
fix(backend): scope transaction lookup to session customer
chore(infra): pin terraform aws provider
```

## Code comments

- Comment only what the code cannot say by itself: a non-obvious reason, a constraint, a security rule.
- Describe the code, not its history. No tickets, feature names, phases, dates or who asked for it.
- Short and plain, one line when possible, written the way a colleague would say it.
- Do not use the long dash character in comments.
- No commented-out code.

## Text and translations

- UI text lives in `frontend/src/i18n/locales/{es,en,pt}.json`; Spanish is the source. Run `npm run check:i18n` after editing.
- Dynamic content is translated by the backend. The frontend sends the locale in the `X-Chatquiry-Locale` header.
- Never hardcode an AI profile name in UI copy; read it from data.

## Data and secrets

- Organizer PDFs, `.env*` files and `data/` are ignored and must never be committed. The data dictionary contains credentials.
- Secrets reach services through environment variables or AWS SSM, never through the repository.
