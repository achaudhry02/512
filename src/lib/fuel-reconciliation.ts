import type { FuelEntry, FuelReconciliation, PosImportRow } from "@/lib/types";

export type FuelReconciliationInput = Pick<
  FuelReconciliation,
  | "beginning_gallons"
  | "delivered_gallons"
  | "sold_gallons"
  | "ending_gallons"
  | "actual_inventory"
  | "rack_cost_per_gallon"
  | "retail_price_per_gallon"
  | "target_margin"
>;

export function calculateFuelReconciliation(input: FuelReconciliationInput, varianceThresholdGallons = 25) {
  const bookInventory = input.beginning_gallons + input.delivered_gallons - input.sold_gallons;
  const actualInventory = input.actual_inventory || input.ending_gallons;
  const variance = actualInventory - bookInventory;
  const actualMargin = input.retail_price_per_gallon - input.rack_cost_per_gallon;
  const suggestedPrice = input.rack_cost_per_gallon + input.target_margin;
  const isVarianceAlert = Math.abs(variance) > varianceThresholdGallons;

  return {
    bookInventory,
    actualInventory,
    variance,
    actualMargin,
    suggestedPrice,
    isVarianceAlert,
  };
}

export function soldGallonsForDate(date: string, fuelEntries: FuelEntry[], posRows: PosImportRow[]) {
  const posGallons = posRows
    .filter((row) => row.date === date)
    .reduce((total, row) => total + row.fuel_gallons, 0);

  if (posGallons > 0) {
    return {
      source: "POS imports" as const,
      gallons: posGallons,
    };
  }

  return {
    source: "Manual fuel entries" as const,
    gallons: fuelEntries
      .filter((entry) => entry.date === date)
      .reduce((total, entry) => total + entry.gallons_sold, 0),
  };
}

export function fuelReconciliationTotals(reconciliations: FuelReconciliation[]) {
  return reconciliations.reduce(
    (totals, entry) => {
      const math = calculateFuelReconciliation(entry);
      totals.totalVariance += entry.variance ?? math.variance;
      totals.alertCount += (entry.is_variance_alert ?? math.isVarianceAlert) ? 1 : 0;
      if (math.actualMargin < entry.target_margin) {
        totals.lowMarginCount += 1;
      }
      return totals;
    },
    {
      totalVariance: 0,
      alertCount: 0,
      lowMarginCount: 0,
    },
  );
}
