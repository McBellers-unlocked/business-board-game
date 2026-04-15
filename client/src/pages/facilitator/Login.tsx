import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Button, Card, CardBody, CardTitle, Input, Label } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

export function FacilitatorLogin() {
  const [email, setEmail] = useState("demo@dcl.local");
  const [password, setPassword] = useState("demo12345");
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
      }>("/api/auth/login", { email, password });
      login(resp.token, {
        kind: "facilitator",
        facilitatorId: resp.profile.id,
        email: resp.profile.email,
        displayName: resp.profile.displayName
      });
      navigate("/facilitator");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardBody>
          <CardTitle className="mb-4">Facilitator login</CardTitle>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex items-center justify-between">
              <Button type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <div className="flex gap-3 text-sm">
                <Link to="/facilitator/forgot-password" className="text-brand-600 hover:underline">
                  Forgot password?
                </Link>
                <Link to="/facilitator/register" className="text-brand-600 hover:underline">
                  Create account
                </Link>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
