"use client";

import { EntryManager } from "@/components/entry-manager";
import { currency, lotteryProfit, percent, todayIso } from "@/lib/calculations";

export default function LotteryPage() {
  return (
    <EntryManager
      table="lottery_entries"
      title="Lottery Tracking"
      description="Track lottery sales, payouts, commission percentage, and net lottery profit."
      helper="Net lottery profit is calculated as sales commission minus payouts."
      defaultValues={{
        date: todayIso(),
        lottery_sales: 0,
        lottery_payouts: 0,
        commission_percentage: 6,
        notes: "",
      }}
      fields={[
        { name: "date", label: "Date", type: "date", required: true },
        { name: "lottery_sales", label: "Lottery sales", type: "number", min: "0", step: "0.01" },
        { name: "lottery_payouts", label: "Lottery payouts", type: "number", min: "0", step: "0.01" },
        { name: "commission_percentage", label: "Commission percentage", type: "number", min: "0", step: "0.01" },
        { name: "notes", label: "Notes", type: "textarea", className: "md:col-span-2 xl:col-span-3" },
      ]}
      columns={[
        { header: "Date", cell: (row) => row.date },
        { header: "Lottery sales", cell: (row) => currency(row.lottery_sales) },
        { header: "Payouts", cell: (row) => currency(row.lottery_payouts) },
        { header: "Commission", cell: (row) => percent(row.commission_percentage) },
        { header: "Net lottery profit", cell: (row) => currency(lotteryProfit(row)) },
      ]}
    />
  );
}
