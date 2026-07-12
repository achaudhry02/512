import { buildDetailedPnl, categoryProfitability, fuelMarginByGrade, weeklyProfitRows } from "@/lib/accountant-reporting";
import { cashFlowSummary, currency } from "@/lib/calculations";
import { bankMatchingSummary } from "@/lib/bank-matching";
import { calculatePnlConfidence } from "@/lib/pnl-confidence";
import type { CommandCenterData } from "@/lib/types";

type ExportOptions = {
  storeName: string;
  start: string;
  end: string;
  includeEstimates: boolean;
};

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export function rowsToCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function pnlRows(data: CommandCenterData, options: ExportOptions) {
  const pnl = buildDetailedPnl(data, options.start, options.end, options.includeEstimates);
  return [
    ["Line item", "Amount"],
    ["Inside merchandise sales", pnl.merchandiseSales],
    ["Fuel sales", pnl.fuelRevenue],
    ["Lottery sales", pnl.lotterySales],
    ["Total sales", pnl.revenue],
    ["Fuel cost (memo, included in COGS)", pnl.fuelCost],
    [options.includeEstimates ? "COGS / estimated COGS" : "COGS", pnl.cogs],
    ["Gross profit", pnl.grossProfit],
    ["Fuel profit", pnl.fuelProfit],
    ["Lottery commission / profit", pnl.lotteryCommission],
    ["Deli / hot food sales", pnl.deliSales],
    ["Deli / hot food gross profit", pnl.deliGrossProfit],
    ["Payroll", pnl.payroll],
    ["Rent / mortgage", pnl.rent],
    ["Utilities", pnl.utilities],
    ["Insurance", pnl.insurance],
    ["Repairs and maintenance", pnl.repairs],
    ["Bank / card fees", pnl.bankCardFees],
    ["Vendor expenses", pnl.vendorExpenses],
    ["Other operating expenses", pnl.otherOperatingExpenses],
    ["Net operating profit", pnl.netOperatingProfit],
    ["Owner draws (non-operating)", pnl.ownerDraws],
    ["Loan payments (non-operating)", pnl.loanPayments],
    ["Transfers (non-operating)", pnl.transfers],
  ];
}

export function buildSummaryCsv(data: CommandCenterData, options: ExportOptions) {
  const pnl = buildDetailedPnl(data, options.start, options.end, options.includeEstimates);
  const confidence = calculatePnlConfidence(data, options.start, options.end, options.includeEstimates);
  return rowsToCsv([
    ["Convenience Store Command Center report"],
    ["Store", options.storeName],
    ["Date range", `${options.start} to ${options.end}`],
    ["Estimated values", options.includeEstimates ? "Included" : "Excluded"],
    ["Data accuracy", options.includeEstimates ? pnl.report.profitAccuracyLabel : "Actual tracked data only (may be partial)"],
    ["P&L confidence", `${confidence.score}/100 - ${confidence.label}`],
    [],
    ...pnlRows(data, options),
    [],
    ["Ratio", "Percent"],
    ["Payroll ratio", pnl.payrollRatio],
    ["Expense percentage", pnl.expensePercent],
    ["Gross margin", pnl.grossMarginPercent],
    ["Net margin", pnl.netMarginPercent],
  ]);
}

