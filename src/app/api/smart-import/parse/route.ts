import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import pdfParse from "pdf-parse";
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

function rawTextPreview(text: string, length = 12000) {
  return text.slice(0, length);
}

function isUsefulPdfText(text: string) {
  return text.replace(/\s+/g, "").length >= 80;
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

function sunocoManualFallback(
  fileName: string,
  reportType: "department_sales" | "store_sales_summary" | "invoice" | "bank_statement" | undefined,
  parseError: string,
  rawText: string,
) {
  const baseRow: RawImportLine = {
    rowIndex: 1,
    date: null,
    vendor: "Sunoco POS",
    description: `${reportType ? reportType.replaceAll("_", " ") : "PDF"} parsing failed. Needs manual review.`,
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
      file_name: fileName,
      parser_error: parseError,
      text_preview: rawTextPreview(rawText, 1000),
    },
    columnNames: ["parser_error", "text_preview"],
  };

  const manualDepartmentRows: RawImportLine[] =
    reportType === "department_sales"
      ? ["Department 1", "Department 2", "Department 3"].map((departmentName, index) => ({
          ...baseRow,
          rowIndex: index + 1,
          description: `Manual Department Sales Row ${index + 1}`,
          productName: departmentName,
          importDestination: "department_sales",
          rawData: {
            report_type: "department_sales",
            department_name: departmentName,
            gross_sales: 0,
            item_count: 0,
            refund_count: 0,
            net_count: 0,
            refund_amount: 0,
            discount_amount: 0,
            net_sales: 0,
            percent_of_sales: 0,
            parser_error: parseError,
          },
        }))
      : [];

  const manualStoreRows: RawImportLine[] =
    reportType === "store_sales_summary"
      ? [
          {
            ...baseRow,
            description: "Manual Store Sales Summary",
            productName: "Store Sales Summary",
            importDestination: "store_sales_summaries",
            rawData: {
              report_type: "store_sales_summary",
              grand_total_store_sales: 0,
              total_fuel_sales_volume: 0,
              total_fuel_sales_dollars: 0,
              fuel_discounts: 0,
              total_non_fuel_sales: 0,
              other_discounts: 0,
              total_taxes_collected: 0,
              total_sales: 0,
              total_revenue: 0,
              network_revenue: 0,
              parser_error: parseError,
            },
          },
        ]
      : [];

  return {
    rawLines: manualDepartmentRows.length ? manualDepartmentRows : manualStoreRows.length ? manualStoreRows : [baseRow],
    warnings: ["PDF text extraction was unavailable or did not find readable text. OCR is temporarily disabled; manual review is required."],
    parser: "pdf-parse" as const,
    parserAttempted: "Server-side PDF text extraction (OCR disabled)",
    parseError,
    rawTextPreview: rawTextPreview(rawText, 12000),
    reportType: reportType === "department_sales" || reportType === "store_sales_summary" ? reportType : undefined,
    extractionMethod: "manual" as const,
    extractedTextLength: rawText.length,
  };
}

function parseSunocoText(
  text: string,
  options: {
    extractionMethod: "pdf-text" | "ocr";
    manualReportType?: "department_sales" | "store_sales_summary" | "invoice" | "bank_statement";
  },
) {
  const reportType = options.manualReportType;

  if (reportType === "department_sales" || (!reportType && isDepartmentSalesReport(text))) {
    return {
      ...departmentRowsToRawLines(text),
      warnings: [],
      parser: "sunoco-department-sales" as const,
      parserAttempted: options.extractionMethod === "ocr" ? "Sunoco Department Sales Report OCR parser" : "Sunoco Department Sales Report",
      rawTextPreview: rawTextPreview(text),
      extractionMethod: options.extractionMethod,
      extractedTextLength: text.length,
    };
  }

  if (reportType === "store_sales_summary" || (!reportType && isStoreSalesSummaryReport(text))) {
    return {
      ...storeSummaryToRawLines(text),
      warnings: [],
      parser: "sunoco-store-sales-summary" as const,
      parserAttempted: options.extractionMethod === "ocr" ? "Sunoco Store Sales Summary OCR parser" : "Sunoco Store Sales Summary Report",
      rawTextPreview: rawTextPreview(text),
      extractionMethod: options.extractionMethod,
      extractedTextLength: text.length,
    };
  }

  return null;
}

async function extractPdfText(buffer: Buffer) {
  const parsed = await pdfParse(buffer);
  return parsed.text;
}

function safePdfError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown PDF text extraction error";
  return /fake worker|pdf\.worker|workerSrc/i.test(message)
    ? "PDF text extraction is unavailable in this server environment."
    : message;
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

async function parsePdf(
  buffer: Buffer,
  fileName: string,
  options: {
    forceOcr?: boolean;
    manualReportType?: "department_sales" | "store_sales_summary" | "invoice" | "bank_statement";
  } = {},
) {
  if (options.forceOcr) {
    return sunocoManualFallback(
      fileName,
      options.manualReportType,
      "OCR is temporarily disabled in the Next.js API route. Use manual review for image-only PDFs.",
      "",
    );
  }

  let extractedText = "";
  try {
    extractedText = await extractPdfText(buffer);
  } catch (error) {
    return sunocoManualFallback(fileName, options.manualReportType, safePdfError(error), "");
  }

  if (!isUsefulPdfText(extractedText)) {
    return sunocoManualFallback(
      fileName,
      options.manualReportType,
      "The PDF did not contain enough selectable text. OCR or manual review is required.",
      extractedText,
    );
  }

  const sunocoResult = parseSunocoText(extractedText, {
    extractionMethod: "pdf-text",
    manualReportType: options.manualReportType,
  });
  if (sunocoResult) return sunocoResult;

  try {
    const lines = extractedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const rawLines = lines
      .map((line, index) => parseDelimitedPdfLine(line, index + 1, fileName))
      .filter((line): line is RawImportLine => Boolean(line));

    if (!rawLines.length) {
      return sunocoManualFallback(
        fileName,
        options.manualReportType,
        "PDF text extraction did not identify clear line items.",
        extractedText,
      );
    }

    return {
      rawLines,
      warnings: [],
      parser: "pdf-parse" as const,
      parserAttempted: "Server-side PDF text extraction",
      rawTextPreview: rawTextPreview(extractedText),
      extractionMethod: "pdf-text" as const,
      extractedTextLength: extractedText.length,
    };
  } catch (error) {
    return sunocoManualFallback(
      fileName,
      options.manualReportType,
      error instanceof Error ? error.message : "Unknown PDF parsing error",
      extractedText,
    );
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

async function parseSmartImportRequest(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const rules = formData.get("rules");
  const forceOcr = formData.get("forceOcr") === "true";
  const manualReportTypeValue = formData.get("manualReportType");
  const manualReportType =
    manualReportTypeValue === "department_sales" ||
    manualReportTypeValue === "store_sales_summary" ||
    manualReportTypeValue === "invoice" ||
    manualReportTypeValue === "bank_statement"
      ? manualReportTypeValue
      : undefined;

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
    extractionMethod?: ParsedImportResult["extractionMethod"];
    extractedTextLength?: number;
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
    parsed = await parsePdf(buffer, file.name, { forceOcr, manualReportType });
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
    extractionMethod: parsed.extractionMethod,
    extractedTextLength: parsed.extractedTextLength,
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

export async function POST(request: Request) {
  try {
    return await parseSmartImportRequest(request);
  } catch (error) {
    console.error("Smart Import parse route failed:", error);
    return NextResponse.json(
      { error: "Unable to parse this file. Try CSV/XLSX or use manual review for the source document." },
      { status: 500 },
    );
  }
}
