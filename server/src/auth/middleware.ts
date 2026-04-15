import type { NextFunction, Request, Response } from "express";
import type { AppTokenPayload, FacilitatorTokenPayload, TeamTokenPayload, TeamRole } from "@dcl/shared";
import { verifyLocalToken } from "./jwt.js";

// Helpers used by handlers running AFTER the matching middleware has run.
// They narrow the payload and throw a 500 (bug) if the caller forgot to guard.
export function getFacilitator(req: Request): FacilitatorTokenPayload {
  if (req.auth?.kind !== "facilitator") {
    throw new Error("getFacilitator called without requireFacilitator middleware");
  }
  return req.auth;
}

export function getTeamMember(req: Request): TeamTokenPayload {
  if (req.auth?.kind !== "team") {
    throw new Error("getTeamMember called without requireTeamMember middleware");
  }
  return req.auth;
}

// Augment Express Request so our handlers can use `req.auth`.
declare module "express-serve-static-core" {
  interface Request {
    auth?: AppTokenPayload;
  }
}

function extractBearer(req: Request): string | null {
  const h = req.header("authorization") ?? req.header("Authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ error: "Missing bearer token", code: "NO_TOKEN" });
  try {
    req.auth = verifyLocalToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token", code: "INVALID_TOKEN" });
  }
}

export function requireFacilitator(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.auth?.kind !== "facilitator") {
      return res.status(403).json({ error: "Facilitator role required", code: "NOT_FACILITATOR" });
    }
    next();
  });
}

export function requireTeamMember(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.auth?.kind !== "team") {
      return res.status(403).json({ error: "Team member role required", code: "NOT_TEAM_MEMBER" });
    }
    next();
  });
}

/** Guards a handler so only specified roles (within the caller's own team) may proceed. */
export function requireRole(...roles: TeamRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.kind !== "team") {
      return res.status(403).json({ error: "Team member required", code: "NOT_TEAM_MEMBER" });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({
        error: `Permitted roles: ${roles.join(", ")}`,
        code: "ROLE_FORBIDDEN"
      });
    }
    next();
  };
}

/**
 * Ensures the team-scoped caller is acting on their own team.
 * Must be used after requireTeamMember for route params containing :teamId.
 */
export function requireOwnTeam(teamIdParam = "teamId") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.kind !== "team") {
      return res.status(403).json({ error: "Team member required", code: "NOT_TEAM_MEMBER" });
    }
    const target = req.params[teamIdParam];
    if (!target) {
      return res.status(400).json({ error: `Missing ${teamIdParam}`, code: "BAD_REQUEST" });
    }
    if (req.auth.teamId !== target) {
      return res.status(403).json({ error: "Cannot act on another team", code: "CROSS_TEAM_FORBIDDEN" });
    }
    next();
  };
}
