-- Compatibility milestone: roles and store_members are installed by 001_initial_schema.sql.
-- Later membership policy changes are applied by 010_bank_matching_and_confidence.sql.
alter table public.users add column if not exists role text not null default 'owner';
alter table public.users add column if not exists selected_store_id uuid;
