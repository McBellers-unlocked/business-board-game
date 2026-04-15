# Deeland Cricket League — Business Simulation Platform

## SDD Specification for Claude Code

---

# 1. PROPOSAL (scope & goals)

## 1.1 Problem Statement

A business simulation game ("Deeland Cricket League") has been designed as a facilitated educational exercise where teams of 4–5 participants manage a fictional cricket club, making interconnected business decisions across finance, operations, marketing, and stakeholder management. The game is currently paper-based and facilitator-intensive. All financial calculations, league table management, match outcome simulation, and phase progression are done manually.

## 1.2 Product Vision

Build a full-stack web platform that automates the game engine, provides role-specific team dashboards, and gives facilitators a real-time control panel — enabling multiple concurrent game sessions (leagues) to run simultaneously. The platform should be configurable so the underlying game rules (stadiums, players, probability matrices, pricing) can be adjusted for different deployments.

## 1.3 Users

| User Type | Description | Auth Model |
|-----------|-------------|------------|
| **Facilitator** | Creates and controls game sessions. Has a persistent Cognito account. Can run multiple leagues simultaneously. Triggers phase progression, events, and logs qualitative scores. | Cognito email/password |
| **Team Member** | Joins a game session via a 6-character game code. Selects a team and a role within that team. Sees a role-specific dashboard. | Game code + role selection (anonymous, session-scoped) |

## 1.4 Key Objectives

- Automate all financial calculations, match simulations, and league table management
- Provide enforced role-based views for each team member (MD, FD, SD, MPRD, OM)
- Support multiple concurrent leagues with a configurable mix of human and AI teams (up to 8 per league)
- Give facilitators a real-time dashboard showing all teams' positions, with controls to advance phases and trigger events
- Support hybrid qualitative assessment — live presentations scored by the facilitator in-platform
- Make game rules fully configurable (stadium parameters, player rosters, probability matrices, F&B pricing)

## 1.5 Out of Scope (v1)

- Video/audio capture of presentations (facilitator scores manually)
- Player trading between human teams (only facilitator-initiated transfers)
- Mobile-native apps (responsive web only)
- Public leaderboards across sessions
- Integration with LMS platforms

---

# 2. SPEC (requirements & acceptance criteria)

## 2.1 Domain Model

### 2.1.1 Game Configuration

A Game Configuration defines the rules for a simulation. It is a reusable template.

```
GameConfig {
  id: UUID
  name: string                          // e.g. "Deeland Cricket League 2026"
  createdBy: facilitatorId
  
  stadiums: StadiumConfig[]             // Array of stadium options
  players: PlayerConfig[]               // Available player roster
  probabilityMatrix: ProbabilityMatrix  // Win/draw/lose probabilities
  phases: PhaseConfig[]                 // Phase structure (matches per phase, home/away split)
  fbSchemes: FBSchemeConfig             // F&B licensing parameters
  financingRules: FinancingRules        // Equity, debt, interest rates
  spectatorRules: SpectatorRules        // League position → attendance %
  resaleRules: ResaleRules              // League position → resale multiplier
  teamConstraints: TeamConstraints      // Min/max players, role requirements
  scoringRubrics: ScoringRubric[]       // Qualitative assessment criteria
  eventLibrary: EventTemplate[]         // Pre-built events facilitator can trigger
}
```

### 2.1.2 Stadium Configuration

```
StadiumConfig {
  key: string                    // "small" | "medium" | "large" (or custom)
  label: string
  purchaseCost: number
  capacity: number
  ticketPrice: number            // Revenue per spectator per match
  fbOutlets: number
  fbAveragePrice: number         // Average price per F&B item
  fbSpectatorPct: number         // % of spectators who purchase an item
  fbFixedFeePerMonth: number     // Fixed fee per outlet per month
  fbRevenuePct: number           // Revenue share percentage
}
```

### 2.1.3 Player Configuration

```
PlayerConfig {
  id: number
  name: string
  type: "Batsman" | "Bowler" | "All-Rounder"
  purchaseCost: number
  annualSalary: number
  playerIndex: number            // Skill rating
}
```

### 2.1.4 Probability Matrix

```
ProbabilityMatrix {
  // Key: "{yourClass}-{opponentClass}" where class ∈ {"Poor", "Average", "Good"}
  // Value: { win: number, draw: number, lose: number } — must sum to 1.0
  entries: Record<string, { win: number, draw: number, lose: number }>
}
```

### 2.1.5 Game Session (League)

