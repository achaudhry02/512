import assert from "node:assert/strict";
import {
  defaultPosMappings,
  mapRowsToPosPreview,
  planPosDuplicateImport,
} from "../src/lib/pos-import";

const rows = mapRowsToPosPreview(
  [
    { date: "2026-07-01", transaction_id: "TX-1", department_category: "Grocery", net_sales: "25.00" },
    { date: "2026-07-01", transaction_id: "TX-2", department_category: "Fuel", net_sales: "50.00" },
    { date: "2026-07-01", transaction_id: "TX-3", department_category: "Deli", net_sales: "15.00" },
  ],
  defaultPosMappings.generic,
  "generic",
  "Generic POS CSV",
);

const existing = new Set([rows[0].duplicate_key, rows[1].duplicate_key]);
const skipPlan = planPosDuplicateImport(rows, existing, "skip");
assert.equal(skipPlan.candidateRows.length, 3);
assert.deepEqual(skipPlan.rowsToSave.map((row) => row.transaction_id), ["TX-3"], "skip should retain only new rows");
assert.deepEqual(skipPlan.duplicateKeysToDelete, [], "skip must not delete existing data");

const overwritePlan = planPosDuplicateImport(rows, existing, "overwrite");
assert.equal(overwritePlan.rowsToSave.length, 3, "overwrite should save both existing and new rows");
assert.deepEqual(
  overwritePlan.duplicateKeysToDelete,
  rows.map((row) => row.duplicate_key),
  "overwrite should clear every key that will be replaced",
);

const explicitlySkippedRows = rows.map((row, index) => index === 2 ? { ...row, import_action: "skip" as const } : row);
const explicitSkipPlan = planPosDuplicateImport(explicitlySkippedRows, existing, "overwrite");
assert.equal(explicitSkipPlan.rowsToSave.length, 2, "explicitly skipped rows should stay excluded during overwrite");

console.log("POS duplicate skip and overwrite tests passed.");
