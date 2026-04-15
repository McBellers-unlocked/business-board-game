import { Router } from "express";
import { z } from "zod";
import { pool, withTx } from "../db/pool.js";
import {
  requireAuth,
  requireFacilitator,
  requireRole,
  requireTeamMember,
  requireOwnTeam,
  getTeamMember
} from "../auth/middleware.js";
import { SETUP_PERMISSIONS } from "@dcl/shared";
import { loadConfig, loadSession, loadTeams } from "../services/sessionQueries.js";
import { validateSquad, computeTeamIndex, squadTotals, debtRequired } from "../engine/classification.js";
import { getStadium, resaleValue } from "../engine/financial.js";

export const teamsRouter = Router();

// -------------------- List teams in a session --------------------
teamsRouter.get("/session/:sessionId/teams", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId!;
    const session = await loadSession(sessionId);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    const auth = req.auth!;
    if (auth.kind === "team" && auth.sessionId !== sessionId) {
      return res.status(403).json({ error: "Cross-session forbidden", code: "FORBIDDEN" });
    }
    if (auth.kind === "facilitator" && session.facilitatorId !== auth.facilitatorId) {
      return res.status(403).json({ error: "Not your session", code: "FORBIDDEN" });
    }
    const config = await loadConfig(session.configId);
    if (!config) return res.status(404).json({ error: "No config", code: "NO_CONFIG" });
    const teams = await loadTeams(sessionId, config);
    res.json({ teams });
  } catch (err) {
    next(err);
  }
});

// -------------------- Update team setup (role-gated) --------------------
const setupSchema = z.object({
  clubName: z.string().min(1).max(100).optional(),
  stadiumChoice: z.string().optional(),
  fbScheme: z.enum(["fixed", "revenue"]).optional(),
  selectedPlayerIds: z.array(z.number().int()).optional(),
  equityFinance: z.number().nonnegative().optional(),
  setupComplete: z.boolean().optional()
});

