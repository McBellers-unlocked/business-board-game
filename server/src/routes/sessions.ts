import { Router } from "express";
import { z } from "zod";
import { pool, withTx } from "../db/pool.js";
import { requireFacilitator, requireAuth, getFacilitator } from "../auth/middleware.js";
import { generateUniqueGameCode } from "../services/gameCode.js";
import { generateAiTeam, spreadClassifications } from "../services/aiTeams.js";
import { Rng, randomSeed } from "../engine/rng.js";
import { generateFixtures } from "../engine/fixtures.js";
import { simulatePhase, teamPhaseInputFromTeam } from "../engine/phaseOrchestrator.js";
import {
  loadConfig,
  loadLeagueTable,
  loadPhaseResults,
  loadSession,
  loadTeams
} from "../services/sessionQueries.js";
import type { GameConfig, SessionStatus, Team } from "@dcl/shared";

export const sessionsRouter = Router();

// -------------------- List sessions (facilitator) --------------------
sessionsRouter.get("/", requireFacilitator, async (req, res, next) => {
  try {
    const fid = getFacilitator(req).facilitatorId;
    const result = await pool.query(
      `SELECT s.id, s.game_code, s.status, s.human_team_count, s.current_phase,
              s.created_at, s.updated_at, c.name AS config_name
         FROM game_sessions s
         JOIN game_configs c ON c.id = s.config_id
        WHERE s.facilitator_id = $1
        ORDER BY s.created_at DESC`,
      [fid]
    );
    res.json({ sessions: result.rows });
  } catch (err) {
    next(err);
  }
});

// -------------------- Create session --------------------
const createSchema = z.object({
  configId: z.string().uuid(),
  humanTeamCount: z.number().int().min(1).max(8)
});

sessionsRouter.post("/", requireFacilitator, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const fid = getFacilitator(req).facilitatorId;

    const configRow = await pool.query<{ config: GameConfig; name: string }>(
      "SELECT config, name FROM game_configs WHERE id = $1",
      [body.configId]
    );
    if (configRow.rowCount === 0) return res.status(404).json({ error: "Config not found", code: "NO_CONFIG" });
    const config = configRow.rows[0]!.config;

    const gameCode = await generateUniqueGameCode();
    const seed = randomSeed();
    const rng = new Rng(seed);

    // Generate fixtures for 8-team double round-robin
    const fixtures = generateFixtures(8, config.phases, rng);

    const session = await withTx(async (client) => {
      const insertSession = await client.query<{ id: string }>(
        `INSERT INTO game_sessions
           (config_id, facilitator_id, game_code, human_team_count, random_seed, fixture_list, composite_weights)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
         RETURNING id`,
        [
          body.configId,
          fid,
          gameCode,
          body.humanTeamCount,
          seed,
          JSON.stringify(fixtures),
          JSON.stringify(config.compositeScoreWeights)
        ]
      );
      const sessionId = insertSession.rows[0]!.id;

      // Build 8 teams: first `humanTeamCount` are human, rest are AI
      const classSpread = spreadClassifications(8, rng);
      const usedNames = new Set<string>();
      const pickHumanName = (slot: number) => {
        // Default: "Team 1", "Team 2", etc — user will rename during setup
        const name = `Team ${slot + 1}`;
        usedNames.add(name);
        return name;
      };
      const aiNames = [...config.aiTeamNames];
      rng.shuffle(aiNames);
      let aiNameIdx = 0;

      for (let slot = 0; slot < 8; slot++) {
        if (slot < body.humanTeamCount) {
          await client.query(
            `INSERT INTO teams (session_id, name, is_ai, slot_index)
               VALUES ($1, $2, FALSE, $3)`,
            [sessionId, pickHumanName(slot), slot]
          );
        } else {
          const name = aiNames[aiNameIdx++] ?? `AI Team ${slot - body.humanTeamCount + 1}`;
          const ai = generateAiTeam({
            name,
            slotIndex: slot,
            config,
            target: classSpread[slot]!,
            rng
          });
          await client.query(
            `INSERT INTO teams
               (session_id, name, is_ai, slot_index, stadium_choice, fb_scheme,
                selected_player_ids, equity_finance, setup_complete)
             VALUES ($1, $2, TRUE, $3, $4, $5, $6::jsonb, $7, TRUE)`,
            [
              sessionId,
              ai.name,
              slot,
              ai.stadiumChoice,
              ai.fbScheme,
              JSON.stringify(ai.selectedPlayerIds),
              ai.equityFinance
            ]
          );
        }
      }

      return { id: sessionId, gameCode };
    });

    res.status(201).json({ id: session.id, gameCode: session.gameCode });
  } catch (err) {
    next(err);
  }
});

