import type {
  CommandCenterData,
  DailySale,
  DeliEntry,
  Expense,
  FuelEntry,
  LotteryEntry,
  MarginSetting,
  MonthlyTotal,
  PayrollEntry,
  PosImportRow,
  ProfitLeakFinding,
} from "@/lib/types";
import {
  grossProfitFromSalesByCategory,
  inferProfitAccuracy,
  marginRate,
  profitAccuracyLabel,
} from "@/lib/margin-settings";
import {
  monthlyFuelProfit,
  monthlyGrossProfit,
  monthlyInsideSales,
  monthlyPeriodEnd,
  monthlyPeriodKey,
  monthlyPeriodStart,
  monthlyTotalExpenses,
} from "@/lib/monthly-totals";

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

export function rangesOverlap(rangeStart: string, rangeEnd: string, start?: string, end?: string) {
  return (!start || rangeEnd >= start) && (!end || rangeStart <= end);
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

export function dailyLotteryProfit(sale: Pick<DailySale, "lottery_sales" | "lottery_payouts">, settings: MarginSetting[] = []) {
  return sale.lottery_sales * marginRate(settings, "lottery") - sale.lottery_payouts;
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
    "Hot Food": sale.hot_food_sales,
    Lottery: sale.lottery_sales,
    Other: sale.other_sales,
  };
}

export function posRowRevenue(row: PosImportRow) {
  if (row.net_sales) return row.net_sales;
  const adjusted = row.gross_sales - row.discounts - row.refunds - row.voids;
  return adjusted || row.fuel_sales || row.cash_total + row.card_total + row.ebt_total + row.gift_card_total + row.other_payment_total;
}

export function posRowsInRange(rows: PosImportRow[], start?: string, end?: string, excludedMonthKeys: ReadonlySet<string> = new Set()) {
  return rows.filter((row) => row.date && inDateRange(row.date, start, end) && !excludedMonthKeys.has(monthKeyFromDate(row.date)));
}

export function posDepartmentSales(rows: PosImportRow[], start?: string, end?: string) {
  return posRowsInRange(rows, start, end).reduce<Record<string, number>>((departments, row) => {
    const category = row.department_category || "Unmapped";
    departments[category] = (departments[category] ?? 0) + posRowRevenue(row);
    return departments;
  }, {});
}

export function posPaymentBreakdown(rows: PosImportRow[], start?: string, end?: string) {
  return posRowsInRange(rows, start, end).reduce<Record<string, number>>((payments, row) => {
    payments.Cash = (payments.Cash ?? 0) + row.cash_total;
    payments.Card = (payments.Card ?? 0) + row.card_total;
    payments.EBT = (payments.EBT ?? 0) + row.ebt_total;
    payments["Gift card"] = (payments["Gift card"] ?? 0) + row.gift_card_total;
    payments.Other = (payments.Other ?? 0) + row.other_payment_total;
    return payments;
  }, {});
}

export function posSalesBySource(rows: PosImportRow[], start?: string, end?: string) {
  return Object.values(
    posRowsInRange(rows, start, end).reduce<Record<string, { name: string; sales: number; rows: number }>>((sources, row) => {
      const current = sources[row.pos_name] ?? { name: row.pos_name, sales: 0, rows: 0 };
      current.sales += posRowRevenue(row);
      current.rows += 1;
      sources[row.pos_name] = current;
      return sources;
    }, {}),
  ).sort((a, b) => b.sales - a.sales);
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

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function monthlyTotalsInRange(monthlyTotals: MonthlyTotal[], start?: string, end?: string) {
  return monthlyTotals.filter((entry) => rangesOverlap(monthlyPeriodStart(entry), monthlyPeriodEnd(entry), start, end));
}

function payrollOverlapsAnyMonth(entry: PayrollEntry, monthKeys: ReadonlySet<string>) {
  return Array.from(monthKeys).some((month) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const monthEntry = { year, month: monthNumber };
    return rangesOverlap(entry.date_range_start, entry.date_range_end, monthlyPeriodStart(monthEntry), monthlyPeriodEnd(monthEntry));
  });
}

