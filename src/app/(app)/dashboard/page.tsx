"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  AlertTriangle,
  Beef,
  CalendarDays,
  CircleDollarSign,
  Gauge,
  Fuel,
  ReceiptText,
  Sparkles,
  Target,
  Ticket,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  aggregateData,
  analyzeProfitLeaks,
  bestWorstCategories,
  currency,
  dailyChart,
  expensesByCategory,
  todayIso,
} from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import type { ProfitLeakFinding } from "@/lib/types";

const chartColors = ["#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#6366f1", "#64748b"];

const leakSeverityStyles = {
  critical: {
    card: "border-rose-200 bg-rose-50/80",
    icon: "bg-rose-100 text-rose-700 ring-rose-200",
    badge: "bg-rose-100 text-rose-700 ring-rose-200",
  },
  warning: {
    card: "border-amber-200 bg-amber-50/80",
    icon: "bg-amber-100 text-amber-700 ring-amber-200",
    badge: "bg-amber-100 text-amber-700 ring-amber-200",
  },
  watch: {
    card: "border-emerald-200 bg-emerald-50/80",
    icon: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    badge: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
} satisfies Record<ProfitLeakFinding["severity"], { card: string; icon: string; badge: string }>;

const leakTypeLabels = {
  high_expense_category: "Expense spike",
  low_fuel_margin: "Fuel margin",
  deli_waste: "Deli waste",
  payroll_ratio: "Payroll drag",
  vendor_increase: "Vendor spend",
  low_profit_margin: "Low margin",
} satisfies Record<ProfitLeakFinding["type"], string>;

export default function DashboardPage() {
  const { data, demoMode, loading, store } = useCommandCenter();
  const today = todayIso();
  const todaySummary = aggregateData(data, today, today);
  const monthSummary = aggregateData(data);
  const categorySummary = bestWorstCategories(data.daily_sales);
  const expenses = Object.entries(expensesByCategory(monthSummary.expenses)).map(([name, value]) => ({
    name,
    value,
  }));
  const trend = dailyChart(data);
  const profitLeaks = analyzeProfitLeaks(data).slice(0, 6);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        eyebrow={demoMode ? "Demo dashboard" : "Live dashboard"}
        title={`${store?.name ?? "Store"} dashboard`}
        description="Track today's sales, profit estimates, fuel, lottery, deli, expenses, payroll, and category performance from one command center."
      />

      <section className="mb-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-premium">
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-20 -translate-y-24 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 ring-1 ring-white/10">
                <Sparkles className="h-3.5 w-3.5" />
                Executive command snapshot
              </div>
              <h3 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                Know what made money today before the day gets away from you.
              </h3>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-300 sm:text-base">
                Daily sales, margin signals, payroll drag, and expense pressure are combined into one clean operating view for store owners.
              </p>
            </div>
            <div className="grid min-w-72 gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Net profit estimate</span>
                <ArrowUpRight className="h-4 w-4 text-emerald-300" />
              </div>
              <p className="text-4xl font-black tracking-tight">{currency(monthSummary.netProfit)}</p>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
                  style={{ width: `${Math.max(12, Math.min(100, Math.abs(monthSummary.profitMargin)))}%` }}
                />
              </div>
              <p className="text-xs font-semibold text-slate-400">
                {monthSummary.profitMargin.toFixed(1)}% estimated profit margin
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700 ring-1 ring-cyan-100">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">Today&apos;s focus</p>
              <p className="text-xs font-semibold text-slate-500">{today}</p>
            </div>
          </div>
          {[
            ["Inside sales", todaySummary.insideSales],
            ["Fuel profit", todaySummary.fuelProfit],
            ["Total expenses", todaySummary.totalExpenses],
            ["Payroll cost", todaySummary.payrollCost],
          ].map(([label, value]) => (
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3" key={label}>
              <span className="text-sm font-bold text-slate-600">{label}</span>
              <span className="text-sm font-black text-slate-950">{currency(Number(value))}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-card">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-5 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 ring-1 ring-cyan-200/15">
                <Zap className="h-3.5 w-3.5" />
                Profit Leak Finder
              </div>
              <h3 className="text-2xl font-black tracking-tight">Plain-English alerts for margin leaks</h3>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-300">
                Automatically scans expenses, fuel margin, deli waste, payroll, vendor spend, and daily profit margin to show where money may be slipping away.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <Gauge className="h-5 w-5 text-cyan-200" />
              <div>
                <p className="text-xs font-semibold text-slate-400">Findings</p>
                <p className="text-lg font-black">{profitLeaks.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:p-6 xl:grid-cols-2">
          {profitLeaks.map((finding) => {
            const styles = leakSeverityStyles[finding.severity];

            return (
              <article className={`rounded-3xl border p-4 ${styles.card}`} key={finding.id}>
                <div className="flex gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${styles.icon}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ring-1 ${styles.badge}`}>
                        {finding.severity}
                      </span>
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200">
                        {leakTypeLabels[finding.type]}
                      </span>
                      <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black text-white">
                        {finding.metric}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-950">{finding.title}</h4>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{finding.description}</p>
                    <div className="mt-3 rounded-2xl bg-white/80 p-3 text-sm leading-6 text-slate-700 ring-1 ring-white">
                      <span className="font-black text-slate-950">Recommendation: </span>
                      {finding.recommendation}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent="cyan"
          helper="Inside sales recorded for today"
          icon={WalletCards}
          label="Total sales today"
          trend="Live"
          value={todaySummary.insideSales}
        />
        <StatCard
          accent="emerald"
          helper="Fuel, lottery, deli, and estimated inside margin"
          icon={TrendingUp}
          label="Gross profit"
          trend="MTD"
          value={monthSummary.grossProfit}
        />
        <StatCard
          accent={monthSummary.netProfit >= 0 ? "emerald" : "rose"}
          helper="After expenses and payroll"
          icon={CircleDollarSign}
          label="Net profit estimate"
          trend={`${monthSummary.profitMargin.toFixed(1)}%`}
          value={monthSummary.netProfit}
        />
        <StatCard
          accent="slate"
          helper="Total entered expenses"
          icon={ReceiptText}
          label="Total expenses"
          trend="Spend"
          value={monthSummary.totalExpenses}
        />
        <StatCard
          accent="cyan"
          helper="Tracked fuel profit, or daily sales fuel margin"
          icon={Fuel}
          label="Fuel profit"
          trend="Margin"
          value={monthSummary.fuelProfit}
        />
        <StatCard
          accent="amber"
          helper="Commission less payouts"
          icon={Ticket}
          label="Lottery profit"
          trend="Net"
          value={monthSummary.lotteryProfit}
        />
        <StatCard
          accent="emerald"
          helper="Deli sales from entries or daily sales"
          icon={Beef}
          label="Deli sales"
          trend="Food"
          value={monthSummary.deliSales}
        />
        <StatCard
          accent="rose"
          helper="Hours multiplied by hourly rates"
          icon={Users}
          label="Payroll cost"
          trend="Labor"
          value={monthSummary.payrollCost}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <div className="mb-5 flex flex-col gap-1">
            <h3 className="text-xl font-black text-slate-950">Sales and profit trend</h3>
            <p className="text-sm font-medium text-slate-500">Recent daily inside sales, fuel profit, deli, and expenses.</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="inside" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 18,
                    boxShadow: "0 20px 45px -28px rgba(15, 23, 42, 0.45)",
                  }}
                  formatter={(value) => currency(Number(value))}
                />
                <Area dataKey="inside" fill="url(#inside)" name="Inside sales" stroke="#06b6d4" strokeWidth={3} />
                <Area dataKey="fuelProfit" fill="#dcfce7" name="Fuel profit" stroke="#10b981" strokeWidth={2} />
                <Area dataKey="deli" fill="#fef3c7" name="Deli sales" stroke="#f59e0b" strokeWidth={2} />
                <Area dataKey="expenses" fill="#ffe4e6" name="Expenses" stroke="#f43f5e" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-950">Category intelligence</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">Best and weakest inside sales categories.</p>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3 text-cyan-300">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-700">Best category</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{categorySummary.best[0]}</p>
              <p className="text-sm text-slate-600">{currency(categorySummary.best[1])}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm font-bold text-rose-700">Worst category</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{categorySummary.worst[0]}</p>
              <p className="text-sm text-slate-600">{currency(categorySummary.worst[1])}</p>
            </div>
          </div>

          <div className="mt-6 h-64">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={categorySummary.ranked.map(([name, value]) => ({ name, value }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 18,
                    boxShadow: "0 20px 45px -28px rgba(15, 23, 42, 0.45)",
                  }}
                  formatter={(value) => currency(Number(value))}
                />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {categorySummary.ranked.map(([name], index) => (
                    <Cell fill={chartColors[index % chartColors.length]} key={name} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-950">Expenses by category</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">See where cash is leaving the business.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
            {expenses.length} categories
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {expenses.length ? (
            expenses.map((expense, index) => (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-card" key={expense.name}>
                <div
                  className="mb-3 h-2 rounded-full"
                  style={{ backgroundColor: chartColors[index % chartColors.length] }}
                />
                <p className="text-sm font-bold text-slate-600">{expense.name}</p>
                <p className="mt-1 text-xl font-black text-slate-950">{currency(expense.value)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No expenses entered yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
