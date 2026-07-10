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
  PackageSearch,
  ShoppingBasket,
  Sparkles,
  Target,
  Ticket,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  reconciliationTotals,
  unreconciledDailySaleDates,
} from "@/lib/cash-reconciliation";
import { fuelReconciliationTotals } from "@/lib/fuel-reconciliation";
import {
  aggregateData,
  analyzeProfitLeaks,
  bestWorstCategoriesFromData,
  currency,
  dailyChart,
  expensesByCategory,
  monthEndIso,
  monthStartIso,
  numberFormatter,
  todayIso,
} from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";
import {
  monthlyFuelProfit,
  monthlyInsideSales,
  monthlyPeriodKey,
  monthlyTotalExpenses,
} from "@/lib/monthly-totals";
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
  const { data, loading, store } = useCommandCenter();
  const [view, setView] = useState<"daily" | "monthly">("daily");
  const today = todayIso();
  const todaySummary = aggregateData(data, today, today);
  const monthSummary = aggregateData(data, monthStartIso(), monthEndIso());
  const activeSummary = view === "monthly" ? monthSummary : todaySummary;
  const categorySummary = bestWorstCategoriesFromData(data);
  const expenses = Object.entries(monthSummary.expenseBreakdown ?? expensesByCategory(monthSummary.expenses)).map(([name, value]) => ({
    name,
    value,
  }));
  const monthlyTrend = data.monthly_totals
    .slice()
    .sort((a, b) => monthlyPeriodKey(a).localeCompare(monthlyPeriodKey(b)))
    .slice(-12)
    .map((entry) => ({
      date: monthlyPeriodKey(entry),
      inside: monthlyInsideSales(entry),
      fuelProfit: monthlyFuelProfit(entry),
      lotteryProfit: entry.lottery_sales * 0.06,
      deli: entry.deli_sales + entry.hot_food_sales,
      expenses: monthlyTotalExpenses(entry),
    }));
  const trend = view === "monthly" && monthlyTrend.length ? monthlyTrend : dailyChart(data);
  const profitLeaks = analyzeProfitLeaks(data).slice(0, 6);
  const todaySale = data.daily_sales.find((sale) => sale.date === today);
  const unreconciledDates = unreconciledDailySaleDates(data.daily_sales, data.cash_reconciliations);
  const cashReconciliationTotals = reconciliationTotals(data.cash_reconciliations);
  const fuelTotals = fuelReconciliationTotals(data.fuel_reconciliations);
  const lowStock = data.products.filter((product) => product.quantity_on_hand <= product.reorder_level);
  const bestSellingItems = Object.values(data.product_sales.reduce<Record<string, { name: string; quantity: number; sales: number }>>((items, sale) => {
    const current = items[sale.product_name] ?? { name: sale.product_name, quantity: 0, sales: 0 };
    current.quantity += sale.quantity_sold;
    current.sales += sale.gross_sales;
    items[sale.product_name] = current;
    return items;
  }, {})).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Live dashboard"
        title={`${store?.name ?? "Store"} dashboard`}
        description="Track today's sales, profit estimates, fuel, lottery, deli, expenses, payroll, and category performance from one command center."
      />

      <div className="mb-6 grid gap-2 rounded-[1.5rem] border border-white/80 bg-white/85 p-2 shadow-card sm:w-fit sm:grid-cols-2">
        {[
          ["daily", "Daily View"],
          ["monthly", "Monthly Totals View"],
        ].map(([key, label]) => (
          <button
            className={`rounded-2xl px-5 py-3 text-sm font-black transition ${view === key ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
            key={key}
            onClick={() => setView(key as "daily" | "monthly")}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

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
                <span className="text-sm font-semibold text-slate-300">{view === "monthly" ? "Monthly net profit estimate" : "Net profit estimate"}</span>
                <ArrowUpRight className="h-4 w-4 text-emerald-300" />
              </div>
              <p className="text-4xl font-black tracking-tight">{currency(activeSummary.netProfit)}</p>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
                  style={{ width: `${Math.max(12, Math.min(100, Math.abs(activeSummary.profitMargin)))}%` }}
                />
              </div>
              <p className="text-xs font-semibold text-slate-400">
                {activeSummary.profitMargin.toFixed(1)}% estimated profit margin
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
              <p className="text-sm font-black text-slate-950">{view === "monthly" ? "Monthly focus" : "Today's focus"}</p>
              <p className="text-xs font-semibold text-slate-500">{view === "monthly" ? `${monthStartIso()} to ${monthEndIso()}` : today}</p>
            </div>
          </div>
          {[
            ["Inside sales", activeSummary.insideSales],
            ["Fuel profit", activeSummary.fuelProfit],
            ["Total expenses", activeSummary.totalExpenses],
            ["Payroll cost", activeSummary.payrollCost],
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
          helper={view === "monthly" ? "Inside sales from monthly totals or summed daily data" : "Inside sales recorded for today"}
          icon={WalletCards}
          label={view === "monthly" ? "Monthly inside sales" : "Total sales today"}
          trend={view === "monthly" ? monthSummary.source === "monthly_totals" ? "Monthly totals" : monthSummary.source === "daily_and_pos" ? "Daily + POS" : "Daily sum" : "Live"}
          value={activeSummary.insideSales}
        />
        <StatCard
          accent="emerald"
          helper={view === "monthly" ? "Fuel, lottery, food, and estimated inside margin this month" : "Fuel, lottery, deli, and estimated inside margin today"}
          icon={TrendingUp}
          label="Gross profit"
          trend={view === "monthly" ? "Month" : "Today"}
          value={activeSummary.grossProfit}
        />
        <StatCard
          accent={monthSummary.netProfit >= 0 ? "emerald" : "rose"}
          helper="After expenses and payroll"
          icon={CircleDollarSign}
          label="Net profit estimate"
          trend={`${activeSummary.profitMargin.toFixed(1)}%`}
          value={activeSummary.netProfit}
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
        <StatCard
          accent={unreconciledDates.length ? "amber" : "emerald"}
          helper="Daily sales dates without a saved reconciliation"
          icon={WalletCards}
          label="Unreconciled days"
          trend="Cash"
          value={unreconciledDates.length}
        />
        <StatCard
          accent={Math.abs(cashReconciliationTotals.cashOverShort) > 5 ? "rose" : "emerald"}
          helper={`Card batch mismatch ${currency(cashReconciliationTotals.cardMismatch)}`}
          icon={Gauge}
          label="Cash over/short"
          trend="Variance"
          value={cashReconciliationTotals.cashOverShort}
        />
        <StatCard
          accent={fuelTotals.alertCount ? "rose" : "emerald"}
          helper={`${numberFormatter.format(fuelTotals.totalVariance)} total gallons variance`}
          icon={Fuel}
          label="Fuel variance alerts"
          trend="Tanks"
          value={fuelTotals.alertCount}
        />
        <StatCard
          accent={fuelTotals.lowMarginCount ? "amber" : "emerald"}
          helper="Grades below target margin"
          icon={Target}
          label="Low fuel margins"
          trend="Pricing"
          value={fuelTotals.lowMarginCount}
        />
      </div>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div><h3 className="text-xl font-black text-slate-950">Today&apos;s departments</h3><p className="text-sm text-slate-500">Sales and volume from the latest closeout.</p></div>
            <ShoppingBasket className="h-5 w-5 text-cyan-700" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Grocery sales", currency(todaySale?.grocery_sales ?? 0)],
              ["Deli / hot food", currency((todaySale?.deli_sales ?? 0) + (todaySale?.hot_food_sales ?? 0))],
              ["Fuel gallons", `${(todaySale?.fuel_gallons_sold ?? 0).toLocaleString()} gal`],
              ["Lottery sales", currency(todaySale?.lottery_sales ?? 0)],
              ["Beer / cigarettes", currency((todaySale?.beer_sales ?? 0) + (todaySale?.cigarette_sales ?? 0))],
              ["Cash / card", `${currency(todaySale?.cash_total ?? 0)} / ${currency(todaySale?.card_total ?? 0)}`],
            ].map(([label, value]) => <div className="border-b border-slate-100 py-3" key={label}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>)}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between"><h3 className="font-black text-slate-950">Low-stock alerts</h3><PackageSearch className="h-5 w-5 text-red-600" /></div>
            <div className="space-y-3">
              {lowStock.length ? lowStock.slice(0, 5).map((product) => <div className="flex items-center justify-between gap-3" key={product.id}><div><p className="text-sm font-bold text-slate-800">{product.name}</p><p className="text-xs text-slate-500">Reorder at {product.reorder_level}</p></div><span className="rounded-full bg-red-100 px-2 py-1 text-xs font-black text-red-700">{product.quantity_on_hand} left</span></div>) : <p className="text-sm text-slate-500">No low-stock products.</p>}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="mb-4 font-black text-slate-950">Best-selling items</h3>
            <div className="space-y-3">
              {bestSellingItems.length ? bestSellingItems.map((item, index) => <div className="flex items-center justify-between gap-3" key={item.name}><div className="flex items-center gap-3"><span className="text-xs font-black text-slate-400">{index + 1}</span><p className="text-sm font-bold text-slate-800">{item.name}</p></div><div className="text-right"><p className="text-sm font-black text-slate-950">{item.quantity}</p><p className="text-xs text-slate-500">{currency(item.sales)}</p></div></div>) : <p className="text-sm text-slate-500">Import product sales to rank items.</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-card">
          <div className="mb-5 flex flex-col gap-1">
            <h3 className="text-xl font-black text-slate-950">Sales and profit trend</h3>
            <p className="text-sm font-medium text-slate-500">Recent daily inside sales, fuel profit, deli, and expenses.</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
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
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
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
