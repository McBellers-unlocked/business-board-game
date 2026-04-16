import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import { Button, Card, CardBody, CardTitle, Input, Label, Select, Spinner, Badge } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import type { SessionJoinInfo, TeamRole } from "@dcl/shared";
import { ALL_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, POLL_INTERVALS } from "@dcl/shared";

export function JoinBrowse() {
  const { gameCode } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [role, setRole] = useState<TeamRole | "">("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError } = useQuery<SessionJoinInfo>({
    queryKey: ["join", gameCode],
    queryFn: () => api.get<SessionJoinInfo>(`/api/auth/join/${gameCode}`),
    refetchInterval: POLL_INTERVALS.joinLobby
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-ink-500">
        <Spinner /> Looking up session…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardBody>
            <CardTitle>Can't find that game</CardTitle>
            <p className="text-sm text-ink-700 mt-2">The code might be wrong, or the session has ended.</p>
            <Button className="mt-4" variant="secondary" onClick={() => navigate("/join")}>
              Back
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const selectedTeam = data.teams.find((t) => t.id === selectedTeamId);
  const rolesTaken = selectedTeam ? selectedTeam.takenRoles : [];

  async function submit() {
    if (!selectedTeamId || !role || !displayName) return;
    setError(null);
    setBusy(true);
    try {
      const resp = await api.post<{
        token: string;
        sessionId: string;
        teamId: string;
        memberId: string;
        role: TeamRole;
      }>("/api/auth/join", {
        gameCode,
        teamId: selectedTeamId,
        role,
        displayName
      });
      login(resp.token, {
        kind: "team",
        sessionId: resp.sessionId,
        teamId: resp.teamId,
        memberId: resp.memberId,
        role: resp.role
      });
      navigate("/team");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Join failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{data.sessionName}</h1>
        <p className="text-sm text-ink-500">Game code: <span className="tracking-widest font-mono">{gameCode}</span> · Status: {data.status}</p>
      </div>

      <Card>
        <CardBody>
          <CardTitle className="mb-3">Choose your team</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.teams
              .filter((t) => !t.isAI)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTeamId(t.id);
                    setRole("");
                  }}
                  className={`text-left rounded-md p-3 ring-1 ${
                    selectedTeamId === t.id ? "ring-brand-500 bg-brand-50" : "ring-ink-300 bg-ink-100 hover:bg-ink-100"
                  }`}
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-ink-500 mt-1">
                    {t.memberCount} member{t.memberCount === 1 ? "" : "s"} · Taken: {t.takenRoles.join(", ") || "none"}
                  </div>
                </button>
              ))}
          </div>
          {data.teams.some((t) => t.isAI) && (
            <p className="text-xs text-ink-500 mt-3">
              AI-controlled opponents: {data.teams.filter((t) => t.isAI).map((t) => t.name).join(", ")}
            </p>
          )}
        </CardBody>
      </Card>

      {selectedTeam && (
        <Card>
          <CardBody>
            <CardTitle className="mb-3">Choose a role</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_ROLES.map((r) => {
                const taken = rolesTaken.includes(r);
                return (
                  <button
                    key={r}
                    disabled={taken}
                    onClick={() => setRole(r)}
                    className={`text-left rounded-md p-3 ring-1 ${
                      role === r ? "ring-brand-500 bg-brand-50" : "ring-ink-300 bg-ink-100 hover:bg-ink-100"
                    } disabled:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{ROLE_LABELS[r]} <span className="text-ink-500 text-xs font-normal">({r})</span></div>
                      {taken && <Badge tone="neutral">Taken</Badge>}
                    </div>
                    <p className="text-xs text-ink-500 mt-1">{ROLE_DESCRIPTIONS[r]}</p>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {selectedTeam && role && (
        <Card>
          <CardBody>
            <CardTitle className="mb-3">Your display name</CardTitle>
            <Input
              placeholder="e.g. Priya K."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
            />
            {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
            <Button className="mt-4" disabled={!displayName || busy} onClick={submit}>
              {busy ? "Joining…" : `Join ${selectedTeam.name} as ${role}`}
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
