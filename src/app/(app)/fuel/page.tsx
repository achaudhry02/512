"use client";

import { EntryManager } from "@/components/entry-manager";
import { currency, fuelMargin, fuelProfit, numberFormatter, todayIso } from "@/lib/calculations";

export default function FuelPage() {
  return (
    <EntryManager
      table="fuel_entries"
      title="Fuel Tracking"
      description="Track gallons sold, retail price, cost per gallon, margin per gallon, and total fuel profit."
      helper="Margin per gallon and total fuel profit are calculated automatically."
      defaultValues={{
        date: todayIso(),
        gallons_sold: 0,
        cost_per_gallon: 0,
        retail_price_per_gallon: 0,
        notes: "",
      }}
      fields={[
        { name: "date", label: "Date", type: "date", required: true },
        { name: "gallons_sold", label: "Gallons sold", type: "number", min: "0", step: "0.001" },
        { name: "cost_per_gallon", label: "Cost per gallon", type: "number", min: "0", step: "0.001" },
        { name: "retail_price_per_gallon", label: "Retail price per gallon", type: "number", min: "0", step: "0.001" },
        { name: "notes", label: "Notes", type: "textarea", className: "md:col-span-2 xl:col-span-3" },
      ]}
      columns={[
        { header: "Date", cell: (row) => row.date },
        { header: "Gallons sold", cell: (row) => numberFormatter.format(row.gallons_sold) },
        { header: "Retail price", cell: (row) => currency(row.retail_price_per_gallon) },
        { header: "Cost", cell: (row) => currency(row.cost_per_gallon) },
        { header: "Margin / gal", cell: (row) => currency(fuelMargin(row)) },
        { header: "Total fuel profit", cell: (row) => currency(fuelProfit(row)) },
      ]}
    />
  );
}
