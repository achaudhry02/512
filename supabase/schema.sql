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
  hot_food_sales numeric(12,2) not null default 0,
  cigarette_sales numeric(12,2) not null default 0,
  beer_sales numeric(12,2) not null default 0,
  grocery_sales numeric(12,2) not null default 0,
  other_sales numeric(12,2) not null default 0,
  cash_total numeric(12,2) not null default 0,
  card_total numeric(12,2) not null default 0,
  expenses numeric(12,2) not null default 0,
  payroll numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fuel_margin numeric generated always as (fuel_retail_price - fuel_cost_per_gallon) stored,
  fuel_profit numeric generated always as (fuel_gallons_sold * (fuel_retail_price - fuel_cost_per_gallon)) stored,
  total_sales numeric generated always as (grocery_sales + deli_sales + hot_food_sales + lottery_sales + beer_sales + cigarette_sales + other_sales) stored,
  gross_profit numeric generated always as (
    (fuel_gallons_sold * (fuel_retail_price - fuel_cost_per_gallon)) +
    (lottery_sales * 0.06) +
    ((deli_sales + hot_food_sales) * 0.55) +
    ((grocery_sales + beer_sales + cigarette_sales + other_sales) * 0.28)
  ) stored,
  net_profit_estimate numeric generated always as (
    (fuel_gallons_sold * (fuel_retail_price - fuel_cost_per_gallon)) +
    (lottery_sales * 0.06) +
    ((deli_sales + hot_food_sales) * 0.55) +
    ((grocery_sales + beer_sales + cigarette_sales + other_sales) * 0.28) -
    expenses -
    payroll
  ) stored
);

alter table public.daily_sales add column if not exists hot_food_sales numeric(12,2) not null default 0;
alter table public.daily_sales add column if not exists cash_total numeric(12,2) not null default 0;
alter table public.daily_sales add column if not exists card_total numeric(12,2) not null default 0;
alter table public.daily_sales add column if not exists expenses numeric(12,2) not null default 0;
alter table public.daily_sales add column if not exists payroll numeric(12,2) not null default 0;
alter table public.daily_sales add column if not exists fuel_margin numeric generated always as (fuel_retail_price - fuel_cost_per_gallon) stored;
alter table public.daily_sales add column if not exists fuel_profit numeric generated always as (fuel_gallons_sold * (fuel_retail_price - fuel_cost_per_gallon)) stored;
alter table public.daily_sales add column if not exists total_sales numeric generated always as (grocery_sales + deli_sales + hot_food_sales + lottery_sales + beer_sales + cigarette_sales + other_sales) stored;
alter table public.daily_sales add column if not exists gross_profit numeric generated always as (
  (fuel_gallons_sold * (fuel_retail_price - fuel_cost_per_gallon)) +
  (lottery_sales * 0.06) +
  ((deli_sales + hot_food_sales) * 0.55) +
  ((grocery_sales + beer_sales + cigarette_sales + other_sales) * 0.28)
) stored;
alter table public.daily_sales add column if not exists net_profit_estimate numeric generated always as (
  (fuel_gallons_sold * (fuel_retail_price - fuel_cost_per_gallon)) +
  (lottery_sales * 0.06) +
  ((deli_sales + hot_food_sales) * 0.55) +
  ((grocery_sales + beer_sales + cigarette_sales + other_sales) * 0.28) -
  expenses -
  payroll
) stored;

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
      'Lottery',
      'Deli / Hot Food',
      'Cigarettes / Tobacco',
      'Beer / Alcohol',
      'Grocery',
      'Drinks',
      'Candy',
      'Snacks',
      'Coffee',
      'Supplies',
      'Taxes',
      'Fees',
      'Other'
    )
  ),
  amount numeric(12,2) not null default 0,
  payment_method text not null default 'ACH',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (
  category in (
    'Inventory',
    'Inventory invoice',
    'Vendor invoice',
    'Payroll',
    'Rent/Mortgage',
    'Utilities',
    'Insurance',
    'Repairs',
    'Fuel purchase',
    'Capital Candy',
    'Lottery',
    'Deli / Hot Food',
    'Cigarettes / Tobacco',
    'Beer / Alcohol',
    'Grocery',
    'Drinks',
    'Candy',
    'Snacks',
    'Coffee',
    'Supplies',
    'Taxes',
    'Fees',
    'Other'
  )
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

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  original_file_name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  file_hash text not null,
  row_count integer not null default 0,
  status text not null default 'reviewed' check (status in ('reviewed', 'imported', 'duplicate', 'failed')),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, file_hash)
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  import_id uuid not null references public.imports(id) on delete cascade,
  row_index integer not null,
  row_hash text not null,
  date date,
  vendor text,
  description text,
  product_name text,
  sku_upc text,
  quantity numeric(12,3) not null default 0,
  unit_cost numeric(12,4) not null default 0,
  unit_retail_price numeric(12,4) not null default 0,
  total numeric(12,2) not null default 0,
  suggested_category text not null default 'Other',
  confidence_score numeric(5,2) not null default 0,
  import_destination text not null default 'needs_review',
  needs_review boolean not null default false,
  ignored boolean not null default false,
  raw_data jsonb,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, row_hash)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  category text not null default 'Other',
  total_spend numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, normalized_name)
);

