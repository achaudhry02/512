"use client";

import { EntryManager } from "@/components/entry-manager";
import { currency, monthEndIso, payrollTotal, rangesOverlap, todayIso } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";

export default function PayrollPage() {
  const { data } = useCommandCenter();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const monthStart = `${todayIso().slice(0, 7)}-01`;
  const today = todayIso();
  const weeklyPayroll = data.payroll_entries.filter((entry) => rangesOverlap(entry.date_range_start, entry.date_range_end, weekStartIso, today)).reduce((total, entry) => total + payrollTotal(entry), 0);
  const monthlyPayroll = data.payroll_entries.filter((entry) => rangesOverlap(entry.date_range_start, entry.date_range_end, monthStart, monthEndIso())).reduce((total, entry) => total + payrollTotal(entry), 0);

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><p className="text-xs font-black uppercase text-slate-500">Current week payroll</p><p className="mt-2 text-3xl font-black text-slate-950">{currency(weeklyPayroll)}</p><p className="mt-1 text-xs text-slate-500">Default planning estimate: {currency(2500)}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><p className="text-xs font-black uppercase text-slate-500">Current month payroll</p><p className="mt-2 text-3xl font-black text-slate-950">{currency(monthlyPayroll)}</p><p className="mt-1 text-xs text-slate-500">Calculated from saved payroll entries</p></div>
      </div>
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
    </div>
  );
}