function monthlyExpenseBreakdown(entries: MonthlyTotal[]) {
  return entries.reduce<Record<string, number>>((categories, entry) => {
    categories.Payroll = (categories.Payroll ?? 0) + entry.payroll;
    categories.Inventory = (categories.Inventory ?? 0) + entry.inventory_purchases;
    categories["Vendor invoice"] = (categories["Vendor invoice"] ?? 0) + entry.vendor_expenses;
    categories.Utilities = (categories.Utilities ?? 0) + entry.utilities;
    categories["Rent/Mortgage"] = (categories["Rent/Mortgage"] ?? 0) + entry.rent_mortgage;
    categories.Insurance = (categories.Insurance ?? 0) + entry.insurance;
    categories.Repairs = (categories.Repairs ?? 0) + entry.repairs_maintenance;
    categories.Other = (categories.Other ?? 0) + entry.miscellaneous_expenses;
    return categories;
  }, {});
}

export function aggregateData(data: CommandCenterData, start?: string, end?: string) {
  const marginSettings = data.margin_settings;
  const monthlyTotals = monthlyTotalsInRange(data.monthly_totals, start, end);
  const monthlyKeys = new Set(monthlyTotals.map(monthlyPeriodKey));
  const dailySales = data.daily_sales.filter((entry) => inDateRange(entry.date, start, end) && !monthlyKeys.has(monthKeyFromDate(entry.date)));
  const expenses = data.expenses.filter((entry) => inDateRange(entry.date, start, end) && !monthlyKeys.has(monthKeyFromDate(entry.date)));
  const fuelEntries = data.fuel_entries.filter((entry) => inDateRange(entry.date, start, end) && !monthlyKeys.has(monthKeyFromDate(entry.date)));
  const lotteryEntries = data.lottery_entries.filter((entry) => inDateRange(entry.date, start, end) && !monthlyKeys.has(monthKeyFromDate(entry.date)));
  const deliEntries = data.deli_entries.filter((entry) => inDateRange(entry.date, start, end) && !monthlyKeys.has(monthKeyFromDate(entry.date)));
  const payrollEntries = data.payroll_entries.filter((entry) =>
    rangesOverlap(entry.date_range_start, entry.date_range_end, start, end) && !payrollOverlapsAnyMonth(entry, monthlyKeys),
  );
  const posRows = posRowsInRange(data.pos_import_rows, start, end, monthlyKeys);
  const productSales = data.product_sales.filter((entry) => inDateRange(entry.date, start, end) && !monthlyKeys.has(monthKeyFromDate(entry.date)));

  const trackedFuelDates = new Set(fuelEntries.map((entry) => entry.date));
  const trackedLotteryDates = new Set(lotteryEntries.map((entry) => entry.date));
  const trackedDeliDates = new Set(deliEntries.map((entry) => entry.date));
  const dailyFuel = sum(dailySales.filter((sale) => !trackedFuelDates.has(sale.date)).map(dailyFuelProfit));
  const trackedFuel = sum(fuelEntries.map(fuelProfit));
  const dailyLottery = sum(dailySales.filter((sale) => !trackedLotteryDates.has(sale.date)).map((sale) => dailyLotteryProfit(sale, marginSettings)));
  const trackedLottery = sum(lotteryEntries.map(lotteryProfit));
  const fallbackDeliSales = dailySales.filter((sale) => !trackedDeliDates.has(sale.date));
  const dailyDeliSales = sum(fallbackDeliSales.map((sale) => sale.deli_sales + sale.hot_food_sales));
  const trackedDeliSales = sum(deliEntries.map((entry) => entry.deli_sales));
  const deliGross = sum(deliEntries.map(deliGrossProfit)) + sum(fallbackDeliSales.map((sale) => grossProfitFromSalesByCategory({
    deli: sale.deli_sales,
    hot_food: sale.hot_food_sales,
  }, marginSettings)));
  const baseExpenses = totalExpenses(expenses);
  const basePayroll = totalPayroll(payrollEntries);
  const monthlyExpenses = sum(monthlyTotals.map(monthlyTotalExpenses));
  const monthlyPayroll = sum(monthlyTotals.map((entry) => entry.payroll));
  const expensesTotal = baseExpenses + monthlyExpenses;
  const payrollCost = basePayroll + monthlyPayroll;
  const posRevenue = sum(posRows.map(posRowRevenue));
  const posFuelSales = sum(posRows.map((row) => row.fuel_sales));
  const posFuelCost = sum(posRows.map((row) => row.fuel_cost));
  const posLotterySales = sum(posRows.map((row) => row.lottery_sales));
  const posInsideSales = Math.max(0, posRevenue - posFuelSales);
  const insideSales = totalInsideSales(dailySales) + sum(monthlyTotals.map(monthlyInsideSales)) + posInsideSales;
  const estimatedInsideGrossProfit = sum(dailySales.map((sale) => grossProfitFromSalesByCategory({
    grocery: sale.grocery_sales,
    beer: sale.beer_sales,
    cigarettes: sale.cigarette_sales,
    other: sale.other_sales,
  }, marginSettings)));
  const productGrossProfit = sum(productSales.map((sale) => sale.gross_profit));
  const productGrossSales = sum(productSales.map((sale) => sale.gross_sales));
  const monthlyFuel = sum(monthlyTotals.map(monthlyFuelProfit));
  const monthlyLottery = sum(monthlyTotals.map((entry) => entry.lottery_sales * marginRate(marginSettings, "lottery")));
  const monthlyDeliSales = sum(monthlyTotals.map((entry) => entry.deli_sales + entry.hot_food_sales));
  const posFuel = posFuelSales - posFuelCost;
  const posLottery = posLotterySales * marginRate(marginSettings, "lottery");
  const fuelProfitTotal = trackedFuel + dailyFuel + monthlyFuel + posFuel;
  const lotteryProfitTotal = trackedLottery + dailyLottery + monthlyLottery + posLottery;
  const deliSales = trackedDeliSales + dailyDeliSales + monthlyDeliSales;
  const monthlyGross = sum(monthlyTotals.map((entry) => monthlyGrossProfit(entry, marginSettings)));
  const dailyGross = trackedFuel + dailyFuel + trackedLottery + dailyLottery + deliGross + estimatedInsideGrossProfit;
  const posGross = posFuel + posLottery + productGrossProfit + Math.max(0, posInsideSales - posLotterySales - productGrossSales) * marginRate(marginSettings, "other");
  const grossProfit = dailyGross + monthlyGross + posGross;
  const netProfit = grossProfit - baseExpenses - basePayroll - monthlyExpenses;
  const revenue = insideSales + sum(dailySales.map((sale) => sale.fuel_gallons_sold * sale.fuel_retail_price)) +
    sum(monthlyTotals.map((entry) => entry.fuel_revenue)) + posFuelSales;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const expenseBreakdown = {
    ...expensesByCategory(expenses),
  };
  for (const [category, value] of Object.entries(monthlyExpenseBreakdown(monthlyTotals))) {
    expenseBreakdown[category] = (expenseBreakdown[category] ?? 0) + value;
  }

  return {
    monthlyTotals,
    dailySales,
    expenses,
    fuelEntries,
    lotteryEntries,
    deliEntries,
    payrollEntries,
    posRows,
    productSales,
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
    expenseBreakdown,
    profitAccuracy: inferProfitAccuracy(productSales.length > 0, dailySales.length > 0 || monthlyTotals.length > 0 || posRows.length > productSales.length),
    profitAccuracyLabel: profitAccuracyLabel(inferProfitAccuracy(productSales.length > 0, dailySales.length > 0 || monthlyTotals.length > 0 || posRows.length > productSales.length)),
    source: monthlyTotals.length ? "monthly_totals" : posRows.length ? "daily_and_pos" : "daily",
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

export function bestWorstCategoriesFromData(data: CommandCenterData) {
  const totals = data.daily_sales.reduce<Record<string, number>>((categories, sale) => {
    for (const [category, value] of Object.entries(insideCategoryRevenue(sale))) {
      categories[category] = (categories[category] ?? 0) + value;
    }
    return categories;
  }, {});

  for (const [category, value] of Object.entries(posDepartmentSales(data.pos_import_rows))) {
    totals[category] = (totals[category] ?? 0) + value;
  }

  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return {
    best: ranked[0] ?? ["N/A", 0],
    worst: ranked[ranked.length - 1] ?? ["N/A", 0],
    ranked,
  };
}

export function dailyChart(data: CommandCenterData, days = 14) {
  const posByDate = data.pos_import_rows.reduce<Record<string, { inside: number; fuelProfit: number; deli: number; expenses: number }>>((daysByDate, row) => {
    if (!row.date) return daysByDate;
    const current = daysByDate[row.date] ?? { inside: 0, fuelProfit: 0, deli: 0, expenses: 0 };
    const revenue = posRowRevenue(row);
    current.inside += Math.max(0, revenue - row.fuel_sales);
    current.fuelProfit += row.fuel_sales - row.fuel_cost;
    if ((row.department_category ?? "").toLowerCase().includes("deli") || (row.department_category ?? "").toLowerCase().includes("food")) {
      current.deli += revenue;
    }
    daysByDate[row.date] = current;
    return daysByDate;
  }, {});

  return [...data.daily_sales]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)
    .map((sale) => ({
      date: sale.date.slice(5),
      inside: sale.inside_sales + (posByDate[sale.date]?.inside ?? 0),
      fuelProfit: dailyFuelProfit(sale) + (posByDate[sale.date]?.fuelProfit ?? 0),
      lotteryProfit: dailyLotteryProfit(sale, data.margin_settings),
      deli: sale.deli_sales + sale.hot_food_sales + (posByDate[sale.date]?.deli ?? 0),
      expenses: sum(data.expenses.filter((expense) => expense.date === sale.date).map((expense) => expense.amount)),
    }));
}

function average(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value));
  return validValues.length ? sum(validValues) / validValues.length : 0;
}

