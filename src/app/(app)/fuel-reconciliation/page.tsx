"use client";

import { Calculator, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import {
  calculateFuelReconciliation,
  fuelReconciliationTotals,
  soldGallonsForDate,
} from "@/lib/fuel-reconciliation";
import { currency, numberFormatter, todayIso } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import type { FuelDelivery, FuelGrade, FuelReconciliation, FuelTankReading } from "@/lib/types";

type GradeForm = Omit<FuelGrade, "id" | "user_id" | "store_id" | "created_at" | "updated_at">;
type ReconciliationForm = Omit<FuelReconciliation, "id" | "user_id" | "store_id" | "created_at" | "updated_at" | "book_inventory" | "variance" | "actual_margin" | "suggested_price" | "is_variance_alert">;

const defaultGrades: GradeForm[] = [
  { name: "Regular", code: "regular", sort_order: 1, active: true, target_margin: 0.2, variance_threshold_gallons: 25, notes: null },
  { name: "Midgrade", code: "midgrade", sort_order: 2, active: true, target_margin: 0.22, variance_threshold_gallons: 25, notes: null },
  { name: "Premium", code: "premium", sort_order: 3, active: true, target_margin: 0.25, variance_threshold_gallons: 25, notes: null },
  { name: "Diesel", code: "diesel", sort_order: 4, active: true, target_margin: 0.24, variance_threshold_gallons: 35, notes: null },
];

const emptyGrade: GradeForm = {
  name: "",
  code: "",
  sort_order: 10,
  active: true,
  target_margin: 0.2,
  variance_threshold_gallons: 25,
  notes: null,
};

function emptyReconciliation(grade?: FuelGrade): ReconciliationForm {
  return {
    date: todayIso(),
    fuel_grade_id: grade?.id ?? "",
    grade_name: grade?.name ?? "",
    beginning_gallons: 0,
    delivered_gallons: 0,
    sold_gallons: 0,
    ending_gallons: 0,
    actual_inventory: 0,
    rack_cost_per_gallon: 0,
    retail_price_per_gallon: 0,
    target_margin: grade?.target_margin ?? 0.2,
    notes: null,
  };
}

export default function FuelReconciliationPage() {
  const { data, deleteEntry, saveEntry } = useCommandCenter();
  const activeGrades = data.fuel_grades.filter((grade) => grade.active);
  const [selectedGradeId, setSelectedGradeId] = useState(activeGrades[0]?.id ?? "");
  const selectedGrade = data.fuel_grades.find((grade) => grade.id === selectedGradeId) ?? activeGrades[0];
  const [gradeForm, setGradeForm] = useState<GradeForm>(emptyGrade);
  const [reconciliationId, setReconciliationId] = useState<string | undefined>();
  const [form, setForm] = useState<ReconciliationForm>(emptyReconciliation(selectedGrade));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const matchingDelivery = data.fuel_deliveries.find((entry) => entry.date === form.date && entry.fuel_grade_id === form.fuel_grade_id);
  const beginningReading = data.fuel_tank_readings.find((entry) => entry.date === form.date && entry.fuel_grade_id === form.fuel_grade_id && entry.reading_type === "beginning");
  const endingReading = data.fuel_tank_readings.find((entry) => entry.date === form.date && entry.fuel_grade_id === form.fuel_grade_id && entry.reading_type === "ending");
  const savedForDate = data.fuel_reconciliations.find((entry) => entry.date === form.date && entry.fuel_grade_id === form.fuel_grade_id && entry.id !== reconciliationId);
  const threshold = selectedGrade?.variance_threshold_gallons ?? 25;
  const math = calculateFuelReconciliation(form, threshold);
  const totals = useMemo(() => fuelReconciliationTotals(data.fuel_reconciliations), [data.fuel_reconciliations]);

  useEffect(() => {
    if (!selectedGrade && activeGrades.length) {
      setSelectedGradeId(activeGrades[0].id);
      return;
    }

    if (selectedGrade) {
      setForm((current) => ({
        ...current,
        fuel_grade_id: selectedGrade.id,
        grade_name: selectedGrade.name,
        target_margin: selectedGrade.target_margin,
      }));
    }
  }, [activeGrades, selectedGrade]);

  function updateFormNumber(key: keyof ReconciliationForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: Number(value) || 0,
    }));
  }

  function updateGradeNumber(key: keyof GradeForm, value: string) {
    setGradeForm((current) => ({
      ...current,
      [key]: Number(value) || 0,
    }));
  }

  function applySourceData() {
    const sold = soldGallonsForDate(form.date, data.fuel_entries, data.pos_import_rows);

    setForm((current) => ({
      ...current,
      beginning_gallons: beginningReading?.gallons ?? current.beginning_gallons,
      delivered_gallons: matchingDelivery?.delivered_gallons ?? current.delivered_gallons,
      sold_gallons: sold.gallons || current.sold_gallons,
      ending_gallons: endingReading?.gallons ?? current.ending_gallons,
      actual_inventory: endingReading?.gallons ?? current.actual_inventory,
      rack_cost_per_gallon: matchingDelivery?.rack_cost_per_gallon ?? current.rack_cost_per_gallon,
    }));

    setMessage(`Pulled sold gallons from ${sold.source}.`);
  }

  async function createDefaultGrades() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      for (const grade of defaultGrades) {
        await saveEntry("fuel_grades", grade);
      }
      setMessage("Default fuel grades created.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create default grades.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGradeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const code = gradeForm.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_") || gradeForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
      await saveEntry("fuel_grades", {
        ...gradeForm,
        code,
        name: gradeForm.name || "Custom grade",
        notes: gradeForm.notes || null,
      });
      setGradeForm(emptyGrade);
      setMessage("Fuel grade saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save fuel grade.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDeliveryAndReadings(reconciliation: ReconciliationForm) {
    const deliveryPayload: Omit<FuelDelivery, "id" | "user_id" | "store_id" | "created_at" | "updated_at"> = {
      date: reconciliation.date,
      fuel_grade_id: reconciliation.fuel_grade_id,
      grade_name: reconciliation.grade_name,
      delivered_gallons: reconciliation.delivered_gallons,
      rack_cost_per_gallon: reconciliation.rack_cost_per_gallon,
      invoice_number: null,
      vendor_name: "Fuel supplier",
      notes: "Created from fuel reconciliation",
    };
    const beginningPayload: Omit<FuelTankReading, "id" | "user_id" | "store_id" | "created_at" | "updated_at"> = {
      date: reconciliation.date,
      fuel_grade_id: reconciliation.fuel_grade_id,
      grade_name: reconciliation.grade_name,
      reading_type: "beginning",
      gallons: reconciliation.beginning_gallons,
      notes: "Created from fuel reconciliation",
    };
    const endingPayload: Omit<FuelTankReading, "id" | "user_id" | "store_id" | "created_at" | "updated_at"> = {
      date: reconciliation.date,
      fuel_grade_id: reconciliation.fuel_grade_id,
      grade_name: reconciliation.grade_name,
      reading_type: "ending",
      gallons: reconciliation.actual_inventory || reconciliation.ending_gallons,
      notes: "Created from fuel reconciliation",
    };

    await saveEntry("fuel_deliveries", deliveryPayload, matchingDelivery?.id);
    await saveEntry("fuel_tank_readings", beginningPayload, beginningReading?.id);
    await saveEntry("fuel_tank_readings", endingPayload, endingReading?.id);
  }

  async function handleReconciliationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    if (!form.fuel_grade_id) {
      setError("Create or select a fuel grade first.");
      setSaving(false);
      return;
    }

    try {
      const existingId = reconciliationId ?? savedForDate?.id;
      await saveDeliveryAndReadings(form);
      await saveEntry("fuel_reconciliations", {
        ...form,
        actual_inventory: form.actual_inventory || form.ending_gallons,
        notes: form.notes || null,
      }, existingId);
      setReconciliationId(undefined);
      setMessage(math.isVarianceAlert ? "Fuel reconciliation saved with a variance alert." : "Fuel reconciliation saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save fuel reconciliation.");
    } finally {
      setSaving(false);
    }
  }

  function editReconciliation(entry: FuelReconciliation) {
    setSelectedGradeId(entry.fuel_grade_id);
    setReconciliationId(entry.id);
    setForm({
      date: entry.date,
      fuel_grade_id: entry.fuel_grade_id,
      grade_name: entry.grade_name,
      beginning_gallons: entry.beginning_gallons,
      delivered_gallons: entry.delivered_gallons,
      sold_gallons: entry.sold_gallons,
      ending_gallons: entry.ending_gallons,
      actual_inventory: entry.actual_inventory,
      rack_cost_per_gallon: entry.rack_cost_per_gallon,
      retail_price_per_gallon: entry.retail_price_per_gallon,
      target_margin: entry.target_margin,
      notes: entry.notes,
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Fuel reconciliation"
        title="Fuel delivery and tank reconciliation"
        description="Manage grades, deliveries, tank readings, sold gallons, book inventory, actual inventory, variance alerts, rack cost, margin, and suggested pricing."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-card">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Variance alerts</p>
          <p className="mt-3 text-3xl font-black text-slate-950">{totals.alertCount}</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-card">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Total variance</p>
          <p className="mt-3 text-3xl font-black text-slate-950">{numberFormatter.format(totals.totalVariance)} gal</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-card">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Low margin grades</p>
          <p className="mt-3 text-3xl font-black text-slate-950">{totals.lowMarginCount}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <aside className="min-w-0 space-y-6">
          <section className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">Fuel grades</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">Regular, midgrade, premium, diesel, or custom tanks.</p>
              </div>
              {!data.fuel_grades.length ? (
                <button
                  className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
                  disabled={saving}
                  onClick={() => void createDefaultGrades()}
                  type="button"
                >
                  Defaults
                </button>
              ) : null}
            </div>
            <div className="mt-5 space-y-2">
              {data.fuel_grades.map((grade) => (
                <button
                  className={`w-full rounded-2xl border p-4 text-left transition ${selectedGradeId === grade.id ? "border-cyan-200 bg-cyan-50" : "border-slate-100 bg-slate-50/80 hover:border-slate-200"}`}
                  key={grade.id}
                  onClick={() => setSelectedGradeId(grade.id)}
                  type="button"
                >
                  <span className="block font-black text-slate-950">{grade.name}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    Target margin {currency(grade.target_margin)} / gal · alert over {numberFormatter.format(grade.variance_threshold_gallons)} gal
                  </span>
                </button>
              ))}
              {!data.fuel_grades.length ? <p className="text-sm font-semibold text-slate-500">Create default grades or add a custom grade.</p> : null}
            </div>
          </section>

          <form className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card" onSubmit={handleGradeSubmit}>
            <h3 className="text-xl font-black text-slate-950">Add custom grade</h3>
            <div className="mt-5 grid gap-3">
              <input className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" onChange={(event) => setGradeForm((current) => ({ ...current, name: event.target.value }))} placeholder="Custom grade name" value={gradeForm.name} />
              <input className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" onChange={(event) => setGradeForm((current) => ({ ...current, code: event.target.value }))} placeholder="Code" value={gradeForm.code} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" min="0" onChange={(event) => updateGradeNumber("target_margin", event.target.value)} step="0.001" type="number" value={gradeForm.target_margin} />
                <input className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" min="0" onChange={(event) => updateGradeNumber("variance_threshold_gallons", event.target.value)} step="0.001" type="number" value={gradeForm.variance_threshold_gallons} />
              </div>
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black text-white" disabled={saving} type="submit"><Plus className="h-4 w-4" />Add grade</button>
            </div>
          </form>
        </aside>

        <main className="min-w-0 space-y-6">
          <form className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card" onSubmit={handleReconciliationSubmit}>
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-6">
              <h3 className="text-xl font-black text-slate-950">{reconciliationId || savedForDate ? "Edit reconciliation" : "New reconciliation"}</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">Saving also stores the delivery and beginning/ending tank readings for this grade and date.</p>
              {savedForDate ? <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">A reconciliation already exists for this grade/date. Saving will update it.</p> : null}
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Date</span>
                <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required type="date" value={form.date} />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Grade</span>
                <select className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" onChange={(event) => setSelectedGradeId(event.target.value)} value={selectedGradeId}>
                  {activeGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                </select>
              </label>
              {[
                ["beginning_gallons", "Beginning gallons"],
                ["delivered_gallons", "Delivered gallons"],
                ["sold_gallons", "Sold gallons"],
                ["ending_gallons", "Ending gallons"],
                ["actual_inventory", "Actual inventory"],
                ["rack_cost_per_gallon", "Rack cost / gal"],
                ["retail_price_per_gallon", "Retail price / gal"],
                ["target_margin", "Target margin"],
              ].map(([key, label]) => (
                <label className="block" key={key}>
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
                  <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" min="0" onChange={(event) => updateFormNumber(key as keyof ReconciliationForm, event.target.value)} step="0.001" type="number" value={String(form[key as keyof ReconciliationForm] ?? 0)} />
                </label>
              ))}
              <label className="block sm:col-span-2 xl:col-span-3">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Notes</span>
                <textarea className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} value={form.notes ?? ""} />
              </label>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
              {message ? <p className="mb-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
              {error ? <p className="mb-4 text-sm font-semibold text-red-600">{error}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm" onClick={applySourceData} type="button"><Calculator className="h-4 w-4" />Pull POS/manual data</button>
                <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 disabled:opacity-60" disabled={saving} type="submit"><Save className="h-4 w-4" />Save reconciliation</button>
              </div>
            </div>
          </form>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Book inventory", `${numberFormatter.format(math.bookInventory)} gal`],
              ["Actual inventory", `${numberFormatter.format(math.actualInventory)} gal`],
              ["Variance", `${numberFormatter.format(math.variance)} gal`],
              ["Suggested price", currency(math.suggestedPrice)],
              ["Actual margin", currency(math.actualMargin)],
              ["Target margin", currency(form.target_margin)],
              ["Rack cost", currency(form.rack_cost_per_gallon)],
              ["Alert", math.isVarianceAlert ? "Needs review" : "OK"],
            ].map(([label, value]) => (
              <div className="rounded-[1.5rem] border border-white/80 bg-white p-4 shadow-card" key={label}>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
                <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card">
            <div className="border-b border-slate-100 px-5 py-5">
              <h3 className="text-xl font-black text-slate-950">Saved fuel reconciliations</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.12em] text-slate-300">
                  <tr><th className="px-5 py-4">Date</th><th className="px-5 py-4">Grade</th><th className="px-5 py-4 text-right">Variance</th><th className="px-5 py-4 text-right">Margin</th><th className="px-5 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.fuel_reconciliations.map((entry) => (
                    <tr className="hover:bg-cyan-50/40" key={entry.id}>
                      <td className="px-5 py-4 font-semibold text-slate-700">{entry.date}</td>
                      <td className="px-5 py-4 font-bold text-slate-800">{entry.grade_name}</td>
                      <td className={`px-5 py-4 text-right font-black ${entry.is_variance_alert ? "text-rose-700" : "text-slate-700"}`}>{numberFormatter.format(entry.variance ?? calculateFuelReconciliation(entry).variance)} gal</td>
                      <td className="px-5 py-4 text-right font-black text-slate-700">{currency(entry.actual_margin ?? calculateFuelReconciliation(entry).actualMargin)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" onClick={() => editReconciliation(entry)} type="button">Edit</button>
                          <button className="rounded-xl border border-rose-100 bg-rose-50 p-2 text-rose-700" onClick={() => void deleteEntry("fuel_reconciliations", entry.id)} type="button" aria-label={`Delete ${entry.grade_name} reconciliation ${entry.date}`}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data.fuel_reconciliations.length ? (
                    <tr><td className="px-5 py-8 text-center font-semibold text-slate-500" colSpan={5}>No fuel reconciliations saved yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