// -------------------- Session detail --------------------
// Accessible to both facilitator and team member (filtered by caller type)
sessionsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id!;
    const session = await loadSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found", code: "NO_SESSION" });

    // Authz
    const auth = req.auth!;
    if (auth.kind === "facilitator" && session.facilitatorId !== auth.facilitatorId) {
      return res.status(403).json({ error: "Not your session", code: "FORBIDDEN" });
    }
    if (auth.kind === "team" && auth.sessionId !== sessionId) {
      return res.status(403).json({ error: "Cross-session access", code: "FORBIDDEN" });
    }

    const config = await loadConfig(session.configId);
    if (!config) return res.status(404).json({ error: "Config missing", code: "NO_CONFIG" });

    const teams = await loadTeams(sessionId, config);
    const phaseResults = await loadPhaseResults(sessionId);
    const leagueTable = await loadLeagueTable(sessionId, config);

    // If team caller, strip financial internals of other teams
    const filteredTeams =
      auth.kind === "team"
        ? teams.map((t) => (t.id === auth.teamId ? t : sanitiseForOpponents(t)))
        : teams;

    res.json({
      session,
      config,
      teams: filteredTeams,
      phaseResults,
      leagueTable
    });
  } catch (err) {
    next(err);
  }
});

function sanitiseForOpponents(team: Team): Team {
  return {
    ...team,
    selectedPlayerIds: [],
    injuredPlayerIds: [],
    suspendedPlayerIds: [],
    equityFinance: 0,
    debtRequired: 0,
    totalPurchaseCost: 0,
    totalAnnualSalary: 0,
    cumulativeCashFlow: 0,
    roe: 0,
    members: [] // privacy for roster membership visibility
  };
}

// -------------------- Reset --------------------
sessionsRouter.post("/:id/reset", requireFacilitator, async (req, res, next) => {
  try {
    const sessionId = req.params.id!;
    const session = await loadSession(sessionId);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    if (session.facilitatorId !== getFacilitator(req).facilitatorId) {
      return res.status(403).json({ error: "Not your session", code: "FORBIDDEN" });
    }
    await withTx(async (client) => {
      await client.query(`DELETE FROM phase_results WHERE session_id = $1`, [sessionId]);
      await client.query(`DELETE FROM game_events WHERE session_id = $1`, [sessionId]);
      await client.query(`DELETE FROM qualitative_scores WHERE session_id = $1`, [sessionId]);
      await client.query(`DELETE FROM trade_proposals WHERE session_id = $1`, [sessionId]);
      await client.query(
        `UPDATE teams SET injured_player_ids = '[]'::jsonb, suspended_player_ids = '[]'::jsonb
           WHERE session_id = $1`,
        [sessionId]
      );
      await client.query(
        `UPDATE game_sessions SET status = 'setup', current_phase = 0, updated_at = NOW()
           WHERE id = $1`,
        [sessionId]
      );
    });
    res.json({ status: "reset" });
  } catch (err) {
    next(err);
  }
});

