-- Replace this value with an existing auth.users.id from your Supabase project before running.
-- In Supabase SQL editor, get it from Authentication > Users after signing up once.
do $$
declare
  seed_user_id uuid := '00000000-0000-0000-0000-000000000000';
  seed_store_id uuid := gen_random_uuid();
begin
  insert into public.users (id, email, full_name)
  values (seed_user_id, 'owner@example.com', 'Demo Owner')
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name;

  insert into public.stores (id, user_id, name, address, city, state, zip)
  values (
    seed_store_id,
    seed_user_id,
    'Main Street Market',
    '100 Main Street',
    'Springfield',
    'IL',
    '62701'
  );

  insert into public.daily_sales (
    user_id,
    store_id,
    date,
    inside_sales,
    fuel_gallons_sold,
    fuel_retail_price,
    fuel_cost_per_gallon,
    lottery_sales,
    lottery_payouts,
    deli_sales,
    cigarette_sales,
    beer_sales,
    grocery_sales,
    other_sales,
    notes
  )
  values
    (seed_user_id, seed_store_id, current_date, 5280, 2210, 3.59, 3.32, 980, 420, 840, 1380, 940, 1220, 920, 'Strong evening commute and lunch rush.'),
    (seed_user_id, seed_store_id, current_date - interval '1 day', 4860, 1980, 3.57, 3.31, 850, 380, 760, 1240, 880, 1130, 860, 'Restocked beer cave.'),
    (seed_user_id, seed_store_id, current_date - interval '2 days', 4550, 1850, 3.55, 3.29, 790, 310, 700, 1180, 820, 1060, 790, null);

  insert into public.expenses (user_id, store_id, date, vendor_name, category, amount, payment_method, notes)
  values
    (seed_user_id, seed_store_id, current_date, 'Capital Candy', 'Capital Candy', 725.40, 'ACH', 'Candy and snacks delivery.'),
    (seed_user_id, seed_store_id, current_date - interval '1 day', 'City Utilities', 'Utilities', 415.20, 'ACH', null),
    (seed_user_id, seed_store_id, current_date - interval '2 days', 'Fuel Distributor', 'Fuel purchase', 6540.00, 'ACH', 'Regular fuel delivery.');

  insert into public.fuel_entries (user_id, store_id, date, gallons_sold, cost_per_gallon, retail_price_per_gallon, notes)
  values
    (seed_user_id, seed_store_id, current_date, 2210, 3.32, 3.59, 'Margin held after nearby price move.'),
    (seed_user_id, seed_store_id, current_date - interval '1 day', 1980, 3.31, 3.57, null);

  insert into public.lottery_entries (user_id, store_id, date, lottery_sales, lottery_payouts, commission_percentage, notes)
  values
    (seed_user_id, seed_store_id, current_date, 980, 420, 6, 'Scratch-off display refreshed.'),
    (seed_user_id, seed_store_id, current_date - interval '1 day', 850, 380, 6, null);

  insert into public.deli_entries (user_id, store_id, date, deli_sales, food_cost, waste_amount, notes)
  values
    (seed_user_id, seed_store_id, current_date, 840, 315, 42, 'Breakfast sandwiches sold out.'),
    (seed_user_id, seed_store_id, current_date - interval '1 day', 760, 288, 35, null);

  insert into public.payroll_entries (
    user_id,
    store_id,
    employee_name,
    date_range_start,
    date_range_end,
    hours_worked,
    hourly_rate,
    notes
  )
  values
    (seed_user_id, seed_store_id, 'Jordan Lee', current_date - interval '6 days', current_date, 38.5, 18, 'Shift lead.'),
    (seed_user_id, seed_store_id, 'Mia Patel', current_date - interval '6 days', current_date, 32, 16.5, null);
end $$;
