export type ExpenseCategory =
  | "Inventory"
  | "Inventory invoice"
  | "Vendor invoice"
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
  | "department_sales"
  | "store_sales_summaries"
  | "fuel_grade_sales"
  | "tender_sales"
  | "needs_review"
  | "ignore";

export type PosSystemKey =
  | "gilbarco_passport"
  | "verifone_commander"
  | "ncr_counterpoint"
  | "square"
  | "clover"
  | "lightspeed"
  | "shopify_pos"
  | "toast"
  | "shift4"
  | "heartland"
  | "cstoreoffice_petrosoft"
  | "pdi"
  | "ncr_radiant"
  | "generic";

export type PosFieldKey =
  | "date"
  | "transaction_id"
  | "department_category"
  | "item_name"
  | "sku_barcode"
  | "quantity_sold"
  | "gross_sales"
  | "discounts"
  | "refunds"
  | "voids"
  | "net_sales"
  | "tax"
  | "fees"
  | "cash_total"
  | "card_total"
  | "ebt_total"
  | "gift_card_total"
  | "other_payment_total"
  | "fuel_gallons"
  | "fuel_sales"
  | "fuel_cost"
  | "lottery_sales"
  | "vendor_category_notes";

export type PaymentMethod =
  | "Cash"
  | "Check"
  | "Credit Card"
  | "Debit Card"
  | "ACH"
  | "Other";

export type UserRole = "owner" | "manager" | "employee" | "accountant";

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  selected_store_id: string | null;
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

export type StoreMember = EntryBase & {
  role: UserRole;
  invited_email: string | null;
  accepted_at: string | null;
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
  hot_food_sales: number;
  cigarette_sales: number;
  beer_sales: number;
  grocery_sales: number;
  other_sales: number;
  cash_total: number;
  card_total: number;
  expenses: number;
  payroll: number;
  notes: string | null;
};

export type BulkMonthlyEntry = {
  date: string;
  grocery_sales: number;
  deli_sales: number;
  hot_food_sales: number;
  fuel_gallons_sold: number;
  fuel_price_per_gallon: number;
  fuel_cost_per_gallon: number;
  lottery_sales: number;
  beer_sales: number;
  cigarette_sales: number;
  other_sales: number;
  cash_total: number;
  card_total: number;
  expenses: number;
  payroll: number;
  notes: string | null;
};

export type MonthlyTotal = EntryBase & {
  year: number;
  month: number;
  grocery_sales: number;
  deli_sales: number;
  hot_food_sales: number;
  fuel_gallons_sold: number;
  fuel_revenue: number;
  fuel_cost: number;
  lottery_sales: number;
  beer_sales: number;
  cigarette_sales: number;
  vape_nicotine_sales: number;
  other_sales: number;
  cash_sales: number;
  card_sales: number;
  payroll: number;
  inventory_purchases: number;
  vendor_expenses: number;
  utilities: number;
  rent_mortgage: number;
  insurance: number;
  repairs_maintenance: number;
  miscellaneous_expenses: number;
  notes: string | null;
};

export type CashReconciliation = EntryBase & {
  date: string;
  starting_cash: number;
  ending_cash: number;
  expected_cash_sales: number;
  cash_drops: number;
  paid_outs: number;
  lottery_payouts: number;
  cash_over_short: number;
  pos_card_total: number;
  processor_card_total: number;
  ebt_total: number;
  gift_card_total: number;
  other_tender_total: number;
  bank_deposit_amount: number;
  status: "draft" | "balanced" | "needs_review";
  notes: string | null;
  expected_ending_cash?: number;
  variance?: number;
  is_balanced?: boolean;
};

export type PosSystem = EntryBase & {
  pos_key: PosSystemKey;
  name: string;
  enabled: boolean;
  notes: string | null;
};

export type PosColumnMapping = EntryBase & {
  pos_key: PosSystemKey;
  template_name: string;
  mapping: Partial<Record<PosFieldKey, string>>;
  is_default: boolean;
  notes: string | null;
};

export type PosImport = EntryBase & {
  pos_key: PosSystemKey;
  pos_name: string;
  original_file_name: string;
  file_type: string;
  file_size: number;
  file_hash: string;
  row_count: number;
  imported_row_count: number;
  status: "previewed" | "imported" | "failed";
  duplicate_strategy: "skip" | "overwrite";
  mapping_template_name: string | null;
  metadata: Record<string, unknown> | null;
};

