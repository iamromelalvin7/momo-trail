create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  network text not null check (network in ('MTN','Telecel','AT')),
  amount_ghs numeric(12,2) not null check (amount_ghs > 0),
  txn_ref text,
  issue_type text not null check (issue_type in ('wrong_number','failed_debit','pending_reversal')),
  status text not null default 'open' check (status in ('open','escalated','resolved')),
  notes text,
  created_at timestamptz not null default now()
);

create index disputes_user_id_idx on public.disputes (user_id);

alter table public.disputes enable row level security;

create policy "select own" on public.disputes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "insert own" on public.disputes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "update own" on public.disputes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "delete own" on public.disputes
  for delete to authenticated
  using (user_id = (select auth.uid()));
