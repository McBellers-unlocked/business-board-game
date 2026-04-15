import type { GameConfig, TeamClassification } from "@dcl/shared";
import { Rng } from "../engine/rng.js";
import { computeTeamIndex, squadTotals } from "../engine/classification.js";

/**
 * Build a valid AI squad with a target classification.
 *   - Respect min 12, ≥6 batters, ≥5 bowlers.
 *   - Aim for a team index in the given band.
 *   - Pick a stadium pseudo-randomly weighted towards Medium.
 *   - Default F&B scheme: revenue share.
 */
export function generateAiTeam(params: {
  name: string;
  slotIndex: number;
  config: GameConfig;
  target: TeamClassification;
  rng: Rng;
}): {
  name: string;
  slotIndex: number;
  isAi: true;
  stadiumChoice: string;
  fbScheme: "fixed" | "revenue";
  selectedPlayerIds: number[];
  equityFinance: number;
} {
  const { name, slotIndex, config, target, rng } = params;

  // Pick a stadium — weighted 30/50/20
  const stadiumRoll = rng.next();
  const stadiumChoice = stadiumRoll < 0.3 ? "small" : stadiumRoll < 0.8 ? "medium" : "large";

  // Target squad size 14–16
  const squadSize = 12 + rng.int(5);

  // Candidate players sorted by player index
  const batsmen = config.players.filter((p) => p.type === "Batsman");
  const bowlers = config.players.filter((p) => p.type === "Bowler");
  const allRounders = config.players.filter((p) => p.type === "All-Rounder");

  const sortedByIndex = [...config.players].sort((a, b) => a.playerIndex - b.playerIndex);

  // Pick baseline: 6 batsmen + 5 bowlers + 1 all-rounder = 12
  const must: number[] = [];
  pickSome(rng, batsmen, 6, must);
  pickSome(rng, bowlers, 5, must);
  pickSome(rng, allRounders, 1, must);

  // Fill up to squadSize with biased picks
  const pool = [...batsmen, ...bowlers, ...allRounders].filter((p) => !must.includes(p.id));
  const bias =
    target === "Good"
      ? (a: number, b: number) => b - a         // prefer high index
      : target === "Poor"
      ? (a: number, b: number) => a - b         // prefer low index
      : () => rng.next() - 0.5;                 // random for Average

  pool.sort((a, b) => bias(a.playerIndex, b.playerIndex));
  const extras = pool.slice(0, squadSize - must.length).map((p) => p.id);
  const selectedPlayerIds = [...must, ...extras];

  // Equity: enough to cover stadium + squad roughly but not always full — force some debt
  const stadium = config.stadiums.find((s) => s.key === stadiumChoice)!;
  const totals = squadTotals(selectedPlayerIds, config);
  const totalOutlay = stadium.purchaseCost + totals.totalPurchaseCost;
  // Equity is base + random top-up between 0 and 60% of the gap
  const gap = Math.max(0, totalOutlay - config.financingRules.baseEquity);
  const topUp = Math.round(gap * (0.2 + rng.next() * 0.4));
  const equityFinance = config.financingRules.baseEquity + topUp;

  return {
    name,
    slotIndex,
    isAi: true,
    stadiumChoice,
    fbScheme: rng.next() < 0.5 ? "fixed" : "revenue",
    selectedPlayerIds,
    equityFinance
  };
}

function pickSome<T extends { id: number }>(rng: Rng, from: T[], n: number, into: number[]) {
  const shuffled = [...from];
  rng.shuffle(shuffled);
  for (let i = 0; i < n && i < shuffled.length; i++) into.push(shuffled[i]!.id);
}

/** Build a set of 8 AI-team descriptors with a spread of classifications. */
export function spreadClassifications(count: number, rng: Rng): TeamClassification[] {
  // Aim for a distribution — roughly 1/4 Good, 1/2 Average, 1/4 Poor
  const out: TeamClassification[] = [];
  for (let i = 0; i < count; i++) {
    const r = rng.next();
    if (r < 0.25) out.push("Good");
    else if (r < 0.75) out.push("Average");
    else out.push("Poor");
  }
  return out;
}
