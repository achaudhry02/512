-- Phase 11 release hardening: optimize membership policies and cover foreign keys.
-- This migration is idempotent and does not modify application data.

drop policy if exists "Members can view store memberships" on public.store_members;
create policy "Members can view store memberships" on public.store_members for select to authenticated
using (
  public.is_store_member(store_id)
  or (user_id is null and lower(invited_email) = lower((select auth.jwt())->>'email'))
);

drop policy if exists "Owners or invitees can update memberships" on public.store_members;
create policy "Owners or invitees can update memberships" on public.store_members for update to authenticated
using (
  public.can_manage_store(store_id)
  or (user_id is null and lower(invited_email) = lower((select auth.jwt())->>'email'))
)
with check (public.can_manage_store(store_id) or user_id = (select auth.uid()));

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('cash_flow_entries', 'import_id'),
      ('cash_flow_entries', 'import_row_id'),
      ('cash_flow_entries', 'reviewed_by'),
      ('cash_flow_entries', 'store_id'),
      ('cash_reconciliations', 'store_id'),
      ('category_rules', 'store_id'),
      ('daily_close_statuses', 'closed_by'),
      ('daily_close_statuses', 'reopened_by'),
      ('daily_sales', 'store_id'),
      ('deli_entries', 'store_id'),
      ('department_sales', 'import_id'),
      ('department_sales', 'store_id'),
      ('employees', 'store_id'),
      ('expenses', 'store_id'),
      ('fuel_deliveries', 'fuel_grade_id'),
      ('fuel_deliveries', 'store_id'),
      ('fuel_entries', 'store_id'),
      ('fuel_grade_sales', 'import_id'),
      ('fuel_grade_sales', 'store_id'),
      ('fuel_grades', 'store_id'),
      ('fuel_reconciliations', 'fuel_grade_id'),
      ('fuel_reconciliations', 'store_id'),
      ('fuel_tank_readings', 'fuel_grade_id'),
      ('fuel_tank_readings', 'store_id'),
      ('import_rows', 'import_id'),
      ('import_rows', 'store_id'),
      ('imports', 'store_id'),
      ('lottery_entries', 'store_id'),
      ('margin_settings', 'store_id'),
      ('monthly_totals', 'store_id'),
      ('payroll_entries', 'store_id'),
      ('pos_column_mappings', 'store_id'),
      ('pos_import_rows', 'pos_import_id'),
      ('pos_import_rows', 'store_id'),
      ('pos_imports', 'store_id'),
      ('pos_systems', 'store_id'),
      ('product_categories', 'store_id'),
      ('product_rules', 'store_id'),
      ('product_sales', 'import_id'),
      ('product_sales', 'import_row_id'),
      ('product_sales', 'product_id'),
      ('product_sales', 'store_id'),
      ('product_sales', 'vendor_id'),
      ('products', 'product_category_id'),
      ('products', 'store_id'),
      ('products', 'vendor_id'),
      ('store_sales_summaries', 'import_id'),
      ('store_sales_summaries', 'store_id'),
      ('tender_sales', 'import_id'),
      ('tender_sales', 'store_id'),
      ('vendor_rules', 'store_id'),
      ('vendors', 'store_id')
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

-- These duplicate indexes are replaced by the unique-constraint indexes.
drop index if exists public.cash_reconciliations_user_store_date_unique_idx;
drop index if exists public.monthly_totals_user_store_period_unique_idx;
