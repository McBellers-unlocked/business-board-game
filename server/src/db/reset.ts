import { pool } from "./pool.js";

async function run() {
  console.log("Dropping schema and reinitialising...");
  await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  console.log("Schema dropped. Now run `npm run migrate` and `npm run seed`.");
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
