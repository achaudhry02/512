"use client";

import { Check, ChevronRight, Circle, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ownerWorkflows, type WorkflowMode } from "@/lib/onboarding";
import { todayIso } from "@/lib/calculations";

function workflowPeriod(mode: WorkflowMode) {
  const today = new Date(`${todayIso()}T00:00:00Z`);
  if (mode === "weekly") {
    today.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
    return today.toISOString().slice(0, 10);
  }
  if (mode === "month_end") return today.toISOString().slice(0, 7);
  return today.toISOString().slice(0, 10);
}

export function OwnerWorkflow({ storeId }: { storeId: string | null }) {
  const [mode, setMode] = useState<WorkflowMode>("morning");
  const [completed, setCompleted] = useState<string[]>([]);
  const workflow = ownerWorkflows[mode];
  const storageKey = `store-command-center-workflow:${storeId ?? "store"}:${mode}:${workflowPeriod(mode)}`;

  useEffect(() => {
    try {
      setCompleted(JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[]);
    } catch {
      setCompleted([]);
    }
  }, [storageKey]);

  function toggleTask(taskId: string) {
    setCompleted((current) => {
      const next = current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId];
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-slate-950">Owner workflow</h3><p className="mt-1 text-sm text-slate-500">Operational checks for the current store and period.</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><ClipboardCheck className="h-5 w-5" /></span></div>
        <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
          {(Object.keys(ownerWorkflows) as WorkflowMode[]).map((key) => <button className={`min-h-10 min-w-max flex-1 rounded-md px-3 text-xs font-black transition ${mode === key ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`} key={key} onClick={() => setMode(key)} type="button">{ownerWorkflows[key].label}</button>)}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {workflow.tasks.map((task) => {
          const checked = completed.includes(task.id);
          return <div className="flex items-center gap-3 px-4 py-3" key={task.id}><button aria-label={`${checked ? "Mark incomplete" : "Mark complete"}: ${task.label}`} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-400"}`} onClick={() => toggleTask(task.id)} type="button">{checked ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</button><span className={`min-w-0 flex-1 text-sm font-bold ${checked ? "text-slate-400 line-through" : "text-slate-800"}`}>{task.label}</span><Link aria-label={`Open ${task.label}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950" href={task.href}><ChevronRight className="h-4 w-4" /></Link></div>;
        })}
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-500">{completed.length} of {workflow.tasks.length} complete</div>
    </section>
  );
}
