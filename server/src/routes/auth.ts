import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { signFacilitatorToken, signTeamToken } from "../auth/jwt.js";
import {
  cognitoSignUp,
  cognitoInitiateAuth,
  verifyCognitoIdToken,
  cognitoConfirmSignUp,
  cognitoForgotPassword,
  cognitoConfirmForgotPassword,
  cognitoResendConfirmation
} from "../auth/cognito.js";
import type { TeamRole, SessionJoinInfo } from "@dcl/shared";

export const authRouter = Router();

// -------------------- Facilitator register --------------------

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100)
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    if (config.authDevMode) {
      const hash = await bcrypt.hash(body.password, 10);
      const existing = await pool.query("SELECT id FROM facilitators WHERE email = $1", [body.email]);
      if (existing.rowCount && existing.rowCount > 0) {
        return res.status(409).json({ error: "Email already registered", code: "EMAIL_TAKEN" });
      }
      const result = await pool.query<{ id: string }>(
        `INSERT INTO facilitators (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
        [body.email, body.displayName, hash]
      );
      const id = result.rows[0]!.id;
      const token = signFacilitatorToken({ kind: "facilitator", facilitatorId: id, email: body.email });
      return res.status(201).json({ token, profile: { id, email: body.email, displayName: body.displayName } });
    }
    // Production path: sign up in Cognito, then prime the facilitators row on confirm/login
    await cognitoSignUp(body.email, body.password, body.displayName);
    return res.status(201).json({ status: "pending_confirmation" });
  } catch (err) {
    next(err);
  }
});

// Confirm Cognito signup
authRouter.post("/confirm", async (req, res, next) => {
  try {
    if (config.authDevMode) return res.status(400).json({ error: "Not needed in dev mode", code: "DEV_MODE" });
    const schema = z.object({ email: z.string().email(), code: z.string() });
    const body = schema.parse(req.body);
    await cognitoConfirmSignUp(body.email, body.code);
    res.json({ status: "confirmed" });
  } catch (err) {
    next(err);
  }
});

// -------------------- Facilitator login --------------------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    if (config.authDevMode) {
      const result = await pool.query<{ id: string; display_name: string | null; password_hash: string | null }>(
        "SELECT id, display_name, password_hash FROM facilitators WHERE email = $1",
        [body.email]
      );
      const row = result.rows[0];
      if (!row || !row.password_hash) {
        return res.status(401).json({ error: "Invalid credentials", code: "BAD_CREDS" });
      }
      const ok = await bcrypt.compare(body.password, row.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials", code: "BAD_CREDS" });
      const token = signFacilitatorToken({ kind: "facilitator", facilitatorId: row.id, email: body.email });
      return res.json({
        token,
        profile: { id: row.id, email: body.email, displayName: row.display_name }
      });
    }

    // Cognito path
    const result = await cognitoInitiateAuth(body.email, body.password);
    const idToken = result.AuthenticationResult?.IdToken;
    if (!idToken) return res.status(401).json({ error: "Cognito did not return an ID token", code: "NO_ID_TOKEN" });
    const user = await verifyCognitoIdToken(idToken);

    // Upsert facilitator row
    const upsert = await pool.query<{ id: string; display_name: string | null }>(
      `INSERT INTO facilitators (cognito_sub, email, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET cognito_sub = EXCLUDED.cognito_sub
         RETURNING id, display_name`,
      [user.sub, user.email, user.email.split("@")[0]]
    );
    const row = upsert.rows[0]!;
    const token = signFacilitatorToken({ kind: "facilitator", facilitatorId: row.id, email: user.email });
    return res.json({
      token,
      profile: { id: row.id, email: user.email, displayName: row.display_name },
      cognitoIdToken: idToken
    });
  } catch (err) {
    next(err);
  }
});

// -------------------- Forgot / reset password --------------------

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);
    if (config.authDevMode) {
      return res.status(400).json({ error: "Not available in dev mode", code: "DEV_MODE" });
    }
    await cognitoForgotPassword(email);
    // Always return ok (don't leak whether the email exists)
    res.json({ status: "code_sent" });
  } catch (err: any) {
    // Swallow 'UserNotFoundException' etc. — return ok to avoid account enumeration
    if (err?.name === "UserNotFoundException") return res.json({ status: "code_sent" });
    next(err);
  }
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      code: z.string().min(1),
      newPassword: z.string().min(8)
    });
    const body = schema.parse(req.body);
    if (config.authDevMode) {
      return res.status(400).json({ error: "Not available in dev mode", code: "DEV_MODE" });
    }
    await cognitoConfirmForgotPassword(body.email, body.code, body.newPassword);
    res.json({ status: "reset" });
  } catch (err: any) {
    if (err?.name === "CodeMismatchException") {
      return res.status(400).json({ error: "Incorrect code", code: "BAD_CODE" });
    }
    if (err?.name === "ExpiredCodeException") {
      return res.status(400).json({ error: "Code has expired — request a new one", code: "EXPIRED_CODE" });
    }
    if (err?.name === "InvalidPasswordException") {
      return res.status(400).json({ error: err.message ?? "Password does not meet requirements", code: "BAD_PASSWORD" });
    }
    next(err);
  }
});

authRouter.post("/resend-confirmation", async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);
    if (config.authDevMode) return res.status(400).json({ error: "Not available in dev mode", code: "DEV_MODE" });
    await cognitoResendConfirmation(email);
    res.json({ status: "code_sent" });
  } catch (err) {
    next(err);
  }
});

// -------------------- Team-member join (unauthenticated) --------------------

const joinSchema = z.object({
  gameCode: z.string().length(6),
  teamId: z.string().uuid(),
  role: z.enum(["MD", "FD", "SD", "MPRD", "OM"]),
  displayName: z.string().min(1).max(100)
});

authRouter.post("/join", async (req, res, next) => {
  try {
    const body = joinSchema.parse(req.body);
    const code = body.gameCode.toUpperCase();

    const session = await pool.query<{ id: string; status: string }>(
      "SELECT id, status FROM game_sessions WHERE game_code = $1",
      [code]
    );
    if (session.rowCount === 0) {
      return res.status(404).json({ error: "Unknown game code", code: "NO_SESSION" });
    }
    const s = session.rows[0]!;
    if (s.status === "completed") {
      return res.status(400).json({ error: "Session has ended", code: "SESSION_ENDED" });
    }

    const team = await pool.query<{ id: string; session_id: string; is_ai: boolean }>(
      "SELECT id, session_id, is_ai FROM teams WHERE id = $1",
      [body.teamId]
    );
    if (team.rowCount === 0 || team.rows[0]!.session_id !== s.id) {
      return res.status(404).json({ error: "Team not found in this session", code: "NO_TEAM" });
    }
    if (team.rows[0]!.is_ai) {
      return res.status(400).json({ error: "Cannot join an AI team", code: "AI_TEAM" });
    }

    const roleTaken = await pool.query(
      "SELECT 1 FROM team_members WHERE team_id = $1 AND role = $2",
      [body.teamId, body.role]
    );
    if (roleTaken.rowCount && roleTaken.rowCount > 0) {
      return res.status(409).json({ error: "Role already taken", code: "ROLE_TAKEN" });
    }

    const insert = await pool.query<{ id: string }>(
      `INSERT INTO team_members (team_id, display_name, role) VALUES ($1, $2, $3) RETURNING id`,
      [body.teamId, body.displayName, body.role]
    );
    const memberId = insert.rows[0]!.id;

    const token = signTeamToken({
      kind: "team",
      sessionId: s.id,
      teamId: body.teamId,
      memberId,
      role: body.role as TeamRole
    });

    return res.status(201).json({
      token,
      sessionId: s.id,
      teamId: body.teamId,
      memberId,
      role: body.role
    });
  } catch (err) {
    next(err);
  }
});

// -------------------- Game code lookup (unauthenticated) --------------------

authRouter.get("/join/:gameCode", async (req, res, next) => {
  try {
    const code = req.params.gameCode!.toUpperCase();
    const session = await pool.query<{
      id: string;
      status: string;
      name: string;
    }>(
      `SELECT s.id, s.status, c.name
         FROM game_sessions s
         JOIN game_configs c ON c.id = s.config_id
         WHERE game_code = $1`,
      [code]
    );
    if (session.rowCount === 0) {
      return res.status(404).json({ error: "Unknown game code", code: "NO_SESSION" });
    }
    const s = session.rows[0]!;

    const teams = await pool.query<{
      id: string;
      name: string;
      is_ai: boolean;
      slot_index: number;
      roles: string[] | null;
      member_count: string;
    }>(
      `SELECT t.id, t.name, t.is_ai, t.slot_index,
              ARRAY_AGG(m.role) FILTER (WHERE m.role IS NOT NULL) AS roles,
              COUNT(m.id) AS member_count
         FROM teams t
         LEFT JOIN team_members m ON m.team_id = t.id
         WHERE t.session_id = $1
         GROUP BY t.id
         ORDER BY t.slot_index`,
      [s.id]
    );

    const payload: SessionJoinInfo = {
      sessionId: s.id,
      sessionName: s.name,
      status: s.status as SessionJoinInfo["status"],
      teams: teams.rows.map((t) => ({
        id: t.id,
        name: t.name,
        isAI: t.is_ai,
        takenRoles: (t.roles ?? []).filter(Boolean) as any,
        memberCount: Number(t.member_count)
      }))
    };
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
