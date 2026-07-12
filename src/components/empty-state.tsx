import { Inbox, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  action,
  description,
  href,
  icon: Icon = Inbox,
  onAction,
  title,
  secondary,
}: {
  action?: string;
  description: string;
  href?: string;
  icon?: LucideIcon;
  onAction?: () => void;
  title: string;
  secondary?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center border border-dashed border-slate-300 bg-slate-50/70 px-5 py-9 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-cyan-700 shadow-sm ring-1 ring-slate-200"><Icon className="h-5 w-5" /></span>
      <h4 className="mt-4 text-base font-black text-slate-950">{title}</h4>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action && href ? <Link className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white" href={href}>{action}</Link> : null}
      {action && onAction ? <button className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white" onClick={onAction} type="button">{action}</button> : null}
      {secondary ? <div className="mt-3">{secondary}</div> : null}
    </div>
  );
}
