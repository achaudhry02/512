export type ExpenseCategory =
  | "Inventory"
  | "Payroll"
  | "Rent/Mortgage"
  | "Utilities"
  | "Insurance"
  | "Repairs"
  | "Fuel purchase"
  | "Capital Candy"
  | "Taxes"
  | "Other";

export type PaymentMethod =
  | "Cash"
  | "Check"
  | "Credit Card"
  | "Debit Card"
  | "ACH"
  | "Other";

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Store = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EntryBase = {
  id: string;
  user_id: string;
  store_id: string;
  created_at?: string;
  updated_at?: string;
};

export type DailySale = EntryBase & {
  date: string;
  inside_sales: number;
  fuel_gallons_sold: number;
  fuel_retail_price: number;
  fuel_cost_per_gallon: number;
  lottery_sales: number;
  lottery_payouts: number;
  deli_sales: number;
  cigarette_sales: number;
  beer_sales: number;
  grocery_sales: number;
  other_sales: number;
  notes: string | null;
};

export type Expense = EntryBase & {
  date: string;
  vendor_name: string;
  category: ExpenseCategory;
  amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
};

export type FuelEntry = EntryBase & {
  date: string;
  gallons_sold: number;
  cost_per_gallon: number;
  retail_price_per_gallon: number;
  notes: string | null;
};

export type LotteryEntry = EntryBase & {
  date: string;
  lottery_sales: number;
  lottery_payouts: number;
  commission_percentage: number;
  notes: string | null;
};

export type DeliEntry = EntryBase & {
  date: string;
  deli_sales: number;
  food_cost: number;
  waste_amount: number;
  notes: string | null;
};

export type PayrollEntry = EntryBase & {
  employee_name: string;
  date_range_start: string;
  date_range_end: string;
  hours_worked: number;
  hourly_rate: number;
  notes: string | null;
};

export type TableName =
  | "daily_sales"
  | "expenses"
  | "fuel_entries"
  | "lottery_entries"
  | "deli_entries"
  | "payroll_entries";

export type TableRowMap = {
  daily_sales: DailySale;
  expenses: Expense;
  fuel_entries: FuelEntry;
  lottery_entries: LotteryEntry;
  deli_entries: DeliEntry;
  payroll_entries: PayrollEntry;
};

export type CommandCenterData = {
  daily_sales: DailySale[];
  expenses: Expense[];
  fuel_entries: FuelEntry[];
  lottery_entries: LotteryEntry[];
  deli_entries: DeliEntry[];
  payroll_entries: PayrollEntry[];
};

export type DashboardMetric = {
  label: string;
  value: number;
  helper?: string;
};

export type ProfitLeakFinding = {
  id: string;
  type:
    | "high_expense_category"
    | "low_fuel_margin"
    | "deli_waste"
    | "payroll_ratio"
    | "vendor_increase"
    | "low_profit_margin";
  severity: "critical" | "warning" | "watch";
  title: string;
  description: string;
  recommendation: string;
  metric: string;
  date?: string;
  impact?: number;
};

export const expenseCategories: ExpenseCategory[] = [
  "Inventory",
  "Payroll",
  "Rent/Mortgage",
  "Utilities",
  "Insurance",
  "Repairs",
  "Fuel purchase",
  "Capital Candy",
  "Taxes",
  "Other",
];

export const paymentMethods: PaymentMethod[] = [
  "Cash",
  "Check",
  "Credit Card",
  "Debit Card",
  "ACH",
  "Other",
];
