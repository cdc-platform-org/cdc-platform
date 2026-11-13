# CDC Platform

Learning and career platform (cdc.org.ge): courses, live trainings, a digital
store, gigs and vacancies, mentorship, proctored exams and AI tools for
educators. The UI ships in several languages, with Georgian (`ka`) as the default.

## Repository

| Folder      | What it is |
|-------------|------------|
| `Backend/`  | Express + TypeScript API, Prisma/PostgreSQL (`Backend/src/server.ts`) |
| `Frontend/` | Next.js (Pages Router) web app (`Frontend/pages/`, `Frontend/src/`) |
| `docs/`     | Architecture map and feature docs |
| `scripts/`  | Production deploy script |

**Start here:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) has the folder map,
the request flow and a feature → file index.
[`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) explains the main business subsystems.

## Local development

```bash
npm install
npm run dev:backend     # API on http://localhost:<PORT from Backend/.env>
npm run dev:frontend    # Web app on http://localhost:3000
```

Backend needs a `Backend/.env` with a PostgreSQL `DATABASE_URL` plus the
provider keys it uses. Run `npm --workspace Backend run db:migrate` once.

## Checks

```bash
cd Backend && npx tsc --noEmit && npm test && npm run build
cd Frontend && npx tsc --noEmit && npm run build
```

## Source control and deploys

- Code is hosted on **Azure DevOps** (remote `azure`); `main` is the live code.
  Work happens on branches and lands through pull requests.
- Production deploys run only through `scripts/deploy-prod.ps1`, with explicit approval.
