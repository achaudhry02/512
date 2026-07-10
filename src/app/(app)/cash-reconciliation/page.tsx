"use client";

import { Calculator, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { currency, todayIso } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import type { CashReconciliation } from "@/lib/types";

type CashForm = Omit<CashReconciliation, "id" | "user_id" | "store_id" | "created_at" | "updated_at" | "expected_ending_cash" | "variance" | "is_balanced">;

const emptyForm: CashForm = {
  date: todayIso(),
  starting_cash: 0,
  ending_cash: 0,
  expected_cash_sales: 0,
  cash_drops: 0,
  paid_outs: 0,
  lottery_payouts: 0,
  cash_over_short: 0,
  pos_card_total: 0,
  processor_card_total: 0,
  ebt_total: 0,
  gift_card_total: 0,
  other_tender_total: 0,
  bank_deposit_amount: 0,
  status: "draft",
  notes: null,
};

const moneyFields: { key: keyof CashForm; label: string }[] = [
  { key: "starting_cash", label: "Starting drawer cash" },
  { key: "ending_cash", label: "Ending drawer cash" },
  { key: "expected_cash_sales", label: "Cash sales expected" },
  { key: "cash_drops", label: "Cash drops" },
  { key: "paid_outs", label: "Paid-outs" },
  { key: "lottery_payouts", label: "Lottery payouts" },
  { key: "pos_card_total", label: "Card total from POS" },
  { key: "processor_card_total", label: "Card batch total" },
  { key: "ebt_total", label: "EBT total" },
  { key: "gift_card_total", label: "Gift card total" },
  { key: "other_tender_total", label: "Other tender total" },
  { key: "bank_deposit_amount", label: "Bank deposit amount" },
];

function cashMath(form: CashForm) {
  const expectedEndingCash =
    form.starting_cash +
    form.expected_cash_sales -
    form.cash_drops -
    form.paid_outs -
    form.lottery_payouts;
  const variance = form.ending_cash - expectedEndingCash;
  const cardVariance = form.processor_card_total - form.pos_card_total;
  const isBalanced = Math.abs(variance) <= 1 && Math.abs(cardVariance) <= 1;

  return {
    expectedEndingCash,
    variance,
    cardVariance,
    isBalanced,
  };
}

export default function CashReconciliationPage() {
  const { data, deleteEntry, saveEntry } = useCommandCenter();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [form, setForm] = useState<CashForm>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedEntry = data.cash_reconciliations.find((entry) => entry.id === selectedId);
  const dailySale = data.daily_sales.find((sale) => sale.date === form.date);
  const posRowsForDate = data.pos_import_rows.filter((row) => row.date === form.date);
  const math = useMemo(() => cashMath(form), [form]);

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }

    setForm({
      date: selectedEntry.date,
      starting_cash: selectedEntry.starting_cash,
      ending_cash: selectedEntry.ending_cash,
      expected_cash_sales: selectedEntry.expected_cash_sales,
      cash_drops: selectedEntry.cash_drops,
      paid_outs: selectedEntry.paid_outs,
      lottery_payouts: selectedEntry.lottery_payouts,
      cash_over_short: selectedEntry.cash_over_short,
      pos_card_total: selectedEntry.pos_card_total,
      processor_card_total: selectedEntry.processor_card_total,
      ebt_total: selectedEntry.ebt_total,
      gift_card_total: selectedEntry.gift_card_total,
      other_tender_total: selectedEntry.other_tender_total,
      bank_deposit_amount: selectedEntry.bank_deposit_amount,
      status: selectedEntry.status,
      notes: selectedEntry.notes,
    });
  }, [selectedEntry]);

  function updateMoneyField(key: keyof CashForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: Number(value) || 0,
    }));
  }

  function pullExpectedTotals() {
    const posCash = posRowsForDate.reduce((total, row) => total + row.cash_total, 0);
    const posCard = posRowsForDate.reduce((total, row) => total + row.card_total, 0);
    const posEbt = posRowsForDate.reduce((total, row) => total + row.ebt_total, 0);
    const posGift = posRowsForDate.reduce((total, row) => total + row.gift_card_total, 0);
    const posOther = posRowsForDate.reduce((total, row) => total + row.other_payment_total, 0);

    setForm((current) => ({
      ...current,
      expected_cash_sales: posCash || dailySale?.cash_total || current.expected_cash_sales,
      pos_card_total: posCard || dailySale?.card_total || current.pos_card_total,
      ebt_total: posEbt || current.ebt_total,
      gift_card_total: posGift || current.gift_card_total,
      other_tender_total: posOther || current.other_tender_total,
      lottery_payouts: dailySale?.lottery_payouts || current.lottery_payouts,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const status = math.isBalanced ? "balanced" : form.status === "balanced" ? "needs_review" : form.status;
      await saveEntry("cash_reconciliations", {
        ...form,
        status,
        cash_over_short: math.variance,
        notes: form.notes || null,
      }, selectedId);
      setSelectedId(undefined);
      setForm(emptyForm);
      setMessage("Cash reconciliation saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save reconciliation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setMessage(null);
    setError(null);

    try {
      await deleteEntry("cash_reconciliations", id);
      if (selectedId === id) {
        setSelectedId(undefined);
        setForm(emptyForm);
      }
      setMessage("Cash reconciliation deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete reconciliation.");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cash reconciliation"
        title="End-of-day cash reconciliation"
        description="Compare drawer cash, POS tenders, processor batches, drops, paid-outs, lottery payouts, and bank deposits."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <form className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card" onSubmit={handleSubmit}>
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-6">
            <h3 className="text-xl font-black text-slate-950">{selectedId ? "Edit reconciliation" : "New reconciliation"}</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Pull expected totals from daily sales or POS imports, then enter actual drawer and batch numbers.</p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Date</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                required
                type="date"
                value={form.date}
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Status</span>
              <select
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CashForm["status"] }))}
                value={form.status}
              >
                <option value="draft">Draft</option>
                <option value="balanced">Balanced</option>
                <option value="needs_review">Needs review</option>
              </select>
            </label>

            {moneyFields.map((field) => (
              <label className="block" key={field.key}>
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{field.label}</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  min="0"
                  onChange={(event) => updateMoneyField(field.key, event.target.value)}
                  step="0.01"
                  type="number"
                  value={String(form[field.key] ?? 0)}
                />
              </label>
            ))}

            <label className="block sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Notes</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                value={form.notes ?? ""}
              />
            </label>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
            {message ? <p className="mb-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
            {error ? <p className="mb-4 text-sm font-semibold text-red-600">{error}</p> : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700"
                onClick={pullExpectedTotals}
                type="button"
              >
                <Calculator className="h-4 w-4" />
                Pull expected totals
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save reconciliation"}
              </button>
            </div>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
            <h3 className="text-xl font-black text-slate-950">Live variance</h3>
            <div className="mt-5 grid gap-3">
              {[
                ["Expected ending cash", math.expectedEndingCash],
                ["Cash over/short", math.variance],
                ["Card batch mismatch", math.cardVariance],
              ].map(([label, value]) => (
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3" key={label}>
                  <span className="text-sm font-bold text-slate-600">{label}</span>
                  <span className={`text-sm font-black ${Number(value) < 0 ? "text-rose-700" : "text-slate-950"}`}>
                    {currency(Number(value))}
                  </span>
                </div>
              ))}
              <div className={`rounded-2xl px-4 py-3 text-sm font-black ${math.isBalanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {math.isBalanced ? "Balanced" : "Needs review"}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card">
            <div className="border-b border-slate-100 px-5 py-5">
              <h3 className="text-xl font-black text-slate-950">Saved reconciliations</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {data.cash_reconciliations.map((entry) => (
                <div className="p-5" key={entry.id}>
                  <div className="flex items-start justify-between gap-3">
                    <button className="text-left" onClick={() => setSelectedId(entry.id)} type="button">
                      <span className="block text-sm font-black text-slate-950">{entry.date}</span>
                      <span className="mt-1 block text-xs font-semibold capitalize text-slate-500">{entry.status.replace("_", " ")}</span>
                    </button>
                    <button
                      aria-label={`Delete reconciliation ${entry.date}`}
                      className="rounded-xl border border-rose-100 bg-rose-50 p-2 text-rose-700"
                      onClick={() => void handleDelete(entry.id)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-slate-600">Variance</span>
                    <span className="font-black text-slate-950">{currency(entry.variance ?? entry.cash_over_short)}</span>
                  </div>
                </div>
              ))}
              {!data.cash_reconciliations.length ? (
                <p className="p-5 text-sm font-semibold text-slate-500">No cash reconciliations saved yet.</p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
