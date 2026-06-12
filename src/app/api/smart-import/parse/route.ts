import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import {
  categorizeImportLine,
  parseDateLike,
  parseMoney,
  parseQuantity,
  type RawImportLine,
} from "@/lib/smart-import";
import {
  isDepartmentSalesReport,
  isStoreSalesSummaryReport,
  parseDepartmentSalesReport,
  parseStoreSalesSummaryReport,
} from "@/lib/sunoco-reports";
import type { LearnedCategorizationRules, ParsedImportResult, ParsedImportRow } from "@/lib/types";

export const runtime = "nodejs";

const supportedExtensions = [".pdf", ".csv", ".xlsx", ".xls"];

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function hashRow(fileHash: string, rowIndex: number, rawData: Record<string, unknown>) {
  return createHash("sha256")
    .update(`${fileHash}:${rowIndex}:${JSON.stringify(rawData)}`)
    .digest("hex");
}

function extensionFor(fileName: string) {
  const lower = fileName.toLowerCase();
  return supportedExtensions.find((extension) => lower.endsWith(extension)) ?? "";
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pickValue(row: Record<string, unknown>, candidates: string[]) {
  const entries = Object.entries(row);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate);
    const entry = entries.find(([key]) => normalizeKey(key).includes(normalizedCandidate));
    if (entry && entry[1] != null && String(entry[1]).trim() !== "") {
      return entry[1];
    }
  }

  return "";
}

function rawRecordToLine(row: Record<string, unknown>, rowIndex: number): RawImportLine {
  const columnNames = Object.keys(row);
  const productName = String(
    pickValue(row, ["product name", "product", "item name", "item", "sku description", "article"]) ||
      pickValue(row, ["description", "memo", "details"]),
  ).trim();
  const description = String(
    pickValue(row, ["description", "memo", "details", "transaction", "line item", "name"]) || productName,
  ).trim();
  const quantity = parseQuantity(pickValue(row, ["quantity sold", "qty sold", "quantity", "qty", "units", "gallons", "hours"]));
  const unitCost = parseMoney(pickValue(row, ["unit cost", "cost each", "cost", "wholesale", "fuel cost", "hourly rate"]));
  const unitRetailPrice = parseMoney(pickValue(row, ["unit retail", "unit price", "retail price", "price", "sell price", "rate"]));
  const total = parseMoney(pickValue(row, ["gross sales", "total sales", "total", "amount", "extended", "net amount", "debit", "credit"]));

  return {
    rowIndex,
    date: parseDateLike(pickValue(row, ["date", "transaction date", "invoice date", "posted date", "week ending"])),
    vendor: String(pickValue(row, ["vendor", "supplier", "merchant", "payee", "name"]) || "").trim(),
    description,
    productName,
    skuUpc: String(pickValue(row, ["sku", "upc", "barcode", "item number", "product code"]) || "").trim(),
    quantity,
    unitCost,
    unitRetailPrice,
    total,
    rawData: row,
    columnNames,
  };
}

function inferVendorFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(invoice|statement|report|export|sales|payroll|fuel|lottery)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDelimitedPdfLine(line: string, rowIndex: number, fileName: string): RawImportLine | null {
  const date = parseDateLike(line);
  const moneyMatches = [...line.matchAll(/(?:\$?\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?|\$?\(?-?\d+\.\d{2}\)?)/g)];
  const total = moneyMatches.length ? parseMoney(moneyMatches[moneyMatches.length - 1][0]) : 0;
  const hasUsefulContent = line.replace(/[\d$.,/\-()]/g, "").trim().length > 5;

  if (!hasUsefulContent && !total) {
    return null;
  }

  const cleanedDescription = line
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/](?:\d{2}|\d{4})\b/, "")
    .replace(/\b(?:20\d{2}|19\d{2})[-/]\d{1,2}[-/]\d{1,2}\b/, "")
    .replace(/(?:\$?\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?|\$?\(?-?\d+\.\d{2}\)?)\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const rawData = {
    source_line: line,
    extracted_date: date,
    extracted_total: total,
  };

  return {
    rowIndex,
    date,
    vendor: inferVendorFromFileName(fileName),
    description: cleanedDescription || line,
    productName: cleanedDescription || "",
    skuUpc: "",
    quantity: 0,
    unitCost: 0,
    unitRetailPrice: 0,
    total,
    rawData,
    columnNames: ["source_line", "extracted_date", "extracted_total"],
  };
}

