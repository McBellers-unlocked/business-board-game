import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import { Badge, Button, Card, CardBody, CardTitle, Input, Label, Select } from "../../components/ui";

interface SessionRow {
  id: string;
  game_code: string;
  status: string;
  human_team_count: number;
  current_phase: number;
  created_at: string;
  config_name: string;
}

interface ConfigRow {
  id: string;
  name: string;
  is_template: boolean;
}

export function FacilitatorDashboard() {
  const qc = useQueryClient();
  const sessions = useQuery<{ sessions: SessionRow[] }>({
    queryKey: ["sessions"],
    queryFn: () => api.get("/api/sessions"),
    refetchInterval: 5000
  });
  const configs = useQuery<{ configs: ConfigRow[] }>({
    queryKey: ["configs"],
    queryFn: () => api.get("/api/configs")
  });

  const [selectedConfig, setSelectedConfig] = useState("00000000-0000-0000-0000-000000000001");
  const [humanTeams, setHumanTeams] = useState(4);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: { configId: string; humanTeamCount: number }) =>
      api.post<{ id: string; gameCode: string }>("/api/sessions", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to create")
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <Card>
          <CardBody>
            <CardTitle className="mb-3">Active sessions</CardTitle>
            {sessions.data?.sessions.length ? (
              <ul className="divide-y divide-ink-100">
                {sessions.data.sessions.map((s) => (
                  <li key={s.id} className="py-2 flex items-center justify-between">
                    <div>
                      <Link to={`/facilitator/session/${s.id}`} className="font-medium text-brand-700 hover:underline">
                        {s.config_name}
                      </Link>
                      <div className="text-xs text-ink-500">
                        Code {s.game_code} · {s.human_team_count} human team(s) · Phase {s.current_phase}/4 ·{" "}
                        {new Date(s.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Badge tone={s.status === "completed" ? "good" : "info"}>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">No sessions yet. Create one on the right.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <aside>
        <Card>
          <CardBody>
            <CardTitle className="mb-3">Create a session</CardTitle>
            <div className="space-y-3">
              <div>
                <Label>Configuration</Label>
                <Select value={selectedConfig} onChange={(e) => setSelectedConfig(e.target.value)}>
                  {configs.data?.configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.is_template ? "(template)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Human team count (1–8)</Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={humanTeams}
                  onChange={(e) => setHumanTeams(Number(e.target.value))}
                />
                <p className="text-xs text-ink-500 mt-1">Remaining {8 - humanTeams} slots are AI-controlled.</p>
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
              <Button disabled={create.isPending} onClick={() => create.mutate({ configId: selectedConfig, humanTeamCount: humanTeams })}>
                {create.isPending ? "Creating…" : "Create session"}
              </Button>
              {create.data && (
                <div className="bg-brand-50 border border-brand-100 rounded-md p-3 text-sm">
                  Session created. Code: <span className="font-mono font-semibold">{create.data.gameCode}</span>.{" "}
                  <Link to={`/facilitator/session/${create.data.id}`} className="text-brand-700 underline">
                    Open
                  </Link>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}
