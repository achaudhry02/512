"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  aggregateData,
  currency,
  expensesByCategory,
  monthEndIso,
  monthStartIso,
  percent,
} from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import { expenseCategories } from "@/lib/types";

function csvEscape(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export default function ReportsPage() {
  const { data, store } = useCommandCenter();
  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(monthEndIso());

  const report = useMemo(
    () => aggregateData(data, startDate || undefined, endDate || undefined),
    [data, endDate, startDate],
  );
  const expenseMap = expensesByCategory(report.expenses);

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Convenience Store Command Center P&L"],
      ["Store", store?.name ?? "Store"],
      ["Date range", `${startDate} to ${endDate}`],
      [],
      ["Metric", "Amount"],
      ["Total revenue", report.totalRevenue],
      ["Inside sales", report.insideSales],
      ["Fuel profit", report.fuelProfit],
      ["Lottery profit", report.lotteryProfit],
      ["Deli sales", report.deliSales],
      ["Payroll", report.payrollCost],
      ["Net profit", report.netProfit],
      ["Profit margin", `${report.profitMargin.toFixed(2)}%`],
      [],
      ["Expenses by category", "Amount"],
      ...expenseCategories.map((category) => [category, expenseMap[category] ?? 0]),
    ];

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `p-and-l-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Monthly P&L"
        description="Create a monthly profit and loss report with revenue, inside sales, fuel profit, lottery profit, deli sales, expenses by category, payroll, net profit, and profit margin."
        actions={
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
            onClick={exportCsv}
            type="button"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="text-sm font-bold text-slate-700">Report range</div>
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          onChange={(event) => setStartDate(event.target.value)}
          type="date"
          value={startDate}
        />
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          onChange={(event) => setEndDate(event.target.value)}
          type="date"
          value={endDate}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total revenue" value={report.totalRevenue} />
        <StatCard label="Inside sales" value={report.insideSales} />
        <StatCard label="Fuel profit" value={report.fuelProfit} accent="cyan" />
        <StatCard label="Lottery profit" value={report.lotteryProfit} accent="amber" />
        <StatCard label="Deli sales" value={report.deliSales} accent="emerald" />
        <StatCard label="Payroll" value={report.payrollCost} accent="rose" />
        <StatCard label="Net profit" value={report.netProfit} accent={report.netProfit >= 0 ? "emerald" : "rose"} />
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Profit margin</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {percent(report.profitMargin)}
          </p>
          <p className="mt-4 text-xs font-medium text-slate-500">Net profit divided by total revenue</p>
        </div>
      </div>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">Expenses by category</h3>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-black">Category</th>
                <th className="px-4 py-3 text-right font-black">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenseCategories.map((category) => (
                <tr key={category}>
                  <td className="px-4 py-3 font-semibold text-slate-700">{category}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {currency(expenseMap[category] ?? 0)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td className="px-4 py-3 font-black text-slate-950">Total expenses</td>
                <td className="px-4 py-3 text-right font-black text-slate-950">
                  {currency(report.totalExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
