import type { ReactNode } from "react";

export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-card backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-3 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-700 ring-1 ring-cyan-100">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="max-w-4xl text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
          {title}
        </h2>
        <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
