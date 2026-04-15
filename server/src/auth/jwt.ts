import jwt from "jsonwebtoken";
import type {
  AppTokenPayload,
  FacilitatorTokenPayload,
  TeamTokenPayload
} from "@dcl/shared";
import { config } from "../config.js";

// Facilitator tokens: short-lived, signed with TEAM_JWT_SECRET in dev mode.
// In prod, facilitator tokens come from Cognito (verified via aws-jwt-verify) — this module
// only handles the dev-mode and team-member tokens. Cognito verification is in `cognito.ts`.

export function signFacilitatorToken(payload: FacilitatorTokenPayload): string {
  return jwt.sign(payload, config.teamJwtSecret, { expiresIn: "8h" });
}

export function signTeamToken(payload: TeamTokenPayload): string {
  return jwt.sign(payload, config.teamJwtSecret, { expiresIn: "12h" });
}

export function verifyLocalToken(token: string): AppTokenPayload {
  const decoded = jwt.verify(token, config.teamJwtSecret);
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid token payload");
  }
  if ((decoded as any).kind !== "team" && (decoded as any).kind !== "facilitator") {
    throw new Error("Unknown token kind");
  }
  return decoded as AppTokenPayload;
}
