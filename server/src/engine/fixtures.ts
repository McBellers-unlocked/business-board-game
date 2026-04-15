import type { PhaseConfig } from "@dcl/shared";
import { Rng } from "./rng.js";

export interface Fixture {
  phase: number;
  matchNumberInPhase: number;
  homeTeamIndex: number;
  awayTeamIndex: number;
}

/**
 * Generate a full 8-team double round-robin schedule split across 4 phases.
 *
 * Strategy
 *   1. Use the circle method to produce 7 rounds (each round = 4 fixtures, each
 *      team plays exactly once). This covers every team-pair once (leg 1).
 *   2. Duplicate the 7 rounds with home/away swapped to get leg 2 — 7 more
 *      rounds. Total 14 rounds, 56 fixtures, each team plays 14 games with
 *      exactly 7 home + 7 away.
 *   3. Distribute rounds to phases in proportion to PhaseConfig.matches:
 *        4-3-4-3 → rounds [0..3], [4..6], [7..10], [11..13].
 *      Because each round contributes exactly one game per team, each team
 *      plays phase.matches games per phase — no constraint satisfaction needed.
 *
 * Deterministic for a given seed; only home/away within each pairing is rolled.
 */
export function generateFixtures(teamCount: number, phases: PhaseConfig[], rng: Rng): Fixture[] {
  if (teamCount !== 8) {
    throw new Error(`Fixture generator currently supports 8 teams only (got ${teamCount})`);
  }
  const totalMatches = phases.reduce((s, p) => s + p.matches, 0);
  if (totalMatches !== 14) {
    throw new Error(`Phase matches must sum to 14 (got ${totalMatches})`);
  }

  // ---- Step 1: circle-method 7 rounds of 4 fixtures each ----
  // Layout: team 0 stays fixed on the "top" slot. 1..7 rotate around.
  // In each round, pair opposite positions around the circle.
  let ring = [0, 1, 2, 3, 4, 5, 6, 7];
  const legOne: { home: number; away: number }[][] = [];
  for (let round = 0; round < 7; round++) {
    const pairings: { home: number; away: number }[] = [];
    for (let i = 0; i < 4; i++) {
      // Pair position i with position (7-i)
      const a = ring[i]!;
      const b = ring[7 - i]!;
      pairings.push({ home: a, away: b });
    }
    legOne.push(pairings);
    // Rotate positions 1..7; position 0 is fixed.
    ring = [ring[0]!, ring[7]!, ring[1]!, ring[2]!, ring[3]!, ring[4]!, ring[5]!, ring[6]!];
  }

  // ---- Step 2: leg 2 = leg 1 with home/away swapped ----
  const legTwo = legOne.map((round) => round.map((f) => ({ home: f.away, away: f.home })));

  // Optionally randomise home/away within each pairing of leg 1 (and swap in leg 2) so
  // sessions aren't perfectly identical when they share the same 8 teams.
  for (let r = 0; r < legOne.length; r++) {
    for (let i = 0; i < legOne[r]!.length; i++) {
      if (rng.next() < 0.5) {
        const f = legOne[r]![i]!;
        legOne[r]![i] = { home: f.away, away: f.home };
        const g = legTwo[r]![i]!;
        legTwo[r]![i] = { home: g.away, away: g.home };
      }
    }
  }

  const allRounds = [...legOne, ...legTwo]; // 14 rounds × 4 fixtures = 56

  // ---- Step 3: map rounds to phases ----
  // Each phase's "matches" is how many games each team plays in that phase.
  // Because each round gives every team exactly 1 game, phase i consumes
  // phases[i].matches contiguous rounds.
  const fixtures: Fixture[] = [];
  let roundCursor = 0;
  for (const phase of phases) {
    let matchNumber = 1;
    for (let r = 0; r < phase.matches; r++) {
      const round = allRounds[roundCursor++]!;
      for (const f of round) {
        fixtures.push({
          phase: phase.phase,
          matchNumberInPhase: matchNumber++,
          homeTeamIndex: f.home,
          awayTeamIndex: f.away
        });
      }
    }
  }
  return fixtures;
}
