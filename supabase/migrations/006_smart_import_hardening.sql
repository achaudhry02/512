-- Compatibility milestone: Smart Import audit and rule tables are installed by 001_initial_schema.sql.
alter table public.import_rows add column if not exists reviewed_at timestamptz;
alter table public.import_rows add column if not exists posted_at timestamptz;
