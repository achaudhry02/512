import type { DailySale, MarginCategory, MarginSetting, MonthlyTotal, ProfitAccuracy } from "@/lib/types";

export const defaultMarginSettings: Pick<MarginSetting, "category" | "gross_margin_percent" | "notes">[] = [
  { category: "grocery", gross_margin_percent: 28, notes: "Default grocery estimate" },
  { category: "candy", gross_margin_percent: 32, notes: "Default candy/snack estimate" },
  { category: "snacks", gross_margin_percent: 32, notes: "Default snack estimate" },
  { category: "drinks", gross_margin_percent: 35, notes: "Default drink estimate" },
  { category: "cigarettes", gross_margin_percent: 18, notes: "Default cigarette estimate" },
  { category: "vape_nicotine", gross_margin_percent: 35, notes: "Default vape/nicotine estimate" },
  { category: "beer", gross_margin_percent: 24, notes: "Default beer estimate" },
  { category: "deli", gross_margin_percent: 55, notes: "Default deli estimate" },
  { category: "hot_food", gross_margin_percent: 55, notes: "Default hot food estimate" },
  { category: "lottery", gross_margin_percent: 6, notes: "Default lottery commission estimate" },
  { category: "fuel", gross_margin_percent: 0, notes: "Fuel profit is calculated from price minus cost" },
  { category: "other", gross_margin_percent: 28, notes: "Default other inside sales estimate" },
];

const labels: Record<MarginCategory, string> = {
  grocery: "Grocery",
  candy: "Candy",
  snacks: "Snacks",
  drinks: "Drinks",
  cigarettes: "Cigarettes",
  vape_nicotine: "Vape/Nicotine",
  beer: "Beer",
  deli: "Deli",
  hot_food: "Hot Food",
  lottery: "Lottery",
  fuel: "Fuel",
  other: "Other",
};

export function marginCategoryLabel(category: MarginCategory) {
  return labels[category];
}

export function marginRate(settings: MarginSetting[], category: MarginCategory) {
  const setting = settings.find((entry) => entry.category === category);
  const fallback = defaultMarginSettings.find((entry) => entry.category === category);
  return (setting?.gross_margin_percent ?? fallback?.gross_margin_percent ?? 0) / 100;
}

export function marginSource(settings: MarginSetting[], category: MarginCategory) {
  return settings.some((entry) => entry.category === category) ? "setting" : "fallback";
}

export function grossProfitFromSalesByCategory(
  sales: Partial<Record<MarginCategory, number>>,
  settings: MarginSetting[],
) {
  return Object.entries(sales).reduce((total, [category, value]) => {
    return total + Number(value ?? 0) * marginRate(settings, category as MarginCategory);
  }, 0);
}

export function dailyGrossProfitFromMargins(sale: DailySale, settings: MarginSetting[]) {
  const fuelProfit = sale.fuel_gallons_sold * (sale.fuel_retail_price - sale.fuel_cost_per_gallon);
  const estimatedInside = grossProfitFromSalesByCategory({
    grocery: sale.grocery_sales,
    deli: sale.deli_sales,
    hot_food: sale.hot_food_sales,
    lottery: sale.lottery_sales,
    beer: sale.beer_sales,
    cigarettes: sale.cigarette_sales,
    other: sale.other_sales,
  }, settings);

  return fuelProfit + estimatedInside;
}

export function monthlyGrossProfitFromMargins(entry: MonthlyTotal, settings: MarginSetting[]) {
  return (entry.fuel_revenue - entry.fuel_cost) + grossProfitFromSalesByCategory({
    grocery: entry.grocery_sales,
    deli: entry.deli_sales,
    hot_food: entry.hot_food_sales,
    lottery: entry.lottery_sales,
    beer: entry.beer_sales,
    cigarettes: entry.cigarette_sales,
    vape_nicotine: entry.vape_nicotine_sales,
    other: entry.other_sales,
  }, settings);
}

export function profitAccuracyLabel(accuracy: ProfitAccuracy) {
  if (accuracy === "actual") return "Actual from product cost";
  if (accuracy === "mixed") return "Mixed actual + estimated";
  return "Estimated from category margins";
}

export function inferProfitAccuracy(hasProductCostData: boolean, hasEstimatedMarginData: boolean): ProfitAccuracy {
  if (hasProductCostData && !hasEstimatedMarginData) return "actual";
  if (hasProductCostData && hasEstimatedMarginData) return "mixed";
  return "estimated";
}
