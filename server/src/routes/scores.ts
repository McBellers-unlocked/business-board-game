import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireFacilitator, getFacilitator } from "../auth/middleware.js";
import { loadSession } from "../services/sessionQueries.js";

export const scoresRouter = Router();

const scoreSchema = z.object({
  teamId: z.string().uuid(),
  category: z.enum(["shareholder_presentation", "csr_pitch", "media_announcement", "general"]),
  phase: z.number().int().min(1).max(4).nullable().optional(),
  score: z.number().int().min(1).max(10),
  notes: z.string().max(2000).optional()
});

scoresRouter.post("/session/:sessionId/scores", requireFacilitator, async (req, res, next) => {
  try {
    const body = scoreSchema.parse(req.body);
    const session = await loadSession(req.params.sessionId!);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    if (session.facilitatorId !== getFacilitator(req).facilitatorId) {
      return res.status(403).json({ error: "Not your session", code: "FORBIDDEN" });
    }
    const insert = await pool.query<{ id: string }>(
      `INSERT INTO qualitative_scores (session_id, team_id, category, phase, score, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [session.id, body.teamId, body.category, body.phase ?? null, body.score, body.notes ?? null]
    );
    res.status(201).json({ id: insert.rows[0]!.id });
  } catch (err) {
    next(err);
  }
});

scoresRouter.get("/session/:sessionId/scores", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId!;
    const auth = req.auth!;
    if (auth.kind === "team" && auth.sessionId !== sessionId) {
      return res.status(403).json({ error: "Cross-session forbidden", code: "FORBIDDEN" });
    }
    const scopeFilter = auth.kind === "team" ? "AND team_id = $2" : "";
    const params = auth.kind === "team" ? [sessionId, auth.teamId] : [sessionId];
    const result = await pool.query(
      `SELECT * FROM qualitative_scores
         WHERE session_id = $1 ${scopeFilter}
         ORDER BY scored_at DESC`,
      params
    );
    res.json({ scores: result.rows });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  score: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(2000).optional()
});

scoresRouter.put("/:scoreId", requireFacilitator, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (body.score !== undefined) {
      fields.push(`score = $${i++}`);
      values.push(body.score);
    }
    if (body.notes !== undefined) {
      fields.push(`notes = $${i++}`);
      values.push(body.notes);
    }
    if (fields.length === 0) return res.json({ updated: false });
    values.push(req.params.scoreId);
    await pool.query(`UPDATE qualitative_scores SET ${fields.join(", ")} WHERE id = $${i}`, values);
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});
