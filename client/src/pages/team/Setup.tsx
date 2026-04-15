import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import { Badge, Button, Card, CardBody, CardTitle, Input, Label, Select, Stat } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useMySession } from "../../hooks/useSessionData";
import { fmtMoney, fmtNumber, fmtPct } from "../../lib/format";
import {
  SETUP_PERMISSIONS,
  type PlayerConfig,
  type StadiumConfig,
  type TeamRole,
  type FBScheme
} from "@dcl/shared";

export function Setup() {
  const { session } = useAuth();
  if (session?.kind !== "team") return <Navigate to="/join" />;
  const { data, isLoading } = useMySession();
  const qc = useQueryClient();

  const myTeam = useMemo(() => data?.teams.find((t) => t.id === session.teamId), [data, session]);
  const config = data?.config;

  const role = session.role;
  const canClubName = SETUP_PERMISSIONS.clubName.includes(role);
  const canStadium = SETUP_PERMISSIONS.stadium.includes(role);
  const canFb = SETUP_PERMISSIONS.fbScheme.includes(role);
  const canPlayers = SETUP_PERMISSIONS.playerSelection.includes(role);
  const canEquity = SETUP_PERMISSIONS.equityFinance.includes(role);
  const canComplete = ["MD", "FD"].includes(role);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.put(`/api/teams/${session.teamId}/setup`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session", session.sessionId] })
  });

  if (isLoading || !data || !myTeam || !config) return <div className="text-ink-500">Loading…</div>;

  if (data.session.status !== "setup") {
    return (
      <Card>
        <CardBody>
          <CardTitle>Setup is locked</CardTitle>
          <p className="text-sm text-ink-700 mt-2">
            The facilitator has moved the game past setup. Head to your dashboard.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{myTeam.name}</h1>
          <p className="text-sm text-ink-500">Role: {role} · Setup phase</p>
        </div>
        <div className="flex gap-2 items-center">
          {myTeam.setupComplete ? (
            <Badge tone="good">Ready</Badge>
          ) : (
            <Badge tone="warn">In progress</Badge>
          )}
          {canComplete && (
            <Button
              onClick={() => mutation.mutate({ setupComplete: !myTeam.setupComplete })}
              disabled={mutation.isPending}
            >
              {myTeam.setupComplete ? "Mark not ready" : "Mark setup complete"}
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardBody className="py-3">
          <p className="text-sm text-ink-700">
            Each decision is owned by specific roles — panels you can't edit will be greyed out. Coordinate as a
            team: MD owns the club name and breaks deadlocks; MD/FD pick the stadium and equity; FD/OM pick F&amp;B;
            SD picks the squad. When every decision is made, MD or FD clicks <strong>Mark setup complete</strong> and
            the facilitator can advance to phase 1.
          </p>
        </CardBody>
      </Card>

      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm">
          <div>{(mutation.error as ApiError)?.message}</div>
          {Array.isArray((mutation.error as ApiError)?.details) && (
            <ul className="list-disc list-inside mt-1 text-xs">
              {((mutation.error as ApiError).details as string[]).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <ClubNamePanel team={myTeam} disabled={!canClubName} onSave={(v) => mutation.mutate({ clubName: v })} />
          <StadiumPanel team={myTeam} stadiums={config.stadiums} disabled={!canStadium}
            onSave={(v) => mutation.mutate({ stadiumChoice: v })} />
          <FBPanel team={myTeam} disabled={!canFb} onSave={(v) => mutation.mutate({ fbScheme: v })} />
          <PlayersPanel
            team={myTeam}
            players={config.players}
            disabled={!canPlayers}
            onSave={(ids) => mutation.mutate({ selectedPlayerIds: ids })}
          />
          <EquityPanel team={myTeam} disabled={!canEquity}
            onSave={(v) => mutation.mutate({ equityFinance: v })} />
        </div>

        <aside className="space-y-4">
          <ProjectionPanel teamId={myTeam.id} />
          <ChecklistPanel team={myTeam} />
          <RoleHintPanel role={role} />
        </aside>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Panels
// --------------------------------------------------------------------------

function ClubNamePanel({ team, disabled, onSave }: { team: any; disabled: boolean; onSave: (v: string) => void }) {
  const [name, setName] = useState(team.name);
  return (
    <Card>
      <CardBody>
        <CardTitle>Club name</CardTitle>
        <p className="text-sm text-ink-500 mb-3">Decided by: MD</p>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} />
          <Button disabled={disabled || !name || name === team.name} onClick={() => onSave(name)}>
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function StadiumPanel({
  team,
  stadiums,
  disabled,
  onSave
}: {
  team: any;
  stadiums: StadiumConfig[];
  disabled: boolean;
  onSave: (key: string) => void;
}) {
  return (
    <Card>
      <CardBody>
        <CardTitle>Stadium choice</CardTitle>
        <p className="text-sm text-ink-500 mb-3">Decided by: MD, FD</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {stadiums.map((s) => (
            <button
              key={s.key}
              disabled={disabled}
              onClick={() => onSave(s.key)}
              className={`text-left p-3 rounded-md ring-1 transition ${
                team.stadiumChoice === s.key ? "ring-brand-500 bg-brand-50" : "ring-ink-300 bg-white hover:bg-ink-100"
              } disabled:opacity-60`}
            >
              <div className="font-medium">{s.label}</div>
              <div className="text-xs text-ink-500 mt-1">
                Cost {fmtMoney(s.purchaseCost)} · Cap {s.capacity.toLocaleString()} · Ticket {fmtMoney(s.ticketPrice)}
              </div>
              <div className="text-xs text-ink-500 mt-1">
                {s.fbOutlets} F&amp;B outlets · {(s.fbSpectatorPct * 100).toFixed(0)}% purchase rate
              </div>
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function FBPanel({ team, disabled, onSave }: { team: any; disabled: boolean; onSave: (v: FBScheme) => void }) {
  return (
    <Card>
      <CardBody>
        <CardTitle>F&amp;B licence scheme</CardTitle>
        <p className="text-sm text-ink-500 mb-3">Decided by: FD, OM</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            disabled={disabled}
            onClick={() => onSave("fixed")}
            className={`text-left p-3 rounded-md ring-1 transition ${
              team.fbScheme === "fixed" ? "ring-brand-500 bg-brand-50" : "ring-ink-300 bg-white hover:bg-ink-100"
            } disabled:opacity-60`}
          >
            <div className="font-medium">Fixed fee</div>
            <div className="text-xs text-ink-500 mt-1">Predictable revenue; set per outlet per month.</div>
          </button>
          <button
            disabled={disabled}
            onClick={() => onSave("revenue")}
            className={`text-left p-3 rounded-md ring-1 transition ${
              team.fbScheme === "revenue" ? "ring-brand-500 bg-brand-50" : "ring-ink-300 bg-white hover:bg-ink-100"
            } disabled:opacity-60`}
          >
            <div className="font-medium">Revenue share (30%)</div>
            <div className="text-xs text-ink-500 mt-1">Scales with spectators and stadium size.</div>
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

function PlayersPanel({
  team,
  players,
  disabled,
  onSave
}: {
  team: any;
  players: PlayerConfig[];
  disabled: boolean;
  onSave: (ids: number[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(team.selectedPlayerIds));
  const toggle = (id: number) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const counts = useMemo(() => {
    const sel = players.filter((p) => selected.has(p.id));
    return {
      total: sel.length,
      batters: sel.filter((p) => p.type === "Batsman" || p.type === "All-Rounder").length,
      bowlers: sel.filter((p) => p.type === "Bowler" || p.type === "All-Rounder").length,
      totalCost: sel.reduce((s, p) => s + p.purchaseCost, 0),
      totalSalary: sel.reduce((s, p) => s + p.annualSalary, 0),
      indexSum: sel.reduce((s, p) => s + p.playerIndex, 0)
    };
  }, [selected, players]);

  return (
    <Card>
      <CardBody>
        <CardTitle>Squad selection</CardTitle>
        <p className="text-sm text-ink-500 mb-3">Decided by: SD · Min 12, max 20, ≥6 batters, ≥5 bowlers</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Stat label="Selected" value={counts.total} hint={`${counts.batters} bat · ${counts.bowlers} bowl`} />
          <Stat label="Purchase" value={fmtMoney(counts.totalCost)} />
          <Stat label="Annual salary" value={fmtMoney(counts.totalSalary)} />
          <Stat label="Team index" value={fmtNumber(counts.indexSum / 14, 3)} hint="(sum / 14)" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-auto p-1">
          {players.map((p) => {
            const chosen = selected.has(p.id);
            return (
              <button
                key={p.id}
                disabled={disabled}
                onClick={() => toggle(p.id)}
                className={`text-left p-2 rounded-md ring-1 text-sm transition ${
                  chosen ? "ring-brand-500 bg-brand-50" : "ring-ink-300 bg-white hover:bg-ink-100"
                } disabled:opacity-60`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.name}</div>
                  <Badge tone={p.type === "All-Rounder" ? "info" : p.type === "Batsman" ? "good" : "warn"}>
                    {p.type[0]}
                  </Badge>
                </div>
                <div className="text-xs text-ink-500">
                  {fmtMoney(p.purchaseCost)} · {fmtMoney(p.annualSalary)}/yr · idx {p.playerIndex.toFixed(2)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setSelected(new Set(team.selectedPlayerIds))} disabled={disabled}>
            Reset
          </Button>
          <Button disabled={disabled} onClick={() => onSave([...selected].sort((a, b) => a - b))}>
            Save squad
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function EquityPanel({ team, disabled, onSave }: { team: any; disabled: boolean; onSave: (v: number) => void }) {
  const [value, setValue] = useState(team.equityFinance);
  return (
    <Card>
      <CardBody>
        <CardTitle>Equity finance</CardTitle>
        <p className="text-sm text-ink-500 mb-3">
          Decided by: MD, FD · Any shortfall is debt-financed at 5% p.a.
        </p>
        <div className="flex gap-2 items-center">
          <Label>Equity</Label>
          <Input
            type="number"
            min={0}
            step={100000}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            disabled={disabled}
          />
          <Button disabled={disabled || value === team.equityFinance} onClick={() => onSave(value)}>
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ProjectionPanel({ teamId }: { teamId: string }) {
  const { data } = useProjection(teamId);
  if (!data) return null;
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Projection</CardTitle>
        <div className="space-y-2">
          <Stat label="Team index" value={fmtNumber(data.teamIndex, 3)} hint={data.classification ?? "No squad"} />
          <Stat label="Stadium cost" value={fmtMoney(data.stadium?.purchaseCost ?? 0)} />
          <Stat label="Squad cost" value={fmtMoney(data.squadTotals.totalPurchaseCost)} />
          <Stat label="Annual salary" value={fmtMoney(data.squadTotals.totalAnnualSalary)} />
          <Stat label="Debt required" value={fmtMoney(data.debtRequired)} hint={`Interest ${fmtMoney(data.annualInterest)}/yr`} />
        </div>
      </CardBody>
    </Card>
  );
}

interface ProjectionResponse {
  teamIndex: number;
  totalPlayerIndex: number;
  classification: "Poor" | "Average" | "Good" | null;
  squadTotals: { totalPurchaseCost: number; totalAnnualSalary: number };
  stadium: StadiumConfig | null;
  debtRequired: number;
  annualInterest: number;
  equityFinance: number;
}

function useProjection(teamId: string) {
  return useQuery<ProjectionResponse>({
    queryKey: ["projection", teamId],
    queryFn: () => api.get<ProjectionResponse>(`/api/teams/${teamId}/projection`),
    refetchInterval: 5000
  });
}

function ChecklistPanel({ team }: { team: any }) {
  const items = [
    { label: "Club name", done: team.name && !/^Team \d+$/.test(team.name) },
    { label: "Stadium", done: !!team.stadiumChoice },
    { label: "F&B scheme", done: !!team.fbScheme },
    { label: "Squad (valid)", done: team.selectedPlayerIds.length >= 12 },
    { label: "Equity finance", done: team.equityFinance > 0 },
    { label: "Setup complete", done: team.setupComplete }
  ];
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Checklist</CardTitle>
        <ul className="text-sm space-y-1">
          {items.map((i) => (
            <li key={i.label} className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${i.done ? "bg-green-500" : "bg-ink-300"}`} />
              {i.label}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function RoleHintPanel({ role }: { role: TeamRole }) {
  const hints: Record<TeamRole, string[]> = {
    MD: [
      "You own the club name and break deadlocks.",
      "Co-own the stadium and equity decisions with FD.",
      "Prepare the shareholder presentation."
    ],
    FD: [
      "Co-own stadium choice; own equity & financing case.",
      "Co-own F&B scheme with OM.",
      "Model the debt schedule and season P&L."
    ],
    SD: ["Own the squad selection.", "Ensure ≥6 batters, ≥5 bowlers, 12–20 players.", "Plan for injuries and mid-season trades."],
    MPRD: ["Prepare media announcements and press responses.", "Plan CSR project for DCL funding pitch."],
    OM: ["Co-own F&B scheme with FD.", "Support decisions on safety, weather, F&B ops."]
  };
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-3">Role priorities · {role}</CardTitle>
        <ul className="list-disc list-inside text-sm text-ink-700 space-y-1">
          {hints[role].map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