function buildParsedRow(
  line: RawImportLine,
  fileType: string,
  fileHash: string,
  learnedRules?: LearnedCategorizationRules,
): ParsedImportRow {
  const category = categorizeImportLine(line, fileType, learnedRules);
  const suggestedCategory = line.suggestedCategory ?? category.suggestedCategory;
  const confidenceScore = line.confidenceScore ?? category.confidenceScore;
  const importDestination = line.importDestination ?? category.importDestination;
  const needsReview = line.needsReview ?? category.needsReview;

  return {
    rowIndex: line.rowIndex,
    rowHash: hashRow(fileHash, line.rowIndex, line.rawData),
    date: line.date ?? null,
    vendor: line.vendor ?? "",
    description: line.description ?? "",
    productName: line.productName ?? "",
    skuUpc: line.skuUpc ?? "",
    quantity: line.quantity ?? 0,
    unitCost: line.unitCost ?? 0,
    unitRetailPrice: line.unitRetailPrice ?? 0,
    total: line.total ?? 0,
    suggestedCategory,
    originalSuggestedCategory: suggestedCategory,
    confidenceScore,
    importDestination,
    needsReview,
    ignored: false,
    rawData: line.rawData,
  };
}

function rawTextPreview(text: string) {
  return text.slice(0, 12000);
}

function departmentRowsToRawLines(text: string) {
  const parsed = parseDepartmentSalesReport(text);

  return {
    reportType: "department_sales" as const,
    reportStartDate: parsed.reportStartDate,
    reportEndDate: parsed.reportEndDate,
    departmentSalesRows: parsed.rows,
    rawLines: parsed.rows.map<RawImportLine>((row, index) => ({
      rowIndex: index + 1,
      date: parsed.reportEndDate ?? parsed.reportStartDate,
      vendor: "Sunoco POS",
      description: `Department Sales: ${row.departmentName}`,
      productName: row.departmentName,
      skuUpc: "",
      quantity: row.netCount,
      unitCost: 0,
      unitRetailPrice: 0,
      total: row.netSales,
      suggestedCategory: "Other",
      importDestination: "department_sales",
      confidenceScore: 95,
      needsReview: false,
      rawData: {
        report_type: "department_sales",
        department_name: row.departmentName,
        gross_sales: row.grossSales,
        item_count: row.itemCount,
        refund_count: row.refundCount,
        net_count: row.netCount,
        refund_amount: row.refundAmount,
        discount_amount: row.discountAmount,
        net_sales: row.netSales,
        percent_of_sales: row.percentOfSales,
      },
      columnNames: ["department_name", "gross_sales", "item_count", "refund_count", "net_count", "refund_amount", "discount_amount", "net_sales", "percent_of_sales"],
    })),
  };
}

