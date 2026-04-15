import { pool } from "../db/pool.js";
import type {
  GameConfig,
  Team,
  TeamMember,
  PhaseResult,
  LeagueTableRow,
  GameSession
} from "@dcl/shared";
import { computeTeamIndex, squadTotals, debtRequired as calcDebt } from "../engine/classification.js";
import { getStadium } from "../engine/financial.js";

export async function loadSession(sessionId: string): Promise<GameSession | null> {
  const res = await pool.query<{
    id: string;
    config_id: string;
    facilitator_id: string;
    game_code: string;
    status: string;
    human_team_count: number;
    current_phase: number;
    random_seed: string;
    created_at: string;
    updated_at: string;
    config_name: string;
  }>(
    `SELECT s.*, c.name AS config_name
       FROM game_sessions s
       JOIN game_configs c ON c.id = s.config_id
       WHERE s.id = $1`,
    [sessionId]
  );
  if (res.rowCount === 0) return null;
  const r = res.rows[0]!;
  return {
    id: r.id,
    gameCode: r.game_code,
    configId: r.config_id,
    facilitatorId: r.facilitator_id,
    status: r.status as any,
    humanTeamCount: r.human_team_count,
    currentPhase: r.current_phase,
    randomSeed: Number(r.random_seed),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    configName: r.config_name
  };
}

export async function loadConfig(configId: string): Promise<GameConfig | null> {
  const res = await pool.query<{ config: GameConfig }>(
    "SELECT config FROM game_configs WHERE id = $1",
    [configId]
  );
  if (res.rowCount === 0) return null;
  return res.rows[0]!.config;
}

export async function loadTeams(sessionId: string, config: GameConfig): Promise<Team[]> {
  const teamsRes = await pool.query<{
    id: string;
    session_id: string;
    name: string;
    is_ai: boolean;
    slot_index: number;
    stadium_choice: string | null;
    fb_scheme: "fixed" | "revenue" | null;
    selected_player_ids: number[];
    injured_player_ids: number[];
    suspended_player_ids: number[];
    equity_finance: string;
    setup_complete: boolean;
  }>(
    `SELECT id, session_id, name, is_ai, slot_index, stadium_choice, fb_scheme,
            selected_player_ids, injured_player_ids, suspended_player_ids,
            equity_finance, setup_complete
       FROM teams
      WHERE session_id = $1
      ORDER BY slot_index`,
    [sessionId]
  );

  const teamIds = teamsRes.rows.map((r) => r.id);
  const membersRes = teamIds.length
    ? await pool.query<{
        id: string;
        team_id: string;
        display_name: string;
        role: "MD" | "FD" | "SD" | "MPRD" | "OM";
        joined_at: string;
      }>(
        `SELECT id, team_id, display_name, role, joined_at
           FROM team_members
          WHERE team_id = ANY($1)`,
        [teamIds]
      )
    : { rows: [] as { id: string; team_id: string; display_name: string; role: string; joined_at: string }[] };

  const membersByTeam = new Map<string, TeamMember[]>();
  for (const m of membersRes.rows) {
    const arr = membersByTeam.get(m.team_id) ?? [];
    arr.push({
      id: m.id,
      teamId: m.team_id,
      displayName: m.display_name,
      role: m.role as any,
      joinedAt: m.joined_at
    });
    membersByTeam.set(m.team_id, arr);
  }

  // Latest phase result per team for league position / cumulative cash
  const phaseResRes = teamIds.length
    ? await pool.query<{
        team_id: string;
        phase: number;
        league_position: number;
        cumulative_points: number;
        cumulative_cash_flow: string;
        roe: string;
      }>(
        `SELECT team_id, phase, league_position, cumulative_points, cumulative_cash_flow, roe
           FROM phase_results
          WHERE session_id = $1
          ORDER BY phase DESC`,
        [sessionId]
      )
    : { rows: [] as any[] };

  const latestByTeam = new Map<
    string,
    { leaguePosition: number; cumulativePoints: number; cumulativeCashFlow: number; roe: number }
  >();
  for (const r of phaseResRes.rows) {
    if (!latestByTeam.has(r.team_id)) {
      latestByTeam.set(r.team_id, {
        leaguePosition: r.league_position,
        cumulativePoints: r.cumulative_points,
        cumulativeCashFlow: Number(r.cumulative_cash_flow),
        roe: Number(r.roe)
      });
    }
  }

  return teamsRes.rows.map((r, idx) => {
    const members = membersByTeam.get(r.id) ?? [];
    const idxCalc = computeTeamIndex(
      r.selected_player_ids,
      r.injured_player_ids,
      r.suspended_player_ids,
      config
    );
    const totals = squadTotals(r.selected_player_ids, config);
    const stadium = getStadium(config, r.stadium_choice);
    const equity = Number(r.equity_finance);
    const debt = calcDebt(stadium?.purchaseCost ?? 0, totals.totalPurchaseCost, equity);
    const latest = latestByTeam.get(r.id);
    return {
      id: r.id,
      sessionId: r.session_id,
      name: r.name,
      isAI: r.is_ai,
      stadiumChoice: r.stadium_choice,
      fbScheme: r.fb_scheme,
      selectedPlayerIds: r.selected_player_ids,
      injuredPlayerIds: r.injured_player_ids,
      suspendedPlayerIds: r.suspended_player_ids,
      equityFinance: equity,
      setupComplete: r.setup_complete,
      members,
      teamIndex: idxCalc.teamIndex,
      teamClassification: idxCalc.classification,
      debtRequired: debt,
      totalPurchaseCost: totals.totalPurchaseCost,
      totalAnnualSalary: totals.totalAnnualSalary,
      leaguePosition: latest?.leaguePosition ?? idx + 1,
      totalPoints: latest?.cumulativePoints ?? 0,
      cumulativeCashFlow: latest?.cumulativeCashFlow ?? 0,
      roe: latest?.roe ?? 0
    };
  });
}

