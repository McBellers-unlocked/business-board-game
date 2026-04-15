import type {
  GameConfig,
  PhaseConfig,
  StadiumConfig,
  FBScheme,
  SpectatorRules
} from "@dcl/shared";

export function getStadium(config: GameConfig, key: string | null): StadiumConfig | null {
  if (!key) return null;
  return config.stadiums.find((s) => s.key === key) ?? null;
}

export function getPhase(config: GameConfig, phase: number): PhaseConfig {
  const p = config.phases.find((pp) => pp.phase === phase);
  if (!p) throw new Error(`Phase ${phase} not found in config`);
  return p;
}

export function spectatorPctForPosition(rules: SpectatorRules, leaguePosition: number): number {
  for (const r of rules.rules) {
    if (leaguePosition >= r.minPosition && leaguePosition <= r.maxPosition) return r.pct;
  }
  // Fallback — should not occur for a valid 1..8 position
  return rules.initialPct;
}

export interface PhaseFinancialInput {
  phase: PhaseConfig;
  stadium: StadiumConfig;
  fbScheme: FBScheme;
  spectatorPct: number;                    // Already adjusted for events if applicable
  totalAnnualSalary: number;
  debtRequired: number;
  annualInterestRate: number;
  totalMatchesInSeason: number;
  extraCashImpact?: number;                // Sum of financial-impact events for this team/phase
}

export interface PhaseFinancialOutput {
  spectatorsPerMatch: number;
  ticketRevenue: number;                   // Home matches
  tvRevenue: number;                       // Away matches
  fbRevenue: number;
  totalRevenue: number;
  salaryCost: number;
  interestCost: number;
  eventImpact: number;
  netCashFlow: number;
}

/**
 * Formulas mirror FR-06 exactly.
 *
 *   spectators           = stadium.capacity × spectatorPct
 *   ticketRevenue        = spectators × stadium.ticketPrice × homeMatches
 *   tvRevenue            = spectators × stadium.ticketPrice × awayMatches
 *   fbRevenue (fixed)    = stadium.fbOutlets × stadium.fbFixedFeePerMonth × phase.monthsInPhase
 *   fbRevenue (revenue)  = spectators × stadium.fbSpectatorPct × stadium.fbAveragePrice × stadium.fbRevenuePct × homeMatches
 *   salaryCost           = totalAnnualSalary × (phase.matches / totalMatchesInSeason)
 *   interestCost         = debtRequired × annualInterestRate × (phase.matches / totalMatchesInSeason)
 *   netCashFlow          = totalRevenue - salaryCost - interestCost + extraCashImpact
 */
export function computePhaseFinancials(input: PhaseFinancialInput): PhaseFinancialOutput {
  const {
    phase,
    stadium,
    fbScheme,
    spectatorPct,
    totalAnnualSalary,
    debtRequired,
    annualInterestRate,
    totalMatchesInSeason,
    extraCashImpact = 0
  } = input;

  const spectatorsPerMatch = stadium.capacity * spectatorPct;
  const ticketRevenue = spectatorsPerMatch * stadium.ticketPrice * phase.homeMatches;
  // DTV pays the equivalent of home ticket revenue for away matches (per game rules).
  const tvRevenue = spectatorsPerMatch * stadium.ticketPrice * phase.awayMatches;

  let fbRevenue = 0;
  if (fbScheme === "fixed") {
    fbRevenue = stadium.fbOutlets * stadium.fbFixedFeePerMonth * phase.monthsInPhase;
  } else {
    fbRevenue =
      spectatorsPerMatch *
      stadium.fbSpectatorPct *
      stadium.fbAveragePrice *
      stadium.fbRevenuePct *
      phase.homeMatches;
  }

  const totalRevenue = ticketRevenue + tvRevenue + fbRevenue;
  const phaseFraction = phase.matches / totalMatchesInSeason;
  const salaryCost = totalAnnualSalary * phaseFraction;
  const interestCost = debtRequired * annualInterestRate * phaseFraction;

  const netCashFlow = totalRevenue - salaryCost - interestCost + extraCashImpact;

  return {
    spectatorsPerMatch,
    ticketRevenue,
    tvRevenue,
    fbRevenue,
    totalRevenue,
    salaryCost,
    interestCost,
    eventImpact: extraCashImpact,
    netCashFlow
  };
}

export function computeRoe(cumulativeCashFlow: number, equityFinance: number): number {
  if (equityFinance <= 0) return 0;
  return cumulativeCashFlow / equityFinance;
}

export function resaleValue(
  originalPurchaseCost: number,
  leaguePosition: number,
  injured: boolean,
  rules: { injuredPct: number; rules: { minPosition: number; maxPosition: number; pct: number }[] }
): number {
  if (injured) return originalPurchaseCost * rules.injuredPct;
  for (const r of rules.rules) {
    if (leaguePosition >= r.minPosition && leaguePosition <= r.maxPosition) {
      return originalPurchaseCost * r.pct;
    }
  }
  return originalPurchaseCost * 0.6; // conservative fallback
}
