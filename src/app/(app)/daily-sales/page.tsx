"use client";

import { EntryManager } from "@/components/entry-manager";
import { currency, dailyFuelProfit, dailyLotteryProfit, todayIso } from "@/lib/calculations";

export default function DailySalesPage() {
  return (
    <EntryManager
      table="daily_sales"
      title="Daily Sales Entry"
      description="Capture your daily sales mix across inside sales, fuel, lottery, deli, cigarettes, beer, grocery, and other categories."
      helper="Fuel profit and lottery profit are calculated from the values you enter."
      defaultValues={{
        date: todayIso(),
        inside_sales: 0,
        fuel_gallons_sold: 0,
        fuel_retail_price: 0,
        fuel_cost_per_gallon: 0,
        lottery_sales: 0,
        lottery_payouts: 0,
        deli_sales: 0,
        cigarette_sales: 0,
        beer_sales: 0,
        grocery_sales: 0,
        other_sales: 0,
        notes: "",
      }}
      fields={[
        { name: "date", label: "Date", type: "date", required: true },
        { name: "inside_sales", label: "Inside sales", type: "number", min: "0", step: "0.01" },
        { name: "fuel_gallons_sold", label: "Fuel gallons sold", type: "number", min: "0", step: "0.001" },
        { name: "fuel_retail_price", label: "Fuel retail price", type: "number", min: "0", step: "0.001" },
        { name: "fuel_cost_per_gallon", label: "Fuel cost per gallon", type: "number", min: "0", step: "0.001" },
        { name: "lottery_sales", label: "Lottery sales", type: "number", min: "0", step: "0.01" },
        { name: "lottery_payouts", label: "Lottery payouts", type: "number", min: "0", step: "0.01" },
        { name: "deli_sales", label: "Deli sales", type: "number", min: "0", step: "0.01" },
        { name: "cigarette_sales", label: "Cigarette sales", type: "number", min: "0", step: "0.01" },
        { name: "beer_sales", label: "Beer sales", type: "number", min: "0", step: "0.01" },
        { name: "grocery_sales", label: "Grocery sales", type: "number", min: "0", step: "0.01" },
        { name: "other_sales", label: "Other sales", type: "number", min: "0", step: "0.01" },
        { name: "notes", label: "Notes", type: "textarea", className: "md:col-span-2 xl:col-span-3" },
      ]}
      columns={[
        { header: "Date", cell: (row) => row.date },
        { header: "Inside sales", cell: (row) => currency(row.inside_sales) },
        { header: "Fuel gallons", cell: (row) => row.fuel_gallons_sold.toLocaleString() },
        { header: "Fuel profit", cell: (row) => currency(dailyFuelProfit(row)) },
        { header: "Lottery profit", cell: (row) => currency(dailyLotteryProfit(row)) },
        { header: "Deli sales", cell: (row) => currency(row.deli_sales) },
      ]}
    />
  );
}
