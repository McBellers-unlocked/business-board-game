import type {
  GameConfig,
  Team,
  MatchResult,
  PhaseResult,
  GameEvent,
  TeamClassification
} from "@dcl/shared";
import { Rng } from "./rng.js";
import { simulateFixture } from "./simulation.js";
import { computeTeamIndex, squadTotals, debtRequired as calcDebt } from "./classification.js";
import { computePhaseFinancials, getPhase, getStadium, spectatorPctForPosition } from "./financial.js";
import type { Fixture } from "./fixtures.js";

export interface TeamPhaseInput {
  team: Team;
  classification: TeamClassification;
  totalAnnualSalary: number;
  debtRequired: number;
  previousLeaguePosition: number;          // Used for spectator %
  spectatorOverrideMultiplier?: number;    // From attendance-impact events (1.0 = none)
  cumulativeCashFlow: number;
  eventCashImpact: number;                 // Financial-impact events this phase
}

export interface TeamPhaseOutput {
  teamId: string;
  matches: MatchResult[];
  wins: number;
  draws: number;
  losses: number;
  pointsThisPhase: number;
  cumulativePoints: number;
  spectatorPct: number;
  financials: ReturnType<typeof computePhaseFinancials>;
  cumulativeCashFlow: number;
  roe: number;
}

export interface PhaseSimulationInput {
  config: GameConfig;
  phase: number;
  fixtures: Fixture[];                     // All fixtures for the whole session
  teams: Team[];                           // In slot_index order
  teamInputs: Map<string, TeamPhaseInput>; // Keyed by teamId
  rng: Rng;
  previousCumulativePoints: Map<string, number>;
}

export interface PhaseSimulationResult {
  perTeam: Map<string, TeamPhaseOutput>;
  leagueTable: { teamId: string; position: number }[];
}

/**
 * Simulate a full phase for all 8 teams.
 *
 * 1. Filter the fixture list for this phase.
 * 2. Simulate each fixture with a single coherent roll (home perspective).
 * 3. Sum per-team W/D/L + points this phase.
 * 4. Compute league table (cumulative points, tiebreakers).
 * 5. Compute financials per team using their PREVIOUS phase's league position
 *    for spectator % (as the spec: "level of spectators... for the next phase").
 */
