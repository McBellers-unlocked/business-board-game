import { Router } from "express";
import { z } from "zod";
import { pool, withTx } from "../db/pool.js";
import { requireAuth, requireFacilitator, getFacilitator, getTeamMember } from "../auth/middleware.js";
import { loadConfig, loadSession } from "../services/sessionQueries.js";
import { Rng } from "../engine/rng.js";

export const eventsRouter = Router();

// -------------------- Event library (facilitator) --------------------
eventsRouter.get("/session/:sessionId/event-library", requireFacilitator, async (req, res, next) => {
  try {
    const session = await loadSession(req.params.sessionId!);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    const config = await loadConfig(session.configId);
    if (!config) return res.status(404).json({ error: "No config", code: "NO_CONFIG" });
    res.json({ library: config.eventLibrary });
  } catch (err) {
    next(err);
  }
});

// -------------------- Trigger event --------------------
const triggerSchema = z.object({
  templateId: z.string().min(1),
  targetTeamId: z.string().uuid().nullable().optional(),
  phase: z.number().int().min(1).max(4).optional(),
  overrides: z
    .object({
      financialImpact: z.number().nullable().optional(),
      attendanceImpact: z.number().nullable().optional(),
      description: z.string().optional()
    })
    .optional()
});

eventsRouter.post("/session/:sessionId/events", requireFacilitator, async (req, res, next) => {
  try {
    const body = triggerSchema.parse(req.body);
    const session = await loadSession(req.params.sessionId!);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    if (session.facilitatorId !== getFacilitator(req).facilitatorId) {
      return res.status(403).json({ error: "Not your session", code: "FORBIDDEN" });
    }
    const config = await loadConfig(session.configId);
    if (!config) return res.status(404).json({ error: "No config", code: "NO_CONFIG" });
    const template = config.eventLibrary.find((e) => e.id === body.templateId);
    if (!template) return res.status(404).json({ error: "Template not found", code: "NO_TEMPLATE" });

    const phase = body.phase ?? Math.max(1, session.currentPhase + 1);
    const deadline =
      template.responseDeadlineMinutes != null
        ? new Date(Date.now() + template.responseDeadlineMinutes * 60_000)
        : null;

    // For injury events with no fixed playerId: pick target(s) using RNG
    let playerImpact: any = template.playerImpact;
    const rng = new Rng(session.randomSeed ^ (phase * 0x9e3779b1) ^ body.templateId.length);
    if (playerImpact && playerImpact.playerId == null) {
      const targetTeams = body.targetTeamId
        ? [body.targetTeamId]
        : (await pool.query<{ id: string }>("SELECT id FROM teams WHERE session_id = $1", [session.id])).rows.map(
            (r) => r.id
          );
      for (const tid of targetTeams) {
        const tr = await pool.query<any>("SELECT selected_player_ids FROM teams WHERE id = $1", [tid]);
        const players: number[] = tr.rows[0]?.selected_player_ids ?? [];
        if (players.length === 0) continue;
        let playerId: number;
        if (template.id === "evt_injury_key") {
          // Highest-index active player
          const indexed = players
            .map((pid) => config.players.find((pp) => pp.id === pid))
            .filter(Boolean)
            .sort((a, b) => (b!.playerIndex - a!.playerIndex));
          playerId = indexed[0]!.id;
        } else {
          playerId = players[rng.int(players.length)]!;
        }
        const effect = playerImpact.effect;
        if (effect === "injured") {
          await pool.query(
            `UPDATE teams SET injured_player_ids =
               COALESCE(injured_player_ids, '[]'::jsonb) || to_jsonb($1::int)
             WHERE id = $2`,
            [playerId, tid]
          );
        } else if (effect === "suspended") {
          await pool.query(
            `UPDATE teams SET suspended_player_ids =
               COALESCE(suspended_player_ids, '[]'::jsonb) || to_jsonb($1::int)
             WHERE id = $2`,
            [playerId, tid]
          );
        }
      }
      playerImpact = { ...playerImpact, playerId: null };
    }

    const insert = await pool.query<{ id: string }>(
      `INSERT INTO game_events
        (session_id, target_team_id, template_id, phase, title, description, severity,
         financial_impact, player_impact, attendance_impact, requires_response, response_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
       RETURNING id`,
      [
        session.id,
        body.targetTeamId ?? null,
        template.id,
        phase,
        template.title,
        body.overrides?.description ?? template.description,
        template.severity,
        body.overrides?.financialImpact ?? template.financialImpact,
        playerImpact ? JSON.stringify(playerImpact) : null,
        body.overrides?.attendanceImpact ?? template.attendanceImpact,
        template.requiresResponse,
        deadline
      ]
    );

    res.status(201).json({ id: insert.rows[0]!.id });
  } catch (err) {
    next(err);
  }
});

