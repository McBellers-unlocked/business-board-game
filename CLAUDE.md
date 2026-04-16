# Deeland Cricket League — Business Simulation Platform

## What this is

A full-stack web platform that automates the "Deeland Cricket League" board-game simulation. Facilitators run sessions where up to 8 teams (humans + AI) manage fictional cricket clubs — making financial, operational, marketing and staffing decisions across four phases of a season. Teams are scored on ROE + qualitative assessment.

**Prod URL**: https://business-board-game.com
**API**: proxied via CloudFront `/api/*` → ALB → Fargate
**Direct API**: https://api.business-board-game.com

## Repo layout

```
/shared     @dcl/shared    Domain types, constants, default game config (3 stadiums, 20 players, 27 events)
/server     @dcl/server    Node + Express + TypeScript API; Postgres migrations; game engine
/client     @dcl/client    React 18 + Vite + TypeScript + Tailwind + React Query
/infra      @dcl/infra     AWS CDK stacks (VPC, RDS, Cognito, Fargate, S3+CloudFront)
```

Monorepo with npm workspaces. `shared` is consumed by both `server` and `client` via workspace references.

## Stack

- **Frontend**: React 18, Vite, TypeScript strict, Tailwind CSS, TanStack React Query, React Router 6
- **Backend**: Node 20, Express, TypeScript, pg (raw SQL, no ORM), Zod validation, JWT auth
- **Database**: PostgreSQL 16 (Docker locally, RDS in prod)
- **Auth**: AWS Cognito for facilitators (email/password), lightweight session-scoped JWT for team members
- **Infra**: AWS CDK (VPC, RDS, ECS Fargate, ALB, S3, CloudFront, Cognito, SES)
- **CI/CD**: GitHub Actions — frontend auto-deploys on push to `client/**` or `shared/**`, backend on `server/**` or `shared/**`

## Key architecture decisions

- **Game engine is pure functions** in `server/src/engine/` — financial calculations, match simulation (seeded PRNG), fixture generation, league table sorting. All unit-tested.
- **No ORM** — raw SQL via `pg` library. Schema in `server/src/db/migrations/001_initial.sql`.
- **Self-bootstrapping** — server runs migrations + seeds default config on startup (`server/src/db/bootstrap.ts`), so Fargate tasks are self-contained.
- **Polling, not WebSockets** — React Query polls at 2-10s intervals depending on the view. Phase advancement triggers query invalidation for instant refresh.
- **Role-based access enforced at API level** — middleware in `server/src/auth/middleware.ts`. Setup decisions are role-gated per FR-04 of the spec.
- **CloudFront proxies `/api/*`** to the ALB over HTTP so the SPA makes same-origin calls (no CORS, no mixed content).

## AWS resources

| Resource | Region | Identifier |
|----------|--------|------------|
| AWS Account | — | 891612540396 |
| Cognito User Pool | eu-west-2 | eu-west-2_x0EZ5Fsss |
| Cognito Client | eu-west-2 | 393f2ekc1cft12khtl6pemlr5i |
| RDS Postgres | eu-west-2 | dcl-backend-postgres9dc8bb04-* |
| ECS Cluster | eu-west-2 | dcl-backend-ApiCluster7CE9CBE6-* |
| ALB | eu-west-2 | dcl-ba-Alb16-5ln9G8qS88GP-* |
| CloudFront | global | E39P3WRNPTP068 (dq0xtbmdrg7cf.cloudfront.net) |
| S3 Site Bucket | eu-west-2 | dcl-frontend-sitebucket397a1860-kqm7pphoamvl |
| ACM (CloudFront) | us-east-1 | 257f908d-26b9-4965-a949-b8fd6f6e887c |
| ACM (ALB) | eu-west-2 | adc3a4a2-7a93-4aed-859a-7a00328494f0 |
| SES domain | eu-west-2 | business-board-game.com (DKIM verified) |
| GitHub Actions role | global | arn:aws:iam::891612540396:role/GitHubActionsDeploy |

## DNS (Cloudflare)

Domain `business-board-game.com` uses Cloudflare DNS (DNS-only, no proxy).
- `@` → CloudFront
- `www` → CloudFront
- `api` → ALB
- 3 DKIM CNAMEs for SES
- 3 ACM validation CNAMEs

## Local dev

```bash
npm run db:up          # Postgres in Docker
npm run db:migrate     # Apply schema
npm run db:seed        # Demo facilitator + default config
npm run dev            # Server (4000) + client (5173) concurrently
```

Dev facilitator: `demo@dcl.local` / `demo12345` (AUTH_DEV_MODE=true skips Cognito).

## Deploy

Push to `main` → GitHub Actions auto-deploys:
- `client/**` or `shared/**` → frontend (Vite build → S3 sync → CF invalidation, ~40s)
- `server/**` or `shared/**` → backend (Docker build → ECR → ECS force-redeploy, ~5min)
- `infra/**` → manual trigger only (Actions tab → Deploy infra → Run workflow)

## Testing

```bash
npm --workspace server test    # 18 engine tests (financials, simulation, fixtures)
```

## Brand

- **Header/crest outlines**: #123A78 (navy blue)
- **Key buttons**: #D5161D (cricket-ball red)
- **Trim/accents**: #ED9F1E (golden amber)
- **Text on light**: #110B0F
- **Text on dark**: #E9E8E6
- Logo: cricket crest with bats, ball, wickets and laurels (`client/public/logo-full.png`)

## Game rules reference

The source documents are in the repo root:
- `BBG Instructions.docx` — full rule book (stadiums, players, F&B, financing, probability matrix)
- `BBG Day 1 Set Up Actions.docx` — setup phase tasks
- `BBG Proposal.docx` — simulation objectives and USPs
- `DCL_SDD_Specification.md` — technical spec (domain model, API design, DB schema)
- 15 `.docx` intervention scenario briefs (Coach Resignation, Fire at Pavilion, etc.)

## Common tasks

### Add a new API endpoint
1. Add route in `server/src/routes/<domain>.ts`
2. Wire into `server/src/index.ts`
3. Add shared types in `shared/src/types.ts` if needed
4. Push — backend Action auto-deploys

### Add a new page
1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Push — frontend Action auto-deploys

### Add a new event template
Add to `shared/src/defaultConfig.ts` → `DEFAULT_EVENT_LIBRARY` array. Existing sessions won't pick it up (config is cloned at session creation), but new sessions will.

### Run a DB migration
Add a new `.sql` file in `server/src/db/migrations/` (e.g. `002_add_column.sql`). The server runs pending migrations on startup automatically.

### Manual ECR deploy (bypass CI)
```bash
cd C:\dev\businessboardgame
docker build --platform linux/amd64 -f server/Dockerfile -t <ECR_URI>:<tag> .
aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin <ECR_URI>
docker push <ECR_URI>:<tag>
# Then register new task def + force-redeploy ECS (see docs/DEPLOY.md)
```

## Tools

- `gh` CLI: `C:\dev\businessboardgame\.tools\gh\bin\gh.exe`
- GitHub repo: https://github.com/McBellers-unlocked/business-board-game (public)
