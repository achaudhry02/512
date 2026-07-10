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
import {
  calculateCashReconciliation,
  expectedTenderTotalsForDate,
  reconciliationTotals,
  unreconciledDailySaleDates,
} from "../src/lib/cash-reconciliation";
import { aggregateData, posPaymentBreakdown, posSalesBySource, rangesOverlap } from "../src/lib/calculations";
import {
  calculateFuelReconciliation,
  fuelReconciliationTotals,
  soldGallonsForDate,
} from "../src/lib/fuel-reconciliation";
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
import { buildMenuExportCsv, inventoryInsights, productMarginPercent } from "../src/lib/inventory-operations";
import {
  defaultPosMappings,
  mapRowsToPosPreview,
  validatePosPreviewRows,
} from "../src/lib/pos-import";
import type { CashReconciliation, CommandCenterData, DailySale, FuelReconciliation, MonthlyTotal, PosImportRow, Product } from "../src/lib/types";

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
  fuel_grades: [],
  fuel_deliveries: [],
  fuel_tank_readings: [],
  fuel_reconciliations: [],
  margin_settings: [],
  lottery_entries: [], deli_entries: [], expenses: [],
  payroll_entries: [{ id: "pay", user_id: "user", store_id: "store", employee_name: "Test", date_range_start: "2026-05-01", date_range_end: "2026-07-01", hours_worked: 10, hourly_rate: 20, notes: null }],
  cash_flow_entries: [],
  pos_systems: [], pos_imports: [], pos_column_mappings: [], pos_import_rows: [],
  imports: [], import_rows: [], vendors: [], employees: [], product_categories: [], products: [], product_sales: [],
  purchase_orders: [], purchase_order_items: [], inventory_adjustments: [], price_history: [], vendor_item_costs: [],
  department_sales: [], store_sales_summaries: [], fuel_grade_sales: [], tender_sales: [], category_rules: [], vendor_rules: [], product_rules: [],
};
const aggregate = aggregateData(aggregateFixture, "2026-06-01", "2026-06-30");
closeTo(aggregate.fuelProfit, 50, "tracked fuel should replace only the matching daily fallback");
assert.equal(aggregate.payrollCost, 200, "payroll spanning the report range should be included");
assert.equal(aggregate.profitAccuracy, "estimated", "aggregate should label margin-only profit as estimated");

const marginAggregate = aggregateData({
  ...aggregateFixture,
  margin_settings: [
    { id: "m1", user_id: "user", store_id: "store", category: "grocery", gross_margin_percent: 50, notes: null },
    { id: "m2", user_id: "user", store_id: "store", category: "beer", gross_margin_percent: 10, notes: null },
    { id: "m3", user_id: "user", store_id: "store", category: "cigarettes", gross_margin_percent: 10, notes: null },
    { id: "m4", user_id: "user", store_id: "store", category: "other", gross_margin_percent: 10, notes: null },
    { id: "m5", user_id: "user", store_id: "store", category: "lottery", gross_margin_percent: 8, notes: null },
    { id: "m6", user_id: "user", store_id: "store", category: "deli", gross_margin_percent: 60, notes: null },
    { id: "m7", user_id: "user", store_id: "store", category: "hot_food", gross_margin_percent: 60, notes: null },
  ],
}, "2026-06-01", "2026-06-30");
assert.notEqual(marginAggregate.grossProfit, aggregate.grossProfit, "configured margins should change aggregate gross profit");

const inventoryProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "product-1", user_id: "user", store_id: "store", product_category_id: null, vendor_id: "vendor-1",
  name: "Bottled Water", sku_upc: "012345", category: "Drinks", unit_cost: 1, unit_retail_price: 2,
  quantity_on_hand: 2, reorder_level: 5, menu_export_enabled: true, menu_name: "Cold Bottled Water",
  menu_description: "20 oz bottle", menu_category: "Drinks", notes: null,
  ...overrides,
});
const inventoryProducts = [
  inventoryProduct(),
  inventoryProduct({ id: "product-2", name: "Slow Chips", sku_upc: "099999", quantity_on_hand: 10, reorder_level: 2, menu_export_enabled: false }),
];
const inventoryReport = inventoryInsights(
  inventoryProducts,
  [{ id: "sale-1", user_id: "user", store_id: "store", import_id: null, import_row_id: null, product_id: "product-1", vendor_id: "vendor-1", date: "2026-06-29", product_name: "Bottled Water", sku_upc: "012345", quantity_sold: 30, unit_cost: 1, unit_retail_price: 2, gross_sales: 60, gross_profit: 30, margin_percent: 50, category: "Drinks", vendor: "Vendor" }],
  [{ id: "adjustment-1", user_id: "user", store_id: "store", product_id: "product-1", purchase_order_id: null, adjustment_date: "2026-06-20", adjustment_type: "shrink", quantity_delta: -2, unit_cost: 1, reason: "Broken", notes: null, source_type: "manual", source_id: null }],
  [
    { id: "cost-1", user_id: "user", store_id: "store", vendor_id: "vendor-1", product_id: "product-1", purchase_order_id: null, purchase_order_item_id: null, effective_date: "2026-05-01", unit_cost: 0.8, source: "purchase_order" },
    { id: "cost-2", user_id: "user", store_id: "store", vendor_id: "vendor-1", product_id: "product-1", purchase_order_id: null, purchase_order_item_id: null, effective_date: "2026-06-01", unit_cost: 1, source: "purchase_order" },
  ],
  "2026-06-30",
);
assert.equal(productMarginPercent(inventoryProducts[0]), 50, "product margin should use retail revenue as the denominator");
assert.equal(inventoryReport.reorderSuggestions[0].suggestedQuantity, 12, "reorder suggestion should cover two weeks of recent demand");
assert.equal(inventoryReport.fastMovers[0].quantitySold30, 30, "fast movers should aggregate linked 30-day product sales");
assert.equal(inventoryReport.deadStock[0].product.id, "product-2", "products without recent sales should be dead stock");
assert.equal(inventoryReport.shrinkLoss.cost, 2, "shrink/loss should be valued at item cost");
closeTo(inventoryReport.costIncreases[0].increasePercent, 25, "vendor cost increases should compare the two latest costs");
const menuCsv = buildMenuExportCsv(inventoryProducts);
assert.ok(menuCsv.includes("Cold Bottled Water"), "menu export should include selected products");
assert.ok(!menuCsv.includes("Slow Chips"), "menu export should exclude unselected products");

const cashMath = calculateCashReconciliation({
  starting_cash: 500,
  ending_cash: 1225,
  expected_cash_sales: 1000,
  cash_drops: 200,
  paid_outs: 50,
  lottery_payouts: 25,
  pos_card_total: 800,
  processor_card_total: 798,
  bank_deposit_amount: 190,
  status: "needs_review",
});
assert.equal(cashMath.expectedEndingCash, 1225, "cash reconciliation should calculate expected ending cash");
assert.equal(cashMath.variance, 0, "cash reconciliation should calculate cash over/short variance");
assert.equal(cashMath.cardVariance, -2, "cash reconciliation should calculate card batch mismatch");
assert.equal(cashMath.depositVariance, -10, "cash reconciliation should calculate deposit mismatch against drops");
assert.equal(cashMath.isBalanced, false, "card mismatch over threshold should require review");

