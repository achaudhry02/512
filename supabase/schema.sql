create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'owner' check (role in ('owner', 'manager', 'employee', 'accountant')),
  selected_store_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists role text not null default 'owner';
alter table public.users add column if not exists selected_store_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_role_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_role_check check (role in ('owner', 'manager', 'employee', 'accountant'));
  end if;
end $$;

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

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'employee', 'accountant')),
  invited_email text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id)
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

create table if not exists public.monthly_totals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  grocery_sales numeric(12,2) not null default 0,
  deli_sales numeric(12,2) not null default 0,
  hot_food_sales numeric(12,2) not null default 0,
  fuel_gallons_sold numeric(12,3) not null default 0,
  fuel_revenue numeric(12,2) not null default 0,
  fuel_cost numeric(12,2) not null default 0,
  lottery_sales numeric(12,2) not null default 0,
  beer_sales numeric(12,2) not null default 0,
  cigarette_sales numeric(12,2) not null default 0,
  vape_nicotine_sales numeric(12,2) not null default 0,
  other_sales numeric(12,2) not null default 0,
  cash_sales numeric(12,2) not null default 0,
  card_sales numeric(12,2) not null default 0,
  payroll numeric(12,2) not null default 0,
  inventory_purchases numeric(12,2) not null default 0,
  vendor_expenses numeric(12,2) not null default 0,
  utilities numeric(12,2) not null default 0,
  rent_mortgage numeric(12,2) not null default 0,
  insurance numeric(12,2) not null default 0,
  repairs_maintenance numeric(12,2) not null default 0,
  miscellaneous_expenses numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  total_sales numeric generated always as (
    grocery_sales + deli_sales + hot_food_sales + fuel_revenue + lottery_sales +
    beer_sales + cigarette_sales + vape_nicotine_sales + other_sales
  ) stored,
  total_expenses numeric generated always as (
    payroll + inventory_purchases + vendor_expenses + utilities + rent_mortgage +
    insurance + repairs_maintenance + miscellaneous_expenses
  ) stored,
  fuel_margin numeric generated always as (
    case when fuel_gallons_sold > 0 then (fuel_revenue - fuel_cost) / fuel_gallons_sold else 0 end
  ) stored,
  fuel_profit numeric generated always as (fuel_revenue - fuel_cost) stored,
  gross_profit numeric generated always as (
    (fuel_revenue - fuel_cost) +
    (lottery_sales * 0.06) +
    ((deli_sales + hot_food_sales) * 0.55) +
    ((grocery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales) * 0.28)
  ) stored,
  estimated_net_profit numeric generated always as (
    (fuel_revenue - fuel_cost) +
    (lottery_sales * 0.06) +
    ((deli_sales + hot_food_sales) * 0.55) +
    ((grocery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales) * 0.28) -
    (payroll + inventory_purchases + vendor_expenses + utilities + rent_mortgage + insurance + repairs_maintenance + miscellaneous_expenses)
  ) stored,
  expense_percentage numeric generated always as (
    case
      when (grocery_sales + deli_sales + hot_food_sales + fuel_revenue + lottery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales) > 0
      then ((payroll + inventory_purchases + vendor_expenses + utilities + rent_mortgage + insurance + repairs_maintenance + miscellaneous_expenses) /
        (grocery_sales + deli_sales + hot_food_sales + fuel_revenue + lottery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales)) * 100
      else 0
    end
  ) stored,
  gross_margin_percent numeric generated always as (
    case
      when (grocery_sales + deli_sales + hot_food_sales + fuel_revenue + lottery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales) > 0
      then (((fuel_revenue - fuel_cost) + (lottery_sales * 0.06) + ((deli_sales + hot_food_sales) * 0.55) +
        ((grocery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales) * 0.28)) /
        (grocery_sales + deli_sales + hot_food_sales + fuel_revenue + lottery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales)) * 100
      else 0
    end
  ) stored,
  net_margin_percent numeric generated always as (
    case
      when (grocery_sales + deli_sales + hot_food_sales + fuel_revenue + lottery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales) > 0
      then ((((fuel_revenue - fuel_cost) + (lottery_sales * 0.06) + ((deli_sales + hot_food_sales) * 0.55) +
        ((grocery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales) * 0.28)) -
        (payroll + inventory_purchases + vendor_expenses + utilities + rent_mortgage + insurance + repairs_maintenance + miscellaneous_expenses)) /
        (grocery_sales + deli_sales + hot_food_sales + fuel_revenue + lottery_sales + beer_sales + cigarette_sales + vape_nicotine_sales + other_sales)) * 100
      else 0
    end
  ) stored,
  unique (user_id, store_id, year, month)
);

create table if not exists public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  starting_cash numeric(12,2) not null default 0,
  ending_cash numeric(12,2) not null default 0,
  expected_cash_sales numeric(12,2) not null default 0,
  cash_drops numeric(12,2) not null default 0,
  paid_outs numeric(12,2) not null default 0,
  lottery_payouts numeric(12,2) not null default 0,
  cash_over_short numeric(12,2) not null default 0,
  pos_card_total numeric(12,2) not null default 0,
  processor_card_total numeric(12,2) not null default 0,
  ebt_total numeric(12,2) not null default 0,
  gift_card_total numeric(12,2) not null default 0,
  other_tender_total numeric(12,2) not null default 0,
  bank_deposit_amount numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'balanced', 'needs_review')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expected_ending_cash numeric generated always as (
    starting_cash + expected_cash_sales - cash_drops - paid_outs - lottery_payouts
  ) stored,
  variance numeric generated always as (
    ending_cash - (starting_cash + expected_cash_sales - cash_drops - paid_outs - lottery_payouts)
  ) stored,
  is_balanced boolean generated always as (
    abs(ending_cash - (starting_cash + expected_cash_sales - cash_drops - paid_outs - lottery_payouts)) <= 1
    and abs(pos_card_total - processor_card_total) <= 1
  ) stored,
  unique (user_id, store_id, date)
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

create table if not exists public.fuel_grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  code text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  target_margin numeric(8,3) not null default 0.20,
  variance_threshold_gallons numeric(12,3) not null default 25,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, code)
);

create table if not exists public.fuel_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  fuel_grade_id uuid not null references public.fuel_grades(id) on delete cascade,
  grade_name text not null,
  date date not null,
  delivered_gallons numeric(12,3) not null default 0,
  rack_cost_per_gallon numeric(8,3) not null default 0,
  invoice_number text,
  vendor_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_tank_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  fuel_grade_id uuid not null references public.fuel_grades(id) on delete cascade,
  grade_name text not null,
  date date not null,
  reading_type text not null default 'ending' check (reading_type in ('beginning', 'ending')),
  gallons numeric(12,3) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, fuel_grade_id, date, reading_type)
);

