-- Account credentials are global identity records, like users; never exposed by tenant APIs.
CREATE TABLE account_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  totp_secret text NOT NULL,
  last_totp_step bigint NOT NULL DEFAULT -1,
  backup_hashes jsonb NOT NULL DEFAULT '[]',
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE account_challenges (
  token_hash text PRIMARY KEY,
  email text NOT NULL,
  stage text NOT NULL CHECK(stage IN ('email','enroll','mfa')),
  payload text NOT NULL,
  proof_hash text,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_challenges_expiry ON account_challenges(expires_at);
CREATE INDEX account_challenges_email ON account_challenges(email);
REVOKE ALL ON account_credentials, account_challenges FROM PUBLIC;
