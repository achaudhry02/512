import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const schema = readFileSync("supabase/schema.sql", "utf8");
const tableNames = [...schema.matchAll(/create table if not exists public\.([a-z_]+)\s*\(/gi)].map((match) => match[1]);
const migrations = [
  "001_initial_schema.sql", "002_roles_store_members.sql", "003_cash_reconciliation.sql",
  "004_fuel_reconciliation.sql", "005_margin_settings.sql", "006_smart_import_hardening.sql",
  "007_inventory_operations.sql", "008_reporting_exports.sql", "009_end_of_day_close.sql",
  "010_bank_matching_and_confidence.sql", "011_phase11_release_candidate.sql",
  "012_phase11_performance_hardening.sql",
  "013_phase11_close_status_accuracy.sql", "014_phase11_policy_scope_hardening.sql",
];

assert.ok(tableNames.length >= 30, "the schema audit should discover all application tables");
assert.equal(new Set(tableNames).size, tableNames.length, "table declarations should be unique");
assert.doesNotMatch(schema, /auth\.role\s*\(/i, "RLS should not use the deprecated auth.role helper");
for (const file of migrations) assert.ok(existsSync(`supabase/migrations/${file}`), `${file} must exist`);

for (const helper of ["is_store_member", "current_store_role", "can_manage_store", "can_edit_operations", "can_view_financials"]) {
  assert.match(schema, new RegExp(`create or replace function public\\.${helper}\\(`, "i"), `${helper} must be defined`);
  assert.match(schema, new RegExp(`grant execute on function public\\.${helper}\\(uuid\\) to authenticated`, "i"), `${helper} must be callable by authenticated users`);
}

for (const table of tableNames) {
  assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must enable RLS`);
  assert.match(schema, new RegExp(`grant [^;]+ on table public\\.${table} to authenticated`, "i"), `${table} must grant authenticated access explicitly`);
}

assert.match(schema, /Store members can view stores/i);
assert.match(schema, /Owners can (insert|update|delete) stores/i);
assert.match(schema, /Members can view store memberships/i);
assert.match(schema, /primary store owner cannot be removed or demoted/i);
assert.match(schema, /Members can view daily sales/i);
assert.match(schema, /current_store_role\(store_id\) in \('owner', 'manager', 'employee'\)/i);
assert.match(schema, /Financial roles can view close statuses/i);
assert.match(schema, /can_view_financials\(store_id\)/i);
assert.match(schema, /can_edit_operations\(store_id\)/i);
assert.match(schema, /foreach table_name in array/i, "shared store tables must receive the role policy set");
assert.match(schema, /lottery_not_applicable boolean not null default false/i);
assert.match(schema, /bank_deposit_pending boolean not null default false/i);
assert.match(schema, /create or replace function public\.close_business_day/i);
assert.match(schema, /create or replace function public\.reopen_business_day/i);
assert.match(schema, /manager' and status = 'closed'/i, "manager updates must be limited to the closed target state");

const releaseMigration = readFileSync("supabase/migrations/011_phase11_release_candidate.sql", "utf8");
const scopedMigration = readFileSync("supabase/migrations/014_phase11_policy_scope_hardening.sql", "utf8");
assert.doesNotMatch(releaseMigration, /tablename\s*<>\s*'users'/i, "release migration must not enumerate and drop unrelated public policies");
assert.match(releaseMigration, /tablename = any\(array\[/i, "release migration policy cleanup must use an app-table allowlist");
assert.doesNotMatch(scopedMigration, /tablename\s*<>/i, "policy hardening must not target arbitrary public tables");
assert.match(scopedMigration, /policyname like 'Users can % their own %'/i, "policy hardening must target only legacy application policies");

console.log(`Store-membership RLS schema audit passed for ${tableNames.length} tables and ${migrations.length} migrations.`);
