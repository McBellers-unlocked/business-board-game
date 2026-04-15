import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "./config.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { authRouter } from "./routes/auth.js";
import { configsRouter } from "./routes/configs.js";
import { sessionsRouter } from "./routes/sessions.js";
import { teamsRouter } from "./routes/teams.js";
import { eventsRouter } from "./routes/events.js";
import { scoresRouter } from "./routes/scores.js";
import { exportsRouter } from "./routes/exports.js";

const app = express();

// CORS: config.clientOrigin may be a single origin or a comma-separated allowlist
const corsOrigins = config.clientOrigin === "*"
  ? true
  : config.clientOrigin.split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", env: config.env, time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/configs", configsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/scores", scoresRouter);
app.use("/api/exports", exportsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}`, code: "NOT_FOUND" });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.issues) {
    return res.status(400).json({ error: "Validation failed", code: "VALIDATION", details: err.issues });
  }
  console.error(err);
  res.status(500).json({ error: err?.message ?? "Internal error", code: "INTERNAL" });
});

async function start() {
  try {
    await bootstrapDatabase();
  } catch (err) {
    console.error("bootstrap failed", err);
    process.exit(1);
  }
  app.listen(config.port, () => {
    console.log(`DCL API listening on :${config.port} (${config.env}) — auth dev mode: ${config.authDevMode}`);
  });
}

start();
