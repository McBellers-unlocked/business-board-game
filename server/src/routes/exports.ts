import { Router } from "express";
import puppeteer from "puppeteer";
import { requireFacilitator, getFacilitator } from "../auth/middleware.js";
import { loadConfig, loadLeagueTable, loadPhaseResults, loadSession, loadTeams } from "../services/sessionQueries.js";

export const exportsRouter = Router();

exportsRouter.get("/:sessionId/export", requireFacilitator, async (req, res, next) => {
  try {
    const session = await loadSession(req.params.sessionId!);
    if (!session) return res.status(404).json({ error: "No session", code: "NO_SESSION" });
    if (session.facilitatorId !== getFacilitator(req).facilitatorId) {
      return res.status(403).json({ error: "Not your session", code: "FORBIDDEN" });
    }
    const config = await loadConfig(session.configId);
    if (!config) return res.status(404).json({ error: "No config", code: "NO_CONFIG" });

    const teams = await loadTeams(session.id, config);
    const leagueTable = await loadLeagueTable(session.id, config);
    const phaseResults = await loadPhaseResults(session.id);

    const html = buildHtml(session, config, teams, leagueTable, phaseResults);
    const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" } });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="dcl-${session.gameCode}.pdf"`);
      res.send(pdf);
    } finally {
      await browser.close();
    }
  } catch (err) {
    next(err);
  }
});

function buildHtml(session: any, config: any, teams: any[], leagueTable: any[], phaseResults: any[]) {
  const byTeam = new Map<string, any[]>();
  for (const pr of phaseResults) {
    const arr = byTeam.get(pr.teamId) ?? [];
    arr.push(pr);
    byTeam.set(pr.teamId, arr);
  }
  const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>DCL — Session ${session.gameCode}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; }
  h1 { border-bottom: 2px solid #222; padding-bottom: 4px; }
  h2 { margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; font-size: 12px; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .meta { color: #555; font-size: 12px; }
  .page-break { page-break-after: always; }
</style>
</head>
<body>
  <h1>Deeland Cricket League — Session ${session.gameCode}</h1>
  <p class="meta">Config: ${config.name} — Status: ${session.status} — Phase: ${session.currentPhase}/4</p>

  <h2>Final League Table</h2>
  <table>
    <thead><tr>
      <th>#</th><th>Team</th><th>Type</th><th>Class</th>
      <th class="num">P</th><th class="num">W</th><th class="num">D</th><th class="num">L</th>
      <th class="num">Pts</th><th class="num">ROE</th><th class="num">Cumulative Cash</th>
    </tr></thead>
    <tbody>
      ${leagueTable
        .map(
          (r) =>
            `<tr><td>${r.position}</td><td>${r.teamName}</td><td>${r.isAI ? "AI" : "Human"}</td><td>${r.classification ?? "-"}</td>` +
            `<td class="num">${r.played}</td><td class="num">${r.wins}</td><td class="num">${r.draws}</td><td class="num">${r.losses}</td>` +
            `<td class="num">${r.points}</td><td class="num">${(r.roe * 100).toFixed(2)}%</td><td class="num">${fmt(r.cumulativeCashFlow)}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>

  <h2>Teams</h2>
  ${teams
    .map(
      (t) => `
    <h3>${t.name} ${t.isAI ? "(AI)" : ""}</h3>
    <p class="meta">Stadium: ${t.stadiumChoice ?? "-"} · F&amp;B: ${t.fbScheme ?? "-"} · Index ${t.teamIndex.toFixed(3)} (${t.teamClassification ?? "-"}) · Equity ${fmt(t.equityFinance)} · Debt ${fmt(t.debtRequired)}</p>
    <table>
      <thead><tr>
        <th>Phase</th><th class="num">W</th><th class="num">D</th><th class="num">L</th><th class="num">Pts</th>
        <th class="num">Pos</th><th class="num">Tkt</th><th class="num">TV</th><th class="num">F&amp;B</th>
        <th class="num">Sal</th><th class="num">Int</th><th class="num">Evt</th><th class="num">NCF</th><th class="num">Cum</th><th class="num">ROE</th>
      </tr></thead>
      <tbody>
        ${(byTeam.get(t.id) ?? [])
          .sort((a: any, b: any) => a.phase - b.phase)
          .map(
            (r: any) =>
              `<tr><td>${r.phase}</td><td class="num">${r.wins}</td><td class="num">${r.draws}</td><td class="num">${r.losses}</td><td class="num">${r.pointsThisPhase}</td>` +
              `<td class="num">${r.leaguePosition}</td><td class="num">${fmt(r.ticketRevenue)}</td><td class="num">${fmt(r.tvRevenue)}</td><td class="num">${fmt(r.fbRevenue)}</td>` +
              `<td class="num">${fmt(r.salaryCost)}</td><td class="num">${fmt(r.interestCost)}</td><td class="num">${fmt(r.eventImpact)}</td>` +
              `<td class="num">${fmt(r.netCashFlow)}</td><td class="num">${fmt(r.cumulativeCashFlow)}</td><td class="num">${(r.roe * 100).toFixed(2)}%</td></tr>`
          )
          .join("")}
      </tbody>
    </table>`
    )
    .join("")}
</body>
</html>`;
}
