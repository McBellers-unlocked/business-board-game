import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Button, Card, CardBody, CardTitle, Input, Label } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

export function FacilitatorRegister() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const resp = await api.post<{
        token: string;
        profile: { id: string; email: string; displayName: string | null };
      }>("/api/auth/register", { email, password, displayName });
      login(resp.token, {
        kind: "facilitator",
        facilitatorId: resp.profile.id,
        email: resp.profile.email,
        displayName: resp.profile.displayName
      });
      navigate("/facilitator");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardBody>
          <CardTitle className="mb-4">Create facilitator account</CardTitle>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={1} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Password (min 8)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex items-center justify-between">
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </Button>
              <Link to="/facilitator/login" className="text-sm text-brand-600 hover:underline">
                Have one? Sign in
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
