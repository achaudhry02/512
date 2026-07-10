import assert from "node:assert/strict";
import {
  bulkFuelMargin,
  bulkFuelProfit,
  bulkNetProfitEstimate,
  bulkTotalSales,
  createBulkTemplateCsv,
  emptyBulkEntry,
  monthDays,
  parseBulkCsvRecords,
  validateBulkRows,
} from "../src/lib/bulk-entry";
import { aggregateData, posPaymentBreakdown, posSalesBySource, rangesOverlap } from "../src/lib/calculations";
import {
  emptyMonthlyTotals,
  monthlyFuelMargin,
  monthlyFuelProfit,
  monthlyGrossMarginPercent,
  monthlyNetMarginPercent,
  monthlyNetProfit,
  monthlyTotalExpenses,
  monthlyTotalSales,
} from "../src/lib/monthly-totals";
import {
  defaultPosMappings,
  mapRowsToPosPreview,
  validatePosPreviewRows,
} from "../src/lib/pos-import";
import type { CommandCenterData, DailySale, MonthlyTotal, PosImportRow } from "../src/lib/types";

function closeTo(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${message}: expected ${expected}, got ${actual}`);
}

const entry = {
  ...emptyBulkEntry("2026-06-01"),
  grocery_sales: 1000,
  deli_sales: 200,
  hot_food_sales: 100,
  fuel_gallons_sold: 1000,
  fuel_price_per_gallon: 3.5,
  fuel_cost_per_gallon: 3.3,
  lottery_sales: 500,
  beer_sales: 300,
  cigarette_sales: 400,
  other_sales: 100,
  expenses: 250,
  payroll: 300,
};

assert.equal(bulkTotalSales(entry), 2600, "total sales should include every inside-sales category");
closeTo(bulkFuelMargin(entry), 0.2, "fuel margin");
closeTo(bulkFuelProfit(entry), 200, "fuel profit");
closeTo(bulkNetProfitEstimate(entry), 349, "net profit estimate");

const juneRows = monthDays("2026-06").map(emptyBulkEntry);
juneRows[1] = { ...juneRows[1], date: "2026-06-01" };
const duplicateValidation = validateBulkRows(juneRows, "2026-06", new Set(["2026-06-01"]));
assert.deepEqual(duplicateValidation.duplicateDates, ["2026-06-01"], "duplicate date should be reported once");
assert.deepEqual(duplicateValidation.missingDates, ["2026-06-02"], "replaced date should be reported missing");
assert.deepEqual(duplicateValidation.existingDuplicateDates, ["2026-06-01"], "saved duplicate should be detected");

const impossibleDate = validateBulkRows([emptyBulkEntry("2026-02-30")], "2026-02");
assert.ok(impossibleDate.issues.some((issue) => issue.message === "Invalid or missing date."), "impossible date should be invalid");

const parsedCsv = parseBulkCsvRecords([{ Date: "2026-06-01", "Grocery Sales": "$1,250.50", Notes: "Opening day" }]);
assert.equal(parsedCsv[0].grocery_sales, 1250.5, "CSV import should normalize headers and currency values");
assert.equal(parsedCsv[0].notes, "Opening day", "CSV import should preserve notes");
const template = createBulkTemplateCsv("2026-06");
assert.equal(template.split("\n").length, 31, "30-day template should contain one header plus 30 rows");
assert.ok(template.startsWith("date,grocery_sales"), "template should contain canonical headers");

assert.equal(rangesOverlap("2026-05-01", "2026-07-01", "2026-06-01", "2026-06-30"), true, "containing payroll range should overlap report range");

const monthlyTotals = {
  ...emptyMonthlyTotals(),
  year: 2026,
  month: 6,
  grocery_sales: 10000,
  deli_sales: 3000,
  hot_food_sales: 2000,
  fuel_gallons_sold: 10000,
  fuel_revenue: 35000,
  fuel_cost: 33000,
  lottery_sales: 5000,
  beer_sales: 4000,
  cigarette_sales: 6000,
  vape_nicotine_sales: 1500,
  other_sales: 2500,
  payroll: 5000,
  inventory_purchases: 8000,
  vendor_expenses: 2000,
  utilities: 1000,
  rent_mortgage: 3000,
  insurance: 500,
  repairs_maintenance: 400,
  miscellaneous_expenses: 600,
};
assert.equal(monthlyTotalSales(monthlyTotals), 69000, "monthly total sales should include fuel revenue and vape/nicotine");
assert.equal(monthlyTotalExpenses(monthlyTotals), 20500, "monthly total expenses should include payroll and expense buckets");
closeTo(monthlyFuelMargin(monthlyTotals), 0.2, "monthly fuel margin");
assert.equal(monthlyFuelProfit(monthlyTotals), 2000, "monthly fuel profit");
assert.equal(monthlyNetProfit(monthlyTotals), -8730, "monthly estimated net profit");
closeTo(monthlyGrossMarginPercent(monthlyTotals), 17.057971014492754, "monthly gross margin percent");
closeTo(monthlyNetMarginPercent(monthlyTotals), -12.652173913043478, "monthly net margin percent");

const dailySale = (date: string): DailySale => ({
  id: date, user_id: "user", store_id: "store", date,
  inside_sales: 1000, fuel_gallons_sold: 100, fuel_retail_price: 3.5, fuel_cost_per_gallon: 3.3,
  lottery_sales: 100, lottery_payouts: 0, deli_sales: 100, hot_food_sales: 0,
  cigarette_sales: 200, beer_sales: 200, grocery_sales: 300, other_sales: 100,
  cash_total: 500, card_total: 500, expenses: 0, payroll: 0, notes: null,
});

const aggregateFixture: CommandCenterData = {
  monthly_totals: [],
  cash_reconciliations: [],
  daily_sales: [dailySale("2026-06-01"), dailySale("2026-06-02")],
  fuel_entries: [{ id: "fuel", user_id: "user", store_id: "store", date: "2026-06-01", gallons_sold: 100, retail_price_per_gallon: 3.6, cost_per_gallon: 3.3, notes: null }],
  lottery_entries: [], deli_entries: [], expenses: [],
  payroll_entries: [{ id: "pay", user_id: "user", store_id: "store", employee_name: "Test", date_range_start: "2026-05-01", date_range_end: "2026-07-01", hours_worked: 10, hourly_rate: 20, notes: null }],
  pos_systems: [], pos_imports: [], pos_column_mappings: [], pos_import_rows: [],
  imports: [], import_rows: [], vendors: [], employees: [], product_categories: [], products: [], product_sales: [],
  department_sales: [], store_sales_summaries: [], fuel_grade_sales: [], tender_sales: [], category_rules: [], vendor_rules: [], product_rules: [],
};
const aggregate = aggregateData(aggregateFixture, "2026-06-01", "2026-06-30");
closeTo(aggregate.fuelProfit, 50, "tracked fuel should replace only the matching daily fallback");
assert.equal(aggregate.payrollCost, 200, "payroll spanning the report range should be included");

const savedMonthlyTotal: MonthlyTotal = {
  ...monthlyTotals,
  id: "monthly", user_id: "user", store_id: "store", notes: null,
};
const monthlyAggregate = aggregateData(
  { ...aggregateFixture, monthly_totals: [savedMonthlyTotal] },
  "2026-06-01",
  "2026-06-30",
);
assert.equal(monthlyAggregate.source, "monthly_totals", "monthly records should become the report source when present");
assert.equal(monthlyAggregate.dailySales.length, 0, "daily rows in a monthly-total month should be suppressed");
assert.equal(monthlyAggregate.totalRevenue, 69000, "monthly totals should drive report revenue");
assert.equal(monthlyAggregate.netProfit, -8730, "monthly totals should drive report net profit");

const posPreview = mapRowsToPosPreview(
  [
    {
      Date: "2026-06-03",
      "Transaction ID": "SQ-1",
      Category: "Grocery",
      Item: "Water",
      SKU: "W1",
      Qty: "2",
      "Gross Sales": "$5.00",
      Discounts: "0",
      Refunds: "0",
      "Net Sales": "5.00",
      Tax: "0.30",
      Cash: "5.30",
      Card: "0",
    },
    {
      Date: "2026-06-03",
      "Transaction ID": "SQ-1",
      Category: "Grocery",
      Item: "Water",
      SKU: "W1",
      Qty: "2",
      "Gross Sales": "$5.00",
      Discounts: "0",
      Refunds: "0",
      "Net Sales": "5.00",
      Tax: "0.30",
      Cash: "5.30",
      Card: "0",
    },
  ],
  defaultPosMappings.square,
  "square",
  "Square",
);
assert.equal(posPreview[0].date, "2026-06-03", "POS mapping should normalize dates");
assert.equal(posPreview[0].net_sales, 5, "POS mapping should parse currency numbers");
assert.ok(validatePosPreviewRows(posPreview).some((issue) => issue.includes("duplicate key")), "POS duplicate date/source/transaction validation should be reported");

const posRow: PosImportRow = {
  ...posPreview[0],
  id: "pos-row",
  user_id: "user",
  store_id: "store",
  pos_import_id: "pos-import",
};
const posAggregate = aggregateData(
  { ...aggregateFixture, pos_import_rows: [posRow] },
  "2026-06-01",
  "2026-06-30",
);
assert.equal(posAggregate.source, "daily_and_pos", "POS rows should mark daily reports as daily plus POS");
assert.equal(posAggregate.insideSales, aggregate.insideSales + 5, "POS net sales should be added to inside sales");
assert.deepEqual(posSalesBySource([posRow]), [{ name: "Square", sales: 5, rows: 1 }], "POS sales by source should aggregate imported rows");
assert.equal(posPaymentBreakdown([posRow]).Cash, 5.3, "POS payment breakdown should include cash totals");

console.log("Core calculation and bulk-entry validation tests passed.");
