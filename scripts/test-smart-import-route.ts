import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { POST } from "../src/app/api/smart-import/parse/route";
import type { ParsedImportResult } from "../src/lib/types";

async function postFile(file: File, fields: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("file", file);
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return POST(new Request("http://localhost/api/smart-import/parse", { method: "POST", body: formData }));
}

function classicTextPdf(text: string) {
  const escaped = text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const stream = `BT /F1 11 Tf 40 740 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

async function main() {
const invalidPdfResponse = await postFile(
  new File(["%PDF-1.4\ninvalid PDF body"], "broken.pdf", { type: "application/pdf" }),
);
assert.equal(invalidPdfResponse.status, 200, "PDF extraction failures should return a reviewable result");
const invalidPdf = await invalidPdfResponse.json() as ParsedImportResult;
assert.equal(invalidPdf.parser, "pdf-parse");
assert.equal(invalidPdf.extractionMethod, "manual");
assert.equal(invalidPdf.rows.length, 1);
assert.equal(invalidPdf.rows[0].importDestination, "needs_review");
assert.equal(invalidPdf.rows[0].needsReview, true);
assert.match(invalidPdf.warnings.join(" "), /OCR is temporarily disabled; manual review is required/i);
assert.doesNotMatch(invalidPdf.parseError ?? "", /\.next[\\/]dev[\\/]server[\\/]chunks[\\/]pdf\.worker\.mjs/i);

const forcedOcrResponse = await postFile(
  new File(["%PDF-1.4\nimage-only placeholder"], "scan.pdf", { type: "application/pdf" }),
  { forceOcr: "true", manualReportType: "invoice" },
);
assert.equal(forcedOcrResponse.status, 200);
const forcedOcr = await forcedOcrResponse.json() as ParsedImportResult;
assert.equal(forcedOcr.rows[0].importDestination, "needs_review");
assert.match(forcedOcr.parseError ?? "", /OCR is temporarily disabled/i);

const pdfPath = path.join(process.cwd(), "samples", "uploads", "messy-vendor-invoice.pdf");
const pdfResponse = await postFile(
  new File([readFileSync(pdfPath)], "messy-vendor-invoice.pdf", { type: "application/pdf" }),
);
assert.equal(pdfResponse.status, 200, "real PDF fixtures should not crash the route");
const parsedPdf = await pdfResponse.json() as ParsedImportResult;
assert.equal(parsedPdf.parser, "pdf-parse");
assert.ok(parsedPdf.rows.length > 0, "a PDF should produce text rows or a manual-review row");
assert.doesNotMatch(parsedPdf.parseError ?? "", /fake worker|pdf\.worker/i);

const generatedPdfResponse = await postFile(
  new File([
    classicTextPdf("Invoice Date 07/10/2026 Capital Candy grocery delivery total $125.00 with selectable server text"),
  ], "selectable-text.pdf", { type: "application/pdf" }),
);
assert.equal(generatedPdfResponse.status, 200);
const generatedPdf = await generatedPdfResponse.json() as ParsedImportResult;
assert.equal(generatedPdf.extractionMethod, "pdf-text", "selectable PDF text should use worker-free extraction");
assert.ok(generatedPdf.rows.length > 0);
assert.doesNotMatch(generatedPdf.parseError ?? "", /fake worker|pdf\.worker/i);

const csvResponse = await postFile(
  new File([
    "Date,Vendor,Description,Product Name,Quantity,Unit Cost,Unit Retail Price,Total\n" +
    "2026-07-10,Capital Candy,Candy delivery,Test Candy,2,1.00,2.00,4.00\n",
  ], "smart-import.csv", { type: "text/csv" }),
);
assert.equal(csvResponse.status, 200);
const parsedCsv = await csvResponse.json() as ParsedImportResult;
assert.equal(parsedCsv.parser, "papaparse");
assert.equal(parsedCsv.rows[0].productName, "Test Candy");

const xlsxPath = path.join(process.cwd(), "samples", "uploads", "fuel-report.xlsx");
const xlsxResponse = await postFile(
  new File([readFileSync(xlsxPath)], "fuel-report.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }),
);
assert.equal(xlsxResponse.status, 200);
const parsedXlsx = await xlsxResponse.json() as ParsedImportResult;
assert.equal(parsedXlsx.parser, "read-excel-file");
assert.ok(parsedXlsx.rows.length > 0, "XLSX parsing should remain available");

console.log("Smart Import API route fallback and format tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
