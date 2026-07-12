"use client";

import { CheckCircle2, LockKeyhole, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { currency, todayIso } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import { evaluateDailyClose } from "@/lib/end-of-day-close";
import { calculatePnlConfidence } from "@/lib/pnl-confidence";
import type { DailyCloseStatus } from "@/lib/types";

const checklistLabels: Array<[keyof Pick<DailyCloseStatus,
  "daily_sales_completed" | "pos_import_completed" | "cash_reconciliation_completed" | "card_batch_completed" | "lottery_completed" | "fuel_completed" | "bank_deposit_matched">, string]> = [
  ["daily_sales_completed", "Daily sales or POS data exists"],
  ["pos_import_completed", "POS import completed or reviewed"],
  ["cash_reconciliation_completed", "Cash reconciliation saved"],
  ["card_batch_completed", "Card batch is within threshold"],
  ["lottery_completed", "Lottery entered or marked not applicable"],
  ["fuel_completed", "Fuel data and variance are complete"],
  ["bank_deposit_matched", "Bank deposit matched or pending override"],
];

function closeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  return "Unable to update close status.";
}

export default function EndOfDayClosePage() {
  const { data, role, saveEntry, store, user } = useCommandCenter();
  const [date, setDate] = useState(todayIso());
  const saved = data.daily_close_statuses.find((row) => row.date === date) ?? null;
  const [overrideReason, setOverrideReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lotteryNotApplicable, setLotteryNotApplicable] = useState(false);
  const [bankPending, setBankPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOverrideReason(saved?.override_reason ?? "");
    setNotes(saved?.notes ?? "");
    setLotteryNotApplicable(saved?.lottery_completed ?? false);
    setBankPending(saved?.bank_deposit_matched ?? false);
  }, [saved]);

  const evaluation = useMemo(() => evaluateDailyClose(data, date, {
    cash_variance_threshold: store?.cash_variance_threshold ?? 5,
    card_mismatch_threshold: store?.card_mismatch_threshold ?? 5,
    fuel_variance_threshold: store?.fuel_variance_threshold ?? 25,
  }, saved ? { ...saved, lottery_completed: lotteryNotApplicable || saved.lottery_completed, bank_deposit_matched: bankPending || saved.bank_deposit_matched, override_reason: overrideReason } : ({
    lottery_completed: lotteryNotApplicable,
    bank_deposit_matched: bankPending,
    override_reason: overrideReason,
  } as DailyCloseStatus)), [bankPending, data, date, lotteryNotApplicable, overrideReason, saved, store]);
  const confidence = useMemo(() => calculatePnlConfidence(data, date, date, true), [data, date]);

  async function saveStatus(status: DailyCloseStatus["status"]) {
    if (!user) return;
    if (status === "closed" && evaluation.requiresOverride && !overrideReason.trim()) {
      setMessage("Enter an override reason before closing with missing steps or mismatches.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveEntry("daily_close_statuses", {
        date,
        status,
        ...evaluation.checklist,
        lottery_completed: evaluation.checklist.lottery_completed || lotteryNotApplicable,
        bank_deposit_matched: evaluation.checklist.bank_deposit_matched || bankPending,
        override_reason: overrideReason.trim() || null,
        closed_at: status === "closed" ? new Date().toISOString() : null,
        closed_by: status === "closed" ? user.id : null,
        reopened_at: status === "closed" ? null : new Date().toISOString(),
        reopened_by: status === "closed" ? null : user.id,
        notes: notes.trim() || null,
      }, saved?.id);
      setMessage(status === "closed" ? "Business day closed." : "Business day reopened.");
    } catch (error) {
      setMessage(closeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const summaryCards = [
    ["Inside sales", evaluation.summary.insideSales], ["Fuel sales", evaluation.summary.fuelSales],
    ["Lottery sales", evaluation.summary.lotterySales], ["Expected cash", evaluation.summary.expectedCash],
    ["Actual cash", evaluation.summary.actualCash], ["Cash over/short", evaluation.summary.cashOverShort],
    ["POS card total", evaluation.summary.posCardTotal], ["Processor card total", evaluation.summary.processorCardTotal],
    ["Card mismatch", evaluation.summary.cardMismatch], ["Bank deposit", evaluation.summary.bankDeposit],
  ] as const;

  return <div>
    <PageHeader eyebrow="Operations close" title="End-of-Day Close" description="Verify sales, tenders, fuel, lottery, and deposit controls before closing the business date." />
    <div className="mb-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card md:grid-cols-[220px_1fr_auto] md:items-end">
      <label className="grid gap-2 text-xs font-black uppercase text-slate-500">Business date<input aria-label="Close date" className="min-h-12 rounded-lg border border-slate-200 px-3 text-sm text-slate-900" onChange={(event) => setDate(event.target.value)} type="date" value={date} /></label>
      <div><p className="text-xs font-black uppercase text-slate-500">Current status</p><p className="mt-2 text-xl font-black capitalize text-slate-950">{(saved?.status ?? "not_started").replaceAll("_", " ")}</p></div>
      <div className="rounded-lg bg-slate-950 px-4 py-3 text-white"><p className="text-xs font-bold text-slate-300">P&amp;L confidence</p><p className="mt-1 text-lg font-black">{confidence.score}% | {confidence.label}</p></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{summaryCards.map(([label, value]) => <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card" key={label}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className={`mt-2 text-xl font-black ${value < 0 ? "text-rose-700" : "text-slate-950"}`}>{currency(value)}</p></div>)}<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card"><p className="text-xs font-black uppercase text-slate-500">Missing steps</p><p className="mt-2 text-xl font-black text-slate-950">{evaluation.missingSteps.length}</p></div></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h2 className="text-xl font-black text-slate-950">Close checklist</h2><div className="mt-4 divide-y divide-slate-100">{checklistLabels.map(([key, label]) => <div className="flex items-center justify-between gap-4 py-3" key={key}><span className="text-sm font-bold text-slate-700">{label}</span>{evaluation.checklist[key] ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <TriangleAlert className="h-5 w-5 text-amber-600" />}</div>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold"><input checked={lotteryNotApplicable} onChange={(event) => setLotteryNotApplicable(event.target.checked)} type="checkbox" />Lottery not applicable</label><label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-bold"><input checked={bankPending} onChange={(event) => setBankPending(event.target.checked)} type="checkbox" />Bank deposit pending</label></div></section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h2 className="text-xl font-black text-slate-950">Review and close</h2>{[...evaluation.missingSteps, ...evaluation.mismatches].length ? <ul className="mt-4 space-y-2 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">{[...evaluation.missingSteps, ...evaluation.mismatches].map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm font-bold text-emerald-800">All close controls are ready.</p>}<label className="mt-4 block text-xs font-black uppercase text-slate-500">Override reason<textarea className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm normal-case" onChange={(event) => setOverrideReason(event.target.value)} value={overrideReason} /></label><label className="mt-4 block text-xs font-black uppercase text-slate-500">Notes<textarea className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm normal-case" onChange={(event) => setNotes(event.target.value)} value={notes} /></label>{message ? <p className="mt-4 text-sm font-bold text-cyan-800">{message}</p> : null}<div className="mt-5 flex flex-wrap gap-3"><button className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50" disabled={saving || saved?.status === "closed"} onClick={() => void saveStatus("closed")} type="button"><LockKeyhole className="h-4 w-4" />Close Day</button>{role === "owner" && saved?.status === "closed" ? <button className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 px-5 text-sm font-black text-slate-800" disabled={saving} onClick={() => void saveStatus("in_progress")} type="button"><RotateCcw className="h-4 w-4" />Reopen Day</button> : null}</div></section>
    </div>
  </div>;
}
