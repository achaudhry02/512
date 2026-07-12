-- Compatibility milestone: margin_settings is installed by 001_initial_schema.sql.
alter table public.margin_settings add column if not exists notes text;