create table if not exists public.fuel_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  fuel_grade_id uuid not null references public.fuel_grades(id) on delete cascade,
  grade_name text not null,
  date date not null,
  beginning_gallons numeric(12,3) not null default 0,
  delivered_gallons numeric(12,3) not null default 0,
  sold_gallons numeric(12,3) not null default 0,
  ending_gallons numeric(12,3) not null default 0,
  actual_inventory numeric(12,3) not null default 0,
  rack_cost_per_gallon numeric(8,3) not null default 0,
  retail_price_per_gallon numeric(8,3) not null default 0,
  target_margin numeric(8,3) not null default 0.20,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  book_inventory numeric generated always as (beginning_gallons + delivered_gallons - sold_gallons) stored,
  variance numeric generated always as (
    coalesce(nullif(actual_inventory, 0), ending_gallons) - (beginning_gallons + delivered_gallons - sold_gallons)
  ) stored,
  actual_margin numeric generated always as (retail_price_per_gallon - rack_cost_per_gallon) stored,
  suggested_price numeric generated always as (rack_cost_per_gallon + target_margin) stored,
  is_variance_alert boolean generated always as (
    abs(coalesce(nullif(actual_inventory, 0), ending_gallons) - (beginning_gallons + delivered_gallons - sold_gallons)) > 25
  ) stored,
  unique (user_id, store_id, fuel_grade_id, date)
);

create table if not exists public.margin_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  category text not null check (category in (
    'grocery',
    'candy',
    'snacks',
    'drinks',
    'cigarettes',
    'vape_nicotine',
    'beer',
    'deli',
    'hot_food',
    'lottery',
    'fuel',
    'other'
  )),
  gross_margin_percent numeric(8,3) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, category)
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

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.imports'::regclass
      and conname = 'imports_status_check'
  ) then
    alter table public.imports drop constraint imports_status_check;
  end if;
  alter table public.imports add constraint imports_status_check
  check (status in ('draft', 'reviewed', 'posted', 'rejected', 'rolled_back', 'imported', 'duplicate', 'failed'));
end $$;

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

alter table public.import_rows add column if not exists row_status text not null default 'draft'
check (row_status in ('draft', 'reviewed', 'posted', 'ignored', 'duplicate', 'rolled_back'));
alter table public.import_rows add column if not exists duplicate_key text;
alter table public.import_rows add column if not exists duplicate_reason text;
alter table public.import_rows add column if not exists reviewed_at timestamptz;
alter table public.import_rows add column if not exists posted_at timestamptz;

create table if not exists public.cash_flow_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  import_row_id uuid references public.import_rows(id) on delete set null,
  date date not null,
  flow_type text not null default 'other' check (flow_type in ('vendor_ach', 'card_processor_deposit', 'cash_deposit', 'loan_payment', 'owner_draw', 'transfer', 'fee', 'other')),
  vendor_name text,
  description text,
  amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
create index if not exists users_selected_store_id_idx on public.users(selected_store_id);
create index if not exists store_members_user_store_idx on public.store_members(user_id, store_id);
create index if not exists store_members_store_role_idx on public.store_members(store_id, role);
create index if not exists daily_sales_user_store_date_idx on public.daily_sales(user_id, store_id, date desc);
create unique index if not exists daily_sales_user_store_date_unique_idx on public.daily_sales(user_id, store_id, date);
create index if not exists monthly_totals_user_store_period_idx on public.monthly_totals(user_id, store_id, year desc, month desc);
create unique index if not exists monthly_totals_user_store_period_unique_idx on public.monthly_totals(user_id, store_id, year, month);
create index if not exists cash_reconciliations_user_store_date_idx on public.cash_reconciliations(user_id, store_id, date desc);
create unique index if not exists cash_reconciliations_user_store_date_unique_idx on public.cash_reconciliations(user_id, store_id, date);
create index if not exists expenses_user_store_date_idx on public.expenses(user_id, store_id, date desc);
create index if not exists fuel_entries_user_store_date_idx on public.fuel_entries(user_id, store_id, date desc);
create index if not exists fuel_grades_user_store_sort_idx on public.fuel_grades(user_id, store_id, sort_order, name);
create index if not exists fuel_deliveries_user_store_date_idx on public.fuel_deliveries(user_id, store_id, date desc);
create index if not exists fuel_tank_readings_user_store_date_idx on public.fuel_tank_readings(user_id, store_id, date desc);
create index if not exists fuel_reconciliations_user_store_date_idx on public.fuel_reconciliations(user_id, store_id, date desc);
create index if not exists margin_settings_user_store_category_idx on public.margin_settings(user_id, store_id, category);
create index if not exists lottery_entries_user_store_date_idx on public.lottery_entries(user_id, store_id, date desc);
create index if not exists deli_entries_user_store_date_idx on public.deli_entries(user_id, store_id, date desc);
create index if not exists payroll_entries_user_store_date_idx on public.payroll_entries(user_id, store_id, date_range_start desc);
create index if not exists cash_flow_entries_user_store_date_idx on public.cash_flow_entries(user_id, store_id, date desc);
create index if not exists cash_flow_entries_user_store_import_idx on public.cash_flow_entries(user_id, store_id, import_id);
create index if not exists imports_user_store_created_idx on public.imports(user_id, store_id, created_at desc);
create index if not exists import_rows_user_store_import_idx on public.import_rows(user_id, store_id, import_id, row_index);
create index if not exists import_rows_user_store_duplicate_idx on public.import_rows(user_id, store_id, duplicate_key);
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
set search_path = ''
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

drop trigger if exists set_store_members_updated_at on public.store_members;
create trigger set_store_members_updated_at
before update on public.store_members
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_sales_updated_at on public.daily_sales;
create trigger set_daily_sales_updated_at
before update on public.daily_sales
for each row execute function public.set_updated_at();

drop trigger if exists set_cash_reconciliations_updated_at on public.cash_reconciliations;
create trigger set_cash_reconciliations_updated_at
before update on public.cash_reconciliations
for each row execute function public.set_updated_at();

drop trigger if exists set_monthly_totals_updated_at on public.monthly_totals;
create trigger set_monthly_totals_updated_at
before update on public.monthly_totals
for each row execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_fuel_entries_updated_at on public.fuel_entries;
create trigger set_fuel_entries_updated_at
before update on public.fuel_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_fuel_grades_updated_at on public.fuel_grades;
create trigger set_fuel_grades_updated_at
before update on public.fuel_grades
for each row execute function public.set_updated_at();

drop trigger if exists set_fuel_deliveries_updated_at on public.fuel_deliveries;
create trigger set_fuel_deliveries_updated_at
before update on public.fuel_deliveries
for each row execute function public.set_updated_at();

drop trigger if exists set_fuel_tank_readings_updated_at on public.fuel_tank_readings;
create trigger set_fuel_tank_readings_updated_at
before update on public.fuel_tank_readings
for each row execute function public.set_updated_at();

drop trigger if exists set_fuel_reconciliations_updated_at on public.fuel_reconciliations;
create trigger set_fuel_reconciliations_updated_at
before update on public.fuel_reconciliations
for each row execute function public.set_updated_at();

