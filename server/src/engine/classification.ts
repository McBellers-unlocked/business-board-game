import type {
  GameConfig,
  PlayerConfig,
  TeamClassification,
  Team
} from "@dcl/shared";

export interface TeamIndexResult {
  totalPlayerIndex: number;
  teamIndex: number;
  classification: TeamClassification | null;
  activePlayerCount: number;
}

/**
 * Team Index = sum(playerIndex for all non-injured / non-suspended selected players) / 14.
 * Injured or suspended players are excluded (spec: "injured players are excluded from calculation").
 * Returns classification null when no players are selected yet.
 */
export function computeTeamIndex(
  selectedPlayerIds: number[],
  injuredPlayerIds: number[],
  suspendedPlayerIds: number[],
  config: GameConfig
): TeamIndexResult {
  const excluded = new Set<number>([...injuredPlayerIds, ...suspendedPlayerIds]);
  const active = selectedPlayerIds.filter((id) => !excluded.has(id));
  const playerIndexSum = active.reduce((sum, id) => {
    const p = config.players.find((pp) => pp.id === id);
    return sum + (p ? p.playerIndex : 0);
  }, 0);

  const divisor = config.teamConstraints.teamIndexDivisor;
  const teamIndex = playerIndexSum / divisor;

  let classification: TeamClassification | null;
  if (selectedPlayerIds.length === 0) {
    classification = null;
  } else if (teamIndex > config.teamConstraints.goodThreshold) {
    classification = "Good";
  } else if (teamIndex >= config.teamConstraints.averageLowerThreshold) {
    classification = "Average";
  } else {
    classification = "Poor";
  }

  return {
    totalPlayerIndex: playerIndexSum,
    teamIndex,
    classification,
    activePlayerCount: active.length
  };
}

export interface SquadValidation {
  isValid: boolean;
  errors: string[];
  counts: { total: number; batters: number; bowlers: number; allRounders: number };
}

/**
 * Per Section 6: min 12, max 20, ≥6 batters (incl. all-rounders), ≥5 bowlers (incl. all-rounders).
 */
export function validateSquad(selectedPlayerIds: number[], config: GameConfig): SquadValidation {
  const selected = config.players.filter((p) => selectedPlayerIds.includes(p.id));
  const counts = {
    total: selected.length,
    batters: selected.filter((p) => p.type === "Batsman" || p.type === "All-Rounder").length,
    bowlers: selected.filter((p) => p.type === "Bowler" || p.type === "All-Rounder").length,
    allRounders: selected.filter((p) => p.type === "All-Rounder").length
  };
  const c = config.teamConstraints;
  const errors: string[] = [];
  if (counts.total < c.minPlayers) errors.push(`Squad has ${counts.total} players, minimum is ${c.minPlayers}.`);
  if (counts.total > c.maxPlayers) errors.push(`Squad has ${counts.total} players, maximum is ${c.maxPlayers}.`);
  if (counts.batters < c.minBatters) errors.push(`Squad has ${counts.batters} batters (incl. all-rounders), minimum is ${c.minBatters}.`);
  if (counts.bowlers < c.minBowlers) errors.push(`Squad has ${counts.bowlers} bowlers (incl. all-rounders), minimum is ${c.minBowlers}.`);
  return { isValid: errors.length === 0, errors, counts };
}

export function playerById(config: GameConfig, id: number): PlayerConfig | undefined {
  return config.players.find((p) => p.id === id);
}

export function squadTotals(selectedPlayerIds: number[], config: GameConfig): {
  totalPurchaseCost: number;
  totalAnnualSalary: number;
} {
  let totalPurchaseCost = 0;
  let totalAnnualSalary = 0;
  for (const id of selectedPlayerIds) {
    const p = playerById(config, id);
    if (!p) continue;
    totalPurchaseCost += p.purchaseCost;
    totalAnnualSalary += p.annualSalary;
  }
  return { totalPurchaseCost, totalAnnualSalary };
}

export function debtRequired(
  stadiumCost: number,
  squadPurchaseCost: number,
  equityFinance: number
): number {
  return Math.max(0, stadiumCost + squadPurchaseCost - equityFinance);
}
