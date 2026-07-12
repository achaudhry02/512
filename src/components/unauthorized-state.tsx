import Link from "next/link";
import type { UserRole } from "@/lib/types";

export function UnauthorizedState({ role }: { role: UserRole }) {
  return (
    <section className="rounded-lg border border-rose-200 bg-white p-8 shadow-card">
      <p className="text-xs font-black uppercase text-rose-700">Access restricted</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">This page is not available to the {role} role.</h2>
      <p className="mt-3 text-sm font-medium text-slate-600">
        Return to the dashboard or ask a store owner to update your membership.
      </p>
      <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white" href="/dashboard">
        Return to dashboard
      </Link>
    </section>
  );
}
