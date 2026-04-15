import { GAME_CODE_ALPHABET, GAME_CODE_LENGTH } from "@dcl/shared";
import { pool } from "../db/pool.js";

function makeCode(): string {
  let out = "";
  const bytes = new Uint8Array(GAME_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < GAME_CODE_LENGTH; i++) {
    out += GAME_CODE_ALPHABET[bytes[i]! % GAME_CODE_ALPHABET.length]!;
  }
  return out;
}

export async function generateUniqueGameCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = makeCode();
    const existing = await pool.query("SELECT 1 FROM game_sessions WHERE game_code = $1", [code]);
    if (existing.rowCount === 0) return code;
  }
  throw new Error("Unable to generate unique game code after 20 attempts");
}