drop trigger if exists set_margin_settings_updated_at on public.margin_settings;
create trigger set_margin_settings_updated_at
before update on public.margin_settings
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

drop trigger if exists set_cash_flow_entries_updated_at on public.cash_flow_entries;
create trigger set_cash_flow_entries_updated_at
before update on public.cash_flow_entries
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
alter table public.store_members enable row level security;
alter table public.daily_sales enable row level security;
alter table public.monthly_totals enable row level security;
alter table public.cash_reconciliations enable row level security;
alter table public.expenses enable row level security;
alter table public.fuel_entries enable row level security;
alter table public.fuel_grades enable row level security;
alter table public.fuel_deliveries enable row level security;
alter table public.fuel_tank_readings enable row level security;
alter table public.fuel_reconciliations enable row level security;
alter table public.margin_settings enable row level security;
alter table public.lottery_entries enable row level security;
alter table public.deli_entries enable row level security;
alter table public.payroll_entries enable row level security;
alter table public.cash_flow_entries enable row level security;
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
for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can manage their own stores" on public.stores;
create policy "Users can manage their own stores" on public.stores
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own store memberships" on public.store_members;
create policy "Users can manage their own store memberships" on public.store_members
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own daily sales" on public.daily_sales;
create policy "Users can manage their own daily sales" on public.daily_sales
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own monthly totals" on public.monthly_totals;
create policy "Users can manage their own monthly totals" on public.monthly_totals
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own cash reconciliations" on public.cash_reconciliations;
create policy "Users can manage their own cash reconciliations" on public.cash_reconciliations
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own expenses" on public.expenses;
create policy "Users can manage their own expenses" on public.expenses
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own fuel entries" on public.fuel_entries;
create policy "Users can manage their own fuel entries" on public.fuel_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own fuel grades" on public.fuel_grades;
create policy "Users can manage their own fuel grades" on public.fuel_grades
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own fuel deliveries" on public.fuel_deliveries;
create policy "Users can manage their own fuel deliveries" on public.fuel_deliveries
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own fuel tank readings" on public.fuel_tank_readings;
create policy "Users can manage their own fuel tank readings" on public.fuel_tank_readings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own fuel reconciliations" on public.fuel_reconciliations;
create policy "Users can manage their own fuel reconciliations" on public.fuel_reconciliations
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own margin settings" on public.margin_settings;
create policy "Users can manage their own margin settings" on public.margin_settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own lottery entries" on public.lottery_entries;
create policy "Users can manage their own lottery entries" on public.lottery_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own deli entries" on public.deli_entries;
create policy "Users can manage their own deli entries" on public.deli_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own payroll entries" on public.payroll_entries;
create policy "Users can manage their own payroll entries" on public.payroll_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own cash flow entries" on public.cash_flow_entries;
drop policy if exists "Users can select their own cash flow entries" on public.cash_flow_entries;
create policy "Users can select their own cash flow entries" on public.cash_flow_entries
for select using (user_id = auth.uid());
drop policy if exists "Users can insert their own cash flow entries" on public.cash_flow_entries;
create policy "Users can insert their own cash flow entries" on public.cash_flow_entries
for insert with check (user_id = auth.uid());
drop policy if exists "Users can update their own cash flow entries" on public.cash_flow_entries;
create policy "Users can update their own cash flow entries" on public.cash_flow_entries
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete their own cash flow entries" on public.cash_flow_entries;
create policy "Users can delete their own cash flow entries" on public.cash_flow_entries
for delete using (user_id = auth.uid());

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

drop policy if exists "Users can manage their own employees" on public.employees;
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

drop policy if exists "Users can manage their own department sales" on public.department_sales;
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

drop policy if exists "Users can manage their own store sales summaries" on public.store_sales_summaries;
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

drop policy if exists "Users can manage their own fuel grade sales" on public.fuel_grade_sales;
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

drop policy if exists "Users can manage their own tender sales" on public.tender_sales;
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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.users to authenticated;
grant select, insert, update, delete on table public.stores to authenticated;
grant select, insert, update, delete on table public.store_members to authenticated;
grant select, insert, update, delete on table public.monthly_totals to authenticated;
grant select, insert, update, delete on table public.cash_reconciliations to authenticated;
grant select, insert, update, delete on table public.fuel_grades to authenticated;
grant select, insert, update, delete on table public.fuel_deliveries to authenticated;
grant select, insert, update, delete on table public.fuel_tank_readings to authenticated;
grant select, insert, update, delete on table public.fuel_reconciliations to authenticated;
grant select, insert, update, delete on table public.margin_settings to authenticated;
grant select, insert, update, delete on table public.daily_sales to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;
grant select, insert, update, delete on table public.fuel_entries to authenticated;
grant select, insert, update, delete on table public.lottery_entries to authenticated;
grant select, insert, update, delete on table public.deli_entries to authenticated;
grant select, insert, update, delete on table public.payroll_entries to authenticated;
grant select, insert, update, delete on table public.cash_flow_entries to authenticated;
grant select, insert, update, delete on table public.imports to authenticated;
grant select, insert, update, delete on table public.import_rows to authenticated;
grant select, insert, update, delete on table public.vendors to authenticated;
grant select, insert, update, delete on table public.product_categories to authenticated;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.employees to authenticated;
grant select, insert, update, delete on table public.product_sales to authenticated;
grant select, insert, update, delete on table public.department_sales to authenticated;
grant select, insert, update, delete on table public.store_sales_summaries to authenticated;
grant select, insert, update, delete on table public.fuel_grade_sales to authenticated;
grant select, insert, update, delete on table public.tender_sales to authenticated;
grant select, insert, update, delete on table public.category_rules to authenticated;
grant select, insert, update, delete on table public.vendor_rules to authenticated;
grant select, insert, update, delete on table public.product_rules to authenticated;

create table if not exists public.pos_systems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  pos_key text not null,
  name text not null,
  enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, pos_key)
);

create table if not exists public.pos_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  pos_key text not null,
  pos_name text not null,
  original_file_name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  file_hash text not null,
  row_count integer not null default 0,
  imported_row_count integer not null default 0,
  status text not null default 'imported' check (status in ('previewed', 'imported', 'failed')),
  duplicate_strategy text not null default 'skip' check (duplicate_strategy in ('skip', 'overwrite')),
  mapping_template_name text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pos_column_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  pos_key text not null,
  template_name text not null,
  mapping jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, pos_key, template_name)
);

