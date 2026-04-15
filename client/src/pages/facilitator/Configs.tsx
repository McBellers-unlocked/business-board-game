import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import { Badge, Button, Card, CardBody, CardTitle, Input, Label, Textarea } from "../../components/ui";
import { makeDefaultGameConfig } from "@dcl/shared";

interface ConfigRow {
  id: string;
  name: string;
  is_template: boolean;
  updated_at: string;
}

export function FacilitatorConfigs() {
  const qc = useQueryClient();
  const list = useQuery<{ configs: ConfigRow[] }>({ queryKey: ["configs"], queryFn: () => api.get("/api/configs") });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [raw, setRaw] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const load = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.get<{ id: string; name: string; config: any; is_template: boolean }>(`/api/configs/${id}`);
      return res;
    },
    onSuccess: (res) => {
      setEditingId(res.id);
      setName(res.name);
      setRaw(JSON.stringify(res.config, null, 2));
      setParseError(null);
      setApiError(null);
    }
  });

  const save = useMutation({
    mutationFn: async (body: { id: string | null; name: string; config: any }) => {
      if (body.id) return api.put<{ id: string }>(`/api/configs/${body.id}`, { name: body.name, config: body.config });
      return api.post<{ id: string }>("/api/configs", { name: body.name, config: body.config });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["configs"] }),
    onError: (err) => setApiError(err instanceof ApiError ? err.message : "Save failed")
  });

  const clone = useMutation({
    mutationFn: (id: string) => api.post<{ id: string }>(`/api/configs/${id}/clone`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["configs"] })
  });

  function parseOrReport(): any | null {
    try {
      const parsed = JSON.parse(raw);
      setParseError(null);
      return parsed;
    } catch (err) {
      setParseError((err as Error).message);
      return null;
    }
  }

  function newFromDefault() {
    const base = makeDefaultGameConfig();
    setEditingId(null);
    setName("Custom configuration");
    setRaw(JSON.stringify(base, null, 2));
    setParseError(null);
    setApiError(null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div>
        <Card>
          <CardBody>
            <CardTitle className="mb-3">Configurations</CardTitle>
            <ul className="divide-y divide-ink-100 mb-3">
              {list.data?.configs.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                  <button className="text-left hover:underline" onClick={() => load.mutate(c.id)}>
                    {c.name}
                  </button>
                  <div className="flex items-center gap-2">
                    {c.is_template && <Badge tone="info">template</Badge>}
                    <Button variant="ghost" onClick={() => clone.mutate(c.id)}>
                      Clone
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="secondary" onClick={newFromDefault}>
              New from default
            </Button>
          </CardBody>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card>
          <CardBody>
            <CardTitle className="mb-3">Edit configuration (JSON)</CardTitle>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Raw JSON config</Label>
                <Textarea
                  rows={18}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              {parseError && <div className="text-sm text-red-600">Parse error: {parseError}</div>}
              {apiError && <div className="text-sm text-red-600">{apiError}</div>}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const parsed = parseOrReport();
                    if (!parsed) return;
                    save.mutate({ id: editingId, name, config: parsed });
                  }}
                  disabled={save.isPending}
                >
                  {editingId ? "Save changes" : "Create"}
                </Button>
                <Button variant="secondary" onClick={newFromDefault}>
                  Reset to default
                </Button>
              </div>
              <p className="text-xs text-ink-500">
                The default JSON includes 3 stadiums, 20 players, 4 phases, a 9-cell probability matrix, spectator/resale
                rules, and an event library of {makeDefaultGameConfig().eventLibrary.length} templates. You can edit any
                field but probabilities must sum to 1.0 per row.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
