import { useMemo } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useMySession } from "../../hooks/useSessionData";
import { Badge, Button, Card, CardBody, CardTitle, Stat } from "../../components/ui";
import { LeagueTable } from "../../components/LeagueTable";
import { MatchResultsList } from "../../components/MatchResultsList";
import { EventNotifications } from "../../components/EventNotifications";
import { fmtMoney, fmtNumber, fmtPct } from "../../lib/format";
import { ROLE_LABELS } from "@dcl/shared";
import type { PhaseResult } from "@dcl/shared";

export function TeamDashboard() {
  const { session } = useAuth();
  if (session?.kind !== "team") return <Navigate to="/join" />;
  const { data, isLoading } = useMySession();
  if (isLoading || !data) return <div className="text-ink-500">Loading…</div>;
  const myTeam = data.teams.find((t) => t.id === session.teamId);
  if (!myTeam) return <div className="text-ink-500">Team not found.</div>;

  // While the facilitator hasn't advanced past setup, route directly into the setup wizard
  // so members see the decisions they need to make, not an empty dashboard.
  if (data.session.status === "setup") {
    return <SetupHandoff team={myTeam} session={data.session} />;
  }

  const myResults = data.phaseResults.filter((r) => r.teamId === myTeam.id);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{myTeam.name}</h1>
          <p className="text-sm text-ink-500">
            {session.role} · {ROLE_LABELS[session.role]} · Session {data.session.gameCode} · Phase {data.session.currentPhase}/4 ({data.session.status})
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="League position" value={myTeam.leaguePosition} hint={`${myTeam.totalPoints} pts`} />
        <Stat label="Team index" value={fmtNumber(myTeam.teamIndex, 3)} hint={myTeam.teamClassification ?? "—"} />
        <Stat label="ROE" value={fmtPct(myTeam.roe, 2)} hint={fmtMoney(myTeam.cumulativeCashFlow)} />
        <Stat label="Debt" value={fmtMoney(myTeam.debtRequired)} hint={`Equity ${fmtMoney(myTeam.equityFinance)}`} />
      </div>

      {/* Role-specific content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          {session.role === "MD" && <MdOverview team={myTeam} results={myResults} />}
          {session.role === "FD" && <FdFinancials results={myResults} team={myTeam} />}
          {session.role === "SD" && <SdSquad team={myTeam} config={data.config} />}
          {session.role === "MPRD" && <EventNotifications sessionId={session.sessionId} canRespond />}
          {session.role === "OM" && <OmOperations team={myTeam} config={data.config} results={myResults} />}

          <MatchResultsList results={myResults} />
          <LeagueTable rows={data.leagueTable} highlightTeamId={myTeam.id} />
        </div>
        <aside className="space-y-4">
          <EventNotifications
            sessionId={session.sessionId}
            canRespond={session.role === "MPRD" || session.role === "MD"}
          />
          <TeamMembersCard team={myTeam} />
        </aside>
      </div>
    </div>
  );
}

// ---- Setup-phase landing screen ----
// Shows team composition, checklist, and a big "Go to setup" CTA. MD/FD/SD/OM can all
// edit setup; MPRD's role is advisory during setup, so we still route them through.
function SetupHandoff({ team, session }: { team: any; session: any }) {
  const checklist = [
    { label: "Club name chosen", done: team.name && !/^Team \d+$/.test(team.name) },
    { label: "Stadium chosen", done: !!team.stadiumChoice },
    { label: "F&B scheme chosen", done: !!team.fbScheme },
    { label: "Squad selected (12–20 players)", done: (team.selectedPlayerIds?.length ?? 0) >= 12 },
    { label: "Equity finance set", done: team.equityFinance > 0 },
    { label: "Marked ready (MD/FD)", done: !!team.setupComplete }
  ];
  const doneCount = checklist.filter((i) => i.done).length;
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card>
        <CardBody>
          <CardTitle className="mb-1">Welcome, {team.name}</CardTitle>
          <p className="text-sm text-ink-500 mb-4">
            Session <span className="font-mono">{session.gameCode}</span> · Status: <Badge tone="warn">setup</Badge>
          </p>

          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Your team ({team.members.length}/5)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
              {team.members.map((m: any) => (
                <div key={m.id} className="flex justify-between rounded bg-ink-100 px-2 py-1">
                  <span>{m.displayName}</span>
                  <Badge tone="info">{m.role}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium mb-2">
              Setup progress: {doneCount}/{checklist.length}
            </div>
            <ul className="text-sm space-y-1">
              {checklist.map((i) => (
                <li key={i.label} className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${i.done ? "bg-green-500" : "bg-ink-300"}`} />
                  {i.label}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-ink-700 mb-4">
            Everyone on the team can open the setup wizard. Decisions are role-gated — each role unlocks the
            choices they're responsible for. Once all six items above are ticked, MD or FD marks setup complete;
            the facilitator can then start the season.
          </p>

          <div className="flex gap-2">
            <Link to="/team/setup">
              <Button>Open setup wizard</Button>
            </Link>
            <Link to="/team/setup">
              <Button variant="secondary">See role-specific decisions</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function TeamMembersCard({ team }: { team: any }) {
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-2">Team</CardTitle>
        <ul className="space-y-1 text-sm">
          {team.members?.map((m: any) => (
            <li key={m.id} className="flex justify-between">
              <span>{m.displayName}</span>
              <Badge tone="info">{m.role}</Badge>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function MdOverview({ team, results }: { team: any; results: PhaseResult[] }) {
  const last = results[results.length - 1];
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">MD overview</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Stat label="Phases played" value={results.length} />
          <Stat label="Wins" value={results.reduce((s, r) => s + r.wins, 0)} />
          <Stat label="Total revenue" value={fmtMoney(results.reduce((s, r) => s + r.totalRevenue, 0))} />
          <Stat label="Last phase NCF" value={last ? fmtMoney(last.netCashFlow) : "—"} />
        </div>
        <p className="text-sm text-ink-700">
          As MD you're accountable for the overall decision process and present to shareholders. Break deadlocks, co-sign
          stadium/equity decisions with FD, and steward the CSR pitch.
        </p>
      </CardBody>
    </Card>
  );
}

function FdFinancials({ results, team }: { results: PhaseResult[]; team: any }) {
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Financial P&amp;L by phase</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500 border-b border-ink-300">
                <th className="py-1 pr-2">Phase</th>
                <th className="pr-2 text-right">Ticket</th>
                <th className="pr-2 text-right">TV</th>
                <th className="pr-2 text-right">F&amp;B</th>
                <th className="pr-2 text-right">Total Rev</th>
                <th className="pr-2 text-right">Salary</th>
                <th className="pr-2 text-right">Interest</th>
                <th className="pr-2 text-right">Events</th>
                <th className="pr-2 text-right">NCF</th>
                <th className="pr-2 text-right">Cum Cash</th>
                <th className="pr-2 text-right">ROE</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-ink-100">
                  <td className="py-1 pr-2">{r.phase}</td>
                  <td className="pr-2 text-right">{fmtMoney(r.ticketRevenue)}</td>
                  <td className="pr-2 text-right">{fmtMoney(r.tvRevenue)}</td>
                  <td className="pr-2 text-right">{fmtMoney(r.fbRevenue)}</td>
                  <td className="pr-2 text-right font-semibold">{fmtMoney(r.totalRevenue)}</td>
                  <td className="pr-2 text-right">{fmtMoney(-r.salaryCost)}</td>
                  <td className="pr-2 text-right">{fmtMoney(-r.interestCost)}</td>
                  <td className="pr-2 text-right">{fmtMoney(r.eventImpact)}</td>
                  <td className="pr-2 text-right font-semibold">{fmtMoney(r.netCashFlow)}</td>
                  <td className="pr-2 text-right">{fmtMoney(r.cumulativeCashFlow)}</td>
                  <td className="pr-2 text-right">{fmtPct(r.roe, 2)}</td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-ink-500 py-3 text-center">
                    No phases simulated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-500 mt-2">
          Cumulative cash flow = starting 0 + Σ netCashFlow. ROE = cumulativeCashFlow / equityFinance (
          {fmtMoney(team.equityFinance)}).
        </p>
      </CardBody>
    </Card>
  );
}

function SdSquad({ team, config }: { team: any; config: any }) {
  const players = useMemo(() => {
    const ids: number[] = team.selectedPlayerIds ?? [];
    return ids.map((id) => config.players.find((p: any) => p.id === id)).filter(Boolean) as any[];
  }, [team, config]);

  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Squad · index {team.teamIndex.toFixed(3)} ({team.teamClassification})</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {players.map((p) => {
            const injured = team.injuredPlayerIds?.includes(p.id);
            const suspended = team.suspendedPlayerIds?.includes(p.id);
            return (
              <div key={p.id} className="p-2 rounded-md ring-1 ring-ink-300 bg-ink-100 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {p.name} <span className="text-ink-500 text-xs">· {p.type}</span>
                  </div>
                  <div className="flex gap-1">
                    {injured && <Badge tone="bad">Injured</Badge>}
                    {suspended && <Badge tone="warn">Suspended</Badge>}
                    <Badge tone="neutral">idx {p.playerIndex.toFixed(2)}</Badge>
                  </div>
                </div>
                <div className="text-xs text-ink-500">
                  Cost {fmtMoney(p.purchaseCost)} · Salary {fmtMoney(p.annualSalary)}/yr
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

function OmOperations({ team, config, results }: { team: any; config: any; results: PhaseResult[] }) {
  const stadium = config.stadiums.find((s: any) => s.key === team.stadiumChoice);
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Stadium &amp; F&amp;B operations</CardTitle>
        {stadium ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="Stadium" value={stadium.label} />
            <Stat label="Capacity" value={stadium.capacity.toLocaleString()} />
            <Stat label="Ticket price" value={fmtMoney(stadium.ticketPrice)} />
            <Stat label="F&amp;B outlets" value={stadium.fbOutlets} />
            <Stat label="F&amp;B scheme" value={team.fbScheme ?? "—"} />
            <Stat
              label="F&amp;B param"
              value={team.fbScheme === "fixed" ? fmtMoney(stadium.fbFixedFeePerMonth) + "/mo" : `${(stadium.fbRevenuePct * 100).toFixed(0)}% share`}
            />
          </div>
        ) : (
          <p className="text-sm text-ink-500">No stadium selected yet.</p>
        )}
        {results.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-1">Attendance history</div>
            <ul className="text-xs space-y-1">
              {results.map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span>Phase {r.phase}</span>
                  <span>{(r.spectatorPct * 100).toFixed(0)}% · {fmtMoney(r.fbRevenue)} F&amp;B</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