create table if not exists public.pos_import_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  pos_import_id uuid not null references public.pos_imports(id) on delete cascade,
  pos_key text not null,
  pos_name text not null,
  row_index integer not null,
  row_hash text not null,
  transaction_id text,
  date date,
  department_category text,
  item_name text,
  sku_barcode text,
  quantity_sold numeric(12,3) not null default 0,
  gross_sales numeric(12,2) not null default 0,
  discounts numeric(12,2) not null default 0,
  refunds numeric(12,2) not null default 0,
  voids numeric(12,2) not null default 0,
  net_sales numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  fees numeric(12,2) not null default 0,
  cash_total numeric(12,2) not null default 0,
  card_total numeric(12,2) not null default 0,
  ebt_total numeric(12,2) not null default 0,
  gift_card_total numeric(12,2) not null default 0,
  other_payment_total numeric(12,2) not null default 0,
  fuel_gallons numeric(12,3) not null default 0,
  fuel_sales numeric(12,2) not null default 0,
  fuel_cost numeric(12,2) not null default 0,
  lottery_sales numeric(12,2) not null default 0,
  vendor_category_notes text,
  duplicate_key text not null,
  import_action text not null default 'import' check (import_action in ('import', 'skip', 'overwrite')),
  validation_errors text[] not null default '{}',
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, row_hash),
  unique (user_id, store_id, duplicate_key)
);

create index if not exists pos_imports_user_store_created_idx on public.pos_imports(user_id, store_id, created_at desc);
create index if not exists pos_import_rows_user_store_date_idx on public.pos_import_rows(user_id, store_id, date desc);
create index if not exists pos_import_rows_user_store_pos_idx on public.pos_import_rows(user_id, store_id, pos_key, date desc);
create index if not exists pos_column_mappings_user_store_pos_idx on public.pos_column_mappings(user_id, store_id, pos_key);

drop trigger if exists set_pos_systems_updated_at on public.pos_systems;
create trigger set_pos_systems_updated_at
before update on public.pos_systems
for each row execute function public.set_updated_at();

drop trigger if exists set_pos_imports_updated_at on public.pos_imports;
create trigger set_pos_imports_updated_at
before update on public.pos_imports
for each row execute function public.set_updated_at();

drop trigger if exists set_pos_column_mappings_updated_at on public.pos_column_mappings;
create trigger set_pos_column_mappings_updated_at
before update on public.pos_column_mappings
for each row execute function public.set_updated_at();

drop trigger if exists set_pos_import_rows_updated_at on public.pos_import_rows;
create trigger set_pos_import_rows_updated_at
before update on public.pos_import_rows
for each row execute function public.set_updated_at();

alter table public.pos_systems enable row level security;
alter table public.pos_imports enable row level security;
alter table public.pos_column_mappings enable row level security;
alter table public.pos_import_rows enable row level security;

drop policy if exists "Users can manage their own POS systems" on public.pos_systems;
create policy "Users can manage their own POS systems" on public.pos_systems
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own POS imports" on public.pos_imports;
create policy "Users can manage their own POS imports" on public.pos_imports
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own POS mappings" on public.pos_column_mappings;
create policy "Users can manage their own POS mappings" on public.pos_column_mappings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own POS import rows" on public.pos_import_rows;
create policy "Users can manage their own POS import rows" on public.pos_import_rows
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.pos_systems to authenticated;
grant select, insert, update, delete on table public.pos_imports to authenticated;
grant select, insert, update, delete on table public.pos_column_mappings to authenticated;
grant select, insert, update, delete on table public.pos_import_rows to authenticated;

-- Phase 7: inventory operations
alter table public.products add column if not exists menu_export_enabled boolean not null default false;
alter table public.products add column if not exists menu_name text;
alter table public.products add column if not exists menu_description text;
alter table public.products add column if not exists menu_category text;

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  po_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  order_date date not null default current_date,
  expected_date date,
  total_cost numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, store_id, po_number)
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  sku_upc text,
  ordered_quantity numeric(12,3) not null default 0 check (ordered_quantity > 0),
  received_quantity numeric(12,3) not null default 0 check (received_quantity >= 0),
  unit_cost numeric(12,4) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, product_id)
);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  adjustment_date date not null default current_date,
  adjustment_type text not null
    check (adjustment_type in ('receipt', 'sale', 'sale_reversal', 'shrink', 'loss', 'damage', 'count', 'return', 'correction')),
  quantity_delta numeric(12,3) not null check (quantity_delta <> 0),
  unit_cost numeric(12,4),
  reason text,
  notes text,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  changed_at timestamptz not null default now(),
  old_unit_cost numeric(12,4) not null default 0,
  new_unit_cost numeric(12,4) not null default 0,
  old_retail_price numeric(12,4) not null default 0,
  new_retail_price numeric(12,4) not null default 0,
  change_reason text,
  source text not null default 'product_update',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_item_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  purchase_order_item_id uuid unique references public.purchase_order_items(id) on delete set null,
  effective_date date not null default current_date,
  unit_cost numeric(12,4) not null check (unit_cost >= 0),
  source text not null default 'purchase_order',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_orders_user_store_date_idx
  on public.purchase_orders(user_id, store_id, order_date desc);
create index if not exists purchase_orders_store_idx on public.purchase_orders(store_id);
create index if not exists purchase_orders_vendor_idx on public.purchase_orders(vendor_id);
create index if not exists purchase_order_items_order_idx
  on public.purchase_order_items(purchase_order_id);
create index if not exists purchase_order_items_user_idx on public.purchase_order_items(user_id);
create index if not exists purchase_order_items_store_idx on public.purchase_order_items(store_id);
create index if not exists purchase_order_items_product_idx on public.purchase_order_items(product_id);
create index if not exists inventory_adjustments_product_date_idx
  on public.inventory_adjustments(user_id, store_id, product_id, adjustment_date desc);
create index if not exists inventory_adjustments_product_idx on public.inventory_adjustments(product_id);
create index if not exists inventory_adjustments_store_idx on public.inventory_adjustments(store_id);
create index if not exists inventory_adjustments_order_idx on public.inventory_adjustments(purchase_order_id);
create unique index if not exists inventory_adjustments_source_idx
  on public.inventory_adjustments(user_id, store_id, source_type, source_id, adjustment_type)
  where source_id is not null;
create index if not exists price_history_product_date_idx
  on public.price_history(user_id, store_id, product_id, changed_at desc);
create index if not exists price_history_product_idx on public.price_history(product_id);
create index if not exists price_history_store_idx on public.price_history(store_id);
create index if not exists vendor_item_costs_product_date_idx
  on public.vendor_item_costs(user_id, store_id, product_id, vendor_id, effective_date desc);
create index if not exists vendor_item_costs_vendor_idx on public.vendor_item_costs(vendor_id);
create index if not exists vendor_item_costs_product_idx on public.vendor_item_costs(product_id);
create index if not exists vendor_item_costs_store_idx on public.vendor_item_costs(store_id);
create index if not exists vendor_item_costs_order_idx on public.vendor_item_costs(purchase_order_id);

drop trigger if exists set_purchase_orders_updated_at on public.purchase_orders;
create trigger set_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

drop trigger if exists set_purchase_order_items_updated_at on public.purchase_order_items;
create trigger set_purchase_order_items_updated_at
before update on public.purchase_order_items
for each row execute function public.set_updated_at();

