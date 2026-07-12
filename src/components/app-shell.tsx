"use client";

import {
  BarChart3,
  Beef,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Command,
  Fuel,
  LayoutDashboard,
  Landmark,
  ListChecks,
  LogOut,
  Menu,
  PackageSearch,
  PlugZap,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  Truck,
  UserRoundCog,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useCommandCenter } from "@/lib/data-provider";
import { ContextHelp } from "@/components/context-help";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { canViewPage } from "@/lib/permissions";
import { devInfo } from "@/lib/dev-log";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Setup Guide", icon: ListChecks },
  { href: "/daily-sales", label: "Daily Sales", icon: ClipboardList },
  { href: "/bulk-entry", label: "Bulk Entry", icon: CalendarDays },
  { href: "/inventory", label: "Inventory", icon: PackageSearch },
  { href: "/vendors", label: "Vendors", icon: Truck },
  { href: "/expenses", label: "Expenses", icon: ReceiptText },
  { href: "/cash-reconciliation", label: "Cash Reconciliation", icon: WalletCards },
  { href: "/end-of-day-close", label: "End-of-Day Close", icon: ListChecks },
  { href: "/bank-matching", label: "Bank Matching", icon: Landmark },
  { href: "/smart-import", label: "Smart Import", icon: ScanLine },
  { href: "/pos-integrations", label: "POS Integrations", icon: PlugZap },
  { href: "/fuel", label: "Fuel Tracking", icon: Fuel },
  { href: "/fuel-reconciliation", label: "Fuel Reconciliation", icon: Fuel },
  { href: "/lottery", label: "Lottery", icon: Ticket },
  { href: "/deli", label: "Deli / Hot Food", icon: Beef },
  { href: "/payroll", label: "Payroll", icon: Users },
  { href: "/employees", label: "Employees", icon: UserRoundCog },
  { href: "/reports", label: "Reports / P&L", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { error, loading, profile, role, selectStore, store, stores, user } = useCommandCenter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      devInfo("[auth] protected route redirect to /login", {
        pathname,
        loading,
        hasUser: Boolean(user),
      });
      router.replace("/login");
    }
  }, [loading, pathname, router, user]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/login");
  }

  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-medium text-slate-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      <button
        className="fixed left-4 top-4 z-40 rounded-2xl bg-slate-950 p-3 text-white shadow-xl shadow-slate-950/30 ring-1 ring-white/10 lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-80 max-w-[88vw] flex-col overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_22rem),linear-gradient(180deg,#07111f_0%,#0f172a_48%,#020617_100%)] p-4 text-white shadow-2xl shadow-slate-950/45 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
        <div className="relative mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20 ring-1 ring-cyan-200/60">
                <Command className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">
                  Command Center
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-400">Owner OS</p>
              </div>
            </div>
            <h1 className="mt-5 text-xl font-black leading-tight tracking-tight">
              Convenience Store Command Center
            </h1>
            <p className="mt-2 truncate text-sm text-slate-400">
              {store?.name ?? "Store dashboard"} | Profit operations
            </p>
          </div>
          <button
            className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setOpen(false)}
            type="button"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mb-4 rounded-3xl border border-white/10 bg-white/[0.06] p-3 shadow-inner shadow-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <label className="sr-only" htmlFor="store-switcher">Active store</label>
              <select
                className="w-full appearance-none truncate rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 pr-8 text-sm font-bold text-white outline-none transition focus:border-cyan-300"
                id="store-switcher"
                onChange={(event) => void selectStore(event.target.value)}
                value={store?.id ?? ""}
              >
                {stores.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                {role ? `${role} access` : "Live Supabase workspace"}
              </p>
            </div>
            <ChevronDown className="pointer-events-none -ml-8 h-4 w-4 text-slate-500" />
          </div>
        </div>

        <nav className="relative flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.filter((item) => canViewPage(role, item.href)).map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition duration-200",
                  active
                    ? "bg-white text-slate-950 shadow-lg shadow-cyan-950/20"
                    : "text-slate-400 hover:bg-white/[0.08] hover:text-white",
                )}
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition",
                    active ? "bg-cyan-400 text-slate-950" : "bg-white/[0.06] text-slate-400 group-hover:text-cyan-200",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative mt-4 rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-inner shadow-white/5">
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/15">
            <ShieldCheck className="h-4 w-4" />
            Secure owner workspace
          </div>
          <p className="truncate text-sm font-bold">{profile?.full_name || profile?.email || "Demo owner"}</p>
          <p className="mt-1 truncate text-xs text-slate-400">
            {profile?.email}
          </p>
          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {open ? (
        <button
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setOpen(false)}
          type="button"
          aria-label="Close navigation overlay"
        />
      ) : null}

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 border-b border-white/70 bg-white/80 px-4 py-3 shadow-sm shadow-slate-200/60 backdrop-blur-xl sm:px-6 lg:hidden">
          <div className="ml-14 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">{store?.name ?? "Store dashboard"}</p>
              <p className="text-xs font-semibold text-slate-500">Premium operations dashboard</p>
            </div>
            <ContextHelp pathname={pathname} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1520px] px-3 py-5 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
          <div className="mb-6 hidden items-center justify-between rounded-[1.75rem] border border-white/80 bg-white/80 px-5 py-4 shadow-card backdrop-blur-xl lg:flex">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300 shadow-lg shadow-slate-950/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">Premium store operations suite</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Sales, margin, payroll, and P&L intelligence in one workspace.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                Live data
              </span>
              <ContextHelp pathname={pathname} />
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-3xl border border-red-200 bg-red-50/90 p-4 text-sm font-semibold text-red-700 shadow-sm">
              {error}
            </div>
          ) : null}
          {canViewPage(role, pathname) ? children : (
            <section className="rounded-lg border border-rose-200 bg-white p-8 shadow-card">
              <p className="text-xs font-black uppercase text-rose-700">Access restricted</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">This page is not available to the {role} role.</h2>
              <p className="mt-3 text-sm font-medium text-slate-600">Choose an authorized page or ask a store owner to update your membership.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
