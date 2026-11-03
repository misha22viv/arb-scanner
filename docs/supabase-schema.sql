-- ARB Scanner cloud history schema (Supabase / PostgreSQL)
-- Apply only to a dedicated Supabase project on the Free plan.
-- All rows are private to the authenticated owner. No bookmaker credentials are stored.

create table if not exists public.arb_history (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  captured_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint arb_history_payload_size check (octet_length(payload::text) <= 65536)
);

create index if not exists arb_history_user_captured_idx
  on public.arb_history (user_id, captured_at desc);

create index if not exists arb_history_user_event_idx
  on public.arb_history (user_id, event_key, captured_at desc);

alter table public.arb_history enable row level security;

drop policy if exists "read own arb history" on public.arb_history;
create policy "read own arb history"
  on public.arb_history for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own arb history" on public.arb_history;
create policy "insert own arb history"
  on public.arb_history for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "delete own arb history" on public.arb_history;
create policy "delete own arb history"
  on public.arb_history for delete
  to authenticated
  using (auth.uid() = user_id);

-- Immutable history: no UPDATE policy is intentionally provided.
-- Never expose the service_role key in browser code or Vercel public variables.