drop trigger if exists set_inventory_adjustments_updated_at on public.inventory_adjustments;
create trigger set_inventory_adjustments_updated_at
before update on public.inventory_adjustments
for each row execute function public.set_updated_at();

drop trigger if exists set_price_history_updated_at on public.price_history;
create trigger set_price_history_updated_at
before update on public.price_history
for each row execute function public.set_updated_at();

drop trigger if exists set_vendor_item_costs_updated_at on public.vendor_item_costs;
create trigger set_vendor_item_costs_updated_at
before update on public.vendor_item_costs
for each row execute function public.set_updated_at();

-- Defined before inventory RPCs so shared-store authorization is available
-- during a fresh full-schema installation.
create or replace function public.current_store_role(target_store_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case when s.user_id = (select auth.uid()) then 'owner' else sm.role end
  from public.stores s
  left join public.store_members sm
    on sm.store_id = s.id and sm.user_id = (select auth.uid()) and sm.accepted_at is not null
  where s.id = target_store_id
    and (s.user_id = (select auth.uid()) or sm.user_id is not null)
  limit 1;
$$;

create or replace function public.can_edit_operations(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.current_store_role(target_store_id) in ('owner', 'manager'); $$;

create or replace function public.apply_inventory_adjustment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.products
  set quantity_on_hand = quantity_on_hand + new.quantity_delta,
      unit_cost = case
        when new.adjustment_type = 'receipt' and coalesce(new.unit_cost, 0) > 0 then new.unit_cost
        else unit_cost
      end
  where id = new.product_id
    and store_id = new.store_id;

  if not found then
    raise exception 'Inventory product is missing or inaccessible.';
  end if;
  return new;
end;
$$;

drop trigger if exists apply_inventory_adjustment_after_insert on public.inventory_adjustments;
create trigger apply_inventory_adjustment_after_insert
after insert on public.inventory_adjustments
for each row execute function public.apply_inventory_adjustment();

create or replace function public.capture_product_price_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.unit_cost is distinct from new.unit_cost
     or old.unit_retail_price is distinct from new.unit_retail_price then
    insert into public.price_history (
      user_id, store_id, product_id, old_unit_cost, new_unit_cost,
      old_retail_price, new_retail_price, change_reason, source
    ) values (
      new.user_id, new.store_id, new.id, old.unit_cost, new.unit_cost,
      old.unit_retail_price, new.unit_retail_price, 'Product cost or retail price changed', 'product_update'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists capture_product_price_history_after_update on public.products;
create trigger capture_product_price_history_after_update
after update of unit_cost, unit_retail_price on public.products
for each row execute function public.capture_product_price_history();

create or replace function public.sync_product_sale_inventory()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.product_id is not null and new.quantity_sold <> 0 then
    insert into public.inventory_adjustments (
      user_id, store_id, product_id, adjustment_date, adjustment_type,
      quantity_delta, unit_cost, reason, source_type, source_id
    ) values (
      new.user_id, new.store_id, new.product_id, new.date, 'sale',
      -abs(new.quantity_sold), new.unit_cost, 'Automatic deduction from product sale', 'product_sale', new.id
    ) on conflict do nothing;
    return new;
  end if;

  if tg_op = 'DELETE' and old.product_id is not null and old.quantity_sold <> 0 then
    -- A store cascade removes product sales after the parent row is no longer visible.
    -- Do not create reversal inventory rows against a store that is being deleted.
    if not exists (select 1 from public.stores where id = old.store_id) then
      return old;
    end if;

    insert into public.inventory_adjustments (
      user_id, store_id, product_id, adjustment_date, adjustment_type,
      quantity_delta, unit_cost, reason, source_type, source_id
    ) values (
      old.user_id, old.store_id, old.product_id, old.date, 'sale_reversal',
      abs(old.quantity_sold), old.unit_cost, 'Product sale removed or import rolled back', 'product_sale', old.id
    ) on conflict do nothing;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists sync_product_sale_inventory_after_insert_delete on public.product_sales;
create trigger sync_product_sale_inventory_after_insert_delete
after insert or delete on public.product_sales
for each row execute function public.sync_product_sale_inventory();

create or replace function public.record_inventory_adjustment(
  p_product_id uuid,
  p_adjustment_type text,
  p_quantity_delta numeric,
  p_unit_cost numeric default null,
  p_reason text default null,
  p_notes text default null,
  p_adjustment_date date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_row public.products%rowtype;
  adjustment_id uuid;
begin
  if p_quantity_delta = 0 then
    raise exception 'Adjustment quantity cannot be zero.';
  end if;
  if p_adjustment_type not in ('receipt', 'shrink', 'loss', 'damage', 'count', 'return', 'correction') then
    raise exception 'Unsupported manual adjustment type.';
  end if;

  select * into product_row
  from public.products
  where id = p_product_id and public.can_edit_operations(store_id);

  if product_row.id is null then
    raise exception 'Inventory product was not found.';
  end if;

  insert into public.inventory_adjustments (
    user_id, store_id, product_id, adjustment_date, adjustment_type,
    quantity_delta, unit_cost, reason, notes, source_type
  ) values (
    (select auth.uid()), product_row.store_id, product_row.id, coalesce(p_adjustment_date, current_date),
    p_adjustment_type, p_quantity_delta, p_unit_cost, p_reason, p_notes, 'manual'
  ) returning id into adjustment_id;

  return adjustment_id;
end;
$$;

create or replace function public.receive_purchase_order(p_purchase_order_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.purchase_orders%rowtype;
  item_row public.purchase_order_items%rowtype;
  quantity_to_receive numeric;
  received_lines integer := 0;
begin
  select * into order_row
  from public.purchase_orders
  where id = p_purchase_order_id and public.can_edit_operations(store_id)
  for update;

  if order_row.id is null then
    raise exception 'Purchase order was not found.';
  end if;
  if order_row.status in ('received', 'cancelled') then
    raise exception 'Purchase order cannot be received in its current status.';
  end if;

  for item_row in
    select * from public.purchase_order_items
    where purchase_order_id = order_row.id
      and received_quantity < ordered_quantity
    for update
  loop
    quantity_to_receive := item_row.ordered_quantity - item_row.received_quantity;

    insert into public.inventory_adjustments (
      user_id, store_id, product_id, purchase_order_id, adjustment_date,
      adjustment_type, quantity_delta, unit_cost, reason, source_type, source_id
    ) values (
      (select auth.uid()), order_row.store_id, item_row.product_id, order_row.id, current_date,
      'receipt', quantity_to_receive, item_row.unit_cost, 'Purchase order receipt', 'purchase_order_item', item_row.id
    ) on conflict do nothing;

    update public.purchase_order_items
    set received_quantity = ordered_quantity
    where id = item_row.id;

    insert into public.vendor_item_costs (
      user_id, store_id, vendor_id, product_id, purchase_order_id,
      purchase_order_item_id, effective_date, unit_cost, source
    ) values (
      (select auth.uid()), order_row.store_id, order_row.vendor_id, item_row.product_id,
      order_row.id, item_row.id, current_date, item_row.unit_cost, 'purchase_order'
    ) on conflict (purchase_order_item_id) do update
      set unit_cost = excluded.unit_cost,
          effective_date = excluded.effective_date;

    received_lines := received_lines + 1;
  end loop;

  if received_lines = 0 then
    raise exception 'Purchase order has no outstanding items.';
  end if;

  update public.purchase_orders
  set status = 'received'
  where id = order_row.id;

  return received_lines;
end;
$$;

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.price_history enable row level security;
alter table public.vendor_item_costs enable row level security;

drop policy if exists "Users can manage their own purchase orders" on public.purchase_orders;
create policy "Users can manage their own purchase orders" on public.purchase_orders
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own purchase order items" on public.purchase_order_items;
create policy "Users can manage their own purchase order items" on public.purchase_order_items
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own inventory adjustments" on public.inventory_adjustments;
create policy "Users can manage their own inventory adjustments" on public.inventory_adjustments
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own price history" on public.price_history;
create policy "Users can view their own price history" on public.price_history
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own price history" on public.price_history;
create policy "Users can insert their own price history" on public.price_history
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own vendor item costs" on public.vendor_item_costs;
create policy "Users can manage their own vendor item costs" on public.vendor_item_costs
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.purchase_orders to authenticated;
grant select, insert, update, delete on table public.purchase_order_items to authenticated;
grant select, insert, update, delete on table public.inventory_adjustments to authenticated;
grant select, insert on table public.price_history to authenticated;
grant select, insert, update, delete on table public.vendor_item_costs to authenticated;
revoke all on function public.record_inventory_adjustment(uuid, text, numeric, numeric, text, text, date) from public;
revoke all on function public.receive_purchase_order(uuid) from public;
grant execute on function public.record_inventory_adjustment(uuid, text, numeric, numeric, text, text, date) to authenticated;
grant execute on function public.receive_purchase_order(uuid) to authenticated;

-- Phase 10: End-of-Day Close, bank matching, and store-member authorization.
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
  lottery_not_applicable boolean not null default false,
  fuel_completed boolean not null default false,
  bank_deposit_matched boolean not null default false,
  bank_deposit_pending boolean not null default false,
  override_reason text,
  closed_at timestamptz,
  closed_by uuid references public.users(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists daily_close_statuses_user_store_date_idx on public.daily_close_statuses(user_id, store_id, date);
create index if not exists daily_close_statuses_store_date_idx on public.daily_close_statuses(store_id, date desc);
drop trigger if exists set_daily_close_statuses_updated_at on public.daily_close_statuses;
create trigger set_daily_close_statuses_updated_at before update on public.daily_close_statuses
for each row execute function public.set_updated_at();
alter table public.daily_close_statuses enable row level security;
grant select, insert, update, delete on table public.daily_close_statuses to authenticated;

alter table public.cash_flow_entries add column if not exists matched_record_type text;
alter table public.cash_flow_entries add column if not exists matched_record_id uuid;
alter table public.cash_flow_entries add column if not exists match_confidence numeric(5,2) not null default 0;
alter table public.cash_flow_entries add column if not exists match_status text not null default 'unmatched';
alter table public.cash_flow_entries add column if not exists reviewed_at timestamptz;
alter table public.cash_flow_entries add column if not exists reviewed_by uuid references public.users(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cash_flow_entries_match_status_check') then
    alter table public.cash_flow_entries add constraint cash_flow_entries_match_status_check
    check (match_status in ('unmatched', 'suggested', 'matched', 'ignored'));
  end if;
end $$;

alter table public.store_members alter column user_id drop not null;
create unique index if not exists store_members_pending_email_idx
on public.store_members(store_id, lower(invited_email)) where user_id is null;
insert into public.store_members (user_id, store_id, role, invited_email, accepted_at)
select stores.user_id, stores.id, 'owner', users.email, now()
from public.stores join public.users on users.id = stores.user_id
on conflict (user_id, store_id) do update set role = 'owner', accepted_at = coalesce(public.store_members.accepted_at, excluded.accepted_at);

create or replace function public.current_store_role(target_store_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when s.user_id = (select auth.uid()) then 'owner' else sm.role end
  from public.stores s
  left join public.store_members sm on sm.store_id = s.id and sm.user_id = (select auth.uid()) and sm.accepted_at is not null
  where s.id = target_store_id and (s.user_id = (select auth.uid()) or sm.user_id is not null)
  limit 1;
$$;
create or replace function public.is_store_member(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.current_store_role(target_store_id) is not null; $$;
create or replace function public.can_manage_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.current_store_role(target_store_id) = 'owner'; $$;
create or replace function public.can_edit_operations(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.current_store_role(target_store_id) in ('owner', 'manager'); $$;
create or replace function public.can_view_financials(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.current_store_role(target_store_id) in ('owner', 'manager', 'accountant'); $$;
revoke all on function public.current_store_role(uuid) from public, anon;
revoke all on function public.is_store_member(uuid) from public, anon;
revoke all on function public.can_manage_store(uuid) from public, anon;
revoke all on function public.can_edit_operations(uuid) from public, anon;
revoke all on function public.can_view_financials(uuid) from public, anon;
grant execute on function public.current_store_role(uuid) to authenticated;
grant execute on function public.is_store_member(uuid) to authenticated;
grant execute on function public.can_manage_store(uuid) to authenticated;
grant execute on function public.can_edit_operations(uuid) to authenticated;
grant execute on function public.can_view_financials(uuid) to authenticated;

create or replace function public.protect_store_owner_membership()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.stores where id = old.store_id) then
    return old;
  end if;
  if old.user_id = (select user_id from public.stores where id = old.store_id) then
    if tg_op = 'DELETE' then
      raise exception 'The primary store owner cannot be removed or demoted.';
    elsif new.role <> 'owner' or new.user_id is distinct from old.user_id then
      raise exception 'The primary store owner cannot be removed or demoted.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists protect_store_owner_membership_before_change on public.store_members;
create trigger protect_store_owner_membership_before_change before update or delete on public.store_members
for each row execute function public.protect_store_owner_membership();

do $$
declare policy_row record;
begin
  for policy_row in select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'stores','store_members','daily_sales','monthly_totals','cash_reconciliations','expenses',
        'fuel_entries','fuel_grades','fuel_deliveries','fuel_tank_readings','fuel_reconciliations',
        'margin_settings','lottery_entries','deli_entries','payroll_entries','cash_flow_entries','imports',
        'import_rows','vendors','product_categories','products','employees','product_sales','department_sales',
        'store_sales_summaries','fuel_grade_sales','tender_sales','category_rules','vendor_rules','product_rules',
        'pos_systems','pos_imports','pos_column_mappings','pos_import_rows','purchase_orders',
        'purchase_order_items','inventory_adjustments','price_history','vendor_item_costs','daily_close_statuses'
      ])
      and (
        policyname like 'Users can %'
        or policyname like 'Financial roles can view %'
        or policyname like 'Operations can insert %'
        or policyname like 'Operations can update %'
        or policyname like 'Operations can delete %'
        or policyname in (
          'Store members can view stores','Owners can insert stores','Owners can update stores','Owners can delete stores',
          'Members can view store memberships','Owners can insert store memberships',
          'Owners or invitees can update memberships','Owners can delete store memberships',
          'Members can view daily sales','Managers can delete daily sales',
          'Financial roles can view close statuses','Owners can delete close statuses'
        )
      )
  loop execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename); end loop;
end $$;
drop policy if exists "Users can manage their own profile" on public.users;
create policy "Users can manage their own profile" on public.users for all to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Store members can view stores" on public.stores for select to authenticated
using (user_id = (select auth.uid()) or public.is_store_member(id));
create policy "Owners can insert stores" on public.stores for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners can update stores" on public.stores for update to authenticated using (public.can_manage_store(id)) with check (public.can_manage_store(id));
create policy "Owners can delete stores" on public.stores for delete to authenticated using (public.can_manage_store(id));
create policy "Members can view store memberships" on public.store_members for select to authenticated
using (public.is_store_member(store_id) or (user_id is null and lower(invited_email) = lower((select auth.jwt())->>'email')));
create policy "Owners can insert store memberships" on public.store_members for insert to authenticated with check (public.can_manage_store(store_id));
create policy "Owners or invitees can update memberships" on public.store_members for update to authenticated
using (public.can_manage_store(store_id) or (user_id is null and lower(invited_email) = lower((select auth.jwt())->>'email')))
with check (public.can_manage_store(store_id) or user_id = (select auth.uid()));
create policy "Owners can delete store memberships" on public.store_members for delete to authenticated using (public.can_manage_store(store_id));
create policy "Members can view daily sales" on public.daily_sales for select to authenticated using (public.is_store_member(store_id));
create policy "Operations can insert daily sales" on public.daily_sales for insert to authenticated
with check (public.current_store_role(store_id) in ('owner', 'manager', 'employee'));
create policy "Operations can update daily sales" on public.daily_sales for update to authenticated
using (public.current_store_role(store_id) in ('owner', 'manager', 'employee'))
with check (public.current_store_role(store_id) in ('owner', 'manager', 'employee'));
create policy "Managers can delete daily sales" on public.daily_sales for delete to authenticated using (public.can_edit_operations(store_id));
create policy "Cash operators can view reconciliations" on public.cash_reconciliations for select to authenticated
using (public.current_store_role(store_id) in ('owner', 'manager', 'employee', 'accountant'));
create policy "Cash operators can insert reconciliations" on public.cash_reconciliations for insert to authenticated
with check (public.current_store_role(store_id) in ('owner', 'manager', 'employee'));
create policy "Cash operators can update reconciliations" on public.cash_reconciliations for update to authenticated
using (public.current_store_role(store_id) in ('owner', 'manager', 'employee'))
with check (public.current_store_role(store_id) in ('owner', 'manager', 'employee'));
create policy "Managers can delete reconciliations" on public.cash_reconciliations for delete to authenticated
using (public.can_edit_operations(store_id));
create policy "Financial roles can view close statuses" on public.daily_close_statuses for select to authenticated using (public.can_view_financials(store_id));
create policy "Operations can insert close statuses" on public.daily_close_statuses for insert to authenticated
with check (public.current_store_role(store_id) in ('owner', 'manager') and status = 'closed');
create policy "Operations can update close statuses" on public.daily_close_statuses for update to authenticated
using (public.current_store_role(store_id) in ('owner', 'manager'))
with check (
  public.current_store_role(store_id) = 'owner'
  or (public.current_store_role(store_id) = 'manager' and status = 'closed')
);
create policy "Owners can delete close statuses" on public.daily_close_statuses for delete to authenticated using (public.can_manage_store(store_id));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'monthly_totals','expenses','fuel_entries','fuel_grades','fuel_deliveries','fuel_tank_readings',
    'fuel_reconciliations','margin_settings','lottery_entries','deli_entries','payroll_entries','cash_flow_entries','imports',
    'import_rows','vendors','product_categories','products','employees','product_sales','department_sales','store_sales_summaries',
    'fuel_grade_sales','tender_sales','category_rules','vendor_rules','product_rules','pos_systems','pos_imports',
    'pos_column_mappings','pos_import_rows','purchase_orders','purchase_order_items','inventory_adjustments','price_history','vendor_item_costs'
  ]
  loop
    execute format('create policy "Financial roles can view %1$s" on public.%1$I for select to authenticated using (public.can_view_financials(store_id))', table_name);
    execute format('create policy "Operations can insert %1$s" on public.%1$I for insert to authenticated with check (public.can_edit_operations(store_id))', table_name);
    execute format('create policy "Operations can update %1$s" on public.%1$I for update to authenticated using (public.can_edit_operations(store_id)) with check (public.can_edit_operations(store_id))', table_name);
    execute format('create policy "Operations can delete %1$s" on public.%1$I for delete to authenticated using (public.can_edit_operations(store_id))', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'users','stores','store_members','daily_sales','monthly_totals','cash_reconciliations','expenses',
    'fuel_entries','fuel_grades','fuel_deliveries','fuel_tank_readings','fuel_reconciliations','margin_settings',
    'lottery_entries','deli_entries','payroll_entries','cash_flow_entries','imports','import_rows','vendors',
    'product_categories','products','employees','product_sales','department_sales','store_sales_summaries',
    'fuel_grade_sales','tender_sales','category_rules','vendor_rules','product_rules','pos_systems','pos_imports',
    'pos_column_mappings','pos_import_rows','purchase_orders','purchase_order_items','inventory_adjustments',
    'price_history','vendor_item_costs','daily_close_statuses'
  ] loop
    execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['margin_settings', 'employees']
  loop
    execute format('drop policy if exists "Operations can insert %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "Operations can update %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "Operations can delete %1$s" on public.%1$I', table_name);
    execute format('create policy "Owners can insert %1$s" on public.%1$I for insert to authenticated with check (public.can_manage_store(store_id))', table_name);
    execute format('create policy "Owners can update %1$s" on public.%1$I for update to authenticated using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id))', table_name);
    execute format('create policy "Owners can delete %1$s" on public.%1$I for delete to authenticated using (public.can_manage_store(store_id))', table_name);
  end loop;
end $$;

comment on column public.daily_sales.gross_profit is
  'Legacy generated estimate retained for compatibility. Current reports calculate profit in the application using product costs first and margin_settings as fallback.';
comment on column public.daily_sales.net_profit_estimate is
  'Legacy generated estimate retained for compatibility. Do not use as the current configurable P&L source.';
comment on column public.monthly_totals.gross_profit is
  'Legacy generated estimate retained for compatibility. Current reports calculate configurable profit in the application.';
comment on column public.monthly_totals.estimated_net_profit is
  'Legacy generated estimate retained for compatibility. Current reports calculate configurable profit in the application.';
comment on column public.monthly_totals.gross_margin_percent is
  'Legacy generated percentage retained for compatibility; current reporting recomputes this value.';
comment on column public.monthly_totals.net_margin_percent is
  'Legacy generated percentage retained for compatibility; current reporting recomputes this value.';

-- Cover foreign keys used by shared-store, import, reporting, and reconciliation queries.
do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('cash_flow_entries', 'import_id'), ('cash_flow_entries', 'import_row_id'),
      ('cash_flow_entries', 'reviewed_by'), ('cash_flow_entries', 'store_id'),
      ('cash_reconciliations', 'store_id'), ('category_rules', 'store_id'),
      ('daily_close_statuses', 'closed_by'), ('daily_close_statuses', 'reopened_by'),
      ('daily_sales', 'store_id'), ('deli_entries', 'store_id'),
      ('department_sales', 'import_id'), ('department_sales', 'store_id'),
      ('employees', 'store_id'), ('expenses', 'store_id'),
      ('fuel_deliveries', 'fuel_grade_id'), ('fuel_deliveries', 'store_id'),
      ('fuel_entries', 'store_id'), ('fuel_grade_sales', 'import_id'),
      ('fuel_grade_sales', 'store_id'), ('fuel_grades', 'store_id'),
      ('fuel_reconciliations', 'fuel_grade_id'), ('fuel_reconciliations', 'store_id'),
      ('fuel_tank_readings', 'fuel_grade_id'), ('fuel_tank_readings', 'store_id'),
      ('import_rows', 'import_id'), ('import_rows', 'store_id'), ('imports', 'store_id'),
      ('lottery_entries', 'store_id'), ('margin_settings', 'store_id'),
      ('monthly_totals', 'store_id'), ('payroll_entries', 'store_id'),
      ('pos_column_mappings', 'store_id'), ('pos_import_rows', 'pos_import_id'),
      ('pos_import_rows', 'store_id'), ('pos_imports', 'store_id'), ('pos_systems', 'store_id'),
      ('product_categories', 'store_id'), ('product_rules', 'store_id'),
      ('product_sales', 'import_id'), ('product_sales', 'import_row_id'),
      ('product_sales', 'product_id'), ('product_sales', 'store_id'), ('product_sales', 'vendor_id'),
      ('products', 'product_category_id'), ('products', 'store_id'), ('products', 'vendor_id'),
      ('store_sales_summaries', 'import_id'), ('store_sales_summaries', 'store_id'),
      ('tender_sales', 'import_id'), ('tender_sales', 'store_id'),
      ('vendor_rules', 'store_id'), ('vendors', 'store_id')
    ) as uncovered(table_name, column_name)
  loop
    execute format(
      'create index if not exists %I on public.%I (%I)',
      'idx_' || target.table_name || '_' || target.column_name || '_fk',
      target.table_name,
      target.column_name
    );
  end loop;
end;
$$;

drop index if exists public.cash_reconciliations_user_store_date_unique_idx;
drop index if exists public.monthly_totals_user_store_period_unique_idx;

create or replace function public.close_business_day(
  p_store_id uuid, p_date date, p_daily_sales_completed boolean, p_pos_import_completed boolean,
  p_cash_reconciliation_completed boolean, p_card_batch_completed boolean, p_lottery_completed boolean,
  p_lottery_not_applicable boolean, p_fuel_completed boolean, p_bank_deposit_matched boolean,
  p_bank_deposit_pending boolean, p_override_reason text, p_notes text, p_close_id uuid default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare close_id uuid;
begin
  if public.current_store_role(p_store_id) not in ('owner', 'manager') then
    raise exception 'Only an owner or manager can close a business day.' using errcode = '42501';
  end if;
  if p_bank_deposit_matched and p_bank_deposit_pending then
    raise exception 'A bank deposit cannot be both matched and pending.';
  end if;
  if p_bank_deposit_pending and nullif(trim(p_override_reason), '') is null then
    raise exception 'An override reason is required while the bank deposit is pending.';
  end if;
  if p_close_id is null then
    insert into public.daily_close_statuses (
      user_id, store_id, date, status, daily_sales_completed, pos_import_completed,
      cash_reconciliation_completed, card_batch_completed, lottery_completed,
      lottery_not_applicable, fuel_completed, bank_deposit_matched, bank_deposit_pending,
      override_reason, closed_at, closed_by, reopened_at, reopened_by, notes
    ) values (
      (select auth.uid()), p_store_id, p_date, 'closed', p_daily_sales_completed, p_pos_import_completed,
      p_cash_reconciliation_completed, p_card_batch_completed, p_lottery_completed,
      p_lottery_not_applicable, p_fuel_completed, p_bank_deposit_matched, p_bank_deposit_pending,
      nullif(trim(p_override_reason), ''), now(), (select auth.uid()), null, null, p_notes
    ) returning id into close_id;
  else
    update public.daily_close_statuses set
      status = 'closed', daily_sales_completed = p_daily_sales_completed,
      pos_import_completed = p_pos_import_completed,
      cash_reconciliation_completed = p_cash_reconciliation_completed,
      card_batch_completed = p_card_batch_completed,
      lottery_completed = p_lottery_completed, lottery_not_applicable = p_lottery_not_applicable,
      fuel_completed = p_fuel_completed, bank_deposit_matched = p_bank_deposit_matched,
      bank_deposit_pending = p_bank_deposit_pending,
      override_reason = nullif(trim(p_override_reason), ''), closed_at = now(),
      closed_by = (select auth.uid()), reopened_at = null, reopened_by = null, notes = p_notes
    where id = p_close_id and store_id = p_store_id returning id into close_id;
    if close_id is null then raise exception 'Close record was not found.'; end if;
  end if;
  return close_id;
end;
$$;

create or replace function public.reopen_business_day(p_close_id uuid, p_store_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare close_id uuid;
begin
  if public.current_store_role(p_store_id) <> 'owner' then
    raise exception 'Only an owner can reopen a business day.' using errcode = '42501';
  end if;
  update public.daily_close_statuses set
    status = 'in_progress', closed_at = null, closed_by = null,
    reopened_at = now(), reopened_by = (select auth.uid())
  where id = p_close_id and store_id = p_store_id and status = 'closed'
  returning id into close_id;
  if close_id is null then raise exception 'Closed business day was not found.'; end if;
  return close_id;
end;
$$;

revoke all on function public.close_business_day(uuid,date,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,text,uuid) from public, anon;
revoke all on function public.reopen_business_day(uuid,uuid) from public, anon;
grant execute on function public.close_business_day(uuid,date,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,text,uuid) to authenticated;
grant execute on function public.reopen_business_day(uuid,uuid) to authenticated;
