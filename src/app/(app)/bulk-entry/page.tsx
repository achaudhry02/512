"use client";

import Papa from "papaparse";
import { CalendarDays, Download, FileUp, Save, SearchCheck } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { PageHeader } from "@/components/page-header";
import {
  bulkFuelMargin,
  bulkFuelProfit,
  bulkGrossProfit,
  bulkNetProfitEstimate,
  bulkTemplateHeaders,
  bulkTotalSales,
  createBulkTemplateCsv,
  emptyBulkEntry,
  monthDays,
  parseBulkCsvRecords,
  validateBulkRows,
  type BulkRowIssue,
} from "@/lib/bulk-entry";
import { currency, monthEndIso, monthStartIso, numberFormatter } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import type { BulkMonthlyEntry } from "@/lib/types";

const labels: Record<(typeof bulkTemplateHeaders)[number], string> = {
  date: "Date",
  grocery_sales: "Grocery",
  deli_sales: "Deli",
  hot_food_sales: "Hot food",
  fuel_gallons_sold: "Fuel gal",
  fuel_price_per_gallon: "Fuel price",
  fuel_cost_per_gallon: "Fuel cost",
  lottery_sales: "Lottery",
  beer_sales: "Beer",
  cigarette_sales: "Cigarettes",
  other_sales: "Other",
  cash_total: "Cash",
  card_total: "Card",
  expenses: "Expenses",
  payroll: "Payroll",
  notes: "Notes",
};