export function buildAccountantPackageFiles(data: CommandCenterData, options: ExportOptions) {
  const pnl = buildDetailedPnl(data, options.start, options.end, options.includeEstimates);
  const cashFlow = cashFlowSummary(data.cash_flow_entries, options.start, options.end);
  const weekly = weeklyProfitRows(data, options.start, options.end, options.includeEstimates);
  const categories = categoryProfitability(data, options.start, options.end, options.includeEstimates);
  const fuelGrades = fuelMarginByGrade(data, options.start, options.end);
  const expenses = pnl.report.expenses;
  const imports = data.imports.filter((entry) => {
    const date = entry.created_at?.slice(0, 10);
    return date && date >= options.start && date <= options.end;
  });
  const posImports = data.pos_imports.filter((entry) => {
    const date = entry.created_at?.slice(0, 10);
    return date && date >= options.start && date <= options.end;
  });
  const confidence = calculatePnlConfidence(data, options.start, options.end, options.includeEstimates);
  const closeRows = data.daily_close_statuses.filter((entry) => entry.date >= options.start && entry.date <= options.end);
  const bankRows = data.cash_flow_entries.filter((entry) => entry.date >= options.start && entry.date <= options.end);
  const bankMatches = bankMatchingSummary(bankRows);

  return {
    "summary.csv": buildSummaryCsv(data, options),
    "pnl.csv": rowsToCsv(pnlRows(data, options)),
    "weekly-pnl.csv": rowsToCsv([
      ["Week start", "Week end", "Sales", "Gross profit", "Expenses", "Payroll", "Net operating profit"],
      ...weekly.map((row) => [row.start, row.end, row.revenue, row.grossProfit, row.operatingExpenses, row.payroll, row.netOperatingProfit]),
    ]),
    "expenses.csv": rowsToCsv([
      ["Date", "Vendor", "Category", "Payment method", "Amount", "Notes"],
      ...expenses.map((entry) => [entry.date, entry.vendor_name, entry.category, entry.payment_method, entry.amount, entry.notes]),
    ]),
    "cash-flow.csv": rowsToCsv([
      ["Date", "Type", "Vendor", "Description", "Amount", "Match status", "Matched record type", "Confidence"],
      ...cashFlow.rows.map((entry) => [entry.date, entry.flow_type, entry.vendor_name, entry.description, entry.amount, entry.match_status, entry.matched_record_type, entry.match_confidence]),
    ]),
    "daily-close-status.csv": rowsToCsv([
      ["Date", "Status", "Lottery completed", "Lottery not applicable", "Bank deposit matched", "Bank deposit pending", "Closed at", "Closed by", "Override reason", "Notes"],
      ...closeRows.map((entry) => [entry.date, entry.status, entry.lottery_completed ? "Yes" : "No", entry.lottery_not_applicable ? "Yes" : "No", entry.bank_deposit_matched ? "Yes" : "No", entry.bank_deposit_pending ? "Yes" : "No", entry.closed_at, entry.closed_by, entry.override_reason, entry.notes]),
    ]),
    "payroll.csv": rowsToCsv([
      ["Employee", "Start", "End", "Hours", "Rate", "Pay"],
      ...pnl.report.payrollEntries.map((entry) => [entry.employee_name, entry.date_range_start, entry.date_range_end, entry.hours_worked, entry.hourly_rate, entry.hours_worked * entry.hourly_rate]),
    ]),
    "vendor-spend.csv": rowsToCsv([
      ["Vendor", "Amount"],
      ...Object.entries(expenses.reduce<Record<string, number>>((vendors, entry) => {
        vendors[entry.vendor_name || "Unspecified"] = (vendors[entry.vendor_name || "Unspecified"] ?? 0) + entry.amount;
        return vendors;
      }, {})).sort((a, b) => b[1] - a[1]),
    ]),
    "inventory-value.csv": rowsToCsv([
      ["Product", "SKU / UPC", "Category", "Quantity", "Unit cost", "Inventory value"],
      ...data.products.map((entry) => [entry.name, entry.sku_upc, entry.category, entry.quantity_on_hand, entry.unit_cost, entry.quantity_on_hand * entry.unit_cost]),
    ]),
    "category-profitability.csv": rowsToCsv([
      ["Category", "Sales", "Gross profit", "Margin percent", "Source"],
      ...categories.map((entry) => [entry.category, entry.sales, entry.grossProfit, entry.marginPercent, entry.source]),
    ]),
    "cash-reconciliation.csv": rowsToCsv([
      ["Date", "Status", "Cash over / short", "Card mismatch", "Bank deposit mismatch"],
      ...data.cash_reconciliations
        .filter((entry) => entry.date >= options.start && entry.date <= options.end)
        .map((entry) => [entry.date, entry.status, entry.variance ?? entry.cash_over_short, entry.processor_card_total - entry.pos_card_total, entry.bank_deposit_amount - entry.cash_drops]),
    ]),
    "fuel-by-grade.csv": rowsToCsv([
      ["Grade", "Gallons", "Revenue", "Cost", "Profit", "Margin per gallon"],
      ...fuelGrades.map((entry) => [entry.grade, entry.gallons, entry.revenue, entry.cost, entry.profit, entry.marginPerGallon]),
    ]),
    "lottery-deli.csv": rowsToCsv([
      ["Metric", "Amount"],
      ["Lottery sales", pnl.lotterySales],
      ["Lottery payouts", pnl.lotteryPayouts],
      ["Lottery commission / profit", pnl.lotteryCommission],
      ["Deli / hot food sales", pnl.deliSales],
      ["Deli food cost", pnl.deliFoodCost],
      ["Deli waste", pnl.deliWaste],
      ["Deli / hot food gross profit", pnl.deliGrossProfit],
    ]),
    "import-history.csv": rowsToCsv([
      ["Source", "Created", "File", "Status", "Rows", "Imported rows"],
      ...imports.map((entry) => ["Smart Import", entry.created_at, entry.original_file_name, entry.status, entry.row_count, ""]),
      ...posImports.map((entry) => [entry.pos_name, entry.created_at, entry.original_file_name, entry.status, entry.row_count, entry.imported_row_count]),
    ]),
    "README.txt": [
      "Convenience Store Command Center accountant package",
      `Store: ${options.storeName}`,
      `Period: ${options.start} to ${options.end}`,
      `Estimated values: ${options.includeEstimates ? "included" : "excluded"}`,
      `P&L confidence: ${confidence.score}/100 - ${confidence.label}`,
      `Closed days in package: ${closeRows.filter((entry) => entry.status === "closed").length} of ${closeRows.length} close records`,
      `Bank matching: ${bankMatches.matched} matched, ${bankMatches.suggested} suggested, ${bankMatches.unmatched} unmatched, ${bankMatches.ignored} ignored`,
      "",
      "Monthly total records are used instead of daily records for the same month to prevent duplicate sales.",
      "Weekly P&L excludes monthly-total-only records because a monthly total cannot be allocated to a specific week.",
      "Owner draws, loan payments, and transfers are reported separately from operating profit.",
      "Actual-only reporting may be partial when item costs or tracked category costs are unavailable.",
      ...confidence.missingItems.map((item) => `Needs review: ${item}`),
    ].join("\n"),
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(data: CommandCenterData, options: ExportOptions) {
  downloadBlob(new Blob([buildSummaryCsv(data, options)], { type: "text/csv;charset=utf-8" }), `report-${options.start}-to-${options.end}.csv`);
}

export async function downloadPdf(data: CommandCenterData, options: ExportOptions) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF();
  const pnl = buildDetailedPnl(data, options.start, options.end, options.includeEstimates);
  const lines = pnlRows(data, options).slice(1) as Array<[string, number | null]>;
  document.setFontSize(18);
  document.text("Convenience Store Reporting Package", 14, 18);
  document.setFontSize(10);
  document.text(`${options.storeName} | ${options.start} to ${options.end}`, 14, 26);
  document.text(options.includeEstimates ? pnl.report.profitAccuracyLabel : "Actual tracked data only (may be partial)", 14, 32);
  let y = 42;
  for (const [label, value] of lines) {
    if (y > 282) {
      document.addPage();
      y = 18;
    }
    document.text(label, 14, y);
    document.text(value == null ? "Not available" : currency(value), 196, y, { align: "right" });
    y += 7;
  }
  document.save(`report-${options.start}-to-${options.end}.pdf`);
}

export async function downloadAccountantZip(data: CommandCenterData, options: ExportOptions) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(buildAccountantPackageFiles(data, options))) zip.file(name, contents);
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `accountant-package-${options.start}-to-${options.end}.zip`);
}
