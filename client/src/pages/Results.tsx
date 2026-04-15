import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardBody, CardTitle, Badge, Stat } from "../components/ui";
import { LeagueTable } from "../components/LeagueTable";
import { fmtMoney, fmtNumber, fmtPct } from "../lib/format";

export function Results() {
  const { sessionId } = useParams();
  const session = useQuery<any>({
    queryKey: ["session", sessionId],
    queryFn: () => api.get(`/api/sessions/${sessionId}`),
    enabled: !!sessionId
  });
  const composite = useQuery<{ composite: any[]; weights: any }>({
    queryKey: ["composite", sessionId],
    queryFn: () => api.get(`/api/sessions/${sessionId}/composite`),
    enabled: !!sessionId
  });

  if (!session.data || !composite.data) return <div className="text-ink-500">Loading…</div>;
  const { leagueTable, teams } = session.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Season results</h1>
      <LeagueTable rows={leagueTable} />
      <Card>
        <CardBody>
          <CardTitle className="mb-3">Composite leaderboard</CardTitle>
          <div className="text-xs text-ink-500 mb-2">
            Weights: ROE {(composite.data.weights.roe * 100).toFixed(0)}% · Qualitative{" "}
            {(composite.data.weights.qualitative * 100).toFixed(0)}%
          </div>
          <ul className="divide-y divide-ink-100">
            {composite.data.composite.map((r: any) => (
              <li key={r.teamId} className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge tone={r.compositeRank === 1 ? "good" : "neutral"}>#{r.compositeRank}</Badge>
                  <div>
                    <div className="font-medium">{r.teamName}</div>
                    <div className="text-xs text-ink-500">ROE {fmtPct(r.roe, 2)} · Q {fmtNumber(r.avgQualitativeScore, 1)}/10</div>
                  </div>
                </div>
                <div className="font-semibold tabular-nums">{r.compositeScore.toFixed(3)}</div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