const cashPosRow: PosImportRow = {
  id: "pos-cash",
  user_id: "user",
  store_id: "store",
  pos_import_id: "import",
  pos_key: "square",
  pos_name: "Square",
  row_index: 1,
  row_hash: "hash",
  transaction_id: "txn",
  date: "2026-06-02",
  department_category: "Grocery",
  item_name: "Basket",
  sku_barcode: null,
  quantity_sold: 1,
  gross_sales: 250,
  discounts: 0,
  refunds: 0,
  voids: 0,
  net_sales: 250,
  tax: 0,
  fees: 0,
  cash_total: 40,
  card_total: 200,
  ebt_total: 10,
  gift_card_total: 5,
  other_payment_total: 2,
  fuel_gallons: 0,
  fuel_sales: 0,
  fuel_cost: 0,
  lottery_sales: 0,
  vendor_category_notes: null,
  duplicate_key: "square|2026-06-02|txn",
  import_action: "import",
  validation_errors: [],
  raw_data: {},
};
const expectedTender = expectedTenderTotalsForDate("2026-06-02", aggregateFixture.daily_sales, [cashPosRow]);
assert.equal(expectedTender.expected_cash_sales, 40, "POS cash should override daily-sale cash when available");
assert.equal(expectedTender.pos_card_total, 200, "POS card should override daily-sale card when available");
assert.equal(expectedTender.ebt_total, 10, "POS EBT should be included in expected tenders");

const reconciled: CashReconciliation = {
  id: "recon",
  user_id: "user",
  store_id: "store",
  date: "2026-06-01",
  starting_cash: 500,
  ending_cash: 1225,
  expected_cash_sales: 1000,
  cash_drops: 200,
  paid_outs: 50,
  lottery_payouts: 25,
  cash_over_short: 0,
  pos_card_total: 800,
  processor_card_total: 798,
  ebt_total: 0,
  gift_card_total: 0,
  other_tender_total: 0,
  bank_deposit_amount: 190,
  status: "needs_review",
  notes: null,
};
assert.deepEqual(unreconciledDailySaleDates(aggregateFixture.daily_sales, [reconciled]), ["2026-06-02"], "unreconciled days should exclude saved reconciliation dates");
assert.equal(reconciliationTotals([reconciled]).needsReview, 1, "reconciliation totals should count review items");

const fuelMath = calculateFuelReconciliation({
  beginning_gallons: 8000,
  delivered_gallons: 7000,
  sold_gallons: 2500,
  ending_gallons: 12480,
  actual_inventory: 12480,
  rack_cost_per_gallon: 3.1,
  retail_price_per_gallon: 3.39,
  target_margin: 0.25,
}, 15);
assert.equal(fuelMath.bookInventory, 12500, "fuel reconciliation should calculate book inventory");
assert.equal(fuelMath.variance, -20, "fuel reconciliation should calculate tank variance");
assert.equal(fuelMath.isVarianceAlert, true, "fuel variance above threshold should alert");
closeTo(fuelMath.actualMargin, 0.29, "fuel reconciliation should calculate actual margin");
closeTo(fuelMath.suggestedPrice, 3.35, "fuel reconciliation should calculate suggested price");

assert.deepEqual(
  soldGallonsForDate("2026-06-02", aggregateFixture.fuel_entries, [cashPosRow]),
  { source: "Manual fuel entries", gallons: 0 },
  "sold gallons should fall back to manual entries when POS fuel gallons are absent",
);
const fuelPosRow = { ...cashPosRow, id: "fuel-pos", fuel_gallons: 3200, fuel_sales: 10848, fuel_cost: 9920 };
assert.deepEqual(
  soldGallonsForDate("2026-06-02", aggregateFixture.fuel_entries, [fuelPosRow]),
  { source: "POS imports", gallons: 3200 },
  "sold gallons should prefer POS fuel gallons when available",
);

const fuelReconciliation: FuelReconciliation = {
  id: "fuel-recon",
  user_id: "user",
  store_id: "store",
  date: "2026-06-02",
  fuel_grade_id: "regular",
  grade_name: "Regular",
  beginning_gallons: 8000,
  delivered_gallons: 7000,
  sold_gallons: 2500,
  ending_gallons: 12480,
  actual_inventory: 12480,
  rack_cost_per_gallon: 3.1,
  retail_price_per_gallon: 3.2,
  target_margin: 0.2,
  notes: null,
};
assert.equal(fuelReconciliationTotals([fuelReconciliation]).alertCount, 0, "default threshold should not alert for 20 gallons");
assert.equal(fuelReconciliationTotals([fuelReconciliation]).lowMarginCount, 1, "fuel reconciliation totals should count low margin grades");

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
