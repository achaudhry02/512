import type { LucideIcon } from "lucide-react";
import { currency } from "@/lib/calculations";
import { cn } from "@/lib/utils";

export function StatCard({
  accent = "cyan",
  helper,
  icon: Icon,
  label,
  trend,
  value,
}: {
  accent?: "cyan" | "emerald" | "amber" | "rose" | "slate";
  helper?: string;
  icon?: LucideIcon;
  label: string;
  trend?: string;
  value: number;
}) {
  const accents = {
    cyan: {
      icon: "bg-cyan-50 text-cyan-700 ring-cyan-100",
      line: "from-cyan-400 to-blue-500",
      glow: "group-hover:shadow-cyan-500/15",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      line: "from-emerald-400 to-teal-500",
      glow: "group-hover:shadow-emerald-500/15",
    },
    amber: {
      icon: "bg-amber-50 text-amber-700 ring-amber-100",
      line: "from-amber-400 to-orange-500",
      glow: "group-hover:shadow-amber-500/15",
    },
    rose: {
      icon: "bg-rose-50 text-rose-700 ring-rose-100",
      line: "from-rose-400 to-red-500",
      glow: "group-hover:shadow-rose-500/15",
    },
    slate: {
      icon: "bg-slate-100 text-slate-700 ring-slate-200",
      line: "from-slate-400 to-slate-700",
      glow: "group-hover:shadow-slate-500/15",
    },
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-premium",
        accents[accent].glow,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accents[accent].line)} />
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-slate-100/70 blur-2xl transition group-hover:bg-cyan-100/70" />
      <div className="flex items-start justify-between gap-4">
        <div className="relative min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {currency(value)}
          </p>
        </div>
        {Icon ? (
          <div className={cn("relative rounded-2xl p-3 ring-1", accents[accent].icon)}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
      <div className="relative mt-4 flex items-center justify-between gap-3">
        {helper ? <p className="text-xs font-semibold leading-5 text-slate-500">{helper}</p> : <span />}
        {trend ? (
          <span className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black text-white">
            {trend}
          </span>
        ) : null}
      </div>
    </div>
  );
}