function dayProfitMargin(data: CommandCenterData, sale: DailySale) {
  const dayExpenses = data.expenses.filter((expense) => expense.date === sale.date);
  const dayFuelEntries = data.fuel_entries.filter((entry) => entry.date === sale.date);
  const dayLotteryEntries = data.lottery_entries.filter((entry) => entry.date === sale.date);
  const dayDeliEntries = data.deli_entries.filter((entry) => entry.date === sale.date);
  const dayPayrollEntries = data.payroll_entries.filter((entry) =>
    inDateRange(sale.date, entry.date_range_start, entry.date_range_end),
  );

  const fuelProfitTotal = dayFuelEntries.length
    ? sum(dayFuelEntries.map(fuelProfit))
    : dailyFuelProfit(sale);
  const lotteryProfitTotal = dayLotteryEntries.length
    ? sum(dayLotteryEntries.map(lotteryProfit))
    : dailyLotteryProfit(sale, data.margin_settings);
  const deliProfitTotal = dayDeliEntries.length
    ? sum(dayDeliEntries.map(deliGrossProfit))
    : grossProfitFromSalesByCategory({ deli: sale.deli_sales, hot_food: sale.hot_food_sales }, data.margin_settings);
  const estimatedInsideGrossProfit = grossProfitFromSalesByCategory({
    grocery: sale.grocery_sales,
    beer: sale.beer_sales,
    cigarettes: sale.cigarette_sales,
    other: sale.other_sales,
  }, data.margin_settings);
  const payrollCost = sum(dayPayrollEntries.map(payrollTotal));
  const revenue = sale.inside_sales + sale.fuel_gallons_sold * sale.fuel_retail_price;
  const grossProfit = fuelProfitTotal + lotteryProfitTotal + deliProfitTotal + estimatedInsideGrossProfit;
  const netProfit = grossProfit - totalExpenses(dayExpenses) - payrollCost;

  return {
    date: sale.date,
    margin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    netProfit,
    revenue,
  };
}

