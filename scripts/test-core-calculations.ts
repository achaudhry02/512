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
import { aggregateData, rangesOverlap } from "../src/lib/calculations";
import type { CommandCenterData, DailySale } from "../src/lib/types";

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

const dailySale = (date: string): DailySale => ({
  id: date, user_id: "user", store_id: "store", date,
  inside_sales: 1000, fuel_gallons_sold: 100, fuel_retail_price: 3.5, fuel_cost_per_gallon: 3.3,
  lottery_sales: 100, lottery_payouts: 0, deli_sales: 100, hot_food_sales: 0,
  cigarette_sales: 200, beer_sales: 200, grocery_sales: 300, other_sales: 100,
  cash_total: 500, card_total: 500, expenses: 0, payroll: 0, notes: null,
});

const aggregateFixture: CommandCenterData = {
  daily_sales: [dailySale("2026-06-01"), dailySale("2026-06-02")],
  fuel_entries: [{ id: "fuel", user_id: "user", store_id: "store", date: "2026-06-01", gallons_sold: 100, retail_price_per_gallon: 3.6, cost_per_gallon: 3.3, notes: null }],
  lottery_entries: [], deli_entries: [], expenses: [],
  payroll_entries: [{ id: "pay", user_id: "user", store_id: "store", employee_name: "Test", date_range_start: "2026-05-01", date_range_end: "2026-07-01", hours_worked: 10, hourly_rate: 20, notes: null }],
  imports: [], import_rows: [], vendors: [], employees: [], product_categories: [], products: [], product_sales: [],
  department_sales: [], store_sales_summaries: [], fuel_grade_sales: [], tender_sales: [], category_rules: [], vendor_rules: [], product_rules: [],
};
const aggregate = aggregateData(aggregateFixture, "2026-06-01", "2026-06-30");
closeTo(aggregate.fuelProfit, 50, "tracked fuel should replace only the matching daily fallback");
assert.equal(aggregate.payrollCost, 200, "payroll spanning the report range should be included");

console.log("Core calculation and bulk-entry validation tests passed.");