```
GameSession {
  id: UUID
  gameCode: string               // 6-char alphanumeric, unique, used by players to join
  configId: UUID                 // References GameConfig
  facilitatorId: UUID
  status: "setup" | "phase1" | "phase2" | "phase3" | "phase4" | "completed"
  humanTeamCount: number         // 1–8, rest are AI
  teams: Team[]                  // Mix of human and AI teams
  createdAt: timestamp
  currentPhase: number           // 0 = setup, 1–4 = active phases
}
```

### 2.1.6 Team

```
Team {
  id: UUID
  sessionId: UUID
  name: string
  isAI: boolean
  stadiumChoice: string | null       // Key from StadiumConfig
  fbScheme: "fixed" | "revenue" | null
  selectedPlayerIds: number[]
  equityFinance: number
  members: TeamMember[]              // Empty if AI team
  
  // Computed (engine calculates)
  teamIndex: number
  teamClassification: "Poor" | "Average" | "Good"
  debtRequired: number
  leaguePosition: number
  totalPoints: number
}
```

### 2.1.7 Team Member

```
TeamMember {
  id: UUID
  teamId: UUID
  displayName: string
  role: "MD" | "FD" | "SD" | "MPRD" | "OM"
  joinedAt: timestamp
  // No persistent account — session-scoped
}
```

### 2.1.8 Phase Result

```
PhaseResult {
  id: UUID
  sessionId: UUID
  teamId: UUID
  phase: number                      // 1–4
  matches: MatchResult[]
  wins: number
  draws: number
  losses: number
  pointsThisPhase: number
  cumulativePoints: number
  leaguePosition: number             // After this phase
  spectatorPct: number               // For next phase
  
  // Financial
  ticketRevenue: number
  fbRevenue: number
  tvRevenue: number
  totalRevenue: number
  salaryCost: number
  interestCost: number
  netCashFlow: number
  cumulativeCashFlow: number
  roe: number                        // Running ROE
}
```

### 2.1.9 Match Result

```
MatchResult {
  matchNumber: number
  opponentTeamId: UUID
  opponentClassification: string
  isHome: boolean
  result: "Win" | "Draw" | "Loss"
  pointsAwarded: number              // 3, 1, or 0
}
```

### 2.1.10 Game Event

```
GameEvent {
  id: UUID
  sessionId: UUID
  targetTeamId: UUID | null          // null = affects all teams
  phase: number
  templateId: string                 // Reference to EventTemplate
  triggeredAt: timestamp
  resolved: boolean
  
  // From template
  title: string
  description: string
  severity: "info" | "warning" | "critical"
  financialImpact: number | null     // +/- cash impact
  playerImpact: { playerId: number, effect: "injured" | "suspended" | "boosted" } | null
  attendanceImpact: number | null    // Multiplier on spectator % (e.g. 0.9 for -10%)
}
```

### 2.1.11 Qualitative Score

```
QualitativeScore {
  id: UUID
  sessionId: UUID
  teamId: UUID
  category: "shareholder_presentation" | "csr_pitch" | "media_announcement" | "general"
  phase: number
  score: number                      // 1–10
  notes: string                      // Facilitator's comments
  scoredBy: facilitatorId
  scoredAt: timestamp
}
```

### 2.1.12 Event Template (Library)

```
EventTemplate {
  id: string
  category: "injury" | "sponsorship" | "weather" | "media" | "financial" | "regulatory" | "community"
  title: string
  description: string                // Shown to team
  facilitatorNotes: string           // Guidance for facilitator only
  severity: "info" | "warning" | "critical"
  financialImpact: number | null
  playerImpact: { playerId: number | null, effect: string } | null
  attendanceImpact: number | null
  requiresResponse: boolean          // Does the team need to submit a decision?
  responseDeadlineMinutes: number | null
}
```

---

## 2.2 Functional Requirements

### FR-01: Facilitator Account Management

- Facilitators register and log in via Cognito (email/password)
- Facilitators can create, edit, and clone Game Configurations
- Facilitators can view history of past game sessions with results

**Acceptance Criteria:**
- A facilitator can register, log in, and see a dashboard of their configurations and sessions
- Game configurations can be created from scratch or cloned from an existing one
- Past sessions show final league tables, ROE rankings, and qualitative scores

### FR-02: Game Session Creation

- Facilitator selects a Game Configuration and creates a new session
- System generates a unique 6-character alphanumeric game code
- Facilitator specifies number of human teams (1–8); remaining slots filled by AI teams
- AI teams are auto-generated with random names, random valid squad selections, and random stadium choices