export type PosImportRow = EntryBase & {
  pos_import_id: string;
  pos_key: PosSystemKey;
  pos_name: string;
  row_index: number;
  row_hash: string;
  transaction_id: string | null;
  date: string | null;
  department_category: string | null;
  item_name: string | null;
  sku_barcode: string | null;
  quantity_sold: number;
  gross_sales: number;
  discounts: number;
  refunds: number;
  voids: number;
  net_sales: number;
  tax: number;
  fees: number;
  cash_total: number;
  card_total: number;
  ebt_total: number;
  gift_card_total: number;
  other_payment_total: number;
  fuel_gallons: number;
  fuel_sales: number;
  fuel_cost: number;
  lottery_sales: number;
  vendor_category_notes: string | null;
  duplicate_key: string;
  import_action: "import" | "skip" | "overwrite";
  validation_errors: string[];
  raw_data: Record<string, unknown>;
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

export type FuelGrade = EntryBase & {
  name: string;
  code: string;
  sort_order: number;
  active: boolean;
  target_margin: number;
  variance_threshold_gallons: number;
  notes: string | null;
};

export type FuelDelivery = EntryBase & {
  date: string;
  fuel_grade_id: string;
  grade_name: string;
  delivered_gallons: number;
  rack_cost_per_gallon: number;
  invoice_number: string | null;
  vendor_name: string | null;
  notes: string | null;
};

export type FuelTankReading = EntryBase & {
  date: string;
  fuel_grade_id: string;
  grade_name: string;
  reading_type: "beginning" | "ending";
  gallons: number;
  notes: string | null;
};

export type FuelReconciliation = EntryBase & {
  date: string;
  fuel_grade_id: string;
  grade_name: string;
  beginning_gallons: number;
  delivered_gallons: number;
  sold_gallons: number;
  ending_gallons: number;
  actual_inventory: number;
  rack_cost_per_gallon: number;
  retail_price_per_gallon: number;
  target_margin: number;
  notes: string | null;
  book_inventory?: number;
  variance?: number;
  actual_margin?: number;
  suggested_price?: number;
  is_variance_alert?: boolean;
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
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  products_supplied: string | null;
  average_weekly_spend: number;
  notes: string | null;
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
  quantity_on_hand: number;
  reorder_level: number;
  notes: string | null;
};

export type Employee = EntryBase & {
  name: string;
  role: "Owner/Admin" | "Manager" | "Employee/Cashier";
  hourly_rate: number;
  phone: string | null;
  email: string | null;
  active: boolean;
  notes: string | null;
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

export type DepartmentSale = EntryBase & {
  import_id: string | null;
  report_start_date: string | null;
  report_end_date: string | null;
  department_name: string;
  gross_sales: number;
  item_count: number;
  refund_count: number;
  net_count: number;
  refund_amount: number;
  discount_amount: number;
  net_sales: number;
  percent_of_sales: number;
};

export type StoreSalesSummary = EntryBase & {
  import_id: string | null;
  report_start_date: string | null;
  report_end_date: string | null;
  grand_total_store_sales: number;
  total_fuel_sales_volume: number;
  total_fuel_sales_dollars: number;
  fuel_discounts: number;
  total_non_fuel_sales: number;
  other_discounts: number;
  total_taxes_collected: number;
  total_sales: number;
  total_revenue: number;
  network_revenue: number;
};

export type FuelGradeSale = EntryBase & {
  import_id: string | null;
  report_start_date: string | null;
  report_end_date: string | null;
  grade: string;
  grade_name: string;
  volume: number;
  sales: number;
  percent_of_total_fuel_sales: number;
};

export type TenderSale = EntryBase & {
  import_id: string | null;
  report_start_date: string | null;
  report_end_date: string | null;
  payment_method: string;
  count: number;
  sales_amount: number;
};

export type CategoryRuleRecord = EntryBase & {
  keyword: string;
  normalized_keyword: string;
  category: SmartImportCategory;
  import_destination: SmartImportDestination;
  confidence_score: number;
  usage_count: number;
};

export type VendorRuleRecord = EntryBase & {
  vendor_name: string;
  normalized_vendor: string;
  category: SmartImportCategory;
  import_destination: SmartImportDestination;
  confidence_score: number;
  usage_count: number;
};

export type ProductRuleRecord = EntryBase & {
  product_name: string;
  sku_upc: string | null;
  normalized_product: string;
  category: SmartImportCategory;
  import_destination: SmartImportDestination;
  confidence_score: number;
  usage_count: number;
};

export type LearnedCategorizationRules = {
  category_rules: CategoryRuleRecord[];
  vendor_rules: VendorRuleRecord[];
  product_rules: ProductRuleRecord[];
};

export type SunocoReportType = "department_sales" | "store_sales_summary";

export type ParsedDepartmentSaleRow = {
  departmentName: string;
  grossSales: number;
  itemCount: number;
  refundCount: number;
  netCount: number;
  refundAmount: number;
  discountAmount: number;
  netSales: number;
  percentOfSales: number;
};

export type ParsedFuelGradeSaleRow = {
  grade: string;
  gradeName: string;
  volume: number;
  sales: number;
  percentOfTotalFuelSales: number;
};

export type ParsedTenderSaleRow = {
  paymentMethod: string;
  count: number;
  salesAmount: number;
};

export type ParsedStoreSalesSummary = {
  grandTotalStoreSales: number;
  totalFuelSalesVolume: number;
  totalFuelSalesDollars: number;
  fuelDiscounts: number;
  totalNonFuelSales: number;
  otherDiscounts: number;
  totalTaxesCollected: number;
  totalSales: number;
  totalRevenue: number;
  networkRevenue: number;
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
  originalSuggestedCategory: SmartImportCategory;
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
  parser: "pdf-parse" | "papaparse" | "read-excel-file" | "sunoco-department-sales" | "sunoco-store-sales-summary";
  reportType?: SunocoReportType;
  reportStartDate?: string | null;
  reportEndDate?: string | null;
  parserAttempted?: string;
  extractionMethod?: "pdf-text" | "ocr" | "manual";
  extractedTextLength?: number;
  rawTextPreview?: string;
  pdfPreviewDataUrl?: string;
  manualReportType?: "department_sales" | "store_sales_summary" | "invoice" | "bank_statement";
  parseError?: string;
  departmentSalesRows?: ParsedDepartmentSaleRow[];
  storeSalesSummary?: ParsedStoreSalesSummary;
  fuelGradeSalesRows?: ParsedFuelGradeSaleRow[];
  tenderSalesRows?: ParsedTenderSaleRow[];
  warnings: string[];
  rows: ParsedImportRow[];
};

export type TableName =
  | "daily_sales"
  | "monthly_totals"
  | "cash_reconciliations"
  | "expenses"
  | "fuel_entries"
  | "fuel_grades"
  | "fuel_deliveries"
  | "fuel_tank_readings"
  | "fuel_reconciliations"
  | "lottery_entries"
  | "deli_entries"
  | "payroll_entries";

export type ResourceTableName = "products" | "vendors" | "employees";

export type TableRowMap = {
  daily_sales: DailySale;
  monthly_totals: MonthlyTotal;
  cash_reconciliations: CashReconciliation;
  expenses: Expense;
  fuel_entries: FuelEntry;
  fuel_grades: FuelGrade;
  fuel_deliveries: FuelDelivery;
  fuel_tank_readings: FuelTankReading;
  fuel_reconciliations: FuelReconciliation;
  lottery_entries: LotteryEntry;
  deli_entries: DeliEntry;
  payroll_entries: PayrollEntry;
};

export type ResourceRowMap = {
  products: Product;
  vendors: Vendor;
  employees: Employee;
};

export type CommandCenterData = {
  daily_sales: DailySale[];
  monthly_totals: MonthlyTotal[];
  cash_reconciliations: CashReconciliation[];
  expenses: Expense[];
  fuel_entries: FuelEntry[];
  fuel_grades: FuelGrade[];
  fuel_deliveries: FuelDelivery[];
  fuel_tank_readings: FuelTankReading[];
  fuel_reconciliations: FuelReconciliation[];
  lottery_entries: LotteryEntry[];
  deli_entries: DeliEntry[];
  payroll_entries: PayrollEntry[];
  pos_systems: PosSystem[];
  pos_imports: PosImport[];
  pos_column_mappings: PosColumnMapping[];
  pos_import_rows: PosImportRow[];
  imports: ImportRecord[];
  import_rows: ImportRow[];
  vendors: Vendor[];
  employees: Employee[];
  product_categories: ProductCategory[];
  products: Product[];
  product_sales: ProductSale[];
  department_sales: DepartmentSale[];
  store_sales_summaries: StoreSalesSummary[];
  fuel_grade_sales: FuelGradeSale[];
  tender_sales: TenderSale[];
  category_rules: CategoryRuleRecord[];
  vendor_rules: VendorRuleRecord[];
  product_rules: ProductRuleRecord[];
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
  "Inventory invoice",
  "Vendor invoice",
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
  "department_sales",
  "store_sales_summaries",
  "fuel_grade_sales",
  "tender_sales",
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

export const storeCategories = [
  "Grocery",
  "Deli",
  "Hot food",
  "Fuel",
  "Lottery",
  "Beer",
  "Cigarettes",
  "Drinks",
  "Snacks",
  "Household",
  "Other",
] as const;
