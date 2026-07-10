"use client";

import { Download, FileArchive, FileText } from "lucide-react";
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
  cashFlowSummary,
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
import { inventoryInsights } from "@/lib/inventory-operations";
import {
  buildDetailedPnl,
  categoryProfitability,
  dateRangeForPreset,
  fuelMarginByGrade,
  type ReportPreset,
  weeklyProfitRows,
} from "@/lib/accountant-reporting";
import { downloadAccountantZip, downloadCsv, downloadPdf } from "@/lib/report-exports";
import { expenseCategories } from "@/lib/types";

export default function ReportsPage() {
  const { data, selectStore, store, stores } = useCommandCenter();
  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(monthEndIso());
  const [preset, setPreset] = useState<ReportPreset>("this_month");
  const [includeEstimates, setIncludeEstimates] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "zip" | null>(null);

  const report = useMemo(
    () => aggregateData(data, startDate || undefined, endDate || undefined),
    [data, endDate, startDate],
  );
  const expenseMap = report.expenseBreakdown ?? expensesByCategory(report.expenses);
  const inventoryValue = data.products.reduce((total, product) => total + product.quantity_on_hand * product.unit_cost, 0);
  const inventoryReport = inventoryInsights(
    data.products,
    data.product_sales,
    data.inventory_adjustments,
    data.vendor_item_costs,
    endDate || new Date(),
  );
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
  const cashFlow = cashFlowSummary(data.cash_flow_entries, startDate || undefined, endDate || undefined);
  const cashFlowRows = Object.entries(cashFlow.breakdown)
    .map(([name, value]) => ({ name: name.replaceAll("_", " "), value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const importsInRange = data.imports.filter((record) => {
    const createdAt = record.created_at?.slice(0, 10);
    return createdAt ? createdAt >= startDate && createdAt <= endDate : false;
  });
  const posImportsInRange = data.pos_imports.filter((record) => {
    const createdAt = record.created_at?.slice(0, 10);
    return createdAt ? createdAt >= startDate && createdAt <= endDate : false;
  });
  const importStatusRows = Object.entries(importsInRange.reduce<Record<string, number>>((statuses, record) => {
    statuses[record.status] = (statuses[record.status] ?? 0) + 1;
    return statuses;
  }, {})).map(([name, value]) => ({ name: name.replaceAll("_", " "), value }));
  const reconciliationsInRange = data.cash_reconciliations.filter((entry) => entry.date >= startDate && entry.date <= endDate);
  const unreconciledDays = unreconciledDailySaleDates(report.dailySales, reconciliationsInRange).length;
  const reconciliationSummary = reconciliationTotals(reconciliationsInRange);
  const cashOverShort = reconciliationSummary.cashOverShort;
  const cardMismatch = reconciliationSummary.cardMismatch;
  const fuelReconciliationsInRange = data.fuel_reconciliations.filter((entry) => entry.date >= startDate && entry.date <= endDate);
  const fuelReconciliationSummary = fuelReconciliationTotals(fuelReconciliationsInRange);
  const detailedPnl = useMemo(
    () => buildDetailedPnl(data, startDate, endDate, includeEstimates),
    [data, endDate, includeEstimates, startDate],
  );
  const weeklyRows = useMemo(
    () => weeklyProfitRows(data, startDate, endDate, includeEstimates),
    [data, endDate, includeEstimates, startDate],
  );
  const categoryRows = useMemo(
    () => categoryProfitability(data, startDate, endDate, includeEstimates),
    [data, endDate, includeEstimates, startDate],
  );
  const fuelGradeRows = useMemo(
    () => fuelMarginByGrade(data, startDate, endDate),
    [data, endDate, startDate],
  );
  const exportOptions = { storeName: store?.name ?? "Store", start: startDate, end: endDate, includeEstimates };

  function applyPreset(nextPreset: ReportPreset) {
    setPreset(nextPreset);
    if (nextPreset === "custom") return;
    const range = dateRangeForPreset(nextPreset);
    setStartDate(range.start);
    setEndDate(range.end);
  }

  async function exportDocument(type: "pdf" | "zip") {
    setExporting(type);
    try {
      if (type === "pdf") await downloadPdf(data, exportOptions);
      else await downloadAccountantZip(data, exportOptions);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Reporting center"
        description="Review operating profit, cash movement, inventory, reconciliations, and import history. Export a single report or a complete accountant package."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50"
              onClick={() => downloadCsv(data, exportOptions)}
              type="button"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
              disabled={exporting !== null}
              onClick={() => void exportDocument("pdf")}
              type="button"
            >
              <FileText className="h-4 w-4" />
              {exporting === "pdf" ? "Preparing..." : "PDF"}
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800 disabled:opacity-60"
              disabled={exporting !== null}
              onClick={() => void exportDocument("zip")}
              type="button"
            >
              <FileArchive className="h-4 w-4" />
              {exporting === "zip" ? "Preparing..." : "Accountant ZIP"}
            </button>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-card sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto_auto_auto] xl:items-end">
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Store
          <select
            className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            onChange={(event) => void selectStore(event.target.value)}
            value={store?.id ?? ""}
          >
            {!stores.length ? <option value="">No store loaded</option> : null}
            {stores.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Period
          <select
            className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            onChange={(event) => applyPreset(event.target.value as ReportPreset)}
            value={preset}
          >
            <option value="this_week">This week</option>
            <option value="last_week">Last week</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="this_quarter">This quarter</option>
            <option value="year_to_date">Year to date</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <input
          aria-label="Report start date"
          className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          onChange={(event) => { setPreset("custom"); setStartDate(event.target.value); }}
          type="date"
          value={startDate}
        />
        <input
          aria-label="Report end date"
          className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          onChange={(event) => { setPreset("custom"); setEndDate(event.target.value); }}
          type="date"
          value={endDate}
        />
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
          <input checked={includeEstimates} onChange={(event) => setIncludeEstimates(event.target.checked)} type="checkbox" />
          Include estimates
        </label>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-xs font-black">
        <span className="rounded-full bg-cyan-50 px-3 py-2 text-cyan-700 ring-1 ring-cyan-100">
          {report.source === "monthly_totals" ? "Monthly totals replace daily rows for covered months" : report.source === "daily_and_pos" ? "Daily + POS data" : "Daily data"}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-emerald-100">
          {includeEstimates ? report.profitAccuracyLabel : "Actual tracked data only"}
        </span>
        {detailedPnl.actualOnlyIsPartial ? <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-800 ring-1 ring-amber-200">Actual-only totals are partial</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Report sales" value={detailedPnl.revenue} />
        <StatCard label="Gross profit" value={detailedPnl.grossProfit} accent="emerald" />
        <StatCard label="Fuel profit" value={detailedPnl.fuelProfit} accent="cyan" />
        <StatCard label="Lottery profit" value={detailedPnl.lotteryCommission} accent="amber" />
        <StatCard label="Deli / hot food sales" value={detailedPnl.deliSales} accent="emerald" />
        <StatCard label="Payroll" value={detailedPnl.payroll} accent="rose" />
        <StatCard label="Net operating profit" value={detailedPnl.netOperatingProfit} accent={detailedPnl.netOperatingProfit >= 0 ? "emerald" : "rose"} />
        <StatCard label="Inventory value" value={inventoryValue} accent="slate" />
        <StatCard label="Low-stock products" value={inventoryReport.lowStock.length} accent={inventoryReport.lowStock.length ? "rose" : "emerald"} />
        <StatCard label="Dead-stock value" value={inventoryReport.deadStock.reduce((total, entry) => total + entry.tiedUpValue, 0)} accent={inventoryReport.deadStock.length ? "amber" : "emerald"} />
        <StatCard label="Shrink / loss" value={inventoryReport.shrinkLoss.cost} accent={inventoryReport.shrinkLoss.cost ? "rose" : "emerald"} />
        <StatCard label="Cash over/short" value={cashOverShort} accent={Math.abs(cashOverShort) > 5 ? "rose" : "emerald"} />
        <StatCard label="Unreconciled days" value={unreconciledDays} accent={unreconciledDays ? "amber" : "emerald"} />
        <StatCard label="Card mismatch" value={cardMismatch} accent={Math.abs(cardMismatch) > 5 ? "rose" : "emerald"} />
        <StatCard label="Fuel variance alerts" value={fuelReconciliationSummary.alertCount} accent={fuelReconciliationSummary.alertCount ? "rose" : "emerald"} />
        <StatCard label="Fuel variance gallons" value={fuelReconciliationSummary.totalVariance} accent={Math.abs(fuelReconciliationSummary.totalVariance) > 25 ? "rose" : "slate"} />
        <StatCard label="Cash flow deposits" value={cashFlow.operatingInflows} accent="cyan" />
        <StatCard label="Non-operating cash out" value={cashFlow.nonOperatingOutflows} accent={cashFlow.nonOperatingOutflows ? "amber" : "slate"} />
        <StatCard label="Net cash movement" value={cashFlow.netCashMovement} accent={cashFlow.netCashMovement >= 0 ? "emerald" : "rose"} />
        <StatCard label="Smart Import files" value={importsInRange.length} accent="slate" />
        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-card">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-400 to-slate-800" />
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Profit margin</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {percent(detailedPnl.netMarginPercent)}
          </p>
          <p className="mt-4 text-xs font-medium text-slate-500">Net operating profit divided by report sales</p>
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-100 px-5 py-5">
          <h3 className="text-xl font-black text-slate-950">Detailed operating P&amp;L</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">Operating performance is separated from owner draws, loans, and transfers.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-5 py-4">Line item</th><th className="px-5 py-4 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ["Inside merchandise sales", detailedPnl.merchandiseSales],
                ["Fuel sales", detailedPnl.fuelRevenue],
                ["Lottery sales", detailedPnl.lotterySales],
                ["Total sales", detailedPnl.revenue],
                ["Fuel cost (memo, included in COGS)", detailedPnl.fuelCost],
                [includeEstimates ? "COGS / estimated COGS" : "COGS unavailable for untracked categories", detailedPnl.cogs === null ? null : -detailedPnl.cogs],
                ["Gross profit", detailedPnl.grossProfit],
                ["Payroll", -detailedPnl.payroll],
                ["Rent / mortgage", -detailedPnl.rent],
                ["Utilities", -detailedPnl.utilities],
                ["Insurance", -detailedPnl.insurance],
                ["Repairs and maintenance", -detailedPnl.repairs],
                ["Bank / card fees", -detailedPnl.bankCardFees],
                ["Vendor expenses", -detailedPnl.vendorExpenses],
                ["Other operating expenses", -detailedPnl.otherOperatingExpenses],
                ["Net operating profit", detailedPnl.netOperatingProfit],
              ].map(([label, amount]) => (
                <tr className={label === "Total sales" || label === "Gross profit" || label === "Net operating profit" ? "bg-slate-50 font-black" : ""} key={String(label)}>
                  <td className="px-5 py-3 text-slate-700">{label}</td>
                  <td className={`px-5 py-3 text-right font-bold ${typeof amount === "number" && amount < 0 ? "text-rose-700" : "text-slate-900"}`}>{amount === null ? "Not available" : currency(Number(amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50 p-5 sm:grid-cols-3">
          <div><p className="text-xs font-black uppercase text-slate-500">Owner draws</p><p className="mt-1 text-lg font-black">{currency(detailedPnl.ownerDraws)}</p></div>
          <div><p className="text-xs font-black uppercase text-slate-500">Loan payments</p><p className="mt-1 text-lg font-black">{currency(detailedPnl.loanPayments)}</p></div>
          <div><p className="text-xs font-black uppercase text-slate-500">Transfers</p><p className="mt-1 text-lg font-black">{currency(detailedPnl.transfers)}</p></div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 px-5 py-5"><h3 className="text-xl font-black text-slate-950">Weekly P&amp;L</h3><p className="mt-1 text-sm text-slate-500">Daily and imported records grouped into seven-day periods.</p></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Week</th><th className="px-4 py-3 text-right">Sales</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Net</th></tr></thead><tbody className="divide-y divide-slate-100">{weeklyRows.map((row) => <tr key={row.start}><td className="px-4 py-3 font-semibold">{row.start} to {row.end}</td><td className="px-4 py-3 text-right">{currency(row.revenue)}</td><td className="px-4 py-3 text-right">{currency(row.grossProfit)}</td><td className={`px-4 py-3 text-right font-black ${row.netOperatingProfit < 0 ? "text-rose-700" : "text-emerald-700"}`}>{currency(row.netOperatingProfit)}</td></tr>)}</tbody></table></div>
          {report.monthlyTotals.length ? <p className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-900">Monthly-total-only records are excluded because they cannot be allocated accurately to individual weeks.</p> : null}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Performance ratios</h3>
          <p className="mt-1 text-sm text-slate-500">Ratios use the selected actual or estimated reporting basis.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[["Payroll ratio", detailedPnl.payrollRatio], ["Expense percentage", detailedPnl.expensePercent], ["Gross margin", detailedPnl.grossMarginPercent], ["Net margin", detailedPnl.netMarginPercent]].map(([label, value]) => <div className="rounded-lg bg-slate-50 p-4" key={String(label)}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{percent(Number(value))}</p></div>)}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-black uppercase text-slate-500">Lottery sales / profit</p><p className="mt-2 font-black">{currency(detailedPnl.lotterySales)} / {currency(detailedPnl.lotteryCommission)}</p><p className="mt-1 text-xs text-slate-500">Payouts: {currency(detailedPnl.lotteryPayouts)}</p></div>
            <div className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-black uppercase text-slate-500">Deli margin and waste</p><p className="mt-2 font-black">{currency(detailedPnl.deliGrossProfit)} gross profit</p><p className="mt-1 text-xs text-slate-500">Food cost {currency(detailedPnl.deliFoodCost)} · Waste {currency(detailedPnl.deliWaste)}</p></div>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 px-5 py-5"><h3 className="text-xl font-black text-slate-950">Product and category profitability</h3><p className="mt-1 text-sm text-slate-500">Item-cost profit remains distinct from category-margin estimates.</p></div>
          <div className="max-h-96 overflow-auto"><table className="min-w-full text-sm"><thead className="sticky top-0 bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Sales</th><th className="px-4 py-3 text-right">Profit</th><th className="px-4 py-3 text-right">Margin</th></tr></thead><tbody className="divide-y divide-slate-100">{categoryRows.map((row, index) => <tr key={`${row.category}-${row.source}-${index}`}><td className="px-4 py-3"><p className="font-bold">{row.category}</p><p className="text-xs text-slate-500">{row.source}</p></td><td className="px-4 py-3 text-right">{currency(row.sales)}</td><td className="px-4 py-3 text-right font-bold">{currency(row.grossProfit)}</td><td className="px-4 py-3 text-right">{percent(row.marginPercent)}</td></tr>)}</tbody></table>{!categoryRows.length ? <p className="p-6 text-center text-sm text-slate-500">No category profitability data in this range.</p> : null}</div>
        </section>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 px-5 py-5"><h3 className="text-xl font-black text-slate-950">Fuel margin by grade</h3><p className="mt-1 text-sm text-slate-500">Grade-level revenue, cost, profit, and margin per gallon.</p></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Grade</th><th className="px-4 py-3 text-right">Gallons</th><th className="px-4 py-3 text-right">Profit</th><th className="px-4 py-3 text-right">Margin / gal</th></tr></thead><tbody className="divide-y divide-slate-100">{fuelGradeRows.map((row) => <tr key={row.grade}><td className="px-4 py-3 font-bold">{row.grade}</td><td className="px-4 py-3 text-right">{row.gallons.toLocaleString()}</td><td className="px-4 py-3 text-right font-bold">{currency(row.profit)}</td><td className="px-4 py-3 text-right">{currency(row.marginPerGallon)}</td></tr>)}</tbody></table>{!fuelGradeRows.length ? <p className="p-6 text-center text-sm text-slate-500">No grade-level fuel reconciliations in this range.</p> : null}</div>
        </section>
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
          <h3 className="text-xl font-black text-slate-950">Cash flow from imports</h3>
          <p className="mt-1 text-sm text-slate-500">Bank-statement movement separated from operating profit.</p>
          <div className="mt-5 h-72">
            {cashFlowRows.length ? <ResponsiveContainer height="100%" minWidth={0} width="100%"><BarChart data={cashFlowRows}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="value" fill="#0891b2" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">No cash-flow import rows in this range.</p>}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-xl font-black text-slate-950">Smart Import audit</h3>
          <p className="mt-1 text-sm text-slate-500">Import lifecycle status for files created in the selected range.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Posted</p><p className="mt-2 text-xl font-black">{importsInRange.filter((record) => record.status === "posted" || record.status === "imported").length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Rolled back</p><p className="mt-2 text-xl font-black">{importsInRange.filter((record) => record.status === "rolled_back").length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Rows reviewed</p><p className="mt-2 text-xl font-black">{data.import_rows.filter((row) => row.reviewed_at && row.created_at && row.created_at.slice(0, 10) >= startDate && row.created_at.slice(0, 10) <= endDate).length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Duplicate rows</p><p className="mt-2 text-xl font-black">{data.import_rows.filter((row) => row.duplicate_reason && row.created_at && row.created_at.slice(0, 10) >= startDate && row.created_at.slice(0, 10) <= endDate).length}</p></div>
          </div>
          <div className="mt-5 space-y-2">
            {importStatusRows.map((row) => (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3" key={row.name}>
                <span className="text-sm font-bold capitalize text-slate-700">{row.name}</span>
                <span className="text-sm font-black text-slate-950">{row.value}</span>
              </div>
            ))}
            {!importStatusRows.length ? <p className="text-sm text-slate-500">No Smart Import files were created in this range.</p> : null}
          </div>
        </section>
      </div>

      <section className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-100 px-5 py-5">
          <h3 className="text-xl font-black text-slate-950">Import history and audit log</h3>
          <p className="mt-1 text-sm text-slate-500">Smart Import and POS files created in the selected reporting range.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr><th className="px-4 py-3">Created</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Rows</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {importsInRange.map((entry) => <tr key={`smart-${entry.id}`}><td className="px-4 py-3 whitespace-nowrap">{entry.created_at?.slice(0, 10) ?? "-"}</td><td className="px-4 py-3 font-bold">Smart Import</td><td className="px-4 py-3">{entry.original_file_name}</td><td className="px-4 py-3 capitalize">{entry.status.replaceAll("_", " ")}</td><td className="px-4 py-3 text-right font-bold">{entry.row_count}</td></tr>)}
              {posImportsInRange.map((entry) => <tr key={`pos-${entry.id}`}><td className="px-4 py-3 whitespace-nowrap">{entry.created_at?.slice(0, 10) ?? "-"}</td><td className="px-4 py-3 font-bold">{entry.pos_name}</td><td className="px-4 py-3">{entry.original_file_name}</td><td className="px-4 py-3 capitalize">{entry.status.replaceAll("_", " ")}</td><td className="px-4 py-3 text-right font-bold">{entry.imported_row_count} / {entry.row_count}</td></tr>)}
            </tbody>
          </table>
          {!importsInRange.length && !posImportsInRange.length ? <p className="p-6 text-center text-sm text-slate-500">No import history in this range.</p> : null}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="text-xl font-black text-slate-950">Inventory operations</h3>
        <p className="mt-1 text-sm text-slate-500">Reorder needs, fast movers, dead stock, margin leaders, vendor cost increases, and shrink/loss.</p>
        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <div className="overflow-x-auto">
            <h4 className="mb-2 text-sm font-black uppercase text-slate-500">Reorder suggestions</h4>
            <table className="min-w-full text-sm"><thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><tr><th className="py-3">Product</th><th className="py-3 text-right">On hand</th><th className="py-3 text-right">Suggested</th></tr></thead><tbody className="divide-y divide-slate-100">{inventoryReport.reorderSuggestions.slice(0, 10).map((entry) => <tr key={entry.productId}><td className="py-3 font-bold text-slate-800">{entry.productName}</td><td className="py-3 text-right text-red-700">{entry.quantityOnHand}</td><td className="py-3 text-right font-black">{entry.suggestedQuantity}</td></tr>)}</tbody></table>
            {!inventoryReport.reorderSuggestions.length ? <p className="py-6 text-center text-sm text-slate-500">No products need reordering.</p> : null}
          </div>
          <div className="overflow-x-auto">
            <h4 className="mb-2 text-sm font-black uppercase text-slate-500">Fast movers</h4>
            <table className="min-w-full text-sm"><thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><tr><th className="py-3">Product</th><th className="py-3 text-right">Units / 30d</th><th className="py-3 text-right">Sales</th></tr></thead><tbody className="divide-y divide-slate-100">{inventoryReport.fastMovers.slice(0, 10).map((entry) => <tr key={entry.product.id}><td className="py-3 font-bold text-slate-800">{entry.product.name}</td><td className="py-3 text-right">{entry.quantitySold30}</td><td className="py-3 text-right font-black">{currency(entry.revenue30)}</td></tr>)}</tbody></table>
            {!inventoryReport.fastMovers.length ? <p className="py-6 text-center text-sm text-slate-500">No linked product sales in the last 30 days.</p> : null}
          </div>
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
