"use client";

import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { onboardingProgress } from "@/lib/onboarding";
import type { CommandCenterData, Store } from "@/lib/types";

export function OnboardingBanner({ data, store }: { data: CommandCenterData; store: Store | null }) {
  const progress = onboardingProgress(data, store);
  if (progress.complete) return null;
  const nextSteps = progress.steps.filter((step) => !step.complete).slice(0, 3);

  return (
    <section className="mb-6 border-l-4 border-cyan-600 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-cyan-700" /><h3 className="text-lg font-black text-slate-950">Finish store setup</h3><span className="text-sm font-black text-slate-500">{progress.completed}/{progress.total}</span></div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{nextSteps.map((step) => <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600" key={step.key}><Circle className="h-3.5 w-3.5 text-slate-400" />{step.title}</span>)}</div>
        </div>
        <Link className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white" href="/onboarding">Continue setup <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-cyan-600" style={{ width: `${progress.percent}%` }} /></div>
    </section>
  );
}
