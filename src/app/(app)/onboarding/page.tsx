"use client";

import {
  ArrowRight,
  Building2,
  Check,
  CircleDot,
  Download,
  Fuel,
  Gauge,
  Loader2,
  PackagePlus,
  PlugZap,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { useCommandCenter } from "@/lib/data-provider";
import { onboardingProgress } from "@/lib/onboarding";
import { defaultPosMappings, posSystems } from "@/lib/pos-import";
import type { PosSystemKey } from "@/lib/types";

const stepIcons = {
  store: Store,
  margins: Gauge,
  pos: PlugZap,
  first_entry: PackagePlus,
  vendors: Building2,
  fuel_grades: Fuel,
  employees: Users,
};

export default function OnboardingPage() {
  const {
    data,
    loading,
    saveDefaultMargins,
    savePosColumnMapping,
    seedSampleData,
    store,
    updateStore,
  } = useCommandCenter();
  const [storeForm, setStoreForm] = useState({ name: "", address: "", city: "", state: "", zip: "" });
  const [selectedPos, setSelectedPos] = useState<PosSystemKey>("generic");
  const [saving, setSaving] = useState<"store" | "margins" | "pos" | "sample" | null>(null);
  const [confirmSample, setConfirmSample] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = onboardingProgress(data, store);

  useEffect(() => {
    setStoreForm({
      name: store?.name ?? "",
      address: store?.address ?? "",
      city: store?.city ?? "",
      state: store?.state ?? "",
      zip: store?.zip ?? "",
    });
  }, [store]);

  useEffect(() => {
    const savedPos = data.pos_column_mappings.find((mapping) => mapping.template_name === "Onboarding default");
    if (savedPos) setSelectedPos(savedPos.pos_key);
  }, [data.pos_column_mappings]);

  async function runAction(kind: typeof saving, action: () => Promise<void>, successMessage: string) {
    setSaving(kind);
    setMessage(null);
    setError(null);
    try {
      await action();
      setMessage(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to complete this setup step.");
    } finally {
      setSaving(null);
    }
  }

  function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAction("store", () => updateStore({
      name: storeForm.name || "My Convenience Store",
      address: storeForm.address || null,
      city: storeForm.city || null,
      state: storeForm.state || null,
      zip: storeForm.zip || null,
    }), "Store details saved.");
  }

  function savePosChoice() {
    const existing = data.pos_column_mappings.find((mapping) =>
      mapping.pos_key === selectedPos && mapping.template_name === "Onboarding default");
    void runAction("pos", () => savePosColumnMapping(
      selectedPos,
      "Onboarding default",
      defaultPosMappings[selectedPos],
      existing?.id,
    ), "POS choice and starter mapping saved.");
  }

  function addSampleData() {
    if (!confirmSample) {
      setConfirmSample(true);
      return;
    }
    void runAction("sample", seedSampleData, "Sample data added to empty modules. Existing records were not changed.");
    setConfirmSample(false);
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Set up your store"
        description="Complete the operating basics once, then use the dashboard checklists to keep each day and month on track."
        actions={<Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white" href="/dashboard">Go to dashboard <ArrowRight className="h-4 w-4" /></Link>}
      />

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h3 className="text-xl font-black text-slate-950">Setup progress</h3><p className="mt-1 text-sm text-slate-500">{progress.completed} of {progress.total} steps complete for {store?.name ?? "this store"}.</p></div>
          <p className="text-3xl font-black text-slate-950">{progress.percent}%</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600 transition-all" style={{ width: `${progress.percent}%` }} /></div>
        <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {progress.steps.map((step) => {
            const Icon = stepIcons[step.key];
            return <a className={`flex items-start gap-3 rounded-lg border p-3 transition hover:border-cyan-300 ${step.complete ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"}`} href={step.href} key={step.key}><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${step.complete ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}>{step.complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><span><span className="block text-sm font-black text-slate-900">{step.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{step.description}</span></span></a>;
          })}
        </div>
      </section>

      {message ? <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p> : null}
      {error ? <p className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card" id="store">
            <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-lg font-black text-slate-950">1. Store details</h3><p className="mt-1 text-sm text-slate-500">The active location controls every dashboard query and export.</p></div>
            <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={saveStore}>
              {Object.entries({ name: "Store name", address: "Address", city: "City", state: "State", zip: "ZIP" }).map(([key, label]) => <label className={key === "address" ? "sm:col-span-2" : ""} key={key}><span className="text-xs font-black uppercase text-slate-500">{label}</span><input className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-cyan-500" onChange={(event) => setStoreForm((current) => ({ ...current, [key]: event.target.value }))} value={storeForm[key as keyof typeof storeForm]} /></label>)}
              <div className="sm:col-span-2"><button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60" disabled={saving !== null} type="submit">{saving === "store" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save store details</button></div>
            </form>
          </section>

          <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-card sm:grid-cols-[1fr_auto] sm:items-center" id="margins">
            <div><h3 className="text-lg font-black text-slate-950">2. Default margins</h3><p className="mt-1 text-sm leading-6 text-slate-500">Recommended defaults establish useful profit estimates immediately. Fine-tune them later in Settings.</p></div>
            {data.margin_settings.length ? <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-800" href="/settings#margin-settings">Review margins</Link> : <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60" disabled={saving !== null} onClick={() => void runAction("margins", saveDefaultMargins, "Recommended margin settings saved.")} type="button">{saving === "margins" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />} Save defaults</button>}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card" id="pos">
            <h3 className="text-lg font-black text-slate-950">3. POS system</h3><p className="mt-1 text-sm text-slate-500">This saves a starter column mapping. You can adjust every field during the first import.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row"><select aria-label="POS system" className="min-h-11 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold" onChange={(event) => setSelectedPos(event.target.value as PosSystemKey)} value={selectedPos}>{posSystems.map((system) => <option key={system.key} value={system.key}>{system.name}</option>)}</select><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60" disabled={saving !== null} onClick={savePosChoice} type="button">{saving === "pos" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Save POS choice</button></div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card" id="first-entry">
            <h3 className="text-lg font-black text-slate-950">4. First sales data</h3><p className="mt-1 text-sm text-slate-500">Choose the fastest starting point for the information you already have.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Enter one day", "/daily-sales"], ["Enter a full month", "/bulk-entry"], ["Import a POS file", "/pos-integrations"]].map(([label, href]) => <Link className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 transition hover:border-cyan-300 hover:bg-cyan-50" href={href} key={href}>{label}<ArrowRight className="h-4 w-4" /></Link>)}</div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="text-lg font-black text-slate-950">Add sample data</h3><p className="mt-2 text-sm leading-6 text-slate-500">Populate only empty modules with three sample days, expenses, inventory, a vendor, an employee, and fuel grades. Existing records are never overwritten.</p>
            <button className={`mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black text-white disabled:opacity-60 ${confirmSample ? "bg-rose-700" : "bg-cyan-700"}`} disabled={saving !== null} onClick={addSampleData} type="button">{saving === "sample" ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmSample ? <CircleDot className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}{saving === "sample" ? "Adding sample data..." : confirmSample ? "Confirm sample data" : "Add sample data"}</button>
            {confirmSample ? <button className="mt-2 min-h-11 w-full text-sm font-bold text-slate-600" onClick={() => setConfirmSample(false)} type="button">Cancel</button> : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="text-lg font-black text-slate-950">Import templates</h3><div className="mt-4 space-y-2"><a className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700" download href="/templates/bulk-daily-entry.csv">Bulk daily entry <Download className="h-4 w-4" /></a><a className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700" download href="/templates/generic-pos-import.csv">Generic POS import <Download className="h-4 w-4" /></a></div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="text-lg font-black text-slate-950">Finish the operating team</h3><div className="mt-4 space-y-2">{progress.steps.filter((step) => ["vendors", "fuel_grades", "employees"].includes(step.key)).map((step) => <Link className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700" href={step.href} key={step.key}><span className="flex items-center gap-2">{step.complete ? <Check className="h-4 w-4 text-emerald-600" /> : <CircleDot className="h-4 w-4 text-slate-400" />}{step.title}</span><ArrowRight className="h-4 w-4" /></Link>)}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
