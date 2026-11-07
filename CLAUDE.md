# LeaseDesk AI

Full spec is in SPEC.md. Build ONE milestone at a time and stop when it works.

Stack: Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Supabase, Claude API, Resend.

Rules:
- Never expose secret keys (Claude API, Supabase service-role, Resend) to the browser.
- Secrets go in .env.local, which is gitignored. Keep .env.example updated.
- Signed contracts are immutable: no edits, no overwrites.
- AI edits require user approval. Money math uses code, never AI.
- Database changes go in supabase/migrations.
- Write tests for critical business rules.

Commands: `npm run dev` · `npm run build` · `npm test` (unit + PGlite RLS tests) · `npm run lint` · `npm run typecheck`
