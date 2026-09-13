# ADR 0002 — Provider-neutral passwordless authentication

Status: historical private-pilot decision; superseded for enrolled accounts by the founder-approved password and second-factor flow (12 September 2026).

New registrations use verified email, a personal password, TOTP and single-use recovery codes. Returning users cannot bypass their enrolled second factor through the old email-code routes. See `context/02-architecture/owner-modularization-2026-09-12.md` and the current delivery record for implementation and verification status.

Historical implementation:

Private access uses invitation-only six-digit email codes and server-side sessions. Codes are hashed, expiring, rate-limited and single-use. Session state lives in PostgreSQL and uses secure cookies.

The identity boundary can later be replaced by any OIDC provider. Business tables only reference TableNow user IDs; they never reference Supabase Auth IDs.
