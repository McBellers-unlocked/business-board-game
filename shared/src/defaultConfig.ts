// =========================================================================
// Default Deeland Cricket League Game Configuration
// Values taken directly from BBG Instructions.docx
// =========================================================================

import type {
  StadiumConfig,
  PlayerConfig,
  ProbabilityMatrix,
  PhaseConfig,
  FinancingRules,
  SpectatorRules,
  ResaleRules,
  TeamConstraints,
  ScoringRubric,
  EventTemplate,
  GameConfig
} from "./types.js";

export const DEFAULT_STADIUMS: StadiumConfig[] = [
  {
    key: "small",
    label: "Small Stadium",
    purchaseCost: 20_000_000,
    capacity: 20_000,
    ticketPrice: 35,
    fbOutlets: 10,
    fbAveragePrice: 12,
    fbSpectatorPct: 0.55,
    fbFixedFeePerMonth: 2_000,
    fbRevenuePct: 0.3
  },
  {
    key: "medium",
    label: "Medium Stadium",
    purchaseCost: 30_000_000,
    capacity: 30_000,
    ticketPrice: 30,
    fbOutlets: 20,
    fbAveragePrice: 11,
    fbSpectatorPct: 0.65,
    fbFixedFeePerMonth: 3_000,
    fbRevenuePct: 0.3
  },
  {
    key: "large",
    label: "Large Stadium",
    purchaseCost: 40_000_000,
    capacity: 40_000,
    ticketPrice: 25,
    fbOutlets: 30,
    fbAveragePrice: 10,
    fbSpectatorPct: 0.75,
    fbFixedFeePerMonth: 4_000,
    fbRevenuePct: 0.3
  }
];

// From Appendix One — 9 Batsmen, 4 All-Rounders, 7 Bowlers = 20 players
export const DEFAULT_PLAYERS: PlayerConfig[] = [
  { id: 1, name: "Player 1", type: "Batsman", purchaseCost: 500_000, annualSalary: 50_000, playerIndex: 0.75 },
  { id: 2, name: "Player 2", type: "Batsman", purchaseCost: 600_000, annualSalary: 60_000, playerIndex: 0.85 },
  { id: 3, name: "Player 3", type: "Batsman", purchaseCost: 700_000, annualSalary: 70_000, playerIndex: 0.95 },
  { id: 4, name: "Player 4", type: "Batsman", purchaseCost: 800_000, annualSalary: 80_000, playerIndex: 1.05 },
  { id: 5, name: "Player 5", type: "Batsman", purchaseCost: 900_000, annualSalary: 90_000, playerIndex: 1.15 },
  { id: 6, name: "Player 6", type: "Batsman", purchaseCost: 1_000_000, annualSalary: 100_000, playerIndex: 1.25 },
  { id: 7, name: "Player 7", type: "Batsman", purchaseCost: 1_100_000, annualSalary: 110_000, playerIndex: 1.35 },
  { id: 8, name: "Player 8", type: "Batsman", purchaseCost: 1_200_000, annualSalary: 120_000, playerIndex: 1.45 },
  { id: 9, name: "Player 9", type: "Batsman", purchaseCost: 1_300_000, annualSalary: 130_000, playerIndex: 1.55 },
  { id: 10, name: "Player 10", type: "All-Rounder", purchaseCost: 600_000, annualSalary: 60_000, playerIndex: 0.85 },
  { id: 11, name: "Player 11", type: "All-Rounder", purchaseCost: 700_000, annualSalary: 70_000, playerIndex: 0.95 },
  { id: 12, name: "Player 12", type: "All-Rounder", purchaseCost: 800_000, annualSalary: 80_000, playerIndex: 1.05 },
  { id: 13, name: "Player 13", type: "All-Rounder", purchaseCost: 900_000, annualSalary: 90_000, playerIndex: 1.15 },
  { id: 14, name: "Player 14", type: "Bowler", purchaseCost: 500_000, annualSalary: 50_000, playerIndex: 0.75 },
  { id: 15, name: "Player 15", type: "Bowler", purchaseCost: 600_000, annualSalary: 60_000, playerIndex: 0.85 },
  { id: 16, name: "Player 16", type: "Bowler", purchaseCost: 700_000, annualSalary: 70_000, playerIndex: 0.95 },
  { id: 17, name: "Player 17", type: "Bowler", purchaseCost: 800_000, annualSalary: 80_000, playerIndex: 1.05 },
  { id: 18, name: "Player 18", type: "Bowler", purchaseCost: 900_000, annualSalary: 90_000, playerIndex: 1.15 },
  { id: 19, name: "Player 19", type: "Bowler", purchaseCost: 1_000_000, annualSalary: 100_000, playerIndex: 1.25 },
  { id: 20, name: "Player 20", type: "Bowler", purchaseCost: 1_100_000, annualSalary: 110_000, playerIndex: 1.35 }
];

