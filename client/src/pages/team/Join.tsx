import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, CardTitle, Input, Label } from "../../components/ui";

export function JoinLanding() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) return;
    navigate(`/join/${clean}`);
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardBody>
          <CardTitle className="mb-4">Join a game</CardTitle>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Game code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABC234"
                maxLength={6}
                className="uppercase tracking-widest text-xl"
                autoFocus
                required
              />
            </div>
            <Button type="submit" disabled={code.trim().length !== 6}>
              Continue
            </Button>
          </form>
          <p className="text-xs text-ink-500 mt-4">
            Your facilitator will share a 6-character code. Codes are not case-sensitive.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
