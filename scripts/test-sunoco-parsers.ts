import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseDepartmentSalesReport,
  parseStoreSalesSummaryReport,
} from "@/lib/sunoco-reports";

function closeTo(actual: number, expected: number, label: string) {
  const roundedActual = Number(actual.toFixed(2));
  const roundedExpected = Number(expected.toFixed(2));
  if (roundedActual !== roundedExpected) {
    throw new Error(`${label}: expected ${roundedExpected}, got ${roundedActual}`);
  }
}

function readFixture(name: string) {
  return readFileSync(resolve("samples/sunoco", name), "utf8");
}

const marchDepartment = parseDepartmentSalesReport(readFixture("department-sales-march.txt"));
const aprilDepartment = parseDepartmentSalesReport(readFixture("department-sales-april.txt"));
const aprilStoreSummary = parseStoreSalesSummaryReport(readFixture("store-sales-summary-april.txt"));

closeTo(
  marchDepartment.rows.reduce((total, row) => total + row.netSales, 0),
  70766.73,
  "March department net sales total",
);

closeTo(
  aprilDepartment.rows.reduce((total, row) => total + row.netSales, 0),
  74629.71,
  "April department net sales total",
);

closeTo(aprilStoreSummary.summary.totalFuelSalesDollars, 72214.67, "April total fuel sales");
closeTo(aprilStoreSummary.summary.totalNonFuelSales, 75135.55, "April total non fuel sales");
closeTo(aprilStoreSummary.summary.totalSales, 147555.01, "April total sales");

if (aprilStoreSummary.fuelGrades.length !== 3) {
  throw new Error(`Expected 3 fuel grade rows, got ${aprilStoreSummary.fuelGrades.length}`);
}

if (aprilStoreSummary.tenders.length < 4) {
  throw new Error(`Expected at least 4 tender rows, got ${aprilStoreSummary.tenders.length}`);
}

console.log("Sunoco parser tests passed.");
