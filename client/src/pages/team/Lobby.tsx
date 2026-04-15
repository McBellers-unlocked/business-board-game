import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { api } from "../../api/client";
import { Card, CardBody, CardTitle, Badge } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { POLL_INTERVALS, ROLE_LABELS } from "@dcl/shared";
import type { Team } from "@dcl/shared";

export function Lobby() {
  const { session } = useAuth();
  if (session?.kind !== "team") return <Navigate to="/join" />;

  const { data } = useQuery<{ teams: Team[] }>({
    queryKey: ["teams", session.sessionId],
    queryFn: () => api.get(`/api/teams/session/${session.sessionId}/teams`),
    refetchInterval: POLL_INTERVALS.joinLobby
  });

  const myTeam = data?.teams.find((t) => t.id === session.teamId);
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Waiting for your team</h1>
      <Card>
        <CardBody>
          <CardTitle>{myTeam?.name ?? "…"}</CardTitle>
          <div className="mt-2 space-y-2">
            {myTeam?.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <div>{m.displayName}</div>
                <Badge tone="info">
                  {m.role} · {ROLE_LABELS[m.role]}
                </Badge>
              </div>
            )) ?? <div className="text-sm text-ink-500">Loading team…</div>}
          </div>
        </CardBody>
      </Card>
      <p className="text-sm text-ink-500">
        At least MD, FD and SD must join before setup can be completed. Keep this tab open.
      </p>
    </div>
  );
}
