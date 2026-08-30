ALTER TABLE node_credentials
  ADD COLUMN IF NOT EXISTS version text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS browser_version text,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'offline'
    CHECK (health_status IN ('healthy', 'degraded', 'offline')),
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS operating_setup jsonb NOT NULL DEFAULT
    '{"reservationMode":"tablenow","providers":[],"keepPaperWorkflow":false}'::jsonb;

CREATE TABLE restaurant_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('reservations', 'calendar', 'pos', 'communications', 'inventory', 'suppliers', 'accounting', 'manual')),
  provider text NOT NULL,
  display_name text NOT NULL,
  access_method text NOT NULL CHECK (access_method IN ('native', 'api', 'mcp', 'calendar', 'browser', 'desktop', 'manual')),
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'ready', 'limited', 'offline', 'paused')),
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_source_of_truth boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, restaurant_id, category, provider, display_name)
);
CREATE INDEX restaurant_systems_routing ON restaurant_systems (tenant_id, restaurant_id, category, status, priority);

CREATE TABLE action_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  capability text NOT NULL,
  primary_system_id uuid NOT NULL REFERENCES restaurant_systems(id) ON DELETE CASCADE,
  fallback_system_id uuid REFERENCES restaurant_systems(id) ON DELETE SET NULL,
  execution_mode text NOT NULL DEFAULT 'approval' CHECK (execution_mode IN ('automatic', 'approval', 'manual')),
  maximum_risk text NOT NULL DEFAULT 'medium' CHECK (maximum_risk IN ('low', 'medium', 'high')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, restaurant_id, capability)
);
CREATE INDEX action_routes_capability ON action_routes (tenant_id, restaurant_id, capability) WHERE active;

CREATE TABLE computer_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES restaurant_systems(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('zenchef', 'sevenrooms', 'thefork', 'generic', 'tablenow-simulator')),
  display_name text NOT NULL,
  surface text NOT NULL DEFAULT 'browser' CHECK (surface IN ('browser', 'desktop')),
  base_url text NOT NULL,
  allowed_hosts text[] NOT NULL,
  mode text NOT NULL DEFAULT 'assist' CHECK (mode IN ('observe', 'assist', 'autonomous', 'paused')),
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'ready', 'degraded', 'offline', 'paused')),
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  credential_ref text NOT NULL,
  health_message text,
  last_verified_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(allowed_hosts) BETWEEN 1 AND 20),
  UNIQUE (tenant_id, restaurant_id, display_name)
);
CREATE INDEX computer_connections_tenant_status ON computer_connections (tenant_id, status, updated_at DESC);

CREATE TABLE computer_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES computer_connections(id) ON DELETE CASCADE,
  workflow_key text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  name text NOT NULL,
  description text NOT NULL,
  risk text NOT NULL CHECK (risk IN ('low', 'medium', 'high', 'critical')),
  approval_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'retired')),
  definition jsonb NOT NULL,
  success_count integer NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, workflow_key, version)
);
CREATE INDEX computer_workflows_connection ON computer_workflows (tenant_id, connection_id, status);

CREATE TABLE computer_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES computer_connections(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES computer_workflows(id) ON DELETE RESTRICT,
  agent_action_id uuid REFERENCES agent_actions(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_by uuid REFERENCES node_credentials(id) ON DELETE SET NULL,
  objective text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk text NOT NULL CHECK (risk IN ('low', 'medium', 'high', 'critical')),
  approval_required boolean NOT NULL DEFAULT true,
  approval_note text,
  status text NOT NULL CHECK (status IN ('awaiting_approval', 'queued', 'claimed', 'running', 'succeeded', 'failed', 'blocked', 'cancelled')),
  idempotency_key text NOT NULL,
  claim_token_hash text,
  lease_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  error_code text,
  cancellation_requested_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX computer_runs_queue ON computer_runs (tenant_id, status, created_at) WHERE status IN ('queued', 'claimed', 'running');
CREATE INDEX computer_runs_recent ON computer_runs (tenant_id, created_at DESC);

CREATE TABLE computer_run_events (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES computer_runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence > 0),
  kind text NOT NULL CHECK (kind IN ('run_started', 'step_started', 'step_completed', 'navigation', 'verification', 'evidence', 'security_block', 'warning')),
  status text NOT NULL DEFAULT 'info' CHECK (status IN ('info', 'succeeded', 'failed', 'blocked')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_key text,
  evidence_sha256 text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, sequence)
);
CREATE INDEX computer_run_events_timeline ON computer_run_events (tenant_id, run_id, sequence);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'restaurant_systems', 'action_routes', 'computer_connections', 'computer_workflows', 'computer_runs', 'computer_run_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_current_tenant() OR app_platform_access()) WITH CHECK (tenant_id = app_current_tenant() OR app_platform_access())',
      table_name
    );
  END LOOP;
END $$;

CREATE TRIGGER computer_connections_updated_at BEFORE UPDATE ON computer_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER computer_workflows_updated_at BEFORE UPDATE ON computer_workflows FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER computer_runs_updated_at BEFORE UPDATE ON computer_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER restaurant_systems_updated_at BEFORE UPDATE ON restaurant_systems FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER action_routes_updated_at BEFORE UPDATE ON action_routes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
