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
