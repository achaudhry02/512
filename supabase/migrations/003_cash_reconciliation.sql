-- Compatibility milestone: cash_reconciliations is installed by 001_initial_schema.sql.
alter table public.cash_reconciliations add column if not exists status text not null default 'draft';
