import type { CashFlowEntry, CommandCenterData } from "@/lib/types";

export type BankMatchSuggestion = {
  cashFlowId: string;
  matchedRecordType: string;
  matchedRecordId: string | null;
  confidence: number;
  reason: string;
};

function closeAmount(left: number, right: number, tolerance = 1) {
  return Math.abs(Math.abs(left) - Math.abs(right)) <= tolerance;
}

export function suggestBankMatch(entry: CashFlowEntry, data: CommandCenterData): BankMatchSuggestion | null {
  if (["loan_payment", "owner_draw", "transfer"].includes(entry.flow_type)) {
    return { cashFlowId: entry.id, matchedRecordType: entry.flow_type, matchedRecordId: null, confidence: 100, reason: "Classified as non-operating cash movement." };
  }

  if (entry.flow_type === "cash_deposit") {
    const match = data.cash_reconciliations.find((row) => row.date === entry.date && closeAmount(entry.amount, row.bank_deposit_amount || row.cash_drops));
    if (match) return { cashFlowId: entry.id, matchedRecordType: "cash_reconciliation", matchedRecordId: match.id, confidence: 95, reason: "Date and deposit amount match cash reconciliation." };
  }

  if (entry.flow_type === "card_processor_deposit") {
    const match = data.cash_reconciliations.find((row) => row.date === entry.date && closeAmount(entry.amount, row.processor_card_total));
    if (match) return { cashFlowId: entry.id, matchedRecordType: "cash_reconciliation", matchedRecordId: match.id, confidence: 95, reason: "Date and processor batch amount match." };
    const posRows = data.pos_import_rows.filter((row) => row.date === entry.date && row.import_action !== "skip");
    const posCardTotal = posRows.reduce((total, row) => total + row.card_total, 0);
    if (posRows.length && closeAmount(entry.amount, posCardTotal)) {
      return { cashFlowId: entry.id, matchedRecordType: "pos_card_batch", matchedRecordId: posRows[0].id, confidence: 85, reason: "Date and aggregated POS card total match." };
    }
  }

  if (entry.flow_type === "vendor_ach") {
    const match = data.expenses.find((row) => row.date === entry.date && closeAmount(entry.amount, row.amount) && (!entry.vendor_name || row.vendor_name.toLowerCase().includes(entry.vendor_name.toLowerCase())));
    if (match) return { cashFlowId: entry.id, matchedRecordType: "expense", matchedRecordId: match.id, confidence: 90, reason: "Vendor, date, and amount match an expense." };
    const importMatch = data.import_rows.find((row) =>
      row.date === entry.date
      && row.import_destination === "expenses"
      && !row.needs_review
      && row.row_status !== "draft"
      && closeAmount(entry.amount, row.total)
      && (!entry.vendor_name || (row.vendor ?? "").toLowerCase().includes(entry.vendor_name.toLowerCase())),
    );
    if (importMatch) return { cashFlowId: entry.id, matchedRecordType: "import_row", matchedRecordId: importMatch.id, confidence: 80, reason: "Vendor, date, and amount match a reviewed expense import row." };
  }

  const payrollMatch = data.payroll_entries.find((row) =>
    entry.date >= row.date_range_start && entry.date <= row.date_range_end && closeAmount(entry.amount, row.hours_worked * row.hourly_rate),
  );
  if (payrollMatch) return { cashFlowId: entry.id, matchedRecordType: "payroll_entry", matchedRecordId: payrollMatch.id, confidence: 90, reason: "Withdrawal falls in payroll period and matches calculated pay." };

  return null;
}

export function bankMatchingSummary(entries: CashFlowEntry[]) {
  return entries.reduce((summary, entry) => {
    summary.total += 1;
    summary[entry.match_status ?? "unmatched"] += 1;
    return summary;
  }, { total: 0, unmatched: 0, suggested: 0, matched: 0, ignored: 0 });
}
