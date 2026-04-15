# AWS Deployment & Custom Domain — business-board-game.com

This guide walks through the full path from zero to production-ready on
`business-board-game.com`, keeping Cloudflare DNS authoritative.

## Architecture

```
           ┌──────────────────────────────────────────────┐
           │  Cloudflare DNS (zone: business-board-game.com) │
           │   apex/www  CNAME → CloudFront                 │
           │   api       CNAME → ALB                        │
           └──────────┬────────────────────┬──────────────┘
                      │ HTTPS              │ HTTPS
               ┌──────▼──────┐      ┌──────▼──────┐
               │  CloudFront  │      │     ALB      │
               │  (us-east-1  │      │ (eu-west-2) │
               │   cert)      │      │    + cert   │
               └──────┬──────┘      └──────┬──────┘
                      │                     │
                ┌─────▼────┐          ┌─────▼────┐
                │ S3 site  │          │ Fargate  │
                │ bucket   │          │  API     │
                └──────────┘          └────┬─────┘
                                           │
                                    ┌──────▼──────┐
                                    │ RDS Postgres │
                                    └──────────────┘
```

## Prerequisites

- AWS credentials with admin permissions active in the shell
- Docker Desktop running (CDK builds the server image locally)
- Cloudflare account with `business-board-game.com` added as a zone
- Node 20+, npm 10+

## Stacks

| Stack              | Region    | Contents                                          |
|--------------------|-----------|---------------------------------------------------|
| `dcl-network`      | eu-west-2 | VPC, subnets, NAT                                 |
| `dcl-cognito`      | eu-west-2 | Cognito User Pool + client (facilitator auth)     |
| `dcl-backend`      | eu-west-2 | RDS Postgres, Fargate API, ALB, S3 exports bucket |
| `dcl-frontend`     | eu-west-2 | S3 site bucket + CloudFront distribution          |
| `dcl-cert-cloudfront` | us-east-1 | ACM cert for apex + www (CloudFront-only region)  |
| `dcl-cert-alb`     | eu-west-2 | ACM cert for api subdomain                        |

## Step 1 — initial deploy (default domains, no TLS)

```bash
cd infra
export AWS_REGION=eu-west-2 AWS_DEFAULT_REGION=eu-west-2
npx cdk bootstrap aws://<account>/eu-west-2
npx cdk bootstrap aws://<account>/us-east-1    # required once for CloudFront certs
npx cdk deploy dcl-network dcl-cognito dcl-backend dcl-frontend --require-approval never
```

Note the outputs:
- `dcl-backend.AlbDnsName`      — ALB public DNS name
- `dcl-frontend.DistributionDomain` — e.g. `dxxxx.cloudfront.net`

Upload the SPA to the site bucket:

```bash
cd ../client
npm run build
aws s3 sync dist/ s3://<SiteBucketName>/ --delete
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths '/*'
```

At this point the app is running at `https://dxxxx.cloudfront.net`, API at `http://<ALB DNS>`.

## Step 2 — database bootstrap

Run migrations + seed against RDS. The simplest path from your laptop is
`psql` with an SSH/SSM tunnel, or temporarily bastion with `aws ssm start-session`.
If you prefer, add a one-off ECS task override in the console to run
`npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts`.

## Step 3 — create ACM certificates

Both certs are created by the `dcl-cert-*` stacks (see `bin/app.ts` with the
`--context enableCerts=true` flag).

```bash
npx cdk deploy dcl-cert-cloudfront dcl-cert-alb \
  --context enableCerts=true \
  --context apexDomain=business-board-game.com \
  --context apiDomain=api.business-board-game.com \
  --require-approval never
```

CloudFormation will create the certs in PENDING_VALIDATION state and wait
for DNS-01 validation records to appear.

## Step 4 — add validation CNAMEs in Cloudflare

Open the **AWS ACM console** (for each of us-east-1 and eu-west-2) and copy
the "CNAME name" + "CNAME value" rows for each cert.

In Cloudflare DNS for `business-board-game.com`, add each validation record:

| Type  | Name (host)           | Target (value)                                | Proxy |
|-------|-----------------------|-----------------------------------------------|-------|
| CNAME | `_xxxxxxxx`           | `_yyyyyyyy.acm-validations.aws.`              | DNS only (grey cloud) |

(Names and values are unique per cert. Just paste what ACM shows.)

Once each record propagates (usually < 2 min) ACM will issue the cert. The
CDK deploy will then complete. You can confirm by re-running the deploy —
it'll reach `CREATE_COMPLETE`.

## Step 5 — wire the certs into frontend + backend

Redeploy the frontend and backend with the cert ARNs + custom domains:

```bash
npx cdk deploy dcl-backend dcl-frontend \
  --context enableCerts=true \
  --context apexDomain=business-board-game.com \
  --context apiDomain=api.business-board-game.com \
  --require-approval never
```

This adds:
- ALB HTTPS listener on 443 (HTTP redirects to HTTPS)
- CloudFront alternate domain names + cert

## Step 6 — final DNS records in Cloudflare

For `business-board-game.com`:

| Type  | Name (host) | Target (value)                             | Proxy                 |
|-------|-------------|--------------------------------------------|-----------------------|
| CNAME | `@` (apex)  | `<DistributionDomain>.cloudfront.net`       | DNS only (grey cloud) |
| CNAME | `www`       | `<DistributionDomain>.cloudfront.net`       | DNS only              |
| CNAME | `api`       | `<AlbDnsName>.eu-west-2.elb.amazonaws.com`  | DNS only              |

Notes:
- Cloudflare supports **CNAME flattening at the apex**, so you can use a CNAME
  for `@` (it returns A records to clients).
- Keep Proxy **off (grey cloud)** for all three. Proxying CloudFront behind
  Cloudflare causes a double-CDN hop and usually breaks signed URLs + WAF.
- TTL: leave at Auto.

After DNS propagates (~5 min), you can:
- Browse `https://business-board-game.com` → the SPA loads.
- The SPA's `/api` proxy is no longer active in prod — the frontend calls
  `https://api.business-board-game.com` directly. See "Client env wiring" below.

## Client env wiring

The client reads the API URL from `VITE_API_URL` at build time. Set it before
`npm run build`:

```bash
cd client
VITE_API_URL=https://api.business-board-game.com npm run build
aws s3 sync dist/ s3://<SiteBucketName>/ --delete
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths '/*'
```

## CORS

The backend is configured to accept `CLIENT_ORIGIN` as a comma-separated
allowlist. For production, set it via a deploy-time Fargate env override:

```
CLIENT_ORIGIN=https://business-board-game.com,https://www.business-board-game.com
```

(Already wired via `FrontendOrigins` in the CDK context if you set
`--context frontendOrigins=...` or edit `bin/app.ts`.)

## Rolling back

All retained resources (RDS, S3 buckets, Cognito pool) will survive `cdk destroy`.
To destroy the transient resources (VPC, Fargate, CF, ALB):

```bash
npx cdk destroy dcl-frontend dcl-backend dcl-network
```

Then manually clean up the retained resources from the AWS console if you
want a complete teardown.
