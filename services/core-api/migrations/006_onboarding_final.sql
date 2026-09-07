DO $$
DECLARE
  primary_key_name text;
BEGIN
  IF to_regclass('public.onboarding_drafts') IS NULL THEN
    CREATE TABLE onboarding_drafts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
      revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_authority', 'completed')),
      current_section text NOT NULL DEFAULT 'establishment' CHECK (current_section IN (
        'establishment', 'priorities', 'interaction', 'reservations', 'operations', 'authority', 'final_note', 'review'
      )),
      confirmed_sections text[] NOT NULL DEFAULT '{}'::text[] CHECK (
        confirmed_sections <@ ARRAY['establishment', 'priorities', 'interaction', 'reservations', 'operations', 'authority', 'final_note']::text[]
      ),
      answers jsonb NOT NULL DEFAULT '{}'::jsonb,
      provenance jsonb NOT NULL DEFAULT '[]'::jsonb,
      first_result_id uuid,
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, restaurant_id)
    );
  ELSE
    -- Migration 005_onboarding_journey used one draft per tenant. Preserve it while
    -- promoting the table to the final per-restaurant contract.
    ALTER TABLE onboarding_drafts
      ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_authority', 'completed')),
      ADD COLUMN IF NOT EXISTS current_section text NOT NULL DEFAULT 'establishment' CHECK (current_section IN (
        'establishment', 'priorities', 'interaction', 'reservations', 'operations', 'authority', 'final_note', 'review'
      )),
      ADD COLUMN IF NOT EXISTS confirmed_sections text[] NOT NULL DEFAULT '{}'::text[] CHECK (
        confirmed_sections <@ ARRAY['establishment', 'priorities', 'interaction', 'reservations', 'operations', 'authority', 'final_note']::text[]
      ),
      ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS first_result_id uuid,
      ADD COLUMN IF NOT EXISTS completed_at timestamptz,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

    UPDATE onboarding_drafts draft
    SET restaurant_id = (
      SELECT restaurant.id
      FROM restaurants restaurant
      WHERE restaurant.tenant_id = draft.tenant_id
      ORDER BY restaurant.created_at, restaurant.id
      LIMIT 1
    )
    WHERE draft.restaurant_id IS NULL;

    ALTER TABLE onboarding_drafts
      ALTER COLUMN id SET NOT NULL,
      ALTER COLUMN step DROP NOT NULL,
      ALTER COLUMN data DROP NOT NULL;

    SELECT constraint_name.conname INTO primary_key_name
    FROM pg_constraint constraint_name
    WHERE constraint_name.conrelid = 'onboarding_drafts'::regclass
      AND constraint_name.contype = 'p';
    IF primary_key_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE onboarding_drafts DROP CONSTRAINT %I', primary_key_name);
    END IF;
    ALTER TABLE onboarding_drafts ADD CONSTRAINT onboarding_drafts_pkey PRIMARY KEY (id);
    ALTER TABLE onboarding_drafts
      ADD CONSTRAINT onboarding_drafts_tenant_restaurant_unique UNIQUE (tenant_id, restaurant_id);

    IF NOT EXISTS (SELECT 1 FROM onboarding_drafts WHERE restaurant_id IS NULL) THEN
      ALTER TABLE onboarding_drafts ALTER COLUMN restaurant_id SET NOT NULL;
    END IF;
  END IF;
END $$;
CREATE INDEX onboarding_drafts_progress ON onboarding_drafts (tenant_id, status, updated_at DESC);

CREATE TABLE onboarding_first_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  profile_revision integer NOT NULL CHECK (profile_revision > 0),
  kind text NOT NULL CHECK (kind IN (
    'supplier_order', 'customer_communication', 'reservations', 'team', 'service',
    'profitability', 'occupancy', 'customer_loyalty', 'global'
  )),
  status text NOT NULL CHECK (status IN ('draft', 'needs_information', 'ready_for_review')),
  title text NOT NULL,
  confirmed_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  unknown_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_field_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_artifact jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, restaurant_id, profile_revision)
);
CREATE INDEX onboarding_first_results_latest ON onboarding_first_results (tenant_id, restaurant_id, created_at DESC);
CREATE UNIQUE INDEX onboarding_first_results_tenant_restaurant_identity
  ON onboarding_first_results (tenant_id, restaurant_id, id);

CREATE TABLE onboarding_completion_keys (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 12 AND 120),
  draft_revision integer NOT NULL CHECK (draft_revision > 0),
  first_result_id uuid NOT NULL REFERENCES onboarding_first_results(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, restaurant_id, idempotency_key)
);

ALTER TABLE onboarding_drafts
  ADD CONSTRAINT onboarding_drafts_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT onboarding_drafts_result_integrity
  FOREIGN KEY (tenant_id, restaurant_id, first_result_id)
    REFERENCES onboarding_first_results (tenant_id, restaurant_id, id);

ALTER TABLE onboarding_first_results
  ADD CONSTRAINT onboarding_first_results_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;

ALTER TABLE onboarding_completion_keys
  ADD CONSTRAINT onboarding_completion_keys_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT onboarding_completion_keys_result_integrity
  FOREIGN KEY (tenant_id, restaurant_id, first_result_id)
    REFERENCES onboarding_first_results (tenant_id, restaurant_id, id) ON DELETE CASCADE;

ALTER TABLE onboarding_profiles
  ADD COLUMN id uuid DEFAULT gen_random_uuid();
ALTER TABLE onboarding_profiles DROP CONSTRAINT onboarding_profiles_pkey;
ALTER TABLE onboarding_profiles ADD CONSTRAINT onboarding_profiles_pkey PRIMARY KEY (id);
ALTER TABLE onboarding_profiles
  ADD CONSTRAINT onboarding_profiles_tenant_restaurant_unique UNIQUE (tenant_id, restaurant_id);

ALTER TABLE users
  ADD COLUMN interface_locale text NOT NULL DEFAULT 'fr' CHECK (interface_locale IN ('fr', 'en')),
  ADD COLUMN interface_theme text NOT NULL DEFAULT 'dark' CHECK (interface_theme IN ('dark', 'clear')),
  ADD COLUMN preferred_interaction text NOT NULL DEFAULT 'mixed' CHECK (preferred_interaction IN ('text', 'voice', 'mixed')),
  ADD COLUMN spoken_replies boolean NOT NULL DEFAULT false,
  ADD COLUMN interaction_configured boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'onboarding_drafts', 'onboarding_first_results', 'onboarding_completion_keys'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name AND policyname = 'tenant_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_current_tenant() OR app_platform_access()) WITH CHECK (tenant_id = app_current_tenant() OR app_platform_access())',
        table_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'onboarding_drafts_updated_at' AND tgrelid = 'onboarding_drafts'::regclass) THEN
    CREATE TRIGGER onboarding_drafts_updated_at BEFORE UPDATE ON onboarding_drafts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'onboarding_first_results_updated_at' AND tgrelid = 'onboarding_first_results'::regclass) THEN
    CREATE TRIGGER onboarding_first_results_updated_at BEFORE UPDATE ON onboarding_first_results FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
