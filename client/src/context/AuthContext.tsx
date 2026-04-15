import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { TeamRole } from "@dcl/shared";
import { setToken } from "../api/client";

export type AuthSession =
  | { kind: "facilitator"; facilitatorId: string; email: string; displayName: string | null }
  | { kind: "team"; sessionId: string; teamId: string; memberId: string; role: TeamRole }
  | null;

interface AuthContextValue {
  session: AuthSession;
  login: (token: string, session: Exclude<AuthSession, null>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>(() => {
    try {
      const s = localStorage.getItem("dcl_session");
      return s ? (JSON.parse(s) as AuthSession) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session) localStorage.setItem("dcl_session", JSON.stringify(session));
    else localStorage.removeItem("dcl_session");
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      login: (token, s) => {
        setToken(token);
        setSession(s);
      },
      logout: () => {
        setToken(null);
        setSession(null);
      }
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
