import { describe, it, expect } from "vitest";
import { rollMatchOutcome, invertOutcome, simulateFixture } from "../simulation.js";
import { generateFixtures } from "../fixtures.js";
import { Rng } from "../rng.js";
import { makeDefaultGameConfig } from "@dcl/shared";

const config = makeDefaultGameConfig();

describe("rng determinism", () => {
  it("same seed → same sequence", () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });
});

describe("match outcome rolls follow the probability distribution", () => {
  it("Good vs Poor → ~70% win, 20% draw, 10% loss (tolerance 3%)", () => {
    const rng = new Rng(42);
    const N = 20_000;
    let w = 0,
      d = 0,
      l = 0;
    for (let i = 0; i < N; i++) {
      const r = rollMatchOutcome("Good", "Poor", config.probabilityMatrix, rng);
      if (r === "Win") w++;
      else if (r === "Draw") d++;
      else l++;
    }
    expect(w / N).toBeCloseTo(0.7, 1);
    expect(d / N).toBeCloseTo(0.2, 1);
    expect(l / N).toBeCloseTo(0.1, 1);
  });

  it("Poor vs Good → ~10% win, 20% draw, 70% loss", () => {
    const rng = new Rng(7);
    const N = 20_000;
    let w = 0,
      d = 0,
      l = 0;
    for (let i = 0; i < N; i++) {
      const r = rollMatchOutcome("Poor", "Good", config.probabilityMatrix, rng);
      if (r === "Win") w++;
      else if (r === "Draw") d++;
      else l++;
    }
    expect(w / N).toBeCloseTo(0.1, 1);
    expect(d / N).toBeCloseTo(0.2, 1);
    expect(l / N).toBeCloseTo(0.7, 1);
  });

  it("Average vs Average → ~25/50/25", () => {
    const rng = new Rng(99);
    const N = 20_000;
    let w = 0,
      d = 0,
      l = 0;
    for (let i = 0; i < N; i++) {
      const r = rollMatchOutcome("Average", "Average", config.probabilityMatrix, rng);
      if (r === "Win") w++;
      else if (r === "Draw") d++;
      else l++;
    }
    expect(w / N).toBeCloseTo(0.25, 1);
    expect(d / N).toBeCloseTo(0.5, 1);
    expect(l / N).toBeCloseTo(0.25, 1);
  });
});

describe("fixture generator", () => {
  it("produces 56 matches for 8 teams across the 4-3-4-3 phase structure", () => {
    const rng = new Rng(1);
    const fixtures = generateFixtures(8, config.phases, rng);
    expect(fixtures.length).toBe(56);
    const perPhase = [1, 2, 3, 4].map((p) => fixtures.filter((f) => f.phase === p).length);
    // Per phase = 8 teams × matches / 2. For 4-3-4-3: 16, 12, 16, 12 = 56.
    expect(perPhase).toEqual([16, 12, 16, 12]);
  });

  it("each team plays every other team exactly twice (once home, once away)", () => {
    const rng = new Rng(2);
    const fixtures = generateFixtures(8, config.phases, rng);
    for (let t = 0; t < 8; t++) {
      for (let o = 0; o < 8; o++) {
        if (t === o) continue;
        const count = fixtures.filter(
          (f) =>
            (f.homeTeamIndex === t && f.awayTeamIndex === o) ||
            (f.homeTeamIndex === o && f.awayTeamIndex === t)
        ).length;
        expect(count).toBe(2);
      }
      // 7 home + 7 away = 14 total per team
      const plays = fixtures.filter((f) => f.homeTeamIndex === t || f.awayTeamIndex === t).length;
      expect(plays).toBe(14);
    }
  });
});

describe("simulateFixture consistency", () => {
  it("produces inverse outcomes for home and away teams", () => {
    const rng = new Rng(123);
    const sim = simulateFixture({
      homeTeamIndex: 0,
      awayTeamIndex: 1,
      homeTeamId: "a",
      awayTeamId: "b",
      homeTeamName: "A",
      awayTeamName: "B",
      homeClass: "Good",
      awayClass: "Average",
      matchNumber: 1,
      config,
      rng
    });
    expect(sim.homeResult.isHome).toBe(true);
    expect(sim.awayResult.isHome).toBe(false);
    if (sim.homeResult.result === "Win") expect(sim.awayResult.result).toBe("Loss");
    if (sim.homeResult.result === "Loss") expect(sim.awayResult.result).toBe("Win");
    if (sim.homeResult.result === "Draw") expect(sim.awayResult.result).toBe("Draw");
    expect(sim.homeResult.opponentTeamId).toBe("b");
    expect(sim.awayResult.opponentTeamId).toBe("a");
  });
});
