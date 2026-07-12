-- Compatibility milestone: inventory operation tables and RPCs are installed by 001_initial_schema.sql.
create index if not exists inventory_adjustments_product_date_idx
on public.inventory_adjustments(product_id, adjustment_date desc);
