import type {
  GameConfig,
  ProbabilityMatrix,
  TeamClassification,
  MatchOutcome,
  MatchResult
} from "@dcl/shared";
import { POINTS_DRAW, POINTS_LOSS, POINTS_WIN } from "@dcl/shared";
import { Rng } from "./rng.js";

export function rollMatchOutcome(
  myClass: TeamClassification,
  opponentClass: TeamClassification,
  matrix: ProbabilityMatrix,
  rng: Rng
): MatchOutcome {
  const key = `${myClass}-${opponentClass}`;
  const probs = matrix.entries[key];
  if (!probs) {
    throw new Error(`No probability entry for ${key}`);
  }
  const r = rng.next();
  if (r < probs.win) return "Win";
  if (r < probs.win + probs.draw) return "Draw";
  return "Loss";
}

export function pointsFor(outcome: MatchOutcome): number {
  switch (outcome) {
    case "Win":
      return POINTS_WIN;
    case "Draw":
      return POINTS_DRAW;
    case "Loss":
      return POINTS_LOSS;
  }
}

export function invertOutcome(outcome: MatchOutcome): MatchOutcome {
  if (outcome === "Win") return "Loss";
  if (outcome === "Loss") return "Win";
  return "Draw";
}

export interface SimulatedMatch {
  homeTeamIndex: number;
  awayTeamIndex: number;
  homeResult: MatchResult;
  awayResult: MatchResult;
}

/**
 * Resolve a single fixture into a consistent pair of MatchResults.
 * The outcome is rolled once from the HOME team's perspective and inverted
 * for the away team so if A beats B, B's record shows a loss to A (FR-07).
 */
export function simulateFixture(params: {
  homeTeamIndex: number;
  awayTeamIndex: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeClass: TeamClassification;
  awayClass: TeamClassification;
  matchNumber: number;
  config: GameConfig;
  rng: Rng;
}): SimulatedMatch {
  const {
    homeTeamIndex,
    awayTeamIndex,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    homeClass,
    awayClass,
    matchNumber,
    config,
    rng
  } = params;

  const homeOutcome = rollMatchOutcome(homeClass, awayClass, config.probabilityMatrix, rng);
  const awayOutcome = invertOutcome(homeOutcome);

  const homeResult: MatchResult = {
    matchNumber,
    opponentTeamId: awayTeamId,
    opponentName: awayTeamName,
    opponentClassification: awayClass,
    isHome: true,
    result: homeOutcome,
    pointsAwarded: pointsFor(homeOutcome)
  };
  const awayResult: MatchResult = {
    matchNumber,
    opponentTeamId: homeTeamId,
    opponentName: homeTeamName,
    opponentClassification: homeClass,
    isHome: false,
    result: awayOutcome,
    pointsAwarded: pointsFor(awayOutcome)
  };

  return { homeTeamIndex, awayTeamIndex, homeResult, awayResult };
}
