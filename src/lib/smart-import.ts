import type {
  LearnedCategorizationRules,
  ParsedImportRow,
  SmartImportCategory,
  SmartImportDestination,
} from "@/lib/types";

export type RawImportLine = {
  rowIndex: number;
  date?: string | null;
  vendor?: string | null;
  description?: string | null;
  productName?: string | null;
  skuUpc?: string | null;
  quantity?: number | null;
  unitCost?: number | null;
  unitRetailPrice?: number | null;
  total?: number | null;
  rawData: Record<string, unknown>;
  columnNames?: string[];
};

type CategoryRule = {
  category: SmartImportCategory;
  destination: SmartImportDestination;
  keywords: string[];
  vendorKeywords?: string[];
  amountMin?: number;
  productOnly?: boolean;
};

const categoryRules: CategoryRule[] = [
  {
    category: "Capital Candy",
    destination: "product_sales",
    vendorKeywords: ["capital candy"],
    keywords: ["capital candy", "candy", "snack", "gum", "chocolate"],
  },
  {
    category: "Fuel purchase",
    destination: "fuel_entries",
    keywords: ["fuel", "gas", "rack", "unleaded", "diesel", "gallon", "terminal"],
  },
  {
    category: "Payroll",
    destination: "payroll_entries",
    vendorKeywords: ["adp", "paychex", "gusto"],
    keywords: ["payroll", "employee", "wages", "hours", "salary", "adp", "paychex"],
  },
  {
    category: "Utilities",
    destination: "expenses",
    vendorKeywords: ["eversource", "comcast", "verizon", "water", "electric", "gas utility"],
    keywords: ["eversource", "utility", "utilities", "electric", "water", "sewer", "internet", "phone"],
  },
  {
    category: "Rent/Mortgage",
    destination: "expenses",
    keywords: ["rent", "mortgage", "lease", "landlord"],
    amountMin: 500,
  },
  {
    category: "Insurance",
    destination: "expenses",
    keywords: ["insurance", "premium", "liability", "workers comp"],
  },
  {
    category: "Repairs",
    destination: "expenses",
    keywords: ["repair", "maintenance", "hvac", "plumbing", "electrician", "service call"],
  },
  {
    category: "Lottery",
    destination: "lottery_entries",
    keywords: ["lottery", "lotto", "scratch", "payout", "commission"],
  },
  {
    category: "Deli / Hot Food",
    destination: "deli_entries",
    keywords: ["deli", "hot food", "chicken", "pizza", "sandwich", "breakfast", "hot dog", "roller grill"],
  },
  {
    category: "Cigarettes / Tobacco",
    destination: "product_sales",
    keywords: ["marlboro", "newport", "camel", "cigarette", "tobacco", "zyn", "grizzly", "skoal", "juul", "vape"],
    productOnly: true,
  },
  {
    category: "Drinks",
    destination: "product_sales",
    keywords: ["coke", "pepsi", "red bull", "monster", "sprite", "fanta", "gatorade", "water", "soda", "energy"],
    productOnly: true,
  },
  {
    category: "Coffee",
    destination: "product_sales",
    keywords: ["coffee", "espresso", "latte", "cappuccino"],
    productOnly: true,
  },
  {
    category: "Beer / Alcohol",
    destination: "product_sales",
    keywords: ["beer", "bud", "budweiser", "coors", "miller", "modelo", "corona", "wine", "alcohol"],
    productOnly: true,
  },
  {
    category: "Candy",
    destination: "product_sales",
    keywords: ["candy", "snickers", "m&m", "reeses", "hershey", "skittles", "twix"],
    productOnly: true,
  },
  {
    category: "Snacks",
    destination: "product_sales",
    keywords: ["chips", "doritos", "lays", "pringles", "pretzel", "snack", "cracker"],
    productOnly: true,
  },
  {
    category: "Grocery",
    destination: "product_sales",
    keywords: ["grocery", "milk", "bread", "eggs", "produce", "household"],
    productOnly: true,
  },
  {
    category: "Supplies",
    destination: "expenses",
    keywords: ["supplies", "paper", "bags", "cups", "cleaning", "receipt paper"],
  },
  {
    category: "Taxes",
    destination: "expenses",
    keywords: ["tax", "irs", "department of revenue", "excise"],
  },
  {
    category: "Fees",
    destination: "expenses",
    keywords: ["fee", "bank charge", "service charge", "processing", "merchant"],
  },
];

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizedRuleKey(value: unknown) {
  return normalizeText(value);
}

