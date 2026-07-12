import type { CashReconciliation, DailySale, PosImportRow } from "@/lib/types";

export type CashReconciliationInput = Pick<
  CashReconciliation,
  | "starting_cash"
  | "ending_cash"
  | "expected_cash_sales"
  | "cash_drops"
  | "paid_outs"
  | "lottery_payouts"
  | "pos_card_total"
  | "processor_card_total"
  | "bank_deposit_amount"
  | "status"
>;

export type ExpectedTenderTotals = Pick<
  CashReconciliation,
  "expected_cash_sales" | "pos_card_total" | "ebt_total" | "gift_card_total" | "other_tender_total" | "lottery_payouts"
>;

export function calculateCashReconciliation(input: CashReconciliationInput, threshold = 1) {
  const expectedEndingCash =
    input.starting_cash +
    input.expected_cash_sales -
    input.cash_drops -
    input.paid_outs -
    input.lottery_payouts;
  const variance = input.ending_cash - expectedEndingCash;
  const cardVariance = input.processor_card_total - input.pos_card_total;
  const depositVariance = input.bank_deposit_amount - input.cash_drops;
  const isBalanced = Math.abs(variance) <= threshold && Math.abs(cardVariance) <= threshold;
  const recommendedStatus: CashReconciliation["status"] = isBalanced
    ? "balanced"
    : input.status === "draft"
      ? "draft"
      : "needs_review";

  return {
    expectedEndingCash,
    variance,
    cardVariance,
    depositVariance,
    isBalanced,
    recommendedStatus,
  };
}

export function expectedTenderTotalsForDate(
  date: string,
  dailySales: DailySale[],
  posRows: PosImportRow[],
): ExpectedTenderTotals {
  const dailySale = dailySales.find((sale) => sale.date === date);
  const rows = posRows.filter((row) => row.date === date);
  const posCash = rows.reduce((total, row) => total + row.cash_total, 0);
  const posCard = rows.reduce((total, row) => total + row.card_total, 0);
  const posEbt = rows.reduce((total, row) => total + row.ebt_total, 0);
  const posGift = rows.reduce((total, row) => total + row.gift_card_total, 0);
  const posOther = rows.reduce((total, row) => total + row.other_payment_total, 0);

  return {
    expected_cash_sales: posCash || dailySale?.cash_total || 0,
    pos_card_total: posCard || dailySale?.card_total || 0,
    ebt_total: posEbt,
    gift_card_total: posGift,
    other_tender_total: posOther,
    lottery_payouts: dailySale?.lottery_payouts || 0,
  };
}

export function unreconciledDailySaleDates(dailySales: DailySale[], reconciliations: CashReconciliation[]) {
  const reconciledDates = new Set(reconciliations.map((entry) => entry.date));
  return dailySales.filter((sale) => !reconciledDates.has(sale.date)).map((sale) => sale.date);
}

export function reconciliationTotals(reconciliations: CashReconciliation[]) {
  return reconciliations.reduce(
    (totals, entry) => {
      const math = calculateCashReconciliation(entry);
      totals.cashOverShort += entry.variance ?? math.variance;
      totals.cardMismatch += math.cardVariance;
      totals.depositMismatch += math.depositVariance;
      if (!math.isBalanced || entry.status === "needs_review") {
        totals.needsReview += 1;
      }
      return totals;
    },
    {
      cashOverShort: 0,
      cardMismatch: 0,
      depositMismatch: 0,
      needsReview: 0,
    },
  );
}