function storeSummaryToRawLines(text: string) {
  const parsed = parseStoreSalesSummaryReport(text);
  const rawLines: RawImportLine[] = [
    {
      rowIndex: 1,
      date: parsed.reportEndDate ?? parsed.reportStartDate,
      vendor: "Sunoco POS",
      description: "Store Sales Summary",
      productName: "Store Sales Summary",
      skuUpc: "",
      quantity: 0,
      unitCost: 0,
      unitRetailPrice: 0,
      total: parsed.summary.totalSales,
      suggestedCategory: "Other",
      importDestination: "store_sales_summaries",
      confidenceScore: 95,
      needsReview: false,
      rawData: {
        report_type: "store_sales_summary",
        ...parsed.summary,
      },
      columnNames: ["grand_total_store_sales", "total_fuel_sales_volume", "total_fuel_sales_dollars", "fuel_discounts", "total_non_fuel_sales", "other_discounts", "total_taxes_collected", "total_sales", "total_revenue", "network_revenue"],
    },
    ...parsed.fuelGrades.map<RawImportLine>((row, index) => ({
      rowIndex: index + 2,
      date: parsed.reportEndDate ?? parsed.reportStartDate,
      vendor: "Sunoco POS",
      description: `Fuel Grade ${row.grade} ${row.gradeName}`,
      productName: row.gradeName,
      skuUpc: row.grade,
      quantity: row.volume,
      unitCost: 0,
      unitRetailPrice: row.volume > 0 ? row.sales / row.volume : 0,
      total: row.sales,
      suggestedCategory: "Fuel purchase",
      importDestination: "fuel_grade_sales",
      confidenceScore: 95,
      needsReview: false,
      rawData: {
        report_type: "fuel_grade_sales",
        grade: row.grade,
        grade_name: row.gradeName,
        volume: row.volume,
        sales: row.sales,
        percent_of_total_fuel_sales: row.percentOfTotalFuelSales,
      },
      columnNames: ["grade", "grade_name", "volume", "sales", "percent_of_total_fuel_sales"],
    })),
    ...parsed.tenders.map<RawImportLine>((row, index) => ({
      rowIndex: index + 2 + parsed.fuelGrades.length,
      date: parsed.reportEndDate ?? parsed.reportStartDate,
      vendor: "Sunoco POS",
      description: `Tender ${row.paymentMethod}`,
      productName: row.paymentMethod,
      skuUpc: "",
      quantity: row.count,
      unitCost: 0,
      unitRetailPrice: 0,
      total: row.salesAmount,
      suggestedCategory: "Other",
      importDestination: "tender_sales",
      confidenceScore: 95,
      needsReview: false,
      rawData: {
        report_type: "tender_sales",
        payment_method: row.paymentMethod,
        count: row.count,
        sales_amount: row.salesAmount,
      },
      columnNames: ["payment_method", "count", "sales_amount"],
    })),
  ];

  return {
    reportType: "store_sales_summary" as const,
    reportStartDate: parsed.reportStartDate,
    reportEndDate: parsed.reportEndDate,
    storeSalesSummary: parsed.summary,
    fuelGradeSalesRows: parsed.fuelGrades,
    tenderSalesRows: parsed.tenders,
    rawLines,
  };
}

