import { aggregateData, cashFlowSummary, sum } from "@/lib/calculations";
import { marginCategoryLabel, marginRate } from "@/lib/margin-settings";
import type { CommandCenterData, MarginCategory } from "@/lib/types";

export type ReportPreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "year_to_date"
  | "custom";

export type ReportRange = { start: string; end: string };

export type ProfitabilityRow = {
  category: string;
  sales: number;
  grossProfit: number;
  marginPercent: number;
  source: "Actual item cost" | "Estimated category margin";
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function dateRangeForPreset(preset: ReportPreset, today = new Date()): ReportRange {
  const current = utcDate(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const year = current.getUTCFullYear();
  const month = current.getUTCMonth();
  const mondayOffset = (current.getUTCDay() + 6) % 7;
  const thisMonday = addUtcDays(current, -mondayOffset);

  if (preset === "this_week") return { start: isoDate(thisMonday), end: isoDate(addUtcDays(thisMonday, 6)) };
  if (preset === "last_week") {
    const lastMonday = addUtcDays(thisMonday, -7);
    return { start: isoDate(lastMonday), end: isoDate(addUtcDays(lastMonday, 6)) };
  }
  if (preset === "last_month") {
    const first = utcDate(year, month - 1, 1);
    return { start: isoDate(first), end: isoDate(utcDate(year, month, 0)) };
  }
  if (preset === "this_quarter") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      start: isoDate(utcDate(year, quarterStartMonth, 1)),
      end: isoDate(utcDate(year, quarterStartMonth + 3, 0)),
    };
  }
  if (preset === "year_to_date") return { start: `${year}-01-01`, end: isoDate(current) };

  return { start: isoDate(utcDate(year, month, 1)), end: isoDate(utcDate(year, month + 1, 0)) };
}

function categoryAmount(expenses: Record<string, number>, categories: string[]) {
  return sum(categories.map((category) => expenses[category] ?? 0));
}

export function buildDetailedPnl(
  data: CommandCenterData,
  start: string,
  end: string,
  includeEstimates: boolean,
) {
  const report = aggregateData(data, start, end);
  const expenses = report.expenseBreakdown;
  const payroll = report.basePayroll + report.monthlyPayroll + report.expensePayroll;
  const ownerDrawExpense = categoryAmount(expenses, ["Owner draw"]);
  const loanPaymentExpense = categoryAmount(expenses, ["Loan payment"]);
  const transferExpense = categoryAmount(expenses, ["Transfer"]);
  const depositMovements = categoryAmount(expenses, ["Card processor deposit", "Cash deposit"]);
  const operatingExpenses = report.totalExpenses - report.monthlyPayroll - report.expensePayroll -
    ownerDrawExpense - loanPaymentExpense - transferExpense - depositMovements;
  const grossProfit = includeEstimates ? report.grossProfit : report.actualGrossProfit;
  const revenue = includeEstimates ? report.totalRevenue : report.actualTrackedRevenue;
  const cogs = includeEstimates ? Math.max(0, report.totalRevenue - report.grossProfit) : null;
  const netOperatingProfit = grossProfit - operatingExpenses - payroll;
  const cashFlow = cashFlowSummary(data.cash_flow_entries, start, end);
  const lotterySales = includeEstimates ? report.lotterySales : report.trackedLotterySales;
  const lotteryCommission = includeEstimates ? report.lotteryProfit : report.trackedLotteryProfit;
  const lotteryPayouts = includeEstimates ? report.lotteryPayouts : report.trackedLotteryPayouts;
  const deliSales = includeEstimates ? report.deliSales : report.trackedDeliSales;
  const deliGrossProfit = includeEstimates ? report.deliGrossProfit : report.trackedDeliGrossProfit;

  return {
    report,
    includesEstimates: includeEstimates,
    revenue,
    merchandiseSales: Math.max(0, revenue - report.fuelRevenue - lotterySales),
    fuelRevenue: report.fuelRevenue,
    fuelCost: report.fuelCost,
    fuelProfit: report.fuelProfit,
    lotterySales,
    lotteryCommission,
    lotteryPayouts,
    deliSales,
    deliFoodCost: report.deliFoodCost,
    deliWaste: report.deliWaste,
    deliGrossProfit,
    cogs,
    grossProfit,
    payroll,
    payrollRatio: revenue > 0 ? (payroll / revenue) * 100 : 0,
    rent: categoryAmount(expenses, ["Rent/Mortgage"]),
    utilities: categoryAmount(expenses, ["Utilities"]),
    insurance: categoryAmount(expenses, ["Insurance"]),
    repairs: categoryAmount(expenses, ["Repairs"]),
    bankCardFees: categoryAmount(expenses, ["Fees"]),
    vendorExpenses: categoryAmount(expenses, ["Inventory", "Inventory invoice", "Vendor invoice", "Capital Candy"]),
    otherOperatingExpenses: Math.max(0, operatingExpenses - categoryAmount(expenses, [
      "Rent/Mortgage", "Utilities", "Insurance", "Repairs", "Fees", "Inventory", "Inventory invoice", "Vendor invoice", "Capital Candy",
    ])),
    operatingExpenses,
    netOperatingProfit,
    grossMarginPercent: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    netMarginPercent: revenue > 0 ? (netOperatingProfit / revenue) * 100 : 0,
    expensePercent: revenue > 0 ? ((operatingExpenses + payroll) / revenue) * 100 : 0,
    ownerDraws: ownerDrawExpense + Math.abs(cashFlow.breakdown.owner_draw ?? 0),
    loanPayments: loanPaymentExpense + Math.abs(cashFlow.breakdown.loan_payment ?? 0),
    transfers: transferExpense + Math.abs(cashFlow.breakdown.transfer ?? 0),
    actualOnlyIsPartial: !includeEstimates && report.actualTrackedRevenue < report.totalRevenue,
  };
}

