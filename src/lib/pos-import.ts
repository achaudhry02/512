import type { PosFieldKey, PosImportRow, PosSystemKey } from "@/lib/types";

export type PosSystemOption = {
  key: PosSystemKey;
  name: string;
  notes: string;
};

export type PosMapping = Partial<Record<PosFieldKey, string>>;

export type PosPreviewRow = Omit<
  PosImportRow,
  "id" | "user_id" | "store_id" | "created_at" | "updated_at" | "pos_import_id"
>;

export const posSystems: PosSystemOption[] = [
  { key: "gilbarco_passport", name: "Gilbarco Passport", notes: "Common C-store closeout and department exports." },
  { key: "verifone_commander", name: "Verifone Commander", notes: "Commander and Ruby/Topaz style day close exports." },
  { key: "ncr_counterpoint", name: "NCR Counterpoint", notes: "Retail item, department, and tender exports." },
  { key: "square", name: "Square", notes: "Transaction, item, category, and tender CSV exports." },
  { key: "clover", name: "Clover", notes: "Orders, payments, item sales, and discounts exports." },
  { key: "lightspeed", name: "Lightspeed", notes: "Retail item and payment reports." },
  { key: "shopify_pos", name: "Shopify POS", notes: "Orders and line-item CSV exports." },
  { key: "toast", name: "Toast", notes: "Restaurant-style sales and payment reports." },
  { key: "shift4", name: "Shift4", notes: "Payment and POS sales exports." },
  { key: "heartland", name: "Heartland", notes: "Retail and payment report exports." },
  { key: "cstoreoffice_petrosoft", name: "CStoreOffice / Petrosoft", notes: "C-store back-office department and fuel exports." },
  { key: "pdi", name: "PDI", notes: "Enterprise C-store back-office reports." },
  { key: "ncr_radiant", name: "NCR / Radiant", notes: "Legacy Radiant/NCR POS closeout reports." },
  { key: "generic", name: "Generic POS CSV", notes: "Flexible template for any POS CSV or spreadsheet export." },
];

export const posFieldLabels: Record<PosFieldKey, string> = {
  date: "Date",
  transaction_id: "Transaction / import ID",
  department_category: "Department / category",
  item_name: "Item name",
  sku_barcode: "SKU / barcode",
  quantity_sold: "Quantity sold",
  gross_sales: "Gross sales",
  discounts: "Discounts",
  refunds: "Refunds",
  voids: "Voids",
  net_sales: "Net sales",
  tax: "Tax",
  fees: "Fees",
  cash_total: "Cash total",
  card_total: "Card total",
  ebt_total: "EBT total",
  gift_card_total: "Gift card total",
  other_payment_total: "Other payment total",
  fuel_gallons: "Fuel gallons",
  fuel_sales: "Fuel sales",
  fuel_cost: "Fuel cost",
  lottery_sales: "Lottery sales",
  vendor_category_notes: "Vendor / category notes",
};

export const posNumericFields: PosFieldKey[] = [
  "quantity_sold",
  "gross_sales",
  "discounts",
  "refunds",
  "voids",
  "net_sales",
  "tax",
  "fees",
  "cash_total",
  "card_total",
  "ebt_total",
  "gift_card_total",
  "other_payment_total",
  "fuel_gallons",
  "fuel_sales",
  "fuel_cost",
  "lottery_sales",
];

export const posFieldOrder = Object.keys(posFieldLabels) as PosFieldKey[];

const genericMapping: PosMapping = {
  date: "date",
  transaction_id: "transaction_id",
  department_category: "department_category",
  item_name: "item_name",
  sku_barcode: "sku_barcode",
  quantity_sold: "quantity_sold",
  gross_sales: "gross_sales",
  discounts: "discounts",
  refunds: "refunds",
  voids: "voids",
  net_sales: "net_sales",
  tax: "tax",
  fees: "fees",
  cash_total: "cash_total",
  card_total: "card_total",
  ebt_total: "ebt_total",
  gift_card_total: "gift_card_total",
  other_payment_total: "other_payment_total",
  fuel_gallons: "fuel_gallons",
  fuel_sales: "fuel_sales",
  fuel_cost: "fuel_cost",
  lottery_sales: "lottery_sales",
  vendor_category_notes: "vendor_category_notes",
};

