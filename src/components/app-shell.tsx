"use client";

import {
  BarChart3,
  Beef,
  ClipboardList,
  DollarSign,
  Fuel,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  Ticket,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useCommandCenter } from "@/lib/data-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/daily-sales", label: "Daily Sales", icon: ClipboardList },
  { href: "/expenses", label: "Expenses", icon: ReceiptText },
  { href: "/fuel", label: "Fuel Tracking", icon: Fuel },
  { href: "/lottery", label: "Lottery", icon: Ticket },
  { href: "/deli", label: "Deli / Hot Food", icon: Beef },
  { href: "/payroll", label: "Payroll", icon: Users },
  { href: "/reports", label: "Reports / P&L", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { demoMode, error, loading, profile, store, user } = useCommandCenter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !demoMode && !user) {
      router.replace("/login");
    }
  }, [demoMode, loading, router, user]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/login");
  }

  if (!loading && !demoMode && !user) {
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
        className="fixed left-4 top-4 z-40 rounded-2xl bg-slate-950 p-3 text-white shadow-lg lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-76 max-w-[86vw] flex-col border-r border-slate-200 bg-slate-950 p-4 text-white shadow-2xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
              <DollarSign className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-bold leading-tight">
              Convenience Store Command Center
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {store?.name ?? "Store dashboard"}
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

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                )}
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-3xl bg-white/10 p-4">
          <p className="text-sm font-semibold">{profile?.full_name || profile?.email || "Demo owner"}</p>
          <p className="mt-1 text-xs text-slate-400">
            {demoMode ? "Demo mode - connect Supabase to persist data" : profile?.email}
          </p>
          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut className="h-4 w-4" />
            {demoMode ? "Back to login" : "Sign out"}
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

      <main className="min-w-0 flex-1 px-4 py-20 sm:px-6 lg:px-8 lg:py-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
