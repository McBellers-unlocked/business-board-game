import bcrypt from "bcryptjs";
import { pool } from "./pool.js";
import { makeDefaultGameConfig } from "@dcl/shared";

const TEMPLATE_CONFIG_ID = "00000000-0000-0000-0000-000000000001";
const SEED_FACILITATOR_EMAIL = "demo@dcl.local";
const SEED_FACILITATOR_PASSWORD = "demo12345";

async function run() {
  console.log("Seeding default game config + demo facilitator...");

  // Demo facilitator (dev mode only)
  const hash = await bcrypt.hash(SEED_FACILITATOR_PASSWORD, 10);
  const facRes = await pool.query<{ id: string }>(
    `INSERT INTO facilitators (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [SEED_FACILITATOR_EMAIL, "Demo Facilitator", hash]
  );
  const facilitatorId = facRes.rows[0]!.id;

  // Template config — stable ID so clients can reference it
  const config = makeDefaultGameConfig(facilitatorId, TEMPLATE_CONFIG_ID);
  await pool.query(
    `INSERT INTO game_configs (id, facilitator_id, name, config, is_template)
     VALUES ($1, $2, $3, $4::jsonb, TRUE)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       config = EXCLUDED.config,
       updated_at = NOW()`,
    [config.id, facilitatorId, config.name, JSON.stringify(config)]
  );

  console.log(`  facilitator: ${SEED_FACILITATOR_EMAIL} / ${SEED_FACILITATOR_PASSWORD} (id=${facilitatorId})`);
  console.log(`  template config: ${config.name} (id=${config.id})`);
  console.log(`    stadiums=${config.stadiums.length} players=${config.players.length} events=${config.eventLibrary.length}`);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
