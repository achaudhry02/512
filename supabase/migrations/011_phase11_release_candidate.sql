-- Phase 11 release-candidate upgrade for an existing Phase 7+ database.
-- This migration is idempotent, preserves existing rows, and explicitly exposes
-- application tables to authenticated users while RLS remains authoritative.

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

alter table public.cash_flow_entries add column if not exists matched_record_type text;
alter table public.cash_flow_entries add column if not exists matched_record_id uuid;
alter table public.cash_flow_entries add column if not exists match_confidence numeric(5,2) not null default 0;
alter table public.cash_flow_entries add column if not exists match_status text not null default 'unmatched';
alter table public.cash_flow_entries add column if not exists reviewed_at timestamptz;
alter table public.cash_flow_entries add column if not exists reviewed_by uuid references public.users(id) on delete set null;

do $$
begin
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
from public.stores
join public.users on users.id = stores.user_id
on conflict (user_id, store_id) do update
set role = 'owner', accepted_at = coalesce(public.store_members.accepted_at, excluded.accepted_at);

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
returns trigger language plpgsql security invoker set search_path = ''
as $$
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
create trigger protect_store_owner_membership_before_change
before update or delete on public.store_members
for each row execute function public.protect_store_owner_membership();

-- Inventory triggers and RPCs use store authorization so managers can operate
-- shared stores. user_id remains creator metadata, not the access boundary.
create or replace function public.apply_inventory_adjustment()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  update public.products
  set quantity_on_hand = quantity_on_hand + new.quantity_delta,
      unit_cost = case when new.adjustment_type = 'receipt' and coalesce(new.unit_cost, 0) > 0 then new.unit_cost else unit_cost end
  where id = new.product_id and store_id = new.store_id;
  if not found then raise exception 'Inventory product is missing or inaccessible.'; end if;
  return new;
end;
$$;

create or replace function public.record_inventory_adjustment(
  p_product_id uuid, p_adjustment_type text, p_quantity_delta numeric,
  p_unit_cost numeric default null, p_reason text default null,
  p_notes text default null, p_adjustment_date date default current_date
)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare product_row public.products%rowtype; adjustment_id uuid;
begin
  if p_quantity_delta = 0 then raise exception 'Adjustment quantity cannot be zero.'; end if;
  if p_adjustment_type not in ('receipt', 'shrink', 'loss', 'damage', 'count', 'return', 'correction') then
    raise exception 'Unsupported manual adjustment type.';
  end if;
  select * into product_row from public.products
  where id = p_product_id and public.can_edit_operations(store_id);
  if product_row.id is null then raise exception 'Inventory product was not found.'; end if;
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
returns integer language plpgsql security invoker set search_path = ''
as $$
declare order_row public.purchase_orders%rowtype; item_row public.purchase_order_items%rowtype;
  quantity_to_receive numeric; received_lines integer := 0;
begin
  select * into order_row from public.purchase_orders
  where id = p_purchase_order_id and public.can_edit_operations(store_id) for update;
  if order_row.id is null then raise exception 'Purchase order was not found.'; end if;
  if order_row.status in ('received', 'cancelled') then raise exception 'Purchase order cannot be received in its current status.'; end if;
  for item_row in select * from public.purchase_order_items
    where purchase_order_id = order_row.id and received_quantity < ordered_quantity for update
  loop
    quantity_to_receive := item_row.ordered_quantity - item_row.received_quantity;
    insert into public.inventory_adjustments (
      user_id, store_id, product_id, purchase_order_id, adjustment_date,
      adjustment_type, quantity_delta, unit_cost, reason, source_type, source_id
    ) values (
      (select auth.uid()), order_row.store_id, item_row.product_id, order_row.id, current_date,
      'receipt', quantity_to_receive, item_row.unit_cost, 'Purchase order receipt', 'purchase_order_item', item_row.id
    ) on conflict do nothing;
    update public.purchase_order_items set received_quantity = ordered_quantity where id = item_row.id;
    insert into public.vendor_item_costs (
      user_id, store_id, vendor_id, product_id, purchase_order_id,
      purchase_order_item_id, effective_date, unit_cost, source
    ) values (
      (select auth.uid()), order_row.store_id, order_row.vendor_id, item_row.product_id,
      order_row.id, item_row.id, current_date, item_row.unit_cost, 'purchase_order'
    ) on conflict (purchase_order_item_id) do update
      set unit_cost = excluded.unit_cost, effective_date = excluded.effective_date;
    received_lines := received_lines + 1;
  end loop;
  if received_lines = 0 then raise exception 'Purchase order has no outstanding items.'; end if;
  update public.purchase_orders set status = 'received' where id = order_row.id;
  return received_lines;
end;
$$;

revoke all on function public.record_inventory_adjustment(uuid,text,numeric,numeric,text,text,date) from public, anon;
revoke all on function public.receive_purchase_order(uuid) from public, anon;
grant execute on function public.record_inventory_adjustment(uuid,text,numeric,numeric,text,text,date) to authenticated;
grant execute on function public.receive_purchase_order(uuid) to authenticated;

alter table public.daily_close_statuses enable row level security;

do $$
declare policy_row record;
begin
  for policy_row in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename <> 'users'
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
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
create policy "Daily operators can insert daily sales" on public.daily_sales for insert to authenticated
with check (public.current_store_role(store_id) in ('owner', 'manager', 'employee'));
create policy "Daily operators can update daily sales" on public.daily_sales for update to authenticated
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
create policy "Operations can insert close statuses" on public.daily_close_statuses for insert to authenticated with check (public.can_edit_operations(store_id));
create policy "Operations can update close statuses" on public.daily_close_statuses for update to authenticated using (public.can_edit_operations(store_id)) with check (public.can_edit_operations(store_id));
create policy "Owners can delete close statuses" on public.daily_close_statuses for delete to authenticated using (public.can_manage_store(store_id));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'monthly_totals','expenses','fuel_entries','fuel_grades','fuel_deliveries','fuel_tank_readings',
    'fuel_reconciliations','margin_settings','lottery_entries','deli_entries','payroll_entries','cash_flow_entries',
    'imports','import_rows','vendors','product_categories','products','employees','product_sales','department_sales',
    'store_sales_summaries','fuel_grade_sales','tender_sales','category_rules','vendor_rules','product_rules',
    'pos_systems','pos_imports','pos_column_mappings','pos_import_rows','purchase_orders','purchase_order_items',
    'inventory_adjustments','price_history','vendor_item_costs'
  ] loop
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