export function weeklyProfitRows(data: CommandCenterData, start: string, end: string, includeEstimates: boolean) {
  const dailyOnlyData = { ...data, monthly_totals: [] };
  const rows: Array<ReturnType<typeof buildDetailedPnl> & { start: string; end: string }> = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const rangeEnd = new Date(`${end}T00:00:00Z`);

  while (cursor <= rangeEnd) {
    const weekStart = new Date(cursor);
    const weekEnd = addUtcDays(weekStart, 6);
    const boundedEnd = weekEnd > rangeEnd ? rangeEnd : weekEnd;
    const rowStart = isoDate(weekStart);
    const rowEnd = isoDate(boundedEnd);
    rows.push({ ...buildDetailedPnl(dailyOnlyData, rowStart, rowEnd, includeEstimates), start: rowStart, end: rowEnd });
    cursor = addUtcDays(boundedEnd, 1);
  }

  return rows;
}

export function categoryProfitability(
  data: CommandCenterData,
  start: string,
  end: string,
  includeEstimates: boolean,
): ProfitabilityRow[] {
  const report = aggregateData(data, start, end);
  const actual = report.productSales.reduce<Record<string, { sales: number; grossProfit: number }>>((rows, sale) => {
    const current = rows[sale.category] ?? { sales: 0, grossProfit: 0 };
    current.sales += sale.gross_sales;
    current.grossProfit += sale.gross_profit;
    rows[sale.category] = current;
    return rows;
  }, {});
  const result: ProfitabilityRow[] = Object.entries(actual).map(([category, values]) => ({
    category,
    sales: values.sales,
    grossProfit: values.grossProfit,
    marginPercent: values.sales > 0 ? (values.grossProfit / values.sales) * 100 : 0,
    source: "Actual item cost",
  }));

  if (includeEstimates) {
    const estimated = new Map<MarginCategory, number>();
    const add = (category: MarginCategory, value: number) => estimated.set(category, (estimated.get(category) ?? 0) + value);
    for (const sale of report.dailySales) {
      add("grocery", sale.grocery_sales);
      add("deli", sale.deli_sales);
      add("hot_food", sale.hot_food_sales);
      add("lottery", sale.lottery_sales);
      add("beer", sale.beer_sales);
      add("cigarettes", sale.cigarette_sales);
      add("other", sale.other_sales);
    }
    for (const entry of report.monthlyTotals) {
      add("grocery", entry.grocery_sales);
      add("deli", entry.deli_sales);
      add("hot_food", entry.hot_food_sales);
      add("lottery", entry.lottery_sales);
      add("beer", entry.beer_sales);
      add("cigarettes", entry.cigarette_sales);
      add("vape_nicotine", entry.vape_nicotine_sales);
      add("other", entry.other_sales);
    }
    for (const [category, sales] of estimated) {
      const grossProfit = sales * marginRate(data.margin_settings, category);
      result.push({
        category: marginCategoryLabel(category),
        sales,
        grossProfit,
        marginPercent: sales > 0 ? (grossProfit / sales) * 100 : 0,
        source: "Estimated category margin",
      });
    }
  }

  return result.sort((a, b) => b.grossProfit - a.grossProfit);
}

export function fuelMarginByGrade(data: CommandCenterData, start: string, end: string) {
  const rows = data.fuel_reconciliations.filter((entry) => entry.date >= start && entry.date <= end);
  return Object.values(rows.reduce<Record<string, { grade: string; gallons: number; revenue: number; cost: number; profit: number }>>((grades, entry) => {
    const current = grades[entry.grade_name] ?? { grade: entry.grade_name, gallons: 0, revenue: 0, cost: 0, profit: 0 };
    current.gallons += entry.sold_gallons;
    current.revenue += entry.sold_gallons * entry.retail_price_per_gallon;
    current.cost += entry.sold_gallons * entry.rack_cost_per_gallon;
    current.profit += entry.sold_gallons * (entry.retail_price_per_gallon - entry.rack_cost_per_gallon);
    grades[entry.grade_name] = current;
    return grades;
  }, {})).map((row) => ({ ...row, marginPerGallon: row.gallons > 0 ? row.profit / row.gallons : 0 }));
}