**Acceptance Criteria:**
- Game code is unique, case-insensitive, and easy to read aloud (no ambiguous characters: 0/O, 1/I/L)
- AI teams have valid squads (meeting all team constraints) with team indices spread across Poor/Average/Good
- Session appears on facilitator dashboard immediately

### FR-03: Team Joining & Role Selection

- Players navigate to the app and enter the game code
- They see available teams (with names, but no financial details)
- They select a team, enter their display name, and choose a role
- Each role can only be held by one member per team
- If team has fewer than 5 members, OM role is optional
- A team needs minimum 3 members to begin (MD, FD, SD are mandatory; MPRD and OM optional)

**Acceptance Criteria:**
- Taken roles are greyed out
- Display name is shown to facilitator and teammates
- Once a player joins, they cannot switch teams (can switch roles if facilitator resets)
- Facilitator sees join status for all teams in real-time

### FR-04: Setup Phase (Team Decisions)

Each team must complete setup decisions before the season begins. These decisions are role-gated:

| Decision | Permitted Roles | Visibility |
|----------|----------------|------------|
| Choose stadium | MD, FD | All |
| Choose F&B scheme | FD, OM | All |
| Select players | SD | SD + MD |
| Set equity request | FD, MD | FD + MD |
| Name the club | MD | All |

- All setup decisions require confirmation (no accidental submissions)
- Facilitator can see all teams' setup progress and can set a deadline timer
- Setup is locked when the facilitator advances to Phase 1

**Acceptance Criteria:**
- Only permitted roles can make each decision
- All team members see a setup checklist with completion status
- Team index, financial projections, and debt calculations update in real-time as decisions are made
- Facilitator dashboard shows setup completion percentage per team
- Validation rules enforced: min 12 players, max 20, 6+ batters, 5+ bowlers

### FR-05: Phase Progression (Facilitator-Controlled)

- Facilitator advances the game from Setup → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Completed
- When a phase is advanced, the engine simulates all matches for all teams in that phase
- Match outcomes are determined by the probability matrix using the teams' classifications
- League table is recalculated after each phase
- Spectator percentages are recalculated based on new league positions
- Financial results are computed for each team
- All results become visible to teams simultaneously

**Acceptance Criteria:**
- Facilitator sees a confirmation dialog before advancing ("This will simulate X matches for Y teams. Continue?")
- Match results use a seeded random number generator so results are reproducible if needed
- AI team results are also simulated using the same probability matrix
- Phase results cannot be reversed once advanced (facilitator can reset entire session if needed)

### FR-06: Financial Engine

The engine computes the following for each team per phase:

**Ticket Revenue** = spectators × ticketPrice × homeMatches
where spectators = capacity × spectatorPct(leaguePosition)

**TV Revenue** = spectators × ticketPrice × awayMatches
(per game rules: DTV pays the equivalent of home ticket revenue for away matches)

**F&B Revenue:**
- Fixed scheme: outlets × fixedFeePerMonth × monthsInPhase
- Revenue share scheme: spectators × fbSpectatorPct × fbAveragePrice × fbRevenuePct × homeMatches

**Salary Cost** = totalAnnualSalary × (matchesInPhase / totalMatchesInSeason)

**Interest Cost** = debtRequired × annualInterestRate × (matchesInPhase / totalMatchesInSeason)

**Net Cash Flow** = ticketRevenue + tvRevenue + fbRevenue - salaryCost - interestCost ± eventImpacts

**ROE** = cumulativeNetCashFlow / equityFinance

**Acceptance Criteria:**
- All calculations match the formulas in the game rules document exactly
- Financial results are broken down by revenue stream and cost category
- Cumulative figures maintained across phases
- Event financial impacts applied correctly

### FR-07: Match Simulation Engine

- Each match pits two teams (identified by their team classification) against each other
- Outcome is determined by rolling against the probability matrix
- Points awarded: Win = 3, Draw = 1, Loss = 0
- League table sorted by points (ties broken by: most wins, then alphabetical)
- Fixtures are generated so each team plays every other team twice (home and away) across 4 phases

