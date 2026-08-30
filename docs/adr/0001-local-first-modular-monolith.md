# ADR 0001 — Local-first modular monolith

Status: accepted.

TableNow V2 starts as a TypeScript monorepo with separate console, API, worker and sync processes around one PostgreSQL schema. This is easier to operate for a pilot and for restaurant nodes than independent microservices, while package boundaries preserve future extraction paths.

Vercel may host the console and Supabase may host PostgreSQL, but neither is required. No critical business capability uses Vercel-only functions or Supabase-only APIs.