export async function loadPhaseResults(sessionId: string): Promise<PhaseResult[]> {
  const res = await pool.query<any>(
    `SELECT * FROM phase_results WHERE session_id = $1 ORDER BY phase, league_position`,
    [sessionId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    teamId: r.team_id,
    phase: r.phase,
    matches: r.matches,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    pointsThisPhase: r.points,
    cumulativePoints: r.cumulative_points,
    leaguePosition: r.league_position,
    spectatorPct: Number(r.spectator_pct),
    ticketRevenue: Number(r.ticket_revenue),
    fbRevenue: Number(r.fb_revenue),
    tvRevenue: Number(r.tv_revenue),
    totalRevenue: Number(r.total_revenue),
    salaryCost: Number(r.salary_cost),
    interestCost: Number(r.interest_cost),
    eventImpact: Number(r.event_impact),
    netCashFlow: Number(r.net_cash_flow),
    cumulativeCashFlow: Number(r.cumulative_cash_flow),
    roe: Number(r.roe),
    createdAt: r.created_at
  }));
}

export async function loadLeagueTable(sessionId: string, config: GameConfig): Promise<LeagueTableRow[]> {
  const teams = await loadTeams(sessionId, config);
  const results = await loadPhaseResults(sessionId);

  const aggByTeam = new Map<string, { w: number; d: number; l: number; played: number; points: number }>();
  for (const t of teams) aggByTeam.set(t.id, { w: 0, d: 0, l: 0, played: 0, points: 0 });
  for (const r of results) {
    const agg = aggByTeam.get(r.teamId);
    if (!agg) continue;
    agg.w += r.wins;
    agg.d += r.draws;
    agg.l += r.losses;
    agg.played += r.wins + r.draws + r.losses;
    agg.points = r.cumulativePoints;
  }

  const rows = teams
    .map((t) => {
      const agg = aggByTeam.get(t.id)!;
      return {
        position: 0,
        teamId: t.id,
        teamName: t.name,
        isAI: t.isAI,
        classification: t.teamClassification,
        played: agg.played,
        wins: agg.w,
        draws: agg.d,
        losses: agg.l,
        points: agg.points,
        cumulativeCashFlow: t.cumulativeCashFlow,
        roe: t.roe
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.teamName.localeCompare(b.teamName);
    })
    .map((row, i) => ({ ...row, position: i + 1 }));

  return rows;
}
