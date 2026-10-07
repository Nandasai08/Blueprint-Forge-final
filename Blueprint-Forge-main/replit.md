# Smart Civic Resource Dashboard

A role-aware municipal workspace for complaints, infrastructure, sanitation, maintenance, area summaries, reports, and notifications.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/smart-civic-dashboard run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Apply `supabase/schema.sql` and `supabase/seed.sql` in the Supabase SQL Editor before signing in.

## Stack

- pnpm workspaces, Node.js, TypeScript
- Web: React, Vite, Wouter, TanStack Query, Tailwind CSS
- Authentication and data: Supabase Auth and PostgreSQL with row-level security
- API: Express 5, Supabase PostgREST using the authenticated user's access token
- API contracts: OpenAPI, Orval-generated React Query hooks and Zod schemas

## Where things live

- `artifacts/smart-civic-dashboard/` — React/Vite user interface
- `artifacts/api-server/src/routes/` — API endpoints and session/role checks
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `supabase/schema.sql` — tables, triggers, RLS policies, and dashboard aggregation
- `supabase/seed.sql` — fictional, rerunnable demonstration records
- `README.md` — setup, role, and API instructions

## Architecture decisions

- Supabase owns authentication and persistence; the app does not use the workspace database or a local data fallback.
- The API forwards the signed-in user's Supabase token for database calls so RLS stays active; the secret key is reserved for server health checks.
- Dashboard chart/count aggregation runs in a `SECURITY INVOKER` PostgreSQL function to preserve RLS and avoid downloading every row.

## Product

- Protected staff access with registration, sign-in, password reset, and role-aware permissions.
- Civic record list/detail workflows with server-side search, filters, create/update/delete controls, and CSV reports.
- Operational dashboard, area summaries, notification inbox, staff profile, and saved light/dark preference.

## User preferences

- Keep civic data in Supabase and use the existing generated API hooks for browser data access.

## Gotchas

- A new account is created as `viewer`; promote a trusted administrator manually after the first signup.
- The SQL setup is explicit. Do not claim database-backed behavior is ready until both SQL files have been run in Supabase.

## Pointers

- See `README.md` for the Supabase SQL setup and deployment checklist.
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
