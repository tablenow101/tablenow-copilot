-- Bounded private documents for onboarding; content is encrypted before storage.
CREATE TABLE onboarding_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 2000000),
  encrypted_content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_attachments_tenant ON onboarding_attachments(tenant_id, created_at);
ALTER TABLE onboarding_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON onboarding_attachments
  USING (tenant_id = app_current_tenant() OR app_platform_access())
  WITH CHECK (tenant_id = app_current_tenant() OR app_platform_access());
