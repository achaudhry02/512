import assert from "node:assert/strict";
import { canPerformAction, canViewPage, roleForStore } from "../src/lib/permissions";

assert.equal(canViewPage("owner", "/settings"), true);
assert.equal(canViewPage("manager", "/end-of-day-close"), true);
assert.equal(canViewPage("manager", "/settings"), false);
assert.equal(canViewPage("employee", "/reports"), false);
assert.equal(canViewPage("employee", "/cash-reconciliation"), true);
assert.equal(canViewPage("accountant", "/reports"), true);
assert.equal(canPerformAction("employee", "edit_daily_sales"), true);
assert.equal(canPerformAction("employee", "edit_cash_reconciliation"), true);
assert.equal(canPerformAction("employee", "edit_operations"), false);
assert.equal(canPerformAction("accountant", "export_reports"), true);
assert.equal(canPerformAction("accountant", "edit_financials"), false);
assert.equal(canPerformAction("manager", "reopen_day"), false);
assert.equal(roleForStore("owner-id", "owner-id", "employee"), "owner");
assert.equal(roleForStore("member-id", "owner-id", "accountant"), "accountant");

console.log("Role permission tests passed.");
