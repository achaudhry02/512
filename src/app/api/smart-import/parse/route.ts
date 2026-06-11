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
import type { ParsedImportResult, ParsedImportRow } from "@/lib/types";

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

function buildParsedRow(line: RawImportLine, fileType: string, fileHash: string): ParsedImportRow {
  const category = categorizeImportLine(line, fileType);

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
    suggestedCategory: category.suggestedCategory,
    confidenceScore: category.confidenceScore,
    importDestination: category.importDestination,
    needsReview: category.needsReview,
    ignored: false,
    rawData: line.rawData,
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

    return { rawLines, warnings };
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
  let parsed: { rawLines: RawImportLine[]; warnings: string[] };
  let parser: ParsedImportResult["parser"];

  if (extension === ".pdf") {
    parsed = await parsePdf(buffer, file.name);
    parser = "pdf-parse";
  } else if (extension === ".csv") {
    parsed = parseCsv(buffer);
    parser = "papaparse";
  } else {
    parsed = await parseExcel(buffer);
    parser = "read-excel-file";
  }

  const rows = parsed.rawLines.map((line) => buildParsedRow(line, fileType, fileHash));
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
    warnings,
    rows,
  };

  return NextResponse.json(result);
}
