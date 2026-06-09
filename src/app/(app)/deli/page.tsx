"use client";

import { EntryManager } from "@/components/entry-manager";
import { currency, deliGrossProfit, todayIso } from "@/lib/calculations";

export default function DeliPage() {
  return (
    <EntryManager
      table="deli_entries"
      title="Deli / Hot Food Tracking"
      description="Track deli sales, food cost, waste, notes, and estimated gross profit."
      helper="Estimated gross profit is calculated as deli sales minus food cost and waste."
      defaultValues={{
        date: todayIso(),
        deli_sales: 0,
        food_cost: 0,
        waste_amount: 0,
        notes: "",
      }}
      fields={[
        { name: "date", label: "Date", type: "date", required: true },
        { name: "deli_sales", label: "Deli sales", type: "number", min: "0", step: "0.01" },
        { name: "food_cost", label: "Food cost", type: "number", min: "0", step: "0.01" },
        { name: "waste_amount", label: "Waste amount", type: "number", min: "0", step: "0.01" },
        { name: "notes", label: "Notes", type: "textarea", className: "md:col-span-2 xl:col-span-3" },
      ]}
      columns={[
        { header: "Date", cell: (row) => row.date },
        { header: "Deli sales", cell: (row) => currency(row.deli_sales) },
        { header: "Food cost", cell: (row) => currency(row.food_cost) },
        { header: "Waste", cell: (row) => currency(row.waste_amount) },
        { header: "Estimated gross profit", cell: (row) => currency(deliGrossProfit(row)) },
      ]}
    />
  );
}