export function simulatePhase(input: PhaseSimulationInput): PhaseSimulationResult {
  const { config, phase, fixtures, teams, teamInputs, rng, previousCumulativePoints } = input;

  const phaseFixtures = fixtures.filter((f) => f.phase === phase);
  const teamsBySlot = new Map<number, Team>();
  teams.forEach((t, idx) => teamsBySlot.set(idx, t));

  // Per-team accumulators for this phase
  const perTeamMatches = new Map<string, MatchResult[]>();
  const perTeamPoints = new Map<string, number>();
  const perTeamWDL = new Map<string, { w: number; d: number; l: number }>();

  for (const team of teams) {
    perTeamMatches.set(team.id, []);
    perTeamPoints.set(team.id, 0);
    perTeamWDL.set(team.id, { w: 0, d: 0, l: 0 });
  }

  for (const f of phaseFixtures) {
    const home = teamsBySlot.get(f.homeTeamIndex);
    const away = teamsBySlot.get(f.awayTeamIndex);
    if (!home || !away) continue;
    const homeInput = teamInputs.get(home.id);
    const awayInput = teamInputs.get(away.id);
    if (!homeInput || !awayInput) continue;

    const sim = simulateFixture({
      homeTeamIndex: f.homeTeamIndex,
      awayTeamIndex: f.awayTeamIndex,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeTeamName: home.name,
      awayTeamName: away.name,
      homeClass: homeInput.classification,
      awayClass: awayInput.classification,
      matchNumber: f.matchNumberInPhase,
      config,
      rng
    });

    perTeamMatches.get(home.id)!.push(sim.homeResult);
    perTeamMatches.get(away.id)!.push(sim.awayResult);

    addOutcome(perTeamWDL, home.id, sim.homeResult.result);
    addOutcome(perTeamWDL, away.id, sim.awayResult.result);

    perTeamPoints.set(home.id, perTeamPoints.get(home.id)! + sim.homeResult.pointsAwarded);
    perTeamPoints.set(away.id, perTeamPoints.get(away.id)! + sim.awayResult.pointsAwarded);
  }

  // Cumulative points across season so far
  const cumulative = new Map<string, number>();
  for (const team of teams) {
    cumulative.set(team.id, (previousCumulativePoints.get(team.id) ?? 0) + (perTeamPoints.get(team.id) ?? 0));
  }

  // League table — sort by cumulative points, then wins (cumulative), then name
  const leagueRows = teams
    .map((t) => ({
      teamId: t.id,
      name: t.name,
      points: cumulative.get(t.id)!,
      wins: (perTeamWDL.get(t.id)!.w ?? 0) // only this phase's wins — tiebreaker intent is "most wins" — caller aggregates
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });
  const leagueTable = leagueRows.map((r, i) => ({ teamId: r.teamId, position: i + 1 }));
  const positionByTeam = new Map(leagueTable.map((r) => [r.teamId, r.position] as const));

  // Financials per team
  const perTeam = new Map<string, TeamPhaseOutput>();
  const phaseCfg = getPhase(config, phase);

  for (const team of teams) {
    const input = teamInputs.get(team.id)!;
    const stadium = getStadium(config, team.stadiumChoice);
    const fbScheme = team.fbScheme ?? "revenue";
    if (!stadium) {
      throw new Error(`Team ${team.name} has no stadium; cannot simulate phase.`);
    }
    const basePct = spectatorPctForPosition(config.spectatorRules, input.previousLeaguePosition);
    const spectatorPct = basePct * (input.spectatorOverrideMultiplier ?? 1);

    const financials = computePhaseFinancials({
      phase: phaseCfg,
      stadium,
      fbScheme,
      spectatorPct,
      totalAnnualSalary: input.totalAnnualSalary,
      debtRequired: input.debtRequired,
      annualInterestRate: config.financingRules.annualInterestRate,
      totalMatchesInSeason: config.financingRules.totalMatchesInSeason,
      extraCashImpact: input.eventCashImpact
    });

    const cumulativeCashFlow = input.cumulativeCashFlow + financials.netCashFlow;
    const roe = team.equityFinance > 0 ? cumulativeCashFlow / team.equityFinance : 0;

    const wdl = perTeamWDL.get(team.id)!;
    perTeam.set(team.id, {
      teamId: team.id,
      matches: perTeamMatches.get(team.id)!,
      wins: wdl.w,
      draws: wdl.d,
      losses: wdl.l,
      pointsThisPhase: perTeamPoints.get(team.id)!,
      cumulativePoints: cumulative.get(team.id)!,
      spectatorPct,
      financials,
      cumulativeCashFlow,
      roe
    });
  }

  return { perTeam, leagueTable };
}

function addOutcome(
  map: Map<string, { w: number; d: number; l: number }>,
  teamId: string,
  outcome: string
) {
  const wdl = map.get(teamId)!;
  if (outcome === "Win") wdl.w++;
  else if (outcome === "Draw") wdl.d++;
  else wdl.l++;
}

// -------------------------------------------------------------------------
// Helper to build a TeamPhaseInput from a Team + GameConfig + engine state.
// -------------------------------------------------------------------------
export function teamPhaseInputFromTeam(
  team: Team,
  config: GameConfig,
  prevLeaguePosition: number,
  cumulativeCashFlow: number,
  spectatorOverrideMultiplier: number,
  eventCashImpact: number
): TeamPhaseInput {
  const idx = computeTeamIndex(
    team.selectedPlayerIds,
    team.injuredPlayerIds,
    team.suspendedPlayerIds,
    config
  );
  const totals = squadTotals(team.selectedPlayerIds, config);
  const stadium = getStadium(config, team.stadiumChoice);
  const debtRequired = calcDebt(
    stadium?.purchaseCost ?? 0,
    totals.totalPurchaseCost,
    team.equityFinance
  );
  if (!idx.classification) {
    throw new Error(`Team ${team.name} has no classification (no players selected).`);
  }
  return {
    team,
    classification: idx.classification,
    totalAnnualSalary: totals.totalAnnualSalary,
    debtRequired,
    previousLeaguePosition: prevLeaguePosition,
    spectatorOverrideMultiplier,
    cumulativeCashFlow,
    eventCashImpact
  };
}
