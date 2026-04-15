import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { GameConfig, GameSession, LeagueTableRow, PhaseResult, Team } from "@dcl/shared";
import { POLL_INTERVALS } from "@dcl/shared";

export interface SessionBundle {
  session: GameSession;
  config: GameConfig;
  teams: Team[];
  phaseResults: PhaseResult[];
  leagueTable: LeagueTableRow[];
}

export function useSession(sessionId: string | null | undefined, intervalMs = POLL_INTERVALS.teamDashboard) {
  return useQuery<SessionBundle>({
    queryKey: ["session", sessionId],
    queryFn: () => api.get<SessionBundle>(`/api/sessions/${sessionId}`),
    enabled: !!sessionId,
    refetchInterval: intervalMs
  });
}

export function useMySession() {
  const { session } = useAuth();
  const sessionId = session?.kind === "team" ? session.sessionId : null;
  return useSession(sessionId);
}
