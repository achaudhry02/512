"use client";

import { EntryManager } from "@/components/entry-manager";
import { currency, payrollTotal, todayIso } from "@/lib/calculations";

export default function PayrollPage() {
  return (
    <EntryManager
      table="payroll_entries"
      title="Payroll"
      description="Track employee hours, hourly rates, total pay, and payroll date ranges."
      helper="Total pay is calculated from hours worked and hourly rate."
      dateAccessor={(row) => row.date_range_start}
      defaultValues={{
        employee_name: "",
        date_range_start: todayIso(),
        date_range_end: todayIso(),
        hours_worked: 0,
        hourly_rate: 0,
        notes: "",
      }}
      fields={[
        { name: "employee_name", label: "Employee name", type: "text", required: true },
        { name: "date_range_start", label: "Date range start", type: "date", required: true },
        { name: "date_range_end", label: "Date range end", type: "date", required: true },
        { name: "hours_worked", label: "Hours worked", type: "number", min: "0", step: "0.01" },
        { name: "hourly_rate", label: "Hourly rate", type: "number", min: "0", step: "0.01" },
        { name: "notes", label: "Notes", type: "textarea", className: "md:col-span-2 xl:col-span-3" },
      ]}
      columns={[
        { header: "Employee", cell: (row) => row.employee_name },
        { header: "Start", cell: (row) => row.date_range_start },
        { header: "End", cell: (row) => row.date_range_end },
        { header: "Hours", cell: (row) => row.hours_worked.toLocaleString() },
        { header: "Rate", cell: (row) => currency(row.hourly_rate) },
        { header: "Total pay", cell: (row) => currency(payrollTotal(row)) },
      ]}
    />
  );
}