// -------------------- Advance phase (runs simulation) --------------------
sessionsRouter.post("/:id/advance-phase", requireFacilitator, async (req, res, next) => {
  try {
    const sessionId = req.params.id!;
    const session = await loadSession(sessionId);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    if (session.facilitatorId !== getFacilitator(req).facilitatorId) {
      return res.status(403).json({ error: "Not your session", code: "FORBIDDEN" });
    }
    if (session.status === "completed") {
      return res.status(400).json({ error: "Session already completed", code: "DONE" });
    }
    const nextPhase = session.currentPhase + 1;
    if (nextPhase > 4) {
      return res.status(400).json({ error: "No more phases", code: "DONE" });
    }

    const config = await loadConfig(session.configId);
    if (!config) return res.status(404).json({ error: "Config missing", code: "NO_CONFIG" });
    const teams = await loadTeams(sessionId, config);

    // Validate all teams are setup-complete (human teams)
    const notReady = teams.filter((t) => !t.isAI && !t.setupComplete).map((t) => t.name);
    if (session.currentPhase === 0 && notReady.length > 0) {
      return res.status(400).json({
        error: `Teams not setup-complete: ${notReady.join(", ")}`,
        code: "NOT_READY"
      });
    }

    const fixturesRes = await pool.query<{ fixture_list: any }>(
      `SELECT fixture_list FROM game_sessions WHERE id = $1`,
      [sessionId]
    );
    const fixtures = fixturesRes.rows[0]?.fixture_list ?? [];

    // Previous cumulative points per team
    const prevResults = await loadPhaseResults(sessionId);
    const previousCumulativePoints = new Map<string, number>();
    const lastPositionByTeam = new Map<string, number>();
    const cumulativeCashByTeam = new Map<string, number>();
    for (const r of prevResults) {
      if (r.phase === session.currentPhase) {
        previousCumulativePoints.set(r.teamId, r.cumulativePoints);
        lastPositionByTeam.set(r.teamId, r.leaguePosition);
        cumulativeCashByTeam.set(r.teamId, r.cumulativeCashFlow);
      }
    }

    // Events triggered for this phase (financial + attendance impacts)
    const eventsRes = await pool.query(
      `SELECT id, target_team_id, financial_impact, attendance_impact
         FROM game_events
        WHERE session_id = $1 AND phase = $2`,
      [sessionId, nextPhase]
    );
    const cashByTeam = new Map<string, number>();
    const attendanceMultByTeam = new Map<string, number>();
    for (const ev of eventsRes.rows) {
      const targets = ev.target_team_id ? [ev.target_team_id] : teams.map((t) => t.id);
      for (const tid of targets) {
        if (ev.financial_impact != null) {
          cashByTeam.set(tid, (cashByTeam.get(tid) ?? 0) + Number(ev.financial_impact));
        }
        if (ev.attendance_impact != null) {
          const current = attendanceMultByTeam.get(tid) ?? 1;
          attendanceMultByTeam.set(tid, current * Number(ev.attendance_impact));
        }
      }
    }

    // Build inputs for simulation
    const teamInputs = new Map<string, any>();
    for (const t of teams) {
      if (!t.stadiumChoice || !t.fbScheme || t.selectedPlayerIds.length === 0) {
        return res.status(400).json({
          error: `Team ${t.name} is not ready for simulation`,
          code: "TEAM_NOT_READY"
        });
      }
      const prevPos = lastPositionByTeam.get(t.id) ?? t.leaguePosition ?? 1;
      const prevCash = cumulativeCashByTeam.get(t.id) ?? 0;
      teamInputs.set(
        t.id,
        teamPhaseInputFromTeam(
          t,
          config,
          prevPos,
          prevCash,
          attendanceMultByTeam.get(t.id) ?? 1,
          cashByTeam.get(t.id) ?? 0
        )
      );
    }

    // Derive deterministic RNG for phase — seed XOR phase number so results differ per phase.
    const phaseRng = new Rng(session.randomSeed ^ (nextPhase * 0x9e3779b1));
    const sim = simulatePhase({
      config,
      phase: nextPhase,
      fixtures,
      teams,
      teamInputs,
      rng: phaseRng,
      previousCumulativePoints
    });

    // Persist phase results + update session status
    const newStatus = nextPhase === 4 ? "completed" : (`phase${nextPhase}` as SessionStatus);
    await withTx(async (client) => {
      for (const [teamId, out] of sim.perTeam) {
        const position = sim.leagueTable.find((r) => r.teamId === teamId)!.position;
        await client.query(
          `INSERT INTO phase_results
             (session_id, team_id, phase, matches, wins, draws, losses, points, cumulative_points,
              league_position, spectator_pct,
              ticket_revenue, fb_revenue, tv_revenue, total_revenue, salary_cost, interest_cost, event_impact,
              net_cash_flow, cumulative_cash_flow, roe)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
           ON CONFLICT (session_id, team_id, phase) DO UPDATE SET
             matches = EXCLUDED.matches,
             wins = EXCLUDED.wins,
             draws = EXCLUDED.draws,
             losses = EXCLUDED.losses,
             points = EXCLUDED.points,
             cumulative_points = EXCLUDED.cumulative_points,
             league_position = EXCLUDED.league_position,
             spectator_pct = EXCLUDED.spectator_pct,
             ticket_revenue = EXCLUDED.ticket_revenue,
             fb_revenue = EXCLUDED.fb_revenue,
             tv_revenue = EXCLUDED.tv_revenue,
             total_revenue = EXCLUDED.total_revenue,
             salary_cost = EXCLUDED.salary_cost,
             interest_cost = EXCLUDED.interest_cost,
             event_impact = EXCLUDED.event_impact,
             net_cash_flow = EXCLUDED.net_cash_flow,
             cumulative_cash_flow = EXCLUDED.cumulative_cash_flow,
             roe = EXCLUDED.roe`,
          [
            sessionId,
            teamId,
            nextPhase,
            JSON.stringify(out.matches),
            out.wins,
            out.draws,
            out.losses,
            out.pointsThisPhase,
            out.cumulativePoints,
            position,
            out.spectatorPct,
            out.financials.ticketRevenue,
            out.financials.fbRevenue,
            out.financials.tvRevenue,
            out.financials.totalRevenue,
            out.financials.salaryCost,
            out.financials.interestCost,
            out.financials.eventImpact,
            out.financials.netCashFlow,
            out.cumulativeCashFlow,
            out.roe
          ]
        );
      }

      await client.query(
        `UPDATE game_sessions SET current_phase = $1, status = $2, updated_at = NOW() WHERE id = $3`,
        [nextPhase, newStatus, sessionId]
      );
    });

    res.json({
      status: newStatus,
      currentPhase: nextPhase,
      results: [...sim.perTeam.values()],
      leagueTable: sim.leagueTable
    });
  } catch (err) {
    next(err);
  }
});

