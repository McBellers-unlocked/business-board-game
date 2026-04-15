-- =========================================================================
-- Deeland Cricket League — Initial Schema
-- Mirrors Section 3.3 of DCL_SDD_Specification.md with production extensions.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- Facilitators (Cognito-backed in prod; password_hash used in dev mode)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facilitators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub VARCHAR(128) UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  password_hash VARCHAR(255),               -- Null when Cognito-backed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- Game configurations
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID REFERENCES facilitators(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  config JSONB NOT NULL,
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_configs_facilitator ON game_configs(facilitator_id);

-- -------------------------------------------------------------------------
-- Game sessions (leagues)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES game_configs(id),
  facilitator_id UUID NOT NULL REFERENCES facilitators(id) ON DELETE CASCADE,
  game_code VARCHAR(6) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'setup'
    CHECK (status IN ('setup','phase1','phase2','phase3','phase4','completed')),
  human_team_count INTEGER NOT NULL CHECK (human_team_count BETWEEN 1 AND 8),
  current_phase INTEGER NOT NULL DEFAULT 0 CHECK (current_phase BETWEEN 0 AND 4),
  random_seed BIGINT NOT NULL,
  fixture_list JSONB,                       -- Generated at session creation
  composite_weights JSONB,                  -- Clone of config.compositeScoreWeights at session creation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON game_sessions(game_code);
CREATE INDEX IF NOT EXISTS idx_sessions_facilitator ON game_sessions(facilitator_id);

-- -------------------------------------------------------------------------
-- Teams (human + AI)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_ai BOOLEAN NOT NULL DEFAULT FALSE,
  slot_index INTEGER NOT NULL,              -- 0..7 position in session
  stadium_choice VARCHAR(50),
  fb_scheme VARCHAR(20) CHECK (fb_scheme IN ('fixed','revenue')),
  selected_player_ids JSONB NOT NULL DEFAULT '[]',
  injured_player_ids JSONB NOT NULL DEFAULT '[]',
  suspended_player_ids JSONB NOT NULL DEFAULT '[]',
  equity_finance NUMERIC(15,2) NOT NULL DEFAULT 10000000,
  setup_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, slot_index)
);
CREATE INDEX IF NOT EXISTS idx_teams_session ON teams(session_id);

-- -------------------------------------------------------------------------
-- Team members (session-scoped, no persistent auth)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('MD','FD','SD','MPRD','OM')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, role)
);
CREATE INDEX IF NOT EXISTS idx_members_team ON team_members(team_id);

-- -------------------------------------------------------------------------
-- Phase results (financial + match summary per team per phase)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phase_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 4),
  matches JSONB NOT NULL,
  wins INTEGER NOT NULL,
  draws INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  points INTEGER NOT NULL,
  cumulative_points INTEGER NOT NULL,
  league_position INTEGER NOT NULL,
  spectator_pct NUMERIC(5,4) NOT NULL,
  ticket_revenue NUMERIC(15,2) NOT NULL,
  fb_revenue NUMERIC(15,2) NOT NULL,
  tv_revenue NUMERIC(15,2) NOT NULL,
  total_revenue NUMERIC(15,2) NOT NULL,
  salary_cost NUMERIC(15,2) NOT NULL,
  interest_cost NUMERIC(15,2) NOT NULL,
  event_impact NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_cash_flow NUMERIC(15,2) NOT NULL,
  cumulative_cash_flow NUMERIC(15,2) NOT NULL,
  roe NUMERIC(10,6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, team_id, phase)
);
CREATE INDEX IF NOT EXISTS idx_results_session_phase ON phase_results(session_id, phase);
CREATE INDEX IF NOT EXISTS idx_results_team ON phase_results(team_id);

-- -------------------------------------------------------------------------
-- Game events
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  target_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  template_id VARCHAR(64) NOT NULL,
  phase INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info','warning','critical')),
  financial_impact NUMERIC(15,2),
  player_impact JSONB,
  attendance_impact NUMERIC(5,4),
  requires_response BOOLEAN NOT NULL DEFAULT FALSE,
  response_deadline TIMESTAMPTZ,
  team_response TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_session ON game_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_session_phase ON game_events(session_id, phase);

-- -------------------------------------------------------------------------
-- Qualitative scores
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qualitative_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  phase INTEGER,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  notes TEXT,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scores_session_team ON qualitative_scores(session_id, team_id);

-- -------------------------------------------------------------------------
-- Mid-season player trade proposals
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  proposed_phase INTEGER NOT NULL,
  sell_player_ids JSONB NOT NULL DEFAULT '[]',
  buy_player_ids JSONB NOT NULL DEFAULT '[]',
  projected_cash_delta NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  facilitator_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_trades_session ON trade_proposals(session_id);

-- -------------------------------------------------------------------------
-- Schema version tracking
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(32) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
