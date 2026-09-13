-- Global authentication records: server-only, never exposed by tenant APIs.
CREATE TABLE google_identities (
  subject text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE google_login_attempts (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  payload text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
CREATE INDEX google_login_attempts_expiry ON google_login_attempts(expires_at);
REVOKE ALL ON google_identities, google_login_attempts FROM PUBLIC;
-- Google-only accounts enroll TOTP and may later set a password through recovery.
-- Existing password hashes and TOTP credentials are unchanged.
ALTER TABLE account_credentials ALTER COLUMN password_hash DROP NOT NULL;
