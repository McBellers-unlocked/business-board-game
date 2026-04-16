import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, downloadBlob } from "../../api/client";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Input,
  Label,
  Select,
  Stat,
  Textarea
} from "../../components/ui";
import { LeagueTable } from "../../components/LeagueTable";
import { fmtMoney, fmtNumber, fmtPct } from "../../lib/format";
import type { EventTemplate, GameConfig, LeagueTableRow, Team } from "@dcl/shared";
import { POLL_INTERVALS } from "@dcl/shared";

interface SessionBundle {
  session: {
    id: string;
    gameCode: string;
    status: string;
    humanTeamCount: number;
    currentPhase: number;
    configName: string;
  };
  config: GameConfig;
  teams: Team[];
  phaseResults: any[];
  leagueTable: LeagueTableRow[];
}

export function FacilitatorSession() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SessionBundle>({
    queryKey: ["session", id],
    queryFn: () => api.get(`/api/sessions/${id}`),
    refetchInterval: POLL_INTERVALS.facilitatorDashboard,
    enabled: !!id
  });

  const advance = useMutation({
    mutationFn: () => api.post(`/api/sessions/${id}/advance-phase`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session", id] })
  });
  const reset = useMutation({
    mutationFn: () => api.post(`/api/sessions/${id}/reset`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session", id] })
  });

  const [advanceError, setAdvanceError] = useState<string | null>(null);

  if (isLoading || !data) return <div className="text-ink-500">Loading…</div>;
  const { session, config, teams, leagueTable } = data;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{session.configName}</h1>
          <p className="text-sm text-ink-500">
            Code <span className="font-mono">{session.gameCode}</span> · {session.humanTeamCount} human ·{" "}
            Phase {session.currentPhase}/4 · <Badge tone="info">{session.status}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              if (!confirm(`This will simulate phase ${session.currentPhase + 1}. Continue?`)) return;
              setAdvanceError(null);
              advance.mutate(undefined, {
                onError: (err) => setAdvanceError(err instanceof ApiError ? err.message : "Advance failed")
              });
            }}
            disabled={advance.isPending || session.status === "completed"}
          >
            {advance.isPending ? "Simulating…" : session.status === "completed" ? "Completed" : `Advance to phase ${session.currentPhase + 1}`}
          </Button>
          <Button variant="secondary" onClick={() => downloadBlob(`/api/exports/${id}/export`, `dcl-${session.gameCode}.pdf`)}>
            Export PDF
          </Button>
          <Button variant="danger" onClick={() => confirm("Reset the session to setup? Results will be lost.") && reset.mutate()}>
            Reset
          </Button>
        </div>
      </header>
      {advanceError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm">{advanceError}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <TeamsOverview teams={teams} />
          <LeagueTable rows={leagueTable} />
          <ComparisonTable teams={teams} />
          <TradesPanel sessionId={session.id} />
        </div>
        <aside className="space-y-4">
          <EventTriggerPanel sessionId={session.id} config={config} teams={teams} currentPhase={session.currentPhase} />
          <ScoringPanel sessionId={session.id} teams={teams} rubrics={config.scoringRubrics} currentPhase={session.currentPhase} />
          <CompositeScorePanel sessionId={session.id} />
        </aside>
      </div>
    </div>
  );
}

