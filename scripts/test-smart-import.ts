import assert from "node:assert/strict";
import {
  categorizeImportLine,
  parseDateLike,
  parseMoney,
  rowGrossProfit,
  rowGrossSales,
  rowMarginPercent,
} from "../src/lib/smart-import";
import type { LearnedCategorizationRules } from "../src/lib/types";

assert.equal(parseMoney("$1,234.56"), 1234.56, "currency strings should parse");
assert.equal(parseMoney("($87.40)"), -87.4, "accounting negatives should parse");
assert.equal(parseMoney("not a number"), 0, "invalid money should fall back to zero");
assert.equal(parseDateLike("7/4/26"), "2026-07-04", "US dates should normalize");
assert.equal(parseDateLike("2026/07/04"), "2026-07-04", "ISO-like dates should normalize");
assert.equal(parseDateLike("not a date"), null, "invalid dates should be rejected");

const baseLine = {
  rowIndex: 1,
  date: "2026-07-04",
  rawData: {},
};

for (const [description, category] of [
  ["Loan payment ACH", "Loan payment"],
  ["Owner draw", "Owner draw"],
  ["Account transfer", "Transfer"],
  ["Cash deposit", "Cash deposit"],
] as const) {
  const result = categorizeImportLine({ ...baseLine, description, total: 500 }, "bank csv");
  assert.equal(result.suggestedCategory, category, `${category} should be classified correctly`);
  assert.equal(result.importDestination, "cash_flow_entries", `${category} must not become an operating expense`);
  assert.equal(result.needsReview, false, `${category} should not require review`);
}

const missingDate = categorizeImportLine(
  { rowIndex: 2, description: "Eversource electric bill", total: 450, rawData: {} },
  "invoice csv",
);
assert.equal(missingDate.suggestedCategory, "Utilities");
assert.equal(missingDate.needsReview, true, "missing dates should require review");
assert.equal(missingDate.importDestination, "needs_review");

const learnedRules: LearnedCategorizationRules = {
  category_rules: [],
  vendor_rules: [{
    id: "vendor-rule",
    user_id: "user",
    store_id: "store",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    vendor_name: "Local Power",
    normalized_vendor: "local power",
    category: "Insurance",
    import_destination: "expenses",
    confidence_score: 100,
    usage_count: 3,
  }],
  product_rules: [],
};
const learned = categorizeImportLine(
  { ...baseLine, vendor: "Local Power", description: "electric utility", total: 250 },
  "invoice csv",
  learnedRules,
);
assert.equal(learned.suggestedCategory, "Insurance", "a learned exact vendor rule should override keyword rules");
assert.equal(learned.confidenceScore, 95);

const salesRow = { quantity: 10, unitCost: 1.25, unitRetailPrice: 2, total: 0 };
assert.equal(rowGrossSales(salesRow), 20, "gross sales should derive from quantity and retail price");
assert.equal(rowGrossProfit(salesRow), 7.5, "gross profit should subtract extended cost");
assert.equal(rowMarginPercent(salesRow), 37.5, "margin percent should use gross sales as denominator");
assert.equal(rowGrossSales({ ...salesRow, total: 25 }), 25, "an explicit total should take precedence");

console.log("Smart Import parser and classification tests passed.");
