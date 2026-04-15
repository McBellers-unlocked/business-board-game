// =========================================================================
// Deeland Cricket League — Shared Domain Types
// Mirrors Section 2.1 of DCL_SDD_Specification.md
// =========================================================================

export type UUID = string;
export type ISODateString = string;

// -------------------------------------------------------------------------
// Roles, classifications, phases
// -------------------------------------------------------------------------

export type TeamRole = "MD" | "FD" | "SD" | "MPRD" | "OM";
export const ALL_ROLES: readonly TeamRole[] = ["MD", "FD", "SD", "MPRD", "OM"] as const;
export const MANDATORY_ROLES: readonly TeamRole[] = ["MD", "FD", "SD"] as const;

export type TeamClassification = "Poor" | "Average" | "Good";
export type PlayerType = "Batsman" | "Bowler" | "All-Rounder";
export type FBScheme = "fixed" | "revenue";
export type MatchOutcome = "Win" | "Draw" | "Loss";

export type SessionStatus =
  | "setup"
  | "phase1"
  | "phase2"
  | "phase3"
  | "phase4"
  | "completed";

export type EventSeverity = "info" | "warning" | "critical";
export type EventCategory =
  | "injury"
  | "sponsorship"
  | "weather"
  | "media"
  | "financial"
  | "regulatory"
  | "community"
  | "operations"
  | "staff"
  | "legal";

export type PlayerEffect = "injured" | "suspended" | "boosted";

export type QualitativeCategory =
  | "shareholder_presentation"
  | "csr_pitch"
  | "media_announcement"
  | "general";

// -------------------------------------------------------------------------
// Game Configuration
// -------------------------------------------------------------------------

export interface StadiumConfig {
  key: string;
  label: string;
  purchaseCost: number;
  capacity: number;
  ticketPrice: number;
  fbOutlets: number;
  fbAveragePrice: number;
  fbSpectatorPct: number;
  fbFixedFeePerMonth: number;
  fbRevenuePct: number;
}

export interface PlayerConfig {
  id: number;
  name: string;
  type: PlayerType;
  purchaseCost: number;
  annualSalary: number;
  playerIndex: number;
}

export interface ProbabilityEntry {
  win: number;
  draw: number;
  lose: number;
}

export interface ProbabilityMatrix {
  entries: Record<string, ProbabilityEntry>;
}

export interface PhaseConfig {
  phase: number;
  matches: number;
  homeMatches: number;
  awayMatches: number;
  monthsInPhase: number;
}

export interface FinancingRules {
  baseEquity: number;
  annualInterestRate: number;
  debtTermYears: number;
  totalMatchesInSeason: number;
}

export interface SpectatorRule {
  minPosition: number;
  maxPosition: number;
  pct: number;
}

export interface ResaleRule {
  minPosition: number;
  maxPosition: number;
  pct: number;
}

export interface ResaleRules {
  rules: ResaleRule[];
  injuredPct: number;
}

export interface SpectatorRules {
  rules: SpectatorRule[];
  initialPct: number;
}

export interface TeamConstraints {
  minPlayers: number;
  maxPlayers: number;
  minBatters: number;
  minBowlers: number;
  teamIndexDivisor: number;
  goodThreshold: number;
  averageLowerThreshold: number;
}

export interface ScoringRubric {
  category: QualitativeCategory;
  label: string;
  description: string;
  weight: number;
}

export interface EventTemplate {
  id: string;
  category: EventCategory;
  title: string;
  description: string;
  facilitatorNotes: string;
  severity: EventSeverity;
  financialImpact: number | null;
  playerImpact:
    | {
        playerId: number | null;
        effect: PlayerEffect;
        phasesAffected?: number;
      }
    | null;
  attendanceImpact: number | null;
  requiresResponse: boolean;
  responseDeadlineMinutes: number | null;
}

export interface GameConfig {
  id: UUID;
  name: string;
  createdBy: UUID;
  stadiums: StadiumConfig[];
  players: PlayerConfig[];
  probabilityMatrix: ProbabilityMatrix;
  phases: PhaseConfig[];
  financingRules: FinancingRules;
  spectatorRules: SpectatorRules;
  resaleRules: ResaleRules;
  teamConstraints: TeamConstraints;
  scoringRubrics: ScoringRubric[];
  eventLibrary: EventTemplate[];
  compositeScoreWeights: { roe: number; qualitative: number };
  aiTeamNames: string[];
}

