import { Badge, Card, CardBody, CardTitle } from "./ui";
import type { PhaseResult } from "@dcl/shared";

export function MatchResultsList({ results }: { results: PhaseResult[] }) {
  if (results.length === 0) return null;
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Match results</CardTitle>
        <div className="space-y-4">
          {results
            .slice()
            .sort((a, b) => a.phase - b.phase)
            .map((pr) => (
              <div key={pr.id}>
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">Phase {pr.phase}</div>
                  <div className="text-ink-500">
                    {pr.wins}W {pr.draws}D {pr.losses}L · {pr.pointsThisPhase} pts · Pos {pr.leaguePosition}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {pr.matches.map((m, i) => (
                    <Badge
                      key={i}
                      tone={m.result === "Win" ? "good" : m.result === "Draw" ? "warn" : "bad"}
                    >
                      {m.isHome ? "H" : "A"} vs {m.opponentName} · {m.result[0]}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </CardBody>
    </Card>
  );
}