alter table public.vendors add column if not exists contact_person text;
alter table public.vendors add column if not exists phone text;
alter table public.vendors add column if not exists email text;
alter table public.vendors add column if not exists products_supplied text;
alter table public.vendors add column if not exists average_weekly_spend numeric(12,2) not null default 0;
alter table public.vendors add column if not exists notes text;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  parent_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_category_id uuid references public.product_categories(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  name text not null,
  sku_upc text,
  category text not null default 'Other',
  unit_cost numeric(12,4) not null default 0,
  unit_retail_price numeric(12,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, name)
);

alter table public.products add column if not exists quantity_on_hand numeric(12,3) not null default 0;
alter table public.products add column if not exists reorder_level numeric(12,3) not null default 0;
alter table public.products add column if not exists notes text;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  role text not null default 'Employee/Cashier' check (role in ('Owner/Admin', 'Manager', 'Employee/Cashier')),
  hourly_rate numeric(12,2) not null default 0 check (hourly_rate >= 0),
  phone text,
  email text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, name)
);

create table if not exists public.product_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  import_row_id uuid references public.import_rows(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  date date not null,
  product_name text not null,
  sku_upc text,
  quantity_sold numeric(12,3) not null default 0,
  unit_cost numeric(12,4) not null default 0,
  unit_retail_price numeric(12,4) not null default 0,
  gross_sales numeric(12,2) not null default 0,
  gross_profit numeric(12,2) not null default 0,
  margin_percent numeric(8,3) not null default 0,
  category text not null default 'Other',
  vendor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.department_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  report_start_date date,
  report_end_date date,
  department_name text not null,
  gross_sales numeric(12,2) not null default 0,
  item_count integer not null default 0,
  refund_count integer not null default 0,
  net_count integer not null default 0,
  refund_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  net_sales numeric(12,2) not null default 0,
  percent_of_sales numeric(8,3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.store_sales_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  report_start_date date,
  report_end_date date,
  grand_total_store_sales numeric(12,2) not null default 0,
  total_fuel_sales_volume numeric(12,3) not null default 0,
  total_fuel_sales_dollars numeric(12,2) not null default 0,
  fuel_discounts numeric(12,2) not null default 0,
  total_non_fuel_sales numeric(12,2) not null default 0,
  other_discounts numeric(12,2) not null default 0,
  total_taxes_collected numeric(12,2) not null default 0,
  total_sales numeric(12,2) not null default 0,
  total_revenue numeric(12,2) not null default 0,
  network_revenue numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.fuel_grade_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  report_start_date date,
  report_end_date date,
  grade text not null,
  grade_name text not null,
  volume numeric(12,3) not null default 0,
  sales numeric(12,2) not null default 0,
  percent_of_total_fuel_sales numeric(8,3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tender_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  report_start_date date,
  report_end_date date,
  payment_method text not null,
  count integer not null default 0,
  sales_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  keyword text not null,
  normalized_keyword text not null,
  category text not null default 'Other',
  import_destination text not null default 'expenses',
  confidence_score numeric(5,2) not null default 95,
  usage_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, normalized_keyword)
);

create table if not exists public.vendor_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  vendor_name text not null,
  normalized_vendor text not null,
  category text not null default 'Other',
  import_destination text not null default 'expenses',
  confidence_score numeric(5,2) not null default 95,
  usage_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, normalized_vendor)
);

create table if not exists public.product_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_name text not null,
  sku_upc text,
  normalized_product text not null,
  category text not null default 'Other',
  import_destination text not null default 'product_sales',
  confidence_score numeric(5,2) not null default 95,
  usage_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, normalized_product)
);