async function parsePdf(buffer: Buffer, fileName: string) {
  const warnings: string[] = [];

  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const lines = parsed.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (isDepartmentSalesReport(parsed.text)) {
      try {
        return {
          ...departmentRowsToRawLines(parsed.text),
          warnings,
          parser: "sunoco-department-sales" as const,
          parserAttempted: "Sunoco Department Sales Report",
          rawTextPreview: rawTextPreview(parsed.text),
        };
      } catch (error) {
        return {
          rawLines: [
            {
              rowIndex: 1,
              date: null,
              vendor: "Sunoco POS",
              description: "Department Sales Report parsing failed. Needs Review.",
              productName: "",
              skuUpc: "",
              quantity: 0,
              unitCost: 0,
              unitRetailPrice: 0,
              total: 0,
              suggestedCategory: "Other",
              importDestination: "needs_review",
              confidenceScore: 0,
              needsReview: true,
              rawData: {
                error: error instanceof Error ? error.message : "Unknown Department Sales parser error",
              },
              columnNames: ["error"],
            } satisfies RawImportLine,
          ],
          warnings: ["Department Sales Report parser failed. Review raw text in the debug box."],
          parser: "sunoco-department-sales" as const,
          parserAttempted: "Sunoco Department Sales Report",
          parseError: error instanceof Error ? error.message : "Unknown Department Sales parser error",
          rawTextPreview: rawTextPreview(parsed.text),
        };
      }
    }

    if (isStoreSalesSummaryReport(parsed.text)) {
      try {
        return {
          ...storeSummaryToRawLines(parsed.text),
          warnings,
          parser: "sunoco-store-sales-summary" as const,
          parserAttempted: "Sunoco Store Sales Summary Report",
          rawTextPreview: rawTextPreview(parsed.text),
        };
      } catch (error) {
        return {
          rawLines: [
            {
              rowIndex: 1,
              date: null,
              vendor: "Sunoco POS",
              description: "Store Sales Summary Report parsing failed. Needs Review.",
              productName: "",
              skuUpc: "",
              quantity: 0,
              unitCost: 0,
              unitRetailPrice: 0,
              total: 0,
              suggestedCategory: "Other",
              importDestination: "needs_review",
              confidenceScore: 0,
              needsReview: true,
              rawData: {
                error: error instanceof Error ? error.message : "Unknown Store Sales Summary parser error",
              },
              columnNames: ["error"],
            } satisfies RawImportLine,
          ],
          warnings: ["Store Sales Summary parser failed. Review raw text in the debug box."],
          parser: "sunoco-store-sales-summary" as const,
          parserAttempted: "Sunoco Store Sales Summary Report",
          parseError: error instanceof Error ? error.message : "Unknown Store Sales Summary parser error",
          rawTextPreview: rawTextPreview(parsed.text),
        };
      }
    }

    const rawLines = lines
      .map((line, index) => parseDelimitedPdfLine(line, index + 1, fileName))
      .filter((line): line is RawImportLine => Boolean(line));

    if (!rawLines.length) {
      warnings.push("PDF text extraction did not identify clear line items. Rows may need manual review.");
      rawLines.push({
        rowIndex: 1,
        date: null,
        vendor: inferVendorFromFileName(fileName),
        description: parsed.text.slice(0, 500) || "Unclear PDF extraction",
        productName: "",
        skuUpc: "",
        quantity: 0,
        unitCost: 0,
        unitRetailPrice: 0,
        total: 0,
        rawData: { text_preview: parsed.text.slice(0, 1000) },
        columnNames: ["text_preview"],
      });
    }

    return {
      rawLines,
      warnings,
      parser: "pdf-parse" as const,
      parserAttempted: "Generic PDF parser",
      rawTextPreview: rawTextPreview(parsed.text),
    };
  } catch (error) {
    return {
      rawLines: [
        {
          rowIndex: 1,
          date: null,
          vendor: inferVendorFromFileName(fileName),
          description: "PDF extraction failed. Needs Review.",
          productName: "",
          skuUpc: "",
          quantity: 0,
          unitCost: 0,
          unitRetailPrice: 0,
          total: 0,
          rawData: {
            error: error instanceof Error ? error.message : "Unknown PDF parsing error",
          },
          columnNames: ["error"],
        },
      ],
      warnings: ["PDF extraction failed. The row is marked Needs Review so it can be handled manually."],
      parser: "pdf-parse" as const,
      parserAttempted: "Generic PDF parser",
      parseError: error instanceof Error ? error.message : "Unknown PDF parsing error",
      rawTextPreview: "",
    };
  }
}

function parseCsv(buffer: Buffer) {
  const text = buffer.toString("utf8");
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const rawLines = (parsed.data ?? [])
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""))
    .map((row, index) => rawRecordToLine(row, index + 1));

  return {
    rawLines,
    warnings: parsed.errors.map((error) => `CSV row ${error.row ?? "unknown"}: ${error.message}`),
  };
}

