"use client";

import { BadgeCheck, Ban, Link2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { suggestBankMatch, bankMatchingSummary } from "@/lib/bank-matching";
import { currency } from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import { canPerformAction } from "@/lib/permissions";
import type { CashFlowEntry } from "@/lib/types";

function payload(row: CashFlowEntry, patch: Partial<CashFlowEntry>) {
  const values = { ...row, ...patch };
  return {
    import_id: values.import_id,
    import_row_id: values.import_row_id,
    date: values.date,
    flow_type: values.flow_type,
    amount: values.amount,
    vendor_name: values.vendor_name,
    description: values.description,
    matched_record_type: values.matched_record_type,
    matched_record_id: values.matched_record_id,
    match_confidence: values.match_confidence,
    match_status: values.match_status,
    reviewed_at: values.reviewed_at,
    reviewed_by: values.reviewed_by,
    notes: values.notes,
  };
}

export default function BankMatchingPage() {
  const { data, role, saveEntry, user } = useCommandCenter();
  const [filter, setFilter] = useState<CashFlowEntry["match_status"] | "all">("all");
  const [message, setMessage] = useState<string | null>(null);
  const editable = canPerformAction(role, "edit_financials");
  const rows = data.cash_flow_entries.filter((row) => filter === "all" || (row.match_status ?? "unmatched") === filter);
  const summary = bankMatchingSummary(data.cash_flow_entries);
  const suggestions = useMemo(() => new Map(data.cash_flow_entries.map((row) => [row.id, suggestBankMatch(row, data)])), [data]);
  const manualOptions = [
    ...data.cash_reconciliations.map((row) => ({ value: `cash_reconciliation:${row.id}`, label: `${row.date} cash reconciliation ${currency(row.bank_deposit_amount)}` })),
    ...data.expenses.map((row) => ({ value: `expense:${row.id}`, label: `${row.date} expense · ${row.vendor_name} · ${currency(row.amount)}` })),
    ...data.import_rows.filter((row) => row.import_destination === "expenses").map((row) => ({ value: `import_row:${row.id}`, label: `${row.date ?? "No date"} imported expense | ${row.vendor ?? "Unknown vendor"} | ${currency(row.total)}` })),
    ...data.pos_import_rows.filter((row) => row.date && row.card_total).map((row) => ({ value: `pos_import_row:${row.id}`, label: `${row.date} POS card row | ${row.pos_name} | ${currency(row.card_total)}` })),
    ...data.payroll_entries.map((row) => ({ value: `payroll_entry:${row.id}`, label: `${row.date_range_end} payroll · ${row.employee_name} · ${currency(row.hours_worked * row.hourly_rate)}` })),
  ];

  async function update(row: CashFlowEntry, patch: Partial<CashFlowEntry>, success: string) {
    setMessage(null);
    try { await saveEntry("cash_flow_entries", payload(row, { ...patch, reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null }), row.id); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update bank match."); }
  }

  return <div><PageHeader eyebrow="Cash controls" title="Bank Matching" description="Link deposits and withdrawals to reconciliations, processor batches, expenses, payroll, and non-operating cash movement." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{(["unmatched", "suggested", "matched", "ignored"] as const).map((status) => <button className={`rounded-lg border p-4 text-left shadow-card ${filter === status ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white"}`} key={status} onClick={() => setFilter(status)} type="button"><p className="text-xs font-black uppercase text-slate-500">{status}</p><p className="mt-2 text-2xl font-black text-slate-950">{summary[status]}</p></button>)}<button className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-left text-white shadow-card" onClick={() => setFilter("all")} type="button"><p className="text-xs font-black uppercase text-slate-300">All transactions</p><p className="mt-2 text-2xl font-black">{summary.total}</p></button></div>
    {message ? <p className="mt-5 rounded-lg bg-cyan-50 p-4 text-sm font-bold text-cyan-900">{message}</p> : null}
    <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"><div className="overflow-x-auto"><table className="min-w-[1120px] divide-y divide-slate-200 text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-300"><tr>{["Date","Description","Type","Amount","Status","Suggested / manual match","Actions"].map((header) => <th className="px-4 py-4" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => { const suggestion = suggestions.get(row.id); return <tr key={row.id}><td className="px-4 py-4 font-bold">{row.date}</td><td className="max-w-xs px-4 py-4"><p className="font-bold text-slate-900">{row.vendor_name || row.description || "Bank transaction"}</p><p className="mt-1 text-xs text-slate-500">{row.description}</p></td><td className="px-4 py-4 capitalize">{row.flow_type.replaceAll("_", " ")}</td><td className="px-4 py-4 font-black">{currency(row.amount)}</td><td className="px-4 py-4 capitalize">{row.match_status}</td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{suggestion?.reason ?? (row.matched_record_type ? `Matched to ${row.matched_record_type}` : "No automatic match")}</p>{suggestion ? <p className="mt-1 text-xs font-black text-cyan-700">{suggestion.confidence}% confidence</p> : null}<select aria-label={`Manual match for ${row.id}`} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" disabled={!editable} onChange={(event) => { const [type, id] = event.target.value.split(":"); if (type && id) void update(row, { matched_record_type: type, matched_record_id: id, match_confidence: 100, match_status: "matched" }, "Manual match approved."); }} value=""><option value="">Manual match…</option>{manualOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{suggestion ? <button aria-label="Approve suggested match" className="rounded-lg bg-emerald-600 p-2 text-white disabled:opacity-40" disabled={!editable} onClick={() => void update(row, { matched_record_type: suggestion.matchedRecordType, matched_record_id: suggestion.matchedRecordId, match_confidence: suggestion.confidence, match_status: "matched" }, "Suggested match approved.")} title="Approve match" type="button"><BadgeCheck className="h-4 w-4" /></button> : null}<button aria-label="Reject match" className="rounded-lg border border-slate-200 p-2 text-slate-700 disabled:opacity-40" disabled={!editable} onClick={() => void update(row, { matched_record_type: null, matched_record_id: null, match_confidence: 0, match_status: "unmatched" }, "Match rejected.")} title="Reject match" type="button"><RefreshCw className="h-4 w-4" /></button><button aria-label="Ignore transaction" className="rounded-lg border border-slate-200 p-2 text-slate-700 disabled:opacity-40" disabled={!editable} onClick={() => void update(row, { match_status: "ignored" }, "Transaction ignored.")} title="Ignore" type="button"><Ban className="h-4 w-4" /></button></div><div className="mt-2 flex gap-1">{(["loan_payment","owner_draw","transfer"] as const).map((type) => <button className="rounded border border-slate-200 px-2 py-1 text-[10px] font-bold capitalize disabled:opacity-40" disabled={!editable} key={type} onClick={() => void update(row, { flow_type: type, matched_record_type: type, matched_record_id: null, match_confidence: 100, match_status: "matched" }, `Marked ${type.replaceAll("_", " ")}.`)} type="button"><Link2 className="mr-1 inline h-3 w-3" />{type.replaceAll("_", " ")}</button>)}</div></td></tr>; })}{!rows.length ? <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={7}>No bank transactions in this view.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
