"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  const inventoryValue = data.products.reduce((total, product) => total + product.quantity_on_hand * product.unit_cost, 0);
  const vendorSpend = Object.entries(report.expenses.reduce<Record<string, number>>((vendors, expense) => {
    vendors[expense.vendor_name] = (vendors[expense.vendor_name] ?? 0) + expense.amount;
    return vendors;
  }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

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
      ["Inventory value", inventoryValue],
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
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
            onClick={exportCsv}
            type="button"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-[1.75rem] border border-white/80 bg-white/85 p-4 shadow-card backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="text-sm font-black text-slate-800">Report range</div>
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          onChange={(event) => setStartDate(event.target.value)}
          type="date"
          value={startDate}
        />
        <input
          className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
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
        <StatCard label="Inventory value" value={inventoryValue} accent="slate" />
        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-card">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-400 to-slate-800" />
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Profit margin</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {percent(report.profitMargin)}
          </p>
          <p className="mt-4 text-xs font-medium text-slate-500">Net profit divided by total revenue</p>
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5">
          <h3 className="text-xl font-black text-slate-950">Expenses by category</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">A clean category breakdown for month-end owner review.</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
              <tr>
                <th className="px-5 py-4 font-black">Category</th>
                <th className="px-5 py-4 text-right font-black">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenseCategories.map((category) => (
                <tr className="transition hover:bg-cyan-50/40" key={category}>
                  <td className="px-5 py-4 font-semibold text-slate-700">{category}</td>
                  <td className="px-5 py-4 text-right font-bold text-slate-700">
                    {currency(expenseMap[category] ?? 0)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td className="px-5 py-4 font-black text-slate-950">Total expenses</td>
                <td className="px-5 py-4 text-right font-black text-slate-950">
                  {currency(report.totalExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Vendor spend</h3>
          <p className="mt-1 text-sm text-slate-500">Invoice and expense totals for the selected date range.</p>
          <div className="mt-5 h-72">
            {vendorSpend.length ? <ResponsiveContainer height="100%" width="100%"><BarChart data={vendorSpend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="value" fill="#0891b2" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">No vendor expenses in this range.</p>}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Inventory value</h3>
          <p className="mt-1 text-sm text-slate-500">Current stock valued at item cost.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm"><thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><tr><th className="py-3">Product</th><th className="py-3 text-right">Quantity</th><th className="py-3 text-right">Value</th></tr></thead><tbody className="divide-y divide-slate-100">{data.products.slice(0, 8).map((product) => <tr key={product.id}><td className="py-3 font-bold text-slate-800">{product.name}</td><td className="py-3 text-right">{product.quantity_on_hand}</td><td className="py-3 text-right font-black">{currency(product.quantity_on_hand * product.unit_cost)}</td></tr>)}</tbody></table>
            {!data.products.length ? <p className="py-8 text-center text-sm text-slate-500">No inventory entered yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