function TeamsOverview({ teams }: { teams: Team[] }) {
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Teams</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {teams.map((t) => (
            <div key={t.id} className="rounded-md ring-1 ring-ink-300 p-3 bg-ink-100">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {t.name} {t.isAI ? <Badge tone="neutral">AI</Badge> : null}
                </div>
                <Badge tone={t.setupComplete ? "good" : "warn"}>{t.setupComplete ? "Ready" : "Setup"}</Badge>
              </div>
              <div className="text-xs text-ink-500 mt-1">
                {t.stadiumChoice ?? "—"} · F&amp;B {t.fbScheme ?? "—"} · {t.selectedPlayerIds?.length ?? 0} players · idx{" "}
                {fmtNumber(t.teamIndex, 3)} ({t.teamClassification ?? "—"})
              </div>
              <div className="text-xs text-ink-500">
                Equity {fmtMoney(t.equityFinance)} · Debt {fmtMoney(t.debtRequired)}
              </div>
              <div className="text-xs text-ink-500 mt-1">
                Members: {t.members?.map((m) => `${m.role}:${m.displayName}`).join(", ") || "none"}
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function ComparisonTable({ teams }: { teams: Team[] }) {
  const sorted = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Side-by-side comparison</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-500 border-b border-ink-300">
                <th className="py-1 pr-2">Team</th>
                <th className="pr-2 text-right">Idx</th>
                <th className="pr-2">Class</th>
                <th className="pr-2">Stadium</th>
                <th className="pr-2">F&amp;B</th>
                <th className="pr-2 text-right">Equity</th>
                <th className="pr-2 text-right">Debt</th>
                <th className="pr-2 text-right">Salary/yr</th>
                <th className="pr-2 text-right">Pts</th>
                <th className="pr-2 text-right">Cash</th>
                <th className="pr-2 text-right">ROE</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-b border-ink-100">
                  <td className="py-1 pr-2">{t.name}</td>
                  <td className="pr-2 text-right">{fmtNumber(t.teamIndex, 3)}</td>
                  <td className="pr-2">{t.teamClassification ?? "—"}</td>
                  <td className="pr-2">{t.stadiumChoice ?? "—"}</td>
                  <td className="pr-2">{t.fbScheme ?? "—"}</td>
                  <td className="pr-2 text-right">{fmtMoney(t.equityFinance)}</td>
                  <td className="pr-2 text-right">{fmtMoney(t.debtRequired)}</td>
                  <td className="pr-2 text-right">{fmtMoney(t.totalAnnualSalary)}</td>
                  <td className="pr-2 text-right">{t.totalPoints}</td>
                  <td className="pr-2 text-right">{fmtMoney(t.cumulativeCashFlow)}</td>
                  <td className="pr-2 text-right">{fmtPct(t.roe, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function EventTriggerPanel({
  sessionId,
  config,
  teams,
  currentPhase
}: {
  sessionId: string;
  config: GameConfig;
  teams: Team[];
  currentPhase: number;
}) {
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState(config.eventLibrary[0]?.id ?? "");
  const [targetTeamId, setTargetTeamId] = useState<string>("");
  const [phase, setPhase] = useState(Math.max(1, currentPhase + 1));
  const trigger = useMutation({
    mutationFn: (body: any) => api.post(`/api/events/session/${sessionId}/events`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events", sessionId] })
  });
  const events = useQuery<{ events: any[] }>({
    queryKey: ["events", sessionId],
    queryFn: () => api.get(`/api/events/session/${sessionId}/events`)
  });

  const template = config.eventLibrary.find((e) => e.id === templateId);

  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Event library</CardTitle>
        <div className="space-y-3">
          <div>
            <Label>Template</Label>
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {config.eventLibrary.map((e) => (
                <option key={e.id} value={e.id}>
                  [{e.category}] {e.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Target team</Label>
            <Select value={targetTeamId} onChange={(e) => setTargetTeamId(e.target.value)}>
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Phase</Label>
            <Select value={phase} onChange={(e) => setPhase(Number(e.target.value))}>
              {[1, 2, 3, 4].map((p) => (
                <option key={p} value={p}>
                  Phase {p}
                </option>
              ))}
            </Select>
          </div>
          {template && (
            <div className="text-xs text-ink-500 border border-ink-300 rounded-md p-2">
              <div className="font-medium text-ink-700">{template.title}</div>
              <div className="mt-1">{template.description}</div>
              {template.facilitatorNotes && (
                <div className="mt-1 italic">Facilitator note: {template.facilitatorNotes}</div>
              )}
            </div>
          )}
          <Button
            disabled={trigger.isPending}
            onClick={() =>
              trigger.mutate({
                templateId,
                targetTeamId: targetTeamId || null,
                phase
              })
            }
          >
            {trigger.isPending ? "Triggering…" : "Trigger event"}
          </Button>
        </div>
        <hr className="my-3" />
        <div className="text-sm font-medium mb-2">Event history</div>
        <ul className="text-xs space-y-1 max-h-48 overflow-auto">
          {events.data?.events.map((e) => (
            <li key={e.id} className="flex justify-between gap-2">
              <span>
                <Badge tone={e.severity === "critical" ? "bad" : e.severity === "warning" ? "warn" : "info"}>{e.severity}</Badge>{" "}
                {e.title} — P{e.phase}
              </span>
              <span className="text-ink-500">{e.targetTeamName ?? "All teams"}</span>
            </li>
          )) ?? null}
        </ul>
      </CardBody>
    </Card>
  );
}

function ScoringPanel({
  sessionId,
  teams,
  rubrics,
  currentPhase
}: {
  sessionId: string;
  teams: Team[];
  rubrics: GameConfig["scoringRubrics"];
  currentPhase: number;
}) {
  const qc = useQueryClient();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [category, setCategory] = useState(rubrics[0]?.category ?? "general");
  const [score, setScore] = useState(7);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<number | "">(currentPhase || "");

  const post = useMutation({
    mutationFn: () =>
      api.post(`/api/scores/session/${sessionId}/scores`, {
        teamId,
        category,
        phase: phase === "" ? null : phase,
        score,
        notes: notes || undefined
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scores", sessionId] });
      setNotes("");
    }
  });

  const all = useQuery<{ scores: any[] }>({
    queryKey: ["scores", sessionId],
    queryFn: () => api.get(`/api/scores/session/${sessionId}/scores`)
  });

  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Qualitative scoring</CardTitle>
        <div className="space-y-2">
          <Label>Team</Label>
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as any)}>
            {rubrics.map((r) => (
              <option key={r.category} value={r.category}>
                {r.label}
              </option>
            ))}
          </Select>
          <Label>Phase (optional)</Label>
          <Select value={phase} onChange={(e) => setPhase(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">—</option>
            {[1, 2, 3, 4].map((p) => (
              <option key={p} value={p}>
                Phase {p}
              </option>
            ))}
          </Select>
          <Label>Score (1–10)</Label>
          <Input type="number" min={1} max={10} value={score} onChange={(e) => setScore(Number(e.target.value))} />
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button disabled={post.isPending} onClick={() => post.mutate()}>
            {post.isPending ? "Saving…" : "Log score"}
          </Button>
        </div>
        <hr className="my-3" />
        <div className="text-sm font-medium mb-2">Recent scores</div>
        <ul className="text-xs space-y-1 max-h-48 overflow-auto">
          {all.data?.scores.slice(0, 12).map((s: any) => (
            <li key={s.id} className="flex justify-between">
              <span>
                {s.category} · {teams.find((t) => t.id === s.team_id)?.name ?? s.team_id}
              </span>
              <span>
                {s.score}/10 {s.phase ? `· P${s.phase}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function CompositeScorePanel({ sessionId }: { sessionId: string }) {
  const { data } = useQuery<{ composite: any[]; weights: any }>({
    queryKey: ["composite", sessionId],
    queryFn: () => api.get(`/api/sessions/${sessionId}/composite`),
    refetchInterval: 10000
  });
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Composite score</CardTitle>
        {data?.weights && (
          <div className="text-xs text-ink-500 mb-2">
            Weights: ROE {(data.weights.roe * 100).toFixed(0)}% · Qualitative {(data.weights.qualitative * 100).toFixed(0)}%
          </div>
        )}
        <ul className="text-sm space-y-1">
          {data?.composite.map((r: any) => (
            <li key={r.teamId} className="flex justify-between">
              <span>
                {r.compositeRank}. {r.teamName}
              </span>
              <span className="tabular-nums">
                {r.compositeScore.toFixed(3)} (ROE {fmtPct(r.roe, 2)} · Q {fmtNumber(r.avgQualitativeScore, 1)})
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function TradesPanel({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery<{ trades: any[] }>({
    queryKey: ["trades", sessionId],
    queryFn: () => api.get(`/api/teams/session/${sessionId}/trades`)
  });
  const approve = useMutation({
    mutationFn: (tid: string) => api.post(`/api/teams/trades/${tid}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trades", sessionId] })
  });
  const reject = useMutation({
    mutationFn: (tid: string) => api.post(`/api/teams/trades/${tid}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trades", sessionId] })
  });
  if (!data?.trades?.length) return null;
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Trade proposals</CardTitle>
        <ul className="text-sm divide-y divide-ink-100">
          {data.trades.map((t: any) => (
            <li key={t.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{t.team_name}</div>
                <div className="text-xs text-ink-500">
                  Sell {t.sell_player_ids.join(", ") || "—"} · Buy {t.buy_player_ids.join(", ") || "—"} · Δ{" "}
                  {fmtMoney(Number(t.projected_cash_delta))}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Badge tone={t.status === "pending" ? "warn" : t.status === "approved" ? "good" : "neutral"}>{t.status}</Badge>
                {t.status === "pending" && (
                  <>
                    <Button onClick={() => approve.mutate(t.id)}>Approve</Button>
                    <Button variant="secondary" onClick={() => reject.mutate(t.id)}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
