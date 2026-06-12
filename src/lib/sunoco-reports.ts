import { parseDateLike, parseMoney, parseQuantity } from "@/lib/smart-import";
import type {
  ParsedDepartmentSaleRow,
  ParsedFuelGradeSaleRow,
  ParsedStoreSalesSummary,
  ParsedTenderSaleRow,
} from "@/lib/types";

export type SunocoDepartmentSalesParseResult = {
  reportStartDate: string | null;
  reportEndDate: string | null;
  rows: ParsedDepartmentSaleRow[];
};

export type SunocoStoreSalesSummaryParseResult = {
  reportStartDate: string | null;
  reportEndDate: string | null;
  summary: ParsedStoreSalesSummary;
  fuelGrades: ParsedFuelGradeSaleRow[];
  tenders: ParsedTenderSaleRow[];
};

const moneyPattern = String.raw`-?\$[\d,]+\.\d{2}`;
const countPattern = String.raw`[\d,]+`;
const percentPattern = String.raw`-?[\d.]+%`;
const departmentRowRegex = new RegExp(
  String.raw`^(.+?)\s+(${moneyPattern})\s+(${countPattern})\s+(${countPattern})\s+(${countPattern})\s+(${moneyPattern})\s+(${moneyPattern})\s+(${moneyPattern})\s+(${percentPattern})$`,
  "i",
);
const fuelGradeRegex = new RegExp(
  String.raw`^Grade\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{3})\s+(${moneyPattern})\s+(${percentPattern})$`,
  "i",
);

function normalizedLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parsePercent(value: string) {
  return Number(value.replace("%", "")) || 0;
}

function parseCount(value: string) {
  return Number(value.replace(/,/g, "")) || 0;
}

function parseReportPeriod(text: string) {
  const dateLike = String.raw`(?:\d{1,2}[-/]\d{1,2}[-/](?:\d{2}|\d{4})|(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2})`;
  const patterns = [
    new RegExp(String.raw`(?:Report\s+Period|Period|Date\s+Range)\s*:?\s*(${dateLike})\s*(?:-|to|through)\s*(${dateLike})`, "i"),
    new RegExp(String.raw`From\s*:?\s*(${dateLike})\s*(?:-|to)\s*(?:To\s*:?\s*)?(${dateLike})`, "i"),
    new RegExp(String.raw`(${dateLike})\s*(?:-|to|through)\s*(${dateLike})`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        reportStartDate: parseDateLike(match[1]),
        reportEndDate: parseDateLike(match[2]),
      };
    }
  }

  return {
    reportStartDate: null,
    reportEndDate: null,
  };
}

export function isDepartmentSalesReport(text: string) {
  return (
    text.includes("Department Sales Report") &&
    text.includes("Dept. Name") &&
    text.includes("Gross Sales") &&
    text.includes("Net Sales") &&
    text.includes("%of Sales")
  );
}

export function isStoreSalesSummaryReport(text: string) {
  return (
    text.includes("Store Sales Summary Report") &&
    text.includes("Fuel Sales") &&
    text.includes("Store Tender Reading")
  );
}

export function parseDepartmentSalesReport(text: string): SunocoDepartmentSalesParseResult {
  const rows: ParsedDepartmentSaleRow[] = [];

  for (const line of normalizedLines(text)) {
    const match = line.match(departmentRowRegex);
    if (!match) {
      continue;
    }

    rows.push({
      departmentName: match[1].trim(),
      grossSales: parseMoney(match[2]),
      itemCount: parseCount(match[3]),
      refundCount: parseCount(match[4]),
      netCount: parseCount(match[5]),
      refundAmount: parseMoney(match[6]),
      discountAmount: parseMoney(match[7]),
      netSales: parseMoney(match[8]),
      percentOfSales: parsePercent(match[9]),
    });
  }

  if (!rows.length) {
    throw new Error("Department Sales Report detected, but no department rows matched the expected fixed-width format.");
  }

  return {
    ...parseReportPeriod(text),
    rows,
  };
}