export function analyzeProfitLeaks(data: CommandCenterData): ProfitLeakFinding[] {
  const findings: ProfitLeakFinding[] = [];
  const sortedSales = [...data.daily_sales].sort((a, b) => a.date.localeCompare(b.date));
  const sortedExpenses = [...data.expenses].sort((a, b) => a.date.localeCompare(b.date));
  const totalExpenseAmount = totalExpenses(sortedExpenses);
  const categoryTotals = expensesByCategory(sortedExpenses);
  const activeCategoryTotals = Object.entries(categoryTotals).filter(([, value]) => value > 0);
  const averageCategorySpend = average(activeCategoryTotals.map(([, value]) => value));

  for (const [category, amount] of activeCategoryTotals) {
    const share = totalExpenseAmount > 0 ? (amount / totalExpenseAmount) * 100 : 0;
    const unusuallyHigh =
      amount > 250 && (share >= 35 || (averageCategorySpend > 0 && amount >= averageCategorySpend * 1.5));

    if (unusuallyHigh) {
      findings.push({
        id: `expense-${category}`,
        type: "high_expense_category",
        severity: share >= 50 ? "critical" : "warning",
        title: `${category} expenses are unusually high`,
        description: `${category} is ${currency(amount)}, or ${percent(share)} of entered expenses.`,
        recommendation:
          category === "Fuel purchase"
            ? "Compare fuel delivery invoices against gallons sold and confirm the tank reconciliation before the next order."
            : "Review recent invoices, confirm each charge is tied to sales activity, and set an approval threshold for this category.",
        metric: `${currency(amount)} spent`,
        impact: amount,
      });
    }
  }

  const fuelMargins = [
    ...data.fuel_entries.map((entry) => ({
      date: entry.date,
      margin: fuelMargin(entry),
      profit: fuelProfit(entry),
      source: "fuel entry",
    })),
    ...data.daily_sales
      .filter((sale) => sale.fuel_gallons_sold > 0)
      .map((sale) => ({
        date: sale.date,
        margin: sale.fuel_retail_price - sale.fuel_cost_per_gallon,
        profit: dailyFuelProfit(sale),
        source: "daily sales",
      })),
  ];
  const averageFuelMargin = average(fuelMargins.map((entry) => entry.margin));
  const lowFuelMarginDays = fuelMargins
    .filter((entry) => entry.margin > 0 && (entry.margin < 0.18 || (averageFuelMargin > 0 && entry.margin < averageFuelMargin * 0.75)))
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 2);

  for (const entry of lowFuelMarginDays) {
    findings.push({
      id: `fuel-${entry.source}-${entry.date}`,
      type: "low_fuel_margin",
      severity: entry.margin < 0.12 ? "critical" : "warning",
      title: `Low fuel margin on ${entry.date}`,
      description: `Fuel margin was ${currency(entry.margin)} per gallon, below the target operating range.`,
      recommendation:
        "Check competitor pricing, confirm the latest rack cost, and consider a small retail price move before the next high-volume period.",
      metric: `${currency(entry.margin)} / gal`,
      date: entry.date,
      impact: Math.abs(entry.profit),
    });
  }

  for (const entry of data.deli_entries) {
    const wasteRate = entry.deli_sales > 0 ? (entry.waste_amount / entry.deli_sales) * 100 : 0;
    const grossMargin = entry.deli_sales > 0 ? (deliGrossProfit(entry) / entry.deli_sales) * 100 : 0;

    if (entry.deli_sales > 0 && (wasteRate >= 5 || grossMargin < 45)) {
      findings.push({
        id: `deli-${entry.date}`,
        type: "deli_waste",
        severity: wasteRate >= 8 || grossMargin < 35 ? "critical" : "warning",
        title: `Deli waste is pressuring margin on ${entry.date}`,
        description: `Waste was ${percent(wasteRate)} of deli sales and estimated deli gross margin was ${percent(grossMargin)}.`,
        recommendation:
          "Reduce the next prep batch, track waste by daypart, and move slow sellers into a timed promotion before discard.",
        metric: `${currency(entry.waste_amount)} waste`,
        date: entry.date,
        impact: entry.waste_amount,
      });
    }
  }

  const totalInsideRevenue = totalInsideSales(sortedSales);
  const payrollCost = totalPayroll(data.payroll_entries);
  const payrollRatio = totalInsideRevenue > 0 ? (payrollCost / totalInsideRevenue) * 100 : 0;

  if (payrollCost > 0 && payrollRatio >= 12) {
    findings.push({
      id: "payroll-ratio",
      type: "payroll_ratio",
      severity: payrollRatio >= 18 ? "critical" : "warning",
      title: "Payroll is high compared to inside sales",
      description: `Payroll is running at ${percent(payrollRatio)} of inside sales for the selected data set.`,
      recommendation:
        "Match labor hours to rush periods, trim overlapping shifts, and compare scheduled hours against expected inside sales before posting the next schedule.",
      metric: `${percent(payrollRatio)} labor ratio`,
      impact: payrollCost,
    });
  }

  const expensesByVendor = sortedExpenses.reduce<Record<string, Expense[]>>((vendors, expense) => {
    vendors[expense.vendor_name] = [...(vendors[expense.vendor_name] ?? []), expense];
    return vendors;
  }, {});

  for (const [vendor, expenses] of Object.entries(expensesByVendor)) {
    if (expenses.length < 2) {
      continue;
    }

    const midpoint = Math.ceil(expenses.length / 2);
    const previous = expenses.slice(0, midpoint);
    const recent = expenses.slice(midpoint);
    const previousSpend = totalExpenses(previous);
    const recentSpend = totalExpenses(recent);
    const increase = recentSpend - previousSpend;
    const increaseRate = previousSpend > 0 ? (increase / previousSpend) * 100 : 0;

    if (recentSpend > 0 && increase > 100 && (previousSpend === 0 || increaseRate >= 25)) {
      findings.push({
        id: `vendor-${vendor}`,
        type: "vendor_increase",
        severity: increaseRate >= 60 ? "critical" : "warning",
        title: `${vendor} spending is increasing`,
        description: `Recent spend is up ${currency(increase)} (${percent(increaseRate)}) compared with the prior entries.`,
        recommendation:
          "Pull the last two invoices, check quantity and unit-cost changes, and renegotiate or split the next order if the increase is not sales-driven.",
        metric: `${currency(increase)} increase`,
        impact: increase,
      });
    }
  }

  const dailyMargins = sortedSales.map((sale) => dayProfitMargin(data, sale)).filter((day) => day.revenue > 0);
  const averageDailyMargin = average(dailyMargins.map((day) => day.margin));
  const lowMarginDays = dailyMargins
    .filter((day) => day.margin < 6 || (averageDailyMargin > 0 && day.margin < averageDailyMargin * 0.6))
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 2);

  for (const day of lowMarginDays) {
    findings.push({
      id: `margin-${day.date}`,
      type: "low_profit_margin",
      severity: day.margin < 0 ? "critical" : "warning",
      title: `Low profit margin day on ${day.date}`,
      description: `Estimated profit margin was ${percent(day.margin)} on ${currency(day.revenue)} in revenue.`,
      recommendation:
        "Review that day's expense postings, fuel margin, lottery payouts, and labor coverage to identify the largest controllable drag.",
      metric: `${percent(day.margin)} margin`,
      date: day.date,
      impact: Math.abs(day.netProfit),
    });
  }

  if (!findings.length && sortedSales.length) {
    findings.push({
      id: "healthy-operations",
      type: "low_profit_margin",
      severity: "watch",
      title: "No major profit leaks detected",
      description: "Current entries do not show outsized expenses, weak fuel margin, deli waste, labor drag, or low-margin days.",
      recommendation:
        "Keep entering daily sales, expenses, fuel, deli, and payroll data so the finder can spot trend changes early.",
      metric: "Healthy",
    });
  }

  const severityScore = {
    critical: 0,
    warning: 1,
    watch: 2,
  };

  return findings.sort((a, b) => {
    const severityDifference = severityScore[a.severity] - severityScore[b.severity];
    if (severityDifference !== 0) {
      return severityDifference;
    }

    return (b.impact ?? 0) - (a.impact ?? 0);
  });
}
