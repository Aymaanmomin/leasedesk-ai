# LeaseDesk AI

Lease creation, contract management, and property records for landlords. See [SPEC.md](SPEC.md).

**Status:** Milestone 1 (foundation): accounts, organizations, properties and units, contract records, dashboard with tabs, search and filters, and demo data.

## Setup

1. `npm install`
2. Create a Supabase project. In the SQL editor, run `supabase/migrations/20261106000000_milestone1_foundation.sql`
   (or use `supabase db push` with the Supabase CLI).
3. `cp .env.example .env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. In Supabase → Authentication → URL Configuration, add `http://localhost:3000/auth/callback` as a redirect URL.
   For faster local testing you can turn off "Confirm email".
5. `npm run dev` and open http://localhost:3000. Sign up, name your organization, then use **Load demo data** on the dashboard.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests plus database tests (migration runs in in-memory Postgres via PGlite: RLS isolation, contract immutability, append-only audit log) |
| `npm run lint` / `npm run typecheck` | Static checks |

## Security notes

- Every table is organization-scoped with Row Level Security. Owners and managers can write; viewers can only read.
- Executed contracts are locked by a database trigger (`executed_at`): no edits or deletes, even after archiving.
- `activity_logs` is append-only.
- Only the Supabase anon key reaches the browser. Server secrets (service role, Anthropic, Resend) are not used yet.

## Demo vs. real

"Load demo data" inserts fictional records labeled `[Demo]` into your own organization. Nothing else is simulated.
