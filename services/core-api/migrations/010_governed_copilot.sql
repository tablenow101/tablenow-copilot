-- Additive foundations. No existing restaurant/profile or design memory is rewritten.
CREATE SCHEMA IF NOT EXISTS business_knowledge;
REVOKE ALL ON SCHEMA business_knowledge FROM PUBLIC;
CREATE TABLE business_knowledge.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL CHECK (topic IN ('reservations','operations','analysis','communication')),
  source_uri text NOT NULL,
  source_date date NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  status text NOT NULL CHECK (status IN ('candidate','evaluated','approved','retired')),
  evaluation text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  supersedes uuid REFERENCES business_knowledge.records(id),
  CHECK (status != 'approved' OR (evaluation IS NOT NULL AND length(evaluation) > 0)),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  UNIQUE (source_uri, version)
);
ALTER TABLE business_knowledge.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_knowledge.records FORCE ROW LEVEL SECURITY;
CREATE POLICY approved_knowledge ON business_knowledge.records FOR SELECT
  USING (status = 'approved' AND valid_from <= now() AND (valid_until IS NULL OR valid_until > now()));

CREATE TABLE copilot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_key uuid NOT NULL,
  input_hash text NOT NULL,
  message text NOT NULL CHECK (length(message) BETWEEN 2 AND 4000),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 3),
  lease_until timestamptz NOT NULL DEFAULT (now() + interval '45 seconds'),
  report jsonb,
  answer text,
  mode text CHECK (mode IN ('ai','summary')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, restaurant_id, user_id, request_key),
  UNIQUE (tenant_id, restaurant_id, user_id, id),
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE copilot_contexts (
  run_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  FOREIGN KEY (tenant_id, restaurant_id, user_id, run_id) REFERENCES copilot_runs(tenant_id,restaurant_id,user_id,id) ON DELETE CASCADE
);
CREATE TABLE copilot_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  run_id uuid NOT NULL,
  request_key uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('decision','outcome')),
  body text NOT NULL CHECK (length(body) BETWEEN 2 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, restaurant_id, user_id, request_key),
  FOREIGN KEY (tenant_id, restaurant_id, user_id, run_id) REFERENCES copilot_runs(tenant_id,restaurant_id,user_id,id) ON DELETE CASCADE
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['copilot_runs','copilot_contexts','copilot_observations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY governed_scope ON %I USING (tenant_id=app_current_tenant() AND restaurant_id=nullif(current_setting(''app.restaurant_id'',true),'''')::uuid AND user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid) WITH CHECK (tenant_id=app_current_tenant() AND restaurant_id=nullif(current_setting(''app.restaurant_id'',true),'''')::uuid AND user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid)',t);
  END LOOP;
END $$;
CREATE INDEX copilot_runs_history ON copilot_runs(tenant_id,restaurant_id,user_id,created_at DESC);
ALTER TABLE copilot_messages ADD COLUMN run_id uuid REFERENCES copilot_runs(id);
CREATE UNIQUE INDEX copilot_messages_run_role ON copilot_messages(run_id,role) WHERE run_id IS NOT NULL;

-- Model context retrieval cannot read account credentials, private design memory,
-- arbitrary documents, or write operating data, even with a faulty SELECT.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tablenow_context_reader') THEN
    CREATE ROLE tablenow_context_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT tablenow_context_reader TO CURRENT_USER;
GRANT USAGE ON SCHEMA public,business_knowledge TO tablenow_context_reader;
GRANT SELECT ON business_knowledge.records TO tablenow_context_reader;
GRANT SELECT ON dining_tables,restaurants,reservations,decisions,operational_tasks,team_shifts,onboarding_first_results,copilot_messages,onboarding_drafts TO tablenow_context_reader;
CREATE POLICY context_restaurant ON restaurants AS RESTRICTIVE TO tablenow_context_reader
 USING (id=nullif(current_setting('app.restaurant_id',true),'')::uuid);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['dining_tables','reservations','decisions','operational_tasks','team_shifts','onboarding_first_results','onboarding_drafts','copilot_messages'] LOOP
    EXECUTE format('CREATE POLICY context_restaurant ON %I AS RESTRICTIVE TO tablenow_context_reader USING (restaurant_id=nullif(current_setting(''app.restaurant_id'',true),'''')::uuid)',t);
  END LOOP;
END $$;
CREATE POLICY context_user ON copilot_messages AS RESTRICTIVE TO tablenow_context_reader
 USING (user_id=nullif(current_setting('app.user_id',true),'')::uuid);
