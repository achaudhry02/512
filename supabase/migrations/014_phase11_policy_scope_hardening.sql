-- Remove only obsolete policies owned by this application. Never enumerate or drop
-- arbitrary policies from the public schema.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_policies
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
      and policyname like 'Users can % their own %'
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end;
$$;

-- Reassert only the two transition-sensitive policies by name.
drop policy if exists "Operations can insert close statuses" on public.daily_close_statuses;
create policy "Operations can insert close statuses" on public.daily_close_statuses
for insert to authenticated
with check (public.current_store_role(store_id) in ('owner', 'manager') and status = 'closed');

drop policy if exists "Operations can update close statuses" on public.daily_close_statuses;
create policy "Operations can update close statuses" on public.daily_close_statuses
for update to authenticated
using (public.current_store_role(store_id) in ('owner', 'manager'))
with check (
  public.current_store_role(store_id) = 'owner'
  or (public.current_store_role(store_id) = 'manager' and status = 'closed')
);

-- Store configuration and staff administration remain owner-only writes.
do $$
declare
  table_name text;
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
end;
$$;
