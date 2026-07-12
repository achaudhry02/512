-- Preserve accurate close semantics and enforce close/reopen transitions at the database boundary.
alter table public.daily_close_statuses
  add column if not exists lottery_not_applicable boolean not null default false,
  add column if not exists bank_deposit_pending boolean not null default false;

drop policy if exists "Operations can insert close statuses" on public.daily_close_statuses;
create policy "Operations can insert close statuses" on public.daily_close_statuses
for insert to authenticated
with check (
  public.current_store_role(store_id) in ('owner', 'manager')
  and status = 'closed'
);

drop policy if exists "Operations can update close statuses" on public.daily_close_statuses;
create policy "Operations can update close statuses" on public.daily_close_statuses
for update to authenticated
using (public.current_store_role(store_id) in ('owner', 'manager'))
with check (
  public.current_store_role(store_id) = 'owner'
  or (public.current_store_role(store_id) = 'manager' and status = 'closed')
);

create or replace function public.close_business_day(
  p_store_id uuid,
  p_date date,
  p_daily_sales_completed boolean,
  p_pos_import_completed boolean,
  p_cash_reconciliation_completed boolean,
  p_card_batch_completed boolean,
  p_lottery_completed boolean,
  p_lottery_not_applicable boolean,
  p_fuel_completed boolean,
  p_bank_deposit_matched boolean,
  p_bank_deposit_pending boolean,
  p_override_reason text,
  p_notes text,
  p_close_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  close_id uuid;
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
      lottery_completed = p_lottery_completed,
      lottery_not_applicable = p_lottery_not_applicable,
      fuel_completed = p_fuel_completed,
      bank_deposit_matched = p_bank_deposit_matched,
      bank_deposit_pending = p_bank_deposit_pending,
      override_reason = nullif(trim(p_override_reason), ''),
      closed_at = now(), closed_by = (select auth.uid()),
      reopened_at = null, reopened_by = null, notes = p_notes
    where id = p_close_id and store_id = p_store_id
    returning id into close_id;
    if close_id is null then raise exception 'Close record was not found.'; end if;
  end if;
  return close_id;
end;
$$;

create or replace function public.reopen_business_day(p_close_id uuid, p_store_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  close_id uuid;
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