export function parseMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? "")
    .replace(/\(([^)]+)\)/, "-$1")
    .replace(/[$,\s]/g, "");
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export function parseQuantity(value: unknown) {
  const parsed = parseMoney(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDateLike(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const iso = text.match(/\b(20\d{2}|19\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const us = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2}|19\d{2}|\d{2})\b/);
  if (us) {
    const [, month, day, rawYear] = us;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function textIncludesAny(text: string, keywords: string[] = []) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function inferGenericDestination(category: SmartImportCategory, hasProduct: boolean): SmartImportDestination {
  if (category === "Fuel purchase") return "fuel_entries";
  if (category === "Lottery") return "lottery_entries";
  if (category === "Deli / Hot Food") return "deli_entries";
  if (category === "Payroll") return "payroll_entries";
  if (hasProduct) {
    return "product_sales";
  }

  return "expenses";
}

export function categorizeImportLine(
  line: RawImportLine,
  fileType: string,
  learnedRules?: LearnedCategorizationRules,
): Pick<ParsedImportRow, "suggestedCategory" | "confidenceScore" | "importDestination" | "needsReview"> {
  const vendor = normalizeText(line.vendor);
  const description = normalizeText(line.description);
  const product = normalizeText(line.productName);
  const sku = normalizeText(line.skuUpc);
  const columns = normalizeText((line.columnNames ?? []).join(" "));
  const file = normalizeText(fileType);
  const total = Math.abs(line.total ?? 0);
  const combined = [vendor, description, product, columns, file].filter(Boolean).join(" ");
  const hasProduct = Boolean(product || line.skuUpc);

  let best: {
    category: SmartImportCategory;
    destination: SmartImportDestination;
    score: number;
  } = {
    category: "Other",
    destination: hasProduct ? "product_sales" : "needs_review",
    score: 0,
  };

  const productRule = learnedRules?.product_rules.find((rule) => {
    const ruleSku = normalizeText(rule.sku_upc);
    return (ruleSku && sku && ruleSku === sku) || (rule.normalized_product && product === rule.normalized_product);
  });
  if (productRule) {
    best = {
      category: productRule.category,
      destination: productRule.import_destination,
      score: 95,
    };
  }

  const vendorRule = learnedRules?.vendor_rules.find(
    (rule) => rule.normalized_vendor && vendor === rule.normalized_vendor,
  );
  if (vendorRule && vendorRule.confidence_score >= best.score) {
    best = {
      category: vendorRule.category,
      destination: vendorRule.import_destination,
      score: 95,
    };
  }

  const categoryRule = learnedRules?.category_rules.find((rule) => {
    const keyword = rule.normalized_keyword;
    return keyword && (description.includes(keyword) || product.includes(keyword) || combined.includes(keyword));
  });
  if (categoryRule && categoryRule.confidence_score >= best.score) {
    best = {
      category: categoryRule.category,
      destination: categoryRule.import_destination,
      score: 95,
    };
  }

  for (const rule of categoryRules) {
    let score = 0;

    if (rule.vendorKeywords && textIncludesAny(vendor, rule.vendorKeywords)) {
      score = Math.max(score, 70);
    }

    if (textIncludesAny(product, rule.keywords)) {
      score = Math.max(score, 85);
    }

    if (!rule.productOnly && textIncludesAny(description, rule.keywords)) {
      score = Math.max(score, 85);
    }

    if (textIncludesAny(columns, rule.keywords)) {
      score = Math.max(score, 50);
    }

    if (rule.amountMin && total >= rule.amountMin) {
      score = Math.max(score, 50);
    }

    if (score > best.score) {
      best = {
        category: rule.category,
        destination: rule.destination,
        score,
      };
    }
  }

  if (best.category === "Other") {
    if (combined.includes("pos") || combined.includes("sales report")) {
      best = { category: "Inventory", destination: "product_sales", score: 50 };
    } else if (combined.includes("invoice") && hasProduct) {
      best = { category: "Inventory", destination: "product_sales", score: 50 };
    } else if (total > 0) {
      best = { category: "Other", destination: "expenses", score: 50 };
    }
  }

  const confidenceScore = Math.max(0, Math.min(95, best.score));
  const needsReview = confidenceScore < 50 || best.destination === "needs_review" || !line.date || (!line.description && !line.productName);

  return {
    suggestedCategory: best.category,
    confidenceScore,
    importDestination: needsReview ? "needs_review" : inferGenericDestination(best.category, hasProduct) === "expenses" ? best.destination : inferGenericDestination(best.category, hasProduct),
    needsReview,
  };
}

export function rowGrossSales(row: Pick<ParsedImportRow, "quantity" | "unitRetailPrice" | "total">) {
  if (row.total) {
    return row.total;
  }

  return row.quantity * row.unitRetailPrice;
}

export function rowGrossProfit(row: Pick<ParsedImportRow, "quantity" | "unitCost" | "unitRetailPrice" | "total">) {
  const grossSales = rowGrossSales(row);
  const cost = row.quantity * row.unitCost;
  return grossSales - cost;
}

export function rowMarginPercent(row: Pick<ParsedImportRow, "quantity" | "unitCost" | "unitRetailPrice" | "total">) {
  const grossSales = rowGrossSales(row);
  return grossSales > 0 ? (rowGrossProfit(row) / grossSales) * 100 : 0;
}