create index if not exists stores_user_id_idx on public.stores(user_id);
create index if not exists daily_sales_user_store_date_idx on public.daily_sales(user_id, store_id, date desc);
create unique index if not exists daily_sales_user_store_date_unique_idx on public.daily_sales(user_id, store_id, date);
create index if not exists expenses_user_store_date_idx on public.expenses(user_id, store_id, date desc);
create index if not exists fuel_entries_user_store_date_idx on public.fuel_entries(user_id, store_id, date desc);
create index if not exists lottery_entries_user_store_date_idx on public.lottery_entries(user_id, store_id, date desc);
create index if not exists deli_entries_user_store_date_idx on public.deli_entries(user_id, store_id, date desc);
create index if not exists payroll_entries_user_store_date_idx on public.payroll_entries(user_id, store_id, date_range_start desc);
create index if not exists imports_user_store_created_idx on public.imports(user_id, store_id, created_at desc);
create index if not exists import_rows_user_store_import_idx on public.import_rows(user_id, store_id, import_id, row_index);
create index if not exists vendors_user_store_name_idx on public.vendors(user_id, store_id, normalized_name);
create index if not exists product_categories_user_store_name_idx on public.product_categories(user_id, store_id, name);
create index if not exists products_user_store_name_idx on public.products(user_id, store_id, name);
create index if not exists products_user_store_sku_idx on public.products(user_id, store_id, sku_upc);
create index if not exists products_user_store_stock_idx on public.products(user_id, store_id, quantity_on_hand, reorder_level);
create index if not exists employees_user_store_name_idx on public.employees(user_id, store_id, name);
create index if not exists product_sales_user_store_date_idx on public.product_sales(user_id, store_id, date desc);
create index if not exists product_sales_user_store_category_idx on public.product_sales(user_id, store_id, category);
create index if not exists department_sales_user_store_report_idx on public.department_sales(user_id, store_id, report_end_date desc);
create index if not exists store_sales_summaries_user_store_report_idx on public.store_sales_summaries(user_id, store_id, report_end_date desc);
create index if not exists fuel_grade_sales_user_store_report_idx on public.fuel_grade_sales(user_id, store_id, report_end_date desc);
create index if not exists tender_sales_user_store_report_idx on public.tender_sales(user_id, store_id, report_end_date desc);
create index if not exists category_rules_user_store_keyword_idx on public.category_rules(user_id, store_id, normalized_keyword);
create index if not exists vendor_rules_user_store_vendor_idx on public.vendor_rules(user_id, store_id, normalized_vendor);
create index if not exists product_rules_user_store_product_idx on public.product_rules(user_id, store_id, normalized_product);
create index if not exists product_rules_user_store_sku_idx on public.product_rules(user_id, store_id, sku_upc);

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

drop trigger if exists set_imports_updated_at on public.imports;
create trigger set_imports_updated_at
before update on public.imports
for each row execute function public.set_updated_at();

drop trigger if exists set_import_rows_updated_at on public.import_rows;
create trigger set_import_rows_updated_at
before update on public.import_rows
for each row execute function public.set_updated_at();

drop trigger if exists set_vendors_updated_at on public.vendors;
create trigger set_vendors_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

drop trigger if exists set_product_categories_updated_at on public.product_categories;
create trigger set_product_categories_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_employees_updated_at on public.employees;
create trigger set_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

drop trigger if exists set_product_sales_updated_at on public.product_sales;
create trigger set_product_sales_updated_at
before update on public.product_sales
for each row execute function public.set_updated_at();

drop trigger if exists set_category_rules_updated_at on public.category_rules;
create trigger set_category_rules_updated_at
before update on public.category_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_vendor_rules_updated_at on public.vendor_rules;
create trigger set_vendor_rules_updated_at
before update on public.vendor_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_product_rules_updated_at on public.product_rules;
create trigger set_product_rules_updated_at
before update on public.product_rules
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.daily_sales enable row level security;
alter table public.expenses enable row level security;
alter table public.fuel_entries enable row level security;
alter table public.lottery_entries enable row level security;
alter table public.deli_entries enable row level security;
alter table public.payroll_entries enable row level security;
alter table public.imports enable row level security;
alter table public.import_rows enable row level security;
alter table public.vendors enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.employees enable row level security;
alter table public.product_sales enable row level security;
alter table public.department_sales enable row level security;
alter table public.store_sales_summaries enable row level security;
alter table public.fuel_grade_sales enable row level security;
alter table public.tender_sales enable row level security;
alter table public.category_rules enable row level security;
alter table public.vendor_rules enable row level security;
alter table public.product_rules enable row level security;

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

drop policy if exists "Users can manage their own imports" on public.imports;
drop policy if exists "Users can select their own imports" on public.imports;
create policy "Users can select their own imports" on public.imports
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own imports" on public.imports;
create policy "Users can insert their own imports" on public.imports
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own imports" on public.imports;
create policy "Users can update their own imports" on public.imports
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own imports" on public.imports;
create policy "Users can delete their own imports" on public.imports
for delete using (user_id = auth.uid());

drop policy if exists "Users can manage their own import rows" on public.import_rows;
drop policy if exists "Users can select their own import rows" on public.import_rows;
create policy "Users can select their own import rows" on public.import_rows
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own import rows" on public.import_rows;
create policy "Users can insert their own import rows" on public.import_rows
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own import rows" on public.import_rows;
create policy "Users can update their own import rows" on public.import_rows
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own import rows" on public.import_rows;
create policy "Users can delete their own import rows" on public.import_rows
for delete using (user_id = auth.uid());