export const defaultPosMappings: Record<PosSystemKey, PosMapping> = {
  generic: genericMapping,
  gilbarco_passport: {
    date: "Business Date",
    transaction_id: "Report ID",
    department_category: "Department",
    item_name: "Description",
    quantity_sold: "Qty Sold",
    gross_sales: "Gross Sales",
    discounts: "Discounts",
    refunds: "Refunds",
    net_sales: "Net Sales",
    tax: "Tax",
    cash_total: "Cash",
    card_total: "Credit/Debit",
    fuel_gallons: "Fuel Gallons",
    fuel_sales: "Fuel Sales",
    lottery_sales: "Lottery Sales",
  },
  verifone_commander: {
    date: "Date",
    transaction_id: "Closeout ID",
    department_category: "Dept Name",
    item_name: "Item Description",
    sku_barcode: "UPC",
    quantity_sold: "Quantity",
    gross_sales: "Gross Amount",
    discounts: "Discount Amount",
    refunds: "Refund Amount",
    net_sales: "Net Amount",
    tax: "Tax Amount",
    cash_total: "Cash Amount",
    card_total: "Card Amount",
    fuel_gallons: "Gallons",
    fuel_sales: "Fuel Amount",
  },
  square: {
    date: "Date",
    transaction_id: "Transaction ID",
    department_category: "Category",
    item_name: "Item",
    sku_barcode: "SKU",
    quantity_sold: "Qty",
    gross_sales: "Gross Sales",
    discounts: "Discounts",
    refunds: "Refunds",
    net_sales: "Net Sales",
    tax: "Tax",
    cash_total: "Cash",
    card_total: "Card",
    gift_card_total: "Gift Card",
  },
  clover: {
    date: "Order Date",
    transaction_id: "Order ID",
    department_category: "Category",
    item_name: "Item",
    sku_barcode: "SKU",
    quantity_sold: "Quantity",
    gross_sales: "Gross Sales",
    discounts: "Discounts",
    refunds: "Refunds",
    net_sales: "Net Sales",
    tax: "Taxes",
    cash_total: "Cash",
    card_total: "Credit Card",
    gift_card_total: "Gift Card",
  },
  shopify_pos: {
    date: "Paid at",
    transaction_id: "Name",
    department_category: "Lineitem fulfillment status",
    item_name: "Lineitem name",
    sku_barcode: "Lineitem sku",
    quantity_sold: "Lineitem quantity",
    gross_sales: "Lineitem price",
    discounts: "Discount Amount",
    refunds: "Refunded Amount",
    net_sales: "Total",
    tax: "Taxes",
  },
  ncr_counterpoint: genericMapping,
  lightspeed: genericMapping,
  toast: genericMapping,
  shift4: genericMapping,
  heartland: genericMapping,
  cstoreoffice_petrosoft: genericMapping,
  pdi: genericMapping,
  ncr_radiant: genericMapping,
};

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function findMappedValue(row: Record<string, unknown>, sourceColumn?: string) {
  if (!sourceColumn) return "";
  const direct = row[sourceColumn];
  if (direct !== undefined && direct !== null) return String(direct);
  const normalized = normalizeHeader(sourceColumn);
  const key = Object.keys(row).find((header) => normalizeHeader(header) === normalized);
  const value = key ? row[key] : "";
  return value === undefined || value === null ? "" : String(value);
}

export function parsePosNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const negative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[,$()%\s]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return negative ? -parsed : parsed;
}

export function normalizePosDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function duplicateKeyForPosRow(row: Pick<PosPreviewRow, "pos_key" | "transaction_id" | "date" | "department_category" | "item_name" | "row_index">) {
  const transaction = row.transaction_id?.trim();
  if (row.date && transaction) {
    return [
      row.pos_key,
      row.date,
      `txn:${transaction}`,
      row.department_category ?? "",
      row.item_name ?? "",
    ].join("|");
  }

  return `${row.pos_key}|${row.date ?? "missing-date"}|row:${row.row_index}|${row.department_category ?? ""}|${row.item_name ?? ""}`;
}

export function rowHashForPosRow(row: Pick<PosPreviewRow, "duplicate_key" | "net_sales" | "gross_sales" | "fuel_sales" | "fuel_gallons" | "tax">) {
  return [
    row.duplicate_key,
    row.net_sales.toFixed(2),
    row.gross_sales.toFixed(2),
    row.fuel_sales.toFixed(2),
    row.fuel_gallons.toFixed(3),
    row.tax.toFixed(2),
  ].join("|");
}