// -------------------- League table --------------------
sessionsRouter.get("/:id/league-table", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id!;
    const session = await loadSession(sessionId);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    const config = await loadConfig(session.configId);
    if (!config) return res.status(404).json({ error: "No config", code: "NO_CONFIG" });
    const table = await loadLeagueTable(sessionId, config);
    res.json({ table });
  } catch (err) {
    next(err);
  }
});

// -------------------- Composite score (end of season) --------------------
sessionsRouter.get("/:id/composite", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id!;
    const session = await loadSession(sessionId);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    const config = await loadConfig(session.configId);
    if (!config) return res.status(404).json({ error: "No config", code: "NO_CONFIG" });

    const teams = await loadTeams(sessionId, config);
    const scoresRes = await pool.query<{ team_id: string; avg_score: string }>(
      `SELECT team_id, AVG(score)::NUMERIC AS avg_score
         FROM qualitative_scores
        WHERE session_id = $1
        GROUP BY team_id`,
      [sessionId]
    );
    const scoresMap = new Map(scoresRes.rows.map((r) => [r.team_id, Number(r.avg_score)] as const));

    const roes = teams.map((t) => t.roe);
    const maxRoe = Math.max(...roes);
    const minRoe = Math.min(...roes);
    const roeRange = maxRoe - minRoe || 1;
    const qualScores = Array.from(scoresMap.values());
    const maxQ = qualScores.length ? Math.max(...qualScores) : 10;

    const w = config.compositeScoreWeights;
    const rows = teams
      .map((t) => {
        const qual = scoresMap.get(t.id) ?? 0;
        const roeNorm = (t.roe - minRoe) / roeRange;
        const qualNorm = maxQ > 0 ? qual / 10 : 0; // 0..10 → 0..1
        return {
          teamId: t.id,
          teamName: t.name,
          roe: t.roe,
          roeNormalised: roeNorm,
          avgQualitativeScore: qual,
          qualitativeNormalised: qualNorm,
          compositeScore: roeNorm * w.roe + qualNorm * w.qualitative,
          compositeRank: 0
        };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((r, i) => ({ ...r, compositeRank: i + 1 }));

    res.json({ composite: rows, weights: w });
  } catch (err) {
    next(err);
  }
});
