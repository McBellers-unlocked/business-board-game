import "dotenv/config";

function str(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v == null || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null) return fallback;
  return v === "true" || v === "1";
}

function buildDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL;
  if (direct && direct.length > 0) return direct;
  // Assemble from RDS secret pieces (ApiStack injects DB_HOST/DB_PORT/etc.)
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const port = process.env.DB_PORT ?? "5432";
  const dbname = process.env.DB_NAME ?? "dcl";
  if (host && user && password) {
    const pwd = encodeURIComponent(password);
    return `postgres://${encodeURIComponent(user)}:${pwd}@${host}:${port}/${dbname}`;
  }
  return "postgres://dcl:dcl_dev_password@localhost:5432/dcl";
}

export const config = {
  env: str("NODE_ENV", "development"),
  port: Number(str("PORT", "4000")),
  appBaseUrl: str("APP_BASE_URL", "http://localhost:4000"),
  clientOrigin: str("CLIENT_ORIGIN", "http://localhost:5173"),
  databaseUrl: buildDatabaseUrl(),
  pgSsl: bool("PGSSL", false),
  teamJwtSecret: str("TEAM_JWT_SECRET", "change-me-local-dev-only"),
  authDevMode: bool("AUTH_DEV_MODE", true),
  awsRegion: str("AWS_REGION", "eu-west-2"),
  cognitoUserPoolId: str("COGNITO_USER_POOL_ID", ""),
  cognitoClientId: str("COGNITO_CLIENT_ID", ""),
  s3ExportsBucket: str("S3_EXPORTS_BUCKET", "")
};