teamsRouter.put(
  "/:teamId/setup",
  requireTeamMember,
  requireOwnTeam(),
  async (req, res, next) => {
    try {
      const body = setupSchema.parse(req.body);
      const teamId = req.params.teamId!;
      const role = getTeamMember(req).role;

      // Role-based decision gating (per FR-04)
      const violations: string[] = [];
      if (body.clubName !== undefined && !SETUP_PERMISSIONS.clubName.includes(role)) {
        violations.push("Only MD can change the club name");
      }
      if (body.stadiumChoice !== undefined && !SETUP_PERMISSIONS.stadium.includes(role)) {
        violations.push("Only MD/FD can choose the stadium");
      }
      if (body.fbScheme !== undefined && !SETUP_PERMISSIONS.fbScheme.includes(role)) {
        violations.push("Only FD/OM can choose the F&B scheme");
      }
      if (body.selectedPlayerIds !== undefined && !SETUP_PERMISSIONS.playerSelection.includes(role)) {
        violations.push("Only SD can select players");
      }
      if (body.equityFinance !== undefined && !SETUP_PERMISSIONS.equityFinance.includes(role)) {
        violations.push("Only FD/MD can set equity finance");
      }
      if (body.setupComplete !== undefined && !["MD", "FD"].includes(role)) {
        violations.push("Only MD/FD can mark setup complete");
      }
      if (violations.length) {
        return res.status(403).json({ error: "Role not permitted", code: "ROLE_FORBIDDEN", details: violations });
      }

      // Session must still be in setup
      const teamRow = await pool.query<{ session_id: string; setup_complete: boolean }>(
        "SELECT session_id, setup_complete FROM teams WHERE id = $1",
        [teamId]
      );
      if (teamRow.rowCount === 0) return res.status(404).json({ error: "No team", code: "NO_TEAM" });
      const sessionId = teamRow.rows[0]!.session_id;
      const session = await loadSession(sessionId);
      if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
      if (session.status !== "setup") {
        return res.status(400).json({ error: "Setup is locked", code: "SETUP_LOCKED" });
      }
      const config = await loadConfig(session.configId);
      if (!config) return res.status(404).json({ error: "No config", code: "NO_CONFIG" });

      // Validate squad if changed
      if (body.selectedPlayerIds !== undefined) {
        const v = validateSquad(body.selectedPlayerIds, config);
        if (!v.isValid) {
          return res.status(400).json({ error: "Invalid squad", code: "SQUAD_INVALID", details: v.errors });
        }
      }
      if (body.stadiumChoice && !config.stadiums.find((s) => s.key === body.stadiumChoice)) {
        return res.status(400).json({ error: "Unknown stadium", code: "BAD_STADIUM" });
      }
      if (body.clubName) {
        const clash = await pool.query(
          `SELECT 1 FROM teams WHERE session_id = $1 AND name = $2 AND id <> $3`,
          [sessionId, body.clubName, teamId]
        );
        if (clash.rowCount && clash.rowCount > 0) {
          return res.status(409).json({ error: "Team name already taken", code: "NAME_TAKEN" });
        }
      }
      if (body.setupComplete === true) {
        // Must have all setup decisions filled
        const row = await pool.query<any>(
          `SELECT name, stadium_choice, fb_scheme, selected_player_ids
             FROM teams WHERE id = $1`,
          [teamId]
        );
        const t = row.rows[0]!;
        const effName = body.clubName ?? t.name;
        const effStadium = body.stadiumChoice ?? t.stadium_choice;
        const effFb = body.fbScheme ?? t.fb_scheme;
        const effPlayers = body.selectedPlayerIds ?? t.selected_player_ids;
        const missing: string[] = [];
        if (!effName || /^Team \d+$/.test(effName)) missing.push("clubName");
        if (!effStadium) missing.push("stadiumChoice");
        if (!effFb) missing.push("fbScheme");
        if (!effPlayers?.length) missing.push("selectedPlayerIds");
        const v = validateSquad(effPlayers ?? [], config);
        if (!v.isValid) missing.push("squadRules");
        if (missing.length) {
          return res.status(400).json({
            error: "Setup is incomplete",
            code: "SETUP_INCOMPLETE",
            details: missing
          });
        }
      }

      // Apply update
      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;
      if (body.clubName !== undefined) {
        fields.push(`name = $${i++}`);
        values.push(body.clubName);
      }
      if (body.stadiumChoice !== undefined) {
        fields.push(`stadium_choice = $${i++}`);
        values.push(body.stadiumChoice);
      }
      if (body.fbScheme !== undefined) {
        fields.push(`fb_scheme = $${i++}`);
        values.push(body.fbScheme);
      }
      if (body.selectedPlayerIds !== undefined) {
        fields.push(`selected_player_ids = $${i++}::jsonb`);
        values.push(JSON.stringify(body.selectedPlayerIds));
      }
      if (body.equityFinance !== undefined) {
        fields.push(`equity_finance = $${i++}`);
        values.push(body.equityFinance);
      }
      if (body.setupComplete !== undefined) {
        fields.push(`setup_complete = $${i++}`);
        values.push(body.setupComplete);
      }
      if (fields.length === 0) return res.json({ updated: false });

      fields.push("updated_at = NOW()");
      values.push(teamId);
      await pool.query(`UPDATE teams SET ${fields.join(", ")} WHERE id = $${i}`, values);

      res.json({ updated: true });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------- Projected financials preview --------------------
teamsRouter.get("/:teamId/projection", requireAuth, async (req, res, next) => {
  try {
    const teamId = req.params.teamId!;
    const teamRow = await pool.query<any>(
      `SELECT session_id, stadium_choice, fb_scheme, selected_player_ids, equity_finance
         FROM teams WHERE id = $1`,
      [teamId]
    );
    if (teamRow.rowCount === 0) return res.status(404).json({ error: "No team", code: "NO_TEAM" });
    const t = teamRow.rows[0]!;
    const session = await loadSession(t.session_id);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    const config = await loadConfig(session.configId);
    if (!config) return res.status(404).json({ error: "No config", code: "NO_CONFIG" });

    const idx = computeTeamIndex(t.selected_player_ids ?? [], [], [], config);
    const totals = squadTotals(t.selected_player_ids ?? [], config);
    const stadium = getStadium(config, t.stadium_choice);
    const debt = debtRequired(stadium?.purchaseCost ?? 0, totals.totalPurchaseCost, Number(t.equity_finance));

    res.json({
      teamIndex: idx.teamIndex,
      classification: idx.classification,
      totalPlayerIndex: idx.totalPlayerIndex,
      squadTotals: totals,
      stadium,
      debtRequired: debt,
      annualInterest: debt * config.financingRules.annualInterestRate,
      equityFinance: Number(t.equity_finance)
    });
  } catch (err) {
    next(err);
  }
});

// -------------------- Trade proposal (SD only) --------------------
const tradeSchema = z.object({
  sellPlayerIds: z.array(z.number().int()).default([]),
  buyPlayerIds: z.array(z.number().int()).default([])
});

teamsRouter.post(
  "/:teamId/trade",
  requireTeamMember,
  requireOwnTeam(),
  requireRole("SD"),
  async (req, res, next) => {
    try {
      const body = tradeSchema.parse(req.body);
      const teamId = req.params.teamId!;
      const teamRow = await pool.query<any>(
        `SELECT session_id, selected_player_ids, injured_player_ids
           FROM teams WHERE id = $1`,
        [teamId]
      );
      if (teamRow.rowCount === 0) return res.status(404).json({ error: "No team", code: "NO_TEAM" });
      const session = await loadSession(teamRow.rows[0]!.session_id);
      if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
      const config = await loadConfig(session.configId);
      if (!config) return res.status(404).json({ error: "No config", code: "NO_CONFIG" });

      // All other teams' selected players → unavailable for buying
      const others = await pool.query<any>(
        `SELECT selected_player_ids FROM teams
           WHERE session_id = $1 AND id <> $2`,
        [session.id, teamId]
      );
      const owned = new Set<number>();
      for (const row of others.rows) {
        for (const id of row.selected_player_ids ?? []) owned.add(id);
      }
      const unavailable = body.buyPlayerIds.filter((id) => owned.has(id));
      if (unavailable.length) {
        return res.status(400).json({
          error: "Players not available",
          code: "UNAVAILABLE",
          details: unavailable
        });
      }

      // Compute projected squad
      const current: number[] = teamRow.rows[0]!.selected_player_ids ?? [];
      const injured: number[] = teamRow.rows[0]!.injured_player_ids ?? [];
      const after = [...current.filter((id) => !body.sellPlayerIds.includes(id)), ...body.buyPlayerIds];
      const v = validateSquad(after, config);
      if (!v.isValid) {
        return res.status(400).json({ error: "Post-trade squad invalid", code: "SQUAD_INVALID", details: v.errors });
      }

      // Projected cash delta (sell proceeds - buy costs)
      // Use the team's most recent league position for resale.
      const lastPosRow = await pool.query<{ league_position: number }>(
        `SELECT league_position FROM phase_results
           WHERE team_id = $1 ORDER BY phase DESC LIMIT 1`,
        [teamId]
      );
      const currentPos = lastPosRow.rows[0]?.league_position ?? 4;

      let delta = 0;
      for (const id of body.sellPlayerIds) {
        const p = config.players.find((pp) => pp.id === id);
        if (!p) continue;
        delta += resaleValue(p.purchaseCost, currentPos, injured.includes(id), config.resaleRules);
      }
      for (const id of body.buyPlayerIds) {
        const p = config.players.find((pp) => pp.id === id);
        if (!p) continue;
        delta -= p.purchaseCost;
      }

      const result = await pool.query<{ id: string }>(
        `INSERT INTO trade_proposals
           (session_id, team_id, proposed_phase, sell_player_ids, buy_player_ids, projected_cash_delta)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
         RETURNING id`,
        [
          session.id,
          teamId,
          session.currentPhase,
          JSON.stringify(body.sellPlayerIds),
          JSON.stringify(body.buyPlayerIds),
          delta
        ]
      );
      res.status(201).json({ id: result.rows[0]!.id, projectedCashDelta: delta });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------- Facilitator: list/approve/reject trades --------------------
teamsRouter.get("/session/:sessionId/trades", requireFacilitator, async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId!;
    const result = await pool.query(
      `SELECT tp.*, t.name AS team_name
         FROM trade_proposals tp JOIN teams t ON t.id = tp.team_id
        WHERE tp.session_id = $1 ORDER BY tp.created_at DESC`,
      [sessionId]
    );
    res.json({ trades: result.rows });
  } catch (err) {
    next(err);
  }
});

teamsRouter.post("/trades/:tradeId/approve", requireFacilitator, async (req, res, next) => {
  try {
    const tradeId = req.params.tradeId!;
    await withTx(async (client) => {
      const tr = await client.query<any>(
        `SELECT * FROM trade_proposals WHERE id = $1 AND status = 'pending'`,
        [tradeId]
      );
      if (tr.rowCount === 0) throw new Error("Trade not found or already resolved");
      const trade = tr.rows[0]!;

      // Fetch team
      const teamRow = await client.query<any>(
        `SELECT selected_player_ids, injured_player_ids FROM teams WHERE id = $1`,
        [trade.team_id]
      );
      const current: number[] = teamRow.rows[0]!.selected_player_ids ?? [];
      const after = [...current.filter((id: number) => !trade.sell_player_ids.includes(id)), ...trade.buy_player_ids];
      const injuredAfter: number[] = (teamRow.rows[0]!.injured_player_ids ?? []).filter(
        (id: number) => !trade.sell_player_ids.includes(id)
      );

      await client.query(
        `UPDATE teams SET selected_player_ids = $1::jsonb, injured_player_ids = $2::jsonb, updated_at = NOW()
           WHERE id = $3`,
        [JSON.stringify(after), JSON.stringify(injuredAfter), trade.team_id]
      );
      await client.query(
        `UPDATE trade_proposals SET status = 'approved', resolved_at = NOW() WHERE id = $1`,
        [tradeId]
      );
      // Apply the cash delta to the current phase result if one exists
      await client.query(
        `UPDATE phase_results SET
           cumulative_cash_flow = cumulative_cash_flow + $1,
           net_cash_flow = net_cash_flow + $1,
           event_impact = event_impact + $1
         WHERE session_id = $2 AND team_id = $3
           AND phase = (SELECT MAX(phase) FROM phase_results WHERE session_id = $2 AND team_id = $3)`,
        [trade.projected_cash_delta, trade.session_id, trade.team_id]
      );
    });
    res.json({ status: "approved" });
  } catch (err) {
    next(err);
  }
});

teamsRouter.post("/trades/:tradeId/reject", requireFacilitator, async (req, res, next) => {
  try {
    const schema = z.object({ note: z.string().optional() });
    const body = schema.parse(req.body);
    const result = await pool.query(
      `UPDATE trade_proposals SET status = 'rejected', resolved_at = NOW(), facilitator_note = $1
         WHERE id = $2 AND status = 'pending'`,
      [body.note ?? null, req.params.tradeId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "No pending trade", code: "NO_TRADE" });
    res.json({ status: "rejected" });
  } catch (err) {
    next(err);
  }
});