drop policy if exists "Users can manage their own vendors" on public.vendors;
drop policy if exists "Users can select their own vendors" on public.vendors;
create policy "Users can select their own vendors" on public.vendors
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own vendors" on public.vendors;
create policy "Users can insert their own vendors" on public.vendors
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own vendors" on public.vendors;
create policy "Users can update their own vendors" on public.vendors
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own vendors" on public.vendors;
create policy "Users can delete their own vendors" on public.vendors
for delete using (user_id = auth.uid());

drop policy if exists "Users can manage their own product categories" on public.product_categories;
drop policy if exists "Users can select their own product categories" on public.product_categories;
create policy "Users can select their own product categories" on public.product_categories
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own product categories" on public.product_categories;
create policy "Users can insert their own product categories" on public.product_categories
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own product categories" on public.product_categories;
create policy "Users can update their own product categories" on public.product_categories
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own product categories" on public.product_categories;
create policy "Users can delete their own product categories" on public.product_categories
for delete using (user_id = auth.uid());

drop policy if exists "Users can manage their own products" on public.products;
drop policy if exists "Users can select their own products" on public.products;
create policy "Users can select their own products" on public.products
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own products" on public.products;
create policy "Users can insert their own products" on public.products
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own products" on public.products;
create policy "Users can update their own products" on public.products
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own products" on public.products;
create policy "Users can delete their own products" on public.products
for delete using (user_id = auth.uid());

drop policy if exists "Users can select their own employees" on public.employees;
create policy "Users can select their own employees" on public.employees
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own employees" on public.employees;
create policy "Users can insert their own employees" on public.employees
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own employees" on public.employees;
create policy "Users can update their own employees" on public.employees
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own employees" on public.employees;
create policy "Users can delete their own employees" on public.employees
for delete using (user_id = auth.uid());

drop policy if exists "Users can manage their own product sales" on public.product_sales;
drop policy if exists "Users can select their own product sales" on public.product_sales;
create policy "Users can select their own product sales" on public.product_sales
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own product sales" on public.product_sales;
create policy "Users can insert their own product sales" on public.product_sales
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own product sales" on public.product_sales;
create policy "Users can update their own product sales" on public.product_sales
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own product sales" on public.product_sales;
create policy "Users can delete their own product sales" on public.product_sales
for delete using (user_id = auth.uid());

drop policy if exists "Users can select their own department sales" on public.department_sales;
create policy "Users can select their own department sales" on public.department_sales
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own department sales" on public.department_sales;
create policy "Users can insert their own department sales" on public.department_sales
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own department sales" on public.department_sales;
create policy "Users can update their own department sales" on public.department_sales
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own department sales" on public.department_sales;
create policy "Users can delete their own department sales" on public.department_sales
for delete using (user_id = auth.uid());

drop policy if exists "Users can select their own store sales summaries" on public.store_sales_summaries;
create policy "Users can select their own store sales summaries" on public.store_sales_summaries
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own store sales summaries" on public.store_sales_summaries;
create policy "Users can insert their own store sales summaries" on public.store_sales_summaries
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own store sales summaries" on public.store_sales_summaries;
create policy "Users can update their own store sales summaries" on public.store_sales_summaries
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own store sales summaries" on public.store_sales_summaries;
create policy "Users can delete their own store sales summaries" on public.store_sales_summaries
for delete using (user_id = auth.uid());

drop policy if exists "Users can select their own fuel grade sales" on public.fuel_grade_sales;
create policy "Users can select their own fuel grade sales" on public.fuel_grade_sales
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own fuel grade sales" on public.fuel_grade_sales;
create policy "Users can insert their own fuel grade sales" on public.fuel_grade_sales
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own fuel grade sales" on public.fuel_grade_sales;
create policy "Users can update their own fuel grade sales" on public.fuel_grade_sales
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own fuel grade sales" on public.fuel_grade_sales;
create policy "Users can delete their own fuel grade sales" on public.fuel_grade_sales
for delete using (user_id = auth.uid());

drop policy if exists "Users can select their own tender sales" on public.tender_sales;
create policy "Users can select their own tender sales" on public.tender_sales
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own tender sales" on public.tender_sales;
create policy "Users can insert their own tender sales" on public.tender_sales
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own tender sales" on public.tender_sales;
create policy "Users can update their own tender sales" on public.tender_sales
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own tender sales" on public.tender_sales;
create policy "Users can delete their own tender sales" on public.tender_sales
for delete using (user_id = auth.uid());

drop policy if exists "Users can manage their own category rules" on public.category_rules;
create policy "Users can manage their own category rules" on public.category_rules
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own vendor rules" on public.vendor_rules;
create policy "Users can manage their own vendor rules" on public.vendor_rules
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own product rules" on public.product_rules;
create policy "Users can manage their own product rules" on public.product_rules
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
