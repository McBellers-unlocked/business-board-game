import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Button, Card, CardBody, CardTitle, Input, Label } from "../../components/ui";

export function ForgotPassword() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await api.post("/api/auth/forgot-password", { email });
      setInfo("If that email exists, a 6-digit code has been sent. Check your inbox.");
      setStep("confirm");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await api.post("/api/auth/reset-password", { email, code, newPassword });
      setInfo("Password updated. Redirecting to login…");
      setTimeout(() => navigate("/facilitator/login"), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardBody>
          <CardTitle className="mb-4">
            {step === "request" ? "Reset your password" : "Enter your code"}
          </CardTitle>

          {step === "request" ? (
            <form onSubmit={sendCode} className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
              {info && <div className="text-sm text-green-700">{info}</div>}
              <div className="flex items-center justify-between">
                <Button type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Send code"}
                </Button>
                <Link to="/facilitator/login" className="text-sm text-brand-600 hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label>Code (6 digits)</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  autoFocus
                  required
                />
              </div>
              <div>
                <Label>New password (min 8)</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
              {info && <div className="text-sm text-green-700">{info}</div>}
              <div className="flex items-center justify-between">
                <Button type="submit" disabled={busy || !code || !newPassword}>
                  {busy ? "Resetting…" : "Set new password"}
                </Button>
                <button
                  type="button"
                  onClick={() => sendCode(new Event("submit") as any)}
                  className="text-sm text-brand-600 hover:underline"
                  disabled={busy}
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