// From Section 6 — probabilities of Win/Draw/Lose for your team's classification vs. opponent's
export const DEFAULT_PROBABILITY_MATRIX: ProbabilityMatrix = {
  entries: {
    "Poor-Poor": { win: 0.25, draw: 0.5, lose: 0.25 },
    "Poor-Average": { win: 0.2, draw: 0.3, lose: 0.5 },
    "Poor-Good": { win: 0.1, draw: 0.2, lose: 0.7 },
    "Average-Poor": { win: 0.5, draw: 0.3, lose: 0.2 },
    "Average-Average": { win: 0.25, draw: 0.5, lose: 0.25 },
    "Average-Good": { win: 0.2, draw: 0.3, lose: 0.5 },
    "Good-Poor": { win: 0.7, draw: 0.2, lose: 0.1 },
    "Good-Average": { win: 0.5, draw: 0.3, lose: 0.2 },
    "Good-Good": { win: 0.25, draw: 0.5, lose: 0.25 }
  }
};

// Phase structure: 14 total matches, split 4-3-4-3 across 4 phases. 7 home + 7 away.
export const DEFAULT_PHASES: PhaseConfig[] = [
  { phase: 1, matches: 4, homeMatches: 2, awayMatches: 2, monthsInPhase: 3 },
  { phase: 2, matches: 3, homeMatches: 2, awayMatches: 1, monthsInPhase: 3 },
  { phase: 3, matches: 4, homeMatches: 2, awayMatches: 2, monthsInPhase: 3 },
  { phase: 4, matches: 3, homeMatches: 1, awayMatches: 2, monthsInPhase: 3 }
];

export const DEFAULT_FINANCING: FinancingRules = {
  baseEquity: 10_000_000,
  annualInterestRate: 0.05,
  debtTermYears: 2,
  totalMatchesInSeason: 14
};

export const DEFAULT_SPECTATOR_RULES: SpectatorRules = {
  rules: [
    { minPosition: 1, maxPosition: 2, pct: 1.0 },
    { minPosition: 3, maxPosition: 6, pct: 0.8 },
    { minPosition: 7, maxPosition: 8, pct: 0.6 }
  ],
  initialPct: 0.8
};

export const DEFAULT_RESALE_RULES: ResaleRules = {
  rules: [
    { minPosition: 1, maxPosition: 2, pct: 1.1 },
    { minPosition: 3, maxPosition: 6, pct: 0.8 },
    { minPosition: 7, maxPosition: 8, pct: 0.6 }
  ],
  injuredPct: 0.25
};

export const DEFAULT_TEAM_CONSTRAINTS: TeamConstraints = {
  minPlayers: 12,
  maxPlayers: 20,
  minBatters: 6,
  minBowlers: 5,
  teamIndexDivisor: 14,
  goodThreshold: 1.1,
  averageLowerThreshold: 0.9
};

export const DEFAULT_SCORING_RUBRICS: ScoringRubric[] = [
  {
    category: "shareholder_presentation",
    label: "Shareholder Presentation",
    description: "Clarity of the business case, financial forecasting, handling of probing questions.",
    weight: 0.4
  },
  {
    category: "csr_pitch",
    label: "CSR Project Pitch",
    description: "Quality of the CSR proposal to DCL: community impact, feasibility, alignment with brand.",
    weight: 0.3
  },
  {
    category: "media_announcement",
    label: "Media Announcements",
    description: "Conciseness, tone, professionalism, protection of confidentiality and brand image.",
    weight: 0.2
  },
  {
    category: "general",
    label: "General Management",
    description: "Team dynamics, decision process, stakeholder liaison, professionalism.",
    weight: 0.1
  }
];

// Default AI team name pool
export const DEFAULT_AI_TEAM_NAMES: string[] = [
  "Ashford Lions",
  "Blackmoor Hawks",
  "Crossfield Stags",
  "Dunbury Wolves",
  "Eastwick Falcons",
  "Ferndale Bears",
  "Glenmore Vipers",
  "Hartfield Otters",
  "Ironbridge Kestrels",
  "Juniper Foxes"
];

