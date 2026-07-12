-- Compatibility milestone: fuel reconciliation tables are installed by 001_initial_schema.sql.
alter table public.fuel_grades add column if not exists variance_threshold_gallons numeric(12,3) not null default 25;