function parseLabeledMoney(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?[\\s\\S]{0,80}?(${moneyPattern})`, "i");
    const match = text.match(pattern);
    if (match) {
      return parseMoney(match[1]);
    }
  }

  return 0;
}

function parseLabeledQuantity(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?[\\s\\S]{0,80}?([\\d,]+\\.\\d{3}|[\\d,]+)`, "i");
    const match = text.match(pattern);
    if (match) {
      return parseQuantity(match[1]);
    }
  }

  return 0;
}

function parseFuelGrades(lines: string[]) {
  const rows: ParsedFuelGradeSaleRow[] = [];

  for (const line of lines) {
    const match = line.match(fuelGradeRegex);
    if (!match) {
      continue;
    }

    rows.push({
      grade: match[1],
      gradeName: match[2].trim(),
      volume: parseQuantity(match[3]),
      sales: parseMoney(match[4]),
      percentOfTotalFuelSales: parsePercent(match[5]),
    });
  }

  return rows;
}

function parseTenderRows(lines: string[]) {
  const rows: ParsedTenderSaleRow[] = [];
  const tenderSectionStart = lines.findIndex((line) => /Store Tender Reading/i.test(line));
  const section = tenderSectionStart >= 0 ? lines.slice(tenderSectionStart + 1) : lines;
  const tenderRegex = new RegExp(String.raw`^([A-Za-z][A-Za-z ]*?)\s+(?:(\d[\d,]*)|${moneyPattern})?\s*(${moneyPattern})$`);

  for (const line of section) {
    const match = line.match(tenderRegex);
    if (!match) {
      continue;
    }

    const paymentMethod = match[1].trim();
    if (/^(total|subtotal|change|drawer|over|short)$/i.test(paymentMethod)) {
      continue;
    }

    rows.push({
      paymentMethod,
      count: match[2] ? parseCount(match[2]) : 0,
      salesAmount: parseMoney(match[3]),
    });
  }

  return rows;
}

export function parseStoreSalesSummaryReport(text: string): SunocoStoreSalesSummaryParseResult {
  const lines = normalizedLines(text);
  const fuelGrades = parseFuelGrades(lines);
  const tenders = parseTenderRows(lines);
  const totalFuelSalesDollars =
    parseLabeledMoney(text, ["Total Fuel Sales", "Fuel Sales Dollars", "Fuel Sales"]) ||
    fuelGrades.reduce((total, grade) => total + grade.sales, 0);

  const summary: ParsedStoreSalesSummary = {
    grandTotalStoreSales: parseLabeledMoney(text, ["Grand Total Store Sales", "Grand Total"]),
    totalFuelSalesVolume:
      parseLabeledQuantity(text, ["Total Fuel Sales Volume", "Fuel Sales Volume", "Total Fuel Volume"]) ||
      fuelGrades.reduce((total, grade) => total + grade.volume, 0),
    totalFuelSalesDollars,
    fuelDiscounts: parseLabeledMoney(text, ["Fuel Discounts", "Fuel Discount"]),
    totalNonFuelSales: parseLabeledMoney(text, ["Total Non Fuel Sales", "Non Fuel Sales", "Non-Fuel Sales"]),
    otherDiscounts: parseLabeledMoney(text, ["Other Discounts", "Other Discount"]),
    totalTaxesCollected: parseLabeledMoney(text, ["Total Taxes Collected", "Taxes Collected", "Total Tax"]),
    totalSales: parseLabeledMoney(text, ["Total Sales"]),
    totalRevenue: parseLabeledMoney(text, ["Total Revenue"]),
    networkRevenue: parseLabeledMoney(text, ["Network Revenue"]),
  };

  if (!fuelGrades.length && !summary.totalFuelSalesDollars && !summary.totalSales) {
    throw new Error("Store Sales Summary Report detected, but fuel grades and summary totals could not be parsed.");
  }

  return {
    ...parseReportPeriod(text),
    summary,
    fuelGrades,
    tenders,
  };
}
