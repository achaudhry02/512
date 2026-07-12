import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canPerformAction, canViewPage, roleForStore } from "../src/lib/permissions";

assert.equal(canViewPage("owner", "/settings"), true);
assert.equal(canViewPage("manager", "/end-of-day-close"), true);
assert.equal(canViewPage("manager", "/settings"), false);
assert.equal(canViewPage("employee", "/reports"), false);
assert.equal(canViewPage("accountant", "/inventory"), false);
assert.equal(canViewPage("employee", "/cash-reconciliation"), true);
assert.equal(canViewPage("accountant", "/reports"), true);
assert.equal(canPerformAction("employee", "edit_daily_sales"), true);
assert.equal(canPerformAction("employee", "edit_cash_reconciliation"), true);
assert.equal(canPerformAction("employee", "edit_operations"), false);
assert.equal(canPerformAction("accountant", "export_reports"), true);
assert.equal(canPerformAction("accountant", "edit_financials"), false);
assert.equal(canPerformAction("manager", "reopen_day"), false);
assert.equal(canPerformAction("manager", "close_day"), true);
assert.equal(canPerformAction("owner", "reopen_day"), true);
assert.equal(canPerformAction("employee", "close_day"), false);
assert.equal(canPerformAction("accountant", "close_day"), false);
for (const route of ["/dashboard", "/reports", "/inventory", "/settings", "/end-of-day-close", "/bank-matching"]) {
  assert.equal(canViewPage("owner", route), true, `owner should access ${route}`);
}
assert.equal(roleForStore("owner-id", "owner-id", "employee"), "owner");
assert.equal(roleForStore("member-id", "owner-id", "accountant"), "accountant");

const appShell = readFileSync("src/components/app-shell.tsx", "utf8");
const provider = readFileSync("src/lib/data-provider.tsx", "utf8");
const scopedPolicies = readFileSync("supabase/migrations/014_phase11_policy_scope_hardening.sql", "utf8");
assert.match(appShell, /authLoading \|\| \(loading && !store\)/, "route content must wait for initial active store role resolution");
assert.match(appShell, /canViewPage\(role, pathname\) \? children : <UnauthorizedState/, "restricted route content must remain unmounted");
assert.match(provider, /table === "margin_settings"\) return "manage_settings"/, "margin writes must be owner-only in the provider");
assert.match(provider, /Use the dedicated close or reopen action/, "generic provider writes must reject close transitions");
assert.match(scopedPolicies, /array\['margin_settings', 'employees'\]/, "settings and staff writes must be owner-only in RLS");
assert.match(scopedPolicies, /public\.can_manage_store\(store_id\)/, "owner-only RLS must use active store membership");

console.log("Role permission tests passed.");
