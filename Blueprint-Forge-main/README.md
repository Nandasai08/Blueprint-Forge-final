# Smart Civic Resource Dashboard

A role-aware municipal operations workspace for complaints, infrastructure, sanitation, maintenance, area performance, and service reports. Supabase Auth provides sign-in; the Express API verifies the session and uses the signed-in user's token for database requests so PostgreSQL row-level security remains active.

## Supabase setup

1. Add the project URL and publishable key as shared environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
2. Add the Supabase secret key as a server-side Replit Secret named `SUPABASE_SECRET_KEY`. Never use it in a `VITE_*` variable.
3. In the Supabase SQL Editor, run `supabase/schema.sql`, then run `supabase/seed.sql`. The seed file inserts fictional demo data and is safe to run again.
4. In Supabase Authentication URL settings, add this app's preview and published origins to the allowed redirect URLs so password recovery can return to the app.
5. Register an account from the app. New accounts start with the `viewer` role. Promote the first trusted administrator in the SQL Editor:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = lower('admin@example.gov');
   ```

   Replace the sample address with the account's sign-in email. Administrators can assign roles and departments through the Supabase SQL Editor; profile role changes are protected by row-level security.

The app does not create the database schema automatically. Until the SQL files are run, the dashboard and API will show setup or connection errors rather than fabricated civic data.

## Run and verify

The Replit workflows start the web app and API server. Useful package checks:

```sh
pnpm run typecheck:libs
pnpm --filter @workspace/api-server exec tsc --noEmit
pnpm --filter @workspace/smart-civic-dashboard run typecheck
```

The web app is served at `/`; the API is served under `/api`.

## Access roles

- **Admin:** read and manage profiles; create, update, and delete civic records.
- **Municipal officer:** read, create, and update civic records.
- **Department officer:** read civic records and update records assigned to their department.
- **Viewer:** read-only access.

API role checks provide helpful errors. Supabase RLS policies enforce access at the database as well.

## API overview

- `GET /api/health` — reports API and Supabase database connection status.
- `GET /api/healthz` — lightweight API process health check.
- `GET /api/dashboard/stats` — database-side dashboard aggregates.
- `GET|POST /api/civic/{resource}` — list/search/filter or create civic records.
- `GET|PATCH|DELETE /api/civic/{resource}/{id}` — retrieve, update, or delete a record.
- `GET /api/search` — cross-resource search.
- `GET /api/reports` — filtered report data for CSV export.
- `GET /api/areas/{id}/summary` — area-level counts and recent records.
- `GET /api/notifications` — notifications for the signed-in profile.
- `PATCH /api/notifications/{id}/read` — mark the signed-in user's notification read.
- `GET /api/profile` — current staff profile and role.

The supported civic resources are `complaints`, `infrastructure`, `sanitation`, `maintenance`, and `areas`.
