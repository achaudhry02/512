"use client";

import { EntryManager } from "@/components/entry-manager";
import { currency, todayIso } from "@/lib/calculations";
import { expenseCategories, paymentMethods } from "@/lib/types";

export default function ExpensesPage() {
  return (
    <EntryManager
      table="expenses"
      title="Expenses"
      description="Record vendor bills, inventory purchases, utilities, rent, repairs, taxes, and all other store expenses."
      defaultValues={{
        date: todayIso(),
        vendor_name: "",
        category: "Inventory",
        amount: 0,
        payment_method: "ACH",
        notes: "",
      }}
      fields={[
        { name: "date", label: "Date", type: "date", required: true },
        { name: "vendor_name", label: "Vendor name", type: "text", required: true },
        { name: "category", label: "Category", type: "select", options: expenseCategories },
        { name: "amount", label: "Amount", type: "number", min: "0", step: "0.01" },
        { name: "payment_method", label: "Payment method", type: "select", options: paymentMethods },
        { name: "notes", label: "Notes", type: "textarea", className: "md:col-span-2 xl:col-span-3" },
      ]}
      columns={[
        { header: "Date", cell: (row) => row.date },
        { header: "Vendor", cell: (row) => row.vendor_name },
        { header: "Category", cell: (row) => row.category },
        { header: "Amount", cell: (row) => currency(row.amount) },
        { header: "Payment", cell: (row) => row.payment_method },
      ]}
    />
  );
}
