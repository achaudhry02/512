import assert from "node:assert/strict";
import { evaluateDailyClose } from "../src/lib/end-of-day-close";
import type { CommandCenterData, DailyCloseStatus } from "../src/lib/types";

const date = "2026-07-10";
const data = {
  daily_sales: [{ date, inside_sales: 500, fuel_gallons_sold: 100, fuel_retail_price: 3.5, lottery_sales: 50, cash_total: 200, card_total: 300 }],
  pos_import_rows: [],
  cash_reconciliations: [{ id: "cash", date, expected_cash_sales: 200, ending_cash: 201, cash_over_short: 1, pos_card_total: 300, processor_card_total: 302, bank_deposit_amount: 200 }],
  fuel_entries: [],
  fuel_grades: [{ active: true }],
  fuel_reconciliations: [{ date, variance: 2 }],
  lottery_entries: [{ date, lottery_sales: 50 }],
  cash_flow_entries: [{ date, flow_type: "cash_deposit", match_status: "matched", amount: 200 }],
} as unknown as CommandCenterData;

const result = evaluateDailyClose(data, date, {
  cash_variance_threshold: 5,
  card_mismatch_threshold: 5,
  fuel_variance_threshold: 10,
});
assert.equal(result.summary.insideSales, 500);
assert.equal(result.summary.fuelSales, 350);
assert.equal(result.summary.cardMismatch, 2);
assert.equal(result.missingSteps.length, 0);
assert.equal(result.mismatches.length, 0);
assert.equal(result.canClose, true);

const broken = evaluateDailyClose({ ...data, cash_flow_entries: [] } as CommandCenterData, date, {
  cash_variance_threshold: 0,
  card_mismatch_threshold: 0,
  fuel_variance_threshold: 1,
});
assert.ok(broken.missingSteps.includes("Bank deposit match or pending override"));
assert.equal(broken.requiresOverride, true);
assert.equal(broken.canClose, false);

const override = { override_reason: "Manager verified pending bank settlement." } as DailyCloseStatus;
assert.equal(evaluateDailyClose({ ...data, cash_flow_entries: [] } as CommandCenterData, date, {
  cash_variance_threshold: 0,
  card_mismatch_threshold: 0,
  fuel_variance_threshold: 1,
}, override).canClose, true);

console.log("End-of-Day Close rules tests passed.");
