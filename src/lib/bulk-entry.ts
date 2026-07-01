import type { BulkMonthlyEntry } from "@/lib/types";

export const bulkNumericFields = [
  "grocery_sales",
  "deli_sales",
  "hot_food_sales",
  "fuel_gallons_sold",
  "fuel_price_per_gallon",
  "fuel_cost_per_gallon",
  "lottery_sales",
  "beer_sales",
  "cigarette_sales",
  "other_sales",
  "cash_total",
  "card_total",
  "expenses",
  "payroll",
] as const;

export const bulkTemplateHeaders = [
  "date",
  ...bulkNumericFields,
  "notes",
] as const;

export type BulkRowIssue = {
  row: number;
  date: string;
  message: string;
};

export function monthDays(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return [];
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

export function emptyBulkEntry(date: string): BulkMonthlyEntry {
  return {
    date,
    grocery_sales: 0,
    deli_sales: 0,
    hot_food_sales: 0,
    fuel_gallons_sold: 0,
    fuel_price_per_gallon: 0,
    fuel_cost_per_gallon: 0,
    lottery_sales: 0,
    beer_sales: 0,
    cigarette_sales: 0,
    other_sales: 0,
    cash_total: 0,
    card_total: 0,
    expenses: 0,
    payroll: 0,
    notes: null,
  };
}

export function normalizeBulkNumber(value: unknown) {
  if (value == null || value === "") return 0;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function parseBulkCsvRecords(records: Record<string, unknown>[]) {
  return records.map((raw) => {
    const normalized = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [normalizeHeader(key), value]),
    );
    const entry = emptyBulkEntry(String(normalized.date ?? "").slice(0, 10));
    for (const field of bulkNumericFields) entry[field] = normalizeBulkNumber(normalized[field]);
    entry.notes = normalized.notes ? String(normalized.notes) : null;
    return entry;
  }).filter((entry) => entry.date);
}

function csvEscape(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export function createBulkTemplateCsv(month: string) {
  const rows = monthDays(month).map(emptyBulkEntry);
  return [
    bulkTemplateHeaders.join(","),
    ...rows.map((row) => bulkTemplateHeaders.map((field) => csvEscape(row[field])).join(",")),
  ].join("\n");
}

export function bulkTotalSales(entry: BulkMonthlyEntry) {
  return entry.grocery_sales + entry.deli_sales + entry.hot_food_sales + entry.lottery_sales +
    entry.beer_sales + entry.cigarette_sales + entry.other_sales;
}

export function bulkFuelMargin(entry: BulkMonthlyEntry) {
  return entry.fuel_price_per_gallon - entry.fuel_cost_per_gallon;
}

export function bulkFuelProfit(entry: BulkMonthlyEntry) {
  return entry.fuel_gallons_sold * bulkFuelMargin(entry);
}

export function bulkGrossProfit(entry: BulkMonthlyEntry) {
  const merchandiseSales = entry.grocery_sales + entry.beer_sales + entry.cigarette_sales + entry.other_sales;
  const foodSales = entry.deli_sales + entry.hot_food_sales;
  return bulkFuelProfit(entry) + entry.lottery_sales * 0.06 + foodSales * 0.55 + merchandiseSales * 0.28;
}

export function bulkNetProfitEstimate(entry: BulkMonthlyEntry) {
  return bulkGrossProfit(entry) - entry.expenses - entry.payroll;
}

function isValidIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function validateBulkRows(
  rows: BulkMonthlyEntry[],
  month: string,
  existingDates: ReadonlySet<string> = new Set<string>(),
) {
  const expectedDates = monthDays(month);
  const presentDates = new Set(rows.map((row) => row.date).filter(isValidIsoDate));
  const missingDates = expectedDates.filter((date) => !presentDates.has(date));
  const counts = rows.reduce<Record<string, number>>((dates, row) => {
    if (row.date) dates[row.date] = (dates[row.date] ?? 0) + 1;
    return dates;
  }, {});
  const duplicateDates = Object.entries(counts).filter(([, count]) => count > 1).map(([date]) => date).sort();
  const existingDuplicateDates = Array.from(new Set(
    rows.map((row) => row.date).filter((date) => isValidIsoDate(date) && existingDates.has(date)),
  )).sort();
  const issues: BulkRowIssue[] = [];
  const badNumberRows = new Set<number>();

  rows.forEach((row, index) => {
    if (!isValidIsoDate(row.date)) {
      issues.push({ row: index + 1, date: row.date || "Missing", message: "Invalid or missing date." });
    } else if (!row.date.startsWith(`${month}-`)) {
      issues.push({ row: index + 1, date: row.date, message: "Date is outside the selected month." });
    }

    for (const field of bulkNumericFields) {
      if (!Number.isFinite(row[field]) || row[field] < 0) {
        badNumberRows.add(index + 1);
        issues.push({ row: index + 1, date: row.date, message: `${field.replaceAll("_", " ")} must be a valid non-negative number.` });
      }
    }
  });

  missingDates.forEach((date) => issues.push({ row: 0, date, message: "Missing date for selected month." }));
  duplicateDates.forEach((date) => issues.push({ row: 0, date, message: "Duplicate date in current grid." }));

  return {
    issues,
    missingDates,
    badNumberRows: Array.from(badNumberRows),
    duplicateDates,
    existingDuplicateDates,
    blockingIssues: issues,
  };
}
