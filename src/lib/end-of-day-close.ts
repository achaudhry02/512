import type { CommandCenterData, DailyCloseStatus } from "@/lib/types";

type CloseSettings = {
  cash_variance_threshold: number;
  card_mismatch_threshold: number;
  fuel_variance_threshold: number;
};

export type DailyCloseSummary = {
  insideSales: number;
  fuelSales: number;
  lotterySales: number;
  expectedCash: number;
  actualCash: number;
  cashOverShort: number;
  posCardTotal: number;
  processorCardTotal: number;
  cardMismatch: number;
  bankDeposit: number;
};

export type DailyCloseEvaluation = {
  summary: DailyCloseSummary;
  checklist: Pick<DailyCloseStatus,
    | "daily_sales_completed" | "pos_import_completed" | "cash_reconciliation_completed"
    | "card_batch_completed" | "lottery_completed" | "fuel_completed" | "bank_deposit_matched">;
  missingSteps: string[];
  mismatches: string[];
  requiresOverride: boolean;
  canClose: boolean;
};

function sum<T>(rows: T[], value: (row: T) => number) {
  return rows.reduce((total, row) => total + value(row), 0);
}

export function evaluateDailyClose(
  data: CommandCenterData,
  date: string,
  settings: CloseSettings,
  saved?: DailyCloseStatus | null,
): DailyCloseEvaluation {
  const daily = data.daily_sales.filter((row) => row.date === date);
  const pos = data.pos_import_rows.filter((row) => row.date === date && row.import_action !== "skip");
  const cash = data.cash_reconciliations.find((row) => row.date === date);
  const fuelEntries = data.fuel_entries.filter((row) => row.date === date);
  const fuelReconciliations = data.fuel_reconciliations.filter((row) => row.date === date);
  const lottery = data.lottery_entries.filter((row) => row.date === date);
  const bankDeposits = data.cash_flow_entries.filter((row) =>
    row.date === date && row.flow_type === "cash_deposit" && row.match_status === "matched",
  );

  const insideSales = daily.length
    ? sum(daily, (row) => row.inside_sales)
    : sum(pos, (row) => row.net_sales - row.fuel_sales - row.lottery_sales);
  const fuelSales = pos.some((row) => row.fuel_sales)
    ? sum(pos, (row) => row.fuel_sales)
    : daily.some((row) => row.fuel_gallons_sold)
      ? sum(daily, (row) => row.fuel_gallons_sold * row.fuel_retail_price)
      : sum(fuelEntries, (row) => row.gallons_sold * row.retail_price_per_gallon);
  const lotterySales = daily.some((row) => row.lottery_sales)
    ? sum(daily, (row) => row.lottery_sales)
    : pos.some((row) => row.lottery_sales)
      ? sum(pos, (row) => row.lottery_sales)
      : sum(lottery, (row) => row.lottery_sales);
  const expectedCash = cash?.expected_cash_sales ?? (daily.length ? sum(daily, (row) => row.cash_total) : sum(pos, (row) => row.cash_total));
  const actualCash = cash?.ending_cash ?? 0;
  const cashOverShort = cash?.cash_over_short ?? (cash ? actualCash - expectedCash : 0);
  const posCardTotal = cash?.pos_card_total ?? (daily.length ? sum(daily, (row) => row.card_total) : sum(pos, (row) => row.card_total));
  const processorCardTotal = cash?.processor_card_total ?? 0;
  const cardMismatch = processorCardTotal - posCardTotal;
  const bankDeposit = bankDeposits.length ? sum(bankDeposits, (row) => Math.abs(row.amount)) : cash?.bank_deposit_amount ?? 0;

  const hasFuelGrades = data.fuel_grades.some((row) => row.active);
  const fuelDataExists = fuelEntries.length > 0 || fuelReconciliations.length > 0 || daily.some((row) => row.fuel_gallons_sold > 0) || pos.some((row) => row.fuel_gallons > 0);
  const fuelWithinThreshold = fuelReconciliations.every((row) => Math.abs(row.variance ?? 0) <= settings.fuel_variance_threshold);
  const checklist = {
    daily_sales_completed: daily.length > 0 || pos.length > 0 || saved?.daily_sales_completed === true,
    pos_import_completed: pos.length > 0 || saved?.pos_import_completed === true,
    cash_reconciliation_completed: Boolean(cash) || saved?.cash_reconciliation_completed === true,
    card_batch_completed: Boolean(cash) && Math.abs(cardMismatch) <= settings.card_mismatch_threshold,
    lottery_completed: lottery.length > 0 || daily.some((row) => row.lottery_sales > 0) || pos.some((row) => row.lottery_sales > 0) || saved?.lottery_completed === true,
    fuel_completed: (!hasFuelGrades || (fuelDataExists && fuelWithinThreshold)) || saved?.fuel_completed === true,
    bank_deposit_matched: bankDeposits.length > 0 || saved?.bank_deposit_matched === true,
  };

  const missingSteps: string[] = [];
  if (!checklist.daily_sales_completed) missingSteps.push("Daily sales or POS import");
  if (!checklist.cash_reconciliation_completed) missingSteps.push("Cash reconciliation");
  if (!checklist.fuel_completed) missingSteps.push("Fuel reconciliation");
  if (!checklist.lottery_completed) missingSteps.push("Lottery entry or not-applicable confirmation");
  if (!checklist.bank_deposit_matched) missingSteps.push("Bank deposit match or pending override");
  const mismatches: string[] = [];
  if (Math.abs(cashOverShort) > settings.cash_variance_threshold) mismatches.push("Cash over/short exceeds threshold");
  if (Math.abs(cardMismatch) > settings.card_mismatch_threshold) mismatches.push("Card batch mismatch exceeds threshold");
  if (fuelReconciliations.some((row) => Math.abs(row.variance ?? 0) > settings.fuel_variance_threshold)) mismatches.push("Fuel variance exceeds threshold");
  const requiresOverride = missingSteps.length > 0 || mismatches.length > 0;

  return {
    summary: { insideSales, fuelSales, lotterySales, expectedCash, actualCash, cashOverShort, posCardTotal, processorCardTotal, cardMismatch, bankDeposit },
    checklist,
    missingSteps,
    mismatches,
    requiresOverride,
    canClose: !requiresOverride || Boolean(saved?.override_reason?.trim()),
  };
}
