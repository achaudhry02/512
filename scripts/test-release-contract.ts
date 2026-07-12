import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("supabase/schema.sql", "utf8");
const migration = readFileSync("supabase/migrations/011_phase11_release_candidate.sql", "utf8");
const hardeningMigration = readFileSync("supabase/migrations/012_phase11_performance_hardening.sql", "utf8");
const closeMigration = readFileSync("supabase/migrations/013_phase11_close_status_accuracy.sql", "utf8");
const scopedPolicyMigration = readFileSync("supabase/migrations/014_phase11_policy_scope_hardening.sql", "utf8");
const provider = readFileSync("src/lib/data-provider.tsx", "utf8");
const login = readFileSync("src/app/login/page.tsx", "utf8");
const middleware = readFileSync("middleware.ts", "utf8");

const requiredTables = [
  "users", "stores", "store_members", "daily_sales", "monthly_totals", "expenses",
  "cash_reconciliations", "fuel_entries", "fuel_grades", "fuel_deliveries", "fuel_tank_readings",
  "fuel_reconciliations", "margin_settings", "lottery_entries", "deli_entries", "payroll_entries",
  "cash_flow_entries", "imports", "import_rows", "vendors", "product_categories", "products", "employees",
  "product_sales", "department_sales", "store_sales_summaries", "fuel_grade_sales", "tender_sales",
  "category_rules", "vendor_rules", "product_rules", "pos_systems", "pos_imports", "pos_column_mappings",
  "pos_import_rows", "purchase_orders", "purchase_order_items", "inventory_adjustments", "price_history",
  "vendor_item_costs", "daily_close_statuses",
];

for (const table of requiredTables) {
  assert.match(schema, new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "i"), `${table} must exist in the full schema`);
  assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must enable RLS`);
}

const rpcCalls = [...provider.matchAll(/\.rpc\("([a-z_]+)"/g)].map((match) => match[1]).sort();
assert.deepEqual(rpcCalls, ["close_business_day", "receive_purchase_order", "record_inventory_adjustment", "reopen_business_day"]);
for (const rpc of rpcCalls) assert.match(schema, new RegExp(`create or replace function public\\.${rpc}\\(`, "i"));

assert.doesNotMatch(migration, /\b(drop\s+table|truncate\s+table|delete\s+from)\b/i, "release migration must not delete application data");
assert.doesNotMatch(hardeningMigration, /\b(drop\s+table|truncate\s+table|delete\s+from)\b/i, "hardening migration must not delete application data");
assert.doesNotMatch(closeMigration, /\b(drop\s+table|truncate\s+table|delete\s+from)\b/i, "close migration must not delete application data");
assert.doesNotMatch(scopedPolicyMigration, /\b(drop\s+table|truncate\s+table|delete\s+from)\b/i, "policy migration must not delete application data");
assert.match(migration, /create table if not exists public\.daily_close_statuses/i);
assert.match(migration, /add column if not exists match_status/i);
assert.match(migration, /revoke all privileges on table public\.%I from anon, authenticated/i);
assert.match(migration, /grant select, insert, update, delete on table public\.%I to authenticated/i);
assert.match(migration, /Legacy generated estimate retained for compatibility/i);
assert.match(migration, /Cash operators can update reconciliations/i);
assert.match(hardeningMigration, /create index if not exists/i);
assert.match(hardeningMigration, /\(select auth\.jwt\(\)\)->>'email'/i);
assert.match(closeMigration, /bank_deposit_pending/i);
assert.match(closeMigration, /Only an owner can reopen a business day/i);
assert.match(scopedPolicyMigration, /tablename = any\(array\[/i);
assert.doesNotMatch(scopedPolicyMigration, /tablename\s*<>/i);
assert.match(provider, /Use the dedicated close or reopen action/);

assert.match(login, /PASSWORD_RECOVERY/);
assert.match(login, /auth\.updateUser\(\{ password \}\)/);
assert.match(login, /Confirm password/);
assert.match(middleware, /"\/end-of-day-close"/);
assert.match(middleware, /"\/bank-matching"/);

console.log(`Release contract audit passed for ${requiredTables.length} tables and ${rpcCalls.length} RPC calls.`);
