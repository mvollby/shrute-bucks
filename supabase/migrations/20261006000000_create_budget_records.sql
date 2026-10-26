create table if not exists public.budget_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_name text not null check (table_name in ('transactions', 'rules', 'categories', 'months', 'plans')),
  record_id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, table_name, record_id),
  constraint budget_records_data_for_live_row check ((deleted and data is null) or (not deleted and data is not null))
);

alter table public.budget_records enable row level security;

revoke all on table public.budget_records from anon, authenticated;
grant select, insert, update, delete on table public.budget_records to authenticated;

drop policy if exists "Read own budget records" on public.budget_records;
drop policy if exists "Insert own budget records" on public.budget_records;
drop policy if exists "Update own budget records" on public.budget_records;
drop policy if exists "Delete own budget records" on public.budget_records;

create policy "Read own budget records"
  on public.budget_records for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Insert own budget records"
  on public.budget_records for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own budget records"
  on public.budget_records for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Delete own budget records"
  on public.budget_records for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists budget_records_user_table_idx
  on public.budget_records (user_id, table_name);
