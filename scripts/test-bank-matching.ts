import assert from "node:assert/strict";
import { bankMatchingSummary, suggestBankMatch } from "../src/lib/bank-matching";
import { canPerformAction, canViewPage } from "../src/lib/permissions";
import type { CashFlowEntry, CommandCenterData } from "../src/lib/types";

const base = { id: "bank", date: "2026-07-10", amount: 250, match_status: "unmatched" } as CashFlowEntry;
const data = {
  cash_reconciliations: [{ id: "cash", date: base.date, bank_deposit_amount: 250, cash_drops: 0, processor_card_total: 400 }],
  expenses: [{ id: "expense", date: base.date, vendor_name: "Capital Candy", amount: 250 }],
  payroll_entries: [{ id: "payroll", date_range_start: base.date, date_range_end: base.date, hours_worked: 10, hourly_rate: 25 }],
} as unknown as CommandCenterData;

assert.deepEqual(suggestBankMatch({ ...base, flow_type: "cash_deposit" }, data), {
  cashFlowId: "bank", matchedRecordType: "cash_reconciliation", matchedRecordId: "cash", confidence: 95,
  reason: "Date and deposit amount match cash reconciliation.",
});
assert.equal(suggestBankMatch({ ...base, flow_type: "vendor_ach", vendor_name: "Capital Candy" }, data)?.matchedRecordType, "expense");
assert.equal(suggestBankMatch({ ...base, flow_type: "other" }, data)?.matchedRecordType, "payroll_entry");
assert.equal(suggestBankMatch({ ...base, flow_type: "owner_draw" }, data)?.confidence, 100);
assert.equal(suggestBankMatch({ ...base, flow_type: "fee", amount: 19 }, data), null);

const fallbackData = {
  cash_reconciliations: [],
  expenses: [],
  payroll_entries: [],
  pos_import_rows: [{ id: "pos", date: base.date, card_total: 250, import_action: "import" }],
  import_rows: [{ id: "import", date: base.date, vendor: "Capital Candy", total: 250, import_destination: "expenses", needs_review: false, row_status: "reviewed" }],
} as unknown as CommandCenterData;
assert.equal(suggestBankMatch({ ...base, flow_type: "card_processor_deposit" }, fallbackData)?.matchedRecordType, "pos_card_batch");
assert.equal(suggestBankMatch({ ...base, flow_type: "vendor_ach", vendor_name: "Capital Candy" }, fallbackData)?.matchedRecordType, "import_row");

assert.deepEqual(bankMatchingSummary([
  { ...base, match_status: "matched" },
  { ...base, id: "two", match_status: "unmatched" },
] as CashFlowEntry[]), { total: 2, unmatched: 1, suggested: 0, matched: 1, ignored: 0 });
assert.equal(canViewPage("accountant", "/bank-matching"), true);
assert.equal(canPerformAction("accountant", "edit_financials"), false, "accountants must remain read-only in bank matching");
assert.equal(canViewPage("employee", "/bank-matching"), false);
assert.equal(canPerformAction("employee", "edit_financials"), false);

console.log("Bank matching tests passed.");