// -------------------- List events --------------------
eventsRouter.get("/session/:sessionId/events", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId!;
    const session = await loadSession(sessionId);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });

    const auth = req.auth!;
    if (auth.kind === "team") {
      // Team sees events targeting them or all-teams events
      const result = await pool.query(
        `SELECT * FROM game_events
           WHERE session_id = $1 AND (target_team_id = $2 OR target_team_id IS NULL)
           ORDER BY triggered_at DESC`,
        [sessionId, auth.teamId]
      );
      return res.json({ events: result.rows.map(mapEventRow) });
    }
    const result = await pool.query(
      `SELECT ge.*, t.name AS target_team_name
         FROM game_events ge
         LEFT JOIN teams t ON t.id = ge.target_team_id
        WHERE ge.session_id = $1
        ORDER BY ge.triggered_at DESC`,
      [sessionId]
    );
    res.json({ events: result.rows.map(mapEventRow) });
  } catch (err) {
    next(err);
  }
});

function mapEventRow(r: any) {
  return {
    id: r.id,
    sessionId: r.session_id,
    targetTeamId: r.target_team_id,
    targetTeamName: r.target_team_name ?? null,
    templateId: r.template_id,
    phase: r.phase,
    title: r.title,
    description: r.description,
    severity: r.severity,
    financialImpact: r.financial_impact != null ? Number(r.financial_impact) : null,
    playerImpact: r.player_impact,
    attendanceImpact: r.attendance_impact != null ? Number(r.attendance_impact) : null,
    requiresResponse: r.requires_response,
    responseDeadline: r.response_deadline,
    teamResponse: r.team_response,
    resolved: r.resolved,
    triggeredAt: r.triggered_at
  };
}

// -------------------- Team response to an event --------------------
const responseSchema = z.object({ teamResponse: z.string().min(1).max(4000) });

eventsRouter.post("/:eventId/respond", requireAuth, async (req, res, next) => {
  try {
    const body = responseSchema.parse(req.body);
    if (req.auth?.kind !== "team") {
      return res.status(403).json({ error: "Only team members can respond", code: "NOT_TEAM_MEMBER" });
    }
    const member = getTeamMember(req);
    const event = await pool.query<any>("SELECT * FROM game_events WHERE id = $1", [req.params.eventId]);
    if (event.rowCount === 0) return res.status(404).json({ error: "No event", code: "NO_EVENT" });
    const ev = event.rows[0]!;
    if (ev.session_id !== member.sessionId) {
      return res.status(403).json({ error: "Cross-session forbidden", code: "FORBIDDEN" });
    }
    if (ev.target_team_id && ev.target_team_id !== member.teamId) {
      return res.status(403).json({ error: "Not targeted at your team", code: "NOT_TARGETED" });
    }
    if (!["MPRD", "MD"].includes(member.role)) {
      return res.status(403).json({ error: "Only MPRD or MD may submit a response", code: "ROLE_FORBIDDEN" });
    }

    await pool.query(`UPDATE game_events SET team_response = $1 WHERE id = $2`, [body.teamResponse, req.params.eventId]);
    res.json({ status: "recorded" });
  } catch (err) {
    next(err);
  }
});

// -------------------- Resolve an event (facilitator) --------------------
eventsRouter.put("/:eventId/resolve", requireFacilitator, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE game_events SET resolved = TRUE WHERE id = $1 RETURNING session_id`,
      [req.params.eventId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "No event", code: "NO_EVENT" });
    const ownerCheck = await pool.query(
      `SELECT facilitator_id FROM game_sessions WHERE id = $1`,
      [result.rows[0]!.session_id]
    );
    if (ownerCheck.rows[0]?.facilitator_id !== getFacilitator(req).facilitatorId) {
      return res.status(403).json({ error: "Not your session", code: "FORBIDDEN" });
    }
    res.json({ status: "resolved" });
  } catch (err) {
    next(err);
  }
});
