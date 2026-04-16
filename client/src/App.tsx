import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Button } from "./components/ui";
import { FacilitatorLogin } from "./pages/facilitator/Login";
import { FacilitatorRegister } from "./pages/facilitator/Register";
import { ForgotPassword } from "./pages/facilitator/ForgotPassword";
import { FacilitatorDashboard } from "./pages/facilitator/Dashboard";
import { FacilitatorConfigs } from "./pages/facilitator/Configs";
import { FacilitatorSession } from "./pages/facilitator/Session";
import { JoinLanding } from "./pages/team/Join";
import { JoinBrowse } from "./pages/team/JoinBrowse";
import { Lobby } from "./pages/team/Lobby";
import { Setup } from "./pages/team/Setup";
import { TeamDashboard } from "./pages/team/Dashboard";
import { Results } from "./pages/Results";

export function App() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-navy-600 text-[#E9E8E6]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <img src="/logo-mark.png" alt="" className="h-8 w-8" />
            Deeland Cricket League
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {session?.kind === "facilitator" && (
              <>
                <Link to="/facilitator" className="opacity-80 hover:opacity-100 hover:underline">
                  Dashboard
                </Link>
                <Link to="/facilitator/configs" className="opacity-80 hover:opacity-100 hover:underline">
                  Configs
                </Link>
                <span className="opacity-60">· {session.email}</span>
                <Button
                  variant="ghost"
                  className="text-[#E9E8E6] hover:bg-navy-700"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Log out
                </Button>
              </>
            )}
            {session?.kind === "team" && (
              <>
                <Link to="/team" className="opacity-80 hover:opacity-100 hover:underline">
                  My team
                </Link>
                <Link to="/team/setup" className="opacity-80 hover:opacity-100 hover:underline">
                  Setup
                </Link>
                <span className="opacity-60">· Role: {session.role}</span>
                <Button
                  variant="ghost"
                  className="text-[#E9E8E6] hover:bg-navy-700"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Leave
                </Button>
              </>
            )}
            {!session && (
              <>
                <Link to="/facilitator/login" className="hover:underline">
                  Facilitator
                </Link>
                <Link to="/join" className="hover:underline">
                  Join a game
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/facilitator/login" element={<FacilitatorLogin />} />
          <Route path="/facilitator/register" element={<FacilitatorRegister />} />
          <Route path="/facilitator/forgot-password" element={<ForgotPassword />} />
          <Route path="/facilitator" element={<RequireFacilitator><FacilitatorDashboard /></RequireFacilitator>} />
          <Route path="/facilitator/configs" element={<RequireFacilitator><FacilitatorConfigs /></RequireFacilitator>} />
          <Route path="/facilitator/session/:id" element={<RequireFacilitator><FacilitatorSession /></RequireFacilitator>} />
          <Route path="/join" element={<JoinLanding />} />
          <Route path="/join/:gameCode" element={<JoinBrowse />} />
          <Route path="/team" element={<RequireTeam><TeamDashboard /></RequireTeam>} />
          <Route path="/team/setup" element={<RequireTeam><Setup /></RequireTeam>} />
          <Route path="/team/lobby" element={<RequireTeam><Lobby /></RequireTeam>} />
          <Route path="/results/:sessionId" element={<Results />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <footer className="bg-navy-600 text-[#E9E8E6]/70 py-3 text-xs">
        <div className="max-w-7xl mx-auto px-4">Deeland Cricket League — Business Simulation Platform</div>
      </footer>
    </div>
  );
}

function Landing() {
  const { session } = useAuth();
  if (session?.kind === "facilitator") return <Navigate to="/facilitator" />;
  if (session?.kind === "team") return <Navigate to="/team" />;
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <img src="/logo-full.png" alt="Deeland Cricket League" className="mx-auto h-48 mb-6" />
      <p className="text-ink-500 mb-8">
        A business simulation where teams run a fictional cricket club: making financial, operational, marketing and
        staffing decisions across four phases of the season.
      </p>
      <div className="flex gap-3 justify-center">
        <Link to="/join">
          <Button>Join with a game code</Button>
        </Link>
        <Link to="/facilitator/login">
          <Button variant="secondary">I'm a facilitator</Button>
        </Link>
      </div>
    </div>
  );
}

function RequireFacilitator({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (session?.kind !== "facilitator") return <Navigate to="/facilitator/login" />;
  return <>{children}</>;
}

function RequireTeam({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (session?.kind !== "team") return <Navigate to="/join" />;
  return <>{children}</>;
}
