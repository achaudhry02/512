import type { LucideIcon } from "lucide-react";
import { currency } from "@/lib/calculations";
import { cn } from "@/lib/utils";

export function StatCard({
  accent = "cyan",
  helper,
  icon: Icon,
  label,
  value,
}: {
  accent?: "cyan" | "emerald" | "amber" | "rose" | "slate";
  helper?: string;
  icon?: LucideIcon;
  label: string;
  value: number;
}) {
  const accents = {
    cyan: "bg-cyan-50 text-cyan-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {currency(value)}
          </p>
        </div>
        {Icon ? (
          <div className={cn("rounded-2xl p-3", accents[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
      {helper ? <p className="mt-4 text-xs font-medium text-slate-500">{helper}</p> : null}
    </div>
  );
}
