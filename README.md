# TableNow Platform

> Commencer par [`context/CONTEXT.md`](context/CONTEXT.md). Cette mémoire explique le produit, ses frontières, sa base de données, ses décisions et son état actuel en langage simple.

TableNow Platform is the isolated V2 foundation for the restaurant operating copilot. It is intentionally separate from `tablenowfrontend`, `tablenowbackend`, `app.tablenow.io`, and the current Supabase project.

The same business code runs in two modes:

- **TableNow Cloud** for private pilots and multi-site supervision.
- **TableNow Node** on a restaurant server or mini-PC, with PostgreSQL and the product interface on the local network. Cloud sync and external AI are optional.

## Safety boundary

The repository does not contain production credentials or migration code that writes to the legacy database. The legacy baselines audited before this repository was created are:

- frontend `tablenow101/tablenowfrontend@fee6cbab747d95037a3859e9df61efc9a35473c6`;
- backend `tablenow101/tablenowbackend@e2b07131eb2fdc7fe103c8d05783cd9550610419`.

Never copy the legacy `SUPABASE_SERVICE_KEY` or production `DATABASE_URL` into this project. V2 migration is a separate, reviewed phase.

## What is included

- invite-only access by six-digit email code;
- secure server sessions, CSRF protection, role-based permissions and tenant isolation;
- a guided restaurant onboarding;
- native, software, calendar, paper and hybrid operating modes per restaurant;
- persistent group and restaurant scopes with restaurant-local time zones;
- manual reservation, task, shift and inventory entry from desktop or mobile;
- the complete TableNow product navigation and persistent pilot data;
- a capability router that prefers native functions and official APIs before browser automation;
- an isolated Computer Use runner with allowlists, evidence, cancellation and human approvals;
- a human-approval layer for sensitive copilot actions;
- an audit trail, idempotent jobs and an outbox for reliable integrations;
- a real MCP server that calls the TableNow API instead of the database;
- local SMTP testing through Mailpit and production SMTP compatibility;
- GDPR data preferences, access/export and deletion request workflows;
- Docker Compose deployment for a restaurant node or a private cloud host.

## Run locally

1. On a machine with Docker and OpenSSL, run:

   ```bash
   ./scripts/init-node.sh direction@restaurant.fr
   ```

2. Open `http://localhost:8080`.
3. Use the e-mail provided to the script.
4. Open Mailpit at `http://localhost:8025` to obtain the six-digit code.

The installer generates private secrets and does not use a fixed code. Production startup rejects fixed OTPs.

## Cloud pilot target

The private pilot is Vercel-first and uses one isolated V2 PostgreSQL database. No new VPS is part of the pilot architecture. The existing cloud container profile remains a portability and disaster-recovery asset; it is not the active production target.

The Vercel API, durable jobs, private object storage and Computer Use sandbox adaptation are tracked in [`context/11-status/next-actions.md`](context/11-status/next-actions.md). Never connect the console to the legacy V1 API as a shortcut.

## Native development

With PostgreSQL available locally:

```bash
corepack enable
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The console runs on `http://localhost:3000`, the API on `http://localhost:4000`, and the optional sync gateway on `http://localhost:4100`.

## Verification

```bash
pnpm check
```

CI runs linting, strict TypeScript, unit tests, dependency audit, container build and all production builds. See `context/CONTEXT.md` for orientation, then `docs/architecture.md`, `docs/legacy-audit.md`, `docs/runbooks/`, and `docs/privacy/` for the operational and compliance foundations.

Deployment and integration decisions are documented in:

- `docs/DEPLOYMENT_BOUNDARIES.fr.md` for the strict V1/V2/site separation;
- `docs/RESTAURANT_OPERATING_MODES.fr.md` for software, calendar, paper and hybrid restaurants;
- `docs/COMPUTER_USE_SAFETY.fr.md` for the execution hierarchy, safeguards and accuracy limits.
- `docs/PILOT_READINESS.fr.md` for the release gates and external activation checklist.
