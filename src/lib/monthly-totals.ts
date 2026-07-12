import type { MonthlyTotal } from "@/lib/types";
import { monthlyGrossProfitFromMargins } from "@/lib/margin-settings";
import type { MarginSetting } from "@/lib/types";

export type MonthlyTotalsFormValues = Omit<
  MonthlyTotal,
  "id" | "user_id" | "store_id" | "created_at" | "updated_at"
>;

export const monthlySalesFields = [
  "grocery_sales",
  "deli_sales",
  "hot_food_sales",
  "fuel_gallons_sold",
  "fuel_revenue",
  "fuel_cost",
  "lottery_sales",
  "beer_sales",
  "cigarette_sales",
  "vape_nicotine_sales",
  "other_sales",
  "cash_sales",
  "card_sales",
] as const;

export const monthlyExpenseFields = [
  "payroll",
  "inventory_purchases",
  "vendor_expenses",
  "utilities",
  "rent_mortgage",
  "insurance",
  "repairs_maintenance",
  "miscellaneous_expenses",
] as const;

export const monthlyNumericFields = [
  "year",
  "month",
  ...monthlySalesFields,
  ...monthlyExpenseFields,
] as const;

export function emptyMonthlyTotals(date = new Date()): MonthlyTotalsFormValues {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    grocery_sales: 0,
    deli_sales: 0,
    hot_food_sales: 0,
    fuel_gallons_sold: 0,
    fuel_revenue: 0,
    fuel_cost: 0,
    lottery_sales: 0,
    beer_sales: 0,
    cigarette_sales: 0,
    vape_nicotine_sales: 0,
    other_sales: 0,
    cash_sales: 0,
    card_sales: 0,
    payroll: 0,
    inventory_purchases: 0,
    vendor_expenses: 0,
    utilities: 0,
    rent_mortgage: 0,
    insurance: 0,
    repairs_maintenance: 0,
    miscellaneous_expenses: 0,
    notes: null,
  };
}

export function monthlyPeriodKey(entry: Pick<MonthlyTotal, "year" | "month">) {
  return `${entry.year}-${String(entry.month).padStart(2, "0")}`;
}

export function monthlyPeriodStart(entry: Pick<MonthlyTotal, "year" | "month">) {
  return `${monthlyPeriodKey(entry)}-01`;
}

export function monthlyPeriodEnd(entry: Pick<MonthlyTotal, "year" | "month">) {
  const days = new Date(Date.UTC(entry.year, entry.month, 0)).getUTCDate();
  return `${monthlyPeriodKey(entry)}-${String(days).padStart(2, "0")}`;
}

export function monthlyTotalSales(entry: MonthlyTotalsFormValues | MonthlyTotal) {
  return entry.grocery_sales + entry.deli_sales + entry.hot_food_sales + entry.fuel_revenue +
    entry.lottery_sales + entry.beer_sales + entry.cigarette_sales + entry.vape_nicotine_sales + entry.other_sales;
}

export function monthlyInsideSales(entry: MonthlyTotalsFormValues | MonthlyTotal) {
  return monthlyTotalSales(entry) - entry.fuel_revenue;
}

export function monthlyTotalExpenses(entry: MonthlyTotalsFormValues | MonthlyTotal) {
  return entry.payroll + entry.inventory_purchases + entry.vendor_expenses + entry.utilities +
    entry.rent_mortgage + entry.insurance + entry.repairs_maintenance + entry.miscellaneous_expenses;
}

export function monthlyFuelProfit(entry: MonthlyTotalsFormValues | MonthlyTotal) {
  return entry.fuel_revenue - entry.fuel_cost;
}

export function monthlyFuelMargin(entry: MonthlyTotalsFormValues | MonthlyTotal) {
  return entry.fuel_gallons_sold > 0 ? monthlyFuelProfit(entry) / entry.fuel_gallons_sold : 0;
}

export function monthlyGrossProfit(entry: MonthlyTotalsFormValues | MonthlyTotal, marginSettings: MarginSetting[] = []) {
  if (marginSettings.length) {
    return monthlyGrossProfitFromMargins(entry as MonthlyTotal, marginSettings);
  }

  const foodSales = entry.deli_sales + entry.hot_food_sales;
  const merchandiseSales = entry.grocery_sales + entry.beer_sales + entry.cigarette_sales +
    entry.vape_nicotine_sales + entry.other_sales;
  return monthlyFuelProfit(entry) + entry.lottery_sales * 0.06 + foodSales * 0.55 + merchandiseSales * 0.28;
}

export function monthlyNetProfit(entry: MonthlyTotalsFormValues | MonthlyTotal, marginSettings: MarginSetting[] = []) {
  return monthlyGrossProfit(entry, marginSettings) - monthlyTotalExpenses(entry);
}

export function monthlyExpensePercentage(entry: MonthlyTotalsFormValues | MonthlyTotal) {
  const totalSales = monthlyTotalSales(entry);
  return totalSales > 0 ? (monthlyTotalExpenses(entry) / totalSales) * 100 : 0;
}

export function monthlyGrossMarginPercent(entry: MonthlyTotalsFormValues | MonthlyTotal, marginSettings: MarginSetting[] = []) {
  const totalSales = monthlyTotalSales(entry);
  return totalSales > 0 ? (monthlyGrossProfit(entry, marginSettings) / totalSales) * 100 : 0;
}

export function monthlyNetMarginPercent(entry: MonthlyTotalsFormValues | MonthlyTotal, marginSettings: MarginSetting[] = []) {
  const totalSales = monthlyTotalSales(entry);
  return totalSales > 0 ? (monthlyNetProfit(entry, marginSettings) / totalSales) * 100 : 0;
}

export function monthlyTotalsToCsv(entry: MonthlyTotalsFormValues | MonthlyTotal, marginSettings: MarginSetting[] = []) {
  const rows: (string | number | null)[][] = [
    ["Metric", "Value"],
    ["Month", monthlyPeriodKey(entry)],
    ["Total sales", monthlyTotalSales(entry)],
    ["Total expenses", monthlyTotalExpenses(entry)],
    ["Fuel margin", monthlyFuelMargin(entry)],
    ["Fuel profit", monthlyFuelProfit(entry)],
    ["Gross profit", monthlyGrossProfit(entry, marginSettings)],
    ["Estimated net profit", monthlyNetProfit(entry, marginSettings)],
    ["Expense percentage", monthlyExpensePercentage(entry)],
    ["Gross margin %", monthlyGrossMarginPercent(entry, marginSettings)],
    ["Net margin %", monthlyNetMarginPercent(entry, marginSettings)],
    ["Notes", entry.notes],
  ];
  return rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
}
