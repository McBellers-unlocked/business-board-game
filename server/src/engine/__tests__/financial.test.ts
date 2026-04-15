import { describe, it, expect } from "vitest";
import {
  computePhaseFinancials,
  spectatorPctForPosition,
  getStadium,
  getPhase,
  resaleValue,
  computeRoe
} from "../financial.js";
import {
  computeTeamIndex,
  validateSquad,
  squadTotals,
  debtRequired
} from "../classification.js";
import { makeDefaultGameConfig, DEFAULT_SPECTATOR_RULES, DEFAULT_RESALE_RULES } from "@dcl/shared";

const config = makeDefaultGameConfig();

describe("classification & team index", () => {
  it("computes team index = sum(playerIndex) / 14", () => {
    // 12 mid-tier players: 0.85 × 3 + 0.95 × 3 + 1.05 × 3 + 1.15 × 3 = 12.0 / 14 ≈ 0.857 (Poor)
    const squad = [2, 3, 4, 10, 11, 12, 13, 15, 16, 17, 18, 5];
    const { teamIndex, classification } = computeTeamIndex(squad, [], [], config);
    const expected =
      config.players
        .filter((p) => squad.includes(p.id))
        .reduce((s, p) => s + p.playerIndex, 0) / 14;
    expect(teamIndex).toBeCloseTo(expected, 6);
    // Classification thresholds: > 1.1 Good, [0.9, 1.1] Average, < 0.9 Poor
    if (teamIndex > 1.1) expect(classification).toBe("Good");
    else if (teamIndex >= 0.9) expect(classification).toBe("Average");
    else expect(classification).toBe("Poor");
  });

  it("classifies a Good team (high-index squad)", () => {
    // 14 of the highest-index available players (9 batsmen all + 4 all-rounders + 1 bowler best)
    const squad = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20];
    const { teamIndex, classification } = computeTeamIndex(squad, [], [], config);
    expect(teamIndex).toBeGreaterThan(1.1);
    expect(classification).toBe("Good");
  });

  it("injured players are excluded from team index", () => {
    const squad = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20];
    const withAll = computeTeamIndex(squad, [], [], config);
    const withInjury = computeTeamIndex(squad, [9], [], config);
    expect(withInjury.teamIndex).toBeLessThan(withAll.teamIndex);
    expect(withInjury.totalPlayerIndex).toBe(withAll.totalPlayerIndex - 1.55);
  });

  it("validates squad size rules (≥12, ≤20, ≥6 batters, ≥5 bowlers)", () => {
    const ok = validateSquad([1, 2, 3, 4, 5, 6, 10, 11, 12, 14, 15, 16], config);
    expect(ok.isValid).toBe(true);

    const tooFew = validateSquad([1, 2, 3, 4], config);
    expect(tooFew.isValid).toBe(false);

    const notEnoughBatters = validateSquad([1, 2, 14, 15, 16, 17, 18, 19, 20, 13, 12, 11], config);
    // batters = 1,2 (batsmen) + 11,12,13 (all-rounders) = 5 — fails min 6
    expect(notEnoughBatters.isValid).toBe(false);
  });

  it("debt is max(0, stadium + squad - equity)", () => {
    expect(debtRequired(30_000_000, 8_000_000, 10_000_000)).toBe(28_000_000);
    expect(debtRequired(20_000_000, 5_000_000, 30_000_000)).toBe(0);
  });
});

describe("spectator lookup", () => {
  it("1st–2nd → 100%, 3rd–6th → 80%, 7th–8th → 60%", () => {
    expect(spectatorPctForPosition(DEFAULT_SPECTATOR_RULES, 1)).toBe(1.0);
    expect(spectatorPctForPosition(DEFAULT_SPECTATOR_RULES, 2)).toBe(1.0);
    expect(spectatorPctForPosition(DEFAULT_SPECTATOR_RULES, 3)).toBe(0.8);
    expect(spectatorPctForPosition(DEFAULT_SPECTATOR_RULES, 6)).toBe(0.8);
    expect(spectatorPctForPosition(DEFAULT_SPECTATOR_RULES, 7)).toBe(0.6);
    expect(spectatorPctForPosition(DEFAULT_SPECTATOR_RULES, 8)).toBe(0.6);
  });
});

describe("phase financials — Medium stadium, 80% attendance, Phase 1 (4 matches 2H/2A)", () => {
  const medium = getStadium(config, "medium")!;
  const phase1 = getPhase(config, 1);
  const spectatorPct = 0.8;
  const totalAnnualSalary = 1_000_000;
  const debt = 5_000_000;

  it("fixed F&B scheme", () => {
    const f = computePhaseFinancials({
      phase: phase1,
      stadium: medium,
      fbScheme: "fixed",
      spectatorPct,
      totalAnnualSalary,
      debtRequired: debt,
      annualInterestRate: 0.05,
      totalMatchesInSeason: 14
    });
    const spectators = 30_000 * 0.8; // 24,000
    expect(f.spectatorsPerMatch).toBe(spectators);
    // Ticket revenue = 24,000 × £30 × 2 home = £1,440,000
    expect(f.ticketRevenue).toBe(1_440_000);
    // TV revenue = 24,000 × £30 × 2 away = £1,440,000
    expect(f.tvRevenue).toBe(1_440_000);
    // Fixed F&B = 20 outlets × £3,000 × 3 months = £180,000
    expect(f.fbRevenue).toBe(180_000);
    // Salary for phase = 1,000,000 × 4/14
    expect(f.salaryCost).toBeCloseTo(1_000_000 * (4 / 14), 4);
    // Interest = 5,000,000 × 5% × 4/14
    expect(f.interestCost).toBeCloseTo(5_000_000 * 0.05 * (4 / 14), 4);
  });

  it("revenue-share F&B scheme", () => {
    const f = computePhaseFinancials({
      phase: phase1,
      stadium: medium,
      fbScheme: "revenue",
      spectatorPct,
      totalAnnualSalary,
      debtRequired: debt,
      annualInterestRate: 0.05,
      totalMatchesInSeason: 14
    });
    // Revenue F&B = 24,000 × 0.65 × £11 × 0.30 × 2 home
    const expectedFb = 24_000 * 0.65 * 11 * 0.3 * 2;
    expect(f.fbRevenue).toBeCloseTo(expectedFb, 4);
  });
});

describe("ROE", () => {
  it("ROE = cumulativeCashFlow / equity", () => {
    expect(computeRoe(500_000, 10_000_000)).toBe(0.05);
    expect(computeRoe(-200_000, 10_000_000)).toBe(-0.02);
    expect(computeRoe(100_000, 0)).toBe(0); // guard
  });
});

describe("resale value", () => {
  it("uses position-based multiplier", () => {
    expect(resaleValue(1_000_000, 1, false, DEFAULT_RESALE_RULES)).toBe(1_100_000);
    expect(resaleValue(1_000_000, 5, false, DEFAULT_RESALE_RULES)).toBe(800_000);
    expect(resaleValue(1_000_000, 8, false, DEFAULT_RESALE_RULES)).toBe(600_000);
  });

  it("injured players sell at 25% regardless of position", () => {
    expect(resaleValue(1_000_000, 1, true, DEFAULT_RESALE_RULES)).toBe(250_000);
    expect(resaleValue(1_000_000, 8, true, DEFAULT_RESALE_RULES)).toBe(250_000);
  });
});
