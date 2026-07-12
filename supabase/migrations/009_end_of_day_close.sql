alter table public.stores add column if not exists cash_variance_threshold numeric(12,2) not null default 5;
alter table public.stores add column if not exists card_mismatch_threshold numeric(12,2) not null default 5;
alter table public.stores add column if not exists fuel_variance_threshold numeric(12,3) not null default 25;

create table if not exists public.daily_close_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'needs_review', 'closed')),
  daily_sales_completed boolean not null default false,
  pos_import_completed boolean not null default false,
  cash_reconciliation_completed boolean not null default false,
  card_batch_completed boolean not null default false,
  lottery_completed boolean not null default false,
  fuel_completed boolean not null default false,
  bank_deposit_matched boolean not null default false,
  override_reason text,
  closed_at timestamptz,
  closed_by uuid references public.users(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists daily_close_statuses_user_store_date_idx
on public.daily_close_statuses(user_id, store_id, date);
create index if not exists daily_close_statuses_store_date_idx
on public.daily_close_statuses(store_id, date desc);

drop trigger if exists set_daily_close_statuses_updated_at on public.daily_close_statuses;
create trigger set_daily_close_statuses_updated_at
before update on public.daily_close_statuses
for each row execute function public.set_updated_at();

alter table public.daily_close_statuses enable row level security;
grant select, insert, update, delete on table public.daily_close_statuses to authenticated;
