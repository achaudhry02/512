"use client";

import { Edit3, FileSpreadsheet, Printer, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { currency, percent } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import {
  emptyMonthlyTotals,
  monthlyExpensePercentage,
  monthlyFuelMargin,
  monthlyFuelProfit,
  monthlyGrossMarginPercent,
  monthlyGrossProfit,
  monthlyNetMarginPercent,
  monthlyNetProfit,
  monthlyPeriodKey,
  monthlyTotalExpenses,
  monthlyTotalSales,
  monthlyTotalsToCsv,
  type MonthlyTotalsFormValues,
} from "@/lib/monthly-totals";
import type { MonthlyTotal } from "@/lib/types";

const salesFields = [
  ["grocery_sales", "Grocery Sales"],
  ["deli_sales", "Deli Sales"],
  ["hot_food_sales", "Hot Food Sales"],
  ["fuel_gallons_sold", "Fuel Gallons Sold"],
  ["fuel_revenue", "Fuel Revenue"],
  ["fuel_cost", "Fuel Cost"],
  ["lottery_sales", "Lottery Sales"],
  ["beer_sales", "Beer Sales"],
  ["cigarette_sales", "Cigarette Sales"],
  ["vape_nicotine_sales", "Vape/Nicotine Sales"],
  ["other_sales", "Other Sales"],
  ["cash_sales", "Cash Sales"],
  ["card_sales", "Card Sales"],
] as const;

const expenseFields = [
  ["payroll", "Payroll"],
  ["inventory_purchases", "Inventory Purchases"],
  ["vendor_expenses", "Vendor Expenses"],
  ["utilities", "Utilities"],
  ["rent_mortgage", "Rent/Mortgage"],
  ["insurance", "Insurance"],
  ["repairs_maintenance", "Repairs & Maintenance"],
  ["miscellaneous_expenses", "Miscellaneous Expenses"],
] as const;

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function normalizeMonthlyRecord(record: MonthlyTotalsFormValues | MonthlyTotal): MonthlyTotalsFormValues {
  return {
    ...emptyMonthlyTotals(),
    ...record,
    notes: record.notes ?? null,
  };
}

export function MonthlyTotalsEntry() {
  const { data, deleteMonthlyTotal, saveMonthlyTotal } = useCommandCenter();
  const [values, setValues] = useState<MonthlyTotalsFormValues>(() => emptyMonthlyTotals());
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const existing = useMemo(
    () => data.monthly_totals.find((entry) => entry.year === values.year && entry.month === values.month),
    [data.monthly_totals, values.month, values.year],
  );
  const activeRecord = existing && !editingId ? normalizeMonthlyRecord(existing) : values;
  const calculations = useMemo(
    () => ({
      totalSales: monthlyTotalSales(activeRecord),
      totalExpenses: monthlyTotalExpenses(activeRecord),
      fuelMargin: monthlyFuelMargin(activeRecord),
      fuelProfit: monthlyFuelProfit(activeRecord),
      grossProfit: monthlyGrossProfit(activeRecord),
      netProfit: monthlyNetProfit(activeRecord),
      expensePercentage: monthlyExpensePercentage(activeRecord),
      grossMargin: monthlyGrossMarginPercent(activeRecord),
      netMargin: monthlyNetMarginPercent(activeRecord),
    }),
    [activeRecord],
  );

  function updateField(field: keyof MonthlyTotalsFormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: field === "notes" ? (value.trim() ? value : null) : Number(value),
    }));
    setStatus(null);
  }

  function editExisting() {
    if (!existing) return;
    setValues(normalizeMonthlyRecord(existing));
    setEditingId(existing.id);
    setStatus(`Editing ${monthlyPeriodKey(existing)}.`);
  }

  async function save() {
    if (existing && !editingId) {
      setStatus(`A saved entry already exists for ${monthlyPeriodKey(existing)}. Click Edit before saving changes.`);
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      await saveMonthlyTotal(values, editingId ?? existing?.id);
      setEditingId(undefined);
      setStatus(`Saved monthly totals for ${monthlyPeriodKey(values)}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save monthly totals.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const id = editingId ?? existing?.id;
    if (!id) return;
    if (!window.confirm("Delete this monthly totals entry? Daily records will not be changed.")) return;
    setSaving(true);
    setStatus(null);
    try {
      await deleteMonthlyTotal(id);
      setEditingId(undefined);
      setValues(emptyMonthlyTotals(new Date(values.year, values.month - 1, 1)));
      setStatus("Monthly totals entry deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete monthly totals.");
    } finally {
      setSaving(false);
    }
  }

  function exportExcel() {
    const csv = monthlyTotalsToCsv(activeRecord);
    const blob = new Blob([csv], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monthly-totals-${monthlyPeriodKey(activeRecord)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    window.print();
  }

  return (
    <div>
      {status ? (
        <div className="mb-6 rounded-3xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-semibold text-cyan-800">
          {status}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <h2 className="text-xl font-black text-slate-950">Monthly Totals Entry</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Enter one set of totals for the month. This does not overwrite daily records.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-xs font-black uppercase text-slate-500">Month</span>
              <select
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-black outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => updateField("month", event.target.value)}
                value={values.month}
              >
                {months.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-black uppercase text-slate-500">Year</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-black outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                min="2000"
                onChange={(event) => updateField("year", event.target.value)}
                type="number"
                value={values.year}
              />
            </label>
          </div>
          {existing ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              A saved monthly totals entry exists for {monthlyPeriodKey(existing)}. Use Edit to change it.
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Total Sales" value={currency(calculations.totalSales)} />
          <Metric label="Total Expenses" value={currency(calculations.totalExpenses)} />
          <Metric label="Fuel Margin" value={currency(calculations.fuelMargin)} />
          <Metric label="Fuel Profit" value={currency(calculations.fuelProfit)} />
          <Metric label="Gross Profit" value={currency(calculations.grossProfit)} />
          <Metric label="Net Profit" value={currency(calculations.netProfit)} accent={calculations.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"} />
          <Metric label="Expense %" value={percent(calculations.expensePercentage)} />
          <Metric label="Gross Margin %" value={percent(calculations.grossMargin)} />
          <Metric label="Net Margin %" value={percent(calculations.netMargin)} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card print:shadow-none">
        <div className="grid gap-6 xl:grid-cols-2">
          <FieldGroup fields={salesFields} title="Sales" updateField={updateField} values={values} />
          <FieldGroup fields={expenseFields} title="Expenses" updateField={updateField} values={values} />
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase text-slate-500">Notes</span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            onChange={(event) => updateField("notes", event.target.value)}
            value={values.notes ?? ""}
          />
        </label>

        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 disabled:opacity-60"
            disabled={saving}
            onClick={() => void save()}
            type="button"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm disabled:opacity-50"
            disabled={!existing || saving}
            onClick={editExisting}
            type="button"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 disabled:opacity-50"
            disabled={(!existing && !editingId) || saving}
            onClick={() => void remove()}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm" onClick={printPdf} type="button">
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm" onClick={exportExcel} type="button">
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </section>
    </div>
  );
}

function FieldGroup({
  fields,
  title,
  updateField,
  values,
}: {
  fields: readonly (readonly [keyof MonthlyTotalsFormValues, string])[];
  title: string;
  updateField: (field: keyof MonthlyTotalsFormValues, value: string) => void;
  values: MonthlyTotalsFormValues;
}) {
  return (
    <div>
      <h3 className="mb-3 text-lg font-black text-slate-950">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([field, label]) => (
          <label className="block" key={field}>
            <span className="text-xs font-black uppercase text-slate-500">{label}</span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              min="0"
              onChange={(event) => updateField(field, event.target.value)}
              step={field === "fuel_gallons_sold" ? "0.001" : "0.01"}
              type="number"
              value={String(values[field] ?? 0)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, accent = "text-slate-950" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/80 bg-white p-4 shadow-card">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}
