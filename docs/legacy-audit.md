# Legacy audit — read-only baseline

Audit date: 2026-08-23. No production resource was changed.

| Surface | Observed state | V2 decision |
| --- | --- | --- |
| Frontend | React 18 + Vite, Supabase Auth in the browser, direct token extraction from local storage, Vercel project bound to `app.tablenow.io` | Keep production intact; V2 uses server sessions and a separate console |
| Backend | Express + TypeScript on a VPS, service-role Supabase client used throughout routes and services | Preserve as legacy API; V2 routes depend on repository contracts, not Supabase SDK |
| Database | PostgreSQL/Supabase, but checked-in SQL describes only part of the runtime tables | Create a complete versioned V2 schema; migrate only after mapping the live schema |
| Deployment | Frontend production on Vercel; backend production workflow deploys the `main` branch to a VPS | V2 gets isolated staging and Docker releases; no domain switch yet |
| Integrations | Vapi, Google Calendar, SMTP/Resend, Stripe, HubSpot, Pinecone and Gemini are referenced | Place each provider behind an adapter; enable only after pilot validation |

## Legacy data surfaces observed in code

`restaurants`, `bookings`, `call_logs`, `customers`, `bcc_emails`, `availability_rules`, `closed_dates`, `services`, `calendar_connections`, `calendar_event_links`, `insights_cache`, `referrals`, `webhook_queue`, plus database functions such as `get_available_slots` and `mark_noshows`.

The repository migrations do not fully define those objects. A future migration must therefore inspect the live catalog and create a signed export before any transformation.

## Risks removed by V2

1. Identity, restaurant ownership and business records are no longer the same concept.
2. Multi-restaurant groups are first-class tenants with memberships and roles.
3. The service-role database client is not imported by controllers.
4. Provider webhooks enter an idempotent queue before affecting the domain.
5. AI actions have budgets, permissions, approvals and an immutable audit history.
6. Local operation does not require Supabase, Vercel or an external model.