export function mapRowsToPosPreview(
  rows: Record<string, unknown>[],
  mapping: PosMapping,
  posKey: PosSystemKey,
  posName: string,
  existingDuplicateKeys: ReadonlySet<string> = new Set(),
): PosPreviewRow[] {
  return rows.map((rawRow, index) => {
    const validationErrors: string[] = [];
    const date = normalizePosDate(findMappedValue(rawRow, mapping.date));
    if (!date) validationErrors.push("Missing or invalid date.");

    const numericValues = posNumericFields.reduce<Record<string, number>>((values, field) => {
      const sourceValue = findMappedValue(rawRow, mapping[field]);
      const parsed = parsePosNumber(sourceValue);
      if (Number.isNaN(parsed)) {
        validationErrors.push(`Bad number for ${posFieldLabels[field]}.`);
        values[field] = 0;
      } else {
        values[field] = parsed;
      }
      return values;
    }, {});

    const previewBase = {
      pos_key: posKey,
      pos_name: posName,
      row_index: index + 1,
      row_hash: "",
      transaction_id: findMappedValue(rawRow, mapping.transaction_id).trim() || null,
      date,
      department_category: findMappedValue(rawRow, mapping.department_category).trim() || null,
      item_name: findMappedValue(rawRow, mapping.item_name).trim() || null,
      sku_barcode: findMappedValue(rawRow, mapping.sku_barcode).trim() || null,
      quantity_sold: numericValues.quantity_sold ?? 0,
      gross_sales: numericValues.gross_sales ?? 0,
      discounts: numericValues.discounts ?? 0,
      refunds: numericValues.refunds ?? 0,
      voids: numericValues.voids ?? 0,
      net_sales: numericValues.net_sales ?? 0,
      tax: numericValues.tax ?? 0,
      fees: numericValues.fees ?? 0,
      cash_total: numericValues.cash_total ?? 0,
      card_total: numericValues.card_total ?? 0,
      ebt_total: numericValues.ebt_total ?? 0,
      gift_card_total: numericValues.gift_card_total ?? 0,
      other_payment_total: numericValues.other_payment_total ?? 0,
      fuel_gallons: numericValues.fuel_gallons ?? 0,
      fuel_sales: numericValues.fuel_sales ?? 0,
      fuel_cost: numericValues.fuel_cost ?? 0,
      lottery_sales: numericValues.lottery_sales ?? 0,
      vendor_category_notes: findMappedValue(rawRow, mapping.vendor_category_notes).trim() || null,
      duplicate_key: "",
      import_action: "import" as const,
      validation_errors: validationErrors,
      raw_data: rawRow,
    };
    const duplicateKey = duplicateKeyForPosRow(previewBase);
    const duplicate = existingDuplicateKeys.has(duplicateKey);
    const rowHash = rowHashForPosRow({ ...previewBase, duplicate_key: duplicateKey });

    return {
      ...previewBase,
      duplicate_key: duplicateKey,
      row_hash: rowHash,
      import_action: duplicate ? "skip" : "import",
      validation_errors: duplicate ? [...validationErrors, "Duplicate POS date/source/transaction detected."] : validationErrors,
    };
  });
}

export function validatePosPreviewRows(rows: PosPreviewRow[]) {
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.date) {
      errors.push(`Row ${row.row_index}: missing date.`);
    }
    if (seen.has(row.duplicate_key)) {
      errors.push(`Row ${row.row_index}: duplicate key appears more than once in this upload.`);
    }
    seen.add(row.duplicate_key);
    for (const error of row.validation_errors.filter((message) => !message.startsWith("Duplicate POS"))) {
      errors.push(`Row ${row.row_index}: ${error}`);
    }
  }

  return errors;
}

export function genericPosTemplateCsv() {
  const headers = posFieldOrder.map((field) => genericMapping[field] ?? field);
  const rows = [
    headers,
    [
      "2026-07-01",
      "TXN-1001",
      "Grocery",
      "Bottled Water 20 oz",
      "1001001001",
      "12",
      "17.88",
      "0.00",
      "0.00",
      "0.00",
      "17.88",
      "1.07",
      "0.00",
      "25.00",
      "120.00",
      "0.00",
      "0.00",
      "0.00",
      "0.00",
      "0.00",
      "0.00",
      "0.00",
      "Imported sample row",
    ],
  ];
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
}
