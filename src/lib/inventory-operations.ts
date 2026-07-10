import type {
  InventoryAdjustment,
  Product,
  ProductSale,
  VendorItemCost,
} from "@/lib/types";

const DAY_MS = 86_400_000;

function startOfDay(value: Date | string) {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function productMarginPercent(product: Pick<Product, "unit_cost" | "unit_retail_price">) {
  if (product.unit_retail_price <= 0) return 0;
  return ((product.unit_retail_price - product.unit_cost) / product.unit_retail_price) * 100;
}

export function inventoryInsights(
  products: Product[],
  sales: ProductSale[],
  adjustments: InventoryAdjustment[],
  vendorCosts: VendorItemCost[],
  asOf: Date | string = new Date(),
  deadStockDays = 60,
) {
  const asOfDate = startOfDay(asOf);
  const salesWindowStart = new Date(asOfDate.getTime() - 29 * DAY_MS);
  const deadStockCutoff = new Date(asOfDate.getTime() - deadStockDays * DAY_MS);
  const productById = new Map(products.map((product) => [product.id, product]));
  const salesByProduct = new Map<string, { quantity30: number; revenue30: number; lastSale: Date | null }>();

  for (const sale of sales) {
    if (!sale.product_id) continue;
    const saleDate = startOfDay(sale.date);
    if (saleDate > asOfDate) continue;
    const current = salesByProduct.get(sale.product_id) ?? { quantity30: 0, revenue30: 0, lastSale: null };
    if (!current.lastSale || saleDate > current.lastSale) current.lastSale = saleDate;
    if (saleDate >= salesWindowStart) {
      current.quantity30 += sale.quantity_sold;
      current.revenue30 += sale.gross_sales;
    }
    salesByProduct.set(sale.product_id, current);
  }

  const lowStock = products
    .filter((product) => product.quantity_on_hand <= product.reorder_level)
    .sort((left, right) => left.quantity_on_hand - right.quantity_on_hand);

  const reorderSuggestions = lowStock.map((product) => {
    const quantitySold30 = salesByProduct.get(product.id)?.quantity30 ?? 0;
    const twoWeekDemand = Math.ceil((quantitySold30 / 30) * 14);
    const targetStock = Math.max(product.reorder_level * 2, twoWeekDemand, 1);
    return {
      productId: product.id,
      productName: product.name,
      skuUpc: product.sku_upc,
      quantityOnHand: product.quantity_on_hand,
      reorderLevel: product.reorder_level,
      quantitySold30,
      suggestedQuantity: Math.max(1, Math.ceil(targetStock - product.quantity_on_hand)),
      estimatedCost: Math.max(1, Math.ceil(targetStock - product.quantity_on_hand)) * product.unit_cost,
    };
  });

  const deadStock = products
    .filter((product) => {
      if (product.quantity_on_hand <= 0) return false;
      const lastSale = salesByProduct.get(product.id)?.lastSale;
      return !lastSale || lastSale < deadStockCutoff;
    })
    .map((product) => ({
      product,
      lastSaleDate: salesByProduct.get(product.id)?.lastSale?.toISOString().slice(0, 10) ?? null,
      tiedUpValue: product.quantity_on_hand * product.unit_cost,
    }))
    .sort((left, right) => right.tiedUpValue - left.tiedUpValue);

  const fastMovers = products
    .map((product) => ({
      product,
      quantitySold30: salesByProduct.get(product.id)?.quantity30 ?? 0,
      revenue30: salesByProduct.get(product.id)?.revenue30 ?? 0,
    }))
    .filter((entry) => entry.quantitySold30 > 0)
    .sort((left, right) => right.quantitySold30 - left.quantitySold30);

  const highMargin = products
    .map((product) => ({ product, marginPercent: productMarginPercent(product) }))
    .filter((entry) => entry.product.unit_retail_price > 0)
    .sort((left, right) => right.marginPercent - left.marginPercent);

  const costsByProductVendor = new Map<string, VendorItemCost[]>();
  for (const cost of vendorCosts) {
    const key = `${cost.product_id}:${cost.vendor_id}`;
    costsByProductVendor.set(key, [...(costsByProductVendor.get(key) ?? []), cost]);
  }
  const costIncreases = Array.from(costsByProductVendor.values()).flatMap((costs) => {
    const ordered = [...costs].sort((left, right) =>
      `${right.effective_date}:${right.created_at ?? ""}`.localeCompare(`${left.effective_date}:${left.created_at ?? ""}`),
    );
    if (ordered.length < 2 || ordered[0].unit_cost <= ordered[1].unit_cost) return [];
    const previousCost = ordered[1].unit_cost;
    return [{
      productId: ordered[0].product_id,
      productName: productById.get(ordered[0].product_id)?.name ?? "Unknown product",
      vendorId: ordered[0].vendor_id,
      previousCost,
      currentCost: ordered[0].unit_cost,
      increasePercent: previousCost > 0 ? ((ordered[0].unit_cost - previousCost) / previousCost) * 100 : 0,
      effectiveDate: ordered[0].effective_date,
    }];
  }).sort((left, right) => right.increasePercent - left.increasePercent);

  const shrinkLoss = adjustments.reduce(
    (summary, adjustment) => {
      if (!(["shrink", "loss", "damage"] as string[]).includes(adjustment.adjustment_type)) return summary;
      const units = Math.abs(Math.min(0, adjustment.quantity_delta));
      const unitCost = adjustment.unit_cost ?? productById.get(adjustment.product_id)?.unit_cost ?? 0;
      summary.units += units;
      summary.cost += units * unitCost;
      return summary;
    },
    { units: 0, cost: 0 },
  );

  return {
    inventoryValue: products.reduce((total, product) => total + product.quantity_on_hand * product.unit_cost, 0),
    lowStock,
    reorderSuggestions,
    deadStock,
    fastMovers,
    highMargin,
    costIncreases,
    shrinkLoss,
  };
}

export function buildMenuExportCsv(products: Product[]) {
  const headers = ["name", "description", "category", "sku_barcode", "price", "quantity_available", "active"];
  const rows = products
    .filter((product) => product.menu_export_enabled)
    .map((product) => [
      product.menu_name || product.name,
      product.menu_description || "",
      product.menu_category || product.category,
      product.sku_upc || "",
      product.unit_retail_price.toFixed(2),
      Math.max(0, product.quantity_on_hand),
      product.quantity_on_hand > 0 ? "true" : "false",
    ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
