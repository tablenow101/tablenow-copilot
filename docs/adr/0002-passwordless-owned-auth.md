# ADR 0002 — Provider-neutral passwordless authentication

Status: accepted for private pilot.

Private access uses invitation-only six-digit email codes and server-side sessions. Codes are hashed, expiring, rate-limited and single-use. Session state lives in PostgreSQL and uses secure cookies.

The identity boundary can later be replaced by any OIDC provider. Business tables only reference TableNow user IDs; they never reference Supabase Auth IDs.
