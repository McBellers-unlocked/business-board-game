import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";
import { Badge, Button, Card, CardBody, CardTitle, Textarea } from "./ui";
import { POLL_INTERVALS } from "@dcl/shared";

interface EventRow {
  id: string;
  phase: number;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  financialImpact: number | null;
  attendanceImpact: number | null;
  requiresResponse: boolean;
  responseDeadline: string | null;
  teamResponse: string | null;
  resolved: boolean;
  targetTeamId: string | null;
  targetTeamName?: string | null;
  triggeredAt: string;
}

export function EventNotifications({
  sessionId,
  canRespond
}: {
  sessionId: string;
  canRespond: boolean;
}) {
  const { data } = useQuery<{ events: EventRow[] }>({
    queryKey: ["events", sessionId],
    queryFn: () => api.get(`/api/events/session/${sessionId}/events`),
    refetchInterval: POLL_INTERVALS.teamDashboard
  });

  if (!data || data.events.length === 0) {
    return (
      <Card>
        <CardBody>
          <CardTitle>Events</CardTitle>
          <p className="text-sm text-ink-500 mt-2">No events have been triggered yet.</p>
        </CardBody>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {data.events.map((e) => (
        <EventCard key={e.id} event={e} canRespond={canRespond} />
      ))}
    </div>
  );
}

function EventCard({ event, canRespond }: { event: EventRow; canRespond: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(event.teamResponse ?? "");
  const [error, setError] = useState<string | null>(null);
  const respond = useMutation({
    mutationFn: (body: { teamResponse: string }) => api.post(`/api/events/${event.id}/respond`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to submit");
    }
  });
  const tone = event.severity === "critical" ? "bad" : event.severity === "warning" ? "warn" : "info";
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{event.title}</CardTitle>
              <Badge tone={tone}>{event.severity}</Badge>
              <Badge tone="neutral">Phase {event.phase}</Badge>
              {event.resolved && <Badge tone="good">Resolved</Badge>}
            </div>
            <p className="text-sm text-ink-700 mt-2 whitespace-pre-line">{event.description}</p>
            <div className="mt-2 text-xs text-ink-500 flex gap-4 flex-wrap">
              {event.financialImpact != null && (
                <span>
                  Cash: {event.financialImpact >= 0 ? "+" : ""}£{event.financialImpact.toLocaleString()}
                </span>
              )}
              {event.attendanceImpact != null && (
                <span>Attendance ×{event.attendanceImpact}</span>
              )}
              {event.targetTeamName && <span>Target: {event.targetTeamName}</span>}
              {event.responseDeadline && <span>Response due: {new Date(event.responseDeadline).toLocaleTimeString()}</span>}
            </div>
          </div>
        </div>
        {event.requiresResponse && (
          <div className="mt-3 border-t border-ink-100 pt-3">
            <div className="text-sm font-medium mb-1">Team response</div>
            {!canRespond && (
              <div className="text-xs text-ink-500 mb-2">Only MPRD or MD may submit the response.</div>
            )}
            <Textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!canRespond || respond.isPending || event.resolved}
            />
            {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
            <div className="mt-2 flex justify-end">
              <Button
                disabled={!canRespond || !draft || respond.isPending || event.resolved}
                onClick={() => respond.mutate({ teamResponse: draft })}
              >
                {respond.isPending ? "Submitting…" : event.teamResponse ? "Update response" : "Submit response"}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