async function parseExcel(buffer: Buffer) {
  try {
    const rows = (await readSheet(buffer)) as unknown[][];
    const [headerRow = [], ...bodyRows] = rows;
    const headers = headerRow.map((header, index) => String(header || `Column ${index + 1}`).trim());
    const rawLines = bodyRows
      .map((row, index) => {
        const record = Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex] ?? ""]));
        return rawRecordToLine(record, index + 1);
      })
      .filter((line) => Object.values(line.rawData).some((value) => String(value ?? "").trim() !== ""));

    return {
      rawLines,
      warnings: rows.length ? [] : ["Excel workbook did not contain readable rows."],
    };
  } catch (error) {
    return {
      rawLines: [
        {
          rowIndex: 1,
          date: null,
          vendor: "",
          description: "Excel extraction failed. Needs Review.",
          productName: "",
          skuUpc: "",
          quantity: 0,
          unitCost: 0,
          unitRetailPrice: 0,
          total: 0,
          rawData: {
            error: error instanceof Error ? error.message : "Unknown Excel parsing error",
          },
          columnNames: ["error"],
        },
      ],
      warnings: ["Excel extraction failed. Legacy .xls files may need to be saved as .xlsx or CSV first."],
    };
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const rules = formData.get("rules");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a PDF, Excel, or CSV file." }, { status: 400 });
  }

  const extension = extensionFor(file.name);
  if (!extension) {
    return NextResponse.json({ error: "Unsupported file type. Use PDF, CSV, XLSX, or XLS." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = hashBuffer(buffer);
  const fileType = extension.replace(".", "");
  let learnedRules: LearnedCategorizationRules | undefined;
  if (typeof rules === "string" && rules.trim()) {
    try {
      learnedRules = JSON.parse(rules) as LearnedCategorizationRules;
    } catch {
      return NextResponse.json({ error: "Saved rule payload was not valid JSON." }, { status: 400 });
    }
  }
  let parsed: {
    rawLines: RawImportLine[];
    warnings: string[];
    parser?: ParsedImportResult["parser"];
    parserAttempted?: string;
    parseError?: string;
    rawTextPreview?: string;
    reportType?: ParsedImportResult["reportType"];
    reportStartDate?: string | null;
    reportEndDate?: string | null;
    departmentSalesRows?: ParsedImportResult["departmentSalesRows"];
    storeSalesSummary?: ParsedImportResult["storeSalesSummary"];
    fuelGradeSalesRows?: ParsedImportResult["fuelGradeSalesRows"];
    tenderSalesRows?: ParsedImportResult["tenderSalesRows"];
  };
  let parser: ParsedImportResult["parser"];

  if (extension === ".pdf") {
    parsed = await parsePdf(buffer, file.name);
    parser = parsed.parser ?? "pdf-parse";
  } else if (extension === ".csv") {
    parsed = parseCsv(buffer);
    parser = "papaparse";
  } else {
    parsed = await parseExcel(buffer);
    parser = "read-excel-file";
  }

  const rows = parsed.rawLines.map((line) => buildParsedRow(line, fileType, fileHash, learnedRules));
  const warnings = [...parsed.warnings];

  if (!rows.length) {
    warnings.push("No rows were extracted from this file.");
  }

  const result: ParsedImportResult = {
    fileName: file.name,
    fileType,
    fileSize: file.size,
    fileHash,
    parser,
    reportType: parsed.reportType,
    reportStartDate: parsed.reportStartDate,
    reportEndDate: parsed.reportEndDate,
    parserAttempted: parsed.parserAttempted,
    rawTextPreview: parsed.rawTextPreview,
    parseError: parsed.parseError,
    departmentSalesRows: parsed.departmentSalesRows,
    storeSalesSummary: parsed.storeSalesSummary,
    fuelGradeSalesRows: parsed.fuelGradeSalesRows,
    tenderSalesRows: parsed.tenderSalesRows,
    warnings,
    rows,
  };

  return NextResponse.json(result);
}
