export type ExpenseCategory =
  | "Inventory"
  | "Capital Candy"
  | "Fuel purchase"
  | "Payroll"
  | "Rent/Mortgage"
  | "Utilities"
  | "Insurance"
  | "Repairs"
  | "Lottery"
  | "Deli / Hot Food"
  | "Cigarettes / Tobacco"
  | "Beer / Alcohol"
  | "Grocery"
  | "Drinks"
  | "Candy"
  | "Snacks"
  | "Coffee"
  | "Supplies"
  | "Taxes"
  | "Fees"
  | "Other";

export type SmartImportCategory = ExpenseCategory;

export type SmartImportDestination =
  | "expenses"
  | "daily_sales"
  | "fuel_entries"
  | "lottery_entries"
  | "deli_entries"
  | "payroll_entries"
  | "product_sales"
  | "needs_review"
  | "ignore";

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

export type ImportRecord = EntryBase & {
  original_file_name: string;
  file_type: string;
  file_size: number;
  file_hash: string;
  row_count: number;
  status: "reviewed" | "imported" | "duplicate" | "failed";
  metadata: Record<string, unknown> | null;
};

export type ImportRow = EntryBase & {
  import_id: string;
  row_index: number;
  row_hash: string;
  date: string | null;
  vendor: string | null;
  description: string | null;
  product_name: string | null;
  sku_upc: string | null;
  quantity: number;
  unit_cost: number;
  unit_retail_price: number;
  total: number;
  suggested_category: SmartImportCategory;
  confidence_score: number;
  import_destination: SmartImportDestination;
  needs_review: boolean;
  ignored: boolean;
  raw_data: Record<string, unknown> | null;
  imported_at?: string | null;
};

export type Vendor = EntryBase & {
  name: string;
  normalized_name: string;
  category: SmartImportCategory;
  total_spend: number;
};

export type ProductCategory = EntryBase & {
  name: SmartImportCategory;
  parent_category: string | null;
};

export type Product = EntryBase & {
  product_category_id: string | null;
  vendor_id: string | null;
  name: string;
  sku_upc: string | null;
  category: SmartImportCategory;
  unit_cost: number;
  unit_retail_price: number;
};

export type ProductSale = EntryBase & {
  import_id: string | null;
  import_row_id: string | null;
  product_id: string | null;
  vendor_id: string | null;
  date: string;
  product_name: string;
  sku_upc: string | null;
  quantity_sold: number;
  unit_cost: number;
  unit_retail_price: number;
  gross_sales: number;
  gross_profit: number;
  margin_percent: number;
  category: SmartImportCategory;
  vendor: string | null;
};

export type ParsedImportRow = {
  rowIndex: number;
  rowHash: string;
  date: string | null;
  vendor: string;
  description: string;
  productName: string;
  skuUpc: string;
  quantity: number;
  unitCost: number;
  unitRetailPrice: number;
  total: number;
  suggestedCategory: SmartImportCategory;
  confidenceScore: number;
  importDestination: SmartImportDestination;
  needsReview: boolean;
  ignored: boolean;
  rawData: Record<string, unknown>;
};

export type ParsedImportResult = {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  parser: "pdf-parse" | "papaparse" | "read-excel-file";
  warnings: string[];
  rows: ParsedImportRow[];
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
  imports: ImportRecord[];
  import_rows: ImportRow[];
  vendors: Vendor[];
  product_categories: ProductCategory[];
  products: Product[];
  product_sales: ProductSale[];
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
  "Capital Candy",
  "Fuel purchase",
  "Payroll",
  "Rent/Mortgage",
  "Utilities",
  "Insurance",
  "Repairs",
  "Lottery",
  "Deli / Hot Food",
  "Cigarettes / Tobacco",
  "Beer / Alcohol",
  "Grocery",
  "Drinks",
  "Candy",
  "Snacks",
  "Coffee",
  "Supplies",
  "Taxes",
  "Fees",
  "Other",
];

export const smartImportDestinations: SmartImportDestination[] = [
  "expenses",
  "daily_sales",
  "fuel_entries",
  "lottery_entries",
  "deli_entries",
  "payroll_entries",
  "product_sales",
  "needs_review",
  "ignore",
];

export const paymentMethods: PaymentMethod[] = [
  "Cash",
  "Check",
  "Credit Card",
  "Debit Card",
  "ACH",
  "Other",
];
