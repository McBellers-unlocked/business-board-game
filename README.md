# Deeland Cricket League — Business Simulation Platform

Full-stack web platform that automates the Deeland Cricket League board-game simulation:
facilitator-run sessions, up to 8 teams (humans + AI) per league, role-gated team dashboards,
match simulation engine, financial engine, event library, qualitative scoring, and end-of-season
PDF export.

## Repo layout

```
/shared    @dcl/shared        Domain types + default game config (DCL rules + 15 intervention scenarios)
/server    @dcl/server        Node + Express + TypeScript API; Postgres migrations; game engine
/client    @dcl/client        React + Vite + TypeScript + Tailwind + React Query
/infra     @dcl/infra         AWS CDK stacks: VPC, RDS Postgres, Cognito, Fargate, S3, CloudFront
```

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (for local Postgres)
- For AWS deploy: AWS CLI v2 configured, CDK v2 bootstrapped in your account/region

## Local development

```bash
# From repo root
npm install

# Start Postgres in Docker
npm run db:up

# Create schema + seed (demo facilitator + default DCL config)
npm run db:migrate
npm run db:seed

# Start both server (http://localhost:4000) and client (http://localhost:5173)
npm run dev
```

The client's Vite dev server proxies `/api/*` to the backend.

### Demo credentials (dev seed)

- Facilitator: `demo@dcl.local` / `demo12345`

After logging in as the facilitator, click "Create session" with the seeded default config,
choose how many of the 8 teams should be human, and share the 6-character game code with players.
Players open `/join`, enter the code, choose a team and role, and join the lobby.

### Resetting the DB

```bash
npm run db:reset     # drops + recreates public schema
npm run db:migrate
npm run db:seed
```

## Running tests

```bash
npm --workspace server test
```

The engine is covered by unit tests: financial calculations against hand-calculated examples,
20,000-iteration probability distribution checks, and fixture balance checks (each of 8 teams
plays every opponent twice, 7 home + 7 away, across the 4-3-4-3 phase structure).

## AWS deployment

The CDK app in `/infra` provisions the full production stack:

- `dcl-network` — VPC with public/private/isolated subnets, 1 NAT
- `dcl-database` — RDS Postgres 16 (t3.micro, encrypted, retained on stack deletion)
- `dcl-cognito` — User Pool for facilitators (email-based, self-signup enabled)
- `dcl-api`     — ECR image build → Fargate service behind an ALB, auto-scaling 1–4
                   Reads DB credentials from Secrets Manager; S3 bucket for PDF exports
- `dcl-frontend` — S3 + CloudFront static site distribution

```bash
cd infra
npm install
npx cdk bootstrap      # first time only per account/region
npx cdk synth
npx cdk deploy --all
```

Outputs include the ALB URL (API), the CloudFront domain, the Cognito user-pool ID and
client ID. Set these in the client's build env (`VITE_API_URL`, `VITE_COGNITO_*`) and
`aws s3 sync client/dist/ s3://<SiteBucketName>/ --delete` to publish the frontend.

### Runtime modes

- Local dev: `AUTH_DEV_MODE=true` in `server/.env` — facilitator login uses bcrypt'd passwords
  in the `facilitators` table (demo seed).
- Production: `AUTH_DEV_MODE=false` — facilitators register/login via Cognito (the API
  verifies ID tokens using `aws-jwt-verify`); team members still use the lightweight
  session JWT signed with `TEAM_JWT_SECRET`.

## Configuration

The default DCL configuration is the centerpiece — its JSON is in
`shared/src/defaultConfig.ts` and includes:

- 3 stadiums (Small £20M/20K/£35, Medium £30M/30K/£30, Large £40M/40K/£25)
- 20 players (9 batsmen, 4 all-rounders, 7 bowlers, indices 0.75–1.55)
- 4 phases with 14 total matches in a 4-3-4-3 structure, 7 home + 7 away
- 9-cell probability matrix (Poor/Average/Good × opponent classification)
- 27 event templates (12 core + 15 intervention scenarios from the source .docx briefs)
- F&B schemes (fixed / revenue-share), financing rules (5% interest, 2-year debt),
  spectator rules, resale rules, team constraints (≥6 batters, ≥5 bowlers, 12–20 total)

Facilitators can clone and modify configurations from the "Configs" page. Validation
enforces that each row of the probability matrix sums to 1.0.

## Intervention scenarios

The event library seeds 15 deeper scenarios from the source documents as
`requiresResponse: true` events, each with facilitator notes describing the financial /
attendance / player impacts:

| Event | Category | Source document |
|-------|----------|-----------------|
| Coach Resignation (Evans Templeton) | staff | Coach Resignation.docx |
| End of Contract: Joseph Pusilic | staff | End Of Contract.docx |
| Exceptional Cricketer (Johnson Jones) | staff | Exceptional Cricketer.docx |
| Fire at the Pavilion | operations | Fire-at-pavilion.docx |
| Food Poisoning Outbreak | operations | Food Poisoning.docx |
| Grass Termite Infestation | operations | Grass Termites.docx |
| Head Coach Dismissal (Nick Mason) | staff | Head Coach - dismissal.docx |
| Partnership with Righteous Kings CC | sponsorship | Link With Righteous Kings.docx |
| Potential Catering Strike | legal | Potential Catering Strike.docx |
| Purchase of Bloom Building | financial | Sale Of Bloom Building.docx |
| Offer for Reggie Twengie | staff | Sale of Reggie Twengie.docx |
| Sewage Leak at Boundary | operations | Sewage-crisis.docx |
| Sponsor Liquidation (Homemakers) | sponsorship | Sponsor Liquidation.docx |
| Theft at DFP Outlet | legal | TheftEmail-ORIGINAL.docx |
| Unruly Fan Behaviour | media | Unruly Behaviour.docx |

## Scripts cheatsheet

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start both server + client |
| `npm run dev:server` | Start API only (tsx watch) |
| `npm run dev:client` | Start SPA only (Vite dev) |
| `npm run db:up` | Postgres 16 in Docker |
| `npm run db:down` | Stop Postgres |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Insert demo facilitator + default config |
| `npm run db:reset` | Drop + recreate public schema |
| `npm run build` | Build all workspaces |
| `npm --workspace server test` | Engine unit tests |
| `npx cdk deploy --all` (in /infra) | Provision all AWS stacks |

## Known constraints (v1)

- Fixture generator is hard-coded for 8 teams (spec). Generalisation is straightforward.
- Config editor is JSON-based — structured visual editors (stadium grid, probability
  matrix sliders, etc.) are a polish task for v1.1.
- Session data retention policy (12 months → archive) is not yet automated; use an RDS
  snapshot + an S3 lifecycle rule on the exports bucket until a cleanup Lambda is added.
