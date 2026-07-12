import type { CommandCenterData, Store } from "@/lib/types";

export type OnboardingStepKey =
  | "store"
  | "margins"
  | "pos"
  | "first_entry"
  | "vendors"
  | "fuel_grades"
  | "employees";

export type OnboardingStep = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  href: string;
  action: string;
  complete: boolean;
};

export function onboardingSteps(data: CommandCenterData, store: Store | null): OnboardingStep[] {
  const hasFirstEntry = data.daily_sales.length > 0 || data.monthly_totals.length > 0 ||
    data.pos_import_rows.length > 0 || data.imports.length > 0;

  return [
    {
      key: "store",
      title: "Create your store",
      description: "Confirm the location name and business address.",
      href: "/onboarding#store",
      action: "Store details",
      complete: Boolean(store?.id && store.name.trim()),
    },
    {
      key: "margins",
      title: "Set default margins",
      description: "Choose the category assumptions used when item cost is unavailable.",
      href: "/onboarding#margins",
      action: "Set margins",
      complete: data.margin_settings.length > 0,
    },
    {
      key: "pos",
      title: "Choose your POS system",
      description: "Save a starting mapping profile for the register system you use.",
      href: "/onboarding#pos",
      action: "Choose POS",
      complete: data.pos_column_mappings.length > 0 || data.pos_imports.length > 0,
    },
    {
      key: "first_entry",
      title: "Enter or import the first day",
      description: "Record a daily close, a monthly total, or a POS report.",
      href: "/onboarding#first-entry",
      action: "Add first data",
      complete: hasFirstEntry,
    },
    {
      key: "vendors",
      title: "Add main vendors",
      description: "Start with fuel, grocery, beer, tobacco, and food suppliers.",
      href: "/vendors",
      action: "Add vendors",
      complete: data.vendors.length > 0,
    },
    {
      key: "fuel_grades",
      title: "Add fuel grades",
      description: "Configure regular, premium, diesel, and any custom grades.",
      href: "/fuel-reconciliation",
      action: "Add fuel grades",
      complete: data.fuel_grades.length > 0,
    },
    {
      key: "employees",
      title: "Add employees",
      description: "Create the people and rates used by payroll tracking.",
      href: "/employees",
      action: "Add employees",
      complete: data.employees.length > 0,
    },
  ];
}

export function onboardingProgress(data: CommandCenterData, store: Store | null) {
  const steps = onboardingSteps(data, store);
  const completed = steps.filter((step) => step.complete).length;
  return {
    steps,
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
    complete: completed === steps.length,
  };
}

