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
  Beef,
  CircleDollarSign,
  Fuel,
  ReceiptText,
  Ticket,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  aggregateData,
  bestWorstCategories,
  currency,
  dailyChart,
  expensesByCategory,
  todayIso,
} from "@/lib/calculations";
import { useCommandCenter } from "@/lib/data-provider";

const chartColors = ["#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#6366f1", "#64748b"];

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent="cyan"
          helper="Inside sales recorded for today"
          icon={WalletCards}
          label="Total sales today"
          value={todaySummary.insideSales}
        />
        <StatCard
          accent="emerald"
          helper="Fuel, lottery, deli, and estimated inside margin"
          icon={TrendingUp}
          label="Gross profit"
          value={monthSummary.grossProfit}
        />
        <StatCard
          accent={monthSummary.netProfit >= 0 ? "emerald" : "rose"}
          helper="After expenses and payroll"
          icon={CircleDollarSign}
          label="Net profit estimate"
          value={monthSummary.netProfit}
        />
        <StatCard
          accent="slate"
          helper="Total entered expenses"
          icon={ReceiptText}
          label="Total expenses"
          value={monthSummary.totalExpenses}
        />
        <StatCard
          accent="cyan"
          helper="Tracked fuel profit, or daily sales fuel margin"
          icon={Fuel}
          label="Fuel profit"
          value={monthSummary.fuelProfit}
        />
        <StatCard
          accent="amber"
          helper="Commission less payouts"
          icon={Ticket}
          label="Lottery profit"
          value={monthSummary.lotteryProfit}
        />
        <StatCard
          accent="emerald"
          helper="Deli sales from entries or daily sales"
          icon={Beef}
          label="Deli sales"
          value={monthSummary.deliSales}
        />
        <StatCard
          accent="rose"
          helper="Hours multiplied by hourly rates"
          icon={Users}
          label="Payroll cost"
          value={monthSummary.payrollCost}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-1">
            <h3 className="text-lg font-black text-slate-950">Sales and profit trend</h3>
            <p className="text-sm text-slate-500">Recent daily inside sales, fuel profit, deli, and expenses.</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Area dataKey="inside" fill="url(#inside)" name="Inside sales" stroke="#06b6d4" strokeWidth={3} />
                <Area dataKey="fuelProfit" fill="#dcfce7" name="Fuel profit" stroke="#10b981" strokeWidth={2} />
                <Area dataKey="deli" fill="#fef3c7" name="Deli sales" stroke="#f59e0b" strokeWidth={2} />
                <Area dataKey="expenses" fill="#ffe4e6" name="Expenses" stroke="#f43f5e" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">Best / worst categories</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-700">Best category</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{categorySummary.best[0]}</p>
              <p className="text-sm text-slate-600">{currency(categorySummary.best[1])}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-sm font-bold text-rose-700">Worst category</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{categorySummary.worst[0]}</p>
              <p className="text-sm text-slate-600">{currency(categorySummary.worst[1])}</p>
            </div>
          </div>

          <div className="mt-6 h-64">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={categorySummary.ranked.map(([name, value]) => ({ name, value }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(value) => currency(Number(value))} />
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

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">Expenses by category</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {expenses.length ? (
            expenses.map((expense, index) => (
              <div className="rounded-2xl border border-slate-100 p-4" key={expense.name}>
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