// -------------------------------------------------------------------------
// Session, team, member
// -------------------------------------------------------------------------

export interface GameSession {
  id: UUID;
  gameCode: string;
  configId: UUID;
  facilitatorId: UUID;
  status: SessionStatus;
  humanTeamCount: number;
  currentPhase: number;
  randomSeed: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  configName?: string;
}

export interface TeamMember {
  id: UUID;
  teamId: UUID;
  displayName: string;
  role: TeamRole;
  joinedAt: ISODateString;
}

export interface Team {
  id: UUID;
  sessionId: UUID;
  name: string;
  isAI: boolean;
  stadiumChoice: string | null;
  fbScheme: FBScheme | null;
  selectedPlayerIds: number[];
  equityFinance: number;
  setupComplete: boolean;
  members: TeamMember[];
  injuredPlayerIds: number[];
  suspendedPlayerIds: number[];
  // computed
  teamIndex: number;
  teamClassification: TeamClassification | null;
  debtRequired: number;
  totalPurchaseCost: number;
  totalAnnualSalary: number;
  leaguePosition: number;
  totalPoints: number;
  cumulativeCashFlow: number;
  roe: number;
}

// -------------------------------------------------------------------------
// Results
// -------------------------------------------------------------------------

export interface MatchResult {
  matchNumber: number;
  opponentTeamId: UUID;
  opponentName: string;
  opponentClassification: TeamClassification;
  isHome: boolean;
  result: MatchOutcome;
  pointsAwarded: number;
}

export interface PhaseResult {
  id: UUID;
  sessionId: UUID;
  teamId: UUID;
  phase: number;
  matches: MatchResult[];
  wins: number;
  draws: number;
  losses: number;
  pointsThisPhase: number;
  cumulativePoints: number;
  leaguePosition: number;
  spectatorPct: number;
  ticketRevenue: number;
  fbRevenue: number;
  tvRevenue: number;
  totalRevenue: number;
  salaryCost: number;
  interestCost: number;
  eventImpact: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  roe: number;
  createdAt: ISODateString;
}

export interface LeagueTableRow {
  position: number;
  teamId: UUID;
  teamName: string;
  isAI: boolean;
  classification: TeamClassification | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  cumulativeCashFlow: number;
  roe: number;
}

// -------------------------------------------------------------------------
// Events + Scoring
// -------------------------------------------------------------------------

export interface GameEvent {
  id: UUID;
  sessionId: UUID;
  targetTeamId: UUID | null;
  phase: number;
  templateId: string;
  title: string;
  description: string;
  severity: EventSeverity;
  financialImpact: number | null;
  playerImpact: EventTemplate["playerImpact"];
  attendanceImpact: number | null;
  requiresResponse: boolean;
  responseDeadline: ISODateString | null;
  teamResponse: string | null;
  resolved: boolean;
  triggeredAt: ISODateString;
}

export interface QualitativeScore {
  id: UUID;
  sessionId: UUID;
  teamId: UUID;
  category: QualitativeCategory;
  phase: number | null;
  score: number;
  notes: string;
  scoredAt: ISODateString;
}

// -------------------------------------------------------------------------
// Composite
// -------------------------------------------------------------------------

export interface CompositeScoreRow {
  teamId: UUID;
  teamName: string;
  roe: number;
  roeNormalised: number;
  avgQualitativeScore: number;
  qualitativeNormalised: number;
  compositeScore: number;
  compositeRank: number;
}

// -------------------------------------------------------------------------
// Auth / join
// -------------------------------------------------------------------------

export interface FacilitatorProfile {
  id: UUID;
  email: string;
  displayName: string | null;
}

export interface SessionJoinInfo {
  sessionId: UUID;
  sessionName: string;
  status: SessionStatus;
  teams: {
    id: UUID;
    name: string;
    isAI: boolean;
    takenRoles: TeamRole[];
    memberCount: number;
  }[];
}

export interface TeamTokenPayload {
  sessionId: UUID;
  teamId: UUID;
  memberId: UUID;
  role: TeamRole;
  kind: "team";
}

export interface FacilitatorTokenPayload {
  facilitatorId: UUID;
  email: string;
  kind: "facilitator";
}

export type AppTokenPayload = TeamTokenPayload | FacilitatorTokenPayload;

// -------------------------------------------------------------------------
// API error format
// -------------------------------------------------------------------------

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}
