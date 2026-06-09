import type {
  CommandCenterData,
  DailySale,
  DeliEntry,
  Expense,
  FuelEntry,
  LotteryEntry,
  PayrollEntry,
} from "@/lib/types";

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function currency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function percent(value: number) {
  return `${numberFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export function monthEndIso(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function inDateRange(date: string, start?: string, end?: string) {
  if (start && date < start) {
    return false;
  }

  if (end && date > end) {
    return false;
  }

  return true;
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

export function fuelMargin(entry: Pick<FuelEntry, "retail_price_per_gallon" | "cost_per_gallon">) {
  return entry.retail_price_per_gallon - entry.cost_per_gallon;
}

export function fuelProfit(entry: Pick<FuelEntry, "gallons_sold" | "retail_price_per_gallon" | "cost_per_gallon">) {
  return entry.gallons_sold * (entry.retail_price_per_gallon - entry.cost_per_gallon);
}

export function dailyFuelProfit(
  sale: Pick<DailySale, "fuel_gallons_sold" | "fuel_retail_price" | "fuel_cost_per_gallon">,
) {
  return sale.fuel_gallons_sold * (sale.fuel_retail_price - sale.fuel_cost_per_gallon);
}

export function lotteryProfit(
  entry: Pick<LotteryEntry, "lottery_sales" | "lottery_payouts" | "commission_percentage">,
) {
  return entry.lottery_sales * (entry.commission_percentage / 100) - entry.lottery_payouts;
}

export function dailyLotteryProfit(sale: Pick<DailySale, "lottery_sales" | "lottery_payouts">) {
  return sale.lottery_sales * 0.06 - sale.lottery_payouts;
}

export function deliGrossProfit(entry: Pick<DeliEntry, "deli_sales" | "food_cost" | "waste_amount">) {
  return entry.deli_sales - entry.food_cost - entry.waste_amount;
}

export function payrollTotal(entry: Pick<PayrollEntry, "hours_worked" | "hourly_rate">) {
  return entry.hours_worked * entry.hourly_rate;
}

export function insideCategoryRevenue(sale: DailySale) {
  return {
    Cigarettes: sale.cigarette_sales,
    Beer: sale.beer_sales,
    Grocery: sale.grocery_sales,
    Deli: sale.deli_sales,
    Lottery: sale.lottery_sales,
    Other: sale.other_sales,
  };
}

export function totalInsideSales(sales: DailySale[]) {
  return sum(sales.map((sale) => sale.inside_sales));
}

export function totalRevenue(sales: DailySale[], deliEntries: DeliEntry[] = []) {
  return totalInsideSales(sales) + sum(deliEntries.map((entry) => entry.deli_sales));
}

export function totalExpenses(expenses: Expense[]) {
  return sum(expenses.map((expense) => expense.amount));
}

export function totalPayroll(payrollEntries: PayrollEntry[]) {
  return sum(payrollEntries.map(payrollTotal));
}

export function aggregateData(data: CommandCenterData, start?: string, end?: string) {
  const dailySales = data.daily_sales.filter((entry) => inDateRange(entry.date, start, end));
  const expenses = data.expenses.filter((entry) => inDateRange(entry.date, start, end));
  const fuelEntries = data.fuel_entries.filter((entry) => inDateRange(entry.date, start, end));
  const lotteryEntries = data.lottery_entries.filter((entry) => inDateRange(entry.date, start, end));
  const deliEntries = data.deli_entries.filter((entry) => inDateRange(entry.date, start, end));
  const payrollEntries = data.payroll_entries.filter(
    (entry) => inDateRange(entry.date_range_start, start, end) || inDateRange(entry.date_range_end, start, end),
  );

  const dailyFuel = sum(dailySales.map(dailyFuelProfit));
  const trackedFuel = sum(fuelEntries.map(fuelProfit));
  const dailyLottery = sum(dailySales.map(dailyLotteryProfit));
  const trackedLottery = sum(lotteryEntries.map(lotteryProfit));
  const dailyDeliSales = sum(dailySales.map((sale) => sale.deli_sales));
  const trackedDeliSales = sum(deliEntries.map((entry) => entry.deli_sales));
  const deliGross = sum(deliEntries.map(deliGrossProfit));
  const expensesTotal = totalExpenses(expenses);
  const payrollCost = totalPayroll(payrollEntries);
  const insideSales = totalInsideSales(dailySales);
  const fuelProfitTotal = trackedFuel || dailyFuel;
  const lotteryProfitTotal = trackedLottery || dailyLottery;
  const deliSales = trackedDeliSales || dailyDeliSales;
  const grossProfit = fuelProfitTotal + lotteryProfitTotal + deliGross + insideSales * 0.28;
  const netProfit = grossProfit - expensesTotal - payrollCost;
  const revenue = insideSales + deliSales + sum(dailySales.map((sale) => sale.fuel_gallons_sold * sale.fuel_retail_price));
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    dailySales,
    expenses,
    fuelEntries,
    lotteryEntries,
    deliEntries,
    payrollEntries,
    insideSales,
    fuelProfit: fuelProfitTotal,
    lotteryProfit: lotteryProfitTotal,
    deliSales,
    deliGrossProfit: deliGross,
    totalExpenses: expensesTotal,
    payrollCost,
    grossProfit,
    netProfit,
    totalRevenue: revenue,
    profitMargin,
  };
}

export function expensesByCategory(expenses: Expense[]) {
  return expenses.reduce<Record<string, number>>((categories, expense) => {
    categories[expense.category] = (categories[expense.category] ?? 0) + expense.amount;
    return categories;
  }, {});
}

export function bestWorstCategories(sales: DailySale[]) {
  const totals = sales.reduce<Record<string, number>>((categories, sale) => {
    for (const [category, value] of Object.entries(insideCategoryRevenue(sale))) {
      categories[category] = (categories[category] ?? 0) + value;
    }
    return categories;
  }, {});

  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  return {
    best: ranked[0] ?? ["N/A", 0],
    worst: ranked[ranked.length - 1] ?? ["N/A", 0],
    ranked,
  };
}

export function dailyChart(data: CommandCenterData, days = 14) {
  return [...data.daily_sales]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)
    .map((sale) => ({
      date: sale.date.slice(5),
      inside: sale.inside_sales,
      fuelProfit: dailyFuelProfit(sale),
      lotteryProfit: dailyLotteryProfit(sale),
      deli: sale.deli_sales,
      expenses: sum(data.expenses.filter((expense) => expense.date === sale.date).map((expense) => expense.amount)),
    }));
}
