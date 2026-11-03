# Cloud history rollout (strictly free)

## Selected backend
Supabase Free: PostgreSQL + Supabase Auth + Row Level Security. It is not production-grade guaranteed storage on the free tier.

## Free-tier limits to respect
- 500 MB database per project and 1 GB file storage.
- Free projects may pause after a week of low activity.
- Free plan does not include automatic database backups / point-in-time recovery.
- Therefore the app must keep JSON export/import and users must periodically download backups. Never promise zero data loss.

## Security model
- Each record belongs to auth.uid(); RLS restricts read/insert/delete to that owner.
- History rows are append-only; no UPDATE policy.
- No bookmaker login/passwords, betting actions, or service-role key in the browser.
- Validate payload size and schema before writes; use authenticated Supabase client with anon key + user session.
- Do not store API tokens or passwords inside history payloads.

## Migration
Apply `supabase-schema.sql` in the SQL Editor of the dedicated Supabase project. The migration creates the table, indexes, RLS policies and a 64 KiB payload limit.

## Remaining activation steps
1. Connect the Supabase integration to ChatGPT and create/select a project on Free.
2. Apply the SQL migration and verify RLS with two separate test users.
3. Add Supabase project URL and publishable/anon key to Vercel Preview environment variables only.
4. Implement email sign-in, cloud sync, pagination, deduplication and retry queue.
5. Test backup export/import, user isolation, offline mode and API failure handling.
6. Only after the Preview checks pass, consider Production — with separate explicit approval.

No paid plan, card entry, paid add-on, or billing upgrade is required or authorized for this plan.
