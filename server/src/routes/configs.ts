import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireFacilitator, getFacilitator } from "../auth/middleware.js";
import type { GameConfig } from "@dcl/shared";

export const configsRouter = Router();

function validateConfig(cfg: GameConfig): string[] {
  const errors: string[] = [];
  if (!cfg.stadiums?.length) errors.push("At least one stadium is required");
  if (!cfg.players?.length) errors.push("Player roster must be provided");
  if (!cfg.phases?.length) errors.push("Phase structure required");
  if (cfg.phases?.reduce((s, p) => s + p.matches, 0) !== cfg.financingRules.totalMatchesInSeason) {
    errors.push("Phase matches must sum to totalMatchesInSeason");
  }
  // Validate probability matrix
  const classes = ["Poor", "Average", "Good"] as const;
  for (const a of classes) {
    for (const b of classes) {
      const e = cfg.probabilityMatrix?.entries?.[`${a}-${b}`];
      if (!e) errors.push(`Missing probability entry ${a}-${b}`);
      else {
        const sum = e.win + e.draw + e.lose;
        if (Math.abs(sum - 1) > 0.001) {
          errors.push(`Probabilities for ${a}-${b} sum to ${sum.toFixed(3)}, expected 1.0`);
        }
      }
    }
  }
  return errors;
}

configsRouter.use(requireFacilitator);

configsRouter.get("/", async (req, res, next) => {
  try {
    const fid = getFacilitator(req).facilitatorId;
    const result = await pool.query(
      `SELECT id, name, is_template, updated_at
         FROM game_configs
        WHERE facilitator_id = $1 OR is_template = TRUE
        ORDER BY is_template DESC, updated_at DESC`,
      [fid]
    );
    res.json({ configs: result.rows });
  } catch (err) {
    next(err);
  }
});

configsRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, facilitator_id, name, config, is_template, created_at, updated_at
         FROM game_configs WHERE id = $1`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Config not found", code: "NO_CONFIG" });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  config: z.record(z.any())
});

configsRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const errors = validateConfig(body.config as GameConfig);
    if (errors.length) return res.status(400).json({ error: "Invalid config", code: "VALIDATION", details: errors });
    const fid = getFacilitator(req).facilitatorId;
    const result = await pool.query<{ id: string }>(
      `INSERT INTO game_configs (facilitator_id, name, config) VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [fid, body.name, JSON.stringify(body.config)]
    );
    res.status(201).json({ id: result.rows[0]!.id });
  } catch (err) {
    next(err);
  }
});

configsRouter.put("/:id", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const errors = validateConfig(body.config as GameConfig);
    if (errors.length) return res.status(400).json({ error: "Invalid config", code: "VALIDATION", details: errors });
    const fid = getFacilitator(req).facilitatorId;
    const result = await pool.query(
      `UPDATE game_configs SET name = $1, config = $2::jsonb, updated_at = NOW()
         WHERE id = $3 AND (facilitator_id = $4 OR is_template = FALSE)
         RETURNING id`,
      [body.name, JSON.stringify(body.config), req.params.id, fid]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Not found or forbidden", code: "NO_CONFIG" });
    res.json({ id: req.params.id });
  } catch (err) {
    next(err);
  }
});

configsRouter.post("/:id/clone", async (req, res, next) => {
  try {
    const fid = getFacilitator(req).facilitatorId;
    const src = await pool.query<{ name: string; config: GameConfig }>(
      "SELECT name, config FROM game_configs WHERE id = $1",
      [req.params.id]
    );
    if (src.rowCount === 0) return res.status(404).json({ error: "Config not found", code: "NO_CONFIG" });
    const row = src.rows[0]!;
    const result = await pool.query<{ id: string }>(
      `INSERT INTO game_configs (facilitator_id, name, config) VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [fid, `${row.name} (clone)`, JSON.stringify(row.config)]
    );
    res.status(201).json({ id: result.rows[0]!.id });
  } catch (err) {
    next(err);
  }
});

configsRouter.delete("/:id", async (req, res, next) => {
  try {
    const fid = getFacilitator(req).facilitatorId;
    const result = await pool.query(
      "DELETE FROM game_configs WHERE id = $1 AND facilitator_id = $2 AND is_template = FALSE",
      [req.params.id, fid]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Not found, forbidden, or template", code: "NO_CONFIG" });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
