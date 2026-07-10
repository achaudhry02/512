"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  reconciliationTotals,
  unreconciledDailySaleDates,
} from "@/lib/cash-reconciliation";
import {
  calculateFuelReconciliation,
  fuelReconciliationTotals,
} from "@/lib/fuel-reconciliation";
import {
  aggregateData,
  currency,
  expensesByCategory,
  monthEndIso,
  monthStartIso,
  percent,
  posDepartmentSales,
  posPaymentBreakdown,
  posSalesBySource,
  sum,
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
  const expenseMap = report.expenseBreakdown ?? expensesByCategory(report.expenses);
  const inventoryValue = data.products.reduce((total, product) => total + product.quantity_on_hand * product.unit_cost, 0);
  const vendorSpend = Object.entries(report.expenses.reduce<Record<string, number>>((vendors, expense) => {
    vendors[expense.vendor_name] = (vendors[expense.vendor_name] ?? 0) + expense.amount;
    return vendors;
  }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const posSourceSpend = posSalesBySource(data.pos_import_rows, startDate || undefined, endDate || undefined);
  const posDepartments = Object.entries(posDepartmentSales(data.pos_import_rows, startDate || undefined, endDate || undefined))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const posPayments = Object.entries(posPaymentBreakdown(data.pos_import_rows, startDate || undefined, endDate || undefined))
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
  const posFuelGallons = sum(report.posRows.map((row) => row.fuel_gallons));
  const posFuelSales = sum(report.posRows.map((row) => row.fuel_sales));
  const posErrorRows = data.pos_import_rows.filter((row) => row.validation_errors.length);
  const reconciliationsInRange = data.cash_reconciliations.filter((entry) => entry.date >= startDate && entry.date <= endDate);
  const unreconciledDays = unreconciledDailySaleDates(report.dailySales, reconciliationsInRange).length;
  const reconciliationSummary = reconciliationTotals(reconciliationsInRange);
  const cashOverShort = reconciliationSummary.cashOverShort;
  const cardMismatch = reconciliationSummary.cardMismatch;
  const fuelReconciliationsInRange = data.fuel_reconciliations.filter((entry) => entry.date >= startDate && entry.date <= endDate);
  const fuelReconciliationSummary = fuelReconciliationTotals(fuelReconciliationsInRange);

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Convenience Store Command Center P&L"],
      ["Store", store?.name ?? "Store"],
      ["Date range", `${startDate} to ${endDate}`],
      ["Data source", report.source === "monthly_totals" ? "Monthly totals entries where available" : report.source === "daily_and_pos" ? "Daily and POS import data" : "Daily data"],
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
      ["POS fuel gallons", posFuelGallons],
      ["POS fuel sales", posFuelSales],
      ["Cash over/short", cashOverShort],
      ["Unreconciled days", unreconciledDays],
      ["Card batch mismatch", cardMismatch],
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
        <span className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
          {report.source === "monthly_totals" ? "Using monthly totals where available" : report.source === "daily_and_pos" ? "Using daily + POS import data" : "Using daily data"}
        </span>
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
        <StatCard label="Cash over/short" value={cashOverShort} accent={Math.abs(cashOverShort) > 5 ? "rose" : "emerald"} />
        <StatCard label="Unreconciled days" value={unreconciledDays} accent={unreconciledDays ? "amber" : "emerald"} />
        <StatCard label="Card mismatch" value={cardMismatch} accent={Math.abs(cardMismatch) > 5 ? "rose" : "emerald"} />
        <StatCard label="Fuel variance alerts" value={fuelReconciliationSummary.alertCount} accent={fuelReconciliationSummary.alertCount ? "rose" : "emerald"} />
        <StatCard label="Fuel variance gallons" value={fuelReconciliationSummary.totalVariance} accent={Math.abs(fuelReconciliationSummary.totalVariance) > 25 ? "rose" : "slate"} />
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
          <h3 className="text-xl font-black text-slate-950">Cash reconciliation status</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">Drawer over/short, card batch mismatches, and bank deposit mismatches for the report range.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
              <tr>
                <th className="px-5 py-4 font-black">Date</th>
                <th className="px-5 py-4 font-black">Status</th>
                <th className="px-5 py-4 text-right font-black">Cash over/short</th>
                <th className="px-5 py-4 text-right font-black">Card mismatch</th>
                <th className="px-5 py-4 text-right font-black">Bank deposit mismatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reconciliationsInRange.map((entry) => {
                const cardVariance = entry.processor_card_total - entry.pos_card_total;
                const depositVariance = entry.bank_deposit_amount - entry.cash_drops;

                return (
                  <tr className="transition hover:bg-cyan-50/40" key={entry.id}>
                    <td className="px-5 py-4 font-semibold text-slate-700">{entry.date}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${
                        entry.status === "balanced"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : entry.status === "needs_review"
                            ? "bg-amber-50 text-amber-700 ring-amber-200"
                            : "bg-slate-100 text-slate-700 ring-slate-200"
                      }`}>
                        {entry.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-700">{currency(entry.variance ?? entry.cash_over_short)}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-700">{currency(cardVariance)}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-700">{currency(depositVariance)}</td>
                  </tr>
                );
              })}
              {!reconciliationsInRange.length ? (
                <tr>
                  <td className="px-5 py-8 text-center font-semibold text-slate-500" colSpan={5}>
                    No cash reconciliations saved in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5">
          <h3 className="text-xl font-black text-slate-950">Fuel reconciliation by grade</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">Tank variance, rack cost, retail price, actual margin, and suggested price for the report range.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
              <tr>
                <th className="px-5 py-4 font-black">Date</th>
                <th className="px-5 py-4 font-black">Grade</th>
                <th className="px-5 py-4 text-right font-black">Sold gal</th>
                <th className="px-5 py-4 text-right font-black">Variance</th>
                <th className="px-5 py-4 text-right font-black">Margin</th>
                <th className="px-5 py-4 text-right font-black">Suggested price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fuelReconciliationsInRange.map((entry) => {
                const math = calculateFuelReconciliation(entry);

                return (
                  <tr className="transition hover:bg-cyan-50/40" key={entry.id}>
                    <td className="px-5 py-4 font-semibold text-slate-700">{entry.date}</td>
                    <td className="px-5 py-4 font-bold text-slate-800">{entry.grade_name}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-700">{entry.sold_gallons.toLocaleString()}</td>
                    <td className={`px-5 py-4 text-right font-black ${(entry.is_variance_alert ?? math.isVarianceAlert) ? "text-rose-700" : "text-slate-700"}`}>{(entry.variance ?? math.variance).toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-700">{currency(entry.actual_margin ?? math.actualMargin)}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-700">{currency(entry.suggested_price ?? math.suggestedPrice)}</td>
                  </tr>
                );
              })}
              {!fuelReconciliationsInRange.length ? (
                <tr>
                  <td className="px-5 py-8 text-center font-semibold text-slate-500" colSpan={6}>
                    No fuel reconciliations saved in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

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
          <h3 className="text-xl font-black text-slate-950">Sales by POS source</h3>
          <p className="mt-1 text-sm text-slate-500">Imported POS rows grouped by source system.</p>
          <div className="mt-5 h-72">
            {posSourceSpend.length ? <ResponsiveContainer height="100%" minWidth={0} width="100%"><BarChart data={posSourceSpend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="sales" fill="#0f766e" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">No POS imports in this range.</p>}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">POS payment breakdown</h3>
          <p className="mt-1 text-sm text-slate-500">Cash, card, EBT, gift card, and other imported tender totals.</p>
          <div className="mt-5 h-72">
            {posPayments.length ? <ResponsiveContainer height="100%" minWidth={0} width="100%"><BarChart data={posPayments}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">No POS tender totals in this range.</p>}
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Department sales from POS</h3>
          <p className="mt-1 text-sm text-slate-500">Department/category sales imported from POS files.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm"><thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><tr><th className="py-3">Department</th><th className="py-3 text-right">Sales</th></tr></thead><tbody className="divide-y divide-slate-100">{posDepartments.slice(0, 10).map((department) => <tr key={department.name}><td className="py-3 font-bold text-slate-800">{department.name}</td><td className="py-3 text-right font-black">{currency(department.value)}</td></tr>)}</tbody></table>
            {!posDepartments.length ? <p className="py-8 text-center text-sm text-slate-500">No POS department sales in this range.</p> : null}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">POS fuel and unmapped rows</h3>
          <p className="mt-1 text-sm text-slate-500">Fuel volume/sales plus rows that carried validation notes.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Fuel gallons</p><p className="mt-2 text-xl font-black">{posFuelGallons.toLocaleString()}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Fuel sales</p><p className="mt-2 text-xl font-black">{currency(posFuelSales)}</p></div>
          </div>
          <div className="mt-5 space-y-2">
            {posErrorRows.slice(0, 5).map((row) => (
              <div className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800" key={row.id}>
                {row.pos_name} row {row.row_index}: {row.validation_errors.join(", ")}
              </div>
            ))}
            {!posErrorRows.length ? <p className="text-sm text-slate-500">No saved POS error rows.</p> : null}
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Vendor spend</h3>
          <p className="mt-1 text-sm text-slate-500">Invoice and expense totals for the selected date range.</p>
          <div className="mt-5 h-72">
            {vendorSpend.length ? <ResponsiveContainer height="100%" minWidth={0} width="100%"><BarChart data={vendorSpend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="value" fill="#0891b2" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">No vendor expenses in this range.</p>}
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
