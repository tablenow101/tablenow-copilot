-- Additive owner workflows. Existing communication messages remain canonical.
ALTER TABLE dining_tables
  ADD COLUMN service_status text NOT NULL DEFAULT 'available' CHECK (service_status IN ('available','occupied','reserved','blocked')),
  ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE team_shifts ADD COLUMN paused_at timestamptz;
ALTER TABLE communication_messages ADD COLUMN idempotency_key uuid;
CREATE UNIQUE INDEX communication_messages_idempotency ON communication_messages (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 12000),
  mode text NOT NULL CHECK (mode IN ('user','summary','ai')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT copilot_messages_restaurant_integrity FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX copilot_messages_history ON copilot_messages (tenant_id, restaurant_id, user_id, created_at DESC);
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON copilot_messages USING (tenant_id = app_current_tenant() OR app_platform_access()) WITH CHECK (tenant_id = app_current_tenant() OR app_platform_access());
