create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'My Convenience Store',
  address text,
  city text,
  state text,
  zip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  inside_sales numeric(12,2) not null default 0,
  fuel_gallons_sold numeric(12,3) not null default 0,
  fuel_retail_price numeric(8,3) not null default 0,
  fuel_cost_per_gallon numeric(8,3) not null default 0,
  lottery_sales numeric(12,2) not null default 0,
  lottery_payouts numeric(12,2) not null default 0,
  deli_sales numeric(12,2) not null default 0,
  cigarette_sales numeric(12,2) not null default 0,
  beer_sales numeric(12,2) not null default 0,
  grocery_sales numeric(12,2) not null default 0,
  other_sales numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  vendor_name text not null,
  category text not null check (
    category in (
      'Inventory',
      'Payroll',
      'Rent/Mortgage',
      'Utilities',
      'Insurance',
      'Repairs',
      'Fuel purchase',
      'Capital Candy',
      'Taxes',
      'Other'
    )
  ),
  amount numeric(12,2) not null default 0,
  payment_method text not null default 'ACH',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  gallons_sold numeric(12,3) not null default 0,
  cost_per_gallon numeric(8,3) not null default 0,
  retail_price_per_gallon numeric(8,3) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  margin_per_gallon numeric generated always as (retail_price_per_gallon - cost_per_gallon) stored,
  total_fuel_profit numeric generated always as (gallons_sold * (retail_price_per_gallon - cost_per_gallon)) stored
);

create table if not exists public.lottery_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  lottery_sales numeric(12,2) not null default 0,
  lottery_payouts numeric(12,2) not null default 0,
  commission_percentage numeric(6,3) not null default 6,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  net_lottery_profit numeric generated always as ((lottery_sales * (commission_percentage / 100)) - lottery_payouts) stored
);

create table if not exists public.deli_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  deli_sales numeric(12,2) not null default 0,
  food_cost numeric(12,2) not null default 0,
  waste_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  estimated_gross_profit numeric generated always as (deli_sales - food_cost - waste_amount) stored
);

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  employee_name text not null,
  date_range_start date not null,
  date_range_end date not null,
  hours_worked numeric(8,2) not null default 0,
  hourly_rate numeric(8,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  total_pay numeric generated always as (hours_worked * hourly_rate) stored
);

create index if not exists stores_user_id_idx on public.stores(user_id);
create index if not exists daily_sales_user_store_date_idx on public.daily_sales(user_id, store_id, date desc);
create index if not exists expenses_user_store_date_idx on public.expenses(user_id, store_id, date desc);
create index if not exists fuel_entries_user_store_date_idx on public.fuel_entries(user_id, store_id, date desc);
create index if not exists lottery_entries_user_store_date_idx on public.lottery_entries(user_id, store_id, date desc);
create index if not exists deli_entries_user_store_date_idx on public.deli_entries(user_id, store_id, date desc);
create index if not exists payroll_entries_user_store_date_idx on public.payroll_entries(user_id, store_id, date_range_start desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_stores_updated_at on public.stores;
create trigger set_stores_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_sales_updated_at on public.daily_sales;
create trigger set_daily_sales_updated_at
before update on public.daily_sales
for each row execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_fuel_entries_updated_at on public.fuel_entries;
create trigger set_fuel_entries_updated_at
before update on public.fuel_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_lottery_entries_updated_at on public.lottery_entries;
create trigger set_lottery_entries_updated_at
before update on public.lottery_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_deli_entries_updated_at on public.deli_entries;
create trigger set_deli_entries_updated_at
before update on public.deli_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_payroll_entries_updated_at on public.payroll_entries;
create trigger set_payroll_entries_updated_at
before update on public.payroll_entries
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.daily_sales enable row level security;
alter table public.expenses enable row level security;
alter table public.fuel_entries enable row level security;
alter table public.lottery_entries enable row level security;
alter table public.deli_entries enable row level security;
alter table public.payroll_entries enable row level security;

drop policy if exists "Users can manage their own profile" on public.users;
create policy "Users can manage their own profile" on public.users
for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can manage their own stores" on public.stores;
create policy "Users can manage their own stores" on public.stores
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own daily sales" on public.daily_sales;
create policy "Users can manage their own daily sales" on public.daily_sales
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own expenses" on public.expenses;
create policy "Users can manage their own expenses" on public.expenses
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own fuel entries" on public.fuel_entries;
create policy "Users can manage their own fuel entries" on public.fuel_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own lottery entries" on public.lottery_entries;
create policy "Users can manage their own lottery entries" on public.lottery_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own deli entries" on public.deli_entries;
create policy "Users can manage their own deli entries" on public.deli_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own payroll entries" on public.payroll_entries;
create policy "Users can manage their own payroll entries" on public.payroll_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
