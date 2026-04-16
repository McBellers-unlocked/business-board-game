import { Card, CardBody, CardTitle, Badge } from "./ui";
import { fmtMoney, fmtPct } from "../lib/format";
import type { LeagueTableRow } from "@dcl/shared";

export function LeagueTable({ rows, highlightTeamId }: { rows: LeagueTableRow[]; highlightTeamId?: string }) {
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">League table</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500 border-b border-ink-300">
                <th className="py-1 pr-2">#</th>
                <th className="pr-2">Team</th>
                <th className="pr-2">Class</th>
                <th className="pr-2 text-right">P</th>
                <th className="pr-2 text-right">W</th>
                <th className="pr-2 text-right">D</th>
                <th className="pr-2 text-right">L</th>
                <th className="pr-2 text-right">Pts</th>
                <th className="pr-2 text-right">Cum Cash</th>
                <th className="pr-2 text-right">ROE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.teamId}
                  className={`border-b border-ink-300 hover:bg-ink-200 ${r.teamId === highlightTeamId ? "bg-navy-50" : ""}`}
                >
                  <td className="py-1 pr-2 font-medium">{r.position}</td>
                  <td className="pr-2">
                    {r.teamName} {r.isAI && <Badge tone="neutral">AI</Badge>}
                  </td>
                  <td className="pr-2">
                    <Badge tone={r.classification === "Good" ? "good" : r.classification === "Poor" ? "bad" : "info"}>
                      {r.classification ?? "—"}
                    </Badge>
                  </td>
                  <td className="pr-2 text-right">{r.played}</td>
                  <td className="pr-2 text-right">{r.wins}</td>
                  <td className="pr-2 text-right">{r.draws}</td>
                  <td className="pr-2 text-right">{r.losses}</td>
                  <td className="pr-2 text-right font-semibold">{r.points}</td>
                  <td className="pr-2 text-right">{fmtMoney(r.cumulativeCashFlow)}</td>
                  <td className="pr-2 text-right">{fmtPct(r.roe, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