function isoDaysBefore(today: string, days: number) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function buildSampleStoreData(today: string) {
  const sales = [
    { grocery: 1420, deli: 260, hotFood: 310, fuelGallons: 2850, lottery: 780, beer: 420, cigarettes: 590, other: 180, cash: 1675, card: 2285 },
    { grocery: 1510, deli: 295, hotFood: 355, fuelGallons: 3010, lottery: 830, beer: 465, cigarettes: 610, other: 205, cash: 1790, card: 2480 },
    { grocery: 1640, deli: 340, hotFood: 390, fuelGallons: 3180, lottery: 890, beer: 510, cigarettes: 645, other: 230, cash: 1910, card: 2735 },
  ];

  const dailySales = sales.map((entry, index) => ({
    date: isoDaysBefore(today, 2 - index),
    inside_sales: entry.grocery + entry.deli + entry.hotFood + entry.lottery + entry.beer + entry.cigarettes + entry.other,
    fuel_gallons_sold: entry.fuelGallons,
    fuel_retail_price: 3.499,
    fuel_cost_per_gallon: 3.279,
    lottery_sales: entry.lottery,
    lottery_payouts: 0,
    deli_sales: entry.deli,
    hot_food_sales: entry.hotFood,
    cigarette_sales: entry.cigarettes,
    beer_sales: entry.beer,
    grocery_sales: entry.grocery,
    other_sales: entry.other,
    cash_total: entry.cash,
    card_total: entry.card,
    expenses: 0,
    payroll: 0,
    notes: "Sample onboarding data",
  }));

  return {
    dailySales,
    expenses: [
      { date: isoDaysBefore(today, 2), vendor_name: "Town Utilities", category: "Utilities", amount: 185, payment_method: "ACH", notes: "Sample onboarding data" },
      { date: isoDaysBefore(today, 1), vendor_name: "Capital Candy", category: "Inventory invoice", amount: 1240, payment_method: "ACH", notes: "Sample onboarding data" },
    ],
    fuelEntries: dailySales.map((entry) => ({
      date: entry.date,
      gallons_sold: entry.fuel_gallons_sold,
      cost_per_gallon: entry.fuel_cost_per_gallon,
      retail_price_per_gallon: entry.fuel_retail_price,
      notes: "Sample onboarding data",
    })),
    lotteryEntries: dailySales.map((entry) => ({
      date: entry.date,
      lottery_sales: entry.lottery_sales,
      lottery_payouts: 0,
      commission_percentage: 6,
      notes: "Sample onboarding data",
    })),
    deliEntries: dailySales.map((entry) => ({
      date: entry.date,
      deli_sales: entry.deli_sales + entry.hot_food_sales,
      food_cost: (entry.deli_sales + entry.hot_food_sales) * 0.38,
      waste_amount: 18 + entry.deli_sales * 0.01,
      notes: "Sample onboarding data",
    })),
    fuelGrades: [
      { name: "Regular", code: "REG", sort_order: 1, active: true, target_margin: 0.2, variance_threshold_gallons: 25, notes: "Sample grade" },
      { name: "Premium", code: "PREM", sort_order: 2, active: true, target_margin: 0.28, variance_threshold_gallons: 20, notes: "Sample grade" },
      { name: "Diesel", code: "DSL", sort_order: 3, active: true, target_margin: 0.25, variance_threshold_gallons: 25, notes: "Sample grade" },
    ],
    vendor: {
      name: "Capital Candy",
      normalized_name: "capital candy",
      category: "Capital Candy",
      total_spend: 1240,
      contact_person: "Demo account representative",
      phone: null,
      email: null,
      products_supplied: "Grocery, candy, snacks, drinks",
      average_weekly_spend: 2400,
      notes: "Sample onboarding data",
    },
    employee: {
      name: "Demo Cashier",
      role: "Employee/Cashier" as const,
      hourly_rate: 16.5,
      phone: null,
      email: null,
      active: true,
      notes: "Sample onboarding data",
    },
    product: {
      product_category_id: null,
      vendor_id: null,
      name: "Bottled Water 20 oz",
      sku_upc: "000000000001",
      category: "Drinks",
      unit_cost: 0.68,
      unit_retail_price: 1.79,
      quantity_on_hand: 48,
      reorder_level: 18,
      menu_export_enabled: false,
      menu_name: null,
      menu_description: null,
      menu_category: null,
      notes: "Sample onboarding data",
    },
  };
}

export type WorkflowMode = "morning" | "end_of_day" | "weekly" | "month_end";

export const ownerWorkflows: Record<WorkflowMode, { label: string; tasks: Array<{ id: string; label: string; href: string }> }> = {
  morning: {
    label: "Morning",
    tasks: [
      { id: "review-yesterday", label: "Review yesterday's sales and margin", href: "/dashboard" },
      { id: "check-cash", label: "Check unreconciled cash and card batches", href: "/cash-reconciliation" },
      { id: "review-stock", label: "Review low stock and open purchase orders", href: "/inventory" },
    ],
  },
  end_of_day: {
    label: "End of day",
    tasks: [
      { id: "enter-close", label: "Enter or import the daily close", href: "/daily-sales" },
      { id: "reconcile-drawer", label: "Reconcile drawer, cards, and deposit", href: "/cash-reconciliation" },
      { id: "check-fuel", label: "Record fuel readings and review variance", href: "/fuel-reconciliation" },
      { id: "review-imports", label: "Review exceptions from today's imports", href: "/smart-import" },
    ],
  },
  weekly: {
    label: "Weekly review",
    tasks: [
      { id: "weekly-pnl", label: "Review weekly P&L and payroll ratio", href: "/reports" },
      { id: "vendor-spend", label: "Compare vendor spend and cost increases", href: "/reports" },
      { id: "reorder", label: "Create purchase orders for reorder items", href: "/inventory" },
      { id: "payroll", label: "Confirm hours and weekly payroll", href: "/payroll" },
    ],
  },
  month_end: {
    label: "Month-end close",
    tasks: [
      { id: "month-complete", label: "Confirm every day or monthly total is entered", href: "/bulk-entry" },
      { id: "reconciliations", label: "Clear cash, card, bank, and fuel exceptions", href: "/cash-reconciliation" },
      { id: "inventory-value", label: "Review inventory value and shrink", href: "/reports" },
      { id: "export-package", label: "Export the accountant reporting package", href: "/reports" },
    ],
  },
};
