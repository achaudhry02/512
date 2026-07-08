"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";

export type EntryMode = "daily" | "bulk" | "monthly";

const modes = [
  { mode: "daily", label: "Daily Entry", href: "/daily-sales" },
  { mode: "bulk", label: "Bulk Daily Entry", href: "/bulk-entry?mode=bulk" },
  { mode: "monthly", label: "Monthly Totals Entry", href: "/bulk-entry?mode=monthly" },
] satisfies { mode: EntryMode; label: string; href: string }[];

export function EntryModeToggle({
  active,
  onSelect,
}: {
  active: EntryMode;
  onSelect?: (mode: EntryMode) => void;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>, mode: EntryMode) {
    if (!onSelect || mode === "daily") return;
    event.preventDefault();
    onSelect(mode);
  }

  return (
    <div className="mb-6 grid gap-2 rounded-[1.5rem] border border-white/80 bg-white/85 p-2 shadow-card sm:grid-cols-3">
      {modes.map((item) => (
        <Link
          className={cn(
            "rounded-2xl px-4 py-3 text-center text-sm font-black transition",
            active === item.mode
              ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
          )}
          href={item.href}
          key={item.mode}
          onClick={(event) => handleClick(event, item.mode)}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
