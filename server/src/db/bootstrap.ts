import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./pool.js";
import { makeDefaultGameConfig } from "@dcl/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "migrations");
const TEMPLATE_CONFIG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Apply pending SQL migrations and ensure the default DCL config template
 * exists. Safe to run on every process start — both operations are idempotent.
 *
 * Called from src/index.ts before the HTTP server starts listening, so the
 * AWS Fargate task can self-bootstrap without a separate migration job.
 */
export async function bootstrapDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(32) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`);
  const applied = new Set(
    (await pool.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map((r) => r.version)
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let applied_count = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      console.log(`bootstrap: applied migration ${version}`);
      applied_count++;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  if (applied_count === 0) console.log("bootstrap: migrations already applied");

  // Ensure default config template exists. facilitator_id stays null in prod —
  // the user will create their own facilitator through Cognito. The template
  // is visible to all facilitators because the list query includes is_template=TRUE.
  await pool.query(
    `INSERT INTO game_configs (id, facilitator_id, name, config, is_template)
     VALUES ($1, NULL, $2, $3::jsonb, TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [TEMPLATE_CONFIG_ID, "Deeland Cricket League (default)", JSON.stringify(makeDefaultGameConfig())]
  );
  console.log("bootstrap: default config template present");
}