export default function BulkEntryPage() {
  const { data, saveBulkMonthlyEntries } = useCommandCenter();
  const [month, setMonth] = useState(monthStartIso().slice(0, 7));
  const [rows, setRows] = useState<BulkMonthlyEntry[]>(() => monthDays(monthStartIso().slice(0, 7)).map(emptyBulkEntry));
  const [previewed, setPreviewed] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const existingDates = useMemo(() => new Set(data.daily_sales.map((sale) => sale.date)), [data.daily_sales]);
  const validation = useMemo(() => validateBulkRows(rows, month, existingDates), [existingDates, month, rows]);
  const totals = useMemo(
    () => ({
      totalSales: rows.reduce((sum, row) => sum + bulkTotalSales(row), 0),
      fuelProfit: rows.reduce((sum, row) => sum + bulkFuelProfit(row), 0),
      grossProfit: rows.reduce((sum, row) => sum + bulkGrossProfit(row), 0),
      expenses: rows.reduce((sum, row) => sum + row.expenses, 0),
      payroll: rows.reduce((sum, row) => sum + row.payroll, 0),
      netProfit: rows.reduce((sum, row) => sum + bulkNetProfitEstimate(row), 0),
    }),
    [rows],
  );

  function resetForMonth(nextMonth: string) {
    if (!/^\d{4}-\d{2}$/.test(nextMonth)) return;
    setMonth(nextMonth);
    setRows(monthDays(nextMonth).map(emptyBulkEntry));
    setPreviewed(false);
    setStatus(null);
  }

  function updateRow(index: number, field: keyof BulkMonthlyEntry, value: string) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }

        if (field === "date") {
          return { ...row, date: value };
        }

        if (field === "notes") {
          return { ...row, notes: value.trim() ? value : null };
        }

        return { ...row, [field]: value === "" ? 0 : Number(value) };
      }),
    );
    setPreviewed(false);
  }

  function downloadTemplate() {
    const csv = createBulkTemplateCsv(month);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bulk-entry-template-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length) {
          setStatus(`CSV import failed: ${result.errors[0].message}`);
          return;
        }
        const parsedRows = parseBulkCsvRecords(result.data);

        if (!parsedRows.length) {
          setStatus("CSV import failed: no rows with a date were found.");
          return;
        }

        setRows(parsedRows);
        setPreviewed(false);
        setStatus(`Imported ${parsedRows.length} rows from ${file.name}. Review before saving.`);
      },
      error: (error) => {
        setStatus(error.message);
      },
    });

    event.target.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);

    try {
      await saveBulkMonthlyEntries(rows, overwrite);
      setPreviewed(false);
      setStatus(`Saved ${rows.length} daily entries for ${month}. Dashboard and reports now include this month.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save bulk entries.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = previewed && !validation.blockingIssues.length && (!validation.existingDuplicateDates.length || overwrite);

  return (
    <div>
      <PageHeader
        eyebrow="Bulk Entry"
        title="Monthly Entry"
        description="Enter or import a full month of daily store data, preview calculated totals, validate dates and numbers, then save the month in one submit."
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
              onClick={downloadTemplate}
              type="button"
            >
              <Download className="h-4 w-4" />
              Template
            </button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800">
              <FileUp className="h-4 w-4" />
              Upload CSV
              <input accept=".csv,text/csv" className="sr-only" onChange={importCsv} type="file" />
            </label>
          </div>
        }
      />

      {status ? (
        <div className="mb-6 rounded-3xl border border-cyan-200 bg-cyan-50/90 p-4 text-sm font-semibold text-cyan-800 shadow-sm">
          {status}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">Month setup</h2>
              <p className="text-sm font-medium text-slate-500">Manual rows are generated from the selected month.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Month</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => resetForMonth(event.target.value)}
                type="month"
                value={month}
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-bold text-slate-700">
              <input
                checked={overwrite}
                className="h-4 w-4 accent-cyan-600"
                onChange={(event) => setOverwrite(event.target.checked)}
                type="checkbox"
              />
              Allow overwrite for duplicate saved dates
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Total sales" value={currency(totals.totalSales)} />
          <Metric label="Fuel profit" value={currency(totals.fuelProfit)} />
          <Metric label="Gross profit" value={currency(totals.grossProfit)} />
          <Metric label="Expenses" value={currency(totals.expenses)} />
          <Metric label="Payroll" value={currency(totals.payroll)} />
          <Metric label="Net estimate" value={currency(totals.netProfit)} accent={totals.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"} />
        </div>
      </section>

      <ValidationPanel issues={validation.issues} existingDuplicateDates={validation.existingDuplicateDates} />

      <div className="mb-6 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Spreadsheet entry</h2>
            <p className="text-sm font-medium text-slate-500">
              {monthStartIso(new Date(`${month}-01T00:00:00`))} to {monthEndIso(new Date(`${month}-01T00:00:00`))}
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 transition hover:-translate-y-0.5 hover:bg-cyan-700"
            onClick={() => setPreviewed(true)}
            type="button"
          >
            <SearchCheck className="h-4 w-4" />
            Preview month
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[2100px] divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
              <tr>
                {bulkTemplateHeaders.map((field) => (
                  <th className="px-3 py-4 font-black" key={field}>{labels[field]}</th>
                ))}
                <th className="px-3 py-4 font-black">Total sales</th>
                <th className="px-3 py-4 font-black">Fuel margin</th>
                <th className="px-3 py-4 font-black">Fuel profit</th>
                <th className="px-3 py-4 font-black">Net estimate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr className="transition hover:bg-cyan-50/40" key={`${row.date}-${index}`}>
                  {bulkTemplateHeaders.map((field) => (
                    <td className="px-3 py-3 align-top" key={field}>
                      {field === "date" ? (
                        <input
                          className="w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                          onChange={(event) => updateRow(index, field, event.target.value)}
                          type="date"
                          value={row.date}
                        />
                      ) : field === "notes" ? (
                        <input
                          className="w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                          onChange={(event) => updateRow(index, field, event.target.value)}
                          type="text"
                          value={row.notes ?? ""}
                        />
                      ) : (
                        <input
                          className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                          min="0"
                          onChange={(event) => updateRow(index, field, event.target.value)}
                          step="0.01"
                          type="number"
                          value={row[field]}
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 font-black text-slate-800">{currency(bulkTotalSales(row))}</td>
                  <td className="px-3 py-3 font-black text-slate-800">{currency(bulkFuelMargin(row))}</td>
                  <td className="px-3 py-3 font-black text-slate-800">{currency(bulkFuelProfit(row))}</td>
                  <td className="px-3 py-3 font-black text-slate-800">{currency(bulkNetProfitEstimate(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewed ? (
        <section className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Preview ready</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {rows.length} rows, {validation.missingDates.length} missing dates, {validation.badNumberRows.length} bad-number rows, {validation.existingDuplicateDates.length} saved-date duplicates.
              </p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSave || saving}
              onClick={() => void handleSave()}
              type="button"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save all days"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value, accent = "text-slate-950" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-card">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-black tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}

function ValidationPanel({
  existingDuplicateDates,
  issues,
}: {
  existingDuplicateDates: string[];
  issues: BulkRowIssue[];
}) {
  if (!issues.length && !existingDuplicateDates.length) {
    return (
      <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
        Validation passed. Preview the month before saving.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50/90 p-4 text-sm font-semibold text-amber-900 shadow-sm">
      <p className="font-black">Validation needs review</p>
      {existingDuplicateDates.length ? (
        <p className="mt-2">
          Saved entries already exist for {existingDuplicateDates.join(", ")}. Enable overwrite to replace daily sales for those dates.
        </p>
      ) : null}
      {issues.length ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {issues.slice(0, 12).map((issue, index) => (
            <li key={`${issue.date}-${issue.message}-${index}`}>
              {issue.row ? `Row ${numberFormatter.format(issue.row)} ` : ""}{issue.date}: {issue.message}
            </li>
          ))}
          {issues.length > 12 ? <li>{issues.length - 12} more issues...</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
