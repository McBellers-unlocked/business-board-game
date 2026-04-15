import type { TeamRole } from "./types.js";

// Game code alphabet excludes ambiguous characters (0, O, I, L, 1)
export const GAME_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const GAME_CODE_LENGTH = 6;

// Role-to-decision permission matrix (FR-04)
export interface SetupDecisionPermissions {
  clubName: TeamRole[];
  stadium: TeamRole[];
  fbScheme: TeamRole[];
  playerSelection: TeamRole[];
  equityFinance: TeamRole[];
}

export const SETUP_PERMISSIONS: SetupDecisionPermissions = {
  clubName: ["MD"],
  stadium: ["MD", "FD"],
  fbScheme: ["FD", "OM"],
  playerSelection: ["SD"],
  equityFinance: ["FD", "MD"]
};

// Role label map for UI
export const ROLE_LABELS: Record<TeamRole, string> = {
  MD: "Managing Director",
  FD: "Finance Director",
  SD: "Sporting Director",
  MPRD: "Marketing & PR Director",
  OM: "Operations Manager"
};

// Role descriptions (short)
export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  MD: "Overall accountable; presents to shareholders; breaks deadlocks.",
  FD: "Financial planning, debt, reporting, ROE tracking.",
  SD: "Squad selection and transfers.",
  MPRD: "Media, press, CSR and marketing.",
  OM: "Stadium, F&B, operations. Support role."
};

// Points system
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;
export const POINTS_LOSS = 0;

// Team size defaults (mirrored in default config)
export const DEFAULT_TEAM_INDEX_DIVISOR = 14;

// Polling intervals (ms)
export const POLL_INTERVALS = {
  teamDashboard: 5000,
  facilitatorDashboard: 3000,
  joinLobby: 2000,
  setupProgress: 10000
} as const;
