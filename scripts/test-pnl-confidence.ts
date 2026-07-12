import assert from "node:assert/strict";
import { calculatePnlConfidence } from "../src/lib/pnl-confidence";
import type { CommandCenterData } from "../src/lib/types";

const dates = ["2026-07-09", "2026-07-10"];
const complete = {
  daily_close_statuses: dates.map((date) => ({ date, status: "closed" })),
  daily_sales: dates.map((date) => ({ date })),
  pos_import_rows: [],
  cash_reconciliations: dates.map((date) => ({ date, status: "balanced" })),
  cash_flow_entries: [
    { date: dates[0], flow_type: "card_processor_deposit", match_status: "matched" },
    { date: dates[1], flow_type: "cash_deposit", match_status: "matched" },
  ],
  import_rows: [],
  fuel_grades: [{ active: true }],
  fuel_reconciliations: dates.map((date) => ({ date })),
  products: [{ unit_cost: 1 }, { unit_cost: 2 }],
} as unknown as CommandCenterData;

const high = calculatePnlConfidence(complete, dates[0], dates[1], false);
assert.equal(high.score, 100);
assert.equal(high.label, "High confidence");
assert.equal(high.missingItems.length, 0);

const estimated = calculatePnlConfidence({
  ...complete,
  daily_close_statuses: [],
  cash_reconciliations: [],
  cash_flow_entries: [{ date: dates[0], flow_type: "card_processor_deposit", match_status: "unmatched" }],
  fuel_reconciliations: [],
  products: [{ unit_cost: 0 }],
} as unknown as CommandCenterData, dates[0], dates[1], true);
assert.ok(estimated.score < 40);
assert.equal(estimated.label, "Needs review");
assert.ok(estimated.missingItems.some((item) => item.includes("Estimated margins")));

console.log("P&L confidence tests passed.");
