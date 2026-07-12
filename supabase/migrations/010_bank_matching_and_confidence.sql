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
on conflict (user_id, store_id) do update set role = 'owner', accepted_at = coalesce(public.store_members.accepted_at, excluded.accepted_at);

create or replace function public.current_store_role(target_store_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.user_id = (select auth.uid()) then 'owner'
    else sm.role
  end
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

do $$
declare policy_row record;
begin
  for policy_row in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename not in ('users')
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end $$;

drop policy if exists "Users can manage their own profile" on public.users;
create policy "Users can manage their own profile" on public.users for all to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Store members can view stores" on public.stores for select to authenticated
using (public.is_store_member(id));
create policy "Owners can insert stores" on public.stores for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Owners can update stores" on public.stores for update to authenticated
using (public.can_manage_store(id)) with check (public.can_manage_store(id));
create policy "Owners can delete stores" on public.stores for delete to authenticated
using (public.can_manage_store(id));

create policy "Members can view store memberships" on public.store_members for select to authenticated
using (public.is_store_member(store_id) or (user_id is null and lower(invited_email) = lower((select auth.jwt()->>'email'))));
create policy "Owners can insert store memberships" on public.store_members for insert to authenticated
with check (public.can_manage_store(store_id));
create policy "Owners or invitees can update memberships" on public.store_members for update to authenticated
using (public.can_manage_store(store_id) or (user_id is null and lower(invited_email) = lower((select auth.jwt()->>'email'))))
with check (public.can_manage_store(store_id) or user_id = (select auth.uid()));
create policy "Owners can delete store memberships" on public.store_members for delete to authenticated
using (public.can_manage_store(store_id));

create policy "Members can view daily sales" on public.daily_sales for select to authenticated
using (public.is_store_member(store_id));
create policy "Operations can insert daily sales" on public.daily_sales for insert to authenticated
with check (public.current_store_role(store_id) in ('owner', 'manager', 'employee'));
create policy "Operations can update daily sales" on public.daily_sales for update to authenticated
using (public.current_store_role(store_id) in ('owner', 'manager', 'employee'))
with check (public.current_store_role(store_id) in ('owner', 'manager', 'employee'));
create policy "Managers can delete daily sales" on public.daily_sales for delete to authenticated
using (public.can_edit_operations(store_id));

create policy "Financial roles can view close statuses" on public.daily_close_statuses for select to authenticated
using (public.can_view_financials(store_id));
create policy "Operations can insert close statuses" on public.daily_close_statuses for insert to authenticated
with check (public.can_edit_operations(store_id));
create policy "Operations can update close statuses" on public.daily_close_statuses for update to authenticated
using (public.can_edit_operations(store_id)) with check (public.can_edit_operations(store_id));
create policy "Owners can delete close statuses" on public.daily_close_statuses for delete to authenticated
using (public.can_manage_store(store_id));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'monthly_totals','cash_reconciliations','expenses','fuel_entries','fuel_grades','fuel_deliveries',
    'fuel_tank_readings','fuel_reconciliations','margin_settings','lottery_entries','deli_entries',
    'payroll_entries','cash_flow_entries','imports','import_rows','vendors','product_categories','products',
    'employees','product_sales','department_sales','store_sales_summaries','fuel_grade_sales','tender_sales',
    'category_rules','vendor_rules','product_rules','pos_systems','pos_imports','pos_column_mappings','pos_import_rows',
    'purchase_orders','purchase_order_items','inventory_adjustments','price_history','vendor_item_costs'
  ]
  loop
    execute format('create policy "Financial roles can view %1$s" on public.%1$I for select to authenticated using (public.can_view_financials(store_id))', table_name);
    execute format('create policy "Operations can insert %1$s" on public.%1$I for insert to authenticated with check (public.can_edit_operations(store_id))', table_name);
    execute format('create policy "Operations can update %1$s" on public.%1$I for update to authenticated using (public.can_edit_operations(store_id)) with check (public.can_edit_operations(store_id))', table_name);
    execute format('create policy "Operations can delete %1$s" on public.%1$I for delete to authenticated using (public.can_edit_operations(store_id))', table_name);
  end loop;
end $$;