**Acceptance Criteria:**
- 8 teams × 14 matches each = 56 total matches per season (each fixture appears twice: A vs B and B vs A)
- Fixture generation distributes matches across phases according to PhaseConfig
- Home/away split is balanced (7 home, 7 away per team across the season)
- Match results between two human teams are consistent (if A beats B, B's record shows a loss to A)

### FR-08: Event System

- Facilitator can trigger events from the pre-built event library
- Events can target a specific team or all teams
- Events are applied to the current or next phase
- Events with financial impact modify the net cash flow calculation
- Events with player impact mark players as injured/suspended (affecting team index)
- Events with attendance impact modify spectator percentage
- Events that require a team response show a notification with an optional timer

**Default Event Library (seed data):**

| Category | Title | Description | Financial Impact | Player Impact | Attendance Impact |
|----------|-------|-------------|-----------------|---------------|-------------------|
| Injury | Key Player Injury | A star player has suffered a season-ending injury | null | Highest-index player → injured | null |
| Injury | Minor Injury | A player will miss the next phase | null | Random player → injured (1 phase) | null |
| Sponsorship | Local Sponsor Deal | A local business offers a sponsorship package | +£50,000 | null | null |
| Sponsorship | Major Sponsor | A national brand wants to sponsor your team | +£200,000 | null | +5% attendance |
| Weather | Heavy Rain | Severe weather forecast reduces expected attendance | null | null | -15% attendance |
| Weather | Heatwave | Unprecedented heat boosts F&B sales but reduces attendance | +£20,000 F&B bonus | null | -10% attendance |
| Media | Press Conference Required | Breaking news requires an immediate media statement | null | null | null |
| Media | Negative Press | Unflattering article published about the club | null | null | -10% attendance |
| Financial | Cost Overrun | Unexpected stadium maintenance required | -£100,000 | null | null |
| Financial | Tax Rebate | Government tax incentive for sporting organisations | +£75,000 | null | null |
| Regulatory | Safety Inspection | Stadium safety inspection — pass or fail | -£50,000 (if fail) | null | -20% capacity (if fail) |
| Community | Community Award | Club recognised for community engagement | null | null | +10% attendance |

**Acceptance Criteria:**
- Events appear as notifications on the team dashboard
- Financial impacts are clearly shown in the phase P&L
- Player injuries reduce the team index (excluded from calculation until recovered/sold)
- Facilitator can see which events have been triggered and their status

### FR-09: Role-Based Dashboard Views

Each role sees a tailored view of the team's position:

**Managing Director (MD):**
- Full overview dashboard: KPIs, league position, phase results
- All financial summaries (read-only detail)
- Setup decisions: club name, stadium choice, equity
- Can break deadlocks on any team decision
- Sees event notifications and qualitative scores

**Finance Director (FD):**
- Detailed financial dashboard: revenue breakdown, costs, cash flow, ROE
- Phase-by-phase P&L comparison
- Setup decisions: stadium choice, F&B scheme, equity amount
- Debt schedule and interest tracker
- Season projection model

**Sporting Director (SD):**
- Squad management: player list, indices, costs, injuries
- Team index calculation breakdown
- Setup decisions: player selection
- Match results and opponent analysis
- Player trading interface (mid-season buy/sell)

**Marketing & PR Director (MPRD):**
- Event notifications (especially media-related)
- Qualitative assessment scores and feedback
- Spectator trends and attendance data
- CSR project status
- (Setup: no exclusive decisions, advisory role)

**Operations Manager (OM):**
- Stadium and F&B performance dashboard
- F&B revenue breakdown per outlet
- Setup decisions: F&B scheme
- Event notifications (especially operational: safety, weather)
- (No strategic decisions, support role)

**Acceptance Criteria:**
- Each role sees ONLY the views and actions listed above
- Shared data (league table, match results) visible to all roles
- Role label is visible in the UI header
- Facilitator can see any team's view by selecting team + role

### FR-10: Facilitator Dashboard

- **Session Overview**: all teams at a glance — setup progress, league table, financial summary
- **Phase Control**: advance phase button with confirmation, current phase indicator
- **Team Drill-down**: click any team to see their full dashboard (all roles)
- **Event Panel**: trigger events, view event history, see team responses
- **Scoring Panel**: log qualitative scores per team per category with notes
- **Timer**: optional countdown timer visible to all teams (for setup deadlines, presentation prep)
- **Multi-League**: switch between active sessions; each session runs independently

**Acceptance Criteria:**
- Facilitator can manage 3+ concurrent sessions
- Phase advancement affects only the selected session
- Team financial data is compared side-by-side (sortable by any metric)
- Qualitative scores contribute to a final composite score alongside ROE

### FR-11: Player Trading (Mid-Season)

- Between phases, the SD can sell players and buy from the available pool
- Sell price determined by league position (per resale rules)
- Injured players sell at 25% regardless of position
- Team constraints must remain valid after any trade
- Facilitator must approve all trades before they take effect

**Acceptance Criteria:**
- SD sees available players (those not owned by any team in the session) with costs
- Sell interface shows current resale value based on league position
- Team index recalculates in real-time as trades are proposed
- Trade proposals appear on facilitator dashboard for approval
- Salary costs update immediately upon trade completion

### FR-12: End-of-Season Summary

- Final league table with champion highlighted
- ROE leaderboard
- Composite score (weighted: ROE + qualitative scores)
- Per-team summary: all 4 phase results, total P&L, key decisions made
- Facilitator can export results as PDF

**Acceptance Criteria:**
- Summary accessible to all team members and facilitator
- PDF export includes league table, financial summary per team, and qualitative scores
- Session is archived and viewable from facilitator's history

---

## 2.3 Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Response time** | Dashboard updates within 2 seconds of phase advancement |
| **Concurrency** | Support 3 concurrent sessions × 8 teams × 5 members = 120 simultaneous users |
| **Availability** | 99.5% during business hours (this is a facilitated event tool, not 24/7) |
| **Data retention** | Session data retained for 12 months, then archived |
| **Browser support** | Chrome, Safari, Edge (latest 2 versions) |
| **Responsive** | Functional on tablets (team members may use iPads in a workshop) |
| **Accessibility** | WCAG 2.1 AA for colour contrast and keyboard navigation |

---

# 3. DESIGN (technical architecture)

## 3.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite | Consistent with existing Callater stack |
| Styling | Tailwind CSS | Rapid UI development, responsive utilities |
| State | React Query (TanStack Query) | Server state management, polling for semi-real-time |
| Hosting | AWS Amplify | Static frontend hosting with CI/CD |
| API | Node.js + Express on AWS Fargate | Containerised API, auto-scaling |
| Database | PostgreSQL on AWS RDS | Relational data with complex joins (league tables, financial rollups) |
| Auth | AWS Cognito | Facilitator accounts; custom JWT claims for session/role |
| File Storage | S3 | PDF exports, game configuration templates |

## 3.2 Authentication Flow

```
Facilitator:
  Register → Cognito User Pool → email verification → login → JWT
  
Team Member:
  Enter game code → API validates code → returns sessionId + available teams
  Select team + role + display name → API creates TeamMember record
  → API returns a session-scoped JWT with claims: { sessionId, teamId, memberId, role }
  → JWT expires when session status = "completed"
```

The team member JWT is lightweight — no Cognito user is created. The API issues the token directly using a shared signing key. This keeps the join flow frictionless (no email required).

## 3.3 Database Schema (PostgreSQL)

```sql
-- Facilitator accounts managed by Cognito; this table stores app-level data
CREATE TABLE facilitators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub VARCHAR(128) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID REFERENCES facilitators(id),
  name VARCHAR(200) NOT NULL,
  config JSONB NOT NULL,               -- Full GameConfig object
  is_template BOOLEAN DEFAULT FALSE,   -- Seed configs marked as templates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES game_configs(id),
  facilitator_id UUID REFERENCES facilitators(id),
  game_code VARCHAR(6) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'setup',
  human_team_count INTEGER NOT NULL CHECK (human_team_count BETWEEN 1 AND 8),
  current_phase INTEGER NOT NULL DEFAULT 0,
  random_seed BIGINT,                  -- For reproducible match simulation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_ai BOOLEAN NOT NULL DEFAULT FALSE,
  stadium_choice VARCHAR(50),
  fb_scheme VARCHAR(20),
  selected_player_ids JSONB DEFAULT '[]',
  equity_finance NUMERIC(15,2) DEFAULT 10000000,
  setup_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('MD','FD','SD','MPRD','OM')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, role)               -- One role per team
);

CREATE TABLE phase_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 4),
  matches JSONB NOT NULL,              -- Array of MatchResult
  wins INTEGER NOT NULL,
  draws INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  points INTEGER NOT NULL,
  cumulative_points INTEGER NOT NULL,
  league_position INTEGER NOT NULL,
  spectator_pct NUMERIC(5,4),
  ticket_revenue NUMERIC(15,2),
  fb_revenue NUMERIC(15,2),
  tv_revenue NUMERIC(15,2),
  total_revenue NUMERIC(15,2),
  salary_cost NUMERIC(15,2),
  interest_cost NUMERIC(15,2),
  event_impact NUMERIC(15,2) DEFAULT 0,
  net_cash_flow NUMERIC(15,2),
  cumulative_cash_flow NUMERIC(15,2),
  roe NUMERIC(8,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, team_id, phase)
);

CREATE TABLE game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  target_team_id UUID REFERENCES teams(id),  -- NULL = all teams
  template_id VARCHAR(50) NOT NULL,
  phase INTEGER NOT NULL,
  title VARCHAR(200),
  description TEXT,
  severity VARCHAR(20),
  financial_impact NUMERIC(15,2),
  player_impact JSONB,
  attendance_impact NUMERIC(5,4),
  requires_response BOOLEAN DEFAULT FALSE,
  response_deadline TIMESTAMPTZ,
  team_response TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE qualitative_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  phase INTEGER,
  score INTEGER CHECK (score BETWEEN 1 AND 10),
  notes TEXT,
  scored_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_code ON game_sessions(game_code);
CREATE INDEX idx_teams_session ON teams(session_id);
CREATE INDEX idx_members_team ON team_members(team_id);
CREATE INDEX idx_results_session_phase ON phase_results(session_id, phase);
CREATE INDEX idx_events_session ON game_events(session_id);
```

## 3.4 API Design

### Auth Endpoints

```
POST /api/auth/register          — Facilitator registration (Cognito)
POST /api/auth/login             — Facilitator login (Cognito)
POST /api/auth/join              — Team member join (game code + team + role → session JWT)
```

### Game Config Endpoints (Facilitator only)

```
GET    /api/configs              — List facilitator's configurations
POST   /api/configs              — Create new configuration
GET    /api/configs/:id          — Get configuration detail
PUT    /api/configs/:id          — Update configuration
POST   /api/configs/:id/clone    — Clone configuration
DELETE /api/configs/:id          — Delete configuration
```

### Session Endpoints

```
POST   /api/sessions                       — Create session from config
GET    /api/sessions                       — List facilitator's sessions
GET    /api/sessions/:id                   — Get session detail (facilitator: all data; member: team data)
POST   /api/sessions/:id/advance-phase     — Advance to next phase (triggers simulation)
POST   /api/sessions/:id/reset             — Reset session to setup
GET    /api/sessions/:id/league-table      — Current league standings
GET    /api/sessions/:id/export            — Generate PDF summary
```

### Team Endpoints

```
GET    /api/sessions/:id/teams             — List teams (filtered by role permissions)
PUT    /api/teams/:teamId/setup            — Update team setup decisions (role-gated)
GET    /api/teams/:teamId/dashboard        — Team dashboard data (role-filtered)
GET    /api/teams/:teamId/financials       — Detailed financials (FD, MD only)
GET    /api/teams/:teamId/squad            — Squad details (SD, MD only)
POST   /api/teams/:teamId/trade            — Propose player trade (SD only)
```

### Event Endpoints (Facilitator only)

```
GET    /api/sessions/:id/event-library     — Available event templates
POST   /api/sessions/:id/events            — Trigger event
GET    /api/sessions/:id/events            — List triggered events
PUT    /api/events/:eventId/resolve        — Mark event as resolved
```

### Scoring Endpoints (Facilitator only)

```
POST   /api/sessions/:id/scores           — Log qualitative score
GET    /api/sessions/:id/scores            — Get all scores for session
PUT    /api/scores/:scoreId                — Update score
```

### Join Flow Endpoint (Unauthenticated)

```
GET    /api/join/:gameCode                 — Validate game code, return session info + available teams/roles
```

## 3.5 Polling Strategy (Semi-Real-Time)

Rather than WebSockets, use React Query's polling:

| View | Poll Interval | What's Polled |
|------|--------------|---------------|
| Team Dashboard | 5 seconds | Phase results, events, scores |
| Facilitator Dashboard | 3 seconds | All teams' status, join activity |
| Join/Lobby | 2 seconds | Team membership, available roles |
| Setup Phase | 10 seconds | Other teams' readiness (facilitator view) |

This avoids WebSocket infrastructure complexity while keeping the experience feeling responsive. Phase advancement triggers an immediate refetch via query invalidation.

## 3.6 Frontend Route Structure

```
/                                   — Landing page / facilitator login
/facilitator/dashboard              — Facilitator session list
/facilitator/configs                — Game configuration management
/facilitator/session/:id            — Session control panel
/join                               — Enter game code
/join/:gameCode                     — Team/role selection
/team/dashboard                     — Team member dashboard (role-filtered)
/team/setup                         — Setup phase decisions
/team/squad                         — Squad management (SD)
/team/financials                    — Financial detail (FD)
/team/events                        — Event notifications
/results/:sessionId                 — End-of-season summary (public link)
```

## 3.7 Infrastructure

```
┌─────────────────────────────────────────────────┐
│                  AWS Amplify                      │
│           (React SPA + CloudFront)                │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
          ┌──────────▼──────────┐
          │   API Gateway / ALB  │
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
          │   Fargate Service    │
          │  (Node.js + Express) │
          │   Auto-scaling       │
          │   Min: 1, Max: 4     │
          └──────────┬──────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌────▼────┐  ┌───▼────┐
   │ RDS     │  │ Cognito │  │ S3     │
   │ Postgres│  │ User    │  │ Exports│
   │ t3.micro│  │ Pool    │  │        │
   └─────────┘  └─────────┘  └────────┘
```

---

# 4. TASKS (implementation plan)

## Phase A: Foundation (Sprint 1)

```
A1. Project scaffolding
    - Initialise monorepo: /client (React+Vite+TS), /server (Node+Express+TS), /shared (types)
    - Configure Tailwind, React Query, React Router
    - Set up ESLint, Prettier, TypeScript strict mode
    - Create shared type definitions from domain model (Section 2.1)
    
A2. Database setup
    - Create RDS PostgreSQL instance (or local Docker for dev)
    - Implement schema from Section 3.3
    - Create migration scripts (use node-pg-migrate or similar)
    - Seed default game configuration (Deeland Cricket League rules from game documents)
    - Seed event library (12 events from FR-08 table)

A3. Auth implementation
    - Configure Cognito User Pool for facilitators
    - Implement facilitator register/login endpoints
    - Implement game code join flow with session-scoped JWT
    - Create auth middleware: facilitator guard, team member guard, role guard
    - Role guard must validate: { sessionId, teamId, role } against requested resource

A4. API foundation
    - Express server with error handling, logging, request validation
    - Database connection pool (pg library)
    - CORS configuration for Amplify frontend
    - Health check endpoint
    - Environment configuration (dev/staging/prod)
```

## Phase B: Game Engine (Sprint 2)

```
B1. Game Configuration CRUD
    - Implement config endpoints (create, read, update, clone, delete)
    - Validate config structure (all required fields, probability matrix sums to 1.0)
    - Seed the default Deeland Cricket League configuration as a template

B2. Session management
    - Create session endpoint (generates game code, creates AI teams)
    - AI team generation: random valid squads, spread of team indices
    - Game code generation: 6 chars, no ambiguous chars (exclude 0OIL1)
    - Session status state machine: setup → phase1 → phase2 → phase3 → phase4 → completed

B3. Financial engine
    - Implement all calculations from FR-06 as pure functions
    - Unit test every formula against hand-calculated examples from game documents
    - Team index calculation: totalPlayerIndex / 14
    - Classification thresholds: >1.1 Good, 0.9–1.1 Average, <0.9 Poor
    - Spectator % lookup by league position
    - Debt calculation: max(0, totalOutlay - equity)
    - F&B revenue for both schemes
    - TV revenue calculation (DTV rules)

B4. Match simulation engine
    - Fixture generator: 8 teams, 14 matches each, balanced home/away across 4 phases
    - Match outcome resolver: probability matrix lookup → random roll → result
    - Support seeded RNG for reproducibility
    - League table calculator: sort by points, then wins, then alphabetical
    - Phase simulation orchestrator: run all matches, compute financials, update league positions

B5. Phase advancement
    - Advance phase endpoint: validate all teams setup complete, run simulation
    - Store phase results for all teams
    - Recalculate spectator percentages for next phase
    - Return complete results payload
```

## Phase C: Team Experience (Sprint 3)

```
C1. Join flow UI
    - Landing page with game code input
    - Team selection screen (show team names, available roles)
    - Role selection with real-time availability (poll for updates)
    - Lobby/waiting screen after joining

C2. Setup phase UI
    - Setup wizard: club name → stadium → F&B → squad → financing
    - Stadium selection cards with financial projections
    - F&B scheme comparison with estimated revenue
    - Player selection grid with eligibility validation
    - Equity slider with debt/interest calculator
    - Real-time team index and season projection
    - Setup completion checklist

C3. Role-based dashboard
    - Dashboard shell with role-specific navigation
    - MD overview: KPIs, league position, phase summary
    - FD financial view: P&L breakdown, cash flow chart, ROE tracker
    - SD squad view: player list, team index, injury status
    - MPRD view: events, scores, spectator trends
    - OM view: stadium stats, F&B performance
    - Shared components: league table, match results, event notifications

C4. Polling integration
    - React Query setup with polling intervals per view
    - Optimistic updates for setup decisions
    - Query invalidation on phase advancement
    - Loading/skeleton states
```

## Phase D: Facilitator Experience (Sprint 4)

```
D1. Facilitator dashboard
    - Session list with status indicators
    - Create session flow: select config → set human team count → generate
    - Session overview: all teams at a glance, setup progress bars
    - Multi-session switcher

D2. Phase control panel
    - Phase advancement button with confirmation dialog
    - Phase results summary (all teams compared)
    - League table with financial overlay
    - Side-by-side team comparison (sortable by any metric)

D3. Event system UI
    - Event library browser (filterable by category)
    - Trigger event: select target team (or all), confirm
    - Event history timeline
    - Team response viewer

D4. Qualitative scoring
    - Score entry form: team selector, category, 1–10 scale, notes
    - Score history per team
    - Composite score calculator (ROE weight + qualitative weight, configurable)

D5. Game configuration editor
    - Stadium editor (add/edit/remove stadium options)
    - Player roster editor (add/edit/remove players, validate indices)
    - Probability matrix editor (with sum-to-1.0 validation)
    - Phase structure editor
    - F&B parameter editor
    - Event library editor (add custom events to a config)
    - Preview mode: see how config looks from team perspective
```

## Phase E: Polish & Deploy (Sprint 5)

```
E1. Player trading
    - SD trade interface: browse available players, propose buy/sell
    - Resale value calculator based on league position
    - Facilitator trade approval queue
    - Post-trade team index recalculation

E2. End-of-season
    - Summary view: league champion, ROE leaderboard, composite scores
    - Per-team detail cards
    - PDF export generation (use puppeteer or react-pdf)
    - Session archival

E3. Deployment
    - Amplify hosting configuration
    - Fargate task definition and service
    - RDS instance provisioning
    - Cognito User Pool configuration
    - Environment variables and secrets management
    - CI/CD pipeline (Amplify auto-deploy from Git)

E4. Testing & hardening
    - API integration tests for all endpoints
    - Financial engine unit tests (critical path)
    - Match simulation tests (verify probability distribution over N runs)
    - Role-based access control tests
    - Load testing: 120 concurrent users
    - Error handling: graceful degradation if API is slow
```

---

# 5. SEED DATA

## 5.1 Default Game Configuration: Deeland Cricket League

The default configuration should be seeded exactly as described in the BBG Instructions document:

- **3 stadiums**: Small (£20M/20K/£35), Medium (£30M/30K/£30), Large (£40M/40K/£25)
- **20 players**: 9 Batsmen, 4 All-Rounders, 7 Bowlers (costs £500K–£1.3M, indices 0.75–1.55)
- **4 phases**: 4-3-4-3 matches, 14 total per team
- **Probability matrix**: 9 entries (Poor/Average/Good vs Poor/Average/Good)
- **F&B schemes**: Fixed (£2K/£3K/£4K per outlet/month) or Revenue (30%)
- **Financing**: £10M base equity, 5% annual interest on debt, 2-year term
- **Spectator rules**: Pos 1–2 = 100%, 3–6 = 80%, 7–8 = 60% (start at 80%)
- **Resale rules**: Pos 1–2 = 110%, 3–6 = 80%, 7–8 = 60%, injured = 25%
- **Team constraints**: Min 12, Max 20 players, 6+ batters, 5+ bowlers

## 5.2 Default Event Library

Seed the 12 events from the FR-08 table above.

## 5.3 AI Team Names

Seed pool: Ashford Lions, Blackmoor Hawks, Crossfield Stags, Dunbury Wolves, Eastwick Falcons, Ferndale Bears, Glenmore Vipers, Hartfield Otters, Ironbridge Kestrels, Juniper Foxes.

---

# 6. CONSTRAINTS & CONVENTIONS

- All monetary values stored as NUMERIC(15,2) in the database, computed in pence/cents to avoid floating point
- All timestamps in UTC
- API responses use camelCase; database columns use snake_case
- Error responses follow format: `{ error: string, code: string, details?: any }`
- Game codes are uppercase alphanumeric, excluding 0, O, I, L, 1 (use: ABCDEFGHJKMNPQRSTUVWXYZ23456789)
- All random operations use a seeded PRNG (seed stored on session) so match results are reproducible
- Role-based access is enforced at the API level, not just the UI