// -------------------------------------------------------------------------
// Default Event Library
//
// Contains the 12 simple events from the SDD's FR-08 table plus the 15
// intervention scenarios from the supplementary .docx files. The intervention
// events are all `requiresResponse: true` because they represent scenarios
// delegates must respond to with a decision / presentation / media statement.
// -------------------------------------------------------------------------

export const DEFAULT_EVENT_LIBRARY: EventTemplate[] = [
  // ---- 12 simple SDD events ----
  {
    id: "evt_injury_key",
    category: "injury",
    title: "Key Player Injury",
    description: "A star player has suffered a season-ending injury and will be unavailable for the remainder of the year.",
    facilitatorNotes: "Targets the team's highest-index player. They can sell at the injured resale rate (25%).",
    severity: "critical",
    financialImpact: null,
    playerImpact: { playerId: null, effect: "injured" },
    attendanceImpact: null,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },
  {
    id: "evt_injury_minor",
    category: "injury",
    title: "Minor Injury",
    description: "A squad player has picked up a minor injury and will miss the next phase.",
    facilitatorNotes: "Targets a random player for one phase.",
    severity: "warning",
    financialImpact: null,
    playerImpact: { playerId: null, effect: "injured", phasesAffected: 1 },
    attendanceImpact: null,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },
  {
    id: "evt_sponsor_local",
    category: "sponsorship",
    title: "Local Sponsor Deal",
    description: "A local business has offered a sponsorship package for the season.",
    facilitatorNotes: "Flat £50K inflow. Informational only.",
    severity: "info",
    financialImpact: 50_000,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },
  {
    id: "evt_sponsor_major",
    category: "sponsorship",
    title: "Major Sponsor",
    description: "A national brand wants to sponsor your team. Agree terms, and expect a lift in attendance.",
    facilitatorNotes: "£200K + 5% attendance boost for the phase.",
    severity: "info",
    financialImpact: 200_000,
    playerImpact: null,
    attendanceImpact: 1.05,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },
  {
    id: "evt_weather_rain",
    category: "weather",
    title: "Heavy Rain",
    description: "Severe weather reduces expected attendance at home matches this phase.",
    facilitatorNotes: "Spectator attendance -15% this phase.",
    severity: "warning",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: 0.85,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },
  {
    id: "evt_weather_heatwave",
    category: "weather",
    title: "Heatwave",
    description: "An unprecedented heatwave boosts F&B sales but reduces spectator comfort and attendance.",
    facilitatorNotes: "+£20K F&B bonus, -10% attendance.",
    severity: "warning",
    financialImpact: 20_000,
    playerImpact: null,
    attendanceImpact: 0.9,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },
  {
    id: "evt_media_press_conf",
    category: "media",
    title: "Press Conference Required",
    description: "Breaking news requires an immediate media statement from the club.",
    facilitatorNotes: "MPRD should draft and deliver a short media announcement.",
    severity: "warning",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 20
  },
  {
    id: "evt_media_negative",
    category: "media",
    title: "Negative Press",
    description: "An unflattering article about the club has been published; attendance is expected to dip.",
    facilitatorNotes: "-10% attendance this phase. Optional media response.",
    severity: "warning",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: 0.9,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },
  {
    id: "evt_cost_overrun",
    category: "financial",
    title: "Cost Overrun",
    description: "Unexpected stadium maintenance is required urgently.",
    facilitatorNotes: "-£100K cash this phase.",
    severity: "warning",
    financialImpact: -100_000,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },
  {
    id: "evt_tax_rebate",
    category: "financial",
    title: "Tax Rebate",
    description: "A government tax incentive for sporting organisations applies to the club.",
    facilitatorNotes: "+£75K cash this phase.",
    severity: "info",
    financialImpact: 75_000,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },
  {
    id: "evt_safety_inspection",
    category: "regulatory",
    title: "Safety Inspection",
    description: "The stadium is subject to an unexpected safety inspection. A fail will force capacity restrictions.",
    facilitatorNotes: "Outcome at facilitator discretion: -£50K + -20% capacity if fail.",
    severity: "critical",
    financialImpact: -50_000,
    playerImpact: null,
    attendanceImpact: 0.8,
    requiresResponse: true,
    responseDeadlineMinutes: 15
  },
  {
    id: "evt_community_award",
    category: "community",
    title: "Community Award",
    description: "The club has been recognised for its community engagement.",
    facilitatorNotes: "+10% attendance this phase.",
    severity: "info",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: 1.1,
    requiresResponse: false,
    responseDeadlineMinutes: null
  },

  // ---- 15 intervention scenarios (from .docx files) ----
  {
    id: "evt_coach_resignation",
    category: "staff",
    title: "Coach Resignation (Evans Templeton)",
    description:
      "Head Coach Evans Templeton has resigned in the wake of a betting scandal. The board must decide on the public response and recruitment plan, and issue a statement.",
    facilitatorNotes:
      "Requires MPRD media statement + MD decision on interim coach. Facilitator may apply attendance penalty if response is poor.",
    severity: "critical",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 30
  },
  {
    id: "evt_end_of_contract",
    category: "staff",
    title: "End of Contract: Joseph Pusilic",
    description:
      "Joseph Pusilic's contract terminates mid-season. He has been decisive for results. Decide whether to renew, and on what terms.",
    facilitatorNotes:
      "SD + FD must agree renewal terms. Facilitator applies financial / player impact based on team's negotiation.",
    severity: "warning",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 25
  },
  {
    id: "evt_exceptional_cricketer",
    category: "staff",
    title: "Exceptional Cricketer Available (Johnson Jones)",
    description:
      "Johnson Jones — released from his South African contract — is available. Purchase cost and salary terms are steep but he is world class.",
    facilitatorNotes:
      "Offer: £1.5M signing / £150K salary / index 1.55. Team must re-plan financials. Facilitator adjusts squad if accepted.",
    severity: "info",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 20
  },
  {
    id: "evt_fire_pavilion",
    category: "operations",
    title: "Fire at the Pavilion",
    description:
      "A fire has caused significant damage to the commentators' area and Stands C and D. Urgent decisions on repairs, insurance claims, and matchday operations are required.",
    facilitatorNotes:
      "-£250K repair cost. OM + MPRD must coordinate response and statement. Attendance -20% next phase if mishandled.",
    severity: "critical",
    financialImpact: -250_000,
    playerImpact: null,
    attendanceImpact: 0.9,
    requiresResponse: true,
    responseDeadlineMinutes: 25
  },
  {
    id: "evt_food_poisoning",
    category: "operations",
    title: "Food Poisoning Outbreak",
    description:
      "Suspected salmonella cases traced to Stand A and corporate hospitality. The outbreak is widespread and media attention is imminent.",
    facilitatorNotes:
      "MPRD statement + OM remediation plan required. -£80K remediation, -15% attendance next phase.",
    severity: "critical",
    financialImpact: -80_000,
    playerImpact: null,
    attendanceImpact: 0.85,
    requiresResponse: true,
    responseDeadlineMinutes: 20
  },
  {
    id: "evt_grass_termites",
    category: "operations",
    title: "Grass Termite Infestation",
    description:
      "Agricultural and desert termites have destabilised the playing surface. The pitch is not fit for purpose and matches are at risk.",
    facilitatorNotes:
      "-£120K treatment cost. Potential postponement if not addressed; facilitator may convert a home match to away.",
    severity: "critical",
    financialImpact: -120_000,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 20
  },
  {
    id: "evt_head_coach_dismissal",
    category: "staff",
    title: "Head Coach Dismissal (Nick Mason)",
    description:
      "Head Coach Nick Mason is alleged to have bullied bowler Bowen Caldwell. The players have lost confidence. Dismiss, suspend, or defend?",
    facilitatorNotes:
      "Decision affects team morale (facilitator may apply -0.05 team-index penalty for 1 phase if mishandled) + media statement required.",
    severity: "critical",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 30
  },
  {
    id: "evt_link_righteous_kings",
    category: "sponsorship",
    title: "Partnership Offer: Righteous Kings CC (India)",
    description:
      "The Righteous Kings Cricket Club has proposed a formal partnership. Potential revenue upside but also brand and player-loan risks.",
    facilitatorNotes:
      "Accepting: +£300K, +0.05 attendance uplift next phase. MD/MPRD present terms.",
    severity: "info",
    financialImpact: 300_000,
    playerImpact: null,
    attendanceImpact: 1.05,
    requiresResponse: true,
    responseDeadlineMinutes: 25
  },
  {
    id: "evt_catering_strike",
    category: "legal",
    title: "Potential Catering Strike",
    description:
      "Caterers are threatening strike action over vehicle parking restrictions. Without resolution, no catering on next match day.",
    facilitatorNotes:
      "If unresolved: F&B revenue zero for 1 home match (~-£150K). OM must negotiate.",
    severity: "warning",
    financialImpact: -150_000,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 15
  },
  {
    id: "evt_bloom_building",
    category: "financial",
    title: "Purchase of Bloom Building",
    description:
      "An estate agent has approached the club offering the Bloom Building adjacent to the stadium. Strategic acquisition with long-term upside.",
    facilitatorNotes:
      "Purchase: -£2M cash, +£80K/phase rental income from phase 2 onward if approved.",
    severity: "info",
    financialImpact: -2_000_000,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 20
  },
  {
    id: "evt_sale_reggie_twengie",
    category: "staff",
    title: "Offer for Reggie Twengie",
    description:
      "A rival club has offered $1.2M cash for Reggie Twengie, significantly above internal valuation. Decide whether to sell mid-contract.",
    facilitatorNotes:
      "If sold: +£1.2M cash, remove player from squad. Team index recalculated.",
    severity: "warning",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 15
  },
  {
    id: "evt_sewage_crisis",
    category: "operations",
    title: "Sewage Leak at Boundary",
    description:
      "A sewage leak has been discovered near Stand B during a practice session. Urgent remediation and health-safety decisions required.",
    facilitatorNotes:
      "-£90K remediation. -10% attendance next phase. OM-led response + MPRD statement.",
    severity: "critical",
    financialImpact: -90_000,
    playerImpact: null,
    attendanceImpact: 0.9,
    requiresResponse: true,
    responseDeadlineMinutes: 20
  },
  {
    id: "evt_sponsor_liquidation",
    category: "sponsorship",
    title: "Sponsor Liquidation (Homemakers Furniture)",
    description:
      "Major sponsor Homemakers Furniture has gone into liquidation. Lost revenue is material — decide on replacement strategy.",
    facilitatorNotes: "-£18K lost revenue across the remaining home matches. MPRD replacement pitch required.",
    severity: "warning",
    financialImpact: -18_000,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 20
  },
  {
    id: "evt_theft_dfp",
    category: "legal",
    title: "Theft at Deep Fried Poultry Outlet",
    description:
      "Burglary reported at a DFP F&B outlet. The internal auditor has raised concerns about controls and media exposure.",
    facilitatorNotes: "-£30K write-off + control-process response to auditor. Optional media statement.",
    severity: "warning",
    financialImpact: -30_000,
    playerImpact: null,
    attendanceImpact: null,
    requiresResponse: true,
    responseDeadlineMinutes: 15
  },
  {
    id: "evt_unruly_behaviour",
    category: "media",
    title: "Unruly Fan Behaviour Reported",
    description:
      "A newspaper has reported on unruly and aggressive incidents at a recent home match. Brand reputation at risk.",
    facilitatorNotes: "MPRD statement + disciplinary process required. Poor handling: -10% attendance next phase.",
    severity: "warning",
    financialImpact: null,
    playerImpact: null,
    attendanceImpact: 0.95,
    requiresResponse: true,
    responseDeadlineMinutes: 20
  }
];

// -------------------------------------------------------------------------
// Top-level default config factory
// -------------------------------------------------------------------------

export function makeDefaultGameConfig(createdBy = "00000000-0000-0000-0000-000000000000", id = "00000000-0000-0000-0000-000000000001"): GameConfig {
  return {
    id,
    name: "Deeland Cricket League (default)",
    createdBy,
    stadiums: DEFAULT_STADIUMS,
    players: DEFAULT_PLAYERS,
    probabilityMatrix: DEFAULT_PROBABILITY_MATRIX,
    phases: DEFAULT_PHASES,
    financingRules: DEFAULT_FINANCING,
    spectatorRules: DEFAULT_SPECTATOR_RULES,
    resaleRules: DEFAULT_RESALE_RULES,
    teamConstraints: DEFAULT_TEAM_CONSTRAINTS,
    scoringRubrics: DEFAULT_SCORING_RUBRICS,
    eventLibrary: DEFAULT_EVENT_LIBRARY,
    compositeScoreWeights: { roe: 0.6, qualitative: 0.4 },
    aiTeamNames: DEFAULT_AI_TEAM_NAMES
  };
}
