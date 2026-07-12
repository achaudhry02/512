import type { CommandCenterData } from "@/lib/types";

export type PnlConfidence = {
  score: number;
  label: "High confidence" | "Medium confidence" | "Low confidence" | "Needs review";
  reasons: string[];
  missingItems: string[];
};

function datesInRange(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function ratio(count: number, total: number) {
  return total ? Math.min(1, count / total) : 1;
}

export function calculatePnlConfidence(data: CommandCenterData, start: string, end: string, includeEstimates: boolean): PnlConfidence {
  const dates = datesInRange(start, end);
  const dateSet = new Set(dates);
  const closed = data.daily_close_statuses.filter((row) => dateSet.has(row.date) && row.status === "closed").length;
  const cash = data.cash_reconciliations.filter((row) => dateSet.has(row.date) && row.status !== "draft").length;
  const operatingDays = new Set([
    ...data.daily_sales.filter((row) => dateSet.has(row.date)).map((row) => row.date),
    ...data.pos_import_rows.filter((row) => row.date && dateSet.has(row.date)).map((row) => row.date as string),
  ]).size;
  const cardDeposits = data.cash_flow_entries.filter((row) => dateSet.has(row.date) && row.flow_type === "card_processor_deposit");
  const bankRows = data.cash_flow_entries.filter((row) => dateSet.has(row.date));
  const expenseReviewRows = data.import_rows.filter((row) => row.date && dateSet.has(row.date) && row.import_destination === "expenses");
  const fuelDays = new Set(data.fuel_reconciliations.filter((row) => dateSet.has(row.date)).map((row) => row.date)).size;
  const productsWithCosts = data.products.filter((row) => row.unit_cost > 0).length;

  const closeRatio = ratio(closed, dates.length);
  const cashRatio = ratio(cash, Math.max(operatingDays, 1));
  const cardRatio = ratio(cardDeposits.filter((row) => row.match_status === "matched" || row.match_status === "ignored").length, cardDeposits.length);
  const bankRatio = ratio(bankRows.filter((row) => row.match_status === "matched" || row.match_status === "ignored").length, bankRows.length);
  const expenseRatio = ratio(expenseReviewRows.filter((row) => !row.needs_review && row.row_status !== "draft").length, expenseReviewRows.length);
  const fuelRatio = data.fuel_grades.some((row) => row.active) ? ratio(fuelDays, Math.max(operatingDays, 1)) : 1;
  const costRatio = ratio(productsWithCosts, data.products.length);
  const score = Math.round(closeRatio * 25 + cashRatio * 15 + cardRatio * 15 + bankRatio * 15 + expenseRatio * 10 + fuelRatio * 10 + costRatio * 5 + (includeEstimates ? 0 : 5));
  const reasons: string[] = [];
  const missingItems: string[] = [];
  if (closeRatio === 1) reasons.push("Every day in the range is closed."); else missingItems.push(`${dates.length - closed} day(s) are not closed.`);
  if (cashRatio === 1) reasons.push("Cash reconciliations cover operating days."); else missingItems.push("Cash reconciliations are incomplete.");
  if (cardRatio < 1) missingItems.push("Some card processor deposits are unmatched.");
  if (bankRatio < 1) missingItems.push("Some bank transactions are unmatched or unreviewed.");
  if (expenseRatio < 1) missingItems.push("Some imported expenses still need review.");
  if (fuelRatio < 1) missingItems.push("Fuel reconciliations do not cover all operating days.");
  if (costRatio < 0.8) missingItems.push("Product cost coverage is below 80%.");
  if (includeEstimates) missingItems.push("Estimated margins are included; results are not fully actual."); else reasons.push("Estimated category margins are excluded.");
  const label = score >= 85 ? "High confidence" : score >= 65 ? "Medium confidence" : score >= 40 ? "Low confidence" : "Needs review";
  return { score, label, reasons, missingItems };
}
